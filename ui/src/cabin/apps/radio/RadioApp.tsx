import { type CSSProperties, useEffect, useState } from 'react'
import { SearchGlyph } from '../../keyboard/glyphs'
import { TextField } from '../../keyboard/TextField'
import { useText } from '../../state/text'
import { pauseHere, play, requestStations, resumeHere, setVolume, stopRadio, useRadio, type RadioStatus } from './radio'
import { favouritesOf, genreToShow, genresOf, groupsOf, hueOf, initialsOf, matchesOf, type Station } from './stations'
import '../../shell/appTabs.css'
import './radioApp.css'

/** The search field's id (one on screen: the keyboard types into it). */
const FIELD = 'radio-search'

/**
 * The Radio app, in CarPlay's shape (as Music's Now Playing is): the station playing across the top as CarPlay
 * draws a track — a square of the station's own colour, its name, the song it plays, and the transport under
 * them — and under it the game’s stations as CarPlay lists them, a tall row each (hit easily while driving),
 * by genre as the game’s radio menu sorts them, the player's favourites above them, and a search by name among
 * many. The set keeps its tuning and its volume between launches (radio.ts), as a car's radio does, and its
 * favourites, so the station a drive ended on is the one the next one starts from. A station plays on while the
 * player is elsewhere in the cab (its sound isn’t the app’s window’s), as a car radio does. Pressing Refresh
 * reads the game’s list again, for stations added in the game since WestPlay started.
 */
