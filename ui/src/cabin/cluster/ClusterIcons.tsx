import type { ReactElement, ReactNode } from 'react'

/**
 * Standard dashboard icons following ISO 2575 (vehicle telltales) and Material Design conventions.
 * Clean outline icons with no backgrounds, designed to be instantly recognizable at any size from 14px to 30px.
 * All icons use a 24×24 grid with consistent stroke weight (1.9), rounded caps and joins.
 *
 * Key design principles:
 * - No filled backgrounds or decorative circles — pure line art
 * - Simplified shapes that match real vehicle dashboard symbols worldwide
 * - Solid fills only where the standard symbol uses them (arrows, brake pads, indicator lenses)
 * - Centered visual weight on (12,12) for consistent alignment in rows and grids
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

/** Fuel pump — ISO 2575 standard symbol for fuel level. Simplified pump body with nozzle, matching the symbol
 * found on every vehicle dashboard worldwide. No window detail to keep it clean at small sizes. */
export function FuelIcon() {
  return (
    <Glyph>
      <path d="M3 22V6a2 2 0 0 1 2-2h5a2 2 0 0 1 2 2v16" />
      <path d="M6 22h12" />
      <path d="M12 10h3a2 2 0 0 1 2 2v4a2 2 0 0 0 4 0v-5l-3-3" />
    </Glyph>
  )
}

/** AdBlue / diesel exhaust fluid — standard symbol is a water drop with "Sc" or waves inside, representing the
 * urea solution. The drop shape is the universally recognized form for this fluid on dashboards. */
export function AdblueIcon() {
  return (
    <Glyph>
      <path d="M12 3s6 7 6 11a6 6 0 0 1-12 0c0-4 6-11 6-11Z" />
      <path d="M9 14c1.5.6 4.5.6 6 0" />
    </Glyph>
  )
}

/** Range / distance to empty — a road with an arrow, the standard symbol for remaining range. Simple path with
 * a solid dot at the start (current position) and an arrowhead at the end (destination). */
export function RangeIcon() {
  return (
    <Glyph>
      <path d="M4 20c4 0 4-8 8-8h4" />
      <path d="m14 10 4 2-4 2" />
      <circle cx="4" cy="20" r="1.5" fill="currentColor" stroke="none" />
    </Glyph>
  )
}

/** Trip distance — a simple flag on a pole, the standard symbol for trip meter. Solid pennant for recognition
 * at small sizes, matching Material Design's flag icon. */
export function TripIcon() {
  return (
    <Glyph>
      <path d="M5 22V4" />
      <path d="M5 4h8l-3 4 3 4H5Z" fill="currentColor" />
    </Glyph>
  )
}

/** Average / gauge — a speedometer-style arc with needle, the standard symbol for average consumption or speed.
 * Open arc (not a full circle) with a central needle pointing to a value. */
export function GaugeIcon() {
  return (
    <Glyph>
      <path d="M4 17a8 8 0 0 1 16 0" />
      <path d="M12 17l4-6" />
      <circle cx="12" cy="17" r="1.2" fill="currentColor" stroke="none" />
    </Glyph>
  )
}

/** Odometer — a rectangular counter with divider lines, representing the mechanical mileage counter.
 * Simple rounded rectangle with two vertical dividers, matching the standard odometer symbol. */
export function OdometerIcon() {
  return (
    <Glyph>
      <rect x="2" y="7" width="20" height="10" rx="2" />
      <path d="M8 7v10M16 7v10" />
    </Glyph>
  )
}

/** Clock — standard Material Design clock icon. Simple circle with two hands, universally recognized. */
export function ClockIcon() {
  return (
    <Glyph>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 6v6l4 2" />
    </Glyph>
  )
}

/** Rest / break — a coffee cup with steam, the standard symbol for rest periods in driver hours.
 * Simple cup shape with handle and two steam lines, matching Material Design's local_cafe icon. */
export function RestIcon() {
  return (
    <Glyph>
      <path d="M4 10h10v4a5 5 0 0 1-10 0Z" />
      <path d="M14 11h1a2 2 0 0 1 0 4h-1" />
      <path d="M7 4v2M10 4v2" />
    </Glyph>
  )
}

/** Mandatory break — an hourglass, the standard symbol for time-limited breaks. Two triangles meeting at
 * the center with top and bottom bars, matching the universal hourglass symbol. */
export function BreakIcon() {
  return (
    <Glyph>
      <path d="M6 4h12M6 20h12" />
      <path d="M7 4c0 3 5 4.5 5 8s-5 5-5 8M17 4c0 3-5 4.5-5 8s5 5 5 8" />
    </Glyph>
  )
}

