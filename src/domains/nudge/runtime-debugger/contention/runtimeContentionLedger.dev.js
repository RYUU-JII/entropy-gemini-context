const RUNTIME_CONTENTION_LEDGER_SCHEMA_VERSION = 1;
const SCROLL_FRAME_RETENTION_LIMIT = 2048;
// A single YouTube Watch content-load window can exceed 1.5k fine-grained
// owner spans after cooperative semantic cursor slicing. These records contain
// scalar timing metadata only, so keep enough history to prove the complete
// action window instead of silently characterizing only its retained tail.
const OWNER_WORK_RETENTION_LIMIT = 4096;
const LONG_TASK_RETENTION_LIMIT = 128;
const WINDOW_TIMELINE_RETENTION_LIMIT = 4096;
const SNAPSHOT_WORST_FRAME_LIMIT = 16;
const SNAPSHOT_RECENT_WORK_LIMIT = 24;

const OWNER_IDS = new Set([
  'feedFlow',
  'inputDelay',
  'inputVisualBrake',
  'interaction',
  'observerHub',
  'scrollPagedIntent',
  'scrollPhysics',
  'shortForm',
  'socialMetrics',
  'textShuffle',
  'visualMedia',
  'videoObservation',
]);

let generation = 0;
let state = createState(false);

function nowMs() {
  if (typeof performance !== 'undefined' && typeof performance.now === 'function') {
    return performance.now();
  }
  return Date.now();
}

function roundMs(value) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? Number(numeric.toFixed(3)) : 0;
}

function normalizeToken(value, fallback = 'unknown') {
  const token = String(value || '').trim();
  if (!token || token.length > 80 || !/^[a-z0-9_.:-]+$/i.test(token)) return fallback;
  return token;
}

function normalizeNonNegative(value) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? Math.max(0, numeric) : 0;
}

function normalizeOptionalPositiveInteger(value) {
  const numeric = Number(value);
  return Number.isSafeInteger(numeric) && numeric > 0 ? numeric : null;
}

function createInstrumentationState() {
  return {
    recordCallCount: 0,
    recordOverheadMs: 0,
    recordOverheadMaxMs: 0,
    recordCallCountByKind: {
      scrollFrame: 0,
      ownerWork: 0,
      longTask: 0,
    },
    recordOverheadByKind: {
      scrollFrame: 0,
      ownerWork: 0,
      longTask: 0,
    },
    longTaskObserverCallbackCount: 0,
    longTaskObserverCallbackMs: 0,
    longTaskObserverCallbackMaxMs: 0,
    snapshotReadCount: 0,
    snapshotReadOverheadMs: 0,
    snapshotReadOverheadMaxMs: 0,
    sessionSetupMs: 0,
  };
}

function createState(active) {
  return {
    active,
    startedAt: active ? nowMs() : null,
    nextEventId: 1,
    scrollFrames: [],
    ownerWork: [],
    longTasks: [],
    droppedScrollFrames: 0,
    droppedOwnerWork: 0,
    droppedLongTasks: 0,
    scrollFrameCount: 0,
    scrollFrameWorkTotalMs: 0,
    scrollFrameWorkMaxMs: 0,
    scrollIntervalTotalMs: 0,
    scrollIntervalMaxMs: 0,
    scrollInputFrameCount: 0,
    scrollInputToFrameTotalMs: 0,
    scrollInputToFrameMaxMs: 0,
    scrollSkippedFrameCount: 0,
    scrollSkippedTotalMs: 0,
    ownerWorkCount: 0,
    ownerWorkTotalMs: 0,
    ownerWorkMaxMs: 0,
    ownerStats: new Map(),
    longTaskCount: 0,
    longTaskTotalMs: 0,
    longTaskMaxMs: 0,
    longTaskObserver: null,
    longTaskSupported: false,
    instrumentation: createInstrumentationState(),
  };
}

function pushBounded(list, entry, limit, droppedKey) {
  list.push(entry);
  if (list.length <= limit) return;
  const dropped = list.length - limit;
  list.splice(0, dropped);
  state[droppedKey] += dropped;
}

function recordInstrumentation(kind, startedAt) {
  const elapsedMs = Math.max(0, nowMs() - startedAt);
  const instrumentation = state.instrumentation;
  instrumentation.recordCallCount += 1;
  instrumentation.recordOverheadMs += elapsedMs;
  instrumentation.recordOverheadMaxMs = Math.max(
    instrumentation.recordOverheadMaxMs,
    elapsedMs,
  );
  instrumentation.recordCallCountByKind[kind] += 1;
  instrumentation.recordOverheadByKind[kind] += elapsedMs;
}

function percentile(values, ratio) {
  if (!Array.isArray(values) || values.length === 0) return 0;
  const sorted = [...values].sort((left, right) => left - right);
  const index = Math.min(
    sorted.length - 1,
    Math.max(0, Math.ceil(sorted.length * ratio) - 1),
  );
  return sorted[index];
}

