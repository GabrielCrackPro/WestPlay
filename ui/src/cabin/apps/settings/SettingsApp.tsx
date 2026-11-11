import { type CSSProperties, type PointerEvent, type ReactElement, useEffect, useMemo, useRef, useState } from 'react'
import { SearchGlyph } from '../../keyboard/glyphs'
import { useKeyboard } from '../../keyboard/store'
import { wakePhrase } from '../../voice/wake'
import { TextField } from '../../keyboard/TextField'
import { EqualizerGraph, TrackRow } from './equalizer'
import { ChoiceRows, Group, NavRow, OrderButtons, Page, SwitchOrderRow, SwitchRow } from './rows'
import { setIcons, useLooks, useWallpapers } from '../../state/looks'
import { fileUrl, type IconSet, type IconStyle } from '../../../shared/customize'
import type { ClockChoice } from '../../../shared/clock'
import type { UnitsChoice } from '../../../shared/units'
import { type AppIconRole, appIcon, type IconLook } from '../../../shared/icons'
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
} from '../../maps/routeLook'
import { STOP_CARD_FUEL_LEVELS, STOP_CARD_REST_MINUTES } from '../../maps/nearbyStop'
import { CLUSTER_ACCENTS, type ClusterAccent } from '../../cluster/accent'
import {
  AdblueIcon,
  BrakeTemperatureIcon,
  CoolantIcon,
  DropIcon,
  FuelIcon,
  GaugeIcon,
  RestIcon,
  TripIcon,
  WarningIcon,
} from '../../cluster/ClusterIcons'
import { pickVariant, prepareWallpaper } from '../../wallpapers'
import { type Appearance, resolveAppearance } from '../../state/appearance'
import { useLook, useScreenProfile } from '../../state/hooks'
import { useUnits } from '../../state/units'
import {
  CLUSTER_CARDS,
  CLUSTER_LAYOUTS,
  CLUSTER_LAYOUT_PRESETS,
  CLUSTER_READINGS,
  type ClusterLayout,
  type ClusterLayoutPreset,
  type ClusterReading,
  type ClusterSide,
  type ClusterSideCard,
  DASHBOARD_LAYOUTS,
  DASHBOARD_LAYOUT_NAME_LENGTH,
  DASHBOARD_PRESETS,
  DASHBOARD_WIDGET_SIZES,
  type DashboardLayout,
  type DashboardLayoutPreset,
  type DashboardWidget,
  type DashboardWidgetSize,
  MAP_DETAILS,
  MAP_RECENTRES,
  OVERVIEW_CARDS,
  type ClusterCard,
  type MapDetail,
  type OverviewCard,
  useCabin,
  useLive,
} from '../../state/store'
import { PINNED_LIMIT } from '../../state/apps'
import { useLanguage, useText } from '../../state/text'
import { TEXT_SIZES } from '../../state/textSize'
import {
  AppearanceGlyph,
  CheckGlyph,
  ChevronGlyph,
  ClusterGlyph,
  DashboardGlyph,
  HomeGlyph,
  IconsGlyph,
  MapDisplayGlyph,
  MapPinsGlyph,
  MapRouteGlyph,
  MapTrafficGlyph,
  NowPlayingGlyph,
  SoundGlyph,
  UnitsGlyph,
  VoiceGlyph,
  WallpaperGlyph,
} from './glyphs'
import { type SettingsEntry, searchSettings, settingsEntries } from './search'
import { type SettingsPage, useSettings } from './settings'
import './settings.css'
import { cabClock, EQUALIZER_BANDS, isInHost, postToHost } from '../../../shared/host'

/**
 * The Settings app, in iOS 26's Settings look: a large title, inset grouped cards, coloured tiles, chevrons
 * and pill switches, in Apple's colours (shell/apple.css). Only the player's own CarPlay choices live here;
 * WestPlay's management (the cab's sound, the companion's options) belongs to the companion window.
 *
 * Appearance (with Text Size), Wallpaper, the Dashboard's widgets, Now Playing's album art and the Equalizer.
 */
