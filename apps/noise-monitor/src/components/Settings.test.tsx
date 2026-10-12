/* The Settings panel's contract with the teacher.
 *
 * Three of these guard claims the panel used to make and not keep: that the
 * number is in decibels, that the thresholds it validates have any effect, and
 * that "Test Alarm" tests the alarm.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, cleanup, fireEvent } from '@testing-library/react'
import { SettingsPanel } from './Settings'
import { DEFAULT_THRESHOLDS, DEFAULT_DELAYS } from '../types'
import type { SoundSettings } from '../types'
import type { ThresholdSource } from '../hooks/useSettings'

const soundSettings: SoundSettings = {
  alertType: 'sound',
  selectedAlarmSound: 'bell',
  alarmMode: 'oneShot',
  ttsText: 'Please be quiet',
  ttsMode: 'oneShot'
}

function setup(overrides: Partial<Parameters<typeof SettingsPanel>[0]> = {}) {
  const updateThreshold = vi.fn()
  const props = {
    currentTheme: 'egg' as const,
    customImages: [],
    soundSettings,
    noiseLevel: 42,
    thresholds: DEFAULT_THRESHOLDS,
    delays: DEFAULT_DELAYS,
    errors: {},
    source: 'calibrated' as ThresholdSource,
    onUseCurrentAsLimit: vi.fn(),
    updateThreshold,
    updateDelay: vi.fn(),
    resetThresholds: vi.fn(),
    isUsingDefaults: false,
    onThemeChange: vi.fn(),
    onSoundSettingsChange: vi.fn(),
    onClose: vi.fn(),
    ...overrides
  }
  const utils = render(<SettingsPanel {...props} />)
  return { ...utils, updateThreshold, props }
}

/** The panel opens on Themes; the thresholds live behind their own tab. */
function openThresholds() {
  fireEvent.click(screen.getByRole('button', { name: /threshold/i }))
}

beforeEach(() => {
  // getGeneratedSoundUrls reaches for OfflineAudioContext, which jsdom lacks.
  ;(window as any).OfflineAudioContext = class {
    sampleRate = 44100
    createBuffer(channels: number, length: number) {
      return {
        numberOfChannels: channels,
        length,
        sampleRate: 44100,
        getChannelData: () => new Float32Array(length)
      }
    }
  }
  ;(URL as any).createObjectURL = vi.fn(() => 'blob:generated')
})

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

describe('the scale is not presented as decibels', () => {
  it('never renders a dB unit', () => {
    // The panel used to put "dB" on every threshold input, on the live bar's
    // axis, in four band descriptions, and in a readout that printed the same
    // number twice as "42.0% (42.0 dB)". The index is relative to the
    // microphone's full scale; there is no route from it to sound pressure.
    const { container } = setup()
    openThresholds()
    expect(container.textContent).not.toMatch(/\bdB\b/)
  })

  it('does not cite WHO guidance against an uncalibrated index', () => {
    const { container } = setup()
    openThresholds()
    expect(container.textContent).not.toMatch(/WHO/)
  })

  it('shows the live level once, not as two different units', () => {
    const { container } = setup({ noiseLevel: 42 })
    openThresholds()
    expect(container.textContent).not.toMatch(/42\.0.*42\.0/)
  })
})

describe('where the bands came from', () => {
  it.each([
    ['calibrated' as ThresholdSource, /measured from this room/i],
    ['manual' as ThresholdSource, /set by hand/i],
    ['default' as ThresholdSource, /not yet measured/i]
  ])('reports %s', (source, expected) => {
    setup({ source })
    openThresholds()
    expect(screen.getByText(expected)).toBeTruthy()
  })
})

describe('threshold inputs', () => {
  it('reports an out-of-range entry to the handler as a number', () => {
    // min/max on <input type="number"> is advisory, so 500 does reach the
    // handler. The clamping itself lives in useSettings and is tested there --
    // this only pins that the panel parses and forwards rather than swallowing.
    const { updateThreshold } = setup()
    openThresholds()
    const inputs = screen.getAllByRole('spinbutton')
    fireEvent.change(inputs[0], { target: { value: '500' } })
    expect(updateThreshold).toHaveBeenCalled()
    const calls = updateThreshold.mock.calls
    const [key, value] = calls[calls.length - 1]
    expect(key).toBe('quietToModerate')
    expect(value).toBe(500)
  })

  it('forwards a cleared field as 0, not NaN', () => {
    const { updateThreshold } = setup()
    openThresholds()
    fireEvent.change(screen.getAllByRole('spinbutton')[0], { target: { value: '' } })
    const calls = updateThreshold.mock.calls
    const [, value] = calls[calls.length - 1]
    expect(Number.isNaN(value)).toBe(false)
  })

  it('surfaces an ordering error next to the offending field', () => {
    setup({ errors: { alarmTrigger: 'Must be greater than Loud→Too Loud' } })
    openThresholds()
    expect(screen.getByText(/Must be greater than/)).toBeTruthy()
  })
})

describe('setting the limit from the room', () => {
  it('offers the current level as the "too loud" point', () => {
    const onUseCurrentAsLimit = vi.fn()
    setup({ noiseLevel: 63, onUseCurrentAsLimit })
    openThresholds()
    fireEvent.click(screen.getByRole('button', { name: /use the current level/i }))
    expect(onUseCurrentAsLimit).toHaveBeenCalledWith(63)
  })

  it('shows the level it would use, so the number is not a mystery', () => {
    setup({ noiseLevel: 63 })
    openThresholds()
    expect(screen.getByRole('button', { name: /\(63\)/ })).toBeTruthy()
  })

  it('is unavailable until the monitor is running', () => {
    // Without a live reading there is nothing to point at, and 0 would place
    // the alarm at the bottom of the scale.
    const onUseCurrentAsLimit = vi.fn()
    setup({ noiseLevel: 0, onUseCurrentAsLimit })
    openThresholds()
    const button = screen.getByRole('button', { name: /start the monitor to set the limit/i })
    expect(button).toHaveProperty('disabled', true)
    fireEvent.click(button)
    expect(onUseCurrentAsLimit).not.toHaveBeenCalled()
  })
})

