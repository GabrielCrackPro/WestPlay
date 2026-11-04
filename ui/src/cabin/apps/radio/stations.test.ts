import { describe, expect, it } from 'vitest'
import { genresOf, groupsOf, stationsOf } from './stations'

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
})
