import { isInHost, postToHost } from '../../shared/host'
import type { Language } from '../state/strings'

const LOCALES: Record<Language, string> = { en: 'en-US', tr: 'tr-TR', es: 'es-ES' }

/** Speaks a short confirmation through the cab's own speakers, or the browser's in a plain preview. */
export function speak(text: string, language: Language): void {
  if (!text) return
  if (isInHost()) {
    postToHost({ type: 'voiceSpeak', text, language })
    return
  }
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return
  const utterance = new SpeechSynthesisUtterance(text)
  utterance.lang = LOCALES[language]
  utterance.rate = 1.02
  utterance.pitch = 1
  window.speechSynthesis.cancel()
  window.speechSynthesis.speak(utterance)
}
