import { motion } from 'motion/react'
import { NoteCard } from '../../shared/phoneNoteCard'
import { motionEase, seconds } from '../motion'
import type { ClusterNotice } from './notice'
import { WarningIcon } from './ClusterIcons'

/**
 * A notice as the cab draws one: the phone's message, or one of the truck's own warnings and rest clocks, in a card
 * over the dial's centre. The shape is the cabin's stack (shell/notifications.css): a mark, what it is and what it
 * says — the phone's card is the phone's own (`shared/phoneNoteCard`), so a message reads here as it does in the Phone
 * app, and a warning is the dash's own reading put in the same card. Nothing here is dismissed from the dash: the
 * cabin's stack and the Phone app are where that is done, and the dash's notice goes when its moment passes. A
 * warning stands while its reading is wrong (useClusterAlert). More than one waiting is counted at the card's end.
 *
 * It comes and goes on Motion rather than on the stylesheet's keyframes, so a notice that is replaced hands over to
 * the next one instead of blinking between frames: the dash only ever holds one, and the arrivals and departures are
 * the only movement it makes (owner 2026-11-12). An alarm carries a little more of a push than a message — it is the
 * one thing on the glass a driver looks up from the road for — and Reduce Motion arrives at rest.
 */
export function ClusterNoticeBar({
  notice,
  textScale,
  reduceMotion,
}: {
  notice: ClusterNotice
  textScale: number
  reduceMotion: boolean
}) {
  const alarm = notice.tone === 'alarm'
  return (
    <motion.div
      className="cluster-notice"
      data-kind={notice.kind}
      data-tone={notice.tone}
      aria-hidden
      initial={reduceMotion ? false : { opacity: 0, y: -10, scale: 0.94 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{
        opacity: 0,
        y: -6,
        scale: 0.97,
        transition: reduceMotion ? { duration: 0 } : { duration: seconds(180), ease: motionEase },
      }}
      transition={reduceMotion ? { duration: 0 } : { duration: seconds(alarm ? 380 : 280), ease: motionEase }}
    >
      {/* The mark: the app's own tile for a message — its icon where the phone sends one, else its first letter on
          the tone's ground — and the dash's warning ring for a warning, the same mark the wear row draws. An alarm's
          mark lands with a step of its own, as the keyframed one used to. */}
      <motion.span
        className="cluster-notice-mark"
        aria-hidden
        initial={alarm && !reduceMotion ? { scale: 0.6 } : false}
        animate={{ scale: 1 }}
        transition={{ duration: seconds(300), ease: motionEase, delay: seconds(alarm ? 100 : 0) }}
      >
        {notice.notification ? (
          notice.icon ? (
            <img src={notice.icon} alt="" />
          ) : (
            notice.label.trim().charAt(0).toUpperCase()
          )
        ) : (
          <WarningIcon />
        )}
      </motion.span>
      {notice.notification ? (
        <NoteCard
          notification={notice.notification}
          app={notice.label}
          icon={notice.icon}
          dismissLabel="Dismiss"
          textScale={textScale}
        />
      ) : (
        <span className="cluster-notice-copy">
          <span className="cluster-notice-level">{notice.label}</span>
          <b className="cluster-notice-title">{notice.title}</b>
          {notice.detail && <span className="cluster-notice-detail">{notice.detail}</span>}
        </span>
      )}
      {notice.count > 1 && (
        <span className="cluster-notice-count" aria-hidden>
          +{notice.count - 1}
        </span>
      )}
    </motion.div>
  )
}
