import { useState } from 'react'
import { Sound } from '../types'

interface SoundSelectorProps {
  selectedSound: string
  customSounds: Sound[]
  onSoundChange: (soundId: string) => void
}

const builtInSounds: Sound[] = [
  { id: 'bell', name: 'School Bell', url: '/sounds/bell.mp3', isBuiltIn: true },
  { id: 'chime', name: 'Gentle Chime', url: '/sounds/chime.mp3', isBuiltIn: true },
  { id: 'buzz', name: 'Alert Buzz', url: '/sounds/buzz.mp3', isBuiltIn: true },
]

export function SoundSelector({ selectedSound, customSounds, onSoundChange }: SoundSelectorProps) {
  const [playingSound, setPlayingSound] = useState<string | null>(null)
  
  const allSounds = [...builtInSounds, ...customSounds]

  const playPreview = (sound: Sound) => {
    if (playingSound === sound.id) {
      setPlayingSound(null)
      return
    }

    const audio = new Audio(sound.url)
    audio.volume = 0.5
    audio.play().catch(() => {
      // Ignore autoplay errors
    })
    
    setPlayingSound(sound.id)
    
    audio.onended = () => {
      setPlayingSound(null)
    }
  }

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold text-gray-800">Alarm Sound</h3>
      
      <div className="space-y-2">
        {allSounds.map((sound) => (
          <div
            key={sound.id}
            className={`flex items-center gap-3 p-3 rounded-lg border-2 transition-all ${
              selectedSound === sound.id
                ? 'border-tisa-purple bg-tisa-purple/5'
                : 'border-gray-200 hover:border-gray-300'
            }`}
          >
            <button
              onClick={() => onSoundChange(sound.id)}
              className="flex-1 flex items-center gap-3 text-left"
            >
              <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                selectedSound === sound.id ? 'border-tisa-purple' : 'border-gray-300'
              }`}>
                {selectedSound === sound.id && (
                  <div className="w-3 h-3 rounded-full bg-tisa-purple" />
                )}
              </div>
              <div className="flex-1">
                <p className="font-medium text-gray-800">{sound.name}</p>
                {!sound.isBuiltIn && (
                  <p className="text-xs text-gray-500">Custom</p>
                )}
              </div>
            </button>
            
            <button
              onClick={() => playPreview(sound)}
              className="p-2 hover:bg-gray-100 rounded-full transition-colors"
              title="Preview"
            >
              {playingSound === sound.id ? (
                <svg className="w-5 h-5 text-tisa-purple" fill="currentColor" viewBox="0 0 24 24">
                  <rect x="6" y="4" width="4" height="16" />
                  <rect x="14" y="4" width="4" height="16" />
                </svg>
              ) : (
                <svg className="w-5 h-5 text-gray-600" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M8 5v14l11-7z" />
                </svg>
              )}
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}