import {
  createProtectionTabUpdatedIngressReceipt,
} from './ProtectionTabUpdatedDispatchProtocol.js';

function requireTabId(value) {
  const tabId = Number(value);
  if (!Number.isSafeInteger(tabId) || tabId < 0) {
    throw new Error('PROTECTION_TAB_LIFECYCLE_TAB_ID_INVALID');
  }
  return tabId;
}

function requireObservedAt(value) {
  const observedAt = Number(value);
  if (!Number.isSafeInteger(observedAt) || observedAt < 0) {
    throw new Error('PROTECTION_TAB_LIFECYCLE_OBSERVED_AT_INVALID');
  }
  return observedAt;
}

function resolveExactUrl(value) {
  if (typeof value !== 'string' || !value || value !== value.trim()) return null;
  try {
    const parsed = new URL(value);
    if (
      (parsed.protocol !== 'http:' && parsed.protocol !== 'https:')
      || parsed.href !== value
    ) {
      return null;
    }
    return parsed.href;
  } catch (_error) {
    return null;
  }
}

function resolveDocumentId(value) {
  return typeof value === 'string' && value && value === value.trim()
    ? value
    : null;
}

function resolveSessionGeneration(value) {
  return Number.isSafeInteger(value) && value > 0 ? value : null;
}

function requireTabUpdatedStatus(value) {
  if (value !== 'loading' && value !== 'complete') {
    throw new Error('PROTECTION_TAB_LIFECYCLE_STATUS_INVALID');
  }
  return value;
}

function freezeIngress({
  kind,
  sequence,
  observedAt,
  url = null,
  status = null,
  documentId = null,
} = {}) {
  return Object.freeze({
    kind,
    sequence,
    observedAt,
    url,
    status,
    documentId,
  });
}

