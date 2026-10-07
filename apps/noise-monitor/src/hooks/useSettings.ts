import { useState, useEffect } from 'react'
import { ThresholdConfig, DEFAULT_THRESHOLDS, DelayConfig, DEFAULT_DELAYS } from '../types'

const THRESHOLDS_KEY = 'noise-monitor-thresholds'
const DELAYS_KEY = 'noise-monitor-delays'

export function useSettings() {
  const [thresholds, setThresholds] = useState<ThresholdConfig>(DEFAULT_THRESHOLDS)
  const [delays, setDelays] = useState<DelayConfig>(DEFAULT_DELAYS)
  const [errors, setErrors] = useState<Partial<Record<keyof ThresholdConfig, string>>>({})

  // Load from localStorage on mount
  useEffect(() => {
    const storedThresholds = localStorage.getItem(THRESHOLDS_KEY)
    if (storedThresholds) {
      try {
        const parsed = JSON.parse(storedThresholds)
        setThresholds(parsed)
      } catch {
        // Invalid stored data, use defaults
      }
    }
    const storedDelays = localStorage.getItem(DELAYS_KEY)
    if (storedDelays) {
      try {
        const parsed = JSON.parse(storedDelays)
        setDelays(parsed)
      } catch {
        // Invalid stored data, use defaults
      }
    }
  }, [])

  // Save to localStorage on change
  useEffect(() => {
    localStorage.setItem(THRESHOLDS_KEY, JSON.stringify(thresholds))
  }, [thresholds])

  useEffect(() => {
    localStorage.setItem(DELAYS_KEY, JSON.stringify(delays))
  }, [delays])

  const validateThresholds = (newThresholds: ThresholdConfig): boolean => {
    const newErrors: Partial<Record<keyof ThresholdConfig, string>> = {}
    
    if (newThresholds.quietToModerate >= newThresholds.moderateToLoud) {
      newErrors.moderateToLoud = 'Must be greater than Quiet→Moderate'
    }
    if (newThresholds.moderateToLoud >= newThresholds.loudToTooLoud) {
      newErrors.loudToTooLoud = 'Must be greater than Moderate→Loud'
    }
    if (newThresholds.loudToTooLoud >= newThresholds.alarmTrigger) {
      newErrors.alarmTrigger = 'Must be greater than Loud→Too Loud'
    }
    
    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const updateThreshold = (key: keyof ThresholdConfig, value: number) => {
    const newThresholds = { ...thresholds, [key]: value }
    if (validateThresholds(newThresholds)) {
      setThresholds(newThresholds)
    }
  }

  const updateDelay = (key: keyof DelayConfig, value: number) => {
    setDelays(prev => ({ ...prev, [key]: value }))
  }

  const resetThresholds = () => {
    setThresholds(DEFAULT_THRESHOLDS)
    setDelays(DEFAULT_DELAYS)
    setErrors({})
  }

  const isUsingDefaults = 
    thresholds.quietToModerate === DEFAULT_THRESHOLDS.quietToModerate &&
    thresholds.moderateToLoud === DEFAULT_THRESHOLDS.moderateToLoud &&
    thresholds.loudToTooLoud === DEFAULT_THRESHOLDS.loudToTooLoud &&
    thresholds.alarmTrigger === DEFAULT_THRESHOLDS.alarmTrigger &&
    delays.upDelay === DEFAULT_DELAYS.upDelay &&
    delays.downDelay === DEFAULT_DELAYS.downDelay

  return {
    thresholds,
    delays,
    errors,
    updateThreshold,
    updateDelay,
    resetThresholds,
    isUsingDefaults
  }
}
