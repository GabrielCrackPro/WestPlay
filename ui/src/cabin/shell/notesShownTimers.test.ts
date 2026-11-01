import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

/** A stand-in for the page's storage: this suite runs in Node, where `localStorage` isn't there. */
function stubbedStorage() {
  const kept = new Map<string, string>()
  return {
    getItem: (key: string) => kept.get(key) ?? null,
    setItem: (key: string, value: string) => void kept.set(key, value),
    removeItem: (key: string) => void kept.delete(key),
  }
}

describe('the notes’ time up', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.stubGlobal('localStorage', stubbedStorage())
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
    vi.resetModules()
  })

  it('a reading raised again keeps its own six seconds, not the earlier push’s', async () => {
    const { NOTE_SHOWN_MS, useNotes } = await import('./notesShown')
    const raise = (key: string) => useNotes.getState().push({ key, title: key, detail: '1', tone: 'alarm' })
    const shown = () => useNotes.getState().notes.map((note) => note.key)

    // Four at once: the first is pushed out of the stack of pills, its timer still running.
    for (const key of ['battery', 'oil', 'air', 'fuel']) raise(key)
    expect(shown()).toEqual(['oil', 'air', 'fuel'])

    // It comes on again a moment later: its own timer, the earlier one stood down.
    vi.advanceTimersByTime(1000)
    raise('battery')

    // The first push's six seconds pass: the pill raised after them is still up.
    vi.advanceTimersByTime(NOTE_SHOWN_MS - 1000 + 100)
    expect(shown()).toContain('battery')

    // Its own six seconds pass, and it goes.
    vi.advanceTimersByTime(NOTE_SHOWN_MS)
    expect(shown()).not.toContain('battery')
  })
})
