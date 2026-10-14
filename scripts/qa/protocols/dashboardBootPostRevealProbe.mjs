import { DASHBOARD_BOOT_EVENT_NAME } from '../../../src/apps/dashboard/bootstrap/bootEvents.js';
import { evaluate, sleep } from '../../e2e/extensionChromiumHarness.mjs';

export function requireDashboardPostRevealOptions({
  postRevealMs = 1000, themeId, interaction = 'none', renderTrace = false,
  renderTraceProfile = 'rendering',
} = {}) {
  if (!Number.isInteger(postRevealMs) || postRevealMs < 1000 || postRevealMs > 120000) {
    throw new Error('QA_BOOT_POST_REVEAL_DURATION_INVALID');
  }
  if (!['rendering', 'gpu-startup'].includes(renderTraceProfile)) {
    throw new Error('QA_BOOT_RENDER_TRACE_PROFILE_INVALID');
  }
  if (renderTraceProfile === 'gpu-startup'
    && (!renderTrace || themeId !== 'zen' || interaction !== 'none')) {
    throw new Error('QA_BOOT_GPU_STARTUP_TRACE_REQUIRES_ZEN_IDLE_RENDER_TRACE');
  }
  if (postRevealMs > 1000 && (themeId !== 'zen' || interaction !== 'none'
    || (renderTrace && renderTraceProfile !== 'gpu-startup'))) {
    throw new Error('QA_BOOT_EXTENDED_OBSERVATION_REQUIRES_ZEN_IDLE_WITHOUT_RENDER_TRACE');
  }
  return { windowMs: postRevealMs, collectWorkerMetrics: postRevealMs > 1000 };
}

// QA evidence DTO only. The first native metrics response remains complete;
// later responses retain the named steady fields and exact changed journals.
// References always name an earlier snapshot that owns the complete value.
export function createDashboardPostRevealWorkerMetricsProjector() {
  const primitiveFields = [
    'path', 'rendererKind', 'qualityMode', 'supportsWorkerRaf',
    'sampleFrames', 'totalDtMs', 'avgDtMs', 'maxDtMs',
    'over24', 'over32', 'over50', 'over100', 'viewportReflowCount',
    'sceneSessionSyncCount', 'runtimeParamSyncCount', 'fishRosterSyncCount',
    'ambientPopulationSyncCount', 'staticSceneSyncCount', 'fishRenderCount',
  ];
  const structuredFields = [
    'viewport', 'sceneLayout', 'mainMetrics', 'surfaceDisturbanceTelemetry', 'workerMetrics',
  ];
  const referencedFields = ['runtimeHealth', 'spikeJournal', 'homeRendererJournal', 'lastSpike'];
  const retained = new Map();
  let nextSnapshotIndex = 0;
  const project = (metrics, snapshotIndex) => {
    if (snapshotIndex !== nextSnapshotIndex || !Number.isInteger(snapshotIndex)) {
      throw new Error('QA_BOOT_WORKER_METRICS_DTO_SNAPSHOT_ORDER_INVALID');
    }
    const initial = snapshotIndex === 0;
    const projected = initial ? { ...metrics } : {};
    if (!initial) {
      for (const key of [...primitiveFields, ...structuredFields]) {
        if (Object.hasOwn(metrics, key)) projected[key] = metrics[key];
      }
    }
    const metricsReferences = {};
    for (const key of referencedFields) {
      if (!Object.hasOwn(metrics, key)) continue;
      const serialized = JSON.stringify(metrics[key]);
      if (typeof serialized !== 'string') {
        throw new Error(`QA_BOOT_WORKER_METRICS_DTO_VALUE_INVALID:${key}`);
      }
      const previous = retained.get(key);
      if (previous && previous.serialized === serialized) {
        metricsReferences[key] = previous.snapshotIndex;
      } else {
        projected[key] = metrics[key];
        retained.set(key, { serialized, snapshotIndex });
      }
    }
    nextSnapshotIndex += 1;
    return { metricsKind: initial ? 'initial_full' : 'steady', metricsReferences, metrics: projected };
  };
  return { projection: 'dashboard_boot_worker_metrics_v1', project };
}

