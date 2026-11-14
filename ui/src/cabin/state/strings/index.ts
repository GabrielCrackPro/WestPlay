import { ENGLISH_STRINGS } from './en'
import { SPANISH_STRINGS } from './es'
import { TURKISH_STRINGS } from './tr'
import type { Language, Strings } from './types'

export type { Language, Strings } from './types'

/** The cabin's own words, by the game's language. */
export const STRINGS: Record<Language, Strings> = {
  en: ENGLISH_STRINGS,
  tr: TURKISH_STRINGS,
  es: SPANISH_STRINGS,
}

/** The cabin's language for the game's (its `g_lang_init`, e.g. `tr_tr`; `null` until known). */
export function languageOf(gameLanguage: string | null): Language {
  const language = gameLanguage?.toLowerCase().slice(0, 2)
  return language === 'tr' || language === 'es' ? language : 'en'
}