function normalizeSubscriberSpans(subscribers, flushStartedAt, flushEndedAt) {
  if (!Array.isArray(subscribers)) return [];
  return subscribers.slice(0, 64).flatMap((entry) => {
    const startedAt = Number(entry?.startedAt);
    const endedAt = Number(entry?.endedAt);
    if (!Number.isFinite(startedAt) || !Number.isFinite(endedAt) || endedAt < startedAt) {
      return [];
    }
    return [{
      ownerId: normalizeToken(entry.ownerId, 'anonymous'),
      startedAt: Math.max(flushStartedAt, startedAt),
      endedAt: Math.min(flushEndedAt, endedAt),
      durationMs: Math.max(0, endedAt - startedAt),
      mutationCount: Math.max(0, Number(entry.mutationCount) || 0),
    }];
  }).filter((entry) => entry.endedAt >= entry.startedAt);
}

function recordLongTaskEntry(entry) {
  if (!state.active) return false;
  const startedAt = nowMs();
  try {
    const taskStartedAt = Number(entry?.startTime);
    const durationMs = normalizeNonNegative(entry?.duration);
    if (!Number.isFinite(taskStartedAt) || durationMs <= 0) return false;
    const record = {
      id: state.nextEventId++,
      startedAt: taskStartedAt,
      endedAt: taskStartedAt + durationMs,
      durationMs,
    };
    state.longTaskCount += 1;
    state.longTaskTotalMs += durationMs;
    state.longTaskMaxMs = Math.max(state.longTaskMaxMs, durationMs);
    pushBounded(state.longTasks, record, LONG_TASK_RETENTION_LIMIT, 'droppedLongTasks');
    return true;
  } finally {
    recordInstrumentation('longTask', startedAt);
  }
}

function drainLongTaskEntries(entries) {
  if (!entries) return;
  Array.from(entries).forEach(recordLongTaskEntry);
}

function installLongTaskObserver() {
  const Observer = globalThis?.PerformanceObserver;
  const supportedTypes = Observer?.supportedEntryTypes;
  if (
    typeof Observer !== 'function'
    || !Array.isArray(supportedTypes)
    || !supportedTypes.includes('longtask')
  ) return;

  const observer = new Observer((list) => {
    const callbackStartedAt = nowMs();
    try {
      drainLongTaskEntries(list?.getEntries?.());
    } finally {
      const elapsedMs = Math.max(0, nowMs() - callbackStartedAt);
      const instrumentation = state.instrumentation;
      instrumentation.longTaskObserverCallbackCount += 1;
      instrumentation.longTaskObserverCallbackMs += elapsedMs;
      instrumentation.longTaskObserverCallbackMaxMs = Math.max(
        instrumentation.longTaskObserverCallbackMaxMs,
        elapsedMs,
      );
    }
  });
  observer.observe({ type: 'longtask', buffered: false });
  state.longTaskObserver = observer;
  state.longTaskSupported = true;
}

function disconnectLongTaskObserver({ drain = true } = {}) {
  const observer = state.longTaskObserver;
  if (!observer) return;
  if (drain) drainLongTaskEntries(observer.takeRecords?.());
  observer.disconnect?.();
  state.longTaskObserver = null;
}

export function beginRuntimeContentionSession() {
  const setupStartedAt = nowMs();
  disconnectLongTaskObserver({ drain: false });
  generation += 1;
  state = createState(true);
  try {
    installLongTaskObserver();
  } finally {
    state.instrumentation.sessionSetupMs = Math.max(0, nowMs() - setupStartedAt);
  }
  return generation;
}

export function resetRuntimeContentionSession() {
  return beginRuntimeContentionSession();
}

export function isRuntimeContentionSessionActive() {
  return state.active;
}

export function stopRuntimeContentionSession() {
  if (!state.active) return false;
  disconnectLongTaskObserver();
  state.active = false;
  return true;
}

