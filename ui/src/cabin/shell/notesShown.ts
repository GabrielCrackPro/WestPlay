import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'

/** How long a note's pill stays up, ms (long enough to read at the wheel, short enough not to sit over the map). */
export const NOTE_SHOWN_MS = 6000

/** A note with an action stays a little longer: long enough to reach for it, still not over the map all drive. */
export const NOTE_ACTION_SHOWN_MS = 10000

/** What a note can open: the Maps app (a fuel or rest stop) or the Diagnostics app (a fault's readings). */
export type NoteAction = 'maps' | 'diagnostics'

/** The most notes up at once: a brake fault and a low tank can come together; a fourth waits its turn. */
const MAX_NOTES = 3

/** The history's length: a long shift's worth of notes; past it the oldest go. */
export const MAX_HISTORY = 60

/** One note: what it's about, what it reads, and how serious it is. */
export interface Note {
  /** The reading it belongs to (the game's warning channel): the same one doesn't stack while it shows. */
  key: string
  title: string
  /** What the reading is now, e.g. "118 psi". */
  detail: string
  tone: 'warn' | 'alarm'
  /** The app the note can open for what it's about (none: a note to read and let go). */
  action?: NoteAction
}

/** A note as it was shown: the note itself, when it was raised, and what the game's clock said then. */
export interface NoteRecord extends Note {
  /** Its own id: two notes of the same reading (one this morning, one now) are two entries. */
  id: number
  /** When it was raised, ms since the epoch (the player's own clock). */
  at: number
  /** The game's clock then, in game minutes (`cabClock`); null when the game sent no telemetry. */
  clock: number | null
}

/** The next history entry's id: past the ones already kept, so a saved note and a new one never share it. */
let lastId = 0

/**
 * Each pill's timer, by the reading it's about. A note raised again stands the earlier timer down: without that,
 * a reading pushed out of the stack (a fourth note trims the oldest) and raised again a moment later was taken down
 * early by the first push's timer, after a second or two instead of its own six.
 */
const timers = new Map<string, ReturnType<typeof setTimeout>>()

function stopTimer(key: string): void {
  const timer = timers.get(key)
  if (timer === undefined) return
  clearTimeout(timer)
  timers.delete(key)
}

/** How many of the history the player hasn't looked at yet: the badge Home puts over the app's icon. */
export function unreadCount(history: NoteRecord[], seen: number): number {
  return history.filter((note) => note.id > seen).length
}

/**
 * The notes up over the app (Notifications.tsx), as the volume HUD shows the volume (volumeShown.ts): a glass
 * pill that comes and goes, nothing to press. A note takes itself down after [`NOTE_SHOWN_MS`]; a reading that
 * is still wrong when it goes doesn't come back until it goes right and wrong again (the caller's rising edge).
 *
 * Every note is kept in `history` too, newest first, for the Notifications app: the notes a driver missed while
 * looking at the road are still there to read. The history is saved with the cabin's other state (this PC's
 * storage), so a note from this morning's drive is there after a restart; the pills up on the screen are not.
 *
 * `seen` is the newest note the player has looked at (the app opened), which is what Home's badge counts from.
 */
export const useNotes = create<{
  notes: Note[]
  history: NoteRecord[]
  seen: number
  push(note: Note, when?: { at?: number; clock?: number | null }): void
  dismiss(key: string): void
  clearHistory(): void
  markSeen(): void
}>()(
  persist(
    (set, get) => ({
      notes: [],
      history: [],
      seen: 0,
      push: (note, when = {}) => {
        // Already up: the same reading's warning staying on is one note, not one a second.
        if (get().notes.some((shown) => shown.key === note.key)) return
        const record: NoteRecord = {
          ...note,
          id: (lastId = Math.max(lastId, ...get().history.map((kept) => kept.id)) + 1),
          at: when.at ?? Date.now(),
          clock: when.clock ?? null,
        }
        set((state) => ({
          notes: [...state.notes, note].slice(-MAX_NOTES),
          history: [record, ...state.history].slice(0, MAX_HISTORY),
        }))
        stopTimer(note.key)
        timers.set(
          note.key,
          setTimeout(
            () => {
              timers.delete(note.key)
              get().dismiss(note.key)
            },
            note.action ? NOTE_ACTION_SHOWN_MS : NOTE_SHOWN_MS,
          ),
        )
      },
      dismiss: (key) => {
        stopTimer(key)
        set((state) => ({ notes: state.notes.filter((note) => note.key !== key) }))
      },
      clearHistory: () => set({ history: [] }),
      // Opened: everything raised while the driver was on the road is read now.
      markSeen: () => set((state) => ({ seen: Math.max(state.seen, ...state.history.map((note) => note.id)) })),
    }),
    {
      name: 'westplay.notifications',
      version: 1,
      storage: createJSONStorage(() => localStorage),
      // Only the history and what has been read: a pill still up belongs to this session's telemetry, not the last's.
      partialize: (state) => ({ history: state.history, seen: state.seen }),
      // Stored by an earlier WestPlay (or edited): keep only what reads as a note.
      merge: (stored, current) => {
        const kept = stored as { history?: unknown; seen?: unknown } | undefined
        return {
          ...current,
          history: validHistory(kept?.history),
          seen: Number.isFinite(kept?.seen) ? (kept?.seen as number) : 0,
        }
      },
    },
  ),
)

function validHistory(history: unknown): NoteRecord[] {
  if (!Array.isArray(history)) return []
  return history
    .filter(
      (note): note is NoteRecord =>
        typeof note === 'object' &&
        note !== null &&
        typeof note.key === 'string' &&
        typeof note.title === 'string' &&
        typeof note.detail === 'string' &&
        (note.tone === 'warn' || note.tone === 'alarm') &&
        (note.action === undefined || note.action === 'maps' || note.action === 'diagnostics') &&
        Number.isFinite(note.id) &&
        Number.isFinite(note.at),
    )
    .map((note) => ({ ...note, clock: Number.isFinite(note.clock) ? note.clock : null }))
    .slice(0, MAX_HISTORY)
}
