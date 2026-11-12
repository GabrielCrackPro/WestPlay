import { motion } from 'motion/react'
import { memo, useState } from 'react'
import { motionEase, seconds } from '../motion'
import { useLingering } from './useLingering'
import { useSmoothed } from './useSmoothed'

/**
 * The dash's dial: the face, the speed figure rolling on it, and the tacho's hairline outside it. It is a module of its
 * own because it keeps a clock of its own — `useSmoothed` carries the two readings towards the truck's a frame at a
 * time, and only this SVG is redrawn while they travel, where the panel around it carries on at the rate the telemetry
 * arrives.
 */

/** The dial's geometry: a 270° sweep from 7:30 to 4:30, as a truck's speedometer counts. */
const DIAL_RADIUS = 127
const DIAL_CIRCUMFERENCE = 2 * Math.PI * DIAL_RADIUS
const DIAL_SWEEP = 0.75
const DIAL_START = 135
const DIAL_SWEEP_DEGREES = 270
/* The self-test a dash runs at power-up, as the electrics come on: the face lit to its far end, held there while the
   bezel, the scale and its numbers come up (`hold`), then falling back to the reading over `sweep`. It lands inside the
   dash's first second, since the panel is only put on the glass once the boot is over and the driver is waiting on it. */
const SWEEP_HOLD_MS = 200
const SWEEP_MS = 520

/* How long the speed limit's sign and its mark on the scale take to leave the panel once the route stops knowing a
   limit: long enough to read as a fade, short enough that the mark isn't still there on the next road. */
export const LIMIT_LEAVE_MS = 420
/* How long the cruise's mark takes to leave the face once the cruise is switched off: one fade, and a little shorter
   than the limit's — the driver has just pressed the button, so there is nothing in its going to be read. */
const CRUISE_LEAVE_MS = 320

/* The speed figure's roll: each place that changes turns like a wheel on a counter, the digit it was on stepping out
   and the one it is on stepping in, both in the direction its own number moved. Motion springs the step rather than a
   tween easing it — damped a shade under critical, so the digit decelerates into its place and settles there as a
   drum does instead of stopping dead on it. The figure is never far from where it should be: the number is the
   truck's speed, and only its arrival is softened.

   A spring is written as mass, stiffness and damping rather than a duration and an easing, so the timing is what the
   wheel does rather than a length of time it is handed: at 380 and 35 it is critically damped to within a tenth and
   comes to rest in about a quarter of a second, overshooting by well under a pixel of the twelve it travels. The fade
   is shorter than the step, so a turning wheel is solid almost as soon as it starts. The step is small on purpose: the
   figure is the reading, so the roll is a nudge against it rather than a number travelling across the face, and it
   keeps clear of the unit set under it. */
const SPEED_ROLL_STIFFNESS = 380
const SPEED_ROLL_DAMPING = 35
const SPEED_ROLL_FADE_MS = 150
const SPEED_ROLL_PX = 12

/* The tacho: its hairline outside the speedo's, read against a 2,500 rpm scale. The scale is the dial's, and the panel
   reads the reading against it before handing the face a share (ClusterScreen's `rpm`). */
export const RPM_MAX = 2500
const RPM_RADIUS = 139
const RPM_CIRCUMFERENCE = 2 * Math.PI * RPM_RADIUS
/* Where the red starts, as a share of the scale: Scania's red field begins at 2,400 and runs to the end. */
const RPM_REDLINE = 2400 / RPM_MAX

/** What the dial draws, as plain numbers: a face (its top speed) and the two readings on it. */
interface ClusterDialProps {
  /** How far round the face the truck is, 0 (at rest) to 1 (the face's top speed). */
  speedShare: number
  /** The engine's share of its own scale, 0 to 1. */
  rpm: number
  /** The limit the route knows, in the face's own units (0 when there is none): marked across the ring. */
  limit: number
  /** The speed the cruise is holding, in the face's own units (0 when it holds none): marked inside the ring. */
  cruise: number
  /** The face's top speed, in the driver's units: the end of the ring the arc fills towards. */
  max: number
  /** Whether the tacho's ring is drawn outside the speed's (Settings › Instrument Cluster). */
  tacho: boolean
  /** The app's Reduce Motion setting: the face arrives at rest rather than assembling itself. */
  reduced: boolean
}

