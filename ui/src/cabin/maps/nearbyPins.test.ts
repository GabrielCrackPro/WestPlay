import { describe, expect, it } from 'vitest'
import { pinFeatures } from './nearbyPins'

describe('the pins of a list of places', () => {
  it('draws each place at its own spot, in the list’s order', () => {
    const pins = pinFeatures([
      { at: [12.5, 41.9], kind: 'fuel' },
      { at: [13.1, 42.2], kind: 'service' },
    ])
    expect(pins.features).toEqual([
      {
        type: 'Feature',
        properties: { kind: 'fuel', rank: 0 },
        geometry: { type: 'Point', coordinates: [12.5, 41.9] },
      },
      {
        type: 'Feature',
        properties: { kind: 'service', rank: 1 },
        geometry: { type: 'Point', coordinates: [13.1, 42.2] },
      },
    ])
  })

  it('leaves cities out: they’re areas, not points, and have no badge of their own', () => {
    const pins = pinFeatures([
      { at: [12.5, 41.9], kind: 'city' },
      { at: [13.1, 42.2], kind: 'parking' },
    ])
    expect(pins.features.map((pin) => pin.properties.kind)).toEqual(['parking'])
  })

  it('has nothing for an empty list', () => {
    expect(pinFeatures([]).features).toEqual([])
  })
})
