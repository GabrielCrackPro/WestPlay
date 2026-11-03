import maplibregl, { type GeoJSONSource } from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import workerUrl from 'maplibre-gl/dist/maplibre-gl-csp-worker.js?url'
import { mapFrameDue } from './frameCap'
import { create as createStore } from 'zustand'
import { formatTripDistance } from '../../shared/format'
import { cabClock, type JobInfo, type Telemetry } from '../../shared/host'
import type { Appearance } from '../state/appearance'
import { type LiveState, type MapDetail, useCabin, useLive } from '../state/store'
import { MAP_FPS } from './frameCap'
import { languageOf, STRINGS, type Strings } from '../state/strings'
import { textScale } from '../state/textSize'
import {
  bearingOf,
  blendPose,
  type CameraPose,
  clampZoomOffset,
  damp,
  dampBearing,
  easeInOut,
  FOLLOW_DELAY_MS,
  GLIDE_MS,
  samePose,
  type TruckSample,
  truckAt,
  zoomForSpeed,
  zoomOffsetFor,
} from './camera'
import { buildingFilter, type Canopy, canopiesOver } from './buildings'
import { labelLines, placeLabels } from './labels'
import { drawPlaceIcon, parsePlaceIcon } from './placeIcons'
import type { MapData } from './mapData'
import { loadView, type SavedView, saveView } from './mapView'
import { jobPlace, loadPlaces } from './places'
import { fromLngLat, labelRange, metresBetween, toLngLat } from './projection'
import {
  approachLine,
  headLine,
  type Point,
  routeAhead,
  type Progress,
  progressOf,
  type RaisedRoad,
  restLine,
  routeLevels,
  routeSpans,
  snapToRoute,
  type Spans,
} from './route'
import { guidanceOf } from './guidance'
import { type PinPlace, pinFeatures } from './nearbyPins'
import type { MapMarker } from './routeLook'
import {
  BUILDING_LAYER,
  MAP_SOURCE,
  mapStyle,
  NEARBY_SOURCE,
  OFFERED_SOURCE,
  PLAYERS_SOURCE,
  paintFor,
  placeImagesFor,
  placeKindFilter,
  ROUTE_HEAD_SOURCE,
  ROUTE_SOURCE,
  routeOverrides,
  TRAFFIC_SOURCE,
} from './style'
import { estimatedTraffic } from './estimatedTraffic'
import { corridorOf, type TrafficStretch, trafficAlong } from './traffic'
import { setMapView, setRouteAhead, useTruckersMp } from './truckersmp'
import { type Area, type OtherPlayer, trackAt } from './truckersmpFeed'

/**
 * The one live map of the page. It's made once and moved between the screens that show it (the
 * Dashboard's map tile, the Maps app), so opening either is instant: no new WebGL context, no parsing
 * the map again, and the camera carries on where it was.
 *
 * It follows the truck. In the Maps app the player can also move it (holding the interaction key): drag
 * to pan, right-drag to turn, the wheel or the zoom buttons to zoom. Moving it leaves the truck behind
 * (browsing) until the recentre button, or a while without touching it, glides it back; zooming while
 * following only brings the following camera closer or further.
 */

// MapLibre's worker as its own file: the copy inlined in its main bundle never starts once Vite has
// pre-bundled it.
maplibregl.setWorkerUrl(workerUrl)

/** The driving view's tilt, degrees. */
const PITCH = 52
/** The truck sits this far down the map (share of its height above it), leaving the road ahead in view. */
const PUCK_FROM_TOP = 0.66
/** How quickly the map turns after the truck (ms): slow enough to feel calm, quick enough to keep up. */
const BEARING_TAU_MS = 450
const ZOOM_TAU_MS = 1500
const SAMPLES_KEPT = 8
/** Place names' type size (a second line smaller: labelLines; both times the player's text size,
 * `nameScale`), and halo (maps.css), and the space kept between two names, pixels. */
const LABEL_SIZE = 26
const LABEL_SECOND_SIZE = 20
const LABEL_HALO = 4
const LABEL_GAP = 16
/** How much the player's text size scales the map's names (state/textSize.ts). */
const nameScale = () => textScale(useCabin.getState().textSize)
/** How long the text size stays put before the map's names follow it, ms. */
const TEXT_SIZE_SETTLE_MS = 350
/** Stops the map following the text size (the map's own, let go of when this module is replaced in
 * development: the store outlives it). */
let stopTextSize: (() => void) | undefined
/** Zoom levels per wheel notch (120 units). */
const WHEEL_ZOOM = 0.5
const MIN_ZOOM = 9
const MAX_ZOOM = 19.5
/** How far the truck moves along the route before the route's head is drawn again from it, metres. */
const ROUTE_HEAD_STEP = 0.5
/** How often, at most, the raised roads are read again from the tiles as they load, ms. */
const RAISED_EVERY_MS = 500

type Mode = 'follow' | 'browse' | 'return'

interface LiveMap {
  data: MapData
  map: maplibregl.Map
  /** The map's own container, moved into whichever screen shows it. */
  element: HTMLDivElement
  puck: maplibregl.Marker
  /** The end of the route, or while a job is on, its own end (the crate's pickup, the dock's drop). */
  destination: maplibregl.Marker
  /** The marker's badge (a flag or a crate) and the name under it (the job's company and city). */
  destinationBadge: HTMLElement
  destinationName: HTMLElement
  /** The chip at the map's edge pointing at a destination off screen, its arrow and its distance. */
  edge: HTMLElement
  edgeArrow: HTMLElement
  edgeAway: HTMLElement
  /** Where the route last ended for the job end being shown (`key`: [destinationKey]; `null` before it first
   * ends): kept when the game takes the route away at the yard, so the dock stays marked. */
  jobEnd: { key: string; at: [number, number] | null }
  /** The job's own end found on the map instead (places.ts), while there's no route to take it from. */
  jobPlace: { key: string; at: [number, number] | null }
  /** Where the destination marker is shown now, and for what (`null`: not on the map). */
  destinationShown: { at: [number, number]; key: string } | null
  /** The route drawn (`route`, as the store has it), as spans, with the span the rest of it is drawn after
   * and where its head was last drawn from (`null`: not drawn yet). */
  routeShown: { route: LiveState['route']; spans: Spans; restAfter: number | null; headFrom: Point | null } | null
  /** Where the truck is along the route this frame (`null`: no route). */
  progress: Progress | null
  /** The raised road stretches in the tiles loaded (bridges: the route on one is drawn over the road
   * beneath), what they were read as (to tell when they change), whether tiles have loaded since, and when
   * they were last read. */
  raised: { roads: RaisedRoad[]; read: string; stale: boolean; at: number }
  /** The canopies the truck is under, left out of the raised buildings (their ids, joined), and when they
   * were last looked for. */
  canopies: { hidden: string; at: number }
  /** Place names, most important first, with their size on screen. */
  labels: { marker: maplibregl.Marker; at: [number, number]; width: number; height: number }[]
  /** The appearance the page wants, and the one the map is painted in (they differ until it's restyled). */
  wanted: Appearance
  painted: Appearance
  /** The owned garages' cities the place icons show as the player's (`null`: not applied yet). */
  garagesShown: string | null
  /** TruckersMP's other players: how many were last drawn, when, and when the part of the map shown was last
   * told the reader. */
  playersShown: number
  playersDrawn: number
  viewTold: number
  /** Under TruckersMP, driving a route: the route ahead (its traffic shown on it), when it was last worked
   * out, and the read of the trucks along it last shown (`null`: to show anew). */
  ahead: Point[] | null
  aheadTold: number
  aheadShown: readonly OtherPlayer[] | null
  /** In single player, the game's time (minutes, to the quarter hour) the estimate on the route ahead was drawn
   * for (`null`: to draw). */
  aheadEstimate: number | null
  /** The traffic found on the route ahead (traffic.ts, or the estimate), and that found on the roads around the
   * truck when no route is driven (estimatedTraffic.ts): both drawn together. */
  routeTraffic: readonly TrafficStretch[]
  nearbyTraffic: readonly TrafficStretch[]
  /** What the roads around the truck were last looked at for (the hour, the radius, where the truck was), and
   * when. */
  nearbyKey: string | null
  nearbyTold: number
  /** The following camera's damped bearing and zoom. */
  camera: { bearing: number; zoom: number } | null
  mode: Mode
  /** Whether the screen showing it lets the player move it (the Maps app). */
  interactive: boolean
  /** A mouse button is held on the map: a drag may be starting, which moving the camera would cancel. */
  pressed: boolean
  /** When the player last moved the map, ms. */
  touched: number
  /** Showing the routes offered before Go (Directions): the map stays on them, not back on the truck. */
  overview: boolean
  /** Picks one of the routes offered, by its index, as its line on the map is tapped (`null`: none offered). */
  offeredPick: ((index: number) => void) | null
  /** How far the player zoomed the following camera from its speed zoom. */
  zoomOffset: number
  /** The zoom when browsing began: a different zoom when it ends is one the player chose, and kept. */
  browsedFrom: number
  /** The glide back onto the truck: where it set off from, and when. */
  glide: { from: CameraPose; fromTop: number; started: number } | null
  /** Following north up, from above (the compass tapped), rather than behind the truck; the arrow brings the
   * chase view back. */
  northUp: boolean
  /** The view the place names were last placed for (`null`: place them again). */
  labelsPlacedFor: string | null
  /** The view as last kept (mapView.ts), and when it was last looked at. */
  kept: string
  keptAt: number
  /** The Map detail and layer choices last applied (Settings › Maps). */
  settingsShown: string
  /** The route's colour and weight and the truck's marker last drawn (Settings › Maps). */
  lookShown: string
  /** The pins' style and kinds last applied (Settings › Maps). */
  pinsShown: string
  /** The scale bar, while it's on the map (Settings › Maps). */
  scale: maplibregl.ScaleControl | null
}

