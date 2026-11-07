import { type PointerEvent as ReactPointerEvent, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { useSettings } from '../apps/settings/settings'
import { useAppIcon } from '../state/hooks'
import { BrandIcon } from '../shell/BrandIcon'
import { type AppId, APPS, PINNED_LIMIT, visibleHomeApps } from '../state/apps'
import { launchingNow, useLaunchStyle } from '../state/launch'
import { unreadCount, useNotes } from '../shell/notesShown'
import { go, useCabin } from '../state/store'
import { useText } from '../state/text'
import { textScale } from '../state/textSize'
import { CELL, COMPACT_CELL, LABEL_LINES, pagesOf, pageSize, rowLayout } from './pages'
import './home.css'

/** How long an app is held before it's picked up to move, ms: a shorter press is a tap, which opens it. */
const HOLD_MS = 420
/** How far the pointer may stray while a press is held before it's the page's drag, not a hold, page pixels. */
const HOLD_SLOP = 8
/** How close to the pages' edge a picked-up app turns the page, page pixels. */
const TURN_EDGE = 48

/** An app picked up from the grid, following the pointer until it's dropped. */
interface Picked {
  app: AppId
  x: number
  y: number
  /** Where it was picked up: let go there, it's the app's menu, not a move. */
  fromX: number
  fromY: number
  /** Its cell, for the menu's place under it. */
  element: HTMLElement
  /** The app it would land on, if any: the cell shows the line it goes before or after. */
  over: AppId | null
  after: boolean
}

/** The press that may become a hold: where it began, and the app's button (marked while it's picked up). */
interface Press {
  app: AppId
  x: number
  y: number
  element: HTMLElement
}

/** The app under a point, and which half of it the point is on: a drop goes before or after it. */
function appUnder(x: number, y: number): { app: AppId; after: boolean } | null {
  const element = document.elementFromPoint(x, y)?.closest<HTMLElement>('.app')
  const app = element?.dataset.app as AppId | undefined
  if (!element || !app) return null
  const rect = element.getBoundingClientRect()
  return { app, after: x > rect.left + rect.width / 2 }
}

/**
 * CarPlay-style Home: the app grid next to the sidebar, in pages as CarPlay's: as many columns and rows as the
 * screen fits (pages.ts), the next page a drag sideways away (shell/dragScroll.ts), with a dot for each page
 * below. Holding an app picks it up; it follows the pointer, others make room where it's dropped, and dragging it
 * to a page's edge turns the page. Let go where it began, it's the app's menu instead — pin it, or hide it from
 * Home — as a right-click opens it.
 */
export function Home() {
  const pagesElement = useRef<HTMLDivElement>(null)
  const [size, setSize] = useState({ columns: 4, rows: 2, compact: false, height: 0 })
  const [page, setPage] = useState(0)
  // The labels grow with the player's Text Size, and the cells with them.
  const scale = textScale(useCabin((state) => state.textSize))
  // Home's apps, in the player's order, less the ones hidden in Settings › Home Screen.
  const order = useCabin((state) => state.homeOrder)
  const hidden = useCabin((state) => state.homeHidden)
  const apps = useMemo(() => visibleHomeApps(order, hidden), [order, hidden])
  const text = useText()
  const names = text.apps
  // The notes the cab raised while the driver wasn't looking at the Notifications app: its icon's badge.
  const unread = useNotes((state) => unreadCount(state.history, state.seen))
  // Each app's label's lines as drawn (a long name takes two): the rows are as tall as their names need.
  const [lines, setLines] = useState<Partial<Record<AppId, number>>>({})
  // Home mounting as an app closes into its icon: the icons are the transition's, so they don't animate in.
  // Read once, at mount: a live flag would let the entrance start as the transition ended (a flash of icons).
  const [animateIn] = useState(() => !launchingNow())
  // The app held and following the pointer, and the press that becomes the hold (Home.tsx's `begin`).
  const [picked, setPicked] = useState<Picked | null>(null)
  const pickedRef = useRef<Picked | null>(null)
  const press = useRef<Press | null>(null)
  const hold = useRef(0)
  // A drag doesn't open the app it was let go over.
  const suppress = useRef(false)
  // The app's own menu: a right-click opens it, or a hold let go where it began. Its first item takes the focus.
  const [menu, setMenu] = useState<{ app: AppId; x: number; y: number } | null>(null)
  const menuElement = useRef<HTMLDivElement>(null)
  const menuFirst = useRef<HTMLButtonElement>(null)
  const pinned = useCabin((state) => state.pinnedApps)
  const setPinned = useCabin((state) => state.setPinnedApp)
  const setHidden = useCabin((state) => state.setHomeAppHidden)

  useLayoutEffect(() => {
    const element = pagesElement.current
    if (!element) return
    const measure = () => {
      const next = { ...pageSize(element.clientWidth, element.clientHeight, scale), height: element.clientHeight }
      setSize((current) =>
        current.columns === next.columns &&
        current.rows === next.rows &&
        current.compact === next.compact &&
        current.height === next.height
          ? current
          : next,
      )
    }
    measure()
    const resized = new ResizeObserver(measure)
    resized.observe(element)
    return () => resized.disconnect()
  }, [scale])

  // The names' lines, at the columns' width: again as the columns, the text or its size change, and once the web
  // font is in (a fallback font's names wrap elsewhere).
  useLayoutEffect(() => {
    const element = pagesElement.current
    if (!element) return
    const count = () => {
      const found: Partial<Record<AppId, number>> = {}
      for (const label of element.querySelectorAll<HTMLElement>('.app .label')) {
        const app = label.parentElement?.dataset.app as AppId | undefined
        if (!app) continue
        const style = getComputedStyle(label)
        const line = parseFloat(style.lineHeight)
        const text = label.clientHeight - parseFloat(style.paddingTop) - parseFloat(style.paddingBottom)
        found[app] = line > 0 ? Math.min(LABEL_LINES, Math.max(1, Math.round(text / line))) : 1
      }
      setLines((current) => (apps.every((app) => current[app] === found[app]) ? current : found))
    }
    count()
    let active = true
    document.fonts.ready.then(() => active && count())
    return () => {
      active = false
    }
  }, [size.columns, size.compact, scale, names, apps])

  const cell = size.compact ? COMPACT_CELL : CELL
  const rows = rowLayout(
    cell,
    scale,
    size.height,
    size.columns,
    size.rows,
    apps.map((app) => lines[app] ?? 1),
  )
  const pages = pagesOf(apps, size.columns * rows.rows)
  // Hiding the apps on the page the player is on brings the screen back to the first one.
  useEffect(() => {
    if (page < pages.length) return
    setPage(0)
    pagesElement.current?.scrollTo({ left: 0 })
  }, [page, pages.length])
  const turnTo = (index: number) => {
    const element = pagesElement.current
    element?.scrollTo({ left: index * element.clientWidth, behavior: 'smooth' })
  }

  const setPickedNow = (next: Picked | null) => {
    pickedRef.current = next
    setPicked(next)
  }

  const openMenu = (app: AppId, x: number, y: number) => {
    setMenu({ app, x, y })
  }

  // The menu closes on a press anywhere but itself, and on Escape.
  useEffect(() => {
    if (!menu) return
    menuFirst.current?.focus()
    const pressOutside = (event: PointerEvent) => {
      const target = event.target
      if (target instanceof Node && menuElement.current?.contains(target)) return
      setMenu(null)
    }
    const key = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setMenu(null)
    }
    window.addEventListener('pointerdown', pressOutside, true)
    window.addEventListener('keydown', key)
    return () => {
      window.removeEventListener('pointerdown', pressOutside, true)
      window.removeEventListener('keydown', key)
    }
  }, [menu])

  // Held long enough: the app is picked up. Its button is marked so the page's drag-to-scroll leaves it alone
  // (shell/dragScroll.ts), and it stays where it was until dropped.
  const begin = (app: AppId) => {
    const start = press.current
    if (!start || start.app !== app) return
    start.element.dataset.ownDrag = 'true'
    setPickedNow({
      app,
      x: start.x,
      y: start.y,
      fromX: start.x,
      fromY: start.y,
      element: start.element,
      over: null,
      after: false,
    })
  }

  const down = (app: AppId, event: ReactPointerEvent<HTMLButtonElement>) => {
    if (event.button !== 0) return
    // The pointer may leave the button while it's dragged: keep its events coming to it.
    event.currentTarget.setPointerCapture(event.pointerId)
    press.current = { app, x: event.clientX, y: event.clientY, element: event.currentTarget }
    window.clearTimeout(hold.current)
    hold.current = window.setTimeout(() => begin(app), HOLD_MS)
  }

  // Moved before the hold: the press is the page's, to scroll (a tap still opens the app on the way up).
  const move = (event: ReactPointerEvent<HTMLButtonElement>) => {
    const start = press.current
    if (!start || pickedRef.current) return
    if (Math.hypot(event.clientX - start.x, event.clientY - start.y) > HOLD_SLOP) {
      window.clearTimeout(hold.current)
      press.current = null
    }
  }

  const up = () => {
    window.clearTimeout(hold.current)
    // Picked up, the pointer's up is the drop's (below), whatever it's over.
    if (!pickedRef.current) press.current = null
  }

  useEffect(() => () => window.clearTimeout(hold.current), [])

  // A picked-up app follows the pointer, over the grid's cells: the one under it shows where it would go, and at a
  // page's edge the pages turn (so it can go to another page). Let go, it's dropped where it was.
  useEffect(() => {
    if (picked === null) return
    const pagesEl = pagesElement.current
    const total = pages.length
    const turn = (index: number) => {
      if (!pagesEl) return
      pagesEl.scrollTo({ left: index * pagesEl.clientWidth })
      setPage(index)
    }
    const dragged = (event: PointerEvent) => {
      const current = pickedRef.current
      if (!current) return
      event.preventDefault()
      if (pagesEl) {
        const rect = pagesEl.getBoundingClientRect()
        const at = Math.round(pagesEl.scrollLeft / Math.max(1, pagesEl.clientWidth))
        if (event.clientX < rect.left + TURN_EDGE && at > 0) turn(at - 1)
        else if (event.clientX > rect.right - TURN_EDGE && at < total - 1) turn(at + 1)
      }
      const hit = appUnder(event.clientX, event.clientY)
      setPickedNow({
        ...current,
        x: event.clientX,
        y: event.clientY,
        over: hit && hit.app !== current.app ? hit.app : null,
        after: hit?.after ?? false,
      })
    }
    const dropped = (event: PointerEvent) => {
      const current = pickedRef.current
      if (!current) return
      const hit = appUnder(event.clientX, event.clientY)
      if (hit && hit.app !== current.app) {
        useCabin.getState().moveHomeAppTo(current.app, hit.app, hit.after)
      } else if (Math.hypot(event.clientX - current.fromX, event.clientY - current.fromY) < HOLD_SLOP) {
        // Held and let go where it began: the app's menu, as a right-click opens it.
        const rect = current.element.getBoundingClientRect()
        setMenu({ app: current.app, x: rect.left + rect.width / 2, y: rect.bottom - 8 })
      }
      // The press that follows the drop isn't a tap on the app.
      suppress.current = true
      window.setTimeout(() => (suppress.current = false), 500)
      document.querySelector<HTMLElement>('.app[data-own-drag]')?.removeAttribute('data-own-drag')
      press.current = null
      setPickedNow(null)
    }
    window.addEventListener('pointermove', dragged)
    window.addEventListener('pointerup', dropped)
    window.addEventListener('pointercancel', dropped)
    return () => {
      window.removeEventListener('pointermove', dragged)
      window.removeEventListener('pointerup', dropped)
      window.removeEventListener('pointercancel', dropped)
    }
    // The listeners read the picked app through its ref; a new pick doesn't need them replaced.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [picked === null, pages.length])

  return (
    <section className="screen home" aria-label="Home">
      <div
        ref={pagesElement}
        className={[size.compact ? 'home-pages compact' : 'home-pages', animateIn ? '' : 'no-enter'].join(' ')}
        onScroll={(event) => {
          const element = event.currentTarget
          setPage(Math.round(element.scrollLeft / Math.max(1, element.clientWidth)))
        }}
      >
        {pages.map((apps, index) => (
          <div
            key={index}
            className="home-grid"
            // Every page has the page's whole grid: a page with fewer apps has them where the first has its. The rows
            // the first page fills, not all that fit: seven apps in two rows centred, not at the top of three (owner
            // 2026-10-24: "icons are too close to the top").
            style={{
              gridTemplateColumns: `repeat(${size.columns}, minmax(0, 1fr))`,
              gridTemplateRows: rows.heights.map((height) => `${height}px`).join(' '),
              rowGap: rows.gap,
            }}
          >
            {apps.map((id, index) => (
              <HomeApp
                key={id}
                app={id}
                badge={id === 'notifications' ? unread : 0}
                // Home's icons come in one after another, a moment behind each other (home.css).
                delay={index * 30}
                picked={picked?.app === id}
                drop={picked?.over === id ? (picked.after ? 'after' : 'before') : null}
                menuOpen={menu?.app === id}
                onMenu={(x, y) => openMenu(id, x, y)}
                onOpen={() => {
                  if (suppress.current) {
                    suppress.current = false
                    return
                  }
                  go({ type: 'openApp', app: id }, 'home')
                }}
                onPointerDown={(event) => down(id, event)}
                onPointerMove={move}
                onPointerUp={up}
                onPointerCancel={up}
              />
            ))}
          </div>
        ))}
      </div>
      {pages.length > 1 && (
        <div className="home-dots">
          {pages.map((_, index) => (
            <button
              key={index}
              type="button"
              className={index === page ? 'home-dot shown' : 'home-dot'}
              aria-label={`${index + 1} / ${pages.length}`}
              aria-current={index === page}
              onClick={() => turnTo(index)}
            />
          ))}
        </div>
      )}
      {picked && <DragGhost app={picked.app} x={picked.x} y={picked.y} compact={size.compact} />}
      {menu && (
        <div
          ref={menuElement}
          className="home-menu glass"
          role="menu"
          aria-label={names[menu.app]}
          style={{ left: menu.x, top: menu.y }}
        >
          <span className="home-menu-title">{names[menu.app]}</span>
          <button
            type="button"
            role="menuitem"
            ref={menuFirst}
            disabled={!pinned.includes(menu.app) && pinned.length >= PINNED_LIMIT}
            onClick={() => {
              setPinned(menu.app, !pinned.includes(menu.app))
              setMenu(null)
            }}
          >
            <PinGlyph />
            <span>{pinned.includes(menu.app) ? text.settings.unpinFromSidebar : text.settings.pinToSidebar}</span>
          </button>
          <button
            type="button"
            role="menuitem"
            disabled={apps.length <= 1}
            onClick={() => {
              setHidden(menu.app, true)
              setMenu(null)
            }}
          >
            <HideGlyph />
            <span>{text.settings.hideFromHome}</span>
          </button>
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              setMenu(null)
              // Settings opens on its Home Screen page, not where it was last left (SettingsApp.tsx reads this).
              useSettings.setState({ page: 'home', went: 'none' })
              go({ type: 'openApp', app: 'settings' }, 'home')
            }}
          >
            <EditGlyph />
            <span>{text.settings.editHomeScreen}</span>
          </button>
        </div>
      )}
    </section>
  )
}

