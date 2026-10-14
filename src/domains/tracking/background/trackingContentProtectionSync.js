import {
  isProvenProtectionDispatchDocumentOvertaken,
} from '../../protection/background/protocol/dispatch/ProtectionDispatchTransport.js';
import {
  reportRuntimeDiagnostic,
} from '../../../platform/diagnostics/runtimeDiagnosticConsole.js';

export const CONTENT_BOOTSTRAP_PROTECTION_SYNC_TIMEOUT_MS = 2_000;
export const CONTENT_BOOTSTRAP_PROTECTION_SYNC_MAX_ATTEMPTS = 2;
export const CONTENT_BOOTSTRAP_PROTECTION_SYNC_MAX_TABS = 128;

const PROTECTION_SYNC_READY_STATES = new Set(['receiver_ready', 'active']);
const PROTECTION_SYNC_RETRY_TRIGGERS = new Set([
  'receiver_ready',
  'active_after_receiver_ready',
  'loader_reinjected',
]);
const PROTECTION_SYNC_INVALIDATION_REASONS = new Set([
  'web_navigation_committed',
]);
const PROTECTION_SYNC_EVICTION_REASONS = new Set([
  'tab_removed',
  'tab_replaced',
]);
const PROTECTION_UPDATE_BOOTSTRAP_OWNER_REASONS = new Set([
  'protection_dispatch_transaction',
  'protection_dispatch_transaction:dispatch_ready_retry',
  'protection_dispatch_transaction:receiver_missing',
  'protection_dispatch_transaction:receiver_missing:dispatch_ready_retry',
  'protection_update',
  'protection_update:dispatch_ready_retry',
  'protection_update:receiver_missing',
  'protection_update:receiver_missing:dispatch_ready_retry',
]);

function requireOwnerMethod(owner, methodName, errorCode) {
  if (!owner || typeof owner[methodName] !== 'function') {
    throw new Error(errorCode);
  }
  return owner[methodName].bind(owner);
}

function requireOwnerFunction(owner, errorCode) {
  if (typeof owner !== 'function') throw new Error(errorCode);
  return owner;
}

function requirePositiveInteger(value, fallback, errorCode) {
  if (typeof value === 'undefined') return fallback;
  if (!Number.isSafeInteger(value) || value <= 0) throw new Error(errorCode);
  return value;
}

function requireTabId(value) {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new Error('CONTENT_BOOTSTRAP_PROTECTION_SYNC_TAB_ID_INVALID');
  }
  return value;
}

function requireLifecycleReason(value, allowedReasons, errorCode) {
  if (typeof value !== 'string' || !allowedReasons.has(value)) {
    throw new Error(errorCode);
  }
  return value;
}

function normalizeAttemptId(value) {
  return Number.isSafeInteger(value) && value > 0 ? value : null;
}

function normalizeStartedAt(value) {
  return Number.isSafeInteger(value) && value > 0 ? value : null;
}

function resolveHostname(url) {
  try {
    return new URL(url).hostname.toLowerCase() || null;
  } catch (_error) {
    return null;
  }
}

function normalizeErrorCode(value, fallback = 'CONTENT_BOOTSTRAP_PROTECTION_SYNC_FAILED') {
  const normalized = typeof value === 'string' ? value.trim() : '';
  return /^[A-Z][A-Z0-9_]*(?::[A-Z0-9_]+)*$/.test(normalized)
    ? normalized
    : fallback;
}

function readPermissionChangeDiagnostic(error) {
  if (error?.code !== 'PROTECTION_DISPATCH_PERMISSION_CHANGED') return {};
  const { phase, expectedRevision, currentRevision } = error;
  if (
    typeof phase !== 'string'
    || phase.length > 96
    || !/^[a-z][a-z0-9_]*(?::[a-z][a-z0-9_]*)*$/.test(phase)
    || !Number.isSafeInteger(expectedRevision)
    || expectedRevision < 0
    || !Number.isSafeInteger(currentRevision)
    || currentRevision <= expectedRevision
  ) return {};
  return { phase, expectedRevision, currentRevision };
}

