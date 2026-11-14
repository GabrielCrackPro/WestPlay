import { afterEach, describe, expect, it, vi } from 'vitest'
import type { Telemetry } from '../../shared/host'
import { useLive } from '../state/store'
import { duckMusicForGps } from './ducks'
import type { MusicPlayer } from './musicWithGame'

/** A player that keeps what it is sent, and the volume its player chose, apart. */
function fakePlayer(): MusicPlayer & { sent: number[] } {
  const sent: number[] = []
  return {
    name: 'test',
    sent,
    playingHere: () => true,
    pauseHere: () => undefined,
    resumeHere: () => undefined,
    volume: () => 0.8,
    sendVolume: (share) => {
      sent.push(share)
    },
    setVolume: () => undefined,
    subscribe: () => () => undefined,
  }
}

/** A route with one turn in it, `distance` metres ahead (the truck at node 1). */
function hear(distance: number): void {
  useLive.setState({
    telemetry: { speed: 20, navigationDistance: distance, paused: false } as Telemetry,
    route: {
      id: 1,
      nodes: [],
      distances: [0, 0],
      paths: new Map(),
      maneuvers: [{ node: 1, turn: 'right', angle: 90, exit: null }],
      shifts: new Map(),
    },
    routeNext: 1,
  })
}

describe('duckMusicForGps', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it('dips what plays here as a turn comes, and brings it back after it', () => {
    vi.useFakeTimers()
    const player = fakePlayer()
    const stop = duckMusicForGps([player])

    hear(70)
    vi.advanceTimersByTime(200)
    expect(player.sent.at(-1)).toBeCloseTo(0.28)

    // Through the junction and away: the hold runs out and the music comes back to the player's own volume.
    hear(1000)
    vi.advanceTimersByTime(3000)
    expect(player.sent.at(-1)).toBeCloseTo(0.8)
    stop()
  })

  it('keeps the music up while the turn is still far off', () => {
    vi.useFakeTimers()
    const player = fakePlayer()
    const stop = duckMusicForGps([player])

    hear(120)
    vi.advanceTimersByTime(500)
    expect(player.sent).toEqual([])
    stop()
  })

  it('holds the dip through the junction itself', () => {
    vi.useFakeTimers()
    const player = fakePlayer()
    const stop = duckMusicForGps([player])

    hear(40)
    vi.advanceTimersByTime(200)
    expect(player.sent.at(-1)).toBeCloseTo(0.28)
    // Inside it, the step is still "now": nothing comes back up early.
    hear(0)
    vi.advanceTimersByTime(1500)
    expect(player.sent.at(-1)).toBeCloseTo(0.28)
    stop()
  })
})
