import '../../platform/chrome/dev/reactRefreshPreamble.js';
import { emitZenTrace } from '@zen-trace';
import {
  createDashboardEntryStageTraceEvent,
} from './bootstrap/dashboardEntryStageTraceContract.js';
import {
  releaseDashboardThemeBootRuntimeHandoff,
  startDashboardThemeBootRuntimeHandoff,
} from './bootstrap/dashboardThemeBootRuntimeHandoff.js';

const nowMs = () => (
  typeof performance !== 'undefined' && typeof performance.now === 'function'
    ? performance.now()
    : Date.now()
);

let dashboardRuntimeStartPromise = null;

function loadDashboardStage(stageId, loader) {
  const startedAt = nowMs();
  emitZenTrace(createDashboardEntryStageTraceEvent(stageId, 'start'), { stageId });
  return loader().then((module) => {
    emitZenTrace(createDashboardEntryStageTraceEvent(stageId, 'ready'), {
      stageId,
      durationMs: Number(Math.max(0, nowMs() - startedAt).toFixed(2)),
    });
    return module;
  }).catch((error) => {
    emitZenTrace(createDashboardEntryStageTraceEvent(stageId, 'failed'), {
      stageId,
      durationMs: Number(Math.max(0, nowMs() - startedAt).toFixed(2)),
      error,
    });
    throw error;
  });
}

emitZenTrace('dashboard_entry:module_loaded');

export function startDashboardRuntime() {
  if (dashboardRuntimeStartPromise) return dashboardRuntimeStartPromise;
  emitZenTrace('dashboard_entry:runtime_start');
  const reactHostPromise = loadDashboardStage(
    'react_host',
    () => import('./dashboardReactHost.jsx'),
  );
  const i18nPromise = loadDashboardStage(
    'i18n',
    () => import('../../i18n/dashboardConfig.js'),
  );
  const documentThemePromise = loadDashboardStage('document_theme', () => (
    import('./bootstrap/dashboardDocumentThemeInitialization.js')
  ));
  const appPromise = loadDashboardStage('app', () => import('./App.jsx'));

  const themeBootRuntimePromise = documentThemePromise.then((documentTheme) => {
    const bootThemeId = documentTheme.initializeDashboardDocumentTheme();
    emitZenTrace('dashboard_entry:theme_initialized', { bootThemeId });
    return startDashboardThemeBootRuntimeHandoff({
      bootThemeId,
      loadRuntime: () => loadDashboardStage('theme_boot_runtime', () => (
        import('../../themes/core/runtime/dashboardBootRuntime.js')
      )),
    })
      .then((preparedRuntime) => {
        emitZenTrace('dashboard_entry:theme_boot_runtime_ready', {
          bootThemeId,
          status: preparedRuntime.status,
          reservationId: preparedRuntime.reservationId,
          reservationState: preparedRuntime.reservationState,
        });
        return preparedRuntime;
      });
  });
  // Observe every started stage immediately, including when the document-theme
  // stage fails before its siblings settle.
  dashboardRuntimeStartPromise = Promise.all([
    reactHostPromise,
    i18nPromise,
    appPromise,
    themeBootRuntimePromise,
  ]).then(([
    reactHost,
    _i18n,
    appModule,
  ]) => {
    reactHost.renderDashboardApp(appModule.default);
    emitZenTrace('dashboard_entry:react_render_requested');
  }).catch((error) => {
    // The handoff owner retains the cleanup promise. Expose the entry failure
    // immediately while any already-started reservation finishes and releases.
    void releaseDashboardThemeBootRuntimeHandoff(
      'dashboard_runtime_initialization_failed',
    ).catch((releaseError) => {
      emitZenTrace('dashboard_entry:theme_boot_runtime_release_failed', {
        releaseError,
      });
      console.error('Dashboard theme boot runtime release failed.', releaseError);
    });
    emitZenTrace('dashboard_entry:runtime_failed', { error });
    console.error('Dashboard runtime initialization failed.', error);
    throw error;
  });
  return dashboardRuntimeStartPromise;
}
