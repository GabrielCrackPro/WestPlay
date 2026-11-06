import { create } from 'zustand'
import {
  type PhoneCommand,
  type PhoneContact,
  type PhoneNotification,
  type PhoneRecent,
  type PhoneState,
  postToHost,
} from '../../../shared/host'

/**
 * The paired phone, as the host last said it (`HostMessage` `phone`). The host keeps the truth — it owns the
 * link — so this store only holds its latest snapshot, and every press is a command sent back through it.
 */
const NO_PHONE: PhoneState = {
  connected: false,
  ready: false,
  device: null,
  notifications: [],
  contacts: [],
  recents: [],
  call: null,
}

export const usePhone = create<PhoneState>()(() => NO_PHONE)

/** The phone's own quiet choices, kept on this PC: the apps whose notifications the cab hides, and the contacts
 * the driver favourites (which sort first). */
interface PhonePrefs {
  muted: string[]
  favourites: string[]
  toggleMute(packageName: string): void
  toggleFavourite(contactId: string): void
}

const PREFS_KEY = 'cabinplay.phone.prefs'

function storedPrefs(): { muted: string[]; favourites: string[] } {
  try {
    const saved = JSON.parse(localStorage.getItem(PREFS_KEY) ?? '{}') as Partial<{
      muted: string[]
      favourites: string[]
    }>
    return {
      muted: Array.isArray(saved.muted)
        ? saved.muted.filter((value): value is string => typeof value === 'string')
        : [],
      favourites: Array.isArray(saved.favourites)
        ? saved.favourites.filter((value): value is string => typeof value === 'string')
        : [],
    }
  } catch {
    return { muted: [], favourites: [] }
  }
}

const kept = storedPrefs()

function keepPrefs(muted: string[], favourites: string[]): void {
  try {
    localStorage.setItem(PREFS_KEY, JSON.stringify({ muted, favourites }))
  } catch {
    // A locked-down browser: the choices still last this session.
  }
}

export const usePhonePrefs = create<PhonePrefs>()((set, get) => ({
  ...kept,
  toggleMute: (packageName) => {
    const muted = get().muted.includes(packageName)
      ? get().muted.filter((each) => each !== packageName)
      : [...get().muted, packageName]
    keepPrefs(muted, get().favourites)
    set({ muted })
  },
  toggleFavourite: (contactId) => {
    const favourites = get().favourites.includes(contactId)
      ? get().favourites.filter((each) => each !== contactId)
      : [...get().favourites, contactId]
    keepPrefs(get().muted, favourites)
    set({ favourites })
  },
}))

/** The host's whole phone again (on connect, on the phone's changes, and as the page loads). */
export function receivePhoneState(state: PhoneState): void {
  announce(state.notifications)
  usePhone.setState(state)
  keepCaller(state)
}

/** The phone's notifications alone, as it posts and dismisses them: the rest of its state is unchanged, and isn't
 * sent again for their sake. `backlog`: the phone's whole list (a connect or a sync), which fills the list but
 * isn't announced as news. */
export function receivePhoneNotifications(notifications: PhoneNotification[], backlog = false): void {
  announce(notifications, backlog)
  usePhone.setState({ notifications })
  // The dialer's notification is what names a caller, and it comes after the call itself.
  keepCaller(usePhone.getState())
}

/** How long a notification stays over the cab, ms. */
const TOAST_SHOWN = 6000

/** The most up at once: the newest, the older ones giving way. */
const MOST_TOASTS = 3

/** A moment after the phone connects: what it sends then is its backlog (the host clears the list as it
 * connects), not news, and the cab doesn't say it again. */
const TOAST_QUIET = 5000

interface PhoneToasts {
  toasts: PhoneNotification[]
  show(notification: PhoneNotification): void
  drop(id: string): void
}

const toastTimers = new Map<string, ReturnType<typeof setTimeout>>()

/** The phone's newest notifications, over whatever the cab is showing (shell/PhoneAlerts.tsx): each arrives on its
 * own timer and goes on it, so nothing has to watch the phone's list to notice them. */
export const usePhoneToasts = create<PhoneToasts>()((set) => ({
  toasts: [],
  show: (notification) => {
    clearTimeout(toastTimers.get(notification.id))
    toastTimers.set(
      notification.id,
      setTimeout(() => usePhoneToasts.getState().drop(notification.id), TOAST_SHOWN),
    )
    set((state) => ({
      toasts: [notification, ...state.toasts.filter((each) => each.id !== notification.id)].slice(0, MOST_TOASTS),
    }))
  },
  drop: (id) => {
    clearTimeout(toastTimers.get(id))
    toastTimers.delete(id)
    set((state) => ({ toasts: state.toasts.filter((each) => each.id !== id) }))
  },
}))

