import {
  type CSSProperties,
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent,
  type ReactElement,
  useEffect,
  useRef,
  useState,
} from 'react'
import { createPortal } from 'react-dom'
import { formatGameTime } from '../../../shared/format'
import { cabClock } from '../../../shared/host'
import { CLUSTER_ACCENTS, type ClusterAccent, clusterAccent } from '../../cluster/accent'
import { EngineCardBody, FuelCardBody, HoursCardBody, TripCardBody } from '../../cluster/ClusterCards'
import { type ClusterCardViews, useClusterCardViews } from '../../cluster/clusterCardViews'
import {
  AdblueIcon,
  BrakeTemperatureIcon,
  CoolantIcon,
  DropIcon,
  FuelIcon,
  GaugeIcon,
  RestIcon,
  TripIcon,
  WarningIcon,
} from '../../cluster/ClusterIcons'
import { TelltaleList } from '../../cluster/ClusterTelltales'
import { useClusterTelltales } from '../../cluster/telltales'
import {
  CLUSTER_LAYOUTS,
  CLUSTER_LAYOUT_PRESETS,
  CLUSTER_READINGS,
  CLUSTER_SIDE_CARDS,
  type ClusterCard,
  type ClusterLayout,
  type ClusterLayoutPreset,
  type ClusterSide,
  type ClusterSideCard,
  useCabin,
  useLive,
} from '../../state/store'
import { useText } from '../../state/text'
import { useUnits } from '../../state/units'
import { CheckGlyph } from './glyphs'
import { ChoiceRows, Group, Page, SwitchRow } from './rows'
import { useWantedAppearance } from './useWantedAppearance'

/** The dash's bulb check window (ClusterScreen's `BULB_CHECK_MS`): the preview replays the same moment. */
const LAMP_CHECK_MS = 1500

/**
 * The instrument cluster WestPlay replaces on the trucks it is built for, in four parts: whether it is drawn at all,
 * what it carries, how it looks, and how its gauges read.
 *
 * The cards are the panel itself, in miniature: a drag sets their side and their place, a tap takes one off the dash
 * into the tray under the picture (or puts it back), and the lamps in the picture are the warnings switch. The engine
 * card's readings are chosen on the card: a press on a reading opens the seven gauges the Diagnostics app already
 * keeps, with the figure each reads now.
 *
 * The dial's own marks — the tacho's ring, the maker's mark, the accent — are here too: the panel is drawn
 * on the truck's screen, not in this window, so this page is the only place they can be chosen. The gauges' page is
 * the one place the level readings' figure is chosen — a share of the tank, or its litres — and it applies to the dash
 * and to nothing else (the Diagnostics app keeps its own units).
 */
export function ClusterPage() {
  const text = useText()
  const shown = useCabin((state) => state.clusterShown)
  const setShown = useCabin((state) => state.setClusterShown)
  const gaugePercent = useCabin((state) => state.clusterGaugePercent)
  const setGaugePercent = useCabin((state) => state.setClusterGaugePercent)
  const accent = useCabin((state) => state.clusterAccent)
  const setAccent = useCabin((state) => state.setClusterAccent)
  const tacho = useCabin((state) => state.clusterTacho)
  const setTacho = useCabin((state) => state.setClusterTacho)
  const brand = useCabin((state) => state.clusterBrand)
  const setBrand = useCabin((state) => state.setClusterBrand)
  const reset = useCabin((state) => state.resetCluster)
  // The readings as the truck reads them now, for the card's picker and the layout's own picture: the same view model
  // the dash itself draws its cards from (ClusterCards).
  const views = useClusterCardViews()
  const accentNames: Record<ClusterAccent, string> = {
    route: text.settings.clusterAccentRoute,
    play: text.settings.clusterAccentPlay,
    neutral: text.settings.clusterAccentNeutral,
  }
  return (
    <Page title={text.settings.clusterScreen}>
      <Group footer={text.settings.clusterFooter}>
        <SwitchRow label={text.settings.clusterSwitch} on={shown} onToggle={setShown} />
      </Group>
      {shown && <ClusterLayoutEditor views={views} />}
      {shown && (
        <Group header={text.settings.clusterDial} footer={text.settings.clusterDialFooter}>
          <SwitchRow label={text.settings.clusterTacho} on={tacho} onToggle={setTacho} />
          <SwitchRow label={text.settings.clusterBrandMark} on={brand} onToggle={setBrand} />
        </Group>
      )}
      {shown && (
        <ChoiceRows<ClusterAccent>
          header={text.settings.clusterAccent}
          footer={text.settings.clusterAccentFooter}
          radio={text.settings.clusterAccent}
          value={accent}
          options={CLUSTER_ACCENTS.map((id) => ({ id, label: accentNames[id] }))}
          onPick={setAccent}
        />
      )}
      {shown && (
        <Group header={text.settings.clusterGauges} footer={text.settings.clusterGaugeFooter}>
          <SwitchRow label={text.settings.clusterGaugePercent} on={gaugePercent} onToggle={setGaugePercent} />
        </Group>
      )}
      <Group>
        <button type="button" className="settings-row settings-action" onClick={reset}>
          {text.settings.resetCluster}
        </button>
      </Group>
    </Page>
  )
}

