// The cabin's type: Instrument Sans, Inter and Roboto (YouTube's own), subsets picked in fonts.css.
import '../fonts.css'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { CabinApp } from './CabinApp'
import { ClusterScreen } from './cluster/ClusterScreen'
import { installDemo } from './demo'
import { Recovery } from './shell/Recovery'
import { useCabin, useLive } from './state/store'
import './shell/shell.css'
import './shell/apple.css'

// Development builds expose the stores for console debugging and browser previews (`westplay.cabin`).
if (import.meta.env.DEV) {
  Object.assign(window, { westplay: { cabin: useCabin, live: useLive } })
}

installDemo()

// The cluster page in a plain browser preview (`?cluster=1`): the host's second WebView has its own page.
const clusterPreview = new URLSearchParams(location.search).get('cluster') === '1'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {clusterPreview ? (
      <ClusterScreen />
    ) : (
      <Recovery>
        <CabinApp />
      </Recovery>
    )}
  </StrictMode>,
)