/**
 * The speed figure, rolling from one kilometre to the next the way the counter on a mechanical dash does: the places
 * that change slide one step, in the direction their own number moved, and the places that don't stay still.
 *
 * It is a row of places rather than one number so the roll is only ever as big as the change: the units wheel turns as
 * the truck climbs and the tens hold, which is what a counter looks like, where moving the whole figure a step for
 * every kilometre would shake all three digits and read as a fault. The reading itself is never eased — the figure is
 * the speed the truck is at, not a smoothed copy of it — only its arrival is.
 *
 * The figure is also the only thing on the face that changes when the road's limit changes: the sign below states the
 * limit and stays the sign it is, so the number being read taking the limit's red is the whole of it.
 */
export const SpeedFigure = memo(function SpeedFigure({
  speed,
  limit,
  reduced,
}: {
  speed: number
  /** The limit the route knows, in the face's own units, or null when it knows none. */
  limit: number | null
  /** The app's Reduce Motion setting: the figure is put in place rather than rolling into it. */
  reduced: boolean
}) {
  // The places from the right, so a new leading digit is a place of its own: a place is a wheel on the counter and
  // keeps its number as the figure grows, where keying from the left would hand "100"'s tens to "99"'s units.
  const places = String(Math.max(0, speed)).split('')
  return (
    <strong className="cluster-speed-value" data-over={limit !== null && speed > limit ? '' : undefined}>
      {places.map((place, index) => (
        <SpeedPlace key={places.length - index} digit={Number(place)} reduced={reduced} />
      ))}
    </strong>
  )
})

/** One place of the speed figure: the digit it is on, and the one it is coming from for the length of the roll. */
const SpeedPlace = memo(function SpeedPlace({ digit, reduced }: { digit: number; reduced: boolean }) {
  // The digit being replaced, held for the roll. Taken in the render that sees the new digit rather than from an
  // effect — React's own "derive state from a prop" pattern — so the browser is handed the roll as one frame and never
  // paints the old digit sitting under the new one.
  const [last, setLast] = useState(digit)
  const [roll, setRoll] = useState<{ from: number; to: number } | null>(null)
  if (last !== digit) {
    setLast(digit)
    setRoll(reduced ? null : { from: last, to: digit })
  }
  const direction = roll === null || roll.to > roll.from ? 1 : -1
  // Motion moves both digits of the roll: one spring for the step out and the step in, so the wheel is a single
  // motion rather than two, and the opacity is a short tween beside it — the fade crossing over as the step runs,
  // rather than a digit arriving out of the dark.
  const rollOn = {
    y: { type: 'spring' as const, stiffness: SPEED_ROLL_STIFFNESS, damping: SPEED_ROLL_DAMPING },
    opacity: { duration: seconds(SPEED_ROLL_FADE_MS), ease: motionEase },
  }
  return (
    <span className="cluster-speed-place">
      {roll && (
        <motion.span
          key={`from-${roll.from}`}
          initial={{ y: 0, opacity: 1 }}
          animate={{ y: -direction * SPEED_ROLL_PX, opacity: 0 }}
          transition={rollOn}
        >
          {roll.from}
        </motion.span>
      )}
      <motion.span
        key={`to-${digit}`}
        // The arriving digit comes up from below rather than from nothing: it is already two fifths read as it starts
        // to move, so a wheel turning quickly is a digit passing through, not a place blinking on the face.
        initial={roll ? { y: direction * SPEED_ROLL_PX, opacity: 0.4 } : false}
        animate={{ y: 0, opacity: 1 }}
        transition={rollOn}
        // Once the roll is over the digit it came from is gone from the panel, and the next one starts from here.
        onAnimationComplete={() => setRoll((current) => (current?.to === digit ? null : current))}
      >
        {digit}
      </motion.span>
    </span>
  )
})

/**
 * The dial's face, kept to what a digital cluster needs: the speed as one lit arc round a figure, and the tacho as a
 * hairline outside it. There is no scale printed on the face — no numbers, no ticks, no comb of dots. Those were a
 * second reading of the same thing: the figure at the centre already says the speed exactly, and a ring of numbers
 * beside it made the eye choose between them from across the cab, with the marks between the two crossing the digits.
 * The arc answers the one question the ring is for — how far up the truck's speed is — and the ring carries just two
 * marks: the road's limit across it, and the speed the cruise is holding inside it.
 *
 * It is a component of its own because it keeps a clock of its own: `useSmoothed` carries the two readings towards the
 * truck's a frame at a time, and only this SVG is redrawn while they travel — the panels, the route and the notices
 * carry on at the rate the telemetry actually arrives. Memoised on plain numbers, so a reading that leaves the dial
 * alone costs it nothing.
 *
 * It opens the way a dash does when the electrics come on: the arc lit to the far end of its scale, held while the
 * face comes up, then falling back to the reading as the boot clears (SWEEP_HOLD_MS, SWEEP_MS). The panel is put on
 * the glass when the boot is over, which is what puts that sweep where the driver can see it rather than behind the
 * splash.
 */
