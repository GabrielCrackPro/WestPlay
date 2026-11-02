import { useEffect, useRef, useState } from 'react'
import { cabClock } from '../../shared/host'
import { formatGameTime } from '../../shared/format'
import { useLive } from '../state/store'
import { useText } from '../state/text'
import { type Note, useNotes } from './notesShown'
import { playCue } from '../state/sound'
import './notifications.css'

/**
 * The game's own warnings and rest clocks, as notes over the app: the volume HUD's shape (a glass pill that
 * comes and goes, nothing to press), stacked under where the volume shows. Each is raised once as it comes on,
 * with the reading it's about, so the cab says what the truck's dash is saying without the driver opening
 * Diagnostics to find out.
 */
export function Notifications() {
  const notes = useNotes((state) => state.notes)
  const leaving = useLeaving(notes)
  useNoteCue(notes)
  useGameAlerts()
  return (
    <div className={notes.length + leaving.length > 0 ? 'notifications shown' : 'notifications'} aria-live="polite">
      {notes.map((note) => (
        <NotePill key={note.key} note={note} />
      ))}
      {/* The ones just taken down, still there to fade out (a note that vanished mid-read is a note missed). */}
      {leaving.map((note) => (
        <NotePill key={`${note.key}:out`} note={note} leaving />
      ))}
    </div>
  )
}

/**
 * The chime as a note comes up: soft for a warning, firmer for an alarm (state/sound.ts). Only when the stack grows,
 * so a note leaving (and the one under it becoming the newest) says nothing.
 */
function useNoteCue(notes: { tone: 'warn' | 'alarm' }[]): void {
  const count = useRef(0)
  useEffect(() => {
    const added = notes.length > count.current
    count.current = notes.length
    if (!added) return
    playCue(notes.at(-1)?.tone === 'alarm' ? 'alarm' : 'note')
  }, [notes])
}

/** How long a note that has gone stays up to fade out, ms (notifications.css' note-out). */
const NOTE_OUT_MS = 220

/** One note's pill. */
function NotePill({ note, leaving = false }: { note: Note; leaving?: boolean }) {
  const words = useText().notificationsApp
  return (
    <div className={`notification ${note.tone}${leaving ? ' leaving' : ''}`} aria-hidden={leaving || undefined}>
      <span className="notification-icon" aria-hidden>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
          {note.tone === 'alarm' ? (
            <>
              <circle cx="12" cy="12" r="9" />
              <path d="M12 7.5v5.5m0 3h.01" />
            </>
          ) : (
            <>
              <path d="m10.3 4.7-7.1 12.4A2 2 0 0 0 5 20h14a2 2 0 0 0 1.8-2.9L13.7 4.7a2 2 0 0 0-3.4 0Z" />
              <path d="M12 9v4m0 3h.01" />
            </>
          )}
        </svg>
      </span>
      <span className="notification-copy">
        <span className="notification-level">{note.tone === 'alarm' ? words.alert : words.warning}</span>
        <span className="notification-title">{note.title}</span>
      </span>
      <span className="notification-detail">{note.detail}</span>
    </div>
  )
}

/**
 * The notes that have just gone, kept for a moment so they can be seen out: the store drops one the instant it's
 * taken down (its timer, a new one pushing it off the stack), and an element that leaves the page can't animate.
 */
function useLeaving(notes: Note[]): Note[] {
  const [leaving, setLeaving] = useState<Note[]>([])
  const shown = useRef<Note[]>(notes)
  useEffect(() => {
    const before = shown.current
    shown.current = notes
    const gone = before.filter((note) => !notes.some((each) => each.key === note.key))
    if (gone.length === 0) return
    setLeaving((kept) => [...kept.filter((note) => !gone.some((each) => each.key === note.key)), ...gone])
    const timer = setTimeout(() => {
      setLeaving((kept) => kept.filter((note) => !gone.some((each) => each.key === note.key)))
    }, NOTE_OUT_MS)
    return () => clearTimeout(timer)
  }, [notes])
  return leaving
}

/** How long a reading must stay right before a warning on it may be raised again, ms. */
const WARN_HOLD_MS = 3000

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
  // The readings that have already had their note, by key: `null` while the note stands, or the timer that forgets
  // a reading that has just gone right again (WARN_HOLD_MS below).
  const raised = useRef(new Map<string, ReturnType<typeof setTimeout> | null>())
  // The game's route as the store has it: a new one while driving (its own reroute, a stop added, a waypoint
  // reached) gets a note, with the arrival it now has, so a changed ETA isn't a mystery.
  const routeId = useLive((state) => state.route?.id ?? null)
  const routed = useRef<number | null>(null)
  useEffect(() => {
    const before = routed.current
    routed.current = routeId
    // A route only counts as changed while one was there before: not as this mounts, and not as the effect runs
    // again for another reason (a new language's words), which raised a note for a route that hadn't changed.
    if (before === null || routeId === null || before === routeId) return
    const state = useLive.getState()
    const current = state.telemetry
    if (!current || current.navigationDistance <= 0) return
    const arrival = formatGameTime(Math.round(cabClock(current, state.clockShift) + current.navigationTime / 60))
    useNotes.getState().push(
      {
        key: 'reroute',
        title: text.destinations.routeChanged,
        detail: `${arrival} ${text.arrival}`,
        tone: 'warn',
      },
      // The game's clock, as the rest of the list keeps it (without this the app showed the player's own time in a
      // column that is the game's).
      { at: Date.now(), clock: cabClock(current, state.clockShift) },
    )
  }, [routeId, text])

  // A note's timer outlives the effect that set it: the component going takes them with it.
  useEffect(() => {
    const timers = raised.current
    return () => {
      for (const timer of timers.values()) if (timer) clearTimeout(timer)
    }
  }, [])

  useEffect(() => {
    if (!telemetry) {
      for (const timer of raised.current.values()) if (timer) clearTimeout(timer)
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
      const held = raised.current.get(key)
      if (!on) {
        // Gone right: it may be raised again, but only once it has stayed right for a moment (a sensor that
        // flickers at the pump, or an oil pressure that dips at idle, doesn't stack note after note).
        if (held === undefined || held !== null) return
        raised.current.set(
          key,
          setTimeout(() => raised.current.delete(key), WARN_HOLD_MS),
        )
        return
      }
      if (held === undefined) raised.current.set(key, null)
      else if (held !== null) {
        // Back within the hold: the same fault as before, not a new one.
        clearTimeout(held)
        raised.current.set(key, null)
        return
      } else return
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
