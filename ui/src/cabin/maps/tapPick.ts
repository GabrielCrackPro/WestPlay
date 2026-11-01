import type { Destination } from './places'
import { fromLngLat } from './projection'
import type { Point } from './route'

/**
 * Which place a tap on the map was meant for: the nearest one to where it landed, if any is within `within`
 * metres of it (the game's ground). What a finger covers is worked out from the zoom by the map that took the
 * tap (liveMap.ts), so a tap on a badge at street level doesn't pick a place across town.
 */
export function nearestPlace(
  places: readonly Destination[] | null | undefined,
  at: Point,
  within: number,
): Destination | null {
  if (!places) return null
  let best: Destination | null = null
  let bestDistance = within
  for (const place of places) {
    const point = fromLngLat(...place.at)
    const distance = Math.hypot(point[0] - at[0], point[1] - at[1])
    if (distance <= bestDistance) {
      best = place
      bestDistance = distance
    }
  }
  return best
}
