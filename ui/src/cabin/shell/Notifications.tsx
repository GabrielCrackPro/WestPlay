import { useEffect, useRef } from 'react'
import { cabClock } from '../../shared/host'
import { useLive } from '../state/store'
import { useText } from '../state/text'
import { useNotes } from './notesShown'
import './notifications.css'

/**
 * The game's own warnings and rest clocks, as notes over the app: the volume HUD's shape (a glass pill that
 * comes and goes, nothing to press), stacked under where the volume shows. Each is raised once as it comes on,
 * with the reading it's about, so the cab says what the truck's dash is saying without the driver opening
 * Diagnostics to find out.
 */
export function Notifications() {
  const notes = useNotes((state) => state.notes)
  useGameAlerts()
  return (
    <div className={notes.length > 0 ? 'notifications shown' : 'notifications'} aria-live="polite">
      {notes.map((note) => (
        <div key={note.key} className={`notification ${note.tone}`}>
          <span className="notification-title">{note.title}</span>
          <span className="notification-detail">{note.detail}</span>
        </div>
      ))}
    </div>
  )
}

/**
 * Watches the game for the moments worth a note: its own warning channels (battery, oil pressure, brake air,
 * fuel, AdBlue) as they come on, and the two rest clocks (a rest stop, a mandatory break) at a quarter of an
 * hour out. A telemetry frame is sent twenty times a second, so each is raised on its rising edge only — a
 * warning that stays on is one note, not a hundred.
 */
function useGameAlerts() {
  const text = useText()
  const telemetry = useLive((state) => state.telemetry)
  const clockShift = useLive((state) => state.clockShift)
  // The readings that have already had their note (cleared as each goes right again).
  const raised = useRef(new Set<string>())

  useEffect(() => {
    if (!telemetry) {
      raised.current.clear()
      return
    }
    // What the history keeps of each note: the player's clock, and the game's (the clock the rest is counted in).
    const when = { at: Date.now(), clock: cabClock(telemetry, clockShift) }
    const words = text.diagnostics
    const n = text.number
    const psi = (value: number) => `${n(Math.round(value))} ${words.psi}`
    const litres = (value: number) => `${n(Math.round(value))} ${words.litres}`
    // Minutes as the cab writes them: "1 h 30", or "12 min".
    const minutes = (value: number) =>
      value >= 60
        ? `${n(Math.floor(value / 60))} ${words.hours} ${String(Math.floor(value % 60)).padStart(2, '0')}`
        : `${n(Math.round(value))} ${words.minutes}`
    const raise = (key: string, on: boolean, title: string, detail: string, tone: 'warn' | 'alarm') => {
      if (!on) {
        raised.current.delete(key)
        return
      }
      if (raised.current.has(key)) return
      raised.current.add(key)
      useNotes.getState().push({ key, title, detail, tone }, when)
    }

    raise(
      'battery',
      telemetry.batteryWarning,
      words.battery,
      `${n(Math.round(telemetry.batteryVoltage * 10) / 10)} ${words.volts}`,
      'alarm',
    )
    raise('oilPressure', telemetry.oilPressureWarning, words.oilPressure, psi(telemetry.oilPressure), 'alarm')
    raise('brakeAir', telemetry.brakeAirWarning, words.brakeAir, psi(telemetry.brakeAirPressure), 'alarm')
    raise('fuel', telemetry.fuelWarning, words.fuel, litres(telemetry.fuel), 'alarm')
    raise('adblue', telemetry.adblueWarning, words.adblue, litres(telemetry.adblue), 'alarm')
    const rest = telemetry.restStop
    const mandatoryBreak = telemetry.mandatoryBreak
    raise('rest', rest >= 0 && rest <= 15, words.restStop, minutes(Math.max(0, rest)), 'warn')
    raise(
      'mandatoryBreak',
      mandatoryBreak >= 0 && mandatoryBreak <= 15,
      words.mandatoryBreak,
      minutes(Math.max(0, mandatoryBreak)),
      'warn',
    )
  }, [telemetry, text, clockShift])
}
