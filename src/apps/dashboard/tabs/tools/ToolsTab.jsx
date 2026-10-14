import React, { useEffect, useLayoutEffect } from 'react';
import { ensureDashboardTabEntryTrace, recordDashboardTabEntryStage } from '@dashboard-tab-entry-telemetry';
import { useAppTranslation } from '@/ui-kit/hooks/useAppTranslation.js';
import {
  DashboardTabErrorSurface,
  DashboardTabLoadingSurface,
  DashboardTabRetryAction,
} from '@/apps/dashboard/loading/DashboardTabStateSurfaces.jsx';
import { useDashboardTabReadiness } from '@/apps/dashboard/loading/useDashboardTabReadiness.js';
import { useThemeId } from '@/apps/dashboard/stores/index.js';
import { withDynamicImportRecovery } from '@/platform/extension/dynamicImportRecovery.js';
import DashboardActionAsyncBoundary from '@/apps/dashboard/loading/DashboardActionAsyncBoundary.jsx';
import SettingsCommandFeedbackBridge from '@/apps/dashboard/components/SettingsCommandFeedbackBridge.jsx';
import { GuidanceSupport } from '@/apps/dashboard/guidance/DashboardGuidanceProvider.jsx';
import { SETTINGS_COMMAND_CHANNELS } from '@/apps/dashboard/stores/settingsCommandBus.js';

import ArtifactGallery from './components/ArtifactGallery.jsx';
import SelectedArtifactControllerBoundary from './components/SelectedArtifactControllerBoundary.jsx';
import {
  useToolsArtifactGalleryModel,
  useToolsTabController,
} from './useToolsTabController.js';
import {
  isToolsSelectedArtifactControllerReady,
  preloadToolsSelectedArtifactController,
  retryToolsSelectedArtifactController,
} from './selectedArtifactControllerResource.js';
import {
  DASHBOARD_TAB_ASYNC_BOUNDARY_IDS,
  isDashboardTabAsyncBoundaryAllowed,
} from '../loadingPolicy.js';

const STORAGE_SUPPORT_ASYNC_BOUNDARY_ID = DASHBOARD_TAB_ASYNC_BOUNDARY_IDS.TOOLS_STORAGE_SUPPORT;
const TOOLS_SETTINGS_FEEDBACK_CHANNELS = Object.freeze([SETTINGS_COMMAND_CHANNELS.PROTOCOL]);
if (!isDashboardTabAsyncBoundaryAllowed('tools', STORAGE_SUPPORT_ASYNC_BOUNDARY_ID)) {
  throw new Error(`DASHBOARD_TAB_ASYNC_BOUNDARY_UNDECLARED:tools:${STORAGE_SUPPORT_ASYNC_BOUNDARY_ID}`);
}

const loadStorageSupportWorkspace = withDynamicImportRecovery(
  () => import('./components/StorageSupportWorkspace.jsx'),
  { boundaryId: 'dashboard-tools-storage-support' },
);

function StorageSupportLoadingSurface({ label }) {
  return (
    <section
      role="status"
      aria-label={label}
      className="shrink-0 rounded-[10px] border border-border/35 bg-surface px-6 py-5 text-xs font-semibold text-on-surface-muted"
    >
      <div className="h-3 w-32 animate-pulse rounded-full bg-border/45" />
    </section>
  );
}

