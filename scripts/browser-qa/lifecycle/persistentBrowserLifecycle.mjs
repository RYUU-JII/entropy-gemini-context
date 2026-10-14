import { execFile } from 'node:child_process';
import fs from 'node:fs/promises';
import { promisify } from 'node:util';

import {
  probeBrowserQaLoopbackTcpEndpoint,
} from '../network/loopbackTcpProbe.mjs';

const execFileAsync = promisify(execFile);
const DEFAULT_PROBE_TIMEOUT_MS = 2_000;
const DEFAULT_STARTUP_TIMEOUT_MS = 20_000;
const DEFAULT_POLL_INTERVAL_MS = 200;
const DEDICATED_PROFILE_OWNERSHIP_POLICY = 'dedicated_adapter_proof_required';
const IDENTITY_VERIFICATION_STAGE = 'declared_identity_verification';
const IDENTITY_FAILURE_CODE_PATTERNS = Object.freeze([
  /^QA_ATTACHED_BROWSER_[A-Z0-9_]+$/u,
  /^QA_WINDOWS_CHROMIUM_(?:DECLARED_)?IDENTITY_[A-Z0-9_]+$/u,
  /^QA_PERSISTENT_BROWSER_IDENTITY_[A-Z0-9_]+$/u,
]);

function fail(code, detail = '', options = undefined) {
  throw new Error(detail ? `${code}:${detail}` : code, options);
}

function namedErrorCode(error) {
  const explicit = typeof error?.code === 'string' ? error.code.trim() : '';
  if (explicit) return explicit;
  const message = error instanceof Error ? error.message : String(error || '');
  const candidate = message.split(':', 1)[0];
  return /^[A-Z][A-Z0-9_]+$/u.test(candidate) ? candidate : '';
}

function boundedIdentityFailureCode(error) {
  const nested = [
    error?.cause,
    ...(Array.isArray(error?.errors) ? error.errors : []),
    error,
  ];
  for (const candidate of nested) {
    const code = namedErrorCode(candidate);
    if (IDENTITY_FAILURE_CODE_PATTERNS.some((pattern) => pattern.test(code))) {
      return code;
    }
  }
  return 'BROWSER_QA_IDENTITY_VERIFIER_FAILED';
}

function createIdentityAdmissionError(profileSlotId, identity, stage) {
  const causeCode = identity?.causeCode || 'BROWSER_QA_IDENTITY_VERIFIER_FAILED';
  const cause = new Error(causeCode);
  cause.code = causeCode;
  cause.stage = IDENTITY_VERIFICATION_STAGE;
  const error = new Error(
    `BROWSER_QA_CDP_ENDPOINT_IDENTITY_UNVERIFIED:${profileSlotId}`,
    { cause },
  );
  error.code = 'BROWSER_QA_CDP_ENDPOINT_IDENTITY_UNVERIFIED';
  error.stage = stage;
  return error;
}

function requireManagedProfileSlot(profileSlot) {
  if (
    !profileSlot
    || typeof profileSlot !== 'object'
    || profileSlot.lifecyclePolicy !== 'managed'
    || profileSlot.profileOwnershipPolicy !== DEDICATED_PROFILE_OWNERSHIP_POLICY
    || profileSlot.focusPolicy !== 'never'
    || profileSlot.installation?.source !== 'path'
  ) {
    fail('BROWSER_QA_MANAGED_PROFILE_SLOT_REQUIRED', profileSlot?.id || 'missing');
  }
  return profileSlot;
}

