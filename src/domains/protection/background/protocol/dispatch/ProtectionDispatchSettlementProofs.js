import {
  isDispatchReadyContentSession,
} from './ProtectionDispatchTransport.js';
import {
  isProtectionDispatchSerialQueueError,
} from './ProtectionDispatchSerialQueue.js';
import {
  createOwnedDispatchLifecycleError,
  requireAtomicContentSessionSnapshot,
  resolveExactDispatchDocumentId,
  resolveExactDispatchHistoryUrl,
  resolveReadyContentDocumentId,
} from './ProtectionDispatchLifecyclePrimitives.js';

// Settlement proofs. Each takes (error, subject) and returns either a more specific owned
// lifecycle error or the original error untouched -- never a swallow. They are ordered by
// strength at the call site: the exact proofs get first refusal, and the weaker
// supersession claim only sees what they declined.
//
// Every proof is evidence-based. None of them accepts an error merely because it looks
// right: `isProtectionDispatchSerialQueueError` establishes provenance, and the ledger is
// re-read for the identity the claim depends on.

const PRE_ACK_HISTORY_CANCELLATION_PHASE =
  'gate_mutation:gate_bridge_after_theme_resolution';

export const SUPERSEDABLE_NAVIGATION_QUEUE_REASONS = new Set([
  'web_navigation_committed',
  'web_navigation_history_state_updated',
]);

