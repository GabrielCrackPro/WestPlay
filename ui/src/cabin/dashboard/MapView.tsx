import { useEffect, useRef, useState } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { formatGameTime, formatTripDistance, formatTripTime, speedKmh } from '../../shared/format'
import { hvtMapMessage } from '../maps/blockedMap'
import { GuidanceCard } from '../maps/GuidanceCard'
import { DashboardMapControls, MapControls } from '../maps/MapControls'
import { DriveStatus } from '../maps/DriveStatus'
import { MapSearch } from '../maps/MapSearch'
import { NearbyStopCard } from '../maps/NearbyStopCard'
import { ServicesStrip } from '../maps/ServicesStrip'
import { nextStop } from '../maps/nextStop'
import { StopsPage } from '../maps/StopsPage'
import { StopsStrip } from '../maps/StopsStrip'
import { useMapData } from '../maps/mapData'
import { RoadMap } from '../maps/RoadMap'
import { destinationView } from './destination'
import { go, useCabin, useLive } from '../state/store'
import { useTicker } from '../state/ticker'
import { useText } from '../state/text'
import './map.css'
import { cabClock } from '../../shared/host'

/**
 * The map tile (Dashboard and the Maps app): the live map following the truck (with the game's GPS route),
 * the trip's arrival, time and distance left while there's a route, the road's speed limit and the live
 * speed; in the Maps app, turn-by-turn over the map (the Dashboard has its own widget for it). Without map
 * data it shows a drawn stand-in map (dark or daytime, following the appearance) tilted like CarPlay's
 * driving view. `interactive` (the Maps app): the player can move the map, with its buttons; on the
 * Dashboard, it only zooms (its buttons fading while unused).
 * On a map WestPlay doesn't allow (by HVT), it says so instead, in the game's language.
 */
