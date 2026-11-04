import { type CSSProperties, useEffect, useState } from 'react'
import { SearchGlyph } from '../../keyboard/glyphs'
import { TextField } from '../../keyboard/TextField'
import { useText } from '../../state/text'
import { pauseHere, play, requestStations, resumeHere, setVolume, stopRadio, useRadio, type RadioStatus } from './radio'
import { genresOf, groupsOf, hueOf, initialsOf, matchesOf, type Station } from './stations'
import './radioApp.css'

/** The search field's id (one on screen: the keyboard types into it). */
const FIELD = 'radio-search'

/**
 * The Radio app, in CarPlay's shape (as Music's Now Playing is): the station playing across the top as CarPlay
 * draws a track — a square of the station's own colour, its name, the song it plays, and the transport under
 * them — and under it the game’s stations as CarPlay lists them, a tall row each (hit easily while driving),
 * by genre as the game’s radio menu sorts them, with a search by name among many. A station plays on while the
 * player is elsewhere in the cab (its sound isn’t the app’s window’s, radio.ts), as a car radio does. Pressing
 * Refresh reads the game’s list again, for stations added in the game since WestPlay started.
 */
export function RadioApp() {
  const text = useText()
  const words = text.radioApp
  const stations = useRadio((state) => state.stations)
  const station = useRadio((state) => state.station)
  const status = useRadio((state) => state.status)
  const failed = useRadio((state) => state.failed)
  const title = useRadio((state) => state.title)
  const volume = useRadio((state) => state.volume)
  // The genre shown: all of them, or one (a new list keeps a genre it still has); and the name searched for.
  const [genre, setGenre] = useState('all')
  const [query, setQuery] = useState('')
  useEffect(() => {
    requestStations()
  }, [])
  const matching = matchesOf(stations, query)
  const genres = genresOf(matching)
  const groups = groupsOf(matching).filter((group) => genre === 'all' || group.genre === genre)
  // What the tuning steps across: the stations the list shows, in their order.
  const shown = groups.flatMap((group) => group.stations)
  const live = status === 'playing' || status === 'loading'
  const paused = station !== null && status === 'paused'
  const at = station ? shown.findIndex((each) => each.url === station.url) : -1
  const chips: [string, string][] = [
    ['all', words.all],
    ...genres.map((each): [string, string] => [each, each || words.other]),
  ]

  /** Tunes to the station `step` on in the list shown, round from the ends. */
  const tune = (step: number) => {
    if (shown.length === 0) return
    const from = at < 0 ? (step > 0 ? -1 : 0) : at
    play(shown[(((from + step) % shown.length) + shown.length) % shown.length])
  }

  /** The face’s one button: the station playing pauses, one that isn’t plays on from where it was. */
  const power = () => {
    if (!station) return
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
                style={{ '--hue': String(station ? hueOf(station.name) : 210) } as CSSProperties}
                aria-label={station ? station.name : undefined}
              >
                <div className="radio-now-text">
                  <p className={station ? 'radio-now-name' : 'radio-now-name idle'}>
                    {station ? station.name : words.idle}
                  </p>
                  {station && title ? (
                    <p className="radio-now-title" aria-live="polite">
                      {title}
                    </p>
                  ) : null}
                  <p className="radio-now-meta">{station ? metaOf(station) : words.summary(stations.length)}</p>
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
                  {!station ? (
                    <RadioGlyph />
                  ) : live ? (
                    <WavesGlyph />
                  ) : (
                    <span className="radio-now-initials">{initialsOf(station.name)}</span>
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
                      disabled={!station}
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
                </div>
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
                <div className="radio-chips" role="tablist" aria-label={text.apps.radio}>
                  {chips.map(([id, name]) => (
                    <button
                      key={id || 'other'}
                      type="button"
                      role="tab"
                      aria-selected={genre === id}
                      className={genre === id ? 'radio-chip on' : 'radio-chip'}
                      onClick={() => setGenre(id)}
                    >
                      {name}
                    </button>
                  ))}
                </div>
              </div>
              {groups.length === 0 ? (
                <p className="radio-no-match">{words.noMatches}</p>
              ) : (
                <div className="radio-groups">
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

/** A station as CarPlay lists one: its own colour at the left, its name, what it is; pressed, it plays (or the one
 * playing stops). */
function StationRow({
  station,
  now,
  status,
  failed,
}: {
  station: Station
  now: boolean
  status: RadioStatus
  failed: boolean
}) {
  const words = useText().radioApp
  const live = now && (status === 'playing' || status === 'loading')
  return (
    <button
      type="button"
      className={now ? 'radio-row now' : 'radio-row'}
      aria-current={now ? 'true' : undefined}
      onClick={() => (now && status !== 'paused' && status !== 'failed' ? stopRadio() : play(station))}
    >
      <span className="radio-row-art" style={{ '--hue': String(hueOf(station.name)) } as CSSProperties}>
        {live ? <WavesGlyph /> : <span className="radio-row-initials">{initialsOf(station.name)}</span>}
      </span>
      <span className="radio-row-text">
        <span className="radio-row-name">{station.name}</span>
        <span className="radio-row-meta">
          {failed ? words.unavailableTag : [station.genre || words.other, station.language].filter(Boolean).join(' · ')}
        </span>
      </span>
      {live ? <span className="radio-row-live">{words.playingNow}</span> : null}
      {now && status === 'paused' ? <span className="radio-row-live paused">{words.paused}</span> : null}
    </button>
  )
}

/** What the face says of a station: its genre and language, and its bitrate when the game’s list gives one. */
function metaOf(station: Station): string {
  return [station.genre, station.language, station.bitrate > 0 ? `${station.bitrate} kbps` : '']
    .filter(Boolean)
    .join(' · ')
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
