import { useState, useEffect, useRef } from 'react'
import { motion } from 'motion/react'
import { useCabin } from '../state/store'
import { useText } from '../state/text'
import { motionEase, useMotionReduced } from '../motion'
import { useLook } from '../state/hooks'
import './controlCenter.css'

/**
 * Quick Access Control Center: a slide-down panel with quick toggles for the most-used settings.
 * Activated by clicking the control center button in the top-right corner.
 * Toggles: DND (UI sounds), Voice Assistant, Volume slider, Map style, Appearance.
 */
export function ControlCenter() {
  const [open, setOpen] = useState(false)
  const [volume, setVolume] = useState(useCabin((state) => state.uiSoundVolume))
  const uiSounds = useCabin((state) => state.uiSounds)
  const setUiSounds = useCabin((state) => state.setUiSounds)
  const voiceEnabled = useCabin((state) => state.voiceEnabled)
  const setVoiceEnabled = useCabin((state) => state.setVoiceEnabled)
  const setUiSoundVolume = useCabin((state) => state.setUiSoundVolume)
  const appearanceMode = useCabin((state) => state.appearanceMode)
  const setAppearanceMode = useCabin((state) => state.setAppearanceMode)
  const mapStyle = useCabin((state) => state.mapStyle)
  const setMapStyle = useCabin((state) => state.setMapStyle)
  const text = useText()
  useLook()
  const reduced = useMotionReduced()
  const ref = useRef<HTMLDivElement>(null)

  // Sync volume slider with store
  useEffect(() => {
    setVolume(useCabin.getState().uiSoundVolume)
  }, [uiSounds])

  // Close on outside click
  useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  const cycleAppearance = () => {
    const next = appearanceMode === 'dark' ? 'light' : appearanceMode === 'light' ? 'auto' : 'dark'
    setAppearanceMode(next)
  }

  const cycleMapStyle = () => {
    const styles = ['standard', 'satellite', 'terrain'] as const
    const idx = styles.indexOf(mapStyle)
    const next = styles[(idx + 1) % styles.length]
    setMapStyle(next)
  }

  const appearanceLabel = appearanceMode === 'dark' ? 'Dark' : appearanceMode === 'light' ? 'Light' : 'Auto'
  const mapStyleLabel = mapStyle === 'standard' ? 'Standard' : mapStyle === 'satellite' ? 'Satellite' : 'Terrain'

  const init = reduced ? { opacity: 1, y: 0 } : { opacity: 0, y: -20 }
  const animate = open
    ? reduced ? { opacity: 1, y: 0 } : { opacity: 1, y: 0 }
    : reduced ? { opacity: 1, y: 0 } : { opacity: 0, y: -20 }
  const transition = reduced ? { duration: 0 } : { duration: 0.2, ease: motionEase }

  return (
    <>
      {/* Trigger button: top-right corner of the shell */}
      <button
        type="button"
        className={`control-center-btn${open ? ' active' : ''}`}
        aria-label={text.settings.controlCenter}
        aria-expanded={open}
        onClick={() => setOpen(!open)}
      >
        <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
          <circle cx="12" cy="12" r="2" />
          <circle cx="12" cy="5" r="2" />
          <circle cx="12" cy="19" r="2" />
        </svg>
      </button>

      {/* Panel */}
      <motion.div
        ref={ref}
        className="control-center-panel"
        initial={init}
        animate={animate}
        transition={transition}
        aria-hidden={!open}
      >
        <div className="control-center-inner">
          {/* Volume slider */}
          <div className="cc-row cc-volume">
            <span className="cc-label">{text.settings.volume}</span>
            <input
              type="range"
              min="0"
              max="1"
              step="0.05"
              value={volume}
              onChange={(e) => {
                const v = parseFloat(e.target.value)
                setVolume(v)
                setUiSoundVolume(v)
              }}
              aria-label={text.settings.volume}
            />
          </div>

          {/* Toggles */}
          <div className="cc-row cc-toggle">
            <span className="cc-label">{text.settings.uiSoundsToggle}</span>
            <button
              type="button"
              className={`cc-switch${uiSounds ? ' on' : ''}`}
              aria-pressed={uiSounds}
              onClick={() => setUiSounds(!uiSounds)}
            >
              <span className="cc-switch-knob" />
            </button>
          </div>

          <div className="cc-row cc-toggle">
            <span className="cc-label">{text.settings.voiceAssistantToggle}</span>
            <button
              type="button"
              className={`cc-switch${voiceEnabled ? ' on' : ''}`}
              aria-pressed={voiceEnabled}
              onClick={() => setVoiceEnabled(!voiceEnabled)}
            >
              <span className="cc-switch-knob" />
            </button>
          </div>

          {/* Appearance cycle */}
          <div className="cc-row cc-cycle">
            <span className="cc-label">{text.settings.appearance}</span>
            <button type="button" className="cc-cycle-btn" onClick={cycleAppearance}>
              {appearanceLabel}
            </button>
          </div>

          {/* Map style cycle */}
          <div className="cc-row cc-cycle">
            <span className="cc-label">{text.destinations.mapStyle}</span>
            <button type="button" className="cc-cycle-btn" onClick={cycleMapStyle}>
              {mapStyleLabel}
            </button>
          </div>
        </div>
      </motion.div>
    </>
  )
}
