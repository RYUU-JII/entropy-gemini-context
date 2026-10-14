import { resolveCeremonyResolution } from './ceremonyContracts.js';
import { observeDevicePixelRatio, readDevicePixelRatio } from '@/platform/rendering/devicePixelRatio.js';
import React, { useEffect, useRef, useState } from 'react';

import {
  WORKER_RUNTIME_SURFACE_IDS,
  createAdmittedWorkerRuntimeSession,
  recordWorkerRuntimeSurfaceFailure,
  resolveWorkerRuntimeFailureReason,
} from '@/platform/workers/runtime/index.js';
import {
  FIRST_VISION_DESCENT_CEREMONY_ID,
  createFirstVisionDescentPlaybackClock,
  createCeremonyRenderState,
  drawCeremonyFrame,
  getCeremonyDurationMs,
} from './ceremonyRendererCore.js';
import {
  CEREMONY_COMPLETION_POLICIES,
  FIRST_VISION_DESCENT_RENDER_PROFILE,
  FIRST_VISION_DESCENT_TIMELINE,
} from './ceremonyContracts.js';
import './CeremonyOverlay.css';

const REDUCED_MOTION_DURATION_MS = 900;
const CEREMONY_COMPLETION_WATCHDOG_BUFFER_MS = 1800;
const CEREMONY_COVER_WATCHDOG_BUFFER_MS = 1800;
const RENDERER_ERROR_COMPLETION_DELAY_MS = 1200;

function requireCompletionPolicy(value, {
  active = false,
  ceremonyId = null,
  onCoverOpaque = null,
  onComplete = null,
} = {}) {
  if (!Object.values(CEREMONY_COMPLETION_POLICIES).includes(value)) {
    throw new Error(`CEREMONY_OVERLAY_COMPLETION_POLICY_INVALID:${String(value)}`);
  }
  if (value !== CEREMONY_COMPLETION_POLICIES.RELEASE_GATED) return value;
  if (ceremonyId !== FIRST_VISION_DESCENT_CEREMONY_ID) {
    throw new Error(`CEREMONY_OVERLAY_RELEASE_GATED_CEREMONY_INVALID:${String(ceremonyId)}`);
  }
  if (active && typeof onCoverOpaque !== 'function') {
    throw new Error('CEREMONY_OVERLAY_RELEASE_GATED_COVER_ACK_REQUIRED');
  }
  if (active && typeof onComplete !== 'function') {
    throw new Error('CEREMONY_OVERLAY_RELEASE_GATED_COMPLETION_ACK_REQUIRED');
  }
  return value;
}

function recordCeremonyWorkerFailure({
  ceremonyId = FIRST_VISION_DESCENT_CEREMONY_ID,
  stage = 'control',
  reason = 'ceremony_worker_error',
  workerMessageType = null,
  error = null,
  missing = null,
} = {}) {
  return recordWorkerRuntimeSurfaceFailure({
    surfaceId: WORKER_RUNTIME_SURFACE_IDS.CEREMONY_OVERLAY_RENDERER,
    stage,
    reason,
    workerMessageType,
    error,
    missing,
    details: { ceremonyId },
    messagePrefix: 'CEREMONY_OVERLAY_WORKER_FAIL',
  });
}

function getCanvasMetrics(canvas, ceremonyId) {
  const rect = canvas?.getBoundingClientRect?.() || {};
  const width = Math.max(1, Math.round(Number(rect.width) || globalThis.innerWidth || 1));
  const height = Math.max(1, Math.round(Number(rect.height) || globalThis.innerHeight || 1));
  const { effectivePixelRatio: dpr } = resolveCeremonyResolution({
    ceremonyId, width, height, devicePixelRatio: readDevicePixelRatio(),
  });
  return { width, height, dpr };
}

