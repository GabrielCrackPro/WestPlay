/**
 * The Diagnostics app's truck: a flat side view of a tractor and its trailer, drawn in the hero's tone. A line
 * drawing rather than a model, so it opens with the app instead of loading anything for it.
 *
 * It's drawn the way the cabin's other glyphs are (the Dashboard's gauge and cargo cards, the weather's symbols):
 * `currentColor` for every stroke, rounded joins and caps, and a few tiers of the same colour — 0.06 fills, 0.2
 * for what's behind, 0.4 for the seams, 0.55 for the lamp — so it reads as part of the glass rather than as a
 * picture dropped on top of it. The trailer's ribs and the twin drive axle are what say "truck" at a glance.
 */
export function TruckFigure() {
  return (
    <div className="diag-figure" aria-hidden>
      <svg viewBox="0 0 300 120" fill="none">
        {/* The ground it stands on, and the shadow it lays on it (the cards' shadows, at a glyph's weight). */}
        <ellipse cx="150" cy="100" rx="138" ry="4" fill="currentColor" opacity="0.08" />
        <path d="M12 100h276" stroke="currentColor" strokeWidth="2" strokeLinecap="round" opacity="0.22" />

        {/* The trailer: its box, the ribs down its side and the band along its skirt. */}
        <rect
          x="16"
          y="26"
          width="146"
          height="52"
          rx="6"
          fill="currentColor"
          fillOpacity="0.06"
          stroke="currentColor"
          strokeWidth="2.4"
        />
        {[46, 76, 106, 136].map((x) => (
          <path key={x} d={`M${x} 34v36`} stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" opacity="0.2" />
        ))}
        <path d="M24 32v40" stroke="currentColor" strokeWidth="2" strokeLinecap="round" opacity="0.4" />
        <path d="M22 72h134" stroke="currentColor" strokeWidth="2" strokeLinecap="round" opacity="0.4" />

        {/* Its landing legs, and the rail that runs back to the cab. */}
        <path d="M148 78v13M160 78v13" stroke="currentColor" strokeWidth="2" strokeLinecap="round" opacity="0.35" />
        <path d="M162 74h34" stroke="currentColor" strokeWidth="2" strokeLinecap="round" opacity="0.5" />

        {/* The fifth wheel: the plate the trailer turns on. */}
        <path d="M186 74l5-5h12l5 5Z" fill="currentColor" fillOpacity="0.18" />

        {/* The cab: its roof, the raked screen at the front, and the window in its side. */}
        <path
          d="M196 82V46q0-8 8-8h32q8 0 11 7l13 22q3 5 3 9v6Z"
          fill="currentColor"
          fillOpacity="0.06"
          stroke="currentColor"
          strokeWidth="2.4"
          strokeLinejoin="round"
        />
        {/* The fairing along its roof, the screen that leans back into it, and the side glass. */}
        <path d="M204 38h32q8 0 11 7h-40Z" fill="currentColor" fillOpacity="0.12" />
        <path
          d="M250 42l7 2 6 23h-16Z"
          fill="currentColor"
          fillOpacity="0.18"
          stroke="currentColor"
          strokeWidth="1.6"
        />
        <path
          d="M212 45h22q3 0 4 3l4 12h-28Z"
          fill="currentColor"
          fillOpacity="0.14"
          stroke="currentColor"
          strokeWidth="1.6"
        />
        {/* Its door's seam, the handle on it, and the mirror on the screen's pillar. */}
        <path d="M210 78V48" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" opacity="0.35" />
        <path d="M214 62h7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" opacity="0.4" />
        <path d="M246 44v8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" opacity="0.4" />
        <rect x="243" y="51" width="6" height="6" rx="1.5" fill="currentColor" opacity="0.35" />

        {/* The bumper's lip, its lamp, and the skirt under the cab. */}
        <rect x="254" y="77" width="16" height="6" rx="2" fill="currentColor" fillOpacity="0.18" />
        <rect x="255" y="66" width="8" height="6" rx="1.5" fill="currentColor" opacity="0.55" />
        <path d="M200 78h34" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" opacity="0.25" />

        {/* The trailer's tandem, and the cab's twin drive axle and steer axle. */}
        {[52, 78, 204, 216, 250].map((x) => (
          <Wheel key={x} x={x} />
        ))}
      </svg>
    </div>
  )
}

/** One wheel: its tyre, the rim inside it, and the hub at its middle. */
function Wheel({ x }: { x: number }) {
  return (
    <g>
      <circle cx={x} cy={89} r="11" fill="currentColor" fillOpacity="0.06" stroke="currentColor" strokeWidth="2.4" />
      <circle cx={x} cy={89} r="5.5" fill="none" stroke="currentColor" strokeWidth="1.6" opacity="0.45" />
      <circle cx={x} cy={89} r="1.8" fill="currentColor" opacity="0.55" />
    </g>
  )
}
