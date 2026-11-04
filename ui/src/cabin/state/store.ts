import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'
import {
  type CareerStats,
  type Equalizer,
  FLAT,
  type HostMessage,
  type GameWeather,
  hasTruck,
  type JobInfo,
  IS_DEMO,
  type KeybindAction,
  isInHost,
  postToHost,
  subscribeHostMessages,
  type Telemetry,
  toEqualizer,
  type TrailerInfo,
  type TruckInfo,
} from '../../shared/host'
import type { Maneuver, TurnKind } from '../maps/guidance'
import {
  receiveAnswer as receiveAppleMusicAnswer,
  receivePlayback as receiveAppleMusicPlayback,
  useAppleMusic,
} from '../apps/music/appleMusic'
import { receiveCabSound } from '../apps/radio/cabSound'
import { receiveStations as receiveRadioStations } from '../apps/radio/radio'
import {
  receiveAnswer as receiveSpotifyAnswer,
  receivePlayback,
  receiveState as receiveSpotifyState,
} from '../apps/spotify/spotify'
import { receiveAnswer, receiveState, useYouTube } from '../apps/youtube/youtube'
import {
  receiveAnswer as receiveYouTubeMusicAnswer,
  receivePlayback as receiveYouTubeMusicPlayback,
  receiveState as receiveYouTubeMusicState,
} from '../apps/youtubeMusic/youtubeMusic'
import { useKeyboard } from '../keyboard/store'
import { receiveMapFolder } from '../maps/mapData'
import { receiveDetours, receiveFollowed, receiveRouteAnswer, receiveRoutes } from '../maps/routeChange'
import type { Point, RouteNode } from '../maps/route'
import { DEFAULT_WALLPAPER_ID } from '../wallpapers'
import {
  homeOrderOf,
  hiddenHomeApps,
  isReleasedApp,
  pinnedAppsOf,
  RELEASED_APP_IDS,
  visibleHomeApps,
  type AppId,
} from './apps'
import type { AppearanceMode } from './appearance'
import {
  MAP_MARKERS,
  MAP_MARKER_SIZES,
  MAP_NIGHT_STARTS,
  MAP_PIN_STYLES,
  MAP_ROUTE_COLOURS,
  MAP_ROUTE_WEIGHTS,
  MAP_TRAFFIC_AROUND,
  type MapMarker,
  type MapMarkerSize,
  type MapPinStyle,
  type MapRouteColour,
  type MapRouteWeight,
} from '../maps/routeLook'
import { afterRunningTransition, animateNavigation, launchFor, type LaunchOrigin } from './launch'
import {
  INITIAL_NAVIGATION,
  navigate,
  type NavigationAction,
  type NavigationState,
  type Route,
  routeKey,
} from './navigation'
import { isIconStyle, setIcons, useLooks } from './looks'
import type { OemMode } from './oem'
import { INITIAL_POWER, power, type PowerEvent, type PowerState } from './power'
import { isScreenLayoutId, type ScreenLayoutId } from './screen'
import { DEFAULT_TEXT_SIZE, STEPS_ADDED_BELOW, toTextSize } from './textSize'

/** The Dashboard's widgets the player can turn off (turn-by-turn always shows while there's a route). */
export type DashboardWidget = 'nowPlaying' | 'destination' | 'driverHours' | 'driver' | 'weather' | 'diagnostics'

export const DASHBOARD_WIDGETS: readonly DashboardWidget[] = [
  'nowPlaying',
  'destination',
  'driverHours',
  'driver',
  'weather',
  'diagnostics',
]

/** Which clock the sidebar shows: the game's own time, or the player's (their PC's). */
export type Clock = 'game' | 'real'

/**
 * The Diagnostics app's page: the readings a driver glances at, the powertrain, or the running gear's wear. The
 * app's tabs switch between them, and the one left open comes back (kept with the player's settings).
 */
export type DiagnosticsPage = 'overview' | 'engine' | 'driver' | 'chassis'

export const DIAGNOSTICS_PAGES: readonly DiagnosticsPage[] = ['overview', 'engine', 'driver', 'chassis']

/**
 * How much the live map draws (Settings › Maps): High keeps the 3D buildings at 60 frames a second, Balanced
 * draws fewer frames, Low drops the buildings and halves the work: for the PCs that share the game's GPU.
 */
export type MapDetail = 'high' | 'balanced' | 'low'

export const MAP_DETAILS: readonly MapDetail[] = ['high', 'balanced', 'low']

/** How long (s) a map the player moved stays put before it comes back to the truck; 0 never. */
export type MapRecentre = 5 | 15 | 30 | 0

export const MAP_RECENTRES: readonly MapRecentre[] = [5, 15, 30, 0]

/**
 * Cabin state that the UI renders from. Telemetry lives in its own store (`useLive`) because it updates
 * up to 20 times a second; components subscribe to just the fields they need.
 */
