import { MapView } from './MapView'
import { useAnyWidget } from './widgetState'
import { DestinationWidget, DiagnosticsWidget, JobWidget, NowPlayingWidget, WeatherWidget } from './widgets'
import './dashboard.css'

/**
 * CarPlay-style Dashboard: the map takes most of the space, with the turn-by-turn banner over it (as in the
 * Maps app: guidance belongs on the map, not on a card of its own), and a column of one-job widgets on the
 * right: Now Playing, the destination, the job and the diagnostics (with the fuel), and the weather where
 * there's room.
 */
export function Dashboard() {
  // No widget to show (those turned on in Settings have nothing, and no route): the map has the whole width.
  const anyWidget = useAnyWidget()
  return (
    <section className="screen dashboard" aria-label="Dashboard">
      <MapView />
      <div className="widgets" hidden={!anyWidget}>
        <NowPlayingWidget />
        <DestinationWidget />
        <JobWidget />
        <DiagnosticsWidget />
        <WeatherWidget />
      </div>
    </section>
  )
}
