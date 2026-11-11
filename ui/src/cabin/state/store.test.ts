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

  it('keep each Dashboard widget’s size, a bad one back to standard', async () => {
    vi.stubGlobal(
      'localStorage',
      savedStorage({ dashboardWidgetSizes: { nowPlaying: 'expanded', weather: 'compact', driver: 'huge' } }),
    )
    const { useCabin } = await import('./store')
    expect(useCabin.getState().dashboardWidgetSizes).toEqual({
      nowPlaying: 'expanded',
      destination: 'standard',
      driverHours: 'standard',
      driver: 'standard',
      diagnostics: 'standard',
      weather: 'compact',
    })
  })

  it('come back with the Overview’s own choices, a card shown unless it was turned off', async () => {
    vi.stubGlobal(
      'localStorage',
      savedStorage({
        overviewShown: false,
        overviewDefault: true,
        overviewCards: { media: false, weather: 'no' },
      }),
    )
    const { useCabin } = await import('./store')
    expect(useCabin.getState().overviewShown).toBe(false)
    expect(useCabin.getState().overviewDefault).toBe(true)
    expect(useCabin.getState().overviewCards).toEqual({
      trip: true,
      truck: true,
      hours: true,
      media: false,
      weather: true,
    })
  })

  it('start with the Overview offered, the map first, and every card on', async () => {
    vi.stubGlobal('localStorage', savedStorage({}))
    const { useCabin } = await import('./store')
    expect(useCabin.getState().overviewShown).toBe(true)
    expect(useCabin.getState().overviewDefault).toBe(false)
    expect(useCabin.getState().overviewCards).toEqual({
      trip: true,
      truck: true,
      hours: true,
      media: true,
      weather: true,
    })
  })

  it('put the Overview page back to a new Dashboard’s choices', async () => {
    vi.stubGlobal(
      'localStorage',
      savedStorage({
        overviewShown: false,
        overviewDefault: true,
        overviewCards: { trip: false, media: false },
      }),
    )
    const { useCabin } = await import('./store')
    useCabin.getState().resetOverview()
    expect(useCabin.getState()).toMatchObject({
      overviewShown: true,
      overviewDefault: false,
      overviewCards: { trip: true, truck: true, hours: true, media: true, weather: true },
    })
  })

  it('come back with the instrument cluster’s choices, a card shown unless it was turned off', async () => {
    vi.stubGlobal('localStorage', savedStorage({ clusterShown: false, clusterCards: { fuel: false, hours: 'no' } }))
    const { useCabin } = await import('./store')
    expect(useCabin.getState().clusterShown).toBe(false)
    expect(useCabin.getState().clusterCards).toEqual({
      trip: true,
      fuel: false,
      engine: true,
      hours: true,
      warnings: true,
    })
  })

  it('start with the instrument cluster and all its cards on', async () => {
    vi.stubGlobal('localStorage', savedStorage({}))
    const { useCabin } = await import('./store')
    expect(useCabin.getState().clusterShown).toBe(true)
    expect(useCabin.getState().clusterCards).toEqual({
      trip: true,
      fuel: true,
      engine: true,
      hours: true,
      warnings: true,
    })
  })

  it('swap a reading already on the cluster’s engine card into the slot it is picked for', async () => {
    vi.stubGlobal('localStorage', savedStorage({}))
    const { useCabin } = await import('./store')
    // The card starts oil, air, battery: asking for the battery in the first slot trades it with the oil.
    useCabin.getState().setClusterReading(0, 'battery')
    expect(useCabin.getState().clusterReadings).toEqual(['battery', 'brakeAir', 'oilTemperature'])
  })

  it('keep a saved engine card whole when a reading is missing or unknown', async () => {
    vi.stubGlobal(
      'localStorage',
      savedStorage({ clusterAccent: 'neutral', clusterReadings: ['coolant', 'battery', 'nope'] }),
    )
    const { useCabin } = await import('./store')
    expect(useCabin.getState().clusterAccent).toBe('neutral')
    expect(useCabin.getState().clusterReadings).toEqual(['coolant', 'battery', 'oilTemperature'])
  })

  it('put the Instrument Cluster page back to a new dash’s choices', async () => {
    vi.stubGlobal(
      'localStorage',
      savedStorage({
        clusterShown: false,
        clusterAccent: 'neutral',
        clusterTacho: false,
        clusterBrand: false,
        clusterReadings: ['coolant'],
      }),
    )
    const { useCabin } = await import('./store')
    useCabin.getState().resetCluster()
    expect(useCabin.getState()).toMatchObject({
      clusterShown: true,
      clusterAccent: 'route',
      clusterTacho: true,
      clusterBrand: true,
      clusterReadings: ['oilTemperature', 'brakeAir', 'battery'],
      clusterLayout: { left: ['trip', 'engine', 'hours'], right: ['fuel'] },
    })
  })

  it('put a cluster card at a place in a column, as the arrow keys do', async () => {
    vi.stubGlobal('localStorage', savedStorage({}))
    const { useCabin } = await import('./store')
    useCabin.getState().placeClusterCard('hours', 'right', 0)
    expect(useCabin.getState().clusterLayout).toEqual({
      left: ['trip', 'engine'],
      right: ['hours', 'fuel'],
    })
  })

  it('move a cluster card to the other side of the dial', async () => {
    vi.stubGlobal('localStorage', savedStorage({}))
    const { useCabin } = await import('./store')
    useCabin.getState().placeClusterCard('trip', 'right')
    expect(useCabin.getState().clusterLayout).toEqual({ left: ['engine', 'hours'], right: ['fuel', 'trip'] })
  })

  it('move a cluster card up its own column, and nowhere past either end', async () => {
    vi.stubGlobal('localStorage', savedStorage({}))
    const { useCabin } = await import('./store')
    useCabin.getState().moveClusterCard('hours', -1)
    expect(useCabin.getState().clusterLayout.left).toEqual(['trip', 'hours', 'engine'])
    useCabin.getState().moveClusterCard('trip', -1)
    expect(useCabin.getState().clusterLayout.left).toEqual(['trip', 'hours', 'engine'])
  })

  it('drop a cluster card before another on either side', async () => {
    vi.stubGlobal('localStorage', savedStorage({}))
    const { useCabin } = await import('./store')
    useCabin.getState().moveClusterCardTo('fuel', 'trip', false)
    expect(useCabin.getState().clusterLayout).toEqual({
      left: ['fuel', 'trip', 'engine', 'hours'],
      right: [],
    })
    useCabin.getState().moveClusterCardTo('trip', 'hours', true)
    expect(useCabin.getState().clusterLayout).toEqual({
      left: ['fuel', 'engine', 'hours', 'trip'],
      right: [],
    })
  })

  it('apply a ready-made cluster layout', async () => {
    vi.stubGlobal('localStorage', savedStorage({}))
    const { CLUSTER_LAYOUTS, useCabin } = await import('./store')
    useCabin.getState().applyClusterLayout(CLUSTER_LAYOUTS.tank)
    expect(useCabin.getState().clusterLayout).toEqual({ left: ['fuel', 'trip', 'engine'], right: ['hours'] })
  })

  it('keep a saved cluster layout whole: one of each card, and a missing one back in its column', async () => {
    vi.stubGlobal('localStorage', savedStorage({ clusterLayout: { left: ['fuel', 'fuel', 'nope'], right: ['trip'] } }))
    const { useCabin } = await import('./store')
    expect(useCabin.getState().clusterLayout).toEqual({ left: ['fuel', 'engine', 'hours'], right: ['trip'] })
  })

  it('drop a Dashboard widget beside another in its order', async () => {
    vi.stubGlobal('localStorage', savedStorage({}))
    const { useCabin } = await import('./store')
    useCabin.getState().moveWidgetTo('weather', 'nowPlaying', false)
    expect(useCabin.getState().dashboardOrder.slice(0, 2)).toEqual(['weather', 'nowPlaying'])
    const before = useCabin.getState().dashboardOrder.indexOf('diagnostics')
    useCabin.getState().moveWidgetTo('weather', 'diagnostics', true)
    expect(useCabin.getState().dashboardOrder.indexOf('weather')).toBe(before)
  })

  it('apply a Dashboard preset’s order, widgets and sizes, and turn Auto Order off', async () => {
    vi.stubGlobal('localStorage', savedStorage({}))
    const { DASHBOARD_LAYOUTS, useCabin } = await import('./store')
    expect(useCabin.getState().autoOrder).toBe(true)
    useCabin.getState().applyDashboardLayout(DASHBOARD_LAYOUTS.weather)
    const state = useCabin.getState()
    expect(state.autoOrder).toBe(false)
    expect(state.dashboardOrder).toEqual(DASHBOARD_LAYOUTS.weather.order)
    expect(state.dashboardWidgets).toEqual(DASHBOARD_LAYOUTS.weather.widgets)
    expect(state.dashboardWidgetSizes).toEqual(DASHBOARD_LAYOUTS.weather.sizes)
  })

  it('save the current Dashboard as a named layout, and apply it again', async () => {
    const storage = savedStorage({})
    vi.stubGlobal('localStorage', storage)
    const { useCabin } = await import('./store')
    useCabin.getState().moveWidgetTo('weather', 'nowPlaying', false)
    useCabin.getState().setDashboardWidget('weather', true)
    useCabin.getState().setDashboardWidgetSize('weather', 'expanded')
    useCabin.getState().saveDashboardLayout('  Night shift  ')
    const saved = useCabin.getState().savedDashboardLayouts[0]
    expect(saved.name).toBe('Night shift')
    expect(saved.layout.order[0]).toBe('weather')
    expect(saved.layout.widgets.weather).toBe(true)
    expect(saved.layout.sizes.weather).toBe('expanded')
    expect(JSON.parse(storage.getItem('westplay.cabin')!).state.savedDashboardLayouts).toHaveLength(1)

    // The saved layout is a copy: changing the Dashboard doesn't change it.
    useCabin.getState().moveWidgetTo('weather', 'diagnostics', true)
    useCabin.getState().setDashboardWidgetSize('weather', 'compact')
    expect(saved.layout.order[0]).toBe('weather')
    expect(saved.layout.sizes.weather).toBe('expanded')

    useCabin.getState().applyDashboardLayout(saved.layout)
    const state = useCabin.getState()
    expect(state.autoOrder).toBe(false)
    expect(state.dashboardOrder).toEqual(saved.layout.order)
    expect(state.dashboardWidgets).toEqual(saved.layout.widgets)
    expect(state.dashboardWidgetSizes).toEqual(saved.layout.sizes)
  })

  it('replace a saved layout under the same name, and remove it by name', async () => {
    vi.stubGlobal('localStorage', savedStorage({}))
    const { useCabin } = await import('./store')
    useCabin.getState().saveDashboardLayout('Night')
    useCabin.getState().moveWidgetTo('weather', 'nowPlaying', false)
    useCabin.getState().saveDashboardLayout('night')
    expect(useCabin.getState().savedDashboardLayouts).toHaveLength(1)
    expect(useCabin.getState().savedDashboardLayouts[0].name).toBe('night')
    expect(useCabin.getState().savedDashboardLayouts[0].layout.order[0]).toBe('weather')

    useCabin.getState().saveDashboardLayout('   ')
    expect(useCabin.getState().savedDashboardLayouts).toHaveLength(1)
    useCabin.getState().removeDashboardLayout('night')
    expect(useCabin.getState().savedDashboardLayouts).toEqual([])
  })

  it('keep saved layouts from storage, made whole and unique', async () => {
    vi.stubGlobal(
      'localStorage',
      savedStorage({
        savedDashboardLayouts: [
          { name: '  Night  ', layout: { order: ['weather'], widgets: { weather: true }, sizes: { weather: 'huge' } } },
          { name: 'night', layout: { order: ['nowPlaying'], widgets: { nowPlaying: true }, sizes: {} } },
          { name: '   ', layout: {} },
          { name: 'Broken' },
          'nope',
        ],
      }),
    )
    const { DASHBOARD_WIDGETS, useCabin } = await import('./store')
    const saved = useCabin.getState().savedDashboardLayouts
    expect(saved).toHaveLength(1)
    expect(saved[0].name).toBe('Night')
    expect(saved[0].layout.order).toEqual(['weather', ...DASHBOARD_WIDGETS.filter((widget) => widget !== 'weather')])
    expect(saved[0].layout.widgets).toEqual(
      Object.fromEntries(DASHBOARD_WIDGETS.map((widget) => [widget, widget === 'weather'])),
    )
    expect(saved[0].layout.sizes.weather).toBe('standard')
  })

  it('fold the old Compact Player choice into Now Playing’s compact size', async () => {
    vi.stubGlobal('localStorage', savedStorage({ playerCompact: true }))
    const { useCabin } = await import('./store')
    expect(useCabin.getState().dashboardWidgetSizes.nowPlaying).toBe('compact')
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

describe('the cab kept from the last launch', () => {
  it('is let go of when it was saved before the resume switch existed', async () => {
    vi.stubGlobal(
      'localStorage',
      savedStorage({ navigation: { route: { kind: 'app', app: 'maps' }, recents: ['maps'], base: 'dashboard' } }, 4),
    )
    const { useCabin } = await import('./store')
    expect(useCabin.getState().navigation.route).toEqual({ kind: 'dashboard' })
  })
})
