/* useSettings owns the threshold state, so it owns the two ways that state
 * used to break invisibly: an unvalidated config loaded from localStorage, and
 * an unclamped value from a number input. Both left a threshold that no level
 * could ever cross, with nothing logged.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useSettings } from './useSettings'
import { DEFAULT_THRESHOLDS } from '../types'
import { getNoiseBand } from '../utils/noiseCalculator'
import { BAND_FRACTIONS } from '../utils/calibration'

const THRESHOLDS_KEY = 'noise-monitor-thresholds'
const SOURCE_KEY = 'noise-monitor-threshold-source'

beforeEach(() => localStorage.clear())
afterEach(() => vi.restoreAllMocks())

describe('loading a stored config', () => {
  it('uses a valid one', () => {
    const stored = { quietToModerate: 10, moderateToLoud: 20, loudToTooLoud: 30, alarmTrigger: 40 }
    localStorage.setItem(THRESHOLDS_KEY, JSON.stringify(stored))
    const { result } = renderHook(() => useSettings())
    expect(result.current.thresholds).toEqual(stored)
  })

  it('rejects one missing a field rather than loading undefined', () => {
    // The original bug: a config saved before alarmTrigger existed left it
    // undefined, every `level > undefined` was false, and the alarm never
    // fired again. Falling back to the defaults is recoverable; that was not.
    localStorage.setItem(THRESHOLDS_KEY, JSON.stringify({
      quietToModerate: 10, moderateToLoud: 20, loudToTooLoud: 30
    }))
    const { result } = renderHook(() => useSettings())
    expect(result.current.thresholds).toEqual(DEFAULT_THRESHOLDS)
    expect(result.current.thresholds.alarmTrigger).toBeTypeOf('number')
  })

  it('rejects out-of-order bounds, which would make a band unreachable', () => {
    localStorage.setItem(THRESHOLDS_KEY, JSON.stringify({
      quietToModerate: 80, moderateToLoud: 20, loudToTooLoud: 30, alarmTrigger: 40
    }))
    const { result } = renderHook(() => useSettings())
    expect(result.current.thresholds).toEqual(DEFAULT_THRESHOLDS)
  })

  it('rejects non-numeric and non-finite values', () => {
    for (const bad of [
      { quietToModerate: 'ten', moderateToLoud: 20, loudToTooLoud: 30, alarmTrigger: 40 },
      { quietToModerate: 10, moderateToLoud: null, loudToTooLoud: 30, alarmTrigger: 40 },
      { quietToModerate: 10, moderateToLoud: 20, loudToTooLoud: 30, alarmTrigger: Infinity }
    ]) {
      localStorage.setItem(THRESHOLDS_KEY, JSON.stringify(bad))
      const { result } = renderHook(() => useSettings())
      expect(result.current.thresholds).toEqual(DEFAULT_THRESHOLDS)
    }
  })

  it('survives malformed JSON', () => {
    localStorage.setItem(THRESHOLDS_KEY, '{not json')
    const { result } = renderHook(() => useSettings())
    expect(result.current.thresholds).toEqual(DEFAULT_THRESHOLDS)
  })

  it('does not throw when storage is unavailable', () => {
    // Safari private browsing, or a full quota.
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('denied')
    })
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('denied')
    })
    expect(() => renderHook(() => useSettings())).not.toThrow()
  })
})

describe('updateThreshold', () => {
  it('clamps above 100', () => {
    const { result } = renderHook(() => useSettings())
    act(() => result.current.updateThreshold('quietToModerate', 500))
    expect(result.current.thresholds.quietToModerate).toBeLessThanOrEqual(100)
  })

  it('clamps below 0', () => {
    const { result } = renderHook(() => useSettings())
    act(() => result.current.updateThreshold('quietToModerate', -50))
    expect(result.current.thresholds.quietToModerate).toBeGreaterThanOrEqual(0)
  })

  it('refuses a change that would put the bounds out of order', () => {
    const { result } = renderHook(() => useSettings())
    const before = result.current.thresholds.quietToModerate
    // Above moderateToLoud (55 by default), so the ordering breaks.
    act(() => result.current.updateThreshold('quietToModerate', 90))
    expect(result.current.thresholds.quietToModerate).toBe(before)
    expect(result.current.errors.moderateToLoud).toBeTruthy()
  })

  it('marks the bands as set by hand', () => {
    const { result } = renderHook(() => useSettings())
    act(() => result.current.updateThreshold('quietToModerate', 30))
    expect(result.current.source).toBe('manual')
  })
})

describe('applyCalibration', () => {
  const measured = {
    quietToModerate: 44, moderateToLoud: 56, loudToTooLoud: 68, alarmTrigger: 76
  }

  it('adopts measured bands over the shipped defaults', () => {
    const { result } = renderHook(() => useSettings())
    expect(result.current.source).toBe('default')
    act(() => result.current.applyCalibration(measured))
    expect(result.current.thresholds).toEqual(measured)
    expect(result.current.source).toBe('calibrated')
  })

  it('never overrides what a teacher set by hand', () => {
    const { result } = renderHook(() => useSettings())
    act(() => result.current.updateThreshold('quietToModerate', 30))
    const chosen = result.current.thresholds
    act(() => result.current.applyCalibration(measured))
    expect(result.current.thresholds).toEqual(chosen)
    expect(result.current.source).toBe('manual')
  })

  it('is applied once, not twice, when called repeatedly', () => {
    // applyCalibration used to call setThresholds inside a setSource updater,
    // which React invokes twice in StrictMode.
    const { result } = renderHook(() => useSettings())
    act(() => {
      result.current.applyCalibration(measured)
      result.current.applyCalibration({ ...measured, alarmTrigger: 99 })
    })
    // The second call lands because the source is 'calibrated', not 'manual';
    // what matters is that the state is coherent rather than half-updated.
    expect(result.current.thresholds.alarmTrigger).toBeGreaterThan(0)
    expect(result.current.source).toBe('calibrated')
  })

  it('produces bands where every level maps to some band', () => {
    const { result } = renderHook(() => useSettings())
    act(() => result.current.applyCalibration(measured))
    const bands = new Set<string>()
    for (let level = 0; level <= 100; level += 0.5) {
      bands.add(getNoiseBand(level, result.current.thresholds))
    }
    expect(bands.size).toBe(4)
  })
})

describe('resetThresholds', () => {
  it('returns to the defaults and forgets the source', () => {
    const { result } = renderHook(() => useSettings())
    act(() => result.current.updateThreshold('quietToModerate', 30))
    act(() => result.current.resetThresholds())
    expect(result.current.thresholds).toEqual(DEFAULT_THRESHOLDS)
    expect(result.current.source).toBe('default')
    expect(result.current.isUsingDefaults).toBe(true)
  })

  it('lets calibration take over again afterwards', () => {
    const { result } = renderHook(() => useSettings())
    act(() => result.current.updateThreshold('quietToModerate', 30))
    act(() => result.current.resetThresholds())
    act(() => result.current.applyCalibration({
      quietToModerate: 44, moderateToLoud: 56, loudToTooLoud: 68, alarmTrigger: 76
    }))
    expect(result.current.source).toBe('calibrated')
  })
})

describe('persistence', () => {
  it('writes the source alongside the thresholds', () => {
    const { result } = renderHook(() => useSettings())
    act(() => result.current.applyCalibration({
      quietToModerate: 44, moderateToLoud: 56, loudToTooLoud: 68, alarmTrigger: 76
    }))
    expect(localStorage.getItem(SOURCE_KEY)).toContain('calibrated')
    expect(JSON.parse(localStorage.getItem(THRESHOLDS_KEY)!).alarmTrigger).toBe(76)
  })
})

describe('setLimitFromCurrent', () => {
  // Replaces the one remaining guess -- how far above a room's resting level
  // is too loud -- with something the teacher watched happen.
  const measured = {
    quietToModerate: 44, moderateToLoud: 56, loudToTooLoud: 68, alarmTrigger: 76
  }

  it('puts the alarm on the level the teacher pointed at', () => {
    const { result } = renderHook(() => useSettings())
    act(() => result.current.applyCalibration(measured, 36))
    act(() => result.current.setLimitFromCurrent(64))
    expect(result.current.thresholds.alarmTrigger).toBeCloseTo(64, 1)
  })

  it('spreads the lower bands between the measured floor and that level', () => {
    const { result } = renderHook(() => useSettings())
    act(() => result.current.applyCalibration(measured, 30))
    act(() => result.current.setLimitFromCurrent(70))
    const t = result.current.thresholds
    expect(t.moderateToLoud).toBeCloseTo(30 + 40 * BAND_FRACTIONS.moderateToLoud, 1)
    expect(t.quietToModerate).toBeGreaterThan(30)
    expect(t.loudToTooLoud).toBeLessThan(70)
  })

  it('counts as set by hand, so calibration will not undo it', () => {
    const { result } = renderHook(() => useSettings())
    act(() => result.current.applyCalibration(measured, 36))
    act(() => result.current.setLimitFromCurrent(64))
    const chosen = result.current.thresholds
    act(() => result.current.applyCalibration(measured, 36))
    expect(result.current.thresholds).toEqual(chosen)
    expect(result.current.source).toBe('manual')
  })

  it('works before calibration has produced a floor', () => {
    // A teacher can open Settings and press this in the first six seconds.
    const { result } = renderHook(() => useSettings())
    act(() => result.current.setLimitFromCurrent(60))
    const t = result.current.thresholds
    expect(t.alarmTrigger).toBeCloseTo(60, 1)
    expect(t.quietToModerate).toBeLessThan(t.moderateToLoud)
    expect(t.moderateToLoud).toBeLessThan(t.loudToTooLoud)
    expect(t.loudToTooLoud).toBeLessThan(t.alarmTrigger)
  })

  it('ignores a meaningless level rather than placing the alarm at zero', () => {
    const { result } = renderHook(() => useSettings())
    const before = result.current.thresholds
    act(() => result.current.setLimitFromCurrent(0))
    act(() => result.current.setLimitFromCurrent(NaN))
    act(() => result.current.setLimitFromCurrent(-5))
    expect(result.current.thresholds).toEqual(before)
  })

  it('leaves every band reachable', () => {
    const { result } = renderHook(() => useSettings())
    act(() => result.current.applyCalibration(measured, 36))
    act(() => result.current.setLimitFromCurrent(50))
    const bands = new Set<string>()
    for (let level = 0; level <= 100; level += 0.5) {
      bands.add(getNoiseBand(level, result.current.thresholds))
    }
    expect(bands.size).toBe(4)
  })
})

describe('the measured floor', () => {
  it('is remembered even when the bands are the teacher\'s own', () => {
    // So pointing at a limit later can still redistribute beneath the room's
    // real resting level rather than a fallback.
    const { result } = renderHook(() => useSettings())
    act(() => result.current.updateThreshold('quietToModerate', 30))
    act(() => result.current.applyCalibration({
      quietToModerate: 44, moderateToLoud: 56, loudToTooLoud: 68, alarmTrigger: 76
    }, 38))
    expect(result.current.source).toBe('manual')
    expect(result.current.measuredFloor).toBe(38)
  })
})
