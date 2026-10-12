/* Tests for the noise engine.
 *
 * The app shipped with no test runner at all, and these are the cases that
 * would have caught what was wrong with it: three of the four configured
 * thresholds were ignored, and the band boundaries were hardcoded ratios of
 * the fourth, written out twice.
 */
import { describe, it, expect } from 'vitest'
import {
  calculateNoiseLevel,
  smoothNoiseLevel,
  getNoiseBand,
  isAlarmLevel,
  getNoiseLevelNumber,
  bandFromLevelNumber,
  ALARM_STEP
} from './noiseCalculator'
import { DEFAULT_THRESHOLDS } from '../types'
import type { ThresholdConfig } from '../types'

/** A plausible spectrum: fftSize 256 gives 128 bins, and speech energy sits
 *  in roughly the first 21 of them. The rest read near zero, which is why the
 *  RMS over all bins is much lower than the active bins suggest. */
const spectrum = (activeBins: number, byteValue: number, total = 128) =>
  new Uint8Array(
    Array.from({ length: total }, (_, i) => (i < activeBins ? byteValue : 0))
  )

describe('calculateNoiseLevel', () => {
  it('is 0 for silence and 100 for a saturated spectrum', () => {
    expect(calculateNoiseLevel(spectrum(128, 0))).toBe(0)
    expect(calculateNoiseLevel(spectrum(128, 255))).toBe(100)
  })

  it('never leaves 0-100, even though rms can exceed 128', () => {
    // (rms/128)*100 overshoots once rms > 128, so the clamp is load-bearing.
    const level = calculateNoiseLevel(spectrum(128, 200))
    expect(level).toBeLessThanOrEqual(100)
    expect(level).toBeGreaterThanOrEqual(0)
  })

  it('rises with loudness', () => {
    const quiet = calculateNoiseLevel(spectrum(21, 120))
    const talking = calculateNoiseLevel(spectrum(21, 180))
    const loud = calculateNoiseLevel(spectrum(21, 230))
    expect(quiet).toBeLessThan(talking)
    expect(talking).toBeLessThan(loud)
  })

  it('documents how little of the scale a real room reaches', () => {
    // Recorded so a future change to fftSize or the /128 divisor shows up as
    // a diff here rather than as thresholds that quietly stop matching.
    // Even with the speech bins at the analyser's ceiling the index is ~81,
    // which is why the default alarmTrigger of 85 is so hard to reach.
    expect(calculateNoiseLevel(spectrum(21, 120))).toBeCloseTo(38.0, 0)
    expect(calculateNoiseLevel(spectrum(21, 180))).toBeCloseTo(57.0, 0)
    expect(calculateNoiseLevel(spectrum(21, 255))).toBeCloseTo(80.7, 0)
  })

  it('returns 0 rather than NaN for an empty array', () => {
    expect(calculateNoiseLevel(new Uint8Array(0))).toBe(0)
  })
})

describe('smoothNoiseLevel', () => {
  it('moves toward the new value by the smoothing factor', () => {
    expect(smoothNoiseLevel(0, 100, 0.3)).toBeCloseTo(30)
    expect(smoothNoiseLevel(100, 0, 0.3)).toBeCloseTo(70)
  })

  it('holds steady when the level has not changed', () => {
    expect(smoothNoiseLevel(50, 50, 0.3)).toBeCloseTo(50)
  })

  it('converges rather than oscillating', () => {
    let level = 0
    for (let i = 0; i < 50; i++) level = smoothNoiseLevel(level, 80, 0.3)
    expect(level).toBeCloseTo(80, 1)
  })
})

