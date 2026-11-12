import { describe, expect, it } from 'vitest'
import { STRINGS } from '../state/strings'
import { clockText, driveTime, meterZone } from './clusterCardViews'

const words = STRINGS.en.diagnostics

describe('clockText', () => {
  it('reads a clock in minutes under the hour, and hours and minutes past it', () => {
    expect(clockText(58, words)).toBe(`58 ${words.minutes}`)
    expect(clockText(245, words)).toBe(`4:05 ${words.hours}`)
  })

  it('rounds to the nearest minute, and holds at zero', () => {
    expect(clockText(-30, words)).toBe(`0 ${words.minutes}`)
    expect(clockText(59.4, words)).toBe(`59 ${words.minutes}`)
    // A figure that rounds up to the hour is the hour, not "60 min".
    expect(clockText(59.6, words)).toBe(`1:00 ${words.hours}`)
  })
})

describe('driveTime', () => {
  it('gives the trip’s time in minutes under the hour, and hours and minutes past it', () => {
    expect(driveTime(45 * 60, words)).toEqual({ value: '45', unit: words.minutes })
    expect(driveTime(204 * 60, words)).toEqual({ value: '3:24', unit: words.hours })
  })

  it('holds at zero for a drive that has not started', () => {
    expect(driveTime(-5, words)).toEqual({ value: '0', unit: words.minutes })
  })
})

describe('meterZone', () => {
  it('prints the reading’s warning line on the bar, at the end the trouble is', () => {
    expect(meterZone({ warnPercent: 0.85 }, 'low')).toEqual({ 'data-zone': 'low', style: { '--zone': '85%' } })
    expect(meterZone({ warnPercent: 0.3 }, 'high')).toMatchObject({ 'data-zone': 'high', style: { '--zone': '30%' } })
  })

  it('draws no zone for a reading the panel has no data behind', () => {
    expect(meterZone(null, 'high')).toEqual({})
  })
})
