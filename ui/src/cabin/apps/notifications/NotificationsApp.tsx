import { useEffect } from 'react'
import { formatGameTime, formatRealTime } from '../../../shared/format'
import { type NoteRecord, useNotes } from '../../shell/notesShown'
import { TrashGlyph } from '../../shell/TrashGlyph'
import { type Language, useLanguage, useText } from '../../state/text'
import './notificationsApp.css'

/**
 * The Notifications app: the history of what the cab has told the driver (shell/Notifications.tsx), newest first.
 * A note is on the screen six seconds and then gone; this is where it can be read again — its reading, whether it
 * was an alert or a warning, and the clock it came at (the game's own, which is what the rest clocks are counted
 * in). The list is kept on this PC (shell/notesShown.ts saves it with the cabin's other state), so a note from an
 * earlier drive is still here after a restart.
 *
 * Drawn as the native apps draw a page: a large title with its figures beside it, then the notes in one grouped
 * card with hairline rows, rather than a card per note.
 */
export function NotificationsApp() {
  const text = useText()
  const language = useLanguage()
  const history = useNotes((state) => state.history)
  const clear = useNotes((state) => state.clearHistory)
  const markSeen = useNotes((state) => state.markSeen)
  const words = text.notificationsApp
  // Opened (and while it's open): what's on this list has been read, so Home's badge clears. A note that comes
  // in now is read as it lands here.
  useEffect(() => {
    markSeen()
  }, [history, markSeen])
  const alerts = history.filter((note) => note.tone === 'alarm').length
  const warnings = history.length - alerts

  return (
    <section className="app-panel notifications-app" aria-label={text.apps.notifications}>
      <div className="notes-scroll">
        <div className="notes-page">
          <header className="notes-head">
            <div className="notes-title">
              <h1>{text.apps.notifications}</h1>
              <p className="notes-sub">{history.length > 0 ? words.summary(history.length) : words.empty}</p>
            </div>
            <div className="notes-counts">
              <Count label={words.alerts} value={alerts} tone="alarm" />
              <Count label={words.warnings} value={warnings} tone="warn" />
              {history.length > 0 && (
                <button type="button" className="notes-clear" aria-label={words.clear} onClick={clear}>
                  <TrashGlyph />
                </button>
              )}
            </div>
          </header>
          {history.length === 0 ? (
            <div className="notes-empty">
              <Bell />
              <p className="notes-empty-title">{words.empty}</p>
              <p className="notes-empty-hint">{words.hint}</p>
            </div>
          ) : (
            <ol className="notes-list">
              {history.map((note) => (
                <NoteRow
                  key={note.id}
                  note={note}
                  day={dayOf(note.at, language)}
                  alert={words.alert}
                  warning={words.warning}
                />
              ))}
            </ol>
          )}
        </div>
      </div>
    </section>
  )
}

/** One of the two counts, as a page header shows a figure: its name beside it, the figure in its tone. */
function Count({ label, value, tone }: { label: string; value: number; tone: 'alarm' | 'warn' }) {
  return (
    <div className={`notes-count ${tone}`}>
      <span className="notes-count-label">{label}</span>
      <span className="notes-count-value">{value}</span>
    </div>
  )
}

/** One note: when it came, its reading and what that reading says, and how serious it was. */
function NoteRow({
  note,
  day,
  alert,
  warning,
}: {
  note: NoteRecord
  /** The day it came, for a note from before today (the list outlives a restart); null for today's. */
  day: string | null
  alert: string
  warning: string
}) {
  return (
    <li className={`notes-item ${note.tone}`}>
      {/* The game's clock, which the rest clocks are counted in; the player's own when the game sent none. */}
      <span className="notes-clock">
        <span className="notes-time">{formatGameTime(note.clock ?? realMinutes(note.at))}</span>
        {day && <span className="notes-day">{day}</span>}
      </span>
      <span className="notes-body">
        <span className="notes-name">{note.title}</span>
        <span className="notes-detail">{note.detail}</span>
      </span>
      {/* How serious it was, in its tone: a mark rather than the word in every row, the word kept as its name for a
          screen reader. */}
      <span className="notes-tone" role="img" aria-label={note.tone === 'alarm' ? alert : warning}>
        <ToneGlyph tone={note.tone} />
      </span>
    </li>
  )
}

/** The day a note came, when it wasn't today ("31 Oct"), in the cabin's language: the saved list spans days. */
function dayOf(at: number, language: Language): string | null {
  const then = new Date(at)
  const now = new Date()
  const today =
    then.getFullYear() === now.getFullYear() && then.getMonth() === now.getMonth() && then.getDate() === now.getDate()
  if (today) return null
  const locale = language === 'tr' ? 'tr-TR' : language === 'es' ? 'es-ES' : 'en-GB'
  return new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'short' }).format(then)
}

/** The player's clock as game minutes (the app's history is written in the game's clock throughout). */
function realMinutes(at: number): number {
  const shown = formatRealTime(at).split(':')
  return Number(shown[0]) * 60 + Number(shown[1])
}

/**
 * How serious a note was: a stop sign's octagon for an alert, a caution's triangle for a warning, each with the
 * exclamation in it, drawn in the row's tone (red or amber).
 */
function ToneGlyph({ tone }: { tone: 'alarm' | 'warn' }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
      {tone === 'alarm' ? (
        <path d="M8.7 3.3h6.6l5.4 5.4v6.6l-5.4 5.4H8.7l-5.4-5.4V8.7z" strokeLinejoin="round" />
      ) : (
        <path d="M12 3.4 21.7 19.6a1 1 0 0 1-.9 1.6H3.2a1 1 0 0 1-.9-1.6z" strokeLinejoin="round" />
      )}
      <path d="M12 8.4v4.4" strokeLinecap="round" />
      <circle cx="12" cy="16.3" r="1.05" fill="currentColor" stroke="none" />
    </svg>
  )
}

/** The app's own bell, in the size the empty list draws it. */
function Bell() {
  return (
    <svg viewBox="0 0 24 24" className="notes-bell" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden>
      <path
        d="M12 3.2c-1 0-1.8.8-1.8 1.8v.7A6.4 6.4 0 0 0 5.6 12v3.4L4 18.2h16l-1.6-2.8V12a6.4 6.4 0 0 0-4.6-6.3v-.7c0-1-.8-1.8-1.8-1.8Z"
        strokeLinejoin="round"
      />
      <path d="M9.6 18.6a2.4 2.4 0 0 0 4.8 0" strokeLinecap="round" />
    </svg>
  )
}