/** Whether the map is browsing (moved away from the truck): the Maps app shows its recentre button. */
/** Whether the map is showing the whole route from above (the Maps app's button says so). */
export const useMapBrowsing = createStore<{ browsing: boolean; overview: boolean }>()(() => ({
  browsing: false,
  overview: false,
}))

/** Those following the map's bearing (the compass), told each time it turns. */
const bearingListeners = new Set<(bearing: number) => void>()

function tellBearing(bearing: number) {
  for (const listener of bearingListeners) listener(bearing)
}

/** Follows the map's bearing (degrees clockwise from north): told it now, and each time the map turns.
 * Returns the function that stops it. */
export function followBearing(listener: (bearing: number) => void): () => void {
  bearingListeners.add(listener)
  listener(live?.map.getBearing() ?? 0)
  return () => bearingListeners.delete(listener)
}

let live: LiveMap | null = null

/** The truck's recent positions, kept from the first map onwards so the camera never starts cold. */
const samples: TruckSample[] = []
let collecting = false

function collectSamples() {
  if (collecting) return
  collecting = true
  const add = (telemetry: Telemetry) => {
    samples.push({
      time: performance.now(),
      x: telemetry.x,
      z: telemetry.z,
      heading: telemetry.heading,
      speed: telemetry.speed,
    })
    if (samples.length > SAMPLES_KEPT) samples.shift()
  }
  // Where the truck is now: the host only sends telemetry when it changes, so a parked truck may send
  // nothing more for a long while.
  const current = useLive.getState().telemetry
  if (current) add(current)
  useLive.subscribe((state, previous) => {
    if (state.telemetry && state.telemetry !== previous.telemetry) add(state.telemetry)
  })
}

function create(data: MapData, appearance: Appearance): LiveMap {
  const element = document.createElement('div')
  element.className = 'road-map'
  const map = new maplibregl.Map({
    container: element,
    style: mapStyle(appearance, data),
    center: data.centre,
    zoom: 15,
    pitch: PITCH,
    maxPitch: 70,
    minZoom: MIN_ZOOM,
    maxZoom: MAX_ZOOM,
    // Gestures are switched on only where the map can be moved (setInteractive).
    interactive: false,
    // Turning (right-drag) keeps the tilt.
    pitchWithRotate: false,
    attributionControl: false,
    fadeDuration: 0,
    canvasContextAttributes: { antialias: true },
  })

  // Added to the map when in range and clear of more important names (showLabels). Each says what
  // labelLines gives: the name in the player's language, under the place's own where that's in another
  // script.
  const measure = document.createElement('canvas').getContext('2d')
  const fontFamily = getComputedStyle(document.body).fontFamily
  const font = (size: number) => `600 ${size}px ${fontFamily}`
  const textWidth = (text: string, size: number) => {
    if (!measure) return text.length * size * 0.6
    measure.font = font(size)
    return measure.measureText(text).width
  }
  const lines = [...data.labels]
    .sort((a, b) => b.population - a.population)
    .map((label) => ({ label, ...labelLines(label.name, label.localized) }))
  const measured = ({ first, second }: { first: string; second: string | null }) => {
    const [size, secondSize] = [LABEL_SIZE * nameScale(), LABEL_SECOND_SIZE * nameScale()]
    return {
      width: Math.max(textWidth(first, size), second ? textWidth(second, secondSize) : 0) + LABEL_HALO * 2,
      height: (size + (second ? secondSize : 0)) * 1.2 + LABEL_HALO * 2,
    }
  }
  const labels = lines.map(({ label, first, second }) => {
    const element = document.createElement('div')
    element.className = `map-label map-label-${label.kind}`
    const line = (text: string, className: string) => {
      const span = document.createElement('span')
      span.className = className
      span.textContent = text
      element.append(span)
    }
    line(first, 'map-label-first')
    if (second) line(second, 'map-label-second')
    const marker = new maplibregl.Marker({ element, pitchAlignment: 'viewport', rotationAlignment: 'viewport' })
    return { marker: marker.setLngLat(label.at), at: label.at, ...measured({ first, second }) }
  })
  // Measured again once the type for every name is in: the fonts for other scripts load only when a page
  // first needs them, and until then the sizes are a fallback font's.
  const allText = lines.map(({ first, second }) => `${first} ${second ?? ''}`).join(' ')
  Promise.all([document.fonts.load(font(LABEL_SIZE), allText), document.fonts.load(font(LABEL_SECOND_SIZE), allText)])
    .then(() => {
      lines.forEach((line, index) => Object.assign(labels[index], measured(line)))
      created.labelsPlacedFor = null
    })
    .catch(() => {})

  const puckElement = document.createElement('div')
  puckElement.className = 'map-puck'
  puckElement.innerHTML =
    '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 4.5 18 19l-6-3.2L6 19Z" fill="currentColor"/></svg>'
  const puck = new maplibregl.Marker({ element: puckElement, pitchAlignment: 'viewport', rotationAlignment: 'map' })
  const destinationElement = document.createElement('div')
  destinationElement.className = 'map-destination'
  destinationElement.dataset.kind = 'delivery'
  const destinationBadge = document.createElement('div')
  destinationBadge.className = 'map-destination-badge'
  destinationBadge.innerHTML = DESTINATION_GLYPHS.delivery
  const destinationName = document.createElement('div')
  destinationName.className = 'map-destination-name'
  destinationName.hidden = true
  destinationElement.append(destinationBadge, destinationName)
  const destination = new maplibregl.Marker({
    element: destinationElement,
    pitchAlignment: 'viewport',
    rotationAlignment: 'viewport',
  })
  // The chip at the map's edge pointing at a destination off screen (updateEdge).
  const edge = document.createElement('div')
  edge.className = 'map-destination-edge'
  edge.setAttribute('aria-hidden', 'true')
  const edgeArrow = document.createElement('span')
  edgeArrow.className = 'map-destination-edge-arrow'
  edgeArrow.innerHTML =
    '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 4.5 18 19l-6-3.2L6 19Z" fill="currentColor"/></svg>'
  const edgeAway = document.createElement('span')
  edgeAway.className = 'map-destination-edge-away'
  edge.append(edgeArrow, edgeAway)
  element.append(edge)

  const created: LiveMap = {
    data,
    map,
    element,
    puck,
    destination,
    destinationBadge,
    destinationName,
    edge,
    edgeArrow,
    edgeAway,
    jobEnd: { key: '', at: null },
    jobPlace: { key: '', at: null },
    destinationShown: null,
    routeShown: null,
    progress: null,
    raised: { roads: [], read: '', stale: true, at: -Infinity },
    canopies: { hidden: '', at: -Infinity },
    labels,
    wanted: appearance,
    painted: appearance,
    garagesShown: null,
    playersShown: 0,
    playersDrawn: 0,
    viewTold: 0,
    ahead: null,
    aheadTold: 0,
    aheadShown: null,
    aheadEstimate: null,
    routeTraffic: [],
    nearbyTraffic: [],
    nearbyKey: null,
    nearbyTold: 0,
    camera: null,
    mode: 'follow',
    interactive: false,
    pressed: false,
    touched: 0,
    overview: false,
    offeredPick: null,
    zoomOffset: 0,
    browsedFrom: 0,
    glide: null,
    northUp: false,
    labelsPlacedFor: null,
    kept: '',
    keptAt: 0,
    settingsShown: '',
    lookShown: '',
    pinsShown: '',
    scale: null,
  }
  // Place icons are drawn when the map first needs each (placeIcons.ts), and again once the type for their
  // names is in.
  map.on('styleimagemissing', ({ id }: { id: string }) => {
    const icon = parsePlaceIcon(id)
    if (!icon || map.hasImage(id)) return
    const pixelRatio = window.devicePixelRatio || 1
    map.addImage(
      id,
      drawPlaceIcon(icon.kind, icon.name, created.painted, pixelRatio, fontFamily, nameScale(), outlinedPins()),
      { pixelRatio },
    )
  })
  document.fonts.ready.then(() => redrawPlaceIcons(created)).catch(() => {})
  // The player's text size changed: once it has settled (a drag along the slider passes several), the names
  // measured again for where they fit, and the places' images let go of. Drawn anew at the new size only as the
  // tiles laid out again ask for them (styleimagemissing, above): the map keeps every place it has shown, and
  // drawing them all again (some 2 ms each) held the cab up for a second at each step.
  let resized: ReturnType<typeof setTimeout> | undefined
  stopTextSize?.()
  stopTextSize = useCabin.subscribe((state, before) => {
    if (state.textSize === before.textSize) return
    clearTimeout(resized)
    resized = setTimeout(() => {
      lines.forEach((line, index) => Object.assign(labels[index], measured(line)))
      created.labelsPlacedFor = null
      for (const id of map.listImages()) {
        if (parsePlaceIcon(id)?.name) map.removeImage(id)
      }
    }, TEXT_SIZE_SETTLE_MS)
  })
  listen(created)
  drawMarker(created)
  restoreView(created)
  return created
}

