const PROTECTION_TAB_UPDATED_INGRESS_RECEIPT_KIND =
  'protection_tabs_on_updated_ingress';
const PROTECTION_TAB_UPDATED_OUTCOME_KIND =
  'protection_tabs_on_updated_outcome';
const PROTECTION_TAB_UPDATED_PROTOCOL_SCHEMA_VERSION = 1;

const issuedTabUpdatedIngressReceipts = new WeakSet();
const claimedTabUpdatedIngressReceipts = new WeakSet();
const settledTabUpdatedIngressReceipts = new WeakSet();
const consumedTabUpdatedOutcomes = new WeakSet();
const issuedTabUpdatedOutcomes = new WeakMap();

const PROTECTION_TAB_UPDATED_SUPERSEDED_ERROR_CODES = Object.freeze({
  protection_tab_removed: Object.freeze([
    'PROTECTION_DISPATCH_SERIAL_QUEUE_TAB_EVICTED',
  ]),
  protection_ingress_superseded: Object.freeze([
    'PROTECTION_TAB_UPDATED_INGRESS_SUPERSEDED',
  ]),
  protection_document_superseded: Object.freeze([
    'PROTECTION_DISPATCH_EXPECTED_DOCUMENT_STALE',
    'PROTECTION_DISPATCH_ADMISSION_DOCUMENT_MISMATCH',
    'PROTECTION_DISPATCH_TRANSACTION_DOCUMENT_MISMATCH',
    'PROTECTION_DISPATCH_DOCUMENT_IDENTITY_INVALID',
  ]),
  protection_committed_navigation_superseded: Object.freeze([
    'PROTECTION_DISPATCH_COMMITTED_NAVIGATION_CANCELED',
  ]),
  protection_history_context_superseded: Object.freeze([
    'PROTECTION_DISPATCH_ADMISSION_CONTEXT_MISMATCH',
  ]),
  protection_history_pending_tab_update_superseded: Object.freeze([
    'PROTECTION_DISPATCH_ADMISSION_CONTEXT_MISMATCH',
  ]),
  protection_delayed_tab_update_reconciled: Object.freeze([
    'PROTECTION_DISPATCH_ADMISSION_CONTEXT_MISMATCH',
  ]),
  protection_same_document_url_superseded: Object.freeze([
    'PROTECTION_DISPATCH_TRANSACTION_CONTEXT_MISMATCH',
    'PROTECTION_DISPATCH_TRANSACTION_CONTEXT_STALE',
  ]),
  protection_permissionless_admission_superseded: Object.freeze([
    'PROTECTION_DISPATCH_PERMISSIONLESS_ADMISSION_STALE',
  ]),
  protection_history_pre_ack_superseded: Object.freeze([
    'PROTECTION_DISPATCH_HISTORY_PRE_ACK_CANCELED',
  ]),
  // A navigation invalidation whose exact proof object was already overwritten by a
  // later lifecycle event on the same tab.
  protection_navigation_superseded: Object.freeze([
    'PROTECTION_DISPATCH_NAVIGATION_SUPERSEDED',
  ]),
});

function isPlainObject(value) {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function hasOwnProperty(value, key) {
  return !!value && Object.prototype.hasOwnProperty.call(value, key);
}

function createTabUpdatedProtocolError(code, details = {}) {
  const error = new Error(code);
  error.code = code;
  Object.assign(error, details);
  return error;
}

function requireTabId(value) {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw createTabUpdatedProtocolError(
      'PROTECTION_TAB_UPDATED_INGRESS_RECEIPT_TAB_ID_INVALID',
    );
  }
  return value;
}

function requireStatus(value) {
  if (value !== 'loading' && value !== 'complete') {
    throw createTabUpdatedProtocolError(
      'PROTECTION_TAB_UPDATED_INGRESS_RECEIPT_STATUS_INVALID',
    );
  }
  return value;
}

function requireSequence(value) {
  if (!Number.isSafeInteger(value) || value <= 0) {
    throw createTabUpdatedProtocolError(
      'PROTECTION_TAB_UPDATED_INGRESS_RECEIPT_SEQUENCE_INVALID',
    );
  }
  return value;
}

function requireObservedAt(value) {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw createTabUpdatedProtocolError(
      'PROTECTION_TAB_UPDATED_INGRESS_RECEIPT_OBSERVED_AT_INVALID',
    );
  }
  return value;
}

function requireExactUrl(value, errorCode) {
  if (typeof value !== 'string' || !value || value !== value.trim()) {
    throw createTabUpdatedProtocolError(errorCode);
  }
  try {
    const parsed = new URL(value);
    if (
      (parsed.protocol !== 'http:' && parsed.protocol !== 'https:')
      || parsed.href !== value
    ) {
      throw createTabUpdatedProtocolError(errorCode);
    }
    return parsed.href;
  } catch (error) {
    if (error?.code === errorCode) throw error;
    throw createTabUpdatedProtocolError(errorCode);
  }
}