export function recordRuntimeScrollFrame({
  startedAt,
  endedAt,
  intervalMs = 0,
  inputToFrameMs = 0,
  skippedMs = 0,
  activeControllerCount = 0,
  targetKind = 'unknown',
  activeAfter = false,
} = {}) {
  if (!state.active) return false;
  const recordStartedAt = nowMs();
  try {
    const resolvedStartedAt = Number(startedAt);
    const resolvedEndedAt = Number(endedAt);
    if (
      !Number.isFinite(resolvedStartedAt)
      || !Number.isFinite(resolvedEndedAt)
      || resolvedEndedAt < resolvedStartedAt
    ) return false;
    const durationMs = resolvedEndedAt - resolvedStartedAt;
    const resolvedIntervalMs = normalizeNonNegative(intervalMs);
    const resolvedInputToFrameMs = normalizeNonNegative(inputToFrameMs);
    const resolvedSkippedMs = normalizeNonNegative(skippedMs);
    const record = {
      id: state.nextEventId++,
      startedAt: resolvedStartedAt,
      endedAt: resolvedEndedAt,
      durationMs,
      intervalMs: resolvedIntervalMs,
      inputToFrameMs: resolvedInputToFrameMs,
      skippedMs: resolvedSkippedMs,
      activeControllerCount: Math.max(0, Number(activeControllerCount) || 0),
      targetKind: normalizeToken(targetKind),
      activeAfter: activeAfter === true,
    };
    state.scrollFrameCount += 1;
    state.scrollFrameWorkTotalMs += durationMs;
    state.scrollFrameWorkMaxMs = Math.max(state.scrollFrameWorkMaxMs, durationMs);
    state.scrollIntervalTotalMs += resolvedIntervalMs;
    state.scrollIntervalMaxMs = Math.max(state.scrollIntervalMaxMs, resolvedIntervalMs);
    if (resolvedInputToFrameMs > 0) {
      state.scrollInputFrameCount += 1;
      state.scrollInputToFrameTotalMs += resolvedInputToFrameMs;
      state.scrollInputToFrameMaxMs = Math.max(
        state.scrollInputToFrameMaxMs,
        resolvedInputToFrameMs,
      );
    }
    if (resolvedSkippedMs > 0) {
      state.scrollSkippedFrameCount += 1;
      state.scrollSkippedTotalMs += resolvedSkippedMs;
    }
    pushBounded(
      state.scrollFrames,
      record,
      SCROLL_FRAME_RETENTION_LIMIT,
      'droppedScrollFrames',
    );
    return true;
  } finally {
    recordInstrumentation('scrollFrame', recordStartedAt);
  }
}

export function recordRuntimeOwnerWork({
  ownerId,
  phase,
  startedAt,
  endedAt,
  source = 'unknown',
  units = 0,
  flushId = null,
  queueWaitMs = 0,
  subscribers = [],
} = {}) {
  if (!state.active || !OWNER_IDS.has(ownerId)) return false;
  const recordStartedAt = nowMs();
  try {
    const resolvedStartedAt = Number(startedAt);
    const resolvedEndedAt = Number(endedAt);
    if (
      !Number.isFinite(resolvedStartedAt)
      || !Number.isFinite(resolvedEndedAt)
      || resolvedEndedAt < resolvedStartedAt
    ) return false;
    const durationMs = resolvedEndedAt - resolvedStartedAt;
    const record = {
      id: state.nextEventId++,
      ownerId,
      phase: normalizeToken(phase),
      source: normalizeToken(source),
      startedAt: resolvedStartedAt,
      endedAt: resolvedEndedAt,
      durationMs,
      units: Math.max(0, Number(units) || 0),
      flushId: normalizeOptionalPositiveInteger(flushId),
      queueWaitMs: normalizeNonNegative(queueWaitMs),
      subscribers: ownerId === 'observerHub'
        ? normalizeSubscriberSpans(subscribers, resolvedStartedAt, resolvedEndedAt)
        : [],
    };
    state.ownerWorkCount += 1;
    state.ownerWorkTotalMs += durationMs;
    state.ownerWorkMaxMs = Math.max(state.ownerWorkMaxMs, durationMs);
    let ownerStat = state.ownerStats.get(ownerId);
    if (!ownerStat) {
      ownerStat = { calls: 0, totalMs: 0, maxMs: 0, totalUnits: 0 };
      state.ownerStats.set(ownerId, ownerStat);
    }
    ownerStat.calls += 1;
    ownerStat.totalMs += durationMs;
    ownerStat.maxMs = Math.max(ownerStat.maxMs, durationMs);
    ownerStat.totalUnits += record.units;
    pushBounded(state.ownerWork, record, OWNER_WORK_RETENTION_LIMIT, 'droppedOwnerWork');
    return true;
  } finally {
    recordInstrumentation('ownerWork', recordStartedAt);
  }
}

function calculateOverlapMs(startedAt, endedAt, windowStartedAt, windowEndedAt) {
  return Math.max(
    0,
    Math.min(endedAt, windowEndedAt) - Math.max(startedAt, windowStartedAt),
  );
}

function createClippedInterval(entry, windowStartedAt, windowEndedAt) {
  const startedAt = Math.max(entry.startedAt, windowStartedAt);
  const endedAt = Math.min(entry.endedAt, windowEndedAt);
  if (endedAt <= startedAt) return null;
  return { startedAt, endedAt };
}

function calculateIntervalUnionMs(intervals) {
  const ordered = intervals
    .filter(Boolean)
    .sort((left, right) => left.startedAt - right.startedAt);
  if (ordered.length === 0) return 0;
  let coveredMs = 0;
  let currentStartedAt = ordered[0].startedAt;
  let currentEndedAt = ordered[0].endedAt;
  for (let index = 1; index < ordered.length; index += 1) {
    const interval = ordered[index];
    if (interval.startedAt <= currentEndedAt) {
      currentEndedAt = Math.max(currentEndedAt, interval.endedAt);
      continue;
    }
    coveredMs += currentEndedAt - currentStartedAt;
    currentStartedAt = interval.startedAt;
    currentEndedAt = interval.endedAt;
  }
  return coveredMs + (currentEndedAt - currentStartedAt);
}

