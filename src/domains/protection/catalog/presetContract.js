import { normalizeDomain } from '../../../lib/domain.js';
import {
  PROTECTION_LEVELS,
  normalizeLaneState,
  normalizeProtectionPosture,
} from '../contracts/protectionContracts.js';
import {
  expandCanonicalArtifactPreferenceMapToRuntimePreferences,
  normalizeCanonicalArtifactPreferenceMap,
} from '../runtime/canonicalArtifactRuntimeBinding.js';

export const PROTECTION_PRESET_KINDS = Object.freeze({
  BUILTIN: 'builtin',
  CUSTOM: 'custom',
});

export const BUILTIN_PROTECTION_PRESET_IDS = Object.freeze({
  BALANCED_DEFAULT: 'balanced_default',
  WORK_FOCUS: 'work_focus',
  NIGHT_RECOVERY: 'night_recovery',
  SOCIAL_LITE: 'social_lite',
  HARD_RESET: 'hard_reset',
});

export const DEFAULT_PROTECTION_PRESET_ID = BUILTIN_PROTECTION_PRESET_IDS.BALANCED_DEFAULT;
export const DEFAULT_PROTECTION_PRESET_CATALOG = Object.freeze({});
export const DEFAULT_PROTECTION_PRESET_ASSIGNMENTS = Object.freeze({
  globalPresetId: DEFAULT_PROTECTION_PRESET_ID,
  sitePresetIds: Object.freeze({}),
});

const BUILTIN_PRESET_IDS = new Set(Object.values(BUILTIN_PROTECTION_PRESET_IDS));
const VALID_PRESET_KINDS = new Set(Object.values(PROTECTION_PRESET_KINDS));
const PRESET_ID_PATTERN = /^[a-z0-9](?:[a-z0-9_-]{0,62}[a-z0-9])?$/;

function isPlainObject(value) {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function normalizeText(value, fallback = '') {
  const normalized = typeof value === 'string' ? value.trim() : '';
  return normalized || fallback;
}

export function normalizeProtectionPresetId(value, fallback = '') {
  const candidate = typeof value === 'string'
    ? value.trim().toLowerCase().replace(/\s+/g, '_')
    : '';
  if (PRESET_ID_PATTERN.test(candidate)) return candidate;
  return fallback;
}

export function normalizeProtectionPresetKind(value, fallback = PROTECTION_PRESET_KINDS.CUSTOM) {
  const normalized = typeof value === 'string' ? value.trim().toLowerCase() : '';
  return VALID_PRESET_KINDS.has(normalized) ? normalized : fallback;
}

function normalizePresetLaneProfile(rawLaneProfile) {
  const source = isPlainObject(rawLaneProfile) ? rawLaneProfile : {};
  const next = {};
  PROTECTION_LEVELS.forEach((level) => {
    next[String(level)] = normalizeLaneState(source[String(level)] || source[level]);
  });
  return next;
}

function normalizePresetArtifacts(rawArtifacts) {
  const canonicalArtifacts = normalizeCanonicalArtifactPreferenceMap(rawArtifacts);
  return {
    ...canonicalArtifacts,
    ...expandCanonicalArtifactPreferenceMapToRuntimePreferences(canonicalArtifacts),
  };
}

export function normalizeProtectionPresetDefinition(rawPreset, {
  fallbackId = '',
  fallbackKind = PROTECTION_PRESET_KINDS.CUSTOM,
} = {}) {
  const source = isPlainObject(rawPreset) ? rawPreset : {};
  const id = normalizeProtectionPresetId(source.id, normalizeProtectionPresetId(fallbackId));
  if (!id) return null;

  const labelFallback = id
    .split(/[_-]+/)
    .filter(Boolean)
    .map((chunk) => chunk.charAt(0).toUpperCase() + chunk.slice(1))
    .join(' ');

  return {
    id,
    kind: normalizeProtectionPresetKind(source.kind, fallbackKind),
    label: normalizeText(source.label, labelFallback),
    description: normalizeText(source.description, ''),
    posture: normalizeProtectionPosture(source.posture),
    lanes: normalizePresetLaneProfile(source.lanes),
    artifacts: normalizePresetArtifacts(source.artifacts),
  };
}

export function isBuiltinProtectionPresetId(presetId) {
  return BUILTIN_PRESET_IDS.has(normalizeProtectionPresetId(presetId));
}

export function normalizeProtectionPresetCatalog(rawCatalog) {
  if (!isPlainObject(rawCatalog)) return {};
  const next = {};

  Object.entries(rawCatalog).forEach(([rawId, rawPreset]) => {
    const normalizedId = normalizeProtectionPresetId(rawId);
    if (!normalizedId || isBuiltinProtectionPresetId(normalizedId)) return;
    const normalized = normalizeProtectionPresetDefinition(rawPreset, {
      fallbackId: normalizedId,
      fallbackKind: PROTECTION_PRESET_KINDS.CUSTOM,
    });
    if (!normalized) return;
    next[normalized.id] = normalized;
  });

  return next;
}

export function normalizeProtectionPresetAssignments(rawAssignments) {
  const source = isPlainObject(rawAssignments) ? rawAssignments : {};
  const rawSitePresetIds = isPlainObject(source.sitePresetIds) ? source.sitePresetIds : {};
  const sitePresetIds = {};

  Object.entries(rawSitePresetIds).forEach(([rawDomain, rawPresetId]) => {
    const domain = normalizeDomain(rawDomain);
    const presetId = normalizeProtectionPresetId(rawPresetId);
    if (!domain || !presetId) return;
    sitePresetIds[domain] = presetId;
  });

  return {
    globalPresetId: normalizeProtectionPresetId(source.globalPresetId, DEFAULT_PROTECTION_PRESET_ID),
    sitePresetIds,
  };
}
