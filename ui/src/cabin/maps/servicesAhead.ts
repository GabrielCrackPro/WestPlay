import type { Ahead } from './alongRoute'
import type { DestinationKind } from './places'

/**
 * The services a driver plans around, in the order the Dashboard offers them: fuel, a rest area, a service
 * area or hotel, a weigh station, and a ferry or train terminal.
 */
export const SERVICE_KINDS: readonly DestinationKind[] = [
  'fuel',
  'parking',
  'service',
  'hotel',
  'weigh',
  'ferry',
  'train',
]

/** The next services along the route ahead, nearest first; `most` of them at the most. */
export function servicesAhead(ahead: readonly Ahead[], most = 2): Ahead[] {
  return ahead.filter(({ place }) => SERVICE_KINDS.includes(place.kind)).slice(0, most)
}
