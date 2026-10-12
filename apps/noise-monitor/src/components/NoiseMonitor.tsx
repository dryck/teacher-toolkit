import { useState, useEffect, useCallback, useRef } from 'react'
import { Theme, Sound, CustomImage, SoundSettings, ThresholdConfig, ThemeProps, NoiseBand } from '../types'
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
import {
  calculateNoiseLevel,
  bandFromLevelNumber,
  getNoiseLevelNumber,
  smoothNoiseLevel,
  ALARM_STEP
} from '../utils/noiseCalculator'
import { calibrateWithFloor, CALIBRATION_MS } from '../utils/calibration'

// Time constant (seconds) for the exponential moving average applied to the
// raw per-frame mic reading. A single frame of FFT data is extremely noisy
// (a cough, a chair scrape, or just mic self-noise can spike or dip one
// frame), so the displayed level tracks this smoothed average instead of
// the instantaneous sample -- same idea as the "Fast"/"Slow" response
// setting on a real sound level meter.
const SMOOTHING_TAU = 0.3

// Colours and wording for the status pill, keyed by band.
const BAND_LABEL: Record<NoiseBand, string> = {
  quiet: 'Quiet',
  moderate: 'Moderate',
  loud: 'Loud',
  tooLoud: 'Too Loud!'
}

const BAND_DOT: Record<NoiseBand, string> = {
  quiet: 'bg-green-500',
  moderate: 'bg-yellow-500',
  loud: 'bg-orange-500',
  tooLoud: 'bg-red-500'
}

// Darker than the dots: these sit on white as text, where the dot shades do
// not reach 4.5:1 -- yellow-500 on white is about 1.9:1.
const BAND_TEXT: Record<NoiseBand, string> = {
  quiet: 'text-green-600',
  moderate: 'text-yellow-700',
  loud: 'text-orange-700',
  tooLoud: 'text-red-600'
}

interface NoiseMonitorProps {
  theme: Theme
  // All four bounds: the three band edges and the alarm point. Passing only
  // alarmTrigger is what left the other three sliders inert.
  thresholds: ThresholdConfig
  // Called once with bands measured from this room, a few seconds after
  // listening starts. Omit it to skip calibration entirely.
  onCalibrated?: (bands: ThresholdConfig, floor: number) => void
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
  thresholds,
  onCalibrated,
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
  // The alarm latches: once raised it stays raised until the teacher resets
  // it, however quiet the room gets.
  //
  // It used to clear itself on the next downward commit, which made the alarm
  // as short as the room's own dip -- and the down delay (2-4s) is shorter
  // than the alarm sounds themselves (the bell is 2s), so stopAlerts() paused
  // the audio mid-playback. A class that got briefly loud produced a clipped
  // noise and an egg that was whole again before anyone looked up.
  //
  // Mirrored into a ref because the measurement loop runs off refs and would
  // otherwise read the value captured when its effect last ran.
  const [isAlarmLatched, setIsAlarmLatched] = useState(false)
  const alarmLatchedRef = useRef(false)
  // Raw samples from the first few seconds of listening, used once to place
  // the bands relative to this room's own floor. Dropped afterwards.
  const calibrationSamplesRef = useRef<number[] | null>(null)
  const calibrationUntilRef = useRef<number>(0)
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
  // tracks the last step (1-5: the four bands, then the alarm) that actually
  // got "confirmed" through the up/down delay, separate from the live,
  // every-frame smoothed value.
  const smoothedLevelRef = useRef(0)
  const lastFrameTimeRef = useRef<number | null>(null)
  const committedLevelNumberRef = useRef(1)
  // What the themes render: the committed step itself, mirrored into state.
  //
  // The band used to be re-derived from a *snapshot of the level* taken at the
  // moment of the commit, which made the committed state two values that could
  // disagree. They did: changing a threshold in Settings re-ran getNoiseBand on
  // the stale snapshot, so the picture could move to a band the delay logic's
  // own counter did not believe it was in -- and from there the next up/down
  // comparison was made against the wrong baseline. One number now.
  const [committedStep, setCommittedStep] = useState(1)
  // Kept only for `intensity` (continuous fill heights and wobble), which needs
  // a level rather than a band. Delay-gated like the step, for the same reason.
  const [committedDisplayLevel, setCommittedDisplayLevel] = useState(0)

