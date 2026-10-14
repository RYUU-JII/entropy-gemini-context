import {
  isAdaptiveFrictionFeatureKey,
  isVisualFrictionProfileKey,
  getFrictionIntensityOrdinal,
} from '../../settings/config/index.js';
import {
  buildEmptyInterventionPlan,
  isArtifactState,
  normalizeObservation,
} from '../contracts/protectionContracts.js';
import {
  normalizeCompiledRuntimeInterventionPlan,
  projectCompiledRuntimeFilterPlanForTelemetry,
} from '../contracts/compiledRuntimeFilterPlanContract.js';
import { isRuntimeArtifactId } from '../contracts/artifactIds.js';
import { ENSO_ATTENTION_COHERENCE_STATUS } from './ensoAttentionCoherenceState.js';
import { normalizeOptionalGoalEndSummary } from '../contracts/goalEndSummaryContract.js';
import { normalizeOptionalCoolingCurveRuntimeState } from '../contracts/coolingCurveRuntimeContract.js';
import {
  CANONICAL_ARTIFACT_RUNTIME_BINDINGS,
  CANONICAL_ARTIFACT_STATE_SOURCES,
  getCanonicalArtifactRuntimeBinding,
  getRuntimeArtifactIdsForCanonicalArtifact,
} from './canonicalArtifactRuntimeBinding.js';

export const EMPTY_PROTECTION_ARTIFACT_RUNTIME_SNAPSHOT = Object.freeze({
  capturedAt: 0,
  scope: Object.freeze({
    host: '',
    tabId: null,
    source: 'none',
  }),
  runtime: Object.freeze({
    available: false,
    plan: Object.freeze(buildEmptyInterventionPlan()),
    observation: Object.freeze(normalizeObservation({})),
    goalEndSummary: null,
    coolingCurve: null,
    revision: 0,
  }),
});

const CANONICAL_ARTIFACT_RUNTIME_STATE_PRIORITY = Object.freeze({
  unavailable: -1,
  disabled: 0,
  armed: 1,
  cleanup: 2,
  engaged: 3,
});

const ENSO_ATTENTION_COHERENCE_STATUS_VALUES = new Set(
  Object.values(ENSO_ATTENTION_COHERENCE_STATUS),
);

function normalizeScope(scope) {
  const source = scope && typeof scope === 'object' ? scope : {};
  const tabId = Number(source.tabId);
  return {
    host: typeof source.host === 'string' ? source.host.trim().toLowerCase() : '',
    tabId: Number.isInteger(tabId) && tabId >= 0 ? tabId : null,
    source: typeof source.source === 'string' && source.source.trim()
      ? source.source.trim()
      : 'none',
  };
}

export function normalizeProtectionArtifactRuntimeSnapshot(rawSnapshot) {
  const source = rawSnapshot && typeof rawSnapshot === 'object' ? rawSnapshot : {};
  const runtimeSource = source.runtime && typeof source.runtime === 'object' ? source.runtime : {};
  const available = runtimeSource.available === true;
  return {
    capturedAt: Number(source.capturedAt) || 0,
    scope: normalizeScope(source.scope),
    runtime: {
      available,
      plan: available
        ? normalizeCompiledRuntimeInterventionPlan(runtimeSource.plan)
        : EMPTY_PROTECTION_ARTIFACT_RUNTIME_SNAPSHOT.runtime.plan,
      observation: available
        ? normalizeObservation(runtimeSource.observation)
        : EMPTY_PROTECTION_ARTIFACT_RUNTIME_SNAPSHOT.runtime.observation,
      revision: Number(runtimeSource.revision) || 0,
      goalEndSummary: normalizeOptionalGoalEndSummary(runtimeSource.goalEndSummary),
      coolingCurve: normalizeOptionalCoolingCurveRuntimeState(runtimeSource.coolingCurve),
    },
  };
}

function normalizeTelemetryCount(value) {
  const numeric = Math.floor(Number(value));
  return Number.isFinite(numeric) && numeric > 0 ? numeric : 0;
}

function normalizeTelemetryRatio(value, fallback = 0) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return fallback;
  return Math.max(0, Math.min(1, numeric));
}

function normalizeTelemetryStringArray(values) {
  if (!Array.isArray(values)) return [];
  return values
    .filter((value) => typeof value === 'string' && value.trim())
    .map((value) => value.trim());
}