export function projectBrowserQaDedicatedProfileOwnership(profileSlot, ownership) {
  if (
    !profileSlot
    || profileSlot.lifecyclePolicy !== 'managed'
    || profileSlot.profileOwnershipPolicy !== DEDICATED_PROFILE_OWNERSHIP_POLICY
    || !ownership
    || typeof ownership !== 'object'
    || Array.isArray(ownership)
    || ownership.status !== 'dedicated_profile_verified'
    || ownership.profileSlotId !== profileSlot.id
    || ownership.userDataDir !== profileSlot.userDataDir
    || typeof ownership.proofType !== 'string'
    || !/^[a-z][a-z0-9_.-]*$/u.test(ownership.proofType)
    || !Number.isSafeInteger(ownership.proofVersion)
    || ownership.proofVersion < 1
  ) {
    fail(
      'BROWSER_QA_DEDICATED_PROFILE_OWNERSHIP_UNVERIFIED',
      profileSlot?.id || 'missing',
    );
  }
  return Object.freeze({
    status: ownership.status,
    profileSlotId: ownership.profileSlotId,
    userDataDir: ownership.userDataDir,
    proofType: ownership.proofType,
    proofVersion: ownership.proofVersion,
  });
}

function inspectDedicatedProfileOwnership(profileSlot, ownership) {
  if (profileSlot.lifecyclePolicy !== 'managed') {
    return Object.freeze({ status: 'not_required' });
  }
  if (
    ownership?.status === 'unverified'
    && typeof ownership.reason === 'string'
    && ownership.reason
  ) {
    return Object.freeze({
      status: 'unverified',
      reason: ownership.reason,
    });
  }
  try {
    return projectBrowserQaDedicatedProfileOwnership(profileSlot, ownership);
  } catch (error) {
    return Object.freeze({
      status: 'unverified',
      reason: error?.message || String(error),
    });
  }
}

async function admitDedicatedProfileOwnership(profileSlot, verifier, action) {
  if (typeof verifier !== 'function') {
    fail('BROWSER_QA_DEDICATED_PROFILE_OWNERSHIP_VERIFIER_REQUIRED', profileSlot.id);
  }
  let ownership;
  try {
    ownership = await verifier({ profileSlot, action });
    return projectBrowserQaDedicatedProfileOwnership(profileSlot, ownership);
  } catch (error) {
    fail(
      'BROWSER_QA_DEDICATED_PROFILE_OWNERSHIP_UNVERIFIED',
      profileSlot.id,
      { cause: error },
    );
  }
}

async function pathKind(targetPath, stat = fs.stat) {
  if (!targetPath) return 'missing';
  const result = await stat(targetPath).catch(() => null);
  if (!result) return 'missing';
  if (result.isFile()) return 'file';
  if (result.isDirectory()) return 'directory';
  return 'unsupported';
}

function resolveBrowserEpoch(version) {
  try {
    const websocket = new URL(version.webSocketDebuggerUrl);
    const marker = '/devtools/browser/';
    const markerIndex = websocket.pathname.indexOf(marker);
    const epoch = markerIndex === -1
      ? ''
      : websocket.pathname.slice(markerIndex + marker.length);
    return epoch ? `cdp:${epoch}` : null;
  } catch {
    return null;
  }
}

