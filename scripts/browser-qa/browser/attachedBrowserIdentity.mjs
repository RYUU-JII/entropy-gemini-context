import { isWindowsQaPlatform } from './windowsPlatform.mjs';
import path from 'node:path';

import {
  normalizeBrowserQaCdpEndpoint,
} from '../resources/browserResourceScope.mjs';
import {
  inspectLinuxQaChromiumDeclaredIdentity,
  inspectWslWindowsQaChromiumIdentity,
} from './chromiumProcessOwner.mjs';

function fail(code, detail = '', cause = undefined) {
  const error = new Error(
    detail ? `${code}:${detail}` : code,
    cause ? { cause } : undefined,
  );
  error.code = code;
  throw error;
}

export function normalizeBrowserQaComparablePath(
  value,
  code = 'QA_BROWSER_PATH_INVALID',
) {
  if (typeof value !== 'string' || !value.trim()) fail(code);
  const normalizedSeparators = value.trim().replaceAll('\\', '/');
  const wslMatch = normalizedSeparators.match(/^\/mnt\/([a-z])\/(.*)$/iu);
  if (wslMatch) return `${wslMatch[1].toLowerCase()}:/${wslMatch[2]}`.toLowerCase();
  if (/^[a-z]:\//iu.test(normalizedSeparators)) {
    return normalizedSeparators.toLowerCase();
  }
  if (!path.posix.isAbsolute(normalizedSeparators)) fail(code, value);
  return path.posix.normalize(normalizedSeparators);
}

function readSwitch(argumentsList, switchName) {
  const prefix = `--${switchName}=`;
  const values = [];
  for (let index = 0; index < argumentsList.length; index += 1) {
    const argument = argumentsList[index];
    if (argument.startsWith(prefix)) {
      values.push(argument.slice(prefix.length));
    } else if (argument === `--${switchName}`) {
      const next = argumentsList[index + 1];
      if (typeof next === 'string' && !next.startsWith('--')) values.push(next);
      else values.push('');
    }
  }
  if (values.length > 1) fail('QA_ATTACHED_BROWSER_SWITCH_DUPLICATED', switchName);
  return values[0] ?? null;
}

function normalizeExpectedBrowserIdentity(raw, cdpEndpoint) {
  if (raw === null || raw === undefined) return null;
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    fail('QA_ATTACHED_BROWSER_IDENTITY_INVALID');
  }
  const executable = raw.executable ?? raw.chrome;
  const userDataDir = raw.userDataDir ?? raw.profile;
  const profileDirectory = raw.profileDirectory;
  const platform = raw.platform;
  if (!['linux', 'windows_via_wsl', 'windows'].includes(platform)) {
    fail('QA_ATTACHED_BROWSER_PLATFORM_INVALID', platform || 'missing');
  }
  const expectedEndpoint = normalizeBrowserQaCdpEndpoint(raw.cdpEndpoint);
  if (expectedEndpoint !== normalizeBrowserQaCdpEndpoint(cdpEndpoint)) {
    fail('QA_ATTACHED_BROWSER_CDP_ENDPOINT_MISMATCH');
  }
  if (
    typeof profileDirectory !== 'string'
    || !profileDirectory.trim()
    || profileDirectory !== profileDirectory.trim()
  ) {
    fail('QA_ATTACHED_BROWSER_PROFILE_DIRECTORY_REQUIRED');
  }
  return Object.freeze({
    installationId: raw.installationId || null,
    platform,
    executable: normalizeBrowserQaComparablePath(
      executable,
      'QA_ATTACHED_BROWSER_EXECUTABLE_REQUIRED',
    ),
    profileSlotId: raw.profileSlotId || null,
    userDataDir: normalizeBrowserQaComparablePath(
      userDataDir,
      'QA_ATTACHED_BROWSER_PROFILE_REQUIRED',
    ),
    profileDirectory,
    cdpEndpoint: expectedEndpoint,
  });
}

