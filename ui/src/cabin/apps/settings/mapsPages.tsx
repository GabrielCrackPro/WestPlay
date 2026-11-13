import {
  MAP_MARKERS,
  MAP_MARKER_SIZES,
  MAP_NIGHT_STARTS,
  MAP_PIN_STYLES,
  MAP_ROUTE_COLOURS,
  MAP_ROUTE_WEIGHTS,
  MAP_STYLES,
  MAP_TRAFFIC_AROUND,
  type MapMarker,
  type MapMarkerSize,
  type MapPinStyle,
  type MapRouteColour,
  type MapRouteWeight,
  type MapStyle,
} from '../../maps/routeLook'
import { STOP_CARD_FUEL_LEVELS, STOP_CARD_REST_MINUTES } from '../../maps/nearbyStop'
import { MAP_DETAILS, MAP_RECENTRES, type MapDetail, useCabin } from '../../state/store'
import { useText } from '../../state/text'
import { useUnits } from '../../state/units'
import { MapDisplayGlyph, MapPinsGlyph, MapRouteGlyph, MapTrafficGlyph } from './glyphs'
import { ChoiceRows, Group, NavRow, Page, SwitchRow } from './rows'
import { useSettings } from './settings'

/** The words the map's settings read from (the text store's). */
type Words = ReturnType<typeof useText>

function mapStyleNames(text: Words): Record<MapStyle, string> {
  const words = text.destinations
  return { standard: words.mapStyleStandard, satellite: words.mapStyleSatellite, terrain: words.mapStyleTerrain }
}

/** The map's words for each choice: they live across the app's own words and the destinations'. */
function detailNames(text: Words): Record<MapDetail, string> {
  return { high: text.settings.high, balanced: text.destinations.mapBalanced, low: text.settings.low }
}

function routeColourNames(text: Words): Record<MapRouteColour, string> {
  const words = text.destinations
  return { blue: words.routeBlue, teal: words.routeTeal, purple: words.routePurple, amber: words.routeAmber }
}

function routeWeightNames(text: Words): Record<MapRouteWeight, string> {
  const words = text.destinations
  return { thin: words.weightThin, standard: words.weightStandard, bold: words.weightBold }
}

function markerShapeNames(text: Words): Record<MapMarker, string> {
  const words = text.destinations
  return { arrow: words.markerArrow, dot: words.markerDot, truck: words.markerTruck }
}

function markerSizeNames(text: Words): Record<MapMarkerSize, string> {
  const words = text.destinations
  return { small: words.sizeSmall, medium: words.sizeMedium, large: words.sizeLarge }
}

function pinStyleNames(text: Words): Record<MapPinStyle, string> {
  const words = text.destinations
  return { filled: words.pinFilled, outlined: words.pinOutlined }
}

/**
 * Maps: the live map's settings, in five pages of their own — what it draws and how it comes back to the truck,
 * the traffic and the camera on the road, the route's line, the markers and pins, and the stop card under
 * turn-by-turn. This page is the way in, each row saying what it is set to now, as the Settings list says its own
 * rows.
 */
