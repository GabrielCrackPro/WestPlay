import { type CSSProperties, useState } from 'react'
import { motion } from 'motion/react'
import { motionEase, seconds, useMotionReduced } from '../motion'
import { CONNECTING_MS, HANDOVER_MS, SPLASH_MS, bootLength, type PowerPhase } from '../state/power'
import { routeAccent } from '../maps/routeLook'
import { postToHost } from '../../shared/host'
import { useCabin, useLive } from '../state/store'
import { logoSources } from './brand'

/** The mark's light as it settles: the panel's own, thrown once and then held. */
const BRAND_FILTER = 'brightness(0) invert(1) drop-shadow(0 10px 40px rgb(255 255 255 / 0.14))'

import './boot.css'

/****
 * The boot, as one screen (boot.css): the panel's light comes up, the truck's brand is lit on it, Cabin Play's mark
 * and name arrive under it, and the light goes down as CarPlay fades up. The brand also gets an explicit contain box
 * so files that carry only a viewBox never collapse to nothing inside the sweep.
 *
 * The power phases (state/power.ts) are its clock, and they are the two acts of one formation: `splash` is the panel's
 * light coming up with the truck's own mark on it — whose screen this is — and `connecting` is Cabin Play's mark
 * landing under it as the app connects, which is what the screen is booting into. A boot that starts mid-drive (or on
 * a tablet, which boots no truck) is the second act alone: the app's mark on a panel that is already lit.
 *
 * It is the same screen on both of the truck's displays (the cabin's page and the cluster's), so the two are one boot.
 * `elapsed` is how far into it this page came in: the page that loads while the other is already booting picks the
 * formation up where the other screen is, not from the first frame.
 *
 * Motion drives the formation from here; the stylesheet keeps the layout and the light. The screen's last 500 ms are
 * the hand-over (state/power.ts: HANDOVER_MS): the parent unmounts the boot as it begins, and Motion's exit fades it
 * out over the screen that is already coming up behind it — one motion, not a fade to black and a screen after it.
 */