function normalizeEnsoAttentionCoherenceTelemetry(rawAttentionCoherence = null) {
  const source = rawAttentionCoherence
    && typeof rawAttentionCoherence === 'object'
    && !Array.isArray(rawAttentionCoherence)
    ? rawAttentionCoherence
    : {};
  const loadRatio = normalizeTelemetryRatio(source.loadRatio, 0);
  const coherenceRatio = normalizeTelemetryRatio(source.coherenceRatio, 1 - loadRatio);
  const status = ENSO_ATTENTION_COHERENCE_STATUS_VALUES.has(source.status)
    ? source.status
    : ENSO_ATTENTION_COHERENCE_STATUS.CENTERED;

  return {
    status,
    loadRatio: Number(loadRatio.toFixed(4)),
    coherenceRatio: Number(coherenceRatio.toFixed(4)),
    contextSwitchCount: normalizeTelemetryCount(source.contextSwitchCount),
    contextSwitchThreshold: Math.max(3, normalizeTelemetryCount(source.contextSwitchThreshold)),
    contextSwitchRatePerMinute: Math.max(0, Number.isFinite(Number(source.contextSwitchRatePerMinute))
      ? Number(source.contextSwitchRatePerMinute)
      : 0),
    protectedTabCount: normalizeTelemetryCount(source.protectedTabCount),
    protectedTabHostCount: normalizeTelemetryCount(source.protectedTabHostCount),
    protectedTabThreshold: Math.max(2, normalizeTelemetryCount(source.protectedTabThreshold)),
    consumedProtectedContextCount: normalizeTelemetryCount(source.consumedProtectedContextCount),
    protectedContextThreshold: Math.max(1, normalizeTelemetryCount(source.protectedContextThreshold)),
    returnLockActive: source.returnLockActive === true,
    feedFlowLoadRatio: Number(normalizeTelemetryRatio(source.feedFlowLoadRatio, 0).toFixed(4)),
    feedFlowDirectTriggers: normalizeTelemetryStringArray(source.feedFlowDirectTriggers),
    feedFlowPressureSignals: normalizeTelemetryStringArray(source.feedFlowPressureSignals),
    clusterSignal: source.clusterSignal === true,
    protectedTabSignal: source.protectedTabSignal === true,
    consumedContextSignal: source.consumedContextSignal === true,
    hopSignal: source.hopSignal === true,
  };
}

