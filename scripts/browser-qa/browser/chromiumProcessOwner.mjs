import { inferBrowserQaPlatform, isWindowsQaPlatform, resolveWindowsPowerShellPath } from './windowsPlatform.mjs';
import { execFile, spawn } from 'node:child_process';
import { createHash, randomBytes } from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { promisify } from 'node:util';

import {
  probeBrowserQaLoopbackTcpEndpoint,
} from '../network/loopbackTcpProbe.mjs';
import {
  inspectLinuxSpawnedProcessIdentity,
} from './linuxProcessIdentity.mjs';
import { captureChromiumStartupStderr } from './chromiumStartupStderr.mjs';
import {
  readWindowsQaMonitorInventory,
  resolveWindowsQaLaunchPlacement,
} from './windowsLaunchPlacement.mjs';

const ownedProcessRecords = new WeakMap();
const execFileAsync = promisify(execFile);
const WINDOWS_PROCESS_QUERY_TIMEOUT_MS = 10_000;
const OWNER_TOKEN_SWITCH = '--browser-qa-owner-token=';

function hasMuteAudioArgument(args) {
  return args.some((arg) => arg === '--mute-audio' || arg.startsWith('--mute-audio='));
}

function readChromiumSwitch(args, name) {
  const prefix = `--${name}=`;
  const match = args.find((argument) => argument.startsWith(prefix));
  return match ? match.slice(prefix.length) : null;
}

function readChromiumSwitchValues(args, name) {
  const prefix = `--${name}=`;
  const values = [];
  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index];
    if (argument.startsWith(prefix)) {
      values.push(argument.slice(prefix.length));
      continue;
    }
    if (argument === `--${name}`) {
      const next = args[index + 1];
      values.push(typeof next === 'string' && !next.startsWith('--') ? next : '');
    }
  }
  return values;
}

function requireSingleChromiumSwitch(args, name, {
  required = true,
} = {}) {
  const values = readChromiumSwitchValues(args, name);
  if (values.length > 1) {
    throw new Error(`QA_CHROMIUM_ENDPOINT_SWITCH_DUPLICATED:${name}`);
  }
  if (required && (values.length !== 1 || !values[0])) {
    throw new Error(`QA_CHROMIUM_ENDPOINT_SWITCH_REQUIRED:${name}`);
  }
  return values[0] || null;
}

