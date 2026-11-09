import { type ReactElement, useCallback, useEffect, useState } from 'react'
import { formatGameTime, formatGear, formatTripDistance, speedKmh } from '../../shared/format'
import { cabClock, hasTruck, subscribeHostMessages } from '../../shared/host'
import { tripAverage } from '../apps/diagnostics/trip'
import { useTrends } from '../apps/diagnostics/useTrends'
import { receivePhoneNotifications, receivePhoneState, useCaller, usePhone, usePhoneToasts } from '../apps/phone/phone'
import { BootScreen } from '../boot/BootScreen'
import { logoSources } from '../boot/brand'
import { CONNECTING_MS, SPLASH_MS } from '../state/power'
import { resolveAppearance } from '../state/appearance'
import { useCabin, useLive } from '../state/store'
import { useText } from '../state/text'
import type { Strings } from '../state/strings'
import { gameAlerts } from '../shell/gameAlerts'
import {
  AdblueIcon,
  BatteryIcon,
  BeamIcon,
  BeaconIcon,
  BrakeAirIcon,
  BrakeTemperatureIcon,
  BreakIcon,
  ClockIcon,
  CoolantIcon,
  CruiseIcon,
  DropIcon,
  FuelIcon,
  GaugeIcon,
  HazardIcon,
  IndicatorIcon,
  OdometerIcon,
  OilIcon,
  OilTemperatureIcon,
  MusicIcon,
  ParkingBrakeIcon,
  PhoneIcon,
  RangeIcon,
  RestIcon,
  TripIcon,
  WarningIcon,
  WipersIcon,
} from './ClusterIcons'
import './cluster.css'

/**
 * WestPlay's instrument cluster, on the truck's own cluster display (the Scania S and R's; setup patches their
 * dashboard scripts with its texture, and the host streams this page into it). Laid out at
 * `westplay_shared::CLUSTER_WIDTH` x `CLUSTER_HEIGHT`.
 *
 * It reads like the Smart Dash it replaces: a speed dial with the gear under it, the truck's gauges on the
 * right, the trip, engine and driver's clocks on the left, telltales across the top, and the route in the
 * space between. A cab warning, the phone's newest notification or a call takes that space while it is up, and
 * one line of what plays sits in the dial's open bottom. The figures a driver checks in a glance are numbers
 * with their mark: the words are in the labels a screen reader reads, not on the glass (owner 2026-11-08: "more
 * icons and visuals, less text").
 */