function ToolsArtifactWorkspace({
  controller,
  isPresented,
  isRuntimeActive,
  selectedArtifactController,
  tab,
  tTools,
}) {
  const {
    artifacts,
    canSelectArtifactByIndex,
    selectedArtifactIndex,
    selectArtifactByIndex,
    isPreparingInitialArtifact,
  } = useToolsArtifactGalleryModel(controller, selectedArtifactController);
  const {
    artifactDisclosureSnapshot,
    artifactGalleryDisclosureSnapshot,
    artifactDisclosureSnapshotError,
    refreshArtifactDisclosureSnapshot,
    isStorageSupportVisible,
    setIsStorageSupportVisible,
  } = controller;

  const hasSelectedWorkspace = Boolean(selectedArtifactController?.artifact);
  const hasEmptyWorkspace = Boolean(artifactDisclosureSnapshot) && controller.navigationItems.length === 0;
  useLayoutEffect(() => {
    if (!isRuntimeActive || (!hasSelectedWorkspace && !hasEmptyWorkspace)) return;
    recordDashboardTabEntryStage('tools', 'workspace:ready', {
      artifactId: controller.selectedArtifactId, empty: hasEmptyWorkspace,
    });
    if (hasEmptyWorkspace) {
      ensureDashboardTabEntryTrace({ tabId: 'tools', themeId: controller.artifactPresentation.themeId, source: 'render' });
      recordDashboardTabEntryStage('tools', 'presentation:ready', { empty: true });
    }
  }, [isRuntimeActive, hasSelectedWorkspace, hasEmptyWorkspace, controller.selectedArtifactId, controller.artifactPresentation.themeId]);

  if (isPreparingInitialArtifact) {
    return <DashboardTabLoadingSurface tabId={tab.id} label={tab.title} testId="tools-initial-artifact-loading" />;
  }

  return (
    <section
      id={tab.id}
      className={`${isPresented ? 'flex' : 'hidden'} relative h-full min-h-0 w-full flex-col gap-4 overflow-hidden font-mono`}
    >
      <SettingsCommandFeedbackBridge channels={TOOLS_SETTINGS_FEEDBACK_CHANNELS} />
      <GuidanceSupport />
      {artifactDisclosureSnapshotError && artifactDisclosureSnapshot ? (
        <div
          role="alert"
          className="flex shrink-0 flex-wrap items-center gap-2 px-4 py-2 text-xs text-warning"
        >
          <span className="min-w-0 break-words">
            {tTools('artifact_altar.disclosure_refresh_failed', {
              message: artifactDisclosureSnapshotError.message,
            })}
          </span>
          <button
            type="button"
            className="shrink-0 font-bold underline underline-offset-2"
            onClick={() => {
              void refreshArtifactDisclosureSnapshot().catch(() => undefined);
            }}
          >
            {tTools('artifact_altar.navigation.retry')}
          </button>
        </div>
      ) : null}
      {isStorageSupportVisible ? (
        <DashboardActionAsyncBoundary
          boundaryId={STORAGE_SUPPORT_ASYNC_BOUNDARY_ID}
          loadAction={loadStorageSupportWorkspace}
          loadingFallback={<StorageSupportLoadingSurface label={tTools('support.title')} />}
          renderError={(error, { retry }) => (
            <section
              role="alert"
              className="shrink-0 rounded-[10px] border border-danger/30 bg-surface px-6 py-5 text-sm font-semibold text-danger"
            >
              <p>{tTools('support.status.snapshot_failed', { error: error?.message || String(error) })}</p>
              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  type="button"
                  className="rounded-[8px] border border-danger/30 px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.12em]"
                  onClick={retry}
                >
                  {tTools('artifact_altar.navigation.retry')}
                </button>
                <button
                  type="button"
                  className="rounded-[8px] border border-danger/30 px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.12em]"
                  onClick={() => setIsStorageSupportVisible(false)}
                >
                  {tTools('support.hide')}
                </button>
              </div>
            </section>
          )}
          renderAction={(LazyStorageSupportWorkspace) => (
            <LazyStorageSupportWorkspace
              isActive={isRuntimeActive}
              onClose={() => setIsStorageSupportVisible(false)}
            />
          )}
        />
      ) : null}

      <div className="relative min-h-0 w-full flex-1 overflow-hidden">
        <ArtifactGallery
          items={artifacts}
          artifactDisclosureSnapshot={artifactGalleryDisclosureSnapshot}
          selectedArtifactIndex={selectedArtifactIndex}
          onSelectArtifactIndex={selectArtifactByIndex}
          canSelectArtifactIndex={canSelectArtifactByIndex}
          isArtifactControllerReady={isToolsSelectedArtifactControllerReady}
          preloadArtifactController={preloadToolsSelectedArtifactController}
          retryArtifactController={retryToolsSelectedArtifactController}
          className="h-full"
          isEnabled={isRuntimeActive}
        />
      </div>
    </section>
  );
}

