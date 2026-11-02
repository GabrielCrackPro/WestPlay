import { describe, expect, it } from 'vitest'
import { estimatedTraffic } from './estimatedTraffic'
import type { Point } from './route'

/** A straight line east from the world's middle, `metres` long, a point every 20 m (a route as the map has it). */
function line(metres: number): Point[] {
  return Array.from({ length: Math.ceil(metres / 20) + 1 }, (_, i): Point => [1000 + i * 20, -3000])
}

describe('the traffic estimated in single player', () => {
  it('has nothing to say about a line with no length', () => {
    expect(estimatedTraffic([], 8 * 60)).toEqual([])
    expect(estimatedTraffic([[0, 0]], 8 * 60)).toEqual([])
  })

  it('says the same thing every time the same road is passed at the same hour', () => {
    expect(estimatedTraffic(line(4000), 8 * 60)).toEqual(estimatedTraffic(line(4000), 8 * 60))
  })

  it('changes as the game day does', () => {
    expect(estimatedTraffic(line(20000), 8 * 60)).not.toEqual(estimatedTraffic(line(20000), 3 * 60))
  })

  it('is busier in the rush than at night', () => {
    const stretches = (minute: number) => estimatedTraffic(line(40000), minute).length
    expect(stretches(8 * 60)).toBeGreaterThan(stretches(3 * 60))
  })

  it('draws each stretch of one level as one line, on the road it was read from', () => {
    const found = estimatedTraffic(line(40000), 17 * 60)
    expect(found.length).toBeGreaterThan(0)
    let previous: { line: Point[]; level: string } | null = null
    for (const stretch of found) {
      expect(['slow', 'jammed']).toContain(stretch.level)
      expect(stretch.line.length).toBeGreaterThan(1)
      for (const [, z] of stretch.line) expect(z).toBeCloseTo(-3000)
      // Two stretches of one level side by side would have been drawn as one: theirs meet only with a quiet
      // stretch between them.
      if (previous?.level === stretch.level)
        expect(stretch.line[0]).not.toEqual(previous.line[previous.line.length - 1])
      previous = stretch
    }
  })
})
