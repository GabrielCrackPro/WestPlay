import { useEffect, useRef, useState } from 'react'
import { type PhoneCall, type PhoneContact, type PhoneNotification, type PhoneRecent } from '../../../shared/host'
import { formatRealTime } from '../../../shared/format'
import { SearchGlyph } from '../../keyboard/glyphs'
import { TextField } from '../../keyboard/TextField'
import { useText } from '../../state/text'
import {
  contactFor,
  contactsMatching,
  initialsOf,
  recentWho,
  sendPhoneCommand,
  useCaller,
  usePhone,
  usePhoneFailure,
} from './phone'
import './phoneApp.css'

/** The contact search's id (one on screen: the keyboard types into it). */
const CONTACT_FIELD = 'phone-contact-search'

/** The app's pages: the phone's call log, its address book, a keypad, and its notifications. */
const TABS = ['recents', 'contacts', 'keypad', 'notifications'] as const
type Tab = (typeof TABS)[number]

/** The keypad's keys, in the phone's own order. */
const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '*', '0', '#'] as const

/** How long the keypad's Delete has to be held before it clears the whole number. */
const LONG_PRESS = 550

/** How long the dial sheet's Call takes to arm: a second press that lands with the first tap's bounce dials nothing. */
const DIAL_ARM = 350

/** How long the dial sheet waits for its second press before it closes itself. */
const DIAL_LAPSE = 12_000

/** How often the cab asks the phone for its lists again while the Phone app is open: the phone pushes its
 * notifications as they come, but not a call's end or a contact's change. */
const SYNC_EVERY = 30_000

/** How long after a call ends the cab asks again: the phone writes the call's log entry as the line drops, so a
 * sync sent with the hang-up can arrive before it does. */
const SYNC_AFTER_CALL = 1_500

/** How long a ringing call's Decline stays armed: its second press is what drops the call. */
const DECLINE_ARMED = 3_500

/** How long a command the phone couldn't do stays on the page (it can be dismissed before then). */
const FAILURE_SHOWN = 8_000

/**
 * The Phone app: the Android phone paired with this PC (phone_plan.md). The host owns the link and keeps the
 * snapshot; this draws it — whether the phone is connected and its battery, where to pair one when none is (the
 * companion window's Setup, never the cab's screen), a call ringing or in progress with its answer and end
 * buttons, and the phone's four pages: its call log, its contacts with a search, a keypad, and its
 * notifications, each with its app, its words and its time, which can be dismissed from the cab. A tap dials: a
 * call in the log back, a contact on their first number, and a number typed on the keypad.
 *
 * Drawn as the native apps draw a page: a large title with its figures beside it, then the phone's things in
 * grouped cards with hairline rows, on Apple's colours (shell/apple.css), at the cab's text size.
 */
