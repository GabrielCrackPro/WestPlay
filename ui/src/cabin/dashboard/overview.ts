/** The Dashboard's Overview page: the few numbers that are laid out differently from the widgets, kept here so
 * they can be read without a browser. */

/** The gear as the truck's dash shows it: `R` in reverse, `N` out of gear, else the gear's number. */
export function gearLabel(gear: number): string {
  if (gear < 0) return 'R'
  if (gear === 0) return 'N'
  return String(gear)
}

/** How much of the tank is left, 0 to 1 (`null` when the game hasn't said how big it is). */
export function fuelShare(fuel: number, capacity: number): number | null {
  if (!(capacity > 0) || !Number.isFinite(fuel)) return null
  return Math.min(1, Math.max(0, fuel / capacity))
}

/** How much of the route is behind the truck, 0 to 1: the route's own length against the distance left
 * (`null` without a route, or one whose length the game hasn't given). */
export function routeShare(left: number, planned: number): number | null {
  if (!(planned > 0) || !Number.isFinite(left)) return null
  return Math.min(1, Math.max(0, 1 - left / planned))
}
