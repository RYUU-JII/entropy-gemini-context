import { normalizeDomain } from '../../../lib/domain.js';
import {
  PROTECTION_LEVELS,
  normalizeLaneState,
} from '../contracts/protectionContracts.js';
import {
  BUILTIN_PROTECTION_PRESET_IDS,
  DEFAULT_PROTECTION_PRESET_ID,
  PROTECTION_PRESET_KINDS,
  normalizeProtectionPresetAssignments,
  normalizeProtectionPresetCatalog,
  normalizeProtectionPresetDefinition,
  normalizeProtectionPresetId,
} from './presetContract.js';

function buildDefaultLaneProfile() {
  return PROTECTION_LEVELS.reduce((acc, level) => {
    acc[String(level)] = normalizeLaneState({});
    return acc;
  }, {});
}

const DEFAULT_GATE_PRESET_ARTIFACT = Object.freeze({
  enabled: true,
  autoTrigger: true,
});

const SOFT_GATE_PRESET_ARTIFACT = Object.freeze({
  enabled: true,
  autoTrigger: true,
});

const BUILTIN_PRESET_SEED = Object.freeze([
  Object.freeze({
    id: BUILTIN_PROTECTION_PRESET_IDS.BALANCED_DEFAULT,
    label: 'Balanced Default',
    description: 'Default adaptive protection centered around the declared daily target.',
    posture: 'balanced',
    lanes: {
      1: { reward: 1, pace: 0, friction: 0, advanced: 0 },
      2: { reward: 2, pace: 1, friction: 0, advanced: 0 },
      3: { reward: 2, pace: 2, friction: 1, advanced: 0 },
      4: { reward: 3, pace: 2, friction: 2, advanced: 0 },
      5: { reward: 3, pace: 3, friction: 3, advanced: 0 },
    },
    artifacts: {
      lens: { enabled: true, autoTrigger: true },
      veil: { enabled: true, autoTrigger: true },
      brake: { enabled: true, autoTrigger: true },
      barrier: { enabled: true, autoTrigger: true },
      gate: DEFAULT_GATE_PRESET_ARTIFACT,
    },
  }),
  Object.freeze({
    id: BUILTIN_PROTECTION_PRESET_IDS.WORK_FOCUS,
    label: 'Work Focus',
    description: 'Earlier pace control and stronger late-stage friction for work sessions.',
    posture: 'strict',
    lanes: {
      1: { reward: 1, pace: 1, friction: 0, advanced: 0 },
      2: { reward: 2, pace: 2, friction: 1, advanced: 0 },
      3: { reward: 3, pace: 2, friction: 2, advanced: 0 },
      4: { reward: 3, pace: 3, friction: 2, advanced: 0 },
      5: { reward: 3, pace: 3, friction: 3, advanced: 0 },
    },
    artifacts: {
      lens: { enabled: true, autoTrigger: true },
      veil: { enabled: true, autoTrigger: true },
      brake: { enabled: true, autoTrigger: true },
      barrier: { enabled: true, autoTrigger: true },
      gate: DEFAULT_GATE_PRESET_ARTIFACT,
    },
  }),
  Object.freeze({
    id: BUILTIN_PROTECTION_PRESET_IDS.NIGHT_RECOVERY,
    label: 'Night Recovery',
    description: 'Sharper evening protection with strong short-form and budget intervention.',
    posture: 'strict',
    lanes: {
      1: { reward: 1, pace: 1, friction: 0, advanced: 0 },
      2: { reward: 2, pace: 2, friction: 1, advanced: 0 },
      3: { reward: 3, pace: 2, friction: 2, advanced: 0 },
      4: { reward: 3, pace: 3, friction: 3, advanced: 0 },
      5: { reward: 3, pace: 3, friction: 3, advanced: 0 },
    },
    artifacts: {
      lens: { enabled: true, autoTrigger: true },
      veil: { enabled: true, autoTrigger: true },
      brake: { enabled: true, autoTrigger: true },
      barrier: { enabled: true, autoTrigger: true },
      flare: { enabled: true, autoTrigger: true },
      gate: DEFAULT_GATE_PRESET_ARTIFACT,
    },
  }),
  Object.freeze({
    id: BUILTIN_PROTECTION_PRESET_IDS.SOCIAL_LITE,
    label: 'Social Lite',
    description: 'Softer pacing for lighter social browsing without aggressive lock pressure.',
    posture: 'gentle',
    lanes: {
      1: { reward: 1, pace: 0, friction: 0, advanced: 0 },
      2: { reward: 1, pace: 1, friction: 0, advanced: 0 },
      3: { reward: 2, pace: 1, friction: 1, advanced: 0 },
      4: { reward: 2, pace: 2, friction: 1, advanced: 0 },
      5: { reward: 3, pace: 2, friction: 2, advanced: 0 },
    },
    artifacts: {
      veil: { enabled: true, autoTrigger: true },
      brake: { enabled: true, autoTrigger: true },
      barrier: { enabled: true, autoTrigger: true },
      gate: SOFT_GATE_PRESET_ARTIFACT,
    },
  }),
  Object.freeze({
    id: BUILTIN_PROTECTION_PRESET_IDS.HARD_RESET,
    label: 'Hard Reset',
    description: 'High-intervention recovery preset with maximum late-stage protection.',
    posture: 'strict',
    lanes: {
      1: { reward: 2, pace: 1, friction: 0, advanced: 0 },
      2: { reward: 3, pace: 2, friction: 1, advanced: 0 },
      3: { reward: 3, pace: 3, friction: 2, advanced: 0 },
      4: { reward: 3, pace: 3, friction: 3, advanced: 0 },
      5: { reward: 3, pace: 3, friction: 3, advanced: 0 },
    },
    artifacts: {
      lens: { enabled: true, autoTrigger: true },
      veil: { enabled: true, autoTrigger: true },
      brake: { enabled: true, autoTrigger: true },
      barrier: { enabled: true, autoTrigger: true },
      flare: { enabled: true, autoTrigger: true },
      echo: { enabled: true, autoTrigger: false },
      gate: DEFAULT_GATE_PRESET_ARTIFACT,
    },
  }),
]);