/** How often the view is looked at to be kept, ms. */
const KEEP_EVERY_MS = 500

/** The frames a second each Map detail draws (Settings › Maps): the game takes no more than 60 (frameCap.ts). */
const DETAIL_FPS: Record<MapDetail, number> = { high: MAP_FPS, balanced: 45, low: 30 }

/**
 * The settings the map draws by (Settings › Maps): the buildings (and the 3D canopies over them) off on Low, and
 * the other players' trucks and the traffic shown or not. Retried each frame until the style has loaded.
 */
function syncMapSettings(target: LiveMap) {
  const { mapDetail, mapTrucks, mapTraffic } = useCabin.getState()
  const key = `${mapDetail}:${mapTrucks}:${mapTraffic}`
  if (target.settingsShown === key) return
  // Nothing is applied to a style still loading (and nothing is marked as applied): the next frame tries again.
  if (!target.map.isStyleLoaded()) return
  const show = (layer: string, visible: boolean) => {
    if (target.map.getLayer(layer)) {
      target.map.setLayoutProperty(layer, 'visibility', visible ? 'visible' : 'none')
    }
  }
  // The buildings' own layer only exists once the map has its data, and the traffic's and the players' too.
  show(BUILDING_LAYER, mapDetail !== 'low')
  show('players', mapTrucks)
  show('traffic', mapTraffic)
  show('traffic-estimated', mapTraffic)
  target.settingsShown = key
}

/**
 * The route, the truck's marker and its size as the player has them (Settings › Maps). Applied as they change; the
 * appearance repainting the map takes the route's colours off again, so syncAppearance lets go of the key and this
 * puts them back.
 */
function syncMapLook(target: LiveMap) {
  const { mapRoute, mapWeight, mapMarker, mapMarkerSize } = useCabin.getState()
  const key = `${mapRoute}:${mapWeight}:${mapMarker}:${mapMarkerSize}`
  if (target.lookShown === key) return
  try {
    for (const { layer, property, value } of routeOverrides(target.painted, mapRoute, mapWeight)) {
      if (target.map.getLayer(layer)) target.map.setPaintProperty(layer, property, value)
    }
  } catch {
    // The style is still loading: the next frame tries again.
    return
  }
  target.lookShown = key
  drawMarker(target)
}

/** The marker's glyphs, by style. */
const MARKER_GLYPHS: Record<MapMarker, string> = {
  arrow: '<path d="M12 4.5 18 19l-6-3.2L6 19Z" fill="currentColor"/>',
  dot: '<circle cx="12" cy="12" r="5.5" fill="currentColor"/><circle cx="12" cy="12" r="9.5" fill="none" stroke="currentColor" stroke-width="2" opacity="0.4"/>',
  truck:
    '<path d="M2.5 7.5h11v8h-11zM13.5 10h3.2l2.8 2.6v2.9h-6z" fill="currentColor"/>' +
    '<circle cx="6" cy="17.4" r="1.7" fill="currentColor"/><circle cx="16.6" cy="17.4" r="1.7" fill="currentColor"/>',
}

/** Draws the truck's marker as the player chose it (its size is CSS, by the element's `data-size`). */
function drawMarker(target: LiveMap) {
  const { mapMarker, mapMarkerSize } = useCabin.getState()
  const element = target.puck.getElement()
  element.dataset.marker = mapMarker
  element.dataset.size = mapMarkerSize
  element.innerHTML = `<svg viewBox="0 0 24 24" aria-hidden="true">${MARKER_GLYPHS[mapMarker]}</svg>`
}

/** Whether the player draws every pin as an outline (Settings › Maps). */
function outlinedPins(): boolean {
  return useCabin.getState().mapPins === 'outlined'
}

/**
 * The map's pins (Settings › Maps): filled or outlined, and which kinds of place it shows. The kinds are left out of
 * both place layers' filter; a change of style takes the drawn images away, so the map asks for them anew in it.
 */
function syncPins(target: LiveMap) {
  const { mapPins, mapPinFuel, mapPinParking, mapPinService } = useCabin.getState()
  const hidden = [
    ...(mapPinFuel ? [] : ['fuel']),
    ...(mapPinParking ? [] : ['parking']),
    ...(mapPinService ? [] : ['service']),
  ]
  const key = `${mapPins}:${hidden.join(',')}`
  if (target.pinsShown === key) return
  // Nothing to filter until the style has laid its layers out (a map still loading them): the next frame tries.
  if (!target.map.getLayer('places') || !target.map.getLayer('places-badges')) return
  const before = target.pinsShown.split(':')[0]
  try {
    const filter = hidden.length
      ? (['all', placeKindFilter(), ['!', ['in', ['get', 'kind'], ['literal', hidden]]]] as never)
      : (placeKindFilter() as never)
    for (const layer of ['places', 'places-badges']) {
      if (target.map.getLayer(layer)) target.map.setFilter(layer, filter)
    }
  } catch {
    // The style is still loading: the next frame tries again.
    return
  }
  // A new pin style: the images drawn so far are the old one's, so they go and the map draws them again. (`before`
  // empty: the first time, nothing has been drawn for this map yet.)
  if (before !== '' && before !== mapPins) {
    for (const id of target.map.listImages()) if (parsePlaceIcon(id)) target.map.removeImage(id)
  }
  target.pinsShown = key
}

/** The scale bar (Settings › Maps): MapLibre's own, bottom left; off, taken away. */
function syncScale(target: LiveMap) {
  const wanted = useCabin.getState().mapScale
  if ((target.scale !== null) === wanted) return
  if (wanted) {
    target.scale = new maplibregl.ScaleControl({ maxWidth: 120, unit: 'metric' })
    target.map.addControl(target.scale, 'bottom-left')
  } else if (target.scale) {
    target.map.removeControl(target.scale)
    target.scale = null
  }
}

/** How near (m, as the game counts) a turn makes the camera ease out so the junction is seen before it's on. */
const JUNCTION_WITHIN = 250
/** How much further out (zoom levels) the camera goes at a junction. */
const JUNCTION_ZOOM_OUT = 1.1

/** Whether the route's next step is a turn close ahead (Settings › Maps: Zoom Out at Junctions). */
function nearJunction(): boolean {
  if (!useCabin.getState().mapJunction) return false
  const { route, routeNext, telemetry } = useLive.getState()
  if (!route || !telemetry || telemetry.navigationDistance <= 0) return false
  const guidance = guidanceOf(route.distances, route.maneuvers, routeNext, telemetry.navigationDistance)
  return (
    guidance !== null && guidance.step.kind === 'turn' && guidance.distance > 0 && guidance.distance < JUNCTION_WITHIN
  )
}

/** The view the player left the map in, kept from before (a hot reload, a reload, a restart): their
 * follow zoom, and where they'd browsed to (with the full while to look again before it glides back). */
function restoreView(target: LiveMap) {
  const saved = loadView()
  if (!saved) return
  target.zoomOffset = clampZoomOffset(saved.zoomOffset)
  if (saved.browse) {
    const { center, zoom, bearing, pitch, from } = saved.browse
    target.map.jumpTo({ center, zoom, bearing, pitch })
    browse(target)
    target.browsedFrom = from
  }
  target.kept = JSON.stringify(viewOf(target))
}

/** Keeps the view, now and then, when it has changed. */
function keepView(target: LiveMap, now: number) {
  if (now - target.keptAt < KEEP_EVERY_MS) return
  target.keptAt = now
  const view = JSON.stringify(viewOf(target))
  if (view === target.kept) return
  target.kept = view
  saveView(JSON.parse(view) as SavedView)
}

function viewOf({ map, mode, zoomOffset, browsedFrom }: LiveMap): SavedView {
  const browse =
    mode === 'browse'
      ? {
          center: map.getCenter().toArray() as [number, number],
          zoom: map.getZoom(),
          bearing: map.getBearing(),
          pitch: map.getPitch(),
          from: browsedFrom,
        }
      : null
  return { zoomOffset, browse }
}

