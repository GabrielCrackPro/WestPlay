import { create } from 'zustand'
import { playCue } from '../state/sound'

/** How long the pill stays up after the last change, ms. */
const SHOWN_MS = 1500

/**
 * What the pill says: the volume a keybind set (0 to 1, drawn as its bar), or a change that has no number of its own —
 * the Dashboard's widget size — by the name of where it landed.
 */
export type HudContent = { kind: 'volume'; volume: number } | { kind: 'size'; label: string }

/**
 * The cab's HUD (shell/VolumeHud.tsx): a glass pill at the top of the content area for a moment after each change,
 * saying what the change was. One store for every change rather than one each, so two never stack in the same place:
 * whatever changed last is what the screen shows.
 */
export const useHud = create<{ shown: boolean; content: HudContent }>()(() => ({
  shown: false,
  content: { kind: 'volume', volume: 0 },
}))

let hiding: ReturnType<typeof setTimeout> | undefined

/** Shows `content` for a moment (SHOWN_MS), in place of whatever was shown. */
export function showHud(content: HudContent): void {
  clearTimeout(hiding)
  useHud.setState({ shown: true, content })
  hiding = setTimeout(() => useHud.setState({ shown: false }), SHOWN_MS)
}

/** Shows the volume (0 to 1) for a moment: a keybind changed it. */
export function showVolume(volume: number): void {
  // A quiet pip per step, as a head unit gives (state/sound.ts, Settings › Sound).
  playCue('volume')
  showHud({ kind: 'volume', volume })
}

/** Shows a widget's new size by its name, for a moment: the Dashboard's Now Playing card is pressed to resize it. */
export function showWidgetSize(label: string): void {
  showHud({ kind: 'size', label })
}