function mergeIntervals(intervals) {
  const ordered = intervals
    .filter(Boolean)
    .sort((left, right) => left.startedAt - right.startedAt);
  const merged = [];
  for (const interval of ordered) {
    const current = merged.at(-1);
    if (!current || interval.startedAt > current.endedAt) {
      merged.push({ ...interval });
      continue;
    }
    current.endedAt = Math.max(current.endedAt, interval.endedAt);
  }
  return merged;
}

function calculateIntervalSetIntersectionMs(leftIntervals, rightIntervals) {
  const left = mergeIntervals(leftIntervals);
  const right = mergeIntervals(rightIntervals);
  let leftIndex = 0;
  let rightIndex = 0;
  let overlapMs = 0;
  while (leftIndex < left.length && rightIndex < right.length) {
    overlapMs += calculateOverlapMs(
      left[leftIndex].startedAt,
      left[leftIndex].endedAt,
      right[rightIndex].startedAt,
      right[rightIndex].endedAt,
    );
    if (left[leftIndex].endedAt <= right[rightIndex].endedAt) leftIndex += 1;
    else rightIndex += 1;
  }
  return overlapMs;
}

function retainedKindCoversWindow(entries, droppedCount, windowStartedAt) {
  if (droppedCount === 0) return true;
  const earliestRetained = entries[0];
  return Boolean(earliestRetained && earliestRetained.endedAt <= windowStartedAt);
}

function summarizeWindowOwnerEntries(entries, windowStartedAt, windowEndedAt) {
  const byOwner = new Map();
  const intervals = [];
  let spanTotalMs = 0;
  entries.forEach((entry) => {
    const interval = createClippedInterval(entry, windowStartedAt, windowEndedAt);
    if (!interval) return;
    const overlapMs = interval.endedAt - interval.startedAt;
    intervals.push(interval);
    spanTotalMs += overlapMs;
    const current = byOwner.get(entry.ownerId) || {
      ownerId: entry.ownerId,
      operationCount: 0,
      spanTotalMs: 0,
      intervals: [],
    };
    current.operationCount += 1;
    current.spanTotalMs += overlapMs;
    current.intervals.push(interval);
    byOwner.set(entry.ownerId, current);
  });
  return {
    intervals,
    operationCount: Array.from(byOwner.values()).reduce(
      (total, entry) => total + entry.operationCount,
      0,
    ),
    spanTotalMs,
    coveredMs: calculateIntervalUnionMs(intervals),
    byOwner: Array.from(byOwner.values())
      .map((entry) => ({
        ownerId: entry.ownerId,
        operationCount: entry.operationCount,
        spanTotalMs: roundMs(entry.spanTotalMs),
        coveredMs: roundMs(calculateIntervalUnionMs(entry.intervals)),
      }))
      .sort((left, right) => right.coveredMs - left.coveredMs),
  };
}

function createWindowTimelineEntry(entry, windowStartedAt, windowEndedAt, overrides = {}) {
  const interval = createClippedInterval(entry, windowStartedAt, windowEndedAt);
  if (!interval) return null;
  return {
    ownerId: overrides.ownerId || entry.ownerId,
    phase: overrides.phase || entry.phase || 'unknown',
    source: overrides.source || entry.source || 'unknown',
    relation: overrides.relation || 'owner_span',
    startedAt: roundMs(interval.startedAt),
    endedAt: roundMs(interval.endedAt),
    durationMs: roundMs(interval.endedAt - interval.startedAt),
    flushId: overrides.flushId ?? entry.flushId ?? null,
  };
}

function createWindowOwnerTimeline(
  ownerEntries,
  scrollFrames,
  windowStartedAt,
  windowEndedAt,
) {
  const entries = [];
  ownerEntries.forEach((entry) => {
    const ownerEntry = createWindowTimelineEntry(
      entry,
      windowStartedAt,
      windowEndedAt,
    );
    if (ownerEntry) entries.push(ownerEntry);
    if (entry.ownerId !== 'observerHub') return;
    entry.subscribers.forEach((subscriber) => {
      const subscriberEntry = createWindowTimelineEntry(
        subscriber,
        windowStartedAt,
        windowEndedAt,
        {
          ownerId: `observerSubscriber:${subscriber.ownerId}`,
          phase: 'subscriber_callback',
          source: 'observer_hub_subscriber',
          relation: 'nested_observer_subscriber',
          flushId: entry.flushId,
        },
      );
      if (subscriberEntry) entries.push(subscriberEntry);
    });
  });
  scrollFrames.forEach((entry) => {
    const timelineEntry = createWindowTimelineEntry(
      entry,
      windowStartedAt,
      windowEndedAt,
      {
        ownerId: 'scrollPhysics',
        phase: 'controller_frame',
        source: 'request_animation_frame',
      },
    );
    if (timelineEntry) entries.push(timelineEntry);
  });
  entries.sort((left, right) => (
    left.startedAt - right.startedAt
    || left.endedAt - right.endedAt
    || left.ownerId.localeCompare(right.ownerId)
  ));
  const totalEntryCount = entries.length;
  const retainedEntries = entries.slice(0, WINDOW_TIMELINE_RETENTION_LIMIT);
  const droppedEntryCount = Math.max(0, totalEntryCount - retainedEntries.length);
  return {
    state: droppedEntryCount === 0 ? 'measured' : 'incomplete',
    reason: droppedEntryCount === 0
      ? 'bounded_scalar_owner_timeline_measured'
      : 'bounded_scalar_owner_timeline_retention_incomplete',
    semantics: 'nested_owner_spans_are_non_additive_temporal_correlation_evidence',
    retentionLimit: WINDOW_TIMELINE_RETENTION_LIMIT,
    totalEntryCount,
    retainedEntryCount: retainedEntries.length,
    droppedEntryCount,
    entries: retainedEntries,
  };
}

