/**
 * The handset on the Dashboard's phone card, drawn in the card's own soft colour as the diagnostics gauge and the
 * fuel pump are: the same receiver the Phone app draws, so a glance says which app the card opens.
 */
export function PhoneGlyph({ size }: { size: number }) {
  return (
    <svg className="phone-widget-glyph" width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M6.2 3.6h2.9l1.4 4.1-2 1.5a12.5 12.5 0 0 0 6.3 6.3l1.5-2 4.1 1.4v2.9a2.2 2.2 0 0 1-2.4 2.2A17.6 17.6 0 0 1 4 6a2.2 2.2 0 0 1 2.2-2.4Z"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinejoin="round"
      />
    </svg>
  )
}