function ToolsTabReadyContent({ isPresented, isRuntimeActive, tab, tTools, params }) {
  const controller = useToolsTabController(isRuntimeActive);
  const {
    artifactDisclosureSnapshot,
    artifactDisclosureSnapshotError,
    artifactDisclosureSnapshotLoading,
    refreshArtifactDisclosureSnapshot,
    selectedArtifactId,
  } = controller;
  useEffect(() => {
    const requestedFamily = params?.artifactId;
    if (isRuntimeActive && typeof requestedFamily === 'string'
      && controller.navigationItems.some((item) => item.artifactId === requestedFamily)) {
      controller.setActiveArtifactId(requestedFamily);
    }
  }, [isRuntimeActive, params, controller.navigationItems, controller.setActiveArtifactId]);

  useEffect(() => {
    if (!isRuntimeActive || !artifactDisclosureSnapshotError || artifactDisclosureSnapshot) return undefined;
    let current = true;
    // Close after the parent root-readiness effect has registered this entry.
    queueMicrotask(() => {
      if (current) recordDashboardTabEntryStage('tools', 'readiness:error', {
        surfaceId: 'tools-disclosure', message: artifactDisclosureSnapshotError.message,
      });
    });
    return () => { current = false; };
  }, [isRuntimeActive, artifactDisclosureSnapshot, artifactDisclosureSnapshotError]);

  if (isRuntimeActive && artifactDisclosureSnapshotError && !artifactDisclosureSnapshot) {
    return (
      <DashboardTabErrorSurface
        tabId={tab?.id || 'tools'}
        title={tab.title}
        detail={artifactDisclosureSnapshotError.message}
        testId="tools-disclosure-error"
        actions={(
          <button
            type="button"
            className="rounded-[8px] border border-amber-700/30 px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.12em]"
            onClick={() => {
              void refreshArtifactDisclosureSnapshot().catch(() => undefined);
            }}
          >
            {tTools('artifact_altar.navigation.retry')}
          </button>
        )}
      />
    );
  }

  return (
    <SelectedArtifactControllerBoundary
      artifactId={selectedArtifactId}
      isActive={isRuntimeActive}
      presentation={controller.artifactPresentation}
    >
      {(selectedArtifactController) => (
        <ToolsArtifactWorkspace
          controller={controller}
          isPresented={isPresented}
          isRuntimeActive={isRuntimeActive}
          selectedArtifactController={selectedArtifactController}
          tab={tab}
          tTools={tTools}
        />
      )}
    </SelectedArtifactControllerBoundary>
  );
}

export default function ToolsTab({
  tab,
  isActive,
  isPresented = isActive,
  isRuntimeActive = isActive,
  params = null,
}) {
  const { t: tTools } = useAppTranslation('tools');
  void [
    tTools('tools.support_mode'),
    tTools('tools.open_sites'),
    tTools('tools.open_settings'),
  ];
  const themeId = useThemeId();
  const readiness = useDashboardTabReadiness({
    tabId: 'tools',
    themeId,
    isActive: isRuntimeActive,
    waitForPresentation: true,
  });

  if (readiness.phase === 'loading') {
    return (
      <DashboardTabLoadingSurface
        tabId={tab?.id || 'tools'}
        label={tab.title}
        testId="tools-tab-loading"
      />
    );
  }

  if (readiness.phase === 'error') {
    return (
      <DashboardTabErrorSurface
        tabId={tab?.id || 'tools'}
        title={tab.title}
        detail={readiness.error?.message}
        testId="tools-tab-error"
        actions={readiness.retry ? (
          <DashboardTabRetryAction
            label={tTools('artifact_altar.navigation.retry')}
            onRetry={readiness.retry}
          />
        ) : null}
      />
    );
  }

  return (
      <ToolsTabReadyContent
        isPresented={isPresented}
        isRuntimeActive={isRuntimeActive}
        tab={tab}
        tTools={tTools}
        params={params}
      />
  );
}
