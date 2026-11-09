import type { ReactElement, ReactNode } from 'react'

/**
 * The cluster's own line icons: the truck's readings and telltales drawn the way its dash draws them, so a
 * figure is found by its mark before its words are read. They stroke in `currentColor` and size from the cluster
 * (cluster.css), which sets each one's colour: the ink for a reading, green, amber or red for a telltale.
 *
 * Every mark is drawn in the same 24 grid and keeps its paint inside it with room to breathe, because they are seen
 * together: a row of telltales at 24px, a column of readings at 20, the gauges' marks at 28. Two rules follow from
 * that. Detail has to survive the smallest size a mark is drawn at — a stroke under ~2 grid units lands below 1.5px
 * in the rows and turns to a grey band, so a mark carries a few strong lines rather than many fine ones. And a mark
 * is centred on 12,12: where the drawing is right but sat off-centre, the component nudges it with a single
 * `translate` rather than moving every coordinate of the shape.
 */
function Glyph({ children }: { children: ReactNode }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.9}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      {children}
    </svg>
  )
}

/** The tank: a pump with its hose, as the Smart Dash's fuel gauge carries it. */
export function FuelIcon() {
  return (
    <Glyph>
      <path d="M4 20V5a2 2 0 0 1 2-2h6a2 2 0 0 1 2 2v15" />
      <path d="M2.5 20h13M7 8h4M14 7h2.5a2.5 2.5 0 0 1 2.5 2.5v7a1.5 1.5 0 0 0 3 0V8.5L19 6" />
    </Glyph>
  )
}

/** The AdBlue tank: a drop with its surface, as the dash marks the urea it burns. A drop is heavy at the bottom and
 * pointed at the top, so its paint sits high in the grid; the shift puts its mass level with the marks beside it. */
export function AdblueIcon() {
  return (
    <Glyph>
      <g transform="translate(0 1.05)">
        <path d="M12 2.8s5.8 6.4 5.8 10.5a5.8 5.8 0 0 1-11.6 0C6.2 9.2 12 2.8 12 2.8Z" />
        <path d="M8.8 13.3c1.7.7 4.7.8 6.4 0" />
      </g>
    </Glyph>
  )
}

/** How far the tank still takes the truck: a route from here to its pin. The route leaves the circle to the left of
 * the grid, so the drawing is shifted to centre it. */
export function RangeIcon() {
  return (
    <Glyph>
      <g transform="translate(1.1)">
        <circle cx="5" cy="18.5" r="2.2" />
        <path d="M7.2 18.5H11a3 3 0 0 0 3-3V9a3 3 0 0 1 3-3h1.5" />
        <path d="m16 3.5 3 2.5-3 2.5" />
      </g>
    </Glyph>
  )
}

/** The trip since the engine came on: a flag planted where it started. The flag it flies sits to the right of its
 * pole, so the drawing is shifted to centre it. */
export function TripIcon() {
  return (
    <Glyph>
      <g transform="translate(0.75)">
        <path d="M6 21V4" />
        <path d="M6 4.5h10.5l-2.3 4 2.3 4H6" />
      </g>
    </Glyph>
  )
}

/** An average: a dial with its needle, as the trip computer marks the figure. */
export function GaugeIcon() {
  return (
    <Glyph>
      <path d="M3.5 17.5a8.5 8.5 0 1 1 17 0" />
      <path d="M7 13.5h.01M17 13.5h.01M12 8.5v.01" />
      <path d="m12 17.5 4.2-5.4" />
      <circle cx="12" cy="17.5" r="1" fill="currentColor" stroke="none" />
    </Glyph>
  )
}

/** The odometer: a counter wheel, read as its windows. The six figure strokes it used to draw were each 1.1px long
 * in the 18px row it lives in — a grey smear, not a counter — so the wheel keeps its case and its two dividers. */
export function OdometerIcon() {
  return (
    <Glyph>
      <rect x="2.5" y="5.5" width="19" height="13" rx="2.5" />
      <path d="M8.8 7.8v8.4M15.2 7.8v8.4" />
    </Glyph>
  )
}

/** The cab's clock. */
export function ClockIcon() {
  return (
    <Glyph>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 7v5.2l3.4 2" />
    </Glyph>
  )
}

/** A rest stop: a cup, as the driver-hours clocks mark the pause. */
export function RestIcon() {
  return (
    <Glyph>
      <path d="M4.5 8.5h11v4.5a5.5 5.5 0 0 1-11 0Z" />
      <path d="M15.5 9.5H17a2.5 2.5 0 0 1 0 5h-1.5M7.5 3v2.5M11.5 3v2.5M4 20.5h12" />
    </Glyph>
  )
}

/** The mandatory break: an hourglass, the time that has to run out. */
export function BreakIcon() {
  return (
    <Glyph>
      <path d="M6.5 3h11M6.5 21h11" />
      <path d="M8 3c0 3.8 8 5.2 8 9s-8 5.2-8 9M16 3c0 3.8-8 5.2-8 9s8 5.2 8 9" />
    </Glyph>
  )
}

