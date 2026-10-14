export const VIDEO_SKIP_POOL_SCHEMA_VERSION = 1;

const VIDEO_SKIP_POOL_KEYS = Object.freeze([
  'schemaVersion',
  'cooldownUntil',
  'updatedAt',
]);

export function createDefaultVideoSkipPool() {
  return {
    schemaVersion: VIDEO_SKIP_POOL_SCHEMA_VERSION,
    cooldownUntil: 0,
    updatedAt: 0,
  };
}

export function normalizeVideoSkipPoolSnapshot(snapshot) {
  if (!snapshot || typeof snapshot !== 'object' || Array.isArray(snapshot)) {
    throw new Error('VIDEO_SKIP_POOL_CONTRACT_INVALID');
  }
  const snapshotKeys = Object.keys(snapshot);
  if (
    snapshotKeys.length !== VIDEO_SKIP_POOL_KEYS.length
    || !VIDEO_SKIP_POOL_KEYS.every((key) => Object.prototype.hasOwnProperty.call(snapshot, key))
  ) {
    throw new Error('VIDEO_SKIP_POOL_CONTRACT_INVALID');
  }
  if (snapshot.schemaVersion !== VIDEO_SKIP_POOL_SCHEMA_VERSION) {
    throw new Error('VIDEO_SKIP_POOL_VERSION_UNSUPPORTED');
  }
  if (
    !Number.isFinite(snapshot.cooldownUntil)
    || snapshot.cooldownUntil < 0
    || !Number.isFinite(snapshot.updatedAt)
    || snapshot.updatedAt < 0
  ) {
    throw new Error('VIDEO_SKIP_POOL_CONTRACT_INVALID');
  }

  return {
    schemaVersion: VIDEO_SKIP_POOL_SCHEMA_VERSION,
    cooldownUntil: Math.max(0, Math.floor(snapshot.cooldownUntil)),
    updatedAt: Math.max(0, Math.floor(snapshot.updatedAt)),
  };
}

export function serializeVideoSkipPool(pool, { now = Date.now() } = {}) {
  const updatedAt = Number(pool?.updatedAt);
  return {
    schemaVersion: VIDEO_SKIP_POOL_SCHEMA_VERSION,
    cooldownUntil: Math.max(0, Math.floor(Number(pool?.cooldownUntil) || 0)),
    updatedAt: Number.isFinite(updatedAt) && updatedAt > 0
      ? Math.floor(updatedAt)
      : Math.max(0, Math.floor(Number(now) || 0)),
  };
}

export function mergeVideoSkipPoolSnapshots(currentSnapshot, candidateSnapshot, {
  now = Date.now(),
} = {}) {
  const current = currentSnapshot
    ? normalizeVideoSkipPoolSnapshot(currentSnapshot)
    : createDefaultVideoSkipPool();
  const candidate = normalizeVideoSkipPoolSnapshot(candidateSnapshot);
  const cooldownUntil = Math.max(current.cooldownUntil, candidate.cooldownUntil);
  const changed = cooldownUntil !== current.cooldownUntil;

  if (!changed) return { snapshot: current, changed: false };

  return {
    snapshot: {
      schemaVersion: VIDEO_SKIP_POOL_SCHEMA_VERSION,
      cooldownUntil,
      updatedAt: Math.max(
        Math.floor(Number(now) || 0),
        current.updatedAt + 1,
        candidate.updatedAt
      ),
    },
    changed: true,
  };
}
