import { type ComponentType, useEffect, useState } from 'react'
import { flushSync } from 'react-dom'
import { launchingNow } from '../state/launch'
import { type DashboardWidget, useCabin } from '../state/store'
import { useText } from '../state/text'
import { Glance } from './Glance'
import { MapView } from './MapView'
import { useWidgetOrder } from './widgetState'
import {
  DestinationWidget,
  DiagnosticsWidget,
  DriverHoursWidget,
  DriverWidget,
  NowPlayingWidget,
  WeatherWidget,
} from './widgets'
import './dashboard.css'

/** Each widget, by its id: the column is drawn from an order of ids (the player's, or Auto order's). */
const WIDGETS: Record<DashboardWidget, ComponentType> = {
  nowPlaying: NowPlayingWidget,
  destination: DestinationWidget,
  driverHours: DriverHoursWidget,
  driver: DriverWidget,
  diagnostics: DiagnosticsWidget,
  weather: WeatherWidget,
}

/**
 * CarPlay-style Dashboard: the map takes most of the space (with one ETA pill), and a column of one-job
 * widgets sits on the right: turn-by-turn on top while there's a route, then the widgets in the order the
 * player set (Settings › Dashboard) or, with Auto order, the order the drive asks for — a warning first, then a
 * closing deadline. The destination and its job share one card. A reorder slides each card to its new place
 * (the widgets' transition names); with Reduce Motion, or while a screen change is animating, they just move.
 * The switch in its corner turns it over to the Overview (Glance.tsx): the same drive as one page of readings,
 * for when the driver wants the numbers without the map.
 */
export function Dashboard() {
  // The Dashboard's two screens: the map with the drive's column, and the Overview (Glance.tsx), the same drive
  // as a page of readings. The switch between them keeps the map's corner on both; Settings › Dashboard says
  // whether the Overview is offered, and whether the Dashboard opens on it.
  const overviewShown = useCabin((state) => state.overviewShown)
  const overviewDefault = useCabin((state) => state.overviewDefault)
  const [wanted, setWanted] = useState<'map' | 'overview'>(() => (overviewDefault ? 'overview' : 'map'))
  const page = overviewShown && wanted === 'overview' ? 'overview' : 'map'
  const text = useText()
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
      // No transition to run: the list follows on the next frame, so the effect only schedules the update rather than
      // setting state inside itself.
      const id = requestAnimationFrame(() => setShown(order))
      return () => cancelAnimationFrame(id)
    }
    document.startViewTransition(() => flushSync(() => setShown(order))).finished.catch(() => {})
  }, [order, shown, reduceMotion])
  return (
    <section className="screen dashboard" aria-label="Dashboard" data-page={page}>
      {page === 'map' ? (
        <>
          <MapView />
          <div className={animateIn ? 'widgets' : 'widgets no-enter'} hidden={!anyWidget}>
            {shown.map((id) => {
              const Widget = WIDGETS[id]
              return <Widget key={id} />
            })}
          </div>
        </>
      ) : (
        <Glance />
      )}
      {overviewShown && (
        <button
          type="button"
          className="dashboard-switch glass"
          aria-label={page === 'map' ? text.diagnostics.overview : text.apps.maps}
          aria-pressed={page === 'overview'}
          onClick={() => setWanted(page === 'map' ? 'overview' : 'map')}
        >
          {page === 'map' ? <OverviewGlyph /> : <MapGlyph />}
          <span>{page === 'map' ? text.diagnostics.overview : text.apps.maps}</span>
        </button>
      )}
    </section>
  )
}

/** The Overview switch's mark: the three readings' stacked bars. */
function OverviewGlyph() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
      <path d="M4 7h9M4 12h15M4 17h11" />
    </svg>
  )
}

/** Back to the map: a folded map. */
function MapGlyph() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" aria-hidden>
      <path d="M9 4 3.5 6.5v13L9 17l6 2.5 5.5-2.5v-13L15 6.5 9 4Z" />
      <path d="M9 4v13M15 6.5v13" />
    </svg>
  )
}