export function ClusterScreen() {
  const text = useText()
  const words = text.diagnostics
  const telemetry = useLive((state) => state.telemetry)
  const truck = useLive((state) => state.truck)
  const job = useLive((state) => state.job)
  const nowPlaying = useLive((state) => state.nowPlaying)
  const clockShift = useLive((state) => state.clockShift)
  const shown = useCabin((state) => state.clusterShown)
  const cards = useCabin((state) => state.clusterCards)
  const reduceMotion = useCabin((state) => state.reduceMotion)
  const mode = useCabin((state) => state.appearanceMode)
  // The trip since the engine came on, worked out from the same telemetry (its distance, not the odometer).
  const { trip } = useTrends()
  // The cab's newest alert or phone notification: the same sources the cabin's stack uses, kept to one line here.
  const notice = useClusterNotice()
  // The page's telemetry and truck come from the host (it posts them to this WebView too); the page asks to be
  // told again when it loads.
  useEffect(
    () =>
      subscribeHostMessages((message) => {
        if (message.type === 'telemetry') useLive.setState({ telemetry: message.data })
        else if (message.type === 'truck') useLive.setState({ truck: hasTruck(message.data) ? message.data : null })
        else if (message.type === 'job') useLive.setState({ job: message.data.active ? message.data : null })
        else if (message.type === 'phone') receivePhoneState(message.state)
        else if (message.type === 'phoneNotes') {
          receivePhoneNotifications(message.notifications, message.backlog === true)
        } else if (message.type === 'nowPlaying') useLive.setState({ nowPlaying: message.data })
      }),
    [],
  )
  // The cabin page keeps the settings in the same storage: its changes come here without a reload.
  useEffect(() => {
    const changed = (event: StorageEvent) => {
      if (event.key === 'westplay.cabin') void useCabin.persist.rehydrate()
    }
    window.addEventListener('storage', changed)
    return () => window.removeEventListener('storage', changed)
  }, [])
  // Reduced motion follows the cabin's switch, as the shell's does: the boot and the dial then hold still.
  useEffect(() => {
    if (reduceMotion) document.documentElement.dataset.motion = 'reduced'
    else delete document.documentElement.dataset.motion
  }, [reduceMotion])

  // The boot, as the cabin's: the panel lights with the truck's brand and Cabin Play's mark as the electrics come
  // on, and clears to the cluster. The cluster page has no power clock of its own, so the electrics are its cue:
  // an ignition cycle boots the screen again, exactly as the cabin's does. The cycle is its key, so each ignition
  // gets a fresh boot from its first frame.
  const electric = telemetry?.electricEnabled ?? false
  const [ignition, setIgnition] = useState({ on: false, cycle: 0 })
  if (electric !== ignition.on) setIgnition({ on: electric, cycle: ignition.cycle + 1 })
  // The cluster is covered by the boot, so its entrance would play out of sight. Re-mount it as the boot clears
  // and it comes up with everything moving, rather than fading in underneath the panel's light.
  const [shellCycle, setShellCycle] = useState(0)
  const bootDone = useCallback(() => setShellCycle((cycle) => cycle + 1), [])

  // Switched off in Settings: the game's own cluster shows through the transparent texture.
  if (!shown) return null

  const t = telemetry
  const speed = t ? speedKmh(t.speed) : 0
  const gear = formatGear(t?.displayedGear ?? 0)
  const rpm = t ? Math.max(0, Math.min(1, t.engineRpm / 2500)) : 0
  const limit = t ? speedKmh(t.navigationSpeedLimit) : 0
  const cruise = t ? speedKmh(t.cruiseControlSpeed) : 0
  const capacity = truck?.fuelCapacity ?? 0
  const fuelShare = capacity > 0 && t ? clamp(t.fuel / capacity) : null
  const adblueShare = t ? clamp(t.adblue / 60) : 0
  const coolantShare = t ? clamp((t.coolantTemperature - 40) / 70) : 0
  const rest = t?.restStop ?? -1
  const breaking = t?.mandatoryBreak ?? -1
  const time = t ? formatGameTime(cabClock(t, clockShift)) : '--:--'
  const average = trip.distance > 0.05 ? tripAverage(trip) : (t?.fuelAverage ?? 0)
  const brakeHeat = t ? clamp(t.brakeTemperature / 600) : 0
  // The route's own line: the game's route while it guides, or the job's planned distance before it starts.
  const destination = job
    ? job.cargoLoaded
      ? job.destinationCity || job.destinationCompany
      : job.sourceCity || job.sourceCompany
    : null
  const routeDistance =
    t && t.navigationDistance > 0
      ? t.navigationDistance
      : job && job.cargoLoaded && job.plannedDistanceKm > 0
        ? job.plannedDistanceKm * 1000
        : null
  const routeArrival = t && t.navigationTime > 0 ? Math.round(cabClock(t, clockShift) + t.navigationTime / 60) : null
  const routeLabel = [
    destination,
    routeDistance !== null ? formatTripDistance(routeDistance, text.decimal) : '',
    routeArrival !== null ? `${text.arrival} ${formatGameTime(routeArrival)}` : '',
  ]
    .filter(Boolean)
    .join(' · ')
  const appearance = resolveAppearance(mode, {
    gameTime: t ? cabClock(t, clockShift) : null,
    lowBeam: t?.lowBeam ?? false,
  })

  // The telltales have a light each, in the dash's fixed order: the indicators first, then the beams and the
  // truck's running lights, then its warnings. Every light keeps its place even when it's out, so a blinker
  // lighting up never moves the others, as it would in a row that only held the ones that are on.
  const telltales: Telltale[] = [
    {
      key: 'left',
      label: words.indicatorLeft,
      tone: 'ok',
      blink: true,
      icon: <IndicatorIcon direction="left" />,
      active: t?.leftBlinker ?? false,
    },
    {
      key: 'right',
      label: words.indicatorRight,
      tone: 'ok',
      blink: true,
      icon: <IndicatorIcon direction="right" />,
      active: t?.rightBlinker ?? false,
    },
    {
      key: 'beam',
      label: t?.highBeam ? words.highBeam : words.lowBeam,
      tone: t?.highBeam ? 'info' : 'ok',
      icon: <BeamIcon main={t?.highBeam} />,
      active: (t?.highBeam || t?.lowBeam) ?? false,
    },
    {
      key: 'parkingLight',
      label: words.parkingLight,
      tone: 'ok',
      icon: <BeamIcon />,
      active: t?.parkingLight ?? false,
    },
    {
      key: 'beacon',
      label: words.lights,
      tone: 'warn',
      icon: <BeaconIcon />,
      active: t?.beacon ?? false,
    },
    {
      key: 'wipers',
      label: words.wipers,
      tone: 'info',
      icon: <WipersIcon />,
      active: t?.wipers ?? false,
    },
    {
      key: 'parkingBrake',
      label: words.parkingBrake,
      tone: 'danger',
      icon: <ParkingBrakeIcon />,
      active: cards.warnings && (t?.parkingBrake ?? false),
    },
    {
      key: 'hazard',
      label: words.hazardLights,
      tone: 'danger',
      blink: true,
      icon: <HazardIcon />,
      active: cards.warnings && (t?.hazard ?? false),
    },
    {
      key: 'fuel',
      label: words.fuel,
      tone: 'danger',
      icon: <FuelIcon />,
      active: cards.warnings && (t?.fuelWarning ?? false),
    },
    {
      key: 'adblue',
      label: words.adblue,
      tone: 'danger',
      icon: <AdblueIcon />,
      active: cards.warnings && (t?.adblueWarning ?? false),
    },
    {
      key: 'battery',
      label: words.battery,
      tone: 'danger',
      icon: <BatteryIcon />,
      active: cards.warnings && (t?.batteryWarning ?? false),
    },
    {
      key: 'oil',
      label: words.oilPressure,
      tone: 'danger',
      icon: <OilIcon />,
      active: cards.warnings && (t?.oilPressureWarning ?? false),
    },
    {
      key: 'air',
      label: words.brakeAir,
      tone: 'danger',
      icon: <BrakeAirIcon />,
      active: cards.warnings && (t?.brakeAirWarning ?? false),
    },
  ]

  // The dial's needle: 270° from its first tick to its last, on a 120 km/h face.
  const needleAngle = DIAL_START + 90 + DIAL_SWEEP_DEGREES * clamp(speed / DIAL_MAX_KMH)

  return (
    <main className="cluster" data-appearance={appearance} aria-label={text.settings.clusterScreen}>
      {electric && <ClusterBoot key={ignition.cycle} onDone={bootDone} />}

      <div className="cluster-shell" key={shellCycle}>
        <header className="cluster-status">
          <ul className="cluster-telltales" aria-label={words.warnings}>
            {telltales.map((telltale) => (
              <li
                key={telltale.key}
                className="cluster-telltale"
                data-tone={telltale.tone}
                data-active={telltale.active ? '' : undefined}
                data-blink={telltale.active && telltale.blink ? '' : undefined}
                role={telltale.active ? 'img' : undefined}
                aria-label={telltale.active ? telltale.label : undefined}
                aria-hidden={!telltale.active}
              >
                {telltale.icon}
              </li>
            ))}
          </ul>
          {notice ? (
            <ClusterNoticeBar notice={notice} />
          ) : routeLabel ? (
            <div className="cluster-route" aria-label={routeLabel}>
              <RangeIcon />
              {destination && <b>{destination}</b>}
              {routeDistance !== null && <span>{formatTripDistance(routeDistance, text.decimal)}</span>}
              {routeArrival !== null && (
                <span className="cluster-route-eta">
                  <ClockIcon />
                  {formatGameTime(routeArrival)}
                </span>
              )}
            </div>
          ) : null}
          <div className="cluster-status-right">
            <BrandMark />
            <span
              className="cluster-pill cluster-cruise"
              data-on={cruise > 0 ? '' : undefined}
              aria-label={cruise > 0 ? `${words.cruiseControl} ${cruise} ${words.kmh}` : undefined}
              aria-hidden={cruise <= 0}
            >
              <CruiseIcon />
              <b>{cruise > 0 ? cruise : 0}</b>
            </span>
            <span className="cluster-pill cluster-clock" aria-label={`${words.time} ${time}`}>
              <ClockIcon />
              <time>{time}</time>
            </span>
          </div>
        </header>

        <div className="cluster-main">
          <aside className="cluster-side">
            {cards.trip && (
              <section
                className="cluster-panel cluster-trip"
                aria-label={`${words.trip} ${t ? text.number(Math.round(trip.distance)) : 0} ${words.km}`}
              >
                <div className="cluster-trip-top">
                  <span className="cluster-glyph" aria-hidden>
                    <TripIcon />
                  </span>
                  <strong className="cluster-trip-value">
                    {t ? text.number(Math.round(trip.distance)) : '—'}
                    <small>{words.km}</small>
                  </strong>
                </div>
                <div className="cluster-pairs">
                  <span className="cluster-pair" aria-label={`${words.average} ${average.toFixed(1)} ${words.lPer100}`}>
                    <GaugeIcon />
                    <b>{t ? average.toFixed(1).replace('.', text.decimal) : '—'}</b>
                    <small>{words.lPer100}</small>
                  </span>
                  <span
                    className="cluster-pair"
                    aria-label={`${words.range} ${t ? text.number(Math.round(t.fuelRange)) : 0} ${words.km}`}
                  >
                    <RangeIcon />
                    <b>{t ? text.number(Math.round(t.fuelRange)) : '—'}</b>
                    <small>{words.km}</small>
                  </span>
                </div>
                <div
                  className="cluster-odo"
                  aria-label={`${words.odometer} ${t ? text.number(Math.round(t.odometer)) : 0} ${words.km}`}
                >
                  <OdometerIcon />
                  <b>{t ? text.number(Math.round(t.odometer)) : '—'}</b>
                  <small>{words.km}</small>
                </div>
              </section>
            )}

            {cards.engine && (
              <section className="cluster-panel cluster-engine" aria-label={words.engine}>
                <div
                  className="cluster-readout"
                  data-warn={t && t.oilTemperature >= 120 ? '' : undefined}
                  aria-label={`${words.oilTemperature} ${t ? text.number(Math.round(t.oilTemperature)) : 0} ${words.celsius}`}
                >
                  <span className="cluster-glyph" aria-hidden>
                    <OilTemperatureIcon />
                  </span>
                  <b>{t ? text.number(Math.round(t.oilTemperature)) : '—'}</b>
                  <small>{words.celsius}</small>
                </div>
                <div
                  className="cluster-readout"
                  data-warn={
                    t && (t.brakeAirWarning || (t.brakeAirPressure > 0 && t.brakeAirPressure < 85)) ? '' : undefined
                  }
                  aria-label={`${words.brakeAir} ${t ? text.number(Math.round(t.brakeAirPressure)) : 0} ${words.psi}`}
                >
                  <span className="cluster-glyph" aria-hidden>
                    <BrakeAirIcon />
                  </span>
                  <b>{t ? text.number(Math.round(t.brakeAirPressure)) : '—'}</b>
                  <small>{words.psi}</small>
                </div>
                <div
                  className="cluster-readout"
                  data-warn={
                    t && (t.batteryWarning || (t.batteryVoltage > 0 && t.batteryVoltage < 24)) ? '' : undefined
                  }
                  aria-label={`${words.battery} ${t ? t.batteryVoltage.toFixed(1).replace('.', text.decimal) : 0} ${words.volts}`}
                >
                  <span className="cluster-glyph" aria-hidden>
                    <BatteryIcon />
                  </span>
                  <b>{t ? t.batteryVoltage.toFixed(1).replace('.', text.decimal) : '—'}</b>
                  <small>{words.volts}</small>
                </div>
              </section>
            )}

            {cards.hours && (
              <section className="cluster-panel cluster-hours" aria-label={words.driverHours}>
                <div
                  className="cluster-hours-row"
                  data-due={rest >= 0 && rest <= 60 ? '' : undefined}
                  aria-label={`${words.restStop} ${rest >= 0 ? minutes(rest) : words.noRest}`}
                >
                  <span className="cluster-glyph" aria-hidden>
                    <RestIcon />
                  </span>
                  <strong>{rest >= 0 ? minutes(rest) : '—'}</strong>
                  <span className="cluster-dot" aria-hidden />
                </div>
                <div
                  className="cluster-hours-row"
                  data-due={breaking >= 0 && breaking <= 60 ? '' : undefined}
                  aria-label={`${words.mandatoryBreak} ${breaking >= 0 ? minutes(breaking) : words.noRest}`}
                >
                  <span className="cluster-glyph" aria-hidden>
                    <BreakIcon />
                  </span>
                  <strong>{breaking >= 0 ? minutes(breaking) : '—'}</strong>
                  <span className="cluster-dot" aria-hidden />
                </div>
              </section>
            )}
          </aside>

          <section className="cluster-dial" aria-label={`${speed} ${words.kmh}`}>
            <div className="cluster-dial-wrap">
              <svg className="cluster-dial-ring" viewBox="0 0 300 300" aria-hidden>
                <circle
                  className="cluster-dial-track"
                  cx="150"
                  cy="150"
                  r={DIAL_RADIUS}
                  strokeDasharray={`${DIAL_CIRCUMFERENCE * DIAL_SWEEP} ${DIAL_CIRCUMFERENCE}`}
                  transform={`rotate(${DIAL_START} 150 150)`}
                />
                {DIAL_TICKS.map((tick) => (
                  <line
                    key={tick}
                    className={tick % 2 === 0 ? 'cluster-tick major' : 'cluster-tick'}
                    x1="150"
                    y1={tick % 2 === 0 ? 18 : 23}
                    x2="150"
                    y2="31"
                    transform={`rotate(${DIAL_TICK_START + (tick / 12) * DIAL_SWEEP_DEGREES} 150 150)`}
                  />
                ))}
                <circle
                  className="cluster-dial-rpm"
                  cx="150"
                  cy="150"
                  r={DIAL_RADIUS}
                  strokeDasharray={`${DIAL_CIRCUMFERENCE * DIAL_SWEEP * rpm} ${DIAL_CIRCUMFERENCE}`}
                  transform={`rotate(${DIAL_START} 150 150)`}
                />
                <g
                  className="cluster-needle"
                  style={{ transform: `rotate(${needleAngle}deg)`, transformOrigin: '150px 150px' }}
                >
                  <line x1="150" y1="150" x2="150" y2="46" />
                </g>
                <circle className="cluster-needle-cap" cx="150" cy="150" r="6" />
              </svg>

              <div className="cluster-speed">
                <strong key={Math.round(speed)} className="cluster-speed-value">
                  {speed}
                </strong>
                <span>{words.kmh}</span>
              </div>
              <div className="cluster-gear" aria-label={`${words.gear} ${gear}`}>
                <span>{gear}</span>
              </div>

              {limit > 0 && (
                <div className={`cluster-limitsign${speed > limit ? ' over' : ''}`} aria-label={text.speedLimit(limit)}>
                  <b>{limit}</b>
                </div>
              )}
            </div>
          </section>

          <aside className="cluster-side cluster-side-right">
            {cards.fuel && (
              <section className="cluster-panel cluster-gauge cluster-fuel" aria-label={words.fuel}>
                <div className="cluster-gauge-row">
                  <span className="cluster-glyph" data-warn={t?.fuelWarning ? '' : undefined} aria-hidden>
                    <FuelIcon />
                  </span>
                  <div className="cluster-meter" data-low={t?.fuelWarning ? '' : undefined}>
                    <span style={{ width: `${Math.round((fuelShare ?? 0) * 100)}%` }} />
                  </div>
                  <strong className="cluster-gauge-value">
                    {t ? text.number(Math.round(t.fuel)) : '—'}
                    <small>{words.litres}</small>
                  </strong>
                </div>
                <div
                  className="cluster-gauge-foot"
                  aria-label={`${words.range} ${t ? text.number(Math.round(t.fuelRange)) : 0} ${words.km} · ${words.used} ${t ? text.number(Math.round(trip.fuel)) : 0} ${words.litres}`}
                >
                  <span className="cluster-foot-pair" aria-hidden>
                    <RangeIcon />
                    <b>{t ? text.number(Math.round(t.fuelRange)) : '—'}</b>
                    <small>{words.km}</small>
                  </span>
                  <span className="cluster-foot-pair" aria-hidden>
                    <DropIcon />
                    <b>{t ? text.number(Math.round(trip.fuel)) : '—'}</b>
                    <small>{words.litres}</small>
                  </span>
                </div>
              </section>
            )}

            {cards.engine && (
              <section className="cluster-panel cluster-brakes" aria-label={words.brakeTemperature}>
                <div className="cluster-brake-head">
                  <span
                    className="cluster-glyph"
                    data-warn={t && t.brakeTemperature >= 450 ? '' : undefined}
                    aria-hidden
                  >
                    <BrakeTemperatureIcon />
                  </span>
                  <div className="cluster-meter" data-hot={t && t.brakeTemperature >= 300 ? '' : undefined}>
                    <span style={{ width: `${Math.round(brakeHeat * 100)}%` }} />
                  </div>
                  <strong
                    className="cluster-gauge-value"
                    data-hot={t && t.brakeTemperature >= 300 ? '' : undefined}
                    data-warn={t && t.brakeTemperature >= 450 ? '' : undefined}
                  >
                    {t ? text.number(Math.round(t.brakeTemperature)) : '—'}
                    <small>{words.celsius}</small>
                  </strong>
                </div>
              </section>
            )}

            <div className="cluster-pair-gauges">
              <section className="cluster-panel cluster-mini" aria-label={words.adblue}>
                <span className="cluster-glyph" data-warn={t?.adblueWarning ? '' : undefined} aria-hidden>
                  <AdblueIcon />
                </span>
                <strong>
                  {t ? text.number(Math.round(t.adblue)) : '—'}
                  <small>{words.litres}</small>
                </strong>
                <div className="cluster-meter" data-low={t?.adblueWarning ? '' : undefined}>
                  <span style={{ width: `${Math.round(adblueShare * 100)}%` }} />
                </div>
              </section>

              <section
                className="cluster-panel cluster-mini cluster-coolant"
                aria-label={`${words.coolant} ${t ? text.number(Math.round(t.coolantTemperature)) : 0} ${words.celsius}`}
              >
                <span
                  className="cluster-glyph"
                  data-warn={t && t.coolantTemperature >= 100 ? '' : undefined}
                  aria-hidden
                >
                  <CoolantIcon />
                </span>
                <strong>
                  {t ? text.number(Math.round(t.coolantTemperature)) : '—'}
                  <small>{words.celsius}</small>
                </strong>
                <div className="cluster-meter" data-hot={t && t.coolantTemperature >= 100 ? '' : undefined}>
                  <span style={{ width: `${Math.round(coolantShare * 100)}%` }} />
                </div>
              </section>
            </div>
          </aside>
        </div>

        {nowPlaying && (
          <div
            className="cluster-nowplaying"
            data-paused={nowPlaying.playing ? undefined : ''}
            aria-label={`${text.nowPlaying}: ${nowPlaying.title}${nowPlaying.artist ? ` · ${nowPlaying.artist}` : ''}`}
          >
            <MusicIcon />
            <b>{nowPlaying.title}</b>
            {nowPlaying.artist && <span>{nowPlaying.artist}</span>}
          </div>
        )}
      </div>
    </main>
  )
}

