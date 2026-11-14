import { describe, expect, it } from 'vitest'
import { advanceTrip, clock, sparklinePoints, tripAverage, TRIP_START, type Trip } from './trip'

/** A trip already underway, standing at `odometer` a second ago. */
function running(over: Partial<Trip> = {}): Trip {
  return { ...TRIP_START, odometer: 34_000, at: 1_000, ...over }
}

const frame = { odometer: 34_001, fuelAverage: 30, engineEnabled: true, moving: true }

describe("the Diagnostics app's trip computer", () => {
  it('adds the distance between frames and the fuel the average says it took', () => {
    const trip = advanceTrip(running(), frame, 3_000)
    expect(trip.distance).toBeCloseTo(1)
    expect(trip.fuel).toBeCloseTo(0.3)
    expect(trip.moving).toBeCloseTo(2)
    expect(trip.idle).toBe(0)
    expect(tripAverage(trip)).toBeCloseTo(30)
  })

  it('counts standing still with the engine on as idle, not moving', () => {
    const trip = advanceTrip(running(), { ...frame, odometer: 34_000, moving: false }, 2_000)
    expect(trip.distance).toBe(0)
    expect(trip.moving).toBe(0)
    expect(trip.idle).toBeCloseTo(1)
  })

  it('takes a jumped odometer (a save loaded, a ferry) as no driving at all', () => {
    const trip = advanceTrip(running(), { ...frame, odometer: 36_000 }, 2_000)
    expect(trip.distance).toBe(0)
    expect(trip.fuel).toBe(0)
    expect(trip.odometer).toBe(36_000)
  })

  it('adds nothing while the engine is off, and follows the truck still', () => {
    const trip = advanceTrip(running(), { ...frame, engineEnabled: false }, 9_000)
    expect(trip.distance).toBe(0)
    expect(trip.moving).toBe(0)
    expect(trip.idle).toBe(0)
    expect(trip.odometer).toBe(34_001)
  })

  it('has no average until it has covered something, and writes time as the cab does', () => {
    expect(tripAverage(TRIP_START)).toBe(0)
    expect(clock(48)).toBe('0:48')
    expect(clock(3_966)).toBe('66:06')
    expect(clock(-4)).toBe('0:00')
  })

  it('draws a sparkline across the box, high values near its top', () => {
    const rising = sparklinePoints([10, 20, 30])
    expect(rising.split(' ')).toHaveLength(3)
    const [, first] = rising.split(' ')[0].split(',').map(Number)
    const [, last] = rising.split(' ')[2].split(',').map(Number)
    // A rising reading goes up the box: its last sample sits above its first.
    expect(last).toBeLessThan(first)
    // One sample is no line, and a flat one is straight across its middle.
    expect(sparklinePoints([42])).toBe('')
    const flat = sparklinePoints([42, 42]).split(' ')
    expect(flat[0].split(',')[1]).toBe(flat[1].split(',')[1])
  })
})
