import { Panel } from '../room/parts'
import { SectionGlyph } from './glyphs'
import type { PageProps } from './page'
import { PhonePairing } from './PhonePairing'

/**
 * The phone paired with this PC, on a page of its own: whether it's connected, the address and code Cabin Play
 * Bridge takes, that same line as a code the phone's camera scans, and Unpair, which takes a new code so the old
 * phone can't come back. Pairing is this window's alone — the cabin page's Phone app draws only what the phone
 * sends, so the link's token never reaches the truck's screen.
 */
export function PhonePage({ cw, status }: PageProps) {
  return (
    <Panel place="page" title={cw.phone.title} icon={<SectionGlyph id="phone" />}>
      <PhonePairing phone={status?.phone ?? null} words={cw.phone} place={3} />
    </Panel>
  )
}