export function PhoneApp() {
  const text = useText()
  const words = text.phoneApp
  const phone = usePhone()
  const device = phone.device
  const notifications = phone.notifications
  const contacts = phone.contacts
  const recents = phone.recents
  const [tab, setTab] = useState<Tab>('recents')
  const [query, setQuery] = useState('')
  // The keypad's number, as typed: the phone's own dialer takes it when the dial sheet is confirmed.
  const [number, setNumber] = useState('')
  // The dial a press asked for, held until the sheet confirms it: a stray tap calls nobody. A contact with several
  // numbers offers them all there, the first chosen.
  const [asked, setAsked] = useState<{ who: string; numbers: string[]; number: string } | null>(null)
  const [armed, setArmed] = useState(false)
  // The call whose Decline was pressed once, by its id: the next press on it is what ends the call.
  const [declining, setDeclining] = useState<string | null>(null)
  // Delete's long press: the timer that clears the number, while the key is held.
  const held = useRef<number | null>(null)
  const endHold = () => {
    if (held.current !== null) {
      window.clearTimeout(held.current)
      held.current = null
    }
  }
  const startHold = () => {
    endHold()
    held.current = window.setTimeout(() => {
      held.current = null
      setNumber('')
    }, LONG_PRESS)
  }
  // The keypad's 0, as a phone's own dialer: a press types a 0, a hold types + (for an international number).
  const plusHeld = useRef<number | null>(null)
  const typedPlus = useRef(false)
  const endPlus = () => {
    if (plusHeld.current !== null) {
      window.clearTimeout(plusHeld.current)
      plusHeld.current = null
    }
  }
  const startPlus = () => {
    endPlus()
    typedPlus.current = false
    plusHeld.current = window.setTimeout(() => {
      plusHeld.current = null
      typedPlus.current = true
      setNumber((typed) => typed + '+')
    }, LONG_PRESS)
  }
  useEffect(
    () => () => {
      if (held.current !== null) window.clearTimeout(held.current)
      if (plusHeld.current !== null) window.clearTimeout(plusHeld.current)
    },
    [],
  )
  // The sheet's Call arms a moment after it opens, and the sheet closes itself when no second press comes.
  useEffect(() => {
    if (!asked) return
    const arm = window.setTimeout(() => setArmed(true), DIAL_ARM)
    const lapse = window.setTimeout(() => setAsked(null), DIAL_LAPSE)
    return () => {
      window.clearTimeout(arm)
      window.clearTimeout(lapse)
    }
  }, [asked])
  // Decline disarms itself a few seconds later: a press meant for Answer shouldn't drop a call minutes on.
  useEffect(() => {
    if (declining === null) return
    const timer = window.setTimeout(() => setDeclining(null), DECLINE_ARMED)
    return () => window.clearTimeout(timer)
  }, [declining])

  // The phone's lists, as the app opens and as the link comes back, and again every so often: nothing here is a
  // button the driver should have to find.
  const connected = phone.connected
  useEffect(() => {
    if (!connected) return
    sendPhoneCommand({ action: 'sync' })
    const timer = window.setInterval(() => sendPhoneCommand({ action: 'sync' }), SYNC_EVERY)
    return () => window.clearInterval(timer)
  }, [connected])

  // A call that just ended: its entry in the phone's log is what the driver came to see, so the lists are asked
  // for again a moment later instead of waiting out the sync's interval.
  const wasCalling = useRef(false)
  useEffect(() => {
    const calling = phone.call !== null
    const ended = wasCalling.current && !calling
    wasCalling.current = calling
    if (!ended || !connected) return
    const timer = window.setTimeout(() => sendPhoneCommand({ action: 'sync' }), SYNC_AFTER_CALL)
    return () => window.clearTimeout(timer)
  }, [phone.call, connected])

  // What the phone said it couldn't do (its dialer refused, the call wouldn't end): shown over the page, then gone.
  const failure = usePhoneFailure((state) => state.error)
  const failureCount = usePhoneFailure((state) => state.count)
  const clearFailure = usePhoneFailure((state) => state.clear)
  useEffect(() => {
    if (failure === null) return
    const timer = window.setTimeout(clearFailure, FAILURE_SHOWN)
    return () => window.clearTimeout(timer)
  }, [failure, failureCount, clearFailure])

  // A call's length: the phone says when it began, and the cab counts from there, once a second (the count belongs
  // to the call's id, so a new call starts without the last one's).
  const call = phone.call
  const callId = call?.id ?? null
  const began = call?.startedAt ?? null
  const [counted, setCounted] = useState<{ call: string; seconds: number } | null>(null)
  useEffect(() => {
    if (callId === null || began === null) return
    const timer = window.setInterval(() => {
      setCounted({ call: callId, seconds: Math.max(0, Math.floor(Date.now() / 1000) - began) })
    }, 1000)
    return () => window.clearInterval(timer)
  }, [callId, began])
  const calling = callId !== null && counted?.call === callId ? counted.seconds : null

  // A call that starts ringing, or a phone that drops off: a dial asked for is no longer anyone's to confirm.
  if (asked && (call || !phone.connected)) setAsked(null)

  /** Asks before dialing: only the sheet's own Call makes the call. A contact's numbers are all offered there, the
   * first chosen. */
  const askDial = (who: string, numbers: string[]) => {
    const offered = numbers.filter(Boolean)
    if (offered.length === 0) return
    setArmed(false)
    setAsked({ who, numbers: offered, number: offered[0] })
  }
  const dial = () => {
    if (!asked) return
    sendPhoneCommand({ action: 'dial', number: asked.number })
    setAsked(null)
  }
  const shown = contactsMatching(contacts, query)
  // The lists are on their way as the app opens: empty before the phone's first snapshot is "not here yet".
  const syncing = phone.connected && !phone.ready
  const tabs: Record<Tab, { label: string; count: number }> = {
    recents: { label: words.recents, count: recents.length },
    contacts: { label: words.contacts, count: contacts.length },
    keypad: { label: words.keypad, count: 0 },
    notifications: { label: text.apps.notifications, count: notifications.length },
  }

  const battery =
    device?.battery !== undefined
      ? `${words.battery(device.battery)}${device.charging ? ` · ${words.charging}` : ''}`
      : null
  const subtitle = phone.connected
    ? [device?.name, battery].filter(Boolean).join(' · ') || words.connected
    : words.disconnected

  return (
    <section className="app-panel phone-app" aria-label={text.apps.phone}>
      <div className="phone-scroll">
        <div className="phone-page">
          <header className="phone-head">
            <div className="phone-title">
              <h1>{text.apps.phone}</h1>
              <p className="phone-sub">
                <span className={phone.connected ? 'phone-state-dot on' : 'phone-state-dot'} aria-hidden="true" />
                {subtitle}
              </p>
            </div>
          </header>

          {failure && (
            <p className="phone-failure" role="status">
              {failure}
              <button type="button" className="phone-failure-close" aria-label={words.dismiss} onClick={clearFailure}>
                <Cross />
              </button>
            </p>
          )}

          {call && (
            <CallBanner
              call={call}
              elapsed={calling}
              declineAgain={words.declineAgain}
              declining={declining === call.id}
              onAnswer={() => sendPhoneCommand({ action: 'answer' })}
              onDecline={() => {
                // Decline asks twice: the button sits beside Answer, and one stray tap shouldn't drop a call.
                if (call.state === 'ringing' && declining !== call.id) {
                  setDeclining(call.id)
                  return
                }
                sendPhoneCommand({ action: 'end' })
                setDeclining(null)
              }}
            />
          )}

          {!phone.connected && <p className="phone-pair">{words.pairingHint}</p>}

          <div className="phone-tabs" role="tablist" aria-label={text.apps.phone}>
            {TABS.map((each) => (
              <button
                key={each}
                type="button"
                role="tab"
                id={`phone-tab-${each}`}
                aria-selected={tab === each}
                aria-controls={`phone-panel-${each}`}
                className={tab === each ? 'phone-tab current' : 'phone-tab'}
                onClick={() => {
                  setTab(each)
                  setAsked(null)
                }}
              >
                {tabs[each].label}
                {tabs[each].count > 0 && <span className="phone-tab-count">{tabs[each].count}</span>}
              </button>
            ))}
          </div>

          <div className="phone-panel" role="tabpanel" id={`phone-panel-${tab}`} aria-labelledby={`phone-tab-${tab}`}>
            {tab === 'recents' && (
              <section className="phone-recents" aria-label={words.recents}>
                <header className="phone-recents-head">
                  <h2>{words.recents}</h2>
                  <span className="phone-recents-count">{words.recentCount(recents.length)}</span>
                </header>
                {syncing ? (
                  <Syncing text={words.syncing} />
                ) : recents.length === 0 ? (
                  <div className="phone-empty">
                    <Clock />
                    <p className="phone-empty-title">{words.recentsEmpty}</p>
                    <p className="phone-empty-hint">{words.recentsHint}</p>
                  </div>
                ) : (
                  <ol className="phone-contact-list">
                    {recents.map((recent) => (
                      <RecentRow
                        key={recent.id}
                        recent={recent}
                        kind={words[recent.kind === 'other' ? 'otherCall' : recent.kind]}
                        callBack={words.callBack}
                        unknownCaller={words.unknownCaller}
                        duration={words.duration}
                        connected={phone.connected}
                        contact={contactFor(contacts, recent.number)}
                        onDial={askDial}
                      />
                    ))}
                  </ol>
                )}
              </section>
            )}

            {tab === 'contacts' && (
              <section className="phone-contacts" aria-label={words.contacts}>
                <header className="phone-contacts-head">
                  <h2>{words.contacts}</h2>
                  <span className="phone-contacts-count">{words.showing(shown.length, contacts.length)}</span>
                </header>
                {syncing ? (
                  <Syncing text={words.syncing} />
                ) : contacts.length === 0 ? (
                  <div className="phone-empty">
                    <Person />
                    <p className="phone-empty-title">{words.contactsEmpty}</p>
                    <p className="phone-empty-hint">{words.contactsHint}</p>
                  </div>
                ) : (
                  <>
                    <div className="phone-search">
                      <TextField
                        id={CONTACT_FIELD}
                        value={query}
                        onChange={setQuery}
                        hint={words.searchContacts}
                        label={words.searchContacts}
                        icon={<SearchGlyph />}
                      />
                    </div>
                    {shown.length === 0 ? (
                      <p className="phone-no-match">{words.noMatches}</p>
                    ) : (
                      <ol className="phone-contact-list">
                        {shown.map((contact) => (
                          <ContactRow
                            key={contact.id}
                            contact={contact}
                            dial={words.dial}
                            connected={phone.connected}
                            onDial={askDial}
                          />
                        ))}
                      </ol>
                    )}
                  </>
                )}
              </section>
            )}

            {tab === 'keypad' && (
              <section className="phone-keypad" aria-label={words.keypad}>
                <div className="phone-keypad-display">
                  <output
                    className={number ? 'phone-keypad-number' : 'phone-keypad-number empty'}
                    aria-live="polite"
                    aria-label={words.keypad}
                  >
                    {number || words.keypadHint}
                  </output>
                </div>
                <div className="phone-keypad-keys">
                  {KEYS.map((key) => (
                    <button
                      key={key}
                      type="button"
                      className="phone-keypad-key"
                      aria-label={key === '0' ? words.holdPlus : undefined}
                      title={key === '0' ? words.holdPlus : undefined}
                      onClick={() => {
                        // The hold already typed its +: the click that follows it types nothing.
                        if (key === '0' && typedPlus.current) {
                          typedPlus.current = false
                          return
                        }
                        setNumber((typed) => typed + key)
                      }}
                      onPointerDown={key === '0' ? startPlus : undefined}
                      onPointerUp={key === '0' ? endPlus : undefined}
                      onPointerLeave={key === '0' ? endPlus : undefined}
                      onPointerCancel={key === '0' ? endPlus : undefined}
                    >
                      {key}
                    </button>
                  ))}
                </div>
                <div className="phone-keypad-actions">
                  <button
                    type="button"
                    className="phone-keypad-delete"
                    aria-label={words.deleteHold}
                    title={words.deleteHold}
                    disabled={!number}
                    onClick={() => setNumber((typed) => typed.slice(0, -1))}
                    onPointerDown={startHold}
                    onPointerUp={endHold}
                    onPointerLeave={endHold}
                    onPointerCancel={endHold}
                  >
                    <Backspace />
                  </button>
                  <button
                    type="button"
                    className="phone-keypad-call"
                    disabled={!phone.connected || !number}
                    onClick={() => askDial(number, [number])}
                  >
                    <Receiver />
                    {words.call}
                  </button>
                </div>
              </section>
            )}

            {tab === 'notifications' && (
              <section className="phone-notes" aria-label={text.apps.notifications}>
                <header className="phone-notes-head">
                  <h2>{text.apps.notifications}</h2>
                  <span className="phone-notes-count">{words.summary(notifications.length)}</span>
                </header>
                {syncing ? (
                  <Syncing text={words.syncing} />
                ) : notifications.length === 0 ? (
                  <div className="phone-empty">
                    <Bell />
                    <p className="phone-empty-title">{words.empty}</p>
                    <p className="phone-empty-hint">{words.hint}</p>
                  </div>
                ) : (
                  <ol className="phone-list">
                    {notifications.map((notification) => (
                      <NoteRow key={notification.id} notification={notification} dismiss={words.dismiss} />
                    ))}
                  </ol>
                )}
              </section>
            )}
          </div>
        </div>
      </div>
      {asked && (
        <DialSheet
          asked={asked}
          armed={armed}
          title={words.dialTitle(asked.who)}
          hint={words.dialHint}
          cancel={words.cancel}
          call={words.call}
          onCancel={() => setAsked(null)}
          onDial={dial}
          onPick={(picked) => setAsked((each) => (each ? { ...each, number: picked } : each))}
        />
      )}
    </section>
  )
}

