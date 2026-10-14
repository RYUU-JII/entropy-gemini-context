import fs from 'node:fs';
import path from 'node:path';
import { classifyEntropyAttachedPageExecution } from './attachOnlyActivePageAdapter.mjs';

import {
  createBrowserExecutionEnvironment,
} from '../../browser-qa/contracts/browserExecutionContract.mjs';
import {
  QA_RUN_STATUSES,
} from '../contracts/qaTargetContract.mjs';
import {
  FEED_TEMPO_DWELL_BUCKET_UPPER_BOUNDS_MS,
  FEED_TEMPO_DWELL_DISTRIBUTION_SEMANTICS,
  FEED_TEMPO_DWELL_DISTRIBUTION_VERSION,
  FEED_TEMPO_DWELL_RETENTION_STRATEGY,
  FEED_TEMPO_RAPID_DWELL_THRESHOLD_MS,
  FEED_TEMPO_SNAPSHOT_VERSION,
  FEED_TEMPO_STATES,
} from '../../../src/domains/nudge/feed-flow/tempo/feedTempoContracts.js';
const OUTPUT_MARKERS = Object.freeze([
  'READY_FOR_HUMAN',
  'HUMAN_OBSERVATION_PROGRESS',
  'HUMAN_INSPECTION_ENDED',
  'AGENT_CANARY_COMPLETE',
  'AGENT_GATE_COMPLETE',
  'AGENT_INSPECTION_GATE_COMPLETE',
  'AGENT_PAGE_BLOCKED',
  'AGENT_HORIZON_CAPTURED',
  'AGENT_HORIZON_CAPTURE_EXECUTION',
  'AGENT_CAPTURE_UNAVAILABLE',
  'AGENT_EXECUTION_OBSERVED',
  'AGENT_EXECUTION_UNAVAILABLE',
]);

const AGENT_BOUNDARY_EVIDENCE_PHASES = new Set([
  'boundary_reached',
  'still_hold',
  'renewed_demand_ready',
]);

const AGENT_HOLD_COMPLETE_EVIDENCE_PHASES = new Set([
  'boundary_reached',
  'renewed_demand_ready',
]);

function hasAgentCompletionPhaseSequence(phases) {
  return Array.isArray(phases)
    && phases.length === 3
    && AGENT_BOUNDARY_EVIDENCE_PHASES.has(phases[0])
    && AGENT_HOLD_COMPLETE_EVIDENCE_PHASES.has(phases[1])
    && phases[2] === 'enso_would_open';
}

// Manual inspection proves an owned endpoint/gesture lifecycle. Its admission
// deliberately bypasses cadence, so historical tempo is not an acceptance input.
export function hasManualInspectionEvidence(value, { surfaceMode, holdMs, handoffMode }) {
  const inspection = value?.inspection;
  const lease = value?.lease;
  const nonempty = (text) => typeof text === 'string' && text.trim().length > 0;
  const positiveTime = (at) => Number.isSafeInteger(at) && at > 0;
  return value?.version === 1 && value.surfaceMode === surfaceMode
    && Number.isSafeInteger(value.confirmedAdvanceCount) && value.confirmedAdvanceCount > 0
    && value.admission?.status === 'admitted' && value.admission?.admitted === true
    && inspection?.version === 2 && inspection.active === true
    && inspection.source === 'runtime_debugger_full_chain'
    && Number.isSafeInteger(inspection.cycleId) && inspection.cycleId > 0
    && inspection.handoffMode === handoffMode && inspection.stillGateMs === holdMs
    && inspection.endpointReady === true && inspection.boundaryReached === true
    && inspection.holdRemainingMs === 0 && inspection.finishedReason === null
    && positiveTime(inspection.startedAt) && positiveTime(inspection.boundaryReachedAt)
    && inspection.boundaryReachedAt >= inspection.startedAt
    && (handoffMode === 'feedback_only'
      ? inspection.phase === 'enso_would_open' && positiveTime(inspection.feedbackPresentedAt)
        && inspection.feedbackPresentedAt >= inspection.boundaryReachedAt + holdMs
      : handoffMode === 'production' && inspection.feedbackPresentedAt === 0
        && AGENT_HOLD_COMPLETE_EVIDENCE_PHASES.has(inspection.phase))
    && lease?.kind === 'enso_gate' && lease.manual === true
    && Number.isSafeInteger(lease.tabId) && lease.tabId >= 0
    && nonempty(lease.documentId) && nonempty(lease.leaseId)
    && positiveTime(lease.observedAt) && positiveTime(lease.reservedUntil)
    && lease.reservedUntil > lease.observedAt;
}

