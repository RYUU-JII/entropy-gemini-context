/**
 * Tab-updated settlement diagnostic payload.
 *
 * Every field a settlement diagnostic reports is a narrowing projection: the value is
 * emitted only when it carries the exact expected type, and `null` otherwise, so a
 * malformed error or diagnostic can never smuggle an arbitrary value into the log. That
 * rule was previously spelled out once per field across 130 lines of three-line ternaries,
 * which buried the one thing a reader actually wants from this code -- the list of facts a
 * settlement reports. Here the list is the code and the rule is applied by the projector.
 *
 * This module is pure: it builds the payload and never records it. The dispatcher owns the
 * decision to emit, and owns the diagnostic event name.
 */

import { resolveExactDispatchDocumentId } from './ProtectionDispatchLifecyclePrimitives.js';

// Document identities carried on the lifecycle error, each normalized through the exact
// document-id resolver rather than a bare type check.
const ERROR_DOCUMENT_ID_FIELDS = Object.freeze([
  'admissionDocumentId',
  'expectedDocumentId',
  'currentDocumentId',
  'committedDocumentId',
]);

// Generation counters carried on the lifecycle error. `sessionGeneration` is reported under
// `errorSessionGeneration` so it cannot be confused with the receipt's own generation.
const ERROR_INTEGER_FIELDS = Object.freeze([
  ['committedGeneration'],
  ['historyGeneration'],
  ['errorSessionGeneration', 'sessionGeneration'],
  ['expectedSessionGeneration'],
  ['currentSessionGeneration'],
]);

const DETAIL_INTEGER_FIELDS = Object.freeze([
  ['snapshotBeforeGeneration'],
  ['snapshotAfterGeneration'],
  ['refreshedSessionGeneration'],
]);

const DETAIL_STRING_FIELDS = Object.freeze([
  ['ingressIdentitySource'],
  ['readyDocumentProbeErrorCode'],
]);

// The evidence flags an inspector accumulated. Grouped by what they answer so a reader can
// find the relevant cluster without reading the whole list.
const DETAIL_BOOLEAN_FIELDS = Object.freeze([
  // Did the error's own recorded URLs line up with what was requested and observed?
  ['requestedUrlMatchesError'],
  ['observedSessionUrlMatchesError'],
  ['documentMatchesReceipt'],
  // What did the single live tab lookup see?
  ['liveTabIdMatches'],
  ['liveTabUrlMatchesSession'],
  ['liveTabUrlMatchesRequested'],
  ['livePendingUrlPresent'],
  ['livePendingUrlMatchesSession'],
  ['livePendingUrlMatchesRequested'],
  ['sessionGenerationStable'],
  // Did the exact document probe run, and what did it prove?
  ['probeAttempted'],
  ['probeResultCountExact'],
  ['probeFrameMatches'],
  ['probeDocumentMatches'],
  ['probeUrlMatchesRequested'],
  // What did the ready-document URL refresh settle on?
  ['sessionRefreshGenerationMatched'],
  ['sessionRefreshStatusReady'],
  ['sessionRefreshDocumentMatched'],
  ['sessionRefreshUrlMatchedExpected'],
  ['sessionRefreshCommitted'],
  ['sessionRefreshGenerationAdvanced'],
  ['sessionRefreshDocumentPreserved'],
  ['sessionRefreshUrlMatchesRequested'],
  ['recapturedAdmissionMatchesRequested'],
]);

function projectExactInteger(source, key) {
  return Number.isSafeInteger(source?.[key]) ? source[key] : null;
}

function projectExactFields(source, { integers = [], booleans = [], strings = [] }) {
  const projected = {};
  for (const [reportedKey, sourceKey = reportedKey] of integers) {
    projected[reportedKey] = projectExactInteger(source, sourceKey);
  }
  for (const [reportedKey, sourceKey = reportedKey] of booleans) {
    projected[reportedKey] = typeof source?.[sourceKey] === 'boolean' ? source[sourceKey] : null;
  }
  for (const [reportedKey, sourceKey = reportedKey] of strings) {
    projected[reportedKey] = typeof source?.[sourceKey] === 'string' ? source[sourceKey] : null;
  }
  return projected;
}

// Whether the lifecycle event that invalidated the lane was observed before or after the
// receipt entered the queue. This is the ordering fact that separates "the navigation
// cancelled a dispatch already in flight" from "the dispatch was admitted after the
// navigation", so it is derived here rather than left to the reader of two raw sequences.
function describeIngressOrder(eventIngressSequence, receiptIngressSequence) {
  if (eventIngressSequence === null) return null;
  return eventIngressSequence < receiptIngressSequence ? 'before_receipt' : 'after_receipt';
}

export function buildTabUpdatedSettlementDiagnosticPayload(receipt, error, {
  diagnosticReason,
  disposition = 'hard_failure',
  diagnostic = null,
} = {}) {
  const historyIngressSequence = projectExactInteger(error, 'historyIngressSequence');
  const committedIngressSequence = projectExactInteger(error, 'committedIngressSequence');
  const documentIds = {};
  for (const key of ERROR_DOCUMENT_ID_FIELDS) {
    documentIds[key] = resolveExactDispatchDocumentId(error?.[key]);
  }
  return {
    tabId: receipt.tabId,
    status: receipt.status,
    disposition,
    // An error with no code is still an error: it is reported as unclassified rather than
    // as an absent code, which would read as "settled cleanly".
    errorCode: error === null
      ? null
      : (typeof error?.code === 'string' ? error.code : 'UNCLASSIFIED_ERROR'),
    phase: typeof error?.phase === 'string' ? error.phase : null,
    diagnosticReason,
    receiptIngressSequence: receipt.ingressSequence,
    receiptDocumentId: receipt.observedDocumentId,
    receiptSessionGeneration: projectExactInteger(receipt, 'observedSessionGeneration'),
    ...documentIds,
    committedIngressSequence,
    committedIngressOrder: describeIngressOrder(
      committedIngressSequence,
      receipt.ingressSequence,
    ),
    historyIngressSequence,
    historyIngressOrder: describeIngressOrder(historyIngressSequence, receipt.ingressSequence),
    ...projectExactFields(error, { integers: ERROR_INTEGER_FIELDS }),
    ...projectExactFields(diagnostic, {
      integers: DETAIL_INTEGER_FIELDS,
      booleans: DETAIL_BOOLEAN_FIELDS,
      strings: DETAIL_STRING_FIELDS,
    }),
  };
}

export default buildTabUpdatedSettlementDiagnosticPayload;
