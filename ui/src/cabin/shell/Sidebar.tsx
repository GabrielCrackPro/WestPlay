import { type PointerEvent as ReactPointerEvent, useEffect, useRef, useState } from 'react'
import { formatGameTime, formatRealTime } from '../../shared/format'
import { logoSources } from '../boot/brand'
import { useAppIcon, useScreenProfile } from '../state/hooks'
import { BrandIcon } from './BrandIcon'
import { type AppId, APPS, PINNED_LIMIT } from '../state/apps'
import { LAUNCH_STYLE, useCarriesLaunch } from '../state/launch'
import { homeButtonTarget, type Route } from '../state/navigation'
import { go, useCabin, useLive } from '../state/store'
import { useText } from '../state/text'
import { cabClock } from '../../shared/host'
import { unreadCount, useNotes } from './notesShown'

/** How long an icon is held before its menu opens, ms: a press is a tap, which opens the app. */
const HOLD_MS = 450
/** How far the pointer may stray during a hold before it's a drag rather than a long press, px. */
const HOLD_SLOP = 10

/**
 * The CarPlay sidebar: the truck's brand and clock, the apps (the pinned ones at the top, in the order they were
 * pinned, then the recent ones, the open one on top), and the Home button.
 *
 * The clock is the player's own time or the game's, as Settings › Dashboard has it; the player's is their PC's,
 * so it keeps time while the game is paused.
 */
export function Sidebar() {
  const recents = useCabin((state) => state.navigation.recents)
  const pinned = useCabin((state) => state.pinnedApps)
  const route = useCabin((state) => state.navigation.route)
  const homeTarget = useCabin((state) => homeButtonTarget(state.navigation))
  const clock = useCabin((state) => state.clock)
  const gameTime = useLive((state) => (state.telemetry ? cabClock(state.telemetry, state.clockShift) : null))
  const realTime = useRealTime()
  const shown = useScreenProfile().recents ?? 3
  // What the Notifications app has that the driver hasn't looked at: its recent carries the count, as Home's icon
  // does, so a note raised while driving is still found from any screen.
  const unread = useNotes((state) => unreadCount(state.history, state.seen))
  const time = clock === 'real' ? formatRealTime(realTime) : gameTime === null ? null : formatGameTime(gameTime)
  // The pinned apps where the player put them, then the recents filling the room the screen's sidebar has left (an
  // app that's pinned isn't drawn twice).
  const pinnedShown = pinned.slice(0, PINNED_LIMIT)
  const pinnedSet = new Set(pinnedShown)
  const recentShown = recents.filter((app) => !pinnedSet.has(app)).slice(0, Math.max(1, shown - pinnedShown.length))
  // One icon's menu at a time: the one just right-clicked or held, remembered with the screen it was opened on, so
  // an app opening from anywhere (a keybind, a note) puts it away by itself.
  const [menu, setMenu] = useState<{ app: AppId; route: Route } | null>(null)
  const menuFor = menu !== null && menu.route === route ? menu.app : null
  // A press anywhere but the open menu, or the icon it belongs to (whose own press puts it away), closes it; so
  // does Escape.
  useEffect(() => {
    if (menuFor === null) return
    const press = (event: PointerEvent) => {
      const target = event.target
      if (!(target instanceof Node)) return
      if (document.querySelector('.sidebar-app[data-menu="true"]')?.contains(target)) return
      setMenu(null)
    }
    const key = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setMenu(null)
    }
    window.addEventListener('pointerdown', press, true)
    window.addEventListener('keydown', key)
    return () => {
      window.removeEventListener('pointerdown', press, true)
      window.removeEventListener('keydown', key)
    }
  }, [menuFor])

  return (
    // Its own transition name: it stays put while screens change (shell/transitions.css). With a menu open it also
    // goes over the screen beside it, which the screens' own layers would otherwise cover.
    <aside
      className="sidebar glass"
      style={{ viewTransitionName: 'sidebar', zIndex: menuFor === null ? undefined : 25 }}
    >
      <div className="status">
        <BrandMark />
        {/* Keyed by the minute: a new one rolls in (shell.css), as a car's clock does. */}
        <div className="time" key={time ?? '--:--'}>
          {time ?? '--:--'}
        </div>
      </div>
      <nav className="recent" aria-label="Apps">
        {pinnedShown.map((app) => (
          <SidebarApp
            key={app}
            app={app}
            current={route.kind === 'app' && route.app === app}
            badge={app === 'notifications' ? unread : 0}
            menuOpen={menuFor === app}
            onMenu={(open) => setMenu(open ? { app, route } : null)}
          />
        ))}
        {pinnedShown.length > 0 && recentShown.length > 0 && <div className="sidebar-divider" aria-hidden />}
        {recentShown.map((app) => (
          <SidebarApp
            key={app}
            app={app}
            current={route.kind === 'app' && route.app === app}
            badge={app === 'notifications' ? unread : 0}
            menuOpen={menuFor === app}
            onMenu={(open) => setMenu(open ? { app, route } : null)}
          />
        ))}
      </nav>
      <div className="sidebar-actions">
        {/* Its icon is where it goes: the app grid (Home) or the Dashboard. */}
        <button
          type="button"
          className="sidebar-button home-button"
          aria-label={homeTarget === 'home' ? 'Home' : 'Dashboard'}
          onClick={() => go({ type: 'pressHome' })}
        >
          <GridGlyph shown={homeTarget === 'home'} />
          <DashboardGlyph shown={homeTarget === 'dashboard'} />
        </button>
      </div>
    </aside>
  )
}

