import { MEDIA_FRAME_VIDEO_OBSERVATION_MODES } from '../../../platform/messaging/messageTypes.js';
import {
  CONTENT_RECEIVER_CAPABILITY_VERSION,
} from '../../../platform/messaging/contentReceiverCapability.js';

function normalizeTabId(tabId) {
  if (tabId === null || typeof tabId === 'undefined') return null;
  if (typeof tabId === 'string' && !tabId.trim()) return null;
  const value = Number(tabId);
  if (!Number.isInteger(value) || value < 0) return null;
  return value;
}

function normalizeFrameId(frameId) {
  if (frameId === null || typeof frameId === 'undefined') return null;
  if (typeof frameId === 'string' && !frameId.trim()) return null;
  const value = Number(frameId);
  if (!Number.isInteger(value) || value < 0) return null;
  return value;
}

function normalizeUrl(url, fallback = '') {
  if (typeof url !== 'string') return fallback || '';
  const trimmed = url.trim();
  return trimmed || fallback || '';
}

function normalizeDocumentId(documentId) {
  if (typeof documentId !== 'string') return null;
  const trimmed = documentId.trim();
  return trimmed || null;
}

function normalizeBootstrapInjectionReason(reason) {
  if (typeof reason !== 'string' || !reason || reason !== reason.trim()) return null;
  return reason;
}

function requireBootstrapInjectionGeneration(value) {
  if (!Number.isSafeInteger(value) || value <= 0) {
    const error = new Error('TAB_CONTENT_SESSION_BOOTSTRAP_INJECTION_GENERATION_INVALID');
    error.code = 'TAB_CONTENT_SESSION_BOOTSTRAP_INJECTION_GENERATION_INVALID';
    throw error;
  }
  return value;
}

function requireBootstrapInjectionFailureUrl(value) {
  if (typeof value !== 'string' || value !== value.trim()) {
    const error = new Error('TAB_CONTENT_SESSION_BOOTSTRAP_INJECTION_FAILURE_URL_INVALID');
    error.code = 'TAB_CONTENT_SESSION_BOOTSTRAP_INJECTION_FAILURE_URL_INVALID';
    throw error;
  }
  return value;
}

function requireBootstrapInjectionFailedAt(value) {
  if (!Number.isSafeInteger(value) || value <= 0) {
    const error = new Error('TAB_CONTENT_SESSION_BOOTSTRAP_INJECTION_FAILURE_AT_INVALID');
    error.code = 'TAB_CONTENT_SESSION_BOOTSTRAP_INJECTION_FAILURE_AT_INVALID';
    throw error;
  }
  return value;
}

function requireReadyDocumentUrlRefreshGeneration(value) {
  if (!Number.isSafeInteger(value) || value <= 0) {
    const error = new Error('TAB_CONTENT_SESSION_READY_DOCUMENT_URL_REFRESH_GENERATION_INVALID');
    error.code = 'TAB_CONTENT_SESSION_READY_DOCUMENT_URL_REFRESH_GENERATION_INVALID';
    throw error;
  }
  return value;
}

function requireReadyDocumentUrlRefreshDocumentId(value) {
  const documentId = normalizeDocumentId(value);
  if (!documentId || documentId !== value) {
    const error = new Error('TAB_CONTENT_SESSION_READY_DOCUMENT_URL_REFRESH_DOCUMENT_INVALID');
    error.code = 'TAB_CONTENT_SESSION_READY_DOCUMENT_URL_REFRESH_DOCUMENT_INVALID';
    throw error;
  }
  return documentId;
}

function requireReadyDocumentUrlRefreshUrl(value, field) {
  if (typeof value !== 'string' || !value || value !== value.trim()) {
    const error = new Error(`TAB_CONTENT_SESSION_READY_DOCUMENT_URL_REFRESH_URL_INVALID:${field}`);
    error.code = 'TAB_CONTENT_SESSION_READY_DOCUMENT_URL_REFRESH_URL_INVALID';
    error.field = field;
    throw error;
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
    const error = new Error(`TAB_CONTENT_SESSION_READY_DOCUMENT_URL_REFRESH_URL_INVALID:${field}`);
    error.code = 'TAB_CONTENT_SESSION_READY_DOCUMENT_URL_REFRESH_URL_INVALID';
    error.field = field;
    throw error;
  }
}

function buildSessionKey(tabId, documentId = null) {
  const normalizedTabId = normalizeTabId(tabId);
  if (normalizedTabId === null) return null;
  const normalizedDocumentId = normalizeDocumentId(documentId);
  return normalizedDocumentId
    ? `${normalizedTabId}:${normalizedDocumentId}`
    : `${normalizedTabId}:pending`;
}

function buildMediaFrameMapKey(tabId, frameId) {
  const normalizedTabId = normalizeTabId(tabId);
  const normalizedFrameId = normalizeFrameId(frameId);
  if (normalizedTabId === null || normalizedFrameId === null) return null;
  return `${normalizedTabId}:frame:${normalizedFrameId}`;
}

function buildMediaFrameSessionKey(tabId, frameId, documentId = null) {
  const mapKey = buildMediaFrameMapKey(tabId, frameId);
  if (!mapKey) return null;
  const normalizedDocumentId = normalizeDocumentId(documentId);
  return normalizedDocumentId ? `${mapKey}:${normalizedDocumentId}` : `${mapKey}:pending`;
}

function normalizeNonNegativeInteger(value, fallback = 0) {
  const next = Number(value);
  if (!Number.isFinite(next) || next < 0) return fallback;
  return Math.floor(next);
}

