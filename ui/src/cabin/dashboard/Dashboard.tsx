import { type ComponentType, useEffect, useState } from 'react'
import { flushSync } from 'react-dom'
import { launchingNow } from '../state/launch'
import { type DashboardWidget, useCabin } from '../state/store'
import { MapView } from './MapView'
import { useWidgetOrder } from './widgetState'
import { DestinationWidget, DiagnosticsWidget, JobWidget, NowPlayingWidget, WeatherWidget } from './widgets'
import './dashboard.css'

/** Each widget, by its id: the column is drawn from an order of ids (the player's, or Auto order's). */
const WIDGETS: Record<DashboardWidget, ComponentType> = {
  nowPlaying: NowPlayingWidget,
  destination: DestinationWidget,
  job: JobWidget,
  diagnostics: DiagnosticsWidget,
  weather: WeatherWidget,
}

/**
 * CarPlay-style Dashboard: the map takes most of the space (with one ETA pill), and a column of one-job
 * widgets sits on the right: turn-by-turn on top while there's a route, then the widgets in the order the
 * player set (Settings › Dashboard) or, with Auto order, the order the drive asks for — a warning first, then a
 * closing deadline. A reorder slides each card to its new place (the widgets' transition names); with Reduce
 * Motion, or while a screen change is animating, they just move.
 */
export function Dashboard() {
  // No widget to show (those turned on in Settings have nothing, and no route): the map has the whole width.
  const order = useWidgetOrder()
  const anyWidget = order.length > 0
  // Mounting as an app closes into the sidebar: the widgets are the transition's, so they don't animate in. Read
  // once, at mount: a live flag would start their entrance as the transition ended (a flash of the column).
  const [animateIn] = useState(() => !launchingNow())
  const reduceMotion = useCabin((state) => state.reduceMotion)
  const [shown, setShown] = useState(order)
  useEffect(() => {
    if (shown.join('\n') === order.join('\n')) return
    if (
      reduceMotion ||
      typeof document.startViewTransition !== 'function' ||
      document.documentElement.dataset.transition
    ) {
      setShown(order)
      return
    }
    document.startViewTransition(() => flushSync(() => setShown(order))).finished.catch(() => {})
  }, [order, shown, reduceMotion])
  return (
    <section className="screen dashboard" aria-label="Dashboard">
      <MapView />
      <div className={animateIn ? 'widgets' : 'widgets no-enter'} hidden={!anyWidget}>
        {shown.map((id) => {
          const Widget = WIDGETS[id]
          return <Widget key={id} />
        })}
      </div>
    </section>
  )
}
