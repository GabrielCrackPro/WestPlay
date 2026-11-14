import { type AppId, RELEASED_APP_IDS } from '../state/apps'
import { fold } from '../maps/places'
import type { Strings } from '../state/strings'
import type { MediaAction } from './media'

// Keys are folded (lower case, no accents) because every transcript is folded before it gets here.
const APP_ALIASES: Record<string, AppId> = {
  map: 'maps',
  maps: 'maps',
  mapa: 'maps',
  mapas: 'maps',
  harita: 'maps',
  haritalar: 'maps',
  haritalari: 'maps',
  haritayi: 'maps',
  music: 'music',
  'apple music': 'music',
  apple: 'music',
  musica: 'music',
  muzik: 'music',
  muzigi: 'music',
  phone: 'phone',
  telefono: 'phone',
  telefon: 'phone',
  telefonu: 'phone',
  spotify: 'spotify',
  youtube: 'youtube',
  'youtube music': 'youtubeMusic',
  radio: 'radio',
  radyo: 'radio',
  weather: 'weather',
  clima: 'weather',
  tiempo: 'weather',
  'hava durumu': 'weather',
  settings: 'settings',
  ajustes: 'settings',
  ayarlar: 'settings',
  ayarlari: 'settings',
  diagnostics: 'diagnostics',
  diagnostico: 'diagnostics',
  tanilama: 'diagnostics',
  tanilamasi: 'diagnostics',
  driver: 'driver',
  conductor: 'driver',
  surucu: 'driver',
  notifications: 'notifications',
  alerts: 'notifications',
  avisos: 'notifications',
  notificaciones: 'notifications',
  bildirimler: 'notifications',
  uyarilar: 'notifications',
  whatsapp: 'whatsapp',
}

const OPEN_PREFIXES = [
  'open ',
  'launch ',
  'start ',
  'switch to ',
  'show ',
  'ac ',
  'abre ',
  'abrir ',
  'inicia ',
  'lanza ',
  'cambia a ',
]

/** The polite words a player may put around a command, stripped before it is read. */
const LEADING_FILLERS = [
  'please ',
  'hey cabin ',
  'hey westplay ',
  'okay cabin ',
  'ok cabin ',
  'can you ',
  'could you ',
  'would you ',
  'will you ',
  'lütfen ',
  'hey asistan ',
  'asistan ',
  'por favor ',
  'oye ',
  'asistente ',
]

const TRAILING_FILLERS = [' please', ' lütfen', ' por favor']

/** Reads a transcript the same way the intents do: folded, without punctuation or a polite lead-in. */
export function normalizeSaid(transcript: string): string {
  let said = fold(transcript)
    .replace(/[.!?]+$/g, '')
    .replace(/[,;:]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  let changed = true
  while (changed) {
    changed = false
    for (const filler of LEADING_FILLERS) {
      const folded = fold(filler)
      if (!said.startsWith(folded)) continue
      said = said.slice(folded.length).trim()
      changed = true
    }
  }
  for (const filler of TRAILING_FILLERS) {
    const folded = fold(filler)
    if (said.endsWith(folded)) said = said.slice(0, -folded.length).trim()
  }
  return said
}

export function mediaAction(transcript: string): MediaAction | null {
  const said = normalizeSaid(transcript)
  if (
    [
      'play',
      'resume',
      'start music',
      'play music',
      'continue',
      'oynat',
      'devam et',
      'reproducir',
      'continuar',
    ].includes(said)
  ) {
    return 'play'
  }
  if (
    [
      'pause',
      'pause music',
      'stop music',
      'stop playback',
      'duraklat',
      'durdur',
      'muzigi durdur',
      'pausa',
      'pausar',
      'detener musica',
    ].includes(said)
  ) {
    return 'pause'
  }
  if (['play pause', 'toggle playback', 'oynat duraklat', 'reproducir pausa'].includes(said)) {
    return 'toggle'
  }
  if (
    [
      'next',
      'next track',
      'next song',
      'skip',
      'skip song',
      'sonraki',
      'sonraki sarki',
      'siguiente',
      'siguiente cancion',
    ].includes(said)
  ) {
    return 'next'
  }
  if (
    [
      'previous',
      'previous track',
      'previous song',
      'back',
      'go back',
      'onceki',
      'onceki sarki',
      'anterior',
      'cancion anterior',
    ].includes(said)
  ) {
    return 'previous'
  }
  if (
    [
      'volume up',
      'turn it up',
      'turn up the volume',
      'louder',
      'increase volume',
      'sesi ac',
      'sesi yukselt',
      'subir volumen',
      'mas volumen',
    ].includes(said)
  ) {
    return 'volumeUp'
  }
  if (
    [
      'volume down',
      'turn it down',
      'turn down the volume',
      'quieter',
      'decrease volume',
      'sesi kis',
      'sesi azalt',
      'bajar volumen',
      'menos volumen',
    ].includes(said)
  ) {
    return 'volumeDown'
  }
  return null
}

export function appFrom(transcript: string, text: Strings): AppId | null {
  const said = normalizeSaid(transcript)
  for (const app of RELEASED_APP_IDS) {
    const name = fold(text.apps[app])
    if (name && said === name) return app
  }
  const rest = OPEN_PREFIXES.find((prefix) => said.startsWith(prefix))
  const opened = rest ? said.slice(rest.length).trim() : said
  const withoutSuffix = opened.endsWith(' ac') ? opened.slice(0, -3).trim() : opened
  const withoutArticle = withoutSuffix.replace(/^(el|la|los|las|the)\s+/, '')
  const name = fold(withoutArticle)
  const alias = APP_ALIASES[name]
  if (alias) return alias
  for (const [word, app] of Object.entries(APP_ALIASES)) {
    if (name === word || name.startsWith(`${word} `)) return app
  }
  for (const app of RELEASED_APP_IDS) {
    const localized = fold(text.apps[app])
    if (localized && (name === localized || name.startsWith(`${localized} `))) return app
  }
  return null
}
