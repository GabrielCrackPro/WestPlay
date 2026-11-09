import { type CSSProperties, type ReactElement, useCallback, useEffect, useState } from 'react'
import { formatGameTime, formatGear } from '../../shared/format'
import { cabClock, hasTruck, subscribeHostMessages } from '../../shared/host'
import {
  adblue as adblueReading,
  battery as batteryReading,
  brakeAir as brakeAirReading,
  brakeTemperature as brakeTemperatureReading,
  consumption as consumptionReading,
  coolant as coolantReading,
  fuelLevel,
  oil as oilReading,
  warned,
} from '../apps/diagnostics/readings'
import { tripAverage } from '../apps/diagnostics/trip'
import { useTrends } from '../apps/diagnostics/useTrends'
import { receivePhoneNotifications, receivePhoneState, useCaller, usePhone, usePhoneToasts } from '../apps/phone/phone'
import { BootScreen } from '../boot/BootScreen'
import { logoSources } from '../boot/brand'
import { CONNECTING_MS, SPLASH_MS } from '../state/power'
import { resolveAppearance } from '../state/appearance'
import { useNightDim } from '../state/nightDim'
import { syncClock, useCabin, useLive } from '../state/store'
import { routeAccent } from '../maps/routeLook'
import { useClock } from '../state/clock'
import { clusterTextScale } from '../state/textSize'
import { useUnits } from '../state/units'
import { useText } from '../state/text'
import type { Strings } from '../state/strings'
import type { SpeedFace } from '../../shared/units'
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
  RetarderIcon,
  TripIcon,
  WarningIcon,
  WipersIcon,
} from './ClusterIcons'
import { useInstantConsumption } from './useInstant'
import './cluster.css'

/**
 * WestPlay's instrument cluster, on the truck's own cluster display (the Scania S and R's; setup patches their
 * dashboard scripts with its texture, and the host streams this page into it). Laid out at
 * `westplay_shared::CLUSTER_WIDTH` x `CLUSTER_HEIGHT`.
 *
 * It reads like the dash it replaces. The speedo is the middle: the driver's face (120 km/h, or 80 mph) with its
 * numbers on it, a lit arc running round to the speed with the needle's bead at its head,
 * the speed and the truck's own brand under it, and the tacho as a ring around the face with Scania's own bands — blue where the auxiliary
 * brake is strongest, red past 2,400 rpm. The truck's readings run down the right, the trip, engine and driver's
 * clocks down the left, the lights and warnings sit either side of the route at the top, and the cab's newest
 * message has a line of its own over the dial instead of taking the route's place. What plays sits in the dial's
 * open bottom (owner 2026-11-08: "more icons and visuals, less text").
 *
 * Colour is the dash's own language: the ink for readings, the accent for what is live, and green, amber, blue and
 * red only for states — so a warning is the one thing on the glass that is coloured.
 */
