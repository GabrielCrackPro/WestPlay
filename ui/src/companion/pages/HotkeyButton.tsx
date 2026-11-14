import { useEffect, useRef } from 'react'
import { bindable, isModifier, keyOf, useKeyName } from '../keys'
import type { Words } from '../onboarding/words'
import type { VoiceHotkey } from '../useSettings'

/**
 * A push-to-talk chord, as a button: clicked, it listens, and the next key pressed with whatever Ctrl, Shift
 * and Alt are held becomes it. Esc, or clicking elsewhere, leaves it as it was.
 */
export function HotkeyButton({
  hotkey,
  label,
  listening,
  listen,
  choose,
  words,
  pressKey,
}: {
  hotkey: VoiceHotkey
  label: string
  listening: boolean
  /** Starts or stops listening (one keybind at a time). */
  listen(on: boolean): void
  choose(hotkey: VoiceHotkey): void
  words: Words
  /** "Press a key…" */
  pressKey: string
}) {
  const button = useRef<HTMLButtonElement>(null)
  useEffect(() => {
    if (!listening) return
    const keydown = (event: KeyboardEvent) => {
      event.preventDefault()
      event.stopPropagation()
      if (event.repeat) return
      if (event.key === 'Escape') {
        listen(false)
        return
      }
      const key = keyOf(event)
      if (key === null || isModifier(key) || !bindable(key)) return
      choose({ key, ctrl: event.ctrlKey, shift: event.shiftKey, alt: event.altKey })
      listen(false)
    }
    const mousedown = (event: MouseEvent) => {
      if (!button.current?.contains(event.target as Node)) listen(false)
    }
    window.addEventListener('keydown', keydown, true)
    window.addEventListener('mousedown', mousedown, true)
    return () => {
      window.removeEventListener('keydown', keydown, true)
      window.removeEventListener('mousedown', mousedown, true)
    }
  }, [listening, choose, listen])

  return (
    <button
      ref={button}
      type="button"
      className="ob-button cp-keybind"
      data-glass
      data-small
      data-listening={listening || undefined}
      aria-label={label}
      onClick={() => listen(!listening)}
    >
      {listening ? pressKey : <HotkeyName hotkey={hotkey} words={words} />}
    </button>
  )
}

/** A chord's keys: "Ctrl + Shift + Space". */
function HotkeyName({ hotkey, words }: { hotkey: VoiceHotkey; words: Words }) {
  const key = useKeyName(hotkey.key, words)
  const keys = [hotkey.ctrl ? 'Ctrl' : null, hotkey.shift ? 'Shift' : null, hotkey.alt ? 'Alt' : null, key].filter(
    (part): part is string => Boolean(part),
  )
  return <>{keys.join(' + ')}</>
}
