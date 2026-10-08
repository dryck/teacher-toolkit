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
 * Where the three lower bounds sit between the floor and the alarm point, as
 * fractions of that span.
 *
 * One shape, used by both ways of calibrating: the automatic one, which has to
 * guess the alarm point, and the teacher-set one, which is told it. Keeping a
 * single set of proportions means the bands feel the same either way.
 */
export const BAND_FRACTIONS = {
  quietToModerate: 0.2,
  moderateToLoud: 0.5,
  loudToTooLoud: 0.8
} as const

/**
 * How far above the floor to put the alarm when nobody has said.
 *
 * This is the one number in the tool that is still a guess, and it is a guess
 * about a room: how much louder than its resting level a class has to get
 * before a teacher would want to intervene. Derived from what the index does
 * -- with fftSize 256 and the -100..-30 dBFS window, speech in roughly the
 * first 21 of 128 bins reads about 38 at a murmur, 57 at normal talk, 73 at
 * loud group work and 81 saturated -- so 40 above a quiet floor lands near the
 * top of what a room actually produces.
 *
 * A teacher who disagrees does not have to argue with it: "use the current
 * level as the limit" in Settings replaces it with a measurement.
 */
export const DEFAULT_ALARM_OFFSET = 40

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
  // Below this the offset would not fit, so scale it into what is left: a loud
  // room gives a high floor, and an alarm point past 100 can never be crossed
  // -- the failure the old shipped constants had.
  const limit = Math.min(99, floor + Math.min(DEFAULT_ALARM_OFFSET, headroom - 1))
  return bandsFromFloorAndLimit(floor, limit)
}

/**
 * Bands between a measured floor and a known alarm point.
 *
 * This is the path with no guess left in it: the floor is measured from the
 * room and the limit is the level the teacher pointed at.
 */
export function bandsFromFloorAndLimit(floor: number, limit: number): ThresholdConfig {
  const lo = Math.min(Math.max(floor, 0), 99)
  // The limit has to sit above the floor with room for three bounds between.
  const hi = Math.min(Math.max(limit, lo + 0.4), 99.9)
  const span = hi - lo

  const place = (fraction: number) => Math.round((lo + span * fraction) * 10) / 10

  const bands = {
    quietToModerate: place(BAND_FRACTIONS.quietToModerate),
    moderateToLoud: place(BAND_FRACTIONS.moderateToLoud),
    loudToTooLoud: place(BAND_FRACTIONS.loudToTooLoud),
    alarmTrigger: Math.round(hi * 10) / 10
  }

  // Rounding a narrow span can collapse two bounds onto each other, which
  // would leave a band no level can reach.
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

/** As calibrate, but also returns the floor, which the teacher-set alarm point
 *  needs in order to redistribute the lower bounds beneath it. */
export function calibrateWithFloor(
  samples: readonly number[]
): { floor: number; bands: ThresholdConfig } | null {
  const floor = floorFromSamples(samples)
  return floor === null ? null : { floor, bands: bandsFromFloor(floor) }
}
