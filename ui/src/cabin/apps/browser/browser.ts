import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'
import {
  type BrowserCommand,
  type BrowserKey,
  type BrowserPointer,
  type BrowserState,
  postToHost,
} from '../../../shared/host'

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
  /** Whether a field of the page has its focus: the cabin's keyboard types into it then. */
  editable: boolean
  /** The start page's tiles, newest first. */
  bookmarks: Bookmark[]
  /** Where the page shows through the CarPlay area, in its CSS pixels (Shell.tsx cuts it open there). */
  hole: BrowserHole | null
  /** How large the page shows (1: as laid out), and whether it says it's a phone (the sites that send another
   * version then): the app's settings, kept on this PC. */
  zoom: number
  mobile: boolean
  /** The settings show, in the page's place. */
  configuring: boolean
}

/** The zooms the settings offer. */
export const ZOOMS = [0.8, 1, 1.25, 1.5] as const

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
  persist(
    (): BrowserStore => ({
      state: null,
      address: '',
      refused: false,
      editable: false,
      bookmarks: [],
      hole: null,
      zoom: 1,
      mobile: false,
      configuring: false,
    }),
    {
      name: 'westplay.browser',
      version: 1,
      storage: createJSONStorage(() => localStorage),
      partialize: (store) => ({ bookmarks: store.bookmarks, zoom: store.zoom, mobile: store.mobile }),
      // Kept by an earlier WestPlay (or edited): only web addresses, each once, and a zoom it offers.
      merge: (stored, current) => {
        const kept = stored as Partial<BrowserStore> | undefined
        return {
          ...current,
          bookmarks: keptBookmarks(kept?.bookmarks),
          zoom: ZOOMS.find((zoom) => zoom === kept?.zoom) ?? 1,
          mobile: kept?.mobile === true,
        }
      },
    },
  ),
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
  useBrowser.setState({ refused: false, address: url, configuring: false })
  // The page as the settings have it (a WebView started for this address starts with them).
  configure()
  command({ action: 'open', url })
}

/** Tells the page how the app's settings have it: its zoom, and what it says it is. */
export function configure(): void {
  const { zoom, mobile } = useBrowser.getState()
  command({ action: 'configure', zoom, mobile })
}

/** How large the page shows (the sites lay themselves out for it, as for a smaller screen). */
export function setZoom(zoom: number): void {
  useBrowser.setState({ zoom })
  configure()
}

/** Whether the page says it's a phone: the sites that send a simpler version then. */
export function setMobile(mobile: boolean): void {
  useBrowser.setState({ mobile })
  configure()
}

/** The settings, in the page's place (its picture goes while they show). */
export function showSettings(configuring: boolean): void {
  useBrowser.setState({ configuring, editable: false })
}

/** Forgets the page's cookies (signing out of the sites opened here) and loads it again. */
export function clearData(): void {
  command({ action: 'clear' })
}

/** Forgets every bookmark (the start page's tiles). */
export function forgetBookmarks(): void {
  useBrowser.setState({ bookmarks: [] })
}

/** A mouse event for the page, as it happens (the page's own chrome: clicks, drags, the wheel). */
export function pointer(event: { kind: BrowserPointer; x: number; y: number; pressed: boolean; data?: number }): void {
  command({ action: 'pointer', ...event })
}

/** Text the player typed, or a key with its own meaning, into the field the page has focused. */
export function typeIntoPage(event: { text?: string; key?: BrowserKey }): void {
  command({ action: 'type', ...event })
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
  useBrowser.setState({ state: null, address: '', refused: false, editable: false, configuring: false })
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
  useBrowser.setState((store) => ({
    state,
    address: state?.url ?? store.address,
    editable: state ? store.editable : false,
  }))
}

/** Whether the page has a field to type into, as it says as its focus moves. */
export function receiveBrowserFocus(editable: boolean): void {
  useBrowser.setState({ editable })
}

/** The host's name for an address, as a bookmark tile shows it ("example.com"). */
export function hostOf(url: string): string {
  const rest = url.split('://').at(-1) ?? url
  return rest.split(/[/?#]/)[0].replace(/^www\./, '')
}
