import type { ReactElement, ReactNode } from 'react'

/**
 * The cluster's own line icons: the truck's readings and telltales drawn the way its dash draws them, so a
 * figure is found by its mark before its words are read. They stroke in `currentColor` and size from the cluster
 * (cluster.css), which sets each one's colour: the ink for a reading, green, amber or red for a telltale.
 *
 * Every mark is drawn in the same 24 grid and keeps its paint inside it with room to breathe, because they are seen
 * together: a row of telltales at 24px, a column of readings at 20, the gauges' marks at 30. Two rules follow from
 * that. Detail has to survive the smallest size a mark is drawn at — a stroke under ~2 grid units lands below 1.5px
 * in the rows and turns to a grey band, so a mark carries a few strong lines rather than many fine ones. And a mark
 * is centred on 12,12: where the drawing is right but sat off-centre, the component nudges it with a single
 * `translate` rather than moving every coordinate of the shape.
 *
 * Solid paint is used where a lamp would be solid on the glass — an indicator's arrow, a beam's lens, the pads of a
 * brake — because a filled shape holds its meaning at 14px where an outline of the same shape does not.
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

/** The tank: the ISO fuel pump — its body, its window and the hose on its side. The pump is what every dash uses for
 * fuel, low fuel and distance to empty, so the mark is drawn as the pump itself rather than as a drop. */
