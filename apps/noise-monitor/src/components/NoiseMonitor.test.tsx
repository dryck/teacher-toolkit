/* What NoiseMonitor asks the browser for, which nothing else can see.
 *
 * The microphone constraints and the analyser's dB window decide what the
 * whole scale means, and both were previously left to browser defaults. A
 * wrong value there is invisible: the tool still shows a number, it is just
 * measuring the wrong thing. These are the assertions that keep them honest.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, cleanup, fireEvent, waitFor } from '@testing-library/react'
import { NoiseMonitor } from './NoiseMonitor'
import { DEFAULT_THRESHOLDS, DEFAULT_DELAYS } from '../types'
import { calculateNoiseLevel } from '../utils/noiseCalculator'
import type { SoundSettings } from '../types'

const soundSettings: SoundSettings = {
  alertType: 'sound',
  selectedAlarmSound: 'bell',
  alarmMode: 'oneShot',
  ttsText: 'quiet please',
  ttsMode: 'oneShot'
}

let getUserMedia: ReturnType<typeof vi.fn>
let analyser: Record<string, unknown>

beforeEach(() => {
  analyser = {
    fftSize: 0,
    minDecibels: 0,
    maxDecibels: 0,
    smoothingTimeConstant: 0,
    frequencyBinCount: 128,
    getByteFrequencyData: vi.fn()
  }

  getUserMedia = vi.fn().mockResolvedValue({
    getTracks: () => [{ stop: vi.fn() }]
  })
  Object.defineProperty(navigator, 'mediaDevices', {
    value: { getUserMedia },
    configurable: true
  })

  ;(window as any).AudioContext = class {
    state = 'running'
    sampleRate = 44100
    createAnalyser() { return analyser }
    createMediaStreamSource() { return { connect: vi.fn(), disconnect: vi.fn() } }
    close() { this.state = 'closed' }
  }
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
  // jsdom has no rAF loop worth running; one frame is enough for these.
  vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
    return setTimeout(() => cb(performance.now()), 0) as unknown as number
  })
  vi.stubGlobal('cancelAnimationFrame', (id: number) => clearTimeout(id))
})

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

function monitor(overrides = {}) {
  return (
    <NoiseMonitor
      theme="egg"
      thresholds={DEFAULT_THRESHOLDS}
      selectedSound="bell"
      customSounds={[]}
      customImages={[]}
      isMuted={false}
      upDelay={DEFAULT_DELAYS.upDelay}
      downDelay={DEFAULT_DELAYS.downDelay}
      soundSettings={soundSettings}
      onSettingsClick={vi.fn()}
      onFullscreenClick={vi.fn()}
      onMuteClick={vi.fn()}
      isFullscreen={false}
      {...overrides}
    />
  )
}

function mount(overrides = {}) {
  return render(monitor(overrides))
}

const start = async () => {
  fireEvent.click(screen.getByRole('button', { name: /start monitoring/i }))
  await waitFor(() => expect(getUserMedia).toHaveBeenCalled())
}

describe('what it asks of the microphone', () => {
  it('turns off the three processors that fight a noise measurement', async () => {
    // getUserMedia({ audio: true }) leaves these on. autoGainControl raises
    // the gain in a quiet room and lowers it in a loud one, which is the
    // signal this tool exists to display; noiseSuppression strips the steady
    // hum of a busy class. With them on, the reading describes the browser's
    // voice pipeline rather than the room.
    mount()
    await start()

    const constraints = getUserMedia.mock.calls[0][0]
    expect(constraints.audio, 'audio: true leaves all three enabled').not.toBe(true)
    expect(constraints.audio.autoGainControl).toBe(false)
    expect(constraints.audio.noiseSuppression).toBe(false)
    expect(constraints.audio.echoCancellation).toBe(false)
  })
})

describe('what it asks of the analyser', () => {
  it('pins the dB window that defines the whole scale', async () => {
    // getByteFrequencyData maps minDecibels..maxDecibels onto 0..255, so these
    // two set every threshold's meaning. Left implicit, a browser changing its
    // defaults silently moves every teacher's bands.
    mount()
    await start()

    expect(analyser.minDecibels).toBe(-100)
    expect(analyser.maxDecibels).toBe(-30)
    expect(analyser.smoothingTimeConstant).toBe(0.8)
    expect(analyser.fftSize).toBe(256)
  })
})

describe('calibration', () => {
  // Not driven end-to-end here on purpose. Doing so means faking
  // requestAnimationFrame and performance.now for six seconds of frames, and
  // the result asserts more about the mock than about the app. The derivation
  // itself -- floor percentile, offsets, the ordering and reachability of the
  // bands it produces -- is covered thoroughly in utils/calibration.test.ts,
  // and that it reaches real pages is covered by the repo's e2e suite.
  //
  // An earlier version of this test did run the loop, and could only be made
  // to pass by wrapping its assertions in `if (onCalibrated.mock.calls.length
  // > 0)` -- a test that goes green having checked nothing. Better absent and
  // explained.
  it('is skipped when no handler is given', () => {
    expect(() => mount({ onCalibrated: undefined })).not.toThrow()
  })
})

describe('microphone refusal', () => {
  it('tells the teacher instead of showing a dead display', async () => {
    getUserMedia.mockRejectedValue(new Error('NotAllowedError'))
    mount()
    fireEvent.click(screen.getByRole('button', { name: /start monitoring/i }))
    await waitFor(() =>
      expect(screen.getByText(/microphone access denied/i)).toBeTruthy()
    )
  })
})

/* The band a teacher actually sees, driven from the microphone bytes up.
 *
 * This is the test shape that was missing, and its absence is why the bands
 * were wrong in a tool with 119 passing tests. getNoiseBand was covered in
 * isolation -- but by a test written from the same misreading as the code, so
 * the two agreed with each other and both disagreed with the Settings panel.
 * Nothing crossed from a microphone reading to a rendered band, which is the
 * only place the disagreement was visible, and the only place a teacher looks.
 *
 * So these assertions name the expected band from the *panel's* semantics --
 * each bound is the lower edge of the band it names, which is what the sliders
 * are labelled and what their descriptions say -- rather than from anything
 * the module computes.
 */