export function ClusterScreen() {
  const text = useText()
  const words = text.diagnostics
  // The driver's units (Settings › Appearance › Units, or the game's own): speeds, distances, fuel, temperatures.
  const units = useUnits()
  const telemetry = useLive((state) => state.telemetry)
  const truck = useLive((state) => state.truck)
  const job = useLive((state) => state.job)
  const nowPlaying = useLive((state) => state.nowPlaying)
  const clockShift = useLive((state) => state.clockShift)
  const shown = useCabin((state) => state.clusterShown)
  const cards = useCabin((state) => state.clusterCards)
  const reduceMotion = useCabin((state) => state.reduceMotion)
  // The player's Text Size, taken at the panel's own scale (state/textSize.ts): the dash is drawn in the room the
  // step leaves it and zoomed to the texture, so the whole panel answers the setting without ever clipping.
  const textSize = useCabin((state) => state.textSize)
  const typeScale = clusterTextScale(textSize)
  const routeColour = useCabin((state) => state.mapRoute)
  // The clock the dash and its route read (shared/clock.ts), subscribed so a change in Settings draws at once.
  useClock()
  const mode = useCabin((state) => state.appearanceMode)
  // The truck's night dims the panel as it dims the cabin's screen (state/nightDim.ts): 0 by day.
  const nightDim = useNightDim()
  // Whether the game runs. The host keeps this page between games, so without it the panel would hold the last
  // frame of a closed game up as if the truck were still driving.
  const [running, setRunning] = useState<boolean | null>(null)
  // The trip since the engine came on, worked out from the same telemetry (its distance, not the odometer).
  const { trip } = useTrends()
  // The tank's loss over the last second, for the instant-consumption gauge (the game reports only the average).
  const instant = useInstantConsumption()
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
        else if (message.type === 'game') setRunning(message.running)
        // The profile's "Use miles" and its game: the dash in the driver's own units.
        else if (message.type === 'units') {
          useLive.setState({ gameUnits: message.miles ? (message.american ? 'us' : 'uk') : 'metric' })
        }
        // The profile's clock: the dash's time in 24 hours, or 12 with AM and PM.
        else if (message.type === 'clock') {
          useLive.setState({ gameClock24: message.clock24 })
          syncClock()
        }
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
  // The game closed: nothing on the panel is live any more, so it lets go of the truck's last frame (the boot
  // starts afresh when the next game's electrics come on).
  useEffect(() => {
    if (running !== false) return
    useLive.setState({ telemetry: null, truck: null, job: null, nowPlaying: null })
  }, [running])
  // The job's route, once the game has guided it. Before guidance starts the job's planned distance is what's
  // left, but once the destination is reached it is the whole trip, and mustn't read as if it were still ahead.
  const jobKey = job ? [job.sourceCity, job.sourceCompany, job.destinationCity, job.cargoLoaded].join('|') : ''
  const [guidedFor, setGuidedFor] = useState<string | null>(null)
  useEffect(() => {
    if (telemetry && telemetry.navigationDistance > 0 && guidedFor !== jobKey) setGuidedFor(jobKey)
  }, [telemetry, jobKey, guidedFor])
  const guided = jobKey !== '' && guidedFor === jobKey

  // The boot, as the cabin's: the panel lights with the truck's brand and Cabin Play's mark as the electrics come
  // on, and clears to the cluster. The cluster page has no power clock of its own, so the electrics are its cue:
  // an ignition cycle boots the screen again, exactly as the cabin's does. The cycle is its key, so each ignition
  // gets a fresh boot from its first frame.
  const electric = telemetry?.electricEnabled ?? false
  const [ignition, setIgnition] = useState(() => ({ on: electric, cycle: 0 }))
  useEffect(() => {
    if (electric) {
      setIgnition((current) => (current.on ? current : { on: true, cycle: current.cycle + 1 }))
      return
    }
    // A frame with the electrics down is a pause or a dropped reading, not an ignition-off: the panel keeps its
    // screen unless the off holds, so one hiccup doesn't replay the whole boot.
    const off = setTimeout(
      () => setIgnition((current) => (current.on ? { on: false, cycle: current.cycle } : current)),
      ELECTRIC_OFF_HOLD_MS,
    )
    return () => clearTimeout(off)
  }, [electric])
  // The cluster is covered by the boot, so its entrance would play out of sight. Re-mount it as the boot clears
  // and it comes up with everything moving, rather than fading in underneath the panel's light.
  const [shellCycle, setShellCycle] = useState(0)
  const bootDone = useCallback(() => setShellCycle((cycle) => cycle + 1), [])

  // Switched off in Settings: the game's own cluster shows through the transparent texture.
  if (!shown) return null
  // The game is gone: there is no truck to read, so the panel goes dark rather than hold a dead screen of zeros.
  if (running === false) return null

  const t = telemetry
  const speed = t ? units.speed(t.speed) : 0
  const gear = formatGear(t?.displayedGear ?? 0)
  const rpm = t ? Math.max(0, Math.min(1, t.engineRpm / RPM_MAX)) : 0
  const limit = t ? units.limit(t.navigationSpeedLimit) : 0
  const cruise = t ? units.speed(t.cruiseControlSpeed) : 0
  // The face: its top speed, the step between its numbers and between its ticks (faster numbers are further apart
  // in mph, so fewer of them fit the same sweep).
  const face = units.face
  // How far round the face the driver is: the lit arc's length, and the angle the needle's head rides at.
  const speedShare = clamp(speed / face.max)
  const faceNumbers = Array.from({ length: Math.round(face.max / face.step) + 1 }, (_, at) => at * face.step)
  const faceTicks = Array.from({ length: Math.round(face.max / face.minor) + 1 }, (_, at) => at * face.minor)
  const capacity = truck?.fuelCapacity ?? 0
  const fuelShare = capacity > 0 && t ? clamp(t.fuel / capacity) : null
  // The readings as Diagnostics gauges them: the same ranges, the same warning lines and the game's own warning
  // channels, so the cluster and the app can't disagree about when something is wrong.
  const adblue = t ? adblueReading(t.adblue) : null
  const coolant = t ? coolantReading(t.coolantTemperature) : null
  const oilTemp = t ? oilReading(t.oilTemperature) : null
  const air = t ? warned(brakeAirReading(t.brakeAirPressure), t.brakeAirWarning) : null
  const volts = t ? warned(batteryReading(t.batteryVoltage), t.batteryWarning) : null
  const brakeHeat = t ? brakeTemperatureReading(t.brakeTemperature) : null
  const fuel =
    fuelShare === null ? null : warned(fuelLevel(fuelShare, truck?.fuelWarningFactor), t?.fuelWarning ?? false)
  const instantReading = instant === null ? null : consumptionReading(instant)
  // A cold diesel reads blue on the dash until it is up to working temperature, not only red when it is too hot.
  const coldCoolant = (t?.coolantTemperature ?? 0) > 0 && (t?.coolantTemperature ?? 0) < COLD_C
  const coldOil = (t?.oilTemperature ?? 0) > 0 && (t?.oilTemperature ?? 0) < COLD_C
  // The truck's damage: the worst of its parts, lit amber from 15% and red from 50% as the game's own warning and
  // stop lamps are (`indicator_warning` and `indicator_stop`).
  const damage = t ? Math.max(t.wearEngine, t.wearWheels, t.wearTransmission, t.wearCabin, t.wearChassis) : 0
  const damageTone: Telltale['tone'] | null = damage >= DAMAGE_STOP ? 'danger' : damage >= DAMAGE_WARN ? 'warn' : null
  const rest = t?.restStop ?? -1
  const breaking = t?.mandatoryBreak ?? -1
  const time = t ? formatGameTime(cabClock(t, clockShift)) : '--:--'
  const average = trip.distance > 0.05 ? tripAverage(trip) : (t?.fuelAverage ?? 0)
  // The readings as the driver's units set them, the number and its unit apart for the dash's two sizes.
  const tripFigure = units.distanceFigure(trip.distance, text.decimal)
  const averageFigure = units.consumptionFigure(average, text.decimal)
  const rangeFigure = units.longFigure(t?.fuelRange ?? 0, text.decimal)
  const odoFigure = units.longFigure(t?.odometer ?? 0, text.decimal)
  const fuelFigure = units.volumeFigure(t?.fuel ?? 0, text.decimal)
  const usedFigure = units.volumeFigure(trip.fuel, text.decimal)
  const adblueFigure = units.volumeFigure(t?.adblue ?? 0, text.decimal)
  const oilFigure = units.temperatureFigure(t?.oilTemperature ?? 0, text.decimal)
  const airFigure = units.pressureFigure(t?.brakeAirPressure ?? 0, text.decimal)
  const heatFigure = units.temperatureFigure(t?.brakeTemperature ?? 0, text.decimal)
  const coolantFigure = units.temperatureFigure(t?.coolantTemperature ?? 0, text.decimal)
  const instantFigure = instant === null ? null : units.consumptionFigure(instant, text.decimal)
  // The route's own line: the game's route while it guides, or the job's planned distance before it starts.
  const destination = job
    ? job.cargoLoaded
      ? job.destinationCity || job.destinationCompany
      : job.sourceCity || job.sourceCompany
    : null
  const routeDistance =
    t && t.navigationDistance > 0
      ? t.navigationDistance
      : !guided && job && job.cargoLoaded && job.plannedDistanceKm > 0
        ? job.plannedDistanceKm * 1000
        : null
  const routeArrival = t && t.navigationTime > 0 ? Math.round(cabClock(t, clockShift) + t.navigationTime / 60) : null
  const routeLabel = [
    destination,
    routeDistance !== null ? units.distance(routeDistance, text.decimal) : '',
    routeArrival !== null ? `${text.arrival} ${formatGameTime(routeArrival)}` : '',
  ]
    .filter(Boolean)
    .join(' · ')
  const appearance = resolveAppearance(mode, {
    gameTime: t ? cabClock(t, clockShift) : null,
    lowBeam: t?.lowBeam ?? false,
  })
  // The dash's accent is the map's route colour (Settings › Maps › Route): the one colour the driver already chose
  // for "this is the way", on the needle, the cruise mark and the live readings. The route's own fill does on the
  // dark panel, its darker edge on the light one, so it reads on either.
  const accent = routeAccent(appearance, routeColour)

  // The lights the driver switches: the indicators first, then the beams, the running lights and the wipers. Each
  // keeps its place even when it is out, so a blinker lighting up never moves the others.
  const lights: Telltale[] = [
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
  ]

  // The retarder's own light, on the trucks that have one: lit while the driver holds a step.
  if (truck && truck.retarderSteps > 0) {
    lights.push({
      key: 'retarder',
      label: words.retarder,
      tone: 'info',
      icon: <RetarderIcon />,
      active: (t?.retarderLevel ?? 0) > 0,
    })
  }

  // The warnings, grouped as the dash groups them, nearest the dial where the eye lands.
  const faults: Telltale[] = [
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

  // The dash's damage lamps, off the wear the game already sends: one light, amber then red as the truck wears.
  if (damageTone) {
    faults.push({ key: 'damage', label: words.damage, tone: damageTone, icon: <WarningIcon />, active: true })
  }

  // The dial's needle: 270° from its first tick to its last, on the driver's face.
  const needleAngle = DIAL_START + 90 + DIAL_SWEEP_DEGREES * speedShare

  return (
    <main
      className="cluster"
      data-appearance={appearance}
      data-alarm={notice?.tone === 'alarm' ? '' : undefined}
      aria-label={text.settings.clusterScreen}
      style={{ '--cluster-scale': typeScale, '--cluster-give': 1 / typeScale, '--accent': accent } as CSSProperties}
    >
      {ignition.on && <ClusterBoot key={ignition.cycle} onDone={bootDone} />}

      <div className="cluster-shell" key={shellCycle}>
        <header className="cluster-status">
          <TelltaleList items={lights} label={words.telltales} />
          {/* What a screen reader hears of the notice. The line itself comes and goes with its words, and a live
              region mounted along with its text is often not announced: this one is always here to be read into. */}
          <p className="cluster-sr-only" aria-live="polite" aria-atomic="true">
            {notice
              ? [notice.label, notice.title, notice.detail, notice.count > 1 ? `+${notice.count - 1}` : '']
                  .filter(Boolean)
                  .join('. ')
              : ''}
          </p>
          {/* The route keeps its place whether or not the cab has something to say: a message must not cost the
              driver the distance and the ETA. It only has to fit between the lights. */}
          <div className="cluster-route" aria-label={routeLabel || undefined}>
            {routeLabel ? (
              <>
                <RangeIcon />
                {destination && <b>{destination}</b>}
                {routeDistance !== null && <span>{units.distance(routeDistance, text.decimal)}</span>}
                {routeArrival !== null && (
                  <span className="cluster-route-eta">
                    <ClockIcon />
                    {formatGameTime(routeArrival)}
                  </span>
                )}
              </>
            ) : null}
          </div>
          <TelltaleList items={faults} label={words.warnings} />
          <div className="cluster-status-right">
            <span
              className="cluster-pill cluster-cruise"
              data-on={cruise > 0 ? '' : undefined}
              aria-label={cruise > 0 ? `${words.cruiseControl} ${cruise} ${units.labels.speed}` : undefined}
              aria-hidden={cruise <= 0}
            >
              <CruiseIcon />
              <b>{cruise > 0 ? cruise : 0}</b>
            </span>
            {limit > 0 && (
              <span
                className="cluster-limitsign"
                data-over={speed > limit ? '' : undefined}
                aria-label={text.speedLimit(limit)}
              >
                <b>{limit}</b>
              </span>
            )}
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
                aria-label={`${words.trip} ${t ? tripFigure.value : 0} ${tripFigure.unit}`}
              >
                <div className="cluster-trip-top">
                  <span className="cluster-glyph" aria-hidden>
                    <TripIcon />
                  </span>
                  <strong className="cluster-trip-value">
                    {t ? tripFigure.value : '—'}
                    <small>{tripFigure.unit}</small>
                  </strong>
                </div>
                <div className="cluster-pairs">
                  <span
                    className="cluster-pair"
                    aria-label={`${words.average} ${averageFigure.value} ${averageFigure.unit}`}
                  >
                    <GaugeIcon />
                    <b>{t ? averageFigure.value : '—'}</b>
                    <small>{averageFigure.unit}</small>
                  </span>
                  <span
                    className="cluster-pair"
                    aria-label={`${words.range} ${t ? rangeFigure.value : 0} ${rangeFigure.unit}`}
                  >
                    <RangeIcon />
                    <b>{t ? rangeFigure.value : '—'}</b>
                    <small>{rangeFigure.unit}</small>
                  </span>
                </div>
                <div
                  className="cluster-odo"
                  aria-label={`${words.odometer} ${t ? odoFigure.value : 0} ${odoFigure.unit}`}
                >
                  <OdometerIcon />
                  <b>{t ? odoFigure.value : '—'}</b>
                  <small>{odoFigure.unit}</small>
                </div>
              </section>
            )}

            {cards.engine && (
              <section className="cluster-panel cluster-engine" aria-label={words.engine}>
                <div
                  className="cluster-readout"
                  data-warn={oilTemp?.state !== 'ok' ? '' : undefined}
                  data-cold={coldOil ? '' : undefined}
                  aria-label={`${words.oilTemperature} ${t ? oilFigure.value : 0} ${oilFigure.unit}`}
                >
                  <span className="cluster-glyph" aria-hidden>
                    <OilTemperatureIcon />
                  </span>
                  <b>{t ? oilFigure.value : '—'}</b>
                  <small>{oilFigure.unit}</small>
                </div>
                <div
                  className="cluster-readout"
                  data-warn={air?.state !== 'ok' ? '' : undefined}
                  aria-label={`${words.brakeAir} ${t ? airFigure.value : 0} ${airFigure.unit}`}
                >
                  <span className="cluster-glyph" aria-hidden>
                    <BrakeAirIcon />
                  </span>
                  <b>{t ? airFigure.value : '—'}</b>
                  <small>{airFigure.unit}</small>
                </div>
                <div
                  className="cluster-readout"
                  data-warn={volts?.state !== 'ok' ? '' : undefined}
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
                  aria-label={`${words.restStop} ${rest >= 0 ? minutes(rest, words) : words.noRest}`}
                >
                  <span className="cluster-glyph" aria-hidden>
                    <RestIcon />
                  </span>
                  <strong>{rest >= 0 ? minutes(rest, words) : '—'}</strong>
                  <span className="cluster-dot" aria-hidden />
                </div>
                <div
                  className="cluster-hours-row"
                  data-due={breaking >= 0 && breaking <= 60 ? '' : undefined}
                  aria-label={`${words.mandatoryBreak} ${breaking >= 0 ? minutes(breaking, words) : words.noRest}`}
                >
                  <span className="cluster-glyph" aria-hidden>
                    <BreakIcon />
                  </span>
                  <strong>{breaking >= 0 ? minutes(breaking, words) : '—'}</strong>
                  <span className="cluster-dot" aria-hidden />
                </div>
              </section>
            )}
          </aside>

          <section className="cluster-centre">
            {/* The cab's newest message has a line of its own, always reserved, so the route above never moves and a
                message never covers the dial. The phone's own status closes the line at its right end: the status bar
                above is the truck's (cruise, limit, clock), and what the phone is belongs with what it has to say. */}
            <div className="cluster-message">
              {notice ? <ClusterNoticeBar notice={notice} /> : null}
              <ClusterPhone />
            </div>

            <section className="cluster-dial" aria-label={`${speed} ${units.labels.speed}`}>
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
                  {/* The speed, as a lit arc in the track's groove: how far round the face the driver is, drawn in
                      the dash's accent so the one colour on the glass is also the speed. */}
                  <circle
                    className="cluster-dial-fill"
                    cx="150"
                    cy="150"
                    r={DIAL_RADIUS}
                    strokeDasharray={`${DIAL_CIRCUMFERENCE * DIAL_SWEEP * speedShare} ${DIAL_CIRCUMFERENCE}`}
                    transform={`rotate(${DIAL_START} 150 150)`}
                  />
                  {faceTicks.map((tick) => (
                    <line
                      key={tick}
                      className={tick % face.step === 0 ? 'cluster-tick major' : 'cluster-tick'}
                      x1="150"
                      y1={tick % face.step === 0 ? 23 : 26}
                      x2="150"
                      y2="33"
                      transform={`rotate(${DIAL_TICK_START + (tick / face.max) * DIAL_SWEEP_DEGREES} 150 150)`}
                    />
                  ))}
                  {faceNumbers.map((value) => {
                    const at = dialPoint(value, SPEED_LABEL_RADIUS, face)
                    return (
                      <text
                        key={value}
                        className="cluster-dial-label"
                        x={at.x}
                        y={at.y}
                        textAnchor="middle"
                        dominantBaseline="central"
                      >
                        {value}
                      </text>
                    )
                  })}
                  <circle
                    className="cluster-dial-rpm-track"
                    cx="150"
                    cy="150"
                    r={RPM_RADIUS}
                    strokeDasharray={`${RPM_CIRCUMFERENCE * DIAL_SWEEP} ${RPM_CIRCUMFERENCE}`}
                    transform={`rotate(${DIAL_START} 150 150)`}
                  />
                  <circle
                    className="cluster-dial-rpm"
                    cx="150"
                    cy="150"
                    r={RPM_RADIUS}
                    strokeDasharray={`${RPM_CIRCUMFERENCE * DIAL_SWEEP * rpm} ${RPM_CIRCUMFERENCE}`}
                    transform={`rotate(${DIAL_START} 150 150)`}
                  />
                  {RPM_BANDS.map((band) => (
                    <circle
                      key={band.band}
                      className="cluster-rpm-band"
                      data-band={band.band}
                      cx="150"
                      cy="150"
                      r={RPM_BAND_RADIUS}
                      strokeDasharray={`${RPM_BAND_CIRCUMFERENCE * DIAL_SWEEP * (band.to - band.from)} ${RPM_BAND_CIRCUMFERENCE}`}
                      strokeDashoffset={-RPM_BAND_CIRCUMFERENCE * DIAL_SWEEP * band.from}
                      transform={`rotate(${DIAL_START} 150 150)`}
                    />
                  ))}
                  {/* The needle rides the ring rather than crossing the face: a bead at the head of the lit arc.
                      A line from the hub would run through the figure and the scale's numbers, which is the one
                      thing the dial can't afford — the speed, the unit and the truck's brand sit at its centre. */}
                  <g
                    className="cluster-needle"
                    style={{ transform: `rotate(${needleAngle}deg)`, transformOrigin: '150px 150px' }}
                  >
                    <circle className="cluster-needle-head" cx="150" cy={150 - DIAL_RADIUS} r="4.8" />
                  </g>
                </svg>

                {/* The face reads top to bottom: the figure, its unit, and whose dash this is. The needle never
                    sweeps the bottom of the face (the arc's gap is there), so the brand sits clear of it, and the
                    gear keeps the open bottom under it. */}
                <div className="cluster-speed" aria-hidden>
                  <strong key={Math.round(speed)} className="cluster-speed-value">
                    {speed}
                  </strong>
                  <span>{units.labels.speed}</span>
                  <ClusterBrand />
                </div>
                <div className="cluster-gear" aria-label={`${words.gear} ${gear}`}>
                  <span>{gear}</span>
                </div>
              </div>
            </section>

            {/* What plays, in the dial's open bottom: one line, the way the dash's display keeps it out of the way. */}
            <div
              className="cluster-media"
              data-paused={nowPlaying && !nowPlaying.playing ? '' : undefined}
              aria-label={
                nowPlaying
                  ? `${text.nowPlaying}: ${nowPlaying.title}${nowPlaying.artist ? ` · ${nowPlaying.artist}` : ''}`
                  : undefined
              }
            >
              {nowPlaying && (
                <>
                  <MusicIcon />
                  <b>{nowPlaying.title}</b>
                  {nowPlaying.artist && <span>{nowPlaying.artist}</span>}
                </>
              )}
            </div>
          </section>

          <aside className="cluster-side cluster-side-right">
            {cards.fuel && (
              <section className="cluster-panel cluster-fuel" aria-label={words.fuel}>
                <div className="cluster-gauge-row">
                  <span className="cluster-glyph" data-warn={fuel?.state === 'alarm' ? '' : undefined} aria-hidden>
                    <FuelIcon />
                  </span>
                  <div className="cluster-meter" data-low={fuel?.state !== 'ok' ? '' : undefined}>
                    <span style={{ width: `${Math.round((fuelShare ?? 0) * 100)}%` }} />
                  </div>
                  <strong className="cluster-gauge-value">
                    {t ? fuelFigure.value : '—'}
                    <small>{fuelFigure.unit}</small>
                  </strong>
                </div>
                <div
                  className="cluster-gauge-foot"
                  aria-label={`${words.range} ${t ? rangeFigure.value : 0} ${rangeFigure.unit} · ${words.used} ${t ? usedFigure.value : 0} ${usedFigure.unit}`}
                >
                  <span className="cluster-foot-pair" aria-hidden>
                    <RangeIcon />
                    <b>{t ? rangeFigure.value : '—'}</b>
                    <small>{rangeFigure.unit}</small>
                  </span>
                  <span className="cluster-foot-pair" aria-hidden>
                    <DropIcon />
                    <b>{t ? usedFigure.value : '—'}</b>
                    <small>{usedFigure.unit}</small>
                  </span>
                </div>
              </section>
            )}

            <div className="cluster-pair-gauges">
              <section className="cluster-panel cluster-mini" aria-label={words.adblue}>
                <span className="cluster-glyph" data-warn={adblue?.state === 'alarm' ? '' : undefined} aria-hidden>
                  <AdblueIcon />
                </span>
                <strong>
                  {t ? adblueFigure.value : '—'}
                  <small>{adblueFigure.unit}</small>
                </strong>
                <div className="cluster-meter" data-low={adblue?.state !== 'ok' ? '' : undefined}>
                  <span style={{ width: `${Math.round((adblue?.percent ?? 0) * 100)}%` }} />
                </div>
              </section>

              <section
                className="cluster-panel cluster-mini cluster-coolant"
                aria-label={`${words.coolant} ${t ? coolantFigure.value : 0} ${coolantFigure.unit}`}
              >
                <span
                  className="cluster-glyph"
                  data-warn={coolant?.state !== 'ok' ? '' : undefined}
                  data-cold={coldCoolant ? '' : undefined}
                  aria-hidden
                >
                  <CoolantIcon />
                </span>
                <strong>
                  {t ? coolantFigure.value : '—'}
                  <small>{coolantFigure.unit}</small>
                </strong>
                <div
                  className="cluster-meter"
                  data-hot={coolant?.state !== 'ok' ? '' : undefined}
                  data-cold={coldCoolant ? '' : undefined}
                >
                  <span style={{ width: `${Math.round((coolant?.percent ?? 0) * 100)}%` }} />
                </div>
              </section>
            </div>

            {cards.engine && (
              <section className="cluster-panel cluster-brakes" aria-label={words.brakeTemperature}>
                <div className="cluster-brake-head">
                  <span className="cluster-glyph" data-warn={brakeHeat?.state === 'alarm' ? '' : undefined} aria-hidden>
                    <BrakeTemperatureIcon />
                  </span>
                  <div className="cluster-meter" data-hot={brakeHeat?.state !== 'ok' ? '' : undefined}>
                    <span style={{ width: `${Math.round((brakeHeat?.percent ?? 0) * 100)}%` }} />
                  </div>
                  <strong
                    className="cluster-gauge-value"
                    data-hot={brakeHeat?.state === 'warn' ? '' : undefined}
                    data-warn={brakeHeat?.state === 'alarm' ? '' : undefined}
                  >
                    {t ? heatFigure.value : '—'}
                    <small>{heatFigure.unit}</small>
                  </strong>
                </div>
              </section>
            )}

            <section
              className="cluster-panel cluster-instant"
              aria-label={`${words.instant} ${instantFigure ? instantFigure.value : 0} ${instantFigure?.unit ?? ''}`}
            >
              <span
                className="cluster-glyph"
                data-hot={instantReading && instantReading.state !== 'ok' ? '' : undefined}
                aria-hidden
              >
                <DropIcon />
              </span>
              <div
                className="cluster-meter"
                data-hot={instantReading && instantReading.state !== 'ok' ? '' : undefined}
              >
                <span style={{ width: `${Math.round((instantReading?.percent ?? 0) * 100)}%` }} />
              </div>
              <strong className="cluster-gauge-value">
                {instantFigure ? instantFigure.value : '—'}
                <small>{instantFigure?.unit ?? ''}</small>
              </strong>
            </section>

            <section className="cluster-panel cluster-wear" aria-label={`${words.damage} ${Math.round(damage * 100)}%`}>
              <span
                className="cluster-glyph"
                data-hot={damageTone === 'warn' ? '' : undefined}
                data-warn={damageTone === 'danger' ? '' : undefined}
                aria-hidden
              >
                <WarningIcon />
              </span>
              <div
                className="cluster-meter"
                data-hot={damageTone === 'warn' ? '' : undefined}
                data-warn={damageTone === 'danger' ? '' : undefined}
              >
                <span style={{ width: `${Math.round(damage * 100)}%` }} />
              </div>
              <strong
                className="cluster-gauge-value"
                data-hot={damageTone === 'warn' ? '' : undefined}
                data-warn={damageTone === 'danger' ? '' : undefined}
              >
                {Math.round(damage * 100)}
                <small>%</small>
              </strong>
            </section>
          </aside>
        </div>
      </div>

      {/* The truck's night: the panel dims as the cabin's screen does, so it doesn't glare in a dark cab. */}
      {nightDim > 0 && <div className="cluster-night" style={{ opacity: nightDim }} aria-hidden />}
    </main>
  )
}

