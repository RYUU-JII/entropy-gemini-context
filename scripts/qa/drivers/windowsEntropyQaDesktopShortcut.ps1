param(
  [Parameter(Mandatory = $true)]
  [ValidateSet('install', 'validate')]
  [string]$Operation,

  [Parameter(Mandatory = $true)]
  [ValidateRange(1, 1)]
  [int]$ContractVersion,

  [Parameter(Mandatory = $true)]
  [ValidateNotNullOrEmpty()]
  [string]$ShortcutPathBase64,

  [Parameter(Mandatory = $true)]
  [ValidateNotNullOrEmpty()]
  [string]$TargetPathBase64,

  [Parameter(Mandatory = $true)]
  [ValidateNotNullOrEmpty()]
  [string]$ArgumentsBase64,

  [Parameter(Mandatory = $true)]
  [ValidateNotNullOrEmpty()]
  [string]$WorkingDirectoryBase64,

  [Parameter(Mandatory = $true)]
  [ValidateNotNullOrEmpty()]
  [string]$IconLocationBase64,

  [Parameter(Mandatory = $true)]
  [ValidateNotNullOrEmpty()]
  [string]$DescriptionBase64,

  [Parameter(Mandatory = $true)]
  [AllowEmptyString()]
  [string]$HotkeyBase64,

  [Parameter(Mandatory = $true)]
  [ValidateRange(1, 1)]
  [int]$WindowStyle
)

$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'
$utf8 = New-Object System.Text.UTF8Encoding($false)
[Console]::InputEncoding = $utf8
[Console]::OutputEncoding = $utf8
$OutputEncoding = $utf8

function Throw-QaCode {
  param([Parameter(Mandatory = $true)][string]$Code)
  throw [System.InvalidOperationException]::new($Code)
}

function Decode-Utf8 {
  param([AllowEmptyString()][string]$Value)
  try {
    return [Text.Encoding]::UTF8.GetString([Convert]::FromBase64String($Value))
  } catch {
    Throw-QaCode 'QA_DESKTOP_SHORTCUT_BASE64_INVALID'
  }
}

function Require-WindowsAbsolutePath {
  param(
    [Parameter(Mandatory = $true)][string]$Value,
    [Parameter(Mandatory = $true)][string]$Code
  )
  if ($Value -notmatch '^[a-zA-Z]:\\') {
    Throw-QaCode $Code
  }
}

function Read-Shortcut {
  param(
    [Parameter(Mandatory = $true)]$Shell,
    [Parameter(Mandatory = $true)][string]$Path
  )
  if (-not [IO.File]::Exists($Path)) {
    Throw-QaCode 'QA_DESKTOP_SHORTCUT_MISSING'
  }
  $shortcut = $Shell.CreateShortcut($Path)
  return [ordered]@{
    shortcutPath = $Path
    targetPath = [string]$shortcut.TargetPath
    arguments = [string]$shortcut.Arguments
    workingDirectory = [string]$shortcut.WorkingDirectory
    iconLocation = [string]$shortcut.IconLocation
    description = [string]$shortcut.Description
    hotkey = [string]$shortcut.Hotkey
    windowStyle = [int]$shortcut.WindowStyle
  }
}

function Require-ExactShortcut {
  param(
    [Parameter(Mandatory = $true)]$Actual,
    [Parameter(Mandatory = $true)]$Expected
  )
  foreach ($field in @(
    'shortcutPath',
    'targetPath',
    'arguments',
    'workingDirectory',
    'iconLocation',
    'description',
    'hotkey',
    'windowStyle'
  )) {
    if ($Actual[$field] -cne $Expected[$field]) {
      Throw-QaCode "QA_DESKTOP_SHORTCUT_CONTRACT_MISMATCH:$field"
    }
  }
}

$shortcutPath = Decode-Utf8 $ShortcutPathBase64
$targetPath = Decode-Utf8 $TargetPathBase64
$arguments = Decode-Utf8 $ArgumentsBase64
$workingDirectory = Decode-Utf8 $WorkingDirectoryBase64
$iconLocation = Decode-Utf8 $IconLocationBase64
$description = Decode-Utf8 $DescriptionBase64
$hotkey = Decode-Utf8 $HotkeyBase64
$temporaryPath = $null

