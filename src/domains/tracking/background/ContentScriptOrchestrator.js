import { requireSettingsPropagationContext, settingsPropagationDiagnostic, throwIfSettingsPropagationCancelled } from '../../settings/contracts/settingsPropagationContext.js';
import {
  permissionsContains,
  scriptingExecuteScript,
  scriptingExecuteScriptWithResults,
  tabsQuery,
  tabsSendMessage,
} from '../../../platform/chrome/ChromeService.js';
import {
  createVideoSkipMainWorldCommandRequest,
  executeVideoSkipYouTubeCommandInMainWorld,
  requireVideoSkipMainWorldActuatorResult,
} from '../../nudge/video-skip/videoSkipMainWorldActuator.js';
import { MESSAGE_TYPES } from '../../../platform/messaging/messageTypes.js';
import {
  CONTENT_RECEIVER_CAPABILITY_VERSION,
  createContentReceiverCapability,
} from '../../../platform/messaging/contentReceiverCapability.js';
import {
  resolveSenderDocumentId,
  resolveSenderFrameId,
  resolveSenderPageUrl,
  resolveTrustedSenderTabId,
} from '../../../platform/security/senderTrust.js';
import {
  getHostname,
  isHostnameInList,
} from '../../../lib/index.js';
import { ENTROPY_RUNTIME_BUILD_INFO } from '../../../platform/build/runtimeBuildInfo.js';
import { normalizeManagedContentScriptFiles } from './contentScriptPath.js';
import {
  DEFAULT_CATCH_UP_CONCURRENCY,
  assertContentRuntimeDiagnostics,
  createCatchUpReadinessFailureError,
  createInitialSyncSnapshot,
  createInjectionSummary,
  normalizeCatchUpConcurrency,
  normalizeCatchUpTargets,
  normalizeDiagnosticsTabId,
  normalizeReason,
  normalizeSyncSnapshot,
  requireInjectionSummary,
} from './contentScriptOrchestratorState.js';

// The content bundle import sits on the critical path to `receiver_ready`, so this budget
// has to cover a page that is alive but busy -- media-heavy documents routinely push the
// import past a warm-path second. `ensureContentScriptReady` spends this twice (once, then
// once more after a re-injection), so the worst case for a genuinely dead receiver is 2x.
const CONTENT_SCRIPT_READY_TIMEOUT_MS = 3000;

async function mapWithConcurrency(items, limit, worker) {
  const queue = Array.isArray(items) ? items : [];
  if (queue.length === 0) return [];

  const workerCount = Math.min(
    queue.length,
    normalizeCatchUpConcurrency(limit),
  );
  const results = new Array(queue.length);
  let nextIndex = 0;

  async function runWorker() {
    while (true) {
      const currentIndex = nextIndex;
      nextIndex += 1;
      if (currentIndex >= queue.length) return;
      results[currentIndex] = await worker(queue[currentIndex], currentIndex);
    }
  }

  await Promise.all(
    Array.from({ length: workerCount }, () => runWorker()),
  );

  return results;
}

function createContentInjectionResultError(code, fieldName = '') {
  const message = fieldName ? `${code}:${fieldName}` : code;
  const error = new Error(message);
  error.code = code;
  if (fieldName) {
    error.field = fieldName;
  }
  return error;
}

function requirePositiveTimeoutMs(value, errorCode) {
  const normalized = Number(value);
  if (!Number.isFinite(normalized) || normalized <= 0) {
    throw createContentInjectionResultError(errorCode, 'timeoutMs');
  }
  return Math.floor(normalized);
}

function requireCatchUpPlanDiagnostic(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw createContentInjectionResultError('CONTENT_SCRIPT_CATCH_UP_PLAN_DIAGNOSTIC_INVALID', 'plan');
  }
  if (typeof value.reason !== 'string' || !value.reason.trim()) {
    throw createContentInjectionResultError('CONTENT_SCRIPT_CATCH_UP_PLAN_DIAGNOSTIC_INVALID', 'reason');
  }
  if (typeof value.injectOpenTabs !== 'boolean') {
    throw createContentInjectionResultError('CONTENT_SCRIPT_CATCH_UP_PLAN_DIAGNOSTIC_INVALID', 'injectOpenTabs');
  }
  const counts = {};
  for (const field of [
    'registeredDomainCount',
    'catchUpDomainCount',
    'queriedTabCount',
    'webTabCount',
    'targetCount',
  ]) {
    if (!Number.isInteger(value[field]) || value[field] < 0) {
      throw createContentInjectionResultError('CONTENT_SCRIPT_CATCH_UP_PLAN_DIAGNOSTIC_INVALID', field);
    }
    counts[field] = value[field];
  }
  return {
    reason: value.reason.trim(),
    injectOpenTabs: value.injectOpenTabs,
    ...counts,
  };
}

function normalizeScriptingExecuteErrorResult(result, errorCode) {
  if (result === null) {
    return null;
  }
  if (typeof result === 'string' && result.trim()) {
    return result.trim();
  }
  throw createContentInjectionResultError(errorCode, 'executeScript');
}

function requireInjectionAttemptResult(result, errorCode) {
  if (!result || typeof result !== 'object' || Array.isArray(result)) {
    throw createContentInjectionResultError(errorCode, 'result');
  }
  if (typeof result.ok !== 'boolean') {
    throw createContentInjectionResultError(errorCode, 'ok');
  }
  if (result.ok === true) {
    if (result.error !== null) {
      throw createContentInjectionResultError(errorCode, 'error');
    }
    if (
      typeof result.bootstrapInjectionReason !== 'string'
      || !result.bootstrapInjectionReason
      || result.bootstrapInjectionReason !== result.bootstrapInjectionReason.trim()
    ) {
      throw createContentInjectionResultError(errorCode, 'bootstrapInjectionReason');
    }
    if (
      !Number.isSafeInteger(result.bootstrapInjectionGeneration)
      || result.bootstrapInjectionGeneration <= 0
    ) {
      throw createContentInjectionResultError(errorCode, 'bootstrapInjectionGeneration');
    }
  } else if (typeof result.error !== 'string' || !result.error.trim()) {
    throw createContentInjectionResultError(errorCode, 'error');
  }
  return result;
}

function requireBootstrapInjectionReleaseResult(result) {
  if (
    !result
    || typeof result !== 'object'
    || Array.isArray(result)
    || typeof result.released !== 'boolean'
  ) {
    throw createContentInjectionResultError(
      'CONTENT_SCRIPT_BOOTSTRAP_INJECTION_RELEASE_RESULT_INVALID',
      'result',
    );
  }
  return result;
}

function requireBootstrapInjectionFailureResult(result) {
  const hasSession = !!result?.session
    && typeof result.session === 'object'
    && !Array.isArray(result.session);
  if (
    !result
    || typeof result !== 'object'
    || Array.isArray(result)
    || typeof result.failed !== 'boolean'
    || (
      result.session !== null
      && !hasSession
    )
    || (
      result.failed === true
      && (
        !hasSession
        || result.session.status !== 'failed'
        || result.session.bootstrapInjectionReason !== null
        || result.session.bootstrapInjectionGeneration !== null
        || result.session.bootstrapOwnerReason !== null
      )
    )
  ) {
    throw createContentInjectionResultError(
      'CONTENT_SCRIPT_BOOTSTRAP_INJECTION_FAILURE_RESULT_INVALID',
      'result',
    );
  }
  return result;
}

function requireContentScriptReadyResult(result, errorCode) {
  if (!result || typeof result !== 'object' || Array.isArray(result)) {
    throw createContentInjectionResultError(errorCode, 'result');
  }
  if (typeof result.ok !== 'boolean') {
    throw createContentInjectionResultError(errorCode, 'ok');
  }
  if (typeof result.source !== 'string' || !result.source.trim()) {
    throw createContentInjectionResultError(errorCode, 'source');
  }
  if (result.ok === true) {
    if (result.reason !== null) {
      throw createContentInjectionResultError(errorCode, 'reason');
    }
    return result;
  }
  if (typeof result.reason !== 'string' || !result.reason.trim()) {
    throw createContentInjectionResultError(errorCode, 'reason');
  }
  if (
    result.error !== null
    && typeof result.error !== 'undefined'
    && typeof result.error !== 'string'
    && !(result.error instanceof Error)
  ) {
    throw createContentInjectionResultError(errorCode, 'error');
  }
  return result;
}

function describeContentScriptReadyFailure(result) {
  if (result.ok !== false) {
    throw createContentInjectionResultError(
      'CONTENT_SCRIPT_READY_FAILURE_RESULT_INVALID',
      'ok',
    );
  }
  if (result.error instanceof Error && result.error.message.trim()) {
    return result.error.message.trim();
  }
  if (typeof result.error === 'string' && result.error.trim()) {
    return result.error.trim();
  }
  return result.reason.trim();
}

function requireFailedSessionError(session, errorCode) {
  if (!session || session.status !== 'failed') {
    throw createContentInjectionResultError(errorCode, 'status');
  }
  if (typeof session.error !== 'string' || !session.error.trim()) {
    throw createContentInjectionResultError(errorCode, 'error');
  }
  return session.error.trim();
}

function createLastSyncSnapshotError(fieldName) {
  const error = new Error(`CONTENT_SCRIPT_LAST_SYNC_SNAPSHOT_INVALID:${fieldName}`);
  error.code = 'CONTENT_SCRIPT_LAST_SYNC_SNAPSHOT_INVALID';
  error.field = fieldName;
  return error;
}

function requireLastSyncSnapshotArray(snapshot, fieldName) {
  if (!Array.isArray(snapshot[fieldName])) {
    throw createLastSyncSnapshotError(fieldName);
  }
  return snapshot[fieldName];
}

function requireLastSyncSnapshot(lastSnapshot) {
  if (!lastSnapshot || typeof lastSnapshot !== 'object' || Array.isArray(lastSnapshot)) {
    throw createLastSyncSnapshotError('snapshot');
  }
  if (typeof lastSnapshot.hasScripting !== 'boolean') {
    throw createLastSyncSnapshotError('hasScripting');
  }
  const mediaFrame = lastSnapshot.mediaFrame;
  if (!mediaFrame || typeof mediaFrame !== 'object' || Array.isArray(mediaFrame)) {
    throw createLastSyncSnapshotError('mediaFrame');
  }
  if (typeof mediaFrame.allFrames !== 'boolean') {
    throw createLastSyncSnapshotError('mediaFrame.allFrames');
  }
  if (typeof mediaFrame.registered !== 'boolean') {
    throw createLastSyncSnapshotError('mediaFrame.registered');
  }
  requireLastSyncSnapshotArray(mediaFrame, 'js');
  requireLastSyncSnapshotArray(mediaFrame, 'matches');
  if (lastSnapshot.injectionSummary !== null) {
    requireInjectionSummary(lastSnapshot.injectionSummary);
  }
  return lastSnapshot;
}

function requireTabsSendMessageResult(result, errorCode) {
  if (!result || typeof result !== 'object' || Array.isArray(result)) {
    throw createContentInjectionResultError(errorCode, 'result');
  }
  if (result.error === null) {
    return {
      response: result.response,
      error: null,
    };
  }
  if (typeof result.error === 'string' && result.error.trim()) {
    return {
      response: result.response,
      error: result.error.trim(),
    };
  }
  throw createContentInjectionResultError(errorCode, 'error');
}

