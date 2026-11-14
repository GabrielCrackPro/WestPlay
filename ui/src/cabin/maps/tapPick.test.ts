import { describe, expect, it } from 'vitest'
import type { Destination } from './places'
import { toLngLat } from './projection'
import { nearestPlace } from './tapPick'

function place(name: string, x: number, z: number): Destination {
  return { kind: 'fuel', name, at: toLngLat(x, z), node: name }
}

const A = place('A', 1000, 1000)
const B = place('B', 1400, 1000)

describe('the place a tap on the map picks', () => {
  it('is the nearest one within reach of the tap', () => {
    expect(nearestPlace([A, B], [1100, 1000], 300)?.name).toBe('A')
    expect(nearestPlace([A, B], [1350, 1000], 300)?.name).toBe('B')
  })

  it('is none when the tap landed away from every place', () => {
    expect(nearestPlace([A, B], [3000, 3000], 300)).toBeNull()
  })

  it('is none before the places have loaded', () => {
    expect(nearestPlace(null, [1000, 1000], 300)).toBeNull()
    expect(nearestPlace(undefined, [1000, 1000], 300)).toBeNull()
  })
})
