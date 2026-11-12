import { create } from 'zustand'
import { type GpsDuckLead, type LiveState, useCabin, useLive } from '../state/store'
import { guidanceOf, type Guidance } from './guidance'

/**
 * The game's GPS voice, as the cab can tell: it cannot hear the game's own sound or set it, so what it judges is
 * when that voice speaks — the turns the host works out from the game's junctions in the terms the game's voice
 * navigation uses (guidance.ts), and how far the truck is from the next of them. Two things act on that judgement,
 * each with its own switch on Settings › GPS Voice: the music dipping under the voice (apps/ducks.ts), and the cabin
 * saying, on screen, that the voice is talking — the screens' frames glowing at their edges (Shell.tsx,
 * ClusterScreen.tsx).
 *
 * Nothing is "talking" without a route to follow, and nothing over a game that is paused or a truck that isn't
 * there: a route in the pause menu is not a voice in the cab.
 */

/**
 * The road the judgement covers before a turn, seconds of it at the truck's own speed, per choice: at the mouth of
 * the turn; a few seconds out, where the voice usually names it; or the whole approach, for players whose game
 * speaks early.
 */
const LEAD_S: Record<GpsDuckLead, number> = { just: 2, few: 3.5, early: 6 }
/** The window's bounds, metres: a crawl still hears the voice, and a motorway isn't ducked for half a minute. */
const WINDOW_MIN = 25
const WINDOW_MAX = 450

/**
 * Whether the GPS is at the point of speaking: its next step is within the road the truck covers in the seconds
 * `lead` allows (`speed` in metres a second, as the SDK counts it), kept inside the window's bounds. A step is "now"
 * for the length of its junction, so it holds through it; with no step left, the arrival is what comes next.
 */
export function dueToSpeak(guidance: Guidance | null, speed: number, lead: GpsDuckLead): boolean {
  if (!guidance) return false
  const window = Math.min(WINDOW_MAX, Math.max(WINDOW_MIN, speed * LEAD_S[lead]))
  return guidance.distance <= window
}

/**
 * Whether the game's navigator is due to speak now, from a live state: a route with turns in it, a truck running
 * it, and its next step inside the window the player's How Early allows.
 */
export function voiceDue(live: LiveState): boolean {
  const telemetry = live.telemetry
  // Nothing to say at a standstill in a menu, over a truck that isn't there.
  if (!telemetry || telemetry.paused) return false
  const { route } = live
  if (!route || route.maneuvers.length === 0) return false
  const guidance = guidanceOf(route.distances, route.maneuvers, live.routeNext, telemetry.navigationDistance)
  return dueToSpeak(guidance, telemetry.speed, useCabin.getState().gpsDuckLead)
}

/**
 * Whether the GPS voice is talking, for the UI: the screens' frames turn `true` while the navigator is due and
 * `false` once the voice's hold after the junction is up, exactly as the music's
 * dip does; `followGpsVoice` keeps it so. A store of its own, apart from the telemetry's, so a frame that reads only
 * this redraws when the voice starts and stops rather than ten times a second. The fades in and out of that state are
 * the styles' (shell.css, cluster.css), so the sign arrives and leaves smoothly rather than appearing and vanishing.
 */
export const useGpsVoice = create<{ talking: boolean }>(() => ({ talking: false }))

/**
 * How long the voice goes on after the window closes, ms. The window ends as the truck is through the junction, which
 * is when the voice is still finishing its sentence ("turn right" as the nose goes in), so both things that answer
 * the voice keep it this long: the music stays down under it (apps/ducks.ts) and the screens stay lit. One figure for
 * both, so what a driver hears and what they see let go at the same moment rather than one trailing the other.
 */
export const SPEAK_HOLD_MS = 2200

/** Follows the game's navigator from now on, keeping `useGpsVoice` true from the moment its voice is due until the
 * sentence after the turn is done with — the same window the music's dip holds, `SPEAK_HOLD_MS`. Returns the function
 * that stops it. */
export function followGpsVoice(): () => void {
  const set = (talking: boolean) => {
    if (useGpsVoice.getState().talking !== talking) useGpsVoice.setState({ talking })
  }
  /** The sign's release, waiting out the voice's hold after a turn (`null`: none). */
  let tail: number | null = null
  const stop = useLive.subscribe((live) => {
    if (voiceDue(live)) {
      if (tail !== null) clearTimeout(tail)
      tail = null
      set(true)
      return
    }
    // Nothing has to be timed while the voice is quiet: only a sign still up has a tail to wait out.
    if (tail !== null || !useGpsVoice.getState().talking) return
    tail = setTimeout(() => {
      tail = null
      set(false)
    }, SPEAK_HOLD_MS)
  })
  return () => {
    stop()
    if (tail !== null) clearTimeout(tail)
    tail = null
    set(false)
  }
}
