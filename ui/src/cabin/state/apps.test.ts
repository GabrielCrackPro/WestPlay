import { describe, expect, it } from 'vitest'
import { isReleasedApp, RELEASED_APP_IDS } from './apps'

describe('the apps this release has', () => {
  it('leaves Podcasts and Messages for a later release, keeping Home’s order', () => {
    expect(RELEASED_APP_IDS).toEqual([
      'maps',
      'music',
      'radio',
      'spotify',
      'youtube',
      'youtubeMusic',
      'phone',
      'weather',
      'settings',
      'diagnostics',
      'driver',
      'notifications',
    ])
  })

  it('opens none of them from a saved screen or recent', () => {
    expect(isReleasedApp('podcasts')).toBe(false)
    expect(isReleasedApp('phone')).toBe(true)
    expect(isReleasedApp('messages')).toBe(false)
    expect(isReleasedApp('youtubeMusic')).toBe(true)
    expect(isReleasedApp('nonsense')).toBe(false)
  })
})
