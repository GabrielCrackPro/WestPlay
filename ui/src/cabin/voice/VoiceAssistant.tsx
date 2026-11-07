import { type CSSProperties, useCallback, useEffect, useRef } from 'react'
import { postToHost } from '../../shared/host'
import { usePhone } from '../apps/phone/phone'
import { useNowPlaying } from '../dashboard/useNowPlaying'
import { nameOf, usePlaces } from '../maps/places'
import { BrandIcon } from '../shell/BrandIcon'
import { logoSources } from '../boot/brand'
import { playCue } from '../state/sound'
import { RELEASED_APP_IDS } from '../state/apps'
import { useCabin, useLive } from '../state/store'
import { useLanguage, useText } from '../state/text'
import { prepareVoiceAudio } from './audio'
import { handleVoice } from './intents'
import { followMicrophoneLevel } from './level'
import { speak } from './speak'
import { useVoice } from './voice'
import './voice.css'

/** The mic button and its short panel, over whatever the cab shows. */
export function VoiceAssistant() {
  const text = useText()
  const language = useLanguage()
  const truck = useLive((state) => state.truck)
  const places = usePlaces()
  const showing = useNowPlaying().showing
  const enabled = useCabin((state) => state.voiceEnabled)
  const phase = useVoice((state) => state.phase)
  const transcript = useVoice((state) => state.transcript)
  const error = useVoice((state) => state.error)
  const message = useVoice((state) => state.message)
  const resultId = useVoice((state) => state.resultId)
  const hotkey = useVoice((state) => state.hotkey)
  const handled = useRef(0)
  const lastHotkey = useRef(0)
  const meter = useRef<HTMLSpanElement>(null)

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
  const failure = phase === 'error'
  const detail = failure
    ? error === 'no-speech'
      ? text.voice.noSpeech
      : error === 'unavailable'
        ? text.voice.unavailable
        : text.voice.unavailable
    : listening
      ? text.voice.listening
      : phase === 'processing'
        ? text.voice.processing
        : message || (transcript ? text.voice.processing : '')
  const open = phase !== 'idle' || Boolean(message) || failure

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

  // The fixed push-to-talk chord: the page makes the same utterance the mic button does.
  useEffect(() => {
    if (!enabled || !hotkey || hotkey === lastHotkey.current) return
    lastHotkey.current = hotkey
    start()
  }, [enabled, hotkey, start])

  // The host's wake listener follows this truck and the cabin's language: “Hey Scania”, “Hola Scania”.
  useEffect(() => {
    postToHost({ type: 'voiceWakePhrase', brand: truck?.brand ?? '', language })
  }, [truck?.brand, language])

  // The bars follow the microphone while it listens, through a custom property rather than a render a frame.
  useEffect(() => {
    const bars = meter.current
    if (!bars) return
    bars.style.setProperty('--meter-level', '0')
    if (!listening) return
    return followMicrophoneLevel((level) => bars.style.setProperty('--meter-level', level.toFixed(3)))
  }, [listening])

  if (!enabled) return null

  return (
    <div className="voice-assistant" data-phase={phase} data-appear hidden={!open}>
      {open && (
        <section
          className="voice-card"
          data-phase={phase}
          data-activate-mark
          role="status"
          aria-live="polite"
          aria-label={text.voice.assistant}
        >
          {' '}
          <span className="voice-card-mark" aria-hidden>
            {truck ? (
              <img src={logoSources(truck.brandId, truck.brand, { mono: true })[0].src} alt="" />
            ) : (
              <BrandIcon />
            )}
          </span>
          <div className="voice-card-copy">
            <div className="voice-card-head">
              <span className="voice-eyebrow">{truck ? truck.brand : text.voice.assistant}</span>
              {listening && (
                <span ref={meter} className="voice-meter" aria-hidden>
                  {Array.from({ length: 4 }, (_, index) => (
                    <span key={index} style={{ '--bar': index } as CSSProperties} />
                  ))}
                </span>
              )}
            </div>
            {transcript && !failure && <p className="voice-transcript">{transcript}</p>}
            <p className={failure ? 'voice-detail error' : 'voice-detail'}>{detail}</p>
          </div>
          <button
            type="button"
            className="voice-dismiss"
            aria-label={text.close}
            onClick={() => (listening ? useVoice.getState().cancel() : useVoice.getState().reset())}
          >
            <CloseGlyph />
          </button>
        </section>
      )}
    </div>
  )
}

function CloseGlyph() {
  return (
    <svg
      viewBox="0 0 24 24"
      width="17"
      height="17"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.4"
      strokeLinecap="round"
      aria-hidden
    >
      <path d="m7 7 10 10M17 7 7 17" />
    </svg>
  )
}
