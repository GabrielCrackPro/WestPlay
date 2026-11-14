import { useMemo } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { cabClock } from '../../shared/host'
import { formatGameTime, formatTripDistance, formatTripTime } from '../../shared/format'
import { useLive } from '../state/store'
import { useText } from '../state/text'
import { stopsAhead } from './stopsAhead'
import './mapExtras.css'

/** How many of the player's stops a strip shows: the next four, on the map; two in the Dashboard's widget. */
const MOST = 4
const MOST_COMPACT = 2

/**
 * The player's stops still ahead, over the map: each one's number, when the truck gets there (on the game's
 * clock, the one the rest clocks are counted in) and how far it is. A job with several stops shows nothing
 * but the next stop's time in the arrival pill; this is the rest of the plan at a glance. Read from the same
 * figures the game's GPS uses, so they match its own.
 *
 * `compact` is the Dashboard's form: the next two stops, one line, small enough for the tile.
 */
export function StopsStrip({ compact = false }: { compact?: boolean }) {
  const text = useText()
  // Values that change slowly, so the strip redraws every game minute rather than every frame.
  const data = useLive(
    useShallow((state) => {
      const telemetry = state.telemetry
      const route = state.route
      if (!telemetry || !route || state.routeStops.length === 0 || telemetry.navigationDistance <= 0) return null
      return {
        left: Math.round(telemetry.navigationDistance),
        seconds: Math.round(telemetry.navigationTime),
        clock: Math.round(cabClock(telemetry, state.clockShift)),
        stops: state.routeStops,
        distances: route.distances,
        next: state.routeNext,
      }
    }),
  )
  const stops = useMemo(
    () =>
      data
        ? stopsAhead(
            data.stops,
            data.distances,
            data.next,
            data.left,
            data.seconds,
            data.clock,
            compact ? MOST_COMPACT : MOST,
          )
        : [],
    [data, compact],
  )
  if (stops.length === 0) return null
  const shown = stops
  return (
    <div className={compact ? 'map-stops compact glass' : 'map-stops glass'}>
      {shown.map((stop) => (
        <span key={stop.number} className="map-stop">
          <span className="map-stop-number">{text.destinations.stopNumber(stop.number)}</span>
          <span className="map-stop-time">{formatGameTime(stop.arrival)}</span>
          <span className="map-stop-distance">{formatTripDistance(stop.distance, text.decimal)}</span>
          {!compact && <span className="map-stop-left">{formatTripTime(stop.minutes, text)}</span>}
        </span>
      ))}
    </div>
  )
}
