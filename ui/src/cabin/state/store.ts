import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'
import {
  type CabinPower,
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
  type NowPlayingInfo,
  postToHost,
  subscribeHostMessages,
  type Telemetry,
  toEqualizer,
  type TrailerInfo,
  type TruckInfo,
} from '../../shared/host'
import { type ClockChoice, CLOCK_CHOICES, setActiveClock } from '../../shared/clock'
import { languageOf, STRINGS } from './strings'
import { setActiveUnits, type UnitSystem, type UnitsChoice, UNIT_SYSTEMS } from '../../shared/units'
import type { Maneuver, TurnKind } from '../maps/guidance'
import {
  receiveAnswer as receiveAppleMusicAnswer,
  receivePlayback as receiveAppleMusicPlayback,
  useAppleMusic,
} from '../apps/music/appleMusic'
import { receiveCabSound } from '../apps/radio/cabSound'
import { receivePhoneNotifications, receivePhoneState, usePhoneFailure } from '../apps/phone/phone'
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
import { STOP_CARD_FUEL_LEVELS, STOP_CARD_REST_MINUTES } from '../maps/nearbyStop'
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
  MAP_STYLES,
  MAP_TRAFFIC_AROUND,
  type MapMarker,
  type MapMarkerSize,
  type MapPinStyle,
  type MapRouteColour,
  type MapRouteWeight,
  type MapStyle,
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
import { CLUSTER_ACCENTS, type ClusterAccent } from '../cluster/accent'
import { isIconStyle, setIcons, useLooks } from './looks'
import { playVoiceAudio } from '../voice/audio'
import { receiveVoice, receiveVoiceHotkey } from '../voice/voice'
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

/** How much of the Dashboard column a widget takes (Settings › Dashboard): compact gives room to its neighbours,
 * expanded keeps more of it. */
export type DashboardWidgetSize = 'compact' | 'standard' | 'expanded'

export const DASHBOARD_WIDGET_SIZES: readonly DashboardWidgetSize[] = ['compact', 'standard', 'expanded']

/** Theme preset identifiers. */
export type ThemePresetId = 'midnight' | 'sunrise' | 'forest' | 'ocean' | 'ember'

export const THEME_PRESETS: readonly ThemePresetId[] = ['midnight', 'sunrise', 'forest', 'ocean', 'ember']

/** A theme preset: accent color, appearance mode, and optional wallpaper hint. */
export interface ThemePreset {
  id: ThemePresetId
  accentColor: string
  appearanceMode: 'dark' | 'light'
}

/** Pre-built theme combinations. */
export const THEME_PRESET_DEFINITIONS: Record<ThemePresetId, ThemePreset> = {
  midnight: { id: 'midnight', accentColor: '#5e81ac', appearanceMode: 'dark' },
  sunrise: { id: 'sunrise', accentColor: '#d08770', appearanceMode: 'light' },
  forest: { id: 'forest', accentColor: '#a3be8c', appearanceMode: 'dark' },
  ocean: { id: 'ocean', accentColor: '#88c0d0', appearanceMode: 'dark' },
  ember: { id: 'ember', accentColor: '#bf616a', appearanceMode: 'dark' },
}

/** A driver profile: keeps its own settings snapshot. */
export interface DriverProfile {
  id: string
  name: string
  /** A profile picture as a data URL; empty when none is set. */
  picture?: string
  /** Cabin settings snapshot, saved on profile switch. */
  settingsSnapshot?: Record<string, unknown>
}

/** Cabin settings fields that are saved per profile (excluding runtime state like power, telemetry). */
export interface ProfileSnapshot extends Record<string, unknown> {
  appearanceMode: string
  wallpaperId: string
  accentColor: string
  textSize: number
  reduceMotion: boolean
  dashboardWidgets: Record<string, boolean>
  dashboardWidgetSizes: Record<string, string>
  dashboardOrder: string[]
  autoOrder: boolean
  savedDashboardLayouts: unknown[]
  overviewShown: boolean
  overviewDefault: boolean
  overviewCards: Record<string, boolean>
  clusterShown: boolean
  clusterCards: Record<string, boolean>
  clusterGaugePercent: boolean
  clusterAccent: string
  clusterTacho: boolean
  clusterBrand: boolean
  clusterReadings: string[]
  clusterLayout: unknown
  homeOrder: string[]
  homeHidden: string[]
  pinnedApps: string[]
  navigation: unknown
  diagnosticsPage: string
  mapDetail: string
  mapNight: boolean
  mapJunction: boolean
  mapTrucks: boolean
  mapTraffic: boolean
  mapTrafficAround: number
  mapRecentre: unknown
  mapRoute: unknown
  mapWeight: unknown
  mapNorth: boolean
  mapMarker: unknown
  mapMarkerSize: unknown
  mapLimit: boolean
  mapOver: boolean
  mapCompass: boolean
  mapScale: boolean
  mapStyle: unknown
  mapNightStart: number
  mapPins: unknown
  mapPinFuel: boolean
  mapPinParking: boolean
  mapPinService: boolean
  mapStopCardAlways: boolean
  mapStopCardFuel: number
  mapStopCardRest: number
  clock: string
  units: string
  clockFormat: string
  albumArt: boolean
  uiSounds: boolean
  uiSoundVolume: number
  gpsDuck: boolean
  gpsDuckLead: unknown
  gpsVoiceOnScreen: boolean
}

/** Extract the current cabin state as a profile snapshot (only the per-profile fields). */
export function getProfileSnapshot(state: CabinState): ProfileSnapshot {
  return {
    appearanceMode: state.appearanceMode,
    wallpaperId: state.wallpaperId,
    accentColor: state.accentColor,
    textSize: state.textSize,
    reduceMotion: state.reduceMotion,
    dashboardWidgets: state.dashboardWidgets,
    dashboardWidgetSizes: state.dashboardWidgetSizes,
    dashboardOrder: state.dashboardOrder,
    autoOrder: state.autoOrder,
    savedDashboardLayouts: state.savedDashboardLayouts,
    overviewShown: state.overviewShown,
    overviewDefault: state.overviewDefault,
    overviewCards: state.overviewCards,
    clusterShown: state.clusterShown,
    clusterCards: state.clusterCards,
    clusterGaugePercent: state.clusterGaugePercent,
    clusterAccent: state.clusterAccent,
    clusterTacho: state.clusterTacho,
    clusterBrand: state.clusterBrand,
    clusterReadings: state.clusterReadings,
    clusterLayout: state.clusterLayout,
    homeOrder: state.homeOrder,
    homeHidden: state.homeHidden,
    pinnedApps: state.pinnedApps,
    navigation: state.navigation,
    diagnosticsPage: state.diagnosticsPage,
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
    mapStyle: state.mapStyle,
    mapNightStart: state.mapNightStart,
    mapPins: state.mapPins,
    mapPinFuel: state.mapPinFuel,
    mapPinParking: state.mapPinParking,
    mapPinService: state.mapPinService,
    mapStopCardAlways: state.mapStopCardAlways,
    mapStopCardFuel: state.mapStopCardFuel,
    mapStopCardRest: state.mapStopCardRest,
    clock: state.clock,
    units: state.units,
    clockFormat: state.clockFormat,
    albumArt: state.albumArt,
    uiSounds: state.uiSounds,
    uiSoundVolume: state.uiSoundVolume,
    gpsDuck: state.gpsDuck,
    gpsDuckLead: state.gpsDuckLead,
    gpsVoiceOnScreen: state.gpsVoiceOnScreen,
  }
}

