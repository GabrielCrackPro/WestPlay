import { useEffect, useMemo, useState } from 'react'
import type { MediaSource } from '../../shared/media'
import { command, useYouTube } from '../apps/youtube/youtube'
import { playOrPause, useSpotifySource } from '../apps/spotify/spotify'
import { playOrPause as playOrPauseAppleMusic, useAppleMusicSource } from '../apps/music/appleMusic'
import { playOrPause as playOrPauseYouTubeMusic, useYouTubeMusicSource } from '../apps/youtubeMusic/youtubeMusic'
import { type NowPlayingSource, shownSource } from './nowPlaying'

/** What Now Playing last showed playing, kept while the screens showing it come and go (nowPlaying.ts). */
let lastPlayed: NowPlayingSource | null = null

/** What Now Playing shows (`shownSource`): which player, and each player's own state (the screen showing it
 * draws it its own way: the Dashboard's widget, the Equalizer's track). */
export function useNowPlaying() {
  const spotify = useSpotifySource()
  const appleMusic = useAppleMusicSource()
  const youtubeMusic = useYouTubeMusicSource()
  const video = useYouTube((store) => store.current)
  const videoPlaying = useYouTube((store) => store.state?.state === 1 && store.state.video === store.current?.video)
  const playing = {
    video: video !== null && videoPlaying,
    spotify: spotify?.source.status === 'playing',
    appleMusic: appleMusic?.source.status === 'playing',
    youtubeMusic: youtubeMusic?.source.status === 'playing',
  }
  const has = {
    video: video !== null,
    spotify: Boolean(spotify),
    appleMusic: Boolean(appleMusic),
    youtubeMusic: Boolean(youtubeMusic),
  }
  const showing = shownSource(playing, has, lastPlayed)
  const showingPlays = showing !== null && playing[showing]
  useEffect(() => {
    if (showing !== null && showingPlays) lastPlayed = showing
  }, [showing, showingPlays])
  return { showing, playing, spotify, appleMusic, youtubeMusic, video }
}

/**
 * How far into what plays Now Playing reads, in seconds: the position its player last said, run on by the clock
 * while it plays, and the track's length. It ticks once a second — a bar that moves without the card redrawing
 * on every frame. `null` where the player says no length (a stream, or nothing playing).
 */
export function useProgress(source: MediaSource | null): { position: number; duration: number } | null {
  const playing = source?.status === 'playing'
  const [tick, setTick] = useState(0)
  useEffect(() => {
    if (!playing) return
    const id = setInterval(() => setTick((count) => count + 1), 1000)
    return () => clearInterval(id)
  }, [playing])
  return useMemo(() => {
    if (!source || !(source.durationMs > 0)) return null
    const duration = source.durationMs / 1000
    // `positionAt` is Unix time, and the position was that many ms in when it was taken: played on from there.
    const ran = playing ? Math.max(0, Date.now() - source.positionAt) / 1000 : 0
    return { position: Math.min(duration, source.positionMs / 1000 + ran), duration }
  }, [source, playing, tick])
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
  const { showing, playing, spotify, appleMusic, youtubeMusic, video } = useNowPlaying()
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
    default:
      return null
  }
}
