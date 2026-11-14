import { useCallback, useEffect, useRef, useState } from 'react'
import type { Telemetry } from '../../../shared/host'
import { useLive } from '../../state/store'
import { DAMAGE_WARN, TRUCK_WARNING_KEYS, truckWarningOn } from '../../state/warnings'
import { advanceTrip, HISTORY, TRIP_START, type Trip } from './trip'

/**
 * The worst the truck has read since the engine came on: the peak temperatures and the lowest pressures and
 * tank, and how many of the game's own warnings came up. What a driver reads off before calling a garage.
 */
export interface Extremes {
  /** °C. */
  coolantPeak: number | null
  /** °C. */
  brakePeak: number | null
  /** psi. */
  airLow: number | null
  /** psi. */
  oilLow: number | null
  /** litres. */
  fuelLow: number | null
  /** How many of the game's warnings (fuel, AdBlue, battery, oil, brake air) and wear lamps came up. */
  warnings: number
}

/** Nothing read yet: the engine has just come on. */
export const NO_EXTREMES: Extremes = {
  coolantPeak: null,
  brakePeak: null,
  airLow: null,
  oilLow: null,
  fuelLow: null,
  warnings: 0,
}

const higher = (kept: number | null, value: number) => (kept === null ? value : Math.max(kept, value))
const lower = (kept: number | null, value: number) => (kept === null ? value : Math.min(kept, value))

/** A frame further on: each peak the higher of the two, each low the lower, and the game's warning channels and
 * wear lamps remembered by name (one flag coming up is one warning, however long it stays on). */
function trackExtremes(extremes: Extremes, telemetry: Telemetry, raised: Set<string>): Extremes {
  for (const key of TRUCK_WARNING_KEYS) {
    if (truckWarningOn(telemetry, key)) raised.add(key)
  }
  const damage = Math.max(
    telemetry.wearEngine,
    telemetry.wearWheels,
    telemetry.wearTransmission,
    telemetry.wearCabin,
    telemetry.wearChassis,
  )
  if (damage >= DAMAGE_WARN) raised.add('damage')
  if (
    telemetry.trailerAttached &&
    Math.max(telemetry.trailerWearWheels, telemetry.trailerWearBody, telemetry.trailerWearChassis) >= DAMAGE_WARN
  ) {
    raised.add('trailerWear')
  }
  return {
    coolantPeak: higher(extremes.coolantPeak, telemetry.coolantTemperature),
    brakePeak: higher(extremes.brakePeak, telemetry.brakeTemperature),
    airLow: lower(extremes.airLow, telemetry.brakeAirPressure),
    oilLow: lower(extremes.oilLow, telemetry.oilPressure),
    fuelLow: lower(extremes.fuelLow, telemetry.fuel),
    warnings: raised.size,
  }
}

/** What the Diagnostics app's trip card and sparklines show, kept up to date from the telemetry. */
export interface Trends {
  trip: Trip
  /** The coolant's last samples, a second apart (°C). */
  coolant: number[]
  /** The brakes' last samples (°C). */
  brakes: number[]
  /** The worst readings since the engine came on (the trip's span). */
  extremes: Extremes
  reset(): void
}

/**
 * Follows the telemetry the game sends into a trip and two short histories. Everything is added up in refs (the
 * game sends a frame some sixty times a second) and shown once a second, so the app redraws a sparkline's worth
 * of times rather than a frame's. The trip starts afresh as the engine comes on, and where the player says so;
 * a frame while the game is paused adds no time.
 */
export function useTrends(): Trends {
  const telemetry = useLive((state) => state.telemetry)
  const trip = useRef<Trip>(TRIP_START)
  const coolant = useRef<number[]>([])
  const brakes = useRef<number[]>([])
  const running = useRef(false)
  const published = useRef(0)
  const extremes = useRef<Extremes>(NO_EXTREMES)
  const raised = useRef(new Set<string>())
  const [view, setView] = useState<{ trip: Trip; coolant: number[]; brakes: number[]; extremes: Extremes }>({
    trip: TRIP_START,
    coolant: [],
    brakes: [],
    extremes: NO_EXTREMES,
  })

  useEffect(() => {
    if (!telemetry) return
    const now = performance.now()
    // A trip runs while the engine does: a new engine start is a new trip (and its readings start afresh).
    if (telemetry.engineEnabled && !running.current) {
      trip.current = TRIP_START
      extremes.current = NO_EXTREMES
      raised.current = new Set()
    }
    running.current = telemetry.engineEnabled
    extremes.current = trackExtremes(extremes.current, telemetry, raised.current)
    trip.current = advanceTrip(
      trip.current,
      {
        odometer: telemetry.odometer,
        fuelAverage: telemetry.fuelAverage,
        engineEnabled: telemetry.engineEnabled,
        moving: Math.abs(telemetry.speed) > 1,
      },
      now,
    )
    // A paused game's clock doesn't run: its frames add nothing, but the trip's mark still moves on.
    if (telemetry.paused) return
    if (now - published.current < 1000) return
    published.current = now
    coolant.current = [...coolant.current, telemetry.coolantTemperature].slice(-HISTORY)
    brakes.current = [...brakes.current, telemetry.brakeTemperature].slice(-HISTORY)
    setView({ trip: trip.current, coolant: coolant.current, brakes: brakes.current, extremes: extremes.current })
  }, [telemetry])

  const reset = useCallback(() => {
    trip.current = TRIP_START
    coolant.current = []
    brakes.current = []
    published.current = 0
    extremes.current = NO_EXTREMES
    raised.current = new Set()
    setView({ trip: TRIP_START, coolant: [], brakes: [], extremes: NO_EXTREMES })
  }, [])

  return { ...view, reset }
}
