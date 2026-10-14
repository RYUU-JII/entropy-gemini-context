function requireSnapshot(snapshot) {
  if (!snapshot || typeof snapshot !== 'object' || Array.isArray(snapshot)) {
    throw new Error('FIRST_VISION_PRESENTATION_SNAPSHOT_REQUIRED');
  }
  return snapshot;
}
function requireCanonicalOperation(operation) {
  if (typeof operation !== 'function') {
    throw new Error('FIRST_VISION_PRESENTATION_CANONICAL_OPERATION_REQUIRED');
  }
  return operation;
}

export function resolveFirstVisionPresentationProjection(snapshot) {
  const canonicalSnapshot = requireSnapshot(snapshot);
  return Object.freeze({
    canonicalSnapshot,
    effectiveState: canonicalSnapshot.state,
    canonicalWrites: true,
    previewActive: false,
  });
}

export function persistFirstVisionPresentedForProjection({
  recordCanonical,
} = {}) {
  return requireCanonicalOperation(recordCanonical)();
}

export function persistFirstVisionSpentForProjection({
  recordCanonical,
} = {}) {
  return requireCanonicalOperation(recordCanonical)();
}
