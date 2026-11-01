# Builds the Windows installer: WestPlay's app plus the game plugin it installs into ETS2/ATS.
#
# `tauri build` alone bundles only what `app/tauri.conf.json` names, and that config has the bundle off (a
# quick `tauri build` makes just the exe). The release config, `app/tauri.release.conf.json`, is what turns on
# the NSIS installer and adds the plugin (`westplay.dll`), the installer hooks and the licences. Built without
# it, the installer is complete except for the plugin, and setup then stops at "this copy is missing its
# plugin" (setup.rs's `noPlugin`). The plugin isn't part of the app's build (it's a separate cdylib), so it's
# built here first: `tauri build` copies it into the installer from `target/release/westplay.dll`.
#
# Updater artifacts (`.sig` and `latest.json`) need the updater's private key. Built without it, the installer
# itself is fine and the build used to end with an error after the exe was already made; here they're left out
# when no key is set, and made when one is (`TAURI_SIGNING_PRIVATE_KEY`, as CI has it).
param(
  [Parameter(ValueFromRemainingArguments = $true)]
  [string[]] $Rest
)

$ErrorActionPreference = 'Stop'

cargo build --release -p westplay-plugin
if (-not $?) { exit 1 }

$tauriArgs = @('tauri', 'build', '--config', 'app/tauri.release.conf.json')
# The override goes through a file: Windows PowerShell drops the quotes of an inline JSON argument on its way
# to a native command, and Tauri then reads `{bundle:{...}}`, which isn't JSON.
$unsigned = $null
if ($env:TAURI_SIGNING_PRIVATE_KEY) {
  Write-Host 'installer: signing the updater artifacts'
} else {
  Write-Host 'installer: no TAURI_SIGNING_PRIVATE_KEY, so no updater artifacts (.sig/latest.json)'
  $unsigned = Join-Path ([System.IO.Path]::GetTempPath()) "westplay-tauri-unsigned-$PID.json"
  [System.IO.File]::WriteAllText($unsigned, '{"bundle":{"createUpdaterArtifacts":false}}')
  $tauriArgs += @('--config', $unsigned)
}
$tauriArgs += $Rest

try {
  & npx @tauriArgs
  $code = $LASTEXITCODE
} finally {
  if ($unsigned) { Remove-Item -LiteralPath $unsigned -ErrorAction SilentlyContinue }
}
exit $code