/** The player's hands on the map. */
function listen(target: LiveMap) {
  const { map } = target
  const canvas = map.getCanvasContainer()
  // A finger or a mouse: either may start a drag, which moving the camera under it would cancel.
  canvas.addEventListener('pointerdown', () => {
    if (!target.interactive) return
    target.pressed = true
    target.touched = performance.now()
  })
  for (const event of ['pointerup', 'pointercancel'] as const) {
    window.addEventListener(event, () => {
      target.pressed = false
    })
  }
  // Dragging or turning it leaves the truck behind.
  const leave = (event: { originalEvent?: unknown }) => {
    if (event.originalEvent && target.interactive) browse(target)
  }
  map.on('dragstart', leave)
  map.on('rotatestart', leave)
  // The compass (MapControls.tsx) turns with the map.
  map.on('rotate', () => tellBearing(map.getBearing()))
  // A route offered tapped (Directions): picked, as its row on the card is. Otherwise a tap looks for the place
  // it landed on (a pin, or one of the map's own place icons) and opens its card.
  map.on('click', (event) => {
    if (!target.interactive) return
    if (target.offeredPick) {
      pickOffered(target, event.point, target.offeredPick)
      return
    }
    if (!placeTap) return
    const { lng, lat } = map.unproject(event.point)
    // What a pixel covers here (Web Mercator's ground resolution), so a tap reaches round the badge it's on.
    const perPixel = (40075016.686 * Math.cos((lat * Math.PI) / 180)) / 2 ** (map.getZoom() + 8)
    placeTap(fromLngLat(lng, lat), Math.max(PICK_MIN_M, PICK_PIXELS * perPixel))
  })
  map.on('move', (event) => {
    if (event.originalEvent) target.touched = performance.now()
  })
  // A tile in: the raised roads may be more (syncRoute reads them again).
  map.on('sourcedata', (event) => {
    if (event.sourceId === MAP_SOURCE && event.tile) target.raised.stale = true
  })
  // The wheel, while following: closer or further, still following. (Browsing, MapLibre zooms.)
  canvas.addEventListener(
    'wheel',
    (event) => {
      if (!target.interactive) return
      target.touched = performance.now()
      if (target.mode !== 'browse') {
        target.zoomOffset = clampZoomOffset(target.zoomOffset - (event.deltaY / 120) * WHEEL_ZOOM)
      }
    },
    { passive: true },
  )
}

function browse(target: LiveMap) {
  // Measured from here (a glide back cut short may have moved the zoom already: that's no choice).
  target.browsedFrom = target.map.getZoom()
  target.mode = 'browse'
  target.glide = null
  target.touched = performance.now()
  // Browsing, the wheel zooms around the cursor, like any desktop map.
  target.map.scrollZoom.enable()
  useMapBrowsing.setState({ browsing: true })
}

function follow(target: LiveMap) {
  target.mode = 'follow'
  target.glide = null
  target.map.scrollZoom.disable()
  // North up, the arrow stays: it brings the chase view back.
  useMapBrowsing.setState({ browsing: target.northUp })
}

/** Switches the gestures for the screen showing the map: the Maps app moves it, the Dashboard doesn't. */
function setInteractive(target: LiveMap, interactive: boolean) {
  target.interactive = interactive
  const { map } = target
  // The wheel and the buttons aren't the only hands: a cab's screen is touched, so the pinch (closer or
  // further, and turned), the two-finger tilt and the double tap zoom the map too.
  for (const handler of [map.dragPan, map.dragRotate, map.touchZoomRotate, map.touchPitch, map.doubleClickZoom]) {
    if (interactive) handler.enable()
    else handler.disable()
  }
  if (!interactive) {
    target.pressed = false
    setOverview(target, false)
    follow(target)
    // Straight onto the truck.
    target.camera = null
  }
}

/**
 * Restyles the map to the wanted appearance, if it isn't already. Called every frame: until the style
 * itself has loaded, MapLibre refuses paint changes, and the next frame tries again. (Its "is the style
 * loaded" check also waits for every tile, which never settles while driving: a switch made then was lost.)
 */
function syncAppearance(target: LiveMap) {
  if (target.painted === target.wanted) return
  try {
    for (const { layer, property, value } of paintFor(target.wanted)) {
      target.map.setPaintProperty(layer, property, value)
    }
    target.painted = target.wanted
    // The player's own route colour and weight go on over the appearance's: they're theirs, not the look's.
    target.lookShown = ''
    // Names' colours follow the appearance.
    redrawPlaceIcons(target)
  } catch {
    // The style is still loading.
  }
}

/** Shows the player's own garages as theirs (the host reads them from their save), once they change.
 * Like the appearance, retried each frame until the style has loaded. */
function syncGarages(target: LiveMap) {
  const owned = useLive.getState().ownedGarages
  const key = owned.join(',')
  if (target.garagesShown === key) return
  try {
    for (const { layer, value } of placeImagesFor(owned)) target.map.setLayoutProperty(layer, 'icon-image', value)
    target.garagesShown = key
  } catch {
    // The style is still loading.
  }
}

/** How often (ms) the part of the map shown is told TruckersMP's reader, and the other players drawn. */
const VIEW_TOLD_EVERY = 500
const PLAYERS_DRAWN_EVERY = 33
/** How far behind the feed's clock (s) the further trucks are drawn: between places it has given, never
 * guessing ahead (guessing ahead went back and forth: owner 2026-10-21). Read every 3 s (truckersmp.ts), each
 * truck's newest place is up to 3 s older than the read, and the feed lags a second or two: 5 s keeps one
 * place ahead to slide to. */
const PLAYERS_BEHIND = 5
/** How far (m) round its centre the part of the map shown reaches at most (tilted, it sees to the horizon). */
const VIEW_REACH = 20000

/** The part of the map shown (the game's x and z), at most [`VIEW_REACH`] round its centre. */
function viewArea(map: maplibregl.Map): Area {
  const bounds = map.getBounds()
  const [x0, z0] = fromLngLat(bounds.getWest(), bounds.getNorth())
  const [x1, z1] = fromLngLat(bounds.getEast(), bounds.getSouth())
  const [cx, cz] = fromLngLat(map.getCenter().lng, map.getCenter().lat)
  return [
    Math.max(Math.min(x0, x1), cx - VIEW_REACH),
    Math.max(Math.min(z0, z1), cz - VIEW_REACH),
    Math.min(Math.max(x0, x1), cx + VIEW_REACH),
    Math.min(Math.max(z0, z1), cz + VIEW_REACH),
  ]
}

/** Draws TruckersMP's other players smoothly (owner 2026-10-21): those around the player where TruckersMP's
 * SDK has them now (the plugin's, as the game draws them); the rest each where it was [`PLAYERS_BEHIND`]
 * seconds ago on the feed's clock, between the places the feed gave it (truckersmp.ts). Tells the reader the
 * part of the map shown (none: nothing is read for it). */
function syncPlayers(target: LiveMap, now: number) {
  if (now - target.viewTold >= VIEW_TOLD_EVERY) {
    target.viewTold = now
    setMapView(hosts.length > 0 ? viewArea(target.map) : null)
  }
  const { tracks, clock } = useTruckersMp.getState()
  const around = useLive.getState().nearby?.players ?? []
  if (hosts.length === 0 || now - target.playersDrawn < PLAYERS_DRAWN_EVERY) return
  // None to draw, and none drawn: nothing to do.
  if (tracks.size === 0 && around.length === 0 && target.playersShown === 0) return
  const source = target.map.getSource<GeoJSONSource>(PLAYERS_SOURCE)
  // The style still loading: next frame.
  if (!source) return
  target.playersDrawn = now
  const point = (x: number, z: number) => ({
    type: 'Feature' as const,
    properties: {},
    geometry: { type: 'Point' as const, coordinates: toLngLat(x, z) },
  })
  // Around the player, as the SDK has them; the feed's own place for them left out.
  const close = new Set(around.map(([id]) => id))
  const t = now / 1000 + (clock ?? 0) - PLAYERS_BEHIND
  const features = [
    ...around.map(([, x, z]) => point(x, z)),
    ...[...tracks].filter(([id]) => !close.has(id)).map(([, samples]) => point(...trackAt(samples, t))),
  ]
  target.playersShown = features.length
  source.setData({ type: 'FeatureCollection', features })
}

/** How far ahead along the route driven (m, the world's own: about 20 minutes' drive) its traffic is shown. */
const TRAFFIC_AHEAD = 25000
/** How often (ms) the route ahead is worked out again, for its traffic. */
const AHEAD_EVERY = 2000

/** Driving a route: the traffic on the route ahead, over its blue line. Under TruckersMP, from the trucks along
 * it (truckersmp.ts reads its corridor, owner 2026-10-21); in single player, where the game tells nothing of its
 * AI traffic, from the hour and the road (estimatedTraffic.ts). While routes are offered, theirs is shown
 * instead (Destinations.tsx). */
