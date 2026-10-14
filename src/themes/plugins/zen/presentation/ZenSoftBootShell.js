import { resolveRasterResolution } from '@/platform/rendering/renderBudgetContract.js';
import { observeDevicePixelRatio, readDevicePixelRatio } from '@/platform/rendering/devicePixelRatio.js';
import {
  getThemeBootPresentation,
  getThemeBootStyleVars,
} from '../../../core/boot/presentationCatalog.js';
import {
  THEME_BOOT_SHELL_RENDERER_STATUS,
  attachThemeBootShellRendererReadyPromise,
  attachThemeBootShellExitHandler,
  attachThemeBootShellCompletionPromise,
} from '../../../core/boot/bootShellRendererContract.js';
import {
  WORKER_RUNTIME_SURFACE_IDS,
  WORKER_RUNTIME_SURFACE_STATUS,
  createAdmittedWorkerRuntimeSession,
  recordWorkerRuntimeSurfaceFailure,
  resolveWorkerRuntimeFailureReason,
  requireWorkerRuntimeSurface,
} from '../../../../platform/workers/runtime/index.js';

export const BASE_CANVAS_SIZE = 640;
const BOOT_WORKER_RESIZE_DEBOUNCE_MS = 70;
const BOOT_WORKER_FIRST_FRAME_TIMEOUT_MS = 2400;
const DASHBOARD_BOOT_RENDERER_READY_EVENT = 'entropy:dashboard-boot-renderer-ready';
const DASHBOARD_BOOT_RENDERER_FAILURE_EVENT = 'entropy:dashboard-boot-renderer-failure';
const DASHBOARD_BOOT_RENDERER_SURFACE = requireWorkerRuntimeSurface(
  WORKER_RUNTIME_SURFACE_IDS.DASHBOARD_BOOT_RENDERER,
);

export const ZEN_ENSO_BOOT_CSS = `
@keyframes zenEnsoStageRise {
  from { opacity: 0; transform: translateY(14px) scale(0.99); }
  to { opacity: 1; transform: translateY(0) scale(1); }
}

.zen-enso-boot {
  position: fixed;
  inset: 0;
  z-index: 2147483647;
  overflow: hidden;
  isolation: isolate;
  pointer-events: none;
  color: var(--boot-text);
  background:
    radial-gradient(circle at 50% 45%, rgba(255, 255, 255, 0.42), rgba(255, 255, 255, 0) 42%),
    linear-gradient(180deg, var(--zen-enso-bg-a), var(--zen-enso-bg-b) 58%, var(--zen-enso-bg-c));
}

.zen-enso-boot__paper-field {
  position: absolute;
  inset: 0;
  background:
    linear-gradient(115deg, rgba(255, 255, 255, 0.44), rgba(255, 255, 255, 0) 38%),
    repeating-linear-gradient(
      92deg,
      rgba(93, 64, 55, 0.025) 0 1px,
      rgba(0, 0, 0, 0) 1px 7px
    ),
    repeating-linear-gradient(
      178deg,
      rgba(93, 64, 55, 0.016) 0 1px,
      rgba(0, 0, 0, 0) 1px 11px
    );
  opacity: 0.64;
}

.zen-enso-boot__wash {
  position: absolute;
  inset: -12%;
  background:
    radial-gradient(circle at 50% 45%, rgba(255, 255, 255, 0.5), rgba(255, 255, 255, 0) 34%),
    radial-gradient(circle at 50% 46%, rgba(125, 142, 103, 0) 0 48%, rgba(125, 142, 103, 0.055) 88%);
  opacity: 0.86;
}

.zen-enso-boot__grain {
  position: absolute;
  inset: -10%;
  opacity: var(--zen-enso-grain-opacity);
  mix-blend-mode: soft-light;
  background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 220 220' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.72' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.2'/%3E%3C/svg%3E");
}

.zen-enso-boot__stage {
  position: absolute;
  inset: 0;
  z-index: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 40px 24px;
  animation: zenEnsoStageRise 0.78s cubic-bezier(0.22, 1, 0.36, 1) both;
}

.zen-enso-boot__enso-shell {
  position: relative;
  width: min(372px, 72vmin);
  height: min(372px, 72vmin);
  display: grid;
  place-items: center;
  isolation: isolate;
}

.zen-enso-boot__canvas {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
}

@media (max-width: 720px) {
  .zen-enso-boot__stage {
    padding: 30px 18px;
  }

  .zen-enso-boot__enso-shell {
    width: 264px;
    height: 264px;
  }
}

@media (prefers-reduced-motion: reduce) {
  .zen-enso-boot__stage {
    animation: none !important;
  }
}
`;