export function SettingsApp() {
  const text = useText()
  const page = useSettings((state) => state.page)
  const went = useSettings((state) => state.went)
  const back = useSettings((state) => state.back)
  // Opened again, the page it was left on comes with the window, without a slide of its own.
  useEffect(() => () => useSettings.setState({ went: 'none' }), [])
  // Escape goes back a page, as its button does: the cab is driven by mouse, but the keyboard walks these too.
  useEffect(() => {
    if (page === 'list') return
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') back()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [page, back])
  return (
    <section className="app-panel settings-app" aria-label={text.apps.settings}>
      <div key={page} className={`settings-page went-${went}`}>
        <PageContent page={page} />
      </div>
    </section>
  )
}

function PageContent({ page }: { page: SettingsPage }) {
  switch (page) {
    case 'list':
      return <ListPage />
    case 'appearance':
      return <AppearancePage />
    case 'wallpaper':
      return <WallpaperPage />
    case 'icons':
      return <IconsPage />
    case 'dashboard':
      return <DashboardPage />
    case 'overview':
      return <OverviewPage />
    case 'cluster':
      return <ClusterPage />
    case 'units':
      return <UnitsPage />
    case 'home':
      return <HomeScreenPage />
    case 'map':
      return <MapsPage />
    case 'mapDisplay':
      return <MapDisplayPage />
    case 'mapTraffic':
      return <MapTrafficPage />
    case 'mapRoute':
      return <MapRoutePage />
    case 'mapMarkers':
      return <MapMarkersPage />
    case 'mapStopCard':
      return <MapStopCardPage />
    case 'nowPlaying':
      return <NowPlayingPage />
    case 'sound':
      return <SoundPage />
    case 'equalizer':
      return <EqualizerPage />
    case 'voice':
      return <VoicePage />
    case 'textSize':
      return <TextSizePage />
  }
}

/** The appearance the mode asks for now (before a wallpaper with one variant only overrules it). */
function useWantedAppearance(): Appearance {
  const mode = useCabin((state) => state.appearanceMode)
  const gameTime = useLive((state) => (state.telemetry ? cabClock(state.telemetry, state.clockShift) : null))
  const lowBeam = useLive((state) => state.telemetry?.lowBeam ?? false)
  return resolveAppearance(mode, { gameTime, lowBeam })
}

/** The Settings search field's id (one on screen: the keyboard types into it). */
const SEARCH_FIELD = 'settings-search'

function ListPage() {
  const text = useText()
  const open = useSettings((state) => state.open)
  const [query, setQuery] = useState('')
  const entries = useMemo(() => settingsEntries(text), [text])
  const results = useMemo(() => searchSettings(entries, query), [entries, query])
  // A result opens its page, the keyboard going away with the results.
  const openResult = (page: SettingsPage) => {
    useKeyboard.getState().detach(SEARCH_FIELD)
    open(page)
  }
  const mode = useCabin((state) => state.appearanceMode)
  const wanted = useWantedAppearance()
  const wallpapers = useWallpapers()
  const wallpaperId = useCabin((state) => state.wallpaperId)
  const iconSet = useLooks((state) => state.iconSet)
  const iconStyle = useLooks((state) => state.iconStyle)
  const detail = useCabin((state) => state.mapDetail)
  const clusterShown = useCabin((state) => state.clusterShown)
  // What each row is set to now, as iOS's Settings says it: the screen's look, its wallpaper, its icons, and how
  // much the map draws.
  const wallpaper = wallpapers.find((each) => each.id === wallpaperId) ?? wallpapers[0]
  const icons = iconStyle === 'android' ? 'Android Auto' : (iconSet ?? 'Cabin Play')
  const drawn: Record<MapDetail, string> = {
    high: text.settings.high,
    balanced: text.destinations.mapBalanced,
    low: text.settings.low,
  }
  return (
    <Page title={text.apps.settings} list>
      <div className="settings-search">
        <TextField
          id={SEARCH_FIELD}
          value={query}
          onChange={setQuery}
          returnKind="search"
          hint={text.settings.search}
          label={text.settings.search}
          icon={<SearchGlyph />}
        />
      </div>
      {query.trim() ? (
        <SearchResults results={results} onOpen={openResult} />
      ) : (
        <>
          {/* The list in three sections, so a setting is found where it's expected: how the screen looks, what the
              cab's own displays show, and the apps. The cab's displays sit together — the dash, its Overview, the
              map — and the units and clock, which both follow the game, are one page of their own rather than a
              footnote under Appearance. */}
          <Group header={text.settings.screenSection}>
            <NavRow
              tile="var(--apple-blue)"
              icon={<AppearanceGlyph />}
              label={text.settings.appearance}
              value={mode === 'auto' ? text.settings.automatic : text.settings[wanted]}
              onOpen={() => open('appearance')}
            />
            <NavRow
              tile="var(--apple-cyan)"
              icon={<WallpaperGlyph />}
              label={text.settings.wallpaper}
              value={wallpaper?.name}
              onOpen={() => open('wallpaper')}
            />
            <NavRow
              tile="var(--apple-purple)"
              icon={<IconsGlyph />}
              label={text.settings.icons}
              value={icons}
              onOpen={() => open('icons')}
            />
          </Group>
          <Group header={text.settings.cabSection}>
            <NavRow
              tile="var(--apple-indigo)"
              icon={<DashboardGlyph />}
              label={text.settings.dashboard}
              onOpen={() => open('dashboard')}
            />
            <NavRow
              tile="var(--apple-teal)"
              icon={<ClusterGlyph />}
              label={text.settings.clusterScreen}
              value={clusterShown ? text.diagnostics.on : text.diagnostics.off}
              onOpen={() => open('cluster')}
            />
            <NavRow
              tile="var(--apple-green)"
              icon={<MapGlyph />}
              label={text.apps.maps}
              value={drawn[detail]}
              onOpen={() => open('map')}
            />
            <NavRow
              tile="var(--apple-gray)"
              icon={<UnitsGlyph />}
              label={text.settings.unitsClock}
              onOpen={() => open('units')}
            />
          </Group>
          <Group header={text.settings.appsSection}>
            <NavRow
              tile="var(--apple-blue)"
              icon={<HomeGlyph />}
              label={text.settings.homeScreen}
              onOpen={() => open('home')}
            />
            <NavRow
              tile="var(--apple-pink)"
              icon={<NowPlayingGlyph />}
              label={text.nowPlaying}
              onOpen={() => open('nowPlaying')}
            />
            <NavRow
              tile="var(--apple-red)"
              icon={<SoundGlyph />}
              label={text.settings.sound}
              onOpen={() => open('sound')}
            />
            <NavRow
              tile="var(--apple-orange)"
              icon={<VoiceGlyph />}
              label={text.settings.voiceAssistant}
              onOpen={() => open('voice')}
            />
          </Group>
        </>
      )}
    </Page>
  )
}

/** Settings search's results: each row's name and the page it's on; a press opens that page. */
function SearchResults({ results, onOpen }: { results: SettingsEntry[]; onOpen(page: SettingsPage): void }) {
  const text = useText()
  if (results.length === 0) return <p className="settings-search-empty">{text.settings.noResults}</p>
  return (
    <Group>
      {results.map((entry) => (
        <button
          key={`${entry.page}:${entry.label}`}
          type="button"
          className="settings-row settings-search-row"
          onClick={() => onOpen(entry.page)}
        >
          <span className="settings-label">{entry.label}</span>
          <span className="settings-value">{entry.section}</span>
          <span className="settings-chevron">
            <ChevronGlyph />
          </span>
        </button>
      ))}
    </Group>
  )
}

/** Light or Dark, each a little picture of the screen, and Automatic (iOS's Display & Brightness). */
function AppearancePage() {
  const text = useText()
  const mode = useCabin((state) => state.appearanceMode)
  const setMode = useCabin((state) => state.setAppearanceMode)
  const wanted = useWantedAppearance()
  // The Vehicle Bar: only on a screen that has one (the truck's own bar, beside WestPlay).
  const hasBar = useScreenProfile().oemStrip !== null
  const oemMode = useCabin((state) => state.oemMode)
  const chooseOemMode = useCabin((state) => state.chooseOemMode)
  const open = useSettings((state) => state.open)
  return (
    <Page title={text.settings.appearance}>
      <Group footer={text.settings.automaticFooter}>
        <div className="appearance-choices">
          {(['light', 'dark'] as const).map((appearance) => (
            <button
              key={appearance}
              type="button"
              className="appearance-choice"
              aria-pressed={wanted === appearance}
              onClick={() => setMode(appearance)}
            >
              <ScreenPicture appearance={appearance} />
              <span className="appearance-name">{text.settings[appearance]}</span>
              <span className={wanted === appearance ? 'settings-radio on' : 'settings-radio'}>
                {wanted === appearance && <CheckGlyph />}
              </span>
            </button>
          ))}
        </div>
        <SwitchRow
          label={text.settings.automatic}
          on={mode === 'auto'}
          // Off, it keeps what Automatic shows now.
          onToggle={(on) => setMode(on ? 'auto' : wanted)}
        />
      </Group>
      {/* Text and motion together: how big the screen's words are, and whether it moves. */}
      <Group footer={text.settings.reduceMotionFooter}>
        <NavRow label={text.settings.textSize} onOpen={() => open('textSize')} />
        <SwitchRow
          label={text.settings.reduceMotion}
          on={useCabin((state) => state.reduceMotion)}
          onToggle={useCabin((state) => state.setReduceMotion)}
        />
      </Group>

      {hasBar && (
        <Group footer={text.settings.vehicleBarFooter}>
          <SwitchRow
            label={text.settings.vehicleBar}
            on={oemMode === 'auto'}
            onToggle={(on) => chooseOemMode(on ? 'auto' : 'off')}
          />
        </Group>
      )}
    </Page>
  )
}

/**
 * The apps' text size, as iOS's Text Size (owner 2026-10-22): its own text at the size chosen, and a slider
 * of nine steps between a small and a large A, dragged or tapped (state/textSize.ts).
 */
function TextSizePage() {
  const text = useText()
  return (
    <Page title={text.settings.textSize}>
      <p className="text-size-about">{text.settings.textSizeAbout}</p>
      <Group>
        <TextSizeSlider />
      </Group>
    </Page>
  )
}

/** The slider: a line with a tick at each step and the thumb on the one chosen. Dragged, the thumb follows the
 * finger and the size changes at each step it passes; let go, it settles on the step. */
function TextSizeSlider() {
  const text = useText()
  const step = useCabin((state) => state.textSize)
  const setStep = useCabin((state) => state.setTextSize)
  const track = useRef<HTMLDivElement>(null)
  // Where along the track the finger is while it drags (0 to 1), `null` otherwise.
  const [held, setHeld] = useState<number | null>(null)
  const last = TEXT_SIZES.length - 1
  const follow = (event: PointerEvent) => {
    const box = track.current?.getBoundingClientRect()
    if (!box || box.width === 0) return
    const along = Math.max(0, Math.min(1, (event.clientX - box.left) / box.width))
    setHeld(along)
    const nearest = Math.round(along * last)
    if (nearest !== step) setStep(nearest)
  }
  const at = (index: number) => `${(index / last) * 100}%`
  const goTo = (index: number) => setStep(Math.max(0, Math.min(last, index)))
  return (
    <div className="text-size-row">
      <span className="text-size-a small" aria-hidden>
        A
      </span>
      <div
        ref={track}
        className={held === null ? 'text-size-track' : 'text-size-track dragging'}
        data-own-drag
        role="slider"
        aria-label={text.settings.textSize}
        aria-valuemin={0}
        aria-valuemax={last}
        aria-valuenow={step}
        aria-valuetext={`${step + 1} / ${last + 1}`}
        // Reached by Tab, the arrow keys step it as the finger's drag does.
        tabIndex={0}
        onKeyDown={(event) => {
          const key = event.key
          if (key === 'ArrowLeft' || key === 'ArrowDown') goTo(step - 1)
          else if (key === 'ArrowRight' || key === 'ArrowUp') goTo(step + 1)
          else if (key === 'Home') goTo(0)
          else if (key === 'End') goTo(last)
          else return
          event.preventDefault()
        }}
        onPointerDown={(event) => {
          event.currentTarget.setPointerCapture(event.pointerId)
          follow(event)
        }}
        onPointerMove={(event) => held !== null && follow(event)}
        onPointerUp={() => setHeld(null)}
        onPointerCancel={() => setHeld(null)}
      >
        <span className="text-size-line" />
        {TEXT_SIZES.map((_, index) => (
          <span key={index} className="text-size-tick" style={{ left: at(index) }} />
        ))}
        <span className="text-size-thumb" style={{ left: held === null ? at(step) : `${held * 100}%` }} />
      </div>
      <span className="text-size-a large" aria-hidden>
        A
      </span>
    </div>
  )
}

/** A little picture of the screen in an appearance: a wallpaper, the sidebar and the Dashboard's widgets. */
function ScreenPicture({ appearance }: { appearance: Appearance }) {
  return (
    <span className={`screen-picture ${appearance}`} aria-hidden>
      <span className="screen-picture-sidebar" />
      <span className="screen-picture-widget large" />
      <span className="screen-picture-widget" />
      <span className="screen-picture-widget" />
    </span>
  )
}

function WallpaperPage() {
  const text = useText()
  const wallpaperId = useCabin((state) => state.wallpaperId)
  const setWallpaper = useCabin((state) => state.setWallpaper)
  const wallpapers = useWallpapers()
  const { appearance } = useLook()
  return (
    <Page title={text.settings.wallpaper}>
      <Group>
        <div className="wallpaper-choices">
          {wallpapers.map((wallpaper) => (
            <button
              key={wallpaper.id}
              type="button"
              className="wallpaper-choice"
              aria-pressed={wallpaper.id === wallpaperId}
              onClick={() => setWallpaper(wallpaper.id)}
            >
              <WallpaperThumbnail src={pickVariant(wallpaper, appearance).src} />
              <span className="wallpaper-name">{wallpaper.name}</span>
            </button>
          ))}
        </div>
      </Group>
    </Page>
  )
}

/** Thumbnails, each drawn once from its wallpaper: the files are up to 4000 px wide. */
const thumbnails = new Map<string, Promise<string>>()

function WallpaperThumbnail({ src }: { src: string }) {
  const [thumbnail, setThumbnail] = useState<string | null>(null)
  useEffect(() => {
    let current = true
    let made = thumbnails.get(src)
    if (!made) {
      made = prepareWallpaper(src, THUMBNAIL_WIDTH, (THUMBNAIL_WIDTH * 9) / 16).catch(() => src)
      thumbnails.set(src, made)
    }
    void made.then((url) => current && setThumbnail(url))
    return () => {
      current = false
    }
  }, [src])
  return thumbnail ? <img src={thumbnail} alt="" /> : <span className="wallpaper-thumbnail-empty" />
}

/** Twice a thumbnail's width on the screen, so it stays sharp. */
const THUMBNAIL_WIDTH = 600

/** Each icon style, and the words the list calls it by. */
const ICON_STYLES = [
  { id: 'auto', word: 'automatic' },
  { id: 'light', word: 'light' },
  { id: 'dark', word: 'dark' },
] as const

/** The apps an icon set's row shows: enough of them to tell one set's look from another's. */
const ICON_STRIP: readonly AppIconRole[] = ['maps', 'music', 'spotify', 'youtube', 'youtubeMusic']

/**
 * App Icons (Settings › App Icons): the look the icons show in (Automatic, Light or Dark), and which icons — Cabin
 * Play's own (with Android Auto's flat tiles as a choice of their own, under them as in the companion) or one of the
 * player's sets, its row showing what it changes. Chosen here, it shows at once and is kept with Cabin Play's
 * settings, where the companion's Customize sees it.
 */
function IconsPage() {
  const text = useText()
  const { appearance } = useLook()
  const iconSet = useLooks((state) => state.iconSet)
  const iconStyle = useLooks((state) => state.iconStyle)
  const sets = useLooks((state) => state.custom.iconSets)
  const base = useLooks((state) => state.base)
  const android = iconStyle === 'android'
  // What the rows' strips show: the look chosen, or the screen's own.
  const look: IconLook = android ? 'android' : iconStyle === 'auto' ? appearance : iconStyle
  const choose = (next: { iconSet: string | null; iconStyle: IconStyle }) => {
    setIcons(next)
    if (isInHost()) postToHost({ type: 'icons', ...next })
  }
  return (
    <Page title={text.settings.icons}>
      <ChoiceRows<IconStyle>
        header={text.settings.iconStyle}
        radio={text.settings.iconStyle}
        value={android ? null : iconStyle}
        onPick={(id) => choose({ iconSet, iconStyle: id })}
        options={ICON_STYLES.map((style) => ({ id: style.id, label: text.settings[style.word] }))}
      />
      <Group radio={text.settings.icons}>
        <IconSetRow
          name="Cabin Play"
          icons={null}
          chosen={!android && !iconSet}
          look={look}
          base={base}
          onPick={() => choose({ iconSet: null, iconStyle: android ? 'auto' : iconStyle })}
        />
        <IconSetRow
          name="Android Auto"
          icons={null}
          chosen={android}
          look="android"
          base={base}
          onPick={() => choose({ iconSet: null, iconStyle: 'android' })}
        />
        {sets.map((set) => (
          <IconSetRow
            key={set.name}
            name={set.name}
            icons={set}
            chosen={!android && iconSet === set.name}
            look={look}
            base={base}
            onPick={() => choose({ iconSet: set.name, iconStyle: 'auto' })}
          />
        ))}
      </Group>
    </Page>
  )
}

/** An icon set's row: its name, a strip of the icons it changes, and a tick when it's the one shown. */
function IconSetRow({
  name,
  icons,
  chosen,
  look,
  base,
  onPick,
}: {
  name: string
  /** `null`: Cabin Play's own icons in `look` (its own set's, or Android Auto's). */
  icons: IconSet | null
  chosen: boolean
  look: IconLook
  base: string
  onPick(): void
}) {
  return (
    <button type="button" role="radio" aria-checked={chosen} className="settings-row icon-set-row" onClick={onPick}>
      <span className="settings-label">{name}</span>
      <span className="icon-strip" aria-hidden>
        {ICON_STRIP.map((role) => {
          // A set has a light and a dark file per app; Android Auto's tiles are Cabin Play's own.
          const path = look === 'android' ? null : icons?.icons[role]?.[look]
          return <img key={role} src={path ? fileUrl(base, path) : appIcon(role, look)} alt="" />
        })}
      </span>
      {chosen && (
        <span className="settings-check">
          <CheckGlyph />
        </span>
      )}
    </button>
  )
}

/** Which widgets the Dashboard shows and the order and size they come in (Auto order: the drive's own), and its
 * second screen, the Overview, which has a page of its own. */
function DashboardPage() {
  const text = useText()
  const widgets = useCabin((state) => state.dashboardWidgets)
  const setWidget = useCabin((state) => state.setDashboardWidget)
  const sizes = useCabin((state) => state.dashboardWidgetSizes)
  const setSize = useCabin((state) => state.setDashboardWidgetSize)
  const autoOrder = useCabin((state) => state.autoOrder)
  const setAutoOrder = useCabin((state) => state.setAutoOrder)
  const order = useCabin((state) => state.dashboardOrder)
  const moveWidget = useCabin((state) => state.moveWidget)
  const moveWidgetTo = useCabin((state) => state.moveWidgetTo)
  const applyLayout = useCabin((state) => state.applyDashboardLayout)
  const savedLayouts = useCabin((state) => state.savedDashboardLayouts)
  const saveLayout = useCabin((state) => state.saveDashboardLayout)
  const removeLayout = useCabin((state) => state.removeDashboardLayout)
  const [drag, setDrag] = useState<WidgetDrag | null>(null)
  const press = useRef<WidgetPress | null>(null)
  const suppressClick = useRef(false)
  const [namingLayout, setNamingLayout] = useState(false)
  const [layoutName, setLayoutName] = useState('')
  const overviewShown = useCabin((state) => state.overviewShown)
  const open = useSettings((state) => state.open)
  const names: Record<DashboardWidget, string> = {
    nowPlaying: text.nowPlaying,
    destination: text.destination,
    driverHours: text.diagnostics.driverHours,
    driver: text.apps.driver,
    weather: text.apps.weather,
    diagnostics: text.apps.diagnostics,
  }
  const sizeNames: Record<DashboardWidgetSize, string> = {
    compact: text.settings.widgetCompact,
    standard: text.settings.widgetStandard,
    expanded: text.settings.widgetExpanded,
  }
  const shown = order.filter((widget) => widgets[widget])
  const presetNames: Record<DashboardLayoutPreset, string> = {
    focus: text.settings.presetFocus,
    media: text.settings.presetMedia,
    weather: text.settings.presetWeather,
  }
  // A preset is only shown as current while Auto Order is off: otherwise the drive's order wins over it.
  const activePreset = autoOrder
    ? null
    : (DASHBOARD_PRESETS.find((preset) => matchesDashboardLayout(DASHBOARD_LAYOUTS[preset], order, widgets, sizes)) ??
      null)

  const startWidgetDrag = (event: PointerEvent<HTMLDivElement>, widget: DashboardWidget) => {
    if (event.button !== 0) return
    // Keep the press's moves and release, even when the cursor leaves the card.
    event.currentTarget.setPointerCapture(event.pointerId)
    press.current = { widget, pointerId: event.pointerId, x: event.clientX, y: event.clientY, dragging: false }
  }

  // The pointer's own reorder: no native HTML5 drag, which WebView2 hands to the OS and can lose the cabin's press.
  useEffect(() => {
    const move = (event: globalThis.PointerEvent) => {
      const held = press.current
      if (!held || held.pointerId !== event.pointerId) return
      if (!held.dragging) {
        if (Math.hypot(event.clientX - held.x, event.clientY - held.y) < 8) return
        held.dragging = true
        // Taking a card in hand is editing the player's order: Auto Order would put it back by the drive's needs.
        if (useCabin.getState().autoOrder) setAutoOrder(false)
        setDrag({ widget: held.widget, over: null, after: false })
      }
      event.preventDefault()
      const hit = widgetUnder(event.clientX, event.clientY)
      setDrag((current) => {
        if (!current) return current
        const over = hit && hit.widget !== held.widget ? hit.widget : null
        const after = over ? (hit?.after ?? false) : false
        return current.over === over && current.after === after ? current : { ...current, over, after }
      })
    }
    const up = (event: globalThis.PointerEvent) => {
      const held = press.current
      if (!held || held.pointerId !== event.pointerId) return
      press.current = null
      if (!held.dragging) return
      const hit = widgetUnder(event.clientX, event.clientY)
      if (hit && hit.widget !== held.widget) moveWidgetTo(held.widget, hit.widget, hit.after)
      // The click that follows a drop isn't a press on the card.
      suppressClick.current = true
      window.setTimeout(() => (suppressClick.current = false), 300)
      setDrag(null)
    }
    const cancel = (event: globalThis.PointerEvent) => {
      const held = press.current
      if (!held || held.pointerId !== event.pointerId) return
      press.current = null
      setDrag(null)
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
    window.addEventListener('pointercancel', cancel)
    return () => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
      window.removeEventListener('pointercancel', cancel)
      press.current = null
    }
  }, [moveWidgetTo, setAutoOrder])

  const saveNamedLayout = () => {
    const kept = layoutName.trim()
    if (!kept) return
    saveLayout(kept)
    setNamingLayout(false)
    setLayoutName('')
  }
  const toggleSaving = () => {
    setNamingLayout((open) => !open)
    setLayoutName('')
  }

  return (
    <Page title={text.settings.dashboard}>
      {/* The column as the Dashboard draws it: drag a card to move it, and each row below chooses its share of the
          room. The preview is the player's own order; dragging turns Auto Order off so that order is the one used. */}
      <Group header={text.settings.widgetLayout} footer={text.settings.widgetLayoutFooter}>
        <div className="dashboard-layout-editor">
          <div className="dashboard-layout-presets" role="group" aria-label={text.settings.widgetPresets}>
            {DASHBOARD_PRESETS.map((preset) => {
              const layout = DASHBOARD_LAYOUTS[preset]
              return (
                <button
                  key={preset}
                  type="button"
                  className="dashboard-layout-preset"
                  aria-pressed={preset === activePreset}
                  onClick={() => applyLayout(layout)}
                >
                  <LayoutShot layout={layout} />
                  <span className="dashboard-preset-copy">
                    <span className={`dashboard-preset-mark ${preset}`} aria-hidden>
                      <PresetGlyph preset={preset} />
                    </span>
                    <span className="dashboard-preset-name">{presetNames[preset]}</span>
                    {preset === activePreset && (
                      <span className="dashboard-preset-check" aria-hidden>
                        <CheckGlyph />
                      </span>
                    )}
                  </span>
                </button>
              )
            })}
          </div>
          {savedLayouts.length > 0 && (
            <div className="dashboard-saved-layouts">
              <p className="dashboard-preset-section-title">{text.settings.yourLayouts}</p>
              <div className="dashboard-layout-presets" role="group" aria-label={text.settings.yourLayouts}>
                {savedLayouts.map(({ name, layout }) => {
                  const active = !autoOrder && matchesDashboardLayout(layout, order, widgets, sizes)
                  return (
                    <div className="dashboard-saved-preset" key={name}>
                      <button
                        type="button"
                        className="dashboard-layout-preset"
                        aria-pressed={active}
                        onClick={() => applyLayout(layout)}
                      >
                        <LayoutShot layout={layout} />
                        <span className="dashboard-preset-copy">
                          <span className="dashboard-preset-mark saved" aria-hidden>
                            <SavedLayoutGlyph />
                          </span>
                          <span className="dashboard-preset-name">{name}</span>
                          {active && (
                            <span className="dashboard-preset-check" aria-hidden>
                              <CheckGlyph />
                            </span>
                          )}
                        </span>
                      </button>
                      <button
                        type="button"
                        className="dashboard-preset-delete"
                        aria-label={`${text.settings.deleteLayout}: ${name}`}
                        title={`${text.settings.deleteLayout}: ${name}`}
                        onClick={() => removeLayout(name)}
                      >
                        <DeletePresetGlyph />
                      </button>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
          <button type="button" className="dashboard-preset-save" aria-expanded={namingLayout} onClick={toggleSaving}>
            <span className="dashboard-preset-save-mark" aria-hidden>
              <PlusGlyph />
            </span>
            <span>{text.settings.saveLayout}</span>
          </button>
          {namingLayout && (
            <div className="dashboard-preset-form">
              <TextField
                id="dashboard-layout-name"
                value={layoutName}
                onChange={(value) => setLayoutName(value.slice(0, DASHBOARD_LAYOUT_NAME_LENGTH))}
                onSubmit={saveNamedLayout}
                hint={text.settings.layoutName}
                label={text.settings.layoutName}
                selectOnShow
              />
              <div className="dashboard-preset-form-actions">
                <button type="button" className="dashboard-preset-form-button" onClick={toggleSaving}>
                  {text.settings.cancel}
                </button>
                <button
                  type="button"
                  className="dashboard-preset-form-button primary"
                  disabled={!layoutName.trim()}
                  onClick={saveNamedLayout}
                >
                  {text.settings.save}
                </button>
              </div>
            </div>
          )}
          <div className="dashboard-layout-preview" role="group" data-own-drag aria-label={text.settings.widgetLayout}>
            <div className="dashboard-preview-map" aria-hidden>
              <span className="dashboard-preview-route" />
              <span className="dashboard-preview-destination" />
              <span className="dashboard-preview-puck" />
            </div>
            <div className={drag ? 'dashboard-preview-column dragging' : 'dashboard-preview-column'} role="list">
              {shown.map((widget) => {
                const dragging = drag?.widget === widget
                const dropping = drag?.over === widget && drag.widget !== widget
                return (
                  <div
                    key={widget}
                    role="listitem"
                    data-widget={widget}
                    data-size={sizes[widget]}
                    aria-label={`${names[widget]}, ${sizeNames[sizes[widget]]}`}
                    title={`${names[widget]} — ${sizeNames[sizes[widget]]}`}
                    className={[
                      'dashboard-preview-widget',
                      dragging ? 'dragging' : '',
                      dropping ? (drag?.after ? 'drop-after' : 'drop-before') : '',
                    ]
                      .filter(Boolean)
                      .join(' ')}
                    onPointerDown={(event) => startWidgetDrag(event, widget)}
                    onClick={(event) => {
                      if (!suppressClick.current) return
                      event.preventDefault()
                      event.stopPropagation()
                    }}
                  >
                    <span className="dashboard-preview-icon" aria-hidden>
                      <WidgetGlyph widget={widget} />
                    </span>
                    <span className="dashboard-preview-name">{names[widget]}</span>
                    <span className="dashboard-preview-grip" aria-hidden />
                  </div>
                )
              })}
              {!shown.length && <p className="dashboard-preview-empty">{text.settings.noWidgets}</p>}
            </div>
          </div>
        </div>
      </Group>
      {/* One row per widget: its switch, its place in the player's order while Auto Order is off, and its size. */}
      <Group header={text.settings.widgets}>
        {order.map((widget, index) => (
          <WidgetLayoutRow
            key={widget}
            label={names[widget]}
            on={widgets[widget]}
            onToggle={(on) => setWidget(widget, on)}
            size={sizes[widget]}
            onSize={(size) => setSize(widget, size)}
            place={
              autoOrder
                ? undefined
                : { first: index === 0, last: index === order.length - 1, onMove: (by) => moveWidget(widget, by) }
            }
          />
        ))}
      </Group>
      <Group footer={text.settings.autoOrderFooter}>
        <SwitchRow label={text.settings.autoOrder} on={autoOrder} onToggle={setAutoOrder} />
      </Group>
      {/* The Dashboard's second screen: offered or not, and which cards it keeps — a page of its own, so this one
          stays about the widgets beside the map. */}
      <Group footer={text.settings.overviewFooter}>
        <NavRow
          label={text.diagnostics.overview}
          value={overviewShown ? text.diagnostics.on : text.diagnostics.off}
          onOpen={() => open('overview')}
        />
      </Group>
    </Page>
  )
}

/** The Dashboard's Overview: its second screen, offered or not, opened on, and which of its cards it shows. */
function OverviewPage() {
  const text = useText()
  const shown = useCabin((state) => state.overviewShown)
  const setShown = useCabin((state) => state.setOverviewShown)
  const openOn = useCabin((state) => state.overviewDefault)
  const setOpenOn = useCabin((state) => state.setOverviewDefault)
  const cards = useCabin((state) => state.overviewCards)
  const setCard = useCabin((state) => state.setOverviewCard)
  // The cards, by the names their pages use (the truck's readings are the Diagnostics page's).
  const names: Record<OverviewCard, string> = {
    trip: text.destination,
    truck: text.apps.diagnostics,
    hours: text.diagnostics.driverHours,
    media: text.nowPlaying,
    weather: text.apps.weather,
  }
  return (
    <Page title={text.diagnostics.overview}>
      <Group footer={text.settings.overviewFooter}>
        <SwitchRow label={text.settings.overviewScreen} on={shown} onToggle={setShown} />
        {shown && <SwitchRow label={text.settings.openOverview} on={openOn} onToggle={setOpenOn} />}
      </Group>
      {shown && (
        <Group header={text.settings.overviewCards}>
          {OVERVIEW_CARDS.map((card) => (
            <SwitchRow key={card} label={names[card]} on={cards[card]} onToggle={(on) => setCard(card, on)} />
          ))}
        </Group>
      )}
    </Page>
  )
}

/**
 * The instrument cluster WestPlay replaces on the trucks it is built for, in four parts: whether it is drawn at all,
 * what it carries, how it looks, and how its gauges read.
 *
 * Each card is listed with what it shows under its name, because a dash is not a screen of widgets a driver can
 * look at while the switch is flipped: "Engine" alone doesn't say that its readings leave the dash with it. The
 * readings that are always drawn are said in the cards' note, so nothing is quietly missing.
 *
 * The engine card's three readings are the player's choice (three slots, every one a gauge the Diagnostics app already
 * keeps), and the dial's own marks — the tacho's ring, the maker's mark, the accent — are here too: the panel is drawn
 * on the truck's screen, not in this window, so this page is the only place they can be chosen. The gauges' page is
 * the one place the level readings' figure is chosen — a share of the tank, or its litres — and it applies to the dash
 * and to nothing else (the Diagnostics app keeps its own units).
 */
function ClusterPage() {
  const text = useText()
  const words = text.diagnostics
  const shown = useCabin((state) => state.clusterShown)
  const setShown = useCabin((state) => state.setClusterShown)
  const cards = useCabin((state) => state.clusterCards)
  const setCard = useCabin((state) => state.setClusterCard)
  const gaugePercent = useCabin((state) => state.clusterGaugePercent)
  const setGaugePercent = useCabin((state) => state.setClusterGaugePercent)
  const accent = useCabin((state) => state.clusterAccent)
  const setAccent = useCabin((state) => state.setClusterAccent)
  const tacho = useCabin((state) => state.clusterTacho)
  const setTacho = useCabin((state) => state.setClusterTacho)
  const brand = useCabin((state) => state.clusterBrand)
  const setBrand = useCabin((state) => state.setClusterBrand)
  const readings = useCabin((state) => state.clusterReadings)
  const setReading = useCabin((state) => state.setClusterReading)
  const reset = useCabin((state) => state.resetCluster)
  const names: Record<ClusterCard, { name: string; detail: string }> = {
    trip: { name: words.trip, detail: text.settings.clusterCardTrip },
    fuel: { name: words.fuel, detail: text.settings.clusterCardFuel },
    engine: { name: words.engine, detail: text.settings.clusterCardEngine },
    hours: { name: words.driverHours, detail: text.settings.clusterCardHours },
    warnings: { name: words.warnings, detail: text.settings.clusterCardWarnings },
  }
  // The readings a slot can hold, by the names the Diagnostics app gives them: one list for every slot, so the same
  // gauge is called the same thing whichever slot it is in.
  const readingNames: Record<ClusterReading, string> = {
    oilTemperature: words.oilTemperature,
    coolant: words.coolant,
    brakeAir: words.brakeAir,
    battery: words.battery,
    adblue: words.adblue,
    brakeTemperature: words.brakeTemperature,
    consumption: text.settings.clusterReadingInstant,
  }
  const accentNames: Record<ClusterAccent, string> = {
    route: text.settings.clusterAccentRoute,
    play: text.settings.clusterAccentPlay,
    neutral: text.settings.clusterAccentNeutral,
  }
  return (
    <Page title={text.settings.clusterScreen}>
      <Group footer={text.settings.clusterFooter}>
        <SwitchRow label={text.settings.clusterSwitch} on={shown} onToggle={setShown} />
      </Group>
      {shown && (
        <Group header={text.settings.clusterCards} footer={text.settings.clusterCardsFooter}>
          {CLUSTER_CARDS.map((card) => (
            <SwitchRow
              key={card}
              label={names[card].name}
              detail={names[card].detail}
              on={cards[card]}
              onToggle={(on) => setCard(card, on)}
            />
          ))}
        </Group>
      )}
      {shown && <ClusterLayoutEditor />}
      {/* The engine card's three readings, a slot at a time. A reading already in another slot swaps with the one
          picked, so the card always shows three different gauges — the footer on the first slot says so. */}
      {shown &&
        cards.engine &&
        readings.map((reading, slot) => (
          <ChoiceRows<ClusterReading>
            key={slot}
            header={text.settings.clusterReadingSlot(slot + 1)}
            footer={slot === 0 ? text.settings.clusterReadingsFooter : undefined}
            radio={text.settings.clusterReadings}
            value={reading}
            options={CLUSTER_READINGS.map((id) => ({ id, label: readingNames[id] }))}
            onPick={(id) => setReading(slot, id)}
          />
        ))}
      {shown && (
        <Group header={text.settings.clusterDial} footer={text.settings.clusterDialFooter}>
          <SwitchRow label={text.settings.clusterTacho} on={tacho} onToggle={setTacho} />
          <SwitchRow label={text.settings.clusterBrandMark} on={brand} onToggle={setBrand} />
        </Group>
      )}
      {shown && (
        <ChoiceRows<ClusterAccent>
          header={text.settings.clusterAccent}
          footer={text.settings.clusterAccentFooter}
          radio={text.settings.clusterAccent}
          value={accent}
          options={CLUSTER_ACCENTS.map((id) => ({ id, label: accentNames[id] }))}
          onPick={setAccent}
        />
      )}
      {shown && (
        <Group header={text.settings.clusterGauges} footer={text.settings.clusterGaugeFooter}>
          <SwitchRow label={text.settings.clusterGaugePercent} on={gaugePercent} onToggle={setGaugePercent} />
        </Group>
      )}
      <Group>
        <button type="button" className="settings-row settings-action" onClick={reset}>
          {text.settings.resetCluster}
        </button>
      </Group>
    </Page>
  )
}

/**
 * The cluster's layout editor (Settings › Instrument Cluster): the two columns either side of the dial, live, with each
 * card in its place. A card is dragged to a side and a place in it — before or after the card it is dropped on, or at
 * the foot of a column left empty — and the same moves are offered as rows below for the keyboard, so nothing here
 * needs a pointer. A card that is turned off still holds its place in the layout, drawn dimmed, ready for its switch.
 */
function ClusterLayoutEditor() {
  const text = useText()
  const words = text.diagnostics
  const layout = useCabin((state) => state.clusterLayout)
  const cards = useCabin((state) => state.clusterCards)
  const applyLayout = useCabin((state) => state.applyClusterLayout)
  const units = useUnits()
  const placeCard = useCabin((state) => state.placeClusterCard)
  const moveCardTo = useCabin((state) => state.moveClusterCardTo)
  const moveCard = useCabin((state) => state.moveClusterCard)
  const names: Record<ClusterSideCard, string> = {
    trip: words.trip,
    engine: words.engine,
    hours: words.driverHours,
    fuel: words.fuel,
  }
  const presetNames: Record<ClusterLayoutPreset, string> = {
    standard: text.settings.presetClusterStandard,
    hours: text.settings.presetClusterHours,
    tank: text.settings.presetClusterTank,
  }
  const activePreset =
    CLUSTER_LAYOUT_PRESETS.find((preset) => matchesClusterLayout(CLUSTER_LAYOUTS[preset], layout)) ?? null
  const [drag, setDrag] = useState<ClusterCardDrag | null>(null)
  const press = useRef<ClusterCardPress | null>(null)

  const startDrag = (event: PointerEvent<HTMLDivElement>, card: ClusterSideCard) => {
    if (event.button !== 0) return
    // Keep the press's moves and release, even when the cursor leaves the card.
    event.currentTarget.setPointerCapture(event.pointerId)
    press.current = { card, pointerId: event.pointerId, x: event.clientX, y: event.clientY, dragging: false }
  }

  // The pointer's own drag, as the Dashboard's editor takes it: no native HTML5 drag, which WebView2 hands to the OS
  // and can lose the cabin's press.
  useEffect(() => {
    const move = (event: globalThis.PointerEvent) => {
      const held = press.current
      if (!held || held.pointerId !== event.pointerId) return
      if (!held.dragging) {
        if (Math.hypot(event.clientX - held.x, event.clientY - held.y) < 8) return
        held.dragging = true
        setDrag({ card: held.card, over: null, side: null, after: false })
      }
      event.preventDefault()
      const hit = clusterCardUnder(event.clientX, event.clientY)
      // Over the card in hand itself: nothing to drop on yet, so neither a card nor a column is marked.
      const side =
        hit && hit.card === held.card ? null : (hit?.side ?? clusterColumnUnder(event.clientX, event.clientY))
      setDrag((current) => {
        if (!current) return current
        const hitCard = hit && hit.card !== held.card ? hit : null
        const over = hitCard?.card ?? null
        const after = hitCard?.after ?? false
        return current.over === over && current.after === after && current.side === side
          ? current
          : { ...current, over, after, side }
      })
    }
    const up = (event: globalThis.PointerEvent) => {
      const held = press.current
      if (!held || held.pointerId !== event.pointerId) return
      press.current = null
      if (held.dragging) {
        const hit = clusterCardUnder(event.clientX, event.clientY)
        if (hit && hit.card === held.card) {
          // Let go over itself: it stays where it was.
        } else if (hit) {
          moveCardTo(held.card, hit.card, hit.after)
        } else {
          const side = clusterColumnUnder(event.clientX, event.clientY)
          if (side !== null) placeCard(held.card, side)
        }
      }
      setDrag(null)
    }
    const cancel = (event: globalThis.PointerEvent) => {
      const held = press.current
      if (!held || held.pointerId !== event.pointerId) return
      press.current = null
      setDrag(null)
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
    window.addEventListener('pointercancel', cancel)
    return () => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
      window.removeEventListener('pointercancel', cancel)
      press.current = null
    }
  }, [moveCardTo, placeCard])

  // One column of the preview, as the dash's own stands: the cards on that side in the player's order, each one taken
  // by the pointer or moved by the arrow keys — up and down its column, left and right across the dial. A card turned
  // off in the settings keeps its place, dimmed, ready for its switch. The tank's companions close the right column,
  // where they always are.
  const column = (side: ClusterSide) => (
    <div
      key={side}
      className="cluster-layout-column"
      data-cluster-column={side}
      data-drop={drag?.over === null && drag?.side === side ? 'end' : undefined}
      role="group"
      aria-label={side === 'left' ? text.settings.clusterSideLeft : text.settings.clusterSideRight}
    >
      {layout[side].map((card, place) => (
        <div
          key={card}
          tabIndex={0}
          className="cluster-layout-card"
          data-cluster-card={card}
          data-cluster-side={side}
          data-off={cards[card] ? undefined : ''}
          data-dragging={drag?.card === card ? '' : undefined}
          data-drop={drag?.over === card ? (drag.after ? 'after' : 'before') : undefined}
          // The card's share of the column, as the panel's own height: the engine's three readings stand taller than
          // the tank's gauge, and the preview says so before the dash does.
          style={{ '--card-weight': PREVIEW_WEIGHT[card] } as CSSProperties}
          aria-label={`${names[card]}, ${
            side === 'left' ? text.settings.clusterSideLeft : text.settings.clusterSideRight
          } ${place + 1} / ${layout[side].length}`}
          aria-keyshortcuts="ArrowUp ArrowDown ArrowLeft ArrowRight"
          onPointerDown={(event) => startDrag(event, card)}
          onKeyDown={(event) => {
            const key = event.key
            if (key === 'ArrowUp') moveCard(card, -1)
            else if (key === 'ArrowDown') moveCard(card, 1)
            else if (key === 'ArrowLeft' || key === 'ArrowRight') {
              const target: ClusterSide = key === 'ArrowLeft' ? 'left' : 'right'
              if (target === side) return
              // Across the dial, the card keeps its place in the column: the same number of cards stay above it.
              placeCard(card, target, place)
            } else return
            event.preventDefault()
            // A card moved to the other column is a new element there: the focus goes across with it.
            focusClusterCard(card)
          }}
        >
          <span className="cluster-layout-card-head">
            <span className="cluster-layout-card-glyph" aria-hidden>
              {PREVIEW_ICON[card]}
            </span>
            <span className="cluster-layout-card-name">{names[card]}</span>
          </span>
          <span className="cluster-layout-bars" data-card={card} aria-hidden>
            {PREVIEW_BARS[card].map((width, index) => (
              <i key={index} style={{ width: `${width}%` }} />
            ))}
          </span>
        </div>
      ))}
      {side === 'right' && <ClusterLayoutFixed />}
    </div>
  )

  return (
    <Group header={text.settings.clusterLayout} footer={text.settings.clusterLayoutFooter}>
      <div className="cluster-layout-editor">
        <div className="dashboard-layout-presets" role="group" aria-label={text.settings.clusterPresets}>
          {CLUSTER_LAYOUT_PRESETS.map((preset) => (
            <button
              key={preset}
              type="button"
              className="dashboard-layout-preset"
              aria-pressed={preset === activePreset}
              onClick={() => applyLayout(CLUSTER_LAYOUTS[preset])}
            >
              <ClusterLayoutShot layout={CLUSTER_LAYOUTS[preset]} />
              <span className="dashboard-preset-copy">
                <span className="dashboard-preset-name">{presetNames[preset]}</span>
                {preset === activePreset && (
                  <span className="dashboard-preset-check" aria-hidden>
                    <CheckGlyph />
                  </span>
                )}
              </span>
            </button>
          ))}
        </div>
        {/* The dash itself, in miniature: its status bar, the two columns and the dial between them. The columns are
              the layout — a card is put where it is to sit, and the picture is the setting. */}
        <div className="cluster-layout-preview" role="group" data-own-drag aria-label={text.settings.clusterLayout}>
          <div className="cluster-layout-rail" aria-hidden>
            <span className="cluster-layout-lamps">
              {[0, 1, 2, 3, 4].map((lamp) => (
                <i key={lamp} />
              ))}
            </span>
            <span className="cluster-layout-route" />
            <span className="cluster-layout-time">14:22</span>
          </div>
          {column('left')}
          <div className="cluster-layout-dial" aria-hidden>
            <b className="cluster-layout-speed">87</b>
            <span className="cluster-layout-unit">{units.labels.speed}</span>
          </div>
          {column('right')}
        </div>
      </div>
    </Group>
  )
}

/** A card's share of the preview's column: the panels' own heights, near enough — the engine's three readings stand
 * tallest, the tank's gauge shortest — so the picture says how full a side is before the dash does. */
const PREVIEW_WEIGHT: Record<ClusterSideCard, number> = {
  trip: 1.5,
  engine: 1.9,
  hours: 1.15,
  fuel: 1,
}

/** The mark each card wears in the preview: the same marks the dash draws on its panels. */
const PREVIEW_ICON: Record<ClusterSideCard, ReactElement> = {
  trip: <TripIcon />,
  engine: <GaugeIcon />,
  hours: <RestIcon />,
  fuel: <FuelIcon />,
}

/** The shape of each panel's content, as bars: the trip's figure and its two pairs, the engine's three readings, the
 * driver's two clocks, and the tank's gauge and foot. Enough to know the panels apart at a glance. */
const PREVIEW_BARS: Record<ClusterSideCard, readonly number[]> = {
  trip: [100, 62, 44],
  engine: [88, 64, 74],
  hours: [58, 46],
  fuel: [96, 40],
}

/** The readings that keep the right side whatever the layout: the tank's companions, drawn under its cards so the
 * editor shows what shares that column. They are the dash's own, not the player's to move. */
const FIXED_READINGS = [AdblueIcon, CoolantIcon, BrakeTemperatureIcon, DropIcon, WarningIcon]

function ClusterLayoutFixed() {
  const text = useText()
  return (
    <div className="cluster-layout-fixed" role="note" aria-label={text.settings.clusterLayoutFixed}>
      <span className="cluster-layout-fixed-name">{text.settings.clusterLayoutFixed}</span>
      {FIXED_READINGS.map((Icon, index) => (
        <span className="cluster-layout-fixed-row" key={index}>
          <Icon />
          <i />
        </span>
      ))}
    </div>
  )
}

/** Focus a preview card by name once the layout has been drawn: a card moved across the dial is a new element in the
 * other column, and the focus goes with it. */
function focusClusterCard(card: ClusterSideCard): void {
  requestAnimationFrame(() => {
    document.querySelector<HTMLElement>(`[data-cluster-card="${card}"]`)?.focus()
  })
}

/** A card being picked up in the layout preview, before it is moved far enough to be a drag. */
interface ClusterCardPress {
  card: ClusterSideCard
  pointerId: number
  x: number
  y: number
  dragging: boolean
}

/** A card being dragged: the card it would drop beside, and the side it is over. */
interface ClusterCardDrag {
  card: ClusterSideCard
  over: ClusterSideCard | null
  side: ClusterSide | null
  after: boolean
}

/** The preview card under a point, and which half of it the point is on: a drop goes before or after it. */
function clusterCardUnder(x: number, y: number): { card: ClusterSideCard; side: ClusterSide; after: boolean } | null {
  const element = document.elementFromPoint(x, y)?.closest<HTMLElement>('[data-cluster-card]')
  const card = element?.dataset.clusterCard as ClusterSideCard | undefined
  const side = element?.dataset.clusterSide as ClusterSide | undefined
  if (!element || !card || !side) return null
  const box = element.getBoundingClientRect()
  return { card, side, after: y > box.top + box.height / 2 }
}

/** The side of the preview a point is over (`null`: neither column). */
function clusterColumnUnder(x: number, y: number): ClusterSide | null {
  const element = document.elementFromPoint(x, y)?.closest<HTMLElement>('[data-cluster-column]')
  const side = element?.dataset.clusterColumn
  return side === 'left' || side === 'right' ? side : null
}

/** Whether the panel is already showing exactly this layout: its preset's button says so. */
function matchesClusterLayout(layout: ClusterLayout, other: ClusterLayout): boolean {
  return layout.left.join() === other.left.join() && layout.right.join() === other.right.join()
}

/** A preset's picture: the two columns of the dash's own size, each card a bar, and the dial between them. */
function ClusterLayoutShot({ layout }: { layout: ClusterLayout }) {
  return (
    <span className="cluster-layout-shot" aria-hidden>
      <span className="cluster-layout-shot-column">
        {layout.left.map((card) => (
          <i key={card} />
        ))}
      </span>
      <span className="cluster-layout-shot-dial" />
      <span className="cluster-layout-shot-column">
        {layout.right.map((card) => (
          <i key={card} />
        ))}
      </span>
    </span>
  )
}

/** The driver's units and the clock: both can follow the game's own settings, so they share one page rather than sit
 * among the screen's look. The sidebar's own clock — the player's time or the game's — is here too: it is the clock
 * the driver reads most. */
function UnitsPage() {
  const text = useText()
  const units = useCabin((state) => state.units)
  const setUnits = useCabin((state) => state.setUnits)
  const clockFormat = useCabin((state) => state.clockFormat)
  const setClockFormat = useCabin((state) => state.setClockFormat)
  const clock = useCabin((state) => state.clock)
  const setClock = useCabin((state) => state.setClock)
  return (
    <Page title={text.settings.unitsClock}>
      <ChoiceRows<UnitsChoice>
        header={text.settings.units}
        footer={text.settings.unitsFooter}
        radio="units"
        value={units}
        options={[
          { id: 'game', label: text.settings.unitsGame },
          { id: 'metric', label: text.settings.unitsMetric },
          { id: 'uk', label: text.settings.unitsUk },
          { id: 'us', label: text.settings.unitsUs },
        ]}
        onPick={setUnits}
      />
      <ChoiceRows<ClockChoice>
        header={text.settings.clockFormat}
        footer={text.settings.clockFormatFooter}
        radio="clockFormat"
        value={clockFormat}
        options={[
          { id: 'game', label: text.settings.clockFormatGame },
          { id: '24', label: text.settings.clockFormat24 },
          { id: '12', label: text.settings.clockFormat12 },
        ]}
        onPick={setClockFormat}
      />
      <Group footer={text.settings.clockFooter}>
        <SwitchRow
          label={text.settings.realClock}
          on={clock === 'real'}
          onToggle={(on) => setClock(on ? 'real' : 'game')}
        />
      </Group>
    </Page>
  )
}

/** A preset's picture: its map and every card it keeps, at the size it keeps. */
function LayoutShot({ layout }: { layout: DashboardLayout }) {
  return (
    <span className="dashboard-preset-shot" aria-hidden>
      <span className="dashboard-preset-shot-map" />
      <span className="dashboard-preset-shot-column">
        {layout.order
          .filter((widget) => layout.widgets[widget])
          .map((widget) => (
            <i key={widget} data-size={layout.sizes[widget]} />
          ))}
      </span>
    </span>
  )
}

/** A small line mark for each card in the editor's column, in the card's own colour. */
function WidgetGlyph({ widget }: { widget: DashboardWidget }) {
  const line = {
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: '1.8',
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
  }
  if (widget === 'nowPlaying') {
    return (
      <svg viewBox="0 0 24 24" aria-hidden>
        <path {...line} d="M9.5 17.5V6.8l8.5-1.6v10.4" />
        <ellipse cx="7" cy="18" rx="2.5" ry="2" fill="currentColor" />
        <ellipse cx="15.5" cy="16.2" rx="2.5" ry="2" fill="currentColor" />
      </svg>
    )
  }
  if (widget === 'destination') {
    return (
      <svg viewBox="0 0 24 24" aria-hidden>
        <path {...line} d="M12 21s6-5.4 6-11a6 6 0 1 0-12 0c0 5.6 6 11 6 11Z" />
        <circle cx="12" cy="10" r="2.3" fill="currentColor" />
      </svg>
    )
  }
  if (widget === 'driverHours') {
    return (
      <svg viewBox="0 0 24 24" aria-hidden>
        <circle {...line} cx="12" cy="12" r="8.5" />
        <path {...line} d="M12 7.5V12l3.2 2" />
      </svg>
    )
  }
  if (widget === 'driver') {
    return (
      <svg viewBox="0 0 24 24" aria-hidden>
        <circle {...line} cx="12" cy="8" r="3.2" />
        <path {...line} d="M5.5 20c.7-4 3.2-6 6.5-6s5.8 2 6.5 6" />
      </svg>
    )
  }
  if (widget === 'weather') {
    return (
      <svg viewBox="0 0 24 24" aria-hidden>
        <circle {...line} cx="8.2" cy="8" r="3" />
        <path {...line} d="M8.2 2.7v1.2M2.9 8h1.2M4.4 4.2l.9.8M12 4.2l-.9.8" />
        <path {...line} d="M8.5 19.5h8a3.2 3.2 0 0 0 .3-6.4 4.5 4.5 0 0 0-8.4-.4 2.8 2.8 0 0 0 .1 6.8Z" />
      </svg>
    )
  }
  return (
    <svg viewBox="0 0 24 24" aria-hidden>
      <path {...line} d="M4.2 16.5a8 8 0 0 1 15.6 0" />
      <path {...line} d="m12 16.5 4.2-5" />
      <circle cx="12" cy="16.5" r="1.6" fill="currentColor" />
    </svg>
  )
}

/** The marks on the preset buttons: a target for Focus, a play mark for Media, and the weather's sun and cloud. */
function PresetGlyph({ preset }: { preset: DashboardLayoutPreset }) {
  if (preset === 'focus') {
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
        <circle cx="12" cy="12" r="6.5" />
        <circle cx="12" cy="12" r="2.2" fill="currentColor" stroke="none" />
        <path d="M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3" />
      </svg>
    )
  }
  if (preset === 'media') {
    return (
      <svg viewBox="0 0 24 24" fill="currentColor">
        <path d="M8 5.5 19 12 8 18.5Z" />
      </svg>
    )
  }
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="8.5" cy="8" r="3" />
      <path d="M8.5 2.2v1.6M2.7 8h1.6M3.6 3.1l1.1 1.1M13.4 3.1l-1.1 1.1M8.5 13.8v1.4" />
      <path d="M8.5 19.5h8.2a3.3 3.3 0 0 0 .3-6.6 4.6 4.6 0 0 0-8.6-.4 2.9 2.9 0 0 0 .1 7Z" />
    </svg>
  )
}

/** A card held in the preview, before it's moved far enough to be a drag. */
interface WidgetPress {
  widget: DashboardWidget
  pointerId: number
  x: number
  y: number
  dragging: boolean
}

/** A widget being dragged around the preview, and the card it would drop beside. */
interface WidgetDrag {
  widget: DashboardWidget
  over: DashboardWidget | null
  after: boolean
}

/** The preview card under a point, and which half of it the point is on: a drop goes before or after it. */
function widgetUnder(x: number, y: number): { widget: DashboardWidget; after: boolean } | null {
  const element = document.elementFromPoint(x, y)?.closest<HTMLElement>('[data-widget]')
  const widget = element?.dataset.widget as DashboardWidget | undefined
  if (!element || !widget) return null
  const box = element.getBoundingClientRect()
  return { widget, after: y > box.top + box.height / 2 }
}

/** The plus on the save-layout button, the bookmark on a saved layout, and the bin that removes one. */
function PlusGlyph() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
      <path d="M12 5v14M5 12h14" />
    </svg>
  )
}

function SavedLayoutGlyph() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round">
      <path d="M6.5 4.5h11v15L12 16l-5.5 3.5z" />
    </svg>
  )
}

function DeletePresetGlyph() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M5 7h14M9.5 7V4.8h5V7M7.2 7l.8 12h8l.8-12M10 10.5v5M14 10.5v5" />
    </svg>
  )
}

