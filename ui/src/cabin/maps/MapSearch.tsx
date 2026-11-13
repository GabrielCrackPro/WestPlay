import { useEffect, useRef, useState } from 'react'
import { SearchGlyph } from '../keyboard/glyphs'
import { useKeyboard } from '../keyboard/store'
import { TextField } from '../keyboard/TextField'
import { useLive } from '../state/store'
import { useText } from '../state/text'
import { Destinations } from './Destinations'
import { guidanceOf } from './guidance'
import { setPlaceTap } from './liveMap'
import { useMapPanel } from './mapPanel'
import { usePlacePick } from './placePick'
import { usePlaces } from './places'
import { nearestPlace } from './tapPick'

/** How long the word that the game took a change stays over the map, ms. */
const CONFIRMATION_MS = 2500
/** How long to wait after the player stops typing before searching, ms. */
const SEARCH_DEBOUNCE_MS = 300
/** Must match the panel's closing animation in maps.css: how long it takes to shrink back, ms. */
const CLOSING_MS = 280
const FIELD = 'map-search'

/**
 * Maps' search, always at hand: a button over the map's top left, where CarPlay keeps it, or its top right
 * while a route is guided (the turn-by-turn banner has the left), since a route can still take more stops
 * (the game's waypoints, put in order by the game). It opens Destinations (Destinations.tsx) under the search
 * field, selected, the keyboard up: the panel grows out of the button, and shrinks back into it when it closes.
 * A change the game takes closes it, with a word over the map.
 */
export function MapSearch() {
  const text = useText()
  const [phase, setPhase] = useState<'closed' | 'open' | 'closing'>('closed')
  // Grows from where its button is: the map's top left, or top right beside the turn-by-turn banner. Open, it
  // stays on that side: Go hands the route to the game, whose route comes, goes and comes back as it takes it
  // (the hand-over), and the panel jumped from side to side with it (owner 2026-10-21).
  const [openedRight, setOpenedRight] = useState(false)
  const [rawQuery, setRawQuery] = useState('')
  // Debounced query: the search results update only after the player stops typing.
  const [query, setQuery] = useState('')
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined)
  const setDebouncedQuery = (value: string) => {
    setRawQuery(value)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    if (value.trim()) {
      debounceRef.current = setTimeout(() => setQuery(value), SEARCH_DEBOUNCE_MS)
    } else {
      setQuery('')
    }
  }
  useEffect(() => () => { if (debounceRef.current) clearTimeout(debounceRef.current) }, [])
  const [confirmation, setConfirmation] = useState<{ text: string; id: number } | null>(null)
  const typing = useKeyboard((state) => state.field?.id === FIELD)
  const guided = useLive(({ route, routeNext, telemetry }) => {
    return (
      route !== null &&
      guidanceOf(route.distances, route.maneuvers, routeNext, telemetry?.navigationDistance ?? 0) !== null
    )
  })

  // A tap on the map: the place it landed on, its card. The panel opens for it and Destinations shows it (the
  // card is where a place is added to the route, so a tap on the map is a way to route somewhere, as on a phone).
  const places = usePlaces()
  // A pick is an outside event (a map tap, a stop): the panel opens on it as it happens, rather than watching the
  // store's value and setting state from an effect.
  useEffect(() => {
    return usePlacePick.subscribe((state) => {
      if (!state.picked) return
      // On the side the search button has, away from the turn-by-turn banner; and the Stops page gives way, since one
      // panel stands over the map at a time (StopsPage.tsx).
      setOpenedRight(guided)
      setPhase('open')
      useMapPanel.getState().show('search')
    })
  }, [guided])
  useEffect(() => {
    setPlaceTap((at, within) => {
      const place = nearestPlace(places, at, within)
      if (!place) return false
      usePlacePick.getState().pick(place)
      return true
    })
    return () => setPlaceTap(null)
  }, [places])
  useEffect(() => {
    if (!confirmation) return
    const timer = setTimeout(() => setConfirmation(null), CONFIRMATION_MS)
    return () => clearTimeout(timer)
  }, [confirmation])

  useEffect(() => {
    if (phase !== 'closing') return
    const timer = setTimeout(() => {
      setPhase('closed')
      setRawQuery('')
      setQuery('')
      // Gone from the map only now that it has shrunk away: the Stops button comes back with it (maps.css) rather
      // than appearing over the panel as it closes.
      if (useMapPanel.getState().open === 'search') useMapPanel.getState().show(null)
    }, CLOSING_MS)
    return () => clearTimeout(timer)
  }, [phase])

  // Leaving the app with the panel open: the map has no panel (and its Stops button comes back).
  useEffect(
    () => () => {
      if (useMapPanel.getState().open === 'search') useMapPanel.getState().show(null)
    },
    [],
  )

  const close = () => {
    useKeyboard.getState().detach(FIELD)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    setPhase('closing')
  }
  const side = openedRight ? ' right' : ''

  return (
    <>
      {phase !== 'closed' ? (
        <div className={`map-search glass${side}${typing ? ' typing' : ''}${phase === 'closing' ? ' closing' : ''}`}>
          <div className="map-search-top">
            <TextField
              id={FIELD}
              value={rawQuery}
              onChange={setDebouncedQuery}
              returnKind="search"
              hint={text.searchPlaces}
              label={text.search}
              icon={<SearchGlyph />}
              selectOnShow={phase === 'open'}
            />
            <button type="button" className="map-search-close" aria-label={text.close} onClick={close}>
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="m7 7 10 10M17 7 7 17" />
              </svg>
            </button>
          </div>
          <div className="destinations">
            <Destinations
              query={query}
              field={FIELD}
              onDone={(message) => {
                close()
                setConfirmation({ text: message, id: Date.now() })
              }}
            />
          </div>
        </div>
      ) : (
        <button
          type="button"
          className={guided ? 'map-search-button glass guided' : 'map-search-button glass'}
          aria-label={text.search}
          onClick={() => {
            setOpenedRight(guided)
            setPhase('open')
            // One panel over the map at a time: the Stops page puts itself away when the search opens (StopsPage.tsx).
            useMapPanel.getState().show('search')
          }}
        >
          <SearchGlyph />
        </button>
      )}
      {confirmation && (
        <div key={confirmation.id} className="map-confirmation glass" role="status">
          {confirmation.text}
        </div>
      )}
    </>
  )
}