// The measured grain differs by surface mode and the two are not
// interchangeable. `resolveFeedTempoMetricGrain` keys a continuous profile as
// `continuous_session_screenfuls`, and `applyEpisodeToProfile` builds its
// baseline from `screenfulsConsumed` without ever reading `dwellSamplesMs`;
// `ContinuousAdvanceAdapter` correspondingly emits `itemTransitionCount: 0` and
// `dwellMs: null`. A continuous surface therefore reports zero dwell by design.
// Demanding dwell from both modes is what pressured the runtime into
// manufacturing dwell samples nothing on that path consumes, so assert each
// grain on its own evidence -- and assert the continuous zero explicitly, so a
// future change cannot quietly refill dwell on a surface with no item to dwell on.
export function hasAgentTempoMeasurementEvidence(
  tempo,
  requestedDwellMs,
  surfaceMode,
  { requireCompleteRetention = true } = {},
) {
  const measurement = tempo?.measurement;
  const counters = tempo?.trajectory?.counters;
  const retention = measurement?.retention;
  const censoring = measurement?.censoring;
  const eligibility = measurement?.dwellEligibility;
  const distribution = measurement?.dwellDistribution;
  const eligibleDwellCount = Number(measurement?.eligibleDwellCount);
  const trajectoryEligibleDwellCount = Number(counters?.eligibleDwellCount);
  const retainedCount = Number(retention?.retainedCount);
  const droppedCount = Number(retention?.droppedCount);
  const retentionCapacity = Number(retention?.capacity);
  const totalActiveDwellMs = Number(measurement?.totalActiveDwellMs);
  const retainedActiveDwellMs = Number(measurement?.retainedActiveDwellMs);
  const rapidDwellCount = Number(measurement?.rapidDwellCount);
  const rapidDwellShare = Number(measurement?.rapidDwellShare);
  const censoringTotal = [
    censoring?.belowMinimumCount,
    censoring?.aboveMaximumCount,
    censoring?.multiTransitionCount,
    censoring?.trailingCount,
  ].reduce((total, value) => total + Number(value), 0);
  const distributionCounts = distribution?.counts;
  const distributionTotal = Array.isArray(distributionCounts)
    ? distributionCounts.reduce((total, value) => total + Number(value), 0)
      + Number(distribution?.overflowCount)
    : Number.NaN;
  const expectedRapidShare = eligibleDwellCount > 0
    ? rapidDwellCount / eligibleDwellCount
    : 0;
  const expectedCoverage = eligibleDwellCount > 0
    ? retainedCount / eligibleDwellCount
    : 0;
  const expectedRetainedCount = Number.isSafeInteger(retentionCapacity)
    ? Math.min(eligibleDwellCount, retentionCapacity)
    : Number.NaN;
  const sharedEvidence = (
    tempo?.version === FEED_TEMPO_SNAPSHOT_VERSION
    && tempo?.mode === 'observe_only'
    && tempo?.persistence === 'indexeddb_checkpoint'
    && tempo?.checkpoint?.failure === null
    && tempo?.measurementSource !== null
    // The grain the runtime actually measured must be the grain the run asked
    // for. A mismatch here is the defect the split is guarding against.
    && tempo?.trajectory?.surface?.surfaceMode === surfaceMode
    && Number.isSafeInteger(trajectoryEligibleDwellCount)
    && trajectoryEligibleDwellCount >= 0
    && Number.isSafeInteger(Number(counters?.droppedDwellCount))
    && Number(counters?.droppedDwellCount) >= 0
    && Number.isSafeInteger(eligibleDwellCount)
    && eligibleDwellCount >= 0
    && eligibility?.minimumInclusiveMs <= requestedDwellMs
    && eligibility?.maximumInclusiveMs >= requestedDwellMs
    && retention?.strategy === FEED_TEMPO_DWELL_RETENTION_STRATEGY
    && Number.isSafeInteger(retentionCapacity)
    && retentionCapacity >= 1
    && Number.isSafeInteger(retainedCount)
    && retainedCount >= 0
    && Number.isSafeInteger(droppedCount)
    && droppedCount >= 0
    && retainedCount === expectedRetainedCount
    && retainedCount + droppedCount === eligibleDwellCount
    && trajectoryEligibleDwellCount === eligibleDwellCount
    && Number(counters?.droppedDwellCount) === droppedCount
    && Math.abs(Number(retention?.coverageRatio) - expectedCoverage) <= 1e-9
    && (
      droppedCount === 0
        ? retainedActiveDwellMs === totalActiveDwellMs
        : retainedActiveDwellMs < totalActiveDwellMs
    )
    && (
      !requireCompleteRetention
      || (
        droppedCount === 0
        && (
          eligibleDwellCount === 0
          || Number(retention?.coverageRatio) === 1
        )
      )
    )
    && measurement?.rapidDwellThresholdMs === FEED_TEMPO_RAPID_DWELL_THRESHOLD_MS
    && Number.isSafeInteger(rapidDwellCount)
    && rapidDwellCount >= 0
    && rapidDwellCount <= eligibleDwellCount
    && Math.abs(rapidDwellShare - expectedRapidShare) <= 1e-9
    && Number(measurement?.censoredDwellCount) === censoringTotal
    && distribution?.version === FEED_TEMPO_DWELL_DISTRIBUTION_VERSION
    && distribution?.bucketSemantics === FEED_TEMPO_DWELL_DISTRIBUTION_SEMANTICS
    && Array.isArray(distribution?.exclusiveUpperBoundsMs)
    && distribution.exclusiveUpperBoundsMs.length
      === FEED_TEMPO_DWELL_BUCKET_UPPER_BOUNDS_MS.length
    && distribution.exclusiveUpperBoundsMs.every(
      (value, index) => value === FEED_TEMPO_DWELL_BUCKET_UPPER_BOUNDS_MS[index],
    )
    && distribution.exclusiveUpperBoundsMs.length === distributionCounts?.length
    && distributionTotal === eligibleDwellCount
  );
  if (!sharedEvidence) return false;
  if (surfaceMode === 'continuous') {
    // Screenful grain: confirmed advances carry the measurement, and every dwell
    // aggregate must still be sitting at zero.
    return (
      tempo?.trajectory?.state === FEED_TEMPO_STATES.MEASURED
      && Number.isSafeInteger(Number(counters?.confirmedAdvanceCount))
      && Number(counters.confirmedAdvanceCount) >= 1
      && eligibleDwellCount === 0
      && trajectoryEligibleDwellCount === 0
      && totalActiveDwellMs === 0
      && rapidDwellCount === 0
      && distributionTotal === 0
    );
  }
  // Item grain: dwell is the measurement. Long natural-gate runs may overflow
  // the ordered tail, so whole-episode aggregates remain authoritative while
  // the retained window stays non-empty and internally consistent.
  return (
    trajectoryEligibleDwellCount >= 1
    && eligibleDwellCount >= 1
    && retainedCount >= 1
    && retainedActiveDwellMs > 0
    && totalActiveDwellMs > 0
  );
}