function syncMainCanvas(canvas, metrics) {
  const pixelWidth = Math.max(1, Math.floor(metrics.width * metrics.dpr));
  const pixelHeight = Math.max(1, Math.floor(metrics.height * metrics.dpr));
  if (canvas.width !== pixelWidth) canvas.width = pixelWidth;
  if (canvas.height !== pixelHeight) canvas.height = pixelHeight;
  const ctx = canvas.getContext('2d', { alpha: true });
  if (!ctx) {
    throw new Error('CEREMONY_MAIN_CONTEXT_UNAVAILABLE');
  }
  ctx.setTransform(metrics.dpr, 0, 0, metrics.dpr, 0, 0);
  return ctx;
}

function startMainCanvasRenderer(canvas, {
  ceremonyId,
  seed,
  holdAtCover,
  releaseCover,
  onCoverOpaque,
  onComplete,
} = {}) {
  let disposed = false;
  let frameId = 0;
  let startedAt = 0;
  let lastRenderedAt = 0;
  let coverOpaqueReported = false;
  const durationMs = getCeremonyDurationMs(ceremonyId);
  const isFirstVisionDescent = ceremonyId === FIRST_VISION_DESCENT_CEREMONY_ID;
  const minimumFrameIntervalMs = isFirstVisionDescent
    ? (1000 / FIRST_VISION_DESCENT_RENDER_PROFILE.targetFps)
    : 0;
  const playbackClock = isFirstVisionDescent
    ? createFirstVisionDescentPlaybackClock({ holdAtCover, releaseCover })
    : null;
  let metrics = getCanvasMetrics(canvas, ceremonyId);
  let ctx = syncMainCanvas(canvas, metrics);
  let renderState = createCeremonyRenderState({
    ceremonyId,
    width: metrics.width,
    height: metrics.height,
    seed,
  });

  const resize = () => {
    if (disposed) return;
    const next = getCanvasMetrics(canvas, ceremonyId);
    if (next.width === metrics.width && next.height === metrics.height && next.dpr === metrics.dpr) return;
    metrics = next;
    ctx = syncMainCanvas(canvas, metrics);
    renderState = createCeremonyRenderState({
      ceremonyId,
      width: metrics.width,
      height: metrics.height,
      seed,
    });
  };

  const tick = (nowMs) => {
    if (disposed) return;
    frameId = 0;
    if (
      lastRenderedAt > 0
      && minimumFrameIntervalMs > 0
      && nowMs - lastRenderedAt < minimumFrameIntervalMs
    ) {
      frameId = requestAnimationFrame(tick);
      return;
    }
    lastRenderedAt = nowMs;
    if (!startedAt) startedAt = nowMs;
    const playback = playbackClock?.advance(nowMs) || Object.freeze({
      elapsedMs: Math.max(0, nowMs - startedAt),
      holding: false,
    });
    const progress = drawCeremonyFrame(ctx, {
      ceremonyId,
      width: metrics.width,
      height: metrics.height,
      elapsedMs: playback.elapsedMs,
      renderState,
    });
    if (progress?.coverOpaque === true && !coverOpaqueReported) {
      coverOpaqueReported = true;
      onCoverOpaque?.({ ceremonyId, elapsedMs: playback.elapsedMs });
    }
    if (playback.elapsedMs >= durationMs + 80) {
      onComplete?.();
      return;
    }
    if (playback.holding) return;
    frameId = requestAnimationFrame(tick);
  };

  window.addEventListener('resize', resize);
  const stopDpr = observeDevicePixelRatio({ onChange: resize });
  frameId = requestAnimationFrame(tick);

  return Object.freeze({
    setControls(nextControls = {}) {
      if (!playbackClock || disposed) return;
      const previous = playbackClock.snapshot();
      const next = playbackClock.setControls(nextControls);
      if (previous.holding && !next.holding && !frameId) {
        lastRenderedAt = 0;
        frameId = requestAnimationFrame(tick);
      }
    },
    dispose() {
      disposed = true;
      window.removeEventListener('resize', resize);
      stopDpr();
      if (frameId) cancelAnimationFrame(frameId);
    },
  });
}