function serializeStyleVars(styleVars) {
  return Object.entries(styleVars).map(([key, value]) => `${key}:${value}`).join(';');
}

function createDiv(className, textContent = null) {
  const element = document.createElement('div');
  element.className = className;
  if (typeof textContent === 'string') {
    element.textContent = textContent;
  }
  return element;
}

function appendChildren(parent, children) {
  for (const child of children) {
    parent.appendChild(child);
  }
  return parent;
}

function createZenEnsoCanvas() {
  const canvas = document.createElement('canvas');
  canvas.className = 'zen-enso-boot__canvas';
  canvas.width = BASE_CANVAS_SIZE;
  canvas.height = BASE_CANVAS_SIZE;
  return canvas;
}

export function getZenEnsoStyle(activePresentation = null) {
  const resolvedPresentation = activePresentation || getThemeBootPresentation('zen');
  return {
    ...getThemeBootStyleVars(resolvedPresentation),
    '--zen-enso-bg-a': '#fdfbf7',
    '--zen-enso-bg-b': '#f8f6f0',
    '--zen-enso-bg-c': '#efe7dc',
    '--zen-enso-grain-opacity': '0.13',
  };
}

function nowMs() {
  return typeof performance !== 'undefined' && typeof performance.now === 'function'
    ? performance.now()
    : Date.now();
}

export function mountZenEnsoCanvas(canvas, {
  seed = 'zen-enso-loader',
  renderMode = 'animated',
  durationMs = 2200,
  onStrokeComplete = null,
  onRendererFirstFrame = null,
  onRendererFailure = null,
  onRendererTimeout = null,
} = {}) {
  return startDashboardBootEnsoWorker(canvas, {
    seed,
    renderMode,
    durationMs,
    onStrokeComplete,
    onRendererFirstFrame,
    onRendererFailure,
    onRendererTimeout,
  });
}

function resolveCanvasMetrics(canvas) {
  const rect = canvas?.getBoundingClientRect?.() || {};
  const width = Math.max(1, Math.round(Number(rect.width) || canvas?.clientWidth || BASE_CANVAS_SIZE));
  const height = Math.max(1, Math.round(Number(rect.height) || canvas?.clientHeight || BASE_CANVAS_SIZE));
  const { effectivePixelRatio: dpr } = resolveRasterResolution({ cssWidth: width, cssHeight: height, devicePixelRatio: readDevicePixelRatio(),
            pixelRatioCap: 2, maxRenderPixels: 8_294_400 });
  return { width, height, dpr };
}

function getReducedMotionMedia() {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    return null;
  }
  return window.matchMedia('(prefers-reduced-motion: reduce)');
}

function addMotionPreferenceListener(media, listener) {
  if (!media || typeof listener !== 'function') return;
  if (typeof media.addEventListener === 'function') {
    media.addEventListener('change', listener);
    return;
  }
  if (typeof media.addListener === 'function') {
    media.addListener(listener);
  }
}

function removeMotionPreferenceListener(media, listener) {
  if (!media || typeof listener !== 'function') return;
  if (typeof media.removeEventListener === 'function') {
    media.removeEventListener('change', listener);
    return;
  }
  if (typeof media.removeListener === 'function') {
    media.removeListener(listener);
  }
}

