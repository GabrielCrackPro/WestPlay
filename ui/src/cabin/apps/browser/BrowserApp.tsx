import type { ReactNode } from 'react'
import { TextField } from '../../keyboard/TextField'
import { useText } from '../../state/text'
import {
  back,
  type Bookmark,
  closePage,
  forward,
  hostOf,
  openAddress,
  openBookmark,
  reload,
  setAddress,
  toggleBookmark,
  useBrowser,
} from './browser'
import { PageHole } from './PageHole'
import './browser.css'

/**
 * The Browser app: the web in the cabin, its toolbar laid out as CarPlay's browsers lay theirs — Back,
 * Forward, Reload, the address, and the page's bookmark — over the page or, with no page open, over the
 * start page's bookmarks. The page itself is the host's (crates/host browser_web.rs): this draws what goes
 * round it and says where.
 */
export function BrowserApp() {
  const text = useText()
  const page = useBrowser((store) => store.state)
  const address = useBrowser((store) => store.address)
  const refused = useBrowser((store) => store.refused)
  const bookmarks = useBrowser((store) => store.bookmarks)
  const saved = page !== null && bookmarks.some((bookmark) => bookmark.url === page.url)

  return (
    <section className="app-panel browser-app" aria-label={text.apps.browser}>
      <div className="browser-bar">
        <button
          type="button"
          className="browser-button"
          aria-label={text.browser.back}
          disabled={page === null}
          onClick={back}
        >
          <Back />
        </button>
        <button
          type="button"
          className="browser-button"
          aria-label={text.browser.forward}
          disabled={page === null}
          onClick={forward}
        >
          <Forward />
        </button>
        <TextField
          id="browser-address"
          value={address}
          onChange={setAddress}
          onSubmit={() => openAddress(address)}
          hint={text.browser.addressHint}
          label={text.browser.address}
          icon={<Globe />}
        />
        <button
          type="button"
          className="browser-button"
          aria-label={text.browser.reload}
          disabled={page === null}
          onClick={reload}
        >
          <Reload />
        </button>
        <button
          type="button"
          className={saved ? 'browser-button saved' : 'browser-button'}
          aria-label={saved ? text.browser.removeBookmark : text.browser.bookmark}
          disabled={page === null}
          onClick={() => page && toggleBookmark(page.url, page.title)}
        >
          <Star filled={saved} />
        </button>
        <button
          type="button"
          className="browser-button"
          aria-label={text.browser.close}
          disabled={page === null}
          onClick={closePage}
        >
          <Close />
        </button>
      </div>

      <div className="browser-now">
        {page ? (
          <>
            <span className="browser-title">{page.title || hostOf(page.url)}</span>
            <span className="browser-url">{hostOf(page.url)}</span>
            {page.loading && <span className="browser-loading" aria-hidden />}
          </>
        ) : refused ? (
          <span className="browser-refused">{text.browser.cannotOpen}</span>
        ) : null}
      </div>

      {page ? <PageHole /> : <StartPage bookmarks={bookmarks} />}
    </section>
  )
}

/** Nothing open: the bookmarks, as big tiles (a new browser's would be empty). */
function StartPage({ bookmarks }: { bookmarks: Bookmark[] }) {
  const text = useText()
  if (bookmarks.length === 0) {
    return (
      <div className="browser-start empty">
        <Globe large />
        <p className="browser-empty-title">{text.browser.noBookmarks}</p>
        <p className="browser-empty-text">{text.browser.startHint}</p>
      </div>
    )
  }
  return (
    <div className="browser-start">
      <h2 className="browser-start-title">{text.browser.bookmarks}</h2>
      <ul className="browser-tiles">
        {bookmarks.map((bookmark) => (
          <li key={bookmark.url}>
            <button type="button" className="browser-tile" onClick={() => openBookmark(bookmark)}>
              <span className="browser-tile-letter" aria-hidden>
                {hostOf(bookmark.url).slice(0, 1).toUpperCase()}
              </span>
              <span className="browser-tile-title">{bookmark.title || hostOf(bookmark.url)}</span>
              <span className="browser-tile-host">{hostOf(bookmark.url)}</span>
            </button>
          </li>
        ))}
      </ul>
      <p className="browser-hint">{text.browser.startHint}</p>
    </div>
  )
}

function glyph(children: ReactNode, size = 22) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden>
      {children}
    </svg>
  )
}

function Back() {
  return glyph(
    <path
      d="M14.5 5 L7.5 12 L14.5 19"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />,
  )
}

function Forward() {
  return glyph(
    <path
      d="M9.5 5 L16.5 12 L9.5 19"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />,
  )
}

function Reload() {
  return glyph(
    <>
      <path d="M19 12a7 7 0 1 1-2.6-5.4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <path d="M19 4.5V9h-4.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </>,
  )
}

function Close() {
  return glyph(<path d="M6 6 L18 18 M18 6 L6 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />)
}

function Star({ filled }: { filled: boolean }) {
  return glyph(
    <path
      d="M12 3.6l2.5 5.1 5.6.8-4 3.9.9 5.6-5-2.7-5 2.7.9-5.6-4-3.9 5.6-.8z"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinejoin="round"
      fill={filled ? 'currentColor' : 'none'}
    />,
  )
}

function Globe({ large = false }: { large?: boolean }) {
  return glyph(
    <>
      <circle cx="12" cy="12" r="8.2" stroke="currentColor" strokeWidth="1.7" />
      <path
        d="M3.8 12h16.4M12 3.8c2.3 2.3 3.4 5.2 3.4 8.2s-1.1 5.9-3.4 8.2c-2.3-2.3-3.4-5.2-3.4-8.2S9.7 6.1 12 3.8z"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinejoin="round"
      />
    </>,
    large ? 54 : 20,
  )
}
