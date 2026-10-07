export type Theme = 'egg' | 'eggClassic' | 'glass' | 'custom' | 'thermometer' | 'battery' | 'weather' | 'volcano'

export type AlarmMode = 'oneShot' | 'repeat'
export type TTSMode = 'oneShot' | 'repeat'
// Which alert actually plays when the noise level reaches "Too Loud":
// the built-in sound, the spoken message, or both together (the old,
// implicit behavior -- both always fired with no way to pick just one).
export type AlertType = 'sound' | 'voice' | 'both'

export interface SoundSettings {
  alertType: AlertType
  selectedAlarmSound: string
  alarmMode: AlarmMode
  ttsText: string
  ttsMode: TTSMode
  ttsApiKey?: string
  ttsVoiceId?: string
}

export const DEFAULT_SOUND_SETTINGS: SoundSettings = {
  alertType: 'sound',
  selectedAlarmSound: 'bell',
  alarmMode: 'oneShot',
  ttsText: 'Please be quiet!',
  ttsMode: 'oneShot',
  ttsApiKey: '',
  ttsVoiceId: 'Xb7hH8MSUJpSbSDYk0k2',
}

export interface Sound {
  id: string
  name: string
  url: string
  isBuiltIn: boolean
}

export interface CustomImage {
  id: string
  name: string
  url: string
  lowThresholdUrl?: string
  highThresholdUrl?: string
}

export interface NoiseLevel {
  value: number
  isTooLoud: boolean
}

/** Which of the teacher's four bands the room is in. */
export type NoiseBand = 'quiet' | 'moderate' | 'loud' | 'tooLoud'

/**
 * What every theme is given. There used to be two contracts: this one, taking
 * noiseLevel and threshold, and a NewThemeProps taking a ready-made band.
 * NoiseMonitor built both and handed each theme whichever it wanted.
 *
 * That split had a cost beyond the awkwardness. Each of the four themes on the
 * old contract re-derived the bands itself, from `noiseLevel / threshold`
 * against hardcoded 0.5 and 0.8 ratios -- four more copies of the logic that
 * ignored three of the teacher's four sliders. So even after the alarm was
 * fixed to honour all four, the *display* did not: set "loud" to 60 and the
 * alarm obeyed while the egg stayed green until 42.5.
 *
 * One contract now, with the band decided once by getNoiseBand.
 */
export interface ThemeProps {
  /** Decided by getNoiseBand from all four configured bounds. */
  band: NoiseBand
  /**
   * How close the room is to the alarm, as a ratio: 1 means at it, and the
   * value is allowed above 1. For fill heights and wobble, where a theme
   * wants to move continuously rather than step between bands.
   */
  intensity: number
  /**
   * Whether the alert is currently raised. Not the same as band === 'tooLoud':
   * the transition delay can hold this on after the level has dropped back,
   * which is the point of the delay.
   */
  isTooLoud: boolean
  customImages: CustomImage[]
  backgroundColor?: string
}

// The four band bounds, as points on the relative 0-100 index that
// calculateNoiseLevel produces. Not decibels: see noiseCalculator.ts for why
// a browser cannot give an absolute sound-pressure reading.
export interface ThresholdConfig {
  quietToModerate: number
  moderateToLoud: number
  loudToTooLoud: number
  alarmTrigger: number
}

// These were the WHO classroom dB(A) guideline figures (40/55/70/85) used
// directly as index values, which does not follow -- the index has no
// relationship to sound pressure, so the numbers carried none of the meaning
// their source gave them. They are kept as starting points because they are
// sensibly spaced, and because changing them would silently move every
// teacher's thresholds.
//
// They still want tuning against a real microphone in a real room: the index
// depends on the mic, its placement and the OS mixer. 85 in particular is
// only reached when the input is close to the analyser's ceiling.
export const DEFAULT_THRESHOLDS: ThresholdConfig = {
  quietToModerate: 40,
  moderateToLoud: 55,
  loudToTooLoud: 70,
  alarmTrigger: 85
}

// Delay settings for noise level transitions
export interface DelayConfig {
  upDelay: number   // seconds before increasing noise level
  downDelay: number // seconds before decreasing noise level
}

export const DEFAULT_DELAYS: DelayConfig = {
  upDelay: 2,
  downDelay: 4
}
