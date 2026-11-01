import { type Backdrop, type Look, useWordsOver, wordsClass } from '../apps/music/contrast'
import { Crossfade } from '../apps/music/Crossfade'
import { VideoWidget } from '../apps/youtube/VideoWidget'
import { NextGlyph, NoteGlyph, PauseGlyph, PlayGlyph, PreviousGlyph } from '../apps/music/glyphs'
import { TrackSlide } from '../apps/music/TrackSlide'
import { useTrackTransition } from '../apps/music/useTrackTransition'
import { playOrPause, skip, useSpotify, useSpotifySource } from '../apps/spotify/spotify'
import {
  playOrPause as playOrPauseAppleMusic,
  skip as skipAppleMusic,
  useAppleMusic,
  useAppleMusicSource,
} from '../apps/music/appleMusic'
import {
  playOrPause as playOrPauseYouTubeMusic,
  skip as skipYouTubeMusic,
  useYouTubeMusic,
  useYouTubeMusicSource,
} from '../apps/youtubeMusic/youtubeMusic'
import type { MediaAction, MediaSource } from '../../shared/media'
import { useLook } from '../state/hooks'
import { go, useCabin } from '../state/store'
import { useMapData } from '../maps/mapData'
import { useLive } from '../state/store'
import { useText } from '../state/text'
import { nearestCity } from './destination'
import { useNowPlaying } from './useNowPlaying'
import { weatherView } from './weather'
import { WeatherGlyph } from './WeatherGlyph'
import { DiagnosticsGlyph } from './DiagnosticsGlyph'
import { FuelGlyph } from './FuelGlyph'
import { JobGlyph } from './JobGlyph'
import {
  EMPTY,
  useDestinationView,
  useDiagnosticsView,
  useFuelView,
  useGuided,
  useJobView,
  weatherFits,
} from './widgetState'
import { cabClock } from '../../shared/host'

/**
 * Now Playing: what plays, the video YouTube plays first (VideoWidget), then the Spotify app's music, then
 * Apple Music's (the Music app), then YouTube Music's; nothing playing, what played last (nowPlaying.ts); none
 * of them with anything, Not Playing. Turned off in Settings, its room goes to the others.
 */
export function NowPlayingWidget() {
  const shown = useCabin((state) => state.dashboardWidgets.nowPlaying)
  const { showing, spotify, appleMusic, youtubeMusic } = useNowPlaying()
  return (
    <div className={`widget-slot${shown ? ' open' : ''}`}>
      {shown && showing === 'video' && <VideoWidget />}
      {shown && showing === 'spotify' && spotify && <SpotifyWidget spotify={spotify} />}
      {shown && showing === 'appleMusic' && appleMusic && <AppleMusicWidget appleMusic={appleMusic} />}
      {shown && showing === 'youtubeMusic' && youtubeMusic && <YouTubeMusicWidget youtubeMusic={youtubeMusic} />}
      {shown && showing === null && <MusicWidget source={null} artwork={null} onControl={() => {}} />}
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
      }}
    />
  )
}

/** Behind Now Playing's words, in each look: the blurred cover at its opacity (dashboard.css) over the look's
 * glass, on the page behind an app (what's under the glass, roughly). */
const WIDGET_BACKDROPS: Record<Look, Backdrop> = {
  dark: { cover: 0.55, rest: [40, 40, 42] },
  light: { cover: 0.55, rest: [248, 248, 250] },
}

/**
 * Now Playing's music: a source's track, tinted by its album art (a blurred copy behind the glass). Track
 * changes animate (the new cover waited for, the text sliding, cover and tint crossfading). The track opens
 * its app (if CabinPlay has one for it); the controls work in place, on what's playing now. Over a cover the
 * look's words wouldn't read on, the other look's (a light cover: dark words); the glass and tint stay.
 */
function MusicWidget({
  source,
  artwork,
  onOpen,
  onControl,
}: {
  source: MediaSource | null
  artwork: string | null
  onOpen?(): void
  onControl(action: MediaAction): void
}) {
  const transition = useTrackTransition(source, artwork)
  const albumArt = useCabin((state) => state.albumArt)
  const cover = albumArt ? (transition.shown?.artwork ?? null) : null
  const controls = source?.controls
  const playing = source?.status === 'playing'
  const text = useText()
  const ink = useWordsOver(cover, useLook().appearance, WIDGET_BACKDROPS)

  return (
    <article className={`widget glass now-playing ${wordsClass(ink)}`}>
      <Crossfade value={cover} className="np-tint" render={(url) => url && <img src={url} alt="" aria-hidden />} />
      <button type="button" className="np-top" onClick={onOpen} disabled={!onOpen}>
        <Crossfade
          value={cover}
          className="art"
          render={(url) =>
            url ? (
              <img src={url} alt="" />
            ) : (
              <span className="art-placeholder" aria-hidden>
                <NoteGlyph size={36} />
              </span>
            )
          }
        />
        <TrackSlide
          transition={transition}
          className="track"
          layerClassName="track-lines"
          render={(track) => (
            <>
              <span className="title">{track?.source.title ?? text.notPlaying}</span>
              {track && <span className="artist">{track.source.artist}</span>}
            </>
          )}
        />
      </button>
      <div className="controls">
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
      </div>
    </article>
  )
}

/**
 * Where the truck is headed, our "live activity" (destination.ts): the job's pickup and then its delivery
 * (deadline and distance left), or where the game's route ends; folded away without either, as the
 * guidance card comes and goes.
 */
