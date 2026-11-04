import { pauseMusicWithGame } from '../musicWithGame'
import { radioPlayer } from './radio'

/** The radio with the game (musicWithGame.ts): paused while the player is away from it, stopped as the truck’s
 * electrics go off. Returns the function that stops it. */
export function pauseRadioWithGame(): () => void {
  return pauseMusicWithGame(radioPlayer)
}
