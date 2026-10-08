// Generates the alarm sounds as WAV data URLs, so the app ships no audio files.
//
// These three functions each used to open their own AudioContext and never
// close it -- three leaked on mount. Browsers cap how many a page may have
// open (around six in Chrome), which packages/shell/audio.js documents from
// the time it killed audio part-way through a lesson in the static tools.
//
// They only ever need the context for `sampleRate` and `createBuffer`, so one
// shared OfflineAudioContext does the job: it is purely computational and
// never takes a hardware output slot, so it cannot contribute to that cap.
let offlineCtx: OfflineAudioContext | null = null

function bufferContext(): OfflineAudioContext {
  if (!offlineCtx) {
    const Ctor =
      window.OfflineAudioContext || (window as any).webkitOfflineAudioContext
    offlineCtx = new Ctor(1, 1, 44100)
  }
  return offlineCtx
}

export function generateBellSound(): string {
  const audioContext = bufferContext()
  const duration = 2
  const sampleRate = audioContext.sampleRate
  const buffer = audioContext.createBuffer(1, duration * sampleRate, sampleRate)
  const data = buffer.getChannelData(0)
  
  for (let i = 0; i < buffer.length; i++) {
    const t = i / sampleRate
    // Bell sound: multiple harmonics with exponential decay
    const fundamental = Math.sin(2 * Math.PI * 523.25 * t) * Math.exp(-t * 2)
    const harmonic2 = Math.sin(2 * Math.PI * 1046.5 * t) * Math.exp(-t * 3) * 0.5
    const harmonic3 = Math.sin(2 * Math.PI * 1569.75 * t) * Math.exp(-t * 4) * 0.25
    data[i] = (fundamental + harmonic2 + harmonic3) * 0.3
  }
  
  return bufferToWave(buffer, duration * sampleRate)
}

export function generateChimeSound(): string {
  const audioContext = bufferContext()
  const duration = 1.5
  const sampleRate = audioContext.sampleRate
  const buffer = audioContext.createBuffer(1, duration * sampleRate, sampleRate)
  const data = buffer.getChannelData(0)
  
  for (let i = 0; i < buffer.length; i++) {
    const t = i / sampleRate
    // Gentle chime
    const tone = Math.sin(2 * Math.PI * 880 * t) * Math.exp(-t * 1.5)
    const overtone = Math.sin(2 * Math.PI * 1760 * t) * Math.exp(-t * 2) * 0.3
    data[i] = (tone + overtone) * 0.25
  }
  
  return bufferToWave(buffer, duration * sampleRate)
}

export function generateBuzzSound(): string {
  const audioContext = bufferContext()
  const duration = 1
  const sampleRate = audioContext.sampleRate
  const buffer = audioContext.createBuffer(1, duration * sampleRate, sampleRate)
  const data = buffer.getChannelData(0)
  
  for (let i = 0; i < buffer.length; i++) {
    const t = i / sampleRate
    // Buzzer sound: sawtooth wave
    const saw = (2 * (t * 220 % 1) - 1) * Math.exp(-t * 4)
    data[i] = saw * 0.2
  }
  
  return bufferToWave(buffer, duration * sampleRate)
}

/**
 * The three built-in alarm sounds, as blob URLs, generated once per page.
 *
 * Each generator calls URL.createObjectURL, so calling them repeatedly leaks a
 * blob every time. useAudio generated all three on mount and Settings wanted
 * them too; caching here means one set exists for the page's lifetime, which
 * is right for sounds that may be played at any moment -- there is nothing to
 * revoke and no window in which the alarm has no sound to play.
 */
let generatedUrls: Record<string, string> | null = null

export function getGeneratedSoundUrls(): Record<string, string> {
  if (!generatedUrls) {
    generatedUrls = {
      bell: generateBellSound(),
      chime: generateChimeSound(),
      buzz: generateBuzzSound()
    }
  }
  return generatedUrls
}

function bufferToWave(abuffer: AudioBuffer, len: number): string {
  const numOfChan = abuffer.numberOfChannels
  const length = len * numOfChan * 2 + 44
  const buffer = new ArrayBuffer(length)
  const view = new DataView(buffer)
  const channels: Float32Array[] = []
  let sample: number
  let offset = 0
  let pos = 0

  // write WAVE header
  setUint32(0x46464952) // "RIFF"
  setUint32(length - 8) // file length - 8
  setUint32(0x45564157) // "WAVE"

  setUint32(0x20746d66) // "fmt " chunk
  setUint32(16) // length = 16
  setUint16(1) // PCM (uncompressed)
  setUint16(numOfChan)
  setUint32(abuffer.sampleRate)
  setUint32(abuffer.sampleRate * 2 * numOfChan) // avg. bytes/sec
  setUint16(numOfChan * 2) // block-align
  setUint16(16) // 16-bit (hardcoded in this demo)

  setUint32(0x61746164) // "data" - chunk
  setUint32(length - pos - 4) // chunk length

  // write interleaved data
  for (let i = 0; i < abuffer.numberOfChannels; i++)
    channels.push(abuffer.getChannelData(i))

  while (pos < length) {
    for (let i = 0; i < numOfChan; i++) {
      sample = Math.max(-1, Math.min(1, channels[i][offset])) // clamp
      sample = (0.5 + sample < 0 ? sample * 32768 : sample * 32767)|0 // scale to 16-bit signed int
      view.setInt16(pos, sample, true) // write 16-bit sample
      pos += 2
    }
    offset++ // next source sample
  }

  // create Blob
  return URL.createObjectURL(new Blob([buffer], { type: 'audio/wav' }))

  function setUint16(data: number) {
    view.setUint16(pos, data, true)
    pos += 2
  }

  function setUint32(data: number) {
    view.setUint32(pos, data, true)
    pos += 4
  }
}