function verifyExecutableCommandLineEvidence(executableArgument, expected) {
  if (
    typeof executableArgument === 'string'
    && executableArgument
    && executableArgument === executableArgument.trim()
    && !/[\\/]/u.test(executableArgument)
  ) {
    const expectedBasename = expected.executable.split('/').at(-1);
    const basenameMatches = isWindowsQaPlatform(expected.platform)
      ? executableArgument.toLowerCase() === expectedBasename.toLowerCase()
      : executableArgument === expectedBasename;
    if (!basenameMatches) fail('QA_ATTACHED_BROWSER_EXECUTABLE_MISMATCH');
    return 'basename_only_os_proof_required';
  }
  if (
    normalizeBrowserQaComparablePath(
      executableArgument,
      'QA_ATTACHED_BROWSER_EXECUTABLE_EVIDENCE_MISSING',
    ) !== expected.executable
  ) {
    fail('QA_ATTACHED_BROWSER_EXECUTABLE_MISMATCH');
  }
  return 'absolute_exact';
}

function projectExactOsProcessIdentity(osProcessIdentity) {
  if (
    osProcessIdentity?.status !== 'declared_os_process_identity_verified'
    || typeof osProcessIdentity.method !== 'string'
    || !/^[a-z][a-z0-9_.-]*$/u.test(osProcessIdentity.method)
    || !Number.isSafeInteger(osProcessIdentity.pid)
    || osProcessIdentity.pid < 1
  ) {
    fail('QA_ATTACHED_BROWSER_OS_IDENTITY_INVALID');
  }
  return osProcessIdentity;
}

function verifyCommandLineIdentity(commandLine, expected, normalizedEndpoint) {
  if (
    !Array.isArray(commandLine?.arguments)
    || commandLine.arguments.some((argument) => typeof argument !== 'string')
  ) {
    fail('QA_ATTACHED_BROWSER_COMMAND_LINE_INVALID');
  }
  const argumentsList = commandLine.arguments;
  const executableEvidence = verifyExecutableCommandLineEvidence(
    argumentsList[0],
    expected,
  );
  const actualProfile = readSwitch(argumentsList, 'user-data-dir');
  if (
    normalizeBrowserQaComparablePath(
      actualProfile,
      'QA_ATTACHED_BROWSER_PROFILE_EVIDENCE_MISSING',
    ) !== expected.userDataDir
  ) {
    fail('QA_ATTACHED_BROWSER_PROFILE_MISMATCH');
  }
  const actualProfileDirectory = readSwitch(argumentsList, 'profile-directory');
  if (actualProfileDirectory !== expected.profileDirectory) {
    fail('QA_ATTACHED_BROWSER_PROFILE_DIRECTORY_MISMATCH');
  }
  const remoteDebuggingPort = readSwitch(argumentsList, 'remote-debugging-port');
  if (remoteDebuggingPort !== new URL(normalizedEndpoint).port) {
    fail('QA_ATTACHED_BROWSER_DEBUG_PORT_MISMATCH');
  }
  return Object.freeze({ executableEvidence });
}

function projectVersion(version) {
  if (
    !version
    || typeof version !== 'object'
    || Array.isArray(version)
    || typeof version.product !== 'string'
    || !version.product.trim()
  ) {
    fail('QA_ATTACHED_BROWSER_VERSION_INVALID');
  }
  return Object.freeze({
    product: version.product,
    protocolVersion: typeof version.protocolVersion === 'string'
      ? version.protocolVersion
      : null,
    userAgent: typeof version.userAgent === 'string' ? version.userAgent : null,
    jsVersion: typeof version.jsVersion === 'string' ? version.jsVersion : null,
  });
}

