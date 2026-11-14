import { create } from 'zustand'
import { type WhatsAppCommand, postToHost } from '../../../shared/host'
import { useKeyboard } from '../../keyboard/store'

/** A rounded rectangle of the CarPlay area the page under it shows through (the shell's mask, as YouTube's). */
export interface Hole {
  x: number
  y: number
  width: number
  height: number
  radius: number
}

/**
 * The WhatsApp app: WhatsApp's own web app (web.whatsapp.com), run by the host in a WebView of its own, under the
 * cabin page (`crates/host/src/whatsapp.rs`). WestPlay draws the window and cuts it open where WhatsApp's page
 * shows, so the page fills it: it's WhatsApp's, its QR sign-in included, and the link lives in the host's own
 * profile.
 *
 * What's typed while the window is open is the page's (the host sends it there: `typing.rs`), so a conversation is
 * opened, scrolled and answered with the cab's own mouse and the player's keyboard.
 */
export const useWhatsApp = create<{ hole: Hole | null }>(() => ({ hole: null }))

/** What the host's WhatsApp page is asked (`westplay_host::whatsapp::Command`). */
export function whatsapp(command: WhatsAppCommand): void {
  postToHost({ type: 'whatsapp', command })
}

/**
 * The player's keyboard is WhatsApp's while its window is open: the host sends what's typed to the page instead of
 * the cabin page. Nothing is attached to the cab's own keyboard, so its keypad stays away (the page has its own);
 * the selection alone is what tells the host keys are wanted. Returns what gives them back.
 */
export function claimKeys(): () => void {
  const { field, selection } = useKeyboard.getState()
  // A cab field is being typed into (its keypad is up): it keeps the keys.
  if (field) return () => {}
  const claimed = selection + 1
  useKeyboard.setState({ selection: claimed })
  return () => {
    if (useKeyboard.getState().selection === claimed) useKeyboard.setState({ selection: 0 })
  }
}
