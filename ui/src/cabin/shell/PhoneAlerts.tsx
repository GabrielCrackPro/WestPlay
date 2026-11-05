import { useEffect, useState } from 'react'
import type { PhoneCall } from '../../shared/host'
import { sendPhoneCommand, useCaller, usePhone, usePhoneToasts } from '../apps/phone/phone'
import { go, useCabin } from '../state/store'
import { useText } from '../state/text'
import './phoneAlerts.css'

/**
 * The phone over whatever the cab is showing: its call — ringing, and answered or declined from here — and the
 * notifications it posts as they come (apps/phone/phone.ts announces them, each on its own timer). The call and
 * the whole list are the Phone app's own drawing, so nothing is repeated while it's open, or while the truck's own
 * screen is up.
 */
export function PhoneAlerts() {
  const phone = usePhone()
  const toasts = usePhoneToasts((state) => state.toasts)
  const drop = usePhoneToasts((state) => state.drop)
  const route = useCabin((state) => state.navigation.route)
  const handedOver = useCabin((state) => state.truckScreen)
  const words = useText().phoneApp
  const call = phone.call
  const seconds = useCallSeconds(call)
  const inPhoneApp = route.kind === 'app' && route.app === 'phone'
  if (inPhoneApp || handedOver) return null
  return (
    <div className="phone-alerts">
      {call && <CallAlert call={call} seconds={seconds} />}
      {toasts.length > 0 && (
        <div className="phone-toasts" aria-live="polite">
          {toasts.map((notification) => (
            <Toast key={notification.id} notification={notification} dismiss={words.dismiss} onDrop={drop} />
          ))}
        </div>
      )}
    </div>
  )
}

/** A ringing or answered call: who it is, how long it has lasted, and the buttons that take it. */
function CallAlert({ call, seconds }: { call: PhoneCall; seconds: number | null }) {
  const words = useText().phoneApp
  // Who is calling: the phone's own word for the call, or the name the dialer's notification gave it.
  const caller = useCaller(call.id)
  const who = call.name ?? caller.name ?? call.number ?? caller.number ?? words.unknownCaller
  const ringing = call.state === 'ringing'
  const lasted = !ringing && seconds !== null ? ` · ${words.duration(seconds)}` : ''
  return (
    <div className={ringing ? 'phone-alert ringing' : 'phone-alert calling'} role={ringing ? 'alert' : undefined}>
      <span className="phone-alert-glyph" aria-hidden="true">
        <Receiver />
      </span>
      {/* The call's own words are the way to its page, where the rest of the phone is. */}
      <button type="button" className="phone-alert-open" onClick={() => go({ type: 'openApp', app: 'phone' })}>
        <span className="phone-alert-state">
          {ringing ? words.ringing : words.inCall}
          {lasted}
        </span>
        <span className="phone-alert-who">{who}</span>
      </button>
      <span className="phone-alert-buttons">
        {ringing && (
          <button type="button" className="phone-alert-answer" onClick={() => sendPhoneCommand({ action: 'answer' })}>
            {words.answer}
          </button>
        )}
        <button type="button" className="phone-alert-end" onClick={() => sendPhoneCommand({ action: 'end' })}>
          {ringing ? words.decline : words.end}
        </button>
      </span>
    </div>
  )
}

/** One notification the phone just posted: its app and its words, and the way to the Phone app's list. */
function Toast({
  notification,
  dismiss,
  onDrop,
}: {
  notification: { id: string; app: string; title?: string; text?: string }
  dismiss: string
  onDrop(id: string): void
}) {
  return (
    <div className="phone-toast">
      <span className="phone-toast-app">{notification.app}</span>
      <button
        type="button"
        className="phone-toast-open"
        onClick={() => go({ type: 'openApp', app: 'phone' })}
      >
        <span className="phone-toast-title">{notification.title ?? notification.text ?? notification.app}</span>
        {notification.title && notification.text && <span className="phone-toast-text">{notification.text}</span>}
      </button>
      <button type="button" className="phone-toast-close" aria-label={dismiss} onClick={() => onDrop(notification.id)}>
        <Cross />
      </button>
    </div>
  )
}

/** The seconds a call has lasted, from the moment the phone says it began, once a second. */
function useCallSeconds(call: PhoneCall | null): number | null {
  const id = call?.id ?? null
  const began = call?.startedAt ?? null
  const [counted, setCounted] = useState<{ id: string; seconds: number } | null>(null)
  useEffect(() => {
    if (id === null || began === null) return
    const timer = window.setInterval(() => {
      setCounted({ id, seconds: Math.max(0, Math.floor(Date.now() / 1000) - began) })
    }, 1000)
    return () => window.clearInterval(timer)
  }, [id, began])
  return id !== null && counted?.id === id ? counted.seconds : null
}

/** A telephone receiver, as the Phone app draws it. */
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

/** A toast's cross. */
function Cross() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <path d="m6.5 6.5 11 11M17.5 6.5l-11 11" strokeLinecap="round" />
    </svg>
  )
}
