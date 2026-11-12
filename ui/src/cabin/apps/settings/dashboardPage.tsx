import { type PointerEvent, useEffect, useRef, useState } from 'react'
import { TextField } from '../../keyboard/TextField'
import { EMPTY, useDestinationView, useDiagnosticsView, useDriverHoursView } from '../../dashboard/widgetState'
import { useNowPlayingTrack } from '../../dashboard/useNowPlaying'
import { weatherView } from '../../dashboard/weather'
import {
  DASHBOARD_LAYOUTS,
  DASHBOARD_LAYOUT_NAME_LENGTH,
  DASHBOARD_PRESETS,
  DASHBOARD_WIDGET_SIZES,
  OVERVIEW_CARDS,
  type DashboardLayout,
  type DashboardLayoutPreset,
  type DashboardWidget,
  type DashboardWidgetSize,
  type OverviewCard,
  useCabin,
  useLive,
} from '../../state/store'
import { useText } from '../../state/text'
import { useUnits } from '../../state/units'
import { CheckGlyph } from './glyphs'
import { Group, NavRow, Page, SwitchRow } from './rows'
import { useSettings } from './settings'

/** Which widgets the Dashboard shows and the order and size they come in (Auto order: the drive's own), and its
 * second screen, the Overview, which has a page of its own. */