/** Apply a profile snapshot to the current cabin state, restoring only known fields. */
export function applyProfileSnapshot(snapshot: Record<string, unknown>): Partial<CabinState> {
  const result: Partial<CabinState> = {}
  if (typeof snapshot.appearanceMode === 'string') result.appearanceMode = snapshot.appearanceMode as any
  if (typeof snapshot.wallpaperId === 'string') result.wallpaperId = snapshot.wallpaperId
  if (typeof snapshot.accentColor === 'string') result.accentColor = snapshot.accentColor
  if (typeof snapshot.textSize === 'number') result.textSize = snapshot.textSize
  if (typeof snapshot.reduceMotion === 'boolean') result.reduceMotion = snapshot.reduceMotion
  if (typeof snapshot.dashboardWidgets === 'object') result.dashboardWidgets = snapshot.dashboardWidgets as any
  if (typeof snapshot.dashboardWidgetSizes === 'object') result.dashboardWidgetSizes = snapshot.dashboardWidgetSizes as any
  if (Array.isArray(snapshot.dashboardOrder)) result.dashboardOrder = snapshot.dashboardOrder as any
  if (typeof snapshot.autoOrder === 'boolean') result.autoOrder = snapshot.autoOrder
  if (Array.isArray(snapshot.savedDashboardLayouts)) result.savedDashboardLayouts = snapshot.savedDashboardLayouts as any
  if (typeof snapshot.overviewShown === 'boolean') result.overviewShown = snapshot.overviewShown
  if (typeof snapshot.overviewDefault === 'boolean') result.overviewDefault = snapshot.overviewDefault
  if (typeof snapshot.overviewCards === 'object') result.overviewCards = snapshot.overviewCards as any
  if (typeof snapshot.clusterShown === 'boolean') result.clusterShown = snapshot.clusterShown
  if (typeof snapshot.clusterCards === 'object') result.clusterCards = snapshot.clusterCards as any
  if (typeof snapshot.clusterGaugePercent === 'boolean') result.clusterGaugePercent = snapshot.clusterGaugePercent
  if (typeof snapshot.clusterAccent === 'string') result.clusterAccent = snapshot.clusterAccent as any
  if (typeof snapshot.clusterTacho === 'boolean') result.clusterTacho = snapshot.clusterTacho
  if (typeof snapshot.clusterBrand === 'boolean') result.clusterBrand = snapshot.clusterBrand
  if (Array.isArray(snapshot.clusterReadings)) result.clusterReadings = snapshot.clusterReadings as any
  if (typeof snapshot.clusterLayout === 'object') result.clusterLayout = snapshot.clusterLayout as any
  if (Array.isArray(snapshot.homeOrder)) result.homeOrder = snapshot.homeOrder as any
  if (Array.isArray(snapshot.homeHidden)) result.homeHidden = snapshot.homeHidden as any
  if (Array.isArray(snapshot.pinnedApps)) result.pinnedApps = snapshot.pinnedApps as any
  if (typeof snapshot.navigation === 'object') result.navigation = snapshot.navigation as any
  if (typeof snapshot.diagnosticsPage === 'string') result.diagnosticsPage = snapshot.diagnosticsPage as any
  if (typeof snapshot.mapDetail === 'string') result.mapDetail = snapshot.mapDetail as any
  if (typeof snapshot.mapNight === 'boolean') result.mapNight = snapshot.mapNight
  if (typeof snapshot.mapJunction === 'boolean') result.mapJunction = snapshot.mapJunction
  if (typeof snapshot.mapTrucks === 'boolean') result.mapTrucks = snapshot.mapTrucks
  if (typeof snapshot.mapTraffic === 'boolean') result.mapTraffic = snapshot.mapTraffic
  if (typeof snapshot.mapTrafficAround === 'number') result.mapTrafficAround = snapshot.mapTrafficAround as any
  if (snapshot.mapRecentre !== undefined) result.mapRecentre = snapshot.mapRecentre as any
  if (snapshot.mapRoute !== undefined) result.mapRoute = snapshot.mapRoute as any
  if (snapshot.mapWeight !== undefined) result.mapWeight = snapshot.mapWeight as any
  if (typeof snapshot.mapNorth === 'boolean') result.mapNorth = snapshot.mapNorth
  if (snapshot.mapMarker !== undefined) result.mapMarker = snapshot.mapMarker as any
  if (snapshot.mapMarkerSize !== undefined) result.mapMarkerSize = snapshot.mapMarkerSize as any
  if (typeof snapshot.mapLimit === 'boolean') result.mapLimit = snapshot.mapLimit
  if (typeof snapshot.mapOver === 'boolean') result.mapOver = snapshot.mapOver
  if (typeof snapshot.mapCompass === 'boolean') result.mapCompass = snapshot.mapCompass
  if (typeof snapshot.mapScale === 'boolean') result.mapScale = snapshot.mapScale
  if (snapshot.mapStyle !== undefined) result.mapStyle = snapshot.mapStyle as any
  if (typeof snapshot.mapNightStart === 'number') result.mapNightStart = snapshot.mapNightStart as any
  if (snapshot.mapPins !== undefined) result.mapPins = snapshot.mapPins as any
  if (typeof snapshot.mapPinFuel === 'boolean') result.mapPinFuel = snapshot.mapPinFuel
  if (typeof snapshot.mapPinParking === 'boolean') result.mapPinParking = snapshot.mapPinParking
  if (typeof snapshot.mapPinService === 'boolean') result.mapPinService = snapshot.mapPinService
  if (typeof snapshot.mapStopCardAlways === 'boolean') result.mapStopCardAlways = snapshot.mapStopCardAlways
  if (typeof snapshot.mapStopCardFuel === 'number') result.mapStopCardFuel = snapshot.mapStopCardFuel as any
  if (typeof snapshot.mapStopCardRest === 'number') result.mapStopCardRest = snapshot.mapStopCardRest as any
  if (typeof snapshot.clock === 'string') result.clock = snapshot.clock as any
  if (typeof snapshot.units === 'string') result.units = snapshot.units as any
  if (typeof snapshot.clockFormat === 'string') result.clockFormat = snapshot.clockFormat as any
  if (typeof snapshot.albumArt === 'boolean') result.albumArt = snapshot.albumArt
  if (typeof snapshot.uiSounds === 'boolean') result.uiSounds = snapshot.uiSounds
  if (typeof snapshot.uiSoundVolume === 'number') result.uiSoundVolume = snapshot.uiSoundVolume
  if (typeof snapshot.gpsDuck === 'boolean') result.gpsDuck = snapshot.gpsDuck
  if (snapshot.gpsDuckLead !== undefined) result.gpsDuckLead = snapshot.gpsDuckLead as any
  if (typeof snapshot.gpsVoiceOnScreen === 'boolean') result.gpsVoiceOnScreen = snapshot.gpsVoiceOnScreen
  return result
}


/** The Overview screen's cards the player can turn off (Settings › Dashboard); the speed is always there. */
export type OverviewCard = 'trip' | 'truck' | 'hours' | 'media' | 'weather'

export const OVERVIEW_CARDS: readonly OverviewCard[] = ['trip', 'truck', 'hours', 'media', 'weather']

/** Every Overview card on until the player chooses otherwise. */
const STARTER_OVERVIEW_CARDS: Record<OverviewCard, boolean> = {
  trip: true,
  truck: true,
  hours: true,
  media: true,
  weather: true,
}

/** The instrument cluster's cards the player can turn off (Settings › Dashboard); the speed is always there. */
export type ClusterCard = 'trip' | 'fuel' | 'engine' | 'hours' | 'warnings'

export const CLUSTER_CARDS: readonly ClusterCard[] = ['trip', 'fuel', 'engine', 'hours', 'warnings']

const STARTER_CLUSTER_CARDS: Record<ClusterCard, boolean> = {
  trip: true,
  fuel: true,
  engine: true,
  hours: true,
  warnings: true,
}

/** The readings the cluster's engine card can show: three of the truck's gauges, in the player's own order
 * (Settings › Instrument Cluster). Every one is a reading the Diagnostics app already keeps, so the dash and the app
 * can't disagree about when something is wrong. */
export type ClusterReading =
  'oilTemperature' | 'coolant' | 'brakeAir' | 'battery' | 'adblue' | 'brakeTemperature' | 'consumption'

export const CLUSTER_READINGS: readonly ClusterReading[] = [
  'oilTemperature',
  'coolant',
  'brakeAir',
  'battery',
  'adblue',
  'brakeTemperature',
  'consumption',
]

/** The engine card's slots: three readings, as many as the dash has room for. */
export const CLUSTER_READING_SLOTS = 3

/** The cluster's cards that sit in one of its two side columns (Settings › Instrument Cluster): the trip computer,
 * the engine's readings, the driver's hours and the tank. The warning lamps stay in the status bar, where a driver
 * reads them first, and the dial is always the middle. */
export type ClusterSideCard = 'trip' | 'engine' | 'hours' | 'fuel'

export const CLUSTER_SIDE_CARDS: readonly ClusterSideCard[] = ['trip', 'engine', 'hours', 'fuel']

/** The cluster's two columns, by their side of the dial. */
export type ClusterSide = 'left' | 'right'

/** Which cards sit either side of the dial, and the order they run down each column. */
export interface ClusterLayout {
  left: ClusterSideCard[]
  right: ClusterSideCard[]
}

/** A ready-made layout (Settings › Instrument Cluster): the dash as tuned, the driver's clocks read first, and the
 * tank moved beside the trip computer. Each is drawn to fit the dash's own height: the right column carries one card
 * beside the tank's readings, which fill it, and the rest keep the left. */
