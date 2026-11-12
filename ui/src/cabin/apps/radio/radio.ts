import { useMemo } from 'react'
import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'
import { IS_DEMO, postToHost } from '../../../shared/host'
import type { MediaSource } from '../../../shared/media'
import type { MusicPlayer } from '../musicWithGame'
import { hlsPlays, playHls, stopHls } from './hls'
import {
  type Channel,
  channelsOf,
  channelsUrlOf,
  isHlsUrl,
  isPlaylistUrl,
  type Station,
  stationsOf,
  streamOf,
  titleUrlOf,
} from './stations'

/** A station as the app plays it now: loading its stream, playing, paused (by the player, another player starting,
 * or the game), or not playing at all (its stream failed). */
export type RadioStatus = 'idle' | 'loading' | 'playing' | 'paused' | 'failed'

interface RadioState {
  /** The game’s stations, as the host read them. */
  stations: Station[]
  /** What the app last played (kept while paused, so it can play on). */
  station: Station | null
  status: RadioStatus
  /** The station whose stream failed (`null`: none). */
  failed: string | null
  /** The song the station playing says it plays (`null`: it says none, or this PC has no door to hear it). */
  title: string | null
  /** The player’s volume, 0 to 1. */
  volume: number
  /** The streams the station playing's playlist offers (`[]`: it is its own stream, or there's nothing to choose). */
  channels: Channel[]
  /** Which of them plays, counting from 1. */
  channel: number
  /** This PC’s own door to the stations’ streams (`http://127.0.0.1:…`, the host’s `radio_proxy`); `null` when it
   * has none. */
  proxy: string | null
  /** The station the set was last left on (`null`: none yet), kept between launches as a car radio keeps its
   * tuning: it is what the face shows before anything plays. */
  tuned: Station | null
  /** The player’s favourite stations, in the order they picked them. */
  favourites: Station[]
  /** Picks a station as a favourite, or lets it go. */
  toggleFavourite(station: Station): void
}

/** What the set keeps between launches: its tuning, its volume, and the player’s favourites. */
type Remembered = Pick<RadioState, 'tuned' | 'volume' | 'favourites'>

/**
 * Saved data as the radio may use it: a station the page knows how to play (it is no longer in the game's list,
 * or the file was edited), a volume in range, and each favourite once.
 */
function remembered(stored: unknown): Partial<Remembered> {
  if (typeof stored !== 'object' || stored === null) return {}
  const { tuned, volume, favourites } = stored as Record<string, unknown>
  const kept: Partial<Remembered> = { tuned: stationsOf([tuned])[0] ?? null }
  if (typeof volume === 'number' && Number.isFinite(volume)) kept.volume = clamped(volume)
  if (Array.isArray(favourites)) kept.favourites = stationsOf(favourites)
  return kept
}

/**
 * The Radio app’s own state. Its sound is one element of the page, kept out of React (and out of the app’s
 * window) so the station plays on while the player is in Maps or Home, as a car radio does; the cab’s other
 * players see it as one of them (`radioPlayer`), so one of them plays at a time and the volume keybinds reach it.
 *
 * A station is a stream on somebody else’s server, which the cab’s page (https) may neither play (http ones) nor
 * let its Web Audio graph hear (the truck’s speakers, cab_sound.js): it plays through this PC’s own door instead
 * (`stations.ts`’s `streamOf`), which serves the stream to the page with the leave to hear it, so the speakers
 * can. Without a door, a secure station plays straight from its own server (heard from the page, not the truck);
 * an http one can't, the cab's page being https, so it is one this PC must find a door for.
 */
export const useRadio = create<RadioState>()(
  persist(
    (set) => ({
      stations: [],
      station: null,
      status: 'idle',
      failed: null,
      title: null,
      volume: 0.8,
      channels: [],
      channel: 1,
      proxy: null,
      tuned: null,
      favourites: [],
      toggleFavourite: (station) =>
        set((state) => ({
          favourites: state.favourites.some((each) => each.url === station.url)
            ? state.favourites.filter((each) => each.url !== station.url)
            : [...state.favourites, station],
        })),
    }),
    {
      // A set's memory, kept on this PC as the cab's own choices are: the station it was left on, its volume, and
      // the player's favourites.
      name: IS_DEMO ? 'westplay.radio.demo' : 'westplay.radio',
      version: 1,
      storage: createJSONStorage(() => localStorage),
      partialize: (state): Remembered => ({
        tuned: state.tuned,
        volume: state.volume,
        favourites: state.favourites,
      }),
      // Saved data comes from an earlier WestPlay (or was edited): keep only what is valid.
      merge: (stored, current) => ({ ...current, ...remembered(stored) }),
    },
  ),
)

/** The stations the host read, and its door to their streams, from its `radio` message. */
export function receiveStations(told: { stations?: unknown; proxy?: unknown }): void {
  useRadio.setState({ stations: stationsOf(told.stations), proxy: doorOf(told.proxy) })
}

/** The door as the message gives it: this PC's own loopback, whatever else the message might hold. */
function doorOf(told: unknown): string | null {
  return typeof told === 'string' && /^http:\/\/127\.0\.0\.1:\d{1,5}$/.test(told) ? told : null
}