function normalizeVideoSkipMainWorldTarget({ tabId, frameId, pageUrl } = {}) {
  const normalizedTabId = Number(tabId);
  if (!Number.isInteger(normalizedTabId) || normalizedTabId < 0) {
    throw createContentInjectionResultError(
      'VIDEO_SKIP_MAIN_WORLD_TARGET_INVALID',
      'tabId',
    );
  }
  if (frameId !== 0) {
    throw createContentInjectionResultError(
      'VIDEO_SKIP_MAIN_WORLD_TARGET_INVALID',
      'frameId',
    );
  }
  let parsedUrl;
  try {
    parsedUrl = new URL(pageUrl);
  } catch (_error) {
    throw createContentInjectionResultError(
      'VIDEO_SKIP_MAIN_WORLD_TARGET_INVALID',
      'pageUrl',
    );
  }
  const hostname = parsedUrl.hostname.trim().toLowerCase();
  const isYouTubeHost = hostname === 'youtube.com' || hostname.endsWith('.youtube.com');
  if (parsedUrl.protocol !== 'https:' || !isYouTubeHost) {
    throw createContentInjectionResultError(
      'VIDEO_SKIP_MAIN_WORLD_TARGET_INVALID',
      'pageUrl',
    );
  }
  return Object.freeze({
    tabId: normalizedTabId,
    frameId: 0,
    hostname,
  });
}

function requireVideoSkipExecuteScriptResult(value, expectedCommand) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw createContentInjectionResultError(
      'VIDEO_SKIP_MAIN_WORLD_EXECUTION_INVALID',
      'executeScriptResult',
    );
  }
  if (value.error !== null) {
    if (typeof value.error === 'string' && value.error.trim()) {
      throw createContentInjectionResultError(
        'VIDEO_SKIP_MAIN_WORLD_EXECUTION_FAILED',
        'executeScript',
      );
    }
    throw createContentInjectionResultError(
      'VIDEO_SKIP_MAIN_WORLD_EXECUTION_INVALID',
      'executeScriptError',
    );
  }
  if (!Array.isArray(value.results) || value.results.length !== 1) {
    throw createContentInjectionResultError(
      'VIDEO_SKIP_MAIN_WORLD_EXECUTION_INVALID',
      'results',
    );
  }
  const injection = value.results[0];
  if (!injection || typeof injection !== 'object' || injection.frameId !== 0) {
    throw createContentInjectionResultError(
      'VIDEO_SKIP_MAIN_WORLD_EXECUTION_INVALID',
      'frameId',
    );
  }
  return requireVideoSkipMainWorldActuatorResult(injection.result, {
    expectedCommand,
  });
}

function normalizeExistingRuntimeProbeResponse(value, expectedUrl) {
  if (
    !value
    || typeof value !== 'object'
    || Array.isArray(value)
    || value.ok !== true
    || value.type !== MESSAGE_TYPES.CONTENT_RUNTIME_PROBE
  ) {
    return Object.freeze({ recovered: false, reason: 'response_unavailable' });
  }
  if (typeof value.buildId !== 'string' || !value.buildId.trim()) {
    return Object.freeze({ recovered: false, reason: 'build_identity_missing' });
  }
  if (value.buildId !== ENTROPY_RUNTIME_BUILD_INFO.buildId) {
    return Object.freeze({
      recovered: false,
      reason: 'build_identity_mismatch',
      observedBuildId: value.buildId,
    });
  }
  const state = value.state;
  if (!state || typeof state !== 'object' || Array.isArray(state)) {
    return Object.freeze({ recovered: false, reason: 'state_unavailable' });
  }
  const status = typeof state.status === 'string' ? state.status.trim().toLowerCase() : '';
  if (
    (status !== 'receiver_ready' && status !== 'active')
    || state.dispatchReady !== true
  ) {
    return Object.freeze({ recovered: false, reason: 'state_not_dispatch_ready' });
  }
  if (state.receiverCapabilityVersion !== CONTENT_RECEIVER_CAPABILITY_VERSION) {
    return Object.freeze({ recovered: false, reason: 'receiver_capability_unavailable' });
  }
  if (state.url !== expectedUrl) {
    return Object.freeze({ recovered: false, reason: 'url_mismatch' });
  }
  return Object.freeze({
    recovered: true,
    reason: null,
    state: Object.freeze({ ...state, status }),
  });
}

function normalizeUnboundDocumentProbeResult(value, expectedUrl) {
  if (
    !value
    || typeof value !== 'object'
    || Array.isArray(value)
    || value.error !== null
    || !Array.isArray(value.results)
    || value.results.length !== 1
  ) {
    return null;
  }
  const injection = value.results[0];
  if (
    !injection
    || typeof injection !== 'object'
    || Array.isArray(injection)
    || injection.frameId !== 0
    || typeof injection.documentId !== 'string'
    || !injection.documentId.trim()
    || injection.documentId !== injection.documentId.trim()
    || injection.result !== expectedUrl
  ) {
    return null;
  }
  return Object.freeze({
    documentId: injection.documentId,
    url: expectedUrl,
  });
}

function readCurrentDocumentLocationHref() {
  return globalThis.location.href;
}

const READY_DOCUMENT_URL_REFRESH_PROOF_FIELDS = Object.freeze([
  'probeAttempted',
  'probeResultCountExact',
  'probeFrameMatches',
  'probeDocumentMatches',
  'probeUrlMatchesRequested',
  'sessionRefreshGenerationMatched',
  'sessionRefreshStatusReady',
  'sessionRefreshDocumentMatched',
  'sessionRefreshUrlMatchedExpected',
  'sessionRefreshCommitted',
  'sessionRefreshGenerationAdvanced',
  'sessionRefreshDocumentPreserved',
  'sessionRefreshUrlMatchesRequested',
]);

function hasExactEnumerableKeys(value, expectedKeys) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const keys = Object.keys(value).sort((left, right) => left.localeCompare(right));
  const expected = [...expectedKeys].sort((left, right) => left.localeCompare(right));
  return keys.length === expected.length
    && keys.every((key, index) => key === expected[index]);
}

function freezeReadyDocumentUrlRefreshProof(proof = {}) {
  const booleanOrNull = (value) => (typeof value === 'boolean' ? value : null);
  return Object.freeze(Object.fromEntries(
    READY_DOCUMENT_URL_REFRESH_PROOF_FIELDS.map((field) => [
      field,
      booleanOrNull(proof?.[field]),
    ]),
  ));
}

function createReadyDocumentUrlRefreshError(code, proof = {}) {
  const error = createContentInjectionResultError(code);
  error.proof = freezeReadyDocumentUrlRefreshProof({
    probeAttempted: false,
    ...proof,
  });
  return error;
}

function requireReadyDocumentUrlRefreshTabId(value) {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw createReadyDocumentUrlRefreshError(
      'CONTENT_SCRIPT_READY_DOCUMENT_URL_REFRESH_TAB_INVALID',
    );
  }
  return value;
}

function requireReadyDocumentUrlRefreshGeneration(value) {
  if (!Number.isSafeInteger(value) || value <= 0) {
    throw createReadyDocumentUrlRefreshError(
      'CONTENT_SCRIPT_READY_DOCUMENT_URL_REFRESH_GENERATION_INVALID',
    );
  }
  return value;
}

function requireReadyDocumentUrlRefreshDocumentId(value) {
  if (typeof value !== 'string' || !value || value !== value.trim()) {
    throw createReadyDocumentUrlRefreshError(
      'CONTENT_SCRIPT_READY_DOCUMENT_URL_REFRESH_DOCUMENT_INVALID',
    );
  }
  return value;
}

function requireExactReadyDocumentUrl(value) {
  if (typeof value !== 'string' || !value || value !== value.trim()) {
    throw createReadyDocumentUrlRefreshError(
      'CONTENT_SCRIPT_READY_DOCUMENT_URL_REFRESH_URL_INVALID',
    );
  }
  try {
    const parsed = new URL(value);
    if (
      (parsed.protocol !== 'http:' && parsed.protocol !== 'https:')
      || parsed.href !== value
    ) {
      throw new Error('non_canonical');
    }
    return parsed.href;
  } catch (_error) {
    throw createReadyDocumentUrlRefreshError(
      'CONTENT_SCRIPT_READY_DOCUMENT_URL_REFRESH_URL_INVALID',
    );
  }
}

function requireReadyDocumentLocationProbeResult(value, {
  expectedDocumentId,
  expectedUrl,
} = {}) {
  const proof = {
    probeAttempted: true,
    probeResultCountExact: Array.isArray(value?.results) && value.results.length === 1,
    probeFrameMatches: null,
    probeDocumentMatches: null,
    probeUrlMatchesRequested: null,
  };
  if (!hasExactEnumerableKeys(value, ['error', 'results'])) {
    throw createReadyDocumentUrlRefreshError(
      'CONTENT_SCRIPT_READY_DOCUMENT_URL_PROBE_RESULT_INVALID',
      proof,
    );
  }
  if (typeof value.error === 'string' && value.error.trim()) {
    throw createReadyDocumentUrlRefreshError(
      'CONTENT_SCRIPT_READY_DOCUMENT_URL_PROBE_FAILED',
      proof,
    );
  }
  if (value.error !== null) {
    throw createReadyDocumentUrlRefreshError(
      'CONTENT_SCRIPT_READY_DOCUMENT_URL_PROBE_RESULT_INVALID',
      proof,
    );
  }
  if (!proof.probeResultCountExact) {
    throw createReadyDocumentUrlRefreshError(
      'CONTENT_SCRIPT_READY_DOCUMENT_URL_PROBE_RESULT_INVALID',
      proof,
    );
  }
  const injection = value.results[0];
  if (!hasExactEnumerableKeys(injection, ['documentId', 'frameId', 'result'])) {
    throw createReadyDocumentUrlRefreshError(
      'CONTENT_SCRIPT_READY_DOCUMENT_URL_PROBE_RESULT_INVALID',
      proof,
    );
  }
  proof.probeFrameMatches = injection?.frameId === 0;
  proof.probeDocumentMatches = injection?.documentId === expectedDocumentId;
  let exactProbeUrl = null;
  try {
    exactProbeUrl = requireExactReadyDocumentUrl(injection?.result, 'probeResult');
  } catch (_error) {
    exactProbeUrl = null;
  }
  proof.probeUrlMatchesRequested = exactProbeUrl === expectedUrl;
  if (
    !proof.probeFrameMatches
    || !proof.probeDocumentMatches
    || !proof.probeUrlMatchesRequested
  ) {
    throw createReadyDocumentUrlRefreshError(
      'CONTENT_SCRIPT_READY_DOCUMENT_URL_PROBE_RESULT_INVALID',
      proof,
    );
  }
  return freezeReadyDocumentUrlRefreshProof(proof);
}

function freezeExactDocumentLocationProbeResult({
  tabId,
  documentId,
  url,
} = {}) {
  return Object.freeze({
    tabId,
    frameId: 0,
    documentId,
    url,
  });
}

