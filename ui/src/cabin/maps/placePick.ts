import { create } from 'zustand'
import type { Destination } from './places'

/**
 * A place tapped on the map (a pin, or one of the map's own place icons), waiting for Destinations to open its
 * card: the map says which (liveMap's `setPlaceTap`), the search panel opens for it (MapSearch), and its card is
 * shown (Destinations). Cleared once shown, so the same tap isn't opened twice.
 */
export const usePlacePick = create<{
  picked: { place: Destination; at: number } | null
  pick(place: Destination): void
  clear(): void
}>()((set) => ({
  picked: null,
  pick: (place) => set({ picked: { place, at: Date.now() } }),
  clear: () => set({ picked: null }),
}))
