import { describe, expect, it } from 'vitest'
import { alertsWorthReading, type GameAlert } from './gameAlerts'

/** An alert as the game's channels hand them over: only the key matters to these rules. */
const alert = (key: string): GameAlert => ({
  key,
  on: true,
  title: key,
  detail: '',
  tone: 'alarm',
  action: 'diagnostics',
})

const alerts = [alert('battery'), alert('oilPressure'), alert('brakeAir'), alert('fuel')]
const keys = (reading: readonly GameAlert[]) => reading.map((each) => each.key)

describe('the alerts worth reading', () => {
  it('says nothing at all while the truck is starting', () => {
    // Its first seconds are the compressor, the oil pump and the lamps' own checks — none of it the drive's news.
    expect(keys(alertsWorthReading(alerts, { settled: false, running: true, airUp: true }))).toEqual([])
    expect(keys(alertsWorthReading(alerts, { settled: false, running: false, airUp: false }))).toEqual([])
  })

  it('reads the oil and the battery only while the engine runs', () => {
    // Parked with the engine off, as a truck is while its job is read: no pump, no alternator, so nothing to report.
    expect(keys(alertsWorthReading(alerts, { settled: true, running: false, airUp: true }))).toEqual([
      'brakeAir',
      'fuel',
    ])
  })

  it('leaves the brake air out until its tanks have been up, and keeps the rest', () => {
    // Settled and running, but the air has not been up yet: a low reading is the tanks filling.
    expect(keys(alertsWorthReading(alerts, { settled: true, running: true, airUp: false }))).toEqual([
      'battery',
      'oilPressure',
      'fuel',
    ])
  })

  it('reads every alert once the air has been up', () => {
    expect(keys(alertsWorthReading(alerts, { settled: true, running: true, airUp: true }))).toEqual([
      'battery',
      'oilPressure',
      'brakeAir',
      'fuel',
    ])
  })
})