function syncRouteTraffic(target: LiveMap, now: number) {
  if (target.overview) return
  const shown = target.routeShown
  const progress = target.progress
  if (!shown?.route || !progress) {
    if (target.ahead) {
      target.ahead = null
      target.aheadShown = null
      target.aheadEstimate = null
      setRouteAhead(null)
      target.routeTraffic = []
      paintTraffic(target)
    }
    return
  }
  const truckersmp = useLive.getState().truckersmp
  if (!target.ahead || now - target.aheadTold >= AHEAD_EVERY) {
    target.aheadTold = now
    target.ahead = routeAhead(shown.spans, progress.span, TRAFFIC_AHEAD)
    target.aheadShown = null
    target.aheadEstimate = null
    // Only TruckersMP's read needs a corridor: the estimate is worked out on the line itself.
    setRouteAhead(truckersmp ? corridorOf(target.ahead) : null)
  }
  if (truckersmp) {
    const { aheadAlong } = useTruckersMp.getState()
    if (aheadAlong !== target.aheadShown) {
      target.aheadShown = aheadAlong
      target.routeTraffic = trafficAlong(target.ahead, aheadAlong)
      paintTraffic(target)
    }
    return
  }
  // Single player: the estimate changes with the game's day, so it's drawn anew each quarter of an hour.
  const live = useLive.getState()
  const minute = live.telemetry ? Math.floor(cabClock(live.telemetry, live.clockShift) / 15) * 15 : 0
  if (minute !== target.aheadEstimate) {
    target.aheadEstimate = minute
    target.routeTraffic = estimatedTraffic(target.ahead, minute)
    paintTraffic(target)
  }
}

/** How often (ms) the roads around the truck are looked at again, at the most (they change with the hour, and
 * every half kilometre driven). */
const NEARBY_EVERY = 2000
/** At most this many stretches are drawn around the truck: a town's whole road network is not the point. */
const NEARBY_MOST = 140

/**
 * Without a route to draw it along, the traffic around the truck: the roads the map has loaded, estimated at the
 * game's hour (estimatedTraffic.ts). In single player only — under TruckersMP the roads are its players', which
 * the route's own traffic reads. Nothing around is drawn when the setting says only on a route.
 */
function syncNearbyTraffic(target: LiveMap, now: number) {
  if (target.overview) return
  const live = useLive.getState()
  const truck = live.telemetry
  const { mapTraffic, mapTrafficAround } = useCabin.getState()
  const radius = mapTraffic ? mapTrafficAround : 0
  const key =
    !truck || !radius || live.truckersmp
      ? ''
      : `${Math.floor(cabClock(truck, live.clockShift) / 15)}:${radius}:${Math.round(truck.x / 500)}:${Math.round(truck.z / 500)}`
  if (key === target.nearbyKey) return
  if (key && now - target.nearbyTold < NEARBY_EVERY) return
  target.nearbyKey = key
  target.nearbyTold = now
  if (!key || !truck) {
    target.nearbyTraffic = []
    paintTraffic(target)
    return
  }
  const minute = Math.floor(cabClock(truck, live.clockShift) / 15) * 15
  const stretches: TrafficStretch[] = []
  for (const road of roadsAround(target, truck, radius)) {
    stretches.push(...estimatedTraffic(road, minute))
    if (stretches.length >= NEARBY_MOST) break
  }
  target.nearbyTraffic = stretches.slice(0, NEARBY_MOST)
  paintTraffic(target)
}

/** The roads the map has loaded within `radius` m of the truck, as lines of the game's metres. */
function roadsAround(target: LiveMap, truck: { x: number; z: number }, radius: number): Point[][] {
  const lines: Point[][] = []
  for (const feature of target.map.querySourceFeatures(MAP_SOURCE, { sourceLayer: 'road' })) {
    const geometry = feature.geometry
    if (!geometry) continue
    const parts =
      geometry.type === 'LineString'
        ? [geometry.coordinates]
        : geometry.type === 'MultiLineString'
          ? geometry.coordinates
          : []
    for (const part of parts) {
      const line = part.map(([lng, lat]: [number, number]) => fromLngLat(lng, lat))
      if (!line.some(([x, z]: Point) => Math.hypot(x - truck.x, z - truck.z) <= radius)) continue
      lines.push(line)
    }
  }
  return lines
}

/** Draws what's been found: the roads around the truck, then the route's own traffic over them. */
function paintTraffic(target: LiveMap) {
  // Single player has no real traffic to draw: what's shown is the hour's estimate (estimatedTraffic.ts), drawn
  // dashed so it never reads as a reading of the game's.
  showTraffic([...target.nearbyTraffic, ...target.routeTraffic], !useLive.getState().truckersmp)
}

/** Shows the traffic on the route previewed (traffic.ts: TruckersMP's; estimatedTraffic.ts in single player), over
 * it; none to clear it. */
export function showTraffic(stretches: readonly TrafficStretch[], estimated = false) {
  const source = live?.map.getSource<GeoJSONSource>(TRAFFIC_SOURCE)
  if (!source) return
  source.setData({
    type: 'FeatureCollection',
    features: stretches
      .filter(({ line }) => line.length > 1)
      .map(({ line, level }) => ({
        type: 'Feature',
        properties: { level, estimated },
        geometry: { type: 'LineString', coordinates: line.map(([x, z]) => toLngLat(x, z)) },
      })),
  })
}

/** Draws the place icons the map has again, for its appearance (names' colours) and type. */
function redrawPlaceIcons({ map, painted }: LiveMap) {
  const pixelRatio = window.devicePixelRatio || 1
  const fontFamily = getComputedStyle(document.body).fontFamily
  for (const id of map.listImages()) {
    const icon = parsePlaceIcon(id)
    if (icon?.name) {
      map.updateImage(
        id,
        drawPlaceIcon(icon.kind, icon.name, painted, pixelRatio, fontFamily, nameScale(), outlinedPins()),
      )
    }
  }
}

/** The screens showing the map, latest last: it's in the latest, and goes back when that one closes. */
const hosts: { element: HTMLElement; interactive: boolean }[] = []
let frame: number | null = null

/**
 * Shows the live map in `host` and follows the truck there (letting the player move it if `interactive`),
 * until the returned function is called (the map then stays alive, ready for the next screen).
 */
export function showLiveMap(
  host: HTMLElement,
  data: MapData,
  appearance: Appearance,
  interactive: boolean,
): () => void {
  collectSamples()
  if (live?.data !== data) {
    if (frame !== null) cancelAnimationFrame(frame)
    frame = null
    live?.map.remove()
    live = create(data, appearance)
    // Development: the map, for inspecting it from the browser's console.
    if (import.meta.env.DEV) Object.assign(window, { westplayMap: live.map })
  }
  live.wanted = appearance
  syncAppearance(live)
  const entry = { element: host, interactive }
  hosts.push(entry)
  place()
  return () => {
    hosts.splice(hosts.lastIndexOf(entry), 1)
    place()
  }
}

/** Puts the map in the latest screen showing it, following the truck while any does. */
function place() {
  if (!live) return
  const current = live
  const host = hosts.at(-1)
  if (!host) {
    current.element.remove()
    if (frame !== null) cancelAnimationFrame(frame)
    frame = null
    return
  }
  if (current.element.parentElement !== host.element) {
    host.element.appendChild(current.element)
    current.map.resize()
    // Straight onto the truck, without easing in from wherever the camera was.
    current.camera = null
  }
  if (current.interactive !== host.interactive) setInteractive(current, host.interactive)
  if (frame === null) {
    let lastFrame = performance.now()
    let due = lastFrame
    frame = requestAnimationFrame(function step(now) {
      frame = requestAnimationFrame(step)
      // At most 60 a second (frameCap.ts): the game is handed no more, and each frame drawn here redraws every 3D
      // building in view (a player's log, 2026-10-27: the cab page's share up to 4x in towns).
      // Nothing is drawn while the page is hidden: the game keeps its GPU, and the map catches up on return.
      if (document.hidden) return
      const next = mapFrameDue(now, due, DETAIL_FPS[useCabin.getState().mapDetail])
      if (next === null) return
      due = next
      const dt = Math.min(now - lastFrame, 100)
      lastFrame = now
      syncAppearance(current)
      syncMapLook(current)
      syncPins(current)
      syncScale(current)
      syncGarages(current)
      syncMapSettings(current)
      syncPlayers(current, now)
      syncRouteTraffic(current, now)
      syncNearbyTraffic(current, now)
      syncRoute(current, now)
      syncDestination(current)
      syncCanopies(current, now)
      updateCamera(current, now, dt)
      showLabels(current)
      keepView(current, now)
    })
  }
}

/** How near a tap (px) picks a route offered: a finger's width either side of its line. */
const OFFERED_TAP = 16
/** The layers the routes offered are drawn in (style.ts). */
const OFFERED_LAYERS = ['offered-picked', 'offered-picked-casing', 'offered', 'offered-casing']

/** Picks the route offered whose line is under `point`: where the one picked runs too (a road they share), it
 * stays picked. */
