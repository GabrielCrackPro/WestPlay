import { type ReactNode, useState } from 'react'
import { launchingNow } from '../../state/launch'
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
import { ChassisTabIcon, EngineTabIcon, HoursTabIcon, OverviewTabIcon } from './tabIcons'
import { clock, tripAverage } from './trip'
import { useDamped } from './useDamped'
import { useTrends } from './useTrends'
import '../../shell/appTabs.css'
import './diagnostics.css'

/** Each page's tab icon (tabIcons.tsx). */
const TAB_ICONS: Record<DiagnosticsPage, ReactNode> = {
  overview: <OverviewTabIcon />,
  engine: <EngineTabIcon />,
  driver: <HoursTabIcon />,
  chassis: <ChassisTabIcon />,
}

/** A telltale that's on: the capsule the hero shows it as, in its own tone. */
type Lit = { label: string; tone: 'green' | 'blue' | 'amber' | 'red'; blink?: boolean; icon: ReactNode }

/**
 * The Diagnostics app: the truck's health as the game reports it, on four pages — the drive's own readings, the
 * engine and fuel, the driver's hours, and the chassis and trailer. It's built as a native app is: a large title
 * with one status word beside it, a segmented control under it, then grouped cards whose readings are rows with a
 * hairline between them. Only what's wrong takes a tone; a healthy truck is quiet. The telltales are shown only
 * while they're lit, so the panel isn't a wall of dark lamps, and every reading the game sends is still here —
 * nothing is inferred or hidden.
 */
