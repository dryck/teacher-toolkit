import React from 'react';
import { NewThemeProps } from '../types';

/**
 * Thermometer Theme
 * Visualizes noise level as rising temperature
 * Level 1 (Quiet): Cool blue, low mercury
 * Level 2 (Moderate): Green, rising mercury  
 * Level 3 (Loud): Orange, high mercury, sweating
 * Level 4 (Too Loud): Red, max mercury, boiling/steam
 */

export const ThermometerTheme: React.FC<NewThemeProps> = ({ level }) => {
  const getMercuryHeight = () => {
    switch (level) {
      case 'quiet': return '20%';
      case 'moderate': return '45%';
      case 'loud': return '70%';
      case 'tooLoud': return '95%';
      default: return '20%';
    }
  };

  const getMercuryColor = () => {
    switch (level) {
      case 'quiet': return '#3B82F6'; // Blue
      case 'moderate': return '#22C55E'; // Green
      case 'loud': return '#F97316'; // Orange
      case 'tooLoud': return '#EF4444'; // Red
      default: return '#3B82F6';
    }
  };

  const getBgGradient = () => {
    switch (level) {
      case 'quiet': return 'from-blue-50 to-blue-100';
      case 'moderate': return 'from-green-50 to-green-100';
      case 'loud': return 'from-orange-50 to-orange-100';
      case 'tooLoud': return 'from-red-50 to-red-100';
      default: return 'from-blue-50 to-blue-100';
    }
  };

  const getFaceExpression = () => {
    switch (level) {
      case 'quiet': return { eyes: '○ ○', mouth: '︶', sweat: false };
      case 'moderate': return { eyes: '◕ ◕', mouth: '‿', sweat: false };
      case 'loud': return { eyes: '◑ ◑', mouth: '︵', sweat: true };
      case 'tooLoud': return { eyes: '✕ ✕', mouth: '︵', sweat: true };
      default: return { eyes: '○ ○', mouth: '︶', sweat: false };
    }
  };

  const face = getFaceExpression();
  const mercuryColor = getMercuryColor();
  const mercuryHeight = getMercuryHeight();
  void mercuryHeight; // Suppress unused warning

  return (
    <div className={`w-full h-full flex items-center justify-center bg-gradient-to-br ${getBgGradient()} transition-all duration-500`}>
      <div className="relative">
        {/* Steam particles for too loud */}
        {level === 'tooLoud' && (
          <>
            <div className="absolute -top-8 left-1/2 -translate-x-1/2 animate-ping">
              <svg width="40" height="30" viewBox="0 0 40 30" className="opacity-60">
                <path d="M10 25 Q15 15 10 5" stroke="#EF4444" strokeWidth="2" fill="none" opacity="0.6">
                  <animate attributeName="d" values="M10 25 Q15 15 10 5;M10 20 Q5 10 10 0;M10 25 Q15 15 10 5" dur="2s" repeatCount="indefinite"/>
                </path>
                <path d="M20 25 Q25 15 20 5" stroke="#EF4444" strokeWidth="2" fill="none" opacity="0.8">
                  <animate attributeName="d" values="M20 25 Q25 15 20 5;M20 20 Q15 10 20 0;M20 25 Q25 15 20 5" dur="2s" begin="0.3s" repeatCount="indefinite"/>
                </path>
                <path d="M30 25 Q35 15 30 5" stroke="#EF4444" strokeWidth="2" fill="none" opacity="0.6">
                  <animate attributeName="d" values="M30 25 Q35 15 30 5;M30 20 Q25 10 30 0;M30 25 Q35 15 30 5" dur="2s" begin="0.6s" repeatCount="indefinite"/>
                </path>
              </svg>
            </div>
          </>
        )}

        {/* Thermometer bulb with face */}
        <div className="relative">
          <svg width="120" height="320" viewBox="0 0 120 320" className="drop-shadow-xl">
            {/* Thermometer tube background */}
            <rect x="45" y="20" width="30" height="220" rx="15" fill="#E5E7EB" stroke="#9CA3AF" strokeWidth="2"/>
            
            {/* Mercury column */}
            <rect 
              x="50" 
              y="240" 
              width="20" 
              height="0" 
              rx="10" 
              fill={mercuryColor}
              className="transition-all duration-700 ease-out"
            >
              <animate 
                attributeName="y" 
                from="240" 
                to={level === 'quiet' ? '216' : level === 'moderate' ? '132' : level === 'loud' ? '66' : '30'}
                dur="0.7s" 
                fill="freeze"
                calcMode="spline"
                keySplines="0.4 0 0.2 1"
              />
              <animate 
                attributeName="height" 
                from="0" 
                to={level === 'quiet' ? '24' : level === 'moderate' ? '108' : level === 'loud' ? '174' : '210'}
                dur="0.7s" 
                fill="freeze"
                calcMode="spline"
                keySplines="0.4 0 0.2 1"
              />
            </rect>

            {/* Tick marks */}
            {[0, 1, 2, 3, 4].map((i) => (
              <line 
                key={i}
                x1="75" 
                y1={40 + i * 50} 
                x2="85" 
                y2={40 + i * 50} 
                stroke="#6B7280" 
                strokeWidth="2"
              />
            ))}

            {/* Bulb */}
            <circle cx="60" cy="270" r="35" fill={mercuryColor} className="transition-colors duration-500"/>
            <circle cx="60" cy="270" r="35" fill="url(#bulbShine)" opacity="0.3"/>
            
            {/* Face on bulb */}
            <text x="60" y="265" textAnchor="middle" fontSize="16" fill="white" fontFamily="Arial" fontWeight="bold">
              {face.eyes}
            </text>
            <text x="60" y="285" textAnchor="middle" fontSize="14" fill="white" fontFamily="Arial">
              {face.mouth}
            </text>

            {/* Sweat drops */}
            {face.sweat && (
              <>
                <circle cx="95" cy="260" r="4" fill="#60A5FA">
                  <animate attributeName="cy" values="260;280;260" dur="1.5s" repeatCount="indefinite"/>
                  <animate attributeName="opacity" values="1;0;1" dur="1.5s" repeatCount="indefinite"/>
                </circle>
                <circle cx="25" cy="250" r="3" fill="#60A5FA">
                  <animate attributeName="cy" values="250;275;250" dur="1.2s" begin="0.3s" repeatCount="indefinite"/>
                  <animate attributeName="opacity" values="1;0;1" dur="1.2s" begin="0.3s" repeatCount="indefinite"/>
                </circle>
              </>
            )}

            {/* Gradients */}
            <defs>
              <radialGradient id="bulbShine" cx="30%" cy="30%">
                <stop offset="0%" stopColor="white" stopOpacity="0.8"/>
                <stop offset="100%" stopColor="white" stopOpacity="0"/>
              </radialGradient>
            </defs>
          </svg>
        </div>

        {/* 4 Colored dots indicator - BELOW the thermometer */}
        <div className="flex items-center justify-center gap-3 mt-6">
          {[0, 1, 2, 3].map((dotIndex) => {
            const levelIndex = level === 'quiet' ? 0 : level === 'moderate' ? 1 : level === 'loud' ? 2 : 3;
            const dotColors = ['#3B82F6', '#22C55E', '#F97316', '#EF4444']; // Blue, Green, Orange, Red
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

export default ThermometerTheme;
