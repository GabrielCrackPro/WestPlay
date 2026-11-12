import type { Telemetry } from '../../shared/host'
import type { Strings } from './strings'

/**
 * The game's own warning channels, in the order the dash lights them: the flag each reads and the word the cab calls
 * it by. Every surface that reads these — the cluster's lamp row, the Dashboard's chips, the Diagnostics trends and the
 * cab's notes — goes through this table, so a warning can't be added to one screen and forgotten on another.
 */
export const TRUCK_WARNING_FLAGS = {
  fuel: 'fuelWarning',
  adblue: 'adblueWarning',
  battery: 'batteryWarning',
  oil: 'oilPressureWarning',
  air: 'brakeAirWarning',
} as const

export type TruckWarning = keyof typeof TRUCK_WARNING_FLAGS

/** The channels in the dash's order (Object.keys would also be the declaration order, but this is explicit). */
export const TRUCK_WARNING_KEYS: TruckWarning[] = ['fuel', 'adblue', 'battery', 'oil', 'air']

/** Out of range at which the dash lights its warning lamp, and its stop lamp (the game's 15% and 50%). */
export const DAMAGE_WARN = 0.15
export const DAMAGE_STOP = 0.5

/** One game warning as this frame reads it. */
export interface TruckWarningView {
  key: TruckWarning
  label: string
  on: boolean
}

/** Whether one of the game's warning channels is up. */
export function truckWarningOn(telemetry: Telemetry | null, key: TruckWarning): boolean {
  return telemetry?.[TRUCK_WARNING_FLAGS[key]] ?? false
}

/** Whether any of the game's warning channels is up. */
export function anyTruckWarning(telemetry: Telemetry | null): boolean {
  return TRUCK_WARNING_KEYS.some((key) => truckWarningOn(telemetry, key))
}

/** Each game warning with its flag's state this frame, in the dash's order. */
export function truckWarnings(telemetry: Telemetry | null, words: Strings['diagnostics']): TruckWarningView[] {
  return TRUCK_WARNING_KEYS.map((key) => ({
    key,
    label: truckWarningWord(key, words),
    on: truckWarningOn(telemetry, key),
  }))
}

/** The cab's word for one game warning. */
export function truckWarningWord(key: TruckWarning, words: Strings['diagnostics']): string {
  switch (key) {
    case 'fuel':
      return words.fuel
    case 'adblue':
      return words.adblue
    case 'battery':
      return words.battery
    case 'oil':
      return words.oilPressure
    case 'air':
      return words.brakeAir
  }
}