export function resolveDashboardPostRevealWorkerMetricsSnapshot(workerMetrics, snapshotIndex) {
  if (workerMetrics?.projection !== createDashboardPostRevealWorkerMetricsProjector().projection
    || !Array.isArray(workerMetrics.snapshots) || !Number.isInteger(snapshotIndex)
    || snapshotIndex < 0 || snapshotIndex >= workerMetrics.snapshots.length) {
    throw new Error('QA_BOOT_WORKER_METRICS_DTO_INVALID');
  }
  const sample = workerMetrics.snapshots[snapshotIndex];
  if (sample?.metricsKind !== (snapshotIndex === 0 ? 'initial_full' : 'steady')
    || !sample.metrics || typeof sample.metrics !== 'object' || Array.isArray(sample.metrics)
    || !sample.metricsReferences || typeof sample.metricsReferences !== 'object'
    || Array.isArray(sample.metricsReferences)) {
    throw new Error('QA_BOOT_WORKER_METRICS_DTO_INVALID');
  }
  const metrics = { ...sample.metrics };
  for (const [key, ownerIndex] of Object.entries(sample.metricsReferences)) {
    if (!['runtimeHealth', 'spikeJournal', 'homeRendererJournal', 'lastSpike'].includes(key)
      || !Number.isInteger(ownerIndex) || ownerIndex < 0 || ownerIndex >= snapshotIndex
      || Object.hasOwn(sample.metrics, key)
      || !Object.hasOwn(workerMetrics.snapshots[ownerIndex]?.metrics || {}, key)) {
      throw new Error(`QA_BOOT_WORKER_METRICS_DTO_REFERENCE_INVALID:${key}`);
    }
    metrics[key] = workerMetrics.snapshots[ownerIndex].metrics[key];
  }
  return metrics;
}

