import type { AppIconRole } from '../../shared/icons'

/** Every app WestPlay knows, in Home grid order. */
export const APP_IDS = [
  'maps',
  'music',
  'spotify',
  'youtube',
  'youtubeMusic',
  'podcasts',
  'phone',
  'messages',
  'weather',
  'settings',
  'diagnostics',
  'notifications',
] as const

export type AppId = (typeof APP_IDS)[number]

/** An app: its id and icon (its name is in the cabin's language: state/text.ts). */
export interface AppDefinition {
  id: AppId
  icon: AppIconRole
}

export const APPS: Record<AppId, AppDefinition> = {
  maps: { id: 'maps', icon: 'maps' },
  music: { id: 'music', icon: 'music' },
  spotify: { id: 'spotify', icon: 'spotify' },
  youtube: { id: 'youtube', icon: 'youtube' },
  youtubeMusic: { id: 'youtubeMusic', icon: 'youtubeMusic' },
  podcasts: { id: 'podcasts', icon: 'podcasts' },
  phone: { id: 'phone', icon: 'phone' },
  messages: { id: 'messages', icon: 'messages' },
  weather: { id: 'weather', icon: 'weather' },
  settings: { id: 'settings', icon: 'settings' },
  diagnostics: { id: 'diagnostics', icon: 'diagnostics' },
  notifications: { id: 'notifications', icon: 'notifications' },
}

export function isAppId(value: unknown): value is AppId {
  return typeof value === 'string' && (APP_IDS as readonly string[]).includes(value)
}

/** Not in this release: Podcasts, Phone and Messages come in the one after 1.0 (PLAN.md). Their ids stay (their
 * icons, players' icon sets), but they're not on Home, and a saved screen or recent can't open them. */
const NEXT_RELEASE: ReadonlySet<AppId> = new Set<AppId>(['podcasts', 'phone', 'messages'])

/** The apps this release has, in Home grid order. */
export const RELEASED_APP_IDS: readonly AppId[] = APP_IDS.filter((id) => !NEXT_RELEASE.has(id))

/** An app this release has (`isAppId`, less the ones still to come). */
export function isReleasedApp(value: unknown): value is AppId {
  return isAppId(value) && !NEXT_RELEASE.has(value)
}

/**
 * Home's apps in the player's order (Settings › Home Screen): every app this release has once, any the saved order
 * doesn't know about after them, in the apps' own order.
 */
export function homeOrderOf(saved: unknown): AppId[] {
  const kept = (Array.isArray(saved) ? saved : []).filter(isReleasedApp)
  const unique = [...new Set(kept)]
  return [...unique, ...RELEASED_APP_IDS.filter((app) => !unique.includes(app))]
}

/** The apps hidden from Home, each once (`saved` may come from an older WestPlay, or be edited). */
export function hiddenHomeApps(saved: unknown): AppId[] {
  return [...new Set((Array.isArray(saved) ? saved : []).filter(isReleasedApp))]
}

/**
 * The apps Home shows: the player's order, less the ones hidden. At least one stays: hiding the last one would
 * leave no way back to Settings from Home.
 */
export function visibleHomeApps(order: readonly AppId[], hidden: readonly AppId[]): AppId[] {
  const hiddenSet = new Set(hidden)
  const shown = homeOrderOf(order).filter((app) => !hiddenSet.has(app))
  return shown.length > 0 ? shown : homeOrderOf(order)
}
