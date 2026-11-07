import { describe, expect, it } from 'vitest'
import { wakePhrase } from './wake'

describe('wakePhrase', () => {
  it('uses the truck brand in the cabin language', () => {
    expect(wakePhrase('Scania', 'en')).toBe('Hey Scania')
    expect(wakePhrase('Scania', 'es')).toBe('Hola Scania')
    expect(wakePhrase('Scania', 'tr')).toBe('Selam Scania')
  })

  it('keeps the phrase speakable when a brand has punctuation', () => {
    expect(wakePhrase('Mercedes-Benz', 'en')).toBe('Hey Mercedes Benz')
  })

  it('falls back to the assistant name without a truck', () => {
    expect(wakePhrase(null, 'en')).toBe('Hey Cabin')
    expect(wakePhrase('   ', 'es')).toBe('Hola Cabin')
  })
})
