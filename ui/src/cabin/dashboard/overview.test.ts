import { describe, expect, it } from 'vitest'
import { fuelShare, gearLabel, routeShare } from './overview'

describe('gearLabel', () => {
  it('says reverse and neutral, and numbers the gears', () => {
    expect(gearLabel(-1)).toBe('R')
    expect(gearLabel(0)).toBe('N')
    expect(gearLabel(1)).toBe('1')
    expect(gearLabel(12)).toBe('12')
  })
})

describe('fuelShare', () => {
  it('is the tank’s share, kept within it', () => {
    expect(fuelShare(450, 900)).toBe(0.5)
    expect(fuelShare(-20, 900)).toBe(0)
    expect(fuelShare(1000, 900)).toBe(1)
  })

  it('is null when the game hasn’t said how big the tank is', () => {
    expect(fuelShare(450, 0)).toBeNull()
    expect(fuelShare(450, Number.NaN)).toBeNull()
  })
})

describe('routeShare', () => {
  it('is the route’s done share', () => {
    expect(routeShare(0, 200_000)).toBe(1)
    expect(routeShare(100_000, 200_000)).toBe(0.5)
  })

  it('is null without a route length, and never past its ends', () => {
    expect(routeShare(100_000, 0)).toBeNull()
    expect(routeShare(300_000, 200_000)).toBe(0)
  })
})