function normalizeArtifactTelemetryContext(rawContext = null) {
  const source = rawContext && typeof rawContext === 'object' && !Array.isArray(rawContext)
    ? rawContext
    : {};
  const flare = source.flare && typeof source.flare === 'object' && !Array.isArray(source.flare)
    ? source.flare
    : {};
  const echo = source.echo && typeof source.echo === 'object' && !Array.isArray(source.echo)
    ? source.echo
    : {};
  const veil = source.veil && typeof source.veil === 'object' && !Array.isArray(source.veil)
    ? source.veil
    : {};
  const gate = source.gate && typeof source.gate === 'object' && !Array.isArray(source.gate)
    ? source.gate
    : {};
  const flareSentinel = flare.sentinelFlare && typeof flare.sentinelFlare === 'object'
    ? flare.sentinelFlare
    : {};
  const echoMemoryPurge = echo.memoryPurge && typeof echo.memoryPurge === 'object'
    ? echo.memoryPurge
    : {};
  const veilAttentionCoherence = veil.attentionCoherence && typeof veil.attentionCoherence === 'object'
    ? veil.attentionCoherence
    : {};
  const gateEntry = gate.entryCheckpoint && typeof gate.entryCheckpoint === 'object'
    ? gate.entryCheckpoint
    : {};
  const gateReturn = gate.returnGuard && typeof gate.returnGuard === 'object'
    ? gate.returnGuard
    : {};
  const gateDetour = gate.detourSpreadGuard && typeof gate.detourSpreadGuard === 'object'
    ? gate.detourSpreadGuard
    : {};

  return {
    flare: {
      sentinelFlare: {
        basis: typeof flareSentinel.basis === 'string' ? flareSentinel.basis : '',
        overallStatus: typeof flareSentinel.overallStatus === 'string' ? flareSentinel.overallStatus : 'off',
        referenceExceededCount: Math.max(
          0,
          Math.floor(Number(flareSentinel.referenceExceededCount) || 0),
        ),
        sitesInScopeCount: Math.max(
          0,
          Math.floor(Number(flareSentinel.sitesInScopeCount) || 0),
        ),
        targets: Array.isArray(flareSentinel.targets)
          ? flareSentinel.targets.map((entry) => ({
            domain: typeof entry?.domain === 'string' ? entry.domain : '',
            activeMs: Math.max(0, Math.floor(Number(entry?.activeMs) || 0)),
            targetMs: Math.max(0, Math.floor(Number(entry?.targetMs) || 0)),
            targetMinutes: Math.max(0, Math.floor(Number(entry?.targetMinutes) || 0)),
            ratio: Math.max(0, Number(entry?.ratio) || 0),
            breached: entry?.breached === true,
            referenceOnly: entry?.referenceOnly === true,
            referenceSource: typeof entry?.referenceSource === 'string' ? entry.referenceSource : 'none',
            basis: typeof entry?.basis === 'string' ? entry.basis : '',
            basisStatus: typeof entry?.basisStatus === 'string' ? entry.basisStatus : 'inactive',
            basisAffected: entry?.basisAffected === true,
            engaged: entry?.engaged === true,
            provenanceSource: typeof entry?.provenanceSource === 'string' ? entry.provenanceSource : '',
          }))
          : [],
        topTargets: Array.isArray(flareSentinel.topTargets)
          ? flareSentinel.topTargets.map((entry) => ({
            domain: typeof entry?.domain === 'string' ? entry.domain : '',
            activeMs: Math.max(0, Math.floor(Number(entry?.activeMs) || 0)),
            targetMs: Math.max(0, Math.floor(Number(entry?.targetMs) || 0)),
            targetMinutes: Math.max(0, Math.floor(Number(entry?.targetMinutes) || 0)),
            ratio: Math.max(0, Number(entry?.ratio) || 0),
            breached: entry?.breached === true,
            referenceOnly: entry?.referenceOnly === true,
            referenceSource: typeof entry?.referenceSource === 'string' ? entry.referenceSource : 'none',
            basis: typeof entry?.basis === 'string' ? entry.basis : '',
            basisStatus: typeof entry?.basisStatus === 'string' ? entry.basisStatus : 'inactive',
            basisAffected: entry?.basisAffected === true,
            engaged: entry?.engaged === true,
            provenanceSource: typeof entry?.provenanceSource === 'string' ? entry.provenanceSource : '',
          }))
          : [],
      },
    },
    echo: {
      memoryPurge: {
        safeguardCount: Math.max(
          0,
          Math.floor(Number(echoMemoryPurge.safeguardCount) || 0),
        ),
        safeguardMax: Math.max(
          0,
          Math.floor(Number(echoMemoryPurge.safeguardMax) || 0),
        ),
      },
    },
    veil: {
      attentionCoherence: normalizeEnsoAttentionCoherenceTelemetry(veilAttentionCoherence),
    },
    gate: {
      entryCheckpoint: {
        entryDetected: gateEntry.entryDetected === true,
        ...(Object.hasOwn(gateEntry, 'shishiIntensity') ? { shishiIntensity: gateEntry.shishiIntensity } : {}),
        ...(Object.hasOwn(gateEntry, 'recentConsumption') ? { recentConsumption: gateEntry.recentConsumption } : {}),
        lastEnteredAt: Math.max(0, Math.floor(Number(gateEntry.lastEnteredAt) || 0)),
        entrySignalTtlMs: Math.max(0, Math.floor(Number(gateEntry.entrySignalTtlMs) || 0)),
        keptTabPassUntil: Math.max(0, Math.floor(Number(gateEntry.keptTabPassUntil) || 0)),
        keptTabPassActive: gateEntry.keptTabPassActive === true,
        entryApproved: gateEntry.entryApproved === true,
        holdDurationMs: Math.max(0, Math.floor(Number(gateEntry.holdDurationMs) || 0)),
        keptTabPassWindowMs: Math.max(0, Math.floor(Number(gateEntry.keptTabPassWindowMs) || 0)),
      },
      returnGuard: {
        lockActive: gateReturn.lockActive === true,
        ...(Object.hasOwn(gateReturn, 'recentConsumption') ? { recentConsumption: gateReturn.recentConsumption } : {}),
        entryApproved: gateReturn.entryApproved === true,
        lockLeftAt: Math.max(0, Math.floor(Number(gateReturn.lockLeftAt) || 0)),
        lockUntil: Math.max(0, Math.floor(Number(gateReturn.lockUntil) || 0)),
        lockRemainingMs: Math.max(0, Math.floor(Number(gateReturn.lockRemainingMs) || 0)),
        lockDurationMs: Math.max(0, Math.floor(Number(gateReturn.lockDurationMs) || 0)),
        holdDurationMs: Math.max(0, Math.floor(Number(gateReturn.holdDurationMs) || 0)),
        triggered: gateReturn.triggered === true,
      },
      detourSpreadGuard: {
        maxProtectedTabs: Math.max(1, Math.floor(Number(gateDetour.maxProtectedTabs) || 1)),
        contextSwitchCount: Math.max(0, Math.floor(Number(gateDetour.contextSwitchCount) || 0)),
        contextSwitchThreshold: Math.max(0, Math.floor(Number(gateDetour.contextSwitchThreshold) || 0)),
        contextSwitchWindowMs: Math.max(0, Math.floor(Number(gateDetour.contextSwitchWindowMs) || 0)),
        contextSwitchRatePerMinute: Math.max(0, Number(gateDetour.contextSwitchRatePerMinute) || 0),
        protectedTabCount: Math.max(0, Math.floor(Number(gateDetour.protectedTabCount) || 0)),
        protectedTabHostCount: Math.max(0, Math.floor(Number(gateDetour.protectedTabHostCount) || 0)),
        protectedTabThreshold: Math.max(0, Math.floor(Number(gateDetour.protectedTabThreshold) || 0)),
        consumedProtectedContextCount: Math.max(0, Math.floor(Number(gateDetour.consumedProtectedContextCount) || 0)),
        protectedContextThreshold: Math.max(0, Math.floor(Number(gateDetour.protectedContextThreshold) || 0)),
        consumeDwellMs: Math.max(0, Math.floor(Number(gateDetour.consumeDwellMs) || 0)),
        contextWindowMs: Math.max(0, Math.floor(Number(gateDetour.contextWindowMs) || 0)),
        hopSignal: gateDetour.hopSignal === true,
        clusterSignal: gateDetour.clusterSignal === true,
        protectedTabSignal: gateDetour.protectedTabSignal === true,
        consumedContextSignal: gateDetour.consumedContextSignal === true,
        lastContinueAt: Math.max(0, Math.floor(Number(gateDetour.lastContinueAt) || 0)),
        lastContinueKind: typeof gateDetour.lastContinueKind === 'string' ? gateDetour.lastContinueKind : '',
        holdDurationMs: Math.max(0, Math.floor(Number(gateDetour.holdDurationMs) || 0)),
        triggered: gateDetour.triggered === true,
      },
    },
  };
}

