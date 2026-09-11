import { useState, useEffect, useRef, useCallback } from 'react'

interface UseNoiseLevelOptions {
  threshold: number
  onThresholdCrossed?: (isTooLoud: boolean) => void
}

export function useNoiseLevel({ threshold, onThresholdCrossed }: UseNoiseLevelOptions) {
  const [noiseLevel, setNoiseLevel] = useState(0)
  const [isTooLoud, setIsTooLoud] = useState(false)
  const [isListening, setIsListening] = useState(false)
  const [error, setError] = useState<string | null>(null)
  
  const audioContextRef = useRef<AudioContext | null>(null)
  const analyserRef = useRef<AnalyserNode | null>(null)
  const microphoneRef = useRef<MediaStreamAudioSourceNode | null>(null)
  const animationFrameRef = useRef<number | null>(null)
  const wasTooLoudRef = useRef(false)

  const startListening = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      
      audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)()
      analyserRef.current = audioContextRef.current.createAnalyser()
      analyserRef.current.fftSize = 256
      
      microphoneRef.current = audioContextRef.current.createMediaStreamSource(stream)
      microphoneRef.current.connect(analyserRef.current)
      
      setIsListening(true)
      setError(null)
    } catch (err) {
      setError('Microphone access denied')
      setIsListening(false)
    }
  }, [])

  const stopListening = useCallback(() => {
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current)
    }
    if (microphoneRef.current) {
      microphoneRef.current.disconnect()
    }
    if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
      audioContextRef.current.close()
    }
    setIsListening(false)
    setNoiseLevel(0)
    setIsTooLoud(false)
  }, [])

  useEffect(() => {
    if (!isListening || !analyserRef.current) return

    const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount)
    
    const updateNoiseLevel = () => {
      if (!analyserRef.current) return
      
      analyserRef.current.getByteFrequencyData(dataArray)
      
      // Calculate RMS (root mean square) for volume
      let sum = 0
      for (let i = 0; i < dataArray.length; i++) {
        sum += dataArray[i] * dataArray[i]
      }
      const rms = Math.sqrt(sum / dataArray.length)
      
      // Convert to decibel-like scale (0-100)
      const normalizedLevel = Math.min(Math.max((rms / 128) * 100, 0), 100)
      const tooLoud = normalizedLevel > threshold
      
      setNoiseLevel(normalizedLevel)
      setIsTooLoud(tooLoud)
      
      // Trigger callback on threshold cross
      if (tooLoud !== wasTooLoudRef.current) {
        onThresholdCrossed?.(tooLoud)
        wasTooLoudRef.current = tooLoud
      }
      
      animationFrameRef.current = requestAnimationFrame(updateNoiseLevel)
    }
    
    updateNoiseLevel()
    
    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current)
      }
    }
  }, [isListening, threshold, onThresholdCrossed])

  useEffect(() => {
    return () => {
      stopListening()
    }
  }, [stopListening])

  return {
    noiseLevel,
    isTooLoud,
    isListening,
    error,
    startListening,
    stopListening,
  }
}