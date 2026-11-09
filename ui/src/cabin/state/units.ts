import type { Units } from '../../shared/units'
import { unitsForSystem } from '../../shared/units'
import { resolveUnits, useCabin, useLive } from './store'

/**
 * The driver's units, as the components read them: the game's own regional setting where the driver hasn't
 * chosen one (Settings › Appearance › Units), and the driver's choice otherwise. Subscribes to both, so every
 * figure drawn from it re-renders when either the choice or the game's setting changes.
 */
export function useUnits(): Units {
  const choice = useCabin((state) => state.units)
  const game = useLive((state) => state.gameUnits)
  return unitsForSystem(resolveUnits(choice, game))
}