/**
 * The cluster's layout editor (Settings › Instrument Cluster): the two columns either side of the dial, live, with each
 * card in its place. A card is dragged to a side and a place in it — before or after the card it is dropped on, or at
 * the foot of a column left empty — and the same moves are the card's own arrow keys, so nothing here needs a pointer.
 * A tap takes a card off the dash — the column closes up as it does on the truck, and the card waits in a tray under
 * the picture — and another tap puts it back at its saved place.
 */
function ClusterLayoutEditor({ views }: { views: ClusterCardViews }) {
  const text = useText()
  const words = text.diagnostics
  const layout = useCabin((state) => state.clusterLayout)
  const cards = useCabin((state) => state.clusterCards)
  const setCard = useCabin((state) => state.setClusterCard)
  const readingSlots = useCabin((state) => state.clusterReadings)
  const setReading = useCabin((state) => state.setClusterReading)
  const applyLayout = useCabin((state) => state.applyClusterLayout)
  const units = useUnits()
  const placeCard = useCabin((state) => state.placeClusterCard)
  const moveCardTo = useCabin((state) => state.moveClusterCardTo)
  // The panel's look, drawn in the miniature as the dash draws it: the accent the needle and the live figures take,
  // the tacho's hairline round the face, and the maker's mark over the speed.
  const accentChoice = useCabin((state) => state.clusterAccent)
  const tacho = useCabin((state) => state.clusterTacho)
  const brand = useCabin((state) => state.clusterBrand)
  const routeColour = useCabin((state) => state.mapRoute)
  const appearance = useWantedAppearance()
  const accent = clusterAccent(accentChoice, appearance, routeColour)
  // The truck as it is on the road, so the picture is read with the figures the driver will see there: the speed in
  // the dial, the trip and the tank on their cards, and the engine's readings as the Diagnostics app gauges them.
  const truck = useLive((state) => state.truck)
  const t = useLive((state) => state.telemetry)
  const clockShift = useLive((state) => state.clockShift)
  // The two lamp rows the dash draws, lit as the truck has them: the picture's rail carries the real marks rather than
  // a row of dots.
  const { lights, faults } = useClusterTelltales()
  // The switch's name says what the row is showing, since the lamps themselves are only marks inside it.
  const litFaults = faults.filter((lamp) => lamp.active).map((lamp) => lamp.label)
  const time = t ? formatGameTime(cabClock(t, clockShift)) : '--:--'
  const speed = t ? units.speed(t.speed) : 0
  const names: Record<ClusterSideCard, string> = {
    trip: words.trip,
    engine: words.engine,
    hours: words.driverHours,
    fuel: words.fuel,
  }
  // What each card carries, for the hover and the reader: the cards have no names beside them in the picture.
  const cardDetail: Record<ClusterCard, string> = {
    trip: text.settings.clusterCardTrip,
    fuel: text.settings.clusterCardFuel,
    engine: text.settings.clusterCardEngine,
    hours: text.settings.clusterCardHours,
    warnings: text.settings.clusterCardWarnings,
  }
  const presetNames: Record<ClusterLayoutPreset, string> = {
    standard: text.settings.presetClusterStandard,
    hours: text.settings.presetClusterHours,
    tank: text.settings.presetClusterTank,
  }
  const activePreset =
    CLUSTER_LAYOUT_PRESETS.find((preset) => matchesClusterLayout(CLUSTER_LAYOUTS[preset], layout)) ?? null
  const [drag, setDrag] = useState<ClusterCardDrag | null>(null)
  const press = useRef<ClusterCardPress | null>(null)
  // A drag ends with the browser's click on the card it started on: that click must not switch the card off.
  const suppressTap = useRef(false)
  // Which engine slot's readings are being chosen, and the reading that opened the choice: a press beside the panel
  // takes it away, and the reading takes the focus back when it does.
  const [picking, setPicking] = useState<number | null>(null)
  // The dash's bulb check, replayed under the picture: every slot lights for a moment, the same 1.5 s the panel runs
  // as the boot clears (ClusterScreen's BULB_CHECK_MS), so the player can prove a lamp without starting the truck.
  const [check, setCheck] = useState(false)
  const checkTimer = useRef(0)
  useEffect(() => () => clearTimeout(checkTimer.current), [])
  const checkLamps = () => {
    clearTimeout(checkTimer.current)
    setCheck(true)
    checkTimer.current = window.setTimeout(() => setCheck(false), LAMP_CHECK_MS)
  }
  const pickerOpener = useRef<HTMLElement | null>(null)
  const picker = useRef<HTMLDivElement | null>(null)
  // The Settings window itself, not the miniature: the choice is drawn on the screen around the dash so all seven
  // gauges and their figures are seen, rather than squeezed into the picture's 320px. It is taken when the panel
  // opens, since a ref cannot be read while rendering.
  const [pickerHost, setPickerHost] = useState<HTMLElement | null>(null)

  const openPicker = (button: HTMLElement, slot: number) => {
    pickerOpener.current = button
    setPickerHost(button.closest<HTMLElement>('.settings-app'))
    setPicking(slot)
  }

  const closePicker = () => {
    setPicking(null)
    pickerOpener.current?.focus()
  }

  // The choice is a menu, so its rows take the arrow keys, Home and End, and a letter jumps to a gauge's name: the
  // Tab trap keeps the focus in the panel, and these make the panel walkable without counting tabs.
  const onChoiceKey = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    const choices = Array.from(event.currentTarget.querySelectorAll<HTMLButtonElement>('button'))
    if (choices.length === 0) return
    const at = choices.indexOf(document.activeElement as HTMLButtonElement)
    const key = event.key
    if (key === 'ArrowDown' || key === 'ArrowUp' || key === 'Home' || key === 'End') {
      let next = at
      if (key === 'Home') next = 0
      else if (key === 'End') next = choices.length - 1
      else if (key === 'ArrowDown') next = at < 0 ? 0 : (at + 1) % choices.length
      else next = at < 0 ? choices.length - 1 : (at - 1 + choices.length) % choices.length
      event.preventDefault()
      choices[next].focus()
      return
    }
    if (key.length !== 1 || key === ' ') return
    const letter = key.toLocaleLowerCase()
    const name = (choice: HTMLButtonElement) => choice.textContent?.trim().toLocaleLowerCase() ?? ''
    const list = [...choices.slice(at + 1), ...choices.slice(0, at + 1)]
    const match = list.find((choice) => name(choice).startsWith(letter))
    if (!match) return
    event.preventDefault()
    match.focus()
  }

  useEffect(() => {
    if (picking === null) return
    const panel = picker.current
    panel?.querySelector<HTMLElement>('[aria-checked="true"]')?.focus()
    const onKey = (event: globalThis.KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        setPicking(null)
        pickerOpener.current?.focus()
        return
      }
      if (event.key !== 'Tab' || !panel) return
      // The choice is the only thing on the screen while it is open: the tab key stays among its gauges.
      const choices = panel.querySelectorAll<HTMLElement>('button')
      const first = choices[0]
      const last = choices[choices.length - 1]
      if (!first || !last) return
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first.focus()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [picking])

  const startDrag = (event: PointerEvent<HTMLDivElement>, card: ClusterSideCard) => {
    if (event.button !== 0) return
    // Keep the press's moves and release, even when the cursor leaves the card.
    event.currentTarget.setPointerCapture(event.pointerId)
    press.current = { card, pointerId: event.pointerId, x: event.clientX, y: event.clientY, dragging: false }
  }

  // The pointer's own drag, as the Dashboard's editor takes it: no native HTML5 drag, which WebView2 hands to the OS
  // and can lose the cabin's press.
  useEffect(() => {
    const move = (event: globalThis.PointerEvent) => {
      const held = press.current
      if (!held || held.pointerId !== event.pointerId) return
      if (!held.dragging) {
        if (Math.hypot(event.clientX - held.x, event.clientY - held.y) < 8) return
        held.dragging = true
        setDrag({ card: held.card, over: null, side: null, after: false })
      }
      event.preventDefault()
      const hit = clusterCardUnder(event.clientX, event.clientY)
      // Over the card in hand itself: nothing to drop on yet, so neither a card nor a column is marked.
      const side =
        hit && hit.card === held.card ? null : (hit?.side ?? clusterColumnUnder(event.clientX, event.clientY))
      setDrag((current) => {
        if (!current) return current
        const hitCard = hit && hit.card !== held.card ? hit : null
        const over = hitCard?.card ?? null
        const after = hitCard?.after ?? false
        return current.over === over && current.after === after && current.side === side
          ? current
          : { ...current, over, after, side }
      })
    }
    const up = (event: globalThis.PointerEvent) => {
      const held = press.current
      if (!held || held.pointerId !== event.pointerId) return
      press.current = null
      if (held.dragging) {
        const hit = clusterCardUnder(event.clientX, event.clientY)
        if (hit && hit.card === held.card) {
          // Let go over itself: it stays where it was.
        } else if (hit) {
          moveCardTo(held.card, hit.card, hit.after)
        } else {
          const side = clusterColumnUnder(event.clientX, event.clientY)
          if (side !== null) placeCard(held.card, side)
        }
        suppressTap.current = true
        window.setTimeout(() => (suppressTap.current = false), 300)
      }
      setDrag(null)
    }
    const cancel = (event: globalThis.PointerEvent) => {
      const held = press.current
      if (!held || held.pointerId !== event.pointerId) return
      press.current = null
      setDrag(null)
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
    window.addEventListener('pointercancel', cancel)
    return () => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
      window.removeEventListener('pointercancel', cancel)
      press.current = null
    }
  }, [moveCardTo, placeCard])

  // What each card shows in the miniature, from the cards' own components: the dash's panel body in its compact form,
  // so the picture can't show a reading the dash doesn't (or miss one it does). The figures are the truck's, so the
  // picture is judged with the numbers the driver will see on the glass rather than with a sketch of them.
  const cardBody = (card: ClusterSideCard) => {
    switch (card) {
      case 'trip':
        return <TripCardBody views={views} compact />
      case 'engine':
        return (
          <EngineCardBody
            views={views}
            slots={readingSlots}
            compact
            picking={picking}
            onPick={(slot, element) => {
              // The click that ends a drag is not a press on the reading.
              if (suppressTap.current) return
              openPicker(element, slot)
            }}
          />
        )
      case 'hours':
        return <HoursCardBody views={views} compact />
      case 'fuel':
        return <FuelCardBody views={views} compact />
    }
  }

  // One column of the preview, as the dash's own stands: only the cards turned on, in the player's order, each one
  // taken by the pointer or moved by the arrow keys — up and down its column, left and right across the dial. A tap
  // takes a card off the glass and the column closes up, as it does on the truck; the card waits in the tray under the
  // picture. The tank's companions close the right column, where they always are.
  const column = (side: ClusterSide) => {
    const shown = layout[side].filter((card) => cards[card])
    return (
      <div
        key={side}
        className="cluster-layout-column"
        data-cluster-column={side}
        // Four cards on the left, or three beside the tank's fixed readings, leave each panel too short for its
        // figures: the column tightens its cards instead.
        data-compact={shown.length > (side === 'right' ? 2 : 3) ? '' : undefined}
        data-drop={drag?.over === null && drag?.side === side ? 'end' : undefined}
        role="group"
        aria-label={side === 'left' ? text.settings.clusterSideLeft : text.settings.clusterSideRight}
      >
        {shown.map((card, place) => {
          const engine = card === 'engine'
          const label = `${names[card]}, ${
            side === 'left' ? text.settings.clusterSideLeft : text.settings.clusterSideRight
          } ${place + 1} / ${shown.length}, ${text.diagnostics.on}`
          // Up and down the column, left and right across the dial: the card's own keys, whether the card is the
          // toggle itself or, for the engine, the name that carries the toggle above the readings.
          const keyStep = (event: ReactKeyboardEvent<HTMLElement>, toggle: boolean) => {
            const key = event.key
            if (key === 'ArrowUp' || key === 'ArrowDown') {
              // The step is to the next card on the glass, not the next in the saved order: a card taken off has no
              // place to pass here, and its hidden slot is not a step the key should spend.
              const neighbour = shown[shown.indexOf(card) + (key === 'ArrowUp' ? -1 : 1)]
              if (neighbour) moveCardTo(card, neighbour, key === 'ArrowDown')
            } else if (key === 'ArrowLeft' || key === 'ArrowRight') {
              const target: ClusterSide = key === 'ArrowLeft' ? 'left' : 'right'
              if (target === side) return
              // Across the dial, the card keeps its place in the column: the same number of cards stay above it. The
              // chosen card is the one to sit before, so a card waiting off the glass in that column does not shift it.
              const anchor = layout[target].filter((id) => cards[id])[place]
              if (anchor) placeCard(card, target, layout[target].indexOf(anchor))
              else placeCard(card, target)
            } else if (toggle && (key === 'Enter' || key === ' ')) setCard(card, false)
            else return
            event.preventDefault()
            // A card moved to the other column, or taken off it, is a new element: the focus goes with it.
            focusClusterCard(card)
          }
          return (
            <div
              key={card}
              className="cluster-layout-card"
              data-cluster-card={card}
              data-cluster-side={side}
              data-dragging={drag?.card === card ? '' : undefined}
              data-drop={drag?.over === card ? (drag.after ? 'after' : 'before') : undefined}
              // The card's share of the column, as the panel's own height: the engine's three readings stand taller than
              // the tank's gauge, and the preview says so before the dash does.
              style={{ '--card-weight': PREVIEW_WEIGHT[card] } as CSSProperties}
              // The engine's readings are the card's own controls, so its toggle is the name above them and its body is
              // a group; every other card is the toggle, as a button is.
              role={engine ? 'group' : 'button'}
              tabIndex={engine ? undefined : 0}
              aria-pressed={engine ? undefined : cards[card]}
              aria-label={engine ? undefined : label}
              aria-keyshortcuts={engine ? undefined : 'ArrowUp ArrowDown ArrowLeft ArrowRight Enter Space'}
              title={cardDetail[card]}
              onPointerDown={(event) => startDrag(event, card)}
              onKeyDown={engine ? undefined : (event) => keyStep(event, true)}
              onClick={() => {
                // The click that ends a drag is not a tap on the card.
                if (suppressTap.current) return
                setCard(card, false)
                focusClusterCard(card)
              }}
            >
              {engine ? (
                <button
                  type="button"
                  className="cluster-layout-card-head cluster-layout-card-toggle"
                  aria-pressed={cards[card]}
                  aria-label={label}
                  aria-keyshortcuts="ArrowUp ArrowDown ArrowLeft ArrowRight Enter Space"
                  onKeyDown={(event) => keyStep(event, false)}
                  onClick={(event) => {
                    // The head is the engine card's switch; the press is not also a tap on the card under it.
                    event.stopPropagation()
                    if (suppressTap.current) return
                    setCard(card, false)
                    focusClusterCard(card)
                  }}
                >
                  <span className="cluster-layout-card-glyph" aria-hidden>
                    {PREVIEW_ICON[card]}
                  </span>
                  <span className="cluster-layout-card-name">{names[card]}</span>
                </button>
              ) : (
                <span className="cluster-layout-card-head">
                  <span className="cluster-layout-card-glyph" aria-hidden>
                    {PREVIEW_ICON[card]}
                  </span>
                  <span className="cluster-layout-card-name">{names[card]}</span>
                </span>
              )}
              <span className="cluster-layout-body">{cardBody(card)}</span>
            </div>
          )
        })}
        {side === 'right' && <ClusterLayoutFixed />}
      </div>
    )
  }

  // The cards taken off the panel, under the picture: still part of the setting, one tap from the glass.
  const off = CLUSTER_SIDE_CARDS.filter((card) => !cards[card])

  return (
    <Group header={text.settings.clusterLayout} footer={text.settings.clusterLayoutFooter}>
      <div className="cluster-layout-editor">
        <div className="dashboard-layout-presets" role="group" aria-label={text.settings.clusterPresets}>
          {CLUSTER_LAYOUT_PRESETS.map((preset) => (
            <button
              key={preset}
              type="button"
              className="dashboard-layout-preset"
              aria-pressed={preset === activePreset}
              onClick={() => applyLayout(CLUSTER_LAYOUTS[preset])}
            >
              <ClusterLayoutShot layout={CLUSTER_LAYOUTS[preset]} />
              <span className="dashboard-preset-copy">
                <span className="dashboard-preset-name">{presetNames[preset]}</span>
                {preset === activePreset && (
                  <span className="dashboard-preset-check" aria-hidden>
                    <CheckGlyph />
                  </span>
                )}
              </span>
            </button>
          ))}
        </div>
        {/* The dash itself, in miniature: its status bar, the two columns and the dial between them. The columns are
              the layout — a card is put where it is to sit, and the picture is the setting. It reads the truck as it
              is, so the accent, the tacho and the brand are the ones the driver gets, not swatches beside them. */}
        <div
          className="cluster-layout-preview"
          data-tacho={tacho ? '' : undefined}
          role="group"
          data-own-drag
          aria-label={text.settings.clusterLayout}
          style={{ '--accent': accent } as CSSProperties}
        >
          <div className="cluster-layout-rail">
            {/* The lights the driver switches, on the rail's left where the dash keeps them: their own row, not the
                warnings card's, so the picture reads in the same order as the glass. */}
            <span className="cluster-layout-lights" aria-hidden>
              <TelltaleList items={lights} compact check={check} />
            </span>
            <span className="cluster-layout-route" aria-hidden />
            {/* The warnings, on the rail's right as on the dash — and themselves the warnings card's switch: a tap
                dims them in the picture and takes the card's marks off the panel. */}
            <button
              type="button"
              className="cluster-layout-lamps"
              aria-pressed={cards.warnings}
              aria-label={`${words.warnings}: ${
                cards.warnings ? text.diagnostics.on : text.diagnostics.off
              }${litFaults.length > 0 ? ` (${litFaults.join(', ')})` : ''}`}
              title={cardDetail.warnings}
              data-off={cards.warnings ? undefined : ''}
              onClick={() => setCard('warnings', !cards.warnings)}
            >
              <TelltaleList items={faults} compact check={check} />
            </button>
            <span className="cluster-layout-time" aria-hidden>
              {time}
            </span>
          </div>
          {column('left')}
          <div className="cluster-layout-dial" aria-hidden>
            {brand && truck && <span className="cluster-layout-brand">{truck.brand}</span>}
            <b className="cluster-layout-speed">{speed}</b>
            <span className="cluster-layout-unit">{units.labels.speed}</span>
          </div>
          {column('right')}
        </div>
        <button type="button" className="cluster-layout-test" onClick={checkLamps}>
          {text.settings.clusterTestLamps}
        </button>
        {off.length > 0 && (
          <div className="cluster-layout-tray" role="group" aria-label={text.settings.clusterHidden}>
            <span className="cluster-layout-tray-label" aria-hidden>
              {text.settings.clusterHidden}
            </span>
            {off.map((card) => (
              <button
                key={card}
                type="button"
                className="cluster-layout-tray-card"
                data-cluster-card={card}
                aria-pressed="false"
                aria-label={`${names[card]}, ${text.diagnostics.off}`}
                title={cardDetail[card]}
                onClick={() => {
                  setCard(card, true)
                  focusClusterCard(card)
                }}
              >
                <span className="cluster-layout-tray-icon" aria-hidden>
                  {PREVIEW_ICON[card]}
                </span>
                <span>{names[card]}</span>
              </button>
            ))}
          </div>
        )}
        {/* The engine's readings, chosen where they are read: a press on one dims the Settings window, the seven
            gauges the Diagnostics app keeps are listed on it with their live figures, and the one in the slot is
            ticked. The panel belongs to the screen, not the picture, so nothing is clipped by the miniature. */}
        {picking !== null &&
          pickerHost &&
          createPortal(
            <div className="cluster-reading-layer">
              <div className="cluster-reading-scrim" onClick={closePicker} />
              <div
                className="cluster-reading-picker"
                role="dialog"
                aria-modal="true"
                aria-label={`${text.settings.clusterReadings}: ${text.settings.clusterReadingSlot(picking + 1)}`}
                ref={picker}
              >
                <div className="cluster-reading-picker-head">
                  <span className="cluster-reading-picker-kicker">{text.settings.clusterReadings}</span>
                  <div className="cluster-reading-picker-title">
                    <b>{text.settings.clusterReadingSlot(picking + 1)}</b>
                    <span>{views.readings[readingSlots[picking]].pickerLabel}</span>
                  </div>
                </div>
                <div
                  className="cluster-reading-choices"
                  role="menu"
                  aria-label={text.settings.clusterReadings}
                  onKeyDown={onChoiceKey}
                >
                  {CLUSTER_READINGS.map((id) => {
                    const on = readingSlots[picking] === id
                    const view = views.readings[id]
                    const figure = views.live
                      ? view.figure.unit
                        ? `${view.figure.value} ${view.figure.unit}`
                        : view.figure.value
                      : '—'
                    return (
                      <button
                        key={id}
                        type="button"
                        role="menuitemradio"
                        aria-checked={on}
                        data-warn={view.warn ? '' : undefined}
                        className="cluster-reading-choice"
                        onClick={() => {
                          setReading(picking, id)
                          closePicker()
                        }}
                      >
                        <span className="cluster-reading-choice-icon" aria-hidden>
                          {view.icon}
                        </span>
                        <span className="cluster-reading-choice-name">{view.pickerLabel}</span>
                        <span className="cluster-reading-choice-figure">{figure}</span>
                        {on && (
                          <span className="cluster-reading-choice-check" aria-hidden>
                            <CheckGlyph />
                          </span>
                        )}
                      </button>
                    )
                  })}
                </div>
                <p className="cluster-reading-picker-note">{text.settings.clusterReadingsFooter}</p>
              </div>
            </div>,
            pickerHost,
          )}
      </div>
    </Group>
  )
}

