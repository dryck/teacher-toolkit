import { useCallback, useRef, useEffect, useState } from 'react'

export type TTSMode = 'oneShot' | 'repeat'

export interface TTSConfig {
  text: string
  mode: TTSMode
  voiceId?: string
  apiKey?: string
}

export const DEFAULT_TTS_CONFIG: TTSConfig = {
  text: 'Please be quiet!',
  mode: 'oneShot',
  voiceId: 'Xb7hH8MSUJpSbSDYk0k2', // ElevenLabs default US English female
}

const ELEVENLABS_API_URL = 'https://api.elevenlabs.io/v1/text-to-speech'

export function useTTS(config: TTSConfig, isMuted: boolean) {
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const hasPlayedRef = useRef(false)
  const repeatIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const [isGenerating, setIsGenerating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const cachedUrlRef = useRef<string | null>(null)
  const isElevenLabsRef = useRef(false)

  // Reset when config or mute changes
  useEffect(() => {
    hasPlayedRef.current = false
    stopTTS()
  }, [isMuted, config.text, config.mode, config.voiceId, config.apiKey])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopTTS()
      if (cachedUrlRef.current && isElevenLabsRef.current) {
        URL.revokeObjectURL(cachedUrlRef.current)
        cachedUrlRef.current = null
      }
    }
  }, [])

  const generateElevenLabsSpeech = useCallback(async (): Promise<string | null> => {
    if (!config.apiKey || !config.voiceId) return null

    try {
      const response = await fetch(`${ELEVENLABS_API_URL}/${config.voiceId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'xi-api-key': config.apiKey,
        },
        body: JSON.stringify({
          text: config.text,
          model_id: 'eleven_monolingual_v1',
          voice_settings: {
            stability: 0.5,
            similarity_boost: 0.75,
          },
        }),
      })

      if (!response.ok) {
        throw new Error(`ElevenLabs API error: ${response.status}`)
      }

      const blob = await response.blob()
      const url = URL.createObjectURL(blob)
      isElevenLabsRef.current = true
      return url
    } catch (err) {
      console.warn('ElevenLabs TTS failed:', err)
      return null
    }
  }, [config.apiKey, config.voiceId, config.text])

  const playBrowserTTS = useCallback(() => {
    if (isMuted || !window.speechSynthesis) return
    window.speechSynthesis.cancel()
    const utterance = new SpeechSynthesisUtterance(config.text || 'Please be quiet!')
    utterance.rate = 1
    utterance.pitch = 1
    // Prefer US English voice
    const voices = window.speechSynthesis.getVoices()
    const usVoice = voices.find((v) => v.lang === 'en-US')
    if (usVoice) utterance.voice = usVoice
    window.speechSynthesis.speak(utterance)
  }, [isMuted, config.text])

  const playAudio = useCallback((url: string) => {
    if (isMuted) return
    if (!audioRef.current || audioRef.current.src !== url) {
      if (audioRef.current) {
        audioRef.current.pause()
      }
      audioRef.current = new Audio(url)
      audioRef.current.volume = 1.0
    }
    const audio = audioRef.current
    audio.currentTime = 0
    const promise = audio.play()
    if (promise !== undefined) {
      promise.catch((err) => {
        console.warn('Audio play failed:', err)
      })
    }
  }, [isMuted])

  const triggerTTS = useCallback(async () => {
    if (isMuted) return

    const mode = config.mode || 'oneShot'

    if (mode === 'oneShot') {
      if (hasPlayedRef.current) return
      hasPlayedRef.current = true
    }

    // If repeating, don't overlap intervals
    if (repeatIntervalRef.current) return

    const play = async () => {
      if (config.apiKey && config.voiceId) {
        if (!cachedUrlRef.current) {
          setIsGenerating(true)
          setError(null)
          const url = await generateElevenLabsSpeech()
          setIsGenerating(false)
          if (url) {
            cachedUrlRef.current = url
            playAudio(url)
          } else {
            playBrowserTTS()
          }
        } else {
          playAudio(cachedUrlRef.current)
        }
      } else {
        playBrowserTTS()
      }
    }

    await play()

    if (mode === 'repeat') {
      repeatIntervalRef.current = setInterval(() => {
        if (!isMuted) {
          if (cachedUrlRef.current) {
            playAudio(cachedUrlRef.current)
          } else {
            playBrowserTTS()
          }
        }
      }, 5000)
    }
  }, [isMuted, config.mode, config.apiKey, config.voiceId, generateElevenLabsSpeech, playAudio, playBrowserTTS])

  const stopTTS = useCallback(() => {
    if (repeatIntervalRef.current) {
      clearInterval(repeatIntervalRef.current)
      repeatIntervalRef.current = null
    }
    if (window.speechSynthesis) {
      window.speechSynthesis.cancel()
    }
    if (audioRef.current) {
      audioRef.current.pause()
      audioRef.current.currentTime = 0
    }
    hasPlayedRef.current = false
  }, [])

  return { triggerTTS, stopTTS, isGenerating, error }
}
