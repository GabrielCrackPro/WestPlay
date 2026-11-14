import { type PointerEvent, useRef, useState } from 'react'
import { EQUALIZER_BANDS, EQUALIZER_MOST, type Equalizer } from '../../../shared/host'
import { useNowPlayingTrack } from '../../dashboard/useNowPlaying'
import { useCabin, useLive } from '../../state/store'
import { useText } from '../../state/text'
import { NoteGlyph, PauseGlyph, PlayGlyph } from '../music/glyphs'
import { smoothThrough } from './curve'

/** The Equalizer card's pieces: the track to hear the tone by, the curve over its three bands, and the music's
 * waveform under it. */

/** The track Now Playing shows (the Dashboard's), to hear the tone by: its cover, title and artist, and a
 * button to play or pause it; none, an empty cover and the button greyed. */
export function TrackRow() {
  const text = useText()
  const track = useNowPlayingTrack()
  const albumArt = useCabin((state) => state.albumArt)
  const cover = albumArt ? (track?.artwork ?? null) : null
  return (
    <div className="eq-track">
      <span className="eq-track-art">{cover ? <img src={cover} alt="" /> : track && <NoteGlyph size={32} />}</span>
      <span className="eq-track-lines">
        {track && <span className="eq-track-title">{track.title}</span>}
        {track && <span className="eq-track-by">{track.by}</span>}
      </span>
      <button
        type="button"
        className="eq-track-play"
        aria-label={track?.playing ? text.pause : text.play}
        disabled={!track?.playPause}
        onClick={() => track?.playPause?.()}
      >
        {track?.playing ? <PauseGlyph size={34} /> : <PlayGlyph size={34} />}
      </button>
    </div>
  )
}

/** The graph's drawing, in its own units: its width and height, where the three bands stand across it, and
 * how high a band is from its dB (flat in the middle, ±EQUALIZER_MOST at the top and bottom margins). */
const GRAPH = { width: 600, height: 300, top: 24, bottom: 236 }
const BAND_AT: Record<keyof Equalizer, number> = { bass: 100, mid: 300, treble: 500 }
const heightOf = (db: number) =>
  (GRAPH.top + GRAPH.bottom) / 2 - (db / EQUALIZER_MOST) * ((GRAPH.bottom - GRAPH.top) / 2)

/**
 * The curve over the three bands (Low, Mid, High: each a dashed line down the graph, the middle one's column
 * shaded), as iOS draws it: the music's waveform along the middle and, Custom, a smooth line through each
 * band's point over it. A band follows the finger up and down anywhere in its third of the graph, in whole
 * dB; moving one picks Custom.
 */
