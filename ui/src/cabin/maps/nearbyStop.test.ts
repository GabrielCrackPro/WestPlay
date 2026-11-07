import { describe, expect, it } from 'vitest'
import { nearestStop, stopCardShown } from './nearbyStop'
import type { Destination } from './places'

const place = (kind: Destination['kind'], at: [number, number]): Destination => ({
  kind,
  at,
  node: `${kind}:${at[0]}:${at[1]}`,
})

describe('the nearest stop', () => {
  it('is the nearer of the nearest filling station and rest area', () => {
    const fuel = place('fuel', [0.01, 0])
    const rest = place('parking', [0.02, 0])
    // Other kinds (a garage, a company) are not stops the card offers.
    const places = [place('garage', [0.001, 0]), fuel, rest]
    expect(nearestStop(places, [0, 0])).toMatchObject({ place: fuel, kind: 'fuel' })
    expect(nearestStop([places[0], rest], [0, 0])).toMatchObject({ place: rest, kind: 'rest' })
  })

  it('is null without a truck or without a stop', () => {
    expect(nearestStop([place('fuel', [0.01, 0])], null)).toBeNull()
    expect(nearestStop([place('garage', [0.01, 0])], [0, 0])).toBeNull()
  })
})

describe('when the stop card shows', () => {
  const rule = { always: false, fuelBelow: 25, restWithin: 60 }
  const calm = { fuel: 0.8, fuelWarning: false, restIn: 240 }

  it('always, whatever the truck says', () => {
    expect(stopCardShown({ ...rule, always: true }, calm)).toBe(true)
  })

  it('under the fuel level, or on the game’s own low-fuel warning', () => {
    expect(stopCardShown(rule, { ...calm, fuel: 0.25 })).toBe(true)
    expect(stopCardShown(rule, { ...calm, fuel: 0.26 })).toBe(false)
    expect(stopCardShown(rule, { ...calm, fuel: null, fuelWarning: true })).toBe(true)
  })

  it('as the next rest comes within the chosen time', () => {
    expect(stopCardShown(rule, { ...calm, restIn: 60 })).toBe(true)
    expect(stopCardShown(rule, { ...calm, restIn: 61 })).toBe(false)
    // The simulation off (-1) is nothing to watch.
    expect(stopCardShown(rule, { ...calm, restIn: -1 })).toBe(false)
  })
})