/**
 * A widget's row in the layout editor: its switch and (while Auto Order is off) its arrows, with the three sizes
 * under them. The size stays with a widget that's turned off, ready for when it comes back.
 */
/** Whether the Dashboard is showing exactly this preset's order, widgets and sizes. */
function matchesDashboardLayout(
  layout: DashboardLayout,
  order: DashboardWidget[],
  widgets: Record<DashboardWidget, boolean>,
  sizes: Record<DashboardWidget, DashboardWidgetSize>,
): boolean {
  return (
    layout.order.every((widget, index) => order[index] === widget) &&
    layout.order.every((widget) => layout.widgets[widget] === widgets[widget] && layout.sizes[widget] === sizes[widget])
  )
}

function WidgetLayoutRow({
  label,
  on,
  onToggle,
  size,
  onSize,
  place,
}: {
  label: string
  on: boolean
  onToggle(on: boolean): void
  size: DashboardWidgetSize
  onSize(size: DashboardWidgetSize): void
  place?: { first: boolean; last: boolean; onMove(by: number): void }
}) {
  const text = useText()
  const sizeNames: Record<DashboardWidgetSize, string> = {
    compact: text.settings.widgetCompact,
    standard: text.settings.widgetStandard,
    expanded: text.settings.widgetExpanded,
  }
  return (
    <div className="settings-widget-row">
      <div className="settings-widget-main">
        <button
          type="button"
          role="switch"
          aria-checked={on}
          className="settings-manage-toggle"
          onClick={() => onToggle(!on)}
        >
          <span className="settings-label">{label}</span>
          <span className={on ? 'apple-switch on' : 'apple-switch'} aria-hidden>
            <span className="apple-switch-thumb" />
          </span>
        </button>
        {place && <OrderButtons label={label} first={place.first} last={place.last} onMove={place.onMove} />}
      </div>
      <div className="settings-widget-sizes">
        <span className="settings-widget-size-label">{text.settings.widgetSize}</span>
        <span
          className="settings-widget-size-options"
          role="group"
          aria-label={`${text.settings.widgetSize}: ${label}`}
        >
          {DASHBOARD_WIDGET_SIZES.map((choice) => (
            <button key={choice} type="button" aria-pressed={choice === size} onClick={() => onSize(choice)}>
              {sizeNames[choice]}
            </button>
          ))}
        </span>
      </div>
    </div>
  )
}

