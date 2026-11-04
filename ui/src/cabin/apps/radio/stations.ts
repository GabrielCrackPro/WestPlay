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

/** Every genre the stations have, in the order their first station brings it. */
export function genresOf(stations: readonly Station[]): string[] {
  return [...new Set(stations.map(genreOf))]
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
