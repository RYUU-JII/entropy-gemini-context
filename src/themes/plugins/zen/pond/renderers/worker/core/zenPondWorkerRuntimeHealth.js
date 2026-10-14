const RUNTIME_HEALTH_EVENT_LIMIT = 64;
const RUNTIME_HEALTH_STACK_LIMIT_PER_KEY = 3;
export const ZEN_POND_RUNTIME_HEALTH_DEBUG_TIMELINE_ENABLED = (
  typeof __ENTROPY_BUILD_INCLUDE_DEBUG_TOOLS__ !== 'undefined'
    ? __ENTROPY_BUILD_INCLUDE_DEBUG_TOOLS__
    : true
);
const BUILD_DISABLED_RUNTIME_HEALTH_SNAPSHOT = Object.freeze({
  enabled: false,
  reason: 'build_capability_disabled',
});

const isObject = (value) => (
  Boolean(value && typeof value === 'object' && !Array.isArray(value))
);

const nowMs = () => (
  typeof performance !== 'undefined' && typeof performance.now === 'function'
    ? performance.now()
    : Date.now()
);

const roundMs = (value) => {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return null;
  return Math.max(0, Number(numeric.toFixed(1)));
};

const normalizeEventName = (name) => {
  const normalized = typeof name === 'string' ? name.trim() : '';
  if (!normalized) {
    throw new Error('ZEN_POND_RUNTIME_HEALTH_EVENT_NAME_REQUIRED');
  }
  return normalized;
};

const normalizeTimestampMs = (value = null) => {
  if (value === null || value === undefined) {
    return roundMs(nowMs()) ?? 0;
  }
  const numeric = Number(value);
  return roundMs(Number.isFinite(numeric) ? numeric : nowMs()) ?? 0;
};

const normalizeDetails = (details = null) => {
  if (!isObject(details)) return null;
  const normalized = {};
  Object.entries(details).forEach(([key, value]) => {
    if (value === null) {
      normalized[key] = null;
      return;
    }
    const valueType = typeof value;
    if (
      valueType === 'string'
      || valueType === 'number'
      || valueType === 'boolean'
    ) {
      normalized[key] = value;
    }
  });
  return Object.keys(normalized).length > 0 ? normalized : null;
};

const captureBoundedStack = (label) => {
  const stack = new Error(label).stack;
  if (typeof stack !== 'string' || !stack.trim()) return null;
  return stack
    .split('\n')
    .slice(0, 8)
    .join('\n');
};

export const createZenPondRuntimeHealthState = () => (
  ZEN_POND_RUNTIME_HEALTH_DEBUG_TIMELINE_ENABLED
    ? {
      sequence: 0,
      events: [],
      milestones: {},
      stackCaptureCounts: {},
    }
    : null
);

export const recordZenPondRuntimeHealthEvent = (
  state,
  name,
  details = null,
  {
    timestampMs = null,
    captureStack = false,
    stackKey = '',
  } = {},
) => {
  if (ZEN_POND_RUNTIME_HEALTH_DEBUG_TIMELINE_ENABLED !== true) return null;
  if (!state || !isObject(state.runtimeHealth)) {
    throw new Error('ZEN_POND_RUNTIME_HEALTH_STATE_MISSING');
  }
  const eventName = normalizeEventName(name);
  const atMs = normalizeTimestampMs(timestampMs);
  const runtimeHealth = state.runtimeHealth;
  runtimeHealth.sequence = Math.max(0, Math.floor(Number(runtimeHealth.sequence) || 0)) + 1;
  const event = {
    seq: runtimeHealth.sequence,
    name: eventName,
    atMs,
    frame: Math.max(0, Math.floor(Number(state.metrics?.sampleFrames) || 0)),
  };
  const safeDetails = normalizeDetails(details);
  if (safeDetails) {
    event.details = safeDetails;
  }
  if (captureStack === true) {
    const resolvedStackKey = stackKey || eventName;
    const previousCount = Math.max(0, Math.floor(Number(runtimeHealth.stackCaptureCounts[resolvedStackKey]) || 0));
    if (previousCount < RUNTIME_HEALTH_STACK_LIMIT_PER_KEY) {
      runtimeHealth.stackCaptureCounts[resolvedStackKey] = previousCount + 1;
      const stack = captureBoundedStack(`ZEN_POND_RUNTIME_HEALTH:${resolvedStackKey}`);
      if (stack) {
        event.stack = stack;
      }
    }
  }
  runtimeHealth.events.push(event);
  if (runtimeHealth.events.length > RUNTIME_HEALTH_EVENT_LIMIT) {
    runtimeHealth.events.splice(0, runtimeHealth.events.length - RUNTIME_HEALTH_EVENT_LIMIT);
  }
  if (!isObject(runtimeHealth.milestones[eventName])) {
    runtimeHealth.milestones[eventName] = { ...event };
  }
  return event;
};