/**
 * A dial asked for, before the phone makes it: who it's to, its number, and the second press — the sheet's Call —
 * that dials it. Anything else (Cancel, the veil, another page, or no press at all) calls nobody.
 */
function DialSheet({
  asked,
  armed,
  title,
  hint,
  cancel,
  call,
  onCancel,
  onDial,
  onPick,
}: {
  asked: { who: string; numbers: string[]; number: string }
  armed: boolean
  title: string
  hint: string
  cancel: string
  call: string
  onCancel(): void
  onDial(): void
  onPick(number: string): void
}) {
  return (
    <div className="phone-dial-veil" onClick={onCancel}>
      <div className="phone-dial" role="dialog" aria-label={title} onClick={(event) => event.stopPropagation()}>
        <span className="phone-dial-glyph" aria-hidden="true">
          <Receiver />
        </span>
        <h2 className="phone-dial-title">{title}</h2>
        {asked.numbers.length > 1 ? (
          <div className="phone-dial-choices" role="radiogroup" aria-label={title}>
            {asked.numbers.map((each) => (
              <button
                key={each}
                type="button"
                role="radio"
                aria-checked={asked.number === each}
                className={asked.number === each ? 'phone-dial-choice current' : 'phone-dial-choice'}
                onClick={() => onPick(each)}
              >
                {each}
              </button>
            ))}
          </div>
        ) : (
          asked.number !== asked.who && <p className="phone-dial-number">{asked.number}</p>
        )}
        <p className="phone-dial-hint">{hint}</p>
        <div className="phone-dial-buttons">
          <button type="button" className="phone-dial-cancel" onClick={onCancel}>
            {cancel}
          </button>
          <button type="button" className="phone-dial-call" disabled={!armed} onClick={onDial}>
            <Receiver />
            {call}
          </button>
        </div>
      </div>
    </div>
  )
}

