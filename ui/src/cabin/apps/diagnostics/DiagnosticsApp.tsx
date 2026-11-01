import type { ReactNode } from 'react'
import { useCabin, useLive, type DiagnosticsPage } from '../../state/store'
import { useText } from '../../state/text'
import {
  adblue,
  battery,
  brakeAir,
  brakeTemperature,
  consumption,
  coolant,
  fuelLevel,
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
import { TruckFigure } from './TruckFigure'
import { useTrends } from './useTrends'
import './diagnostics.css'

/**
 * The Diagnostics app: the truck's own health as the game reports it, on three pages under a bar of tabs so a
 * page fits the panel and nothing has to be scrolled to be seen. The overview is the truck with its speed, its
 * gear and the four readings a driver watches without thinking (coolant, oil, brake air, battery), one pill
 * saying whether anything wants attention, and the trip computer. The engine page holds the engine and the fuel
 * (its tank, its consumption and the AdBlue, which are read together). The chassis page holds the brakes and how
 * worn the truck and its trailer are. Every reading is on its own gauge, and a reading the host doesn't send (an
 * older host) stands at zero.
 */
export function DiagnosticsApp() {
  const text = useText()
  const telemetry = useLive((state) => state.telemetry)
  const truck = useLive((state) => state.truck)
  const trailer = useLive((state) => state.trailer)
  // The trip computer and the two histories, from the frames the game sends.
  const trends = useTrends()
  // The page left open comes back with the player's settings, so a warning's page isn't hunted for twice.
  const page = useCabin((state) => state.diagnosticsPage)
  const setPage = useCabin((state) => state.setDiagnosticsPage)
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
  // How full the tank is, from the capacity the game reports for this truck (no capacity: litres alone).
  const capacity = truck?.fuelCapacity ?? 0
  const tank = capacity > 0 ? fuelLevel(t.fuel / capacity, truck?.fuelWarningFactor ?? 0) : null
  const fuel: Reading = {
    value: t.fuel,
    percent: tank?.percent ?? 0,
    state: t.fuelWarning ? 'alarm' : (tank?.state ?? 'ok'),
  }
  const engineWear = wear(t.wearEngine)
  const tireWear = wear(t.wearWheels)
  const gearboxWear = wear(t.wearTransmission)
  const cabWear = wear(t.wearCabin)
  const chassisWear = wear(t.wearChassis)
  const trailerWear = wear(t.trailerWearWheels)
  const trailerBody = wear(t.trailerWearBody)
  const trailerChassis = wear(t.trailerWearChassis)

  const stateOf = (...reads: Reading[]): State => reads.map((read) => read.state).reduce(worst, 'ok')
  const engineState = stateOf(heat, oilHeat, pressure, volts, engineWear)
  const brakeState = stateOf(air, brakeHeat)
  const fuelState = stateOf(urea, economy, fuel)
  const chassisState = stateOf(engineWear, gearboxWear, chassisWear, cabWear, tireWear)
  const trailerState = t.trailerAttached
    ? [trailerWear.state, trailerBody.state, trailerChassis.state].reduce(worst, 'ok')
    : 'ok'
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
  // Minutes as the cab writes them: an hour and a half is "1 h 30", twenty minutes "20 min".
  const inMinutes = (value: number) =>
    value >= 60
      ? `${n(Math.floor(value / 60))} ${words.hours} ${String(Math.floor(value % 60)).padStart(2, '0')}`
      : `${n(Math.round(value))} ${words.minutes}`
  const cruise = t.cruiseControlSpeed > 0.5 ? `${n(Math.round(t.cruiseControlSpeed * 3.6))} ${words.kmh}` : words.off
  const retarder =
    t.retarderLevel > 0
      ? `${n(t.retarderLevel)}${truck && truck.retarderSteps > 0 ? ` / ${n(truck.retarderSteps)}` : ''}`
      : words.off
  const lights =
    [t.lowBeam ? words.lowBeam : null, t.highBeam ? words.highBeam : null, t.parkingLight ? words.parkingLight : null]
      .filter(Boolean)
      .join(' · ') || words.off

  // The tabs: each page's name, and the tone of the worst reading it holds, so a page worth opening shows it.
  // The game's own driver hours, in in-game minutes (-1 where the profile has the simulation off).
  const rest = t.restStop
  const breakIn = t.mandatoryBreak
  const hoursState: State = rest >= 0 && rest <= 15 ? 'warn' : 'ok'

  const pages: { id: DiagnosticsPage; label: string; state: State }[] = [
    { id: 'overview', label: words.overview, state: overall },
    { id: 'engine', label: words.engine, state: worst(engineState, fuelState) },
    { id: 'driver', label: words.driverHours, state: hoursState },
    { id: 'chassis', label: words.chassis, state: [brakeState, chassisState, trailerState].reduce(worst, 'ok') },
  ]

  return (
    <section className="app-panel diagnostics-app" aria-label={text.apps.diagnostics}>
      <div className={`diag-shell page-${page}`}>
        <nav className="diag-tabs" role="tablist" aria-label={text.apps.diagnostics}>
          {pages.map((tab) => (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={page === tab.id}
              className={`diag-tab ${tab.state}${page === tab.id ? ' on' : ''}`}
              onClick={() => setPage(tab.id)}
            >
              {tab.label}
              {tab.state !== 'ok' && <span className={`diag-dot ${tab.state}`} aria-hidden />}
            </button>
          ))}
        </nav>
        <section className={`diag-overview diag-hero ${overall}`}>
          <div className="diag-art">
            <TruckFigure />
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
          <Card name={words.engine} state={engineState} note={byHeat[engineState]} page="engine" span={6}>
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

          <Card name={words.brakes} state={brakeState} note={byLow[brakeState]} page="chassis">
            <Lead read={air} value={n(Math.round(t.brakeAirPressure))} unit={words.psi} label={words.airPressure} />
            <Sparkline values={trends.brakes} />
            <div className="diag-rows">
              <Row label={words.brakeTemperature} value={celsius(t.brakeTemperature)} read={brakeHeat} />
              <Row label={words.retarder} value={t.retarderLevel > 0 ? n(t.retarderLevel) : words.off} />
              <Row label={words.parkingBrake} value={t.parkingBrake ? words.applied : words.released} />
            </div>
          </Card>

          <Card name={words.fuel} state={fuelState} note={byLow[fuelState]} page="engine" span={6}>
            <Lead read={fuel} value={n(Math.round(t.fuel))} unit={words.litres} label={words.fuel} />
            <div className="diag-rows">
              <Row label={words.range} value={`${n(Math.round(t.fuelRange))} ${words.km}`} />
              <Row
                label={words.consumption}
                value={`${n(Math.round(t.fuelAverage * 10) / 10)} ${words.lPer100}`}
                read={economy}
              />
              <Row label={words.adblue} value={`${n(Math.round(t.adblue))} ${words.litres}`} read={urea} />
              <Row label={words.odometer} value={`${n(Math.round(t.odometer))} ${words.km}`} />
            </div>
          </Card>

          <Card name={words.trip} state={fuelState} note={byLow[fuelState]} page="overview" span={12}>
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

          <Card
            name={words.driverHours}
            state={hoursState}
            note={hoursState === 'warn' ? words.check : words.normal}
            page="driver"
            span={6}
          >
            <div className="diag-rows">
              {/* The game's own: its fatigue simulation's next rest, and the mandatory break's. */}
              <Row label={words.restStop} value={rest >= 0 ? inMinutes(rest) : words.noRest} />
              <Row label={words.mandatoryBreak} value={breakIn >= 0 ? inMinutes(breakIn) : words.noRest} />
              <Row label={words.time} value={clock(trip.moving + trip.idle)} />
              <Row label={words.distance} value={`${n(Math.round(trip.distance))} ${words.km}`} />
            </div>
          </Card>

          <Card name={words.controls} state="ok" note={words.normal} page="driver" span={6}>
            <div className="diag-rows">
              <Row label={words.cruiseControl} value={cruise} />
              <Row label={words.retarder} value={retarder} />
              <Row label={words.parkingBrake} value={t.parkingBrake ? words.applied : words.released} />
              <Row label={words.lights} value={lights} />
              <Row label={words.wipers} value={t.wipers ? words.on : words.off} />
            </div>
          </Card>

          <Card name={words.chassis} state={chassisState} note={byWear[chassisState]} page="chassis">
            <div className="diag-wear">
              <Wear label={words.wearEngine} read={engineWear} />
              <Wear label={words.wearTransmission} read={gearboxWear} />
              <Wear label={words.wearChassis} read={chassisWear} />
              <Wear label={words.tires} read={tireWear} />
              <Wear label={words.wearCabin} read={cabWear} />
            </div>
          </Card>

          <Card name={words.trailer} state={trailerState} note={byWear[trailerState]} page="chassis">
            {t.trailerAttached ? (
              <>
                <div className="diag-lead">
                  <span className="diag-value">{trailer?.name || words.hitched}</span>
                  <span className="diag-label">{trailer?.brand || words.trailer}</span>
                </div>
                <div className="diag-rows">
                  {/* How it hangs and what it carries, its plate, and the wheels it rides on. */}
                  <Row
                    label={words.trailerType}
                    value={[trailer?.chainType, trailer?.bodyType].filter(Boolean).join(' · ') || words.off}
                  />
                  <Row label={words.plate} value={trailer?.plate || words.off} />
                  <Row label={words.tires} value={trailer?.wheelCount ? n(trailer.wheelCount) : words.off} />
                </div>
                <div className="diag-wear">
                  <Wear label={words.body} read={trailerBody} />
                  <Wear label={words.chassis} read={trailerChassis} />
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

/**
 * A card: its name and what its readings say, above them. It belongs to one page, and the page being shown is what
 * puts it in the grid (the other pages' cards stay out of it, their readings cost nothing to keep).
 */
function Card({
  name,
  state,
  note,
  page,
  span = 4,
  children,
}: {
  name: string
  state: State
  note: string
  page: DiagnosticsPage
  span?: 4 | 6 | 12
  children: ReactNode
}) {
  return (
    <article className={`diag-card ${state} span-${span} on-${page}`}>
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
      {/* A reading with no range of its own (a truck whose tank the game doesn't measure) has no gauge. */}
      {read.percent > 0 && (
        <div className="diag-meter" aria-hidden>
          <span style={{ width: `${Math.round(read.percent * 100)}%` }} />
        </div>
      )}
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