function resolveDashboardBootWorkerUnavailableReason(canvas) {
  if (DASHBOARD_BOOT_RENDERER_SURFACE.status !== WORKER_RUNTIME_SURFACE_STATUS.ACTIVE) {
    return 'surface_not_active';
  }
  if (typeof window === 'undefined') {
    return 'window_unavailable';
  }
  if (typeof Worker === 'undefined') {
    return 'worker_unavailable';
  }
  if (typeof OffscreenCanvas === 'undefined') {
    return 'offscreen_canvas_unavailable';
  }
  if (typeof canvas?.transferControlToOffscreen !== 'function') {
    return 'canvas_transfer_unavailable';
  }
  return '';
}

function getBootShellFailureTarget(canvas) {
  return canvas?.closest?.('.zen-enso-boot') || canvas || null;
}

function buildDashboardBootRendererDetail(canvas, status, detail = {}) {
  return {
    surfaceId: WORKER_RUNTIME_SURFACE_IDS.DASHBOARD_BOOT_RENDERER,
    workerId: DASHBOARD_BOOT_RENDERER_SURFACE.workerId,
    themeId: canvas?.closest?.('.zen-enso-boot')?.dataset?.themeId || 'zen',
    status,
    ...detail,
  };
}

function dispatchDashboardBootRendererReady(detail) {
  if (
    typeof window !== 'undefined'
    && typeof window.dispatchEvent === 'function'
    && typeof CustomEvent === 'function'
  ) {
    window.dispatchEvent(new CustomEvent(DASHBOARD_BOOT_RENDERER_READY_EVENT, { detail }));
  }
}

function markDashboardBootRendererFailure(canvas, reason, error = null) {
  const safeReason = resolveWorkerRuntimeFailureReason(
    reason,
    'unknown_dashboard_boot_renderer_failure',
  );
  const message = `[ZenSoftBootShell] dashboard_boot_renderer failed: ${safeReason}`;
  const target = getBootShellFailureTarget(canvas);
  const errorMessage = resolveWorkerRuntimeFailureReason(error, safeReason);
  const detail = buildDashboardBootRendererDetail(canvas, THEME_BOOT_SHELL_RENDERER_STATUS.FAILED, {
    reason: safeReason,
    error: errorMessage,
    message,
    degraded: true,
  });
  recordWorkerRuntimeSurfaceFailure({
    surfaceId: WORKER_RUNTIME_SURFACE_IDS.DASHBOARD_BOOT_RENDERER,
    stage: 'init',
    reason: safeReason,
    workerMessageType: 'renderer_failure',
    error,
    details: {
      themeId: detail.themeId,
      status: detail.status,
      error: errorMessage,
    },
    messagePrefix: 'DASHBOARD_BOOT_RENDERER_FAIL',
  });

  if (target?.dataset) {
    target.dataset.dashboardBootRendererStatus = THEME_BOOT_SHELL_RENDERER_STATUS.FAILED;
    target.dataset.dashboardBootRendererError = safeReason;
    target.dataset.dashboardBootRendererErrorDetail = errorMessage;
  }
  if (canvas?.dataset) {
    canvas.dataset.dashboardBootRendererStatus = THEME_BOOT_SHELL_RENDERER_STATUS.FAILED;
    canvas.dataset.dashboardBootRendererError = safeReason;
    canvas.dataset.dashboardBootRendererErrorDetail = errorMessage;
  }

  if (typeof console !== 'undefined' && typeof console.error === 'function') {
    console.error(message, detail);
  }

  if (
    typeof window !== 'undefined'
    && typeof window.dispatchEvent === 'function'
    && typeof CustomEvent === 'function'
  ) {
    window.dispatchEvent(new CustomEvent(DASHBOARD_BOOT_RENDERER_FAILURE_EVENT, { detail }));
  }

  return detail;
}