function startWorkerCanvasRenderer(canvas, {
  ceremonyId,
  seed,
  holdAtCover,
  releaseCover,
  onCoverOpaque,
  onComplete,
  onError,
} = {}) {
  const missing = [];
  if (typeof Worker === 'undefined') missing.push('Worker');
  if (typeof OffscreenCanvas === 'undefined') missing.push('OffscreenCanvas');
  if (typeof canvas?.transferControlToOffscreen !== 'function') {
    missing.push('canvas.transferControlToOffscreen');
  }
  if (missing.length > 0) {
    recordCeremonyWorkerFailure({
      ceremonyId,
      stage: 'init',
      reason: `ceremony_worker_unavailable:${missing.join(',')}`,
      workerMessageType: 'availability',
      missing,
    });
    return null;
  }

  let disposed = false;
  let workerSession = null;
  let worker = null;
  let stopDpr = null;
  let lastMetrics = null;

  const handleResize = () => {
    if (disposed || !worker) return;
    const nextMetrics = getCanvasMetrics(canvas, ceremonyId);
    if (lastMetrics && nextMetrics.width === lastMetrics.width && nextMetrics.height === lastMetrics.height
      && nextMetrics.dpr === lastMetrics.dpr) return;
    lastMetrics = nextMetrics;
    worker.postMessage({
      type: 'resize',
      payload: {
        width: nextMetrics.width,
        height: nextMetrics.height,
        dpr: nextMetrics.dpr,
        ceremonyId,
        seed,
      },
    });
  };

  const dispose = (reason = 'ceremony_renderer_disposed') => {
    if (disposed) return false;
    disposed = true;
    window.removeEventListener('resize', handleResize);
    stopDpr?.();
    try {
      worker?.postMessage({ type: 'dispose' });
    } catch (_) {
      // Worker may already be gone after an admission revoke or runtime error.
    }
    workerSession?.terminate({ reason, throwOnError: false });
    workerSession = null;
    worker = null;
    return true;
  };

  try {
    workerSession = createAdmittedWorkerRuntimeSession({
      surfaceId: WORKER_RUNTIME_SURFACE_IDS.CEREMONY_OVERLAY_RENDERER,
      admissionMetadata: { ceremonyId },
      createWorker: () => new Worker(new URL('./CeremonyOverlay.worker.js', import.meta.url), {
        type: 'module',
        // Keep this literal aligned with WorkerRuntimeRegistry; Vite requires static worker options.
        name: 'ceremony_overlay_renderer',
      }),
      onRevoked(details = {}) {
        const reason = `WORKER_RUNTIME_ADMISSION_REVOKED:${details?.reason || 'unknown'}`;
        const error = new Error(reason);
        recordCeremonyWorkerFailure({
          ceremonyId,
          stage: 'control',
          reason,
          workerMessageType: 'admission_revoked',
          error,
        });
        dispose(reason);
        onError?.(error);
      },
    });
    worker = workerSession.worker;
    const metrics = getCanvasMetrics(canvas, ceremonyId);
    lastMetrics = metrics;
    const offscreenCanvas = canvas.transferControlToOffscreen();

    worker.onmessage = (event) => {
      const message = event?.data || {};
      const type = String(message?.type || '');
      if (type === 'complete') {
        dispose('ceremony_renderer_complete');
        onComplete?.();
        return;
      }
      if (type === 'cover_opaque') {
        onCoverOpaque?.({
          ceremonyId,
          elapsedMs: Math.max(0, Number(message?.elapsedMs) || 0),
        });
        return;
      }
      if (type !== 'error') return;
      const reason = resolveWorkerRuntimeFailureReason(message?.error, 'CEREMONY_WORKER_ERROR');
      const error = new Error(reason);
      recordCeremonyWorkerFailure({
        ceremonyId,
        stage: 'control',
        reason,
        workerMessageType: 'error',
        error,
      });
      dispose(reason);
      onError?.(error);
    };
    worker.onerror = (error) => {
      const reason = resolveWorkerRuntimeFailureReason(error, 'CEREMONY_WORKER_ERROR');
      recordCeremonyWorkerFailure({
        ceremonyId,
        stage: 'control',
        reason,
        workerMessageType: 'worker.onerror',
        error,
      });
      dispose(reason);
      onError?.(error);
    };

    worker.postMessage({
      type: 'init',
      payload: {
        canvas: offscreenCanvas,
        width: metrics.width,
        height: metrics.height,
        dpr: metrics.dpr,
        ceremonyId,
        seed,
        holdAtCover: holdAtCover === true,
        releaseCover: releaseCover === true,
      },
    }, [offscreenCanvas]);
  } catch (error) {
    dispose('ceremony_renderer_start_failed');
    throw error;
  }
  stopDpr = observeDevicePixelRatio({ onChange: handleResize });
  window.addEventListener('resize', handleResize);

  return Object.freeze({
    setControls(nextControls = {}) {
      if (disposed || !worker) return;
      worker.postMessage({
        type: 'control',
        payload: {
          holdAtCover: nextControls.holdAtCover === true,
          releaseCover: nextControls.releaseCover === true,
        },
      });
    },
    dispose() {
      dispose();
    },
  });
}

