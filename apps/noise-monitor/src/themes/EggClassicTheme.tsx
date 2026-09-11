import { ThemeProps } from '../types'

// Original classic egg SVG path
const EGG_PATH = 'M150,28 C218,28 262,90 262,178 C262,272 215,352 150,352 C85,352 38,272 38,178 C38,90 82,28 150,28 Z'

const EGGS = {
  // Level 1: Pristine egg
  1: {
    gradient: 'url(#eg1)',
    cracks: [] as string[],
    highlight: true,
  },
  // Level 2: Hairline cracks
  2: {
    gradient: 'url(#eg2)',
    cracks: [
      '148,75 140,94 153,106 145,124 150,134',
      '145,124 135,128 130,140',
      '180,175 172,185 180,196 168,210',
      '110,230 118,245 108,258',
    ],
    highlight: true,
  },
  // Level 3: Deep cracks
  3: {
    gradient: 'url(#eg3)',
    cracks: [
      '148,72 136,98 152,114 140,138 148,155 138,172',
      '152,114 168,120 178,135 168,152 178,165',
      '140,138 124,142 114,156 122,172 110,186',
      '195,220 208,235 196,250 205,265',
      '98,265 108,280 96,295',
      '168,290 178,308 165,320',
    ],
    highlight: false,
  },
  // Level 4: Shattered
  4: {
    gradient: null,
    shattered: true,
  },
}

export function EggClassicTheme({ noiseLevel, threshold, isTooLoud }: ThemeProps) {
  // Calculate level (1-4)
  const getLevel = () => {
    if (isTooLoud) return 4
    const ratio = noiseLevel / threshold
    if (ratio < 0.5) return 1
    if (ratio < 0.8) return 2
    return 3
  }

  const level = getLevel()
  const egg = EGGS[level as keyof typeof EGGS]

  return (
    <div className="relative flex flex-col items-center justify-center">
      {/* Floating egg container */}
      <div className="animate-float">
        <svg
          width="300"
          height="400"
          viewBox="0 0 300 400"
          className="drop-shadow-2xl"
        >
          <defs>
            {/* Gradients */}
            <radialGradient id="eg1" cx="38%" cy="28%" r="68%">
              <stop offset="0%" stopColor="#FFFEF6"/>
              <stop offset="55%" stopColor="#F4E9CC"/>
              <stop offset="100%" stopColor="#D8BE8A"/>
            </radialGradient>
            <radialGradient id="eg2" cx="38%" cy="28%" r="68%">
              <stop offset="0%" stopColor="#FBF6E8"/>
              <stop offset="55%" stopColor="#EEE0BB"/>
              <stop offset="100%" stopColor="#C8AA6A"/>
            </radialGradient>
            <radialGradient id="eg3" cx="38%" cy="28%" r="68%">
              <stop offset="0%" stopColor="#F0E8D0"/>
              <stop offset="45%" stopColor="#DCC882"/>
              <stop offset="100%" stopColor="#B89040"/>
            </radialGradient>
            <radialGradient id="gyolk" cx="50%" cy="45%" r="55%">
              <stop offset="0%" stopColor="#FFE55A"/>
              <stop offset="70%" stopColor="#FFA800"/>
              <stop offset="100%" stopColor="#D47000"/>
            </radialGradient>
            <filter id="shadow" x="-20%" y="-10%" width="140%" height="130%">
              <feDropShadow dx="0" dy="18" stdDeviation="18" floodColor="#000" floodOpacity="0.28"/>
            </filter>
          </defs>

          {/* Shadow */}
          <ellipse cx="150" cy="360" rx="80" ry="20" fill="rgba(0,0,0,0.2)" />

          {level === 4 ? (
            // Shattered egg
            <>
              {/* Egg white */}
              <ellipse cx="150" cy="250" rx="88" ry="40" fill="rgba(255,252,235,0.92)"/>
              <ellipse cx="120" cy="262" rx="30" ry="16" fill="rgba(255,252,235,0.80)"/>
              <ellipse cx="185" cy="258" rx="24" ry="13" fill="rgba(255,252,235,0.75)"/>

              {/* Yolk */}
              <circle cx="150" cy="240" r="36" fill="url(#gyolk)" filter="url(#shadow)"/>
              <circle cx="140" cy="230" r="10" fill="rgba(255,255,255,0.28)"/>

              {/* Shell fragments */}
              <path d="M108,30 L155,22 L200,50 L185,105 L148,98 L118,88 Z" fill="#D8C080" stroke="#8B6010" transform="translate(-12,-22) rotate(8,155,65)"/>
              <path d="M44,110 L90,88 L115,122 L100,168 L62,158 Z" fill="#C8B060" stroke="#7A5010" transform="translate(-28,5) rotate(-14,80,130)"/>
              <path d="M192,85 L248,98 L260,148 L225,162 L200,138 Z" fill="#D8C080" stroke="#8B6010" transform="translate(22,-8) rotate(16,228,130)"/>
            </>
          ) : (
            // Intact egg with cracks
            <>
              <path d={EGG_PATH} fill={egg.gradient || 'url(#eg1)'} filter="url(#shadow)" />

              {/* Cracks */}
              {'cracks' in egg && egg.cracks.map((crack, i) => (
                <polyline
                  key={i}
                  points={crack}
                  fill="none"
                  stroke="#8B6010"
                  strokeWidth={1 + i * 0.3}
                  strokeLinecap="round"
                />
              ))}

              {/* Highlight */}
              {'highlight' in egg && egg.highlight && (
                <ellipse cx="112" cy="118" rx="30" ry="44" fill="rgba(255,255,255,0.42)" transform="rotate(-22,112,118)"/>
              )}
            </>
          )}
        </svg>
      </div>

      {/* Level dots - 4 colored dots showing current level */}
      <div className="flex gap-3 sm:gap-4 mt-4 sm:mt-6">
        {[1, 2, 3, 4].map((l) => (
          <div
            key={l}
            className={`w-3 h-3 sm:w-4 sm:h-4 rounded-full transition-all duration-300 ${
              l <= level
                ? l === 4
                  ? 'bg-red-500 scale-125'
                  : l === 3
                  ? 'bg-orange-500 scale-110'
                  : l === 2
                  ? 'bg-yellow-500'
                  : 'bg-green-500'
                : 'bg-white/20'
            }`}
          />
        ))}
      </div>
    </div>
  )
}

export default EggClassicTheme