/** The game’s list read again (the app opens, or the player presses Refresh): it may have new stations. */
export function requestStations(): void {
  postToHost({ type: 'radioStations' })
}

/** Every player told when the radio starts (its `playing` event, not the press that asked for it). */
const started = new Set<(started: boolean) => void>()

let element: HTMLAudioElement | null = null

const clamped = (share: number) => Math.max(0, Math.min(1, share))

/** How often the door is asked what a station plays: a song's few minutes, seconds either way. */
const TITLE_EVERY = 5000

let asking: number | undefined

/**
 * Asks the door what the station plays, and keeps asking while it is the one chosen: a station slips its song
 * into its stream every so often, which the door takes off the sound and keeps (radio_proxy.rs's `/t/<station>`).
 */
function followTitle(station: Station | null): void {
  if (asking !== undefined) {
    clearInterval(asking)
    asking = undefined
  }
  if (!station) return
  const ask = () => {
    const asked = titleUrlOf(station.url, useRadio.getState().proxy)
    if (!asked) return
    fetch(asked, { cache: 'no-store' })
      .then((answer) => (answer.ok ? answer.text() : ''))
      .then((title) => {
        // Only the station chosen has a song here: one left for another has none.
        if (useRadio.getState().station?.url === station.url) useRadio.setState({ title: title.trim() || null })
      })
      .catch(() => undefined)
  }
  ask()
  asking = window.setInterval(ask, TITLE_EVERY)
}

/**
 * Asks the door what streams a station's playlist offers, for the face to offer them (a station at more than one
 * bitrate, its list naming each): nothing for a station that is its own stream.
 */
function followChannels(station: Station): void {
  const asked = channelsUrlOf(station.url, useRadio.getState().proxy)
  if (!asked) return
  fetch(asked, { cache: 'no-store' })
    .then((answer) => (answer.ok ? answer.json() : []))
    .then((told: unknown) => {
      // Only the station chosen has channels here: one left for another has none.
      if (useRadio.getState().station?.url === station.url) useRadio.setState({ channels: channelsOf(told) })
    })
    .catch(() => undefined)
}

/** The element, made once: its events keep the app’s state (and the cab’s other players) told. */
function audio(): HTMLAudioElement {
  if (element) return element
  const made = new Audio()
  made.preload = 'none'
  made.volume = clamped(useRadio.getState().volume)
  made.addEventListener('playing', () => {
    useRadio.setState({ status: 'playing' })
    for (const changed of started) changed(true)
  })
  // A stream that has to catch up (the first moments of a station) is loading still.
  made.addEventListener('waiting', () => {
    if (useRadio.getState().station) useRadio.setState({ status: 'loading' })
  })
  made.addEventListener('pause', () => {
    const { status } = useRadio.getState()
    if (status === 'playing' || status === 'loading') useRadio.setState({ status: 'paused' })
  })
  // The station stopped sending: its stream ended (a live one does when it goes off the air, or the door lets it go
  // with nobody reading it). The set stays tuned to it, its face saying so and its one button playing it again — a
  // station is a stream to begin, never one to carry on with (play()). Nothing once the radio is stopped.
  made.addEventListener('ended', () => {
    if (useRadio.getState().station) useRadio.setState({ status: 'paused' })
  })
  made.addEventListener('error', () => {
    // No source at all isn’t a station failing (stopping clears it).
    if (!made.getAttribute('src')) return
    useRadio.setState({ status: 'failed', failed: useRadio.getState().station?.url ?? null })
  })
  element = made
  return made
}

/**
 * The page's element, while it plays through this PC's door: the speakers' graph can hear that one (the stream is
 * CORS-clean). A station played straight from its server is one the graph would play as silence, so it is none — an
 * HLS one excepted, whose sound is the page's own (the element plays a blob the page's HLS player fills).
 */
export function radioForSpeakers(): HTMLAudioElement | null {
  const { proxy, station } = useRadio.getState()
  return proxy !== null || (station !== null && isHlsUrl(station.url)) ? element : null
}

/**
 * Plays a station (from the start: a station is a live stream, there’s nothing to carry on from), on `channel` of it
 * when its playlist offers several.
 */