export type ClusterLayoutPreset = 'standard' | 'hours' | 'tank'

export const CLUSTER_LAYOUT_PRESETS: readonly ClusterLayoutPreset[] = ['standard', 'hours', 'tank']

export const CLUSTER_LAYOUTS: Record<ClusterLayoutPreset, ClusterLayout> = {
  standard: { left: ['trip', 'engine', 'hours'], right: ['fuel'] },
  hours: { left: ['hours', 'trip', 'engine'], right: ['fuel'] },
  tank: { left: ['fuel', 'trip', 'engine'], right: ['hours'] },
}

/** The dash's own layout: the trip, the engine and the driver's hours down the left, the tank on the right. */
const STARTER_CLUSTER_LAYOUT: ClusterLayout = CLUSTER_LAYOUTS.standard

/** The readings a dash new from the box draws: the three the card carried before the slots were the player's to
 * choose. */
const STARTER_CLUSTER_READINGS: readonly ClusterReading[] = ['oilTemperature', 'brakeAir', 'battery']

/** A ready-made Dashboard column: its order, the widgets shown, and each one's size. */
export interface DashboardLayout {
  order: DashboardWidget[]
  widgets: Record<DashboardWidget, boolean>
  sizes: Record<DashboardWidget, DashboardWidgetSize>
}

/** The layouts offered in Settings › Dashboard's editor. */
export type DashboardLayoutPreset = 'focus' | 'media' | 'weather'

export const DASHBOARD_PRESETS: readonly DashboardLayoutPreset[] = ['focus', 'media', 'weather']

/** A saved layout's name is cut here: enough for a label in its card, not a line across it. */
export const DASHBOARD_LAYOUT_NAME_LENGTH = 32

/** A Dashboard layout the player named and kept (Settings › Dashboard). */
export interface SavedDashboardLayout {
  name: string
  layout: DashboardLayout
}

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

/**
 * How early the music dips under the game's GPS voice (Settings › GPS Voice): the road before a turn it covers first,
 * counted at the truck's own speed. The game chooses when its voice speaks, so this is a taste of how far ahead to
 * meet it — `just` at the mouth of the turn, `few` a few seconds out, `early` the whole approach.
 */
export type GpsDuckLead = 'just' | 'few' | 'early'

export const GPS_DUCK_LEADS: readonly GpsDuckLead[] = ['just', 'few', 'early']

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
  /** How much room each Dashboard widget keeps in the column (Settings, Dashboard): Now Playing's compact size
   * also gives it the one-line player. */
  dashboardWidgetSizes: Record<DashboardWidget, DashboardWidgetSize>
  /** Whether the Dashboard offers its Overview screen, whether it opens on it, and which of its cards show
   * (Settings › Dashboard). */
  overviewShown: boolean
  overviewDefault: boolean
  overviewCards: Record<OverviewCard, boolean>
  /** Whether WestPlay replaces the truck's instrument cluster, and which of its cards show (Settings ›
   * Dashboard). Only the trucks it is built for show one. */
  clusterShown: boolean
  clusterCards: Record<ClusterCard, boolean>
  /** Whether the cluster's level gauges read the share of the tank they hold — the fuel and the AdBlue, as a
   * percentage — instead of the litres in it (Settings › Instrument Cluster). A temperature or a rate has no
   * share of a scale to give: those keep their own figures either way. */
  clusterGaugePercent: boolean
  /** The accent the cluster draws its live marks in (Settings › Instrument Cluster): the route's own colour, Cabin
   * Play's, or the panel's ink. */
  clusterAccent: ClusterAccent
  /** Whether the cluster draws the tacho as a hairline outside the speed's ring (Settings › Instrument Cluster). */
  clusterTacho: boolean
  /** Whether the cluster draws the truck's maker's mark above the speed (Settings › Instrument Cluster). */
  clusterBrand: boolean
  /** The three readings on the cluster's engine card, in the order the card draws them (Settings › Instrument
   * Cluster). */
  clusterReadings: ClusterReading[]
  /** Which cards sit either side of the dial, and in what order (Settings › Instrument Cluster). */
  clusterLayout: ClusterLayout
  /** The sidebar's clock: the player's own time, or the game's (Settings, Dashboard). */
  clock: Clock
  /** The driver's units (Settings › Appearance › Units): the game's own regional setting, or one chosen here.
   * Every figure on the glass follows it (shared/units.ts). */
  units: UnitsChoice
  /** How the clocks read (Settings › Appearance › Clock): the game's own 24-hour switch, or one chosen here. Every
   * clock on the glass follows it (shared/clock.ts), the sidebar's own time included. */
  clockFormat: ClockChoice
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
  /** Whether the music dips while the game's GPS navigation voice speaks (Settings › GPS Voice; apps/ducks.ts). */
  gpsDuck: boolean
  /** How early that dip begins, in the road before the turn (Settings › GPS Voice; apps/ducks.ts). */
  gpsDuckLead: GpsDuckLead
  /** Whether the cabin marks the GPS voice on screen (Settings › GPS Voice): the screens glow at their edges
   * while it talks (Shell.tsx, ClusterScreen.tsx). The voice is the game's, so this is the cab's own sign for it. */
  gpsVoiceOnScreen: boolean
  /** The voice assistant's switch (Settings › Voice Assistant): its button and hotkey are off when false. */
  voiceEnabled: boolean
  /** The push-to-talk chord as the companion set it, for Settings to show. */
  voiceKey: string
  /** Whether the background wake phrase listens (Settings › Voice Assistant). */
  voiceWake: boolean
  /** The Diagnostics app's page last opened, so its tabs come back where the player left them. */
  diagnosticsPage: DiagnosticsPage
  /** The Dashboard's widgets in the order the player put them (Settings › Dashboard), and whether the cab orders
   * them itself (Auto order): by what the drive needs (widgetState.ts's `useWidgetOrder`). */
  dashboardOrder: DashboardWidget[]
  autoOrder: boolean
  /** The player's own named Dashboard layouts (Settings › Dashboard), newest last. */
  savedDashboardLayouts: SavedDashboardLayout[]
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
  mapStyle: MapStyle
  mapNightStart: number
  /** The map's pins: filled or outlined, and which kinds it shows. */
  mapPins: MapPinStyle
  mapPinFuel: boolean
  mapPinParking: boolean
  mapPinService: boolean
  /** The card under turn-by-turn (Settings › Maps): always on the map, or only as the tank or the driver's hours
   * run low. */
  mapStopCardAlways: boolean
  /** Below this share of the tank, percent. */
  mapStopCardFuel: number
  /** When the next rest is this close, minutes. */
  mapStopCardRest: number
  /** The truck's own strip: kept (`auto`) or not, as set in the companion window (the host sends it). */
  oemMode: OemMode
  /** The player's own tone curve (Settings › Equalizer), and whether it plays (Custom) or the speakers as tuned
   * (Recommended, flat): kept with WestPlay's settings, the host sends them. */
  equalizer: Equalizer
  equalizerCustom: boolean
  /** The cabin's accent color (Settings › Theme Presets): used for interactive elements and highlights. */
  accentColor: string
  /** Driver profiles (Settings › Profiles): each keeps its own settings. */
  profiles: DriverProfile[]
  currentProfileId: string
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
  setDashboardWidgetSize(widget: DashboardWidget, size: DashboardWidgetSize): void
  /** Turns the Overview screen on or off for the Dashboard, and whether the Dashboard opens on it. */
  setOverviewShown(shown: boolean): void
  setOverviewDefault(on: boolean): void
  /** Shows or hides one of the Overview's cards. */
  setOverviewCard(card: OverviewCard, shown: boolean): void
  /** The Overview page's choices back to how a new Dashboard comes. */
  resetOverview(): void
  setClusterShown(shown: boolean): void
  /** Shows or hides one of the instrument cluster's cards. */
  setClusterCard(card: ClusterCard, shown: boolean): void
  /** Reads the cluster's level gauges as percentages, or as the units they hold. */
  setClusterGaugePercent(on: boolean): void
  setClusterAccent(accent: ClusterAccent): void
  /** Shows or hides the tacho's ring round the speed's. */
  setClusterTacho(on: boolean): void
  /** Shows or hides the truck's maker's mark on the dial. */
  setClusterBrand(on: boolean): void
  /** Puts a reading in one of the engine card's slots: a reading already in another slot trades places with it. */
  setClusterReading(slot: number, reading: ClusterReading): void
  /** Moves a card up (`by` -1) or down (+1) its own column. */
  moveClusterCard(card: ClusterSideCard, by: number): void
  /** Puts a card in a column: at `index` there, or at the foot of it (a drop on the empty glass). */
  placeClusterCard(card: ClusterSideCard, side: ClusterSide, index?: number): void
  /** Drops a card before another in the order, or after it (`after`), on whichever side that card is. */
  moveClusterCardTo(card: ClusterSideCard, target: ClusterSideCard, after: boolean): void
  /** Applies one of the ready-made layouts. */
  applyClusterLayout(layout: ClusterLayout): void
  /** The Instrument Cluster page's choices back to how a new dash comes. */
  resetCluster(): void
  setClock(clock: Clock): void
  setUnits(units: UnitsChoice): void
  setClockFormat(clockFormat: ClockChoice): void
  setAlbumArt(shown: boolean): void
  setTextSize(step: number): void
  setReduceMotion(on: boolean): void
  setDiagnosticsPage(page: DiagnosticsPage): void
  setAutoOrder(on: boolean): void
  /** Moves a widget up (`by` -1) or down (+1) the Dashboard's own order. */
  moveWidget(widget: DashboardWidget, by: number): void
  /** Drops a widget before another in the Dashboard's order, or after it (`after`): the layout editor's drag. */
  moveWidgetTo(widget: DashboardWidget, target: DashboardWidget, after: boolean): void
  /** Applies a ready-made order, set of widgets and sizes, and keeps Auto Order from rearranging it. */
  applyDashboardLayout(layout: DashboardLayout): void
  /** Keeps the Dashboard's current order, widgets and sizes under `name`; a name already saved is replaced. */
  saveDashboardLayout(name: string): void
  /** Removes one of the player's saved Dashboard layouts. */
  removeDashboardLayout(name: string): void
  /** Shows or hides an app on Home; the last one shown can't be hidden. */
  setHomeAppHidden(app: AppId, hidden: boolean): void
  /** Moves an app up (`by` -1) or down (+1) Home's order. */
  moveHomeApp(app: AppId, by: number): void
  /** Drops an app before another in Home's order, or after it (`after`): Home's own drag to reorder. */
  moveHomeAppTo(app: AppId, target: AppId, after: boolean): void
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
  setMapStyle(mapStyle: MapStyle): void
  setMapNightStart(mapNightStart: number): void
  setMapPins(mapPins: MapPinStyle): void
  setMapPinFuel(mapPinFuel: boolean): void
  setMapPinParking(mapPinParking: boolean): void
  setMapPinService(mapPinService: boolean): void
  setMapStopCardAlways(on: boolean): void
  setMapStopCardFuel(percent: number): void
  setMapStopCardRest(minutes: number): void
  setUiSounds(uiSounds: boolean): void
  setUiSoundVolume(uiSoundVolume: number): void
  setGpsDuck(gpsDuck: boolean): void
  setGpsDuckLead(gpsDuckLead: GpsDuckLead): void
  setGpsVoiceOnScreen(gpsVoiceOnScreen: boolean): void
  setVoiceEnabled(voiceEnabled: boolean): void
  setVoiceWake(voiceWake: boolean): void
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
  /** Apply a theme preset: sets accent color and appearance mode. */
  applyThemePreset(preset: ThemePresetId): void
  /** Set the accent color directly. */
  setAccentColor(color: string): void
  /** Profile management. */
  addProfile(name: string, picture?: string): void
  removeProfile(id: string): void
  switchProfile(id: string): void
  updateProfilePicture(id: string, picture: string): void
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
  | 'dashboardWidgetSizes'
  | 'overviewShown'
  | 'overviewDefault'
  | 'overviewCards'
  | 'clusterShown'
  | 'clusterCards'
  | 'clusterGaugePercent'
  | 'clusterAccent'
  | 'clusterTacho'
  | 'clusterBrand'
  | 'clusterReadings'
  | 'clusterLayout'
  | 'clock'
  | 'units'
  | 'clockFormat'
  | 'albumArt'
  | 'textSize'
  | 'reduceMotion'
  | 'diagnosticsPage'
  | 'dashboardOrder'
  | 'autoOrder'
  | 'savedDashboardLayouts'
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
  | 'mapStyle'
  | 'mapNightStart'
  | 'mapPins'
  | 'mapPinFuel'
  | 'mapPinParking'
  | 'mapPinService'
  | 'mapStopCardAlways'
  | 'mapStopCardFuel'
  | 'mapStopCardRest'
  | 'uiSounds'
  | 'uiSoundVolume'
  | 'gpsDuck'
  | 'gpsDuckLead'
  | 'gpsVoiceOnScreen'
  | 'accentColor'
  | 'profiles'
  | 'currentProfileId'
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
 * six cards was more than could be read on the move (owner 2026-11-04). The paired phone isn't one of them: its
 * state, battery, call and newest notification live in the sidebar (shell/Sidebar.tsx).
 */