/**
 * The cabin's boot screen, played over the cluster: the panel lights, Cabin Play's mark and the truck's brand
 * arrive, and it goes down as the dial comes up. It starts from the electrics and runs on its own clock, which is
 * what power.ts does for the cabin; here one ignition is one boot.
 */
function ClusterBoot({ onDone }: { onDone: () => void }) {
  const [phase, setPhase] = useState<'splash' | 'connecting' | null>('splash')
  useEffect(() => {
    const connecting = setTimeout(() => setPhase('connecting'), SPLASH_MS)
    const done = setTimeout(() => {
      setPhase(null)
      onDone()
    }, SPLASH_MS + CONNECTING_MS)
    return () => {
      clearTimeout(connecting)
      clearTimeout(done)
    }
  }, [onDone])
  return phase ? <BootScreen phase={phase} /> : null
}

/** A telltale: its icon, the label a screen reader reads, and the colour the dash lights it in. */
interface Telltale {
  key: string
  label: string
  tone: 'ok' | 'info' | 'warn' | 'danger'
  blink?: boolean
  icon: ReactElement
  active: boolean
}

/**
 * The truck's brand in the status line, where the dash carries its maker's mark: its own logo when the brand has
 * one (`public/brand-logos`, outside the repository), and its name where it has none.
 */