export const BUILTIN_PROTECTION_PRESET_CATALOG = Object.freeze(
  BUILTIN_PRESET_SEED.reduce((acc, definition) => {
    const normalized = normalizeProtectionPresetDefinition(definition, {
      fallbackId: definition.id,
      fallbackKind: PROTECTION_PRESET_KINDS.BUILTIN,
    });
    if (!normalized) return acc;
    acc[normalized.id] = normalized;
    return acc;
  }, {})
);

export function buildResolvedProtectionPresetCatalog(rawCatalog) {
  return {
    ...BUILTIN_PROTECTION_PRESET_CATALOG,
    ...normalizeProtectionPresetCatalog(rawCatalog),
  };
}

export function resolveProtectionPresetSelection({
  catalog,
  assignments,
  host,
} = {}) {
  const resolvedCatalog = buildResolvedProtectionPresetCatalog(catalog);
  const resolvedAssignments = normalizeProtectionPresetAssignments(assignments);
  const normalizedHost = normalizeDomain(host);
  const sitePresetId = normalizedHost ? resolvedAssignments.sitePresetIds[normalizedHost] : '';
  const globalPresetId = resolvedAssignments.globalPresetId;

  if (sitePresetId && resolvedCatalog[sitePresetId]) {
    return {
      presetId: sitePresetId,
      preset: resolvedCatalog[sitePresetId],
      source: 'site',
    };
  }

  if (globalPresetId && resolvedCatalog[globalPresetId]) {
    return {
      presetId: globalPresetId,
      preset: resolvedCatalog[globalPresetId],
      source: 'global',
    };
  }

  return {
    presetId: DEFAULT_PROTECTION_PRESET_ID,
    preset: resolvedCatalog[DEFAULT_PROTECTION_PRESET_ID] || null,
    source: 'default',
  };
}

export function getProtectionPresetById(catalog, presetId) {
  const resolvedCatalog = buildResolvedProtectionPresetCatalog(catalog);
  const normalizedId = normalizeProtectionPresetId(presetId, DEFAULT_PROTECTION_PRESET_ID);
  return resolvedCatalog[normalizedId] || resolvedCatalog[DEFAULT_PROTECTION_PRESET_ID] || null;
}

export function buildEmptyProtectionPresetDefinition(presetId = '') {
  const id = normalizeProtectionPresetId(presetId, 'custom_preset');
  return normalizeProtectionPresetDefinition({
    id,
    kind: PROTECTION_PRESET_KINDS.CUSTOM,
    label: 'Custom Preset',
    description: '',
    posture: 'balanced',
    lanes: buildDefaultLaneProfile(),
    artifacts: {},
  }, {
    fallbackId: id,
    fallbackKind: PROTECTION_PRESET_KINDS.CUSTOM,
  });
}

export function generateUniqueProtectionPresetId(catalog, label = 'custom_preset') {
  const resolvedCatalog = buildResolvedProtectionPresetCatalog(catalog);
  const baseId = normalizeProtectionPresetId(label, 'custom_preset');
  if (!resolvedCatalog[baseId]) return baseId;

  let index = 2;
  while (resolvedCatalog[`${baseId}_${index}`]) {
    index += 1;
  }
  return `${baseId}_${index}`;
}

export function cloneProtectionPresetDefinition(sourcePreset, {
  presetId = '',
  label = '',
} = {}) {
  const source = sourcePreset && typeof sourcePreset === 'object' ? sourcePreset : buildEmptyProtectionPresetDefinition();
  const resolvedId = normalizeProtectionPresetId(presetId, generateUniqueProtectionPresetId({}, source.id || 'custom_preset'));
  return normalizeProtectionPresetDefinition({
    ...source,
    id: resolvedId,
    kind: PROTECTION_PRESET_KINDS.CUSTOM,
    label: label || `${source.label || 'Custom Preset'} Copy`,
  }, {
    fallbackId: resolvedId,
    fallbackKind: PROTECTION_PRESET_KINDS.CUSTOM,
  });
}
