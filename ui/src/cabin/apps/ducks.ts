import { SPEAK_HOLD_MS, voiceDue } from '../maps/voice'
import { type LiveState, useCabin, useLive } from '../state/store'
import { fade, levelOf } from './fade'
import type { MusicPlayer } from './musicWithGame'

/**
 * The game's GPS voice, given room: while its navigator is about to say something — the last seconds before a turn,
 * and the turn itself — the music playing here dips under it and comes back after.
 *
 * When it is due is judged in maps/voice.ts, from the turns the host works out from the game's junctions in the terms
 * the game's voice navigation uses: the same route, counted the same way, as the GPS's own figures, so the window
 * opens where the voice does — give or take the game's own setting for how early it speaks, which is why how early
 * the duck opens is the player's to set too (Settings › GPS Voice). Nothing dips without a route to follow, and nothing
 * at all with the switch off.
 *
 * The level goes down rather than off: the voice is one thing to hear over the music, not a reason to stop it. It
 * holds where it came down (`fade`'s `hold`), so the pause the game itself makes (musicWithGame.ts) takes it from
 * where it was left rather than from the player's own volume, and the music comes back up unhurried.
 *
 * The hold after the junction is the voice's own (voice.ts, `SPEAK_HOLD_MS`), the figure the screens' glow keeps too:
 * the music and the sign are answering one voice, so they start together and let go together.
 */

/** How far the music goes down while the GPS speaks: the voice over the top of it, not in place of it. */
const DUCK_SHARE = 0.35
/** Down quickly under a voice, back up unhurried, ms. */
const DOWN_MS = 140
const UP_MS = 380
/** Drops `player` under the voice, if it plays here now. True when it is down (or already was). */
function duck(player: MusicPlayer): boolean {
  const level = player.volume()
  if (level === null || level <= 0 || !player.playingHere()) return false
  const at = level * DUCK_SHARE
  const from = levelOf(player.name) ?? level
  // Already down to it or below (a duck held, a fade on its way): nothing to do.
  if (from <= at) return true
  fade(player.name, player.sendVolume, from, at, DOWN_MS, undefined, true)
  return true
}

/** Brings `player` back to the volume its player chose. */
function unduck(player: MusicPlayer): void {
  const level = player.volume()
  if (level === null) return
  const from = Math.min(levelOf(player.name) ?? level * DUCK_SHARE, level)
  if (from >= level) return
  fade(player.name, player.sendVolume, from, level, UP_MS)
}

/** Whether the duck is asked for and the game's GPS is due to speak now (the switch, then the navigator). */
function speakingNow(live: LiveState): boolean {
  return useCabin.getState().gpsDuck && voiceDue(live)
}

/**
 * Ducks the cab's players under the game's GPS voice as it is due, from now on: every player playing here, from the
 * lead the player chose before a turn until it is through, and the switch's own setting. Returns the function that
 * stops it.
 */
export function duckMusicForGps(players: readonly MusicPlayer[]): () => void {
  /** The players the duck is holding down. */
  const held = new Set<MusicPlayer>()
  /** When the GPS was last due to speak. */
  let dueAt = 0
  /** The duck's release, waiting out the hold after a turn (`null`: none). */
  let releasing: number | null = null

  const release = () => {
    if (releasing !== null) clearTimeout(releasing)
    releasing = null
    dueAt = 0
    for (const player of held) unduck(player)
    held.clear()
  }

  const stop = useLive.subscribe((live) => {
    const now = performance.now()
    if (speakingNow(live)) {
      if (releasing !== null) clearTimeout(releasing)
      releasing = null
      dueAt = now
      for (const player of players) {
        if (!held.has(player) && duck(player)) held.add(player)
      }
      return
    }
    if (held.size === 0) return
    // The hold is time, not a frame: the release is set for the moment it is up, and the truck's next report (ten a
    // second) doesn't put it off.
    if (releasing === null) releasing = setTimeout(release, Math.max(0, SPEAK_HOLD_MS - (now - dueAt)))
  })
  return () => {
    stop()
    release()
  }
}
