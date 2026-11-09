import type { Appearance } from '../state/appearance'

/**
 * How the route is drawn (Settings › Maps): its colour and its weight. Kept here, apart from the style, so the
 * settings and the store can name them without pulling the map's style in.
 */
export type MapRouteColour = 'blue' | 'teal' | 'purple' | 'amber'
export const MAP_ROUTE_COLOURS: readonly MapRouteColour[] = ['blue', 'teal', 'purple', 'amber']

export type MapRouteWeight = 'thin' | 'standard' | 'bold'
export const MAP_ROUTE_WEIGHTS: readonly MapRouteWeight[] = ['thin', 'standard', 'bold']

/** Each colour's line and edge, on either appearance: the dark map's are a step lighter, as its roads are. */
export const ROUTE_COLOURS: Record<Appearance, Record<MapRouteColour, { fill: string; casing: string }>> = {
  light: {
    // Apple's blue, as the map has always drawn it.
    blue: { fill: '#2f7cf6', casing: '#1559c9' },
    teal: { fill: '#0f9fa8', casing: '#08646a' },
    purple: { fill: '#7a5cf0', casing: '#4b32ad' },
    amber: { fill: '#f0961a', casing: '#a86408' },
  },
  dark: {
    blue: { fill: '#3d8bff', casing: '#1b4a96' },
    teal: { fill: '#2ac3c3', casing: '#0e6d70' },
    purple: { fill: '#a98bff', casing: '#54379f' },
    amber: { fill: '#ffb340', casing: '#9c6610' },
  },
}

/**
 * The route's colour used away from the map (the cluster's accent): the line's own fill on a dark panel, its darker
 * casing where the panel is light, so a needle or a live mark in that colour stays legible on the glass it is drawn
 * on and not only against the map's ground.
 */
export function routeAccent(appearance: Appearance, colour: MapRouteColour): string {
  const route = ROUTE_COLOURS[appearance][colour]
  return appearance === 'dark' ? route.fill : route.casing
}

/** The truck's marker on the live map (Settings › Maps), and its size. */
export type MapMarker = 'arrow' | 'dot' | 'truck'
export const MAP_MARKERS: readonly MapMarker[] = ['arrow', 'dot', 'truck']

export type MapMarkerSize = 'small' | 'medium' | 'large'
export const MAP_MARKER_SIZES: readonly MapMarkerSize[] = ['small', 'medium', 'large']

/** How the map's pins are drawn (Settings › Maps): filled badges, or an outline in the place's own colour. */
export type MapPinStyle = 'filled' | 'outlined'
export const MAP_PIN_STYLES: readonly MapPinStyle[] = ['filled', 'outlined']

/** The hours the map may dim from (Settings › Maps): dark by eight in the evening unless the player says
 * otherwise. */
export const MAP_NIGHT_STARTS: readonly number[] = [18, 19, 20, 21, 22]

/** How far around the truck the map's traffic is drawn when no route is driven, metres (`0`: only on a route).
 * In single player that traffic is estimated (maps/estimatedTraffic.ts): the game tells nothing of its AI
 * traffic. */
export const MAP_TRAFFIC_AROUND: readonly number[] = [0, 1000, 3000, 5000, 10000]

/** How much wider or narrower the line is than standard. */
export const ROUTE_WEIGHT_SCALE: Record<MapRouteWeight, number> = { thin: 0.68, standard: 1, bold: 1.45 }
