import {
  PROTECTION_CANONICAL_ARTIFACT_IDS,
  PROTECTION_CANONICAL_ARTIFACT_ID_LIST,
} from '../catalog/artifactFamilyCatalog.js';

export { PROTECTION_CANONICAL_ARTIFACT_IDS };

export const ARTIFACT_IDS = PROTECTION_CANONICAL_ARTIFACT_ID_LIST;

export const PROTECTION_RUNTIME_ARTIFACT_IDS = Object.freeze({
  TIME_ANCHOR: 'timeAnchor',
  SENTINEL_FLARE: 'sentinelFlare',
  MEMORY_PURGE: 'memoryPurge',
  ENTRY_CHECKPOINT: 'entryCheckpoint',
  RETURN_GUARD: 'returnGuard',
  DETOUR_SPREAD_GUARD: 'detourSpreadGuard',
});

export const RUNTIME_ARTIFACT_IDS = Object.freeze(
  Object.values(PROTECTION_RUNTIME_ARTIFACT_IDS),
);
export const RUNTIME_ARTIFACT_ID_SET = new Set(RUNTIME_ARTIFACT_IDS);

export function isRuntimeArtifactId(value) {
  if (typeof value !== 'string') return false;
  return RUNTIME_ARTIFACT_ID_SET.has(value);
}

export function normalizeRuntimeArtifactId(value, fallback = '') {
  const normalized = typeof value === 'string' ? value.trim() : '';
  if (RUNTIME_ARTIFACT_ID_SET.has(normalized)) return normalized;
  return fallback;
}