// A gate run is only evidence if the judge reached the horizon by itself. The
// endpoint-driven targets prove the terminus; this proves the sensing profile and
// the seam stage on a real surface, which nothing else in the catalogue does.
export function hasNaturalGateEvidence(tempo, gateObservation) {
  if (!gateObservation || typeof gateObservation !== 'object') return false;
  const readMs = (value) => (
    typeof value === 'number' && Number.isFinite(value) ? value : Number.NaN
  );
  const armedAtMs = readMs(gateObservation.armedAtMs);
  const opportunityAtMs = readMs(gateObservation.opportunityAtMs);
  const interruptAtMs = readMs(gateObservation.interruptAtMs);
  const admittedAtMs = readMs(gateObservation.admittedAtMs);
  const endpointCommittedAtMs = readMs(gateObservation.endpointCommittedAtMs);
  const seamWaitMs = readMs(gateObservation.seamWaitMs);
  const seamHardLimitMs = readMs(gateObservation.seamHardLimitMs);
  return (
    Number.isFinite(armedAtMs)
    && Number.isFinite(opportunityAtMs)
    && Number.isFinite(interruptAtMs)
    // The horizon must not precede the eligibility that authorises it.
    && interruptAtMs >= armedAtMs
    && opportunityAtMs >= armedAtMs
    && Number.isFinite(admittedAtMs)
    && admittedAtMs >= opportunityAtMs
    && Number.isFinite(endpointCommittedAtMs)
    && endpointCommittedAtMs >= admittedAtMs
    && Number.isFinite(seamWaitMs)
    && seamWaitMs >= 0
    && Number.isFinite(seamHardLimitMs)
    && seamHardLimitMs > 0
    // Landing on a seam rather than running the wait out is the whole point of
    // the second stage: a `seam_wait_exhausted` run means it found no moment and
    // fell back to a stopwatch, which is the outcome the stage exists to avoid.
    && gateObservation.seamDecision === 'seam_reached'
    && gateObservation.finalSeam?.fire === true
    && gateObservation.finalSeam?.decision === gateObservation.seamDecision
    && gateObservation.finalSeam?.waitedMs === seamWaitMs
    && gateObservation.finalSeam?.hardLimitMs === seamHardLimitMs
    && seamWaitMs < seamHardLimitMs
    && gateObservation.finalState === 'interrupt'
    && gateObservation.finalOpportunityReady === true
    // Consumption has to have actually happened on the surface under test.
    && Number(gateObservation.stepCount) > 0
    && Number(tempo?.trajectory?.counters?.confirmedAdvanceCount) > 0
  );
}

