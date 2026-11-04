import { useEffect, useState } from 'react'
import { useText } from '../../state/text'
import { play, requestStations, setVolume, stopRadio, useRadio, type RadioStatus } from './radio'
import { groupsOf, genresOf, type Station } from './stations'
import './radioApp.css'

/**
 * The Radio app: the stations of the game’s own radio list (`live_streams.sii`, read by the host), grouped by
 * genre as the game’s radio menu groups them, playing through the cab’s speakers. A station plays on while the
 * player is elsewhere in the cab (its sound isn’t the app’s window’s, radio.ts), as a car radio does; the bar at
 * the foot says what plays, stops it, and sets its volume.
 *
 * A station only streams over `http` is listed with the rest: the page is served over `https`, so the browser may
 * refuse it (mixed content), and the bar says so when it does. Pressing Refresh reads the game’s list again, for
 * stations added in the game since WestPlay started.
 */
export function RadioApp() {
  const text = useText()
  const words = text.radioApp
  const stations = useRadio((state) => state.stations)
  const station = useRadio((state) => state.station)
  const status = useRadio((state) => state.status)
  const failed = useRadio((state) => state.failed)
  const volume = useRadio((state) => state.volume)
  // The genre shown: all of them, or one (a new list keeps a genre it still has).
  const [genre, setGenre] = useState('all')
  useEffect(() => {
    requestStations()
  }, [])
  const genres = genresOf(stations)
  const shown = groupsOf(stations).filter((group) => genre === 'all' || group.genre === genre)
  const playing = status === 'playing' || status === 'loading'
  const chips: [string, string][] = [
    ['all', words.all],
    ...genres.map((each): [string, string] => [each, each || words.other]),
  ]

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
              <div className="radio-groups">
                {shown.map((group) => (
                  <section key={group.genre || 'other'} className="radio-group">
                    <h2>{group.genre || words.other}</h2>
                    <ol className="radio-list">
                      {group.stations.map((each) => (
                        <StationRow
                          key={each.url}
                          station={each}
                          now={station?.url === each.url}
                          status={status}
                          failed={failed === each.url}
                        />
                      ))}
                    </ol>
                  </section>
                ))}
              </div>
            </>
          )}
        </div>
      </div>
      {station && (
        <div className={failed ? 'radio-bar failed' : 'radio-bar'}>
          <span className={playing ? 'radio-dot on' : 'radio-dot'} aria-hidden="true" />
          <div className="radio-bar-text">
            <span className="radio-bar-name">{station.name}</span>
            <span className="radio-bar-state" aria-live="polite">
              {failed ? words.unavailable : playing ? words.playingNow : words.paused}
            </span>
          </div>
          <button type="button" className="radio-stop" aria-label={words.stop} onClick={stopRadio}>
            <StopGlyph />
          </button>
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
      )}
    </section>
  )
}

/** One station: pressed, it plays (or stops, the one playing); the one playing says so, in its genre’s list. */
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
  const live = now && status === 'playing'
  return (
    <li className="radio-item">
      <button
        type="button"
        className={now ? 'radio-row now' : 'radio-row'}
        aria-current={now ? 'true' : undefined}
        onClick={() => (now && status !== 'paused' ? stopRadio() : play(station))}
      >
        <span className="radio-row-mark" aria-hidden="true">
          {live ? <WavesGlyph /> : <PlayGlyph />}
        </span>
        <span className="radio-row-text">
          <span className="radio-row-name">{station.name}</span>
          <span className="radio-row-meta">
            {[station.language, station.bitrate > 0 ? `${station.bitrate} kbps` : ''].filter(Boolean).join(' · ')}
          </span>
        </span>
        {failed && <span className="radio-row-http">{words.unavailableTag}</span>}
        {!failed && station.url.startsWith('http://') && <span className="radio-row-http">http</span>}
      </button>
    </li>
  )
}

function PlayGlyph() {
  return (
    <svg viewBox="0 0 24 24" className="radio-glyph" aria-hidden="true">
      <path d="M8 5.5 18.5 12 8 18.5Z" fill="currentColor" />
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

function StopGlyph() {
  return (
    <svg viewBox="0 0 24 24" className="radio-glyph" aria-hidden="true">
      <rect x="6.5" y="6.5" width="11" height="11" rx="2" fill="currentColor" />
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
