import {
  classifyRuntimeDebuggerProbe,
  computeNumericCounterDelta,
  createRuntimeDebuggerRatio,
} from './core/index.js';
import {
  TARGETING_HEALTH_ACTIVATION,
  TARGETING_HEALTH_VALIDITY,
  validateTargetingHealthSnapshot,
} from '../core/targetingHealthContract.js';

export const RUNTIME_DEBUGGER_TAB_TO_PROBE_ID = Object.freeze({
  protection: 'observerHub',
  social: 'socialMetrics',
  visual: 'visual',
  text: 'textShuffle',
  short: 'shortForm',
  'video-observer': 'videoObservation',
  click: 'clickGate',
  video: 'videoSkip',
  feed: 'feedFlow',
  sentinel: 'sentinel',
});

const STRUCTURAL_SESSION_VALIDITIES = new Set([
  TARGETING_HEALTH_VALIDITY.INACTIVE,
  TARGETING_HEALTH_VALIDITY.UNAVAILABLE,
  TARGETING_HEALTH_VALIDITY.BROKEN,
]);

function inspectTargetingHealth(snapshot, expectedOwnerId, { required = false } = {}) {
  if (snapshot === null || snapshot === undefined) {
    return {
      targetingHealth: null,
      contractError: required ? `TARGETING_HEALTH_SNAPSHOT_REQUIRED:${expectedOwnerId}` : null,
    };
  }
  try {
    const targetingHealth = validateTargetingHealthSnapshot(snapshot);
    if (targetingHealth.ownerId !== expectedOwnerId) {
      throw new Error(
        `TARGETING_HEALTH_OWNER_MISMATCH:${expectedOwnerId}:${targetingHealth.ownerId}`,
      );
    }
    return { targetingHealth, contractError: null };
  } catch (error) {
    return {
      targetingHealth: null,
      contractError: String(error?.message || error || 'TARGETING_HEALTH_SNAPSHOT_INVALID'),
    };
  }
}

function isTargetingHealthActivationConsistent(targetingHealth, active) {
  if (!targetingHealth) return false;
  return targetingHealth.activation === (
    active ? TARGETING_HEALTH_ACTIVATION.ACTIVE : TARGETING_HEALTH_ACTIVATION.INACTIVE
  );
}

function isTargetingHealthRuntimeReady(targetingHealth) {
  return targetingHealth
    && targetingHealth.validity !== TARGETING_HEALTH_VALIDITY.BROKEN
    && targetingHealth.validity !== TARGETING_HEALTH_VALIDITY.UNAVAILABLE;
}

const SOCIAL_OWNER_AUDIT_METADATA_FIELDS = new Set([
  'enabled',
  'mode',
  'deepProbeCollectionLimit',
  'deepProbeSelectorLimit',
  'duplicateScanEvidenceState',
  'avoidableFullRescanEvidenceState',
]);

function hasOwn(object, key) {
  return object !== null
    && typeof object === 'object'
    && Object.prototype.hasOwnProperty.call(object, key);
}

function inspectOwnerOperationCounter(snapshot) {
  const aliases = [
    [snapshot, 'operations'],
    [snapshot?.stats, 'operations'],
    [snapshot?.stats, 'scanOperations'],
  ].filter(([owner, key]) => hasOwn(owner, key));
  if (aliases.length === 0) {
    return { count: null, presentCount: 0, valid: false };
  }
  const values = aliases.map(([owner, key]) => owner[key]);
  if (values.some((value) => !Number.isSafeInteger(value) || value < 0)) {
    return { count: null, presentCount: aliases.length, valid: false };
  }
  if (values.some((value) => value !== values[0])) {
    return { count: null, presentCount: aliases.length, valid: false };
  }
  return { count: values[0], presentCount: aliases.length, valid: true };
}

function readOwnerOperationCounter(snapshot) {
  return inspectOwnerOperationCounter(snapshot).count;
}

function inspectMeasurementEpochOperationCounter(snapshot) {
  if (
    !hasOwn(snapshot, 'measurementEpoch')
    || !Number.isSafeInteger(snapshot.measurementEpoch)
    || snapshot.measurementEpoch < 0
    || !hasOwn(snapshot, 'measurementEpochOperationCount')
    || !Number.isSafeInteger(snapshot.measurementEpochOperationCount)
    || snapshot.measurementEpochOperationCount < 0
  ) {
    return { count: null, valid: false };
  }
  return { count: snapshot.measurementEpochOperationCount, valid: true };
}

