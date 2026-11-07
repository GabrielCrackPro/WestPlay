import { Group, Note, Panel, Row, Switch, Tick } from '../room/parts'
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
  const saved = settings.settings
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
      {saved && (
        <Group place={5}>
          <Row
            title={w.resume}
            detail={w.resumeDetail}
            accessory={
              <Switch
                on={saved.cabin.resume}
                label={w.resume}
                change={(resume) => void settings.update({ ...saved, cabin: { resume } })}
              />
            }
          />
        </Group>
      )}
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

/** How a step of the connection is doing. */
type Tone = 'good' | 'bad' | 'busy' | 'idle'
/** The three stations in the chain, in the order the signal travels. */
type Link = 'engine' | 'game' | 'screen'

/**
 * The connection to the game's screen as a signal chain: three stations — Cabin Play's engine, the game, and the
 * screen in the truck — on one dark board. A station lights when it is reached, and the rail between two stations
 * only carries the moving signal while both ends are talking, so a quiet rail is where to look.
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
  const steps: { key: Link; label: string; value: string; tone: Tone }[] = [
    {
      key: 'engine',
      label: w.engine,
      value: status?.error ? cw.values.failed : status ? w.engineRunning : w.engineStarting,
      tone: status?.error ? 'bad' : status ? 'good' : 'busy',
    },
    {
      key: 'game',
      label: w.game,
      value: status?.gameConnected ? w.gameConnected : w.gameNotRunning,
      tone: status?.gameConnected ? 'good' : 'idle',
    },
    {
      key: 'screen',
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
  const overall: Tone = steps.some((step) => step.tone === 'bad')
    ? 'bad'
    : steps.every((step) => step.tone === 'good')
      ? 'good'
      : steps.some((step) => step.tone === 'busy')
        ? 'busy'
        : 'idle'
  return (
    <section className="cp-link ob-in" data-tone={overall} style={n(place)} aria-live="polite">
      <header className="cp-link-head">
        <span className="cp-link-title">
          <i aria-hidden />
          {w.connection}
        </span>
        <span className="cp-link-meter" aria-hidden>
          {steps.map((step) => (
            <i key={step.key} data-on={step.tone === 'good' || step.tone === 'busy' || undefined} />
          ))}
        </span>
      </header>
      <ol className="cp-link-chain" aria-label={w.connection}>
        {steps.map((step, at) => {
          const next = steps[at + 1]
          const flowing = step.tone === 'good' && next?.tone === 'good'
          return (
            <li key={step.key} className="cp-link-node" data-tone={step.tone}>
              <span className="cp-link-port">
                <LinkGlyph kind={step.key} />
              </span>
              <span className="cp-link-body">
                <b>{step.label}</b>
                <span>{step.value}</span>
              </span>
              {next && (
                <span className="cp-link-wire" data-flow={flowing || undefined} aria-hidden>
                  <i />
                </span>
              )}
            </li>
          )
        })}
      </ol>
    </section>
  )
}

/** A small line mark for each station in the connection chain. */
function LinkGlyph({ kind }: { kind: Link }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {kind === 'engine' ? (
        <>
          <rect x="6" y="6" width="12" height="12" rx="2.5" />
          <path d="M9 2.5V6M15 2.5V6M9 18v3.5M15 18v3.5M2.5 9H6M2.5 15H6M18 9h3.5M18 15h3.5" />
        </>
      ) : kind === 'game' ? (
        <>
          <circle cx="12" cy="12" r="9" />
          <path d="M10 8.5l6 3.5-6 3.5z" fill="currentColor" stroke="none" />
        </>
      ) : (
        <>
          <rect x="3" y="4.5" width="18" height="13" rx="2.5" />
          <path d="M8.5 21h7M12 17.5V21" />
        </>
      )}
    </svg>
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
