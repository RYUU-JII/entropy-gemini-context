const MAX_ARTIFACT_METRICS = 24;

const hasWindow = () => typeof window !== 'undefined';
const isDevRuntime = () => (
  typeof import.meta !== 'undefined' && import.meta.env?.DEV === true
);

const round = (value, digits = 2) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return 0;
  const factor = 10 ** digits;
  return Math.round(parsed * factor) / factor;
};

const metricState = new Map();
let debugBridgeReady = false;

function trimMetricState() {
  if (metricState.size <= MAX_ARTIFACT_METRICS) return;
  const keys = Array.from(metricState.keys());
  const removeCount = metricState.size - MAX_ARTIFACT_METRICS;
  keys.slice(0, removeCount).forEach((key) => metricState.delete(key));
}

function getSnapshot() {
  return Object.freeze(
    Array.from(metricState.values()).map((entry) => Object.freeze({
      ...entry,
      lastSample: entry.lastSample ? Object.freeze({ ...entry.lastSample }) : null,
    })),
  );
}

function ensureDebugBridge() {
  if (!hasWindow() || debugBridgeReady || !isDevRuntime()) return;

  Object.defineProperty(window, '__ENTROPY_ARTIFACT_RUNTIME_METRICS__', {
    configurable: true,
    enumerable: false,
    writable: false,
    value: Object.freeze({
      getSnapshot,
      clear: () => metricState.clear(),
    }),
  });
  debugBridgeReady = true;
}

export function recordArtifactRuntimeMetric({
  artifactId = '',
  visualKey = '',
  budgetMode = '',
  runtimeBudget = null,
  sample = null,
} = {}) {
  if (!isDevRuntime() || !sample || typeof sample !== 'object') return;
  ensureDebugBridge();

  const key = `${artifactId || 'artifact'}:${visualKey || 'visual'}`;
  const previous = metricState.get(key) || {
    artifactId,
    visualKey,
    budgetMode,
    sampleCount: 0,
    totalRenderCount: 0,
    totalSimStepCount: 0,
    maxFrameDeltaMs: 0,
    lastSample: null,
  };

  const next = {
    ...previous,
    artifactId,
    visualKey,
    budgetMode,
    runtimeBudget: runtimeBudget ? {
      targetFps: Number(runtimeBudget.targetFps) || 0,
      simHz: Number(runtimeBudget.simHz) || 0,
      particleScale: Number(runtimeBudget.particleScale) || 0,
      allowHeavyEffects: runtimeBudget.allowHeavyEffects === true,
    } : null,
    sampleCount: previous.sampleCount + 1,
    totalRenderCount: previous.totalRenderCount + Math.max(0, Math.floor(Number(sample.renderCount) || 0)),
    totalSimStepCount: previous.totalSimStepCount + Math.max(0, Math.floor(Number(sample.simStepCount) || 0)),
    maxFrameDeltaMs: Math.max(previous.maxFrameDeltaMs, round(sample.maxFrameDeltaMs)),
    lastSample: {
      durationMs: round(sample.durationMs),
      frameCount: Math.max(0, Math.floor(Number(sample.frameCount) || 0)),
      renderCount: Math.max(0, Math.floor(Number(sample.renderCount) || 0)),
      simStepCount: Math.max(0, Math.floor(Number(sample.simStepCount) || 0)),
      averageFrameDeltaMs: round(sample.averageFrameDeltaMs),
      maxFrameDeltaMs: round(sample.maxFrameDeltaMs),
      targetFps: Number(sample.targetFps) || 0,
      simHz: Number(sample.simHz) || 0,
    },
  };

  metricState.set(key, Object.freeze(next));
  trimMetricState();
}

export function shouldRecordArtifactRuntimeMetrics() {
  return isDevRuntime();
}