export function BootScreen({ phase, elapsed = 0 }: { phase: Exclude<PowerPhase, 'on'>; elapsed?: number }) {
  // Whether the truck's brand belongs on it: a boot that began with the electrics has a truck to name; one
  // that started mid-drive (or on a tablet screen, which boots no truck) doesn't.
  const [withBrand, setWithBrand] = useState(false)
  if (phase === 'splash' && !withBrand) {
    setWithBrand(true)
    // For the host's startup log: as soon as the first formation frame is up, the truck's maker is on it.
    postToHost({ type: 'startup', stage: 'truck logo shown' })
  }
  // Up for as long as the phases it goes through, from the first of them.
  const ms = bootLength(withBrand ? 'splash' : 'connecting')
  const reduced = useMotionReduced()
  // The cab's accent, the route's own colour in its dark form (this panel is always black, whatever the cabin's
  // appearance): the cabin and the dash power on wearing the same light, so the two screens read as one cab's.
  const routeColour = useCabin((state) => state.mapRoute)

  const boot = seconds(ms)
  const age = seconds(elapsed)
  // A part already in when this page joined starts at rest rather than playing its entrance again.
  const at = (moment: number) => Math.max(0, moment - age)
  const arrived = (moment: number) => moment <= age
  // The light going down: the hand-over's own window. A page that came up during it picks the fade up where it is.
  const handover = seconds(HANDOVER_MS)
  const fadeLeft = Math.min(handover, Math.max(0, boot - age))
  const joinedFade = age > boot - handover
  const startOpacity = fadeLeft / handover

  // When each part of the composition arrives: the light first, the truck's mark as it comes up, and Cabin Play's
  // mark at the moment the boot changes phase — the `connecting` phase, which is the app connecting. Both of the
  // screen's shapes are shares of the boot, so the cabin's boot and the cluster's shorter one keep one formation.
  // Held in the phases' own terms: the mark lands exactly where `splash` ends, so the composition has a reason to
  // change when it does rather than a beat picked to fill time.
  const splashShare = SPLASH_MS / (SPLASH_MS + CONNECTING_MS)
  const brandAt = boot * 0.1
  const markAt = withBrand ? boot * splashShare : boot * 0.08
  const wordAt = markAt + boot * 0.045

  return (
    <motion.div
      className="boot"
      data-phase={phase}
      style={{ '--boot-accent': routeAccent('dark', routeColour) } as CSSProperties}
      initial={joinedFade && !reduced ? { opacity: startOpacity } : false}
      animate={joinedFade && !reduced ? { opacity: startOpacity } : { opacity: 1 }}
      // The marks leave first, under a light that is still up, and then the light goes down over the screen that is
      // already coming up behind it. Not a cross-fade: two screens dissolving into each other show one's marks over the
      // other's. Not a cut to black either: the screen is already there when the light starts to fall. Even, not on the
      // cabin's spring, which would spend most of the window in its first third and tear the screen in under a flash.
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
      {/* Nothing while the electrics are off: the game hides the screen itself, and a dark panel has nothing to
          show. Everything is mounted here, so its animation starts the moment the panel lights. */}
      {phase !== 'off' && (
        <>
          {/* The panel's light coming up: the backlight rises over the first twentieth of the boot — the glass
                  lighting, not a glow arriving — holds, and goes down on the hand-over with the rest of the boot (the
                  fade at the boot's last HANDOVER_MS). A little of the route's accent sits in it, so the cab's two
                  screens power on wearing the same colour. */}
          <motion.span
            className="boot-glow"
            initial={reduced ? { opacity: 1, scale: 1 } : { opacity: 0, scale: 1.09 }}
            animate={
              reduced
                ? { opacity: 1, scale: 1 }
                : {
                    opacity: [0, 1, 0.965, 1, 1, 1],
                    scale: [1.06, 1, 1.004, 1, 1, 0],
                  }
            }
            transition={
              reduced
                ? { duration: 0 }
                : {
                    duration: boot,
                    times: [0, 0.05, 0.24, 0.42, 0.93, 1],
                    ease: motionEase,
                  }
            }
            aria-hidden
          />
          {/* The backlight sweep as the panel comes up: a broad, soft band of the cab's light travels the full
                  height of the screen, so the glass reads as lighting rather than a highlight passing over a static
                  field. Above the glow, below the mark; gone by the time the mark has formed. */}
          {!reduced && !arrived(boot * 0.12) && (
            <motion.span
              className="boot-scan"
              initial={false}
              animate={{ opacity: [0, 0.8, 0], y: ['-50%', '-12%', '50%'] }}
              transition={{ duration: boot * 0.16, times: [0, 0.08, 1], ease: motionEase }}
              aria-hidden
            />
          )}
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

/** What each part of the composition knows of the boot's clock: its length, how far in this page joined, and the
 * two clocks the parts share. */
interface Beat {
  /** The boot's length, seconds. */
  boot: number
  /** How far into it this page came in, seconds. */
  age: number
  reduced: boolean
  /** A part's delay from now: where it sits in the boot, less the age already played. */
  at: (moment: number) => number
  /** Whether a part's moment has already passed. */
  arrived: (moment: number) => boolean
  /** The shared brand line's arrival moment, so the truck's name reads with the mark's light. */
  brandAt: number
}

/**
 * The screen's one formation: the truck's brand first — it's whose screen this is — and Cabin Play under it, as the
 * app it's booting into. On a boot with no truck to name, Cabin Play alone takes the panel at its size.
 */
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
  const haloAt = markAt + boot * 0.02
  const sheenAt = markAt + boot * 0.06
  return (
    <motion.div
      className="boot-intro"
      data-brand={withBrand || undefined}
      initial={reduced ? { opacity: 1, scale: 1 } : { opacity: 0, scale: 0.985 }}
      animate={reduced ? { opacity: 1, scale: 1 } : { opacity: 1, scale: 1 }}
      // The composition leaves on its own and before the light does: it is off the glass while the panel is still
      // black, so the screen comes up on an empty panel rather than through the boot's marks (BootScreen's exit).
      exit={
        reduced
          ? { opacity: 0, transition: { duration: 0 } }
          : {
              opacity: 0,
              y: -10,
              scale: 1.01,
              transition: { duration: (HANDOVER_MS / 1000) * 0.3, ease: motionEase },
            }
      }
      transition={reduced ? { duration: 0 } : { duration: boot * 0.12, ease: motionEase }}
    >
      {withBrand && <BrandLine beat={beat} />}
      <span className="boot-pair">
        <span className="boot-intro-mark">
          {/* Its own light, thrown once as the mark lands: the mark is the screen waking up, not a picture on it.
              The halo's life is tied to the boot's clock, not a flat 1.2s, so the cabin's and the cluster's shorter
              boot keep the same read. */}
          {!reduced && !arrived(haloAt) && (
            <motion.span
              className="boot-intro-halo"
              initial={{ opacity: 0, scale: 0.72 }}
              animate={{ opacity: [0, 0.62, 0.22, 0], scale: [0.72, 0.88, 1.2, 1.46] }}
              transition={{ duration: boot * 0.18, delay: at(haloAt), times: [0, 0.22, 0.62, 1], ease: motionEase }}
              aria-hidden
            />
          )}
          <motion.img
            src="/cabinplay-amoled.svg"
            alt=""
            initial={markDone ? false : { opacity: 0, scale: 0.8, filter: 'blur(12px)' }}
            animate={
              markDone
                ? { opacity: 1, scale: 1, filter: 'blur(0px)' }
                : {
                    opacity: [0, 1, 1],
                    scale: [0.8, 1.035, 1],
                    filter: ['blur(12px)', 'blur(0px)', 'blur(0px)'],
                  }
            }
            transition={
              markDone
                ? { duration: 0 }
                : { duration: boot * 0.16, delay: at(markAt), times: [0, 0.6, 1], ease: motionEase }
            }
          />
          {/* The glass over the tile catching the light once, as the screen settles into the new look. */}
          {!reduced && !arrived(sheenAt) && (
            <motion.span
              className="boot-intro-sheen"
              initial={{ opacity: 0, backgroundPosition: '160% 0' }}
              animate={{ opacity: [0, 1, 0], backgroundPosition: ['160% 0', '120.4% 0', '-60% 0'] }}
              transition={{ duration: boot * 0.16, delay: at(sheenAt), times: [0, 0.18, 1], ease: motionEase }}
              aria-hidden
            />
          )}
        </span>
        <motion.span
          className="boot-intro-wordmark"
          initial={
            wordDone
              ? false
              : {
                  opacity: 0,
                  y: 18,
                  letterSpacing: '0.015em',
                  filter: 'blur(10px)',
                  textShadow: '0 0 30px rgb(255 255 255 / 0.35)',
                }
          }
          animate={{
            opacity: 1,
            y: 0,
            letterSpacing: '-0.01em',
            filter: 'blur(0px)',
            textShadow: '0 0 18px rgb(255 255 255 / 0.12)',
          }}
          transition={wordDone ? { duration: 0 } : { duration: boot * 0.2, delay: at(wordAt), ease: motionEase }}
        >
          Cabin Play
        </motion.span>
      </span>
    </motion.div>
  )
}

/**
 * The truck brand, a line under Cabin Play's name rather than a screen of its own. Logos are their makers'
 * trademarks, so they live outside the repository (`public/brand-logos`, git-ignored); when a brand has none,
 * its name is shown as a small wordmark instead.
 */
function BrandLine({ beat }: { beat: Beat }) {
  const truck = useLive((state) => state.truck)
  const [attempt, setAttempt] = useState(0)
  const { boot, reduced, at, arrived, brandAt } = beat
  // For the host's startup log: the moment the brand is on the page.
  if (!truck) return null
  const sources = logoSources(truck.brandId, truck.brand, { mono: true })
  // The brand line enters with the mark's own light (the shared brandAt out of BootScreen), so the truck's name reads
  // as part of the same waking rather than a separate arrival a beat earlier.
  const done = reduced || arrived(brandAt)
  const sheenAt = brandAt + boot * 0.13
  return (
    <motion.span
      className="boot-brand"
      initial={done ? false : { opacity: 0, y: 14, scale: 0.985 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={done ? { duration: 0 } : { duration: boot * 0.16, delay: at(brandAt), ease: motionEase }}
    >
      {attempt < sources.length ? (
        // The brand and its own sheen: the same file twice, the second a narrow band of light crossing it (boot.css),
        // so the brand reads as lit by the panel rather than pasted onto it.
        <span className="boot-brand-art">
          <motion.img
            key={sources[attempt].src}
            className="boot-brand-logo"
            src={sources[attempt].src}
            alt=""
            initial={
              done
                ? false
                : {
                    scale: 0.985,
                    filter: 'brightness(0) invert(1) blur(12px) drop-shadow(0 0 0 transparent)',
                  }
            }
            animate={
              done
                ? { scale: 1, filter: BRAND_FILTER }
                : {
                    scale: [0.985, 1.01, 1, 1],
                    filter: [
                      'brightness(0) invert(1) blur(12px) drop-shadow(0 0 0 transparent)',
                      'brightness(0) invert(1) blur(0px) drop-shadow(0 0 30px rgb(255 255 255 / 0.6))',
                      'brightness(0) invert(1) blur(0px) drop-shadow(0 0 14px rgb(255 255 255 / 0.28))',
                      BRAND_FILTER,
                    ],
                  }
            }
            transition={
              done
                ? { duration: 0 }
                : { duration: boot * 0.14, delay: at(brandAt), times: [0, 0.24, 0.44, 1], ease: motionEase }
            }
            onError={() => setAttempt((current) => current + 1)}
          />
          {!reduced && !arrived(sheenAt) && (
            <motion.img
              className="boot-brand-sheen"
              src={sources[attempt].src}
              alt=""
              aria-hidden
              initial={{ opacity: 0, maskPosition: '145% 0' }}
              animate={{
                opacity: [0, 1, 1, 0],
                maskPosition: ['145% 0', '122.2% 0', '8.2% 0', '-45% 0'],
              }}
              transition={{ duration: boot * 0.17, delay: at(sheenAt), times: [0, 0.12, 0.72, 1], ease: motionEase }}
            />
          )}
        </span>
      ) : (
        <motion.span
          className="boot-brand-wordmark"
          initial={
            done
              ? false
              : {
                  letterSpacing: '0.34em',
                  filter: 'blur(9px)',
                  textShadow: '0 0 30px rgb(255 255 255 / 0.55)',
                }
          }
          animate={{
            letterSpacing: ['0.34em', '0.2em', '0.18em'],
            filter: ['blur(9px)', 'blur(0px)', 'blur(0px)'],
            textShadow: [
              '0 0 30px rgb(255 255 255 / 0.55)',
              '0 0 20px rgb(255 255 255 / 0.3)',
              '0 0 14px rgb(255 255 255 / 0.12)',
            ],
          }}
          transition={
            done
              ? { duration: 0 }
              : { duration: boot * 0.16, delay: at(brandAt), times: [0, 0.45, 1], ease: motionEase }
          }
        >
          {truck.brand}
        </motion.span>
      )}
    </motion.span>
  )
}