function BrandMark() {
  const truck = useLive((state) => state.truck)
  const brand = truck ? `${truck.brandId} ${truck.brand}` : ''
  const [shown, setShown] = useState(brand)
  const [attempt, setAttempt] = useState(0)
  if (shown !== brand) {
    setShown(brand)
    setAttempt(0)
  }
  const sources = truck ? logoSources(truck.brandId, truck.brand, { mono: true }) : []
  return (
    <span className="cluster-brand" role={truck ? 'img' : undefined} aria-label={truck?.brand}>
      {truck && attempt < sources.length ? (
        <img
          key={sources[attempt].src}
          src={sources[attempt].src}
          alt=""
          onError={() => setAttempt((current) => current + 1)}
        />
      ) : (
        <b>{truck?.brand ?? ''}</b>
      )}
    </span>
  )
}

/** A notice on the cluster: the cab's newest warning, phone message or call, in one line. */
interface ClusterNotice {
  key: string
  kind: 'game' | 'phone' | 'call'
  tone: 'info' | 'warn' | 'alarm'
  label: string
  title: string
  detail?: string
  /** A phone notification's own app icon, when it sent one. */
  icon?: string
  /** How many are waiting: the newest is the one read, the rest are counted. */
  count: number
}

/**
 * The one notice the cluster has room for: a call first, then the phone's newest notification, then the game's
 * newest warning. The cabin's stack keeps all of them and their history; here it is a glance, so the rest are
 * counted rather than stacked over the dial.
 */
