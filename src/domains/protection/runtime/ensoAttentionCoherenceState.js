export const ENSO_ATTENTION_COHERENCE_STATUS = Object.freeze({
  CENTERED: 'centered',
  OPEN: 'open',
  SCATTERED: 'scattered',
});

const FEED_FLOW_DIRECT_TRIGGER_WEIGHT = Object.freeze({
  INFINITE_SCROLL_DETECTED: 0.34,
  SHORT_FORM_ENTRY: 0.28,
  VIDEO_SEEK_ABUSE: 0.24,
});

const FEED_FLOW_PRESSURE_SIGNAL_WEIGHT = Object.freeze({
  FEED_FLOW_PRESSURE: 0.24,
  HIGH_CONTEXT_SWITCH: 0.3,
  CLSE_AGITATION: 0.18,
});

const clamp01 = (value) => {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return 0;
  return Math.max(0, Math.min(1, numeric));
};

const toCount = (value) => {
  const numeric = Math.floor(Number(value));
  return Number.isFinite(numeric) && numeric > 0 ? numeric : 0;
};

const toRatio = (value) => {
  const numeric = Number(value);
  return Number.isFinite(numeric) && numeric > 0 ? numeric : 0;
};

const normalizeStringArray = (values = []) => (
  Array.isArray(values)
    ? values.filter((value) => typeof value === 'string' && value.trim()).map((value) => value.trim())
    : []
);

function resolveFeedFlowLoad({
  feedFlowSnapshot = null,
  directTriggers = [],
  pressureSignals = [],
} = {}) {
  const snapshotDirectTriggers = normalizeStringArray(feedFlowSnapshot?.directTriggers);
  const snapshotPressureSignals = normalizeStringArray(feedFlowSnapshot?.pressureSignals);
  const mergedDirectTriggers = Array.from(new Set([
    ...snapshotDirectTriggers,
    ...normalizeStringArray(directTriggers),
  ]));
  const mergedPressureSignals = Array.from(new Set([
    ...snapshotPressureSignals,
    ...normalizeStringArray(pressureSignals),
  ]));

  const directTriggerLoad = mergedDirectTriggers.reduce(
    (sum, trigger) => sum + (
      Object.prototype.hasOwnProperty.call(FEED_FLOW_DIRECT_TRIGGER_WEIGHT, trigger)
        ? FEED_FLOW_DIRECT_TRIGGER_WEIGHT[trigger]
        : 0
    ),
    0,
  );
  const pressureLoad = mergedPressureSignals.reduce(
    (sum, signal) => sum + (
      Object.prototype.hasOwnProperty.call(FEED_FLOW_PRESSURE_SIGNAL_WEIGHT, signal)
        ? FEED_FLOW_PRESSURE_SIGNAL_WEIGHT[signal]
        : 0
    ),
    0,
  );

  return {
    loadRatio: clamp01(directTriggerLoad + pressureLoad),
    directTriggers: mergedDirectTriggers,
    pressureSignals: mergedPressureSignals,
  };
}

export function resolveEnsoAttentionCoherenceState({
  gateTelemetry = null,
  feedFlowSnapshot = null,
  directTriggers = [],
  pressureSignals = [],
} = {}) {
  const gate = gateTelemetry && typeof gateTelemetry === 'object' ? gateTelemetry : {};
  const detour = gate.detourSpreadGuard && typeof gate.detourSpreadGuard === 'object'
    ? gate.detourSpreadGuard
    : {};
  const returnGuard = gate.returnGuard && typeof gate.returnGuard === 'object'
    ? gate.returnGuard
    : {};

  const contextSwitchCount = toCount(detour.contextSwitchCount);
  const rawContextSwitchThreshold = toCount(detour.contextSwitchThreshold);
  const contextSwitchThreshold = rawContextSwitchThreshold > 0
    ? Math.max(3, rawContextSwitchThreshold)
    : 3;
  const contextSwitchRatePerMinute = toRatio(detour.contextSwitchRatePerMinute);
  const protectedTabCount = toCount(detour.protectedTabCount);
  const protectedTabHostCount = toCount(detour.protectedTabHostCount);
  const rawProtectedTabThreshold = toCount(detour.protectedTabThreshold);
  const protectedTabThreshold = rawProtectedTabThreshold > 0
    ? Math.max(2, rawProtectedTabThreshold)
    : 2;
  const consumedProtectedContextCount = toCount(detour.consumedProtectedContextCount);
  const rawProtectedContextThreshold = toCount(detour.protectedContextThreshold);
  const protectedContextThreshold = rawProtectedContextThreshold > 0
    ? Math.max(1, rawProtectedContextThreshold)
    : 3;
  // Coming back to a site while its return lock still holds is the churn
  // this load stands for.
  const returnLockActive = returnGuard.lockActive === true;
  const rapidReturnLoad = returnLockActive ? 1 : 0;
  const switchLoad = Math.max(
    clamp01(contextSwitchCount / contextSwitchThreshold),
    clamp01(contextSwitchRatePerMinute / 3),
  );
  const protectedTabLoad = clamp01(protectedTabCount / protectedTabThreshold);
  const consumedContextLoad = clamp01(consumedProtectedContextCount / protectedContextThreshold);
  const feedFlow = resolveFeedFlowLoad({
    feedFlowSnapshot,
    directTriggers,
    pressureSignals,
  });
  const clusterLoad = detour.clusterSignal === true ? 0.18 : 0;
  const loadRatio = clamp01(
    (switchLoad * 0.34)
    + (Math.max(protectedTabLoad, consumedContextLoad) * 0.22)
    + (rapidReturnLoad * 0.14)
    + (feedFlow.loadRatio * 0.24)
    + clusterLoad,
  );
  const status = loadRatio >= 0.68
    ? ENSO_ATTENTION_COHERENCE_STATUS.SCATTERED
    : (loadRatio >= 0.32
      ? ENSO_ATTENTION_COHERENCE_STATUS.OPEN
      : ENSO_ATTENTION_COHERENCE_STATUS.CENTERED);

  return Object.freeze({
    status,
    loadRatio: Number(loadRatio.toFixed(4)),
    coherenceRatio: Number((1 - loadRatio).toFixed(4)),
    contextSwitchCount,
    contextSwitchThreshold,
    contextSwitchRatePerMinute: Number(contextSwitchRatePerMinute.toFixed(4)),
    protectedTabCount,
    protectedTabHostCount,
    protectedTabThreshold,
    consumedProtectedContextCount,
    protectedContextThreshold,
    returnLockActive,
    feedFlowLoadRatio: Number(feedFlow.loadRatio.toFixed(4)),
    feedFlowDirectTriggers: Object.freeze(feedFlow.directTriggers),
    feedFlowPressureSignals: Object.freeze(feedFlow.pressureSignals),
    clusterSignal: detour.clusterSignal === true,
    protectedTabSignal: detour.protectedTabSignal === true,
    consumedContextSignal: detour.consumedContextSignal === true,
    hopSignal: detour.hopSignal === true,
  });
}

export default resolveEnsoAttentionCoherenceState;
