import { memo, useState } from 'react'
import type { PhoneNotification } from '../shared/host'
import { formatRealTime } from '../shared/format'

interface NoteCardProps {
  notification: PhoneNotification
  app: string
  icon?: string
  dismissLabel: string
  onDismiss(id: string): void
  textScale?: number
}

/** One notification, as the phone's own shade shows it: its app tile, its title and text, its time, and its dismissal
 * at the end. It is a card the phone app groups under an app header, and the cluster shows alone as the dash's notice. */
const NoteCard = memo(function NoteCard({
  notification,
  app,
  dismissLabel,
  onDismiss,
  textScale = 1,
}: NoteCardProps) {
  const time = notification.time !== undefined ? formatRealTime(notification.time * 1000) : null
  const [replying, setReplying] = useState(false)
  const [reply, setReply] = useState('')
  const actions = notification.actions ?? []

  return (
    <div className="phone-note" data-text-scale={textScale}>
      {(notification.title || time) && (
        <div className="phone-note-head">
          {notification.title && <p className="phone-note-title">{notification.title}</p>}
          {time && <span className="phone-note-time">{time}</span>}
        </div>
      )}
      {notification.text && <p className="phone-note-text">{notification.text}</p>}
      {actions.length > 0 && (
        <div className="phone-note-actions">
          {actions.map((action, index) => (
            <button
              key={`${action.label}-${index}`}
              type="button"
              className="phone-note-action"
              onClick={() => {
                if (action.reply) setReplying((open) => !open)
                else
                  // eslint-disable-next-line no-alert
                  alert(`Action: ${action.label}`)
              }}
            >
              {action.label}
            </button>
          ))}
        </div>
      )}
      {replying && (
        <div className="phone-note-reply">
          <span className="phone-note-reply-field">
            <input
              className="phone-note-reply-input"
              value={reply}
              onChange={(e) => setReply(e.target.value)}
              placeholder={dismissLabel}
            />
          </span>
          <div className="phone-note-reply-buttons">
            <button
              type="button"
              className="phone-note-send"
              disabled={!reply.trim()}
              onClick={() => {
                if (reply.trim()) {
                  // eslint-disable-next-line no-alert
                  alert(`Reply: ${reply}`)
                  setReply('')
                  setReplying(false)
                }
              }}
            >
              {dismissLabel}
            </button>
            <button
              type="button"
              className="phone-note-cancel"
              onClick={() => {
                setReply('')
                setReplying(false)
              }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}
      <div className="phone-note-foot">
        <button
          type="button"
          className="phone-note-dismiss"
          aria-label={`${dismissLabel}: ${notification.title ?? app}`}
          onClick={() => onDismiss(notification.id)}
        >
          <svg
            className="phone-note-dismiss-icon"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
          {dismissLabel}
        </button>
      </div>
    </div>
  )
})

export { NoteCard }
