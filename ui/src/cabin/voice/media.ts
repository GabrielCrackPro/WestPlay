import { keybinds } from '../apps/keybinds'
import { appleMusicPlayer } from '../apps/music/pauseWithGame'
import { spotifyPlayer } from '../apps/spotify/pauseWithGame'
import { youtubePlayer } from '../apps/youtube/pauseWithGame'
import { youtubeMusicPlayer } from '../apps/youtubeMusic/pauseWithGame'
import { radioPlayer } from '../apps/radio/radio'
import { nextVideo, previousVideo } from '../apps/youtube/youtube'
import { skip as skipSpotify } from '../apps/spotify/spotify'
import { skip as skipAppleMusic } from '../apps/music/appleMusic'
import { skip as skipYouTubeMusic } from '../apps/youtubeMusic/youtubeMusic'
import { tune } from '../apps/radio/radio'

/** What Now Playing currently shows: the player a voice command should act on. */
export type Showing = 'video' | 'spotify' | 'appleMusic' | 'youtubeMusic' | 'radio' | null

export type MediaAction = 'play' | 'pause' | 'toggle' | 'next' | 'previous' | 'volumeUp' | 'volumeDown'

// The existing keybind controller already knows which player last played here and how its volume steps.
// It keeps subscriptions for the life of the page, which is what the cab wants for its keybinds too.
const binds = keybinds([youtubePlayer, spotifyPlayer, appleMusicPlayer, youtubeMusicPlayer, radioPlayer])

/** Carries out one media command on the player Now Playing is showing. */
export function mediaCommand(action: MediaAction, showing: Showing): boolean {
  if (!binds.hasPlayer()) return false
  if (action === 'play') {
    if (!binds.playing()) binds.press('playPause')
    return true
  }
  if (action === 'pause') {
    if (binds.playing()) binds.press('playPause')
    return true
  }
  if (action === 'toggle') {
    binds.press('playPause')
    return true
  }
  if (action === 'volumeUp' || action === 'volumeDown') {
    return binds.press(action) !== null
  }
  switch (showing) {
    case 'video':
      if (action === 'next') nextVideo()
      else previousVideo()
      return true
    case 'spotify':
      skipSpotify(action === 'next' ? 1 : -1)
      return true
    case 'appleMusic':
      skipAppleMusic(action === 'next' ? 1 : -1)
      return true
    case 'youtubeMusic':
      skipYouTubeMusic(action === 'next' ? 1 : -1)
      return true
    case 'radio':
      tune(action === 'next' ? 1 : -1)
      return true
    default:
      return false
  }
}
