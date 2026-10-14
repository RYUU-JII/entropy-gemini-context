import {
  readPageLocalJsonItem,
  writePageLocalJsonItem,
} from '@/platform/browser/pageLocalStorage.js';

export const ARTIFACT_DISCLOSURE_NAV_CUE_STORAGE_KEY = 'dashboard.artifact_disclosure_nav_cue.v2';

function isPlainObject(value) {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function toTimestamp(value) {
  if (value === null || value === undefined || value === '') return null;
  const numeric = Number(value);
  return Number.isFinite(numeric) && numeric >= 0 ? Math.floor(numeric) : null;
}

function normalizeFamilyIds(value) {
  if (!Array.isArray(value)) return Object.freeze([]);
  return Object.freeze(Array.from(new Set(value.map((familyId) => (
    typeof familyId === 'string' ? familyId.trim() : ''
  )).filter(Boolean))));
}

function resolveNavCueDisclosedFamilyIds(snapshot = null) {
  if (snapshot?.unlockProgress?.debugOverrideActive !== true) {
    return normalizeFamilyIds(snapshot?.disclosedFamilyIds);
  }
  if (!Array.isArray(snapshot?.canonicalDisclosedFamilyIds)) {
    throw new Error('ARTIFACT_DISCLOSURE_NAV_CUE_CANONICAL_FAMILY_IDS_REQUIRED');
  }
  return normalizeFamilyIds(snapshot.canonicalDisclosedFamilyIds);
}

function readInjectedStorageJson(storage) {
  if (!storage || typeof storage.getItem !== 'function') return null;
  try {
    const rawValue = storage.getItem(ARTIFACT_DISCLOSURE_NAV_CUE_STORAGE_KEY);
    return rawValue ? JSON.parse(rawValue) : null;
  } catch (_error) {
    return null;
  }
}

function writeInjectedStorageJson(storage, value) {
  if (!storage || typeof storage.setItem !== 'function') return false;
  try {
    storage.setItem(ARTIFACT_DISCLOSURE_NAV_CUE_STORAGE_KEY, JSON.stringify(value));
    return true;
  } catch (_error) {
    return false;
  }
}

export function normalizeArtifactDisclosureNavCueRecord(value = null) {
  const source = isPlainObject(value) ? value : {};
  return Object.freeze({
    policyVersion: Number.isInteger(source.policyVersion) && source.policyVersion > 0
      ? source.policyVersion
      : 0,
    seenAtMs: toTimestamp(source.seenAtMs),
    seenFamilyIds: normalizeFamilyIds(source.seenFamilyIds),
  });
}

export function readArtifactDisclosureNavCueRecord({ storage = null } = {}) {
  const storedValue = storage
    ? readInjectedStorageJson(storage)
    : readPageLocalJsonItem(ARTIFACT_DISCLOSURE_NAV_CUE_STORAGE_KEY, null);
  return normalizeArtifactDisclosureNavCueRecord(storedValue);
}

export function writeArtifactDisclosureNavCueRecord(record = null, { storage = null } = {}) {
  const normalized = normalizeArtifactDisclosureNavCueRecord(record);
  if (storage) {
    writeInjectedStorageJson(storage, normalized);
  } else {
    writePageLocalJsonItem(ARTIFACT_DISCLOSURE_NAV_CUE_STORAGE_KEY, normalized);
  }
  return normalized;
}

export function createArtifactDisclosureNavCueSeenRecord(snapshot = null, {
  nowMs = Date.now(),
} = {}) {
  return normalizeArtifactDisclosureNavCueRecord({
    policyVersion: snapshot?.policyVersion,
    seenAtMs: toTimestamp(nowMs) ?? Date.now(),
    seenFamilyIds: resolveNavCueDisclosedFamilyIds(snapshot),
  });
}

export function resolveArtifactDisclosureNavCueState({
  artifactDisclosureSnapshot = null,
  activeTabId = '',
  record = null,
  targetTabId = 'tools',
} = {}) {
  const normalizedRecord = normalizeArtifactDisclosureNavCueRecord(record);
  const policyVersion = Number.isInteger(artifactDisclosureSnapshot?.policyVersion)
    ? artifactDisclosureSnapshot.policyVersion
    : 0;
  const orderedFamilyIds = normalizeFamilyIds(artifactDisclosureSnapshot?.orderedFamilyIds);
  const disclosedFamilyIds = resolveNavCueDisclosedFamilyIds(artifactDisclosureSnapshot);
  const initialFamilyId = orderedFamilyIds[0] || '';
  const recordMatchesPolicy = policyVersion > 0 && normalizedRecord.policyVersion === policyVersion;
  const seenFamilyIdSet = new Set(recordMatchesPolicy ? normalizedRecord.seenFamilyIds : []);
  if (initialFamilyId && disclosedFamilyIds.includes(initialFamilyId)) {
    seenFamilyIdSet.add(initialFamilyId);
  }
  const unseenFamilyIds = disclosedFamilyIds.filter((familyId) => !seenFamilyIdSet.has(familyId));
  const hasUnseen = activeTabId !== targetTabId && unseenFamilyIds.length > 0;

  return Object.freeze({
    targetTabId,
    policyVersion,
    lastProcessedActivityDayKey: artifactDisclosureSnapshot?.lastProcessedActivityDayKey || '',
    currentDisclosedCount: disclosedFamilyIds.length,
    seenDisclosedCount: disclosedFamilyIds.length - unseenFamilyIds.length,
    unseenDisclosedCount: unseenFamilyIds.length,
    unseenFamilyIds: Object.freeze(unseenFamilyIds),
    hasUnseen,
    tabCues: Object.freeze({
      [targetTabId]: Object.freeze({
        artifactDisclosureUnseen: hasUnseen,
      }),
    }),
  });
}