export function MapView({ interactive = false }: { interactive?: boolean }) {
  const speed = useLive((state) => (state.telemetry ? speedKmh(state.telemetry.speed) : 0))
  // The badge's number eased like a speedo, not the game's twenty frames a second (state/ticker.ts).
  const shownSpeed = Math.round(useTicker(speed))
  const limit = useLive((state) => (state.telemetry ? speedKmh(state.telemetry.navigationSpeedLimit) : 0))
  const data = useMapData()
  const hvtMap = useLive((state) => state.hvtMap)
  const showLimit = useCabin((state) => state.mapLimit)
  const warnOver = useCabin((state) => state.mapOver)
  const text = useText()
  const arrived = useArrival()
  // The arrival card has the map's bottom once there's no route left to show in the pill (they share it).
  const routeLeft = useLive((state) => state.telemetry?.navigationDistance ?? 0)
  const night = useNightMap()
  // The wipers are on: rain runs down the map too, as it runs down the windscreen. How hard it comes down is the
  // game's own wetness (percent): a drizzle as the roads damp, a downpour once they're soaked.
  const wipers = useLive((state) => state.telemetry?.wipers ?? false)
  const wetness = useLive((state) => state.weather?.wetness ?? 0)
  const rain = wetness >= 70 ? 'heavy' : wetness >= 25 ? 'medium' : 'light'

  if (hvtMap) {
    return (
      <div className="map-tile map-blocked">
        <svg className="map-blocked-glyph" viewBox="0 0 24 24" aria-hidden>
          {/* Google Maps' own mark; the slash over it is the block. */}
          <g stroke="none">
            <g transform="translate(5.02 2) scale(0.1512)">
              <path fill="#1a73e8" d="M60.2 2.2C55.8.8 51 0 46.1 0 32 0 19.3 6.4 10.8 16.5l21.8 18.3L60.2 2.2z" />
              <path fill="#ea4335" d="M10.8 16.5C4.1 24.5 0 34.9 0 46.1c0 8.7 1.7 15.7 4.6 22l28-33.3-21.8-18.3z" />
              <path
                fill="#4285f4"
                d="M46.2 28.5c9.8 0 17.7 7.9 17.7 17.7 0 4.3-1.6 8.3-4.2 11.4 0 0 13.9-16.6 27.5-32.7-5.6-10.8-15.3-19-27-22.7L32.6 34.8c3.3-3.8 8.1-6.3 13.6-6.3"
              />
              <path
                fill="#fbbc04"
                d="M46.2 63.8c-9.8 0-17.7-7.9-17.7-17.7 0-4.3 1.5-8.3 4.1-11.3l-28 33.3c4.8 10.6 12.8 19.2 21 29.9l34.1-40.5c-3.3 3.9-8.1 6.3-13.5 6.3"
              />
              <path
                fill="#34a853"
                d="M59.1 109.2c15.4-24.1 33.3-35 33.3-63 0-7.7-1.9-14.9-5.2-21.3L25.6 98c2.6 3.4 5.3 7.3 7.9 11.3 9.4 14.5 6.8 23.1 12.8 23.1s3.4-8.7 12.8-23.2"
              />
            </g>
          </g>
          {/* The block: knocked out of the mark in the tile's own colour, then drawn. */}
          <path d="M3 3l18 18" stroke="var(--map-ground)" strokeWidth="4.6" strokeLinecap="round" />
          <path d="M3 3l18 18" />
        </svg>
        <p>{hvtMapMessage(hvtMap.language)}</p>
      </div>
    )
  }

  return (
    <div className={`map-tile${interactive ? '' : ' dashboard'}${night ? ' night' : ''}`}>
      {data ? (
        <RoadMap data={data} interactive={interactive} />
      ) : data === undefined ? (
        // Still loading (the map's tiles warm up): a breathing tile, not a blank pane.
        <div className="map-warm" aria-hidden />
      ) : (
        <>
          <div className="map-plane map-dark" />
          <div className="map-plane map-light" />
          <div className="puck" aria-hidden>
            <svg viewBox="0 0 24 24" width="22" height="22">
              <path d="M12 3 19 20l-7-4-7 4Z" fill="#fff" />
            </svg>
          </div>
        </>
      )}
      {!interactive && (
        <button
          type="button"
          className="map-open-app"
          aria-label={text.apps.maps}
          onClick={() => go({ type: 'openApp', app: 'maps' })}
        />
      )}
      <div className="map-shade" />
      {wipers && <div className={`map-rain ${rain}`} aria-hidden />}
      <TripPill />
      <StopsStrip compact={!interactive} />
      <ArrivalCard arrived={routeLeft > 0 ? null : arrived} />
      <div className="speed-stack">
        <DriveStatus />
        {limit > 0 && showLimit && (
          <div className="speed-limit" aria-label={text.speedLimit(limit)}>
            {limit}
          </div>
        )}
        {speed > 0 && (
          <div className={`speed-badge${limit > 0 && warnOver && speed > limit ? ' over' : ''}`}>{shownSpeed}</div>
        )}
      </div>
      {/* Turn-by-turn, over the map on both screens, and under it the nearest stop in the Maps app (the Dashboard
          has no card of its own for either). */}
      <div className="map-guidance-stack">
        <GuidanceCard />
        {!interactive && <ServicesStrip />}
        {interactive && <NearbyStopCard />}
      </div>
      {data && interactive && <MapControls />}
      {data && !interactive && <DashboardMapControls />}
      {data && interactive && <MapSearch />}
      {data && interactive && <StopsPage />}
      <TripSummary />
    </div>
  )
}

/**
 * The trip said in words, for a screen reader: the map itself is a canvas, and what it shows (the job's end, the
 * distance, the deadline) is drawn, not read. It's announced as the destination or the distance changes, a step
 * at a time rather than with every frame of telemetry.
 */
function TripSummary() {
  const text = useText()
  const labels = useMapData()?.labels
  const state = useLive(
    useShallow((live) => ({
      job: live.job,
      telemetry: live.telemetry,
      clockShift: live.clockShift,
      // A new distance each half kilometre: enough to keep it current, not each frame.
      at: Math.round((live.telemetry?.navigationDistance ?? 0) / 500),
    })),
  )
  const view = destinationView(state.job, null, state.telemetry, labels ?? [], text, state.clockShift)
  if (!view) return null
  const said = [view.kicker, view.title, view.subtitle, view.detail].filter(Boolean).join(', ')
  return (
    <p className="visually-hidden" role="status" aria-live="polite">
      {said}
    </p>
  )
}

/**
 * Whether the map is dimmed for the game's night (Settings › Maps): after eight in the evening and before six,
 * on the game's clock (the one the cabin's clocks count in), so the bright map doesn't glare in a dark cab.
 */
function useNightMap(): boolean {
  const on = useCabin((state) => state.mapNight)
  const starts = useCabin((state) => state.mapNightStart)
  const clock = useLive((state) => (state.telemetry ? cabClock(state.telemetry, state.clockShift) : null))
  if (!on || clock === null) return false
  const minute = ((clock % 1440) + 1440) % 1440
  return minute >= starts * 60 || minute < 6 * 60
}