function markDashboardBootRendererTimeout(canvas, reason, timeoutMs) {
  const safeReason = resolveWorkerRuntimeFailureReason(
    reason,
    'dashboard_boot_renderer_timeout',
  );
  const target = getBootShellFailureTarget(canvas);
  const detail = buildDashboardBootRendererDetail(canvas, THEME_BOOT_SHELL_RENDERER_STATUS.TIMEOUT, {
    reason: safeReason,
    timeoutMs,
    degraded: true,
  });

  if (target?.dataset) {
    target.dataset.dashboardBootRendererStatus = THEME_BOOT_SHELL_RENDERER_STATUS.TIMEOUT;
    target.dataset.dashboardBootRendererError = safeReason;
    target.dataset.dashboardBootRendererErrorDetail = `TIMEOUT_${timeoutMs}MS`;
  }
  if (canvas?.dataset) {
    canvas.dataset.dashboardBootRendererStatus = THEME_BOOT_SHELL_RENDERER_STATUS.TIMEOUT;
    canvas.dataset.dashboardBootRendererError = safeReason;
    canvas.dataset.dashboardBootRendererErrorDetail = `TIMEOUT_${timeoutMs}MS`;
  }

  if (typeof console !== 'undefined' && typeof console.warn === 'function') {
    console.warn(`[ZenSoftBootShell] dashboard_boot_renderer wait budget exceeded: ${safeReason}`, detail);
  }

  dispatchDashboardBootRendererReady(detail);
  return detail;
}

function markDashboardBootRendererActive(canvas) {
  const target = getBootShellFailureTarget(canvas);
  if (target?.dataset) {
    target.dataset.dashboardBootRendererStatus = THEME_BOOT_SHELL_RENDERER_STATUS.ACTIVE;
    delete target.dataset.dashboardBootRendererError;
    delete target.dataset.dashboardBootRendererErrorDetail;
  }
  if (canvas?.dataset) {
    canvas.dataset.dashboardBootRendererStatus = THEME_BOOT_SHELL_RENDERER_STATUS.ACTIVE;
    delete canvas.dataset.dashboardBootRendererError;
    delete canvas.dataset.dashboardBootRendererErrorDetail;
  }
}

function markDashboardBootRendererFirstFrame(canvas, payload = {}) {
  const target = getBootShellFailureTarget(canvas);
  const detail = buildDashboardBootRendererDetail(canvas, THEME_BOOT_SHELL_RENDERER_STATUS.FIRST_FRAME, {
    degraded: false,
    ...payload,
  });

  if (target?.dataset) {
    target.dataset.dashboardBootRendererStatus = THEME_BOOT_SHELL_RENDERER_STATUS.FIRST_FRAME;
    delete target.dataset.dashboardBootRendererError;
    delete target.dataset.dashboardBootRendererErrorDetail;
  }
  if (canvas?.dataset) {
    canvas.dataset.dashboardBootRendererStatus = THEME_BOOT_SHELL_RENDERER_STATUS.FIRST_FRAME;
    delete canvas.dataset.dashboardBootRendererError;
    delete canvas.dataset.dashboardBootRendererErrorDetail;
  }

  dispatchDashboardBootRendererReady(detail);
  return detail;
}

