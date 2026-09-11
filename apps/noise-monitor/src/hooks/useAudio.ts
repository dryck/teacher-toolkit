import { useCallback, useRef, useEffect, useState } from 'react'
import { Sound, SoundSettings } from '../types'
import { generateBellSound, generateChimeSound, generateBuzzSound } from '../utils/soundGenerator'

const builtInSounds: Sound[] = [
  { id: 'bell', name: 'School Bell', url: '', isBuiltIn: true },
  { id: 'chime', name: 'Gentle Chime', url: '', isBuiltIn: true },
  { id: 'buzz', name: 'Alert Buzz', url: '', isBuiltIn: true },
]

export function useAudio(
  selectedSoundId: string,
  customSounds: Sound[],
  isMuted: boolean,
  soundSettings?: SoundSettings
) {
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const currentSoundUrlRef = useRef<string | null>(null)
  const [generatedUrls, setGeneratedUrls] = useState<Record<string, string>>({})
  const alarmHasPlayedRef = useRef(false)
  const repeatIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // Generate sounds on first use
  useEffect(() => {
    const generateSounds = async () => {
      const urls: Record<string, string> = {}
      try {
        urls['bell'] = generateBellSound()
        urls['chime'] = generateChimeSound()
        urls['buzz'] = generateBuzzSound()
        setGeneratedUrls(urls)
      } catch (e) {
        console.error('Failed to generate sounds:', e)
      }
    }
    generateSounds()
  }, [])

  // Reset one-shot flags when conditions change
  useEffect(() => {
    alarmHasPlayedRef.current = false
    if (repeatIntervalRef.current) {
      clearInterval(repeatIntervalRef.current)
      repeatIntervalRef.current = null
    }
    if (audioRef.current) {
      audioRef.current.pause()
      audioRef.current.currentTime = 0
    }
  }, [isMuted, selectedSoundId, soundSettings?.selectedAlarmSound, soundSettings?.alarmMode])

  // Find the selected sound
  const getSelectedSound = useCallback((): Sound | undefined => {
    const allSounds = [...builtInSounds, ...customSounds]
    const effectiveId = soundSettings?.selectedAlarmSound || selectedSoundId
    const sound = allSounds.find(s => s.id === effectiveId) || builtInSounds[0]
    // Replace empty URL with generated URL for built-in sounds
    if (sound.isBuiltIn && generatedUrls[sound.id]) {
      return { ...sound, url: generatedUrls[sound.id] }
    }
    return sound
  }, [selectedSoundId, customSounds, generatedUrls, soundSettings?.selectedAlarmSound])

  // Play alarm sound
  const playAlarm = useCallback(() => {
    if (isMuted) return

    const sound = getSelectedSound()
    if (!sound) return

    // Create new audio if sound changed or no audio exists
    if (!audioRef.current || currentSoundUrlRef.current !== sound.url) {
      if (audioRef.current) {
        audioRef.current.pause()
        audioRef.current = null
      }
      
      audioRef.current = new Audio(sound.url)
      audioRef.current.volume = 0.7
      currentSoundUrlRef.current = sound.url
    }

    // Reset and play
    const audio = audioRef.current
    audio.currentTime = 0
    
    // Play with error handling
    const playPromise = audio.play()
    if (playPromise !== undefined) {
      playPromise.catch((error) => {
        console.warn('Audio play failed:', error)
      })
    }
  }, [getSelectedSound, isMuted])

  const triggerAlerts = useCallback(() => {
    if (isMuted) return

    const alarmMode = soundSettings?.alarmMode || 'oneShot'

    // Alarm only
    if (alarmMode === 'oneShot') {
      if (!alarmHasPlayedRef.current) {
        playAlarm()
        alarmHasPlayedRef.current = true
      }
    } else {
      // Repeat mode: play immediately and every 3 seconds
      if (!repeatIntervalRef.current) {
        playAlarm()
        repeatIntervalRef.current = setInterval(() => {
          if (!isMuted) {
            playAlarm()
          }
        }, 3000)
      }
    }
  }, [isMuted, soundSettings?.alarmMode, playAlarm])

  const stopAlerts = useCallback(() => {
    if (repeatIntervalRef.current) {
      clearInterval(repeatIntervalRef.current)
      repeatIntervalRef.current = null
    }
    if (audioRef.current) {
      audioRef.current.pause()
      audioRef.current.currentTime = 0
    }
    alarmHasPlayedRef.current = false
  }, [])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopAlerts()
      if (audioRef.current) {
        audioRef.current.pause()
        audioRef.current = null
      }
    }
  }, [stopAlerts])

  return { triggerAlerts, stopAlerts }
}
