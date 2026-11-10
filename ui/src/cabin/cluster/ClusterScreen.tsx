import { AnimatePresence, motion } from 'motion/react'
import { type CSSProperties, type ReactElement, memo, useEffect, useMemo, useState } from 'react'
import { formatGameTime, formatGear } from '../../shared/format'
import { cabClock, type CabinPower, hasTruck, type NowPlayingInfo, subscribeHostMessages } from '../../shared/host'
import { appIcon, type AppIconRole } from '../../shared/icons'
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
import { bootLength, bootShown } from '../state/power'
import { useHandover } from '../state/useHandover'
import { motionEase, useMotionReduced } from '../motion'
import { resolveAppearance } from '../state/appearance'
import { useNightDim } from '../state/nightDim'
import { syncClock, useCabin, useLive } from '../state/store'
import { routeAccent } from '../maps/routeLook'
import { ManeuverGlyph } from '../maps/ManeuverGlyph'
import { guidanceOf } from '../maps/guidance'
import { useClock } from '../state/clock'
import { clusterTextScale } from '../state/textSize'
import { useUnits } from '../state/units'
import { useLanguage, useText } from '../state/text'
import type { Strings } from '../state/strings'
import type { Figure, SpeedFace } from '../../shared/units'
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
  PositionLightIcon,
  RangeIcon,
  RestIcon,
  RetarderIcon,
  TrailerIcon,
  TripIcon,
  WarningIcon,
  WipersIcon,
} from './ClusterIcons'
import { useInstantConsumption } from './useInstant'
import { useLingering } from './useLingering'
import { useSmoothed } from './useSmoothed'
import './cluster.css'

/**
 * WestPlay's instrument cluster, on the truck's own cluster display (the Scania S and R's; setup patches their
 * dashboard scripts with its texture, and the host streams this page into it). Laid out at
 * `westplay_shared::CLUSTER_WIDTH` x `CLUSTER_HEIGHT`.
 *
 * It reads like the dash it replaces. The speedo is the middle: the driver's face (120 km/h, or 80 mph) with its
 * numbers on it, a lit arc running round the groove to the speed with the needle's tick at its head, the speed and
 * the truck's own brand under it, and the tacho as a thinner ring outside the face with Scania's own bands — blue
 * where the auxiliary brake is strongest, red past 2,400 rpm. The truck's readings run down the right, the trip,
 * engine and driver's clocks down the left, the lights and warnings sit either side of the route at the top, and
 * the cab's newest message has a line of its own over the dial instead of taking the route's place. What plays sits
 * in the dial's open bottom (owner 2026-11-08: "more icons and visuals, less text").
 *
 * The panel comes up rather than switches on: the bezel and both grooves first, then the scale's marks, then the
 * face's numbers a frame apart, then the lit arcs, the cursor and the brand — all on the cabin's own curve, and all
 * cut by the reduced-motion setting with the rest of the cabin. As the boot clears, the panel runs its own bulb check:
 * every telltale it has lights for a moment, then drops back to the truck's real states, as a cluster proves its lamps
 * at power-up.
 *
 * Colour is the dash's own language: the ink for readings, the accent for what is live, and green, amber, blue and
 * red only for states — so a warning is the one thing on the glass that is coloured.
 */

/**
 * The app a track plays from, as the cabin's own icon set draws it (shared/icons.ts, the icons the screen's Home grid
 * shows): the dash says where the sound is coming from with a mark rather than a word, and with the same mark the
 * screen uses, so the two can't be about different things.
 */
const PLAYS_FROM: Record<string, AppIconRole> = {
  spotify: 'spotify',
  appleMusic: 'music',
  youtubeMusic: 'youtubeMusic',
  video: 'youtube',
  radio: 'radio',
}

/**
 * How far into what plays the dash reads it: the position the host last sent, run on by the dash's own clock while the
 * track plays (the host sends a track once, not a tick a second — see `useNowPlayingReport` in shell/Notifications).
 * `null` where there is nothing to measure: no track, or a player that reports no length (a stream, the game's own
 * radio), which is also exactly what a progress line needs to know.
 */
function usePlayed(info: NowPlayingInfo | null): { position: number; duration: number } | null {
  const playing = info?.playing ?? false
  // A second's tick while it plays: the bar creeps rather than jumping when a message happens to arrive.
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    if (!playing) return
    const id = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(id)
  }, [playing])
  if (!info || !info.duration || info.duration <= 0 || info.position === null || info.position === undefined)
    return null
  // `at` is when the player said where it was: played on from there, and held where it was while paused.
  const ran = playing && info.at ? Math.max(0, now - info.at) / 1000 : 0
  return { position: Math.min(info.duration, info.position + ran), duration: info.duration }
}

/** The machine's clock, which the cluster's power message counts on (`CabinPower.since` is `Date.now()`). */
const wallClock = () => Date.now()

/**
 * The dash's bulb check: every lamp lit for one window as the boot clears. The ignition's edge is caught during render,
 * as `useLingering` catches a value changing under a component, and the effect only ever ends the window — so a row
 * that gains its lamps later in the drive (the warnings, switched on in Settings) can't start a false check, and no
 * render has to read the clock. A page that comes up mid-drive (no boot to clear) runs it on load, as the dial's own
 * sweep does.
 */
