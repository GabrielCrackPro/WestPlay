import { type CSSProperties, type ReactNode, useEffect, useLayoutEffect, useRef } from 'react'
import { cabClock, isInHost } from '../../shared/host'
import { useLook, useLookChanges, useOemStrip, useScreenProfile } from '../state/hooks'
import { usePreparedIcons } from '../state/looks'
import { frameInsets, NO_INSETS, OEM_STRIPS } from '../state/oem'
import { RETURN_BUTTON_SIZE, returnButtonCentre } from '../state/screen'
import { textScale } from '../state/textSize'
import { Player } from '../apps/youtube/Player'
import { type Hole, useYouTube } from '../apps/youtube/youtube'
import { useYouTubeMusic } from '../apps/youtubeMusic/youtubeMusic'
import { useWhatsApp } from '../apps/whatsapp/whatsapp'
import { Keyboard } from '../keyboard/Keyboard'
import { useCabin, useLive } from '../state/store'
import { Sidebar } from './Sidebar'
import { useSidebarPeek } from './sidebarPeek'
import { VolumeHud } from './VolumeHud'
import { Notifications } from './Notifications'
import { PhoneAlerts } from './PhoneAlerts'
import { VoiceAssistant } from '../voice/VoiceAssistant'
import './transitions.css'
import { Wallpaper } from './Wallpaper'

interface ShellProps {
  /** The current screen, placed in the CarPlay area. */
  children: ReactNode
  /** Full-screen content above everything, the OEM strip included (the boot sequence). */
  overlay?: ReactNode
  /** The first moments after the boot sequence: the screen fades in. */
  entering?: boolean
  /** Whether the voice assistant's button is on the screen: not while the cabin boots. */
  voice?: boolean
}

/**
 * The frame every screen lives in: the CarPlay area (wallpaper, sidebar and the current screen) and, in the
 * Glass style, room for the truck's own OEM strip beside it. Everything outside the CarPlay area is
 * transparent: the game draws the truck's real strip there, underneath.
 */
export function Shell({ children, overlay, entering = false, voice = true }: ShellProps) {
  useLookChanges()
  usePreparedIcons()
  const { appearance, wallpaperSrc } = useLook()
  const profile = useScreenProfile()
  const stripId = useOemStrip()
  const strip = stripId && OEM_STRIPS[stripId]
  const layout = useLive((state) => state.screenLayout)
  const insets = strip ? frameInsets(strip.insets, layout) : NO_INSETS
  const style = {
    '--oem-left': `${insets.left}px`,
    '--oem-bottom': `${insets.bottom}px`,
    '--ui-scale': profile.scale,
  } as CSSProperties
  // The screen changes' snapshots hang off <html>, not the shell: they're cut to the CarPlay area with these
  // too (transitions.css).
  useLayoutEffect(() => {
    const root = document.documentElement.style
    root.setProperty('--oem-left', `${insets.left}px`)
    root.setProperty('--oem-bottom', `${insets.bottom}px`)
  }, [insets.left, insets.bottom])
  // The profile's margin round CarPlay, on <html> too: where the screens start (`--content-left`) is worked out
  // there from it. None: the stylesheet's own.
  useLayoutEffect(() => {
    const root = document.documentElement.style
    if (profile.edge === undefined) root.removeProperty('--edge')
    else root.setProperty('--edge', `${profile.edge}px`)
  }, [profile.edge])
  // The apps' text size (state/textSize.ts), on <html> so menus portalled out of the apps and the screen
  // changes' snapshots take it too.
  const textSize = useCabin((state) => state.textSize)
  useLayoutEffect(() => {
    document.documentElement.style.setProperty('--text-scale', String(textScale(textSize)))
  }, [textSize])

  // Handed to the truck (the sidebar's truck button, or the W shortcut): CarPlay shrinks into WestPlay's
  // button and the truck's own screen shows; the button grows it back.
  const truckScreen = useCabin((state) => state.truckScreen)
  const button = returnButtonCentre(profile, insets.left)
  // A video full screen: the rest of the CarPlay area steps aside for it (apps/youtube/youtube.css). A video
  // in small (YouTube's Now playing): the CarPlay area is cut open where it shows.
  const watching = useYouTube((state) => state.open)
  const holdSidebar = useYouTube((state) => state.holdSidebar)
  // YouTube Music's music video in its Now Playing, the same way.
  const youtubeHole = useYouTube((state) => state.hole)
  const musicHole = useYouTubeMusic((state) => state.hole)
  // WhatsApp's own page, filling its window (apps/whatsapp): the whole window is the hole.
  const whatsappHole = useWhatsApp((state) => state.hole)
  const hole = youtubeHole ?? musicHole ?? whatsappHole
  // Over a video full screen, pointing at the left edge brings the sidebar back (shell/sidebarPeek.ts).
  const carplay = useRef<HTMLDivElement>(null)
  const peek = useSidebarPeek(watching, carplay)
  // Night in the truck: the screen dims as a head unit's does (Shell.tsx `useNightDim`).
  const nightDim = useNightDim()
  useEffect(() => {
    // Brought back, it goes again as soon as it's left, without the wait it has as YouTube opens.
    if (peek) useYouTube.setState({ holdSidebar: false })
  }, [peek])

  return (
    <main className={`shell appearance-${appearance}`} style={style}>
      {strip && !isInHost() && <GameStripPreview name={strip.name} />}
      <div
        ref={carplay}
        className={`carplay${truckScreen ? ' handed-over' : ''}${watching ? ' watching' : ''}${watching && holdSidebar ? ' hold-sidebar' : ''}${peek ? ' peek-sidebar' : ''}`}
        style={{
          transformOrigin: `${button.x - insets.left}px ${button.y}px`,
          ...(hole && !watching && isInHost() ? holeMask(hole) : {}),
        }}
        aria-hidden={truckScreen}
      >
        <Wallpaper src={wallpaperSrc} />
        <div className={entering ? 'carplay-content entering' : 'carplay-content'}>
          <Sidebar />
          {children}
          <Player />
          <Keyboard />
          <VolumeHud />
          <Notifications />
          {voice && <VoiceAssistant />}
          {/* Over the whole screen, under nothing to press: it takes no presses itself. */}
          {nightDim > 0 && <div className="cab-night" style={{ opacity: nightDim }} aria-hidden />}
        </div>
      </div>
      {/* The phone over any app: its call, and its notifications as they come (shell/PhoneAlerts.tsx). */}
      <PhoneAlerts />
      {/* What's drawn over the video where it shows through the CarPlay area (apps/youtube/VideoHole.tsx). */}
      <div id="video-over" className={truckScreen ? 'video-over handed-over' : 'video-over'} />
      <button
        type="button"
        className={truckScreen ? 'return-button shown' : 'return-button'}
        style={{ left: button.x - RETURN_BUTTON_SIZE / 2, top: button.y - RETURN_BUTTON_SIZE / 2 }}
        aria-label="Cabin Play"
        aria-hidden={!truckScreen}
        tabIndex={truckScreen ? 0 : -1}
        onClick={() => useCabin.getState().setTruckScreen(false)}
      >
        <img src="/cabinplay.png" alt="" />
      </button>
      {overlay}
      {/* Over everything, the cursor included: the image's outermost pixels, which the game repeats into
          the screen's rim (screen.ts `rim`). Nothing moves for it: it covers only those. */}
      {profile.rim && <div className="screen-rim" style={{ color: profile.rim }} aria-hidden />}
    </main>
  )
}