function hasNonemptyRecentOperationEvidence(snapshot) {
  const nullableOperationEvidence = [
    snapshot?.lastOperation,
    snapshot?.currentScan,
    snapshot?.stats?.lastOperation,
    snapshot?.stats?.lastScanOperation,
  ];
  if (nullableOperationEvidence.some((value) => value !== null && value !== undefined)) {
    return true;
  }
  const recentOperationEvidence = [
    snapshot?.recentOperations,
    snapshot?.stats?.recentOperations,
    snapshot?.stats?.recentScanOperations,
  ];
  return recentOperationEvidence.some((value) => (
    value !== undefined && (!Array.isArray(value) || value.length > 0)
  ));
}

function isEmptyAuditWorkValue(value) {
  if (value === null) return true;
  if (typeof value === 'number') return Number.isFinite(value) && value === 0;
  if (Array.isArray(value)) return value.length === 0;
  if (value && typeof value === 'object') {
    return Object.values(value).every(isEmptyAuditWorkValue);
  }
  return false;
}

function hasSocialOwnerAuditWorkEvidence(snapshot) {
  const audit = snapshot?.stats?.audit;
  if (audit === undefined) return false;
  if (audit === null || typeof audit !== 'object' || Array.isArray(audit)) return true;
  return Object.entries(audit).some(([key, value]) => {
    if (!SOCIAL_OWNER_AUDIT_METADATA_FIELDS.has(key)) {
      return !isEmptyAuditWorkValue(value);
    }
    if (key === 'enabled') return typeof value !== 'boolean';
    if (key === 'mode') return value !== 'standard' && value !== 'deep';
    if (key.endsWith('Limit')) return !Number.isSafeInteger(value) || value < 0;
    return value !== 'armed_idle';
  });
}

function hasSocialOwnerWorkEvidence(snapshot) {
  const stats = snapshot?.stats;
  const statsWorkEvidence = stats !== undefined && (
    stats === null
    || typeof stats !== 'object'
    || Array.isArray(stats)
    || Object.entries(stats).some(([key, value]) => (
      key !== 'audit' && !isEmptyAuditWorkValue(value)
    ))
  );
  return hasNonemptyRecentOperationEvidence(snapshot)
    || hasSocialOwnerAuditWorkEvidence(snapshot)
    || statsWorkEvidence
    || (snapshot?.timings !== undefined && !isEmptyAuditWorkValue(snapshot.timings));
}

function isCanonicalInactiveSocialOwnerSnapshot(snapshot) {
  return snapshot?.loaded === true
    && snapshot.active === false
    && snapshot.activeEngagement === false
    && snapshot.activeExposure === false
    && Array.isArray(snapshot.activeMetricKeys)
    && snapshot.activeMetricKeys.length === 0
    && Array.isArray(snapshot.activeScanGroups)
    && snapshot.activeScanGroups.length === 0
    && snapshot.compiledPlanCount === 0
    && snapshot.metricRootSelectorLength === 0
    && snapshot.observerAttached === false;
}

function createExactOwnerOperationDelta(baselineSnapshot, latestSnapshot, probeId) {
  const baselineCount = readOwnerOperationCounter(baselineSnapshot);
  const latestCount = readOwnerOperationCounter(latestSnapshot);
  if (
    baselineCount === null
    || latestCount === null
    || latestCount < baselineCount
  ) {
    return {
      count: 0,
      contractError: `TARGETING_HEALTH_OPERATION_COUNT_INVALID:${probeId}`,
    };
  }
  return { count: latestCount - baselineCount, contractError: null };
}

function isCanonicalInactiveTargetingHealth(targetingHealth) {
  return targetingHealth?.activation === TARGETING_HEALTH_ACTIVATION.INACTIVE
    && targetingHealth.validity === TARGETING_HEALTH_VALIDITY.INACTIVE;
}

