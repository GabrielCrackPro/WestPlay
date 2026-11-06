import {
  type CSSProperties,
  type PointerEvent,
  type ReactNode,
  type RefObject,
  useEffect,
  useRef,
  useState,
} from 'react'
import { NoteGlyph, PauseGlyph, PlayGlyph } from '../music/glyphs'
import { useNowPlayingTrack } from '../../dashboard/useNowPlaying'
import { smoothThrough } from './curve'
import { setIcons, useLooks, useWallpapers } from '../../state/looks'
import { fileUrl, type IconSet, type IconStyle } from '../../../shared/customize'
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
import { pickVariant, prepareWallpaper } from '../../wallpapers'
import { type Appearance, resolveAppearance } from '../../state/appearance'
import { useLook, useScreenProfile } from '../../state/hooks'
import { type DashboardWidget, MAP_DETAILS, MAP_RECENTRES, type MapDetail, useCabin, useLive } from '../../state/store'
import { PINNED_LIMIT } from '../../state/apps'
import { useText } from '../../state/text'
import { TEXT_SIZES } from '../../state/textSize'
import {
  AppearanceGlyph,
  CheckGlyph,
  ChevronGlyph,
  DashboardGlyph,
  HomeGlyph,
  IconsGlyph,
  MapDisplayGlyph,
  MapPinsGlyph,
  MapRouteGlyph,
  MapTrafficGlyph,
  NowPlayingGlyph,
  PinGlyph,
  SoundGlyph,
  WallpaperGlyph,
} from './glyphs'
import { type SettingsPage, useSettings } from './settings'
import './settings.css'
import { cabClock, EQUALIZER_BANDS, EQUALIZER_MOST, type Equalizer, isInHost, postToHost } from '../../../shared/host'

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
    case 'nowPlaying':
      return <NowPlayingPage />
    case 'sound':
      return <SoundPage />
    case 'equalizer':
      return <EqualizerPage />
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

