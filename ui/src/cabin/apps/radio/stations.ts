/**
 * The stations of the game's own radio list (`live_streams.sii`, read by the host): what they are, and how the
 * app groups them by genre. Pure, so the list can be tried without a game (stations.test.ts).
 */
export interface Station {
  name: string
  /** The game's genre, as its list has it ('' when it has none). */
  genre: string
  /** The game's language, as its list has it ('' when it has none). */
  language: string
  /** kbit/s (0: not said). */
  bitrate: number
  url: string
}

/** A station's genre as the app shows it: '' for the ones the game gives no genre. */
export function genreOf(station: Station): string {
  return station.genre.trim()
}

/** A genre's stations, in the order the game's list has them. */
export interface StationGroup {
  /** '' for the stations with no genre (shown last, as the game's own menu does). */
  genre: string
  stations: Station[]
}

/**
 * The stations the host sent, made safe: a station with a name and an http(s) stream, each once (the game's list
 * may hold the same stream twice), and not more than a list's worth. Anything else in the message (an older
 * host's) is left out.
 */
export function stationsOf(told: unknown): Station[] {
  if (!Array.isArray(told)) return []
  const stations: Station[] = []
  const seen = new Set<string>()
  for (const each of told) {
    if (typeof each !== 'object' || each === null) continue
    const { name, genre, language, bitrate, url } = each as Record<string, unknown>
    if (typeof url !== 'string') continue
    const clean = url.trim()
    if (!/^https?:\/\//i.test(clean) || seen.has(clean)) continue
    seen.add(clean)
    stations.push({
      // A station the host gave no name to is its stream (as the game's own list does).
      name: typeof name === 'string' && name.trim() ? name.trim() : clean,
      genre: typeof genre === 'string' ? genre : '',
      language: typeof language === 'string' ? language : '',
      bitrate: typeof bitrate === 'number' && Number.isFinite(bitrate) ? Math.max(0, Math.round(bitrate)) : 0,
      url: clean,
    })
    if (stations.length === MAX_STATIONS) break
  }
  return stations
}

/** How many stations the app lists: a mod's list is not a place to freeze the screen. */
const MAX_STATIONS = 1000

/**
 * A station's stream as the page plays it: through this PC's own door (`stations_message`'s `proxy`, the host's
 * `radio_proxy`), which serves the station's bytes with the leave for the truck's speakers to hear them, or from
 * the station's own server when this PC has no door. `channel` is which of a playlist's streams (`1`: its first).
 */
export function streamOf(url: string, proxy: string | null, channel = 1): string {
  if (!proxy) return url
  return `${proxy}/s/${base64url(url)}${channel > 1 ? `?n=${channel}` : ''}`
}

/**
 * Where the door tells what streams a station's playlist offers (`/l/<station>`, the face's channels), or `null`
 * when this PC has no door: a station played from its own server is one page the playlist is the station's alone.
 */
export function channelsUrlOf(url: string, proxy: string | null): string | null {
  return proxy ? `${proxy}/l/${base64url(url)}` : null
}

/**
 * Where the door hands over a station's own bytes as its server sends them (`/b/<station>`: an HLS list, or one of
 * its segments), or `null` when this PC has no door.
 */
export function bytesUrlOf(url: string, proxy: string | null): string | null {
  return proxy ? `${proxy}/b/${base64url(url)}` : null
}

/** One of a station's streams: the address its playlist gives it, and the name the playlist gives it (`''`: none). */
export interface Channel {
  url: string
  name: string
}

/**
 * The streams a station's playlist offers, as the door sent them: each a stream the page can play, once, and only
 * those the playlist named (anything else in the message is left out). Nothing means there's nothing to choose.
 */
export function channelsOf(told: unknown): Channel[] {
  if (!Array.isArray(told)) return []
  const channels: Channel[] = []
  const seen = new Set<string>()
  for (const each of told) {
    if (typeof each !== 'object' || each === null) continue
    const { url, name } = each as Record<string, unknown>
    if (typeof url !== 'string') continue
    const clean = url.trim()
    if (!/^https?:\/\//i.test(clean) || seen.has(clean)) continue
    seen.add(clean)
    channels.push({ url: clean, name: typeof name === 'string' ? name.trim() : '' })
  }
  return channels
}

/** Whether a station's address names a playlist of streams (`.pls`, `.m3u`): one with channels to offer. */
export function isPlaylistUrl(url: string): boolean {
  const named = namedUrl(url)
  return named.endsWith('.pls') || named.endsWith('.m3u')
}

/** Whether a station's address names an HLS stream (`.m3u8`): the page plays it with HLS, not as a plain stream. */
export function isHlsUrl(url: string): boolean {
  return namedUrl(url).endsWith('.m3u8')
}

/** A station's address without its query or fragment, in lower case: what its name says it is. */
function namedUrl(url: string): string {
  return (url.split(/[?#]/)[0] ?? url).toLocaleLowerCase()
}

/**
 * Where the door tells what a station plays (`http://…/t/<station>`: the song it last sent with its audio), or
 * `null` when this PC has no door: a station played from its own server keeps its song inside its stream, where
 * the page can't read it.
 */
export function titleUrlOf(url: string, proxy: string | null): string | null {
  return proxy ? `${proxy}/t/${base64url(url)}` : null
}

/** A station's url as the host's door reads it: its UTF-8 bytes, base64, in the url-safe alphabet and unpadded. */
function base64url(text: string): string {
  let binary = ''
  for (const byte of new TextEncoder().encode(text)) binary += String.fromCharCode(byte)
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

/** A station's own colour, as its preset is washed in it: its name, hashed to a hue. */
export function hueOf(name: string): number {
  let hue = 0
  for (let index = 0; index < name.length; index++) hue = (hue * 31 + name.charCodeAt(index)) % 360
  return hue
}

/** A station's first letters, on its preset: the first of its first two words. */
export function initialsOf(name: string): string {
  const words = name
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .split(/\s+/)
    .filter(Boolean)
  const first = words[0]?.[0] ?? '?'
  const second = words.length > 1 ? words[1][0] : ''
  return (first + second).toLocaleUpperCase()
}

/**
 * The player's favourite stations, in the order they picked them, with the page's own copy of each: the game's
 * list may have newer details for a station, or no longer hold it (a stream plays whether its line is in the
 * list or not).
 */
export function favouritesOf(stations: readonly Station[], favourites: readonly Station[]): Station[] {
  return favourites.map((each) => stations.find((station) => station.url === each.url) ?? each)
}

/**
 * The stations whose name has what the player typed, in the list's order: a search for a station among many, blind
 * to case and to accents (a station the game wrote with its own accents is found without them). Nothing typed is
 * every station.
 */
export function matchesOf(stations: readonly Station[], query: string): Station[] {
  const typed = folded(query)
  if (!typed) return [...stations]
  return stations.filter((station) => folded(station.name).includes(typed))
}

/** Text as a search compares it: lower case, and without the accents the game's list may write. */
function folded(text: string): string {
  return text
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .trim()
    .toLocaleLowerCase()
}

/** Every genre the stations have, in the order their first station brings it. */
export function genresOf(stations: readonly Station[]): string[] {
  return [...new Set(stations.map(genreOf))]
}

/**
 * The genre the app shows of those the list has: the one chosen while the list still has stations of it, all of
 * them otherwise (a search, or the game's list read again, may take a genre away).
 */
export function genreToShow(genres: readonly string[], chosen: string): string {
  return chosen === 'all' || genres.includes(chosen) ? chosen : 'all'
}

/**
 * The stations by genre, the genres in the order the list brings them, and the stations with none last (as the
 * game's own radio menu has them). The stations in each keep the list's order.
 */
export function groupsOf(stations: readonly Station[]): StationGroup[] {
  const groups: StationGroup[] = []
  for (const station of stations) {
    const genre = genreOf(station)
    const group = groups.find((each) => each.genre === genre)
    if (group) group.stations.push(station)
    else groups.push({ genre, stations: [station] })
  }
  return [...groups.filter((group) => group.genre !== ''), ...groups.filter((group) => group.genre === '')]
}
