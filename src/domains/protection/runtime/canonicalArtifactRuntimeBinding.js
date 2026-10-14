import { COOLING_CURVE_FAMILY_IDS } from '../../settings/config/coolingCurvePolicy.js';
import { COOLING_CURVE_SLOTS, COOLING_CURVE_INTENSITY_FORMS } from '../catalog/coolingCurvePresets.js';
import {
  PROTECTION_CANONICAL_ARTIFACT_CATALOG,
  PROTECTION_CANONICAL_ARTIFACT_ID_LIST,
} from '../catalog/artifactFamilyCatalog.js';
import { normalizeRuntimeArtifactId } from '../contracts/artifactIds.js';
import { VISUAL_FRICTION_FEATURE_KEYS } from '../../settings/config/visualFrictionProfiles.js';

export const CANONICAL_ARTIFACT_EXECUTION_KINDS = Object.freeze({
  FILTER_SETTINGS: 'filter_settings',
  RUNTIME_ARTIFACTS: 'runtime_artifacts',
});

export const CANONICAL_ARTIFACT_STATE_SOURCES = Object.freeze({
  CONFIGURATION: 'configuration',
  RUNTIME_FILTER_PLAN: 'runtime_filter_plan',
  RUNTIME_ARTIFACTS: 'runtime_artifacts',
  TELEMETRY_CONTEXT: 'telemetry_context',
});

export const CANONICAL_ARTIFACT_NON_RELEASE_CHILD_ROLES = Object.freeze({
  TELEMETRY_ONLY: 'telemetry_only',
  WORKFLOW_ONLY: 'workflow_only',
});

