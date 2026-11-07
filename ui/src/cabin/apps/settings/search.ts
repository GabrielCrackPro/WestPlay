import type { Strings } from '../../state/strings'
import type { SettingsPage } from './settings'

/** A setting the Settings app can find: a row's name, the page it lives on, and that page's name beside it. */
export interface SettingsEntry {
  label: string
  page: SettingsPage
  /** Where it is: the page's own name, as the result row says it. */
  section: string
}

/**
 * Every row of the Settings app, with the page that holds it: the pages and their settings, both the cab's own
 * (Appearance, Dashboard, Home Screen, Sound) and the map's and the player's. Built from the cabin's words, so a
 * search matches what the player sees, in their language.
 */
export function settingsEntries(text: Strings): SettingsEntry[] {
  const s = text.settings
  const d = text.destinations
  const words = text.diagnostics
  return [
    { label: s.appearance, page: 'appearance', section: s.appearance },
    { label: s.light, page: 'appearance', section: s.appearance },
    { label: s.dark, page: 'appearance', section: s.appearance },
    { label: s.automatic, page: 'appearance', section: s.appearance },
    { label: s.vehicleBar, page: 'appearance', section: s.appearance },
    { label: s.reduceMotion, page: 'appearance', section: s.appearance },
    { label: s.textSize, page: 'textSize', section: s.appearance },
    { label: s.wallpaper, page: 'wallpaper', section: s.wallpaper },
    { label: s.icons, page: 'icons', section: s.icons },
    { label: s.iconStyle, page: 'icons', section: s.icons },
    { label: s.dashboard, page: 'dashboard', section: s.dashboard },
    { label: s.widgets, page: 'dashboard', section: s.dashboard },
    { label: s.autoOrder, page: 'dashboard', section: s.dashboard },
    { label: s.realClock, page: 'dashboard', section: s.dashboard },
    { label: s.playerCompact, page: 'dashboard', section: s.dashboard },
    { label: text.nowPlaying, page: 'dashboard', section: s.dashboard },
    { label: text.destination, page: 'dashboard', section: s.dashboard },
    { label: words.driverHours, page: 'dashboard', section: s.dashboard },
    { label: text.apps.driver, page: 'dashboard', section: s.dashboard },
    { label: text.apps.weather, page: 'dashboard', section: s.dashboard },
    { label: text.apps.diagnostics, page: 'dashboard', section: s.dashboard },
    { label: s.homeScreen, page: 'home', section: s.homeScreen },
    { label: s.showOnHome, page: 'home', section: s.homeScreen },
    { label: s.editHomeScreen, page: 'home', section: s.homeScreen },
    { label: s.resetHomeScreen, page: 'home', section: s.homeScreen },
    { label: s.pinToSidebar, page: 'home', section: s.homeScreen },
    { label: s.unpinFromSidebar, page: 'home', section: s.homeScreen },
    { label: text.apps.maps, page: 'map', section: text.apps.maps },
    { label: s.mapsDisplay, page: 'mapDisplay', section: text.apps.maps },
    { label: s.mapsRoute, page: 'mapRoute', section: text.apps.maps },
    { label: s.mapsMarkers, page: 'mapMarkers', section: text.apps.maps },
    { label: s.stopCard, page: 'mapStopCard', section: text.apps.maps },
    { label: s.stopCardAlways, page: 'mapStopCard', section: s.stopCard },
    { label: s.stopCardFuel, page: 'mapStopCard', section: s.stopCard },
    { label: s.stopCardRest, page: 'mapStopCard', section: s.stopCard },
    { label: d.mapDetail, page: 'mapDisplay', section: s.mapsDisplay },
    { label: d.mapNight, page: 'mapDisplay', section: s.mapsDisplay },
    { label: d.mapNightFrom, page: 'mapDisplay', section: s.mapsDisplay },
    { label: d.mapNorth, page: 'mapDisplay', section: s.mapsDisplay },
    { label: d.mapLimit, page: 'mapDisplay', section: s.mapsDisplay },
    { label: d.mapOver, page: 'mapDisplay', section: s.mapsDisplay },
    { label: d.mapCompass, page: 'mapDisplay', section: s.mapsDisplay },
    { label: d.mapScale, page: 'mapDisplay', section: s.mapsDisplay },
    { label: d.mapRecentre, page: 'mapDisplay', section: s.mapsDisplay },
    { label: d.mapTraffic, page: 'mapTraffic', section: d.mapTraffic },
    { label: d.mapJunction, page: 'mapTraffic', section: d.mapTraffic },
    { label: d.mapTrucks, page: 'mapTraffic', section: d.mapTraffic },
    { label: d.routeColour, page: 'mapRoute', section: s.mapsRoute },
    { label: d.routeWeight, page: 'mapRoute', section: s.mapsRoute },
    { label: d.marker, page: 'mapMarkers', section: s.mapsMarkers },
    { label: d.markerSize, page: 'mapMarkers', section: s.mapsMarkers },
    { label: d.pinStyle, page: 'mapMarkers', section: s.mapsMarkers },
    { label: d.pinsFuel, page: 'mapMarkers', section: s.mapsMarkers },
    { label: d.pinsParking, page: 'mapMarkers', section: s.mapsMarkers },
    { label: d.pinsService, page: 'mapMarkers', section: s.mapsMarkers },
    { label: text.nowPlaying, page: 'nowPlaying', section: text.nowPlaying },
    { label: s.showAlbumArt, page: 'nowPlaying', section: text.nowPlaying },
    { label: s.sound, page: 'sound', section: s.sound },
    { label: s.uiSounds, page: 'sound', section: s.sound },
    { label: s.uiSoundVolume, page: 'sound', section: s.sound },
    { label: s.equalizer, page: 'equalizer', section: s.sound },
    { label: s.recommended, page: 'equalizer', section: s.equalizer },
    { label: s.custom, page: 'equalizer', section: s.equalizer },
    { label: s.low, page: 'equalizer', section: s.equalizer },
    { label: s.mid, page: 'equalizer', section: s.equalizer },
    { label: s.high, page: 'equalizer', section: s.equalizer },
    { label: s.resetEqualizer, page: 'equalizer', section: s.equalizer },
  ]
}

/** Folded for matching: lower case, accents off (the Turkish dotted and dotless i alike), as the map's search does. */
function fold(text: string): string {
  return text.toLocaleLowerCase('tr').normalize('NFD').replace(/\p{M}/gu, '').replace(/ı/g, 'i')
}

/** The most results a search shows: enough to scan, not a second Settings list. */
const MOST = 40

/**
 * The settings matching `query`: those whose name starts with it first, then those whose name holds it, then
 * those only on a page of that name (typing "maps" finds every map setting). Each row once, shortest names first.
 */
export function searchSettings(entries: readonly SettingsEntry[], query: string): SettingsEntry[] {
  const asked = fold(query.trim())
  if (!asked) return []
  const seen = new Set<string>()
  const found: { entry: SettingsEntry; rank: number }[] = []
  for (const entry of entries) {
    const label = fold(entry.label)
    const rank = label.startsWith(asked) ? 0 : label.includes(asked) ? 1 : fold(entry.section).includes(asked) ? 2 : -1
    if (rank < 0) continue
    const key = `${entry.page}\n${entry.label}`
    if (seen.has(key)) continue
    seen.add(key)
    found.push({ entry, rank })
  }
  return found
    .sort((a, b) => a.rank - b.rank || fold(a.entry.label).length - fold(b.entry.label).length)
    .slice(0, MOST)
    .map(({ entry }) => entry)
}