export function projectRuntimeContentionWindow({ startedAt, endedAt } = {}) {
  if (!state.active) {
    throw new Error('RUNTIME_CONTENTION_WINDOW_SESSION_INACTIVE');
  }
  const windowStartedAt = Number(startedAt);
  const windowEndedAt = Number(endedAt);
  if (
    !Number.isFinite(windowStartedAt)
    || !Number.isFinite(windowEndedAt)
    || windowStartedAt < 0
    || windowEndedAt < windowStartedAt
    || windowEndedAt - windowStartedAt > 30_000
  ) {
    throw new Error('RUNTIME_CONTENTION_WINDOW_BOUNDS_INVALID');
  }

  drainLongTaskEntries(state.longTaskObserver?.takeRecords?.());
  const scrollOwnerEntries = state.scrollFrames.map((entry) => ({
    ...entry,
    ownerId: 'scrollPhysics',
  }));
  const ownerSummary = summarizeWindowOwnerEntries(
    [...state.ownerWork, ...scrollOwnerEntries],
    windowStartedAt,
    windowEndedAt,
  );
  const ownerTimeline = createWindowOwnerTimeline(
    state.ownerWork,
    state.scrollFrames,
    windowStartedAt,
    windowEndedAt,
  );
  const longTaskIntervals = state.longTasks
    .map((entry) => createClippedInterval(entry, windowStartedAt, windowEndedAt))
    .filter(Boolean);
  const longTaskCoveredMs = calculateIntervalUnionMs(longTaskIntervals);
  const instrumentedOwnerLongTaskOverlapMs = calculateIntervalSetIntersectionMs(
    ownerSummary.intervals,
    longTaskIntervals,
  );
  const durationMs = windowEndedAt - windowStartedAt;
  const retention = {
    scrollFramesComplete: retainedKindCoversWindow(
      state.scrollFrames,
      state.droppedScrollFrames,
      windowStartedAt,
    ),
    ownerWorkComplete: retainedKindCoversWindow(
      state.ownerWork,
      state.droppedOwnerWork,
      windowStartedAt,
    ),
    longTasksComplete: retainedKindCoversWindow(
      state.longTasks,
      state.droppedLongTasks,
      windowStartedAt,
    ),
  };
  const complete = windowStartedAt >= state.startedAt
    && Object.values(retention).every(Boolean)
    && ownerTimeline.state === 'measured';

  return {
    schemaVersion: RUNTIME_CONTENTION_LEDGER_SCHEMA_VERSION,
    state: complete ? 'measured' : 'incomplete',
    reason: complete
      ? 'runtime_contention_window_measured'
      : 'runtime_contention_window_retention_incomplete',
    semantics: 'instrumented_entropy_owner_wall_time_union_not_cpu_attribution',
    clock: 'performance_now_monotonic',
    window: {
      startedAt: roundMs(windowStartedAt),
      endedAt: roundMs(windowEndedAt),
      durationMs: roundMs(durationMs),
    },
    entropy: {
      operationCount: ownerSummary.operationCount,
      coveredMs: roundMs(ownerSummary.coveredMs),
      spanTotalMs: roundMs(ownerSummary.spanTotalMs),
      timingDimensionsAreAdditive: false,
      coverageRatio: durationMs > 0
        ? Number((ownerSummary.coveredMs / durationMs).toFixed(4))
        : 0,
      byOwner: ownerSummary.byOwner,
      timeline: ownerTimeline,
    },
    longTasks: {
      count: longTaskIntervals.length,
      coveredMs: roundMs(longTaskCoveredMs),
      instrumentedEntropyOverlapMs: roundMs(instrumentedOwnerLongTaskOverlapMs),
      residualCoveredMs: roundMs(Math.max(
        0,
        longTaskCoveredMs - instrumentedOwnerLongTaskOverlapMs,
      )),
    },
    retention: {
      complete,
      ...retention,
      droppedScrollFrames: state.droppedScrollFrames,
      droppedOwnerWork: state.droppedOwnerWork,
      droppedLongTasks: state.droppedLongTasks,
    },
    instrumentation: {
      retainsDomNodes: false,
      extraDomReads: 0,
    },
  };
}

