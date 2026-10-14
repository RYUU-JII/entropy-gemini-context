import React, { useCallback, useLayoutEffect, useMemo, useRef } from 'react';

import { useAppTranslation } from '@/ui-kit/hooks/useAppTranslation.js';
import { THEME_IDS } from '@/themes/core/ids.js';
import {
  DashboardTabErrorSurface,
  DashboardTabLoadingSurface,
  DashboardTabRetryAction,
} from '@/apps/dashboard/loading/DashboardTabStateSurfaces.jsx';
import { useDashboardTabReadiness } from '@/apps/dashboard/loading/useDashboardTabReadiness.js';
import { useProtectionRuntimeSubscription } from '@/apps/dashboard/hooks/useProtectionRuntimeSubscription.js';
import { useRuntimeParkedStoreSlice } from '@/apps/dashboard/hooks/useRuntimeParkedStoreSlice.js';
import { useStatusController } from '@/apps/dashboard/hooks/useStatusController.js';
import { useProtocolStore, useThemeId } from '@/apps/dashboard/stores/index.js';

import HomeScanWorkspace from './home/HomeScanWorkspace.jsx';
import { resolveGardenSurfaceActivity } from '@/apps/dashboard/workspaces/garden/gardenSurfaceActivity.js';
import { useGardenModeTransition } from '@/apps/dashboard/workspaces/garden/useGardenModeTransition.js';
import { useDashboardBackHandler } from '@/apps/dashboard/hooks/useDashboardNavigationButtonLock.js';
import { ZenGardenModeControl } from '@/themes/plugins/zen/api/gardenWorkspace.js';
import JourneyProgress from '@/apps/dashboard/guidance/JourneyProgress.jsx';
import { recordSiteRegistrationInvitationsAdmitted } from '@/apps/dashboard/progression/siteRegistrationJourneyClient.js';
import { buildHomeScanSnapshot } from './home/buildHomeScanSnapshot.js';
import { resolveMainWidgetThemeId } from './themeRegistry.js';
import {
  createZenMainBootTraceContext,
} from '@/themes/plugins/zen/runtime/zenMainBootReadinessTrace.js';
import {
  useZenHomeFirstVisualCoordinator,
} from './firstVisual/useZenHomeFirstVisualCoordinator.js';
import {
  applyZenMainCaptureScanSnapshot,
  resolveZenMainCaptureProfile,
} from '@zen-main-capture-profile';

export {
  ZEN_MAIN_FIRST_FRAME_PROGRESS_WATCHDOG_MS,
  ZEN_MAIN_FIRST_FRAME_SOFT_BUDGET_MS,
} from './firstVisual/useZenHomeFirstVisualCoordinator.js';

const selectMainRuntimeProtocolSlice = (state) => ({
  siteGoals: state.siteGoals,
  coolingCurve: state.coolingCurve,
  rulesMode: state.rulesMode,
  solarLocationProfile: state.solarLocationProfile,
});

function useRetainedRuntimeValue(value, isRuntimeActive) {
  const retainedValueRef = useRef(value);
  useLayoutEffect(() => {
    if (isRuntimeActive) {
      retainedValueRef.current = value;
    }
  }, [isRuntimeActive, value]);
  return isRuntimeActive ? value : retainedValueRef.current;
}

