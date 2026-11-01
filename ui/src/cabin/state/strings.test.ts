import { describe, expect, it } from 'vitest'
import { languageOf, STRINGS } from './strings'

describe("the cabin's language", () => {
  it('speaks Spanish when the game does, on either side of the Atlantic', () => {
    expect(languageOf('es_es')).toBe('es')
    expect(languageOf('es_la')).toBe('es')
    expect(languageOf('ES-ES')).toBe('es')
  })

  it('keeps Turkish for the game’s, and English for a language it has no words for', () => {
    expect(languageOf('tr_tr')).toBe('tr')
    expect(languageOf('de_de')).toBe('en')
    expect(languageOf(null)).toBe('en')
  })

  it('writes Spanish with its own numbers, days and words', () => {
    expect(STRINGS.es.decimal).toBe(',')
    expect(STRINGS.es.days[2]).toBe('mié')
    expect(STRINGS.es.delivery).toBe('Entrega')
    expect(STRINGS.es.arriveBy('18:40')).toBe('Llega antes de 18:40')
    expect(STRINGS.es.roundabout(2)).toBe('En la rotonda, toma la 2.ª salida')
  })
})