/**
 * The paired phone, closing the notice line at its right end: the receiver, lit while the phone is there and dim
 * while it isn't, and while it is there, which phone it is and the charge it has — a phone's own battery, red under a
 * fifth of it and green with its bolt while charging, with the level beside it in figures. The name is the sidebar's
 * (the model the phone gives itself, or just "connected"), cut short at a few words: a dash names it, it doesn't read
 * its owner's mind. Sitting with the notices rather than in the status bar keeps that bar the truck's — cruise,
 * limit, clock — and what the phone is beside what it has to say. The way into the Phone app is the cabin's; a call
 * is the notice's own, where it can be answered and read.
 */
function ClusterPhone() {
  const text = useText()
  const words = text.phoneApp
  const phone = usePhone()
  // The phone's own name, as the cabin's sidebar says it: the model it is, or just "connected" when the phone
  // hasn't named itself. Not connected, there is no name to show — only that there is no phone.
  const name = phone.connected ? phone.device?.name || words.connected : words.noPhone
  // The charge, only while the phone is there and only when it has a level to give: an absent battery says "not
  // known", as an empty one would say "empty".
  const level = phone.connected ? phone.device?.battery : undefined
  const charging = phone.connected && phone.device?.charging === true
  const charge = level !== undefined ? words.battery(level) : null
  const label = [text.apps.phone, name, charge, charging ? words.charging : null].filter(Boolean).join(', ')
  return (
    <span className="cluster-phone" data-on={phone.connected ? '' : undefined} role="img" aria-label={label}>
      <PhoneIcon />
      {phone.connected && <span className="cluster-phone-name">{name}</span>}
      {level !== undefined && (
        <span
          className="cluster-phone-charge"
          data-low={level <= 20 && !charging ? '' : undefined}
          data-charging={charging ? '' : undefined}
        >
          <span className="cluster-phone-fill" style={{ '--battery': String(level) } as CSSProperties} />
        </span>
      )}
      {charge && <b className="cluster-phone-level">{charge}</b>}
    </span>
  )
}