/**
 * Now, for the player's own clock, ticked as the minute turns (a timer set for the next minute's start, then the
 * one after it) rather than on an interval that drifts: the sidebar shows the minute the player's PC is on.
 */
function useRealTime(): number {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    let timer = 0
    const tick = () => {
      setNow(Date.now())
      timer = window.setTimeout(tick, 60_000 - (Date.now() % 60_000))
    }
    timer = window.setTimeout(tick, 60_000 - (Date.now() % 60_000))
    return () => window.clearTimeout(timer)
  }, [])
  return now
}

/**
 * An app in the sidebar, pinned or recent. Its icon has a transition name of its own, so it slides to its new
 * place when the order changes, pushing the others along (like moving an icon on iOS). When it opens its app, the
 * window grows out of a copy laid exactly over it for that moment, so the icon itself is still free to slide.
 *
 * Right-clicking the icon, or holding it, opens its menu: pin it to the top of the sidebar, or unpin it, without
 * going into Settings.
 */
function SidebarApp({
  app,
  current,
  badge,
  menuOpen,
  onMenu,
}: {
  app: AppId
  current: boolean
  badge: number
  menuOpen: boolean
  onMenu(open: boolean): void
}) {
  const launching = useCarriesLaunch(app, { kind: 'icon', origin: 'sidebar' })
  const icon = useAppIcon(APPS[app].icon)
  const text = useText()
  const pinned = useCabin((state) => state.pinnedApps.includes(app))
  const canPin = useCabin((state) => state.pinnedApps.length < PINNED_LIMIT)
  const setPinnedApp = useCabin((state) => state.setPinnedApp)
  const hold = useRef(0)
  // The hold that opened the menu: as the pointer comes up, its press mustn't open the app as well.
  const held = useRef(false)
  const from = useRef<{ x: number; y: number } | null>(null)
  const item = useRef<HTMLButtonElement>(null)

  useEffect(() => () => window.clearTimeout(hold.current), [])
  // Opened, the menu takes the focus, so Escape closes it and the keyboard walks it as a menu should.
  useEffect(() => {
    if (menuOpen) item.current?.focus()
  }, [menuOpen])

  const stopHold = () => window.clearTimeout(hold.current)
  const down = (event: ReactPointerEvent<HTMLButtonElement>) => {
    // Only the left button is a hold: the right one has its own menu (below).
    if (event.button !== 0) return
    from.current = { x: event.clientX, y: event.clientY }
    held.current = false
    stopHold()
    hold.current = window.setTimeout(() => {
      held.current = true
      onMenu(true)
    }, HOLD_MS)
  }
  const move = (event: ReactPointerEvent<HTMLButtonElement>) => {
    const start = from.current
    if (start && Math.hypot(event.clientX - start.x, event.clientY - start.y) > HOLD_SLOP) stopHold()
  }
  const up = () => {
    from.current = null
    stopHold()
  }

  return (
    <div className="sidebar-app" data-menu={menuOpen ? 'true' : undefined}>
      <button
        type="button"
        aria-current={current ? 'page' : undefined}
        aria-haspopup="menu"
        aria-expanded={menuOpen}
        aria-label={text.apps[app]}
        onPointerDown={down}
        onPointerMove={move}
        onPointerUp={up}
        onPointerCancel={up}
        onPointerLeave={up}
        onContextMenu={(event) => {
          // The cab isn't a web page: the right button brings this app's own menu, as a hold does.
          event.preventDefault()
          stopHold()
          onMenu(true)
        }}
        onClick={() => {
          if (held.current) {
            held.current = false
            return
          }
          if (menuOpen) {
            onMenu(false)
            return
          }
          go({ type: 'openApp', app }, 'sidebar')
        }}
      >
        {/* The Driver app's icon is the truck's brand, as it is on Home. */}
        {app === 'driver' ? (
          <BrandIcon style={{ viewTransitionName: `recent-${app}`, viewTransitionClass: 'recent' }} />
        ) : (
          <img src={icon} alt="" style={{ viewTransitionName: `recent-${app}`, viewTransitionClass: 'recent' }} />
        )}
        {badge > 0 && (
          <span className="recent-badge" aria-label={text.notificationsApp.summary(badge)}>
            {badge > 99 ? '99+' : badge}
          </span>
        )}
        {launching &&
          (app === 'driver' ? (
            <BrandIcon className="launch-copy" style={LAUNCH_STYLE} />
          ) : (
            <img className="launch-copy" src={icon} alt="" style={LAUNCH_STYLE} />
          ))}
      </button>
      {menuOpen && (
        <div className="sidebar-menu glass" role="menu" aria-label={text.apps[app]}>
          <span className="sidebar-menu-title">{text.apps[app]}</span>
          <button
            type="button"
            role="menuitem"
            ref={item}
            disabled={!pinned && !canPin}
            onClick={() => {
              setPinnedApp(app, !pinned)
              onMenu(false)
            }}
          >
            <PinGlyph />
            <span>{pinned ? text.settings.unpinFromSidebar : text.settings.pinToSidebar}</span>
          </button>
        </div>
      )}
    </div>
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

/** Home: the app grid. */
function GridGlyph({ shown }: { shown: boolean }) {
  return (
    <svg viewBox="0 0 24 24" width="34" height="34" className={shown ? 'shown' : undefined} aria-hidden>
      {[4, 10.25, 16.5].flatMap((x) =>
        [4, 10.25, 16.5].map((y) => (
          <rect key={`${x}-${y}`} x={x} y={y} width="3.5" height="3.5" rx="1" fill="currentColor" />
        )),
      )}
    </svg>
  )
}

/** The Dashboard: one large tile and two small ones, like its layout. */
function DashboardGlyph({ shown }: { shown: boolean }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width="34"
      height="34"
      className={shown ? 'shown' : undefined}
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      aria-hidden
    >
      <rect x="3" y="4" width="10" height="16" rx="2.5" />
      <rect x="15" y="4" width="6" height="7" rx="2" />
      <rect x="15" y="13" width="6" height="7" rx="2" />
    </svg>
  )
}

/** The truck's brand in the status area, keyed by the brand so a new truck tries its own logo afresh. */
function BrandMark() {
  const truck = useLive((state) => state.truck)
  if (!truck) return null
  return <TruckBrand key={`${truck.brandId} ${truck.brand}`} brandId={truck.brandId} brand={truck.brand} />
}

/**
 * The truck's brand, above the clock: the same mark the boot screen shows, in the sidebar's own colour (the
 * logos are their makers' trademarks, so they live outside the repository: `public/brand-logos`). Its name
 * stands in where the brand has no logo.
 */
function TruckBrand({ brandId, brand }: { brandId: string; brand: string }) {
  const sources = logoSources(brandId, brand, { mono: true })
  const [attempt, setAttempt] = useState(0)
  return (
    <div className="brand" role="img" aria-label={brand}>
      {attempt < sources.length ? (
        <img
          key={sources[attempt].src}
          src={sources[attempt].src}
          alt=""
          onError={() => setAttempt((current) => current + 1)}
        />
      ) : (
        <span className="brand-wordmark">{brand}</span>
      )}
    </div>
  )
}