export const CANONICAL_ARTIFACT_RUNTIME_BINDINGS = Object.freeze({
  lens: Object.freeze({
    executionKind: CANONICAL_ARTIFACT_EXECUTION_KINDS.FILTER_SETTINGS,
    stateSource: CANONICAL_ARTIFACT_STATE_SOURCES.RUNTIME_FILTER_PLAN,
    executionKeys: VISUAL_FRICTION_FEATURE_KEYS,
    stateFilterKeys: VISUAL_FRICTION_FEATURE_KEYS,
    children: Object.freeze({
      grayscale: Object.freeze({
        coolingCurve: Object.freeze({ slot: 'text', form: 'strength_scale' }),
        stateSource: CANONICAL_ARTIFACT_STATE_SOURCES.RUNTIME_FILTER_PLAN,
        stateFilterKeys: Object.freeze(['saturation']),
      }),
      blur: Object.freeze({
        coolingCurve: Object.freeze({ slot: 'blur', form: 'strength_scale' }),
        stateSource: CANONICAL_ARTIFACT_STATE_SOURCES.RUNTIME_FILTER_PLAN,
        stateFilterKeys: Object.freeze(['blur']),
      }),
      brightness: Object.freeze({
        coolingCurve: Object.freeze({ slot: 'tint', form: 'strength_scale' }),
        stateSource: CANONICAL_ARTIFACT_STATE_SOURCES.RUNTIME_FILTER_PLAN,
        stateFilterKeys: Object.freeze(['brightness']),
      }),
      contrast: Object.freeze({
        coolingCurve: Object.freeze({ slot: 'tint', form: 'strength_scale' }),
        stateSource: CANONICAL_ARTIFACT_STATE_SOURCES.RUNTIME_FILTER_PLAN,
        stateFilterKeys: Object.freeze(['contrast']),
      }),
      saturation: Object.freeze({
        coolingCurve: Object.freeze({ slot: 'tint', form: 'strength_scale' }),
        stateSource: CANONICAL_ARTIFACT_STATE_SOURCES.RUNTIME_FILTER_PLAN,
        stateFilterKeys: Object.freeze(['colorSaturation']),
      }),
    }),
    runtimeArtifactIds: Object.freeze([]),
  }),
  veil: Object.freeze({
    executionKind: CANONICAL_ARTIFACT_EXECUTION_KINDS.FILTER_SETTINGS,
    stateSource: CANONICAL_ARTIFACT_STATE_SOURCES.RUNTIME_FILTER_PLAN,
    executionKeys: Object.freeze(['socialMetrics', 'shortFormBlock']),
    stateFilterKeys: Object.freeze(['socialMetrics', 'shortFormBlock']),
    children: Object.freeze({
      socialMetrics: Object.freeze({
        coolingCurve: Object.freeze({ slot: 'signal', form: 'binary_onset' }),
        stateSource: CANONICAL_ARTIFACT_STATE_SOURCES.RUNTIME_FILTER_PLAN,
        stateFilterKeys: Object.freeze(['socialMetrics']),
        optionKeys: Object.freeze(['feedbackCounts', 'viewCounts', 'audienceCounts']),
      }),
      timeSignals: Object.freeze({
        coolingCurve: Object.freeze({ slot: 'signal', form: 'binary_onset' }),
        stateSource: CANONICAL_ARTIFACT_STATE_SOURCES.RUNTIME_FILTER_PLAN,
        stateFilterKeys: Object.freeze(['socialMetrics']),
        optionKeys: Object.freeze(['timeSignals']),
      }),
      shortformBlock: Object.freeze({
        coolingCurve: Object.freeze({ excluded: true }),
        stateSource: CANONICAL_ARTIFACT_STATE_SOURCES.RUNTIME_FILTER_PLAN,
        stateFilterKeys: Object.freeze(['shortFormBlock']),
      }),
      attentionCoherence: Object.freeze({
        coolingCurve: Object.freeze({ excluded: true }),
        nonReleaseRole: CANONICAL_ARTIFACT_NON_RELEASE_CHILD_ROLES.TELEMETRY_ONLY,
        stateSource: CANONICAL_ARTIFACT_STATE_SOURCES.TELEMETRY_CONTEXT,
      }),
    }),
    runtimeArtifactIds: Object.freeze([]),
  }),
  brake: Object.freeze({
    executionKind: CANONICAL_ARTIFACT_EXECUTION_KINDS.FILTER_SETTINGS,
    stateSource: CANONICAL_ARTIFACT_STATE_SOURCES.RUNTIME_FILTER_PLAN,
    executionKeys: Object.freeze(['clickDelay', 'scrollFriction', 'inputVisualBrake', 'videoSkipGuard']),
    stateFilterKeys: Object.freeze(['clickDelay', 'scrollFriction', 'inputVisualBrake', 'videoSkipGuard']),
    children: Object.freeze({
      clickPause: Object.freeze({
        coolingCurve: Object.freeze({ slot: 'pace', form: 'binary_onset' }),
        stateSource: CANONICAL_ARTIFACT_STATE_SOURCES.RUNTIME_FILTER_PLAN,
        stateFilterKeys: Object.freeze(['clickDelay']),
      }),
      scrollFriction: Object.freeze({
        coolingCurve: Object.freeze({ slot: 'pace', form: 'binary_onset' }),
        stateSource: CANONICAL_ARTIFACT_STATE_SOURCES.RUNTIME_FILTER_PLAN,
        stateFilterKeys: Object.freeze(['scrollFriction']),
      }),
      inputVisualBrake: Object.freeze({
        coolingCurve: Object.freeze({ slot: 'pace', form: 'binary_onset' }),
        stateSource: CANONICAL_ARTIFACT_STATE_SOURCES.RUNTIME_FILTER_PLAN,
        stateFilterKeys: Object.freeze(['inputVisualBrake']),
      }),
      navigationButtonLock: Object.freeze({
        coolingCurve: Object.freeze({ excluded: true }),
        nonReleaseRole: CANONICAL_ARTIFACT_NON_RELEASE_CHILD_ROLES.WORKFLOW_ONLY,
        stateSource: CANONICAL_ARTIFACT_STATE_SOURCES.RUNTIME_FILTER_PLAN,
        stateFilterKeys: Object.freeze(['navigationButtonLock']),
      }),
      skipFriction: Object.freeze({
        coolingCurve: Object.freeze({ slot: 'pace', form: 'binary_onset' }),
        stateSource: CANONICAL_ARTIFACT_STATE_SOURCES.RUNTIME_FILTER_PLAN,
        stateFilterKeys: Object.freeze(['videoSkipGuard']),
      }),
    }),
    runtimeArtifactIds: Object.freeze([]),
  }),
  barrier: Object.freeze({
    executionKind: CANONICAL_ARTIFACT_EXECUTION_KINDS.RUNTIME_ARTIFACTS,
    stateSource: CANONICAL_ARTIFACT_STATE_SOURCES.RUNTIME_ARTIFACTS,
    executionKeys: Object.freeze(['ensoGate', 'infiniteScrollGuard', 'textRhythm', 'detourSpreadGuard']),
    children: Object.freeze({
      intentThreshold: Object.freeze({
        coolingCurve: Object.freeze({ excluded: true }),
        stateSource: CANONICAL_ARTIFACT_STATE_SOURCES.RUNTIME_FILTER_PLAN,
        stateFilterKeys: Object.freeze(['ensoGate']),
      }),
      textRhythm: Object.freeze({
        coolingCurve: Object.freeze({ slot: 'text', form: 'band' }),
        stateSource: CANONICAL_ARTIFACT_STATE_SOURCES.RUNTIME_FILTER_PLAN,
        stateFilterKeys: Object.freeze(['textRhythm']),
      }),
      detourSpreadGuard: Object.freeze({
        coolingCurve: Object.freeze({ excluded: true }),
        stateSource: CANONICAL_ARTIFACT_STATE_SOURCES.RUNTIME_ARTIFACTS,
        runtimeArtifactIds: Object.freeze(['detourSpreadGuard']),
      }),
    }),
    runtimeArtifactIds: Object.freeze(['timeAnchor', 'detourSpreadGuard']),
  }),
  flare: Object.freeze({
    executionKind: CANONICAL_ARTIFACT_EXECUTION_KINDS.RUNTIME_ARTIFACTS,
    stateSource: CANONICAL_ARTIFACT_STATE_SOURCES.RUNTIME_ARTIFACTS,
    executionKeys: Object.freeze(['sentinelFlare']),
    children: Object.freeze({
      sentinelFlare: Object.freeze({
        stateSource: CANONICAL_ARTIFACT_STATE_SOURCES.RUNTIME_ARTIFACTS,
        runtimeArtifactIds: Object.freeze(['sentinelFlare']),
      }),
    }),
    runtimeArtifactIds: Object.freeze(['sentinelFlare']),
  }),
  echo: Object.freeze({
    executionKind: CANONICAL_ARTIFACT_EXECUTION_KINDS.RUNTIME_ARTIFACTS,
    stateSource: CANONICAL_ARTIFACT_STATE_SOURCES.RUNTIME_ARTIFACTS,
    executionKeys: Object.freeze(['memoryPurge']),
    children: Object.freeze({
      historyCleanup: Object.freeze({
        stateSource: CANONICAL_ARTIFACT_STATE_SOURCES.RUNTIME_ARTIFACTS,
        runtimeArtifactIds: Object.freeze(['memoryPurge']),
      }),
      bookmarkConceal: Object.freeze({
        stateSource: CANONICAL_ARTIFACT_STATE_SOURCES.RUNTIME_ARTIFACTS,
        runtimeArtifactIds: Object.freeze(['memoryPurge']),
      }),
      tabEvaporation: Object.freeze({
        stateSource: CANONICAL_ARTIFACT_STATE_SOURCES.RUNTIME_ARTIFACTS,
        runtimeArtifactIds: Object.freeze(['memoryPurge']),
      }),
    }),
    runtimeArtifactIds: Object.freeze(['memoryPurge']),
  }),
  gate: Object.freeze({
    executionKind: CANONICAL_ARTIFACT_EXECUTION_KINDS.RUNTIME_ARTIFACTS,
    stateSource: CANONICAL_ARTIFACT_STATE_SOURCES.RUNTIME_ARTIFACTS,
    executionKeys: Object.freeze([
      'entryCheckpoint',
      'returnGuard',
    ]),
    children: Object.freeze({
      entryCheckpoint: Object.freeze({
        stateSource: CANONICAL_ARTIFACT_STATE_SOURCES.RUNTIME_ARTIFACTS,
        runtimeArtifactIds: Object.freeze(['entryCheckpoint']),
      }),
      returnGuard: Object.freeze({
        stateSource: CANONICAL_ARTIFACT_STATE_SOURCES.RUNTIME_ARTIFACTS,
        runtimeArtifactIds: Object.freeze(['returnGuard']),
      }),
    }),
    runtimeArtifactIds: Object.freeze([
      'entryCheckpoint',
      'returnGuard',
    ]),
  }),
});

