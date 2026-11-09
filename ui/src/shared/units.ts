/**
 * The driver's units. The game's own values are metric (metres a second, metres, litres, degrees Celsius, psi) and
 * every conversion happens here, at the glass: nothing in the telemetry is stored in miles.
 *
 * Three systems, as the regional settings the world actually uses:
 * - metric: km/h, km, litres, l/100 km, °C, bar (what ETS2 shows by default);
 * - UK: mph, miles, litres, mpg (the imperial gallon), °C, bar (Britain buys fuel by the litre and measures
 *   temperature in Celsius, but drives in miles);
 * - US: mph, miles, US gallons, mpg (the US gallon), °F, psi.
 *
 * The game has one switch for it — Options › Interface › Regional Settings › "Use miles" — which the host reads
 * from the player's profile; the game a profile belongs to decides whether those miles are the US's or the UK's.
 * Cabin Play lets the driver override it (Settings › Appearance › Units), which is why the system is a choice and
 * not a boolean.
 */
export type UnitSystem = 'metric' | 'uk' | 'us'

export const UNIT_SYSTEMS: readonly UnitSystem[] = ['metric', 'uk', 'us']

/** What the driver chose: one of the systems, or the game's own setting. */
export type UnitsChoice = 'game' | UnitSystem

const KM_PER_MILE = 1.609344
const LITRES_PER_US_GALLON = 3.785411784
const LITRES_PER_UK_GALLON = 4.54609
const PSI_PER_BAR = 14.503773773
const FEET_PER_METRE = 3.280839895

/** The dial's face: its top speed, the step between its numbers, and between its ticks. */
export interface SpeedFace {
  max: number
  step: number
  minor: number
}

/** A figure and its unit apart, for a dash that sets them at different sizes (the number large, "km" small). */
export interface Figure {
  value: string
  unit: string
}

/** A system's units and the conversions into them. Every formatter takes the language's decimal separator. */
export interface Units {
  system: UnitSystem
  /** The dial's face. */
  face: SpeedFace
  /** Unit symbols, for the labels beside a figure (not translated: a unit is written the same in every cab). */
  labels: {
    speed: string
    /** Kilometres or miles, for a long distance. */
    distance: string
    volume: string
    consumption: string
    temperature: string
    pressure: string
  }
  /** Truck speed (m/s, negative when reversing) as the driver's whole units. */
  speed(mps: number): number
  /** A speed limit as its sign posts it: whole units, and in miles to the nearest five (the steps signs use). */
  limit(mps: number): number
  /** A short distance (metres) as a map or a trip says it: "850 m", "9.4 km", "0.6 mi", "1,200 ft". */
  distance(metres: number, decimal?: string): string
  /** A long distance (the game counts these in km: a range, an odometer) with its unit. */
  longDistance(km: number, decimal?: string): string
  /** The trip's distance as a figure and its unit: metres under a kilometre, then km, or miles. */
  distanceFigure(metres: number, decimal?: string): Figure
  /** A range or an odometer as a figure and its unit. */
  longFigure(km: number, decimal?: string): Figure
  /** A tank or a tankful as a figure and its unit. */
  volumeFigure(litres: number, decimal?: string): Figure
  /** Consumption as a figure and its unit. */
  consumptionFigure(per100: number, decimal?: string): Figure
  /** A temperature as a figure and its unit. */
  temperatureFigure(celsius: number, decimal?: string): Figure
  /** A pressure as a figure and its unit. */
  pressureFigure(psi: number, decimal?: string): Figure
  /** Litres as the driver reads a tank. */
  volume(litres: number, decimal?: string): string
  /** Litres per 100 km as the driver reads consumption (mpg where that's the unit). */
  consumption(per100: number, decimal?: string): string
  /** Degrees Celsius as the driver reads a temperature. */
  temperature(celsius: number, decimal?: string): string
  /** The brake air tanks' pressure, which the game reports in psi, as the driver reads it. */
  pressure(psi: number, decimal?: string): string
}

function decimal(value: number, places: number, separator: string): string {
  return value.toFixed(places).replace('.', separator)
}

