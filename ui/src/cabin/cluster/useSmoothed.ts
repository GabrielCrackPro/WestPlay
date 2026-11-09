import { useCallback, useEffect, useRef, useState } from 'react'

/**
 * How much of what is left of the distance to a reading is covered each second, as a time constant: at 85 ms the
 * value is within a thousandth of a new reading in about three quarters of a second, and covers most of it in the
 * first tenth of one — a needle's own pace, quick off the mark and slow into the number.
 */
const FOLLOW_SECONDS = 0.085

/**
 * Whether the cabin's reduce-motion setting is on. The cluster page sets the dataset from the same setting the shell
 * reads (ClusterScreen's effect), so a reading there is simply the reading.
 */
function motionReduced(): boolean {
  return document.documentElement.dataset.motion === 'reduced'
}

/**
 * A reading that moves instead of stepping: the dial's own value, carried towards every new reading a frame at a
 * time. The truck's telemetry arrives in steps, ten or twenty times a second, and a speedometer that jumps between
 * them reads as a slideshow; eased at the frame rate, the speed's arc, the cursor and the tacho travel as one
 * movement instead of arriving in nudges.
 *
 * The follow is exponential — a fixed share of what is left, every frame — so a big change covers ground at once and
 * the last thousandth takes its time, the way a needle settles. The loop stops as soon as the value *is* the reading,
 * so a truck sitting still costs no frames at all, and the next reading wakes it again.
 *
 * `from`, `hold` and `sweep` are the dial's opening move, the self-test a dashboard runs at power-up: the value
 * starts lit at `from`, stays there for `hold` milliseconds while the face finishes coming up, travels to the first
 * reading over the `sweep` that follows, and then follows the truck as above for as long as it is mounted. All three
 * are read on the first render only: a sweep is something a dial does once.
 *
 * Reduced motion (Settings › Appearance, or the PC's own) makes it the reading itself, sweep included — the dial then
 * holds still, as the rest of the cabin does.
 */
export function useSmoothed(
  target: number,
  { from = target, hold = 0, sweep = 0 }: { from?: number; hold?: number; sweep?: number } = {},
): number {
  // The value being drawn, the reading it is heading for, and the frame in hand: refs, so the loop reads them
  // without being torn down and rebuilt on every change. Only the shown value needs a render of its own.
  const value = useRef(from)
  const to = useRef(target)
  const frame = useRef(0)
  // The opening sweep while it lasts: where it started, and how far into it the loop is — begun before zero, so the
  // face holds at its far end for `hold` before it falls back.
  const opening = useRef(sweep > 0 ? { from, elapsed: -hold } : null)
  const [shown, setShown] = useState(from)

  const start = useCallback(() => {
    if (frame.current) return
    if (motionReduced()) {
      opening.current = null
      if (value.current !== to.current) {
        value.current = to.current
        setShown(to.current)
      }
      return
    }
    let previous = performance.now()
    const step = (now: number) => {
      // A frame the page spent away (a window in the background, a paused host) is not a movement: capped, so the
      // dial never lurches to catch up on work it never did.
      const dt = Math.min(0.1, (now - previous) / 1000)
      previous = now
      const reading = to.current
      let next = value.current
      const sweepNow = opening.current
      if (sweepNow) {
        sweepNow.elapsed += dt * 1000
        const through = Math.max(0, Math.min(1, sweepNow.elapsed / sweep))
        // Out of its start quickly and into the reading slowly: the sweep a dash makes when the electrics come on.
        next = sweepNow.from + (reading - sweepNow.from) * (1 - (1 - through) ** 3)
        if (through >= 1) opening.current = null
      } else {
        next += (reading - next) * (1 - Math.exp(-dt / FOLLOW_SECONDS))
        // Inside a thousandth of the reading, the value is the reading: the loop stops rather than creeping at it.
        if (Math.abs(reading - next) < 0.001) next = reading
      }
      if (next !== value.current) {
        value.current = next
        setShown(next)
      }
      frame.current = !opening.current && next === reading ? 0 : requestAnimationFrame(step)
    }
    frame.current = requestAnimationFrame(step)
  }, [sweep])

  // Every reading wakes the loop, which then reaches it over the frames that follow.
  useEffect(() => {
    to.current = target
    start()
  }, [target, start])

  useEffect(() => {
    return () => {
      if (!frame.current) return
      cancelAnimationFrame(frame.current)
      // Cleared as well as cancelled: a remount (React's own in development, the panel's after the boot) must be able
      // to wake the loop again, and a stale id would look like a frame already in hand.
      frame.current = 0
    }
  }, [])

  return shown
}