function useBulbCheck(ignitionOn: boolean): boolean {
  const [lit, setLit] = useState(ignitionOn)
  const [wasOn, setWasOn] = useState(ignitionOn)
  if (ignitionOn !== wasOn) {
    setWasOn(ignitionOn)
    if (ignitionOn) setLit(true)
  }
  useEffect(() => {
    if (!lit) return
    const id = setTimeout(() => setLit(false), BULB_CHECK_MS)
    return () => clearTimeout(id)
  }, [lit])
  return ignitionOn && lit
}

/** The side columns' readings arrive one after the other, as the shell comes up. */
function sideVariants(reduced: boolean) {
  return {
    hidden: {},
    shown: { transition: reduced ? { staggerChildren: 0 } : { staggerChildren: 0.07 } },
  }
}

function riseVariants(reduced: boolean) {
  return reduced
    ? { hidden: { opacity: 1, y: 0 }, shown: { opacity: 1, y: 0, transition: { duration: 0 } } }
    : {
        hidden: { opacity: 0, y: 9 },
        shown: { opacity: 1, y: 0, transition: { duration: 0.56, ease: motionEase } },
      }
}

export function ClusterScreen() {
  const text = useText()
  const words = text.diagnostics
  // The driver's units (Settings › Appearance › Units, or the game's own): speeds, distances, fuel, temperatures.
  const units = useUnits()
  const telemetry = useLive((state) => state.telemetry)
  const truck = useLive((state) => state.truck)
  const job = useLive((state) => state.job)
  // The route the cab's map drew, and how far along it the truck is: the dash draws the same next turn from it.
  const route = useLive((state) => state.route)
  const routeNext = useLive((state) => state.routeNext)
  const nowPlaying = useLive((state) => state.nowPlaying)
  // How far into the track the line's progress reads (held above the early returns: it runs a clock while it plays).
  const played = usePlayed(nowPlaying)
  const clockShift = useLive((state) => state.clockShift)
  const shown = useCabin((state) => state.clusterShown)
  const cards = useCabin((state) => state.clusterCards)
  const reduceMotion = useMotionReduced()
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
        // The cabin's boot: its page says which part of the power sequence it is in, and the panel's boot follows it
        // (`ClusterBoot`).
        else if (message.type === 'power') useLive.setState({ power: { phase: message.phase, since: message.since } })
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
  // The page's language, as the cabin page sets it (CabinApp): the dash speaks the cabin's words everywhere it says
  // one (its notices, its readings' captions, what a reader hears), and the page's own language is what makes text set
  // in capitals follow that language's rules (Turkish: i to İ, not I) and a screen reader pronounce it.
  const language = useLanguage()
  useEffect(() => {
    document.documentElement.lang = language
  }, [language])
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

  // The boot, as the cabin's: the panel lights with the truck's brand and Cabin Play's mark as the electrics come on,
  // and clears to the cluster. It is the cabin's own boot, not a copy of it on a clock beside the cabin's — the cabin's
  // page owns the power sequence (state/power.ts) and tells the host, which passes the phase here, so the truck's
  // screen and the dash light together, keep time together and clear together; a page that comes up mid-boot joins it
  // where it is (`ClusterBoot`). An ignition cycle boots both again, and there is no second clock to drift out of step.
  const power = useLive((state) => state.power)
  const booting = power?.phase === 'splash' || power?.phase === 'connecting'
  // The dash comes up under the boot's light going down: its shell is re-mounted as the boot enters its last part
  // (HANDOVER_MS), so its entrance and the dial's power-up sweep are what the driver sees as the boot clears — one
  // motion between the two screens, not a fade to black and a dash that appears behind it. Motion fades the boot out
  // over that same window (BootScreen's exit), and `useHandover` is the one clock for both.
  const handover = useHandover(power, wallClock)
  const shellCycle = handover ? 1 : 0
  // The lamps' self-test as the dash shows itself: the boot's `on` phase is the moment it has handed over. The lit
  // state and its length are the stylesheet's (`.cluster-telltales[data-check]`), over the same window.
  const bulbCheck = useBulbCheck(power?.phase === 'on')
  // The route's speed limit, and its sign held for one fade after the route stops knowing one: a sign that leaves the
  // way it arrived, in the status bar and on the dial's scale (the dial holds its own mark by the same clock). Both of
  // these are hooks' business and stand above the early returns, so every render path calls them in the same order.
  const limit = telemetry ? units.limit(telemetry.navigationSpeedLimit) : 0
  const sign = useLingering(limit > 0 ? limit : null, LIMIT_LEAVE_MS)

  // Switched off in Settings: the game's own cluster shows through the transparent texture.
  if (!shown) return null
  // The game is gone: there is no truck to read, so the panel goes dark rather than hold a dead screen of zeros.
  if (running === false) return null

  const t = telemetry
  const speed = t ? units.speed(t.speed) : 0
  const gear = formatGear(t?.displayedGear ?? 0)
  const rpm = t ? Math.max(0, Math.min(1, t.engineRpm / RPM_MAX)) : 0
  // The truck's dash dimmer, 0 (all the way down) to 1 (full), as the panel's own lighting. A host that doesn't send
  // the reading, or a truck that never does, leaves the panel lit fully rather than dark.
  const backlight = t && Number.isFinite(t.dashboardBacklight) ? clamp(t.dashboardBacklight) : 1
  // The retarder's step while the driver holds one: 0 for off, up to the truck's own steps.
  const retarder = t?.retarderLevel ?? 0
  const cruise = t ? units.speed(t.cruiseControlSpeed) : 0
  // The face: its top speed, the step between its numbers and between its ticks (faster numbers are further apart
  // in mph, so fewer of them fit the same sweep).
  const face = units.face
  // How far round the face the driver is: the lit arc's length, and the angle the needle's head rides at.
  const speedShare = clamp(speed / face.max)
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
  // The trailer's own wear, on the same lines: its wheels, body and chassis, when one is on the back. `null` on a solo
  // run, where there is no trailer to have worn anything — and where the truck's own damage already reads.
  const trailerDamage =
    t && t.trailerAttached ? Math.max(t.trailerWearWheels, t.trailerWearBody, t.trailerWearChassis) : null
  const trailerTone: Telltale['tone'] | null =
    trailerDamage === null
      ? null
      : trailerDamage >= DAMAGE_STOP
        ? 'danger'
        : trailerDamage >= DAMAGE_WARN
          ? 'warn'
          : null
  const rest = t?.restStop ?? -1
  const breaking = t?.mandatoryBreak ?? -1
  const time = t ? formatGameTime(cabClock(t, clockShift)) : '--:--'
  const average = trip.distance > 0.05 ? tripAverage(trip) : (t?.fuelAverage ?? 0)
  // How long the trip has been moving, as the panel's pair of figures says it: minutes until the hour, then h:mm.
  const driving = driveTime(trip.moving, words)
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
  // The turn the route takes next, from the cab's own guidance (maps/guidance.ts) — the same step, and therefore the
  // same glyph, that the map's guidance card draws, so the dash and the screen can't point two ways. It needs the
  // route's turns: an empty list means the host hasn't read them yet, and the line keeps its route mark until it has.
  const step =
    route && route.maneuvers.length > 0
      ? (guidanceOf(route.distances, route.maneuvers, routeNext, t?.navigationDistance ?? 0)?.step ?? null)
      : null
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
  // The mark beside the track: the app it plays from, in the icon set the screen's own grid draws (the game's radio
  // and a stream from an app the cabin doesn't know have no mark of its own, so the note stands in).
  const playsFrom = nowPlaying?.app ? (PLAYS_FROM[nowPlaying.app] ?? null) : null
  // The dash's accent is the map's route colour (Settings › Maps › Route): the one colour the driver already chose
  // for "this is the way", on the needle, the cruise mark and the live readings. The route's own fill does on the
  // dark panel, its darker edge on the light one, so it reads on either.
  const accent = routeAccent(appearance, routeColour)
  const panelStyle = {
    '--cluster-scale': typeScale,
    '--accent': accent,
    '--cluster-backlight': backlight,
  } as CSSProperties

  // The truck's ignition is off: the electrics are down and the engine with them, so nothing the panel shows is live.
  // A real cluster goes quiet here rather than holding the last drive up as if it were still running — the panel keeps
  // its glass, the maker's mark and one line saying why it is dark. An engine stopped with the electrics on is not
  // this state: that is the dash a driver reads before starting, warning lamps and all, so it stays up.
  const ignitionOff = t ? !t.electricEnabled && !t.engineEnabled : false
  if (ignitionOff) {
    return (
      <main
        className="cluster cluster-off"
        data-appearance={appearance}
        aria-label={text.settings.clusterScreen}
        style={panelStyle}
      >
        <div className="cluster-standby">
          <ClusterBrand reduced={reduceMotion} />
          <span className="cluster-standby-rule" aria-hidden />
          <p className="cluster-standby-label">{words.engineOff}</p>
        </div>
      </main>
    )
  }

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
      icon: <PositionLightIcon />,
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
      active: retarder > 0,
    })
  }

  // The hitch lamp: lit while a trailer is coupled, out when the truck runs solo, as the dash's own does — and pushed
  // last, so hitching up adds its slot at the end of the row instead of moving the lights already in it.
  if (t?.trailerAttached) {
    lights.push({
      key: 'trailer',
      label: `${words.trailer} ${words.hitched}`,
      tone: 'info',
      icon: <TrailerIcon />,
      active: true,
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

  return (
    <main
      className="cluster"
      data-appearance={appearance}
      data-alarm={notice?.tone === 'alarm' ? '' : undefined}
      aria-label={text.settings.clusterScreen}
      style={panelStyle}
    >
      <AnimatePresence>
        {booting && power && (reduceMotion || !handover) && <ClusterBoot power={power} />}
      </AnimatePresence>

      <motion.div
        className="cluster-shell"
        key={shellCycle}
        initial={reduceMotion ? false : { opacity: 0, y: 4 }}
        animate={{ opacity: 1, y: 0 }}
        transition={reduceMotion ? { duration: 0 } : { duration: 0.48, ease: motionEase }}
      >
        <motion.header
          className="cluster-status"
          initial={reduceMotion ? false : { opacity: 0, y: -5 }}
          animate={{ opacity: 1, y: 0 }}
          transition={reduceMotion ? { duration: 0 } : { duration: 0.52, ease: motionEase }}
        >
          <TelltaleList items={lights} label={words.telltales} check={bulbCheck} />
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
          <motion.div
            className="cluster-route"
            aria-label={routeLabel || undefined}
            initial={reduceMotion ? false : { opacity: 0, y: -3 }}
            animate={{ opacity: 1, y: 0 }}
            transition={reduceMotion ? { duration: 0 } : { duration: 0.52, delay: 0.12, ease: motionEase }}
          >
            {routeLabel ? (
              <>
                {step ? <ManeuverGlyph step={step} size={20} /> : <RangeIcon />}
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
          </motion.div>
          <TelltaleList items={faults} label={words.warnings} check={bulbCheck && cards.warnings} />
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
            <span className="cluster-pill cluster-clock" aria-label={`${words.time} ${time}`}>
              <ClockIcon />
              <time>{time}</time>
            </span>
          </div>
        </motion.header>

        <div className="cluster-main">
          <motion.aside
            className="cluster-side"
            initial={reduceMotion ? false : 'hidden'}
            animate="shown"
            variants={sideVariants(reduceMotion)}
          >
            {cards.trip && (
              <motion.section
                className="cluster-panel cluster-trip"
                aria-label={`${words.trip} ${t ? tripFigure.value : 0} ${tripFigure.unit}`}
                variants={riseVariants(reduceMotion)}
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
                  {/* The trip's time on the move, not the range: the tank's range is already on the fuel panel's foot,
                      and a figure the dash shows twice is a slot it can't show something else in. The trip computer
                      counts these seconds for nothing else (`trip.moving`, diagnostics/trip.ts). */}
                  <span
                    className="cluster-pair"
                    aria-label={t ? `${words.time} ${driving.value} ${driving.unit}` : undefined}
                  >
                    <ClockIcon />
                    <b>{t ? driving.value : '—'}</b>
                    <small>{t ? driving.unit : ''}</small>
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
              </motion.section>
            )}

            {cards.engine && (
              <motion.section
                className="cluster-panel cluster-engine"
                aria-label={words.engine}
                variants={riseVariants(reduceMotion)}
              >
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
              </motion.section>
            )}

            {cards.hours && (
              <motion.section
                className="cluster-panel cluster-hours"
                aria-label={words.driverHours}
                variants={riseVariants(reduceMotion)}
              >
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
              </motion.section>
            )}
          </motion.aside>

          <section className="cluster-centre">
            {/* One line above the dial, always reserved, so the route above never moves and nothing the cab says
                covers the face. It carries one thing at a time: the cab's newest message while there is one, and
                what plays while there isn't — the two are never both news, and a dash with a line for each spent
                the room the dial needed to grow (owner 2026-11-09). The phone's own status closes the line at its
                right end: the status bar above is the truck's, what the phone is belongs with what it has to say. */}
            <div className="cluster-message">
              {notice ? (
                <ClusterNoticeBar notice={notice} />
              ) : nowPlaying ? (
                <motion.div
                  className="cluster-media"
                  data-paused={nowPlaying.playing ? undefined : ''}
                  aria-label={`${text.nowPlaying}: ${nowPlaying.title}${nowPlaying.artist ? ` · ${nowPlaying.artist}` : ''}`}
                  initial={reduceMotion ? false : { opacity: 0 }}
                  animate={{ opacity: nowPlaying.playing ? 1 : 0.55 }}
                  transition={reduceMotion ? { duration: 0 } : { duration: 0.42, delay: 0.12, ease: motionEase }}
                >
                  {playsFrom ? (
                    <img className="cluster-media-app" src={appIcon(playsFrom, appearance)} alt="" />
                  ) : (
                    <MusicIcon />
                  )}
                  <b>{nowPlaying.title}</b>
                  {nowPlaying.artist && <span>{nowPlaying.artist}</span>}
                  {/* How far into the track, under its words: the bar's own end is the length, so it needs no time
                      on it — one look says how much of the song is left. */}
                  {played && (
                    <i className="cluster-media-progress" aria-hidden>
                      <i style={{ width: `${Math.round((played.position / played.duration) * 100)}%` }} />
                    </i>
                  )}
                </motion.div>
              ) : null}
              <ClusterPhone />
            </div>

            {/* The face reads the limit with the speed it applies to: the sign hangs under the figure's own unit, so
                "80" under "87 km/h" is one reading rather than two a glance has to put together across the panel.
                The whole face is hidden from the reader (the section above says the speed and the limit as words), so
                the sign needs no name of its own here. */}
            <section
              className="cluster-dial"
              aria-label={
                sign.value !== null
                  ? `${speed} ${units.labels.speed}, ${text.speedLimit(sign.value)}`
                  : `${speed} ${units.labels.speed}`
              }
            >
              <motion.div
                className="cluster-dial-wrap"
                initial={reduceMotion ? false : { opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={reduceMotion ? { duration: 0 } : { duration: 0.68, delay: 0.08, ease: motionEase }}
              >
                <ClusterDial
                  speedShare={speedShare}
                  rpm={rpm}
                  limit={limit}
                  max={face.max}
                  step={face.step}
                  minor={face.minor}
                  cold={coldCoolant || coldOil}
                  reduced={reduceMotion}
                />

                {/* The face reads top to bottom: whose dash this is, the figure, its unit, and the gear in the arc's
                    open bottom. The brand is an emblem on the face rather than a line in that stack: the speed stays
                    the thing the centre is for, and the mark reads at a badge's size without crowding it. */}
                <ClusterBrand reduced={reduceMotion} />
                <div className="cluster-speed" aria-hidden>
                  <strong key={Math.round(speed)} className="cluster-speed-value">
                    {speed}
                  </strong>
                  <span>{units.labels.speed}</span>
                  {sign.value !== null && (
                    <motion.span
                      className="cluster-limitsign"
                      data-over={speed > sign.value ? '' : undefined}
                      data-leaving={sign.leaving ? '' : undefined}
                      initial={reduceMotion ? false : { opacity: 0, scale: 0.8 }}
                      animate={{ opacity: sign.leaving ? 0 : 1, scale: 1 }}
                      transition={
                        reduceMotion
                          ? { duration: 0 }
                          : sign.leaving
                            ? { duration: 0.42, ease: motionEase }
                            : { duration: 0.46, delay: 0.24, ease: motionEase }
                      }
                    >
                      <b>{sign.value}</b>
                    </motion.span>
                  )}
                </div>
                {/* The needle never sweeps the bottom of the face (the arc's gap is there), so the gear keeps the
                    open bottom under the figure. Keyed by the gear, so each change settles into place the way a
                    gear going in does, instead of the letter being swapped out behind the driver's back. */}
                <motion.div
                  className="cluster-gear"
                  aria-label={`${words.gear} ${gear}`}
                  initial={reduceMotion ? false : { opacity: 0, x: '-50%', y: 4 }}
                  animate={{ opacity: 1, x: '-50%', y: 0 }}
                  transition={reduceMotion ? { duration: 0 } : { duration: 0.46, delay: 0.36, ease: motionEase }}
                >
                  <span key={gear}>{gear}</span>
                </motion.div>
                {/* The retarder's step beside the gear while one is held: the telltale in the status bar says the brake
                    is working, this says how much of it — in the face's open bottom, where the arc's gap has room for
                    it next to the gear and nothing else lives. */}
                {retarder > 0 && (
                  <motion.div
                    className="cluster-retarder"
                    aria-label={`${words.retarder} ${retarder}`}
                    initial={reduceMotion ? false : { opacity: 0, x: -4 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={reduceMotion ? { duration: 0 } : { duration: 0.28, ease: motionEase }}
                  >
                    <RetarderIcon />
                    <b>{retarder}</b>
                  </motion.div>
                )}
              </motion.div>
            </section>
          </section>

          <motion.aside
            className="cluster-side cluster-side-right"
            initial={reduceMotion ? false : 'hidden'}
            animate="shown"
            variants={sideVariants(reduceMotion)}
          >
            {cards.fuel && (
              <motion.section
                className="cluster-panel cluster-fuel"
                aria-label={words.fuel}
                variants={riseVariants(reduceMotion)}
              >
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
              </motion.section>
            )}

            <motion.div className="cluster-pair-gauges" variants={riseVariants(reduceMotion)}>
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
            </motion.div>

            {cards.engine && (
              <motion.section
                className="cluster-panel cluster-brakes"
                aria-label={words.brakeTemperature}
                variants={riseVariants(reduceMotion)}
              >
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
              </motion.section>
            )}

            <motion.section
              className="cluster-panel cluster-instant"
              aria-label={`${words.instant} ${instantFigure ? instantFigure.value : 0} ${instantFigure?.unit ?? ''}`}
              variants={riseVariants(reduceMotion)}
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
            </motion.section>

            {/* The truck's wear, and the trailer's under it while one is on the back: the worst of each one's parts,
                marked by its own glyph rather than by a word. The trailer's row is the hitch state read as well as a
                reading — a solo truck has no trailer to have worn anything, so the row simply isn't there. */}
            <motion.section
              className="cluster-panel cluster-wear"
              aria-label={words.wear}
              variants={riseVariants(reduceMotion)}
            >
              <div className="cluster-wear-row" aria-label={`${words.damage} ${Math.round(damage * 100)}%`}>
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
              </div>
              {trailerDamage !== null && (
                <div
                  className="cluster-wear-row"
                  aria-label={`${words.wearTrailer} ${Math.round(trailerDamage * 100)}%`}
                >
                  <span
                    className="cluster-glyph"
                    data-hot={trailerTone === 'warn' ? '' : undefined}
                    data-warn={trailerTone === 'danger' ? '' : undefined}
                    aria-hidden
                  >
                    <TrailerIcon />
                  </span>
                  <div
                    className="cluster-meter"
                    data-hot={trailerTone === 'warn' ? '' : undefined}
                    data-warn={trailerTone === 'danger' ? '' : undefined}
                  >
                    <span style={{ width: `${Math.round(trailerDamage * 100)}%` }} />
                  </div>
                  <strong
                    className="cluster-gauge-value"
                    data-hot={trailerTone === 'warn' ? '' : undefined}
                    data-warn={trailerTone === 'danger' ? '' : undefined}
                  >
                    {Math.round(trailerDamage * 100)}
                    <small>%</small>
                  </strong>
                </div>
              )}
            </motion.section>
          </motion.aside>
        </div>
      </motion.div>

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
/** What the dial draws, as plain numbers: a face (its top speed and two steps) and the two readings on it. */
interface ClusterDialProps {
  /** How far round the face the truck is, 0 (at rest) to 1 (the face's top speed). */
  speedShare: number
  /** The engine's share of its own scale, 0 to 1. */
  rpm: number
  /** The limit the route knows, in the face's own units (0 when there is none): marked on the scale. */
  limit: number
  /** The face: its top speed (in the driver's units), the step between its numbers and between its ticks. */
  max: number
  step: number
  minor: number
  /** Whether the engine is still cold: its scale's numbers read blue until the coolant and the oil are up to
   * temperature, the way the dash's own readings do. */
  cold: boolean
  /** The app's Reduce Motion setting: the face arrives at rest rather than assembling itself. */
  reduced: boolean
}

/**
 * The dial's face: the bezel's edge, the groove and the lit arc, the scale with its numbers, the tacho with Scania's
 * bands, and the cursor. It is a component of its own because it keeps a clock of its own: `useSmoothed` carries the
 * two readings towards the truck's a frame at a time, and only this SVG is redrawn while they travel — the panels,
 * the route and the notices carry on at the rate the telemetry actually arrives. Memoised on plain numbers, so a
 * reading that leaves the dial alone costs it nothing.
 *
 * It opens the way a dash does when the electrics come on: the face lit to the far end of its scale, held while the
 * marks come up, then falling back to the reading as the boot clears (SWEEP_HOLD_MS, SWEEP_MS). The panel is
 * re-mounted as the boot's light goes down, which is what puts that sweep where the driver can see it rather than
 * behind the splash.
 */
const ClusterDial = memo(function ClusterDial({ speedShare, rpm, limit, max, step, minor, cold, reduced }: ClusterDialProps) {
  // The two readings as the face shows them: eased a frame at a time, the speed opening with the power-up sweep.
  const shownSpeed = useSmoothed(speedShare, { from: 1, hold: SWEEP_HOLD_MS, sweep: SWEEP_MS })
  const shownRpm = useSmoothed(rpm)
  // The cursor's angle: 270° from the first tick to the last, on the driver's face.
  const angle = DIAL_START + 90 + DIAL_SWEEP_DEGREES * shownSpeed
  // The numbered mark the cursor has reached: the scale's own read head, lit in the ink so a glance at the face
  // lands on the block the truck is in as well as the figure at its centre.
  const live = Math.min(max, Math.max(0, Math.round((shownSpeed * max) / step) * step))
  // The limit's mark: the sign's own clock (LIMIT_LEAVE_MS), so the mark and the sign leave the panel together. A
  // limit past the face's top speed has no place on this face and so isn't marked at all.
  const mark = useLingering(limit > 0 && limit <= max ? limit : null, LIMIT_LEAVE_MS)

  // The scale is fixed for the face it was drawn for: its marks and numbers keep their elements between frames, so a
  // moving reading only ever re-renders the arc, the tacho and the cursor.
  const scale = useMemo(() => {
    const face: SpeedFace = { max, step, minor }
    const ticks = Array.from({ length: Math.round(max / minor) + 1 }, (_, at) => at * minor)
    const numbers = Array.from({ length: Math.round(max / step) + 1 }, (_, at) => at * step)
    return (
      <>
        {/* The scale: every tick hangs inward from the groove, so the marks share one inner edge and grow outwards
            to the ring. The numbered ones run a third of the way in and carry the ink; the rest are a stub at the
            groove, so the scale reads in blocks from the far side of the cab rather than as an even comb. */}
        <motion.g
          initial={reduced ? false : { opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={reduced ? { duration: 0 } : { duration: 0.46, delay: 0.16, ease: motionEase }}
        >
          {ticks.map((tick) => (
            <line
              key={tick}
              className={tick % step === 0 ? 'cluster-tick major' : 'cluster-tick'}
              x1="150"
              y1={tick % step === 0 ? 20.5 : 28}
              x2="150"
              y2="33"
              transform={`rotate(${DIAL_TICK_START + (tick / max) * DIAL_SWEEP_DEGREES} 150 150)`}
            />
          ))}
        </motion.g>
        {/* The numbers come up in the order they run round the face, a frame apart: the face assembles itself rather
            than appearing whole. Each keeps its element (keyed by its value), so the stagger plays once. The one the
            cursor has reached is left lit in the ink — the scale's read head, so the face answers a glance without
            the driver counting round it. */}
        {numbers.map((value, index) => {
          const at = dialPoint(value, SPEED_LABEL_RADIUS, face)
          return (
            <motion.text
              key={value}
              className={cold ? 'cluster-dial-label cluster-cold' : 'cluster-dial-label'}
              data-live={value === live ? '' : undefined}
              x={at.x}
              y={at.y}
              textAnchor="middle"
              dominantBaseline="central"
              initial={reduced ? false : { opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={reduced ? { duration: 0 } : { duration: 0.42, delay: 0.2 + index * 0.018, ease: motionEase }}
            >
              {value}
            </motion.text>
          )
        })}
      </>
    )
  }, [max, step, minor, cold, reduced, live])

  // The face's parts each fade in at their own moment, on the groove's own clock: a remount at the hand-over plays
  // them once per boot. Reduced motion brings the whole face up at rest.
  const marks = (delay: number, duration: number) =>
    reduced
      ? { initial: false, animate: { opacity: 1 }, transition: { duration: 0 } }
      : { initial: { opacity: 0 }, animate: { opacity: 1 }, transition: { duration, delay, ease: motionEase } }

  return (
    <svg className="cluster-dial-ring" viewBox="0 0 300 300" aria-hidden>
      {/* The face's glass: a faint pooling of light at the centre, warming towards the accent, so the figure and the
          scale sit on a lit dial rather than floating on the panel. It stops inside the groove, under the scale's
          marks, so the arc and the tacho keep to the panel's own dark. */}
      <defs>
        <radialGradient id="cluster-dial-face" cx="50%" cy="46%" r="62%">
          <stop offset="0" stopColor="var(--ink)" stopOpacity="0.06" />
          <stop offset="0.66" stopColor="var(--accent)" stopOpacity="0.05" />
          <stop offset="1" stopColor="var(--accent)" stopOpacity="0" />
        </radialGradient>
      </defs>
      <circle cx="150" cy="150" r={DIAL_FACE_RADIUS} fill="url(#cluster-dial-face)" />
      {/* The bezel's edge: one hairline just outside the groove, where the face turns up towards the tacho, so the
          scale reads as machined into a bezel rather than printed on a flat ring. It takes the place's own
          hairlines (--line), which is what makes it sit under the marks rather than beside them. */}
      <motion.circle
        className="cluster-dial-lip"
        cx="150"
        cy="150"
        r={DIAL_LIP_RADIUS}
        strokeDasharray={`${DIAL_LIP_CIRCUMFERENCE * DIAL_SWEEP} ${DIAL_LIP_CIRCUMFERENCE}`}
        transform={`rotate(${DIAL_START} 150 150)`}
        {...marks(0.06, 0.52)}
      />
      <motion.circle
        className="cluster-dial-track"
        cx="150"
        cy="150"
        r={DIAL_RADIUS}
        strokeDasharray={`${DIAL_CIRCUMFERENCE * DIAL_SWEEP} ${DIAL_CIRCUMFERENCE}`}
        transform={`rotate(${DIAL_START} 150 150)`}
        {...marks(0.06, 0.52)}
      />
      {/* The speed, as a lit arc in the track's groove: how far round the face the driver is, drawn in the dash's
          accent so the one colour on the glass is also the speed. Its length is the smoothed reading, so it is a
          frame's worth of movement rather than a step. */}
      <motion.circle
        className="cluster-dial-fill"
        cx="150"
        cy="150"
        r={DIAL_RADIUS}
        strokeDasharray={`${DIAL_CIRCUMFERENCE * DIAL_SWEEP * shownSpeed} ${DIAL_CIRCUMFERENCE}`}
        transform={`rotate(${DIAL_START} 150 150)`}
        {...marks(0.18, 0.64)}
      />
      {/* The limit where it falls on the scale, drawn over the lit arc so passing it reads as passing it: the sign
          in the status bar says what the limit is, and this says where it is. It is held for one fade after the route
          stops knowing a limit, so it leaves with the sign rather than blinking away, and its angle is a transform the
          stylesheet can transition, so a limit that changes slides round the face instead of jumping. */}
      {mark.value !== null && (
        <motion.g
          className="cluster-limit"
          data-leaving={mark.leaving ? '' : undefined}
          style={{
            transform: `rotate(${DIAL_START + 90 + DIAL_SWEEP_DEGREES * (mark.value / max)}deg)`,
            transformOrigin: '150px 150px',
          }}
          initial={reduced ? false : { opacity: 0 }}
          animate={{ opacity: mark.leaving ? 0 : 1 }}
          transition={reduced ? { duration: 0 } : { duration: 0.42, ease: motionEase }}
        >
          <line className="cluster-limit-mark" x1="150" y1={150 - 126} x2="150" y2={150 - 135} />
        </motion.g>
      )}
      {scale}
      <motion.circle
        className="cluster-dial-rpm-track"
        cx="150"
        cy="150"
        r={RPM_RADIUS}
        strokeDasharray={`${RPM_CIRCUMFERENCE * DIAL_SWEEP} ${RPM_CIRCUMFERENCE}`}
        transform={`rotate(${DIAL_START} 150 150)`}
        {...marks(0.1, 0.52)}
      />
      <motion.circle
        className="cluster-dial-rpm"
        cx="150"
        cy="150"
        r={RPM_RADIUS}
        strokeDasharray={`${RPM_CIRCUMFERENCE * DIAL_SWEEP * shownRpm} ${RPM_CIRCUMFERENCE}`}
        transform={`rotate(${DIAL_START} 150 150)`}
        {...marks(0.22, 0.52)}
      />
      {RPM_BANDS.map((band) => (
        <motion.circle
          key={band.band}
          className="cluster-rpm-band"
          data-band={band.band}
          cx="150"
          cy="150"
          r={RPM_BAND_RADIUS}
          strokeDasharray={`${RPM_BAND_CIRCUMFERENCE * DIAL_SWEEP * (band.to - band.from - RPM_BAND_GAP)} ${RPM_BAND_CIRCUMFERENCE}`}
          strokeDashoffset={-RPM_BAND_CIRCUMFERENCE * DIAL_SWEEP * (band.from + RPM_BAND_GAP / 2)}
          transform={`rotate(${DIAL_START} 150 150)`}
          {...marks(0.12, 0.52)}
        />
      ))}
      {/* The needle rides the ring rather than crossing the face: a tick across the groove, as a dial's cursor is. A
          line from the hub would run through the figure and the scale's numbers, which is the one thing the dial
          can't afford — the speed and its unit sit at its centre. */}
      <g className="cluster-needle" style={{ transform: `rotate(${angle}deg)`, transformOrigin: '150px 150px' }}>
        <motion.line
          className="cluster-needle-mark"
          x1="150"
          y1={150 - 124.5}
          x2="150"
          y2={150 - 136}
          {...marks(0.08, 0.26)}
        />
      </g>
    </svg>
  )
})

function ClusterBrand({ reduced }: { reduced: boolean }) {
  const truck = useLive((state) => state.truck)
  if (!truck) return null
  // Keyed by the brand, so a change of truck tries its own logo from the first file.
  return (
    <TruckMark key={`${truck.brandId} ${truck.brand}`} brandId={truck.brandId} brand={truck.brand} reduced={reduced} />
  )
}

function TruckMark({ brandId, brand, reduced }: { brandId: string; brand: string; reduced: boolean }) {
  // Line art first: the mark is drawn in the panel's ink, as the boot screen draws it (`logoSources`).
  const sources = logoSources(brandId, brand, { mono: true })
  const [attempt, setAttempt] = useState(0)
  const source = sources[attempt]
  return (
    <motion.div
      className="cluster-brand"
      aria-hidden
      initial={reduced ? false : { opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={reduced ? { duration: 0 } : { duration: 0.56, delay: 0.3, ease: motionEase }}
    >
      {source ? (
        <img key={source.src} src={source.src} alt="" onError={() => setAttempt((current) => current + 1)} />
      ) : (
        <span className="cluster-brand-wordmark">{brand}</span>
      )}
    </motion.div>
  )
}

/**
 * The cabin's boot screen, played over the cluster: the panel lights, Cabin Play's mark and the truck's brand
 * arrive, and it goes down as the dial comes up. It is the cabin's boot, told rather than timed — the phase comes from
 * the cabin's page (state/power.ts, through the host), so both screens are at the same moment of it.
 *
 * A page that comes up while the cabin is already booting starts where that boot has got to: `elapsed` is how far in
 * it is, which puts the animation at the cabin's point in it rather than beginning it again.
 */
function ClusterBoot({ power }: { power: CabinPower }) {
  // Where this page came into the boot, taken once: a boot it sees begin starts at its first frame, and one it loads
  // into starts where the cabin already is. The phase may move from `splash` to `connecting` while this stays mounted;
  // the composition is one, so it is not restarted.
  const [boot] = useState(() => bootShown(power, Date.now()))
  if (!boot) return null
  // A page that came up after the boot's own end has nothing left to show: the dash is already up behind it.
  if (boot.elapsed >= bootLength(boot.phase)) return null
  return <BootScreen phase={boot.phase} elapsed={boot.elapsed} />
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
/**
 * A group of telltales: every light keeps its slot whether it is lit or not, so a blinker coming on never moves the
 * row. The cluster has two, the lights the driver switches and the truck's warnings, either side of the route.
 *
 * `check` runs the dash's bulb check over the row: the stylesheet lights every slot for a moment and then hands it back
 * to the truck's own states, so the row is never claimed to be showing anything it isn't — the reader still hears only
 * the lamps that are really on.
 */
function TelltaleList({ items, label, check }: { items: Telltale[]; label: string; check?: boolean }) {
  return (
    <ul className="cluster-telltales" data-check={check ? '' : undefined} aria-label={label}>
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
/* The bezel's edge, a hairline outside the groove and inside the tacho, on the same 270° sweep. */
const DIAL_FACE_RADIUS = 122
const DIAL_LIP_RADIUS = 133.5
const DIAL_LIP_CIRCUMFERENCE = 2 * Math.PI * DIAL_LIP_RADIUS
/* The self-test a dash runs at power-up, as the electrics come on: the face lit to its far end, held there while the
   bezel, the scale and its numbers come up (`hold`), then falling back to the reading over `sweep`. Long enough to be
   seen and short enough not to hold the reading back. */
const SWEEP_HOLD_MS = 340
const SWEEP_MS = 820
/* How long the speed limit's sign and its mark on the scale take to leave the panel once the route stops knowing a
   limit: long enough to read as a fade, short enough that the mark isn't still there on the next road. */
const LIMIT_LEAVE_MS = 420
/* The dash's bulb check, as the boot clears: long enough for every lamp to be seen in its colour, short enough that a
   real warning isn't held off the glass behind it. `cluster.css` runs the lit state over the same window. */
const BULB_CHECK_MS = 1500


/* The tacho: its ring outside the speedo's, read against a 2,500 rpm scale. */
const RPM_MAX = 2500
const RPM_RADIUS = 137
const RPM_CIRCUMFERENCE = 2 * Math.PI * RPM_RADIUS
/* Its bands, as Scania prints them: the auxiliary brake is strongest from 2,000 to 2,400 rpm, the red field past. */
const RPM_BAND_RADIUS = 144
const RPM_BAND_CIRCUMFERENCE = 2 * Math.PI * RPM_BAND_RADIUS
/* The hairline that splits the two fields: without it the blue and the red meet and read as one band in two
   colours, where the dash shows two marks. Sized in the sweep, so it stays a hairline as the face is drawn. */
const RPM_BAND_GAP = 0.01
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
/** The trip's time on the move, split for the dash's two sizes: "45" and "min" for the first hour, "3:24" and "h"
 *  past it — the same two readings the driver-hours rows give, in the trip panel's own layout. */
function driveTime(seconds: number, words: Strings['diagnostics']): Figure {
  const whole = Math.max(0, Math.round(seconds / 60))
  if (whole < 60) return { value: String(whole), unit: words.minutes }
  return { value: `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, '0')}`, unit: words.hours }
}

function minutes(value: number, words: Strings['diagnostics']): string {
  const whole = Math.max(0, Math.round(value))
  if (whole < 60) return `${whole} ${words.minutes}`
  return `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, '0')} ${words.hours}`
}
