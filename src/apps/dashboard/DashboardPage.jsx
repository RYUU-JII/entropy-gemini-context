import React, { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useDashboardFirstVisit } from './progression/useDashboardFirstVisit.js';
import { useSiteRegistrationJourney } from './progression/useSiteRegistrationJourney.js';

import {
  useAnalysisStore,
  useCLSEStore,
  usePreferenceStore,
  useProtocolStore,
  useUIPreferences,
} from './stores/index.js';
import { useAppTranslation } from '../../ui-kit/hooks/useAppTranslation.js';
import { useDocumentVisibility } from '../../ui-kit/hooks/useDocumentVisibility.js';
import {
  buildDashboardTabs,
  getDashboardEnabledTabIds,
  resolveAccessibleTabId,
  resolvePolicyFallbackTabId,
} from './tabs/registry.js';
import {
  normalizeDashboardTabRequest,
  resolveDashboardRegistrationJourneyRoute,
} from './utils/dashboardRouteRequest.js';
import { getThemeComponent } from '../../themes/core/registry/appearance.js';
import { THEME_IDS } from '../../themes/core/ids.js';
import {
  ThemeAmbientPresentationProvider,
} from '../../themes/core/presentation/ThemeAmbientPresentationContext.jsx';
import {
  ThemeTemporalAuthorityProvider,
} from '../../themes/core/presentation/ThemeTemporalAuthorityContext.jsx';
import { useDashboardBoot } from './bootstrap/useDashboardBoot.js';
import DashboardBootRecoverySurface from './bootstrap/DashboardBootRecoverySurface.jsx';
import DashboardAdmissionBoundary from './bootstrap/DashboardAdmissionBoundary.jsx';
import {
  buildDashboardLaunchContext,
  consumeDashboardSiteRegistrationRoute,
  writePersistedDashboardTabHint,
} from './bootstrap/dashboardLaunchContext.js';
import {
  isDashboardUserControlReleased,
} from './bootstrap/bootManager.js';
import {
  reportDashboardMainBootFirstFrameFailed,
  reportDashboardMainBootFirstFrameReady,
} from './bootstrap/dashboardMainBootReadiness.js';
import {
  useMainPresentationScene,
} from './presentation/useMainPresentationScene.js';
import { useDashboardZenAmbientPresentation } from './presentation/useDashboardZenAmbientPresentation.js';
import {
  DashboardPresentationAdmissionProvider,
  resolveDashboardPresentationAdmission,
  useDashboardPresentationForeground,
} from './presentation/DashboardPresentationAdmission.jsx';
import {
  DashboardNavigationProvider,
  useDashboardNavigationButtonLock,
} from './hooks/useDashboardNavigationButtonLock.js';
import {
  MAIN_PRESENTATION_FOCUS_TAB_ID,
  isMainPresentationFocusActive,
} from './presentation/mainPresentationFocus.js';
import {
  resolveZenMainSceneProjection,
} from '../../themes/plugins/zen/presentation/main/zenMainSceneProjection.js';
import {
  PRESENTATION_EVENT_IDS,
} from './ceremony/presentationEventCeremonyPlan.js';
import {
  resolvePresentationEventOverlayRequest,
} from './ceremony/presentationEventOverlayRequest.js';
import { useArtifactDisclosureNavCue } from './artifacts/useArtifactDisclosureNavCue.js';
import { useArtifactDisclosureSnapshot } from './artifacts/useArtifactDisclosureSnapshot.js';
import { flushSettingsCommandBus } from './stores/settingsCommandBus.js';
import { BUILD_INCLUDE_CLSE_LABS } from '../../platform/build/releaseCapabilities.js';
import {
  CEREMONY_REQUEST_EVENT,
  CeremonyOverlay,
  buildCeremonyRequest,
} from '../../platform/ceremony/index.js';
import { emitZenTrace } from '@zen-trace';
import DashboardSetupAdmission from './bootstrap/DashboardSetupAdmission.jsx';
import { useDashboardLaunchIntentHandoff } from './bootstrap/useDashboardLaunchIntentHandoff.js';
import DashboardGuidanceProvider from './guidance/DashboardGuidanceProvider.jsx';
import {
  applyZenMainCaptureProjection,
  resolveZenMainCaptureProfile,
} from '@zen-main-capture-profile';

const DashboardLayout = React.lazy(() => import('./layout/DashboardLayout.jsx'));
const ZenAppPetalHost = React.lazy(() => import('./presentation/ZenAppPetalHost.jsx'));

