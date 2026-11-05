import qrcode from 'qrcode-generator'

/** A QR code of some text, as the pairing card draws it. */
export interface QrCode {
  /** Modules a side (17 + 4·version: 21, 25, 29…). */
  size: number
  /** One SVG path, in modules, drawing every dark module: a bar for each run of them in a row. */
  path: string
  /** Whether the module `x` across and `y` down is dark. */
  dark: (x: number, y: number) => boolean
}

/**
 * The QR code of `text`, or `null` when there's none to make (no text, or more than a code can hold).
 *
 * Error correction level M: about 15% of the code may be damaged and a phone still reads it, which is what a
 * screen seen at an angle through a windscreen needs.
 */
export function qrCode(text: string): QrCode | null {
  if (!text) return null
  try {
    // Type 0: the smallest version that holds the text.
    const code = qrcode(0, 'M')
    code.addData(text)
    code.make()
    const size = code.getModuleCount()
    const dark = (x: number, y: number) => code.isDark(y, x)
    let path = ''
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        if (!dark(x, y)) continue
        let run = 1
        while (x + run < size && dark(x + run, y)) run++
        path += `M${x} ${y}h${run}v1h-${run}z`
        x += run - 1
      }
    }
    return { size, path, dark }
  } catch {
    return null
  }
}
