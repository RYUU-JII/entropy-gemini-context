import {
  CONFIG_DEFAULT_FILTER_SETTINGS,
  isAdaptiveFrictionFeatureKey,
  normalizeFilterSettings,
  resolveEnsoIntervalMs,
} from '../../../settings/config/index.js';
import {
  buildEnsoFeedHorizonRuntimeConfig,
} from '../../../nudge/feed-flow/config/ensoFeedHorizonRuntimeConfig.js';
import {
  isCanonicalBinaryFilterKey,
} from '../../../settings/config/canonicalBinaryFilterProfiles.js';
import { FEATURE_KEYS } from '../../protocol/contracts/featureKeys.js';
import { buildProtectionEnvelope } from '../protocol/dispatch/ProtectionEnvelopeBuilder.js';
import { createProtectionPolicyCompiler } from '../protocol/engine/ProtectionPolicyCompiler.js';
import { RUNTIME_ARTIFACT_IDS } from '../../contracts/artifactIds.js';
import {
  normalizeInterventionPlan,
  normalizeProtectionProfile,
} from '../../contracts/protectionContracts.js';
import {
  FILTER_EXECUTION_SOURCES,
  normalizeFilterExecutionSource,
} from '../../contracts/filterExecutionContracts.js';
import {
  INTENSITY_ADJUSTABLE_FRICTION_MODIFIER_FEATURE_KEYS,
  FRICTION_MODIFIER_PRIORITIES,
  FRICTION_MODIFIER_SCOPE_KINDS,
  FRICTION_MODIFIER_SOURCES,
  createFilterIntensityModifier,
  resolveFrictionModifiedFilters,
} from '../../runtime/frictionModifierResolver.js';
import { getRuntimeArtifactDefinition } from '../../catalog/artifactCatalog.js';
import {
  CANONICAL_ARTIFACT_EXECUTION_KINDS,
  CANONICAL_ARTIFACT_RUNTIME_BINDINGS,
  normalizeCanonicalArtifactPreferenceMap,
} from '../../runtime/canonicalArtifactRuntimeBinding.js';
import { isKnownDomainClassId } from '../../protocol/scope/classCatalog.js';
import { requireCoolingCurvePlan } from '../../runtime/coolingCurveResolver.js';

const DISCONNECTED_RUNTIME_FILTER_KEYS = Object.freeze([
  'inputDelay',
]);

const POLICY_STRENGTHENING_FILTER_KEYS = new Set(
  INTENSITY_ADJUSTABLE_FRICTION_MODIFIER_FEATURE_KEYS,
);

function normalizeHostname(value) {
  return typeof value === 'string' ? value.trim().toLowerCase() : '';
}

function requireHostname(value) {
  const hostname = normalizeHostname(value);
  if (!hostname) {
    throw new Error('ENVELOPE_ADAPTER_HOSTNAME_REQUIRED');
  }
  return hostname;
}

function requireNonNegativeInteger(value, errorCode) {
  if (!Number.isInteger(value) || value < 0) {
    throw new Error(errorCode);
  }
  return value;
}

function cloneFilterEntry(entry) {
  if (!entry || typeof entry !== 'object' || Array.isArray(entry)) {
    return {
      isActive: false,
      value: entry ?? null,
    };
  }
  return { ...entry };
}

function suppressDisconnectedRuntimeFilters(filters = {}) {
  const next = { ...(filters && typeof filters === 'object' ? filters : {}) };
  DISCONNECTED_RUNTIME_FILTER_KEYS.forEach((featureKey) => {
    const current = cloneFilterEntry(next[featureKey]);
    next[featureKey] = {
      ...current,
      isActive: false,
      ...buildExecutionMetadata({
        source: FILTER_EXECUTION_SOURCES.INACTIVE,
        userConfigured: current.userConfigured === true,
        policyRequested: current.policyRequested === true,
        policyApplied: false,
        policySuppressed: current.policyRequested === true,
        policyLevel: current.policyLevel,
      }),
    };
  });
  return next;
}

function buildNeutralBaseFilters() {
  const next = {};
  FEATURE_KEYS.forEach((featureKey) => {
    next[featureKey] = {
      ...cloneFilterEntry(CONFIG_DEFAULT_FILTER_SETTINGS?.[featureKey]),
      isActive: false,
    };
  });
  return normalizeFilterSettings(next);
}

