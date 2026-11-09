import { activeClock24, activeMeridiem } from './clock'
import { activeUnits } from './units'

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

function minuteOfDay(gameTime: number): number {
  return ((gameTime % 1440) + 1440) % 1440
}

function two(value: number): string {
  return String(value).padStart(2, '0')
}

/**
 * A time of day as the page's clock says it (shared/clock.ts): "14:22", or "2:22 PM" in 12 hours — the leading zero
 * dropped, as the game and Apple's own clocks drop it, and the language's own AM and PM ("ÖS", "p. m."). Without
 * `meridiem` it is the status bar's clock, hours and minutes only: CarPlay has no room for more beside the sidebar.
 */
function formatClock(hours: number, minutes: number, meridiem = true): string {
  if (activeClock24()) return `${two(hours)}:${two(minutes)}`
  const twelve = hours % 12 === 0 ? 12 : hours % 12
  if (!meridiem) return `${twelve}:${two(minutes)}`
  const { am, pm } = activeMeridiem()
  return `${twelve}:${two(minutes)} ${hours < 12 ? am : pm}`
}

/** "14:22" — the clock as shown in the sidebar, and in the dash, the trip's arrival and the map's stops. */
export function formatGameTime(gameTime: number): string {
  const minutes = minuteOfDay(gameTime)
  return formatClock(Math.floor(minutes / 60), minutes % 60)
}

/** The player's own time at `at` (ms since the epoch): "14:22", or "2:22 PM". */
export function formatRealTime(at: number): string {
  const date = new Date(at)
  return formatClock(date.getHours(), date.getMinutes())
}

/** The sidebar's clock: hours and minutes, as CarPlay's status bar shows them ("14:22", or "2:22" in 12 hours).
 * The pill is drawn for the five characters 24 hours take, so the meridiem is left to the clocks with room for it. */
export function formatGameTimeShort(gameTime: number): string {
  const minutes = minuteOfDay(gameTime)
  return formatClock(Math.floor(minutes / 60), minutes % 60, false)
}

/** The sidebar's own time, in the same five characters: "14:22", or "2:22". */
export function formatRealTimeShort(at: number): string {
  const date = new Date(at)
  return formatClock(date.getHours(), date.getMinutes(), false)
}

/** "Thu 14:22" */
export function formatGameClock(gameTime: number): string {
  return `${DAYS[Math.floor(gameTime / 1440) % 7]} ${formatGameTime(gameTime)}`
}

/** "3", "N", "R1" */
export function formatGear(displayedGear: number): string {
  if (displayedGear > 0) return String(displayedGear)
  if (displayedGear < 0) return `R${-displayedGear}`
  return 'N'
}

/** Truck speed (m/s, negative when reversing) as whole km/h. */
export function speedKmh(speed: number): number {
  return Math.round(Math.abs(speed) * 3.6)
}

/** How a trip's time is said: in minutes, or hours and minutes ("12 min", "1:05 hrs"). */
export interface TimeWords {
  minutes: (minutes: number) => string
  hours: (hours: number, minutes: string) => string
}

/** A trip's time left (game minutes) as Apple shows it: "12 min", "1:05 hrs". */
export function formatTripTime(minutes: number, words: TimeWords): string {
  const whole = Math.max(0, Math.round(minutes))
  if (whole < 60) return words.minutes(whole)
  return words.hours(Math.floor(whole / 60), String(whole % 60).padStart(2, '0'))
}

/** A distance (metres, as the game counts them) as the driver's units say it: "850 m", "9.4 km", "0.6 mi",
 * "214 mi" (with the language's decimal separator). The units are the page's (shared/units.ts), so every label
 * follows the same choice without being told it. */
export function formatTripDistance(metres: number, decimal = '.'): string {
  return activeUnits().distance(metres, decimal)
}
