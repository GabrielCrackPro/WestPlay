import { useEffect, useRef, useState } from 'react'
import { cabClock, type PhoneNotification } from '../../shared/host'
import { formatGameTime, formatRealTime } from '../../shared/format'
import { sendPhoneCommand, usePhoneToasts, wantPhoneTab } from '../apps/phone/phone'
import { NotificationsTabIcon } from '../apps/phone/tabIcons'
import { go, useCabin, useLive } from '../state/store'
import { useText } from '../state/text'
import { type Note, type NoteAction, useNotes } from './notesShown'
import { playCue } from '../state/sound'
import './notifications.css'

/**
 * The cab's notifications, in one stack at the top of the screen: the game's own warnings and rest clocks (raised
 * by `useGameAlerts` below), and the paired phone's notifications as they come (`apps/phone/phone.ts` announces
 * them). Each is a glass card of the same shape — a mark, what it is, what it says, and what it can open — so a
 * warning and a message are read the same way at the wheel. The phone's list is the Phone app's own drawing, so
 * nothing repeats over it.
 */
export function Notifications() {
  const notes = useNotes((state) => state.notes)
  const latest = useNotes((state) => state.history[0])
  const leavingNotes = useLeaving(notes, noteKey)
  const route = useCabin((state) => state.navigation.route)
  const handedOver = useCabin((state) => state.truckScreen)
  const toasts = usePhoneToasts((state) => state.toasts)
  const dropToast = usePhoneToasts((state) => state.drop)
  const inPhoneApp = route.kind === 'app' && route.app === 'phone'
  const phoneNotes = inPhoneApp || handedOver ? NO_TOASTS : toasts
  const leavingPhone = useLeaving(phoneNotes, toastKey)
  useNoteCue(latest)
  useGameAlerts()
  const shown = notes.length + leavingNotes.length + phoneNotes.length + leavingPhone.length > 0
  return (
    <div className={shown ? 'notifications shown' : 'notifications'} aria-live="polite">
      {notes.map((note) => (
        <NotePill key={note.key} note={note} />
      ))}
      {/* The ones just taken down, still there to fade out (a note that vanished mid-read is a note missed). */}
      {leavingNotes.map((note) => (
        <NotePill key={`${note.key}:out`} note={note} leaving />
      ))}
      {/* The phone's: oldest first, so the newest message is the last of them, nearest the app underneath. */}
      {phoneNotes
        .slice()
        .reverse()
        .map((notification) => (
          <PhoneCard key={notification.id} notification={notification} onDrop={dropToast} />
        ))}
      {leavingPhone
        .slice()
        .reverse()
        .map((notification) => (
          <PhoneCard key={`${notification.id}:out`} notification={notification} leaving onDrop={dropToast} />
        ))}
    </div>
  )
}

const NO_TOASTS: PhoneNotification[] = []

/** A note's key in the stack, and a phone notification's id (both stable for the item they belong to). */
function noteKey(note: Note): string {
  return note.key
}

function toastKey(notification: PhoneNotification): string {
  return notification.id
}

/**
 * The chime as a note is recorded: soft for a warning, firmer for an alarm (state/sound.ts). Dismissing a note
 * leaves the newest history entry alone, so the pill underneath becoming newest says nothing.
 */
function useNoteCue(note: { id: number; tone: 'warn' | 'alarm' } | undefined): void {
  const lastId = useRef(note?.id ?? 0)
  useEffect(() => {
    if (!note || note.id === lastId.current) return
    lastId.current = note.id
    playCue(note.tone === 'alarm' ? 'alarm' : 'note')
  }, [note])
}

/** How long a note that has gone stays up to fade out, ms (notifications.css' note-out). */
const NOTE_OUT_MS = 220

/** One of the truck's notes: its warning, what it's about, the reading now, and where it can be read in full. */
function NotePill({ note, leaving = false }: { note: Note; leaving?: boolean }) {
  const text = useText()
  const words = text.notificationsApp
  const dismiss = useNotes((state) => state.dismiss)
  const action = !leaving && note.action ? note.action : null
  const open = (what: NoteAction) => {
    if (what === 'maps') go({ type: 'openApp', app: 'maps' })
    else {
      useCabin.getState().setDiagnosticsPage('overview')
      go({ type: 'openApp', app: 'diagnostics' })
    }
    dismiss(note.key)
  }
  return (
    <div
      className={`notification ${note.tone}${leaving ? ' leaving' : ''}${action ? ' actionable' : ''}`}
      aria-hidden={leaving || undefined}
    >
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
      <span className="notification-side">
        <span className="notification-detail">{note.detail}</span>
        {action && (
          <button type="button" className="notification-action" onClick={() => open(action)}>
            {action === 'maps' ? words.openMaps : words.openDiagnostics}
            <span aria-hidden>›</span>
          </button>
        )}
      </span>
      {!leaving && (
        <button
          type="button"
          className="notification-close"
          aria-label={`${words.dismiss}: ${note.title}`}
          onClick={() => dismiss(note.key)}
        >
          <Cross />
        </button>
      )}
    </div>
  )
}

/**
 * One notification the phone posted: its app, its words, its time, and its own buttons ("Reply", "Mark as read"),
 * with the way into the Phone app for the rest. A message Android rates high (or an alarm, a call) keeps the
 * alarm's red; the rest the phone's blue.
 */
