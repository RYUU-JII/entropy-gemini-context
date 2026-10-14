import {
  readPageLocalJsonItem,
  writePageLocalJsonItem,
} from '@/platform/browser/pageLocalStorage.js';
import {
  requireProgressionUnlockSnapshot,
} from '@/domains/progression/index.js';
import { PROGRESSION_BONSAI_FULL_FORM_DAY_COUNT } from '@/domains/progression/contracts/progressionBonsaiRelease.js';

export const BONSAI_GROWTH_REVEAL_RECORD_CONTRACT = 'bonsai_growth_reveal_v1';
export const BONSAI_GROWTH_REVEAL_STORAGE_KEY = 'dashboard.bonsai_growth_reveal.v1';

function normalizeDayCount(value) {
  return Number.isInteger(value)
    ? Math.max(0, Math.min(PROGRESSION_BONSAI_FULL_FORM_DAY_COUNT, value))
    : 0;
}
function normalizeTimestamp(value) {
  return Number.isInteger(value) && value >= 0 ? value : 0;
}

export function normalizeBonsaiGrowthRevealRecord(value = null) {
  const source = value?.contract === BONSAI_GROWTH_REVEAL_RECORD_CONTRACT
    ? value
    : null;
  return Object.freeze({
    contract: BONSAI_GROWTH_REVEAL_RECORD_CONTRACT,
    lastAcknowledgedQualifiedUseDayCount: normalizeDayCount(
      source?.lastAcknowledgedQualifiedUseDayCount,
    ),
    updatedAtMs: normalizeTimestamp(source?.updatedAtMs),
  });
}

export function readBonsaiGrowthRevealRecord() {
  return normalizeBonsaiGrowthRevealRecord(
    readPageLocalJsonItem(BONSAI_GROWTH_REVEAL_STORAGE_KEY, null),
  );
}

export function writeBonsaiGrowthRevealRecord(record) {
  const normalized = normalizeBonsaiGrowthRevealRecord(record);
  writePageLocalJsonItem(BONSAI_GROWTH_REVEAL_STORAGE_KEY, normalized);
  return normalized;
}

export function resolveBonsaiGrowthRevealState({
  unlockProgress = null,
  record = null,
} = {}) {
  if (!unlockProgress) {
    return Object.freeze({
      active: false,
      alignmentRequired: false,
      reason: 'unlock_progress_unavailable',
      fromDayCount: 0,
      toDayCount: 0,
      deltaDayCount: 0,
    });
  }

  const snapshot = requireProgressionUnlockSnapshot(unlockProgress);
  const normalizedRecord = normalizeBonsaiGrowthRevealRecord(record);
  const canonicalDayCount = snapshot.canonicalBonsaiRelease.qualifiedUseDayCount;
  const acknowledgedDayCount = normalizedRecord.lastAcknowledgedQualifiedUseDayCount;

  if (snapshot.debugOverrideActive === true) {
    return Object.freeze({
      active: false,
      alignmentRequired: false,
      reason: 'debug_override',
      fromDayCount: acknowledgedDayCount,
      toDayCount: canonicalDayCount,
      deltaDayCount: 0,
    });
  }

  if (canonicalDayCount < acknowledgedDayCount) {
    return Object.freeze({
      active: false,
      alignmentRequired: true,
      reason: 'canonical_progress_reset',
      fromDayCount: canonicalDayCount,
      toDayCount: canonicalDayCount,
      deltaDayCount: 0,
    });
  }

  const deltaDayCount = canonicalDayCount - acknowledgedDayCount;
  return Object.freeze({
    active: deltaDayCount > 0,
    alignmentRequired: false,
    reason: deltaDayCount > 0 ? 'qualified_use_advanced' : 'already_acknowledged',
    fromDayCount: acknowledgedDayCount,
    toDayCount: canonicalDayCount,
    deltaDayCount,
  });
}

export function createBonsaiGrowthRevealAcknowledgedRecord(unlockProgress, {
  nowMs = Date.now(),
} = {}) {
  const snapshot = requireProgressionUnlockSnapshot(unlockProgress);
  if (snapshot.debugOverrideActive === true) {
    throw new Error('BONSAI_GROWTH_REVEAL_DEBUG_ACKNOWLEDGEMENT_FORBIDDEN');
  }
  return normalizeBonsaiGrowthRevealRecord({
    contract: BONSAI_GROWTH_REVEAL_RECORD_CONTRACT,
    lastAcknowledgedQualifiedUseDayCount: snapshot.canonicalBonsaiRelease.qualifiedUseDayCount,
    updatedAtMs: normalizeTimestamp(nowMs),
  });
}
