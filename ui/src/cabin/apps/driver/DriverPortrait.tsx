export function DriverPortrait({ className = '' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 96 96" fill="none" aria-hidden="true" xmlns="http://www.w3.org/2000/svg">
      <circle cx="48" cy="48" r="45" fill="currentColor" opacity=".12" />
      <circle cx="48" cy="48" r="38" stroke="currentColor" strokeOpacity=".3" />
      <path d="M20 74c3-13 13-21 28-21s25 8 28 21" fill="currentColor" opacity=".2" />
      <path d="M20 74c3-13 13-21 28-21s25 8 28 21" stroke="currentColor" strokeWidth="2.5" />
      <path d="M34 38c0-10 6-17 14-17s14 7 14 17-6 18-14 18-14-8-14-18Z" fill="currentColor" opacity=".2" />
      <path d="M34 38c0-10 6-17 14-17s14 7 14 17-6 18-14 18-14-8-14-18Z" stroke="currentColor" strokeWidth="2.5" />
      <path d="M35 32c3-8 9-12 17-11 7 1 11 5 12 12-4-1-8-4-10-7-4 4-10 6-19 6Z" fill="currentColor" />
      <path d="M40 43h.1M56 43h.1" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
      <path d="M44 50c2 2 6 2 8 0" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <path d="M28 76c4-10 11-15 20-15s16 5 20 15" stroke="currentColor" strokeWidth="2.5" />
    </svg>
  )
}