function pickOffered(target: LiveMap, point: { x: number; y: number }, pick: (index: number) => void) {
  const { map } = target
  const layers = OFFERED_LAYERS.filter((id) => map.getLayer(id))
  if (layers.length === 0) return
  const hits = map.queryRenderedFeatures(
    [
      [point.x - OFFERED_TAP, point.y - OFFERED_TAP],
      [point.x + OFFERED_TAP, point.y + OFFERED_TAP],
    ],
    { layers },
  )
  const indices = hits.map((hit) => hit.properties?.index).filter((index): index is number => typeof index === 'number')
  if (indices.length === 0 || hits.some((hit) => hit.properties?.picked === true)) return
  pick(indices[0])
}

/** How far the map's left edge is covered by the search panel (px, in the map's own units): the routes
 * offered are framed beside it. */
function panelCover(map: maplibregl.Map): number {
  const container = map.getContainer()
  const box = container.getBoundingClientRect()
  const panel = document.querySelector('.map-tile .map-search')?.getBoundingClientRect()
  if (!panel || box.width === 0) return 0
  // The screen may be scaled: the map's padding is in its own pixels.
  return Math.max(0, (panel.right - box.left) * (container.clientWidth / box.width))
}

/** Shows the routes offered before Go (`lines`, `[x, z]` metres each), `picked` in the route's blue over the
 * others, `onPick` called with a route's index as its line is tapped; none to clear them. */
export function showOfferedRoutes(lines: Point[][], picked: number | null, onPick?: (index: number) => void) {
  const source = live?.map.getSource<GeoJSONSource>(OFFERED_SOURCE)
  if (!live || !source) return
  live.offeredPick = lines.length > 0 ? (onPick ?? null) : null
  // Offered, the map shows them all, from above (as Apple Maps' Directions), in the part the search panel
  // leaves free; gone, it's back on the truck.
  if (lines.length > 0 && !live.overview) {
    browse(live)
    setOverview(live, true)
    // (A loop: a long route has too many points to spread into Math.min.)
    let [x0, x1, z0, z1] = [Infinity, -Infinity, Infinity, -Infinity]
    for (const [x, z] of lines.flat()) {
      ;[x0, x1, z0, z1] = [Math.min(x0, x), Math.max(x1, x), Math.min(z0, z), Math.max(z1, z)]
    }
    if (x0 < x1 || z0 < z1) {
      const [lng0, lat0] = toLngLat(x0, z1)
      const [lng1, lat1] = toLngLat(x1, z0)
      live.map.fitBounds(
        [
          [lng0, lat0],
          [lng1, lat1],
        ],
        {
          padding: { top: 60, right: 60, bottom: 60, left: panelCover(live.map) + 40 },
          pitch: 0,
          bearing: 0,
          duration: 900,
        },
      )
    }
  } else if (lines.length === 0 && live.overview) {
    setOverview(live, false)
    // Back on the truck at the zoom the player had before the routes were offered: zooming out to show them
    // all was the map's doing, not a zoom they chose (owner 2026-10-21).
    live.browsedFrom = live.map.getZoom()
    recentreLiveMap()
  }
  // The picked one last: drawn over the others where they share roads.
  const order = lines
    .map((line, index) => ({ line, index, picked: index === picked }))
    .sort((a, b) => +a.picked - +b.picked)
  source.setData({
    type: 'FeatureCollection',
    features: order
      .filter(({ line }) => line.length > 1)
      .map(({ line, index, picked }) => ({
        type: 'Feature',
        properties: { picked, index },
        geometry: { type: 'LineString', coordinates: line.map(([x, z]) => toLngLat(x, z)) },
      })),
  })
}

/** How near (px) a tap finds a place: a finger's width round the badge it lands near. */
const PICK_PIXELS = 34
/** The least (m) a tap reaches, however far out the map is: a badge at a whole country's view is a few pixels. */
const PICK_MIN_M = 15

/** Called with where a tap landed and how far round it counts, for the place it was meant for. `true`: taken. */
type PlaceTap = (at: Point, within: number) => boolean

let placeTap: PlaceTap | null = null

/**
 * Where a tap on the map goes to find the place it was meant for (Destinations, through MapSearch): the Maps app
 * only. `null` when the search panel isn't there to open a card.
 */
export function setPlaceTap(handler: PlaceTap | null) {
  placeTap = handler
}

/**
 * The pins of a list of places (Destinations' Find nearby and its search): each place's badge over the map, so
 * the list is seen in place before one is chosen. Called with the list shown, and with none when it closes.
 */
export function showNearbyPins(places: readonly PinPlace[]) {
  const source = live?.map.getSource<GeoJSONSource>(NEARBY_SOURCE)
  if (!live || !source) return
  source.setData(pinFeatures(places))
}

/** The route as the map draws it, and where the truck is along it this frame (`null`: no route, or the
 * truck not placed on it yet). */
export function liveRouteProgress(): { spans: Spans; progress: Progress } | null {
  const spans = live?.routeShown?.spans
  const progress = live?.progress
  return spans && spans.length > 0 && progress ? { spans, progress } : null
}

export function setLiveMapAppearance(appearance: Appearance) {
  if (!live) return
  live.wanted = appearance
  syncAppearance(live)
}

/**
 * Shows the whole route ahead at once, from above (the Maps app's button): the player checks its shape, then
 * the arrow brings the chase view back. Nothing without a route drawn.
 */
export function overviewLiveMap() {
  const shown = live?.routeShown
  if (!live || !shown) return
  const points = shown.spans.flat()
  if (points.length < 2) return
  if (!live.overview) {
    browse(live)
    setOverview(live, true)
  }
  fitPoints(live, points)
}

/** Back onto the truck, behind it: from the whole route's view, or from a map the player moved. */
export function followRouteLiveMap() {
  if (!live) return
  setOverview(live, false)
  recentreLiveMap()
}

/** Frames `points` ([x, z] m) in the part of the map the search panel leaves free, from above. */
function fitPoints(target: LiveMap, points: readonly Point[]) {
  let [x0, x1, z0, z1] = [Infinity, -Infinity, Infinity, -Infinity]
  for (const [x, z] of points) {
    ;[x0, x1, z0, z1] = [Math.min(x0, x), Math.max(x1, x), Math.min(z0, z), Math.max(z1, z)]
  }
  if (!(x0 < x1) && !(z0 < z1)) return
  const [lng0, lat0] = toLngLat(x0, z1)
  const [lng1, lat1] = toLngLat(x1, z0)
  target.map.fitBounds(
    [
      [lng0, lat0],
      [lng1, lat1],
    ],
    {
      padding: { top: 60, right: 60, bottom: 60, left: panelCover(target.map) + 40 },
      pitch: 0,
      bearing: 0,
      duration: 900,
    },
  )
}

/** Glides the map back onto the truck, behind it (the arrow): from a map moved away, or from north up. */
export function recentreLiveMap() {
  if (!live || (live.mode !== 'browse' && !live.northUp)) return
  live.northUp = false
  setOverview(live, false)
  glideToTruck(live)
  useMapBrowsing.setState({ browsing: false })
}

/** Whether the map shows the whole route from above, told to the maps' buttons as well as kept (the button is
 * lit while it does). */
function setOverview(target: LiveMap, overview: boolean) {
  target.overview = overview
  useMapBrowsing.setState({ overview })
}

/** Turns the map north up and looks down from above, following the truck still (the compass tapped, as
 * CarPlay's Maps does); the arrow appears, and brings the chase view back (owner 2026-10-21). */
export function northUpLiveMap() {
  if (!live || live.northUp) return
  live.northUp = true
  glideToTruck(live)
  useMapBrowsing.setState({ browsing: true })
}

/** Glides from where the map is to the following camera ([`updateCamera`]): behind the truck, or north up. */
function glideToTruck(target: LiveMap) {
  const { map } = target
  // A zoom the player chose while browsing (the wheel, the buttons) stays: the camera follows at it.
  if (target.mode === 'browse' && Math.abs(map.getZoom() - target.browsedFrom) > 0.01) {
    const speed = truckAt(samples, performance.now() - FOLLOW_DELAY_MS)?.speed ?? 0
    target.zoomOffset = zoomOffsetFor(map.getZoom(), speed)
  }
  target.glide = {
    from: {
      center: map.getCenter().toArray() as [number, number],
      zoom: map.getZoom(),
      bearing: map.getBearing(),
      pitch: map.getPitch(),
    },
    fromTop: map.getPadding().top ?? 0,
    started: performance.now(),
  }
  target.mode = 'return'
  map.scrollZoom.disable()
}

/** Zooms in (1) or out (-1) a step: the following camera closer or further, or the browsed map. */
export function zoomLiveMap(direction: 1 | -1) {
  if (!live) return
  live.touched = performance.now()
  // Browsing, or with no truck to follow (none yet: the camera only follows one), the map itself zooms.
  const following = truckAt(samples, performance.now() - FOLLOW_DELAY_MS) !== null
  if (live.mode === 'browse' || !following) {
    live.map.easeTo({ zoom: live.map.getZoom() + direction, duration: 300 })
  } else {
    live.zoomOffset = clampZoomOffset(live.zoomOffset + direction)
  }
}

