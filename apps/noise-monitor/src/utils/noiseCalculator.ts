/**
 * Calculate noise level from frequency data
 * Returns a normalized value between 0 and 100
 */
export function calculateNoiseLevel(frequencyData: Uint8Array): number {
  // Calculate RMS (root mean square) for volume
  let sum = 0
  for (let i = 0; i < frequencyData.length; i++) {
    sum += frequencyData[i] * frequencyData[i]
  }
  const rms = Math.sqrt(sum / frequencyData.length)
  
  // Convert to decibel-like scale (0-100)
  // RMS ranges from 0 to 255, normalize to 0-100
  const normalizedLevel = Math.min(Math.max((rms / 128) * 100, 0), 100)
  
  return normalizedLevel
}

/**
 * Convert linear amplitude to decibels
 */
export function amplitudeToDb(amplitude: number): number {
  if (amplitude <= 0) return -Infinity
  return 20 * Math.log10(amplitude / 255)
}

/**
 * Smooth noise level transitions using exponential moving average
 */
export function smoothNoiseLevel(
  currentLevel: number,
  newLevel: number,
  smoothingFactor: number = 0.3
): number {
  return currentLevel * (1 - smoothingFactor) + newLevel * smoothingFactor
}

/**
 * Get color based on noise level relative to threshold
 */
export function getNoiseColor(level: number, threshold: number): string {
  const ratio = level / threshold
  if (ratio < 0.5) return '#10B981' // Green
  if (ratio < 0.8) return '#F59E0B' // Yellow
  return '#EF4444' // Red
}

/**
 * Get status text based on noise level
 */
export function getNoiseStatus(level: number, threshold: number): string {
  if (level > threshold) return 'Too Loud!'
  if (level > threshold * 0.8) return 'Getting Loud'
  if (level > threshold * 0.5) return 'Moderate'
  return 'Quiet'
}

/**
 * Get level number (1-4) based on noise level relative to threshold
 * 1 = Quiet, 2 = Moderate, 3 = Getting Loud, 4 = Too Loud
 */
export function getNoiseLevelNumber(level: number, threshold: number): number {
  if (level > threshold) return 4
  if (level > threshold * 0.8) return 3
  if (level > threshold * 0.5) return 2
  return 1
}