function normalizeBoolean(value) {
  return value === true;
}

function requireMediaFrameVideoObservationMode(frameId, value) {
  const expected = frameId === 0
    ? MEDIA_FRAME_VIDEO_OBSERVATION_MODES.TOP_FRAME_CANONICAL
    : MEDIA_FRAME_VIDEO_OBSERVATION_MODES.FRAME_PROBE_INCREMENTAL;
  if (value !== expected) {
    const error = new Error('MEDIA_FRAME_VIDEO_OBSERVATION_MODE_INVALID');
    error.code = 'MEDIA_FRAME_VIDEO_OBSERVATION_MODE_INVALID';
    error.details = Object.freeze({ frameId, expected, received: value ?? null });
    throw error;
  }
  return expected;
}

function requireMediaFrameObservation(payload) {
  const fail = (field) => {
    const error = new Error(`MEDIA_FRAME_OBSERVATION_INVALID:${field}`);
    error.code = 'MEDIA_FRAME_OBSERVATION_INVALID';
    error.field = field;
    throw error;
  };
  if (!['inactive', 'observing', 'failed', 'observed'].includes(payload.status)) fail('status');
  if (!['open_only', 'open_and_closed'].includes(payload.shadowRootAccess)) fail('shadowRootAccess');
  if (payload.lateShadowDiscovery !== 'explicit_registration_or_document_event') fail('lateShadowDiscovery');
  if (payload.status === 'failed') {
    if (typeof payload.observationError !== 'string' || !payload.observationError.trim()) fail('observationError');
  } else if (payload.observationError !== null) fail('observationError');
  if (payload.status === 'observed') {
    if (!Number.isSafeInteger(payload.videoCount) || payload.videoCount < 0) fail('videoCount');
    if (payload.hasVideo !== (payload.videoCount > 0)) fail('hasVideo');
  } else if (payload.videoCount !== null || payload.hasVideo !== null) {
    fail('unobservedCount');
  }
  return payload.status;
}

function normalizeInvalidDocumentIds(documentIds) {
  if (!Array.isArray(documentIds) || documentIds.length === 0) return [];
  const deduped = [];
  for (const value of documentIds) {
    const normalized = normalizeDocumentId(value);
    if (!normalized || deduped.includes(normalized)) continue;
    deduped.push(normalized);
  }
  return deduped.slice(-8);
}

function appendInvalidDocumentId(documentIds, documentId) {
  const normalized = normalizeDocumentId(documentId);
  if (!normalized) return normalizeInvalidDocumentIds(documentIds);
  return normalizeInvalidDocumentIds([...(Array.isArray(documentIds) ? documentIds : []), normalized]);
}

function shouldInvalidateSession(reason, didChange) {
  if (didChange) return true;
  const normalizedReason = typeof reason === 'string' ? reason.trim().toLowerCase() : '';
  if (!normalizedReason) return false;
  return normalizedReason === 'tab_loading'
    || normalizedReason === 'tab_complete'
    // A top-frame committed navigation replaces the document by definition, so it
    // invalidates even when no URL delta is observable -- a session that never recorded a
    // URL still cannot survive it.
    || normalizedReason === 'web_navigation_committed'
    || normalizedReason.includes('receiver_missing');
}

function cloneSession(session) {
  if (!session || typeof session !== 'object') return null;
  return {
    ...session,
    sessionKey: buildSessionKey(session.tabId, session.documentId),
    invalidDocumentIds: normalizeInvalidDocumentIds(session.invalidDocumentIds),
  };
}

function freezeSessionSnapshot(session) {
  const cloned = cloneSession(session);
  if (!cloned) return null;
  return Object.freeze({
    ...cloned,
    invalidDocumentIds: Object.freeze([...cloned.invalidDocumentIds]),
  });
}

function cloneMediaFrameSession(session) {
  if (!session || typeof session !== 'object') return null;
  return {
    ...session,
    sessionKey: buildMediaFrameSessionKey(session.tabId, session.frameId, session.documentId),
  };
}

function isTerminalStatus(status) {
  return status === 'active' || status === 'failed' || status === 'stale';
}

function isDispatchReadyStatus(status) {
  return status === 'receiver_ready' || status === 'active';
}

function isKnownBootstrapStatus(status) {
  return status === 'bootstrapping' || status === 'receiver_ready' || isTerminalStatus(status);
}

function requireFailedBootstrapError(payload) {
  const error = typeof payload?.error === 'string' && payload.error.trim()
    ? payload.error.trim()
    : null;
  if (!error) {
    const failure = new Error('TAB_CONTENT_SESSION_FAILED_ERROR_REQUIRED');
    failure.code = 'TAB_CONTENT_SESSION_FAILED_ERROR_REQUIRED';
    throw failure;
  }
  return error;
}

function normalizeEpochMs(value) {
  const next = Number(value);
  return Number.isFinite(next) && next > 0 ? Math.floor(next) : null;
}

function normalizeAttemptId(value) {
  const next = Number(value);
  return Number.isInteger(next) && next > 0 ? next : null;
}

function isLoaderReinjectedDispatchReadyState(status, payload, previous) {
  const reason = typeof payload?.reason === 'string' ? payload.reason.trim() : '';
  const previousAttemptId = normalizeAttemptId(previous?.attemptId);
  const incomingAttemptId = normalizeAttemptId(payload?.attemptId);
  const previousStartedAt = normalizeEpochMs(previous?.startedAt);
  const incomingStartedAt = normalizeEpochMs(payload?.startedAt);
  return previous?.status === 'injecting'
    && isDispatchReadyStatus(status)
    && reason === 'loader_reinjected'
    && previousAttemptId !== null
    && incomingAttemptId === previousAttemptId
    && previousStartedAt !== null
    && incomingStartedAt === previousStartedAt;
}

