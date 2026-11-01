import { useEffect, useState } from 'react'

/** How close counts as arrived, in the reading's own units: below it the number rests on the value. */
const CLOSE_ENOUGH = 0.5

/**
 * A reading as a real instrument shows it: eased towards the number the game sends instead of snapping to it.
 * The game sends twenty frames a second, and a speedo that jumps twenty times a second reads as a broken one;
 * eased over `ms`, it sweeps as a needle does. It settles (and stops asking for frames) once it's there, so
 * nothing runs while the reading holds still.
 */
export function useTicker(value: number, ms = 320): number {
  const [shown, setShown] = useState(value)
  useEffect(() => {
    let frame = 0
    let last = performance.now()
    const step = (now: number) => {
      const dt = Math.min(100, now - last)
      last = now
      let arrived = false
      setShown((kept) => {
        const gap = value - kept
        if (Math.abs(gap) < CLOSE_ENOUGH) {
          arrived = true
          return value
        }
        return kept + gap * Math.min(1, dt / ms)
      })
      if (!arrived) frame = requestAnimationFrame(step)
    }
    frame = requestAnimationFrame(step)
    return () => cancelAnimationFrame(frame)
  }, [value, ms])
  return shown
}
