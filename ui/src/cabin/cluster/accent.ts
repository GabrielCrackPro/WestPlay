import type { Appearance } from '../state/appearance'
import { type MapRouteColour, routeAccent } from '../maps/routeLook'

/**
 * The cluster's accent (Settings › Instrument Cluster): the colour of the lit arc, the needle's marks and the live
 * readings. Following the route keeps the colour the driver chose for its line in Maps, so the dash and the map speak
 * of the way in one colour; the fixed choices let a dash be its own thing, the way a truck's instrument lighting is.
 */
export type ClusterAccent = 'route' | 'play' | 'neutral'

export const CLUSTER_ACCENTS: readonly ClusterAccent[] = ['route', 'play', 'neutral']

/** Each fixed accent on either look: the teal Cabin Play draws itself in, and a neutral that is ink on the light
 * panel and near-white on the dark one — the panel's own type colour, for a dash with no colour on it at all. */
const FIXED: Record<Exclude<ClusterAccent, 'route'>, Record<Appearance, string>> = {
  play: { dark: '#5ad7c6', light: '#067a6e' },
  neutral: { dark: '#e6ebee', light: '#26313a' },
}

/** The accent the panel draws in now. `route` is resolved through the map's own accent, which darkens the route's
 * colour for a light panel so a needle in it stays legible on the glass. */
export function clusterAccent(choice: ClusterAccent, appearance: Appearance, route: MapRouteColour): string {
  return choice === 'route' ? routeAccent(appearance, route) : FIXED[choice][appearance]
}