function normalizeReasonCodeFragment(value) {
  const normalized = typeof value === 'string'
    ? value.trim().toUpperCase().replace(/[^A-Z0-9_]+/g, '_')
    : '';
  return normalized && normalized.length <= 96 ? normalized : 'UNSPECIFIED';
}

function createSyncError(code, details = {}) {
  const error = new Error(code);
  error.code = code;
  error.details = Object.freeze({ ...details });
  return error;
}

function resolveTrigger(context) {
  if (context?.status === 'receiver_ready') return 'receiver_ready';
  if (context?.status === 'active') {
    if (context?.reason === 'loader_reinjected') return 'loader_reinjected';
    if (context?.reason === 'bootstrap_active') return 'active_after_receiver_ready';
  }
  return null;
}

function isProtectionUpdateOwnedBootstrap(session) {
  const reason = session?.bootstrapOwnerReason;
  return session?.bootstrapInjectionReason === null
    && typeof reason === 'string'
    && reason === reason.trim()
    && PROTECTION_UPDATE_BOOTSTRAP_OWNER_REASONS.has(reason);
}

function resolveDispatchFailure(result) {
  if (!result || typeof result !== 'object') {
    return createSyncError('CONTENT_BOOTSTRAP_PROTECTION_SYNC_RESULT_MISSING');
  }
  if (result?.sendResult?.ok === true || result?.handled === 'gate_interstitial') {
    return null;
  }
  const sendErrorCode = normalizeErrorCode(result?.sendResult?.error?.code, '');
  if (sendErrorCode) return createSyncError(sendErrorCode);
  if (typeof result?.sendResult?.diagnostic?.reason === 'string') {
    return createSyncError(
      `CONTENT_BOOTSTRAP_PROTECTION_SYNC_SEND_${normalizeReasonCodeFragment(
        result.sendResult.diagnostic.reason,
      )}`,
    );
  }
  if (typeof result?.skipped === 'string' && result.skipped.trim()) {
    return createSyncError(
      `CONTENT_BOOTSTRAP_PROTECTION_SYNC_SKIPPED_${normalizeReasonCodeFragment(result.skipped)}`,
    );
  }
  if (result?.handled === 'gate_interstitial_unavailable') {
    return createSyncError('CONTENT_BOOTSTRAP_PROTECTION_SYNC_GATE_UNAVAILABLE');
  }
  return createSyncError('CONTENT_BOOTSTRAP_PROTECTION_SYNC_NOT_ACKNOWLEDGED');
}

function buildPlanDiagnosticPayload(plan) {
  return {
    tabId: plan.tabId,
    hostname: plan.hostname,
    documentId: plan.documentId,
    sessionKey: plan.sessionKey,
    attemptId: plan.attemptId,
    startedAt: plan.startedAt,
    trigger: plan.trigger,
  };
}

function buildDiagnosticPayload(reservation, extra = {}) {
  return {
    ...buildPlanDiagnosticPayload(reservation.plan),
    syncAttempt: reservation.record.syncAttempt,
    maxAttempts: reservation.maxAttempts,
    ...extra,
  };
}