function cloneCanonicalChildTelemetry(childId, childTelemetry = null) {
  const source = childTelemetry && typeof childTelemetry === 'object' && !Array.isArray(childTelemetry)
    ? childTelemetry
    : {};
  return {
    ...source,
    childId,
    stateSource: typeof source.stateSource === 'string' ? source.stateSource : '',
    available: source.available === true,
    state: typeof source.state === 'string' ? source.state : 'disabled',
    isActive: source.isActive === true,
    intensityLevel: Math.max(0, Math.floor(Number(source.intensityLevel) || 0)),
    intensityMax: Math.max(0, Math.floor(Number(source.intensityMax) || 0)),
    metrics: source.metrics && typeof source.metrics === 'object' && !Array.isArray(source.metrics)
      ? { ...source.metrics }
      : {},
  };
}

function applyContextualChildTelemetry(canonicalArtifactId, childId, childTelemetry, telemetryContext) {
  const nextTelemetry = cloneCanonicalChildTelemetry(childId, childTelemetry);

  if (canonicalArtifactId === 'flare' && childId === 'sentinelFlare') {
    const basis = telemetryContext.flare.sentinelFlare.basis;
    const overallStatus = telemetryContext.flare.sentinelFlare.overallStatus;
    const referenceExceededCount = telemetryContext.flare.sentinelFlare.referenceExceededCount;
    const sitesInScopeCount = telemetryContext.flare.sentinelFlare.sitesInScopeCount;
    const targets = Array.isArray(telemetryContext.flare.sentinelFlare.targets)
      ? telemetryContext.flare.sentinelFlare.targets.map((entry) => ({ ...entry }))
      : [];
    const topTargets = Array.isArray(telemetryContext.flare.sentinelFlare.topTargets)
      ? telemetryContext.flare.sentinelFlare.topTargets.map((entry) => ({ ...entry }))
      : [];
    return {
      ...nextTelemetry,
      intensityLevel: referenceExceededCount,
      intensityMax: sitesInScopeCount,
      metrics: {
        ...nextTelemetry.metrics,
        basis,
        overallStatus,
        referenceExceededCount,
        sitesInScopeCount,
        targets,
        topTargets,
      },
    };
  }

  if (
    canonicalArtifactId === 'echo'
    && (childId === 'historyCleanup' || childId === 'bookmarkConceal')
  ) {
    const safeguardCount = telemetryContext.echo.memoryPurge.safeguardCount;
    const safeguardMax = telemetryContext.echo.memoryPurge.safeguardMax;
    return {
      ...nextTelemetry,
      intensityLevel: safeguardCount,
      intensityMax: safeguardMax,
      metrics: {
        ...nextTelemetry.metrics,
        safeguardCount,
        safeguardMax,
      },
    };
  }

  if (canonicalArtifactId === 'veil' && childId === 'attentionCoherence') {
    const attentionCoherence = telemetryContext.veil.attentionCoherence;
    const intensityLevel = Math.round(attentionCoherence.loadRatio * 100);
    return {
      ...nextTelemetry,
      state: 'disabled',
      isActive: false,
      intensityLevel,
      intensityMax: 100,
      metrics: {
        ...nextTelemetry.metrics,
        status: attentionCoherence.status,
        loadRatio: attentionCoherence.loadRatio,
        coherenceRatio: attentionCoherence.coherenceRatio,
        contextSwitchCount: attentionCoherence.contextSwitchCount,
        contextSwitchThreshold: attentionCoherence.contextSwitchThreshold,
        contextSwitchRatePerMinute: attentionCoherence.contextSwitchRatePerMinute,
        protectedTabCount: attentionCoherence.protectedTabCount,
        protectedTabHostCount: attentionCoherence.protectedTabHostCount,
        protectedTabThreshold: attentionCoherence.protectedTabThreshold,
        consumedProtectedContextCount: attentionCoherence.consumedProtectedContextCount,
        protectedContextThreshold: attentionCoherence.protectedContextThreshold,
        returnLockActive: attentionCoherence.returnLockActive,
        feedFlowLoadRatio: attentionCoherence.feedFlowLoadRatio,
        feedFlowDirectTriggers: attentionCoherence.feedFlowDirectTriggers.map((trigger) => trigger),
        feedFlowPressureSignals: attentionCoherence.feedFlowPressureSignals.map((signal) => signal),
        clusterSignal: attentionCoherence.clusterSignal,
        protectedTabSignal: attentionCoherence.protectedTabSignal,
        consumedContextSignal: attentionCoherence.consumedContextSignal,
        hopSignal: attentionCoherence.hopSignal,
      },
    };
  }

  if (canonicalArtifactId === 'gate' && childId === 'entryCheckpoint') {
    return {
      ...nextTelemetry,
      metrics: {
        ...nextTelemetry.metrics,
        entryDetected: telemetryContext.gate.entryCheckpoint.entryDetected,
        ...(Object.hasOwn(telemetryContext.gate.entryCheckpoint, 'shishiIntensity')
          ? { shishiIntensity: telemetryContext.gate.entryCheckpoint.shishiIntensity } : {}),
        ...(Object.hasOwn(telemetryContext.gate.entryCheckpoint, 'recentConsumption')
          ? { recentConsumption: telemetryContext.gate.entryCheckpoint.recentConsumption } : {}),
        lastEnteredAt: telemetryContext.gate.entryCheckpoint.lastEnteredAt,
        entrySignalTtlMs: telemetryContext.gate.entryCheckpoint.entrySignalTtlMs,
        keptTabPassUntil: telemetryContext.gate.entryCheckpoint.keptTabPassUntil,
        keptTabPassActive: telemetryContext.gate.entryCheckpoint.keptTabPassActive,
        entryApproved: telemetryContext.gate.entryCheckpoint.entryApproved,
        holdDurationMs: telemetryContext.gate.entryCheckpoint.holdDurationMs,
        keptTabPassWindowMs: telemetryContext.gate.entryCheckpoint.keptTabPassWindowMs,
      },
    };
  }

  if (canonicalArtifactId === 'gate' && childId === 'returnGuard') {
    return {
      ...nextTelemetry,
      metrics: {
        ...nextTelemetry.metrics,
        lockActive: telemetryContext.gate.returnGuard.lockActive,
        ...(Object.hasOwn(telemetryContext.gate.returnGuard, 'recentConsumption')
          ? { recentConsumption: telemetryContext.gate.returnGuard.recentConsumption } : {}),
        entryApproved: telemetryContext.gate.returnGuard.entryApproved,
        lockLeftAt: telemetryContext.gate.returnGuard.lockLeftAt,
        lockUntil: telemetryContext.gate.returnGuard.lockUntil,
        lockRemainingMs: telemetryContext.gate.returnGuard.lockRemainingMs,
        lockDurationMs: telemetryContext.gate.returnGuard.lockDurationMs,
        holdDurationMs: telemetryContext.gate.returnGuard.holdDurationMs,
        triggered: telemetryContext.gate.returnGuard.triggered,
      },
    };
  }

  if (canonicalArtifactId === 'barrier' && childId === 'detourSpreadGuard') {
    return {
      ...nextTelemetry,
      metrics: {
        ...nextTelemetry.metrics,
        maxProtectedTabs: telemetryContext.gate.detourSpreadGuard.maxProtectedTabs,
        contextSwitchCount: telemetryContext.gate.detourSpreadGuard.contextSwitchCount,
        contextSwitchThreshold: telemetryContext.gate.detourSpreadGuard.contextSwitchThreshold,
        contextSwitchWindowMs: telemetryContext.gate.detourSpreadGuard.contextSwitchWindowMs,
        contextSwitchRatePerMinute: telemetryContext.gate.detourSpreadGuard.contextSwitchRatePerMinute,
        protectedTabCount: telemetryContext.gate.detourSpreadGuard.protectedTabCount,
        protectedTabHostCount: telemetryContext.gate.detourSpreadGuard.protectedTabHostCount,
        protectedTabThreshold: telemetryContext.gate.detourSpreadGuard.protectedTabThreshold,
        consumedProtectedContextCount: telemetryContext.gate.detourSpreadGuard.consumedProtectedContextCount,
        protectedContextThreshold: telemetryContext.gate.detourSpreadGuard.protectedContextThreshold,
        consumeDwellMs: telemetryContext.gate.detourSpreadGuard.consumeDwellMs,
        contextWindowMs: telemetryContext.gate.detourSpreadGuard.contextWindowMs,
        hopSignal: telemetryContext.gate.detourSpreadGuard.hopSignal,
        clusterSignal: telemetryContext.gate.detourSpreadGuard.clusterSignal,
        protectedTabSignal: telemetryContext.gate.detourSpreadGuard.protectedTabSignal,
        consumedContextSignal: telemetryContext.gate.detourSpreadGuard.consumedContextSignal,
        lastContinueAt: telemetryContext.gate.detourSpreadGuard.lastContinueAt,
        lastContinueKind: telemetryContext.gate.detourSpreadGuard.lastContinueKind,
        holdDurationMs: telemetryContext.gate.detourSpreadGuard.holdDurationMs,
        triggered: telemetryContext.gate.detourSpreadGuard.triggered,
      },
    };
  }

  return nextTelemetry;
}

