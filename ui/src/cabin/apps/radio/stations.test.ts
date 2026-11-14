import { describe, expect, it } from 'vitest'
import {
  bytesUrlOf,
  channelsOf,
  favouritesOf,
  genreToShow,
  genresOf,
  groupsOf,
  isHlsUrl,
  isPlaylistUrl,
  matchesOf,
  stationsOf,
  streamOf,
  titleUrlOf,
} from './stations'

const told = [
  { name: 'Radio One', genre: 'Pop', language: 'English', bitrate: 128, url: 'https://radio.example/one' },
  { name: ' Radio Two ', genre: 'Pop', language: 'Turkish', bitrate: 160, url: 'http://radio.example/two' },
  { name: 'Rock FM', genre: 'Rock', language: '', bitrate: 0, url: 'https://radio.example/rock' },
  { name: 'A local one', genre: '', language: 'Spanish', bitrate: 96, url: 'https://radio.example/local' },
]

describe('the game’s stations', () => {
  it('keeps the list’s order, trimming what the game wrote', () => {
    const stations = stationsOf(told)
    expect(stations.map((station) => station.name)).toEqual(['Radio One', 'Radio Two', 'Rock FM', 'A local one'])
    expect(stations[1].url).toBe('http://radio.example/two')
    expect(stations[2].genre).toBe('Rock')
  })

  it('leaves out what can’t play, and the same stream twice', () => {
    const stations = stationsOf([
      ...told,
      { name: 'Again', genre: 'Pop', url: 'https://radio.example/one' },
      { name: 'No stream', genre: 'Pop' },
      { name: 'Not a stream', url: 'file:///music.mp3' },
      { genre: 'Pop', url: 'https://radio.example/three' },
      null,
      'Radio',
    ])
    expect(stations.map((station) => station.url)).toEqual([
      'https://radio.example/one',
      'http://radio.example/two',
      'https://radio.example/rock',
      'https://radio.example/local',
      'https://radio.example/three',
    ])
    // A station the game gave no name to is its stream.
    expect(stations[4].name).toBe('https://radio.example/three')
  })

  it('reads what it doesn’t know as nothing', () => {
    expect(stationsOf(undefined)).toEqual([])
    expect(stationsOf([{ name: 'x', url: 'https://a', bitrate: 'fast', genre: 7 }])[0]).toMatchObject({
      bitrate: 0,
      genre: '',
      language: '',
    })
  })

  it('groups by genre, the genres in the list’s order, the ones with none last', () => {
    const stations = stationsOf(told)
    expect(genresOf(stations)).toEqual(['Pop', 'Rock', ''])
    expect(groupsOf(stations).map((group) => [group.genre, group.stations.length])).toEqual([
      ['Pop', 2],
      ['Rock', 1],
      ['', 1],
    ])
  })

  it('shows the genre picked while the list has it, and every station once it doesn’t', () => {
    expect(genreToShow(['Pop', 'Rock'], 'Rock')).toBe('Rock')
    // A search, or the list read again, may take the genre away: the app shows them all rather than nothing.
    expect(genreToShow(['Pop'], 'Rock')).toBe('all')
    // The stations with no genre are a genre of their own, and all of them is always one to show.
    expect(genreToShow(['Pop', ''], '')).toBe('')
    expect(genreToShow([], 'all')).toBe('all')
  })
})

describe('a station’s stream', () => {
  it('goes through this PC’s door when there is one, its own server otherwise', () => {
    expect(streamOf('https://radio.example/one', null)).toBe('https://radio.example/one')
    const door = 'http://127.0.0.1:49512'
    const through = streamOf('https://radio.example/one?s=1', door)
    expect(through.startsWith(`${door}/s/`)).toBe(true)
    // The host reads the station back from the door's path: its UTF-8 bytes, base64, url-safe and unpadded.
    const encoded = through.slice(`${door}/s/`.length)
    expect(atob(encoded.replace(/-/g, '+').replace(/_/g, '/'))).toBe('https://radio.example/one?s=1')
  })

  it('says which of a playlist’s streams to play, and nothing when the first is wanted', () => {
    const door = 'http://127.0.0.1:49512'
    const first = streamOf('http://radio.example/listen.pls', door)
    expect(first.includes('?')).toBe(false)
    expect(streamOf('http://radio.example/listen.pls', door, 1)).toBe(first)
    expect(streamOf('http://radio.example/listen.pls', door, 2)).toBe(`${first}?n=2`)
  })
})