/** Coolant temperature — ISO 2575 standard: a thermometer with a bulb at the bottom and a tube extending upward.
 * The universally recognized symbol for engine coolant temperature on every dashboard. */
export function CoolantIcon() {
  return (
    <Glyph>
      <path d="M11 15V5a1 1 0 0 1 2 0v9a3 3 0 1 1-2 0Z" />
    </Glyph>
  )
}

/** Battery / charging system — ISO 2575 M.01: a rectangular battery cell with positive (+) and negative (−) terminals.
 * The universally recognized symbol for the vehicle charging system warning. The battery is a rounded rectangle
 * with two small bumps on top representing the terminals, and plus/minus signs inside to indicate polarity.
 * Shown in red on dashboards when the charging system is faulty. */
export function BatteryIcon() {
  return (
    <Glyph>
      {/* Battery body — rounded rectangle */}
      <rect x="3" y="8" width="14" height="10" rx="2" />
      {/* Positive terminal bump — top right */}
      <path d="M14 6v2" />
      {/* Negative terminal bump — top left */}
      <path d="M7 6v2" />
      {/* Plus sign — inside battery, right side */}
      <path d="M14 11v2" />
      <path d="M13 12h2" />
      {/* Minus sign — inside battery, left side */}
      <path d="M6 12h4" />
    </Glyph>
  )
}

/** Oil temperature — ISO 2575 standard: a thermometer with an oil drop beside it. The combination of these two
 * symbols clearly indicates oil temperature, distinguishing it from coolant temperature. */
export function OilTemperatureIcon() {
  return (
    <Glyph>
      <path d="M10 15V5a1 1 0 0 1 2 0v9a3 3 0 1 1-2 0Z" />
      <path d="M18 11s2 2.5 2 4a2 2 0 0 1-4 0c0-1.5 2-4 2-4Z" />
    </Glyph>
  )
}

/** Brake temperature — a brake disc with heat waves, the standard symbol for brake temperature monitoring.
 * Disc circle with wavy lines indicating heat, matching the symbol used on heavy vehicle dashboards. */
export function BrakeTemperatureIcon() {
  return (
    <Glyph>
      <circle cx="10" cy="12" r="6" />
      <circle cx="10" cy="12" r="2" />
      <path d="M18 7c1 1 1 2.5 0 3.5s-1 2.5 0 3.5" />
      <path d="M20 7c1 1 1 2.5 0 3.5s-1 2.5 0 3.5" />
    </Glyph>
  )
}

/** Fuel drop — a simple oil/fuel drop, used for instant fuel consumption. The drop shape is the universal
 * symbol for liquid fuel, matching Material Design's water_drop. */
export function DropIcon() {
  return (
    <Glyph>
      <path d="M12 3s5 6.5 5 10a5 5 0 0 1-10 0c0-3.5 5-10 5-10Z" />
    </Glyph>
  )
}

/** Oil pressure — ISO 2575 standard: an oil can (Aladdin's lamp shape) with a drop. The universally recognized
 * symbol for oil pressure warning, found on every vehicle dashboard worldwide. */
export function OilIcon() {
  return (
    <Glyph>
      <path d="M4 14h6l3 2v5H4Z" />
      <path d="M4 14V9h3l3 3" />
      <path d="M17 10s2 2.5 2 4a2 2 0 0 1-4 0c0-1.5 2-4 2-4Z" />
    </Glyph>
  )
}

/** Brake air pressure — ISO 2575 standard: a brake disc between two pads (caliper view). The disc with pads
 * on either side is the universal symbol for brake system warnings on heavy vehicles. */
export function BrakeAirIcon() {
  return (
    <Glyph>
      <circle cx="12" cy="12" r="6" />
      <circle cx="12" cy="12" r="2" />
      <path d="M4 8v8M20 8v8" />
    </Glyph>
  )
}

/** Parking brake — ISO 2575 standard: the letter "P" in a circle. The universally recognized symbol for
 * parking/hand brake, found on every vehicle dashboard. */
export function ParkingBrakeIcon() {
  return (
    <Glyph>
      <circle cx="12" cy="12" r="9" />
      <path d="M10 17V7h3a3 3 0 0 1 0 6h-3" />
    </Glyph>
  )
}

/** Hazard warning — ISO 2575 A.19: an equilateral triangle pointing up, shown in red on dashboards.
 * The universally recognized hazard warning symbol. The triangle is centered in the 24×24 grid with
 * equal sides and a flat base, matching the symbol used worldwide for hazard lights. */
