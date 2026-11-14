import { cabClock } from '../../../shared/host'
import { type Appearance, resolveAppearance } from '../../state/appearance'
import { useCabin, useLive } from '../../state/store'

/** The appearance the mode asks for now (before a wallpaper with one variant only overrules it). */
export function useWantedAppearance(): Appearance {
  const mode = useCabin((state) => state.appearanceMode)
  const gameTime = useLive((state) => (state.telemetry ? cabClock(state.telemetry, state.clockShift) : null))
  const lowBeam = useLive((state) => state.telemetry?.lowBeam ?? false)
  return resolveAppearance(mode, { gameTime, lowBeam })
}