/**
 * Home Screen (Settings › Home Screen): one list of the apps, each with its switch (shown on Home or not), a pin
 * toggle (the sidebar's few), and — in the order they appear — the arrows that move it, as the Dashboard's widgets
 * are moved. An app hidden here keeps its place in the order, so showing it again puts it back where it was.
 */
function HomeScreenPage() {
  const text = useText()
  const order = useCabin((state) => state.homeOrder)
  const hidden = useCabin((state) => state.homeHidden)
  const setHidden = useCabin((state) => state.setHomeAppHidden)
  const move = useCabin((state) => state.moveHomeApp)
  const pinned = useCabin((state) => state.pinnedApps)
  const setPinned = useCabin((state) => state.setPinnedApp)
  const reset = useCabin((state) => state.resetHomeScreen)
  const names = text.apps
  return (
    <Page title={text.settings.homeScreen}>
      {/* One list per app: shown on Home or not, pinned to the sidebar or not (at its limit the rest are off), and
          where it stands — the pin toggle and the arrows beside its switch. */}
      <Group header={text.settings.showOnHome} footer={[text.settings.homeScreenFooter, text.settings.pinnedFooter]}>
        {order.map((app, index) => (
          <SwitchOrderRow
            key={app}
            label={names[app]}
            on={!hidden.includes(app)}
            onToggle={(on) => setHidden(app, !on)}
            place={{ first: index === 0, last: index === order.length - 1, onMove: (by) => move(app, by) }}
            pin={{
              pinned: pinned.includes(app),
              disabled: !pinned.includes(app) && pinned.length >= PINNED_LIMIT,
              label: pinned.includes(app) ? text.settings.unpinFromSidebar : text.settings.pinToSidebar,
              onToggle: () => setPinned(app, !pinned.includes(app)),
            }}
          />
        ))}
      </Group>
      <Group>
        <button type="button" className="settings-row settings-action" onClick={reset}>
          {text.settings.resetHomeScreen}
        </button>
      </Group>
    </Page>
  )
}

