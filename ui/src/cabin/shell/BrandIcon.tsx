import { type CSSProperties, useState } from 'react'
import { logoSources } from '../boot/brand'
import { useAppIcon } from '../state/hooks'
import { useLive } from '../state/store'
import './brandIcon.css'

/**
 * The Driver app's icon: the truck's brand itself, in place of Cabin Play's own mark. The Driver app is the
 * player's own truck's, so its icon follows the truck it's in — the same logo the boot screen and the sidebar's
 * status show. `style` carries the launch's transition name, so the app still grows out of it.
 *
 * The mark has no icon file of its own: the makers' logos are their trademarks, and live outside the repository
 * (`public/brand-logos`, git-ignored), so where a brand has none the app's own icon stands in.
 */
export function BrandIcon({ style, className }: { style?: CSSProperties; className?: string }) {
  const truck = useLive((state) => state.truck)
  if (!truck) return <AppIcon style={style} className={className} />
  return (
    <Brand
      key={`${truck.brandId} ${truck.brand}`}
      brandId={truck.brandId}
      brand={truck.brand}
      style={style}
      className={className}
    />
  )
}

/** The Driver app's own icon (the chosen icon set's), for a truck with no brand logo to show. */
function AppIcon({ style, className }: { style?: CSSProperties; className?: string }) {
  const icon = useAppIcon('driver')
  return <img className={className} src={icon} alt="" style={style} />
}

function Brand({
  brandId,
  brand,
  style,
  className,
}: {
  brandId: string
  brand: string
  style?: CSSProperties
  className?: string
}) {
  // Line art first: the mark is drawn in the card's white, as the boot screen draws it.
  const sources = logoSources(brandId, brand, { mono: true })
  const [attempt, setAttempt] = useState(0)
  const source = sources[attempt]
  if (!source) return <AppIcon style={style} className={className} />

  return (
    // The icon is the button's: it's not a control of its own, and the button is what names it.
    <span
      className={['brand-icon', source.color ? 'colour' : '', className].filter(Boolean).join(' ')}
      style={style}
      aria-hidden
    >
      <img key={source.src} src={source.src} alt="" onError={() => setAttempt((current) => current + 1)} />
    </span>
  )
}
