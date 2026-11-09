import { afterEach, describe, expect, it } from 'vitest'
import { setActiveClock } from './clock'
import { formatGameTime, formatGameTimeShort, formatTripDistance, formatTripTime } from './format'

const words = { minutes: (m: number) => `${m} min`, hours: (h: number, m: string) => `${h}:${m} hrs` }

describe('the clock', () => {
  // Every test leaves the page's clock as it found it: 24 hours, in English.
  afterEach(() => setActiveClock(true, { am: 'AM', pm: 'PM' }))

  it('reads 24 hours as the game draws them by default, and 12 with AM and PM when it does not', () => {
    expect(formatGameTime(14 * 60 + 22)).toBe('14:22')
    expect(formatGameTime(9 * 60 + 5)).toBe('09:05')
    setActiveClock(false)
    expect(formatGameTime(14 * 60 + 22)).toBe('2:22 PM')
    expect(formatGameTime(9 * 60 + 5)).toBe('9:05 AM')
    // Midnight and noon are the two the arithmetic gets wrong if it isn't thought about: 12, not 0.
    expect(formatGameTime(0)).toBe('12:00 AM')
    expect(formatGameTime(12 * 60)).toBe('12:00 PM')
    // The language's own halves of the day.
    setActiveClock(false, { am: 'ÖÖ', pm: 'ÖS' })
    expect(formatGameTime(14 * 60 + 22)).toBe('2:22 ÖS')
  })

  it('gives the sidebar the status bar’s five characters, the meridiem left out', () => {
    expect(formatGameTimeShort(14 * 60 + 22)).toBe('14:22')
    setActiveClock(false)
    expect(formatGameTimeShort(14 * 60 + 22)).toBe('2:22')
    expect(formatGameTimeShort(0)).toBe('12:00')
  })
})

describe('trip', () => {
  it('shows the time left in minutes, then hours and minutes', () => {
    expect(formatTripTime(0.4, words)).toBe('0 min')
    expect(formatTripTime(12.2, words)).toBe('12 min')
    expect(formatTripTime(59.4, words)).toBe('59 min')
    expect(formatTripTime(65, words)).toBe('1:05 hrs')
    expect(formatTripTime(754, words)).toBe('12:34 hrs')
  })

  it('shows a distance in metres close by, then kilometres, in the language’s decimals', () => {
    expect(formatTripDistance(42)).toBe('40 m')
    expect(formatTripDistance(830)).toBe('850 m')
    expect(formatTripDistance(990)).toBe('1.0 km')
    expect(formatTripDistance(9420)).toBe('9.4 km')
    expect(formatTripDistance(9420, ',')).toBe('9,4 km')
    expect(formatTripDistance(67_703)).toBe('68 km')
  })
})
