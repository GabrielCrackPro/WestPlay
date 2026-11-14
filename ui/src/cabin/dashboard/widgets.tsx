import type { CSSProperties } from 'react'
import { flushSync } from 'react-dom'
import { type Backdrop, type Look, useWordsOver, wordsClass } from '../apps/music/contrast'
import { Crossfade } from '../apps/music/Crossfade'
import { VideoWidget } from '../apps/youtube/VideoWidget'
import {
  NextGlyph,
  NoteGlyph,
  PauseGlyph,
  PlayGlyph,
  PreviousGlyph,
  RepeatGlyph,
  RepeatOneGlyph,
  ShuffleGlyph,
} from '../apps/music/glyphs'
import { TrackSlide } from '../apps/music/TrackSlide'
import { useTrackTransition } from '../apps/music/useTrackTransition'
import {
  cycleRepeat as cycleRepeatSpotify,
  playOrPause,
  skip,
  toggleShuffle as toggleShuffleSpotify,
  useSpotify,
  useSpotifySource,
} from '../apps/spotify/spotify'
import {
  cycleRepeat as cycleRepeatAppleMusic,
  playOrPause as playOrPauseAppleMusic,
  skip as skipAppleMusic,
  toggleShuffle as toggleShuffleAppleMusic,
  useAppleMusic,
  useAppleMusicSource,
} from '../apps/music/appleMusic'
import {
  cycleRepeat as cycleRepeatYouTubeMusic,
  playOrPause as playOrPauseYouTubeMusic,
  skip as skipYouTubeMusic,
  toggleShuffle as toggleShuffleYouTubeMusic,
  useYouTubeMusic,
  useYouTubeMusicSource,
} from '../apps/youtubeMusic/youtubeMusic'
import {
  pauseHere as pauseRadio,
  resumeHere as resumeRadio,
  tune as tuneRadio,
  useRadio,
  useRadioSource,
} from '../apps/radio/radio'
import { hueOf, initialsOf } from '../apps/radio/stations'
import './radioCard.css'
import type { MediaAction, MusicService, MediaSource } from '../../shared/media'
import type { AppId } from '../state/apps'
import { useLook } from '../state/hooks'
import { type DashboardWidget, go, useCabin } from '../state/store'
import { useMapData } from '../maps/mapData'
import { showWidgetSize } from '../shell/hud'
import { useLive } from '../state/store'
import { useText } from '../state/text'
import { nearestCity } from './destination'
import { clock, useAnythingLoaded, useNowPlaying, useProgress } from './useNowPlaying'
import { weatherView } from './weather'
import { WeatherGlyph } from './WeatherGlyph'
import type { State } from '../apps/diagnostics/readings'
import { DiagnosticsGlyph } from './DiagnosticsGlyph'
import { JobGlyph } from './JobGlyph'
import { EMPTY, useDestinationView, useDiagnosticsView, useDriverHoursView } from './widgetState'
import { HoursTabIcon } from '../apps/diagnostics/tabIcons'
import { cabClock } from '../../shared/host'
import { DriverPortrait } from '../apps/driver/DriverPortrait'

/**
 * Now Playing: what plays, the video YouTube plays first (VideoWidget), then the Spotify app's music, then
 * Apple Music's (the Music app), then YouTube Music's, then the Radio app's station. Only while a player has
 * something — playing or paused:
 * a paused song keeps its card, and its controls bring it back — so nothing loaded at all leaves the card away,
 * the column's room going to the drive's own cards and the map. Turned off in Settings, its room goes to the
 * others too.
 */
