import type { ReactNode } from 'react'
import type { Section } from './words'

/* The companion's sections, drawn: one mark each, in the onboarding's line weight (stroke 1.7 on 24), so the
   sidebar and the page it opens speak the same shape. */

const PATHS: Record<Section, ReactNode> = {
  // The screen itself: a display in its bezel.
  screen: (
    <>
      <rect x="2.6" y="4" width="18.8" height="12.6" rx="2.4" />
      <path d="M12 16.6v4M8.6 20.6h6.8" />
    </>
  ),
  // The key the pointer is used with, and the pointer.
  controls: (
    <>
      <rect x="2.6" y="5" width="12.4" height="10" rx="2.2" />
      <path d="M6 8.8h.01M9.4 8.8h.01M6 12.2h6" />
      <path d="M15.2 12.4 21 14.6l-2.5 1.1-1 2.6z" />
    </>
  ),
  // Wallpapers and icons: the sliders they're set by.
  customize: (
    <>
      <path d="M4 7h8.4M17.6 7H20M4 12h2.4M9.6 12H20M4 17h9.4M18.6 17H20" />
      <circle cx="15" cy="7" r="2.1" />
      <circle cx="7" cy="12" r="2.1" />
      <circle cx="16" cy="17" r="2.1" />
    </>
  ),
  // Who's signed in.
  accounts: (
    <>
      <circle cx="12" cy="8.4" r="3.6" />
      <path d="M4.6 20a7.4 7.4 0 0 1 14.8 0" />
    </>
  ),
  // The map made from the player's game.
  map: (
    <>
      <path d="M9 4.6 3.6 6.7v12.8L9 17.4l6 2.1 5.4-2.1V4.6L15 6.7z" />
      <path d="M9 4.6v12.8M15 6.7v12.8" />
    </>
  ),
  // The paired phone: a handset, as the cabin's Phone app draws one.
  phone: (
    <>
      <rect x="6.4" y="2.6" width="11.2" height="18.8" rx="2.6" />
      <path d="M10.6 18.4h2.8" />
    </>
  ),
  // The plugin going into the game's folder.
  setup: (
    <>
      <path d="M12 3.6v9.2M8.6 9.4 12 12.8l3.4-3.4" />
      <path d="M4.6 15v3.4a2 2 0 0 0 2 2h10.8a2 2 0 0 0 2-2V15" />
    </>
  ),
  // What this build is.
  about: (
    <>
      <circle cx="12" cy="12" r="8.6" />
      <path d="M12 11.2v5.4M12 7.9h.01" />
    </>
  ),
}

/** A section's mark, sized by the CSS around it. */
export function SectionGlyph({ id }: { id: Section }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      {PATHS[id]}
    </svg>
  )
}
