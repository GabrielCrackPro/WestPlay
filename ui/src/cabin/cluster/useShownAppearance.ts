import { useEffect, useRef, useState } from 'react'
import type { Appearance } from '../state/appearance'

/**
 * How long the panel is given to come to a new look: the cabin makes the same change over 420ms on its surfaces, with
 * the ink following 160ms behind them (shell/transitions.css, `.shell.appearing`), so the last colour lands 580ms in.
 * The window stays open a breath past that, so the transition is never cut off on its last frame.
 */
const LOOK_MS = 620

/** The look the panel is drawn in, and whether it is part-way through changing to another. */
export interface ShownAppearance {
  appearance: Appearance
  appearing: boolean
}

/**
 * The appearance the panel draws in, which follows the one the cabin asks for (`useShownLook`, state/hooks.ts).
 *
 * A change of look is the panel's colours breathing to the new ones rather than the panel being redrawn: `appearing`
 * is put on for that one breath and the look changes under it, so the colours the stylesheet has transitions for
 * (`.cluster[data-appearing]`, cluster.css) are already being carried when they move. The look is drawn once in the
 * old colours with the window open and flipped a frame later, so there is never a frame where the panel has the new
 * look and no transition to come to it with.
 *
 * The panel stays live through it — the dial keeps its reading and every bar keeps its fill — which is why this is a
 * change of colour and not a crossfade of the picture: a snapshot of a cluster is a frozen speedo. It runs on the
 * cabin's own clock, so the display changes on the same beat the screen beside it does rather than flipping between
 * looks while the cabin fades.
 *
 * Reduce Motion puts the look in place at once, as the cabin's own change does (state/launch.ts).
 */
export function useShownAppearance(wanted: Appearance, reduced: boolean): ShownAppearance {
  const [look, setLook] = useState<ShownAppearance>({ appearance: wanted, appearing: false })
  // The look the panel has actually been drawn in: what a new request is measured against, kept in a ref so the
  // effect below only runs when the cabin asks for a different look, never on its own state.
  const shown = useRef(wanted)
  // Two frames: the first opens the window on the old colours, the second brings the new ones in under it.
  const frame = useRef(0)
  const next = useRef(0)
  const timer = useRef(0)

  useEffect(() => {
    if (shown.current === wanted) return
    // A second change while the first is still on its way takes its place: one change of look, to the newest.
    cancelAnimationFrame(frame.current)
    cancelAnimationFrame(next.current)
    clearTimeout(timer.current)
    if (reduced) {
      // Reduced motion still lands before the next paint, just not inside the effect's own commit.
      frame.current = requestAnimationFrame(() => {
        shown.current = wanted
        setLook({ appearance: wanted, appearing: false })
      })
      return
    }
    frame.current = requestAnimationFrame(() => {
      setLook((current) => ({ ...current, appearing: true }))
      next.current = requestAnimationFrame(() => {
        shown.current = wanted
        setLook({ appearance: wanted, appearing: true })
        timer.current = window.setTimeout(() => setLook((current) => ({ ...current, appearing: false })), LOOK_MS)
      })
    })
  }, [wanted, reduced])

  // A page taken down mid-change leaves no clock behind.
  useEffect(
    () => () => {
      cancelAnimationFrame(frame.current)
      cancelAnimationFrame(next.current)
      clearTimeout(timer.current)
    },
    [],
  )

  return look
}
