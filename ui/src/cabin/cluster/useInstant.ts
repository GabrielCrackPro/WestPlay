import { useEffect, useRef, useState } from 'react'
import { useLive } from '../state/store'

/**
 * The truck's fuel consumption this moment, litres per 100 km: what the tank lost over the road covered since the
 * last reading, published once a second. The game reports an average, not an instant (the SDK's consumption channel
 * isn't carried), so this is worked out from the two figures it does report, the tank and the odometer.
 *
 * `null` while the engine is off, and until the truck has covered enough ground for the figure to mean anything: a
 * frame's worth of fuel is noise, and idling burns fuel without covering any.
 */
export function useInstantConsumption(): number | null {
  const telemetry = useLive((state) => state.telemetry)
  const last = useRef<{ fuel: number; odometer: number } | null>(null)
  const published = useRef(0)
  const [instant, setInstant] = useState<number | null>(null)
  useEffect(() => {
    if (!telemetry || !telemetry.engineEnabled) {
      last.current = null
      return
    }
    const previous = last.current
    last.current = { fuel: telemetry.fuel, odometer: telemetry.odometer }
    if (!previous || telemetry.paused) return
    const distance = telemetry.odometer - previous.odometer
    const burnt = previous.fuel - telemetry.fuel
    // 20 m is enough road for the difference between two frames to be the engine's doing rather than rounding.
    if (distance < 0.02 || burnt <= 0) return
    const now = performance.now()
    if (now - published.current < 1000) return
    published.current = now
    setInstant(Math.min(99.9, (burnt / distance) * 100))
  }, [telemetry])
  // The figure belongs to a running engine: parked, the tank isn't being read, whatever the last sample said. Clearing
  // it during render (React's derived-state pattern) also keeps a restart from showing the old run's figure.
  if (!telemetry?.engineEnabled && instant !== null) setInstant(null)
  return telemetry?.engineEnabled ? instant : null
}
