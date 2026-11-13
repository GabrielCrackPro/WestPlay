import { type CustomWallpaper, fileUrl } from '../shared/customize'
import type { Appearance } from './state/appearance'

/**
 * Wallpapers by id: WestPlay's own here, and the player's (the companion's Customize, `customWallpaper`). Like
 * icons (icons.ts), the UI refers to wallpapers through this registry only.
 *
 * A wallpaper has a dark and a light variant: two pictures, or one picture for both (a player's own image).
 * Should one be missing, the other wins and the UI follows it (dark glass on a dark-only wallpaper).
 */
export interface Wallpaper {
  id: string
  name: string
  variants: Partial<Record<Appearance, string>>
}

/** SVG size for all built-in wallpapers. */
const W = 1280
const H = 720

/** Encode an SVG string into a data URL. */
function svg(data: string): string {
  return `data:image/svg+xml,${encodeURIComponent(data)}`
}

/** A wallpaper of one colour, at the screen's size (a wallpaper's image declares its size: `prepareWallpaper`). */
function plain(colour: string): string {
  return svg(`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}"><rect width="${W}" height="${H}" fill="${colour}"/></svg>`)
}

/**
 * Flowing wavy ribbon wallpaper matching the Silk style. Each ribbon is a filled path with a
 * horizontal gradient creating a 3D light-and-shadow edge effect, flowing diagonally.
 */
function silkRibbon(bg: string, ribbons: { path: string; hl: string; sh: string }[]): string {
  const defs = ribbons.map((r, i) => `
    <linearGradient id="rh${i}" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0" stop-color="${r.sh}" stop-opacity="0"/>
      <stop offset="0.3" stop-color="${r.hl}" stop-opacity="0.6"/>
      <stop offset="0.5" stop-color="${r.hl}" stop-opacity="0.9"/>
      <stop offset="0.7" stop-color="${r.sh}" stop-opacity="0.4"/>
      <stop offset="1" stop-color="${r.sh}" stop-opacity="0"/>
    </linearGradient>`).join('')
  const paths = ribbons.map((r, i) => `<path d="${r.path}" fill="url(#rh${i})"/>`).join('')
  return svg(`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}"><defs>${defs}</defs><rect width="${W}" height="${H}" fill="${bg}"/>${paths}</svg>`)
}

/** Generate a flowing wave ribbon path from top-right to bottom-left. */
function wavePath(startY: number, amplitude: number, frequency: number, offset: number = 0): string {
  const pts: string[] = []
  const steps = 20
  const xRange = W * 1.5
  const startX = -W * 0.25
  for (let i = 0; i <= steps; i++) {
    const t = i / steps
    const x = startX + t * xRange
    const y = startY + Math.sin(t * Math.PI * frequency + offset) * amplitude
    pts.push(`${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`)
  }
  for (let i = steps; i >= 0; i--) {
    const t = i / steps
    const x = startX + t * xRange
    const y = startY + Math.sin(t * Math.PI * frequency + offset) * amplitude + 30
    pts.push(`L${x.toFixed(1)},${y.toFixed(1)}`)
  }
  pts.push('Z')
  return pts.join(' ')
}

/** Flowing waves — pronounced curves, close to Silk. */
function flowingWaves(dark: boolean): string {
  const bg = dark ? '#0a0a0c' : '#e8e9ec'
  const hl = dark ? '#c8c8cc' : '#ffffff'
  const sh = dark ? '#000000' : '#b0b0b8'
  return silkRibbon(bg, [
    { path: wavePath(80, 120, 2.5, 0), hl, sh },
    { path: wavePath(200, 100, 2.2, 1.2), hl, sh },
    { path: wavePath(340, 130, 2.8, 2.4), hl, sh },
    { path: wavePath(480, 110, 2.0, 3.6), hl, sh },
    { path: wavePath(620, 90, 2.6, 4.8), hl, sh },
  ])
}