export function MapsPage() {
  const text = useText()
  const words = text.destinations
  const open = useSettings((state) => state.open)
  const detail = useCabin((state) => state.mapDetail)
  const traffic = useCabin((state) => state.mapTraffic)
  const route = useCabin((state) => state.mapRoute)
  const weight = useCabin((state) => state.mapWeight)
  const pins = useCabin((state) => state.mapPins)
  const stopCardAlways = useCabin((state) => state.mapStopCardAlways)
  const stopCardFuel = useCabin((state) => state.mapStopCardFuel)
  const stopCardRest = useCabin((state) => state.mapStopCardRest)
  return (
    <Page title={text.apps.maps}>
      <Group>
        <NavRow
          tile="var(--apple-blue)"
          icon={<MapDisplayGlyph />}
          label={text.settings.mapsDisplay}
          value={detailNames(text)[detail]}
          onOpen={() => open('mapDisplay')}
        />
        <NavRow
          tile="var(--apple-orange)"
          icon={<MapTrafficGlyph />}
          label={words.mapTraffic}
          value={traffic ? text.diagnostics.on : text.diagnostics.off}
          onOpen={() => open('mapTraffic')}
        />
        <NavRow
          tile="var(--apple-purple)"
          icon={<MapRouteGlyph />}
          label={text.settings.mapsRoute}
          value={`${routeWeightNames(text)[weight]} · ${routeColourNames(text)[route]}`}
          onOpen={() => open('mapRoute')}
        />
        <NavRow
          tile="var(--apple-red)"
          icon={<MapPinsGlyph />}
          label={text.settings.mapsMarkers}
          value={pinStyleNames(text)[pins]}
          onOpen={() => open('mapMarkers')}
        />
        <NavRow
          tile="var(--apple-yellow)"
          icon={<StopCardGlyph />}
          label={text.settings.stopCard}
          value={stopCardAlways ? text.diagnostics.on : `${stopCardFuel}% · ${text.minutes(stopCardRest)}`}
          onOpen={() => open('mapStopCard')}
        />
      </Group>
    </Page>
  )
}

/**
 * Display: how much map there is to see (the detail it draws, and the game's night with the hour it dims from), the
 * controls on the map's own face — a card of their own, headed, so a driver looking for the compass needn't read
 * every switch — and how long a map the player moved stays put before it comes back to the truck.
 */
export function MapDisplayPage() {
  const text = useText()
  const words = text.destinations
  const detail = useCabin((state) => state.mapDetail)
  const setDetail = useCabin((state) => state.setMapDetail)
  const style = useCabin((state) => state.mapStyle)
  const setStyle = useCabin((state) => state.setMapStyle)
  const night = useCabin((state) => state.mapNight)
  const setNight = useCabin((state) => state.setMapNight)
  const nightStart = useCabin((state) => state.mapNightStart)
  const setNightStart = useCabin((state) => state.setMapNightStart)
  const north = useCabin((state) => state.mapNorth)
  const setNorth = useCabin((state) => state.setMapNorth)
  const limit = useCabin((state) => state.mapLimit)
  const setLimit = useCabin((state) => state.setMapLimit)
  const over = useCabin((state) => state.mapOver)
  const setOver = useCabin((state) => state.setMapOver)
  const compass = useCabin((state) => state.mapCompass)
  const setCompass = useCabin((state) => state.setMapCompass)
  const scale = useCabin((state) => state.mapScale)
  const setScale = useCabin((state) => state.setMapScale)
  const recentre = useCabin((state) => state.mapRecentre)
  const setRecentre = useCabin((state) => state.setMapRecentre)
  const details = detailNames(text)
  const styles = mapStyleNames(text)
  return (
    <Page title={text.settings.mapsDisplay}>
      <ChoiceRows
        header={words.mapDetail}
        radio={words.mapDetail}
        options={MAP_DETAILS.map((each) => ({ id: each, label: details[each] }))}
        value={detail}
        onPick={setDetail}
      />
      <ChoiceRows
        header={words.mapStyle}
        radio={words.mapStyle}
        options={MAP_STYLES.map((each) => ({ id: each, label: styles[each] }))}
        value={style}
        onPick={setStyle}
      />
      {/* The night switch and the hour it starts at, side by side on the page: the choice under the switch is that
          switch's own, so the pair reads as one thing rather than two. */}
      <Group>
        <SwitchRow label={words.mapNight} on={night} onToggle={setNight} />
      </Group>
      {/* When the night's dimming starts, with the night it belongs to: a choice that means nothing while the
          dimming is off, so it arrives with the switch. */}
      {night && (
        <ChoiceRows
          header={words.mapNightFrom}
          radio={words.mapNightFrom}
          options={MAP_NIGHT_STARTS.map((hour) => ({
            id: hour,
            label: `${String(hour).padStart(2, '0')}:00`,
          }))}
          value={nightStart}
          onPick={setNightStart}
        />
      )}
      <Group header={text.settings.mapControls}>
        <SwitchRow label={words.mapNorth} on={north} onToggle={setNorth} />
        <SwitchRow label={words.mapLimit} on={limit} onToggle={setLimit} />
        <SwitchRow label={words.mapOver} on={over} onToggle={setOver} />
        <SwitchRow label={words.mapCompass} on={compass} onToggle={setCompass} />
        <SwitchRow label={words.mapScale} on={scale} onToggle={setScale} />
      </Group>
      <ChoiceRows
        header={words.mapRecentre}
        radio={words.mapRecentre}
        options={MAP_RECENTRES.map((seconds) => ({
          id: seconds,
          label: seconds === 0 ? words.mapNever : `${seconds} s`,
        }))}
        value={recentre}
        onPick={setRecentre}
      />
    </Page>
  )
}

