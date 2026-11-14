import { useState } from 'react'
import { motion } from 'motion/react'
import { motionEase, seconds, useMotionReduced } from '../motion'
import { CONNECTING_MS, HANDOVER_MS, SPLASH_MS, bootLength, type PowerPhase } from '../state/power'
import { postToHost } from '../../shared/host'
import { useLive } from '../state/store'
import { logoSources } from './brand'

import './boot.css'

/****
 * Minimal AMOLED boot screen: pure black background, brand logo and Cabin Play mark fade in cleanly.
 * No glow, no sheen, no bloom — just white-on-black with simple opacity transitions.
 *
 * Synchronized with the cluster boot: both screens start from pure black, then the content fades in
 * together. The veil holds for a moment (matching the cluster's veil hold), then fades to reveal
 * the brand and mark — so both screens feel like one cohesive power-on moment.
 */

/** How long the black veil holds before content fades in — synced with the cluster boot. */
const VEIL_HOLD_MS = 300
/** How long the content fade-in takes — synced with the cluster boot's veil fade. */
const VEIL_FADE_MS = 600

export function BootScreen({ phase, elapsed = 0 }: { phase: Exclude<PowerPhase, 'on'>; elapsed?: number }) {
  const [withBrand, setWithBrand] = useState(false)
  if (phase === 'splash' && !withBrand) {
    setWithBrand(true)
    postToHost({ type: 'startup', stage: 'truck logo shown' })
  }

  const ms = bootLength(withBrand ? 'splash' : 'connecting')
  const reduced = useMotionReduced()

  const boot = seconds(ms)
  const age = seconds(elapsed)
  const at = (moment: number) => Math.max(0, moment - age)
  const arrived = (moment: number) => moment <= age

  // Hand-over fade at the end of boot
  const handover = seconds(HANDOVER_MS)
  const fadeLeft = Math.min(handover, Math.max(0, boot - age))
  const joinedFade = age > boot - handover
  const startOpacity = fadeLeft / handover

  // Veil fade: synced with cluster boot so both screens transition from black together
  const veilFade = reduced ? 0 : seconds(VEIL_FADE_MS)
  const veilDelay = reduced ? 0 : Math.max(0, seconds(VEIL_HOLD_MS) - seconds(elapsed))

  const splashShare = SPLASH_MS / (SPLASH_MS + CONNECTING_MS)
  const brandAt = boot * 0.075
  const markAt = withBrand ? boot * splashShare : boot * 0.08
  const wordAt = markAt + boot * 0.05

  return (
    <motion.div
      className="boot"
      data-phase={phase}
      initial={joinedFade && !reduced ? { opacity: startOpacity } : false}
      animate={joinedFade && !reduced ? { opacity: startOpacity } : { opacity: 1 }}
      exit={
        reduced
          ? { opacity: 0, transition: { duration: 0 } }
          : {
              opacity: [startOpacity, startOpacity, 0],
              transition: { duration: fadeLeft, times: [0, 0.3, 1], ease: 'linear' },
            }
      }
      aria-hidden
    >
      {phase !== 'off' && (
        <>
          {/* Black veil: starts pure black, fades to reveal content — synced with cluster boot */}
          <motion.div
            className="boot-veil"
            initial={{ opacity: 1 }}
            animate={{ opacity: 0 }}
            transition={
              reduced
                ? { duration: 0 }
                : { duration: veilFade, delay: Math.min(veilDelay, seconds(VEIL_HOLD_MS)), ease: motionEase }
            }
            aria-hidden
          />
          <div className="boot-panel">
            <BootMark
              withBrand={withBrand}
              markAt={markAt}
              wordAt={wordAt}
              beat={{ boot, age, reduced, at, arrived, brandAt }}
            />
          </div>
        </>
      )}
    </motion.div>
  )
}

interface Beat {
  boot: number
  age: number
  reduced: boolean
  at: (moment: number) => number
  arrived: (moment: number) => boolean
  brandAt: number
}

function BootMark({
  withBrand,
  markAt,
  wordAt,
  beat,
}: {
  withBrand: boolean
  markAt: number
  wordAt: number
  beat: Beat
}) {
  const { boot, reduced, at, arrived } = beat
  const markDone = reduced || arrived(markAt)
  const wordDone = reduced || arrived(wordAt)

  return (
    <motion.div
      className="boot-intro"
      data-brand={withBrand || undefined}
      initial={reduced ? { opacity: 1 } : { opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={
        reduced
          ? { opacity: 0, transition: { duration: 0 } }
          : {
              opacity: 0,
              transition: { duration: (HANDOVER_MS / 1000) * 0.3, ease: motionEase },
            }
      }
      transition={reduced ? { duration: 0 } : { duration: boot * 0.08, ease: motionEase }}
    >
      {withBrand && <BrandLine beat={beat} />}
      <span className="boot-pair">
        <span className="boot-intro-mark">
          <motion.img
            src="/cabinplay-amoled.svg"
            alt=""
            initial={markDone ? false : { opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={
              markDone
                ? { duration: 0 }
                : { duration: boot * (withBrand ? 0.12 : 0.17), delay: at(markAt), ease: motionEase }
            }
          />
        </span>
        <motion.span
          className="boot-intro-wordmark"
          initial={wordDone ? false : { opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={wordDone ? { duration: 0 } : { duration: boot * 0.15, delay: at(wordAt), ease: motionEase }}
        >
          Cabin Play
        </motion.span>
      </span>
    </motion.div>
  )
}

function BrandLine({ beat }: { beat: Beat }) {
  const truck = useLive((state) => state.truck)
  const [attempt, setAttempt] = useState(0)
  const { boot, reduced, at, arrived, brandAt } = beat

  if (!truck) return null
  const sources = logoSources(truck.brandId, truck.brand, { mono: true })
  const done = reduced || arrived(brandAt)

  return (
    <span className="boot-brand">
      {attempt < sources.length ? (
        <motion.img
          key={sources[attempt].src}
          className="boot-brand-logo"
          src={sources[attempt].src}
          alt=""
          initial={done ? false : { opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={
            done
              ? { duration: 0 }
              : { duration: boot * 0.15, delay: at(brandAt), ease: motionEase }
          }
          onError={() => setAttempt((current) => current + 1)}
        />
      ) : (
        <motion.span
          className="boot-brand-wordmark"
          initial={done ? false : { opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={
            done
              ? { duration: 0 }
              : { duration: boot * 0.15, delay: at(brandAt), ease: motionEase }
          }
        >
          {truck.brand}
        </motion.span>
      )}
    </span>
  )
}
