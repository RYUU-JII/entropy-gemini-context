import { requireSettingsPropagationContext, settingsPropagationDiagnostic, throwIfSettingsPropagationCancelled } from '../../settings/contracts/settingsPropagationContext.js';
import {
  requireForegroundDispatchSource,
  settleForegroundDispatchCancellation,
} from './protocol/dispatch/ProtectionForegroundDispatch.js';
import {
  readStoredThemePreference,
} from '../../../themes/core/state/themePreferenceRepository.js';
import { MESSAGE_TYPES } from '../../../platform/messaging/messageTypes.js';
import { readActiveNudgeOwnerForTab } from '../../nudge/runtime/session/nudgeSessionOwnerState.js';
import { createProtectionGoalEpisodeInvalidator } from './protocol/dispatch/ProtectionGoalEpisodeInvalidator.js';
import { CYCLE_SETTINGS_KEY } from '../../../platform/storage/runtime/cycleStateStorageContracts.js';
import {
  DEFAULT_THEME_ID,
  assertCanonicalThemeId,
  canonicalizeThemeIdInput,
} from '../../../themes/core/ids.js';
import {
  getHostname,
} from '../../../lib/index.js';
import {
  assertNudgeRuntimeThemeId,
} from '../../nudge/runtime/nudgeRuntimeContext.js';
import {
  createProtectionGateDispatchBridge,
} from './protocol/dispatch/ProtectionGateDispatchBridge.js';
import {
  createProtectionNudgeDispatchContext,
} from './protocol/dispatch/ProtectionNudgeDispatchContext.js';
import {
  createProtectionNudgeDispatchRunner,
} from './protocol/dispatch/ProtectionNudgeDispatchRunner.js';
import {
  createProtectionNudgeTeardownCoordinator,
} from './protocol/dispatch/ProtectionNudgeTeardownCoordinator.js';
import {
  createProtectionDispatchPlanner,
  normalizeChangedKeys as normalizeDispatchChangedKeys,
} from './protocol/dispatch/ProtectionDispatchPlanner.js';
import {
  createProtectionDispatchPermissionGate,
} from './protocol/dispatch/ProtectionDispatchPermissionGate.js';
import {
  buildProtectionDispatchPayload,
} from './protocol/dispatch/ProtectionDispatchPayloadBuilder.js';
import {
  createProtectionDispatchStateLedger,
} from './protocol/dispatch/ProtectionDispatchStateLedger.js';
import {
  createProtectionDispatchSerialQueue,
  isProtectionDispatchSerialQueueError,
} from './protocol/dispatch/ProtectionDispatchSerialQueue.js';
import {
  createProtectionTabLifecycleLedger,
} from './protocol/dispatch/ProtectionTabLifecycleLedger.js';
import {
  claimProtectionTabUpdatedIngressReceipt,
  createProtectionTabUpdatedDispatchOutcome,
} from './protocol/dispatch/ProtectionTabUpdatedDispatchProtocol.js';
import {
  formatDispatchDiagnostic,
  ensureProtectionDispatchTransactionReady,
  isDispatchReadyContentSession,
  isProtectionDispatchDocumentIdentityError,
  isProvenProtectionDispatchDocumentOvertaken,
  isProvenProtectionDispatchHistoryContextOvertaken,
  isProvenProtectionDispatchHistoryOvertookPendingTabUpdate,
  isProvenProtectionDispatchPreAckHistoryCancellation,
  isWebUrl,
  requireExpectedContentDocumentId,
  requireProtectionDispatchAbortSignal,
  resolveProtectionDispatcherBrowserPort,
  sendMessageWithRecovery,
  throwIfProtectionDispatchAborted,
  toErrorMessage,
} from './protocol/dispatch/ProtectionDispatchTransport.js';
import {
  createDispatchTransactionError,
  createOwnedDispatchLifecycleError,
  readmittedDispatchInspection,
  refusedDispatchInspection,
  settledDispatchInspection,
  hasExactEnumerableKeys,
  isOwnedDispatchLifecycleError,
  isPlainObject,
  protectionDispatchLifecycleErrorBrand,
  requireAtomicContentSessionSnapshot,
  resolveExactDispatchDocumentId,
  resolveExactDispatchHistoryUrl,
  resolveReadyContentDocumentId,
} from './protocol/dispatch/ProtectionDispatchLifecyclePrimitives.js';
import {
  createProtectionDispatchSettlementProofs,
  SUPERSEDABLE_NAVIGATION_QUEUE_REASONS,
} from './protocol/dispatch/ProtectionDispatchSettlementProofs.js';
import {
  createProtectionLiveAdmissionReconciliation,
} from './protocol/dispatch/ProtectionLiveAdmissionReconciliation.js';
import {
  buildTabUpdatedSettlementDiagnosticPayload,
} from './protocol/dispatch/ProtectionDispatchSettlementDiagnostics.js';

function resolveFeedFlowRuntimeSource({
  tabId,
  hostname,
  contentSession,
} = {}) {
  if (!isDispatchReadyContentSession(contentSession)) return null;
  const documentId = typeof contentSession?.documentId === 'string'
    ? contentSession.documentId.trim()
    : '';
  if (!documentId) {
    throw new Error('PROTECTION_FEED_FLOW_CONTENT_DOCUMENT_ID_REQUIRED');
  }
  return {
    tabId,
    documentId,
    hostname,
  };
}

// The three History overtakes differ only in which proof predicate attests them, which
// receipt facts that predicate needs, and which side of the History transition the
// receipt's session URL must equal. Everything else about them was identical.
const HISTORY_OVERTAKE_PROOFS = Object.freeze([
  Object.freeze({
    isProven: isProvenProtectionDispatchHistoryOvertookPendingTabUpdate,
    subject: (receipt) => ({
      tabId: receipt.tabId,
      requestedUrl: receipt.requestedUrl,
      ingressSequence: receipt.ingressSequence,
      status: receipt.status,
    }),
    sessionUrlField: 'historyPreviousUrl',
    disposition: 'protection_history_pending_tab_update_superseded',
    diagnosticReason: 'exact_history_overtook_pending_tab_update',
  }),
  Object.freeze({
    isProven: isProvenProtectionDispatchPreAckHistoryCancellation,
    subject: (receipt) => ({
      tabId: receipt.tabId,
      requestedUrl: receipt.requestedUrl,
      ingressSequence: receipt.ingressSequence,
      status: receipt.status,
    }),
    sessionUrlField: 'historyPreviousUrl',
    disposition: 'protection_history_pre_ack_superseded',
    diagnosticReason: 'exact_history_pre_ack_overtake',
  }),
  Object.freeze({
    isProven: isProvenProtectionDispatchHistoryContextOvertaken,
    subject: (receipt) => ({
      tabId: receipt.tabId,
      requestedUrl: receipt.requestedUrl,
      observedAt: receipt.observedAt,
      ingressSequence: receipt.ingressSequence,
      status: receipt.status,
    }),
    sessionUrlField: 'historyCurrentUrl',
    disposition: 'protection_history_context_superseded',
    diagnosticReason: 'exact_delayed_history_context_overtake',
  }),
]);

// Two diagnostic reasons double as escalation control flow: the direct inspector emits
// them, and the escalation table branches on them. Naming them keeps a rename from
// silently changing dispatch behavior while leaving them plain strings on the wire.
const SETTLEMENT_REASON_LIFECYCLE_PROOF_NOT_EXACT = 'lifecycle_proof_not_exact';
const SETTLEMENT_REASON_DOCUMENT_RECEIPT_IDENTITY_MISMATCH = 'document_receipt_identity_mismatch';

const ACTIVE_BOOTSTRAP_DOCUMENT_REPLACEMENT_PHASES = new Set([
  'after_runtime',
  'after_content_send',
  'gate_mutation:gate_bridge_after_theme_resolution',
  'gate_mutation:gate_controller_after_session_read',
  'after_unchanged_bootstrap_refresh',
]);

const ACTIVE_BOOTSTRAP_DOCUMENT_REPLACEMENT_STATUS_RANK = Object.freeze({
  bootstrapping: 0,
  receiver_ready: 1,
  active: 2,
});

const EXACT_DOCUMENT_LOCATION_PROBE_RESULT_FIELDS = Object.freeze([
  'documentId',
  'frameId',
  'tabId',
  'url',
]);

function requireDispatchTransactionUrl(value, errorCode) {
  const url = typeof value === 'string' ? value.trim() : '';
  if (!isWebUrl(url)) {
    throw createDispatchTransactionError(errorCode);
  }
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      throw createDispatchTransactionError(errorCode);
    }
    return parsed.href;
  } catch (error) {
    if (error?.code === errorCode) throw error;
    throw createDispatchTransactionError(errorCode);
  }
}

function resolvePositiveDispatchAttemptId(value) {
  return Number.isSafeInteger(value) && value > 0 ? value : null;
}

function resolvePositiveDispatchStartedAt(value) {
  return Number.isSafeInteger(value) && value > 0 ? value : null;
}

function resolveActiveBootstrapReplacementStatusRank(value) {
  return Object.prototype.hasOwnProperty.call(
    ACTIVE_BOOTSTRAP_DOCUMENT_REPLACEMENT_STATUS_RANK,
    value,
  )
    ? ACTIVE_BOOTSTRAP_DOCUMENT_REPLACEMENT_STATUS_RANK[value]
    : null;
}

function isExactInvalidDocumentIdListWithout(value, documentId) {
  if (!Array.isArray(value) || value.length > 8) return false;
  const seen = new Set();
  for (const entry of value) {
    const exactDocumentId = resolveExactDispatchDocumentId(entry);
    if (!exactDocumentId || exactDocumentId === documentId || seen.has(exactDocumentId)) {
      return false;
    }
    seen.add(exactDocumentId);
  }
  return true;
}

function resolveActiveBootstrapReplacementSnapshot(snapshot, {
  tabId,
  requestedUrl,
} = {}) {
  const session = snapshot?.session || null;
  const documentId = resolveExactDispatchDocumentId(session?.documentId);
  const url = resolveExactDispatchHistoryUrl(session?.url);
  const attemptId = resolvePositiveDispatchAttemptId(session?.attemptId);
  const startedAt = resolvePositiveDispatchStartedAt(session?.startedAt);
  const statusRank = resolveActiveBootstrapReplacementStatusRank(session?.status);
  if (
    !documentId
    || url !== requestedUrl
    || session?.tabId !== tabId
    || attemptId === null
    || startedAt === null
    || statusRank === null
    || !isExactInvalidDocumentIdListWithout(session?.invalidDocumentIds, documentId)
  ) {
    return null;
  }
  return Object.freeze({
    generation: snapshot.generation,
    tabId,
    documentId,
    url,
    attemptId,
    startedAt,
    status: session.status,
    statusRank,
    invalidDocumentIds: [...session.invalidDocumentIds],
  });
}

function isExactDocumentLocationProbeResult(value, expected) {
  return isPlainObject(value)
    && Object.isFrozen(value)
    && hasExactEnumerableKeys(value, EXACT_DOCUMENT_LOCATION_PROBE_RESULT_FIELDS)
    && value.tabId === expected.tabId
    && value.frameId === 0
    && value.documentId === expected.documentId
    && value.url === expected.url;
}

function describeBroadcastError(error, fallbackCode = 'PROTECTION_BROADCAST_FAILED') {
  return {
    code: typeof error?.code === 'string' && error.code.trim()
      ? error.code.trim()
      : fallbackCode,
    message: toErrorMessage(error || fallbackCode),
    name: typeof error?.name === 'string' && error.name.trim()
      ? error.name.trim()
      : 'Error',
  };
}

function formatBroadcastError(error, fallbackCode) {
  const details = describeBroadcastError(error, fallbackCode);
  return `code=${details.code} name=${details.name} message=${details.message}`;
}

function formatLogList(values = []) {
  return JSON.stringify(Array.isArray(values) ? values : []);
}

function buildBroadcastTargetFailure(tab, {
  error = null,
  sendResult = null,
  phase = 'protection_update',
} = {}) {
  const isTargetException = !!error;
  const isNudgeStopPhase = phase === 'nudge_stop';
  const failureError = error || sendResult?.error || 'PROTECTION_BROADCAST_TARGET_NOT_ACKNOWLEDGED';
  const details = describeBroadcastError(
    failureError,
    isNudgeStopPhase
      ? (
        isTargetException
          ? 'PROTECTION_NUDGE_STOP_TARGET_EXCEPTION'
          : 'PROTECTION_NUDGE_STOP_TARGET_NOT_ACKNOWLEDGED'
      )
      : (
        isTargetException
          ? 'PROTECTION_BROADCAST_TARGET_EXCEPTION'
          : 'PROTECTION_BROADCAST_TARGET_NOT_ACKNOWLEDGED'
      ),
  );
  return {
    tabId: Number.isInteger(Number(tab?.id)) ? Number(tab.id) : null,
    url: typeof tab?.url === 'string' && tab.url.trim() ? tab.url.trim() : null,
    code: details.code,
    message: details.message,
    reason: isNudgeStopPhase
      ? (
        isTargetException
          ? 'nudge_stop_exception'
          : (sendResult?.diagnostic?.reason || 'nudge_stop_not_acknowledged')
      )
      : (
        isTargetException
          ? 'target_exception'
          : (sendResult?.diagnostic?.reason || 'content_not_acknowledged')
      ),
  };
}

function classifyBroadcastTargetResult(tab, result) {
  if (result?.sendResult?.ok === true) {
    return { status: 'acknowledged' };
  }
  if (result?.sendResult?.ok === false) {
    return {
      status: 'failed',
      failure: buildBroadcastTargetFailure(tab, { sendResult: result.sendResult }),
    };
  }
  if (result?.skipped || result?.handled) {
    return { status: 'skipped' };
  }
  return {
    status: 'failed',
    failure: buildBroadcastTargetFailure(tab, {
      error: new Error('PROTECTION_BROADCAST_TARGET_RESULT_INVALID'),
    }),
  };
}

function buildBroadcastSummary(mode, targetOutcomes = []) {
  const outcomes = Array.isArray(targetOutcomes) ? targetOutcomes : [];
  const failures = outcomes
    .filter((outcome) => outcome?.status === 'failed' && outcome.failure)
    .map((outcome) => outcome.failure);
  const acknowledgedCount = outcomes.filter((outcome) => outcome?.status === 'acknowledged').length;
  const skippedCount = outcomes.filter((outcome) => outcome?.status === 'skipped').length;
  return {
    success: failures.length === 0,
    mode,
    attemptedCount: outcomes.length,
    acknowledgedCount,
    skippedCount,
    failedCount: failures.length,
    failures,
  };
}

function formatBroadcastSummary(summary) {
  const failurePreview = Array.isArray(summary?.failures)
    ? summary.failures.slice(0, 8)
    : [];
  return [
    `success=${summary?.success === true ? 'true' : 'false'}`,
    `mode=${summary?.mode || 'unknown'}`,
    `attempted=${Number(summary?.attemptedCount) || 0}`,
    `acknowledged=${Number(summary?.acknowledgedCount) || 0}`,
    `skipped=${Number(summary?.skippedCount) || 0}`,
    `failed=${Number(summary?.failedCount) || 0}`,
    `failures=${JSON.stringify(failurePreview)}`,
  ].join(' ');
}

function requireProtectionDispatcherOwnerMethod(owner, methodName, errorCode) {
  if (!owner || typeof owner[methodName] !== 'function') {
    throw new Error(errorCode);
  }
  return owner[methodName].bind(owner);
}