// Installed only into the exact page owned by dashboard/boot, before navigation.
export function observeDashboardPostReveal(bootEventName, { windowMs, collectWorkerMetrics }, createWorkerMetricsProjector) {
  const workerMetricsProjector = collectWorkerMetrics ? createWorkerMetricsProjector() : null;
  const documentObservation = {
    timeOrigin: performance.timeOrigin,
    installedAtMs: performance.now(),
    initialVisibility: document.visibilityState,
    firstAnimationFrameAtMs: null,
    visibilityChanges: [],
  };
  let dropped = 0;
  requestAnimationFrame(() => { documentObservation.firstAnimationFrameAtMs = performance.now(); });
  const onVisibility = () => {
    if (documentObservation.visibilityChanges.length < 32) {
      documentObservation.visibilityChanges.push({ atMs: performance.now(), visibility: document.visibilityState });
    } else dropped++;
  };
  document.addEventListener('visibilitychange', onVisibility);
  const state = { status: 'waiting', result: null, documentObservation, workerSampleCount: 0 };
  window.__ENTROPY_QA_BOOT_POST_REVEAL__ = state;
  const tasks = [], gaps = [], intervals = [], workerSnapshots = [];
  state.partial = { tasks, rafIntervals: intervals, workerSnapshots };
  let start = null, visibilityAtStart = null, lastFrame = null, handle = 0;
  let workerTimer = 0, pendingMetrics = null, ending = false, workerError = null, previousFrames = null;
  const addTasks = entries => {
    for (const entry of entries) {
      if (tasks.length >= 4096) { dropped++; continue; }
      tasks.push({ startTime: entry.startTime, duration: entry.duration, name: entry.name });
    }
  };
  const observer = new PerformanceObserver(list => addTasks(list.getEntries()));
  observer.observe({ type: 'longtask', buffered: true });
  const readWorker = async checkpoint => {
    const requestedAtMs = performance.now();
    try {
      if (workerSnapshots.length >= 242) throw new Error('QA_BOOT_WORKER_SNAPSHOT_LIMIT');
      const debug = globalThis.__ZEN_POND_WATER_EFFECTS_DEBUG;
      if (typeof debug?.metrics !== 'function') throw new Error('QA_BOOT_WORKER_METRICS_UNAVAILABLE');
      const metrics = await debug.metrics();
      const receivedAtMs = performance.now();
      if (!metrics || metrics.error || !Number.isFinite(metrics.sampleFrames)) throw new Error('QA_BOOT_WORKER_METRICS_INVALID');
      for (const key of ['spikeJournal', 'homeRendererJournal']) {
        if (!Number.isFinite(metrics[key]?.timeOrigin) || !Array.isArray(metrics[key]?.entries)) {
          throw new Error(`QA_BOOT_WORKER_JOURNAL_UNAVAILABLE:${key}`);
        }
      }
      const sample = { checkpoint, requestedAtMs, receivedAtMs,
        durationMs: receivedAtMs - requestedAtMs, relativeRequestMs: requestedAtMs - start,
        frameDelta: previousFrames === null ? null : metrics.sampleFrames - previousFrames,
        // Preserve canonical journal/timing shapes. Repeated counters may be
        // stale transport data; they never certify a newly rendered frame.
        ...workerMetricsProjector.project(metrics, workerSnapshots.length) };
      workerSnapshots.push(sample); state.workerSampleCount = workerSnapshots.length;
      if (sample.frameDelta !== null && sample.frameDelta < 0) throw new Error('QA_BOOT_WORKER_FRAME_COUNTER_RESET');
      previousFrames = metrics.sampleFrames;
    } catch (error) {
      workerError = { message: String(error?.message || error), requestedAtMs, failedAtMs: performance.now() };
      state.workerError = workerError;
    }
  };
  const sampleWorker = checkpoint => {
    const requestedAtMs = performance.now();
    pendingMetrics = readWorker(checkpoint).finally(() => {
      pendingMetrics = null;
      if (!ending && !workerError && performance.now() < start + windowMs) {
        workerTimer = setTimeout(() => sampleWorker('interval'), Math.max(0, 500 - (performance.now() - requestedAtMs)));
      }
    });
  };
  const finish = async () => {
    if (ending) return;
    ending = true; clearTimeout(workerTimer);
    addTasks(observer.takeRecords()); observer.disconnect(); cancelAnimationFrame(handle);
    window.removeEventListener(bootEventName, onBoot);
    document.removeEventListener('visibilitychange', onVisibility);
    if (pendingMetrics) await pendingMetrics;
    if (collectWorkerMetrics && !workerError) await readWorker('final');
    const end = start + windowMs;
    const overlapping = tasks.filter(t => t.startTime < end && t.startTime + t.duration > start)
      .map(t => ({ ...t, relativeStartMs: t.startTime - start,
        overlapMs: Math.min(end, t.startTime + t.duration) - Math.max(start, t.startTime) }));
    state.result = { startTime: start, endTime: end, observedUntil: performance.now(),
      visibility: document.visibilityState, visibilityAtStart, windowMs, longTasks: overlapping,
      longTaskCount: overlapping.length, blockingMs: overlapping.reduce((sum, t) => sum + t.overlapMs, 0),
      rafGaps: gaps, rafIntervals: intervals, maxRafGapMs: gaps.length ? Math.max(...gaps) : null,
      over25Ms: gaps.filter(x => x > 25).length, droppedEntries: dropped,
      workerMetrics: { enabled: collectWorkerMetrics, intervalMs: 500,
        ...(collectWorkerMetrics ? { projection: workerMetricsProjector.projection } : {}),
        snapshots: workerSnapshots, error: workerError },
      documentObservation };
    state.status = 'complete';
    delete state.partial;
  };
  const frame = timestamp => {
    if (gaps.length < 65536) {
      gaps.push(timestamp - lastFrame);
      intervals.push({ startTime: lastFrame, endTime: timestamp, durationMs: timestamp - lastFrame,
        relativeStartMs: lastFrame - start });
    } else dropped++;
    lastFrame = timestamp;
    if (timestamp < start + windowMs) handle = requestAnimationFrame(frame);
    else setTimeout(finish, 80); // Allow the final completed task to reach the observer.
  };
  function onBoot(event) {
    if (start !== null || event.detail?.shellDismissed !== true) return;
    performance.mark('entropy-qa:boot-shell-dismissed');
    start = performance.now(); visibilityAtStart = document.visibilityState;
    lastFrame = start; state.startTime = start; state.status = 'observing';
    handle = requestAnimationFrame(frame);
    if (collectWorkerMetrics) sampleWorker('initial');
  }
  window.addEventListener(bootEventName, onBoot);
}

