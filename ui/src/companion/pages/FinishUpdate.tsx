import { useEffect, useRef, useState } from 'react'
import { Button, Note } from '../room/parts'
import { banner, explain, useGameRunning, useWords } from '../room/room'
import { useScreen } from '../room/screen'
import { type InstallReport, installIntoGame, type SetupState } from '../setup'
import type { CompanionWords } from './words'

/**
 * After an app upgrade, the new plugin and mod go into the game once it's closed. This isn't an app updater:
 * it keeps a manually upgraded app and its in-game plugin in sync.
 */
export function FinishUpdate({ cw, setup }: { cw: CompanionWords; setup: SetupState }) {
  const w = cw.update.finish
  const words = useWords()
  const screen = useScreen()
  const running = useGameRunning()
  const [report, setReport] = useState<InstallReport | null>(null)
  const [working, setWorking] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [later, setLater] = useState(false)
  const tried = useRef(false)
  const game = setup.updated ? setup.game : null
  const done = report?.done ?? false

  const finish = async (administrator: boolean) => {
    if (!game) return
    setWorking(true)
    setError(null)
    try {
      const result = await installIntoGame(game.dir, administrator)
      setReport(result)
      if (result.done) {
        screen.reboot()
        screen.banner(banner(cw.update.banners.updated))
      }
    } catch (e) {
      setError(explain(words, e))
    } finally {
      setWorking(false)
    }
  }

  useEffect(() => {
    if (!game || running !== false || done) return
    if (tried.current && report?.plugin.state !== 'inUse') return
    tried.current = true
    void finish(false)
    // Each time the game closes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [game, running])

  const plugin = report?.plugin
  const administrator = plugin?.state === 'needsAdministrator' || plugin?.state === 'declined'
  const asks = administrator || plugin?.state === 'failed'
  if (!game || done || later || !(asks || report?.modError || error)) return null
  return (
    <div className="cp-veil" onClick={working ? undefined : () => setLater(true)}>
      <section className="cp-sheet" role="dialog" aria-label={w.title} onClick={(event) => event.stopPropagation()}>
        <h2>{w.title}</h2>
        <p>{w.text}</p>
        {plugin?.state === 'declined' && (
          <Note>
            <b>{words.install.declined.title}</b> {words.install.declined.text}
          </Note>
        )}
        {plugin?.state === 'failed' && (
          <Note tone="bad">
            <b>{words.install.pluginFailed}</b> {explain(words, plugin.error)}
          </Note>
        )}
        {report?.modError && (
          <Note tone="bad">
            <b>{words.install.modFailed}</b> {explain(words, report.modError)}
          </Note>
        )}
        {error && <Note tone="bad">{error}</Note>}
        {running && (
          <Note>
            <b>{cw.update.closeGame.title}</b> {cw.update.closeGame.text}
          </Note>
        )}
        <div className="cp-sheet-actions">
          <Button glass onClick={() => setLater(true)} disabled={working}>
            {cw.update.later}
          </Button>
          <Button onClick={() => finish(administrator)} busy={working} disabled={running !== false}>
            {w.button}
          </Button>
        </div>
      </section>
    </div>
  )
}
