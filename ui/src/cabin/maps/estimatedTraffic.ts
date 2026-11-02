import type { Point } from './route'
import type { Jam, TrafficStretch } from './traffic'

/**
 * The traffic on a route in single player, estimated rather than read.
 *
 * Nothing in the game's telemetry says where the AI traffic is (SCS's SDK has no channel for other vehicles: only
 * the player's truck and trailers), so there are no vehicles to draw. What there is, is the clock and the road:
 * traffic follows the day (the rush in the morning and the evening, empty at night) and crowds where the route
 * bends through a town. Each 200 m stretch of the route gets a congestion that stays the same every time it's
 * passed at the same hour of the game day, so a road that's slow at eight in the morning is slow there tomorrow
 * too, as a driver learns it.
 *
 * This is an estimate for the map to draw, not a reading of the game: what it says is "this stretch is likely
 * slow now", as a route planner's typical-traffic layer does.
 */

/** How long (m) a stretch of the route is, as traffic.ts cuts it (TruckersMP's). */
const STRETCH = 200
/** The stretch of the game's day the roads are busiest (hours), and how much busier (0 to 1). */
const MORNING = [7, 9.5] as const
const EVENING = [16, 19.5] as const
/** Above this congestion a stretch is slow, and above the second, jammed (as traffic.ts's speeds). */
const SLOW_AT = 0.62
const JAMMED_AT = 0.8

/**
 * How congested a stretch is (0 to 1), from where it is, which way it runs and the hour of the game's day.
 *
 * `place` and `way` are hashed into a stable noise for the stretch: the number is the same for that road at that
 * hour, and different from the road beside it. The hour moves the whole scale up or down, never shuffling which
 * roads are the busy ones.
 */
function congestion(place: Point, way: Point, hour: number): number {
  // Two hashes, so the noise isn't lined up along the road's own direction.
  const noise = hash(Math.round(place[0] / 50) * 73856093, Math.round(place[1] / 50) * 19349663)
  const spread = hash(Math.round(way[0] * 1000), Math.round(way[1] * 1000)) * 0.22
  return Math.min(1, Math.max(0, noise * 0.72 + spread + rush(hour) * 0.5))
}

/** How much the day's hour adds (0 to 0.5): nothing at night, most in the rush. */
function rush(hour: number): number {
  const between = (now: number, [from, to]: readonly [number, number]) =>
    now >= from && now <= to ? Math.sin(((now - from) / (to - from)) * Math.PI) : 0
  const day = hour >= 5 && hour <= 22 ? 0.12 : 0
  return Math.min(0.5, Math.max(between(hour, MORNING), between(hour, EVENING), day))
}

/** A stable 0..1 for a pair of whole numbers (a cheap hash, as the map's own noise would be). */
function hash(x: number, y: number): number {
  let h = Math.imul(x ^ 0x9e3779b9, 0x85ebca6b) ^ Math.imul(y ^ 0xc2b2ae35, 0x27d4eb2f)
  h ^= h >>> 15
  h = Math.imul(h, 0x2545f491)
  h ^= h >>> 13
  return (h >>> 0) / 0xffffffff
}

/**
 * The stretches of `line` ([x, z] m) that are likely slow or jammed at `gameMinute` (the game's clock, minutes
 * since midnight), as traffic.ts's stretches: neighbouring stretches alike are one line, and the line is cut
 * where the level changes.
 */
export function estimatedTraffic(line: readonly Point[], gameMinute: number): TrafficStretch[] {
  if (line.length < 2) return []
  const hour = (((gameMinute % 1440) + 1440) % 1440) / 60
  // How far along the line each of its points is.
  const along = [0]
  for (let i = 1; i < line.length; i++) {
    along.push(along[i - 1] + Math.hypot(line[i][0] - line[i - 1][0], line[i][1] - line[i - 1][1]))
  }
  const length = along[along.length - 1]
  const stretches = Math.max(1, Math.ceil(length / STRETCH))
  const levels = Array.from({ length: stretches }, (_, i): Jam | null => {
    const middle = Math.min(length, (i + 0.5) * STRETCH)
    const at = pointAt(line, along, middle)
    const way = unit(
      sub(pointAt(line, along, Math.min(length, middle + 12)), pointAt(line, along, Math.max(0, middle - 12))),
    )
    const level = congestion(at, way, hour)
    // A stretch that is neither slow nor jammed shows nothing, as TruckersMP's quiet ones.
    return level >= JAMMED_AT ? 'jammed' : level >= SLOW_AT ? 'slow' : null
  })
  // Neighbouring stretches alike, one line.
  const found: TrafficStretch[] = []
  for (let i = 0; i < stretches; i++) {
    const level = levels[i]
    if (!level) continue
    let end = i
    while (end + 1 < stretches && levels[end + 1] === level) end++
    found.push({ line: cut(line, along, i * STRETCH, Math.min(length, (end + 1) * STRETCH)), level })
    i = end
  }
  return found
}

/** The point of the line `distance` m along it. */
function pointAt(line: readonly Point[], along: readonly number[], distance: number): Point {
  let i = 1
  while (i < line.length - 1 && along[i] < distance) i++
  const span = along[i] - along[i - 1]
  const t = span > 0 ? Math.min(1, Math.max(0, (distance - along[i - 1]) / span)) : 0
  return [line[i - 1][0] + (line[i][0] - line[i - 1][0]) * t, line[i - 1][1] + (line[i][1] - line[i - 1][1]) * t]
}

/** The part of the line from `from` to `to` (m along it). */
function cut(line: readonly Point[], along: readonly number[], from: number, to: number): Point[] {
  const points: Point[] = [pointAt(line, along, from)]
  for (let i = 0; i < line.length; i++) if (along[i] > from && along[i] < to) points.push(line[i])
  points.push(pointAt(line, along, to))
  return points
}

function sub(a: Point, b: Point): Point {
  return [a[0] - b[0], a[1] - b[1]]
}

function unit(a: Point): Point {
  const length = Math.hypot(a[0], a[1])
  return length === 0 ? [0, 0] : [a[0] / length, a[1] / length]
}
