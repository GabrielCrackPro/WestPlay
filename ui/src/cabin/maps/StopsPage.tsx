import { useEffect, useMemo, useState } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { formatTripDistance, formatTripTime } from '../../shared/format'
import { useLive } from '../state/store'
import { useText } from '../state/text'
import type { Strings } from '../state/text'
import { placesAhead } from './alongRoute'
import { PlaceRow } from './Destinations'
import { liveRouteProgress, showNearbyPins } from './liveMap'
import { usePlacePick } from './placePick'
import { usePlaces } from './places'
import { figuresOf, headroomOf, hoursState, stopsOf, type Headroom } from './stopsPlan'
import './maps.css'

/**
 * Maps' Stops page: the truck's range against the route left, the game's rest stop and mandatory break, and the
 * fuel and resting places beside the road ahead with how far along the route each one is. A place opens its card
 * as a tap on the map does (MapSearch), so a stop is one press from being added to the game's route.
 *
 * It reads only what the cab already has: the game's own distances and range, its rest clocks, and the map's
 * places along the route (alongRoute.ts).
 */
export function StopsPage() {
  const text = useText()
  const [open, setOpen] = useState(false)
  const places = usePlaces()
  const onRoute = useLive((state) => state.route !== null)
  // The figures the page shows, redrawn as the truck moves a step or the clocks turn rather than every frame.
  const data = useLive(useShallow((state) => (state.telemetry ? figuresOf(state.telemetry) : null)))
  const stops = useMemo(() => {
    if (!open || !places || !data) return []
    const live = liveRouteProgress()
    return live ? stopsOf(placesAhead(places, live.spans, live.progress)) : []
  }, [open, places, data])
  // The stops on show as pins over the map, and away again as the page closes.
  const pinPlaces = useMemo(() => stops.map(({ place }) => place), [stops])
  useEffect(() => {
    showNearbyPins(open ? pinPlaces : [])
  }, [open, pinPlaces])
  useEffect(() => () => showNearbyPins([]), [])
  // Escape puts it away, as the search panel's close button does.
  useEffect(() => {
    if (!open) return
    const key = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false)
    }
    window.addEventListener('keydown', key)
    return () => window.removeEventListener('keydown', key)
  }, [open])

  const toggle = () => setOpen((shown) => !shown)
  return (
    <>
      <button
        type="button"
        className={open ? 'map-stops-button glass on' : 'map-stops-button glass'}
        aria-label={text.destinations.stops}
        aria-expanded={open}
        onClick={toggle}
      >
        <StopsGlyph />
      </button>
      {open && (
        <div className="map-search map-stops-page glass" role="dialog" aria-label={text.destinations.stops}>
          <div className="map-search-top">
            <h2 className="map-stops-title">{text.destinations.stops}</h2>
            <button type="button" className="map-search-close" aria-label={text.close} onClick={() => setOpen(false)}>
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="m7 7 10 10M17 7 7 17" />
              </svg>
            </button>
          </div>
          <div className="destinations">
            {/* The range means something against a route: without one, the clocks and the places' reach stand. */}
            {data && data.left > 0 && <RangeCard range={data.range} left={data.left} text={text} />}
            {data && <HoursCard rest={data.rest} breakIn={data.breakIn} text={text} />}
            {stops.length > 0 ? (
              <section>
                <h3>{text.destinations.stopsAhead}</h3>
                <div className="destinations-list">
                  {stops.map(({ place, along }, index) => (
                    // Rows hold no state of their own: by position, whatever the places (two may share a node).
                    <PlaceRow
                      key={index}
                      place={place}
                      from={null}
                      along={along}
                      onChoose={(chosen) => {
                        usePlacePick.getState().pick(chosen)
                        setOpen(false)
                      }}
                    />
                  ))}
                </div>
              </section>
            ) : (
              <p className="destinations-note">
                {onRoute ? text.destinations.noStops : text.destinations.stopsNoRoute}
              </p>
            )}
          </div>
        </div>
      )}
    </>
  )
}

/** The tank against the route: the range, the distance left, and what the difference leaves. */
function RangeCard({ range, left, text }: { range: number; left: number; text: Strings }) {
  const head: Headroom = headroomOf(range, left)
  const margin = formatTripDistance(Math.abs(head.margin), text.decimal)
  const said =
    head.state === 'short'
      ? text.destinations.rangeShort(margin)
      : head.state === 'tight'
        ? text.destinations.rangeTight(margin)
        : text.destinations.rangeSpare(margin)
  return (
    <section className={`stops-card ${head.state}`} aria-label={text.destinations.stops}>
      <div className="stops-figures">
        <span className="stops-figure">
          <span className="stops-figure-label">{text.diagnostics.range}</span>
          <span className="stops-figure-value">{formatTripDistance(range, text.decimal)}</span>
        </span>
        <span className="stops-figure">
          <span className="stops-figure-label">{text.destinations.toGo}</span>
          <span className="stops-figure-value">{formatTripDistance(left, text.decimal)}</span>
        </span>
      </div>
      <p className="stops-say">{said}</p>
    </section>
  )
}

/** The game's two rest clocks, each in the tone of how close it is. */
function HoursCard({ rest, breakIn, text }: { rest: number; breakIn: number; text: Strings }) {
  const words = text.diagnostics
  const clock = (minutes: number) => (minutes >= 0 ? formatTripTime(minutes, text) : words.noRest)
  return (
    <section className="stops-card" aria-label={words.driverHours}>
      <div className="stops-rows">
        <span className="stops-row">
          <span className="stops-row-label">{words.restStop}</span>
          <span className={`stops-row-value ${hoursState(rest)}`}>{clock(rest)}</span>
        </span>
        <span className="stops-row">
          <span className="stops-row-label">{words.mandatoryBreak}</span>
          <span className={`stops-row-value ${hoursState(breakIn)}`}>{clock(breakIn)}</span>
        </span>
      </div>
    </section>
  )
}

/** The page's button: a flag, the stops along the way. */
function StopsGlyph() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M6 21V3.5h10l-1.6 3.75L16 11H6" />
    </svg>
  )
}