export const ClusterDial = memo(function ClusterDial({
  speedShare,
  rpm,
  limit,
  cruise,
  max,
  tacho,
  reduced,
}: ClusterDialProps) {
  // The two readings as the face shows them: eased a frame at a time, the speed opening with the power-up sweep.
  const shownSpeed = useSmoothed(speedShare, { from: 1, hold: SWEEP_HOLD_MS, sweep: SWEEP_MS })
  const shownRpm = useSmoothed(rpm)
  // The limit's mark: the sign's own clock (LIMIT_LEAVE_MS), so the mark and the sign leave the panel together. A
  // limit past the face's top speed has no place on this face and so isn't marked at all.
  const mark = useLingering(limit > 0 && limit <= max ? limit : null, LIMIT_LEAVE_MS)
  // The cruise's mark, by the same rules: the speed it holds, kept for one fade after the cruise is switched off,
  // and no mark at all for a set speed past the face's top (there is nowhere on this face to put it).
  const cruiseMark = useLingering(cruise > 0 && cruise <= max ? cruise : null, CRUISE_LEAVE_MS)

  // The face's parts each fade in at their own moment, on the groove's own clock: the remount as the boot clears plays
  // them once per boot. Reduced motion brings the whole face up at rest.
  const marks = (delay: number, duration: number) =>
    reduced
      ? { initial: false, animate: { opacity: 1 }, transition: { duration: 0 } }
      : { initial: { opacity: 0 }, animate: { opacity: 1 }, transition: { duration, delay, ease: motionEase } }

  return (
    <svg className="cluster-dial-ring" viewBox="0 0 300 300" aria-hidden>
      <motion.circle
        className="cluster-dial-track"
        cx="150"
        cy="150"
        r={DIAL_RADIUS}
        strokeDasharray={`${DIAL_CIRCUMFERENCE * DIAL_SWEEP} ${DIAL_CIRCUMFERENCE}`}
        transform={`rotate(${DIAL_START} 150 150)`}
        {...marks(0.04, 0.3)}
      />
      {/* The speed, as a lit arc in the track: how far round the face the driver is, drawn in the dash's accent so
          the one colour on the glass is also the speed. Its length is the smoothed reading, so it is a frame's worth
          of movement rather than a step. At a standstill the cap goes square: a round cap on a zero-length dash
          still draws a dot, and a lone accent bead at the scale's start read as a fault light, not as zero. */}
      <motion.circle
        className="cluster-dial-fill"
        cx="150"
        cy="150"
        r={DIAL_RADIUS}
        strokeDasharray={`${DIAL_CIRCUMFERENCE * DIAL_SWEEP * shownSpeed} ${DIAL_CIRCUMFERENCE}`}
        transform={`rotate(${DIAL_START} 150 150)`}
        style={{ strokeLinecap: shownSpeed > 0 ? 'round' : 'butt' }}
        {...marks(0.06, 0.3)}
      />
      {/* The speed the cruise is holding, as a notch inside the ring where that speed falls: the arc says how fast
          the truck is going, and this says the speed it is being held at, so the two read against each other without
          leaving the face. It points in from the ring rather than crossing it, because the one mark that crosses the
          ring is the road's limit; and it is drawn under the limit's group, so the road's mark stays on top if the two
          ever fall together. Its angle is a transform the stylesheet transitions, so a set speed changed by a step
          slides round the face, and it is held for one fade after the cruise is off, as the limit's mark is. */}
      {cruiseMark.value !== null && (
        <motion.g
          className="cluster-dial-cruise"
          data-leaving={cruiseMark.leaving ? '' : undefined}
          style={{
            transform: `rotate(${DIAL_START + 90 + DIAL_SWEEP_DEGREES * (cruiseMark.value / max)}deg)`,
            transformOrigin: '150px 150px',
          }}
          initial={reduced ? false : { opacity: 0 }}
          animate={{ opacity: cruiseMark.leaving ? 0 : 1 }}
          transition={reduced ? { duration: 0 } : { duration: 0.42, ease: motionEase }}
        >
          <line className="cluster-dial-cruise-mark" x1="150" y1={150 - 126} x2="150" y2={150 - 114} />
        </motion.g>
      )}
      {/* The limit where it falls on the ring, drawn over the lit arc so passing it reads as passing it: the sign
          under the figure says what the limit is, and this says where it is on the truck's own speed. It is a mark
          across the ring rather than a second scale, as a bar prints its threshold line across itself, with the band
          past it shading the reserve — the face's own way of showing a limit without printing numbers on it. It is held
          for one fade after the route stops knowing a limit, so it leaves with the sign rather than blinking away. Its
          angle is a transform the stylesheet can transition, so a limit that changes slides round the face. */}
      {mark.value !== null && (
        <motion.g
          className="cluster-limit"
          data-leaving={mark.leaving ? '' : undefined}
          style={{
            transform: `rotate(${DIAL_START + 90 + DIAL_SWEEP_DEGREES * (mark.value / max)}deg)`,
            transformOrigin: '150px 150px',
          }}
          initial={reduced ? false : { opacity: 0 }}
          animate={{ opacity: mark.leaving ? 0 : 1 }}
          transition={reduced ? { duration: 0 } : { duration: 0.42, ease: motionEase }}
        >
          {/* The face past the limit, as a field under the mark: the same radius, three times the ring's width and a
              shade fainter, running from the limit to the scale's end. It rides in the mark's group so it fades in and
              slides round the face with the mark, and it begins at the group's own 12 o'clock — the mark's direction,
              three quarters of the way along the circle's path — which puts its leading edge on the limit whatever the
              limit is. */}
          {mark.value < max && (
            <circle
              className="cluster-limit-band"
              cx="150"
              cy="150"
              r={DIAL_RADIUS}
              strokeDasharray={`${DIAL_CIRCUMFERENCE * DIAL_SWEEP * (1 - mark.value / max)} ${DIAL_CIRCUMFERENCE}`}
              strokeDashoffset={-DIAL_CIRCUMFERENCE * 0.75}
            />
          )}
          <line className="cluster-limit-mark" x1="150" y1={150 - 132} x2="150" y2={150 - 122} />
        </motion.g>
      )}
      {/* The tacho, off when the settings say so: the speed's ring then stands alone on the face, which is the
          quieter dash some drivers want on a screen this small. */}
      {tacho && (
        <>
          <motion.circle
            className="cluster-dial-rpm-track"
            cx="150"
            cy="150"
            r={RPM_RADIUS}
            strokeDasharray={`${RPM_CIRCUMFERENCE * DIAL_SWEEP} ${RPM_CIRCUMFERENCE}`}
            transform={`rotate(${DIAL_START} 150 150)`}
            {...marks(0.05, 0.3)}
          />
          <motion.circle
            className="cluster-dial-rpm"
            cx="150"
            cy="150"
            r={RPM_RADIUS}
            strokeDasharray={`${RPM_CIRCUMFERENCE * DIAL_SWEEP * shownRpm} ${RPM_CIRCUMFERENCE}`}
            transform={`rotate(${DIAL_START} 150 150)`}
            style={{ strokeLinecap: shownRpm > 0 ? 'round' : 'butt' }}
            {...marks(0.07, 0.3)}
          />
          {/* The tacho's redline, printed on its own hairline: the one band a tach needs to read. Scania also marks
              the auxiliary brake's zone (2,000 to 2,400 rpm) in blue; on a face this quiet a second colour field at
              the rim pulled the eye off the speed, and the retarder's own steps say when the brake is in use. */}
          <motion.circle
            className="cluster-rpm-redline"
            cx="150"
            cy="150"
            r={RPM_RADIUS}
            strokeDasharray={`${RPM_CIRCUMFERENCE * DIAL_SWEEP * (1 - RPM_REDLINE)} ${RPM_CIRCUMFERENCE}`}
            strokeDashoffset={-RPM_CIRCUMFERENCE * DIAL_SWEEP * RPM_REDLINE}
            transform={`rotate(${DIAL_START} 150 150)`}
            {...marks(0.12, 0.52)}
          />
        </>
      )}
    </svg>
  )
})
