export const ENSO_FEED_SURFACE_ENTRY_GRACE_MS = 2 * 60 * 1000;

function normalizeNow(value = Date.now()) {
  const numeric = Math.round(Number(value));
  if (!Number.isFinite(numeric) || numeric < 0) {
    throw new Error(`ENSO_FEED_SURFACE_GRACE_NOW_INVALID:${String(value)}`);
  }
  return numeric;
}

function normalizeGraceMs(value) {
  const numeric = Math.round(Number(value));
  if (!Number.isFinite(numeric) || numeric < 0) {
    throw new Error(`ENSO_FEED_SURFACE_GRACE_DURATION_INVALID:${String(value)}`);
  }
  return numeric;
}

function normalizeSemanticSurfaceId(value) {
  if (typeof value !== 'string') {
    throw new Error(`ENSO_FEED_SEMANTIC_SURFACE_ID_INVALID:${String(value)}`);
  }
  const normalized = value.trim();
  if (!normalized || normalized.length > 180 || /[\u0000-\u001f\u007f]/u.test(normalized)) {
    throw new Error(`ENSO_FEED_SEMANTIC_SURFACE_ID_INVALID:${String(value)}`);
  }
  return normalized;
}

function collectSemanticSurfaceIds(source) {
  if (!source || typeof source !== 'object') return [];
  return [source.semanticSurfaceId]
    .filter((value) => value !== undefined && value !== null)
    .map(normalizeSemanticSurfaceId);
}

/**
 * Resolves the canonical, item-independent feed surface family. Identity must
 * be explicit; disagreement across local owner snapshots is a contract failure
 * rather than a pathname/profile fallback.
 */
export function resolveEnsoFeedSemanticSurfaceId(...sources) {
  const ids = sources.flatMap(collectSemanticSurfaceIds);
  if (ids.length === 0) {
    throw new Error('ENSO_FEED_SEMANTIC_SURFACE_ID_MISSING');
  }
  const uniqueIds = Array.from(new Set(ids));
  if (uniqueIds.length !== 1) {
    throw new Error(`ENSO_FEED_SEMANTIC_SURFACE_ID_CONFLICT:${uniqueIds.join(',')}`);
  }
  return uniqueIds[0];
}

/**
 * Feed-only surface-entry grace. It does not own source first-grace clocks,
 * the content-local cross-source cooldown, or the active permit. Feed Horizon
 * configures its source first grace to zero because this two-minute surface
 * grace plus dose and seam already place its first opportunity.
 */
export class EnsoFeedSurfaceEntryGrace {
  constructor({ graceMs = ENSO_FEED_SURFACE_ENTRY_GRACE_MS } = {}) {
    this._graceMs = normalizeGraceMs(graceMs);
    this.reset();
  }

  observe({ semanticSurfaceId } = {}, { now = Date.now() } = {}) {
    const normalizedNow = normalizeNow(now);
    const nextSurfaceId = resolveEnsoFeedSemanticSurfaceId({
      semanticSurfaceId,
    });
    const previousSurfaceId = this._semanticSurfaceId;
    const changed = previousSurfaceId !== nextSurfaceId;
    if (changed) {
      this._semanticSurfaceId = nextSurfaceId;
      this._enteredAt = normalizedNow;
    }
    return Object.freeze({
      ...this.getSnapshot({ now: normalizedNow }),
      changed,
      previousSemanticSurfaceId: previousSurfaceId,
    });
  }

  evaluate({ semanticSurfaceId } = {}, { now = Date.now() } = {}) {
    const normalizedNow = normalizeNow(now);
    const requestedSurfaceId = resolveEnsoFeedSemanticSurfaceId({
      semanticSurfaceId,
    });
    if (!this._semanticSurfaceId) {
      throw new Error('ENSO_FEED_SURFACE_GRACE_NOT_OBSERVED');
    }
    if (requestedSurfaceId !== this._semanticSurfaceId) {
      throw new Error(
        `ENSO_FEED_SURFACE_GRACE_ID_MISMATCH:${this._semanticSurfaceId}:${requestedSurfaceId}`,
      );
    }
    const snapshot = this.getSnapshot({ now: normalizedNow });
    return Object.freeze({
      ...snapshot,
      allowed: snapshot.remainingMs === 0,
      reason: snapshot.remainingMs > 0 ? 'surface_entry_grace_active' : 'available',
    });
  }

  getSnapshot({ now = Date.now() } = {}) {
    const normalizedNow = normalizeNow(now);
    const eligibleAt = this._semanticSurfaceId
      ? this._enteredAt + this._graceMs
      : 0;
    return Object.freeze({
      version: 1,
      semanticSurfaceId: this._semanticSurfaceId,
      enteredAt: this._enteredAt,
      graceMs: this._graceMs,
      eligibleAt,
      remainingMs: eligibleAt > normalizedNow ? eligibleAt - normalizedNow : 0,
    });
  }

  reset() {
    this._semanticSurfaceId = null;
    this._enteredAt = 0;
  }
}

export default EnsoFeedSurfaceEntryGrace;