interface CabinState {
  navigation: NavigationState
  appearanceMode: AppearanceMode
  wallpaperId: string
  /** The Dashboard's widgets shown (Settings, Dashboard). */
  dashboardWidgets: Record<DashboardWidget, boolean>
  /** The sidebar's clock: the player's own time, or the game's (Settings, Dashboard). */
  clock: Clock
  /** Album art on Now Playing and in Music (Settings, Now Playing): off, a plain note instead. */
  albumArt: boolean
  /** The apps' text size, a step of `TEXT_SIZES` (Settings › Appearance › Text Size). */
  textSize: number
  /** Screens change without sliding or zooming (Settings › Appearance): the shell's animations, and the view
   * transitions that grow an app out of its icon, are cut to nothing. */
  reduceMotion: boolean
  /** The cabin's own sounds (Settings › Sound): the press's tick, the notes' chime, the volume's pip. */
  uiSounds: boolean
  /** The cabin's own sounds' level, independent of the music and game volume (Settings › Sound). */
  uiSoundVolume: number
  /** The Diagnostics app's page last opened, so its tabs come back where the player left them. */
  diagnosticsPage: DiagnosticsPage
  /** The Dashboard's widgets in the order the player put them (Settings › Dashboard), and whether the cab orders
   * them itself (Auto order): by what the drive needs (widgetState.ts's `useWidgetOrder`). */
  dashboardOrder: DashboardWidget[]
  autoOrder: boolean
  /** Home's apps in the player's order, and the ones hidden from it (Settings › Home Screen). */
  homeOrder: AppId[]
  homeHidden: AppId[]
  /** The apps pinned to the top of the sidebar, in the order they were pinned (Settings › Home Screen): the
   * sidebar keeps them there, whatever has been opened since. */
  pinnedApps: AppId[]
  /** The live map's own settings (Settings › Maps): how much it draws, how it behaves at night and at
   * junctions, whose trucks it shows, and when it comes back to the truck. */
  mapDetail: MapDetail
  mapNight: boolean
  mapJunction: boolean
  mapTrucks: boolean
  mapTraffic: boolean
  /** How far around the truck traffic is drawn when no route is driven, metres (`0`: only on a route). */
  mapTrafficAround: number
  mapRecentre: MapRecentre
  /** The route's colour and weight, north up, the truck's marker and its size, the speed-limit sign and whether
   * it warns, the compass and the scale bar, and the hour the map dims from. */
  mapRoute: MapRouteColour
  mapWeight: MapRouteWeight
  mapNorth: boolean
  mapMarker: MapMarker
  mapMarkerSize: MapMarkerSize
  mapLimit: boolean
  mapOver: boolean
  mapCompass: boolean
  mapScale: boolean
  mapNightStart: number
  /** The map's pins: filled or outlined, and which kinds it shows. */
  mapPins: MapPinStyle
  mapPinFuel: boolean
  mapPinParking: boolean
  mapPinService: boolean
  /** The truck's own strip: kept (`auto`) or not, as set in the companion window (the host sends it). */
  oemMode: OemMode
  /** The player's own tone curve (Settings › Equalizer), and whether it plays (Custom) or the speakers as tuned
   * (Recommended, flat): kept with WestPlay's settings, the host sends them. */
  equalizer: Equalizer
  equalizerCustom: boolean
  power: PowerState
  /**
   * The screen handed back to the truck (its stock screen shows, with Cabin Play's button to come back), like
   * CarPlay's car button. Never reached now: Cabin Play can't be closed from the game (owner 2026-11-04), so it
   * stays false and the shell's hand-over pieces never show. Not kept: it comes back with every power-up.
   */
  truckScreen: boolean
  /** Whether the cab comes back where the last launch left it (its screen and app): the companion's switch, sent by
   * the host. Off, it opens on the Dashboard and nothing of the last session is kept. Not kept itself: the host
   * holds it with the other settings. */
  resumeCabin: boolean
  navigate(action: NavigationAction): void
  setAppearanceMode(mode: AppearanceMode): void
  setWallpaper(id: string): void
  setDashboardWidget(widget: DashboardWidget, shown: boolean): void
  setClock(clock: Clock): void
  setAlbumArt(shown: boolean): void
  setTextSize(step: number): void
  setReduceMotion(on: boolean): void
  setDiagnosticsPage(page: DiagnosticsPage): void
  setAutoOrder(on: boolean): void
  /** Moves a widget up (`by` -1) or down (+1) the Dashboard's own order. */
  moveWidget(widget: DashboardWidget, by: number): void
  /** Shows or hides an app on Home; the last one shown can't be hidden. */
  setHomeAppHidden(app: AppId, hidden: boolean): void
  /** Moves an app up (`by` -1) or down (+1) Home's order. */
  moveHomeApp(app: AppId, by: number): void
  /** Pins an app to the top of the sidebar, or unpins it (as many as the sidebar has room for). */
  setPinnedApp(app: AppId, pinned: boolean): void
  /** Home's apps back in their own order, all shown. */
  resetHomeScreen(): void
  setMapRoute(mapRoute: MapRouteColour): void
  setMapWeight(mapWeight: MapRouteWeight): void
  setMapNorth(mapNorth: boolean): void
  setMapMarker(mapMarker: MapMarker): void
  setMapMarkerSize(mapMarkerSize: MapMarkerSize): void
  setMapLimit(mapLimit: boolean): void
  setMapOver(mapOver: boolean): void
  setMapCompass(mapCompass: boolean): void
  setMapScale(mapScale: boolean): void
  setMapNightStart(mapNightStart: number): void
  setMapPins(mapPins: MapPinStyle): void
  setMapPinFuel(mapPinFuel: boolean): void
  setMapPinParking(mapPinParking: boolean): void
  setMapPinService(mapPinService: boolean): void
  setUiSounds(uiSounds: boolean): void
  setUiSoundVolume(uiSoundVolume: number): void
  setMapDetail(detail: MapDetail): void
  setMapNight(on: boolean): void
  setMapJunction(on: boolean): void
  setMapTrucks(on: boolean): void
  setMapTraffic(on: boolean): void
  /** How far around the truck traffic is drawn without a route, metres (`0`: only on a route). */
  setMapTrafficAround(metres: number): void
  setMapRecentre(seconds: MapRecentre): void
  /** One band of the curve, set in Settings › Equalizer (choosing Custom): played by every player, and kept with
   * WestPlay's settings. */
  setEqualizerBand(band: keyof Equalizer, db: number): void
  /** Custom (the curve plays) or Recommended (flat), the curve kept either way. */
  chooseEqualizer(custom: boolean): void
  /** The curve flat again. */
  resetEqualizer(): void
  setOemMode(mode: OemMode): void
  /** The player's choice, in Settings: applied, and kept with WestPlay's settings. */
  chooseOemMode(mode: OemMode): void
  powerEvent(event: PowerEvent): void
  /** Kept for the shell's hand-over pieces: whatever is asked, Cabin Play stays up (`truckScreen` false). */
  setTruckScreen(shown: boolean): void
}

