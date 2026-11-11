import { AnimatePresence, motion } from 'motion/react'
import { type CSSProperties, type ReactElement, memo, useEffect, useRef, useState } from 'react'
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
import {
  receivePhoneNotifications,
  receivePhoneState,
  sendPhoneCommand,
  takeDownNotification,
  useCaller,
  usePhone,
  usePhoneToasts,
} from '../apps/phone/phone'
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
import { guidanceOf, NOW_WITHIN, type Step } from '../maps/guidance'
import { useClock } from '../state/clock'
import { clusterTextScale } from '../state/textSize'
import { useUnits } from '../state/units'
import { useLanguage, useText } from '../state/text'
import { playCue } from '../state/sound'
import { NoteCard } from '../../shared/phoneNoteCard'
import type { Strings } from '../state/strings'
import type { Figure } from '../../shared/units'
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
import { useShownAppearance } from './useShownAppearance'
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
 * The panel comes up rather than switches on, and only once the boot is over: the bezel and both grooves first, then
 * the scale's marks, then the face's numbers a frame apart, then the lit arcs, the cursor and the brand — all on the
 * cabin's own curve, and all cut by the reduced-motion setting with the rest of the cabin. As it clears, the panel
 * runs its own bulb check: every telltale it has lights for a moment, then drops back to the truck's real states, as a
 * cluster proves its lamps at power-up.
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

/** The side columns' readings arrive one after the other, as the shell comes up: a column is read at a glance, so
 * its panels follow each other closely rather than one at a time. */
function sideVariants(reduced: boolean) {
  return {
    hidden: {},
    shown: { transition: reduced ? { staggerChildren: 0 } : { staggerChildren: 0.045 } },
  }
}

