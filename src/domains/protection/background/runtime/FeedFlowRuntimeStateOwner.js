import {
  cloneFeedFlowSnapshot,
  isNormalizedFeedFlowSnapshot,
  normalizeFeedFlowSnapshot,
} from '../../contracts/feedFlowSnapshotBridge.js';

const FEED_FLOW_SOURCE_LIMIT = 256;
const FEED_FLOW_INVALID_DOCUMENT_LIMIT = 8;
const FEED_FLOW_CONTENT_METRIC_FIELDS = Object.freeze([
  'advanceCount',
  'screenfulsConsumed',
  'itemTransitions',
  'freshItemsSeen',
  'medianDwellMs',
  'maxPauseMs',
]);

function normalizeHost(hostname) {
  return typeof hostname === 'string' ? hostname.trim().toLowerCase() : '';
}

function normalizeTabId(tabId, fallback = null) {
  const value = Number(tabId);
  return Number.isInteger(value) && value >= 0 ? value : fallback;
}

function requireFeedFlowTabId(tabId) {
  if (tabId === null || tabId === undefined || tabId === '') {
    throw new Error('PROTECTION_FEED_FLOW_SOURCE_TAB_ID_INVALID');
  }
  const normalizedTabId = normalizeTabId(tabId, null);
  if (normalizedTabId === null) {
    throw new Error('PROTECTION_FEED_FLOW_SOURCE_TAB_ID_INVALID');
  }
  return normalizedTabId;
}

function requireFeedFlowDocumentId(documentId) {
  if (typeof documentId !== 'string' || !documentId.trim()) {
    throw new Error('PROTECTION_FEED_FLOW_SOURCE_DOCUMENT_ID_INVALID');
  }
  return documentId.trim();
}

function buildFeedFlowSource({
  tabId,
  documentId,
  hostname,
} = {}) {
  const normalizedTabId = requireFeedFlowTabId(tabId);
  const normalizedDocumentId = requireFeedFlowDocumentId(documentId);
  const normalizedHostname = normalizeHost(hostname);
  return {
    tabId: normalizedTabId,
    documentId: normalizedDocumentId,
    hostname: normalizedHostname,
    sessionKey: `${normalizedTabId}:${normalizedDocumentId}`,
  };
}

function readFeedFlowMetric(snapshot, fieldName) {
  const value = Number(snapshot?.metrics?.[fieldName]);
  return Number.isFinite(value) && value >= 0 ? value : 0;
}

function hasEquivalentFeedContentMetrics(previous, next) {
  return FEED_FLOW_CONTENT_METRIC_FIELDS.every((fieldName) => {
    if (fieldName === 'medianDwellMs') {
      const previousValue = previous?.metrics?.medianDwellMs;
      const nextValue = next?.metrics?.medianDwellMs;
      return previousValue === nextValue;
    }
    return readFeedFlowMetric(previous, fieldName) === readFeedFlowMetric(next, fieldName);
  });
}

function hasEquivalentFeedFlowSnapshot(previous, next) {
  return JSON.stringify(previous) === JSON.stringify(next);
}

function hasEquivalentFeedFlowSignals(previous, next) {
  const previousDirect = Array.isArray(previous?.directTriggers) ? previous.directTriggers.join('|') : '';
  const nextDirect = Array.isArray(next?.directTriggers) ? next.directTriggers.join('|') : '';
  const previousPressure = Array.isArray(previous?.pressureSignals) ? previous.pressureSignals.join('|') : '';
  const nextPressure = Array.isArray(next?.pressureSignals) ? next.pressureSignals.join('|') : '';
  return previous?.state === next?.state
    && previous?.surfaceMode === next?.surfaceMode
    && previousDirect === nextDirect
    && previousPressure === nextPressure;
}

function hasEquivalentFeedContentFlow(previous, next) {
  return hasEquivalentFeedFlowSignals(previous, next)
    && hasEquivalentFeedContentMetrics(previous, next);
}

function hasEquivalentFeedReadiness(previous, next) {
  return previous?.readiness?.status === next?.readiness?.status
    && previous?.readiness?.capability === next?.readiness?.capability
    && previous?.readiness?.profileId === next?.readiness?.profileId
    && previous?.actuationSafety?.status === next?.actuationSafety?.status
    && previous?.actuationSafety?.capability === next?.actuationSafety?.capability;
}

function hasMatchingFeedFlowOrder(left, right) {
  if (!left || !right) return left === right;
  return left.checkedAt === right.checkedAt
    && left.snapshotRevision === right.snapshotRevision;
}

