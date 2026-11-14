import { describe, expect, it } from 'vitest'
import type { Telemetry } from '../../shared/host'
import { STRINGS } from './strings'
import { airUpNow, TRUCK_WARNING_KEYS, anyTruckWarning, truckWarningOn, truckWarnings } from './warnings'

const words = STRINGS.en.diagnostics

describe('truck warnings', () => {
  it('reads each game warning from its own flag', () => {
    const telemetry = { fuelWarning: true, brakeAirWarning: true } as Telemetry
    expect(truckWarningOn(telemetry, 'fuel')).toBe(true)
    expect(truckWarningOn(telemetry, 'air')).toBe(true)
    expect(truckWarningOn(telemetry, 'oil')).toBe(false)
    expect(truckWarningOn(null, 'fuel')).toBe(false)
    expect(anyTruckWarning(telemetry)).toBe(true)
    expect(anyTruckWarning({} as Telemetry)).toBe(false)
  })

  it('counts the brake air as up only once its flag has been down, and from then on', () => {
    // No truck yet: nothing to read.
    expect(airUpNow(false, null)).toBe(false)
    // Loaded with empty tanks: the flag is the compressor's work, not a fault (yet).
    expect(airUpNow(false, { brakeAirWarning: true } as Telemetry)).toBe(false)
    expect(airUpNow(false, { brakeAirWarning: false } as Telemetry)).toBe(true)
    // Up once, it stays up: a truck that has had air and is low now is losing it.
    expect(airUpNow(true, { brakeAirWarning: true } as Telemetry)).toBe(true)
    expect(airUpNow(true, null)).toBe(true)
  })

  it('lists the warnings in the dash’s order with the cab’s words', () => {
    const telemetry = { fuelWarning: true, batteryWarning: true } as Telemetry
    expect(TRUCK_WARNING_KEYS).toEqual(['fuel', 'adblue', 'battery', 'oil', 'air'])
    expect(truckWarnings(telemetry, words).map(({ key, label, on }) => ({ key, label, on }))).toEqual([
      { key: 'fuel', label: words.fuel, on: true },
      { key: 'adblue', label: words.adblue, on: false },
      { key: 'battery', label: words.battery, on: true },
      { key: 'oil', label: words.oilPressure, on: false },
      { key: 'air', label: words.brakeAir, on: false },
    ])
  })
})
