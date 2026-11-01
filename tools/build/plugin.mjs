// Builds WestPlay's game plugin, and checks it is this build's. Run by `tauri build` after the UI's build
// (app/tauri.conf.json's beforeBuildCommand): the plugin is a separate cdylib, so building the app alone leaves
// whatever plugin was built last time, which the installer then bundles and setup installs into the game. The
// app and the plugin share a bridge laid out per build (westplay_shared::BRIDGE_VERSION), so a plugin of another
// build shows nothing at the truck's screen.
import { spawnSync } from 'node:child_process'
import { readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = fileURLToPath(new URL('../../', import.meta.url))

const build = spawnSync('cargo', ['build', '--release', '-p', 'westplay-plugin'], { cwd: root, stdio: 'inherit' })
if (build.error) throw build.error
if (build.status !== 0) process.exit(build.status ?? 1)

/** What the plugin is made from: its crate's sources and the bridge's. */
function sources(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name)
    if (entry.isDirectory()) return sources(path)
    return /\.(rs|toml)$/.test(entry.name) ? [path] : []
  })
}

const plugin = join(root, 'target/release/westplay.dll')
let built
try {
  built = statSync(plugin).mtimeMs
} catch {
  console.error(`build: the plugin wasn't made: ${plugin} is missing`)
  process.exit(1)
}
const newest = Math.max(
  ...[join(root, 'Cargo.toml'), ...sources(join(root, 'crates/plugin')), ...sources(join(root, 'crates/shared'))].map(
    (file) => statSync(file).mtimeMs,
  ),
)
if (built < newest) {
  console.error("build: westplay.dll is older than the plugin's sources: the app would ship another build's plugin")
  process.exit(1)
}
console.log("build: the game plugin is this build's")