function requireOptionalDocumentId(value) {
  if (value === null) return null;
  if (typeof value !== 'string' || !value || value !== value.trim()) {
    throw createTabUpdatedProtocolError(
      'PROTECTION_TAB_UPDATED_INGRESS_RECEIPT_DOCUMENT_ID_INVALID',
    );
  }
  return value;
}

function requireOptionalSessionUrl(value) {
  if (value === null) return null;
  return requireExactUrl(
    value,
    'PROTECTION_TAB_UPDATED_INGRESS_RECEIPT_SESSION_URL_INVALID',
  );
}

function requireOptionalSessionGeneration(value) {
  if (value === null) return null;
  if (!Number.isSafeInteger(value) || value <= 0) {
    throw createTabUpdatedProtocolError(
      'PROTECTION_TAB_UPDATED_INGRESS_RECEIPT_SESSION_GENERATION_INVALID',
    );
  }
  return value;
}

export function createProtectionTabUpdatedIngressReceipt({
  tabId,
  status,
  requestedUrl,
  observedAt,
  ingressSequence,
  observedDocumentId = null,
  observedSessionUrl = null,
  observedSessionGeneration = null,
} = {}) {
  const receipt = Object.freeze({
    kind: PROTECTION_TAB_UPDATED_INGRESS_RECEIPT_KIND,
    schemaVersion: PROTECTION_TAB_UPDATED_PROTOCOL_SCHEMA_VERSION,
    tabId: requireTabId(tabId),
    status: requireStatus(status),
    requestedUrl: requireExactUrl(
      requestedUrl,
      'PROTECTION_TAB_UPDATED_INGRESS_RECEIPT_URL_INVALID',
    ),
    observedAt: requireObservedAt(observedAt),
    ingressSequence: requireSequence(ingressSequence),
    observedDocumentId: requireOptionalDocumentId(observedDocumentId),
    observedSessionUrl: requireOptionalSessionUrl(observedSessionUrl),
    observedSessionGeneration: requireOptionalSessionGeneration(
      observedSessionGeneration,
    ),
  });
  if (
    (receipt.observedDocumentId === null) !== (receipt.observedSessionUrl === null)
    || (receipt.observedDocumentId === null) !== (receipt.observedSessionGeneration === null)
  ) {
    throw createTabUpdatedProtocolError(
      'PROTECTION_TAB_UPDATED_INGRESS_RECEIPT_SESSION_IDENTITY_INCOMPLETE',
    );
  }
  issuedTabUpdatedIngressReceipts.add(receipt);
  return receipt;
}

export function claimProtectionTabUpdatedIngressReceipt(receipt, {
  tabId,
  requestedUrl,
} = {}) {
  if (!isPlainObject(receipt) || !Object.isFrozen(receipt)) {
    throw createTabUpdatedProtocolError(
      'PROTECTION_TAB_UPDATED_INGRESS_RECEIPT_INVALID',
    );
  }
  if (claimedTabUpdatedIngressReceipts.has(receipt)) {
    throw createTabUpdatedProtocolError(
      'PROTECTION_TAB_UPDATED_INGRESS_RECEIPT_REUSED',
    );
  }
  if (!issuedTabUpdatedIngressReceipts.has(receipt)) {
    throw createTabUpdatedProtocolError(
      'PROTECTION_TAB_UPDATED_INGRESS_RECEIPT_UNTRUSTED',
    );
  }
  if (
    receipt.kind !== PROTECTION_TAB_UPDATED_INGRESS_RECEIPT_KIND
    || receipt.schemaVersion !== PROTECTION_TAB_UPDATED_PROTOCOL_SCHEMA_VERSION
  ) {
    throw createTabUpdatedProtocolError(
      'PROTECTION_TAB_UPDATED_INGRESS_RECEIPT_SHAPE_INVALID',
    );
  }
  const exactTabId = requireTabId(tabId);
  const exactRequestedUrl = requireExactUrl(
    requestedUrl,
    'PROTECTION_TAB_UPDATED_INGRESS_RECEIPT_CALL_URL_INVALID',
  );
  if (receipt.tabId !== exactTabId) {
    throw createTabUpdatedProtocolError(
      'PROTECTION_TAB_UPDATED_INGRESS_RECEIPT_TAB_MISMATCH',
    );
  }
  if (receipt.requestedUrl !== exactRequestedUrl) {
    throw createTabUpdatedProtocolError(
      'PROTECTION_TAB_UPDATED_INGRESS_RECEIPT_URL_MISMATCH',
    );
  }
  issuedTabUpdatedIngressReceipts.delete(receipt);
  claimedTabUpdatedIngressReceipts.add(receipt);
  return receipt;
}

