import { readDevicePixelRatio } from '@/platform/rendering/devicePixelRatio.js';
import { clamp } from './index.js';
import { resolveNudgeProtocolScene } from '../protocols/nudgeProtocolScene.js';
import { resolveRenderResolution } from '../../../platform/rendering/renderBudgetContract.js';

export function buildSentinelWorkerRuntimeConfig(config) {
  return {
    reducedMotion: config.reducedMotion === true,
    spriteSizePx: config.spriteSizePx,
    baseSpeedPxPerSec: config.baseSpeedPxPerSec,
    spawnIntervalMs: config.spawnIntervalMs,
    maxSprites: config.maxSprites,
    maxTotalSpawned: config.maxTotalSpawned,
    maxSplits: config.maxSplits,
    maxSplitGeneration: config.maxSplitGeneration,
    speedRamp: config.speedRamp,
    protocolScope: config.protocolScope,
    protocolIntensity: config.protocolIntensity,
    protocolVariant: config.protocolVariant,
    deliveryForm: config.deliveryForm,
    escalationReason: config.escalationReason,
    protocolScene: resolveNudgeProtocolScene(config),
    siteFurin: config.siteFurin && typeof config.siteFurin === 'object'
      ? { ...config.siteFurin }
      : undefined,
    globalSentinel: config.globalSentinel && typeof config.globalSentinel === 'object'
      ? { ...config.globalSentinel }
      : undefined,
    protocol: {
      rampMs: config?.protocol?.rampMs,
    },
  };
}

export function ensureSentinelCanvasContext({
  canvas = null,
  ctx = null,
  dpr = 1,
} = {}) {
  if (!canvas) return null;
  if (!ctx) {
    const nextCtx = canvas.getContext('2d') || null;
    if (!nextCtx) return null;
    nextCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
    return nextCtx;
  }
  return ctx;
}

export function supportsSentinelWorkerRuntime(canvas) {
  return (
    typeof Worker !== 'undefined'
    && typeof canvas?.transferControlToOffscreen === 'function'
  );
}

export function ensureSentinelMainRuntimeCanvasContext({
  canvas = null,
  shadow = null,
  scene = null,
  onCanvasPointerDown = null,
  onCanvasPointerMove = null,
  onCanvasPointerUp = null,
  onCanvasPointerCancel = null,
  overlayHost = null,
  syncOverlayHostRefs = null,
  commitCanvas = null,
  resizeCanvas = null,
  ensureCanvasContext = null,
} = {}) {
  let nextCanvas = canvas;

  if ((!nextCanvas || !nextCanvas.isConnected) && shadow) {
    const shadowCanvas = shadow.getElementById('nudgeCanvas');
    if (shadowCanvas) {
      nextCanvas = shadowCanvas;
    }
  }

  if ((!nextCanvas || !nextCanvas.isConnected) && scene) {
    nextCanvas = document.createElement('canvas');
    nextCanvas.className = 'canvas';
    nextCanvas.id = 'nudgeCanvas';
    if (typeof onCanvasPointerDown === 'function') {
      nextCanvas.addEventListener('pointerdown', onCanvasPointerDown);
    }
    if (typeof onCanvasPointerMove === 'function') {
      nextCanvas.addEventListener('pointermove', onCanvasPointerMove);
    }
    if (typeof onCanvasPointerUp === 'function') {
      nextCanvas.addEventListener('pointerup', onCanvasPointerUp);
    }
    if (typeof onCanvasPointerCancel === 'function') {
      nextCanvas.addEventListener('pointercancel', onCanvasPointerCancel);
    }
    scene.appendChild(nextCanvas);
    overlayHost?.syncRefs?.();
    syncOverlayHostRefs?.();
  }

  if (!nextCanvas) {
    return {
      canvas: null,
      ctx: null,
    };
  }

  commitCanvas?.(nextCanvas);
  resizeCanvas?.({ runtimeOwner: 'main' });
  return {
    canvas: nextCanvas,
    ctx: ensureCanvasContext?.() || null,
  };
}

