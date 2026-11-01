import { sparklinePoints } from './trip'

/**
 * A reading's last minute or so as a line, in the card's own tone: flat while nothing changes, a shape when it
 * does. Drawn in a 100 by 24 box stretched to the card's width, the stroke kept a stroke as it stretches.
 */
export function Sparkline({ values }: { values: number[] }) {
  const points = sparklinePoints(values)
  if (!points) return null
  return (
    <svg className="diag-spark" viewBox="0 0 100 24" preserveAspectRatio="none" aria-hidden>
      {/* pathLength 1, so the stroke's dash is the whole line: the CSS draws it on as the card comes in. */}
      <polyline
        points={points}
        pathLength={1}
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  )
}
