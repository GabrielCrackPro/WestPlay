/**
 * The gauge on the Dashboard's diagnostics card, drawn in the card's own colour like the fuel pump: a dial's
 * arc, its needle and hub, so the card says "readings" at a glance.
 */
export function DiagnosticsGlyph({ size }: { size: number }) {
  return (
    <svg className="diagnostics-glyph" width={size} height={size} viewBox="0 0 64 64" fill="none" aria-hidden>
      {/* The dial. */}
      <path d="M10 46a22 22 0 0 1 44 0" stroke="currentColor" strokeWidth="4" strokeLinecap="round" />
      {/* Its needle, and the hub it turns on. */}
      <path
        className="diagnostics-needle"
        d="M32 46 44 32"
        stroke="currentColor"
        strokeWidth="4"
        strokeLinecap="round"
      />
      <circle cx="32" cy="46" r="4" fill="currentColor" />
    </svg>
  )
}
