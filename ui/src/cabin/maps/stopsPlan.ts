import type { Telemetry } from '../../shared/host'
import type { State } from '../apps/diagnostics/readings'
import type { Ahead } from './alongRoute'
import type { DestinationKind } from './places'

/**
 * The Stops page's own reasoning (StopsPage.tsx): whether the tank reaches the destination, how serious the
 * rest clocks are, and which of the places beside the route ahead are worth offering — fuel, and the places a
 * rest can be had.
 */

/** The kinds the page lists: fuel, a truck park, a service area, a hotel. */
export const STOP_KINDS: readonly DestinationKind[] = ['fuel', 'parking', 'service', 'hotel']

/** The most stops the list offers: the nearest dozen, further than a driver plans at the wheel. */
export const MOST_STOPS = 12

/** How far the truck may move before the page works its figures out again, metres (Destinations' own step). */
export const FIGURES_STEP = 250

/** What the page reads from the truck, as plain values: a fresh array or object would never compare equal in the
 * store read (`useShallow`), and the page would redraw for ever (the cab's crash, 2026-11-04). */
export interface Figures {
  /** Where the truck was, in steps: the same string while it's in the same step. */
  at: string
  /** The tank's range, metres. */
  range: number
  /** The distance left on the game's route, metres. */
  left: number
  /** Minutes until the next rest stop, and until the mandatory break (-1: not simulated). */
  rest: number
  breakIn: number
}

export function figuresOf(
  truck: Pick<Telemetry, 'x' | 'z' | 'fuelRange' | 'navigationDistance' | 'restStop' | 'mandatoryBreak'>,
): Figures {
  return {
    at: `${Math.round(truck.x / FIGURES_STEP)}:${Math.round(truck.z / FIGURES_STEP)}`,
    range: Math.round(truck.fuelRange),
    left: Math.round(truck.navigationDistance),
    rest: truck.restStop,
    breakIn: truck.mandatoryBreak,
  }
}

/** How much room to spare counts as tight, metres: under 50 km, a filling station is worth planning for. */
const TIGHT = 50_000

/** What the tank has left over the route: its margin, and how comfortable that is. */
export interface Headroom {
  /** Metres of range beyond the distance left; negative when the range doesn't reach it. */
  margin: number
  /** `short`: it doesn't reach; `tight`: under [`TIGHT`] to spare; `spare`: comfortable. */
  state: 'spare' | 'tight' | 'short'
}

/** The range against the distance left (both metres, as the game counts them). */
export function headroomOf(range: number, left: number): Headroom {
  const margin = range - left
  return { margin, state: margin < 0 ? 'short' : margin < TIGHT ? 'tight' : 'spare' }
}

/**
 * How serious a rest clock is, in minutes until it's due: a quarter of an hour is the red mark, the hour a
 * look. A profile with the simulation off sends -1, which is nothing to watch.
 */
export function hoursState(minutes: number): State {
  if (minutes < 0) return 'ok'
  return minutes <= 15 ? 'alarm' : minutes <= 60 ? 'warn' : 'ok'
}

/** The stops worth offering along the route ahead: fuel and the resting places, nearest first, at most `most`. */
export function stopsOf(ahead: readonly Ahead[], most = MOST_STOPS): Ahead[] {
  return ahead.filter(({ place }) => STOP_KINDS.includes(place.kind)).slice(0, most)
}