describe('getNoiseBand', () => {
  const t: ThresholdConfig = {
    quietToModerate: 20,
    moderateToLoud: 40,
    loudToTooLoud: 60,
    alarmTrigger: 80
  }

  /* These cases previously asserted the bug.
   *
   * The implementation read the bounds one slot too high -- `moderateToLoud`
   * where `quietToModerate` belongs -- and the tests were written to match it,
   * so a suite named "uses every configured bound" passed while one bound was
   * referenced nowhere in the app. Reading the code and reading the tests
   * agreed with each other and both disagreed with the panel, which is why
   * only using the tool showed it.
   *
   * The bound names and the panel's own descriptions decide it: each bound is
   * the lower edge of the band it names.
   */
  it('starts each band at the bound named for it', () => {
    expect(getNoiseBand(10, t)).toBe('quiet')
    expect(getNoiseBand(30, t)).toBe('moderate')
    expect(getNoiseBand(50, t)).toBe('loud')
    expect(getNoiseBand(70, t)).toBe('tooLoud')
  })

  it('uses quietToModerate at all', () => {
    // The bound the old implementation never read. Moving only this one has
    // to move the quiet/moderate edge, or it is inert again.
    const later: ThresholdConfig = { ...t, quietToModerate: 35 }
    expect(getNoiseBand(30, t)).toBe('moderate')
    expect(getNoiseBand(30, later)).toBe('quiet')
  })

  it('does not wait for the alarm point to show the top band', () => {
    // The warning gap: the display reaches "too loud" at loudToTooLoud (60)
    // and the alarm only sounds above alarmTrigger (80).
    expect(getNoiseBand(65, t)).toBe('tooLoud')
    expect(isAlarmLevel(65, t)).toBe(false)
    expect(isAlarmLevel(85, t)).toBe(true)
  })

  it('treats each bound as exclusive, so a bound value is the lower band', () => {
    expect(getNoiseBand(20, t)).toBe('quiet')
    expect(getNoiseBand(20.01, t)).toBe('moderate')
    expect(getNoiseBand(40, t)).toBe('moderate')
    expect(getNoiseBand(40.01, t)).toBe('loud')
    expect(getNoiseBand(60, t)).toBe('loud')
    expect(getNoiseBand(60.01, t)).toBe('tooLoud')
    expect(isAlarmLevel(80, t)).toBe(false)
    expect(isAlarmLevel(80.01, t)).toBe(true)
  })

  it('responds to moving a single slider', () => {
    const quieter: ThresholdConfig = { ...t, moderateToLoud: 25 }
    expect(getNoiseBand(30, t)).toBe('moderate')
    expect(getNoiseBand(30, quieter)).toBe('loud')
  })

  it('still reaches the top band and the alarm when the bands are narrow', () => {
    const narrow: ThresholdConfig = {
      quietToModerate: 50,
      moderateToLoud: 51,
      loudToTooLoud: 52,
      alarmTrigger: 53
    }
    expect(getNoiseBand(50, narrow)).toBe('quiet')
    expect(getNoiseBand(52.5, narrow)).toBe('tooLoud')
    expect(isAlarmLevel(54, narrow)).toBe(true)
  })

  it('maps the shipped defaults onto the bands the panel marks them with', () => {
    // 40/55/70/85. The panel draws its "2" marker at 40, so 45 has to be band
    // 2 -- the exact disagreement that was visible in Settings: the live bar
    // sat past the marker while the picture stayed on band 1.
    expect(getNoiseBand(39, DEFAULT_THRESHOLDS)).toBe('quiet')
    expect(getNoiseBand(45, DEFAULT_THRESHOLDS)).toBe('moderate')
    expect(getNoiseBand(60, DEFAULT_THRESHOLDS)).toBe('loud')
    expect(getNoiseBand(75, DEFAULT_THRESHOLDS)).toBe('tooLoud')
    expect(isAlarmLevel(75, DEFAULT_THRESHOLDS)).toBe(false)
    expect(isAlarmLevel(90, DEFAULT_THRESHOLDS)).toBe(true)
  })

  it('agrees with the marker positions Settings draws, whatever they are', () => {
    // Settings places its markers at the first three bounds. Rather than
    // restating the defaults, this walks arbitrary configs and asserts the
    // band changes exactly where a marker sits -- so the two cannot drift
    // apart again without this failing.
    const configs: ThresholdConfig[] = [
      { quietToModerate: 5, moderateToLoud: 10, loudToTooLoud: 15, alarmTrigger: 20 },
      { quietToModerate: 33, moderateToLoud: 44, loudToTooLoud: 55, alarmTrigger: 66 },
      { quietToModerate: 70, moderateToLoud: 80, loudToTooLoud: 90, alarmTrigger: 95 }
    ]
    for (const c of configs) {
      const markers = [c.quietToModerate, c.moderateToLoud, c.loudToTooLoud]
      markers.forEach((marker, i) => {
        expect(getNoiseLevelNumber(marker, c)).toBe(i + 1)
        expect(getNoiseLevelNumber(marker + 0.01, c)).toBe(i + 2)
      })
    }
  })
})