describe('the band the display reaches, from the microphone up', () => {
  // All bins set to the same byte: calculateNoiseLevel's RMS over equal bins
  // is that byte, scaled by 100/128. So one byte per target level.
  const byteForLevel = (level: number) => Math.round(level * 1.28)

  function feed(level: number) {
    const byte = byteForLevel(level)
    ;(analyser.getByteFrequencyData as ReturnType<typeof vi.fn>).mockImplementation(
      (array: Uint8Array) => array.fill(byte)
    )
  }

  let play: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    // jsdom's play() throws "Not implemented"; this also makes the alarm
    // observable, which is the second half of what these cases check.
    play = vi
      .spyOn(window.HTMLMediaElement.prototype, 'play')
      .mockResolvedValue(undefined)
    vi.useFakeTimers({
      toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval', 'performance', 'Date']
    })
    // Re-stub against the fake clock so advancing time runs frames.
    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) =>
      setTimeout(() => cb(performance.now()), 16) as unknown as number
    )
    vi.stubGlobal('cancelAnimationFrame', (id: number) => clearTimeout(id))
  })

  afterEach(() => {
    vi.useRealTimers()
    play.mockRestore()
  })

  /** Start listening at `level`, then let the EMA settle and the up-delay
   *  commit. 4s is well past both: the smoothing time constant is 0.3s and
   *  the default up delay 2s. */
  async function settleAt(level: number, overrides = {}) {
    feed(level)
    mount(overrides)
    fireEvent.click(screen.getByRole('button', { name: /start monitoring/i }))
    // getUserMedia resolves on a microtask, which fake timers do not hold up.
    await vi.advanceTimersByTimeAsync(0)
    expect(getUserMedia).toHaveBeenCalled()
    await vi.advanceTimersByTimeAsync(4000)
  }

  const statusText = () =>
    screen.getByText(/quiet|moderate|loud|too loud/i).textContent

  it('feeds the level the test intends', () => {
    // The harness itself, so a wrong byte cannot quietly make every case
    // below assert about a different level than it names.
    const bins = new Uint8Array(128)
    feed(45)
    ;(analyser.getByteFrequencyData as ReturnType<typeof vi.fn>).mock.calls.length
    ;(analyser.getByteFrequencyData as any)(bins)
    expect(calculateNoiseLevel(bins)).toBeCloseTo(45, 0)
  })

  // Defaults are 40 / 55 / 70 / 85.
  it('stays on band 1 below the first bound', async () => {
    await settleAt(30)
    expect(statusText()).toMatch(/^Quiet$/)
  })

  it('reaches band 2 just above the bound the panel marks "2"', async () => {
    // The reported symptom, as a test: 45 is past the panel's "2" marker at
    // 40, so the display has to be on band 2. It was on band 1 until 55.
    await settleAt(45)
    expect(statusText()).toMatch(/^Moderate$/)
  })

  it('reaches band 3 above the second bound', async () => {
    await settleAt(60)
    expect(statusText()).toMatch(/^Loud$/)
  })

  it('reaches band 4 above the third bound, without sounding the alarm', async () => {
    // The warning gap the fourth bound exists for: the display says too loud
    // at 70, and the alarm waits for 85. Previously band 4 and the alarm were
    // the same point, so the display could not warn ahead of the sound.
    await settleAt(75)
    expect(statusText()).toMatch(/Too Loud/)
    expect(play, 'alarm sounded 10 below the alarm point').not.toHaveBeenCalled()
  })

  it('sounds the alarm above the alarm point', async () => {
    await settleAt(90)
    expect(statusText()).toMatch(/Too Loud/)
    expect(play).toHaveBeenCalled()
  })

  it('moves the band when only the bound for that band moves', async () => {
    // One slider, one effect. quietToModerate was referenced nowhere in the
    // app, so this is the case that proves it now reaches the display.
    await settleAt(45, {
      thresholds: { ...DEFAULT_THRESHOLDS, quietToModerate: 50 }
    })
    expect(statusText()).toMatch(/^Quiet$/)
  })

  // Not asserted here: that the pill and the picture name the same band.
  // They read the same `band` constant, so a test could only restate that
  // expression -- and the alternative, a data-testid in every theme's markup,
  // is production code existing for a test. The themes' own suite covers each
  // one rendering all four bands distinctly, which is the half that can break.
})

