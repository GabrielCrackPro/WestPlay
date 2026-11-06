import type { ReactNode } from 'react'

/**
 * The Phone app's tab icons, our own drawings: what the phone has waiting, a call log's clock, a contact, the
 * keypad's keys, and a bell for the phone's notifications. Drawn in the tab's colour (shell/appTabs.css), at
 * whatever size the tab's mark is.
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

/** Overview: four cards, what the phone has waiting gathered in one place. */
export function OverviewTabIcon() {
  return (
    <TabIcon>
      <rect x="3.4" y="3.4" width="7.4" height="7.4" rx="2.2" />
      <rect x="13.2" y="3.4" width="7.4" height="7.4" rx="2.2" />
      <rect x="3.4" y="13.2" width="7.4" height="7.4" rx="2.2" />
      <rect x="13.2" y="13.2" width="7.4" height="7.4" rx="2.2" />
    </TabIcon>
  )
}

/** Recents: a clock with its hand going back. */
export function RecentsTabIcon() {
  return (
    <TabIcon>
      <path d="M3.8 12a8.2 8.2 0 1 0 2.5-5.9" />
      <path d="M3.3 4.7v4.1h4.1" />
      <path d="M12 8.1v4.2l2.9 1.8" />
    </TabIcon>
  )
}

/** Contacts: a person's head and shoulders. */
export function ContactsTabIcon() {
  return (
    <TabIcon>
      <circle cx="12" cy="8.4" r="3.5" />
      <path d="M4.8 20a7.2 7.2 0 0 1 14.4 0" />
    </TabIcon>
  )
}

/** The keypad: its keys, three by three. */
export function KeypadTabIcon() {
  return (
    <TabIcon>
      <g fill="currentColor" stroke="none">
        <circle cx="7" cy="6.4" r="1.5" />
        <circle cx="12" cy="6.4" r="1.5" />
        <circle cx="17" cy="6.4" r="1.5" />
        <circle cx="7" cy="12" r="1.5" />
        <circle cx="12" cy="12" r="1.5" />
        <circle cx="17" cy="12" r="1.5" />
        <circle cx="7" cy="17.6" r="1.5" />
        <circle cx="12" cy="17.6" r="1.5" />
        <circle cx="17" cy="17.6" r="1.5" />
      </g>
    </TabIcon>
  )
}

/** Notifications: the phone's bell. */
export function NotificationsTabIcon() {
  return (
    <TabIcon>
      <path d="M12 3.4c-1 0-1.8.8-1.8 1.8v.7A6.4 6.4 0 0 0 5.6 12v3.4L4 18.2h16l-1.6-2.8V12a6.4 6.4 0 0 0-4.6-6.1v-.7c0-1-.8-1.8-1.8-1.8Z" />
      <path d="M9.7 18.6a2.4 2.4 0 0 0 4.6 0" />
    </TabIcon>
  )
}