export function DiagnosticsApp() {
  const text = useText()
  const telemetry = useLive((state) => state.telemetry)
  // The speed as a speedo shows it: eased rather than snapped to the game's twenty frames a second (useDamped.ts).
  // Called before the early return below, as every hook is.
  const speedShown = Math.round(useDamped(Math.abs(telemetry?.speed ?? 0) * 3.6))
  const truck = useLive((state) => state.truck)
  const trailer = useLive((state) => state.trailer)
  // The trip computer and the two histories, from the frames the game sends.
  const trends = useTrends()
  // The page left open comes back with the player's settings, so a warning's page isn't hunted for twice.
  const page = useCabin((state) => state.diagnosticsPage)
  const setPage = useCabin((state) => state.setDiagnosticsPage)
  // Opening: the window is the launch's, so the cards don't rise in behind it (they do as the tabs turn). Read once,
  // at mount: a live flag would start their rise as the transition ended (a flash of cards).
  const [animateIn] = useState(() => !launchingNow())
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
  // The worst readings since the engine came on: what a driver reads off before calling a garage.
  const worstRead = trends.extremes

  const heat = coolant(t.coolantTemperature)
  const oilHeat = oil(t.oilTemperature)
  // The game's own warnings come first: where its dash says a reading is wrong, the reading is an alarm.
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
  const peakHeat = worstRead.coolantPeak === null ? null : coolant(worstRead.coolantPeak)
  const lowAir = worstRead.airLow === null ? null : brakeAir(worstRead.airLow)
  const lowOil = worstRead.oilLow === null ? null : oilPressure(worstRead.oilLow)
  const lowTank =
    capacity > 0 && worstRead.fuelLow !== null
      ? fuelLevel(worstRead.fuelLow / capacity, truck?.fuelWarningFactor ?? 0)
      : null
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

  const byOverall: Record<State, string> = { ok: words.normal, warn: words.check, alarm: words.service }

  const celsius = (value: number) => `${n(Math.round(value))} ${words.celsius}`
  const psi = (value: number) => `${n(Math.round(value))} ${words.psi}`
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

  // The game's own driver hours, in in-game minutes (-1 where the profile has the simulation off).
  const rest = t.restStop
  const breakIn = t.mandatoryBreak
  const hoursState: State = rest >= 0 && rest <= 15 ? 'warn' : 'ok'

  // Only what's lit: an off telltale says nothing a glance needs, and the dash's own lamps are there when they're
  // on. The indicators blink with the truck's.
  const lit: Lit[] = []
  if (t.leftBlinker)
    lit.push({ label: words.indicatorLeft, tone: 'green', blink: true, icon: <path d="M14 5 7 12l7 7" /> })
  if (t.rightBlinker)
    lit.push({ label: words.indicatorRight, tone: 'green', blink: true, icon: <path d="M10 5l7 7-7 7" /> })
  if (t.highBeam) lit.push({ label: words.highBeam, tone: 'blue', icon: <path d="M3 12h8m0-6 4-3v18l-4-3" /> })
  else if (t.lowBeam) lit.push({ label: words.lowBeam, tone: 'blue', icon: <path d="M3 8h6M3 12h8M3 16h6" /> })
  if (t.parkingBrake)
    lit.push({ label: words.parkingBrake, tone: 'red', icon: <path d="M9 17V7h3.5a3.2 3.2 0 0 1 0 6.4H9" /> })
  if (t.retarderLevel > 0)
    lit.push({
      label: `${words.retarder} ${n(t.retarderLevel)}`,
      tone: 'amber',
      icon: <path d="M5 8h14M5 12h14M5 16h9" />,
    })
  if (t.cruiseControlSpeed > 0.5)
    lit.push({
      label: `${words.cruiseControl} ${n(Math.round(t.cruiseControlSpeed * 3.6))} ${words.kmh}`,
      tone: 'green',
      icon: (
        <>
          <circle cx="12" cy="12" r="3" />
          <path d="M12 3v3M12 18v3M3 12h3M18 12h3" />
        </>
      ),
    })

  // The tabs: each page's name, and the tone of the worst reading it holds, so a page worth opening shows it.
  const pages: { id: DiagnosticsPage; label: string; state: State }[] = [
    { id: 'overview', label: words.overview, state: overall },
    { id: 'engine', label: words.engine, state: worst(engineState, fuelState) },
    { id: 'driver', label: words.driverHours, state: hoursState },
    {
      id: 'chassis',
      label: words.chassis,
      state: [brakeState, chassisState, trailerState].reduce(worst, 'ok'),
    },
  ]

  return (
    <section className="app-panel diagnostics-app" aria-label={text.apps.diagnostics}>
      <div className="diag-scroll">
        <div className={animateIn ? 'diag-page' : 'diag-page no-enter'}>
          <header className="diag-header">
            <div className="diag-heading">
              <h1 className="diag-title">{truck ? `${truck.brand} ${truck.name}` : text.apps.diagnostics}</h1>
              <p className="diag-sub">
                {words.gear} {gear} · {t.engineEnabled ? words.running : words.engineOff}
              </p>
            </div>
            <span className={`diag-status ${overall}`}>{byOverall[overall]}</span>
          </header>

          <nav className="diag-tabs app-tabs bar" role="tablist" aria-label={text.apps.diagnostics}>
            {pages.map((tab) => (
              <button
                key={tab.id}
                type="button"
                role="tab"
                aria-selected={page === tab.id}
                className={`diag-tab app-tab ${tab.state}${page === tab.id ? ' on' : ''}`}
                onClick={() => setPage(tab.id)}
              >
                <span className="app-tab-icon" aria-hidden>
                  {TAB_ICONS[tab.id]}
                </span>
                <span className="app-tab-text">
                  <span className="app-tab-label">{tab.label}</span>
                </span>
              </button>
            ))}
          </nav>

          <div className="diag-cards" key={page}>
            {page === 'overview' && (
              <>
                {/* Its name is the Dashboard's Diagnostics widget's too: opened from there, the card becomes this
                    hero (shell/transitions.css), rather than growing out of an icon somewhere else. */}
                <section
                  className="diag-card diag-hero-card"
                  style={{ viewTransitionName: 'widget-diagnostics' }}
                  aria-label={words.overview}
                >
                  <div className="diag-speed">
                    <span className="diag-speed-value">{n(speedShown)}</span>
                    <span className="diag-speed-unit">{words.kmh}</span>
                  </div>
                  <p className="diag-hero-meta">
                    {words.gear} {gear} · {t.engineEnabled ? words.running : words.engineOff} · {words.parkingBrake}{' '}
                    {t.parkingBrake ? words.applied : words.released}
                  </p>
                  {lit.length > 0 && (
                    <div className="diag-warnings">
                      {lit.map((lamp) => (
                        <span
                          key={lamp.label}
                          className={`diag-warning ${lamp.tone}${lamp.blink ? ' blink' : ''}`}
                          role="img"
                          aria-label={lamp.label}
                        >
                          <svg
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            aria-hidden
                          >
                            {lamp.icon}
                          </svg>
                          <span>{lamp.label}</span>
                        </span>
                      ))}
                    </div>
                  )}
                </section>

                <Card title={words.overview}>
                  <div className="diag-glance">
                    <Cell
                      read={heat}
                      label={words.coolant}
                      value={n(Math.round(t.coolantTemperature))}
                      unit={words.celsius}
                    />
                    <Cell
                      read={air}
                      label={words.brakeAir}
                      value={n(Math.round(t.brakeAirPressure))}
                      unit={words.psi}
                    />
                    <Cell
                      read={volts}
                      label={words.battery}
                      value={n(Math.round(t.batteryVoltage * 10) / 10)}
                      unit={words.volts}
                    />
                    <Cell read={fuel} label={words.fuel} value={n(Math.round(t.fuel))} unit={words.litres} />
                  </div>
                </Card>

                <Card title={words.trip}>
                  <div className="diag-trip">
                    <Stat label={words.distance} value={`${n(Math.round(trip.distance))} ${words.km}`} />
                    <Stat label={words.used} value={`${n(Math.round(trip.fuel * 10) / 10)} ${words.litres}`} />
                    <Stat
                      label={words.average}
                      value={`${n(Math.round(tripAverage(trip) * 10) / 10)} ${words.lPer100}`}
                      state={economy.state}
                    />
                    <Stat label={words.time} value={clock(trip.moving + trip.idle)} />
                  </div>
                  <button type="button" className="diag-reset" onClick={trends.reset}>
                    {words.reset}
                  </button>
                </Card>

                <Card title={words.sinceStart} wide>
                  <div className="diag-rows">
                    <Row
                      label={`${words.coolant} · ${words.high}`}
                      value={worstRead.coolantPeak === null ? words.off : celsius(worstRead.coolantPeak)}
                      state={peakHeat?.state}
                    />
                    <Row
                      label={`${words.brakeAir} · ${words.low}`}
                      value={worstRead.airLow === null ? words.off : psi(worstRead.airLow)}
                      state={lowAir?.state}
                    />
                    <Row
                      label={`${words.oilPressure} · ${words.low}`}
                      value={worstRead.oilLow === null ? words.off : psi(worstRead.oilLow)}
                      state={lowOil?.state}
                    />
                    <Row
                      label={`${words.fuel} · ${words.low}`}
                      value={
                        worstRead.fuelLow === null ? words.off : `${n(Math.round(worstRead.fuelLow))} ${words.litres}`
                      }
                      state={lowTank?.state}
                    />
                    <Row label={words.warnings} value={n(worstRead.warnings)} />
                  </div>
                </Card>
              </>
            )}

            {page === 'engine' && (
              <>
                <Card title={words.engine}>
                  <Lead
                    read={heat}
                    value={n(Math.round(t.coolantTemperature))}
                    unit={words.celsius}
                    label={words.coolant}
                  />
                  <Sparkline values={trends.coolant} />
                  <div className="diag-rows">
                    <Row label={words.oil} value={celsius(t.oilTemperature)} state={oilHeat.state} />
                    <Row label={words.oilPressure} value={psi(t.oilPressure)} state={pressure.state} />
                    <Row
                      label={words.battery}
                      value={`${n(Math.round(t.batteryVoltage * 10) / 10)} ${words.volts}`}
                      state={volts.state}
                    />
                    <Row
                      label={words.rpm}
                      value={t.engineEnabled ? `${n(Math.round(t.engineRpm))} rpm` : words.stopped}
                    />
                  </div>
                </Card>

                <Card title={words.fuel}>
                  <Lead read={fuel} value={n(Math.round(t.fuel))} unit={words.litres} label={words.fuel} />
                  <div className="diag-rows">
                    <Row label={words.range} value={`${n(Math.round(t.fuelRange))} ${words.km}`} />
                    <Row
                      label={words.consumption}
                      value={`${n(Math.round(t.fuelAverage * 10) / 10)} ${words.lPer100}`}
                      state={economy.state}
                    />
                    <Row label={words.adblue} value={`${n(Math.round(t.adblue))} ${words.litres}`} state={urea.state} />
                    <Row label={words.odometer} value={`${n(Math.round(t.odometer))} ${words.km}`} />
                  </div>
                </Card>

                <Card title={words.brakes} wide>
                  <Lead
                    read={air}
                    value={n(Math.round(t.brakeAirPressure))}
                    unit={words.psi}
                    label={words.airPressure}
                  />
                  <Sparkline values={trends.brakes} />
                  <div className="diag-rows">
                    <Row label={words.brakeTemperature} value={celsius(t.brakeTemperature)} state={brakeHeat.state} />
                    <Row label={words.retarder} value={t.retarderLevel > 0 ? n(t.retarderLevel) : words.off} />
                    <Row label={words.parkingBrake} value={t.parkingBrake ? words.applied : words.released} />
                  </div>
                </Card>
              </>
            )}

            {page === 'driver' && (
              <>
                <Card title={words.driverHours}>
                  <div className="diag-rows">
                    <Row
                      label={words.restStop}
                      value={rest >= 0 ? inMinutes(rest) : words.noRest}
                      state={rest >= 0 && rest <= 15 ? 'warn' : 'ok'}
                    />
                    <Row label={words.mandatoryBreak} value={breakIn >= 0 ? inMinutes(breakIn) : words.noRest} />
                    <Row label={words.time} value={clock(trip.moving + trip.idle)} />
                    <Row label={words.distance} value={`${n(Math.round(trip.distance))} ${words.km}`} />
                  </div>
                </Card>

                <Card title={words.controls}>
                  <div className="diag-rows">
                    <Row label={words.cruiseControl} value={cruise} />
                    <Row label={words.retarder} value={retarder} />
                    <Row label={words.parkingBrake} value={t.parkingBrake ? words.applied : words.released} />
                    <Row label={words.lights} value={lights} />
                    <Row label={words.hazardLights} value={t.hazard ? words.on : words.off} />
                    <Row label={words.wipers} value={t.wipers ? words.on : words.off} />
                  </div>
                </Card>
              </>
            )}

            {page === 'chassis' && (
              <>
                <Card title={words.wear}>
                  <div className="diag-wear">
                    <Wear label={words.wearEngine} read={engineWear} />
                    <Wear label={words.wearTransmission} read={gearboxWear} />
                    <Wear label={words.wearChassis} read={chassisWear} />
                    <Wear label={words.tires} read={tireWear} />
                    <Wear label={words.wearCabin} read={cabWear} />
                  </div>
                </Card>

                <Card title={words.trailer}>
                  {t.trailerAttached ? (
                    <>
                      <div className="diag-lead">
                        <span className="diag-value">{trailer?.name || words.hitched}</span>
                        <span className="diag-label">{trailer?.brand || words.trailer}</span>
                      </div>
                      <div className="diag-rows">
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
              </>
            )}
          </div>
        </div>
      </div>
    </section>
  )
}

/** A card: its name, then its readings. Half the width, or the whole of it. */
function Card({ title, wide = false, children }: { title: string; wide?: boolean; children: ReactNode }) {
  return (
    <section className={`diag-card${wide ? ' span-12' : ' span-6'}`}>
      <h2 className="diag-card-title">{title}</h2>
      {children}
    </section>
  )
}

/** The reading a card is about: its value and unit, its name under them, and its gauge. */
function Lead({ read, value, unit, label }: { read: Reading; value: string; unit: string; label: string }) {
  return (
    <div className="diag-lead">
      <div className="diag-reading">
        <span className={`diag-value${read.state === 'ok' ? '' : ` ${read.state}`}`}>{value}</span>
        <span className="diag-unit">{unit}</span>
      </div>
      <div className="diag-label">{label}</div>
      {/* A reading with no range of its own (a truck whose tank the game doesn't measure) has no gauge. */}
      {read.percent > 0 && (
        <div className={`diag-meter ${read.state}`} aria-hidden>
          <span style={{ width: `${Math.round(read.percent * 100)}%` }} />
        </div>
      )}
    </div>
  )
}

/** One of the four readings a driver watches without thinking. */
function Cell({ read, label, value, unit }: { read: Reading; label: string; value: string; unit: string }) {
  return (
    <div className={`diag-cell ${read.state}`}>
      <span className="diag-cell-label">{label}</span>
      <span className="diag-cell-value">
        {value}
        <span className="diag-cell-unit">{unit}</span>
      </span>
    </div>
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

/** Another reading of a card: its name on the left, its value on the right, toned when it's worth watching. */
function Row({ label, value, state }: { label: string; value: string; state?: State }) {
  return (
    <div className="diag-row">
      <span className="diag-row-label">{label}</span>
      <span className={`diag-row-value${state && state !== 'ok' ? ` ${state}` : ''}`}>{value}</span>
    </div>
  )
}

/** A part of the truck and how worn it is: its share of life left, from new to worn out. */
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