/** Tighter creases — more compact, closely spaced ribbons like silk creases. */
function creases(dark: boolean): string {
  const bg = dark ? '#0d0d10' : '#e5e6ea'
  const hl = dark ? '#b8b8c0' : '#ffffff'
  const sh = dark ? '#000000' : '#a8a8b0'
  const ribbons = []
  for (let i = 0; i < 8; i++) {
    ribbons.push({ path: wavePath(40 + i * 85, 60, 3.5, i * 0.8), hl, sh })
  }
  return silkRibbon(bg, ribbons)
}

/** Broad sweeps — fewer, wider ribbons with gentle curves. */
function sweeps(dark: boolean): string {
  const bg = dark ? '#0b0b0e' : '#eaebee'
  const hl = dark ? '#d0d0d4' : '#ffffff'
  const sh = dark ? '#000000' : '#b8b8c0'
  return silkRibbon(bg, [
    { path: wavePath(100, 180, 1.5, 0), hl, sh },
    { path: wavePath(350, 160, 1.3, 1.5), hl, sh },
    { path: wavePath(600, 140, 1.7, 3.0), hl, sh },
  ])
}

/** Diagonal folds — ribbons at a steeper angle, like draped fabric. */
function folds(dark: boolean): string {
  const bg = dark ? '#0c0c0f' : '#e6e7eb'
  const hl = dark ? '#c0c0c8' : '#ffffff'
  const sh = dark ? '#000000' : '#b0b0b8'
  const ribbons = []
  for (let i = 0; i < 6; i++) {
    ribbons.push({ path: wavePath(-50 + i * 130, 80, 2.0, i * 1.0), hl, sh })
  }
  return silkRibbon(bg, ribbons)
}

/** Subtle ripples — very gentle, almost flat waves with soft highlights. */
function ripples(dark: boolean): string {
  const bg = dark ? '#0e0e11' : '#e9eaed'
  const hl = dark ? '#a0a0a8' : '#f0f0f4'
  const sh = dark ? '#000000' : '#a0a0a8'
  const ribbons = []
  for (let i = 0; i < 10; i++) {
    ribbons.push({ path: wavePath(20 + i * 70, 30, 4.0, i * 0.5), hl, sh })
  }
  return silkRibbon(bg, ribbons)
}

/** Overlapping layers — ribbons with varying amplitudes for depth. */
function layers(dark: boolean): string {
  const bg = dark ? '#0a0a0d' : '#e7e8ec'
  const hl = dark ? '#d8d8dc' : '#ffffff'
  const sh = dark ? '#000000' : '#b4b4bc'
  return silkRibbon(bg, [
    { path: wavePath(50, 150, 2.0, 0), hl, sh },
    { path: wavePath(250, 120, 2.4, 1.0), hl, sh },
    { path: wavePath(420, 140, 1.8, 2.0), hl, sh },
    { path: wavePath(580, 100, 2.6, 3.0), hl, sh },
  ])
}

/** Minimal — just two broad, soft ribbons on a near-solid background. */
function minimal(dark: boolean): string {
  const bg = dark ? '#0b0b0e' : '#ececee'
  const hl = dark ? '#b0b0b8' : '#f5f5f8'
  const sh = dark ? '#000000' : '#a8a8b0'
  return silkRibbon(bg, [
    { path: wavePath(200, 200, 1.2, 0), hl, sh },
    { path: wavePath(500, 180, 1.4, 2.0), hl, sh },
  ])
}

/** WestPlay's own wallpapers: Silk (the default), Plain, and a collection of flowing ribbon designs
 * matching the Silk style. The player adds their own in the companion's Customize. */
