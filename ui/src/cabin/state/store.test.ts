import { afterEach, describe, expect, it, vi } from 'vitest'

/** A browser's storage holding what an earlier WestPlay saved (and the page around it, outside WestPlay). */
function savedStorage(state: unknown, version = 1) {
  vi.stubGlobal('window', {})
  vi.stubGlobal('location', { search: '' })
  const items = new Map([['westplay.cabin', JSON.stringify({ state, version })]])
  return {
    getItem: (key: string) => items.get(key) ?? null,
    setItem: (key: string, value: string) => void items.set(key, value),
    removeItem: (key: string) => void items.delete(key),
  }
}

afterEach(() => {
  vi.unstubAllGlobals()
  vi.resetModules()
})

describe('the saved Settings choices', () => {
  it('come back as they were', async () => {
    vi.stubGlobal(
      'localStorage',
      savedStorage({
        dashboardWidgets: { nowPlaying: false, destination: true, driverHours: false, weather: false },
        albumArt: false,
      }),
    )
    const { useCabin } = await import('./store')
    expect(useCabin.getState().dashboardWidgets).toEqual({
      nowPlaying: false,
      destination: true,
      driverHours: false,
      driver: true,
      diagnostics: true,
      weather: false,
    })
    expect(useCabin.getState().albumArt).toBe(false)
  })

  it('keep the older Job card’s choice on the destination card it joined', async () => {
    vi.stubGlobal('localStorage', savedStorage({ dashboardWidgets: { destination: false, job: true } }))
    const { useCabin } = await import('./store')
    expect(useCabin.getState().dashboardWidgets.destination).toBe(true)
  })

  it('keep a widget shown unless it was turned off, and ignore what isn’t a choice', async () => {
    vi.stubGlobal(
      'localStorage',
      savedStorage({ dashboardWidgets: { weather: false, nowPlaying: 'no' }, albumArt: 'off' }),
    )
    const { useCabin } = await import('./store')
    expect(useCabin.getState().dashboardWidgets).toEqual({
      nowPlaying: true,
      destination: true,
      driverHours: true,
      driver: true,
      diagnostics: true,
      weather: false,
    })
    expect(useCabin.getState().albumArt).toBe(true)
  })

  it('start as the leaner column when nothing was saved (an earlier Cabin Play)', async () => {
    vi.stubGlobal('localStorage', savedStorage({ appearanceMode: 'dark' }))
    const { useCabin } = await import('./store')
    expect(useCabin.getState().dashboardWidgets).toEqual({
      nowPlaying: true,
      destination: true,
      driverHours: true,
      driver: false,
      weather: false,
      diagnostics: true,
    })
    expect(useCabin.getState().albumArt).toBe(true)
    expect(useCabin.getState().appearanceMode).toBe('dark')
    // The sidebar's clock: the player's own time, unless they chose the game's.
    expect(useCabin.getState().clock).toBe('real')
    expect(useCabin.getState().uiSoundVolume).toBe(1)
  })

  it('drop the two extra cards from a column left at the old default of everything on', async () => {
    vi.stubGlobal(
      'localStorage',
      savedStorage(
        {
          dashboardWidgets: {
            nowPlaying: true,
            destination: true,
            driverHours: true,
            driver: true,
            weather: true,
            diagnostics: true,
          },
        },
        3,
      ),
    )
    const { useCabin } = await import('./store')
    expect(useCabin.getState().dashboardWidgets).toEqual({
      nowPlaying: true,
      destination: true,
      driverHours: true,
      diagnostics: true,
      driver: false,
      weather: false,
    })
  })

  it('keep the apps pinned to the sidebar, each once, in the order they were pinned', async () => {
    vi.stubGlobal(
      'localStorage',
      savedStorage({ pinnedApps: ['music', 'music', 'spotify', 'settings', 'weather', 'nope'] }, 3),
    )
    const { useCabin } = await import('./store')
    expect(useCabin.getState().pinnedApps).toEqual(['music', 'spotify', 'settings'])
  })

  it('keeps interface sound volume separate and within its range', async () => {
    const storage = savedStorage({ uiSounds: false, uiSoundVolume: 0.35 })
    vi.stubGlobal('localStorage', storage)
    const { useCabin } = await import('./store')
    expect(useCabin.getState().uiSoundVolume).toBe(0.35)
    expect(useCabin.getState().uiSounds).toBe(false)

    useCabin.getState().setUiSoundVolume(1.4)
    expect(useCabin.getState().uiSoundVolume).toBe(1)
    expect(useCabin.getState().uiSounds).toBe(false)
    expect(JSON.parse(storage.getItem('westplay.cabin')!).state.uiSoundVolume).toBe(1)
  })
})

describe('the saved Text Size', () => {
  it('stays the size it was when smaller steps are added below it', async () => {
    // 1.7, the sixth step of seven before 0.8 and 0.9 were added.
    vi.stubGlobal('localStorage', savedStorage({ textSize: 5 }, 2))
    const { useCabin } = await import('./store')
    const { textScale } = await import('./textSize')
    expect(textScale(useCabin.getState().textSize)).toBe(1.7)
  })

  it('starts on the default when it was kept from before the steps moved larger', async () => {
    vi.stubGlobal('localStorage', savedStorage({ textSize: 5 }, 1))
    const { useCabin } = await import('./store')
    const { DEFAULT_TEXT_SIZE } = await import('./textSize')
    expect(useCabin.getState().textSize).toBe(DEFAULT_TEXT_SIZE)
  })
})
