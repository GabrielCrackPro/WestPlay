import { NoteGlyph } from '../apps/music/glyphs'
import { VolumeGlyph } from '../apps/spotify/glyphs'
import { useHud } from './hud'
import './hud.css'

/**
 * The cab's HUD, as CarPlay shows the volume when the steering wheel's buttons change it: a glass pill at the top of
 * the app area, over whatever is showing, for a moment after each change (shell/hud.ts). The volume draws its level as
 * a bar; a change with no number of its own — the Dashboard's widget size, from a press on its Now Playing card — says
 * where it landed. One pill, whichever changed last, so the two never sit on top of each other.
 */
export function VolumeHud() {
  const shown = useHud((state) => state.shown)
  const content = useHud((state) => state.content)
  return (
    <div className={shown ? 'hud shown' : 'hud'} aria-hidden={!shown}>
      <div className="hud-pill">
        {content.kind === 'volume' ? (
          <>
            <VolumeGlyph volume={content.volume} />
            <div className="hud-bar">
              <i style={{ width: `${Math.round(content.volume * 100)}%` }} />
            </div>
          </>
        ) : (
          <>
            <NoteGlyph size={30} />
            <span className="hud-label">{content.label}</span>
          </>
        )}
      </div>
    </div>
  )
}
