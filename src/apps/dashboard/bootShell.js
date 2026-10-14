import {
  DASHBOARD_BOOT_EVENT_NAME,
  DASHBOARD_BOOT_RECOVERY_EVENT_NAME,
  DASHBOARD_SETUP_SURFACE_EVENT_NAME,
  getDashboardBootSnapshotFromWindow,
} from './bootstrap/bootEvents.js';
import {
  BOOT_SHELL_HARD_TIMEOUT_MS,
  BOOT_SHELL_INITIAL_PAINT_TIMEOUT_MS,
  BOOT_SHELL_MIN_VISIBLE_MS,
} from './bootstrap/bootConfig.js';
import { waitForBootShellRendererReady } from './bootstrap/bootShellRendererReadiness.js';
import { DEFAULT_THEME_ID } from '../../themes/core/ids.js';
import { createThemeBootShellElement } from '../../themes/core/boot/createThemeBootShellElement.js';
import { getThemeBootShellCompletionPromise, prepareThemeBootShellForExit } from '../../themes/core/boot/bootShellRendererContract.js';
import { resolveDashboardBootShellThemeId } from './bootstrap/dashboardBootShellThemeContext.js';
import { emitZenTrace } from '@zen-trace';

const BOOT_SHELL_ID = 'entropy-dashboard-boot-shell';
const BOOT_SHELL_FADE_MS = 420;

const nowMs = () => (
  typeof performance !== 'undefined' && typeof performance.now === 'function'
    ? performance.now()
    : Date.now()
);

function scheduleAfterAnimationFrames(task, frameCount = 1) {
  if (typeof task !== 'function') return;
  if (typeof window !== 'undefined' && typeof window.requestAnimationFrame === 'function') {
    let remainingFrames = Math.max(1, Math.floor(Number(frameCount) || 1));
    let frameId = 0;
    let cancelled = false;
    const step = () => {
      if (cancelled) return;
      remainingFrames -= 1;
      if (remainingFrames <= 0) {
        task();
        return;
      }
      frameId = window.requestAnimationFrame(step);
    };
    frameId = window.requestAnimationFrame(step);
    return () => {
      cancelled = true;
      if (frameId) {
        window.cancelAnimationFrame(frameId);
      }
    };
  }

  const timerId = window.setTimeout(task, Math.max(16, Math.round(Number(frameCount) || 1) * 16));
  return () => window.clearTimeout(timerId);
}

function scheduleAfterInitialBootPaint(task) {
  if (typeof task !== 'function') return undefined;
  let settled = false;
  let cancelFrameSchedule = null;
  let fallbackTimeoutId = 0;

  const settle = (source) => {
    if (settled) return;
    settled = true;
    cancelFrameSchedule?.();
    cancelFrameSchedule = null;
    if (fallbackTimeoutId) {
      window.clearTimeout(fallbackTimeoutId);
      fallbackTimeoutId = 0;
    }
    task(source);
  };

  cancelFrameSchedule = scheduleAfterAnimationFrames(
    () => settle('animation_frames'),
    2,
  );
  if (!settled) {
    fallbackTimeoutId = window.setTimeout(
      () => settle('raf_liveness_timeout'),
      BOOT_SHELL_INITIAL_PAINT_TIMEOUT_MS,
    );
  }

  return () => {
    if (settled) return;
    settled = true;
    cancelFrameSchedule?.();
    cancelFrameSchedule = null;
    if (fallbackTimeoutId) {
      window.clearTimeout(fallbackTimeoutId);
      fallbackTimeoutId = 0;
    }
  };
}

let bootManagerPromise = null;

function createBootShellFailureError(code, details = {}, cause = null) {
  const error = new Error(code);
  error.name = 'DashboardBootShellError';
  error.code = code;
  error.details = Object.freeze({ ...details });
  if (cause) {
    error.cause = cause;
  }
  return error;
}

