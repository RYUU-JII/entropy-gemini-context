$ErrorActionPreference = 'Stop'
$EntropyRoot = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
$EntropyVersion = (Get-Content (Join-Path $EntropyRoot '.nvmrc') -Raw).Trim().TrimStart('v')
$EntropyRuntime = Join-Path $env:LOCALAPPDATA "Entropy\node-v$EntropyVersion-win-x64"
if (-not (Test-Path (Join-Path $EntropyRuntime 'node.exe'))) {
    throw "Entropy Node $EntropyVersion is missing at $EntropyRuntime. See docs/operations/runbooks/windows-native-development.md."
}
$env:Path = "$EntropyRuntime;$env:Path"
Set-Location $EntropyRoot
& (Join-Path $EntropyRuntime 'node.exe') --version