export const recordZenPondBootTimelineEvent = (
  state,
  name,
  details = null,
  options = {},
) => (
  ZEN_POND_RUNTIME_HEALTH_DEBUG_TIMELINE_ENABLED
    ? recordZenPondRuntimeHealthEvent(state, name, details, options)
    : null
);

const cloneEvent = (event = null) => (
  isObject(event)
    ? {
      seq: Math.max(0, Math.floor(Number(event.seq) || 0)),
      name: typeof event.name === 'string' ? event.name : '',
      atMs: roundMs(event.atMs) ?? 0,
      frame: Math.max(0, Math.floor(Number(event.frame) || 0)),
      ...(isObject(event.details) ? { details: { ...event.details } } : {}),
      ...(typeof event.stack === 'string' && event.stack ? { stack: event.stack } : {}),
    }
    : null
);

const pickTimelineValues = (source, keys) => {
  const picked = {};
  keys.forEach(([targetKey, sourceKey]) => {
    picked[targetKey] = source?.[sourceKey] ?? null;
  });
  return picked;
};

const sumTimelineValues = (values = {}) => {
  let total = 0;
  Object.values(values).forEach((value) => {
    const numeric = Number(value);
    if (Number.isFinite(numeric) && numeric > 0) {
      total += numeric;
    }
  });
  return roundMs(total) ?? 0;
};

const buildBudgetMs = (deltasMs, waitGapsMs, workSpansMs) => {
  const totalToFirstFrame = deltasMs?.initToFirstFrameAck ?? null;
  const knownWait = sumTimelineValues(waitGapsMs);
  const knownWork = sumTimelineValues(workSpansMs);
  const total = Number(totalToFirstFrame);
  return {
    totalToFirstFrame,
    knownWait,
    knownWork,
    unclassified: Number.isFinite(total)
      ? (roundMs(Math.max(0, total - knownWait - knownWork)) ?? 0)
      : null,
  };
};

