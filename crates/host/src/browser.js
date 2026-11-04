// The Browser app's page (westplay_host::browser_web): what it shows — its address, its title, whether it's
// still loading, and whether a field of it has the focus — said to the host as each page loads and as a site
// changes in place. What the player types (the cabin's keyboard, through the host) goes into the field the
// page has focused, as a browser's typing does: its fields' own editing commands, so the events a site listens
// for fire. Its toolbar is the cabin page's: this only says and types.
;(() => {
  if (window.__westplayBrowser) return
  window.__westplayBrowser = true

  const say = (message) => {
    try {
      window.chrome.webview.postMessage(JSON.stringify(message))
    } catch {
      // No host (a plain browser): nothing to say.
    }
  }

  // What shows: said as each page loads, and as a page renames itself (a video playing, a message arriving).
  const tell = () =>
    say({
      browser: {
        url: location.href,
        title: document.title || '',
        loading: document.readyState !== 'complete',
      },
    })
  let seen = ''
  const told = () => {
    const now = JSON.stringify([location.href, document.title, document.readyState])
    if (now === seen) return
    seen = now
    tell()
  }

  window.addEventListener('load', told)
  window.addEventListener('popstate', told)
  window.addEventListener('hashchange', told)
  document.addEventListener('DOMContentLoaded', () => {
    told()
    const title = document.querySelector('title')
    if (title) {
      new MutationObserver(told).observe(title, { childList: true, subtree: true, characterData: true })
    }
  })
  told()

  // A field the player can type into: an input of the kinds that take text, a textarea, or anything editable.
  const NOT_TEXT = ['button', 'checkbox', 'color', 'file', 'hidden', 'image', 'radio', 'range', 'reset', 'submit']
  const editable = (element) => {
    if (!element) return false
    if (element.isContentEditable) return true
    if (element.tagName === 'TEXTAREA') return !element.disabled && !element.readOnly
    if (element.tagName !== 'INPUT') return false
    return !element.disabled && !element.readOnly && !NOT_TEXT.includes((element.type || 'text').toLowerCase())
  }

  // Text where the caret is.
  const insert = (text) => {
    const element = document.activeElement
    if (!editable(element) || !text) return
    if (element.isContentEditable) {
      document.execCommand('insertText', false, text)
      return
    }
    const start = element.selectionStart ?? element.value.length
    const end = element.selectionEnd ?? start
    element.setRangeText(text, start, end, 'end')
    // What a browser's typing says of itself (a site's own listeners read the field after this).
    element.dispatchEvent(new Event('input', { bubbles: true }))
  }

  const backspace = () => {
    const element = document.activeElement
    if (!editable(element)) return
    if (element.isContentEditable) {
      document.execCommand('delete')
      return
    }
    const start = element.selectionStart ?? element.value.length
    const end = element.selectionEnd ?? start
    element.setRangeText('', start === end ? Math.max(0, start - 1) : start, end, 'end')
    element.dispatchEvent(new Event('input', { bubbles: true }))
  }

  // Enter: the page's form goes, as its own button would send it; a page's editor keeps its paragraph.
  const enter = () => {
    const element = document.activeElement
    const form = element?.form
    if (form?.requestSubmit) {
      form.requestSubmit()
      return
    }
    if (element?.isContentEditable) {
      document.execCommand('insertParagraph')
      return
    }
    if (editable(element)) element.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }))
  }

  // Tab: the next thing the page can focus, from where it is now.
  const tab = () => {
    const focusable = [
      ...document.querySelectorAll(
        'a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])',
      ),
    ].filter((element) => element === document.activeElement || element.offsetParent !== null)
    const at = focusable.indexOf(document.activeElement)
    focusable[(at + 1) % Math.max(1, focusable.length)]?.focus()
  }

  window.chrome?.webview?.addEventListener('message', (event) => {
    const said = event.data
    if (!said || typeof said !== 'object' || !said.browserType) return
    const { text, key } = said.browserType
    if (typeof text === 'string') insert(text)
    else if (key === 'backspace') backspace()
    else if (key === 'enter') enter()
    else if (key === 'escape') document.activeElement?.blur()
    else if (key === 'tab') tab()
  })

  // Whether the cabin's keyboard has somewhere to type: said as the page's focus moves.
  const focus = () => say({ browserFocus: { editable: editable(document.activeElement) } })
  document.addEventListener('focusin', focus, true)
  document.addEventListener('focusout', () => setTimeout(focus, 0), true)

  // A link that would open a window of its own (a target, or a script's `window.open`) opens in this page:
  // there's one page at a time, as a head unit's browser has.
  document.addEventListener(
    'click',
    (event) => {
      const link = event.target?.closest?.('a[target], area[target]')
      if (!link) return
      event.preventDefault()
      if (link.href) location.href = link.href
    },
    true,
  )
  window.open = (url) => {
    if (url) location.href = url
    return window
  }
})()