/** The engine's coolant: a thermometer, filled to its reading. */
export function CoolantIcon() {
  return (
    <Glyph>
      <path d="M10 14.2V5a2 2 0 1 1 4 0v9.2a4.2 4.2 0 1 1-4 0Z" />
      <path d="M12 8v8" />
      <circle cx="12" cy="18.2" r="1.7" fill="currentColor" stroke="none" />
    </Glyph>
  )
}

/** The battery, for the game's charging warning: its case, its terminal and the bolt going in. The cell marks it
 * used to carry were under a grid unit wide at 24px and read as dirt on the case; the bolt is solid, so the one
 * mark that means "charging" is the one that survives. */
export function BatteryIcon() {
  return (
    <Glyph>
      <rect x="4" y="6" width="14" height="12" rx="2.5" />
      <path d="M20 10v4" />
      <path d="M13.4 8.4 10.4 13h2.4l-1.1 2.8 3.7-4.4h-2.4l1.4-3Z" fill="currentColor" stroke="none" />
    </Glyph>
  )
}

/** The engine's oil temperature: a thermometer beside its drop. The drop hangs to the right of the column, which
 * put the pair 2.4 units right of centre, so the drawing is shifted back over it. */
export function OilTemperatureIcon() {
  return (
    <Glyph>
      <g transform="translate(-2.4)">
        <path d="M9.5 14.2V5a2.5 2.5 0 0 1 5 0v9.2a4.2 4.2 0 1 1-5 0Z" />
        <path d="M12 7.5v8" />
        <path d="M18.5 10.5s2.5 2.8 2.5 4.5a2.5 2.5 0 0 1-5 0c0-1.7 2.5-4.5 2.5-4.5Z" />
      </g>
    </Glyph>
  )
}

/** The brakes' heat, for the temperature reading: a disc giving off its heat. */
export function BrakeTemperatureIcon() {
  return (
    <Glyph>
      <g transform="translate(-0.95 -1.5)">
        <circle cx="9.5" cy="14" r="5.5" />
        <circle cx="9.5" cy="14" r="2" />
        <path d="M9.5 8.5v1.5M9.5 18v1.5M4 14h1.5M13.5 14H15" />
        <path d="M17.5 7.5c1.2 1.3 1.2 2.9 0 4.2s-1.2 2.9 0 4.2M21 7.5c1.2 1.3 1.2 2.9 0 4.2s-1.2 2.9 0 4.2" />
      </g>
    </Glyph>
  )
}

/** A drop of fuel burned on the trip. */
export function DropIcon() {
  return (
    <Glyph>
      <path d="M12 3s6 6.7 6 11a6 6 0 0 1-12 0c0-4.3 6-11 6-11Z" />
    </Glyph>
  )
}

/** The engine's oil, for the pressure warning: a can pouring its drop. The can and its drop were drawn low in the
 * grid, which read as the lamp hanging under its row — hence the shift. */
export function OilIcon() {
  return (
    <Glyph>
      <g transform="translate(-0.7 -2.25)">
        <path d="M3 11h8l4 3v5H3Z" />
        <path d="M7 11V7.5h3.5L13 11M6.5 19v2M15 14h2.5l2-2" />
        <path d="M21 15.5s1.4 1.7 1.4 2.7a1.4 1.4 0 0 1-2.8 0c0-1 1.4-2.7 1.4-2.7Z" />
      </g>
    </Glyph>
  )
}

/** The brakes' air, for the pressure warning: a brake disc between its pads. */
export function BrakeAirIcon() {
  return (
    <Glyph>
      <circle cx="12" cy="12" r="7.5" />
      <circle cx="12" cy="12" r="2.8" />
      <path d="M12 4.5v2M12 17.5v2M4.5 12h2M17.5 12h2M18.8 5.2l-1.4 1.4M6.6 17.4l-1.4 1.4M18.8 18.8l-1.4-1.4M6.6 6.6 5.2 5.2" />
    </Glyph>
  )
}

/** The parking brake: a P in a ring, as the dash lights it. */
export function ParkingBrakeIcon() {
  return (
    <Glyph>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M9.8 16.5V7.5h3.1a2.8 2.8 0 0 1 0 5.6H9.8" />
    </Glyph>
  )
}

/** The hazard lights: the warning triangle. */
export function HazardIcon() {
  return (
    <Glyph>
      <path d="M12 3.5 22 20H2Z" />
      <path d="M12 9v4.5M12 17v.01" />
    </Glyph>
  )
}