/** What survives a restart of the app: where you were and your choices, never the power state. */
type Persisted = Pick<
  CabinState,
  | 'navigation'
  | 'appearanceMode'
  | 'wallpaperId'
  | 'dashboardWidgets'
  | 'clock'
  | 'albumArt'
  | 'textSize'
  | 'reduceMotion'
  | 'diagnosticsPage'
  | 'dashboardOrder'
  | 'autoOrder'
  | 'homeOrder'
  | 'homeHidden'
  | 'pinnedApps'
  | 'mapDetail'
  | 'mapNight'
  | 'mapJunction'
  | 'mapTrucks'
  | 'mapTraffic'
  | 'mapTrafficAround'
  | 'mapRecentre'
  | 'mapRoute'
  | 'mapWeight'
  | 'mapNorth'
  | 'mapMarker'
  | 'mapMarkerSize'
  | 'mapLimit'
  | 'mapOver'
  | 'mapCompass'
  | 'mapScale'
  | 'mapNightStart'
  | 'mapPins'
  | 'mapPinFuel'
  | 'mapPinParking'
  | 'mapPinService'
  | 'uiSounds'
  | 'uiSoundVolume'
>

/** Whether the PC asks for reduced motion (Windows' Animation effects off): the first-run default. */
const SYSTEM_REDUCES_MOTION = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches

/** The Dashboard's own order for a new player, top to bottom: the four the drive reads first, then the two it
 * starts with turned off (the lifetime totals and the weather), where they'd sit if switched on. */
const DEFAULT_WIDGET_ORDER: DashboardWidget[] = [
  'nowPlaying',
  'destination',
  'driverHours',
  'diagnostics',
  'driver',
  'weather',
]

/** A saved order, made whole: every widget once, in the order saved, any the save doesn't know about after them.
 * An older save's Job widget is the destination card now: it keeps the place that card had. */
function orderOf(saved: unknown): DashboardWidget[] {
  const kept = (Array.isArray(saved) ? saved : [])
    .map((id) => (id === 'job' ? 'destination' : id))
    .filter((id): id is DashboardWidget => DASHBOARD_WIDGETS.includes(id as DashboardWidget))
  return [...new Set(kept), ...DASHBOARD_WIDGETS.filter((id) => !kept.includes(id))]
}

/**
 * The widgets a new player starts with: what plays, where it's going, the rest clocks and the engine's readings.
 * The Driver card's lifetime totals and the weather are turned on in Settings › Dashboard when wanted: a column of
 * six cards was more than could be read on the move (owner 2026-11-04).
 */
const STARTER_WIDGETS: Record<DashboardWidget, boolean> = {
  nowPlaying: true,
  destination: true,
  driverHours: true,
  diagnostics: true,
  driver: false,
  weather: false,
}

/** Whether a saved column was the old default (every widget on): a player who never chose gets the leaner one. */
function wasEveryWidgetOn(saved: unknown): boolean {
  if (typeof saved !== 'object' || saved === null) return false
  return DASHBOARD_WIDGETS.every((widget) => (saved as Record<string, unknown>)[widget] !== false)
}

