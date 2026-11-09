import type { ReactNode } from 'react'

/**
 * The Settings app's glyphs, our own drawings: white on each row's coloured tile (Apple's look, not Apple's
 * symbols), and the list's chevrons.
 */

function TileGlyph({ children }: { children: ReactNode }) {
  return (
    <svg viewBox="0 0 24 24" width="70%" height="70%" fill="#fff" aria-hidden>
      {children}
    </svg>
  )
}

/** Appearance: a circle half dark, half light. */
export function AppearanceGlyph() {
  return (
    <TileGlyph>
      <path d="M12 3.2a8.8 8.8 0 1 0 0 17.6 8.8 8.8 0 0 0 0-17.6Zm0 2a6.8 6.8 0 0 1 0 13.6Z" fillRule="evenodd" />
    </TileGlyph>
  )
}

/** Wallpaper: a flower of six petals. */
export function WallpaperGlyph() {
  return (
    <TileGlyph>
      {[0, 60, 120, 180, 240, 300].map((angle) => (
        <ellipse key={angle} cx="12" cy="6.9" rx="2.9" ry="4.1" transform={`rotate(${angle} 12 12)`} opacity="0.92" />
      ))}
      <circle cx="12" cy="12" r="2.4" fill="rgb(0 0 0 / 0.18)" />
    </TileGlyph>
  )
}

/** Dashboard: its widgets, a tall one beside two small ones. */
export function DashboardGlyph() {
  return (
    <TileGlyph>
      <rect x="3.5" y="4" width="8.2" height="16" rx="2.2" />
      <rect x="13.3" y="4" width="7.2" height="7.2" rx="2.2" />
      <rect x="13.3" y="12.8" width="7.2" height="7.2" rx="2.2" />
    </TileGlyph>
  )
}

/** Instrument Cluster: a speedo, its needle up the face and its reading under the hub. */
export function ClusterGlyph() {
  return (
    <TileGlyph>
      <path d="M4.2 17.4a8.4 8.4 0 1 1 15.6 0" fill="none" stroke="#fff" strokeWidth="2.1" strokeLinecap="round" />
      <path d="M12 14.4 15.9 9" fill="none" stroke="#fff" strokeWidth="2.1" strokeLinecap="round" />
      <circle cx="12" cy="14.6" r="1.9" fill="#fff" />
    </TileGlyph>
  )
}

/** Home Screen: a house, the screen the apps live on. */
export function HomeGlyph() {
  return (
    <TileGlyph>
      <path d="M3.4 11.2 12 4l8.6 7.2v8.4a1 1 0 0 1-1 1h-5.2v-6.1h-4.8v6.1H4.4a1 1 0 0 1-1-1Z" />
    </TileGlyph>
  )
}

/** Now Playing: a pair of beamed notes. */
export function NowPlayingGlyph() {
  return (
    <TileGlyph>
      <path d="M19.6 3.4v11.9a3 3 0 1 1-1.8-2.75V7.9l-8.2 1.9v7.5a3 3 0 1 1-1.8-2.75V6.5a1 1 0 0 1 .78-.98l9.8-2.27a1 1 0 0 1 1.22.98Z" />
    </TileGlyph>
  )
}

/** Sound: a speaker, and two waves leaving it. */
export function SoundGlyph() {
  return (
    <TileGlyph>
      <path d="M4 9.2h3.1l4.4-3.7a.7.7 0 0 1 1.15.54v11.92a.7.7 0 0 1-1.15.54L7.1 14.8H4a1 1 0 0 1-1-1V10.2a1 1 0 0 1 1-1Z" />
      <path
        d="M15.6 9a4.2 4.2 0 0 1 0 6M18.2 6.6a7.6 7.6 0 0 1 0 10.8"
        fill="none"
        stroke="#fff"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </TileGlyph>
  )
}

/** Voice Assistant: a microphone, with its stand. */
export function VoiceGlyph() {
  return (
    <TileGlyph>
      <rect x="8.7" y="3.2" width="6.6" height="11.4" rx="3.3" />
      <path
        d="M5.4 11.5a6.6 6.6 0 0 0 13.2 0M12 18.1v2.7M8.3 20.8h7.4"
        fill="none"
        stroke="#fff"
        strokeWidth="1.9"
        strokeLinecap="round"
      />
    </TileGlyph>
  )
}

/** App Icons: four rounded squares, as an app grid. */
export function IconsGlyph() {
  return (
    <TileGlyph>
      <rect x="3.4" y="3.4" width="7.4" height="7.4" rx="2.4" />
      <rect x="13.2" y="3.4" width="7.4" height="7.4" rx="2.4" />
      <rect x="3.4" y="13.2" width="7.4" height="7.4" rx="2.4" />
      <rect x="13.2" y="13.2" width="7.4" height="7.4" rx="2.4" />
    </TileGlyph>
  )
}

