import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { HostMessage, PageMessage, Telemetry } from '../../shared/host'

/** A stand-in for the page's storage: this suite runs in Node, where `localStorage` isn't there, and the cabin's
 * settings are saved through it (store.ts's persist). */
function stubbedStorage(saved: Record<string, string> = {}) {
  const kept = new Map(Object.entries(saved))
  return {
    getItem: (key: string) => kept.get(key) ?? null,
    setItem: (key: string, value: string) => void kept.set(key, value),
    removeItem: (key: string) => void kept.delete(key),
  }
}

/** A stand-in for WebView2's `chrome.webview`: what the page posts, and a way to send it host messages. */
function fakeWebView() {
  const posted: PageMessage[] = []
  const listeners = new Set<(event: { data: HostMessage }) => void>()
  return {
    posted,
    send: (data: HostMessage) => listeners.forEach((listener) => listener({ data })),
    bridge: {
      addEventListener: (_: 'message', listener: (event: { data: HostMessage }) => void) => listeners.add(listener),
      removeEventListener: (_: 'message', listener: (event: { data: HostMessage }) => void) =>
        listeners.delete(listener),
      postMessage: (message: PageMessage) => posted.push(message),
    },
  }
}

beforeEach(() => {
  vi.stubGlobal('localStorage', stubbedStorage())
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
  vi.resetModules()
})

