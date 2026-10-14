import {
  clamp,
  resolveNudgeTheme,
  isNudgeEntitySinkComplete,
} from './index.js';
import { assertNudgeRuntimeThemeId } from '../runtime/nudgeRuntimeContext.js';

const MAX_RENDER_DELTA_MS = 50;
const SUSPENDED_FRAME_GAP_MS = 250;

function isDocumentHidden(visibilityState = '') {
  return visibilityState === 'hidden' || visibilityState === 'prerender';
}

export function shouldSampleRenderPressureFrame({
  frameMs = 0,
  visibilityState = 'visible',
} = {}) {
  if (isDocumentHidden(visibilityState)) return false;
  return !(Number.isFinite(frameMs) && frameMs > SUSPENDED_FRAME_GAP_MS);
}

export function resolveSentinelProtocolSyncLevel({
  config,
  protocolStartAt = 0,
  now = Date.now(),
} = {}) {
  const rampMs = clamp(config?.protocol?.rampMs, 10000, 180000);
  return rampMs > 0 ? Math.min(1, (now - protocolStartAt) / rampMs) : 0;
}

export function runSentinelMainLoopFrame({
  ts = 0,
  root = null,
  lastTs = null,
  config,
  protocolStartAt = 0,
  updateHud = null,
  activeTheme = null,
  activeThemeId = '',
  isWorkerRuntimeActive = null,
  ctx = null,
  bounds = null,
  renderBudget,
  runSplitCycle = null,
  enforceEntityBudget = null,
  frameCounter = 0,
  entities = [],
  modalOpen = false,
  updateNudgeEntity = null,
  drawNudgeEntity = null,
  speedScalar = 1,
  renderOptions = null,
} = {}) {
  if (!root) {
    return { shouldContinue: false, lastTs, frameCounter };
  }

  const previousTs = lastTs === null ? ts : lastTs;
  const frameMs = Math.max(0, ts - previousTs);
  const dt = Math.min(MAX_RENDER_DELTA_MS / 1000, frameMs / 1000);
  const now = Date.now();
  const syncLevel = resolveSentinelProtocolSyncLevel({
    config,
    protocolStartAt,
    now,
  });
  updateHud?.(syncLevel);

  if (isWorkerRuntimeActive?.()) {
    return { shouldContinue: true, lastTs: ts, frameCounter };
  }
  if (!ctx) {
    throw new Error('canvas_context_missing');
  }

  if (!renderBudget?.render || !renderBudget?.entity) {
    throw new Error('NUDGE_MAIN_LOOP_RENDER_BUDGET_REQUIRED');
  }
  ctx.clearRect(0, 0, bounds.width, bounds.height);
  const fadeAlpha = (activeTheme?.trailAlpha ?? 0) * renderBudget.trailAlphaScale;
  if (fadeAlpha > 0) {
    ctx.fillStyle = `rgba(4, 6, 10, ${fadeAlpha})`;
    ctx.fillRect(0, 0, bounds.width, bounds.height);
  }

  const protocolIntensity = clamp(config?.protocolIntensity, 0.35, 1);
  const intensity = Math.max(0.4 + syncLevel * 0.6, protocolIntensity);
  const theme = activeTheme || resolveNudgeTheme(
    assertNudgeRuntimeThemeId(activeThemeId, 'sentinel main loop active theme'),
  );
  runSplitCycle?.(syncLevel, dt * 1000);
  enforceEntityBudget?.();
  const nextFrameCounter = frameCounter + 1;

  // retire koi that have finished sinking after a hit (site_furin lifecycle)
  for (let i = entities.length - 1; i >= 0; i -= 1) {
    if (isNudgeEntitySinkComplete(entities[i], now)) {
      entities.splice(i, 1);
    }
  }

  for (const entity of entities) {
    if (!modalOpen) {
      updateNudgeEntity?.(entity, dt, bounds, theme, speedScalar, {
        renderBudget,
        timeMs: now,
      });
    }
    drawNudgeEntity?.(ctx, entity, theme, now, intensity, renderOptions);
  }

  return {
    shouldContinue: true,
    lastTs: ts,
    frameCounter: nextFrameCounter,
  };
}