function createSocialOwnerOperationEvidence({
  baselineSnapshot,
  latestSnapshot,
  canonicalActive,
  targetingHealth,
}) {
  if (baselineSnapshot?.loaded === false) {
    const baselineOperationCounter = inspectOwnerOperationCounter(baselineSnapshot);
    const latestOperationCounter = inspectOwnerOperationCounter(latestSnapshot);
    const measurementEpochOperationCounter = inspectMeasurementEpochOperationCounter(
      latestSnapshot,
    );
    if (
      baselineOperationCounter.presentCount === 0
      && !hasSocialOwnerWorkEvidence(baselineSnapshot)
      && isCanonicalInactiveSocialOwnerSnapshot(latestSnapshot)
      && canonicalActive === false
      && isCanonicalInactiveTargetingHealth(targetingHealth)
      && latestOperationCounter.valid
      && measurementEpochOperationCounter.valid
      && measurementEpochOperationCounter.count <= latestOperationCounter.count
    ) {
      return {
        count: measurementEpochOperationCounter.count,
        contractError: null,
        state: measurementEpochOperationCounter.count === 0
          ? 'not_required_inactive'
          : 'measurement_epoch_exact',
      };
    }
    return {
      count: 0,
      contractError: 'TARGETING_HEALTH_OPERATION_COUNT_INVALID:socialMetrics',
      state: 'invalid',
    };
  }
  const exactEvidence = createExactOwnerOperationDelta(
    baselineSnapshot,
    latestSnapshot,
    'socialMetrics',
  );
  if (exactEvidence.contractError === null) {
    return { ...exactEvidence, state: 'exact_delta' };
  }
  return { ...exactEvidence, state: 'invalid' };
}

function projectProbeTargetingHealthValidity(
  probe,
  healthInspection,
  {
    activationConsistent = true,
    validityConsistent = true,
    operationContractError = null,
  } = {},
) {
  const targetingHealth = healthInspection.targetingHealth;
  if (!targetingHealth) return probe;
  let contractError = operationContractError;
  const sessionValidityConsistent = !STRUCTURAL_SESSION_VALIDITIES.has(probe.status)
    || probe.status === targetingHealth.validity;
  if (!activationConsistent) contractError = 'TARGETING_HEALTH_ACTIVATION_MISMATCH';
  else if (!validityConsistent) contractError = 'TARGETING_HEALTH_VALIDITY_MISMATCH';
  else if (!sessionValidityConsistent) {
    contractError = 'TARGETING_HEALTH_SESSION_VALIDITY_MISMATCH';
  } else if (
    contractError === null
    && targetingHealth.validity === TARGETING_HEALTH_VALIDITY.MEASURED
    && probe.operationCount === 0
  ) {
    contractError = 'TARGETING_HEALTH_MEASURED_OPERATION_REQUIRED';
  }
  const sessionValidity = {
    status: probe.status,
    reason: probe.reason,
    measurable: probe.measurable,
  };
  if (contractError !== null) {
    return {
      ...probe,
      status: TARGETING_HEALTH_VALIDITY.BROKEN,
      measurable: false,
      reason: 'targeting_health_probe_contract_invalid',
      details: {
        ...probe.details,
        sessionValidity,
        targetingHealthSessionValidityConsistent: sessionValidityConsistent,
        targetingHealthProbeContractError: contractError,
      },
    };
  }
  return {
    ...probe,
    status: targetingHealth.validity,
    measurable: targetingHealth.validity === TARGETING_HEALTH_VALIDITY.MEASURED,
    reason: targetingHealth.reasonCode,
    details: {
      ...probe.details,
      sessionValidity,
      targetingHealthSessionValidityConsistent: sessionValidityConsistent,
      targetingHealthProbeContractError: null,
    },
  };
}

function classify({
  probeId,
  label,
  active,
  activationKnown = true,
  available,
  ready,
  baselineCovered = true,
  operationCount,
  details,
}) {
  return classifyRuntimeDebuggerProbe({
    probeId,
    label,
    active: active === true,
    activationKnown: activationKnown === true,
    available: available === true,
    ready: ready === true,
    baselineCovered: baselineCovered === true,
    operationCount: Math.max(0, Number(operationCount) || 0),
    details,
  });
}

