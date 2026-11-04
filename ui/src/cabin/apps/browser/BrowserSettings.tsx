import { useText } from '../../state/text'
import { clearData, forgetBookmarks, setMobile, setZoom, showSettings, useBrowser, ZOOMS } from './browser'

/**
 * The Browser app's settings, in the page's place (a head unit's browser keeps its own few as it shows a
 * page): how large the page shows, whether it says it's a phone, and forgetting what it kept — its cookies,
 * which signs it out of the sites opened here, and the bookmarks its start page shows.
 */
export function BrowserSettings() {
  const text = useText()
  const zoom = useBrowser((store) => store.zoom)
  const mobile = useBrowser((store) => store.mobile)
  const bookmarks = useBrowser((store) => store.bookmarks)

  return (
    <div className="browser-settings">
      <header className="browser-settings-head">
        <h2>{text.browser.settings}</h2>
        <button type="button" className="browser-done" onClick={() => showSettings(false)}>
          {text.browser.done}
        </button>
      </header>

      <section className="browser-setting">
        <h3>{text.browser.zoom}</h3>
        <div className="browser-choice" role="group" aria-label={text.browser.zoom}>
          {ZOOMS.map((value) => (
            <button
              key={value}
              type="button"
              className={value === zoom ? 'chosen' : undefined}
              aria-pressed={value === zoom}
              onClick={() => setZoom(value)}
            >
              {Math.round(value * 100)}%
            </button>
          ))}
        </div>
      </section>

      <section className="browser-setting">
        <h3>{text.browser.siteVersion}</h3>
        <div className="browser-choice" role="group" aria-label={text.browser.siteVersion}>
          <button
            type="button"
            className={!mobile ? 'chosen' : undefined}
            aria-pressed={!mobile}
            onClick={() => setMobile(false)}
          >
            {text.browser.desktop}
          </button>
          <button
            type="button"
            className={mobile ? 'chosen' : undefined}
            aria-pressed={mobile}
            onClick={() => setMobile(true)}
          >
            {text.browser.mobile}
          </button>
        </div>
        <p>{text.browser.siteVersionHint}</p>
      </section>

      <section className="browser-setting">
        <h3>{text.browser.clearData}</h3>
        <p>{text.browser.clearDataHint}</p>
        <button type="button" className="browser-action" onClick={clearData}>
          {text.browser.clearData}
        </button>
      </section>

      <section className="browser-setting">
        <h3>{text.browser.bookmarks}</h3>
        <p>{text.browser.clearBookmarksHint}</p>
        <button type="button" className="browser-action" disabled={bookmarks.length === 0} onClick={forgetBookmarks}>
          {text.browser.clearBookmarks}
        </button>
      </section>
    </div>
  )
}
