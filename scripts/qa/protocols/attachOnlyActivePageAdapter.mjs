import {
  readQaCdpPageTargetWindow,
} from '../../browser-qa/browser/cdpTargetOwner.mjs';
import { registerQaChildAbortCleanup } from '../runtime/qaChildAbortRegistry.mjs';
import ProfileResetLifecycleRepository, {
  resolveProfileResetGeneration,
} from '../../../src/platform/storage/runtime/ProfileResetLifecycleRepository.js';
import ProfileResetLifecycleStore, {
  PROFILE_RESET_LIFECYCLE_STORAGE_KEY,
} from '../../../src/platform/storage/internal/chrome-storage/stores/ProfileResetLifecycleStore.js';
import { requireModelStateProfileEpochId } from '../../../src/platform/storage/model/ProfileEpochContract.js';
import { normalizeProfileCompatibilityRecovery } from '../../../src/platform/storage/model/ProfileCompatibilityContract.js';
import { normalizeSettingsProfileRecovery } from '../../../src/platform/storage/settings/SettingsProfileRecoveryContract.js';

const TRACKING_RUNTIME_ACTION = 'DEBUG_GET_TRACKING_RUNTIME_STATE';
const DEFAULT_TRACKING_TIMEOUT_MS = 2_000;
const DEFAULT_TRACKING_POLL_INTERVAL_MS = 50;
const DEFAULT_TRACKING_PROBE_TIMEOUT_MS = 500;
const POST_RELOAD_TRACKING_READINESS_TIMEOUT_MS = 12_000;
const POST_RELOAD_TRACKING_READINESS_POLL_INTERVAL_MS = 100;
const POST_RELOAD_TRACKING_READINESS_PROBE_TIMEOUT_MS = 2_000;
const POST_RELOAD_ARTIFACT_IDENTITY_TIMEOUT_MS = 2_000;
const POST_RELOAD_RESULT_DELIVERY_GRACE_MS = 250;

const TRACKING_POLL_MODES = Object.freeze({
  EXACT_TARGET: 'exact_target',
  RUNTIME_READINESS: 'runtime_readiness',
});

const TRACKING_FAILURE_MESSAGES = Object.freeze({
  build_identity_mismatch: 'running background code did not match the admitted build',
  dispatch_error: 'tracking runtime probe dispatch failed',
  invalid_result: 'tracking runtime probe returned an invalid result',
  probe_timeout: 'tracking runtime probe timed out',
  runtime_error: 'tracking runtime message failed',
  runtime_not_ready: 'tracking runtime did not report readiness',
  target_not_admitted: 'target activation was not admitted by tracking runtime',
});

const TRACKING_FAILURE_CAUSE_CODES = Object.freeze({
  build_identity_mismatch: 'QA_ATTACH_RUNNING_BUILD_IDENTITY_MISMATCH',
  dispatch_error: 'QA_ATTACH_TRACKING_RUNTIME_DISPATCH_FAILED',
  invalid_result: 'QA_ATTACH_TRACKING_RUNTIME_RESULT_INVALID',
  probe_timeout: 'QA_ATTACH_TRACKING_RUNTIME_CALLBACK_TIMEOUT',
  runtime_error: 'QA_ATTACH_TRACKING_RUNTIME_MESSAGE_ERROR',
  runtime_not_ready: 'QA_ATTACH_TRACKING_RUNTIME_NOT_READY',
  target_not_admitted: 'QA_ATTACH_TRACKING_TARGET_NOT_ADMITTED',
});

const TRACKING_DIAGNOSTIC_FIELDS = Object.freeze([
  'attemptCount',
  'callbackCount',
  'lateCallbackCount',
  'probeTimeoutCount',
  'runtimeErrorCount',
  'dispatchErrorCount',
  'mismatchCount',
  'nonAdmissionResponseCount',
  'elapsedMs',
]);

const TRACKING_RESPONSE_STATES = Object.freeze([
  'not_received', 'missing_response', 'invalid_response', 'negative_ack',
  'invalid_success', 'runtime_missing', 'runtime_invalid', 'runtime_ready',
]);
const TRACKING_RESPONSE_ERROR_CODES = Object.freeze([
  'SERVICE_INIT_FAILED', 'SERVICE_DISPATCH_FAILED', 'SERVICE_NOT_HANDLED_ASYNC',
  'UNTRUSTED_SENDER', 'UNAUTHORIZED_RUNTIME_SENDER', 'UNREGISTERED_RUNTIME_ACTION',
  'PROFILE_MUTATION_RUNTIME_ADMISSION_CLOSED',
  'PROFILE_MUTATION_RUNTIME_ADMISSION_GENERATION_CHANGED',
  'PROFILE_MUTATION_RUNTIME_TERMINAL_HANDOFF_PENDING',
  'PROFILE_MUTATION_RUNTIME_RECOVERY_GATE_MISMATCH',
  'TRACKING_RUNTIME_SNAPSHOT_TAB_TIME_TRACKER_REQUIRED',
  'TRACKING_RUNTIME_SNAPSHOT_STATS_RUNTIME_REQUIRED',
]);
const EARLY_SETTINGS_READ_ERROR_CODES = Object.freeze([
  'DASHBOARD_BOOT_READINESS_FAILED', 'CYCLE_STATE_HYDRATION_FAILED',
  'SETTINGS_STORED_VALUE_INVALID', 'SETTINGS_DOCUMENT_KEY_INVALID',
  'SETTINGS_DOCUMENT_CONTRACT_INVALID', 'SETTINGS_SCOPE_FORBIDDEN', 'GET_SETTINGS_FAILED',
  'SECURITY_VAULT_INCOMPATIBLE', 'SECURITY_VAULT_PLAINTEXT_PROFILE_UNSUPPORTED',
  'SECURITY_VAULT_ENVELOPE_INVALID',
  'MODEL_STATE_PROFILE_COMPATIBILITY_BASELINE_RESET_REQUIRED',
  'MODEL_STATE_PROFILE_COMPATIBILITY_DOWNGRADE_BLOCKED', 'MODEL_STATE_PROFILE_EPOCH_CONTRACT_INVALID',
  'PROFILE_RESET_LIFECYCLE_STATE_INVALID', 'PROFILE_RESET_WRITE_ADMISSION_CLOSED',
  'PROFILE_MUTATION_RUNTIME_ADMISSION_CLOSED',
  'PROFILE_MUTATION_RUNTIME_ADMISSION_GENERATION_CHANGED',
  'PROFILE_MUTATION_RUNTIME_TERMINAL_HANDOFF_PENDING',
  'PROFILE_MUTATION_RUNTIME_RECOVERY_GATE_MISMATCH',
  'SERVICE_DISPATCH_FAILED', 'SERVICE_NOT_HANDLED_ASYNC', 'SERVICE_INIT_FAILED',
  'UNTRUSTED_SENDER', 'UNAUTHORIZED_RUNTIME_SENDER',
]);
const PROFILE_READINESS_ERROR_CODES = Object.freeze([
  ...EARLY_SETTINGS_READ_ERROR_CODES,
  'PROFILE_GENERATION_BOOT_SETTLEMENT_FAILED', 'PROFILE_GENERATION_READINESS_ASSERT_FAILED',
  'PROFILE_GENERATION_READINESS_RESULT_MISMATCH', 'PROFILE_RESET_GENERATION_STALE',
  'BACKGROUND_ZEN_PROFILE_GENERATION_READINESS_EPOCH_MISMATCH',
  'PROFILE_COMPATIBILITY_RECOVERY_CONTRACT_INVALID', 'SETTINGS_PROFILE_RECOVERY_CONTRACT_INVALID',
]);

