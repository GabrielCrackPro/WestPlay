/**
 * The screen's power sequence, driven by the truck's electrics:
 *
 *   off ──electrics on──▶ splash ──SPLASH_MS──▶ connecting ──CONNECTING_MS──▶ on
 *    ▲                                                                       │
 *    └────────────────────────────── electrics off ◀─────────────────────────┘
 *
 * The phases time the boot, which is one screen (boot/BootScreen.tsx): `splash` is the first part of it, the
 * panel lighting up with the truck's brand on it, and `connecting` the part that carries Cabin Play's mark and
 * name. If WestPlay first sees the truck with the electrics already on (the app or plugin started mid-drive),
 * it skips the brand part and the boot is shorter by `SPLASH_MS`. A screen that isn't the truck's own
 * (WestPlay's tablet: owner 2026-10-24) skips it too: it boots no truck.
 *
 * The game itself hides the screen while the electrics are off, so `off` is mostly bookkeeping.
 * The pairing step ("Connect your phone?") will sit between `connecting` and `on` once there is input (M2).
 *
 * This page owns the sequence, and the instrument cluster's page is told it (its own `power` message, through the
 * host): the truck's screen and the dash are one boot, not two clocks that happen to start together — see
 * `bootShown` below for the cluster's side of it.
 */
import type { CabinPower } from '../../shared/host'

export type PowerPhase = 'off' | 'splash' | 'connecting' | 'on'

export interface PowerState {
  phase: PowerPhase
  /** When the current phase started (ms, from the caller's clock). */
  since: number
  /** Whether the electrics state has been observed yet. */
  observed: boolean
}

/** The electrics switched (`truckScreen`: on a screen of the truck's own, which shows its brand as it boots;
 * not given, it is), or a tick of the clock. */
export type PowerEvent =
  { type: 'electrics'; on: boolean; at: number; truckScreen?: boolean } | { type: 'tick'; at: number }

export const SPLASH_MS = 2400
export const CONNECTING_MS = 2600

/** How long the boot runs from its first phase: the truck's brand and then Cabin Play's mark, or the mark alone when
 * the boot starts mid-drive (`CONNECTING_MS`). */
export function bootLength(phase: 'splash' | 'connecting'): number {
  return phase === 'splash' ? SPLASH_MS + CONNECTING_MS : CONNECTING_MS
}

/** The boot's last part (ms), when its light goes down and what it hands over to comes up under it: the cabin's first
 * screen mounts as it begins, so the boot hands over as one motion, and `boot.css` fades the boot's screen out over the
 * same 500ms (Motion's exit, BootScreen.tsx). The cluster's page holds its dash off the glass until the boot is over
 * (cluster/ClusterScreen.tsx), so its own motions start on the cleared screen instead. The two numbers are one window —
 * keep them together. */
export const HANDOVER_MS = 500

/** When (on the clock that counts it) the boot hands over: its last `HANDOVER_MS`, or `null` when there is no boot to
 * hand over from. */
export function handoverAt(power: { phase: PowerPhase; since: number } | null): number | null {
  if (power?.phase !== 'splash' && power?.phase !== 'connecting') return null
  return power.since + bootLength(power.phase) - HANDOVER_MS
}

export const INITIAL_POWER: PowerState = { phase: 'off', since: 0, observed: false }

export function power(state: PowerState, event: PowerEvent): PowerState {
  switch (event.type) {
    case 'electrics': {
      if (!event.on) {
        return state.phase === 'off' && state.observed ? state : { phase: 'off', since: event.at, observed: true }
      }
      if (state.phase !== 'off') return state.observed ? state : { ...state, observed: true }
      const splash = state.observed && event.truckScreen !== false
      return { phase: splash ? 'splash' : 'connecting', since: event.at, observed: true }
    }
    case 'tick': {
      // Against the moment the phase is due (nextPhaseAt), computed the same way, so a tick sent for that
      // moment always advances it.
      const due = nextPhaseAt(state)
      if (due === null || event.at < due) return state
      return { ...state, phase: state.phase === 'splash' ? 'connecting' : 'on', since: event.at }
    }
  }
}

/**
 * The boot another screen plays from the cabin's power (`CabinPower`, the phase its page told the host): the phases
 * before the screen is on, and how far into that boot a page coming up now is (`elapsed`, ms) — the cluster's page
 * boots on this, so a page that loads while the cabin is already booting joins the boot where it is. `null`: there is
 * no boot to show (the cabin hasn't said, or the screen is off or already on).
 */
export function bootShown(
  power: CabinPower | null,
  wallNow: number,
): { phase: 'splash' | 'connecting'; since: number; elapsed: number } | null {
  if (power?.phase !== 'splash' && power?.phase !== 'connecting') return null
  return { phase: power.phase, since: power.since, elapsed: Math.max(0, wallNow - power.since) }
}

/** When (on the caller's clock) the current phase advances by itself, or `null` if it doesn't. */
export function nextPhaseAt(state: PowerState): number | null {
  if (state.phase === 'splash') return state.since + SPLASH_MS
  if (state.phase === 'connecting') return state.since + CONNECTING_MS
  return null
}
