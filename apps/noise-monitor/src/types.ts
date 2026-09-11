export type Theme = 'egg' | 'eggClassic' | 'glass' | 'custom' | 'thermometer' | 'battery' | 'weather' | 'volcano'

export type AlarmMode = 'oneShot' | 'repeat'
export type TTSMode = 'oneShot' | 'repeat'

export interface SoundSettings {
  selectedAlarmSound: string
  alarmMode: AlarmMode
  ttsText: string
  ttsMode: TTSMode
  ttsApiKey?: string
  ttsVoiceId?: string
}

export const DEFAULT_SOUND_SETTINGS: SoundSettings = {
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

export interface ThemeProps {
  noiseLevel: number
  threshold: number
  isTooLoud: boolean
  customImages: CustomImage[]
  backgroundColor?: string
}

// Props for new themes that use 'level' instead of noiseLevel/threshold
export interface NewThemeProps {
  level: 'quiet' | 'moderate' | 'loud' | 'tooLoud'
  intensity?: number
}

// Threshold configuration for adjustable noise levels
export interface ThresholdConfig {
  quietToModerate: number
  moderateToLoud: number
  loudToTooLoud: number
  alarmTrigger: number
}

// WHO recommendations for classroom noise levels (in dB)
export const WHO_RECOMMENDATIONS: ThresholdConfig = {
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