const buildTimelineMs = (milestones = {}) => {
  const atOf = (name) => {
    const atMs = Number(milestones?.[name]?.atMs);
    return Number.isFinite(atMs) && atMs >= 0 ? atMs : null;
  };
  const delta = (from, to) => {
    const fromAtMs = atOf(from);
    const toAtMs = atOf(to);
    if (fromAtMs === null || toAtMs === null) return null;
    if (toAtMs < fromAtMs) return null;
    return roundMs(toAtMs - fromAtMs);
  };
  const fromInit = (to) => delta('init_canvas_received', to);
  const fromInitMs = {
    canvasInitialized: fromInit('canvas_initialized'),
    runtimeParamsApplied: fromInit('runtime_params_applied'),
    frameStateReady: fromInit('frame_state_ready'),
    fishRosterApplied: fromInit('fish_roster_applied'),
    startEngineAsyncQueued: fromInit('start_engine_async_queued'),
    startEngineAsyncBegin: fromInit('start_engine_async_begin'),
    ambientSyncAttempt: fromInit('ambient_sync_attempt'),
    ambientSyncComplete: fromInit('ambient_sync_complete'),
    startEngineBegin: fromInit('start_engine_begin'),
    rendererModuleLoadStart: fromInit('renderer_module_load_start'),
    rendererModuleLoadEnd: fromInit('renderer_module_load_end'),
    sceneMountStart: fromInit('scene_mount_start'),
    sceneMounted: fromInit('scene_mounted'),
    firstFrameAssetsPrepareStart: fromInit('first_frame_assets_prepare_start'),
    firstFrameAssetsPrepareEnd: fromInit('first_frame_assets_prepare_end'),
    firstFrameAssetsReady: fromInit('first_frame_assets_ready'),
    runtimeLoopMountStart: fromInit('runtime_loop_mount_start'),
    runtimeLoopMounted: fromInit('runtime_loop_mounted'),
    firstRenderTickStart: fromInit('first_render_tick_start'),
    firstRenderTickEnd: fromInit('first_render_tick_end'),
    firstFrameAck: fromInit('first_frame_ack'),
  };
  const deltasMs = {
    rendererModuleAdmission: delta(
      'renderer_module_admission_start',
      'renderer_module_admission_end',
    ),
    rendererModuleAdmissionLeadToEngineWait: delta(
      'renderer_module_admission_start',
      'renderer_module_load_start',
    ),
    initToCanvasInitialized: delta('init_canvas_received', 'canvas_initialized'),
    canvasInitializedToRuntimeParams: delta('canvas_initialized', 'runtime_params_applied'),
    runtimeParamsToFrameState: delta('runtime_params_applied', 'frame_state_ready'),
    frameStateToFishRoster: delta('frame_state_ready', 'fish_roster_applied'),
    frameStateToStartEngineQueued: delta('frame_state_ready', 'start_engine_async_queued'),
    frameStateToAmbientAttempt: delta('frame_state_ready', 'ambient_sync_attempt'),
    fishRosterToStartEngineQueued: delta('fish_roster_applied', 'start_engine_async_queued'),
    startEngineQueuedToAsyncBegin: delta('start_engine_async_queued', 'start_engine_async_begin'),
    startEngineAsyncBeginToEngineBegin: delta('start_engine_async_begin', 'start_engine_begin'),
    startEngineBeginToAmbientAttempt: delta('start_engine_begin', 'ambient_sync_attempt'),
    ambientAttemptToComplete: delta('ambient_sync_attempt', 'ambient_sync_complete'),
    ambientCompleteToStartEngine: delta('ambient_sync_complete', 'start_engine_begin'),
    ambientCompleteToRendererModuleLoadStart: delta('ambient_sync_complete', 'renderer_module_load_start'),
    startEngineToRendererModuleLoadStart: delta('start_engine_begin', 'renderer_module_load_start'),
    rendererModuleLoad: delta('renderer_module_load_start', 'renderer_module_load_end'),
    rendererModuleLoadEndToSceneMountStart: delta('renderer_module_load_end', 'scene_mount_start'),
    sceneMount: delta('scene_mount_start', 'scene_mounted'),
    sceneMountedToRuntimeLoopMountStart: delta('scene_mounted', 'runtime_loop_mount_start'),
    sceneMountedToFirstFrameAssetsPrepareStart: delta(
      'scene_mounted',
      'first_frame_assets_prepare_start',
    ),
    firstFrameAssetsPrepare: delta(
      'first_frame_assets_prepare_start',
      'first_frame_assets_prepare_end',
    ),
    firstFrameAssetsPrepareEndToReady: delta(
      'first_frame_assets_prepare_end',
      'first_frame_assets_ready',
    ),
    firstFrameAssetsReadyToRuntimeLoopMountStart: delta(
      'first_frame_assets_ready',
      'runtime_loop_mount_start',
    ),
    runtimeLoopMount: delta('runtime_loop_mount_start', 'runtime_loop_mounted'),
    sceneMountedToFirstRenderTick: delta('scene_mounted', 'first_render_tick_start'),
    runtimeLoopMountedToFirstRenderTick: delta('runtime_loop_mounted', 'first_render_tick_start'),
    firstRenderTick: delta('first_render_tick_start', 'first_render_tick_end'),
    firstRenderTickEndToAck: delta('first_render_tick_end', 'first_frame_ack'),
    initToFirstFrameAck: delta('init_canvas_received', 'first_frame_ack'),
  };
  const preStartWait = (
    deltasMs.frameStateToFishRoster
    ?? deltasMs.frameStateToStartEngineQueued
    ?? deltasMs.frameStateToAmbientAttempt
  );
  const waitGapsMs = {
    preStartWait,
    ...pickTimelineValues(deltasMs, [
      ['fishRosterToStartEngineQueued', 'fishRosterToStartEngineQueued'],
      ['startEngineQueuedToAsyncBegin', 'startEngineQueuedToAsyncBegin'],
      ['sceneMountedToDirectFirstRender', 'sceneMountedToFirstRenderTick'],
      ['runtimeLoopMountedToFirstRender', 'runtimeLoopMountedToFirstRenderTick'],
      ['firstRenderEndToAck', 'firstRenderTickEndToAck'],
    ]),
  };
  if (waitGapsMs.runtimeLoopMountedToFirstRender !== null) {
    waitGapsMs.sceneMountedToDirectFirstRender = null;
  }
  const firstFrameAssetsMeasured = deltasMs.firstFrameAssetsPrepare !== null;
  const workSpansMs = {
    ...pickTimelineValues(deltasMs, [
      ['canvasInit', 'initToCanvasInitialized'],
      ['runtimeParamsApply', 'canvasInitializedToRuntimeParams'],
      ['frameStateBuild', 'runtimeParamsToFrameState'],
      ['startEngineAsyncBeginToEngineBegin', 'startEngineAsyncBeginToEngineBegin'],
      ['engineSetupBeforeAmbient', 'startEngineBeginToAmbientAttempt'],
      ['ambientSync', 'ambientAttemptToComplete'],
      ['postAmbientSetupBeforeRendererLoad', 'ambientCompleteToRendererModuleLoadStart'],
      ['rendererModuleLoad', 'rendererModuleLoad'],
      ['preSceneMountSetup', 'rendererModuleLoadEndToSceneMountStart'],
      ['sceneMount', 'sceneMount'],
    ]),
    preRuntimeLoopMountSetup: firstFrameAssetsMeasured
      ? null
      : deltasMs.sceneMountedToRuntimeLoopMountStart,
    ...pickTimelineValues(deltasMs, [
      ['sceneMountedToFirstFrameAssetsPrepare', 'sceneMountedToFirstFrameAssetsPrepareStart'],
      ['firstFrameAssetsPrepare', 'firstFrameAssetsPrepare'],
      ['firstFrameAssetsPrepareEndToReady', 'firstFrameAssetsPrepareEndToReady'],
      ['firstFrameAssetsReadyToRuntimeLoopMount', 'firstFrameAssetsReadyToRuntimeLoopMountStart'],
      ['runtimeLoopMount', 'runtimeLoopMount'],
      ['firstRenderTick', 'firstRenderTick'],
    ]),
  };
  return {
    fromInitMs,
    deltasMs,
    waitGapsMs,
    workSpansMs,
    budgetMs: buildBudgetMs(deltasMs, waitGapsMs, workSpansMs),
  };
};

