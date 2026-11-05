import type { CompanionWords } from '.'
import { words as france } from './fr_fr'

/** French (Canada): France's French, with Québec's usage where it differs ("plugiciel"). */
export const words: CompanionWords = {
  ...france,
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
  setup: {
    ...france.setup,
    plugin: 'Plugiciel',
    reinstalled: 'Réinstallé',
    checking: { title: 'Vérification de votre jeu', text: 'Version, plugiciel et mods' },
  },
  uninstall: {
    ...france.uninstall,
    steps: { ...france.uninstall.steps, plugin: 'Suppression du plugiciel' },
  },
  about: { ...france.about, log: 'Journal du plugiciel' },
}
