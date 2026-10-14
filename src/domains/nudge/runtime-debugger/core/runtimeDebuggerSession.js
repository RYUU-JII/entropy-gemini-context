import {
  sanitizeRuntimeDebuggerUrl,
  sanitizeRuntimeDebuggerValue,
} from './runtimeDebuggerSanitizer.js';

export const RUNTIME_DEBUGGER_TOOL_ID = 'entropy.runtimeDebugger';
export const RUNTIME_DEBUGGER_SESSION_VERSION = 2;

const DEFAULT_MAX_SAMPLES = 48;
const DEFAULT_MAX_EVENTS = 160;
const HARD_MAX_SAMPLES = 120;
const HARD_MAX_EVENTS = 400;
const MAX_EVIDENCE_GAPS = 24;
const DEFAULT_IGNORED_DELTA_PATHS = Object.freeze([
  'wallTime',
  'elapsedMs',
  'perfNow',
  'observerHub.debugSnapshotReadTotalMs',
  'observerHub.debugSnapshotReadCount',
]);
const CAPTURE_KINDS = new Set(['live', 'reload', 'idle']);
const COUNTER_CONTAINER_KEYS = new Set([
  'eventCounts',
  'subscriberCounters',
  'attributeMutationCounts',
  'targetDecisionCounts',
  'appliedTargetDecisionCounts',
  'zeroCandidateCollectionCounts',
]);
const NON_COUNTER_KEYS = new Set([
  'subscriberCount',
  'trackedTargetCount',
  'pendingRecheckCount',
  'pendingRetryCount',
  'pendingTextNodeCount',
  'pendingSubtreeCount',
  'pendingSubtreeTaskCount',
  'queueLength',
  'shadowObserverCount',
  'liveVideoCount',
  'compiledPlanCount',
  'metricRootSelectorLength',
  'observedVideoCount',
  'recentInteractiveActionCount',
  'lastCandidateCount',
  'maxCandidateCount',
  'maxMutationRootCount',
]);
const COUNTER_KEYS = new Set([
  'operations',
  'flushes',
  'mutations',
  'addedNodes',
  'removedNodes',
  'textNodes',
  'attributeTargets',
  'errors',
  'writes',
  'candidates',
  'pruned',
  'hidden',
  'removed',
  'noops',
  'restored',
  'restores',
  'redirects',
  'calls',
  'debugOverheadMs',
  'attributeRootsSkipped',
  'rechecksCoalesced',
  'rechecksResolved',
  'rechecksUnresolved',
  'rechecksExpired',
  'settleRechecks',
  'lateRechecks',
  'loadRechecks',
  'metadataRechecks',
  'snapshotRevision',
]);
const COUNTER_SUFFIX_PATTERN = /(?:Scans|Flushes|Batches|Roots|Targets|Candidates|Collections|Queries|Hits|Decisions|Writes|Reads|Noops|Restores|Refreshes|Schedules|Queued|Run|Runs|Attempts|Deliveries|Skips|Retries|Exhausted|Pruned|Hidden|Removed|Redirects|Steps|Entries|Nodes|Subtrees|Selectors|Payloads|Inputs|Samples|Count|Total)$/;

function resolveRingLimit(value, fallback, hardLimit) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric < 1) return fallback;
  return Math.min(Math.floor(numeric), hardLimit);
}

function requireTimestamp(value, errorCode) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric < 0) throw new Error(errorCode);
  return numeric;
}

