import { ThemeProps, NoiseBand } from '../types'

// A teacher's own pictures, shown one per band. Which picture, how many dots
// and what colour were three separate ratio ladders over the alarm point
// (0.5/1, then 0.25/0.5/0.75, then 0.5/0.75) -- so a teacher could move the
// "loud" slider and watch nothing change here.
const BAND_IMAGE: Record<NoiseBand, number> = {
  quiet: 0,
  moderate: 1,
  loud: 1,
  tooLoud: 2
}
const BAND_DOTS: Record<NoiseBand, number> = {
  quiet: 1,
  moderate: 2,
  loud: 3,
  tooLoud: 4
}
const BAND_COLOR: Record<NoiseBand, string> = {
  quiet: '#10B981',
  moderate: '#3B82F6',
  loud: '#F59E0B',
  tooLoud: '#EF4444'
}

export function CustomTheme({ band, isTooLoud, customImages }: ThemeProps) {
  const getImageIndex = () => {
    if (customImages.length === 0) return -1
    return Math.min(BAND_IMAGE[band], customImages.length - 1)
  }

  const imageIndex = getImageIndex()
  const currentImage = imageIndex >= 0 ? customImages[imageIndex] : null

  const scale = 1 + (isTooLoud ? 0.05 : 0)
  const activeDots = BAND_DOTS[band]

  const getDotColor = (index: number) => {
    if (index >= activeDots) return '#E5E7EB' // gray-200 for inactive
    return isTooLoud ? '#EF4444' : BAND_COLOR[band]
  }

  if (!currentImage) {
    return (
      <div className="flex flex-col items-center justify-center text-center p-8">
        <div className="w-32 h-32 rounded-full bg-gray-200 flex items-center justify-center mb-4">
          <svg className="w-16 h-16 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
        </div>
        <h3 className="text-xl font-semibold text-gray-700 mb-2">No Custom Images</h3>
        <p className="text-gray-500">Upload images in settings to use this theme</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col items-center justify-center w-full max-w-[375px] mx-auto px-4">
      {/* Image container with effects */}
      <div
        className={`relative transition-transform duration-100 w-full ${isTooLoud ? 'animate-shake' : ''}`}
        style={{
          transform: `scale(${scale})`,
        }}
      >
        {/* Main image - responsive sizing for mobile */}
        <div className="relative w-full aspect-square max-w-[280px] mx-auto rounded-3xl overflow-hidden shadow-2xl">
          <img
            src={currentImage.url}
            alt={currentImage.name}
            className="w-full h-full object-cover transition-all duration-300"
            style={{
              filter: isTooLoud ? 'hue-rotate(-30deg) saturate(1.5)' : 'none',
            }}
          />
          
          {/* Overlay effects */}
          <div 
            className="absolute inset-0 transition-opacity duration-200"
            style={{
              background: isTooLoud 
                ? 'radial-gradient(circle, transparent 30%, rgba(239, 68, 68, 0.4) 100%)'
                : `radial-gradient(circle, transparent 30%, ${band === 'loud' || band === 'tooLoud' ? 'rgba(245, 158, 11, 0.2)' : 'rgba(16, 185, 129, 0.2)'} 100%)`,
            }}
          />
        </div>
        
        {/* Glow effect when too loud */}
        {isTooLoud && (
          <div className="absolute inset-0 rounded-3xl animate-pulse bg-red-500 opacity-30 blur-xl -z-10" />
        )}
      </div>
      
      {/* 4 Colored dots indicator - BELOW the image */}
      <div className="mt-6 flex items-center justify-center gap-3">
        {[0, 1, 2, 3].map((index) => (
          <div
            key={index}
            className="w-4 h-4 rounded-full transition-all duration-300"
            style={{
              backgroundColor: getDotColor(index),
              transform: index < activeDots ? 'scale(1)' : 'scale(0.8)',
              opacity: index < activeDots ? 1 : 0.5,
            }}
          />
        ))}
      </div>
    </div>
  )
}