/**
 * Shows the place names that fit: only places near enough to matter at this zoom (the tilted view reaches
 * to the horizon, where everything far away would pile up, and the game's distances between cities are
 * short), and of those, none overlapping a more important one.
 */
function showLabels(target: LiveMap) {
  const { map, labels } = target
  const centre = map.getCenter().toArray() as [number, number]
  const { clientWidth: width, clientHeight: height } = map.getContainer()
  // Only when the view has changed: placing them projects every name.
  const view = `${centre} ${map.getZoom()} ${map.getBearing()} ${map.getPitch()} ${width}x${height}`
  if (view === target.labelsPlacedFor) return
  target.labelsPlacedFor = view
  const range = labelRange(map.getZoom(), width)
  const boxes = labels.map((label) => {
    if (metresBetween(centre, label.at) > range) return null
    const { x, y } = map.project(label.at)
    if (x < -label.width || x > width + label.width || y < -label.height || y > height + label.height) return null
    return { x, y, width: label.width, height: label.height }
  })
  const shown = placeLabels(boxes, LABEL_GAP)
  labels.forEach(({ marker }, index) => {
    const visible = marker.getElement().isConnected
    if (shown.has(index) && !visible) marker.addTo(map)
    else if (!shown.has(index) && visible) marker.remove()
  })
}

/** A unit direction on the ground (x east, z south) for a compass bearing (degrees). */
function along(bearing: number): Point {
  const radians = (bearing * Math.PI) / 180
  return [Math.sin(radians), -Math.cos(radians)]
}

/** A route source's data. */
type LineData = Parameters<GeoJSONSource['setData']>[0]

const NO_LINE: LineData = { type: 'FeatureCollection', features: [] }

/** The route line `points`, in parts by the level each is drawn on (route.ts routeLevels: over `raised`). */
function lineOf(points: Point[], raised: RaisedRoad[]): LineData {
  if (points.length < 2) return NO_LINE
  return {
    type: 'FeatureCollection',
    features: routeLevels(points, raised).map(({ points, level }) => ({
      type: 'Feature',
      properties: { level },
      geometry: { type: 'LineString', coordinates: points.map(([x, z]) => toLngLat(x, z)) },
    })),
  }
}

/** The raised road stretches in the tiles loaded (style.ts ROAD_LEVELS), on the game's ground. */
function raisedRoads(map: maplibregl.Map): RaisedRoad[] {
  const raised = map.querySourceFeatures(MAP_SOURCE, {
    sourceLayer: 'road',
    filter: ['>', ['coalesce', ['get', 'level'], 0], 0],
  })
  return raised.flatMap(({ geometry, properties }) => {
    const lines: number[][][] =
      geometry.type === 'LineString'
        ? [geometry.coordinates]
        : geometry.type === 'MultiLineString'
          ? geometry.coordinates
          : []
    const [width, level] = [Number(properties.width), Number(properties.level)]
    return lines.map((line) => ({ points: line.map(([lng, lat]) => fromLngLat(lng, lat)), width, level }))
  })
}

/**
 * Reads the raised roads again once tiles have loaded (at most every RAISED_EVERY_MS), and has the route
 * drawn again where they've changed.
 */
function syncRaised(target: LiveMap, now: number) {
  const { raised } = target
  if (!raised.stale || now - raised.at < RAISED_EVERY_MS) return
  const roads = raisedRoads(target.map)
  // What they are, cheaply: how many, and where they start.
  const read = `${roads.length}:${roads.reduce((sum, road) => sum + road.points[0][0] + road.points[0][1], 0)}`
  Object.assign(raised, { stale: false, at: now })
  if (read === raised.read) return
  Object.assign(raised, { roads, read })
  if (target.routeShown) Object.assign(target.routeShown, { restAfter: null, headFrom: null })
}

/** How often the canopies over the truck are looked for, ms. */
const CANOPIES_EVERY_MS = 400

/**
 * Leaves the canopies the truck is under out of the raised buildings, and every other one in (owner
 * 2026-10-22: a filling station's or a border crossing's roof would cover the truck). From the tiles loaded;
 * the layer's filter changed only when they change.
 */
function syncCanopies(target: LiveMap, now: number) {
  const { canopies, map } = target
  if (now - canopies.at < CANOPIES_EVERY_MS || !map.getLayer(BUILDING_LAYER)) return
  canopies.at = now
  const truck = samples.at(-1)
  if (!truck) return
  const found = map.querySourceFeatures(MAP_SOURCE, {
    sourceLayer: 'building',
    filter: ['==', ['get', 'kind'], 'canopy'],
  })
  const shapes: Canopy[] = found.flatMap((feature) => {
    const id = feature.properties?.id
    const geometry = feature.geometry
    if (typeof id !== 'number') return []
    if (geometry.type === 'Polygon') return [{ id, rings: geometry.coordinates as [number, number][][] }]
    if (geometry.type === 'MultiPolygon') {
      return geometry.coordinates.map((rings: number[][][]) => ({ id, rings: rings as [number, number][][] }))
    }
    return []
  })
  const hidden = canopiesOver(shapes, toLngLat(truck.x, truck.z))
  const key = hidden.join(',')
  if (key === canopies.hidden) return
  canopies.hidden = key
  map.setFilter(BUILDING_LAYER, buildingFilter(hidden))
}

/**
 * Draws the game's GPS route (route.ts) as it changes, and the part ahead of the truck as it moves: the
 * rest of the route only when the truck reaches its next span, the head (to the end of the truck's span)
 * every half metre, so a parked truck leaves the map idle. Until the style has loaded, its sources aren't
 * there, and the next frame tries again.
 */
function syncRoute(target: LiveMap, now: number) {
  const { map } = target
  const rest = map.getSource<GeoJSONSource>(ROUTE_SOURCE)
  const head = map.getSource<GeoJSONSource>(ROUTE_HEAD_SOURCE)
  target.progress = null
  if (!rest || !head) return
  const { route, routeNext } = useLive.getState()
  if (target.routeShown?.route !== route) {
    target.routeShown = {
      route,
      spans: route ? routeSpans(route.nodes, route.paths, route.shifts) : [],
      restAfter: null,
      headFrom: null,
    }
    if (!route) {
      rest.setData(NO_LINE)
      head.setData(NO_LINE)
    }
  }
  syncRaised(target, now)
  const shown = target.routeShown
  const truck = truckAt(samples, now - FOLLOW_DELAY_MS)
  // The way the truck faces, on the ground (x east, z south), from its compass bearing.
  const facing = truck && along(bearingOf(truck.heading))
  const found = route && truck ? progressOf(shown.spans, routeNext, [truck.x, truck.z], facing ?? undefined) : null
  // Short of the route's start, the line runs from the truck to it, and the truck is shown where it is.
  const approach = found && truck && facing ? approachLine(shown.spans, found, [truck.x, truck.z], facing) : null
  target.progress = found && truck && approach ? { ...found, at: [truck.x, truck.z], distance: 0 } : found
  const progress = target.progress
  if (!progress) return
  if (progress.span !== shown.restAfter) {
    rest.setData(lineOf(restLine(shown.spans, progress.span), target.raised.roads))
    shown.restAfter = progress.span
    shown.headFrom = null
  }
  const moved = shown.headFrom
    ? Math.hypot(progress.at[0] - shown.headFrom[0], progress.at[1] - shown.headFrom[1])
    : Infinity
  if (moved >= ROUTE_HEAD_STEP) {
    const line = approach ? [...approach, ...shown.spans[0].slice(1)] : headLine(shown.spans, progress)
    head.setData(lineOf(line, target.raised.roads))
    shown.headFrom = progress.at
  }
}

/**
 * The destination marker: where the route drawn ends (the game's GPS), or while a job's cargo is on and the
 * game has taken the route away at the yard, the job's own destination — kept from where the route ended, or
 * found among the map's companies until it does (places.ts). The game's own map marks a job's destination the
 * same way, so the dock is found once the GPS has nothing left to say.
 */