export function RadioApp() {
  const text = useText()
  const words = text.radioApp
  const stations = useRadio((state) => state.stations)
  const station = useRadio((state) => state.station)
  const tuned = useRadio((state) => state.tuned)
  const status = useRadio((state) => state.status)
  const failed = useRadio((state) => state.failed)
  const title = useRadio((state) => state.title)
  const volume = useRadio((state) => state.volume)
  const channels = useRadio((state) => state.channels)
  const channel = useRadio((state) => state.channel)
  const favourites = useRadio((state) => state.favourites)
  const toggleFavourite = useRadio((state) => state.toggleFavourite)
  // The genre shown: all of them, or one (a new list keeps a genre it still has); and the name searched for.
  const [genre, setGenre] = useState('all')
  const [query, setQuery] = useState('')
  useEffect(() => {
    requestStations()
  }, [])
  const matching = matchesOf(stations, query)
  const genres = genresOf(matching)
  // What the chips and the list follow: the genre picked, while the search still finds stations of it.
  const shownGenre = genreToShow(genres, genre)
  const groups = groupsOf(matching).filter((group) => shownGenre === 'all' || group.genre === shownGenre)
  // The player's favourites, the list's own copy of each, and only those the search finds.
  const loved = favouritesOf(stations, favourites).filter((each) => matchesOf([each], query).length > 0)
  // What the tuning steps across: the stations the list shows, in their order.
  const shown = groups.flatMap((group) => group.stations)
  // The set's face: what plays, or — before anything plays this launch — the station it was left on.
  const face = station ?? tuned
  const live = status === 'playing' || status === 'loading'
  const paused = station !== null && status === 'paused'
  const at = face ? shown.findIndex((each) => each.url === face.url) : -1
  const chips: [string, string][] = [
    ['all', words.all],
    ...genres.map((each): [string, string] => [each, each || words.other]),
  ]
  const isFavourite = (each: Station) => favourites.some((one) => one.url === each.url)

  /** Tunes to the station `step` on in the list shown, round from the ends. */
  const tune = (step: number) => {
    if (shown.length === 0) return
    const from = at < 0 ? (step > 0 ? -1 : 0) : at
    play(shown[(((from + step) % shown.length) + shown.length) % shown.length])
  }

  /** The face’s one button: the station playing pauses, one that isn’t plays on (or the one it was left on). */
  const power = () => {
    if (live) pauseHere()
    else resumeHere()
  }

  return (
    <section className="app-panel radio-app" aria-label={text.apps.radio}>
      <div className="radio-scroll">
        <div className="radio-page">
          <header className="radio-head">
            <div className="radio-title">
              <h1>{text.apps.radio}</h1>
              <p className="radio-sub">{stations.length > 0 ? words.summary(stations.length) : words.empty}</p>
            </div>
            <button type="button" className="radio-refresh" onClick={requestStations}>
              <RefreshGlyph />
              {words.refresh}
            </button>
          </header>
          {stations.length === 0 ? (
            <div className="radio-empty">
              <RadioGlyph />
              <p className="radio-empty-title">{words.empty}</p>
              <p className="radio-empty-hint">{words.hint}</p>
            </div>
          ) : (
            <>
              <section
                className="radio-now"
                style={{ '--hue': String(face ? hueOf(face.name) : 210) } as CSSProperties}
                aria-label={face ? face.name : undefined}
              >
                <div className="radio-now-text">
                  <p className={face ? 'radio-now-name' : 'radio-now-name idle'}>{face ? face.name : words.idle}</p>
                  {station && title ? (
                    <p className="radio-now-title" aria-live="polite">
                      {title}
                    </p>
                  ) : null}
                  <p className="radio-now-meta">{face ? metaOf(face) : words.summary(stations.length)}</p>
                  <p className="radio-now-state" aria-live="polite">
                    {failed === station?.url ? (
                      words.unavailable
                    ) : live ? (
                      <span className="radio-now-badge">{words.playingNow}</span>
                    ) : paused ? (
                      words.paused
                    ) : (
                      ''
                    )}
                  </p>
                </div>
                <div className="radio-now-art" aria-hidden="true">
                  {!face ? (
                    <RadioGlyph />
                  ) : live ? (
                    <WavesGlyph />
                  ) : (
                    <span className="radio-now-initials">{initialsOf(face.name)}</span>
                  )}
                </div>
                <div className="radio-now-controls">
                  <div className="radio-tunes">
                    <button
                      type="button"
                      className="radio-tune"
                      aria-label={words.previous}
                      onClick={() => tune(-1)}
                      disabled={shown.length < 2}
                    >
                      <PreviousGlyph />
                    </button>
                    <button
                      type="button"
                      className={live ? 'radio-power on' : 'radio-power'}
                      aria-label={live ? words.pause : words.play}
                      onClick={power}
                      disabled={!face}
                    >
                      {live ? <PauseGlyph /> : <PlayGlyph />}
                    </button>
                    <button
                      type="button"
                      className="radio-tune"
                      aria-label={words.next}
                      onClick={() => tune(1)}
                      disabled={shown.length < 2}
                    >
                      <NextGlyph />
                    </button>
                  </div>
                  <label className="radio-volume">
                    <VolumeGlyph />
                    <input
                      type="range"
                      min={0}
                      max={100}
                      value={Math.round(volume * 100)}
                      aria-label={words.volume}
                      onChange={(event) => setVolume(Number(event.target.value) / 100)}
                    />
                  </label>
                  {face ? (
                    <button
                      type="button"
                      className={isFavourite(face) ? 'radio-now-star on' : 'radio-now-star'}
                      aria-pressed={isFavourite(face)}
                      aria-label={isFavourite(face) ? words.removeFavourite : words.addFavourite}
                      onClick={() => toggleFavourite(face)}
                    >
                      <StarGlyph on={isFavourite(face)} />
                    </button>
                  ) : null}
                </div>
                {/* A station its playlist gives more than one stream (at more than one bitrate): the one playing, and
                    the others a press away. */}
                {station && channels.length > 1 ? (
                  <div className="radio-channels" role="group" aria-label={words.channels}>
                    {channels.map((each, index) => (
                      <button
                        key={each.url}
                        type="button"
                        className={index + 1 === channel ? 'radio-channel on' : 'radio-channel'}
                        aria-pressed={index + 1 === channel}
                        onClick={() => {
                          // The stream already playing is left playing: a press on it isn't a restart.
                          if (index + 1 !== channel || !live) play(station, index + 1)
                        }}
                      >
                        {each.name || words.stream(index + 1)}
                      </button>
                    ))}
                  </div>
                ) : null}
              </section>
              <div className="radio-filters">
                <div className="radio-search">
                  <TextField
                    id={FIELD}
                    value={query}
                    onChange={setQuery}
                    hint={words.search}
                    label={words.search}
                    icon={<SearchGlyph />}
                  />
                </div>
                <div className="radio-chips app-tabs pills" role="tablist" aria-label={text.apps.radio}>
                  {chips.map(([id, name]) => (
                    <button
                      key={id || 'other'}
                      type="button"
                      role="tab"
                      aria-selected={shownGenre === id}
                      className={shownGenre === id ? 'radio-chip app-tab on' : 'radio-chip app-tab'}
                      onClick={() => setGenre(id)}
                    >
                      <span className="app-tab-label">{name}</span>
                    </button>
                  ))}
                </div>
              </div>
              {groups.length === 0 && loved.length === 0 ? (
                <p className="radio-no-match">{words.noMatches}</p>
              ) : (
                <div className="radio-groups">
                  {/* The stations they picked, above the genres: a drive's own few, ready before any scrolling. */}
                  {shownGenre === 'all' && loved.length > 0 ? (
                    <section className="radio-group">
                      <h2>{words.favourites}</h2>
                      <div className="radio-list">
                        {loved.map((each) => (
                          <StationRow
                            key={each.url}
                            station={each}
                            now={station?.url === each.url}
                            status={status}
                            failed={failed === each.url}
                            favourite
                            onFavourite={() => toggleFavourite(each)}
                          />
                        ))}
                      </div>
                    </section>
                  ) : null}
                  {groups.map((group) => (
                    <section key={group.genre || 'other'} className="radio-group">
                      <h2>{group.genre || words.other}</h2>
                      <div className="radio-list">
                        {group.stations.map((each) => (
                          <StationRow
                            key={each.url}
                            station={each}
                            now={station?.url === each.url}
                            status={status}
                            failed={failed === each.url}
                            favourite={isFavourite(each)}
                            onFavourite={() => toggleFavourite(each)}
                          />
                        ))}
                      </div>
                    </section>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </section>
  )
}

/** A station as CarPlay lists one: its own colour at the left, its name, what it is, and its star at the right.
 * Pressed, it plays (or the one playing stops); its star keeps it above the genres. */
function StationRow({
  station,
  now,
  status,
  failed,
  favourite,
  onFavourite,
}: {
  station: Station
  now: boolean
  status: RadioStatus
  failed: boolean
  favourite: boolean
  onFavourite(): void
}) {
  const words = useText().radioApp
  const live = now && (status === 'playing' || status === 'loading')
  return (
    <div className={now ? 'radio-row now' : 'radio-row'}>
      <button
        type="button"
        className="radio-row-play"
        aria-current={now ? 'true' : undefined}
        onClick={() => (now && status !== 'paused' && status !== 'failed' ? stopRadio() : play(station))}
      >
        <span className="radio-row-art" style={{ '--hue': String(hueOf(station.name)) } as CSSProperties}>
          {live ? <WavesGlyph /> : <span className="radio-row-initials">{initialsOf(station.name)}</span>}
        </span>
        <span className="radio-row-text">
          <span className="radio-row-name">{station.name}</span>
          <span className="radio-row-meta">
            {failed
              ? words.unavailableTag
              : [station.genre || words.other, station.language].filter(Boolean).join(' · ')}
          </span>
        </span>
        {live ? <span className="radio-row-live">{words.playingNow}</span> : null}
        {now && status === 'paused' ? <span className="radio-row-live paused">{words.paused}</span> : null}
      </button>
      <button
        type="button"
        className={favourite ? 'radio-row-star on' : 'radio-row-star'}
        aria-pressed={favourite}
        aria-label={favourite ? words.removeFavourite : words.addFavourite}
        onClick={onFavourite}
      >
        <StarGlyph on={favourite} />
      </button>
    </div>
  )
}

/** What the face says of a station: its genre and language, and its bitrate when the game’s list gives one. */
function metaOf(station: Station): string {
  return [station.genre, station.language, station.bitrate > 0 ? `${station.bitrate} kbps` : '']
    .filter(Boolean)
    .join(' · ')
}

/** A station's star: filled where it is one of the player's favourites. */
function StarGlyph({ on }: { on: boolean }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className="radio-glyph"
      aria-hidden="true"
      fill={on ? 'currentColor' : 'none'}
      stroke="currentColor"
      strokeWidth={on ? 1.4 : 1.9}
      strokeLinejoin="round"
    >
      <path d="m12 3.6 2.6 5.5 6 .8-4.4 4.2 1.1 6-5.3-2.9-5.3 2.9 1.1-6-4.4-4.2 6-.8Z" />
    </svg>
  )
}

function PlayGlyph() {
  return (
    <svg viewBox="0 0 24 24" className="radio-glyph" aria-hidden="true">
      <path d="M8 5.5 18.5 12 8 18.5Z" fill="currentColor" />
    </svg>
  )
}

function PauseGlyph() {
  return (
    <svg viewBox="0 0 24 24" className="radio-glyph" aria-hidden="true">
      <rect x="7" y="5.5" width="3.6" height="13" rx="1.2" fill="currentColor" />
      <rect x="13.4" y="5.5" width="3.6" height="13" rx="1.2" fill="currentColor" />
    </svg>
  )
}

function PreviousGlyph() {
  return (
    <svg viewBox="0 0 24 24" className="radio-glyph" aria-hidden="true">
      <path d="M8.4 5.8v12.4" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
      <path d="M17.5 6.4 10 12l7.5 5.6Z" fill="currentColor" />
    </svg>
  )
}

function NextGlyph() {
  return (
    <svg viewBox="0 0 24 24" className="radio-glyph" aria-hidden="true">
      <path d="M15.6 5.8v12.4" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
      <path d="M6.5 6.4 14 12l-7.5 5.6Z" fill="currentColor" />
    </svg>
  )
}

/** The station playing: its sound, as three bars dancing. */
function WavesGlyph() {
  return (
    <svg viewBox="0 0 24 24" className="radio-glyph" aria-hidden="true">
      <g stroke="currentColor" strokeWidth="2.4" strokeLinecap="round">
        <path d="M6 10v4" />
        <path d="M12 6.5v11" />
        <path d="M18 9v6" />
      </g>
    </svg>
  )
}

function VolumeGlyph() {
  return (
    <svg viewBox="0 0 24 24" className="radio-glyph" aria-hidden="true">
      <path d="M4.5 9.5h3.2L12 6v12L7.7 14.5H4.5Z" fill="currentColor" />
      <path d="M15.5 9.5a3.7 3.7 0 0 1 0 5" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" />
      <path d="M18 7a7.4 7.4 0 0 1 0 10" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" />
    </svg>
  )
}

function RefreshGlyph() {
  return (
    <svg viewBox="0 0 24 24" className="radio-glyph" aria-hidden="true">
      <path
        d="M19.5 12a7.5 7.5 0 1 1-2.3-5.4"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.1"
        strokeLinecap="round"
      />
      <path
        d="M19.8 4.6v4.7h-4.7"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.1"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

/** The empty page’s mark: a radio set, drawn as the set’s own glyphs are. */
function RadioGlyph() {
  return (
    <svg viewBox="0 0 64 64" className="radio-empty-mark" aria-hidden="true">
      <g fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round">
        <rect x="10" y="24" width="44" height="26" rx="6" strokeWidth="2.6" />
        <path d="M42 24 51 12" strokeWidth="2.6" />
        <path d="M17 32h15M17 38h15M17 44h15" strokeWidth="2.4" />
        <circle cx="45" cy="39" r="5.4" strokeWidth="2.4" />
      </g>
      <path d="M45 39l3-3.6" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
    </svg>
  )
}
