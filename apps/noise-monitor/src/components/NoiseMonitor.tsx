import { useState, useEffect, useCallback, useRef } from 'react'
import { Theme, Sound, CustomImage, SoundSettings } from '../types'
import { EggTheme } from '../themes/EggTheme'
import { EggClassicTheme } from '../themes/EggClassicTheme'
import { GlassTheme } from '../themes/GlassTheme'
import { CustomTheme } from '../themes/CustomTheme'
import { ThermometerTheme } from '../themes/ThermometerTheme'
import { BatteryTheme } from '../themes/BatteryTheme'
import { WeatherTheme } from '../themes/WeatherTheme'
import { VolcanoTheme } from '../themes/VolcanoTheme'
import { useAudio } from '../hooks/useAudio'
import { useTTS, TTSConfig } from '../hooks/useTTS'
import { calculateNoiseLevel, getNoiseLevelNumber, smoothNoiseLevel } from '../utils/noiseCalculator'

// Time constant (seconds) for the exponential moving average applied to the
// raw per-frame mic reading. A single frame of FFT data is extremely noisy
// (a cough, a chair scrape, or just mic self-noise can spike or dip one
// frame), so the displayed level tracks this smoothed average instead of
// the instantaneous sample -- same idea as the "Fast"/"Slow" response
// setting on a real sound level meter.
const SMOOTHING_TAU = 0.3

interface NoiseMonitorProps {
  theme: Theme
  threshold: number
  selectedSound: string
  customSounds: Sound[]
  customImages: CustomImage[]
  isMuted: boolean
  backgroundColor?: string
  upDelay?: number
  downDelay?: number
  soundSettings?: SoundSettings
  onSettingsClick: () => void
  onFullscreenClick: () => void
  onMuteClick: () => void
  isFullscreen: boolean
  onNoiseLevelChange?: (level: number) => void
}