export function createContentScriptOrchestrator({
  contentScriptRegistrationSync,
  tabContentSessionRegistry,
  contentScriptFiles,
  mediaFrameContentScriptFiles = [],
  contentRuntimeDiagnostics,
  frameMediaControl = null,
  catchUpConcurrency = DEFAULT_CATCH_UP_CONCURRENCY,
  catchUpReadyTimeoutMs = CONTENT_SCRIPT_READY_TIMEOUT_MS,
} = {}) {
  if (
    !contentScriptRegistrationSync
    || typeof contentScriptRegistrationSync.syncManagedContentScripts !== 'function'
  ) {
    throw new Error('CONTENT_SCRIPT_ORCHESTRATOR_REGISTRATION_SYNC_REQUIRED');
  }
  if (
    !tabContentSessionRegistry
    || typeof tabContentSessionRegistry.noteBootstrapState !== 'function'
    || typeof tabContentSessionRegistry.failBootstrapInjection !== 'function'
    || typeof tabContentSessionRegistry.releaseBootstrapInjection !== 'function'
    || typeof tabContentSessionRegistry.compareAndRefreshReadyDocumentUrl !== 'function'
    || typeof tabContentSessionRegistry.getSnapshot !== 'function'
  ) {
    throw new Error('CONTENT_SCRIPT_ORCHESTRATOR_SESSION_REGISTRY_REQUIRED');
  }

  const scriptFiles = normalizeManagedContentScriptFiles(contentScriptFiles);
  const mediaFrameScriptFiles = normalizeManagedContentScriptFiles(mediaFrameContentScriptFiles);
  const diagnostics = assertContentRuntimeDiagnostics(contentRuntimeDiagnostics);
  const catchUpConcurrencyLimit = normalizeCatchUpConcurrency(catchUpConcurrency);
  const catchUpReadyTimeout = requirePositiveTimeoutMs(
    catchUpReadyTimeoutMs,
    'CONTENT_SCRIPT_CATCH_UP_READY_TIMEOUT_INVALID',
  );
  // Retained only while work is pending or cleanup of the current document failed.
  const readinessOwnersByTab = new Map();
  const scopeRetirementsByTab = new Map();
  const teardownAcknowledgements = new WeakMap();
  const scopeRetirementRevisionsByTab = new Map();
  let nextScopeRetirementRevision = 0;
  let nextReadinessId = 0;
  let syncChain = Promise.resolve();
  let lastSyncSnapshot = createInitialSyncSnapshot(scriptFiles, mediaFrameScriptFiles);
  let pendingCatchUpTabs = [];
  let permissionRevision = 0;
  const permissionCancellations = new WeakSet();

  function revokeScopeRetirement(tabId) {
    scopeRetirementsByTab.delete(tabId);
    const revision = ++nextScopeRetirementRevision;
    scopeRetirementRevisionsByTab.set(tabId, revision);
    return revision;
  }

  function assertPermissionRevision(expectedRevision, phase) {
    if (expectedRevision === permissionRevision) return;
    const error = new Error('CONTENT_SCRIPT_PERMISSIONS_CHANGED');
    Object.assign(error, { code: error.message, phase, expectedRevision, currentRevision: permissionRevision });
    permissionCancellations.add(error);
    throw error;
  }

  function invalidatePermissions() {
    permissionRevision += 1;
    scopeRetirementsByTab.clear();
    frameMediaControl?.invalidatePermissions();
    for (const tabId of readinessOwnersByTab.keys()) cancelTabReadiness(tabId, 'permissions_changed');
    recordDiagnostic('content_permissions_invalidated', { permissionRevision });
  }

  function recordDiagnostic(event, payload = {}) {
    return diagnostics.record(event, payload);
  }

  function createReadinessOwner(url = '', propagationContext = null) {
    return {
      id: ++nextReadinessId,
      controller: new AbortController(),
      url,
      navigationRevision: 0,
      documentExitRevision: 0,
      cleanupError: null,
      cleanupDocumentId: null,
      evicted: false,
      propagationContext,
      removePropagationListener: null,
    };
  }

  function cancelledReadinessResult(tabId, owner, reason, phase) {
    recordDiagnostic('ensure_ready_cancelled', {
      tabId, readinessId: owner.id, reason, phase,
      ...settingsPropagationDiagnostic(owner.propagationContext),
    });
    return {
      ok: false,
      reason: 'content_readiness_cancelled',
      error: 'CONTENT_SCRIPT_READINESS_CANCELLED',
      source: 'orchestrator',
    };
  }

  async function waitForReadinessHandoff(tabId, options, owner, pending) {
    const navigationRevision = owner.navigationRevision;
    const expectedPermissionRevision = permissionRevision;
    // The earlier caller retains its outcome. A queued request cannot cross a
    // subsequent navigation/eviction while waiting for that outcome.
    await Promise.allSettled(pending);
    if (owner.evicted || owner.navigationRevision !== navigationRevision || permissionRevision !== expectedPermissionRevision) {
      return cancelledReadinessResult(tabId, owner, 'handoff_invalidated', 'readiness_handoff');
    }
    return ensureContentScriptReady(tabId, options);
  }

  function assertReadinessCurrent(owner, phase) {
    if (!owner.controller.signal.aborted) return;
    const revocation = owner.controller.signal.reason;
    const error = new Error(revocation.message, { cause: revocation });
    error.code = revocation.code;
    error.reason = revocation.reason;
    error.phase = phase;
    throw error;
  }

  function cancelTabReadiness(tabId, reason) {
    const owner = readinessOwnersByTab.get(Number(tabId));
    if (owner && !owner.controller.signal.aborted) {
      const error = new Error('CONTENT_SCRIPT_READINESS_CANCELLED');
      error.code = 'CONTENT_SCRIPT_READINESS_CANCELLED';
      error.reason = reason;
      owner.controller.abort(error);
      recordDiagnostic('readiness_revoked', buildSessionDiagnostic(tabContentSessionRegistry.get(Number(tabId)), {
        tabId: Number(tabId), readinessId: owner.id, reason,
        ...settingsPropagationDiagnostic(owner.propagationContext),
      }));
    }
    return owner;
  }

  function releaseReadinessOwner(tabId, owner) {
    if (readinessOwnersByTab.get(tabId) !== owner) return;
    if (!owner.normalTask && !owner.forceTask) {
      owner.removePropagationListener?.();
      owner.removePropagationListener = null;
    }
    if (!owner.normalTask && !owner.forceTask && !owner.teardownTask && (!owner.cleanupError || owner.evicted)) {
      readinessOwnersByTab.delete(tabId);
    }
  }

  function invalidateReadinessForNavigation(tabId, { reason = 'navigation', documentExited = false } = {}) {
    revokeScopeRetirement(Number(tabId));
    const readiness = cancelTabReadiness(tabId, reason);
    if (!readiness) return;
    readiness.navigationRevision += 1;
    if (documentExited) {
      readiness.documentExitRevision += 1;
      readiness.cleanupError = null;
      readiness.cleanupDocumentId = null;
    }
    releaseReadinessOwner(Number(tabId), readiness);
  }

  function recordManagedSyncFailure(error, { reason, injectOpenTabs }) {
    const payload = {
      reason: normalizeReason(reason, 'unspecified'),
      injectOpenTabs: !!injectOpenTabs,
      code: typeof error?.code === 'string' && error.code.trim() ? error.code.trim() : null,
      error: error?.message || String(error || 'MANAGED_CONTENT_SCRIPT_SYNC_FAILED'),
    };
    if (error?.details && typeof error.details === 'object') {
      payload.details = error.details;
    }
    recordDiagnostic('managed_sync_failed', payload);
    console.warn('[ContentScriptOrchestrator] Managed content script sync failed:', payload);
  }

  function toTimingDelta(later, earlier) {
    const nextLater = Number(later);
    const nextEarlier = Number(earlier);
    if (!Number.isFinite(nextLater) || !Number.isFinite(nextEarlier) || nextLater < nextEarlier) {
      return null;
    }
    return nextLater - nextEarlier;
  }

  function buildSessionDiagnostic(session, patch = {}) {
    if (!session || typeof session !== 'object') {
      return {
        ...patch,
      };
    }
    return {
      tabId: session.tabId,
      url: session.url || '',
      status: session.status || null,
      sessionKey: session.sessionKey || null,
      documentId: session.documentId || null,
      reason: session.reason || null,
      error: session.error || null,
      attemptCount: Number(session.attemptCount) || 0,
      startedAt: session.startedAt || null,
      receiverReadyAt: session.receiverReadyAt || null,
      activeAt: session.activeAt || null,
      failedAt: session.failedAt || null,
      bootstrapToReceiverReadyMs: toTimingDelta(session.receiverReadyAt, session.startedAt),
      bootstrapToActiveMs: toTimingDelta(session.activeAt, session.startedAt),
      ...patch,
    };
  }

  function buildMediaFrameDiagnostic(session, patch = {}) {
    if (!session || typeof session !== 'object') {
      return {
        ...patch,
      };
    }
    return {
      tabId: session.tabId,
      frameId: session.frameId,
      url: session.url || '',
      status: session.status || null,
      sessionKey: session.sessionKey || null,
      documentId: session.documentId || null,
      reason: session.reason || null,
      hasVideo: session.hasVideo,
      videoCount: session.videoCount,
      htmlVideoElementAvailable: session.htmlVideoElementAvailable === true,
      readyState: session.readyState || null,
      visibilityState: session.visibilityState || null,
      topFrame: session.topFrame === true,
      frameKind: session.frameKind || null,
      videoObservationMode: session.videoObservationMode || null,
      observationError: session.observationError,
      shadowRootAccess: session.shadowRootAccess,
      lateShadowDiscovery: session.lateShadowDiscovery,
      startedAt: session.startedAt || null,
      lastReportedAt: session.lastReportedAt || null,
      ...patch,
    };
  }

  function finalizeEnsureResult(tabId, result, patch = {}) {
    const readiness = readinessOwnersByTab.get(tabId);
    const snapshot = tabContentSessionRegistry.getSnapshot(tabId);
    const session = snapshot?.session || null;
    const finalizedResult = result?.ok === true
      ? Object.freeze({
        ...result,
        receiverCapability: createContentReceiverCapability({
          receiverCapabilityVersion: session?.receiverCapabilityVersion,
          documentId: session?.documentId,
          attemptId: session?.attemptId,
          startedAt: session?.startedAt,
          receiverReadyAt: session?.receiverReadyAt,
          sessionGeneration: snapshot?.generation,
        }),
      })
      : result;
    recordDiagnostic(finalizedResult?.ok ? 'ensure_ready_succeeded' : 'ensure_ready_failed', buildSessionDiagnostic(session, {
      tabId,
      readinessId: readiness?.id ?? null,
      ...settingsPropagationDiagnostic(readiness?.propagationContext),
      ok: !!finalizedResult?.ok,
      source: finalizedResult?.source || 'orchestrator',
      reason: finalizedResult?.reason || null,
      error: finalizedResult?.error ? String(finalizedResult.error) : null,
      receiverCapabilityVersion:
        finalizedResult?.receiverCapability?.schemaVersion || null,
      ...patch,
    }));
    return finalizedResult;
  }

  async function teardownContentForTab(tabId, options = {}) {
    const propagationContext = requireSettingsPropagationContext(options.propagationContext);
    const normalizedTabId = Number(tabId);
    if (!Number.isInteger(normalizedTabId) || normalizedTabId < 0) {
      throw createContentInjectionResultError('CONTENT_SCRIPT_TEARDOWN_TAB_ID_INVALID');
    }
    const owner = cancelTabReadiness(normalizedTabId, 'teardown') || createReadinessOwner();
    if (owner.teardownTask) return owner.teardownTask;
    const retirementRevision = revokeScopeRetirement(normalizedTabId);
    const teardownPermissionRevision = permissionRevision;
    readinessOwnersByTab.set(normalizedTabId, owner);
    cancelTabReadiness(normalizedTabId, 'teardown');
    const navigationRevision = owner.navigationRevision;
    const documentExitRevision = owner.documentExitRevision;
    const session = tabContentSessionRegistry.get(normalizedTabId);
    owner.cleanupDocumentId = session?.documentId || null;
    if (session?.documentId && Number.isSafeInteger(session.attemptId) && session.attemptId > 0) {
      tabContentSessionRegistry.noteBootstrapState(normalizedTabId, {
        status: 'stale', documentId: session.documentId, attemptId: session.attemptId,
        url: session.url, reason: options.reason || 'teardown',
      });
    }
    // Revocation stops future steps; an already issued browser mutation still
    // owns its completion. Wait before taking the exact cleanup identity.
    const pending = [owner.normalTask, owner.forceTask].filter(Boolean);
    const executeCleanup = async () => {
      if (owner.evicted) throw createContentInjectionResultError('CONTENT_SCRIPT_TEARDOWN_TAB_EVICTED');
      if (owner.navigationRevision !== navigationRevision) {
        throw createContentInjectionResultError('CONTENT_SCRIPT_TEARDOWN_DOCUMENT_CHANGED');
      }
      const current = tabContentSessionRegistry.get(normalizedTabId);
      if (session?.documentId && current?.documentId !== session.documentId) {
        throw createContentInjectionResultError('CONTENT_SCRIPT_TEARDOWN_DOCUMENT_CHANGED');
      }
      return runTeardownContentForTab(normalizedTabId, options, {
        retirementRevision, teardownPermissionRevision,
      });
    };
    const work = pending.length ? Promise.allSettled(pending).then(executeCleanup) : executeCleanup();
    const task = work
      .then(result => {
        owner.cleanupError = result.ok || owner.evicted || owner.documentExitRevision !== documentExitRevision
          ? null : result.error;
        return result;
      }, error => {
        owner.cleanupError = owner.evicted || owner.documentExitRevision !== documentExitRevision ? null : error;
        recordDiagnostic('teardown_failed', {
          ...settingsPropagationDiagnostic(propagationContext),
          tabId: normalizedTabId, readinessId: owner.id, code: error.code || error.message,
          documentReplaced: owner.documentExitRevision !== documentExitRevision, tabEvicted: owner.evicted === true,
        });
        throw error;
      }).finally(() => {
        owner.teardownTask = null;
        releaseReadinessOwner(normalizedTabId, owner);
      });
    owner.teardownTask = task;
    return task;
  }

  async function runTeardownContentForTab(tabId, { reason = 'teardown', url = '', propagationContext = null } = {},
    { retirementRevision, teardownPermissionRevision }) {
    const ownedSession = tabContentSessionRegistry.get(tabId);
    const documentId = ownedSession?.documentId;
    const attemptId = ownedSession?.attemptId;
    // Navigation records tabs before any content runtime exists. This exact
    // absent state has no cleanup obligation; missing identity in any started
    // runtime remains an error, including failed or stale attempts.
    if (
      ownedSession?.status === 'absent'
      && documentId === null
      && attemptId === null
      && ownedSession.attemptCount === 0
    ) {
      recordDiagnostic('teardown_not_required', {
        ...settingsPropagationDiagnostic(propagationContext),
        tabId,
        reason: normalizeReason(reason, 'teardown'),
        disposition: 'runtime_absent',
      });
      return { ok: true, disposition: 'runtime_absent' };
    }
    if (!documentId || !Number.isSafeInteger(attemptId) || attemptId < 1) {
      throw createContentInjectionResultError('CONTENT_SCRIPT_TEARDOWN_DOCUMENT_IDENTITY_REQUIRED');
    }
    const teardownId = crypto.randomUUID();
    recordDiagnostic('teardown_requested', {
      tabId,
      documentId, attemptId, teardownId,
      ...settingsPropagationDiagnostic(propagationContext),
      url,
      reason: normalizeReason(reason, 'teardown'),
    });
    // Revoke dispatch eligibility immediately, but retain identity for cleanup
    // retries. A transport success alone is not evidence that effects are gone.
    tabContentSessionRegistry.noteBootstrapState(tabId, {
      status: 'stale', documentId, attemptId, url: ownedSession.url, reason,
    });
    const requestSnapshot = tabContentSessionRegistry.getSnapshot(tabId);
    const sendResult = requireTabsSendMessageResult(
      await tabsSendMessage(tabId, {
        type: MESSAGE_TYPES.CONTENT_RUNTIME_TEARDOWN,
        payload: {
          reason: normalizeReason(reason, 'teardown'),
          teardownId,
          attemptId,
        },
      }, { documentId }),
      'CONTENT_SCRIPT_TEARDOWN_MESSAGE_RESULT_INVALID',
    );
    const ack = sendResult.response;
    const acknowledged = sendResult.error === null
      && ack?.ok === true
      && ack.type === MESSAGE_TYPES.CONTENT_RUNTIME_TEARDOWN
      && ack.teardownId === teardownId
      && ack.attemptId === attemptId;
    const error = acknowledged ? null : (sendResult.error
      || (typeof ack?.error === 'string' && ack.error)
      || 'CONTENT_SCRIPT_TEARDOWN_ACK_INVALID');
    const currentSession = tabContentSessionRegistry.get(tabId);
    const retirementCurrent = permissionRevision === teardownPermissionRevision
      && scopeRetirementRevisionsByTab.get(tabId) === retirementRevision
      && currentSession?.url === requestSnapshot.session.url;
    if (currentSession?.documentId === documentId && currentSession?.attemptId === attemptId) {
      tabContentSessionRegistry.noteBootstrapState(tabId, {
        status: 'stale', documentId, attemptId, url: currentSession.url, reason, error,
      });
    }
    const session = tabContentSessionRegistry.get(tabId);
    recordDiagnostic('teardown_completed', buildSessionDiagnostic(ownedSession, {
      documentId, attemptId, teardownId,
      status: 'stale',
      currentDocumentId: session?.documentId ?? null,
      ...settingsPropagationDiagnostic(propagationContext),
      ok: acknowledged,
      error,
      reason: normalizeReason(reason, 'teardown'),
    }));
    const result = {
      ok: acknowledged,
      error,
    };
    const snapshot = tabContentSessionRegistry.getSnapshot(tabId);
    if (acknowledged && retirementCurrent && snapshot?.session?.status === 'stale'
      && snapshot.session.documentId === documentId && snapshot.session.attemptId === attemptId
      && snapshot.session.error === null) {
      teardownAcknowledgements.set(result, Object.freeze({
        tabId, documentId, attemptId, generation: snapshot.generation, url: snapshot.session.url,
        retirementRevision, permissionRevision: teardownPermissionRevision,
      }));
    }
    return result;
  }

  async function retireTrackedContentScope(tabId, options) {
    if (scopeRetirementsByTab.has(tabId)
      && readContentScopeRetirement(tabId, { url: options.url }) !== null) {
      return { ok: true, disposition: 'content_scope_retired' };
    }
    const result = await teardownContentForTab(tabId, options);
    const proof = teardownAcknowledgements.get(result);
    const snapshot = tabContentSessionRegistry.getSnapshot(tabId);
    if (proof && snapshot?.generation === proof.generation && permissionRevision === proof.permissionRevision
      && scopeRetirementRevisionsByTab.get(tabId) === proof.retirementRevision) {
      scopeRetirementsByTab.set(tabId, proof);
      recordDiagnostic('content_scope_retired', {
        tabId, documentId: proof.documentId, attemptId: proof.attemptId, generation: proof.generation,
        ...settingsPropagationDiagnostic(options.propagationContext),
      });
    }
    return result;
  }

  function readContentScopeRetirement(tabId, { url } = {}) {
    const normalizedTabId = Number(tabId);
    if (!Number.isSafeInteger(normalizedTabId) || normalizedTabId < 0) {
      throw createContentInjectionResultError('CONTENT_SCOPE_RETIREMENT_TAB_ID_INVALID');
    }
    const requestedUrl = requireExactReadyDocumentUrl(url, 'scopeRetirementRequestedUrl');
    const proof = scopeRetirementsByTab.get(normalizedTabId);
    if (!proof) return null;
    const snapshot = tabContentSessionRegistry.getSnapshot(normalizedTabId);
    const sync = requireLastSyncSnapshot(lastSyncSnapshot);
    const inScope = sync.hasScripting && isHostnameInList(getHostname(requestedUrl),
      requireLastSyncSnapshotArray(sync, 'registeredDomains'));
    if (inScope || permissionRevision !== proof.permissionRevision
      || scopeRetirementRevisionsByTab.get(normalizedTabId) !== proof.retirementRevision
      || snapshot?.generation !== proof.generation || snapshot?.session?.status !== 'stale'
      || snapshot.session.documentId !== proof.documentId || snapshot.session.attemptId !== proof.attemptId
      || snapshot.session.url !== requestedUrl || proof.url !== requestedUrl || snapshot.session.error !== null) {
      scopeRetirementsByTab.delete(normalizedTabId);
      return null;
    }
    return Object.freeze({ disposition: 'content_scope_retired', documentId: proof.documentId,
      attemptId: proof.attemptId, generation: proof.generation });
  }

  async function settleSessionReconciliation(sessions, reconcile) {
    const results = await Promise.allSettled(sessions.map(async (session) => {
      const result = await reconcile(session);
      if (result?.ok === false) throw new Error(result.error);
    }));
    const failures = results.flatMap((result, index) => result.status === 'rejected'
      ? [{ tabId: sessions[index].tabId, error: result.reason }]
      : []);
    if (failures.length === 1) throw failures[0].error;
    if (failures.length > 1) {
      // The propagation checkpoint preserves code/name/message, not AggregateError.errors.
      // Keep bounded per-tab causes in that message so retries remain diagnosable.
      const details = {
        failedCount: failures.length,
        failures: failures.slice(0, 8).map(({ tabId, error }) => ({
          tabId,
          code: typeof error?.code === 'string' ? error.code.slice(0, 96) : null,
          message: String(error?.message ?? error).slice(0, 240),
        })),
        omittedFailureCount: Math.max(0, failures.length - 8),
      };
      const error = new AggregateError(
        failures.map((failure) => failure.error),
        `CONTENT_SCRIPT_TEARDOWN_RECONCILIATION_FAILED summary=${JSON.stringify(details)}`,
      );
      error.code = 'CONTENT_SCRIPT_TEARDOWN_RECONCILIATION_FAILED';
      error.details = details;
      throw error;
    }
  }

  async function reconcileTrackedSessions(reason, observedTabs, propagationContext, assertPermissionsCurrent) {
    assertPermissionsCurrent('scope_reconcile_start');
    throwIfSettingsPropagationCancelled(propagationContext, 'scope_reconcile_start');
    const sessions = tabContentSessionRegistry.list();
    // Permission/probe preparation can precede the first registry publication.
    // Such work still owns a cancellation obligation during scope removal.
    const recordedTabIds = new Set(sessions.map((session) => session.tabId));
    for (const [tabId, owner] of readinessOwnersByTab) {
      if (!recordedTabIds.has(tabId)) sessions.push({ tabId, url: owner.url });
    }
    if (sessions.length === 0) return;

    const syncSnapshot = requireLastSyncSnapshot(lastSyncSnapshot);
    if (syncSnapshot.hasScripting === false) {
      await settleSessionReconciliation(
        sessions,
        (session) => retireTrackedContentScope(session.tabId, {
          reason: `${reason}:scripting_unavailable`,
          url: session.url,
          propagationContext,
        }),
      );
      return;
    }

    const registeredDomains = requireLastSyncSnapshotArray(syncSnapshot, 'registeredDomains');
    const tabs = observedTabs === null ? await tabsQuery({}) : observedTabs;
    assertPermissionsCurrent('scope_inventory_ready');
    throwIfSettingsPropagationCancelled(propagationContext, 'scope_inventory_ready');
    const tabsById = new Map(
      tabs
        .filter((tab) => Number.isInteger(Number(tab?.id)))
        .map((tab) => [Number(tab.id), tab]),
    );

    await settleSessionReconciliation(
      sessions,
      async (session) => {
        const tab = tabsById.get(session.tabId);
        const url = typeof tab?.url === 'string' && tab.url.trim() ? tab.url.trim() : session.url;
        const hostname = getHostname(url);
        if (!hostname || !isHostnameInList(hostname, registeredDomains)) {
          return retireTrackedContentScope(session.tabId, {
            reason: `${reason}:out_of_scope`,
            url,
            propagationContext,
          });
        }
        tabContentSessionRegistry.refreshScope(session.tabId, {
          url,
          reason: `${reason}:scope_refresh`,
        });
      },
    );
  }

  async function recoverExistingContentRuntime(tabId, {
    url = '',
    reason = 'runtime_probe',
  } = {}, owner) {
    assertReadinessCurrent(owner, 'runtime_probe_before_send');
    const normalizedReason = normalizeReason(reason, 'runtime_probe');
    let deliveryResult = null;
    try {
      deliveryResult = await tabsSendMessage(tabId, {
        type: MESSAGE_TYPES.CONTENT_RUNTIME_PROBE,
      });
    } catch (error) {
      assertReadinessCurrent(owner, 'runtime_probe_rejected');
      recordDiagnostic('existing_runtime_probe_missed', {
        tabId,
        url,
        reason: normalizedReason,
        missReason: 'delivery_rejected',
        error: String(error?.message || error || 'CONTENT_RUNTIME_PROBE_DELIVERY_REJECTED'),
      });
      return null;
    }
    assertReadinessCurrent(owner, 'runtime_probe_after_send');
    const delivery = requireTabsSendMessageResult(
      deliveryResult,
      'CONTENT_SCRIPT_RUNTIME_PROBE_MESSAGE_RESULT_INVALID',
    );

    if (delivery.error !== null) {
      recordDiagnostic('existing_runtime_probe_missed', {
        tabId,
        url,
        reason: normalizedReason,
        missReason: 'receiver_unavailable',
        error: delivery.error,
      });
      return null;
    }

    const probe = normalizeExistingRuntimeProbeResponse(delivery.response, url);
    if (!probe.recovered) {
      recordDiagnostic('existing_runtime_probe_missed', {
        tabId,
        url,
        reason: normalizedReason,
        missReason: probe.reason,
        observedBuildId: probe.observedBuildId || null,
        expectedBuildId: ENTROPY_RUNTIME_BUILD_INFO.buildId,
      });
      return null;
    }

    let documentProbe = null;
    try {
      documentProbe = normalizeUnboundDocumentProbeResult(
        await scriptingExecuteScriptWithResults({
          target: { tabId },
          injectImmediately: true,
          func: readCurrentDocumentLocationHref,
        }),
        url,
      );
    } catch (error) {
      assertReadinessCurrent(owner, 'document_probe_rejected');
      recordDiagnostic('existing_runtime_probe_missed', {
        tabId,
        url,
        reason: normalizedReason,
        missReason: 'document_probe_rejected',
        error: String(error?.message || error || 'CONTENT_RUNTIME_DOCUMENT_PROBE_REJECTED'),
      });
      return null;
    }
    assertReadinessCurrent(owner, 'document_probe_after_read');
    if (!documentProbe) {
      recordDiagnostic('existing_runtime_probe_missed', {
        tabId,
        url,
        reason: normalizedReason,
        missReason: 'document_identity_unproven',
      });
      return null;
    }

    const session = tabContentSessionRegistry.noteBootstrapState(tabId, {
      ...probe.state,
      documentId: documentProbe.documentId,
      url: documentProbe.url,
      reason: 'runtime_probe_recovered',
    });
    if (
      !session
      || (session.status !== 'receiver_ready' && session.status !== 'active')
      || session.documentId !== documentProbe.documentId
      || session.url !== documentProbe.url
    ) {
      recordDiagnostic('existing_runtime_probe_missed', {
        tabId,
        url,
        reason: normalizedReason,
        missReason: 'session_rebind_rejected',
      });
      return null;
    }

    recordDiagnostic('existing_runtime_probe_recovered', buildSessionDiagnostic(session, {
      tabId,
      url,
      reason: normalizedReason,
      buildId: ENTROPY_RUNTIME_BUILD_INFO.buildId,
    }));
    return session;
  }

  async function injectContentScriptFiles(tabId, { url = '', reason = 'inject' } = {}, owner) {
    assertReadinessCurrent(owner, 'loader_before_inject');
    const normalizedInjectionReason = normalizeReason(reason, 'inject');
    const injectionSession = tabContentSessionRegistry.noteInjecting(tabId, {
      url,
      reason: normalizedInjectionReason,
    });
    recordDiagnostic('inject_started', buildSessionDiagnostic(tabContentSessionRegistry.get(tabId), {
      tabId,
      url,
      reason: normalizeReason(reason, 'inject'),
      scriptFiles: [...scriptFiles],
    }));
    let injectError = null;
    let executeResult = null;
    try {
      executeResult = await scriptingExecuteScript({
        target: { tabId },
        // Match managed document_start registration: receiver preparation must
        // not wait for the protected page's network/DOM idle before Gate can run.
        injectImmediately: true,
        files: scriptFiles,
      });
    } catch (error) {
      injectError = String(error?.message || error || 'INJECT_EXECUTION_FAILED');
    }
    assertReadinessCurrent(owner, 'loader_after_inject');
    if (injectError === null) {
      injectError = normalizeScriptingExecuteErrorResult(
        executeResult,
        'CONTENT_SCRIPT_INJECT_EXECUTE_RESULT_INVALID',
      );
    }
    if (injectError) {
      const failureResult = requireBootstrapInjectionFailureResult(
        tabContentSessionRegistry.failBootstrapInjection(tabId, {
          expectedReason: injectionSession.bootstrapInjectionReason,
          expectedGeneration: injectionSession.bootstrapInjectionGeneration,
          url,
          error: String(injectError),
          failedAt: Date.now(),
        }),
      );
      recordDiagnostic('inject_failed', buildSessionDiagnostic(failureResult.session, {
        tabId,
        url,
        reason: normalizedInjectionReason,
        error: String(injectError),
        expectedGeneration: injectionSession.bootstrapInjectionGeneration,
        failedCommitted: failureResult.failed,
      }));
      return {
        ok: false,
        error: String(injectError),
      };
    }
    recordDiagnostic('inject_succeeded', buildSessionDiagnostic(tabContentSessionRegistry.get(tabId), {
      tabId,
      url,
      reason: normalizeReason(reason, 'inject'),
    }));
    await injectMediaFrameSidecar(tabId, {
      url,
      reason,
    }, owner);
    return {
      ok: true,
      error: null,
      bootstrapInjectionReason: injectionSession?.bootstrapInjectionReason,
      bootstrapInjectionGeneration: injectionSession?.bootstrapInjectionGeneration,
    };
  }

  async function injectMediaFrameSidecar(tabId, { url = '', reason = 'inject' } = {}, owner) {
    assertReadinessCurrent(owner, 'media_before_inject');
    if (mediaFrameScriptFiles.length === 0) {
      return {
        ok: true,
        skipped: true,
        error: null,
      };
    }
    recordDiagnostic('media_frame_sidecar_inject_started', {
      tabId,
      url,
      reason: normalizeReason(reason, 'inject'),
      scriptFiles: [...mediaFrameScriptFiles],
      allFrames: true,
    });
    let injectError = null;
    let executeResult = null;
    try {
      executeResult = await scriptingExecuteScript({
        target: { tabId, allFrames: true },
        injectImmediately: true,
        files: mediaFrameScriptFiles,
      });
    } catch (error) {
      injectError = String(error?.message || error || 'MEDIA_FRAME_SIDECAR_INJECT_FAILED');
    }
    assertReadinessCurrent(owner, 'media_after_inject');
    if (injectError === null) {
      injectError = normalizeScriptingExecuteErrorResult(
        executeResult,
        'CONTENT_SCRIPT_MEDIA_FRAME_EXECUTE_RESULT_INVALID',
      );
    }
    if (injectError) {
      recordDiagnostic('media_frame_sidecar_inject_failed', {
        tabId,
        url,
        reason: normalizeReason(reason, 'inject'),
        error: String(injectError),
        scriptFiles: [...mediaFrameScriptFiles],
        allFrames: true,
      });
      return {
        ok: false,
        skipped: false,
        error: String(injectError),
      };
    }
    recordDiagnostic('media_frame_sidecar_inject_succeeded', {
      tabId,
      url,
      reason: normalizeReason(reason, 'inject'),
      scriptFiles: [...mediaFrameScriptFiles],
      allFrames: true,
    });
    return {
      ok: true,
      skipped: false,
      error: null,
    };
  }

  async function ensureCatchUpTabsReady(catchUpTabs, reason, propagationContext, expectedPermissionRevision) {
    const requestedCount = Array.isArray(catchUpTabs)
      ? catchUpTabs.filter((entry) => Number.isInteger(Number(entry?.tabId))).length
      : 0;
    const normalizedTargets = normalizeCatchUpTargets(catchUpTabs);
    const skippedDuplicateCount = Math.max(0, requestedCount - normalizedTargets.length);
    const normalizedSyncReason = normalizeReason(reason, 'sync');
    const startedAt = Date.now();

    if (normalizedTargets.length === 0) {
      return createInjectionSummary();
    }

    recordDiagnostic('catch_up_readiness_started', {
      reason: normalizedSyncReason,
      requestedCount,
      attemptedCount: normalizedTargets.length,
      skippedDuplicateCount,
      concurrencyLimit: catchUpConcurrencyLimit,
    });

    const readinessResults = await mapWithConcurrency(
      normalizedTargets,
      catchUpConcurrencyLimit,
      async (entry) => {
        const tabId = Number(entry.tabId);
        const url = typeof entry?.url === 'string' ? entry.url : '';
        if (expectedPermissionRevision !== permissionRevision) {
          return { tabId, url, readinessReason: 'content_readiness_cancelled', error: 'CONTENT_SCRIPT_PERMISSIONS_CHANGED' };
        }
        const readyResult = requireContentScriptReadyResult(
          await ensureContentScriptReady(tabId, {
            url,
            reason: `${normalizedSyncReason}:catch_up`,
            timeoutMs: catchUpReadyTimeout,
            propagationContext,
          }),
          'CONTENT_SCRIPT_CATCH_UP_READY_RESULT_INVALID',
        );
        const readyError = readyResult.ok === true
          ? null
          : describeContentScriptReadyFailure(readyResult);
        if (readyError) {
          recordDiagnostic(propagationContext?.signal.aborted || expectedPermissionRevision !== permissionRevision ? 'catch_up_readiness_cancelled' : 'catch_up_readiness_failed', {
            ...settingsPropagationDiagnostic(propagationContext),
            tabId,
            url,
            reason: normalizedSyncReason,
            readinessReason: readyResult.reason,
            error: readyError,
          });
        }
        return {
          tabId,
          url,
          readinessReason: readyResult.reason,
          error: readyError,
        };
      },
    );

    const failures = readinessResults
      .filter((entry) => !!entry.error)
      .map((entry) => ({
        tabId: entry.tabId,
        url: entry.url,
        reason: entry.readinessReason,
        error: String(entry.error),
      }));

    if (failures.length > 0 && !propagationContext?.signal.aborted && expectedPermissionRevision === permissionRevision) {
      console.warn('[ContentScriptOrchestrator] Catch-up readiness had failures:', {
        attemptedCount: readinessResults.length,
        failureCount: failures.length,
        failureTabIds: failures.map((entry) => entry.tabId),
        concurrencyLimit: catchUpConcurrencyLimit,
      });
    }

    const summary = createInjectionSummary({
      attemptedCount: readinessResults.length,
      successCount: readinessResults.length - failures.length,
      failureCount: failures.length,
      failures,
    });
    recordDiagnostic('catch_up_readiness_completed', {
      reason: normalizedSyncReason,
      requestedCount,
      skippedDuplicateCount,
      concurrencyLimit: catchUpConcurrencyLimit,
      durationMs: Math.max(0, Date.now() - startedAt),
      ...summary,
    });
    return summary;
  }

  async function runEnsureContentScriptReady(
    tabId,
    {
      url = '',
      reason = 'unspecified',
      timeoutMs = CONTENT_SCRIPT_READY_TIMEOUT_MS,
      forceInject = false,
    } = {},
    owner,
  ) {
    assertReadinessCurrent(owner, 'ensure_start');
    recordDiagnostic('ensure_ready_started', {
      tabId,
      readinessId: owner.id,
      ...settingsPropagationDiagnostic(owner.propagationContext),
      url,
      reason: normalizeReason(reason, 'unspecified'),
      timeoutMs,
      forceInject: !!forceInject,
    });
    const session = tabContentSessionRegistry.get(tabId);
    if (!forceInject && (session?.status === 'receiver_ready' || session?.status === 'active')) {
      return finalizeEnsureResult(tabId, {
        ok: true,
        reason: null,
        source: 'session_dispatch_ready',
      }, {
        forceInject: false,
      });
    }

    if (!forceInject && (session?.status === 'bootstrapping' || session?.status === 'injecting')) {
      const ready = await tabContentSessionRegistry.waitForDispatchReady(tabId, { timeoutMs, signal: owner.controller.signal });
      assertReadinessCurrent(owner, 'existing_dispatch_wait');
      if (ready) {
        return finalizeEnsureResult(tabId, {
          ok: true,
          reason: null,
          source: 'session_dispatch_wait',
        }, {
          forceInject: false,
        });
      }
    }

    const hasScripting = await permissionsContains({ permissions: ['scripting'] });
    assertReadinessCurrent(owner, 'scripting_permission');
    if (!hasScripting) {
      return finalizeEnsureResult(tabId, {
        ok: false,
        reason: 'missing_scripting_permission',
        source: 'orchestrator',
      }, {
        forceInject: !!forceInject,
      });
    }

    if (!forceInject) {
      const recoveredSession = await recoverExistingContentRuntime(tabId, { url, reason }, owner);
      assertReadinessCurrent(owner, 'runtime_recovery');
      if (recoveredSession) {
        return finalizeEnsureResult(tabId, {
          ok: true,
          reason: null,
          source: 'content_runtime_probe',
        }, {
          forceInject: false,
        });
      }
    }

    const injectResult = requireInjectionAttemptResult(
      await injectContentScriptFiles(tabId, {
        url,
        reason: normalizeReason(reason, 'inject'),
      }, owner),
      'CONTENT_SCRIPT_READY_INJECTION_RESULT_INVALID',
    );
    if (!injectResult.ok) {
      return finalizeEnsureResult(tabId, {
        ok: false,
        reason: 'inject_failed',
        error: injectResult.error,
        source: 'orchestrator',
      }, {
        forceInject: !!forceInject,
      });
    }

    const ready = await tabContentSessionRegistry.waitForDispatchReady(tabId, { timeoutMs, signal: owner.controller.signal });
    assertReadinessCurrent(owner, 'dispatch_wait');
    if (!ready) {
      const failedSession = tabContentSessionRegistry.get(tabId);
      if (failedSession?.status === 'failed') {
        const failedError = requireFailedSessionError(
          failedSession,
          'CONTENT_SCRIPT_FAILED_SESSION_ERROR_REQUIRED',
        );
        return finalizeEnsureResult(tabId, {
          ok: false,
          reason: 'content_bootstrap_failed',
          error: failedError,
          source: 'orchestrator',
        }, {
          forceInject: !!forceInject,
        });
      }

      recordDiagnostic('dispatch_ready_retry_started', buildSessionDiagnostic(failedSession, {
        tabId,
        url,
        reason: normalizeReason(reason, 'unspecified'),
      }));
      const retryInjectResult = requireInjectionAttemptResult(
        await injectContentScriptFiles(tabId, {
          url,
          reason: `${normalizeReason(reason, 'inject')}:dispatch_ready_retry`,
        }, owner),
        'CONTENT_SCRIPT_READY_RETRY_INJECTION_RESULT_INVALID',
      );
      if (retryInjectResult.ok) {
        const retryReady = await tabContentSessionRegistry.waitForDispatchReady(tabId, { timeoutMs, signal: owner.controller.signal });
        assertReadinessCurrent(owner, 'retry_dispatch_wait');
        if (retryReady) {
          return finalizeEnsureResult(tabId, {
            ok: true,
            reason: null,
            source: 'orchestrator_reinject',
          }, {
            forceInject: !!forceInject,
            recovery: true,
          });
        }
      }

      const retryFailedSession = tabContentSessionRegistry.get(tabId);
      if (retryFailedSession?.status === 'failed') {
        const retryFailedError = requireFailedSessionError(
          retryFailedSession,
          'CONTENT_SCRIPT_RETRY_FAILED_SESSION_ERROR_REQUIRED',
        );
        return finalizeEnsureResult(tabId, {
          ok: false,
          reason: 'content_bootstrap_failed',
          error: retryFailedError,
          source: 'orchestrator',
        }, {
          forceInject: !!forceInject,
          recovery: true,
        });
      }

      if (retryInjectResult.ok) {
        const releaseResult = requireBootstrapInjectionReleaseResult(
          tabContentSessionRegistry.releaseBootstrapInjection(tabId, {
            expectedReason: retryInjectResult.bootstrapInjectionReason,
            expectedGeneration: retryInjectResult.bootstrapInjectionGeneration,
            releaseReason: 'dispatch_ready_timeout',
          }),
        );
        recordDiagnostic('bootstrap_injection_owner_released', {
          tabId,
          releaseReason: 'dispatch_ready_timeout',
          bootstrapInjectionGeneration: retryInjectResult.bootstrapInjectionGeneration,
          released: releaseResult.released,
        });
      }

      return finalizeEnsureResult(tabId, {
        ok: false,
        reason: 'dispatch_ready_timeout',
        error: retryInjectResult.error || null,
        source: 'orchestrator',
      }, {
        forceInject: !!forceInject,
        recovery: retryInjectResult.ok,
      });
    }

    return finalizeEnsureResult(tabId, {
      ok: true,
      reason: null,
      source: 'orchestrator_inject',
    }, {
      forceInject: !!forceInject,
    });
  }

  async function reconcileCleanupDocument(tabId, options, owner) {
    const before = tabContentSessionRegistry.getSnapshot(tabId);
    const expectedDocumentId = owner.cleanupDocumentId;
    const refuse = (reason) => {
      recordDiagnostic('cleanup_document_replacement_refused', {
        tabId, readinessId: owner.id, expectedDocumentId, reason,
      });
      return 'pending';
    };
    if (!expectedDocumentId || before?.session?.documentId !== expectedDocumentId) {
      return refuse('cleanup_document_identity_unavailable');
    }
    const url = requireExactReadyDocumentUrl(options.url, 'cleanupRequestedUrl');
    const navigationRevision = owner.navigationRevision;
    const expectedPermissionRevision = permissionRevision;
    const cleanupError = owner.cleanupError;
    let probeResult;
    let probeFailure = null;
    try {
      probeResult = await scriptingExecuteScriptWithResults({
        target: { tabId },
        injectImmediately: true,
        func: readCurrentDocumentLocationHref,
      });
    } catch (error) {
      probeFailure = { error };
    }
    if (
      readinessOwnersByTab.get(tabId) !== owner
      || owner.evicted
      || owner.navigationRevision !== navigationRevision
      || permissionRevision !== expectedPermissionRevision
      || owner.cleanupError !== cleanupError
      || options.propagationContext?.signal.aborted
    ) return 'cancelled';
    const after = tabContentSessionRegistry.getSnapshot(tabId);
    if (after?.generation !== before.generation || after?.session?.documentId !== expectedDocumentId) {
      return 'cancelled';
    }
    if (probeFailure) {
      recordDiagnostic('cleanup_document_probe_failed', {
        tabId, readinessId: owner.id, expectedDocumentId,
        error: String(probeFailure.error?.code || probeFailure.error?.message || probeFailure.error),
      });
      return 'pending';
    }
    const proof = normalizeUnboundDocumentProbeResult(probeResult, url);
    if (!proof) return refuse('current_document_identity_unproven');
    if (proof.documentId === expectedDocumentId) return refuse('same_document');

    // A native frame-0 result proves the old document has exited. This ends
    // only that document's cleanup gate; it does not claim its cleanup passed.
    invalidateReadinessForNavigation(tabId, { reason: 'cleanup_document_replaced', documentExited: true });
    frameMediaControl?.invalidateTab(tabId, 'FRAME_MEDIA_TOP_DOCUMENT_CHANGED');
    tabContentSessionRegistry.markNavigated(tabId, { url, reason: 'cleanup_document_replaced' });
    recordDiagnostic('cleanup_document_replaced', {
      tabId, readinessId: owner.id, expectedDocumentId, currentDocumentId: proof.documentId,
      generation: before.generation,
    });
    return 'replaced';
  }

  async function ensureContentScriptReady(tabId, options = {}) {
    const propagationContext = requireSettingsPropagationContext(options.propagationContext);
    if (propagationContext?.signal.aborted) {
      return { ok: false, reason: 'content_readiness_cancelled', error: 'SETTINGS_PROPAGATION_SUPERSEDED', source: 'orchestrator' };
    }
    const normalizedTabId = Number(tabId);
    if (!Number.isInteger(normalizedTabId) || normalizedTabId < 0) {
      return {
        ok: false,
        reason: 'invalid_tab_id',
        source: 'orchestrator',
      };
    }
    // A new preparation owns a new readiness obligation. It cannot inherit the
    // old exact cleanup receipt even when it uses the same tab/document.
    revokeScopeRetirement(normalizedTabId);

    const wantsForceInject = options?.forceInject === true;
    const taskKey = wantsForceInject ? 'forceTask' : 'normalTask';
    const existing = readinessOwnersByTab.get(normalizedTabId) || null;
    if (existing?.teardownTask) {
      return waitForReadinessHandoff(normalizedTabId, options, existing, [existing.teardownTask]);
    }
    if (existing?.cleanupError) {
      const disposition = await reconcileCleanupDocument(normalizedTabId, options, existing);
      if (disposition === 'replaced') return ensureContentScriptReady(normalizedTabId, options);
      if (disposition === 'cancelled') {
        return cancelledReadinessResult(normalizedTabId, existing, 'cleanup_probe_invalidated', 'cleanup_document_probe');
      }
      return finalizeEnsureResult(normalizedTabId, {
        ok: false, reason: 'content_cleanup_pending', source: 'orchestrator',
        error: String(existing.cleanupError?.message || existing.cleanupError),
      });
    }
    if (existing && existing.propagationContext !== propagationContext) {
      // Independent callers do not share a revocable settings execution lease.
      return waitForReadinessHandoff(normalizedTabId, options, existing,
        [existing.normalTask, existing.forceTask].filter(Boolean));
    }
    const requestedUrl = typeof options.url === 'string' ? options.url.trim() : '';
    if (existing?.url && requestedUrl && requestedUrl !== existing.url) {
      cancelTabReadiness(normalizedTabId, 'request_url_changed');
    }
    if (existing?.controller.signal.aborted) {
      return waitForReadinessHandoff(normalizedTabId, options, existing,
        [existing.normalTask, existing.forceTask].filter(Boolean));
    }
    if (wantsForceInject && existing?.forceTask) {
      return existing.forceTask;
    }
    if (!wantsForceInject) {
      if (existing?.forceTask) return existing.forceTask;
      if (existing?.normalTask) return existing.normalTask;
    }

    const next = existing || createReadinessOwner(requestedUrl, propagationContext);
    const task = Promise.resolve().then(() => runEnsureContentScriptReady(normalizedTabId, options, next))
      .catch(error => {
        if (!next.controller.signal.aborted || error?.cause !== next.controller.signal.reason) throw error;
        return cancelledReadinessResult(normalizedTabId, next, error.reason, error.phase);
      })
      .finally(() => {
        const current = readinessOwnersByTab.get(normalizedTabId);
        if (current?.[taskKey] !== task) return;
        delete current[taskKey];
        releaseReadinessOwner(normalizedTabId, current);
      });
    next[taskKey] = task;
    readinessOwnersByTab.set(normalizedTabId, next);
    if (!existing && propagationContext) {
      const revoke = () => {
        if (readinessOwnersByTab.get(normalizedTabId) === next) {
          cancelTabReadiness(normalizedTabId, 'settings_superseded');
        }
      };
      propagationContext.signal.addEventListener('abort', revoke, { once: true });
      next.removePropagationListener = () => propagationContext.signal.removeEventListener('abort', revoke);
      if (propagationContext.signal.aborted) revoke();
    }
    return task;
  }

  async function syncManagedContentScripts({
    injectOpenTabs = true,
    reason = 'unspecified',
    throwOnCatchUpFailure = false,
    propagationContext = null,
  } = {}) {
    requireSettingsPropagationContext(propagationContext);
    const normalizedReason = normalizeReason(reason, 'unspecified');
    const shouldInjectOpenTabs = !!injectOpenTabs;
    const expectedPermissionRevision = permissionRevision;
    const assertPermissionsCurrent = (phase) => assertPermissionRevision(expectedPermissionRevision, phase);
    const nextTask = syncChain.then(async () => {
      assertPermissionsCurrent('managed_sync_start');
      throwIfSettingsPropagationCancelled(propagationContext, 'managed_sync_start');
      recordDiagnostic('managed_sync_started', {
        reason: normalizedReason,
        injectOpenTabs: shouldInjectOpenTabs,
        ...settingsPropagationDiagnostic(propagationContext),
      });
      const result = await contentScriptRegistrationSync.syncManagedContentScripts({
        injectOpenTabs: shouldInjectOpenTabs,
        reason: normalizedReason,
        propagationContext,
        assertPermissionsCurrent,
      });
      if (result?.catchUpPlanDiagnostic) {
        recordDiagnostic(
          'managed_sync_catch_up_plan_resolved',
          requireCatchUpPlanDiagnostic(result.catchUpPlanDiagnostic),
        );
      }
      const nextSnapshot = normalizeSyncSnapshot(result, mediaFrameScriptFiles);
      if (propagationContext?.signal.aborted || expectedPermissionRevision !== permissionRevision) {
        // Registration may have completed while being superseded. Keep its
        // catch-up obligation; the next sync re-admits it to current scope.
        pendingCatchUpTabs = normalizeCatchUpTargets([...pendingCatchUpTabs, ...nextSnapshot.catchUpTabs]);
        throwIfSettingsPropagationCancelled(propagationContext, 'registration_settled');
        assertPermissionsCurrent('registration_settled');
      }
      // Retrying a tab is a new admission to current registration scope, not
      // authority inherited from the failed attempt. Reuse this event's live
      // inventory for reconciliation so retries add no second full-tab scan.
      pendingCatchUpTabs = pendingCatchUpTabs.filter((entry) => {
        const retained = nextSnapshot.hasScripting
          && isHostnameInList(getHostname(entry.url), nextSnapshot.registeredDomains);
        if (!retained) recordDiagnostic('catch_up_target_cancelled', {
          tabId: entry.tabId, reason: 'registration_scope_changed',
        });
        return retained;
      });
      let observedTabs = null;
      if (shouldInjectOpenTabs && pendingCatchUpTabs.length > 0) {
        observedTabs = await tabsQuery({});
        if (expectedPermissionRevision !== permissionRevision) {
          pendingCatchUpTabs = normalizeCatchUpTargets([...pendingCatchUpTabs, ...nextSnapshot.catchUpTabs]);
        }
        assertPermissionsCurrent('catch_up_inventory_ready');
        if (!Array.isArray(observedTabs)) throw new Error('CONTENT_SCRIPT_CATCH_UP_TAB_INVENTORY_INVALID');
        const tabsById = new Map(observedTabs.map((tab) => [tab.id, tab]));
        pendingCatchUpTabs = pendingCatchUpTabs.flatMap((entry) => {
          const tab = tabsById.get(entry.tabId);
          const retained = tab && tab.discarded !== true
            && isHostnameInList(getHostname(tab.url), nextSnapshot.registeredDomains);
          if (retained) return [{ tabId: entry.tabId, url: tab.url }];
          recordDiagnostic('catch_up_target_cancelled', {
            tabId: entry.tabId,
            reason: !tab ? 'tab_gone' : tab.discarded === true ? 'tab_discarded' : 'tab_out_of_scope',
          });
          return [];
        });
      }
      const catchUpTargets = shouldInjectOpenTabs
        ? [
          ...pendingCatchUpTabs,
          ...nextSnapshot.catchUpTabs,
        ]
        : [];
      if (shouldInjectOpenTabs) {
        pendingCatchUpTabs = [];
      }
      const injectionSummary = await ensureCatchUpTabsReady(catchUpTargets, normalizedReason, propagationContext, expectedPermissionRevision);
      const failedCatchUpTabs = normalizeCatchUpTargets(injectionSummary.failures);
      if (failedCatchUpTabs.length > 0) {
        pendingCatchUpTabs = failedCatchUpTabs;
      }
      throwIfSettingsPropagationCancelled(propagationContext, 'catch_up_settled');
      assertPermissionsCurrent('catch_up_settled');
      lastSyncSnapshot = {
        ...nextSnapshot,
        catchUpTabs: [...pendingCatchUpTabs],
        injectionSummary,
      };
      await reconcileTrackedSessions(normalizedReason, observedTabs, propagationContext, assertPermissionsCurrent);
      throwIfSettingsPropagationCancelled(propagationContext, 'scope_reconcile_settled');
      assertPermissionsCurrent('scope_reconcile_settled');
      if (failedCatchUpTabs.length > 0) {
        recordDiagnostic('managed_sync_catch_up_readiness_failed', {
          reason: normalizedReason,
          injectOpenTabs: shouldInjectOpenTabs,
          failedTabCount: failedCatchUpTabs.length,
          failedTabIds: failedCatchUpTabs.map((entry) => entry.tabId),
          injectionSummary,
        });
        if (throwOnCatchUpFailure === true) {
          throw createCatchUpReadinessFailureError(injectionSummary, failedCatchUpTabs, normalizedReason);
        }
      }
      const completedInjectionSummary = requireInjectionSummary(lastSyncSnapshot.injectionSummary);
      recordDiagnostic('managed_sync_completed', {
        ...settingsPropagationDiagnostic(propagationContext),
        reason: normalizedReason,
        injectOpenTabs: shouldInjectOpenTabs,
        registeredDomainCount: lastSyncSnapshot.registeredDomains.length,
        missingDomainCount: lastSyncSnapshot.missingDomains.length,
        matchCount: lastSyncSnapshot.matches.length,
        catchUpAttemptedCount: completedInjectionSummary.attemptedCount,
        catchUpSuccessCount: completedInjectionSummary.successCount,
        catchUpFailureCount: completedInjectionSummary.failureCount,
      });
      return lastSyncSnapshot;
    });
    syncChain = nextTask.catch((error) => {
      if (propagationContext?.signal.aborted || permissionCancellations.has(error)) {
        recordDiagnostic('managed_sync_cancelled', {
          ...settingsPropagationDiagnostic(propagationContext), reason: normalizedReason,
          code: error.code, phase: error.phase, expectedPermissionRevision, permissionRevision,
        });
        return null;
      }
      recordManagedSyncFailure(error, {
        reason: normalizedReason,
        injectOpenTabs: shouldInjectOpenTabs,
      });
      return null;
    });
    return nextTask;
  }

  function noteContentBootstrapState(request, sender) {
    const tabId = resolveTrustedSenderTabId(sender);
    if (!Number.isInteger(tabId) || tabId < 0) {
      return null;
    }
    const payload = request?.payload && typeof request.payload === 'object'
      ? request.payload
      : {};
    const bootstrapStatus = typeof payload.status === 'string' && payload.status.trim()
      ? payload.status.trim().toLowerCase()
      : null;
    const bootstrapReason = typeof payload.reason === 'string' && payload.reason.trim()
      ? payload.reason.trim()
      : null;
    const bootstrapError = typeof payload.error === 'string' && payload.error.trim()
      ? payload.error.trim()
      : null;
    const senderUrl = resolveSenderPageUrl(sender);
    const senderDocumentId = resolveSenderDocumentId(sender);
    const previousSession = tabContentSessionRegistry.get(tabId);
    const previousDocumentId = previousSession?.documentId;
    const session = tabContentSessionRegistry.noteBootstrapState(tabId, {
      ...payload,
      documentId: typeof payload.documentId === 'string' && payload.documentId.trim()
        ? payload.documentId.trim()
        : senderDocumentId,
      url: typeof payload.url === 'string' && payload.url.trim()
        ? payload.url.trim()
        : senderUrl,
    });
    if (session && ['documentId', 'attemptId', 'url', 'status', 'startedAt']
      .some(key => session[key] !== previousSession?.[key])) {
      revokeScopeRetirement(tabId);
    }
    if (
      previousDocumentId
      && session?.documentId !== previousDocumentId
      && session?.documentId === senderDocumentId
      && senderDocumentId !== null
      && resolveSenderFrameId(sender) === 0
    ) {
      frameMediaControl?.invalidateTab(tabId, 'FRAME_MEDIA_TOP_DOCUMENT_CHANGED');
      invalidateReadinessForNavigation(tabId, { reason: 'bootstrap_document_replaced', documentExited: true });
    }
    recordDiagnostic('bootstrap_state_observed', buildSessionDiagnostic(session, {
      source: 'content_runtime_message',
      bootstrapStatus,
      bootstrapReason,
      bootstrapError,
      senderDocumentId,
      payloadDocumentId: typeof payload.documentId === 'string' && payload.documentId.trim()
        ? payload.documentId.trim()
        : null,
      payloadDispatchReady: payload.dispatchReady === true,
    }));
    return session;
  }

  function noteContentMediaFrameState(request, sender) {
    const tabId = resolveTrustedSenderTabId(sender);
    const frameId = resolveSenderFrameId(sender);
    if (!Number.isInteger(tabId) || tabId < 0 || frameId === null) {
      return null;
    }
    const payload = request?.payload && typeof request.payload === 'object'
      ? request.payload
      : {};
    const senderUrl = resolveSenderPageUrl(sender);
    const senderDocumentId = resolveSenderDocumentId(sender);
    const session = tabContentSessionRegistry.noteMediaFrameState(tabId, {
      ...payload,
      frameId,
      documentId: typeof payload.documentId === 'string' && payload.documentId.trim()
        ? payload.documentId.trim()
        : senderDocumentId,
      url: typeof payload.url === 'string' && payload.url.trim()
        ? payload.url.trim()
        : senderUrl,
    });
    recordDiagnostic('media_frame_state_observed', buildMediaFrameDiagnostic(session, {
      source: 'content_runtime_message',
      senderDocumentId,
      payloadDocumentId: typeof payload.documentId === 'string' && payload.documentId.trim()
        ? payload.documentId.trim()
        : null,
      payloadReason: typeof payload.reason === 'string' && payload.reason.trim()
        ? payload.reason.trim()
        : null,
    }));
    return session;
  }

  function markTabNavigated(tabId, { url = '', reason = 'navigation' } = {}) {
    frameMediaControl?.invalidateTab(tabId, 'FRAME_MEDIA_TOP_NAVIGATED');
    invalidateReadinessForNavigation(tabId, { documentExited: reason === 'web_navigation_committed' });
    const session = tabContentSessionRegistry.markNavigated(tabId, {
      url,
      reason: normalizeReason(reason, 'navigation'),
    });
    recordDiagnostic('session_marked_stale', buildSessionDiagnostic(session, {
      tabId,
      url,
      reason: normalizeReason(reason, 'navigation'),
    }));
    return session;
  }

  function refreshTabUrl(tabId, {
    url = '',
    reason = 'same_document_navigation',
  } = {}) {
    revokeScopeRetirement(Number(tabId));
    const previousUrl = tabContentSessionRegistry.get(tabId)?.url;
    const session = tabContentSessionRegistry.refreshScope(tabId, {
      url,
      reason: normalizeReason(reason, 'same_document_navigation'),
    });
    if (session && previousUrl !== session.url) {
      const readiness = cancelTabReadiness(tabId, 'same_document_url_changed');
      if (readiness) readiness.navigationRevision += 1;
    }
    recordDiagnostic('session_url_refreshed', buildSessionDiagnostic(session, {
      tabId,
      url,
      reason: normalizeReason(reason, 'same_document_navigation'),
    }));
    return session;
  }

  function evictTab(tabId) {
    revokeScopeRetirement(Number(tabId));
    frameMediaControl?.invalidateTab(tabId, 'FRAME_MEDIA_TAB_REMOVED');
    const readiness = cancelTabReadiness(tabId, 'tab_evicted');
    if (readiness) {
      readiness.evicted = true;
      releaseReadinessOwner(Number(tabId), readiness);
    }
    pendingCatchUpTabs = pendingCatchUpTabs.filter((entry) => entry.tabId !== tabId);
    const session = tabContentSessionRegistry.evict(tabId);
    scopeRetirementRevisionsByTab.delete(Number(tabId));
    recordDiagnostic('session_evicted', buildSessionDiagnostic(session, {
      tabId,
    }));
    return session;
  }

  function getTabSession(tabId) {
    return tabContentSessionRegistry.get(tabId);
  }

  function getTabSessionSnapshot(tabId) {
    return tabContentSessionRegistry.getSnapshot(tabId);
  }

  async function probeExactDocumentLocation({
    tabId,
    documentId,
    url,
  } = {}) {
    const normalizedTabId = requireReadyDocumentUrlRefreshTabId(tabId);
    const normalizedDocumentId = requireReadyDocumentUrlRefreshDocumentId(documentId);
    const normalizedUrl = requireExactReadyDocumentUrl(url);
    let executeResult = null;
    try {
      executeResult = await scriptingExecuteScriptWithResults({
        target: {
          tabId: normalizedTabId,
          documentIds: [normalizedDocumentId],
        },
        injectImmediately: true,
        func: readCurrentDocumentLocationHref,
      });
    } catch (_error) {
      throw createReadyDocumentUrlRefreshError(
        'CONTENT_SCRIPT_READY_DOCUMENT_URL_PROBE_FAILED',
        { probeAttempted: true },
      );
    }
    requireReadyDocumentLocationProbeResult(executeResult, {
      expectedDocumentId: normalizedDocumentId,
      expectedUrl: normalizedUrl,
    });
    return freezeExactDocumentLocationProbeResult({
      tabId: normalizedTabId,
      documentId: normalizedDocumentId,
      url: normalizedUrl,
    });
  }

  async function refreshReadyDocumentUrlFromExactProbe({
    tabId,
    expectedGeneration,
    expectedDocumentId,
    expectedUrl,
    nextUrl,
  } = {}) {
    const normalizedTabId = requireReadyDocumentUrlRefreshTabId(tabId);
    const normalizedExpectedGeneration = requireReadyDocumentUrlRefreshGeneration(
      expectedGeneration,
    );
    const normalizedExpectedDocumentId = requireReadyDocumentUrlRefreshDocumentId(
      expectedDocumentId,
    );
    const normalizedExpectedUrl = requireExactReadyDocumentUrl(expectedUrl, 'expectedUrl');
    const normalizedNextUrl = requireExactReadyDocumentUrl(nextUrl, 'nextUrl');
    if (normalizedExpectedUrl === normalizedNextUrl) {
      throw createReadyDocumentUrlRefreshError(
        'CONTENT_SCRIPT_READY_DOCUMENT_URL_REFRESH_URL_UNCHANGED',
      );
    }

    await probeExactDocumentLocation({
      tabId: normalizedTabId,
      documentId: normalizedExpectedDocumentId,
      url: normalizedNextUrl,
    });
    const probeProof = freezeReadyDocumentUrlRefreshProof({
      probeAttempted: true,
      probeResultCountExact: true,
      probeFrameMatches: true,
      probeDocumentMatches: true,
      probeUrlMatchesRequested: true,
    });
    const refreshResult = tabContentSessionRegistry.compareAndRefreshReadyDocumentUrl(
      normalizedTabId,
      {
        expectedGeneration: normalizedExpectedGeneration,
        expectedDocumentId: normalizedExpectedDocumentId,
        expectedUrl: normalizedExpectedUrl,
        nextUrl: normalizedNextUrl,
      },
    );
    const refreshProof = freezeReadyDocumentUrlRefreshProof({
      ...probeProof,
      sessionRefreshGenerationMatched: refreshResult?.generationMatches === true,
      sessionRefreshStatusReady: refreshResult?.statusReady === true,
      sessionRefreshDocumentMatched: refreshResult?.documentMatches === true,
      sessionRefreshUrlMatchedExpected: refreshResult?.urlMatchesExpected === true,
      sessionRefreshCommitted: refreshResult?.refreshed === true,
      sessionRefreshGenerationAdvanced: Number.isSafeInteger(refreshResult?.afterGeneration)
        && refreshResult.afterGeneration > normalizedExpectedGeneration,
      sessionRefreshDocumentPreserved: refreshResult?.documentPreserved === true,
      sessionRefreshUrlMatchesRequested: refreshResult?.urlMatchesNext === true,
    });
    if (
      refreshResult?.refreshed !== true
      || refreshResult.beforeGeneration !== normalizedExpectedGeneration
      || !refreshProof.sessionRefreshGenerationAdvanced
      || !refreshProof.sessionRefreshDocumentPreserved
      || !refreshProof.sessionRefreshUrlMatchesRequested
    ) {
      throw createReadyDocumentUrlRefreshError(
        'CONTENT_SCRIPT_READY_DOCUMENT_URL_REFRESH_CAS_CONFLICT',
        refreshProof,
      );
    }
    return Object.freeze({
      refreshed: true,
      beforeGeneration: refreshResult.beforeGeneration,
      generation: refreshResult.afterGeneration,
      proof: refreshProof,
    });
  }

  function listTabSessions() {
    return tabContentSessionRegistry.list();
  }

  function getLastSyncSnapshot() {
    const syncSnapshot = requireLastSyncSnapshot(lastSyncSnapshot);
    const injectionSummary = syncSnapshot.injectionSummary === null
      ? null
      : requireInjectionSummary(syncSnapshot.injectionSummary);
    return {
      ...syncSnapshot,
      registeredDomains: [...requireLastSyncSnapshotArray(syncSnapshot, 'registeredDomains')],
      missingDomains: [...requireLastSyncSnapshotArray(syncSnapshot, 'missingDomains')],
      matches: [...requireLastSyncSnapshotArray(syncSnapshot, 'matches')],
      scriptFiles: [...requireLastSyncSnapshotArray(syncSnapshot, 'scriptFiles')],
      mediaFrame: {
        ...syncSnapshot.mediaFrame,
        js: [...syncSnapshot.mediaFrame.js],
        matches: [...syncSnapshot.mediaFrame.matches],
      },
      catchUpTabs: requireLastSyncSnapshotArray(syncSnapshot, 'catchUpTabs')
        .map((entry) => ({ ...entry })),
      injectionSummary: injectionSummary === null
        ? null
        : {
          ...injectionSummary,
          failures: injectionSummary.failures.map((entry) => ({ ...entry })),
        },
    };
  }

  function getDiagnosticsSnapshot({ tabId = null, limit = 40 } = {}) {
    const normalizedTabId = normalizeDiagnosticsTabId(tabId);
    const diagnosticsMeta = diagnostics.getMeta();
    const currentSession = normalizedTabId === null ? null : getTabSession(normalizedTabId);
    return {
      ...diagnosticsMeta,
      tabId: normalizedTabId,
      currentSession,
      sessions: normalizedTabId !== null
        ? (currentSession ? [currentSession] : [])
        : listTabSessions(),
      mediaFrameSessions: normalizedTabId !== null
        ? tabContentSessionRegistry.listMediaFrameSessions({ tabId: normalizedTabId })
        : tabContentSessionRegistry.listMediaFrameSessions(),
      lastSyncSnapshot: getLastSyncSnapshot(),
      events: diagnostics.list({ tabId: normalizedTabId, limit }),
    };
  }

  async function executeVideoSkipMainWorldCommand({
    tabId,
    frameId,
    pageUrl,
    command,
    targetTime,
    mediaToken,
  } = {}) {
    const target = normalizeVideoSkipMainWorldTarget({ tabId, frameId, pageUrl });
    const normalizedCommand = createVideoSkipMainWorldCommandRequest({ command, targetTime, mediaToken });
    const injectionRequest = Object.freeze({
      ...normalizedCommand,
      expectedHostname: target.hostname,
    });
    const executeResult = await scriptingExecuteScriptWithResults({
      target: {
        tabId: target.tabId,
        frameIds: [target.frameId],
      },
      world: 'MAIN',
      func: executeVideoSkipYouTubeCommandInMainWorld,
      args: [injectionRequest],
    });
    const result = requireVideoSkipExecuteScriptResult(
      executeResult,
      normalizedCommand.command,
    );
    if (result.ok !== true) {
      throw createContentInjectionResultError(
        `VIDEO_SKIP_MAIN_WORLD_COMMAND_FAILED:${result.reason}`,
      );
    }
    recordDiagnostic('video_skip_main_world_command_applied', {
      tabId: target.tabId,
      frameId: target.frameId,
      hostname: target.hostname,
      command: normalizedCommand.command,
    });
    return result;
  }

  return {
    getFrameMediaControl: () => {
      if (!frameMediaControl) throw new Error('FRAME_MEDIA_CONTROL_OWNER_REQUIRED');
      return frameMediaControl;
    },
    invalidatePermissions,
    ensureContentScriptReady,
    evictTab,
    executeVideoSkipMainWorldCommand,
    getDiagnosticsSnapshot,
    getLastSyncSnapshot,
    getTabSession,
    getTabSessionSnapshot,
    readContentScopeRetirement,
    listTabSessions,
    markTabNavigated,
    probeExactDocumentLocation,
    refreshTabUrl,
    noteContentBootstrapState,
    noteContentMediaFrameState,
    refreshReadyDocumentUrlFromExactProbe,
    syncManagedContentScripts,
    teardownContentForTab,
  };
}
