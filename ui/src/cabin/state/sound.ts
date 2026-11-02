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

/** The page's audio, made (and resumed) on the first press: browsers start one suspended. */
function audio(): AudioContext | null {
  if (context) {
    if (context.state === 'suspended') void context.resume()
    return context
  }
  try {
    context = new AudioContext()
    master = context.createGain()
    master.gain.value = 0.9
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