function normalizeOwnedEndpointPath(value, {
  windowsInterop = false,
  code,
} = {}) {
  if (typeof value !== 'string' || !value.trim()) throw new Error(code);
  const portable = value.trim().replaceAll('\\', '/');
  if (windowsInterop) {
    const wsl = portable.match(/^\/mnt\/([a-z])\/(.*)$/iu);
    if (wsl) return `${wsl[1].toLowerCase()}:/${wsl[2]}`.toLowerCase();
    if (/^[a-z]:\//iu.test(portable)) return portable.toLowerCase();
    throw new Error(code);
  }
  if (!path.posix.isAbsolute(portable)) throw new Error(code);
  return path.posix.normalize(portable);
}

function createOwnedEndpointIdentityMismatch() {
  const error = new Error('QA_CHROMIUM_ENDPOINT_IDENTITY_MISMATCH');
  error.code = 'QA_CHROMIUM_ENDPOINT_IDENTITY_MISMATCH';
  return error;
}

function resolveOwnedEndpointExecutableEvidence(value, {
  expectedExecutable,
  windowsInterop = false,
} = {}) {
  const isBasenameOnly = windowsInterop
    && typeof value === 'string'
    && value.length > 0
    && value === value.trim()
    && !/[\\/]/u.test(value);
  if (isBasenameOnly) {
    if (value.toLowerCase() !== path.posix.basename(expectedExecutable)) {
      throw createOwnedEndpointIdentityMismatch();
    }
    return Object.freeze({
      executable: expectedExecutable,
      requiresWindowsCimProof: true,
    });
  }
  return Object.freeze({
    executable: normalizeOwnedEndpointPath(value, {
      windowsInterop,
      code: 'QA_CHROMIUM_ENDPOINT_EXECUTABLE_EVIDENCE_INVALID',
    }),
    requiresWindowsCimProof: false,
  });
}

function requireOwnedEndpointCommandLine(commandLine) {
  if (
    !commandLine
    || typeof commandLine !== 'object'
    || Array.isArray(commandLine)
    || !Array.isArray(commandLine.arguments)
    || commandLine.arguments.length === 0
    || commandLine.arguments.some((argument) => typeof argument !== 'string')
  ) {
    throw new Error('QA_CHROMIUM_ENDPOINT_COMMAND_LINE_INVALID');
  }
  return commandLine.arguments;
}

function normalizeLinuxChromiumIdentity(identity) {
  if (!identity || typeof identity !== 'object' || Array.isArray(identity)) {
    throw new Error('QA_LINUX_CHROMIUM_IDENTITY_REQUIRED');
  }
  const executable = identity.executable ?? identity.chromePath ?? identity.chrome;
  const userDataDir = identity.userDataDir ?? identity.profile;
  const profileDirectory = identity.profileDirectory ?? null;
  if (typeof executable !== 'string' || !path.posix.isAbsolute(executable)) {
    throw new Error('QA_LINUX_CHROMIUM_EXECUTABLE_INVALID');
  }
  if (typeof userDataDir !== 'string' || !path.posix.isAbsolute(userDataDir)) {
    throw new Error('QA_LINUX_CHROMIUM_PROFILE_INVALID');
  }
  if (
    profileDirectory !== null
    && (
      typeof profileDirectory !== 'string'
      || !profileDirectory
      || /[\\/\r\n]/u.test(profileDirectory)
    )
  ) {
    throw new Error('QA_LINUX_CHROMIUM_PROFILE_DIRECTORY_INVALID');
  }
  const remoteDebuggingPort = Number(
    identity.remoteDebuggingPort
    ?? (identity.cdpEndpoint ? new URL(identity.cdpEndpoint).port : null),
  );
  if (!Number.isSafeInteger(remoteDebuggingPort) || remoteDebuggingPort < 1_024) {
    throw new Error('QA_LINUX_CHROMIUM_DEBUG_PORT_INVALID');
  }
  return Object.freeze({
    executable: path.posix.resolve(executable),
    userDataDir: path.posix.resolve(userDataDir),
    profileDirectory,
    remoteDebuggingPort,
    ownerToken: identity.ownerToken || null,
  });
}

function normalizeLinuxChromiumProfileIdentity(identity) {
  if (!identity || typeof identity !== 'object' || Array.isArray(identity)) {
    throw new Error('QA_LINUX_CHROMIUM_PROFILE_IDENTITY_REQUIRED');
  }
  const userDataDir = identity.userDataDir ?? identity.profile;
  if (typeof userDataDir !== 'string' || !path.posix.isAbsolute(userDataDir)) {
    throw new Error('QA_LINUX_CHROMIUM_PROFILE_INVALID');
  }
  return Object.freeze({
    userDataDir: path.posix.resolve(userDataDir),
  });
}

async function listLinuxQaChromiumProfileMatches(identity, {
  procRoot = '/proc',
  readdir = fs.readdir,
  readFile = fs.readFile,
} = {}) {
  const expected = normalizeLinuxChromiumProfileIdentity(identity);
  const entries = await readdir(procRoot, { withFileTypes: true });
  const matches = [];
  for (const entry of entries) {
    if (!entry.isDirectory() || !/^\d+$/u.test(entry.name)) continue;
    const processRoot = path.posix.join(procRoot, entry.name);
    let commandLine;
    try {
      commandLine = await readFile(path.posix.join(processRoot, 'cmdline'));
    } catch {
      continue;
    }
    const args = Buffer.isBuffer(commandLine)
      ? commandLine.toString('utf8').split('\0').filter(Boolean)
      : String(commandLine).split('\0').filter(Boolean);
    if (args.some((argument) => argument.startsWith('--type='))) continue;
    const userDataDirValues = readChromiumSwitchValues(args, 'user-data-dir');
    if (
      userDataDirValues.length !== 1
      || !userDataDirValues[0]
      || !path.posix.isAbsolute(userDataDirValues[0])
      || path.posix.resolve(userDataDirValues[0]) !== expected.userDataDir
    ) {
      continue;
    }
    matches.push(Object.freeze({ pid: Number(entry.name) }));
  }
  return Object.freeze({ expected, matches: Object.freeze(matches) });
}

async function listLinuxQaChromiumIdentityMatches(identity, {
  procRoot = '/proc',
  readdir = fs.readdir,
  readFile = fs.readFile,
  realpath = fs.realpath,
} = {}) {
  const expected = normalizeLinuxChromiumIdentity(identity);
  const expectedExecutable = await realpath(expected.executable)
    .catch(() => expected.executable);
  const entries = await readdir(procRoot, { withFileTypes: true });
  const matches = [];
  for (const entry of entries) {
    if (!entry.isDirectory() || !/^\d+$/u.test(entry.name)) continue;
    const processRoot = path.posix.join(procRoot, entry.name);
    let executable;
    let commandLine;
    try {
      [executable, commandLine] = await Promise.all([
        realpath(path.posix.join(processRoot, 'exe')),
        readFile(path.posix.join(processRoot, 'cmdline')),
      ]);
    } catch {
      continue;
    }
    if (executable !== expectedExecutable) continue;
    const args = Buffer.isBuffer(commandLine)
      ? commandLine.toString('utf8').split('\0').filter(Boolean)
      : String(commandLine).split('\0').filter(Boolean);
    if (args.some((argument) => argument.startsWith('--type='))) continue;
    const actualUserDataDir = readChromiumSwitch(args, 'user-data-dir');
    if (!actualUserDataDir || path.posix.resolve(actualUserDataDir) !== expected.userDataDir) {
      continue;
    }
    if (
      expected.profileDirectory !== null
      && readChromiumSwitch(args, 'profile-directory') !== expected.profileDirectory
    ) {
      continue;
    }
    if (
      readChromiumSwitch(args, 'remote-debugging-port')
      !== String(expected.remoteDebuggingPort)
    ) {
      continue;
    }
    if (
      expected.ownerToken !== null
      && readChromiumSwitch(args, 'browser-qa-owner-token') !== expected.ownerToken
    ) {
      continue;
    }
    matches.push(Object.freeze({ pid: Number(entry.name), executable }));
  }
  return Object.freeze({ expected, matches: Object.freeze(matches) });
}

export async function inspectLinuxQaChromiumOccupancy(identity, options = {}) {
  const result = await listLinuxQaChromiumProfileMatches(identity, options);
  return Object.freeze({
    status: result.matches.length === 0 ? 'absent' : 'present',
    conflictKind: result.matches.length === 0 ? null : 'managed_user_data_dir_in_use',
    processCount: result.matches.length,
    pids: Object.freeze(result.matches.map((match) => match.pid)),
  });
}

export async function inspectLinuxQaChromiumIdentity(identity, options = {}) {
  if (
    typeof identity?.ownerToken !== 'string'
    || !/^[a-f0-9]{32}$/u.test(identity.ownerToken)
  ) {
    throw new Error('QA_LINUX_CHROMIUM_OWNER_TOKEN_REQUIRED');
  }
  if (identity.pid !== undefined && identity.pid !== null) {
    const expected = normalizeLinuxChromiumIdentity(identity);
    const result = await inspectLinuxSpawnedProcessIdentity({
      pid: identity.pid,
      executable: expected.executable,
      processStartToken: identity.processStartToken ?? null,
      requiredArgument: `${OWNER_TOKEN_SWITCH}${expected.ownerToken}`,
    }, options);
    if (result.status !== 'verified') {
      throw new Error(
        `QA_LINUX_CHROMIUM_SPAWN_IDENTITY_NOT_EXACT:${result.proof || result.status}`,
      );
    }
    const { ownerToken: _ownerToken, ...publicExpected } = expected;
    return Object.freeze({
      status: 'declared_os_process_identity_verified',
      method: result.method,
      pid: result.pid,
      processStartToken: result.processStartToken,
      ...publicExpected,
    });
  }
  const result = await listLinuxQaChromiumIdentityMatches(identity, options);
  if (result.matches.length !== 1) {
    throw new Error(`QA_LINUX_CHROMIUM_IDENTITY_NOT_EXACT:matches=${result.matches.length}`);
  }
  const { ownerToken: _ownerToken, ...publicExpected } = result.expected;
  return Object.freeze({
    status: 'declared_os_process_identity_verified',
    method: 'linux_procfs_exact_arguments',
    pid: result.matches[0].pid,
    ...publicExpected,
  });
}

export async function inspectLinuxQaChromiumDeclaredIdentity(identity, options = {}) {
  const result = await listLinuxQaChromiumIdentityMatches(
    { ...identity, ownerToken: null },
    options,
  );
  if (result.matches.length !== 1) {
    throw new Error(
      `QA_LINUX_CHROMIUM_DECLARED_IDENTITY_NOT_EXACT:matches=${result.matches.length}`,
    );
  }
  const { ownerToken: _ownerToken, ...publicExpected } = result.expected;
  return Object.freeze({
    status: 'declared_os_process_identity_verified',
    method: 'linux_procfs_exact_arguments',
    pid: result.matches[0].pid,
    ...publicExpected,
  });
}

export async function terminateLinuxQaChromiumByIdentity(identity, {
  killProcess = process.kill,
  pollIntervalMs = 50,
  terminateTimeoutMs = 2_000,
  killTimeoutMs = 2_000,
  inspectProcessIdentity = inspectLinuxSpawnedProcessIdentity,
  ...processOptions
} = {}) {
  if (
    typeof identity?.ownerToken !== 'string'
    || !/^[a-f0-9]{32}$/u.test(identity.ownerToken)
  ) {
    throw new Error('QA_LINUX_CHROMIUM_OWNER_TOKEN_REQUIRED');
  }
  if (!Number.isSafeInteger(identity?.pid) || identity.pid < 1) {
    throw new Error('QA_LINUX_CHROMIUM_OWNED_PID_REQUIRED');
  }
  if (
    typeof identity?.processStartToken !== 'string'
    || !/^linux-proc:\d+$/u.test(identity.processStartToken)
  ) {
    throw new Error('QA_LINUX_CHROMIUM_PROCESS_START_TOKEN_REQUIRED');
  }
  const expected = normalizeLinuxChromiumIdentity(identity);
  const inspect = () => inspectProcessIdentity({
    pid: identity.pid,
    executable: expected.executable,
    processStartToken: identity.processStartToken,
    requiredArgument: `${OWNER_TOKEN_SWITCH}${expected.ownerToken}`,
  }, processOptions);
  const initial = await inspect();
  if (
    initial.status === 'absent'
    || (
      initial.status === 'mismatch'
      && initial.proof === 'pid_reused_with_different_start_token'
    )
  ) {
    return Object.freeze({
      resource: 'chromium_process',
      status: 'already_absent',
      processCount: 0,
      processAction: 'linux_spawn_pid_start_token_absence_confirmed',
    });
  }
  if (initial.status !== 'verified') {
    throw new Error(
      `QA_LINUX_CHROMIUM_TERMINATION_IDENTITY_MISMATCH:${initial.proof || initial.status}`,
    );
  }
  const waitForAbsence = async (timeoutMs) => {
    const deadline = Date.now() + timeoutMs;
    do {
      const current = await inspect();
      if (
        current.status === 'absent'
        || (
          current.status === 'mismatch'
          && current.proof === 'pid_reused_with_different_start_token'
        )
      ) {
        return true;
      }
      if (current.status !== 'verified') {
        throw new Error(
          `QA_LINUX_CHROMIUM_TERMINATION_IDENTITY_CHANGED:${current.proof || current.status}`,
        );
      }
      await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));
    } while (Date.now() < deadline);
    return false;
  };
  killProcess(initial.pid, 'SIGTERM');
  if (!await waitForAbsence(terminateTimeoutMs)) {
    const remaining = await inspect();
    if (remaining.status === 'verified') {
      killProcess(remaining.pid, 'SIGKILL');
    }
    if (!await waitForAbsence(killTimeoutMs)) {
      throw new Error('QA_LINUX_CHROMIUM_TERMINATION_UNCONFIRMED');
    }
  }
  return Object.freeze({
    resource: 'chromium_process',
    status: 'terminated',
    processCount: 1,
    processAction: 'linux_spawn_pid_start_token_process_terminated',
  });
}