export function NowPlayingWidget() {
  const shown = useCabin((state) => state.dashboardWidgets.nowPlaying)
  const size = useWidgetSize('nowPlaying')
  const { showing, spotify, appleMusic, youtubeMusic, radio } = useNowPlaying()
  const open = shown && showing !== null
  const compact = size === 'compact'
  // A video keeps its own card: the compact player is the music cards' (MusicWidget).
  const video = open && showing === 'video'
  const tight = open && compact && !video
  return (
    <div
      className={`widget-slot${open ? ' open' : ''}${video ? ' video' : ''}${tight ? ' compact' : ''}`}
      data-size={size}
      style={{ viewTransitionName: 'widget-nowPlaying' }}
    >
      {open && showing === 'video' && <VideoWidget />}
      {open && showing === 'spotify' && spotify && <SpotifyWidget spotify={spotify} />}
      {open && showing === 'appleMusic' && appleMusic && <AppleMusicWidget appleMusic={appleMusic} />}
      {open && showing === 'youtubeMusic' && youtubeMusic && <YouTubeMusicWidget youtubeMusic={youtubeMusic} />}
      {open && showing === 'radio' && radio && <RadioWidget radio={radio} />}
    </div>
  )
}

/** Apple Music's music (the Music app's): what plays, its controls, opening Music on Now Playing. */
function AppleMusicWidget({ appleMusic }: { appleMusic: NonNullable<ReturnType<typeof useAppleMusicSource>> }) {
  return (
    <MusicWidget
      source={appleMusic.source}
      artwork={appleMusic.artwork}
      onOpen={() => {
        useAppleMusic.setState({ nowPlaying: true })
        go({ type: 'openApp', app: 'music' })
      }}
      onControl={(action) => {
        if (action === 'playPause') playOrPauseAppleMusic()
        else if (action === 'next') skipAppleMusic(1)
        else if (action === 'previous') skipAppleMusic(-1)
        else if (action === 'toggleShuffle') toggleShuffleAppleMusic()
        else if (action === 'cycleRepeat') cycleRepeatAppleMusic()
      }}
    />
  )
}

/** YouTube Music's music: what plays, its controls, opening YouTube Music on Now Playing. */
function YouTubeMusicWidget({ youtubeMusic }: { youtubeMusic: NonNullable<ReturnType<typeof useYouTubeMusicSource>> }) {
  return (
    <MusicWidget
      source={youtubeMusic.source}
      artwork={youtubeMusic.artwork}
      onOpen={() => {
        useYouTubeMusic.setState({ nowPlaying: true })
        go({ type: 'openApp', app: 'youtubeMusic' })
      }}
      onControl={(action) => {
        if (action === 'playPause') playOrPauseYouTubeMusic()
        else if (action === 'next') skipYouTubeMusic(1)
        else if (action === 'previous') skipYouTubeMusic(-1)
        else if (action === 'toggleShuffle') toggleShuffleYouTubeMusic()
        else if (action === 'cycleRepeat') cycleRepeatYouTubeMusic()
      }}
    />
  )
}

/** The Spotify app's music: what Spotify plays, its controls, opening the Spotify app on Now Playing. */
function SpotifyWidget({ spotify }: { spotify: NonNullable<ReturnType<typeof useSpotifySource>> }) {
  return (
    <MusicWidget
      source={spotify.source}
      artwork={spotify.artwork}
      onOpen={() => {
        useSpotify.setState({ nowPlaying: true })
        go({ type: 'openApp', app: 'spotify' })
      }}
      onControl={(action) => {
        if (action === 'playPause') playOrPause()
        else if (action === 'next') skip(1)
        else if (action === 'previous') skip(-1)
        else if (action === 'toggleShuffle') toggleShuffleSpotify()
        else if (action === 'cycleRepeat') cycleRepeatSpotify()
      }}
    />
  )
}

/**
 * The Radio app's station: drawn as the app's set is — the station's initials on its own colour where a song shows
 * its cover, and the tuning dial under its name, lit on the station among the game's list. A live stream has no
 * length, so the card has no progress bar; its next and previous tune the set on through the stations.
 */
