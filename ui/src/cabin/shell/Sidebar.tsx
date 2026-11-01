import { useEffect, useState } from 'react'
import { formatGameTime, formatRealTime } from '../../shared/format'
import { logoSources } from '../boot/brand'
import { useAppIcon, useScreenProfile } from '../state/hooks'
import { type AppId, APPS } from '../state/apps'
import { LAUNCH_STYLE, useCarriesLaunch } from '../state/launch'
import { homeButtonTarget } from '../state/navigation'
import { go, useCabin, useLive } from '../state/store'
import { useText } from '../state/text'
import { cabClock } from '../../shared/host'

/**
 * The CarPlay sidebar: the truck's brand and clock, the recent apps (the open one on top), and at the bottom
 * the truck button (back to the truck's own screen, like CarPlay's car button) and the Home button.
 *
 * The clock is the player's own time or the game's, as Settings › Dashboard has it; the player's is their PC's,
 * so it keeps time while the game is paused.
 */
export function Sidebar() {
  const recents = useCabin((state) => state.navigation.recents)
  const route = useCabin((state) => state.navigation.route)
  const homeTarget = useCabin((state) => homeButtonTarget(state.navigation))
  const clock = useCabin((state) => state.clock)
  const gameTime = useLive((state) => (state.telemetry ? cabClock(state.telemetry, state.clockShift) : null))
  const realTime = useRealTime()
  const shown = useScreenProfile().recents ?? 3
  const time = clock === 'real' ? formatRealTime(realTime) : gameTime === null ? null : formatGameTime(gameTime)

  return (
    // Its own transition name: it stays put while screens change (shell/transitions.css).
    <aside className="sidebar glass" style={{ viewTransitionName: 'sidebar' }}>
      <div className="status">
        <BrandMark />
        <div className="time">{time ?? '--:--'}</div>
      </div>
      <nav className="recent" aria-label="Recent apps">
        {recents.slice(0, shown).map((app) => (
          <RecentApp key={app} app={app} current={route.kind === 'app' && route.app === app} />
        ))}
      </nav>
      <div className="sidebar-actions">
        <button
          type="button"
          className="sidebar-button"
          aria-label="Truck screen"
          onClick={() => useCabin.getState().setTruckScreen(true)}
        >
          <TruckGlyph />
        </button>
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
 * A recent app. Its icon has a transition name of its own, so it slides to its new place when the order
 * changes, pushing the others along (like moving an icon on iOS). When it opens its app, the window grows
 * out of a copy laid exactly over it for that moment, so the icon itself is still free to slide to the top.
 */
function RecentApp({ app, current }: { app: AppId; current: boolean }) {
  const launching = useCarriesLaunch(app, { kind: 'icon', origin: 'sidebar' })
  const icon = useAppIcon(APPS[app].icon)
  const text = useText()
  return (
    <button
      type="button"
      aria-current={current ? 'page' : undefined}
      aria-label={text.apps[app]}
      onClick={() => go({ type: 'openApp', app }, 'sidebar')}
    >
      <img src={icon} alt="" style={{ viewTransitionName: `recent-${app}`, viewTransitionClass: 'recent' }} />
      {launching && <img className="launch-copy" src={icon} alt="" style={LAUNCH_STYLE} />}
    </button>
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

/** Back to the truck: the front of a truck cab (our own glyph, not CarPlay's car). */
function TruckGlyph() {
  return (
    <svg
      viewBox="0 0 24 24"
      width="36"
      height="36"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinejoin="round"
      strokeLinecap="round"
      aria-hidden
    >
      <path d="M6.5 3.5h11a2 2 0 0 1 2 2V17h-15V5.5a2 2 0 0 1 2-2Z" />
      <path d="M7 6.5h10v4.5H7Z" />
      <path d="M7.5 14h1.5M15 14h1.5" />
      <path d="M6 17v2.5h2.5V17M15.5 17v2.5H18V17" />
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
