/**
 * The job/cargo glyph on the Dashboard's destination card: similar to the fuel pump icon,
 * drawn in the text's own colour as the weather's symbol is — it says "job" where the words would otherwise be alone.
 */
export function JobGlyph({ size }: { size: number }) {
  return (
    <svg className="job-glyph" width={size} height={size} viewBox="0 0 64 64" fill="none" aria-hidden>
      {/* The cargo crate / job box. */}
      <rect x="14" y="6" width="28" height="48" rx="5" stroke="currentColor" strokeWidth="4" />
      <rect x="21" y="14" width="14" height="11" rx="2.5" fill="currentColor" opacity="0.3" />
      {/* The base it stands on. */}
      <path d="M10 58h36" stroke="currentColor" strokeWidth="4" strokeLinecap="round" />
      {/* The straps: holding the cargo in place. */}
      <path
        d="M20 20h4a4 4 0 0 1 4 4v12"
        stroke="currentColor"
        strokeWidth="4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M44 20h-4a4 4 0 0 1-4 4v12"
        stroke="currentColor"
        strokeWidth="4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* The label on the crate. */}
      <rect x="24" y="22" width="8" height="6" fill="currentColor" />
    </svg>
  )
}