/**
 * How far the screen dims for the truck's night, and from when to when (game time): the cab's screen glows as a
 * head unit's does in a dark cab instead of glaring at full brightness. Low enough to read everything by, and
 * gone by day unless the lights are on (a tunnel, a storm).
 */
const NIGHT_DIM = 0.16
const NIGHT_FROM = 20 * 60
const NIGHT_TO = 6 * 60

function useNightDim(): number {
  const clock = useLive((state) => (state.telemetry ? cabClock(state.telemetry, state.clockShift) : null))
  const lit = useLive((state) => Boolean(state.telemetry?.lowBeam || state.telemetry?.highBeam))
  // The truck's own dash dimmer sets how far it dims: turned down, the screen dims further; turned up, less.
  const backlight = useLive((state) => state.telemetry?.dashboardBacklight ?? 0)
  if (clock === null) return 0
  const minute = ((clock % 1440) + 1440) % 1440
  if (!(lit || minute >= NIGHT_FROM || minute < NIGHT_TO)) return 0
  return NIGHT_DIM * (1 - Math.min(1, Math.max(0, backlight)) * 0.5)
}

/** A mask showing everything but a rounded rectangle, through which what's under the page shows. */
function holeMask({ x, y, width, height, radius }: Hole): CSSProperties {
  const shape = `<svg xmlns='http://www.w3.org/2000/svg' width='${width}' height='${height}'><rect width='${width}' height='${height}' rx='${radius}'/></svg>`
  return {
    maskImage: `linear-gradient(#000 0 0), url("data:image/svg+xml,${encodeURIComponent(shape)}")`,
    maskPosition: `0 0, ${x}px ${y}px`,
    maskSize: `100% 100%, ${width}px ${height}px`,
    maskRepeat: 'no-repeat',
    maskComposite: 'exclude',
  }
}

/** Browser previews have no game screen behind the page: mark where the game would draw its strip. */
function GameStripPreview({ name }: { name: string }) {
  return (
    <div className="game-strip-preview" aria-hidden>
      <span>{name} strip (drawn by the game)</span>
    </div>
  )
}
