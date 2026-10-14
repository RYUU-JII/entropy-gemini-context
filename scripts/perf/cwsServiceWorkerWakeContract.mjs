import { MESSAGE_ACTIONS } from '../../src/platform/messaging/messageTypes.js';

export const CWS_WAKE_REQUIRED_READY_MILESTONES = Object.freeze([
  'kernel_created',
  'bootstrap_started',
  'sync_listeners_ready',
  'profile_generation_boot_settled',
  'dashboard_boot_read_ready',
  'full_init_ready',
]);

function cloneWorkerRevivalEvent(event) {
  return event && typeof event === 'object'
    ? Object.freeze({ ...event })
    : null;
}

export function accumulateCwsWorkerRevivalEvidence(previous, snapshot) {
  const current = previous && typeof previous === 'object' ? previous : {};
  const targetEvents = Array.isArray(snapshot?.diagnostics?.snapshot?.events)
    ? snapshot.diagnostics.snapshot.events
    : [];
  const globalEvents = Array.isArray(snapshot?.globalContentRuntimeDiagnostics?.snapshot?.events)
    ? snapshot.globalContentRuntimeDiagnostics.snapshot.events
    : [];
  const loaderReinjectedEvent = current.loaderReinjectedEvent || targetEvents.find((event) => (
    event?.event === 'bootstrap_state_observed'
    && event?.bootstrapReason === 'loader_reinjected'
    && (event?.status === 'receiver_ready' || event?.status === 'active')
  )) || null;
  const runtimeProbeRecoveredEvent = current.runtimeProbeRecoveredEvent || [
    ...targetEvents,
    ...globalEvents,
  ].find((event) => (
    event?.event === 'existing_runtime_probe_recovered'
    && (event?.status === 'receiver_ready' || event?.status === 'active')
    && typeof event?.documentId === 'string'
    && event.documentId.trim().length > 0
  )) || null;
  const catchUpReadinessEvent = current.catchUpReadinessEvent || globalEvents.find((event) => (
    event?.event === 'catch_up_readiness_completed'
    && event?.reason === 'service_init'
  )) || null;
  return Object.freeze({
    loaderReinjectedEvent: current.loaderReinjectedEvent
      || cloneWorkerRevivalEvent(loaderReinjectedEvent),
    runtimeProbeRecoveredEvent: current.runtimeProbeRecoveredEvent
      || cloneWorkerRevivalEvent(runtimeProbeRecoveredEvent),
    catchUpReadinessEvent: current.catchUpReadinessEvent
      || cloneWorkerRevivalEvent(catchUpReadinessEvent),
  });
}

export function calculateCwsNearestRankPercentile(values, percentileValue) {
  const sorted = (Array.isArray(values) ? values : [])
    .filter((value) => typeof value === 'number' && Number.isFinite(value))
    .sort((left, right) => left - right);
  if (sorted.length === 0) return null;
  const index = Math.min(
    sorted.length - 1,
    Math.max(0, Math.ceil((percentileValue / 100) * sorted.length) - 1),
  );
  return sorted[index];
}

export function summarizeCwsWakeLatencies(samples, field, responseField = null) {
  const values = (Array.isArray(samples) ? samples : [])
    .filter((sample) => !responseField || sample?.[responseField]?.success === true)
    .map((sample) => sample?.timing?.[field])
    .filter((value) => typeof value === 'number' && Number.isFinite(value));
  return {
    count: values.length,
    p50Ms: calculateCwsNearestRankPercentile(values, 50),
    p95Ms: calculateCwsNearestRankPercentile(values, 95),
    maxMs: values.length > 0 ? Math.max(...values) : null,
  };
}

const CWS_DASHBOARD_VISUAL_SAMPLE_FLOOR = 10;

function summarizeFiniteDurations(values) {
  const durations = (Array.isArray(values) ? values : [])
    .filter((value) => typeof value === 'number' && Number.isFinite(value) && value >= 0);
  return {
    count: durations.length,
    p50Ms: calculateCwsNearestRankPercentile(durations, 50),
    p95Ms: calculateCwsNearestRankPercentile(durations, 95),
    maxMs: durations.length > 0 ? Math.max(...durations) : null,
  };
}