export function createProtectionTabUpdatedDispatchOutcome(input = {}) {
  const {
    receipt,
    status = 'superseded',
    disposition,
    errorCode = null,
    phase = null,
    dispatchResult,
  } = input;
  if (!claimedTabUpdatedIngressReceipts.has(receipt)) {
    throw createTabUpdatedProtocolError(
      'PROTECTION_TAB_UPDATED_OUTCOME_RECEIPT_CLAIM_REQUIRED',
    );
  }
  if (settledTabUpdatedIngressReceipts.has(receipt)) {
    throw createTabUpdatedProtocolError(
      'PROTECTION_TAB_UPDATED_OUTCOME_RECEIPT_REUSED',
    );
  }
  if (status !== 'applied' && status !== 'superseded') {
    throw createTabUpdatedProtocolError(
      'PROTECTION_TAB_UPDATED_OUTCOME_STATUS_INVALID',
    );
  }

  const normalizedDisposition = typeof disposition === 'string' ? disposition.trim() : '';
  const normalizedErrorCode = typeof errorCode === 'string' ? errorCode.trim() : '';
  if (status === 'applied') {
    if (
      normalizedDisposition !== 'protection_applied'
      || disposition !== normalizedDisposition
      || errorCode !== null
      || phase !== null
      || !hasOwnProperty(input, 'dispatchResult')
    ) {
      throw createTabUpdatedProtocolError(
        'PROTECTION_TAB_UPDATED_OUTCOME_APPLIED_INVALID',
      );
    }
  } else {
    const compatibleErrorCodes = PROTECTION_TAB_UPDATED_SUPERSEDED_ERROR_CODES[
      normalizedDisposition
    ] || null;
    if (!compatibleErrorCodes || normalizedDisposition !== disposition) {
      throw createTabUpdatedProtocolError(
        'PROTECTION_TAB_UPDATED_OUTCOME_DISPOSITION_INVALID',
      );
    }
    if (
      !normalizedErrorCode
      || normalizedErrorCode !== errorCode
      || !compatibleErrorCodes.includes(normalizedErrorCode)
    ) {
      throw createTabUpdatedProtocolError(
        'PROTECTION_TAB_UPDATED_OUTCOME_ERROR_CODE_INCOMPATIBLE',
      );
    }
  }
  if (phase !== null && (
    typeof phase !== 'string'
    || !phase
    || phase !== phase.trim()
  )) {
    throw createTabUpdatedProtocolError(
      'PROTECTION_TAB_UPDATED_OUTCOME_PHASE_INVALID',
    );
  }
  if (
    normalizedDisposition === 'protection_history_pre_ack_superseded'
    && phase !== 'gate_mutation:gate_bridge_after_theme_resolution'
  ) {
    throw createTabUpdatedProtocolError(
      'PROTECTION_TAB_UPDATED_OUTCOME_PHASE_INCOMPATIBLE',
    );
  }
  if (
    normalizedDisposition === 'protection_delayed_tab_update_reconciled'
    && phase !== 'admission_capture'
  ) {
    throw createTabUpdatedProtocolError(
      'PROTECTION_TAB_UPDATED_OUTCOME_PHASE_INCOMPATIBLE',
    );
  }

  const outcome = Object.freeze({
    kind: PROTECTION_TAB_UPDATED_OUTCOME_KIND,
    schemaVersion: PROTECTION_TAB_UPDATED_PROTOCOL_SCHEMA_VERSION,
    tabId: receipt.tabId,
    ingressSequence: receipt.ingressSequence,
    status,
    disposition: normalizedDisposition,
    errorCode: status === 'superseded' ? normalizedErrorCode : null,
    phase,
    dispatchResult: status === 'applied' ? dispatchResult : null,
  });
  settledTabUpdatedIngressReceipts.add(receipt);
  issuedTabUpdatedOutcomes.set(outcome, receipt);
  return outcome;
}

export function isProtectionTabUpdatedDispatchOutcome(value) {
  return !!value
    && issuedTabUpdatedOutcomes.has(value)
    && Object.isFrozen(value)
    && value.kind === PROTECTION_TAB_UPDATED_OUTCOME_KIND
    && value.schemaVersion === PROTECTION_TAB_UPDATED_PROTOCOL_SCHEMA_VERSION;
}

export function consumeProtectionTabUpdatedDispatchOutcome(value, {
  receipt,
} = {}) {
  if (consumedTabUpdatedOutcomes.has(value)) {
    throw createTabUpdatedProtocolError('PROTECTION_TAB_UPDATED_OUTCOME_REUSED');
  }
  if (!isProtectionTabUpdatedDispatchOutcome(value)) {
    throw createTabUpdatedProtocolError('PROTECTION_TAB_UPDATED_OUTCOME_INVALID');
  }
  if (issuedTabUpdatedOutcomes.get(value) !== receipt) {
    throw createTabUpdatedProtocolError(
      'PROTECTION_TAB_UPDATED_OUTCOME_RECEIPT_MISMATCH',
    );
  }
  if (
    value.tabId !== receipt.tabId
    || value.ingressSequence !== receipt.ingressSequence
  ) {
    throw createTabUpdatedProtocolError(
      'PROTECTION_TAB_UPDATED_OUTCOME_CORRELATION_INVALID',
    );
  }
  issuedTabUpdatedOutcomes.delete(value);
  consumedTabUpdatedOutcomes.add(value);
  return value;
}
