import type { ReactNode } from 'react'
import { useLive } from '../../state/store'
import { useText } from '../../state/text'
import { brakeAir, brakeTemperature, coolant, oil, wear, type Reading, type State } from './readings'
import './diagnostics.css'

/**
 * The Diagnostics app: what the game tells of the truck's own health, a card each for the engine, the tires
 * and the brakes. Each card draws its most telling reading as a gauge (a filled bar over its range), and the
 * rest as rows under it. The game reports no tire pressures, so the tires' card shows the wear it does report
 * (its average across the wheels); a reading the host doesn't send (an older host) stands at zero.
 */
export function DiagnosticsApp() {
  const text = useText()
  const telemetry = useLive((state) => state.telemetry)
  if (!telemetry) {
    return (
      <section className="app-panel diagnostics-app" aria-label={text.apps.diagnostics}>
        <p className="diag-unavailable">{text.diagnostics.noTelemetry}</p>
      </section>
    )
  }
  const words = text.diagnostics
  const heat = coolant(telemetry.coolantTemperature)
  const engineWear = wear(telemetry.wearEngine)
  const tireWear = wear(telemetry.wearWheels)
  const air = brakeAir(telemetry.brakeAirPressure)
  const brakeHeat = brakeTemperature(telemetry.brakeTemperature)
  const byHeat: Record<State, string> = { ok: words.normal, warn: words.warm, alarm: words.high }
  const byWear: Record<State, string> = { ok: words.normal, warn: words.worn, alarm: words.worn }
  const byPressure: Record<State, string> = { ok: words.normal, warn: words.low, alarm: words.low }
  const celsius = (value: number) => `${text.number(Math.round(value))} ${words.celsius}`
  const percent = (fraction: number) => `${text.number(Math.round(fraction * 100))}%`
  return (
    <section className="app-panel diagnostics-app" aria-label={text.apps.diagnostics}>
      <div className="diag-grid">
        <Card name={words.engine} read={heat} note={byHeat[heat.state]}>
          <Hero read={heat} value={text.number(Math.round(heat.value))} unit={words.celsius} label={words.coolant} />
          <div className="diag-rows">
            <Row label={words.oil} value={celsius(telemetry.oilTemperature)} read={oil(telemetry.oilTemperature)} />
            <Row label={words.wear} value={percent(telemetry.wearEngine)} read={engineWear} />
            <Row
              label={words.rpm}
              value={telemetry.engineEnabled ? `${text.number(Math.round(telemetry.engineRpm))} rpm` : words.stopped}
            />
          </div>
        </Card>
        <Card name={words.tires} read={tireWear} note={byWear[tireWear.state]}>
          <Hero read={tireWear} value={text.number(Math.round(tireWear.value * 100))} unit="%" label={words.wear} />
        </Card>
        <Card name={words.brakes} read={air} note={byPressure[air.state]}>
          <Hero read={air} value={text.number(Math.round(air.value))} unit={words.psi} label={words.airPressure} />
          <div className="diag-rows">
            <Row label={words.brakeTemperature} value={celsius(telemetry.brakeTemperature)} read={brakeHeat} />
            <Row label={words.parkingBrake} value={telemetry.parkingBrake ? words.applied : words.released} />
          </div>
        </Card>
      </div>
    </section>
  )
}

/** A card: its name and what its reading says, above the reading itself. */
function Card({ name, read, note, children }: { name: string; read: Reading; note: string; children: ReactNode }) {
  return (
    <article className={`diag-card ${read.state}`}>
      <header className="diag-head">
        <h2 className="diag-name">{name}</h2>
        <span className="diag-pill">{note}</span>
      </header>
      {children}
    </article>
  )
}

/** The card's reading: its value and unit large, what it is under them, and its gauge. */
function Hero({ read, value, unit, label }: { read: Reading; value: string; unit: string; label: string }) {
  return (
    <div className="diag-hero">
      <div className="diag-reading">
        <span className="diag-value">{value}</span>
        <span className="diag-unit">{unit}</span>
      </div>
      <div className="diag-label">{label}</div>
      <div className="diag-meter" aria-hidden>
        <span style={{ width: `${Math.round(read.percent * 100)}%` }} />
      </div>
    </div>
  )
}

/** Another reading of the card, with a dot when it's one worth watching. */
function Row({ label, value, read }: { label: string; value: string; read?: Reading }) {
  return (
    <div className="diag-row">
      <span className="diag-row-label">{label}</span>
      <span className="diag-row-value">{value}</span>
      {read && <span className={`diag-dot ${read.state}`} aria-hidden />}
    </div>
  )
}