export function hasAgentPageBlockerEvidence(marker) {
  const evidence = marker?.evidence;
  if (evidence?.schemaVersion === 2) {
    const requiredFlag = {
      login_surface: 'authSurface', captcha: 'captchaSurface',
      two_factor: 'twoFactorSurface', consent_takeover: 'consentSurface',
    }[marker?.reason];
    return marker?.status === 'AGENT_PAGE_BLOCKED' && marker.outcome === 'BLOCKED'
      && evidence.stage === 'site_readiness' && typeof requiredFlag === 'string'
      && evidence[requiredFlag] === true;
  }
  const dialogCountBefore = Number(evidence?.renderedDialogCountBefore);
  const dialogCountAfter = Number(evidence?.renderedDialogCountAfter);
  const targetIntercepted = (
    evidence?.hitInsideTargetBefore === false
    && evidence?.hitInsideTargetAfter === false
  );
  const scrollLockObserved = (
    evidence?.rootOverflowLocked === true
    || evidence?.htmlOverflowLocked === true
    || evidence?.bodyOverflowLocked === true
    || evidence?.bodyPositionFixed === true
  );
  return (
    marker?.status === 'AGENT_PAGE_BLOCKED'
    && marker?.outcome === 'BLOCKED'
    && marker?.reason === 'rendered_dialog_blocks_trusted_feed_scroll'
    && evidence?.schemaVersion === 1
    && evidence?.trustedInput === true
    && evidence?.inputKind === 'wheel'
    && evidence?.direction === 'forward'
    && evidence?.opportunityState === 'armed_idle'
    && evidence?.targetAvailable === true
    && evidence?.targetVisible === true
    && evidence?.rootDelta === 0
    && evidence?.scrollOwnerCandidateDelta === 0
    && evidence?.scrollOwnerCandidateComparable === true
    && (evidence?.scrollOwnerCandidateKind === 'root'
      || evidence?.scrollOwnerCandidateKind === 'element')
    && Number.isSafeInteger(dialogCountBefore)
    && dialogCountBefore >= 1
    && dialogCountBefore <= 20
    && Number.isSafeInteger(dialogCountAfter)
    && dialogCountAfter >= 1
    && dialogCountAfter <= 20
    && (targetIntercepted || scrollLockObserved)
  );
}

const PRODUCTION_CAUSAL_CHECKS = Object.freeze([
  'horizonReached',
  'nativeEndpointOwned',
  'demandCaptureReady',
  'renewedDemandOpenedGate',
  'neutralKeptHorizon',
  'neutralEndpointIntact',
  'backwardTrustedInputPerformed',
  'backwardNativeScrollerMoved',
  'backwardEndpointStateKept',
  'backwardEndpointMorphologyKept',
  'backwardAdvanceCountUnchanged',
  'backwardNavigationKeptEndpoint',
]);