export function projectCwsDashboardVisualFirstFrameSample(sample) {
  const errors = [];
  const snapshot = sample?.snapshot || null;
  const timing = sample?.timing || null;
  if (snapshot?.status !== 'ready') errors.push('DASHBOARD_STATUS_NOT_READY');
  if (snapshot?.coreReady !== true) errors.push('DASHBOARD_CORE_NOT_READY');
  if (snapshot?.dismissible !== true) errors.push('DASHBOARD_NOT_DISMISSIBLE');
  if (snapshot?.mainTabFirstFrameReady !== true) errors.push('MAIN_FIRST_FRAME_NOT_READY');
  if (snapshot?.mainTabFirstFrameDegraded === true) errors.push('MAIN_FIRST_FRAME_DEGRADED');
  if (snapshot?.forcedVisualRelease === true) errors.push('MAIN_FIRST_FRAME_FORCED_RELEASE');
  for (const field of ['navigationToBootReadyMs', 'pageReadyToBootReadyMs']) {
    if (!Number.isFinite(timing?.[field]) || timing[field] < 0) {
      errors.push(`DASHBOARD_TIMING_INVALID:${field}`);
    }
  }
  return {
    index: Number.isInteger(sample?.index) ? sample.index : null,
    valid: errors.length === 0,
    errors,
    navigationToBootReadyMs: Number.isFinite(timing?.navigationToBootReadyMs)
      ? timing.navigationToBootReadyMs
      : null,
    pageReadyToBootReadyMs: Number.isFinite(timing?.pageReadyToBootReadyMs)
      ? timing.pageReadyToBootReadyMs
      : null,
  };
}

export function summarizeCwsDashboardVisualFirstFrames(samples) {
  const projectedSamples = (Array.isArray(samples) ? samples : [])
    .map(projectCwsDashboardVisualFirstFrameSample);
  const validSamples = projectedSamples.filter((sample) => sample.valid);
  const invalidSampleCount = projectedSamples.length - validSamples.length;
  return {
    sampleCount: projectedSamples.length,
    sampleClass: projectedSamples.length >= CWS_DASHBOARD_VISUAL_SAMPLE_FLOOR
      ? 'threshold_candidate'
      : 'exploratory',
    thresholdSampleFloor: CWS_DASHBOARD_VISUAL_SAMPLE_FLOOR,
    thresholdEligible: projectedSamples.length >= CWS_DASHBOARD_VISUAL_SAMPLE_FLOOR
      && invalidSampleCount === 0,
    validSampleCount: validSamples.length,
    invalidSampleCount,
    navigationToBootReady: summarizeFiniteDurations(
      validSamples.map((sample) => sample.navigationToBootReadyMs),
    ),
    pageReadyToBootReady: summarizeFiniteDurations(
      validSamples.map((sample) => sample.pageReadyToBootReadyMs),
    ),
    samples: projectedSamples,
  };
}

export function projectCwsDashboardVisualEvidence(summary, {
  headless = true,
  graphicsMode = 'default',
  softwareRendererDetected = null,
} = {}) {
  const environmentClass = headless
    ? 'headless'
    : (
      graphicsMode === 'software_gl' || softwareRendererDetected === true
        ? 'headed_software'
        : (graphicsMode === 'default' && softwareRendererDetected === false
          ? 'headed_hardware'
          : 'headed_unclassified')
    );
  return {
    ...(summary && typeof summary === 'object' ? summary : {}),
    environment: {
      headless: headless === true,
      graphicsMode,
      softwareRendererDetected,
      class: environmentClass,
    },
    releaseThresholdEligible: summary?.thresholdEligible === true
      && environmentClass === 'headed_hardware',
  };
}

function findCorrelatedWarmMessage(messages, timing) {
  const warmSentAt = timing?.warmRequestSentAtEpochMs;
  const warmRespondedAt = timing?.warmResponseAtEpochMs;
  if (!Number.isFinite(warmSentAt) || !Number.isFinite(warmRespondedAt)) return null;
  return messages.slice(1).find((entry) => (
    entry?.action === MESSAGE_ACTIONS.GET_SETTINGS
    && Number.isFinite(entry?.arrivedAtEpochMs)
    && entry.arrivedAtEpochMs >= warmSentAt
    && entry.arrivedAtEpochMs <= warmRespondedAt
  )) || null;
}

