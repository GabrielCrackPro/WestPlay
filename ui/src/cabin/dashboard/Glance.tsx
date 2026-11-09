import { useShallow } from 'zustand/react/shallow'
import { formatGameTime, formatTripDistance, formatTripTime, speedKmh } from '../../shared/format'
import { cabClock } from '../../shared/host'
import type { State } from '../apps/diagnostics/readings'
import { NoteGlyph } from '../apps/music/glyphs'
import { useMapData } from '../maps/mapData'
import { useCabin, useLive } from '../state/store'
import { useText } from '../state/text'
import { useTicker } from '../state/ticker'
import { EMPTY, useDestinationView, useDiagnosticsView, useDriverHoursView } from './widgetState'
import { nearestCity } from './destination'
import { fuelShare, gearLabel, routeShare } from './overview'
import { useNowPlaying, useNowPlayingTrack, useProgress } from './useNowPlaying'
import { weatherView } from './weather'
import { WeatherGlyph } from './WeatherGlyph'
import './glance.css'

/**
 * The Dashboard's second screen: the drive at a glance, where the map's screen asks the driver to look at a
 * map. The speed and gear, the trip and its arrival, the tank and the engine's readings, the rest clocks, what
 * plays and the weather where the truck is, all in one grid: the numbers a driver checks in a look, rather
 * than the map's route.
 */
