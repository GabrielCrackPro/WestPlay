// The Browser app's page (westplay_host::browser_web): its address, its title and whether it's still loading,
// posted to the host as each page loads, and as a site changes them in place (a single-page app, a video
// starting). Its toolbar is the cabin page's: this only says what shows.
;(() => {
  if (window.__westplayBrowser) return
  window.__westplayBrowser = true

  const tell = () => {
    try {
      window.chrome.webview.postMessage(
        JSON.stringify({
          browser: {
            url: location.href,
            title: document.title || '',
            loading: document.readyState !== 'complete',
          },
        }),
      )
    } catch {
      // No host (a plain browser): nothing to say.
    }
  }

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
    // A page that renames itself (a video playing, a message arriving): said as it does.
    const title = document.querySelector('title')
    if (title) {
      new MutationObserver(told).observe(title, {
        childList: true,
        subtree: true,
        characterData: true,
      })
    }
  })
  told()
})()
