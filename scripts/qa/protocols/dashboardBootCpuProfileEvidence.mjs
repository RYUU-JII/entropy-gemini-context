import fs from 'node:fs/promises';
import path from 'node:path';

const MAX_PROFILE_NODES = 25000;
const MAX_PROFILE_SAMPLES = 250000;

class DashboardCpuProfileEvidenceRejection extends Error {
  constructor(details) {
    super(`QA_BOOT_CPU_PROFILE_EVIDENCE_INVALID_OR_OVERFLOW:${details.reasons.join(',')}`);
    this.code = 'QA_BOOT_CPU_PROFILE_EVIDENCE_INVALID_OR_OVERFLOW';
    this.details = details;
    Object.freeze(this);
  }
}

export function projectDashboardCpuProfileEvidenceRejection(error) {
  return error instanceof DashboardCpuProfileEvidenceRejection
    ? Object.freeze({ code: error.code, details: error.details })
    : null;
}

function describeProfileRejection(profile) {
  const nodesArray = Array.isArray(profile?.nodes);
  const samplesArray = Array.isArray(profile?.samples);
  const timeDeltasArray = Array.isArray(profile?.timeDeltas);
  const nodeCount = nodesArray ? profile.nodes.length : null;
  const sampleCount = samplesArray ? profile.samples.length : null;
  const timeDeltaCount = timeDeltasArray ? profile.timeDeltas.length : null;
  const startTimeFinite = Number.isFinite(profile?.startTime);
  const endTimeFinite = Number.isFinite(profile?.endTime);
  const timeRangeOrdered = startTimeFinite && endTimeFinite && profile.endTime >= profile.startTime;
  let firstInvalidDelta = null;
  const timeDeltaInspectionPerformed = timeDeltasArray && timeDeltaCount <= MAX_PROFILE_SAMPLES;
  if (timeDeltaInspectionPerformed) {
    profile.timeDeltas.some((delta, index) => {
      if (Number.isFinite(delta) && delta >= 0) return false;
      firstInvalidDelta = Object.freeze({
        index,
        value: Number.isFinite(delta) ? delta : null,
        valueType: typeof delta,
        finite: Number.isFinite(delta),
      });
      return true;
    });
  }
  const reasons = [];
  if (!nodesArray) reasons.push('nodes_not_array');
  if (!samplesArray) reasons.push('samples_not_array');
  if (!timeDeltasArray) reasons.push('time_deltas_not_array');
  if (nodeCount > MAX_PROFILE_NODES) reasons.push('node_count_limit');
  if (sampleCount > MAX_PROFILE_SAMPLES) reasons.push('sample_count_limit');
  if (samplesArray && timeDeltasArray && sampleCount !== timeDeltaCount) reasons.push('sample_delta_count_mismatch');
  if (!startTimeFinite) reasons.push('start_time_non_finite');
  if (!endTimeFinite) reasons.push('end_time_non_finite');
  if (startTimeFinite && endTimeFinite && !timeRangeOrdered) reasons.push('time_range_reversed');
  if (firstInvalidDelta) reasons.push(firstInvalidDelta.finite ? 'time_delta_negative' : 'time_delta_non_finite');
  return Object.freeze({
    reasons: Object.freeze(reasons),
    shape: Object.freeze({ nodesArray, samplesArray, timeDeltasArray }),
    counts: Object.freeze({ nodeCount, sampleCount, timeDeltaCount }),
    time: Object.freeze({
      startTimeFinite, endTimeFinite, timeRangeOrdered,
      startTime: startTimeFinite ? profile.startTime : null,
      endTime: endTimeFinite ? profile.endTime : null,
    }),
    timeDeltaInspectionPerformed,
    firstInvalidDelta,
  });
}

export function prepareDashboardCpuProfileEvidence(profile, startReceipt) {
  if (!Array.isArray(profile?.nodes) || !Array.isArray(profile.samples) || !Array.isArray(profile.timeDeltas)
    || profile.nodes.length > MAX_PROFILE_NODES || profile.samples.length > MAX_PROFILE_SAMPLES
    || profile.samples.length !== profile.timeDeltas.length
    || !Number.isFinite(profile.startTime) || !Number.isFinite(profile.endTime)
    || profile.endTime < profile.startTime
    || profile.timeDeltas.some(delta => !Number.isFinite(delta) || delta < 0)) {
    throw new DashboardCpuProfileEvidenceRejection(describeProfileRejection(profile));
  }
  if (!Number.isFinite(startReceipt?.requestedAtEpochMs) || !Number.isFinite(startReceipt?.confirmedAtEpochMs)
    || startReceipt.confirmedAtEpochMs < startReceipt.requestedAtEpochMs) {
    throw new Error('QA_BOOT_CPU_PROFILE_CLOCK_RECEIPT_INVALID');
  }
  const sanitized = {
    nodes: profile.nodes.map(node => ({ ...node, callFrame: { ...node.callFrame,
      url: String(node.callFrame?.url || '').split(/[?#]/u)[0] } })),
    startTime: profile.startTime, endTime: profile.endTime,
    samples: profile.samples, timeDeltas: profile.timeDeltas,
  };
  const body = JSON.stringify(sanitized);
  if (Buffer.byteLength(body, 'utf8') > 32 * 1024 * 1024) throw new Error('QA_BOOT_CPU_PROFILE_SIZE_LIMIT');
  return {
    body,
    clock: {
      source: 'Profiler.start request/response host epoch bracket',
      profileStartTimeUs: profile.startTime,
      requestedAtEpochMs: startReceipt.requestedAtEpochMs,
      confirmedAtEpochMs: startReceipt.confirmedAtEpochMs,
      uncertaintyMs: startReceipt.confirmedAtEpochMs - startReceipt.requestedAtEpochMs,
      // CPU sample offsets use cumulative timeDeltas from profile.startTime.
      // Epoch alignment is an interval, never an exact cross-realm timestamp.
      epochOffsetLowerMs: startReceipt.requestedAtEpochMs - profile.startTime / 1000,
      epochOffsetUpperMs: startReceipt.confirmedAtEpochMs - profile.startTime / 1000,
    },
  };
}

export function createDashboardCpuProfileEvidenceWriter(attachmentsDir, sampleIndex) {
  const workerOrdinals = { home_worker: 0, model_worker: 0 };
  return async ({ kind, profile, startReceipt }) => {
    if (!['page', 'home_worker', 'model_worker'].includes(kind)) throw new Error('QA_BOOT_CPU_PROFILE_OWNER_INVALID');
    const prepared = prepareDashboardCpuProfileEvidence(profile, startReceipt);
    const owner = kind === 'page' ? 'page'
      : `${kind === 'home_worker' ? 'home' : 'model'}-worker-${++workerOrdinals[kind]}`;
    const outputPath = path.join(attachmentsDir, `dashboard-boot-${sampleIndex + 1}-${owner}.cpuprofile`);
    await fs.writeFile(outputPath, prepared.body, 'utf8');
    return { path: outputPath, sampleCount: profile.samples.length, nodeCount: profile.nodes.length, clock: prepared.clock };
  };
}
