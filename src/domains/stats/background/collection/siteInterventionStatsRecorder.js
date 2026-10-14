import { requireInterventionHistoryReceipt } from '../../contracts/interventionHistoryReceipt.js';

function normalizeHostname(hostname) {
  if (typeof hostname !== 'string') return '';
  return hostname.trim().toLowerCase();
}

function isStatsCollector(value) {
  return !!value && typeof value.recordDomainIntervention === 'function';
}

function isInterventionEffectRepository(value) {
  return !!value
    && typeof value.recordExposure === 'function'
    && typeof value.recordOutcome === 'function';
}

function isInterventionTelemetryAdmissionOwner(value) {
  return typeof value === 'function';
}

function normalizeExposureId(value) {
  if (typeof value !== 'string') return '';
  return value.trim();
}

function normalizeArtifactString(value) {
  if (typeof value !== 'string') return '';
  return value.trim();
}

function resolveEffectArtifactId(payload = {}) {
  const artifactId = normalizeArtifactString(payload.artifactId);
  if (artifactId) return artifactId;
  const rendererId = normalizeArtifactString(payload.rendererId);
  if (rendererId) return rendererId;
  return normalizeArtifactString(payload.gatekeeperInterstitialRendererId);
}

function requireEffectArtifactId(payload = {}) {
  const artifactId = resolveEffectArtifactId(payload);
  if (!artifactId || artifactId.toLowerCase() === 'unknown') {
    throw new Error('SITE_INTERVENTION_EFFECT_ARTIFACT_ID_REQUIRED');
  }
  return artifactId;
}

function buildEffectMetadataPayload(payload = {}) {
  return {
    interventionClass: payload.interventionClass,
    resistanceEligible: payload.resistanceEligible,
    effectivenessEligible: payload.effectivenessEligible,
    severity: payload.severity,
    holdDurationMs: payload.holdDurationMs,
    holdUntil: payload.holdUntil,
    levelRecipeVersion: payload.levelRecipeVersion,
    artifactVector: payload.artifactVector,
    strategyState: payload.strategyState,
    intensityVector: payload.intensityVector,
    outcomeReason: payload.outcomeReason || payload.decision || '',
  };
}

function buildExposurePayload(payload = {}) {
  const hostname = normalizeHostname(payload.hostname);
  const exposureId = normalizeExposureId(payload.exposureId || payload.sessionId);
  if (!hostname || !exposureId) throw new Error('SITE_INTERVENTION_EXPOSURE_ID_REQUIRED');
  const now = Number.isFinite(Number(payload.now)) ? Number(payload.now) : Date.now();
  const artifactId = requireEffectArtifactId(payload);
  return {
    exposureId,
    domain: hostname,
    shownAt: now,
    gateKind: payload.gateKind || '',
    artifactFamily: payload.artifactFamily || 'gate_interstitial',
    artifactId,
    themeId: payload.themeId || '',
    rendererId: normalizeArtifactString(payload.rendererId)
      || normalizeArtifactString(payload.gatekeeperInterstitialRendererId)
      || artifactId,
    level: payload.level ?? payload.planLevel ?? 0,
    activeChildIds: payload.activeChildIds,
    pressureSignals: payload.pressureSignals,
    directTriggers: payload.directTriggers,
    policyContextHash: payload.policyContextHash || '',
    ...buildEffectMetadataPayload(payload),
    outcome: 'shown',
  };
}

function buildOutcomePayload(payload = {}, outcome) {
  const hostname = normalizeHostname(payload.hostname);
  const exposureId = normalizeExposureId(payload.exposureId || payload.sessionId);
  if (!exposureId) throw new Error('SITE_INTERVENTION_EXPOSURE_ID_REQUIRED');
  const now = Number.isFinite(Number(payload.now)) ? Number(payload.now) : Date.now();
  const artifactId = requireEffectArtifactId(payload);
  return {
    exposureId,
    domain: hostname,
    shownAt: Number.isFinite(Number(payload.shownAt)) ? Number(payload.shownAt) : now,
    gateKind: payload.gateKind || '',
    artifactFamily: payload.artifactFamily || 'gate_interstitial',
    artifactId,
    themeId: payload.themeId || '',
    rendererId: normalizeArtifactString(payload.rendererId)
      || normalizeArtifactString(payload.gatekeeperInterstitialRendererId)
      || artifactId,
    level: payload.level ?? payload.planLevel ?? 0,
    activeChildIds: payload.activeChildIds,
    pressureSignals: payload.pressureSignals,
    directTriggers: payload.directTriggers,
    policyContextHash: payload.policyContextHash || '',
    ...buildEffectMetadataPayload(payload),
    outcome,
    now,
    reenteredWithin5m: payload.reenteredWithin5m === true,
    reenteredWithin30m: payload.reenteredWithin30m === true,
  };
}