/** The words the map's settings read from (the text store's). */
type Words = ReturnType<typeof useText>

/** The map's words for each choice: they live across the app's own words and the destinations'. */
function detailNames(text: Words): Record<MapDetail, string> {
  return { high: text.settings.high, balanced: text.destinations.mapBalanced, low: text.settings.low }
}

function routeColourNames(text: Words): Record<MapRouteColour, string> {
  const words = text.destinations
  return { blue: words.routeBlue, teal: words.routeTeal, purple: words.routePurple, amber: words.routeAmber }
}

function routeWeightNames(text: Words): Record<MapRouteWeight, string> {
  const words = text.destinations
  return { thin: words.weightThin, standard: words.weightStandard, bold: words.weightBold }
}

function markerShapeNames(text: Words): Record<MapMarker, string> {
  const words = text.destinations
  return { arrow: words.markerArrow, dot: words.markerDot, truck: words.markerTruck }
}

function markerSizeNames(text: Words): Record<MapMarkerSize, string> {
  const words = text.destinations
  return { small: words.sizeSmall, medium: words.sizeMedium, large: words.sizeLarge }
}

function pinStyleNames(text: Words): Record<MapPinStyle, string> {
  const words = text.destinations
  return { filled: words.pinFilled, outlined: words.pinOutlined }
}