function resolveContentScriptOrchestratorOwner(contentScriptOrchestrator) {
  return {
    ensureContentScriptReady: requireProtectionDispatcherOwnerMethod(
      contentScriptOrchestrator,
      'ensureContentScriptReady',
      'PROTECTION_DISPATCHER_CONTENT_ORCHESTRATOR_REQUIRED',
    ),
    getTabSession: requireProtectionDispatcherOwnerMethod(
      contentScriptOrchestrator,
      'getTabSession',
      'PROTECTION_DISPATCHER_CONTENT_ORCHESTRATOR_REQUIRED',
    ),
    getTabSessionSnapshot: requireProtectionDispatcherOwnerMethod(
      contentScriptOrchestrator,
      'getTabSessionSnapshot',
      'PROTECTION_DISPATCHER_CONTENT_ORCHESTRATOR_REQUIRED',
    ),
    readContentScopeRetirement: requireProtectionDispatcherOwnerMethod(
      contentScriptOrchestrator,
      'readContentScopeRetirement',
      'PROTECTION_DISPATCHER_CONTENT_ORCHESTRATOR_REQUIRED',
    ),
    probeExactDocumentLocation: requireProtectionDispatcherOwnerMethod(
      contentScriptOrchestrator,
      'probeExactDocumentLocation',
      'PROTECTION_DISPATCHER_CONTENT_ORCHESTRATOR_REQUIRED',
    ),
    refreshReadyDocumentUrlFromExactProbe: requireProtectionDispatcherOwnerMethod(
      contentScriptOrchestrator,
      'refreshReadyDocumentUrlFromExactProbe',
      'PROTECTION_DISPATCHER_CONTENT_ORCHESTRATOR_REQUIRED',
    ),
    markTabNavigated: requireProtectionDispatcherOwnerMethod(
      contentScriptOrchestrator,
      'markTabNavigated',
      'PROTECTION_DISPATCHER_CONTENT_ORCHESTRATOR_REQUIRED',
    ),
    evictTab: requireProtectionDispatcherOwnerMethod(
      contentScriptOrchestrator,
      'evictTab',
      'PROTECTION_DISPATCHER_CONTENT_ORCHESTRATOR_REQUIRED',
    ),
  };
}

function isPermissionMissingReason(reason) {
  return reason === 'missing_host_permission' || reason === 'missing_scripting_permission';
}

function shouldSkipNudgeStopForProtectionResult(result) {
  return !!result?.handled || isPermissionMissingReason(result?.skipped);
}

function assertExpectedDispatchDocument(
  tabId,
  session,
  expectedDocumentId,
  phase,
  lifecycleContext = {},
) {
  if (expectedDocumentId === null) return;
  const currentDocumentId = resolveReadyContentDocumentId(session);
  if (currentDocumentId === expectedDocumentId) return;
  throw createOwnedDispatchLifecycleError(
    'PROTECTION_DISPATCH_EXPECTED_DOCUMENT_STALE',
    {
      phase,
      tabId,
      ...lifecycleContext,
      expectedDocumentId,
      currentDocumentId,
    },
  );
}

function requireCurrentDispatchDocument(result, currentSession) {
  if (result?.ok !== true) return result;
  const dispatchDocumentId = typeof result.dispatchDocumentId === 'string'
    ? result.dispatchDocumentId.trim()
    : '';
  if (!dispatchDocumentId) {
    const error = new Error('PROTECTION_UPDATE_ACK_DOCUMENT_ID_REQUIRED');
    error.code = 'PROTECTION_UPDATE_ACK_DOCUMENT_ID_REQUIRED';
    return {
      ...result,
      ok: false,
      error,
      diagnostic: {
        ...(isPlainObject(result?.diagnostic) ? result.diagnostic : {}),
        reason: 'content_ack_document_id_missing',
      },
    };
  }
  const currentDocumentId = resolveReadyContentDocumentId(currentSession);
  if (currentDocumentId === dispatchDocumentId) return result;
  const error = new Error('PROTECTION_UPDATE_ACK_DOCUMENT_STALE');
  error.code = 'PROTECTION_UPDATE_ACK_DOCUMENT_STALE';
  return {
    ...result,
    ok: false,
    error,
    diagnostic: {
      ...(isPlainObject(result?.diagnostic) ? result.diagnostic : {}),
      reason: 'content_ack_document_stale',
    },
  };
}

const PROTECTION_UPDATE_ACK_KEYS = Object.freeze([
  'expectedBaseRevision',
  'expectedRevision',
  'ok',
  'receivedBaseRevision',
  'receivedRevision',
  'source',
  'staleIgnored',
  'staleReason',
  'traceId',
]);
const PROTECTION_UPDATE_APPLIED_ACK_SOURCES = new Set([
  'envelope_v2_patch',
  'envelope_v2_snapshot',
]);
const PROTECTION_UPDATE_STALE_ACK_REASONS = Object.freeze({
  PATCH_STALE_BASE_REVISION: 'PATCH_STALE_BASE_REVISION',
  PATCH_STALE_REVISION: 'PATCH_STALE_REVISION',
  SNAPSHOT_STALE_REVISION: 'SNAPSHOT_STALE_REVISION',
});
function requireExactProtectionUpdateAcknowledgementShape(response) {
  if (!isPlainObject(response)) {
    throw new Error('PROTECTION_UPDATE_ACK_SHAPE_INVALID');
  }
  const keys = Reflect.ownKeys(response);
  if (
    keys.length !== PROTECTION_UPDATE_ACK_KEYS.length
    || keys.some((key) => (
      typeof key !== 'string'
      || !PROTECTION_UPDATE_ACK_KEYS.includes(key)
      || !Object.prototype.propertyIsEnumerable.call(response, key)
      || Object.getOwnPropertyDescriptor(response, key)?.get
      || Object.getOwnPropertyDescriptor(response, key)?.set
    ))
  ) {
    throw new Error('PROTECTION_UPDATE_ACK_SHAPE_INVALID');
  }
  if (response.ok !== true || typeof response.staleIgnored !== 'boolean') {
    throw new Error('PROTECTION_UPDATE_ACK_STATE_INVALID');
  }
  if (
    response.traceId !== null
    && (typeof response.traceId !== 'string' || !response.traceId.trim())
  ) {
    throw new Error('PROTECTION_UPDATE_ACK_TRACE_INVALID');
  }
}

function requireStaleRevisionPair(expected, received, errorCode) {
  if (
    !Number.isSafeInteger(expected)
    || expected < 1
    || !Number.isSafeInteger(received)
    || received < 0
    || received >= expected
  ) {
    throw new Error(errorCode);
  }
  return expected - 1;
}

function validateProtectionUpdateAcknowledgement(response) {
  requireExactProtectionUpdateAcknowledgementShape(response);
  if (response.staleIgnored === false) {
    if (
      !PROTECTION_UPDATE_APPLIED_ACK_SOURCES.has(response.source)
      || response.staleReason !== null
      || response.expectedBaseRevision !== null
      || response.receivedBaseRevision !== null
      || response.expectedRevision !== null
      || response.receivedRevision !== null
    ) {
      throw new Error('PROTECTION_UPDATE_APPLIED_ACK_INVALID');
    }
    return null;
  }

  if (response.source !== 'envelope_v2_stale_ignored') {
    throw new Error('PROTECTION_UPDATE_STALE_ACK_SOURCE_INVALID');
  }
  if (!Object.values(PROTECTION_UPDATE_STALE_ACK_REASONS).includes(response.staleReason)) {
    throw new Error('PROTECTION_UPDATE_STALE_ACK_REASON_INVALID');
  }

  if (response.staleReason === PROTECTION_UPDATE_STALE_ACK_REASONS.SNAPSHOT_STALE_REVISION) {
    if (response.expectedBaseRevision !== null || response.receivedBaseRevision !== null) {
      throw new Error('PROTECTION_UPDATE_STALE_ACK_BASE_REVISION_UNEXPECTED');
    }
    return requireStaleRevisionPair(
      response.expectedRevision,
      response.receivedRevision,
      'PROTECTION_UPDATE_STALE_ACK_REVISION_INVALID',
    );
  }

  if (
    !Number.isSafeInteger(response.expectedBaseRevision)
    || response.expectedBaseRevision < 0
    || !Number.isSafeInteger(response.receivedBaseRevision)
    || response.receivedBaseRevision < 0
  ) {
    throw new Error('PROTECTION_UPDATE_STALE_ACK_BASE_REVISION_INVALID');
  }
  if (response.staleReason === PROTECTION_UPDATE_STALE_ACK_REASONS.PATCH_STALE_BASE_REVISION) {
    if (
      response.receivedBaseRevision >= response.expectedBaseRevision
      || response.expectedRevision !== null
      || response.receivedRevision !== null
    ) {
      throw new Error('PROTECTION_UPDATE_STALE_ACK_BASE_REVISION_INVALID');
    }
    return response.expectedBaseRevision;
  }

  const receiverRevisionFloor = requireStaleRevisionPair(
    response.expectedRevision,
    response.receivedRevision,
    'PROTECTION_UPDATE_STALE_ACK_REVISION_INVALID',
  );
  if (
    response.receivedBaseRevision !== response.expectedBaseRevision
    || response.expectedBaseRevision !== receiverRevisionFloor
  ) {
    throw new Error('PROTECTION_UPDATE_STALE_ACK_REVISION_MISMATCH');
  }
  return receiverRevisionFloor;
}

function requireProtectionUpdateAcknowledgement(result) {
  if (result?.ok !== true) return result;
  try {
    const receiverRevisionFloor = validateProtectionUpdateAcknowledgement(result.response);
    if (receiverRevisionFloor === null) return result;
      const error = new Error('PROTECTION_UPDATE_ACK_STALE');
      error.code = 'PROTECTION_UPDATE_ACK_STALE';
      return {
        ...result,
        ok: false,
        error,
        diagnostic: {
          ...(isPlainObject(result?.diagnostic) ? result.diagnostic : {}),
          reason: 'content_ack_stale',
          receiverRevisionFloor,
          staleReason: result.response.staleReason,
        },
      };
  } catch (error) {
    const contractError = error.message;
    const acknowledgementError = new Error('PROTECTION_UPDATE_ACK_INVALID');
    acknowledgementError.code = 'PROTECTION_UPDATE_ACK_INVALID';
    return {
      ...result,
      ok: false,
      error: acknowledgementError,
      diagnostic: {
        ...(isPlainObject(result?.diagnostic) ? result.diagnostic : {}),
        reason: 'content_ack_invalid',
        contractError,
      },
    };
  }
}

function readValidatedStaleReceiverRevisionFloor(result) {
  const sendResult = result?.sendResult;
  if (
    sendResult?.ok !== false
    || sendResult?.error?.code !== 'PROTECTION_UPDATE_ACK_STALE'
    || sendResult?.diagnostic?.reason !== 'content_ack_stale'
  ) {
    return null;
  }
  const responseFloor = validateProtectionUpdateAcknowledgement(sendResult.response);
  const diagnosticFloor = sendResult.diagnostic.receiverRevisionFloor;
  if (
    !Number.isSafeInteger(responseFloor)
    || responseFloor < 0
    || diagnosticFloor !== responseFloor
    || sendResult.diagnostic.staleReason !== sendResult.response.staleReason
  ) {
    throw new Error('PROTECTION_UPDATE_STALE_RETRY_EVIDENCE_INVALID');
  }
  return responseFloor;
}

function requireNudgeStopAcknowledgement(result) {
  if (result?.ok !== true) return result;
  if (isPlainObject(result.response) && result.response.ok === true) return result;
  const error = new Error('PROTECTION_NUDGE_STOP_ACK_INVALID');
  error.code = 'PROTECTION_NUDGE_STOP_ACK_INVALID';
  return {
    ...result,
    ok: false,
    error,
  };
}

async function readCanonicalProtectionThemePreference(
  readThemePreference,
  fallbackThemeId = DEFAULT_THEME_ID,
) {
  if (typeof readThemePreference !== 'function') {
    throw new Error('PROTECTION_DISPATCHER_THEME_READER_REQUIRED');
  }
  const canonicalFallbackThemeId = assertCanonicalThemeId(
    canonicalizeThemeIdInput(fallbackThemeId, DEFAULT_THEME_ID),
    'protection dispatcher theme fallback',
  );
  const rawThemeId = await readThemePreference(canonicalFallbackThemeId);
  const canonicalThemeId = canonicalizeThemeIdInput(rawThemeId, '');
  if (!canonicalThemeId) {
    return assertNudgeRuntimeThemeId(
      rawThemeId,
      'protection dispatcher stored theme preference',
    );
  }
  return assertNudgeRuntimeThemeId(
    assertCanonicalThemeId(
      canonicalThemeId,
      'protection dispatcher canonical theme preference',
    ),
    'protection dispatcher nudge theme preference',
  );
}

