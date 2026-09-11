import React from 'react';
import { NewThemeProps } from '../types';

export const BatteryTheme: React.FC<NewThemeProps> = ({ level }) => {
  const getBatteryLevel = () => {
    switch (level) {
      case 'quiet': return 100;
      case 'moderate': return 70;
      case 'loud': return 35;
      case 'tooLoud': return 10;
      default: return 100;
    }
  };

  const getBatteryColor = () => {
    switch (level) {
      case 'quiet': return '#22C55E';
      case 'moderate': return '#84CC16';
      case 'loud': return '#F97316';
      case 'tooLoud': return '#EF4444';
      default: return '#22C55E';
    }
  };

  const getFaceExpression = () => {
    switch (level) {
      case 'quiet': return { eyes: '^ ^', mouth: 'ᴗ', blush: true };
      case 'moderate': return { eyes: '◠ ◠', mouth: '‿', blush: false };
      case 'loud': return { eyes: '◯ ◯', mouth: 'ω', blush: false };
      case 'tooLoud': return { eyes: '> <', mouth: '︵', blush: false };
      default: return { eyes: '^ ^', mouth: 'ᴗ', blush: true };
    }
  };

  const batteryLevel = getBatteryLevel();
  const batteryColor = getBatteryColor();
  const face = getFaceExpression();

  const fillHeight = 170 * (batteryLevel / 100);
  const fillY = 55 + (170 - fillHeight);

  return (
    <div className={`w-full h-full flex flex-col items-center justify-center transition-all duration-500 ${
      level === 'quiet' ? 'bg-gradient-to-br from-green-50 to-emerald-100' :
      level === 'moderate' ? 'bg-gradient-to-br from-lime-50 to-yellow-100' :
      level === 'loud' ? 'bg-gradient-to-br from-orange-50 to-amber-100' :
      'bg-gradient-to-br from-red-50 to-rose-100'
    }`}>
      <div className="relative w-full max-w-[280px] px-4 flex flex-col items-center">
        {/* Sparks for too loud */}
        {level === 'tooLoud' && (
          <div className="absolute inset-0 pointer-events-none">
            {[...Array(6)].map((_, i) => (
              <div
                key={i}
                className="absolute animate-ping"
                style={{
                  left: `${20 + (i * 12)}%`,
                  top: `${20 + (i % 3) * 20}%`,
                  animationDelay: `${i * 0.15}s`,
                  animationDuration: '0.8s'
                }}
              >
                <svg width="20" height="20" viewBox="0 0 20 20">
                  <path d="M10 0 L12 8 L20 10 L12 12 L10 20 L8 12 L0 10 L8 8 Z" fill="#FCD34D"/>
                </svg>
              </div>
            ))}
          </div>
        )}

        {/* Main battery - responsive */}
        <svg viewBox="0 0 200 280" className="w-full h-auto max-h-[320px] drop-shadow-2xl">
          {/* Battery body */}
          <rect x="20" y="40" width="160" height="200" rx="20" fill="#374151" stroke="#1F2937" strokeWidth="4"/>
          
          {/* Battery positive terminal */}
          <rect x="70" y="20" width="60" height="25" rx="5" fill="#374151"/>
          
          {/* Battery fill background */}
          <rect x="35" y="55" width="130" height="170" rx="12" fill="#1F2937"/>
          
          {/* Battery fill - NO animation on rect itself */}
          <rect 
            x="35" 
            y={fillY}
            width="130" 
            height={fillHeight}
            rx="12" 
            fill={batteryColor}
            className="transition-all duration-700"
          />

          {/* Pulse overlay for animation - stays within bounds */}
          <rect 
            x="35" 
            y={fillY}
            width="130" 
            height={fillHeight}
            rx="12" 
            fill={batteryColor}
            opacity="0.3"
            className={level === 'tooLoud' ? 'animate-pulse' : ''}
          />

          {/* Face */}
          <g transform="translate(100, 140)">
            <text x="0" y="-10" textAnchor="middle" fontSize="28" fill="white" fontFamily="Arial" fontWeight="bold">
              {face.eyes}
            </text>
            <text x="0" y="25" textAnchor="middle" fontSize="24" fill="white" fontFamily="Arial">
              {face.mouth}
            </text>
            {face.blush && (
              <>
                <circle cx="-35" cy="0" r="8" fill="#F472B6" opacity="0.6"/>
                <circle cx="35" cy="0" r="8" fill="#F472B6" opacity="0.6"/>
              </>
            )}
          </g>

          {/* Lightning bolt */}
          {(level === 'quiet' || level === 'moderate') && (
            <g transform="translate(100, 220)" opacity="0.8" className="animate-pulse">
              <path d="M-8 -15 L2 -5 L-5 -5 L8 15 L-2 5 L5 5 Z" fill="#FCD34D"/>
            </g>
          )}

          {/* Cracks for tooLoud */}
          {level === 'tooLoud' && (
            <>
              <path d="M30 60 L45 80 L35 95" stroke="#EF4444" strokeWidth="2" fill="none" opacity="0.7">
                <animate attributeName="opacity" values="0.7;1;0.7" dur="0.5s" repeatCount="indefinite"/>
              </path>
              <path d="M170 220 L155 200 L165 185" stroke="#EF4444" strokeWidth="2" fill="none" opacity="0.7">
                <animate attributeName="opacity" values="0.7;1;0.7" dur="0.5s" begin="0.2s" repeatCount="indefinite"/>
              </path>
            </>
          )}

          {/* Shine effect */}
          <rect x="40" y="60" width="20" height="120" rx="8" fill="white" opacity="0.1"/>
        </svg>

        {/* 4 Colored dots indicator - BELOW the battery */}
        <div className="flex items-center justify-center gap-3 mt-4">
          {[0, 1, 2, 3].map((dotIndex) => {
            const levelIndex = level === 'quiet' ? 0 : level === 'moderate' ? 1 : level === 'loud' ? 2 : 3;
            const dotColors = ['#22C55E', '#84CC16', '#F97316', '#EF4444'];
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

export default BatteryTheme;
