import { type CSSProperties, type ReactNode, type RefObject, useEffect, useRef, useState } from 'react'
import { useText } from '../../state/text'
import { CheckGlyph, ChevronGlyph, PinGlyph } from './glyphs'
import { useSettings } from './settings'

/**
 * The pieces the Settings app's pages are built from: the page frame and its bar, a card and its notes, and
 * the rows a card holds (navigation, switches, reorder handles, choices). Every page draws them from here, so
 * they read, tone and tick alike rather than each page spelling them out again.
 */

/** A row picked from those in its card, a blue tick on the one picked. */
function CheckRow({ label, on, onPick }: { label: string; on: boolean; onPick: () => void }) {
  return (
    <button type="button" role="radio" aria-checked={on} className="settings-row" onClick={onPick}>
      <span className="settings-label">{label}</span>
      {on && (
        <span className="settings-check">
          <CheckGlyph />
        </span>
      )}
    </button>
  )
}

/**
 * A card of choices: one row each, the one in force ticked. Every choice list in the app is drawn here — the
 * Maps page's ten, the icon styles, the Equalizer's two — so they read, tone and tick alike rather than each
 * spelling the rows out again.
 */
export function ChoiceRows<T extends string | number>({
  header,
  footer,
  radio,
  options,
  value,
  onPick,
}: {
  header?: string
  footer?: string
  radio: string
  options: readonly { id: T; label: string }[]
  /** The one in force (`null`: none — the icon style while Android Auto's tiles are chosen). */
  value: T | null
  onPick(id: T): void
}) {
  return (
    <Group header={header} footer={footer} radio={radio}>
      {options.map((option) => (
        <CheckRow key={option.id} label={option.label} on={value === option.id} onPick={() => onPick(option.id)} />
      ))}
    </Group>
  )
}

/**
 * A page: its content scrolling under a bar that holds the back button and the page's title. On the list,
 * the title is large at the top of the content, and the bar's small one takes over once it scrolls under.
 * Content scrolled under the bar fades and blurs away, iOS 26's edge.
 */
export function Page({ title, list = false, children }: { title: string; list?: boolean; children: ReactNode }) {
  const text = useText()
  const back = useSettings((state) => state.back)
  const [scrolled, setScrolled] = useState(false)
  const [largeTitleGone, setLargeTitleGone] = useState(false)
  // More under the page's foot than shows: a small chevron at the bottom says so until the end is reached.
  const scroll = useRef<HTMLDivElement>(null)
  const [more, setMore] = useState(false)
  useMoreBelow(scroll, setMore)
  return (
    <>
      <div
        ref={scroll}
        className={list ? 'settings-scroll list' : 'settings-scroll'}
        onScroll={(event) => {
          const top = event.currentTarget.scrollTop
          setScrolled(top > 0)
          setLargeTitleGone(top > LARGE_TITLE_HEIGHT)
        }}
      >
        {list && <h1 className="settings-large-title">{title}</h1>}
        {children}
      </div>
      {more && (
        <span className="settings-more" aria-hidden>
          <ChevronGlyph />
        </span>
      )}
      <header className={scrolled ? 'settings-bar scrolled' : 'settings-bar'}>
        {!list && (
          <button type="button" className="settings-back" aria-label={text.settings.back} onClick={back}>
            <ChevronGlyph back />
          </button>
        )}
        <div className={!list || largeTitleGone ? 'settings-bar-title shown' : 'settings-bar-title'}>{title}</div>
      </header>
    </>
  )
}

/** How far the list scrolls before its large title is under the bar (settings.css: .settings-large-title). */
const LARGE_TITLE_HEIGHT = 56

/** Below this much left to scroll, the page is at its end (the chevron's own height, so it goes as it's reached). */
const MORE_BELOW = 24

/**
 * Whether a page has more under its foot than shows, measured whenever its content or its box changes (a page's
 * rows come and go: the Equalizer's curve, the map's lists) and as it scrolls. The chevron it drives sits over the
 * page's foot and takes no presses: it's a sign, not a control.
 */
function useMoreBelow(ref: RefObject<HTMLDivElement | null>, set: (more: boolean) => void) {
  useEffect(() => {
    const element = ref.current
    if (!element) return
    const measure = () => set(element.scrollHeight - element.scrollTop - element.clientHeight > MORE_BELOW)
    measure()
    // The box, and each of its parts (a group growing as rows are added to it).
    const observer = new ResizeObserver(measure)
    observer.observe(element)
    for (const child of Array.from(element.children)) observer.observe(child)
    element.addEventListener('scroll', measure, { passive: true })
    return () => {
      observer.disconnect()
      element.removeEventListener('scroll', measure)
    }
  }, [ref, set])
}