function hasGatePhysicalCausalEvidence(completionEvidence) {
  const checks = completionEvidence?.causalChain?.checks;
  const backward = completionEvidence?.causalChain?.backwardNavigation;
  return (
    completionEvidence?.outcome === 'PASS'
    && completionEvidence?.finalManagerState === 'HORIZON'
    && completionEvidence?.endpointLeaseState === 'committed'
    && completionEvidence?.boundaryReached === true
    && completionEvidence?.causalChain?.reason
      === 'horizon_veil_neutral_backward_navigation_chain_confirmed'
    && Number(completionEvidence?.causalChain?.actionCount) > 0
    && checks && typeof checks === 'object'
    && PRODUCTION_CAUSAL_CHECKS.every((name) => checks[name] === true)
    && backward?.direction === 'backward'
    && backward?.status === 'performed'
    && backward?.trustedInput === true
    && backward?.inputKind === 'wheel'
    && backward?.oracleRecoveryUsed === false
    && typeof backward?.beforeScrollTop === 'number'
    && Number.isFinite(backward.beforeScrollTop)
    && typeof backward?.afterScrollTop === 'number'
    && Number.isFinite(backward.afterScrollTop)
    && backward.afterScrollTop < backward.beforeScrollTop - 1
    && Number.isSafeInteger(backward?.beforeAdvanceCount)
    && Number.isSafeInteger(backward?.afterAdvanceCount)
    && backward.afterAdvanceCount === backward.beforeAdvanceCount
  );
}

export function hasProductionGateCausalEvidence(completionEvidence) {
  return completionEvidence?.productionGateCount === 1
    && completionEvidence?.inspectionActive === false
    && completionEvidence?.admissionMode !== 'manual'
    && completionEvidence?.timingPolicyEvaluated !== false
    && Number(completionEvidence?.causalChain?.measuredTransitionCount) > 0
    && hasGatePhysicalCausalEvidence(completionEvidence);
}

export function hasManualGateCausalEvidence(completionEvidence, expected) {
  return completionEvidence?.admissionMode === 'manual'
    && completionEvidence?.timingPolicyEvaluated === false
    && completionEvidence?.actualGateCount === 1
    && completionEvidence?.productionGateCount === 0
    && hasManualInspectionEvidence(completionEvidence.inspectionEvidence, {
      ...expected, handoffMode: 'production',
    })
    && hasGatePhysicalCausalEvidence(completionEvidence);
}

function closeTranscriptStream(stream) {
  if (stream.closed) return Promise.resolve();
  return new Promise((resolve) => {
    stream.once('close', resolve);
    stream.end();
  });
}

export function hasAgentCaptureUnavailableEvidence(payload) {
  const evidence = payload?.evidence;
  if (payload?.status !== 'AGENT_CAPTURE_UNAVAILABLE' || evidence?.schemaVersion !== 1
    || !['before-arm', 'ready-to-arm', 'rest', 'gate'].includes(evidence.phase)
    || payload.outcome !== (evidence.phase === 'before-arm' ? 'BLOCKED' : 'INCONCLUSIVE')) return false;
  const reason = classifyEntropyAttachedPageExecution(evidence.execution, 'document');
  return reason !== 'ready' && reason === evidence.reason;
}

export function hasAgentExecutionUnavailableEvidence(payload, expectedObservation) {
  const evidence = payload?.evidence;
  if (payload?.status !== 'AGENT_EXECUTION_UNAVAILABLE' || evidence?.schemaVersion !== 1
    || !['before-arm', 'completion', 'gate'].includes(evidence.phase)
    || !['document', 'animation', 'foreground'].includes(expectedObservation)
    || evidence.observation !== expectedObservation
    || payload.outcome !== (evidence.phase === 'before-arm' ? 'BLOCKED' : 'INCONCLUSIVE')) return false;
  try {
    const reason = classifyEntropyAttachedPageExecution(evidence.execution, expectedObservation);
    return reason !== 'ready' && reason === evidence.reason;
  } catch (error) {
    if (error.message === 'QA_ATTACH_EXECUTION_OBSERVATION_INVALID') return false;
    throw error;
  }
}

