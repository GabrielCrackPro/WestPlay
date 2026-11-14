import { motion } from 'motion/react'
import { useEffect, useRef, useState } from 'react'
import { motionEase, seconds } from '../motion'
import { useText } from '../state/text'
import { CheckIcon } from './ClusterIcons'

/**
 * The pre-trip inspection checklist: a mode of the cluster dial that runs after every ignition.
 * The dial ring remains visible but dimmed, and its accent arc fills progressively as items check
 * — the arc itself is the progress indicator. Checklist items sit inside the ring where the speed
 * figure normally goes, and the header label takes the place of the brand mark above the ring.
 *
 * This makes the pre-trip feel like a self-test mode of the instrument cluster, not a card placed
 * on top of it. Real Scania Smart Displays show system checks as part of the dial's own display
 * at power-up, with the arc sweeping to show progress.
 */

/** How long each item takes to check. */
const ITEM_MS = 400
/** How long the "complete" state holds before clearing. */
const COMPLETE_HOLD_MS = 800

const ITEMS = ['doors', 'seatbelt', 'mirrors', 'lights', 'brakes'] as const
type ItemKey = (typeof ITEMS)[number]

interface ChecklistItem {
  key: ItemKey
  checked: boolean
}

/**
 * Returns the progress share (0-1) for the dial arc fill.
 * The arc sweeps smoothly as items check, giving a visual progress ring.
 */
export function PreTripChecklist({ onComplete, reduceMotion }: { onComplete: () => void; reduceMotion: boolean }) {
  const text = useText()
  const words = text.diagnostics
  const [items, setItems] = useState<ChecklistItem[]>(
    ITEMS.map((key) => ({ key, checked: false })),
  )
  const timer = useRef(0)
  const index = useRef(0)
  const onCompleteRef = useRef(onComplete)
  onCompleteRef.current = onComplete

  useEffect(() => {
    const total = ITEMS.length
    const checkNext = () => {
      const i = index.current
      if (i >= total) {
        timer.current = window.setTimeout(() => onCompleteRef.current(), COMPLETE_HOLD_MS)
        return
      }
      setItems((prev) =>
        prev.map((item, idx) => (idx === i ? { ...item, checked: true } : item)),
      )
      index.current = i + 1
      timer.current = window.setTimeout(checkNext, ITEM_MS)
    }
    timer.current = window.setTimeout(checkNext, 300)
    return () => clearTimeout(timer.current)
  }, [])

  const checkedCount = items.filter((item) => item.checked).length
  const allChecked = checkedCount === ITEMS.length

  const labelFor = (key: ItemKey) => {
    switch (key) {
      case 'doors':
        return words.preTripDoors
      case 'seatbelt':
        return words.preTripSeatbelt
      case 'mirrors':
        return words.preTripMirrors
      case 'lights':
        return words.preTripLights
      case 'brakes':
        return words.preTripBrakes
    }
  }

  return (
    <motion.div
      className="cluster-pretrip"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={reduceMotion ? { duration: 0 } : { duration: seconds(400), ease: motionEase }}
      exit={{ opacity: 0, transition: { duration: seconds(300), ease: motionEase } }}
      aria-live="polite"
      role="status"
    >
      {/* The accent arc that sweeps as items check — drawn as an SVG overlay on the dial */}
      <svg className="cluster-pretrip-arc" viewBox="0 0 300 300" aria-hidden>
        <motion.circle
          className="cluster-pretrip-arc-fill"
          cx="150"
          cy="150"
          r="127"
          strokeDasharray={`${2 * Math.PI * 127 * 0.75 * (checkedCount / ITEMS.length)} ${2 * Math.PI * 127}`}
          transform="rotate(135 150 150)"
          style={{ strokeLinecap: checkedCount > 0 ? 'round' : 'butt' }}
          transition={reduceMotion ? { duration: 0 } : { duration: 0.4, ease: motionEase }}
        />
      </svg>

      {/* Header: label and count, positioned above the ring (where brand normally sits) */}
      <motion.div
        className="cluster-pretrip-header"
        initial={{ opacity: 0, y: -4 }}
        animate={{ opacity: 1, y: 0 }}
        transition={reduceMotion ? { duration: 0 } : { duration: seconds(250), ease: motionEase }}
      >
        <span className="cluster-pretrip-label">
          {allChecked ? words.preTripComplete : words.preTripCheck}
        </span>
      </motion.div>

      {/* Items: centered inside the ring, where the speed figure normally goes */}
      <div className="cluster-pretrip-list">
        {items.map((item, idx) => (
          <motion.div
            key={item.key}
            className="cluster-pretrip-item"
            data-checked={item.checked ? '' : undefined}
            initial={{ opacity: 0, x: -8 }}
            animate={{ opacity: 1, x: 0 }}
            transition={reduceMotion ? { duration: 0 } : { duration: seconds(200), delay: idx * 0.06, ease: motionEase }}
          >
            {item.checked && (
              <motion.span
                className="cluster-pretrip-check"
                initial={{ scale: 0, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ duration: seconds(200), ease: [0.34, 1.56, 0.64, 1] }}
              >
                <CheckIcon />
              </motion.span>
            )}
            <span className="cluster-pretrip-item-label">{labelFor(item.key)}</span>
          </motion.div>
        ))}
      </div>
    </motion.div>
  )
}