export const BUILT_IN_WALLPAPERS: Wallpaper[] = [
  { id: 'silk', name: 'Silk', variants: { dark: '/wallpapers/silk.dark.jpg', light: '/wallpapers/silk.jpg' } },
  { id: 'plain', name: 'Plain', variants: { dark: plain('#0b0b0d'), light: plain('#eceef2') } },
  { id: 'flow', name: 'Flow', variants: { dark: flowingWaves(true), light: flowingWaves(false) } },
  { id: 'creases', name: 'Creases', variants: { dark: creases(true), light: creases(false) } },
  { id: 'sweeps', name: 'Sweeps', variants: { dark: sweeps(true), light: sweeps(false) } },
  { id: 'folds', name: 'Folds', variants: { dark: folds(true), light: folds(false) } },
  { id: 'ripples', name: 'Ripples', variants: { dark: ripples(true), light: ripples(false) } },
  { id: 'layers', name: 'Layers', variants: { dark: layers(true), light: layers(false) } },
  { id: 'minimal', name: 'Minimal', variants: { dark: minimal(true), light: minimal(false) } },
]

export const DEFAULT_WALLPAPER_ID = BUILT_IN_WALLPAPERS[0].id

/** The wallpaper `id` names among `wallpapers`, or the default (one the player removed, say). */
export function findWallpaper(id: string, wallpapers: Wallpaper[]): Wallpaper {
  return (
    wallpapers.find((wallpaper) => wallpaper.id === id) ??
    wallpapers.find((wallpaper) => wallpaper.id === DEFAULT_WALLPAPER_ID) ??
    BUILT_IN_WALLPAPERS[0]
  )
}

/** One of the player's wallpapers, its files at `base`. */
export function customWallpaper(wallpaper: CustomWallpaper, base: string): Wallpaper {
  const variants: Wallpaper['variants'] = {}
  if (wallpaper.dark) variants.dark = fileUrl(base, wallpaper.dark)
  if (wallpaper.light) variants.light = fileUrl(base, wallpaper.light)
  return { id: wallpaper.id, name: wallpaper.name, variants }
}

/** The variant to show for `appearance`, and the appearance the UI must then use on top of it. */
export function pickVariant(wallpaper: Wallpaper, appearance: Appearance): { appearance: Appearance; src: string } {
  const wanted = wallpaper.variants[appearance]
  if (wanted) return { appearance, src: wanted }
  const other: Appearance = appearance === 'dark' ? 'light' : 'dark'
  const fallback = wallpaper.variants[other]
  if (fallback) return { appearance: other, src: fallback }
  throw new Error(`wallpaper ${wallpaper.id} has no variants`)
}

/** Every image file any of `wallpapers` can show (for preparing them up front). */
export function allWallpaperSources(wallpapers: Wallpaper[]): string[] {
  return wallpapers.flatMap((wallpaper) => Object.values(wallpaper.variants))
}

/**
 * Draws a wallpaper once into a bitmap of exactly `width` x `height` (cover-cropped, high-quality
 * downscale) and returns an object URL for it. Screens then only ever show these prepared bitmaps:
 * huge photos and filter-heavy SVGs would otherwise make crossfades (and the glass blur on top of them)
 * stutter, because the GPU would scale or re-render the full source every frame.
 */
export async function prepareWallpaper(src: string, width: number, height: number): Promise<string> {
  const image = new Image()
  image.src = src
  await image.decode()
  // An SVG without width/height attributes reports a tiny default size (e.g. 267x150) and would be drawn
  // that small, then stretched into a blur. Wallpaper SVGs must declare their size; catch it if not.
  if (src.endsWith('.svg') && image.naturalWidth < width / 2) {
    console.warn(`wallpaper ${src} has no intrinsic size; add width/height to its <svg> element`)
  }

  const scale = Math.max(width / image.naturalWidth, height / image.naturalHeight)
  const cropWidth = width / scale
  const cropHeight = height / scale
  const cropX = (image.naturalWidth - cropWidth) / 2
  const cropY = (image.naturalHeight - cropHeight) / 2

  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const context = canvas.getContext('2d')
  if (!context) return src
  context.imageSmoothingEnabled = true
  context.imageSmoothingQuality = 'high'
  context.drawImage(image, cropX, cropY, cropWidth, cropHeight, 0, 0, width, height)

  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'))
  return blob ? URL.createObjectURL(blob) : src
}