export function createProtectionTabLifecycleLedger() {
  let nextIngressSequence = 0;
  const stateByTabId = new Map();

  function issueIngressSequence() {
    nextIngressSequence += 1;
    if (!Number.isSafeInteger(nextIngressSequence)) {
      throw new Error('PROTECTION_TAB_LIFECYCLE_SEQUENCE_EXHAUSTED');
    }
    return nextIngressSequence;
  }

  function readState(tabId) {
    return stateByTabId.get(tabId) || null;
  }

  function writeState(tabId, patch) {
    const previous = readState(tabId);
    const next = Object.freeze({
      committedProof: previous?.committedProof || null,
      committedIngressSequence: previous?.committedIngressSequence || 0,
      historyGeneration: previous?.historyGeneration || 0,
      historyProof: previous?.historyProof || null,
      latestIngress: previous?.latestIngress || null,
      removed: previous?.removed === true,
      ...patch,
    });
    stateByTabId.set(tabId, next);
    return next;
  }

  function captureTabUpdated({
    tabId: rawTabId,
    status: rawStatus,
    url,
    observedAt: rawObservedAt,
    observedDocumentId = null,
    observedSessionUrl = null,
    observedSessionGeneration = null,
  } = {}) {
    const exactUrl = resolveExactUrl(url);
    if (!exactUrl) return null;
    const tabId = requireTabId(rawTabId);
    const status = requireTabUpdatedStatus(rawStatus);
    const observedAt = requireObservedAt(rawObservedAt);
    const sequence = issueIngressSequence();
    const receipt = createProtectionTabUpdatedIngressReceipt({
      tabId,
      status,
      requestedUrl: exactUrl,
      observedAt,
      ingressSequence: sequence,
      observedDocumentId,
      observedSessionUrl,
      observedSessionGeneration,
    });
    writeState(tabId, {
      latestIngress: freezeIngress({
        kind: 'tab_updated',
        sequence,
        observedAt,
        url: exactUrl,
        status,
      }),
      removed: false,
    });
    return receipt;
  }

  function adoptClaimedTabUpdated(receipt) {
    if (!receipt || typeof receipt !== 'object') {
      throw new Error('PROTECTION_TAB_LIFECYCLE_RECEIPT_REQUIRED');
    }
    const tabId = requireTabId(receipt.tabId);
    const status = requireTabUpdatedStatus(receipt.status);
    const observedAt = requireObservedAt(receipt.observedAt);
    const url = resolveExactUrl(receipt.requestedUrl);
    if (!url || !Number.isSafeInteger(receipt.ingressSequence) || receipt.ingressSequence <= 0) {
      throw new Error('PROTECTION_TAB_LIFECYCLE_RECEIPT_INVALID');
    }
    nextIngressSequence = Math.max(nextIngressSequence, receipt.ingressSequence);
    const previous = readState(tabId);
    if ((previous?.latestIngress?.sequence || 0) >= receipt.ingressSequence) {
      return previous?.latestIngress || null;
    }
    const ingress = freezeIngress({
      kind: 'tab_updated',
      sequence: receipt.ingressSequence,
      observedAt,
      url,
      status,
    });
    writeState(tabId, {
      latestIngress: ingress,
      removed: false,
    });
    return ingress;
  }

  function noteCommitted({
    tabId: rawTabId,
    url = null,
    documentId = null,
    observedAt: rawObservedAt = Date.now(),
  } = {}) {
    const tabId = requireTabId(rawTabId);
    const observedAt = requireObservedAt(rawObservedAt);
    const previous = readState(tabId);
    const sequence = issueIngressSequence();
    const historyGeneration = (previous?.historyGeneration || 0) + 1;
    const ingress = freezeIngress({
      kind: 'committed',
      sequence,
      observedAt,
      url: resolveExactUrl(url),
      documentId: resolveDocumentId(documentId),
    });
    const proof = ingress.url && ingress.documentId
      ? Object.freeze({
        tabId,
        documentId: ingress.documentId,
        url: ingress.url,
        generation: historyGeneration,
        invalidationTag: historyGeneration,
        observedAt,
        ingressSequence: sequence,
      })
      : null;
    writeState(tabId, {
      committedProof: proof,
      committedIngressSequence: sequence,
      historyGeneration,
      historyProof: null,
      latestIngress: ingress,
      removed: false,
    });
    return Object.freeze({
      generation: historyGeneration,
      ingress,
      proof,
    });
  }

  function noteHistory({
    tabId: rawTabId,
    url = null,
    documentId = null,
    observedAt: rawObservedAt = Date.now(),
    previousUrl = null,
    sessionDocumentId = null,
    sessionReady = false,
  } = {}) {
    const tabId = requireTabId(rawTabId);
    const observedAt = requireObservedAt(rawObservedAt);
    const previous = readState(tabId);
    const sequence = issueIngressSequence();
    const generation = (previous?.historyGeneration || 0) + 1;
    const currentUrl = resolveExactUrl(url);
    const exactPreviousUrl = resolveExactUrl(previousUrl);
    const historyDocumentId = resolveDocumentId(documentId);
    const exactSessionDocumentId = resolveDocumentId(sessionDocumentId);
    const ingress = freezeIngress({
      kind: 'history',
      sequence,
      observedAt,
      url: currentUrl,
      documentId: historyDocumentId,
    });
    const proof = sessionReady === true
      && exactPreviousUrl
      && currentUrl
      && exactPreviousUrl !== currentUrl
      && historyDocumentId
      && historyDocumentId === exactSessionDocumentId
      ? Object.freeze({
        tabId,
        documentId: historyDocumentId,
        previousUrl: exactPreviousUrl,
        currentUrl,
        generation,
        invalidationTag: generation,
        observedAt,
        ingressSequence: sequence,
      })
      : null;
    writeState(tabId, {
      committedProof: null,
      historyGeneration: generation,
      historyProof: proof,
      latestIngress: ingress,
      removed: false,
    });
    return Object.freeze({
      generation,
      ingress,
      proof,
    });
  }

  function closeTab(tabIdValue, { observedAt: rawObservedAt = Date.now() } = {}) {
    const tabId = requireTabId(tabIdValue);
    const observedAt = requireObservedAt(rawObservedAt);
    const previous = readState(tabId);
    const sequence = issueIngressSequence();
    const historyGeneration = (previous?.historyGeneration || 0) + 1;
    const ingress = freezeIngress({
      kind: 'removed',
      sequence,
      observedAt,
    });
    writeState(tabId, {
      committedProof: null,
      historyGeneration,
      historyProof: null,
      latestIngress: ingress,
      removed: true,
    });
    return ingress;
  }

  function evictTab(tabIdValue) {
    const tabId = requireTabId(tabIdValue);
    const previous = readState(tabId);
    if (!previous) return false;
    if (!previous.removed) return false;
    return stateByTabId.delete(tabId);
  }

  function getHistoryProof(tabIdValue) {
    const tabId = requireTabId(tabIdValue);
    return readState(tabId)?.historyProof || null;
  }

  function getCommittedProof(tabIdValue) {
    const tabId = requireTabId(tabIdValue);
    return readState(tabId)?.committedProof || null;
  }

  function isTabUpdatedCurrent(receipt) {
    if (!receipt || typeof receipt !== 'object') return false;
    const tabId = Number(receipt.tabId);
    if (!Number.isSafeInteger(tabId) || tabId < 0) return false;
    const state = readState(tabId);
    if (!state || state.removed) return false;
    const latest = state.latestIngress;
    if (!latest) return false;
    if (latest.sequence === receipt.ingressSequence) return true;
    if (latest.sequence < receipt.ingressSequence) return false;
    if (latest.kind === 'tab_updated') {
      if (latest.url !== receipt.requestedUrl) return false;
      return receipt.status === 'loading' && latest.status === 'complete';
    }
    if (latest.kind === 'committed') {
      return latest.url === receipt.requestedUrl;
    }
    return false;
  }

  function getSnapshot(tabIdValue) {
    const tabId = requireTabId(tabIdValue);
    const state = readState(tabId);
    if (!state) return null;
    return Object.freeze({
      committedProof: state.committedProof,
      committedIngressSequence: state.committedIngressSequence,
      historyGeneration: state.historyGeneration,
      historyProof: state.historyProof,
      latestIngress: state.latestIngress,
      removed: state.removed,
    });
  }

  return Object.freeze({
    adoptClaimedTabUpdated,
    captureTabUpdated,
    closeTab,
    evictTab,
    getCommittedProof,
    getHistoryProof,
    getSnapshot,
    isTabUpdatedCurrent,
    noteCommitted,
    noteHistory,
  });
}

export default createProtectionTabLifecycleLedger;