export function createProtectionDispatcher({
  interventionAdmission,
  readProfileGeneration,
  settingsService,
  settingsCache,
  resolveProtectionRuntime,
  getGlobalCapState,
  mapWithConcurrency,
  runtimeLanguageStore,
  contentRuntimeDiagnostics,
  contentScriptOrchestrator,
  sentinelProtocolTimeline,
  frictionBootstrapCoordinator,
  gateInterstitialController,
  readThemePreference = readStoredThemePreference,
  abortNudgesForTab,
  scheduleNudgeTerminalOutboxDrain,
  browserPort,
}) {
  const ensureSettingsCache = requireProtectionDispatcherOwnerMethod(
    settingsService,
    'ensureSettingsCache',
    'PROTECTION_DISPATCHER_SETTINGS_OWNER_REQUIRED',
  );
  const getSettingsCache = requireProtectionDispatcherOwnerMethod(
    settingsService,
    'getSettingsCache',
    'PROTECTION_DISPATCHER_SETTINGS_OWNER_REQUIRED',
  );
  const mergeNudgeConfig = requireProtectionDispatcherOwnerMethod(
    settingsService,
    'mergeNudgeConfig',
    'PROTECTION_DISPATCHER_SETTINGS_OWNER_REQUIRED',
  );
  const contentScriptRuntime = resolveContentScriptOrchestratorOwner(contentScriptOrchestrator);
  const recordContentRuntimeDiagnosticOwner = requireProtectionDispatcherOwnerMethod(
    contentRuntimeDiagnostics,
    'record',
    'PROTECTION_DISPATCHER_CONTENT_DIAGNOSTICS_OWNER_REQUIRED',
  );
  const recordSentinelTimelineOwner = requireProtectionDispatcherOwnerMethod(
    sentinelProtocolTimeline,
    'record',
    'PROTECTION_DISPATCHER_SENTINEL_TIMELINE_OWNER_REQUIRED',
  );
  if (!isPlainObject(settingsCache)) {
    throw new Error('PROTECTION_DISPATCHER_SETTINGS_CACHE_REQUIRED');
  }
  if (!runtimeLanguageStore || typeof runtimeLanguageStore.get !== 'function') {
    throw new Error('PROTECTION_DISPATCHER_RUNTIME_LANGUAGE_STORE_REQUIRED');
  }
  if (typeof abortNudgesForTab !== 'function') {
    throw new Error('PROTECTION_DISPATCHER_NUDGE_TEARDOWN_OWNER_REQUIRED');
  }
  if (typeof scheduleNudgeTerminalOutboxDrain !== 'function') {
    throw new Error('PROTECTION_DISPATCHER_NUDGE_TERMINAL_SCHEDULER_REQUIRED');
  }

  const dispatchStateLedger = createProtectionDispatchStateLedger();
  const dispatchSerialQueue = createProtectionDispatchSerialQueue();
  const tabLifecycleLedger = createProtectionTabLifecycleLedger();

  const settlementProofs = createProtectionDispatchSettlementProofs({
    contentScriptRuntime,
    tabLifecycleLedger,
  });
  const {
    createProvenPreAckHistoryCancellation,
    createProvenPendingTabUpdateHistoryQueueInvalidation,
    createProvenPendingTabUpdateCommittedQueueInvalidation,
    createProvenSupersededNavigationQueueInvalidation,
  } = settlementProofs;

  const dispatchPlanner = createProtectionDispatchPlanner();
  const resolvedBrowserPort = resolveProtectionDispatcherBrowserPort(browserPort);
  const goalEpisodeInvalidator = createProtectionGoalEpisodeInvalidator({ interventionAdmission, browserPort,
    scheduleTerminalEffects: scheduleNudgeTerminalOutboxDrain });
  const readCanonicalThemePreference = (fallbackThemeId = DEFAULT_THEME_ID) => (
    readCanonicalProtectionThemePreference(readThemePreference, fallbackThemeId)
  );
  const gateDispatchBridge = createProtectionGateDispatchBridge({
    gateInterstitialController,
    frictionBootstrapCoordinator,
    readThemePreference: readCanonicalThemePreference,
    recordDiagnostic: recordContentRuntimeDiagnosticOwner,
  });
  const dispatchPermissionGate = createProtectionDispatchPermissionGate({
    browserPort: resolvedBrowserPort,
    recordDiagnostic: recordContentRuntimeDiagnosticOwner,
  });
  const nudgeDispatchContext = createProtectionNudgeDispatchContext({
    runtimeLanguageStore,
    browserPort: resolvedBrowserPort,
    readThemePreference: readCanonicalThemePreference,
    recordDiagnostic: recordContentRuntimeDiagnosticOwner,
  });
  const nudgeDispatchRunner = createProtectionNudgeDispatchRunner({
    readProfileGeneration,
    settingsCache,
    ensureSettingsCache,
    mergeNudgeConfig,
    resolveProtectionRuntime,
    nudgeDispatchContext,
    contentScriptRuntime,
    browserPort: resolvedBrowserPort,
    recordDiagnostic: recordContentRuntimeDiagnosticOwner,
    recordTimeline: recordSentinelTimelineOwner,
  });
  const nudgeTeardownCoordinator = createProtectionNudgeTeardownCoordinator({
    sendStopToTab: sendNudgeStopForTab,
    readActiveOwner: readActiveNudgeOwnerForTab,
    abortNudgesForTab,
    scheduleTerminalEffects: scheduleNudgeTerminalOutboxDrain,
  });

  function recordContentRuntimeDiagnostic(event, payload = {}) {
    return recordContentRuntimeDiagnosticOwner(event, payload);
  }

  // Facts every inspector compares against, read once so one branch cannot observe a
  // different session than the branch beside it.
  function readTabUpdatedSettlementFacts(receipt) {
    const currentSnapshot = requireAtomicContentSessionSnapshot(
      contentScriptRuntime,
      receipt.tabId,
    );
    const currentSession = currentSnapshot.session;
    const ready = isDispatchReadyContentSession(currentSession);
    return Object.freeze({
      currentSnapshot,
      currentSession,
      currentDocumentId: ready
        ? resolveExactDispatchDocumentId(currentSession.documentId)
        : null,
      currentSessionUrl: ready
        ? resolveExactDispatchHistoryUrl(currentSession.url)
        : null,
      liveHistoryProof: tabLifecycleLedger.getHistoryProof(receipt.tabId),
      receiptHasExactSessionIdentity: !!(
        receipt.observedDocumentId
        && receipt.observedSessionUrl
      ),
    });
  }

  function inspectNavigationSuperseded(error, receipt, facts) {
      const snapshot = tabLifecycleLedger.getSnapshot(receipt.tabId);
      const latestIngress = snapshot?.latestIngress || null;
      const exactSupersession = !!(
        snapshot
        && latestIngress
        && error?.cause?.code === 'PROTECTION_DISPATCH_SERIAL_QUEUE_INVALIDATED'
        && SUPERSEDABLE_NAVIGATION_QUEUE_REASONS.has(error.cause.reason)
        && error.cause.tabId === receipt.tabId
        && error.cause.phase === error.phase
        && error.cause.invalidationTag === error.invalidationTag
        && error.queueReason === error.cause.reason
        && error.reason === 'navigation_superseded'
        && error.tabId === receipt.tabId
        // Re-read the ledger: the claim only holds while the generation is still past the
        // tag and this receipt still trails the lifecycle head.
        && snapshot.historyGeneration >= error.historyGeneration
        && snapshot.historyGeneration >= error.invalidationTag
        && latestIngress.sequence >= error.latestIngressSequence
        && receipt.ingressSequence === error.receiptIngressSequence
        && receipt.ingressSequence < latestIngress.sequence
      );
      if (!exactSupersession) {
        return refusedDispatchInspection({
          diagnosticReason: 'navigation_supersession_proof_mismatch',
        });
      }
      return settledDispatchInspection({
        disposition: 'protection_navigation_superseded',
        errorCode: error.code,
        phase: typeof error.phase === 'string' ? error.phase : null,
        diagnosticReason: 'exact_navigation_supersession',
      });
  }

  function inspectCommittedNavigationCanceled(error, receipt, facts) {
      const committedProof = tabLifecycleLedger.getCommittedProof(receipt.tabId);
      const exactCommittedCancellation = !!(
        committedProof
        && error?.cause?.code === 'PROTECTION_DISPATCH_SERIAL_QUEUE_INVALIDATED'
        && error.cause.reason === 'web_navigation_committed'
        && error.cause.tabId === receipt.tabId
        && error.cause.phase === error.phase
        && error.cause.invalidationTag === committedProof.invalidationTag
        && error.reason === 'document_navigation_committed'
        && error.queueReason === 'web_navigation_committed'
        && error.tabId === receipt.tabId
        && error.committedGeneration === committedProof.generation
        && error.committedInvalidationTag === committedProof.invalidationTag
        && error.committedIngressSequence === committedProof.ingressSequence
        && error.committedObservedAt === committedProof.observedAt
        && error.committedDocumentId === committedProof.documentId
        && error.committedUrl === committedProof.url
        && receipt.ingressSequence < committedProof.ingressSequence
      );
      if (!exactCommittedCancellation) {
        return refusedDispatchInspection({
          diagnosticReason: 'committed_navigation_overtake_proof_mismatch',
        });
      }
      return settledDispatchInspection({
        disposition: 'protection_committed_navigation_superseded',
        errorCode: error.code,
        phase: typeof error.phase === 'string' ? error.phase : null,
        diagnosticReason: 'exact_committed_navigation_overtake',
      });
  }

  function inspectPermissionlessAdmissionStale(error, receipt, facts) {
      const expectedDocumentId = resolveExactDispatchDocumentId(error.expectedDocumentId);
      const errorCurrentDocumentId = resolveExactDispatchDocumentId(error.currentDocumentId);
      const expectedUrl = resolveExactDispatchHistoryUrl(error.expectedUrl);
      const errorCurrentUrl = resolveExactDispatchHistoryUrl(error.currentUrl);
      const loadingReceiptWithoutReadyIdentity = receipt.status === 'loading'
        && receipt.observedDocumentId === null
        && receipt.observedSessionUrl === null
        && receipt.observedSessionGeneration === null;
      const readyReceiptMatchesAdmission = facts.receiptHasExactSessionIdentity
        && receipt.observedSessionGeneration === error.expectedSessionGeneration
        && receipt.observedDocumentId === expectedDocumentId
        && receipt.observedSessionUrl === expectedUrl;
      const currentSnapshotMatchesError = facts.currentSnapshot.generation
        === error.currentSessionGeneration
        && facts.currentDocumentId === errorCurrentDocumentId
        && (
          facts.currentSessionUrl === errorCurrentUrl
          || (
            !isDispatchReadyContentSession(facts.currentSession)
            && errorCurrentDocumentId === null
            && errorCurrentUrl === expectedUrl
          )
        );
      const admissionWasOvertaken = error.currentSessionGeneration
        !== error.expectedSessionGeneration
        || errorCurrentDocumentId !== expectedDocumentId
        || errorCurrentUrl !== expectedUrl;
      const exactPermissionlessOvertake = error.tabId === receipt.tabId
        && receipt.requestedUrl === expectedUrl
        && Number.isSafeInteger(error.expectedSessionGeneration)
        && error.expectedSessionGeneration >= 0
        && Number.isSafeInteger(error.currentSessionGeneration)
        && error.currentSessionGeneration >= 0
        && (readyReceiptMatchesAdmission || loadingReceiptWithoutReadyIdentity)
        && currentSnapshotMatchesError
        && admissionWasOvertaken;
      if (!exactPermissionlessOvertake) {
        return refusedDispatchInspection({
          diagnosticReason: 'permissionless_admission_overtake_proof_mismatch',
        });
      }
      return settledDispatchInspection({
        disposition: 'protection_permissionless_admission_superseded',
        errorCode: error.code,
        phase: typeof error.phase === 'string' ? error.phase : null,
        diagnosticReason: 'exact_permissionless_admission_overtake',
      });
  }

  function inspectDistinctDocumentOvertake(error, receipt, facts) {
      const exactDocumentProof = facts.receiptHasExactSessionIdentity
        && receipt.observedSessionUrl === receipt.requestedUrl
        && error.expectedDocumentId === receipt.observedDocumentId
        && facts.currentDocumentId === error.currentDocumentId
        && facts.currentDocumentId !== receipt.observedDocumentId;
      if (!exactDocumentProof) {
        return refusedDispatchInspection({
          diagnosticReason: SETTLEMENT_REASON_DOCUMENT_RECEIPT_IDENTITY_MISMATCH,
        });
      }
      return settledDispatchInspection({
        disposition: 'protection_document_superseded',
        errorCode: error.code,
        phase: typeof error.phase === 'string' ? error.phase : null,
        diagnosticReason: 'exact_distinct_document_overtake',
      });
  }

  function inspectTransactionContextOvertake(error, receipt, facts) {
      const receiptGeneration = receipt.observedSessionGeneration;
      const receiptDocumentId = resolveExactDispatchDocumentId(receipt.observedDocumentId);
      const receiptSessionUrl = resolveExactDispatchHistoryUrl(receipt.observedSessionUrl);
      const requestedUrl = resolveExactDispatchHistoryUrl(receipt.requestedUrl);
      const errorCurrentUrl = resolveExactDispatchHistoryUrl(
        error.code === 'PROTECTION_DISPATCH_TRANSACTION_CONTEXT_MISMATCH'
          ? error.sessionUrl
          : error.currentUrl,
      );
      const errorExpectedUrl = resolveExactDispatchHistoryUrl(
        error.code === 'PROTECTION_DISPATCH_TRANSACTION_CONTEXT_MISMATCH'
          ? error.requestedUrl
          : error.expectedUrl,
      );
      const errorCurrentGeneration = error.code
        === 'PROTECTION_DISPATCH_TRANSACTION_CONTEXT_MISMATCH'
        ? error.sessionGeneration
        : error.currentSessionGeneration;
      const priorGeneration = error.code
        === 'PROTECTION_DISPATCH_TRANSACTION_CONTEXT_MISMATCH'
        ? error.admissionSessionGeneration
        : error.transactionSessionGeneration;
      const errorAdmissionDocumentId = resolveExactDispatchDocumentId(
        error.admissionDocumentId,
      );
      const readyReceiptExact = facts.receiptHasExactSessionIdentity
        && Number.isSafeInteger(receiptGeneration)
        && receiptGeneration > 0;
      const loadingReceiptAdmissionExact = receipt.status === 'loading'
        && receipt.observedDocumentId === null
        && receipt.observedSessionUrl === null
        && receipt.observedSessionGeneration === null
        && errorAdmissionDocumentId !== null
        && errorAdmissionDocumentId === error.transactionDocumentId
        && errorAdmissionDocumentId === error.currentDocumentId;
      const correlatedDocumentId = readyReceiptExact
        ? receiptDocumentId
        : errorAdmissionDocumentId;
      const receiptUrlReachedByAdmission = loadingReceiptAdmissionExact
        || receiptSessionUrl === requestedUrl
        || error.admissionSessionGeneration > receiptGeneration;
      const admissionGenerationReachedReceipt = loadingReceiptAdmissionExact
        ? Number.isSafeInteger(error.admissionSessionGeneration)
          && error.admissionSessionGeneration > 0
        : Number.isSafeInteger(error.admissionSessionGeneration)
          && error.admissionSessionGeneration >= receiptGeneration;
      const exactSameDocumentUrlOvertake = (readyReceiptExact || loadingReceiptAdmissionExact)
        && admissionGenerationReachedReceipt
        && Number.isSafeInteger(error.admissionSessionGeneration)
        && Number.isSafeInteger(priorGeneration)
        && priorGeneration >= error.admissionSessionGeneration
        && Number.isSafeInteger(errorCurrentGeneration)
        && errorCurrentGeneration > priorGeneration
        && facts.currentSnapshot.generation === errorCurrentGeneration
        && correlatedDocumentId !== null
        && receiptUrlReachedByAdmission
        && requestedUrl === errorExpectedUrl
        && errorCurrentUrl !== null
        && errorCurrentUrl !== requestedUrl
        && isDispatchReadyContentSession(facts.currentSession)
        && resolveExactDispatchDocumentId(facts.currentSession.documentId) === correlatedDocumentId
        && resolveExactDispatchHistoryUrl(facts.currentSession.url) === errorCurrentUrl
        && error.transactionDocumentId === correlatedDocumentId
        && error.currentDocumentId === correlatedDocumentId
        && error.tabId === receipt.tabId;
      if (exactSameDocumentUrlOvertake) {
        return settledDispatchInspection({
          disposition: 'protection_same_document_url_superseded',
          errorCode: error.code,
          phase: typeof error.phase === 'string' ? error.phase : null,
          diagnosticReason: 'exact_same_document_url_overtake',
        });
      }
      return refusedDispatchInspection({
        diagnosticReason: 'same_document_url_overtake_proof_mismatch',
      });
  }

  // Ordered inspectors. Each names the error class it can speak for; the first whose
  // `matches` holds owns the answer, so a settlement is never reached by falling
  // through a branch that declined to prove itself.
  const TAB_UPDATED_SETTLEMENT_INSPECTORS = Object.freeze([
    Object.freeze({
      matches: (error, receipt, facts) => (
        error?.code === 'PROTECTION_DISPATCH_NAVIGATION_SUPERSEDED'
      ),
      inspect: inspectNavigationSuperseded,
    }),
    Object.freeze({
      matches: (error, receipt, facts) => (
        error?.code === 'PROTECTION_DISPATCH_COMMITTED_NAVIGATION_CANCELED'
      ),
      inspect: inspectCommittedNavigationCanceled,
    }),
    Object.freeze({
      matches: (error, receipt, facts) => (
        error?.code === 'PROTECTION_DISPATCH_PERMISSIONLESS_ADMISSION_STALE'
      ),
      inspect: inspectPermissionlessAdmissionStale,
    }),
    Object.freeze({
      matches: (error, receipt, facts) => (
        isProvenProtectionDispatchDocumentOvertaken(error, { tabId: receipt.tabId, expectedDocumentId: receipt.observedDocumentId, })
      ),
      inspect: inspectDistinctDocumentOvertake,
    }),
    Object.freeze({
      matches: (error, receipt, facts) => (
        error?.code === 'PROTECTION_DISPATCH_TRANSACTION_CONTEXT_MISMATCH' || error?.code === 'PROTECTION_DISPATCH_TRANSACTION_CONTEXT_STALE'
      ),
      inspect: inspectTransactionContextOvertake,
    }),
  ]);

  function inspectTabUpdatedDispatchSettlement(error, receipt) {
    if (!isOwnedDispatchLifecycleError(error)) {
      return refusedDispatchInspection({ diagnosticReason: 'error_provenance_unowned' });
    }
    const facts = readTabUpdatedSettlementFacts(receipt);
    for (const inspector of TAB_UPDATED_SETTLEMENT_INSPECTORS) {
      if (!inspector.matches(error, receipt, facts)) continue;
      return inspector.inspect(error, receipt, facts);
    }

    const historyIdentityMatches = facts.receiptHasExactSessionIdentity
      && !!facts.liveHistoryProof
      && facts.liveHistoryProof.tabId === receipt.tabId
      && facts.liveHistoryProof.generation === error?.historyGeneration
      && facts.liveHistoryProof.invalidationTag === error?.historyInvalidationTag
      && facts.liveHistoryProof.invalidationTag === facts.liveHistoryProof.generation
      && facts.liveHistoryProof.ingressSequence === error?.historyIngressSequence
      && facts.liveHistoryProof.documentId === error?.historyDocumentId
      && facts.liveHistoryProof.previousUrl === error?.historyPreviousUrl
      && facts.liveHistoryProof.currentUrl === error?.historyCurrentUrl
      && receipt.observedDocumentId === error?.historyDocumentId
      && facts.currentDocumentId === error?.historyDocumentId
      && facts.currentSessionUrl === error?.historyCurrentUrl;
    for (const overtake of HISTORY_OVERTAKE_PROOFS) {
      if (!historyIdentityMatches) break;
      if (!overtake.isProven(error, overtake.subject(receipt))) continue;
      if (receipt.observedSessionUrl !== error[overtake.sessionUrlField]) continue;
      return settledDispatchInspection({
        disposition: overtake.disposition,
        errorCode: error.code,
        phase: typeof error.phase === 'string' ? error.phase : null,
        diagnosticReason: overtake.diagnosticReason,
      });
    }
    return refusedDispatchInspection({
      diagnosticReason: SETTLEMENT_REASON_LIFECYCLE_PROOF_NOT_EXACT,
    });
  }

  async function inspectActiveBootstrapDocumentReplacement(error, receipt) {
    const receiptDocumentId = resolveExactDispatchDocumentId(receipt?.observedDocumentId);
    const receiptSessionUrl = resolveExactDispatchHistoryUrl(receipt?.observedSessionUrl);
    const requestedUrl = resolveExactDispatchHistoryUrl(receipt?.requestedUrl);
    const expectedDocumentId = resolveExactDispatchDocumentId(error?.expectedDocumentId);
    const errorCurrentDocumentId = resolveExactDispatchDocumentId(error?.currentDocumentId);
    const readyReceiptExact = receiptDocumentId !== null
      && receiptSessionUrl === requestedUrl
      && error?.expectedDocumentId === receiptDocumentId
      && Number.isSafeInteger(receipt?.observedSessionGeneration)
      && receipt.observedSessionGeneration > 0;
    const loadingReceiptWithoutReadyIdentity = receipt?.status === 'loading'
      && receipt?.observedDocumentId === null
      && receipt?.observedSessionUrl === null
      && receipt?.observedSessionGeneration === null
      && expectedDocumentId !== null
      && resolveExactDispatchHistoryUrl(error?.expectedUrl) === requestedUrl
      && resolveExactDispatchHistoryUrl(error?.currentUrl) === requestedUrl
      && (
        error?.currentDocumentId === null
        || (
          errorCurrentDocumentId !== null
          && errorCurrentDocumentId !== expectedDocumentId
        )
      )
      && Number.isSafeInteger(error?.transactionSessionGeneration)
      && error.transactionSessionGeneration > 0
      && Number.isSafeInteger(error?.currentSessionGeneration)
      && error.currentSessionGeneration > error.transactionSessionGeneration;
    if (
      error?.[protectionDispatchLifecycleErrorBrand] !== true
      || error?.code !== 'PROTECTION_DISPATCH_EXPECTED_DOCUMENT_STALE'
      || !ACTIVE_BOOTSTRAP_DOCUMENT_REPLACEMENT_PHASES.has(error?.phase)
      || error?.tabId !== receipt?.tabId
      || (readyReceiptExact && error?.currentDocumentId !== null)
      || !requestedUrl
      || (!readyReceiptExact && !loadingReceiptWithoutReadyIdentity)
    ) {
      return refusedDispatchInspection({
        diagnosticReason: 'active_bootstrap_document_receipt_mismatch',
      });
    }

    let snapshotBefore = null;
    try {
      snapshotBefore = requireAtomicContentSessionSnapshot(
        contentScriptRuntime,
        receipt.tabId,
      );
    } catch (_error) {
      return refusedDispatchInspection({
        diagnosticReason: 'active_bootstrap_document_snapshot_before_invalid',
      });
    }
    const replacementBefore = resolveActiveBootstrapReplacementSnapshot(snapshotBefore, {
      tabId: receipt.tabId,
      requestedUrl,
    });
    const minimumPriorGeneration = readyReceiptExact
      ? receipt.observedSessionGeneration
      : error.transactionSessionGeneration;
    if (
      !replacementBefore
      || replacementBefore.generation <= minimumPriorGeneration
      || (
        loadingReceiptWithoutReadyIdentity
        && replacementBefore.generation < error.currentSessionGeneration
      )
      || replacementBefore.documentId === expectedDocumentId
      || (
        errorCurrentDocumentId !== null
        && replacementBefore.documentId !== errorCurrentDocumentId
      )
      || !replacementBefore.invalidDocumentIds?.includes?.(expectedDocumentId)
    ) {
      return refusedDispatchInspection({
        diagnosticReason: 'active_bootstrap_document_snapshot_before_mismatch',
      });
    }

    let probeResult = null;
    try {
      probeResult = await contentScriptRuntime.probeExactDocumentLocation({
        tabId: receipt.tabId,
        documentId: replacementBefore.documentId,
        url: requestedUrl,
      });
    } catch (_error) {
      return refusedDispatchInspection({
        diagnosticReason: 'active_bootstrap_document_probe_failed',
      });
    }
    if (!isExactDocumentLocationProbeResult(probeResult, replacementBefore)) {
      return refusedDispatchInspection({
        diagnosticReason: 'active_bootstrap_document_probe_result_invalid',
      });
    }

    let snapshotAfter = null;
    try {
      snapshotAfter = requireAtomicContentSessionSnapshot(
        contentScriptRuntime,
        receipt.tabId,
      );
    } catch (_error) {
      return refusedDispatchInspection({
        diagnosticReason: 'active_bootstrap_document_snapshot_after_invalid',
      });
    }
    const replacementAfter = resolveActiveBootstrapReplacementSnapshot(snapshotAfter, {
      tabId: receipt.tabId,
      requestedUrl,
    });
    if (
      !replacementAfter
      || replacementAfter.generation < replacementBefore.generation
      || replacementAfter.documentId !== replacementBefore.documentId
      || replacementAfter.url !== replacementBefore.url
      || replacementAfter.attemptId !== replacementBefore.attemptId
      || replacementAfter.startedAt !== replacementBefore.startedAt
      || replacementAfter.statusRank < replacementBefore.statusRank
    ) {
      return refusedDispatchInspection({
        diagnosticReason: 'active_bootstrap_document_snapshot_after_mismatch',
      });
    }

    return settledDispatchInspection({
      disposition: 'protection_document_superseded',
      errorCode: error.code,
      phase: error.phase,
      diagnosticReason: 'exact_active_bootstrap_document_overtake',
    });
  }

  async function inspectLoadingBootstrapDocumentReplacement(error, receipt) {
    const requestedUrl = resolveExactDispatchHistoryUrl(receipt?.requestedUrl);
    if (
      !isProtectionDispatchDocumentIdentityError(error)
      || error?.code !== 'PROTECTION_DISPATCH_DOCUMENT_IDENTITY_INVALID'
      || error?.reason !== 'expected_document_mismatch'
      || error?.phase !== 'recovery'
      || error?.tabId !== receipt?.tabId
      || receipt?.status !== 'loading'
      || receipt?.observedDocumentId !== null
      || receipt?.observedSessionUrl !== null
      || receipt?.observedSessionGeneration !== null
      || !requestedUrl
      || !resolveExactDispatchDocumentId(error?.expectedDocumentId)
      || !resolveExactDispatchDocumentId(error?.currentDocumentId)
      || error.expectedDocumentId === error.currentDocumentId
    ) {
      return refusedDispatchInspection({
        diagnosticReason: 'loading_bootstrap_document_receipt_mismatch',
      });
    }

    const snapshotBefore = requireAtomicContentSessionSnapshot(
      contentScriptRuntime,
      receipt.tabId,
    );
    const replacementBefore = resolveActiveBootstrapReplacementSnapshot(snapshotBefore, {
      tabId: receipt.tabId,
      requestedUrl,
    });
    if (
      !replacementBefore
      || replacementBefore.documentId !== error.currentDocumentId
      || replacementBefore.documentId === error.expectedDocumentId
    ) {
      return refusedDispatchInspection({
        diagnosticReason: 'loading_bootstrap_document_snapshot_before_mismatch',
      });
    }

    let probeResult = null;
    try {
      probeResult = await contentScriptRuntime.probeExactDocumentLocation({
        tabId: receipt.tabId,
        documentId: replacementBefore.documentId,
        url: requestedUrl,
      });
    } catch (_error) {
      return refusedDispatchInspection({
        diagnosticReason: 'loading_bootstrap_document_probe_failed',
      });
    }
    if (!isExactDocumentLocationProbeResult(probeResult, replacementBefore)) {
      return refusedDispatchInspection({
        diagnosticReason: 'loading_bootstrap_document_probe_result_invalid',
      });
    }

    const snapshotAfter = requireAtomicContentSessionSnapshot(
      contentScriptRuntime,
      receipt.tabId,
    );
    const replacementAfter = resolveActiveBootstrapReplacementSnapshot(snapshotAfter, {
      tabId: receipt.tabId,
      requestedUrl,
    });
    if (
      !replacementAfter
      || replacementAfter.generation < replacementBefore.generation
      || replacementAfter.documentId !== replacementBefore.documentId
      || replacementAfter.url !== replacementBefore.url
      || replacementAfter.attemptId !== replacementBefore.attemptId
      || replacementAfter.startedAt !== replacementBefore.startedAt
      || replacementAfter.statusRank < replacementBefore.statusRank
    ) {
      return refusedDispatchInspection({
        diagnosticReason: 'loading_bootstrap_document_snapshot_after_mismatch',
      });
    }

    return settledDispatchInspection({
      disposition: 'protection_document_superseded',
      errorCode: error.code,
      phase: error.phase,
      diagnosticReason: 'exact_loading_bootstrap_document_overtake',
    });
  }

  const liveAdmissionReconciliation = createProtectionLiveAdmissionReconciliation({
    contentScriptRuntime,
    browserPort: resolvedBrowserPort,
    captureDispatchAdmissionContext,
  });
  const {
    inspectLiveAdmissionTabUpdateReconciliation,
  } = liveAdmissionReconciliation;


  function recordTabUpdatedSettlementDiagnostic(event, receipt, error, options = {}) {
    recordContentRuntimeDiagnostic(
      event,
      buildTabUpdatedSettlementDiagnosticPayload(receipt, error, options),
    );
  }

  function finalizeTabUpdatedDispatchInspection(error, receipt, inspection) {
    if (!inspection?.settlement) {
      if (isOwnedDispatchLifecycleError(error)) {
        const diagnostic = buildTabUpdatedSettlementDiagnosticPayload(receipt, error, {
          diagnosticReason: inspection?.diagnosticReason,
        });
        error.tabUpdateStatus = receipt.status;
        error.settlementReason = diagnostic.diagnosticReason;
        error.historyIngressOrder = diagnostic.historyIngressOrder;
      }
      recordTabUpdatedSettlementDiagnostic(
        'protection_tab_updated_dispatch_rejected',
        receipt,
        error,
        {
          diagnosticReason: inspection?.diagnosticReason
            || SETTLEMENT_REASON_LIFECYCLE_PROOF_NOT_EXACT,
          diagnostic: inspection?.diagnostic || null,
        },
      );
      throw error;
    }
    const settlement = createProtectionTabUpdatedDispatchOutcome({
      receipt,
      ...inspection.settlement,
    });
    recordTabUpdatedSettlementDiagnostic(
      'protection_tab_updated_dispatch_settled',
      receipt,
      error,
      {
        diagnosticReason: inspection.diagnosticReason,
        disposition: settlement.disposition,
        diagnostic: inspection.diagnostic || null,
      },
    );
    return settlement;
  }

  // Settlement adjudication runs as two ordered passes, not as nested calls.
  //
  // Provers refine the error: each takes (error, receipt) and either returns a more
  // specific owned lifecycle error or hands the original back untouched. Order matters --
  // the exact provers get first refusal, and the weaker supersession claim only sees what
  // they declined.
  const TAB_UPDATED_SETTLEMENT_PROVERS = Object.freeze([
    createProvenPendingTabUpdateHistoryQueueInvalidation,
    createProvenPendingTabUpdateCommittedQueueInvalidation,
    createProvenSupersededNavigationQueueInvalidation,
  ]);

  // Escalations re-inspect an error the direct inspector could not settle, using evidence
  // it does not have (a live bootstrap probe). `matches` reads the direct inspection, so
  // adding a case is a list entry rather than another ternary arm.
  const TAB_UPDATED_SETTLEMENT_ESCALATIONS = Object.freeze([
    Object.freeze({
      name: 'active_bootstrap_document_replacement',
      matches: (error, receipt, direct) => (
        error?.[protectionDispatchLifecycleErrorBrand] === true
        && error?.code === 'PROTECTION_DISPATCH_EXPECTED_DOCUMENT_STALE'
        && (
          direct.diagnosticReason === SETTLEMENT_REASON_LIFECYCLE_PROOF_NOT_EXACT
          || (
            direct.diagnosticReason === SETTLEMENT_REASON_DOCUMENT_RECEIPT_IDENTITY_MISMATCH
            && receipt.status === 'loading'
            && receipt.observedDocumentId === null
            && receipt.observedSessionUrl === null
            && receipt.observedSessionGeneration === null
          )
        )
      ),
      inspect: (error, receipt) => inspectActiveBootstrapDocumentReplacement(error, receipt),
    }),
    Object.freeze({
      name: 'loading_bootstrap_document_replacement',
      matches: (error, receipt, direct) => (
        direct.diagnosticReason === SETTLEMENT_REASON_DOCUMENT_RECEIPT_IDENTITY_MISMATCH
        && isProtectionDispatchDocumentIdentityError(error)
        && error?.code === 'PROTECTION_DISPATCH_DOCUMENT_IDENTITY_INVALID'
      ),
      inspect: (error, receipt) => inspectLoadingBootstrapDocumentReplacement(error, receipt),
    }),
  ]);

  function proveTabUpdatedSettlementError(error, receipt) {
    return TAB_UPDATED_SETTLEMENT_PROVERS.reduce(
      (current, prove) => prove(current, receipt),
      error,
    );
  }

  // Pre-dispatch rejections cannot have been overtaken by anything yet: no lane was
  // entered and no bootstrap probe applies, so they take the direct inspection only.
  function settleTabUpdatedDispatchRejection(error, receipt) {
    return finalizeTabUpdatedDispatchInspection(
      error,
      receipt,
      inspectTabUpdatedDispatchSettlement(error, receipt),
    );
  }

  async function settleTabUpdatedDispatchFailure(error, receipt, task) {
    const removal = dispatchSerialQueue.getTaskInvalidation(error, task);
    if (removal?.code === 'PROTECTION_DISPATCH_SERIAL_QUEUE_TAB_EVICTED'
      && removal.tabId === receipt.tabId
      && ['tab_removed', 'tab_replaced'].includes(removal.reason)) {
      // Exact task evidence survives final eviction. A matching error string or
      // a different queue's error cannot settle this receipt as cancelled.
      return finalizeTabUpdatedDispatchInspection(error, receipt, settledDispatchInspection({
        disposition: 'protection_tab_removed',
        errorCode: removal.code,
        phase: removal.phase,
        diagnosticReason: removal.reason,
      }));
    }
    const settlementError = proveTabUpdatedSettlementError(error, receipt);
    const direct = inspectTabUpdatedDispatchSettlement(settlementError, receipt);
    let inspection = direct;
    if (!direct.settlement) {
      for (const escalation of TAB_UPDATED_SETTLEMENT_ESCALATIONS) {
        if (!escalation.matches(settlementError, receipt, direct)) continue;
        inspection = await escalation.inspect(settlementError, receipt);
        break;
      }
    }
    return finalizeTabUpdatedDispatchInspection(settlementError, receipt, inspection);
  }

  function captureDispatchTransactionContext({
    tabId,
    url,
    expectedDocumentId,
    admissionSessionGeneration,
    serialFence,
    ensureSource,
  }) {
    serialFence.assertCurrent('transaction_capture');
    const requestedUrl = requireDispatchTransactionUrl(
      url,
      'PROTECTION_DISPATCH_TRANSACTION_URL_INVALID',
    );
    const requestedHostname = getHostname(requestedUrl);
    if (!requestedHostname) {
      throw createDispatchTransactionError('PROTECTION_DISPATCH_TRANSACTION_HOSTNAME_REQUIRED');
    }
    const sessionSnapshot = requireAtomicContentSessionSnapshot(contentScriptRuntime, tabId);
    const session = sessionSnapshot.session;
    if (!isDispatchReadyContentSession(session)) {
      throw createDispatchTransactionError(
        'PROTECTION_DISPATCH_TRANSACTION_SESSION_NOT_READY',
        { phase: 'transaction_capture', tabId },
      );
    }
    const documentId = resolveReadyContentDocumentId(session);
    if (expectedDocumentId !== null && documentId !== expectedDocumentId) {
      throw createOwnedDispatchLifecycleError(
        'PROTECTION_DISPATCH_TRANSACTION_DOCUMENT_MISMATCH',
        {
          currentDocumentId: documentId,
          expectedDocumentId,
          phase: 'transaction_capture',
          tabId,
        },
      );
    }
    const sessionUrl = requireDispatchTransactionUrl(
      session.url,
      'PROTECTION_DISPATCH_TRANSACTION_SESSION_URL_REQUIRED',
    );
    const sessionHostname = getHostname(sessionUrl);
    if (sessionUrl !== requestedUrl || sessionHostname !== requestedHostname) {
      throw createOwnedDispatchLifecycleError(
        'PROTECTION_DISPATCH_TRANSACTION_CONTEXT_MISMATCH',
        {
          phase: 'transaction_capture',
          tabId,
          admissionSessionGeneration,
          admissionDocumentId: expectedDocumentId,
          sessionGeneration: sessionSnapshot.generation,
          transactionDocumentId: documentId,
          currentDocumentId: documentId,
          requestedHostname,
          requestedUrl,
          sessionHostname,
          sessionUrl,
        },
      );
    }
    return Object.freeze({
      admissionSessionGeneration,
      documentId,
      ensureSource: typeof ensureSource === 'string' ? ensureSource : null,
      hostname: sessionHostname,
      sessionGeneration: sessionSnapshot.generation,
      serialFence,
      url: sessionUrl,
    });
  }

  function inspectDispatchAdmissionContext({
    tabId,
    url,
    expectedDocumentId,
  }) {
    const requestedUrl = requireDispatchTransactionUrl(
      url,
      'PROTECTION_DISPATCH_ADMISSION_URL_INVALID',
    );
    const sessionSnapshot = requireAtomicContentSessionSnapshot(contentScriptRuntime, tabId);
    const session = sessionSnapshot.session;
    if (!isDispatchReadyContentSession(session)) {
      return Object.freeze({
        admission: Object.freeze({
          documentId: expectedDocumentId,
          sessionGeneration: sessionSnapshot.generation,
          url: requestedUrl,
        }),
        mismatch: null,
      });
    }
    const documentId = resolveReadyContentDocumentId(session);
    if (expectedDocumentId !== null && expectedDocumentId !== documentId) {
      throw createOwnedDispatchLifecycleError(
        'PROTECTION_DISPATCH_ADMISSION_DOCUMENT_MISMATCH',
        {
          currentDocumentId: documentId,
          expectedDocumentId,
          sessionGeneration: sessionSnapshot.generation,
          phase: 'admission_capture',
          tabId,
        },
      );
    }
    const sessionUrl = requireDispatchTransactionUrl(
      session.url,
      'PROTECTION_DISPATCH_ADMISSION_SESSION_URL_REQUIRED',
    );
    if (sessionUrl !== requestedUrl) {
      const historyProof = tabLifecycleLedger.getHistoryProof(tabId);
      const sameDocumentHistoryOvertake = !!(
        historyProof
        && historyProof.tabId === tabId
        && historyProof.previousUrl === requestedUrl
        && historyProof.currentUrl === sessionUrl
        && historyProof.documentId === documentId
      );
      return Object.freeze({
        admission: null,
        mismatch: Object.freeze({
          code: 'PROTECTION_DISPATCH_ADMISSION_CONTEXT_MISMATCH',
          ...(sameDocumentHistoryOvertake ? {
            reason: 'same_document_history_overtaken',
            historyDocumentId: historyProof.documentId,
            historyGeneration: historyProof.generation,
            historyInvalidationTag: historyProof.invalidationTag,
            historyObservedAt: historyProof.observedAt,
            historyIngressSequence: historyProof.ingressSequence,
            historyPreviousUrl: historyProof.previousUrl,
            historyCurrentUrl: historyProof.currentUrl,
          } : {
            reason: 'ready_session_url_mismatch',
          }),
          phase: 'admission_capture',
          sessionGeneration: sessionSnapshot.generation,
          contentMutationDisposition: 'not_started',
          gatePresentationDisposition: 'not_started',
          contentDeliveryDisposition: 'not_started',
          ackDisposition: 'not_observed',
          currentDocumentId: documentId,
          requestedUrl,
          sessionUrl,
          tabId,
        }),
      });
    }
    return Object.freeze({
      admission: Object.freeze({
        documentId,
        sessionGeneration: sessionSnapshot.generation,
        url: sessionUrl,
      }),
      mismatch: null,
    });
  }

  function createDispatchAdmissionContextMismatchError(mismatch) {
    return createOwnedDispatchLifecycleError(
      'PROTECTION_DISPATCH_ADMISSION_CONTEXT_MISMATCH',
      mismatch,
    );
  }

  function captureDispatchAdmissionContext({
    tabId,
    url,
    expectedDocumentId,
  } = {}) {
    const inspection = inspectDispatchAdmissionContext({
      tabId,
      url,
      expectedDocumentId,
    });
    if (inspection.admission) return inspection.admission;
    throw createDispatchAdmissionContextMismatchError(inspection.mismatch);
  }

  function assertPermissionlessDispatchAdmissionCurrent(
    tabId,
    admission,
    serialFence,
    abortSignal,
    phase,
  ) {
    serialFence.assertCurrent(phase);
    throwIfProtectionDispatchAborted(abortSignal, phase);
    const currentSnapshot = requireAtomicContentSessionSnapshot(contentScriptRuntime, tabId);
    const currentSession = currentSnapshot.session;
    const currentReady = isDispatchReadyContentSession(currentSession);
    const currentDocumentId = currentReady
      ? resolveReadyContentDocumentId(currentSession)
      : null;
    const currentUrl = currentReady
      ? requireDispatchTransactionUrl(
        currentSession.url,
        'PROTECTION_DISPATCH_PERMISSIONLESS_SESSION_URL_REQUIRED',
      )
      : admission.url;
    if (
      currentSnapshot.generation !== admission.sessionGeneration
      || currentDocumentId !== admission.documentId
      || currentUrl !== admission.url
    ) {
      throw createOwnedDispatchLifecycleError(
        'PROTECTION_DISPATCH_PERMISSIONLESS_ADMISSION_STALE',
        {
          phase,
          tabId,
          expectedSessionGeneration: admission.sessionGeneration,
          currentSessionGeneration: currentSnapshot.generation,
          expectedDocumentId: admission.documentId,
          currentDocumentId,
          expectedUrl: admission.url,
          currentUrl,
        },
      );
    }
  }


  function assertDispatchTransactionCurrent(tabId, transaction, phase) {
    transaction.serialFence.assertCurrent(phase);
    const sessionSnapshot = requireAtomicContentSessionSnapshot(contentScriptRuntime, tabId);
    const session = sessionSnapshot.session;
    assertExpectedDispatchDocument(tabId, session, transaction.documentId, phase, {
      admissionSessionGeneration: transaction.admissionSessionGeneration,
      transactionSessionGeneration: transaction.sessionGeneration,
      currentSessionGeneration: sessionSnapshot.generation,
      expectedUrl: transaction.url,
      currentUrl: resolveExactDispatchHistoryUrl(session?.url),
    });
    const currentUrl = requireDispatchTransactionUrl(
      session.url,
      'PROTECTION_DISPATCH_TRANSACTION_SESSION_URL_REQUIRED',
    );
    if (
      currentUrl !== transaction.url
      || getHostname(currentUrl) !== transaction.hostname
    ) {
      throw createOwnedDispatchLifecycleError(
        'PROTECTION_DISPATCH_TRANSACTION_CONTEXT_STALE',
        {
          currentUrl,
          expectedUrl: transaction.url,
          phase,
          tabId,
          admissionSessionGeneration: transaction.admissionSessionGeneration,
          transactionSessionGeneration: transaction.sessionGeneration,
          currentSessionGeneration: sessionSnapshot.generation,
          admissionDocumentId: transaction.documentId,
          transactionDocumentId: transaction.documentId,
          currentDocumentId: resolveReadyContentDocumentId(session),
        },
      );
    }
  }

  async function readFilterSettingsSnapshot({ skipSettingsEnsure = false } = {}) {
    if (!skipSettingsEnsure) {
      await ensureSettingsCache();
    }
    if (isPlainObject(settingsCache.filterSettings)) {
      return settingsCache.filterSettings;
    }
    const liveSettingsCache = getSettingsCache();
    if (isPlainObject(liveSettingsCache?.filterSettings)) {
      return liveSettingsCache.filterSettings;
    }
    throw new Error('PROTECTION_DISPATCHER_FILTER_SETTINGS_REQUIRED');
  }

  function clearDispatchPermissionCaches() {
    dispatchPermissionGate.clear();
  }

  // The Gate leg of a protection attempt. It either finishes the attempt -- a redirect,
  // an inline surface that settled, a history reconciliation -- or declines and hands back
  // the theme presentation the content leg still needs. Everything it accumulates,
  // including the overtake arbiter, lives and dies inside it.
  // Both dispatch routes present the Gate, and both must answer the same two questions the
  // same way. They are the same machine under different permissions, so the answers live
  // here rather than once per route where they can quietly drift apart.

  // A Gate redirect controller phase may proceed through a committed navigation: the commit
  // it is racing is the redirect this leg just asked for, so treating it as an invalidation
  // would cancel the Gate on its own success.
  function acceptGateRedirectCommittedOvertake(error, phase, { tabId, url, hostname, route }) {
    if (
      error?.code !== 'PROTECTION_DISPATCH_SERIAL_QUEUE_INVALIDATED'
      || error?.reason !== 'web_navigation_committed'
    ) {
      return false;
    }
    if (typeof phase !== 'string' || !phase.includes('gate_controller_')) return false;
    recordContentRuntimeDiagnostic('gate_redirect_presentation_permitted_during_committed_navigation', {
      tabId,
      url,
      route,
      hostname,
      phase,
    });
    return true;
  }

  // The Gate took the page; the dispatch attempt is over. `documentDisposition` records
  // whether the Gate redirected or retained its existing authorized document.
  function settleGateInterstitialPresented({
    tabId,
    url,
    hostname,
    runtimeSnapshot,
    gatePresentation,
    documentDisposition,
    sendResult = null,
  }) {
    dispatchStateLedger.resetDispatchAttempt(tabId);
    recordContentRuntimeDiagnostic('gate_interstitial_presented', {
      tabId,
      url,
      route: 'protection_update',
      hostname,
      sessionId: gatePresentation.sessionId || null,
      presentationReason: gatePresentation.reason || null,
      documentDisposition,
    });
    return {
      runtimeSnapshot,
      handled: 'gate_interstitial',
      documentDisposition,
      sendResult,
    };
  }

  async function runGateDispatchLeg({
    tabId, url, transaction, now, hostname, runtimeSnapshot, assertAttemptCurrent,
  }) {
    const gateMutationFence = Object.freeze({
      documentId: transaction.documentId,
      assertCurrent: (phase) => {
        const resolvedPhase = `gate_mutation:${phase}`;
        try {
          assertAttemptCurrent(resolvedPhase);
        } catch (error) {
          if (acceptGateRedirectCommittedOvertake(error, resolvedPhase, {
            tabId, url, hostname, route: 'protection_update',
          })) return;
          throw createProvenPreAckHistoryCancellation(error, { tabId, transaction });
        }
      },
    });
    const { gatePresentation, themePresentation: gateThemePresentation } = await gateDispatchBridge.present({
      tabId, url, runtimeSnapshot, now, mutationFence: gateMutationFence,
    });
    // A committed top-level redirect owns the new document. Its source transaction
    // must not demand another content receiver or acknowledge the retired page.
    if (gatePresentation.documentDisposition === 'redirected') {
      await gateDispatchBridge.refreshBootstrap({
        hostname, runtimeSnapshot, now, themePresentation: gateThemePresentation,
      });
      return { done: true, result: settleGateInterstitialPresented({
        tabId, url, hostname, runtimeSnapshot, gatePresentation, documentDisposition: 'redirected',
      }) };
    }
    assertAttemptCurrent('after_gate', { abortPhase: 'gate_resolved' });
    if (gatePresentation.handled) {
      await gateDispatchBridge.refreshBootstrap({
        hostname, runtimeSnapshot, now, themePresentation: gateThemePresentation,
      });
      assertAttemptCurrent('gate_bootstrap_refreshed');
      return { done: true, result: settleGateInterstitialPresented({
        tabId, url, hostname, runtimeSnapshot, gatePresentation, documentDisposition: 'preserved',
      }) };
    }
    return { done: false, gateThemePresentation };
  }

  async function sendProtectionUpdateAttempt(
    tabId,
    url,
    {
      nowOverride = null,
      filterSettingsOverride = null,
      capStateOverride = null,
      directTriggersOverride = [],
      gateEntryObserved = false,
      skipSettingsEnsure = false,
      forceSnapshot = false,
      expectedDocumentId = null,
      abortSignal = null,
      propagationContext = null,
    } = {},
    {
      transaction,
      dispatchPermission,
    } = {},
  ) {
    if (!transaction || typeof transaction !== 'object') {
      throw new Error('PROTECTION_DISPATCH_TRANSACTION_REQUIRED');
    }
    if (!dispatchPermission || dispatchPermission.allowed !== true) {
      throw new Error('PROTECTION_DISPATCH_PERMISSION_ADMISSION_REQUIRED');
    }
    requireExpectedContentDocumentId(expectedDocumentId);
    const permissionFence = Object.freeze({
      assertCurrent: (phase) => dispatchPermissionGate.assertCurrent(dispatchPermission, phase),
    });
    // Stage 1. Bind this attempt to the transaction's document and build the fences every
    // later stage asserts through.
    const expectedDispatchDocumentId = transaction.documentId;
    const dispatchAbortSignal = requireProtectionDispatchAbortSignal(abortSignal);
    const assertAttemptCurrent = (phase, {
      abortPhase = phase,
      skipAbort = false,
    } = {}) => {
      transaction.serialFence.assertCurrent(phase);
      dispatchPermissionGate.assertCurrent(dispatchPermission, phase);
      if (!skipAbort) throwIfProtectionDispatchAborted(dispatchAbortSignal, abortPhase);
      assertDispatchTransactionCurrent(tabId, transaction, phase);
    };
    const nudgeMutationFence = Object.freeze({
      assertCurrent: (phase) => assertAttemptCurrent(`nudge_mutation:${phase}`),
    });
    assertAttemptCurrent('dispatcher_start');
    if (!url || !isWebUrl(url)) {
      return;
    }
    if (!skipSettingsEnsure) {
      await ensureSettingsCache();
      assertAttemptCurrent('settings_ready');
    }

    // Stage 2. Resolve everything the dispatch decision needs: host-scoped settings, the
    // content session, the runtime snapshot, and the payload/envelope built from them.
    const now = Number.isFinite(nowOverride) ? nowOverride : Date.now();
    const filterSettings = filterSettingsOverride || await readFilterSettingsSnapshot();
    assertAttemptCurrent('filter_settings_resolved');
    const hostname = getHostname(url);
    const contentSession = contentScriptRuntime.getTabSession(tabId) || null;
    assertExpectedDispatchDocument(
      tabId,
      contentSession,
      expectedDispatchDocumentId,
      'before_runtime',
    );
    const needsFreshContentSnapshot = !isDispatchReadyContentSession(contentSession);
    if (needsFreshContentSnapshot) {
      dispatchStateLedger.resetTab(tabId);
    }
    const effectiveForceSnapshot = forceSnapshot || needsFreshContentSnapshot;
    const feedFlowSource = resolveFeedFlowRuntimeSource({
      tabId,
      hostname,
      contentSession,
    });
    const {
      previousEnvelopeState,
      previousRevision,
    } = dispatchStateLedger.getPreviousEnvelopeInput(tabId, {
      forceSnapshot: effectiveForceSnapshot,
    });
    const runtimeSnapshot = await resolveProtectionRuntime(hostname, {
      now,
      filterSettings,
      capStateOverride,
      directTriggers: directTriggersOverride,
      feedFlowSource,
      gateEntryObserved,
      tabId,
      previousEnvelopeState,
      previousRevision,
      forceSnapshot: effectiveForceSnapshot,
    });
    assertAttemptCurrent('after_runtime', { abortPhase: 'runtime_resolved' });
    await goalEpisodeInvalidator.revalidate({ tabId, now });
    assertAttemptCurrent('after_goal_revalidation');
    const {
      dispatch,
      envelope,
      envelopeResult,
      messageType,
      payload,
      signature,
      traceId,
    } = buildProtectionDispatchPayload({
      hostname,
      runtimeSnapshot,
      settingsCache,
      url,
    });
    if (propagationContext) recordContentRuntimeDiagnostic('settings_propagation_dispatch_bound', {
      ...settingsPropagationDiagnostic(propagationContext), tabId, hostname,
      documentId: transaction.documentId, attemptId: contentSession?.attemptId,
      traceId, envelopeRevision: envelope?.revision,
    });
    const gateLeg = await runGateDispatchLeg({
      tabId,
      url,
      transaction,
      now,
      hostname,
      runtimeSnapshot,
      assertAttemptCurrent,
    });
    if (gateLeg.done) return gateLeg.result;
    const { gateThemePresentation } = gateLeg;
    // Stage 4. Content leg. From here the Gate has either finished or declined, and the
    // remaining work is the protection payload itself.
    if (expectedDispatchDocumentId === null) {
      dispatchStateLedger.rememberContext(tabId, {
        hostname,
        isBlockedDomain: !!dispatch.isBlockedDomain,
      });
    }
    if (!effectiveForceSnapshot && dispatchStateLedger.hasMatchingSignature(tabId, signature)) {
      await gateDispatchBridge.refreshBootstrap({
        hostname,
        runtimeSnapshot,
        now,
        themePresentation: gateThemePresentation,
      });
      assertAttemptCurrent('after_unchanged_bootstrap_refresh');
      if (expectedDispatchDocumentId !== null) {
        dispatchStateLedger.rememberContext(tabId, {
          hostname,
          isBlockedDomain: !!dispatch.isBlockedDomain,
        });
      }
      if (dispatch.shouldApply) {
        const nudgeResult = await nudgeDispatchRunner.maybeTriggerProtectionNudge(tabId, url, {
          runtimeOverride: runtimeSnapshot,
          nowOverride: now,
          contentMutationDocumentId: transaction.documentId,
          contentMutationFence: nudgeMutationFence,
        });
        if (nudgeResult?.contentMutationDisposition !== 'same_document_url_overtaken') {
          assertAttemptCurrent('after_unchanged_nudge');
        }
      }
      return {
        runtimeSnapshot,
        skipped: 'unchanged_signature',
        permissionState: dispatchPermission.permissionState,
      };
    }

    // Stage 5. Send, require an exact ACK, and commit ledger state only on one.
    const sendResult = requireProtectionUpdateAcknowledgement(
      requireCurrentDispatchDocument(
        await sendMessageWithRecovery(
          tabId,
          payload,
          contentScriptRuntime,
          {
            url,
            reason: 'protection_update',
            recordDiagnostic: recordContentRuntimeDiagnostic,
            browserPort: resolvedBrowserPort,
            bindToReadyDocument: true,
            expectedDocumentId: expectedDispatchDocumentId,
            prevalidatedAdmission: Object.freeze({
              documentId: transaction.documentId,
              url: transaction.url,
            }),
            abortSignal: dispatchAbortSignal,
            propagationContext,
            contentMutationFence: permissionFence,
          },
        ),
        contentScriptRuntime.getTabSession(tabId) || null,
      ),
    );
    if (propagationContext) recordContentRuntimeDiagnostic('settings_propagation_content_ack', {
      ...settingsPropagationDiagnostic(propagationContext), tabId, hostname,
      documentId: transaction.documentId, attemptId: contentSession?.attemptId,
      traceId, envelopeRevision: envelope?.revision,
      status: dispatchAbortSignal?.aborted ? 'cancelled' : sendResult.ok ? 'acknowledged' : 'failed',
      receiverTraceId: sendResult.response?.traceId ?? null,
    });
    assertAttemptCurrent('after_content_send', { abortPhase: 'content_sent' });
    if (
      expectedDispatchDocumentId !== null
      && sendResult?.ok !== true
      && [
        'content_ack_document_stale',
        'content_document_identity_invalid',
        'dispatch_aborted',
      ].includes(sendResult?.diagnostic?.reason)
    ) {
      assertExpectedDispatchDocument(
        tabId,
        contentScriptRuntime.getTabSession(tabId) || null,
        expectedDispatchDocumentId,
        'after_send',
      );
      if (sendResult?.error instanceof Error) throw sendResult.error;
      throw createDispatchTransactionError('PROTECTION_DISPATCH_SEND_FAILURE_INVALID', {
        phase: 'after_send',
        tabId,
      });
    }
    if (sendResult?.ok) {
      await gateDispatchBridge.refreshBootstrap({
        hostname,
        runtimeSnapshot,
        now,
        themePresentation: gateThemePresentation,
      });
      assertAttemptCurrent('after_bootstrap_refresh', { abortPhase: 'bootstrap_refreshed' });
      if (expectedDispatchDocumentId !== null) {
        dispatchStateLedger.rememberContext(tabId, {
          hostname,
          isBlockedDomain: !!dispatch.isBlockedDomain,
        });
      }
      dispatchStateLedger.commitDispatchSuccess(tabId, {
        signature,
        envelopeResult,
      });
      console.debug('[ProtectionDispatcher][dispatch]', {
        tabId,
        hostname,
        traceId,
        envelopeMode: envelope?.mode || null,
        envelopeRevision: envelope?.revision ?? null,
        domainClassId: dispatch.domainClassId || null,
      });
    } else {
      const receiverRevisionFloor = sendResult?.diagnostic?.receiverRevisionFloor;
      dispatchStateLedger.resetDispatchAttempt(tabId);
      if (Number.isSafeInteger(receiverRevisionFloor) && receiverRevisionFloor >= 0) {
        dispatchStateLedger.noteReceiverEnvelopeRevisionFloor(
          tabId,
          receiverRevisionFloor,
        );
      }
      const detail = formatDispatchDiagnostic(sendResult?.diagnostic);
      const reason = sendResult?.diagnostic?.reason || null;
      const log = isPermissionMissingReason(reason) ? console.debug : console.warn;
      log(`[ProtectionDispatcher][dispatch_failed] tabId=${tabId} error=${toErrorMessage(sendResult?.error)} diagnostic=${detail || 'n/a'} traceId=${traceId || 'n/a'}`);
    }

    // Stage 6. A validated stale ACK retains only the receiver floor and cannot start a
    // nudge; the caller schedules at most one fresh-snapshot retry from that floor.
    const staleReceiverRevisionFloor = readValidatedStaleReceiverRevisionFloor({ sendResult });
    if (dispatch.shouldApply && staleReceiverRevisionFloor === null) {
      assertAttemptCurrent('before_nudge');
      const nudgeResult = await nudgeDispatchRunner.maybeTriggerProtectionNudge(tabId, url, {
        runtimeOverride: runtimeSnapshot,
        nowOverride: now,
        contentMutationDocumentId: transaction.documentId,
        contentMutationFence: nudgeMutationFence,
      });
      if (nudgeResult?.contentMutationDisposition !== 'same_document_url_overtaken') {
        assertAttemptCurrent('after_nudge');
      }
    }
    return { runtimeSnapshot, sendResult, permissionState: dispatchPermission.permissionState };
  }

  async function runPermissionlessProtectionUpdateTransaction(
    tabId,
    admission,
    options,
    dispatchPermission,
    { fence } = {},
  ) {
    const {
      nowOverride = null,
      filterSettingsOverride = null,
      capStateOverride = null,
      directTriggersOverride = [],
      gateEntryObserved = false,
      skipSettingsEnsure = false,
      forceSnapshot = false,
      abortSignal = null,
    } = options || {};
    const dispatchAbortSignal = requireProtectionDispatchAbortSignal(abortSignal);
    const assertAdmissionCurrent = (phase) => {
      dispatchPermissionGate.assertCurrent(dispatchPermission, phase);
      return assertPermissionlessDispatchAdmissionCurrent(tabId, admission, fence, dispatchAbortSignal, phase);
    };
    const mutationFence = Object.freeze({
      documentId: null,
      assertCurrent: (phase) => {
        const resolvedPhase = `gate_mutation:${phase}`;
        try {
          assertAdmissionCurrent(resolvedPhase);
        } catch (error) {
          if (acceptGateRedirectCommittedOvertake(error, resolvedPhase, {
            tabId,
            url: admission.url,
            hostname: getHostname(admission.url),
            route: 'permissionless_protection_update',
          })) {
            return;
          }
          throw error;
        }
      },
    });

    assertAdmissionCurrent('permissionless_dispatch_start');
    if (!skipSettingsEnsure) {
      await ensureSettingsCache();
      assertAdmissionCurrent('permissionless_settings_ready');
    }
    const now = Number.isFinite(nowOverride) ? nowOverride : Date.now();
    const filterSettings = filterSettingsOverride || await readFilterSettingsSnapshot();
    assertAdmissionCurrent('permissionless_filter_settings_resolved');
    const url = admission.url;
    const hostname = getHostname(url);
    const contentSession = contentScriptRuntime.getTabSession(tabId) || null;
    const needsFreshContentSnapshot = !isDispatchReadyContentSession(contentSession);
    if (needsFreshContentSnapshot) {
      dispatchStateLedger.resetTab(tabId);
    }
    const effectiveForceSnapshot = forceSnapshot || needsFreshContentSnapshot;
    const feedFlowSource = resolveFeedFlowRuntimeSource({
      tabId,
      hostname,
      contentSession,
    });
    const {
      previousEnvelopeState,
      previousRevision,
    } = dispatchStateLedger.getPreviousEnvelopeInput(tabId, {
      forceSnapshot: effectiveForceSnapshot,
    });
    const runtimeSnapshot = await resolveProtectionRuntime(hostname, {
      now,
      filterSettings,
      capStateOverride,
      directTriggers: directTriggersOverride,
      feedFlowSource,
      gateEntryObserved,
      tabId,
      previousEnvelopeState,
      previousRevision,
      forceSnapshot: effectiveForceSnapshot,
    });
    assertAdmissionCurrent('permissionless_runtime_resolved');
    await goalEpisodeInvalidator.revalidate({ tabId, now });
    assertAdmissionCurrent('permissionless_goal_revalidated');
    const {
      messageType,
      traceId,
    } = buildProtectionDispatchPayload({
      hostname,
      runtimeSnapshot,
      settingsCache,
      url,
    });
    const {
      gatePresentation,
      themePresentation,
    } = await gateDispatchBridge.present({
      tabId,
      url,
      runtimeSnapshot,
      now,
      mutationFence,
    });

    if (gatePresentation?.documentDisposition === 'redirected') {
      await gateDispatchBridge.refreshBootstrap({
        hostname,
        runtimeSnapshot,
        now,
        themePresentation,
      });
      return settleGateInterstitialPresented({
        tabId,
        url,
        hostname,
        runtimeSnapshot,
        gatePresentation,
        documentDisposition: 'redirected',
      });
    }

    if (gatePresentation.handled) {
      await gateDispatchBridge.refreshBootstrap({ hostname, runtimeSnapshot, now, themePresentation });
      assertAdmissionCurrent('permissionless_gate_bootstrap_refreshed');
      return settleGateInterstitialPresented({
        tabId, url, hostname, runtimeSnapshot, gatePresentation, documentDisposition: 'preserved',
      });
    }

    dispatchStateLedger.resetDispatchAttempt(tabId);
    if (dispatchPermissionGate.shouldLogSkip({
      tabId,
      hostname,
      reason: dispatchPermission.reason,
      now,
    })) {
      console.debug('[ProtectionDispatcher][skip_dispatch]', {
        tabId,
        hostname,
        reason: dispatchPermission.reason,
        traceId,
      });
    }
    recordContentRuntimeDiagnostic('dispatch_skipped', {
      tabId,
      url,
      route: 'protection_update',
      messageType,
      hostname,
      diagnosticReason: dispatchPermission.reason,
      permissionState: dispatchPermission.permissionState,
      traceId,
    });
    return {
      runtimeSnapshot,
      skipped: dispatchPermission.reason,
      permissionState: dispatchPermission.permissionState,
    };
  }

  async function runProtectionUpdateTransaction(
    tabId,
    admission,
    options,
    {
      fence,
      onTransaction = null,
    } = {},
  ) {
    throwIfProtectionDispatchAborted(options?.abortSignal, 'transaction_start');
    const transactionUrl = admission.url;
    fence.assertCurrent('transaction_before_scope_retirement');
    const scopeRetirement = contentScriptRuntime.readContentScopeRetirement(tabId, { url: transactionUrl });
    if (scopeRetirement !== null) {
      if (!isPlainObject(scopeRetirement) || !Object.isFrozen(scopeRetirement)
        || Object.keys(scopeRetirement).sort().join('|') !== 'attemptId|disposition|documentId|generation'
        || scopeRetirement.disposition !== 'content_scope_retired'
        || typeof scopeRetirement.documentId !== 'string' || !scopeRetirement.documentId
        || scopeRetirement.documentId.trim() !== scopeRetirement.documentId
        || !Number.isSafeInteger(scopeRetirement.attemptId) || scopeRetirement.attemptId <= 0
        || !Number.isSafeInteger(scopeRetirement.generation) || scopeRetirement.generation <= 0) {
        throw Object.assign(new Error('CONTENT_SCOPE_RETIREMENT_RECEIPT_INVALID'), { code: 'CONTENT_SCOPE_RETIREMENT_RECEIPT_INVALID' });
      }
      dispatchStateLedger.resetTab(tabId);
      recordContentRuntimeDiagnostic('protection_dispatch_scope_retired', {
        tabId, documentId: scopeRetirement.documentId, attemptId: scopeRetirement.attemptId,
        generation: scopeRetirement.generation,
      });
      return { skipped: 'content_scope_retired' };
    }
    const permissionNow = Number.isFinite(options?.nowOverride)
      ? options.nowOverride
      : Date.now();
    const dispatchPermission = await dispatchPermissionGate.getState(
      transactionUrl,
      permissionNow,
    );
    fence.assertCurrent('transaction_after_permission');
    dispatchPermissionGate.assertCurrent(dispatchPermission, 'transaction_after_permission');
    throwIfProtectionDispatchAborted(options?.abortSignal, 'permission_resolved');
    if (!dispatchPermission.allowed) {
      return runPermissionlessProtectionUpdateTransaction(
        tabId,
        admission,
        options,
        dispatchPermission,
        { fence },
      );
    }
    const transaction = await prepareContentMutationTransaction(tabId, admission, {
      abortSignal: options?.abortSignal,
      propagationContext: options?.propagationContext,
      fence,
      reason: 'protection_dispatch_transaction',
    });
    if (typeof onTransaction === 'function') onTransaction(transaction);
    const firstResult = await sendProtectionUpdateAttempt(tabId, transactionUrl, options, {
      transaction,
      dispatchPermission,
    });
    const receiverRevisionFloor = readValidatedStaleReceiverRevisionFloor(firstResult);
    if (receiverRevisionFloor === null) return firstResult;

    assertDispatchTransactionCurrent(tabId, transaction, 'before_stale_retry');
    recordContentRuntimeDiagnostic('dispatch_stale_retry_scheduled', {
      tabId,
      hostname: transaction.hostname,
      route: 'protection_update',
      messageType: MESSAGE_TYPES.PROTECTION_UPDATE,
      documentId: transaction.documentId,
      diagnosticReason: 'receiver_revision_floor_advanced',
      receiverRevisionFloor,
    });
    return sendProtectionUpdateAttempt(tabId, transactionUrl, {
      ...options,
      forceSnapshot: true,
    }, {
      transaction,
      dispatchPermission,
    });
  }

  async function prepareContentMutationTransaction(tabId, admission, {
    abortSignal = null,
    propagationContext = null,
    fence,
    reason,
  } = {}) {
    fence.assertCurrent('transaction_before_ready');
    let readiness;
    try {
      readiness = await ensureProtectionDispatchTransactionReady(tabId, contentScriptRuntime, {
        url: admission.url,
        reason,
        expectedDocumentId: admission.documentId,
        abortSignal,
        propagationContext,
      });
    } catch (error) {
      // A receiver that never reported ready because the user navigated away mid-wait is
      // not a content fault. Navigation cancels this lane through the fence, not through
      // `abortSignal`, and the readiness failure is raised inside the call above -- so the
      // fence never got to speak. Ask it first: if the lane was invalidated, that is the
      // truthful cause and it settles as a superseded navigation. If the lane is still
      // current, nothing overtook this dispatch and the original failure stands.
      fence.assertCurrent('transaction_after_ready');
      throw error;
    }
    fence.assertCurrent('transaction_after_ready');
    return captureDispatchTransactionContext({
      tabId,
      url: admission.url,
      expectedDocumentId: admission.documentId,
      admissionSessionGeneration: admission.sessionGeneration,
      serialFence: fence,
      ensureSource: readiness.ensureSource,
    });
  }

  function captureTabUpdatedIngress(tabId, {
    status,
    url,
    observedAt = Date.now(),
  } = {}) {
    if (
      (status !== 'loading' && status !== 'complete')
      || !isWebUrl(url)
    ) {
      return null;
    }
    const sessionSnapshot = requireAtomicContentSessionSnapshot(contentScriptRuntime, tabId);
    const session = sessionSnapshot.session;
    const hasReadySession = isDispatchReadyContentSession(session);
    return tabLifecycleLedger.captureTabUpdated({
      tabId,
      status,
      url,
      observedAt,
      observedDocumentId: hasReadySession
        ? resolveExactDispatchDocumentId(session.documentId)
        : null,
      observedSessionUrl: hasReadySession
        ? resolveExactDispatchHistoryUrl(session.url)
        : null,
      observedSessionGeneration: hasReadySession
        ? sessionSnapshot.generation
        : null,
    });
  }

  function isTabUpdatedIngressCurrent(receipt) {
    return tabLifecycleLedger.isTabUpdatedCurrent(receipt);
  }

  async function sendProtectionUpdate(tabId, url, options = {}) {
    const foregroundSource = requireForegroundDispatchSource(options?.foregroundSource);
    options = { ...options, gateEntryObserved: options.gateEntryObserved === true || !!foregroundSource };
    if (!url || !isWebUrl(url)) return undefined;
    const hasTabUpdatedIngressReceipt = Object.prototype.hasOwnProperty.call(
      options || {},
      'tabUpdatedIngressReceipt',
    );
    if (foregroundSource && hasTabUpdatedIngressReceipt) {
      throw new Error('PROTECTION_DISPATCH_LIFECYCLE_OWNER_CONFLICT');
    }
    const tabUpdatedIngressReceipt = hasTabUpdatedIngressReceipt
      ? claimProtectionTabUpdatedIngressReceipt(options.tabUpdatedIngressReceipt, {
        tabId,
        requestedUrl: url,
      })
      : null;
    if (tabUpdatedIngressReceipt) {
      tabLifecycleLedger.adoptClaimedTabUpdated(tabUpdatedIngressReceipt);
      if (!tabLifecycleLedger.isTabUpdatedCurrent(tabUpdatedIngressReceipt)) {
        const outcome = createProtectionTabUpdatedDispatchOutcome({
          receipt: tabUpdatedIngressReceipt,
          status: 'superseded',
          disposition: 'protection_ingress_superseded',
          errorCode: 'PROTECTION_TAB_UPDATED_INGRESS_SUPERSEDED',
        });
        recordTabUpdatedSettlementDiagnostic(
          'protection_tab_updated_dispatch_settled',
          tabUpdatedIngressReceipt,
          null,
          {
            diagnosticReason: 'newer_ingress_already_observed',
            disposition: outcome.disposition,
          },
        );
        return outcome;
      }
    }
    let expectedDocumentId = null;
    try {
      expectedDocumentId = requireExpectedContentDocumentId(options?.expectedDocumentId);
      requireProtectionDispatchAbortSignal(options?.abortSignal);
    } catch (error) {
      if (!tabUpdatedIngressReceipt) throw error;
      return settleTabUpdatedDispatchRejection(error, tabUpdatedIngressReceipt);
    }

    let admissionInspection = null;
    try {
      admissionInspection = inspectDispatchAdmissionContext({
        tabId,
        url,
        expectedDocumentId,
      });
    } catch (error) {
      if (!tabUpdatedIngressReceipt) throw error;
      return settleTabUpdatedDispatchRejection(error, tabUpdatedIngressReceipt);
    }
    let admission = admissionInspection.admission;
    if (!admission) {
      const mismatch = admissionInspection.mismatch;
      if (!tabUpdatedIngressReceipt) {
        throw createDispatchAdmissionContextMismatchError(mismatch);
      }
      const inspection = mismatch?.reason === 'ready_session_url_mismatch'
        ? await inspectLiveAdmissionTabUpdateReconciliation(
          mismatch,
          tabUpdatedIngressReceipt,
        )
        : inspectTabUpdatedDispatchSettlement(
          createDispatchAdmissionContextMismatchError(mismatch),
          tabUpdatedIngressReceipt,
        );
      if (inspection?.admission) {
        admission = inspection.admission;
        recordTabUpdatedSettlementDiagnostic(
          'protection_tab_updated_admission_url_reconciled',
          tabUpdatedIngressReceipt,
          null,
          {
            diagnosticReason: inspection.diagnosticReason,
            disposition: 'continued_to_protection_transaction',
            diagnostic: inspection.diagnostic || null,
          },
        );
      } else {
        const mismatchError = inspection?.rejectionError instanceof Error
          ? inspection.rejectionError
          : createDispatchAdmissionContextMismatchError(mismatch);
        return finalizeTabUpdatedDispatchInspection(
          mismatchError,
          tabUpdatedIngressReceipt,
          inspection,
        );
      }
    }

    const task = ({ fence }) => runProtectionUpdateTransaction(tabId, admission, options, { fence });
    try {
      const dispatchResult = await dispatchSerialQueue.enqueue(tabId, task);
      if (!tabUpdatedIngressReceipt) return dispatchResult;
      const outcome = createProtectionTabUpdatedDispatchOutcome({
        receipt: tabUpdatedIngressReceipt,
        status: 'applied',
        disposition: 'protection_applied',
        errorCode: null,
        dispatchResult,
      });
      recordTabUpdatedSettlementDiagnostic(
        'protection_tab_updated_dispatch_applied',
        tabUpdatedIngressReceipt,
        null,
        {
          diagnosticReason: 'dispatch_transaction_completed',
          disposition: outcome.disposition,
        },
      );
      return outcome;
    } catch (error) {
      if (foregroundSource) {
        return settleForegroundDispatchCancellation({
          error, queue: dispatchSerialQueue, task, tabId, source: foregroundSource,
          route: 'protection_update', recordDiagnostic: recordContentRuntimeDiagnostic,
        });
      }
      if (!tabUpdatedIngressReceipt) {
        const cancellation = dispatchSerialQueue.getTaskInvalidation(error, task);
        if (
          cancellation?.tabId === tabId
          && (cancellation.code === 'PROTECTION_DISPATCH_SERIAL_QUEUE_INVALIDATED'
            || cancellation.code === 'PROTECTION_DISPATCH_SERIAL_QUEUE_TAB_EVICTED')
        ) {
          // A reservation can abort at the same ingress that revokes its queue
          // fence. Preserve its explicit abort so the caller can settle its own
          // exact lifecycle cancellation; foreign task/errors still reject.
          throwIfProtectionDispatchAborted(options?.abortSignal, cancellation.phase);
        }
        throw error;
      }
      return settleTabUpdatedDispatchFailure(error, tabUpdatedIngressReceipt, task);
    }
  }

  async function maybeTriggerProtectionNudge(tabId, url, options = {}) {
    const foregroundSource = requireForegroundDispatchSource(options?.foregroundSource);
    if (options?.force === true || !url || !isWebUrl(url)) {
      return nudgeDispatchRunner.maybeTriggerProtectionNudge(tabId, url, options);
    }
    const permissionNow = Number.isFinite(options?.nowOverride)
      ? options.nowOverride
      : Date.now();
    const dispatchPermission = await dispatchPermissionGate.getState(url, permissionNow);
    if (!dispatchPermission.allowed) {
      const hostname = getHostname(url);
      recordContentRuntimeDiagnostic('nudge_dispatch_skipped', {
        tabId,
        hostname,
        route: 'nudge_trigger',
        diagnosticReason: dispatchPermission.reason,
        permissionState: dispatchPermission.permissionState,
      });
      return {
        dispatched: false,
        skipped: dispatchPermission.reason,
        hostname,
        permissionState: dispatchPermission.permissionState,
      };
    }
    const admission = captureDispatchAdmissionContext({
      tabId,
      url,
      expectedDocumentId: null,
    });
    const task = async ({ fence }) => {
      dispatchPermissionGate.assertCurrent(dispatchPermission, 'nudge_before_ready');
      const transaction = await prepareContentMutationTransaction(tabId, admission, {
        fence,
        reason: 'nudge_content_mutation_transaction',
      });
      const mutationFence = Object.freeze({
        assertCurrent: (phase) => {
          dispatchPermissionGate.assertCurrent(dispatchPermission, `nudge_mutation:${phase}`);
          assertDispatchTransactionCurrent(tabId, transaction, `nudge_mutation:${phase}`);
        },
      });
      mutationFence.assertCurrent('before_dispatch');
      await goalEpisodeInvalidator.revalidate({ tabId, now: permissionNow });
      mutationFence.assertCurrent('after_goal_revalidation');
      const result = await nudgeDispatchRunner.maybeTriggerProtectionNudge(
        tabId,
        transaction.url,
        {
          ...options,
          contentMutationDocumentId: transaction.documentId,
          contentMutationFence: mutationFence,
        },
      );
      if (result?.contentMutationDisposition !== 'same_document_url_overtaken') {
        mutationFence.assertCurrent('after_dispatch');
      }
      return result;
    };
    try {
      return await dispatchSerialQueue.enqueue(tabId, task);
    } catch (error) {
      if (!foregroundSource) throw error;
      return settleForegroundDispatchCancellation({
        error, queue: dispatchSerialQueue, task, tabId, source: foregroundSource,
        route: 'nudge_trigger', recordDiagnostic: recordContentRuntimeDiagnostic,
      });
    }
  }

  async function sendNudgeStopForTab(tab, { reason = 'nudge_stop', runIds } = {}) {
    if (!Array.isArray(runIds)) throw new Error('NUDGE_STOP_RUN_IDS_REQUIRED');
    return requireNudgeStopAcknowledgement(
      await sendMessageWithRecovery(
        tab.id,
        { type: MESSAGE_TYPES.NUDGE_STOP, payload: { runIds } },
        contentScriptRuntime,
        {
          url: tab.url,
          reason,
          recordDiagnostic: recordContentRuntimeDiagnostic,
          browserPort: resolvedBrowserPort,
        },
      ),
    );
  }

  async function sendNudgeStopForTransaction(tab, transaction, {
    reason = 'nudge_stop',
    runIds,
  } = {}) {
    if (!Array.isArray(runIds)) throw new Error('NUDGE_STOP_RUN_IDS_REQUIRED');
    assertDispatchTransactionCurrent(tab.id, transaction, 'before_nudge_stop');
    const result = requireNudgeStopAcknowledgement(
      requireCurrentDispatchDocument(
        await sendMessageWithRecovery(
          tab.id,
          { type: MESSAGE_TYPES.NUDGE_STOP, payload: { runIds } },
          contentScriptRuntime,
          {
            url: transaction.url,
            reason,
            recordDiagnostic: recordContentRuntimeDiagnostic,
            browserPort: resolvedBrowserPort,
            bindToReadyDocument: true,
            expectedDocumentId: transaction.documentId,
          },
        ),
        contentScriptRuntime.getTabSession(tab.id) || null,
      ),
    );
    assertDispatchTransactionCurrent(tab.id, transaction, 'after_nudge_stop');
    return result;
  }

  async function stopAndTerminalizeNudgeTransaction(tab, transaction, {
    reason,
    now,
  } = {}) {
    const owner = await readActiveNudgeOwnerForTab(tab.id);
    const runIds = owner.owners.map((entry) => entry.runId);
    let stopResult = null;
    let stopError = null;
    try {
      stopResult = await sendNudgeStopForTransaction(tab, transaction, { reason, runIds });
    } catch (error) {
      stopError = error;
    }
    const terminalization = await nudgeTeardownCoordinator.terminalizeGoneTab(tab.id, {
      reason,
      now,
      runIds,
    });
    if (stopError) {
      stopError.nudgeTerminalization = terminalization;
      throw stopError;
    }
    assertDispatchTransactionCurrent(tab.id, transaction, 'after_nudge_terminalization');
    return { stopResult, terminalization };
  }

  async function dispatchBroadcastTarget(tab, protectionOptions, {
    shouldStopNudge,
    now,
  } = {}) {
    let admission = null;
    let dispatchError = null;
    try {
      admission = captureDispatchAdmissionContext({
        tabId: tab.id,
        url: tab.url,
        expectedDocumentId: null,
      });
    } catch (error) {
      dispatchError = error;
    }

    const settleRemoval = (error) => {
      if (dispatchError && dispatchError !== error) return null;
      const evidence = dispatchSerialQueue.getTaskInvalidation(error, task);
      if (evidence?.code !== 'PROTECTION_DISPATCH_SERIAL_QUEUE_TAB_EVICTED'
        || evidence.tabId !== tab.id
        || !['tab_removed', 'tab_replaced'].includes(evidence.reason)) return null;
      // Only this queue's exact task can prove that the target no longer exists.
      // A closed target has no ACK obligation; it is not an applied document.
      recordContentRuntimeDiagnostic('protection_broadcast_target_cancelled', {
        tabId: tab.id, code: evidence.code, reason: evidence.reason, phase: evidence.phase,
      });
      if (protectionOptions.propagationContext) {
        recordContentRuntimeDiagnostic('settings_propagation_target_settled', {
          ...settingsPropagationDiagnostic(protectionOptions.propagationContext),
          tabId: tab.id, status: 'cancelled', reason: evidence.reason,
          errorCode: evidence.code, phase: evidence.phase, nudgeStopAcknowledged: null,
        });
      }
      return { removalCancellation: evidence };
    };
    const task = async ({ fence }) => {
      let result = null;
      let transaction = null;
      if (!dispatchError) {
        try {
          result = await runProtectionUpdateTransaction(
            tab.id,
            admission,
            protectionOptions,
            {
              fence,
              onTransaction: (nextTransaction) => {
                transaction = nextTransaction;
              },
            },
          );
        } catch (error) {
          const cancellation = settleRemoval(error);
          if (cancellation) return cancellation;
          dispatchError = error;
        }
      }

      let nudgeStopResult = null;
      let nudgeStopError = null;
      if (shouldStopNudge && !protectionOptions.abortSignal?.aborted) {
        try {
          if (!transaction || shouldSkipNudgeStopForProtectionResult(result)) {
            await nudgeTeardownCoordinator.terminalizeGoneTab(tab.id, {
              reason: 'settings_nudge_disabled',
              now,
            });
          } else {
            const teardown = await stopAndTerminalizeNudgeTransaction(tab, transaction, {
              reason: 'settings_nudge_disabled',
              now,
            });
            nudgeStopResult = teardown.stopResult;
          }
        } catch (error) {
          if (!dispatchError) {
            const cancellation = settleRemoval(error);
            if (cancellation) return cancellation;
          }
          nudgeStopError = error;
        }
      }

      if (protectionOptions.propagationContext) {
        recordContentRuntimeDiagnostic('settings_propagation_target_settled', {
          ...settingsPropagationDiagnostic(protectionOptions.propagationContext),
          tabId: tab.id, documentId: transaction?.documentId ?? null,
          traceId: result?.runtimeSnapshot?.envelopeResult?.envelope?.trace?.traceId ?? null,
          envelopeRevision: result?.runtimeSnapshot?.envelopeResult?.envelope?.revision ?? null,
          status: protectionOptions.abortSignal?.aborted ? 'cancelled'
            : dispatchError || nudgeStopError ? 'failed' : classifyBroadcastTargetResult(tab, result).status,
          nudgeStopAcknowledged: shouldStopNudge ? nudgeStopResult?.ok === true : null,
        });
      }
      return { dispatchError, nudgeStopError, nudgeStopResult, result };
    };
    try {
      return await dispatchSerialQueue.enqueue(tab.id, task);
    } catch (error) {
      const cancellation = settleRemoval(error);
      if (cancellation) return cancellation;
      throw error;
    }
  }

  async function broadcastSettingsUpdate({ capStateOverride = null, changedKeys = null, propagationContext = null, nowOverride = null } = {}) {
    requireSettingsPropagationContext(propagationContext);
    throwIfSettingsPropagationCancelled(propagationContext, 'broadcast_start');
    const goalPolicyKeys = new Set(['nudgeConfig', 'artifactControlState', 'siteGoals', 'siteGoalMeta', 'globalGoal',
      'blockedUrls', 'allowedUrls', 'filteringMode', 'relaxationSchedule', 'insightsConsent',
      'dataCollectionMode', 'trackingExcludedUrls', 'protectionPresetAssignments', 'protectionPresetCatalog', CYCLE_SETTINGS_KEY]);
    const normalizedGoalKeys = normalizeDispatchChangedKeys(changedKeys);
    if (!normalizedGoalKeys.length || normalizedGoalKeys.some(key => goalPolicyKeys.has(key))) goalEpisodeInvalidator.invalidate();
    clearDispatchPermissionCaches();
    await ensureSettingsCache();
    throwIfSettingsPropagationCancelled(propagationContext, 'broadcast_settings_ready');
    const nowForPlanner = nowOverride === null ? Date.now() : nowOverride;
    if (!Number.isFinite(nowForPlanner)) throw new Error('PROTECTION_BROADCAST_TIME_INVALID');
    await goalEpisodeInvalidator.revalidate({ now: nowForPlanner });
    throwIfSettingsPropagationCancelled(propagationContext, 'broadcast_goals_revalidated');
    let filterSettings = null;
    let broadcastPlan = null;

    try {
      const queryPlan = dispatchPlanner.buildQueryPlan({
        changedKeys,
        now: nowForPlanner,
      });
      let tabsPromise = Promise.resolve([]);
      if (!queryPlan.queryNoTabs) {
        tabsPromise = queryPlan.queryActiveOnly
          ? resolvedBrowserPort.tabsQuery({ active: true })
          : resolvedBrowserPort.tabsQuery({});
      }
      const filterSettingsPromise = queryPlan.queryNoTabs
        ? Promise.resolve(null)
        : readFilterSettingsSnapshot({ skipSettingsEnsure: true });
      const [tabs, nextFilterSettings] = await Promise.all([tabsPromise, filterSettingsPromise]);
      throwIfSettingsPropagationCancelled(propagationContext, 'broadcast_plan_ready');
      filterSettings = nextFilterSettings;
      broadcastPlan = dispatchPlanner.finalizePlan({
        tabs,
        settingsCache,
        lastProtectionContextByTab: dispatchStateLedger.getLastProtectionContextByTab(),
        queryPlan,
      });
    } catch (error) {
      throwIfSettingsPropagationCancelled(propagationContext, 'broadcast_plan_cancelled');
      console.error(`[SETTINGS_FLOW][ProtectionDispatcher][broadcast_plan_failed] changedKeys=${formatLogList(normalizeDispatchChangedKeys(changedKeys))} ${formatBroadcastError(error, 'PROTECTION_BROADCAST_PLAN_FAILED')}`);
      throw error;
    }
    const {
      normalizedKeys,
      nonContentChangedKeys,
      changedFeatureKeys,
      unknownChangedKeys,
      plannerReasons,
      broadcastMode,
      webTabs,
      messageTargets,
    } = broadcastPlan;
    const shouldStopNudge = normalizedKeys.includes('nudgeConfig')
      && mergeNudgeConfig(settingsCache.nudgeConfig).enabled !== true;

    console.debug(`[SETTINGS_FLOW][ProtectionDispatcher][broadcast_plan] changedKeys=${formatLogList(normalizedKeys)} nonContentChangedKeys=${formatLogList(nonContentChangedKeys)} changedFeatureKeys=${formatLogList(changedFeatureKeys)} unknownChangedKeys=${formatLogList(unknownChangedKeys)} plannerReasons=${formatLogList(plannerReasons)} mode=${broadcastMode} webTabCount=${webTabs.length} targetTabCount=${messageTargets.length} nudgeStop=${shouldStopNudge ? 'yes' : 'no'}`);

    if (!messageTargets.length) {
      const summary = buildBroadcastSummary(broadcastMode, []);
      if (propagationContext) recordContentRuntimeDiagnostic('settings_propagation_broadcast_completed', {
        ...settingsPropagationDiagnostic(propagationContext), status: 'no_targets',
        attemptedCount: 0, acknowledgedCount: 0, skippedCount: 0, failedCount: 0,
      });
      if (summary.success) {
        dispatchPlanner.commitSuccessfulFullSweep(broadcastPlan);
      }
      console.debug(`[SETTINGS_FLOW][ProtectionDispatcher][broadcast_complete] ${formatBroadcastSummary(summary)}`);
      return summary;
    }
    const now = nowForPlanner;
    const capState = capStateOverride || await getGlobalCapState(now);
    throwIfSettingsPropagationCancelled(propagationContext, 'broadcast_cap_ready');
    const targetOutcomes = new Array(messageTargets.length);
    try {
      await mapWithConcurrency(
        messageTargets,
        async (tab, index) => {
          if (propagationContext?.signal.aborted) return;
          let targetResult = null;
          try {
            targetResult = await dispatchBroadcastTarget(tab, {
              // Content cannot observe raw local storage. A language mutation
              // must reach its existing authenticated runtime invalidation path.
              forceSnapshot: normalizedKeys.includes('app_language'),
              capStateOverride: capState,
              filterSettingsOverride: filterSettings,
              nowOverride: now,
              skipSettingsEnsure: true,
              abortSignal: propagationContext?.signal ?? null,
              propagationContext,
            }, {
              now,
              shouldStopNudge,
            });
          } catch (error) {
            targetResult = { dispatchError: error };
          }

          if (targetResult.removalCancellation) {
            targetOutcomes[index] = { status: 'skipped' };
            return;
          }

          const {
            dispatchError = null,
            nudgeStopError = null,
            nudgeStopResult = null,
            result = null,
          } = targetResult || {};

          if (dispatchError) {
            targetOutcomes[index] = {
              status: 'failed',
              failure: buildBroadcastTargetFailure(tab, { error: dispatchError }),
            };
            return;
          }

          const protectionOutcome = classifyBroadcastTargetResult(tab, result);
          if (protectionOutcome.status === 'failed') {
            targetOutcomes[index] = protectionOutcome;
            return;
          }
          if (nudgeStopError || (nudgeStopResult && nudgeStopResult.ok !== true)) {
            targetOutcomes[index] = {
              status: 'failed',
              failure: buildBroadcastTargetFailure(tab, {
                error: nudgeStopError,
                sendResult: nudgeStopResult,
                phase: 'nudge_stop',
              }),
            };
            return;
          }
          targetOutcomes[index] = protectionOutcome;
        },
        8,
      );
    } catch (error) {
      throwIfSettingsPropagationCancelled(propagationContext, 'broadcast_fanout_cancelled');
      console.error(`[SETTINGS_FLOW][ProtectionDispatcher][broadcast_fanout_failed] mode=${broadcastMode} ${formatBroadcastError(error, 'PROTECTION_BROADCAST_FANOUT_FAILED')}`);
      throw error;
    }

    throwIfSettingsPropagationCancelled(propagationContext, 'broadcast_settled');
    messageTargets.forEach((tab, index) => {
      if (targetOutcomes[index]) return;
      targetOutcomes[index] = {
        status: 'failed',
        failure: buildBroadcastTargetFailure(tab, {
          error: new Error('PROTECTION_BROADCAST_TARGET_RESULT_MISSING'),
        }),
      };
    });

    const summary = buildBroadcastSummary(broadcastMode, targetOutcomes);
    if (propagationContext) recordContentRuntimeDiagnostic('settings_propagation_broadcast_completed', {
      ...settingsPropagationDiagnostic(propagationContext),
      status: summary.success ? 'acknowledged' : 'failed',
      attemptedCount: summary.attemptedCount,
      acknowledgedCount: summary.acknowledgedCount, skippedCount: summary.skippedCount,
      failedCount: summary.failedCount,
    });
    if (summary.success) {
      dispatchPlanner.commitSuccessfulFullSweep(broadcastPlan);
    }
    const logBroadcastCompletion = summary.success ? console.debug : console.warn;
    logBroadcastCompletion(`[SETTINGS_FLOW][ProtectionDispatcher][broadcast_complete] ${formatBroadcastSummary(summary)}`);
    return summary;
  }

  function invalidateTabForRemoval(tabId, { reason = 'tab_removed' } = {}) {
    tabLifecycleLedger.closeTab(tabId);
    dispatchSerialQueue.closeTab(tabId, { reason });
    dispatchStateLedger.resetTab(tabId);
  }

  function evictTab(tabId, { reason = 'tab_evicted' } = {}) {
    dispatchSerialQueue.evictTab(tabId, { reason });
    dispatchStateLedger.resetTab(tabId);
    tabLifecycleLedger.evictTab(tabId);
    contentScriptRuntime.evictTab(tabId);
  }

  function markTabNavigated(tabId, {
    url = null,
    documentId = null,
    observedAt = Date.now(),
  } = {}) {
    const committed = tabLifecycleLedger.noteCommitted({
      tabId,
      url,
      documentId,
      observedAt,
    });
    dispatchSerialQueue.invalidateTab(tabId, {
      reason: 'web_navigation_committed',
      invalidationTag: committed.generation,
    });
    dispatchStateLedger.resetTab(tabId);
    return committed.proof;
  }

  function markTabUrlChanged(tabId, {
    url = null,
    documentId = null,
    observedAt = Date.now(),
  } = {}) {
    const session = contentScriptRuntime.getTabSession(tabId) || null;
    const history = tabLifecycleLedger.noteHistory({
      tabId,
      url,
      documentId,
      observedAt,
      previousUrl: session?.url || null,
      sessionDocumentId: session?.documentId || null,
      sessionReady: isDispatchReadyContentSession(session),
    });
    dispatchSerialQueue.invalidateTab(tabId, {
      reason: 'web_navigation_history_state_updated',
      invalidationTag: history.generation,
    });
    return history.proof;
  }

  async function revalidateNudgesForTab(tabId, { now = Date.now() } = {}) {
    const initial = tabLifecycleLedger.getSnapshot(tabId);
    const mutationFence = Object.freeze({ assertCurrent(phase) {
      if (initial === null || initial.removed) {
        throw createDispatchTransactionError('PROTECTION_NUDGE_NAVIGATION_INGRESS_REQUIRED', { tabId, phase });
      }
      const current = tabLifecycleLedger.getSnapshot(tabId);
      if (current === null || current.removed
        || current.committedIngressSequence !== initial.committedIngressSequence) {
        throw createDispatchTransactionError('PROTECTION_NUDGE_DOCUMENT_RECONCILIATION_OVERTAKEN', { tabId, phase });
      }
    } });
    return nudgeTeardownCoordinator.reconcileLiveDocument(tabId, { now, mutationFence,
      readCurrentTopFrame: () => resolvedBrowserPort.webNavigationGetFrame({ tabId, frameId: 0 }) });
  }

  async function stopNudgeForTab(tabId, {
    reason = 'nudge_stop',
    now = Date.now(),
  } = {}) {
    let tab = null;
    try {
      tab = await resolvedBrowserPort.tabsGet(tabId);
    } catch (_) {
      tab = null;
    }
    if (!tab || !isWebUrl(tab.url)) {
      return {
        stopResult: null,
        terminalization: await nudgeTeardownCoordinator.terminalizeGoneTab(tabId, {
          reason,
          now,
        }),
      };
    }
    const dispatchPermission = await dispatchPermissionGate.getState(tab.url, now);
    if (!dispatchPermission.allowed) {
      const terminalization = await nudgeTeardownCoordinator.terminalizeGoneTab(tabId, {
        reason,
        now,
      });
      recordContentRuntimeDiagnostic('nudge_stop_skipped', {
        tabId,
        hostname: getHostname(tab.url),
        route: 'nudge_stop',
        diagnosticReason: dispatchPermission.reason,
        permissionState: dispatchPermission.permissionState,
      });
      return {
        stopResult: null,
        terminalization,
        skipped: dispatchPermission.reason,
        permissionState: dispatchPermission.permissionState,
      };
    }
    let admission = null;
    try {
      admission = captureDispatchAdmissionContext({
        tabId,
        url: tab.url,
        expectedDocumentId: null,
      });
    } catch (error) {
      error.nudgeTerminalization = await nudgeTeardownCoordinator.terminalizeGoneTab(tabId, {
        reason,
        now,
      });
      throw error;
    }
    return dispatchSerialQueue.enqueue(tabId, async ({ fence }) => {
      const transaction = await prepareContentMutationTransaction(tabId, admission, {
        fence,
        reason: 'nudge_stop_content_mutation_transaction',
      });
      return stopAndTerminalizeNudgeTransaction(tab, transaction, { reason, now });
    });
  }

  async function refreshFrictionBootstrapForHostname({ hostname, now = Date.now() } = {}) {
    await ensureSettingsCache();
    const readVersion = requireProtectionDispatcherOwnerMethod(settingsService, 'getSettingsChangeVersion', 'COOLING_CURVE_SETTINGS_VERSION_OWNER_REQUIRED');
    const commitVersion = readVersion();
    if (!Number.isSafeInteger(commitVersion) || commitVersion < 0) throw new Error('COOLING_CURVE_SETTINGS_VERSION_INVALID');
    const assertCurrent = () => {
      if (readVersion() !== commitVersion) throw new Error('COOLING_CURVE_BOOTSTRAP_SETTINGS_SUPERSEDED');
    };
    const runtimeSnapshot = await resolveProtectionRuntime(hostname, { now });
    const themePresentation = await gateDispatchBridge.resolveThemePresentation();
    assertCurrent();
    await gateDispatchBridge.refreshBootstrapStrict({ hostname, runtimeSnapshot, now, themePresentation, assertCurrent });
    return runtimeSnapshot;
  }

  return {
    refreshFrictionBootstrapForHostname,
    maybeTriggerProtectionNudge,
    sendProtectionUpdate,
    broadcastSettingsUpdate,
    captureTabUpdatedIngress,
    isTabUpdatedIngressCurrent,
    invalidateDispatchPermissionCaches: () => {
      goalEpisodeInvalidator.invalidate();
      clearDispatchPermissionCaches();
    },
    refreshDispatchPermissionCaches: dispatchPermissionGate.refreshLookups,
    invalidateTabForRemoval,
    markTabNavigated,
    markTabUrlChanged,
    stopNudgeForTab,
    terminalizeNudgesForTab: nudgeTeardownCoordinator.terminalizeGoneTab,
    revalidateNudgesForTab,
    evictTab,
  };
}