export function DashboardPage() {
  const text = useText()
  const widgets = useCabin((state) => state.dashboardWidgets)
  const setWidget = useCabin((state) => state.setDashboardWidget)
  const sizes = useCabin((state) => state.dashboardWidgetSizes)
  const setSize = useCabin((state) => state.setDashboardWidgetSize)
  const autoOrder = useCabin((state) => state.autoOrder)
  const setAutoOrder = useCabin((state) => state.setAutoOrder)
  const order = useCabin((state) => state.dashboardOrder)
  const moveWidget = useCabin((state) => state.moveWidget)
  const moveWidgetTo = useCabin((state) => state.moveWidgetTo)
  const applyLayout = useCabin((state) => state.applyDashboardLayout)
  const savedLayouts = useCabin((state) => state.savedDashboardLayouts)
  const saveLayout = useCabin((state) => state.saveDashboardLayout)
  const removeLayout = useCabin((state) => state.removeDashboardLayout)
  const [drag, setDrag] = useState<WidgetDrag | null>(null)
  const press = useRef<WidgetPress | null>(null)
  const resize = useRef<WidgetResize | null>(null)
  const suppressClick = useRef(false)
  const [namingLayout, setNamingLayout] = useState(false)
  const [layoutName, setLayoutName] = useState('')
  const overviewShown = useCabin((state) => state.overviewShown)
  const open = useSettings((state) => state.open)
  const names: Record<DashboardWidget, string> = {
    nowPlaying: text.nowPlaying,
    destination: text.destination,
    driverHours: text.diagnostics.driverHours,
    driver: text.apps.driver,
    weather: text.apps.weather,
    diagnostics: text.apps.diagnostics,
  }
  const sizeNames: Record<DashboardWidgetSize, string> = {
    compact: text.settings.widgetCompact,
    standard: text.settings.widgetStandard,
    expanded: text.settings.widgetExpanded,
  }
  const presetNames: Record<DashboardLayoutPreset, string> = {
    focus: text.settings.presetFocus,
    media: text.settings.presetMedia,
    weather: text.settings.presetWeather,
  }
  // A preset is only shown as current while Auto Order is off: otherwise the drive's order wins over it.
  const activePreset = autoOrder
    ? null
    : (DASHBOARD_PRESETS.find((preset) => matchesDashboardLayout(DASHBOARD_LAYOUTS[preset], order, widgets, sizes)) ??
      null)

  // The card's lower edge resizes it: the pointer's own drag again, stepped through the three sizes as it goes, so the
  // card grows and shrinks under the hand rather than through a row of size buttons beside the picture.
  const startResize = (event: PointerEvent<HTMLSpanElement>, widget: DashboardWidget) => {
    if (event.button !== 0) return
    event.stopPropagation()
    // A release outside the grip can still land as a click on the card: it is not a tap to switch the card.
    suppressClick.current = true
    resize.current = { widget, pointerId: event.pointerId, y: event.clientY, size: sizes[widget] }
  }

  useEffect(() => {
    const move = (event: globalThis.PointerEvent) => {
      const held = resize.current
      if (!held || held.pointerId !== event.pointerId) return
      event.preventDefault()
      const from = DASHBOARD_WIDGET_SIZES.indexOf(held.size)
      const stepped = from + Math.round((event.clientY - held.y) / 26)
      const next = DASHBOARD_WIDGET_SIZES[Math.min(DASHBOARD_WIDGET_SIZES.length - 1, Math.max(0, stepped))]
      if (next && useCabin.getState().dashboardWidgetSizes[held.widget] !== next) setSize(held.widget, next)
    }
    const end = (event: globalThis.PointerEvent) => {
      const held = resize.current
      if (!held || held.pointerId !== event.pointerId) return
      resize.current = null
      window.setTimeout(() => (suppressClick.current = false), 300)
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', end)
    window.addEventListener('pointercancel', end)
    return () => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', end)
      window.removeEventListener('pointercancel', end)
      resize.current = null
    }
  }, [setSize])

  const startWidgetDrag = (event: PointerEvent<HTMLDivElement>, widget: DashboardWidget) => {
    if (event.button !== 0) return
    // Keep the press's moves and release, even when the cursor leaves the card.
    event.currentTarget.setPointerCapture(event.pointerId)
    press.current = { widget, pointerId: event.pointerId, x: event.clientX, y: event.clientY, dragging: false }
  }

  // The pointer's own reorder: no native HTML5 drag, which WebView2 hands to the OS and can lose the cabin's press.
  useEffect(() => {
    const move = (event: globalThis.PointerEvent) => {
      const held = press.current
      if (!held || held.pointerId !== event.pointerId) return
      if (!held.dragging) {
        if (Math.hypot(event.clientX - held.x, event.clientY - held.y) < 8) return
        held.dragging = true
        // Taking a card in hand is editing the player's order: Auto Order would put it back by the drive's needs.
        if (useCabin.getState().autoOrder) setAutoOrder(false)
        setDrag({ widget: held.widget, over: null, after: false })
      }
      event.preventDefault()
      const hit = widgetUnder(event.clientX, event.clientY)
      setDrag((current) => {
        if (!current) return current
        const over = hit && hit.widget !== held.widget ? hit.widget : null
        const after = over ? (hit?.after ?? false) : false
        return current.over === over && current.after === after ? current : { ...current, over, after }
      })
    }
    const up = (event: globalThis.PointerEvent) => {
      const held = press.current
      if (!held || held.pointerId !== event.pointerId) return
      press.current = null
      if (!held.dragging) return
      const hit = widgetUnder(event.clientX, event.clientY)
      if (hit && hit.widget !== held.widget) moveWidgetTo(held.widget, hit.widget, hit.after)
      // The click that follows a drop isn't a press on the card.
      suppressClick.current = true
      window.setTimeout(() => (suppressClick.current = false), 300)
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
  }, [moveWidgetTo, setAutoOrder])

  const saveNamedLayout = () => {
    const kept = layoutName.trim()
    if (!kept) return
    saveLayout(kept)
    setNamingLayout(false)
    setLayoutName('')
  }
  const toggleSaving = () => {
    setNamingLayout((open) => !open)
    setLayoutName('')
  }

  return (
    <Page title={text.settings.dashboard}>
      {/* The column as the Dashboard draws it, and the layout's editor: a tap puts a card on the Dashboard or takes it
          off, a drag moves it, and its lower edge sets its share of the room. The preview is the player's own order;
          dragging turns Auto Order off so that order is the one used. */}
      <Group header={text.settings.widgetLayout} footer={text.settings.widgetLayoutFooter}>
        <div className="dashboard-layout-editor">
          <div className="dashboard-layout-presets" role="group" aria-label={text.settings.widgetPresets}>
            {DASHBOARD_PRESETS.map((preset) => {
              const layout = DASHBOARD_LAYOUTS[preset]
              return (
                <button
                  key={preset}
                  type="button"
                  className="dashboard-layout-preset"
                  aria-pressed={preset === activePreset}
                  onClick={() => applyLayout(layout)}
                >
                  <LayoutShot layout={layout} />
                  <span className="dashboard-preset-copy">
                    <span className={`dashboard-preset-mark ${preset}`} aria-hidden>
                      <PresetGlyph preset={preset} />
                    </span>
                    <span className="dashboard-preset-name">{presetNames[preset]}</span>
                    {preset === activePreset && (
                      <span className="dashboard-preset-check" aria-hidden>
                        <CheckGlyph />
                      </span>
                    )}
                  </span>
                </button>
              )
            })}
          </div>
          {savedLayouts.length > 0 && (
            <div className="dashboard-saved-layouts">
              <p className="dashboard-preset-section-title">{text.settings.yourLayouts}</p>
              <div className="dashboard-layout-presets" role="group" aria-label={text.settings.yourLayouts}>
                {savedLayouts.map(({ name, layout }) => {
                  const active = !autoOrder && matchesDashboardLayout(layout, order, widgets, sizes)
                  return (
                    <div className="dashboard-saved-preset" key={name}>
                      <button
                        type="button"
                        className="dashboard-layout-preset"
                        aria-pressed={active}
                        onClick={() => applyLayout(layout)}
                      >
                        <LayoutShot layout={layout} />
                        <span className="dashboard-preset-copy">
                          <span className="dashboard-preset-mark saved" aria-hidden>
                            <SavedLayoutGlyph />
                          </span>
                          <span className="dashboard-preset-name">{name}</span>
                          {active && (
                            <span className="dashboard-preset-check" aria-hidden>
                              <CheckGlyph />
                            </span>
                          )}
                        </span>
                      </button>
                      <button
                        type="button"
                        className="dashboard-preset-delete"
                        aria-label={`${text.settings.deleteLayout}: ${name}`}
                        title={`${text.settings.deleteLayout}: ${name}`}
                        onClick={() => removeLayout(name)}
                      >
                        <DeletePresetGlyph />
                      </button>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
          <button type="button" className="dashboard-preset-save" aria-expanded={namingLayout} onClick={toggleSaving}>
            <span className="dashboard-preset-save-mark" aria-hidden>
              <PlusGlyph />
            </span>
            <span>{text.settings.saveLayout}</span>
          </button>
          {namingLayout && (
            <div className="dashboard-preset-form">
              <TextField
                id="dashboard-layout-name"
                value={layoutName}
                onChange={(value) => setLayoutName(value.slice(0, DASHBOARD_LAYOUT_NAME_LENGTH))}
                onSubmit={saveNamedLayout}
                hint={text.settings.layoutName}
                label={text.settings.layoutName}
                selectOnShow
              />
              <div className="dashboard-preset-form-actions">
                <button type="button" className="dashboard-preset-form-button" onClick={toggleSaving}>
                  {text.settings.cancel}
                </button>
                <button
                  type="button"
                  className="dashboard-preset-form-button primary"
                  disabled={!layoutName.trim()}
                  onClick={saveNamedLayout}
                >
                  {text.settings.save}
                </button>
              </div>
            </div>
          )}
          <div className="dashboard-layout-preview" role="group" data-own-drag aria-label={text.settings.widgetLayout}>
            <div className="dashboard-preview-map" aria-hidden>
              <span className="dashboard-preview-route" />
              <span className="dashboard-preview-destination" />
              <span className="dashboard-preview-puck" />
            </div>
            {/* Every widget keeps its card in the column, off ones dimmed: the picture is the layout, so a tap on a
                card takes it off the Dashboard or puts it back, a drag moves it, and its lower edge sets its size. */}
            <div
              className={drag ? 'dashboard-preview-column dragging' : 'dashboard-preview-column'}
              role="group"
              aria-label={text.settings.widgets}
            >
              {order.map((widget) => {
                const dragging = drag?.widget === widget
                const dropping = drag?.over === widget && drag.widget !== widget
                return (
                  <div
                    key={widget}
                    role="button"
                    data-widget={widget}
                    data-size={sizes[widget]}
                    data-off={widgets[widget] ? undefined : ''}
                    aria-pressed={widgets[widget]}
                    aria-label={`${names[widget]}, ${sizeNames[sizes[widget]]}, ${
                      widgets[widget] ? text.diagnostics.on : text.diagnostics.off
                    }`}
                    title={`${names[widget]} — ${sizeNames[sizes[widget]]}`}
                    className={[
                      'dashboard-preview-widget',
                      dragging ? 'dragging' : '',
                      dropping ? (drag?.after ? 'drop-after' : 'drop-before') : '',
                    ]
                      .filter(Boolean)
                      .join(' ')}
                    tabIndex={0}
                    aria-keyshortcuts="ArrowUp ArrowDown ArrowLeft ArrowRight Enter Space"
                    onPointerDown={(event) => startWidgetDrag(event, widget)}
                    onKeyDown={(event) => {
                      const key = event.key
                      if (key === 'ArrowUp' || key === 'ArrowDown') {
                        event.preventDefault()
                        // Moving a card by its keys is editing the order: Auto Order would put it back by the drive's needs.
                        if (autoOrder) setAutoOrder(false)
                        moveWidget(widget, key === 'ArrowUp' ? -1 : 1)
                        // The card's place changes with its element's, so the focus goes with it.
                        focusDashboardWidget(widget)
                        return
                      }
                      if (key === 'ArrowLeft' || key === 'ArrowRight') {
                        event.preventDefault()
                        const at = DASHBOARD_WIDGET_SIZES.indexOf(sizes[widget])
                        const stepped = at + (key === 'ArrowLeft' ? -1 : 1)
                        const next =
                          DASHBOARD_WIDGET_SIZES[Math.min(DASHBOARD_WIDGET_SIZES.length - 1, Math.max(0, stepped))]
                        if (next) setSize(widget, next)
                        return
                      }
                      if (key !== 'Enter' && key !== ' ') return
                      event.preventDefault()
                      setWidget(widget, !widgets[widget])
                    }}
                    onClick={() => {
                      // The click that ends a drag is not a tap on the card.
                      if (!suppressClick.current) setWidget(widget, !widgets[widget])
                    }}
                  >
                    <span className="dashboard-preview-icon" aria-hidden>
                      <WidgetGlyph widget={widget} />
                    </span>
                    <span className="dashboard-preview-name">{names[widget]}</span>
                    <span className="dashboard-preview-grip" aria-hidden />
                    <span
                      className="dashboard-preview-resize"
                      aria-hidden
                      onPointerDown={(event) => startResize(event, widget)}
                      onClick={(event) => event.stopPropagation()}
                    />
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      </Group>
      <Group footer={text.settings.autoOrderFooter}>
        <SwitchRow label={text.settings.autoOrder} on={autoOrder} onToggle={setAutoOrder} />
      </Group>
      {/* The Dashboard's second screen: offered or not, and which cards it keeps — a page of its own, so this one
          stays about the widgets beside the map. */}
      <Group footer={text.settings.overviewFooter}>
        <NavRow
          label={text.diagnostics.overview}
          value={overviewShown ? text.diagnostics.on : text.diagnostics.off}
          onOpen={() => open('overview')}
        />
      </Group>
    </Page>
  )
}

/** The Overview's grid as the screen fills it: the speed (drawn first), the trip, the weather, then the truck, the rest
 * clocks and what plays. The order is what makes the picture pack like the screen when a card is taken off. */
const OVERVIEW_PREVIEW_ORDER: readonly OverviewCard[] = ['trip', 'weather', 'truck', 'hours', 'media']

/** The Dashboard's Overview: its second screen, offered or not, opened on, and which of its cards it shows. */
export function OverviewPage() {
  const text = useText()
  const shown = useCabin((state) => state.overviewShown)
  const setShown = useCabin((state) => state.setOverviewShown)
  const openOn = useCabin((state) => state.overviewDefault)
  const setOpenOn = useCabin((state) => state.setOverviewDefault)
  const cards = useCabin((state) => state.overviewCards)
  const setCard = useCabin((state) => state.setOverviewCard)
  const reset = useCabin((state) => state.resetOverview)
  const units = useUnits()
  // A card taken off leaves the grid and one put back leaves the tray: the focus goes with it to the same card's
  // other control, so the switch can be worked again without walking back through the page.
  const editor = useRef<HTMLDivElement | null>(null)
  const pendingFocus = useRef<OverviewCard | null>(null)
  // The speed is the one card the player can't take off: it is the reason the screen is read at a glance.
  const speed = useLive((state) => (state.telemetry ? units.speed(state.telemetry.speed) : 0))
  // The cards' own figures, read as the Dashboard's widgets read them, so the picture carries the drive rather than
  // a sketch of it: where the job goes, what is in the tank, the next rest, what plays, and the sky.
  const destination = useDestinationView()
  const diagnostics = useDiagnosticsView()
  const hours = useDriverHoursView()
  const track = useNowPlayingTrack()
  const weather = useLive((state) => state.weather)
  const wipers = useLive((state) => state.telemetry?.wipers ?? false)
  const weatherNow = weather ? weatherView(weather, 0, null, text, wipers) : null
  // The cards, by the names their pages use (the truck's readings are the Diagnostics page's).
  const names: Record<OverviewCard, string> = {
    trip: text.destination,
    truck: text.apps.diagnostics,
    hours: text.diagnostics.driverHours,
    media: text.nowPlaying,
    weather: text.apps.weather,
  }
  // Each card keeps its Dashboard widget's mark, so the miniature is read the way the Overview is.
  const glyphs: Record<OverviewCard, DashboardWidget> = {
    trip: 'destination',
    truck: 'diagnostics',
    hours: 'driverHours',
    media: 'nowPlaying',
    weather: 'weather',
  }
  // The one figure each card is read for, in the widget's own words; a dash where the game has nothing to say.
  const figures: Record<OverviewCard, string> = {
    trip: destination !== EMPTY ? destination.detail || destination.title : '—',
    truck: diagnostics?.fuel ?? '—',
    hours: hours?.rest ?? '—',
    media: track?.title ?? '—',
    weather: weatherNow?.condition ?? '—',
  }
  // The screen's own order, so a card taken off leaves the same gap here as it does there: the grid packs the rest
  // with dense flow (Glance.tsx), and the picture must pack them the same way.
  const laid = OVERVIEW_PREVIEW_ORDER.filter((card) => cards[card])
  const putAway = OVERVIEW_CARDS.filter((card) => !cards[card])
  useEffect(() => {
    const card = pendingFocus.current
    if (!card) return
    pendingFocus.current = null
    editor.current?.querySelector<HTMLElement>(`[data-overview-card="${card}"]`)?.focus()
    // Run after the commit that moved the card between the grid and the tray, which is what `cards` says.
  }, [cards])
  return (
    <Page title={text.diagnostics.overview}>
      <Group footer={text.settings.overviewFooter}>
        <SwitchRow label={text.settings.overviewScreen} on={shown} onToggle={setShown} />
        {shown && <SwitchRow label={text.settings.openOverview} on={openOn} onToggle={setOpenOn} />}
      </Group>
      {shown && (
        <Group header={text.settings.overviewCards} footer={text.settings.overviewCardsFooter}>
          {/* The grid itself, in miniature: the drive's readings packed as the screen packs them, each live. A tap takes
              a card off; it waits under the picture, so the switch is one tap away and the grid stays truthful. */}
          <div className="overview-layout-editor" ref={editor}>
            <div
              className="overview-layout-preview"
              role="group"
              aria-label={text.settings.overviewCards}
              data-own-drag
            >
              <div
                className="overview-preview-card overview-preview-speed"
                role="note"
                aria-label={`${Math.round(speed)} ${units.labels.speed}`}
              >
                <span className="overview-preview-speed-value">{Math.round(speed)}</span>
                <span className="overview-preview-speed-unit">{units.labels.speed}</span>
              </div>
              {laid.map((card) => (
                <button
                  key={card}
                  type="button"
                  className={`overview-preview-card overview-preview-${card}`}
                  data-overview-card={card}
                  aria-pressed="true"
                  aria-label={`${names[card]}, ${figures[card]}, ${text.diagnostics.on}`}
                  title={figures[card]}
                  onClick={() => {
                    pendingFocus.current = card
                    setCard(card, false)
                  }}
                >
                  <span className="overview-preview-head">
                    <span className="overview-preview-icon" aria-hidden>
                      <WidgetGlyph widget={glyphs[card]} />
                    </span>
                    <span className="overview-preview-name">{names[card]}</span>
                  </span>
                  <span className="overview-preview-figure">{figures[card]}</span>
                </button>
              ))}
            </div>
            {putAway.length > 0 && (
              <div className="overview-preview-tray" role="group" aria-label={text.settings.overviewHidden}>
                <span className="overview-preview-tray-label" aria-hidden>
                  {text.settings.overviewHidden}
                </span>
                {putAway.map((card) => (
                  <button
                    key={card}
                    type="button"
                    className="overview-preview-tray-card"
                    data-overview-card={card}
                    aria-pressed="false"
                    aria-label={`${names[card]}, ${text.diagnostics.off}`}
                    onClick={() => {
                      pendingFocus.current = card
                      setCard(card, true)
                    }}
                  >
                    <span className="overview-preview-icon" aria-hidden>
                      <WidgetGlyph widget={glyphs[card]} />
                    </span>
                    <span>{names[card]}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </Group>
      )}
      <Group>
        <button type="button" className="settings-row settings-action" onClick={reset}>
          {text.settings.resetOverview}
        </button>
      </Group>
    </Page>
  )
}

/** A preset's picture: its map and every card it keeps, at the size it keeps. */
function LayoutShot({ layout }: { layout: DashboardLayout }) {
  return (
    <span className="dashboard-preset-shot" aria-hidden>
      <span className="dashboard-preset-shot-map" />
      <span className="dashboard-preset-shot-column">
        {layout.order
          .filter((widget) => layout.widgets[widget])
          .map((widget) => (
            <i key={widget} data-size={layout.sizes[widget]} />
          ))}
      </span>
    </span>
  )
}

/** A small line mark for each card in the editor's column, in the card's own colour. */
function WidgetGlyph({ widget }: { widget: DashboardWidget }) {
  const line = {
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: '1.8',
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
  }
  if (widget === 'nowPlaying') {
    return (
      <svg viewBox="0 0 24 24" aria-hidden>
        <path {...line} d="M9.5 17.5V6.8l8.5-1.6v10.4" />
        <ellipse cx="7" cy="18" rx="2.5" ry="2" fill="currentColor" />
        <ellipse cx="15.5" cy="16.2" rx="2.5" ry="2" fill="currentColor" />
      </svg>
    )
  }
  if (widget === 'destination') {
    return (
      <svg viewBox="0 0 24 24" aria-hidden>
        <path {...line} d="M12 21s6-5.4 6-11a6 6 0 1 0-12 0c0 5.6 6 11 6 11Z" />
        <circle cx="12" cy="10" r="2.3" fill="currentColor" />
      </svg>
    )
  }
  if (widget === 'driverHours') {
    return (
      <svg viewBox="0 0 24 24" aria-hidden>
        <circle {...line} cx="12" cy="12" r="8.5" />
        <path {...line} d="M12 7.5V12l3.2 2" />
      </svg>
    )
  }
  if (widget === 'driver') {
    return (
      <svg viewBox="0 0 24 24" aria-hidden>
        <circle {...line} cx="12" cy="8" r="3.2" />
        <path {...line} d="M5.5 20c.7-4 3.2-6 6.5-6s5.8 2 6.5 6" />
      </svg>
    )
  }
  if (widget === 'weather') {
    return (
      <svg viewBox="0 0 24 24" aria-hidden>
        <circle {...line} cx="8.2" cy="8" r="3" />
        <path {...line} d="M8.2 2.7v1.2M2.9 8h1.2M4.4 4.2l.9.8M12 4.2l-.9.8" />
        <path {...line} d="M8.5 19.5h8a3.2 3.2 0 0 0 .3-6.4 4.5 4.5 0 0 0-8.4-.4 2.8 2.8 0 0 0 .1 6.8Z" />
      </svg>
    )
  }
  return (
    <svg viewBox="0 0 24 24" aria-hidden>
      <path {...line} d="M4.2 16.5a8 8 0 0 1 15.6 0" />
      <path {...line} d="m12 16.5 4.2-5" />
      <circle cx="12" cy="16.5" r="1.6" fill="currentColor" />
    </svg>
  )
}

/** The marks on the preset buttons: a target for Focus, a play mark for Media, and the weather's sun and cloud. */
function PresetGlyph({ preset }: { preset: DashboardLayoutPreset }) {
  if (preset === 'focus') {
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
        <circle cx="12" cy="12" r="6.5" />
        <circle cx="12" cy="12" r="2.2" fill="currentColor" stroke="none" />
        <path d="M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3" />
      </svg>
    )
  }
  if (preset === 'media') {
    return (
      <svg viewBox="0 0 24 24" fill="currentColor">
        <path d="M8 5.5 19 12 8 18.5Z" />
      </svg>
    )
  }
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="8.5" cy="8" r="3" />
      <path d="M8.5 2.2v1.6M2.7 8h1.6M3.6 3.1l1.1 1.1M13.4 3.1l-1.1 1.1M8.5 13.8v1.4" />
      <path d="M8.5 19.5h8.2a3.3 3.3 0 0 0 .3-6.6 4.6 4.6 0 0 0-8.6-.4 2.9 2.9 0 0 0 .1 7Z" />
    </svg>
  )
}

/** A card held in the preview, before it's moved far enough to be a drag. */
interface WidgetPress {
  widget: DashboardWidget
  pointerId: number
  x: number
  y: number
  dragging: boolean
}

/** A widget being dragged around the preview, and the card it would drop beside. */
interface WidgetDrag {
  widget: DashboardWidget
  over: DashboardWidget | null
  after: boolean
}

/** A card's lower edge held by the pointer: the size it had when taken, and where the hand started. */
interface WidgetResize {
  widget: DashboardWidget
  pointerId: number
  y: number
  size: DashboardWidgetSize
}

/** Focus a preview card by name once the order has been redrawn: a card moved by its keys is a new element in the
 * column, and the focus goes with it. */
function focusDashboardWidget(widget: DashboardWidget): void {
  requestAnimationFrame(() => {
    document.querySelector<HTMLElement>(`.dashboard-preview-widget[data-widget="${widget}"]`)?.focus()
  })
}

/** The preview card under a point, and which half of it the point is on: a drop goes before or after it. */
function widgetUnder(x: number, y: number): { widget: DashboardWidget; after: boolean } | null {
  const element = document.elementFromPoint(x, y)?.closest<HTMLElement>('[data-widget]')
  const widget = element?.dataset.widget as DashboardWidget | undefined
  if (!element || !widget) return null
  const box = element.getBoundingClientRect()
  return { widget, after: y > box.top + box.height / 2 }
}

/** The plus on the save-layout button, the bookmark on a saved layout, and the bin that removes one. */
function PlusGlyph() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
      <path d="M12 5v14M5 12h14" />
    </svg>
  )
}

function SavedLayoutGlyph() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round">
      <path d="M6.5 4.5h11v15L12 16l-5.5 3.5z" />
    </svg>
  )
}

function DeletePresetGlyph() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M5 7h14M9.5 7V4.8h5V7M7.2 7l.8 12h8l.8-12M10 10.5v5M14 10.5v5" />
    </svg>
  )
}

/** Whether the Dashboard is showing exactly this preset's order, widgets and sizes. */
function matchesDashboardLayout(
  layout: DashboardLayout,
  order: DashboardWidget[],
  widgets: Record<DashboardWidget, boolean>,
  sizes: Record<DashboardWidget, DashboardWidgetSize>,
): boolean {
  return (
    layout.order.every((widget, index) => order[index] === widget) &&
    layout.order.every((widget) => layout.widgets[widget] === widgets[widget] && layout.sizes[widget] === sizes[widget])
  )
}