function RadioWidget({ radio }: { radio: NonNullable<ReturnType<typeof useRadioSource>> }) {
  const stations = useRadio((state) => state.stations)
  const station = useRadio((state) => state.station)
  const at = station ? stations.findIndex((each) => each.url === station.url) : -1
  return (
    <MusicWidget
      source={radio.source}
      artwork={null}
      tile={{ hue: hueOf(radio.source.title), initials: initialsOf(radio.source.title) }}
      dial={{ at, of: stations.length }}
      onOpen={() => go({ type: 'openApp', app: 'radio' })}
      onControl={(action) => {
        if (action === 'playPause') {
          if (radio.source.status === 'playing') pauseRadio()
          else resumeRadio()
        } else if (action === 'next') tuneRadio(1)
        else if (action === 'previous') tuneRadio(-1)
      }}
    />
  )
}

/** A player's app, whose own name the card shows above the track: Apple Music is the Music app's. */
const SERVICE_APPS: Record<MusicService, AppId> = {
  appleMusic: 'music',
  spotify: 'spotify',
  youTubeMusic: 'youtubeMusic',
  radio: 'radio',
}

/** How many ticks a dial draws at most: the game's list has hundreds of stations, and a card has one width. */
const MOST_TICKS = 61

/** Behind Now Playing's words, in each look: the blurred cover at its opacity (dashboard.css) over the look's
 * glass, on the page behind an app (what's under the glass, roughly). */
const WIDGET_BACKDROPS: Record<Look, Backdrop> = {
  dark: { cover: 0.55, rest: [40, 40, 42] },
  light: { cover: 0.55, rest: [248, 248, 250] },
}

/**
 * Now Playing's music: a source's track, tinted by its album art (a blurred copy behind the glass). Track
 * changes animate (the new cover waited for, the text sliding, cover and tint crossfading). The card holds two
 * presses: the cover opens its player's app on what it plays (`onOpen`), and the name and artist turn the card over
 * between its full size and the compact player, saying so on the HUD (`resize`). The controls work in place, on what's
 * playing now. Over a cover the look's words wouldn't read on, the other look's (a light cover: dark words); the glass
 * and tint stay.
 */