function startDashboardBootEnsoWorker(canvas, {
  seed = 'zen-enso-loader',
  renderMode = 'animated',
  durationMs = 2200,
  onStrokeComplete = null,
  onRendererFirstFrame = null,
  onRendererFailure = null,
  onRendererTimeout = null,
} = {}) {
  const unavailableReason = resolveDashboardBootWorkerUnavailableReason(canvas);
  if (unavailableReason) {
    const detail = markDashboardBootRendererFailure(canvas, unavailableReason);
    if (typeof onRendererFailure === 'function') {
      onRendererFailure(detail);
    }
    return () => {};
  }

  let worker = null;
  let workerSession = null;
  let transferred = false;
  let disposed = false;
  let resizeTimerId = 0;
  let stopDpr = null;
  let firstFrameTimeoutId = 0;
  let firstFrameSettled = false;
  let firstFrameTimedOut = false;
  let rendererFailed = false;
  const media = getReducedMotionMedia();

  const failRenderer = (reason, error = null) => {
    if (disposed || rendererFailed) return;
    rendererFailed = true;
    firstFrameSettled = true;
    window.clearTimeout(firstFrameTimeoutId);
    firstFrameTimeoutId = 0;
    const detail = markDashboardBootRendererFailure(canvas, reason, error);
    // First-frame readiness and presentation completion are separate promises.
    // A later failure must also release a shell waiting for the completed stroke.
    if (typeof onRendererFailure === 'function') {
      onRendererFailure(detail);
    }
  };

  const settleFirstFrame = (payload = {}) => {
    if (firstFrameSettled && !firstFrameTimedOut) return;
    if (firstFrameTimedOut) {
      markDashboardBootRendererFirstFrame(canvas, payload);
      return;
    }
    firstFrameSettled = true;
    if (firstFrameTimeoutId) {
      window.clearTimeout(firstFrameTimeoutId);
      firstFrameTimeoutId = 0;
    }
    const detail = markDashboardBootRendererFirstFrame(canvas, payload);
    if (typeof onRendererFirstFrame === 'function') {
      onRendererFirstFrame(detail);
    }
  };

  const settleFirstFrameTimeout = () => {
    if (firstFrameSettled) return;
    firstFrameSettled = true;
    firstFrameTimedOut = true;
    window.clearTimeout(firstFrameTimeoutId);
    firstFrameTimeoutId = 0;
    const detail = markDashboardBootRendererTimeout(
      canvas,
      'first_frame_timeout',
      BOOT_WORKER_FIRST_FRAME_TIMEOUT_MS,
    );
    if (typeof onRendererTimeout === 'function') {
      onRendererTimeout(detail);
    }
  };

  const post = (type, payload = {}, transfer = undefined) => {
    if (disposed || !worker) return false;
    if (Array.isArray(transfer)) {
      worker.postMessage({ type, payload }, transfer);
    } else {
      worker.postMessage({ type, payload });
    }
    return true;
  };

  const postResize = () => {
    post('resize', resolveCanvasMetrics(canvas));
  };

  const handleResize = () => {
    window.clearTimeout(resizeTimerId);
    resizeTimerId = window.setTimeout(postResize, BOOT_WORKER_RESIZE_DEBOUNCE_MS);
  };

  const handleMotionPreferenceChange = (event) => {
    post('motion', { reducedMotion: event?.matches === true });
  };

  function dispose() {
    if (disposed) return;
    disposed = true;
    window.clearTimeout(resizeTimerId);
    window.clearTimeout(firstFrameTimeoutId);
    window.removeEventListener('resize', handleResize);
    stopDpr?.();
    removeMotionPreferenceListener(media, handleMotionPreferenceChange);
    try {
      worker?.postMessage({ type: 'dispose' });
    } catch (_) {
      // The worker may already be gone during teardown.
    }
    workerSession?.terminate({ reason: 'dashboard_boot_renderer_disposed', throwOnError: false });
    workerSession = null;
    worker = null;
  }

  try {
    workerSession = createAdmittedWorkerRuntimeSession({
      surfaceId: WORKER_RUNTIME_SURFACE_IDS.DASHBOARD_BOOT_RENDERER,
      createWorker: () => new Worker(new URL('./ZenSoftBootShell.worker.js', import.meta.url), {
        type: 'module',
        // Keep this literal aligned with WorkerRuntimeRegistry; Vite requires static worker options.
        name: 'dashboard_boot_renderer',
      }),
      onRevoked(details = {}) {
        failRenderer(
          `WORKER_RUNTIME_ADMISSION_REVOKED:${details?.reason || 'unknown'}`,
        );
        dispose();
      },
    });
    worker = workerSession.worker;
    const metrics = resolveCanvasMetrics(canvas);
    const offscreenCanvas = canvas.transferControlToOffscreen();
    transferred = true;

    worker.onmessage = (event) => {
      if (disposed) return;
      const message = event?.data || {};
      if (message.type === 'first_frame') {
        settleFirstFrame(message?.payload || {});
        return;
      }
      if (message.type === 'stroke_complete') {
        // The completed canvas remains visible while Main prepares and the shell
        // fades. This one-shot worker no longer needs its burst admission lease.
        dispose();
        onStrokeComplete?.(message.payload);
        return;
      }
      if (message.type === 'error') {
        failRenderer('worker_error', message?.payload?.error || message.error);
        dispose();
      }
    };
    worker.onerror = (error) => {
      failRenderer('worker_uncaught_error', error);
      dispose();
    };

    markDashboardBootRendererActive(canvas);
    firstFrameTimeoutId = window.setTimeout(() => {
      settleFirstFrameTimeout();
      dispose();
    }, BOOT_WORKER_FIRST_FRAME_TIMEOUT_MS);
    post('init', {
      canvas: offscreenCanvas,
      ...metrics,
      seed,
      includePaper: false,
      renderMode,
      durationMs,
      reducedMotion: media?.matches === true,
    }, [offscreenCanvas]);
  } catch (error) {
    const admissionReason = String(error?.message || '').startsWith('WORKER_RUNTIME_ADMISSION_')
      ? String(error.message)
      : null;
    failRenderer(
      admissionReason || (transferred ? 'worker_start_failed_after_transfer' : 'worker_start_failed'),
      error,
    );
    workerSession?.terminate({ reason: 'dashboard_boot_renderer_start_failed', throwOnError: false });
    workerSession = null;
    worker = null;
    return () => {};
  }

  stopDpr = observeDevicePixelRatio({ onChange: handleResize });
  window.addEventListener('resize', handleResize);
  addMotionPreferenceListener(media, handleMotionPreferenceChange);
  return dispose;
}

