export const ZEN_POND_WORKER_STARTUP_EVENT = 'worker_startup_progress';

export const ZEN_POND_WORKER_STARTUP_STAGE = Object.freeze({
  ENGINE_STARTING: 'engine_starting',
  RENDERER_MODULE_LOADING: 'renderer_module_loading',
  SCENE_MOUNTING: 'scene_mounting',
  FIRST_FRAME_ASSETS_PREPARING: 'first_frame_assets_preparing',
  RUNTIME_LOOP_MOUNTING: 'runtime_loop_mounting',
  PRIME_RENDERING: 'prime_rendering',
  FIRST_FRAME_DEFERRED: 'first_frame_deferred',
  WAITING_RUNTIME_FRAME: 'waiting_runtime_frame',
  RAF_LIVENESS_FALLBACK: 'raf_liveness_fallback',
  STARTUP_RENDER_FAILED: 'startup_render_failed',
});

export const ZEN_POND_WORKER_STARTUP_READINESS_REASON = Object.freeze({
  RUNTIME_WARMUP: 'runtime_warmup',
  SURFACE_EFFECTS: 'surface_effects',
  FISH_ROSTER: 'fish_roster',
  RENDER_EXCEPTION: 'render_exception',
  RAF_CALLBACK_STALLED: 'raf_callback_stalled',
});

export const ZEN_POND_WORKER_STARTUP_ERROR_CODE = Object.freeze({
  RENDER_FAILED: 'ZEN_POND_WORKER_STARTUP_RENDER_FAILED',
  WEBGL_FAILED: 'ZEN_POND_WORKER_STARTUP_WEBGL_FAILED',
  SHADER_FAILED: 'ZEN_POND_WORKER_STARTUP_SHADER_FAILED',
});

const STARTUP_STAGE_SET = new Set(Object.values(ZEN_POND_WORKER_STARTUP_STAGE));
const READINESS_REASON_SET = new Set(
  Object.values(ZEN_POND_WORKER_STARTUP_READINESS_REASON),
);
const CANONICAL_ERROR_CODE_PATTERN = /^(?:ZEN|PIXI|WEBGL)_[A-Z0-9_]{2,91}$/u;
const MAX_ERROR_MESSAGE_LENGTH = 240;

const isObject = (value) => (
  Boolean(value && typeof value === 'object' && !Array.isArray(value))
);

export const createZenPondWorkerStartupProgress = ({
  stage,
  reason = null,
} = {}) => {
  if (!STARTUP_STAGE_SET.has(stage)) {
    throw new Error(`ZEN_POND_WORKER_STARTUP_STAGE_INVALID:${String(stage)}`);
  }
  if (reason !== null && !READINESS_REASON_SET.has(reason)) {
    throw new Error(`ZEN_POND_WORKER_STARTUP_REASON_INVALID:${String(reason)}`);
  }
  return Object.freeze({
    stage,
    reason,
  });
};

export const requireZenPondWorkerStartupProgress = (value = null) => {
  if (!isObject(value)) {
    throw new Error('ZEN_POND_WORKER_STARTUP_PROGRESS_INVALID');
  }
  const keys = Object.keys(value).sort();
  if (keys.length !== 2 || keys[0] !== 'reason' || keys[1] !== 'stage') {
    throw new Error('ZEN_POND_WORKER_STARTUP_PROGRESS_SHAPE_INVALID');
  }
  return createZenPondWorkerStartupProgress(value);
};

export const requireZenPondWorkerStartupErrorCode = (value) => {
  if (typeof value !== 'string' || !CANONICAL_ERROR_CODE_PATTERN.test(value)) {
    throw new Error(`ZEN_POND_WORKER_STARTUP_ERROR_CODE_INVALID:${String(value)}`);
  }
  return value;
};

const sanitizeErrorMessage = (error) => {
  const raw = String(
    error?.message
    || error
    || ZEN_POND_WORKER_STARTUP_ERROR_CODE.RENDER_FAILED,
  );
  const redacted = raw
    .replace(/(?:chrome-extension|https?):\/\/\S+/giu, '[redacted-url]')
    .replace(/[\u0000-\u001f\u007f]+/gu, ' ')
    .replace(/\s+/gu, ' ')
    .trim();
  return (redacted || ZEN_POND_WORKER_STARTUP_ERROR_CODE.RENDER_FAILED)
    .slice(0, MAX_ERROR_MESSAGE_LENGTH);
};

const resolveStartupErrorCode = (error, message) => {
  const explicitCode = typeof error?.code === 'string' ? error.code.trim() : '';
  if (CANONICAL_ERROR_CODE_PATTERN.test(explicitCode)) return explicitCode;
  const canonicalMessageCode = message.match(/^([A-Z][A-Z0-9_]{2,95})(?=[:\s]|$)/u)?.[1];
  if (CANONICAL_ERROR_CODE_PATTERN.test(canonicalMessageCode || '')) {
    return canonicalMessageCode;
  }
  if (/shader|program\s+(?:compile|link)|glsl/iu.test(message)) {
    return ZEN_POND_WORKER_STARTUP_ERROR_CODE.SHADER_FAILED;
  }
  if (/webgl|framebuffer|graphics\s+context|context\s+(?:lost|creation)/iu.test(message)) {
    return ZEN_POND_WORKER_STARTUP_ERROR_CODE.WEBGL_FAILED;
  }
  return ZEN_POND_WORKER_STARTUP_ERROR_CODE.RENDER_FAILED;
};

export const sanitizeZenPondWorkerStartupError = (error) => {
  const message = sanitizeErrorMessage(error);
  return Object.freeze({
    code: resolveStartupErrorCode(error, message),
    message,
  });
};