function escapeRegexLiteral(value) {
  return String(value).replace(/[\\^$.*+?()[\]{}|]/gu, '\\$&');
}

export function buildWindowsChromiumSwitchArgumentPattern(switchName, value) {
  if (
    typeof switchName !== 'string'
    || !/^[a-z][a-z0-9-]*$/u.test(switchName)
    || typeof value !== 'string'
    || !value
    || /[\r\n"]/u.test(value)
  ) {
    throw new Error('QA_WINDOWS_CHROMIUM_SWITCH_ARGUMENT_INVALID');
  }
  const escaped = escapeRegexLiteral(value);
  const variants = [
    `"--${switchName}=${escaped}"`,
    `--${switchName}="${escaped}"`,
    `(?:"--${switchName}"|--${switchName})\\s+"${escaped}"`,
  ];
  if (!/\s/u.test(value)) {
    variants.push(
      `--${switchName}=${escaped}`,
      `(?:"--${switchName}"|--${switchName})\\s+${escaped}`,
    );
  }
  return `(?:^|\\s)(?:${variants.join('|')})(?=\\s|$)`;
}

function toNativeWindowsPath(value, code) {
  if (typeof value !== 'string' || !value || /[\r\n"]/u.test(value)) {
    throw new Error(code);
  }
  const normalized = value.replaceAll('/', '\\');
  const wsl = normalized.match(/^\\mnt\\([a-z])\\(.*)$/iu);
  if (wsl) return `${wsl[1].toUpperCase()}:\\${wsl[2]}`;
  if (/^[a-z]:\\/iu.test(normalized) || normalized.startsWith('\\\\')) {
    return normalized;
  }
  throw new Error(code);
}

function normalizeWindowsChromiumIdentity(identity) {
  if (!identity || typeof identity !== 'object' || Array.isArray(identity)) {
    throw new Error('QA_WINDOWS_CHROMIUM_IDENTITY_REQUIRED');
  }
  const executable = toNativeWindowsPath(
    identity.executable ?? identity.chromePath ?? identity.chrome,
    'QA_WINDOWS_CHROMIUM_EXECUTABLE_INVALID',
  );
  const userDataDir = toNativeWindowsPath(
    identity.userDataDir ?? identity.profile,
    'QA_WINDOWS_CHROMIUM_PROFILE_INVALID',
  );
  const profileDirectory = identity.profileDirectory ?? null;
  if (
    profileDirectory !== null
    && (
      typeof profileDirectory !== 'string'
      || !profileDirectory
      || /[\\/\r\n"]/u.test(profileDirectory)
    )
  ) {
    throw new Error('QA_WINDOWS_CHROMIUM_PROFILE_DIRECTORY_INVALID');
  }
  const cdpPort = identity.remoteDebuggingPort
    ?? (identity.cdpEndpoint ? Number(new URL(identity.cdpEndpoint).port) : null);
  if (!Number.isSafeInteger(Number(cdpPort)) || Number(cdpPort) < 1_024) {
    throw new Error('QA_WINDOWS_CHROMIUM_DEBUG_PORT_INVALID');
  }
  return Object.freeze({
    executable,
    userDataDir,
    profileDirectory,
    remoteDebuggingPort: Number(cdpPort),
  });
}

function normalizeWindowsChromiumProfileIdentity(identity) {
  if (!identity || typeof identity !== 'object' || Array.isArray(identity)) {
    throw new Error('QA_WINDOWS_CHROMIUM_PROFILE_IDENTITY_REQUIRED');
  }
  const userDataDir = toNativeWindowsPath(
    identity.userDataDir ?? identity.profile,
    'QA_WINDOWS_CHROMIUM_PROFILE_INVALID',
  );
  return Object.freeze({ userDataDir });
}

function powershellDecode(name, value) {
  const encoded = Buffer.from(value, 'utf8').toString('base64');
  return `$${name}=[Text.Encoding]::UTF8.GetString([Convert]::FromBase64String('${encoded}'))`;
}

function windowsProcessQueryFailureDetail(error) {
  const rawExitCode = typeof error?.code === 'string' || Number.isInteger(error?.code)
    ? String(error.code)
    : 'command_failed';
  const exitCode = /^[a-z0-9_.-]+$/iu.test(rawExitCode)
    ? rawExitCode
    : 'command_failed';
  const fullyQualifiedErrorId = String(error?.stderr || '').match(
    /FullyQualifiedErrorId\s*:\s*([a-z0-9_.-]+)/iu,
  )?.[1] || null;
  return fullyQualifiedErrorId
    ? `${exitCode}:${fullyQualifiedErrorId}`
    : exitCode;
}

async function runWslWindowsChromiumIdentityAction(identity, {
  action,
  execFileImpl = execFileAsync,
  powershellPath = null,
} = {}) {
  const expected = normalizeWindowsChromiumIdentity(identity);
  const profilePattern = buildWindowsChromiumSwitchArgumentPattern(
    'user-data-dir',
    expected.userDataDir,
  );
  const profileDirectoryPattern = expected.profileDirectory
    ? buildWindowsChromiumSwitchArgumentPattern(
      'profile-directory',
      expected.profileDirectory,
    )
    : null;
  const debugPortPattern = buildWindowsChromiumSwitchArgumentPattern(
    'remote-debugging-port',
    String(expected.remoteDebuggingPort),
  );
  const ownerTokenPattern = identity.ownerToken
    ? buildWindowsChromiumSwitchArgumentPattern(
      'browser-qa-owner-token',
      identity.ownerToken,
    )
    : null;
  const declaredExecutable = identity.executable ?? identity.chromePath ?? identity.chrome;
  const driveMount = String(declaredExecutable).match(/^\/mnt\/[a-z]/iu)?.[0]
    || '/mnt/c';
  const resolvedPowershell = powershellPath || resolveWindowsPowerShellPath({ wslDriveMount: driveMount });
  const ownedProcessPredicate = [
    '$_.ExecutablePath',
    '[string]::Equals([string]$_.ExecutablePath,$expectedExecutable,[StringComparison]::OrdinalIgnoreCase)',
    '$_.CommandLine',
    '$_.CommandLine -notmatch "(?:^|\\s)--type(?:=|\\s|$)"',
    '[Text.RegularExpressions.Regex]::IsMatch([string]$_.CommandLine,$profilePattern,$regexOptions)',
    '[Text.RegularExpressions.Regex]::IsMatch([string]$_.CommandLine,$debugPortPattern,$regexOptions)',
    '(-not $profileDirectoryPattern -or [Text.RegularExpressions.Regex]::IsMatch([string]$_.CommandLine,$profileDirectoryPattern,$regexOptions))',
    '(-not $ownerTokenPattern -or [Text.RegularExpressions.Regex]::IsMatch([string]$_.CommandLine,$ownerTokenPattern,$regexOptions))',
  ].join(' -and ');
  const script = [
    "$ErrorActionPreference='Stop'",
    powershellDecode('expectedExecutable', expected.executable),
    powershellDecode('profilePattern', profilePattern),
    powershellDecode('debugPortPattern', debugPortPattern),
    profileDirectoryPattern
      ? powershellDecode('profileDirectoryPattern', profileDirectoryPattern)
      : '$profileDirectoryPattern=$null',
    ownerTokenPattern
      ? powershellDecode('ownerTokenPattern', ownerTokenPattern)
      : '$ownerTokenPattern=$null',
    '$regexOptions=[Text.RegularExpressions.RegexOptions]::IgnoreCase -bor [Text.RegularExpressions.RegexOptions]::CultureInvariant',
    'function Get-OwnedBrowserQaChromium {',
    '  @(Get-CimInstance Win32_Process | Where-Object {',
    `    ${ownedProcessPredicate}`,
    '  })',
    '}',
    '$initial=@(Get-OwnedBrowserQaChromium)',
    ...(action === 'terminate' ? [
      '$initial | ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }',
      '$deadline=[DateTime]::UtcNow.AddMilliseconds(4000)',
      'while ([DateTime]::UtcNow -lt $deadline -and @(Get-OwnedBrowserQaChromium).Count -gt 0) { Start-Sleep -Milliseconds 100 }',
      'if (@(Get-OwnedBrowserQaChromium).Count -gt 0) { throw "QA_WINDOWS_CHROMIUM_TERMINATION_UNCONFIRMED" }',
    ] : []),
    '$payload=@($initial | ForEach-Object { @{ pid=[int]$_.ProcessId; executable=[string]$_.ExecutablePath } })',
    '[Console]::Out.Write((ConvertTo-Json -InputObject $payload -Compress))',
  ].join(';');
  let stdout;
  try {
    ({ stdout } = await execFileImpl(resolvedPowershell, [
      '-NoProfile',
      '-NonInteractive',
      '-Command',
      script,
    ], {
      encoding: 'utf8',
      timeout: WINDOWS_PROCESS_QUERY_TIMEOUT_MS,
      maxBuffer: 64 * 1024,
    }));
  } catch (error) {
    throw new Error(
      `QA_WINDOWS_CHROMIUM_${action === 'terminate' ? 'TERMINATION' : 'IDENTITY'}_FAILED:${windowsProcessQueryFailureDetail(error)}`,
    );
  }
  let matches;
  try {
    matches = JSON.parse(stdout || '[]');
  } catch (error) {
    throw new Error('QA_WINDOWS_CHROMIUM_IDENTITY_OUTPUT_INVALID', { cause: error });
  }
  if (!Array.isArray(matches)) {
    throw new Error('QA_WINDOWS_CHROMIUM_IDENTITY_OUTPUT_INVALID');
  }
  return Object.freeze({ expected, matches: Object.freeze(matches) });
}

async function listWslWindowsQaChromiumProfileMatches(identity, {
  execFileImpl = execFileAsync,
  powershellPath = null,
} = {}) {
  const expected = normalizeWindowsChromiumProfileIdentity(identity);
  const profilePattern = buildWindowsChromiumSwitchArgumentPattern(
    'user-data-dir',
    expected.userDataDir,
  );
  const declaredExecutable = identity.executable ?? identity.chromePath ?? identity.chrome;
  const driveMount = String(declaredExecutable).match(/^\/mnt\/[a-z]/iu)?.[0]
    || String(identity.userDataDir ?? identity.profile).match(/^\/mnt\/[a-z]/iu)?.[0]
    || '/mnt/c';
  const resolvedPowershell = powershellPath || resolveWindowsPowerShellPath({ wslDriveMount: driveMount });
  const profileOccupancyPredicate = [
    '$_.ExecutablePath',
    '$_.CommandLine',
    '$_.CommandLine -notmatch "(?:^|\\s)--type(?:=|\\s|$)"',
    '[Text.RegularExpressions.Regex]::IsMatch([string]$_.CommandLine,$profilePattern,$regexOptions)',
  ].join(' -and ');
  const script = [
    "$ErrorActionPreference='Stop'",
    powershellDecode('profilePattern', profilePattern),
    '$regexOptions=[Text.RegularExpressions.RegexOptions]::IgnoreCase -bor [Text.RegularExpressions.RegexOptions]::CultureInvariant',
    'function Get-BrowserQaManagedProfileOccupant {',
    '  @(Get-CimInstance Win32_Process | Where-Object {',
    `    ${profileOccupancyPredicate}`,
    '  })',
    '}',
    '$matches=@(Get-BrowserQaManagedProfileOccupant)',
    '$payload=@($matches | ForEach-Object { @{ pid=[int]$_.ProcessId } })',
    '[Console]::Out.Write((ConvertTo-Json -InputObject $payload -Compress))',
  ].join(';');
  let stdout;
  try {
    ({ stdout } = await execFileImpl(resolvedPowershell, [
      '-NoProfile',
      '-NonInteractive',
      '-Command',
      script,
    ], {
      encoding: 'utf8',
      timeout: WINDOWS_PROCESS_QUERY_TIMEOUT_MS,
      maxBuffer: 64 * 1024,
    }));
  } catch (error) {
    throw new Error(
      `QA_WINDOWS_CHROMIUM_PROFILE_OCCUPANCY_FAILED:${windowsProcessQueryFailureDetail(error)}`,
    );
  }
  let matches;
  try {
    matches = JSON.parse(stdout || '[]');
  } catch (error) {
    throw new Error('QA_WINDOWS_CHROMIUM_PROFILE_OCCUPANCY_OUTPUT_INVALID', {
      cause: error,
    });
  }
  if (!Array.isArray(matches)) {
    throw new Error('QA_WINDOWS_CHROMIUM_PROFILE_OCCUPANCY_OUTPUT_INVALID');
  }
  return Object.freeze({ expected, matches: Object.freeze(matches) });
}

export async function inspectWslWindowsQaChromiumIdentity(identity, options = {}) {
  const result = await runWslWindowsChromiumIdentityAction(identity, {
    ...options,
    action: 'inspect',
  });
  if (result.matches.length !== 1) {
    throw new Error(`QA_WINDOWS_CHROMIUM_IDENTITY_NOT_EXACT:matches=${result.matches.length}`);
  }
  return Object.freeze({
    status: 'declared_os_process_identity_verified',
    method: 'windows_cim_exact_arguments',
    pid: result.matches[0].pid,
    ...result.expected,
  });
}

export async function inspectWslWindowsQaChromiumOccupancy(identity, options = {}) {
  const result = await listWslWindowsQaChromiumProfileMatches(identity, options);
  return Object.freeze({
    status: result.matches.length === 0 ? 'absent' : 'present',
    conflictKind: result.matches.length === 0 ? null : 'managed_user_data_dir_in_use',
    processCount: result.matches.length,
    pids: Object.freeze(result.matches.map((match) => match.pid)),
  });
}

export async function terminateWslWindowsQaChromiumByIdentity(identity, options = {}) {
  if (
    typeof identity?.ownerToken !== 'string'
    || !/^[a-f0-9]{32}$/u.test(identity.ownerToken)
  ) {
    throw new Error('QA_WINDOWS_CHROMIUM_OWNER_TOKEN_REQUIRED');
  }
  const result = await runWslWindowsChromiumIdentityAction(identity, {
    ...options,
    action: 'terminate',
  });
  return Object.freeze({
    resource: 'chromium_process',
    status: result.matches.length === 0 ? 'already_absent' : 'terminated',
    processCount: result.matches.length,
    processAction: 'exact_windows_cim_identity_terminated',
  });
}

/**
 * Stops the browsers occupying one declared managed profile slot.
 *
 * Identity is the same proof the occupancy inspector uses: a root Chrome process
 * (no `--type=`) whose command line carries this slot's exact `--user-data-dir`.
 * That is what makes a stop safe without an owner token — the token proves "this
 * process is the one we launched", which a stop against an externally started
 * managed browser cannot know, while the user-data-dir proves "this process is
 * the declared dedicated QA profile", which is the property that actually
 * authorizes termination. A personal browser never matches.
 */
export async function terminateQaManagedPersistentChromiumOccupants({
  platform,
  expectedBrowserIdentity,
} = {}, options = {}) {
  const listMatches = isWindowsQaPlatform(platform)
    ? listWslWindowsQaChromiumProfileMatches
    : platform === 'linux'
      ? listLinuxQaChromiumProfileMatches
      : null;
  if (!listMatches) {
    throw new Error('QA_MANAGED_PERSISTENT_PLATFORM_INVALID');
  }
  const { killWindowsProcess = killWindowsProcessTree, killProcess = process.kill } = options;
  const before = await listMatches(expectedBrowserIdentity, options);
  if (before.matches.length === 0) {
    return Object.freeze({
      status: 'terminated',
      processAction: 'managed_profile_occupants_already_absent',
      pids: Object.freeze([]),
    });
  }
  const pids = before.matches.map((match) => match.pid);
  for (const pid of pids) {
    if (isWindowsQaPlatform(platform)) {
      // eslint-disable-next-line no-await-in-loop
      await killWindowsProcess(pid, expectedBrowserIdentity, options);
    } else {
      killProcess(pid, 'SIGTERM');
    }
  }
  return Object.freeze({
    status: 'terminated',
    processAction: isWindowsQaPlatform(platform)
      ? 'windows_managed_profile_occupants_terminated'
      : 'linux_managed_profile_occupants_terminated',
    pids: Object.freeze(pids),
  });
}

async function killWindowsProcessTree(pid, identity, {
  execFileImpl = execFileAsync,
  powershellPath = null,
} = {}) {
  if (!Number.isSafeInteger(pid) || pid <= 0) {
    throw new Error(`QA_WINDOWS_CHROMIUM_TERMINATION_PID_INVALID:${String(pid)}`);
  }
  const declaredExecutable = identity?.executable ?? identity?.chromePath ?? identity?.chrome;
  const driveMount = String(declaredExecutable).match(/^\/mnt\/[a-z]/iu)?.[0]
    || String(identity?.userDataDir ?? identity?.profile).match(/^\/mnt\/[a-z]/iu)?.[0]
    || '/mnt/c';
  const resolved = powershellPath || resolveWindowsPowerShellPath({ wslDriveMount: driveMount });
  try {
    await execFileImpl(resolved, [
      '-NoProfile',
      '-NonInteractive',
      '-Command',
      `Stop-Process -Id ${pid} -Force -ErrorAction Stop`,
    ], { encoding: 'utf8', timeout: WINDOWS_PROCESS_QUERY_TIMEOUT_MS, maxBuffer: 64 * 1024 });
  } catch (error) {
    throw new Error(
      `QA_WINDOWS_CHROMIUM_TERMINATION_FAILED:${windowsProcessQueryFailureDetail(error)}`,
    );
  }
}

export async function inspectQaManagedPersistentChromiumOccupancy({
  platform,
  expectedBrowserIdentity,
} = {}, options = {}) {
  const {
    tcpProbe = probeBrowserQaLoopbackTcpEndpoint,
    tcpProbeOptions = {},
    ...processInspectionOptions
  } = options;
  if (typeof tcpProbe !== 'function') {
    throw new Error('QA_MANAGED_PERSISTENT_TCP_PROBE_REQUIRED');
  }
  const processInspectionPromise = isWindowsQaPlatform(platform)
    ? inspectWslWindowsQaChromiumOccupancy(
      expectedBrowserIdentity,
      processInspectionOptions,
    )
    : platform === 'linux'
      ? inspectLinuxQaChromiumOccupancy(
        expectedBrowserIdentity,
        processInspectionOptions,
      )
      : null;
  if (!processInspectionPromise) {
    throw new Error('QA_MANAGED_PERSISTENT_PLATFORM_INVALID');
  }
  const [processInspection, tcpInspection] = await Promise.all([
    processInspectionPromise,
    Promise.resolve().then(() => (
      tcpProbe(expectedBrowserIdentity?.cdpEndpoint, tcpProbeOptions)
    )),
  ]);
  if (!['reachable', 'unavailable'].includes(tcpInspection?.status)) {
    throw new Error('QA_MANAGED_PERSISTENT_TCP_PROBE_RESULT_INVALID');
  }
  if (processInspection.status === 'present') {
    return Object.freeze({
      ...processInspection,
      cdpPortStatus: tcpInspection.status,
    });
  }
  if (processInspection.status !== 'absent') {
    throw new Error('QA_MANAGED_PERSISTENT_PROCESS_INSPECTION_RESULT_INVALID');
  }
  if (tcpInspection.status === 'reachable') {
    return Object.freeze({
      status: 'present',
      conflictKind: 'cdp_port_in_use',
      processCount: 0,
      pids: Object.freeze([]),
      cdpPortStatus: 'reachable',
    });
  }
  return Object.freeze({
    ...processInspection,
    cdpPortStatus: 'unavailable',
  });
}

export function resolveQaChromiumProcessArgs(args, audioPolicy = 'muted') {
  if (!Array.isArray(args) || args.some((arg) => typeof arg !== 'string')) {
    throw new Error('QA_CHROMIUM_PROCESS_ARGUMENTS_INVALID');
  }
  if (!['muted', 'audible'].includes(audioPolicy)) {
    throw new Error(`QA_CHROMIUM_PROCESS_AUDIO_POLICY_INVALID:${audioPolicy}`);
  }
  const callerSuppliedMute = hasMuteAudioArgument(args);
  if (audioPolicy === 'audible' && callerSuppliedMute) {
    throw new Error('QA_CHROMIUM_PROCESS_AUDIO_POLICY_CONFLICT:audible:--mute-audio');
  }
  return Object.freeze(
    audioPolicy === 'muted' && !callerSuppliedMute
      ? [...args, '--mute-audio']
      : [...args],
  );
}

export function launchQaOwnedChromiumProcess({
  chromePath,
  args,
  audioPolicy = 'muted',
  launchEnvironment = {},
  stdio = ['ignore', 'ignore', 'pipe'],
  detached = false,
  spawnProcess = spawn,
  monitorInventory = readWindowsQaMonitorInventory,
} = {}) {
  if (typeof chromePath !== 'string' || !path.isAbsolute(chromePath)) {
    throw new Error('QA_CHROMIUM_PROCESS_EXECUTABLE_ABSOLUTE_REQUIRED');
  }
  const policyArgs = resolveQaChromiumProcessArgs(args, audioPolicy);
  if (policyArgs.some((argument) => (
    argument === '--browser-qa-owner-token'
    || argument.startsWith(OWNER_TOKEN_SWITCH)
  ))) {
    throw new Error('QA_CHROMIUM_PROCESS_OWNER_TOKEN_CALLER_FORBIDDEN');
  }
  const ownerToken = randomBytes(16).toString('hex');
  const windowPlacement = resolveWindowsQaLaunchPlacement({
    args: policyArgs,
    platform: inferBrowserQaPlatform(chromePath),
    monitorInventory,
  });
  const launchArgs = Object.freeze([
    ...windowPlacement.args,
    `${OWNER_TOKEN_SWITCH}${ownerToken}`,
  ]);
  if (
    !launchEnvironment
    || typeof launchEnvironment !== 'object'
    || Array.isArray(launchEnvironment)
    || Object.values(launchEnvironment).some((value) => typeof value !== 'string')
  ) {
    throw new Error('QA_CHROMIUM_PROCESS_ENVIRONMENT_INVALID');
  }
  if (typeof spawnProcess !== 'function') {
    throw new Error('QA_CHROMIUM_PROCESS_SPAWN_OWNER_INVALID');
  }
  const child = spawnProcess(chromePath, launchArgs, {
    stdio,
    detached,
    windowsHide: true,
    env: {
      ...process.env,
      ...launchEnvironment,
    },
  });
  if (
    !child
    || typeof child !== 'object'
    || typeof child.kill !== 'function'
    || typeof child.once !== 'function'
  ) {
    throw new Error('QA_CHROMIUM_PROCESS_HANDLE_INVALID');
  }
  const receipt = Object.freeze({
    processOwnership: 'owned',
    executablePath: chromePath,
    args: Object.freeze(
      launchArgs.filter((argument) => !argument.startsWith(OWNER_TOKEN_SWITCH)),
    ),
    audioPolicy,
    windowPlacement: windowPlacement.receipt,
    pid: Number.isSafeInteger(child.pid) ? child.pid : null,
    ownerTokenSha256: createHash('sha256').update(ownerToken).digest('hex'),
    launchedAt: new Date().toISOString(),
  });
  ownedProcessRecords.set(child, {
    receipt,
    ownerToken,
    osProcessIdentity: null,
    windowsIdentity: isWindowsQaPlatform(inferBrowserQaPlatform(chromePath))
      ? Object.freeze({
        executable: chromePath,
        userDataDir: readChromiumSwitch(launchArgs, 'user-data-dir'),
        profileDirectory: readChromiumSwitch(launchArgs, 'profile-directory'),
        remoteDebuggingPort: Number(readChromiumSwitch(
          launchArgs,
          'remote-debugging-port',
        )),
        ownerToken,
      })
      : null,
    spawnError: null,
    terminationPromise: null,
    terminated: false,
  });
  child.once('error', (error) => {
    const record = ownedProcessRecords.get(child);
    if (record) record.spawnError = error;
  });
  return child;
}

function isProcessExited(child) {
  return child.exitCode !== null || child.signalCode !== null;
}

function waitForExit(child, timeoutMs) {
  if (isProcessExited(child)) return Promise.resolve(true);
  return new Promise((resolve) => {
    let settled = false;
    const finish = (exited) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      child.off?.('exit', onExit);
      resolve(exited);
    };
    const onExit = () => finish(true);
    const timer = setTimeout(() => finish(isProcessExited(child)), timeoutMs);
    child.once('exit', onExit);
  });
}

export function readQaOwnedChromiumProcessReceipt(child) {
  return ownedProcessRecords.get(child)?.receipt || null;
}

export function readQaOwnedChromiumRecoveryIdentity(child, {
  platform = process.platform,
} = {}) {
  const record = ownedProcessRecords.get(child);
  if (!record) throw new Error('QA_CHROMIUM_PROCESS_NOT_OWNED');
  const launchArgs = record.receipt.args;
  const windowsInterop = record.windowsIdentity !== null;
  const recoveryPlatform = windowsInterop
    ? inferBrowserQaPlatform(record.receipt.executablePath)
    : platform === 'linux'
      ? 'linux'
      : null;
  if (!recoveryPlatform) {
    throw new Error(`QA_CHROMIUM_RECOVERY_PLATFORM_UNSUPPORTED:${platform}`);
  }
  const userDataDir = requireSingleChromiumSwitch(launchArgs, 'user-data-dir');
  const profileDirectory = requireSingleChromiumSwitch(
    launchArgs,
    'profile-directory',
    { required: false },
  );
  const remoteDebuggingPort = Number(requireSingleChromiumSwitch(
    launchArgs,
    'remote-debugging-port',
  ));
  if (!Number.isSafeInteger(remoteDebuggingPort) || remoteDebuggingPort < 1_024) {
    throw new Error('QA_CHROMIUM_RECOVERY_DEBUG_PORT_INVALID');
  }
  if (
    recoveryPlatform === 'linux'
    && (
      record.osProcessIdentity?.status
        !== 'declared_os_process_identity_verified'
      || record.osProcessIdentity.pid !== record.receipt.pid
      || typeof record.osProcessIdentity.processStartToken !== 'string'
      || !/^linux-proc:\d+$/u.test(record.osProcessIdentity.processStartToken)
    )
  ) {
    throw new Error('QA_CHROMIUM_RECOVERY_OS_IDENTITY_UNVERIFIED');
  }
  return Object.freeze({
    contractVersion: 1,
    platform: recoveryPlatform,
    executable: record.receipt.executablePath,
    userDataDir,
    profileDirectory,
    remoteDebuggingPort,
    ownerToken: record.ownerToken,
    ownerTokenSha256: record.receipt.ownerTokenSha256,
    pid: record.receipt.pid,
    processStartToken: recoveryPlatform === 'linux'
      ? record.osProcessIdentity.processStartToken
      : null,
  });
}

/**
 * Admits a CDP connection only when its browser command line carries the
 * unexported nonce of this exact spawned child and the complete launch tuple.
 * The nonce links the endpoint to the spawn; Linux additionally pins the
 * child PID, process-start token, executable, and capability argument without
 * relying on Chromium's mutable process-title argv representation.
 */
export async function verifyQaOwnedChromiumEndpointIdentity(child, cdp, {
  inspectProcessIdentity = null,
  platform = process.platform,
} = {}) {
  const record = ownedProcessRecords.get(child);
  if (!record) throw new Error('QA_CHROMIUM_PROCESS_NOT_OWNED');
  if (record.receipt.processOwnership !== 'owned') {
    throw new Error('QA_CHROMIUM_PROCESS_OWNERSHIP_TRANSFERRED');
  }
  if (!cdp || typeof cdp.send !== 'function') {
    throw new Error('QA_CHROMIUM_ENDPOINT_CDP_CONNECTION_REQUIRED');
  }
  const launchArgs = record.receipt.args;
  if (!launchArgs.includes('--enable-automation')) {
    throw new Error('QA_CHROMIUM_ENDPOINT_COMMAND_LINE_EVIDENCE_NOT_ENABLED');
  }
  const expectedUserDataDir = requireSingleChromiumSwitch(
    launchArgs,
    'user-data-dir',
  );
  const expectedProfileDirectory = requireSingleChromiumSwitch(
    launchArgs,
    'profile-directory',
    { required: false },
  );
  const expectedDebugPort = requireSingleChromiumSwitch(
    launchArgs,
    'remote-debugging-port',
  );
  const windowsInterop = record.windowsIdentity !== null;
  const actualArgs = requireOwnedEndpointCommandLine(
    await cdp.send('Browser.getBrowserCommandLine'),
  );
  const actualExecutable = actualArgs[0];
  const actualUserDataDir = requireSingleChromiumSwitch(
    actualArgs,
    'user-data-dir',
  );
  const actualProfileDirectory = requireSingleChromiumSwitch(
    actualArgs,
    'profile-directory',
    { required: false },
  );
  const actualDebugPort = requireSingleChromiumSwitch(
    actualArgs,
    'remote-debugging-port',
  );
  const actualOwnerToken = requireSingleChromiumSwitch(
    actualArgs,
    'browser-qa-owner-token',
  );
  const expectedExecutable = normalizeOwnedEndpointPath(
    record.receipt.executablePath,
    {
      windowsInterop,
      code: 'QA_CHROMIUM_ENDPOINT_EXPECTED_EXECUTABLE_INVALID',
    },
  );
  const actualExecutableEvidence = resolveOwnedEndpointExecutableEvidence(
    actualExecutable,
    {
      expectedExecutable,
      windowsInterop,
    },
  );
  const normalizedActualExecutable = actualExecutableEvidence.executable;
  const normalizedExpectedUserDataDir = normalizeOwnedEndpointPath(
    expectedUserDataDir,
    {
      windowsInterop,
      code: 'QA_CHROMIUM_ENDPOINT_EXPECTED_PROFILE_INVALID',
    },
  );
  const normalizedActualUserDataDir = normalizeOwnedEndpointPath(
    actualUserDataDir,
    {
      windowsInterop,
      code: 'QA_CHROMIUM_ENDPOINT_PROFILE_EVIDENCE_INVALID',
    },
  );
  const profileDirectoryMatches = windowsInterop
    ? actualProfileDirectory?.toLowerCase()
      === expectedProfileDirectory?.toLowerCase()
    : actualProfileDirectory === expectedProfileDirectory;
  if (
    normalizedActualExecutable !== expectedExecutable
    || normalizedActualUserDataDir !== normalizedExpectedUserDataDir
    || !profileDirectoryMatches
    || actualDebugPort !== expectedDebugPort
    || actualOwnerToken !== record.ownerToken
  ) {
    throw createOwnedEndpointIdentityMismatch();
  }

  let osProcessIdentity = null;
  const expectedOsIdentity = record.windowsIdentity || Object.freeze({
    executable: record.receipt.executablePath,
    userDataDir: expectedUserDataDir,
    profileDirectory: expectedProfileDirectory,
    remoteDebuggingPort: Number(expectedDebugPort),
    ownerToken: record.ownerToken,
    pid: record.receipt.pid,
    processStartToken: record.osProcessIdentity?.processStartToken ?? null,
  });
  const verifier = inspectProcessIdentity || (windowsInterop
    ? inspectWslWindowsQaChromiumIdentity
    : platform === 'linux'
      ? inspectLinuxQaChromiumIdentity
      : null);
  if (
    actualExecutableEvidence.requiresWindowsCimProof
    && typeof verifier !== 'function'
  ) {
    throw new Error('QA_CHROMIUM_ENDPOINT_OS_IDENTITY_UNVERIFIED');
  }
  if (verifier) {
    osProcessIdentity = await verifier(expectedOsIdentity);
    const linuxSpawnProofInvalid = !windowsInterop
      && platform === 'linux'
      && (
        osProcessIdentity?.pid !== record.receipt.pid
        || typeof osProcessIdentity?.processStartToken !== 'string'
        || !/^linux-proc:\d+$/u.test(osProcessIdentity.processStartToken)
      );
    if (
      osProcessIdentity?.status !== 'declared_os_process_identity_verified'
      || linuxSpawnProofInvalid
      || (
        actualExecutableEvidence.requiresWindowsCimProof
        && (
          osProcessIdentity.method !== 'windows_cim_exact_arguments'
          || !Number.isSafeInteger(osProcessIdentity.pid)
          || osProcessIdentity.pid < 1
        )
      )
    ) {
      throw new Error('QA_CHROMIUM_ENDPOINT_OS_IDENTITY_UNVERIFIED');
    }
    record.osProcessIdentity = Object.freeze({ ...osProcessIdentity });
  }
  return Object.freeze({
    status: 'owned_endpoint_identity_verified',
    executable: expectedExecutable,
    userDataDir: normalizedExpectedUserDataDir,
    profileDirectory: expectedProfileDirectory,
    remoteDebuggingPort: Number(expectedDebugPort),
    proof: Object.freeze({
      method: osProcessIdentity
        ? `owner_token_command_line+${osProcessIdentity.method}`
        : 'owner_token_command_line',
      pid: Number.isSafeInteger(osProcessIdentity?.pid)
        ? osProcessIdentity.pid
        : record.receipt.pid,
      processStartToken: typeof osProcessIdentity?.processStartToken === 'string'
        ? osProcessIdentity.processStartToken
        : null,
      ownerTokenSha256: record.receipt.ownerTokenSha256,
    }),
  });
}

export function terminateQaOwnedChromiumProcess(child, {
  graceMs = 0,
  terminateTimeoutMs = 2_000,
  killTimeoutMs = 2_000,
  terminateWindowsProcessIdentity = terminateWslWindowsQaChromiumByIdentity,
} = {}) {
  const record = ownedProcessRecords.get(child);
  if (!record) throw new Error('QA_CHROMIUM_PROCESS_NOT_OWNED');
  if (record.receipt.processOwnership !== 'owned') {
    throw new Error('QA_CHROMIUM_PROCESS_OWNERSHIP_TRANSFERRED');
  }
  if (record.terminated) {
    return Promise.resolve(Object.freeze({
      resource: 'chromium_process',
      status: 'already_released',
      pid: record.receipt.pid,
    }));
  }
  if (!record.terminationPromise) {
    record.terminationPromise = (async () => {
      let directStatus = 'already_exited';
      let directError = null;
      const errors = [];
      try {
        if (isProcessExited(child)) {
          directStatus = 'already_exited';
        } else if (
          Number(graceMs) > 0
          && await waitForExit(child, Number(graceMs))
        ) {
          directStatus = 'exited_during_grace';
        } else {
          child.kill('SIGTERM');
          if (!await waitForExit(child, Math.max(0, Number(terminateTimeoutMs) || 0))) {
            child.kill('SIGKILL');
            if (!await waitForExit(child, Math.max(0, Number(killTimeoutMs) || 0))) {
              const error = new Error(
                `QA_CHROMIUM_PROCESS_TERMINATION_INCOMPLETE:pid=${record.receipt.pid ?? 'unknown'}`,
              );
              error.code = 'QA_CHROMIUM_PROCESS_TERMINATION_INCOMPLETE';
              throw error;
            }
          }
          directStatus = 'terminated';
        }
      } catch (error) {
        directError = error;
      }
      let windowsProcess = null;
      if (record.windowsIdentity) {
        await terminateWindowsProcessIdentity(record.windowsIdentity)
          .then((receipt) => { windowsProcess = receipt; })
          .catch((error) => errors.push(error));
      }
      // Windows cleanup is a later, exact owner-token termination/absence
      // proof. The spawned child may exit during it after the earlier signal
      // wait expired. Classify only after both owners have finished; Windows
      // absence alone never substitutes for this exact child's exit receipt.
      const directExitReconciled = directError?.code === 'QA_CHROMIUM_PROCESS_TERMINATION_INCOMPLETE'
        && windowsProcess?.resource === 'chromium_process'
        && ['already_absent', 'terminated'].includes(windowsProcess.status)
        && isProcessExited(child);
      if (directExitReconciled) directStatus = 'terminated';
      else if (directError) errors.unshift(directError);
      if (errors.length === 1) throw errors[0];
      if (errors.length > 1) {
        throw new AggregateError(errors, 'QA_CHROMIUM_PROCESS_TERMINATION_INCOMPLETE');
      }
      record.terminated = true;
      return Object.freeze({
        resource: 'chromium_process',
        status: directStatus,
        pid: record.receipt.pid,
        processAction: record.windowsIdentity
          ? 'exact_child_and_windows_owner_token_terminated'
          : 'exact_child_terminated',
        windowsProcess,
        ...(directExitReconciled ? { directExitConfirmation: 'after_windows_identity_cleanup' } : {}),
      });
    })().catch((error) => {
      record.terminationPromise = null;
      throw error;
    });
  }
  return record.terminationPromise;
}

function requireProfileSlotId(profileSlotId) {
  if (
    typeof profileSlotId !== 'string'
    || !/^[a-z][a-z0-9_]*$/u.test(profileSlotId)
  ) {
    throw new Error('QA_MANAGED_PERSISTENT_PROFILE_SLOT_ID_INVALID');
  }
  return profileSlotId;
}

function normalizePersistentIdentityPath(value) {
  if (typeof value !== 'string' || !value) return null;
  const normalized = value.replaceAll('\\', '/');
  const wsl = normalized.match(/^\/mnt\/([a-z])\/(.*)$/iu);
  if (wsl) return `${wsl[1].toLowerCase()}:/${wsl[2]}`.toLowerCase();
  if (/^[a-z]:\//iu.test(normalized)) return normalized.toLowerCase();
  return path.normalize(normalized);
}

function normalizePersistentHandoffIdentity(identity) {
  let cdpEndpoint = null;
  try {
    const endpoint = new URL(identity?.cdpEndpoint);
    cdpEndpoint = `http://127.0.0.1:${endpoint.port}`;
  } catch {}
  return Object.freeze({
    profileSlotId: identity?.profileSlotId || null,
    executable: normalizePersistentIdentityPath(
      identity?.executable ?? identity?.chrome,
    ),
    userDataDir: normalizePersistentIdentityPath(
      identity?.userDataDir ?? identity?.profile,
    ),
    profileDirectory: identity?.profileDirectory || null,
    cdpEndpoint,
  });
}

function projectPublicManagedOsProcessIdentity(identity, { platform } = {}) {
  if (
    identity?.status !== 'declared_os_process_identity_verified'
    || typeof identity?.method !== 'string'
    || !identity.method
    || !Number.isSafeInteger(identity?.pid)
    || (
      platform === 'linux'
      && (
        typeof identity?.processStartToken !== 'string'
        || !/^linux-proc:\d+$/u.test(identity.processStartToken)
      )
    )
  ) {
    throw new Error('QA_MANAGED_PERSISTENT_OS_IDENTITY_INVALID');
  }
  return Object.freeze({
    status: identity.status,
    method: identity.method,
    pid: identity.pid,
    executable: identity.executable || null,
    userDataDir: identity.userDataDir || null,
    profileDirectory: identity.profileDirectory || null,
    remoteDebuggingPort: Number.isSafeInteger(identity.remoteDebuggingPort)
      ? identity.remoteDebuggingPort
      : null,
    processStartToken: typeof identity.processStartToken === 'string'
      ? identity.processStartToken
      : null,
  });
}

/**
 * Launches a persistent QA browser under temporary pre-ready ownership.
 * The caller must either rollback on failed admission or hand off only after
 * exact identity proof. Handoff is the sole path that unrefs/preserves it.
 */
export function launchQaManagedPersistentChromiumProcess(
  launchOptions,
  {
    profileSlotId,
    platform = 'linux',
    expectedBrowserIdentity,
    inspectProcessIdentity = null,
    terminateProcessIdentity = null,
  } = {},
) {
  const normalizedProfileSlotId = requireProfileSlotId(profileSlotId);
  if (!['linux', 'windows_via_wsl', 'windows'].includes(platform)) {
    throw new Error('QA_MANAGED_PERSISTENT_PLATFORM_INVALID');
  }
  if (!expectedBrowserIdentity || typeof expectedBrowserIdentity !== 'object') {
    throw new Error('QA_MANAGED_PERSISTENT_EXPECTED_IDENTITY_REQUIRED');
  }
  const expectedHandoffIdentity = normalizePersistentHandoffIdentity({
    ...expectedBrowserIdentity,
    profileSlotId: normalizedProfileSlotId,
  });
  if (
    !expectedHandoffIdentity.executable
    || !expectedHandoffIdentity.userDataDir
    || !expectedHandoffIdentity.profileDirectory
    || !expectedHandoffIdentity.cdpEndpoint
  ) {
    throw new Error('QA_MANAGED_PERSISTENT_EXPECTED_IDENTITY_INVALID');
  }
  const child = launchQaOwnedChromiumProcess({
    ...launchOptions,
    // A native persistent browser must survive the launching console's exit.
    // The process lease retains rollback ownership until exact READY handoff.
    detached: platform === 'windows',
    stdio: ['ignore', 'ignore', 'pipe'],
  });
  const record = ownedProcessRecords.get(child);
  const startupStderr = captureChromiumStartupStderr(child.stderr, {
    ownerToken: record.ownerToken,
  });
  let state = 'pre_ready_owned';
  let handoffReceipt = null;
  const inspectExactProcess = inspectProcessIdentity || (isWindowsQaPlatform(platform)
    ? inspectWslWindowsQaChromiumIdentity
    : inspectLinuxQaChromiumIdentity);
  const terminateExactProcess = terminateProcessIdentity || (isWindowsQaPlatform(platform)
    ? terminateWslWindowsQaChromiumByIdentity
    : terminateLinuxQaChromiumByIdentity);
  const assertHealthy = () => {
    if (record.spawnError) {
      throw new Error(
        `QA_MANAGED_PERSISTENT_PROCESS_SPAWN_FAILED:${record.spawnError?.message || record.spawnError}`,
        { cause: record.spawnError },
      );
    }
    // A WSL interop launcher may exit successfully after transferring startup
    // to the native Windows process. A non-zero/signal exit is still a launch
    // failure; Linux has no interop transfer boundary at all.
    if (
      isProcessExited(child)
      && (
        platform !== 'windows_via_wsl'
        || child.exitCode !== 0
        || child.signalCode !== null
      )
    ) {
      throw new Error('QA_MANAGED_PERSISTENT_PROCESS_EXITED_BEFORE_READY');
    }
    return Object.freeze({
      status: platform === 'windows_via_wsl' && isProcessExited(child)
        ? 'interop_launcher_exited_native_process_pending_proof'
        : 'pre_ready_process_running',
      platform,
    });
  };
  return Object.freeze({
    get pid() {
      return child.pid;
    },
    get exitCode() {
      return child.exitCode;
    },
    get signalCode() {
      return child.signalCode;
    },
    get state() {
      return state;
    },
    get receipt() {
      return handoffReceipt || record.receipt;
    },
    readStartupDiagnostics() {
      return Object.freeze({
        pid: Number.isSafeInteger(child.pid) ? child.pid : null,
        exitCode: child.exitCode,
        signalCode: child.signalCode,
        state,
        spawnErrorCode: record.spawnError === null ? null
          : (/^[A-Z0-9_]{1,64}$/u.test(record.spawnError.code) ? record.spawnError.code : 'SPAWN_ERROR'),
        stderr: startupStderr.read(),
      });
    },
    assertHealthy,
    async rollback() {
      if (state === 'handed_off') {
        throw new Error('QA_MANAGED_PERSISTENT_PROCESS_ALREADY_HANDED_OFF');
      }
      const receipts = [];
      const errors = [];
      await terminateQaOwnedChromiumProcess(child)
        .then((receipt) => receipts.push(receipt))
        .catch((error) => errors.push(error));
      if (platform === 'linux' && record.osProcessIdentity) {
        await terminateExactProcess({
          ...expectedBrowserIdentity,
          ownerToken: record.ownerToken,
          pid: record.receipt.pid,
          processStartToken: record.osProcessIdentity.processStartToken,
        }).then((receipt) => receipts.push(receipt))
          .catch((error) => errors.push(error));
      }
      startupStderr.stop();
      if (errors.length === 1) throw errors[0];
      if (errors.length > 1) {
        throw new AggregateError(
          errors,
          'QA_MANAGED_PERSISTENT_ROLLBACK_INCOMPLETE',
        );
      }
      state = 'rolled_back';
      return Object.freeze({
        resource: 'managed_persistent_chromium_process',
        status: 'rolled_back',
        profileSlotId: normalizedProfileSlotId,
        processAction: 'pre_ready_process_terminated',
        receipts: Object.freeze(receipts),
      });
    },
    async handoff({ browserIdentity } = {}) {
      if (state !== 'pre_ready_owned') {
        throw new Error(`QA_MANAGED_PERSISTENT_HANDOFF_STATE_INVALID:${state}`);
      }
      if (
        !browserIdentity
        || ![
          'declared_identity_verified',
          'declared_os_process_identity_verified',
        ].includes(browserIdentity.status)
      ) {
        throw new Error('QA_MANAGED_PERSISTENT_EXACT_IDENTITY_REQUIRED');
      }
      assertHealthy();
      const osProcessIdentity = projectPublicManagedOsProcessIdentity(
        await inspectExactProcess({
          ...expectedBrowserIdentity,
          ownerToken: record.ownerToken,
          pid: record.receipt.pid,
          processStartToken: record.osProcessIdentity?.processStartToken ?? null,
        }),
        { platform },
      );
      assertHealthy();
      const actualHandoffIdentity = normalizePersistentHandoffIdentity(browserIdentity);
      if (
        actualHandoffIdentity.profileSlotId !== expectedHandoffIdentity.profileSlotId
        || actualHandoffIdentity.executable !== expectedHandoffIdentity.executable
        || actualHandoffIdentity.userDataDir !== expectedHandoffIdentity.userDataDir
        || actualHandoffIdentity.profileDirectory !== expectedHandoffIdentity.profileDirectory
        || actualHandoffIdentity.cdpEndpoint !== expectedHandoffIdentity.cdpEndpoint
      ) {
        throw new Error('QA_MANAGED_PERSISTENT_IDENTITY_HANDOFF_MISMATCH');
      }
      handoffReceipt = Object.freeze({
        ...record.receipt,
        processOwnership: 'managed_persistent_profile',
        profileSlotId: normalizedProfileSlotId,
        browserIdentity,
        osProcessIdentity,
        handedOffAt: new Date().toISOString(),
        processAction: 'preserved_after_exact_ready_handoff',
      });
      record.osProcessIdentity = osProcessIdentity;
      record.receipt = handoffReceipt;
      state = 'handed_off';
      startupStderr.stop();
      child.unref?.();
      return handoffReceipt;
    },
  });
}

export {
  launchQaManagedPersistentChromiumProcess as launchManagedPersistentChromiumProcess,
  launchQaOwnedChromiumProcess as launchOwnedChromiumProcess,
  readQaOwnedChromiumProcessReceipt as readOwnedChromiumProcessReceipt,
  resolveQaChromiumProcessArgs as resolveChromiumProcessArgs,
  terminateQaOwnedChromiumProcess as terminateOwnedChromiumProcess,
  verifyQaOwnedChromiumEndpointIdentity as verifyOwnedChromiumEndpointIdentity,
};