export function isCwsWakeRuntimeTelemetrySettled(runtimeTelemetry) {
  if (runtimeTelemetry?.schemaVersion !== 1) return false;
  const messages = Array.isArray(runtimeTelemetry.messages) ? runtimeTelemetry.messages : [];
  const coldMessage = messages[0] || null;
  const laterSettingsResponse = messages.slice(1).find((entry) => (
    entry?.action === MESSAGE_ACTIONS.GET_SETTINGS
    && entry?.responseStatus !== 'pending'
  ));
  const responsesSettled = !!coldMessage
    && coldMessage.responseStatus !== 'pending'
    && !!laterSettingsResponse;
  const fullInitSettled = runtimeTelemetry.milestones?.full_init_ready
    || runtimeTelemetry.milestones?.full_init_failed;
  return responsesSettled && !!fullInitSettled;
}

export function projectCwsWakeRuntimeContract(sample) {
  const errors = [];
  const targetDiagnostics = sample?.workerDiagnostics?.targets?.find((target) => (
    target?.targetId === sample?.revivedTargetId
  )) || null;
  const runtimeTelemetry = targetDiagnostics?.runtimeTelemetry || null;
  const timing = sample?.timing || {};
  const milestones = runtimeTelemetry?.milestones && typeof runtimeTelemetry.milestones === 'object'
    ? runtimeTelemetry.milestones
    : {};
  const messages = Array.isArray(runtimeTelemetry?.messages)
    ? runtimeTelemetry.messages
    : [];
  const coldMessage = messages[0] || null;
  const warmMessage = findCorrelatedWarmMessage(messages, timing);

  if (runtimeTelemetry?.schemaVersion !== 1) errors.push('RUNTIME_SCHEMA_INVALID');
  if (typeof runtimeTelemetry?.generationId !== 'string') errors.push('RUNTIME_GENERATION_MISSING');
  if (runtimeTelemetry?.droppedMessageCount !== 0) errors.push('RUNTIME_MESSAGES_DROPPED');
  if (sample?.workerDiagnostics?.runtimeTelemetrySettled !== true) {
    errors.push('RUNTIME_TELEMETRY_NOT_SETTLED');
  }

  for (const milestoneName of CWS_WAKE_REQUIRED_READY_MILESTONES) {
    const milestone = milestones[milestoneName];
    if (
      milestone?.name !== milestoneName
      || milestone?.status !== 'ready'
      || !Number.isFinite(milestone?.atEpochMs)
    ) {
      errors.push(`MILESTONE_NOT_READY:${milestoneName}`);
    }
  }

  const validateMessage = (entry, {
    expectedSequence = null,
    wakeClass,
    label,
  }) => {
    if (!entry) {
      errors.push(`MESSAGE_MISSING:${label}`);
      return;
    }
    if (expectedSequence !== null && entry.sequence !== expectedSequence) {
      errors.push(`MESSAGE_SEQUENCE_INVALID:${label}`);
    }
    if (!Number.isInteger(entry.sequence) || entry.sequence < 1) {
      errors.push(`MESSAGE_SEQUENCE_INVALID:${label}`);
    }
    if (entry.wakeClass !== wakeClass) errors.push(`MESSAGE_WAKE_CLASS_INVALID:${label}`);
    if (entry.action !== MESSAGE_ACTIONS.GET_SETTINGS) {
      errors.push(`MESSAGE_ACTION_INVALID:${label}`);
    }
    if (entry.responseStatus !== 'responded' || entry.responseError !== null) {
      errors.push(`MESSAGE_RESPONSE_INVALID:${label}`);
    }
    if (
      !Number.isFinite(entry.arrivedAtEpochMs)
      || !Number.isFinite(entry.respondedAtEpochMs)
      || entry.respondedAtEpochMs < entry.arrivedAtEpochMs
    ) {
      errors.push(`MESSAGE_TIMING_INVALID:${label}`);
    }
  };
  validateMessage(coldMessage, {
    expectedSequence: 1,
    wakeClass: 'cold',
    label: 'cold',
  });
  validateMessage(warmMessage, {
    wakeClass: 'warm',
    label: 'warm',
  });

  const pageTimedPairOrder = [
    timing.requestSentAtEpochMs,
    timing.firstResponseAtEpochMs,
    timing.warmRequestSentAtEpochMs,
    timing.warmResponseAtEpochMs,
  ];
  if (
    !pageTimedPairOrder.every((value) => Number.isFinite(value))
    || pageTimedPairOrder.some((value, index) => (
      index > 0 && value < pageTimedPairOrder[index - 1]
    ))
  ) {
    errors.push('PAGE_TIMED_PAIR_ORDER_INVALID');
  }
  if (
    !Number.isFinite(timing.timedPairDispatchAtHostEpochMs)
    || !Number.isFinite(timing.targetObservedAtEpochMs)
    || !Number.isFinite(timing.timedPairCompletedAtHostEpochMs)
    || timing.targetObservedAtEpochMs < timing.timedPairDispatchAtHostEpochMs
    || timing.targetObservedAtEpochMs > timing.timedPairCompletedAtHostEpochMs
  ) {
    errors.push('HOST_TARGET_OBSERVATION_WINDOW_INVALID');
  }
  if (
    Number.isFinite(runtimeTelemetry?.telemetryInstalledAtEpochMs)
    && Number.isFinite(coldMessage?.arrivedAtEpochMs)
    && runtimeTelemetry.telemetryInstalledAtEpochMs > coldMessage.arrivedAtEpochMs
  ) {
    errors.push('INTERNAL_TELEMETRY_INSTALL_ORDER_INVALID');
  }
  if (
    Number.isFinite(timing.requestSentAtEpochMs)
    && Number.isFinite(coldMessage?.arrivedAtEpochMs)
    && timing.requestSentAtEpochMs > coldMessage.arrivedAtEpochMs
  ) {
    errors.push('COLD_MESSAGE_ARRIVAL_ORDER_INVALID');
  }
  if (
    Number.isFinite(coldMessage?.respondedAtEpochMs)
    && Number.isFinite(timing.firstResponseAtEpochMs)
    && coldMessage.respondedAtEpochMs > timing.firstResponseAtEpochMs
  ) {
    errors.push('COLD_MESSAGE_RESPONSE_ORDER_INVALID');
  }
  if (
    Number.isFinite(timing.warmRequestSentAtEpochMs)
    && Number.isFinite(warmMessage?.arrivedAtEpochMs)
    && timing.warmRequestSentAtEpochMs > warmMessage.arrivedAtEpochMs
  ) {
    errors.push('WARM_MESSAGE_ARRIVAL_ORDER_INVALID');
  }
  if (
    Number.isFinite(warmMessage?.respondedAtEpochMs)
    && Number.isFinite(timing.warmResponseAtEpochMs)
    && warmMessage.respondedAtEpochMs > timing.warmResponseAtEpochMs
  ) {
    errors.push('WARM_MESSAGE_RESPONSE_ORDER_INVALID');
  }
  if (
    !Number.isFinite(timing.diagnosticsAttachedAtEpochMs)
    || !Number.isFinite(timing.timedPairCompletedAtHostEpochMs)
    || timing.diagnosticsAttachedAtEpochMs < timing.timedPairCompletedAtHostEpochMs
  ) {
    errors.push('HOST_DIAGNOSTICS_PERTURBED_TIMED_PAIR');
  }

  return {
    valid: errors.length === 0,
    errors,
    generationId: runtimeTelemetry?.generationId || null,
    telemetryInstalledAtEpochMs: runtimeTelemetry?.telemetryInstalledAtEpochMs ?? null,
    milestones: Object.fromEntries(CWS_WAKE_REQUIRED_READY_MILESTONES.map((name) => [
      name,
      milestones[name] ? {
        atEpochMs: milestones[name].atEpochMs,
        sinceTelemetryInstallMs: milestones[name].sinceTelemetryInstallMs,
        status: milestones[name].status,
      } : null,
    ])),
    coldMessage: coldMessage ? {
      sequence: coldMessage.sequence,
      arrivedAtEpochMs: coldMessage.arrivedAtEpochMs,
      respondedAtEpochMs: coldMessage.respondedAtEpochMs,
      responseLatencyMs: coldMessage.responseLatencyMs,
      wakeClass: coldMessage.wakeClass,
    } : null,
    warmMessage: warmMessage ? {
      sequence: warmMessage.sequence,
      arrivedAtEpochMs: warmMessage.arrivedAtEpochMs,
      respondedAtEpochMs: warmMessage.respondedAtEpochMs,
      responseLatencyMs: warmMessage.responseLatencyMs,
      wakeClass: warmMessage.wakeClass,
    } : null,
  };
}
