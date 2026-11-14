import { describe, expect, it } from 'vitest'
import { qrCode } from './qr'

const URI = 'cabinplay://pair?host=192.168.1.20&port=47654&token=AbCdEfGhIjKlMnOp'

describe('the pairing QR code', () => {
  it('is a square of a size QR codes have', () => {
    const code = qrCode(URI)
    expect(code).not.toBeNull()
    // 17 + 4·version modules a side: 21, 25, 29…
    expect(code!.size % 4).toBe(1)
    expect(code!.size).toBeGreaterThanOrEqual(21)
    expect(code!.path.startsWith('M')).toBe(true)
  })

  it('draws the three finder patterns in their corners', () => {
    const code = qrCode(URI)!
    const finder = (left: number, top: number) => {
      for (let y = 0; y < 7; y++) {
        for (let x = 0; x < 7; x++) {
          const ring = x === 0 || x === 6 || y === 0 || y === 6
          const core = x >= 2 && x <= 4 && y >= 2 && y <= 4
          expect(code.dark(left + x, top + y), `module ${x}, ${y}`).toBe(ring || core)
        }
      }
    }
    finder(0, 0)
    finder(code.size - 7, 0)
    finder(0, code.size - 7)
  })

  it('draws the timing patterns between them', () => {
    const code = qrCode(URI)!
    for (let i = 8; i < code.size - 8; i++) {
      expect(code.dark(i, 6), `column ${i}`).toBe(i % 2 === 0)
      expect(code.dark(6, i), `row ${i}`).toBe(i % 2 === 0)
    }
  })

  it('has nothing for nothing, and grows with a longer line', () => {
    expect(qrCode('')).toBeNull()
    const short = qrCode(URI)!
    const long = qrCode(`${URI}&pad=${'x'.repeat(200)}`)!
    expect(long.size).toBeGreaterThan(short.size)
  })
})