export async function probePersistentBrowserCdp(cdpEndpoint, {
  fetchImpl = globalThis.fetch,
  timeoutMs = DEFAULT_PROBE_TIMEOUT_MS,
  tcpProbe = fetchImpl === globalThis.fetch
    ? probeBrowserQaLoopbackTcpEndpoint
    : null,
} = {}) {
  if (typeof fetchImpl !== 'function') {
    fail('BROWSER_QA_CDP_FETCH_ADAPTER_REQUIRED');
  }
  if (tcpProbe !== null && typeof tcpProbe !== 'function') {
    fail('BROWSER_QA_CDP_TCP_PROBE_ADAPTER_INVALID');
  }
  if (tcpProbe) {
    const reachability = await tcpProbe(cdpEndpoint);
    if (!['reachable', 'unavailable'].includes(reachability?.status)) {
      fail('BROWSER_QA_CDP_TCP_PROBE_RESULT_INVALID');
    }
    if (reachability.status === 'unavailable') {
      return Object.freeze({
        status: 'unavailable',
        error: `tcp_${reachability.errorCode || 'unavailable'}`,
      });
    }
  }
  let response;
  try {
    response = await fetchImpl(new URL('/json/version', cdpEndpoint), {
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch (error) {
    return Object.freeze({
      status: 'unavailable',
      error: error?.message || String(error),
      errorCode: probeTransportErrorCode(error),
    });
  }
  if (!response?.ok) {
    return Object.freeze({
      status: 'occupied_invalid',
      httpStatus: response?.status || null,
      error: 'cdp_version_endpoint_unavailable',
    });
  }
  let version;
  try {
    version = await response.json();
  } catch (error) {
    return Object.freeze({
      status: 'occupied_invalid',
      error: `cdp_version_json_invalid:${error?.message || error}`,
      errorCode: 'cdp_version_json_invalid',
    });
  }
  if (
    typeof version?.Browser !== 'string'
    || typeof version?.webSocketDebuggerUrl !== 'string'
  ) {
    return Object.freeze({
      status: 'occupied_invalid',
      error: 'cdp_version_contract_invalid',
    });
  }
  let endpoint;
  let websocket;
  try {
    endpoint = new URL(cdpEndpoint);
    websocket = new URL(version.webSocketDebuggerUrl);
  } catch {
    return Object.freeze({
      status: 'occupied_invalid',
      error: 'cdp_websocket_url_invalid',
    });
  }
  if (
    !['ws:', 'wss:'].includes(websocket.protocol)
    || Number(websocket.port) !== Number(endpoint.port)
    || !['127.0.0.1', 'localhost', '[::1]'].includes(websocket.hostname)
  ) {
    return Object.freeze({
      status: 'occupied_invalid',
      error: 'cdp_websocket_origin_mismatch',
    });
  }
  return Object.freeze({
    status: 'ready',
    browser: version.Browser,
    protocolVersion: version['Protocol-Version'] || null,
    browserEpoch: resolveBrowserEpoch(version),
    webSocketDebuggerUrl: version.webSocketDebuggerUrl,
  });
}

export async function inspectPersistentBrowserProfileSlot(profileSlot, {
  fetchImpl = globalThis.fetch,
  stat = fs.stat,
  timeoutMs = DEFAULT_PROBE_TIMEOUT_MS,
  tcpProbe,
  dedicatedProfileOwnership = null,
  verifyBrowserIdentity = null,
} = {}) {
  if (!profileSlot || typeof profileSlot !== 'object') {
    fail('BROWSER_QA_PROFILE_SLOT_REQUIRED');
  }
  const [executable, userDataDir, cdp] = await Promise.all([
    pathKind(profileSlot.installation?.executable, stat),
    pathKind(profileSlot.userDataDir, stat),
    probePersistentBrowserCdp(profileSlot.cdpEndpoint, {
      fetchImpl,
      timeoutMs,
      tcpProbe,
    }),
  ]);
  let identity = Object.freeze({
    status: cdp.status === 'ready' ? 'unclassified' : 'not_connected',
    ...(cdp.status === 'ready' ? {
      reason: 'identity_verifier_unavailable',
      stage: IDENTITY_VERIFICATION_STAGE,
      causeCode: 'BROWSER_QA_IDENTITY_VERIFIER_UNAVAILABLE',
    } : {}),
  });
  const profileOwnership = inspectDedicatedProfileOwnership(
    profileSlot,
    dedicatedProfileOwnership,
  );
  if (cdp.status === 'ready' && typeof verifyBrowserIdentity === 'function') {
    try {
      const verified = await verifyBrowserIdentity({ profileSlot, cdp });
      identity = verified?.status === 'declared_identity_verified'
        ? Object.freeze({ ...verified })
        : Object.freeze({
          status: 'unclassified',
          reason: 'identity_verifier_contract_invalid',
          stage: IDENTITY_VERIFICATION_STAGE,
          causeCode: 'BROWSER_QA_IDENTITY_VERIFIER_CONTRACT_INVALID',
        });
    } catch (error) {
      identity = Object.freeze({
        status: 'unclassified',
        reason: 'identity_verifier_failed',
        stage: IDENTITY_VERIFICATION_STAGE,
        causeCode: boundedIdentityFailureCode(error),
      });
    }
  }
  const failures = [];
  if (executable !== 'file') failures.push('executable_unavailable');
  if (userDataDir !== 'directory') failures.push('profile_unavailable');
  if (profileOwnership.status === 'unverified') {
    failures.push('dedicated_profile_ownership_unverified');
  }
  if (cdp.status !== 'ready') failures.push(
    cdp.status === 'occupied_invalid' ? 'cdp_endpoint_occupied_invalid' : 'cdp_unavailable',
  );
  if (cdp.status === 'ready' && identity.status !== 'declared_identity_verified') {
    failures.push('browser_identity_unverified');
  }
  const ready = failures.length === 0;
  let nextAction = 'attach';
  if (!ready) {
    if (executable !== 'file') nextAction = 'repair_installation';
    else if (userDataDir !== 'directory') nextAction = 'repair_profile_slot';
    else if (profileOwnership.status === 'unverified') {
      nextAction = 'verify_dedicated_profile_ownership';
    } else if (
      cdp.status === 'occupied_invalid'
      || identity.status !== 'declared_identity_verified'
    ) nextAction = 'repair_cdp_endpoint_owner';
    else if (profileSlot.lifecyclePolicy === 'managed') nextAction = 'start_managed_browser';
    else nextAction = 'start_or_reconnect_external_browser';
  }
  return Object.freeze({
    contractVersion: 1,
    profileSlotId: profileSlot.id,
    lifecyclePolicy: profileSlot.lifecyclePolicy,
    status: ready ? 'READY' : 'BLOCKED',
    checks: Object.freeze({
      executable,
      userDataDir,
      dedicatedProfileOwnership: profileOwnership,
      cdp,
      identity,
    }),
    failures: Object.freeze(failures),
    nextAction,
  });
}

async function defaultWslPathTranslator(value) {
  let stdout;
  try {
    ({ stdout } = await execFileAsync('wslpath', ['-w', '--', value], {
      encoding: 'utf8',
      windowsHide: true,
    }));
  } catch (error) {
    fail('BROWSER_QA_WSL_PATH_TRANSLATION_FAILED', value, { cause: error });
  }
  const translated = stdout.trim();
  if (!/^(?:[a-z]:\\|\\\\)/iu.test(translated) || /[\r\n]/u.test(translated)) {
    fail('BROWSER_QA_WSL_PATH_TRANSLATION_INVALID', value);
  }
  return translated;
}

export async function compilePersistentBrowserLaunchSpec(profileSlot, {
  translateWslPath = defaultWslPathTranslator,
} = {}) {
  const slot = requireManagedProfileSlot(profileSlot);
  const userDataDir = slot.installation.platform === 'windows_via_wsl'
    ? await translateWslPath(slot.userDataDir)
    : slot.userDataDir;
  if (typeof userDataDir !== 'string' || !userDataDir || /[\r\n]/u.test(userDataDir)) {
    fail('BROWSER_QA_NATIVE_PROFILE_PATH_INVALID', slot.id);
  }
  return Object.freeze({
    profileSlotId: slot.id,
    installationId: slot.installationId,
    executable: slot.installation.executable,
    platform: slot.installation.platform,
    cdpEndpoint: slot.cdpEndpoint,
    expectedBrowserIdentity: Object.freeze({
      installationId: slot.installationId,
      executable: slot.installation.executable,
      platform: slot.installation.platform,
      profileSlotId: slot.id,
      userDataDir: slot.userDataDir,
      profileDirectory: slot.profileDirectory,
      cdpEndpoint: slot.cdpEndpoint,
    }),
    audioPolicy: slot.launchAudioPolicy,
    focusPolicy: 'never',
    launchEnvironment: Object.freeze({}),
    args: Object.freeze([
      `--user-data-dir=${userDataDir}`,
      `--profile-directory=${slot.profileDirectory}`,
      `--remote-debugging-address=${slot.cdp.host}`,
      `--remote-debugging-port=${slot.cdp.port}`,
      '--no-first-run',
      '--no-default-browser-check',
      '--enable-automation',
      '--enable-unsafe-extension-debugging',
      '--no-startup-window',
      '--enable-logging=stderr',
      '--log-level=1',
    ]),
  });
}

function delay(ms, signal) {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(signal.reason || new Error('BROWSER_QA_LIFECYCLE_ABORTED'));
      return;
    }
    const onAbort = () => {
      clearTimeout(timer);
      reject(signal.reason || new Error('BROWSER_QA_LIFECYCLE_ABORTED'));
    };
    const timer = setTimeout(() => {
      signal?.removeEventListener('abort', onAbort);
      resolve();
    }, ms);
    signal?.addEventListener('abort', onAbort, { once: true });
  });
}

