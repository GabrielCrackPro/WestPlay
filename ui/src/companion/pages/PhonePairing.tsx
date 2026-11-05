import { useState } from 'react'
import { phoneUnpair, type PhoneStatus } from '../useHostStatus'
import { qrCode } from '../qr'
import { Button, Group, Note, Row, Tick } from '../room/parts'
import type { CompanionWords } from './words'

/**
 * The paired phone's rows, for the Phone page (PhonePage): whether it's connected, the address and code Cabin Play
 * Bridge takes, and Unpair, which takes a new code so the old phone can't come back; then the same line as a code
 * the phone's camera scans. Pairing is the companion's alone — the cabin page's Phone app draws only what the
 * phone sends, so the link's token is never on the truck's screen.
 */
export function PhonePairing({
  phone,
  words,
  place,
}: {
  phone: PhoneStatus | null
  words: CompanionWords['phone']
  place: number
}) {
  const [copied, setCopied] = useState(false)
  const pairing = phone?.pairing ?? null
  const device = phone?.device ?? null
  const phoneDetail = phone?.connected
    ? [device?.name ?? words.connected, device?.appVersion && `Bridge ${device.appVersion}`]
        .filter(Boolean)
        .join(' · ')
    : words.waiting

  // The whole line as the phone takes it: scanned, or pasted in one go.
  const copy = async () => {
    if (!pairing) return
    try {
      await navigator.clipboard.writeText(pairing.uri)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      // A WebView that won't write to the clipboard: the code and the address are still on screen to type.
    }
  }

  return (
    <>
      {/* The page's panel is already titled with the phone's own words: the group needs none. */}
      <Group place={place}>
        <Row
          title={words.phone}
          detail={phoneDetail}
          accessory={phone?.connected ? <Tick done /> : undefined}
        />
        {pairing && (
          <>
            <Row title={words.address} detail={`${pairing.host}:${pairing.port}`} />
            <Row title={words.code} detail={pairing.token} />
            <Row title={words.unpair} danger onClick={() => void phoneUnpair()} />
          </>
        )}
      </Group>
      {pairing ? (
        <div className="cp-phone-pair ob-in">
          <PhoneQr uri={pairing.uri} label={words.qr} />
          <div className="cp-phone-pair-words">
            <p>{words.scan}</p>
            <Button glass small onClick={copy}>
              {copied ? words.copied : words.copy}
            </Button>
          </div>
        </div>
      ) : (
        phone && <Note>{words.noDoor}</Note>
      )}
    </>
  )
}

/** The pairing line as a QR code, on a white plate with the quiet zone a phone's camera needs. */
function PhoneQr({ uri, label }: { uri: string; label: string }) {
  const code = qrCode(uri)
  if (!code) return null
  // Four modules of white all round, as the standard asks of whatever shows a code.
  const quiet = 4
  const side = code.size + quiet * 2
  return (
    <svg
      className="cp-phone-qr"
      viewBox={`0 0 ${side} ${side}`}
      role="img"
      aria-label={label}
      shapeRendering="crispEdges"
    >
      <rect width={side} height={side} fill="#fff" />
      <path d={code.path} transform={`translate(${quiet} ${quiet})`} fill="#000" />
    </svg>
  )
}
