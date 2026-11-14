import { describe, expect, it } from 'vitest'
import type { Telemetry, TruckInfo } from '../../shared/host'
import { STRINGS } from '../state/strings'
import { DAMAGE_STOP, DAMAGE_WARN } from '../state/warnings'
import { type Telltale, buildTelltales } from './telltales'

const words = STRINGS.en.diagnostics
// The wear figures the builder takes a maximum over: a partial reading would make the maximum NaN and lose the lamp.
const unworn = {
  wearEngine: 0,
  wearWheels: 0,
  wearTransmission: 0,
  wearCabin: 0,
  wearChassis: 0,
  trailerWearWheels: 0,
  trailerWearBody: 0,
  trailerWearChassis: 0,
  retarderLevel: 0,
}

function rows(telemetry: Partial<Telemetry> = {}, truck: Partial<TruckInfo> | null = null, warnings = true) {
  return buildTelltales({
    telemetry: { ...unworn, ...telemetry } as Telemetry,
    truck: truck as TruckInfo | null,
    warnings,
    words,
  })
}

const keys = (rows: Telltale[]) => rows.map((row) => row.key)
const lamp = (faults: Telltale[], key: string) => faults.find((fault) => fault.key === key)

describe('buildTelltales', () => {
  it('takes the whole warnings row off with the warnings switch, the damage lamp included', () => {
    const off = rows({ fuelWarning: true, brakeAirWarning: true, wearEngine: 0.4 }, null, false)
    expect(off.faults.filter((fault) => fault.active)).toEqual([])

    const on = rows({ fuelWarning: true, brakeAirWarning: true, wearEngine: 0.4 })
    expect(lamp(on.faults, 'fuel')?.active).toBe(true)
    expect(lamp(on.faults, 'air')?.active).toBe(true)
    expect(lamp(on.faults, 'damage')?.active).toBe(true)
  })

  it('only puts the retarder and the trailer in the lights row when the truck has them', () => {
    const solo = rows()
    expect(keys(solo.lights)).not.toContain('retarder')
    expect(keys(solo.lights)).not.toContain('trailer')

    const hitched = rows({ retarderLevel: 2, trailerAttached: true }, { retarderSteps: 3 })
    expect(keys(hitched.lights)).toEqual(expect.arrayContaining(['retarder', 'trailer']))
    expect(lamp(hitched.lights, 'retarder')?.active).toBe(true)
    expect(lamp(hitched.lights, 'trailer')?.active).toBe(true)

    // A retarder truck with the lever at rest still has the slot; it is simply out.
    const resting = rows({ retarderLevel: 0 }, { retarderSteps: 3 })
    expect(lamp(resting.lights, 'retarder')?.active).toBe(false)
  })

  it('lights the damage lamp at the game’s warning and stop thresholds', () => {
    expect(lamp(rows({ wearChassis: DAMAGE_WARN - 0.001 }).faults, 'damage')).toBeUndefined()
    expect(lamp(rows({ wearChassis: DAMAGE_WARN }).faults, 'damage')?.tone).toBe('warn')
    expect(lamp(rows({ wearChassis: DAMAGE_STOP }).faults, 'damage')?.tone).toBe('danger')
  })

  it('adds a trailer wear lamp while one is hitched, off with the warnings switch', () => {
    const solo = rows({ trailerWearBody: 0.9 })
    expect(lamp(solo.faults, 'trailerWear')).toBeUndefined()
    expect(solo.trailerDamage).toBeNull()

    const hitched = rows({ trailerAttached: true, trailerWearBody: 0.2 })
    expect(hitched.trailerDamage).toBe(0.2)
    expect(lamp(hitched.faults, 'trailerWear')).toMatchObject({ label: words.trailerWear, tone: 'warn', active: true })
    expect(lamp(rows({ trailerAttached: true, trailerWearChassis: 0.6 }).faults, 'trailerWear')?.tone).toBe('danger')
    expect(lamp(rows({ trailerAttached: true, trailerWearBody: 0.2 }, null, false).faults, 'trailerWear')?.active).toBe(
      false,
    )
  })

  it('names and tints the beams as the dash shows them', () => {
    const low = rows({ lowBeam: true }).lights.find((light) => light.key === 'beam')
    expect(low).toMatchObject({ label: words.lowBeam, tone: 'ok', active: true })

    const high = rows({ highBeam: true }).lights.find((light) => light.key === 'beam')
    expect(high).toMatchObject({ label: words.highBeam, tone: 'info', active: true })
  })
})