export function HazardIcon() {
  return (
    <Glyph>
      <path d="M12 3L1 21h22Z" />
    </Glyph>
  )
}

/** Headlight beam — ISO 2575 high beam (blue on dash) / low beam (green on dash).
 * The lamp is a D-shape on the left: flat edge on the right, half-ellipse bulging left.
 * Three parallel rays leave the flat side toward the right, the direction the light travels.
 * High beam rays are horizontal; low beam rays are the same rays tilted downward.
 * Rays are plain strokes with no arrowheads. */
export function BeamIcon({ main }: { main?: boolean }) {
  return (
    <Glyph>
      {/* Lamp body — closed D-shape, flat edge at x=11, bulging left to x=5 */}
      <path d="M11 5a6 7 0 0 0 0 14Z" />
      {main ? (
        /* High beam — horizontal rays to the right */
        <>
          <path d="M15 7h5" />
          <path d="M15 12h5" />
          <path d="M15 17h5" />
        </>
      ) : (
        /* Low beam — same rays, angled downward */
        <>
          <path d="M15 7l5 2" />
          <path d="M15 12l5 2" />
          <path d="M15 17l5 2" />
        </>
      )}
    </Glyph>
  )
}

/** Position / parking lights — ISO 2575 A.08 / A.09: two small lamps facing away from each other with
 * three rays each pointing outward. The universally recognized symbol for side/position lights.
 * Each lamp is a small D-shape with the flat side toward the center, rays spread outward.
 * Shown in green on dashboards. */
export function PositionLightIcon() {
  return (
    <Glyph>
      {/* Left lamp — D-shape facing left */}
      <path d="M8 9c-2 1-2 5 0 6" />
      <path d="M8 12V8" />
      {/* Left rays — pointing left */}
      <path d="M5 9H2" />
      <path d="M5 12H2" />
      <path d="M5 15H2" />
      {/* Right lamp — D-shape facing right */}
      <path d="M16 9c2 1 2 5 0 6" />
      <path d="M16 12V8" />
      {/* Right rays — pointing right */}
      <path d="M19 9h3" />
      <path d="M19 12h3" />
      <path d="M19 15h3" />
    </Glyph>
  )
}

/** Turn indicator — ISO 2575 A.16: a bold arrow pointing left or right, shown in green on dashboards.
 * The arrow head is a solid chevron with a horizontal shaft, matching the symbol found on every vehicle
 * dashboard worldwide. The arrow is compact and fills the 24×24 grid for maximum visibility. */
export function IndicatorIcon({ direction }: { direction: 'left' | 'right' }) {
  if (direction === 'left') {
    // Left arrow: shaft goes right-to-left, chevron points left (<)
    return (
      <Glyph>
        <path d="M8 12h12" strokeWidth="3" />
        <path d="M14 6L8 12l6 6" fill="currentColor" stroke="none" />
      </Glyph>
    )
  }
  // Right arrow: shaft goes left-to-right, chevron points right (>)
  return (
    <Glyph>
      <path d="M4 12h12" strokeWidth="3" />
      <path d="M10 6l6 6-6 6" fill="currentColor" stroke="none" />
    </Glyph>
  )
}

/** Beacon / warning light — a roof-mounted rotating beacon with rays emanating outward.
 * The standard symbol for emergency beacons on trucks and commercial vehicles. A dome-shaped
 * light on a base with rays in multiple directions, shown in amber on dashboards. */
export function BeaconIcon() {
  return (
    <Glyph>
      {/* Beacon dome — semi-circle on a base */}
      <path d="M9 14v-2a3 3 0 0 1 6 0v2" />
      {/* Base mount */}
      <path d="M7 16h10" />
      <path d="M10 14h4" />
      {/* Rays — upward and outward */}
      <path d="M12 9V4" />
      <path d="M8 10L5 7" />
      <path d="M16 10l3-3" />
    </Glyph>
  )
}

/** Windscreen wipers — ISO 2575 standard: a windshield outline with a wiper arm. The universally recognized
 * symbol for wipers, showing a curved windshield with a wiper blade sweeping across it. */
export function WipersIcon() {
  return (
    <Glyph>
      <path d="M4 6h16l-1 10H5Z" />
      <path d="m9 15 5-6" />
    </Glyph>
  )
}

/** Music / media — a standard music note icon, matching Material Design's music_note. Two beamed eighth notes,
 * the universal symbol for audio playback. */
