import type { Telemetry } from '../../shared/host'
import { activeUnits, type Units } from '../../shared/units'
import type { Strings } from '../state/strings'
import type { NoteAction } from './notesShown'

/** One of the game's own warnings or rest clocks, worded for the cab and the cluster. */
export interface GameAlert {
  /** The reading it belongs to: the same one is one alert while it stays on. */
  key: string
  /** Whether the reading is calling for a note now (false: it has gone right again). */
  on: boolean
  title: string
  /** What the reading is now, e.g. "118 psi". */
  detail: string
  tone: 'warn' | 'alarm'
  /** The app the cab's note can open; the cluster only reads the words. */
  action: NoteAction
}

/**
 * The game's warning channels (battery, oil pressure, brake air, fuel, AdBlue) and the two rest clocks at a
 * quarter of an hour out, each with the words the cab shows. `on` is false for a reading that is right, so the
 * caller can raise a note on its rising edge and forget it once it has gone right again.
 */
export function gameAlerts(telemetry: Telemetry, text: Strings, units: Units = activeUnits()): GameAlert[] {
  const words = text.diagnostics
  const n = text.number
  const psi = (value: number) => units.pressure(value, text.decimal)
  const litres = (value: number) => units.volume(value, text.decimal)
  // Minutes as the cab writes them: "1 h 30", or "12 min".
  const minutes = (value: number) =>
    value >= 60
      ? `${n(Math.floor(value / 60))} ${words.hours} ${String(Math.floor(value % 60)).padStart(2, '0')}`
      : `${n(Math.round(value))} ${words.minutes}`
  const rest = telemetry.restStop
  const mandatoryBreak = telemetry.mandatoryBreak
  return [
    {
      key: 'battery',
      on: telemetry.batteryWarning,
      title: words.battery,
      detail: `${n(Math.round(telemetry.batteryVoltage * 10) / 10)} ${words.volts}`,
      tone: 'alarm',
      action: 'diagnostics',
    },
    {
      key: 'oilPressure',
      on: telemetry.oilPressureWarning,
      title: words.oilPressure,
      detail: psi(telemetry.oilPressure),
      tone: 'alarm',
      action: 'diagnostics',
    },
    {
      key: 'brakeAir',
      on: telemetry.brakeAirWarning,
      title: words.brakeAir,
      detail: psi(telemetry.brakeAirPressure),
      tone: 'alarm',
      action: 'diagnostics',
    },
    {
      key: 'fuel',
      on: telemetry.fuelWarning,
      title: words.fuel,
      detail: litres(telemetry.fuel),
      tone: 'alarm',
      action: 'maps',
    },
    {
      key: 'adblue',
      on: telemetry.adblueWarning,
      title: words.adblue,
      detail: litres(telemetry.adblue),
      tone: 'alarm',
      action: 'maps',
    },
    {
      key: 'rest',
      on: rest >= 0 && rest <= 15,
      title: words.restStop,
      detail: minutes(Math.max(0, rest)),
      tone: 'warn',
      action: 'maps',
    },
    {
      key: 'mandatoryBreak',
      on: mandatoryBreak >= 0 && mandatoryBreak <= 15,
      title: words.mandatoryBreak,
      detail: minutes(Math.max(0, mandatoryBreak)),
      tone: 'warn',
      action: 'maps',
    },
  ]
}
