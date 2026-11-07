import { create } from 'zustand'
import { isInHost, postToHost, type VoiceState } from '../../shared/host'

/** The names the host's recogniser may hear for this utterance. */
export interface VoiceVocabulary {
  contacts: string[]
  places: string[]
  apps: string[]
  language: 'en' | 'tr' | 'es'
}

interface VoiceStore {
  phase: VoiceState
  transcript: string
  error: string
  message: string
  /** Changes once per result, so the screen runs the intent exactly once. */
  resultId: number
  /** Changes each time the fixed push-to-talk chord is pressed. */
  hotkey: number
  start(vocabulary: VoiceVocabulary): void
  cancel(): void
  receive(state: VoiceState, transcript?: string, error?: string): void
  settle(message: string): void
  reset(): void
}

// A cancelled utterance's events are late news: the page ignored the request, so it ignores what comes back
// until the next start.
let ignoreHost = false

/**
 * The cab's voice assistant. The host owns recognition (crates/host voice.rs) and its microphone; this store
 * carries its state to the screen and sends the names the recogniser should listen for. While listening, the
 * page opens the same microphone only to measure the level the meter shows (voice/level.ts).
 */
/** The host's voice state, passed into the store from the page's message loop. */
export function receiveVoice(state: VoiceState, transcript?: string, error?: string): void {
  useVoice.getState().receive(state, transcript, error)
}

/** The host's push-to-talk chord, passed into the store from the page's message loop. */
export function receiveVoiceHotkey(): void {
  useVoice.setState((state) => ({ hotkey: state.hotkey + 1 }))
}

export const useVoice = create<VoiceStore>()((set) => ({
  phase: 'idle',
  transcript: '',
  error: '',
  message: '',
  resultId: 0,
  hotkey: 0,
  start: (vocabulary) => {
    ignoreHost = false
    if (!isInHost()) {
      set({ phase: 'error', error: 'unavailable', transcript: '', message: '' })
      return
    }
    postToHost({ type: 'voice', command: 'start', ...vocabulary })
    set({ phase: 'listening', transcript: '', error: '', message: '' })
  },
  cancel: () => {
    ignoreHost = true
    postToHost({ type: 'voice', command: 'cancel' })
    set({ phase: 'idle', transcript: '', error: '', message: '' })
  },
  receive: (state, transcript = '', error = '') => {
    if (ignoreHost) return
    set((current) => ({
      phase: state,
      transcript: transcript || current.transcript,
      error,
      resultId: state === 'result' ? current.resultId + 1 : current.resultId,
    }))
  },
  settle: (message) => set({ phase: 'idle', message }),
  reset: () => set({ phase: 'idle', transcript: '', error: '', message: '' }),
}))
