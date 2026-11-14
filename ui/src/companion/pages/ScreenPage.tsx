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
                change={(resume) => void settings.update({ ...saved, cabin: { ...saved.cabin, resume } })}
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
 * The connection to the game's screen: three stations — Cabin Play's engine, the game, and the screen
 * in the truck — linked by a continuous rail. Each station has a status dot, and the rail segments
 * between them light up when both ends are connected.
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
            ? w.screenLive.replace('{fps}', new Intl.NumberFormat(navigator.language).format(fps))
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
  const phone = status?.phone ?? null
  const phoneConnected = phone?.connected === true
  const device = phoneConnected ? (phone?.device ?? null) : null
  const phoneName = device?.name ?? cw.phone.connected
  const battery = device?.battery === undefined ? null : Math.max(0, Math.min(100, Math.round(device.battery)))
  const phoneDetail = [device?.model, device?.appVersion && `Bridge ${device.appVersion}`].filter(Boolean).join(' · ')
  const dropped = status?.droppedTotal ?? 0
  return (
    <section className="cp-link ob-in" data-tone={overall} style={n(place)} aria-live="polite">
      <header className="cp-link-head">
        <span className="cp-link-title">
          <i aria-hidden />
          {w.connection}
        </span>
        <span className="cp-link-status" data-tone={overall}>
          {state === 'live' ? (
            <>
              {new Intl.NumberFormat(navigator.language).format(fps)} fps
              {dropped > 0 && <span className="cp-link-dropped">{dropped} {cw.about.dropped}</span>}
            </>
          ) : (
            <>{cw.state[state]}</>
          )}
        </span>
      </header>
      <div className="cp-link-chain">
        <div className="cp-link-rail" aria-hidden>
          {steps.map((step, at) => {
            const next = steps[at + 1]
            const connected = step.tone === 'good' && next?.tone === 'good'
            return (
              <>
                <div key={step.key} className="cp-link-node" data-tone={step.tone}>
                  <span className="cp-link-dot">
                    <i />
                  </span>
                  <span className="cp-link-body">
                    <b>{step.label}</b>
                    <span>{step.value}</span>
                  </span>
                </div>
                {next && <span className="cp-link-connector" data-connected={connected || undefined} />}
              </>
            )
          })}
        </div>
      </div>
      {phoneConnected || phone ? (
        <div
          className="cp-phone-strip"
          data-connected={phoneConnected || undefined}
          role="group"
          aria-label={[
            cw.phone.phone,
            phoneConnected ? phoneName : cw.phone.waiting,
            battery === null ? null : `${battery}%`,
          ]
            .filter(Boolean)
            .join(', ')}
        >
          <span className="cp-phone-strip-icon">
            <SectionGlyph id="phone" />
          </span>
          <span className="cp-phone-strip-copy">
            <b>{phoneConnected ? phoneName : cw.phone.waiting}</b>
            {phoneConnected && phoneDetail && <span className="cp-phone-strip-model">{phoneDetail}</span>}
          </span>
          {phoneConnected && battery !== null && (
            <span className="cp-phone-strip-battery" data-charging={device?.charging || undefined}>
              {device?.charging && <BoltGlyph />}
              <span className="cp-phone-strip-charge" data-low={battery <= 20 || undefined} aria-hidden>
                <i style={{ width: `${battery}%` }} />
              </span>
              <b>{battery}%</b>
            </span>
          )}
        </div>
      ) : null}
    </section>
  )
}

/** A bolt beside a phone's charge while it's on the charger. */
function BoltGlyph() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M13.4 2 5.8 13.2h5L10.6 22 18.2 10.8h-5z" />
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
