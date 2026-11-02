# Builds the Windows installer: WestPlay's app plus the game plugin it installs into ETS2/ATS.
#
# `tauri build` alone bundles only what `app/tauri.conf.json` names, and that config has the bundle off (a
# quick `tauri build` makes just the exe). The release config, `app/tauri.release.conf.json`, is what turns on
# the NSIS installer and adds the plugin (`westplay.dll`), the installer hooks and the licences. Built without
# it, the installer is complete except for the plugin, and setup then stops at "this copy is missing its
# plugin" (setup.rs's `noPlugin`). The plugin isn't part of the app's build (it's a separate cdylib), so it's
# built here first: `tauri build` copies it into the installer from `target/release/westplay.dll`.
#
# The app is updated by downloading and running a newer installer.
param(
  [Parameter(ValueFromRemainingArguments = $true)]
  [string[]] $Rest
)

$ErrorActionPreference = 'Stop'

cargo build --release -p westplay-plugin
if (-not $?) { exit 1 }

& npx tauri build --config app/tauri.release.conf.json @Rest
exit $LASTEXITCODE
