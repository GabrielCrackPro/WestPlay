import { type CSSProperties, type PointerEvent, useEffect, useMemo, useRef, useState } from 'react'
import { SearchGlyph } from '../../keyboard/glyphs'
import { useKeyboard } from '../../keyboard/store'
import { wakePhrase } from '../../voice/wake'
import { TextField } from '../../keyboard/TextField'
import { EqualizerGraph, TrackRow } from './equalizer'
import { ChoiceRows, Group, NavRow, Page, SwitchOrderRow, SwitchRow } from './rows'
import { setIcons, useLooks, useWallpapers } from '../../state/looks'
import { fileUrl, type IconSet, type IconStyle } from '../../../shared/customize'
import type { ClockChoice } from '../../../shared/clock'
import type { UnitsChoice } from '../../../shared/units'
import { type AppIconRole, appIcon, type IconLook } from '../../../shared/icons'
import { pickVariant, prepareWallpaper } from '../../wallpapers'
import type { Appearance } from '../../state/appearance'
import { useLook, useScreenProfile } from '../../state/hooks'
import { type GpsDuckLead, type MapDetail, useCabin, useLive } from '../../state/store'
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
  NowPlayingGlyph,
  SoundGlyph,
  UnitsGlyph,
  VoiceGlyph,
  WallpaperGlyph,
} from './glyphs'
import { type SettingsEntry, searchSettings, settingsEntries } from './search'
import { type SettingsPage, useSettings } from './settings'
import './settings.css'
import '../../cluster/telltales.css'
import { EQUALIZER_BANDS, isInHost, postToHost } from '../../../shared/host'
import { ClusterPage } from './clusterPage'
import { DashboardPage, OverviewPage } from './dashboardPage'
import { MapDisplayPage, MapMarkersPage, MapRoutePage, MapStopCardPage, MapTrafficPage, MapsPage } from './mapsPages'
import { useWantedAppearance } from './useWantedAppearance'

/**
 * The Settings app, in iOS 26's Settings look: a large title, inset grouped cards, coloured tiles, chevrons
 * and pill switches, in Apple's colours (shell/apple.css). Only the player's own CarPlay choices live here;
 * WestPlay's management (the cab's sound, the companion's options) belongs to the companion window.
 *
 * Its list is in four sections, by the question a driver is asking: Screen (Appearance with Text Size, Wallpaper, App
 * Icons), The Cab (Dashboard with its Overview, Instrument Cluster, Units & Clock), Navigation (Maps, the game's GPS
 * Voice), and Apps (Home Screen, Now Playing, Sound with its Equalizer, Voice Assistant).
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
    case 'gpsVoice':
      return <GpsVoicePage />
    case 'equalizer':
      return <EqualizerPage />
    case 'voice':
      return <VoicePage />
    case 'textSize':
      return <TextSizePage />
  }
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
  const units = useCabin((state) => state.units)
  const clockFormat = useCabin((state) => state.clockFormat)
  const voice = useCabin((state) => state.voiceEnabled)
  const duck = useCabin((state) => state.gpsDuck)
  const lead = useCabin((state) => state.gpsDuckLead)
  const sign = useCabin((state) => state.gpsVoiceOnScreen)
  // What each row is set to now, as iOS's Settings says it: the screen's look, its wallpaper, its icons, how much the
  // map draws, which units and clock the readings are in, and the game's voice's two answers.
  const wallpaper = wallpapers.find((each) => each.id === wallpaperId) ?? wallpapers[0]
  const icons = iconStyle === 'android' ? 'Android Auto' : (iconSet ?? 'Cabin Play')
  const drawn: Record<MapDetail, string> = {
    high: text.settings.high,
    balanced: text.destinations.mapBalanced,
    low: text.settings.low,
  }
  // Automatic when both simply follow the game's own: there is nothing of the player's in the row to report.
  const unitsWords: Record<UnitsChoice, string> = {
    game: text.settings.unitsGame,
    metric: text.settings.unitsMetric,
    uk: text.settings.unitsUk,
    us: text.settings.unitsUs,
  }
  const clockWords: Record<ClockChoice, string> = {
    game: text.settings.clockFormatGame,
    '24': text.settings.clockFormat24,
    '12': text.settings.clockFormat12,
  }
  const unitsValue =
    [units === 'game' ? null : unitsWords[units], clockFormat === 'game' ? null : clockWords[clockFormat]]
      .filter(Boolean)
      .join(' · ') || text.settings.automatic
  // The voice's own row: how early the music steps aside, and that the screen's sign is off when it is — and where
  // neither is on, "Off". A dip switched off with the sign still on has its own words, so the row never says "Off"
  // over a screen that is still glowing.
  const voiceValue =
    [duck ? leadNames(text)[lead] : null, sign ? null : text.settings.gpsVoiceOff].filter(Boolean).join(' · ') ||
    (sign ? text.settings.gpsVoice : text.settings.gpsVoiceOff)
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
          {/* The list in four sections, by the question a driver is asking: how the screen looks, what the truck's
              own displays show, the navigation, and the apps. The cab's displays sit together — the dash, its
              Overview, the cluster — with the units and clock every reading is in, one page of their own rather than
              a footnote under Appearance. Navigation is apart from them because it follows the route rather than the
              cab: the map, and the game's own voice speaking over it, whose music dip and on-screen sign are that
              page's. */}
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
              tile="var(--apple-gray)"
              icon={<UnitsGlyph />}
              label={text.settings.unitsClock}
              value={unitsValue}
              onOpen={() => open('units')}
            />
          </Group>
          <Group header={text.settings.navSection}>
            <NavRow
              tile="var(--apple-green)"
              icon={<MapGlyph />}
              label={text.apps.maps}
              value={drawn[detail]}
              onOpen={() => open('map')}
            />
            <NavRow
              tile="var(--apple-blue)"
              icon={<RouteGlyph />}
              label={text.settings.gpsVoicePage}
              value={voiceValue}
              onOpen={() => open('gpsVoice')}
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
              value={voice ? text.diagnostics.on : text.diagnostics.off}
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

