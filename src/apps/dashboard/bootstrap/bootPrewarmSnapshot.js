import {
  BOOT_PREWARM_SECTION_KEYS,
  requireBootPrewarmDashboardSnapshot,
} from '../../boot/bootPrewarmSnapshotContract.js';

function asObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value
    : null;
}

export function normalizeBootPrewarmSnapshot(snapshot) {
  if (snapshot === null || typeof snapshot === 'undefined') return null;
  return requireBootPrewarmDashboardSnapshot(snapshot);
}

export function resolveBootPrewarmSection(input, sectionKey) {
  if (!BOOT_PREWARM_SECTION_KEYS.includes(sectionKey)) {
    throw new Error('BOOT_PREWARM_SECTION_UNSUPPORTED');
  }
  const source = asObject(input);
  if (!source) return null;

  const snapshotCandidate = normalizeBootPrewarmSnapshot(source.prewarmSnapshot);
  return snapshotCandidate?.[sectionKey] || null;
}
