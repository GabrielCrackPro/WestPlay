import { type CSSProperties, type ReactElement } from 'react'
import type { Figure } from '../../shared/units'
import type { Strings } from '../state/strings'
import type { ClusterReading } from '../state/store'
import { useCabin, useLive } from '../state/store'
import { useText } from '../state/text'
import { useUnits } from '../state/units'
import {
  adblue as adblueReading,
  battery as batteryReading,
  brakeAir as brakeAirReading,
  brakeTemperature as brakeTemperatureReading,
  consumption as consumptionReading,
  coolant as coolantReading,
  fuelLevel,
  oil as oilReading,
  warned,
  type Reading,
} from '../apps/diagnostics/readings'
import { tripAverage } from '../apps/diagnostics/trip'
import { useTrends } from '../apps/diagnostics/useTrends'
import {
  AdblueIcon,
  BatteryIcon,
  BrakeAirIcon,
  BrakeTemperatureIcon,
  CoolantIcon,
  GaugeIcon,
  OilTemperatureIcon,
} from './ClusterIcons'
import { useInstantConsumption } from './useInstant'

export interface ClusterReadingView {
  /** The dash's own name for the reading (short: it stands under a figure). */
  label: string
  /** The picker's name, where there is room for the whole of it ("Instant consumption"). */
  pickerLabel: string
  icon: ReactElement
  figure: Figure
  warn: boolean
  /** Read blue while the engine is cold (the two temperatures). */
  cold?: boolean
}

/** The four cards' figures, as the dash draws them now. */
export interface ClusterCardViews {
  /** The game is sending a truck: without one, every figure reads as a dash. */
  live: boolean
  /** Fuel consumption this moment, litres per 100 km (`null`: none to read). */
  instant: number | null
  trip: {
    distance: Figure
    average: Figure
    /** The time on the move. */
    driving: Figure
    odometer: Figure
  }
  fuel: {
    /** How full the tank is, 0 to 1, or `null` when the game doesn't report its capacity. */
    share: number | null
    /** The gauge's reading, for its bar and its warning line. */
    reading: Reading | null
    /** The figure the panel prints: the share, or the litres. */
    figure: Figure
    range: Figure
    used: Figure
  }
  hours: {
    /** The next rest stop, as the dash words it (`null`: the profile has none). */
    rest: string | null
    restDue: boolean
    /** The time left on the job's delivery window (`null`: no job). */
    job: string | null
    jobDue: boolean
  }
  readings: Record<ClusterReading, ClusterReadingView>
}

/** A driver-hours clock as the cards say it: "4:05 h" past the hour, or "58 min" under it. */
export function clockText(value: number, words: Strings['diagnostics']): string {
  const whole = Math.max(0, Math.round(value))
  if (whole < 60) return `${whole} ${words.minutes}`
  return `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, '0')} ${words.hours}`
}

/** The trip's time on the move, split for the dash's two sizes: "45" and "min" for the first hour, "3:24" and "h"
 *  past it — the same two readings the driver-hours rows give, in the trip panel's own layout. */
export function driveTime(seconds: number, words: Strings['diagnostics']): Figure {
  const whole = Math.max(0, Math.round(seconds / 60))
  if (whole < 60) return { value: String(whole), unit: words.minutes }
  return { value: `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, '0')}`, unit: words.hours }
}

/**
 * Where a bar prints its gauge's warning line, and which end of the bar the trouble is at (cluster.css,
 * `.cluster-meter[data-zone]`): the reading's own threshold, so the zone a bar draws is the same one the Diagnostics
 * app turns amber at. A reading the panel has no data behind draws no zone, rather than painting the whole bar with one.
 */
export function meterZone(read: { warnPercent: number } | null, side: 'low' | 'high') {
  if (!read) return {}
  return {
    'data-zone': side,
    style: { '--zone': `${Math.round(read.warnPercent * 100)}%` } as CSSProperties,
  }
}

/**
 * Below this the engine is still warming up: the dash reads its coolant and oil blue, not just red when hot. It is one
 * reading for the whole panel — the cards' cold flags here, and the coolant's own glyph on the dash (ClusterScreen) —
 * so the two can't draw the engine at two different temperatures.
 */
export const COLD_C = 60

/**
 * The four cards' readings, from the same live state the dash reads: the drive since the engine came on, the tank,
 * the game's own clocks and the engine card's chosen gauges. It is one hook rather than four so the trip and the
 * instant consumption are worked out once, and so the Settings preview shows the figures the driver would see on the
 * road rather than a separate sketch of them.
 */
