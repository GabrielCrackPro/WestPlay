import { useCabin } from './state/store'

/** The CSS keyframe easing used by the cabin's stylesheet (`--motion-ease`, shell.css ~lines 7–33 and
 * cluster.css ~lines 17–33): a critically damped spring, `1 - (1 + wt)e^-wt`, sampled into a CSS `linear()`
 * easing. The same curve as Motion's `motionEase` below, kept as a stylesheet value so a CSS state change and
 * a Motion entrance settle together; the Motion source of truth is below.
 */
export const motionEaseCss: readonly [number, ...number[]] = [
  0, 0.0575, 0.1803, 0.3208, 0.4551, 0.5729, 0.6711, 0.7501, 0.8122, 0.8601, 0.8966, 0.924, 0.9445, 0.9596, 0.9708,
  0.9789, 0.9848, 0.9891, 0.9922, 0.9944, 0.996, 0.9972, 0.998, 0.9986, 0.999, 0.9993, 0.9996, 0.9998, 0.9999, 0.99997,
  0.99999, 1,
]

/** The cabin's motion, as Motion reads it: the same curve the stylesheet moves on (`--motion-ease`, shell.css and
 * cluster.css), so a Motion entrance and a CSS state change beside it settle together.
 *
 * That curve is a critically damped spring, `1 - (1 + wt)e^-wt`, sampled in CSS with `linear()`; this is the same
 * function in JS, where Motion can use it. Kept here rather than read from the CSS custom property because it is a
 * timing function, not a value a stylesheet can hand to a script.
 */
export const SPRING = 9.25

/** The rate the spring pushes: the 9.25 shared by `--motion-ease` in shell.css and cluster.css. */
export const motionEase = (time: number) => 1 - (1 + SPRING * time) * Math.exp(-SPRING * time)

/** Milliseconds to seconds: the stylesheets count in ms, Motion in s. */
export const seconds = (ms: number) => ms / 1000

/**
 * A card that arrives over the cabin and goes again — a note in the notification stack, the call alert: down from
 * just above and a touch small, settling on the cabin's curve, and out the way it came. The stack keeps a card
 * mounted for the length of `outMs` so its departure is seen (`useLeaving` in shell/Notifications.tsx), which is what
 * `leaving` is; and a driver who has cut the cabin's motion gets it at rest, where nothing moves at all.
 */
export function overlayMotion(leaving: boolean, reduced: boolean, inMs: number, outMs: number) {
  if (reduced) {
    return { initial: false, animate: { opacity: leaving ? 0 : 1 }, transition: { duration: 0 } } as const
  }
  return {
    initial: leaving ? false : { opacity: 0, y: -16, scale: 0.94 },
    animate: leaving ? { opacity: 0, y: -10, scale: 0.97 } : { opacity: 1, y: 0, scale: 1 },
    transition: { duration: seconds(leaving ? outMs : inMs), ease: motionEase },
  }
}

/** Deterministic sample of the spring at evenly spaced times, used by the CSS build and the test tie.
 * Shared so the CSS `linear()` sample array and the motion.test.ts assertions stay derived from the same source. */
export const sampleMotionEase = (start: number, end: number, count: number): number[] => {
  const out: number[] = new Array(count)
  for (let i = 0; i < count; i++) {
    const t = start + (end - start) * (i / Math.max(1, count - 1))
    out[i] = motionEase(t)
  }
  return out
}

/** Whether movement is off: the app's own Reduce Motion (state/store.ts), which starts from the PC's preference and
 * is what `html[data-motion='reduced']` is set from. A Motion entrance reads this and arrives at rest instead. */
export function useMotionReduced(): boolean {
  return useCabin((state) => state.reduceMotion)
}