function isRecord(value) {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function assertV2Session(session) {
  if (
    !isRecord(session)
    || session.tool !== RUNTIME_DEBUGGER_TOOL_ID
    || session.version !== RUNTIME_DEBUGGER_SESSION_VERSION
  ) {
    throw new Error('RUNTIME_DEBUGGER_V2_SESSION_REQUIRED');
  }
}

function normalizeIgnoredDeltaPaths(paths) {
  if (!Array.isArray(paths)) throw new Error('RUNTIME_DEBUGGER_IGNORED_DELTA_PATHS_INVALID');
  return Object.freeze(Array.from(new Set(paths.map((path) => {
    if (typeof path !== 'string' || path.length === 0) {
      throw new Error('RUNTIME_DEBUGGER_IGNORED_DELTA_PATH_INVALID');
    }
    return path;
  }))).slice(0, 32));
}

function normalizeCaptureKind(value) {
  const captureKind = String(value || '').trim();
  if (!CAPTURE_KINDS.has(captureKind)) {
    throw new Error(`RUNTIME_DEBUGGER_CAPTURE_KIND_INVALID:${captureKind || 'empty'}`);
  }
  return captureKind;
}

function normalizeSelectedProbeId(value) {
  if (value === null) return null;
  if (typeof value !== 'string' || !/^[A-Za-z][A-Za-z0-9_-]{0,63}$/.test(value)) {
    throw new Error('RUNTIME_DEBUGGER_SELECTED_PROBE_ID_INVALID');
  }
  return value;
}

function cloneSelectedEvidence(source, selectedProbeId) {
  if (selectedProbeId === null) return sanitizeRuntimeDebuggerValue(source);
  return {
    [selectedProbeId]: sanitizeRuntimeDebuggerValue(source?.[selectedProbeId] ?? null),
  };
}

function isCounterMetricPath(path) {
  const segments = path.split('.').filter(Boolean);
  const key = segments.at(-1) || '';
  if (!key || NON_COUNTER_KEYS.has(key)) return false;
  if (/^(?:avg|max|last|current|pending|median|min)/i.test(key)) return false;
  if (/(?:At|Until|Ratio|Confidence|Score|Percent|HalfLifeMs)$/.test(key)) return false;
  if (COUNTER_CONTAINER_KEYS.has(segments.at(-2))) return true;
  if (COUNTER_KEYS.has(key)) return true;
  if (/^total[A-Z]/.test(key) || /TotalMs$/.test(key)) return true;
  return COUNTER_SUFFIX_PATTERN.test(key);
}

function walkNumericDelta(baseline, latest, includeZero, ignoredPaths, path = '', depth = 0) {
  if (depth > 10) return undefined;
  if (ignoredPaths.has(path)) return undefined;
  if (Number.isFinite(latest)) {
    if (!isCounterMetricPath(path)) return undefined;
    const baselineValue = Number.isFinite(baseline) ? baseline : 0;
    const delta = latest - baselineValue;
    if (delta < 0) return undefined;
    if (!includeZero && delta === 0) return undefined;
    return Object.is(delta, -0) ? 0 : delta;
  }
  if (!isRecord(latest)) return undefined;

  const result = Object.create(null);
  for (const key of Object.keys(latest).slice(0, 160)) {
    const childPath = path ? `${path}.${key}` : key;
    const child = walkNumericDelta(
      isRecord(baseline) ? baseline[key] : undefined,
      latest[key],
      includeZero,
      ignoredPaths,
      childPath,
      depth + 1,
    );
    if (child !== undefined) result[key] = child;
  }
  return Object.keys(result).length > 0 ? result : undefined;
}

export function computeNumericCounterDelta(
  baseline,
  latest,
  { includeZero = true, ignoredPaths = [] } = {},
) {
  const sanitizedBaseline = sanitizeRuntimeDebuggerValue(baseline);
  const sanitizedLatest = sanitizeRuntimeDebuggerValue(latest);
  const ignoredPathSet = new Set(normalizeIgnoredDeltaPaths(ignoredPaths));
  return walkNumericDelta(
    sanitizedBaseline,
    sanitizedLatest,
    includeZero,
    ignoredPathSet,
  ) ?? Object.create(null);
}

export function createRuntimeDebuggerSession({
  baseline,
  startedAt = Date.now(),
  url = '',
  maxSamples = DEFAULT_MAX_SAMPLES,
  maxEvents = DEFAULT_MAX_EVENTS,
  ignoredDeltaPaths = DEFAULT_IGNORED_DELTA_PATHS,
  captureKind = 'live',
} = {}) {
  if (!isRecord(baseline)) throw new Error('RUNTIME_DEBUGGER_SESSION_BASELINE_REQUIRED');
  const capturedAt = requireTimestamp(startedAt, 'RUNTIME_DEBUGGER_SESSION_START_TIME_INVALID');
  const sanitizedBaseline = sanitizeRuntimeDebuggerValue(baseline);

  return {
    tool: RUNTIME_DEBUGGER_TOOL_ID,
    version: RUNTIME_DEBUGGER_SESSION_VERSION,
    url: sanitizeRuntimeDebuggerUrl(url),
    captureKind: normalizeCaptureKind(captureKind),
    startedAt: capturedAt,
    baselineCapturedAt: capturedAt,
    latestCapturedAt: capturedAt,
    sampleReadCount: 1,
    baseline: sanitizedBaseline,
    latest: sanitizedBaseline,
    deltaSamples: [],
    events: [],
    evidenceGaps: [],
    retention: {
      totalChangedSamples: 0,
      droppedSamples: 0,
      totalSamplesByProbe: Object.create(null),
      droppedSamplesByProbe: Object.create(null),
      totalEvents: 0,
      droppedEvents: 0,
      totalEventsByProbe: Object.create(null),
      droppedEventsByProbe: Object.create(null),
      unavailableEventsByProbe: Object.create(null),
    },
    ignoredDeltaPaths: normalizeIgnoredDeltaPaths(ignoredDeltaPaths),
    limits: Object.freeze({
      maxSamples: resolveRingLimit(maxSamples, DEFAULT_MAX_SAMPLES, HARD_MAX_SAMPLES),
      maxEvents: resolveRingLimit(maxEvents, DEFAULT_MAX_EVENTS, HARD_MAX_EVENTS),
    }),
  };
}

export function recordRuntimeDebuggerSample(
  session,
  snapshot,
  { capturedAt = Date.now() } = {},
) {
  assertV2Session(session);
  if (!isRecord(snapshot)) throw new Error('RUNTIME_DEBUGGER_SAMPLE_SNAPSHOT_REQUIRED');
  const resolvedCapturedAt = requireTimestamp(
    capturedAt,
    'RUNTIME_DEBUGGER_SAMPLE_CAPTURE_TIME_INVALID',
  );
  const sanitizedSnapshot = sanitizeRuntimeDebuggerValue(snapshot);
  const incrementalDelta = computeNumericCounterDelta(session.latest, sanitizedSnapshot, {
    includeZero: false,
    ignoredPaths: session.ignoredDeltaPaths,
  });

  session.latest = sanitizedSnapshot;
  session.latestCapturedAt = resolvedCapturedAt;
  session.sampleReadCount += 1;

  if (Object.keys(incrementalDelta).length > 0) {
    session.retention.totalChangedSamples += 1;
    Object.keys(incrementalDelta).forEach((probeId) => {
      session.retention.totalSamplesByProbe[probeId] = (
        Number(session.retention.totalSamplesByProbe[probeId]) || 0
      ) + 1;
    });
    session.deltaSamples.push({
      capturedAt: resolvedCapturedAt,
      delta: incrementalDelta,
    });
    if (session.deltaSamples.length > session.limits.maxSamples) {
      const dropped = session.deltaSamples.splice(
        0,
        session.deltaSamples.length - session.limits.maxSamples,
      );
      session.retention.droppedSamples += dropped.length;
      dropped.forEach((sample) => {
        Object.keys(sample.delta || {}).forEach((probeId) => {
          session.retention.droppedSamplesByProbe[probeId] = (
            Number(session.retention.droppedSamplesByProbe[probeId]) || 0
          ) + 1;
        });
      });
    }
  }
  return session;
}

export function recordRuntimeDebuggerEvent(
  session,
  event,
  { capturedAt = Date.now() } = {},
) {
  assertV2Session(session);
  if (!isRecord(event)) throw new Error('RUNTIME_DEBUGGER_EVENT_REQUIRED');
  const resolvedCapturedAt = requireTimestamp(
    capturedAt,
    'RUNTIME_DEBUGGER_EVENT_CAPTURE_TIME_INVALID',
  );
  const sanitizedEvent = sanitizeRuntimeDebuggerValue(event);
  const probeId = typeof sanitizedEvent.probeId === 'string'
    ? sanitizedEvent.probeId
    : 'unknown';
  session.retention.totalEvents += 1;
  session.retention.totalEventsByProbe[probeId] = (
    Number(session.retention.totalEventsByProbe[probeId]) || 0
  ) + 1;
  session.events.push({
    ...sanitizedEvent,
    capturedAt: resolvedCapturedAt,
  });
  if (session.events.length > session.limits.maxEvents) {
    const dropped = session.events.splice(0, session.events.length - session.limits.maxEvents);
    session.retention.droppedEvents += dropped.length;
    dropped.forEach((entry) => {
      const droppedProbeId = typeof entry.probeId === 'string' ? entry.probeId : 'unknown';
      session.retention.droppedEventsByProbe[droppedProbeId] = (
        Number(session.retention.droppedEventsByProbe[droppedProbeId]) || 0
      ) + 1;
    });
  }
  return session;
}

export function recordRuntimeDebuggerEvidenceGap(
  session,
  {
    probeId,
    source,
    expectedOperations,
    retainedEvents,
  } = {},
  { capturedAt = Date.now() } = {},
) {
  assertV2Session(session);
  if (typeof probeId !== 'string' || probeId.length === 0) {
    throw new Error('RUNTIME_DEBUGGER_EVIDENCE_GAP_PROBE_ID_REQUIRED');
  }
  if (typeof source !== 'string' || source.length === 0) {
    throw new Error('RUNTIME_DEBUGGER_EVIDENCE_GAP_SOURCE_REQUIRED');
  }
  const expected = Math.max(0, Number(expectedOperations) || 0);
  const retained = Math.max(0, Number(retainedEvents) || 0);
  const unavailable = Math.max(0, expected - retained);
  if (unavailable === 0) return session;
  const resolvedCapturedAt = requireTimestamp(
    capturedAt,
    'RUNTIME_DEBUGGER_EVIDENCE_GAP_CAPTURE_TIME_INVALID',
  );
  session.retention.unavailableEventsByProbe[probeId] = (
    Number(session.retention.unavailableEventsByProbe[probeId]) || 0
  ) + unavailable;
  session.evidenceGaps.push(sanitizeRuntimeDebuggerValue({
    probeId,
    source,
    expectedOperations: expected,
    retainedEvents: retained,
    unavailableEvents: unavailable,
    capturedAt: resolvedCapturedAt,
  }));
  if (session.evidenceGaps.length > MAX_EVIDENCE_GAPS) {
    session.evidenceGaps.splice(0, session.evidenceGaps.length - MAX_EVIDENCE_GAPS);
  }
  return session;
}

export function createRuntimeDebuggerSessionPayload(
  session,
  { probeResults = [], selectedProbeId = null } = {},
) {
  assertV2Session(session);
  if (!Array.isArray(probeResults)) throw new Error('RUNTIME_DEBUGGER_PROBE_RESULTS_INVALID');
  const normalizedProbeId = normalizeSelectedProbeId(selectedProbeId);

  const selectedBaseline = cloneSelectedEvidence(session.baseline, normalizedProbeId);
  const selectedLatest = cloneSelectedEvidence(session.latest, normalizedProbeId);
  const selectedSamples = normalizedProbeId === null
    ? session.deltaSamples
    : session.deltaSamples
      .filter((sample) => Object.hasOwn(sample.delta, normalizedProbeId))
      .map((sample) => ({
        capturedAt: sample.capturedAt,
        delta: { [normalizedProbeId]: sample.delta[normalizedProbeId] },
      }));
  const selectedEvents = normalizedProbeId === null
    ? session.events
    : session.events.filter((event) => (
      event.probeId === normalizedProbeId || event.probeId === 'runtimeDebugger'
    ));
  const sessionErrors = selectedEvents
    .filter((event) => event.probeId === 'runtimeDebugger' && event.type === 'debugger_error')
    .map((event) => ({
      capturedAt: event.capturedAt,
      ...(event.details && typeof event.details === 'object' ? event.details : {}),
    }));
  const selectedProbeResults = normalizedProbeId === null
    ? probeResults
    : probeResults.filter((probe) => probe?.probeId === normalizedProbeId);
  const selectedEvidenceGaps = normalizedProbeId === null
    ? session.evidenceGaps
    : session.evidenceGaps.filter((gap) => gap.probeId === normalizedProbeId);
  const selectedProbeIds = normalizedProbeId === null
    ? null
    : new Set([normalizedProbeId, 'runtimeDebugger']);
  const sumRetentionCounts = (counts, selectedIds) => Object.entries(counts || {})
    .filter(([probeId]) => selectedIds === null || selectedIds.has(probeId))
    .reduce((total, [, count]) => total + (Number(count) || 0), 0);
  const retainedSampleCount = selectedSamples.length;
  const totalSampleCount = normalizedProbeId === null
    ? session.retention.totalChangedSamples
    : sumRetentionCounts(session.retention.totalSamplesByProbe, new Set([normalizedProbeId]));
  const retainedEventCount = selectedEvents.length;
  const totalEventCount = normalizedProbeId === null
    ? session.retention.totalEvents
    : sumRetentionCounts(session.retention.totalEventsByProbe, selectedProbeIds);
  const unavailableAtSource = normalizedProbeId === null
    ? sumRetentionCounts(session.retention.unavailableEventsByProbe, null)
    : sumRetentionCounts(
      session.retention.unavailableEventsByProbe,
      new Set([normalizedProbeId]),
    );

  return {
    tool: RUNTIME_DEBUGGER_TOOL_ID,
    version: RUNTIME_DEBUGGER_SESSION_VERSION,
    capturedAt: new Date(session.latestCapturedAt).toISOString(),
    url: session.url,
    scope: normalizedProbeId === null
      ? { type: 'full' }
      : { type: 'probe', probeId: normalizedProbeId },
    session: {
      startedAt: session.startedAt,
      baselineCapturedAt: session.baselineCapturedAt,
      latestCapturedAt: session.latestCapturedAt,
      sampleReadCount: session.sampleReadCount,
      changedSampleCount: retainedSampleCount,
      eventCount: retainedEventCount,
      captureKind: session.captureKind,
      retention: {
        samples: {
          retained: retainedSampleCount,
          total: totalSampleCount,
          dropped: Math.max(0, totalSampleCount - retainedSampleCount),
          truncated: totalSampleCount > retainedSampleCount,
        },
        events: {
          retained: retainedEventCount,
          total: totalEventCount,
          dropped: Math.max(0, totalEventCount - retainedEventCount),
          truncated: totalEventCount > retainedEventCount,
          unavailableAtSource,
          complete: totalEventCount === retainedEventCount && unavailableAtSource === 0,
        },
      },
    },
    baseline: selectedBaseline,
    latest: selectedLatest,
    delta: computeNumericCounterDelta(selectedBaseline, selectedLatest, {
      includeZero: false,
      ignoredPaths: normalizedProbeId === null ? session.ignoredDeltaPaths : [],
    }),
    deltaSamples: selectedSamples.map((sample) => sanitizeRuntimeDebuggerValue(sample)),
    events: selectedEvents.map((event) => sanitizeRuntimeDebuggerValue(event)),
    errors: sessionErrors.map((error) => sanitizeRuntimeDebuggerValue(error)),
    evidenceGaps: selectedEvidenceGaps.map((gap) => sanitizeRuntimeDebuggerValue(gap)),
    probes: selectedProbeResults.map((probe) => sanitizeRuntimeDebuggerValue(probe)),
  };
}
