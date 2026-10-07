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
  getNoiseLevelNumber
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

  it('uses every configured bound, not ratios of the alarm point', () => {
    // The regression this file exists for. The old implementation took only
    // alarmTrigger and used 0.5/0.8 of it, so with alarmTrigger 80 the
    // boundaries were 40 and 64 no matter what the other sliders said. A
    // level of 45 would have been 'moderate'; it is 'loud' here because the
    // teacher set loudToTooLoud to 60.
    expect(getNoiseBand(30, t)).toBe('quiet')
    expect(getNoiseBand(45, t)).toBe('moderate')
    expect(getNoiseBand(70, t)).toBe('loud')
    expect(getNoiseBand(90, t)).toBe('tooLoud')
  })

  it('treats each bound as exclusive, so a bound value is the lower band', () => {
    expect(getNoiseBand(40, t)).toBe('quiet')
    expect(getNoiseBand(40.01, t)).toBe('moderate')
    expect(getNoiseBand(60, t)).toBe('moderate')
    expect(getNoiseBand(80, t)).toBe('loud')
    expect(getNoiseBand(80.01, t)).toBe('tooLoud')
  })

  it('responds to moving a single slider', () => {
    const quieter: ThresholdConfig = { ...t, moderateToLoud: 25 }
    expect(getNoiseBand(30, t)).toBe('quiet')
    expect(getNoiseBand(30, quieter)).toBe('moderate')
  })

  it('still reports tooLoud when the bands are set very close together', () => {
    const narrow: ThresholdConfig = {
      quietToModerate: 50,
      moderateToLoud: 51,
      loudToTooLoud: 52,
      alarmTrigger: 53
    }
    expect(getNoiseBand(54, narrow)).toBe('tooLoud')
    expect(getNoiseBand(50, narrow)).toBe('quiet')
  })

  it('maps the shipped defaults onto the bands they name', () => {
    expect(getNoiseBand(39, DEFAULT_THRESHOLDS)).toBe('quiet')
    expect(getNoiseBand(60, DEFAULT_THRESHOLDS)).toBe('moderate')
    expect(getNoiseBand(75, DEFAULT_THRESHOLDS)).toBe('loud')
    expect(getNoiseBand(90, DEFAULT_THRESHOLDS)).toBe('tooLoud')
  })
})

describe('getNoiseLevelNumber', () => {
  it('numbers the bands 1-4 in order', () => {
    const t = DEFAULT_THRESHOLDS
    expect(getNoiseLevelNumber(10, t)).toBe(1)
    expect(getNoiseLevelNumber(60, t)).toBe(2)
    expect(getNoiseLevelNumber(75, t)).toBe(3)
    expect(getNoiseLevelNumber(90, t)).toBe(4)
  })

  it('agrees with getNoiseBand across the whole range', () => {
    const order = ['quiet', 'moderate', 'loud', 'tooLoud'] as const
    for (let level = 0; level <= 100; level += 0.5) {
      const band = getNoiseBand(level, DEFAULT_THRESHOLDS)
      expect(getNoiseLevelNumber(level, DEFAULT_THRESHOLDS))
        .toBe(order.indexOf(band) + 1)
    }
  })
})