function assertCanonicalArtifactRuntimeBindingContract() {
  const bindingIds = Object.keys(CANONICAL_ARTIFACT_RUNTIME_BINDINGS);
  if (
    bindingIds.length !== PROTECTION_CANONICAL_ARTIFACT_ID_LIST.length
    || PROTECTION_CANONICAL_ARTIFACT_ID_LIST.some((artifactId) => !bindingIds.includes(artifactId))
  ) {
    throw new Error('[canonicalArtifactRuntimeBinding] Runtime bindings must cover every canonical artifact family exactly once.');
  }

  const executionKinds = new Set(Object.values(CANONICAL_ARTIFACT_EXECUTION_KINDS));
  const stateSources = new Set(Object.values(CANONICAL_ARTIFACT_STATE_SOURCES));
  const nonReleaseRoles = new Set(Object.values(CANONICAL_ARTIFACT_NON_RELEASE_CHILD_ROLES));
  const runtimeArtifactOwners = new Map();

  bindingIds.forEach((artifactId) => {
    const definition = PROTECTION_CANONICAL_ARTIFACT_CATALOG[artifactId];
    const binding = CANONICAL_ARTIFACT_RUNTIME_BINDINGS[artifactId];
    if (!executionKinds.has(binding?.executionKind)) {
      throw new Error(`[canonicalArtifactRuntimeBinding] "${artifactId}" has an invalid execution kind.`);
    }
    if (!stateSources.has(binding?.stateSource)) {
      throw new Error(`[canonicalArtifactRuntimeBinding] "${artifactId}" has an invalid state source.`);
    }
    if (!Array.isArray(binding.executionKeys) || new Set(binding.executionKeys).size !== binding.executionKeys.length) {
      throw new Error(`[canonicalArtifactRuntimeBinding] "${artifactId}" execution keys must be a unique array.`);
    }
    if (!binding.children || typeof binding.children !== 'object' || Array.isArray(binding.children)) {
      throw new Error(`[canonicalArtifactRuntimeBinding] "${artifactId}" must declare a child binding map.`);
    }
    if (!Array.isArray(binding.runtimeArtifactIds)) {
      throw new Error(`[canonicalArtifactRuntimeBinding] "${artifactId}" runtime artifact ids must be an array.`);
    }
    if (new Set(binding.runtimeArtifactIds).size !== binding.runtimeArtifactIds.length) {
      throw new Error(`[canonicalArtifactRuntimeBinding] "${artifactId}" runtime artifact ids must be unique.`);
    }

    const releaseChildren = new Set(definition.releaseChildren);
    definition.releaseChildren.forEach((childId) => {
      if (!Object.prototype.hasOwnProperty.call(binding.children, childId)) {
        throw new Error(
          `[canonicalArtifactRuntimeBinding] Missing release child binding "${artifactId}.${childId}".`,
        );
      }
    });

    Object.entries(binding.children).forEach(([childId, childBinding]) => {
      if (COOLING_CURVE_FAMILY_IDS.includes(artifactId)) {
        const curve = childBinding.coolingCurve;
        const keys = curve && typeof curve === 'object' ? Object.keys(curve).sort().join('|') : '';
        if (!(keys === 'excluded' && curve.excluded === true)
          && !(keys === 'form|slot' && Object.hasOwn(COOLING_CURVE_SLOTS, curve.slot)
            && COOLING_CURVE_INTENSITY_FORMS.includes(curve.form))) {
          throw new Error('COOLING_CURVE_CHILD_BINDING_INVALID:' + artifactId + '.' + childId);
        }
      }

      if (!stateSources.has(childBinding?.stateSource)) {
        throw new Error(
          `[canonicalArtifactRuntimeBinding] "${artifactId}.${childId}" has an invalid state source.`,
        );
      }
      if (releaseChildren.has(childId)) {
        if (childBinding.nonReleaseRole) {
          throw new Error(
            `[canonicalArtifactRuntimeBinding] Release child "${artifactId}.${childId}" cannot declare a non-release role.`,
          );
        }
      } else if (!nonReleaseRoles.has(childBinding.nonReleaseRole)) {
        throw new Error(
          `[canonicalArtifactRuntimeBinding] Non-release child "${artifactId}.${childId}" must declare an explicit role.`,
        );
      }

      const childRuntimeArtifactIds = Array.isArray(childBinding.runtimeArtifactIds)
        ? childBinding.runtimeArtifactIds
        : [];
      childRuntimeArtifactIds.forEach((runtimeArtifactId) => {
        if (!binding.runtimeArtifactIds.includes(runtimeArtifactId)) {
          throw new Error(
            `[canonicalArtifactRuntimeBinding] "${artifactId}.${childId}" references an unowned runtime artifact "${runtimeArtifactId}".`,
          );
        }
      });
    });

    binding.runtimeArtifactIds.forEach((runtimeArtifactId) => {
      if (normalizeRuntimeArtifactId(runtimeArtifactId) !== runtimeArtifactId) {
        throw new Error(
          `[canonicalArtifactRuntimeBinding] "${artifactId}" references unknown runtime artifact "${runtimeArtifactId}".`,
        );
      }
      const currentOwner = runtimeArtifactOwners.get(runtimeArtifactId);
      if (currentOwner && currentOwner !== artifactId) {
        throw new Error(
          `[canonicalArtifactRuntimeBinding] Runtime artifact "${runtimeArtifactId}" is owned by both "${currentOwner}" and "${artifactId}".`,
        );
      }
      runtimeArtifactOwners.set(runtimeArtifactId, artifactId);
    });
  });
}

