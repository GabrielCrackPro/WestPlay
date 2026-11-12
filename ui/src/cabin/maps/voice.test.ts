import { afterEach, describe, expect, it, vi } from 'vitest'
import type { Telemetry } from '../../shared/host'
import type { LiveState } from '../state/store'
import { useLive } from '../state/store'
import type { Guidance } from './guidance'
import { dueToSpeak, followGpsVoice, SPEAK_HOLD_MS, useGpsVoice, voiceDue } from './voice'

/** The next step `distance` metres ahead: a right turn, or the arrival. */
const turn = (distance: number): Guidance => ({
  step: { kind: 'turn', maneuver: { node: 1, turn: 'right', angle: 90, exit: null } },
  distance,
  then: null,
})
const arrive = (distance: number): Guidance => ({ step: { kind: 'arrive' }, distance, then: null })

describe('dueToSpeak', () => {
  it('says nothing without a route to follow', () => {
    expect(dueToSpeak(null, 20, 'few')).toBe(false)
  })

  it('opens the window where the truck covers the setting’s seconds', () => {
    // 20 m/s (72 km/h): a few seconds is 70 m of road, so the voice's last moments start there.
    expect(dueToSpeak(turn(80), 20, 'few')).toBe(false)
    expect(dueToSpeak(turn(70), 20, 'few')).toBe(true)
  })

  it('opens later at the turn, and earlier the whole approach', () => {
    // The same 120 m at the same speed: only the early choice has ducked by then.
    expect(dueToSpeak(turn(120), 20, 'just')).toBe(false)
    expect(dueToSpeak(turn(120), 20, 'few')).toBe(false)
    expect(dueToSpeak(turn(120), 20, 'early')).toBe(true)
    // Two seconds before the turn is 40 m, no more.
    expect(dueToSpeak(turn(41), 20, 'just')).toBe(false)
    expect(dueToSpeak(turn(40), 20, 'just')).toBe(true)
  })

  it('still hears the voice at a crawl, and holds through the junction', () => {
    // Under the floor of 25 m a standstill would never duck.
    expect(dueToSpeak(turn(30), 0, 'just')).toBe(false)
    expect(dueToSpeak(turn(25), 0, 'just')).toBe(true)
    // Inside the junction: the step is "now".
    expect(dueToSpeak(turn(0), 8, 'just')).toBe(true)
  })

  it('stops at the ceiling, so a motorway turn is not ducked for half a minute', () => {
    // 100 m/s: six seconds would be 600 m, kept to 450.
    expect(dueToSpeak(turn(460), 100, 'early')).toBe(false)
    expect(dueToSpeak(turn(450), 100, 'early')).toBe(true)
  })

  it('gives the arrival the same room as a turn', () => {
    expect(dueToSpeak(arrive(80), 20, 'few')).toBe(false)
    expect(dueToSpeak(arrive(70), 20, 'few')).toBe(true)
  })
})

/** A truck at `distance` metres from one right turn (node 1), at 72 km/h, in a running game. */
function live(distance: number, paused = false): LiveState {
  return {
    telemetry: { speed: 20, navigationDistance: distance, paused } as Telemetry,
    route: {
      id: 1,
      nodes: [],
      distances: [0, 0],
      paths: new Map(),
      maneuvers: [{ node: 1, turn: 'right', angle: 90, exit: null }],
      shifts: new Map(),
    },
    routeNext: 1,
  } as unknown as LiveState
}

describe('voiceDue', () => {
  it('speaks for the turn the window covers, and not for the one beyond it', () => {
    expect(voiceDue(live(70))).toBe(true)
    expect(voiceDue(live(80))).toBe(false)
  })

  it('is quiet without a route, and over a paused game', () => {
    expect(voiceDue({ telemetry: { paused: false } as Telemetry, route: null } as unknown as LiveState)).toBe(false)
    expect(voiceDue(live(40, true))).toBe(false)
  })
})

describe('followGpsVoice', () => {
  afterEach(() => {
    vi.useRealTimers()
    useGpsVoice.setState({ talking: false })
  })

  it('marks the voice talking as a turn comes, and through the sentence after it', () => {
    vi.useFakeTimers()
    const stop = followGpsVoice()
    useLive.setState(live(70))
    expect(useGpsVoice.getState().talking).toBe(true)
    // Through the junction: the voice is still saying the turn, so the sign waits with it.
    useLive.setState(live(1000))
    expect(useGpsVoice.getState().talking).toBe(true)
    // Exactly the hold the music's dip keeps (apps/ducks.ts), so the two let go together.
    vi.advanceTimersByTime(SPEAK_HOLD_MS - 200)
    expect(useGpsVoice.getState().talking).toBe(true)
    vi.advanceTimersByTime(200)
    expect(useGpsVoice.getState().talking).toBe(false)
    stop()
  })

  it('keeps the mark up through a turn that comes straight after the last one', () => {
    vi.useFakeTimers()
    const stop = followGpsVoice()
    useLive.setState(live(70))
    useLive.setState(live(1000))
    // The next one inside the window before the hold is up: no gap between the two.
    useLive.setState(live(70))
    vi.advanceTimersByTime(SPEAK_HOLD_MS * 2)
    expect(useGpsVoice.getState().talking).toBe(true)
    stop()
  })

  it('clears the mark when it stops, even mid-turn, and leaves no release behind', () => {
    vi.useFakeTimers()
    const stop = followGpsVoice()
    useLive.setState(live(40))
    expect(useGpsVoice.getState().talking).toBe(true)
    stop()
    expect(useGpsVoice.getState().talking).toBe(false)
    expect(vi.getTimerCount()).toBe(0)
  })
})