/** What the phone had already said, by id and by its words: only what it says after this page has heard it is
 * news. `null` until the first snapshot, which is its backlog. */
let heard: Map<string, string> | null = null

/** Until when the phone's list is its own backlog (see TOAST_QUIET). */
let quietUntil = 0

/** Raises a toast for each notification that is new since last time: never an ongoing one (a control, not news),
 * and never one from the backlog the phone sends as it connects or syncs (which only fills the list). */
function announce(notifications: PhoneNotification[], backlog = false): void {
  if (notifications.length === 0) {
    // The host clears the list as the phone connects: what it sends next is what it already had.
    heard = new Map()
    quietUntil = Date.now() + TOAST_QUIET
    return
  }
  const said = new Map<string, string>()
  for (const notification of notifications) {
    const printed = `${notification.title ?? ''}\u0000${notification.text ?? ''}`
    said.set(notification.id, printed)
    if (heard === null || heard.get(notification.id) === printed) continue
    if (notification.ongoing) continue
    if (usePhonePrefs.getState().muted.includes(notification.package)) continue
    if (backlog || Date.now() < quietUntil) continue
    usePhoneToasts.getState().show(notification)
  }
  heard = said
}

/** What the phone said it couldn't do, shown in the Phone app once and then forgotten. `count` makes the same words
 * shown twice arrive as a new message (the app shows it again). */
interface PhoneFailure {
  error: string | null
  count: number
  fail(error: string): void
  clear(): void
}

export const usePhoneFailure = create<PhoneFailure>()((set) => ({
  error: null,
  count: 0,
  fail: (error) => set((state) => ({ error, count: state.count + 1 })),
  clear: () => set({ error: null }),
}))

/** Asks the phone to do something (sync, dismiss a notification, dial, answer or end a call). */
export function sendPhoneCommand(command: PhoneCommand): void {
  postToHost({ type: 'phone', command })
}

/** A contact's initials for its circle: the first letters of its first two words. */
export function initialsOf(name: string): string {
  const words = name
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .split(/\s+/)
    .filter(Boolean)
  const first = words[0]?.[0] ?? '?'
  const second = words.length > 1 ? words[1][0] : ''
  return (first + second).toLocaleUpperCase()
}

/** The name a call in the log goes by: the phone's name for the number, the number, or that it's unknown. */
export function recentWho(recent: PhoneRecent, unknown: string): string {
  return recent.name ?? (recent.number || unknown)
}

/** A number as digits alone, to match a call to a contact's: the phone spells them with spaces, dashes and a +. */
function digitsOf(number: string): string {
  return number.replace(/\D/g, '')
}

/**
 * The contact a call's number belongs to: the same digits, or the shorter of the two at the end of the longer (the
 * log's `5550102000` against the address book's `+1 555 010 2000`). A number too short to tell apart finds nobody,
 * so a call from a number it only shares a few digits with is never put in someone's row.
 */
export function contactFor(contacts: PhoneContact[], number: string): PhoneContact | null {
  const digits = digitsOf(number)
  let found: PhoneContact | null = null
  let longest = 0
  for (const contact of contacts) {
    for (const each of contact.numbers) {
      const theirs = digitsOf(each)
      const shared = Math.min(digits.length, theirs.length)
      if (shared < 6 || shared <= longest) continue
      if (digits === theirs || digits.endsWith(theirs) || theirs.endsWith(digits)) {
        found = contact
        longest = shared
      }
    }
  }
  return found
}

/** A caller on the line: the name and number known of them, or neither. */
export interface Caller {
  name: string | null
  number: string | null
}

const NOBODY: Caller = { name: null, number: null }

/** The parts of a package name that say it is the phone's dialer: the only thing that knows who is calling (the
 * link's own call message carries no number). */
const DIALER_PARTS = new Set(['dialer', 'incallui', 'telecom', 'call'])

/** Whether a notification came from the phone's dialer. */
function isDialer(packageName: string): boolean {
  return packageName
    .toLowerCase()
    .split('.')
    .some((part) => DIALER_PARTS.has(part))
}

/** The number in a line of a notification ("Mobile · +1 555 010 2000"), however the phone spells it. */
function numberIn(text: string): string | null {
  const found = text.match(/\+?\d[\d\s()\-.]{4,}\d/)
  return found ? found[0].trim() : null
}

