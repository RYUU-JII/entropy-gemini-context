import {
  isDispatchReadyContentSession,
} from './ProtectionDispatchTransport.js';
import {
  hasExactEnumerableKeys,
  isPlainObject,
  readmittedDispatchInspection,
  refusedDispatchInspection,
  requireAtomicContentSessionSnapshot,
  resolveExactDispatchDocumentId,
  resolveExactDispatchHistoryUrl,
  settledDispatchInspection,
} from './ProtectionDispatchLifecyclePrimitives.js';

// Live-admission reconciliation.
//
// A tab-update dispatch can be rejected because the ready session's URL no longer matches
// the one the admission captured. That is sometimes a genuine mismatch, and sometimes a
// delayed tab update racing a same-document URL change that has already converged. This
// module decides which, using only exact evidence: a correlation the receipt and the error
// both attest, an atomic session snapshot on either side of a live tab lookup, and an
// exact document-location probe.
//
// It reads as a pipeline. Each stage either produces the next stage's facts or returns a
// frozen result carrying the reason it could not proceed. Nothing here recovers by
// guessing -- every early return is a refusal with its evidence attached.

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

function createLiveAdmissionReconciliationDiagnostic(receipt, error, patch = {}) {
  return Object.freeze({
    ingressIdentitySource: null,
    receiptSessionGeneration: Number.isSafeInteger(receipt?.observedSessionGeneration)
      ? receipt.observedSessionGeneration
      : null,
    errorSessionGeneration: Number.isSafeInteger(error?.sessionGeneration)
      ? error.sessionGeneration
      : null,
    snapshotBeforeGeneration: null,
    snapshotAfterGeneration: null,
    requestedUrlMatchesError: null,
    observedSessionUrlMatchesError: null,
    documentMatchesReceipt: null,
    liveTabIdMatches: null,
    liveTabUrlMatchesSession: null,
    liveTabUrlMatchesRequested: null,
    livePendingUrlPresent: null,
    livePendingUrlMatchesSession: null,
    livePendingUrlMatchesRequested: null,
    sessionGenerationStable: null,
    readyDocumentProbeErrorCode: null,
    probeAttempted: null,
    probeResultCountExact: null,
    probeFrameMatches: null,
    probeDocumentMatches: null,
    probeUrlMatchesRequested: null,
    sessionRefreshGenerationMatched: null,
    sessionRefreshStatusReady: null,
    sessionRefreshDocumentMatched: null,
    sessionRefreshUrlMatchedExpected: null,
    sessionRefreshCommitted: null,
    sessionRefreshGenerationAdvanced: null,
    sessionRefreshDocumentPreserved: null,
    sessionRefreshUrlMatchesRequested: null,
    refreshedSessionGeneration: null,
    recapturedAdmissionMatchesRequested: null,
    ...patch,
  });
}

function projectReadyDocumentUrlRefreshProof(proof) {
  const booleanOrNull = (value) => (typeof value === 'boolean' ? value : null);
  return Object.freeze({
    probeAttempted: booleanOrNull(proof?.probeAttempted),
    probeResultCountExact: booleanOrNull(proof?.probeResultCountExact),
    probeFrameMatches: booleanOrNull(proof?.probeFrameMatches),
    probeDocumentMatches: booleanOrNull(proof?.probeDocumentMatches),
    probeUrlMatchesRequested: booleanOrNull(proof?.probeUrlMatchesRequested),
    sessionRefreshGenerationMatched: booleanOrNull(
      proof?.sessionRefreshGenerationMatched,
    ),
    sessionRefreshStatusReady: booleanOrNull(proof?.sessionRefreshStatusReady),
    sessionRefreshDocumentMatched: booleanOrNull(proof?.sessionRefreshDocumentMatched),
    sessionRefreshUrlMatchedExpected: booleanOrNull(
      proof?.sessionRefreshUrlMatchedExpected,
    ),
    sessionRefreshCommitted: booleanOrNull(proof?.sessionRefreshCommitted),
    sessionRefreshGenerationAdvanced: booleanOrNull(
      proof?.sessionRefreshGenerationAdvanced,
    ),
    sessionRefreshDocumentPreserved: booleanOrNull(
      proof?.sessionRefreshDocumentPreserved,
    ),
    sessionRefreshUrlMatchesRequested: booleanOrNull(
      proof?.sessionRefreshUrlMatchesRequested,
    ),
  });
}

