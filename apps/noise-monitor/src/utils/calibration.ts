import type { ThresholdConfig } from '../types'

/**
 * Deriving the thresholds from the room instead of shipping constants.
 *
 * The index calculateNoiseLevel produces is relative to the microphone's full
 * scale, so what counts as "quiet" depends on the mic, where it sits, and the
 * OS mixer. A single set of shipped numbers cannot be right for two rooms, and
 * the previous defaults (40/55/70/85) were the WHO's dB(A) figures used as
 * index values -- which put the alarm beyond practical reach, since the index
 * only gets to about 81 with the speech bins at the analyser's ceiling.
 *
 * So: listen to the room for a few seconds, take its quiet floor, and place
 * the bands above it. A teacher who wants different bands still overrides them
 * in Settings; this only replaces the starting point.
 */

/** How long to listen before deriving bands. Long enough to ride out a chair
 *  scrape or a cough, short enough that a teacher does not wait on it. */
export const CALIBRATION_MS = 6000

/** Below this many samples the floor is too noisy an estimate to trust. */
export const MIN_CALIBRATION_SAMPLES = 60

/**
 * Offsets above the measured floor, in index units.
 *
 * Derived from what the index actually does rather than chosen for roundness.
 * With fftSize 256 and the -100..-30 dBFS window, speech energy occupying
 * roughly the first 21 of 128 bins reads about:
 *
 *     bins at byte 120 (-67 dBFS)  ->  38    a room murmuring
 *     bins at byte 180 (-51 dBFS)  ->  57    normal talk
 *     bins at byte 230 (-37 dBFS)  ->  73    loud group work
 *     bins at byte 255 (ceiling)   ->  81    saturated
 *
 * So the usable span from a quiet floor to saturation is roughly 40 index
 * units, and these offsets divide it: talking sits near the moderate bound,
 * loud group work near the loud bound, and the alarm below saturation so it
 * can actually fire.
 */
export const FLOOR_OFFSETS = {
  quietToModerate: 8,
  moderateToLoud: 20,
  loudToTooLoud: 32,
  alarmTrigger: 40
} as const

/**
 * The room's quiet floor from a window of samples.
 *
 * The 20th percentile, not the minimum or the mean: the minimum catches a
 * single dropout frame and the mean is dragged up by whatever talking happened
 * during calibration. The low-but-not-lowest point is the room's resting level.
 */
export function floorFromSamples(samples: readonly number[]): number | null {
  const usable = samples.filter((n) => Number.isFinite(n) && n >= 0 && n <= 100)
  if (usable.length < MIN_CALIBRATION_SAMPLES) return null

  const sorted = [...usable].sort((a, b) => a - b)
  const index = Math.floor(sorted.length * 0.2)
  return sorted[Math.min(index, sorted.length - 1)]
}

/**
 * Bands placed above a measured floor, clamped to stay ordered and in range.
 *
 * A loud room during calibration gives a high floor, which would push the
 * alarm past 100 and make it unreachable -- the failure the old constants had.
 * So the bands are compressed to fit rather than clipped: whatever the floor,
 * four distinct ascending bounds come back, all below 100.
 */
export function bandsFromFloor(floor: number): ThresholdConfig {
  const headroom = 100 - floor
  // Below this the offsets would not fit, so scale them into what is left.
  const scale = Math.min(1, headroom / (FLOOR_OFFSETS.alarmTrigger + 2))

  const place = (offset: number) =>
    Math.round(Math.min(99, floor + offset * scale) * 10) / 10

  const bands = {
    quietToModerate: place(FLOOR_OFFSETS.quietToModerate),
    moderateToLoud: place(FLOOR_OFFSETS.moderateToLoud),
    loudToTooLoud: place(FLOOR_OFFSETS.loudToTooLoud),
    alarmTrigger: place(FLOOR_OFFSETS.alarmTrigger)
  }

  // Scaling can collapse two bounds onto the same value; the band logic needs
  // them strictly ascending or a band becomes unreachable.
  const keys = [
    'quietToModerate',
    'moderateToLoud',
    'loudToTooLoud',
    'alarmTrigger'
  ] as const
  for (let i = 1; i < keys.length; i++) {
    const prev = bands[keys[i - 1]]
    if (bands[keys[i]] <= prev) {
      bands[keys[i]] = Math.min(99.9, Math.round((prev + 0.1) * 10) / 10)
    }
  }
  return bands
}

/** Bands for a room, or null when the sample window was not usable. */
export function calibrate(samples: readonly number[]): ThresholdConfig | null {
  const floor = floorFromSamples(samples)
  return floor === null ? null : bandsFromFloor(floor)
}