const buildInitOrderSummary = (milestones = {}) => {
  const seqOf = (name) => {
    const seq = Number(milestones?.[name]?.seq);
    return Number.isFinite(seq) && seq > 0 ? seq : null;
  };
  const initCanvas = seqOf('init_canvas_received');
  const canvasInitialized = seqOf('canvas_initialized');
  const runtimeParams = seqOf('runtime_params_applied');
  const frameState = seqOf('frame_state_ready');
  const ambientAttempt = seqOf('ambient_sync_attempt');
  const ambientComplete = seqOf('ambient_sync_complete');
  const firstFrame = seqOf('first_frame_ack');
  const rendererAdmissionStart = seqOf('renderer_module_admission_start');
  const rendererAdmissionEnd = seqOf('renderer_module_admission_end');
  const rendererWaitStart = seqOf('renderer_module_load_start');
  const frameStateBeforeAmbient = (
    frameState !== null
    && ambientAttempt !== null
    && frameState < ambientAttempt
  );
  const ambientBeforeFirstFrame = (
    ambientComplete !== null
    && firstFrame !== null
    && ambientComplete < firstFrame
  );
  const timeline = buildTimelineMs(milestones);
  return {
    initCanvasReceived: initCanvas !== null,
    canvasInitialized: canvasInitialized !== null,
    runtimeParamsApplied: runtimeParams !== null,
    frameStateReady: frameState !== null,
    ambientSyncAttempted: ambientAttempt !== null,
    ambientSyncCompleted: ambientComplete !== null,
    firstFrameAcked: firstFrame !== null,
    frameStateBeforeAmbient,
    ambientBeforeFirstFrame,
    rendererModuleAdmission: {
      started: rendererAdmissionStart !== null,
      completed: rendererAdmissionEnd !== null,
      startedBeforeInit: (
        rendererAdmissionStart !== null
        && initCanvas !== null
        && rendererAdmissionStart < initCanvas
      ),
      startedBeforeEngineWait: (
        rendererAdmissionStart !== null
        && rendererWaitStart !== null
        && rendererAdmissionStart < rendererWaitStart
      ),
      completedBeforeEngineWait: (
        rendererAdmissionEnd !== null
        && rendererWaitStart !== null
        && rendererAdmissionEnd < rendererWaitStart
      ),
      durationMs: timeline.deltasMs.rendererModuleAdmission,
      leadToEngineWaitMs: timeline.deltasMs.rendererModuleAdmissionLeadToEngineWait,
    },
    ...timeline,
    ok: (
      initCanvas !== null
      && canvasInitialized !== null
      && runtimeParams !== null
      && frameState !== null
      && ambientAttempt !== null
      && ambientComplete !== null
      && firstFrame !== null
      && initCanvas <= canvasInitialized
      && canvasInitialized <= runtimeParams
      && runtimeParams <= frameState
      && frameStateBeforeAmbient
      && ambientBeforeFirstFrame
    ),
  };
};

export const buildZenPondRuntimeHealthSnapshot = (state) => {
  if (ZEN_POND_RUNTIME_HEALTH_DEBUG_TIMELINE_ENABLED !== true) {
    return BUILD_DISABLED_RUNTIME_HEALTH_SNAPSHOT;
  }
  if (!state || !isObject(state.runtimeHealth)) {
    throw new Error('ZEN_POND_RUNTIME_HEALTH_STATE_MISSING');
  }
  const runtimeHealth = state.runtimeHealth;
  const milestones = {};
  Object.entries(runtimeHealth.milestones || {}).forEach(([name, event]) => {
    const cloned = cloneEvent(event);
    if (cloned) milestones[name] = cloned;
  });
  return {
    sequence: Math.max(0, Math.floor(Number(runtimeHealth.sequence) || 0)),
    eventLimit: RUNTIME_HEALTH_EVENT_LIMIT,
    initOrder: buildInitOrderSummary(milestones),
    milestones,
    events: Array.isArray(runtimeHealth.events)
      ? runtimeHealth.events.map(cloneEvent).filter(Boolean)
      : [],
  };
};
