/**
 * The player's stops still ahead on the game's route: each one's distance and time, as its GPS counts them,
 * and when the truck gets there. The game gives a time for the whole route only; a stop's is its share of
 * it, by distance (the stretch to it as fast as the rest), as `nextStop` does for the first one.
 */

export interface StopAhead {
  /** Its place among the player's stops: 1 for the first they added. */
  number: number
  /** Metres to it, as the game counts them. */
  distance: number
  /** Minutes to it, on the game's clock. */
  minutes: number
  /** When the truck gets there, in game minutes (`cabClock`). */
  arrival: number
}

/**
 * `stops`: the stops' map node indices in the route (ascending); `distances`: each node's distance left to the
 * destination; `next`: the index of the map node ahead of the truck; `left` and `seconds`: the distance and
 * time left to the destination (the SDK's); `now`: the game's clock. `most`: how many of the nearest are
 * returned.
 */
export function stopsAhead(
  stops: readonly number[],
  distances: readonly number[],
  next: number,
  left: number,
  seconds: number,
  now: number,
  most = 4,
): StopAhead[] {
  if (left <= 0) return []
  const found: StopAhead[] = []
  stops.forEach((stop, index) => {
    const distance = left - (distances[stop] ?? left)
    // Behind the truck, or where it already is: not one to show.
    if (stop < next || distance <= 0) return
    // Whole minutes: the strip writes them out, and a rounding error mustn't make two runs of the same route
    // differ.
    const minutes = Math.round((seconds / 60) * (distance / left))
    found.push({ number: index + 1, distance, minutes, arrival: now + minutes })
  })
  return found.slice(0, most)
}