function assertLifecycleAction(action) {
  if (!['start', 'ensure', 'stop'].includes(action)) {
    fail('BROWSER_QA_LIFECYCLE_ACTION_INVALID', action || 'missing');
  }
}

function validateTiming(startupTimeoutMs, pollIntervalMs) {
  if (
    !Number.isSafeInteger(startupTimeoutMs)
    || startupTimeoutMs < 1_000
    || startupTimeoutMs > 120_000
  ) {
    fail('BROWSER_QA_STARTUP_TIMEOUT_INVALID', String(startupTimeoutMs));
  }
  if (
    !Number.isSafeInteger(pollIntervalMs)
    || pollIntervalMs < 25
    || pollIntervalMs > 2_000
    || pollIntervalMs >= startupTimeoutMs
  ) {
    fail('BROWSER_QA_POLL_INTERVAL_INVALID', String(pollIntervalMs));
  }
}

function assertStartableInspection(inspection) {
  if (inspection.failures.includes('executable_unavailable')) {
    fail('BROWSER_QA_MANAGED_INSTALLATION_UNAVAILABLE', inspection.profileSlotId);
  }
  if (inspection.failures.includes('profile_unavailable')) {
    fail('BROWSER_QA_MANAGED_PROFILE_UNAVAILABLE', inspection.profileSlotId);
  }
  if (inspection.failures.includes('cdp_endpoint_occupied_invalid')) {
    fail('BROWSER_QA_CDP_ENDPOINT_OCCUPIED_INVALID', inspection.profileSlotId);
  }
  if (inspection.failures.includes('browser_identity_unverified')) {
    throw createIdentityAdmissionError(
      inspection.profileSlotId,
      inspection.checks.identity,
      'prelaunch_identity',
    );
  }
}

