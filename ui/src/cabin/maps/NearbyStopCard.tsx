import { useMemo } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { formatTripDistance } from '../../shared/format'
import { useCabin, useLive } from '../state/store'
import { useText } from '../state/text'
import { nearestStop, type NearbyStop, stopCardShown } from './nearbyStop'
import { toLngLat } from './projection'
import { usePlaces } from './places'

/** How far the truck may move before the card looks for another stop, metres. */
const WHERE_STEP = 250

/**
 * The nearest filling station or rest area, under the turn-by-turn card: how far it is, what it is and its name,
 * with the stop's own glyph. Shown always, or only as the tank or the driver's hours run low (Settings › Maps).
 * A card of its own only in the Maps app: the Dashboard's knowledge of the road stays the turn-by-turn banner's.
 */
export function NearbyStopCard() {
  const places = usePlaces()
  // Where the truck is, to a step: the card doesn't look again with every metre.
  const x = useLive((state) => (state.telemetry ? Math.round(state.telemetry.x / WHERE_STEP) * WHERE_STEP : null))
  const z = useLive((state) => (state.telemetry ? Math.round(state.telemetry.z / WHERE_STEP) * WHERE_STEP : null))
  const stop = useMemo(
    () => (places && x !== null && z !== null ? nearestStop(places, toLngLat(x, z)) : null),
    [places, x, z],
  )
  const always = useCabin((state) => state.mapStopCardAlways)
  const fuelBelow = useCabin((state) => state.mapStopCardFuel)
  const restWithin = useCabin((state) => state.mapStopCardRest)
  // The truck as plain values: the card redraws when one of them changes, not each frame.
  const truck = useLive(
    useShallow((state) => {
      const telemetry = state.telemetry
      const capacity = state.truck?.fuelCapacity ?? 0
      return {
        fuel: telemetry && capacity > 0 ? Math.round((telemetry.fuel / capacity) * 100) / 100 : null,
        fuelWarning: telemetry?.fuelWarning ?? false,
        restIn: restIn(telemetry?.restStop ?? -1, telemetry?.mandatoryBreak ?? -1),
      }
    }),
  )
  if (!stop || !stopCardShown({ always, fuelBelow, restWithin }, truck)) return null
  return <StopCard stop={stop} />
}

/** The next of the game's two rest clocks, in minutes (`-1` when neither is simulated). */
function restIn(rest: number, mandatoryBreak: number): number {
  const clocks = [rest, mandatoryBreak].filter((minutes) => minutes >= 0)
  return clocks.length > 0 ? Math.min(...clocks) : -1
}

function StopCard({ stop }: { stop: NearbyStop }) {
  const text = useText()
  const kind = text.destinations.kinds[stop.place.kind]
  const distance = formatTripDistance(stop.distance, text.decimal)
  const name = stop.place.localized ?? stop.place.name
  // Its own name (a brand, a rest area's), and its city: not the kind again when the name is just that.
  const detail = [name && name !== kind ? name : null, stop.place.city].filter(Boolean).join(' · ')
  return (
    <article className="guidance nearby-stop-card glass" aria-label={`${distance} · ${kind}`}>
      {stop.kind === 'fuel' ? <FuelGlyph /> : <RestGlyph />}
      <div className="nearby-stop-text">
        <div className="nearby-stop-distance">{distance}</div>
        <div className="nearby-stop-kind">{kind}</div>
        {detail && <div className="nearby-stop-detail">{detail}</div>}
      </div>
    </article>
  )
}

/** A filling station's pump, the map's own fuel badge in white. */
function FuelGlyph() {
  return (
    <svg className="nearby-stop-glyph" viewBox="0 0 24 24" aria-hidden>
      <path d="M5.5 21V5.5A2.5 2.5 0 0 1 8 3h4a2.5 2.5 0 0 1 2.5 2.5V21" />
      <path d="M3 21h14" />
      <path d="M7.8 6.4h4.4v3.9H7.8Z" />
      <path d="M14.5 9.5h1.7a1.6 1.6 0 0 1 1.6 1.6v5.7a2 2 0 0 0 4 0v-7.2L18.2 5.8" />
    </svg>
  )
}

/** A bed, for a rest area. */
function RestGlyph() {
  return (
    <svg className="nearby-stop-glyph" viewBox="0 0 24 24" aria-hidden>
      <path d="M3 5.5v13" />
      <path d="M3 15.5h18v3" />
      <path d="M21 15.5v-4a2 2 0 0 0-2-2h-8v6" />
      <circle cx="7.4" cy="11.2" r="2.1" />
    </svg>
  )
}