export function createSiteInterventionStatsRecorder({
  statsCollector,
  interventionEffectRepository,
  isInterventionTelemetryAdmitted,
} = {}) {
  if (!isStatsCollector(statsCollector)) {
    throw new Error('SITE_INTERVENTION_STATS_RECORDER_COLLECTOR_REQUIRED');
  }
  if (!isInterventionEffectRepository(interventionEffectRepository)) {
    throw new Error('SITE_INTERVENTION_EFFECT_REPOSITORY_REQUIRED');
  }
  if (!isInterventionTelemetryAdmissionOwner(isInterventionTelemetryAdmitted)) {
    throw new Error('SITE_INTERVENTION_TELEMETRY_ADMISSION_OWNER_REQUIRED');
  }

  function resolveAdmittedPayload(payload = {}) {
    const hostname = normalizeHostname(payload.hostname);
    if (!hostname) return null;
    if (!isInterventionTelemetryAdmitted(hostname)) return null;
    return {
      ...payload,
      hostname,
    };
  }

  function recordGateEvent(exposure, event) {
    const fact = exposure?.historyFacts?.[event];
    if (!fact) throw new Error('SITE_INTERVENTION_HISTORY_FACT_REQUIRED');
    const receipt = requireInterventionHistoryReceipt({
      exposureId: exposure.exposureId, hostname: exposure.domain, event,
      at: fact.at, shownAt: fact.shownAt, dateStr: fact.dateStr, bucketStartTs: fact.bucketStartTs,
    });
    return statsCollector.recordDomainIntervention({
      hostname: receipt.hostname, type: event, now: receipt.at, shownAt: receipt.shownAt,
      interventionReceipt: receipt,
    });
  }

  function recordExposure(payload = {}) {
    return Promise.resolve().then(() => {
      const exposure = buildExposurePayload(payload);
      return interventionEffectRepository.recordExposure(exposure);
    });
  }

  function recordOutcome(payload = {}, outcome) {
    return Promise.resolve().then(() => {
      const nextOutcome = buildOutcomePayload(payload, outcome);
      return interventionEffectRepository.recordOutcome(nextOutcome);
    });
  }

  return {
    recordGateShown(payload = {}) {
      const admittedPayload = resolveAdmittedPayload(payload);
      if (!admittedPayload) return Promise.resolve(false);
      const { now = Date.now() } = admittedPayload;
      return recordExposure({ ...admittedPayload, now })
        .then(exposure => recordGateEvent(exposure, 'shown'));
    },
    recordGateDecision(payload = {}) {
      const admittedPayload = resolveAdmittedPayload(payload);
      if (!admittedPayload) return Promise.resolve(false);
      const { decision, now = Date.now() } = admittedPayload;
      const normalizedDecision = decision === 'leave' ? 'left' : 'continued';
      return recordOutcome({ ...admittedPayload, now }, normalizedDecision)
        .then(exposure => recordGateEvent(exposure, normalizedDecision));
    },
    recordGateReentry(payload = {}) {
      const admittedPayload = resolveAdmittedPayload(payload);
      if (!admittedPayload) return Promise.resolve(false);
      const { now = Date.now(), shownAt = null } = admittedPayload;
      const elapsed = Number.isFinite(Number(shownAt)) ? Number(now) - Number(shownAt) : 0;
      return recordOutcome({
        ...admittedPayload,
        now,
        reenteredWithin5m: elapsed > 0 && elapsed <= 5 * 60 * 1000,
        reenteredWithin30m: elapsed > 0 && elapsed <= 30 * 60 * 1000,
      }, 'reentered')
        .then(exposure => recordGateEvent(exposure, 'reentered'));
    },
    recordGateEscape(payload = {}) {
      const admittedPayload = resolveAdmittedPayload(payload);
      if (!admittedPayload) return Promise.resolve(false);
      const { now = Date.now() } = admittedPayload;
      return recordOutcome({ ...admittedPayload, now }, 'escape_closed')
        .then(exposure => recordGateEvent(exposure, 'escape_closed'));
    },
  };
}