  const alertType = soundSettings?.alertType || 'sound'
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
      // Browser defaults enable autoGainControl, noiseSuppression and
      // echoCancellation -- all three are designed to make a *voice call*
      // sound good, and all three fight a noise measurement:
      //
      //   autoGainControl normalises loudness, so it raises the gain in a
      //     quiet room and lowers it in a loud one. That is precisely the
      //     signal this tool exists to show, cancelled out.
      //   noiseSuppression strips steady broadband sound -- the hum of a busy
      //     classroom -- while preserving one near speaker.
      //   echoCancellation can gate the input entirely.
      //
      // Turning them off makes the reading a (still relative) measure of how
      // loud the room is, rather than of how well the browser's voice
      // pipeline is coping.
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          autoGainControl: false,
          noiseSuppression: false,
          echoCancellation: false
        }
      })
      
      audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)()
      analyserRef.current = audioContextRef.current.createAnalyser()
      analyserRef.current.fftSize = 256
      // Set explicitly rather than relying on the spec defaults. These two
      // decide the dBFS window that getByteFrequencyData maps onto 0..255, so
      // they set the whole scale -- leaving them implicit means a browser
      // changing its defaults silently moves every teacher's thresholds.
      // The values are the current defaults, so this pins today's behaviour.
      analyserRef.current.minDecibels = -100
      analyserRef.current.maxDecibels = -30
      // The analyser's own smoothing, on top of smoothNoiseLevel. Also pinned.
      analyserRef.current.smoothingTimeConstant = 0.8
      
      microphoneRef.current = audioContextRef.current.createMediaStreamSource(stream)
      microphoneRef.current.connect(analyserRef.current)
      
      // Open the calibration window. performance.now() is the same clock the
      // measurement loop reads, so the two cannot disagree.
      calibrationSamplesRef.current = []
      calibrationUntilRef.current = performance.now() + CALIBRATION_MS

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
    alarmLatchedRef.current = false
    setIsAlarmLatched(false)
    if (upDelayTimerRef.current) clearTimeout(upDelayTimerRef.current)
    if (downDelayTimerRef.current) clearTimeout(downDelayTimerRef.current)
    pendingUpRef.current = false
    pendingDownRef.current = false
    smoothedLevelRef.current = 0
    lastFrameTimeRef.current = null
    calibrationSamplesRef.current = null
    calibrationUntilRef.current = 0
    committedLevelNumberRef.current = 1
    setCommittedStep(1)
    setCommittedDisplayLevel(0)
    stopAlerts()
    stopTTS()
  }, [stopAlerts, stopTTS])

  /**
   * Acknowledge the alarm: stop the sound, mend the egg, re-arm.
   *
   * Re-arming syncs the committed step to the room's *current* level rather
   * than dropping it to 1. Two reasons: the picture must not claim the room
   * went quiet when it did not, and a reset pressed while the class is still
   * shouting would otherwise re-break the egg a moment later, which reads as
   * a broken button rather than an accurate one. So the alarm comes back when
   * the room has fallen below the alarm point and risen through it again --
   * acknowledge-and-rearm, the way an alarm panel's silence button works.
   */
  const resetAlarm = useCallback(() => {
    alarmLatchedRef.current = false
    setIsAlarmLatched(false)
    stopAlerts()
    stopTTS()

    const step = getNoiseLevelNumber(smoothedLevelRef.current, thresholds)
    committedLevelNumberRef.current = step
    setCommittedStep(step)
    setCommittedDisplayLevel(smoothedLevelRef.current)

    // A timer still pending from before the reset would commit against the
    // baseline this just replaced.
    if (upDelayTimerRef.current) clearTimeout(upDelayTimerRef.current)
    if (downDelayTimerRef.current) clearTimeout(downDelayTimerRef.current)
    upDelayTimerRef.current = null
    downDelayTimerRef.current = null
    pendingUpRef.current = false
    pendingDownRef.current = false
  }, [stopAlerts, stopTTS, thresholds])

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

      // Calibration window: gather the raw, unsmoothed index and derive the
      // bands from this room's quiet floor. Shipped constants cannot be right
      // for two rooms -- the index is relative to the microphone's full scale.
      const samples = calibrationSamplesRef.current
      if (samples) {
        samples.push(rawLevel)
        if (now >= calibrationUntilRef.current) {
          calibrationSamplesRef.current = null
          const measured = calibrateWithFloor(samples)
          // null means the window was too short or too noisy to trust, in
          // which case the existing thresholds simply stand.
          if (measured) onCalibrated?.(measured.bands, measured.floor)
        }
      }

      // Continuous, every-frame update -- this is what themes animate
      // against, so the visual tracks the room smoothly instead of sitting
      // frozen and then jumping to a single sample once a delay elapses.
      onNoiseLevelChange?.(smoothedLevel)

      // Alerts/status still only change after sustained time at a new
      // level, same as before -- but now gated on the already-smoothed
      // signal, so a brief spike has to actually persist to flip anything.
      const currentLevelNumber = committedLevelNumberRef.current
      const newLevelNumber = getNoiseLevelNumber(smoothedLevel, thresholds)

      if (newLevelNumber > currentLevelNumber) {
        if (!pendingUpRef.current) {
          pendingUpRef.current = true
          upDelayTimerRef.current = setTimeout(() => {
            const freshLevelNumber = getNoiseLevelNumber(smoothedLevelRef.current, thresholds)
            const oldLevelNumber = committedLevelNumberRef.current
            if (freshLevelNumber > oldLevelNumber) {
              committedLevelNumberRef.current = freshLevelNumber
              setCommittedStep(freshLevelNumber)
              setCommittedDisplayLevel(smoothedLevelRef.current)
              // Raised once per latch. useAudio and useTTS each guard their
              // own re-entry too (a one-shot flag, a repeat interval), so
              // removing this changes nothing observable today and no test can
              // tell the two arrangements apart -- it is here so the latch's
              // meaning is stated where the latch lives, rather than resting
              // on an internal ref in another module.
              if (freshLevelNumber >= ALARM_STEP && !alarmLatchedRef.current) {
                alarmLatchedRef.current = true
                setIsAlarmLatched(true)
                if (alertType !== 'voice') triggerAlerts()
                if (alertType !== 'sound') triggerTTS()
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
            const freshLevelNumber = getNoiseLevelNumber(smoothedLevelRef.current, thresholds)
            const oldLevelNumber = committedLevelNumberRef.current
            if (freshLevelNumber < oldLevelNumber) {
              committedLevelNumberRef.current = freshLevelNumber
              setCommittedStep(freshLevelNumber)
              setCommittedDisplayLevel(smoothedLevelRef.current)
              // Deliberately does not stop the alarm. A quietening room is
              // what the alarm is asking for, not a reason to cancel it
              // before anyone has acknowledged it -- that is the reset
              // button's job.
            }
            pendingDownRef.current = false
          }, _downDelay * 1000)
        }
        if (upDelayTimerRef.current) clearTimeout(upDelayTimerRef.current)
        pendingUpRef.current = false
      } else {
        // Back to equal with the committed level -- a pending timer from a
        // brief overshoot in either direction is now stale and must be
        // cancelled outright, not just have its pending flag cleared.
        // Otherwise it keeps running on its original schedule, orphaned
        // from pendingUpRef/pendingDownRef, and can fire a commit later
        // off a schedule that no longer reflects the actual signal --
        // shortening the effective delay the next time a real transition
        // starts (since the stale timer can land mid-way through it).
        if (upDelayTimerRef.current) {
          clearTimeout(upDelayTimerRef.current)
          upDelayTimerRef.current = null
        }
        if (downDelayTimerRef.current) {
          clearTimeout(downDelayTimerRef.current)
          downDelayTimerRef.current = null
        }
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
    // stopAlerts/stopTTS are no longer called from this loop -- only from
    // resetAlarm and stopListening -- so they are not dependencies of it.
  }, [isListening, thresholds, _upDelay, _downDelay, alertType, triggerAlerts, triggerTTS, onNoiseLevelChange, onCalibrated])

  useEffect(() => {
    return () => {
      stopListening()
    }
  }, [stopListening])

  // The committed band, shared by the themes and the status pill below so the
  // picture and the words can never name different levels.
  //
  // While latched the band is pinned to the top: a broken egg sitting on a
  // calm green background would be two halves of the display disagreeing. The
  // step underneath keeps tracking the room regardless, so the moment the
  // teacher resets, the display is already correct.
  const band = isAlarmLatched ? 'tooLoud' : bandFromLevelNumber(committedStep)

  const renderTheme = () => {
    // One set of props for every theme, off the one committed step -- so the
    // band a theme draws and the step the delay logic counts can never be two
    // different answers.
    //
    // Both values are the delay-gated ones rather than the live per-frame
    // level, which is what makes the Transition Delay setting govern when a
    // theme is allowed to change at all, instead of only gating the alarm.
    const props: ThemeProps = {
      band,
      intensity: thresholds.alarmTrigger > 0
        ? committedDisplayLevel / thresholds.alarmTrigger
        : 0,
      isTooLoud: isAlarmLatched,
      customImages,
      backgroundColor
    }

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
        return <ThermometerTheme {...props} />
      case 'battery':
        return <BatteryTheme {...props} />
      case 'weather':
        return <WeatherTheme {...props} />
      case 'volcano':
        return <VolcanoTheme {...props} />
      default:
        return <EggTheme {...props} />
    }
  }

  return (
    <div className={`relative flex flex-col items-center justify-center ${isFullscreen ? 'fullscreen bg-gray-800' : 'h-full w-full'}`}>
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
        <div className="absolute bottom-8 left-1/2 transform -translate-x-1/2 z-20 flex items-center gap-3">
          <div className="bg-white/90 backdrop-blur-sm rounded-full px-6 py-3 shadow-lg">
            {/* Named the band, not just quiet-or-alarm. This read "Quiet" for
                everything below the alarm, so the one piece of text on the
                screen contradicted a picture that had already gone orange --
                and a teacher checking which band the room was in was told the
                wrong one three times out of four. */}
            <div className="flex items-center gap-3" aria-live="polite">
              <div className={`w-3 h-3 rounded-full ${BAND_DOT[band]} ${isAlarmLatched ? 'animate-pulse' : ''}`} />
              <span className={`font-medium ${BAND_TEXT[band]}`}>
                {isAlarmLatched ? 'Too Loud!' : BAND_LABEL[band]}
              </span>
            </div>
          </div>

          {/* The only way out of the alarm. Rendered beside the status rather
              than in the top control bar so it is where the teacher is already
              looking, and large enough to hit from a standing position at a
              projector. */}
          {isAlarmLatched && (
            <button
              onClick={resetAlarm}
              className="bg-red-600 hover:bg-red-700 text-white font-semibold rounded-full px-6 py-3 shadow-lg transition-colors active:scale-95"
              title="Stop the alarm and mend the egg"
            >
              Reset
            </button>
          )}
        </div>
      )}
    </div>
  )
}