const STARTER_WIDGETS: Record<DashboardWidget, boolean> = {
  nowPlaying: true,
  destination: true,
  driverHours: true,
  diagnostics: true,
  driver: false,
  weather: false,
}

/** Every widget at its designed size until the player chooses otherwise. */
const STANDARD_WIDGET_SIZES: Record<DashboardWidget, DashboardWidgetSize> = {
  nowPlaying: 'standard',
  destination: 'standard',
  driverHours: 'standard',
  driver: 'standard',
  weather: 'standard',
  diagnostics: 'standard',
}

/** A preset's layout, made whole: any widget its order leaves out follows it, and a size it doesn't name is
 * standard. */
function layoutOf(
  order: DashboardWidget[],
  shown: DashboardWidget[],
  sizes: Partial<Record<DashboardWidget, DashboardWidgetSize>>,
): DashboardLayout {
  return {
    order: [...order, ...DASHBOARD_WIDGETS.filter((widget) => !order.includes(widget))],
    widgets: Object.fromEntries(DASHBOARD_WIDGETS.map((widget) => [widget, shown.includes(widget)])) as Record<
      DashboardWidget,
      boolean
    >,
    sizes: Object.fromEntries(DASHBOARD_WIDGETS.map((widget) => [widget, sizes[widget] ?? 'standard'])) as Record<
      DashboardWidget,
      DashboardWidgetSize
    >,
  }
}

/** The Dashboard presets: the drive's essentials (Focus), Now Playing and the weather (Media), and the weather
 * first (Weather). The cards a preset leaves out keep their place after the shown ones, ready to come back. */
