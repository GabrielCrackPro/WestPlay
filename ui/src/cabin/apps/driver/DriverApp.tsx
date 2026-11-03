import { DriverPortrait } from './DriverPortrait'
import { useLive } from '../../state/store'
import { useText } from '../../state/text'
import './driver.css'

/**
 * The Driver app: the driver's game profile and the lifetime totals the game keeps for it. Laid out as the native
 * apps are — a profile heading over iOS 26's grouped cards, hairline-separated rows and sentence-case labels — so
 * it reads as part of the cab rather than as a dashboard of its own.
 */
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
      <div className="driver-scroll">
        <div className="driver-page">
          <header className="driver-profile">
            <div className="driver-portrait">
              <DriverPortrait />
            </div>
            <div className="driver-identity">
              <h1>{career?.profileName || (career ? words.profile : words.noProfile)}</h1>
              <p>{career ? words.savedCareer : words.saveUnavailable}</p>
            </div>
          </header>

          <section className="driver-card driver-totals" aria-label={words.profile}>
            <div className="driver-career">
              <span className="driver-label">{words.experience}</span>
              <div className="driver-career-value">
                {number(career?.experiencePoints)}
                {career?.experiencePoints != null && <span> XP</span>}
              </div>
            </div>
            <div className="driver-rows">
              <Row label={words.totalDistance} value={distance} />
              <Row label={words.gameTime} value={gameTime} />
              <Row label={words.realTime} value={realTime} />
              <Row label={words.fuelUsed} value={fuel} />
            </div>
          </section>

          <section className="driver-group" aria-label={words.history}>
            <h2 className="driver-group-header">{words.history}</h2>
            <p className="driver-group-footer">{career ? words.historyUnavailable : words.saveUnavailable}</p>
          </section>
        </div>
      </div>
    </section>
  )
}

/** One lifetime total: its name on the left, its figure on the right, as the native apps' rows have them. */
function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="driver-row">
      <span className="driver-row-label">{label}</span>
      <span className="driver-row-value">{value}</span>
    </div>
  )
}
