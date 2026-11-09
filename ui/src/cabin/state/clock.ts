import { resolveClock24, useCabin, useLive } from './store'

/**
 * Whether the clocks read 24 hours, as the components ask for it: the game's own switch where the player hasn't
 * chosen (Settings › Appearance › Clock), and the player's choice otherwise. Subscribes to both, so everything
 * drawn from it — a clock, an arrival, a stop's time — redraws when either the choice or the game's setting
 * changes. The formatters themselves read the mirror (shared/clock.ts); this is what makes a component notice.
 */
export function useClock(): boolean {
  const choice = useCabin((state) => state.clockFormat)
  const game = useLive((state) => state.gameClock24)
  return resolveClock24(choice, game)
}