export function Group({
  header,
  footer,
  radio,
  children,
}: {
  header?: string
  /** A note under the card, or one per line where the card answers more than one thing (Home's rows). */
  footer?: string | readonly string[]
  /** The rows are one choice between them (a tick on the one picked): the card is a radio group, named by this. */
  radio?: string
  children: ReactNode
}) {
  return (
    <div className="settings-group">
      {header && <h2 className="settings-group-header">{header}</h2>}
      <div className="settings-card" role={radio ? 'radiogroup' : undefined} aria-label={radio}>
        {children}
      </div>
      {(typeof footer === 'string' ? [footer] : (footer ?? [])).map((line) => (
        <p key={line} className="settings-group-footer">
          {line}
        </p>
      ))}
    </div>
  )
}

interface RowLabel {
  label: string
  /** A coloured tile with a white glyph before the label (rows on the list have one). */
  tile?: string
  icon?: ReactNode
}

function RowStart({ label, tile, icon }: RowLabel) {
  return (
    <>
      {tile && (
        <span className="settings-tile" style={{ background: tile } as CSSProperties}>
          {icon}
        </span>
      )}
      <span className="settings-label">{label}</span>
    </>
  )
}

/** A row that opens a page: its value in grey, and a chevron. */
export function NavRow({ value, onOpen, ...start }: RowLabel & { value?: string; onOpen: () => void }) {
  return (
    <button type="button" className={start.tile ? 'settings-row with-tile' : 'settings-row'} onClick={onOpen}>
      <RowStart {...start} />
      {value && <span className="settings-value">{value}</span>}
      <span className="settings-chevron">
        <ChevronGlyph />
      </span>
    </button>
  )
}

/** A row with a switch; the whole row flips it (a big target on a truck's screen). */
export function SwitchRow({
  on,
  onToggle,
  disabled = false,
  ...start
}: RowLabel & {
  on: boolean
  onToggle: (on: boolean) => void
  /** At a limit of its own (the sidebar's pins are full): the row says so rather than pretending to work. */
  disabled?: boolean
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      disabled={disabled}
      className={start.tile ? 'settings-row with-tile' : 'settings-row'}
      onClick={() => onToggle(!on)}
    >
      <RowStart {...start} />
      <span className={on ? 'apple-switch on' : 'apple-switch'} aria-hidden>
        <span className="apple-switch-thumb" />
      </span>
    </button>
  )
}

/**
 * A switch's row with the two buttons that move it, where its list can be reordered: the Dashboard's widgets
 * (only while Auto order is off) and Home's apps. Without a place the row is the plain switch row it always was;
 * with one, the name and switch stay a single target and the arrows sit beside it, at the row's end.
 */
export function SwitchOrderRow({
  label,
  on,
  onToggle,
  place,
  pin,
}: {
  label: string
  on: boolean
  onToggle(on: boolean): void
  /** Where the row stands in its list: the ends can't be moved further. */
  place?: { first: boolean; last: boolean; onMove(by: number): void }
  /** The sidebar's pin, where the row has one (Home's apps): a compact toggle beside the switch. */
  pin?: { pinned: boolean; disabled: boolean; label: string; onToggle(): void }
}) {
  if (!place && !pin) return <SwitchRow label={label} on={on} onToggle={onToggle} />
  return (
    <div className="settings-row settings-manage">
      <button
        type="button"
        role="switch"
        aria-checked={on}
        className="settings-manage-toggle"
        onClick={() => onToggle(!on)}
      >
        <span className="settings-label">{label}</span>
        <span className={on ? 'apple-switch on' : 'apple-switch'} aria-hidden>
          <span className="apple-switch-thumb" />
        </span>
      </button>
      {pin && (
        <button
          type="button"
          aria-pressed={pin.pinned}
          aria-label={`${pin.label} ${label}`}
          title={`${pin.label} ${label}`}
          className="settings-pin"
          disabled={pin.disabled}
          onClick={pin.onToggle}
        >
          <PinGlyph pinned={pin.pinned} />
        </button>
      )}
      {place && <OrderButtons label={label} first={place.first} last={place.last} onMove={place.onMove} />}
    </div>
  )
}

/** The two buttons that move a row up or down its list: the app's own chevron, turned to point that way. */
export function OrderButtons({
  label,
  first,
  last,
  onMove,
}: {
  label: string
  first: boolean
  last: boolean
  onMove(by: number): void
}) {
  const text = useText()
  return (
    <span className="settings-order-buttons">
      <button type="button" aria-label={`${text.settings.moveUp} ${label}`} disabled={first} onClick={() => onMove(-1)}>
        <span className="settings-move up" aria-hidden>
          <ChevronGlyph />
        </span>
      </button>
      <button type="button" aria-label={`${text.settings.moveDown} ${label}`} disabled={last} onClick={() => onMove(1)}>
        <span className="settings-move down" aria-hidden>
          <ChevronGlyph />
        </span>
      </button>
    </span>
  )
}
