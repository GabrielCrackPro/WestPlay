import { type CSSProperties, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { postToHost } from '../../shared/host'
import type { PowerPhase } from '../state/power'
import { useLive } from '../state/store'
import { logoSources } from './brand'
import './boot.css'

/**
 * Full-screen boot visuals for the power phases before `on` (see state/power.ts):
 * - `splash`: the truck's own boot screen, its brand logo lit up on black glass.
 * - `connecting`: the Cabin Play intro: the mark appears, then "Cabin Play" unrolls out of it to the right.
 * - `off`: black (the game hides the screen anyway while the electrics are off).
 *
 * Both read as a backlit panel coming up (boot.css): a pool of light behind the mark, a vignette at the glass's
 * edge, and the mark lit from its left as it settles.
 */
export function BootScreen({ phase }: { phase: Exclude<PowerPhase, 'on'> }) {
  return (
    <div className={`boot boot-${phase}`} aria-hidden>
      {/* The panel's light: one element for the whole boot (boot.css), so it comes up once with the electrics and
          doesn't dip between the brand splash and the intro. */}
      <span className="boot-glow" />
      {phase === 'splash' && <BrandSplash />}
      {phase === 'connecting' && <CabinPlayIntro />}
      {/* The light going down as the intro ends, over the glow and the pair: the panel dims before CarPlay comes up. */}
      {phase === 'connecting' && <span className="boot-light-out" />}
    </div>
  )
}

/**
 * The truck brand's logo. Logos are their makers' trademarks, so they live outside the repository
 * (`public/brand-logos`, git-ignored); when a brand has none, its name is shown as a wordmark instead.
 */
function BrandSplash() {
  const truck = useLive((state) => state.truck)
  const [attempt, setAttempt] = useState(0)
  // For the host's startup log: the moment the logo is on the page.
  useEffect(() => {
    if (truck) postToHost({ type: 'startup', stage: 'truck logo shown' })
  }, [truck])
  if (!truck) return null

  const sources = logoSources(truck.brandId, truck.brand, { mono: true })
  return (
    <div className="boot-brand">
      <span className="boot-brand-mark">
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
      {/* The panel's hairline, drawn out under the mark as it lights up (boot.css). */}
      <span className="boot-brand-rule" aria-hidden />
    </div>
  )
}

/**
 * The mark scales in at the centre, then glides left while "Cabin Play" is revealed out of it to the
 * right, ending as a centred pair with a halo breathing out behind it. The mark's starting offset is half the
 * width the text adds, measured before the first paint (and again once the web font has loaded), so the mark
 * starts exactly at the centre whatever the font renders.
 */
function CabinPlayIntro() {
  const wordmark = useRef<HTMLSpanElement>(null)
  const [shift, setShift] = useState(0)

  useLayoutEffect(() => {
    const element = wordmark.current
    if (!element) return
    const measure = () => {
      const gap = parseFloat(getComputedStyle(element.parentElement!).columnGap) || 0
      setShift((element.offsetWidth + gap) / 2)
    }
    measure()
    // Measure again once the web font is in: a fallback font has a different width.
    let active = true
    document.fonts.ready.then(() => active && measure())
    return () => {
      active = false
    }
  }, [])

  return (
    <div className="boot-intro" style={{ '--mark-shift': `${shift}px` } as CSSProperties}>
      <span className="boot-intro-mark">
        {/* Its own light, thrown once as the pair lands (boot.css). */}
        <span className="boot-intro-halo" aria-hidden />
        <img src="/cabinplay.png" alt="" />
      </span>
      <span ref={wordmark} className="boot-intro-wordmark">
        Cabin Play
      </span>
    </div>
  )
}