function selectRuntimeFilterPlanChildState(normalizedSnapshot, normalizedFilterPlan, childBinding) {
  const available = normalizedSnapshot.runtime.available;
  const stateFilterKeys = Array.isArray(childBinding?.stateFilterKeys) ? childBinding.stateFilterKeys : [];
  const optionKeys = Array.isArray(childBinding?.optionKeys) ? childBinding.optionKeys : [];
  let active = false;
  let intensityLevel = 0;
  let intensityMax = 0;

  if (optionKeys.length > 0) {
    const socialMetricsEntry = normalizedFilterPlan.socialMetrics;
    const socialMetricOptions = socialMetricsEntry.value;
    intensityMax = optionKeys.length;
    intensityLevel = !!socialMetricsEntry?.isActive
      ? optionKeys.filter((optionKey) => socialMetricOptions?.[optionKey]).length
      : 0;
    active = intensityLevel > 0;
  } else if (stateFilterKeys.length === 1) {
    const filterKey = stateFilterKeys[0];
    const filterEntry = normalizedFilterPlan?.[filterKey] || null;
    const isEntryActive = filterEntry?.isActive === true;
    const rawLevel = (() => {
      if (!isEntryActive) return 0;
      if (isVisualFrictionProfileKey(filterKey)) return filterEntry.effectiveStrength;
      if (isAdaptiveFrictionFeatureKey(filterKey)) {
        return getFrictionIntensityOrdinal(filterEntry.band);
      }
      return 0;
    })();
    if (isVisualFrictionProfileKey(filterKey)) {
      intensityMax = 100;
      intensityLevel = rawLevel;
      active = isEntryActive && rawLevel > 0;
    } else if (isEntryActive && rawLevel > 0) {
      intensityMax = 3;
      intensityLevel = Math.min(3, rawLevel);
      active = true;
    } else {
      intensityMax = 1;
      intensityLevel = isEntryActive ? 1 : 0;
      active = intensityLevel > 0;
    }
  } else {
    intensityMax = stateFilterKeys.length || 1;
    intensityLevel = stateFilterKeys.filter((filterKey) => normalizedFilterPlan?.[filterKey]?.isActive).length;
    active = intensityLevel > 0;
  }

  return {
    available,
    state: available && active ? 'engaged' : 'disabled',
    isActive: available ? active : false,
    intensityLevel,
    intensityMax,
  };
}

