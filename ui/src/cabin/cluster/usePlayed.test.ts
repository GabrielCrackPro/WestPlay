import { describe, expect, it } from 'vitest'
import type { NowPlayingInfo } from '../../shared/host'
import { playedOf } from './usePlayed'

/** A track as the host reports it: the position it was at, and the moment it said so. */
const said = (over: Partial<NowPlayingInfo> = {}): NowPlayingInfo => ({
  title: 'The Long Way Home',
  artist: 'Night Shift',
  playing: true,
  app: 'spotify',
  position: 30,
  at: 1_000_000,
  duration: 200,
  ...over,
})

describe('playedOf', () => {
  it('runs the position on from the moment the player said where it was', () => {
    // Five seconds after the report, five seconds further into the track.
    expect(playedOf(said(), 1_005_000)).toEqual({ position: 35, duration: 200 })
  })

  it('holds the position while the track is paused', () => {
    expect(playedOf(said({ playing: false }), 1_005_000)).toEqual({ position: 30, duration: 200 })
  })

  it('never runs past the end of the track', () => {
    expect(playedOf(said({ position: 199 }), 1_010_000)?.position).toBe(200)
  })

  it('reads the reported position when the clock is behind the report', () => {
    // A page whose clock is behind the one the player reported on reads where the track was, not a negative run back.
    expect(playedOf(said(), 999_000)?.position).toBe(30)
  })

  it('draws no bar where there is no length to measure', () => {
    expect(playedOf(null, 1_005_000)).toBeNull()
    // A player that reports no length: the game's radio, and any stream.
    expect(playedOf(said({ duration: 0 }), 1_005_000)).toBeNull()
    expect(playedOf(said({ duration: null }), 1_005_000)).toBeNull()
    expect(playedOf(said({ position: null }), 1_005_000)).toBeNull()
  })
})
