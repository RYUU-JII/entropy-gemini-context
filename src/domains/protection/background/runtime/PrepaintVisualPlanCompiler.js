import { PREPAINT_VISUAL_STYLES } from '../../content/prepaintVisualAssets.js';
import {
  formatCssRatio,
  getGrayscaleAmountFromSaturationValue,
  requireVisualFrictionEntry,
} from '../../../settings/config/index.js';

export const PREPAINT_VISUAL_PLAN_SCHEMA_VERSION = 1;

function normalizeHostname(value) {
  return typeof value === 'string' ? value.trim().toLowerCase() : '';
}

function isPlainObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function toFiniteNumber(value) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
}

function requireRootVisualSnapshot(snapshot) {
  if (snapshot === null || snapshot === undefined) {
    return null;
  }
  if (!isPlainObject(snapshot)) {
    throw new Error('PREPAINT_VISUAL_SNAPSHOT_INVALID');
  }
  if (snapshot.schemaVersion !== PREPAINT_VISUAL_PLAN_SCHEMA_VERSION) {
    throw new Error('PREPAINT_VISUAL_SCHEMA_VERSION_INVALID');
  }
  return snapshot;
}

function requireSnapshotHostname(snapshot) {
  if (!isPlainObject(snapshot.host)) {
    throw new Error('PREPAINT_VISUAL_HOST_INVALID');
  }
  const hostname = normalizeHostname(snapshot.host.hostname);
  if (!hostname) {
    throw new Error('PREPAINT_VISUAL_HOST_INVALID');
  }
  return hostname;
}

function readDecisionShouldApply(snapshot) {
  if (!isPlainObject(snapshot.decision)) {
    throw new Error('PREPAINT_VISUAL_DECISION_INVALID');
  }
  if (typeof snapshot.decision.shouldApply !== 'boolean') {
    throw new Error('PREPAINT_VISUAL_DECISION_FIELD_INVALID:shouldApply');
  }
  return snapshot.decision.shouldApply;
}

function readRootFilter(snapshot) {
  if (!Object.prototype.hasOwnProperty.call(snapshot, 'rootFilter')) {
    return '';
  }
  if (typeof snapshot.rootFilter !== 'string') {
    throw new Error('PREPAINT_VISUAL_ROOT_FILTER_INVALID');
  }
  return snapshot.rootFilter.trim().replace(/\s+/g, ' ');
}

function requireEpochMs(snapshot, fieldName) {
  const value = toFiniteNumber(snapshot[fieldName]);
  if (value === null || value <= 0) {
    throw new Error(`PREPAINT_VISUAL_TIMESTAMP_INVALID:${fieldName}`);
  }
  return value;
}

function readNow(now) {
  if (now === null || now === undefined) {
    return null;
  }
  const value = toFiniteNumber(now);
  if (value === null || value < 0) {
    throw new Error('PREPAINT_VISUAL_NOW_INVALID');
  }
  return value;
}

function readOptionalString(record, fieldName) {
  if (!Object.prototype.hasOwnProperty.call(record, fieldName)) {
    return null;
  }
  const value = record[fieldName];
  if (value === null) {
    return null;
  }
  if (typeof value !== 'string') {
    throw new Error(`PREPAINT_VISUAL_META_FIELD_INVALID:${fieldName}`);
  }
  const trimmed = value.trim();
  return trimmed || null;
}

function readMeta(snapshot) {
  if (snapshot.meta === null || snapshot.meta === undefined) {
    throw new Error('PREPAINT_VISUAL_META_INVALID');
  }
  if (!isPlainObject(snapshot.meta)) {
    throw new Error('PREPAINT_VISUAL_META_INVALID');
  }
  const revision = toFiniteNumber(snapshot.meta.revision);
  if (!Number.isInteger(revision) || revision < 0) {
    throw new Error('PREPAINT_VISUAL_META_FIELD_INVALID:revision');
  }
  return {
    themeId: readOptionalString(snapshot.meta, 'themeId'),
    styleVariant: readOptionalString(snapshot.meta, 'styleVariant'),
    revision,
  };
}

function isActiveFeature(entry) {
  if (entry === null || entry === undefined) {
    return false;
  }
  if (!isPlainObject(entry)) {
    throw new Error('PREPAINT_VISUAL_FEATURE_INVALID');
  }
  if (typeof entry.isActive !== 'boolean') {
    throw new Error('PREPAINT_VISUAL_FEATURE_FIELD_INVALID:isActive');
  }
  return entry.isActive;
}

function derivePrepaintGrayscaleStrength(entry) {
  if (!isActiveFeature(entry)) return 0;
  requireVisualFrictionEntry('saturation', entry);
  return getGrayscaleAmountFromSaturationValue(entry.value);
}

function deriveVisualStrength(snapshot, rootFilter) {
  if (!rootFilter) return 0;
  if (!isPlainObject(snapshot.visualFilters)) {
    throw new Error('PREPAINT_VISUAL_FILTERS_INVALID');
  }

  const visualFilters = snapshot.visualFilters;
  return derivePrepaintGrayscaleStrength(visualFilters.saturation);
}

function pickTierId(strength) {
  const normalizedStrength = formatCssRatio(strength);
  const tier = PREPAINT_VISUAL_STYLES.find(
    (candidate) => formatCssRatio(candidate.grayscaleStrength) === normalizedStrength,
  );
  if (!tier) {
    throw new Error(`PREPAINT_VISUAL_STRENGTH_UNMAPPED:${normalizedStrength}`);
  }
  return tier.tierId;
}

export function buildPrepaintVisualPlanFromRootVisualSnapshot(snapshot, { now = null } = {}) {
  const resolvedSnapshot = requireRootVisualSnapshot(snapshot);
  if (resolvedSnapshot === null) return null;

  const hostname = requireSnapshotHostname(resolvedSnapshot);
  if (readDecisionShouldApply(resolvedSnapshot) !== true) return null;

  const rootFilter = readRootFilter(resolvedSnapshot);
  if (!rootFilter) return null;

  const strength = deriveVisualStrength(resolvedSnapshot, rootFilter);
  if (strength <= 0) return null;

  const generatedAtEpochMs = requireEpochMs(resolvedSnapshot, 'generatedAtEpochMs');
  const staleAfterEpochMs = requireEpochMs(resolvedSnapshot, 'staleAfterEpochMs');
  if (staleAfterEpochMs <= generatedAtEpochMs) return null;
  const resolvedNow = readNow(now);
  if (resolvedNow !== null && resolvedNow > staleAfterEpochMs) return null;
  const meta = readMeta(resolvedSnapshot);

  return {
    schemaVersion: PREPAINT_VISUAL_PLAN_SCHEMA_VERSION,
    generatedAtEpochMs,
    staleAfterEpochMs,
    host: { hostname },
    decision: { shouldApply: true },
    tierId: pickTierId(strength),
    rootFilter,
    meta: {
      source: 'bootstrap-root-visual-projection',
      strength,
      themeId: meta.themeId,
      styleVariant: meta.styleVariant,
      revision: meta.revision,
    },
  };
}

export function buildPrepaintVisualPlansFromRootVisualSnapshots(snapshots = [], { now = null } = {}) {
  if (!Array.isArray(snapshots)) {
    throw new Error('PREPAINT_VISUAL_SNAPSHOT_LIST_INVALID');
  }
  return snapshots
    .map((snapshot) => buildPrepaintVisualPlanFromRootVisualSnapshot(snapshot, { now }))
    .filter(Boolean)
    .sort((a, b) => a.host.hostname.localeCompare(b.host.hostname));
}