function selectCanonicalProtectionFilterPlanState(normalizedSnapshot, binding) {
  const available = normalizedSnapshot.runtime.available;
  const stateFilterKeys = Array.isArray(binding?.stateFilterKeys) ? binding.stateFilterKeys : [];
  const normalizedFilterPlan = projectCompiledRuntimeFilterPlanForTelemetry(
    normalizedSnapshot.runtime.plan?.filterPlan,
  );
  const activeFilterKeys = stateFilterKeys.filter((filterKey) => normalizedFilterPlan?.[filterKey]?.isActive);
  const active = activeFilterKeys.length > 0;

  return {
    bound: true,
    executionKind: typeof binding?.executionKind === 'string' ? binding.executionKind : '',
    executionKeys: Array.isArray(binding?.executionKeys) ? binding.executionKeys : [],
    runtimeArtifactIds: [],
    stateSource: CANONICAL_ARTIFACT_STATE_SOURCES.RUNTIME_FILTER_PLAN,
    available,
    state: available && active ? 'engaged' : 'disabled',
    isActive: available ? active : false,
    activeExecutionKeys: activeFilterKeys,
    scopeHost: normalizedSnapshot.scope.host,
    scopeSource: normalizedSnapshot.scope.source,
    capturedAt: normalizedSnapshot.capturedAt,
    revision: normalizedSnapshot.runtime.revision,
    level: normalizedSnapshot.runtime.plan.state.level,
  };
}

function selectRuntimeArtifactAggregateState(snapshot, runtimeArtifactIds = []) {
  const states = runtimeArtifactIds.map((runtimeArtifactId) => (
    selectProtectionRuntimeArtifactState(snapshot, runtimeArtifactId)
  ));
  const primaryState = states.reduce((best, current) => {
    if (!best) return current;
    const bestPriority = CANONICAL_ARTIFACT_RUNTIME_STATE_PRIORITY[best.state] ?? 0;
    const currentPriority = CANONICAL_ARTIFACT_RUNTIME_STATE_PRIORITY[current.state] ?? 0;
    return currentPriority > bestPriority ? current : best;
  }, null);

  return {
    available: states.some((entry) => entry.available),
    state: primaryState?.state || 'disabled',
    isActive: states.some((entry) => entry.isActive),
    intensityLevel: states.some((entry) => entry.isActive) ? 1 : 0,
    intensityMax: runtimeArtifactIds.length > 0 ? 1 : 0,
  };
}

