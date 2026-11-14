import { useCallback, useEffect, useMemo, useSyncExternalStore } from 'react'
import type { MediaSource } from '../../shared/media'
import { command, useYouTube } from '../apps/youtube/youtube'
import { playOrPause, useSpotifySource } from '../apps/spotify/spotify'
import { playOrPause as playOrPauseAppleMusic, useAppleMusicSource } from '../apps/music/appleMusic'
import { playOrPause as playOrPauseYouTubeMusic, useYouTubeMusicSource } from '../apps/youtubeMusic/youtubeMusic'
import { pauseHere as pauseRadio, resumeHere as resumeRadio, useRadioSource } from '../apps/radio/radio'
import { type NowPlayingSource, shownSource } from './nowPlaying'

/** What Now Playing last showed playing, kept while the screens showing it come and go (nowPlaying.ts). */
let lastPlayed: NowPlayingSource | null = null

/** What Now Playing shows (`shownSource`): which player, and each player's own state (the screen showing it
 * draws it its own way: the Dashboard's widget, the Equalizer's track). */
export function useNowPlaying() {
  const spotify = useSpotifySource()
  const appleMusic = useAppleMusicSource()
  const youtubeMusic = useYouTubeMusicSource()
  const radio = useRadioSource()
  const video = useYouTube((store) => store.current)
  const videoPlaying = useYouTube((store) => store.state?.state === 1 && store.state.video === store.current?.video)
  const playing = {
    video: video !== null && videoPlaying,
    spotify: spotify?.source.status === 'playing',
    appleMusic: appleMusic?.source.status === 'playing',
    youtubeMusic: youtubeMusic?.source.status === 'playing',
    radio: radio?.source.status === 'playing',
  }
  const has = {
    video: video !== null,
    spotify: Boolean(spotify),
    appleMusic: Boolean(appleMusic),
    youtubeMusic: Boolean(youtubeMusic),
    radio: Boolean(radio),
  }
  const showing = shownSource(playing, has, lastPlayed)
  const showingPlays = showing !== null && playing[showing]
  useEffect(() => {
    if (showing !== null && showingPlays) lastPlayed = showing
  }, [showing, showingPlays])
  return { showing, playing, spotify, appleMusic, youtubeMusic, radio, video }
}

/** Whether any player has something to play, playing or paused: the Dashboard's Now Playing card is there only
 * then (a paused song keeps its card, `shownSource`). */
export function useAnythingLoaded(): boolean {
  return useNowPlaying().showing !== null
}

/** The wall clock behind the progress bars: one interval for every hook that reads it, running only while one of them
 * is subscribed (a playing source is on screen). The time is read in the subscription, never during a render. */
let now = 0
let clockTimer = 0
const listeners = new Set<() => void>()

function subscribeClock(listener: () => void): () => void {
  listeners.add(listener)
  if (listeners.size === 1) {
    now = Date.now()
    clockTimer = window.setInterval(() => {
      now = Date.now()
      for (const notify of listeners) notify()
    }, 1000)
    // The snapshot changed from the clock's idle zero: let the new subscriber read the real time now rather than a
    // second from now.
    for (const notify of listeners) notify()
  }
  return () => {
    listeners.delete(listener)
    if (listeners.size === 0) {
      clearInterval(clockTimer)
      clockTimer = 0
    }
  }
}

const readClock = () => now

/**
 * How far into what plays Now Playing reads, in seconds: the position its player last said, run on by the clock
 * while it plays, and the track's length. It ticks once a second — a bar that moves without the card redrawing
 * on every frame. `null` where the player says no length (a stream, or nothing playing).
 */
export function useProgress(source: MediaSource | null): { position: number; duration: number } | null {
  const playing = source?.status === 'playing'
  const subscribe = useCallback((listener: () => void) => (playing ? subscribeClock(listener) : () => {}), [playing])
  const ticked = useSyncExternalStore(subscribe, readClock, readClock)
  return useMemo(() => {
    if (!source || !(source.durationMs > 0)) return null
    const duration = source.durationMs / 1000
    // `positionAt` is Unix time, and the position was that many ms in when it was taken: played on from there.
    const ran = playing ? Math.max(0, ticked - source.positionAt) / 1000 : 0
    return { position: Math.min(duration, source.positionMs / 1000 + ran), duration }
  }, [source, playing, ticked])
}

/** A time in seconds as a player writes it: 4:07, or 1:02:11 for the long ones. */
export function clock(seconds: number): string {
  const whole = Math.max(0, Math.round(seconds))
  const rest = String(whole % 60).padStart(2, '0')
  const hours = Math.floor(whole / 3600)
  if (hours === 0) return `${Math.floor(whole / 60)}:${rest}`
  return `${hours}:${String(Math.floor((whole % 3600) / 60)).padStart(2, '0')}:${rest}`
}

/** The track Now Playing shows, as one line of a list draws it (the Equalizer's): its title, who it's by, its
 * cover, whether it plays, and playing or pausing it; `null`: nothing to show. */
export function useNowPlayingTrack(): {
  title: string
  by: string
  artwork: string | null
  playing: boolean
  playPause: (() => void) | null
} | null {
  const { showing, playing, spotify, appleMusic, youtubeMusic, radio, video } = useNowPlaying()
  const music = (
    player: { source: { title: string; artist: string; controls: { playPause: boolean } }; artwork: string | null },
    playPause: () => void,
    plays: boolean,
  ) => ({
    title: player.source.title,
    by: player.source.artist,
    artwork: player.artwork,
    playing: plays,
    playPause: player.source.controls.playPause ? playPause : null,
  })
  switch (showing) {
    case 'video':
      return video
        ? {
            title: video.title,
            by: video.channel,
            artwork: video.thumbnail,
            playing: playing.video,
            playPause: () => command({ action: playing.video ? 'pause' : 'play' }),
          }
        : null
    case 'spotify':
      return spotify ? music(spotify, playOrPause, playing.spotify) : null
    case 'appleMusic':
      return appleMusic ? music(appleMusic, playOrPauseAppleMusic, playing.appleMusic) : null
    case 'youtubeMusic':
      return youtubeMusic ? music(youtubeMusic, playOrPauseYouTubeMusic, playing.youtubeMusic) : null
    case 'radio':
      return radio
        ? {
            title: radio.source.title,
            by: radio.source.artist,
            artwork: null,
            playing: playing.radio,
            playPause: playing.radio ? pauseRadio : resumeRadio,
          }
        : null
    default:
      return null
  }
}