/**
 * The truck's brand on the dial's face, under the speed: whose dash this is. The same mark the boot screen and the
 * sidebar show — its makers' trademarks, so the files live outside the repository (`public/brand-logos`) — drawn in
 * the panel's own greys, white on the dark glass and black on the light, and the brand's name as a small wordmark
 * where it has no logo. It is part of the face, not a reading, so the dial's label stays the speed alone.
 */
function ClusterBrand() {
  const truck = useLive((state) => state.truck)
  if (!truck) return null
  // Keyed by the brand, so a change of truck tries its own logo from the first file.
  return <TruckMark key={`${truck.brandId} ${truck.brand}`} brandId={truck.brandId} brand={truck.brand} />
}

function TruckMark({ brandId, brand }: { brandId: string; brand: string }) {
  // Line art first: the mark is drawn in the panel's ink, as the boot screen draws it (`logoSources`).
  const sources = logoSources(brandId, brand, { mono: true })
  const [attempt, setAttempt] = useState(0)
  const source = sources[attempt]
  return (
    <div className="cluster-brand">
      {source ? (
        <img key={source.src} src={source.src} alt="" onError={() => setAttempt((current) => current + 1)} />
      ) : (
        <span className="cluster-brand-wordmark">{brand}</span>
      )}
    </div>
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
 * A group of telltales: every light keeps its slot whether it is lit or not, so a blinker coming on never moves the
 * row. The cluster has two, the lights the driver switches and the truck's warnings, either side of the route.
 */
function TelltaleList({ items, label }: { items: Telltale[]; label: string }) {
  return (
    <ul className="cluster-telltales" aria-label={label}>
      {items.map((telltale) => (
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
 * The one notice the cluster has room for: the truck's own alarm first (a fault is the one thing on this line the
 * driver has to act on, and a message can wait), then a call, then the phone's newest notification, then the game's
 * warnings. The cabin's stack keeps all of them and their history; here it is a glance, so the rest are counted
 * rather than stacked over the dial.
 */
function useClusterNotice(): ClusterNotice | null {
  const text = useText()
  const call = usePhone((state) => state.call)
  const caller = useCaller(call?.id)
  const toasts = usePhoneToasts((state) => state.toasts)
  const alert = useClusterAlert(text)
  if (alert?.tone === 'alarm') return alert
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
  // This page draws its own units (it doesn't load the cabin's shell, which keeps shared/units.ts in step).
  const units = useUnits()
  if (!telemetry) return null
  const current = gameAlerts(telemetry, text, units).filter((alert) => alert.on)
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

/** The notice line above the dial: its mark, what it is, what it says, and how many more are waiting. */
function ClusterNoticeBar({ notice }: { notice: ClusterNotice }) {
  return (
    <div className="cluster-notice" data-kind={notice.kind} data-tone={notice.tone} aria-hidden>
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

/** How long the electrics must stay down for it to be an ignition-off rather than a dropped frame, ms. */
const ELECTRIC_OFF_HOLD_MS = 1200

/** Damage at which the dash lights its warning lamp, and its stop lamp (the game's 15% and 50%). */
const DAMAGE_WARN = 0.15
const DAMAGE_STOP = 0.5

/** Below this the engine is still warming up: the dash reads its coolant and oil blue, not just red when hot. */
const COLD_C = 60

/** The dial's geometry: a 270° sweep from 7:30 to 4:30, as a truck's speedometer counts. */
const DIAL_RADIUS = 130
const DIAL_CIRCUMFERENCE = 2 * Math.PI * DIAL_RADIUS
const DIAL_SWEEP = 0.75
const DIAL_START = 135
/* A tick is drawn from the top (12 o'clock), so it starts 270° behind the arc's first angle. */
const DIAL_TICK_START = DIAL_START - 270
const DIAL_SWEEP_DEGREES = 270
/* The face's numbers, set inside the ticks; which numbers they are is the driver's units' (km/h or mph). */
const SPEED_LABEL_RADIUS = 105

/* The tacho: its ring outside the speedo's, read against a 2,500 rpm scale. */
const RPM_MAX = 2500
const RPM_RADIUS = 137
const RPM_CIRCUMFERENCE = 2 * Math.PI * RPM_RADIUS
/* Its bands, as Scania prints them: the auxiliary brake is strongest from 2,000 to 2,400 rpm, the red field past. */
const RPM_BAND_RADIUS = 144
const RPM_BAND_CIRCUMFERENCE = 2 * Math.PI * RPM_BAND_RADIUS
const RPM_BANDS = [
  { band: 'aux', from: 2000 / RPM_MAX, to: 2400 / RPM_MAX },
  { band: 'red', from: 2400 / RPM_MAX, to: 1 },
] as const

/** Where a speed on the face is drawn, `radius` from the middle. */
function dialPoint(value: number, radius: number, face: SpeedFace): { x: number; y: number } {
  const degrees = DIAL_START + 90 + DIAL_SWEEP_DEGREES * (value / face.max)
  const radians = (degrees * Math.PI) / 180
  return { x: 150 + radius * Math.sin(radians), y: 150 - radius * Math.cos(radians) }
}

function clamp(value: number): number {
  return Math.max(0, Math.min(1, value))
}

/** A driver-hours clock as the cluster says it: "4:05 h", or "58 min", in the cab's language. */
function minutes(value: number, words: Strings['diagnostics']): string {
  const whole = Math.max(0, Math.round(value))
  if (whole < 60) return `${whole} ${words.minutes}`
  return `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, '0')} ${words.hours}`
}
