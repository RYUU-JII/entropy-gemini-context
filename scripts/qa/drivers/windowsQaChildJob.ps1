param(
  [Parameter(Mandatory=$true)][ValidateSet('run','inspect','identity')][string]$Operation,
  [Parameter(Mandatory=$true)][ValidatePattern('^[a-f0-9-]{36}$')][string]$Token,
  [ValidateRange(1,2147483647)][int]$ProcessId
)
$ErrorActionPreference = 'Stop'
if ($Operation -eq 'identity') {
  $processIdentity = $null
  try {
    $processIdentity = [Diagnostics.Process]::GetProcessById($ProcessId)
    @{ contractVersion=1; pid=$ProcessId; processStartToken="windows-filetime:$($processIdentity.StartTime.ToFileTimeUtc())" } | ConvertTo-Json -Compress
  } catch [ArgumentException] {
    @{ contractVersion=1; pid=$ProcessId; processStartToken=$null } | ConvertTo-Json -Compress
  } finally { if ($null -ne $processIdentity) { $processIdentity.Dispose() } }
  exit 0
}
Add-Type -Path (Join-Path $PSScriptRoot 'windowsQaChildJob.cs')
$jobName = "Local\EntropyQaChild-$Token"
if ($Operation -eq 'inspect') {
  @{ contractVersion=1; jobToken=$Token; absent=[QaChildJob]::IsAbsent($jobName) } | ConvertTo-Json -Compress
  exit 0
}
[QaChildJob]::ProtectCleanupFromConsoleInterrupts()
$pipe = [IO.Pipes.NamedPipeClientStream]::new('.', "entropy-qa-child-$Token", [IO.Pipes.PipeDirection]::InOut, [IO.Pipes.PipeOptions]::Asynchronous)
$job = $null
try {
  $pipe.Connect(15000)
  $reader = [IO.StreamReader]::new($pipe, [Text.UTF8Encoding]::new($false))
  $writer = [IO.StreamWriter]::new($pipe, [Text.UTF8Encoding]::new($false))
  $writer.AutoFlush = $true
  $spec = $reader.ReadLine() | ConvertFrom-Json
  if ($spec.contractVersion -ne 1 -or $spec.jobToken -cne $Token) { throw 'QA_WINDOWS_CHILD_JOB_SPEC_INVALID' }
  $job = [QaChildJob]::new($jobName)
  $job.Launch($spec.command, [string[]]$spec.args, $spec.cwd)
  $writer.WriteLine((@{ event='prepared'; jobToken=$Token; pid=$job.Pid; processStartToken=$job.StartToken; executable=$job.Executable } | ConvertTo-Json -Compress))
  $reading = $reader.ReadLineAsync()
  $started = $false; $aborted = $false; $forced = $false; $parentLost = $false
  $deadline = [DateTime]::UtcNow.AddSeconds(15)
  $rootExitDeadline = $null
  while ($true) {
    if ($reading.IsCompleted) {
      $command = $reading.GetAwaiter().GetResult()
      if ($null -eq $command) { $parentLost=$true; $job.Terminate(); $forced=$true; break }
      if ($command -eq 'start' -and !$started -and !$aborted) { $job.Start(); $started=$true }
      elseif ($command -eq 'abort' -and !$aborted) {
        $aborted=$true
        [IO.File]::WriteAllText($spec.cancelPath, $Token, [Text.UTF8Encoding]::new($false))
        $deadline=[DateTime]::UtcNow.AddMilliseconds($(if ($started) { $spec.abortGraceMs } else { 0 }))
      } else { throw 'QA_WINDOWS_CHILD_JOB_COMMAND_INVALID' }
      $reading=$reader.ReadLineAsync()
    }
    if ($job.ActiveCount -eq 0) { break }
    if ($started -and $job.RootExited -and $null -eq $rootExitDeadline) {
      $rootExitDeadline=[DateTime]::UtcNow.AddMilliseconds($spec.stdioCloseTimeoutMs)
    }
    if ((!$started -or $aborted) -and [DateTime]::UtcNow -ge $deadline) { $job.Terminate(); $forced=$true; break }
    if ($null -ne $rootExitDeadline -and [DateTime]::UtcNow -ge $rootExitDeadline) { $job.Terminate(); $forced=$true; break }
    [Threading.Thread]::Sleep(20)
  }
  $exitDeadline=[DateTime]::UtcNow.AddMilliseconds($spec.abortTerminateMs + 1000)
  while ($job.ActiveCount -gt 0 -and [DateTime]::UtcNow -lt $exitDeadline) { [Threading.Thread]::Sleep(20) }
  if ($job.ActiveCount -ne 0) { throw 'QA_CHILD_PROCESS_TREE_CLEANUP_INCOMPLETE' }
  if (!$parentLost) {
    $cooperativeCleanup = [IO.File]::Exists("$($spec.cancelPath).ack") -and [IO.File]::ReadAllText("$($spec.cancelPath).ack") -ceq $Token
    $writer.WriteLine((@{ event='completed'; jobToken=$Token; activeProcessCount=0; rootExitCode=$job.ExitCode; started=$started; aborted=$aborted; forced=$forced; cooperativeCleanup=$cooperativeCleanup; proof='windows_job_active_process_zero' } | ConvertTo-Json -Compress))
  }
} catch {
  [Console]::Error.WriteLine($_.Exception.ToString())
  exit 1
} finally {
  if ($null -ne $job) { $job.Dispose() }
  $pipe.Dispose()
}