export const useCabin = create<CabinState>()(
  persist(
    (set) => ({
      navigation: INITIAL_NAVIGATION,
      appearanceMode: 'auto',
      wallpaperId: DEFAULT_WALLPAPER_ID,
      dashboardWidgets: { ...STARTER_WIDGETS },
      clock: 'real',
      albumArt: true,
      textSize: DEFAULT_TEXT_SIZE,
      reduceMotion: SYSTEM_REDUCES_MOTION,
      diagnosticsPage: 'overview',
      dashboardOrder: DEFAULT_WIDGET_ORDER,
      autoOrder: true,
      homeOrder: [...RELEASED_APP_IDS],
      homeHidden: [],
      pinnedApps: [],
      // Balanced: the buildings still, a little less often than the game, for the PCs that share its GPU.
      mapDetail: 'balanced',
      mapNight: true,
      mapJunction: true,
      mapTrucks: true,
      mapTraffic: true,
      mapTrafficAround: 3000,
      mapRecentre: 15,
      mapRoute: 'blue',
      mapWeight: 'standard',
      mapNorth: false,
      mapMarker: 'arrow',
      mapMarkerSize: 'medium',
      mapLimit: true,
      mapOver: true,
      mapCompass: true,
      mapScale: false,
      mapNightStart: 20,
      mapPins: 'filled',
      mapPinFuel: true,
      mapPinParking: true,
      mapPinService: true,
      uiSounds: true,
      uiSoundVolume: 1,
      oemMode: 'auto',
      equalizer: FLAT,
      equalizerCustom: false,
      power: INITIAL_POWER,
      navigate: (action) => set((state) => ({ navigation: navigate(state.navigation, action) })),
      setAppearanceMode: (appearanceMode) => set({ appearanceMode }),
      setWallpaper: (id) => {
        set({ wallpaperId: id })
        // Kept with WestPlay's settings, where the companion's Customize sees it.
        if (isInHost()) postToHost({ type: 'wallpaper', id })
      },
      setDashboardWidget: (widget, shown) =>
        set((state) => ({ dashboardWidgets: { ...state.dashboardWidgets, [widget]: shown } })),
      setClock: (clock) => set({ clock }),
      setAlbumArt: (albumArt) => set({ albumArt }),
      setTextSize: (step) => set({ textSize: toTextSize(step) }),
      setReduceMotion: (reduceMotion) => set({ reduceMotion }),
      setDiagnosticsPage: (diagnosticsPage) => set({ diagnosticsPage }),
      setAutoOrder: (autoOrder) => set({ autoOrder }),
      moveWidget: (widget, by) =>
        set((state) => {
          const from = state.dashboardOrder.indexOf(widget)
          const to = Math.min(state.dashboardOrder.length - 1, Math.max(0, from + by))
          if (from < 0 || to === from) return {}
          const dashboardOrder = [...state.dashboardOrder]
          dashboardOrder.splice(from, 1)
          dashboardOrder.splice(to, 0, widget)
          return { dashboardOrder }
        }),
      setHomeAppHidden: (app, hidden) =>
        set((state) => {
          if (!hidden) return { homeHidden: state.homeHidden.filter((each) => each !== app) }
          const homeHidden = hiddenHomeApps([...state.homeHidden, app])
          // The last app stays: Home with nothing on it couldn't open Settings again.
          if (visibleHomeApps(state.homeOrder, homeHidden).length === 0) return {}
          return { homeHidden }
        }),
      moveHomeApp: (app, by) =>
        set((state) => {
          const from = state.homeOrder.indexOf(app)
          const to = Math.min(state.homeOrder.length - 1, Math.max(0, from + by))
          if (from < 0 || to === from) return {}
          const homeOrder = [...state.homeOrder]
          homeOrder.splice(from, 1)
          homeOrder.splice(to, 0, app)
          return { homeOrder }
        }),
      setPinnedApp: (app, pinned) =>
        set((state) => ({
          pinnedApps: pinned
            ? pinnedAppsOf([...state.pinnedApps, app])
            : state.pinnedApps.filter((each) => each !== app),
        })),
      resetHomeScreen: () => set({ homeOrder: [...RELEASED_APP_IDS], homeHidden: [], pinnedApps: [] }),
      setMapDetail: (mapDetail) => set({ mapDetail }),
      setMapNight: (mapNight) => set({ mapNight }),
      setMapJunction: (mapJunction) => set({ mapJunction }),
      setMapTrucks: (mapTrucks) => set({ mapTrucks }),
      setMapTraffic: (mapTraffic) => set({ mapTraffic }),
      setMapTrafficAround: (mapTrafficAround) => set({ mapTrafficAround }),
      setMapRecentre: (mapRecentre) => set({ mapRecentre }),
      setMapRoute: (mapRoute) => set({ mapRoute }),
      setMapWeight: (mapWeight) => set({ mapWeight }),
      setMapNorth: (mapNorth) => set({ mapNorth }),
      setMapMarker: (mapMarker) => set({ mapMarker }),
      setMapMarkerSize: (mapMarkerSize) => set({ mapMarkerSize }),
      setMapLimit: (mapLimit) => set({ mapLimit }),
      setMapOver: (mapOver) => set({ mapOver }),
      setMapCompass: (mapCompass) => set({ mapCompass }),
      setMapScale: (mapScale) => set({ mapScale }),
      setMapNightStart: (mapNightStart) => set({ mapNightStart }),
      setMapPins: (mapPins) => set({ mapPins }),
      setMapPinFuel: (mapPinFuel) => set({ mapPinFuel }),
      setMapPinParking: (mapPinParking) => set({ mapPinParking }),
      setMapPinService: (mapPinService) => set({ mapPinService }),
      setUiSounds: (uiSounds) => set({ uiSounds }),
      setUiSoundVolume: (uiSoundVolume) => set({ uiSoundVolume: Math.max(0, Math.min(1, uiSoundVolume)) }),
      setEqualizerBand: (band, db) => {
        const equalizer = toEqualizer({ ...useCabin.getState().equalizer, [band]: db })
        set({ equalizer, equalizerCustom: true })
        if (isInHost()) postToHost({ type: 'equalizer', custom: true, ...equalizer })
      },
      chooseEqualizer: (custom) => {
        set({ equalizerCustom: custom })
        if (isInHost()) postToHost({ type: 'equalizer', custom, ...useCabin.getState().equalizer })
      },
      resetEqualizer: () => {
        set({ equalizer: FLAT })
        if (isInHost()) postToHost({ type: 'equalizer', custom: useCabin.getState().equalizerCustom, ...FLAT })
      },
      setOemMode: (oemMode) => set({ oemMode }),
      chooseOemMode: (oemMode) => {
        set({ oemMode })
        if (isInHost()) postToHost({ type: 'truckStrip', strip: oemMode })
      },
      powerEvent: (event) =>
        set((state) => {
          const next = power(state.power, event)
          return { power: next, truckScreen: next.phase === 'off' ? false : state.truckScreen }
        }),
      resumeCabin: false,
      truckScreen: false,
      // Cabin Play is never handed back to the truck's own screen (owner 2026-11-04): once it's up it stays on the
      // screen until the electrics go off. Whatever asks it closed — the companion's switch, the game — is refused
      // here, so no press and no message can take it away. (The shell's hand-over pieces stay for the day that
      // changes; the state they answer to can't be reached.)
      setTruckScreen: (_shown: boolean) => set({ truckScreen: false }),
    }),
    {
      // The onboarding's demo keeps its own: it never changes the player's.
      name: IS_DEMO ? 'westplay.cabin.demo' : 'westplay.cabin',
      // 2: Text Size's steps moved larger (2026-10-24): a step kept from before means another size now, so each
      // player starts on the new default. 3: two smaller steps added below them (the same day): a step kept is the
      // same size two steps further on. 4: the Dashboard opened with six cards, too many to read on the move, so its
      // default column is four now (the players who never chose their own get it). 5: the cab keeps the screen and app
      // it was in only when the companion's switch says to (2026-11-04).
      version: 5,
      migrate: (stored, version) => {
        const kept = (stored ?? {}) as Partial<Persisted>
        let next = kept
        if (version < 2) next = { ...next, textSize: DEFAULT_TEXT_SIZE }
        else if (version < 3 && typeof next.textSize === 'number') {
          next = { ...next, textSize: next.textSize + STEPS_ADDED_BELOW }
        }
        if (version < 4 && wasEveryWidgetOn(next.dashboardWidgets)) {
          next = { ...next, dashboardWidgets: { ...STARTER_WIDGETS } }
        }
        // A session saved before the switch existed is let go of: every cab opens on the Dashboard.
        if (version < 5) next = { ...next, navigation: INITIAL_NAVIGATION }
        return next
      },
      storage: createJSONStorage(() => localStorage),
      partialize: (state): Persisted => ({
        // The screen and app the player was in, only when the companion's switch says the cab resumes: otherwise a
        // fresh session is kept, so every launch opens on the Dashboard.
        navigation: state.resumeCabin ? state.navigation : INITIAL_NAVIGATION,
        appearanceMode: state.appearanceMode,
        wallpaperId: state.wallpaperId,
        dashboardWidgets: state.dashboardWidgets,
        clock: state.clock,
        albumArt: state.albumArt,
        textSize: state.textSize,
        reduceMotion: state.reduceMotion,
        diagnosticsPage: state.diagnosticsPage,
        dashboardOrder: state.dashboardOrder,
        autoOrder: state.autoOrder,
        homeOrder: state.homeOrder,
        homeHidden: state.homeHidden,
        pinnedApps: state.pinnedApps,
        mapDetail: state.mapDetail,
        mapNight: state.mapNight,
        mapJunction: state.mapJunction,
        mapTrucks: state.mapTrucks,
        mapTraffic: state.mapTraffic,
        mapTrafficAround: state.mapTrafficAround,
        mapRecentre: state.mapRecentre,
        mapRoute: state.mapRoute,
        mapWeight: state.mapWeight,
        mapNorth: state.mapNorth,
        mapMarker: state.mapMarker,
        mapMarkerSize: state.mapMarkerSize,
        mapLimit: state.mapLimit,
        mapOver: state.mapOver,
        mapCompass: state.mapCompass,
        mapScale: state.mapScale,
        mapNightStart: state.mapNightStart,
        mapPins: state.mapPins,
        mapPinFuel: state.mapPinFuel,
        mapPinParking: state.mapPinParking,
        mapPinService: state.mapPinService,
        uiSounds: state.uiSounds,
        uiSoundVolume: state.uiSoundVolume,
      }),
      // Stored data comes from an earlier version of WestPlay (or was edited): keep only what is valid.
      merge: (stored, current) => ({ ...current, ...sanitize(stored as Partial<Persisted> | undefined) }),
    },
  ),
)