function shouldAdoptLoaderReinjectedAttemptIdentity(
  status,
  payload,
  previous,
  previousInvalidDocumentIds,
) {
  const reason = typeof payload?.reason === 'string' ? payload.reason.trim() : '';
  const incomingDocumentId = normalizeDocumentId(payload?.documentId);
  const incomingAttemptId = normalizeAttemptId(payload?.attemptId);
  const incomingStartedAt = normalizeEpochMs(payload?.startedAt);
  if (
    previous?.status !== 'injecting'
    || !isDispatchReadyStatus(status)
    || reason !== 'loader_reinjected'
    || !incomingDocumentId
    || incomingAttemptId === null
    || incomingStartedAt === null
  ) {
    return false;
  }

  const previousAttemptId = normalizeAttemptId(previous?.attemptId);
  if (previousAttemptId !== null) {
    return incomingAttemptId === previousAttemptId
      && normalizeEpochMs(previous?.startedAt) === incomingStartedAt;
  }

  return normalizeDocumentId(previous?.documentId) === null
    && !previousInvalidDocumentIds.includes(incomingDocumentId);
}

function isLatePhaseRegression(status, payload, previous) {
  const previousStartedAt = normalizeEpochMs(previous?.startedAt);
  const incomingStartedAt = normalizeEpochMs(payload?.startedAt);
  if (!incomingStartedAt || !previousStartedAt || incomingStartedAt <= previousStartedAt) {
    if (status === 'bootstrapping' && isDispatchReadyStatus(previous?.status)) return true;
    if (status === 'receiver_ready' && previous?.status === 'active') return true;
  }
  return false;
}

function isOlderSameDocumentAttempt(payload, previous) {
  const previousDocumentId = normalizeDocumentId(previous?.documentId);
  const incomingDocumentId = normalizeDocumentId(payload?.documentId);
  if (!previousDocumentId || !incomingDocumentId || previousDocumentId !== incomingDocumentId) {
    return false;
  }

  const previousAttemptId = normalizeAttemptId(previous?.attemptId);
  const incomingAttemptId = normalizeAttemptId(payload?.attemptId);
  if (previousAttemptId !== null && incomingAttemptId !== null) {
    if (incomingAttemptId < previousAttemptId) return true;
    if (incomingAttemptId > previousAttemptId) {
      const previousStartedAt = normalizeEpochMs(previous?.startedAt);
      const incomingStartedAt = normalizeEpochMs(payload?.startedAt);
      return !!previousStartedAt && !!incomingStartedAt && incomingStartedAt < previousStartedAt;
    }
  }

  const previousStartedAt = normalizeEpochMs(previous?.startedAt);
  const incomingStartedAt = normalizeEpochMs(payload?.startedAt);
  return !!previousStartedAt && !!incomingStartedAt && incomingStartedAt < previousStartedAt;
}

function isMissingSameDocumentAttemptIdentity(payload, previous) {
  const previousDocumentId = normalizeDocumentId(previous?.documentId);
  const incomingDocumentId = normalizeDocumentId(payload?.documentId);
  if (!previousDocumentId || previousDocumentId !== incomingDocumentId) return false;
  return normalizeAttemptId(previous?.attemptId) !== null
    && normalizeAttemptId(payload?.attemptId) === null;
}

function isSameAttemptTerminalRegression(status, payload, previous) {
  const previousDocumentId = normalizeDocumentId(previous?.documentId);
  const incomingDocumentId = normalizeDocumentId(payload?.documentId);
  if (!previousDocumentId || previousDocumentId !== incomingDocumentId) return false;

  const previousAttemptId = normalizeAttemptId(previous?.attemptId);
  const incomingAttemptId = normalizeAttemptId(payload?.attemptId);
  const previousStartedAt = normalizeEpochMs(previous?.startedAt);
  const incomingStartedAt = normalizeEpochMs(payload?.startedAt);
  const sameAttempt = previousAttemptId !== null && incomingAttemptId !== null
    ? previousAttemptId === incomingAttemptId
    : previousStartedAt !== null
      && incomingStartedAt !== null
      && previousStartedAt === incomingStartedAt;
  if (!sameAttempt) return false;

  if (previous.status === 'active') return status !== 'active' && status !== 'stale';
  if (previous.status === 'failed') return status !== 'failed';
  if (previous.status === 'stale') return status !== 'stale';
  if (previous.status === 'receiver_ready') return status === 'bootstrapping' || status === 'failed';
  return false;
}

function isStaleCrossDocumentUpdate(status, payload, previous) {
  const previousDocumentId = normalizeDocumentId(previous?.documentId);
  const incomingDocumentId = normalizeDocumentId(payload?.documentId);
  if (!previousDocumentId || !incomingDocumentId || incomingDocumentId === previousDocumentId) {
    return false;
  }
  if (!isDispatchReadyStatus(previous?.status) && previous?.status !== 'failed') {
    return false;
  }

  const previousStartedAt = normalizeEpochMs(previous?.startedAt);
  const incomingStartedAt = normalizeEpochMs(payload?.startedAt);
  if (!incomingStartedAt || !previousStartedAt || incomingStartedAt <= previousStartedAt) {
    return isKnownBootstrapStatus(status);
  }
  return false;
}