/**
 * Traffic: what the map draws of the road around the truck — the camera easing out at junctions, other players'
 * trucks, and the traffic — and how far around the traffic is drawn when no route is driven (in single player it's
 * estimated, as the game tells nothing of its AI traffic).
 */
export function MapTrafficPage() {
  const text = useText()
  const units = useUnits()
  const words = text.destinations
  const junction = useCabin((state) => state.mapJunction)
  const setJunction = useCabin((state) => state.setMapJunction)
  const trucks = useCabin((state) => state.mapTrucks)
  const setTrucks = useCabin((state) => state.setMapTrucks)
  const traffic = useCabin((state) => state.mapTraffic)
  const setTraffic = useCabin((state) => state.setMapTraffic)
  const around = useCabin((state) => state.mapTrafficAround)
  const setAround = useCabin((state) => state.setMapTrafficAround)
  return (
    <Page title={words.mapTraffic}>
      <Group>
        <SwitchRow label={words.mapJunction} on={junction} onToggle={setJunction} />
        <SwitchRow label={words.mapTrucks} on={trucks} onToggle={setTrucks} />
        <SwitchRow label={words.mapTraffic} on={traffic} onToggle={setTraffic} />
      </Group>
      {/* How far around the truck its traffic is drawn: a choice about the traffic, so it is offered with it, and
          not while the traffic is switched off. */}
      {traffic && (
        <ChoiceRows
          header={words.mapTraffic}
          radio={words.mapTraffic}
          options={MAP_TRAFFIC_AROUND.map((metres) => ({
            id: metres,
            label: metres === 0 ? words.mapNever : units.longDistance(metres / 1000, text.decimal),
          }))}
          value={around}
          onPick={setAround}
        />
      )}
    </Page>
  )
}

/** Route: the line the map draws to the destination, in its colour and its weight. */
export function MapRoutePage() {
  const text = useText()
  const words = text.destinations
  const route = useCabin((state) => state.mapRoute)
  const setRoute = useCabin((state) => state.setMapRoute)
  const weight = useCabin((state) => state.mapWeight)
  const setWeight = useCabin((state) => state.setMapWeight)
  const colours = routeColourNames(text)
  const weights = routeWeightNames(text)
  return (
    <Page title={text.settings.mapsRoute}>
      <ChoiceRows
        header={words.routeColour}
        radio={words.routeColour}
        options={MAP_ROUTE_COLOURS.map((each) => ({ id: each, label: colours[each] }))}
        value={route}
        onPick={setRoute}
      />
      <ChoiceRows
        header={words.routeWeight}
        radio={words.routeWeight}
        options={MAP_ROUTE_WEIGHTS.map((each) => ({ id: each, label: weights[each] }))}
        value={weight}
        onPick={setWeight}
      />
    </Page>
  )
}