function sanitize(stored: Partial<Persisted> | undefined): Partial<Persisted> {
  if (!stored) return {}
  const result: Partial<Persisted> = {}
  if (stored.navigation && isRoute(stored.navigation.route) && Array.isArray(stored.navigation.recents)) {
    const { route, recents, base } = stored.navigation
    result.navigation = {
      route,
      recents: recents.filter(isReleasedApp),
      // Saved before WestPlay remembered it: the screen shown, or the Dashboard (where it starts).
      base: base === 'home' || base === 'dashboard' ? base : route.kind === 'home' ? 'home' : 'dashboard',
    }
  }
  if (stored.appearanceMode === 'auto' || stored.appearanceMode === 'dark' || stored.appearanceMode === 'light') {
    result.appearanceMode = stored.appearanceMode
  }
  // Any id: one of the player's wallpapers is only known once the host lists them (one gone shows the default).
  if (typeof stored.wallpaperId === 'string') result.wallpaperId = stored.wallpaperId
  if (typeof stored.dashboardWidgets === 'object' && stored.dashboardWidgets !== null) {
    const widgets = stored.dashboardWidgets as Partial<Record<DashboardWidget, unknown>> & { job?: unknown }
    // The Job and Destination cards are one now: it's shown if either of them was.
    const destination = widgets.destination !== false || (widgets.job !== undefined && widgets.job !== false)
    result.dashboardWidgets = Object.fromEntries(
      DASHBOARD_WIDGETS.map((widget) => [widget, widget === 'destination' ? destination : widgets[widget] !== false]),
    ) as Record<DashboardWidget, boolean>
  }
  if (stored.clock === 'game' || stored.clock === 'real') result.clock = stored.clock
  if (typeof stored.albumArt === 'boolean') result.albumArt = stored.albumArt
  if (stored.textSize !== undefined) result.textSize = toTextSize(stored.textSize)
  if (typeof stored.reduceMotion === 'boolean') result.reduceMotion = stored.reduceMotion
  if (DIAGNOSTICS_PAGES.includes(stored.diagnosticsPage as DiagnosticsPage)) {
    result.diagnosticsPage = stored.diagnosticsPage
  }
  if (stored.dashboardOrder !== undefined) result.dashboardOrder = orderOf(stored.dashboardOrder)
  if (typeof stored.autoOrder === 'boolean') result.autoOrder = stored.autoOrder
  if (stored.homeOrder !== undefined) result.homeOrder = homeOrderOf(stored.homeOrder)
  if (stored.homeHidden !== undefined) result.homeHidden = hiddenHomeApps(stored.homeHidden)
  if (stored.pinnedApps !== undefined) result.pinnedApps = pinnedAppsOf(stored.pinnedApps)
  if (MAP_DETAILS.includes(stored.mapDetail as MapDetail)) result.mapDetail = stored.mapDetail
  if (typeof stored.mapNight === 'boolean') result.mapNight = stored.mapNight
  if (typeof stored.mapJunction === 'boolean') result.mapJunction = stored.mapJunction
  if (typeof stored.mapTrucks === 'boolean') result.mapTrucks = stored.mapTrucks
  if (typeof stored.mapTraffic === 'boolean') result.mapTraffic = stored.mapTraffic
  if (MAP_TRAFFIC_AROUND.includes(stored.mapTrafficAround as number)) {
    result.mapTrafficAround = stored.mapTrafficAround as number
  }
  if (MAP_RECENTRES.includes(stored.mapRecentre as MapRecentre)) result.mapRecentre = stored.mapRecentre
  if (MAP_ROUTE_COLOURS.includes(stored.mapRoute as MapRouteColour)) result.mapRoute = stored.mapRoute as MapRouteColour
  if (MAP_ROUTE_WEIGHTS.includes(stored.mapWeight as MapRouteWeight)) {
    result.mapWeight = stored.mapWeight as MapRouteWeight
  }
  if (typeof stored.mapNorth === 'boolean') result.mapNorth = stored.mapNorth
  if (MAP_MARKERS.includes(stored.mapMarker as MapMarker)) result.mapMarker = stored.mapMarker as MapMarker
  if (MAP_MARKER_SIZES.includes(stored.mapMarkerSize as MapMarkerSize)) {
    result.mapMarkerSize = stored.mapMarkerSize as MapMarkerSize
  }
  if (typeof stored.mapLimit === 'boolean') result.mapLimit = stored.mapLimit
  if (typeof stored.mapOver === 'boolean') result.mapOver = stored.mapOver
  if (typeof stored.mapCompass === 'boolean') result.mapCompass = stored.mapCompass
  if (typeof stored.mapScale === 'boolean') result.mapScale = stored.mapScale
  if (MAP_NIGHT_STARTS.includes(stored.mapNightStart as number)) result.mapNightStart = stored.mapNightStart as number
  if (MAP_PIN_STYLES.includes(stored.mapPins as MapPinStyle)) result.mapPins = stored.mapPins as MapPinStyle
  if (typeof stored.mapPinFuel === 'boolean') result.mapPinFuel = stored.mapPinFuel
  if (typeof stored.mapPinParking === 'boolean') result.mapPinParking = stored.mapPinParking
  if (typeof stored.mapPinService === 'boolean') result.mapPinService = stored.mapPinService
  if (typeof stored.uiSounds === 'boolean') result.uiSounds = stored.uiSounds
  if (typeof stored.uiSoundVolume === 'number' && Number.isFinite(stored.uiSoundVolume)) {
    result.uiSoundVolume = Math.max(0, Math.min(1, stored.uiSoundVolume))
  }
  return result
}