/**
 * Stops exactly one declared managed browser.
 *
 * The rule this exists to keep: a stop is only allowed against a process this
 * boundary can *prove* is the declared slot's own browser. Identity comes from
 * the compiled launch spec — the same user-data-dir and owner token the slot
 * would launch with — so a personal Chrome, another profile, or an operator's
 * own window is never a candidate. When identity cannot be proven the call
 * fails loudly rather than falling back to a broader match.
 */
async function stopManagedPersistentBrowser({
  slot,
  before,
  dedicatedProfileOwnership,
  terminateProcess,
  inspectProcessSlotAvailability,
  translateWslPath,
  startupTimeoutMs,
  pollIntervalMs,
  signal,
  now,
  wait,
}) {
  const launchSpec = await compilePersistentBrowserLaunchSpec(slot, {
    translateWslPath,
  });
  if (typeof inspectProcessSlotAvailability !== 'function') {
    fail('BROWSER_QA_PROCESS_SLOT_INSPECTOR_REQUIRED');
  }
  const occupancy = await inspectProcessSlotAvailability(launchSpec, {
    allowPresent: true,
  });
  if (occupancy?.status === 'absent') {
    return Object.freeze({
      contractVersion: 1,
      action: 'stop',
      status: 'STOPPED',
      lifecycleAction: 'already_absent',
      profileSlotId: slot.id,
      before,
      after: before,
      termination: null,
      dedicatedProfileOwnership,
    });
  }
  if (occupancy?.status !== 'present') {
    fail('BROWSER_QA_MANAGED_PROCESS_SLOT_INSPECTION_INVALID', slot.id);
  }
  // A reachable CDP port with no matching process is someone else holding the
  // port. Terminating on that evidence would kill an unidentified process.
  if (occupancy.conflictKind !== 'managed_user_data_dir_in_use') {
    fail('BROWSER_QA_MANAGED_STOP_IDENTITY_UNPROVEN', `${slot.id}:${occupancy.conflictKind || 'unknown'}`);
  }
  const termination = await terminateProcess(launchSpec, { occupancy });
  if (termination?.status !== 'terminated') {
    fail('BROWSER_QA_MANAGED_STOP_TERMINATION_INVALID', slot.id);
  }
  const deadline = now() + startupTimeoutMs;
  let after = await inspectProcessSlotAvailability(launchSpec, { allowPresent: true });
  while (after?.status !== 'absent' && now() < deadline) {
    if (signal?.aborted) fail('BROWSER_QA_MANAGED_STOP_ABORTED', slot.id);
    await wait(pollIntervalMs);
    after = await inspectProcessSlotAvailability(launchSpec, { allowPresent: true });
  }
  if (after?.status !== 'absent') {
    fail('BROWSER_QA_MANAGED_STOP_NOT_CONFIRMED', slot.id);
  }
  return Object.freeze({
    contractVersion: 1,
    action: 'stop',
    status: 'STOPPED',
    lifecycleAction: 'terminated',
    profileSlotId: slot.id,
    before,
    after: Object.freeze({ status: 'ABSENT', checks: null, failures: [] }),
    termination: Object.freeze({
      processCount: occupancy.processCount,
      pids: Object.freeze([...(occupancy.pids || [])]),
      processAction: termination.processAction || null,
    }),
    dedicatedProfileOwnership,
  });
}

