import { describe, it, expect } from 'vitest'
import {
  floorFromSamples,
  bandsFromFloor,
  calibrate,
  FLOOR_OFFSETS,
  MIN_CALIBRATION_SAMPLES
} from './calibration'
import { getNoiseBand } from './noiseCalculator'

/** `n` samples jittering around `centre`, deterministic so failures repeat. */
const room = (centre: number, n = 200, spread = 3) =>
  Array.from({ length: n }, (_, i) => centre + Math.sin(i * 1.7) * spread)

describe('floorFromSamples', () => {
  it('finds the resting level of a steady room', () => {
    const floor = floorFromSamples(room(40))
    expect(floor).toBeGreaterThan(35)
    expect(floor).toBeLessThan(40)
  })

  it('is not dragged up by talking during calibration', () => {
    // Three quarters quiet, one quarter loud. The mean would be about 47;
    // the floor should still describe the quiet part.
    const samples = [...room(38, 150), ...room(75, 50)]
    const floor = floorFromSamples(samples)!
    const mean = samples.reduce((a, b) => a + b, 0) / samples.length
    expect(floor).toBeLessThan(42)
    expect(floor).toBeLessThan(mean - 5)
  })

  it('is not dragged down by a single dropout frame', () => {
    // Why the 20th percentile and not the minimum.
    const samples = [0, ...room(40, 199)]
    expect(floorFromSamples(samples)!).toBeGreaterThan(35)
  })

  it('refuses a window too short to trust', () => {
    expect(floorFromSamples(room(40, MIN_CALIBRATION_SAMPLES - 1))).toBeNull()
    expect(floorFromSamples([])).toBeNull()
  })

  it('ignores NaN and out-of-range samples rather than propagating them', () => {
    const samples = [...room(40, 200), NaN, Infinity, -5, 150]
    const floor = floorFromSamples(samples)!
    expect(Number.isFinite(floor)).toBe(true)
    expect(floor).toBeGreaterThan(35)
  })

  it('still refuses when discarding bad samples leaves too few', () => {
    const samples = Array.from({ length: 200 }, () => NaN)
    expect(floorFromSamples(samples)).toBeNull()
  })
})

describe('bandsFromFloor', () => {
  it('places the bands above the floor, in order', () => {
    const b = bandsFromFloor(35)
    expect(b.quietToModerate).toBeGreaterThan(35)
    expect(b.moderateToLoud).toBeGreaterThan(b.quietToModerate)
    expect(b.loudToTooLoud).toBeGreaterThan(b.moderateToLoud)
    expect(b.alarmTrigger).toBeGreaterThan(b.loudToTooLoud)
  })

  it('uses the offsets directly when there is headroom', () => {
    const b = bandsFromFloor(30)
    expect(b.quietToModerate).toBeCloseTo(30 + FLOOR_OFFSETS.quietToModerate, 1)
    expect(b.alarmTrigger).toBeCloseTo(30 + FLOOR_OFFSETS.alarmTrigger, 1)
  })

  it('keeps the alarm reachable from a loud room', () => {
    // The failure the old constants had: an alarm point the index cannot get
    // to. However high the floor, the alarm must stay under 100.
    for (const floor of [0, 25, 50, 70, 85, 95, 99]) {
      const b = bandsFromFloor(floor)
      expect(b.alarmTrigger, `floor ${floor}`).toBeLessThan(100)
      expect(b.alarmTrigger, `floor ${floor}`).toBeGreaterThan(floor)
    }
  })

  it('keeps all four bounds distinct even when compressed', () => {
    // Scaling into tiny headroom can collapse bounds onto each other, which
    // would make a band unreachable.
    for (const floor of [90, 95, 98, 99, 99.5]) {
      const b = bandsFromFloor(floor)
      const values = [
        b.quietToModerate,
        b.moderateToLoud,
        b.loudToTooLoud,
        b.alarmTrigger
      ]
      expect(new Set(values).size, `floor ${floor}`).toBe(4)
      for (let i = 1; i < values.length; i++) {
        expect(values[i], `floor ${floor} bound ${i}`).toBeGreaterThan(values[i - 1])
      }
    }
  })

  it('produces bands every one of which is reachable', () => {
    // The point of calibrating: each band must correspond to some level.
    const b = bandsFromFloor(36)
    const bands = new Set<string>()
    for (let level = 0; level <= 100; level += 0.1) {
      bands.add(getNoiseBand(level, b))
    }
    expect(bands).toEqual(new Set(['quiet', 'moderate', 'loud', 'tooLoud']))
  })
})

describe('calibrate', () => {
  it('turns a quiet room into usable bands', () => {
    const b = calibrate(room(36))!
    expect(b).not.toBeNull()
    expect(getNoiseBand(36, b)).toBe('quiet')
    expect(getNoiseBand(b.alarmTrigger + 1, b)).toBe('tooLoud')
  })

  it('gives a louder room higher bands, not broken ones', () => {
    const quiet = calibrate(room(30))!
    const noisy = calibrate(room(55))!
    expect(noisy.alarmTrigger).toBeGreaterThan(quiet.alarmTrigger)
    expect(noisy.alarmTrigger).toBeLessThan(100)
  })

  it('returns null rather than guessing from an unusable window', () => {
    expect(calibrate([])).toBeNull()
    expect(calibrate(room(40, 10))).toBeNull()
  })

  it('classifies a normal working level as not yet too loud', () => {
    // A room calibrated while quiet, then working normally: talking should
    // register as moderate/loud, not immediately trip the alarm.
    const b = calibrate(room(36))!
    expect(getNoiseBand(57, b)).not.toBe('tooLoud')
    expect(getNoiseBand(57, b)).not.toBe('quiet')
  })
})
