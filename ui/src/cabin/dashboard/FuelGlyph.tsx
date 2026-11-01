/**
 * The fuel pump on the Dashboard's fuel card, drawn in the text's owner colour like the weather's symbol:
 * a pump body and its hose, so the card says "fuel" with a glance.
 */
export function FuelGlyph({ size }: { size: number }) {
  return (
    <svg className="fuel-glyph" width={size} height={size} viewBox="0 0 64 64" fill="none" aria-hidden>
      {/* The pump. */}
      <rect x="9" y="5" width="28" height="52" rx="6" stroke="currentColor" strokeWidth="4" />
      <rect x="16" y="13" width="14" height="10" rx="2.5" fill="currentColor" opacity="0.3" />
      {/* The hose looping from the pump's side, and its nozzle. */}
      <path
        d="M37 17h3a5 5 0 0 1 5 5v19a5 5 0 0 0 5 5h1a4 4 0 0 0 4-4V28"
        stroke="currentColor"
        strokeWidth="4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d="M50 25h6" stroke="currentColor" strokeWidth="4" strokeLinecap="round" />
      {/* The base it stands on. */}
      <path d="M5 60h36" stroke="currentColor" strokeWidth="4" strokeLinecap="round" />
    </svg>
  )
}