function createDashboardBootRendererReadiness() {
  let settlePromise = null;
  let settled = false;
  const promise = new Promise((resolve) => {
    settlePromise = resolve;
  });

  const settle = (detail = {}) => {
    if (settled) return;
    settled = true;
    const status = String(detail?.status || THEME_BOOT_SHELL_RENDERER_STATUS.FAILED);
    settlePromise({
      ...detail,
      status,
      degraded: detail?.degraded === true || status === THEME_BOOT_SHELL_RENDERER_STATUS.FAILED,
    });
  };

  return {
    promise,
    resolveFirstFrame(detail = {}) {
      settle({
        ...detail,
        status: THEME_BOOT_SHELL_RENDERER_STATUS.FIRST_FRAME,
        degraded: false,
      });
    },
    resolveFailure(detail = {}) {
      settle({
        ...detail,
        status: THEME_BOOT_SHELL_RENDERER_STATUS.FAILED,
        degraded: true,
      });
    },
    resolveTimeout(detail = {}) {
      settle({
        ...detail,
        status: THEME_BOOT_SHELL_RENDERER_STATUS.TIMEOUT,
        degraded: true,
      });
    },
  };
}

function scheduleAfterBootShellPaint(callback) {
  if (typeof callback !== 'function') return () => {};
  if (typeof window === 'undefined') return () => {};

  if (typeof window.requestAnimationFrame === 'function') {
    let frameId = window.requestAnimationFrame(() => {
      frameId = window.requestAnimationFrame(() => {
        frameId = 0;
        callback();
      });
    });
    return () => {
      if (frameId) {
        window.cancelAnimationFrame(frameId);
      }
    };
  }

  const timerId = window.setTimeout(callback, 32);
  return () => window.clearTimeout(timerId);
}