function createWorkContributors(frame, waitWindowStartedAt) {
  const contributors = [];
  for (const work of state.ownerWork) {
    const overlapMs = calculateOverlapMs(
      work.startedAt,
      work.endedAt,
      waitWindowStartedAt,
      frame.startedAt,
    );
    if (overlapMs <= 0) continue;

    if (work.ownerId === 'observerHub' && work.subscribers.length > 0) {
      let subscriberOverlapMs = 0;
      work.subscribers.forEach((subscriber) => {
        const subscriberOverlap = calculateOverlapMs(
          subscriber.startedAt,
          subscriber.endedAt,
          waitWindowStartedAt,
          frame.startedAt,
        );
        if (subscriberOverlap <= 0) return;
        subscriberOverlapMs += subscriberOverlap;
        contributors.push({
          ownerId: `observerSubscriber:${subscriber.ownerId}`,
          phase: 'subscriber_callback',
          overlapMs: subscriberOverlap,
          durationMs: subscriber.durationMs,
          flushId: work.flushId,
        });
      });
      const projectionOverlapMs = Math.max(0, overlapMs - subscriberOverlapMs);
      if (projectionOverlapMs > 0) {
        contributors.push({
          ownerId: 'observerHub',
          phase: 'payload_projection_and_bookkeeping',
          overlapMs: projectionOverlapMs,
          durationMs: work.durationMs,
          flushId: work.flushId,
        });
      }
      continue;
    }

    contributors.push({
      ownerId: work.ownerId,
      phase: work.phase,
      overlapMs,
      durationMs: work.durationMs,
      flushId: work.flushId,
    });
  }

  for (const scrollFrame of state.scrollFrames) {
    if (scrollFrame.id === frame.id) continue;
    const overlapMs = calculateOverlapMs(
      scrollFrame.startedAt,
      scrollFrame.endedAt,
      waitWindowStartedAt,
      frame.startedAt,
    );
    if (overlapMs <= 0) continue;
    contributors.push({
      ownerId: 'scrollPhysics',
      phase: 'controller_frame',
      overlapMs,
      durationMs: scrollFrame.durationMs,
      flushId: null,
    });
  }

  return contributors.sort((left, right) => right.overlapMs - left.overlapMs);
}

function createLongTaskContributors(frame, waitWindowStartedAt) {
  return state.longTasks.flatMap((task) => {
    const overlapMs = calculateOverlapMs(
      task.startedAt,
      task.endedAt,
      waitWindowStartedAt,
      frame.startedAt,
    );
    return overlapMs > 0
      ? [{ id: task.id, durationMs: task.durationMs, overlapMs }]
      : [];
  }).sort((left, right) => right.overlapMs - left.overlapMs);
}

function createContentionProjection(frames, baselineIntervalMs, lateThresholdMs) {
  const lateFrames = frames
    .filter((frame) => (
      frame.intervalMs >= lateThresholdMs
      || frame.inputToFrameMs >= lateThresholdMs
    ))
    .sort((left, right) => (
      Math.max(right.intervalMs, right.inputToFrameMs)
      - Math.max(left.intervalMs, left.inputToFrameMs)
    ));
  const lateAnimationFrameCount = lateFrames.filter(
    (frame) => frame.intervalMs >= lateThresholdMs,
  ).length;
  const lateInputFrameCount = lateFrames.filter(
    (frame) => frame.inputToFrameMs >= lateThresholdMs,
  ).length;
  const ownerOverlap = new Map();
  let correlatedLateFrameCount = 0;
  let longTaskCorrelatedLateFrameCount = 0;

  const worstFrames = lateFrames.slice(0, SNAPSHOT_WORST_FRAME_LIMIT).map((frame) => {
    const waitWindowMs = Math.max(frame.intervalMs, frame.inputToFrameMs);
    const waitWindowStartedAt = Math.max(0, frame.startedAt - waitWindowMs);
    const contributors = createWorkContributors(frame, waitWindowStartedAt);
    const longTasks = createLongTaskContributors(frame, waitWindowStartedAt);
    if (contributors.length > 0 || longTasks.length > 0) correlatedLateFrameCount += 1;
    if (longTasks.length > 0) longTaskCorrelatedLateFrameCount += 1;
    contributors.forEach((contributor) => {
      const current = ownerOverlap.get(contributor.ownerId) || {
        ownerId: contributor.ownerId,
        overlapMs: 0,
        occurrences: 0,
      };
      current.overlapMs += contributor.overlapMs;
      current.occurrences += 1;
      ownerOverlap.set(contributor.ownerId, current);
    });
    return {
      frameId: frame.id,
      startedAt: roundMs(frame.startedAt),
      intervalMs: roundMs(frame.intervalMs),
      inputToFrameMs: roundMs(frame.inputToFrameMs),
      waitWindowMs: roundMs(waitWindowMs),
      excessMs: roundMs(Math.max(0, frame.intervalMs - baselineIntervalMs)),
      inputExcessMs: roundMs(Math.max(0, frame.inputToFrameMs - baselineIntervalMs)),
      workMs: roundMs(frame.durationMs),
      skippedMs: roundMs(frame.skippedMs),
      activeControllerCount: frame.activeControllerCount,
      targetKind: frame.targetKind,
      contributors: contributors.slice(0, 6).map((entry) => ({
        ...entry,
        overlapMs: roundMs(entry.overlapMs),
        durationMs: roundMs(entry.durationMs),
      })),
      longTasks: longTasks.slice(0, 3).map((entry) => ({
        ...entry,
        durationMs: roundMs(entry.durationMs),
        overlapMs: roundMs(entry.overlapMs),
      })),
    };
  });

  return {
    semantics: 'temporal_overlap_not_causal_proof',
    lateFrameCount: lateFrames.length,
    lateAnimationFrameCount,
    lateInputFrameCount,
    correlatedWorstFrameCount: correlatedLateFrameCount,
    longTaskCorrelatedWorstFrameCount: longTaskCorrelatedLateFrameCount,
    worstFrames,
    ownerOverlap: Array.from(ownerOverlap.values())
      .sort((left, right) => right.overlapMs - left.overlapMs)
      .slice(0, 16)
      .map((entry) => ({
        ...entry,
        overlapMs: roundMs(entry.overlapMs),
      })),
  };
}

