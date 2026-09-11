import React from 'react';
import { NewThemeProps } from '../types';

/**
 * Weather Theme
 * Visualizes noise level as weather progression
 * Level 1 (Quiet): Sunny, blue sky, happy sun
 * Level 2 (Moderate): Partly cloudy, gentle breeze
 * Level 3 (Loud): Dark clouds, rain, wind
 * Level 4 (Too Loud): Thunderstorm, lightning, angry clouds
 */

export const WeatherTheme: React.FC<NewThemeProps> = ({ level }) => {
  const getSkyGradient = () => {
    switch (level) {
      case 'quiet': return { from: '#60A5FA', to: '#BFDBFE' }; // Blue sky
      case 'moderate': return { from: '#93C5FD', to: '#E0E7FF' }; // Light clouds
      case 'loud': return { from: '#6B7280', to: '#9CA3AF' }; // Gray
      case 'tooLoud': return { from: '#1F2937', to: '#374151' }; // Dark storm
      default: return { from: '#60A5FA', to: '#BFDBFE' };
    }
  };

  const sky = getSkyGradient();

  return (
    <div 
      className="w-full h-full flex items-center justify-center transition-all duration-700 relative overflow-hidden"
      style={{ background: `linear-gradient(to bottom, ${sky.from}, ${sky.to})` }}
    >
      {/* Sun - visible in quiet and moderate */}
      {(level === 'quiet' || level === 'moderate') && (
        <div className={`absolute transition-all duration-700 ${
          level === 'quiet' ? 'top-8 right-8' : 'top-12 right-16 opacity-70'
        }`}>
          <svg width="100" height="100" viewBox="0 0 100 100">
            {/* Sun rays */}
            {[...Array(8)].map((_, i) => (
              <line
                key={i}
                x1="50"
                y1="50"
                x2={50 + 45 * Math.cos((i * 45 * Math.PI) / 180)}
                y2={50 + 45 * Math.sin((i * 45 * Math.PI) / 180)}
                stroke="#FCD34D"
                strokeWidth="4"
                strokeLinecap="round"
              >
                <animate
                  attributeName="x2"
                  values={`${50 + 40 * Math.cos((i * 45 * Math.PI) / 180)};${50 + 48 * Math.cos((i * 45 * Math.PI) / 180)};${50 + 40 * Math.cos((i * 45 * Math.PI) / 180)}`}
                  dur="2s"
                  repeatCount="indefinite"
                />
                <animate
                  attributeName="y2"
                  values={`${50 + 40 * Math.sin((i * 45 * Math.PI) / 180)};${50 + 48 * Math.sin((i * 45 * Math.PI) / 180)};${50 + 40 * Math.sin((i * 45 * Math.PI) / 180)}`}
                  dur="2s"
                  repeatCount="indefinite"
                />
              </line>
            ))}
            {/* Sun body */}
            <circle cx="50" cy="50" r="25" fill="#FBBF24"/>
            {/* Sun face */}
            <circle cx="42" cy="45" r="3" fill="#92400E"/>
            <circle cx="58" cy="45" r="3" fill="#92400E"/>
            <path d="M42 58 Q50 65 58 58" stroke="#92400E" strokeWidth="2" fill="none"/>
          </svg>
        </div>
      )}

      {/* Clouds */}
      <div className="absolute inset-0 pointer-events-none">
        {/* Small cloud - always visible */}
        <div className={`absolute transition-all duration-700 ${
          level === 'quiet' ? 'top-20 left-10 opacity-40' :
          level === 'moderate' ? 'top-16 left-8 opacity-70' :
          level === 'loud' ? 'top-12 left-6 opacity-90' :
          'top-8 left-4 opacity-100'
        }`}>
          <svg width="120" height="70" viewBox="0 0 120 70">
            <path 
              d="M20 50 Q10 50 10 40 Q10 25 25 25 Q30 10 50 10 Q70 10 75 25 Q90 25 95 40 Q100 50 90 50 Z" 
              fill={level === 'tooLoud' ? '#4B5563' : level === 'loud' ? '#6B7280' : '#F3F4F6'}
              className="transition-colors duration-500"
            />
          </svg>
        </div>

        {/* Main cloud - center */}
        <div className={`absolute left-1/2 -translate-x-1/2 transition-all duration-700 ${
          level === 'quiet' ? 'top-32 opacity-20' :
          level === 'moderate' ? 'top-28 opacity-60' :
          level === 'loud' ? 'top-20 opacity-90' :
          'top-16 opacity-100'
        }`}>
          <svg width="200" height="120" viewBox="0 0 200 120">
            <path 
              d="M40 90 Q20 90 20 70 Q20 45 45 45 Q55 20 85 15 Q115 10 130 35 Q155 35 165 55 Q180 75 170 90 Q160 100 140 100 H50 Q40 100 40 90 Z" 
              fill={level === 'tooLoud' ? '#374151' : level === 'loud' ? '#4B5563' : '#E5E7EB'}
              className="transition-colors duration-500"
            />
            {/* Cloud face for loud/tooLoud */}
            {(level === 'loud' || level === 'tooLoud') && (
              <g>
                <circle cx="80" cy="60" r="5" fill={level === 'tooLoud' ? '#EF4444' : '#F59E0B'}/>
                <circle cx="120" cy="60" r="5" fill={level === 'tooLoud' ? '#EF4444' : '#F59E0B'}/>
                <path 
                  d={level === 'tooLoud' ? "M85 80 Q100 70 115 80" : "M85 75 Q100 85 115 75"} 
                  stroke={level === 'tooLoud' ? '#EF4444' : '#F59E0B'} 
                  strokeWidth="3" 
                  fill="none"
                />
              </g>
            )}
          </svg>
        </div>

        {/* Storm cloud for loud/tooLoud */}
        {(level === 'loud' || level === 'tooLoud') && (
          <div className="absolute top-8 right-8">
            <svg width="150" height="100" viewBox="0 0 150 100">
              <path 
                d="M30 75 Q15 75 15 60 Q15 40 35 40 Q45 20 70 15 Q95 10 110 30 Q130 30 138 45 Q145 60 135 75 Q125 85 105 85 H40 Q30 85 30 75 Z" 
                fill={level === 'tooLoud' ? '#1F2937' : '#4B5563'}
              >
                <animate 
                  attributeName="d" 
                  values="M30 75 Q15 75 15 60 Q15 40 35 40 Q45 20 70 15 Q95 10 110 30 Q130 30 138 45 Q145 60 135 75 Q125 85 105 85 H40 Q30 85 30 75 Z;M32 73 Q17 73 17 58 Q17 38 37 38 Q47 18 72 13 Q97 8 112 28 Q132 28 140 43 Q147 58 137 73 Q127 83 107 83 H42 Q32 83 32 73 Z;M30 75 Q15 75 15 60 Q15 40 35 40 Q45 20 70 15 Q95 10 110 30 Q130 30 138 45 Q145 60 135 75 Q125 85 105 85 H40 Q30 85 30 75 Z"
                  dur="3s"
                  repeatCount="indefinite"
                />
              </path>
            </svg>
          </div>
        )}
      </div>

      {/* Rain for loud */}
      {level === 'loud' && (
        <div className="absolute inset-0 pointer-events-none">
          {[...Array(12)].map((_, i) => (
            <div
              key={i}
              className="absolute"
              style={{
                left: `${15 + (i * 7)}%`,
                animation: `rain 0.8s linear ${i * 0.1}s infinite`
              }}
            >
              <svg width="4" height="15" viewBox="0 0 4 15">
                <line x1="2" y1="0" x2="2" y2="15" stroke="#60A5FA" strokeWidth="2" strokeLinecap="round"/>
              </svg>
            </div>
          ))}
          <style>{`
            @keyframes rain {
              0% { transform: translateY(-20px); opacity: 0; }
              10% { opacity: 1; }
              90% { opacity: 1; }
              100% { transform: translateY(400px); opacity: 0; }
            }
          `}</style>
        </div>
      )}

      {/* Lightning and heavy rain for tooLoud */}
      {level === 'tooLoud' && (
        <>
          {/* Lightning */}
          <div className="absolute inset-0 pointer-events-none">
            <svg width="100%" height="100%" className="absolute inset-0">
              <path 
                d="M100 20 L80 80 L100 80 L70 150" 
                stroke="#FCD34D" 
                strokeWidth="4" 
                fill="none"
                opacity="0"
              >
                <animate 
                  attributeName="opacity" 
                  values="0;1;0;0;1;0;0" 
                  dur="2s" 
                  repeatCount="indefinite"
                />
              </path>
              <path 
                d="M180 30 L160 70 L175 70 L150 120" 
                stroke="#FCD34D" 
                strokeWidth="3" 
                fill="none"
                opacity="0"
              >
                <animate 
                  attributeName="opacity" 
                  values="0;0;0;1;0;1;0" 
                  dur="2s" 
                  begin="0.5s"
                  repeatCount="indefinite"
                />
              </path>
            </svg>
            {/* Flash effect */}
            <div className="absolute inset-0 bg-yellow-200 opacity-0 animate-pulse" style={{ animationDuration: '2s' }}/>
          </div>

          {/* Heavy rain */}
          <div className="absolute inset-0 pointer-events-none">
            {[...Array(20)].map((_, i) => (
              <div
                key={i}
                className="absolute"
                style={{
                  left: `${5 + (i * 5)}%`,
                  animation: `heavyrain 0.5s linear ${i * 0.05}s infinite`
                }}
              >
                <svg width="3" height="20" viewBox="0 0 3 20">
                  <line x1="1.5" y1="0" x2="1.5" y2="20" stroke="#3B82F6" strokeWidth="2" strokeLinecap="round"/>
                </svg>
              </div>
            ))}
            <style>{`
              @keyframes heavyrain {
                0% { transform: translateY(-20px); opacity: 0; }
                10% { opacity: 1; }
                90% { opacity: 1; }
                100% { transform: translateY(400px); opacity: 0; }
              }
            `}</style>
          </div>
        </>
      )}

      {/* Ground/landscape */}
      <div className="absolute bottom-0 left-0 right-0 h-24">
        <svg width="100%" height="100%" preserveAspectRatio="none" viewBox="0 0 400 100">
          <path 
            d="M0 100 L0 60 Q100 40 200 55 Q300 70 400 50 L400 100 Z" 
            fill={level === 'tooLoud' ? '#1F2937' : level === 'loud' ? '#374151' : '#22C55E'}
            className="transition-colors duration-500"
          />
        </svg>
      </div>



      {/* Wind lines for moderate+ */}
      {level !== 'quiet' && (
        <div className="absolute top-1/2 left-0 right-0 pointer-events-none">
          {[...Array(3)].map((_, i) => (
            <div
              key={i}
              className="absolute h-0.5 bg-white opacity-30"
              style={{
                width: '60px',
                top: `${i * 30}px`,
                animation: `wind 2s linear ${i * 0.3}s infinite`
              }}
            />
          ))}
          <style>{`
            @keyframes wind {
              0% { transform: translateX(-100px); opacity: 0; }
              50% { opacity: 0.3; }
              100% { transform: translateX(400px); opacity: 0; }
            }
          `}</style>
        </div>
      )}

      {/* 4 Colored dots indicator - at bottom */}
      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-20">
        <div className="flex items-center gap-3 px-4 py-2 bg-black/30 backdrop-blur-sm rounded-full">
          {[0, 1, 2, 3].map((dotIndex) => {
            const levelIndex = level === 'quiet' ? 0 : level === 'moderate' ? 1 : level === 'loud' ? 2 : 3;
            const dotColors = ['#10B981', '#F59E0B', '#F97316', '#EF4444']; // Green, Yellow, Orange, Red
            const isActive = dotIndex <= levelIndex;
            return (
              <div
                key={dotIndex}
                className={`w-4 h-4 rounded-full transition-all duration-300 ${
                  isActive ? 'scale-100 opacity-100' : 'scale-75 opacity-30'
                }`}
                style={{
                  backgroundColor: dotColors[dotIndex],
                  boxShadow: isActive ? `0 0 8px ${dotColors[dotIndex]}` : 'none'
                }}
              />
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default WeatherTheme;
