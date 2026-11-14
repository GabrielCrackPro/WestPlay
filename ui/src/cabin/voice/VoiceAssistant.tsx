import { useCallback, useEffect, useRef } from 'react'
import { postToHost } from '../../shared/host'
import { usePhone } from '../apps/phone/phone'
import { useNowPlaying } from '../dashboard/useNowPlaying'
import { nameOf, usePlaces } from '../maps/places'
import { playCue } from '../state/sound'
import { RELEASED_APP_IDS } from '../state/apps'
import { useCabin, useLive } from '../state/store'
import { useLanguage, useText } from '../state/text'
import { prepareVoiceAudio } from './audio'
import { handleVoice } from './intents'
import { speak } from './speak'
import { useVoice } from './voice'

/**
 * The cab's voice assistant, heard rather than shown: it paints nothing of its own. What it is doing is on the screen's
 * own frame — the pulse the game's GPS voice uses (Shell.tsx, shell.css `screen-voice-glow`), lit while it listens, with
 * the cabin's accent — and what it did is said through the truck's speakers. A failure is said too, since there is no
 * card of words left to read it on.
 */
export function VoiceAssistant() {
  const text = useText()
  const language = useLanguage()
  const truck = useLive((state) => state.truck)
  const places = usePlaces()
  const showing = useNowPlaying().showing
  const enabled = useCabin((state) => state.voiceEnabled)
  const phase = useVoice((state) => state.phase)
  const error = useVoice((state) => state.error)
  const message = useVoice((state) => state.message)
  const resultId = useVoice((state) => state.resultId)
  const hotkey = useVoice((state) => state.hotkey)
  const handled = useRef(0)
  const lastHotkey = useRef(0)

  useEffect(() => {
    if (!resultId || handled.current === resultId) return
    handled.current = resultId
    const said = useVoice.getState().transcript
    void handleVoice(
      said,
      {
        places: places ?? [],
        contacts: usePhone.getState().contacts,
        text,
      },
      showing,
    ).then((outcome) => {
      useVoice.getState().settle(outcome.message)
      speak(outcome.spoken, language)
    })
  }, [resultId, places, text, language, showing])

  // A result or a failure is a moment's note, not a mode: it goes by itself.
  useEffect(() => {
    if ((phase !== 'idle' && phase !== 'error') || (!message && !error)) return
    const timer = setTimeout(() => useVoice.getState().reset(), 4200)
    return () => clearTimeout(timer)
  }, [phase, message, error])

  const listening = phase === 'listening'

  const start = useCallback(() => {
    if (!enabled) return
    if (listening) {
      useVoice.getState().cancel()
      return
    }
    prepareVoiceAudio()
    playCue('note')
    useVoice.getState().start({
      contacts: [
        ...new Set(
          usePhone
            .getState()
            .contacts.map((contact) => contact.name)
            .filter(Boolean),
        ),
      ].slice(0, 40),
      places: [
        ...new Set((places ?? []).map((place) => nameOf(place, text.destinations.kinds[place.kind])).filter(Boolean)),
      ].slice(0, 60),
      apps: [...new Set(RELEASED_APP_IDS.map((app) => text.apps[app]))].slice(0, 30),
      language,
    })
  }, [enabled, language, listening, places, text])

  // The fixed push-to-talk chord: the host hears it and tells the page to start, as the wake phrase does.
  useEffect(() => {
    if (!enabled || !hotkey || hotkey === lastHotkey.current) return
    lastHotkey.current = hotkey
    start()
  }, [enabled, hotkey, start])

  // The host's wake listener follows this truck and the cabin's language: “Hey Scania”, “Hola Scania”.
  useEffect(() => {
    postToHost({ type: 'voiceWakePhrase', brand: truck?.brand ?? '', language })
  }, [truck?.brand, language])

  // A failure is said rather than shown: the card that carried the words went with the overlay, and the screen's frame
  // is the only thing left to light — which says that it heard the chord, not what went wrong.
  useEffect(() => {
    if (phase !== 'error' || !error) return
    speak(error === 'no-speech' ? text.voice.noSpeech : text.voice.unavailable, language)
  }, [phase, error, language, text])

  // Nothing of its own on the glass: the pulse is the Shell's, the words are the speakers'.
  return null
}
