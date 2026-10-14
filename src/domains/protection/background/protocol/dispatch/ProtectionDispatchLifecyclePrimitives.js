import {
  isDispatchReadyContentSession,
  isProtectionDispatchDocumentIdentityError,
} from './ProtectionDispatchTransport.js';

// Shared vocabulary for dispatch lifecycle arbitration: the error brand that marks an
// outcome as owned (rather than merely shaped like one), and the exact-identity readers
// the proofs compare against. Kept in its own module so the settlement proofs and the
// dispatcher can both depend on it without depending on each other.

export const protectionDispatchLifecycleErrorBrand = Symbol('protectionDispatchLifecycleError');

export function isPlainObject(value) {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

export function hasExactEnumerableKeys(value, expectedKeys) {
  if (!isPlainObject(value)) return false;
  const keys = Object.keys(value).sort((left, right) => left.localeCompare(right));
  const expected = [...expectedKeys].sort((left, right) => left.localeCompare(right));
  return keys.length === expected.length
    && keys.every((key, index) => key === expected[index]);
}

export function createDispatchTransactionError(code, details = {}) {
  const error = new Error(code);
  error.code = code;
  Object.assign(error, details);
  return error;
}

export function createOwnedDispatchLifecycleError(code, details = {}) {
  const error = createDispatchTransactionError(code, details);
  Object.defineProperty(error, protectionDispatchLifecycleErrorBrand, {
    value: true,
  });
  return error;
}

export function isOwnedDispatchLifecycleError(error) {
  return error?.[protectionDispatchLifecycleErrorBrand] === true
    || isProtectionDispatchDocumentIdentityError(error);
}

export function resolveExactDispatchHistoryUrl(value) {
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

export function resolveExactDispatchDocumentId(value) {
  return typeof value === 'string' && value && value === value.trim()
    ? value
    : null;
}

export function resolveReadyContentDocumentId(session) {
  if (!isDispatchReadyContentSession(session)) return null;
  if (
    typeof session.documentId !== 'string'
    || !session.documentId.trim()
    || session.documentId !== session.documentId.trim()
  ) {
    throw new Error('PROTECTION_DISPATCH_READY_DOCUMENT_ID_REQUIRED');
  }
  return session.documentId;
}

export function requireAtomicContentSessionSnapshot(contentScriptRuntime, tabId) {
  const snapshot = contentScriptRuntime.getTabSessionSnapshot(tabId);
  if (
    !isPlainObject(snapshot)
    || !Object.isFrozen(snapshot)
    || !Number.isSafeInteger(snapshot.generation)
    || snapshot.generation < 0
    || (
      snapshot.session !== null
      && (!isPlainObject(snapshot.session) || !Object.isFrozen(snapshot.session))
    )
    || (snapshot.session !== null && snapshot.generation <= 0)
  ) {
    throw new Error('PROTECTION_DISPATCH_CONTENT_SESSION_SNAPSHOT_INVALID');
  }
  return snapshot;
}

// Settlement inspection results.
//
// An inspection answers one of exactly three things, and the shape used to say so was an
// implicit union: callers had to know which key combinations were valid by reading every
// producer. These constructors make the three cases nameable and validate that a result
// cannot claim two of them at once.
//
//   settled     - the dispatch was cancelled, and this is the closed outcome to report
//   readmitted  - the rejection was reconciled; here is an admission to continue with
//   refused     - could not be settled, and here is the evidence for why not
//
// `diagnosticReason` is the observation label in all three. Two of its values also steer
// escalation; those are named constants at their owner rather than bare strings here.

function requireDiagnosticReason(value) {
  if (typeof value !== 'string' || !value.trim() || value.trim() !== value) {
    throw new Error('PROTECTION_DISPATCH_INSPECTION_DIAGNOSTIC_REASON_INVALID');
  }
  return value;
}

export function settledDispatchInspection({
  disposition,
  errorCode,
  phase = null,
  diagnosticReason,
  diagnostic = null,
}) {
  if (typeof disposition !== 'string' || !disposition.trim()) {
    throw new Error('PROTECTION_DISPATCH_INSPECTION_DISPOSITION_REQUIRED');
  }
  if (typeof errorCode !== 'string' || !errorCode.trim()) {
    throw new Error('PROTECTION_DISPATCH_INSPECTION_ERROR_CODE_REQUIRED');
  }
  return Object.freeze({
    settlement: Object.freeze({
      disposition,
      errorCode,
      phase: typeof phase === 'string' && phase ? phase : null,
    }),
    admission: null,
    rejectionError: null,
    diagnosticReason: requireDiagnosticReason(diagnosticReason),
    diagnostic,
  });
}

export function readmittedDispatchInspection({
  admission,
  diagnosticReason,
  diagnostic = null,
}) {
  if (!admission) {
    throw new Error('PROTECTION_DISPATCH_INSPECTION_ADMISSION_REQUIRED');
  }
  return Object.freeze({
    settlement: null,
    admission,
    rejectionError: null,
    diagnosticReason: requireDiagnosticReason(diagnosticReason),
    diagnostic,
  });
}

export function refusedDispatchInspection({
  diagnosticReason,
  diagnostic = null,
  rejectionError = null,
}) {
  return Object.freeze({
    settlement: null,
    admission: null,
    // A refusal may name a different error to report than the one it inspected.
    rejectionError: rejectionError instanceof Error ? rejectionError : null,
    diagnosticReason: requireDiagnosticReason(diagnosticReason),
    diagnostic,
  });
}
