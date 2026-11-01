import { describe, expect, it } from 'vitest'
import {
  adblue,
  battery,
  brakeAir,
  brakeTemperature,
  consumption,
  coolant,
  oilPressure,
  warned,
  wear,
  worst,
} from './readings'

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

  it('watches oil pressure, the battery and AdBlue from the low side', () => {
    expect(oilPressure(45).state).toBe('ok')
    expect(oilPressure(20).state).toBe('warn')
    expect(oilPressure(12).state).toBe('alarm')
    expect(battery(27.6).state).toBe('ok')
    expect(battery(23).state).toBe('warn')
    expect(battery(21).state).toBe('alarm')
    expect(adblue(40).state).toBe('ok')
    expect(adblue(10).state).toBe('warn')
    expect(adblue(4).state).toBe('alarm')
  })

  it("takes the game's own warning over the gauge's own threshold", () => {
    expect(warned(battery(27.6), false).state).toBe('ok')
    expect(warned(battery(27.6), true).state).toBe('alarm')
    expect(warned(oilPressure(45), true).state).toBe('alarm')
    // Already an alarm: it stays one, and the reading is unchanged.
    expect(warned(battery(21), true).state).toBe('alarm')
    expect(warned(battery(21), true).value).toBe(21)
  })

  it('calls a thirsty truck out from above', () => {
    expect(consumption(30).state).toBe('ok')
    expect(consumption(30).percent).toBeCloseTo(0.5)
    expect(consumption(45).state).toBe('warn')
    expect(consumption(55).state).toBe('alarm')
  })
})