function failBootShell(code, details = {}, cause = null) {
  const error = cause instanceof Error
    ? createBootShellFailureError(code, details, cause)
    : createBootShellFailureError(code, {
      ...details,
      cause: cause ? String(cause) : null,
    });
  emitZenTrace('boot_shell:failed', {
    code,
    details,
    cause: cause?.message || cause || null,
  });
  console.error('[BootShell] Strict boot failure.', error);
  return error;
}

function scheduleBootShellCrash(code, details = {}, cause = null) {
  const error = failBootShell(code, details, cause);
  window.setTimeout(() => {
    throw error;
  }, 0);
  return error;
}

function loadBootManager() {
  if (!bootManagerPromise) {
    emitZenTrace('boot_shell:boot_manager_import_start');
    bootManagerPromise = import('./bootstrap/bootManager.js');
  }
  return bootManagerPromise;
}

function resolveBootTheme() {
  return resolveDashboardBootShellThemeId({
    fallbackThemeId: DEFAULT_THEME_ID,
  });
}

function createBootShellElement(themeId) {
  return createThemeBootShellElement(themeId, {
    shellId: BOOT_SHELL_ID,
    fadeMs: BOOT_SHELL_FADE_MS,
    resolvePresentation: () => import('./bootstrap/bootEnsoPresentation.js')
      .then(({ resolveBootEnsoPresentation }) => resolveBootEnsoPresentation()),
  });
}

function buildThemeReadyMetadata({
  shell,
  requestedThemeId,
  rendererReadiness,
} = {}) {
  const themeId = shell?.dataset?.themeId || requestedThemeId;
  return {
    source: 'boot_shell',
    shellId: BOOT_SHELL_ID,
    themeId,
    degraded: rendererReadiness?.degraded === true,
    renderer: rendererReadiness || null,
  };
}

