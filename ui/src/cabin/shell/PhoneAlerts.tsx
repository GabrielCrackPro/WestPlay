import { motion } from 'motion/react'
import { useEffect, useState } from 'react'
import type { PhoneCall } from '../../shared/host'
import { sendPhoneCommand, useCaller, usePhone } from '../apps/phone/phone'
import { overlayMotion, useMotionReduced } from '../motion'
import { go, useCabin } from '../state/store'
import { useText } from '../state/text'
import './phoneAlerts.css'

/**
 * A ringing or answered call over whatever the cab is showing — answered, declined or ended from here, from any
 * app. The phone's notifications are the notification stack's (shell/Notifications.tsx), and its whole list is the
 * Phone app's own drawing, so nothing is repeated while that app is open, or while the truck's own screen is up.
 */
export function PhoneAlerts() {
  const phone = usePhone()
  const route = useCabin((state) => state.navigation.route)
  const handedOver = useCabin((state) => state.truckScreen)
  const shown = useCallPresence(phone.call)
  const seconds = useCallSeconds(shown.call)
  const inPhoneApp = route.kind === 'app' && route.app === 'phone'
  if (inPhoneApp || handedOver || !shown.call) return null
  return (
    <div className="phone-alerts">
      <CallAlert call={shown.call} seconds={seconds} leaving={shown.leaving} />
    </div>
  )
}

/** How long the card takes to come over the cab, ms, and how long an ended call stays for its exit. */
const CALL_IN_MS = 260
const CALL_OUT_MS = 220

/** A ringing or answered call: who it is, how long it has lasted, and the buttons that take it. */
function CallAlert({ call, seconds, leaving }: { call: PhoneCall; seconds: number | null; leaving: boolean }) {
  const reduced = useMotionReduced()
  const words = useText().phoneApp
  // Who is calling: the phone's own word for the call, or the name the dialer's notification gave it.
  const caller = useCaller(call.id)
  const who = call.name ?? caller.name ?? call.number ?? caller.number ?? words.unknownCaller
  const ringing = call.state === 'ringing'
  const lasted = !ringing && seconds !== null ? ` · ${words.duration(seconds)}` : ''
  return (
    <motion.div
      className={ringing ? 'phone-alert ringing' : 'phone-alert calling'}
      role={ringing ? 'alert' : undefined}
      aria-hidden={leaving || undefined}
      {...overlayMotion(leaving, reduced, CALL_IN_MS, CALL_OUT_MS)}
    >
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
        <button
          type="button"
          className="phone-alert-end"
          disabled={leaving}
          onClick={() => sendPhoneCommand({ action: 'end' })}
        >
          {ringing ? words.decline : words.end}
        </button>
      </span>
    </motion.div>
  )
}

/**
 * The call on screen, kept a moment after the phone hangs it up so its exit can be seen: an element that leaves the
 * page can't animate. A new call arriving mid-exit takes its place at once.
 */
function useCallPresence(call: PhoneCall | null): { call: PhoneCall | null; leaving: boolean } {
  const [lastCall, setLastCall] = useState(call)
  const [shown, setShown] = useState(call)
  const [leaving, setLeaving] = useState(false)
  // A new call takes the card at once; one that has gone stays for its exit. Adjusted while rendering, as React
  // asks for state derived from a prop, rather than in an effect (which would render the old call once more).
  if (call !== lastCall) {
    setLastCall(call)
    if (call) {
      setShown(call)
      setLeaving(false)
    } else if (shown) {
      setLeaving(true)
    }
  }
  useEffect(() => {
    if (!leaving) return
    const timer = window.setTimeout(() => {
      setShown(null)
      setLeaving(false)
    }, CALL_OUT_MS)
    return () => window.clearTimeout(timer)
  }, [leaving])
  return { call: shown, leaving: leaving && call === null }
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
