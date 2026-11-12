import type { Telltale } from './telltales'

interface TelltaleListProps {
  items: Telltale[]
  /** The row's name for a reader (the dash gives each of its two rows one). */
  label?: string
  /** The dash's bulb check over the row (the stylesheet lights every slot for a moment). */
  check?: boolean
  /** The Settings preview's inline row, drawn in fewer pixels and inside the warnings card's own switch. */
  compact?: boolean
}

/**
 * A group of telltales: every light keeps its slot whether it is lit or not, so a blinker coming on never moves the
 * row. The cluster has two, the lights the driver switches and the truck's warnings, either side of the route.
 *
 * `check` runs the dash's bulb check over the row: the stylesheet lights every slot for a moment and then hands it back
 * to the truck's own states, so the row is never claimed to be showing anything it isn't — the reader still hears only
 * the lamps that are really on.
 *
 * `compact` draws the same lamps for the layout's miniature: the unlit slots stay faintly visible, as they do not on
 * the glass, so the row reads as the warnings card's switch rather than as an empty strip when nothing is wrong.
 */
export function TelltaleList({ items, label, check, compact = false }: TelltaleListProps) {
  if (compact)
    return (
      <span className="cluster-layout-lamp-row" data-check={check ? '' : undefined}>
        {items.map((telltale) => (
          <span
            key={telltale.key}
            className="cluster-layout-lamp"
            data-tone={telltale.tone}
            data-active={telltale.active ? '' : undefined}
            role={telltale.active ? 'img' : undefined}
            aria-label={telltale.active ? telltale.label : undefined}
            aria-hidden={!telltale.active}
            title={telltale.label}
          >
            {telltale.icon}
          </span>
        ))}
      </span>
    )
  return (
    <ul className="cluster-telltales" data-check={check ? '' : undefined} aria-label={label}>
      {items.map((telltale) => (
        <li
          key={telltale.key}
          className="cluster-telltale"
          data-tone={telltale.tone}
          data-active={telltale.active ? '' : undefined}
          data-blink={telltale.active && telltale.blink ? '' : undefined}
          role={telltale.active ? 'img' : undefined}
          aria-label={telltale.active ? telltale.label : undefined}
          aria-hidden={!telltale.active}
        >
          {telltale.icon}
        </li>
      ))}
    </ul>
  )
}
