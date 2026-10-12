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
 * Which band a level falls into, from the three bounds that name the bands.
 *
 * The bounds are named for the transitions they make -- `quietToModerate` is
 * where quiet becomes moderate -- and Settings describes them that way too
 * ("Below this, the room counts as quiet"). So each one is the *lower* edge of
 * the band it names, and three bounds are all four bands need.
 *
 * This read the four bounds one slot too high: `moderateToLoud` was used where
 * `quietToModerate` belongs, and so on up, which left `quietToModerate`
 * unreferenced in the whole app. Every band therefore began at the next
 * teacher-set number rather than its own -- with the shipped defaults the room
 * stayed "quiet" until 55 even though the panel's marker for band 2 sits at 40,
 * and the live bar in Settings was past that marker while the picture had not
 * moved. The panel was right; this was the half that disagreed.
 *
 * `alarmTrigger` is deliberately not a band edge -- see isAlarmLevel.
 */
export function getNoiseBand(level: number, t: ThresholdConfig): NoiseBand {
  if (level > t.loudToTooLoud) return 'tooLoud'
  if (level > t.moderateToLoud) return 'loud'
  if (level > t.quietToModerate) return 'moderate'
  return 'quiet'
}

/**
 * Whether the level has passed the point the alarm sounds at.
 *
 * Separate from `band === 'tooLoud'` on purpose, and the fourth bound is what
 * makes it so: the alarm point sits above the top band's lower edge, so the
 * display reaches "too loud" and warns the room *before* the sound fires. That
 * gap is the whole reason there are four bounds for four bands -- calibration
 * already assumes it, placing the three band edges at 20/50/80% of the span
 * between the room's floor and the alarm point.
 *
 * Previously the alarm was the top band, so `alarmTrigger` was the only bound
 * doing anything and the warning gap did not exist.
 */
export function isAlarmLevel(level: number, t: ThresholdConfig): boolean {
  return level > t.alarmTrigger
}

const BAND_NUMBER: Record<NoiseBand, number> = {
  quiet: 1,
  moderate: 2,
  loud: 3,
  tooLoud: 4
}

/**
 * Rungs the level has climbed, 1-5: the four bands, then the alarm above them.
 *
 * One number, so the up/down transition delay has a single monotone thing to
 * compare -- and it stays monotone in `level` even if the stored bounds are out
 * of order, since both terms rise with level and neither ever falls.
 */
export function getNoiseLevelNumber(level: number, t: ThresholdConfig): number {
  return BAND_NUMBER[getNoiseBand(level, t)] + (isAlarmLevel(level, t) ? 1 : 0)
}

/** The step 1-5 back as a band name; 5 (alarm) shows as the top band. */
export function bandFromLevelNumber(step: number): NoiseBand {
  const bands: NoiseBand[] = ['quiet', 'moderate', 'loud', 'tooLoud']
  return bands[Math.min(Math.max(Math.round(step), 1), 4) - 1]
}

/** The step at which the alarm is raised. */
export const ALARM_STEP = 5