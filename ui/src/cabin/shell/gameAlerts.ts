import type { Telemetry } from '../../shared/host'
import { activeUnits, type Units } from '../../shared/units'
import type { Strings } from '../state/strings'
import { type AlertStart, truckWarningOn } from '../state/warnings'
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
 *
 * The brake air is included as the game reports it, start-up flag and all; the surfaces that *say* a warning aloud
 * pass this through `alertsWorthReading` first, so the tanks filling on the key are not announced (state/warnings.ts,
 * `airUpNow`).
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
      on: truckWarningOn(telemetry, 'battery'),
      title: words.battery,
      detail: `${n(Math.round(telemetry.batteryVoltage * 10) / 10)} ${words.volts}`,
      tone: 'alarm',
      action: 'diagnostics',
    },
    {
      key: 'oilPressure',
      on: truckWarningOn(telemetry, 'oil'),
      title: words.oilPressure,
      detail: psi(telemetry.oilPressure),
      tone: 'alarm',
      action: 'diagnostics',
    },
    {
      key: 'brakeAir',
      on: truckWarningOn(telemetry, 'air'),
      title: words.brakeAir,
      detail: psi(telemetry.brakeAirPressure),
      tone: 'alarm',
      action: 'diagnostics',
    },
    {
      key: 'fuel',
      on: truckWarningOn(telemetry, 'fuel'),
      title: words.fuel,
      detail: litres(telemetry.fuel),
      tone: 'alarm',
      action: 'maps',
    },
    {
      key: 'adblue',
      on: truckWarningOn(telemetry, 'adblue'),
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

/**
 * The alerts worth reading aloud, given how far the truck's start has got (`start`, state/warnings.ts `useAlertStart`):
 *
 * - The first seconds are its checks and nothing else — the compressor filling the tanks, the oil pump on the key — so
 *   none of them is said, and what is still wrong once they have passed is said then (nothing is recorded as already
 *   said in the meantime, so a real fault still gets its one note).
 * - The brake air keeps quiet for longer: the game loads a truck with empty tanks and fills them as it runs, so a low
 *   reading only counts once the air has been up at least once.
 * - Oil pressure and the battery are read only while the engine runs: with it off (as a truck sits at the start of every
 *   drive) there is no pump and no alternator, so their lamps are on by design rather than because anything is wrong.
 *
 * Everything else — the rest clocks included — is read as the game reports it.
 */
export function alertsWorthReading(alerts: readonly GameAlert[], start: AlertStart): GameAlert[] {
  if (!start.settled) return []
  return alerts.filter(
    (alert) => (start.airUp || alert.key !== 'brakeAir') && (start.running || !ENGINE_ONLY.has(alert.key)),
  )
}

/** The readings that are wrong with the engine off because of it: no oil pump, no alternator. */
const ENGINE_ONLY: ReadonlySet<string> = new Set(['battery', 'oilPressure'])
