import { describe, expect, it } from 'vitest'
import type { Telemetry } from '../../shared/host'
import { STRINGS } from '../state/strings'
import { driverHoursView } from './hours'

const text = STRINGS.en
// Thursday (day 3), 14:00, with two hours and ten minutes of driving left.
const telemetry = {
  gameTime: 3 * 1440 + 14 * 60,
  navigationDistance: 214_000,
  navigationTime: 2 * 3600 + 10 * 60,
  fuelRange: 1_241_000,
  restStop: 90,
  mandatoryBreak: 30,
} as Telemetry

describe('driverHoursView', () => {
  it('shows both rest clocks, the trip’s arrival and its distance', () => {
    expect(driverHoursView(telemetry, text, 0)).toEqual({
      rest: '1:30 hrs',
      restState: 'ok',
      break: '30 min',
      breakState: 'warn',
      detail: '16:10 arrival · 214 km',
      due: true,
    })
  })

  it('turns a rest due within the hour into a warning, and within a quarter of an hour into an alarm', () => {
    expect(driverHoursView({ ...telemetry, restStop: 60 }, text, 0).restState).toBe('warn')
    expect(driverHoursView({ ...telemetry, restStop: 15 }, text, 0).restState).toBe('alarm')
    expect(driverHoursView({ ...telemetry, restStop: 61 }, text, 0).restState).toBe('ok')
  })

  it('says when the profile has the game’s rest simulation off', () => {
    const off = driverHoursView({ ...telemetry, restStop: -1, mandatoryBreak: -1 }, text, 0)
    expect(off.rest).toBe('Off in this profile')
    expect(off.break).toBe('Off in this profile')
    expect(off.restState).toBe('ok')
    expect(off.due).toBe(false)
  })

  it('without a route, shows the fuel’s range instead of an arrival', () => {
    const parked = driverHoursView({ ...telemetry, navigationDistance: 0, navigationTime: 0 }, text, 0)
    expect(parked.detail).toBe('1241 km range')
  })

  it('counts the clocks and the arrival in the cab’s time zone', () => {
    // An hour on (Finland, with the game's time zones on).
    expect(driverHoursView(telemetry, text, 60).detail).toBe('17:10 arrival · 214 km')
  })
})
