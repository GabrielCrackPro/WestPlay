import { describe, expect, it } from 'vitest'
import { stopsAhead } from './stopsAhead'

/** Node distances as the game sends them: one entry per map node, index 0 unused, the rest metres left. */
const distancesOf = (...left: number[]) => left

describe('the stops ahead on a route', () => {
  it('works each one out from the game’s own distance and time left', () => {
    // 300 km left, 360 minutes: nodes 1 and 2 are 100 and 250 of it along.
    const stops = stopsAhead([1, 2], distancesOf(0, 200_000, 50_000), 0, 300_000, 360 * 60, 600)
    expect(stops.map((stop) => stop.number)).toEqual([1, 2])
    expect(stops.map((stop) => stop.distance)).toEqual([100_000, 250_000])
    expect(stops.map((stop) => stop.minutes)).toEqual([120, 300])
    expect(stops.map((stop) => stop.arrival)).toEqual([720, 900])
  })

  it('leaves out the stops behind the truck and the one it’s at', () => {
    // The truck is between nodes 1 and 2 (next 2): 1 is behind it, 3 is where it is, 2 is ahead.
    const stops = stopsAhead([1, 2, 3], distancesOf(0, 250_000, 200_000, 300_000), 2, 300_000, 360 * 60, 600)
    expect(stops.map((stop) => stop.number)).toEqual([2])
  })

  it('numbers the stops as the player added them', () => {
    // The third and fourth of five stops, the truck past the first two.
    const stops = stopsAhead(
      [1, 2, 3, 4, 5],
      distancesOf(0, 500_000, 400_000, 300_000, 200_000, 100_000),
      3,
      600_000,
      600 * 60,
      0,
    )
    expect(stops.map((stop) => stop.number)).toEqual([3, 4, 5])
  })

  it('shows only the nearest few, and nothing without a route left', () => {
    const stops = stopsAhead(
      [1, 2, 3, 4, 5],
      distancesOf(0, 500_000, 400_000, 300_000, 200_000, 100_000),
      0,
      600_000,
      600 * 60,
      0,
    )
    expect(stops).toHaveLength(4)
    expect(stopsAhead([1], distancesOf(0, 500_000), 0, 0, 0, 0)).toEqual([])
  })
})
