import { describe, expect, it } from 'vitest'
import { levelOf } from './level'

/** A sine wave of `amplitude`, the shape an open microphone sends. */
function wave(amplitude: number, length = 512): Float32Array {
  return Float32Array.from({ length }, (_, index) => amplitude * Math.sin(index / 8))
}

describe('the voice meter', () => {
  it('reads silence as empty', () => {
    expect(levelOf(new Float32Array(512))).toBe(0)
  })

  it('follows louder input upward', () => {
    const quiet = levelOf(wave(0.01))
    const talking = levelOf(wave(0.08))
    const loud = levelOf(wave(0.3))
    expect(quiet).toBeGreaterThan(0)
    expect(talking).toBeGreaterThan(quiet)
    expect(loud).toBeGreaterThan(talking)
    expect(loud).toBeLessThanOrEqual(1)
  })

  it('stays within the meter at full scale', () => {
    expect(levelOf(wave(1))).toBe(1)
  })
})