// The lifecycle packet is private input to the typed owner, never evidence.
// The dedicated response projects only bounded descriptor primitives and identity equality.
function readProfileReadinessPacket(stage, { storageKey, generation, timeoutMs, errorCodes }) {
  return new Promise((resolve) => {
    let settled = false;
    const finish = (packet) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve(packet);
    };
    const unavailable = (reason) => finish({ status: 'unavailable', reason });
    const timer = setTimeout(() => unavailable('callback_timeout'), timeoutMs);
    try {
      if (stage === 'lifecycle') {
        chrome.storage.local.get([storageKey], (result) => {
          const runtimeError = chrome.runtime.lastError;
          if (settled) return;
          if (runtimeError) return unavailable('runtime_error');
          if (!result || typeof result !== 'object' || Array.isArray(result)) {
            return finish({ status: 'invalid', reason: 'lifecycle_projection_invalid' });
          }
          const present = Object.hasOwn(result, storageKey);
          finish(present ? { status: 'read', present, value: result[storageKey] } : { status: 'read', present });
        });
        return;
      }
      chrome.runtime.sendMessage({ action: 'GET_PROFILE_GENERATION_READINESS', profileGeneration: generation }, (response) => {
        const runtimeError = chrome.runtime.lastError;
        if (settled) return;
        if (runtimeError) return unavailable('runtime_error');
        if (!response || typeof response !== 'object' || Array.isArray(response)) {
          return finish({ status: 'unknown', reason: 'invalid_response' });
        }
        const generationMatch = Object.hasOwn(response, 'profileGeneration')
          && response.profileGeneration === generation;
        const fields = ['settingsProfileRecovery', 'profileCompatibilityRecovery'].filter((key) => Object.hasOwn(response, key));
        let recovery = null;
        if (fields.length > 1 || (response.success === true && fields.length)) {
          return finish({ status: 'invalid', reason: 'recovery_invalid', generationMatch });
        }
        if (fields.length === 1) {
          const candidate = response[fields[0]];
          const keys = fields[0] === 'settingsProfileRecovery'
            ? ['contract', 'kind', 'failureCode', 'recoveryAction', 'documentKey', 'key']
            : ['contract', 'kind', 'failureCode', 'recoveryAction', 'reason', 'expectedBaseline', 'observedBaseline'];
          if (!candidate || typeof candidate !== 'object' || Array.isArray(candidate)
            || Object.keys(candidate).length !== keys.length
            || keys.some((key) => !Object.hasOwn(candidate, key)
              || ![null, 'string', 'number'].includes(candidate[key] === null ? null : typeof candidate[key])
              || (typeof candidate[key] === 'string' && candidate[key].length > 128))) {
            return finish({ status: 'invalid', reason: 'recovery_invalid', generationMatch });
          }
          recovery = Object.fromEntries(keys.map((key) => [key, candidate[key]]));
        }
        if (response.success !== true && response.success !== false) {
          return finish({ status: 'unknown', reason: 'invalid_response', generationMatch });
        }
        finish({ status: response.success ? 'ready' : 'rejected', generationMatch, recovery,
          code: response.success ? null : errorCodes.includes(response.error) ? response.error : null });
      });
    } catch {
      unavailable('dispatch_error');
    }
  });
}

async function observeProfileGenerationReadiness(harness, trustedPageDeadlineAtMs) {
  const result = (status, reason, code = null, generationMatch = null, recovery = null) => (
    { status, code, reason, generationMatch, recovery }
  );
  const phaseDeadlineAtMs = Math.min(trustedPageDeadlineAtMs - POST_RELOAD_RESULT_DELIVERY_GRACE_MS,
    Date.now() + POST_RELOAD_TRACKING_READINESS_PROBE_TIMEOUT_MS);
  let cancelled = false;
  let cancelObservation;
  const cancellation = new Promise((resolve) => {
    cancelObservation = () => { cancelled = true; resolve({ status: 'unavailable', reason: 'cancelled' }); };
  });
  const availability = () => {
    if (cancelled) return 'cancelled';
    if (harness.childCloseOperation || (Object.hasOwn(harness, 'cdp') && harness.cdp === null)) return 'session_closing';
    return phaseDeadlineAtMs <= Date.now() ? 'deadline_exhausted' : null;
  };
  const initialUnavailable = availability();
  if (initialUnavailable) return result('unavailable', initialUnavailable);
  let unregisterAbort;
  try {
    unregisterAbort = registerQaChildAbortCleanup(cancelObservation, { phase: 'protocol' });
  } catch {
    return result('unavailable', 'cancelled');
  }
  let failedProjection = null;
  const evaluate = async (stage, generation = null) => {
    const unavailable = availability();
    if (unavailable) return { status: 'unavailable', reason: unavailable };
    const timeoutMs = phaseDeadlineAtMs - Date.now();
    return Promise.race([cancellation, harness.evaluateInTrustedPage(
      `(${readProfileReadinessPacket.toString()})(${JSON.stringify(stage)}, ${JSON.stringify({
        storageKey: PROFILE_RESET_LIFECYCLE_STORAGE_KEY, generation, timeoutMs,
        errorCodes: PROFILE_READINESS_ERROR_CODES,
      })})`, { timeoutMs: timeoutMs + POST_RELOAD_RESULT_DELIVERY_GRACE_MS, trustedPageDeadlineAtMs },
    )]);
  };
  try {
    const lifecycleStore = new ProfileResetLifecycleStore({
      readLocal: async (keys) => {
        if (keys.length !== 1 || keys[0] !== PROFILE_RESET_LIFECYCLE_STORAGE_KEY) {
          throw new Error('QA_ATTACH_PROFILE_DIAGNOSTIC_KEY_INVALID');
        }
        const packet = await evaluate('lifecycle');
        const packetKeys = packet && typeof packet === 'object' && !Array.isArray(packet) ? Object.keys(packet).sort().join(',') : '';
        if (packet?.status !== 'read' || typeof packet.present !== 'boolean'
          || !(packet.present ? ['present,status', 'present,status,value'].includes(packetKeys) : packetKeys === 'present,status')) {
          failedProjection = packet?.status === 'unavailable'
            && ['runtime_error', 'dispatch_error', 'callback_timeout', 'cancelled', 'session_closing', 'deadline_exhausted'].includes(packet.reason)
            ? result('unavailable', packet.reason) : result('invalid', 'lifecycle_projection_invalid');
          throw new Error('QA_ATTACH_PROFILE_DIAGNOSTIC_READ_FAILED');
        }
        // Present null/undefined must reach the owner validator and fail; only absence is initial generation.
        return packet.present ? { [PROFILE_RESET_LIFECYCLE_STORAGE_KEY]: packet.value } : {};
      },
      writeLocal: () => { throw new Error('QA_ATTACH_PROFILE_DIAGNOSTIC_READ_ONLY'); },
    });
    const repository = new ProfileResetLifecycleRepository({ lifecycleStore });
    const generation = requireModelStateProfileEpochId(resolveProfileResetGeneration(await repository.read()));
    const packet = await evaluate('readiness', generation);
    const keys = packet && typeof packet === 'object' && !Array.isArray(packet) ? Object.keys(packet).sort().join(',') : '';
    if (packet?.status === 'unavailable' && keys === 'reason,status'
      && ['runtime_error', 'dispatch_error', 'callback_timeout', 'cancelled', 'session_closing', 'deadline_exhausted'].includes(packet.reason)) {
      return result('unavailable', packet.reason);
    }
    if (packet?.status === 'unknown' && ['invalid_response'].includes(packet.reason)
      && ['reason,status', 'generationMatch,reason,status'].includes(keys)) {
      return result('unknown', packet.reason, null, typeof packet.generationMatch === 'boolean' ? packet.generationMatch : null);
    }
    if (packet?.status === 'invalid' && packet.reason === 'recovery_invalid' && keys === 'generationMatch,reason,status'
      && typeof packet.generationMatch === 'boolean') return result('invalid', packet.reason, null, packet.generationMatch);
    if (keys !== 'code,generationMatch,recovery,status' || typeof packet.generationMatch !== 'boolean'
      || !['ready', 'rejected'].includes(packet.status)
      || (packet.code !== null && !PROFILE_READINESS_ERROR_CODES.includes(packet.code))) return result('invalid', 'invalid_projection');
    if (!packet.generationMatch) return result('invalid', 'generation_mismatch', packet.code, false);
    if (packet.status === 'rejected' && packet.code === null) return result('unknown', 'unclassified_error', null, true);
    let recovery = null;
    if (packet.recovery !== null) {
      try {
        recovery = packet.recovery?.contract === 'settings_profile_recovery_v1'
          ? normalizeSettingsProfileRecovery(packet.recovery) : normalizeProfileCompatibilityRecovery(packet.recovery);
        if (packet.status !== 'rejected' || packet.code !== recovery.failureCode) throw new Error('QA_ATTACH_PROFILE_DIAGNOSTIC_RECOVERY_MISMATCH');
      } catch {
        return result('invalid', 'recovery_invalid', packet.code, true);
      }
    }
    if (packet.status === 'ready' && packet.code !== null) return result('invalid', 'invalid_projection', null, true);
    return result(packet.status, null, packet.code, true, recovery);
  } catch (error) {
    if (failedProjection) return failedProjection;
    if (error?.code === 'PROFILE_RESET_LIFECYCLE_STATE_INVALID') {
      return result('invalid', 'lifecycle_invalid', error.code);
    }
    if (error?.message === 'MODEL_STATE_PROFILE_EPOCH_INVALID') return result('invalid', 'lifecycle_generation_invalid');
    return result('unavailable', 'transport_error');
  } finally {
    unregisterAbort();
  }
}

