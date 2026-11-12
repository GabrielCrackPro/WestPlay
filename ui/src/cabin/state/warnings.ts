import { useEffect, useState } from 'react'
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

/**
 * How long the cab treats the game's warnings as the truck starting rather than as the drive, ms: the compressor
 * filling the tanks, the oil pump coming up on the key, the alternator taking over from the batteries. A truck's own
 * dash lights its lamps for its checks at the same moment; here there is nobody to read them off, so the cab simply
 * doesn't say anything until the engine has had a few seconds to settle.
 *
 * Counted from the first frame the game reports (the truck existing), which is before the cab's boot has cleared, so
 * the first seconds of the screen are already inside it.
 */
export const SETTLE_MS = 8000

/**
 * How the game's warnings are the truck starting rather than a fault, for the surfaces that say a warning aloud
 * (shell/gameAlerts.ts `alertsWorthReading`). The truck's own glass is not held back: its lamps and gauges read what
 * the game reports, start-up and all.
 */
export interface AlertStart {
  /** The first seconds have passed (SETTLE_MS): anything still wrong now is the driver's to know. */
  settled: boolean
  /**
   * The engine has been running for a moment (SETTLE_MS counted from its own start). Oil pressure and the battery's
   * charge are the two readings that are *supposed* to be wrong with the engine off — no pump turning, no alternator
   * charging — and a truck spends the start of every drive sitting there, sometimes for minutes while the job is read.
   * Their flags are read only while it runs, so a lamp on the key is the truck's own check rather than the cab's news,
   * and a real loss of either still shows while driving.
   */
  running: boolean
  /** Whether the brake air has been up once since the cab came on: until it has, its low flag is the tanks filling. */
  airUp: boolean
}

/**
 * Whether the brake air counts as up, given whether it has been up already: true the first frame its low-pressure flag
 * is down, and from then on.
 *
 * The air is the one channel that starts wrong by design. The game loads a truck with empty tanks and its compressor
 * fills them once the engine runs, so "brake air low" is up at the start of every drive — the truck doing what a real
 * one does on the key, with its warning lamp lit until the gauges climb. Only a reading that has been up once since the
 * cab came on can be lost: after that, a low one is a fault (a burst hose, a leak, a tap left closed) and is read as
 * such. Every channel but this one starts at its real value, so a warning there is the driver's from the first frame.
 *
 * Read by whatever the cab *says* — the notes it raises and the cluster's notice (shell/Notifications.tsx,
 * cluster/notice.ts, `alertsWorthReading`) — and not by the truck's own glass: the dash's lamps and chips still light
 * as the truck's do, which is what a driver expecting a start expects to see.
 */
export function airUpNow(wasUp: boolean, telemetry: Telemetry | null): boolean {
  if (wasUp) return true
  return telemetry !== null && !telemetry.brakeAirWarning
}

/**
 * The truck's start as the cab's warnings read it (AlertStart), kept across frames: the settling window, which opens
 * with the first frame the game reports and closes by its own timer; the engine's own window, which opens each time it
 * starts; and whether the brake air has been up since. The air follows its reading, adjusted while rendering (React's
 * way for state that follows a value, so no frame reads it as up before the frame it was); the windows are time, not
 * values, so they are the effects'.
 */
export function useAlertStart(telemetry: Telemetry | null): AlertStart {
  const [settled, setSettled] = useState(false)
  const [running, setRunning] = useState(false)
  const [up, setUp] = useState(false)
  // A report after none is a new start — the truck loaded again, or the game come back after the menu — so its tanks
  // are empty and its checks begin once more. Adjusted while rendering, like the air below, so no frame of the new
  // truck is read with the last one's start already behind it.
  const reported = telemetry !== null
  const [seen, setSeen] = useState(false)
  if (seen !== reported) {
    setSeen(reported)
    if (reported) {
      setSettled(false)
      setUp(false)
    }
  }
  const nextUp = airUpNow(up, telemetry)
  if (nextUp !== up) setUp(nextUp)
  // The truck exists: its checks have started, and they are over after SETTLE_MS. Nothing in the telemetry changes the
  // window once it is open, so it hangs off the one fact that opens it and off its own end.
  useEffect(() => {
    if (!reported || settled) return
    const timer = setTimeout(() => setSettled(true), SETTLE_MS)
    return () => clearTimeout(timer)
  }, [reported, settled])
  // The engine's own start has its window too: pressing the key is not a fault, and a truck can sit for minutes before
  // it, and be started again at the next job. Each run opens a window of its own; the engine stopping closes it, so the
  // next start begins again from nothing.
  const engineRun = telemetry?.engineEnabled ?? false
  const [wasRunning, setWasRunning] = useState(false)
  if (wasRunning !== engineRun) {
    setWasRunning(engineRun)
    setRunning(false)
  }
  useEffect(() => {
    if (!engineRun) return
    const timer = setTimeout(() => setRunning(true), SETTLE_MS)
    return () => clearTimeout(timer)
  }, [engineRun])
  return { settled, running: engineRun && running, airUp: nextUp }
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