function suppressDisabledArtifactOwnedBaseFilters({
  baseFilters = null,
  profile = null,
  canonicalArtifacts = null,
} = {}) {
  const normalizedBase = baseFilters
    ? normalizeFilterSettings(baseFilters)
    : null;

  if (!normalizedBase) return normalizedBase;

  const normalizedProfile = normalizeProtectionProfile(profile);
  const normalizedCanonicalArtifacts = canonicalArtifacts
    ? normalizeCanonicalArtifactPreferenceMap(canonicalArtifacts)
    : null;
  const suppressed = { ...normalizedBase };
  const disableFeatureKey = (featureKey) => {
    const current = cloneFilterEntry(suppressed[featureKey]);
    suppressed[featureKey] = {
      ...current,
      isActive: false,
    };
  };

  RUNTIME_ARTIFACT_IDS.forEach((artifactId) => {
    if (normalizedProfile?.artifacts?.[artifactId]?.enabled) return;

    const definition = getRuntimeArtifactDefinition(artifactId);
    if (!definition) return;

    definition.featureKeys.forEach(disableFeatureKey);
  });

  if (normalizedCanonicalArtifacts) {
    Object.entries(CANONICAL_ARTIFACT_RUNTIME_BINDINGS).forEach(([artifactId, binding]) => {
      if (binding?.executionKind !== CANONICAL_ARTIFACT_EXECUTION_KINDS.FILTER_SETTINGS) return;
      if (normalizedCanonicalArtifacts?.[artifactId]?.enabled) return;

      const ownedFilterKeys = new Set([
        ...(Array.isArray(binding?.executionKeys) ? binding.executionKeys : []),
        ...(Array.isArray(binding?.stateFilterKeys) ? binding.stateFilterKeys : []),
      ]);
      ownedFilterKeys.forEach(disableFeatureKey);
    });
  }

  return normalizeFilterSettings(suppressed);
}