describe('Test Alarm', () => {
  it('plays the selected sound rather than a synthesised beep', async () => {
    // It used to build a bare oscillator in a fresh AudioContext on every
    // press -- so it did not test the alarm, and died after about six presses
    // once the browser's context limit was hit.
    const play = vi.fn().mockResolvedValue(undefined)
    const audioSpy = vi
      .spyOn(window, 'Audio')
      .mockImplementation(() => ({ play, src: '', currentTime: 0 }) as any)
    const audioContextSpy = vi.fn()
    ;(window as any).AudioContext = audioContextSpy

    setup()
    fireEvent.click(screen.getByRole('button', { name: /sound|alarm/i }))

    // getByRole, not queryByRole-and-if: a missing button has to fail the
    // test rather than let it pass having asserted nothing.
    const testButton = screen.getByRole('button', { name: /test alarm/i })
    fireEvent.click(testButton)

    expect(play).toHaveBeenCalled()
    expect(audioContextSpy, 'opened a new AudioContext per press again').not.toHaveBeenCalled()
    audioSpy.mockRestore()
  })
})

describe('the live bar markers', () => {
  /* The bar is where the disagreement was visible: the markers sat at the four
   * bounds while the picture used them one slot higher, so the bar could be
   * past marker 2 with the display still on band 1. These pin the markers to
   * the bounds, and getNoiseBand's own suite pins the bands to the same
   * numbers -- so neither half can move without the other failing.
   */
  const marker = (label: string) => {
    const span = screen.getByText(label, { selector: 'span' })
    const line = span.parentElement as HTMLElement
    return parseFloat(line.style.left)
  }

  it('puts each band marker on the bound that starts that band', () => {
    const thresholds = {
      quietToModerate: 22,
      moderateToLoud: 47,
      loudToTooLoud: 61,
      alarmTrigger: 88
    }
    setup({ thresholds })
    openThresholds()

    expect(marker('2')).toBeCloseTo(thresholds.quietToModerate, 5)
    expect(marker('3')).toBeCloseTo(thresholds.moderateToLoud, 5)
    expect(marker('4')).toBeCloseTo(thresholds.loudToTooLoud, 5)
  })

  it('marks the alarm point separately from the top band', () => {
    // Not the same place any more: the display reaches "too loud" at marker 4
    // and the alarm fires here. With only three markers a teacher would read
    // the last one as the point the sound goes off.
    const thresholds = { ...DEFAULT_THRESHOLDS, loudToTooLoud: 70, alarmTrigger: 88 }
    setup({ thresholds })
    openThresholds()

    expect(marker('!')).toBeCloseTo(88, 5)
    expect(marker('!')).toBeGreaterThan(marker('4'))
  })

  it('keeps a marker on the bar when a bound is out of range', () => {
    // updateThreshold clamps, but a config restored from an older build can
    // still carry anything; left: 140% puts the line outside the track.
    setup({ thresholds: { ...DEFAULT_THRESHOLDS, alarmTrigger: 140 } })
    openThresholds()
    expect(marker('!')).toBe(100)
  })
})

describe('what the threshold descriptions promise', () => {
  it('describes all four bounds in terms that now hold', () => {
    // Every one of these sentences was false for three of the four sliders:
    // the panel described bounds the display did not use. Asserting the text
    // is thin on its own -- the point is that these are the sentences the band
    // tests were written from, so the code and the copy have one source.
    setup()
    openThresholds()
    expect(screen.getByText(/below this, the room counts as quiet/i)).toBeTruthy()
    expect(screen.getByText(/above this, the display shows "loud"/i)).toBeTruthy()
    expect(screen.getByText(/above this, the display shows "too loud"/i)).toBeTruthy()
    expect(screen.getByText(/above this, the alarm sounds/i)).toBeTruthy()
  })
})

describe('the timed alarm reset', () => {
  const field = () =>
    screen.getByLabelText(/reset after/i) as HTMLInputElement

  it('shows the hold the teacher has set', () => {
    setup({ delays: { ...DEFAULT_DELAYS, autoResetSeconds: 30 } })
    openThresholds()
    expect(field().value).toBe('30')
    expect(screen.getByText(/clears itself after 30 seconds/i)).toBeTruthy()
  })

  it('says plainly that 0 means the alarm waits for Reset', () => {
    // 0 in a seconds field reads as "immediately" unless the panel says
    // otherwise, and this one means the opposite.
    setup({ delays: { ...DEFAULT_DELAYS, autoResetSeconds: 0 } })
    openThresholds()
    expect(screen.getByText(/stays until you press Reset/i)).toBeTruthy()
  })

  it('forwards what was typed as a number', () => {
    const updateDelay = vi.fn()
    setup({ updateDelay })
    openThresholds()
    fireEvent.change(field(), { target: { value: '45' } })
    expect(updateDelay).toHaveBeenCalledWith('autoResetSeconds', 45)
  })

  it('forwards a cleared field as 0, not NaN', () => {
    // Number('') is 0, which useSettings reads as "off". NaN would reach the
    // hold timer and fire it immediately.
    const updateDelay = vi.fn()
    setup({ updateDelay })
    openThresholds()
    fireEvent.change(field(), { target: { value: '' } })
    expect(updateDelay).toHaveBeenCalledWith('autoResetSeconds', 0)
  })
})