export default function DashboardPage() {
  return <DashboardAdmissionBoundary>
    <DashboardSetupAdmission><DashboardRuntime /></DashboardSetupAdmission>
  </DashboardAdmissionBoundary>;
}

function DashboardRuntime() {
  const initializePreference = usePreferenceStore((state) => state.initialize);
  const initializeProtocol = useProtocolStore((state) => state.initialize);
  const initializeAnalysis = useAnalysisStore((state) => state.initialize);
  const initializeCLSE = useCLSEStore((state) => state.initialize);
  const boot = useDashboardBoot({
    initializePreference,
    initializeProtocol,
    initializeAnalysis,
    initializeCLSE: BUILD_INCLUDE_CLSE_LABS ? initializeCLSE : null,
  });
  if (boot.status === 'failed') {
    return <DashboardBootRecoverySurface failed />;
  }
  if (!boot.coreReady) {
    return <DashboardBootRecoverySurface timedOut={boot.status === 'timeout'} />;
  }
  return <DashboardContent boot={boot} />;
}

function DashboardContent({ boot }) {
  const dashboardNavigation = useDashboardNavigationButtonLock();

  const zenMainCaptureProfile = useMemo(
    () => resolveZenMainCaptureProfile(),
    [],
  );

  const { themeId, themeObject, themeProfile, sidebarDisplayMode } = useUIPreferences();
  const dashboardDocumentVisible = useDocumentVisibility();
  const foregroundActive = useDashboardPresentationForeground();
  const registrationJourney = useSiteRegistrationJourney({
    enabled: dashboardDocumentVisible,
    revalidateOnEnable: true,
  });
  const progressionUnlockDisclosure = useArtifactDisclosureSnapshot({
    enabled: themeId === THEME_IDS.ZEN && dashboardDocumentVisible,
    revalidateOnEnable: true,
  });
  const solarLocationProfile = useProtocolStore((state) => state.solarLocationProfile);
  const { t } = useAppTranslation('dashboard');
  const bootUserControlReleased = isDashboardUserControlReleased(boot);
  const mainPresentationScene = useMainPresentationScene({
    themeId,
    boot,
    presentationActive: foregroundActive,
  });
  const mainPresentationDecision = mainPresentationScene.decision;
  const mainPresentationProjection = useMemo(() => {
    if (mainPresentationScene.fatalError) return null;
    const projection = resolveZenMainSceneProjection({ mainPresentationDecision });
    return applyZenMainCaptureProjection(projection, zenMainCaptureProfile);
  }, [
    mainPresentationDecision,
    mainPresentationScene.fatalError,
    zenMainCaptureProfile,
  ]);
  const {
    presentation: ambientPresentation,
    temporalAuthority: ambientTemporalAuthority,
    appearanceClock,
  } = useDashboardZenAmbientPresentation({
    active: themeId === THEME_IDS.ZEN,
    solarLocationProfile,
    environmentMode: mainPresentationProjection?.pond?.environmentMode || null,
    initialAppearanceHour: zenMainCaptureProfile?.environmentClock === 'fixed'
      ? zenMainCaptureProfile.appearanceHour
      : null,
    weatherAuthority: mainPresentationProjection?.pond?.weatherAuthority || null,
  });

  if (mainPresentationScene.fatalError) {
    throw mainPresentationScene.fatalError;
  }
  const mainPresentationFocusActive = isMainPresentationFocusActive(mainPresentationDecision);
  const presentationEventOverlayRequest = useMemo(() => (
    resolvePresentationEventOverlayRequest({
      overlayProjection: mainPresentationProjection.overlay,
    })
  ), [mainPresentationProjection.overlay]);
  const handlePresentationEventOverlayComplete = useCallback(({ ceremonyId } = {}) => {
    if (presentationEventOverlayRequest.active !== true) return;
    if (ceremonyId !== presentationEventOverlayRequest.ceremonyId) {
      throw new Error('Presentation event overlay completed with an unexpected ceremony id.');
    }
    if (presentationEventOverlayRequest.eventId === PRESENTATION_EVENT_IDS.FIRST_VISION) {
      mainPresentationScene.handleOverlayComplete();
      return;
    }
    throw new Error(`Unsupported presentation event completion: ${presentationEventOverlayRequest.eventId}.`);
  }, [
    mainPresentationScene,
    presentationEventOverlayRequest,
  ]);

  useEffect(() => {
    emitZenTrace('dashboard_page:boot_state', {
      status: boot.status,
      phase: boot.phase,
      dismissible: boot.dismissible,
      userControlReleased: bootUserControlReleased,
      degraded: boot.degraded,
      themeReady: boot.themeReady,
      themeShellDegraded: boot.themeShellDegraded,
      coreReady: boot.coreReady,
      mainTabFirstFrameReady: boot.mainTabFirstFrameReady,
      mainTabFirstFrameDegraded: boot.mainTabFirstFrameDegraded,
      shellDismissed: boot.shellDismissed,
    });
  }, [
    boot.coreReady,
    boot.degraded,
    boot.dismissible,
    boot.mainTabFirstFrameDegraded,
    boot.mainTabFirstFrameReady,
    boot.phase,
    boot.shellDismissed,
    boot.status,
    boot.themeShellDegraded,
    boot.themeReady,
    bootUserControlReleased,
  ]);

  useEffect(() => {
    emitZenTrace('dashboard_page:main_presentation_decision', {
      sceneId: mainPresentationDecision?.sceneId || null,
      sceneSessionId: mainPresentationDecision?.sceneSessionId || null,
      kind: mainPresentationDecision?.kind || null,
      phase: mainPresentationDecision?.phase || null,
      reason: mainPresentationDecision?.source?.reason || null,
      selectionLocked: mainPresentationDecision?.session?.selectionLocked === true,
      renderKind: mainPresentationDecision?.renderTarget?.kind || null,
      sceneCommitKey: mainPresentationDecision?.renderTarget?.sceneCommitKey || null,
    });
  }, [mainPresentationDecision]);

  useEffect(() => {
    emitZenTrace('dashboard_page:main_presentation_state', {
      phase: mainPresentationScene.state.phase,
      progressionState: mainPresentationScene.state.progressionState,
      resuming: mainPresentationScene.state.resuming,
      visionRevealedAtMs: mainPresentationScene.state.visionRevealedAtMs,
      spentPersisted: mainPresentationScene.state.spentPersisted,
      diagnostic: mainPresentationScene.state.diagnostic,
      resolved: mainPresentationScene.resolved,
    });
  }, [
    mainPresentationScene.resolved,
    mainPresentationScene.state,
  ]);

  const candidateTabIds = useMemo(() => {
    return getDashboardEnabledTabIds({
      themeProfile,
    });
  }, [themeProfile]);

  const dashboardTabs = useMemo(() => {
    const tabs = buildDashboardTabs({
      themeId,
      t,
      tabIds: candidateTabIds,
      context: {
        themeProfile,
      },
    });
    return tabs
      .filter((tab) => tab.id !== 'sites' || registrationJourney.snapshot?.sitesManagementVisible !== false)
      .map((tab) => tab.id === 'sites' ? { ...tab, pending: registrationJourney.loading } : tab);
  }, [candidateTabIds, registrationJourney.loading, registrationJourney.snapshot, themeId, themeProfile, t]);

  const visibleTabIds = useMemo(() => dashboardTabs.map((tab) => tab.id), [dashboardTabs]);
  const fallbackTabId = useMemo(
    () => resolvePolicyFallbackTabId(visibleTabIds),
    [visibleTabIds]
  );
  const initialLaunchContext = useMemo(() => buildDashboardLaunchContext({
    allowedTabIds: candidateTabIds,
    preferredFallbackTabId: fallbackTabId,
  }), [candidateTabIds, fallbackTabId]);

  const [activeTabId, setActiveTabId] = useState(() => (
    initialLaunchContext.targetTabId
  ));
  const [activeTabParams, setActiveTabParams] = useState(() => initialLaunchContext.targetTabParams);
  const [dashboardCeremony, setDashboardCeremony] = useState(null);
  const dashboardCeremonyGenerationRef = useRef(0);
  const presentationAdmission = useMemo(() => resolveDashboardPresentationAdmission({
    foregroundActive,
    bootReleased: bootUserControlReleased && mainPresentationScene.resolved,
    firstVisionActive: mainPresentationFocusActive,
    generalCeremonyRequested: dashboardCeremony !== null,
  }), [bootUserControlReleased, dashboardCeremony, foregroundActive, mainPresentationFocusActive, mainPresentationScene.resolved]);

  useEffect(() => {
    if (
      themeId !== THEME_IDS.ZEN
      || dashboardDocumentVisible !== true
      || activeTabId !== MAIN_PRESENTATION_FOCUS_TAB_ID
    ) {
      return;
    }
    // The shared resource publishes a rejected refresh as its explicit error
    // state, so this effect only needs to avoid an unhandled promise rejection.
    void progressionUnlockDisclosure.refresh().catch(() => undefined);
  }, [
    activeTabId,
    dashboardDocumentVisible,
    progressionUnlockDisclosure.refresh,
    themeId,
  ]);

  useEffect(() => {
    if (!mainPresentationFocusActive) return;
    const retainedParams = activeTabParams?.registrationIntent ? activeTabParams : null;
    if (activeTabId === MAIN_PRESENTATION_FOCUS_TAB_ID && activeTabParams === retainedParams) return;
    emitZenTrace('dashboard_page:presentation_focus_tab_lock', {
      previousActiveTabId: activeTabId,
      nextActiveTabId: MAIN_PRESENTATION_FOCUS_TAB_ID,
      hadParams: activeTabParams !== null,
      sceneId: mainPresentationDecision?.sceneId || null,
      sceneSessionId: mainPresentationDecision?.sceneSessionId || null,
      phase: mainPresentationDecision?.phase || null,
    });
    setActiveTabId(MAIN_PRESENTATION_FOCUS_TAB_ID);
    setActiveTabParams(retainedParams);
  }, [
    activeTabId,
    activeTabParams,
    mainPresentationDecision?.phase,
    mainPresentationDecision?.sceneId,
    mainPresentationDecision?.sceneSessionId,
    mainPresentationFocusActive,
  ]);

  useEffect(() => {
    const currentRequest = { tabId: activeTabId, params: activeTabParams };
    const admittedRequest = registrationJourney.snapshot
      ? resolveDashboardRegistrationJourneyRoute(currentRequest, registrationJourney.snapshot)
      : currentRequest;
    const nextActiveTabId = resolveAccessibleTabId(admittedRequest.tabId, visibleTabIds, {
      preferredFallbackTabId: fallbackTabId,
    });
    const nextParams = nextActiveTabId === admittedRequest.tabId ? admittedRequest.params : null;
    if (nextActiveTabId !== activeTabId || nextParams !== activeTabParams) {
      setActiveTabId(nextActiveTabId);
      setActiveTabParams(nextParams);
    }
  }, [activeTabId, activeTabParams, fallbackTabId, registrationJourney.snapshot, visibleTabIds]);

  useEffect(() => {
    writePersistedDashboardTabHint(activeTabId);
  }, [activeTabId]);

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;
    const handleCeremonyRequest = (event) => {
      const request = buildCeremonyRequest(event?.detail || {});
      dashboardCeremonyGenerationRef.current += 1;
      setDashboardCeremony({ request, generation: dashboardCeremonyGenerationRef.current });
    };
    window.addEventListener(CEREMONY_REQUEST_EVENT, handleCeremonyRequest);
    return () => {
      window.removeEventListener(CEREMONY_REQUEST_EVENT, handleCeremonyRequest);
    };
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined' || typeof document === 'undefined') return undefined;

    const flushPendingSettings = () => {
      void flushSettingsCommandBus();
    };
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        flushPendingSettings();
      }
    };

    window.addEventListener('pagehide', flushPendingSettings);
    window.addEventListener('beforeunload', flushPendingSettings);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      window.removeEventListener('pagehide', flushPendingSettings);
      window.removeEventListener('beforeunload', flushPendingSettings);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);

  const handleMainTabFirstFrameReady = useCallback((metadata = null) => {
    const snapshot = reportDashboardMainBootFirstFrameReady(metadata);
    emitZenTrace('dashboard_page:main_tab_first_frame_callback', {
      metadata,
      status: snapshot?.status || null,
      phase: snapshot?.phase || null,
      dismissible: snapshot?.dismissible === true,
      mainTabFirstFrameReady: snapshot?.mainTabFirstFrameReady === true,
    });
  }, []);

  const handleMainTabFirstFrameFailed = useCallback((metadata = null) => {
    const snapshot = reportDashboardMainBootFirstFrameFailed(metadata);
    emitZenTrace('dashboard_page:main_tab_first_frame_failed_callback', {
      metadata,
      status: snapshot?.status || null,
      phase: snapshot?.phase || null,
      dismissible: snapshot?.dismissible === true,
      mainTabFirstFrameReady: snapshot?.mainTabFirstFrameReady === true,
      mainTabFirstFrameDegraded: snapshot?.mainTabFirstFrameDegraded === true,
    });
  }, []);

  const handleTabChange = useCallback((tabId, params = null) => {
    const request = normalizeDashboardTabRequest(tabId, params);
    const normalizedRequest = registrationJourney.snapshot
      ? resolveDashboardRegistrationJourneyRoute(request, registrationJourney.snapshot)
      : request;
    if (mainPresentationFocusActive) {
      emitZenTrace('dashboard_page:tab_change_blocked_by_presentation_focus', {
        requestedTabId: tabId,
        normalizedTabId: normalizedRequest.tabId,
        activeTabId,
        sceneId: mainPresentationDecision?.sceneId || null,
        sceneSessionId: mainPresentationDecision?.sceneSessionId || null,
        phase: mainPresentationDecision?.phase || null,
      });
      if (activeTabId !== MAIN_PRESENTATION_FOCUS_TAB_ID) {
        setActiveTabId(MAIN_PRESENTATION_FOCUS_TAB_ID);
      }
      // A locked navigation attempt cannot cancel an explicit popup continuation.
      if (normalizedRequest.params?.registrationIntent) setActiveTabParams(normalizedRequest.params);
      return;
    }
    const nextTabId = resolveAccessibleTabId(normalizedRequest.tabId, visibleTabIds, {
      preferredFallbackTabId: fallbackTabId,
    });
    const nextParams = nextTabId === normalizedRequest.tabId ? (normalizedRequest.params || null) : null;
    if (activeTabId === 'main' && activeTabParams?.registrationIntent
        && nextTabId === 'main' && nextParams === null) {
      consumeDashboardSiteRegistrationRoute(activeTabParams.registrationIntent);
    }
    emitZenTrace('dashboard_page:tab_change', {
      requestedTabId: tabId,
      nextTabId,
      activeTabId,
      forcedByBoot: !bootUserControlReleased,
      blockedByPresentationFocus: false,
    });
    setActiveTabId(nextTabId);
    setActiveTabParams(nextParams);
  }, [
    activeTabId,
    activeTabParams,
    bootUserControlReleased,
    mainPresentationDecision?.phase,
    mainPresentationDecision?.sceneId,
    mainPresentationDecision?.sceneSessionId,
    mainPresentationFocusActive,
    fallbackTabId,
    visibleTabIds,
    registrationJourney.snapshot,
  ]);

  useDashboardLaunchIntentHandoff({
    launchContext: initialLaunchContext,
    themeId,
    bootUserControlReleased,
    presentationLocked: mainPresentationFocusActive,
    presentationResolved: mainPresentationScene.resolved,
    registrationJourneySnapshot: registrationJourney.snapshot,
    activeTabParams,
    onTabChange: handleTabChange,
  });

  const backgroundEffect = useMemo(() => {
    const backgroundType = themeObject?.slots?.background;
    const type = backgroundType || themeProfile?.fallbackBackground || null;

    if (!type) return null;

    const BackgroundComponent = getThemeComponent('background', type);
    if (!BackgroundComponent) return null;
    return <BackgroundComponent key={themeId} />;
  }, [themeId, themeObject?.slots?.background, themeProfile?.fallbackBackground]);

  const forceMainTabDuringBoot = !bootUserControlReleased;
  const forceMainTabForPresentationFocus = mainPresentationFocusActive;
  const forceMainTab = forceMainTabDuringBoot || forceMainTabForPresentationFocus;
  const renderedTabId = forceMainTab ? MAIN_PRESENTATION_FOCUS_TAB_ID : activeTabId;
  const renderedTabParams = forceMainTabDuringBoot || forceMainTabForPresentationFocus ? null : activeTabParams;
  const holdDashboardSurfaceForProgression = !mainPresentationScene.resolved;
  const firstVisit = useDashboardFirstVisit({ ready: boot.shellDismissed
    && dashboardDocumentVisible && !holdDashboardSurfaceForProgression });
  const artifactDisclosureNavCue = useArtifactDisclosureNavCue({
    activeTabId: renderedTabId,
    enabled: visibleTabIds.includes('tools')
      && !holdDashboardSurfaceForProgression
      && !mainPresentationFocusActive,
  });

  const handleDashboardCeremonyComplete = useCallback(({ ceremonyId } = {}) => {
    setDashboardCeremony((current) => (
      current === dashboardCeremony && current?.request.ceremonyId === ceremonyId ? null : current
    ));
  }, [dashboardCeremony]);

  useEffect(() => {
    emitZenTrace('dashboard_page:render_target', {
      activeTabId,
      renderedTabId,
      forceMainTabDuringBoot,
      forceMainTabForPresentationFocus,
      holdDashboardSurfaceForProgression,
    });
  }, [
    activeTabId,
    forceMainTabDuringBoot,
    forceMainTabForPresentationFocus,
    holdDashboardSurfaceForProgression,
    renderedTabId,
  ]);

  return (
    <ThemeTemporalAuthorityProvider value={ambientTemporalAuthority}>
      <ThemeAmbientPresentationProvider value={ambientPresentation}>
        <DashboardNavigationProvider value={dashboardNavigation}>
        <DashboardPresentationAdmissionProvider value={presentationAdmission}>
        <DashboardGuidanceProvider activeTabId={renderedTabId} onTabChange={handleTabChange}
          blocked={holdDashboardSurfaceForProgression || !presentationAdmission.contextualPresentationAllowed}>
        {backgroundEffect && (
          <div className="fixed inset-0 z-0 pointer-events-none">
            <Suspense fallback={null}>
              {backgroundEffect}
            </Suspense>
          </div>
        )}

        <div className="relative z-10 flex h-full w-full flex-col" data-main-presentation-phase={mainPresentationDecision.phase}>
          <Suspense fallback={<div className="h-full w-full bg-surface" />}>
            {holdDashboardSurfaceForProgression ? (
              <div className="h-full w-full bg-surface" />
            ) : (
              <DashboardLayout
                tabs={dashboardTabs}
                activeTabId={renderedTabId}
                activeTabParams={renderedTabParams}
                onTabChange={handleTabChange}
                fallbackTabId={fallbackTabId}
                themeId={themeId}
                themeObject={themeObject}
                sidebarDisplayMode={sidebarDisplayMode}
                tabCues={artifactDisclosureNavCue.tabCues}
                bootShellDismissed={boot.shellDismissed}
                bootShellRevealStarted={bootUserControlReleased}
                onMainTabFirstFrameReady={boot.mainTabFirstFrameReady ? null : handleMainTabFirstFrameReady}
                onMainTabFirstFrameFailed={boot.mainTabFirstFrameReady ? null : handleMainTabFirstFrameFailed}
                onMainPresentationSceneCommitted={mainPresentationScene.reportSceneCommitted}
                mainPresentationProjection={mainPresentationProjection}
                appearanceClock={appearanceClock}
                progressionUnlockDisclosure={progressionUnlockDisclosure}
                firstVisitSupportSlot={firstVisit.error ? (
                  <p role="alert" className="px-4 py-3 text-xs leading-relaxed text-warning">
                    {t('main.first_site_visit_failed')}
                    <button type="button" onClick={firstVisit.retry} className="ml-3 min-h-11 underline underline-offset-4">
                      {t('main.first_site_visit_retry')}
                    </button>
                  </p>
                ) : null}
              />
            )}
          </Suspense>
        </div>

        {themeId === THEME_IDS.ZEN && boot.shellDismissed && (
          <Suspense fallback={null}>
            <ZenAppPetalHost
              enabled={dashboardDocumentVisible
                && !holdDashboardSurfaceForProgression
                && !presentationAdmission.generalCeremonyActive}
              solarLocationProfile={solarLocationProfile}
              environmentMode={mainPresentationProjection.pond.environmentMode}
              weatherAuthority={mainPresentationProjection.pond.weatherAuthority}
              presentation={mainPresentationProjection.petals}
            />
          </Suspense>
        )}

        <CeremonyOverlay
          active={presentationEventOverlayRequest.active}
          ceremonyId={presentationEventOverlayRequest.ceremonyId}
          completionPolicy={presentationEventOverlayRequest.completionPolicy}
          holdAtCover={presentationEventOverlayRequest.holdAtCover}
          releaseCover={presentationEventOverlayRequest.releaseCover}
          onCoverOpaque={mainPresentationScene.reportCoverOpaque}
          onComplete={handlePresentationEventOverlayComplete}
        />

        <CeremonyOverlay
          key={dashboardCeremony?.generation ?? 'no-dashboard-ceremony'}
          active={presentationAdmission.generalCeremonyActive}
          ceremonyId={dashboardCeremony?.request.ceremonyId}
          seed={dashboardCeremony?.request.seed}
          onComplete={handleDashboardCeremonyComplete}
        />

        </DashboardGuidanceProvider>
        </DashboardPresentationAdmissionProvider>
        </DashboardNavigationProvider>
      </ThemeAmbientPresentationProvider>
    </ThemeTemporalAuthorityProvider>
  );
}
