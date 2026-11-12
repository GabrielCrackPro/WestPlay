import { useEffect, useState } from 'react'
import type { NowPlayingInfo } from '../../shared/host'

/**
 * How far into what plays the dash reads it, as of `now`: the position the host last sent, run on by the dash's own
 * clock while the track plays (the host sends a track once, not a tick a second — see `useNowPlayingReport` in
 * shell/Notifications). `null` where there is nothing to measure: no track, or a player that reports no length (a
 * stream, the game's own radio), which is also exactly what a progress line needs to know.
 *
 * The clock is handed in rather than read here, so the arithmetic can be checked without one (usePlayed.test.ts).
 */
export function playedOf(info: NowPlayingInfo | null, now: number): { position: number; duration: number } | null {
  if (!info || !info.duration || info.duration <= 0 || info.position === null || info.position === undefined)
    return null
  // `at` is when the player said where it was: played on from there, and held where it was while paused.
  const ran = info.playing && info.at ? Math.max(0, now - info.at) / 1000 : 0
  return { position: Math.min(info.duration, info.position + ran), duration: info.duration }
}

/**
 * The same reading, ticking once a second while there is a bar to move. It lives in the component that draws the bar
 * rather than in the dash itself: a track running then redraws that one line, where the whole panel — its readings, its
 * lamps, its dial — would otherwise be re-rendered with it, every second, for a figure none of them is about.
 *
 * The tick runs only while the reading can change: a track with a length, playing. A stream has no length, so there is
 * no bar to move, and a paused track holds where it was.
 */
export function usePlayed(info: NowPlayingInfo | null): { position: number; duration: number } | null {
  const playing = info?.playing ?? false
  const measure = (info?.duration ?? 0) > 0 && info?.position !== null && info?.position !== undefined
  // A second's tick while it plays: the bar creeps rather than jumping when a message happens to arrive.
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    if (!playing || !measure) return
    const id = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(id)
  }, [playing, measure])
  return playedOf(info, now)
}