export function createFeedFlowRuntimeStateOwner({
  sourceLimit = FEED_FLOW_SOURCE_LIMIT,
} = {}) {
  if (!Number.isSafeInteger(sourceLimit) || sourceLimit <= 0) {
    throw new Error('PROTECTION_FEED_FLOW_SOURCE_LIMIT_INVALID');
  }

  const feedFlowSourceByTabId = new Map();
  const invalidFeedFlowDocumentIdsByTabId = new Map();

  function getInvalidFeedFlowDocumentIds(tabId) {
    return invalidFeedFlowDocumentIdsByTabId.get(tabId) || [];
  }

  function rememberInvalidFeedFlowDocumentId(tabId, documentId) {
    if (!documentId) return;
    const nextDocumentIds = [
      ...getInvalidFeedFlowDocumentIds(tabId).filter((value) => value !== documentId),
      documentId,
    ].slice(-FEED_FLOW_INVALID_DOCUMENT_LIMIT);
    invalidFeedFlowDocumentIdsByTabId.set(tabId, nextDocumentIds);
  }

  function isInvalidFeedFlowDocumentId(tabId, documentId) {
    return getInvalidFeedFlowDocumentIds(tabId).includes(documentId);
  }

  function getFeedFlowSnapshot({
    hostname = '',
    tabId = null,
    documentId = null,
    now = Date.now(),
  } = {}) {
    const source = buildFeedFlowSource({ tabId, documentId, hostname });
    if (!source.hostname) return null;

    const sourceState = feedFlowSourceByTabId.get(source.tabId) || null;
    if (
      !sourceState
      || sourceState.hostname !== source.hostname
      || sourceState.documentId !== source.documentId
      || !sourceState.runtimeSnapshot
    ) {
      return null;
    }
    if ((Number(sourceState.runtimeSnapshot.expiresAt) || 0) <= now) {
      sourceState.runtimeSnapshot = null;
      return null;
    }
    return cloneFeedFlowSnapshot(sourceState.runtimeSnapshot);
  }

  function prepareFeedFlowSnapshot({
    hostname = '',
    tabId = null,
    documentId = null,
    snapshot = null,
  } = {}) {
    const source = buildFeedFlowSource({ tabId, documentId, hostname });
    if (!source.hostname) {
      return {
        source,
        snapshot: null,
        accepted: false,
        staleDocument: false,
        outOfOrder: false,
        duplicate: false,
        incomingCheckedAt: null,
        retainedCheckedAt: null,
        incomingRevision: null,
        retainedRevision: null,
        changed: false,
        flowChanged: false,
        readinessChanged: false,
        metricChanged: false,
        contentFlowChanged: false,
      };
    }

    const normalizedSnapshot = isNormalizedFeedFlowSnapshot(snapshot)
      && snapshot.host === source.hostname
      ? snapshot
      : normalizeFeedFlowSnapshot(snapshot, { host: source.hostname });
    const retainedSourceState = feedFlowSourceByTabId.get(source.tabId) || null;
    if (isInvalidFeedFlowDocumentId(source.tabId, source.documentId)) {
      return {
        source,
        snapshot: cloneFeedFlowSnapshot(retainedSourceState?.runtimeSnapshot || null),
        accepted: false,
        staleDocument: true,
        outOfOrder: false,
        duplicate: false,
        incomingCheckedAt: normalizedSnapshot.checkedAt,
        retainedCheckedAt: retainedSourceState?.order?.checkedAt ?? null,
        incomingRevision: normalizedSnapshot.snapshotRevision,
        retainedRevision: retainedSourceState?.order?.snapshotRevision ?? null,
        changed: false,
        flowChanged: false,
        readinessChanged: false,
        metricChanged: false,
        contentFlowChanged: false,
      };
    }
    if (
      retainedSourceState
      && retainedSourceState.documentId !== source.documentId
    ) {
      throw new Error(
        `PROTECTION_FEED_FLOW_SOURCE_DOCUMENT_CHANGED:${retainedSourceState.documentId}:${source.documentId}`,
      );
    }
    if (retainedSourceState && retainedSourceState.hostname !== source.hostname) {
      throw new Error(
        `PROTECTION_FEED_FLOW_SOURCE_HOST_CHANGED:${retainedSourceState.hostname}:${source.hostname}`,
      );
    }
    const retainedSnapshot = retainedSourceState?.runtimeSnapshot || null;
    const retainedAcceptedSnapshot = retainedSourceState?.lastAcceptedSnapshot || null;
    const retainedOrder = retainedSourceState?.order || null;
    const olderCheckedAt = retainedOrder
      && normalizedSnapshot.checkedAt < retainedOrder.checkedAt;
    const olderRevisionAtSameTime = retainedOrder
      && normalizedSnapshot.checkedAt === retainedOrder.checkedAt
      && normalizedSnapshot.snapshotRevision < retainedOrder.snapshotRevision;
    if (olderCheckedAt || olderRevisionAtSameTime) {
      return {
        source,
        snapshot: cloneFeedFlowSnapshot(retainedSnapshot),
        accepted: false,
        staleDocument: false,
        outOfOrder: true,
        duplicate: false,
        incomingCheckedAt: normalizedSnapshot.checkedAt,
        retainedCheckedAt: retainedOrder.checkedAt,
        incomingRevision: normalizedSnapshot.snapshotRevision,
        retainedRevision: retainedOrder.snapshotRevision,
        changed: false,
        flowChanged: false,
        readinessChanged: false,
        metricChanged: false,
        contentFlowChanged: false,
      };
    }
    const duplicate = retainedOrder
      && normalizedSnapshot.checkedAt === retainedOrder.checkedAt
      && normalizedSnapshot.snapshotRevision === retainedOrder.snapshotRevision;
    if (duplicate) {
      if (!hasEquivalentFeedFlowSnapshot(retainedAcceptedSnapshot, normalizedSnapshot)) {
        throw new Error('PROTECTION_FEED_FLOW_DUPLICATE_REVISION_CONFLICT');
      }
      return {
        source,
        snapshot: cloneFeedFlowSnapshot(retainedSnapshot),
        accepted: false,
        staleDocument: false,
        outOfOrder: false,
        duplicate: true,
        incomingCheckedAt: normalizedSnapshot.checkedAt,
        retainedCheckedAt: retainedOrder.checkedAt,
        incomingRevision: normalizedSnapshot.snapshotRevision,
        retainedRevision: retainedOrder.snapshotRevision,
        changed: false,
        flowChanged: false,
        readinessChanged: false,
        metricChanged: false,
        contentFlowChanged: false,
      };
    }

    if (
      retainedOrder
      && normalizedSnapshot.checkedAt > retainedOrder.checkedAt
      && normalizedSnapshot.snapshotRevision <= retainedOrder.snapshotRevision
    ) {
      throw new Error(
        `PROTECTION_FEED_FLOW_REVISION_REGRESSION:${retainedOrder.snapshotRevision}:${normalizedSnapshot.snapshotRevision}`,
      );
    }

    const previousSnapshot = retainedSnapshot
      && retainedSnapshot.expiresAt > normalizedSnapshot.checkedAt
      ? retainedSnapshot
      : null;
    const flowChanged = normalizedSnapshot.state === 'none'
      ? !!previousSnapshot
      : (!previousSnapshot || !hasEquivalentFeedFlowSignals(previousSnapshot, normalizedSnapshot));
    const readinessChanged = normalizedSnapshot.state === 'none'
      ? false
      : (!previousSnapshot || !hasEquivalentFeedReadiness(previousSnapshot, normalizedSnapshot));
    const changed = flowChanged || readinessChanged;
    // Live comparison flags are diagnostic only. Per-burst metrics can reset
    // under any detector state; durable history owns its independent receipts.
    const metricChanged = !retainedAcceptedSnapshot
      || !hasEquivalentFeedContentMetrics(retainedAcceptedSnapshot, normalizedSnapshot);
    const contentFlowChanged = !retainedAcceptedSnapshot
      || !hasEquivalentFeedContentFlow(retainedAcceptedSnapshot, normalizedSnapshot);

    return {
      source,
      snapshot: cloneFeedFlowSnapshot(normalizedSnapshot),
      accepted: true,
      staleDocument: false,
      outOfOrder: false,
      duplicate: false,
      incomingCheckedAt: normalizedSnapshot.checkedAt,
      retainedCheckedAt: normalizedSnapshot.checkedAt,
      incomingRevision: normalizedSnapshot.snapshotRevision,
      retainedRevision: normalizedSnapshot.snapshotRevision,
      changed,
      flowChanged,
      readinessChanged,
      metricChanged,
      contentFlowChanged,
      _commitToken: {
        tabId: source.tabId,
        documentId: source.documentId,
        hostname: source.hostname,
        expectedOrder: retainedOrder ? { ...retainedOrder } : null,
        nextSourceState: {
          ...source,
          order: {
            checkedAt: normalizedSnapshot.checkedAt,
            snapshotRevision: normalizedSnapshot.snapshotRevision,
          },
          lastAcceptedSnapshot: normalizedSnapshot,
          runtimeSnapshot: normalizedSnapshot.state === 'none' ? null : normalizedSnapshot,
        },
      },
    };
  }

  function evictExpiredEndedFeedFlowSource(checkedAt) {
    let staleEndedTabId = null;
    let staleEndedCheckedAt = Infinity;
    feedFlowSourceByTabId.forEach((sourceState, sourceTabId) => {
      const sourceCheckedAt = Number(sourceState?.order?.checkedAt) || 0;
      const isExpiredEndedSource = !sourceState?.runtimeSnapshot
        && sourceState?.lastAcceptedSnapshot?.state === 'none'
        && Number(sourceState.lastAcceptedSnapshot.expiresAt) <= checkedAt;
      if (isExpiredEndedSource && sourceCheckedAt < staleEndedCheckedAt) {
        staleEndedCheckedAt = sourceCheckedAt;
        staleEndedTabId = sourceTabId;
      }
    });
    if (staleEndedTabId === null) {
      throw new Error('PROTECTION_FEED_FLOW_SOURCE_CAPACITY_EXCEEDED');
    }
    rememberInvalidFeedFlowDocumentId(
      staleEndedTabId,
      feedFlowSourceByTabId.get(staleEndedTabId)?.documentId,
    );
    feedFlowSourceByTabId.delete(staleEndedTabId);
  }

  function commitFeedFlowSnapshot(prepared = null) {
    const token = prepared?._commitToken;
    if (!prepared?.accepted || !token) {
      throw new Error('PROTECTION_FEED_FLOW_PREPARATION_INVALID');
    }
    const retainedSourceState = feedFlowSourceByTabId.get(token.tabId) || null;
    if (
      (retainedSourceState?.hostname || '') !== (token.expectedOrder ? token.hostname : '')
      || (retainedSourceState?.documentId || '') !== (token.expectedOrder ? token.documentId : '')
      || !hasMatchingFeedFlowOrder(retainedSourceState?.order || null, token.expectedOrder)
      || isInvalidFeedFlowDocumentId(token.tabId, token.documentId)
    ) {
      throw new Error('PROTECTION_FEED_FLOW_PREPARATION_STALE');
    }
    if (!retainedSourceState && feedFlowSourceByTabId.size >= sourceLimit) {
      evictExpiredEndedFeedFlowSource(token.nextSourceState.order.checkedAt);
    }
    feedFlowSourceByTabId.set(token.tabId, token.nextSourceState);
    const { _commitToken: _internalCommitToken, ...result } = prepared;
    return result;
  }

  function setFeedFlowSnapshot(input = {}) {
    const prepared = prepareFeedFlowSnapshot(input);
    if (!prepared.accepted) return prepared;
    return commitFeedFlowSnapshot(prepared);
  }

  function clearFeedFlowSnapshot({
    hostname = '',
    tabId = null,
    documentId = null,
  } = {}) {
    const source = buildFeedFlowSource({ tabId, documentId, hostname });
    const sourceState = feedFlowSourceByTabId.get(source.tabId) || null;
    if (
      sourceState
      && sourceState.hostname === source.hostname
      && sourceState.documentId === source.documentId
    ) {
      sourceState.runtimeSnapshot = null;
    }
  }

  function noteFeedFlowTabNavigation({ tabId = null, hostname = '' } = {}) {
    const normalizedTabId = requireFeedFlowTabId(tabId);
    const previousSourceState = feedFlowSourceByTabId.get(normalizedTabId) || null;
    rememberInvalidFeedFlowDocumentId(normalizedTabId, previousSourceState?.documentId);
    feedFlowSourceByTabId.delete(normalizedTabId);
    return {
      tabId: normalizedTabId,
      hostname: normalizeHost(hostname),
      reset: !!previousSourceState,
      previousDocumentId: previousSourceState?.documentId || null,
      previousHostname: previousSourceState?.hostname || '',
      previousRevision: previousSourceState?.order?.snapshotRevision || null,
    };
  }

  function noteFeedFlowTabClosed({ tabId = null } = {}) {
    const normalizedTabId = requireFeedFlowTabId(tabId);
    const previousSourceState = feedFlowSourceByTabId.get(normalizedTabId) || null;
    feedFlowSourceByTabId.delete(normalizedTabId);
    invalidFeedFlowDocumentIdsByTabId.delete(normalizedTabId);
    return {
      tabId: normalizedTabId,
      cleared: !!previousSourceState,
      documentId: previousSourceState?.documentId || null,
      hostname: previousSourceState?.hostname || '',
    };
  }

  return {
    getFeedFlowSnapshot,
    prepareFeedFlowSnapshot,
    commitFeedFlowSnapshot,
    setFeedFlowSnapshot,
    clearFeedFlowSnapshot,
    noteFeedFlowTabNavigation,
    noteFeedFlowTabClosed,
  };
}