export function resizeSentinelCanvas({
  canvas = null,
  renderBudget,
  runtimeOwner = 'layout',
  isWorkerRuntimeActive = null,
  ensureWorkerRuntime = null,
  ensureCanvasContext = null,
  windowRef = window,
  documentRef = document,
} = {}) {
  if (!canvas) {
    return { bounds: null, ctx: null };
  }

  const width = Math.max(1, windowRef.innerWidth || documentRef.documentElement?.clientWidth || 1);
  const height = Math.max(1, windowRef.innerHeight || documentRef.documentElement?.clientHeight || 1);
  const requestedDpr = readDevicePixelRatio(windowRef);
  const bounds = { width, height };
  const resolution = resolveRenderResolution({
    cssWidth: width,
    cssHeight: height,
    devicePixelRatio: requestedDpr,
    renderBudget,
  });

  const workerOwned = runtimeOwner === 'worker' || isWorkerRuntimeActive?.() === true;
  if (runtimeOwner === 'main' && !workerOwned) {
    if (canvas.width !== resolution.pixelWidth) canvas.width = resolution.pixelWidth;
    if (canvas.height !== resolution.pixelHeight) canvas.height = resolution.pixelHeight;
  }
  const cssWidth = `${width}px`;
  const cssHeight = `${height}px`;
  if (canvas.style.width !== cssWidth) canvas.style.width = cssWidth;
  if (canvas.style.height !== cssHeight) canvas.style.height = cssHeight;

  if (runtimeOwner === 'layout') {
    return { bounds, ctx: null, effectivePixelRatio: resolution.effectivePixelRatio };
  }

  if (workerOwned) {
    ensureWorkerRuntime?.().resize({ bounds, dpr: requestedDpr });
    return { bounds, ctx: null, effectivePixelRatio: resolution.effectivePixelRatio };
  }

  const nextCtx = ensureCanvasContext?.(resolution.effectivePixelRatio) || null;
  if (nextCtx) {
    nextCtx.setTransform(
      resolution.effectivePixelRatio,
      0,
      0,
      resolution.effectivePixelRatio,
      0,
      0,
    );
  }
  return {
    bounds,
    ctx: nextCtx,
    effectivePixelRatio: resolution.effectivePixelRatio,
  };
}

export function startSentinelWorkerRuntime({
  ensureRoot = null,
  overlayHost = null,
  supportsWorkerRuntime = null,
  ensureWorkerRuntime = null,
  canvas = null,
  bounds = null,
  activeThemeId = '',
  buildWorkerRuntimeConfig = null,
  buildWorkerProtocolProgress = null,
  protocolStartAt = 0,
  getMainRuntimeSnapshot = null,
  windowRef = window,
} = {}) {
  ensureRoot?.();
  overlayHost?.show?.();
  if (!supportsWorkerRuntime?.()) {
    return {
      ok: false,
      phase: 'rejected',
      runtime: 'worker',
      requestId: 0,
      rejectReason: 'worker_runtime_unsupported',
    };
  }

  const runtime = ensureWorkerRuntime?.();
  if (!runtime || typeof runtime.activate !== 'function') {
    return {
      ok: false,
      phase: 'rejected',
      runtime: 'worker',
      requestId: 0,
      rejectReason: 'worker_runtime_unavailable',
    };
  }

  const result = runtime.activate({
    canvas,
    bounds,
    dpr: windowRef.devicePixelRatio || 1,
    themeId: activeThemeId,
    config: buildWorkerRuntimeConfig?.(),
    protocolProgress: buildWorkerProtocolProgress?.(),
    protocolStartAt,
    mainSnapshot: getMainRuntimeSnapshot?.(),
  });
  if (result?.ok === true) {
    return {
      ...result,
      ok: true,
      phase: result.phase || 'requested',
      runtime: 'worker',
    };
  }
  return {
    ...result,
    ok: false,
    phase: result?.phase || 'rejected',
    runtime: 'worker',
    requestId: Number.isFinite(Number(result?.requestId)) ? Number(result.requestId) : 0,
    rejectReason: typeof result?.rejectReason === 'string' && result.rejectReason
      ? result.rejectReason
      : 'worker_activation_failed',
  };
}
