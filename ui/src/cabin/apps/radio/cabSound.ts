import type { Equalizer, Speaker } from '../../../shared/host'
import { radioForSpeakers } from './radio'

/** What the truck’s speakers are doing as the host last said (its `cabSound` message): the players’ own data,
 * so the radio is heard in the cab as their music is. */
export interface CabSoundMessage {
  speakers: Speaker[] | null
  head: { x: number; y: number; z: number; heading: number; pitch: number } | null
  outside: boolean
  /** How far the camera is outside the cab, metres. */
  distance: number
  equalizer: Equalizer
}

/** cab_sound.js’s way into the truck’s speakers (loaded as the page starts, by the host). */
interface CabSound {
  speakers(list: Speaker[] | null): void
  head(told: CabSoundMessage['head']): void
  outside(on: boolean, far: number): void
  equalizer(told: Equalizer): void
  tick(): void
}

declare global {
  interface Window {
    westplayCabSound?: (media: () => HTMLMediaElement | null, say?: (message: unknown) => void) => CabSound
  }
}

/** How often the speakers are checked: the page may make its element anew (cab_sound.js’s own tick). */
const TICK_MS = 250

let cab: CabSound | null = null
let timer: number | null = null
/** The speakers as last told, for when the page’s sound is made after them. */
let last: CabSoundMessage | null = null

/**
 * The radio’s sound through the truck’s own speakers, as the players’ music is (cab_sound.js): the same
 * spatialisation, tone and outside-the-cab silence. A station is handed over only while it plays through this
 * PC’s door: the graph plays silence for a stream the page may read but not hear (one straight from its own
 * server), which stays the page’s own sound instead. Without speakers to play it (a truck they aren’t known for,
 * or no game), the sound is the page’s own too, as it would be on a phone. Returns the function that stops it.
 */
export function installRadioCabSound(): () => void {
  const make = window.westplayCabSound
  if (!make) return () => {}
  cab = make(() => radioForSpeakers())
  if (last) tell(last)
  timer = window.setInterval(() => cab?.tick(), TICK_MS)
  return () => {
    if (timer !== null) window.clearInterval(timer)
    timer = null
    cab = null
  }
}

/** The truck’s speakers (and the head hearing them) as the host last said them. */
export function receiveCabSound(message: CabSoundMessage): void {
  last = message
  if (cab) tell(message)
}

/** The cab as last told, for the voice assistant's own sound through the same speakers. */
export function lastCabSound(): CabSoundMessage | null {
  return last
}

function tell(message: CabSoundMessage): void {
  if (!cab) return
  cab.speakers(message.speakers)
  cab.head(message.head)
  cab.outside(message.outside, message.distance)
  cab.equalizer(message.equalizer)
}
