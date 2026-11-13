import { PauseGlyph, PlayGlyph } from '../apps/music/glyphs'
import { go, useCabin } from '../state/store'
import { useNowPlaying, useNowPlayingTrack } from '../dashboard/useNowPlaying'
import { useText } from '../state/text'
import './nowPlayingBar.css'

/**
 * Cross-App Now Playing Bar: a persistent mini-player at the bottom of every screen.
 * Shows the current track title and a play/pause button. Tapping opens the full Now Playing view.
 */
export function NowPlayingBar() {
  const shown = useCabin((state) => state.nowPlayingBar)
  if (!shown) return null

  const { showing } = useNowPlaying()
  const track = useNowPlayingTrack()
  if (!track || showing === null) return null

  const text = useText()

  const handlePlayPause = (e: React.MouseEvent) => {
    e.stopPropagation()
    track.playPause?.()
  }

  const handleOpen = () => {
    if (showing === 'spotify') {
      import('../apps/spotify/spotify').then((m) => m.useSpotify.setState({ nowPlaying: true }))
      go({ type: 'openApp', app: 'spotify' })
    } else if (showing === 'appleMusic') {
      import('../apps/music/appleMusic').then((m) => m.useAppleMusic.setState({ nowPlaying: true }))
      go({ type: 'openApp', app: 'music' })
    } else if (showing === 'youtubeMusic') {
      import('../apps/youtubeMusic/youtubeMusic').then((m) => m.useYouTubeMusic.setState({ nowPlaying: true }))
      go({ type: 'openApp', app: 'youtubeMusic' })
    } else if (showing === 'radio') {
      go({ type: 'openApp', app: 'radio' })
    } else if (showing === 'video') {
      go({ type: 'openApp', app: 'youtube' })
    }
  }

  return (
    <div
      className="now-playing-bar"
      onClick={handleOpen}
      role="button"
      tabIndex={0}
      aria-label={text.settings.nowPlayingBar}
    >
      <div className="npb-info">
        <span className="npb-title">{track.title}</span>
        {track.by && <span className="npb-artist">{track.by}</span>}
      </div>
      <button
        type="button"
        className="npb-play"
        aria-label={track.playing ? 'Pause' : 'Play'}
        onClick={handlePlayPause}
      >
        {track.playing ? <PauseGlyph size={16} /> : <PlayGlyph size={16} />}
      </button>
    </div>
  )
}