export function DestinationWidget() {
  const view = useDestinationView()
  const shown = useCabin((state) => state.dashboardWidgets.destination) && view !== EMPTY
  return (
    <div className={`widget-slot${shown ? ' open' : ''}`}>
      {shown && (
        <article className="widget glass job">
          <div className="kicker">{view.kicker}</div>
          <div className="destination">{view.title}</div>
          {view.subtitle && <div className="place">{view.subtitle}</div>}
          <div className={`deadline${view.late ? ' late' : ''}`}>{view.detail}</div>
        </article>
      )}
    </div>
  )
}

/**
 * The job: what the truck carries, what it pays, and the deadline (or the pickup still to make). The
 * destination card says where it goes; this one says what the work is worth and how long there is. Folded
 * away without a job, like the destination's card.
 */
export function JobWidget() {
  const text = useText()
  const view = useJobView()
  const shown = useCabin((state) => state.dashboardWidgets.job) && view !== null
  return (
    <div className={`widget-slot${shown ? ' open' : ''}`}>
      {shown && view && (
        <article className="widget glass job job-card" aria-label={text.job}>
          <div className="job-text">
            <div className="kicker">{text.job}</div>
            <div className="destination">{view.cargo}</div>
            <div className="place">{view.pay}</div>
            <div className={`deadline${view.late ? ' late' : ''}`}>{view.detail}</div>
          </div>
          <JobGlyph size={GLYPH} />
        </article>
      )}
    </div>
  )
}

/**
 * Fuel: what's left in the tank and how far it goes, on the job card's own layout (kicker, a big line, a line
 * under it) so the column's cards read alike. Folded away without either — no game, or a truck whose tank the
 * game hasn't read (widgetState.ts) — as the destination folds away without a job.
 */
export function FuelWidget() {
  const view = useFuelView()
  const shown = useCabin((state) => state.dashboardWidgets.fuel) && view !== null
  return (
    <div className={`widget-slot${shown ? ' open' : ''}`}>
      {shown && view && (
        <article className="widget glass job fuel" aria-label={view.kicker}>
          <div className="fuel-text">
            <div className="kicker">{view.kicker}</div>
            {view.range ? (
              <>
                <div className="destination">{view.range}</div>
                <div className="place">{view.litres}</div>
              </>
            ) : (
              <div className="destination">{view.litres}</div>
            )}
          </div>
          <FuelGlyph size={GLYPH} />
        </article>
      )}
    </div>
  )
}

/**
 * Diagnostics: the engine's coolant and the brake air on one card — the two readings a driver watches while
driving — on the fuel card's layout. A reading out of its range takes the tone, so a glance says whether
 * it's worth opening the app. Folded away without the game, like the fuel card.
 */
export function DiagnosticsWidget() {
  const view = useDiagnosticsView()
  const shown = useCabin((state) => state.dashboardWidgets.diagnostics) && view !== null
  return (
    <div className={`widget-slot${shown ? ' open' : ''}`}>
      {shown && view && (
        <button
          type="button"
          className="widget glass job diagnostics"
          aria-label={view.kicker}
          onClick={() => go({ type: 'openApp', app: 'diagnostics' })}
        >
          <div className="fuel-text">
            <div className="kicker">{view.kicker}</div>
            <div className={`destination ${view.coolantState}`}>{view.coolant}</div>
            <div className={`place ${view.airState}`}>{view.air}</div>
          </div>
          <DiagnosticsGlyph size={GLYPH} />
        </button>
      )}
    </div>
  )
}

/** The job and fuel cards' glyphs, the weather symbol's size. */
const GLYPH = 72

/**
 * The weather where the truck is, as CarPlay's weather widget (weather.ts): the nearest city, the weather
 * and its symbol. It comes in only where there's room (widgetState.ts): three widgets fill the column, four
 * with the fuel card up — so a full column without fuel holds what it always did, and nothing goes without
 * the weather (no game, or one whose weather isn't read), or turned off itself.
 */
export function WeatherWidget() {
  const text = useText()
  const labels = useMapData()?.labels
  const widgets = useCabin((state) => state.dashboardWidgets)
  const guided = useGuided()
  const destination = useDestinationView()
  const job = useJobView()
  const fuel = useFuelView()
  const diagnostics = useDiagnosticsView()
  const hasJob = job !== null
  const hasFuel = fuel !== null
  const others = [
    guided,
    widgets.nowPlaying,
    widgets.destination && destination !== EMPTY,
    widgets.job && hasJob,
    widgets.fuel && hasFuel,
    widgets.diagnostics && diagnostics !== null,
  ].filter(Boolean).length
  const room = widgets.weather && weatherFits(others)
  const weather = useLive((state) => state.weather)
  const gameTime = useLive((state) => (state.telemetry ? cabClock(state.telemetry, state.clockShift) : 0))
  const place = useLive((state) => {
    const t = state.telemetry
    return t && labels ? nearestCity([t.x, t.z], labels) : null
  })
  const view = weather ? weatherView(weather, gameTime, place, text) : null
  return (
    <div className={`widget-slot${room && view ? ' open' : ''}`}>
      {view && (
        <article className="widget glass weather" aria-label={[view.place, view.condition].filter(Boolean).join(', ')}>
          <div className="weather-text">
            {view.place && <div className="place">{view.place}</div>}
            <div className="condition">{view.condition}</div>
          </div>
          <WeatherGlyph symbol={view.symbol} size={84} />
        </article>
      )}
    </div>
  )
}
