import { create } from 'zustand'

/** The Settings app's pages: its list, the page each row opens, and the pages within those (Appearance's Text
 * Size, Dashboard's Overview, Sound's Equalizer). */
export type SettingsPage =
  | 'list'
  | 'general'
  | 'appearance'
  | 'textSize'
  | 'wallpaper'
  | 'icons'
  | 'dashboard'
  | 'overview'
  | 'cluster'
  | 'units'
  | 'home'
  | 'nowPlaying'
  | 'sound'
  | 'gpsVoice'
  | 'equalizer'
  | 'voice'
  | 'map'
  | 'mapDisplay'
  | 'mapTraffic'
  | 'mapRoute'
  | 'mapMarkers'
  | 'mapStopCard'
  | 'profiles'

/** The page a page is within, where its back button goes (the list, but for the pages within a page). */
export const PARENT: Partial<Record<SettingsPage, SettingsPage>> = {
  textSize: 'appearance',
  overview: 'dashboard',
  equalizer: 'sound',
  mapDisplay: 'map',
  mapTraffic: 'map',
  mapRoute: 'map',
  mapMarkers: 'map',
  mapStopCard: 'map',
}

interface SettingsState {
  /** The page shown; kept while the app is closed, as iOS's Settings comes back where it was. */
  page: SettingsPage
  /** Which way the last page change went: a page slides in from the right, the list back from the left
   * (`none`: the app has just opened, and the page grows with its window instead). */
  went: 'none' | 'in' | 'back'
  open(page: SettingsPage): void
  back(): void
}

export const useSettings = create<SettingsState>()((set) => ({
  page: 'list',
  went: 'none',
  open: (page) => set({ page, went: 'in' }),
  back: () => set((state) => ({ page: PARENT[state.page] ?? 'list', went: 'back' })),
}))
