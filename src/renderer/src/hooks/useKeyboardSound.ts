let ctx: AudioContext | null = null

function getCtx(): AudioContext {
  if (!ctx) ctx = new AudioContext()
  if (ctx.state === 'suspended') ctx.resume()
  return ctx
}

let _enabled = true

export function setKeyboardSoundEnabled(v: boolean) {
  _enabled = v
}

export function isKeyboardSoundEnabled() {
  return _enabled
}

function rand(a: number, b: number) {
  return a + Math.random() * (b - a)
}

export function playClick() {
  if (!_enabled) return
  const c = getCtx()
  const now = c.currentTime + 0.02

  const vary = 0.9 + Math.random() * 0.2

  const osc1 = c.createOscillator()
  osc1.type = 'triangle'
  osc1.frequency.setValueAtTime(120 * vary, now)
  osc1.frequency.exponentialRampToValueAtTime(80 * vary, now + 0.05)
  const gain1 = c.createGain()
  gain1.gain.setValueAtTime(0.08, now)
  gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.05)
  osc1.connect(gain1).connect(c.destination)
  osc1.start(now)
  osc1.stop(now + 0.05)

  const osc2 = c.createOscillator()
  osc2.type = 'sine'
  osc2.frequency.setValueAtTime(rand(1000, 1400), now)
  osc2.frequency.exponentialRampToValueAtTime(400, now + 0.03)
  const gain2 = c.createGain()
  gain2.gain.setValueAtTime(0.018, now)
  gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.03)
  osc2.connect(gain2).connect(c.destination)
  osc2.start(now)
  osc2.stop(now + 0.03)

  const bufSize = c.sampleRate * 0.025 | 0
  const noiseBuf = c.createBuffer(1, bufSize, c.sampleRate)
  const data = noiseBuf.getChannelData(0)
  for (let i = 0; i < bufSize; i++) data[i] = Math.random() * 2 - 1
  const noise = c.createBufferSource()
  noise.buffer = noiseBuf
  const bp = c.createBiquadFilter()
  bp.type = 'bandpass'
  bp.frequency.setValueAtTime(rand(1800, 2500), now)
  bp.Q.setValueAtTime(1.5, now)
  const gain3 = c.createGain()
  gain3.gain.setValueAtTime(0.006, now)
  gain3.gain.exponentialRampToValueAtTime(0.0001, now + 0.025)
  noise.connect(bp).connect(gain3).connect(c.destination)
  noise.start(now)
  noise.stop(now + 0.025)

  const osc4 = c.createOscillator()
  osc4.type = 'sine'
  osc4.frequency.setValueAtTime(rand(2200, 2800), now)
  osc4.frequency.exponentialRampToValueAtTime(1500, now + 0.08)
  const gain4 = c.createGain()
  gain4.gain.setValueAtTime(0.004, now)
  gain4.gain.exponentialRampToValueAtTime(0.0001, now + 0.08)
  osc4.connect(gain4).connect(c.destination)
  osc4.start(now)
  osc4.stop(now + 0.08)
}
