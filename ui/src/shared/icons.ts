/**
 * App icons by role. The UI only ever asks for a role (and a look, light or dark), so replacing the icon set
 * means changing this file.
 *
 * WestPlay's own icons (public/icons/westplay), each in a light and a dark look: drawn in the logo's style, and
 * for the music services their companies' own marks, from their official files (on their own background in the
 * light look, on WestPlay's dark card in the dark look).
 *
 * Each also has an `android` look: Android Auto's, the flat tinted tile with a white mark, which the companion's
 * Customize offers beside Light and Dark.
 */
export type IconLook = 'light' | 'dark' | 'android'

export type AppIconRole =
  | 'maps'
  | 'music'
  | 'radio'
  | 'spotify'
  | 'podcasts'
  | 'messages'
  | 'phone'
  | 'settings'
  | 'weather'
  | 'youtube'
  | 'youtubeMusic'
  | 'browser'
  | 'diagnostics'
  | 'driver'
  | 'notifications'

/** Each role's files' name. */
const FILES: Record<AppIconRole, string> = {
  maps: 'maps',
  music: 'music',
  radio: 'radio',
  spotify: 'spotify',
  podcasts: 'podcasts',
  messages: 'messages',
  phone: 'phone',
  settings: 'settings',
  weather: 'weather',
  youtube: 'youtube',
  youtubeMusic: 'youtube-music',
  browser: 'browser',
  diagnostics: 'diagnostics',
  driver: 'driver',
  notifications: 'notifications',
}

/** WestPlay's own icon for `role`: for a light or a dark screen, or as Android Auto draws it. */
export function appIcon(role: AppIconRole, look: IconLook = 'light'): string {
  return `/icons/westplay/${FILES[role]}.${look}.svg`
}
