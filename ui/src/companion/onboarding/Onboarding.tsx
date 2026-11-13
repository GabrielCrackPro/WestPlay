import { useContext, useEffect, useRef, useState } from 'react'
import { hvtMapMessage } from '../../cabin/maps/blockedMap'
import { call } from '../bridge'
import {
  checkGame,
  defaultMapAddress,
  chooseGameFolder,
  type GameCheck,
  type GameInfo,
  type InstallReport,
  installIntoGame,
  type SetupState,
} from '../setup'
import {
  type HostStatus,
  appleMusicCheck,
  appleMusicSignIn,
  appleMusicSignOut,
  spotifyCheck,
  spotifySignIn,
  spotifySignOut,
  youtubeCheck,
  youtubeSignIn,
  youtubeSignOut,
} from '../useHostStatus'
import { DEFAULT_KEY, type SettingsState } from '../useSettings'
import { memoryNote } from '../pages/page'
import { companionWords } from '../pages/words'
import { qrCode } from '../qr'
import '../room/room.css'
import { type Banner, GlassCursor, type Pose, TruckScreen } from '../room/TruckScreen'
import {
  Button,
  Checking,
  Cross,
  Group,
  KeyChooser,
  MapProgress,
  Note,
  Panel,
  ProfileRow,
  Row,
  Status,
  Tick,
} from '../room/parts'
import {
  banner,
  explain,
  gameSummary,
  n,
  RoomText,
  useChecking,
  useGameRunning,
  useGlidingProgress,
  useSignOut,
  useWords,
  WordsContext,
} from '../room/room'
import {
  GLOW,
  ON_SCREEN,
  openAndClose,
  type Screen,
  ScreenContext,
  useScreen,
  useScreenAt,
  useTour,
} from '../room/screen'
import { useDemo } from '../room/useDemo'
import { count, languageOf, list, percent, wordsFor } from './words'

const STEPS = [
  'welcome',
  'game',
  'check',
  'install',
  'map',
  'controls',
  'accounts',
  'profile',
  'phone',
  'tutorial',
] as const
type StepId = (typeof STEPS)[number]

const POSES: Record<StepId, Pose> = {
  welcome: 'hero',
  game: 'side',
  check: 'side',
  install: 'side',
  map: 'side',
  controls: 'side',
  accounts: 'side',
  profile: 'side',
  phone: 'side',
  tutorial: 'final',
}

/** How long the words take to leave before the next step's arrive. */
const LEAVE_MS = 240
/** The Cabin Play intro on the screen, from power on to Home (cabin/state/power.ts CONNECTING_MS, and a
 * beat). */
const BOOT_MS = 2900
/** How long the screen takes to move to another place (onboarding.css `.ts` transform). */
const POSE_MS = 1300
/** What's on the screen changes this long before its move ends (the move's last stretch hardly moves). */
const POSE_OVERLAP_MS = 250

/** The dive into the screen, before the companion. */
const DIVE_MS = 1100

/**
 * The companion's first run. The truck's screen stands in a dark room, the live Cabin Play on it (the cabin
 * page in its demo mode): it boots, steps aside while the player sets Cabin Play up, and tells them how it's
 * going through banners as CarPlay would; it opens what each step is about (their map as it's made, an app
 * tapped with the key they choose), and comes back to centre stage on the Dashboard, the player diving into
 * it as they finish. The game stays closed until the end: Cabin Play installs into it and builds its map
 * while it's closed.
 */