function createInstrumentationSnapshot() {
  const instrumentation = state.instrumentation;
  return {
    retainsDomNodes: false,
    extraDomReads: 0,
    clock: 'performance_now_monotonic',
    recordCallCount: instrumentation.recordCallCount,
    recordOverheadMs: roundMs(instrumentation.recordOverheadMs),
    recordOverheadMaxMs: roundMs(instrumentation.recordOverheadMaxMs),
    recordCallCountByKind: { ...instrumentation.recordCallCountByKind },
    recordOverheadByKind: Object.fromEntries(Object.entries(
      instrumentation.recordOverheadByKind,
    ).map(([key, value]) => [key, roundMs(value)])),
    longTaskObserverCallbackCount: instrumentation.longTaskObserverCallbackCount,
    longTaskObserverCallbackMs: roundMs(instrumentation.longTaskObserverCallbackMs),
    longTaskObserverCallbackMaxMs: roundMs(
      instrumentation.longTaskObserverCallbackMaxMs,
    ),
    snapshotReadCount: instrumentation.snapshotReadCount,
    snapshotReadOverheadMs: roundMs(instrumentation.snapshotReadOverheadMs),
    snapshotReadOverheadMaxMs: roundMs(instrumentation.snapshotReadOverheadMaxMs),
    sessionSetupMs: roundMs(instrumentation.sessionSetupMs),
  };
}

