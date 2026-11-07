import { describe, expect, it } from 'vitest'
import type { Ahead } from './alongRoute'
import type { Destination, DestinationKind } from './places'
import { SERVICE_KINDS, servicesAhead } from './servicesAhead'

function ahead(kind: DestinationKind, along: number): Ahead {
  const place: Destination = { kind, node: `${kind}-${along}`, at: [0, 0] }
  return { place, along, off: 10 }
}

describe('services along the route ahead', () => {
  it('keeps services in the order they come, dropping the rest', () => {
    const found = servicesAhead(
      [ahead('city', 100), ahead('fuel', 500), ahead('company', 900), ahead('parking', 1200)],
      4,
    )
    expect(found.map(({ place }) => place.kind)).toEqual(['fuel', 'parking'])
    expect(found.map(({ along }) => along)).toEqual([500, 1200])
  })

  it('shows the next two by default', () => {
    const found = servicesAhead([ahead('fuel', 100), ahead('service', 400), ahead('weigh', 900)])
    expect(found.map(({ along }) => along)).toEqual([100, 400])
  })

  it('counts a ferry and a train terminal as services', () => {
    expect(SERVICE_KINDS).toContain('ferry')
    expect(SERVICE_KINDS).toContain('train')
  })
})