async function observeEarlySettingsReadiness(harness, trustedPageDeadlineAtMs) {
  const unavailable = (reason) => ({ status: 'unavailable', code: null, reason });
  const remainingMs = trustedPageDeadlineAtMs - Date.now() - POST_RELOAD_RESULT_DELIVERY_GRACE_MS;
  if (remainingMs <= 0) return unavailable('deadline_exhausted');
  if (harness.childCloseOperation || (Object.hasOwn(harness, 'cdp') && harness.cdp === null)) {
    return unavailable('session_closing');
  }
  const timeoutMs = Math.min(POST_RELOAD_TRACKING_READINESS_PROBE_TIMEOUT_MS, remainingMs);
  let cancelObservation;
  let cancelled = false;
  const cancellation = new Promise((resolve) => {
    cancelObservation = () => {
      cancelled = true;
      resolve(unavailable('cancelled'));
    };
  });
  let unregisterAbort;
  try {
    unregisterAbort = registerQaChildAbortCleanup(cancelObservation, { phase: 'protocol' });
  } catch {
    return unavailable('cancelled');
  }
  try {
    if (cancelled) return unavailable('cancelled');
    const result = await Promise.race([
      cancellation,
      harness.evaluateInTrustedPage(`new Promise((resolve) => {
        const errorCodes = ${JSON.stringify(EARLY_SETTINGS_READ_ERROR_CODES)};
        let settled = false;
        const finish = (status, code, reason) => {
          if (settled) return;
          settled = true;
          clearTimeout(timer);
          resolve({ status, code, reason });
        };
        const timer = setTimeout(() => finish('unavailable', null, 'callback_timeout'), ${JSON.stringify(timeoutMs)});
        try {
          chrome.runtime.sendMessage({ action: 'GET_SETTINGS', keys: [] }, (response) => {
            const runtimeError = chrome.runtime.lastError;
            if (settled) return;
            if (runtimeError) {
              finish('unavailable', null, 'runtime_error');
            } else if (!response || typeof response !== 'object' || Array.isArray(response)) {
              finish('unknown', null, 'invalid_response');
            } else if (response.success === true) {
              finish('readable', null, null);
            } else if (response.success === false && errorCodes.includes(response.error)) {
              finish('rejected', response.error, null);
            } else {
              finish('unknown', null, 'unclassified_error');
            }
          });
        } catch {
          finish('unavailable', null, 'dispatch_error');
        }
      })`, { timeoutMs: timeoutMs + POST_RELOAD_RESULT_DELIVERY_GRACE_MS, trustedPageDeadlineAtMs }),
    ]);
    const keys = result && typeof result === 'object' && !Array.isArray(result) ? Object.keys(result).sort() : [];
    const valid = keys.join(',') === 'code,reason,status' && (
      (result.status === 'readable' && result.code === null && result.reason === null)
      || (result.status === 'rejected' && EARLY_SETTINGS_READ_ERROR_CODES.includes(result.code) && result.reason === null)
      || (result.status === 'unknown' && result.code === null && ['invalid_response', 'unclassified_error'].includes(result.reason))
      || (result.status === 'unavailable' && result.code === null
        && ['callback_timeout', 'runtime_error', 'dispatch_error', 'cancelled'].includes(result.reason))
    );
    return valid ? result : { status: 'unknown', code: null, reason: 'invalid_projection' };
  } catch {
    return unavailable('transport_error');
  } finally {
    unregisterAbort();
  }
}

// Serialized into the existing trusted-page probe. Only closed shape labels
// and exact named codes cross back; message text and runtime data stay there.
function classifyTrackingResponse(response, errorCodes) {
  if (response === null || response === undefined) {
    return { responseState: 'missing_response', responseCode: null };
  }
  if (typeof response !== 'object' || Array.isArray(response)) {
    return { responseState: 'invalid_response', responseCode: null };
  }
  const responseCode = response.error === null || response.error === undefined
    ? null
    : errorCodes.includes(response.error) ? response.error : 'unclassified';
  const responseState = response.success === false ? 'negative_ack'
    : response.success !== true ? 'invalid_success'
      : response.runtime === null || response.runtime === undefined ? 'runtime_missing'
        : typeof response.runtime !== 'object' || Array.isArray(response.runtime)
          ? 'runtime_invalid' : 'runtime_ready';
  return { responseState, responseCode };
}

const ARTIFACT_RUNTIME_IDENTITY_FAILURE_MESSAGES = Object.freeze({
  build_identity_mismatch: 'runtime build identity did not match the staged artifact',
  build_info_invalid: 'runtime build information was invalid',
  fetch_failed: 'runtime build information could not be fetched',
  host_permission_mismatch: 'runtime host permissions did not match the staged contract',
  invalid_result: 'runtime artifact identity probe returned an invalid result',
  manifest_invalid: 'runtime manifest was invalid',
  permission_mismatch: 'runtime permissions did not match the staged contract',
  probe_error: 'runtime artifact identity probe failed',
  probe_timeout: 'runtime artifact identity probe timed out',
  trusted_page_mismatch: 'runtime trusted page did not match the staged contract',
});

const ARTIFACT_RUNTIME_IDENTITY_CAUSE_CODES = Object.freeze({
  build_identity_mismatch: 'QA_ATTACH_ARTIFACT_RUNTIME_BUILD_IDENTITY_MISMATCH',
  build_info_invalid: 'QA_ATTACH_ARTIFACT_RUNTIME_BUILD_INFO_INVALID',
  fetch_failed: 'QA_ATTACH_ARTIFACT_RUNTIME_BUILD_INFO_FETCH_FAILED',
  host_permission_mismatch: 'QA_ATTACH_ARTIFACT_RUNTIME_HOST_PERMISSION_MISMATCH',
  invalid_result: 'QA_ATTACH_ARTIFACT_RUNTIME_IDENTITY_RESULT_INVALID',
  manifest_invalid: 'QA_ATTACH_ARTIFACT_RUNTIME_MANIFEST_INVALID',
  permission_mismatch: 'QA_ATTACH_ARTIFACT_RUNTIME_PERMISSION_MISMATCH',
  probe_error: 'QA_ATTACH_ARTIFACT_RUNTIME_IDENTITY_PROBE_ERROR',
  probe_timeout: 'QA_ATTACH_ARTIFACT_RUNTIME_IDENTITY_PROBE_TIMEOUT',
  trusted_page_mismatch: 'QA_ATTACH_ARTIFACT_RUNTIME_TRUSTED_PAGE_MISMATCH',
});

function requirePositiveInteger(value, code) {
  if (!Number.isInteger(value) || value <= 0) throw new Error(`${code}:${value}`);
  return value;
}

function isCanonicalStringArray(value) {
  return Array.isArray(value)
    && !value.some((entry) => (
      typeof entry !== 'string'
      || !entry
      || entry !== entry.trim()
    ))
    && new Set(value).size === value.length
    && JSON.stringify([...value].sort((left, right) => left.localeCompare(right)))
      === JSON.stringify(value);
}

function requireCanonicalStringArray(value, code) {
  if (!isCanonicalStringArray(value)) throw new Error(code);
  return Object.freeze([...value]);
}

function requireAttachActiveExecution(browserExecution) {
  if (browserExecution?.processOwnership !== 'attach_only') {
    throw new Error('QA_ATTACH_ACTIVE_PAGE_PROCESS_OWNERSHIP_REQUIRED');
  }
  if (browserExecution.targetActivation !== 'active') {
    throw new Error('QA_ATTACH_ACTIVE_PAGE_TARGET_ACTIVATION_REQUIRED');
  }
  if (!['never', 'request_once'].includes(browserExecution.osFocus)) {
    throw new Error(
      `QA_ATTACH_ACTIVE_PAGE_OS_FOCUS_INVALID:${browserExecution.osFocus || 'missing'}`,
    );
  }
}

