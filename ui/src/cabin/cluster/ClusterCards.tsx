import type { ClusterReading } from '../state/store'
import { useText } from '../state/text'
import { ClockIcon, DropIcon, FuelIcon, GaugeIcon, OdometerIcon, RangeIcon, RestIcon, TripIcon } from './ClusterIcons'
import { type ClusterCardViews, meterZone } from './clusterCardViews'

/**
 * The cluster's side cards and the figures they carry, worked out once for both places that draw them: the dash itself
 * (ClusterScreen) and the layout's miniature (Settings › Instrument Cluster). The miniature is not a sketch of the
 * cards but the same components in their compact form, so a reading added, relabelled or given a new source shows in
 * both at once — the dash and the picture of it can't disagree.
 */

interface CardBodyProps {
  views: ClusterCardViews
  /** The Settings preview's compact form of the same card, rather than the dash's own. */
  compact?: boolean
}

/** The trip card's body: the drive since the engine came on, its average and time, and the odometer under them. */
export function TripCardBody({ views, compact = false }: CardBodyProps) {
  const words = useText().diagnostics
  const { trip } = views
  if (compact)
    return (
      <>
        <span className="cluster-layout-value">
          <b>{views.live ? trip.distance.value : '—'}</b>
          <small>{trip.distance.unit}</small>
        </span>
        <span className="cluster-layout-pair">
          <GaugeIcon />
          <b>{views.live ? trip.average.value : '—'}</b>
          <small>{trip.average.unit}</small>
        </span>
      </>
    )
  return (
    <>
      <div className="cluster-trip-top">
        <span className="cluster-glyph" aria-hidden>
          <TripIcon />
        </span>
        <strong className="cluster-trip-value">
          {views.live ? trip.distance.value : '—'}
          <small>{trip.distance.unit}</small>
        </strong>
      </div>
      <div className="cluster-pairs">
        <span className="cluster-pair" aria-label={`${words.average} ${trip.average.value} ${trip.average.unit}`}>
          <GaugeIcon />
          <b>{views.live ? trip.average.value : '—'}</b>
          <small>{trip.average.unit}</small>
        </span>
        {/* The trip's time on the move, not the range: the tank's range is already on the fuel panel's foot, and a
            figure the dash shows twice is a slot it can't show something else in. */}
        <span
          className="cluster-pair"
          aria-label={views.live ? `${words.time} ${trip.driving.value} ${trip.driving.unit}` : undefined}
        >
          <ClockIcon />
          <b>{views.live ? trip.driving.value : '—'}</b>
          <small>{views.live ? trip.driving.unit : ''}</small>
        </span>
      </div>
      <div
        className="cluster-odo"
        aria-label={`${words.odometer} ${views.live ? trip.odometer.value : 0} ${trip.odometer.unit}`}
      >
        <OdometerIcon />
        <b>{views.live ? trip.odometer.value : '—'}</b>
        <small>{trip.odometer.unit}</small>
      </div>
    </>
  )
}

interface EngineCardBodyProps extends CardBodyProps {
  /** The three gauges the settings chose for the card's slots. */
  slots: readonly ClusterReading[]
  /** In the preview, the slot whose picker is open. */
  picking?: number | null
  /** In the preview the readings are the card's own controls: a press opens the picker at that slot. */
  onPick?: (slot: number, element: HTMLElement) => void
}

/** The engine card's body: the three readings the settings chose, each with its own mark and warning colour. */
export function EngineCardBody({ views, slots, compact = false, picking = null, onPick }: EngineCardBodyProps) {
  const text = useText()
  return (
    <>
      {slots.map((reading, slot) => {
        const view = views.readings[reading]
        const shown = views.live ? view.figure.value : '—'
        if (!compact)
          return (
            <div
              key={reading}
              className="cluster-readout"
              data-warn={view.warn ? '' : undefined}
              data-cold={view.cold ? '' : undefined}
              aria-label={`${view.label} ${views.live ? view.figure.value : 0} ${view.figure.unit}`}
            >
              <span className="cluster-glyph" aria-hidden>
                {view.icon}
              </span>
              <b>{shown}</b>
              <small>{view.figure.unit}</small>
            </div>
          )
        const value = views.live ? `${view.figure.value} ${view.figure.unit}` : '—'
        const content = (
          <>
            <span className="cluster-layout-reading-icon" aria-hidden>
              {view.icon}
            </span>
            <b>{shown}</b>
            <small>{view.figure.unit}</small>
            {onPick && (
              <span className="cluster-layout-reading-chevron" aria-hidden>
                <svg viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.6">
                  <path d="m2.5 4.5 3.5 3.5 3.5-3.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </span>
            )}
          </>
        )
        if (!onPick)
          return (
            <span key={reading} className="cluster-layout-reading" data-warn={view.warn ? '' : undefined}>
              {content}
            </span>
          )
        return (
          <button
            key={reading}
            type="button"
            className="cluster-layout-reading"
            data-warn={view.warn ? '' : undefined}
            aria-haspopup="dialog"
            aria-expanded={picking === slot}
            aria-label={`${text.settings.clusterReadingSlot(slot + 1)}: ${view.pickerLabel} ${value}`}
            title={view.pickerLabel}
            // The reading is the card's own control: a press here chooses a gauge rather than taking the card off the dash.
            onPointerDown={(event) => event.stopPropagation()}
            onClick={(event) => {
              event.stopPropagation()
              onPick(slot, event.currentTarget)
            }}
          >
            {content}
          </button>
        )
      })}
    </>
  )
}

