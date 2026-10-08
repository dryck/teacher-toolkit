import { Theme, CustomImage, NoiseBand, ThemeProps } from '../types'
import { EggTheme } from '../themes/EggTheme'
import { EggClassicTheme } from '../themes/EggClassicTheme'
import { GlassTheme } from '../themes/GlassTheme'
import { ThermometerTheme } from '../themes/ThermometerTheme'
import { BatteryTheme } from '../themes/BatteryTheme'
import { WeatherTheme } from '../themes/WeatherTheme'
import { VolcanoTheme } from '../themes/VolcanoTheme'
import { CustomTheme } from '../themes/CustomTheme'

interface ThemeSelectorProps {
  currentTheme: Theme
  customImages: CustomImage[]
  onThemeChange: (theme: Theme) => void
}

const themes: { id: Theme; name: string; description: string; preview: string }[] = [
  {
    id: 'egg',
    name: 'Egg',
    description: 'A cute egg character that reacts to noise',
    preview: '🥚',
  },
  {
    id: 'eggClassic',
    name: 'Egg Classic',
    description: 'Original simple egg design with crack progression',
    preview: '🥚',
  },
  {
    id: 'glass',
    name: 'Glass',
    description: 'Elegant glass that fills with color',
    preview: '🥛',
  },
  {
    id: 'thermometer',
    name: 'Thermometer',
    description: 'Rising temperature shows noise level',
    preview: '🌡️',
  },
  {
    id: 'battery',
    name: 'Battery',
    description: 'Battery drains as noise increases',
    preview: '🔋',
  },
  {
    id: 'weather',
    name: 'Weather',
    description: 'Sunny to thunderstorm progression',
    preview: '☀️',
  },
  {
    id: 'volcano',
    name: 'Volcano',
    description: 'Volcano builds pressure until eruption',
    preview: '🌋',
  },
  {
    id: 'custom',
    name: 'Custom',
    description: 'Use your own uploaded images',
    preview: '🖼️',
  },
]

// A theme rendered at one band, for the picker's four-up preview.
function ThemePreview({ theme, band, customImages }: { theme: Theme; band: NoiseBand; customImages: CustomImage[] }) {
  // One props object, like NoiseMonitor builds. There used to be two here
  // too -- mockProps for the themes on the old contract and levelProps for the
  // others -- which meant the preview could show a theme a state the monitor
  // would never hand it.
  const INTENSITY: Record<NoiseBand, number> = {
    quiet: 0.4,
    moderate: 0.7,
    loud: 0.9,
    tooLoud: 1.1
  }

  const previewProps: ThemeProps = {
    band,
    intensity: INTENSITY[band],
    isTooLoud: band === 'tooLoud',
    customImages,
    backgroundColor: 'dark'
  }

  // Scale down the theme for mini preview
  const scaleStyle = { transform: 'scale(0.25)', transformOrigin: 'center center' }

  const renderMiniTheme = () => {
    switch (theme) {
      case 'egg':
        return <EggTheme {...previewProps} />
      case 'eggClassic':
        return <EggClassicTheme {...previewProps} />
      case 'glass':
        return <GlassTheme {...previewProps} />
      case 'custom':
        return <CustomTheme {...previewProps} />
      case 'thermometer':
        return <ThermometerTheme {...previewProps} />
      case 'battery':
        return <BatteryTheme {...previewProps} />
      case 'weather':
        return <WeatherTheme {...previewProps} />
      case 'volcano':
        return <VolcanoTheme {...previewProps} />
      default:
        return <EggTheme {...previewProps} />
    }
  }

  return (
    <div className="relative w-20 h-20 overflow-hidden rounded-lg bg-gray-100 flex items-center justify-center">
      <div style={scaleStyle} className="absolute w-[300px] h-[300px] flex items-center justify-center">
        {renderMiniTheme()}
      </div>
    </div>
  )
}

// Preview grid showing all 4 levels for a theme
function ThemePreviewGallery({ theme, customImages }: { theme: Theme; customImages: CustomImage[] }) {
  const bands: { band: NoiseBand; label: string; color: string }[] = [
    { band: 'quiet', label: 'Quiet', color: 'bg-green-100 text-green-700 border-green-200' },
    { band: 'moderate', label: 'Moderate', color: 'bg-yellow-100 text-yellow-700 border-yellow-200' },
    { band: 'loud', label: 'Loud', color: 'bg-orange-100 text-orange-700 border-orange-200' },
    { band: 'tooLoud', label: 'Too Loud', color: 'bg-red-100 text-red-700 border-red-200' },
  ]

  return (
    <div className="mt-3 grid grid-cols-4 gap-2">
      {bands.map(({ band, label, color }) => (
        <div key={band} className="flex flex-col items-center">
          <div className={`w-full aspect-square rounded-lg border-2 ${color} flex items-center justify-center overflow-hidden`}>
            <ThemePreview theme={theme} band={band} customImages={customImages} />
          </div>
          <span className={`text-[10px] font-medium mt-1 ${color.split(' ')[1]}`}>{label}</span>
        </div>
      ))}
    </div>
  )
}

export function ThemeSelector({ currentTheme, customImages, onThemeChange }: ThemeSelectorProps) {
  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold text-gray-800">Choose Theme</h3>
      
      <div className="grid gap-4">
        {themes.map((theme) => (
          <button
            key={theme.id}
            onClick={() => onThemeChange(theme.id)}
            disabled={theme.id === 'custom' && customImages.length === 0}
            className={`flex flex-col p-4 rounded-xl border-2 transition-all text-left ${
              currentTheme === theme.id
                ? 'border-tisa-purple bg-tisa-purple/5'
                : 'border-gray-200 hover:border-gray-300'
            } ${theme.id === 'custom' && customImages.length === 0 ? 'opacity-50 cursor-not-allowed' : ''}`}
          >
            <div className="flex items-center gap-4">
              <span className="text-4xl">{theme.preview}</span>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <p className="font-semibold text-gray-800">{theme.name}</p>
                  {currentTheme === theme.id && (
                    <span className="px-2 py-0.5 bg-tisa-purple text-white text-xs rounded-full">
                      Active
                    </span>
                  )}
                </div>
                <p className="text-sm text-gray-500">{theme.description}</p>
                {theme.id === 'custom' && customImages.length === 0 && (
                  <p className="text-xs text-amber-600 mt-1">Upload images to enable</p>
                )}
              </div>
            </div>
            
            {/* Theme Preview Gallery - shows all 4 noise levels (hidden on mobile) */}
            <div className="hidden sm:block">
              <ThemePreviewGallery theme={theme.id} customImages={customImages} />
            </div>
          </button>
        ))}
      </div>
    </div>
  )
}