function isBrowserCommandLineUnavailable(error) {
  const evidence = [
    error?.code,
    error?.message,
    error?.protocolMessage,
    error?.cause?.message,
  ].filter(Boolean).join(' ');
  return /(?:method (?:not found|wasn't found)|unsupported|unavailable|not returned|enable-automation)/iu
    .test(evidence);
}

export async function verifyAttachedBrowserIdentity(cdp, {
  cdpEndpoint,
  expectedBrowserIdentity = null,
  osIdentityVerifier = null,
} = {}) {
  if (!cdp || typeof cdp.send !== 'function') {
    fail('QA_ATTACHED_BROWSER_CDP_CONNECTION_REQUIRED');
  }
  const normalizedEndpoint = normalizeBrowserQaCdpEndpoint(cdpEndpoint);
  const expected = normalizeExpectedBrowserIdentity(
    expectedBrowserIdentity,
    normalizedEndpoint,
  );
  const version = projectVersion(await cdp.send('Browser.getVersion'));
  if (!expected) {
    return Object.freeze({
      status: 'endpoint_connected_unverified_process',
      cdpEndpoint: normalizedEndpoint,
      version,
    });
  }

  let commandLineUnavailableError = null;
  let browserCommandLine = null;
  let commandLineEvidence = null;
  try {
    browserCommandLine = await cdp.send('Browser.getBrowserCommandLine');
  } catch (error) {
    if (!isBrowserCommandLineUnavailable(error)) throw error;
    commandLineUnavailableError = error;
  }
  if (!commandLineUnavailableError) {
    // Returned command-line evidence is authoritative. A tuple mismatch must
    // never be converted into an OS-fallback success for another declaration.
    commandLineEvidence = verifyCommandLineIdentity(
      browserCommandLine,
      expected,
      normalizedEndpoint,
    );
  }
  let osProcessIdentity = null;
  const basenameOnlyExecutable = commandLineEvidence?.executableEvidence
    === 'basename_only_os_proof_required';
  // Windows window handoff must correlate a verified OS PID even when CDP
  // returns an absolute executable. A command-line tuple alone has no PID.
  const windowsProcessProofRequired = isWindowsQaPlatform(expected.platform);
  if (commandLineUnavailableError || basenameOnlyExecutable || windowsProcessProofRequired) {
    const verifier = osIdentityVerifier || (isWindowsQaPlatform(expected.platform)
      ? inspectWslWindowsQaChromiumIdentity
      : inspectLinuxQaChromiumDeclaredIdentity);
    try {
      osProcessIdentity = projectExactOsProcessIdentity(
        await verifier(expectedBrowserIdentity),
      );
    } catch (osError) {
      const primaryEvidenceError = commandLineUnavailableError || Object.assign(
        new Error('QA_ATTACHED_BROWSER_PROCESS_OS_PROOF_REQUIRED'),
        { code: 'QA_ATTACHED_BROWSER_PROCESS_OS_PROOF_REQUIRED' },
      );
      const error = new AggregateError(
        [primaryEvidenceError, osError],
        'QA_ATTACHED_BROWSER_IDENTITY_UNVERIFIED',
        { cause: osError },
      );
      error.code = 'QA_ATTACHED_BROWSER_IDENTITY_UNVERIFIED';
      throw error;
    }
  }
  return Object.freeze({
    status: 'declared_identity_verified',
    cdpEndpoint: normalizedEndpoint,
    installationId: expected.installationId,
    platform: expected.platform,
    profileSlotId: expected.profileSlotId,
    executable: expected.executable,
    userDataDir: expected.userDataDir,
    profileDirectory: expected.profileDirectory,
    proof: Object.freeze({
      method: commandLineEvidence && osProcessIdentity
        ? `browser_command_line_tuple+${osProcessIdentity.method}`
        : osProcessIdentity?.method || 'browser_command_line',
      pid: osProcessIdentity?.pid || null,
      browserCommandLineAvailable: !commandLineUnavailableError,
      executableEvidence: commandLineUnavailableError
        ? 'unavailable_os_proof_required'
        : commandLineEvidence.executableEvidence,
    }),
    version,
  });
}
