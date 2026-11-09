/**
 * How Cabin Play's clocks read: in 24 hours, as the game shows them by default, or in 12 with AM and PM. The
 * player chooses in Settings › Appearance › Clock, and `game` follows the game's own switch (Options › Gameplay ›
 * "24-hour clock notation", `uset g_clock_24` in the profile), which the host reads and posts.
 *
 * The choice reaches the formatters the way the driver's units do (shared/units.ts): through a page-wide value the
 * cabin's store keeps in step with the setting, so `formatGameTime` needs no argument at any of its call sites —
 * the sidebar, the dash, the trip's arrival, the map's stops and labels all read the same clock without being told
 * it. Components that have to redraw when it changes subscribe with `useClock` (state/clock.ts).
 */
export type ClockChoice = 'game' | '24' | '12'

/** Every choice, in the order Settings lists them. */
export const CLOCK_CHOICES: readonly ClockChoice[] = ['game', '24', '12']

/** The two halves of the day as the cabin's language writes them: "AM"/"PM", "ÖÖ"/"ÖS", "a. m."/"p. m.". */
export interface Meridiem {
  am: string
  pm: string
}

/** What the page's clocks say until the store has set them: the game's own default, 24 hours, in English. */
let reads24Hours = true
let meridiem: Meridiem = { am: 'AM', pm: 'PM' }

/** Sets the clock the page draws: whether it reads 24 hours, and the language's AM and PM. */
export function setActiveClock(reads24: boolean, words: Meridiem = meridiem): void {
  reads24Hours = reads24
  meridiem = words
}

/** Whether the page draws its clocks in 24 hours. */
export function activeClock24(): boolean {
  return reads24Hours
}

/** The page's AM and PM. */
export function activeMeridiem(): Meridiem {
  return meridiem
}