describe('a station’s channels', () => {
  it('are the streams its playlist names, each once, as the door sent them', () => {
    expect(
      channelsOf([
        { url: 'http://radio.example/128', name: 'Radio Example 128' },
        { url: 'http://radio.example/128', name: 'Again' },
        { url: ' http://radio.example/64 ', name: '  ' },
        { name: 'Nowhere' },
        { url: 'file:///music.mp3' },
        null,
        'Radio',
      ]),
    ).toEqual([
      { url: 'http://radio.example/128', name: 'Radio Example 128' },
      { url: 'http://radio.example/64', name: '' },
    ])
  })

  it('are what a playlist station has, and an HLS one is played as HLS', () => {
    expect(isPlaylistUrl('http://radio.example/listen.pls')).toBe(true)
    expect(isPlaylistUrl('http://radio.example/live.M3U?sid=1')).toBe(true)
    expect(isPlaylistUrl('https://radio.example/live.mp3')).toBe(false)
    expect(isHlsUrl('https://radio.example/live.m3u8')).toBe(true)
    expect(isHlsUrl('https://radio.example/live.m3u8#t=1')).toBe(true)
    // A playlist is no HLS stream, and an HLS stream is no playlist to read its streams from.
    expect(isPlaylistUrl('https://radio.example/live.m3u8')).toBe(false)
    expect(isHlsUrl('http://radio.example/listen.pls')).toBe(false)
  })
})

describe('the player’s favourites', () => {
  const one = { name: 'One', genre: 'Pop', language: 'English', bitrate: 128, url: 'https://radio.example/one' }
  const two = { name: 'Two', genre: 'Rock', language: '', bitrate: 0, url: 'https://radio.example/two' }

  it('keep the order they were picked in, and the list’s newer name', () => {
    const renamed = { ...one, name: 'One (new)' }
    expect(favouritesOf([renamed, two], [two, one]).map((each) => each.name)).toEqual(['Two', 'One (new)'])
  })

  it('keep a station the game’s list no longer has: its stream still plays', () => {
    expect(favouritesOf([two], [one, two]).map((each) => each.name)).toEqual(['One', 'Two'])
  })
})

describe('an HLS station’s own bytes', () => {
  it('are asked of this PC’s door, and of nowhere when there is none', () => {
    expect(bytesUrlOf('https://radio.example/live.m3u8', null)).toBeNull()
    const door = 'http://127.0.0.1:49512'
    const asked = bytesUrlOf('https://radio.example/live.m3u8', door)
    expect(asked?.startsWith(`${door}/b/`)).toBe(true)
    const encoded = (asked ?? '').slice(`${door}/b/`.length)
    expect(atob(encoded.replace(/-/g, '+').replace(/_/g, '/'))).toBe('https://radio.example/live.m3u8')
  })
})

describe('a station’s song', () => {
  it('is asked of this PC’s door, and of nowhere when there is none', () => {
    expect(titleUrlOf('https://radio.example/one', null)).toBeNull()
    const door = 'http://127.0.0.1:49512'
    const asked = titleUrlOf('https://radio.example/one?s=1', door)
    expect(asked?.startsWith(`${door}/t/`)).toBe(true)
    const encoded = (asked ?? '').slice(`${door}/t/`.length)
    expect(atob(encoded.replace(/-/g, '+').replace(/_/g, '/'))).toBe('https://radio.example/one?s=1')
  })
})

describe('searching the stations', () => {
  const stations = stationsOf(told)

  it('finds a station by its name, blind to case', () => {
    expect(matchesOf(stations, 'radio').map((station) => station.name)).toEqual(['Radio One', 'Radio Two'])
    expect(matchesOf(stations, ' RADIO TWO ').map((station) => station.name)).toEqual(['Radio Two'])
    expect(matchesOf(stations, 'rock').map((station) => station.name)).toEqual(['Rock FM'])
  })

  it('takes the accents off the name and what was typed alike', () => {
    const accented = stationsOf([{ name: 'FunX (Países Bajos)', genre: 'Afro', url: 'https://radio.example/fx' }])
    expect(matchesOf(accented, 'paises')).toHaveLength(1)
    expect(matchesOf(accented, 'PAÍSES')).toHaveLength(1)
  })

  it('is every station with nothing typed, and none that doesn’t match', () => {
    expect(matchesOf(stations, '')).toHaveLength(4)
    expect(matchesOf(stations, 'nothing like this')).toEqual([])
  })
})