/* The alarm latches until a teacher acknowledges it.
 *
 * Reported from use: the alarm was over almost as soon as it started. It
 * cleared itself on the next downward commit, so its length was however long
 * the room stayed loud -- and since the down delay (2-4s) is shorter than the
 * alarm sounds (the bell is 2s), stopAlerts() paused the audio part-way
 * through. A brief eruption produced a clipped noise and a mended egg.
 */
describe('the alarm, once raised', () => {
  const byteForLevel = (level: number) => Math.round(level * 1.28)

  function feed(level: number) {
    ;(analyser.getByteFrequencyData as ReturnType<typeof vi.fn>).mockImplementation(
      (array: Uint8Array) => array.fill(byteForLevel(level))
    )
  }

  let play: ReturnType<typeof vi.spyOn>
  let pause: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    play = vi.spyOn(window.HTMLMediaElement.prototype, 'play').mockResolvedValue(undefined)
    pause = vi.spyOn(window.HTMLMediaElement.prototype, 'pause').mockImplementation(() => {})
    vi.useFakeTimers({
      toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval', 'performance', 'Date']
    })
    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) =>
      setTimeout(() => cb(performance.now()), 16) as unknown as number
    )
    vi.stubGlobal('cancelAnimationFrame', (id: number) => clearTimeout(id))
  })

  afterEach(() => {
    vi.useRealTimers()
    play.mockRestore()
    pause.mockRestore()
  })

  /** Raise the alarm: start loud enough to pass alarmTrigger (85) and let the
   *  up delay commit. */
  async function raiseAlarm(overrides = {}) {
    feed(95)
    const rendered = mount(overrides)
    fireEvent.click(screen.getByRole('button', { name: /start monitoring/i }))
    await vi.advanceTimersByTimeAsync(0)
    await vi.advanceTimersByTimeAsync(4000)
    expect(play, 'the alarm never sounded, so there is nothing to latch').toHaveBeenCalled()
    return rendered
  }

  /** Drop the room to `level` and wait out the down delay (4s) and then some. */
  async function calmTo(level: number) {
    feed(level)
    await vi.advanceTimersByTimeAsync(10000)
  }

  const resetButton = () => screen.queryByRole('button', { name: /^reset$/i })
  const status = () => screen.getByText(/quiet|moderate|loud|too loud/i).textContent

  it('stays raised after the room goes quiet', async () => {
    await raiseAlarm()
    await calmTo(10)
    expect(status()).toMatch(/Too Loud/)
    expect(resetButton(), 'no way to clear a latched alarm').toBeTruthy()
  })

  it('does not cut the sound short when the level drops', async () => {
    // The direct cause of "the alarm is too short to notice": stopAlerts()
    // called pause() on a sound still playing.
    await raiseAlarm()
    pause.mockClear()
    await calmTo(10)
    expect(pause, 'the alarm was paused by the room quietening').not.toHaveBeenCalled()
  })

  it('offers no reset button before the alarm has been raised', async () => {
    feed(45)
    mount()
    fireEvent.click(screen.getByRole('button', { name: /start monitoring/i }))
    await vi.advanceTimersByTimeAsync(0)
    await vi.advanceTimersByTimeAsync(4000)
    expect(resetButton()).toBeNull()
  })

  it('clears on the reset button, and the display follows the room again', async () => {
    await raiseAlarm()
    await calmTo(10)
    fireEvent.click(resetButton() as HTMLElement)
    expect(resetButton()).toBeNull()
    expect(status()).toMatch(/^Quiet$/)
  })

  it('does not re-announce itself when the room dips and surges again', async () => {
    // The class drops below the alarm point and comes back before anyone has
    // pressed reset. 75 is band 4 but under the alarm, so this genuinely
    // commits down and back up.
    //
    // Three layers independently prevent the re-announcement -- the latch
    // guard here, useAudio's one-shot flag, useTTS's -- so removing any one of
    // them leaves this green. It is kept as a statement of the behaviour a
    // teacher relies on, not as cover for a particular line.
    await raiseAlarm()
    const callsAfterRaise = play.mock.calls.length
    await calmTo(75)
    feed(95)
    await vi.advanceTimersByTimeAsync(6000)
    expect(play.mock.calls.length).toBe(callsAfterRaise)
    expect(resetButton(), 'the latch should have been held throughout').toBeTruthy()
  })

  it('does not re-break the egg immediately when reset in a still-loud room', async () => {
    // Pressing reset mid-shout and watching it fire again a moment later reads
    // as a broken button. It re-arms instead: the alarm returns once the room
    // has dropped below the alarm point and risen through it again.
    await raiseAlarm()
    play.mockClear()
    fireEvent.click(resetButton() as HTMLElement)
    await vi.advanceTimersByTimeAsync(10000)
    expect(play, 'the alarm re-fired without the room ever calming').not.toHaveBeenCalled()
    expect(resetButton()).toBeNull()
  })

  it('re-arms: fires again after the room falls and climbs back', async () => {
    await raiseAlarm()
    fireEvent.click(resetButton() as HTMLElement)
    play.mockClear()
    await calmTo(20)
    feed(95)
    await vi.advanceTimersByTimeAsync(6000)
    expect(play, 'the alarm never came back').toHaveBeenCalled()
    expect(resetButton()).toBeTruthy()
  })

  it('is silenced by mute, but stays latched', async () => {
    // Mute is the first thing a teacher reaches for, and it must not count as
    // acknowledging the alarm: the egg stays broken until someone resets it.
    const { rerender } = await raiseAlarm()
    pause.mockClear()
    rerender(monitor({ isMuted: true }))
    await vi.advanceTimersByTimeAsync(100)
    expect(pause, 'mute did not stop the sound').toHaveBeenCalled()
    expect(resetButton(), 'mute cleared the latch').toBeTruthy()
  })

  it('shows the top band while latched, not the calm room behind it', async () => {
    // A broken egg on a green background is the display disagreeing with
    // itself. The band underneath keeps tracking, so reset is immediate.
    await raiseAlarm()
    await calmTo(10)
    expect(status()).toMatch(/Too Loud/)
    fireEvent.click(resetButton() as HTMLElement)
    expect(status()).toMatch(/^Quiet$/)
  })
})
