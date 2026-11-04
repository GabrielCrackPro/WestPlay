import { useEffect, useRef } from 'react'
import { command, useBrowser } from './browser'

/**
 * Where the page shows: its picture is the host's own WebView, placed under the page, and the CarPlay area is
 * cut open over this element (Shell.tsx), its rounding included. Placed again whenever it may have moved (the
 * window resizing, the CarPlay area growing back from the truck's screen).
 */
export function PageHole() {
  const frame = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const element = frame.current
    if (!element) return
    let gone = false
    const place = () => {
      if (gone) return
      const area = document.querySelector('.carplay')?.getBoundingClientRect()
      const box = element.getBoundingClientRect()
      if (!area || box.width === 0) return
      // Its rounding in screen pixels (the CarPlay area's content is zoomed to the screen's scale).
      const zoom = box.width / element.offsetWidth
      const radius = parseFloat(getComputedStyle(element).borderTopLeftRadius) * zoom
      useBrowser.setState({
        hole: { x: box.left - area.left, y: box.top - area.top, width: box.width, height: box.height, radius },
      })
      const scale = window.devicePixelRatio
      command({
        action: 'show',
        x: Math.round(box.left * scale),
        y: Math.round(box.top * scale),
        width: Math.round(box.width * scale),
        height: Math.round(box.height * scale),
      })
    }
    place()
    const resized = new ResizeObserver(place)
    resized.observe(element)
    const area = document.querySelector('.carplay')
    if (area) resized.observe(area)
    window.addEventListener('resize', place)
    // The app's window grows in from its icon (a transform, which no size change tells of).
    const settling = [120, 350, 700].map((ms) => setTimeout(place, ms))
    return () => {
      gone = true
      resized.disconnect()
      window.removeEventListener('resize', place)
      settling.forEach(clearTimeout)
      useBrowser.setState({ hole: null })
      // Gone (it's placed again when the app shows a page).
      command({ action: 'hide' })
    }
  }, [])
  // Nothing in it: the page is under the CarPlay area, cut out here.
  return <div ref={frame} className="browser-page" aria-hidden />
}