export const DASHBOARD_LAYOUTS: Record<DashboardLayoutPreset, DashboardLayout> = {
  focus: layoutOf(
    ['destination', 'driverHours', 'diagnostics', 'nowPlaying', 'weather', 'driver'],
    ['destination', 'driverHours', 'diagnostics', 'nowPlaying'],
    { destination: 'expanded', nowPlaying: 'compact' },
  ),
  media: layoutOf(
    ['nowPlaying', 'destination', 'driverHours', 'weather', 'diagnostics', 'driver'],
    ['nowPlaying', 'destination', 'driverHours', 'weather'],
    { nowPlaying: 'expanded', driverHours: 'compact', weather: 'compact' },
  ),
  weather: layoutOf(
    ['weather', 'destination', 'driverHours', 'nowPlaying', 'diagnostics', 'driver'],
    ['weather', 'destination', 'driverHours', 'nowPlaying'],
    { weather: 'expanded', nowPlaying: 'compact' },
  ),
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
      dashboardWidgetSizes: { ...STANDARD_WIDGET_SIZES },
      overviewShown: true,
      overviewDefault: false,
      overviewCards: { ...STARTER_OVERVIEW_CARDS },
      clusterShown: true,
      clusterCards: { ...STARTER_CLUSTER_CARDS },
      // The tank and the AdBlue as a share of what they hold: a level reads better as a percentage than as the
      // litres in it (owner 2026-11-11). Either way is a switch in Settings.
      clusterGaugePercent: true,
      clusterAccent: 'route',
      clusterTacho: true,
      clusterBrand: true,
      clusterReadings: [...STARTER_CLUSTER_READINGS],
      clusterLayout: copyClusterLayout(STARTER_CLUSTER_LAYOUT),
      clock: 'real',
      units: 'game',
      clockFormat: 'game',
      albumArt: true,
      textSize: DEFAULT_TEXT_SIZE,
      reduceMotion: SYSTEM_REDUCES_MOTION,
      diagnosticsPage: 'overview',
      dashboardOrder: DEFAULT_WIDGET_ORDER,
      autoOrder: true,
      savedDashboardLayouts: [],
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
      mapStyle: 'standard',
      mapNightStart: 20,
      mapPins: 'filled',
      mapPinFuel: true,
      mapPinParking: true,
      mapPinService: true,
      mapStopCardAlways: true,
      mapStopCardFuel: 25,
      mapStopCardRest: 60,
      uiSounds: true,
      uiSoundVolume: 1,
      gpsDuck: true,
      gpsDuckLead: 'few',
      gpsVoiceOnScreen: true,
      voiceEnabled: true,
      voiceKey: 'Ctrl + Shift + Space',
      voiceWake: false,
      oemMode: 'auto',
      equalizer: FLAT,
      equalizerCustom: false,
      accentColor: '#5e81ac',
      profiles: [],
      currentProfileId: '',
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
      setDashboardWidgetSize: (widget, size) =>
        set((state) => ({ dashboardWidgetSizes: { ...state.dashboardWidgetSizes, [widget]: size } })),
      setOverviewShown: (overviewShown) => set({ overviewShown }),
      setOverviewDefault: (overviewDefault) => set({ overviewDefault }),
      setOverviewCard: (card, shown) => set((state) => ({ overviewCards: { ...state.overviewCards, [card]: shown } })),
      resetOverview: () =>
        set({
          overviewShown: true,
          overviewDefault: false,
          overviewCards: { ...STARTER_OVERVIEW_CARDS },
        }),
      setClusterShown: (clusterShown) => set({ clusterShown }),
      setClusterCard: (card, shown) => set((state) => ({ clusterCards: { ...state.clusterCards, [card]: shown } })),
      setClusterGaugePercent: (clusterGaugePercent) => set({ clusterGaugePercent }),
      setClusterAccent: (clusterAccent) => set({ clusterAccent }),
      setClusterTacho: (clusterTacho) => set({ clusterTacho }),
      setClusterBrand: (clusterBrand) => set({ clusterBrand }),
      setClusterReading: (slot, reading) =>
        set((state) => {
          const readings = [...state.clusterReadings]
          if (slot < 0 || slot >= CLUSTER_READING_SLOTS || readings[slot] === reading) return {}
          const other = readings.indexOf(reading)
          // A reading can only be in one slot: taking one already on the card swaps the two, so the card always shows
          // three different gauges and no slot is left empty.
          if (other >= 0) readings[other] = readings[slot]
          readings[slot] = reading
          return { clusterReadings: readings }
        }),
      moveClusterCard: (card, by) =>
        set((state) => {
          const side = clusterSideOf(state.clusterLayout, card)
          const column = [...state.clusterLayout[side]]
          const from = column.indexOf(card)
          const to = from + by
          if (from < 0 || to < 0 || to >= column.length) return {}
          column.splice(from, 1)
          column.splice(to, 0, card)
          return { clusterLayout: { ...state.clusterLayout, [side]: column } }
        }),
      placeClusterCard: (card, side, index) =>
        set((state) => {
          const layout = clusterLayoutWithout(state.clusterLayout, card)
          const column = [...layout[side]]
          const at = index === undefined ? column.length : Math.max(0, Math.min(column.length, index))
          column.splice(at, 0, card)
          return { clusterLayout: { ...layout, [side]: column } }
        }),
      moveClusterCardTo: (card, target, after) =>
        set((state) => {
          if (card === target) return {}
          // The target's column is where the card goes, whichever column it came from: a drag across the dial is one
          // move, not a move and a reorder.
          const side = clusterSideOf(state.clusterLayout, target)
          const layout = clusterLayoutWithout(state.clusterLayout, card)
          const column = [...layout[side]]
          const at = column.indexOf(target)
          if (at < 0) return {}
          column.splice(at + (after ? 1 : 0), 0, card)
          return { clusterLayout: { ...layout, [side]: column } }
        }),
      applyClusterLayout: (layout) => set({ clusterLayout: copyClusterLayout(layout) }),
      resetCluster: () =>
        set({
          clusterShown: true,
          clusterCards: { ...STARTER_CLUSTER_CARDS },
          clusterGaugePercent: true,
          clusterAccent: 'route',
          clusterTacho: true,
          clusterBrand: true,
          clusterReadings: [...STARTER_CLUSTER_READINGS],
          clusterLayout: copyClusterLayout(STARTER_CLUSTER_LAYOUT),
        }),
      setClock: (clock) => set({ clock }),
      setUnits: (units) => {
        set({ units })
        syncUnits()
      },
      setClockFormat: (clockFormat) => {
        set({ clockFormat })
        syncClock()
      },
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
      moveWidgetTo: (widget, target, after) =>
        set((state) => {
          if (widget === target) return {}
          const from = state.dashboardOrder.indexOf(widget)
          if (from < 0 || !state.dashboardOrder.includes(target)) return {}
          const dashboardOrder = state.dashboardOrder.filter((each) => each !== widget)
          dashboardOrder.splice(dashboardOrder.indexOf(target) + (after ? 1 : 0), 0, widget)
          if (dashboardOrder.every((each, at) => each === state.dashboardOrder[at])) return {}
          return { dashboardOrder }
        }),
      applyDashboardLayout: (layout) =>
        set({
          dashboardOrder: [...layout.order],
          dashboardWidgets: { ...layout.widgets },
          dashboardWidgetSizes: { ...layout.sizes },
          // The preset is a layout the player chose: the drive's own order would undo it.
          autoOrder: false,
        }),
      saveDashboardLayout: (name) =>
        set((state) => {
          const kept = name.trim().slice(0, DASHBOARD_LAYOUT_NAME_LENGTH)
          if (!kept) return {}
          const saved = {
            name: kept,
            layout: {
              order: [...state.dashboardOrder],
              widgets: { ...state.dashboardWidgets },
              sizes: { ...state.dashboardWidgetSizes },
            },
          }
          const at = state.savedDashboardLayouts.findIndex((each) => each.name.toLowerCase() === kept.toLowerCase())
          if (at < 0) return { savedDashboardLayouts: [...state.savedDashboardLayouts, saved] }
          const savedDashboardLayouts = [...state.savedDashboardLayouts]
          savedDashboardLayouts[at] = saved
          return { savedDashboardLayouts }
        }),
      removeDashboardLayout: (name) =>
        set((state) => ({
          savedDashboardLayouts: state.savedDashboardLayouts.filter((each) => each.name !== name),
        })),
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
      moveHomeAppTo: (app, target, after) =>
        set((state) => {
          if (app === target) return {}
          const from = state.homeOrder.indexOf(app)
          if (from < 0 || !state.homeOrder.includes(target)) return {}
          const homeOrder = state.homeOrder.filter((each) => each !== app)
          homeOrder.splice(homeOrder.indexOf(target) + (after ? 1 : 0), 0, app)
          if (homeOrder.every((each, at) => each === state.homeOrder[at])) return {}
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
      setMapStyle: (mapStyle) => set({ mapStyle }),
      setMapNightStart: (mapNightStart) => set({ mapNightStart }),
      setMapPins: (mapPins) => set({ mapPins }),
      setMapPinFuel: (mapPinFuel) => set({ mapPinFuel }),
      setMapPinParking: (mapPinParking) => set({ mapPinParking }),
      setMapPinService: (mapPinService) => set({ mapPinService }),
      setMapStopCardAlways: (mapStopCardAlways) => set({ mapStopCardAlways }),
      setMapStopCardFuel: (mapStopCardFuel) => set({ mapStopCardFuel }),
      setMapStopCardRest: (mapStopCardRest) => set({ mapStopCardRest }),
      setUiSounds: (uiSounds) => set({ uiSounds }),
      setUiSoundVolume: (uiSoundVolume) => set({ uiSoundVolume: Math.max(0, Math.min(1, uiSoundVolume)) }),
      setGpsDuck: (gpsDuck) => set({ gpsDuck }),
      setGpsDuckLead: (gpsDuckLead) => set({ gpsDuckLead }),
      setGpsVoiceOnScreen: (gpsVoiceOnScreen) => set({ gpsVoiceOnScreen }),
      setVoiceEnabled: (voiceEnabled) => {
        set({ voiceEnabled })
        if (isInHost()) postToHost({ type: 'voiceEnabled', on: voiceEnabled })
      },
      setVoiceWake: (voiceWake) => {
        set({ voiceWake })
        if (isInHost()) postToHost({ type: 'voiceWake', on: voiceWake })
      },
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
      applyThemePreset: (preset) => {
        const def = THEME_PRESET_DEFINITIONS[preset]
        if (def) set({ accentColor: def.accentColor, appearanceMode: def.appearanceMode })
      },
      setAccentColor: (accentColor) => set({ accentColor }),
      addProfile: (name, picture?) => {
        const state = useCabin.getState()
        const trimmed = name.trim().slice(0, 32)
        if (!trimmed || state.profiles.some((p) => p.name.toLowerCase() === trimmed.toLowerCase())) return
        const id = `profile-${Date.now()}`
        const snapshot = getProfileSnapshot(state)
        const newProfile: DriverProfile = { id, name: trimmed, picture: picture ?? '', settingsSnapshot: snapshot }
        set({ profiles: [...state.profiles, newProfile] })
      },
      removeProfile: (id) => {
        const state = useCabin.getState()
        if (id === 'default') return
        const profiles = state.profiles.filter((p) => p.id !== id)
        if (profiles.length === 0) return
        let currentProfileId = state.currentProfileId
        if (state.currentProfileId === id) {
          // Saving current profile snapshot before switching away
          const snapshot = getProfileSnapshot(state)
          const updatedProfiles = profiles.map(p => p.id === profiles[0].id ? { ...p, settingsSnapshot: snapshot } : p)
          currentProfileId = profiles[0].id
          set({ profiles: updatedProfiles, currentProfileId })
          // Apply the new profile's snapshot
          const newProfile = updatedProfiles[0]
          if (newProfile?.settingsSnapshot) {
            set(applyProfileSnapshot(newProfile.settingsSnapshot))
          }
        } else {
          set({ profiles, currentProfileId })
        }
      },
      switchProfile: (id) => {
        const state = useCabin.getState()
        if (!state.profiles.some((p) => p.id === id)) return
        if (state.currentProfileId === id) return
        // Save current profile's snapshot
        const snapshot = getProfileSnapshot(state)
        const profiles = state.profiles.map((p) =>
          p.id === state.currentProfileId ? { ...p, settingsSnapshot: snapshot } : p
        )
        // Load new profile's snapshot
        const newProfile = profiles.find((p) => p.id === id)
        const applied = newProfile?.settingsSnapshot ? applyProfileSnapshot(newProfile.settingsSnapshot) : {}
        set({ profiles, currentProfileId: id, ...applied })
      },
      updateProfilePicture: (id, picture) =>
        set((state) => ({
          profiles: state.profiles.map((p) => p.id === id ? { ...p, picture } : p),
        })),
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
      // it was in only when the companion's switch says to (2026-11-04). 6: Phone comes first on Home (2026-11-05), a
      // saved order moved once to match. 7: the Dashboard's Overview screen and its cards, on by default. 8: the
      // instrument cluster's switch and cards, on by default. 9: the cluster's accent, its dial's tacho and maker's
      // mark, and the engine card's three readings (2026-11-11), all of which a saved dash takes the new defaults for.
      // 10: the cluster's layout, its cards either side of the dial (the same day), the dash's own when none was saved.
      version: 10,
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
        // Phone comes first on Home: a saved order keeps the rest as the player had it.
        if (version < 6 && Array.isArray(next.homeOrder)) {
          next = {
            ...next,
            homeOrder: ['phone', ...homeOrderOf(next.homeOrder).filter((app) => app !== 'phone')],
          }
        }
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
        dashboardWidgetSizes: state.dashboardWidgetSizes,
        overviewShown: state.overviewShown,
        overviewDefault: state.overviewDefault,
        overviewCards: state.overviewCards,
        clusterShown: state.clusterShown,
        clusterCards: state.clusterCards,
        clusterGaugePercent: state.clusterGaugePercent,
        clusterAccent: state.clusterAccent,
        clusterTacho: state.clusterTacho,
        clusterBrand: state.clusterBrand,
        clusterReadings: state.clusterReadings,
        clusterLayout: state.clusterLayout,
        clock: state.clock,
        units: state.units,
        clockFormat: state.clockFormat,
        albumArt: state.albumArt,
        textSize: state.textSize,
        reduceMotion: state.reduceMotion,
        diagnosticsPage: state.diagnosticsPage,
        dashboardOrder: state.dashboardOrder,
        autoOrder: state.autoOrder,
        savedDashboardLayouts: state.savedDashboardLayouts,
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
        mapStyle: state.mapStyle,
        mapNightStart: state.mapNightStart,
        mapPins: state.mapPins,
        mapPinFuel: state.mapPinFuel,
        mapPinParking: state.mapPinParking,
        mapPinService: state.mapPinService,
        mapStopCardAlways: state.mapStopCardAlways,
        mapStopCardFuel: state.mapStopCardFuel,
        mapStopCardRest: state.mapStopCardRest,
        uiSounds: state.uiSounds,
        uiSoundVolume: state.uiSoundVolume,
        gpsDuck: state.gpsDuck,
        gpsDuckLead: state.gpsDuckLead,
        gpsVoiceOnScreen: state.gpsVoiceOnScreen,
        accentColor: state.accentColor,
        profiles: state.profiles,
        currentProfileId: state.currentProfileId,
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
  if (typeof stored.dashboardWidgetSizes === 'object' && stored.dashboardWidgetSizes !== null) {
    const sizes = stored.dashboardWidgetSizes as Partial<Record<DashboardWidget, unknown>>
    result.dashboardWidgetSizes = Object.fromEntries(
      DASHBOARD_WIDGETS.map((widget) => [
        widget,
        DASHBOARD_WIDGET_SIZES.includes(sizes[widget] as DashboardWidgetSize)
          ? (sizes[widget] as DashboardWidgetSize)
          : 'standard',
      ]),
    ) as Record<DashboardWidget, DashboardWidgetSize>
  }
  // Compact Player used to be a switch of its own: its choice is Now Playing's compact size now.
  if ((stored as { playerCompact?: unknown }).playerCompact === true) {
    result.dashboardWidgetSizes = {
      ...(result.dashboardWidgetSizes ?? STANDARD_WIDGET_SIZES),
      nowPlaying: 'compact',
    }
  }
  if (typeof stored.overviewShown === 'boolean') result.overviewShown = stored.overviewShown
  if (typeof stored.overviewDefault === 'boolean') result.overviewDefault = stored.overviewDefault
  if (typeof stored.overviewCards === 'object' && stored.overviewCards !== null) {
    const cards = stored.overviewCards as Partial<Record<OverviewCard, unknown>>
    result.overviewCards = Object.fromEntries(OVERVIEW_CARDS.map((card) => [card, cards[card] !== false])) as Record<
      OverviewCard,
      boolean
    >
  }
  if (typeof stored.clusterShown === 'boolean') result.clusterShown = stored.clusterShown
  if (typeof stored.clusterGaugePercent === 'boolean') result.clusterGaugePercent = stored.clusterGaugePercent
  if (typeof stored.clusterCards === 'object' && stored.clusterCards !== null) {
    const cards = stored.clusterCards as Partial<Record<ClusterCard, unknown>>
    result.clusterCards = Object.fromEntries(CLUSTER_CARDS.map((card) => [card, cards[card] !== false])) as Record<
      ClusterCard,
      boolean
    >
  }
  if (CLUSTER_ACCENTS.includes(stored.clusterAccent as ClusterAccent)) {
    result.clusterAccent = stored.clusterAccent as ClusterAccent
  }
  if (typeof stored.clusterTacho === 'boolean') result.clusterTacho = stored.clusterTacho
  if (typeof stored.clusterBrand === 'boolean') result.clusterBrand = stored.clusterBrand
  if (Array.isArray(stored.clusterReadings)) {
    const chosen: ClusterReading[] = []
    for (const reading of stored.clusterReadings) {
      if (CLUSTER_READINGS.includes(reading) && !chosen.includes(reading) && chosen.length < CLUSTER_READING_SLOTS) {
        chosen.push(reading)
      }
    }
    // A card saved short a slot (or holding a reading WestPlay no longer has) keeps its own readings and takes the
    // rest from the dash's own three, so the engine card is never a reading short.
    for (const reading of STARTER_CLUSTER_READINGS) {
      if (chosen.length < CLUSTER_READING_SLOTS && !chosen.includes(reading)) chosen.push(reading)
    }
    result.clusterReadings = chosen
  }
  if (stored.clusterLayout !== undefined) result.clusterLayout = clusterLayoutOf(stored.clusterLayout)
  if (stored.clock === 'game' || stored.clock === 'real') result.clock = stored.clock
  if (stored.units === 'game' || UNIT_SYSTEMS.includes(stored.units as UnitSystem)) {
    result.units = stored.units
  }
  if (CLOCK_CHOICES.includes(stored.clockFormat as ClockChoice)) {
    result.clockFormat = stored.clockFormat
  }
  if (typeof stored.albumArt === 'boolean') result.albumArt = stored.albumArt
  if (stored.textSize !== undefined) result.textSize = toTextSize(stored.textSize)
  if (typeof stored.reduceMotion === 'boolean') result.reduceMotion = stored.reduceMotion
  if (DIAGNOSTICS_PAGES.includes(stored.diagnosticsPage as DiagnosticsPage)) {
    result.diagnosticsPage = stored.diagnosticsPage
  }
  if (stored.dashboardOrder !== undefined) result.dashboardOrder = orderOf(stored.dashboardOrder)
  if (typeof stored.autoOrder === 'boolean') result.autoOrder = stored.autoOrder
  if (stored.savedDashboardLayouts !== undefined) {
    result.savedDashboardLayouts = savedLayoutsOf(stored.savedDashboardLayouts)
  }
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
  if (MAP_STYLES.includes(stored.mapStyle as MapStyle)) result.mapStyle = stored.mapStyle as MapStyle
  if (MAP_NIGHT_STARTS.includes(stored.mapNightStart as number)) result.mapNightStart = stored.mapNightStart as number
  if (MAP_PIN_STYLES.includes(stored.mapPins as MapPinStyle)) result.mapPins = stored.mapPins as MapPinStyle
  if (typeof stored.mapPinFuel === 'boolean') result.mapPinFuel = stored.mapPinFuel
  if (typeof stored.mapPinParking === 'boolean') result.mapPinParking = stored.mapPinParking
  if (typeof stored.mapPinService === 'boolean') result.mapPinService = stored.mapPinService
  if (typeof stored.mapStopCardAlways === 'boolean') result.mapStopCardAlways = stored.mapStopCardAlways
  if ((STOP_CARD_FUEL_LEVELS as readonly number[]).includes(stored.mapStopCardFuel as number)) {
    result.mapStopCardFuel = stored.mapStopCardFuel as number
  }
  if ((STOP_CARD_REST_MINUTES as readonly number[]).includes(stored.mapStopCardRest as number)) {
    result.mapStopCardRest = stored.mapStopCardRest as number
  }
  if (typeof stored.uiSounds === 'boolean') result.uiSounds = stored.uiSounds
  if (typeof stored.gpsDuck === 'boolean') result.gpsDuck = stored.gpsDuck
  if ((GPS_DUCK_LEADS as readonly unknown[]).includes(stored.gpsDuckLead)) {
    result.gpsDuckLead = stored.gpsDuckLead as GpsDuckLead
  }
  if (typeof stored.gpsVoiceOnScreen === 'boolean') result.gpsVoiceOnScreen = stored.gpsVoiceOnScreen
  // A cabin saved while the sign was a three-way choice (a glow, the card's bars, or off): the choice is a switch now,
  // so off stays off and either of the two signs is simply on.
  if ((stored as { gpsVoiceEffect?: unknown }).gpsVoiceEffect === 'off') result.gpsVoiceOnScreen = false
  if (typeof stored.uiSoundVolume === 'number' && Number.isFinite(stored.uiSoundVolume)) {
    result.uiSoundVolume = Math.max(0, Math.min(1, stored.uiSoundVolume))
  }
  // Accent color: a hex string
  if (typeof stored.accentColor === 'string' && stored.accentColor.startsWith('#')) {
    result.accentColor = stored.accentColor
  }
  // Profiles: array of {id, name, picture, settingsSnapshot}
  if (Array.isArray(stored.profiles)) {
    const profiles: DriverProfile[] = []
    for (const p of stored.profiles) {
      if (typeof p === 'object' && p !== null) {
        const { id, name, picture, settingsSnapshot } = p as { id?: unknown; name?: unknown; picture?: unknown; settingsSnapshot?: unknown }
        if (typeof id === 'string' && typeof name === 'string' && name.trim()) {
          profiles.push({
            id,
            name: name.trim().slice(0, 32),
            picture: typeof picture === 'string' ? picture : undefined,
            settingsSnapshot: typeof settingsSnapshot === 'object' && settingsSnapshot !== null
              ? settingsSnapshot as Record<string, unknown>
              : undefined,
          })
        }
      }
    }
    result.profiles = profiles
  }
  // Current profile id
  if (typeof stored.currentProfileId === 'string') {
    result.currentProfileId = stored.currentProfileId
  }
  return result
}

/** The column a card is in; one a saved layout lost counts as left. */
function clusterSideOf(layout: ClusterLayout, card: ClusterSideCard): ClusterSide {
  return layout.right.includes(card) ? 'right' : 'left'
}

/** The layout with a card taken out of either column, ready to be put where it was meant to go. */
function clusterLayoutWithout(layout: ClusterLayout, card: ClusterSideCard): ClusterLayout {
  return {
    left: layout.left.filter((each) => each !== card),
    right: layout.right.filter((each) => each !== card),
  }
}

/** A copy, so a preset's own arrays are never written through by a move. */
function copyClusterLayout(layout: ClusterLayout): ClusterLayout {
  return { left: [...layout.left], right: [...layout.right] }
}

/**
 * A saved layout made whole: a card once (a copy or a name WestPlay doesn't know is dropped), and a card the layout
 * lost — an older version's dash, or an edited file — back in the column it has always been in, so the dial is never
 * a side short. Where a card sits among its column's others is the player's, and kept as saved.
 */
function clusterLayoutOf(saved: unknown): ClusterLayout {
  const layout: ClusterLayout = { left: [], right: [] }
  if (typeof saved === 'object' && saved !== null) {
    for (const side of ['left', 'right'] as const) {
      const column = (saved as Partial<Record<ClusterSide, unknown>>)[side]
      if (!Array.isArray(column)) continue
      for (const card of column) {
        const kept = card as ClusterSideCard
        if (CLUSTER_SIDE_CARDS.includes(kept) && !layout.left.includes(kept) && !layout.right.includes(kept)) {
          layout[side].push(kept)
        }
      }
    }
  }
  for (const card of STARTER_CLUSTER_LAYOUT.left) {
    if (!layout.left.includes(card) && !layout.right.includes(card)) layout.left.push(card)
  }
  for (const card of STARTER_CLUSTER_LAYOUT.right) {
    if (!layout.left.includes(card) && !layout.right.includes(card)) layout.right.push(card)
  }
  return layout
}

/** Saved layouts from storage, made whole: named, unique, and with every widget in its order and sizes that parse. */
function savedLayoutsOf(saved: unknown): SavedDashboardLayout[] {
  if (!Array.isArray(saved)) return []
  const found: SavedDashboardLayout[] = []
  for (const item of saved) {
    if (typeof item !== 'object' || item === null) continue
    const { name, layout } = item as { name?: unknown; layout?: unknown }
    if (typeof name !== 'string' || typeof layout !== 'object' || layout === null) continue
    const kept = name.trim().slice(0, DASHBOARD_LAYOUT_NAME_LENGTH)
    if (!kept || found.some((each) => each.name.toLowerCase() === kept.toLowerCase())) continue
    const { order, widgets, sizes } = layout as Partial<DashboardLayout>
    const shown: Partial<Record<DashboardWidget, unknown>> =
      typeof widgets === 'object' && widgets !== null ? widgets : {}
    const chosen: Partial<Record<DashboardWidget, unknown>> = typeof sizes === 'object' && sizes !== null ? sizes : {}
    const cleanSizes: Partial<Record<DashboardWidget, DashboardWidgetSize>> = {}
    for (const widget of DASHBOARD_WIDGETS) {
      if (DASHBOARD_WIDGET_SIZES.includes(chosen[widget] as DashboardWidgetSize)) {
        cleanSizes[widget] = chosen[widget] as DashboardWidgetSize
      }
    }
    found.push({
      name: kept,
      layout: layoutOf(
        orderOf(order),
        DASHBOARD_WIDGETS.filter((widget) => shown[widget] === true),
        cleanSizes,
      ),
    })
  }
  return found
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
  /** The game's own regional units, from the player's profile (`null`: not heard yet, or the page's preview): its
   * "Use miles" and the game it belongs to decide between the UK's miles and the US's. */
  gameUnits: UnitSystem | null
  /** The game's own clock, from the player's profile (`null`: not heard yet, or the page's preview): whether its
   * clocks read 24 hours. */
  gameClock24: boolean | null
  /** What the cabin's Now Playing reports, for the cluster's one line (`null`: nothing loaded). */
  nowPlaying: NowPlayingInfo | null
  /** The cabin's power phase, as the host passed it on (`null`: not heard yet). Only the cluster's page is told it:
   * there it is the boot (ClusterBoot), which is this page's own boot shown on the other screen. */
  power: CabinPower | null
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
  gameUnits: null,
  gameClock24: null,
  nowPlaying: null,
  power: null,
}))