/**
 * Maps: the live map's settings, in four pages of their own — what it draws and how it comes back to the truck,
 * the traffic and the camera on the road, the route's line, and the markers and pins. This page is the way in,
 * each row saying what it is set to now, as the Settings list says its own rows.
 */
function MapsPage() {
  const text = useText()
  const words = text.destinations
  const open = useSettings((state) => state.open)
  const detail = useCabin((state) => state.mapDetail)
  const traffic = useCabin((state) => state.mapTraffic)
  const route = useCabin((state) => state.mapRoute)
  const weight = useCabin((state) => state.mapWeight)
  const pins = useCabin((state) => state.mapPins)
  const stopCardAlways = useCabin((state) => state.mapStopCardAlways)
  const stopCardFuel = useCabin((state) => state.mapStopCardFuel)
  const stopCardRest = useCabin((state) => state.mapStopCardRest)
  return (
    <Page title={text.apps.maps}>
      <Group>
        {' '}
        <NavRow
          tile="var(--apple-blue)"
          icon={<MapDisplayGlyph />}
          label={text.settings.mapsDisplay}
          value={detailNames(text)[detail]}
          onOpen={() => open('mapDisplay')}
        />
        <NavRow
          tile="var(--apple-orange)"
          icon={<MapTrafficGlyph />}
          label={words.mapTraffic}
          value={traffic ? text.diagnostics.on : text.diagnostics.off}
          onOpen={() => open('mapTraffic')}
        />
        <NavRow
          tile="var(--apple-purple)"
          icon={<MapRouteGlyph />}
          label={text.settings.mapsRoute}
          value={`${routeWeightNames(text)[weight]} · ${routeColourNames(text)[route]}`}
          onOpen={() => open('mapRoute')}
        />
        <NavRow
          tile="var(--apple-red)"
          icon={<MapPinsGlyph />}
          label={text.settings.mapsMarkers}
          value={pinStyleNames(text)[pins]}
          onOpen={() => open('mapMarkers')}
        />
        <NavRow
          tile="var(--apple-yellow)"
          icon={<StopCardGlyph />}
          label={text.settings.stopCard}
          value={stopCardAlways ? text.diagnostics.on : `${stopCardFuel}% · ${text.minutes(stopCardRest)}`}
          onOpen={() => open('mapStopCard')}
        />
      </Group>
    </Page>
  )
}

