import fs from 'node:fs/promises';
import { posix as path } from 'node:path';

const LINUX_PROCESS_START_TOKEN_PATTERN = /^linux-proc:\d+$/u;

function fail(code, detail = '', cause = undefined) {
  const error = new Error(
    detail ? `${code}:${detail}` : code,
    cause ? { cause } : undefined,
  );
  error.code = code;
  throw error;
}

function requireLinuxPid(value) {
  if (!Number.isSafeInteger(value) || value < 1) {
    fail('QA_LINUX_PROCESS_PID_INVALID');
  }
  return value;
}

function requireAbsoluteExecutable(value) {
  if (typeof value !== 'string' || !path.isAbsolute(value)) {
    fail('QA_LINUX_PROCESS_EXECUTABLE_INVALID');
  }
  return path.resolve(value);
}

function requireProcessStartToken(value, { optional = false } = {}) {
  if (optional && value === null) return null;
  if (
    typeof value !== 'string'
    || !LINUX_PROCESS_START_TOKEN_PATTERN.test(value)
  ) {
    fail('QA_LINUX_PROCESS_START_TOKEN_INVALID');
  }
  return value;
}

function requireExactArgument(value) {
  if (
    typeof value !== 'string'
    || !value
    || /[\0\r\n]/u.test(value)
  ) {
    fail('QA_LINUX_PROCESS_REQUIRED_ARGUMENT_INVALID');
  }
  return value;
}

function parseLinuxProcStatStartToken(raw) {
  const value = Buffer.isBuffer(raw) ? raw.toString('utf8') : String(raw);
  const closeParen = value.lastIndexOf(')');
  if (closeParen < 0) return null;
  const fieldsAfterCommand = value.slice(closeParen + 1).trim().split(/\s+/u);
  const startTime = fieldsAfterCommand[19];
  return /^\d+$/u.test(startTime || '') ? `linux-proc:${startTime}` : null;
}

function escapeRegexLiteral(value) {
  return value.replace(/[\\^$.*+?()[\]{}|]/gu, '\\$&');
}

function commandLineCarriesExactArgument(raw, expectedArgument) {
  const text = Buffer.isBuffer(raw) ? raw.toString('utf8') : String(raw);
  const nulSeparatedArguments = text.split('\0').filter(Boolean);
  if (nulSeparatedArguments.includes(expectedArgument)) return true;

  // Chromium may rewrite argv into one space-delimited process-title string
  // after startup. Only the private, whitespace-free capability argument is
  // admitted through this representation; business/profile switches remain
  // authoritative through Browser.getBrowserCommandLine.
  if (nulSeparatedArguments.length !== 1 || /\s/u.test(expectedArgument)) {
    return false;
  }
  return new RegExp(
    `(?:^|\\s)${escapeRegexLiteral(expectedArgument)}(?=\\s|$)`,
    'u',
  ).test(nulSeparatedArguments[0]);
}

export async function readLinuxProcessStartToken(pid, {
  procRoot = '/proc',
  readFile = fs.readFile,
} = {}) {
  if (!Number.isSafeInteger(pid) || pid < 1) return null;
  let raw;
  try {
    raw = await readFile(path.join(procRoot, String(pid), 'stat'), 'utf8');
  } catch {
    return null;
  }
  return parseLinuxProcStatStartToken(raw);
}

export async function inspectLinuxSpawnedProcessIdentity(identity, {
  procRoot = '/proc',
  readFile = fs.readFile,
  realpath = fs.realpath,
} = {}) {
  if (!identity || typeof identity !== 'object' || Array.isArray(identity)) {
    fail('QA_LINUX_PROCESS_IDENTITY_REQUIRED');
  }
  const pid = requireLinuxPid(identity.pid);
  const executable = requireAbsoluteExecutable(identity.executable);
  const expectedStartToken = requireProcessStartToken(
    identity.processStartToken ?? null,
    { optional: true },
  );
  const requiredArgument = requireExactArgument(identity.requiredArgument);
  const processRoot = path.join(procRoot, String(pid));

  let expectedExecutable;
  try {
    expectedExecutable = await realpath(executable);
  } catch (error) {
    fail(
      'QA_LINUX_PROCESS_EXPECTED_EXECUTABLE_UNAVAILABLE',
      error?.code || 'unknown',
      error,
    );
  }

  let actualExecutable;
  let commandLine;
  let processStat;
  try {
    [actualExecutable, commandLine, processStat] = await Promise.all([
      realpath(path.join(processRoot, 'exe')),
      readFile(path.join(processRoot, 'cmdline')),
      readFile(path.join(processRoot, 'stat'), 'utf8'),
    ]);
  } catch (error) {
    if (error?.code === 'ENOENT' || error?.code === 'ESRCH') {
      return Object.freeze({
        status: 'absent',
        proof: 'pid_absent',
        pid,
      });
    }
    fail(
      'QA_LINUX_PROCESS_PROOF_UNAVAILABLE',
      error?.code || 'unknown',
      error,
    );
  }

  const actualStartToken = parseLinuxProcStatStartToken(processStat);
  if (actualStartToken === null) {
    fail('QA_LINUX_PROCESS_START_TOKEN_UNAVAILABLE');
  }
  if (
    expectedStartToken !== null
    && actualStartToken !== expectedStartToken
  ) {
    return Object.freeze({
      status: 'mismatch',
      proof: 'pid_reused_with_different_start_token',
      pid,
      processStartToken: actualStartToken,
    });
  }
  if (actualExecutable !== expectedExecutable) {
    return Object.freeze({
      status: 'mismatch',
      proof: 'spawned_executable_mismatch',
      pid,
      processStartToken: actualStartToken,
    });
  }
  if (!commandLineCarriesExactArgument(commandLine, requiredArgument)) {
    return Object.freeze({
      status: 'mismatch',
      proof: 'spawn_capability_argument_mismatch',
      pid,
      processStartToken: actualStartToken,
    });
  }
  return Object.freeze({
    status: 'verified',
    method: 'linux_procfs_spawn_pid_start_token_executable_capability',
    pid,
    executable: expectedExecutable,
    processStartToken: actualStartToken,
  });
}
