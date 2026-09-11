import { ThemeProps } from '../types'

export function GlassTheme({ noiseLevel, threshold, isTooLoud }: ThemeProps) {
  // Calculate fill level (0 to 100)
  const fillLevel = Math.min((noiseLevel / threshold) * 100, 100)
  
  // Determine active level (0-3) for the 4 dots
  const getActiveLevel = () => {
    const ratio = noiseLevel / threshold
    if (ratio < 0.25) return 0
    if (ratio < 0.5) return 1
    if (ratio < 0.75) return 2
    return 3
  }

  const activeLevel = getActiveLevel()
  
  // Colors for each dot level
  const dotColors = ['#10B981', '#10B981', '#F59E0B', '#EF4444'] // Green, Green, Yellow, Red
  const activeColor = isTooLoud ? '#EF4444' : dotColors[activeLevel]
  
  // Use static wave offset to prevent re-renders
  const waveOffset = 0

  return (
    <div className="relative flex flex-col items-center justify-center">
      <svg
        width="200"
        height="350"
        viewBox="0 0 200 350"
        className="drop-shadow-2xl"
      >
        {/* Glass shadow */}
        <ellipse
          cx="100"
          cy="330"
          rx="60"
          ry="12"
          fill="rgba(0,0,0,0.15)"
        />
        
        {/* Glass back */}
        <path
          d="M 40 20 L 50 300 Q 50 320, 100 320 Q 150 320, 150 300 L 160 20"
          fill="rgba(255,255,255,0.1)"
          stroke="rgba(200,200,200,0.5)"
          strokeWidth="2"
        />
        
        {/* Liquid fill with wave effect */}
        <defs>
          <clipPath id="glassClip">
            <path d="M 42 22 L 52 298 Q 52 318, 100 318 Q 148 318, 148 298 L 158 22 Z" />
          </clipPath>
          
          <linearGradient id="liquidGradient" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor={activeColor} stopOpacity="0.8" />
            <stop offset="100%" stopColor={activeColor} stopOpacity="1" />
          </linearGradient>
        </defs>
        
        {/* Liquid */}
        <g clipPath="url(#glassClip)">
          <rect
            x="40"
            y={320 - (fillLevel * 2.8)}
            width="120"
            height={fillLevel * 2.8}
            fill="url(#liquidGradient)"
            className="transition-all duration-200"
          />
          
          {/* Wave on top of liquid */}
          {fillLevel > 0 && (
            <path
              d={`M 40 ${320 - (fillLevel * 2.8)} 
                  Q 70 ${315 - (fillLevel * 2.8) + Math.sin(waveOffset * 0.1) * 5}, 
                  100 ${320 - (fillLevel * 2.8)} 
                  Q 130 ${325 - (fillLevel * 2.8) + Math.sin(waveOffset * 0.1) * 5}, 
                  160 ${320 - (fillLevel * 2.8)} 
                  L 160 320 L 40 320 Z`}
              fill={activeColor}
              opacity="0.9"
            />
          )}
          
          {/* Bubbles */}
          {fillLevel > 20 && (
            <>
              <circle cx="80" cy={300 - (fillLevel * 1.5)} r="4" fill="rgba(255,255,255,0.5)">
                <animate attributeName="cy" values={`${300 - (fillLevel * 1.5)};${280 - (fillLevel * 2)}`} dur="2s" repeatCount="indefinite" />
                <animate attributeName="opacity" values="0.5;0" dur="2s" repeatCount="indefinite" />
              </circle>
              <circle cx="120" cy={280 - (fillLevel * 1.2)} r="3" fill="rgba(255,255,255,0.4)">
                <animate attributeName="cy" values={`${280 - (fillLevel * 1.2)};${260 - (fillLevel * 1.8)}`} dur="1.5s" repeatCount="indefinite" />
                <animate attributeName="opacity" values="0.4;0" dur="1.5s" repeatCount="indefinite" />
              </circle>
              <circle cx="100" cy={310 - (fillLevel * 1.8)} r="5" fill="rgba(255,255,255,0.3)">
                <animate attributeName="cy" values={`${310 - (fillLevel * 1.8)};${290 - (fillLevel * 2.2)}`} dur="2.5s" repeatCount="indefinite" />
                <animate attributeName="opacity" values="0.3;0" dur="2.5s" repeatCount="indefinite" />
              </circle>
            </>
          )}
        </g>
        
        {/* Glass front (highlights) */}
        <path
          d="M 40 20 L 50 300 Q 50 320, 100 320 Q 150 320, 150 300 L 160 20"
          fill="none"
          stroke="rgba(255,255,255,0.6)"
          strokeWidth="3"
        />
        
        {/* Rim */}
        <ellipse
          cx="100"
          cy="20"
          rx="62"
          ry="12"
          fill="none"
          stroke="rgba(200,200,200,0.6)"
          strokeWidth="3"
        />
        
        {/* Highlight on left side */}
        <path
          d="M 55 40 L 62 280"
          stroke="rgba(255,255,255,0.5)"
          strokeWidth="6"
          strokeLinecap="round"
          fill="none"
        />
        
        {/* Highlight on right side */}
        <path
          d="M 145 40 L 138 280"
          stroke="rgba(255,255,255,0.3)"
          strokeWidth="4"
          strokeLinecap="round"
          fill="none"
        />
        
        {/* Measurement lines */}
        <line x1="120" y1="100" x2="140" y2="100" stroke="rgba(150,150,150,0.4)" strokeWidth="2" />
        <line x1="115" y1="150" x2="140" y2="150" stroke="rgba(150,150,150,0.4)" strokeWidth="2" />
        <line x1="120" y1="200" x2="140" y2="200" stroke="rgba(150,150,150,0.4)" strokeWidth="2" />
        <line x1="115" y1="250" x2="140" y2="250" stroke="rgba(150,150,150,0.4)" strokeWidth="2" />
        

      </svg>
      
      {/* 4 Colored dots below the glass - positioned below the SVG */}
      <div className="flex items-center justify-center gap-3 mt-4">
        {[0, 1, 2, 3].map((level) => (
          <div
            key={level}
            className={`w-4 h-4 rounded-full transition-all duration-200 ${
              level <= activeLevel ? 'scale-100 opacity-100' : 'scale-75 opacity-30'
            }`}
            style={{
              backgroundColor: dotColors[level],
              boxShadow: level <= activeLevel ? `0 0 8px ${dotColors[level]}` : 'none'
            }}
          />
        ))}
      </div>
    </div>
  )
}