function syncDestination(target: LiveMap) {
  const { job, route } = useLive.getState()
  const key = destinationKey(job)
  const end = route?.nodes.at(-1)
  const endAt: [number, number] | null = end ? toLngLat(...end.position) : null
  if (key && endAt) target.jobEnd = { key, at: endAt }
  if (key && !endAt && target.jobPlace.key !== key && job) lookUpJobPlace(target, key, job)
  const at =
    endAt ??
    (key && target.jobEnd.key === key ? target.jobEnd.at : null) ??
    (key && target.jobPlace.key === key ? target.jobPlace.at : null)
  const shown = target.destinationShown
  if (!at) {
    if (!shown) return
    target.destination.remove()
    target.destinationShown = null
    hideEdge(target)
    return
  }
  if (!shown || shown.at[0] !== at[0] || shown.at[1] !== at[1] || shown.key !== key) {
    target.destination.setLngLat(at)
    if (!target.destination.getElement().isConnected) target.destination.addTo(target.map)
    target.destinationShown = { at, key }
  }
  // What the marker is: a crate for the pickup, a flag for the dock being driven to (or any route's end).
  const kind = job && !job.cargoLoaded ? 'pickup' : 'delivery'
  const element = target.destination.getElement()
  if (element.dataset.kind !== kind) {
    element.dataset.kind = kind
    target.destinationBadge.innerHTML = DESTINATION_GLYPHS[kind]
  }
  const name = job ? jobName(job) : ''
  if (target.destinationName.textContent !== name) {
    target.destinationName.textContent = name
    target.destinationName.hidden = name === ''
  }
  updateEdge(target, at)
}

/** The marker's glyphs: the dock being driven to (the flag Apple's maps end a route with) and the pickup (a
 * crate), so a job's two ends are told apart as the game's own map tells them. */
const DESTINATION_GLYPHS: Record<'delivery' | 'pickup', string> = {
  delivery:
    '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6.5 21V4.2c3.6-1.9 6.6 1.6 11 0v8.6c-4.4 1.6-7.4-1.9-11 0" fill="currentColor" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/></svg>',
  pickup:
    '<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linejoin="round"><path d="M4 8.2 12 4.5l8 3.7v7.6L12 19.5l-8-3.7z"/><path d="M4 8.2 12 12l8-3.8M12 12v7.5"/></svg>',
}

/** What the destination marker is kept for: the job's company and city, and which end of it (`''`: no job, and
 * the marker shows wherever the game's route ends). */
function destinationKey(job: JobInfo | null): string {
  if (!job) return ''
  return job.cargoLoaded
    ? `delivery|${job.destinationCity}|${job.destinationCompany}`
    : `pickup|${job.sourceCity}|${job.sourceCompany}`
}

/** The marker's name: the job's company in its city ("Wielton · Kraków"), or whichever it has. */
function jobName(job: JobInfo): string {
  const [company, city] = job.cargoLoaded
    ? [job.destinationCompany, job.destinationCity]
    : [job.sourceCompany, job.sourceCity]
  return [company, city].filter(Boolean).join(' · ')
}

/** The cabin's words as of now (the map draws its own labels outside React). */
function words(): Strings {
  return STRINGS[languageOf(useLive.getState().gameLanguage)]
}

/** Looks the job's own end up on the map (its company in its city, places.ts) for while the game has no route
 * to take it from: found once for each job. */
function lookUpJobPlace(target: LiveMap, key: string, job: JobInfo) {
  const found: { key: string; at: [number, number] | null } = { key, at: null }
  target.jobPlace = found
  const url = target.data.places
  if (!url) return
  const [company, city] = job.cargoLoaded
    ? [job.destinationCompany, job.destinationCity]
    : [job.sourceCompany, job.sourceCity]
  loadPlaces(url)
    .then((places) => {
      found.at = (places && jobPlace(places, city, company))?.at ?? null
    })
    .catch(() => {})
}

/** The game counts distances on a map smaller than the world (Destinations' MAP_SCALE): the chip's own.
 * Worked out from the map's ground, on the game's scale. */
const MAP_SCALE = 19
/** How far (px) from the map's edges the chip sits, and how near (the game's metres) counts as arrived. */
const EDGE_INSET = 58
const EDGE_NEAR = 25

/**
 * The chip at the map's edge pointing at the destination while it's off screen (the game's own map always shows
 * where it goes): an arrow turned to it and how far it is, on the game's own scale. Behind the camera in the
 * tilted view, or off the tile's side, the dock is still found.
 */
function updateEdge(target: LiveMap, at: [number, number]) {
  const truck = samples.at(-1)
  if (!truck || target.mode !== 'follow' || target.overview) {
    hideEdge(target)
    return
  }
  const metres = metresBetween(at, toLngLat(truck.x, truck.z)) * MAP_SCALE
  if (metres < EDGE_NEAR) {
    hideEdge(target)
    return
  }
  const { map } = target
  const width = map.getContainer().clientWidth
  const height = map.getContainer().clientHeight
  if (width === 0 || height === 0) {
    hideEdge(target)
    return
  }
  const point = map.project(at)
  if (point.x >= 0 && point.x <= width && point.y >= 0 && point.y <= height) {
    hideEdge(target)
    return
  }
  // Clamped to the edge on the side the destination lies, and turned to it from the map's middle.
  target.edge.style.left = `${Math.min(width - EDGE_INSET, Math.max(EDGE_INSET, point.x))}px`
  target.edge.style.top = `${Math.min(height - EDGE_INSET, Math.max(EDGE_INSET, point.y))}px`
  const degrees = (Math.atan2(point.y - height / 2, point.x - width / 2) * 180) / Math.PI + 90
  target.edgeArrow.style.transform = `rotate(${degrees}deg)`
  const distance = formatTripDistance(metres, words().decimal)
  if (target.edgeAway.textContent !== distance) target.edgeAway.textContent = distance
  target.edge.classList.add('shown')
}

function hideEdge(target: LiveMap) {
  target.edge.classList.remove('shown')
}

function updateCamera(target: LiveMap, now: number, dt: number) {
  const truck = truckAt(samples, now - FOLLOW_DELAY_MS)
  const { map, puck } = target
  if (!truck) return

  // The puck goes with the truck whatever the camera does: on the route, in the middle of its road.
  const shown: Point = target.progress ? snapToRoute(target.progress, [truck.x, truck.z]) : [truck.x, truck.z]
  const position = toLngLat(...shown)
  const bearing = bearingOf(truck.heading)
  puck.setLngLat(position).setRotation(bearing)
  if (!puck.getElement().isConnected) puck.addTo(map)

  if (target.mode === 'browse') {
    const seconds = useCabin.getState().mapRecentre
    if (!target.pressed && !target.overview && seconds > 0 && now - target.touched > seconds * 1000) {
      recentreLiveMap()
    }
    return
  }

  const zoom = Math.min(
    MAX_ZOOM,
    Math.max(MIN_ZOOM, zoomForSpeed(truck.speed) + target.zoomOffset - (nearJunction() ? JUNCTION_ZOOM_OUT : 0)),
  )
  const height = map.getContainer().clientHeight
  // Behind the truck: facing its way, tilted, the truck low on the screen. North up (the player's setting, or the
  // compass tapped): from above, the truck in the middle.
  const wanted =
    target.northUp || useCabin.getState().mapNorth
      ? { bearing: 0, pitch: 0, top: 0 }
      : { bearing, pitch: PITCH, top: height * (PUCK_FROM_TOP - 0.5) * 2 }
  const padding = { top: wanted.top, bottom: 0, left: 0, right: 0 }

  if (target.mode === 'return' && target.glide) {
    // Towards where the following camera is now (the truck moves on while it glides).
    const t = (now - target.glide.started) / GLIDE_MS
    const eased = easeInOut(t)
    const towards = { center: position, zoom, bearing: wanted.bearing, pitch: wanted.pitch }
    const top = target.glide.fromTop + (wanted.top - target.glide.fromTop) * eased
    moveCamera(map, blendPose(target.glide.from, towards, eased), { ...padding, top })
    if (t >= 1) {
      follow(target)
      target.camera = { bearing: wanted.bearing, zoom }
    }
    return
  }

  target.camera = target.camera
    ? {
        bearing: dampBearing(target.camera.bearing, wanted.bearing, dt, BEARING_TAU_MS),
        zoom: damp(target.camera.zoom, zoom, dt, ZOOM_TAU_MS),
      }
    : { bearing: wanted.bearing, zoom }
  // Held still while a button is down, so a drag can start (moving the camera cancels it).
  if (target.pressed) return
  const pose = { center: position, bearing: target.camera.bearing, zoom: target.camera.zoom, pitch: wanted.pitch }
  moveCamera(map, pose, padding)
}

/**
 * Moves the map to `pose`, unless it's there already: every move draws the whole map again, so a parked
 * truck (and a camera that has settled) leaves the map, and the GPU the game shares, idle.
 */
function moveCamera(
  map: maplibregl.Map,
  pose: CameraPose,
  padding: { top: number; bottom: number; left: number; right: number },
) {
  const current = {
    center: map.getCenter().toArray() as [number, number],
    zoom: map.getZoom(),
    bearing: map.getBearing(),
    pitch: map.getPitch(),
  }
  if (samePose(current, pose) && Math.abs((map.getPadding().top ?? 0) - padding.top) < 0.01) return
  map.jumpTo({ ...pose, padding })
}

// Development: when this module is replaced (Vite hot reload), the old map goes with it, so a new one
// doesn't land on top.
import.meta.hot?.dispose(() => {
  if (frame !== null) cancelAnimationFrame(frame)
  stopTextSize?.()
  live?.element.remove()
  live?.map.remove()
})