/** A card's share of the preview's column: the panels' own heights, near enough — the engine's three readings stand
 * tallest, the tank's gauge shortest — so the picture says how full a side is before the dash does. */
const PREVIEW_WEIGHT: Record<ClusterSideCard, number> = {
  trip: 1.5,
  engine: 1.9,
  // The two short cards carry their figures now, not three bars: their share is the room a figure and a pair take,
  // which is a little more than a sketch of them did.
  hours: 1.45,
  fuel: 1.35,
}

/** The mark each card wears in the preview: the same marks the dash draws on its panels. */
const PREVIEW_ICON: Record<ClusterSideCard, ReactElement> = {
  trip: <TripIcon />,
  engine: <GaugeIcon />,
  hours: <RestIcon />,
  fuel: <FuelIcon />,
}

/** The readings that keep the right side whatever the layout: the tank's companions, drawn under its cards so the
 * editor shows what shares that column. They are the dash's own, not the player's to move. */
function ClusterLayoutFixed() {
  const text = useText()
  const words = text.diagnostics
  // Named for the reader and for a hover, since the block has only the icons' room: what is always here is a fact
  // about the column, and a row of unlabelled marks would leave it a guess.
  const fixed = [
    { icon: <AdblueIcon />, name: words.adblue },
    { icon: <CoolantIcon />, name: words.coolant },
    { icon: <BrakeTemperatureIcon />, name: words.brakeTemperature },
    { icon: <DropIcon />, name: words.instant },
    { icon: <WarningIcon />, name: words.wear },
  ]
  return (
    <div className="cluster-layout-fixed" role="note" aria-label={text.settings.clusterLayoutFixed}>
      <span className="cluster-layout-fixed-name">{text.settings.clusterLayoutFixed}</span>
      {fixed.map(({ icon, name }) => (
        <span className="cluster-layout-fixed-row" key={name} title={name} aria-label={name}>
          {icon}
          <i />
        </span>
      ))}
    </div>
  )
}

