import { useState, useEffect, useCallback, useRef } from 'react'
import { ThresholdConfig, DEFAULT_THRESHOLDS, DelayConfig, DEFAULT_DELAYS } from '../types'
import { bandsFromFloorAndLimit } from '../utils/calibration'

const THRESHOLDS_KEY = 'noise-monitor-thresholds'
const DELAYS_KEY = 'noise-monitor-delays'
const SOURCE_KEY = 'noise-monitor-threshold-source'
const FLOOR_KEY = 'noise-monitor-measured-floor'

/** Where the current bands came from, which is what the panel reports and
 *  what decides whether a fresh calibration is allowed to overwrite them. */
export type ThresholdSource = 'default' | 'calibrated' | 'manual'

const THRESHOLD_KEYS = [
  'quietToModerate',
  'moderateToLoud',
  'loudToTooLoud',
  'alarmTrigger'
] as const

/**
 * A stored config, or null if it is not one.
 *
 * This used to be `setThresholds(JSON.parse(stored))` with no check. A value
 * saved by an older build missing `alarmTrigger` left it undefined, every
 * `level > undefined` comparison was false, and the alarm silently never fired
 * again -- with nothing in the console to say so. Same failure shape as a NaN
 * reading: invisible, and lasts the whole lesson.
 */
function parseThresholds(raw: string | null): ThresholdConfig | null {
  if (!raw) return null
  try {
    const parsed = JSON.parse(raw)
    if (!parsed || typeof parsed !== 'object') return null
    const merged = { ...DEFAULT_THRESHOLDS } as ThresholdConfig
    for (const key of THRESHOLD_KEYS) {
      const value = parsed[key]
      if (typeof value !== 'number' || !Number.isFinite(value)) return null
      merged[key] = value
    }
    // Out-of-order bounds make a band unreachable, so treat them as corrupt
    // rather than loading them and leaving a band that can never show.
    for (let i = 1; i < THRESHOLD_KEYS.length; i++) {
      if (merged[THRESHOLD_KEYS[i]] <= merged[THRESHOLD_KEYS[i - 1]]) return null
    }
    return merged
  } catch {
    return null
  }
}

function parseDelays(raw: string | null): DelayConfig | null {
  if (!raw) return null
  try {
    const parsed = JSON.parse(raw)
    if (!parsed || typeof parsed !== 'object') return null
    const up = parsed.upDelay
    const down = parsed.downDelay
    if (typeof up !== 'number' || !Number.isFinite(up)) return null
    if (typeof down !== 'number' || !Number.isFinite(down)) return null
    return { upDelay: up, downDelay: down }
  } catch {
    return null
  }
}

/** localStorage throws in Safari private browsing and when the quota is full;
 *  losing a setting is not worth taking the page down for. */
function save(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch {
    // Settings will not persist this session. The tool still works.
  }
}

