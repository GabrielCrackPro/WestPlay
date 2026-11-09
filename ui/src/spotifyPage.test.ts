import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import spotify from '../../crates/host/src/spotify.js?raw'

/**
 * Spotify's page script (crates/host/src/spotify.js) run against a stand-in for the page: what it says plays,
 * as Spotify Connect's state comes in on the page's dealer socket. Anything of the page not stood in for here
 * is a harmless nothing (calls, reads and `new` of it all give that nothing back).
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Loose = any

const nothing: Loose = new Proxy(function () {}, {
  get: (_, key) =>
    key === 'then'
      ? undefined
      : key === Symbol.toPrimitive
        ? () => ''
        : key === Symbol.iterator
          ? () => [].values()
          : nothing,
  apply: () => nothing,
  construct: () => nothing,
})

class FakeSocket {
  listeners: Record<string, (event: { data: string }) => void> = {}
  readonly url: string
  constructor(url: string) {
    this.url = url
  }
  addEventListener(type: string, listener: (event: { data: string }) => void) {
    this.listeners[type] = listener
  }
}

/** The script run, and what it posted to the host. */
function runPage(extra: Loose = {}) {
  const posts: Loose[] = []
  class HTMLMediaElement {}
  Object.assign(HTMLMediaElement.prototype, { play() {}, setMediaKeys() {} })
  class XMLHttpRequest {}
  Object.assign(XMLHttpRequest.prototype, { open() {}, setRequestHeader() {}, send() {} })
  const own: Record<PropertyKey, Loose> = {
    location: { hostname: 'open.spotify.com' },
    chrome: { webview: { postMessage: (message: Loose) => posts.push(message), addEventListener() {} } },
    fetch: () => Promise.reject(new Error('offline')),
    WebSocket: FakeSocket,
    HTMLMediaElement,
    XMLHttpRequest,
    westplayCabSound: undefined,
    addEventListener() {},
    document: nothing,
    MutationObserver: nothing,
    ...extra,
  }
  const page: Loose = new Proxy(own, {
    has: () => true,
    get: (_, key) =>
      key === Symbol.unscopables
        ? undefined
        : key === 'window' || key === 'top' || key === 'self'
          ? page
          : key in own
            ? own[key]
            : key in globalThis
              ? (globalThis as Loose)[key]
              : nothing,
    set: (_, key, value) => ((own[key] = value), true),
  })
  new Function('page', `with (page) {\n${spotify}\n}`)(page)
  const dealer = new page.WebSocket('wss://gew1-dealer.spotify.com/') as FakeSocket
  const hear = (cluster: Loose) =>
    dealer.listeners.message({ data: JSON.stringify({ uri: 'hm://connect-state/v1/cluster', payloads: [cluster] }) })
  const playback = () => posts.filter((post) => post?.playback).at(-1)?.playback
  return { hear, playback }
}

const cluster = (device: Loose) => ({
  active_device_id: 'abc',
  devices: device ? { abc: { name: 'Web Player (WestPlay)', ...device } } : {},
  player_state: { track: { uri: 'spotify:track:1' }, is_playing: true, is_paused: false, duration: 200000 },
})

describe("Spotify's page script, its volume", () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  // The songs' names are asked for first (the session waited out here, the answer given without them).
  const heard = async (device: Loose) => {
    const page = runPage()
    page.hear(cluster(device))
    await vi.advanceTimersByTimeAsync(30000)
    return page.playback()
  }

  it("is the playing device's, 0 to 1", async () => {
    expect((await heard({ volume: 32768 }))?.volume).toBeCloseTo(0.5, 3)
  })

  it('is 0 when Connect leaves it out (0 is left out), not none', async () => {
    expect((await heard({ capabilities: { can_be_player: true } }))?.volume).toBe(0)
  })

  it("is none for a device whose volume can't be set, or with no device playing", async () => {
    expect((await heard({ volume: 65535, capabilities: { disable_volume: true } }))?.volume).toBeNull()
    expect((await heard(null))?.volume).toBeNull()
  })
})

/** An ad where a song would be: Spotify marks the track, and the break it's in, in the player's state. */
const ad = (device: Loose) => {
  const playing = cluster(device)
  return {
    ...playing,
    player_state: {
      ...playing.player_state,
      track: { uri: 'spotify:track:ad', metadata: { is_advertisement: 'true' } },
      playback_features: { ad_break_context: { max_seconds_remaining: 30, positionInCurrentAdBreak: 1 } },
    },
  }
}

describe("Spotify's page script, its ads", () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  // Connect not there (endpoint and device unseen): the page's own Skip button, pressed once per 2 s.
  const asks = async (breakCount: number) => {
    let pressed = 0
    const page = runPage({ document: { querySelector: () => ({ click: () => (pressed += 1) }) } })
    for (let at = 0; at < breakCount; at += 1) {
      page.hear(ad({ volume: 65535 }))
      await vi.advanceTimersByTimeAsync(2000)
    }
    return pressed
  }

  it('are asked past as they play', async () => {
    expect(await asks(1)).toBe(1)
  })

  it('are asked past once every 2 s, and only six to a break', async () => {
    expect(await asks(4)).toBe(4)
    expect(await asks(10)).toBe(6)
  })
})
