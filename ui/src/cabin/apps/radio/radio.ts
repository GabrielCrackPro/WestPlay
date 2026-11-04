import { useMemo } from 'react'
import { create } from 'zustand'
import { postToHost } from '../../../shared/host'
import type { MediaSource } from '../../../shared/media'
import type { MusicPlayer } from '../musicWithGame'
import { type Station, stationsOf } from './stations'

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
  /** The player’s volume, 0 to 1. */
  volume: number
}

/**
 * The Radio app’s own state. Its sound is one element of the page, kept out of React (and out of the app’s
 * window) so the station plays on while the player is in Maps or Home, as a car radio does; the cab’s other
 * players see it as one of them (`radioPlayer`), so one of them plays at a time and the volume keybinds reach it.
 */
export const useRadio = create<RadioState>()(() => ({
  stations: [],
  station: null,
  status: 'idle',
  failed: null,
  volume: 0.8,
}))

/** The stations the host read, from its `radio` message. */
export function receiveStations(told: unknown): void {
  useRadio.setState({ stations: stationsOf(told) })
}

/** The game’s list read again (the app opens, or the player presses Refresh): it may have new stations. */
export function requestStations(): void {
  postToHost({ type: 'radioStations' })
}

/** Every player told when the radio starts (its `playing` event, not the press that asked for it). */
const started = new Set<(started: boolean) => void>()

let element: HTMLAudioElement | null = null

/** The page’s element the radio plays from (the truck’s speakers take it: cabSound.ts). */
export function radioElement(): HTMLAudioElement | null {
  return element
}

const clamped = (share: number) => Math.max(0, Math.min(1, share))

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
  made.addEventListener('error', () => {
    // No source at all isn’t a station failing (stopping clears it).
    if (!made.getAttribute('src')) return
    useRadio.setState({ status: 'failed', failed: useRadio.getState().station?.url ?? null })
  })
  element = made
  return made
}

/** Plays a station (from the start: a station is a live stream, there’s nothing to carry on from). */
export function play(station: Station): void {
  const player = audio()
  useRadio.setState({ station, status: 'loading', failed: null })
  // The player’s own volume, whatever a fade left it at.
  player.volume = clamped(useRadio.getState().volume)
  player.src = station.url
  // Autoplay is allowed in the cab (webview.rs); a stream the page still refuses says so on the bar.
  player.play().catch(() => {
    useRadio.setState({ status: 'failed', failed: station.url })
  })
}

/** Stops the radio, forgetting the station. */
export function stopRadio(): void {
  useRadio.setState({ station: null, status: 'idle', failed: null })
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

/** Plays the station it was paused on, if there is one. */
export function resumeHere(): void {
  const { station, status } = useRadio.getState()
  if (station && (status === 'paused' || status === 'failed')) play(station)
}

/**
 * The station playing (or paused), as Now Playing on the Dashboard shows it: a live stream has no length, so
 * there’s no progress bar, and its one control is play/pause. Nothing once the radio is stopped.
 */
export function useRadioSource(): { source: MediaSource; artwork: null } | null {
  const station = useRadio((state) => state.station)
  const status = useRadio((state) => state.status)
  return useMemo(() => {
    if (!station) return null
    const plays = status === 'playing' || status === 'loading'
    return {
      artwork: null,
      source: {
        id: 'westplay-radio',
        service: 'radio',
        title: station.name,
        artist: [station.genre, station.language].filter(Boolean).join(' · '),
        album: '',
        artwork: null,
        status: plays ? 'playing' : status === 'paused' ? 'paused' : 'stopped',
        positionMs: 0,
        // A live stream: nothing to count through.
        positionAt: 0,
        durationMs: 0,
        controls: { playPause: true, next: false, previous: false, shuffle: false, repeat: false },
        shuffle: null,
        repeat: null,
      },
    }
  }, [station, status])
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
