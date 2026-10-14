const outcomesByTarget = new WeakMap();

function isObjectKey(value) {
  return (typeof value === 'object' && value !== null) || typeof value === 'function';
}

function normalizeFiniteInteger(value) {
  const numeric = Number(value);
  return Number.isSafeInteger(numeric) && numeric >= 0 ? numeric : null;
}

function normalizeOptionalFiniteInteger(value) {
  if (value === null || value === undefined) return null;
  return normalizeFiniteInteger(value);
}

function normalizeOutcome(outcome) {
  const generation = normalizeFiniteInteger(outcome?.generation);
  const operationId = normalizeFiniteInteger(outcome?.operationId);
  const flushId = normalizeOptionalFiniteInteger(outcome?.flushId);
  const deliverySequence = normalizeOptionalFiniteInteger(outcome?.deliverySequence);
  const action = outcome?.action === 'pruned' || outcome?.action === 'restored'
    ? outcome.action
    : null;
  if (generation === null || operationId === null || action === null) return null;
  return Object.freeze({
    generation,
    operationId,
    flushId,
    deliverySequence,
    action,
    mode: action === 'pruned' && (
      outcome?.mode === 'hide'
      || outcome?.mode === 'collapse'
      || outcome?.mode === 'remove'
    )
      ? outcome.mode
      : null,
  });
}

/**
 * Opaque, non-enumerable correlation index owned by Short Form. It retains no
 * page content and is not a session, report, or automation API.
 */
export function recordShortFormTargetOutcome(target, outcome) {
  if (!isObjectKey(target)) return false;
  const normalized = normalizeOutcome(outcome);
  if (!normalized) return false;
  const existing = outcomesByTarget.get(target);
  const current = {
    pruned: existing?.pruned?.generation === normalized.generation
      ? existing.pruned
      : null,
    restored: existing?.restored?.generation === normalized.generation
      ? existing.restored
      : null,
  };
  outcomesByTarget.set(target, {
    ...current,
    [normalized.action]: normalized,
  });
  return true;
}

export function readShortFormTargetOutcome(target) {
  if (!isObjectKey(target)) return null;
  const outcome = outcomesByTarget.get(target);
  if (!outcome) return null;
  return {
    pruned: outcome.pruned ? { ...outcome.pruned } : null,
    restored: outcome.restored ? { ...outcome.restored } : null,
  };
}