/**
 * Who is calling: the name and number the phone gave for the call, or — as the Bridge sends neither — the dialer's
 * own notification for it, whose title is the caller's name and whose line is their number, looked up in the address
 * book when there is only a number to go on.
 */
export function callerOf(phone: PhoneState): Caller {
  const call = phone.call
  if (!call) return NOBODY
  if (call.name || call.number) return { name: call.name ?? null, number: call.number ?? null }
  const note = phone.notifications.find((each) => !each.ongoing && isDialer(each.package))
  const title = note?.title?.trim() ?? ''
  if (!note || !title) return NOBODY
  const number = numberIn(title) ?? (note.text ? numberIn(note.text) : null)
  const known = number ? contactFor(phone.contacts, number) : null
  if (known) return { name: known.name, number }
  // A number where the name would be, for someone the address book doesn't know: the number is all there is.
  if (number && !/\p{L}/u.test(title)) return { name: null, number }
  return { name: title, number }
}

/** The caller kept for one call, by the call's id: the dialer's notification goes as the call is answered, so the
 * name it gave stays with that call, and no other. */
interface CallerKept {
  id: string | null
  caller: Caller
  keep(id: string, caller: Caller): void
}

export const useCallerKept = create<CallerKept>()((set) => ({
  id: null,
  caller: NOBODY,
  keep: (id, caller) => set({ id, caller }),
}))

/** Who is on the call in progress (`id`): the phone's word for it, or the one its dialer gave. */
export function useCaller(id: string | null | undefined): Caller {
  return useCallerKept((state) => (state.id !== null && state.id === id ? state.caller : NOBODY))
}

/** Keeps the caller the phone named for the call now on the line: its next update may not name them again. */
function keepCaller(phone: PhoneState): void {
  const call = phone.call
  if (!call) return
  const caller = callerOf(phone)
  if (caller.name === null && caller.number === null) return
  useCallerKept.getState().keep(call.id, caller)
}

/** The contacts a search finds by name if it has letters, or by number if it has digits. */
export function contactsMatching(contacts: PhoneContact[], query: string): PhoneContact[] {
  const name = query.trim().toLocaleLowerCase()
  if (!name) return contacts
  const digits = name.replace(/\D/g, '')
  return contacts.filter(
    (contact) =>
      contact.name.toLocaleLowerCase().includes(name) ||
      (digits.length > 0 && contact.numbers.some((number) => number.replace(/\D/g, '').includes(digits))),
  )
}

/** The calls a search finds by the name the phone has, or by the number's digits. */
export function recentsMatching(recents: PhoneRecent[], query: string): PhoneRecent[] {
  const name = query.trim().toLocaleLowerCase()
  if (!name) return recents
  const digits = name.replace(/\D/g, '')
  return recents.filter(
    (recent) =>
      (recent.name ?? '').toLocaleLowerCase().includes(name) ||
      (digits.length > 0 && recent.number.replace(/\D/g, '').includes(digits)),
  )
}

/** The notifications the driver hasn't muted, in the phone's order. */
export function visibleNotifications(notifications: PhoneNotification[], muted: string[]): PhoneNotification[] {
  return notifications.filter((notification) => !muted.includes(notification.package))
}

/**
 * The phone's notifications that are news, as the count beside its app: the ones it isn't holding ongoing (a player,
 * a call in progress, which stay until the phone stops them) and none from the apps the driver muted here. A missed
 * call's notification is news, and stays news until the phone clears it.
 */
export function newsCount(notifications: PhoneNotification[], muted: string[]): number {
  return visibleNotifications(notifications, muted).filter((notification) => !notification.ongoing).length
}

/** The Phone app's pages: what the phone has waiting, its call log, its address book, a keypad, and its
 * notifications. */
export type PhoneTab = 'overview' | 'recents' | 'contacts' | 'keypad' | 'notifications'

/** The page the Phone app was asked to open on (a notification card's button wants its list): kept until it mounts. */
let wantedTab: PhoneTab | null = null

/** Asks the Phone app to open on `tab` (the notification stack does, before opening it). */
export function wantPhoneTab(tab: PhoneTab): void {
  wantedTab = tab
}

/** The page asked for, taken once: the app reads it as it mounts, and its own tabs go from there. */
export function takeWantedPhoneTab(): PhoneTab | null {
  const tab = wantedTab
  wantedTab = null
  return tab
}

/** The contacts with the favourites first, each group keeping the phone's own order. */
export function favouritesFirst(contacts: PhoneContact[], favourites: string[]): PhoneContact[] {
  if (favourites.length === 0) return contacts
  return [...contacts].sort((a, b) => Number(favourites.includes(b.id)) - Number(favourites.includes(a.id)))
}