function unitsFor(system: UnitSystem): Units {
  const metric = system === 'metric'
  const uk = system === 'uk'
  const labels = metric
    ? { speed: 'km/h', distance: 'km', volume: 'l', consumption: 'l/100 km', temperature: '°C', pressure: 'bar' }
    : uk
      ? { speed: 'mph', distance: 'mi', volume: 'l', consumption: 'mpg', temperature: '°C', pressure: 'bar' }
      : { speed: 'mph', distance: 'mi', volume: 'gal', consumption: 'mpg', temperature: '°F', pressure: 'psi' }
  const gallons = uk ? LITRES_PER_UK_GALLON : LITRES_PER_US_GALLON
  // A mile to the gallon from litres per 100 km: 100 km is 62.137 miles and each is `gallons` litres, so the mpg
  // figure is that constant over the litres per 100 km.
  const mpgFactor = (100 / KM_PER_MILE) * gallons
  return {
    system,
    labels,
    face: metric ? { max: 120, step: 20, minor: 10 } : { max: 80, step: 10, minor: 5 },
    speed: (mps) => (metric ? Math.round(Math.abs(mps) * 3.6) : Math.round((Math.abs(mps) * 3.6) / KM_PER_MILE)),
    limit: (mps) => {
      const speed = Math.abs(mps) * 3.6
      if (metric) return Math.round(speed)
      return Math.max(5, Math.round(speed / KM_PER_MILE / 5) * 5)
    },
    distance: (metres, separator = '.') => {
      const value = Math.max(0, metres)
      if (metric) {
        if (value < 100) return `${Math.max(0, Math.round(value / 10) * 10)} m`
        if (value < 975) return `${Math.round(value / 50) * 50} m`
        if (value < 9950) return `${decimal(value / 1000, 1, separator)} km`
        return `${Math.round(value / 1000)} km`
      }
      const feet = value * FEET_PER_METRE
      const miles = value / 1000 / KM_PER_MILE
      // Under a tenth of a mile, feet are what a driver judges a gap in; past that, miles to a tenth.
      if (miles < 0.1) return `${Math.round(feet / 10) * 10} ft`
      if (miles < 9.95) return `${decimal(miles, 1, separator)} mi`
      return `${Math.round(miles)} mi`
    },
    longDistance: (km, separator = '.') => {
      if (metric) return `${Math.round(km)} km`
      const miles = km / KM_PER_MILE
      return miles < 10 ? `${decimal(miles, 1, separator)} mi` : `${Math.round(miles)} mi`
    },
    distanceFigure: (metres, separator = '.') => {
      const value = Math.max(0, metres)
      if (metric) {
        return value < 1000
          ? { value: String(Math.round(value)), unit: 'm' }
          : { value: String(Math.round(value / 1000)), unit: 'km' }
      }
      const miles = value / 1000 / KM_PER_MILE
      return { value: miles < 10 ? decimal(miles, 1, separator) : String(Math.round(miles)), unit: 'mi' }
    },
    longFigure: (km, separator = '.') => {
      if (metric) return { value: String(Math.round(km)), unit: 'km' }
      const miles = km / KM_PER_MILE
      return { value: miles < 10 ? decimal(miles, 1, separator) : String(Math.round(miles)), unit: 'mi' }
    },
    volumeFigure: (litres, separator = '.') =>
      metric || uk
        ? { value: String(Math.round(litres)), unit: 'l' }
        : { value: decimal(litres / LITRES_PER_US_GALLON, 1, separator), unit: 'gal' },
    consumptionFigure: (per100, separator = '.') =>
      metric
        ? { value: decimal(Math.max(0, per100), 1, separator), unit: 'l/100 km' }
        : per100 > 0
          ? { value: decimal(mpgFactor / per100, 1, separator), unit: 'mpg' }
          : { value: '—', unit: '' },
    temperatureFigure: (celsius) =>
      metric || uk
        ? { value: String(Math.round(celsius)), unit: '°C' }
        : { value: String(Math.round((celsius * 9) / 5 + 32)), unit: '°F' },
    pressureFigure: (psi, separator = '.') =>
      metric || uk
        ? { value: decimal(psi / PSI_PER_BAR, 1, separator), unit: 'bar' }
        : { value: String(Math.round(psi)), unit: 'psi' },
    volume: (litres, separator = '.') =>
      metric || uk ? `${Math.round(litres)} l` : `${decimal(litres / LITRES_PER_US_GALLON, 1, separator)} gal`,
    consumption: (per100, separator = '.') =>
      metric
        ? `${decimal(Math.max(0, per100), 1, separator)} l/100 km`
        : per100 > 0
          ? `${decimal(mpgFactor / per100, 1, separator)} mpg`
          : `—`,
    temperature: (celsius) => (metric || uk ? `${Math.round(celsius)} °C` : `${Math.round((celsius * 9) / 5 + 32)} °F`),
    pressure: (psi, separator = '.') =>
      metric || uk ? `${decimal(psi / PSI_PER_BAR, 1, separator)} bar` : `${Math.round(psi)} psi`,
  }
}

/** Each system built once: the formatters are stateless, so they can be shared. */
export const UNITS: Readonly<Record<UnitSystem, Units>> = {
  metric: unitsFor('metric'),
  uk: unitsFor('uk'),
  us: unitsFor('us'),
}

export function unitsForSystem(system: UnitSystem): Units {
  return UNITS[system]
}

/**
 * The system in force for the whole page, for the places that format a figure outside a component (the map's
 * labels are drawn by liveMap.ts, deep under the map's own code). Components read it through `useUnits`, which
 * re-renders them when the choice changes; this is only the answer between those.
 */
let active: UnitSystem = 'metric'

export function setActiveUnits(system: UnitSystem): void {
  active = system
}

export function activeUnits(): Units {
  return UNITS[active]
}
