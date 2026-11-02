import { type CSSProperties, useEffect, useState } from 'react'
import { postToHost } from '../../shared/host'
import { CONNECTING_MS, type PowerPhase, SPLASH_MS } from '../state/power'
import { useLive } from '../state/store'
import { logoSources } from './brand'
import './boot.css'

/**
 * The boot, as one screen (boot.css): the panel's light comes up, Cabin Play's mark and name arrive on it, the
 * truck's brand settles in quietly under them, and the light goes down as CarPlay fades up.
 *
 * The power phases (state/power.ts) are only its clock: `splash` then `connecting` on a screen of the truck's
 * own, `connecting` alone when the app or plugin starts mid-drive. Nothing on the screen changes with them —
 * one composition, one animation, from the electrics to CarPlay.
 */
export function BootScreen({ phase }: { phase: Exclude<PowerPhase, 'on'> }) {
  // Whether the truck's brand belongs on it: a boot that began with the electrics has a truck to name; one
  // that started mid-drive (or on a tablet screen, which boots no truck) doesn't.
  const [withBrand, setWithBrand] = useState(false)
  if (phase === 'splash' && !withBrand) setWithBrand(true)
  // Up for as long as the phases it goes through, from the first of them.
  const ms = withBrand ? SPLASH_MS + CONNECTING_MS : CONNECTING_MS
  return (
    <div className="boot" data-phase={phase} style={{ '--boot-ms': `${ms}ms` } as CSSProperties} aria-hidden>
      {/* Nothing while the electrics are off: the game hides the screen itself, and a dark panel has nothing to
          show. Everything is mounted here, so its animation starts the moment the panel lights. */}
      {phase !== 'off' && (
        <>
          <span className="boot-glow" />
          <div className="boot-panel">
            <BootMark withBrand={withBrand} />
          </div>
          <span className="boot-light-out" />
        </>
      )}
    </div>
  )
}

/**
 * The screen's one composition: the truck's brand first — it's whose screen this is — and Cabin Play under it,
 * as the app it's booting into. On a boot with no truck to name, Cabin Play alone takes the panel at its size.
 */
function BootMark({ withBrand }: { withBrand: boolean }) {
  return (
    <div className="boot-intro" data-brand={withBrand || undefined}>
      {withBrand && <BrandLine />}
      <span className="boot-pair">
        <span className="boot-intro-mark">
          {/* Its own light, thrown once as the mark lands (boot.css). The AMOLED mark, so the tile is black on the
              panel's black and only the cab and its play are lit. */}
          <span className="boot-intro-halo" aria-hidden />
          <img src="/cabinplay-amoled.svg" alt="" />
        </span>
        <span className="boot-intro-wordmark">Cabin Play</span>
      </span>
    </div>
  )
}

/**
 * The truck brand, a line under Cabin Play's name rather than a screen of its own. Logos are their makers'
 * trademarks, so they live outside the repository (`public/brand-logos`, git-ignored); when a brand has none,
 * its name is shown as a small wordmark instead.
 */
function BrandLine() {
  const truck = useLive((state) => state.truck)
  const [attempt, setAttempt] = useState(0)
  // For the host's startup log: the moment the brand is on the page.
  useEffect(() => {
    if (truck) postToHost({ type: 'startup', stage: 'truck logo shown' })
  }, [truck])
  if (!truck) return null

  const sources = logoSources(truck.brandId, truck.brand, { mono: true })
  return (
    <span className="boot-brand">
      {attempt < sources.length ? (
        <img
          key={sources[attempt].src}
          className="boot-brand-logo"
          src={sources[attempt].src}
          alt=""
          onError={() => setAttempt((current) => current + 1)}
        />
      ) : (
        <span className="boot-brand-wordmark">{truck.brand}</span>
      )}
    </span>
  )
}