export function selectProtectionRuntimeArtifactState(snapshot, artifactId) {
  const normalizedSnapshot = normalizeProtectionArtifactRuntimeSnapshot(snapshot);
  const available = normalizedSnapshot.runtime.available;
  const hasArtifact = isRuntimeArtifactId(artifactId);
  const rawState = hasArtifact
    ? normalizedSnapshot.runtime.plan.artifacts?.[artifactId]
    : 'disabled';
  const state = isArtifactState(rawState) ? rawState : 'disabled';
  return {
    available,
    state,
    isActive: available ? state !== 'disabled' : false,
    scopeHost: normalizedSnapshot.scope.host,
    scopeSource: normalizedSnapshot.scope.source,
    capturedAt: normalizedSnapshot.capturedAt,
    revision: normalizedSnapshot.runtime.revision,
    level: normalizedSnapshot.runtime.plan.state.level,
  };
}

export const selectProtectionArtifactRuntimeState = selectProtectionRuntimeArtifactState;

function buildCanonicalProtectionArtifactChildRuntimeStates(snapshot, canonicalArtifactId) {
  const normalizedSnapshot = normalizeProtectionArtifactRuntimeSnapshot(snapshot);
  const binding = getCanonicalArtifactRuntimeBinding(canonicalArtifactId);
  const childBindings = binding?.children && typeof binding.children === 'object' ? binding.children : {};
  const normalizedFilterPlan = projectCompiledRuntimeFilterPlanForTelemetry(
    normalizedSnapshot.runtime.plan?.filterPlan,
  );

  return Object.entries(childBindings).reduce((acc, [childId, childBinding]) => {
    const stateSource = typeof childBinding?.stateSource === 'string' ? childBinding.stateSource : '';
    let state = {
      available: normalizedSnapshot.runtime.available,
      state: 'disabled',
      isActive: false,
      intensityLevel: 0,
      intensityMax: 0,
    };

    if (stateSource === CANONICAL_ARTIFACT_STATE_SOURCES.RUNTIME_FILTER_PLAN) {
      state = selectRuntimeFilterPlanChildState(normalizedSnapshot, normalizedFilterPlan, childBinding);
    } else if (stateSource === CANONICAL_ARTIFACT_STATE_SOURCES.RUNTIME_ARTIFACTS) {
      state = selectRuntimeArtifactAggregateState(
        snapshot,
        Array.isArray(childBinding?.runtimeArtifactIds) ? childBinding.runtimeArtifactIds : [],
      );
    } else if (stateSource === CANONICAL_ARTIFACT_STATE_SOURCES.TELEMETRY_CONTEXT) {
      state = {
        available: normalizedSnapshot.runtime.available,
        state: 'disabled',
        isActive: false,
        intensityLevel: 0,
        intensityMax: 100,
      };
    }

    acc[childId] = cloneCanonicalChildTelemetry(childId, {
      childId,
      stateSource,
      available: state.available,
      state: state.state,
      isActive: state.isActive,
      intensityLevel: state.intensityLevel,
      intensityMax: state.intensityMax,
    });
    return acc;
  }, {});
}

export function selectCanonicalProtectionArtifactChildRuntimeStates(
  snapshot,
  canonicalArtifactId,
  telemetryContext = null,
) {
  const embeddedChildren = snapshot?.telemetry?.artifacts?.[canonicalArtifactId]?.children;
  const normalizedTelemetryContext = normalizeArtifactTelemetryContext(telemetryContext);
  const baseChildren = embeddedChildren && typeof embeddedChildren === 'object' && !Array.isArray(embeddedChildren)
    ? Object.entries(embeddedChildren).reduce((acc, [childId, childTelemetry]) => {
      acc[childId] = cloneCanonicalChildTelemetry(childId, childTelemetry);
      return acc;
    }, {})
    : buildCanonicalProtectionArtifactChildRuntimeStates(snapshot, canonicalArtifactId);

  return Object.entries(baseChildren).reduce((acc, [childId, childTelemetry]) => {
    acc[childId] = applyContextualChildTelemetry(
      canonicalArtifactId,
      childId,
      childTelemetry,
      normalizedTelemetryContext,
    );
    return acc;
  }, {});
}