/** Markers and Pins: the truck's own mark on the map, and the places it draws of its own. */
export function MapMarkersPage() {
  const text = useText()
  const words = text.destinations
  const marker = useCabin((state) => state.mapMarker)
  const setMarker = useCabin((state) => state.setMapMarker)
  const markerSize = useCabin((state) => state.mapMarkerSize)
  const setMarkerSize = useCabin((state) => state.setMapMarkerSize)
  const pins = useCabin((state) => state.mapPins)
  const setPins = useCabin((state) => state.setMapPins)
  const pinFuel = useCabin((state) => state.mapPinFuel)
  const setPinFuel = useCabin((state) => state.setMapPinFuel)
  const pinParking = useCabin((state) => state.mapPinParking)
  const setPinParking = useCabin((state) => state.setMapPinParking)
  const pinService = useCabin((state) => state.mapPinService)
  const setPinService = useCabin((state) => state.setMapPinService)
  const shapes = markerShapeNames(text)
  const sizes = markerSizeNames(text)
  const pinNames = pinStyleNames(text)
  return (
    <Page title={text.settings.mapsMarkers}>
      <ChoiceRows
        header={words.marker}
        radio={words.marker}
        options={MAP_MARKERS.map((each) => ({ id: each, label: shapes[each] }))}
        value={marker}
        onPick={setMarker}
      />
      <ChoiceRows
        header={words.markerSize}
        radio={words.markerSize}
        options={MAP_MARKER_SIZES.map((each) => ({ id: each, label: sizes[each] }))}
        value={markerSize}
        onPick={setMarkerSize}
      />
      <ChoiceRows
        header={words.pinStyle}
        radio={words.pinStyle}
        options={MAP_PIN_STYLES.map((each) => ({ id: each, label: pinNames[each] }))}
        value={pins}
        onPick={setPins}
      />
      <Group>
        <SwitchRow label={words.pinsFuel} on={pinFuel} onToggle={setPinFuel} />
        <SwitchRow label={words.pinsParking} on={pinParking} onToggle={setPinParking} />
        <SwitchRow label={words.pinsService} on={pinService} onToggle={setPinService} />
      </Group>
    </Page>
  )
}

/**
 * Stop Card: the card under turn-by-turn (NearbyStopCard.tsx) — always on the map, or only as the tank or the
 * driver's hours run low, at the level or time chosen.
 */
export function MapStopCardPage() {
  const text = useText()
  const always = useCabin((state) => state.mapStopCardAlways)
  const setAlways = useCabin((state) => state.setMapStopCardAlways)
  const fuel = useCabin((state) => state.mapStopCardFuel)
  const setFuel = useCabin((state) => state.setMapStopCardFuel)
  const rest = useCabin((state) => state.mapStopCardRest)
  const setRest = useCabin((state) => state.setMapStopCardRest)
  return (
    <Page title={text.settings.stopCard}>
      <Group footer={text.settings.stopCardFooter}>
        <SwitchRow label={text.settings.stopCardAlways} on={always} onToggle={setAlways} />
      </Group>
      {!always && (
        <>
          <ChoiceRows
            header={text.settings.stopCardFuel}
            radio={text.settings.stopCardFuel}
            options={STOP_CARD_FUEL_LEVELS.map((level) => ({ id: level, label: `${level}%` }))}
            value={fuel}
            onPick={setFuel}
          />
          <ChoiceRows
            header={text.settings.stopCardRest}
            radio={text.settings.stopCardRest}
            options={STOP_CARD_REST_MINUTES.map((minutes) => ({ id: minutes, label: text.minutes(minutes) }))}
            value={rest}
            onPick={setRest}
          />
        </>
      )}
    </Page>
  )
}

/** The Stop Card row's tile glyph: the filling station's pump, in white on the yellow tile. */
function StopCardGlyph() {
  return (
    <svg
      viewBox="0 0 24 24"
      width="25"
      height="25"
      fill="none"
      stroke="#fff"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M5.5 21V5.5A2.5 2.5 0 0 1 8 3h4a2.5 2.5 0 0 1 2.5 2.5V21" />
      <path d="M3 21h14" />
      <path d="M7.8 6.4h4.4v3.9H7.8Z" />
      <path d="M14.5 9.5h1.7a1.6 1.6 0 0 1 1.6 1.6v5.7a2 2 0 0 0 4 0v-7.2L18.2 5.8" />
    </svg>
  )
}