export function Glance() {
  const text = useText()
  const words = text.diagnostics
  // The cards the player kept on (Settings › Dashboard); the speed is always there.
  const cards = useCabin((state) => state.overviewCards)
  const truck = useLive((state) => state.truck)
  const speed = useLive((state) => (state.telemetry ? speedKmh(state.telemetry.speed) : 0))
  const shownSpeed = Math.round(useTicker(speed))
  const limit = useLive((state) => (state.telemetry ? speedKmh(state.telemetry.navigationSpeedLimit) : 0))
  const gear = useLive((state) => (state.telemetry ? gearLabel(state.telemetry.displayedGear) : 'N'))
  const cruise = useLive((state) => (state.telemetry ? speedKmh(state.telemetry.cruiseControlSpeed) : 0))
  const clock = useLive((state) => (state.telemetry ? cabClock(state.telemetry, state.clockShift) : null))
  const fuel = useLive((state) => state.telemetry?.fuel ?? 0)
  const room = truck?.fuelCapacity ?? 0
  const share = fuelShare(fuel, room)
  const range = useLive((state) => state.telemetry?.fuelRange ?? 0)
  const warned = useLive(
    useShallow((state) => {
      const telemetry = state.telemetry
      return {
        fuel: telemetry?.fuelWarning ?? false,
        adblue: telemetry?.adblueWarning ?? false,
        battery: telemetry?.batteryWarning ?? false,
        oil: telemetry?.oilPressureWarning ?? false,
        air: telemetry?.brakeAirWarning ?? false,
      }
    }),
  )
  const warnings = [
    warned.fuel && { key: 'fuel', label: words.fuel },
    warned.adblue && { key: 'adblue', label: words.adblue },
    warned.battery && { key: 'battery', label: words.battery },
    warned.oil && { key: 'oil', label: words.oilPressure },
    warned.air && { key: 'air', label: words.brakeAir },
  ].filter((warning): warning is { key: string; label: string } => Boolean(warning))
  const active = useLive(
    useShallow((state) => {
      const telemetry = state.telemetry
      if (!telemetry) return []
      const shown: string[] = []
      if (telemetry.hazard) shown.push(words.hazardLights)
      if (telemetry.highBeam) shown.push(words.highBeam)
      else if (telemetry.lowBeam) shown.push(words.lowBeam)
      if (telemetry.parkingBrake) shown.push(words.parkingBrake)
      if (telemetry.parkingLight) shown.push(words.parkingLight)
      return shown
    }),
  )

  const destination = useDestinationView()
  const trip = useLive(
    useShallow((state) => {
      const telemetry = state.telemetry
      if (!telemetry || telemetry.navigationDistance <= 0) return null
      const minutes = telemetry.navigationTime / 60
      return {
        arrival: formatGameTime(Math.round(cabClock(telemetry, state.clockShift) + minutes)),
        time: formatTripTime(minutes, text),
        distance: formatTripDistance(telemetry.navigationDistance, text.decimal),
        progress: routeShare(telemetry.navigationDistance, state.route?.distances[0] ?? 0),
      }
    }),
  )
  const diagnostics = useDiagnosticsView()
  const hours = useDriverHoursView()

  const labels = useMapData()?.labels
  const weather = useLive((state) => state.weather)
  const gameTime = useLive((state) => (state.telemetry ? cabClock(state.telemetry, state.clockShift) : 0))
  const wipers = useLive((state) => state.telemetry?.wipers ?? false)
  const place = useLive((state) => {
    const telemetry = state.telemetry
    return telemetry && labels ? nearestCity([telemetry.x, telemetry.z], labels) : null
  })
  const weatherNow = weather ? weatherView(weather, gameTime, place, text, wipers) : null

  const now = useNowPlaying()
  const track = useNowPlayingTrack()
  const source =
    now.showing === 'spotify'
      ? now.spotify?.source
      : now.showing === 'appleMusic'
        ? now.appleMusic?.source
        : now.showing === 'youtubeMusic'
          ? now.youtubeMusic?.source
          : now.showing === 'radio'
            ? now.radio?.source
            : null
  const progress = useProgress(source ?? null)

  return (
    <section className="glance" aria-label={text.diagnostics.overview}>
      <article className="glance-card glance-speed">
        <div className="glance-speed-line">
          <span className="glance-speed-value">{shownSpeed}</span>
          <span className="glance-speed-unit">{words.kmh}</span>
          {limit > 0 && <span className={speed > limit ? 'glance-limit over' : 'glance-limit'}>{limit}</span>}
        </div>
        <div className="glance-speed-meta">
          <span>
            {words.gear} <b>{gear}</b>
          </span>
          {cruise > 0 && (
            <span>
              {words.cruiseControl} <b>{cruise}</b>
            </span>
          )}
        </div>
        {(active.length > 0 || warnings.length > 0) && (
          <div className="glance-chips">
            {warnings.map((warning) => (
              <span key={warning.key} className="glance-chip alarm">
                {warning.label}
              </span>
            ))}
            {active.map((label) => (
              <span key={label} className="glance-chip">
                {label}
              </span>
            ))}
          </div>
        )}
      </article>

      <article className={`glance-card glance-trip${cards.trip ? '' : ' off'}`}>
        <div className="glance-kicker">{destination !== EMPTY ? destination.kicker : text.destination}</div>
        <div className="glance-trip-title">{destination !== EMPTY ? destination.title : '—'}</div>
        {destination !== EMPTY && destination.subtitle && (
          <div className="glance-trip-place">{destination.subtitle}</div>
        )}
        {destination !== EMPTY && destination.detail && (
          <div className={destination.late ? 'glance-trip-detail late' : 'glance-trip-detail'}>
            {destination.detail}
          </div>
        )}
        {destination !== EMPTY && (destination.cargo || destination.pay) && (
          <div className="glance-trip-job">
            {destination.cargo && <span>{destination.cargo}</span>}
            {destination.pay && <b>{destination.pay}</b>}
          </div>
        )}
        {trip && (
          <div className="glance-trip-stats">
            <span className="glance-stat">
              <b>{trip.arrival}</b>
              <span>{text.arrival}</span>
            </span>
            <span className="glance-stat">
              <b>{trip.time}</b>
              <span>{words.time}</span>
            </span>
            <span className="glance-stat">
              <b>{trip.distance}</b>
              <span>{words.distance}</span>
            </span>
          </div>
        )}
        {trip?.progress !== null && trip?.progress !== undefined && (
          <span className="glance-bar" aria-hidden>
            <span style={{ width: `${Math.round(trip.progress * 100)}%` }} />
          </span>
        )}
      </article>

      <article className={`glance-card glance-weather${cards.weather ? '' : ' off'}`}>
        <div className="glance-kicker">{text.apps.weather}</div>
        <div className="glance-clock">{clock === null ? '—' : formatGameTime(clock)}</div>
        <div className="glance-weather-line">
          <div className="glance-weather-text">
            {weatherNow?.place && <div className="glance-weather-place">{weatherNow.place}</div>}
            <div className="glance-weather-condition">{weatherNow?.condition ?? '—'}</div>
          </div>
          {weatherNow && <WeatherGlyph symbol={weatherNow.symbol} size={58} />}
        </div>
      </article>

      <article className={`glance-card glance-truck${cards.truck ? '' : ' off'}`}>
        <div className="glance-kicker">{words.fuel}</div>
        <div className="glance-fuel-line">
          <div className="glance-fuel-value">
            <b>{text.number(Math.round(fuel))}</b> {words.litres}
            {room > 0 && <span className="glance-fuel-room"> / {text.number(Math.round(room))}</span>}
          </div>
          <div className="glance-fuel-range">{text.range(formatTripDistance(range, text.decimal))}</div>
        </div>
        {share !== null && (
          <span className="glance-bar fuel" aria-hidden>
            <span style={{ width: `${Math.round(share * 100)}%` }} />
          </span>
        )}
        {diagnostics && (
          <div className="glance-readings">
            <Reading label={words.adblue} value={diagnostics.adblue} state={diagnostics.adblueState} />
            <Reading label={words.battery} value={diagnostics.battery} state={diagnostics.batteryState} />
            <Reading label={words.coolant} value={diagnostics.coolant} state={diagnostics.coolantState} />
            <Reading label={words.brakeAir} value={diagnostics.air} state={diagnostics.airState} />
          </div>
        )}
      </article>

      <article className={`glance-card glance-hours${cards.hours ? '' : ' off'}`}>
        <div className="glance-kicker">{words.driverHours}</div>
        {hours ? (
          <>
            <div className="glance-hours-line">
              <span className={hours.restState}>{hours.rest}</span>
              <span>{words.restStop}</span>
            </div>
            <div className="glance-hours-line small">
              <span className={hours.breakState}>{hours.break}</span>
              <span>{words.mandatoryBreak}</span>
            </div>
            <div className="glance-hours-detail">{hours.detail}</div>
          </>
        ) : (
          <div className="glance-hours-detail">{words.noTelemetry}</div>
        )}
      </article>

      <article className={`glance-card glance-media${cards.media ? '' : ' off'}`}>
        <div className="glance-kicker">{text.nowPlaying}</div>
        {track ? (
          <>
            <div className="glance-media-line">
              {track.artwork ? (
                <img src={track.artwork} alt="" />
              ) : (
                <span className="glance-art-placeholder">
                  <NoteGlyph size={30} />
                </span>
              )}
              <div className="glance-media-text">
                <b>{track.title}</b>
                <span>{track.by}</span>
              </div>
            </div>
            {progress ? (
              <span className="glance-bar" aria-hidden>
                <span style={{ width: `${Math.round((progress.position / progress.duration) * 100)}%` }} />
              </span>
            ) : (
              <div className="glance-media-state">{track.playing ? text.playing : text.notPlaying}</div>
            )}
          </>
        ) : (
          <div className="glance-media-state">{text.nothingLoaded}</div>
        )}
      </article>
    </section>
  )
}

/** One of the truck card's smaller readings, coloured by how serious it is. */
function Reading({ label, value, state }: { label: string; value: string; state: State }) {
  return (
    <span className={`glance-reading ${state}`}>
      <span>{label}</span>
      <b>{value}</b>
    </span>
  )
}