function startBootShell() {
  if (document.getElementById(BOOT_SHELL_ID)) {
    emitZenTrace('boot_shell:skip_existing_shell');
    throw failBootShell('BOOT_SHELL_DUPLICATE_INSTANCE', { shellId: BOOT_SHELL_ID });
  }

  const rootEl = document.getElementById('root');
  if (!rootEl) {
    throw failBootShell('BOOT_SHELL_ROOT_MISSING', { shellId: BOOT_SHELL_ID });
  }
  const rootInitialVisibility = rootEl.style.visibility;
  const rootInitialPointerEvents = rootEl.style.pointerEvents;
  const rootInitiallyInert = rootEl.hasAttribute('inert');
  rootEl.style.visibility = 'hidden';
  rootEl.style.pointerEvents = 'none';
  rootEl.setAttribute('inert', '');

  let hardTimeoutId = 0;
  let handleBootSnapshotEvent = null;
  let handleRecoverySurfaceEvent = null;
  let handleSetupSurfaceEvent = null;
  let cancelInitialPaintSchedule = null;

  try {
    const requestedThemeId = resolveBootTheme();
    const shell = createBootShellElement(requestedThemeId);
    // Prepare the temporary overlay's compositing layer from its first paint,
    // rather than promoting/rasterizing it when the dashboard is exposed.
    shell.style.willChange = 'opacity';
    const shellMountedAt = nowMs();
    let dashboardImportStarted = false;
    const startDashboardImport = () => {
      if (dashboardImportStarted) return;
      dashboardImportStarted = true;
      cancelInitialPaintSchedule?.();
      cancelInitialPaintSchedule = null;
      emitZenTrace('boot_shell:dashboard_import_start');
      import('./main.jsx')
        .then((dashboardEntry) => {
          emitZenTrace('boot_shell:dashboard_import_module_ready');
          if (typeof dashboardEntry?.startDashboardRuntime !== 'function') {
            throw new Error('BOOT_SHELL_DASHBOARD_START_REQUIRED');
          }
          return dashboardEntry.startDashboardRuntime();
        })
        .then(() => {
          emitZenTrace('boot_shell:dashboard_import_ready');
        })
        .catch((error) => {
          emitZenTrace('boot_shell:dashboard_import_failed', { error });
          failBootShell('BOOT_SHELL_DASHBOARD_IMPORT_FAILED', {
            shellId: BOOT_SHELL_ID,
            themeId: shell.dataset.themeId || requestedThemeId,
          }, error);
          void import('./bootstrap/dashboardBootFailureSurface.js')
            .then(({ mountDashboardBootFailureSurface }) => {
              mountDashboardBootFailureSurface(rootEl);
            })
            .catch((surfaceError) => {
              scheduleBootShellCrash('BOOT_SHELL_RECOVERY_SURFACE_FAILED', {
                shellId: BOOT_SHELL_ID,
              }, surfaceError);
            });
        });
    };
    emitZenTrace('boot_shell:mounted', {
      requestedThemeId,
      hasRoot: Boolean(rootEl),
    });
    cancelInitialPaintSchedule = scheduleAfterInitialBootPaint((paintAdmissionSource) => {
      emitZenTrace('boot_shell:initial_paint_ready', {
        source: paintAdmissionSource,
      });
      if (paintAdmissionSource === 'raf_liveness_timeout') {
        emitZenTrace('boot_shell:initial_paint_liveness_fallback', {
          timeoutMs: BOOT_SHELL_INITIAL_PAINT_TIMEOUT_MS,
        });
      }
      const rendererReadinessPromise = waitForBootShellRendererReady(shell);

      void loadBootManager()
        .then(({ reportThemeReady }) => rendererReadinessPromise.then((rendererReadiness) => {
          emitZenTrace('boot_shell:renderer_ready', {
            status: rendererReadiness.status,
            degraded: rendererReadiness.degraded === true,
            reason: rendererReadiness.reason || '',
          });
          const metadata = buildThemeReadyMetadata({
            shell,
            requestedThemeId,
            rendererReadiness,
          });
          emitZenTrace('boot_shell:report_theme_ready', {
            themeId: metadata.themeId,
            rendererStatus: rendererReadiness.status,
            degraded: rendererReadiness.degraded === true,
          });
          reportThemeReady(metadata);
        }))
        .catch((error) => {
          emitZenTrace('boot_shell:report_theme_ready_failed', { error });
          scheduleBootShellCrash('BOOT_SHELL_THEME_READY_FAILED', {
            shellId: BOOT_SHELL_ID,
            themeId: shell.dataset.themeId || requestedThemeId,
          }, error);
        });

      startDashboardImport();
    });

    let dismissed = false;

    let rootPaintPrepared = false;
    const prepareRootForPaint = (snapshot) => {
      if (rootPaintPrepared || dismissed || !snapshot?.themeReady || !snapshot?.coreReady) return;
      rootPaintPrepared = true;
      // The opaque theme shell still covers the app. Let its normal DOM/canvas
      // paint preparation overlap Main readiness; interaction and accessibility
      // remain gated until the existing release, without adding a delay/ACK.
      rootEl.style.visibility = rootInitialVisibility;
      emitZenTrace('boot_shell:root_paint_prepared');
    };

    const revealRoot = () => {
      rootEl.style.visibility = rootInitialVisibility;
      rootEl.style.pointerEvents = rootInitialPointerEvents;
      if (!rootInitiallyInert) rootEl.removeAttribute('inert');
      emitZenTrace('boot_shell:root_revealed');
    };

    const reportShellDismissed = (reason) => {
      void loadBootManager()
        .then(({ reportBootShellDismissed }) => {
          if (typeof reportBootShellDismissed === 'function') {
            emitZenTrace('boot_shell:report_dismissed', { reason });
            reportBootShellDismissed({
              reason,
              shellId: BOOT_SHELL_ID,
              themeId: shell.dataset.themeId || requestedThemeId,
              visibleForMs: Math.max(0, Math.round(nowMs() - shellMountedAt)),
            });
          }
        })
        .catch((error) => {
          emitZenTrace('boot_shell:report_dismissed_failed', { reason, error });
          scheduleBootShellCrash('BOOT_SHELL_DISMISS_REPORT_FAILED', {
            reason,
            shellId: BOOT_SHELL_ID,
            themeId: shell.dataset.themeId || requestedThemeId,
          }, error);
        });
    };

    const isFailedBootSnapshot = (snapshot = null) => (
      snapshot
      && typeof snapshot === 'object'
      && snapshot.status === 'failed'
    );

    const buildFailedBootSnapshotDetails = (snapshot = null, reason = 'boot_snapshot_failed') => ({
      reason,
      shellId: BOOT_SHELL_ID,
      themeId: shell.dataset.themeId || requestedThemeId,
      status: snapshot?.status || null,
      phase: snapshot?.phase || null,
      themeReady: snapshot?.themeReady === true,
      coreReady: snapshot?.coreReady === true,
      mainTabFirstFrameReady: snapshot?.mainTabFirstFrameReady === true,
      errors: Array.isArray(snapshot?.errors) ? snapshot.errors : [],
    });

    const buildHardTimeoutForcedReleaseMetadata = (snapshot = null) => ({
      reason: 'hard_timeout',
      source: 'boot_shell_hard_timeout',
      shellId: BOOT_SHELL_ID,
      themeId: shell.dataset.themeId || requestedThemeId,
      status: snapshot?.status || null,
      phase: snapshot?.phase || null,
      themeReady: snapshot?.themeReady === true,
      coreReady: snapshot?.coreReady === true,
      mainTabFirstFrameReady: snapshot?.mainTabFirstFrameReady === true,
      mainTabFirstFrameDegraded: snapshot?.mainTabFirstFrameDegraded === true,
      mainTabFirstFrameWaitBudgetExceeded: snapshot?.mainTabFirstFrameWaitBudgetExceeded === true,
      timeoutMs: BOOT_SHELL_HARD_TIMEOUT_MS,
      visibleForMs: Math.max(0, Math.round(nowMs() - shellMountedAt)),
    });

    const reportHardTimeoutForcedRelease = (metadata) => (
      loadBootManager()
        .then(({ reportForcedVisualRelease }) => {
          if (typeof reportForcedVisualRelease !== 'function') return;
          reportForcedVisualRelease(metadata);
        })
        .catch((error) => {
          emitZenTrace('boot_shell:report_forced_visual_release_failed', {
            reason: metadata?.reason || 'hard_timeout',
            error,
          });
          scheduleBootShellCrash('BOOT_SHELL_FORCED_RELEASE_REPORT_FAILED', {
            reason: metadata?.reason || 'hard_timeout',
            shellId: BOOT_SHELL_ID,
            themeId: shell.dataset.themeId || requestedThemeId,
          }, error);
        })
    );

    const startFadeOut = (reason) => {
      emitZenTrace('boot_shell:fade_start', {
        reason,
        visibleForMs: Math.max(0, Math.round(nowMs() - shellMountedAt)),
      });
      // Keep the completed picture for the fade; release its renderer before
      // native teardown can land on the exposed dashboard.
      prepareThemeBootShellForExit(shell);
      revealRoot();
      shell.style.opacity = '0';
      window.setTimeout(() => {
        if (shell.parentNode) {
          if (typeof shell.__entropyBootShellDispose === 'function') {
            shell.__entropyBootShellDispose();
          }
          shell.parentNode.removeChild(shell);
        }
        reportShellDismissed(reason);
      }, BOOT_SHELL_FADE_MS + 40);
    };

    const dismiss = (reason = 'ready') => {
      if (dismissed) return;
      if (reason === 'ready' && !presentationComplete) {
        pendingPresentationDismiss = reason;
        emitZenTrace('boot_shell:waiting_for_stroke_completion');
        return;
      }
      dismissed = true;
      emitZenTrace('boot_shell:dismiss_requested', { reason });
      window.removeEventListener(DASHBOARD_BOOT_EVENT_NAME, handleBootSnapshotEvent);
      window.removeEventListener(DASHBOARD_BOOT_RECOVERY_EVENT_NAME, handleRecoverySurfaceEvent);
      window.removeEventListener(DASHBOARD_SETUP_SURFACE_EVENT_NAME, handleSetupSurfaceEvent);
      if (hardTimeoutId) {
        window.clearTimeout(hardTimeoutId);
        hardTimeoutId = 0;
      }

      const minimumDelayMs = Math.max(0, BOOT_SHELL_MIN_VISIBLE_MS - (nowMs() - shellMountedAt));

      window.setTimeout(() => {
        if (reason !== 'ready') {
          // A failed boot can be caused by suspended animation frames. Its
          // terminal release must not wait on the same unavailable frame source.
          startFadeOut(reason);
          return;
        }
        scheduleAfterAnimationFrames(() => {
          startFadeOut(reason);
        }, 1);
      }, minimumDelayMs);
    };

    const presentationCompletion = getThemeBootShellCompletionPromise(shell);
    let presentationComplete = presentationCompletion === null;
    let pendingPresentationDismiss = null;
    presentationCompletion?.then((result) => {
      presentationComplete = true;
      emitZenTrace('boot_shell:presentation_complete', result);
      if (pendingPresentationDismiss !== null) {
        dismiss(result.status === 'completed' ? pendingPresentationDismiss : 'presentation_failed');
      }
    });

    const releaseFailedBootSnapshot = (snapshot = null, reason = 'boot_snapshot_failed') => {
      failBootShell('BOOT_SHELL_BOOT_STATE_FAILED', buildFailedBootSnapshotDetails(snapshot, reason));
      revealRoot();
      window.setTimeout(startDashboardImport, 0);
      dismiss(reason);
    };

    handleBootSnapshotEvent = (event) => {
      const detail = event?.detail;
      if (!detail || typeof detail !== 'object') return;
      emitZenTrace('boot_shell:snapshot', {
        status: detail.status,
        phase: detail.phase,
        dismissible: detail.dismissible === true,
        degraded: detail.degraded === true,
        themeReady: detail.themeReady === true,
        coreReady: detail.coreReady === true,
        mainTabFirstFrameReady: detail.mainTabFirstFrameReady === true,
      });
      if (isFailedBootSnapshot(detail)) {
        releaseFailedBootSnapshot(detail, 'snapshot_event_failed');
        return;
      }
      prepareRootForPaint(detail);
      if (detail.dismissible === true) {
        dismiss(detail.degraded === true ? 'degraded' : 'ready');
      }
    };

    window.addEventListener(DASHBOARD_BOOT_EVENT_NAME, handleBootSnapshotEvent);
    handleRecoverySurfaceEvent = (event) => {
      if (!['profile_recovery', 'boot_failed', 'boot_timeout'].includes(event?.detail?.reason)) return;
      emitZenTrace('boot_shell:recovery_surface_ready', { reason: event.detail.reason });
      // Recovery has its own visible control surface, never a clean core/frame
      // readiness ACK. Do not wait for the decorative intro to finish.
      revealRoot();
      dismiss('recovery_required');
    };
    window.addEventListener(DASHBOARD_BOOT_RECOVERY_EVENT_NAME, handleRecoverySurfaceEvent);
    handleSetupSurfaceEvent = () => {
      // Setup owns its own visible page. Releasing this decorative shell does
      // not start boot timers or acknowledge core/Main/profile readiness.
      revealRoot();
      dismiss('setup_required');
    };
    window.addEventListener(DASHBOARD_SETUP_SURFACE_EVENT_NAME, handleSetupSurfaceEvent);

    const currentSnapshot = getDashboardBootSnapshotFromWindow();
    if (isFailedBootSnapshot(currentSnapshot)) {
      releaseFailedBootSnapshot(currentSnapshot, 'initial_snapshot_failed');
      return;
    }
    prepareRootForPaint(currentSnapshot);
    if (currentSnapshot?.dismissible === true) {
      dismiss(currentSnapshot.degraded === true ? 'degraded' : 'ready');
      // An already-ready snapshot may still be waiting for the first intro.
      // Keep the hard release timer armed until dismissal actually begins.
      if (dismissed) return;
    }

    const scheduleHardTimeout = () => {
      if (hardTimeoutId) {
        window.clearTimeout(hardTimeoutId);
        hardTimeoutId = 0;
      }
      hardTimeoutId = window.setTimeout(() => {
        hardTimeoutId = 0;
        startDashboardImport();
        const latestSnapshot = getDashboardBootSnapshotFromWindow();
        if (latestSnapshot?.dismissible === true && (presentationComplete || latestSnapshot.degraded === true)) {
          emitZenTrace('boot_shell:hard_timeout_dismissible_snapshot', {
            status: latestSnapshot.status,
            phase: latestSnapshot.phase,
            degraded: latestSnapshot.degraded === true,
            visibleForMs: Math.max(0, Math.round(nowMs() - shellMountedAt)),
          });
          dismiss(latestSnapshot.degraded === true ? 'degraded' : 'ready');
          return;
        }
        if (isFailedBootSnapshot(latestSnapshot)) {
          releaseFailedBootSnapshot(latestSnapshot, 'hard_timeout_failed_snapshot');
          return;
        }
        const forcedReleaseMetadata = buildHardTimeoutForcedReleaseMetadata(latestSnapshot);
        void reportHardTimeoutForcedRelease(forcedReleaseMetadata)
          .finally(() => {
            emitZenTrace('boot_shell:hard_timeout_fail_open', forcedReleaseMetadata);
            dismiss('hard_timeout');
          });
      }, BOOT_SHELL_HARD_TIMEOUT_MS);
    };

    scheduleHardTimeout();
  } catch (error) {
    cancelInitialPaintSchedule?.();
    rootEl.style.visibility = rootInitialVisibility;
    rootEl.style.pointerEvents = rootInitialPointerEvents;
    if (!rootInitiallyInert) rootEl.removeAttribute('inert');
    if (handleBootSnapshotEvent) {
      window.removeEventListener(DASHBOARD_BOOT_EVENT_NAME, handleBootSnapshotEvent);
    }
    if (handleRecoverySurfaceEvent) {
      window.removeEventListener(DASHBOARD_BOOT_RECOVERY_EVENT_NAME, handleRecoverySurfaceEvent);
    }
    if (handleSetupSurfaceEvent) {
      window.removeEventListener(DASHBOARD_SETUP_SURFACE_EVENT_NAME, handleSetupSurfaceEvent);
    }
    if (hardTimeoutId) {
      window.clearTimeout(hardTimeoutId);
      hardTimeoutId = 0;
    }
    const mountedShell = document.getElementById(BOOT_SHELL_ID);
    if (mountedShell && mountedShell.parentNode) {
      try {
        if (typeof mountedShell.__entropyBootShellDispose === 'function') {
          mountedShell.__entropyBootShellDispose();
        }
      } catch (_) {
        // dispose failure must not block shell removal while recovering the page
      }
      mountedShell.parentNode.removeChild(mountedShell);
    }
    throw failBootShell('BOOT_SHELL_STARTUP_FAILED', { shellId: BOOT_SHELL_ID }, error);
  }
}

if (document.readyState === 'loading') {
  window.addEventListener('DOMContentLoaded', startBootShell, { once: true });
} else {
  startBootShell();
}