/** A headlamp's beam, dipped or on main: the lamp and the light thrown down the road. */
export function BeamIcon({ main }: { main?: boolean }) {
  return (
    <Glyph>
      <g transform="translate(1.5)">
        <path d="M3 8.5h6.8l2.2 2v3l-2.2 2H3Z" />
        <path d={main ? 'M14 5.5h3M13 8.5h5M13 12h5M13 15.5h5M14 18.5h3' : 'M14.5 9h2M14.5 12h3.5M14.5 15h2'} />
      </g>
    </Glyph>
  )
}

/** A direction indicator, turned the way it points: a solid arrow, as the dash lights it. */
export function IndicatorIcon({ direction }: { direction: 'left' | 'right' }) {
  const path = (
    <>
      <path d="M12.5 4.5 4.5 12l8 7.5Z" fill="currentColor" stroke="none" />
      <path d="M13.5 12h6" />
    </>
  )
  return <Glyph>{direction === 'left' ? path : <g transform="translate(24 0) scale(-1 1)">{path}</g>}</Glyph>
}

/** The beacon on the roof: its bar and the light it throws. The rays are drawn inside the grid rather than out to its
 * edge, where they painted past every other lamp's reach. */
export function BeaconIcon() {
  return (
    <Glyph>
      <path d="M7 18.5h10M8 18.5v-2a4 4 0 0 1 8 0v2" />
      <path d="M12 7V4.5M5.5 9 3.5 7M18.5 9l2-2M4.1 14H2.6M19.9 14h1.5" />
    </Glyph>
  )
}

/** The wipers, sweeping the screen inside its frame. */
export function WipersIcon() {
  return (
    <Glyph>
      <path d="M2.5 5.5h19l-1.8 13H4.3Z" />
      <path d="m7 16.5 8.8-8.8M15.8 7.7l2.2 1.5M7 16.5h8" />
    </Glyph>
  )
}

/** A music note, for what plays now. */
export function MusicIcon() {
  return (
    <Glyph>
      <path d="M9 18V6l10-2v12" />
      <circle cx="6.5" cy="18" r="2.5" />
      <circle cx="16.5" cy="16" r="2.5" />
    </Glyph>
  )
}

/** A telephone receiver, for a call or a phone notification. */
export function PhoneIcon() {
  return (
    <Glyph>
      <path d="M6.2 3.6h2.9l1.4 4.1-2 1.5a12.5 12.5 0 0 0 6.3 6.3l1.5-2 4.1 1.4v2.9a2.2 2.2 0 0 1-2.4 2.2A17.6 17.6 0 0 1 4 6a2.2 2.2 0 0 1 2.2-2.4Z" />
    </Glyph>
  )
}

/** A warning: a ring with its mark, for an alert with no symbol of its own. It used to be a second triangle with an
 * exclamation — the same mark as the hazard lamp, one place along the same row of lights — so an alert and the
 * hazards on were told apart only by the roundness of a corner. The ring is the one shape the row doesn't already
 * spend on the hazards. */
export function WarningIcon() {
  return (
    <Glyph>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 7.5v5.5" />
      <path d="M12 16.5v.01" />
    </Glyph>
  )
}

/** Cruise control: the dial holding a set speed, with the speed it holds. */
export function CruiseIcon() {
  return (
    <Glyph>
      <g transform="translate(-0.25 1.5)">
        <path d="M3.5 16.5a8.5 8.5 0 1 1 17 0" />
        <path d="m12 16.5 3.6-4.8" />
        <path d="M17.5 4.5v3.5H21" />
      </g>
    </Glyph>
  )
}

/** The retarder, while a step is held: its cog turned down a step, as the dash marks the braking it adds. */
export function RetarderIcon() {
  return (
    <Glyph>
      <circle cx="12" cy="9" r="4" />
      <path d="M12 2.5v2M12 13.5v2M5.5 9h-2M18.5 9h2M7.4 4.4 6 3M16.6 4.4 18 3M7.4 13.6 6 15M16.6 13.6 18 15" />
      <path d="m9.5 18 2.5 2.5 2.5-2.5" />
    </Glyph>
  )
}

/** The trailer on the back: its box, its wheels and the drawbar to the fifth wheel, as the dash's hitch lamp draws
 * it — the lamp that lights while something is coupled, and goes out when the truck runs solo. */
export function TrailerIcon() {
  return (
    <Glyph>
      <g transform="translate(1 -0.95)">
        <path d="M2.5 7A1.6 1.6 0 0 1 4.1 5.4h9.8A1.6 1.6 0 0 1 15.5 7v7.2a1.6 1.6 0 0 1-1.6 1.6H4.1a1.6 1.6 0 0 1-1.6-1.6Z" />
        <path d="M2.5 10.2h13M15.5 10.2h4" />
        <circle cx="6" cy="18.6" r="1.9" />
        <circle cx="11.6" cy="18.6" r="1.9" />
      </g>
    </Glyph>
  )
}

/** What the telltales are drawn as, so the cluster can assemble them from the telemetry. */
export type TelltaleIcon = ReactElement
