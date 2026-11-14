/**
 * ETA milestone alerts: notifies the driver as they approach the destination.
 * Milestones fire once per route: 10 min away, 5 min away, 1 mile/km away, and approaching.
 */

import { useEffect, useRef, useState } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { useLive } from '../state/store'
import { useText } from '../state/text'
import { formatTripDistance } from '../../shared/format'

/** Milestone thresholds (minutes to destination). */
const MILESTONE_MINUTES = [10, 5, 1] as const

/** Distance milestone: ~1 mile in metres (game scale). */
const DISTANCE_MILESTONE_METRES = 1609

/** How long each alert toast stays visible, ms. */
const ALERT_DURATION_MS = 4000

/**
 * Shows ETA milestone alerts as transient toasts over the map.
 */
export function EtaNotifications() {
  const text = useText()
  const [shown, setShown] = useState<{ text: string; id: number } | null>(null)
  const firedRef = useRef<Set<string>>(new Set())
  const routeKeyRef = useRef<number | null>(null)

  const { distance, time, routeKey } = useLive(
    useShallow((state) => ({
      distance: state.telemetry?.navigationDistance ?? 0,
      time: state.telemetry?.navigationTime ?? 0,
      routeKey: state.route ? state.route.distances[0] : null,
    })),
  )

  // Reset milestones when the route changes
  useEffect(() => {
    if (routeKey !== routeKeyRef.current) {
      routeKeyRef.current = routeKey
      firedRef.current = new Set()
    }
  }, [routeKey])

  // Dismiss the current alert
  useEffect(() => {
    if (!shown) return
    const timer = setTimeout(() => setShown(null), ALERT_DURATION_MS)
    return () => clearTimeout(timer)
  }, [shown])

  // Check milestones
  useEffect(() => {
    if (distance <= 0 || time <= 0) return

    const minutes = time / 60
    const fired = firedRef.current

    const fire = (key: string, message: string) => {
      if (!fired.has(key)) {
        fired.add(key)
        setShown({ text: message, id: Date.now() })
        return true
      }
      return false
    }

    // Time-based milestones (check from highest to lowest so the first hit wins)
    for (const threshold of MILESTONE_MINUTES) {
      if (minutes <= threshold && minutes > 0) {
        if (fire(`min:${threshold}`, text.destinations.etaMinutesAway(threshold))) return
      }
    }

    // Distance-based milestone
    if (distance <= DISTANCE_MILESTONE_METRES && distance > 0) {
      const distText = formatTripDistance(DISTANCE_MILESTONE_METRES, text.decimal)
      if (fire('dist:1mi', text.destinations.etaMilesAway(distText))) return
    }

    // Approaching (very close)
    if (distance > 0 && distance < 200) {
      fire('approaching', text.destinations.etaApproaching)
    }
  }, [distance, time, text])

  if (!shown) return null

  return (
    <div key={shown.id} className="eta-alert glass" role="status">
      {shown.text}
    </div>
  )
}