function isExactReadySnapshotForLiveAdmission(snapshot, correlation) {
  const session = snapshot?.session || null;
  return isDispatchReadyContentSession(session)
    && snapshot.generation === correlation.sessionGeneration
    && resolveExactDispatchDocumentId(session.documentId) === correlation.documentId
    && resolveExactDispatchHistoryUrl(session.url) === correlation.sessionUrl;
}

// Stage 1. Derive the identity the receipt and the error must both attest before any live
// probing is worth doing, along with the comparison facts the diagnostic reports.
function correlateLiveAdmissionReceipt(error, receipt) {
  const exactRequestedUrl = resolveExactDispatchHistoryUrl(error?.requestedUrl);
  const exactErrorSessionUrl = resolveExactDispatchHistoryUrl(error?.sessionUrl);
  const exactErrorDocumentId = resolveExactDispatchDocumentId(error?.currentDocumentId);
  const receiptHasReadyIdentity = Number.isSafeInteger(receipt.observedSessionGeneration)
    && receipt.observedSessionGeneration > 0
    && resolveExactDispatchDocumentId(receipt.observedDocumentId) !== null
    && resolveExactDispatchHistoryUrl(receipt.observedSessionUrl) !== null;
  const receiptHasNoReadyIdentity = receipt.observedSessionGeneration === null
    && receipt.observedDocumentId === null
    && receipt.observedSessionUrl === null;
  const requestedUrlMatchesError = exactRequestedUrl !== null
    && exactRequestedUrl === receipt.requestedUrl;
  const observedSessionUrlMatchesError = receiptHasReadyIdentity
    ? exactErrorSessionUrl !== null && exactErrorSessionUrl === receipt.observedSessionUrl
    : null;
  const documentMatchesReceipt = receiptHasReadyIdentity
    ? exactErrorDocumentId !== null && exactErrorDocumentId === receipt.observedDocumentId
    : null;
  const ingressIdentitySource = receiptHasReadyIdentity
    ? 'receipt_ready_session'
    : (receiptHasNoReadyIdentity ? 'admission_ready_session' : null);
  const correlation = ingressIdentitySource && exactErrorSessionUrl !== null
    && exactErrorDocumentId !== null
    && Number.isSafeInteger(error?.sessionGeneration)
    && error.sessionGeneration > 0
    && (
      receiptHasNoReadyIdentity
      || (
        error.sessionGeneration === receipt.observedSessionGeneration
        && observedSessionUrlMatchesError
        && documentMatchesReceipt
      )
    )
    ? Object.freeze({
      documentId: exactErrorDocumentId,
      sessionGeneration: error.sessionGeneration,
      sessionUrl: exactErrorSessionUrl,
    })
    : null;
  return Object.freeze({
    exactRequestedUrl,
    exactErrorSessionUrl,
    correlation,
    facts: Object.freeze({
      ingressIdentitySource,
      requestedUrlMatchesError,
      observedSessionUrlMatchesError,
      documentMatchesReceipt,
    }),
  });
}