export function FuelIcon() {
  return (
    <Glyph>
      {/* The body, standing on the ground */}
      <path d="M4.6 20.2V5.6a1.9 1.9 0 0 1 1.9-1.9h5a1.9 1.9 0 0 1 1.9 1.9v14.6" />
      <path d="M3 20.2h12.4" />
      {/* The window on its face */}
      <path d="M6.9 6.9h4.2v4.2H6.9Z" />
      {/* The hose and nozzle, hanging off its right side */}
      <path d="M13.4 8.4h2.3a1.9 1.9 0 0 1 1.9 1.9v6.1a1.7 1.7 0 0 0 3.4 0v-6.1l-1.8-1.8" />
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

/** How far the tank still takes the truck: the route ahead — a road leaving from where the truck is and running on
 * to its head. It is drawn bold as one line and a solid head so it survives the 14px the fuel's foot reads it at,
 * where the old route-and-pin collapsed into a dot. */
export function RangeIcon() {
  return (
    <Glyph>
      <g transform="translate(0.4 -1.8)">
        <path d="M3.2 20.4c5.6 0 5.6-8.6 11.2-8.6h3.2" strokeWidth="2.2" />
        <path d="m15.4 8.2 4.2 3.6-4.2 3.6" strokeWidth="2.2" />
        <circle cx="3.2" cy="20.4" r="1.3" fill="currentColor" stroke="none" />
      </g>
    </Glyph>
  )
}

/** The trip since the engine came on: a flag planted where it started. The pennant is solid so the mark reads as a
 * flag at 20px instead of as a letter. The flag it flies sits to the right of its pole, so the drawing is shifted to
 * centre it. */
export function TripIcon() {
  return (
    <Glyph>
      <g transform="translate(0.6)">
        <path d="M5.6 21V3.8" />
        <path d="M5.6 4.6h10.2l-2.8 4.2 2.8 4.2H5.6Z" fill="currentColor" />
      </g>
    </Glyph>
  )
}

/** An average: a dial with its needle, as the trip computer marks the figure. The three specks it used to carry
 * round the dial painted under a pixel at the readouts' size, so the dial is its arc, its needle and its hub. */
export function GaugeIcon() {
  return (
    <Glyph>
      <path d="M3.6 17.2a8.4 8.4 0 1 1 16.8 0" />
      <path d="m12 17.2 5-6.4" />
      <circle cx="12" cy="17.2" r="1.2" fill="currentColor" stroke="none" />
    </Glyph>
  )
}

/** The odometer: a counter wheel read through its windows, split into three by two dividers. Anything finer — the
 * digits the wheel actually shows — is under a pixel at the 14px the dash draws it at, so the mark is the counter
 * itself. */
export function OdometerIcon() {
  return (
    <Glyph>
      <rect x="2.4" y="7" width="19.2" height="10" rx="2.4" />
      <path d="M8.8 7.5v9M15.2 7.5v9" />
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

/** The brakes' heat, for the temperature reading: a disc giving off its heat. The ticks round the disc were a grey
 * haze at the readouts' size, so the disc keeps its hub and its two waves and nothing else. */
export function BrakeTemperatureIcon() {
  return (
    <Glyph>
      <g transform="translate(-0.9 -1.2)">
        <circle cx="9.6" cy="13.8" r="5.8" />
        <circle cx="9.6" cy="13.8" r="2.1" />
        <path d="M17.6 8.2c1.1 1.2 1.1 2.7 0 3.9s-1.1 2.7 0 3.9M20.9 8.2c1.1 1.2 1.1 2.7 0 3.9s-1.1 2.7 0 3.9" />
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

/** The engine's oil, for the pressure warning: the ISO oil can — its body and its top — with the drop of oil beside
 * it. The drop is what tells it from any other can on the panel and what carries the oil's colour when the warning
 * lights, so it is drawn as its own mark rather than as a drip off a spout. */
export function OilIcon() {
  return (
    <Glyph>
      <g transform="translate(0.35 -1.8)">
        <path d="M3.6 11.6h7l3 2.6v5.2H3.6Z" />
        <path d="M5 11.6V8.2h3.4l2.2 3.4" />
        <path d="M17.2 9.8s2.5 2.9 2.5 4.5a2.5 2.5 0 0 1-5 0c0-1.6 2.5-4.5 2.5-4.5Z" />
      </g>
    </Glyph>
  )
}

/** The brakes' air, for the pressure warning: a brake disc between its two pads, as a caliper grips it. The disc's
 * spokes made an asterisk at 24px; the pads are what says "brake". */
export function BrakeAirIcon() {
  return (
    <Glyph>
      <circle cx="12" cy="12" r="6.1" />
      <circle cx="12" cy="12" r="2.2" />
      <path d="M3.9 7.6h2.1v8.8H3.9zM18 7.6h2.1v8.8H18z" fill="currentColor" stroke="none" />
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

/** The hazard lights: the warning triangle with exclamation. */
export function HazardIcon() {
  return (
    <Glyph>
      {/* Triangle outline */}
      <path d="M12 3.5 22 20H2Z" strokeWidth="2" />
      {/* Exclamation line */}
      <path d="M12 8.5v5" strokeWidth="2.5" />
      {/* Exclamation dot */}
      <circle cx="12" cy="15.5" r="1.2" fill="currentColor" stroke="none" />
    </Glyph>
  )
}

/** A headlamp, dipped or on main: the lamp's lens on the left, standing on its flat back as a lamp seen from the
 * side does, and the light it throws down the road. The two beams are told apart the way the dash's own symbols tell
 * them apart (ISO 7000-0083 and -0082): the dipped beam's rays all slope down to the road on one angle, and the main
 * beam's run straight out level, each ray as long as the next. Fanning the main beam, as this drew it, made the two
 * lamps differ by gesture alone and read as the same mark at 24px. */
export function BeamIcon({ main }: { main?: boolean }) {
  return (
    <Glyph>
      {/* The lens: a dome on its flat back */}
      <path d="M4 7.6h1.6a4.6 4.6 0 0 1 0 9.2H4Z" />
      {main ? (
        <>
          {/* Level, and all of one length */}
          <path d="M10.6 6.6h10.4M10.6 10.2h10.4M10.6 13.8h10.4M10.6 17.4h10.4" />
        </>
      ) : (
        <>
          {/* Down to the road, every ray on the same slope */}
          <path d="m10.2 7 8.8 3.6M10.2 10.2l8.8 3.6M10.2 13.4l8.8 3.6M10.2 16.6l8.8 3.6" />
        </>
      )}
    </Glyph>
  )
}

/** The position lights, as the dash's symbol draws them (ISO 7000-0456): two lamps back to back, each throwing its
 * light outward, the mark a driver reads as "the truck can be seen from the side". The game's parking lights are
 * these side lamps, so this is the light this panel lights for them. The pair is solid where the beam's lens is an
 * outline: at 24px a lamp this small is its silhouette, and a stroke inside it would only grey it. */
export function PositionLightIcon() {
  return (
    <Glyph>
      {/* The two lenses: a leaf with its flat side outward and its bulge toward the other, as the symbol draws
          them, their pointed ends keeping them apart at 24px */}
      <path d="M7.8 8.5c2.7 1 3.4 4.4 0 7Z" fill="currentColor" stroke="none" />
      <path d="M16.2 8.5c-2.7 1-3.4 4.4 0 7Z" fill="currentColor" stroke="none" />
      {/* The light each throws outward */}
      <path d="M6.8 8.8 3 7.2M6.6 12H2.7M6.8 15.2 3 16.8" />
      <path d="m17.2 8.8 3.8-1.6M17.4 12h3.9M17.2 15.2l3.8 1.6" />
    </Glyph>
  )
}

/** A direction indicator, turned the way it points: one solid arrow, head and shaft, as the dash lights it. Drawn
 * as a lamp rather than a UI arrow, so it is the same mark at 14px and at 30. */
export function IndicatorIcon({ direction }: { direction: 'left' | 'right' }) {
  const arrow = (
    <>
      {/* The head */}
      <path d="M11.2 4.2 3 12l8.2 7.8Z" fill="currentColor" stroke="none" />
      {/* The shaft */}
      <path d="M11.2 9.7h9.6v4.6h-9.6Z" fill="currentColor" stroke="none" />
    </>
  )
  return <Glyph>{direction === 'left' ? arrow : <g transform="translate(24 0) scale(-1 1)">{arrow}</g>}</Glyph>
}

/** The beacon on the roof: its bar on its mount, the lit lens inside it and the light it throws up and out. */
export function BeaconIcon() {
  return (
    <Glyph>
      {/* The bar: its mount and its housing */}
      <path d="M6.4 19.6h11.2M8.4 19.6v-4.4a3.8 3.8 0 0 1 7.6 0v4.4" />
      {/* The lens in the housing, lit */}
      <path d="M9.8 16.2v-1.6a2.4 2.4 0 0 1 4.4 0v1.6Z" fill="currentColor" stroke="none" opacity="0.55" />
      {/* The light it throws */}
      <path d="M12 10.6V7.2M6.8 11.2 4.6 9M17.2 11.2 19.4 9M3.4 16h-1.8M20.6 16h1.8" />
    </Glyph>
  )
}

/** The wipers: the screen's frame, the arm sweeping across it, the blade it carries and the pivot it turns on. */
export function WipersIcon() {
  return (
    <Glyph>
      <path d="M2.8 5.4h18.4l-1.7 13.2H4.5Z" />
      <path d="m6.6 17 8-8.4" />
      <path d="M12.4 6.4l5 4.2" />
      <circle cx="6.6" cy="17" r="0.9" fill="currentColor" stroke="none" />
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

/** A telephone receiver, for a call or a phone notification: the handset's earpiece, its mouthpiece and the grip
 * between them, as a phone's own receiver is drawn. */
export function PhoneIcon() {
  return (
    <Glyph>
      <path d="M6.3 3.5 9.4 4.3a1.3 1.3 0 0 1 .9 1.5l-.6 2.7a1.3 1.3 0 0 1-1.5 1l-1.5-.3a10.6 10.6 0 0 0 5.7 7.9l.6-1.4a1.3 1.3 0 0 1 1.5-.7l2.7.8a1.3 1.3 0 0 1 .9 1.5l-.6 2.7a1.4 1.4 0 0 1-1.6 1.1A16.9 16.9 0 0 1 3.9 5.1a1.3 1.3 0 0 1 1-1.6Z" />
    </Glyph>
  )
}

/** A warning: a ring with exclamation, for an alert with no symbol of its own. */
export function WarningIcon() {
  return (
    <Glyph>
      {/* Outer ring */}
      <circle cx="12" cy="12" r="8.5" />
      {/* Exclamation line */}
      <path d="M12 8v5" strokeWidth="2.5" />
      {/* Exclamation dot */}
      <circle cx="12" cy="15" r="1.3" fill="currentColor" stroke="none" />
    </Glyph>
  )
}

/** Cruise control: the dial holding a set speed, the needle set against a mark on its rim. The set mark is outside
 * the dial and solid, so the difference between "a dial" and "a speed held" survives the status bar's size. */
export function CruiseIcon() {
  return (
    <Glyph>
      {/* The dial */}
      <path d="M3.6 17.4a8.6 8.6 0 1 1 16.8 0" />
      {/* The needle on its hub */}
      <path d="m12 17.4 5-6.2" />
      <circle cx="12" cy="17.4" r="1.2" fill="currentColor" stroke="none" />
      {/* The mark it is set against */}
      <path d="M18.1 11.3 20.5 8.9" strokeWidth="2.3" />
    </Glyph>
  )
}

/** The retarder, while a step is held: its cog on the engine's side and the step it is taking, in the accent's
 * second colour. Six strong teeth rather than eight fine ones, so the cog is still a cog at 20px. */
export function RetarderIcon() {
  return (
    <Glyph>
      {/* The cog: its body, its teeth, its hub */}
      <circle cx="12" cy="9.6" r="3.9" />
      <path d="M12 3.2v1.8M12 14.2v1.8M5.4 9.6H3.6M20.4 9.6h-1.8M7.4 5 6.1 3.7M16.6 5l1.3-1.3M7.4 14.2 6.1 15.5M16.6 14.2l1.3 1.3" />
      <circle cx="12" cy="9.6" r="1.4" fill="currentColor" stroke="none" opacity="0.45" />
      {/* The step it is taking */}
      <path d="m7.8 17.2 4.2 3.4 4.2-3.4" strokeWidth="2.4" />
    </Glyph>
  )
}

/** The trailer on the back: its box, its deck line, the drawbar to the tractor and its wheels, as the dash's hitch
 * lamp draws it — the lamp that lights while something is coupled, and goes out when the truck runs solo. */
export function TrailerIcon() {
  return (
    <Glyph>
      <g transform="translate(-0.5 -0.6)">
        <path d="M2.6 6.6A1.6 1.6 0 0 1 4.2 5h8.6a1.6 1.6 0 0 1 1.6 1.6v7.2a1.6 1.6 0 0 1-1.6 1.6H4.2a1.6 1.6 0 0 1-1.6-1.6Z" />
        <path d="M2.6 10.2h11.8M14.4 10.6h4.4" />
        <circle cx="6.2" cy="18.4" r="1.9" />
        <circle cx="11.4" cy="18.4" r="1.9" />
      </g>
    </Glyph>
  )
}

/** The left blind-spot sensor: the truck's rear with the sensor's warning thrown to its left, as the dash's left BS
 * lamp draws it — lit while the sensor sees a vehicle in the left blind spot. */
export function BlindLeftIcon() {
  return (
    <Glyph>
      <g transform="translate(0.6)">
        {/* The truck's rear */}
        <path d="M9.4 8.6h6.2A1.8 1.8 0 0 1 17.4 10.4v6.8a1.3 1.3 0 0 1-1.3 1.3h-1.3a1.3 1.3 0 0 1-1.3-1.3v-.9h-1.5v.9a1.3 1.3 0 0 1-1.3 1.3H9.4a1.3 1.3 0 0 1-1.3-1.3v-6.8A1.8 1.8 0 0 1 9.4 8.6Z" />
        {/* The sensor's warning, on the side that sees it */}
        <path d="M6.6 10.4C5 11.9 5 14.4 6.6 15.9" />
        <path d="M4.2 9C1.9 11.2 1.9 15.1 4.2 17.3" />
      </g>
    </Glyph>
  )
}

/** The right blind-spot sensor: the truck's rear with the sensor's warning thrown to its right, as the dash's right
 * BS lamp draws it — lit while the sensor sees a vehicle in the right blind spot. */
export function BlindRightIcon() {
  return (
    <Glyph>
      <g transform="translate(23.4 0) scale(-1 1)">
        <path d="M9.4 8.6h6.2A1.8 1.8 0 0 1 17.4 10.4v6.8a1.3 1.3 0 0 1-1.3 1.3h-1.3a1.3 1.3 0 0 1-1.3-1.3v-.9h-1.5v.9a1.3 1.3 0 0 1-1.3 1.3H9.4a1.3 1.3 0 0 1-1.3-1.3v-6.8A1.8 1.8 0 0 1 9.4 8.6Z" />
        <path d="M6.6 10.4C5 11.9 5 14.4 6.6 15.9" />
        <path d="M4.2 9C1.9 11.2 1.9 15.1 4.2 17.3" />
      </g>
    </Glyph>
  )
}

/** What the telltales are drawn as, so the cluster can assemble them from the telemetry. */
export type TelltaleIcon = ReactElement