function readTrackingPollDiagnostics(result) {
  const source = result?.diagnostics;
  if (!source || typeof source !== 'object' || Array.isArray(source)) return null;
  if (TRACKING_DIAGNOSTIC_FIELDS.some((name) => (
    !Number.isSafeInteger(source[name]) || source[name] < 0
  ))) return null;
  if (!TRACKING_RESPONSE_STATES.includes(source.responseState)
    || (source.responseCode !== null && source.responseCode !== 'unclassified'
      && !TRACKING_RESPONSE_ERROR_CODES.includes(source.responseCode))) return null;
  return Object.freeze({
    ...Object.fromEntries(TRACKING_DIAGNOSTIC_FIELDS.map((name) => [name, source[name]])),
    responseState: source.responseState,
    responseCode: source.responseCode,
  });
}

function createTrackingPollFailure(code, stage, result) {
  const diagnostics = readTrackingPollDiagnostics(result);
  const failureKind = diagnostics !== null
    && Object.hasOwn(TRACKING_FAILURE_MESSAGES, result?.failureKind)
    ? result.failureKind
    : 'invalid_result';
  const diagnosticText = diagnostics === null
    ? 'diagnostics=unavailable'
    : [
      `attempts=${diagnostics.attemptCount}`,
      `callbacks=${diagnostics.callbackCount}`,
      `lateCallbacks=${diagnostics.lateCallbackCount}`,
      `probeTimeouts=${diagnostics.probeTimeoutCount}`,
      `runtimeErrors=${diagnostics.runtimeErrorCount}`,
      `dispatchErrors=${diagnostics.dispatchErrorCount}`,
      `mismatches=${diagnostics.mismatchCount}`,
      `nonAdmissions=${diagnostics.nonAdmissionResponseCount}`,
      `elapsedMs=${diagnostics.elapsedMs}`,
      `responseState=${diagnostics.responseState}`,
      `responseCode=${diagnostics.responseCode === null ? 'none' : diagnostics.responseCode}`,
    ].join(',');
  const causeCode = TRACKING_FAILURE_CAUSE_CODES[failureKind];
  const cause = new Error(causeCode);
  cause.code = causeCode;
  cause.stage = stage;
  const error = new Error(
    `${code}:${TRACKING_FAILURE_MESSAGES[failureKind]}:${diagnosticText}`
      + (result?.buildIdentityMismatch ? `:buildIdentity=${JSON.stringify(result.buildIdentityMismatch)}` : ''),
    { cause },
  );
  error.code = code;
  error.stage = stage;
  error.diagnostics = diagnostics;
  return error;
}

function createArtifactRuntimeIdentityFailure(result) {
  const failureKind = Object.hasOwn(
    ARTIFACT_RUNTIME_IDENTITY_FAILURE_MESSAGES,
    result?.failureKind,
  ) ? result.failureKind : 'invalid_result';
  const elapsedMs = Number.isSafeInteger(result?.elapsedMs) && result.elapsedMs >= 0
    ? result.elapsedMs
    : null;
  const causeCode = ARTIFACT_RUNTIME_IDENTITY_CAUSE_CODES[failureKind];
  const cause = new Error(causeCode);
  cause.code = causeCode;
  cause.stage = 'artifact_runtime_identity';
  const error = new Error(
    `QA_ATTACH_ARTIFACT_RUNTIME_IDENTITY_FAILED:`
      + `${ARTIFACT_RUNTIME_IDENTITY_FAILURE_MESSAGES[failureKind]}:`
      + `elapsedMs=${elapsedMs === null ? 'unavailable' : elapsedMs}`,
    { cause },
  );
  error.code = 'QA_ATTACH_ARTIFACT_RUNTIME_IDENTITY_FAILED';
  error.stage = 'artifact_runtime_identity';
  error.diagnostics = Object.freeze({ elapsedMs });
  return error;
}

export async function requireEntropyAttachedArtifactRuntimeIdentity(harness, {
  artifactIdentity,
  temporaryManifest,
  trustedPagePath,
  timeoutMs = POST_RELOAD_ARTIFACT_IDENTITY_TIMEOUT_MS,
  trustedPageDeadlineAtMs = null,
} = {}) {
  if (typeof harness?.evaluateInTrustedPage !== 'function') {
    throw new Error('QA_ATTACH_ARTIFACT_RUNTIME_IDENTITY_HARNESS_REQUIRED');
  }
  const expectedRequiredPermissions = requireCanonicalStringArray(
    temporaryManifest?.requiredPermissions,
    'QA_ATTACH_ARTIFACT_RUNTIME_REQUIRED_PERMISSIONS_INVALID',
  );
  const expectedRequiredHostPermissions = requireCanonicalStringArray(
    temporaryManifest?.requiredHostPermissions,
    'QA_ATTACH_ARTIFACT_RUNTIME_REQUIRED_HOST_PERMISSIONS_INVALID',
  );
  const expected = Object.freeze({
    buildId: artifactIdentity?.buildId,
    releaseProfile: artifactIdentity?.releaseProfile,
    trustedPagePath,
    requiredPermissions: expectedRequiredPermissions,
    requiredHostPermissions: expectedRequiredHostPermissions,
  });
  if (
    typeof expected.buildId !== 'string'
    || !expected.buildId
    || expected.buildId !== expected.buildId.trim()
    || typeof expected.releaseProfile !== 'string'
    || !/^[a-z][a-z0-9_-]*$/u.test(expected.releaseProfile)
    || typeof expected.trustedPagePath !== 'string'
    || !/^[a-z0-9][a-z0-9._/-]*$/iu.test(expected.trustedPagePath)
    || expected.trustedPagePath.startsWith('/')
    || expected.trustedPagePath.split('/').includes('..')
  ) {
    throw new Error('QA_ATTACH_ARTIFACT_RUNTIME_IDENTITY_CONTEXT_INVALID');
  }
  const boundedTimeoutMs = requirePositiveInteger(
    timeoutMs,
    'QA_ATTACH_ARTIFACT_RUNTIME_IDENTITY_TIMEOUT_INVALID',
  );
  if (
    trustedPageDeadlineAtMs !== null
    && (
      !Number.isSafeInteger(trustedPageDeadlineAtMs)
      || trustedPageDeadlineAtMs <= 0
    )
  ) {
    throw new Error('QA_ATTACH_ARTIFACT_RUNTIME_IDENTITY_DEADLINE_INVALID');
  }
  let result;
  try {
    result = await harness.evaluateInTrustedPage(`new Promise((resolve) => {
      const expected = ${JSON.stringify(expected)};
      const timeoutMs = ${JSON.stringify(boundedTimeoutMs)};
      const startedAt = Date.now();
      let completed = false;
      const finish = (payload) => {
        if (completed) return;
        completed = true;
        clearTimeout(timer);
        resolve({
          ...payload,
          elapsedMs: Math.max(0, Date.now() - startedAt),
        });
      };
      const timer = setTimeout(() => {
        finish({ identityVerified: false, failureKind: 'probe_timeout' });
      }, timeoutMs);
      Promise.resolve().then(async () => {
        const expectedTrustedPageUrl = chrome.runtime.getURL(expected.trustedPagePath);
        if (location.href !== expectedTrustedPageUrl) {
          finish({ identityVerified: false, failureKind: 'trusted_page_mismatch' });
          return;
        }
        const buildInfoResponse = await fetch(
          chrome.runtime.getURL('entropy-build-info.json'),
          { cache: 'no-store' },
        );
        if (buildInfoResponse?.ok !== true) {
          finish({ identityVerified: false, failureKind: 'fetch_failed' });
          return;
        }
        let buildInfo;
        try {
          buildInfo = await buildInfoResponse.json();
        } catch {
          finish({ identityVerified: false, failureKind: 'build_info_invalid' });
          return;
        }
        if (
          !buildInfo
          || typeof buildInfo !== 'object'
          || Array.isArray(buildInfo)
          || buildInfo.schemaVersion !== 1
        ) {
          finish({ identityVerified: false, failureKind: 'build_info_invalid' });
          return;
        }
        if (
          buildInfo.buildId !== expected.buildId
          || buildInfo.releaseProfile !== expected.releaseProfile
        ) {
          finish({ identityVerified: false, failureKind: 'build_identity_mismatch' });
          return;
        }
        const manifest = chrome.runtime.getManifest();
        if (
          !manifest
          || typeof manifest !== 'object'
          || Array.isArray(manifest)
          || manifest.manifest_version !== 3
          || (
            manifest.permissions !== undefined
            && !Array.isArray(manifest.permissions)
          )
          || (
            manifest.optional_permissions !== undefined
            && !Array.isArray(manifest.optional_permissions)
          )
          || (
            manifest.host_permissions !== undefined
            && !Array.isArray(manifest.host_permissions)
          )
          || (
            manifest.optional_host_permissions !== undefined
            && !Array.isArray(manifest.optional_host_permissions)
          )
        ) {
          finish({ identityVerified: false, failureKind: 'manifest_invalid' });
          return;
        }
        const requiredPermissions = Array.isArray(manifest.permissions)
          ? manifest.permissions
          : [];
        const optionalPermissions = Array.isArray(manifest.optional_permissions)
          ? manifest.optional_permissions
          : [];
        if (expected.requiredPermissions.some((permission) => (
          !requiredPermissions.includes(permission)
          || optionalPermissions.includes(permission)
        ))) {
          finish({ identityVerified: false, failureKind: 'permission_mismatch' });
          return;
        }
        const requiredHostPermissions = Array.isArray(manifest.host_permissions)
          ? manifest.host_permissions
          : [];
        const optionalHostPermissions = Array.isArray(manifest.optional_host_permissions)
          ? manifest.optional_host_permissions
          : [];
        if (expected.requiredHostPermissions.some((permission) => (
          !requiredHostPermissions.includes(permission)
          || optionalHostPermissions.includes(permission)
        ))) {
          finish({ identityVerified: false, failureKind: 'host_permission_mismatch' });
          return;
        }
        finish({
          identityVerified: true,
          failureKind: null,
          buildId: buildInfo.buildId,
          releaseProfile: buildInfo.releaseProfile,
          trustedPagePath: expected.trustedPagePath,
          requiredPermissions: expected.requiredPermissions,
          requiredHostPermissions: expected.requiredHostPermissions,
        });
      }).catch(() => {
        finish({ identityVerified: false, failureKind: 'probe_error' });
      });
    })`, {
      timeoutMs: boundedTimeoutMs + 1_000,
      trustedPageDeadlineAtMs,
    });
  } catch (error) {
    const wrapped = new Error(
      `QA_ATTACH_ARTIFACT_RUNTIME_IDENTITY_TRANSPORT_FAILED:${error?.message || error}`,
      { cause: error },
    );
    wrapped.code = 'QA_ATTACH_ARTIFACT_RUNTIME_IDENTITY_TRANSPORT_FAILED';
    wrapped.stage = 'artifact_runtime_identity';
    throw wrapped;
  }
  if (
    result?.identityVerified !== true
    || result?.failureKind !== null
    || result?.buildId !== expected.buildId
    || result?.releaseProfile !== expected.releaseProfile
    || result?.trustedPagePath !== expected.trustedPagePath
    || JSON.stringify(result?.requiredPermissions)
      !== JSON.stringify(expected.requiredPermissions)
    || JSON.stringify(result?.requiredHostPermissions)
      !== JSON.stringify(expected.requiredHostPermissions)
    || !Number.isSafeInteger(result?.elapsedMs)
    || result.elapsedMs < 0
  ) {
    throw createArtifactRuntimeIdentityFailure(result);
  }
  return Object.freeze({
    status: 'artifact_runtime_identity_verified',
    buildId: expected.buildId,
    releaseProfile: expected.releaseProfile,
    trustedPagePath: expected.trustedPagePath,
    requiredPermissions: expected.requiredPermissions,
    requiredHostPermissions: expected.requiredHostPermissions,
  });
}

