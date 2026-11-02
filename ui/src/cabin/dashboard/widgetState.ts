import { useMemo } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { cabClock } from '../../shared/host'
import type { DashboardWidget } from '../state/store'
import { adblue, battery, brakeAir, coolant, fuelLevel, warned, type State } from '../apps/diagnostics/readings'
import { useMapData } from '../maps/mapData'
import { useCabin, useLive } from '../state/store'
import { useText } from '../state/text'
import { destinationView, formatDeadline } from './destination'
import { useAnythingLoaded } from './useNowPlaying'

/* What the Dashboard's widget column shows, for the widgets (widgets.tsx) and the Dashboard itself. */

/** The destination widget's view (`EMPTY` without one). */
export function useDestinationView() {
  const text = useText()
  const labels = useMapData()?.labels
  return useLive(
    useShallow((state) => {
      const end = state.route?.nodes.at(-1)?.position ?? null
      return destinationView(state.job, end, state.telemetry, labels ?? [], text, state.clockShift) ?? EMPTY
    }),
  )
}

/** No destination (one object, so the store's shallow comparison sees "still nothing"). */
export const EMPTY = { kicker: '', title: '', subtitle: null, detail: '', late: false }

/** Whether the column has a widget to show: one turned on in Settings with something to show (Now Playing while
 * a player has something, paused or not). Turn-by-turn isn't one of them: it's over the map (MapView). */
export function useAnyWidget(): boolean {
  const widgets = useCabin((state) => state.dashboardWidgets)
  const loaded = useAnythingLoaded()
  const destination = useDestinationView() !== EMPTY
  const job = useJobView() !== null
  const diagnostics = useDiagnosticsView() !== null
  const weather = useLive((state) => state.weather !== null)
  return (
    (widgets.nowPlaying && loaded) ||
    (widgets.destination && destination) ||
    (widgets.job && job) ||
    (widgets.diagnostics && diagnostics) ||
    (widgets.weather && weather)
  )
}

/**
 * The Dashboard's widgets in the order the column shows them: the player's own (Settings › Dashboard), or, with Auto
 * order on, by what the drive needs now — a warning first, then a job's deadline closing, then a late delivery,
 * the rest after them. A tie keeps the player's order.
 */
export function useWidgetOrder(): DashboardWidget[] {
  const order = useCabin((state) => state.dashboardOrder)
  const enabled = useCabin((state) => state.dashboardWidgets)
  const auto = useCabin((state) => state.autoOrder)
  const { late, soon, warn } = useLive(
    useShallow((state) => {
      const telemetry = state.telemetry
      const job = state.job
      const clock = telemetry?.gameTime ?? 0
      const late = job !== null && job.deliveryTime > 0 && clock > job.deliveryTime
      const soon = job !== null && job.deliveryTime > 0 && !late && job.deliveryTime - clock <= 20
      const warn =
        telemetry !== null &&
        (telemetry.fuelWarning ||
          telemetry.adblueWarning ||
          telemetry.batteryWarning ||
          telemetry.oilPressureWarning ||
          telemetry.brakeAirWarning)
      return { late, soon, warn }
    }),
  )
  return useMemo(() => {
    const ids = order.filter((id) => enabled[id])
    if (!auto) return ids
    const score: Record<DashboardWidget, number> = {
      diagnostics: warn ? 100 : 20,
      destination: late ? 96 : 25,
      job: late ? 95 : soon ? 90 : 30,
      nowPlaying: 10,
      weather: 0,
    }
    return [...ids].sort((a, b) => score[b] - score[a] || order.indexOf(a) - order.indexOf(b))
  }, [order, enabled, auto, late, soon, warn])
}

/** The diagnostics card's readings: the coolant and the brake air, then the fuel left in the tank, the AdBlue
 * and the battery, and how serious each is. */
export interface DiagnosticsView {
  /** "Diagnostics". */
  kicker: string
  /** "89 °C". */
  coolant: string
  /** "118 psi". */
  air: string
  /** "329 l". */
  fuel: string
  /** "49 l". */
  adblue: string
  /** "27.4 V". */
  battery: string
  coolantState: State
  airState: State
  fuelState: State
  adblueState: State
  batteryState: State
}

/**
 * The Dashboard's diagnostics widget, from the game's own telemetry: the readings worth watching while
driving, the engine's coolant and the brake air, and under them the fuel left in the tank (the game's low-fuel
warning when it comes on), the AdBlue and the battery. Without the game there's nothing to read, so it folds
away as the destination does without a job.
 */
export function useDiagnosticsView(): DiagnosticsView | null {
  const text = useText()
  return useLive(
    useShallow((state) => {
      const telemetry = state.telemetry
      if (!telemetry) return null
      const heat = coolant(telemetry.coolantTemperature)
      const air = brakeAir(telemetry.brakeAirPressure)
      const volts = warned(battery(telemetry.batteryVoltage), telemetry.batteryWarning)
      const urea = warned(adblue(telemetry.adblue), telemetry.adblueWarning)
      // How full the tank is, when the game says how big it is.
      const capacity = state.truck?.fuelCapacity ?? 0
      const tank = capacity > 0 ? fuelLevel(telemetry.fuel / capacity, state.truck?.fuelWarningFactor ?? 0) : null
      return {
        kicker: text.apps.diagnostics,
        coolant: `${text.number(Math.round(heat.value))} ${text.diagnostics.celsius}`,
        air: `${text.number(Math.round(air.value))} ${text.diagnostics.psi}`,
        fuel: `${text.number(Math.round(telemetry.fuel))} ${text.diagnostics.litres}`,
        adblue: `${text.number(Math.round(telemetry.adblue))} ${text.diagnostics.litres}`,
        battery: `${text.number(Math.round(telemetry.batteryVoltage * 10) / 10)} ${text.diagnostics.volts}`,
        coolantState: heat.state,
        airState: air.state,
        fuelState: telemetry.fuelWarning ? 'alarm' : (tank?.state ?? 'ok'),
        adblueState: urea.state,
        batteryState: volts.state,
      }
    }),
  )
}

/** The job card's words: what it carries, what it pays, and the deadline (or the pickup still to make). */
export interface JobView {
  /** "Cement · 24.0 t". */
  cargo: string
  /** "Income 52,000". */
  pay: string
  /** "Arrive by 18:40", "Late", or "Pickup". */
  detail: string
  /** Past the delivery deadline. */
  late: boolean
}

/** The Dashboard's job widget, from the game's job (`JobInfo`); null without one, so the card folds away. */
export function useJobView(): JobView | null {
  const text = useText()
  return useLive(
    useShallow((state) => {
      const { job, telemetry, clockShift } = state
      if (!job) return null
      const tonnes = (job.cargoMass / 1000).toFixed(1).replace('.', text.decimal)
      const now = telemetry?.gameTime ?? 0
      const clock = telemetry ? cabClock(telemetry, clockShift) : 0
      const late = job.deliveryTime > 0 && now > job.deliveryTime
      let detail = text.delivery
      if (!job.cargoLoaded) detail = text.pickup
      else if (job.deliveryTime > 0) {
        detail = late ? text.late : text.arriveBy(formatDeadline(job.deliveryTime + (clock - now), clock, text.days))
      }
      return {
        cargo: job.cargo ? `${job.cargo} · ${tonnes} t` : `${tonnes} t`,
        pay: `${text.income} ${text.number(job.income)}`,
        detail,
        late,
      }
    }),
  )
}
