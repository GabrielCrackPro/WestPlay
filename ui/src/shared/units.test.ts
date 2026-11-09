import { describe, expect, it } from 'vitest'
import { unitsForSystem } from './units'

const metric = unitsForSystem('metric')
const uk = unitsForSystem('uk')
const us = unitsForSystem('us')

describe('units', () => {
  it('reads speed in the driver’s units', () => {
    // 25 m/s is 90 km/h, a little over 56 mph.
    expect(metric.speed(25)).toBe(90)
    expect(uk.speed(25)).toBe(56)
    expect(us.speed(-25)).toBe(56)
  })

  it('posts a limit as its sign does, in fives where it is miles', () => {
    // 50 km/h is a 50 sign at home, and a 30 sign in Britain (31 mph rounded to the nearest five).
    expect(metric.limit(50 / 3.6)).toBe(50)
    expect(uk.limit(50 / 3.6)).toBe(30)
    // A 20 mph sign is 32 km/h: in Europe it reads 32, in Britain 20.
    expect(uk.limit(32 / 3.6)).toBe(20)
    expect(us.limit(32 / 3.6)).toBe(20)
  })

  it('formats short distances as a map does, in each system', () => {
    expect(metric.distance(42)).toBe('40 m')
    expect(metric.distance(9420, ',')).toBe('9,4 km')
    expect(metric.distance(67_703)).toBe('68 km')
    // Under a tenth of a mile, feet; past it, miles to a tenth, then whole miles.
    expect(uk.distance(30)).toBe('100 ft')
    expect(us.distance(1609.344 / 2, ',')).toBe('0,5 mi')
    expect(uk.distance(1609.344 * 12)).toBe('12 mi')
  })

  it('formats long distances and keeps a short one to a decimal', () => {
    expect(metric.longDistance(214.4)).toBe('214 km')
    expect(uk.longDistance(4.8, ',')).toBe('3,0 mi')
    expect(us.longDistance(214.4)).toBe('133 mi')
  })

  it('reads the tank in litres, or gallons in the US', () => {
    expect(metric.volume(412.6)).toBe('413 l')
    expect(uk.volume(412.6)).toBe('413 l')
    expect(us.volume(412.6, ',')).toBe('109,0 gal')
  })

  it('reads consumption as l/100 km or mpg, the gallons each country’s own', () => {
    expect(metric.consumption(31.24, ',')).toBe('31,2 l/100 km')
    // 31.24 l/100 km is 7.52 US mpg and 9.04 imperial mpg.
    expect(us.consumption(31.24)).toBe('7.5 mpg')
    expect(uk.consumption(31.24)).toBe('9.0 mpg')
    // Idling: no distance, so no miles to the gallon.
    expect(us.consumption(0)).toBe('—')
  })

  it('reads temperatures and pressures as the dash does', () => {
    expect(metric.temperature(88.2)).toBe('88 °C')
    expect(uk.temperature(88.2)).toBe('88 °C')
    expect(us.temperature(88.2)).toBe('191 °F')
    // 120 psi is 8.3 bar.
    expect(metric.pressure(120)).toBe('8.3 bar')
    expect(us.pressure(120)).toBe('120 psi')
  })

  it('gives the dial a face that fits its unit', () => {
    expect(metric.face).toEqual({ max: 120, step: 20, minor: 10 })
    expect(us.face).toEqual({ max: 80, step: 10, minor: 5 })
    expect(us.labels.speed).toBe('mph')
  })
})
