/**
 * Route calculation cache: stores recent route plans so repeated queries for the same destination return
 * instantly instead of asking the host again. Entries expire after CACHE_TTL_MS to avoid stale routes.
 */

import type { PlannedRoute } from '../../shared/host'

interface CacheEntry {
  id: number
  routes: PlannedRoute[]
  at: number
}

/** How long a cached route stays valid, ms (5 minutes: routes don't change that fast). */
const CACHE_TTL_MS = 5 * 60 * 1000

const cache = new Map<string, CacheEntry>()

/**
 * Look up a cached route plan for `destinationNode`. Returns the cached entry if it's still fresh,
 * or `null` if not found or expired.
 */
export function getCachedRoutes(destinationNode: string): CacheEntry | null {
  const key = destinationNode
  const entry = cache.get(key)
  if (!entry) return null
  if (performance.now() - entry.at > CACHE_TTL_MS) {
    cache.delete(key)
    return null
  }
  return entry
}

/** Store a route plan in the cache. */
export function putCachedRoutes(destinationNode: string, id: number, routes: PlannedRoute[]) {
  const key = destinationNode
  cache.set(key, { id, routes, at: performance.now() })
  // Keep the cache bounded: remove oldest entries if it grows too large.
  if (cache.size > 50) {
    const oldest = cache.keys().next().value
    if (oldest) cache.delete(oldest)
  }
}

/** Clear the entire cache (e.g., when the map reloads). */
export function clearRouteCache() {
  cache.clear()
}
