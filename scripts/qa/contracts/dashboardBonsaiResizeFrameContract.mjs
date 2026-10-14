const UPDATE_EVENT = 'bonsai_worker:update_scene';
const COMMIT_EVENT = 'bonsai_worker:scene_frame_committed';

const pending = reason => Object.freeze({ status: 'pending', reason });

// Scene signatures in the page trace are bounded summaries. Their lengths are
// not identity: the runtime emits COMMIT_EVENT only after its exact pending
// scene/materialization/input ACK check. Preserve that causal ordering instead.
export function projectDashboardBonsaiResizeFrame({ before, after, request }) {
  if (request.themeId !== 'zen' || !['main', 'sites'].includes(request.surfaceId)) {
    return Object.freeze({ status: 'not_applicable', reason: 'no_garden_bonsai' });
  }
  if (request.traceMode === 'off' || request.traceMode === 'marks') {
    return Object.freeze({ status: 'unavailable', reason: `trace_${request.traceMode}`, currentFrameVerified: false });
  }
  if (request.traceMode !== undefined && request.traceMode !== 'full') {
    throw new Error('QA_DASHBOARD_BONSAI_RESIZE_TRACE_MODE_INVALID');
  }
  const baseline = before?.boot?.zenTraceHistory;
  const watermark = Array.isArray(baseline) ? baseline.at(-1) : null;
  if (!watermark || !Number.isSafeInteger(watermark.index)
    || typeof watermark.sessionId !== 'string' || !watermark.sessionId
    || !Number.isFinite(before?.performance?.timeOriginEpochMs)) {
    throw new Error('QA_DASHBOARD_BONSAI_RESIZE_TRACE_REQUIRED');
  }
  if (before.href !== after?.href
    || before.performance.timeOriginEpochMs !== after?.performance?.timeOriginEpochMs) {
    throw new Error('QA_DASHBOARD_BONSAI_RESIZE_OBSERVATION_CHANGED');
  }
  const history = after?.boot?.zenTraceHistory;
  if (!Array.isArray(history) || history.length === 0) return pending('trace_missing');
  if (history.some(entry => entry?.sessionId !== watermark.sessionId)) {
    throw new Error('QA_DASHBOARD_BONSAI_RESIZE_OBSERVATION_CHANGED');
  }
  if (history.some((entry, index) => !Number.isSafeInteger(entry.index) || entry.index < 0
    || (index > 0 && entry.index <= history[index - 1].index))) {
    throw new Error('QA_DASHBOARD_BONSAI_RESIZE_TRACE_ORDER_INVALID');
  }
  const canvas = after.bonsaiCanvas;
  const cssWidth = Math.round(canvas?.rect?.width), cssHeight = Math.round(canvas?.rect?.height);
  if (canvas?.paintVisible !== 'true' || !(cssWidth > 0 && cssHeight > 0)
    || !Number.isSafeInteger(canvas.width) || canvas.width <= 0
    || !Number.isSafeInteger(canvas.height) || canvas.height <= 0) {
    return pending('canvas_unmeasured');
  }
  // The effective raster ratio may be lower than device DPR under the declared
  // render budget. Require one uniform ratio, allowing backing-pixel rounding.
  if (Math.abs(canvas.width * cssHeight - canvas.height * cssWidth) > Math.max(cssWidth, cssHeight)) {
    return pending('backing_aspect_stale');
  }
  const update = history.findLast(entry => entry?.event === UPDATE_EVENT
    && entry.index > watermark.index && entry.details?.requiresFrameAck === true);
  if (!update) return pending('current_size_dispatch_missing');
  if (update.details.width !== cssWidth || update.details.height !== cssHeight) {
    return pending('current_size_dispatch_stale');
  }
  const commit = history.findLast(entry => entry?.event === COMMIT_EVENT
    && entry.index > update.index && entry.details?.retainedFrameReady === false);
  if (!commit) return pending('current_scene_ack_pending');
  return Object.freeze({
    status: 'ready', currentFrameVerified: true,
    evidence: 'runtime_exact_scene_ack_after_current_size_dispatch',
    traceSessionId: watermark.sessionId,
    dispatchIndex: update.index, commitIndex: commit.index,
    cssWidth, cssHeight, pixelWidth: canvas.width, pixelHeight: canvas.height,
  });
}