/**
 * An app on Home. Its icon is what the app grows out of when it opens, and shrinks back into. `badge` counts what
 * the app has for the driver (the Notifications app's unread notes): none shows nothing.
 */
function HomeApp({
  app,
  badge,
  delay,
  picked,
  drop,
  menuOpen,
  onMenu,
  onOpen,
  onPointerDown,
  onPointerMove,
  onPointerUp,
  onPointerCancel,
}: {
  app: AppId
  badge: number
  delay: number
  picked: boolean
  drop: 'before' | 'after' | null
  menuOpen: boolean
  onMenu(x: number, y: number): void
  onOpen(): void
  onPointerDown(event: ReactPointerEvent<HTMLButtonElement>): void
  onPointerMove(event: ReactPointerEvent<HTMLButtonElement>): void
  onPointerUp(): void
  onPointerCancel(): void
}) {
  const launch = useLaunchStyle(app, { kind: 'icon', origin: 'home' })
  const text = useText()
  const icon = useAppIcon(APPS[app].icon)
  return (
    <button
      type="button"
      className={['app', picked ? 'dragging' : '', drop ? `drop-${drop}` : ''].filter(Boolean).join(' ')}
      data-app={app}
      aria-haspopup="menu"
      aria-expanded={menuOpen}
      style={{ animationDelay: `${delay}ms` }}
      onClick={onOpen}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerCancel}
      onPointerLeave={onPointerUp}
      onContextMenu={(event) => {
        event.preventDefault()
        onMenu(event.clientX, event.clientY)
      }}
    >
      <span className="app-icon">
        {/* The Driver app is the player's own truck's: its icon is the truck's brand, as on the boot screen. */}
        {app === 'driver' ? <BrandIcon style={launch} /> : <img src={icon} alt="" style={launch} />}
        {badge > 0 && (
          <span className="app-badge" key={badge} aria-label={text.notificationsApp.summary(badge)}>
            {badge > 99 ? '99+' : badge}
          </span>
        )}
      </span>
      <span className="label">{text.apps[app]}</span>
    </button>
  )
}