function isRoute(route: unknown): route is Route {
  if (typeof route !== 'object' || route === null) return false
  const { kind, app } = route as { kind?: unknown; app?: unknown }
  return kind === 'home' || kind === 'dashboard' || (kind === 'app' && isReleasedApp(app))
}

/** Live data from the game. */
export interface LiveState {
  telemetry: Telemetry | null
  truck: TruckInfo | null
  /** The player's job (`null`: none). */
  job: JobInfo | null
  /** The trailer under the truck (`null`: none hitched). */
  trailer: TrailerInfo | null
  /** Lifetime statistics read from the profile's latest game save. */
  career: CareerStats | null
  /** The kind of screen the game draws WestPlay on; `null` until it has drawn one. */
  screenLayout: ScreenLayoutId | null
  /** The cities whose garages the player owns, and their headquarters' (none until the host has read their
   * save). */
  ownedGarages: string[]
  headquarters: string | null
  /** The player plays on a map by HVT, which WestPlay doesn't allow: the game's language to say so in.
   * `null`: not (or not known yet). */
  hvtMap: { language: string | null } | null
  /** The game's language (its `g_lang_init`, e.g. `tr_tr`; `null` until the host has read it). */
  gameLanguage: string | null
  /** The player's profile has the game's time zones on (its `g_time_zones`): the clock is the time where
   * the truck is (state/timeZone.ts). */
  timeZones: boolean
  /** How far the clock where the truck is runs from the game's time, minutes: its country's time zone with
   * the profile's time zones on, else 0 (state/timeZone.ts). Every clock shown adds it (`cabClock`). */
  clockShift: number
  /** The route the game's GPS plans (`null`: none): its map nodes, each one's distance left to the
   * destination (as the game counts distances), the ways through its junctions and the turns there (by the
   * node each starts at, once the host has found them), how far right of its way it runs at its nodes on
   * roads (on the carriageway it drives on), and the node ahead of the truck along it. */
  route: {
    id: number
    nodes: RouteNode[]
    distances: number[]
    paths: ReadonlyMap<number, Point[]>
    maneuvers: Maneuver[]
    shifts: ReadonlyMap<number, number>
  } | null
  routeNext: number
  /** The player's stops along the route: their map nodes' indices in it, ascending. */
  routeStops: readonly number[]
  /** The game's weather (`null`: not known). */
  weather: GameWeather | null
  /** Whether the game's window shows, in front or not (no game: as if it did). */
  gameShown: boolean
  /** The game's menu gone while it's still paused (the music comes back then, not 1.5 s later). */
  menuGone: boolean
  /** The keybind last pressed in the game, and how many so far (each press a new one). */
  keybind: { action: KeybindAction; count: number } | null
  /** Whether the game runs under TruckersMP. */
  truckersmp: boolean
  /** Under TruckersMP, the players around the player from its SDK, as the host last said (`null`: none). */
  nearby: Nearby | null
  /** The music's spectrum as the host last said it (Settings › Equalizer's, `HostMessage` `spectrum`). */
  spectrum: readonly number[]
  /** The host draws the screen's cursor (`cursor` message): the page draws none of its own then. */
  cursorByHost: boolean
  /** Whether the game's camera is outside the cab: everything CabinPlay plays is the cab's, heard in it only. */
  outsideCab: boolean
}