function isPlainObject(value) {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function requireKnownDomainClassId(value) {
  if (!isKnownDomainClassId(value)) {
    throw new Error('ENVELOPE_ADAPTER_DOMAIN_CLASS_INVALID');
  }
  return value;
}

function resolveEnvelopeDomainClassId({
  requestedDomainClassId = null,
  host,
  profile,
  plan,
  filters,
} = {}) {
  if (requestedDomainClassId !== null && requestedDomainClassId !== undefined) {
    return requireKnownDomainClassId(requestedDomainClassId);
  }
  return requireKnownDomainClassId(resolveDomainClassId({
    host,
    profile,
    plan,
    filters,
  }));
}

function requireCompiledPolicyOutput(compiledPolicy) {
  if (!isPlainObject(compiledPolicy)) {
    throw new Error('ENVELOPE_ADAPTER_COMPILED_POLICY_INVALID');
  }
  if (!isPlainObject(compiledPolicy.compiledFeatures)) {
    throw new Error('ENVELOPE_ADAPTER_COMPILED_POLICY_FIELD_INVALID:compiledFeatures');
  }
  if (!isPlainObject(compiledPolicy.featureRevisions)) {
    throw new Error('ENVELOPE_ADAPTER_COMPILED_POLICY_FIELD_INVALID:featureRevisions');
  }
  if (!isPlainObject(compiledPolicy.featureHashes)) {
    throw new Error('ENVELOPE_ADAPTER_COMPILED_POLICY_FIELD_INVALID:featureHashes');
  }
  FEATURE_KEYS.forEach((featureKey) => {
    if (!isPlainObject(compiledPolicy.compiledFeatures[featureKey])) {
      throw new Error(`ENVELOPE_ADAPTER_COMPILED_FEATURE_INVALID:${featureKey}`);
    }
    const featureRevision = compiledPolicy.featureRevisions[featureKey];
    if (!Number.isInteger(featureRevision) || featureRevision < 0) {
      throw new Error(`ENVELOPE_ADAPTER_FEATURE_REVISION_INVALID:${featureKey}`);
    }
    const featureHash = compiledPolicy.featureHashes[featureKey];
    if (typeof featureHash !== 'string' || !featureHash.trim()) {
      throw new Error(`ENVELOPE_ADAPTER_FEATURE_HASH_INVALID:${featureKey}`);
    }
  });
  return compiledPolicy;
}

function normalizeTrace(trace = null, fallback = {}) {
  const source = isPlainObject(trace)
    ? trace
    : {};
  const unknownField = Object.keys(source)
    .find((fieldName) => !['traceId', 'source', 'reasonCodes'].includes(fieldName));
  if (unknownField) {
    throw new Error(`ENVELOPE_ADAPTER_TRACE_FIELD_INVALID:${unknownField}`);
  }
  const fallbackReasonCodes = Array.isArray(fallback.reasonCodes)
    ? fallback.reasonCodes
    : [];
  const nextReasonCodes = Array.isArray(source.reasonCodes)
    ? source.reasonCodes.filter((item) => typeof item === 'string' && item.trim().length > 0)
    : fallbackReasonCodes;

  return {
    traceId: typeof source.traceId === 'string' && source.traceId.trim()
      ? source.traceId.trim()
      : (fallback.traceId || null),
    source: typeof source.source === 'string' && source.source.trim()
      ? source.source.trim()
      : (fallback.source || 'protection_engine'),
    reasonCodes: Array.from(new Set(nextReasonCodes)),
  };
}

function buildExecutionMetadata({
  source = FILTER_EXECUTION_SOURCES.INACTIVE,
  userConfigured = false,
  policyRequested = false,
  policyApplied = false,
  policySuppressed = false,
  policyLevel = null,
  runtimeArtifactId = null,
} = {}) {
  const normalizedSource = normalizeFilterExecutionSource(source);
  const hasPolicyLevel = policyLevel !== null
    && policyLevel !== undefined
    && Number.isFinite(Number(policyLevel));
  return {
    executionSource: normalizedSource,
    userConfigured: userConfigured === true,
    policyRequested: policyRequested === true,
    policyApplied: policyApplied === true,
    policySuppressed: policySuppressed === true,
    ...(hasPolicyLevel ? { policyLevel: Number(policyLevel) } : {}),
    ...(runtimeArtifactId ? { runtimeArtifactId } : {}),
  };
}

function attachExecutionMetadata(entry, metadata) {
  if (!entry || typeof entry !== 'object' || Array.isArray(entry)) return entry;
  return {
    ...entry,
    ...metadata,
  };
}

function deriveEnsoFeedHorizonControllerFilter(filters = {}) {
  const next = filters && typeof filters === 'object' ? { ...filters } : {};
  const ensoGate = cloneFilterEntry(next.ensoGate);
  const intervalMs = resolveEnsoIntervalMs(ensoGate.value);
  next.ensoGate = { ...ensoGate, value: { intervalMs } };
  const currentController = cloneFilterEntry(next.infiniteScrollGuard);
  next.infiniteScrollGuard = {
    ...currentController,
    isActive: ensoGate.isActive === true,
    value: buildEnsoFeedHorizonRuntimeConfig({ intervalMs }),
    ...buildExecutionMetadata({
      source: ensoGate.executionSource,
      userConfigured: ensoGate.userConfigured === true,
      policyRequested: ensoGate.policyRequested === true,
      policyApplied: ensoGate.policyApplied === true,
      policySuppressed: ensoGate.policySuppressed === true,
      policyLevel: ensoGate.policyLevel,
    }),
  };

  return next;
}

function getInactiveExecutionMetadata({
  baseActive,
  planActive,
  planState,
} = {}) {
  return buildExecutionMetadata({
    source: FILTER_EXECUTION_SOURCES.INACTIVE,
    userConfigured: baseActive,
    policyRequested: planActive,
    policySuppressed: planActive && !baseActive,
    policyLevel: planState?.level,
  });
}

function getPolicyMetadata({
  baseActive,
  planActive,
  policyApplied,
  planState,
} = {}) {
  return buildExecutionMetadata({
    source: policyApplied ? FILTER_EXECUTION_SOURCES.POLICY : FILTER_EXECUTION_SOURCES.USER_CONFIG,
    userConfigured: baseActive,
    policyRequested: planActive,
    policyApplied,
    policyLevel: planState?.level,
  });
}

function canApplyPolicyStrengthening(featureKey) {
  return POLICY_STRENGTHENING_FILTER_KEYS.has(featureKey);
}

function mergePlanFiltersWithBase({
  hostname = '',
  planFilters = {},
  baseFilters = null,
  planState = null,
  targetOverrun = false,
  coolingCurvePlan,
  coolingCurveApplicationOverride = null,
  runtimeModifiers: externalRuntimeModifiers = [],
} = {}) {
  const curvePlan = requireCoolingCurvePlan(coolingCurvePlan);
  if (![null, 'max_filter', 'release'].includes(coolingCurveApplicationOverride)) throw new Error('COOLING_CURVE_APPLICATION_OVERRIDE_INVALID');
  const normalizedHostname = normalizeHostname(hostname);
  if (curvePlan.modifiers.some(intent => intent.scope.hostname !== normalizedHostname)) throw new Error('COOLING_CURVE_PLAN_HOSTNAME_MISMATCH');
  const controlledKeys = new Set(coolingCurveApplicationOverride === 'max_filter' ? [] : curvePlan.controlledFeatureKeys);
  const hasPlanFilters = Object.keys(planFilters || {}).length > 0;
  const normalizedPlan = normalizeFilterSettings({
    ...buildNeutralBaseFilters(),
    ...(planFilters || {}),
  });
  const normalizedBase = baseFilters
    ? normalizeFilterSettings(baseFilters)
    : (hasPlanFilters
      ? buildNeutralBaseFilters()
      : normalizeFilterSettings(CONFIG_DEFAULT_FILTER_SETTINGS));
  const merged = {};
  const keys = new Set([
    ...Object.keys(normalizedBase),
    ...Object.keys(normalizedPlan),
  ]);
  const metadataByFeature = {};
  const policyRuntimeModifiers = [];

  keys.forEach((featureKey) => {
    const planEntry = cloneFilterEntry(normalizedPlan[featureKey]);
    const baseEntry = cloneFilterEntry(normalizedBase[featureKey]);
    const planActive = !!planEntry?.isActive;
    const baseActive = !!baseEntry?.isActive;

    if (isAdaptiveFrictionFeatureKey(featureKey)) {
      const policyShouldStrengthen = baseActive
        && planActive
        && !controlledKeys.has(featureKey)
        && canApplyPolicyStrengthening(featureKey);
      const siteTargetOverrun = targetOverrun && !controlledKeys.has(featureKey);
      merged[featureKey] = {
        ...baseEntry,
        isActive: baseActive,
      };
      if (policyShouldStrengthen) {
        policyRuntimeModifiers.push(createFilterIntensityModifier({
          id: `policy_strengthening:${featureKey}`,
          source: FRICTION_MODIFIER_SOURCES.POLICY_STRENGTHENING,
          scope: {
            kind: FRICTION_MODIFIER_SCOPE_KINDS.DOMAIN,
            hostname: normalizedHostname,
          },
          featureKeys: [featureKey],
          delta: 1,
          priority: FRICTION_MODIFIER_PRIORITIES.POLICY_STRENGTHENING,
        }));
      }
      if (siteTargetOverrun) {
        policyRuntimeModifiers.push(createFilterIntensityModifier({
          id: `target_overrun:${featureKey}`,
          source: FRICTION_MODIFIER_SOURCES.FURIN_OVERRUN,
          scope: { kind: FRICTION_MODIFIER_SCOPE_KINDS.DOMAIN, hostname: normalizedHostname },
          featureKeys: [featureKey],
          delta: 1,
          priority: FRICTION_MODIFIER_PRIORITIES.FURIN_OVERRUN,
        }));
      }
      metadataByFeature[featureKey] = baseActive
        ? getPolicyMetadata({
          baseActive,
          planActive: planActive || siteTargetOverrun || controlledKeys.has(featureKey),
          policyApplied: policyShouldStrengthen || siteTargetOverrun || controlledKeys.has(featureKey),
          planState,
        })
        : getInactiveExecutionMetadata({ baseActive, planActive, planState });
      return;
    }

    if (isCanonicalBinaryFilterKey(featureKey) || featureKey === 'ensoGate') {
      merged[featureKey] = {
        ...baseEntry,
        isActive: baseActive,
      };
      metadataByFeature[featureKey] = baseActive
        ? buildExecutionMetadata({
          source: controlledKeys.has(featureKey) ? FILTER_EXECUTION_SOURCES.POLICY : FILTER_EXECUTION_SOURCES.USER_CONFIG,
          userConfigured: true,
          policyRequested: planActive || controlledKeys.has(featureKey),
          policyApplied: controlledKeys.has(featureKey),
          policyLevel: planState?.level,
        })
        : getInactiveExecutionMetadata({ baseActive, planActive, planState });
      return;
    }

    if (planActive && baseActive) {
      merged[featureKey] = {
        ...baseEntry,
        ...planEntry,
        isActive: true,
      };
      metadataByFeature[featureKey] = buildExecutionMetadata({
        source: FILTER_EXECUTION_SOURCES.POLICY,
        userConfigured: true,
        policyRequested: true,
        policyApplied: true,
        policyLevel: planState?.level,
      });
      return;
    }

    merged[featureKey] = {
      ...baseEntry,
      ...(planActive && !baseActive ? planEntry : {}),
      isActive: baseActive,
    };
    metadataByFeature[featureKey] = baseActive
      ? buildExecutionMetadata({
        source: FILTER_EXECUTION_SOURCES.USER_CONFIG,
        userConfigured: true,
        policyRequested: planActive,
        policyApplied: false,
        policyLevel: planState?.level,
      })
      : getInactiveExecutionMetadata({ baseActive, planActive, planState });
  });

  const materialized = resolveFrictionModifiedFilters(merged, [
    ...(Array.isArray(externalRuntimeModifiers) ? externalRuntimeModifiers : []),
    ...policyRuntimeModifiers,
    ...(coolingCurveApplicationOverride === 'max_filter' ? [] : curvePlan.modifiers.filter(intent => (
      intent.target.featureKeys.every(featureKey => normalizedBase[featureKey]?.isActive === true)
    ))),
  ], {
    scopeContext: {
      kind: FRICTION_MODIFIER_SCOPE_KINDS.DOMAIN,
      hostname: normalizedHostname,
    },
  });
  Object.entries(materialized).forEach(([featureKey, entry]) => {
    materialized[featureKey] = attachExecutionMetadata(
      entry,
      metadataByFeature[featureKey] || buildExecutionMetadata(),
    );
  });
  return materialized;
}

function applyArtifactFeatureOwnership(filters, artifacts = {}) {
  RUNTIME_ARTIFACT_IDS.forEach((artifactId) => {
    const state = artifacts?.[artifactId];
    const definition = getRuntimeArtifactDefinition(artifactId);
    const shouldActivate = state === 'armed' || state === 'engaged' || state === 'cleanup';

    if (!definition || !shouldActivate) return;

    definition.featureKeys.forEach((featureKey) => {
      const current = cloneFilterEntry(filters[featureKey]);
      // Family runtime state owns provenance, not a child's configured activation.
      if (current.isActive !== true) return;

      filters[featureKey] = {
        ...current,
        ...buildExecutionMetadata({
          source: FILTER_EXECUTION_SOURCES.RUNTIME_ARTIFACT,
          userConfigured: current.userConfigured === true,
          policyRequested: current.policyRequested === true,
          policyApplied: current.policyApplied === true,
          policyLevel: current.policyLevel,
          runtimeArtifactId: artifactId,
        }),
      };
    });
  });

  return filters;
}

function buildResolvedFilters({
  hostname = '',
  baseFilters = null,
  profile = null,
  plan = null,
  canonicalArtifacts = null,
  runtimeModifiers = [],
  coolingCurvePlan,
  coolingCurveApplicationOverride = null,
} = {}) {
  const normalizedPlan = normalizeInterventionPlan(plan);
  const sanitizedBaseFilters = suppressDisabledArtifactOwnedBaseFilters({
    baseFilters,
    profile,
    canonicalArtifacts,
  });

  return deriveEnsoFeedHorizonControllerFilter(
    applyArtifactFeatureOwnership(
      suppressDisconnectedRuntimeFilters(
        mergePlanFiltersWithBase({
          hostname,
          planFilters: normalizedPlan.filterPlan,
          baseFilters: sanitizedBaseFilters,
          planState: normalizedPlan.state,
          targetOverrun: normalizedPlan.trace.budgetRatio >= 1,
          runtimeModifiers,
          coolingCurvePlan,
          coolingCurveApplicationOverride,
        }),
      ),
      normalizedPlan.artifacts,
    ),
  );
}

function buildActivationMap(filters = {}, { mainEnabled = true } = {}) {
  return FEATURE_KEYS.reduce((acc, featureKey) => {
    acc[featureKey] = {
      enabled: !!mainEnabled && !!filters?.[featureKey]?.isActive,
      source: normalizeFilterExecutionSource(
        filters?.[featureKey]?.executionSource,
        FILTER_EXECUTION_SOURCES.INACTIVE,
      ),
    };
    return acc;
  }, {});
}

function hasManagedInterventions(filters = {}, plan = null) {
  const hasFilter = FEATURE_KEYS.some((featureKey) => !!filters?.[featureKey]?.isActive);
  const hasArtifact = RUNTIME_ARTIFACT_IDS.some((artifactId) => {
    const state = plan?.artifacts?.[artifactId];
    return state === 'armed' || state === 'engaged' || state === 'cleanup';
  });
  return hasFilter || hasArtifact;
}

function resolveDomainClassId({ host, profile, plan, filters }) {
  if (hasManagedInterventions(filters, plan)) return 'managed';

  const budgetEntry = normalizeProtectionProfile(profile).budgets?.[host];
  return budgetEntry?.dailyMinutes > 0 ? 'allowed' : 'unmanaged';
}

export function createEnvelopeAdapter({
  policyCompiler = createProtectionPolicyCompiler(),
} = {}) {
  function buildEnvelopeInput({
    hostname,
    profile,
    plan,
    baseFilters = null,
    canonicalArtifacts = null,
    runtimeModifiers = [],
    coolingCurvePlan,
    coolingCurveApplicationOverride = null,
    revision = 0,
    domainClassId = null,
    trace = null,
    mainEnabled = null,
  } = {}) {
    const normalizedHostname = requireHostname(hostname);
    const resolvedRevision = requireNonNegativeInteger(
      revision,
      'ENVELOPE_ADAPTER_REVISION_INVALID',
    );
    const normalizedPlan = normalizeInterventionPlan(plan);
    const filters = buildResolvedFilters({
      hostname: normalizedHostname,
      baseFilters,
      profile,
      plan: normalizedPlan,
      canonicalArtifacts,
      runtimeModifiers,
      coolingCurvePlan,
      coolingCurveApplicationOverride,
    });
    const hasMainActivation = hasManagedInterventions(filters, normalizedPlan);
    const resolvedMainEnabled = typeof mainEnabled === 'boolean'
      ? mainEnabled && hasMainActivation
      : hasMainActivation;
    const activation = {
      main: resolvedMainEnabled,
      features: buildActivationMap(filters, { mainEnabled: resolvedMainEnabled }),
    };
    const compiledPolicy = requireCompiledPolicyOutput(policyCompiler.compilePolicy({
      filters,
      activation,
      revision: resolvedRevision,
    }));
    const resolvedDomainClassId = resolveEnvelopeDomainClassId({
      requestedDomainClassId: domainClassId,
      host: normalizedHostname,
      profile,
      plan: normalizedPlan,
      filters,
    });
    const decisionTrace = normalizeTrace(trace, {
      traceId: `upe:${normalizedHostname}:${resolvedRevision}`,
      reasonCodes: normalizedPlan.state.reasons,
      source: 'protection_engine',
    });

    return {
      coolingCurve: requireCoolingCurvePlan(coolingCurvePlan).coolingCurve,
      decisionRevision: resolvedRevision,
      domainClassId: resolvedDomainClassId,
      decisionTrace,
      activation,
      compiledFeatures: compiledPolicy.compiledFeatures,
      featureRevisions: compiledPolicy.featureRevisions,
      featureHashes: compiledPolicy.featureHashes,
    };
  }

  function buildEnvelope({
    hostname,
    profile,
    plan,
    baseFilters = null,
    canonicalArtifacts = null,
    runtimeModifiers = [],
    coolingCurvePlan,
    coolingCurveApplicationOverride = null,
    previousEnvelopeState = null,
    previousRevision = 0,
    forceSnapshot = false,
    domainClassId = null,
    trace = null,
    mainEnabled = null,
  } = {}) {
    const resolvedPreviousRevision = requireNonNegativeInteger(
      previousRevision,
      'ENVELOPE_ADAPTER_PREVIOUS_REVISION_INVALID',
    );
    const nextRevision = resolvedPreviousRevision + 1;
    const envelopeInput = buildEnvelopeInput({
      hostname,
      profile,
      plan,
      baseFilters,
      canonicalArtifacts,
      runtimeModifiers,
      coolingCurvePlan,
      coolingCurveApplicationOverride,
      revision: nextRevision,
      domainClassId,
      trace,
      mainEnabled,
    });

    return buildProtectionEnvelope({
      hostname,
      decision: envelopeInput,
      previousEnvelopeState,
      previousRevision: resolvedPreviousRevision,
      forceSnapshot,
      patchTraceSource: 'protection_engine_patch',
    });
  }

  return {
    buildEnvelopeInput,
    toDecision: buildEnvelopeInput,
    buildEnvelope,
  };
}
