import { useCabin, useLive } from './store'

/**
 * The cabin's own sounds (Settings › Sound): a soft tick under a press, a chime when the truck has something to
 * say, a quiet pip per step of the volume. Synthesised with WebAudio, so nothing ships with them, and shaped to be
 * smooth rather than clicky: a sine through a gentle low-pass, an attack of a few milliseconds and a long
 * exponential tail, at a level a driver can ignore.
 *
 * The context is made on the page's first press (browsers don't allow one before that), and each cue is dropped if
 * the player turned sounds off, the camera is outside the cab (the speakers are in it) or the page is hidden:
 * nothing plays to an empty cab.
 */
export type Cue = 'press' | 'volume' | 'note' | 'alarm'

interface Voice {
  /** Each note's frequency (Hz), played one after another. */
  notes: number[]
  /** How long each note lasts, seconds. */
  length: number
  /** Its peak gain: kept low, these sit under the game's own sound. */
  gain: number
  type: OscillatorType
}

const VOICES: Record<Cue, Voice> = {
  // A tick: high, short, barely there.
  press: { notes: [1244.5], length: 0.05, gain: 0.03, type: 'sine' },
  // The volume, a step at a time.
  volume: { notes: [1760], length: 0.04, gain: 0.024, type: 'sine' },
  // A warning note: two notes rising, like a dash's chime.
  note: { notes: [1046.5, 1396.9], length: 0.34, gain: 0.045, type: 'sine' },
  // An alarm: three notes, lower, the last held.
  alarm: { notes: [784, 622.3, 784], length: 0.4, gain: 0.055, type: 'triangle' },
}

/** How far the low-pass sits above the notes' own frequencies: softens the sine into a rounded tone. */
const LOW_PASS = 2600
/** The attack's length, seconds: long enough to have no click, short enough to feel immediate. */
const ATTACK = 0.014

let context: AudioContext | null = null
let master: GainNode | null = null

useCabin.subscribe((state, previous) => {
  if (state.uiSoundVolume === previous.uiSoundVolume || !context || !master) return
  master.gain.setTargetAtTime(0.9 * state.uiSoundVolume, context.currentTime, 0.02)
})

/** The page's audio, made (and resumed) on the first press: browsers start one suspended. */
function audio(): AudioContext | null {
  if (context) {
    if (context.state === 'suspended') void context.resume()
    return context
  }
  try {
    context = new AudioContext()
    master = context.createGain()
    master.gain.value = 0.9 * useCabin.getState().uiSoundVolume
    master.connect(context.destination)
    return context
  } catch {
    return null
  }
}

/** Plays one cue, if the player has sounds on and the page is being looked at. */
export function playCue(cue: Cue): void {
  if (!useCabin.getState().uiSounds || useLive.getState().outsideCab || document.hidden) return
  const ctx = audio()
  if (!ctx || !master) return
  // Captured once: the module's master can be replaced under a hot reload, and a narrowed `let` doesn't carry into
  // the closure below.
  const out = master
  const voice = VOICES[cue]
  const start = ctx.currentTime + 0.005
  voice.notes.forEach((frequency, index) => {
    const at = start + index * voice.length * 0.62
    const oscillator = ctx.createOscillator()
    oscillator.type = voice.type
    oscillator.frequency.value = frequency
    const filter = ctx.createBiquadFilter()
    filter.type = 'lowpass'
    filter.frequency.value = LOW_PASS
    filter.Q.value = 0.3
    const gain = ctx.createGain()
    // Up on a line (no click), then down an exponential tail (a chime, not a cut).
    gain.gain.setValueAtTime(0.0001, at)
    gain.gain.linearRampToValueAtTime(voice.gain, at + ATTACK)
    gain.gain.exponentialRampToValueAtTime(0.0001, at + voice.length)
    oscillator.connect(filter)
    filter.connect(gain)
    gain.connect(out)
    oscillator.start(at)
    oscillator.stop(at + voice.length + 0.02)
  })
}

const PRESSABLE = 'button, [role="button"], [role="switch"], [role="radio"], [role="slider"], [role="tab"]'

/**
 * The press tick, for the whole cabin: one listener rather than a sound in every button, so anything the player can
 * press answers, including the ones drawn as rows. The same press brings the audio context up.
 */
export function installSounds(): () => void {
  const onPress = (event: PointerEvent) => {
    const target = event.target
    if (!(target instanceof Element)) return
    // Typing has its own sounds (the keyboard's), and a slider's drag would tick the whole way.
    if (target.closest('input, textarea, [contenteditable="true"], [role="slider"]')) return
    if (!target.closest(PRESSABLE)) return
    playCue('press')
  }
  window.addEventListener('pointerdown', onPress, { passive: true })
  return () => window.removeEventListener('pointerdown', onPress)
}