export function NoiseMonitor({
  theme,
  threshold,
  selectedSound,
  customSounds,
  customImages,
  isMuted,
  backgroundColor = 'dark',
  upDelay: _upDelay = 2,
  downDelay: _downDelay = 4,
  soundSettings,
  onSettingsClick,
  onFullscreenClick,
  onMuteClick,
  isFullscreen,
  onNoiseLevelChange,
}: NoiseMonitorProps) {
  const [displayLevel, setDisplayLevel] = useState(0)
  const [isTooLoud, setIsTooLoud] = useState(false)
  const [isListening, setIsListening] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const audioContextRef = useRef<AudioContext | null>(null)
  const analyserRef = useRef<AnalyserNode | null>(null)
  const microphoneRef = useRef<MediaStreamAudioSourceNode | null>(null)
  const animationFrameRef = useRef<number | null>(null)
  const upDelayTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const downDelayTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const pendingUpRef = useRef(false)
  const pendingDownRef = useRef(false)
  // The smoothed level is the source of truth for both the continuous
  // visual display and the alert/threshold logic below; committedLevelNumberRef
  // tracks the last level number (1-4) that actually got "confirmed" through
  // the up/down delay, separate from the live, every-frame smoothed value.
  const smoothedLevelRef = useRef(0)
  const lastFrameTimeRef = useRef<number | null>(null)
  const committedLevelNumberRef = useRef(1)
  
  const { triggerAlerts, stopAlerts } = useAudio(selectedSound, customSounds, isMuted, soundSettings)

  const ttsConfig: TTSConfig = {
    text: soundSettings?.ttsText || 'Please be quiet!',
    mode: soundSettings?.ttsMode || 'oneShot',
    apiKey: soundSettings?.ttsApiKey,
    voiceId: soundSettings?.ttsVoiceId || 'Xb7hH8MSUJpSbSDYk0k2',
  }
  const { triggerTTS, stopTTS } = useTTS(ttsConfig, isMuted)

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
      setError('Microphone access denied. Please allow microphone access to use the noise monitor.')
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
    setDisplayLevel(0)
    setIsTooLoud(false)
    if (upDelayTimerRef.current) clearTimeout(upDelayTimerRef.current)
    if (downDelayTimerRef.current) clearTimeout(downDelayTimerRef.current)
    pendingUpRef.current = false
    pendingDownRef.current = false
    smoothedLevelRef.current = 0
    lastFrameTimeRef.current = null
    committedLevelNumberRef.current = 1
    stopAlerts()
    stopTTS()
  }, [stopAlerts, stopTTS])

  useEffect(() => {
    if (!isListening || !analyserRef.current) return

    const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount)

    const updateNoiseLevel = () => {
      if (!analyserRef.current) return

      analyserRef.current.getByteFrequencyData(dataArray)
      const rawLevel = calculateNoiseLevel(dataArray)

      // Time-based EMA rather than a fixed per-frame factor, so the
      // smoothing window stays the same real-world duration regardless of
      // display refresh rate (a 30Hz vs 144Hz screen shouldn't smooth
      // differently). Clamp dt so resuming a backgrounded/throttled tab
      // doesn't produce one huge, meaningless jump.
      const now = performance.now()
      const dt = lastFrameTimeRef.current != null
        ? Math.min((now - lastFrameTimeRef.current) / 1000, 0.5)
        : 1 / 60
      lastFrameTimeRef.current = now
      const alpha = 1 - Math.exp(-dt / SMOOTHING_TAU)
      smoothedLevelRef.current = smoothNoiseLevel(smoothedLevelRef.current, rawLevel, alpha)
      const smoothedLevel = smoothedLevelRef.current

      // Continuous, every-frame update -- this is what themes animate
      // against, so the visual tracks the room smoothly instead of sitting
      // frozen and then jumping to a single sample once a delay elapses.
      setDisplayLevel(smoothedLevel)
      onNoiseLevelChange?.(smoothedLevel)

      // Alerts/status still only change after sustained time at a new
      // level, same as before -- but now gated on the already-smoothed
      // signal, so a brief spike has to actually persist to flip anything.
      const currentLevelNumber = committedLevelNumberRef.current
      const newLevelNumber = getNoiseLevelNumber(smoothedLevel, threshold)

      if (newLevelNumber > currentLevelNumber) {
        if (!pendingUpRef.current) {
          pendingUpRef.current = true
          upDelayTimerRef.current = setTimeout(() => {
            const freshLevelNumber = getNoiseLevelNumber(smoothedLevelRef.current, threshold)
            const oldLevelNumber = committedLevelNumberRef.current
            if (freshLevelNumber > oldLevelNumber) {
              committedLevelNumberRef.current = freshLevelNumber
              setIsTooLoud(freshLevelNumber >= 4)
              if (freshLevelNumber >= 4 && oldLevelNumber < 4) {
                triggerAlerts()
                triggerTTS()
              }
            }
            pendingUpRef.current = false
          }, _upDelay * 1000)
        }
        if (downDelayTimerRef.current) clearTimeout(downDelayTimerRef.current)
        pendingDownRef.current = false
      } else if (newLevelNumber < currentLevelNumber) {
        if (!pendingDownRef.current) {
          pendingDownRef.current = true
          downDelayTimerRef.current = setTimeout(() => {
            const freshLevelNumber = getNoiseLevelNumber(smoothedLevelRef.current, threshold)
            const oldLevelNumber = committedLevelNumberRef.current
            if (freshLevelNumber < oldLevelNumber) {
              committedLevelNumberRef.current = freshLevelNumber
              setIsTooLoud(freshLevelNumber >= 4)
              if (freshLevelNumber < 4) {
                stopAlerts()
                stopTTS()
              }
            }
            pendingDownRef.current = false
          }, _downDelay * 1000)
        }
        if (upDelayTimerRef.current) clearTimeout(upDelayTimerRef.current)
        pendingUpRef.current = false
      } else {
        pendingUpRef.current = false
        pendingDownRef.current = false
      }

      animationFrameRef.current = requestAnimationFrame(updateNoiseLevel)
    }

    updateNoiseLevel()

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current)
      }
    }
  }, [isListening, threshold, _upDelay, _downDelay, triggerAlerts, triggerTTS, stopAlerts, stopTTS, onNoiseLevelChange])

  useEffect(() => {
    return () => {
      stopListening()
    }
  }, [stopListening])

  const renderTheme = () => {
    const props = { noiseLevel: displayLevel, threshold, isTooLoud, customImages, backgroundColor }
    
    // Convert to level format for new themes
    const getLevel = (): 'quiet' | 'moderate' | 'loud' | 'tooLoud' => {
      if (isTooLoud) return 'tooLoud'
      const ratio = displayLevel / threshold
      if (ratio < 0.5) return 'quiet'
      if (ratio < 0.8) return 'moderate'
      return 'loud'
    }
    const levelProps = { level: getLevel() }
    
    switch (theme) {
      case 'egg':
        return <EggTheme {...props} />
      case 'eggClassic':
        return <EggClassicTheme {...props} />
      case 'glass':
        return <GlassTheme {...props} />
      case 'custom':
        return <CustomTheme {...props} />
      case 'thermometer':
        return <ThermometerTheme {...levelProps} />
      case 'battery':
        return <BatteryTheme {...levelProps} />
      case 'weather':
        return <WeatherTheme {...levelProps} />
      case 'volcano':
        return <VolcanoTheme {...levelProps} />
      default:
        return <EggTheme {...props} />
    }
  }

  return (
    <div className={`relative flex flex-col items-center justify-center ${isFullscreen ? 'fullscreen bg-black' : 'h-full w-full'}`}>
      {/* Control Bar */}
      <div className="absolute top-4 left-4 right-4 flex justify-between items-center z-20">
        <div className="flex gap-2">
          <button
            onClick={onMuteClick}
            className="p-3 bg-white/90 backdrop-blur-sm rounded-full shadow-lg hover:bg-white transition-all active:scale-95"
            title={isMuted ? 'Unmute' : 'Mute'}
          >
            {isMuted ? (
              <svg className="w-6 h-6 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2" />
              </svg>
            ) : (
              <svg className="w-6 h-6 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
              </svg>
            )}
          </button>
          
          <button
            onClick={onFullscreenClick}
            className="p-3 bg-white/90 backdrop-blur-sm rounded-full shadow-lg hover:bg-white transition-all active:scale-95"
            title={isFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}
          >
            {isFullscreen ? (
              <svg className="w-6 h-6 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            ) : (
              <svg className="w-6 h-6 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
              </svg>
            )}
          </button>
        </div>
        
        <button
          onClick={onSettingsClick}
          className="p-3 bg-white/90 backdrop-blur-sm rounded-full shadow-lg hover:bg-white transition-all active:scale-95"
          title="Settings"
        >
          <svg className="w-6 h-6 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
        </button>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex items-center justify-center w-full">
        {!isListening ? (
          <div className="text-center p-8">
            {error ? (
              <div className="mb-6">
                <div className="w-20 h-20 mx-auto mb-4 rounded-full bg-red-100 flex items-center justify-center">
                  <svg className="w-10 h-10 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                </div>
                <p className="text-red-600 max-w-md">{error}</p>
              </div>
            ) : (
              <div className="mb-8">
                <div className="w-32 h-32 mx-auto mb-6 rounded-full bg-tisa-purple/10 flex items-center justify-center animate-pulse-slow">
                  <svg className="w-16 h-16 text-tisa-purple" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                  </svg>
                </div>
                <h1 className="text-3xl font-bold text-gray-800 mb-2">Quiet in Class</h1>
                <p className="text-gray-600">Monitor classroom noise levels</p>
              </div>
            )}
            
            <button
              onClick={startListening}
              className="btn-primary text-lg px-8 py-4"
            >
              {error ? 'Try Again' : 'Start Monitoring'}
            </button>
          </div>
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            {renderTheme()}
          </div>
        )}
      </div>

      {/* Noise Level Indicator */}
      {isListening && (
        <div className="absolute bottom-8 left-1/2 transform -translate-x-1/2 z-20">
          <div className="bg-white/90 backdrop-blur-sm rounded-full px-6 py-3 shadow-lg">
            <div className="flex items-center gap-3">
              <div className={`w-3 h-3 rounded-full ${isTooLoud ? 'bg-red-500 animate-pulse' : 'bg-green-500'}`} />
              <span className={`font-medium ${isTooLoud ? 'text-red-600' : 'text-green-600'}`}>
                {isTooLoud ? 'Too Loud!' : 'Quiet'}
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