/** The keypad's delete key: a wide backspace, as a phone draws it. */
function Backspace() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
      <path
        d="M8.4 5.6h10.2a1.8 1.8 0 0 1 1.8 1.8v9.2a1.8 1.8 0 0 1-1.8 1.8H8.4L3 12l5.4-6.4Z"
        strokeLinejoin="round"
      />
      <path d="m11.4 9.8 4.6 4.4M16 9.8l-4.6 4.4" strokeLinecap="round" />
    </svg>
  )
}

/** One call in the phone's log: its kind, who it was with, when and how long, and the button that asks to call back. */
function RecentRow({
  recent,
  kind,
  callBack,
  unknownCaller,
  duration,
  connected,
  contact,
  onDial,
}: {
  recent: PhoneRecent
  kind: string
  callBack: string
  unknownCaller: string
  duration: (seconds: number) => string
  connected: boolean
  /** The address book's entry for the number, when it has one: their face beside the call's kind. */
  contact: PhoneContact | null
  onDial(who: string, numbers: string[]): void
}) {
  const who = recentWho(recent, unknownCaller)
  const time = formatRealTime(recent.time * 1000)
  const lasted = recent.duration > 0 ? ` · ${duration(recent.duration)}` : ''
  return (
    <li className="phone-contact">
      <button
        type="button"
        className="phone-contact-row"
        disabled={!connected || !recent.number}
        aria-label={`${callBack} ${who}, ${recent.number}`}
        onClick={() => onDial(who, [recent.number])}
      >
        {contact ? (
          <span className="phone-recent-face">
            <span
              className={contact.photo ? 'phone-contact-avatar photo' : 'phone-contact-avatar'}
              style={contact.photo ? { backgroundImage: `url(${contact.photo})` } : undefined}
              aria-hidden="true"
            >
              {!contact.photo && initialsOf(contact.name)}
            </span>
            <span className={`phone-recent-kind badge ${recent.kind}`} aria-hidden="true">
              <KindGlyph kind={recent.kind} />
            </span>
          </span>
        ) : (
          <span className={`phone-recent-kind ${recent.kind}`} aria-hidden="true">
            <KindGlyph kind={recent.kind} />
          </span>
        )}
        <span className="phone-contact-body">
          <span className="phone-contact-name">{who}</span>
          <span className="phone-recent-meta">
            {kind} · {time}
            {lasted}
          </span>
        </span>
        <span className="phone-contact-dial">
          <Receiver />
          <span>{callBack}</span>
        </span>
      </button>
    </li>
  )
}

