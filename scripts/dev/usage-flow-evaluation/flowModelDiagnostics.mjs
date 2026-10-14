// Evaluation diagnostics only. Callers own trace/output validation and metric
// selection; this module has no model policy, oracle or production imports.
export const FLOW_MODEL_REFINEMENT_STEPS = 12;
const NUMERIC_TOLERANCE = 1e-8;

export const equalFlowMetric = (left, right) => typeof left === 'number' && typeof right === 'number'
  ? Math.abs(left - right) <= NUMERIC_TOLERANCE * Math.max(1, Math.abs(left), Math.abs(right))
  : left === right;

export const selectLastFlowAdvance = (output) => output.curve.findLast((row) => row.observationKind === 'advance') ?? null;

function differences(left, right, metricNames) {
  if (left === null || right === null) return left === right ? [] : ['observation_presence'];
  return metricNames.filter((key) => !equalFlowMetric(left[key], right[key]));
}

// Compare states after each physical advance timestamp, collapsing multiple
// callbacks at that timestamp. Callback counters are not a physical invariant.
function timedProjection(output, startMs, metricNames) {
  const rows = new Map();
  for (const row of output.curve) {
    if (row.observationKind === 'advance' || row.eventKind === 'end') {
      rows.set(row.at - startMs, Object.fromEntries(metricNames.map((key) => [key, row[key]])));
    }
  }
  return [...rows];
}

export function compareFlowTrajectories(left, right, leftTrace, rightTrace, metricNames) {
  const a = timedProjection(left, leftTrace.startMs, metricNames);
  const b = timedProjection(right, rightTrace.startMs, metricNames);
  if (a.length !== b.length) return [{ atElapsedMs: null, metrics: ['timeline_shape'] }];
  const changes = [];
  a.forEach(([at, row], index) => {
    const metrics = equalFlowMetric(at, b[index][0]) ? differences(row, b[index][1], metricNames) : ['timeline_time'];
    if (metrics.length > 0) changes.push({ atElapsedMs: at, metrics });
  });
  return changes;
}

function interpolateTrace(left, right) {
  if (left.surfaceMode !== right.surfaceMode || left.version !== right.version
    || left.events.length !== right.events.length) return null;
  const events = [];
  for (let index = 0; index < left.events.length; index += 1) {
    const a = left.events[index];
    const b = right.events[index];
    const keys = Object.keys(a);
    if (keys.length !== Object.keys(b).length) return null;
    const event = {};
    for (const key of keys) {
      // Counts and channel states must remain identical. Interpolation never
      // invents fractional content transitions or changes event identity.
      if (['at', 'screenfuls', 'quality'].includes(key)
        && Number.isFinite(a[key]) && Number.isFinite(b[key])) event[key] = (a[key] + b[key]) / 2;
      else if (Object.hasOwn(b, key) && a[key] === b[key]) event[key] = a[key];
      else return null;
    }
    events.push(event);
  }
  return { version: left.version, surfaceMode: left.surfaceMode,
    startMs: (left.startMs + right.startMs) / 2,
    endMs: (left.endMs + right.endMs) / 2, events };
}

function refineEdge({ probe, index, metric, left, right, replay }) {
  const initialDelta = Math.abs(selectLastFlowAdvance(right.output)[metric] - selectLastFlowAdvance(left.output)[metric]);
  const scale = Math.max(1, Math.abs(selectLastFlowAdvance(left.output)[metric]), Math.abs(selectLastFlowAdvance(right.output)[metric]));
  let a = { ...left, value: probe.values[index] };
  let b = { ...right, value: probe.values[index + 1] };
  for (let step = 0; step < FLOW_MODEL_REFINEMENT_STEPS; step += 1) {
    const trace = interpolateTrace(a.trace, b.trace);
    if (trace === null) return { metric, status: 'not_refinable', reason: 'discrete_trace_shape_changed' };
    const midpoint = { trace, output: replay(trace), value: (a.value + b.value) / 2 };
    const leftDelta = Math.abs(selectLastFlowAdvance(a.output)[metric] - selectLastFlowAdvance(midpoint.output)[metric]);
    const rightDelta = Math.abs(selectLastFlowAdvance(b.output)[metric] - selectLastFlowAdvance(midpoint.output)[metric]);
    if (leftDelta >= rightDelta) b = midpoint;
    else a = midpoint;
  }
  const finalDelta = Math.abs(selectLastFlowAdvance(a.output)[metric] - selectLastFlowAdvance(b.output)[metric]);
  // A diagnostic sensitivity flag, not a model cutoff or a proof of mathematical
  // discontinuity. Keep full magnitudes so reviewers can reject this heuristic.
  const retainedJumpFraction = finalDelta / initialDelta;
  return {
    metric,
    status: retainedJumpFraction >= 0.25 && finalDelta / scale >= 0.001 ? 'persistent_local_jump' : 'shrinking_local_difference',
    initialParameterRange: [probe.values[index], probe.values[index + 1]],
    refinedParameterRange: [a.value, b.value], initialDelta, finalDelta,
    retainedJumpFraction,
    endpointValues: [selectLastFlowAdvance(a.output)[metric], selectLastFlowAdvance(b.output)[metric]],
    refinementSteps: FLOW_MODEL_REFINEMENT_STEPS,
  };
}

export function diagnoseFlowProbes({ probes, records, replay, metrics, discreteMetrics = [] }) {
  return probes.map((probe) => {
    const diagnostics = [];
    const discreteChanges = [];
    for (let index = 0; index < probe.values.length - 1; index += 1) {
      const left = records.get(probe.scenarioIds[index]);
      const right = records.get(probe.scenarioIds[index + 1]);
      const a = selectLastFlowAdvance(left.output);
      const b = selectLastFlowAdvance(right.output);
      if (a === null || b === null) {
        diagnostics.push({ status: 'unsupported', reason: 'no_confirmed_advance', index });
        continue;
      }
      const switches = discreteMetrics.filter((key) => a[key] !== b[key]);
      if (switches.length > 0) discreteChanges.push({ index, metrics: switches });
      for (const metric of metrics) {
        if (!equalFlowMetric(a[metric], b[metric])) diagnostics.push({ index,
          ...refineEdge({ probe, index, metric, left, right, replay }) });
      }
    }
    return { ...probe, checkpoint: 'last_confirmed_advance', diagnostics, discreteChanges };
  });
}
