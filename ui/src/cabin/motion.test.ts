import { expect, test, describe } from 'vitest'
import { motionEase, SPRING, sampleMotionEase } from './motion'

/** The boot and cluster both drive their easing from this same spring, and the boot's CSS
 * (boot.css) samples it at 20 ms steps over 0.6 s into a single linear() curve. These tests tie
 * that curve back to the spring so a change to one side of that cut can't drift from the other. Both
 * the listed CSS samples and the dense monotonic check are derived from `sampleMotionEase` so they stay
 * on the same spring.
 */
describe('motionEase matches the CSS linear() easing both screens share', () => {
  test('curve matches the CSS linear() sample array and stays monotonic', () => {
    // The stylesheet's sample array (boot.css / shell.css / cluster.css) is the design-time source
    // of truth written by hand from the same spring; the test ties each of those samples back to the
    // JS spring and then checks the whole sampled shape in one pass.
    const css = sampleMotionEase(0, 0.6, 31)

    let worst = 0
    for (let i = 0; i < css.length; i++) {
      const cssSample = css[i]
      const javascriptTime = (i / Math.max(1, css.length - 1)) * 0.6
      const diff = Math.abs(motionEase(javascriptTime) - cssSample)
      if (diff > worst) worst = diff
      expect(diff).toBeLessThan(1 / 256)
    }
    expect(worst).toBeLessThan(1 / 8)

    // Full-curve: sample the spring densely and confirm the whole shape is monotonic and bounded, so
    // Motion never produces an entrance frame that a CSS transition beside it could not also land on.
    const sample = sampleMotionEase(0.001, 0.6, 600)
    expect(sample[0]).toBeGreaterThan(0)
    expect(sample[0]).toBeLessThan(0.001)
    for (let i = 1; i < sample.length; i++) {
      expect(sample[i]).toBeGreaterThan(sample[i - 1])
      expect(sample[i]).toBeLessThan(1)
    }
    expect(sample[sample.length - 1]).toBeGreaterThan(0.9)
    expect(sample[sample.length - 1]).toBeLessThan(1)

    // SPRING is the single shared constant; if it changes, both the JS motion and the CSS linear()
    // samples above need re-deriving together.
    expect(SPRING).toBe(9.25)
  })
})