export function Onboarding({
  initial,
  status,
  settings,
  onFinished,
  mapAddress = defaultMapAddress,
}: {
  initial: SetupState
  status: HostStatus | null
  settings: SettingsState
  /** The onboarding's done: its tutorial next, from its start or skipped to its end. */
  onFinished(start: 'lesson' | 'launch'): void
  mapAddress?: (status: HostStatus | null) => { base: string; built: number | null } | null
}) {
  const [step, setStep] = useState<StepId>('welcome')
  const [leaving, setLeaving] = useState(false)
  const [finishing, setFinishing] = useState(false)
  const [game, setGame] = useState<GameInfo | null>(initial.game ?? initial.found[0] ?? null)
  const [check, setCheck] = useState<GameCheck | null>(null)
  // What installing did, kept while the player moves between steps (until they choose another game).
  const [installed, setInstalled] = useState<InstallReport | null>(null)
  const demo = useDemo()
  const [powered, setPowered] = useState(false)
  const [banner, setBanner] = useState<Banner | null>(null)
  const [scanning, setScanning] = useState(false)
  const [glow, setGlow] = useState(GLOW.boot)
  const [cursor, setCursor] = useState<{ x: number; y: number; pressing: boolean } | null>(null)
  const root = useRef<HTMLDivElement>(null)
  const index = STEPS.indexOf(step)
  // The game's language, as Cabin Play speaks in the cab (and the map's place names are in); Windows' for a
  // game never started.
  const [code] = useState(() => initial.language ?? languageOf(navigator.languages))
  const words = wordsFor(code)

  // When the screen's move to its next place ends. Its content changes after that, not during it: the
  // page draws both, and an app or the Dashboard starting up (the map) holds up the move, which then jumps.
  const moveEnds = useRef(0)
  const go = (to: number) => {
    if (leaving || to < 0 || to >= STEPS.length) return
    if (POSES[STEPS[to]] !== POSES[step]) moveEnds.current = performance.now() + LEAVE_MS + POSE_MS
    setLeaving(true)
    window.setTimeout(() => {
      setStep(STEPS[to])
      setLeaving(false)
    }, LEAVE_MS)
  }
  const next = () => go(index + 1)
  const back = index > 1 ? () => go(index - 1) : undefined

  const { send } = demo
  // The last place the screen was sent, and when: the same again right after is dropped. React runs a
  // step's effects twice while developing, and the screen takes a second press during an animation as
  // a player's, finishing it at once: an app would appear without opening.
  const lastGo = useRef<{ route: string; at: number } | null>(null)
  const screen: Screen = {
    send,
    go: (route) => {
      const now = performance.now()
      if (lastGo.current?.route === route && now - lastGo.current.at < 500) return
      lastGo.current = { route, at: now }
      send({ type: 'go', to: route })
    },
    locate: demo.locate,
    ready: demo.ready,
    banner: setBanner,
    scan: setScanning,
    glow: setGlow,
    cursor: setCursor,
    reboot: () => {
      send({ type: 'power', on: false })
      window.setTimeout(() => send({ type: 'power', on: true }), 450)
    },
    powered,
    leaving,
    settling: () => Math.max(0, moveEnds.current - POSE_OVERLAP_MS - performance.now()),
  }

  // The screen comes on once Cabin Play in it is ready: the intro, then Home.
  useEffect(() => {
    if (!demo.ready || powered) return
    const timer = window.setTimeout(() => {
      send({ type: 'power', on: true })
      setPowered(true)
    }, 700)
    return () => window.clearTimeout(timer)
  }, [demo.ready, powered, send])

  // Cabin Play on the screen speaks the same language.
  useEffect(() => {
    if (demo.ready) send({ type: 'language', code })
  }, [demo.ready, code, send])

  // The map, once there is one, is shown on the screen.
  const map = mapAddress(status)
  const mapKey = map ? `${map.base}#${map.built}` : ''
  useEffect(() => {
    if (map) send({ type: 'map', base: map.base, built: map.built })
    // Keyed by the map's address and build.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mapKey, demo.ready, send])

  // The mouse turns the screen a little.
  const tilt = (event: React.PointerEvent) => {
    const box = root.current?.getBoundingClientRect()
    if (!box) return
    root.current?.style.setProperty('--tilt-x', (((event.clientX - box.left) / box.width) * 2 - 1).toFixed(3))
    root.current?.style.setProperty('--tilt-y', (((event.clientY - box.top) / box.height) * 2 - 1).toFixed(3))
  }

  const finish = (start: 'lesson' | 'launch') => {
    setFinishing(true)
    window.setTimeout(() => onFinished(start), DIVE_MS)
  }

  return (
    <div
      ref={root}
      className="ob"
      lang={words.locale}
      data-power={powered || undefined}
      data-finishing={finishing || undefined}
      onPointerMove={tilt}
    >
      <TruckScreen
        frame={demo.frame}
        ready={demo.ready}
        pose={finishing ? 'dive' : POSES[step]}
        glow={glow}
        banner={banner}
        scanning={scanning}
      >
        <GlassCursor
          x={cursor?.x ?? 640}
          y={cursor?.y ?? 420}
          pressing={cursor?.pressing ?? false}
          visible={cursor !== null}
        />
      </TruckScreen>
      <WordsContext.Provider value={{ words, code }}>
        <RoomText.Provider value={{ locale: words.locale, back: words.back }}>
          <ScreenContext.Provider value={screen}>
            {step === 'welcome' && <Welcome next={next} />}
            {step === 'game' && (
              <ChooseGame
                found={initial.found}
                game={game}
                choose={(chosen) => {
                  setGame(chosen)
                  setCheck(null)
                  setInstalled(null)
                }}
                next={next}
                back={back}
              />
            )}
            {step === 'check' && game && (
              <CheckGame game={game} check={check} checked={setCheck} next={next} back={back} />
            )}
            {step === 'install' && game && (
              <Install game={game} report={installed} reported={setInstalled} next={next} back={back} />
            )}
            {step === 'map' && <MapStep status={status} next={next} back={back} />}
            {step === 'controls' && <Controls settings={settings} next={next} back={back} />}
            {step === 'accounts' && <Accounts status={status} next={next} back={back} />}
            {step === 'profile' && <ProfileStep settings={settings} next={next} back={back} />}
            {step === 'phone' && <PhoneStep status={status} next={next} back={back} />}
            {step === 'tutorial' && <TutorialIntro code={code} finish={finish} back={back} />}
          </ScreenContext.Provider>
        </RoomText.Provider>
      </WordsContext.Provider>
      <div className="ob-dots" aria-hidden>
        {STEPS.map((id, at) => (
          <i key={id} data-here={at === index || undefined} data-passed={at < index || undefined} />
        ))}
      </div>
    </div>
  )
}

function Welcome({ next }: { next(): void }) {
  const screen = useScreen()
  // The words come once Cabin Play has booted on the screen.
  const [booted, setBooted] = useState(false)
  useEffect(() => {
    if (!screen.powered) return
    const timer = window.setTimeout(() => setBooted(true), BOOT_MS)
    return () => window.clearTimeout(timer)
  }, [screen.powered])
  const words = useWords()
  useScreenAt('home', GLOW.home, null)
  useTour(
    booted
      ? [
          { tap: ON_SCREEN.page(2), then: 3400 },
          { tap: ON_SCREEN.page(1), then: 4200 },
        ]
      : null,
    2200,
  )
  if (!booted) return null
  return (
    <Panel
      place="below"
      title={words.welcome.title}
      sub={words.welcome.sub}
      action={<Button onClick={next}>{words.welcome.start}</Button>}
    />
  )
}

function ChooseGame({
  found,
  game,
  choose,
  next,
  back,
}: {
  found: GameInfo[]
  game: GameInfo | null
  choose(game: GameInfo): void
  next(): void
  back?: () => void
}) {
  const [games, setGames] = useState(() =>
    game && !found.some((known) => known.dir === game.dir) ? [...found, game] : found,
  )
  const [error, setError] = useState<string | null>(null)
  const running = useGameRunning()
  const words = useWords()
  const w = words.game
  useScreenAt(
    'dashboard',
    GLOW.dashboard,
    game
      ? { title: 'Euro Truck Simulator 2', detail: gameSummary(words, game) }
      : { title: w.titleMissing, detail: w.bannerMissing },
  )

  const pick = async () => {
    try {
      const chosen = await chooseGameFolder(w.picker)
      if (!chosen) return
      setError(null)
      if (!games.some((known) => known.dir === chosen.dir)) setGames([...games, chosen])
      choose(chosen)
    } catch (e) {
      setError(explain(words, e))
    }
  }

  return (
    <Panel
      place="side"
      title={games.length ? w.title : w.titleMissing}
      sub={games.length ? (games.length > 1 ? w.foundMany : w.found) : w.missing}
      back={back}
      action={
        <Button onClick={next} disabled={!game || running !== false}>
          {words.continue}
        </Button>
      }
    >
      <Group place={4}>
        {games.map((known) => (
          <Row
            key={known.dir}
            title={known.dir.replace(/[\\/]steamapps[\\/]common[\\/][^\\/]+[\\/]?$/i, '')}
            detail={gameSummary(words, known)}
            accessory={known.dir === game?.dir ? <Tick key={known.dir} /> : undefined}
            onClick={() => choose(known)}
          />
        ))}
        <Row title={games.length ? w.chooseAnother : w.chooseFolder} link onClick={pick} />
      </Group>
      {error && <Note tone="bad">{error}</Note>}
      {running && (
        <Note>
          <b>{w.closeToGoOn.title}</b> {w.closeToGoOn.text}
        </Note>
      )}
    </Panel>
  )
}

function CheckGame({
  game,
  check,
  checked,
  next,
  back,
}: {
  game: GameInfo
  check: GameCheck | null
  checked(check: GameCheck): void
  next(): void
  back?: () => void
}) {
  const screen = useScreen()
  const words = useWords()
  const w = words.check
  const [error, setError] = useState<string | null>(null)
  useEffect(() => {
    if (check) return
    let active = true
    // Long enough to see the scan pass at least once.
    const shown = new Promise((resolve) => window.setTimeout(resolve, 2200))
    Promise.all([checkGame(game.dir), shown])
      .then(([result]) => active && checked(result))
      .catch((e: unknown) => active && setError(explain(words, e)))
    return () => {
      active = false
    }
  }, [game.dir, check, checked, words])
  useEffect(() => {
    screen.scan(!check && !error)
    return () => screen.scan(false)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [check, error])
  useScreenAt(
    'home',
    check ? GLOW.home : GLOW.scan,
    check
      ? {
          title: check.modProblem ? w.notYet : w.checked,
          detail: `${count(words, w.profileCount, check.profiles.length)} · ${count(words, words.summary.dlcs, check.dlcs)}`,
        }
      : { title: w.checking, busy: true },
  )

  if (!check) {
    return (
      <Panel
        place="side"
        title={w.looking}
        sub={w.lookingSub}
        back={back}
        action={
          <Button onClick={next} busy={!error}>
            {words.continue}
          </Button>
        }
      >
        {error && <Note tone="bad">{error}</Note>}
      </Panel>
    )
  }

  return (
    <Panel
      place="side"
      title={check.modProblem ? w.titleNotYet : w.title}
      back={back}
      action={
        <Button onClick={next} disabled={!!check.modProblem}>
          {words.continue}
        </Button>
      }
    >
      {check.modProblem && (
        <Note tone="bad">
          <b>{w.cantInstall}</b> {check.modProblem}
        </Note>
      )}
      {check.otherApps.includes('ymnOne') && (
        <Note tone="bad">
          <b>{w.otherCarPlay.title}</b> {w.otherCarPlay.text}
        </Note>
      )}
      <Group place={2}>
        <Row
          title={w.version}
          value={check.game.version ?? w.unknown}
          accessory={check.game.tested ? <Tick done /> : <Status tone="idle" />}
        />
        <Row title={w.dlcs} value={new Intl.NumberFormat(words.locale).format(check.dlcs)} />
        <Row
          title={w.mapDlcs}
          detail={check.mapDlcs.length ? list(words, check.mapDlcs) : w.noMapDlcs}
          value={new Intl.NumberFormat(words.locale).format(check.mapDlcs.length)}
        />
      </Group>
      {!check.game.tested && !check.modProblem && <Note>{w.untested}</Note>}
      <Group title={w.trucks} place={3}>
        {check.trucks.map((truck) => (
          <Row
            key={truck.id}
            title={
              truck.id === 'scania-7'
                ? w.scania7
                : truck.id === 'scania-smart-dash'
                  ? w.scaniaSmartDash
                  : truck.id === 'any-truck-tablet'
                    ? w.anyTruckTablet
                    : truck.name
            }
            detail={
              truck.fit === 'ready'
                ? undefined
                : truck.fit === 'notYet'
                  ? w.truckNotYet
                  : truck.fromMod
                    ? w.notInMods
                    : w.notInGame
            }
            accessory={truck.fit === 'ready' ? <Tick done /> : <Cross />}
          />
        ))}
      </Group>
      <p className="ob-sub ob-in" style={{ ...n(3), fontSize: 12.5, marginTop: 0 }}>
        {w.otherTrucks}
      </p>
      <Group title={w.profiles} place={4}>
        {check.profiles.length ? (
          check.profiles.map((profile) => <ProfileRow key={profile.dir} profile={profile} />)
        ) : (
          <Row title={w.noProfiles} detail={w.noProfilesDetail} />
        )}
      </Group>
      <p className="ob-sub ob-in" style={{ ...n(5), fontSize: 12.5, marginTop: 0 }}>
        {w.mapNote}
      </p>
    </Panel>
  )
}

function Install({
  game,
  report,
  reported,
  next,
  back,
}: {
  game: GameInfo
  /** What installing did, if it was done (on this visit or an earlier one). */
  report: InstallReport | null
  reported(report: InstallReport): void
  next(): void
  back?: () => void
}) {
  const screen = useScreen()
  const words = useWords()
  const w = words.install
  const [installing, setInstalling] = useState(false)
  const [error, setError] = useState<string | null>(null)
  // Back on a finished install, it's simply done: no reboot again.
  const [celebrated, setCelebrated] = useState(report?.done ?? false)
  const running = useGameRunning()

  const install = async (administrator: boolean) => {
    setInstalling(true)
    setError(null)
    try {
      const result = await installIntoGame(game.dir, administrator)
      reported(result)
      if (result.done) {
        // Cabin Play in the game: the screen boots it again.
        screen.reboot()
        window.setTimeout(() => setCelebrated(true), BOOT_MS + 450)
      }
    } catch (e) {
      setError(explain(words, e))
    } finally {
      setInstalling(false)
    }
  }

  const plugin = report?.plugin
  const done = report?.done ?? false
  useScreenAt(
    'home',
    done ? GLOW.boot : GLOW.home,
    installing
      ? banner({ ...w.banners.installing, text: w.plugin }, true)
      : done
        ? celebrated
          ? banner(w.banners.done)
          : null
        : plugin?.state === 'needsAdministrator' || plugin?.state === 'declined'
          ? banner(w.banners.permission)
          : plugin?.state === 'inUse'
            ? banner(w.banners.inUse)
            : report && !done
              ? banner(w.banners.failed)
              : banner({ ...w.banners.ready, text: w.pluginDetail }),
  )

  // Waiting on the player (Windows' permission, the game closed) isn't a failure.
  const pluginTone = installing
    ? 'busy'
    : plugin?.state === 'installed'
      ? 'good'
      : plugin?.state === 'failed'
        ? 'bad'
        : 'idle'
  const asAdministrator = plugin?.state === 'needsAdministrator' || plugin?.state === 'declined'

  return (
    <Panel
      place="side"
      title={done ? w.titleDone : w.title}
      sub={w.sub}
      // While Cabin Play boots again on the screen, the player waits for it: the next step opens an app there.
      back={installing || (done && !celebrated) ? undefined : back}
      action={
        done ? (
          <Button onClick={next} busy={!celebrated}>
            {words.continue}
          </Button>
        ) : (
          <Button onClick={() => install(asAdministrator)} busy={installing} disabled={running !== false}>
            {asAdministrator ? w.asAdministrator : report || error ? w.tryAgain : w.install}
          </Button>
        )
      }
    >
      <Group place={4}>
        <Row
          title={w.plugin}
          detail={w.pluginDetail}
          accessory={pluginTone === 'good' ? <Tick done /> : <Status tone={pluginTone} />}
        />
      </Group>
      {running && !done && (
        <Note>
          <b>{w.closeToInstall.title}</b> {w.closeToInstall.text}
        </Note>
      )}
      {plugin?.state === 'inUse' && (
        <Note>
          <b>{w.inUse.title}</b> {w.inUse.text}
        </Note>
      )}
      {plugin?.state === 'needsAdministrator' && (
        <Note tone="calm">
          <b>{w.needsAdministrator.title}</b> {w.needsAdministrator.text}
        </Note>
      )}
      {plugin?.state === 'declined' && (
        <Note>
          <b>{w.declined.title}</b> {w.declined.text}
        </Note>
      )}
      {plugin?.state === 'failed' && (
        <Note tone="bad">
          <b>{w.pluginFailed}</b> {explain(words, plugin.error)}
        </Note>
      )}
      {report?.modError && (
        <Note tone="bad">
          <b>{w.modFailed}</b> {explain(words, report.modError)}
        </Note>
      )}
      {error && <Note tone="bad">{error}</Note>}
    </Panel>
  )
}

function MapStep({ status, next, back }: { status: HostStatus | null; next(): void; back?: () => void }) {
  const map = status?.map ?? { state: 'unknown' as const }
  const building = map.state === 'building' ? map : null
  const shown = useGlidingProgress(building?.done ?? null, building?.stage ?? null)
  // Seen building on this visit: once it's ready, its stages stay up, all ticked.
  const [watched, setWatched] = useState(false)
  if (building && !watched) setWatched(true)
  const settled = map.state === 'ready' || map.state === 'notAllowed' || map.state === 'failed'
  const { words, code } = useContext(WordsContext)
  const w = words.map
  // The HVT message, its two sentences as the banner's title and line.
  const [hvtTitle, hvtText] = [
    ...new Intl.Segmenter(words.locale, { granularity: 'sentence' }).segment(hvtMapMessage(code)),
  ].map((part) => part.segment.trim())
  useScreenAt(
    'maps',
    GLOW.maps,
    map.state === 'building'
      ? {
          title: w.banners.building,
          detail: `${w.stages[map.stage].now} · ${percent(words, shown)}`,
          progress: shown,
        }
      : map.state === 'ready'
        ? banner(w.banners.ready)
        : map.state === 'waitingForGame'
          ? banner(w.banners.waiting)
          : map.state === 'waitingForMemory'
            ? banner(companionWords(code).map.memory.banner)
            : map.state === 'notAllowed'
              ? { title: hvtTitle, detail: hvtText }
              : map.state === 'failed'
                ? banner(w.banners.failed)
                : { title: w.banners.getting, busy: true },
  )

  useTour(
    map.state === 'ready'
      ? [
          { tap: ON_SCREEN.zoomOut, then: 700 },
          { tap: ON_SCREEN.zoomOut, then: 700 },
          { tap: ON_SCREEN.zoomOut, then: 3200 },
          { tap: ON_SCREEN.zoomIn, then: 700 },
          { tap: ON_SCREEN.zoomIn, then: 700 },
          { tap: ON_SCREEN.zoomIn, then: 3600 },
        ]
      : null,
    1800,
  )

  return (
    <Panel
      place="side"
      title={map.state === 'ready' ? w.titleReady : w.title}
      sub={w.sub}
      back={back}
      action={
        <Button onClick={next} disabled={!settled}>
          {words.continue}
        </Button>
      }
    >
      {(building || (watched && map.state === 'ready')) && (
        <MapProgress shown={shown} stage={building?.stage ?? null} finished={map.state === 'ready'} />
      )}
      {map.state === 'failed' && <Note tone="bad">{map.error}</Note>}
      {map.state === 'waitingForGame' && (
        <Note>
          <b>{w.waiting.title}</b> {w.waiting.text}
        </Note>
      )}
      {map.state === 'waitingForMemory' && (
        <Note>
          <b>{companionWords(code).map.memory.note.title}</b>{' '}
          {memoryNote(companionWords(code), words.locale, map.needed, map.free)}
        </Note>
      )}
    </Panel>
  )
}

function Controls({ settings, next, back }: { settings: SettingsState; next(): void; back?: () => void }) {
  const current = settings.settings
  const words = useWords()
  useScreenAt('home', GLOW.home, null)
  // Holding the key: the player taps one app, then another.
  useTour([
    ...openAndClose('music', GLOW.music),
    ...openAndClose('weather', GLOW.weather),
    ...openAndClose('maps', GLOW.maps),
  ])
  return (
    <Panel
      place="side"
      title={words.controls.title}
      sub={words.controls.sub}
      back={back}
      action={<Button onClick={next}>{words.continue}</Button>}
    >
      <KeyChooser
        value={current?.interaction.key ?? DEFAULT_KEY}
        disabled={!current}
        place={4}
        choose={(key) => current && settings.update({ ...current, interaction: { ...current.interaction, key } })}
      />
      {settings.error && <Note tone="bad">{settings.error}</Note>}
    </Panel>
  )
}

/** Sign in to YouTube, Spotify, and Apple Music. */
function Accounts({ status, next, back }: { status: HostStatus | null; next(): void; back?: () => void }) {
  const words = useWords()
  const w = words.accounts

  // YouTube
  const ytSignedIn = status?.youtubeSignedIn ?? false
  const ytSigningIn = status?.youtubeSigningIn ?? false
  const ytChecking = useChecking(status?.youtubeSignedIn != null, youtubeCheck)
  const ytSignOut = useSignOut(ytSignedIn, youtubeSignOut)

  // Spotify
  const spSignedIn = status?.spotifySignedIn ?? false
  const spSigningIn = status?.spotifySigningIn ?? false
  const spChecking = useChecking(status?.spotifySignedIn != null, spotifyCheck)
  const spSignOut = useSignOut(spSignedIn, spotifySignOut)

  // Apple Music
  const amSignedIn = status?.appleMusicSignedIn ?? false
  const amSigningIn = status?.appleMusicSigningIn ?? false
  const amChecking = useChecking(status?.appleMusicSignedIn != null, appleMusicCheck)
  const amSignOut = useSignOut(amSignedIn, appleMusicSignOut)

  const anyChecking = ytChecking || spChecking || amChecking

  // Show the screen for the first service that is signing in, otherwise YouTube.
  const signingBanner = ytSigningIn
    ? banner(w.signingIn, true)
    : spSigningIn
      ? banner(words.spotify.signingIn, true)
      : amSigningIn
        ? banner(words.appleMusic.signingIn, true)
        : null
  useScreenAt('youtube', GLOW.youtube, signingBanner)

  return (
    <Panel
      place="side"
      title={w.title}
      sub={w.sub}
      back={back}
      action={
        <Button onClick={next} disabled={anyChecking}>{words.continue}</Button>
      }
    >
      <Group title={w.services} place={4}>
        <Row
          title="YouTube"
          detail={ytChecking ? undefined : ytSigningIn ? w.finishInWindow : ytSignedIn ? w.signedIn : w.notSignedIn}
          accessory={
            ytChecking ? (
              <Checking />
            ) : ytSignedIn ? (
              <Button glass small busy={ytSignOut.signingOut} onClick={ytSignOut.start}>
                {w.signOut}
              </Button>
            ) : (
              <Button glass small busy={ytSigningIn} onClick={() => youtubeSignIn()}>
                {w.signIn}
              </Button>
            )
          }
        />
        <Row
          title="Spotify"
          detail={spChecking ? undefined : spSigningIn ? words.spotify.finishInWindow : spSignedIn ? w.signedIn : w.notSignedIn}
          accessory={
            spChecking ? (
              <Checking />
            ) : spSignedIn ? (
              <Button glass small busy={spSignOut.signingOut} onClick={spSignOut.start}>
                {w.signOut}
              </Button>
            ) : (
              <Button glass small busy={spSigningIn} onClick={() => spotifySignIn()}>
                {w.signIn}
              </Button>
            )
          }
        />
        <Row
          title="Apple Music"
          detail={amChecking ? undefined : amSigningIn ? words.appleMusic.finishInWindow : amSignedIn ? w.signedIn : w.notSignedIn}
          accessory={
            amChecking ? (
              <Checking />
            ) : amSignedIn ? (
              <Button glass small busy={amSignOut.signingOut} onClick={amSignOut.start}>
                {w.signOut}
              </Button>
            ) : (
              <Button glass small busy={amSigningIn} onClick={() => appleMusicSignIn()}>
                {w.signIn}
              </Button>
            )
          }
        />
      </Group>
    </Panel>
  )
}

/** Create the first driver profile — required before continuing. */
function ProfileStep({ settings, next, back }: { settings: SettingsState; next(): void; back?: () => void }) {
  const words = useWords()
  const p = words.profile
  const [name, setName] = useState('')
  const [picture, setPicture] = useState<string>('')
  const [error, setError] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const hasProfile = settings.settings?.cabin.profiles.length ?? 0 > 0

  useScreenAt('dashboard', GLOW.dashboard, null)

  const handlePictureChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => {
      const img = new Image()
      img.onload = () => {
        const canvas = document.createElement('canvas')
        const size = 128
        canvas.width = size
        canvas.height = size
        const ctx = canvas.getContext('2d')!
        const min = Math.min(img.width, img.height)
        const sx = (img.width - min) / 2
        const sy = (img.height - min) / 2
        ctx.drawImage(img, sx, sy, min, min, 0, 0, size, size)
        setPicture(canvas.toDataURL('image/jpeg', 0.7))
      }
      img.src = String(reader.result)
    }
    reader.readAsDataURL(file)
  }

  const handleContinue = async () => {
    const trimmed = name.trim()
    if (!trimmed) {
      setError(p.tooShort)
      return
    }
    if (!hasProfile) {
      setCreating(true)
      setError(null)
      try {
        await call('add_profile', { name: trimmed, picture })
      } catch {
        /* settings-changed event will propagate */
      } finally {
        setCreating(false)
      }
    }
    next()
  }

  /** Derive initials from the name for the avatar preview. */
  const initials = name.trim().length > 0
    ? name.trim().split(/\s+/).map((w) => w[0]).join('').toUpperCase().slice(0, 2)
    : ''

  return (
    <Panel
      place="side"
      title={p.title}
      sub={p.sub}
      back={back}
      action={
        <Button onClick={handleContinue} busy={creating} disabled={!name.trim()}>
          {words.continue}
        </Button>
      }
    >
      {/* Avatar preview — centered, prominent, clickable to upload photo */}
      <div className="ob-profile-preview">
        <label className="ob-profile-avatar-click">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handlePictureChange}
            style={{ display: 'none' }}
          />
          <div
            className="ob-profile-avatar-lg"
            data-photo={picture ? '' : undefined}
          >
            {picture ? (
              <img className="ob-profile-avatar-lg-img" src={picture} alt="" />
            ) : (
              <span className="ob-profile-avatar-lg-initial">{initials || '?'}</span>
            )}
          </div>
        </label>
        <span className="ob-profile-photo-hint">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/>
            <circle cx="12" cy="13" r="4"/>
          </svg>
          {p.clickPhoto}
        </span>
      </div>

      {/* Name input */}
      <Group place={4}>
        <input
          type="text"
          className="ob-input"
          placeholder={p.namePlaceholder}
          value={name}
          onChange={(e) => { setName(e.target.value); setError(null) }}
          onKeyDown={(e) => { if (e.key === 'Enter') handleContinue() }}
          autoFocus
          maxLength={32}
        />
        {error && <Note tone="bad">{error}</Note>}
      </Group>
    </Panel>
  )
}

/** Connect a phone with Cabin Play Bridge: shows the QR code and pairing info. */
function PhoneStep({ status, next, back }: { status: HostStatus | null; next(): void; back?: () => void }) {
  const words = useWords()
  const p = words.phone
  const phone = status?.phone ?? null
  const pairing = phone?.pairing ?? null
  const device = phone?.device ?? null
  const phoneDetail = phone?.connected
    ? [device?.name ?? p.connected, device?.appVersion && `Bridge ${device.appVersion}`].filter(Boolean).join(' · ')
    : p.waiting

  useScreenAt('dashboard', GLOW.dashboard, null)

  return (
    <Panel
      place="side"
      title={p.title}
      sub={p.sub}
      back={back}
      action={
        <>
          <Button glass onClick={next}>{p.skip}</Button>
          <Button onClick={next}>{words.continue}</Button>
        </>
      }
    >
      <Group place={4}>
        <Row title={p.connected} detail={phoneDetail} accessory={phone?.connected ? <Tick done /> : undefined} />
      </Group>
      {pairing ? (
        <div className="cp-phone-pair ob-in">
          <PhoneQr uri={pairing.uri} label={p.scan} />
          <div className="cp-phone-pair-words">
            <p>{p.scan}</p>
          </div>
        </div>
      ) : (
        phone && <Note>{p.noDoor}</Note>
      )}
    </Panel>
  )
}

/** The QR code for phone pairing, on a white plate with the quiet zone a phone's camera needs. */
function PhoneQr({ uri, label }: { uri: string; label: string }) {
  const code = qrCode(uri)
  if (!code) return null
  const quiet = 4
  const side = code.size + quiet * 2
  return (
    <svg
      className="cp-phone-qr"
      viewBox={`0 0 ${side} ${side}`}
      role="img"
      aria-label={label}
      shapeRendering="crispEdges"
    >
      <rect width={side} height={side} fill="#fff" />
      <path d={code.path} transform={`translate(${quiet} ${quiet})`} fill="#000" />
    </svg>
  )
}

/** The onboarding's last step: the tutorial's start (the player dives into the screen and learns it), or
 * skipped to its end (what to do in the game). */
function TutorialIntro({
  code,
  finish,
  back,
}: {
  code: string
  finish(start: 'lesson' | 'launch'): void
  back?: () => void
}) {
  const w = companionWords(code).tutorial.intro
  useScreenAt('dashboard', GLOW.dashboard, null)
  useTour(
    [
      { tap: ON_SCREEN.homeButton, glow: GLOW.home, then: 3400 },
      { tap: ON_SCREEN.homeButton, glow: GLOW.dashboard, then: 4600 },
    ],
    2600,
  )
  return (
    <Panel
      place="below"
      title={w.title}
      sub={w.sub}
      back={back}
      action={
        <>
          <Button glass onClick={() => finish('launch')}>
            {w.skip}
          </Button>
          <Button onClick={() => finish('lesson')}>{w.start}</Button>
        </>
      }
    />
  )
}
