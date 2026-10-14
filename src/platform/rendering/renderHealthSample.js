export const RENDER_HEALTH_SAMPLE_SCHEMA_VERSION = 1;

function readFinite(value, field, { minimum = 0, nullable = false } = {}) {
  if (nullable && (value === null || value === undefined)) return null;
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric < minimum) {
    throw new Error(`RENDER_HEALTH_${field.toUpperCase()}_INVALID`);
  }
  return numeric;
}

function readSurfaceId(value) {
  const normalized = typeof value === 'string' ? value.trim() : '';
  if (!normalized) throw new Error('RENDER_HEALTH_SURFACE_ID_INVALID');
  return normalized;
}

export function createRenderHealthSample({
  surfaceId,
  observedAtMs,
  frameIntervalMs,
  updateWorkMs,
  renderWorkMs,
  gpuWorkMs = null,
  droppedFrameRatio = 0,
  visible,
  viewportWidth,
  viewportHeight,
  effectivePixelRatio,
} = {}) {
  if (typeof visible !== 'boolean') {
    throw new Error('RENDER_HEALTH_VISIBLE_INVALID');
  }
  const resolvedUpdateWorkMs = readFinite(updateWorkMs, 'update_work_ms');
  const resolvedRenderWorkMs = readFinite(renderWorkMs, 'render_work_ms');
  const resolvedDroppedFrameRatio = readFinite(droppedFrameRatio, 'dropped_frame_ratio');
  if (resolvedDroppedFrameRatio > 1) {
    throw new Error('RENDER_HEALTH_DROPPED_FRAME_RATIO_OUT_OF_RANGE');
  }

  return Object.freeze({
    schemaVersion: RENDER_HEALTH_SAMPLE_SCHEMA_VERSION,
    surfaceId: readSurfaceId(surfaceId),
    observedAtMs: readFinite(observedAtMs, 'observed_at_ms'),
    frameIntervalMs: readFinite(frameIntervalMs, 'frame_interval_ms', { minimum: 0.01 }),
    updateWorkMs: resolvedUpdateWorkMs,
    renderWorkMs: resolvedRenderWorkMs,
    totalWorkMs: resolvedUpdateWorkMs + resolvedRenderWorkMs,
    gpuWorkMs: readFinite(gpuWorkMs, 'gpu_work_ms', { nullable: true }),
    droppedFrameRatio: resolvedDroppedFrameRatio,
    visible,
    viewportWidth: readFinite(viewportWidth, 'viewport_width', { minimum: 1 }),
    viewportHeight: readFinite(viewportHeight, 'viewport_height', { minimum: 1 }),
    effectivePixelRatio: readFinite(
      effectivePixelRatio,
      'effective_pixel_ratio',
      { minimum: 0.01 },
    ),
  });
}

export function assertRenderHealthSample(sample) {
  if (sample?.schemaVersion !== RENDER_HEALTH_SAMPLE_SCHEMA_VERSION) {
    throw new Error('RENDER_HEALTH_SAMPLE_CONTRACT_REQUIRED');
  }
  readSurfaceId(sample.surfaceId);
  readFinite(sample.observedAtMs, 'observed_at_ms');
  readFinite(sample.frameIntervalMs, 'frame_interval_ms', { minimum: 0.01 });
  const updateWorkMs = readFinite(sample.updateWorkMs, 'update_work_ms');
  const renderWorkMs = readFinite(sample.renderWorkMs, 'render_work_ms');
  const totalWorkMs = readFinite(sample.totalWorkMs, 'total_work_ms');
  readFinite(sample.gpuWorkMs, 'gpu_work_ms', { nullable: true });
  const droppedFrameRatio = readFinite(sample.droppedFrameRatio, 'dropped_frame_ratio');
  if (droppedFrameRatio > 1) {
    throw new Error('RENDER_HEALTH_DROPPED_FRAME_RATIO_OUT_OF_RANGE');
  }
  if (typeof sample.visible !== 'boolean') {
    throw new Error('RENDER_HEALTH_VISIBLE_INVALID');
  }
  readFinite(sample.viewportWidth, 'viewport_width', { minimum: 1 });
  readFinite(sample.viewportHeight, 'viewport_height', { minimum: 1 });
  readFinite(sample.effectivePixelRatio, 'effective_pixel_ratio', { minimum: 0.01 });
  if (Math.abs(totalWorkMs - (updateWorkMs + renderWorkMs)) > 0.001) {
    throw new Error('RENDER_HEALTH_TOTAL_WORK_MS_MISMATCH');
  }
  return sample;
}