assertCanonicalArtifactRuntimeBindingContract();

// Child IDs remain the canonical ownership map. Shared option children may map
// to one feature only when their curve slot and intensity form agree.
export const COOLING_CURVE_FEATURE_BINDINGS = Object.freeze(COOLING_CURVE_FAMILY_IDS.reduce((features, family) => {
  for (const [child, binding] of Object.entries(CANONICAL_ARTIFACT_RUNTIME_BINDINGS[family].children)) {
    const curve = binding.coolingCurve;
    if (curve.excluded === true) continue;
    if (!Array.isArray(binding.stateFilterKeys) || binding.stateFilterKeys.length === 0) {
      throw new Error('COOLING_CURVE_CHILD_FEATURE_REQUIRED:' + family + '.' + child);
    }
    for (const featureKey of binding.stateFilterKeys) {
      const existing = features[featureKey];
      if (existing && (existing.family !== family || existing.slot !== curve.slot || existing.form !== curve.form)) {
        throw new Error('COOLING_CURVE_FEATURE_BINDING_CONFLICT:' + featureKey);
      }
      features[featureKey] = Object.freeze({ family, slot: curve.slot, form: curve.form });
    }
  }
  return features;
}, {}));


export const CANONICAL_PROTECTION_ARTIFACT_PREFERENCE_IDS = PROTECTION_CANONICAL_ARTIFACT_ID_LIST;

