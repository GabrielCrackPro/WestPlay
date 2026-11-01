import type { ReactNode } from 'react'
import { useLive } from '../../state/store'
import { useText } from '../../state/text'
import {
  adblue,
  battery,
  brakeAir,
  brakeTemperature,
  consumption,
  coolant,
  oil,
  oilPressure,
  warned,
  wear,
  worst,
  type Reading,
  type State,
} from './readings'
import { Sparkline } from './Sparkline'
import { clock, tripAverage } from './trip'
import { TruckModel } from './TruckModel'
import { useTrends } from './useTrends'
import './diagnostics.css'

/**
 * The Diagnostics app: the truck's own health as the game reports it. On top, the truck turning on its disc
 * with its speed, its gear and the four readings a driver watches without thinking (coolant, oil, brake air,
 * battery) and one pill saying whether anything wants attention. Under it, a card each for the engine, the
 * brakes, the fuel and AdBlue, the chassis (its wear) and the trailer. Every reading is on its own gauge, and a
 * reading the host doesn't send (an older host) stands at zero.
 */
export function DiagnosticsApp() {
  const text = useText()
  const telemetry = useLive((state) => state.telemetry)
  const truck = useLive((state) => state.truck)
  // The trip computer and the two histories, from the frames the game sends.
  const trends = useTrends()
  if (!telemetry) {
    return (
      <section className="app-panel diagnostics-app" aria-label={text.apps.diagnostics}>
        <p className="diag-unavailable">{text.diagnostics.noTelemetry}</p>
      </section>
    )
  }
  const words = text.diagnostics
  const n = text.number
  const t = telemetry
  const trip = trends.trip

  const heat = coolant(t.coolantTemperature)
  const oilHeat = oil(t.oilTemperature)
  // The game's own warnings come first: where its dash says a reading is wrong, the gauge is an alarm.
  const pressure = warned(oilPressure(t.oilPressure), t.oilPressureWarning)
  const volts = warned(battery(t.batteryVoltage), t.batteryWarning)
  const air = warned(brakeAir(t.brakeAirPressure), t.brakeAirWarning)
  const brakeHeat = brakeTemperature(t.brakeTemperature)
  const urea = adblue(t.adblue)
  const economy = consumption(t.fuelAverage)
  const fuel: Reading = { value: t.fuel, percent: 0, state: t.fuelWarning ? 'alarm' : 'ok' }
  const engineWear = wear(t.wearEngine)
  const tireWear = wear(t.wearWheels)
  const gearboxWear = wear(t.wearTransmission)
  const cabWear = wear(t.wearCabin)
  const chassisWear = wear(t.wearChassis)
  const trailerWear = wear(t.trailerWearWheels)

  const stateOf = (...reads: Reading[]): State => reads.map((read) => read.state).reduce(worst, 'ok')
  const engineState = stateOf(heat, oilHeat, pressure, volts, engineWear)
  const brakeState = stateOf(air, brakeHeat)
  const fuelState = stateOf(urea, economy, fuel)
  const chassisState = stateOf(engineWear, gearboxWear, chassisWear, cabWear, tireWear)
  const trailerState = t.trailerAttached ? trailerWear.state : 'ok'
  const overall = [engineState, brakeState, fuelState, chassisState, trailerState].reduce(worst, 'ok')

  // Too hot, or too little: the two ways a reading turns serious; wear is its own.
  const byHeat: Record<State, string> = { ok: words.normal, warn: words.warm, alarm: words.high }
  const byLow: Record<State, string> = { ok: words.normal, warn: words.low, alarm: words.check }
  const byWear: Record<State, string> = { ok: words.normal, warn: words.worn, alarm: words.service }
  const byOverall: Record<State, string> = { ok: words.normal, warn: words.check, alarm: words.service }

  const celsius = (value: number) => `${n(Math.round(value))} ${words.celsius}`
  const psi = (value: number) => `${n(Math.round(value))} ${words.psi}`
  const speed = Math.round(Math.abs(t.speed) * 3.6)
  const gear = t.displayedGear < 0 ? 'R' : t.displayedGear === 0 ? 'N' : n(t.displayedGear)

  return (
    <section className="app-panel diagnostics-app" aria-label={text.apps.diagnostics}>
      <div className="diag-scroll">
        <section className={`diag-overview ${overall}`}>
          <div className="diag-art">
            <TruckModel />
          </div>
          <div className="diag-main">
            <header className="diag-top">
              <h2 className="diag-model">{truck ? `${truck.brand} ${truck.name}` : text.apps.diagnostics}</h2>
              <span className="diag-pill">{byOverall[overall]}</span>
            </header>
            <div className="diag-speed">
              <span className="diag-speed-value">{n(speed)}</span>
              <span className="diag-speed-unit">{words.kmh}</span>
            </div>
            <div className="diag-tags">
              <Tag label={words.gear} value={gear} />
              <Tag label={words.engine} value={t.engineEnabled ? words.running : words.engineOff} />
              <Tag label={words.parkingBrake} value={t.parkingBrake ? words.applied : words.released} />
            </div>
            <div className="diag-quick">
              <Quick
                read={heat}
                label={words.coolant}
                value={n(Math.round(t.coolantTemperature))}
                unit={words.celsius}
              />
              <Quick read={oilHeat} label={words.oil} value={n(Math.round(t.oilTemperature))} unit={words.celsius} />
              <Quick read={air} label={words.brakeAir} value={n(Math.round(t.brakeAirPressure))} unit={words.psi} />
              <Quick
                read={volts}
                label={words.battery}
                value={n(Math.round(t.batteryVoltage * 10) / 10)}
                unit={words.volts}
              />
            </div>
          </div>
        </section>

        <div className="diag-cards">
          <Card name={words.engine} state={engineState} note={byHeat[engineState]}>
            <Lead read={heat} value={n(Math.round(t.coolantTemperature))} unit={words.celsius} label={words.coolant} />
            <Sparkline values={trends.coolant} />
            <div className="diag-rows">
              <Row label={words.oil} value={celsius(t.oilTemperature)} read={oilHeat} />
              <Row label={words.oilPressure} value={psi(t.oilPressure)} read={pressure} />
              <Row
                label={words.battery}
                value={`${n(Math.round(t.batteryVoltage * 10) / 10)} ${words.volts}`}
                read={volts}
              />
              <Row label={words.rpm} value={t.engineEnabled ? `${n(Math.round(t.engineRpm))} rpm` : words.stopped} />
            </div>
          </Card>

          <Card name={words.brakes} state={brakeState} note={byLow[brakeState]}>
            <Lead read={air} value={n(Math.round(t.brakeAirPressure))} unit={words.psi} label={words.airPressure} />
            <Sparkline values={trends.brakes} />
            <div className="diag-rows">
              <Row label={words.brakeTemperature} value={celsius(t.brakeTemperature)} read={brakeHeat} />
              <Row label={words.retarder} value={t.retarderLevel > 0 ? n(t.retarderLevel) : words.off} />
              <Row label={words.parkingBrake} value={t.parkingBrake ? words.applied : words.released} />
            </div>
          </Card>

          <Card name={words.fuel} state={fuelState} note={byLow[fuelState]}>
            <Lead read={urea} value={n(Math.round(t.adblue))} unit={words.litres} label={words.adblue} />
            <div className="diag-rows">
              <Row label={words.fuel} value={`${n(Math.round(t.fuel))} ${words.litres}`} read={fuel} />
              <Row label={words.range} value={`${n(Math.round(t.fuelRange))} ${words.km}`} />
              <Row
                label={words.consumption}
                value={`${n(Math.round(t.fuelAverage * 10) / 10)} ${words.lPer100}`}
                read={economy}
              />
              <Row label={words.odometer} value={`${n(Math.round(t.odometer))} ${words.km}`} />
            </div>
          </Card>

          <Card name={words.trip} state={fuelState} note={byLow[fuelState]} span={12}>
            <div className="diag-trip">
              <Stat label={words.distance} value={`${n(Math.round(trip.distance))} ${words.km}`} />
              <Stat label={words.used} value={`${n(Math.round(trip.fuel * 10) / 10)} ${words.litres}`} />
              <Stat
                label={words.average}
                value={`${n(Math.round(tripAverage(trip) * 10) / 10)} ${words.lPer100}`}
                state={economy.state}
              />
              <Stat label={words.time} value={clock(trip.moving + trip.idle)} />
              <button type="button" className="diag-reset" onClick={trends.reset}>
                {words.reset}
              </button>
            </div>
          </Card>

          <Card name={words.chassis} state={chassisState} note={byWear[chassisState]} span={6}>
            <div className="diag-wear">
              <Wear label={words.wearEngine} read={engineWear} />
              <Wear label={words.wearTransmission} read={gearboxWear} />
              <Wear label={words.wearChassis} read={chassisWear} />
              <Wear label={words.tires} read={tireWear} />
              <Wear label={words.wearCabin} read={cabWear} />
            </div>
          </Card>

          <Card name={words.trailer} state={trailerState} note={byWear[trailerState]} span={6}>
            {t.trailerAttached ? (
              <>
                <div className="diag-lead">
                  <span className="diag-value">{words.hitched}</span>
                  <span className="diag-label">{words.trailer}</span>
                </div>
                <div className="diag-wear">
                  <Wear label={words.wearTrailer} read={trailerWear} />
                </div>
              </>
            ) : (
              <p className="diag-empty">{words.unhitched}</p>
            )}
          </Card>
        </div>
      </div>
    </section>
  )
}