export async function installDashboardPostRevealProbe(cdp, sessionId, options = { windowMs: 1000, collectWorkerMetrics: false }) {
  await cdp.send('Page.addScriptToEvaluateOnNewDocument', {
    source: `(${observeDashboardPostReveal.toString()})(${JSON.stringify(DASHBOARD_BOOT_EVENT_NAME)},${JSON.stringify(options)},(${createDashboardPostRevealWorkerMetricsProjector.toString()}));`,
  }, sessionId, { timeoutMs: 5000 });
}

export function requireDashboardPostRevealResult(result) {
  const hidden = result.documentObservation.visibilityChanges.some(change => (
    change.atMs >= result.startTime && change.atMs <= result.endTime && change.visibility !== 'visible'
  ));
  if (result.visibility !== 'visible' || result.visibilityAtStart !== 'visible' || hidden
    || result.droppedEntries > 0 || !result.rafGaps.length || result.workerMetrics.error
    || (result.workerMetrics.enabled && result.workerMetrics.snapshots.length < 2)) {
    const error = new Error('QA_DASHBOARD_POST_REVEAL_OBSERVATION_INVALID');
    error.diagnostic = result;
    throw error;
  }
  if (result.workerMetrics.enabled) {
    for (let index = 0; index < result.workerMetrics.snapshots.length; index++) {
      const metrics = resolveDashboardPostRevealWorkerMetricsSnapshot(result.workerMetrics, index);
      if (!Number.isFinite(metrics.sampleFrames)) throw new Error('QA_BOOT_WORKER_METRICS_INVALID');
      for (const key of ['spikeJournal', 'homeRendererJournal']) {
        if (!Number.isFinite(metrics[key]?.timeOrigin) || !Array.isArray(metrics[key]?.entries)) {
          throw new Error(`QA_BOOT_WORKER_JOURNAL_UNAVAILABLE:${key}`);
        }
      }
    }
  }
  return result;
}

export async function collectDashboardPostRevealProbe(harness, page, signal, windowMs = 1000, { onObservation = null } = {}) {
  const deadline = Date.now() + windowMs + 12_000;
  while (Date.now() < deadline) {
    signal?.throwIfAborted();
    const state = await evaluate(harness.cdp, page.sessionId, `(() => {
      const probe = window.__ENTROPY_QA_BOOT_POST_REVEAL__;
      return probe?.status === 'complete' ? probe : { status: probe?.status,
        workerSampleCount: probe?.workerSampleCount, startTime: probe?.startTime, observedAtMs: performance.now() };
    })()`);
    if (state?.status === 'complete') {
      return requireDashboardPostRevealResult(state.result);
    }
    if (onObservation && state?.status === 'observing') await onObservation(state);
    await sleep(windowMs > 1000 ? 500 : 100);
  }
  const error = new Error('QA_DASHBOARD_POST_REVEAL_OBSERVATION_TIMEOUT');
  error.diagnostic = await evaluate(harness.cdp, page.sessionId, `({
    bootObservationStatus: window.__ENTROPY_QA_BOOT_POST_REVEAL__?.status,
    documentObservation: window.__ENTROPY_QA_BOOT_POST_REVEAL__?.documentObservation,
    workerSampleCount: window.__ENTROPY_QA_BOOT_POST_REVEAL__?.workerSampleCount,
    workerError: window.__ENTROPY_QA_BOOT_POST_REVEAL__?.workerError,
    partial: window.__ENTROPY_QA_BOOT_POST_REVEAL__?.partial,
    observedAtMs: performance.now(), visibility: document.visibilityState,
    hasFocus: document.hasFocus()
  })`);
  throw error;
}
