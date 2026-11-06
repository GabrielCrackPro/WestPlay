import { useEffect, useRef } from 'react'
import { isInHost } from '../../../shared/host'
import { onLaunchStart, whenTransitionEnds } from '../../state/launch'
import { useCabin } from '../../state/store'
import { useText } from '../../state/text'
import { followArea } from '../youtube/youtube'
import { claimKeys, useWhatsApp, whatsapp } from './whatsapp'
import './whatsapp.css'

/**
 * WhatsApp, in its window: WhatsApp's own page, placed under the CarPlay area by the host and cut open there
 * (Shell.tsx), the window's rounding included. The whole window is the page — nothing of WestPlay's is drawn
 * over it, WhatsApp's own header, list and conversations included.
 *
 * The page isn't WestPlay's own: it can't grow out of the app's icon or shrink back into it. So it's shown
 * once the window has opened (it loads meanwhile), and taken away just before the window closes.
 *
 * Outside WestPlay (a plain browser) the page can't show: the window says so instead.
 */
export function WhatsAppApp() {
  const text = useText()
  const frame = useRef<HTMLDivElement>(null)
  const handedOver = useCabin((state) => state.truckScreen)
  useEffect(() => {
    const element = frame.current
    if (!element || handedOver || !isInHost()) return
    // Loaded while the window grows in: the page is there when it opens.
    whatsapp({ action: 'start' })
    // The keys are the page's while it's open (typing.rs: the host sends them there, not to the cabin page).
    const release = claimKeys()
    let gone = false
    let shown = false
    let cutting = 0
    const hide = () => {
      gone = true
      cancelAnimationFrame(cutting)
      useWhatsApp.setState({ hole: null })
      whatsapp({ action: 'hide' })
    }
    const place = () => {
      if (gone || !shown) return
      const area = document.querySelector('.carplay')?.getBoundingClientRect()
      const box = element.getBoundingClientRect()
      if (!area || box.width === 0) return
      // Its rounding in screen pixels (the CarPlay area's content is zoomed to the screen's scale).
      const zoom = box.width / element.offsetWidth
      const radius = parseFloat(getComputedStyle(element).borderTopLeftRadius) * zoom
      const scale = window.devicePixelRatio
      // The page first, then the hole over it (a hole cut first would show an empty frame for a moment: the
      // page is under the whole screen, and only the hole lets it through).
      whatsapp({
        action: 'show',
        x: Math.round(box.left * scale),
        y: Math.round(box.top * scale),
        width: Math.round(box.width * scale),
        height: Math.round(box.height * scale),
      })
      cancelAnimationFrame(cutting)
      cutting = requestAnimationFrame(() => {
        if (!gone) {
          useWhatsApp.setState({
            hole: { x: box.left - area.left, y: box.top - area.top, width: box.width, height: box.height, radius },
          })
        }
      })
    }
    const following = followArea(place, element)
    // A hole cut while the window grows out of its icon would show the page whole, its size already final.
    whenTransitionEnds(() => {
      if (gone) return
      shown = true
      place()
    })
    // The window shrinking into its icon can't take the page with it (it would show at full size through it):
    // it goes before the window is snapshotted.
    const closing = onLaunchStart('whatsapp', 'close', hide)
    return () => {
      closing()
      following()
      release()
      hide()
    }
  }, [handedOver])
  return (
    <section className="app-panel whatsapp-app" aria-label={text.apps.whatsapp}>
      <div className="whatsapp-page" ref={frame} aria-hidden />
      {!isInHost() && <p className="whatsapp-preview">{text.whatsappApp.preview}</p>}
    </section>
  )
}