function MusicWidget({
  source,
  artwork,
  tile,
  dial,
  onOpen,
  onControl,
}: {
  source: MediaSource | null
  artwork: string | null
  /** Instead of a cover: the player's own mark (the radio's station, on its own colour). */
  tile?: { hue: number; initials: string }
  /** Instead of a progress bar: where what plays sits among its player's own, the needle on `at`. */
  dial?: { at: number; of: number }
  /** The cover's press: the player's own app, opened on what it plays (the name's press is the size, `resize`). */
  onOpen?(): void
  onControl(action: MediaAction): void
}) {
  const transition = useTrackTransition(source, artwork)
  const albumArt = useCabin((state) => state.albumArt)
  const text = useText()
  const compact = useCabin((state) => state.dashboardWidgetSizes.nowPlaying === 'compact')
  const reduceMotion = useCabin((state) => state.reduceMotion)
  // Pressing the name turns the card over between the two sizes a player uses by hand (Settings › Dashboard still has
  // all three): the full card and the compact player, which leaves the column's room to the drive's own cards. The pill
  // says which way it went (shell/hud.ts), as the volume's does; the cover keeps opening the player's own app.
  const resize = () => {
    const next = compact ? 'standard' : 'compact'
    const change = () => useCabin.getState().setDashboardWidgetSize('nowPlaying', next)
    // The card turns over as one morph rather than a jump, and the column's other cards slide to their new places: the
    // slots carry the View Transition names (Dashboard.tsx, dashboard.css), and this is a change of layout inside the
    // screen. Reduce Motion, a page without View Transitions and a screen change already animating all take the change
    // as it comes, as the column's reorder does.
    if (
      reduceMotion ||
      typeof document.startViewTransition !== 'function' ||
      document.documentElement.dataset.transition
    ) {
      change()
    } else {
      document.startViewTransition(() => flushSync(change)).finished.catch(() => {})
    }
    showWidgetSize(next === 'compact' ? text.settings.widgetCompact : text.settings.widgetStandard)
  }
  const cover = albumArt ? (transition.shown?.artwork ?? null) : null
  const controls = source?.controls
  const playing = source?.status === 'playing'
  // How far into the track (its own player's time, ticking while it plays).
  const progress = useProgress(source)
  const ink = useWordsOver(cover, useLook().appearance, WIDGET_BACKDROPS)
  // The dial's ticks: a tick a station, up to a card's worth (a mod's list of hundreds would run past the card),
  // the one playing lit of them and the needle over it.
  const ticks = dial ? Math.min(dial.of, MOST_TICKS) : 0
  const lit = dial && dial.at >= 0 ? Math.round((dial.at * Math.max(0, ticks - 1)) / Math.max(1, dial.of - 1)) : -1
  const needle = !dial || dial.at < 0 || ticks < 2 ? '50%' : `${(lit / (ticks - 1)) * 100}%`

  return (
    <article
      className={`widget glass now-playing ${wordsClass(ink)}${compact ? ' compact' : ''}${playing ? ' is-playing' : ''}`}
    >
      <Crossfade value={cover} className="np-tint" render={(url) => url && <img src={url} alt="" aria-hidden />} />
      <div className="np-top">
        {/* The cover is the player's door, as it always was: a press opens its app on what it plays. */}
        <button
          type="button"
          className="np-open"
          aria-label={source ? text.apps[SERVICE_APPS[source.service]] : text.notPlaying}
          disabled={!onOpen}
          onClick={onOpen}
        >
          <Crossfade
            value={cover}
            className="art"
            render={(url) =>
              url ? (
                <img src={url} alt="" />
              ) : (
                <span
                  className={tile ? 'art-placeholder radio-art' : 'art-placeholder'}
                  style={tile ? ({ '--hue': String(tile.hue) } as CSSProperties) : undefined}
                  aria-hidden
                >
                  {tile ? <span className="radio-art-initials">{tile.initials}</span> : <NoteGlyph size={36} />}
                </span>
              )
            }
          />
        </button>
        {/* The name and the artist turn the card over between its sizes (`resize`). */}
        <button
          type="button"
          className="np-resize"
          aria-label={`${text.settings.widgetSize}: ${compact ? text.settings.widgetStandard : text.settings.widgetCompact}`}
          onClick={resize}
        >
          <TrackSlide
            transition={transition}
            className="track"
            layerClassName="track-lines"
            render={(track) => (
              <>
                {/* Which app plays it, above the name (the players' own names, in their language). */}
                {track && <span className="service">{text.apps[SERVICE_APPS[track.source.service]]}</span>}
                <span className="title">{track?.source.title ?? text.notPlaying}</span>
                {track && <span className="artist">{track.source.artist}</span>}
              </>
            )}
          />
        </button>
      </div>
      {/* How far among what its player plays: the radio's dial, the needle on its station. */}
      {dial && ticks > 0 && (
        <div className="np-dial" aria-hidden="true">
          {Array.from({ length: ticks }, (_, index) => (
            <span key={index} className={index === lit ? 'on' : ''} />
          ))}
          <span className="np-dial-needle" style={{ left: needle }} />
        </div>
      )}
      {/* How far in, and how long: the bar moves while it plays, the times either side of it. */}
      {progress && (
        <div className="np-progress">
          <span className="np-time">{clock(progress.position)}</span>
          <span className="np-bar" aria-hidden>
            <span style={{ width: `${Math.round((progress.position / progress.duration) * 100)}%` }} />
          </span>
          <span className="np-time">{clock(progress.duration)}</span>
        </div>
      )}
      {/* The transport, as CarPlay's: the song's moves, then — for a player that has them — shuffle and repeat,
          whose own state the card shows (a station has neither, and its card keeps the three). */}
      <div className={controls?.shuffle || controls?.repeat ? 'controls with-extras' : 'controls'}>
        {controls?.shuffle && (
          <button
            type="button"
            className={source?.shuffle ? 'side on' : 'side'}
            aria-label={text.shuffle}
            aria-pressed={source?.shuffle === true}
            onClick={() => onControl('toggleShuffle')}
          >
            <ShuffleGlyph size={30} />
          </button>
        )}
        <button
          type="button"
          aria-label={text.previous}
          disabled={!controls?.previous}
          onClick={() => onControl('previous')}
        >
          <PreviousGlyph size={34} />
        </button>
        <button
          type="button"
          aria-label={playing ? text.pause : text.play}
          disabled={!controls?.playPause}
          onClick={() => onControl('playPause')}
        >
          {playing ? <PauseGlyph size={40} /> : <PlayGlyph size={40} />}
        </button>
        <button type="button" aria-label={text.next} disabled={!controls?.next} onClick={() => onControl('next')}>
          <NextGlyph size={34} />
        </button>
        {controls?.repeat && (
          <button
            type="button"
            className={source && source.repeat !== 'off' ? 'side on' : 'side'}
            aria-label={text.repeat}
            aria-pressed={source ? source.repeat !== 'off' : false}
            onClick={() => onControl('cycleRepeat')}
          >
            {source?.repeat === 'track' ? <RepeatOneGlyph size={30} /> : <RepeatGlyph size={30} />}
          </button>
        )}
      </div>
    </article>
  )
}