function riseVariants(reduced: boolean) {
  return reduced
    ? { hidden: { opacity: 1, y: 0 }, shown: { opacity: 1, y: 0, transition: { duration: 0 } } }
    : {
        hidden: { opacity: 0, y: 7 },
        shown: { opacity: 1, y: 0, transition: { duration: 0.36, ease: motionEase } },
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
  // The level gauges as the settings ask (Settings › Instrument Cluster): the share of the tank, or its litres.
  const gaugePercent = useCabin((state) => state.clusterGaugePercent)
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
  // The chime as a notice is recorded on the dash: soft for a warning, firmer for an alarm.
  useNoticeCue(notice)
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
        // The game's language, which the host sends to this page as well as the cabin's (and sends again when the
        // page loads): the panel's words are the cabin's, and so is the clock's own AM and PM.
        else if (message.type === 'language') {
          useLive.setState({ gameLanguage: message.language })
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
  // The page's language, from the game's, which the host tells this page (it is the cabin's language too, the cabin
  // page reads it off the same profile): the dash speaks the cabin's words everywhere it says one (its notices, its
  // readings' captions, what a reader hears), and the page's own language is what makes text set in capitals follow
  // that language's rules (Turkish: i to İ, not I) and a screen reader pronounce it.
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
  // The dash waits for the boot: it is put on the glass only once the boot is over (the boot's `on` phase, or a page
  // that never saw one), so every motion it has — the shell's entrance, the sides' readings arriving one after the
  // other, the dial's power-up sweep and the lamps' self-test and blinking — starts in front of the driver on the
  // screen the boot has just cleared, instead of playing under the boot's light where nobody can see it. Until then
  // it is mounted but not painted (below), and it is re-mounted at that moment so its motions begin there.
  const booted = power === null || power.phase === 'on'
  // The boot's light still goes down over its own last part (HANDOVER_MS), as it does on the cabin's screen: Motion
  // fades it out over that window (BootScreen's exit), and `useHandover` is the one clock for both.
  const handover = useHandover(power, wallClock)
  // The lamps' self-test as the dash shows itself: the boot's `on` phase is the moment it has handed over. The lit
  // state and its length are the stylesheet's (`.cluster-telltales[data-check]`), over the same window.
  const bulbCheck = useBulbCheck(power?.phase === 'on')
  // The route's speed limit, and its sign held for one fade after the route stops knowing one: a sign that leaves the
  // way it arrived, in the status bar and on the dial's scale (the dial holds its own mark by the same clock). Both of
  // these are hooks' business and stand above the early returns, so every render path calls them in the same order.
  const limit = telemetry ? units.limit(telemetry.navigationSpeedLimit) : 0
  const sign = useLingering(limit > 0 ? limit : null, LIMIT_LEAVE_MS)
  // The look the cabin asks for, and the look the panel draws in: the two differ only while the panel is coming to a
  // new one, over the cabin's own change of appearance (useShownAppearance). Called here with the hooks above.
  const wanted = resolveAppearance(mode, {
    gameTime: telemetry ? cabClock(telemetry, clockShift) : null,
    lowBeam: telemetry?.lowBeam ?? false,
  })
  const { appearance, appearing } = useShownAppearance(wanted, reduceMotion)

  // Switched off in Settings: the game's own cluster shows through the transparent texture.
  if (!shown) return null
  // The game is gone: there is no truck to read, so the panel goes dark rather than hold a dead screen of zeros.
  if (running === false) return null

  const t = telemetry
  const speed = t ? units.speed(t.speed) : 0
  // Over the road's limit, which is the figure's own state and nothing else's: the sign under it states the limit the
  // road has and stays the sign it is, so the only thing that changes on the face is the number being read. A route
  // that has stopped knowing a limit keeps its sign for one fade, and the figure with it.
  const over = sign.value !== null && speed > sign.value
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
  // The figures the two level gauges print. A level is a share of what its tank holds, which is what the bar beside
  // it draws, so the settings can read it as that share — the one reading a driver can put against the bar without
  // working out the tank's capacity. Only the two quantities have a share to give: a temperature or a rate is a
  // point on a scale, not a part of it, and keeps its own figure either way. A truck whose tank the game doesn't
  // measure keeps its litres rather than claiming an empty tank.
  const fuelValue: Figure =
    gaugePercent && fuelShare !== null ? { value: String(Math.round(fuelShare * 100)), unit: '%' } : fuelFigure
  const adblueValue: Figure =
    gaugePercent && adblue !== null ? { value: String(Math.round(adblue.percent * 100)), unit: '%' } : adblueFigure
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
  const guidance =
    route && route.maneuvers.length > 0
      ? guidanceOf(route.distances, route.maneuvers, routeNext, t?.navigationDistance ?? 0)
      : null
  const step = guidance?.step ?? null
  // How far to that turn, so the arrow has a scale and not only a shape: the arrow alone says which way, never
  // whether the road there is 20 m or two kilometres off. It is "Now" inside the junction (the same 30 m the map's
  // own card counts it at, guidance.ts) and the driver's units until then. Arriving is the one step whose distance
  // the line already has — it is the distance left to the destination — so the arrival mark carries the flag and the
  // trip's own figures rather than the same number twice.
  const turnDistance =
    guidance === null || guidance.step.kind === 'arrive'
      ? null
      : guidance.distance < NOW_WITHIN
        ? text.now
        : units.distance(guidance.distance, text.decimal)
  // What a reader hears of the line, in the order a driver reads it: the step and how far, the destination, the
  // distance left, and when the route gets there. The arrow itself is a drawing with no name, so the words of the
  // step are said here rather than left to the glyph.
  const routeLabel = [
    step ? [stepWords(step, text), turnDistance].filter(Boolean).join(' · ') : '',
    destination,
    routeDistance !== null ? units.distance(routeDistance, text.decimal) : '',
    routeArrival !== null ? `${text.arrival} ${formatGameTime(routeArrival)}` : '',
  ]
    .filter(Boolean)
    .join(' · ')
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
        data-appearing={appearing ? '' : undefined}
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
      data-appearing={appearing ? '' : undefined}
      data-alarm={notice?.tone === 'alarm' ? '' : undefined}
      aria-label={text.settings.clusterScreen}
      style={panelStyle}
    >
      <AnimatePresence>
        {booting && power && (reduceMotion || !handover) && <ClusterBoot power={power} />}
      </AnimatePresence>

      <motion.div
        className="cluster-shell"
        key={booted ? 1 : 0}
        // Drawn but kept off the glass while the boot is up, so the entrance below is first seen once it is over.
        style={booted ? undefined : { visibility: 'hidden' }}
        initial={reduceMotion ? false : { opacity: 0, y: 3 }}
        animate={{ opacity: 1, y: 0 }}
        transition={reduceMotion ? { duration: 0 } : { duration: 0.26, ease: motionEase }}
      >
        <motion.header
          className="cluster-status"
          initial={reduceMotion ? false : { opacity: 0, y: -4 }}
          animate={{ opacity: 1, y: 0 }}
          transition={reduceMotion ? { duration: 0 } : { duration: 0.3, ease: motionEase }}
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
              driver the next turn, the distance or the ETA. It only has to fit between the lights. */}
          <motion.div
            className="cluster-route"
            aria-label={routeLabel || undefined}
            initial={reduceMotion ? false : { opacity: 0, y: -3 }}
            animate={{ opacity: 1, y: 0 }}
            transition={reduceMotion ? { duration: 0 } : { duration: 0.3, delay: 0.06, ease: motionEase }}
          >
            {routeLabel ? (
              <>
                {step ? <ManeuverGlyph step={step} size={22} /> : <RangeIcon />}
                {turnDistance !== null && <b className="cluster-route-turn">{turnDistance}</b>}
                {destination && <b className="cluster-route-dest">{destination}</b>}
                {routeDistance !== null && (
                  <span className="cluster-route-left">{units.distance(routeDistance, text.decimal)}</span>
                )}
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
            <span className="cluster-pill cluster-clock" aria-label={`${words.clock} ${time}`}>
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
                <ClusterNoticeBar notice={notice} textScale={typeScale} onDismiss={removeNotice} />
              ) : nowPlaying ? (
                <motion.div
                  className="cluster-media"
                  data-paused={nowPlaying.playing ? undefined : ''}
                  aria-label={`${text.nowPlaying}: ${nowPlaying.title}${nowPlaying.artist ? ` · ${nowPlaying.artist}` : ''}`}
                  initial={reduceMotion ? false : { opacity: 0 }}
                  animate={{ opacity: nowPlaying.playing ? 1 : 0.55 }}
                  transition={reduceMotion ? { duration: 0 } : { duration: 0.26, delay: 0.06, ease: motionEase }}
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
                The sign is always drawn, lit or not — it holds its slot so the reading never moves as a zone begins
                or ends (cluster.css, `.cluster-limitsign`) — and the whole face is hidden from the reader (the
                section above says the speed and the limit as words), so the sign needs no name of its own here. */}
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
                initial={reduceMotion ? false : { opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={reduceMotion ? { duration: 0 } : { duration: 0.38, delay: 0.02, ease: motionEase }}
              >
                {/* The maker's mark, in the band of air above the figure: what the ring's printed scale left behind.
                    It fades in with the rest of the face's parts, and the stylesheet sizes it to that band. */}
                <ClusterBrand reduced={reduceMotion} />
                <ClusterDial
                  speedShare={speedShare}
                  rpm={rpm}
                  limit={limit}
                  cruise={cruise}
                  max={face.max}
                  reduced={reduceMotion}
                />
                {/* The face reads top to bottom: the mark, the figure, its unit, the road's limit, and the gear in the
                    ring's open bottom. */}
                <div className="cluster-speed" aria-hidden>
                  <strong
                    key={Math.round(speed)}
                    className="cluster-speed-value"
                    data-over={over ? '' : undefined}
                  >
                    {speed}
                  </strong>
                  <span>{units.labels.speed}</span>
                  <motion.span
                    className="cluster-limitsign"
                    data-empty={sign.value === null ? '' : undefined}
                    data-leaving={sign.leaving ? '' : undefined}
                    initial={reduceMotion ? false : { opacity: 0, scale: 0.8 }}
                    animate={{
                      opacity: sign.value === null || sign.leaving ? 0 : 1,
                      scale: sign.value === null ? 0.8 : 1,
                    }}
                    transition={
                      reduceMotion
                        ? { duration: 0 }
                        : sign.leaving
                          ? { duration: 0.42, ease: motionEase }
                          : { duration: 0.34, delay: 0.14, ease: motionEase }
                    }
                  >
                    <b>{sign.value ?? ''}</b>
                  </motion.span>
                </div>
                {/* The needle never sweeps the bottom of the face (the arc's gap is there), so the gear keeps the
                    open bottom under the figure. Keyed by the gear, so each change settles into place the way a
                    gear going in does, instead of the letter being swapped out behind the driver's back. */}
                <motion.div
                  className="cluster-gear"
                  aria-label={`${words.gear} ${gear}`}
                  initial={reduceMotion ? false : { opacity: 0, x: '-50%', y: 4 }}
                  animate={{ opacity: 1, x: '-50%', y: 0 }}
                  transition={reduceMotion ? { duration: 0 } : { duration: 0.32, delay: 0.16, ease: motionEase }}
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
                  <div
                    className="cluster-meter"
                    data-scale="level"
                    data-hot={fuel?.state === 'warn' ? '' : undefined}
                    data-low={fuel?.state === 'alarm' ? '' : undefined}
                    {...meterZone(fuel, 'low')}
                  >
                    <span style={{ width: `${Math.round((fuelShare ?? 0) * 100)}%` }} />
                  </div>
                  <strong
                    className="cluster-gauge-value"
                    data-hot={fuel?.state === 'warn' ? '' : undefined}
                    data-warn={fuel?.state === 'alarm' ? '' : undefined}
                  >
                    {t ? fuelValue.value : '—'}
                    <small>{fuelValue.unit}</small>
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
                <strong
                  data-hot={adblue?.state === 'warn' ? '' : undefined}
                  data-warn={adblue?.state === 'alarm' ? '' : undefined}
                >
                  {t ? adblueValue.value : '—'}
                  <small>{adblueValue.unit}</small>
                </strong>
                <div
                  className="cluster-meter"
                  data-scale="level"
                  data-hot={adblue?.state === 'warn' ? '' : undefined}
                  data-low={adblue?.state === 'alarm' ? '' : undefined}
                  {...meterZone(adblue, 'low')}
                >
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
                  data-hot={coolant?.state === 'warn' ? '' : undefined}
                  data-warn={coolant?.state === 'alarm' ? '' : undefined}
                  data-cold={coldCoolant ? '' : undefined}
                  {...meterZone(coolant, 'high')}
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
                  <div
                    className="cluster-meter"
                    data-hot={brakeHeat?.state === 'warn' ? '' : undefined}
                    data-warn={brakeHeat?.state === 'alarm' ? '' : undefined}
                    {...meterZone(brakeHeat, 'high')}
                  >
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
                data-hot={instantReading?.state === 'warn' ? '' : undefined}
                data-warn={instantReading?.state === 'alarm' ? '' : undefined}
                {...meterZone(instantReading, 'high')}
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
                  {...meterZone({ warnPercent: DAMAGE_STOP }, 'high')}
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
                    {...meterZone({ warnPercent: DAMAGE_STOP }, 'high')}
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
 * while it isn't; while it is there, the charge it has — a phone's own battery, red under a fifth of it and green
 * with its bolt while charging, with the level beside it in figures; while it isn't, the words that say so. The charge
 * and not the phone's name: the cabin's sidebar and the Phone app name it, and a name wide enough to be read took the
 * room the line above the dial needs to stay on the dial's centre (cluster.css, `.cluster-message`). Sitting with the
 * notices rather than in the status bar keeps that bar the truck's — cruise, limit, clock — and what the phone is
 * beside what it has to say. The way into the Phone app is the cabin's; a call is the notice's own, where it can be
 * answered and read.
 */
function ClusterPhone() {
  const text = useText()
  const words = text.phoneApp
  const phone = usePhone()
  // The charge, only while the phone is there and only when it has a level to give: an absent battery says "not
  // known", as an empty one would say "empty".
  const level = phone.connected ? phone.device?.battery : undefined
  const charging = phone.connected && phone.device?.charging === true
  const charge = level !== undefined ? words.battery(level) : null
  // What a reader hears: the charge while the phone is there, and the state in the sidebar's words when it isn't.
  const label = [text.apps.phone, phone.connected ? charge : words.noPhone, charging ? words.charging : null]
    .filter(Boolean)
    .join(', ')
  return (
    <span className="cluster-phone" data-on={phone.connected ? '' : undefined} role="img" aria-label={label}>
      <PhoneIcon />
      {!phone.connected && <span className="cluster-phone-words">{words.noPhone}</span>}
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
 * The truck's brand, whose dash this is: the same mark the boot screen and the sidebar show — its makers' trademarks,
 * so the files live outside the repository (`public/brand-logos`) — drawn in the panel's own greys, white on the dark
 * glass and black on the light, and the brand's name as a small wordmark where it has no logo.
 *
 * It sits in the band of air above the speed figure, where the scale's numbers used to be: the face has no printed
 * scale for a mark to sit among any more, so the mark takes the place the scale left, over the reading it belongs to.
 * Its size is set against that band rather than against the panel's type (cluster.css), because a lone logo in a wide
 * band of air reads as a speck unless it is sized to fill it. The standby screen shows the same mark alone, centred
 * on the glass.
 */
/** What the dial draws, as plain numbers: a face (its top speed) and the two readings on it. */
interface ClusterDialProps {
  /** How far round the face the truck is, 0 (at rest) to 1 (the face's top speed). */
  speedShare: number
  /** The engine's share of its own scale, 0 to 1. */
  rpm: number
  /** The limit the route knows, in the face's own units (0 when there is none): marked across the ring. */
  limit: number
  /** The speed the cruise is holding, in the face's own units (0 when it holds none): marked inside the ring. */
  cruise: number
  /** The face's top speed, in the driver's units: the end of the ring the arc fills towards. */
  max: number
  /** The app's Reduce Motion setting: the face arrives at rest rather than assembling itself. */
  reduced: boolean
}

/**
 * The dial's face, kept to what a digital cluster needs: the speed as one lit arc round a figure, and the tacho as a
 * hairline outside it. There is no scale printed on the face — no numbers, no ticks, no comb of dots. Those were a
 * second reading of the same thing: the figure at the centre already says the speed exactly, and a ring of numbers
 * beside it made the eye choose between them from across the cab, with the marks between the two crossing the digits.
 * The arc answers the one question the ring is for — how far up the truck's speed is — and the ring carries just two
 * marks: the road's limit across it, and the speed the cruise is holding inside it.
 *
 * It is a component of its own because it keeps a clock of its own: `useSmoothed` carries the two readings towards the
 * truck's a frame at a time, and only this SVG is redrawn while they travel — the panels, the route and the notices
 * carry on at the rate the telemetry actually arrives. Memoised on plain numbers, so a reading that leaves the dial
 * alone costs it nothing.
 *
 * It opens the way a dash does when the electrics come on: the arc lit to the far end of its scale, held while the
 * face comes up, then falling back to the reading as the boot clears (SWEEP_HOLD_MS, SWEEP_MS). The panel is put on
 * the glass when the boot is over, which is what puts that sweep where the driver can see it rather than behind the
 * splash.
 */
const ClusterDial = memo(function ClusterDial({ speedShare, rpm, limit, cruise, max, reduced }: ClusterDialProps) {
  // The two readings as the face shows them: eased a frame at a time, the speed opening with the power-up sweep.
  const shownSpeed = useSmoothed(speedShare, { from: 1, hold: SWEEP_HOLD_MS, sweep: SWEEP_MS })
  const shownRpm = useSmoothed(rpm)
  // The limit's mark: the sign's own clock (LIMIT_LEAVE_MS), so the mark and the sign leave the panel together. A
  // limit past the face's top speed has no place on this face and so isn't marked at all.
  const mark = useLingering(limit > 0 && limit <= max ? limit : null, LIMIT_LEAVE_MS)
  // The cruise's mark, by the same rules: the speed it holds, kept for one fade after the cruise is switched off,
  // and no mark at all for a set speed past the face's top (there is nowhere on this face to put it).
  const cruiseMark = useLingering(cruise > 0 && cruise <= max ? cruise : null, CRUISE_LEAVE_MS)

  // The face's parts each fade in at their own moment, on the groove's own clock: the remount as the boot clears plays
  // them once per boot. Reduced motion brings the whole face up at rest.
  const marks = (delay: number, duration: number) =>
    reduced
      ? { initial: false, animate: { opacity: 1 }, transition: { duration: 0 } }
      : { initial: { opacity: 0 }, animate: { opacity: 1 }, transition: { duration, delay, ease: motionEase } }

  return (
    <svg className="cluster-dial-ring" viewBox="0 0 300 300" aria-hidden>
      <motion.circle
        className="cluster-dial-track"
        cx="150"
        cy="150"
        r={DIAL_RADIUS}
        strokeDasharray={`${DIAL_CIRCUMFERENCE * DIAL_SWEEP} ${DIAL_CIRCUMFERENCE}`}
        transform={`rotate(${DIAL_START} 150 150)`}
        {...marks(0.04, 0.3)}
      />
      {/* The speed, as a lit arc in the track: how far round the face the driver is, drawn in the dash's accent so
          the one colour on the glass is also the speed. Its length is the smoothed reading, so it is a frame's worth
          of movement rather than a step. At a standstill the cap goes square: a round cap on a zero-length dash
          still draws a dot, and a lone accent bead at the scale's start read as a fault light, not as zero. */}
      <motion.circle
        className="cluster-dial-fill"
        cx="150"
        cy="150"
        r={DIAL_RADIUS}
        strokeDasharray={`${DIAL_CIRCUMFERENCE * DIAL_SWEEP * shownSpeed} ${DIAL_CIRCUMFERENCE}`}
        transform={`rotate(${DIAL_START} 150 150)`}
        style={{ strokeLinecap: shownSpeed > 0 ? 'round' : 'butt' }}
        {...marks(0.06, 0.3)}
      />
      {/* The speed the cruise is holding, as a notch inside the ring where that speed falls: the arc says how fast
          the truck is going, and this says the speed it is being held at, so the two read against each other without
          leaving the face. It points in from the ring rather than crossing it, because the one mark that crosses the
          ring is the road's limit; and it is drawn under the limit's group, so the road's mark stays on top if the two
          ever fall together. Its angle is a transform the stylesheet transitions, so a set speed changed by a step
          slides round the face, and it is held for one fade after the cruise is off, as the limit's mark is. */}
      {cruiseMark.value !== null && (
        <motion.g
          className="cluster-dial-cruise"
          data-leaving={cruiseMark.leaving ? '' : undefined}
          style={{
            transform: `rotate(${DIAL_START + 90 + DIAL_SWEEP_DEGREES * (cruiseMark.value / max)}deg)`,
            transformOrigin: '150px 150px',
          }}
          initial={reduced ? false : { opacity: 0 }}
          animate={{ opacity: cruiseMark.leaving ? 0 : 1 }}
          transition={reduced ? { duration: 0 } : { duration: 0.42, ease: motionEase }}
        >
          <line className="cluster-dial-cruise-mark" x1="150" y1={150 - 126} x2="150" y2={150 - 114} />
        </motion.g>
      )}
      {/* The limit where it falls on the ring, drawn over the lit arc so passing it reads as passing it: the sign
          under the figure says what the limit is, and this says where it is on the truck's own speed. It is a mark
          across the ring rather than a second scale, as a bar prints its threshold line across itself, with the band
          past it shading the reserve — the face's own way of showing a limit without printing numbers on it. It is held
          for one fade after the route stops knowing a limit, so it leaves with the sign rather than blinking away. Its
          angle is a transform the stylesheet can transition, so a limit that changes slides round the face. */}
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
          {/* The face past the limit, as a field under the mark: the same radius, three times the ring's width and a
              shade fainter, running from the limit to the scale's end. It rides in the mark's group so it fades in and
              slides round the face with the mark, and it begins at the group's own 12 o'clock — the mark's direction,
              three quarters of the way along the circle's path — which puts its leading edge on the limit whatever the
              limit is. */}
          {mark.value < max && (
            <circle
              className="cluster-limit-band"
              cx="150"
              cy="150"
              r={DIAL_RADIUS}
              strokeDasharray={`${DIAL_CIRCUMFERENCE * DIAL_SWEEP * (1 - mark.value / max)} ${DIAL_CIRCUMFERENCE}`}
              strokeDashoffset={-DIAL_CIRCUMFERENCE * 0.75}
            />
          )}
          <line className="cluster-limit-mark" x1="150" y1={150 - 132} x2="150" y2={150 - 122} />
        </motion.g>
      )}
      <motion.circle
        className="cluster-dial-rpm-track"
        cx="150"
        cy="150"
        r={RPM_RADIUS}
        strokeDasharray={`${RPM_CIRCUMFERENCE * DIAL_SWEEP} ${RPM_CIRCUMFERENCE}`}
        transform={`rotate(${DIAL_START} 150 150)`}
        {...marks(0.05, 0.3)}
      />
      <motion.circle
        className="cluster-dial-rpm"
        cx="150"
        cy="150"
        r={RPM_RADIUS}
        strokeDasharray={`${RPM_CIRCUMFERENCE * DIAL_SWEEP * shownRpm} ${RPM_CIRCUMFERENCE}`}
        transform={`rotate(${DIAL_START} 150 150)`}
        style={{ strokeLinecap: shownRpm > 0 ? 'round' : 'butt' }}
        {...marks(0.07, 0.3)}
      />
      {/* The tacho's redline, printed on its own hairline: the one band a tach needs to read. Scania also marks the
          auxiliary brake's zone (2,000 to 2,400 rpm) in blue; on a face this quiet a second colour field at the rim
          pulled the eye off the speed, and the retarder's own steps say when the brake is in use. */}
      <motion.circle
        className="cluster-rpm-redline"
        cx="150"
        cy="150"
        r={RPM_RADIUS}
        strokeDasharray={`${RPM_CIRCUMFERENCE * DIAL_SWEEP * (1 - RPM_REDLINE)} ${RPM_CIRCUMFERENCE}`}
        strokeDashoffset={-RPM_CIRCUMFERENCE * DIAL_SWEEP * RPM_REDLINE}
        transform={`rotate(${DIAL_START} 150 150)`}
        {...marks(0.12, 0.52)}
      />
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
      transition={reduced ? { duration: 0 } : { duration: 0.4, delay: 0.12, ease: motionEase }}
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
 * arrive, and it goes down before the dial comes up. It is the cabin's boot, told rather than timed — the phase comes from
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
  /** The phone notification this notice shows, when it is a phone notice. */
  notification?: import('../../shared/host').PhoneNotification
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
      notification,
      count: toasts.length,
    }
  }
  return alert
}

/**
 * The chime as a notice is recorded on the dash: soft for a warning, firmer for an alarm (state/sound.ts).
 * Dismissing a notice leaves the newest history entry alone, so the line underneath becoming newest says nothing.
 */
function useNoticeCue(notice: ClusterNotice | null): void {
  const lastKey = useRef(notice?.key ?? '')
  useEffect(() => {
    if (!notice || notice.key === lastKey.current) return
    lastKey.current = notice.key
    if (notice.tone === 'alarm') playCue('alarm')
    else if (notice.tone === 'warn') playCue('note')
  }, [notice])
}

/**
 * Takes the cluster's current notice away: tells the phone to drop the notification, clears the local toast, and
 * marks the dash's notice line as dismissed so the exit animation can play before the bar goes empty.
 */
export function removeNotice(key: string): void {
  if (key.startsWith('phone:')) {
    const id = key.slice(6)
    sendPhoneCommand({ action: 'dismiss', id })
    takeDownNotification(id)
  }
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
}/**
 * The notice line above the dial: the phone's notification card, centred on the glass, as the phone's own shade
 * shows one — its app tile, its title and text, its time, and its dismissal at its end. It keeps the cluster's
 * one-line room: the card is the phone's own size, its words are one line and its count is a chip at its end when
 * there are more.
 */
function ClusterNoticeBar({
  notice,
  textScale,
  onDismiss,
}: {
  notice: ClusterNotice
  textScale: number
  onDismiss: (key: string) => void
}) {
  const [dismissing, setDismissing] = useState(false)
  const handleDismiss = () => {
    setDismissing(true)
    setTimeout(() => onDismiss(notice.key), 180)
  }
  return (
    <div
      className="cluster-notice"
      data-kind={notice.kind}
      data-tone={notice.tone}
      data-dismissing={dismissing ? 'true' : undefined}
      aria-hidden
    >
      {notice.notification && (
        <>
          {/* The app's tile: the same shape the phone app gives its group icon, in the app's own hue. */}
          <span
            className="phone-note-group-icon"
            data-hue={`${notice.tone === 'alarm' ? 0 : notice.tone === 'warn' ? 38 : 210}`}
            aria-hidden
          >
            {notice.icon ? (
              <img src={notice.icon} alt="" />
            ) : (
              notice.label.trim().charAt(0).toUpperCase()
            )}
          </span>
          <NoteCard
            notification={notice.notification}
            app={notice.label}
            icon={notice.icon}
            dismissLabel="Dismiss"
            onDismiss={handleDismiss}
            textScale={textScale}
          />
        </>
      )}
    </div>
  )
}

/**
 * Where a bar prints its gauge's warning line, and which end of the bar the trouble is at (cluster.css,
 * `.cluster-meter[data-zone]`): the reading's own threshold, so the zone a bar draws is the same one the Diagnostics
 * app turns amber at. A reading the panel has no data behind draws no zone, rather than painting the whole bar with one.
 */
function meterZone(read: { warnPercent: number } | null, side: 'low' | 'high') {
  if (!read) return {}
  return {
    'data-zone': side,
    style: { '--zone': `${Math.round(read.warnPercent * 100)}%` } as CSSProperties,
  }
}

/** Damage at which the dash lights its warning lamp, and its stop lamp (the game's 15% and 50%). */
const DAMAGE_WARN = 0.15
const DAMAGE_STOP = 0.5

/** Below this the engine is still warming up: the dash reads its coolant and oil blue, not just red when hot. */
const COLD_C = 60

/** The dial's geometry: a 270° sweep from 7:30 to 4:30, as a truck's speedometer counts. */
const DIAL_RADIUS = 127
const DIAL_CIRCUMFERENCE = 2 * Math.PI * DIAL_RADIUS
const DIAL_SWEEP = 0.75
const DIAL_START = 135
const DIAL_SWEEP_DEGREES = 270
/* The self-test a dash runs at power-up, as the electrics come on: the face lit to its far end, held there while the
   bezel, the scale and its numbers come up (`hold`), then falling back to the reading over `sweep`. It lands inside the
   dash's first second, since the panel is only put on the glass once the boot is over and the driver is waiting on it. */
const SWEEP_HOLD_MS = 200
const SWEEP_MS = 520
/* How long the speed limit's sign and its mark on the scale take to leave the panel once the route stops knowing a
   limit: long enough to read as a fade, short enough that the mark isn't still there on the next road. */
const LIMIT_LEAVE_MS = 420
/* How long the cruise's mark takes to leave the face once the cruise is switched off: one fade, and a little shorter
   than the limit's — the driver has just pressed the button, so there is nothing in its going to be read. */
const CRUISE_LEAVE_MS = 320
/* The dash's bulb check, as the boot clears: long enough for every lamp to be seen in its colour, short enough that a
   real warning isn't held off the glass behind it. `cluster.css` runs the lit state over the same window. */
const BULB_CHECK_MS = 1500

/* The tacho: its hairline outside the speedo's, read against a 2,500 rpm scale. */
const RPM_MAX = 2500
const RPM_RADIUS = 139
const RPM_CIRCUMFERENCE = 2 * Math.PI * RPM_RADIUS
/* Where the red starts, as a share of the scale: Scania's red field begins at 2,400 and runs to the end. */
const RPM_REDLINE = 2400 / RPM_MAX

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

/** What a step is, in the cab's own words (the same words the map's guidance card says, GuidanceCard): a turn, a
 *  roundabout's exit, or arriving. The cluster draws the step as its arrow, so this is for the reader's label. */
function stepWords(step: Step, text: Strings): string {
  if (step.kind === 'arrive') return text.arrive
  const { turn, exit } = step.maneuver
  return turn === 'roundabout' ? text.roundabout(exit ?? 1) : text.turns[turn]
}

function minutes(value: number, words: Strings['diagnostics']): string {
  const whole = Math.max(0, Math.round(value))
  if (whole < 60) return `${whole} ${words.minutes}`
  return `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, '0')} ${words.hours}`
}
