import { distanceTo, MAP_SCALE, type Destination } from './places'

/**
 * The card under turn-by-turn (NearbyStopCard.tsx): the nearest filling station or rest area to the truck, and
 * when that card is worth showing. The map's `parking` places are the game's resting places (crates/mapdata
 * area.rs: rest triggers and parking areas), its `fuel` ones its filling stations.
 */

export type StopKind = 'fuel' | 'rest'

const KIND_OF: Partial<Record<Destination['kind'], StopKind>> = { fuel: 'fuel', parking: 'rest' }

export interface NearbyStop {
  place: Destination
  kind: StopKind
  /** How far it is in a straight line, in the units the game's GPS gives distances in. */
  distance: number
}

/** The nearer of the nearest filling station and the nearest rest area; `null` without either. */
export function nearestStop(places: readonly Destination[], from: [number, number] | null): NearbyStop | null {
  if (!from) return null
  let best: NearbyStop | null = null
  for (const place of places) {
    const kind = KIND_OF[place.kind]
    if (!kind) continue
    const distance = distanceTo(place, from) * MAP_SCALE
    if (best === null || distance < best.distance) best = { place, kind, distance }
  }
  return best
}

/** The fuel levels the card can watch for (percent of the tank), as Settings › Maps offers them. */
export const STOP_CARD_FUEL_LEVELS = [10, 15, 20, 25, 30, 40] as const

/** The rests the card can watch for (minutes until the game asks for one), as Settings › Maps offers them. */
export const STOP_CARD_REST_MINUTES = [15, 30, 45, 60, 90, 120] as const

/** When the card is shown: always, or only as the tank or the driver's hours run low (Settings › Maps). */
export interface StopCardRule {
  always: boolean
  /** Below this share of the tank, percent. */
  fuelBelow: number
  /** When the next rest is this close, minutes. */
  restWithin: number
}

export interface StopCardState {
  /** The tank's fill, 0 to 1; `null` when the game hasn't said how big the tank is. */
  fuel: number | null
  /** The game's own low-fuel warning. */
  fuelWarning: boolean
  /** Minutes until the next rest (-1: the game isn't simulating one). */
  restIn: number
}

/** Whether the card belongs on the map now. */
export function stopCardShown(rule: StopCardRule, state: StopCardState): boolean {
  if (rule.always) return true
  if (state.fuelWarning) return true
  if (state.fuel !== null && state.fuel * 100 <= rule.fuelBelow) return true
  return state.restIn >= 0 && state.restIn <= rule.restWithin
}