/** One contact: their initials (or photo), their numbers, and the button that asks to dial the first of them. */
function ContactRow({
  contact,
  dial,
  connected,
  onDial,
}: {
  contact: PhoneContact
  dial: string
  connected: boolean
  onDial(who: string, numbers: string[]): void
}) {
  return (
    <li className="phone-contact">
      <button
        type="button"
        className="phone-contact-row"
        disabled={!connected || contact.numbers.length === 0}
        aria-label={`${dial} ${contact.name}${contact.numbers.length > 0 ? `, ${contact.numbers.join(', ')}` : ''}`}
        onClick={() => onDial(contact.name, contact.numbers)}
      >
        <span
          className={contact.photo ? 'phone-contact-avatar photo' : 'phone-contact-avatar'}
          style={contact.photo ? { backgroundImage: `url(${contact.photo})` } : undefined}
          aria-hidden="true"
        >
          {!contact.photo && initialsOf(contact.name)}
        </span>
        <span className="phone-contact-body">
          <span className="phone-contact-name">{contact.name}</span>
          {contact.numbers.length > 0 && <span className="phone-contact-number">{contact.numbers.join(' · ')}</span>}
        </span>
        <span className="phone-contact-dial">
          <Receiver />
          <span>{dial}</span>
        </span>
      </button>
    </li>
  )
}