export function useClusterCardViews(): ClusterCardViews {
  const text = useText()
  const words = text.diagnostics
  const units = useUnits()
  const t = useLive((state) => state.telemetry)
  const truck = useLive((state) => state.truck)
  const job = useLive((state) => state.job)
  const gaugePercent = useCabin((state) => state.clusterGaugePercent)
  const { trip } = useTrends()
  const instant = useInstantConsumption()

  const capacity = truck?.fuelCapacity ?? 0
  const share = capacity > 0 && t ? Math.max(0, Math.min(1, t.fuel / capacity)) : null
  const fuel = share === null ? null : warned(fuelLevel(share, truck?.fuelWarningFactor), t?.fuelWarning ?? false)
  const average = trip.distance > 0.05 ? tripAverage(trip) : (t?.fuelAverage ?? 0)
  const rest = t?.restStop ?? -1
  // The job's deadline is the player's own game time (a Convoy session's offset isn't the job's).
  const jobLeft = job && t && job.deliveryTime > 0 ? job.deliveryTime - t.gameTime : null

  const adblue = t ? adblueReading(t.adblue) : null
  const coolant = t ? coolantReading(t.coolantTemperature) : null
  const oil = t ? oilReading(t.oilTemperature) : null
  const air = t ? warned(brakeAirReading(t.brakeAirPressure), t.brakeAirWarning) : null
  const volts = t ? warned(batteryReading(t.batteryVoltage), t.batteryWarning) : null
  const brakeHeat = t ? brakeTemperatureReading(t.brakeTemperature) : null
  const burning = instant === null ? null : consumptionReading(instant)
  const coldCoolant = (t?.coolantTemperature ?? 0) > 0 && (t?.coolantTemperature ?? 0) < COLD_C
  const coldOil = (t?.oilTemperature ?? 0) > 0 && (t?.oilTemperature ?? 0) < COLD_C
  const adblueFigure: Figure =
    gaugePercent && adblue !== null
      ? { value: String(Math.round(adblue.percent * 100)), unit: '%' }
      : units.volumeFigure(t?.adblue ?? 0, text.decimal)

  const reading = (
    label: string,
    icon: ReactElement,
    figure: Figure,
    state: Reading | null,
    cold = false,
    pickerLabel = label,
  ): ClusterReadingView => ({
    label,
    pickerLabel,
    icon,
    figure,
    warn: (state?.state ?? 'ok') !== 'ok',
    cold,
  })

  return {
    live: t !== null,
    instant,
    trip: {
      distance: units.distanceFigure(trip.distance, text.decimal),
      average: units.consumptionFigure(average, text.decimal),
      driving: driveTime(trip.moving, words),
      odometer: units.longFigure(t?.odometer ?? 0, text.decimal),
    },
    fuel: {
      share,
      reading: fuel,
      figure:
        gaugePercent && share !== null
          ? { value: String(Math.round(share * 100)), unit: '%' }
          : units.volumeFigure(t?.fuel ?? 0, text.decimal),
      range: units.longFigure(t?.fuelRange ?? 0, text.decimal),
      used: units.volumeFigure(trip.fuel, text.decimal),
    },
    hours: {
      rest: rest >= 0 ? clockText(rest, words) : null,
      restDue: rest >= 0 && rest <= 60,
      job: jobLeft !== null ? clockText(jobLeft, words) : null,
      jobDue: jobLeft !== null && jobLeft <= 60,
    },
    readings: {
      oilTemperature: reading(
        words.oilTemperature,
        <OilTemperatureIcon />,
        units.temperatureFigure(t?.oilTemperature ?? 0, text.decimal),
        oil,
        coldOil,
      ),
      coolant: reading(
        words.coolant,
        <CoolantIcon />,
        units.temperatureFigure(t?.coolantTemperature ?? 0, text.decimal),
        coolant,
        coldCoolant,
      ),
      brakeAir: reading(
        words.brakeAir,
        <BrakeAirIcon />,
        units.pressureFigure(t?.brakeAirPressure ?? 0, text.decimal),
        air,
      ),
      battery: reading(
        words.battery,
        <BatteryIcon />,
        { value: (t?.batteryVoltage ?? 0).toFixed(1).replace('.', text.decimal), unit: words.volts },
        volts,
      ),
      adblue: reading(words.adblue, <AdblueIcon />, adblueFigure, adblue),
      brakeTemperature: reading(
        words.brakeTemperature,
        <BrakeTemperatureIcon />,
        units.temperatureFigure(t?.brakeTemperature ?? 0, text.decimal),
        brakeHeat,
      ),
      consumption: reading(
        words.instant,
        <GaugeIcon />,
        units.consumptionFigure(instant ?? 0, text.decimal),
        burning,
        false,
        text.settings.clusterReadingInstant,
      ),
    },
  }
}