export function createTabContentSessionRegistry() {
  const sessions = new Map();
  const sessionGenerationByTab = new Map();
  const mediaFrameSessions = new Map();
  const waiters = new Map();
  const skipSessionCommit = Symbol('skipSessionCommit');
  let globalSessionGeneration = 0;

  function advanceSessionGeneration(tabId) {
    const nextGeneration = globalSessionGeneration + 1;
    if (!Number.isSafeInteger(nextGeneration) || nextGeneration <= 0) {
      const error = new Error('TAB_CONTENT_SESSION_GENERATION_EXHAUSTED');
      error.code = 'TAB_CONTENT_SESSION_GENERATION_EXHAUSTED';
      throw error;
    }
    globalSessionGeneration = nextGeneration;
    sessionGenerationByTab.set(tabId, nextGeneration);
    return nextGeneration;
  }

  function settleWaiters(tabId, isReady) {
    const activeWaiters = waiters.get(tabId);
    if (!Array.isArray(activeWaiters) || activeWaiters.length === 0) return;
    waiters.delete(tabId);
    activeWaiters.forEach((entry) => {
      if (entry?.timer) {
        clearTimeout(entry.timer);
      }
      entry?.resolve?.(isReady);
    });
  }

  function commitSession(tabId, nextSession) {
    const normalizedTabId = normalizeTabId(tabId);
    if (normalizedTabId === null) return null;

    const next = nextSession && typeof nextSession === 'object'
      ? {
        ...nextSession,
        tabId: normalizedTabId,
        documentId: normalizeDocumentId(nextSession.documentId),
        sessionKey: buildSessionKey(normalizedTabId, nextSession.documentId),
      }
      : null;

    advanceSessionGeneration(normalizedTabId);

    if (!next) {
      sessions.delete(normalizedTabId);
      settleWaiters(normalizedTabId, false);
      return null;
    }

    sessions.set(normalizedTabId, next);
    if (isDispatchReadyStatus(next.status)) {
      settleWaiters(normalizedTabId, true);
    } else if (next.status === 'failed' || next.status === 'stale') {
      settleWaiters(normalizedTabId, false);
    }
    return cloneSession(next);
  }

  function readSession(tabId) {
    const normalizedTabId = normalizeTabId(tabId);
    if (normalizedTabId === null) return null;
    return cloneSession(sessions.get(normalizedTabId) || null);
  }

  function readSessionSnapshot(tabId) {
    const normalizedTabId = normalizeTabId(tabId);
    if (normalizedTabId === null) {
      return Object.freeze({ generation: 0, session: null });
    }
    return Object.freeze({
      generation: sessionGenerationByTab.get(normalizedTabId) || 0,
      session: freezeSessionSnapshot(sessions.get(normalizedTabId) || null),
    });
  }

  function compareAndRefreshReadyDocumentUrl(tabId, {
    expectedGeneration,
    expectedDocumentId,
    expectedUrl,
    nextUrl,
  } = {}) {
    const normalizedTabId = normalizeTabId(tabId);
    if (normalizedTabId === null) {
      const error = new Error('TAB_CONTENT_SESSION_READY_DOCUMENT_URL_REFRESH_TAB_INVALID');
      error.code = 'TAB_CONTENT_SESSION_READY_DOCUMENT_URL_REFRESH_TAB_INVALID';
      throw error;
    }
    const normalizedExpectedGeneration = requireReadyDocumentUrlRefreshGeneration(
      expectedGeneration,
    );
    const normalizedExpectedDocumentId = requireReadyDocumentUrlRefreshDocumentId(
      expectedDocumentId,
    );
    const normalizedExpectedUrl = requireReadyDocumentUrlRefreshUrl(expectedUrl, 'expectedUrl');
    const normalizedNextUrl = requireReadyDocumentUrlRefreshUrl(nextUrl, 'nextUrl');
    if (normalizedExpectedUrl === normalizedNextUrl) {
      const error = new Error('TAB_CONTENT_SESSION_READY_DOCUMENT_URL_REFRESH_URL_UNCHANGED');
      error.code = 'TAB_CONTENT_SESSION_READY_DOCUMENT_URL_REFRESH_URL_UNCHANGED';
      throw error;
    }

    const currentGeneration = sessionGenerationByTab.get(normalizedTabId) || 0;
    const currentSession = sessions.get(normalizedTabId) || null;
    const generationMatches = currentGeneration === normalizedExpectedGeneration;
    const statusReady = isDispatchReadyStatus(currentSession?.status);
    const documentMatches = currentSession?.documentId === normalizedExpectedDocumentId;
    const urlMatchesExpected = currentSession?.url === normalizedExpectedUrl;
    if (!generationMatches || !statusReady || !documentMatches || !urlMatchesExpected) {
      return Object.freeze({
        refreshed: false,
        beforeGeneration: currentGeneration,
        afterGeneration: currentGeneration,
        generationMatches,
        statusReady,
        documentMatches,
        urlMatchesExpected,
        documentPreserved: documentMatches,
        urlMatchesNext: currentSession?.url === normalizedNextUrl,
      });
    }

    commitSession(normalizedTabId, {
      ...currentSession,
      url: normalizedNextUrl,
      updatedAt: Date.now(),
    });
    const refreshedSnapshot = readSessionSnapshot(normalizedTabId);
    return Object.freeze({
      refreshed: true,
      beforeGeneration: currentGeneration,
      afterGeneration: refreshedSnapshot.generation,
      generationMatches: true,
      statusReady: isDispatchReadyStatus(refreshedSnapshot.session?.status),
      documentMatches: true,
      urlMatchesExpected: true,
      documentPreserved: refreshedSnapshot.session?.documentId === normalizedExpectedDocumentId,
      urlMatchesNext: refreshedSnapshot.session?.url === normalizedNextUrl,
    });
  }

  function readMediaFrameSession(tabId, frameId) {
    const key = buildMediaFrameMapKey(tabId, frameId);
    if (!key) return null;
    return cloneMediaFrameSession(mediaFrameSessions.get(key) || null);
  }

  function writeSession(tabId, updater) {
    const normalizedTabId = normalizeTabId(tabId);
    if (normalizedTabId === null || typeof updater !== 'function') return null;
    const previous = sessions.get(normalizedTabId) || {
      tabId: normalizedTabId,
      status: 'absent',
      url: '',
      reason: null,
      startedAt: null,
      receiverReadyAt: null,
      receiverCapabilityVersion: null,
      activeAt: null,
      failedAt: null,
      error: null,
      documentId: null,
      sessionKey: buildSessionKey(normalizedTabId, null),
      invalidDocumentIds: [],
      bootstrapInjectionReason: null,
      bootstrapInjectionGeneration: null,
      bootstrapOwnerReason: null,
      updatedAt: 0,
      attemptCount: 0,
      attemptId: null,
    };
    const candidate = updater({ ...previous });
    if (candidate === skipSessionCommit) {
      return cloneSession(previous);
    }
    if (!candidate) {
      return commitSession(normalizedTabId, null);
    }
    return commitSession(normalizedTabId, {
      ...previous,
      ...candidate,
      updatedAt: Date.now(),
    });
  }

  function noteInjecting(tabId, { url = '', reason = 'inject' } = {}) {
    return writeSession(tabId, (previous) => {
      const nextAttemptCount = requireBootstrapInjectionGeneration(
        Math.max(0, Number(previous.attemptCount) || 0) + 1,
      );
      return {
        ...previous,
        status: 'injecting',
        url: normalizeUrl(url, previous.url),
        reason,
        bootstrapInjectionReason: normalizeBootstrapInjectionReason(reason),
        bootstrapInjectionGeneration: nextAttemptCount,
        bootstrapOwnerReason: null,
        error: null,
        failedAt: null,
        receiverReadyAt: null,
        activeAt: null,
        documentId: previous.status === 'stale' || previous.status === 'failed'
          ? null
          : previous.documentId,
        invalidDocumentIds: normalizeInvalidDocumentIds(previous.invalidDocumentIds),
        attemptCount: nextAttemptCount,
        startedAt: normalizeAttemptId(previous.attemptId) !== null
          && normalizeEpochMs(previous.startedAt) !== null
          ? normalizeEpochMs(previous.startedAt)
          : Date.now(),
      };
    });
  }

  function releaseBootstrapInjection(
    tabId,
    {
      expectedReason,
      expectedGeneration,
      releaseReason,
    } = {},
  ) {
    const normalizedTabId = normalizeTabId(tabId);
    if (normalizedTabId === null) {
      const error = new Error('TAB_CONTENT_SESSION_BOOTSTRAP_INJECTION_RELEASE_TAB_INVALID');
      error.code = 'TAB_CONTENT_SESSION_BOOTSTRAP_INJECTION_RELEASE_TAB_INVALID';
      throw error;
    }
    const normalizedExpectedReason = normalizeBootstrapInjectionReason(expectedReason);
    if (normalizedExpectedReason === null) {
      const error = new Error('TAB_CONTENT_SESSION_BOOTSTRAP_INJECTION_RELEASE_REASON_INVALID');
      error.code = 'TAB_CONTENT_SESSION_BOOTSTRAP_INJECTION_RELEASE_REASON_INVALID';
      throw error;
    }
    const normalizedExpectedGeneration = requireBootstrapInjectionGeneration(expectedGeneration);
    if (releaseReason !== 'dispatch_ready_timeout') {
      const error = new Error('TAB_CONTENT_SESSION_BOOTSTRAP_INJECTION_RELEASE_CAUSE_INVALID');
      error.code = 'TAB_CONTENT_SESSION_BOOTSTRAP_INJECTION_RELEASE_CAUSE_INVALID';
      throw error;
    }

    let released = false;
    const session = writeSession(normalizedTabId, (previous) => {
      if (
        previous.bootstrapInjectionReason !== normalizedExpectedReason
        || previous.bootstrapInjectionGeneration !== normalizedExpectedGeneration
      ) {
        return skipSessionCommit;
      }
      released = true;
      return {
        ...previous,
        bootstrapInjectionReason: null,
        bootstrapInjectionGeneration: null,
      };
    });
    return Object.freeze({ released, session });
  }

  function failBootstrapInjection(
    tabId,
    {
      expectedReason,
      expectedGeneration,
      url,
      error,
      failedAt,
    } = {},
  ) {
    const normalizedTabId = normalizeTabId(tabId);
    if (normalizedTabId === null) {
      const failure = new Error('TAB_CONTENT_SESSION_BOOTSTRAP_INJECTION_FAILURE_TAB_INVALID');
      failure.code = 'TAB_CONTENT_SESSION_BOOTSTRAP_INJECTION_FAILURE_TAB_INVALID';
      throw failure;
    }
    const normalizedExpectedReason = normalizeBootstrapInjectionReason(expectedReason);
    if (normalizedExpectedReason === null) {
      const failure = new Error('TAB_CONTENT_SESSION_BOOTSTRAP_INJECTION_FAILURE_REASON_INVALID');
      failure.code = 'TAB_CONTENT_SESSION_BOOTSTRAP_INJECTION_FAILURE_REASON_INVALID';
      throw failure;
    }
    const normalizedExpectedGeneration = requireBootstrapInjectionGeneration(expectedGeneration);
    const normalizedUrl = requireBootstrapInjectionFailureUrl(url);
    const normalizedError = requireFailedBootstrapError({ error });
    const normalizedFailedAt = requireBootstrapInjectionFailedAt(failedAt);

    let failed = false;
    const session = writeSession(normalizedTabId, (previous) => {
      if (
        previous.bootstrapInjectionReason !== normalizedExpectedReason
        || previous.bootstrapInjectionGeneration !== normalizedExpectedGeneration
      ) {
        return skipSessionCommit;
      }
      failed = true;
      return {
        ...previous,
        status: 'failed',
        url: normalizeUrl(previous.url, normalizedUrl),
        reason: normalizedExpectedReason,
        error: normalizedError,
        failedAt: normalizedFailedAt,
        bootstrapInjectionReason: null,
        bootstrapInjectionGeneration: null,
        bootstrapOwnerReason: null,
      };
    });
    return Object.freeze({ failed, session });
  }

  function noteBootstrapState(tabId, payload = {}) {
    const status = typeof payload?.status === 'string' ? payload.status.trim().toLowerCase() : '';
    if (!status) return readSession(tabId);
    if (!isKnownBootstrapStatus(status)) return readSession(tabId);
    const incomingDocumentId = normalizeDocumentId(payload?.documentId);

    return writeSession(tabId, (previous) => {
      const previousInvalidDocumentIds = normalizeInvalidDocumentIds(previous.invalidDocumentIds);
      const allowReinjectedDispatchReady = incomingDocumentId
        && previousInvalidDocumentIds.includes(incomingDocumentId)
        && isLoaderReinjectedDispatchReadyState(status, payload, previous);
      const adoptLoaderReinjectedAttemptIdentity = shouldAdoptLoaderReinjectedAttemptIdentity(
        status,
        payload,
        previous,
        previousInvalidDocumentIds,
      );
      if (incomingDocumentId && previousInvalidDocumentIds.includes(incomingDocumentId) && !allowReinjectedDispatchReady) {
        return skipSessionCommit;
      }

      if (!allowReinjectedDispatchReady && isOlderSameDocumentAttempt(payload, previous)) {
        return skipSessionCommit;
      }

      if (!allowReinjectedDispatchReady && isMissingSameDocumentAttemptIdentity(payload, previous)) {
        return skipSessionCommit;
      }

      if (!allowReinjectedDispatchReady && isSameAttemptTerminalRegression(status, payload, previous)) {
        return skipSessionCommit;
      }

      if (isLatePhaseRegression(status, payload, previous)) {
        return skipSessionCommit;
      }

      if (isStaleCrossDocumentUpdate(status, payload, previous)) {
        return {
          ...previous,
          invalidDocumentIds: appendInvalidDocumentId(
            previousInvalidDocumentIds,
            incomingDocumentId,
          ),
        };
      }

      const documentId = incomingDocumentId || previous.documentId || null;
      const failedError = status === 'failed' ? requireFailedBootstrapError(payload) : null;
      const incomingAttemptId = normalizeAttemptId(payload?.attemptId);
      const documentReplaced = !!(
        incomingDocumentId
        && previous.documentId
        && incomingDocumentId !== previous.documentId
      );
      const loaderReinjectedDocumentIdentityCompatible = !previous.documentId
        || previous.documentId === incomingDocumentId;
      const certifyLoaderReinjectedActiveOwner = status === 'active'
        && loaderReinjectedDocumentIdentityCompatible
        && (allowReinjectedDispatchReady || adoptLoaderReinjectedAttemptIdentity);
      const next = {
        ...previous,
        status,
        attemptId: incomingAttemptId ?? previous.attemptId ?? null,
        url: normalizeUrl(payload.url, previous.url),
        documentId,
        receiverCapabilityVersion:
          payload?.receiverCapabilityVersion === CONTENT_RECEIVER_CAPABILITY_VERSION
            ? CONTENT_RECEIVER_CAPABILITY_VERSION
            : null,
        invalidDocumentIds: allowReinjectedDispatchReady
          ? previousInvalidDocumentIds.filter((value) => value !== incomingDocumentId)
          : incomingDocumentId && previous.documentId && incomingDocumentId !== previous.documentId
            ? previousInvalidDocumentIds.filter((value) => value !== incomingDocumentId)
            : previousInvalidDocumentIds,
        bootstrapInjectionReason: documentReplaced
          ? null
          : normalizeBootstrapInjectionReason(previous.bootstrapInjectionReason),
        bootstrapInjectionGeneration: documentReplaced
          ? null
          : previous.bootstrapInjectionGeneration,
        bootstrapOwnerReason: documentReplaced
          ? null
          : normalizeBootstrapInjectionReason(previous.bootstrapOwnerReason),
        reason: typeof payload?.reason === 'string' && payload.reason.trim()
          ? payload.reason.trim()
          : previous.reason,
        error: failedError || (
          typeof payload?.error === 'string' && payload.error.trim()
            ? payload.error.trim()
            : null
        ),
      };

      if (status === 'bootstrapping') {
        next.bootstrapOwnerReason = null;
        next.startedAt = Number.isFinite(Number(payload.startedAt))
          ? Math.floor(Number(payload.startedAt))
          : (previous.startedAt || Date.now());
        next.receiverReadyAt = null;
        next.activeAt = null;
        next.failedAt = null;
      } else if (status === 'receiver_ready') {
        next.receiverReadyAt = Number.isFinite(Number(payload.receiverReadyAt))
          ? Math.floor(Number(payload.receiverReadyAt))
          : Date.now();
        next.error = null;
        if (adoptLoaderReinjectedAttemptIdentity) {
          next.startedAt = normalizeEpochMs(payload.startedAt);
        } else if (!next.startedAt) {
          next.startedAt = Number.isFinite(Number(payload.startedAt))
            ? Math.floor(Number(payload.startedAt))
            : next.receiverReadyAt;
        }
        if (next.bootstrapInjectionReason !== null) {
          next.bootstrapOwnerReason = next.bootstrapInjectionReason;
        }
        next.bootstrapInjectionReason = null;
        next.bootstrapInjectionGeneration = null;
      } else if (status === 'active') {
        next.activeAt = Number.isFinite(Number(payload.activeAt))
          ? Math.floor(Number(payload.activeAt))
          : Date.now();
        next.error = null;
        if (adoptLoaderReinjectedAttemptIdentity) {
          next.startedAt = normalizeEpochMs(payload.startedAt);
        } else if (!next.startedAt) {
          next.startedAt = Number.isFinite(Number(payload.startedAt))
            ? Math.floor(Number(payload.startedAt))
            : next.activeAt;
        }
        if (!next.receiverReadyAt) {
          next.receiverReadyAt = Number.isFinite(Number(payload.receiverReadyAt))
            ? Math.floor(Number(payload.receiverReadyAt))
            : next.activeAt;
        }
        if (
          certifyLoaderReinjectedActiveOwner
          && next.bootstrapInjectionReason !== null
        ) {
          next.bootstrapOwnerReason = next.bootstrapInjectionReason;
        }
        next.bootstrapInjectionReason = null;
        next.bootstrapInjectionGeneration = null;
      } else if (status === 'failed') {
        next.failedAt = Number.isFinite(Number(payload.failedAt))
          ? Math.floor(Number(payload.failedAt))
          : Date.now();
        next.bootstrapInjectionReason = null;
        next.bootstrapInjectionGeneration = null;
        next.bootstrapOwnerReason = null;
      } else if (status === 'stale') {
        next.failedAt = null;
        next.activeAt = null;
        next.bootstrapInjectionReason = null;
        next.bootstrapInjectionGeneration = null;
        next.bootstrapOwnerReason = null;
      }

      if (isTerminalStatus(status) || status === 'bootstrapping' || status === 'receiver_ready') {
        return next;
      }

      return {
        ...next,
        status: previous.status,
      };
    });
  }

  function noteMediaFrameState(tabId, payload = {}) {
    const normalizedTabId = normalizeTabId(tabId);
    const frameId = normalizeFrameId(payload?.frameId);
    const mapKey = buildMediaFrameMapKey(normalizedTabId, frameId);
    if (!mapKey) return null;
    const videoObservationMode = requireMediaFrameVideoObservationMode(
      frameId,
      payload?.videoObservationMode,
    );
    const observationStatus = requireMediaFrameObservation(payload);

    const previous = mediaFrameSessions.get(mapKey) || {
      tabId: normalizedTabId,
      frameId,
      documentId: null,
      sessionKey: buildMediaFrameSessionKey(normalizedTabId, frameId, null),
      status: 'absent',
      url: '',
      reason: null,
      startedAt: null,
      lastReportedAt: null,
      updatedAt: 0,
      hasVideo: false,
      videoCount: 0,
      htmlVideoElementAvailable: false,
      readyState: null,
      visibilityState: null,
      topFrame: frameId === 0,
      frameKind: frameId === 0 ? 'top' : 'frame',
      videoObservationMode,
    };
    const documentId = normalizeDocumentId(payload?.documentId) || previous.documentId || null;
    const now = Date.now();
    const observed = observationStatus === 'observed';
    const videoCount = observed ? payload.videoCount : null;
    const next = {
      ...previous,
      tabId: normalizedTabId,
      frameId,
      documentId,
      sessionKey: buildMediaFrameSessionKey(normalizedTabId, frameId, documentId),
      status: observationStatus,
      observationError: payload.observationError,
      shadowRootAccess: payload.shadowRootAccess,
      lateShadowDiscovery: payload.lateShadowDiscovery,
      url: normalizeUrl(payload?.url, previous.url),
      reason: typeof payload?.reason === 'string' && payload.reason.trim()
        ? payload.reason.trim()
        : previous.reason,
      startedAt: normalizeEpochMs(payload?.startedAt) || previous.startedAt || now,
      lastReportedAt: normalizeEpochMs(payload?.reportedAt) || now,
      updatedAt: now,
      hasVideo: observed ? videoCount > 0 : null,
      videoCount,
      htmlVideoElementAvailable: normalizeBoolean(payload?.htmlVideoElementAvailable),
      readyState: typeof payload?.readyState === 'string' && payload.readyState.trim()
        ? payload.readyState.trim()
        : null,
      visibilityState: typeof payload?.visibilityState === 'string' && payload.visibilityState.trim()
        ? payload.visibilityState.trim()
        : null,
      topFrame: frameId === 0,
      frameKind: frameId === 0 ? 'top' : 'frame',
      videoObservationMode,
    };

    mediaFrameSessions.set(mapKey, next);
    return cloneMediaFrameSession(next);
  }

  function markMediaFramesStale(tabId, { url = '', reason = 'navigation' } = {}) {
    const normalizedTabId = normalizeTabId(tabId);
    if (normalizedTabId === null) return [];
    const updated = [];
    for (const [key, session] of mediaFrameSessions.entries()) {
      if (session.tabId !== normalizedTabId) continue;
      const next = {
        ...session,
        status: 'stale',
        url: normalizeUrl(url, session.url),
        reason,
        updatedAt: Date.now(),
      };
      mediaFrameSessions.set(key, next);
      updated.push(cloneMediaFrameSession(next));
    }
    return updated;
  }

  function markNavigated(tabId, { url = '', reason = 'navigation' } = {}) {
    markMediaFramesStale(tabId, { url, reason });
    let invalidated = false;
    const session = writeSession(tabId, (previous) => {
      const normalizedUrl = normalizeUrl(url, previous.url);
      const didChange = normalizedUrl && previous.url && normalizedUrl !== previous.url;
      const shouldInvalidate = shouldInvalidateSession(reason, didChange);
      invalidated = shouldInvalidate;
      if (!shouldInvalidate) {
        return {
          ...previous,
          url: normalizedUrl,
          reason,
          invalidDocumentIds: normalizeInvalidDocumentIds(previous.invalidDocumentIds),
        };
      }
      return {
        ...previous,
        status: previous.status === 'absent' ? 'absent' : 'stale',
        url: normalizedUrl,
        reason,
        error: null,
        bootstrapInjectionReason: null,
        bootstrapInjectionGeneration: null,
        bootstrapOwnerReason: null,
        invalidDocumentIds: appendInvalidDocumentId(previous.invalidDocumentIds, previous.documentId),
      };
    });
    // `commitSession` only settles waiters for a status it can transition into, and an
    // `absent` session stays `absent` across a navigation -- there was never a receiver to
    // make stale. A pending `waitForDispatchReady` asks "will this become dispatch-ready?",
    // and an invalidating navigation answers no for every prior status, so release it here
    // rather than letting it burn its full budget on a document that is already gone.
    if (invalidated) settleWaiters(normalizeTabId(tabId), false);
    return session;
  }

  function refreshScope(tabId, { url = '', reason = 'scope_refresh' } = {}) {
    return writeSession(tabId, (previous) => ({
      ...previous,
      url: normalizeUrl(url, previous.url),
      reason,
      invalidDocumentIds: normalizeInvalidDocumentIds(previous.invalidDocumentIds),
    }));
  }

  function evict(tabId) {
    const normalizedTabId = normalizeTabId(tabId);
    if (normalizedTabId === null) return null;
    const previous = sessions.get(normalizedTabId) || null;
    commitSession(normalizedTabId, null);
    for (const [key, session] of mediaFrameSessions.entries()) {
      if (session.tabId === normalizedTabId) mediaFrameSessions.delete(key);
    }
    return cloneSession(previous);
  }

  function list() {
    return Array.from(sessions.values()).map((session) => cloneSession(session));
  }

  function listMediaFrameSessions({ tabId = null } = {}) {
    const normalizedTabId = tabId === null || typeof tabId === 'undefined'
      ? null
      : normalizeTabId(tabId);
    return Array.from(mediaFrameSessions.values())
      .filter((session) => normalizedTabId === null || session.tabId === normalizedTabId)
      .map((session) => cloneMediaFrameSession(session));
  }

  function waitForDispatchReady(tabId, { timeoutMs = 1500, signal = null } = {}) {
    const normalizedTabId = normalizeTabId(tabId);
    if (normalizedTabId === null || signal?.aborted) return Promise.resolve(false);

    const existing = sessions.get(normalizedTabId) || null;
    if (isDispatchReadyStatus(existing?.status)) return Promise.resolve(true);
    if (existing?.status === 'failed' || existing?.status === 'stale') return Promise.resolve(false);
    const normalizedTimeoutMs = Number(timeoutMs);
    if (!Number.isFinite(normalizedTimeoutMs) || normalizedTimeoutMs <= 0) {
      return Promise.resolve(false);
    }

    return new Promise((resolve) => {
      let settled = false;
      let timer = null;
      const finish = (ready) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        signal?.removeEventListener('abort', abort);
        const active = waiters.get(normalizedTabId);
        if (Array.isArray(active)) {
          const remaining = active.filter((entry) => entry && entry.resolve !== finish);
          if (remaining.length) waiters.set(normalizedTabId, remaining);
          else waiters.delete(normalizedTabId);
        }
        resolve(ready);
      };
      const abort = () => finish(false);
      timer = setTimeout(() => finish(false), Math.floor(normalizedTimeoutMs));

      const entries = waiters.get(normalizedTabId) || [];
      entries.push({ resolve: finish, timer });
      waiters.set(normalizedTabId, entries);
      signal?.addEventListener('abort', abort, { once: true });
      if (signal?.aborted) abort();
    });
  }

  return {
    compareAndRefreshReadyDocumentUrl,
    get: readSession,
    getSnapshot: readSessionSnapshot,
    getMediaFrameSession: readMediaFrameSession,
    list,
    listMediaFrameSessions,
    noteBootstrapState,
    noteMediaFrameState,
    noteInjecting,
    failBootstrapInjection,
    releaseBootstrapInjection,
    markNavigated,
    refreshScope,
    markMediaFramesStale,
    evict,
    waitForDispatchReady,
  };
}
