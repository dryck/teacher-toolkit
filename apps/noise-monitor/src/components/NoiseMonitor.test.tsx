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

function mount(overrides = {}) {
  return render(
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