function createEffectProbeResult(baseline, latest, delta, probeId, label) {
  const snapshot = latest[probeId] || {};
  const counterDelta = delta[probeId] || {};
  const active = snapshot.active === true;
  const shortFormCompleteness = probeId === 'shortForm'
    ? snapshot.completeness || null
    : null;
  const healthInspection = probeId === 'shortForm'
    ? inspectTargetingHealth(
      shortFormCompleteness?.targetingHealth,
      'short_form',
      { required: active },
    )
    : { targetingHealth: null, contractError: null };
  const healthActivationConsistent = probeId !== 'shortForm'
    || healthInspection.targetingHealth === null
    || isTargetingHealthActivationConsistent(healthInspection.targetingHealth, active);
  const healthValidityConsistent = probeId !== 'shortForm'
    || healthInspection.targetingHealth === null
    || shortFormCompleteness?.state === healthInspection.targetingHealth.validity;
  const healthReady = probeId !== 'shortForm'
    || (
      healthInspection.contractError === null
      && healthActivationConsistent
      && healthValidityConsistent
      && isTargetingHealthRuntimeReady(healthInspection.targetingHealth)
    );
  const available = snapshot.available !== false
    && snapshot.loaded !== false
    && healthInspection.targetingHealth?.validity !== TARGETING_HEALTH_VALIDITY.UNAVAILABLE;
  const ready = snapshot.debugEnabled === true
    && snapshot.observerAttached === true
    && healthReady;
  const operationEvidence = probeId === 'shortForm'
    ? createExactOwnerOperationDelta(baseline[probeId], snapshot, probeId)
    : { count: counterDelta.stats?.operations, contractError: null };
  const probe = classify({
    probeId,
    label,
    active,
    activationKnown: available && typeof snapshot.active === 'boolean',
    available,
    ready,
    operationCount: operationEvidence.count,
    details: {
      active: snapshot.active === true,
      error: snapshot.error || null,
      available,
      ready,
      delta: counterDelta,
      queue: {
        pendingTextNodeCount: snapshot.pendingTextNodeCount,
        pendingSubtreeCount: snapshot.pendingSubtreeCount,
        pendingRecheckCount: snapshot.pendingRecheckCount,
        pendingRetryCount: snapshot.pendingRetryCount,
      },
      ...(probeId === 'shortForm'
        ? {
          completeness: shortFormCompleteness,
          targetingHealth: healthInspection.targetingHealth,
          targetingHealthContractError: healthInspection.contractError,
          targetingHealthActivationConsistent: healthActivationConsistent,
          targetingHealthValidityConsistent: healthValidityConsistent,
        }
        : {}),
      recentOperations: snapshot.recentOperations,
    },
  });
  return probeId === 'shortForm'
    ? projectProbeTargetingHealthValidity(probe, healthInspection, {
      activationConsistent: healthActivationConsistent,
      validityConsistent: healthValidityConsistent,
      operationContractError: operationEvidence.contractError,
    })
    : probe;
}

function sumNumericValues(value) {
  if (!value || typeof value !== 'object') return 0;
  return Object.values(value).reduce((total, item) => total + (Number(item) || 0), 0);
}

function resolveMonotonicDelta(latestValue, baselineValue) {
  const latest = Number(latestValue);
  const baseline = Number(baselineValue);
  if (!Number.isFinite(latest)) return 0;
  if (!Number.isFinite(baseline)) return Math.max(0, latest);
  return Math.max(0, latest - baseline);
}