export function createBootShellElement({
  themeId = 'zen',
  shellId = '',
  fadeMs = 420,
  resolvePresentation = null,
} = {}) {
  const activePresentation = getThemeBootPresentation(themeId);
  const shell = document.createElement('div');
  if (shellId) {
    shell.id = shellId;
  }
  shell.dataset.themeId = activePresentation.themeId;
  shell.className = 'zen-enso-boot';
  shell.style.cssText = [
    serializeStyleVars(getZenEnsoStyle(activePresentation)),
    'opacity:1',
    `transition:opacity ${fadeMs}ms ease`,
  ].join(';');

  // Removing a global stylesheet with the fading shell invalidates the newly
  // revealed dashboard's styles. Keep these scoped rules once per document.
  if (!document.head.querySelector('style[data-zen-boot-styles]')) {
    const style = document.createElement('style');
    style.setAttribute('data-zen-boot-styles', '1');
    style.textContent = ZEN_ENSO_BOOT_CSS;
    document.head.appendChild(style);
  }

  const stage = createDiv('zen-enso-boot__stage');
  const ensoShell = createDiv('zen-enso-boot__enso-shell');
  ensoShell.setAttribute('aria-hidden', 'true');
  const canvas = createZenEnsoCanvas();

  appendChildren(ensoShell, [
    canvas,
  ]);

  appendChildren(stage, [
    ensoShell,
  ]);

  appendChildren(shell, [
    createDiv('zen-enso-boot__paper-field'),
    createDiv('zen-enso-boot__wash'),
    createDiv('zen-enso-boot__grain'),
    stage,
  ]);

  document.body.appendChild(shell);
  let cleanupCanvas = () => {};
  const rendererReadiness = createDashboardBootRendererReadiness();
  attachThemeBootShellRendererReadyPromise(shell, rendererReadiness.promise);
  let completePresentation;
  let disposed = false;
  const completion = new Promise((resolve) => { completePresentation = resolve; });
  attachThemeBootShellCompletionPromise(shell, completion);
  rendererReadiness.promise.then((result) => {
    if (result.status !== THEME_BOOT_SHELL_RENDERER_STATUS.FIRST_FRAME) completePresentation(result);
  });
  const cancelCanvasStart = scheduleAfterBootShellPaint(async () => {
    let presentation;
    try {
      presentation = resolvePresentation ? await resolvePresentation() : { renderMode: 'animated', complete: null };
      if (!['animated', 'static'].includes(presentation?.renderMode)) throw new Error('DASHBOARD_BOOT_PRESENTATION_MODE_INVALID');
    } catch (error) {
      rendererReadiness.resolveFailure(markDashboardBootRendererFailure(canvas, 'presentation_read_failed', error));
      completePresentation({ status: 'failed', reason: 'presentation_read_failed' });
      return;
    }
    if (disposed) return;
    if (!canvas.isConnected) {
      rendererReadiness.resolveFailure(
        markDashboardBootRendererFailure(canvas, 'canvas_disconnected_before_renderer_start'),
      );
      return;
    }
    cleanupCanvas = mountZenEnsoCanvas(canvas, {
      seed: `${activePresentation.themeId}:boot-shell`,
      renderMode: presentation.renderMode,
      durationMs: presentation.durationMs,
      onStrokeComplete: (detail) => {
        completePresentation({ status: 'completed', ...detail });
        if (presentation.complete) {
          void presentation.complete().catch((error) => {
            markDashboardBootRendererFailure(canvas, 'presentation_commit_failed', error);
          });
        }
      },
      onRendererFirstFrame: rendererReadiness.resolveFirstFrame,
      onRendererFailure: (detail) => {
        rendererReadiness.resolveFailure(detail);
        completePresentation({ status: 'failed', ...detail });
      },
      onRendererTimeout: (detail) => {
        rendererReadiness.resolveTimeout(detail);
        completePresentation({ status: 'timeout', ...detail });
      },
    });
  });
  shell.__entropyBootShellDispose = () => {
    disposed = true;
    completePresentation({ status: 'disposed' });
    cancelCanvasStart();
    cleanupCanvas();
  };
  attachThemeBootShellExitHandler(shell, shell.__entropyBootShellDispose);
  return shell;
}
