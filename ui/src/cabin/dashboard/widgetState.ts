import { useShallow } from 'zustand/react/shallow'
import { cabClock } from '../../shared/host'
import { brakeAir, coolant, type State } from '../apps/diagnostics/readings'
import { guidanceOf } from '../maps/guidance'
import { useMapData } from '../maps/mapData'
import { useCabin, useLive } from '../state/store'
import { useText } from '../state/text'
import { destinationView, formatDeadline } from './destination'

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

/** Whether the column has a widget to show: turn-by-turn, or one turned on in Settings with something to
 * show (Now Playing always has). */
export function useAnyWidget(): boolean {
  const widgets = useCabin((state) => state.dashboardWidgets)
  const guided = useGuided()
  const destination = useDestinationView() !== EMPTY
  const job = useJobView() !== null
  const fuel = useFuelView() !== null
  const diagnostics = useDiagnosticsView() !== null
  const weather = useLive((state) => state.weather !== null)
  return (
    guided ||
    widgets.nowPlaying ||
    (widgets.destination && destination) ||
    (widgets.job && job) ||
    (widgets.fuel && fuel) ||
    (widgets.diagnostics && diagnostics) ||
    (widgets.weather && weather)
  )
}

/** Whether turn-by-turn shows: while the route has a step to show (as GuidanceCard decides). */
export function useGuided(): boolean {
  return useLive((state) => {
    const { route, routeNext, telemetry } = state
    return (
      route !== null &&
      guidanceOf(route.distances, route.maneuvers, routeNext, telemetry?.navigationDistance ?? 0) !== null
    )
  })
}

/** Whether there's room for the weather card: three widgets fill the column, four with the fuel card up. */
export function weatherFits(others: number): boolean {
  return others < 4
}

/** The fuel card's words: what it is, how far the tank goes and what's in it. */
export interface FuelView {
  /** "Fuel". */
  kicker: string
  /** "1,240 km of range"; null when the game gives no range (an empty tank, or a truck that doesn't report). */
  range: string | null
  /** "540 L". */
  litres: string
}

/**
 * The Dashboard's fuel widget, from the game's own telemetry (`Telemetry.fuel`, litres, and `fuelRange`, km).
 * Without the game there's nothing to read, so it folds away as the destination does without a job.
 */
export function useFuelView(): FuelView | null {
  const text = useText()
  return useLive(
    useShallow((state) => {
      const telemetry = state.telemetry
      if (!telemetry) return null
      return {
        kicker: text.fuel,
        range: telemetry.fuelRange > 0 ? text.range(`${text.number(Math.round(telemetry.fuelRange))} km`) : null,
        litres: `${text.number(Math.round(telemetry.fuel))} L`,
      }
    }),
  )
}

/** The diagnostics card's readings: the coolant, the brake air, and how serious each is. */
export interface DiagnosticsView {
  /** "Diagnostics". */
  kicker: string
  /** "89 °C". */
  coolant: string
  /** "118 psi". */
  air: string
  coolantState: State
  airState: State
}

/**
 * The Dashboard's diagnostics widget, from the game's own telemetry: the two readings worth watching while
driving, the engine's coolant and the brake air. Without the game there's nothing to read, so it folds away
as the fuel card does.
 */
export function useDiagnosticsView(): DiagnosticsView | null {
  const text = useText()
  return useLive(
    useShallow((state) => {
      const telemetry = state.telemetry
      if (!telemetry) return null
      const heat = coolant(telemetry.coolantTemperature)
      const air = brakeAir(telemetry.brakeAirPressure)
      return {
        kicker: text.apps.diagnostics,
        coolant: `${text.number(Math.round(heat.value))} ${text.diagnostics.celsius}`,
        air: `${text.number(Math.round(air.value))} ${text.diagnostics.psi}`,
        coolantState: heat.state,
        airState: air.state,
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
