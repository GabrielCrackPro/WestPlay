import Hls, { type LoaderCallbacks, type LoaderConfiguration, type LoaderContext } from 'hls.js'
import { bytesUrlOf } from './stations'

/**
 * An HLS station's player (`.m3u8`: its audio in segments, its list read again every few seconds). Chromium — and so
 * the cab's WebView2 — plays HLS no other way: the page reads the list and each segment itself and hands them to the
 * element as one stream (MediaSource). Every one of those requests goes through this PC's door (`radio_proxy.rs`'s
 * `/b/<station>`), because the page and the station's server are strangers to each other — one is http where the
 * page is https, and neither lets the other read it — while the door is this PC's own. The sound stays the page's own
 * (a blob), so the truck's speakers can hear it as they hear any station.
 */

/** The station playing, if it is one of these (one at a time, as the set plays one at a time). */
let playing: Hls | null = null

/** Whether this page can play HLS at all: MediaSource, which every cab's WebView2 has. */
export function hlsPlays(): boolean {
  return Hls.isSupported()
}

/**
 * Plays an HLS station on `element`, its list and segments through this PC's door where there is one. `failed` is
 * called if the stream stops for good: the station off the air, or one the cab can't read.
 */
export function playHls(element: HTMLAudioElement, url: string, proxy: string | null, failed: () => void): void {
  stopHls()
  const made = new Hls({
    // A cab's radio, not a video wall: a few segments ahead is all there is to fetch of a live station and its songs.
    maxBufferLength: 30,
    loader: throughDoor(proxy),
  })
  made.on(Hls.Events.ERROR, (_, told) => {
    if (told.fatal) failed()
  })
  // Played once there is something to play: the element's own events then say it is playing (radio.ts), as they do
  // for any other station. A stream the page still refuses (or one left for another station) isn't this one failing.
  made.on(Hls.Events.MANIFEST_PARSED, () => {
    element.play().catch((why: unknown) => {
      if (why instanceof DOMException && why.name === 'AbortError') return
      if (playing !== made) return
      failed()
    })
  })
  made.attachMedia(element)
  made.loadSource(url)
  playing = made
}

/** Stops the HLS station playing, forgetting it (its lists and segments no longer asked for). */
export function stopHls(): void {
  playing?.destroy()
  playing = null
}

/**
 * hls.js's own loader, every request it makes sent through this PC's door. hls.js resolves a list's segments against
 * the station's real address (what it was given by `loadSource`), so each request it hands over is that address or one
 * beside it, and the door is asked for it. Without a door the station is asked directly, and may refuse the page.
 */
function throughDoor(proxy: string | null): typeof Hls.DefaultConfig.loader {
  const Base = Hls.DefaultConfig.loader
  return class extends Base {
    load(context: LoaderContext, config: LoaderConfiguration, callbacks: LoaderCallbacks<LoaderContext>) {
      if (proxy) context.url = bytesUrlOf(context.url, proxy) ?? context.url
      super.load(context, config, callbacks)
    }
  }
}
