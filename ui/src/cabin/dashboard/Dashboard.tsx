import { GuidanceCard } from '../maps/GuidanceCard'
import { MapView } from './MapView'
import { useAnyWidget } from './widgetState'
import { DestinationWidget, DiagnosticsWidget, FuelWidget, JobWidget, NowPlayingWidget, WeatherWidget } from './widgets'
import './dashboard.css'

/**
 * CarPlay-style Dashboard: the map takes most of the space (with one ETA pill), and a column of one-job
 * widgets sits on the right: turn-by-turn on top while there's a route, then Now Playing, the destination,
 * the fuel, the job and the diagnostics, and the weather where there's room.
 */
export function Dashboard() {
  // No widget to show (those turned on in Settings have nothing, and no route): the map has the whole width.
  const anyWidget = useAnyWidget()
  return (
    <section className="screen dashboard" aria-label="Dashboard">
      <MapView />
      <div className="widgets" hidden={!anyWidget}>
        <GuidanceCard variant="widget" />
        <NowPlayingWidget />
        <DestinationWidget />
        <FuelWidget />
        <JobWidget />
        <DiagnosticsWidget />
        <WeatherWidget />
      </div>
    </section>
  )
}
