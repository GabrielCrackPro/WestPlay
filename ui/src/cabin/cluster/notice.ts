import { useEffect, useRef } from 'react'
import type { PhoneNotification } from '../../shared/host'
import { useCaller, usePhone, usePhoneToasts } from '../apps/phone/phone'
import { gameAlerts } from '../shell/gameAlerts'
import { useLive } from '../state/store'
import type { Strings } from '../state/strings'
import { playCue } from '../state/sound'
import { useText } from '../state/text'
import { useUnits } from '../state/units'

/**
 * The cab's newest notice on the dash: which of the cab's sources the cluster has room for, and the chime that goes with
 * it. The card it is said in is ClusterNotices' (and the phone's own, shared/phoneNoteCard), drawn from here.
 */

/** A notice on the cluster: the cab's newest warning, phone message or call, in one line. */
export interface ClusterNotice {
  key: string
  kind: 'game' | 'phone' | 'call'
  tone: 'info' | 'warn' | 'alarm'
  label: string
  title: string
  detail?: string
  /** A phone notification's own app icon, when it sent one. */
  icon?: string
  /** The phone notification this notice shows, when it is a phone notice. */
  notification?: PhoneNotification
  /** How many are waiting: the newest is the one read, the rest are counted. */
  count: number
}

/**
 * The one notice the cluster has room for: the truck's own alarm first (a fault is the one thing on this line the
 * driver has to act on, and a message can wait), then a call, then the phone's newest notification, then the game's
 * warnings. The cabin's stack keeps all of them and their history; here it is a glance, so the rest are counted
 * rather than stacked over the dial.
 */
export function useClusterNotice(): ClusterNotice | null {
  const text = useText()
  const call = usePhone((state) => state.call)
  const caller = useCaller(call?.id)
  const toasts = usePhoneToasts((state) => state.toasts)
  const alert = useClusterAlert(text)
  if (alert?.tone === 'alarm') return alert
  if (call && call.state !== 'idle') {
    const ringing = call.state === 'ringing'
    return {
      key: `call:${call.id}`,
      kind: 'call',
      tone: ringing ? 'alarm' : 'info',
      label: ringing ? text.phoneApp.ringing : text.phoneApp.inCall,
      title: call.name ?? caller.name ?? call.number ?? caller.number ?? text.phoneApp.unknownCaller,
      detail: call.name && call.number ? call.number : undefined,
      count: 1,
    }
  }
  const notification = toasts[0]
  if (notification) {
    const urgent =
      (notification.priority ?? 0) >= 2 || notification.category === 'alarm' || notification.category === 'call'
    return {
      key: `phone:${notification.id}`,
      kind: 'phone',
      tone: urgent ? 'alarm' : 'info',
      label: notification.app,
      title: notification.title ?? notification.text ?? notification.app,
      detail: notification.title ? notification.text : undefined,
      icon: notification.icon,
      notification,
      count: toasts.length,
    }
  }
  return alert
}

/**
 * The chime as a notice is recorded on the dash: soft for a warning, firmer for an alarm (state/sound.ts).
 * A notice passing leaves the newest history entry alone, so the card underneath becoming the newest says nothing.
 */
export function useNoticeCue(notice: ClusterNotice | null): void {
  const lastKey = useRef(notice?.key ?? '')
  useEffect(() => {
    if (!notice || notice.key === lastKey.current) return
    lastKey.current = notice.key
    if (notice.tone === 'alarm') playCue('alarm')
    else if (notice.tone === 'warn') playCue('note')
  }, [notice])
}

/**
 * The game's warnings and rest clocks while they're calling for attention: the newest alarm reads first, and the
 * rest are counted. They stay up while the reading is wrong, unlike the cabin's timed pills: a warning covering
 * the route is better than a route covering a fault.
 */
function useClusterAlert(text: Strings): ClusterNotice | null {
  const telemetry = useLive((state) => state.telemetry)
  // This page draws its own units (it doesn't load the cabin's shell, which keeps shared/units.ts in step).
  const units = useUnits()
  if (!telemetry) return null
  const current = gameAlerts(telemetry, text, units).filter((alert) => alert.on)
  if (current.length === 0) return null
  const next = current.find((alert) => alert.tone === 'alarm') ?? current[0]
  return {
    key: `game:${next.key}`,
    kind: 'game',
    tone: next.tone,
    label: next.tone === 'alarm' ? text.notificationsApp.alert : text.notificationsApp.warning,
    title: next.title,
    detail: next.detail,
    count: current.length,
  }
}
