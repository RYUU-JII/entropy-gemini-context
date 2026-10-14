import React from 'react';

import DashboardPage from './DashboardPage.jsx';
import { ErrorBoundaryCore } from '../../ui-kit/ErrorBoundaryCore.jsx';
import { tDashboardRuntime } from '../../domains/settings/i18n/dashboardRuntime.js';
import { ConfirmDialogProvider } from '../../ui-kit/ConfirmDialogProvider.jsx';
import { AppFeedbackProvider } from '../../ui-kit/ToastProvider.jsx';
import DashboardBootRecoverySurface from './bootstrap/DashboardBootRecoverySurface.jsx';
import {
  releaseDashboardThemeBootRuntimeHandoff,
} from './bootstrap/dashboardThemeBootRuntimeHandoff.js';

const releaseThemeBootRuntimeAfterDashboardError = () => {
  void releaseDashboardThemeBootRuntimeHandoff(
    'dashboard_react_runtime_failed',
  ).catch((releaseError) => {
    console.error('Dashboard theme boot runtime error cleanup failed.', releaseError);
  });
};

export default function App() {
  return (
    <ErrorBoundaryCore
      translate={tDashboardRuntime}
      onError={releaseThemeBootRuntimeAfterDashboardError}
      renderError={({ error }) => <DashboardBootRecoverySurface error={error} />}
    >
      <ConfirmDialogProvider>
        <AppFeedbackProvider>
          <DashboardPage />
        </AppFeedbackProvider>
      </ConfirmDialogProvider>
    </ErrorBoundaryCore>
  );
}