/** The menu's pin: the app stays where it's put. */
function PinGlyph() {
  return (
    <svg
      viewBox="0 0 24 24"
      width="24"
      height="24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M9 3h6l-1 6 4 3H6l4-3-1-6Z" />
      <path d="M12 12v9" />
    </svg>
  )
}

/** The menu's edit: sliders, the settings' own shape. */
function EditGlyph() {
  return (
    <svg
      viewBox="0 0 24 24"
      width="24"
      height="24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      aria-hidden
    >
      <path d="M4 7h10M18 7h2M4 17h4M12 17h8" />
      <circle cx="16" cy="7" r="2.2" />
      <circle cx="10" cy="17" r="2.2" />
    </svg>
  )
}

/** The menu's hide: an eye, struck through. */
function HideGlyph() {
  return (
    <svg
      viewBox="0 0 24 24"
      width="24"
      height="24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12Z" />
      <circle cx="12" cy="12" r="3" />
      <path d="m4 4 16 16" />
    </svg>
  )
}

/** The app picked up, following the pointer: the icon only, so the cell it's over stays seen. */
function DragGhost({ app, x, y, compact }: { app: AppId; x: number; y: number; compact: boolean }) {
  const icon = useAppIcon(APPS[app].icon)
  return (
    <div className={compact ? 'app-ghost compact' : 'app-ghost'} style={{ left: x, top: y }} aria-hidden>
      {app === 'driver' ? <BrandIcon /> : <img src={icon} alt="" />}
    </div>
  )
}
