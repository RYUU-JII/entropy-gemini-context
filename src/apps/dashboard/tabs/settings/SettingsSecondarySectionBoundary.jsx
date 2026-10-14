import React, { useState } from 'react';

import DashboardActionAsyncBoundary from '../../loading/DashboardActionAsyncBoundary.jsx';
import {
  DASHBOARD_TAB_ASYNC_BOUNDARY_IDS,
  isDashboardTabAsyncBoundaryAllowed,
} from '../loadingPolicy.js';
import { SETTINGS_SECTION_IDS } from './config/sections.js';
import {
  clearSettingsSecondarySectionModuleRecord,
  getReadySettingsSecondarySectionComponent,
  loadSettingsSecondarySectionModule,
} from './settingsSectionModuleResource.js';

const SAFETY_ASYNC_BOUNDARY_ID = DASHBOARD_TAB_ASYNC_BOUNDARY_IDS.SETTINGS_SAFETY;
const WORKSPACE_ASYNC_BOUNDARY_ID = DASHBOARD_TAB_ASYNC_BOUNDARY_IDS.SETTINGS_WORKSPACE;
const PROTECTION_ASYNC_BOUNDARY_ID = DASHBOARD_TAB_ASYNC_BOUNDARY_IDS.SETTINGS_PROTECTION;

const loadSafetySection = () => loadSettingsSecondarySectionModule(SETTINGS_SECTION_IDS.SAFETY);
const loadWorkspaceSection = () => loadSettingsSecondarySectionModule(SETTINGS_SECTION_IDS.WORKSPACE);
const loadProtectionSection = () => loadSettingsSecondarySectionModule(SETTINGS_SECTION_IDS.PROTECTION);

const SETTINGS_SECTION_BOUNDARIES = Object.freeze({
  [SETTINGS_SECTION_IDS.SAFETY]: Object.freeze({
    boundaryId: SAFETY_ASYNC_BOUNDARY_ID,
    loadAction: loadSafetySection,
  }),
  [SETTINGS_SECTION_IDS.WORKSPACE]: Object.freeze({
    boundaryId: WORKSPACE_ASYNC_BOUNDARY_ID,
    loadAction: loadWorkspaceSection,
  }),
  [SETTINGS_SECTION_IDS.PROTECTION]: Object.freeze({
    boundaryId: PROTECTION_ASYNC_BOUNDARY_ID,
    loadAction: loadProtectionSection,
  }),
});

Object.values(SETTINGS_SECTION_BOUNDARIES).forEach(({ boundaryId }) => {
  if (!isDashboardTabAsyncBoundaryAllowed('settings', boundaryId)) {
    throw new Error(`DASHBOARD_TAB_ASYNC_BOUNDARY_UNDECLARED:settings:${boundaryId}`);
  }
});

function SettingsSectionLoadingSurface({ sectionId, label }) {
  return (
    <div
      role="status"
      aria-label={label}
      className="min-h-40 border-y border-border/30 py-8 text-sm text-on-surface-muted"
      data-settings-section-loading={sectionId}
    >
      {label}
    </div>
  );
}

function SettingsSectionErrorSurface({ error, onRetry, sectionId, t }) {
  return (
    <section
      role="alert"
      className="border-y border-danger/30 py-6 text-sm text-danger"
      data-settings-section-error={sectionId}
    >
      <p className="font-semibold">{t('status.error')}</p>
      <p className="mt-1 break-words text-xs">{error?.message || String(error)}</p>
      {onRetry ? (
        <button
          type="button"
          className="mt-3 rounded border border-danger/30 px-3 py-1.5 text-xs font-semibold"
          onClick={onRetry}
        >
          {t('common:dashboard.main_panel.retry')}
        </button>
      ) : null}
    </section>
  );
}

export default function SettingsSecondarySectionBoundary({
  sectionId,
  sectionProps,
  t,
}) {
  const boundary = SETTINGS_SECTION_BOUNDARIES[sectionId];
  if (!boundary) {
    throw new Error(`SETTINGS_SECONDARY_SECTION_BOUNDARY_UNDECLARED:${String(sectionId)}`);
  }
  const [ReadySettingsSection] = useState(
    () => getReadySettingsSecondarySectionComponent(sectionId),
  );

  if (ReadySettingsSection) {
    return (
      <DashboardActionAsyncBoundary
        boundaryId={boundary.boundaryId}
        loadingFallback={null}
        renderError={(error) => (
          <SettingsSectionErrorSurface
            error={error}
            onRetry={null}
            sectionId={sectionId}
            t={t}
          />
        )}
      >
        <ReadySettingsSection {...sectionProps} />
      </DashboardActionAsyncBoundary>
    );
  }

  return (
    <DashboardActionAsyncBoundary
      boundaryId={boundary.boundaryId}
      loadAction={boundary.loadAction}
      loadingFallback={(
        <SettingsSectionLoadingSurface
          sectionId={sectionId}
          label={t('status.loading')}
        />
      )}
      renderError={(error, { retry }) => (
        <SettingsSectionErrorSurface
          error={error}
          sectionId={sectionId}
          t={t}
          onRetry={() => {
            clearSettingsSecondarySectionModuleRecord(sectionId);
            retry();
          }}
        />
      )}
      renderAction={(LazySettingsSection) => (
        <LazySettingsSection {...sectionProps} />
      )}
    />
  );
}
