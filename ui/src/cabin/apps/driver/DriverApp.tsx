import { DriverPortrait } from './DriverPortrait'
import { useLive } from '../../state/store'
import { useText } from '../../state/text'
import './driver.css'

export function DriverApp() {
  const text = useText()
  const words = text.driver
  const career = useLive((state) => state.career)
  const number = (value: number | null | undefined, digits = 0) =>
    value == null ? '—' : text.number(Number(value.toFixed(digits)))
  const distance =
    career?.totalDistanceMeters == null ? '—' : `${number(career.totalDistanceMeters / 1000)} ${text.diagnostics.km}`
  const gameTime =
    career?.gameTimeSeconds == null ? '—' : `${number(career.gameTimeSeconds / 3600, 1)} ${text.diagnostics.hours}`
  const realTime =
    career?.realTimeSeconds == null ? '—' : `${number(career.realTimeSeconds / 3600, 1)} ${text.diagnostics.hours}`
  const fuel = career?.totalFuelLitres == null ? '—' : `${number(career.totalFuelLitres)} ${text.diagnostics.litres}`

  return (
    <section className="app-panel driver-app" aria-label={text.apps.driver}>
      <div className="driver-page">
        <header className="driver-profile">
          <div className="driver-portrait">
            <DriverPortrait />
          </div>
          <div className="driver-identity">
            <div className="driver-eyebrow">{words.profile}</div>
            <h1>{career?.profileName || (career ? words.profile : words.noProfile)}</h1>
            <p>{career ? words.savedCareer : words.saveUnavailable}</p>
          </div>
        </header>

        <section className="driver-career-hero" aria-label={words.experience}>
          <div className="driver-career-copy">
            <div className="driver-eyebrow">{words.experience}</div>
            <div className="driver-career-value">
              {number(career?.experiencePoints)}
              {career?.experiencePoints != null && <span> XP</span>}
            </div>
          </div>
          <div className="driver-road-mark" aria-hidden>
            <span />
            <span />
            <span />
          </div>
        </section>

        <section className="driver-stat-grid" aria-label={words.profile}>
          <Stat label={words.totalDistance} value={distance} accent />
          <Stat label={words.gameTime} value={gameTime} />
          <Stat label={words.realTime} value={realTime} />
          <Stat label={words.fuelUsed} value={fuel} />
          <Stat label={words.citiesVisited} value={number(career?.visitedCities)} />
          <Stat label={words.cancelledJobs} value={number(career?.cancelledJobs)} />
        </section>

        <section className="driver-history">
          <div className="driver-history-heading">
            <span className="driver-history-mark" aria-hidden />
            <h2>{words.history}</h2>
          </div>
          <p>{career ? words.historyUnavailable : words.saveUnavailable}</p>
        </section>
      </div>
    </section>
  )
}

function Stat({ label, value, accent = false }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className={`driver-stat${accent ? ' accent' : ''}`}>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  )
}
