import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'
import { type BrowserCommand, type BrowserState, postToHost } from '../../../shared/host'

/**
 * The Browser app: a web page in the cabin, shown by the host under the CarPlay area (westplay_host::
 * browser_web), its toolbar the app's own, and the bookmarks kept on this PC as its start page.
 *
 * One page at a time, no tabs: the address field, Back and Forward are the page's whole chrome, as a head
 * unit's browser has them.
 */
interface BrowserStore {
  /** What the page shows (the host says); `null`: no page open (the start page shows). */
  state: BrowserState | null
  /** The address as typed in the toolbar (the page's own as each one loads). */
  address: string
  /** The address typed isn't one the web can open (the toolbar says so). */
  refused: boolean
  /** The start page's tiles, newest first. */
  bookmarks: Bookmark[]
  /** Where the page shows through the CarPlay area, in its CSS pixels (Shell.tsx cuts it open there). */
  hole: BrowserHole | null
}

/** A rounded rectangle of the CarPlay area, in its CSS pixels. */
export interface BrowserHole {
  x: number
  y: number
  width: number
  height: number
  radius: number
}

export interface Bookmark {
  url: string
  title: string
}

/** How many bookmarks are kept. */
const BOOKMARKS_KEPT = 24

export const useBrowser = create<BrowserStore>()(
  persist((): BrowserStore => ({ state: null, address: '', refused: false, bookmarks: [], hole: null }), {
    name: 'westplay.browser',
    version: 1,
    storage: createJSONStorage(() => localStorage),
    partialize: (store) => ({ bookmarks: store.bookmarks }),
    // Kept by an earlier WestPlay (or edited): only web addresses, each once.
    merge: (stored, current) => ({
      ...current,
      bookmarks: keptBookmarks((stored as Partial<BrowserStore> | undefined)?.bookmarks),
    }),
  }),
)

/** The bookmarks kept of `saved`: web addresses only, each once, the newest first. */
function keptBookmarks(saved: unknown): Bookmark[] {
  const kept: Bookmark[] = []
  for (const bookmark of Array.isArray(saved) ? saved : []) {
    const url = typeof bookmark?.url === 'string' ? webAddress(bookmark.url) : null
    if (!url || kept.some((kept) => kept.url === url)) continue
    kept.push({ url, title: typeof bookmark.title === 'string' ? bookmark.title.slice(0, 200) : '' })
  }
  return kept.slice(0, BOOKMARKS_KEPT)
}

/** Tells the Browser's page to do something. */
export function command(command: BrowserCommand): void {
  postToHost({ type: 'browser', command })
}

/**
 * `text` as a web address: a bare host gets `https://`, and only `http` and `https` are addresses (`null` for
 * anything else: the page's own rules are the host's, this only spares it the trip).
 */
export function webAddress(text: string): string | null {
  const trimmed = text.trim()
  if (!trimmed || trimmed.split(/\s+/).length !== 1) return null
  const address = trimmed.includes('://') ? trimmed : `https://${trimmed}`
  const [scheme, rest = ''] = address.split('://')
  if (!/^https?$/i.test(scheme)) return null
  const host = (rest.split(/[/?#]/)[0].split('@').at(-1) ?? '').split(':')[0]
  if (!host || (!host.includes('.') && !host.startsWith('localhost'))) return null
  return address
}

/** Opens `text` as an address, or says it isn't one. */
export function openAddress(text: string): void {
  const url = webAddress(text)
  if (!url) {
    useBrowser.setState({ refused: true, address: text })
    return
  }
  useBrowser.setState({ refused: false, address: url })
  command({ action: 'open', url })
}

/** Opens one of the start page's bookmarks. */
export function openBookmark(bookmark: Bookmark): void {
  openAddress(bookmark.url)
}

/** The toolbar's address, as typed. */
export function setAddress(address: string): void {
  useBrowser.setState({ address, refused: false })
}

/** Back and forward through the page's own history. */
export function back(): void {
  command({ action: 'back' })
}

export function forward(): void {
  command({ action: 'forward' })
}

export function reload(): void {
  command({ action: 'reload' })
}

/** Leaves the page for the start page: its WebView closes, and the app opens it again for the next address. */
export function closePage(): void {
  command({ action: 'close' })
  useBrowser.setState({ state: null, address: '', refused: false })
}

/** Keeps the page as a bookmark, or forgets it. */
export function toggleBookmark(url: string, title: string): void {
  const address = webAddress(url)
  if (!address) return
  useBrowser.setState((store) => {
    const kept = store.bookmarks.some((bookmark) => bookmark.url === address)
    return {
      bookmarks: kept
        ? store.bookmarks.filter((bookmark) => bookmark.url !== address)
        : [{ url: address, title: title.slice(0, 200) }, ...store.bookmarks].slice(0, BOOKMARKS_KEPT),
    }
  })
}

/** What the Browser's page says shows (its address and title), as each page loads. */
export function receiveBrowserState(state: BrowserState | null): void {
  useBrowser.setState((store) => ({ state, address: state?.url ?? store.address }))
}

/** The host's name for an address, as a bookmark tile shows it ("example.com"). */
export function hostOf(url: string): string {
  const rest = url.split('://').at(-1) ?? url
  return rest.split(/[/?#]/)[0].replace(/^www\./, '')
}