describe('getNoiseLevelNumber', () => {
  it('numbers the four bands then the alarm, 1-5', () => {
    const t = DEFAULT_THRESHOLDS
    expect(getNoiseLevelNumber(10, t)).toBe(1)
    expect(getNoiseLevelNumber(45, t)).toBe(2)
    expect(getNoiseLevelNumber(60, t)).toBe(3)
    expect(getNoiseLevelNumber(75, t)).toBe(4)
    expect(getNoiseLevelNumber(90, t)).toBe(ALARM_STEP)
  })

  it('never falls as the level rises', () => {
    // The up/down transition delay compares these numbers, so a dip anywhere
    // would make a louder room look like a drop and run the wrong timer.
    let previous = 0
    for (let level = 0; level <= 100; level += 0.25) {
      const step = getNoiseLevelNumber(level, DEFAULT_THRESHOLDS)
      expect(step).toBeGreaterThanOrEqual(previous)
      previous = step
    }
  })

  it('stays monotone even if the stored bounds are out of order', () => {
    // parseThresholds rejects these, but nothing downstream re-checks, and a
    // non-monotone step would strand the delay logic rather than merely look
    // odd.
    const scrambled: ThresholdConfig = {
      quietToModerate: 60,
      moderateToLoud: 20,
      loudToTooLoud: 80,
      alarmTrigger: 10
    }
    let previous = 0
    for (let level = 0; level <= 100; level += 0.25) {
      const step = getNoiseLevelNumber(level, scrambled)
      expect(step).toBeGreaterThanOrEqual(previous)
      previous = step
    }
  })

  it('agrees with getNoiseBand across the whole range', () => {
    const order = ['quiet', 'moderate', 'loud', 'tooLoud'] as const
    for (let level = 0; level <= 100; level += 0.5) {
      const band = getNoiseBand(level, DEFAULT_THRESHOLDS)
      const step = getNoiseLevelNumber(level, DEFAULT_THRESHOLDS)
      expect(bandFromLevelNumber(step)).toBe(band)
      expect(Math.min(step, 4)).toBe(order.indexOf(band) + 1)
    }
  })
})

describe('bandFromLevelNumber', () => {
  it('round-trips the four bands and folds the alarm step into the top one', () => {
    expect(bandFromLevelNumber(1)).toBe('quiet')
    expect(bandFromLevelNumber(2)).toBe('moderate')
    expect(bandFromLevelNumber(3)).toBe('loud')
    expect(bandFromLevelNumber(4)).toBe('tooLoud')
    expect(bandFromLevelNumber(ALARM_STEP)).toBe('tooLoud')
  })

  it('clamps rather than returning undefined', () => {
    // NoiseMonitor resets the committed step on stop; a 0 reaching here used
    // to index past the array, and `band === undefined` makes every theme fall
    // through to its default colour with nothing to say why.
    expect(bandFromLevelNumber(0)).toBe('quiet')
    expect(bandFromLevelNumber(-3)).toBe('quiet')
    expect(bandFromLevelNumber(99)).toBe('tooLoud')
  })
})