export function selectCanonicalProtectionArtifactRuntimeState(snapshot, canonicalArtifactId) {
  const normalizedSnapshot = normalizeProtectionArtifactRuntimeSnapshot(snapshot);
  const binding = getCanonicalArtifactRuntimeBinding(canonicalArtifactId);
  const runtimeArtifactIds = getRuntimeArtifactIdsForCanonicalArtifact(canonicalArtifactId);
  const executionKind = typeof binding?.executionKind === 'string' ? binding.executionKind : '';
  const executionKeys = Array.isArray(binding?.executionKeys) ? binding.executionKeys : [];
  const stateSource = typeof binding?.stateSource === 'string'
    ? binding.stateSource
    : (runtimeArtifactIds.length
      ? CANONICAL_ARTIFACT_STATE_SOURCES.RUNTIME_ARTIFACTS
      : CANONICAL_ARTIFACT_STATE_SOURCES.CONFIGURATION);

  if (!binding) {
    return {
      bound: false,
      executionKind: '',
      executionKeys: [],
      runtimeArtifactIds: [],
      stateSource: '',
      available: false,
      state: 'unavailable',
      isActive: false,
      scopeHost: '',
      scopeSource: 'none',
      capturedAt: 0,
      revision: 0,
      level: 0,
    };
  }

  if (stateSource === CANONICAL_ARTIFACT_STATE_SOURCES.RUNTIME_FILTER_PLAN) {
    return selectCanonicalProtectionFilterPlanState(normalizedSnapshot, binding);
  }

  if (stateSource !== CANONICAL_ARTIFACT_STATE_SOURCES.RUNTIME_ARTIFACTS || !runtimeArtifactIds.length) {
    return {
      bound: true,
      executionKind,
      executionKeys,
      runtimeArtifactIds,
      stateSource,
      activeExecutionKeys: [],
      available: false,
      state: 'disabled',
      isActive: false,
      scopeHost: '',
      scopeSource: 'none',
      capturedAt: 0,
      revision: 0,
      level: 0,
    };
  }

  const states = runtimeArtifactIds.map((runtimeArtifactId) => (
    selectProtectionRuntimeArtifactState(snapshot, runtimeArtifactId)
  ));
  const primaryState = states.reduce((best, current) => {
    if (!best) return current;
    const bestPriority = CANONICAL_ARTIFACT_RUNTIME_STATE_PRIORITY[best.state] ?? 0;
    const currentPriority = CANONICAL_ARTIFACT_RUNTIME_STATE_PRIORITY[current.state] ?? 0;
    return currentPriority > bestPriority ? current : best;
  }, null);
  const scopeSource = states.find((entry) => entry.available) || primaryState;

  return {
    ...scopeSource,
    bound: true,
    executionKind,
    executionKeys,
    runtimeArtifactIds,
    stateSource,
    activeExecutionKeys: [],
    state: primaryState?.state || 'disabled',
    isActive: states.some((entry) => entry.isActive),
    level: Math.max(0, ...states.map((entry) => Number(entry.level) || 0)),
  };
}

export function selectCanonicalProtectionArtifactTelemetry(snapshot, canonicalArtifactId, telemetryContext = null) {
  const embeddedTelemetry = snapshot?.telemetry?.artifacts?.[canonicalArtifactId];
  if (embeddedTelemetry && typeof embeddedTelemetry === 'object') {
    return {
      artifactId: canonicalArtifactId,
      summary: embeddedTelemetry.summary && typeof embeddedTelemetry.summary === 'object'
        ? { ...embeddedTelemetry.summary }
        : selectCanonicalProtectionArtifactRuntimeState(snapshot, canonicalArtifactId),
      children: selectCanonicalProtectionArtifactChildRuntimeStates(
        snapshot,
        canonicalArtifactId,
        telemetryContext,
      ),
    };
  }

  return {
    artifactId: canonicalArtifactId,
    summary: selectCanonicalProtectionArtifactRuntimeState(snapshot, canonicalArtifactId),
    children: selectCanonicalProtectionArtifactChildRuntimeStates(
      snapshot,
      canonicalArtifactId,
      telemetryContext,
    ),
  };
}

export function buildCanonicalProtectionArtifactTelemetry(snapshot, telemetryContext = null) {
  const normalizedSnapshot = normalizeProtectionArtifactRuntimeSnapshot(snapshot);
  const artifacts = Object.keys(CANONICAL_ARTIFACT_RUNTIME_BINDINGS).reduce((acc, canonicalArtifactId) => {
    acc[canonicalArtifactId] = selectCanonicalProtectionArtifactTelemetry(
      normalizedSnapshot,
      canonicalArtifactId,
      telemetryContext,
    );
    return acc;
  }, {});

  return {
    capturedAt: normalizedSnapshot.capturedAt,
    scope: normalizedSnapshot.scope,
    runtime: {
      available: normalizedSnapshot.runtime.available,
      revision: normalizedSnapshot.runtime.revision,
      level: normalizedSnapshot.runtime.plan.state.level,
      goalEndSummary: normalizedSnapshot.runtime.goalEndSummary,
      coolingCurve: normalizedSnapshot.runtime.coolingCurve,
    },
    artifacts,
  };
}