/** TruckersMP's players around the player, from its SDK: its game server's id, the player's own number on it,
 * the others (number, world x and z, heading in turns), and when it came (page clock, ms). */
export interface Nearby {
  server: number
  local: number
  players: [id: number, x: number, z: number, heading: number][]
  at: number
}

export const useLive = create<LiveState>()(() => ({
  telemetry: null,
  truck: previewTruck(),
  job: null,
  trailer: null,
  career: null,
  screenLayout: previewLayout(),
  ownedGarages: [],
  headquarters: null,
  hvtMap: null,
  gameLanguage: null,
  timeZones: false,
  clockShift: 0,
  route: null,
  routeNext: 0,
  routeStops: [],
  weather: null,
  gameShown: true,
  menuGone: false,
  keybind: null,
  truckersmp: false,
  nearby: null,
  spectrum: [],
  cursorByHost: false,
  outsideCab: false,
}))

/** Plain browser previews have no game to report the screen: `?layout=scania-2025` stands in for it. */
/** In a browser, `?truck=scania.s_2016` drives that truck (its screen profile). */
function previewTruck(): TruckInfo | null {
  if (isInHost()) return null
  const model = new URLSearchParams(location.search).get('truck')
  if (!model) return null
  const brandId = model.split('.')[0]
  return {
    brandId,
    brand: brandId,
    id: `vehicle.${model}`,
    name: model,
    fuelCapacity: 0,
    fuelWarningFactor: 0,
    retarderSteps: 0,
  }
}

function previewLayout(): ScreenLayoutId | null {
  if (isInHost()) return null
  const layout = new URLSearchParams(location.search).get('layout')
  return isScreenLayoutId(layout) ? layout : null
}

/** Whether the companion's resume switch was heard this launch (`null`: not yet). The session kept from the last
 * launch is used only if the switch says so, and dropped the first time it's heard off. */
let resumeHeard: boolean | null = null

/**
 * Feeds host messages into the stores, and tells the host whether WestPlay is open on the truck's screen
 * (as the page connects, and whenever it opens or closes). Returns the unsubscribe function; call once at
 * startup. The power sequence follows the truck's electrics (and only changes when they change).
 */
export function connectHost(now: () => number = () => performance.now()): () => void {
  const stopMessages = subscribeHostMessages(receiveHostMessage(now))
  const report = () => postToHost({ type: 'westplay', open: !useCabin.getState().truckScreen })
  report()
  const stopReports = useCabin.subscribe((state, previous) => {
    if (state.truckScreen !== previous.truckScreen) report()
  })
  // The field selected, for the player's own keyboard to type into (the host passes it to the game plugin).
  const reportSelection = () => postToHost({ type: 'typing', selection: useKeyboard.getState().selection })
  reportSelection()
  const stopSelections = useKeyboard.subscribe((state, previous) => {
    if (state.selection !== previous.selection) reportSelection()
  })
  return () => {
    stopMessages()
    stopReports()
    stopSelections()
  }
}

