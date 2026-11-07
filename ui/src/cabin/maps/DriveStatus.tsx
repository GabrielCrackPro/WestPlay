import { useLive } from '../state/store'
import { useText } from '../state/text'

/** The truck's own state over the map: the hazard warning lights, and the cruise control's set speed. */
export function DriveStatus() {
  const text = useText()
  const hazard = useLive((state) => state.telemetry?.hazard ?? false)
  const cruise = useLive((state) => state.telemetry?.cruiseControlSpeed ?? 0)
  const speed = Math.round(cruise * 3.6)
  if (!hazard && cruise <= 0.5) return null
  return (
    <div className="drive-status" role="group">
      {hazard && (
        <span className="drive-badge hazard" aria-label={text.diagnostics.hazardLights}>
          <HazardGlyph />
        </span>
      )}
      {cruise > 0.5 && (
        <span
          className="drive-badge cruise"
          aria-label={`${text.diagnostics.cruiseControl} ${speed} ${text.diagnostics.kmh}`}
        >
          <CruiseGlyph />
          <span>{speed}</span>
        </span>
      )}
    </div>
  )
}

function HazardGlyph() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden>
      <path d="M12 3.5 22 20.5H2Z" />
      <path d="M12 9.5v4.8M12 17.6v.4" />
    </svg>
  )
}

function CruiseGlyph() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden>
      <path d="M4 17a8 8 0 1 1 16 0" />
      <path d="m12 17 4.2-5" />
    </svg>
  )
}
