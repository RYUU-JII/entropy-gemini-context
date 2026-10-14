export const CONTENT_RECEIVER_CAPABILITY_VERSION = 1;

const issuedContentReceiverCapabilities = new WeakSet();

function requirePositiveInteger(value, errorCode) {
  const normalized = Number(value);
  if (!Number.isSafeInteger(normalized) || normalized <= 0) {
    throw new Error(errorCode);
  }
  return normalized;
}

function requireDocumentId(value) {
  if (typeof value !== 'string' || !value || value !== value.trim()) {
    throw new Error('CONTENT_RECEIVER_CAPABILITY_DOCUMENT_ID_INVALID');
  }
  return value;
}

export function createContentReceiverCapability({
  receiverCapabilityVersion,
  documentId,
  attemptId,
  startedAt,
  receiverReadyAt,
  sessionGeneration,
} = {}) {
  if (receiverCapabilityVersion !== CONTENT_RECEIVER_CAPABILITY_VERSION) {
    throw new Error('CONTENT_RECEIVER_CAPABILITY_VERSION_INVALID');
  }
  const capability = Object.freeze({
    schemaVersion: CONTENT_RECEIVER_CAPABILITY_VERSION,
    documentId: requireDocumentId(documentId),
    attemptId: requirePositiveInteger(
      attemptId,
      'CONTENT_RECEIVER_CAPABILITY_ATTEMPT_ID_INVALID',
    ),
    startedAt: requirePositiveInteger(
      startedAt,
      'CONTENT_RECEIVER_CAPABILITY_STARTED_AT_INVALID',
    ),
    receiverReadyAt: requirePositiveInteger(
      receiverReadyAt,
      'CONTENT_RECEIVER_CAPABILITY_READY_AT_INVALID',
    ),
    sessionGeneration: requirePositiveInteger(
      sessionGeneration,
      'CONTENT_RECEIVER_CAPABILITY_SESSION_GENERATION_INVALID',
    ),
  });
  if (capability.receiverReadyAt < capability.startedAt) {
    throw new Error('CONTENT_RECEIVER_CAPABILITY_TIMELINE_INVALID');
  }
  issuedContentReceiverCapabilities.add(capability);
  return capability;
}

export function requireContentReceiverCapability(value, {
  expectedDocumentId = null,
} = {}) {
  if (!issuedContentReceiverCapabilities.has(value) || !Object.isFrozen(value)) {
    throw new Error('CONTENT_RECEIVER_CAPABILITY_UNTRUSTED');
  }
  if (expectedDocumentId !== null && value.documentId !== expectedDocumentId) {
    throw new Error('CONTENT_RECEIVER_CAPABILITY_DOCUMENT_MISMATCH');
  }
  return value;
}