export function MusicIcon() {
  return (
    <Glyph>
      <path d="M9 18V5l9-2v13" />
      <circle cx="6" cy="18" r="3" />
      <circle cx="16" cy="16" r="3" />
    </Glyph>
  )
}

/** Phone — a telephone handset, matching Material Design's phone icon. The classic curved handset shape,
 * universally recognized as a phone symbol. */
export function PhoneIcon() {
  return (
    <Glyph>
      <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92Z" />
    </Glyph>
  )
}

/** General warning — ISO 2575 A.20: an equilateral triangle with an exclamation mark inside.
 * The ISO standard generic warning symbol, used when there is no specific symbol for a condition.
 * Shown in amber or red on dashboards. The exclamation mark is a vertical bar with a dot below,
 * centered in the triangle. */
export function WarningIcon() {
  return (
    <Glyph>
      <path d="M12 3L1 21h22Z" />
      <path d="M12 9v5" strokeWidth="2.5" />
      <circle cx="12" cy="16" r="1" fill="currentColor" stroke="none" />
    </Glyph>
  )
}

/** Cruise control — ISO 2575 standard: a speedometer with an arrow pointing to a set value. The universally
 * recognized cruise control symbol, showing a dial with a needle and a reference mark. */
export function CruiseIcon() {
  return (
    <Glyph>
      <path d="M4 17a8 8 0 0 1 16 0" />
      <path d="M12 17l5-6" />
      <circle cx="12" cy="17" r="1.2" fill="currentColor" stroke="none" />
      <path d="M19 10l2-2" />
    </Glyph>
  )
}

/** Retarder / engine brake — a gear symbol with an arrow, indicating the engine braking system.
 * Simplified gear with 6 teeth and a downward arrow for the braking action. */
export function RetarderIcon() {
  return (
    <Glyph>
      <circle cx="12" cy="10" r="4" />
      <path d="M12 4v2M12 14v2M6 10H4M20 10h-2M8 6l-1.5-1.5M16 6l1.5-1.5M8 14l-1.5 1.5M16 14l1.5 1.5" />
      <path d="m8 18 4 3 4-3" />
    </Glyph>
  )
}

/** Trailer connected — ISO 2575 A.21: a truck with a trailer, shown from the side.
 * The universally recognized symbol for trailer coupling status. The truck cab is on the left,
 * connected to a rectangular trailer body on the right, with wheels underneath.
 * Shown in white or green on dashboards when a trailer is attached. */
export function TrailerIcon() {
  return (
    <Glyph>
      {/* Truck cab — simplified box shape */}
      <rect x="2" y="4" width="7" height="9" rx="1" />
      {/* Cab window */}
      <path d="M3 5h4v4H3Z" />
      {/* Coupling / drawbar */}
      <path d="M9 13h3" />
      {/* Trailer body — rectangular */}
      <rect x="12" y="5" width="10" height="8" rx="1" />
      {/* Truck wheel */}
      <circle cx="5.5" cy="16" r="2" />
      {/* Trailer wheels — two axles */}
      <circle cx="15" cy="16" r="2" />
      <circle cx="19" cy="16" r="2" />
    </Glyph>
  )
}

/** Left blind spot warning — a vehicle rear view with warning arcs on the left side. The standard blind spot
 * monitoring symbol, showing a truck/trailer outline with radar waves on the affected side. */
export function BlindLeftIcon() {
  return (
    <Glyph>
      <path d="M10 8h6a2 2 0 0 1 2 2v8a1 1 0 0 1-1 1h-1a1 1 0 0 1-1-1v-1h-2v1a1 1 0 0 1-1 1h-2a1 1 0 0 1-1-1V10a2 2 0 0 1 2-2Z" />
      <path d="M7 11C6 12 6 14 7 15" />
      <path d="M5 10C3 12 3 14 5 16" />
    </Glyph>
  )
}

/** Right blind spot warning — mirror image of the left blind spot symbol, with warning arcs on the right side. */
export function BlindRightIcon() {
  return (
    <Glyph>
      <g transform="translate(24 0) scale(-1 1)">
        <path d="M10 8h6a2 2 0 0 1 2 2v8a1 1 0 0 1-1 1h-1a1 1 0 0 1-1-1v-1h-2v1a1 1 0 0 1-1 1h-2a1 1 0 0 1-1-1V10a2 2 0 0 1 2-2Z" />
        <path d="M7 11C6 12 6 14 7 15" />
        <path d="M5 10C3 12 3 14 5 16" />
      </g>
    </Glyph>
  )
}

/** What the telltales are drawn as, so the cluster can assemble them from the telemetry. */
export type TelltaleIcon = ReactElement
