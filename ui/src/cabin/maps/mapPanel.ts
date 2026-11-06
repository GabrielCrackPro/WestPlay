import { create } from 'zustand'

/**
 * The panel standing over the Maps map: its search (MapSearch.tsx) or its Stops page (StopsPage.tsx), or none. Both
 * open at the map's top, where the other's button is, so only one is open at a time: whichever opens last has the
 * map, and the other gives way.
 */
export const useMapPanel = create<{
  open: 'search' | 'stops' | null
  show(open: 'search' | 'stops' | null): void
}>()((set) => ({
  open: null,
  show: (open) => set({ open }),
}))
