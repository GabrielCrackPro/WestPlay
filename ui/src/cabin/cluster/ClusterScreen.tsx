import { AnimatePresence, motion } from 'motion/react'
import { type CSSProperties, type ReactElement, useEffect, useState } from 'react'
import { formatGameTime, formatGear } from '../../shared/format'
import { cabClock, type CabinPower, hasTruck, type NowPlayingInfo, subscribeHostMessages } from '../../shared/host'
import { appIcon, type AppIconRole } from '../../shared/icons'
import {
  adblue as adblueReading,
  brakeTemperature as brakeTemperatureReading,
  consumption as consumptionReading,
  coolant as coolantReading,
} from '../apps/diagnostics/readings'
import { receivePhoneNotifications, receivePhoneState, usePhone } from '../apps/phone/phone'
import { BootScreen } from '../boot/BootScreen'
import { logoSources } from '../boot/brand'
import { bootLength, bootShown } from '../state/power'
import { useHandover } from '../state/useHandover'
import { motionEase, useMotionReduced } from '../motion'
import { resolveAppearance } from '../state/appearance'
import { useNightDim } from '../state/nightDim'
import { type ClusterSideCard, syncClock, useCabin, useLive } from '../state/store'
import { clusterAccent } from './accent'
import { EngineCardBody, FuelCardBody, HoursCardBody, TripCardBody } from './ClusterCards'
import { COLD_C, meterZone, useClusterCardViews } from './clusterCardViews'
import { ClusterDial, LIMIT_LEAVE_MS, RPM_MAX, SpeedFigure } from './ClusterDial'
import { ClusterNoticeBar } from './ClusterNotices'
import { useClusterNotice, useNoticeCue } from './notice'
import { TelltaleList } from './ClusterTelltales'
import { useClusterTelltales } from './telltales'
import { DAMAGE_STOP } from '../state/warnings'
import { ManeuverGlyph } from '../maps/ManeuverGlyph'
import { guidanceOf, NOW_WITHIN, type Step } from '../maps/guidance'
import { followGpsVoice, useGpsVoice } from '../maps/voice'
import { useClock } from '../state/clock'
import { clusterTextScale } from '../state/textSize'
import { useUnits } from '../state/units'
import { useLanguage, useText } from '../state/text'
import type { Strings } from '../state/strings'
import type { Figure } from '../../shared/units'
import {
  AdblueIcon,
  BrakeTemperatureIcon,
  ClockIcon,
  CoolantIcon,
  CruiseIcon,
  DropIcon,
  MusicIcon,
  PhoneIcon,
  RangeIcon,
  RetarderIcon,
  TrailerIcon,
  WarningIcon,
} from './ClusterIcons'
import { useLingering } from './useLingering'
import { usePlayed } from './usePlayed'
import { useShownAppearance } from './useShownAppearance'
import './cluster.css'
import './telltales.css'

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
  const job = useLive((state) => state.job)
  // The route the cab's map drew, and how far along it the truck is: the dash draws the same next turn from it.
  const route = useLive((state) => state.route)
  const routeNext = useLive((state) => state.routeNext)
  const nowPlaying = useLive((state) => state.nowPlaying)
  const clockShift = useLive((state) => state.clockShift)
  const shown = useCabin((state) => state.clusterShown)
  const cards = useCabin((state) => state.clusterCards)
  // The level gauges as the settings ask (Settings › Instrument Cluster): the share of the tank, or its litres.
  const gaugePercent = useCabin((state) => state.clusterGaugePercent)
  // The panel's own look (Settings › Instrument Cluster): its accent, the tacho's ring, the maker's mark, and the
  // three readings the engine card draws.
  const accentChoice = useCabin((state) => state.clusterAccent)
  const tacho = useCabin((state) => state.clusterTacho)
  const showBrand = useCabin((state) => state.clusterBrand)
  const readingSlots = useCabin((state) => state.clusterReadings)
  // The cards either side of the dial, and the order they run down each column (Settings › Instrument Cluster).
  const layout = useCabin((state) => state.clusterLayout)
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
  // The side cards' figures, and the tank's loss over the last second for the instant-consumption gauge (the game
  // reports only the average): the same view model the Settings preview draws.
  const cardViews = useClusterCardViews()
  const instant = cardViews.instant
  // The two rows of lamps, and the wear that lights the damage lamp (the Settings preview draws the warnings' row from
  // the same place).
  const { lights, faults, damage, damageTone, trailerDamage, trailerTone } = useClusterTelltales()
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
  // The game's GPS voice, followed on this page too: the cluster has its own live store (the host streams the truck to
  // both pages), so its own follower — the panel's frame answers the voice as the cabin's screens do (maps/voice.ts).
  useEffect(() => followGpsVoice(), [])
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
  // The latch is adjusted during render (React's derived-state pattern): once guidance has started for a job it stays
  // started for that job, even as the remaining distance reaches zero at the destination.
  const [guidedFor, setGuidedFor] = useState<string | null>(null)
  if (telemetry && telemetry.navigationDistance > 0 && guidedFor !== jobKey) setGuidedFor(jobKey)
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
  // Whether the sign is switched on (Settings › GPS Voice) and the game's GPS voice is talking: the glow on
  // this panel's frame is the same answer the cabin's screens give, read from this page's own follower.
  const voiceOnScreen = useCabin((state) => state.gpsVoiceOnScreen)
  const voiceTalking = useGpsVoice((state) => state.talking)

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
  // The right column's own readings, as Diagnostics gauges them: the same ranges, the same warning lines and the
  // game's own warning channels, so the cluster and the app can't disagree about when something is wrong. The four
  // side cards' readings are the shared view model's (ClusterCards).
  const adblue = t ? adblueReading(t.adblue) : null
  const coolant = t ? coolantReading(t.coolantTemperature) : null
  const brakeHeat = t ? brakeTemperatureReading(t.brakeTemperature) : null
  const instantReading = instant === null ? null : consumptionReading(instant)
  // A cold diesel reads blue on the dash until it is up to working temperature, not only red when it is too hot.
  const coldCoolant = (t?.coolantTemperature ?? 0) > 0 && (t?.coolantTemperature ?? 0) < COLD_C
  const time = t ? formatGameTime(cabClock(t, clockShift)) : '--:--'
  const adblueFigure = units.volumeFigure(t?.adblue ?? 0, text.decimal)
  // The figures the two level gauges print. A level is a share of what its tank holds, which is what the bar beside
  // it draws, so the settings can read it as that share — the one reading a driver can put against the bar without
  // working out the tank's capacity. Only the two quantities have a share to give: a temperature or a rate is a
  // point on a scale, not a part of it, and keeps its own figure either way. A truck whose tank the game doesn't
  // measure keeps its litres rather than claiming an empty tank.
  const adblueValue: Figure =
    gaugePercent && adblue !== null ? { value: String(Math.round(adblue.percent * 100)), unit: '%' } : adblueFigure
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
  // The dash's accent (Settings › Instrument Cluster): by default the map's route colour, the one colour the driver
  // already chose for "this is the way", on the needle, the cruise mark and the live readings — or a fixed colour for
  // a dash that is its own thing. The route's own fill does on the dark panel, its darker edge on the light one, so it
  // reads on either.
  const accent = clusterAccent(accentChoice, appearance, routeColour)
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
          {/* The mark is not a second badge here: it keeps the one the dial drew and slides from the face to the
              centre of the dark glass (TruckMark's layoutId). The hairline and the line under it follow it in. */}
          <ClusterBrand reduced={reduceMotion} />
          <motion.span
            className="cluster-standby-rule"
            aria-hidden
            initial={reduceMotion ? false : { opacity: 0, scaleX: 0.4 }}
            animate={{ opacity: 1, scaleX: 1 }}
            transition={reduceMotion ? { duration: 0 } : { duration: 0.45, delay: 0.16, ease: motionEase }}
          />
          <motion.p
            className="cluster-standby-label"
            initial={reduceMotion ? false : { opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            transition={reduceMotion ? { duration: 0 } : { duration: 0.4, delay: 0.24, ease: motionEase }}
          >
            {words.engineOff}
          </motion.p>
        </div>
      </main>
    )
  }

  // Each side card's panel, as the dash draws it: the two columns are filled from the player's layout (Settings ›
  // Instrument Cluster), so a card moved to the other side is drawn there with the same face and the same entrance,
  // and a card in the order but turned off is simply not drawn. The tank's companions — the AdBlue and the coolant,
  // the brake heat, the instant reading and the wear — belong to the right column and keep their place there.
  const panels: Record<ClusterSideCard, ReactElement> = {
    trip: (
      <motion.section
        key="trip"
        className="cluster-panel cluster-trip"
        aria-label={`${words.trip} ${t ? cardViews.trip.distance.value : 0} ${cardViews.trip.distance.unit}`}
        variants={riseVariants(reduceMotion)}
      >
        <TripCardBody views={cardViews} />
      </motion.section>
    ),
    engine: (
      <motion.section
        key="engine"
        className="cluster-panel cluster-engine"
        aria-label={words.engine}
        variants={riseVariants(reduceMotion)}
      >
        <EngineCardBody views={cardViews} slots={readingSlots} />
      </motion.section>
    ),
    hours: (
      <motion.section
        key="hours"
        className="cluster-panel cluster-hours"
        aria-label={words.driverHours}
        variants={riseVariants(reduceMotion)}
      >
        <HoursCardBody views={cardViews} />
      </motion.section>
    ),
    fuel: (
      <motion.section
        key="fuel"
        className="cluster-panel cluster-fuel"
        aria-label={words.fuel}
        variants={riseVariants(reduceMotion)}
      >
        <FuelCardBody views={cardViews} />
      </motion.section>
    ),
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
      {voiceOnScreen && <div className="cluster-voice-glow" data-on={voiceTalking ? '' : undefined} aria-hidden />}
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
            {/* The phone's own status beside the clock: the receiver, lit while a phone is paired and dim while
                there isn't one, and the charge it has. It sits here rather than on the line above the dial so that
                line is the song's alone — the row's whole width for what plays (owner 2026-11-12). */}
            <ClusterPhone />
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
            {layout.left.filter((card) => cards[card]).map((card) => panels[card])}
          </motion.aside>

          <section className="cluster-centre">
            {/* One line above the dial, always reserved, so the route above never moves. It is the song's alone: the
                cab's notices come over the face instead (see the notices layer below), and the phone's status sits in
                the bar above with the clock — a warning's words and a message's were more than one line of a dash
                has room for, and the chip at its end took the room the line wants for what plays (owner 2026-11-12).
            */}
            <div className="cluster-message">
              {nowPlaying ? (
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
                  {/* The name and its byline are one run of text, cut once at its end (cluster.css,
                      `.cluster-media-words`): as two cut lines, a long station took half the room from the song it was
                      playing, and each half then lost its own tail even where the other had room to spare. */}
                  <span className="cluster-media-words">
                    <b>{nowPlaying.title}</b>
                    {nowPlaying.artist && <> · {nowPlaying.artist}</>}
                  </span>
                  {/* How far into the track, under its words: the bar's own end is the length, so it needs no time
                      on it — one look says how much of the song is left. It keeps a clock of its own (MediaProgress),
                      so a track running redraws this bar rather than the panel around it. */}
                  <MediaProgress info={nowPlaying} />
                </motion.div>
              ) : null}
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
                {showBrand && <ClusterBrand reduced={reduceMotion} />}
                <ClusterDial
                  speedShare={speedShare}
                  rpm={rpm}
                  limit={limit}
                  cruise={cruise}
                  max={face.max}
                  tacho={tacho}
                  reduced={reduceMotion}
                />
                {/* The face reads top to bottom: the mark, the figure, its unit, the road's limit, and the gear in the
                    ring's open bottom. */}
                <div className="cluster-speed" aria-hidden>
                  <SpeedFigure speed={speed} limit={sign.value} reduced={reduceMotion} />
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
            data-extra={layout.right.filter((card) => cards[card]).length > 1 ? '' : undefined}
            initial={reduceMotion ? false : 'hidden'}
            animate="shown"
            variants={sideVariants(reduceMotion)}
          >
            {layout.right.filter((card) => cards[card]).map((card) => panels[card])}

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

        {/* The cab's notices — the truck's own warnings and rest clocks, and the phone's messages — centred on the
            glass as the cabin draws them over the screen it is showing: one card over the dial, in the panel's own
            greys. A notice is not a reading on the glass, it is something said over it, and its words (a warning's
            reading, a message's text) need more than the one line above the dial has room for. The layer covers the
            panel but only the card in it takes a press: everything under it is still read at a glance. */}
        <div className="cluster-notices">
          <AnimatePresence>
            {notice && (
              <ClusterNoticeBar key={notice.key} notice={notice} textScale={typeScale} reduceMotion={reduceMotion} />
            )}
          </AnimatePresence>
        </div>
      </motion.div>

      {/* The truck's night: the panel dims as the cabin's screen does, so it doesn't glare in a dark cab. */}
      {nightDim > 0 && <div className="cluster-night" style={{ opacity: nightDim }} aria-hidden />}
    </main>
  )
}