function ListPage() {
  const text = useText()
  const open = useSettings((state) => state.open)
  const mode = useCabin((state) => state.appearanceMode)
  const wanted = useWantedAppearance()
  const wallpapers = useWallpapers()
  const wallpaperId = useCabin((state) => state.wallpaperId)
  const iconSet = useLooks((state) => state.iconSet)
  const iconStyle = useLooks((state) => state.iconStyle)
  const detail = useCabin((state) => state.mapDetail)
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
      {/* The screen's own look, in one card: how it looks, what's on it, how its apps are drawn. */}
      <Group>
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
      {/* The apps' own settings, in the order they're met on the screen, the sound with the playing. */}
      <Group>
        <NavRow
          tile="var(--apple-indigo)"
          icon={<DashboardGlyph />}
          label={text.settings.dashboard}
          onOpen={() => open('dashboard')}
        />
        <NavRow
          tile="var(--apple-blue)"
          icon={<HomeGlyph />}
          label={text.settings.homeScreen}
          onOpen={() => open('home')}
        />
        <NavRow
          tile="var(--apple-green)"
          icon={<MapGlyph />}
          label={text.apps.maps}
          value={drawn[detail]}
          onOpen={() => open('map')}
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
      </Group>
    </Page>
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

/** Which widgets the Dashboard shows and the order they come in (Auto order: the drive's own), and which clock
 * the sidebar keeps: the player's own time or the game's. */
function DashboardPage() {
  const text = useText()
  const widgets = useCabin((state) => state.dashboardWidgets)
  const setWidget = useCabin((state) => state.setDashboardWidget)
  const clock = useCabin((state) => state.clock)
  const setClock = useCabin((state) => state.setClock)
  const autoOrder = useCabin((state) => state.autoOrder)
  const setAutoOrder = useCabin((state) => state.setAutoOrder)
  const order = useCabin((state) => state.dashboardOrder)
  const moveWidget = useCabin((state) => state.moveWidget)
  const names: Record<DashboardWidget, string> = {
    nowPlaying: text.nowPlaying,
    destination: text.destination,
    driverHours: text.diagnostics.driverHours,
    driver: text.apps.driver,
    weather: text.apps.weather,
    diagnostics: text.apps.diagnostics,
  }
  return (
    <Page title={text.settings.dashboard}>
      {/* One list per widget: what it shows and, while Auto order is off, where it stands. A widget's arrows are
          hidden while the cab orders the column itself, so the list is just its switches as it was. */}
      <Group header={text.settings.widgets}>
        {order.map((widget, index) => (
          <SwitchOrderRow
            key={widget}
            label={names[widget]}
            on={widgets[widget]}
            onToggle={(on) => setWidget(widget, on)}
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
          label: metres === 0 ? words.mapNever : `${metres / 1000} km`,
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

/** A row picked from those in its card, a blue tick on the one picked. */
function CheckRow({ label, on, onPick }: { label: string; on: boolean; onPick: () => void }) {
  return (
    <button type="button" role="radio" aria-checked={on} className="settings-row" onClick={onPick}>
      <span className="settings-label">{label}</span>
      {on && (
        <span className="settings-check">
          <CheckGlyph />
        </span>
      )}
    </button>
  )
}

/**
 * A card of choices: one row each, the one in force ticked. Every choice list in the app is drawn here — the
 * Maps page's ten, the icon styles, the Equalizer's two — so they read, tone and tick alike rather than each
 * spelling the rows out again.
 */
function ChoiceRows<T extends string | number>({
  header,
  footer,
  radio,
  options,
  value,
  onPick,
}: {
  header?: string
  footer?: string
  radio: string
  options: readonly { id: T; label: string }[]
  /** The one in force (`null`: none — the icon style while Android Auto's tiles are chosen). */
  value: T | null
  onPick(id: T): void
}) {
  return (
    <Group header={header} footer={footer} radio={radio}>
      {options.map((option) => (
        <CheckRow key={option.id} label={option.label} on={value === option.id} onPick={() => onPick(option.id)} />
      ))}
    </Group>
  )
}

/** The track Now Playing shows (the Dashboard's), to hear the tone by: its cover, title and artist, and a
 * button to play or pause it; none, an empty cover and the button greyed. */
function TrackRow() {
  const text = useText()
  const track = useNowPlayingTrack()
  const albumArt = useCabin((state) => state.albumArt)
  const cover = albumArt ? (track?.artwork ?? null) : null
  return (
    <div className="eq-track">
      <span className="eq-track-art">{cover ? <img src={cover} alt="" /> : track && <NoteGlyph size={32} />}</span>
      <span className="eq-track-lines">
        {track && <span className="eq-track-title">{track.title}</span>}
        {track && <span className="eq-track-by">{track.by}</span>}
      </span>
      <button
        type="button"
        className="eq-track-play"
        aria-label={track?.playing ? text.pause : text.play}
        disabled={!track?.playPause}
        onClick={() => track?.playPause?.()}
      >
        {track?.playing ? <PauseGlyph size={34} /> : <PlayGlyph size={34} />}
      </button>
    </div>
  )
}

/** The graph's drawing, in its own units: its width and height, where the three bands stand across it, and
 * how high a band is from its dB (flat in the middle, ±EQUALIZER_MOST at the top and bottom margins). */
const GRAPH = { width: 600, height: 300, top: 24, bottom: 236 }
const BAND_AT: Record<keyof Equalizer, number> = { bass: 100, mid: 300, treble: 500 }
const heightOf = (db: number) =>
  (GRAPH.top + GRAPH.bottom) / 2 - (db / EQUALIZER_MOST) * ((GRAPH.bottom - GRAPH.top) / 2)

/**
 * The curve over the three bands (Low, Mid, High: each a dashed line down the graph, the middle one's column
 * shaded), as iOS draws it: the music's waveform along the middle and, Custom, a smooth line through each
 * band's point over it. A band follows the finger up and down anywhere in its third of the graph, in whole
 * dB; moving one picks Custom.
 */
function EqualizerGraph() {
  const text = useText()
  const custom = useCabin((state) => state.equalizerCustom)
  const curve = useCabin((state) => state.equalizer)
  const setBand = useCabin((state) => state.setEqualizerBand)
  const svg = useRef<SVGSVGElement>(null)
  const [dragging, setDragging] = useState<keyof Equalizer | null>(null)
  const inGraph = (event: PointerEvent) => {
    const matrix = svg.current?.getScreenCTM()?.inverse()
    if (!matrix) return null
    return new DOMPoint(event.clientX, event.clientY).matrixTransform(matrix)
  }
  const drag = (band: keyof Equalizer, event: PointerEvent) => {
    const at = inGraph(event)
    if (!at) return
    const middle = (GRAPH.top + GRAPH.bottom) / 2
    const db = Math.round(((middle - at.y) / ((GRAPH.bottom - GRAPH.top) / 2)) * EQUALIZER_MOST)
    const kept = Math.max(-EQUALIZER_MOST, Math.min(EQUALIZER_MOST, db))
    if (kept !== curve[band] || !custom) setBand(band, kept)
  }
  // A band moved from the keyboard: the same whole dB a finger's drag picks, within the scale.
  const nudge = (band: keyof Equalizer, by: number) =>
    setBand(band, Math.max(-EQUALIZER_MOST, Math.min(EQUALIZER_MOST, curve[band] + by)))
  const shown = custom ? curve : { bass: 0, mid: 0, treble: 0 }
  const points: [number, number][] = [
    [0, heightOf(shown.bass)],
    ...EQUALIZER_BANDS.map((band): [number, number] => [BAND_AT[band], heightOf(shown[band])]),
    [GRAPH.width, heightOf(shown.treble)],
  ]
  const names: Record<keyof Equalizer, string> = {
    bass: text.settings.low,
    mid: text.settings.mid,
    treble: text.settings.high,
  }
  return (
    <svg
      ref={svg}
      className={dragging ? 'eq-graph dragging' : 'eq-graph'}
      viewBox={`0 0 ${GRAPH.width} ${GRAPH.height}`}
      role="group"
      aria-label={text.settings.equalizer}
      // Its own drags (the page's drag to scroll leaves them: shell/dragScroll.ts).
      data-own-drag
      onPointerDown={(event) => {
        const at = inGraph(event)
        if (!at) return
        const band: keyof Equalizer = at.x < GRAPH.width / 3 ? 'bass' : at.x < (2 * GRAPH.width) / 3 ? 'mid' : 'treble'
        event.currentTarget.setPointerCapture(event.pointerId)
        setDragging(band)
        drag(band, event)
      }}
      onPointerMove={(event) => dragging && drag(dragging, event)}
      onPointerUp={() => setDragging(null)}
      onPointerCancel={() => setDragging(null)}
    >
      <defs>
        <linearGradient id="eq-middle-column" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" className="eq-column-edge" />
          <stop offset="0.5" className="eq-column-middle" />
          <stop offset="1" className="eq-column-edge" />
        </linearGradient>
      </defs>
      <rect x={200} y={0} width={200} height={GRAPH.bottom + 14} fill="url(#eq-middle-column)" />
      {EQUALIZER_BANDS.map((band) => (
        <line key={band} className="eq-band-line" x1={BAND_AT[band]} x2={BAND_AT[band]} y1={8} y2={GRAPH.bottom + 6} />
      ))}
      <Waveform />
      {custom && (
        <>
          <path className="eq-curve" d={smoothThrough(points)} />
          {EQUALIZER_BANDS.map((band) => (
            <circle
              key={band}
              className={dragging === band ? 'eq-point dragged' : 'eq-point'}
              cx={BAND_AT[band]}
              cy={heightOf(curve[band])}
              r={14}
              role="slider"
              aria-label={names[band]}
              aria-valuemin={-EQUALIZER_MOST}
              aria-valuemax={EQUALIZER_MOST}
              aria-valuenow={curve[band]}
              aria-orientation="vertical"
              // Reached by Tab, each band's arrow keys move it as the finger does.
              tabIndex={0}
              onKeyDown={(event) => {
                const key = event.key
                if (key === 'ArrowUp' || key === 'ArrowRight') nudge(band, 1)
                else if (key === 'ArrowDown' || key === 'ArrowLeft') nudge(band, -1)
                else if (key === 'PageUp') nudge(band, 3)
                else if (key === 'PageDown') nudge(band, -3)
                else if (key === 'Home') nudge(band, -EQUALIZER_MOST)
                else if (key === 'End') nudge(band, EQUALIZER_MOST)
                else return
                event.preventDefault()
              }}
            />
          ))}
        </>
      )}
      {EQUALIZER_BANDS.map((band) => (
        <text key={band} className="eq-band-name" x={BAND_AT[band]} y={GRAPH.height - 16}>
          {names[band]}
        </text>
      ))}
    </svg>
  )
}

/** How many of the waveform's bars there are, and how far up and down from the middle the loudest reaches. */
const WAVEFORM = { bars: 48, reach: 84, thick: 6 }

/**
 * The music's waveform, as iOS draws it under the curve: a row of dots along the middle, each a part of the
 * music's spectrum (the lows on the left, the highs on the right, as the bands stand), growing up and down
 * with its loudness as it plays; stopped, or nothing playing, the dots at rest.
 */
function Waveform() {
  const bars = useLive((state) => state.spectrum)
  const step = (GRAPH.width - 2 * WAVEFORM.thick) / (WAVEFORM.bars - 1)
  return (
    <g className="eq-waveform">
      {Array.from({ length: WAVEFORM.bars }, (_, i) => {
        const loud = Math.min(1, Math.max(0, (bars[i] ?? 0) / 255))
        const tall = WAVEFORM.thick + loud * 2 * WAVEFORM.reach
        return (
          <rect
            key={i}
            x={WAVEFORM.thick / 2 + i * step}
            y={heightOf(0) - tall / 2}
            width={WAVEFORM.thick}
            height={tall}
            rx={WAVEFORM.thick / 2}
          />
        )
      })}
    </g>
  )
}

/**
 * A page: its content scrolling under a bar that holds the back button and the page's title. On the list,
 * the title is large at the top of the content, and the bar's small one takes over once it scrolls under.
 * Content scrolled under the bar fades and blurs away, iOS 26's edge.
 */
function Page({ title, list = false, children }: { title: string; list?: boolean; children: ReactNode }) {
  const text = useText()
  const back = useSettings((state) => state.back)
  const [scrolled, setScrolled] = useState(false)
  const [largeTitleGone, setLargeTitleGone] = useState(false)
  // More under the page's foot than shows: a small chevron at the bottom says so until the end is reached.
  const scroll = useRef<HTMLDivElement>(null)
  const [more, setMore] = useState(false)
  useMoreBelow(scroll, setMore)
  return (
    <>
      <div
        ref={scroll}
        className={list ? 'settings-scroll list' : 'settings-scroll'}
        onScroll={(event) => {
          const top = event.currentTarget.scrollTop
          setScrolled(top > 0)
          setLargeTitleGone(top > LARGE_TITLE_HEIGHT)
        }}
      >
        {list && <h1 className="settings-large-title">{title}</h1>}
        {children}
      </div>
      {more && (
        <span className="settings-more" aria-hidden>
          <ChevronGlyph />
        </span>
      )}
      <header className={scrolled ? 'settings-bar scrolled' : 'settings-bar'}>
        {!list && (
          <button type="button" className="settings-back" aria-label={text.settings.back} onClick={back}>
            <ChevronGlyph back />
          </button>
        )}
        <div className={!list || largeTitleGone ? 'settings-bar-title shown' : 'settings-bar-title'}>{title}</div>
      </header>
    </>
  )
}

/** How far the list scrolls before its large title is under the bar (settings.css: .settings-large-title). */
const LARGE_TITLE_HEIGHT = 56

/** Below this much left to scroll, the page is at its end (the chevron's own height, so it goes as it's reached). */
const MORE_BELOW = 24

/**
 * Whether a page has more under its foot than shows, measured whenever its content or its box changes (a page's
 * rows come and go: the Equalizer's curve, the map's lists) and as it scrolls. The chevron it drives sits over the
 * page's foot and takes no presses: it's a sign, not a control.
 */
function useMoreBelow(ref: RefObject<HTMLDivElement | null>, set: (more: boolean) => void) {
  useEffect(() => {
    const element = ref.current
    if (!element) return
    const measure = () => set(element.scrollHeight - element.scrollTop - element.clientHeight > MORE_BELOW)
    measure()
    // The box, and each of its parts (a group growing as rows are added to it).
    const observer = new ResizeObserver(measure)
    observer.observe(element)
    for (const child of Array.from(element.children)) observer.observe(child)
    element.addEventListener('scroll', measure, { passive: true })
    return () => {
      observer.disconnect()
      element.removeEventListener('scroll', measure)
    }
  }, [ref, set])
}

function Group({
  header,
  footer,
  radio,
  children,
}: {
  header?: string
  /** A note under the card, or one per line where the card answers more than one thing (Home's rows). */
  footer?: string | readonly string[]
  /** The rows are one choice between them (a tick on the one picked): the card is a radio group, named by this. */
  radio?: string
  children: ReactNode
}) {
  return (
    <div className="settings-group">
      {header && <h2 className="settings-group-header">{header}</h2>}
      <div className="settings-card" role={radio ? 'radiogroup' : undefined} aria-label={radio}>
        {children}
      </div>
      {(typeof footer === 'string' ? [footer] : (footer ?? [])).map((line) => (
        <p key={line} className="settings-group-footer">
          {line}
        </p>
      ))}
    </div>
  )
}

interface RowLabel {
  label: string
  /** A coloured tile with a white glyph before the label (rows on the list have one). */
  tile?: string
  icon?: ReactNode
}

function RowStart({ label, tile, icon }: RowLabel) {
  return (
    <>
      {tile && (
        <span className="settings-tile" style={{ background: tile } as CSSProperties}>
          {icon}
        </span>
      )}
      <span className="settings-label">{label}</span>
    </>
  )
}

/** A row that opens a page: its value in grey, and a chevron. */
function NavRow({ value, onOpen, ...start }: RowLabel & { value?: string; onOpen: () => void }) {
  return (
    <button type="button" className={start.tile ? 'settings-row with-tile' : 'settings-row'} onClick={onOpen}>
      <RowStart {...start} />
      {value && <span className="settings-value">{value}</span>}
      <span className="settings-chevron">
        <ChevronGlyph />
      </span>
    </button>
  )
}

/** A row with a switch; the whole row flips it (a big target on a truck's screen). */
function SwitchRow({
  on,
  onToggle,
  disabled = false,
  ...start
}: RowLabel & {
  on: boolean
  onToggle: (on: boolean) => void
  /** At a limit of its own (the sidebar's pins are full): the row says so rather than pretending to work. */
  disabled?: boolean
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      disabled={disabled}
      className={start.tile ? 'settings-row with-tile' : 'settings-row'}
      onClick={() => onToggle(!on)}
    >
      <RowStart {...start} />
      <span className={on ? 'apple-switch on' : 'apple-switch'} aria-hidden>
        <span className="apple-switch-thumb" />
      </span>
    </button>
  )
}

/**
 * A switch's row with the two buttons that move it, where its list can be reordered: the Dashboard's widgets
 * (only while Auto order is off) and Home's apps. Without a place the row is the plain switch row it always was;
 * with one, the name and switch stay a single target and the arrows sit beside it, at the row's end.
 */
function SwitchOrderRow({
  label,
  on,
  onToggle,
  place,
  pin,
}: {
  label: string
  on: boolean
  onToggle(on: boolean): void
  /** Where the row stands in its list: the ends can't be moved further. */
  place?: { first: boolean; last: boolean; onMove(by: number): void }
  /** The sidebar's pin, where the row has one (Home's apps): a compact toggle beside the switch. */
  pin?: { pinned: boolean; disabled: boolean; label: string; onToggle(): void }
}) {
  if (!place && !pin) return <SwitchRow label={label} on={on} onToggle={onToggle} />
  return (
    <div className="settings-row settings-manage">
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
      {pin && (
        <button
          type="button"
          aria-pressed={pin.pinned}
          aria-label={`${pin.label} ${label}`}
          title={`${pin.label} ${label}`}
          className="settings-pin"
          disabled={pin.disabled}
          onClick={pin.onToggle}
        >
          <PinGlyph pinned={pin.pinned} />
        </button>
      )}
      {place && <OrderButtons label={label} first={place.first} last={place.last} onMove={place.onMove} />}
    </div>
  )
}

/** The two buttons that move a row up or down its list: the app's own chevron, turned to point that way. */
function OrderButtons({
  label,
  first,
  last,
  onMove,
}: {
  label: string
  first: boolean
  last: boolean
  onMove(by: number): void
}) {
  const text = useText()
  return (
    <span className="settings-order-buttons">
      <button type="button" aria-label={`${text.settings.moveUp} ${label}`} disabled={first} onClick={() => onMove(-1)}>
        <span className="settings-move up" aria-hidden>
          <ChevronGlyph />
        </span>
      </button>
      <button type="button" aria-label={`${text.settings.moveDown} ${label}`} disabled={last} onClick={() => onMove(1)}>
        <span className="settings-move down" aria-hidden>
          <ChevronGlyph />
        </span>
      </button>
    </span>
  )
}