async function runEntropyTrackingRuntimePoll(harness, {
  mode,
  targetTabId = null,
  timeoutMs,
  pollIntervalMs,
  probeTimeoutMs,
  transportCode,
  stage,
  trustedPageDeadlineAtMs = null,
  expectedBuild = null,
}) {
  if (!Object.values(TRACKING_POLL_MODES).includes(mode)) {
    throw new Error(`QA_ATTACH_TRACKING_POLL_MODE_INVALID:${mode}`);
  }
  if (typeof harness?.evaluateInTrustedPage !== 'function') {
    throw new Error('QA_ATTACH_TRACKING_HARNESS_REQUIRED');
  }
  const boundedTimeoutMs = requirePositiveInteger(
    timeoutMs,
    'QA_ATTACH_TRACKING_TIMEOUT_INVALID',
  );
  const boundedPollIntervalMs = requirePositiveInteger(
    pollIntervalMs,
    'QA_ATTACH_TRACKING_POLL_INTERVAL_INVALID',
  );
  const boundedProbeTimeoutMs = Math.min(
    requirePositiveInteger(
      probeTimeoutMs,
      'QA_ATTACH_TRACKING_PROBE_TIMEOUT_INVALID',
    ),
    boundedTimeoutMs,
  );
  if (
    trustedPageDeadlineAtMs !== null
    && (
      !Number.isSafeInteger(trustedPageDeadlineAtMs)
      || trustedPageDeadlineAtMs <= 0
    )
  ) {
    throw new Error('QA_ATTACH_TRACKING_TRUSTED_PAGE_DEADLINE_INVALID');
  }
  let result;
  try {
    result = await harness.evaluateInTrustedPage(`new Promise((resolve) => {
      const mode = ${JSON.stringify(mode)};
      const expectedBuild = ${JSON.stringify(expectedBuild)};
      const targetTabId = ${JSON.stringify(targetTabId)};
      const timeoutMs = ${JSON.stringify(boundedTimeoutMs)};
      const pollIntervalMs = ${JSON.stringify(boundedPollIntervalMs)};
      const probeTimeoutMs = ${JSON.stringify(boundedProbeTimeoutMs)};
      const classifyResponse = ${classifyTrackingResponse.toString()};
      const responseErrorCodes = ${JSON.stringify(TRACKING_RESPONSE_ERROR_CODES)};
      const startedAt = Date.now();
      const deadlineAt = startedAt + timeoutMs;
      let completed = false;
      let failureKind = mode === '${TRACKING_POLL_MODES.RUNTIME_READINESS}'
        ? 'runtime_not_ready'
        : 'target_not_admitted';
      let lastActiveTabId = null;
      let focusedWindowId = null;
      let attemptCount = 0;
      let callbackCount = 0;
      let lateCallbackCount = 0;
      let probeTimeoutCount = 0;
      let runtimeErrorCount = 0;
      let dispatchErrorCount = 0;
      let mismatchCount = 0;
      let nonAdmissionResponseCount = 0;
      let buildIdentityMismatch = null;
      let responseState = 'not_received';
      let responseCode = null;

      const diagnostics = () => ({
        attemptCount,
        callbackCount,
        lateCallbackCount,
        probeTimeoutCount,
        runtimeErrorCount,
        dispatchErrorCount,
        mismatchCount,
        nonAdmissionResponseCount,
        elapsedMs: Math.max(0, Date.now() - startedAt),
        responseState,
        responseCode,
      });

      const resolveFailure = () => {
        if (completed) return;
        completed = true;
        resolve({
          failureKind,
          buildIdentityMismatch,
          runtimeReady: false,
          trackingObserved: false,
          targetTabId,
          lastActiveTabId,
          focusedWindowId,
          diagnostics: diagnostics(),
        });
      };

      const scheduleNextProbe = () => {
        const remainingMs = deadlineAt - Date.now();
        if (remainingMs <= 0) {
          resolveFailure();
          return;
        }
        setTimeout(probe, Math.min(pollIntervalMs, remainingMs));
      };

      const finishProbe = ({ response, runtimeError }) => {
        if (completed) return;
        ({ responseState, responseCode } = classifyResponse(response, responseErrorCodes));
        const runtime = response?.runtime;
        const runtimeSnapshotReady = response?.success === true
          && runtime
          && typeof runtime === 'object'
          && !Array.isArray(runtime);
        if (runtimeSnapshotReady && expectedBuild !== null
          && (response.buildInfo?.buildId !== expectedBuild.buildId
            || response.buildInfo?.releaseProfile !== expectedBuild.releaseProfile)) {
          failureKind = 'build_identity_mismatch';
          const responseOwnKeys = Object.keys(response);
          const identityFieldType = (value) => value === null ? 'null'
            : Array.isArray(value) ? 'array' : typeof value;
          buildIdentityMismatch = {
            expected: { buildId: expectedBuild.buildId, releaseProfile: expectedBuild.releaseProfile },
            observed: { buildId: typeof response.buildInfo?.buildId === 'string' ? response.buildInfo.buildId.slice(0,200) : null,
              releaseProfile: typeof response.buildInfo?.releaseProfile === 'string' ? response.buildInfo.releaseProfile.slice(0,32) : null },
            responseShape: {
              ownKeys: responseOwnKeys.slice(0,16).map((key) => key.slice(0,64)),
              ownKeyCount: responseOwnKeys.length,
              buildInfoOwn: Object.hasOwn(response, 'buildInfo'),
              buildInfoType: identityFieldType(response.buildInfo),
              buildIdType: identityFieldType(response.buildInfo?.buildId),
              releaseProfileType: identityFieldType(response.buildInfo?.releaseProfile),
            },
          };
          resolveFailure();
          return;
        }
        const observedTabId = runtime?.lastActiveTabId;
        const observedWindowId = runtime?.focusedWindowId;
        lastActiveTabId = Number.isInteger(observedTabId) ? observedTabId : null;
        focusedWindowId = Number.isInteger(observedWindowId) ? observedWindowId : null;
        const accepted = mode === '${TRACKING_POLL_MODES.RUNTIME_READINESS}'
          ? runtimeSnapshotReady
          : runtimeSnapshotReady && observedTabId === targetTabId;
        if (accepted) {
          completed = true;
          resolve({
            failureKind: null,
            runtimeReady: true,
            trackingObserved: mode === '${TRACKING_POLL_MODES.EXACT_TARGET}',
            targetTabId,
            lastActiveTabId,
            focusedWindowId,
            diagnostics: diagnostics(),
          });
          return;
        }
        if (runtimeError) {
          runtimeErrorCount += 1;
          failureKind = 'runtime_error';
        } else if (!runtimeSnapshotReady) {
          nonAdmissionResponseCount += 1;
          failureKind = 'runtime_not_ready';
          if (mode === '${TRACKING_POLL_MODES.RUNTIME_READINESS}') {
            resolveFailure();
            return;
          }
        } else {
          mismatchCount += 1;
          failureKind = 'target_not_admitted';
        }
        scheduleNextProbe();
      };

      const probe = () => {
        if (completed) return;
        const remainingMs = deadlineAt - Date.now();
        if (remainingMs <= 0) {
          resolveFailure();
          return;
        }
        attemptCount += 1;
        let probeSettled = false;
        const probeTimer = setTimeout(() => {
          if (probeSettled || completed) return;
          probeSettled = true;
          probeTimeoutCount += 1;
          failureKind = 'probe_timeout';
          scheduleNextProbe();
        }, Math.min(probeTimeoutMs, remainingMs));
        try {
          chrome.runtime.sendMessage({ action: '${TRACKING_RUNTIME_ACTION}' }, (response) => {
            const runtimeError = chrome.runtime.lastError?.message || null;
            callbackCount += 1;
            if (probeSettled || completed) {
              lateCallbackCount += 1;
              return;
            }
            probeSettled = true;
            clearTimeout(probeTimer);
            finishProbe({ response, runtimeError });
          });
        } catch {
          if (probeSettled || completed) return;
          probeSettled = true;
          clearTimeout(probeTimer);
          dispatchErrorCount += 1;
          failureKind = 'dispatch_error';
          scheduleNextProbe();
        }
      };
      probe();
    })`, {
      timeoutMs: boundedTimeoutMs + 1_000,
      ...(trustedPageDeadlineAtMs === null ? {} : { trustedPageDeadlineAtMs }),
    });
  } catch (error) {
    const wrapped = new Error(
      `${transportCode}:${error?.message || error}`,
      { cause: error },
    );
    wrapped.code = transportCode;
    wrapped.stage = stage;
    throw wrapped;
  }
  return result;
}

