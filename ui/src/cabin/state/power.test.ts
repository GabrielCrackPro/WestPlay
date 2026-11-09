import { describe, expect, it } from 'vitest'
import {
  bootLength,
  bootShown,
  CONNECTING_MS,
  HANDOVER_MS,
  handoverAt,
  INITIAL_POWER,
  nextPhaseAt,
  power,
  type PowerState,
  SPLASH_MS,
} from './power'

function run(events: Parameters<typeof power>[1][], start: PowerState = INITIAL_POWER): PowerState {
  return events.reduce(power, start)
}

describe('power', () => {
  it('only reconnects when first seen with the electrics already on', () => {
    const state = run([{ type: 'electrics', on: true, at: 100 }])
    expect(state).toEqual({ phase: 'connecting', since: 100, observed: true })
  })

  it('boots with the brand splash when the electrics come on', () => {
    const state = run([
      { type: 'electrics', on: false, at: 0 },
      { type: 'electrics', on: true, at: 1000 },
    ])
    expect(state).toEqual({ phase: 'splash', since: 1000, observed: true })
  })

  it('boots without the brand splash on a screen that is not the truck’s own (the tablet)', () => {
    const state = run([
      { type: 'electrics', on: false, at: 0 },
      { type: 'electrics', on: true, at: 1000, truckScreen: false },
    ])
    expect(state).toEqual({ phase: 'connecting', since: 1000, observed: true })
  })

  it('advances splash → connecting → on with time', () => {
    const splash = run([
      { type: 'electrics', on: false, at: 0 },
      { type: 'electrics', on: true, at: 1000 },
    ])
    expect(power(splash, { type: 'tick', at: 1000 + SPLASH_MS - 1 }).phase).toBe('splash')
    const connecting = power(splash, { type: 'tick', at: 1000 + SPLASH_MS })
    expect(connecting).toMatchObject({ phase: 'connecting', since: 1000 + SPLASH_MS })
    expect(power(connecting, { type: 'tick', at: 1000 + SPLASH_MS + CONNECTING_MS }).phase).toBe('on')
  })

  it('turns off from any phase when the electrics go off', () => {
    for (const phase of ['splash', 'connecting', 'on'] as const) {
      const state = power({ phase, since: 0, observed: true }, { type: 'electrics', on: false, at: 50 })
      expect(state).toEqual({ phase: 'off', since: 50, observed: true })
    }
  })

  it('ignores repeated electrics events', () => {
    const on: PowerState = { phase: 'on', since: 10, observed: true }
    expect(power(on, { type: 'electrics', on: true, at: 99 })).toBe(on)
    const off: PowerState = { phase: 'off', since: 10, observed: true }
    expect(power(off, { type: 'electrics', on: false, at: 99 })).toBe(off)
  })

  it('does not advance while off or on', () => {
    const off: PowerState = { phase: 'off', since: 0, observed: true }
    expect(power(off, { type: 'tick', at: 1e9 })).toBe(off)
    const on: PowerState = { phase: 'on', since: 0, observed: true }
    expect(power(on, { type: 'tick', at: 1e9 })).toBe(on)
  })
})

describe('bootShown', () => {
  it('shows the cabin’s boot on the other screen, where the cabin is in it', () => {
    // A page that sees the boot begin plays it from its first frame.
    expect(bootShown({ phase: 'splash', since: 1000 }, 1000)).toEqual({ phase: 'splash', since: 1000, elapsed: 0 })
    // One that loads into a boot already under way joins it there, not at its beginning.
    expect(bootShown({ phase: 'connecting', since: 1000 }, 3200)).toEqual({
      phase: 'connecting',
      since: 1000,
      elapsed: 2200,
    })
  })

  it('has no boot to show once the screen is on or off, or before the cabin has said', () => {
    expect(bootShown({ phase: 'on', since: 1000 }, 6000)).toBeNull()
    expect(bootShown({ phase: 'off', since: 1000 }, 6000)).toBeNull()
    expect(bootShown(null, 6000)).toBeNull()
  })

  it('never starts a boot before its own beginning', () => {
    // The phase's start is clamped to its moment on the cabin's clock, which can be a hair ahead of this page's.
    expect(bootShown({ phase: 'splash', since: 1000 }, 990)).toMatchObject({ elapsed: 0 })
  })
})

describe('bootLength', () => {
  it('is the phases the boot goes through, from the first of them', () => {
    expect(bootLength('splash')).toBe(SPLASH_MS + CONNECTING_MS)
    expect(bootLength('connecting')).toBe(CONNECTING_MS)
  })
})

describe('handoverAt', () => {
  it('is the boot’s last part before it ends, on the clock that counts it', () => {
    expect(handoverAt({ phase: 'splash', since: 1000 })).toBe(1000 + SPLASH_MS + CONNECTING_MS - HANDOVER_MS)
    expect(handoverAt({ phase: 'connecting', since: 1000 })).toBe(1000 + CONNECTING_MS - HANDOVER_MS)
  })

  it('is null when there is no boot to hand over from', () => {
    expect(handoverAt({ phase: 'on', since: 1000 })).toBeNull()
    expect(handoverAt({ phase: 'off', since: 1000 })).toBeNull()
    expect(handoverAt(null)).toBeNull()
  })
})

describe('nextPhaseAt', () => {
  it('is when splash and connecting end, and null otherwise', () => {
    expect(nextPhaseAt({ phase: 'splash', since: 400, observed: true })).toBe(400 + SPLASH_MS)
    expect(nextPhaseAt({ phase: 'connecting', since: 400, observed: true })).toBe(400 + CONNECTING_MS)
    expect(nextPhaseAt({ phase: 'on', since: 0, observed: true })).toBeNull()
    expect(nextPhaseAt(INITIAL_POWER)).toBeNull()
  })

  it('advances on a tick for the moment it names, whatever the fractions of the clock', () => {
    // performance.now() times have fractions; a tick sent for the due moment must never fall short of it.
    for (const since of [0.1, 1000.3, 123456.789, 98765.4321]) {
      const splash: PowerState = { phase: 'splash', since, observed: true }
      const connecting = power(splash, { type: 'tick', at: nextPhaseAt(splash) ?? 0 })
      expect(connecting.phase).toBe('connecting')
      expect(power(connecting, { type: 'tick', at: nextPhaseAt(connecting) ?? 0 }).phase).toBe('on')
    }
  })
})
