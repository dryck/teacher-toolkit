import type { ThresholdConfig, NoiseBand } from '../types'

/**
 * Room loudness as a relative 0-100 index.
 *
 * NOT decibels, and deliberately not presented as such. `frequencyData` holds
 * getByteFrequencyData output: each byte is one FFT bin's magnitude mapped
 * from the analyser's minDecibels..maxDecibels window (-100..-30 dBFS by
 * default) onto 0..255. That is level relative to the input's full scale,
 * which depends on the microphone, its placement and the OS mixer -- there is
 * no path from it to sound pressure without a calibrated reference, and the
 * Web Audio API cannot provide one.
 *
 * So this is a self-relative scale: useful for "louder than we were a minute
 * ago", which is what self-monitoring needs, and meaningless as an absolute
 * measurement. Thresholds are points on this index, not dB values.
 */
export function calculateNoiseLevel(frequencyData: Uint8Array): number {
  // An empty array divides by zero and yields NaN, and NaN here is not a
  // visible failure -- it survives smoothNoiseLevel (NaN propagates through
  // the moving average) and every band comparison against it is false, so the
  // display sticks on "quiet" and the alarm never fires again for the rest of
  // the lesson. A real analyser always reports at least one bin, but a silent
  // permanent failure is not worth leaving to that.
  if (frequencyData.length === 0) return 0

  let sum = 0
  for (let i = 0; i < frequencyData.length; i++) {
    sum += frequencyData[i] * frequencyData[i]
  }
  const rms = Math.sqrt(sum / frequencyData.length)
  return Math.min(Math.max((rms / 128) * 100, 0), 100)
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
 * Which band a level falls into, from the teacher's four configured bounds.
 *
 * This is the single place the bands are decided. It used to take only
 * `alarmTrigger` and derive the lower bounds as fixed 0.5 and 0.8 ratios of
 * it, so three of the four sliders in Settings changed nothing: they were
 * validated for ordering, drawn as markers on the live preview, and then
 * ignored. With alarmTrigger at its default 85 the real boundaries were 42.5
 * and 68, not the 40/55/70 the panel displayed.
 *
 * The same ratio logic also existed, written out separately, in
 * NoiseMonitor's getLevel(). Both now call this.
 */
export function getNoiseBand(level: number, t: ThresholdConfig): NoiseBand {
  if (level > t.alarmTrigger) return 'tooLoud'
  if (level > t.loudToTooLoud) return 'loud'
  if (level > t.moderateToLoud) return 'moderate'
  return 'quiet'
}

const BAND_NUMBER: Record<NoiseBand, number> = {
  quiet: 1,
  moderate: 2,
  loud: 3,
  tooLoud: 4
}

/** The band as 1-4, for the themes that take a number rather than a name. */
export function getNoiseLevelNumber(level: number, t: ThresholdConfig): number {
  return BAND_NUMBER[getNoiseBand(level, t)]
}