export function readRuntimeContentionLedgerSnapshot() {
  const snapshotStartedAt = nowMs();
  if (state.active) drainLongTaskEntries(state.longTaskObserver?.takeRecords?.());

  const retainedFrames = [...state.scrollFrames];
  const intervals = retainedFrames
    .map((frame) => frame.intervalMs)
    .filter((value) => value > 0);
  const inputToFrameSamples = retainedFrames
    .map((frame) => frame.inputToFrameMs)
    .filter((value) => value > 0);
  const pagedIntentInputEntries = state.ownerWork.filter((entry) => (
    entry.ownerId === 'scrollPagedIntent' && entry.phase === 'intent_input'
  ));
  const pagedCommitEntries = state.ownerWork.filter((entry) => (
    entry.ownerId === 'scrollPagedIntent' && entry.phase === 'snap_commit'
  ));
  const baselineIntervalMs = intervals.length >= 8
    ? percentile(intervals, 0.25)
    : percentile(intervals, 0.5);
  const lateThresholdMs = baselineIntervalMs > 0
    ? baselineIntervalMs + Math.max(3, baselineIntervalMs * 0.25)
    : 0;
  const contention = lateThresholdMs > 0
    ? createContentionProjection(retainedFrames, baselineIntervalMs, lateThresholdMs)
    : {
      semantics: 'temporal_overlap_not_causal_proof',
      lateFrameCount: 0,
      lateAnimationFrameCount: 0,
      lateInputFrameCount: 0,
      correlatedWorstFrameCount: 0,
      longTaskCorrelatedWorstFrameCount: 0,
      worstFrames: [],
      ownerOverlap: [],
    };
  const measured = state.scrollFrameCount > 0
    || state.ownerWorkCount > 0
    || state.longTaskCount > 0;

  const snapshot = {
    schemaVersion: RUNTIME_CONTENTION_LEDGER_SCHEMA_VERSION,
    state: measured ? 'measured' : (state.active ? 'armed_idle' : 'inactive'),
    reason: measured
      ? 'runtime_contention_timeline_measured'
      : (state.active
        ? 'runtime_contention_timeline_armed_idle'
        : 'runtime_contention_session_inactive'),
    active: state.active,
    generation,
    startedAt: state.startedAt === null ? null : roundMs(state.startedAt),
    complete: state.droppedScrollFrames === 0
      && state.droppedOwnerWork === 0
      && state.droppedLongTasks === 0,
    retention: {
      scrollFrameLimit: SCROLL_FRAME_RETENTION_LIMIT,
      ownerWorkLimit: OWNER_WORK_RETENTION_LIMIT,
      longTaskLimit: LONG_TASK_RETENTION_LIMIT,
      retainedScrollFrames: state.scrollFrames.length,
      retainedOwnerWork: state.ownerWork.length,
      retainedLongTasks: state.longTasks.length,
      droppedScrollFrames: state.droppedScrollFrames,
      droppedOwnerWork: state.droppedOwnerWork,
      droppedLongTasks: state.droppedLongTasks,
    },
    scroll: {
      frameCount: state.scrollFrameCount,
      pagedIntentInputCount: pagedIntentInputEntries.length,
      pagedCommitCount: pagedCommitEntries.length,
      pagedCommitTotalWorkMs: roundMs(pagedCommitEntries.reduce(
        (total, entry) => total + entry.durationMs,
        0,
      )),
      pagedCommitMaxWorkMs: roundMs(pagedCommitEntries.reduce(
        (maximum, entry) => Math.max(maximum, entry.durationMs),
        0,
      )),
      totalWorkMs: roundMs(state.scrollFrameWorkTotalMs),
      maxWorkMs: roundMs(state.scrollFrameWorkMaxMs),
      avgWorkMs: state.scrollFrameCount > 0
        ? roundMs(state.scrollFrameWorkTotalMs / state.scrollFrameCount)
        : 0,
      avgIntervalMs: intervals.length > 0
        ? roundMs(intervals.reduce((total, value) => total + value, 0) / intervals.length)
        : 0,
      baselineIntervalMs: roundMs(baselineIntervalMs),
      lateThresholdMs: roundMs(lateThresholdMs),
      p95IntervalMs: roundMs(percentile(intervals, 0.95)),
      maxIntervalMs: roundMs(state.scrollIntervalMaxMs),
      inputFrameCount: state.scrollInputFrameCount,
      avgInputToFrameMs: state.scrollInputFrameCount > 0
        ? roundMs(state.scrollInputToFrameTotalMs / state.scrollInputFrameCount)
        : 0,
      p95InputToFrameMs: roundMs(percentile(inputToFrameSamples, 0.95)),
      maxInputToFrameMs: roundMs(state.scrollInputToFrameMaxMs),
      skippedFrameCount: state.scrollSkippedFrameCount,
      skippedTotalMs: roundMs(state.scrollSkippedTotalMs),
    },
    ownerWork: {
      operationCount: state.ownerWorkCount,
      totalMs: roundMs(state.ownerWorkTotalMs),
      maxMs: roundMs(state.ownerWorkMaxMs),
      byOwner: Array.from(state.ownerStats.entries())
        .map(([ownerId, entry]) => ({
          ownerId,
          calls: entry.calls,
          totalMs: roundMs(entry.totalMs),
          maxMs: roundMs(entry.maxMs),
          totalUnits: entry.totalUnits,
        }))
        .sort((left, right) => right.totalMs - left.totalMs),
      recent: state.ownerWork.slice(-SNAPSHOT_RECENT_WORK_LIMIT).map((entry) => ({
        id: entry.id,
        ownerId: entry.ownerId,
        phase: entry.phase,
        source: entry.source,
        startedAt: roundMs(entry.startedAt),
        durationMs: roundMs(entry.durationMs),
        units: entry.units,
        flushId: entry.flushId,
        queueWaitMs: roundMs(entry.queueWaitMs),
        subscriberCount: entry.subscribers.length,
      })),
    },
    longTasks: {
      supported: state.longTaskSupported,
      count: state.longTaskCount,
      totalMs: roundMs(state.longTaskTotalMs),
      maxMs: roundMs(state.longTaskMaxMs),
    },
    contention,
    instrumentation: createInstrumentationSnapshot(),
  };

  const snapshotElapsedMs = Math.max(0, nowMs() - snapshotStartedAt);
  state.instrumentation.snapshotReadCount += 1;
  state.instrumentation.snapshotReadOverheadMs += snapshotElapsedMs;
  state.instrumentation.snapshotReadOverheadMaxMs = Math.max(
    state.instrumentation.snapshotReadOverheadMaxMs,
    snapshotElapsedMs,
  );
  snapshot.instrumentation = createInstrumentationSnapshot();
  return snapshot;
}
