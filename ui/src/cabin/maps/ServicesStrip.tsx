import { useMemo } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { formatTripDistance } from '../../shared/format'
import { go, useLive } from '../state/store'
import { useText } from '../state/text'
import { placesAhead } from './alongRoute'
import { liveRouteProgress } from './liveMap'
import { MAP_SCALE, nameOf, usePlaces } from './places'
import { PlaceBadge } from './PlaceBadge'
import { usePlacePick } from './placePick'
import { servicesAhead } from './servicesAhead'

/** How many services the Dashboard shows: the next two are what a driver can plan at a glance. */
const MOST = 2

/**
 * The next services along the game's route, on the Dashboard's map: fuel, a rest, a service area, a weigh
 * station, a ferry or a train. The same places Maps' lists use (placesAhead), so they are beside the road
 * ahead, never behind the truck. A press opens the place's card in Maps.
 */
export function ServicesStrip() {
  const text = useText()
  const places = usePlaces()
  // The route, and where the truck is along it to a step: the strip doesn't look again with every metre.
  const at = useLive(
    useShallow((state) => ({
      route: state.route?.id ?? null,
      left: Math.round((state.telemetry?.navigationDistance ?? 0) / 250),
      next: state.routeNext,
    })),
  )
  const services = useMemo(() => {
    if (!places || at.route === null) return []
    const live = liveRouteProgress()
    return live ? servicesAhead(placesAhead(places, live.spans, live.progress), MOST) : []
  }, [places, at])
  if (services.length === 0) return null
  return (
    <div className="guidance services-ahead glass">
      <div className="services-ahead-title">{text.destinations.servicesAhead}</div>
      {services.map(({ place, along }) => {
        const kind = text.destinations.kinds[place.kind]
        const name = nameOf(place, kind)
        return (
          <button
            key={`${place.node}:${place.kind}`}
            type="button"
            className="services-ahead-row"
            onClick={() => {
              usePlacePick.getState().pick(place)
              go({ type: 'openApp', app: 'maps' })
            }}
          >
            <PlaceBadge kind={place.kind} />
            <span className="services-ahead-text">
              <span className="services-ahead-name">{name}</span>
              <span className="services-ahead-kind">{kind}</span>
            </span>
            <span className="services-ahead-distance">{formatTripDistance(along * MAP_SCALE, text.decimal)}</span>
          </button>
        )
      })}
    </div>
  )
}