export default function MainTab({
  tab,
  params = null,
  isActive = true,
  isPresented = isActive,
  isRuntimeActive = isActive,
  onTabChange,
  bootShellDismissed = true,
  bootShellRevealStarted = false,
  onMainTabFirstFrameReady = null,
  onMainTabFirstFrameFailed = null,
  onMainPresentationSceneCommitted = null,
  mainPresentationProjection = null,
  progressionUnlockDisclosure = null,
  firstVisitSupportSlot = null,
  gardenMode = 'pond',
  pathwaysSlot = null,
  pathwaysAvailable = false,
}) {
  const runtimeActive = isRuntimeActive === true;
  const handleRegistrationIntentHandled = useCallback(() => {
    if (typeof onTabChange !== 'function') throw new Error('MAIN_REGISTRATION_INTENT_NAVIGATION_REQUIRED');
    onTabChange('main', null);
  }, [onTabChange]);
  const presented = isPresented === true;
  const { t: tTabs } = useAppTranslation('main');
  const { t: tDashboard } = useAppTranslation('dashboard');
  const themeId = useThemeId();
  const mainWidgetThemeId = useMemo(() => resolveMainWidgetThemeId(themeId), [themeId]);
  const zenMainCaptureProfile = useMemo(
    () => resolveZenMainCaptureProfile(),
    [],
  );
  const requiresCompositeFirstFrameReady = mainWidgetThemeId === THEME_IDS.ZEN;
  const mainBootTraceContext = useMemo(() => (
    createZenMainBootTraceContext('zen_main_first_frame')
  ), [mainWidgetThemeId, requiresCompositeFirstFrameReady]);
  const protocolState = useRuntimeParkedStoreSlice(
    useProtocolStore,
    selectMainRuntimeProtocolSlice,
    runtimeActive,
  );
  const ctrl = useStatusController(onTabChange, { isRuntimeActive: runtimeActive });
  const { snapshot: protectionRuntimeSnapshot } = useProtectionRuntimeSubscription({
    enabled: runtimeActive,
  });
  const readiness = useDashboardTabReadiness({
    tabId: 'main',
    themeId: mainWidgetThemeId,
    isActive: runtimeActive,
  });
  const firstVisualCoordinator = useZenHomeFirstVisualCoordinator({
    isActive: runtimeActive,
    mainWidgetThemeId,
    requiresCompositeFirstFrameReady,
    readiness,
    traceContext: mainBootTraceContext,
    onMainTabFirstFrameReady,
    onMainTabFirstFrameFailed,
  });
  const gardenTransition = useGardenModeTransition({
    mode: gardenMode,
    enabled: mainWidgetThemeId === THEME_IDS.ZEN && runtimeActive && bootShellDismissed,
    pathwaysAvailable,
    locked: mainPresentationProjection?.interaction?.locked === true,
    sceneCommitKey: mainPresentationProjection?.sceneCommitKey,
    onTabChange,
  });
  const surfaceActivity = useMemo(() => resolveGardenSurfaceActivity({
    workspaceActive: runtimeActive,
    pondPresented: mainWidgetThemeId !== THEME_IDS.ZEN || gardenMode === 'pond'
      || gardenTransition.pendingMode === 'pond',
    bonsaiPresented: true,
  }), [gardenMode, gardenTransition.pendingMode, mainWidgetThemeId, runtimeActive]);
  useDashboardBackHandler({
    enabled: mainWidgetThemeId === THEME_IDS.ZEN && runtimeActive && bootShellDismissed
      && gardenMode === 'pathways' && mainPresentationProjection?.interaction?.locked !== true,
    priority: 10,
    onBack: () => { void gardenTransition.requestMode('pond'); return true; },
  });
  const previousGardenModeRef = useRef(gardenMode);
  const gardenHasTransitionedRef = useRef(false);
  if (previousGardenModeRef.current !== gardenMode) gardenHasTransitionedRef.current = true;
  previousGardenModeRef.current = gardenMode;

  const activeScanSnapshot = useMemo(() => {
    if (!runtimeActive) return null;
    const snapshot = buildHomeScanSnapshot({
      ctrl,
      protocolState,
      protectionRuntimeSnapshot,
      tTabs,
    });
    return applyZenMainCaptureScanSnapshot(snapshot, zenMainCaptureProfile);
  }, [
    ctrl,
    protectionRuntimeSnapshot,
    protocolState,
    runtimeActive,
    tTabs,
    zenMainCaptureProfile,
  ]);
  const scanSnapshot = useRetainedRuntimeValue(activeScanSnapshot, runtimeActive);
  const presentedReadiness = useRetainedRuntimeValue(readiness, runtimeActive);
  const presentedMainProjection = useRetainedRuntimeValue(
    mainPresentationProjection,
    runtimeActive,
  );
  const presentedProgressionDisclosure = useRetainedRuntimeValue(
    progressionUnlockDisclosure,
    runtimeActive,
  );
  const presentedBootShellDismissed = useRetainedRuntimeValue(
    bootShellDismissed,
    runtimeActive,
  );
  const presentedBootShellRevealStarted = useRetainedRuntimeValue(
    bootShellRevealStarted,
    runtimeActive,
  );
  const showFirstVisitSupport = presented && gardenMode === 'pond' && firstVisitSupportSlot
    && presentedMainProjection?.interaction?.locked !== true;
  if (!tab) return null;
  if (presentedReadiness.phase === 'loading') {
    return (
      <DashboardTabLoadingSurface
        tabId={tab.id || 'main'}
        label={tDashboard('main.title')}
        testId="main-tab-loading"
      />
    );
  }
  if (
    requiresCompositeFirstFrameReady
    && presentedProgressionDisclosure?.loading
    && !presentedProgressionDisclosure?.snapshot
  ) {
    return (
      <DashboardTabLoadingSurface
        tabId={tab.id || 'main'}
        label={tDashboard('main.title')}
        testId="main-tab-progression-loading"
      />
    );
  }
  if (
    requiresCompositeFirstFrameReady
    && presentedProgressionDisclosure?.error
    && !presentedProgressionDisclosure?.snapshot
  ) {
    return (
      <DashboardTabErrorSurface
        tabId={tab.id || 'main'}
        title={tDashboard('main.title')}
        detail={presentedProgressionDisclosure.error.message}
        testId="main-tab-progression-error"
      />
    );
  }
  if (presentedReadiness.phase === 'error') {
    return (
      <DashboardTabErrorSurface
        tabId={tab.id || 'main'}
        title={tDashboard('main.title')}
        detail={presentedReadiness.error?.message}
        testId="main-tab-error"
        actions={presentedReadiness.retry ? (
          <DashboardTabRetryAction
            label={tTabs('common:dashboard.main_panel.retry')}
            onRetry={presentedReadiness.retry}
          />
        ) : null}
      />
    );
  }

  return (
    <section
      id={tab.id || 'main'}
      aria-label={tDashboard('main.title')}
      className={`${presented ? 'grid' : 'hidden'} ${showFirstVisitSupport ? 'grid-rows-[auto_minmax(0,1fr)]' : ''} relative h-full w-full min-h-0`}
    >
      {showFirstVisitSupport ? <div>{firstVisitSupportSlot}</div> : null}
      <HomeScanWorkspace
        gardenMode={gardenMode}
        pathwaysSlot={pathwaysSlot}
        animateWorkArea={gardenHasTransitionedRef.current}
        onPondPresentationReady={gardenTransition.acceptPondPresentation}
        gardenTransitionError={gardenTransition.error}
        pondPresentationReady={gardenTransition.pondPresentationReady}
        gardenControlSlot={mainWidgetThemeId === THEME_IDS.ZEN ? ({ travelPx, onProgress, readGestureProgress }) => (
          <ZenGardenModeControl
            mode={gardenMode}
            pendingMode={gardenTransition.pendingMode}
            pathwaysAvailable={pathwaysAvailable}
            disabled={!runtimeActive || !bootShellDismissed || presentedMainProjection?.interaction?.locked === true}
            pondLabel={tDashboard('garden.pond')}
            pathwaysLabel={tDashboard('sites.nav_zen')}
            groupLabel={tDashboard('garden.modes')}
            retryLabel={tTabs('common:dashboard.main_panel.retry')}
            errorLabel={tDashboard('garden.switch_failed')}
            error={gardenTransition.error}
            onRequest={gardenTransition.requestMode}
            onRetry={gardenTransition.retry}
            travelPx={travelPx}
            onProgress={onProgress}
            readGestureProgress={readGestureProgress}
            onPreparePond={gardenTransition.preparePondReturn}
            onCancelPond={gardenTransition.cancelPondPreparation}
          />
        ) : null}
        journeyProgressSlot={presented && mainWidgetThemeId !== THEME_IDS.ZEN ? <JourneyProgress /> : null}
        registrationIntent={params?.registrationIntent ?? null}
        onRegistrationIntentHandled={handleRegistrationIntentHandled}
        onInvitationCapacityAdmitted={recordSiteRegistrationInvitationsAdmitted}
        surfaceActivity={surfaceActivity}
        themeId={themeId}
        solarLocationProfile={protocolState.solarLocationProfile}
        ctrl={ctrl}
        scanSnapshot={scanSnapshot}
        mainPresentationProjection={presentedMainProjection}
        zenMainCaptureProfile={zenMainCaptureProfile}
        progressionUnlockSnapshot={presentedProgressionDisclosure?.snapshot?.unlockProgress || null}
        bootShellDismissed={presentedBootShellDismissed}
        bootShellRevealStarted={presentedBootShellRevealStarted}
        bootTraceContext={mainBootTraceContext}
        onFirstVisualMilestone={firstVisualCoordinator.onFirstVisualMilestone}
        onRuntimeFirstFrameReady={firstVisualCoordinator.shouldAcceptPondFirstFrame
          ? firstVisualCoordinator.onPondFirstFrameReady
          : null}
        onBonsaiFirstFrameReady={firstVisualCoordinator.shouldAcceptBonsaiFirstFrame
          ? firstVisualCoordinator.onBonsaiFirstFrameReady
          : null}
        onFirstViewportReady={firstVisualCoordinator.shouldAcceptFirstViewportReady
          ? firstVisualCoordinator.onFirstViewportReady
          : null}
        onMainPresentationSceneCommitted={onMainPresentationSceneCommitted}
      />
      {presented && mainWidgetThemeId === THEME_IDS.ZEN && (
        <div className="absolute right-4 top-3 z-[28] max-w-sm"><JourneyProgress /></div>
      )}
    </section>
  );
}