const RUNTIME_ARTIFACT_TO_CANONICAL_ARTIFACT = Object.freeze(
  Object.entries(CANONICAL_ARTIFACT_RUNTIME_BINDINGS).reduce((acc, [canonicalArtifactId, binding]) => {
    const runtimeArtifactIds = Array.isArray(binding?.runtimeArtifactIds) ? binding.runtimeArtifactIds : [];
    runtimeArtifactIds.forEach((runtimeArtifactId) => {
      acc[runtimeArtifactId] = canonicalArtifactId;
    });
    return acc;
  }, {}),
);

export function getCanonicalArtifactRuntimeBinding(artifactId) {
  const normalizedArtifactId = typeof artifactId === 'string' ? artifactId.trim() : '';
  return CANONICAL_ARTIFACT_RUNTIME_BINDINGS[normalizedArtifactId] || null;
}

export function getRuntimeArtifactIdsForCanonicalArtifact(artifactId) {
  return getCanonicalArtifactRuntimeBinding(artifactId)?.runtimeArtifactIds || [];
}

export function getCanonicalArtifactIdForRuntimeArtifact(runtimeArtifactId, fallback = '') {
  const normalizedRuntimeArtifactId = normalizeRuntimeArtifactId(runtimeArtifactId);
  return RUNTIME_ARTIFACT_TO_CANONICAL_ARTIFACT[normalizedRuntimeArtifactId] || fallback;
}

