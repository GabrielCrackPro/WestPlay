import { useEffect, useState } from 'react'

/**
 * A value that outlives its own disappearance by one fade. While `value` is set it is handed back as it is; when it
 * goes, the last one stays for `leaveMs` — flagged `leaving` — so whatever draws it can fade it out instead of
 * blinking it away. A value that comes back inside that window cancels the fade, and the mark returns to where it is
 * now rather than where it left from.
 *
 * The dash's speed limit is the case it was written for: the navigation knows a limit on one road and not on the next,
 * and the sign in the status bar and its mark on the dial's scale should leave the way they arrived. The fade itself is
 * the stylesheet's (a transition on the drawing); this only keeps the drawing alive long enough to play it.
 *
 * `value` is compared with `!==` as it arrives, so it wants a primitive — a limit's number, not a new object every
 * render, which would look like a change every time.
 */
export function useLingering<T>(value: T | null, leaveMs: number): { value: T | null; leaving: boolean } {
  // The last value seen, kept up to date during the render that brings a new one: React's own pattern for a value that
  // changes under a component, and it means the mark is drawn at its new place at once rather than a render behind.
  const [held, setHeld] = useState<T | null>(value)
  if (value !== null && value !== held) setHeld(value)
  // On its way out: the value has gone but its drawing is still held.
  const leaving = value === null && held !== null
  // Let it go once the fade has played. The timer is cleared by a return inside the window (or by another departure),
  // so the fade is neither cut short nor left running.
  useEffect(() => {
    if (!leaving) return
    const timer = setTimeout(() => setHeld(null), leaveMs)
    return () => clearTimeout(timer)
  }, [leaving, leaveMs])
  return { value: leaving ? held : value, leaving }
}
