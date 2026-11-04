import { useEffect, useRef } from 'react'
import { command, configure, pointer, useBrowser } from './browser'

/**
 * Where the page shows: its picture is the host's own WebView, placed under the page, and the CarPlay area is
 * cut open over this element (Shell.tsx), its rounding included. Placed again whenever it may have moved (the
 * window resizing, the keyboard coming up, the CarPlay area growing back from the truck's screen).
 *
 * The player's pointer over it is the page's: clicks, drags and the wheel go to the WebView where they happen
 * (`webview.rs`'s `send_mouse`), so a page's own links and fields answer them.
 */
export function PageHole() {
  const frame = useRef<HTMLDivElement>(null)
  // The left button is down here (and the page was told): moves are drags until it's let go.
  const pressed = useRef(false)
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
    // The page as the app's settings have it (a WebView started for the page starts with them).
    configure()
    place()
    const resized = new ResizeObserver(place)
    resized.observe(element)
    const area = document.querySelector('.carplay')
    if (area) resized.observe(area)
    window.addEventListener('resize', place)
    // The wheel scrolls the page, not the cabin (a passive listener couldn't say no to the page's own scroll).
    const wheel = (event: WheelEvent) => {
      event.preventDefault()
      const box = element.getBoundingClientRect()
      if (!box.width) return
      const notches = Math.max(1, Math.round(Math.abs(event.deltaY) / 100)) * (event.deltaY > 0 ? -120 : 120)
      pointer({
        kind: 'wheel',
        x: (event.clientX - box.left) / box.width,
        y: (event.clientY - box.top) / box.height,
        pressed: false,
        data: notches,
      })
    }
    element.addEventListener('wheel', wheel, { passive: false })
    // The app's window grows in from its icon (a transform, which no size change tells of).
    const settling = [120, 350, 700].map((ms) => setTimeout(place, ms))
    return () => {
      gone = true
      resized.disconnect()
      window.removeEventListener('resize', place)
      element.removeEventListener('wheel', wheel)
      settling.forEach(clearTimeout)
      useBrowser.setState({ hole: null })
      // Gone (it's placed again when the app shows a page).
      command({ action: 'hide' })
    }
  }, [])

  // Where the pointer is on the page, as shares of this element that the host turns back into page pixels.
  const share = (event: { clientX: number; clientY: number }) => {
    const box = frame.current?.getBoundingClientRect()
    if (!box?.width) return null
    return { x: (event.clientX - box.left) / box.width, y: (event.clientY - box.top) / box.height }
  }

  return (
    <div
      ref={frame}
      className="browser-page"
      aria-hidden
      onPointerDown={(event) => {
        if (event.button !== 0) return
        event.currentTarget.setPointerCapture(event.pointerId)
        pressed.current = true
        const at = share(event)
        if (at) pointer({ kind: 'down', ...at, pressed: true })
      }}
      onPointerMove={(event) => {
        const at = share(event)
        if (at) pointer({ kind: 'move', ...at, pressed: pressed.current })
      }}
      onPointerUp={(event) => {
        if (!pressed.current) return
        pressed.current = false
        if (event.currentTarget.hasPointerCapture(event.pointerId)) {
          event.currentTarget.releasePointerCapture(event.pointerId)
        }
        const at = share(event)
        if (at) pointer({ kind: 'up', ...at, pressed: false })
      }}
      onPointerCancel={() => {
        pressed.current = false
      }}
      onPointerLeave={() => {
        if (!pressed.current) pointer({ kind: 'leave', x: 0, y: 0, pressed: false })
      }}
    />
  )
}