export async function executeQaProtocol(context) {
  const {
    plan,
    artifact,
    browser,
    evidence,
    runChild,
  } = context;
  if (artifact?.id !== 'dev_extension' || artifact?.releaseProfile !== 'dev') {
    throw new Error('QA_FEED_DEV_ARTIFACT_REQUIRED');
  }
  if (browser?.processOwnership !== 'attach_only' || !browser.cdpEndpoint) {
    throw new Error('QA_FEED_ATTACH_ONLY_BROWSER_REQUIRED');
  }
  const gateMode = plan.protocolOptions.gateMode;
  if (gateMode !== undefined && gateMode !== null && gateMode !== 'manual_handoff') {
    throw new Error('QA_FEED_GATE_MODE_INVALID');
  }
  const manualGateExpected = gateMode === 'manual_handoff';
  if (manualGateExpected && (plan.mode !== 'agent' || (plan.parameters.gateDriveMs ?? 0) > 0)) {
    throw new Error('QA_FEED_MANUAL_GATE_MODE_CONFLICT');
  }
  const markerEvents = [];
  const seenMarkers = new Set();
  const markerPayloads = new Map();
  let stdoutBuffer = '';
  const stdoutPath = path.join(context.attachmentsDir, 'feed-inspection.stdout.log');
  const stderrPath = path.join(context.attachmentsDir, 'feed-inspection.stderr.log');
  const stdoutStream = fs.createWriteStream(stdoutPath, { encoding: 'utf8' });
  const stderrStream = fs.createWriteStream(stderrPath, { encoding: 'utf8' });
  const transcriptErrors = [];
  stdoutStream.on('error', (error) => transcriptErrors.push(error));
  stderrStream.on('error', (error) => transcriptErrors.push(error));
  const queueMarkerEvent = (payload) => {
    markerEvents.push(
      evidence.event('QA_FEED_PHASE_OBSERVED', payload).then(
        () => null,
        (error) => error,
      ),
    );
  };
  const observeLine = (line) => {
    const trimmed = line.trim();
    if (!trimmed.startsWith('{') || !trimmed.endsWith('}')) return;
    let payload;
    try {
      payload = JSON.parse(trimmed);
    } catch {
      return;
    }
    if (!OUTPUT_MARKERS.includes(payload?.status)) return;
    markerPayloads.set(payload.status, payload);
    if (!seenMarkers.has(payload.status)) {
      seenMarkers.add(payload.status);
      queueMarkerEvent({
        phase: payload.status,
        payload,
      });
    }
  };
  const observeOutput = (chunk) => {
    stdoutStream.write(chunk);
    stdoutBuffer += chunk;
    const lines = stdoutBuffer.split(/\r?\n/u);
    stdoutBuffer = lines.pop() || '';
    lines.forEach(observeLine);
  };
  const productionGateExpected = (
    plan.mode === 'agent'
    && (plan.parameters.gateDriveMs ?? 0) > 0
  );
  try {
    await runChild({
      command: process.execPath,
      args: [
        path.join(plan.rootDir, 'scripts/e2e/feedHorizonInspectionE2E.mjs'),
        `--mode=${plan.mode}`,
        `--site=${plan.protocolOptions.siteId}`,
        `--profile=${browser.profile}`,
        `--profile-directory=${browser.profileDirectory}`,
        `--chrome=${browser.chrome}`,
        `--cdp-endpoint=${browser.cdpEndpoint}`,
        `--profile-slot-id=${browser.profileSlotId}`,
        `--extension-slot-admission=${browser.extensionSlotAdmission}`,
        `--artifact-id=${artifact.id}`,
        `--artifact-input-digest=${artifact.inputDigest}`,
        `--artifact-build-id=${artifact.buildId}`,
        `--artifact-release-profile=${artifact.releaseProfile}`,
        '--no-build',
        `--diagnostic-dist=${artifact.path}`,
        ...(Object.hasOwn(plan.parameters, 'holdMs')
          ? [`--still-gate-ms=${plan.parameters.holdMs}`]
          : []),
        `--dwell-ms=${plan.parameters.dwellMs}`,
        ...(plan.browserObservation == null ? [] : [`--browser-observation=${plan.browserObservation}`]),
        ...(manualGateExpected ? ['--inspection-gate'] : []),
        ...(plan.parameters.requireVideo === true ? ['--require-video'] : []),
        ...(plan.parameters.captureScreenshots === true
          ? [`--capture-dir=${context.attachmentsDir}`]
          : []),
        ...(productionGateExpected
          ? [`--gate-drive-ms=${plan.parameters.gateDriveMs}`]
          : []),
      ],
      env: {
        ...process.env,
        ...browser.launchEnvironment,
        ...createBrowserExecutionEnvironment(plan.browserExecution),
        QA_BROWSER_RENDERING_REQUIREMENT: plan.browserExecution.renderingRequirement,
      },
      onStdout: observeOutput,
      onStderr: (chunk) => stderrStream.write(chunk),
    });
  } finally {
    if (stdoutBuffer) observeLine(stdoutBuffer);
    await Promise.all([
      closeTranscriptStream(stdoutStream),
      closeTranscriptStream(stderrStream),
    ]);
    const markerEventErrors = (await Promise.all(markerEvents)).filter(Boolean);
    const finalizationErrors = [...transcriptErrors, ...markerEventErrors];
    if (finalizationErrors.length > 0) {
      throw new AggregateError(
        finalizationErrors,
        `QA_FEED_TRANSCRIPT_FINALIZATION_FAILED:${finalizationErrors.length}`,
      );
    }
  }
  const executionUnavailableEvidence = markerPayloads.get('AGENT_EXECUTION_UNAVAILABLE');
  if (executionUnavailableEvidence) {
    if (plan.mode !== 'agent'
      || (executionUnavailableEvidence.evidence?.phase === 'gate' && !manualGateExpected)
      || ['READY_FOR_HUMAN', 'AGENT_CANARY_COMPLETE', 'AGENT_GATE_COMPLETE',
        'AGENT_INSPECTION_GATE_COMPLETE', 'AGENT_PAGE_BLOCKED', 'AGENT_CAPTURE_UNAVAILABLE']
        .some((marker) => seenMarkers.has(marker))
      || !hasAgentExecutionUnavailableEvidence(executionUnavailableEvidence, plan.browserObservation)) {
      throw new Error('QA_FEED_EXECUTION_UNAVAILABLE_CONTRACT_INVALID');
    }
    return Object.freeze({
      status: executionUnavailableEvidence.outcome,
      protocol: 'feed_horizon', siteId: plan.protocolOptions.siteId,
      surfaceMode: plan.protocolOptions.surfaceMode,
      observedPhases: Object.freeze([...seenMarkers]), executionUnavailableEvidence,
      completionEvidence: null, humanTerminalEvidence: null,
      transcript: Object.freeze({ stdoutPath, stderrPath }),
      productionGateExpected, manualGateExpected, browserProcessPreserved: true,
    });
  }
  const captureUnavailableEvidence = markerPayloads.get('AGENT_CAPTURE_UNAVAILABLE');
  if (captureUnavailableEvidence) {
    if (plan.mode !== 'agent' || plan.parameters.captureScreenshots !== true
      || (captureUnavailableEvidence.evidence?.phase === 'gate' && !manualGateExpected)
      || seenMarkers.has('AGENT_CANARY_COMPLETE') || seenMarkers.has('AGENT_GATE_COMPLETE')
      || seenMarkers.has('AGENT_INSPECTION_GATE_COMPLETE')
      || seenMarkers.has('AGENT_PAGE_BLOCKED')
      || !hasAgentCaptureUnavailableEvidence(captureUnavailableEvidence)) {
      throw new Error('QA_FEED_CAPTURE_UNAVAILABLE_CONTRACT_INVALID');
    }
    return Object.freeze({
      status: captureUnavailableEvidence.outcome,
      protocol: 'feed_horizon', siteId: plan.protocolOptions.siteId,
      surfaceMode: plan.protocolOptions.surfaceMode,
      observedPhases: Object.freeze([...seenMarkers]), captureUnavailableEvidence,
      completionEvidence: null, humanTerminalEvidence: null,
      transcript: Object.freeze({ stdoutPath, stderrPath }),
      productionGateExpected, manualGateExpected, browserProcessPreserved: true,
    });
  }
  const pageBlockerEvidence = markerPayloads.get('AGENT_PAGE_BLOCKED') || null;
  if (pageBlockerEvidence) {
    if (
      plan.mode !== 'agent'
      || seenMarkers.has('AGENT_CANARY_COMPLETE')
      || seenMarkers.has('AGENT_GATE_COMPLETE')
      || seenMarkers.has('AGENT_INSPECTION_GATE_COMPLETE')
      || !hasAgentPageBlockerEvidence(pageBlockerEvidence)
    ) {
      throw new Error('QA_FEED_AGENT_PAGE_BLOCKER_CONTRACT_INVALID');
    }
    return Object.freeze({
      status: QA_RUN_STATUSES.BLOCKED,
      protocol: 'feed_horizon',
      siteId: plan.protocolOptions.siteId,
      surfaceMode: plan.protocolOptions.surfaceMode,
      observedPhases: Object.freeze([...seenMarkers]),
      pageBlockerEvidence,
      completionEvidence: null,
      humanTerminalEvidence: null,
      transcript: Object.freeze({
        stdoutPath,
        stderrPath,
      }),
      productionGateExpected,
      manualGateExpected,
      browserProcessPreserved: true,
    });
  }
  const completionMarkerName = plan.mode === 'human'
    ? 'READY_FOR_HUMAN'
    : manualGateExpected
      ? 'AGENT_INSPECTION_GATE_COMPLETE'
      : productionGateExpected
      ? 'AGENT_GATE_COMPLETE'
      : 'AGENT_CANARY_COMPLETE';
  const completionMarker = seenMarkers.has(completionMarkerName);
  if (!completionMarker) {
    throw new Error(`QA_FEED_COMPLETION_EVIDENCE_MISSING:${plan.mode}`);
  }
  if (['READY_FOR_HUMAN', 'AGENT_CANARY_COMPLETE', 'AGENT_GATE_COMPLETE', 'AGENT_INSPECTION_GATE_COMPLETE']
    .some((marker) => marker !== completionMarkerName && seenMarkers.has(marker))) {
    throw new Error('QA_FEED_COMPLETION_MODE_CONFLICT');
  }
  const completionEvidence = markerPayloads.get(completionMarkerName) || null;
  if (
    plan.mode === 'human'
    && (
      completionEvidence?.productionGateCount !== 0
      || completionEvidence?.preparationMode !== 'human_input'
      || completionEvidence?.syntheticInputCount !== 0
      || completionEvidence?.inspectionArmed !== false
      || completionEvidence?.endpointLeaseState !== 'idle'
      || completionEvidence?.boundaryReached !== false
    )
  ) {
    throw new Error('QA_FEED_HUMAN_COMPLETION_CONTRACT_INVALID');
  }
  const humanTerminalEvidence = plan.mode === 'human'
    ? markerPayloads.get('HUMAN_INSPECTION_ENDED') || null
    : null;
  if (humanTerminalEvidence?.phase === 'failed') {
    throw new Error(
      `QA_FEED_HUMAN_INSPECTION_FAILED:${
        humanTerminalEvidence.finishedReason || 'unknown'
      }`,
    );
  }
  if (
    plan.mode === 'agent'
    && !productionGateExpected
    && !manualGateExpected
    && (
      completionEvidence?.admissionMode !== 'manual'
      || completionEvidence?.timingPolicyEvaluated !== false
      || completionEvidence?.productionGateCount !== 0
      || completionEvidence?.endpointLeaseState !== 'committed'
      || completionEvidence?.boundaryReached !== true
      || completionEvidence?.holdDurationMs !== plan.parameters.holdMs
      || completionEvidence?.holdCompleted !== true
      || completionEvidence?.finalPhase !== 'enso_would_open'
      || !hasAgentCompletionPhaseSequence(completionEvidence?.phases)
      || !hasManualInspectionEvidence(completionEvidence?.inspectionEvidence, {
        surfaceMode: plan.protocolOptions.surfaceMode, holdMs: plan.parameters.holdMs,
        handoffMode: 'feedback_only',
      })
      || (plan.parameters.requireVideo === true && completionEvidence?.visualEvidence?.videoPlaybackObserved !== true)
    )
  ) {
    throw new Error('QA_FEED_AGENT_COMPLETION_CONTRACT_INVALID');
  }
  if (manualGateExpected && (!hasManualGateCausalEvidence(completionEvidence, {
    surfaceMode: plan.protocolOptions.surfaceMode, holdMs: plan.parameters.holdMs,
  }) || (plan.parameters.requireVideo === true && completionEvidence?.visualEvidence?.videoPlaybackObserved !== true))) {
    throw new Error('QA_FEED_MANUAL_GATE_CONTRACT_INVALID');
  }
  if (
    productionGateExpected
    && (
      !hasProductionGateCausalEvidence(completionEvidence)
      || !hasNaturalGateEvidence(
        completionEvidence?.tempo,
        completionEvidence?.gateObservation,
      )
    )
  ) {
    throw new Error('QA_FEED_AGENT_GATE_CONTRACT_INVALID');
  }
  if (
    productionGateExpected
    && !hasAgentTempoMeasurementEvidence(
      completionEvidence?.tempo,
      plan.parameters.dwellMs,
      plan.protocolOptions.surfaceMode,
      { requireCompleteRetention: !productionGateExpected },
    )
  ) {
    throw new Error('QA_FEED_AGENT_TEMPO_CONTRACT_INVALID');
  }
  return Object.freeze({
    status: QA_RUN_STATUSES.PASS,
    protocol: 'feed_horizon',
    siteId: plan.protocolOptions.siteId,
    surfaceMode: plan.protocolOptions.surfaceMode,
    observedPhases: Object.freeze([...seenMarkers]),
    completionEvidence,
    humanTerminalEvidence,
    transcript: Object.freeze({
      stdoutPath,
      stderrPath,
    }),
    productionGateExpected,
    manualGateExpected,
    browserProcessPreserved: true,
  });
}