try {
  Require-WindowsAbsolutePath $shortcutPath 'QA_DESKTOP_SHORTCUT_PATH_INVALID'
  Require-WindowsAbsolutePath $targetPath 'QA_DESKTOP_SHORTCUT_TARGET_PATH_INVALID'
  Require-WindowsAbsolutePath $workingDirectory 'QA_DESKTOP_SHORTCUT_WORKING_DIRECTORY_INVALID'
  if ([IO.Path]::GetExtension($shortcutPath) -ine '.lnk') {
    Throw-QaCode 'QA_DESKTOP_SHORTCUT_PATH_INVALID'
  }
  $iconPath = ($iconLocation -split ',', 2)[0]
  Require-WindowsAbsolutePath $iconPath 'QA_DESKTOP_SHORTCUT_ICON_LOCATION_INVALID'
  if (-not [IO.File]::Exists($targetPath)) {
    Throw-QaCode 'QA_DESKTOP_SHORTCUT_TARGET_MISSING'
  }
  if (-not [IO.Directory]::Exists($workingDirectory)) {
    Throw-QaCode 'QA_DESKTOP_SHORTCUT_WORKING_DIRECTORY_MISSING'
  }
  if (-not [IO.File]::Exists($iconPath)) {
    Throw-QaCode 'QA_DESKTOP_SHORTCUT_ICON_MISSING'
  }
  $parentDirectory = [IO.Path]::GetDirectoryName($shortcutPath)
  if (-not $parentDirectory -or -not [IO.Directory]::Exists($parentDirectory)) {
    Throw-QaCode 'QA_DESKTOP_SHORTCUT_PARENT_MISSING'
  }
  $expected = [ordered]@{
    shortcutPath = $shortcutPath
    targetPath = $targetPath
    arguments = $arguments
    workingDirectory = $workingDirectory
    iconLocation = $iconLocation
    description = $description
    hotkey = $hotkey
    windowStyle = $WindowStyle
  }
  $shell = New-Object -ComObject WScript.Shell
  if ($Operation -eq 'install') {
    $temporaryName = '{0}.entropy-qa-{1}-{2}.tmp.lnk' -f @(
      [IO.Path]::GetFileNameWithoutExtension($shortcutPath),
      $PID,
      [Guid]::NewGuid().ToString('N')
    )
    $temporaryPath = [IO.Path]::Combine($parentDirectory, $temporaryName)
    $temporaryShortcut = $shell.CreateShortcut($temporaryPath)
    $temporaryShortcut.TargetPath = $targetPath
    $temporaryShortcut.Arguments = $arguments
    $temporaryShortcut.WorkingDirectory = $workingDirectory
    $temporaryShortcut.IconLocation = $iconLocation
    $temporaryShortcut.Description = $description
    $temporaryShortcut.Hotkey = $hotkey
    $temporaryShortcut.WindowStyle = $WindowStyle
    $temporaryShortcut.Save()
    $temporaryActual = Read-Shortcut $shell $temporaryPath
    $temporaryExpected = [ordered]@{} + $expected
    $temporaryExpected.shortcutPath = $temporaryPath
    Require-ExactShortcut $temporaryActual $temporaryExpected
    Move-Item -LiteralPath $temporaryPath -Destination $shortcutPath -Force
    $temporaryPath = $null
  }
  $actual = Read-Shortcut $shell $shortcutPath
  Require-ExactShortcut $actual $expected
  [ordered]@{
    ok = $true
    operation = $Operation
    contractVersion = $ContractVersion
    status = if ($Operation -eq 'install') { 'INSTALLED' } else { 'VALID' }
    actual = $actual
  } | ConvertTo-Json -Depth 4 -Compress
  exit 0
} catch {
  $message = [string]$_.Exception.Message
  $code = if ($message -match '^(QA_[A-Z0-9_]+(?::[A-Za-z0-9_-]+)?)') {
    $Matches[1]
  } else {
    'QA_DESKTOP_SHORTCUT_AUTOMATION_FAILED'
  }
  [ordered]@{
    ok = $false
    operation = $Operation
    contractVersion = $ContractVersion
    code = $code
  } | ConvertTo-Json -Depth 3 -Compress
  exit 1
} finally {
  if ($temporaryPath -and [IO.File]::Exists($temporaryPath)) {
    Remove-Item -LiteralPath $temporaryPath -Force -ErrorAction SilentlyContinue
  }
}