/**
 * Where the truck is headed, our "live activity" (destination.ts): the job's pickup and then its delivery
 * (deadline and distance left), or where the game's route ends. A job also brings what it carries and what it
 * pays, so its work is on the same card as the place it goes. Folded away without either, as the guidance card
 * comes and goes.
 */
export function DestinationWidget() {
  const view = useDestinationView()
  const size = useWidgetSize('destination')
  const shown = useCabin((state) => state.dashboardWidgets.destination) && view !== EMPTY
  return (
    <div
      className={`widget-slot${shown ? ' open' : ''}`}
      data-size={size}
      style={{ viewTransitionName: 'widget-destination' }}
    >
      {shown && (
        <article className="widget glass job trip-card">
          <div className="kicker">{view.kicker}</div>
          <div className="destination">{view.title}</div>
          {view.subtitle && <div className="place">{view.subtitle}</div>}
          {view.detail && <div className={`deadline${view.late ? ' late' : ''}`}>{view.detail}</div>}
          {view.cargo && (
            <div className="job-meta">
              <JobGlyph size={26} />
              <span className="cargo">{view.cargo}</span>
              {view.pay && <span className="pay">{view.pay}</span>}
            </div>
          )}
        </article>
      )}
    </div>
  )
}

/**
 * Driver hours: the game's own rest stop and mandatory break, counting down, with the trip still to drive under
 * them (or the fuel's range without a route). Opening it shows the Diagnostics app's driver-hours page. Folded
 * away without the game.
 */
export function DriverHoursWidget() {
  const text = useText()
  const words = text.diagnostics
  const view = useDriverHoursView()
  const size = useWidgetSize('driverHours')
  const shown = useCabin((state) => state.dashboardWidgets.driverHours) && view !== null
  return (
    <div
      className={`widget-slot${shown ? ' open' : ''}`}
      data-size={size}
      style={{ viewTransitionName: 'widget-driverHours' }}
    >
      {shown && view && (
        <button
          type="button"
          className="widget glass driver-hours"
          aria-label={words.driverHours}
          onClick={() => {
            useCabin.getState().setDiagnosticsPage('driver')
            go({ type: 'openApp', app: 'diagnostics' })
          }}
        >
          <div className="hours-text">
            <div className="kicker">{words.driverHours}</div>
            <div className="hours-line">
              <span className={`hours-value ${view.restState}`}>{view.rest}</span>
              <span className="hours-label">{words.restStop}</span>
            </div>
            <div className="hours-line small">
              <span className={`hours-value ${view.breakState}`}>{view.break}</span>
              <span className="hours-label">{words.mandatoryBreak}</span>
            </div>
            <div className="hours-detail">{view.detail}</div>
          </div>
          <span className="hours-glyph">
            <HoursTabIcon />
          </span>
        </button>
      )}
    </div>
  )
}

