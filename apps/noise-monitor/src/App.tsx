import { useState, useCallback, useEffect } from 'react'
import { NoiseMonitor } from './components/NoiseMonitor'
import { SettingsPanel as Settings } from './components/Settings'
import { Theme, Sound, CustomImage, SoundSettings, DEFAULT_SOUND_SETTINGS } from './types'

const STORAGE_KEY = 'quiet-in-class-settings'

interface AppSettings {
  theme: Theme
  threshold: number
  selectedSound: string
  customSounds: Sound[]
  customImages: CustomImage[]
  isMuted: boolean
  upDelay: number
  downDelay: number
  soundSettings: SoundSettings
}

const defaultSettings: AppSettings = {
  theme: 'egg',
  threshold: 60,
  selectedSound: 'bell',
  customSounds: [],
  customImages: [],
  isMuted: false,
  upDelay: 2,
  downDelay: 4,
  soundSettings: DEFAULT_SOUND_SETTINGS,
}

function App() {
  const [settings, setSettings] = useState<AppSettings>(() => {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (saved) {
      try {
        const parsed = JSON.parse(saved)
        return { ...defaultSettings, ...parsed }
      } catch {
        return defaultSettings
      }
    }
    return defaultSettings
  })
  
  const [showSettings, setShowSettings] = useState(false)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [noiseLevel, setNoiseLevel] = useState(0)

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings))
  }, [settings])

  // Settings handlers will be expanded in future updates

  const handleMuteToggle = useCallback(() => {
    setSettings(prev => ({ ...prev, isMuted: !prev.isMuted }))
  }, [])

  const toggleFullscreen = useCallback(() => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().then(() => {
        setIsFullscreen(true)
      }).catch(() => {
        console.error('Fullscreen not supported')
      })
    } else {
      document.exitFullscreen().then(() => {
        setIsFullscreen(false)
      })
    }
  }, [])

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement)
    }
    document.addEventListener('fullscreenchange', handleFullscreenChange)
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange)
  }, [])

  return (
    <div className="h-full w-full bg-gradient-to-br from-gray-50 to-gray-100">
      <NoiseMonitor
        theme={settings.theme}
        threshold={settings.threshold}
        selectedSound={settings.selectedSound}
        customSounds={settings.customSounds}
        customImages={settings.customImages}
        isMuted={settings.isMuted}
        upDelay={settings.upDelay}
        downDelay={settings.downDelay}
        soundSettings={settings.soundSettings}
        onSettingsClick={() => setShowSettings(true)}
        onFullscreenClick={toggleFullscreen}
        onMuteClick={handleMuteToggle}
        isFullscreen={isFullscreen}
        onNoiseLevelChange={setNoiseLevel}
      />
      
      {showSettings && (
        <Settings
          currentTheme={settings.theme}
          customImages={settings.customImages}
          soundSettings={settings.soundSettings}
          noiseLevel={noiseLevel}
          onThemeChange={(theme) => setSettings(prev => ({ ...prev, theme }))}
          onDelayChange={(key, value) => setSettings(prev => ({ ...prev, [key]: value }))}
          onSoundSettingsChange={(soundSettings) => setSettings(prev => ({ ...prev, soundSettings }))}
          onClose={() => setShowSettings(false)}
        />
      )}
    </div>
  )
}

export default App