/** Plain browser previews have no game to report the screen: `?layout=scania-2025` stands in for it. */
/** In a browser, `?truck=scania.s_2016` drives that truck (its screen profile). */
function previewTruck(): TruckInfo | null {
  if (typeof window === 'undefined') return null
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
  if (typeof window === 'undefined') return null
  if (isInHost()) return null
  const layout = new URLSearchParams(location.search).get('layout')
  return isScreenLayoutId(layout) ? layout : null
}

/** Whether the companion's resume switch was heard this launch (`null`: not yet). The session kept from the last
 * launch is used only if the switch says so, and dropped the first time it's heard off. */
let resumeHeard: boolean | null = null

/**
 * The units in force, from the driver's choice and the game's own regional setting: `game` follows the profile's
 * "Use miles" (and its game, for the UK's miles against the US's), anything else is the driver's own. Also mirrored
 * into shared/units.ts, where the formatters used outside a component (the map's labels) read it.
 */
export function resolveUnits(choice: UnitsChoice, game: UnitSystem | null): UnitSystem {
  return choice === 'game' ? (game ?? 'metric') : choice
}

export function syncUnits(): void {
  setActiveUnits(resolveUnits(useCabin.getState().units, useLive.getState().gameUnits))
}

/**
 * The clock in force, from the player's choice and the game's own switch: `game` follows the profile's "24-hour
 * clock notation" (and 24 hours until the game has said), anything else is the player's own. Mirrored into
 * shared/clock.ts with the language's AM and PM, where every formatter reads it.
 */
