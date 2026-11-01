import { useCallback, useEffect, useRef, useState } from 'react'
import { useLive } from '../../state/store'
import { advanceTrip, HISTORY, TRIP_START, type Trip } from './trip'

/** What the Diagnostics app's trip card and sparklines show, kept up to date from the telemetry. */
export interface Trends {
  trip: Trip
  /** The coolant's last samples, a second apart (°C). */
  coolant: number[]
  /** The brakes' last samples (°C). */
  brakes: number[]
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
  const [view, setView] = useState<{ trip: Trip; coolant: number[]; brakes: number[] }>({
    trip: TRIP_START,
    coolant: [],
    brakes: [],
  })

  useEffect(() => {
    if (!telemetry) return
    const now = performance.now()
    // A trip runs while the engine does: a new engine start is a new trip.
    if (telemetry.engineEnabled && !running.current) trip.current = TRIP_START
    running.current = telemetry.engineEnabled
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
    setView({ trip: trip.current, coolant: coolant.current, brakes: brakes.current })
  }, [telemetry])

  const reset = useCallback(() => {
    trip.current = TRIP_START
    coolant.current = []
    brakes.current = []
    published.current = 0
    setView({ trip: TRIP_START, coolant: [], brakes: [] })
  }, [])

  return { ...view, reset }
}