function startReducedMotionRenderer({
  ceremonyId,
  holdAtCover,
  releaseCover,
  onCoverOpaque,
  onComplete,
} = {}) {
  let disposed = false;
  let coverTimer = 0;
  let completionTimer = 0;
  let coverOpaque = false;
  let holdEnabled = holdAtCover === true;
  let released = releaseCover === true;

  const clearCompletionTimer = () => {
    if (!completionTimer) return;
    window.clearTimeout(completionTimer);
    completionTimer = 0;
  };
  const scheduleCompletion = (delayMs) => {
    if (disposed || completionTimer || (holdEnabled && !released)) return;
    completionTimer = window.setTimeout(() => {
      completionTimer = 0;
      if (!disposed) onComplete?.();
    }, delayMs);
  };

  coverTimer = window.setTimeout(() => {
    coverTimer = 0;
    if (disposed) return;
    coverOpaque = true;
    onCoverOpaque?.({ ceremonyId, elapsedMs: REDUCED_MOTION_DURATION_MS / 3 });
    scheduleCompletion((REDUCED_MOTION_DURATION_MS * 2) / 3);
  }, REDUCED_MOTION_DURATION_MS / 3);

  return Object.freeze({
    setControls(nextControls = {}) {
      if (disposed) return;
      holdEnabled = nextControls.holdAtCover === true;
      released = released || nextControls.releaseCover === true;
      if (released && coverOpaque) {
        scheduleCompletion(REDUCED_MOTION_DURATION_MS / 3);
      } else if (holdEnabled && !released) {
        clearCompletionTimer();
      }
    },
    dispose() {
      disposed = true;
      if (coverTimer) window.clearTimeout(coverTimer);
      clearCompletionTimer();
    },
  });
}

function resolvePrefersReducedMotion() {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    return false;
  }
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