/**
 * A profile-led snapshot of the driver and their lifetime totals, from the game's latest save: the same totals the
 * Driver app lays out in full (experience, distance, the time played and the fuel burnt, the cities found), so a
 * glance at the Dashboard says what the app would.
 */
export function DriverWidget() {
  const text = useText()
  const words = text.driver
  const career = useLive((state) => state.career)
  // A missing total is a dash with no unit after it, as the app's rows show it.
  const withUnit = (value: number | null | undefined, unit: string, digits = 0) =>
    value == null ? '—' : `${text.number(Number(value.toFixed(digits)))} ${unit}`
  const hours = (seconds: number | null | undefined) =>
    withUnit(seconds == null ? null : seconds / 3600, text.diagnostics.hours, 1)
  const xp = career?.experiencePoints == null ? '—' : `${text.number(career.experiencePoints)} XP`
  const distance =
    career?.totalDistanceMeters == null
      ? '—'
      : `${text.number(Math.round(career.totalDistanceMeters / 1000))} ${text.diagnostics.km}`
  const gameTime = hours(career?.gameTimeSeconds)
  const realTime = hours(career?.realTimeSeconds)
  const fuel = withUnit(career?.totalFuelLitres, text.diagnostics.litres)
  const cities = career?.visitedCities == null ? '—' : text.number(career.visitedCities)
  const size = useWidgetSize('driver')
  const shown = useCabin((state) => state.dashboardWidgets.driver)

  return (
    <div
      className={`widget-slot${shown ? ' open' : ''}`}
      data-size={size}
      style={{ viewTransitionName: 'widget-driver' }}
    >
      {shown && (
        <button
          type="button"
          className="widget glass driver-widget"
          aria-label={text.apps.driver}
          onClick={() => go({ type: 'openApp', app: 'driver' })}
        >
          <DriverPortrait className="driver-widget-portrait" />
          <div className="driver-widget-text">
            <div className="kicker">{text.apps.driver}</div>
            <div className="driver-widget-name">
              {career?.profileName || (career ? words.profile : words.noProfile)}
            </div>
            <div className="driver-widget-distance">{xp}</div>
            <div className="driver-widget-totals">
              <WidgetTotal label={words.totalDistance} value={distance} />
              <WidgetTotal label={words.gameTime} value={gameTime} />
              <WidgetTotal label={words.realTime} value={realTime} />
              <WidgetTotal label={words.fuelUsed} value={fuel} />
              <WidgetTotal label={words.citiesVisited} value={cities} />
            </div>
          </div>
        </button>
      )}
    </div>
  )
}

/** One of the card's lifetime totals: the app's figures, a step smaller, each under its name. */
function WidgetTotal({ label, value }: { label: string; value: string }) {
  return (
    <span className="driver-widget-total">
      <span className="driver-widget-total-label">{label}</span>
      <span className="driver-widget-total-value">{value}</span>
    </span>
  )
}

/**
 * Diagnostics: the engine's coolant and the brake air on one card — the readings a driver watches while
driving — with the fuel left in the tank, the AdBlue and the battery under them. A reading out of its range,
 * or the game's own warning, takes the tone, so a glance says whether it's worth opening the app. Folded away
 * without the game.
 */