export function createRuntimeDebuggerProbeResults(session) {
  if (!session?.baseline || !session?.latest) {
    throw new Error('RUNTIME_DEBUGGER_PROBE_SESSION_REQUIRED');
  }
  const latest = session.latest;
  const delta = computeNumericCounterDelta(session.baseline, latest, {
    includeZero: false,
    ignoredPaths: session.ignoredDeltaPaths,
  });
  const activeFilterKeys = latest.protection?.summary?.runtime?.activeFilterKeys || [];
  const observer = latest.observerHub || {};
  const observerBaseline = session.baseline.observerHub || {};
  const observerDelta = delta.observerHub || {};
  const observerSubscriberDelta = observerDelta.subscriberCounters || {};
  const observerSubscriberCallbackMs = Object.values(observerSubscriberDelta)
    .reduce((total, entry) => total + (Number(entry?.totalMs) || 0), 0);
  const runtimeContention = latest.runtimeContention || null;
  const runtimeContentionBaseline = session.baseline.runtimeContention || null;
  const runtimeContentionOperationCount = runtimeContention
    ? [
      ['scroll', 'frameCount'],
      ['ownerWork', 'operationCount'],
      ['longTasks', 'count'],
    ].reduce((total, [section, key]) => total + resolveMonotonicDelta(
      runtimeContention?.[section]?.[key],
      runtimeContentionBaseline?.[section]?.[key],
    ), 0)
    : 0;
  const social = latest.socialMetrics || {};
  const socialBaseline = session.baseline.socialMetrics || {};
  const socialDelta = delta.socialMetrics || {};
  const socialAuditDelta = socialDelta.stats?.audit || {};
  const socialActive = activeFilterKeys.includes('socialMetrics');
  const activeMetricKeys = Array.isArray(social.activeMetricKeys) ? social.activeMetricKeys : [];
  const socialHealthInspection = inspectTargetingHealth(
    social.targetingHealth,
    'social_metrics',
    { required: socialActive || social.active === true },
  );
  const socialHealthActivationConsistent = socialHealthInspection.targetingHealth === null
    || (
      typeof social.active === 'boolean'
      && social.active === socialActive
      && isTargetingHealthActivationConsistent(
        socialHealthInspection.targetingHealth,
        socialActive,
      )
    );
  const socialHealthReady = socialHealthInspection.contractError === null
    && socialHealthActivationConsistent
    && isTargetingHealthRuntimeReady(socialHealthInspection.targetingHealth);
  const socialReady = social.debugEnabled === true
    && social.active === true
    && activeMetricKeys.length > 0
    && Number(social.compiledPlanCount) > 0
    && social.observerAttached === true
    && socialHealthReady;
  const socialBaselineHealthInspection = inspectTargetingHealth(
    socialBaseline.targetingHealth,
    'social_metrics',
    { required: socialBaseline.loaded === true && socialBaseline.active === true },
  );
  const socialBaselineHealthActivationConsistent =
    socialBaselineHealthInspection.targetingHealth === null
    || isTargetingHealthActivationConsistent(
      socialBaselineHealthInspection.targetingHealth,
      socialBaseline.active === true,
    );
  const socialOperationEvidence = createSocialOwnerOperationEvidence({
    baselineSnapshot: socialBaseline,
    latestSnapshot: social,
    canonicalActive: socialActive,
    targetingHealth: socialHealthInspection.targetingHealth,
  });
  const socialBaselineCovered = socialBaseline.loaded === true
    && readOwnerOperationCounter(socialBaseline) !== null
    && socialBaselineHealthInspection.contractError === null
    && socialBaselineHealthActivationConsistent;
  const feed = latest.feedFlow || {};
  const feedDelta = delta.feedFlow || {};
  const feedLedgerReady = Number.isFinite(Number(feed.ledger?.counters?.advanceCount));
  const clickGate = latest.clickGate || {};
  const videoSkip = latest.videoSkip || {};
  const sentinel = latest.sentinel || {};
  const appliedDecisionCount = Math.max(0, Number(socialAuditDelta.appliedDecisionCount) || 0);
  const selectorHitCount = Math.max(0, Number(socialAuditDelta.selectorHits) || 0);
  const decisionCount = Math.max(0, Number(socialAuditDelta.decisionCount) || 0);

  const socialProbe = classify({
    probeId: 'socialMetrics',
    label: 'Social Metrics',
    active: socialActive,
    available: social.loaded === true
      && socialHealthInspection.targetingHealth?.validity
        !== TARGETING_HEALTH_VALIDITY.UNAVAILABLE,
    ready: socialReady,
    baselineCovered: socialBaselineCovered,
    operationCount: socialOperationEvidence.count,
    details: {
      canonicalActive: socialActive,
      activeMetricKeys,
      compiledPlanCount: social.compiledPlanCount,
      observerAttached: social.observerAttached,
      baselineCovered: socialBaselineCovered,
      operationCounterState: socialOperationEvidence.state,
      targetingHealth: socialHealthInspection.targetingHealth,
      targetingHealthContractError: socialHealthInspection.contractError,
      targetingHealthActivationConsistent: socialHealthActivationConsistent,
      baselineTargetingHealthContractError: socialBaselineHealthInspection.contractError,
      baselineTargetingHealthActivationConsistent:
        socialBaselineHealthActivationConsistent,
      auditMode: social.auditMode,
      selectorToTarget: createRuntimeDebuggerRatio(appliedDecisionCount, selectorHitCount),
      decisionYield: createRuntimeDebuggerRatio(appliedDecisionCount, decisionCount),
      delta: socialDelta,
      recentOperations: social.recentOperations,
    },
  });
  const projectedSocialProbe = projectProbeTargetingHealthValidity(
    socialProbe,
    socialHealthInspection,
    {
      activationConsistent: socialHealthActivationConsistent,
      operationContractError: socialOperationEvidence.contractError,
    },
  );

  return [
    classify({
      probeId: 'runtimeContention',
      label: 'Runtime Contention Timeline',
      active: runtimeContention?.active === true,
      activationKnown: runtimeContention !== null,
      available: runtimeContention !== null,
      ready: runtimeContention?.schemaVersion === 1,
      baselineCovered: runtimeContentionBaseline?.schemaVersion === 1,
      operationCount: runtimeContentionOperationCount,
      details: runtimeContention
        ? {
          state: runtimeContention.state,
          complete: runtimeContention.complete,
          scroll: runtimeContention.scroll,
          ownerWork: runtimeContention.ownerWork,
          longTasks: runtimeContention.longTasks,
          contention: runtimeContention.contention,
          retention: runtimeContention.retention,
          instrumentation: runtimeContention.instrumentation,
        }
        : null,
    }),
    classify({
      probeId: 'observerHub',
      label: 'Observer Hub',
      active: Number(observer.subscriberCount) > 0,
      available: !!observer && typeof observer === 'object',
      ready: observer.debugEnabled === true,
      operationCount: observerDelta.flushes,
      details: {
        activeOptions: observer.activeOptions,
        subscriberCount: observer.subscriberCount,
        mutationDelta: observerDelta.mutations,
        durationDeltaMs: observerDelta.flushDurationTotalMs,
        subscriberDelta: observerSubscriberDelta,
        flushShapeDelta: {
          attributeOnly: observerDelta.attributeOnlyFlushes,
          childOnly: observerDelta.childOnlyFlushes,
          mixed: observerDelta.mixedFlushes,
          tiny: observerDelta.tinyFlushes,
        },
        queueWaitDeltaMs: observerDelta.queueWaitTotalMs,
        attributeMutationDelta: observerDelta.attributeMutationCounts,
        costBreakdown: {
          flushTotalMs: observerDelta.flushDurationTotalMs,
          subscriberCallbackMs: Number(observerSubscriberCallbackMs.toFixed(2)),
          debugFlushBookkeepingMs: observerDelta.debugFlushOverheadTotalMs,
          debugFlushBookkeepingCount: observerDelta.debugFlushOverheadCount,
          debugSnapshotReadMs: resolveMonotonicDelta(
            observer.debugSnapshotReadTotalMs,
            observerBaseline.debugSnapshotReadTotalMs,
          ),
          debugSnapshotReadCount: resolveMonotonicDelta(
            observer.debugSnapshotReadCount,
            observerBaseline.debugSnapshotReadCount,
          ),
        },
        recentFlushes: observer.recentFlushes,
      },
    }),
    projectedSocialProbe,
    createEffectProbeResult(session.baseline, latest, delta, 'visual', 'Visual Media Filter'),
    createEffectProbeResult(session.baseline, latest, delta, 'textShuffle', 'Text Shuffle'),
    createEffectProbeResult(session.baseline, latest, delta, 'shortForm', 'Short-form Block'),
    createEffectProbeResult(
      session.baseline,
      latest,
      delta,
      'videoObservation',
      'Video Element Observer',
    ),
    classify({
      probeId: 'clickGate',
      label: 'Click Gate',
      active: clickGate.active === true,
      available: true,
      ready: !clickGate.lastError,
      operationCount: sumNumericValues(delta.clickGate?.eventCounts),
      details: { lastDecision: clickGate.lastDecision, recentDecisions: clickGate.recentDecisions },
    }),
    classify({
      probeId: 'videoSkip',
      label: 'Video Skip Guard',
      active: videoSkip.active === true,
      available: true,
      ready: !videoSkip.lastError,
      operationCount: sumNumericValues(delta.videoSkip?.eventCounts),
      details: { lastEvent: videoSkip.lastEvent, recentHistory: videoSkip.history },
    }),
    classify({
      probeId: 'feedFlow',
      label: 'Feed Flow',
      active: feed.active === true,
      available: !!feed && typeof feed === 'object',
      ready: !!feed.readout && feedLedgerReady,
      operationCount: feedDelta.ledger?.counters?.advanceCount,
      details: {
        ledgerReady: feedLedgerReady,
        delta: feedDelta,
        semantic: feed.semantic,
        ledger: feed.ledger,
        episode: feed.episode,
      },
    }),
    classify({
      probeId: 'sentinel',
      label: 'Sentinel Protocol',
      active: sentinel.loaded === true,
      available: !sentinel.error,
      ready: sentinel.loaded === true,
      operationCount: delta.sentinel?.timeline?.totalEntries,
      details: { lastLaunch: sentinel.lastLaunch, timeline: sentinel.timeline },
    }),
  ];
}

export default createRuntimeDebuggerProbeResults;
