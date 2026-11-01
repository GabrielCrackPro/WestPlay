import { afterEach, describe, expect, it, vi } from 'vitest'

/** A browser's storage holding the history an earlier run of WestPlay saved. */
function savedStorage(state: unknown, version = 1) {
  const items = new Map([['westplay.notifications', JSON.stringify({ state, version })]])
  return {
    getItem: (key: string) => items.get(key) ?? null,
    setItem: (key: string, value: string) => void items.set(key, value),
    removeItem: (key: string) => void items.delete(key),
  }
}

const SAVED = [
  { key: 'brakeAir', title: 'Brake air', detail: '68 psi', tone: 'alarm', id: 7, at: 1_761_000_000_000, clock: 610 },
  { key: 'rest', title: 'Rest stop', detail: '12 min', tone: 'warn', id: 4, at: 1_760_999_000_000, clock: 580 },
]

afterEach(() => {
  vi.unstubAllGlobals()
  vi.resetModules()
})

describe('the saved notifications', () => {
  it('come back after a restart, and a new note takes an id past them', async () => {
    vi.stubGlobal('localStorage', savedStorage({ history: SAVED }))
    const { useNotes } = await import('./notesShown')
    expect(useNotes.getState().history).toEqual(SAVED)
    // Nothing is up on the screen: a pill belongs to the session that raised it.
    expect(useNotes.getState().notes).toEqual([])

    useNotes.getState().push({ key: 'fuel', title: 'Fuel', detail: '180 l', tone: 'alarm' })
    expect(useNotes.getState().history.map((note) => note.id)).toEqual([8, 7, 4])
  })

  it('keep only what reads as a note', async () => {
    vi.stubGlobal(
      'localStorage',
      savedStorage({
        history: [SAVED[0], { key: 'fuel' }, { ...SAVED[1], tone: 'urgent' }, 'nonsense', SAVED[1]],
      }),
    )
    const { useNotes } = await import('./notesShown')
    expect(useNotes.getState().history.map((note) => note.id)).toEqual([7, 4])
  })

  it('are empty when nothing was saved (an earlier WestPlay)', async () => {
    vi.stubGlobal('localStorage', savedStorage({}))
    const { useNotes } = await import('./notesShown')
    expect(useNotes.getState().history).toEqual([])
  })

  it('remember what has been read, so only newer notes are counted unread', async () => {
    vi.stubGlobal('localStorage', savedStorage({ history: SAVED, seen: 7 }))
    const { unreadCount, useNotes } = await import('./notesShown')
    expect(unreadCount(useNotes.getState().history, useNotes.getState().seen)).toBe(0)

    useNotes.getState().push({ key: 'fuel', title: 'Fuel', detail: '180 l', tone: 'alarm' })
    expect(unreadCount(useNotes.getState().history, useNotes.getState().seen)).toBe(1)

    // The app opened: the badge clears, and stays cleared.
    useNotes.getState().markSeen()
    expect(unreadCount(useNotes.getState().history, useNotes.getState().seen)).toBe(0)
  })
})