/**
 * Display: how much map there is to see (the detail it draws and the game's night), the controls on the map's own
 * face, and how long a map the player moved stays put before it comes back to the truck.
 */
function MapDisplayPage() {
  const text = useText()
  const words = text.destinations
  const detail = useCabin((state) => state.mapDetail)
  const setDetail = useCabin((state) => state.setMapDetail)
  const night = useCabin((state) => state.mapNight)
  const setNight = useCabin((state) => state.setMapNight)
  const nightStart = useCabin((state) => state.mapNightStart)
  const setNightStart = useCabin((state) => state.setMapNightStart)
  const north = useCabin((state) => state.mapNorth)
  const setNorth = useCabin((state) => state.setMapNorth)
  const limit = useCabin((state) => state.mapLimit)
  const setLimit = useCabin((state) => state.setMapLimit)
  const over = useCabin((state) => state.mapOver)
  const setOver = useCabin((state) => state.setMapOver)
  const compass = useCabin((state) => state.mapCompass)
  const setCompass = useCabin((state) => state.setMapCompass)
  const scale = useCabin((state) => state.mapScale)
  const setScale = useCabin((state) => state.setMapScale)
  const recentre = useCabin((state) => state.mapRecentre)
  const setRecentre = useCabin((state) => state.setMapRecentre)
  const details = detailNames(text)
  return (
    <Page title={text.settings.mapsDisplay}>
      <ChoiceRows
        header={words.mapDetail}
        radio={words.mapDetail}
        options={MAP_DETAILS.map((each) => ({ id: each, label: details[each] }))}
        value={detail}
        onPick={setDetail}
      />
      <Group>
        <SwitchRow label={words.mapNight} on={night} onToggle={setNight} />
      </Group>
      {/* When the night's dimming starts, with the night it belongs to. */}
      <ChoiceRows
        header={words.mapNightFrom}
        radio={words.mapNightFrom}
        options={MAP_NIGHT_STARTS.map((hour) => ({
          id: hour,
          label: `${String(hour).padStart(2, '0')}:00`,
        }))}
        value={nightStart}
        onPick={setNightStart}
      />
      <Group>
        <SwitchRow label={words.mapNorth} on={north} onToggle={setNorth} />
        <SwitchRow label={words.mapLimit} on={limit} onToggle={setLimit} />
        <SwitchRow label={words.mapOver} on={over} onToggle={setOver} />
        <SwitchRow label={words.mapCompass} on={compass} onToggle={setCompass} />
        <SwitchRow label={words.mapScale} on={scale} onToggle={setScale} />
      </Group>
      <ChoiceRows
        header={words.mapRecentre}
        radio={words.mapRecentre}
        options={MAP_RECENTRES.map((seconds) => ({
          id: seconds,
          label: seconds === 0 ? words.mapNever : `${seconds} s`,
        }))}
        value={recentre}
        onPick={setRecentre}
      />
    </Page>
  )
}

/**
 * Traffic: what the map draws of the road around the truck — the camera easing out at junctions, other players'
 * trucks, and the traffic — and how far around the traffic is drawn when no route is driven (in single player it's
 * estimated, as the game tells nothing of its AI traffic).
 */
function MapTrafficPage() {
  const text = useText()
  const units = useUnits()
  const words = text.destinations
  const junction = useCabin((state) => state.mapJunction)
  const setJunction = useCabin((state) => state.setMapJunction)
  const trucks = useCabin((state) => state.mapTrucks)
  const setTrucks = useCabin((state) => state.setMapTrucks)
  const traffic = useCabin((state) => state.mapTraffic)
  const setTraffic = useCabin((state) => state.setMapTraffic)
  const around = useCabin((state) => state.mapTrafficAround)
  const setAround = useCabin((state) => state.setMapTrafficAround)
  return (
    <Page title={words.mapTraffic}>
      <Group>
        <SwitchRow label={words.mapJunction} on={junction} onToggle={setJunction} />
        <SwitchRow label={words.mapTrucks} on={trucks} onToggle={setTrucks} />
        <SwitchRow label={words.mapTraffic} on={traffic} onToggle={setTraffic} />
      </Group>
      <ChoiceRows
        header={words.mapTraffic}
        radio={words.mapTraffic}
        options={MAP_TRAFFIC_AROUND.map((metres) => ({
          id: metres,
          label: metres === 0 ? words.mapNever : units.longDistance(metres / 1000, text.decimal),
        }))}
        value={around}
        onPick={setAround}
      />
    </Page>
  )
}

/** Route: the line the map draws to the destination, in its colour and its weight. */
function MapRoutePage() {
  const text = useText()
  const words = text.destinations
  const route = useCabin((state) => state.mapRoute)
  const setRoute = useCabin((state) => state.setMapRoute)
  const weight = useCabin((state) => state.mapWeight)
  const setWeight = useCabin((state) => state.setMapWeight)
  const colours = routeColourNames(text)
  const weights = routeWeightNames(text)
  return (
    <Page title={text.settings.mapsRoute}>
      <ChoiceRows
        header={words.routeColour}
        radio={words.routeColour}
        options={MAP_ROUTE_COLOURS.map((each) => ({ id: each, label: colours[each] }))}
        value={route}
        onPick={setRoute}
      />
      <ChoiceRows
        header={words.routeWeight}
        radio={words.routeWeight}
        options={MAP_ROUTE_WEIGHTS.map((each) => ({ id: each, label: weights[each] }))}
        value={weight}
        onPick={setWeight}
      />
    </Page>
  )
}