export async function requireEntropyTrackingRuntimeReadiness(harness, {
  timeoutMs = POST_RELOAD_TRACKING_READINESS_TIMEOUT_MS,
  pollIntervalMs = POST_RELOAD_TRACKING_READINESS_POLL_INTERVAL_MS,
  probeTimeoutMs = POST_RELOAD_TRACKING_READINESS_PROBE_TIMEOUT_MS,
  trustedPageDeadlineAtMs = null,
  expectedBuild = null,
} = {}) {
  const result = await runEntropyTrackingRuntimePoll(harness, {
    mode: TRACKING_POLL_MODES.RUNTIME_READINESS,
    timeoutMs,
    pollIntervalMs,
    probeTimeoutMs,
    transportCode: 'QA_ATTACH_TRACKING_RUNTIME_READINESS_TRANSPORT_FAILED',
    stage: 'tracking_runtime_readiness',
    trustedPageDeadlineAtMs,
    expectedBuild,
  });
  const diagnostics = readTrackingPollDiagnostics(result);
  if (result?.runtimeReady !== true || diagnostics === null) {
    throw createTrackingPollFailure(
      'QA_ATTACH_TRACKING_RUNTIME_READINESS_FAILED',
      'tracking_runtime_readiness',
      result,
    );
  }
  return Object.freeze({
    runtimeReady: true,
    evidenceRole: 'runtime_readiness_only',
    diagnostics,
  });
}

// Read-only admission for the explicitly confirmed maintenance target. This
// served-artifact/recovery proof makes no claim that normal runtime is ready.
export async function requireEntropyProfileResetMaintenanceEligibility({
  targetId,
  harness,
  stageAction,
  activationAction,
  contentIdentityDigest,
  browserEpoch,
  extensionId,
  artifactIdentity,
  temporaryManifest,
  trustedPagePath,
  runtimeRefresh,
  reloadIssued,
} = {}) {
  if (targetId !== 'maintenance/profile-reset'
    || harness?.attachOnly !== true
    || harness.extensionId !== extensionId
    || !['reused_exact_slot', 'staged_changed'].includes(stageAction)
    || !['loaded_exact_slot', 'reloaded_exact_slot', 'reused_active_runtime'].includes(activationAction)
    || typeof contentIdentityDigest !== 'string' || !/^[a-f0-9]{64}$/u.test(contentIdentityDigest)
    || typeof browserEpoch !== 'string' || !browserEpoch
    || typeof extensionId !== 'string' || !extensionId
    || !artifactIdentity || typeof artifactIdentity !== 'object' || Array.isArray(artifactIdentity)
    || typeof artifactIdentity.artifactId !== 'string' || !/^[a-z][a-z0-9_]*$/u.test(artifactIdentity.artifactId)
    || typeof artifactIdentity.inputDigest !== 'string' || !/^[a-f0-9]{64}$/u.test(artifactIdentity.inputDigest)
    || !temporaryManifest || typeof temporaryManifest !== 'object' || Array.isArray(temporaryManifest)
    || runtimeRefresh !== (activationAction !== 'reused_active_runtime')
    || typeof reloadIssued !== 'boolean' || (reloadIssued === true) !== (activationAction === 'reloaded_exact_slot')) {
    throw new Error('QA_PROFILE_RESET_MAINTENANCE_CONTEXT_INVALID');
  }
  const trustedPageDeadlineAtMs = Date.now() + POST_RELOAD_TRACKING_READINESS_TIMEOUT_MS;
  const artifactRuntimeIdentity = await requireEntropyAttachedArtifactRuntimeIdentity(harness, {
    artifactIdentity, temporaryManifest, trustedPagePath, trustedPageDeadlineAtMs,
  });
  const profileReadiness = await observeProfileGenerationReadiness(harness, trustedPageDeadlineAtMs);
  const recovery = profileReadiness.recovery;
  if (profileReadiness.status !== 'rejected'
    || profileReadiness.code !== 'SETTINGS_STORED_VALUE_INVALID'
    || profileReadiness.generationMatch !== true
    || recovery?.contract !== 'settings_profile_recovery_v1'
    || recovery.kind !== 'settings_contract_reset'
    || recovery.failureCode !== 'SETTINGS_STORED_VALUE_INVALID'
    || recovery.recoveryAction !== 'full_reset'
    || recovery.documentKey !== 'settings.core'
    || recovery.key !== 'nudgeConfig') {
    const error = new Error('QA_PROFILE_RESET_MAINTENANCE_ELIGIBILITY_REJECTED');
    error.code = 'QA_PROFILE_RESET_MAINTENANCE_ELIGIBILITY_REJECTED';
    error.eligibilityDiagnostic = Object.freeze(profileReadiness);
    error.message += `:eligibility=${JSON.stringify(profileReadiness)}`;
    throw error;
  }
  return Object.freeze({ status: 'profile_reset_eligible', artifactRuntimeIdentity,
    generationMatch: true, recovery });
}

