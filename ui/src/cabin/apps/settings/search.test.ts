import { describe, expect, it } from 'vitest'
import { searchSettings, type SettingsEntry } from './search'

const entries: SettingsEntry[] = [
  { label: 'Dim at Night', page: 'mapDisplay', section: 'Maps' },
  { label: 'Night Mode', page: 'appearance', section: 'Appearance' },
  { label: 'Automatic', page: 'appearance', section: 'Appearance' },
  { label: 'Text Size', page: 'textSize', section: 'Appearance' },
  { label: 'Yakıt Alt Sınırı', page: 'mapStopCard', section: 'Mola Kartı' },
]

describe('settings search', () => {
  it('finds a row by name, whatever the case or the accents', () => {
    expect(searchSettings(entries, 'dim').map((entry) => entry.label)).toEqual(['Dim at Night'])
    expect(searchSettings(entries, 'YAKIT').map((entry) => entry.label)).toEqual(['Yakıt Alt Sınırı'])
  })

  it('puts a name that starts with the query before one that only holds it', () => {
    expect(searchSettings(entries, 'night').map((entry) => entry.label)).toEqual(['Night Mode', 'Dim at Night'])
  })

  it('falls back to the page’s name, and finds nothing without a query', () => {
    expect(searchSettings(entries, 'appearance').map((entry) => entry.label)).toEqual([
      'Automatic',
      'Text Size',
      'Night Mode',
    ])
    expect(searchSettings(entries, '   ')).toEqual([])
  })

  it('doesn’t repeat a row', () => {
    expect(searchSettings([...entries, entries[0]], 'dim')).toHaveLength(1)
  })
})
