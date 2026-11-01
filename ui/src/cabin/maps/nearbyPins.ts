import type { DestinationKind } from './places'

/**
 * The places a list offers (Destinations' Find nearby and its search), as pins over the map: the same badge the
 * map draws for that kind of place (placeIcons.ts), at the place itself, so a list is seen in place before one
 * is chosen. A city is a whole area rather than a point, so a list of cities brings no pins.
 */
const PINNED: readonly DestinationKind[] = [
  'fuel',
  'service',
  'garage',
  'dealer',
  'company',
  'parking',
  'hotel',
  'recruitment',
  'weigh',
  'ferry',
  'train',
]

export interface PinPlace {
  /** lng, lat (places.ts). */
  at: [number, number]
  kind: DestinationKind
}

/** The pins' GeoJSON: each place a point, with its kind's badge and its place in the list (the first on top). */
export function pinFeatures(places: readonly PinPlace[]) {
  return {
    type: 'FeatureCollection' as const,
    features: places
      .filter((place) => PINNED.includes(place.kind))
      .map((place, rank) => ({
        type: 'Feature' as const,
        properties: { kind: place.kind, rank },
        geometry: { type: 'Point' as const, coordinates: place.at },
      })),
  }
}