/**
 * Spatial cabin ambient sounds (Feature 18): wind noise that changes with speed and road surface noise
 * that varies with speed. Synthesised with WebAudio noise generators so nothing ships with them.
 *
 * Wind noise: filtered white noise that increases in volume and frequency with speed, simulating
 * air flowing past the cab. Road noise: lower-frequency rumble that increases with speed, simulating
 * tire-road interaction.
 *
 * Both are gated by the same conditions as cues: sounds on, inside cab, page visible.
 * Volume is kept very low — these sit under the game's own sound, adding subtle immersion.
 */

let windGain: GainNode | null = null
let roadGain: GainNode | null = null
let windFilter: BiquadFilterNode | null = null
let roadFilter: BiquadFilterNode | null = null
let ambientMaster: GainNode | null = null

/** Update ambient cabin sounds based on current speed (m/s). Call from telemetry update loop. */
export function updateAmbientSounds(speed: number): void {
  if (!useCabin.getState().uiSounds || useLive.getState().outsideCab || document.hidden) {
    stopAmbient()
    return
  }
  const ctx = audio()
  if (!ctx || !master) return

  // Initialise ambient nodes on first call
  if (!ambientMaster) initAmbient(ctx, master)
  if (!ambientMaster) return

  // Speed 0-40 m/s (0-144 km/h) mapped to gain
  const speedNorm = Math.min(1, Math.max(0, speed / 40))

  // Wind: barely audible at low speed, noticeable at highway speed
  // Frequency increases with speed (turbulence)
  if (windGain && windFilter) {
    const windVol = 0.008 * speedNorm * speedNorm // quadratic: quiet at low speed
    windGain.gain.setTargetAtTime(windVol, ctx.currentTime, 0.1)
    // Filter frequency: 800Hz at low speed → 3000Hz at high speed
    const windFreq = 800 + 2200 * speedNorm
    windFilter.frequency.setTargetAtTime(windFreq, ctx.currentTime, 0.1)
  }

  // Road: low rumble, increases linearly with speed
  if (roadGain && roadFilter) {
    const roadVol = 0.006 * speedNorm
    roadGain.gain.setTargetAtTime(roadVol, ctx.currentTime, 0.15)
    // Filter: 100Hz at low speed → 400Hz at high speed
    const roadFreq = 100 + 300 * speedNorm
    roadFilter.frequency.setTargetAtTime(roadFreq, ctx.currentTime, 0.15)
  }
}

function initAmbient(ctx: AudioContext, out: GainNode): void {
  try {
    ambientMaster = ctx.createGain()
    ambientMaster.gain.value = 0.5
    ambientMaster.connect(out)

    // Wind noise: bandpass-filtered white noise via oscillator with modulation
    windFilter = ctx.createBiquadFilter()
    windFilter.type = 'bandpass'
    windFilter.frequency.value = 800
    windFilter.Q.value = 0.5

    windGain = ctx.createGain()
    windGain.gain.value = 0

    // Create wind as modulated noise using two detuned oscillators through a distortion curve
    const windOsc = ctx.createOscillator()
    windOsc.type = 'sawtooth'
    windOsc.frequency.value = 50
    const windOsc2 = ctx.createOscillator()
    windOsc2.type = 'sawtooth'
    windOsc2.frequency.value = 53 // slight detune for noise-like quality

    const windMerge = ctx.createGain()
    windMerge.gain.value = 0.3
    windOsc.connect(windMerge)
    windOsc2.connect(windMerge)
    windMerge.connect(windFilter)
    windFilter.connect(windGain)
    windGain.connect(ambientMaster)
    windOsc.start()
    windOsc2.start()
    // windOsc tracked implicitly via windGain connection

    // Road noise: low-frequency rumble
    roadFilter = ctx.createBiquadFilter()
    roadFilter.type = 'lowpass'
    roadFilter.frequency.value = 200
    roadFilter.Q.value = 0.3

    roadGain = ctx.createGain()
    roadGain.gain.value = 0

    const roadOsc = ctx.createOscillator()
    roadOsc.type = 'sawtooth'
    roadOsc.frequency.value = 30
    const roadOsc2 = ctx.createOscillator()
    roadOsc2.type = 'square'
    roadOsc2.frequency.value = 37

    const roadMerge = ctx.createGain()
    roadMerge.gain.value = 0.15
    roadOsc.connect(roadMerge)
    roadOsc2.connect(roadMerge)
    roadMerge.connect(roadFilter)
    roadFilter.connect(roadGain)
    roadGain.connect(ambientMaster)
    roadOsc.start()
    roadOsc2.start()
    // roadOsc tracked implicitly via roadGain connection
  } catch {
    // Ambient sounds are optional — skip if WebAudio can't create them
    ambientMaster = null
  }
}

function stopAmbient(): void {
  if (windGain) {
    const ctx = windGain.context
    windGain.gain.setTargetAtTime(0, ctx.currentTime, 0.05)
  }
  if (roadGain) {
    const ctx = roadGain.context
    roadGain.gain.setTargetAtTime(0, ctx.currentTime, 0.05)
  }
}
