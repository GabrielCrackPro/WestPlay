/** How serious a reading is: fine, worth watching, or a problem. */
export type State = 'ok' | 'warn' | 'alarm'

/** A reading on its gauge: the value, how far along its range it stands (0 to 1) and how serious it is. */
export interface Reading {
  value: number
  percent: number
  state: State
}

/** A gauge's range and where it turns serious; `low` for the readings where too little is the problem. */
interface Scale {
  min: number
  max: number
  warn: number
  alarm: number
  low?: boolean
}

function scale({ min, max, warn, alarm, low = false }: Scale, value: number): Reading {
  const percent = Math.min(1, Math.max(0, (value - min) / (max - min)))
  if (low) {
    if (value <= alarm) return { value, percent, state: 'alarm' }
    return { value, percent, state: value <= warn ? 'warn' : 'ok' }
  }
  if (value >= alarm) return { value, percent, state: 'alarm' }
  return { value, percent, state: value >= warn ? 'warn' : 'ok' }
}

/** The coolant: 40 °C cold, 120 °C far too hot, a working diesel in between at 80 to 95. */
export const coolant = (celsius: number) => scale({ min: 40, max: 120, warn: 100, alarm: 110 }, celsius)

/** The oil, which runs warmer than the water: 40 °C to 140 °C. */
export const oil = (celsius: number) => scale({ min: 40, max: 140, warn: 120, alarm: 132 }, celsius)

/** The brake air tank, psi: 150 is full; below 85 the brakes get sluggish, below 60 they drag themselves. */
export const brakeAir = (psi: number) => scale({ min: 0, max: 150, warn: 85, alarm: 60, low: true }, psi)

/** The brakes themselves: cool in normal driving; 300 °C is a long descent, 450 °C is trouble. */
export const brakeTemperature = (celsius: number) => scale({ min: 0, max: 600, warn: 300, alarm: 450 }, celsius)

/** Wear, 0 (new) to 1 (worn out): half worn is worth watching, four fifths worn wants a garage. */
export const wear = (fraction: number) => scale({ min: 0, max: 1, warn: 0.5, alarm: 0.8 }, fraction)

/** The more serious of two states, for a card that shows more than one reading. */
export function worst(first: State, second: State): State {
  const rank: Record<State, number> = { ok: 0, warn: 1, alarm: 2 }
  return rank[first] >= rank[second] ? first : second
}