export function createTrackingContentProtectionSync({
  contentScriptOrchestrator,
  contentRuntimeDiagnostics,
  sendProtectionUpdate,
  captureProfileMutationRuntimeAdmission,
  runCapturedProfileMutationRuntimeTask,
  timeoutMs = CONTENT_BOOTSTRAP_PROTECTION_SYNC_TIMEOUT_MS,
  maxAttempts = CONTENT_BOOTSTRAP_PROTECTION_SYNC_MAX_ATTEMPTS,
  maxTabs = CONTENT_BOOTSTRAP_PROTECTION_SYNC_MAX_TABS,
} = {}) {
  const getTabSession = requireOwnerMethod(
    contentScriptOrchestrator,
    'getTabSession',
    'CONTENT_BOOTSTRAP_CURRENT_SESSION_OWNER_REQUIRED',
  );
  const recordDiagnostic = requireOwnerMethod(
    contentRuntimeDiagnostics,
    'record',
    'CONTENT_BOOTSTRAP_PROTECTION_DIAGNOSTICS_OWNER_REQUIRED',
  );
  const dispatchProtectionUpdate = requireOwnerFunction(
    sendProtectionUpdate,
    'CONTENT_BOOTSTRAP_PROTECTION_UPDATE_OWNER_REQUIRED',
  );
  const captureAdmission = requireOwnerFunction(
    captureProfileMutationRuntimeAdmission,
    'CONTENT_BOOTSTRAP_PROTECTION_ADMISSION_CAPTURE_OWNER_REQUIRED',
  );
  const runCapturedTask = requireOwnerFunction(
    runCapturedProfileMutationRuntimeTask,
    'CONTENT_BOOTSTRAP_PROTECTION_ADMISSION_RUNNER_OWNER_REQUIRED',
  );
  const resolvedTimeoutMs = requirePositiveInteger(
    timeoutMs,
    CONTENT_BOOTSTRAP_PROTECTION_SYNC_TIMEOUT_MS,
    'CONTENT_BOOTSTRAP_PROTECTION_SYNC_TIMEOUT_INVALID',
  );
  const resolvedMaxAttempts = requirePositiveInteger(
    maxAttempts,
    CONTENT_BOOTSTRAP_PROTECTION_SYNC_MAX_ATTEMPTS,
    'CONTENT_BOOTSTRAP_PROTECTION_SYNC_MAX_ATTEMPTS_INVALID',
  );
  const resolvedMaxTabs = requirePositiveInteger(
    maxTabs,
    CONTENT_BOOTSTRAP_PROTECTION_SYNC_MAX_TABS,
    'CONTENT_BOOTSTRAP_PROTECTION_SYNC_MAX_TABS_INVALID',
  );
  const stateByTab = new Map();
  const timeoutErrorByRecord = new WeakMap();
  let stateSequence = 0;

  function safeRecord(event, payload) {
    try {
      return recordDiagnostic(event, payload);
    } catch (_error) {
      reportRuntimeDiagnostic({
        scope: 'TrackingContentRuntime',
        severity: 'error',
        event: 'protection_sync_diagnostic_write_failed',
        code: 'CONTENT_BOOTSTRAP_PROTECTION_SYNC_DIAGNOSTIC_FAILED',
        fields: { diagnosticEvent: event },
      });
      return null;
    }
  }

  function reportFailure(reservation, error) {
    const errorCode = normalizeErrorCode(
      error?.code || error?.message,
      'CONTENT_BOOTSTRAP_PROTECTION_SYNC_FAILED',
    );
    reservation.record.status = 'failed';
    const failureDiagnostic = readPermissionChangeDiagnostic(error);
    if (errorCode === 'CONTENT_BOOTSTRAP_PROTECTION_SYNC_TIMEOUT'
      && Number.isSafeInteger(error?.details?.timeoutMs) && error.details.timeoutMs > 0) {
      failureDiagnostic.timeoutMs = error.details.timeoutMs;
      if (typeof error.phase === 'string' && error.phase.length <= 96
        && /^[a-z][a-z0-9_]*(?::[a-z][a-z0-9_]*)*$/.test(error.phase)) failureDiagnostic.phase = error.phase;
    }
    const payload = buildDiagnosticPayload(reservation, { errorCode, ...failureDiagnostic });
    const queuedRetry = reservation.state.currentRecord;
    if (
      queuedRetry !== reservation.record
      && queuedRetry?.attemptKey === reservation.record.attemptKey
      && queuedRetry?.syncAttempt > reservation.record.syncAttempt
      && ['scheduled', 'running'].includes(queuedRetry?.status)
    ) {
      safeRecord('bootstrap_protection_sync_retry_pending', {
        ...payload,
        pendingSyncAttempt: queuedRetry.syncAttempt,
        pendingStatus: queuedRetry.status,
      });
      return;
    }
    safeRecord('bootstrap_protection_sync_failed', payload);
    reportRuntimeDiagnostic({
      scope: 'TrackingContentRuntime',
      severity: 'error',
      event: 'receiver_ready_protection_sync_failed',
      code: errorCode,
      error,
      fields: {
        ...failureDiagnostic,
        documentId: payload.documentId,
        maxAttempts: payload.maxAttempts,
        syncAttempt: payload.syncAttempt,
        tabId: payload.tabId,
        trigger: payload.trigger,
      },
    });
  }

  function reportSupersededDocument(reservation, error) {
    const currentDocumentId = error?.currentDocumentId
      || error?.details?.currentDocumentId
      || null;
    reservation.record.status = 'superseded';
    safeRecord('bootstrap_protection_sync_document_superseded', buildDiagnosticPayload(
      reservation,
      {
        errorCode: error.code,
        currentDocumentId,
        reason: 'expected_document_overtaken',
      },
    ));
  }

  function settleLifecycleCancellation(reservation, error) {
    const cancellation = reservation.state.lifecycleCancellation;
    const abortSignal = reservation.record.abortController.signal;
    const cancellationWon = !!(
      cancellation
      && cancellation.generation > reservation.stateGeneration
      && abortSignal.aborted
      && abortSignal.reason === cancellation.error
      && (
        error === cancellation.error
        || error?.code === 'PROTECTION_DISPATCH_ABORTED'
      )
    );
    if (!cancellationWon) return false;
    reservation.record.status = cancellation.status;
    safeRecord('bootstrap_protection_sync_cancellation_settled', buildDiagnosticPayload(
      reservation,
      {
        errorCode: cancellation.error.code,
        reason: cancellation.reason,
        status: cancellation.status,
      },
    ));
    return true;
  }

  function settleReservationError(reservation, error) {
    if (settleLifecycleCancellation(reservation, error)) return;
    const isDispatchDocumentOvertaken = isProvenProtectionDispatchDocumentOvertaken(error, {
      tabId: reservation.plan.tabId,
      expectedDocumentId: reservation.plan.documentId,
    });
    const isPostDispatchDocumentOvertaken = (
      error?.code === 'CONTENT_BOOTSTRAP_PROTECTION_SYNC_DOCUMENT_STALE'
      && error?.details?.reason === 'document_replaced'
      && error.details.tabId === reservation.plan.tabId
      && error.details.expectedDocumentId === reservation.plan.documentId
      && typeof error.details.currentDocumentId === 'string'
      && error.details.currentDocumentId.trim()
      && error.details.currentDocumentId === error.details.currentDocumentId.trim()
      && error.details.currentDocumentId !== reservation.plan.documentId
    );
    if (isDispatchDocumentOvertaken || isPostDispatchDocumentOvertaken) {
      reportSupersededDocument(reservation, error);
      return;
    }
    reportFailure(reservation, error);
  }

  function createPlan(context, session) {
    const trigger = resolveTrigger(context);
    if (!trigger) return null;
    const sessionKey = `${context.tabId}:${context.documentId}`;
    if (
      session?.status !== context.status
      || session?.sessionKey !== sessionKey
      || session?.documentId !== context.documentId
      || session?.url !== context.url
      || session?.attemptId !== context.attemptId
      || session?.startedAt !== context.startedAt
    ) {
      return null;
    }
    const attemptId = normalizeAttemptId(session.attemptId);
    const startedAt = normalizeStartedAt(session.startedAt);
    if (attemptId === null) {
      throw createSyncError('CONTENT_BOOTSTRAP_PROTECTION_SYNC_ATTEMPT_ID_REQUIRED');
    }
    if (startedAt === null) {
      throw createSyncError('CONTENT_BOOTSTRAP_PROTECTION_SYNC_STARTED_AT_REQUIRED');
    }
    const plan = Object.freeze({
      tabId: context.tabId,
      documentId: context.documentId,
      sessionKey,
      attemptId,
      startedAt,
      attemptKey: `${sessionKey}:${attemptId}:${startedAt}`,
      url: context.url,
      hostname: resolveHostname(context.url),
      trigger,
    });
    if (isProtectionUpdateOwnedBootstrap(session)) {
      safeRecord('bootstrap_protection_sync_suppressed', {
        ...buildPlanDiagnosticPayload(plan),
        syncAttempt: 0,
        maxAttempts: resolvedMaxAttempts,
        reason: 'protection_update_bootstrap_owned',
        bootstrapOwnerReason: session.bootstrapOwnerReason,
      });
      return null;
    }
    return plan;
  }

  function createState() {
    return {
      currentRecord: null,
      evictRequested: false,
      generation: 0,
      lifecycleCancellation: null,
      lastTouched: ++stateSequence,
      pendingRecords: new Set(),
      tail: Promise.resolve(),
    };
  }

  function requireStateCapacity(tabId) {
    if (stateByTab.has(tabId) || stateByTab.size < resolvedMaxTabs) return;
    const settledCandidate = Array.from(stateByTab.entries())
      .filter(([, state]) => state.pendingRecords.size === 0)
      .sort((left, right) => left[1].lastTouched - right[1].lastTouched)[0];
    if (!settledCandidate) {
      throw createSyncError('CONTENT_BOOTSTRAP_PROTECTION_SYNC_CAPACITY_EXCEEDED', {
        maxTabs: resolvedMaxTabs,
      });
    }
    stateByTab.delete(settledCandidate[0]);
  }

  function reserve(plan) {
    if (!plan) return null;
    requireStateCapacity(plan.tabId);
    const state = stateByTab.get(plan.tabId) || createState();
    if (state.evictRequested) {
      throw createSyncError('CONTENT_BOOTSTRAP_PROTECTION_SYNC_TAB_EVICTED');
    }
    const previousRecord = state.currentRecord;
    const sameAttempt = previousRecord?.attemptKey === plan.attemptKey;
    const activeRetry = sameAttempt
      && ['scheduled', 'running', 'failed'].includes(previousRecord.status)
      && previousRecord.trigger === 'receiver_ready'
      && ['active_after_receiver_ready', 'loader_reinjected'].includes(plan.trigger)
      && previousRecord.syncAttempt < resolvedMaxAttempts;
    const failedHandshakeRetry = sameAttempt
      && previousRecord.status === 'failed'
      && PROTECTION_SYNC_RETRY_TRIGGERS.has(plan.trigger)
      && previousRecord.syncAttempt < resolvedMaxAttempts;
    const conditionalRetry = activeRetry || failedHandshakeRetry;
    if (
      sameAttempt
      && ['scheduled', 'running', 'succeeded'].includes(previousRecord.status)
      && !conditionalRetry
    ) {
      state.lastTouched = ++stateSequence;
      safeRecord('bootstrap_protection_sync_suppressed', {
        ...buildPlanDiagnosticPayload(plan),
        syncAttempt: previousRecord.syncAttempt,
        maxAttempts: resolvedMaxAttempts,
        reason: previousRecord.status === 'succeeded'
          ? 'already_succeeded'
          : 'duplicate_inflight',
      });
      return null;
    }
    if (sameAttempt && previousRecord.syncAttempt >= resolvedMaxAttempts) {
      safeRecord('bootstrap_protection_sync_suppressed', {
        ...buildPlanDiagnosticPayload(plan),
        syncAttempt: previousRecord.syncAttempt,
        maxAttempts: resolvedMaxAttempts,
        reason: 'retry_exhausted',
      });
      return null;
    }

    const record = {
      abortController: new AbortController(),
      attemptKey: plan.attemptKey,
      plan,
      syncAttempt: sameAttempt ? previousRecord.syncAttempt + 1 : 1,
      status: 'scheduled',
      trigger: plan.trigger,
    };
    const reservation = {
      plan,
      record,
      previousTail: state.tail,
      maxAttempts: resolvedMaxAttempts,
      admissionPromise: null,
      retryAfterRecord: activeRetry ? previousRecord : null,
      state,
      stateGeneration: state.generation,
    };
    state.currentRecord = record;
    state.pendingRecords.add(record);
    state.lastTouched = ++stateSequence;
    stateByTab.set(plan.tabId, state);

    try {
      reservation.admissionPromise = Promise.resolve(captureAdmission({
        label: `content_bootstrap_protection_sync:${plan.tabId}:${plan.documentId}:${plan.attemptId}:${record.syncAttempt}`,
      }));
    } catch (error) {
      reservation.admissionPromise = Promise.reject(error);
    }
    void reservation.admissionPromise.catch(() => undefined);
    safeRecord('bootstrap_protection_sync_scheduled', buildDiagnosticPayload(reservation));
    return reservation;
  }

  function assertReservationCurrent(reservation) {
    const current = getTabSession(reservation.plan.tabId);
    const currentDocumentId = typeof current?.documentId === 'string'
      ? current.documentId
      : '';
    if (
      currentDocumentId
      && currentDocumentId === currentDocumentId.trim()
      && currentDocumentId !== reservation.plan.documentId
    ) {
      throw createSyncError('CONTENT_BOOTSTRAP_PROTECTION_SYNC_DOCUMENT_STALE', {
        reason: 'document_replaced',
        tabId: reservation.plan.tabId,
        expectedDocumentId: reservation.plan.documentId,
        currentDocumentId,
      });
    }
    if (
      reservation.state.generation !== reservation.stateGeneration
      || reservation.state.evictRequested
      || current?.sessionKey !== reservation.plan.sessionKey
      || current?.documentId !== reservation.plan.documentId
      || !PROTECTION_SYNC_READY_STATES.has(current?.status)
      || current?.url !== reservation.plan.url
      || current?.attemptId !== reservation.plan.attemptId
      || current?.startedAt !== reservation.plan.startedAt
    ) {
      throw createSyncError('CONTENT_BOOTSTRAP_PROTECTION_SYNC_DOCUMENT_STALE', {
        reason: 'context_changed',
        tabId: reservation.plan.tabId,
        expectedDocumentId: reservation.plan.documentId,
        currentDocumentId: typeof current?.documentId === 'string'
          ? current.documentId
          : null,
      });
    }
  }

  function abortReservation(record, error) {
    if (record?.abortController?.signal?.aborted) return false;
    record.abortController.abort(error);
    return true;
  }

  async function runReservation(reservation) {
    try {
      await reservation.admissionPromise.then((admission) => runCapturedTask({
        admission,
        task: async () => {
          if (reservation.retryAfterRecord?.status === 'succeeded') {
            reservation.record.status = 'suppressed';
            safeRecord('bootstrap_protection_sync_suppressed', buildDiagnosticPayload(reservation, {
              reason: 'prior_attempt_succeeded',
            }));
            return null;
          }
          reservation.record.status = 'running';
          assertReservationCurrent(reservation);
          let timeoutId = null;
          timeoutId = setTimeout(() => {
            const timeoutError = createSyncError('CONTENT_BOOTSTRAP_PROTECTION_SYNC_TIMEOUT', {
              timeoutMs: resolvedTimeoutMs,
            });
            if (abortReservation(reservation.record, timeoutError)) {
              timeoutErrorByRecord.set(reservation.record, timeoutError);
              reservation.record.status = 'timeout_pending';
              safeRecord(
                'bootstrap_protection_sync_timeout_pending',
                buildDiagnosticPayload(reservation, {
                  errorCode: timeoutError.code,
                  reason: 'awaiting_owner_settlement',
                }),
              );
            }
          }, resolvedTimeoutMs);
          try {
            const result = await dispatchProtectionUpdate(
              reservation.plan.tabId,
              reservation.plan.url,
              {
                forceSnapshot: true,
                expectedDocumentId: reservation.plan.documentId,
                abortSignal: reservation.record.abortController.signal,
              },
            );
            if (
              reservation.record.abortController.signal.aborted
              && result?.documentDisposition !== 'redirected'
            ) {
              throw reservation.record.abortController.signal.reason
                || createSyncError('CONTENT_BOOTSTRAP_PROTECTION_SYNC_ABORTED');
            }
            if (result?.documentDisposition !== 'redirected') {
              assertReservationCurrent(reservation);
            }
            const failure = resolveDispatchFailure(result);
            if (failure) throw failure;
            return result;
          } finally {
            if (timeoutId !== null) clearTimeout(timeoutId);
          }
        },
      }));
      if (reservation.record.status === 'suppressed') return;
      reservation.record.status = 'succeeded';
      safeRecord('bootstrap_protection_sync_succeeded', buildDiagnosticPayload(reservation));
    } catch (error) {
      const timeoutError = timeoutErrorByRecord.get(reservation.record);
      const signal = reservation.record.abortController.signal;
      if (error?.code === 'PROTECTION_DISPATCH_ABORTED' && timeoutError
        && signal.aborted && signal.reason === timeoutError) {
        timeoutError.phase = error.phase;
        settleReservationError(reservation, timeoutError);
      } else {
        settleReservationError(reservation, error);
      }
    }
  }

  function finalizeReservation(reservation) {
    const { state } = reservation;
    if (!state.pendingRecords.delete(reservation.record)) {
      throw createSyncError('CONTENT_BOOTSTRAP_PROTECTION_SYNC_PENDING_RECORD_MISSING');
    }
    state.lastTouched = ++stateSequence;
    if (state.evictRequested && state.pendingRecords.size === 0) {
      if (stateByTab.get(reservation.plan.tabId) === state) {
        stateByTab.delete(reservation.plan.tabId);
      }
    }
  }

  function start(reservation) {
    if (!reservation) return false;
    const { state } = reservation;
    const task = Promise.resolve(reservation.previousTail)
      .catch((error) => settleReservationError(reservation, error))
      .then(() => runReservation(reservation))
      .catch((error) => settleReservationError(reservation, error))
      .finally(() => finalizeReservation(reservation));
    void task.catch((error) => settleReservationError(reservation, error));
    state.tail = task.then(() => undefined, () => undefined);
    return true;
  }

  function invalidateTab(tabId, {
    reason,
    documentId = null,
  } = {}) {
    const resolvedTabId = requireTabId(tabId);
    const resolvedReason = requireLifecycleReason(
      reason,
      PROTECTION_SYNC_INVALIDATION_REASONS,
      'CONTENT_BOOTSTRAP_PROTECTION_SYNC_INVALIDATION_REASON_INVALID',
    );
    const state = stateByTab.get(resolvedTabId);
    if (!state) return false;
    state.generation += 1;
    state.lastTouched = ++stateSequence;
    const record = state.currentRecord;
    state.currentRecord = null;
    const error = createSyncError('CONTENT_BOOTSTRAP_PROTECTION_SYNC_INVALIDATED', {
      reason: resolvedReason,
    });
    state.lifecycleCancellation = Object.freeze({
      error,
      generation: state.generation,
      reason: resolvedReason,
      status: 'invalidated',
    });
    state.pendingRecords.forEach((pendingRecord) => abortReservation(pendingRecord, error));
    safeRecord('bootstrap_protection_sync_invalidated', {
      tabId: resolvedTabId,
      hostname: record?.plan?.hostname || null,
      documentId: typeof documentId === 'string' && documentId.trim()
        ? documentId.trim()
        : null,
      sessionKey: null,
      attemptId: null,
      startedAt: null,
      trigger: null,
      syncAttempt: record?.syncAttempt || null,
      maxAttempts: resolvedMaxAttempts,
      reason: resolvedReason,
    });
    return true;
  }

  function evictTab(tabId, { reason } = {}) {
    const resolvedTabId = requireTabId(tabId);
    const resolvedReason = requireLifecycleReason(
      reason,
      PROTECTION_SYNC_EVICTION_REASONS,
      'CONTENT_BOOTSTRAP_PROTECTION_SYNC_EVICTION_REASON_INVALID',
    );
    const state = stateByTab.get(resolvedTabId);
    if (!state) return false;
    state.evictRequested = true;
    state.generation += 1;
    state.lastTouched = ++stateSequence;
    const record = state.currentRecord;
    state.currentRecord = null;
    const error = createSyncError('CONTENT_BOOTSTRAP_PROTECTION_SYNC_EVICTED', {
      reason: resolvedReason,
    });
    state.lifecycleCancellation = Object.freeze({
      error,
      generation: state.generation,
      reason: resolvedReason,
      status: 'evicted',
    });
    state.pendingRecords.forEach((pendingRecord) => abortReservation(pendingRecord, error));
    safeRecord('bootstrap_protection_sync_evicted', {
      tabId: resolvedTabId,
      hostname: null,
      documentId: null,
      sessionKey: null,
      attemptId: null,
      startedAt: null,
      trigger: null,
      syncAttempt: record?.syncAttempt || null,
      maxAttempts: resolvedMaxAttempts,
      reason: resolvedReason,
    });
    if (state.pendingRecords.size === 0) stateByTab.delete(resolvedTabId);
    return true;
  }

  return Object.freeze({
    createPlan,
    evictTab,
    invalidateTab,
    reserve,
    start,
  });
}