/** One notification: its app and time, its title and words, and its dismissal. */
function NoteRow({ notification, dismiss }: { notification: PhoneNotification; dismiss: string }) {
  const time = notification.time !== undefined ? formatRealTime(notification.time * 1000) : null
  return (
    <li className="phone-note">
      <div className="phone-note-head">
        <span className="phone-note-app">{notification.app}</span>
        {time && <span className="phone-note-time">{time}</span>}
      </div>
      {notification.title && <p className="phone-note-title">{notification.title}</p>}
      {notification.text && <p className="phone-note-text">{notification.text}</p>}
      <div className="phone-note-foot">
        {notification.actions && notification.actions.length > 0 && (
          <span className="phone-note-actions">{notification.actions.join(' · ')}</span>
        )}
        {!notification.ongoing && (
          <button
            type="button"
            className="phone-note-dismiss"
            aria-label={`${dismiss}: ${notification.title ?? notification.app}`}
            onClick={() => sendPhoneCommand({ action: 'dismiss', id: notification.id })}
          >
            <Cross />
          </button>
        )}
      </div>
    </li>
  )
}

/** A ringing or answered call, above everything else, with the buttons that end or answer it. */
function CallBanner({
  call,
  elapsed,
  declining,
  declineAgain,
  onAnswer,
  onDecline,
}: {
  call: PhoneCall
  /** The seconds it has lasted (`null`: the phone didn't say when it began). */
  elapsed: number | null
  /** Decline pressed once: the next press on it is what drops the call. */
  declining: boolean
  declineAgain: string
  onAnswer(): void
  onDecline(): void
}) {
  const words = useText().phoneApp
  // Who is calling: the phone's own word for the call, or the name the dialer's notification gave it.
  const caller = useCaller(call.id)
  const who = call.name ?? caller.name ?? call.number ?? caller.number ?? words.unknownCaller
  const number = call.number ?? caller.number
  const lasted = call.state === 'offHook' && elapsed !== null ? ` · ${words.duration(elapsed)}` : ''
  return (
    <section className={call.state === 'ringing' ? 'phone-call ringing' : 'phone-call'} aria-live="polite">
      <span className="phone-call-glyph" aria-hidden="true">
        <Receiver />
      </span>
      <span className="phone-call-body">
        <span className="phone-call-state">
          {call.state === 'ringing' ? words.ringing : words.inCall}
          {lasted}
        </span>
        <span className="phone-call-who">{who}</span>
        {number && number !== who && <span className="phone-call-number">{number}</span>}
      </span>
      <span className="phone-call-buttons">
        {call.state === 'ringing' && (
          <button type="button" className="phone-call-answer" onClick={onAnswer}>
            {words.answer}
          </button>
        )}
        <button
          type="button"
          className={declining ? 'phone-call-end armed' : 'phone-call-end'}
          aria-label={declining ? declineAgain : undefined}
          onClick={onDecline}
        >
          {call.state === 'ringing' ? (declining ? declineAgain : words.decline) : words.end}
        </button>
      </span>
    </section>
  )
}

