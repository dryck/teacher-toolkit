import { ThemeProps, NoiseBand } from '../types'

const BAND_COLOR: Record<NoiseBand, string> = {
  quiet: '#10B981',
  moderate: '#10B981',
  loud: '#F59E0B',
  tooLoud: '#EF4444'
}

/** Band to the 1-4 stage these illustrations are numbered by. */
const BAND_STAGE: Record<NoiseBand, 1 | 2 | 3 | 4> = {
  quiet: 1,
  moderate: 2,
  loud: 3,
  tooLoud: 4
}

export function EggTheme({ band, intensity, isTooLoud, backgroundColor: _bg }: ThemeProps) {
  // The wobble stays continuous; only which stage and colour to show comes
  // from the band. Both used to be re-derived here from ratios of the alarm
  // point, so the egg ignored three of the teacher's four bounds.
  const wobble = Math.min(intensity, 1.5)
  const scale = 1 + (wobble * 0.1)
  const level = BAND_STAGE[band]
  const getColor = () => BAND_COLOR[band]

  return (
    <div className="flex flex-col items-center justify-center gap-4">
      {/* Egg container */}
      <div
        className={`transition-transform duration-100 ${isTooLoud ? 'animate-shake' : ''}`}
        style={{
          transform: `scale(${scale})`,
        }}
      >
        <svg
          width="280"
          height="320"
          viewBox="0 0 300 400"
          className="drop-shadow-2xl"
        >
          {/* Egg shadow */}
          <ellipse
            cx="150"
            cy="360"
            rx="80"
            ry="20"
            fill="rgba(0,0,0,0.2)"
          />
          
          {/* Egg body */}
          <path
            d="M150 50 C 220 50, 260 150, 260 220 C 260 310, 210 350, 150 350 C 90 350, 40 310, 40 220 C 40 150, 80 50, 150 50 Z"
            fill="#FFFEF0"
            stroke="#E5E4D8"
            strokeWidth="3"
          />
          
          {/* Egg highlight */}
          <ellipse
            cx="110"
            cy="120"
            rx="30"
            ry="50"
            fill="rgba(255,255,255,0.6)"
            transform="rotate(-20 110 120)"
          />
          
          {/* Face - Eyes */}
          <g className={isTooLoud ? 'animate-bounce' : ''}>
            {/* Left eye */}
            <circle cx="110" cy="200" r="25" fill="white" stroke="#333" strokeWidth="2" />
            <circle 
              cx={110 + Math.min(wobble, 1) * 5} 
              cy={200 + Math.min(wobble, 1) * 2} 
              r="12" 
              fill="#333" 
            />
            <circle cx="114" cy="196" r="4" fill="white" />
            
            {/* Right eye */}
            <circle cx="190" cy="200" r="25" fill="white" stroke="#333" strokeWidth="2" />
            <circle 
              cx={190 + Math.min(wobble, 1) * 5} 
              cy={200 + Math.min(wobble, 1) * 2} 
              r="12" 
              fill="#333" 
            />
            <circle cx="194" cy="196" r="4" fill="white" />
          </g>
          
          {/* Mouth */}
          {isTooLoud ? (
            // Shocked mouth
            <ellipse cx="150" cy="260" rx="20" ry="30" fill="#333" />
          ) : band === 'loud' ? (
            // Worried mouth
            <path
              d="M 120 260 Q 150 240, 180 260"
              fill="none"
              stroke="#333"
              strokeWidth="4"
              strokeLinecap="round"
            />
          ) : (
            // Happy mouth
            <path
              d="M 120 250 Q 150 280, 180 250"
              fill="none"
              stroke="#333"
              strokeWidth="4"
              strokeLinecap="round"
            />
          )}
          
          {/* Cheeks */}
          <circle cx="80" cy="230" r="15" fill={getColor()} opacity="0.3" />
          <circle cx="220" cy="230" r="15" fill={getColor()} opacity="0.3" />
          
          {/* Sweat drops when too loud */}
          {isTooLoud && (
            <>
              <path
                d="M 240 150 Q 245 140, 250 150 Q 250 165, 240 165 Q 230 165, 240 150"
                fill="#60A5FA"
                className="animate-bounce"
                style={{ animationDelay: '0s' }}
              />
              <path
                d="M 60 170 Q 65 160, 70 170 Q 70 185, 60 185 Q 50 185, 60 170"
                fill="#60A5FA"
                className="animate-bounce"
                style={{ animationDelay: '0.2s' }}
              />
            </>
          )}
          

        </svg>
      </div>
      
      {/* Level dots - positioned below the egg */}
      <div className="flex gap-3 mt-6">
        {[1, 2, 3, 4].map((l) => (
          <div
            key={l}
            className={`w-4 h-4 rounded-full transition-all duration-300 ${
              l <= level 
                ? l === 4 ? 'bg-red-500 scale-125 shadow-lg shadow-red-500/50' 
                  : l === 3 ? 'bg-orange-500 scale-110' 
                  : l === 2 ? 'bg-yellow-500' 
                  : 'bg-green-500'
                : 'bg-gray-400/30'
            }`}
          />
        ))}
      </div>
    </div>
  )
}