export async function proveEntropyAttachedArtifactRuntimeReadiness({
  harness,
  stageAction,
  activationAction,
  contentIdentityDigest,
  browserEpoch,
  extensionId,
  artifactIdentity,
  temporaryManifest,
  trustedPagePath,
  runtimeRefresh,
  reloadIssued,
} = {}) {
  if (
    !harness
    || !['reused_exact_slot', 'staged_changed'].includes(stageAction)
    || !['loaded_exact_slot', 'reloaded_exact_slot', 'reused_active_runtime'].includes(activationAction)
    || typeof contentIdentityDigest !== 'string'
    || !/^[a-f0-9]{64}$/u.test(contentIdentityDigest)
    || typeof browserEpoch !== 'string'
    || !browserEpoch
    || typeof extensionId !== 'string'
    || !extensionId
    || !artifactIdentity
    || typeof artifactIdentity !== 'object'
    || Array.isArray(artifactIdentity)
    || typeof artifactIdentity.artifactId !== 'string'
    || !/^[a-z][a-z0-9_]*$/u.test(artifactIdentity.artifactId)
    || typeof artifactIdentity.inputDigest !== 'string'
    || !/^[a-f0-9]{64}$/u.test(artifactIdentity.inputDigest)
    || typeof temporaryManifest !== 'object'
    || temporaryManifest === null
    || Array.isArray(temporaryManifest)
    || runtimeRefresh !== (activationAction !== 'reused_active_runtime')
    || typeof reloadIssued !== 'boolean'
    || (reloadIssued === true) !== (activationAction === 'reloaded_exact_slot')
  ) {
    throw new Error('QA_ATTACH_TRACKING_RUNTIME_READINESS_CONTEXT_INVALID');
  }
  const coldDeadlineAtMs = Date.now() + POST_RELOAD_TRACKING_READINESS_TIMEOUT_MS;
  const artifactRuntimeIdentity = await requireEntropyAttachedArtifactRuntimeIdentity(
    harness,
    {
      artifactIdentity,
      temporaryManifest,
      trustedPagePath,
      trustedPageDeadlineAtMs: coldDeadlineAtMs,
    },
  );
  const remainingReadinessMs = coldDeadlineAtMs
    - Date.now()
    - POST_RELOAD_RESULT_DELIVERY_GRACE_MS;
  if (remainingReadinessMs <= 0) {
    const error = new Error('QA_ATTACH_TRACKING_RUNTIME_READINESS_DEADLINE_EXHAUSTED');
    error.code = 'QA_ATTACH_TRACKING_RUNTIME_READINESS_DEADLINE_EXHAUSTED';
    error.stage = 'tracking_runtime_readiness';
    throw error;
  }
  let readiness;
  try {
    readiness = await requireEntropyTrackingRuntimeReadiness(harness, {
      timeoutMs: remainingReadinessMs,
      trustedPageDeadlineAtMs: coldDeadlineAtMs,
      expectedBuild: artifactIdentity,
    });
  } catch (error) {
    const earlyReadiness = await observeEarlySettingsReadiness(harness, coldDeadlineAtMs);
    error.earlyReadinessDiagnostic = Object.freeze(earlyReadiness);
    error.message += `:earlyReadiness=${JSON.stringify(earlyReadiness)}`;
    if (earlyReadiness.status === 'rejected') {
      const profileReadiness = await observeProfileGenerationReadiness(harness, coldDeadlineAtMs);
      error.profileReadinessDiagnostic = Object.freeze(profileReadiness);
      error.message += `:profileReadiness=${JSON.stringify(profileReadiness)}`;
    }
    throw error;
  }
  return Object.freeze({
    status: 'attached_artifact_runtime_ready',
    contentIdentityDigest,
    runtimeReady: true,
    artifactRuntimeIdentity,
    evidenceRole: readiness.evidenceRole,
    diagnostics: readiness.diagnostics,
  });
}

export function readEntropyPostRefreshTrackingRuntimeReadiness(harness) {
  const artifactSync = harness?.attachedArtifactSyncReceipt;
  if (artifactSync === null || artifactSync === undefined) return null;
  const activationAction = artifactSync?.activationAction;
  const runtimeRefresh = artifactSync?.runtimeRefresh;
  const reloadIssued = artifactSync?.reloadIssued;
  const runtimeReadiness = artifactSync?.runtimeReadiness;
  const runtimeArtifactIdentity = runtimeReadiness?.artifactRuntimeIdentity;
  const runtimeReadinessDiagnostics = readTrackingPollDiagnostics(runtimeReadiness);
  const runtimeArtifactIdentityValid = runtimeArtifactIdentity?.status === 'artifact_runtime_identity_verified'
    && typeof runtimeArtifactIdentity.buildId === 'string'
    && runtimeArtifactIdentity.buildId === runtimeArtifactIdentity.buildId.trim()
    && runtimeArtifactIdentity.buildId.length > 0
    && typeof runtimeArtifactIdentity.releaseProfile === 'string'
    && /^[a-z][a-z0-9_-]*$/u.test(runtimeArtifactIdentity.releaseProfile)
    && typeof runtimeArtifactIdentity.trustedPagePath === 'string'
    && /^[a-z0-9][a-z0-9._/-]*$/iu.test(runtimeArtifactIdentity.trustedPagePath)
    && !runtimeArtifactIdentity.trustedPagePath.startsWith('/')
    && !runtimeArtifactIdentity.trustedPagePath.split('/').includes('..')
    && isCanonicalStringArray(runtimeArtifactIdentity.requiredPermissions)
    && isCanonicalStringArray(runtimeArtifactIdentity.requiredHostPermissions);
  const activationMatchesRefresh = runtimeRefresh === true
    ? ['loaded_exact_slot', 'reloaded_exact_slot'].includes(activationAction)
    : activationAction === 'reused_active_runtime';
  const readinessMatchesRefresh = runtimeReadiness?.status === 'attached_artifact_runtime_ready'
      && runtimeReadiness?.contentIdentityDigest === artifactSync.contentIdentityDigest
      && runtimeReadiness?.runtimeReady === true
      && runtimeReadiness?.evidenceRole === 'runtime_readiness_only'
      && runtimeReadinessDiagnostics !== null
      && runtimeArtifactIdentityValid;
  if (
    artifactSync?.status !== 'managed_artifact_runtime_ready'
    || artifactSync?.runtimeReadyProved !== true
    || typeof runtimeRefresh !== 'boolean'
    || typeof reloadIssued !== 'boolean'
    || !activationMatchesRefresh
    || !readinessMatchesRefresh
    || (reloadIssued === true) !== (activationAction === 'reloaded_exact_slot')
  ) {
    throw new Error('QA_ATTACH_TRACKING_ARTIFACT_SYNC_RECEIPT_INVALID');
  }
  return Object.freeze({
    required: runtimeRefresh,
    evidenceRole: 'runtime_readiness_only',
    activationAction,
    reloadIssued,
    runtimeReady: true,
    proof: 'trusted_page_canonical_router',
    artifactRuntimeIdentity: Object.freeze({ ...runtimeArtifactIdentity }),
    diagnostics: runtimeReadinessDiagnostics,
  });
}

export async function requireEntropyTrackingAdmission(harness, page, {
  timeoutMs = DEFAULT_TRACKING_TIMEOUT_MS,
  pollIntervalMs = DEFAULT_TRACKING_POLL_INTERVAL_MS,
  probeTimeoutMs = DEFAULT_TRACKING_PROBE_TIMEOUT_MS,
} = {}) {
  const targetTabId = page?.tabId;
  if (!Number.isInteger(targetTabId)) {
    throw new Error('QA_ATTACH_TRACKING_TARGET_TAB_REQUIRED');
  }
  const result = await runEntropyTrackingRuntimePoll(harness, {
    mode: TRACKING_POLL_MODES.EXACT_TARGET,
    targetTabId,
    timeoutMs,
    pollIntervalMs,
    probeTimeoutMs,
    transportCode: 'QA_ATTACH_TRACKING_ADMISSION_TRANSPORT_FAILED',
    stage: 'tracking_target_admission',
  });
  const diagnostics = readTrackingPollDiagnostics(result);
  if (
    result?.trackingObserved !== true
    || result?.targetTabId !== targetTabId
    || result?.lastActiveTabId !== targetTabId
    || diagnostics === null
  ) {
    throw createTrackingPollFailure(
      'QA_ATTACH_TRACKING_ADMISSION_FAILED',
      'tracking_target_admission',
      result,
    );
  }
  return Object.freeze({
    trackingObserved: true,
    targetTabId,
    lastActiveTabId: targetTabId,
    focusedWindowId: Number.isInteger(result.focusedWindowId)
      ? result.focusedWindowId
      : null,
    diagnostics,
  });
}

