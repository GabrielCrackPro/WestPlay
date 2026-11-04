import { shallow } from 'zustand/shallow'
import { describe, expect, it } from 'vitest'
import { figuresOf, headroomOf, hoursState, stopsOf } from './stopsPlan'
import type { Ahead } from './alongRoute'
import type { Destination, DestinationKind } from './places'

function place(kind: DestinationKind, name: string): Destination {
  return { kind, name, at: [0, 0], node: name }
}

function ahead(kind: DestinationKind, name: string, along: number): Ahead {
  return { place: place(kind, name), along, off: 20 }
}

describe('the range against the route left', () => {
  it('is short when the tank doesn’t reach the destination', () => {
    expect(headroomOf(340_000, 410_000)).toEqual({ margin: -70_000, state: 'short' })
  })

  it('is tight under fifty kilometres to spare', () => {
    expect(headroomOf(360_000, 340_000)).toEqual({ margin: 20_000, state: 'tight' })
    expect(headroomOf(390_000, 340_000)).toEqual({ margin: 50_000, state: 'spare' })
  })

  it('is spare with room to spare', () => {
    expect(headroomOf(1_241_000, 214_000)).toEqual({ margin: 1_027_000, state: 'spare' })
  })
})

describe('a rest clock', () => {
  it('is an alarm in its last quarter of an hour, a warning within the hour', () => {
    expect(hoursState(15)).toBe('alarm')
    expect(hoursState(16)).toBe('warn')
    expect(hoursState(60)).toBe('warn')
    expect(hoursState(61)).toBe('ok')
  })

  it('is nothing to watch with the simulation off', () => {
    expect(hoursState(-1)).toBe('ok')
  })
})

describe('the stops the page offers', () => {
  it('keeps fuel and the resting places, in the order they come along the route', () => {
    const found = stopsOf([
      ahead('fuel', 'first', 4_000),
      ahead('company', 'a company', 6_000),
      ahead('parking', 'a park', 9_000),
      ahead('hotel', 'a hotel', 12_000),
      ahead('service', 'a service area', 15_000),
    ])
    expect(found.map(({ place }) => place.name)).toEqual(['first', 'a park', 'a hotel', 'a service area'])
  })

  it('offers only the nearest few', () => {
    const many = Array.from({ length: 20 }, (_, index) => ahead('fuel', `stop ${index}`, (index + 1) * 1000))
    expect(stopsOf(many)).toHaveLength(12)
    expect(stopsOf(many, 3).map(({ along }) => along)).toEqual([1000, 2000, 3000])
  })

  it('is empty when nothing beside the route is a stop', () => {
    expect(stopsOf([ahead('city', 'a city', 5_000)])).toEqual([])
  })
})

describe('the figures the page reads from the truck', () => {
  // The truck's readings at one moment, as a store update hands them over.
  const truck = {
    x: 1234.5,
    z: -987.25,
    fuelRange: 340_020,
    navigationDistance: 410_490,
    restStop: 42.4,
    mandatoryBreak: 130.8,
  }

  it('are the game’s own distances and clocks, and the step the truck is in', () => {
    expect(figuresOf(truck)).toEqual({ at: '5:-4', range: 340_020, left: 410_490, rest: 42.4, breakIn: 130.8 })
  })

  // The crash (owner 2026-11-04): an array or object made afresh on every read never compares equal, so the page
  // re-rendered for ever and the cab never opened the Maps app again, even across restarts.
  it('read as values that compare equal while nothing shown has changed', () => {
    expect(shallow(figuresOf(truck), figuresOf(truck))).toBe(true)
    expect(shallow(figuresOf(truck), figuresOf({ ...truck, x: 1234.5 + 250 }))).toBe(false)
  })
})