export function play(station: Station, channel = 1): void {
  const player = audio()
  const { proxy, station: playing, channels } = useRadio.getState()
  // The set remembers what it is tuned to: it comes back on it at the next launch (the face shows it, paused).
  useRadio.setState({
    station,
    status: 'loading',
    failed: null,
    title: null,
    tuned: station,
    channel,
    // The same station played on keeps the streams it was offered (they don't come again for a pause); another
    // station's are as unknown as it is until its playlist is read.
    channels: playing?.url === station.url ? channels : [],
  })
  // A station its list gives as a playlist may offer a choice of streams, which the face then shows.
  if (isPlaylistUrl(station.url)) followChannels(station)
  const stopped = (why?: unknown) => {
    // A play the browser aborted (paused before it started, or another station tuned in over it) isn't a station
    // failing; one the page still refuses says so on the face.
    if (why instanceof DOMException && why.name === 'AbortError') return
    if (useRadio.getState().station?.url !== station.url) return
    useRadio.setState({ status: 'failed', failed: station.url })
  }
  // The player’s own volume, whatever a fade left it at.
  player.volume = clamped(useRadio.getState().volume)
  // An HLS station (`.m3u8`) is no stream as streams go: the page's own HLS player reads its list and its segments,
  // through the door, since the element can't play the list itself (hls.ts). Its stream carries no ICY song.
  stopHls()
  if (isHlsUrl(station.url)) {
    followTitle(null)
    if (!hlsPlays()) return stopped(new Error('this page has no MediaSource'))
    player.removeAttribute('src')
    playHls(player, station.url, proxy, () => stopped())
    return
  }
  followTitle(station)
  // Through the door the stream is the page's own to hear (CORS), so the truck's speakers can play it.
  if (proxy) player.crossOrigin = 'anonymous'
  else player.removeAttribute('crossorigin')
  // The station is a stream to begin, never to carry on with: played again (played on after a pause, or tuned in
  // over itself), the element would keep the response it already has — one the door ended, since a paused stream
  // isn't read — and play silence at its end instead of the station. Emptied first, every play is a fresh stream.
  player.removeAttribute('src')
  player.src = streamOf(station.url, proxy, channel)
  // Autoplay is allowed in the cab (webview.rs); a stream the page still refuses says so on the face.
  player.play().catch(stopped)
}

/**
 * Tunes to the station `step` on from the one playing, round from the ends (the Dashboard's buttons): the game's
 * whole list, in its order.
 */
export function tune(step: number): void {
  const { stations, station } = useRadio.getState()
  if (stations.length === 0) return
  const at = station ? stations.findIndex((each) => each.url === station.url) : -1
  const from = at < 0 ? (step > 0 ? -1 : 0) : at
  play(stations[(((from + step) % stations.length) + stations.length) % stations.length])
}

/** Stops the radio, forgetting the station. */
export function stopRadio(): void {
  useRadio.setState({ station: null, status: 'idle', failed: null, title: null, channels: [], channel: 1 })
  followTitle(null)
  stopHls()
  if (!element) return
  element.pause()
  element.removeAttribute('src')
  element.load()
}

/** The player’s volume, as its slider (and the volume keybinds) set it. */
export function setVolume(share: number): void {
  const volume = clamped(share)
  useRadio.setState({ volume })
  if (element) element.volume = volume
}

/** It plays here now. */
export function playingHere(): boolean {
  return element !== null && !element.paused && useRadio.getState().status === 'playing'
}

/** Pauses here, keeping the station (it plays on from it). */
export function pauseHere(): void {
  if (element && !element.paused) element.pause()
}

/**
 * Plays the station it was paused on — or, before anything has played since the cab opened, the one the set was
 * last left on — if there is one. Nothing while a station already plays.
 */
export function resumeHere(): void {
  const { station, tuned, status, channel } = useRadio.getState()
  const chosen = station ?? tuned
  if (!chosen || status === 'playing' || status === 'loading') return
  // The channel it was playing (one this PC was left tuned to has none picked yet: its first).
  play(chosen, station?.url === chosen.url ? channel : 1)
}

/**
 * The station playing (or paused), as Now Playing on the Dashboard shows it: a live stream has no length, so
 * there’s no progress bar, and its one control is play/pause. Nothing once the radio is stopped.
 */
export function useRadioSource(): { source: MediaSource; artwork: null } | null {
  const station = useRadio((state) => state.station)
  const status = useRadio((state) => state.status)
  const title = useRadio((state) => state.title)
  return useMemo(() => {
    if (!station) return null
    const plays = status === 'playing' || status === 'loading'
    return {
      artwork: null,
      source: {
        id: 'westplay-radio',
        service: 'radio',
        title: station.name,
        // The song the station says it plays, where a track's artist would be; its genre and language until it says one.
        artist: title ?? [station.genre, station.language].filter(Boolean).join(' · '),
        album: '',
        artwork: null,
        status: plays ? 'playing' : status === 'paused' ? 'paused' : 'stopped',
        positionMs: 0,
        // A live stream: nothing to count through.
        positionAt: 0,
        durationMs: 0,
        // Its tuning steps through the game's stations, as the set's own presets do.
        controls: { playPause: true, next: true, previous: true, shuffle: false, repeat: false },
        shuffle: null,
        repeat: null,
      },
    }
  }, [station, status, title])
}

/**
 * The radio as one of the cab’s players (musicWithGame.ts, oneAtATime.ts, keybinds.ts): its station playing here,
 * paused by the game or another player and played on after, its volume the player chose.
 */
export const radioPlayer: MusicPlayer = {
  name: 'radio',
  playingHere,
  pauseHere,
  resumeHere,
  volume: () => useRadio.getState().volume,
  // A fade turns the element down without making it the player’s choice.
  sendVolume: (share) => {
    if (element) element.volume = clamped(share)
  },
  setVolume,
  subscribe: (changed) => {
    started.add(changed)
    return () => {
      started.delete(changed)
    }
  },
}