export function DiagnosticsWidget() {
  const text = useText()
  const words = text.diagnostics
  const view = useDiagnosticsView()
  const size = useWidgetSize('diagnostics')
  const shown = useCabin((state) => state.dashboardWidgets.diagnostics) && view !== null
  return (
    <div
      className={`widget-slot${shown ? ' open' : ''}`}
      data-size={size}
      style={{ viewTransitionName: 'widget-diagnostics' }}
    >
      {shown && view && (
        <button
          type="button"
          className="widget glass job fuel diagnostics"
          aria-label={view.kicker}
          onClick={() => go({ type: 'openApp', app: 'diagnostics' })}
        >
          <div className="fuel-text">
            <div className="kicker">{view.kicker}</div>
            <div className={`destination ${view.coolantState}`}>{view.coolant}</div>
            <div className={`place ${view.airState}`}>{view.air}</div>
            <div className="diag-extra">
              <Extra label={words.fuel} value={view.fuel} state={view.fuelState} />
              <Extra label={words.adblue} value={view.adblue} state={view.adblueState} />
              <Extra label={words.battery} value={view.battery} state={view.batteryState} />
            </div>
          </div>
          <DiagnosticsGlyph size={GLYPH} />
        </button>
      )}
    </div>
  )
}

/** One of the diagnostics card's smaller readings: its name over its value. */
function Extra({ label, value, state }: { label: string; value: string; state: State }) {
  return (
    <span className={`diag-extra-item ${state}`}>
      <span className="diag-extra-label">{label}</span>
      <span className="diag-extra-value">{value}</span>
    </span>
  )
}

/** The fuel card's glyph, the weather symbol's size. */
const GLYPH = 72

/** The size the player chose for a widget (Settings › Dashboard): the slot's share of the column. */
function useWidgetSize(widget: DashboardWidget) {
  return useCabin((state) => state.dashboardWidgetSizes[widget])
}

/**
 * The weather where the truck is, as CarPlay's weather widget (weather.ts): the nearest city, the weather
 * and its symbol. It comes in only where there's room (widgetState.ts): three widgets fill the column — so the
 * cards that are up keep their size, and nothing goes without the weather (no game, or one whose weather isn't
 * read), or turned off itself.
 */
export function WeatherWidget() {
  const text = useText()
  const labels = useMapData()?.labels
  const widgets = useCabin((state) => state.dashboardWidgets)
  const destination = useDestinationView()
  const diagnostics = useDiagnosticsView()
  const driverHours = useDriverHoursView()
  const loaded = useAnythingLoaded()
  const others = [
    // Now Playing only while a player has something: nothing loaded, and the card is away, so it isn't one of
    // the column's.
    widgets.nowPlaying && loaded,
    widgets.destination && destination !== EMPTY,
    widgets.driverHours && driverHours !== null,
    widgets.diagnostics && diagnostics !== null,
  ].filter(Boolean).length
  // Weather is never dropped when the column is full: it comes in tight instead (a smaller card), so a widget the
  // player turned on doesn't disappear without saying why.
  const room = widgets.weather
  const tight = others >= 3
  const weather = useLive((state) => state.weather)
  const gameTime = useLive((state) => (state.telemetry ? cabClock(state.telemetry, state.clockShift) : 0))
  const place = useLive((state) => {
    const t = state.telemetry
    return t && labels ? nearestCity([t.x, t.z], labels) : null
  })
  // The wipers running say it rains now, before the game's own sky turns (weather.ts).
  const wipers = useLive((state) => state.telemetry?.wipers ?? false)
  const view = weather ? weatherView(weather, gameTime, place, text, wipers) : null
  const size = useWidgetSize('weather')
  return (
    <div
      className={`widget-slot${room && view ? ' open' : ''}`}
      data-size={size}
      style={{ viewTransitionName: 'widget-weather' }}
    >
      {room && view && (
        <article
          className={`widget glass weather${tight ? ' tight' : ''}`}
          aria-label={[view.place, view.condition].filter(Boolean).join(', ')}
        >
          <div className="weather-text">
            {view.place && <div className="place">{view.place}</div>}
            <div className="condition">{view.condition}</div>
          </div>
          <WeatherGlyph symbol={view.symbol} size={tight ? 60 : 84} />
        </article>
      )}
    </div>
  )
}
