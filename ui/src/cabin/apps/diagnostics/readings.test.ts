import { describe, expect, it } from 'vitest'
import { brakeAir, brakeTemperature, coolant, wear, worst } from './readings'

describe("the Diagnostics app's readings", () => {
  it('fills a gauge from the bottom of its range to the top', () => {
    expect(coolant(40).percent).toBe(0)
    expect(coolant(80).percent).toBeCloseTo(0.5)
    expect(coolant(120).percent).toBe(1)
    // A cold engine under the range's bottom doesn't draw a negative gauge.
    expect(coolant(-20).percent).toBe(0)
  })

  it('calls a working engine normal and an overheating one an alarm', () => {
    expect(coolant(88).state).toBe('ok')
    expect(coolant(104).state).toBe('warn')
    expect(coolant(112).state).toBe('alarm')
  })

  it('turns serious when the brake air runs low, not when it is plentiful', () => {
    expect(brakeAir(120).state).toBe('ok')
    expect(brakeAir(80).state).toBe('warn')
    expect(brakeAir(50).state).toBe('alarm')
  })

  it('knows hot brakes and worn tires', () => {
    expect(brakeTemperature(90).state).toBe('ok')
    expect(brakeTemperature(320).state).toBe('warn')
    expect(brakeTemperature(500).state).toBe('alarm')
    expect(wear(0.2).state).toBe('ok')
    expect(wear(0.6).state).toBe('warn')
    expect(wear(0.9).state).toBe('alarm')
  })

  it('takes the more serious of two readings', () => {
    expect(worst('ok', 'warn')).toBe('warn')
    expect(worst('alarm', 'warn')).toBe('alarm')
    expect(worst('ok', 'ok')).toBe('ok')
  })
})