/** Units & Clock: a ruler, its marks cut out of the tile's white. */
export function UnitsGlyph() {
  return (
    <TileGlyph>
      <path
        fillRule="evenodd"
        d="M3.2 8.4h17.6a1.4 1.4 0 0 1 1.4 1.4v4.4a1.4 1.4 0 0 1-1.4 1.4H3.2a1.4 1.4 0 0 1-1.4-1.4v-4.4a1.4 1.4 0 0 1 1.4-1.4Zm2.6 2.1v1.9h1.7v-1.9H5.8Zm4.3 0v2.9h1.7v-2.9H10.1Zm4.3 0v1.9h1.7v-1.9h-1.7Zm4.3 0v2.9h1.7v-2.9h-1.7Z"
      />
    </TileGlyph>
  )
}

/** Map Display: the map's layers, one over the other. */
export function MapDisplayGlyph() {
  return (
    <TileGlyph>
      <path d="M12 3.4 21 7.8l-9 4.4-9-4.4Z" />
      <path d="m4.3 12.4 7.7 3.8 7.7-3.8" fill="none" stroke="#fff" strokeWidth="1.9" strokeLinejoin="round" />
      <path d="m4.3 16.6 7.7 3.8 7.7-3.8" fill="none" stroke="#fff" strokeWidth="1.9" strokeLinejoin="round" />
    </TileGlyph>
  )
}

/** Traffic: a traffic light, its lenses cut out of the tile's white. */
export function MapTrafficGlyph() {
  return (
    <TileGlyph>
      <path
        fillRule="evenodd"
        d="M8.6 2.9h6.8a2.7 2.7 0 0 1 2.7 2.7v12.8a2.7 2.7 0 0 1-2.7 2.7H8.6a2.7 2.7 0 0 1-2.7-2.7V5.6a2.7 2.7 0 0 1 2.7-2.7Zm.6 3.2a1.6 1.6 0 1 0 0 3.2 1.6 1.6 0 0 0 0-3.2Zm0 4.4a1.6 1.6 0 1 0 0 3.2 1.6 1.6 0 0 0 0-3.2Zm0 4.4a1.6 1.6 0 1 0 0 3.2 1.6 1.6 0 0 0 0-3.2Z"
      />
    </TileGlyph>
  )
}

/** Route: the line from where the truck is to where it's headed, its ends marked. */
export function MapRouteGlyph() {
  return (
    <TileGlyph>
      <path
        d="M5 19.4c4.6 0 4.2-5.2 8.2-5.2 3.1 0 3.2-3.3 5.6-4.4"
        fill="none"
        stroke="#fff"
        strokeWidth="2.6"
        strokeLinecap="round"
      />
      <circle cx="5" cy="19.4" r="2.4" />
      <circle cx="19.2" cy="9.6" r="2.4" />
    </TileGlyph>
  )
}

/** Markers and Pins: a map pin, its eye cut out of it. */
export function MapPinsGlyph() {
  return (
    <TileGlyph>
      <path
        fillRule="evenodd"
        d="M12 2.8a7.3 7.3 0 0 0-7.3 7.3c0 5.5 7.3 11.2 7.3 11.2s7.3-5.7 7.3-11.2A7.3 7.3 0 0 0 12 2.8Zm0 4.4a2.9 2.9 0 1 0 0 5.8 2.9 2.9 0 0 0 0-5.8Z"
      />
    </TileGlyph>
  )
}

/** The chevron after a row that opens a page. */
export function ChevronGlyph({ back = false }: { back?: boolean }) {
  return (
    <svg
      viewBox="0 0 12 20"
      width="12"
      height="20"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      style={back ? { transform: 'scaleX(-1)' } : undefined}
      aria-hidden
    >
      <path d="m3 2.5 7 7.5-7 7.5" />
    </svg>
  )
}

/** The pin on a Home app's row: filled while the app is pinned to the sidebar. */
export function PinGlyph({ pinned = false }: { pinned?: boolean }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width="100%"
      height="100%"
      fill={pinned ? 'currentColor' : 'none'}
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M9 3.6h6l-.9 4.6 3.3 2.8v1.5H6.6V11l3.3-2.8Z" />
      <path d="M12 12.5v7.4" />
    </svg>
  )
}

/** The tick on a chosen option. */
export function CheckGlyph() {
  return (
    <svg
      viewBox="0 0 24 24"
      width="20"
      height="20"
      fill="none"
      stroke="currentColor"
      strokeWidth="3"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="m5 12.5 4.6 4.6L19 7.5" />
    </svg>
  )
}