function receiveHostMessage(now: () => number): (message: HostMessage) => void {
  return (message) => {
    switch (message.type) {
      case 'telemetry': {
        const previous = useLive.getState().telemetry
        useLive.setState({ telemetry: message.data })
        if (previous?.electricEnabled !== message.data.electricEnabled) {
          // The tablet isn't the truck's screen: no brand as it starts.
          const truckScreen = useLive.getState().screenLayout !== 'tablet'
          useCabin
            .getState()
            .powerEvent({ type: 'electrics', on: message.data.electricEnabled, at: now(), truckScreen })
        }
        break
      }
      case 'truck':
        useLive.setState({ truck: hasTruck(message.data) ? message.data : null })
        break
      case 'job':
        useLive.setState({ job: message.data.active ? message.data : null })
        break
      case 'trailer':
        useLive.setState({ trailer: message.data.attached ? message.data : null })
        break
      case 'career':
        useLive.setState({ career: message.data })
        break
      case 'garages':
        useLive.setState({ ownedGarages: message.owned, headquarters: message.headquarters })
        break
      case 'routeAnswer':
        receiveRouteAnswer(message.id, message.answer)
        break
      case 'routes':
        receiveRoutes(message.id, message.routes)
        break
      case 'followed':
        receiveFollowed(message.id, message.follows, message.answer)
        break
      case 'detours':
        receiveDetours(message.id, message.seconds)
        break
      case 'typed':
        for (const event of message.events) useKeyboard.getState().typed(event)
        break
      case 'typingState':
        useKeyboard.setState({ physical: message.state })
        break
      case 'mapBlock':
        useLive.setState({
          hvtMap: message.hvt ? { language: message.language } : null,
          gameLanguage: message.language,
        })
        break
      case 'timeZones':
        useLive.setState({ timeZones: message.on })
        break
      case 'route':
        useLive.setState({
          route:
            message.id === null || message.nodes === null
              ? null
              : {
                  id: message.id,
                  nodes: message.nodes.map(([x, z, fx, fz]) => ({ position: [x, z], forward: [fx, fz] })),
                  distances: message.nodes.map((node) => node[4]),
                  paths: new Map(),
                  maneuvers: [],
                  shifts: new Map(),
                },
          routeNext: 0,
          routeStops: [],
        })
        break
      case 'routeStops':
        if (useLive.getState().route?.id === message.id) useLive.setState({ routeStops: message.stops })
        break
      case 'routePaths': {
        const route = useLive.getState().route
        if (route?.id !== message.id) break
        const maneuvers = message.maneuvers.map(([node, turn, angle, exit]) => ({
          node,
          turn: turn as TurnKind,
          angle,
          exit,
        }))
        const shifts = new Map(message.shifts ?? [])
        useLive.setState({ route: { ...route, paths: new Map(message.paths), maneuvers, shifts } })
        break
      }
      case 'routeNext':
        useLive.setState({ routeNext: message.next })
        break
      case 'weather':
        useLive.setState({ weather: message.weather })
        break
      case 'screen':
        // A layout this UI doesn't know yet (newer plugin) is treated like a screen without a profile.
        useLive.setState({ screenLayout: isScreenLayoutId(message.layout) ? message.layout : null })
        break
      case 'camera':
        useLive.setState({ outsideCab: message.outside })
        break
      case 'settings': {
        const cabin = useCabin.getState()
        cabin.setOemMode(message.truckStrip === 'off' ? 'off' : 'auto')
        // The cabin's own session between launches: the screen and app kept from the last one are used only if the
        // companion's switch says to resume. Heard off, that session is let go of, once.
        const resume = message.resume === true
        if (resumeHeard === null) {
          resumeHeard = resume
          if (!resume) useCabin.setState({ navigation: INITIAL_NAVIGATION })
        }
        useCabin.setState({ resumeCabin: resume })
        if (message.wallpaper) useCabin.setState({ wallpaperId: message.wallpaper })
        // Chosen here before WestPlay kept it with its settings: kept now.
        else if (cabin.wallpaperId !== DEFAULT_WALLPAPER_ID) postToHost({ type: 'wallpaper', id: cabin.wallpaperId })
        useCabin.setState({
          equalizer: toEqualizer(message.equalizer),
          equalizerCustom: message.equalizerCustom === true,
        })
        setIcons({
          iconSet: message.iconSet ?? null,
          iconStyle: isIconStyle(message.iconStyle) ? message.iconStyle : 'auto',
        })
        break
      }
      case 'spectrum':
        useLive.setState({ spectrum: message.bars })
        break
      case 'cursor':
        useLive.setState({ cursorByHost: message.host })
        break
      case 'customize':
        useLooks.setState({ custom: { wallpapers: message.wallpapers, iconSets: message.iconSets } })
        break
      case 'radio':
        receiveRadioStations(message.stations)
        break
      case 'cabSound':
        receiveCabSound(message)
        break
      case 'westplay':
        // A close asked for goes nowhere: the cabin page owns that state, and it keeps Cabin Play up (see
        // `setTruckScreen`).
        useCabin.getState().setTruckScreen(!message.open)
        break
      case 'youtube':
        receiveState(message.state)
        break
      case 'gameShown':
        useLive.setState({ gameShown: message.shown })
        break
      case 'menuGone':
        useLive.setState({ menuGone: message.gone })
        break
      case 'keybind':
        useLive.setState((live) => ({ keybind: { action: message.action, count: (live.keybind?.count ?? 0) + 1 } }))
        break
      case 'truckersmp':
        useLive.setState({ truckersmp: message.on, ...(message.on ? {} : { nearby: null }) })
        break
      case 'nearby':
        useLive.setState({
          nearby:
            message.server === null || message.local === null
              ? null
              : { server: message.server, local: message.local, players: message.players, at: now() },
        })
        break
      case 'game':
        // The game closed: the screen goes off as with the truck's electrics (the kept apps go with it), and
        // the next game's first telemetry powers it on afresh.
        if (!message.running) {
          useLive.setState({ telemetry: null })
          useCabin.getState().powerEvent({ type: 'electrics', on: false, at: now() })
        }
        break
      case 'youtubeAccount':
        useYouTube.setState({ account: { signedIn: message.signedIn, avatar: message.avatar } })
        break
      case 'youtubeSignIn':
        useYouTube.setState({ signingIn: message.open })
        break
      case 'map':
        receiveMapFolder(message.folder, message.built)
        break
      case 'spotify':
        receiveSpotifyState(message.signedIn, message.playing, message.signingIn)
        break
      case 'spotifyAnswer':
        receiveSpotifyAnswer(message)
        break
      case 'spotifyPlayback':
        receivePlayback(message.playback)
        break
      case 'appleMusic':
        useAppleMusic.setState({
          signedIn: message.signedIn,
          playing: message.playing,
          signingIn: message.signingIn,
          avatar: message.avatar,
        })
        break
      case 'appleMusicAnswer':
        receiveAppleMusicAnswer(message)
        break
      case 'appleMusicPlayback':
        receiveAppleMusicPlayback(message.playback)
        break
      case 'youtubeMusic':
        receiveYouTubeMusicState(message)
        break
      case 'youtubeMusicAnswer':
        receiveYouTubeMusicAnswer(message)
        break
      case 'youtubeMusicPlayback':
        receiveYouTubeMusicPlayback(message.playback)
        break
      case 'youtubeAnswer': {
        const { type: _, id, ...answer } = message
        receiveAnswer(id, answer)
        break
      }
    }
  }
}

let latestNavigation = 0

/**
 * Navigates the way a player does, animated: an app grows out of the icon that opened it (`origin`) and
 * shrinks back into its Home or sidebar icon when it closes; Home and the Dashboard trade places
 * (state/launch.ts).
 *
 * Like a touchscreen, every press counts and the last one is what you see: a press during an animation
 * finishes it, presses overtaken by a later one apply at once, and the last one animates.
 */
export function go(action: NavigationAction, origin: LaunchOrigin | null = null): void {
  const id = ++latestNavigation
  afterRunningTransition(() => {
    const cabin = useCabin.getState()
    const before = cabin.navigation.route
    const after = navigate(cabin.navigation, action).route
    // Overtaken by a later press, nothing to change, or Home and the Dashboard trading places (animated live
    // by CabinApp's `Screens`): no View Transition.
    const betweenBases = before.kind !== 'app' && after.kind !== 'app'
    if (id !== latestNavigation || routeKey(after) === routeKey(before) || betweenBases) {
      cabin.navigate(action)
      return
    }
    animateNavigation(launchFor(before, after, origin), () => useCabin.getState().navigate(action))
  })
}