export function useSettings() {
  const [thresholds, setThresholds] = useState<ThresholdConfig>(DEFAULT_THRESHOLDS)
  const [delays, setDelays] = useState<DelayConfig>(DEFAULT_DELAYS)
  const [source, setSource] = useState<ThresholdSource>('default')
  // Mirrors `source` so applyCalibration can read it without being recreated
  // on every change, and without putting a side effect inside a state updater.
  const sourceRef = useRef<ThresholdSource>('default')
  // The room's measured quiet floor, kept so that setLimitFromCurrent can
  // redistribute the lower bounds beneath whatever limit the teacher points at.
  const [floor, setFloor] = useState<number | null>(null)
  const [errors, setErrors] = useState<Partial<Record<keyof ThresholdConfig, string>>>({})

  useEffect(() => {
    try {
      const stored = parseThresholds(localStorage.getItem(THRESHOLDS_KEY))
      if (stored) {
        setThresholds(stored)
        const storedSource = localStorage.getItem(SOURCE_KEY)
        const resolved: ThresholdSource =
          storedSource === 'calibrated' || storedSource === 'manual'
            ? storedSource
            : 'manual'
        sourceRef.current = resolved
        setSource(resolved)
      }
      const storedDelays = parseDelays(localStorage.getItem(DELAYS_KEY))
      if (storedDelays) setDelays(storedDelays)

      const storedFloor = Number(localStorage.getItem(FLOOR_KEY))
      if (Number.isFinite(storedFloor) && storedFloor > 0) setFloor(storedFloor)
    } catch {
      // No storage access at all; defaults stand.
    }
  }, [])

  useEffect(() => { save(THRESHOLDS_KEY, thresholds) }, [thresholds])
  useEffect(() => { save(DELAYS_KEY, delays) }, [delays])
  useEffect(() => {
    sourceRef.current = source
    save(SOURCE_KEY, source)
  }, [source])

  const validateThresholds = (next: ThresholdConfig): boolean => {
    const newErrors: Partial<Record<keyof ThresholdConfig, string>> = {}
    if (next.quietToModerate >= next.moderateToLoud) {
      newErrors.moderateToLoud = 'Must be greater than Quiet→Moderate'
    }
    if (next.moderateToLoud >= next.loudToTooLoud) {
      newErrors.loudToTooLoud = 'Must be greater than Moderate→Loud'
    }
    if (next.loudToTooLoud >= next.alarmTrigger) {
      newErrors.alarmTrigger = 'Must be greater than Loud→Too Loud'
    }
    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const updateThreshold = (key: keyof ThresholdConfig, value: number) => {
    // min/max on a number input is advisory: typing 500, or clearing the field
    // to get Number('') === 0, both reach here otherwise.
    const clamped = Number.isFinite(value) ? Math.min(100, Math.max(0, value)) : 0
    const next = { ...thresholds, [key]: clamped }
    if (validateThresholds(next)) {
      setThresholds(next)
      sourceRef.current = 'manual'
      setSource('manual')
    }
  }

  const updateDelay = (key: keyof DelayConfig, value: number) => {
    setDelays(prev => ({ ...prev, [key]: value }))
  }

  /** Adopt bands measured from the room. Never overrides what a teacher set by
   *  hand -- they came to Settings and chose those numbers. */
  const applyCalibration = useCallback((bands: ThresholdConfig, measuredFloor?: number) => {
    // The floor is worth keeping even when the bands are not: a teacher who
    // set their bands by hand may still want to point at a limit later, and
    // that needs the room's resting level.
    if (typeof measuredFloor === 'number' && Number.isFinite(measuredFloor)) {
      setFloor(measuredFloor)
      save(FLOOR_KEY, measuredFloor)
    }
    if (sourceRef.current === 'manual') return
    sourceRef.current = 'calibrated'
    setThresholds(bands)
    setSource('calibrated')
    setErrors({})
  }, [])

  /**
   * Put the alarm on the level the room is at right now.
   *
   * The one number automatic calibration has to guess is how far above a
   * room's resting level counts as too loud. This replaces the guess with
   * something the teacher observed: they watch the class reach the volume they
   * would intervene at, and press once. The lower bands redistribute beneath
   * it, so the display keeps agreeing with the alarm.
   */
  const setLimitFromCurrent = useCallback((level: number) => {
    if (!Number.isFinite(level) || level <= 0) return
    const base = floor ?? Math.max(0, level - 20)
    const bands = bandsFromFloorAndLimit(base, level)
    sourceRef.current = 'manual'
    setThresholds(bands)
    setSource('manual')
    setErrors({})
  }, [floor])

  const resetThresholds = () => {
    setThresholds(DEFAULT_THRESHOLDS)
    setDelays(DEFAULT_DELAYS)
    sourceRef.current = 'default'
    setSource('default')
    setErrors({})
  }

  const isUsingDefaults =
    source === 'default' &&
    delays.upDelay === DEFAULT_DELAYS.upDelay &&
    delays.downDelay === DEFAULT_DELAYS.downDelay

  return {
    thresholds,
    delays,
    errors,
    source,
    measuredFloor: floor,
    updateThreshold,
    updateDelay,
    applyCalibration,
    setLimitFromCurrent,
    resetThresholds,
    isUsingDefaults
  }
}
