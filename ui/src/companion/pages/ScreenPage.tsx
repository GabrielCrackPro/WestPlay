import { Group, Note, Panel, Row, Tick } from '../room/parts'
import { banner, n } from '../room/room'
import { GLOW, useScreenAt } from '../room/screen'
import { SectionGlyph } from './glyphs'
import { type PageProps, type ScreenState, screenState } from './page'
import type { CompanionWords } from './words'

/**
 * The truck's screen: where Cabin Play is now (its headline), Cabin Play on it or the truck's own, and the
 * connection from Cabin Play to the game to the screen. On the room's screen, Home, and Cabin Play saying the
 * same in a banner.
 */
export function ScreenPage({ status, settings, cw }: PageProps) {
  const w = cw.screen
  const state = screenState(status)
  useScreenAt(
    state === 'original' ? 'dashboard' : 'home',
    GLOW.home,
    state === 'live'
      ? banner(w.banners.live)
      : state === 'original'
        ? banner(w.banners.original)
        : state === 'unsupported'
          ? banner(w.banners.unsupported)
          : state === 'notInCab'
            ? banner(w.banners.notInCab)
            : state === 'noGame'
              ? banner(w.banners.noGame, true)
              : null,
  )
  const fps = status?.framesPerSecond ?? 0
  return (
    <Panel place="page" title={w.titles[state]} sub={w.subs[state]} icon={<SectionGlyph id="screen" />}>
      <ConnectionPath status={status} state={state} w={w} cw={cw} fps={fps} place={4} />
      {/* No switch to turn Cabin Play off (owner 2026-11-04): once it's on the truck's screen it stays there for as
          long as the game runs, so the only thing to show about it is how the connection is doing, above. */}
      {status?.gameElevated && (
        <Note tone="bad">
          <b>{w.elevated.title}</b> {w.elevated.text}
        </Note>
      )}
      <GpuChooser status={status} settings={settings} cw={cw} />
      {status?.error && <Note tone="bad">{status.error}</Note>}
    </Panel>
  )
}

/** How a step of the connection is doing: as iOS's dots say it. */
type Tone = 'good' | 'bad' | 'busy' | 'idle'

/**
 * The connection to the game's screen, as the three things it takes, in order: Cabin Play's engine, the game, and
 * the screen in the truck. Each lights when it's reached, and the line between two of them lights only where
 * both ends are talking, so where the line stops is where to look.
 */
function ConnectionPath({
  status,
  state,
  w,
  cw,
  fps,
  place,
}: {
  status: PageProps['status']
  state: ScreenState
  w: CompanionWords['screen']
  cw: CompanionWords
  fps: number
  place: number
}) {
  const steps: { label: string; value: string; tone: Tone }[] = [
    {
      label: w.engine,
      value: status?.error ? cw.values.failed : status ? w.engineRunning : w.engineStarting,
      tone: status?.error ? 'bad' : status ? 'good' : 'busy',
    },
    {
      label: w.game,
      value: status?.gameConnected ? w.gameConnected : w.gameNotRunning,
      tone: status?.gameConnected ? 'good' : 'idle',
    },
    {
      label: w.truckScreen,
      value:
        state === 'unsupported'
          ? w.screenUnsupported
          : status?.screenDrawing
            ? w.screenLive.replace('{fps}', String(fps))
            : w.screenNotInView,
      tone: state === 'unsupported' ? 'idle' : status?.screenDrawing ? 'good' : status?.gameConnected ? 'busy' : 'idle',
    },
  ]
  return (
    <>
      <p className="ob-group-title ob-in" style={n(place)}>
        {w.connection}
      </p>
      <ol className="cp-path ob-in" style={n(place)}>
        {steps.map((step) => (
          <li
            key={step.label}
            className="cp-step"
            data-tone={step.tone}
            data-reached={step.tone === 'good' || undefined}
          >
            <i className="cp-step-dot" />
            <span className="cp-step-text">
              <b>{step.label}</b>
              <span>{step.value}</span>
            </span>
          </li>
        ))}
      </ol>
    </>
  )
}

/**
 * The graphics card Cabin Play's screen is drawn on: Cabin Play's pick (the game's), or one the player chooses
 * when that one stutters, as iOS lists choices (a tick on the chosen, as the onboarding's game folders). The
 * one drawing it now says so; a choice starts Cabin Play's screen again on that card. Only with more than one
 * card to choose from.
 */
function GpuChooser({ status, settings: state, cw }: Pick<PageProps, 'status' | 'settings' | 'cw'>) {
  const w = cw.screen
  const { settings, update } = state
  const adapters = status?.adapters ?? []
  if (!settings || adapters.length < 2) return null
  const chosen = adapters.some((adapter) => adapter.id === settings.graphics.gpu) ? settings.graphics.gpu : null
  const choose = (gpu: string | null) => {
    if (gpu !== settings.graphics.gpu) void update({ ...settings, graphics: { gpu } })
  }
  return (
    <>
      <Group title={cw.about.gpu} place={6}>
        <Row
          title={w.gpuAuto}
          detail={w.gpuAutoDetail}
          accessory={chosen === null ? <Tick key="auto" /> : undefined}
          onClick={() => choose(null)}
        />
        {adapters.map((adapter) => (
          <Row
            key={adapter.id}
            title={adapter.name}
            detail={adapter.name === status?.cabAdapter ? w.gpuInUse : undefined}
            accessory={chosen === adapter.id ? <Tick key={adapter.id} /> : undefined}
            onClick={() => choose(adapter.id)}
          />
        ))}
      </Group>
      <Note tone="calm">{w.gpuNote}</Note>
    </>
  )
}