/** The driver's clocks: the next rest stop, and the time left on the job's delivery window. */
export function HoursCardBody({ views, compact = false }: CardBodyProps) {
  const text = useText()
  const words = text.diagnostics
  const rows = [
    {
      key: 'rest',
      icon: <RestIcon />,
      value: views.hours.rest,
      due: views.hours.restDue,
      label: `${words.restStop} ${views.hours.rest ?? words.noRest}`,
    },
    {
      key: 'job',
      icon: <ClockIcon />,
      value: views.hours.job,
      due: views.hours.jobDue,
      label: `${text.delivery} ${views.hours.job ?? words.noJob}`,
    },
  ]
  return (
    <>
      {rows.map((row) =>
        compact ? (
          <span key={row.key} className="cluster-layout-pair" aria-label={row.label}>
            {row.icon}
            <b>{row.value ?? '—'}</b>
          </span>
        ) : (
          <div key={row.key} className="cluster-hours-row" data-due={row.due ? '' : undefined} aria-label={row.label}>
            <span className="cluster-glyph" aria-hidden>
              {row.icon}
            </span>
            <strong>{row.value ?? '—'}</strong>
            <span className="cluster-dot" aria-hidden />
          </div>
        ),
      )}
    </>
  )
}

/** The tank's card: its gauge, the figure the settings read it as, and the range and fuel used under it. */
export function FuelCardBody({ views, compact = false }: CardBodyProps) {
  const words = useText().diagnostics
  const fuel = views.fuel
  const shown = views.live ? fuel.figure.value : '—'
  if (compact)
    return (
      <>
        <span className="cluster-layout-value">
          <b>{shown}</b>
          <small>{fuel.figure.unit}</small>
        </span>
        <span className="cluster-layout-gauge" aria-hidden>
          <i style={{ width: `${Math.round((fuel.share ?? 0) * 100)}%` }} />
        </span>
        <span className="cluster-layout-pair">
          <RangeIcon />
          <b>{views.live ? fuel.range.value : '—'}</b>
          <small>{fuel.range.unit}</small>
        </span>
      </>
    )
  return (
    <>
      <div className="cluster-gauge-row">
        <span className="cluster-glyph" data-warn={fuel.reading?.state === 'alarm' ? '' : undefined} aria-hidden>
          <FuelIcon />
        </span>
        <div
          className="cluster-meter"
          data-scale="level"
          data-hot={fuel.reading?.state === 'warn' ? '' : undefined}
          data-low={fuel.reading?.state === 'alarm' ? '' : undefined}
          {...meterZone(fuel.reading, 'low')}
        >
          <span style={{ width: `${Math.round((fuel.share ?? 0) * 100)}%` }} />
        </div>
        <strong
          className="cluster-gauge-value"
          data-hot={fuel.reading?.state === 'warn' ? '' : undefined}
          data-warn={fuel.reading?.state === 'alarm' ? '' : undefined}
        >
          {shown}
          <small>{fuel.figure.unit}</small>
        </strong>
      </div>
      <div
        className="cluster-gauge-foot"
        aria-label={`${words.range} ${views.live ? fuel.range.value : 0} ${fuel.range.unit} · ${words.used} ${
          views.live ? fuel.used.value : 0
        } ${fuel.used.unit}`}
      >
        <span className="cluster-foot-pair" aria-hidden>
          <RangeIcon />
          <b>{views.live ? fuel.range.value : '—'}</b>
          <small>{fuel.range.unit}</small>
        </span>
        <span className="cluster-foot-pair" aria-hidden>
          <DropIcon />
          <b>{views.live ? fuel.used.value : '—'}</b>
          <small>{fuel.used.unit}</small>
        </span>
      </div>
    </>
  )
}