/** The GPS Voice row's tile glyph: the turn onto the way, in white on the blue tile. */
function RouteGlyph() {
  return (
    <svg
      viewBox="0 0 24 24"
      width="25"
      height="25"
      fill="none"
      stroke="#fff"
      strokeWidth={1.9}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M5.5 20v-6.5a5 5 0 0 1 5-5H18" />
      <path d="m14.5 5 3.5 3.5-3.5 3.5" />
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

/** The cabin's words, as the strings store hands them to a page (the same alias the map's pages keep). */
type Words = ReturnType<typeof useText>

/** The three How Early choices, as their rows read them. */
function leadNames(text: Words): Record<GpsDuckLead, string> {
  const s = text.settings
  return { just: s.gpsDuckLeadJust, few: s.gpsDuckLeadFew, early: s.gpsDuckLeadEarly }
}

/**
 * Sound: the cabin's own interface sounds and the Equalizer (the speakers' tone, per truck). The game's GPS voice is a
 * navigation matter and has its page under Navigation on the list, though its music dip is as much a sound.
 */
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

/**
 * GPS Voice (Settings › GPS Voice): the game's navigation voice, given room. The cab can neither hear it nor
 * set its volume, so all three settings here follow the turns it announces — the music dipping under it, how early
 * that dip begins, and the sign the screens show while it talks. They answer separately: a driver can keep the music
 * full and have only the sign, or have the music step aside with nothing on screen.
 */
function GpsVoicePage() {
  const text = useText()
  const duck = useCabin((state) => state.gpsDuck)
  const setDuck = useCabin((state) => state.setGpsDuck)
  const lead = useCabin((state) => state.gpsDuckLead)
  const setLead = useCabin((state) => state.setGpsDuckLead)
  const sign = useCabin((state) => state.gpsVoiceOnScreen)
  const setSign = useCabin((state) => state.setGpsVoiceOnScreen)
  return (
    <Page title={text.settings.gpsVoicePage}>
      <Group footer={text.settings.gpsDuckFooter}>
        <SwitchRow label={text.settings.gpsDuck} on={duck} onToggle={setDuck} />
      </Group>
      {/* How early it opens is the player's — the game decides when its voice speaks — and it means nothing with the
          dip switched off, so it is offered only while there is a dip to time. */}
      {duck && (
        <ChoiceRows<GpsDuckLead>
          header={text.settings.gpsDuckLead}
          footer={text.settings.gpsDuckLeadFooter}
          radio="gpsDuckLead"
          value={lead}
          options={[
            { id: 'just', label: text.settings.gpsDuckLeadJust },
            { id: 'few', label: text.settings.gpsDuckLeadFew },
            { id: 'early', label: text.settings.gpsDuckLeadEarly },
          ]}
          onPick={setLead}
        />
      )}
      {/* The voice itself can't be heard by the cab, so the screens say when it is talking instead. */}
      <Group footer={text.settings.gpsVoiceFooter}>
        <SwitchRow label={text.settings.gpsVoice} on={sign} onToggle={setSign} />
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
