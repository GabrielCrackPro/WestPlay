// The instrument cluster's own page, in the host's second WebView (the cabin page is the first).
import './fonts.css'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { ClusterScreen } from './cabin/cluster/ClusterScreen'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ClusterScreen />
  </StrictMode>,
)
