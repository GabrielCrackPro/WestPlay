import { motion } from 'motion/react'
import { useEffect, useState } from 'react'
import { motionEase, seconds } from '../motion'
import { CONNECTING_MS, HANDOVER_MS, SPLASH_MS, type PowerPhase } from '../state/power'
import { logoSources } from '../boot/brand'
import { useLive } from '../state/store'

/**
 * The cluster's boot: synchronized with the cabin boot for a cohesive power-on experience.
 * Both screens start from pure black, then the veil fades to reveal the boot animation.
 * The dial shows the truck's brand and Cabin Play's mark inside the ring while the dial arc
 * sweeps as progress. The side columns and status bar are hidden until the veil clears.
 *
 * The veil fade is timed to match the cabin boot's content fade-in, so both screens feel
 * like they power on together — one cohesive moment across the cab.
 */

interface ClusterBootScreenProps {
  /** The current boot phase from the cabin's power state. */
  phase: Exclude<PowerPhase, 'on'>
  /** How far into the boot this page joined, in ms. */
  elapsed: number
  /** Whether to skip animations for accessibility. */
  reduceMotion: boolean
}

/** How long the black veil stays before fading — matches the cabin boot's initial splash. */
const VEIL_HOLD_MS = 300
/** How long the veil fade takes — synced with the cabin boot's content fade-in. */
const VEIL_FADE_MS = 600

export function ClusterBootScreen({ phase, elapsed, reduceMotion }: ClusterBootScreenProps) {
  const truck = useLive((state) => state.truck)
  const [attempt, setAttempt] = useState(0)
  const [phaseReached, setPhaseReached] = useState(phase)

  // Track phase changes (splash -> connecting)
  useEffect(() => {
    setPhaseReached(phase)
  }, [phase])

  // Always use the full boot duration (splash + connecting) for progress calculation.
  // The phase may change from 'splash' to 'connecting' mid-boot, but progress should
  // be continuous — the arc sweeps from 0 to 1 over the entire boot, not reset at each phase.
  const bootMs = SPLASH_MS + CONNECTING_MS
  const progress = Math.min(1, elapsed / bootMs)

  // Brand logo source
  const sources = truck ? logoSources(truck.brandId, truck.brand, { mono: true }) : []
  const source = sources[attempt]

  // Determine which stage of the boot we're in for animation timing
  const isConnecting = phaseReached === 'connecting'
  const isNearEnd = progress > 0.85

  // Black veil: holds for a moment, then fades to reveal the boot animation
  // The veil timing is synced with the cabin boot so both screens transition together
  const veilFade = reduceMotion ? 0 : seconds(VEIL_FADE_MS)
  const veilDelay = reduceMotion ? 0 : Math.max(0, seconds(VEIL_HOLD_MS) - seconds(elapsed))

  return (
    <motion.div
      className="cluster-boot"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={reduceMotion ? { duration: 0 } : { duration: seconds(200), ease: motionEase }}
      exit={{
        opacity: 0,
        transition: { duration: seconds(HANDOVER_MS) * 0.3, ease: motionEase },
      }}
      aria-hidden
    >
      {/* Full-black veil: the cluster starts on pure black and fades to reveal the boot beneath.
          Timing is synced with the cabin boot so both screens feel like one power-on moment. */}
      <motion.div
        className="cluster-boot-veil"
        initial={{ opacity: 1 }}
        animate={{ opacity: 0 }}
        transition={
          reduceMotion
            ? { duration: 0 }
            : { duration: veilFade, delay: Math.min(veilDelay, seconds(VEIL_HOLD_MS)), ease: motionEase }
        }
        aria-hidden
      />

      {/* The accent arc that sweeps as the boot progresses — drawn as an SVG overlay on the dial */}
      <svg className="cluster-boot-arc" viewBox="0 0 300 300" aria-hidden>
        <motion.circle
          className="cluster-boot-arc-fill"
          cx="150"
          cy="150"
          r="127"
          strokeDasharray={`${2 * Math.PI * 127 * 0.75 * progress} ${2 * Math.PI * 127}`}
          transform="rotate(135 150 150)"
          style={{ strokeLinecap: 'round' }}
          transition={reduceMotion ? { duration: 0 } : { duration: 0.3, ease: motionEase }}
        />
      </svg>

      {/* Center content: brand logo and Cabin Play mark inside the ring */}
      <div className="cluster-boot-center">
        {/* Truck brand logo */}
        {truck && source && (
          <motion.img
            className="cluster-boot-brand"
            src={source.src}
            alt=""
            initial={reduceMotion ? { opacity: 1, scale: 1 } : { opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={
              reduceMotion
                ? { duration: 0 }
                : { duration: seconds(400), delay: seconds(200), ease: motionEase }
            }
            onError={() => setAttempt((current) => current + 1)}
          />
        )}
        {truck && !source && (
          <motion.span
            className="cluster-boot-brand-word"
            initial={reduceMotion ? { opacity: 1 } : { opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={
              reduceMotion
                ? { duration: 0 }
                : { duration: seconds(400), delay: seconds(200), ease: motionEase }
            }
          >
            {truck.brand}
          </motion.span>
        )}

        {/* Cabin Play mark: appears after the brand, when connecting phase starts */}
        <motion.div
          className="cluster-boot-app"
          initial={reduceMotion ? { opacity: 1, y: 0 } : { opacity: 0, y: 6 }}
          animate={
            isConnecting
              ? { opacity: 1, y: 0 }
              : reduceMotion
                ? { opacity: 0.5, y: 0 }
                : { opacity: 0, y: 6 }
          }
          transition={
            reduceMotion
              ? { duration: 0 }
              : { duration: seconds(350), ease: motionEase }
          }
        >
          <img src="/cabinplay-amoled.svg" alt="" className="cluster-boot-app-icon" />
          <span className="cluster-boot-app-name">Cabin Play</span>
        </motion.div>

        {/* Connecting indicator: subtle pulsing dots while in connecting phase */}
        {isConnecting && !isNearEnd && (
          <motion.div
            className="cluster-boot-dots"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={reduceMotion ? { duration: 0 } : { duration: seconds(200) }}
          >
            <span className="cluster-boot-dot" style={{ animationDelay: '0s' }} />
            <span className="cluster-boot-dot" style={{ animationDelay: '0.2s' }} />
            <span className="cluster-boot-dot" style={{ animationDelay: '0.4s' }} />
          </motion.div>
        )}
      </div>
    </motion.div>
  )
}