/** Focus a preview card by name once the layout has been drawn: a card moved across the dial is a new element in the
 * other column, and the focus goes with it. */
function focusClusterCard(card: ClusterSideCard): void {
  requestAnimationFrame(() => {
    const element = document.querySelector<HTMLElement>(`[data-cluster-card="${card}"]`)
    // The engine card's toggle is its name above the readings; every other card is the focusable element itself.
    const target = element?.querySelector<HTMLElement>('button') ?? element
    target?.focus()
  })
}

/** A card being picked up in the layout preview, before it is moved far enough to be a drag. */
interface ClusterCardPress {
  card: ClusterSideCard
  pointerId: number
  x: number
  y: number
  dragging: boolean
}

/** A card being dragged: the card it would drop beside, and the side it is over. */
interface ClusterCardDrag {
  card: ClusterSideCard
  over: ClusterSideCard | null
  side: ClusterSide | null
  after: boolean
}

/** The preview card under a point, and which half of it the point is on: a drop goes before or after it. */
function clusterCardUnder(x: number, y: number): { card: ClusterSideCard; side: ClusterSide; after: boolean } | null {
  const element = document.elementFromPoint(x, y)?.closest<HTMLElement>('[data-cluster-card]')
  const card = element?.dataset.clusterCard as ClusterSideCard | undefined
  const side = element?.dataset.clusterSide as ClusterSide | undefined
  if (!element || !card || !side) return null
  const box = element.getBoundingClientRect()
  return { card, side, after: y > box.top + box.height / 2 }
}

/** The side of the preview a point is over (`null`: neither column). */
function clusterColumnUnder(x: number, y: number): ClusterSide | null {
  const element = document.elementFromPoint(x, y)?.closest<HTMLElement>('[data-cluster-column]')
  const side = element?.dataset.clusterColumn
  return side === 'left' || side === 'right' ? side : null
}

/** Whether the panel is already showing exactly this layout: its preset's button says so. */
function matchesClusterLayout(layout: ClusterLayout, other: ClusterLayout): boolean {
  return layout.left.join() === other.left.join() && layout.right.join() === other.right.join()
}

/** A preset's picture: the two columns of the dash's own size, each card a bar, and the dial between them. */
function ClusterLayoutShot({ layout }: { layout: ClusterLayout }) {
  return (
    <span className="cluster-layout-shot" aria-hidden>
      <span className="cluster-layout-shot-column">
        {layout.left.map((card) => (
          <i key={card} />
        ))}
      </span>
      <span className="cluster-layout-shot-dial" />
      <span className="cluster-layout-shot-column">
        {layout.right.map((card) => (
          <i key={card} />
        ))}
      </span>
    </span>
  )
}