export async function runPersistentBrowserLifecycle({
  action,
  profileSlot,
  acquireLease,
  launchProcess,
  terminateProcess = null,
  inspectProcessSlotAvailability,
  verifyDedicatedProfileOwnership,
  fetchImpl = globalThis.fetch,
  tcpProbe,
  stat = fs.stat,
  verifyBrowserIdentity = null,
  translateWslPath = defaultWslPathTranslator,
  startupTimeoutMs = DEFAULT_STARTUP_TIMEOUT_MS,
  pollIntervalMs = DEFAULT_POLL_INTERVAL_MS,
  signal = null,
  now = Date.now,
  wait = delay,
} = {}) {
  assertLifecycleAction(action);
  const slot = requireManagedProfileSlot(profileSlot);
  validateTiming(startupTimeoutMs, pollIntervalMs);
  if (typeof acquireLease !== 'function') fail('BROWSER_QA_LIFECYCLE_LEASE_ADAPTER_REQUIRED');
  if (action === 'stop') {
    if (typeof terminateProcess !== 'function') {
      fail('BROWSER_QA_PROCESS_TERMINATE_ADAPTER_REQUIRED');
    }
  } else if (typeof launchProcess !== 'function') {
    fail('BROWSER_QA_PROCESS_LAUNCH_ADAPTER_REQUIRED');
  }
  let dedicatedProfileOwnership = await admitDedicatedProfileOwnership(
    slot,
    verifyDedicatedProfileOwnership,
    action,
  );
  const lease = await acquireLease({ profileSlot: slot, action });
  if (!lease || typeof lease.release !== 'function') {
    fail('BROWSER_QA_LIFECYCLE_LEASE_INVALID');
  }

  let primaryError = null;
  let processLease = null;
  let processHandedOff = false;
  let startupStartedAt = null;
  let startupStage = 'prelaunch';
  let pollCount = 0;
  let lastInspection = null;
  let startupDiagnostics = null;
  try {
    dedicatedProfileOwnership = await admitDedicatedProfileOwnership(
      slot,
      verifyDedicatedProfileOwnership,
      action,
    );
    const before = await inspectPersistentBrowserProfileSlot(slot, {
      fetchImpl,
      tcpProbe,
      stat,
      dedicatedProfileOwnership,
      verifyBrowserIdentity,
    });
    lastInspection = before;
    if (action === 'stop') {
      return await stopManagedPersistentBrowser({
        slot,
        before,
        dedicatedProfileOwnership,
        terminateProcess,
        inspectProcessSlotAvailability,
        translateWslPath,
        startupTimeoutMs,
        pollIntervalMs,
        signal,
        now,
        wait,
      });
    }
    if (before.status === 'READY') {
      if (action === 'start') {
        fail('BROWSER_QA_MANAGED_BROWSER_ALREADY_RUNNING', slot.id);
      }
      return Object.freeze({
        contractVersion: 1,
        action,
        status: 'READY',
        lifecycleAction: 'already_ready',
        profileSlotId: slot.id,
        before,
        after: before,
        launch: null,
        dedicatedProfileOwnership,
      });
    }
    assertStartableInspection(before);
    const launchSpec = await compilePersistentBrowserLaunchSpec(slot, {
      translateWslPath,
    });
    dedicatedProfileOwnership = await admitDedicatedProfileOwnership(
      slot,
      verifyDedicatedProfileOwnership,
      action,
    );
    if (typeof inspectProcessSlotAvailability !== 'function') {
      fail('BROWSER_QA_PROCESS_SLOT_INSPECTOR_REQUIRED');
    }
    const processSlotAvailability = await inspectProcessSlotAvailability(launchSpec);
    if (processSlotAvailability?.status !== 'absent') {
      fail('BROWSER_QA_MANAGED_PROCESS_SLOT_NOT_AVAILABLE', slot.id);
    }
    startupStartedAt = now();
    startupStage = 'launch_process';
    processLease = await launchProcess(launchSpec);
    if (
      !processLease
      || typeof processLease !== 'object'
      || typeof processLease.rollback !== 'function'
      || typeof processLease.handoff !== 'function'
      || typeof processLease.assertHealthy !== 'function'
      || typeof processLease.readStartupDiagnostics !== 'function'
    ) {
      fail('BROWSER_QA_PROCESS_LAUNCH_RECEIPT_INVALID', slot.id);
    }
    processLease.assertHealthy();
    startupStage = 'wait_for_cdp';
    const startedAt = now();
    let after = before;
    while (now() - startedAt < startupTimeoutMs) {
      if (signal?.aborted) {
        fail('BROWSER_QA_LIFECYCLE_ABORTED', slot.id, { cause: signal.reason });
      }
      processLease.assertHealthy();
      await wait(pollIntervalMs, signal);
      after = await inspectPersistentBrowserProfileSlot(slot, {
        fetchImpl,
        tcpProbe,
        stat,
        dedicatedProfileOwnership,
        verifyBrowserIdentity,
      });
      lastInspection = after;
      pollCount += 1;
      if (after.status === 'READY') {
        startupStage = 'identity_handoff';
        dedicatedProfileOwnership = await admitDedicatedProfileOwnership(
          slot,
          verifyDedicatedProfileOwnership,
          action,
        );
        const handoff = await processLease.handoff({
          browserIdentity: after.checks.identity,
        });
        processHandedOff = true;
        return Object.freeze({
          contractVersion: 1,
          action,
          status: 'READY',
          lifecycleAction: 'started',
          profileSlotId: slot.id,
          before,
          after,
          launch: Object.freeze({
            installationId: launchSpec.installationId,
            platform: launchSpec.platform,
            osFocusRequest: 'none',
            startupWindow: 'none',
            pid: Number.isSafeInteger(processLease.pid) ? processLease.pid : null,
            processHandoff: handoff || null,
            processSlotAvailability,
          }),
          dedicatedProfileOwnership,
        });
      }
      if (after.failures.includes('cdp_endpoint_occupied_invalid')) {
        fail('BROWSER_QA_CDP_ENDPOINT_OCCUPIED_INVALID', slot.id);
      }
      if (after.failures.includes('browser_identity_unverified')) {
        throw createIdentityAdmissionError(
          slot.id,
          after.checks.identity,
          'post_launch_identity',
        );
      }
    }
    const timeoutError = new Error(`BROWSER_QA_MANAGED_BROWSER_START_UNCONFIRMED:${slot.id}`);
    timeoutError.code = 'BROWSER_QA_MANAGED_BROWSER_START_UNCONFIRMED';
    timeoutError.stage = startupStage;
    throw timeoutError;
  } catch (error) {
    let effectiveError = error;
    if (startupStartedAt !== null) {
      startupDiagnostics = {
        contractVersion: 1,
        profileSlotId: slot.id,
        stage: startupStage,
        failureCode: namedErrorCode(error),
        elapsedMs: Math.max(0, now() - startupStartedAt),
        timeoutMs: startupTimeoutMs,
        pollCount,
        lastInspection: projectStartupInspection(lastInspection),
        process: typeof processLease?.readStartupDiagnostics === 'function'
          ? processLease.readStartupDiagnostics() : null,
        rollback: 'not_attempted',
        leaseRelease: 'pending',
      };
    }
    if (
      processLease
      && !processHandedOff
      && typeof processLease.rollback === 'function'
    ) {
      try {
        await processLease.rollback();
        if (startupDiagnostics) startupDiagnostics.rollback = 'completed';
      } catch (rollbackError) {
        if (startupDiagnostics) startupDiagnostics.rollback = 'failed';
        effectiveError = new AggregateError(
          [error, rollbackError],
          `BROWSER_QA_MANAGED_BROWSER_START_ROLLBACK_FAILED:${slot.id}`,
          { cause: error },
        );
      }
    }
    if (startupDiagnostics) effectiveError.startupDiagnostics = startupDiagnostics;
    primaryError = effectiveError;
    throw effectiveError;
  } finally {
    try {
      await lease.release();
      if (startupDiagnostics) startupDiagnostics.leaseRelease = 'completed';
    } catch (releaseError) {
      if (startupDiagnostics) startupDiagnostics.leaseRelease = 'failed';
      if (primaryError) {
        const combinedError = new AggregateError(
          [primaryError, releaseError],
          `BROWSER_QA_LIFECYCLE_AND_LEASE_RELEASE_FAILED:${slot.id}`,
          { cause: primaryError },
        );
        if (startupDiagnostics) combinedError.startupDiagnostics = startupDiagnostics;
        throw combinedError;
      }
      throw releaseError;
    }
  }
}

function projectStartupInspection(inspection) {
  if (inspection === null) return null;
  const { cdp, identity } = inspection.checks;
  return Object.freeze({
    status: inspection.status,
    failures: inspection.failures,
    cdp: Object.freeze({
      status: cdp.status,
      // Never persist arbitrary fetch/verifier messages or endpoint URLs.
      errorCode: cdp.status === 'ready' ? null
        : cdp.errorCode || (/^(?:tcp_[A-Z0-9_]{1,64}|cdp_[a-z_]{1,64})$/u.test(cdp.error)
          ? cdp.error : 'cdp_probe_failed'),
      httpStatus: Number.isInteger(cdp.httpStatus) ? cdp.httpStatus : null,
    }),
    identity: Object.freeze({
      status: identity.status,
      causeCode: identity.causeCode || null,
    }),
  });
}

function probeTransportErrorCode(error) {
  if (error?.name === 'TimeoutError') return 'cdp_http_timeout';
  if (error?.name === 'AbortError') return 'cdp_http_aborted';
  const code = error?.cause?.code || error?.code;
  return typeof code === 'string' && /^[A-Z0-9_]{1,64}$/u.test(code)
    ? `http_${code}` : 'cdp_http_request_failed';
}
