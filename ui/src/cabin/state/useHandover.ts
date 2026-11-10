import { useEffect, useState } from 'react'
import { handoverAt, type PowerPhase } from './power'

/**
 * Whether the boot has reached its hand-over: its last part (HANDOVER_MS), when its light goes down. What the boot
 * hands over to mounts then — the cabin's first screen — so it is drawn as the boot's screen fades out (Motion's exit,
 * BootScreen.tsx): CarPlay arriving as the light goes down, one motion, rather than the boot fading to black and a
 * screen appearing after it. The cluster's page takes only the moment from it, to drop the boot as this screen does:
 * its dash comes up once the boot is over (cluster/ClusterScreen.tsx).
 *
 * `power` is on `clock`'s time: each page counts the boot on its own clock (the cabin's page clock, `performance.now`;
 * the cluster's, the machine's `Date.now`). `clock` must be the same function on every render (a module's own, not
 * one made here), or the hand-over's timer would restart each render.
 */
export function useHandover(power: { phase: PowerPhase; since: number } | null, clock: () => number): boolean {
  const at = handoverAt(power)
  // Which boot's hand-over has come — the moment itself, so a boot after this one isn't taken for it.
  const [reached, setReached] = useState<number | null>(null)
  useEffect(() => {
    if (at === null) return
    // The moment has already passed (a page that came up during it): the timer is only there to be no later than it.
    const timer = setTimeout(() => setReached(at), Math.max(0, at - clock()))
    return () => clearTimeout(timer)
  }, [at, clock])
  return at !== null && reached === at
}
