import type { CompanionWords } from '.'
import { words as polish } from './pl_pl'

/** Silesian: Polish's words for now, as the onboarding's, with the game's own Silesian name for its Mod
 * Manager, so it matches what the player sees there. */
export const words: CompanionWords = {
  ...polish,
  phone: {
    unpair: 'Unpair Phone',
    title: 'Phone',
    phone: 'Phone',
    waiting: 'No phone connected',
    connected: 'Connected',
    address: 'Address',
    code: 'Code',
    scan: 'In Cabin Play Bridge on your Android phone, on the same Wi-Fi, scan this until it pairs.',
    copy: 'Copy',
    copied: 'Copied',
    qr: 'Pairing QR code',
    noDoor:
      'This PC has no local network address, so a phone can’t pair. Connect the PC to Wi-Fi and start Cabin Play again.',
  },
  uninstall: {
    ...polish.uninstall,
    profilesFailed:
      'Nie udało się zmienić profili ({n}) i nadal zawierają Cabin Play. Usuń go tam w menu „Mynedżer modōw”.',
  },
}