export default function CeremonyOverlay({
  active = false,
  ceremonyId = FIRST_VISION_DESCENT_CEREMONY_ID,
  seed = 872342,
  completionPolicy = CEREMONY_COMPLETION_POLICIES.PLAYBACK,
  holdAtCover = false,
  releaseCover = false,
  onCoverOpaque = null,
  onComplete = null,
}) {
  const canvasRef = useRef(null);
  const coverPlaneRef = useRef(null);
  const rendererControllerRef = useRef(null);
  const controlSideEffectsRef = useRef(null);
  const completeRef = useRef(false);
  const coverOpaqueRef = useRef(false);
  const latestControlsRef = useRef({ holdAtCover, releaseCover });
  const onCompleteRef = useRef(onComplete);
  const onCoverOpaqueRef = useRef(onCoverOpaque);
  const [coverOpaque, setCoverOpaque] = useState(false);

  latestControlsRef.current = { holdAtCover, releaseCover };
  onCompleteRef.current = onComplete;
  onCoverOpaqueRef.current = onCoverOpaque;

  const resolvedCompletionPolicy = requireCompletionPolicy(completionPolicy, {
    active,
    ceremonyId,
    onCoverOpaque,
    onComplete,
  });

  useEffect(() => {
    if (!active) return undefined;
    const canvas = canvasRef.current;
    if (!canvas) return undefined;

    completeRef.current = false;
    coverOpaqueRef.current = false;
    setCoverOpaque(false);
    const durationMs = getCeremonyDurationMs(ceremonyId);
    const releaseGated = resolvedCompletionPolicy
      === CEREMONY_COMPLETION_POLICIES.RELEASE_GATED;
    let rendererController = null;
    let rendererFailed = false;
    let rendererCompletionPending = false;
    let fallbackTimer = 0;
    let coverWatchdogTimer = 0;
    let completionWatchdogTimer = 0;
    const clearLifecycleTimers = () => {
      if (fallbackTimer) {
        window.clearTimeout(fallbackTimer);
        fallbackTimer = 0;
      }
      if (coverWatchdogTimer) {
        window.clearTimeout(coverWatchdogTimer);
        coverWatchdogTimer = 0;
      }
      if (completionWatchdogTimer) {
        window.clearTimeout(completionWatchdogTimer);
        completionWatchdogTimer = 0;
      }
    };
    const completeOnce = () => {
      if (completeRef.current) return;
      if (
        releaseGated
        && (
          latestControlsRef.current.releaseCover !== true
          || coverOpaqueRef.current !== true
        )
      ) {
        rendererCompletionPending = true;
        return;
      }
      completeRef.current = true;
      clearLifecycleTimers();
      rendererController?.dispose?.();
      if (typeof onCompleteRef.current === 'function') {
        onCompleteRef.current({ ceremonyId });
      }
    };
    const armCompletionWatchdog = (controls = latestControlsRef.current) => {
      if (completionWatchdogTimer) {
        window.clearTimeout(completionWatchdogTimer);
        completionWatchdogTimer = 0;
      }
      if (
        (releaseGated || controls.holdAtCover === true)
        && controls.releaseCover !== true
      ) return;
      const delayMs = releaseGated
        ? Math.max(
          0,
          durationMs - FIRST_VISION_DESCENT_TIMELINE.coverHoldAtMs,
        ) + CEREMONY_COMPLETION_WATCHDOG_BUFFER_MS
        : durationMs + CEREMONY_COMPLETION_WATCHDOG_BUFFER_MS;
      completionWatchdogTimer = window.setTimeout(
        completeOnce,
        delayMs,
      );
    };
    const scheduleRendererErrorCompletion = () => {
      if (fallbackTimer || completeRef.current) return;
      fallbackTimer = window.setTimeout(
        completeOnce,
        RENDERER_ERROR_COMPLETION_DELAY_MS,
      );
    };
    const reportCoverOpaqueOnce = (detail = {}) => {
      if (coverOpaqueRef.current) return;
      if (coverWatchdogTimer) {
        window.clearTimeout(coverWatchdogTimer);
        coverWatchdogTimer = 0;
      }
      coverOpaqueRef.current = true;
      const coverPlane = coverPlaneRef.current;
      if (coverPlane && latestControlsRef.current.releaseCover !== true) {
        // The scene switch must never race a CSS transition. Pin this owned DOM
        // cover before notifying the app conductor; it also becomes the explicit
        // degraded cover when the renderer never reports an opaque frame.
        coverPlane.style.setProperty('transition', 'none');
        coverPlane.style.setProperty('opacity', '1');
        void coverPlane.offsetWidth;
        coverPlane.style.removeProperty('transition');
      }
      setCoverOpaque(true);
      if (typeof onCoverOpaqueRef.current === 'function') {
        onCoverOpaqueRef.current({ ceremonyId, ...detail });
      }
      if (
        rendererCompletionPending
        && latestControlsRef.current.releaseCover === true
      ) {
        completeOnce();
      }
    };
    const armCoverWatchdog = () => {
      if (!releaseGated || coverOpaqueRef.current || coverWatchdogTimer) return;
      coverWatchdogTimer = window.setTimeout(() => {
        coverWatchdogTimer = 0;
        recordCeremonyWorkerFailure({
          ceremonyId,
          stage: 'control',
          reason: 'ceremony_cover_watchdog_timeout',
          workerMessageType: 'cover_watchdog',
        });
        reportCoverOpaqueOnce({
          degraded: true,
          reason: 'cover_watchdog_timeout',
        });
      }, FIRST_VISION_DESCENT_TIMELINE.coverOpaqueAtMs
        + CEREMONY_COVER_WATCHDOG_BUFFER_MS);
    };

    if (resolvePrefersReducedMotion()) {
      rendererController = startReducedMotionRenderer({
        ceremonyId,
        ...latestControlsRef.current,
        onCoverOpaque: reportCoverOpaqueOnce,
        onComplete: completeOnce,
      });
    } else {
      const handleRendererError = () => {
        rendererFailed = true;
        if (releaseGated) {
          reportCoverOpaqueOnce({ degraded: true });
          if (latestControlsRef.current.releaseCover === true) {
            scheduleRendererErrorCompletion();
          }
          return;
        }
        if (
          latestControlsRef.current.holdAtCover === true
          && latestControlsRef.current.releaseCover !== true
        ) {
          return;
        }
        scheduleRendererErrorCompletion();
      };

      try {
        rendererController = startWorkerCanvasRenderer(canvas, {
          ceremonyId,
          seed,
          ...latestControlsRef.current,
          onCoverOpaque: reportCoverOpaqueOnce,
          onComplete: completeOnce,
          onError: handleRendererError,
        });
        if (!rendererController) {
          rendererController = startMainCanvasRenderer(canvas, {
            ceremonyId,
            seed,
            ...latestControlsRef.current,
            onCoverOpaque: reportCoverOpaqueOnce,
            onComplete: completeOnce,
          });
        }
      } catch (error) {
        recordCeremonyWorkerFailure({
          ceremonyId,
          stage: 'init',
          reason: resolveWorkerRuntimeFailureReason(error, 'ceremony_worker_mount_failed'),
          workerMessageType: 'mount',
          error,
        });
        try {
          rendererController = startMainCanvasRenderer(canvas, {
            ceremonyId,
            seed,
            ...latestControlsRef.current,
            onCoverOpaque: reportCoverOpaqueOnce,
            onComplete: completeOnce,
          });
        } catch (_) {
          handleRendererError(error);
        }
      }
      armCoverWatchdog();
      armCompletionWatchdog();
      controlSideEffectsRef.current = (controls) => {
        armCompletionWatchdog(controls);
        if (controls.releaseCover === true && rendererCompletionPending) {
          completeOnce();
          return;
        }
        if (controls.releaseCover === true && rendererFailed) {
          scheduleRendererErrorCompletion();
        }
      };
    }
    rendererControllerRef.current = rendererController;

    return () => {
      clearLifecycleTimers();
      rendererControllerRef.current = null;
      controlSideEffectsRef.current = null;
      rendererController?.dispose?.();
      coverPlaneRef.current?.style.removeProperty('opacity');
      coverPlaneRef.current?.style.removeProperty('transition');
    };
  }, [active, ceremonyId, resolvedCompletionPolicy, seed]);

  useEffect(() => {
    rendererControllerRef.current?.setControls?.({ holdAtCover, releaseCover });
    controlSideEffectsRef.current?.({ holdAtCover, releaseCover });
    if (releaseCover) {
      coverPlaneRef.current?.style.removeProperty('opacity');
    }
  }, [holdAtCover, releaseCover]);

  if (!active) return null;

  return (
    <div
      aria-hidden="true"
      className="entropy-ceremony-overlay"
      data-ceremony-id={ceremonyId}
      data-cover-opaque={coverOpaque ? 'true' : 'false'}
      data-cover-held={coverOpaque && holdAtCover && !releaseCover ? 'true' : 'false'}
      data-release-cover={releaseCover ? 'true' : 'false'}
    >
      <canvas
        ref={canvasRef}
        className="entropy-ceremony-overlay__canvas"
      />
      <div ref={coverPlaneRef} className="entropy-ceremony-overlay__cover" />
      <div className="entropy-ceremony-overlay__grain" />
    </div>
  );
}