export function EqualizerGraph() {
  const text = useText()
  const custom = useCabin((state) => state.equalizerCustom)
  const curve = useCabin((state) => state.equalizer)
  const setBand = useCabin((state) => state.setEqualizerBand)
  const svg = useRef<SVGSVGElement>(null)
  const [dragging, setDragging] = useState<keyof Equalizer | null>(null)
  const inGraph = (event: PointerEvent) => {
    const matrix = svg.current?.getScreenCTM()?.inverse()
    if (!matrix) return null
    return new DOMPoint(event.clientX, event.clientY).matrixTransform(matrix)
  }
  const drag = (band: keyof Equalizer, event: PointerEvent) => {
    const at = inGraph(event)
    if (!at) return
    const middle = (GRAPH.top + GRAPH.bottom) / 2
    const db = Math.round(((middle - at.y) / ((GRAPH.bottom - GRAPH.top) / 2)) * EQUALIZER_MOST)
    const kept = Math.max(-EQUALIZER_MOST, Math.min(EQUALIZER_MOST, db))
    if (kept !== curve[band] || !custom) setBand(band, kept)
  }
  // A band moved from the keyboard: the same whole dB a finger's drag picks, within the scale.
  const nudge = (band: keyof Equalizer, by: number) =>
    setBand(band, Math.max(-EQUALIZER_MOST, Math.min(EQUALIZER_MOST, curve[band] + by)))
  const shown = custom ? curve : { bass: 0, mid: 0, treble: 0 }
  const points: [number, number][] = [
    [0, heightOf(shown.bass)],
    ...EQUALIZER_BANDS.map((band): [number, number] => [BAND_AT[band], heightOf(shown[band])]),
    [GRAPH.width, heightOf(shown.treble)],
  ]
  const names: Record<keyof Equalizer, string> = {
    bass: text.settings.low,
    mid: text.settings.mid,
    treble: text.settings.high,
  }
  return (
    <svg
      ref={svg}
      className={dragging ? 'eq-graph dragging' : 'eq-graph'}
      viewBox={`0 0 ${GRAPH.width} ${GRAPH.height}`}
      role="group"
      aria-label={text.settings.equalizer}
      // Its own drags (the page's drag to scroll leaves them: shell/dragScroll.ts).
      data-own-drag
      onPointerDown={(event) => {
        const at = inGraph(event)
        if (!at) return
        const band: keyof Equalizer = at.x < GRAPH.width / 3 ? 'bass' : at.x < (2 * GRAPH.width) / 3 ? 'mid' : 'treble'
        event.currentTarget.setPointerCapture(event.pointerId)
        setDragging(band)
        drag(band, event)
      }}
      onPointerMove={(event) => dragging && drag(dragging, event)}
      onPointerUp={() => setDragging(null)}
      onPointerCancel={() => setDragging(null)}
    >
      <defs>
        <linearGradient id="eq-middle-column" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" className="eq-column-edge" />
          <stop offset="0.5" className="eq-column-middle" />
          <stop offset="1" className="eq-column-edge" />
        </linearGradient>
      </defs>
      <rect x={200} y={0} width={200} height={GRAPH.bottom + 14} fill="url(#eq-middle-column)" />
      {EQUALIZER_BANDS.map((band) => (
        <line key={band} className="eq-band-line" x1={BAND_AT[band]} x2={BAND_AT[band]} y1={8} y2={GRAPH.bottom + 6} />
      ))}
      <Waveform />
      {custom && (
        <>
          <path className="eq-curve" d={smoothThrough(points)} />
          {EQUALIZER_BANDS.map((band) => (
            <circle
              key={band}
              className={dragging === band ? 'eq-point dragged' : 'eq-point'}
              cx={BAND_AT[band]}
              cy={heightOf(curve[band])}
              r={14}
              role="slider"
              aria-label={names[band]}
              aria-valuemin={-EQUALIZER_MOST}
              aria-valuemax={EQUALIZER_MOST}
              aria-valuenow={curve[band]}
              aria-orientation="vertical"
              // Reached by Tab, each band's arrow keys move it as the finger does.
              tabIndex={0}
              onKeyDown={(event) => {
                const key = event.key
                if (key === 'ArrowUp' || key === 'ArrowRight') nudge(band, 1)
                else if (key === 'ArrowDown' || key === 'ArrowLeft') nudge(band, -1)
                else if (key === 'PageUp') nudge(band, 3)
                else if (key === 'PageDown') nudge(band, -3)
                else if (key === 'Home') nudge(band, -EQUALIZER_MOST)
                else if (key === 'End') nudge(band, EQUALIZER_MOST)
                else return
                event.preventDefault()
              }}
            />
          ))}
        </>
      )}
      {EQUALIZER_BANDS.map((band) => (
        <text key={band} className="eq-band-name" x={BAND_AT[band]} y={GRAPH.height - 16}>
          {names[band]}
        </text>
      ))}
    </svg>
  )
}

/** How many of the waveform's bars there are, and how far up and down from the middle the loudest reaches. */
const WAVEFORM = { bars: 48, reach: 84, thick: 6 }

/**
 * The music's waveform, as iOS draws it under the curve: a row of dots along the middle, each a part of the
 * music's spectrum (the lows on the left, the highs on the right, as the bands stand), growing up and down
 * with its loudness as it plays; stopped, or nothing playing, the dots at rest.
 */
function Waveform() {
  const bars = useLive((state) => state.spectrum)
  const step = (GRAPH.width - 2 * WAVEFORM.thick) / (WAVEFORM.bars - 1)
  return (
    <g className="eq-waveform">
      {Array.from({ length: WAVEFORM.bars }, (_, i) => {
        const loud = Math.min(1, Math.max(0, (bars[i] ?? 0) / 255))
        const tall = WAVEFORM.thick + loud * 2 * WAVEFORM.reach
        return (
          <rect
            key={i}
            x={WAVEFORM.thick / 2 + i * step}
            y={heightOf(0) - tall / 2}
            width={WAVEFORM.thick}
            height={tall}
            rx={WAVEFORM.thick / 2}
          />
        )
      })}
    </g>
  )
}
