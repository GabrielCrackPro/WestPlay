import type { ReactNode } from 'react'

/**
 * The Diagnostics app's tab icons, our own drawings in the tab's colour: a gauge for the overview, the engine for
 * the engine, a clock for the driver's hours, a wheel for the chassis. A tab whose page has a reading worth
 * watching takes that reading's tone (diagnostics.css), and its icon with it.
 */
function TabIcon({ children }: { children: ReactNode }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width="100%"
      height="100%"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.9"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      {children}
    </svg>
  )
}

/** The overview: a gauge, its needle at rest. */
export function OverviewTabIcon() {
  return (
    <TabIcon>
      <path d="M3.6 16.4a8.4 8.4 0 1 1 16.8 0" />
      <path d="M12 16.4 15.6 11.4" />
      <circle cx="12" cy="16.4" r="1.5" fill="currentColor" stroke="none" />
    </TabIcon>
  )
}

/** The engine: its block, with a cylinder head over it. */
export function EngineTabIcon() {
  return (
    <TabIcon>
      <rect x="7.2" y="6.6" width="9.6" height="12.8" rx="2.4" />
      <path d="M10.2 10.2h3.6M10.2 13.8h3.6" />
      <path d="M4 9.6v6.8M20 9.6v6.8" />
    </TabIcon>
  )
}

/** The driver's hours: a clock. */
export function HoursTabIcon() {
  return (
    <TabIcon>
      <circle cx="12" cy="12" r="8" />
      <path d="M12 7.4V12l3.3 2.1" />
    </TabIcon>
  )
}

/** The chassis: a wheel, the tire and its hub. */
export function ChassisTabIcon() {
  return (
    <TabIcon>
      <circle cx="12" cy="12" r="7.4" />
      <circle cx="12" cy="12" r="2.6" />
      <path d="M12 4.6v2.8M12 16.6v2.8M4.6 12h2.8M16.6 12h2.8" />
    </TabIcon>
  )
}