function useClusterNotice(): ClusterNotice | null {
  const text = useText()
  const call = usePhone((state) => state.call)
  const caller = useCaller(call?.id)
  const toasts = usePhoneToasts((state) => state.toasts)
  const alert = useClusterAlert(text)
  if (call && call.state !== 'idle') {
    const ringing = call.state === 'ringing'
    return {
      key: `call:${call.id}`,
      kind: 'call',
      tone: ringing ? 'alarm' : 'info',
      label: ringing ? text.phoneApp.ringing : text.phoneApp.inCall,
      title: call.name ?? caller.name ?? call.number ?? caller.number ?? text.phoneApp.unknownCaller,
      detail: call.name && call.number ? call.number : undefined,
      count: 1,
    }
  }
  const notification = toasts[0]
  if (notification) {
    const urgent =
      (notification.priority ?? 0) >= 2 || notification.category === 'alarm' || notification.category === 'call'
    return {
      key: `phone:${notification.id}`,
      kind: 'phone',
      tone: urgent ? 'alarm' : 'info',
      label: notification.app,
      title: notification.title ?? notification.text ?? notification.app,
      detail: notification.title ? notification.text : undefined,
      icon: notification.icon,
      count: toasts.length,
    }
  }
  return alert
}

/**
 * The game's warnings and rest clocks while they're calling for attention: the newest alarm reads first, and the
 * rest are counted. They stay up while the reading is wrong, unlike the cabin's timed pills: a warning covering
 * the route is better than a route covering a fault.
 */