export async function openEntropyAttachOnlyActivePage({
  harness,
  url,
  browserExecution,
  pageTimeoutMs = 45_000,
  trackingTimeoutMs = DEFAULT_TRACKING_TIMEOUT_MS,
  trackingAdmission = requireEntropyTrackingAdmission,
  targetWindowReader = readQaCdpPageTargetWindow,
  observation = 'emulated',
} = {}) {
  requireAttachActiveExecution(browserExecution);
  if (harness?.attachOnly !== true) {
    throw new Error('QA_ATTACH_ACTIVE_PAGE_HARNESS_REQUIRED');
  }
  if (typeof url !== 'string' || !url.trim()) {
    throw new Error('QA_ATTACH_ACTIVE_PAGE_URL_REQUIRED');
  }
  if (typeof trackingAdmission !== 'function') {
    throw new Error('QA_ATTACH_TRACKING_ADMISSION_OWNER_REQUIRED');
  }
  if (typeof targetWindowReader !== 'function') {
    throw new Error('QA_ATTACH_TARGET_WINDOW_READER_REQUIRED');
  }
  if (!['emulated', 'document', 'animation', 'foreground'].includes(observation)) throw new Error('QA_ATTACH_OBSERVATION_INVALID');
  const page = await harness.openPage(url, {
    active: false,
    timeoutMs: requirePositiveInteger(
      pageTimeoutMs,
      'QA_ATTACH_ACTIVE_PAGE_TIMEOUT_INVALID',
    ),
  });
  const noFocusExecution = observation === 'emulated' ? await harness.enableNoFocusPageExecution(page) : null;
  if (
    observation === 'emulated' && (noFocusExecution?.visibilityState !== 'visible'
    || noFocusExecution?.hasFocus !== true
    || noFocusExecution?.windowFocusRequested !== false)
  ) {
    throw new Error('QA_ATTACH_ACTIVE_PAGE_VISIBILITY_ADMISSION_INVALID');
  }
  const targetTab = await harness.activateOwnedPageWithoutWindowFocus(page);
  if (
    targetTab?.id !== page.tabId
    || targetTab?.active !== true
    || targetTab?.windowFocusRequested !== false
  ) {
    throw new Error('QA_ATTACH_ACTIVE_PAGE_TAB_ACTIVATION_INVALID');
  }
  const tracking = ['document', 'animation'].includes(observation) ? null : await trackingAdmission(harness, page, {
    timeoutMs: trackingTimeoutMs,
  });
  const targetWindow = await targetWindowReader(harness.cdp, page.targetId);
  if (
    targetWindow?.status !== 'target_window_verified'
    || targetWindow.targetId !== page.targetId
    || !Number.isSafeInteger(targetWindow.windowId)
    || targetWindow.windowId <= 0
    || targetWindow.windowId !== targetTab.windowId
  ) {
    throw new Error('QA_ATTACH_ACTIVE_PAGE_TARGET_WINDOW_INVALID');
  }
  const receipt = Object.freeze({
    creationActive: false,
    documentVisibility: noFocusExecution?.visibilityState ?? null,
    documentHasFocus: noFocusExecution?.hasFocus ?? null,
    documentEvidence: observation === 'emulated' ? 'emulated' : 'native_probe_required',
    targetTabActive: targetTab.active,
    trackingObserved: tracking === null ? false : tracking.trackingObserved,
    targetTabId: targetTab.id,
    lastActiveTabId: tracking === null ? null : tracking.lastActiveTabId,
    focusedWindowId: tracking === null ? null : tracking.focusedWindowId,
    trackingDiagnostics: tracking === null ? null : tracking.diagnostics,
    trackingEvidence: tracking === null ? `not_required_for_${observation}` : 'exact_target_admission',
    targetWindow,
    windowFocusRequested: false,
  });
  return Object.freeze({ page, targetTab, receipt });
}

// Read-only capability probe. A visible document and an active tab do not prove
// native window focus or animation-frame delivery. Never repair either here.
export async function observeEntropyAttachedPageExecution(harness, page) {
  if (!Number.isInteger(page?.tabId) || !page.sessionId) throw new Error('QA_ATTACH_OBSERVATION_PAGE_REQUIRED');
  const nativeState = await harness.evaluateInTrustedPage(`(async () => {
    const tab = await chrome.tabs.get(${page.tabId});
    const window = await chrome.windows.get(tab.windowId);
    const tracking = await chrome.runtime.sendMessage({ action: '${TRACKING_RUNTIME_ACTION}' });
    return { tabId: tab.id, tabActive: tab.active, windowId: window.id,
      windowFocused: window.focused, windowState: window.state,
      tracking: { success: tracking.success, runtime: tracking.success === true
        ? { lastActiveTabId: tracking.runtime.lastActiveTabId,
          focusedWindowId: tracking.runtime.focusedWindowId } : null } };
  })()`);
  const response = await harness.cdp.send('Runtime.evaluate', {
    expression: `new Promise((resolve) => {
      const start = performance.now(); let frames = 0, frame;
      const tick = () => { frames += 1; frame = requestAnimationFrame(tick); };
      frame = requestAnimationFrame(tick);
      setTimeout(() => { cancelAnimationFrame(frame); resolve({ frames,
        elapsedMs: performance.now() - start, visibilityState: document.visibilityState,
        hasFocus: document.hasFocus() }); }, 1200);
    })`, awaitPromise: true, returnByValue: true,
  }, page.sessionId, { timeoutMs: 5000 });
  if (response.exceptionDetails) throw new Error('QA_ATTACH_FRAME_PROBE_EXCEPTION');
  return Object.freeze({ ...nativeState, ...response.result?.value });
}

export function classifyEntropyAttachedPageExecution(value, observation) {
  if (!['document', 'animation', 'foreground'].includes(observation)) throw new Error('QA_ATTACH_OBSERVATION_INVALID');
  if (!Number.isInteger(value?.frames) || value.frames < 0
    || !Number.isFinite(value.elapsedMs) || value.elapsedMs < 1000
    || typeof value.windowFocused !== 'boolean' || typeof value.tabActive !== 'boolean'
    || !Number.isInteger(value.tabId) || !Number.isInteger(value.windowId)
    || !['normal', 'minimized', 'maximized', 'fullscreen'].includes(value.windowState)
    || !['visible', 'hidden'].includes(value.visibilityState) || typeof value.hasFocus !== 'boolean') {
    throw new Error('QA_ATTACH_EXECUTION_OBSERVATION_INVALID');
  }
  if (value.windowState === 'minimized') return 'native_window_unavailable';
  if (!value.tabActive || value.visibilityState !== 'visible') return 'native_document_unavailable';
  if (observation === 'foreground') {
    if (value.tracking?.success !== true || !value.tracking.runtime) throw new Error('QA_ATTACH_EXECUTION_OBSERVATION_INVALID');
    if (!value.windowFocused) return 'native_window_unavailable';
    if (!value.hasFocus) return 'native_document_unavailable';
    if (value.tracking.runtime.lastActiveTabId !== value.tabId
      || value.tracking.runtime.focusedWindowId !== value.windowId) return 'tracking_source_unavailable';
  }
  if (observation !== 'document' && value.frames * 1000 / value.elapsedMs < 10) return 'animation_frames_unavailable';
  return 'ready';
}

export async function requireEntropyAttachedPageExecution(harness, page, observation) {
  const value = await observeEntropyAttachedPageExecution(harness, page);
  const status = classifyEntropyAttachedPageExecution(value, observation);
  if (status !== 'ready') {
    const error = new Error(`QA_ATTACH_EXECUTION_UNAVAILABLE:${status}`);
    error.code = 'QA_ATTACH_EXECUTION_UNAVAILABLE';
    error.stage = 'document_execution';
    error.diagnostics = { observation, status, ...value };
    throw error;
  }
  return Object.freeze({ status, ...value });
}