/** How long the arrival card stays up, ms: long enough to be read at the wheel. */
const ARRIVED_MS = 8000

interface Arrival {
  id: number
  /** The trip as it stood just before the end: its time and its distance, already worded. */
  time: string
  distance: string
}

/**
 * The moment the route is done, as the game says it (its distance left reaches nothing): the trip's time and
 * distance as they stood a moment before, so the end of a long drive is said out loud. Only while a map is
 * open. A new route (the next job) starts it over.
 */
function useArrival(): Arrival | null {
  const text = useText()
  const distance = useLive((state) => state.telemetry?.navigationDistance ?? 0)
  const time = useLive((state) => state.telemetry?.navigationTime ?? 0)
  const last = useRef({ distance: 0, time: 0 })
  const [arrived, setArrived] = useState<Arrival | null>(null)
  useEffect(() => {
    const before = last.current
    if (before.distance > 0 && before.time > 0 && distance <= 0) {
      setArrived({
        id: Date.now(),
        time: formatTripTime(before.time / 60, text),
        distance: formatTripDistance(before.distance, text.decimal),
      })
    }
    if (distance > 0) last.current = { distance, time }
  }, [distance, time, text])
  useEffect(() => {
    if (!arrived) return
    const timer = setTimeout(() => setArrived(null), ARRIVED_MS)
    return () => clearTimeout(timer)
  }, [arrived])
  return arrived
}

/** The end of the drive: where it was going and what it took, over the map for a few seconds. */
function ArrivalCard({ arrived }: { arrived: Arrival | null }) {
  const text = useText()
  if (!arrived) return null
  return (
    <div key={arrived.id} className="map-arrived glass" role="status">
      <span className="map-arrived-title">{text.destinations.arrived}</span>
      <span className="map-arrived-detail">
        {arrived.time} · {arrived.distance}
      </span>
    </div>
  )
}

/**
 * The trip, while the game's GPS has a route: when the truck arrives (on the game's clock), the time and
 * the distance left, as the game itself counts them (its time scale and its map's scale, so the same as
 * its own GPS shows). With a stop of the player's ahead, the time to it first ("30 min | 3 h 5 min"), the
 * next one's only, the one after once it's reached (owner 2026-10-21).
 */
function TripPill() {
  const text = useText()
  const trip = useLive(
    useShallow((state) => {
      const telemetry = state.telemetry
      if (!telemetry || telemetry.navigationDistance <= 0) return null
      const minutes = telemetry.navigationTime / 60
      const stop = state.route
        ? nextStop(
            state.routeStops,
            state.route.distances,
            state.routeNext,
            telemetry.navigationDistance,
            telemetry.navigationTime,
          )
        : null
      const total = formatTripTime(minutes, text)
      // How much of the route is behind the truck: the route's own length, as the game counts its distances.
      const planned = state.route?.distances[0] ?? 0
      const progress = planned > 0 ? Math.min(1, Math.max(0, 1 - telemetry.navigationDistance / planned)) : null
      // The next rest the game's fatigue simulation asks for, while it's within the hour.
      const rest = telemetry.restStop
      return {
        arrival: formatGameTime(Math.round(cabClock(telemetry, state.clockShift) + minutes)),
        time: stop ? `${formatTripTime(stop.minutes, text)} | ${total}` : total,
        distance: formatTripDistance(telemetry.navigationDistance, text.decimal),
        progress,
        rest: rest >= 0 && rest <= 60 ? `${text.diagnostics.restStop} ${formatTripTime(rest, text)}` : null,
      }
    }),
  )
  if (!trip) return null
  const { arrival, time, distance, progress, rest } = trip
  return (
    <div className="eta-pill glass">
      <span className="eta-line">
        {/* Keyed by what they say: a new arrival or a new time rolls in, as the sidebar's clock does. */}
        <b key={arrival}>{arrival}</b> {text.arrival} <span className="dot">·</span>{' '}
        <span key={time} className="eta-time">
          {time}
        </span>{' '}
        <span className="dot">·</span> {distance}
      </span>
      {rest && <span className="eta-rest">{rest}</span>}
      {progress !== null && (
        <span className="eta-bar" aria-hidden>
          <span style={{ width: `${Math.round(progress * 100)}%` }} />
        </span>
      )}
    </div>
  )
}
