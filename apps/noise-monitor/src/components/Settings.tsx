import { useState, useRef } from 'react'
import { Theme, CustomImage, ThresholdConfig, SoundSettings } from '../types'
import { useSettings } from '../hooks/useSettings'
import { ThemeSelector } from './ThemeSelector'

interface SettingsProps {
  currentTheme: Theme
  customImages: CustomImage[]
  soundSettings: SoundSettings
  noiseLevel?: number
  onThemeChange: (theme: Theme) => void
  onDelayChange: (key: 'upDelay' | 'downDelay', value: number) => void
  onSoundSettingsChange: (settings: SoundSettings) => void
  onClose: () => void
}

type SettingsTab = 'themes' | 'thresholds' | 'sounds'

const BUILT_IN_SOUNDS = [
  { id: 'bell', name: 'School Bell' },
  { id: 'chime', name: 'Gentle Chime' },
  { id: 'buzz', name: 'Alert Buzz' },
]

export function SettingsPanel({
  currentTheme,
  customImages,
  soundSettings,
  noiseLevel = 0,
  onThemeChange,
  onDelayChange,
  onSoundSettingsChange,
  onClose,
}: SettingsProps) {
  const [activeTab, setActiveTab] = useState<SettingsTab>('themes')
  const { thresholds, delays, errors, updateThreshold, updateDelay, resetToWHO, isUsingWHODefaults } = useSettings()
  const ttsRef = useRef<SpeechSynthesisUtterance | null>(null)

  const thresholdLabels: Record<keyof ThresholdConfig, string> = {
    quietToModerate: 'Quiet → Moderate',
    moderateToLoud: 'Moderate → Loud',
    loudToTooLoud: 'Loud → Too Loud',
    alarmTrigger: 'Alarm Trigger'
  }

  const thresholdDescriptions: Record<keyof ThresholdConfig, string> = {
    quietToModerate: 'Optimal for learning (<40 dB)',
    moderateToLoud: 'Acceptable level (40-55 dB)',
    loudToTooLoud: 'Disruptive to learning (55-70 dB)',
    alarmTrigger: 'Harmful, immediate action needed (>70 dB)'
  }

  const playTestAlarm = () => {
    const sound = BUILT_IN_SOUNDS.find((s) => s.id === soundSettings.selectedAlarmSound)
    if (!sound) return
    // Use the same generator as the app via a quick Audio beep for test
    const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)()
    const osc = audioCtx.createOscillator()
    const gain = audioCtx.createGain()
    if (sound.id === 'bell') {
      osc.type = 'sine'
      osc.frequency.setValueAtTime(523.25, audioCtx.currentTime)
    } else if (sound.id === 'chime') {
      osc.type = 'sine'
      osc.frequency.setValueAtTime(880, audioCtx.currentTime)
    } else {
      osc.type = 'sawtooth'
      osc.frequency.setValueAtTime(220, audioCtx.currentTime)
    }
    gain.gain.setValueAtTime(0.2, audioCtx.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.5)
    osc.connect(gain)
    gain.connect(audioCtx.destination)
    osc.start()
    osc.stop(audioCtx.currentTime + 0.5)
  }

  const playTestTTS = async () => {
    const text = soundSettings.ttsText || 'Please be quiet!'
    if (soundSettings.ttsApiKey && soundSettings.ttsVoiceId) {
      try {
        const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${soundSettings.ttsVoiceId}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'xi-api-key': soundSettings.ttsApiKey,
          },
          body: JSON.stringify({
            text,
            model_id: 'eleven_monolingual_v1',
            voice_settings: { stability: 0.5, similarity_boost: 0.75 },
          }),
        })
        if (!response.ok) throw new Error('ElevenLabs API error')
        const blob = await response.blob()
        const url = URL.createObjectURL(blob)
        const audio = new Audio(url)
        await audio.play()
        audio.onended = () => URL.revokeObjectURL(url)
        return
      } catch (err) {
        console.warn('ElevenLabs test failed, falling back to browser TTS:', err)
      }
    }
    if (!window.speechSynthesis) return
    window.speechSynthesis.cancel()
    const utterance = new SpeechSynthesisUtterance(text)
    utterance.rate = 1
    utterance.pitch = 1
    const voices = window.speechSynthesis.getVoices()
    const usVoice = voices.find((v) => v.lang === 'en-US')
    if (usVoice) utterance.voice = usVoice
    ttsRef.current = utterance
    window.speechSynthesis.speak(utterance)
  }

  const updateSound = <K extends keyof SoundSettings>(key: K, value: SoundSettings[K]) => {
    onSoundSettingsChange({ ...soundSettings, [key]: value })
  }

  const LiveNoiseBar = () => {
    const pct = Math.min(Math.max(noiseLevel, 0), 100)
    const markerPositions = {
      lv2: Math.min(Math.max(thresholds.quietToModerate, 0), 100),
      lv3: Math.min(Math.max(thresholds.moderateToLoud, 0), 100),
      lv4: Math.min(Math.max(thresholds.loudToTooLoud, 0), 100),
    }
    return (
      <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 mb-4">
        <div className="flex justify-between items-end mb-2">
          <span className="text-sm font-semibold text-gray-700">Live Noise Level</span>
          <span className="text-sm font-medium text-gray-900">{pct.toFixed(1)}% <span className="text-gray-500">({noiseLevel.toFixed(1)} dB)</span></span>
        </div>
        <div className="relative h-4 rounded-full overflow-hidden bg-gray-200">
          <div
            className="absolute inset-y-0 left-0 rounded-full"
            style={{
              width: `${pct}%`,
              background: 'linear-gradient(90deg, #22c55e 0%, #eab308 45%, #f97316 75%, #ef4444 100%)',
              transition: 'width 100ms linear',
            }}
          />
          {/* Markers */}
          <div
            className="absolute top-0 bottom-0 w-0.5 bg-gray-800"
            style={{ left: `${markerPositions.lv2}%` }}
            title="Lv.2"
          >
            <span className="absolute -top-4 left-1/2 -translate-x-1/2 text-[10px] font-bold text-gray-700">2</span>
          </div>
          <div
            className="absolute top-0 bottom-0 w-0.5 bg-gray-800"
            style={{ left: `${markerPositions.lv3}%` }}
            title="Lv.3"
          >
            <span className="absolute -top-4 left-1/2 -translate-x-1/2 text-[10px] font-bold text-gray-700">3</span>
          </div>
          <div
            className="absolute top-0 bottom-0 w-0.5 bg-gray-800"
            style={{ left: `${markerPositions.lv4}%` }}
            title="Lv.4"
          >
            <span className="absolute -top-4 left-1/2 -translate-x-1/2 text-[10px] font-bold text-gray-700">4</span>
          </div>
        </div>
        <div className="flex justify-between mt-1 text-[10px] text-gray-500">
          <span>0 dB</span>
          <span>100 dB</span>
        </div>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-lg h-[85vh] flex flex-col">
        {/* Header - fixed */}
        <div className="flex justify-between items-center p-4 border-b flex-shrink-0">
          <h2 className="text-xl font-bold text-gray-800">Settings</h2>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Tabs - fixed */}
        <div className="flex gap-2 p-4 bg-gray-100 flex-shrink-0 overflow-x-auto">
          <button
            onClick={() => setActiveTab('themes')}
            className={`flex-1 min-w-[80px] py-2 px-3 rounded-lg font-medium transition-colors text-sm sm:text-base ${
              activeTab === 'themes'
                ? 'bg-white text-tisa-purple shadow-sm'
                : 'text-gray-600 hover:text-gray-800'
            }`}
          >
            Themes
          </button>
          <button
            onClick={() => setActiveTab('thresholds')}
            className={`flex-1 min-w-[80px] py-2 px-3 rounded-lg font-medium transition-colors text-sm sm:text-base ${
              activeTab === 'thresholds'
                ? 'bg-white text-tisa-purple shadow-sm'
                : 'text-gray-600 hover:text-gray-800'
            }`}
          >
            Thresholds
          </button>
          <button
            onClick={() => setActiveTab('sounds')}
            className={`flex-1 min-w-[80px] py-2 px-3 rounded-lg font-medium transition-colors text-sm sm:text-base ${
              activeTab === 'sounds'
                ? 'bg-white text-tisa-purple shadow-sm'
                : 'text-gray-600 hover:text-gray-800'
            }`}
          >
            Sounds
          </button>
        </div>

        {/* Content - scrollable */}
        <div className="flex-1 overflow-y-auto p-4">
          {activeTab === 'themes' && (
            <ThemeSelector
              currentTheme={currentTheme}
              customImages={customImages}
              onThemeChange={onThemeChange}
            />
          )}

          {activeTab === 'thresholds' && (
            <div className="space-y-6 pb-4">
              <LiveNoiseBar />

              {/* WHO Info Box */} 
              <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
                <h3 className="font-semibold text-blue-900 mb-2">WHO Guidelines for Classrooms</h3>
                <ul className="text-sm text-blue-800 space-y-1">
                  <li>• <strong>&lt;40 dB:</strong> Optimal for learning</li>
                  <li>• <strong>40-55 dB:</strong> Acceptable</li>
                  <li>• <strong>55-70 dB:</strong> Disruptive</li>
                  <li>• <strong>&gt;70 dB:</strong> Harmful, action needed</li>
                </ul>
              </div>

              {/* Threshold Sliders */}
              <div className="space-y-6">
                {(Object.keys(thresholds) as Array<keyof ThresholdConfig>).map((key) => (
                  <div key={key}>
                    <div className="flex justify-between items-center mb-2">
                      <label className="font-medium text-gray-700">{thresholdLabels[key]}</label>
                      <div className="flex items-center gap-2">
                        <input
                          type="number"
                          value={thresholds[key]}
                          onChange={(e) => updateThreshold(key, Number(e.target.value))}
                          className="w-20 px-2 py-1 border rounded text-center"
                          min={20}
                          max={100}
                        />
                        <span className="text-gray-500">dB</span>
                      </div>
                    </div>
                    <input
                      type="range"
                      min={20}
                      max={100}
                      value={thresholds[key]}
                      onChange={(e) => updateThreshold(key, Number(e.target.value))}
                      className="w-full accent-tisa-purple"
                    />
                    <p className="text-xs text-gray-500 mt-1">{thresholdDescriptions[key]}</p>
                    {errors[key] && (
                      <p className="text-xs text-red-500 mt-1">{errors[key]}</p>
                    )}
                  </div>
                ))}
              </div>

              {/* Delay Settings */}
              <div className="space-y-6 pt-6 border-t">
                <h3 className="font-semibold text-gray-800">Transition Delays</h3>
                
                <div>
                  <div className="flex justify-between items-center mb-2">
                    <label className="font-medium text-gray-700">Up Delay</label>
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        value={delays.upDelay}
                        onChange={(e) => {
                          updateDelay('upDelay', Number(e.target.value))
                          onDelayChange('upDelay', Number(e.target.value))
                        }}
                        className="w-20 px-2 py-1 border rounded text-center"
                        min={0.5}
                        max={10}
                        step={0.5}
                      />
                      <span className="text-gray-500">sec</span>
                    </div>
                  </div>
                  <input
                    type="range"
                    min={0.5}
                    max={10}
                    step={0.5}
                    value={delays.upDelay}
                    onChange={(e) => {
                      updateDelay('upDelay', Number(e.target.value))
                      onDelayChange('upDelay', Number(e.target.value))
                    }}
                    className="w-full accent-tisa-purple"
                  />
                  <p className="text-xs text-gray-500 mt-1">Delay before noise level increases</p>
                </div>

                <div>
                  <div className="flex justify-between items-center mb-2">
                    <label className="font-medium text-gray-700">Down Delay</label>
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        value={delays.downDelay}
                        onChange={(e) => {
                          updateDelay('downDelay', Number(e.target.value))
                          onDelayChange('downDelay', Number(e.target.value))
                        }}
                        className="w-20 px-2 py-1 border rounded text-center"
                        min={0.5}
                        max={15}
                        step={0.5}
                      />
                      <span className="text-gray-500">sec</span>
                    </div>
                  </div>
                  <input
                    type="range"
                    min={0.5}
                    max={15}
                    step={0.5}
                    value={delays.downDelay}
                    onChange={(e) => {
                      updateDelay('downDelay', Number(e.target.value))
                      onDelayChange('downDelay', Number(e.target.value))
                    }}
                    className="w-full accent-tisa-purple"
                  />
                  <p className="text-xs text-gray-500 mt-1">Delay before noise level decreases</p>
                </div>
              </div>

              {/* Reset Button */}
              <div className="pt-6 border-t">
                <button
                  onClick={resetToWHO}
                  disabled={isUsingWHODefaults}
                  className="w-full py-3 px-4 bg-gray-100 hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed rounded-xl font-medium transition-colors"
                >
                  {isUsingWHODefaults ? 'Using WHO Recommendations ✓' : 'Reset to WHO Recommendations'}
                </button>
              </div>
            </div>
          )}

          {activeTab === 'sounds' && (
            <div className="space-y-8 pb-4">
              {/* Alarm Section */}
              <section className="space-y-4">
                <h3 className="font-semibold text-gray-800">Alarm Sound</h3>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {BUILT_IN_SOUNDS.map((sound) => (
                    <button
                      key={sound.id}
                      onClick={() => updateSound('selectedAlarmSound', sound.id)}
                      className={`py-3 px-4 rounded-xl border-2 font-medium transition-colors text-sm ${
                        soundSettings.selectedAlarmSound === sound.id
                          ? 'border-tisa-purple bg-tisa-purple/10 text-tisa-purple'
                          : 'border-gray-200 hover:border-gray-300 text-gray-700'
                      }`}
                    >
                      {sound.name}
                    </button>
                  ))}
                </div>

                <div className="flex items-center gap-4 bg-gray-50 rounded-xl p-4">
                  <span className="text-sm font-medium text-gray-700">Alarm Mode</span>
                  <div className="flex-1 flex bg-white rounded-lg border p-1">
                    <button
                      onClick={() => updateSound('alarmMode', 'oneShot')}
                      className={`flex-1 py-1.5 px-3 rounded-md text-sm font-medium transition-colors ${
                        soundSettings.alarmMode === 'oneShot'
                          ? 'bg-tisa-purple text-white'
                          : 'text-gray-600 hover:bg-gray-100'
                      }`}
                    >
                      One-shot
                    </button>
                    <button
                      onClick={() => updateSound('alarmMode', 'repeat')}
                      className={`flex-1 py-1.5 px-3 rounded-md text-sm font-medium transition-colors ${
                        soundSettings.alarmMode === 'repeat'
                          ? 'bg-tisa-purple text-white'
                          : 'text-gray-600 hover:bg-gray-100'
                      }`}
                    >
                      Repeat
                    </button>
                  </div>
                </div>

                <button
                  onClick={playTestAlarm}
                  className="w-full py-3 px-4 bg-gray-100 hover:bg-gray-200 rounded-xl font-medium transition-colors flex items-center justify-center gap-2"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  Test Alarm
                </button>
              </section>

              {/* TTS Section */}
              <section className="space-y-4 pt-6 border-t">
                <h3 className="font-semibold text-gray-800">Text-to-Speech Message</h3>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Message</label>
                  <input
                    type="text"
                    value={soundSettings.ttsText}
                    onChange={(e) => updateSound('ttsText', e.target.value)}
                    placeholder="Please be quiet!"
                    className="w-full px-4 py-3 border rounded-xl focus:outline-none focus:ring-2 focus:ring-tisa-purple/50"
                  />
                  <p className="text-xs text-gray-500 mt-2">
                    This message will be spoken when the noise level reaches Level 4 (Too Loud).
                  </p>
                </div>

                <div className="space-y-3">
                  <label className="block text-sm font-medium text-gray-700">ElevenLabs API Key (optional)</label>
                  <input
                    type="password"
                    value={soundSettings.ttsApiKey || ''}
                    onChange={(e) => updateSound('ttsApiKey', e.target.value)}
                    placeholder="sk_..."
                    className="w-full px-4 py-3 border rounded-xl focus:outline-none focus:ring-2 focus:ring-tisa-purple/50"
                  />
                  <p className="text-xs text-gray-500">
                    Leave empty to use browser SpeechSynthesis as fallback.
                  </p>
                </div>

                <div className="flex items-center gap-4 bg-gray-50 rounded-xl p-4">
                  <span className="text-sm font-medium text-gray-700">TTS Mode</span>
                  <div className="flex-1 flex bg-white rounded-lg border p-1">
                    <button
                      onClick={() => updateSound('ttsMode', 'oneShot')}
                      className={`flex-1 py-1.5 px-3 rounded-md text-sm font-medium transition-colors ${
                        soundSettings.ttsMode === 'oneShot'
                          ? 'bg-tisa-purple text-white'
                          : 'text-gray-600 hover:bg-gray-100'
                      }`}
                    >
                      One-shot
                    </button>
                    <button
                      onClick={() => updateSound('ttsMode', 'repeat')}
                      className={`flex-1 py-1.5 px-3 rounded-md text-sm font-medium transition-colors ${
                        soundSettings.ttsMode === 'repeat'
                          ? 'bg-tisa-purple text-white'
                          : 'text-gray-600 hover:bg-gray-100'
                      }`}
                    >
                      Repeat every 5s
                    </button>
                  </div>
                </div>

                <button
                  onClick={playTestTTS}
                  className="w-full py-3 px-4 bg-gray-100 hover:bg-gray-200 rounded-xl font-medium transition-colors flex items-center justify-center gap-2"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                  </svg>
                  Test TTS
                </button>
              </section>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
