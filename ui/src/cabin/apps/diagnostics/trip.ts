/**
 * The Diagnostics app's trip computer and its trends: what the truck has done since the engine came on, and the
 * last minute or so of its temperatures.
 *
 * A trip is worked out from the telemetry the game already sends — the odometer for the distance, the average
 * consumption for the fuel it took to cover it — rather than from channels of its own: no extra work in the
 * plugin, and nothing to go stale. A jump in the odometer (a save loaded, a ferry) isn't driving, so a frame's
 * step is capped.
 */

/** How many samples of a reading the sparklines keep (one a second: a minute and a half). */
export const HISTORY = 90

/** How far the odometer may jump in one frame and still be taken as driving, km (a save loaded, a ferry). */
const MAX_STEP = 5

/** A trip: what it covered, what it burned, and how long it was moving, and standing. */
export interface Trip {
  /** km. */
  distance: number
  /** Litres, as the average consumption says they were burned. */
  fuel: number
  /** Seconds on the move. */
  moving: number
  /** Seconds standing with the engine running. */
  idle: number
  /** The odometer the last frame stood at, and when it came (ms); null until the first frame. */
  odometer: number | null
  at: number | null
}

/** A trip with nothing on it yet: the engine has just come on, or it was reset. */
export const TRIP_START: Trip = { distance: 0, fuel: 0, moving: 0, idle: 0, odometer: null, at: null }

/** One frame of telemetry, as a trip needs it. */
export interface TripFrame {
  odometer: number
  /** Litres per 100 km. */
  fuelAverage: number
  engineEnabled: boolean
  /** The truck is rolling. */
  moving: boolean
}

/**
 * The trip a frame further on. A frame while the engine is off moves the trip's mark on without adding to it (the
 * odometer still reads where the truck is), and one whose odometer jumped further than [`MAX_STEP`] (a ferry, a
 * save loaded) counts as no driving: the truck didn't drive that, the save did.
 */
export function advanceTrip(trip: Trip, frame: TripFrame, now: number): Trip {
  if (trip.odometer === null || trip.at === null) return { ...trip, odometer: frame.odometer, at: now }
  const step = Math.max(0, frame.odometer - trip.odometer)
  const moved = step <= MAX_STEP ? step : 0
  if (!frame.engineEnabled) return { ...trip, odometer: frame.odometer, at: now }
  const seconds = Math.max(0, (now - trip.at) / 1000)
  return {
    distance: trip.distance + moved,
    fuel: trip.fuel + moved * (frame.fuelAverage / 100),
    moving: trip.moving + (frame.moving ? seconds : 0),
    idle: trip.idle + (frame.moving ? 0 : seconds),
    odometer: frame.odometer,
    at: now,
  }
}

/** The trip's average consumption, litres per 100 km (0 until it has covered something). */
export function tripAverage(trip: Trip): number {
  return trip.distance > 0.05 ? (trip.fuel / trip.distance) * 100 : 0
}

/** A stretch of time as the cab writes it: 48 seconds is "0:48", an hour and six minutes "1:06". */
export function clock(seconds: number): string {
  const whole = Math.max(0, Math.round(seconds))
  return `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, '0')}`
}

/**
 * A sparkline's points, in a 100 by 24 box: the samples from left to right, scaled to the range they cover (a
 * range of their own, so a small drift is still a shape). Empty until there are two samples to join.
 */
export function sparklinePoints(values: number[]): string {
  if (values.length < 2) return ''
  const low = Math.min(...values)
  const high = Math.max(...values)
  const span = high - low || 1
  return values
    .map((value, index) => {
      const x = (index / (values.length - 1)) * 100
      const y = 23 - ((value - low) / span) * 22
      return `${x.toFixed(2)},${y.toFixed(2)}`
    })
    .join(' ')
}