export function createProtectionDispatchSettlementProofs({
  contentScriptRuntime,
  tabLifecycleLedger,
} = {}) {
  if (!contentScriptRuntime || typeof contentScriptRuntime.getTabSession !== 'function') {
    throw new Error('PROTECTION_DISPATCH_SETTLEMENT_PROOFS_CONTENT_RUNTIME_REQUIRED');
  }
  if (!tabLifecycleLedger || typeof tabLifecycleLedger.getSnapshot !== 'function') {
    throw new Error('PROTECTION_DISPATCH_SETTLEMENT_PROOFS_LIFECYCLE_LEDGER_REQUIRED');
  }

  function createProvenPreAckHistoryCancellation(error, {
    tabId,
    transaction,
  } = {}) {
    if (
      error?.code !== 'PROTECTION_DISPATCH_SERIAL_QUEUE_INVALIDATED'
      || error?.reason !== 'web_navigation_history_state_updated'
      || error?.phase !== PRE_ACK_HISTORY_CANCELLATION_PHASE
      || error?.tabId !== tabId
      || transaction?.ensureSource !== 'session_dispatch_ready'
    ) {
      return error;
    }
    const historyProof = tabLifecycleLedger.getHistoryProof(tabId);
    const session = contentScriptRuntime.getTabSession(tabId) || null;
    if (!historyProof || !isDispatchReadyContentSession(session)) return error;
    const currentDocumentId = resolveReadyContentDocumentId(session);
    const currentUrl = resolveExactDispatchHistoryUrl(session.url);
    const exactRequestedUrl = resolveExactDispatchHistoryUrl(transaction?.url);
    const exactDocumentId = resolveExactDispatchDocumentId(transaction?.documentId);
    if (
      !exactRequestedUrl
      || !currentUrl
      || !exactDocumentId
      || historyProof.tabId !== tabId
      || error.invalidationTag !== historyProof.invalidationTag
      || historyProof.invalidationTag !== historyProof.generation
      || historyProof.documentId !== exactDocumentId
      || currentDocumentId !== exactDocumentId
      || historyProof.previousUrl !== exactRequestedUrl
      || historyProof.currentUrl !== currentUrl
      || historyProof.previousUrl === historyProof.currentUrl
    ) {
      return error;
    }
    return createOwnedDispatchLifecycleError('PROTECTION_DISPATCH_HISTORY_PRE_ACK_CANCELED', {
      cause: error,
      causeCode: error.code,
      queueReason: error.reason,
      reason: 'same_document_history_overtaken_pre_ack',
      phase: error.phase,
      tabId,
      transactionDocumentId: exactDocumentId,
      currentDocumentId,
      requestedUrl: exactRequestedUrl,
      sessionUrl: currentUrl,
      historyDocumentId: historyProof.documentId,
      historyGeneration: historyProof.generation,
      historyInvalidationTag: historyProof.invalidationTag,
      historyObservedAt: historyProof.observedAt,
      historyIngressSequence: historyProof.ingressSequence,
      historyPreviousUrl: historyProof.previousUrl,
      historyCurrentUrl: historyProof.currentUrl,
      ensureSource: transaction.ensureSource,
      gatePresentationDisposition: 'not_started',
      contentDeliveryDisposition: 'not_started',
      ackDisposition: 'not_observed',
    });
  }

  function createProvenPendingTabUpdateHistoryQueueInvalidation(error, receipt) {
    if (
      !isProtectionDispatchSerialQueueError(error)
      || error?.code !== 'PROTECTION_DISPATCH_SERIAL_QUEUE_INVALIDATED'
      || error?.reason !== 'web_navigation_history_state_updated'
      || error?.tabId !== receipt?.tabId
      || receipt?.status !== 'complete'
    ) {
      return error;
    }
    const historyProof = tabLifecycleLedger.getHistoryProof(receipt.tabId);
    let currentSnapshot = null;
    try {
      currentSnapshot = requireAtomicContentSessionSnapshot(
        contentScriptRuntime,
        receipt.tabId,
      );
    } catch (_error) {
      return error;
    }
    const currentSession = currentSnapshot.session;
    if (!historyProof || !isDispatchReadyContentSession(currentSession)) return error;
    const receiptDocumentId = resolveExactDispatchDocumentId(receipt.observedDocumentId);
    const receiptSessionUrl = resolveExactDispatchHistoryUrl(receipt.observedSessionUrl);
    const requestedUrl = resolveExactDispatchHistoryUrl(receipt.requestedUrl);
    const currentDocumentId = resolveExactDispatchDocumentId(currentSession.documentId);
    const currentUrl = resolveExactDispatchHistoryUrl(currentSession.url);
    const exactPendingHistoryOvertake = receiptDocumentId !== null
      && receiptSessionUrl !== null
      && requestedUrl === receiptSessionUrl
      && Number.isSafeInteger(receipt.ingressSequence)
      && receipt.ingressSequence > 0
      && historyProof.tabId === receipt.tabId
      && Number.isSafeInteger(historyProof.ingressSequence)
      && receipt.ingressSequence < historyProof.ingressSequence
      && error.invalidationTag === historyProof.invalidationTag
      && historyProof.invalidationTag === historyProof.generation
      && historyProof.documentId === receiptDocumentId
      && historyProof.documentId === currentDocumentId
      && historyProof.previousUrl === requestedUrl
      && historyProof.currentUrl === currentUrl
      && historyProof.previousUrl !== historyProof.currentUrl;
    if (!exactPendingHistoryOvertake) return error;
    return createOwnedDispatchLifecycleError(
      'PROTECTION_DISPATCH_ADMISSION_CONTEXT_MISMATCH',
      {
        cause: error,
        causeCode: error.code,
        queueReason: error.reason,
        reason: 'same_document_history_overtaken',
        phase: typeof error.phase === 'string' ? error.phase : null,
        tabId: receipt.tabId,
        currentDocumentId,
        requestedUrl,
        sessionUrl: currentUrl,
        historyDocumentId: historyProof.documentId,
        historyGeneration: historyProof.generation,
        historyInvalidationTag: historyProof.invalidationTag,
        historyObservedAt: historyProof.observedAt,
        historyIngressSequence: historyProof.ingressSequence,
        historyPreviousUrl: historyProof.previousUrl,
        historyCurrentUrl: historyProof.currentUrl,
      },
    );
  }

  function createProvenPendingTabUpdateCommittedQueueInvalidation(error, receipt) {
    if (
      !isProtectionDispatchSerialQueueError(error)
      || error?.code !== 'PROTECTION_DISPATCH_SERIAL_QUEUE_INVALIDATED'
      || error?.reason !== 'web_navigation_committed'
      || error?.tabId !== receipt?.tabId
    ) {
      return error;
    }
    const committedProof = tabLifecycleLedger.getCommittedProof(receipt.tabId);
    const receiptDocumentId = resolveExactDispatchDocumentId(receipt.observedDocumentId);
    const receiptSessionUrl = resolveExactDispatchHistoryUrl(receipt.observedSessionUrl);
    const requestedUrl = resolveExactDispatchHistoryUrl(receipt.requestedUrl);
    const receiptHasNoReadyIdentity = receipt.observedDocumentId === null
      && receipt.observedSessionUrl === null
      && receipt.observedSessionGeneration === null;
    const receiptHasExactReadyIdentity = receiptDocumentId !== null
      && receiptSessionUrl !== null
      && Number.isSafeInteger(receipt.observedSessionGeneration)
      && receipt.observedSessionGeneration > 0;
    const committedOvertookReceipt = !!(
      committedProof
      && requestedUrl
      && (receiptHasNoReadyIdentity || receiptHasExactReadyIdentity)
      && Number.isSafeInteger(receipt.ingressSequence)
      && receipt.ingressSequence > 0
      && receipt.ingressSequence < committedProof.ingressSequence
      && error.invalidationTag === committedProof.invalidationTag
      && committedProof.invalidationTag === committedProof.generation
      && (
        receiptHasNoReadyIdentity
        || committedProof.documentId !== receiptDocumentId
        || committedProof.url !== receiptSessionUrl
      )
    );
    if (!committedOvertookReceipt) return error;
    return createOwnedDispatchLifecycleError(
      'PROTECTION_DISPATCH_COMMITTED_NAVIGATION_CANCELED',
      {
        cause: error,
        causeCode: error.code,
        queueReason: error.reason,
        reason: 'document_navigation_committed',
        phase: typeof error.phase === 'string' ? error.phase : null,
        tabId: receipt.tabId,
        requestedUrl,
        receiptDocumentId,
        receiptSessionUrl,
        committedDocumentId: committedProof.documentId,
        committedUrl: committedProof.url,
        committedGeneration: committedProof.generation,
        committedInvalidationTag: committedProof.invalidationTag,
        committedObservedAt: committedProof.observedAt,
        committedIngressSequence: committedProof.ingressSequence,
      },
    );
  }

  // A navigation invalidation can only be proven by the exact provers above while its
  // proof object is still the tab's newest one. The ledger keeps exactly one proof per
  // tab -- `noteCommitted` clears `historyProof`, `noteHistory` clears `committedProof` --
  // so a second lifecycle event landing before this catch runs erases the evidence for
  // the first, and a genuinely-cancelled dispatch surfaces as a hard error.
  //
  // The weaker but still exact claim survives: `invalidateTab` is reached only from
  // `markTabNavigated` and `markTabUrlChanged`, both driven by real webNavigation events,
  // and each stamps its tag from the tab's monotonic `historyGeneration`. So a queue error
  // carrying a navigation reason and a tag the ledger has reached proves a navigation on
  // that tab cancelled this dispatch. The exact provers recover *which* document won; when
  // their identity evidence is gone -- or was never capturable, as when a commit arrives
  // without a documentId -- the cancellation itself is still exactly established.
  //
  // The teeth are the ingress comparison below: a receipt that is still the tab's
  // lifecycle head was superseded by nothing and stays loud.

  function createProvenSupersededNavigationQueueInvalidation(error, receipt) {
    if (
      !isProtectionDispatchSerialQueueError(error)
      || error?.code !== 'PROTECTION_DISPATCH_SERIAL_QUEUE_INVALIDATED'
      || !SUPERSEDABLE_NAVIGATION_QUEUE_REASONS.has(error?.reason)
      || error?.tabId !== receipt?.tabId
      || !Number.isSafeInteger(error?.invalidationTag)
      || error.invalidationTag <= 0
    ) {
      return error;
    }
    const snapshot = tabLifecycleLedger.getSnapshot(receipt.tabId);
    const latestIngress = snapshot?.latestIngress || null;
    const supersededByLaterLifecycleEvent = !!(
      snapshot
      && !snapshot.removed
      && Number.isSafeInteger(snapshot.historyGeneration)
      && snapshot.historyGeneration >= error.invalidationTag
      && latestIngress
      && Number.isSafeInteger(latestIngress.sequence)
      && Number.isSafeInteger(receipt.ingressSequence)
      && receipt.ingressSequence > 0
      && receipt.ingressSequence < latestIngress.sequence
    );
    if (!supersededByLaterLifecycleEvent) return error;
    return createOwnedDispatchLifecycleError(
      'PROTECTION_DISPATCH_NAVIGATION_SUPERSEDED',
      {
        cause: error,
        causeCode: error.code,
        queueReason: error.reason,
        reason: 'navigation_superseded',
        phase: typeof error.phase === 'string' ? error.phase : null,
        tabId: receipt.tabId,
        invalidationTag: error.invalidationTag,
        historyGeneration: snapshot.historyGeneration,
        latestIngressKind: latestIngress.kind,
        latestIngressSequence: latestIngress.sequence,
        receiptIngressSequence: receipt.ingressSequence,
      },
    );
  }

  return Object.freeze({
    createProvenPreAckHistoryCancellation,
    createProvenPendingTabUpdateHistoryQueueInvalidation,
    createProvenPendingTabUpdateCommittedQueueInvalidation,
    createProvenSupersededNavigationQueueInvalidation,
  });
}

export default createProtectionDispatchSettlementProofs;