function normalizeArtifactPreference(value) {
  const source = value && typeof value === 'object' && !Array.isArray(value) ? value : {};
  const unknownKey = Object.keys(source).find((key) => key !== 'enabled' && key !== 'autoTrigger');
  if (unknownKey) {
    throw new Error(`CANONICAL_ARTIFACT_PREFERENCE_FIELD_INVALID:${unknownKey}`);
  }
  return {
    enabled: source.enabled === true,
    autoTrigger: typeof source.autoTrigger === 'boolean' ? source.autoTrigger : true,
  };
}

function mergeCanonicalArtifactPreference(currentPreference, nextPreference) {
  const current = normalizeArtifactPreference(currentPreference);
  const next = normalizeArtifactPreference(nextPreference);
  return {
    enabled: current.enabled || next.enabled,
    autoTrigger: current.autoTrigger || next.autoTrigger,
  };
}

export function normalizeCanonicalArtifactPreferenceMap(rawArtifacts) {
  const source = rawArtifacts && typeof rawArtifacts === 'object' && !Array.isArray(rawArtifacts)
    ? rawArtifacts
    : {};

  const next = CANONICAL_PROTECTION_ARTIFACT_PREFERENCE_IDS.reduce((acc, artifactId) => {
    acc[artifactId] = normalizeArtifactPreference(source[artifactId]);
    return acc;
  }, {});

  Object.entries(source).forEach(([artifactId, preference]) => {
    const canonicalArtifactId = getCanonicalArtifactIdForRuntimeArtifact(artifactId);
    if (!canonicalArtifactId) return;
    next[canonicalArtifactId] = mergeCanonicalArtifactPreference(
      next[canonicalArtifactId],
      preference,
    );
  });

  return next;
}

export function expandCanonicalArtifactPreferenceMapToRuntimePreferences(rawArtifacts) {
  const canonicalArtifacts = normalizeCanonicalArtifactPreferenceMap(rawArtifacts);
  return Object.entries(CANONICAL_ARTIFACT_RUNTIME_BINDINGS).reduce((acc, [canonicalArtifactId, binding]) => {
    const preference = normalizeArtifactPreference(canonicalArtifacts[canonicalArtifactId]);
    const runtimeArtifactIds = Array.isArray(binding?.runtimeArtifactIds) ? binding.runtimeArtifactIds : [];
    runtimeArtifactIds.forEach((runtimeArtifactId) => {
      acc[runtimeArtifactId] = { ...preference };
    });
    return acc;
  }, {});
}