/** A call's kind: an arrow into the phone, out of it, or a call that never connected. */
function KindGlyph({ kind }: { kind: PhoneRecent['kind'] }) {
  if (kind === 'missed') return <Receiver />
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      {kind === 'outgoing' ? (
        <>
          <path d="M6 18 18 6" strokeLinecap="round" />
          <path d="M9 6h9v9" strokeLinecap="round" strokeLinejoin="round" />
        </>
      ) : (
        <>
          <path d="M18 6 6 18" strokeLinecap="round" />
          <path d="M15 18H6V9" strokeLinecap="round" strokeLinejoin="round" />
        </>
      )}
    </svg>
  )
}

/** A dismissed notification's cross, in the row's quiet colour. */
function Cross() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <path d="m6.5 6.5 11 11M17.5 6.5l-11 11" strokeLinecap="round" />
    </svg>
  )
}

/** The app's bell, shown while the phone has nothing to list. */
function Bell() {
  return (
    <svg viewBox="0 0 24 24" className="phone-bell" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden>
      <path
        d="M12 3.2c-1 0-1.8.8-1.8 1.8v.7A6.4 6.4 0 0 0 5.6 12v3.4L4 18.2h16l-1.6-2.8V12a6.4 6.4 0 0 0-4.6-6.3v-.7c0-1-.8-1.8-1.8-1.8Z"
        strokeLinejoin="round"
      />
      <path d="M9.6 18.6a2.4 2.4 0 0 0 4.8 0" strokeLinecap="round" />
    </svg>
  )
}

/** A clock going back, shown while the phone's call log is empty. */
function Clock() {
  return (
    <svg viewBox="0 0 24 24" className="phone-bell" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden>
      <path d="M3.6 12a8.4 8.4 0 1 0 2.6-6.1" strokeLinecap="round" />
      <path d="M3.2 4.4v4.2h4.2" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M12 7.8V12l3 1.9" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

/** A person's head and shoulders, shown while the phone has no contacts to list. */
function Person() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="phone-contacts-icon"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      aria-hidden
    >
      <circle cx="12" cy="8" r="3.6" />
      <path d="M4.6 20a7.4 7.4 0 0 1 14.8 0" strokeLinecap="round" />
    </svg>
  )
}

/** A turning ring, shown while the phone's first snapshot is on its way: its lists aren't empty, they're coming. */
function Syncing({ text }: { text: string }) {
  return (
    <div className="phone-empty" role="status">
      <span className="phone-syncing" aria-hidden="true" />
      <p className="phone-empty-title">{text}</p>
    </div>
  )
}

/** A telephone receiver, for the call banner. */
function Receiver() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true">
      <path
        d="M6.2 3.6h2.9l1.4 4.1-2 1.5a12.5 12.5 0 0 0 6.3 6.3l1.5-2 4.1 1.4v2.9a2.2 2.2 0 0 1-2.4 2.2A17.6 17.6 0 0 1 4 6a2.2 2.2 0 0 1 2.2-2.4Z"
        strokeLinejoin="round"
      />
    </svg>
  )
}
