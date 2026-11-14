import type { Language } from '../state/text'

const PREFIX: Record<Language, string> = {
  en: 'Hey',
  tr: 'Selam',
  es: 'Hola',
}

/** The name the recogniser hears: no punctuation, so “Mercedes-Benz” is said “Mercedes Benz”. */
function spokenBrand(brand: string | null | undefined): string {
  return (brand ?? '')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim()
    .replace(/\s+/g, ' ')
}

/** The wake phrase the assistant answers to in this truck and cabin language: “Hey Scania”, “Hola Scania”. */
export function wakePhrase(brand: string | null | undefined, language: Language): string {
  return `${PREFIX[language]} ${spokenBrand(brand) || 'Cabin'}`
}