/** A card: its name and what its readings say, above them. */
function Card({
  name,
  state,
  note,
  span = 4,
  children,
}: {
  name: string
  state: State
  note: string
  span?: 4 | 6 | 12
  children: ReactNode
}) {
  return (
    <article className={`diag-card ${state} span-${span}`}>
      <header className="diag-head">
        <h2 className="diag-name">{name}</h2>
        <span className="diag-pill">{note}</span>
      </header>
      {children}
    </article>
  )
}

/** The reading a card is about: its value and unit large, what it is under them, and its gauge. */
function Lead({ read, value, unit, label }: { read: Reading; value: string; unit: string; label: string }) {
  return (
    <div className="diag-lead">
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

/** One of the hero's four readings: its name, its value and its gauge. */
function Quick({ read, label, value, unit }: { read: Reading; label: string; value: string; unit: string }) {
  return (
    <div className={`diag-quick-item ${read.state}`}>
      <span className="diag-quick-label">{label}</span>
      <span className="diag-quick-value">
        {value}
        <span className="diag-quick-unit">{unit}</span>
      </span>
      <div className="diag-quick-meter" aria-hidden>
        <span style={{ width: `${Math.round(read.percent * 100)}%` }} />
      </div>
    </div>
  )
}

/** A tag of the hero: what it is on the left, what it says on the right. */
function Tag({ label, value }: { label: string; value: string }) {
  return (
    <span className="diag-tag">
      <span className="diag-tag-label">{label}</span>
      <span className="diag-tag-value">{value}</span>
    </span>
  )
}

/** One figure of the trip computer: its name, then it. */
function Stat({ label, value, state }: { label: string; value: string; state?: State }) {
  return (
    <div className={`diag-stat${state && state !== 'ok' ? ` ${state}` : ''}`}>
      <span className="diag-stat-label">{label}</span>
      <span className="diag-stat-value">{value}</span>
    </div>
  )
}

/** Another reading of a card, with a dot when it's one worth watching. */
function Row({ label, value, read }: { label: string; value: string; read?: Reading }) {
  return (
    <div className="diag-row">
      <span className="diag-row-label">{label}</span>
      <span className="diag-row-value">{value}</span>
      {read && <span className={`diag-dot ${read.state}`} aria-hidden />}
    </div>
  )
}

/** A part of the truck and how worn it is, its gauge from new to worn out. */
function Wear({ label, read }: { label: string; read: Reading }) {
  return (
    <div className={`diag-wear-item ${read.state}`}>
      <div className="diag-wear-head">
        <span>{label}</span>
        <b>{Math.round(read.value * 100)}%</b>
      </div>
      <div className="diag-meter" aria-hidden>
        <span style={{ width: `${Math.round(read.value * 100)}%` }} />
      </div>
    </div>
  )
}