function useClusterAlert(text: Strings): ClusterNotice | null {
  const telemetry = useLive((state) => state.telemetry)
  if (!telemetry) return null
  const current = gameAlerts(telemetry, text).filter((alert) => alert.on)
  if (current.length === 0) return null
  const next = current.find((alert) => alert.tone === 'alarm') ?? current[0]
  return {
    key: `game:${next.key}`,
    kind: 'game',
    tone: next.tone,
    label: next.tone === 'alarm' ? text.notificationsApp.alert : text.notificationsApp.warning,
    title: next.title,
    detail: next.detail,
    count: current.length,
  }
}

/** The notice line in the header: its mark, what it is, what it says, and how many more are waiting. */
function ClusterNoticeBar({ notice }: { notice: ClusterNotice }) {
  return (
    <div className="cluster-notice" data-kind={notice.kind} data-tone={notice.tone} aria-live="polite">
      {notice.icon ? (
        <img className="cluster-notice-app" src={notice.icon} alt="" />
      ) : (
        <span className="cluster-notice-mark" aria-hidden>
          {notice.kind === 'game' ? <WarningIcon /> : <PhoneIcon />}
        </span>
      )}
      <span className="cluster-notice-label">{notice.label}</span>
      <b>{notice.title}</b>
      {notice.detail && <span className="cluster-notice-text">{notice.detail}</span>}
      {notice.count > 1 && <span className="cluster-notice-count">+{notice.count - 1}</span>}
    </div>
  )
}

/** The dial's geometry: a 270° sweep from 7:30 to 4:30, as a truck's speedometer counts. */
const DIAL_RADIUS = 132
const DIAL_MAX_KMH = 120
const DIAL_CIRCUMFERENCE = 2 * Math.PI * DIAL_RADIUS
const DIAL_SWEEP = 0.75
const DIAL_START = 135
/* A tick is drawn from the top (12 o'clock), so it starts 270° behind the arc's first angle. */
const DIAL_TICK_START = DIAL_START - 270
const DIAL_SWEEP_DEGREES = 270
const DIAL_TICKS = Array.from({ length: 13 }, (_, tick) => tick)

function clamp(value: number): number {
  return Math.max(0, Math.min(1, value))
}

/** A driver-hours clock as the cluster says it: "4:05 h", or "58 min". */
function minutes(value: number): string {
  const whole = Math.max(0, Math.round(value))
  if (whole < 60) return `${whole} min`
  return `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, '0')} h`
}