/** Markers and Pins: the truck's own mark on the map, and the places it draws of its own. */
function MapMarkersPage() {
  const text = useText()
  const words = text.destinations
  const marker = useCabin((state) => state.mapMarker)
  const setMarker = useCabin((state) => state.setMapMarker)
  const markerSize = useCabin((state) => state.mapMarkerSize)
  const setMarkerSize = useCabin((state) => state.setMapMarkerSize)
  const pins = useCabin((state) => state.mapPins)
  const setPins = useCabin((state) => state.setMapPins)
  const pinFuel = useCabin((state) => state.mapPinFuel)
  const setPinFuel = useCabin((state) => state.setMapPinFuel)
  const pinParking = useCabin((state) => state.mapPinParking)
  const setPinParking = useCabin((state) => state.setMapPinParking)
  const pinService = useCabin((state) => state.mapPinService)
  const setPinService = useCabin((state) => state.setMapPinService)
  const shapes = markerShapeNames(text)
  const sizes = markerSizeNames(text)
  const pinNames = pinStyleNames(text)
  return (
    <Page title={text.settings.mapsMarkers}>
      <ChoiceRows
        header={words.marker}
        radio={words.marker}
        options={MAP_MARKERS.map((each) => ({ id: each, label: shapes[each] }))}
        value={marker}
        onPick={setMarker}
      />
      <ChoiceRows
        header={words.markerSize}
        radio={words.markerSize}
        options={MAP_MARKER_SIZES.map((each) => ({ id: each, label: sizes[each] }))}
        value={markerSize}
        onPick={setMarkerSize}
      />
      <ChoiceRows
        header={words.pinStyle}
        radio={words.pinStyle}
        options={MAP_PIN_STYLES.map((each) => ({ id: each, label: pinNames[each] }))}
        value={pins}
        onPick={setPins}
      />
      <Group>
        <SwitchRow label={words.pinsFuel} on={pinFuel} onToggle={setPinFuel} />
        <SwitchRow label={words.pinsParking} on={pinParking} onToggle={setPinParking} />
        <SwitchRow label={words.pinsService} on={pinService} onToggle={setPinService} />
      </Group>
    </Page>
  )
}

/**
 * Stop Card: the card under turn-by-turn (NearbyStopCard.tsx) — always on the map, or only as the tank or the
 * driver's hours run low, at the level or time chosen.
 */
function MapStopCardPage() {
  const text = useText()
  const always = useCabin((state) => state.mapStopCardAlways)
  const setAlways = useCabin((state) => state.setMapStopCardAlways)
  const fuel = useCabin((state) => state.mapStopCardFuel)
  const setFuel = useCabin((state) => state.setMapStopCardFuel)
  const rest = useCabin((state) => state.mapStopCardRest)
  const setRest = useCabin((state) => state.setMapStopCardRest)
  return (
    <Page title={text.settings.stopCard}>
      <Group footer={text.settings.stopCardFooter}>
        <SwitchRow label={text.settings.stopCardAlways} on={always} onToggle={setAlways} />
      </Group>
      {!always && (
        <>
          <ChoiceRows
            header={text.settings.stopCardFuel}
            radio={text.settings.stopCardFuel}
            options={STOP_CARD_FUEL_LEVELS.map((level) => ({ id: level, label: `${level}%` }))}
            value={fuel}
            onPick={setFuel}
          />
          <ChoiceRows
            header={text.settings.stopCardRest}
            radio={text.settings.stopCardRest}
            options={STOP_CARD_REST_MINUTES.map((minutes) => ({ id: minutes, label: text.minutes(minutes) }))}
            value={rest}
            onPick={setRest}
          />
        </>
      )}
    </Page>
  )
}

/** The Stop Card row's tile glyph: the filling station's pump, in white on the yellow tile. */
function StopCardGlyph() {
  return (
    <svg
      viewBox="0 0 24 24"
      width="25"
      height="25"
      fill="none"
      stroke="#fff"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M5.5 21V5.5A2.5 2.5 0 0 1 8 3h4a2.5 2.5 0 0 1 2.5 2.5V21" />
      <path d="M3 21h14" />
      <path d="M7.8 6.4h4.4v3.9H7.8Z" />
      <path d="M14.5 9.5h1.7a1.6 1.6 0 0 1 1.6 1.6v5.7a2 2 0 0 0 4 0v-7.2L18.2 5.8" />
    </svg>
  )
}

/** The Maps row's tile glyph: the map's own folds, in white on the green tile. */
function MapGlyph() {
  return (
    <svg viewBox="0 0 24 24" width="25" height="25" fill="none" stroke="#fff" strokeWidth="1.7" aria-hidden>
      <path d="M3.5 6.5 9 4l6 2.5L20.5 4v13.5L15 20l-6-2.5-5.5 2.5Z" strokeLinejoin="round" />
      <path d="M9 4v13.5M15 6.5V20" />
    </svg>
  )
}

/** The album art on Now Playing and in Music. */
function NowPlayingPage() {
  const text = useText()
  const albumArt = useCabin((state) => state.albumArt)
  const setAlbumArt = useCabin((state) => state.setAlbumArt)
  return (
    <Page title={text.nowPlaying}>
      <Group>
        <SwitchRow label={text.settings.showAlbumArt} on={albumArt} onToggle={setAlbumArt} />
      </Group>
    </Page>
  )
}

/** Sound: the cabin's own interface sounds, and the Equalizer (the speakers' tone, per truck). */
function SoundPage() {
  const text = useText()
  const open = useSettings((state) => state.open)
  const custom = useCabin((state) => state.equalizerCustom)
  const sounds = useCabin((state) => state.uiSounds)
  const setSounds = useCabin((state) => state.setUiSounds)
  return (
    <Page title={text.settings.sound}>
      <Group footer={text.settings.uiSoundsFooter}>
        <SwitchRow label={text.settings.uiSounds} on={sounds} onToggle={setSounds} />
        <InterfaceSoundVolume />
      </Group>
      <Group>
        <NavRow
          label={text.settings.equalizer}
          value={custom ? text.settings.custom : text.settings.recommended}
          onOpen={() => open('equalizer')}
        />
      </Group>
    </Page>
  )
}

/** The voice assistant: its switch, the push-to-talk chord the companion sets, and what the player can say. */
function VoicePage() {
  const text = useText()
  const language = useLanguage()
  const truck = useLive((state) => state.truck)
  const phrase = wakePhrase(truck?.brand, language)
  const enabled = useCabin((state) => state.voiceEnabled)
  const setEnabled = useCabin((state) => state.setVoiceEnabled)
  const hotkey = useCabin((state) => state.voiceKey)
  const wake = useCabin((state) => state.voiceWake)
  const setWake = useCabin((state) => state.setVoiceWake)
  return (
    <Page title={text.settings.voiceAssistant}>
      <Group footer={text.settings.voiceAssistantFooter.replaceAll('{key}', hotkey)}>
        <SwitchRow label={text.settings.voiceAssistant} on={enabled} onToggle={setEnabled} />
        <div className="settings-row voice-hotkey-row">
          <span className="settings-label">{text.settings.voiceHotkey}</span>
          <kbd className="voice-hotkey">{hotkey}</kbd>
        </div>
      </Group>
      <Group footer={text.settings.voiceWakeFooter}>
        <SwitchRow label={text.settings.voiceWake} on={wake} onToggle={setWake} disabled={!enabled} />
        <div className="settings-row voice-wake-row">
          <span className="settings-label">{text.settings.voiceWakePhrase}</span>
          <span className="voice-wake-phrase">“{phrase}”</span>
        </div>
      </Group>
      <Group header={text.voice.commands} footer={text.voice.commandsHint}>
        <div className="voice-command-groups">
          {text.voice.groups.map((group) => (
            <section key={group.title} className="voice-command-group">
              <h3 className="voice-command-title">{group.title}</h3>
              <div className="voice-command-chips">
                {group.phrases.map((phrase) => (
                  <span key={phrase} className="voice-command-chip">
                    “{phrase}”
                  </span>
                ))}
              </div>
            </section>
          ))}
        </div>
      </Group>
    </Page>
  )
}

/** The interface cues' own level, independent of music and game audio. */
function InterfaceSoundVolume() {
  const text = useText()
  const volume = useCabin((state) => state.uiSoundVolume)
  const setVolume = useCabin((state) => state.setUiSoundVolume)
  const percent = Math.round(volume * 100)
  return (
    <div className="settings-volume">
      <div className="settings-volume-heading">
        <label htmlFor="interface-sound-volume">{text.settings.uiSoundVolume}</label>
        <output htmlFor="interface-sound-volume">{percent}%</output>
      </div>
      <input
        id="interface-sound-volume"
        className="settings-volume-slider"
        type="range"
        min="0"
        max="100"
        step="1"
        value={percent}
        aria-valuetext={`${percent}%`}
        style={{ '--volume-fill': `${percent}%` } as CSSProperties}
        onChange={(event) => setVolume(Number(event.currentTarget.value) / 100)}
      />
      <div className="settings-volume-scale" aria-hidden>
        <span>0%</span>
        <span>100%</span>
      </div>
    </div>
  )
}

/**
 * The players' tone, as iOS 27's AirPods Equalizer (owner 2026-10-22): Recommended (the speakers as tuned) or
 * Custom (the player's own curve, kept while Recommended plays); the track playing, to hear it by; and the
 * curve over its three bands, Low, Mid and High, each dragged up or down (one for every truck, ±6 dB).
 */
function EqualizerPage() {
  const text = useText()
  const custom = useCabin((state) => state.equalizerCustom)
  const curve = useCabin((state) => state.equalizer)
  const choose = useCabin((state) => state.chooseEqualizer)
  const reset = useCabin((state) => state.resetEqualizer)
  const flat = EQUALIZER_BANDS.every((band) => curve[band] === 0)
  // The music's spectrum, for the graph's waveform, while the page is open.
  useEffect(() => {
    if (!isInHost()) return
    postToHost({ type: 'spectrum', on: true })
    return () => postToHost({ type: 'spectrum', on: false })
  }, [])
  return (
    <Page title={text.settings.equalizer}>
      <ChoiceRows
        footer={text.settings.equalizerFooter}
        radio={text.settings.equalizer}
        value={custom ? 'custom' : 'recommended'}
        onPick={(id) => choose(id === 'custom')}
        options={[
          { id: 'recommended', label: text.settings.recommended },
          { id: 'custom', label: text.settings.custom },
        ]}
      />
      <Group>
        <TrackRow />
        {/* In a box of its own: the card's separator lines are drawn before its rows, which an svg can't take. */}
        <div>
          <EqualizerGraph />
        </div>
      </Group>
      <Group>
        <button type="button" className="settings-row settings-action" disabled={!custom || flat} onClick={reset}>
          {text.settings.resetEqualizer}
        </button>
      </Group>
    </Page>
  )
}