export function resolveClock24(choice: ClockChoice, game: boolean | null): boolean {
  if (choice === '24') return true
  if (choice === '12') return false
  return game ?? true
}

export function syncClock(): void {
  const words = STRINGS[languageOf(useLive.getState().gameLanguage)]
  setActiveClock(resolveClock24(useCabin.getState().clockFormat, useLive.getState().gameClock24), {
    am: words.am,
    pm: words.pm,
  })
}

// The player's own choice comes with the page's storage, so the first frame is drawn with it rather than with the
// default until the host connects and says what the game's own switch is set to.
syncClock()

/**
 * Feeds host messages into the stores, and tells the host whether WestPlay is open on the truck's screen
 * (as the page connects, and whenever it opens or closes). Returns the unsubscribe function; call once at
 * startup. The power sequence follows the truck's electrics (and only changes when they change).
 */
export function connectHost(now: () => number = () => performance.now()): () => void {
  const stopMessages = subscribeHostMessages(receiveHostMessage(now))
  const report = () => postToHost({ type: 'westplay', open: !useCabin.getState().truckScreen })
  report()
  // The cabin's power sequence, for the cluster's page: the dash plays the same boot as this screen, and needs to
  // know which moment of it the cabin is at, and from when. Its `since` is this page's `performance.now()`, which is
  // no page's but its own, so it goes out on the machine's clock (`Date.now()`), the one both WebViews read.
  const reportPower = () => {
    const { phase, since } = useCabin.getState().power
    postToHost({ type: 'power', phase, since: Math.round(Date.now() - (now() - since)) })
  }
  // Each time it moves — not as the page connects: a boot that hasn't begun has nothing to draw, and the host keeps
  // the last phase it was told for a cluster page that loads during one (`Power`).
  const stopPower = useCabin.subscribe((state, previous) => {
    if (state.power !== previous.power) reportPower()
  })
  const stopReports = useCabin.subscribe((state, previous) => {
    if (state.truckScreen !== previous.truckScreen) report()
  })
  // The field selected, for the player's own keyboard to type into (the host passes it to the game plugin).
  // The driver's units, page-wide for the formatters that are not components (shared/units.ts).
  const stopUnits = useCabin.subscribe((state, previous) => {
    if (state.units !== previous.units) syncUnits()
  })
  syncUnits()
  // The clock, page-wide for the same formatters (shared/clock.ts): the player's choice, the game's own switch, and
  // the AM and PM of the language the cabin is speaking.
  const stopClock = useCabin.subscribe((state, previous) => {
    if (state.clockFormat !== previous.clockFormat) syncClock()
  })
  const stopLanguage = useLive.subscribe((state, previous) => {
    if (state.gameLanguage !== previous.gameLanguage) syncClock()
  })
  syncClock()
  const reportSelection = () => postToHost({ type: 'typing', selection: useKeyboard.getState().selection })
  reportSelection()
  const stopSelections = useKeyboard.subscribe((state, previous) => {
    if (state.selection !== previous.selection) reportSelection()
  })
  return () => {
    stopMessages()
    stopReports()
    stopPower()
    stopSelections()
    stopUnits()
    stopClock()
    stopLanguage()
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
      case 'language':
        // The cluster's page: its own copy of this store, told the game's language without the map restriction the
        // cab's copy reads with it (that is the cab's business alone).
        useLive.setState({ gameLanguage: message.language })
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
      case 'units':
        // The profile's "Use miles", and its game: miles in America are the US's gallons and degrees, in Europe the
        // UK's miles and litres.
        useLive.setState({ gameUnits: message.miles ? (message.american ? 'us' : 'uk') : 'metric' })
        syncUnits()
        break
      case 'clock':
        // The profile's "24-hour clock notation": 24 hours, or 12 with AM and PM, wherever Cabin Play shows a time.
        useLive.setState({ gameClock24: message.clock24 })
        syncClock()
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
          voiceEnabled: message.voiceEnabled !== false,
          voiceKey: message.voiceKey ?? 'Ctrl + Shift + Space',
          voiceWake: message.voiceWake === true,
        })
        setIcons({
          iconSet: message.iconSet ?? null,
          iconStyle: isIconStyle(message.iconStyle) ? message.iconStyle : 'auto',
        })
        // Sync profiles from the companion so the cabin shows the same selected profile, with their settings snapshots.
        if (Array.isArray(message.profiles)) {
          const profiles: DriverProfile[] = []
          for (const p of message.profiles) {
            if (typeof p.id === 'string' && typeof p.name === 'string' && p.name.trim()) {
              profiles.push({
                id: p.id,
                name: p.name.trim().slice(0, 32),
                picture: typeof p.picture === 'string' ? p.picture : undefined,
                settingsSnapshot: typeof p.settingsSnapshot === 'object' && p.settingsSnapshot !== null
                  ? p.settingsSnapshot as Record<string, unknown>
                  : undefined,
              })
            }
          }
          if (profiles.length > 0) {
            const incomingCurrentProfileId =
              typeof message.currentProfileId === 'string' && profiles.some((p) => p.id === message.currentProfileId)
                ? message.currentProfileId
                : profiles[0].id
            const cabin = useCabin.getState()
            // If the profile actually changed, save the current snapshot and apply the new one
            if (cabin.currentProfileId && cabin.currentProfileId !== incomingCurrentProfileId) {
              const snapshot = getProfileSnapshot(cabin)
              const profilesWithSaved = profiles.map((pr) =>
                pr.id === cabin.currentProfileId ? { ...pr, settingsSnapshot: snapshot } : pr
              )
              const newProfile = profilesWithSaved.find((pr) => pr.id === incomingCurrentProfileId)
              const applied = newProfile?.settingsSnapshot ? applyProfileSnapshot(newProfile.settingsSnapshot) : {}
              useCabin.setState({ profiles: profilesWithSaved, currentProfileId: incomingCurrentProfileId, ...applied })
            } else {
              useCabin.setState({ profiles, currentProfileId: incomingCurrentProfileId })
            }
          }
        }
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
        receiveRadioStations(message)
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
      case 'voice':
        receiveVoice(message.state, message.transcript, message.error)
        break
      case 'voiceAudio':
        void playVoiceAudio(message.audio)
        break
      case 'voiceHotkey':
        receiveVoiceHotkey()
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
      case 'phone':
        receivePhoneState(message.state)
        break
      case 'phoneNotes':
        receivePhoneNotifications(message.notifications, message.backlog === true)
        break
      case 'phoneError':
        usePhoneFailure.getState().fail(message.error)
        break
      case 'nowPlaying':
        useLive.setState({ nowPlaying: message.data })
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