export function createProtectionLiveAdmissionReconciliation({
  contentScriptRuntime,
  browserPort,
  captureDispatchAdmissionContext,
} = {}) {
  if (!contentScriptRuntime || typeof contentScriptRuntime.getTabSessionSnapshot !== 'function') {
    throw new Error('PROTECTION_LIVE_ADMISSION_CONTENT_RUNTIME_REQUIRED');
  }
  if (!browserPort || typeof browserPort.tabsGet !== 'function') {
    throw new Error('PROTECTION_LIVE_ADMISSION_BROWSER_PORT_REQUIRED');
  }
  if (typeof captureDispatchAdmissionContext !== 'function') {
    throw new Error('PROTECTION_LIVE_ADMISSION_ADMISSION_CAPTURE_REQUIRED');
  }

  // Re-capture the admission for a converged document, returning it only when it is
  // exactly the one the correlation names at the generation just observed. Two convergence
  // paths need this and both treat "not exact" identically, as no admission at all.
  function recaptureExactAdmission(tabId, url, documentId, expectedGeneration) {
    let admission = null;
    try {
      admission = captureDispatchAdmissionContext({
        tabId,
        url,
        expectedDocumentId: documentId,
      });
    } catch (_error) {
      return null;
    }
    const exact = admission?.documentId === documentId
      && admission?.url === url
      && admission?.sessionGeneration === expectedGeneration;
    return exact ? admission : null;
  }

  async function inspectLiveAdmissionTabUpdateReconciliation(error, receipt) {
    const {
      exactRequestedUrl,
      exactErrorSessionUrl,
      correlation,
      facts,
    } = correlateLiveAdmissionReceipt(error, receipt);
    const initialDiagnostic = createLiveAdmissionReconciliationDiagnostic(
      receipt,
      error,
      facts,
    );
    if (
      error?.code !== 'PROTECTION_DISPATCH_ADMISSION_CONTEXT_MISMATCH'
      || error?.reason !== 'ready_session_url_mismatch'
      || error?.phase !== 'admission_capture'
      || error?.tabId !== receipt.tabId
      || error?.contentMutationDisposition !== 'not_started'
      || error?.gatePresentationDisposition !== 'not_started'
      || error?.contentDeliveryDisposition !== 'not_started'
      || error?.ackDisposition !== 'not_observed'
      || !correlation
      || !facts.requestedUrlMatchesError
      || exactRequestedUrl === exactErrorSessionUrl
    ) {
      return refusedDispatchInspection({
        diagnosticReason: 'live_admission_receipt_correlation_mismatch',
        diagnostic: initialDiagnostic,
      });
    }

    const snapshotBefore = requireAtomicContentSessionSnapshot(
      contentScriptRuntime,
      receipt.tabId,
    );
    const snapshotBeforeMatches = isExactReadySnapshotForLiveAdmission(
      snapshotBefore,
      correlation,
    );
    if (!snapshotBeforeMatches) {
      return refusedDispatchInspection({
        diagnosticReason: 'live_admission_snapshot_before_mismatch',
        diagnostic: createLiveAdmissionReconciliationDiagnostic(receipt, error, {
          ...initialDiagnostic,
          snapshotBeforeGeneration: snapshotBefore.generation,
          sessionGenerationStable: false,
        }),
      });
    }

    let liveTab = null;
    try {
      liveTab = await browserPort.tabsGet(receipt.tabId);
    } catch (_error) {
      const snapshotAfterFailure = requireAtomicContentSessionSnapshot(
        contentScriptRuntime,
        receipt.tabId,
      );
      return refusedDispatchInspection({
        diagnosticReason: 'live_admission_tab_lookup_failed',
        diagnostic: createLiveAdmissionReconciliationDiagnostic(receipt, error, {
          ...initialDiagnostic,
          snapshotBeforeGeneration: snapshotBefore.generation,
          snapshotAfterGeneration: snapshotAfterFailure.generation,
          sessionGenerationStable: snapshotAfterFailure.generation === snapshotBefore.generation,
        }),
      });
    }

    const snapshotAfter = requireAtomicContentSessionSnapshot(
      contentScriptRuntime,
      receipt.tabId,
    );
    const sessionGenerationStable = snapshotAfter.generation === snapshotBefore.generation
      && isExactReadySnapshotForLiveAdmission(snapshotAfter, correlation);
    const liveTabIdMatches = liveTab?.id === receipt.tabId;
    const exactLiveTabUrl = resolveExactDispatchHistoryUrl(liveTab?.url);
    const liveTabUrlMatchesSession = exactLiveTabUrl !== null
      && exactLiveTabUrl === exactErrorSessionUrl;
    const liveTabUrlMatchesRequested = exactLiveTabUrl !== null
      && exactLiveTabUrl === exactRequestedUrl;
    const pendingUrlValue = liveTab?.pendingUrl;
    const livePendingUrlPresent = typeof pendingUrlValue !== 'undefined'
      && pendingUrlValue !== null
      && pendingUrlValue !== '';
    const exactPendingUrl = livePendingUrlPresent
      ? resolveExactDispatchHistoryUrl(pendingUrlValue)
      : null;
    const livePendingUrlMatchesSession = livePendingUrlPresent
      ? exactPendingUrl !== null && exactPendingUrl === exactErrorSessionUrl
      : null;
    const livePendingUrlMatchesRequested = livePendingUrlPresent
      ? exactPendingUrl !== null && exactPendingUrl === exactRequestedUrl
      : null;
    const diagnostic = createLiveAdmissionReconciliationDiagnostic(receipt, error, {
      ...initialDiagnostic,
      snapshotBeforeGeneration: snapshotBefore.generation,
      snapshotAfterGeneration: snapshotAfter.generation,
      liveTabIdMatches,
      liveTabUrlMatchesSession,
      liveTabUrlMatchesRequested,
      livePendingUrlPresent,
      livePendingUrlMatchesSession,
      livePendingUrlMatchesRequested,
      sessionGenerationStable,
    });
    if (!sessionGenerationStable) {
      const convergedSession = snapshotAfter.session;
      const exactMonotonicReadyConvergence = snapshotAfter.generation
        > snapshotBefore.generation
        && isDispatchReadyContentSession(convergedSession)
        && resolveExactDispatchDocumentId(convergedSession.documentId)
          === correlation.documentId
        && resolveExactDispatchHistoryUrl(convergedSession.url) === exactRequestedUrl
        && liveTabIdMatches
        && liveTabUrlMatchesRequested
        && (!livePendingUrlPresent || livePendingUrlMatchesRequested);
      if (exactMonotonicReadyConvergence) {
        const convergedAdmission = recaptureExactAdmission(
          receipt.tabId,
          exactRequestedUrl,
          correlation.documentId,
          snapshotAfter.generation,
        );
        const convergedAdmissionExact = convergedAdmission !== null;
        if (convergedAdmissionExact) {
          return readmittedDispatchInspection({
            admission: convergedAdmission,
            diagnosticReason: 'exact_ready_document_url_converged_during_live_lookup',
            diagnostic: createLiveAdmissionReconciliationDiagnostic(receipt, error, {
              ...diagnostic,
              refreshedSessionGeneration: snapshotAfter.generation,
              recapturedAdmissionMatchesRequested: true,
            }),
          });
        }
      }
      return refusedDispatchInspection({
        diagnosticReason: 'live_admission_reconciliation_mismatch',
        diagnostic,
      });
    }
    if (!liveTabIdMatches) {
      return refusedDispatchInspection({
        diagnosticReason: 'live_admission_reconciliation_mismatch',
        diagnostic,
      });
    }
    if (
      liveTabUrlMatchesSession
      && (!livePendingUrlPresent || livePendingUrlMatchesSession)
    ) {
      return settledDispatchInspection({
        disposition: 'protection_delayed_tab_update_reconciled',
        errorCode: error.code,
        phase: error.phase,
        diagnosticReason: 'exact_live_tab_session_reconciliation',
        diagnostic,
      });
    }
    if (!liveTabUrlMatchesRequested || livePendingUrlPresent) {
      return refusedDispatchInspection({
        diagnosticReason: 'live_admission_reconciliation_mismatch',
        diagnostic,
      });
    }

    let refreshResult = null;
    try {
      refreshResult = await contentScriptRuntime.refreshReadyDocumentUrlFromExactProbe({
        tabId: receipt.tabId,
        expectedGeneration: snapshotBefore.generation,
        expectedDocumentId: correlation.documentId,
        expectedUrl: exactErrorSessionUrl,
        nextUrl: exactRequestedUrl,
      });
    } catch (refreshError) {
      const projectedRefreshProof = projectReadyDocumentUrlRefreshProof(refreshError?.proof);
      const loadingDocumentTransitionProbeUnavailable = receipt.status === 'loading'
        && refreshError?.code === 'CONTENT_SCRIPT_READY_DOCUMENT_URL_PROBE_FAILED'
        && projectedRefreshProof.probeAttempted === true
        && projectedRefreshProof.probeResultCountExact === false
        && projectedRefreshProof.probeFrameMatches === null
        && projectedRefreshProof.probeDocumentMatches === null
        && projectedRefreshProof.probeUrlMatchesRequested === null
        && projectedRefreshProof.sessionRefreshGenerationMatched === null
        && projectedRefreshProof.sessionRefreshStatusReady === null
        && projectedRefreshProof.sessionRefreshDocumentMatched === null
        && projectedRefreshProof.sessionRefreshUrlMatchedExpected === null
        && projectedRefreshProof.sessionRefreshCommitted === null
        && projectedRefreshProof.sessionRefreshGenerationAdvanced === null
        && projectedRefreshProof.sessionRefreshDocumentPreserved === null
        && projectedRefreshProof.sessionRefreshUrlMatchesRequested === null;
      if (loadingDocumentTransitionProbeUnavailable) {
        return settledDispatchInspection({
          disposition: 'protection_delayed_tab_update_reconciled',
          errorCode: error.code,
          phase: error.phase,
          diagnosticReason: 'loading_document_transition_probe_unavailable',
          diagnostic: createLiveAdmissionReconciliationDiagnostic(receipt, error, {
            ...diagnostic,
            ...projectedRefreshProof,
            readyDocumentProbeErrorCode: refreshError.code,
          }),
        });
      }
      if (
        refreshError?.code === 'CONTENT_SCRIPT_READY_DOCUMENT_URL_REFRESH_CAS_CONFLICT'
        && projectedRefreshProof.probeAttempted === true
        && projectedRefreshProof.probeResultCountExact === true
        && projectedRefreshProof.probeFrameMatches === true
        && projectedRefreshProof.probeDocumentMatches === true
        && projectedRefreshProof.probeUrlMatchesRequested === true
        && projectedRefreshProof.sessionRefreshGenerationMatched === false
        && projectedRefreshProof.sessionRefreshStatusReady === true
        && projectedRefreshProof.sessionRefreshDocumentMatched === true
        && projectedRefreshProof.sessionRefreshUrlMatchedExpected === false
        && projectedRefreshProof.sessionRefreshCommitted === false
        && projectedRefreshProof.sessionRefreshGenerationAdvanced === true
        && projectedRefreshProof.sessionRefreshDocumentPreserved === true
        && projectedRefreshProof.sessionRefreshUrlMatchesRequested === true
      ) {
        const convergedSnapshot = requireAtomicContentSessionSnapshot(
          contentScriptRuntime,
          receipt.tabId,
        );
        const convergedSession = convergedSnapshot.session;
        const convergedSnapshotExact = convergedSnapshot.generation > snapshotBefore.generation
          && isDispatchReadyContentSession(convergedSession)
          && resolveExactDispatchDocumentId(convergedSession.documentId)
            === correlation.documentId
          && resolveExactDispatchHistoryUrl(convergedSession.url) === exactRequestedUrl;
        if (convergedSnapshotExact) {
          const convergedAdmission = recaptureExactAdmission(
            receipt.tabId,
            exactRequestedUrl,
            correlation.documentId,
            convergedSnapshot.generation,
          );
          const convergedAdmissionExact = convergedAdmission !== null;
          if (convergedAdmissionExact) {
            return readmittedDispatchInspection({
              admission: convergedAdmission,
              diagnosticReason: 'exact_ready_document_url_refresh_converged',
              diagnostic: createLiveAdmissionReconciliationDiagnostic(receipt, error, {
                ...diagnostic,
                ...projectedRefreshProof,
                readyDocumentProbeErrorCode: refreshError.code,
                snapshotAfterGeneration: convergedSnapshot.generation,
                refreshedSessionGeneration: convergedSnapshot.generation,
                recapturedAdmissionMatchesRequested: true,
              }),
            });
          }
        }
      }
      return refusedDispatchInspection({
        rejectionError: error,
        diagnosticReason: 'ready_document_url_refresh_failed',
        diagnostic: createLiveAdmissionReconciliationDiagnostic(receipt, error, {
          ...diagnostic,
          ...projectedRefreshProof,
          readyDocumentProbeErrorCode: typeof refreshError?.code === 'string'
            ? refreshError.code
            : 'CONTENT_SCRIPT_READY_DOCUMENT_URL_REFRESH_FAILED',
        }),
      });
    }
    const projectedRefreshProof = projectReadyDocumentUrlRefreshProof(refreshResult?.proof);
    const refreshResultExact = !!(
      isPlainObject(refreshResult)
      && Object.isFrozen(refreshResult)
      && hasExactEnumerableKeys(refreshResult, [
        'beforeGeneration',
        'generation',
        'proof',
        'refreshed',
      ])
      && refreshResult.refreshed === true
      && refreshResult.beforeGeneration === snapshotBefore.generation
      && Number.isSafeInteger(refreshResult.generation)
      && refreshResult.generation > snapshotBefore.generation
      && isPlainObject(refreshResult.proof)
      && Object.isFrozen(refreshResult.proof)
      && hasExactEnumerableKeys(
        refreshResult.proof,
        READY_DOCUMENT_URL_REFRESH_PROOF_FIELDS,
      )
      && projectedRefreshProof.probeAttempted === true
      && projectedRefreshProof.probeResultCountExact === true
      && projectedRefreshProof.probeFrameMatches === true
      && projectedRefreshProof.probeDocumentMatches === true
      && projectedRefreshProof.probeUrlMatchesRequested === true
      && projectedRefreshProof.sessionRefreshGenerationMatched === true
      && projectedRefreshProof.sessionRefreshStatusReady === true
      && projectedRefreshProof.sessionRefreshDocumentMatched === true
      && projectedRefreshProof.sessionRefreshUrlMatchedExpected === true
      && projectedRefreshProof.sessionRefreshCommitted === true
      && projectedRefreshProof.sessionRefreshGenerationAdvanced === true
      && projectedRefreshProof.sessionRefreshDocumentPreserved === true
      && projectedRefreshProof.sessionRefreshUrlMatchesRequested === true
    );
    if (!refreshResultExact) {
      return refusedDispatchInspection({
        rejectionError: error,
        diagnosticReason: 'ready_document_url_refresh_result_invalid',
        diagnostic: createLiveAdmissionReconciliationDiagnostic(receipt, error, {
          ...diagnostic,
          ...projectedRefreshProof,
          readyDocumentProbeErrorCode: 'CONTENT_SCRIPT_READY_DOCUMENT_URL_REFRESH_RESULT_INVALID',
          refreshedSessionGeneration: Number.isSafeInteger(refreshResult?.generation)
            ? refreshResult.generation
            : null,
        }),
      });
    }

    let recapturedAdmission = null;
    try {
      recapturedAdmission = captureDispatchAdmissionContext({
        tabId: receipt.tabId,
        url: exactRequestedUrl,
        expectedDocumentId: correlation.documentId,
      });
    } catch (recaptureError) {
      return refusedDispatchInspection({
        rejectionError: recaptureError,
        diagnosticReason: 'ready_document_url_refresh_admission_recapture_failed',
        diagnostic: createLiveAdmissionReconciliationDiagnostic(receipt, error, {
          ...diagnostic,
          ...projectedRefreshProof,
          readyDocumentProbeErrorCode: typeof recaptureError?.code === 'string'
            ? recaptureError.code
            : 'PROTECTION_DISPATCH_ADMISSION_RECAPTURE_FAILED',
          refreshedSessionGeneration: refreshResult.generation,
          recapturedAdmissionMatchesRequested: false,
        }),
      });
    }
    const recapturedAdmissionMatchesRequested = recapturedAdmission?.documentId
      === correlation.documentId
      && recapturedAdmission?.url === exactRequestedUrl
      && recapturedAdmission?.sessionGeneration === refreshResult.generation;
    const refreshedDiagnostic = createLiveAdmissionReconciliationDiagnostic(receipt, error, {
      ...diagnostic,
      ...projectedRefreshProof,
      refreshedSessionGeneration: refreshResult.generation,
      recapturedAdmissionMatchesRequested,
    });
    if (!recapturedAdmissionMatchesRequested) {
      return refusedDispatchInspection({
        rejectionError: error,
        diagnosticReason: 'ready_document_url_refresh_admission_recapture_mismatch',
        diagnostic: refreshedDiagnostic,
      });
    }
    return readmittedDispatchInspection({
      admission: recapturedAdmission,
      diagnosticReason: 'exact_ready_document_url_refreshed',
      diagnostic: refreshedDiagnostic,
    });
  }

  return Object.freeze({
    inspectLiveAdmissionTabUpdateReconciliation,
  });
}

export default createProtectionLiveAdmissionReconciliation;
