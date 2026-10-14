import React, { useMemo } from 'react';
import { getThemeWidget } from '@/themes/core/registry/index.js';
import { useDashboardTabReadiness } from '@/apps/dashboard/loading/useDashboardTabReadiness.js';
import { DashboardTabRetryAction } from '@/apps/dashboard/loading/DashboardTabStateSurfaces.jsx';
import { DASHBOARD_TAB_ASYNC_BOUNDARY_IDS } from '../../loadingPolicy.js';

// The selected reading owns its code admission. A retained ledger selection
// does not preload this widget or replace the surrounding workspace on failure.
export default function SitesNotebookTarget({ themeId, isRuntimeActive, t, ...props }) {
  const readiness = useDashboardTabReadiness({
    tabId: 'sites',
    themeId,
    surfaceId: DASHBOARD_TAB_ASYNC_BOUNDARY_IDS.SITES_NOTEBOOK_TARGET,
    isActive: isRuntimeActive,
  });
  const TargetPanel = useMemo(() => (
    readiness.ready ? getThemeWidget(themeId, 'SitesTargetPanel') : null
  ), [readiness.ready, readiness.readyKey, themeId]);
  const missingWidgetError = readiness.ready && !TargetPanel
    ? new Error(`SITES_THEME_WIDGET_REQUIRED:${themeId}:SitesTargetPanel`)
    : null;
  const error = readiness.error || missingWidgetError;

  return (
    <div className="sites-notebook-target" data-dashboard-async-boundary={DASHBOARD_TAB_ASYNC_BOUNDARY_IDS.SITES_NOTEBOOK_TARGET}>
      {error ? (
        <div className="sites-inline-feedback" role="alert">
          <p>{error.message}</p>
          {readiness.retry && <DashboardTabRetryAction label={t('common:dashboard.main_panel.retry')} onRetry={readiness.retry} />}
        </div>
      ) : TargetPanel ? <TargetPanel {...props} /> : (
        <div className="sites-inline-feedback" role="status" aria-busy="true">{t('common:status.loading')}</div>
      )}
    </div>
  );
}