/**
 * The bar under what plays, with a clock of its own (`usePlayed`): the dash only ever draws one, and a track running is
 * the only reading on the panel that changes between telemetry frames — so the second it ticks redraws this bar and not
 * the readings, the lamps or the dial beside it. A stream has no length to measure, so there is no bar and no clock.
 */
function MediaProgress({ info }: { info: NowPlayingInfo }) {
  const played = usePlayed(info)
  if (!played) return null
  return (
    <i className="cluster-media-progress" aria-hidden>
      <i style={{ width: `${Math.round((played.position / played.duration) * 100)}%` }} />
    </i>
  )
}

/**
 * The paired phone, beside the clock in the bar above the dial: the receiver, lit while the phone is there and dim
 * while it isn't; while it is there, the charge it has — a phone's own battery, red under a fifth of it and green
 * with its bolt while charging, with the level beside it in figures; while it isn't, the words that say so. The charge
 * and not the phone's name: the cabin's sidebar and the Phone app name it, and a name wide enough to be read is not
 * the dash's to spend on a state that never changes. It sat on the line above the dial until the line was given to
 * what plays and nothing else (owner 2026-11-12); a state of the cab belongs in the bar with the cab's other states,
 * and the bar had the room once the chip stopped cutting the song. The way into the Phone app is the cabin's; a
 * message is the notice card's own, where it can be read and answered.
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
      // One maker's mark on the panel, in both the dial's air and the standby glass: the same layoutId lets Motion
      // carry it from the face to the centre when the ignition goes off, and back when it comes on.
      layoutId={reduced ? undefined : 'cluster-brand'}
      initial={reduced ? false : { opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={
        reduced
          ? { duration: 0 }
          : {
              layout: { type: 'spring', stiffness: 320, damping: 34, mass: 0.8 },
              opacity: { duration: 0.26, ease: motionEase },
            }
      }
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

/* The dash's bulb check, as the boot clears: long enough for every lamp to be seen in its colour, short enough that a
   real warning isn't held off the glass behind it. `cluster.css` runs the lit state over the same window. */
const BULB_CHECK_MS = 1500

function clamp(value: number): number {
  return Math.max(0, Math.min(1, value))
}

/** What a step is, in the cab's own words (the same words the map's guidance card says, GuidanceCard): a turn, a
 *  roundabout's exit, or arriving. The cluster draws the step as its arrow, so this is for the reader's label. */
function stepWords(step: Step, text: Strings): string {
  if (step.kind === 'arrive') return text.arrive
  const { turn, exit } = step.maneuver
  return turn === 'roundabout' ? text.roundabout(exit ?? 1) : text.turns[turn]
}