function PhoneCard({
  notification,
  leaving = false,
  onDrop,
}: {
  notification: PhoneNotification
  leaving?: boolean
  onDrop(id: string): void
}) {
  const text = useText()
  const words = text.phoneApp
  // The app opens on its notifications list, where the whole message and its reply are.
  const open = () => {
    wantPhoneTab('notifications')
    go({ type: 'openApp', app: 'phone' })
  }
  const time = notification.time !== undefined ? formatRealTime(notification.time * 1000) : null
  const actions = notification.actions ?? []
  const urgent =
    (notification.priority ?? 0) >= 2 || notification.category === 'alarm' || notification.category === 'call'
  const title = notification.title ?? notification.text ?? notification.app
  // A title with a line under it: the notification's own two parts. Just one of them is the title.
  const body = notification.title ? notification.text : undefined
  return (
    <div
      className={`notification phone${urgent ? ' alarm' : ''}${leaving ? ' leaving' : ''}`}
      aria-hidden={leaving || undefined}
    >
      <span className="notification-icon" aria-hidden>
        <NotificationsTabIcon />
      </span>
      <span className="notification-copy">
        <span className="notification-level">{notification.app}</span>
        <span className="notification-title">{title}</span>
        {body && <span className="notification-text">{body}</span>}
      </span>
      <span className="notification-side">
        {time && <span className="notification-detail">{time}</span>}
        {!leaving && (
          <button type="button" className="notification-action" onClick={open}>
            {text.apps.phone}
            <span aria-hidden>›</span>
          </button>
        )}
      </span>
      {/* The phone's own buttons. A reply needs words the cab's small card can't take, so it opens the app. */}
      {!leaving && actions.length > 0 && (
        <span className="notification-actions">
          {actions.map((action, index) => (
            <button
              key={`${action.label}-${index}`}
              type="button"
              className="notification-chip"
              onClick={() => {
                if (action.reply) open()
                else sendPhoneCommand({ action: 'action', id: notification.id, index })
              }}
            >
              {action.label}
            </button>
          ))}
        </span>
      )}
      {!leaving && (
        <button
          type="button"
          className="notification-close"
          aria-label={`${words.dismiss}: ${title}`}
          onClick={() => onDrop(notification.id)}
        >
          <Cross />
        </button>
      )}
    </div>
  )
}

/** A card's cross. */
function Cross() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path d="m6.5 6.5 11 11M17.5 6.5l-11 11" strokeLinecap="round" />
    </svg>
  )
}

/**
 * The items that have just gone, kept for a moment so they can be seen out: the store drops one the instant it's
 * taken down (its timer, a new one pushing it off the stack), and an element that leaves the page can't animate.
 */
function useLeaving<T>(items: T[], keyOf: (item: T) => string): T[] {
  const [leaving, setLeaving] = useState<T[]>([])
  const shown = useRef<T[]>(items)
  useEffect(() => {
    const before = shown.current
    shown.current = items
    const gone = before.filter((item) => !items.some((each) => keyOf(each) === keyOf(item)))
    if (gone.length === 0) return
    setLeaving((kept) => [...kept.filter((item) => !gone.some((each) => keyOf(each) === keyOf(item))), ...gone])
    const timer = setTimeout(() => {
      setLeaving((kept) => kept.filter((item) => !gone.some((each) => keyOf(each) === keyOf(item))))
    }, NOTE_OUT_MS)
    return () => clearTimeout(timer)
  }, [items, keyOf])
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
        action: 'maps',
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
    const raise = (
      key: string,
      on: boolean,
      title: string,
      detail: string,
      tone: 'warn' | 'alarm',
      action: NoteAction,
    ) => {
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
      useNotes.getState().push({ key, title, detail, tone, action }, when)
    }

    raise(
      'battery',
      telemetry.batteryWarning,
      words.battery,
      `${n(Math.round(telemetry.batteryVoltage * 10) / 10)} ${words.volts}`,
      'alarm',
      'diagnostics',
    )
    raise(
      'oilPressure',
      telemetry.oilPressureWarning,
      words.oilPressure,
      psi(telemetry.oilPressure),
      'alarm',
      'diagnostics',
    )
    raise(
      'brakeAir',
      telemetry.brakeAirWarning,
      words.brakeAir,
      psi(telemetry.brakeAirPressure),
      'alarm',
      'diagnostics',
    )
    raise('fuel', telemetry.fuelWarning, words.fuel, litres(telemetry.fuel), 'alarm', 'maps')
    raise('adblue', telemetry.adblueWarning, words.adblue, litres(telemetry.adblue), 'alarm', 'maps')
    const rest = telemetry.restStop
    const mandatoryBreak = telemetry.mandatoryBreak
    raise('rest', rest >= 0 && rest <= 15, words.restStop, minutes(Math.max(0, rest)), 'warn', 'maps')
    raise(
      'mandatoryBreak',
      mandatoryBreak >= 0 && mandatoryBreak <= 15,
      words.mandatoryBreak,
      minutes(Math.max(0, mandatoryBreak)),
      'warn',
      'maps',
    )
  }, [telemetry, text, clockShift])
}
