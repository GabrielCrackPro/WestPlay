import { formatGameTime, formatTripDistance, formatTripTime } from '../../shared/format'
import { cabClock, type Telemetry } from '../../shared/host'
import type { State } from '../apps/diagnostics/readings'
import type { Strings } from '../state/strings'

/** The Dashboard's driver-hours card: the game's own rest clocks, and the trip still to drive. */
export interface DriverHoursView {
  /** How long until the next rest stop ("1:30 hrs"), or that the profile has none ("Off in this profile"). */
  rest: string
  restState: State
  /** How long until the mandatory break, worded the same. */
  break: string
  breakState: State
  /** The trip still to drive ("18:40 arrival · 214 km"), or the fuel's range without a route. */
  detail: string
  /** A rest or a break is within the hour: what Auto Order lifts the card for. */
  due: boolean
}

/** How serious a rest clock is: a quarter of an hour is a note's alarm, the hour is worth watching. */
function clockState(minutes: number): State {
  if (minutes < 0) return 'ok'
  return minutes <= 15 ? 'alarm' : minutes <= 60 ? 'warn' : 'ok'
}

/**
 * The driver-hours card's readings, from the game's own telemetry: the rest stop and the mandatory break its
 * fatigue simulation counts down, and the trip's arrival and distance (or, with no route, the fuel's range). A
 * profile with either simulation off sends -1: the card says so instead of counting down from nothing.
 */
export function driverHoursView(telemetry: Telemetry, text: Strings, clockShift: number): DriverHoursView {
  const words = text.diagnostics
  const rest = telemetry.restStop
  const breakIn = telemetry.mandatoryBreak
  const route = telemetry.navigationDistance > 0 && telemetry.navigationTime > 0
  const arrival = formatGameTime(Math.round(cabClock(telemetry, clockShift) + telemetry.navigationTime / 60))
  return {
    rest: rest >= 0 ? formatTripTime(rest, text) : words.noRest,
    restState: clockState(rest),
    break: breakIn >= 0 ? formatTripTime(breakIn, text) : words.noRest,
    breakState: clockState(breakIn),
    detail: route
      ? `${arrival} ${text.arrival} · ${formatTripDistance(telemetry.navigationDistance, text.decimal)}`
      : text.range(formatTripDistance(telemetry.fuelRange, text.decimal)),
    due: (rest >= 0 && rest <= 60) || (breakIn >= 0 && breakIn <= 60),
  }
}
