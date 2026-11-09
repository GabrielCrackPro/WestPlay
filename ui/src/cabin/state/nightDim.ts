import { cabClock } from '../../shared/host'
import { useLive } from './store'

/**
 * How far the screen dims for the truck's night, and from when to when (game time): the cab's screen glows as a
 * head unit's does in a dark cab instead of glaring at full brightness. Low enough to read everything by, and
 * gone by day unless the lights are on (a tunnel, a storm).
 *
 * The shell draws it over the cabin's screen and the cluster over the panel on the dash: one dimmer for both, so
 * the two screens in the cab stay at the same brightness.
 */
const NIGHT_DIM = 0.16
const NIGHT_FROM = 20 * 60
const NIGHT_TO = 6 * 60

/** How far the screen dims now, 0 (not at all) to [`NIGHT_DIM`]. */
export function useNightDim(): number {
  const clock = useLive((state) => (state.telemetry ? cabClock(state.telemetry, state.clockShift) : null))
  const lit = useLive((state) => Boolean(state.telemetry?.lowBeam || state.telemetry?.highBeam))
  // The truck's own dash dimmer sets how far it dims: turned down, the screen dims further; turned up, less.
  const backlight = useLive((state) => state.telemetry?.dashboardBacklight ?? 0)
  if (clock === null) return 0
  const minute = ((clock % 1440) + 1440) % 1440
  if (!(lit || minute >= NIGHT_FROM || minute < NIGHT_TO)) return 0
  return NIGHT_DIM * (1 - Math.min(1, Math.max(0, backlight)) * 0.5)
}