describe('connectHost', () => {
  it('keeps Cabin Play on the truck’s screen, and tells the host so, whatever asks it closed', async () => {
    const webview = fakeWebView()
    vi.stubGlobal('window', { chrome: { webview: webview.bridge } })
    const { connectHost, useCabin } = await import('./store')
    const westplay = () => webview.posted.filter((message) => message.type === 'westplay')

    const disconnect = connectHost(() => 0)
    // As it connects: ready (so the host sends its state again), then open.
    expect(webview.posted[0]).toEqual({ type: 'ready' })
    expect(westplay()).toEqual([{ type: 'westplay', open: true }])

    // The companion's switch, or the game, asking it closed: Cabin Play stays up, and the host hears nothing new.
    webview.send({ type: 'westplay', open: false })
    expect(useCabin.getState().truckScreen).toBe(false)
    expect(westplay()).toHaveLength(1)

    // Nothing hands it over, not even the page itself.
    useCabin.getState().setTruckScreen(true)
    expect(useCabin.getState().truckScreen).toBe(false)
    expect(westplay()).toHaveLength(1)

    // Disconnected: no more reports.
    disconnect()
  })

  it("follows the companion's truck strip setting", async () => {
    const webview = fakeWebView()
    vi.stubGlobal('window', { chrome: { webview: webview.bridge } })
    const { connectHost, useCabin } = await import('./store')
    const disconnect = connectHost(() => 0)
    expect(useCabin.getState().oemMode).toBe('auto')

    webview.send({ type: 'settings', truckStrip: 'off' })
    expect(useCabin.getState().oemMode).toBe('off')
    // A value this page doesn't know (a newer app) keeps the truck's strip.
    webview.send({ type: 'settings', truckStrip: 'sideways' })
    expect(useCabin.getState().oemMode).toBe('auto')
    disconnect()
  })

  it('keeps the tone the host has, and hands each band set in Settings to it', async () => {
    const webview = fakeWebView()
    vi.stubGlobal('window', { chrome: { webview: webview.bridge } })
    const { connectHost, useCabin } = await import('./store')
    const disconnect = connectHost(() => 0)
    expect(useCabin.getState().equalizer).toEqual({ bass: 0, mid: 0, treble: 0 })

    // As the host keeps it; whatever it sends, each band whole dB within ±6 (none said: flat).
    webview.send({ type: 'settings', truckStrip: 'auto', equalizer: { bass: -3, mid: 2.4, treble: 40 } })
    expect(useCabin.getState().equalizer).toEqual({ bass: -3, mid: 2, treble: 6 })
    webview.send({ type: 'settings', truckStrip: 'auto' })
    expect(useCabin.getState().equalizer).toEqual({ bass: 0, mid: 0, treble: 0 })

    expect(useCabin.getState().equalizerCustom).toBe(false)

    // A band set: Custom, and the whole curve to the host, to keep and play.
    useCabin.getState().setEqualizerBand('bass', -4)
    expect(useCabin.getState().equalizer).toEqual({ bass: -4, mid: 0, treble: 0 })
    expect(useCabin.getState().equalizerCustom).toBe(true)
    expect(webview.posted.at(-1)).toEqual({ type: 'equalizer', custom: true, bass: -4, mid: 0, treble: 0 })
    useCabin.getState().setEqualizerBand('treble', 9)
    expect(webview.posted.at(-1)).toEqual({ type: 'equalizer', custom: true, bass: -4, mid: 0, treble: 6 })
    // Recommended: the curve kept, flat played.
    useCabin.getState().chooseEqualizer(false)
    expect(webview.posted.at(-1)).toEqual({ type: 'equalizer', custom: false, bass: -4, mid: 0, treble: 6 })
    webview.send({
      type: 'settings',
      truckStrip: 'auto',
      equalizer: { bass: -4, mid: 0, treble: 6 },
      equalizerCustom: true,
    })
    expect(useCabin.getState().equalizerCustom).toBe(true)
    useCabin.getState().resetEqualizer()
    expect(webview.posted.at(-1)).toEqual({ type: 'equalizer', custom: true, bass: 0, mid: 0, treble: 0 })
    disconnect()
  })

  it('powers off and forgets the telemetry as the game closes, and powers on again with the next game', async () => {
    const webview = fakeWebView()
    vi.stubGlobal('window', { chrome: { webview: webview.bridge } })
    const { connectHost, useCabin, useLive } = await import('./store')
    const disconnect = connectHost(() => 0)
    const electrics = (on: boolean) => ({ electricEnabled: on, paused: false }) as Telemetry
    webview.send({ type: 'telemetry', data: electrics(true) })
    expect(useCabin.getState().power.phase).not.toBe('off')

    // Closed, its last telemetry still saying the electrics are on: off, and nothing kept of it.
    webview.send({ type: 'game', running: false })
    expect(useCabin.getState().power.phase).toBe('off')
    expect(useLive.getState().telemetry).toBeNull()

    // The next game, electrics on as the last one left them: on again.
    webview.send({ type: 'game', running: true })
    webview.send({ type: 'telemetry', data: electrics(true) })
    expect(useCabin.getState().power.phase).not.toBe('off')
    disconnect()
  })

  it("keeps TruckersMP's players around the player, and forgets them when the game isn't under it", async () => {
    const webview = fakeWebView()
    vi.stubGlobal('window', { chrome: { webview: webview.bridge } })
    const { connectHost, useLive } = await import('./store')
    const disconnect = connectHost(() => 5)
    webview.send({ type: 'nearby', server: 4, local: 113, players: [[7, -6175.5, 2139, 0.25]] })
    expect(useLive.getState().nearby).toEqual({ server: 4, local: 113, players: [[7, -6175.5, 2139, 0.25]], at: 5 })
    // None to tell: none kept.
    webview.send({ type: 'nearby', server: null, local: null, players: [] })
    expect(useLive.getState().nearby).toBeNull()
    webview.send({ type: 'nearby', server: 4, local: 113, players: [] })
    webview.send({ type: 'truckersmp', on: false })
    expect(useLive.getState().nearby).toBeNull()
    disconnect()
  })

  it('keeps the weather the host reads, and forgets it when the host can no longer read it', async () => {
    const webview = fakeWebView()
    vi.stubGlobal('window', { chrome: { webview: webview.bridge } })
    const { connectHost, useLive } = await import('./store')
    const disconnect = connectHost(() => 0)
    expect(useLive.getState().weather).toBeNull()
    webview.send({ type: 'weather', weather: { now: 'clear', coming: 'rain' } })
    expect(useLive.getState().weather).toEqual({ now: 'clear', coming: 'rain' })
    webview.send({ type: 'weather', weather: null })
    expect(useLive.getState().weather).toBeNull()
    disconnect()
  })

  it('keeps lifetime career stats from the selected game save', async () => {
    const webview = fakeWebView()
    vi.stubGlobal('window', { chrome: { webview: webview.bridge } })
    const { connectHost, useLive } = await import('./store')
    const disconnect = connectHost(() => 0)
    const career = {
      profileName: 'Western',
      experiencePoints: 12345,
      totalDistanceMeters: 1250000,
      totalFuelLitres: 810.5,
      gameTimeSeconds: 144000,
      realTimeSeconds: 48000,
      visitedCities: 32,
      cancelledJobs: 2,
    }

    webview.send({ type: 'career', data: career })
    expect(useLive.getState().career).toEqual(career)
    disconnect()
  })

  it('drops the screen kept from the last launch unless the companion’s switch says to resume it', async () => {
    const kept = JSON.stringify({
      state: { navigation: { route: { kind: 'app', app: 'maps' }, recents: ['maps', 'music'], base: 'dashboard' } },
      version: 5,
    })
    vi.stubGlobal('localStorage', stubbedStorage({ 'westplay.cabin': kept }))
    const webview = fakeWebView()
    vi.stubGlobal('window', { chrome: { webview: webview.bridge } })
    const { connectHost, useCabin } = await import('./store')
    const disconnect = connectHost(() => 0)
    // Off (the default): the cab opens on the Dashboard, whatever the last launch left it on.
    webview.send({ type: 'settings', truckStrip: 'auto' })
    expect(useCabin.getState().navigation).toEqual({
      route: { kind: 'dashboard' },
      recents: ['maps', 'music', 'youtube', 'spotify', 'youtubeMusic'],
      base: 'dashboard',
    })
    disconnect()
  })

  it('comes back where the last launch left it when the companion’s switch is on', async () => {
    const kept = JSON.stringify({
      state: { navigation: { route: { kind: 'app', app: 'maps' }, recents: ['maps', 'music'], base: 'dashboard' } },
      version: 5,
    })
    vi.stubGlobal('localStorage', stubbedStorage({ 'westplay.cabin': kept }))
    const webview = fakeWebView()
    vi.stubGlobal('window', { chrome: { webview: webview.bridge } })
    const { connectHost, useCabin } = await import('./store')
    const disconnect = connectHost(() => 0)
    webview.send({ type: 'settings', truckStrip: 'auto', resume: true })
    expect(useCabin.getState().navigation.route).toEqual({ kind: 'app', app: 'maps' })
    expect(useCabin.getState().navigation.recents).toEqual(['maps', 'music'])
    disconnect()
  })

  it('tells the host each phase of the boot, on the clock both screens read', async () => {
    const webview = fakeWebView()
    vi.stubGlobal('window', { chrome: { webview: webview.bridge } })
    // The machine's clock, and this page's own (its `performance.now()`, which no other page shares).
    const wall = 1_700_000_000_000
    const pageClock = 5000
    vi.spyOn(Date, 'now').mockReturnValue(wall)
    const { connectHost, useCabin } = await import('./store')
    const phases = () => webview.posted.filter((message) => message.type === 'power')

    const disconnect = connectHost(() => pageClock)
    // Nothing to say until the boot begins: a page that hasn't powered anything has no boot to draw elsewhere.
    expect(phases()).toEqual([])

    // The electrics come on: the phase and its start, moved from this page's clock onto the machine's, so the
    // cluster's page can draw the same moment of the same boot.
    useCabin.getState().powerEvent({ type: 'electrics', on: false, at: 1000 })
    useCabin.getState().powerEvent({ type: 'electrics', on: true, at: 1600 })
    expect(phases().at(-1)).toEqual({ type: 'power', phase: 'splash', since: wall - (pageClock - 1600) })

    // The second part of the boot, and the screen on: the cluster stops drawing the boot when it hears the last.
    useCabin.getState().powerEvent({ type: 'tick', at: pageClock + 2400 })
    expect(phases().at(-1)).toMatchObject({ phase: 'connecting' })
    useCabin.getState().powerEvent({ type: 'tick', at: pageClock + 2400 + 2600 })
    expect(phases().at(-1)).toMatchObject({ phase: 'on' })

    // Disconnected: no more reports.
    const told = phases().length
    disconnect()
    useCabin.getState().powerEvent({ type: 'electrics', on: false, at: pageClock + 9000 })
    expect(phases()).toHaveLength(told)
  })

  it("tells the host the field selected, and types what the player's keyboard typed", async () => {
    const webview = fakeWebView()
    vi.stubGlobal('window', { chrome: { webview: webview.bridge } })
    const { connectHost } = await import('./store')
    const { useKeyboard } = await import('../keyboard/store')
    const selections = () => webview.posted.filter((message) => message.type === 'typing')
    const disconnect = connectHost(() => 0)
    expect(selections()).toEqual([{ type: 'typing', selection: 0 }])
    let text = ''
    const field = {
      id: 'search',
      returnKind: 'search' as const,
      read: () => text,
      write: (t: string) => (text = t),
      submit: () => {},
    }
    useKeyboard.getState().attach(field, 'en')
    expect(selections().at(-1)).toEqual({ type: 'typing', selection: useKeyboard.getState().selection })
    webview.send({ type: 'typed', events: [{ text: 'Bari' }, { key: 'backspace' }] })
    expect(text).toBe('Bar')
    webview.send({ type: 'typingState', state: 'paused' })
    expect(useKeyboard.getState().physical).toBe('paused')
    disconnect()
  })
})
