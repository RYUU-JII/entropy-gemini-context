import React, { Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import Sidebar from './Sidebar.jsx';
import MainPanel from './MainPanel.jsx';
import Scaler from './Scaler.jsx';
import {
  VIEWPORT_LAYOUT_MODES,
  useViewportRuntime,
} from './useViewportRuntime.js';
import BodyStyle from '../../../ui-kit/BodyStyle.jsx';
import { preloadDashboardTabIntent } from '../loading/preloadDashboardTab.js';
import {
  recordDashboardTabIntent,
  startDashboardTabEntryTrace,
} from '@dashboard-tab-entry-telemetry';
import {
  filterTabsByViewport,
  resolveAccessibleTabId,
  resolvePolicyFallbackTabId,
} from '../tabs/registry.js';
import { useThemeAmbientPresentation } from '@/themes/core/presentation/ThemeAmbientPresentationContext.jsx';
import { BUILD_INCLUDE_DEBUG_TOOLS } from '@/platform/build/releaseCapabilities.js';
import { JourneyProgressDockContext } from '../guidance/JourneyProgressDockContext.js';
import { DashboardDevelopmentDockContext } from './DashboardDevelopmentDockContext.js';
import { preloadDashboardTabI18nResources } from '@/i18n/dashboardResources.js';
import { useDashboardRenderRuntime } from './useDashboardRenderRuntime.js';
import {
  projectGardenSidebarTabs,
  resolveDashboardPaneId,
} from '../workspaces/garden/gardenRouteFamily.js';

const DashboardDevelopmentHud = React.lazy(() => Promise.all([
  import('@dashboard-development-hud'),
  preloadDashboardTabI18nResources('tools'),
]).then(([loadedModule]) => loadedModule));

export default function DashboardLayout({
  tabs,
  activeTabId: initialTabId,
  activeTabParams: initialTabParams,
  onTabChange,
  fallbackTabId = 'main',
  themeId = 'entropy',
  sidebarDisplayMode = 'expanded',
  tabCues = null,
  bootShellDismissed = false,
  bootShellRevealStarted = false,
  onMainTabFirstFrameReady = null,
  onMainTabFirstFrameFailed = null,
  onMainPresentationSceneCommitted = null,
  mainPresentationProjection = null,
  appearanceClock = null,
  progressionUnlockDisclosure = null,
  firstVisitSupportSlot = null,
}) {
  const ambientPresentation = useThemeAmbientPresentation();
  const viewportRuntime = useViewportRuntime();
  const [developmentHudExpanded, setDevelopmentHudExpanded] = useState(false);
  const [bonsaiDebugExpanded, setBonsaiDebugExpanded] = useState(false);
  const [bonsaiDebugHost, setBonsaiDebugHost] = useState(null);
  const isPortraitDesktop = viewportRuntime.layoutMode === VIEWPORT_LAYOUT_MODES.PORTRAIT_DESKTOP;
  const isCompactPortrait = viewportRuntime.layoutMode === VIEWPORT_LAYOUT_MODES.PORTRAIT_COMPACT;
  const developmentHudAvailable = BUILD_INCLUDE_DEBUG_TOOLS
    && themeId === 'zen'
    && Boolean(appearanceClock)
    && bootShellDismissed
    && !viewportRuntime.isPortrait;
  const developmentHudWidth = developmentHudExpanded ? 320 : 56;
  const developmentHudGap = 16;
  const consoleMarginLeft = developmentHudAvailable
    ? Math.max(viewportRuntime.marginLeft, developmentHudWidth + developmentHudGap + 12)
    : viewportRuntime.marginLeft;
  const activeTabId = initialTabId;
  const bonsaiDebugDockAvailable = developmentHudAvailable && ['main', 'sites'].includes(activeTabId);
  const bonsaiDebugWidth = bonsaiDebugExpanded ? 320 : 56;
  const consoleMarginRight = bonsaiDebugDockAvailable
    ? Math.max(viewportRuntime.marginRight, bonsaiDebugWidth + developmentHudGap + 12)
    : viewportRuntime.marginRight;
  const bonsaiDebugDock = useMemo(() => bonsaiDebugDockAvailable ? {
    kind: 'external', target: bonsaiDebugHost, expanded: bonsaiDebugExpanded,
    onExpandedChange: setBonsaiDebugExpanded,
  } : null, [bonsaiDebugDockAvailable, bonsaiDebugExpanded, bonsaiDebugHost]);
  useDashboardRenderRuntime({ themeId, bootShellDismissed, activeTabId, ambientPresentation });
  const activeTabParams = initialTabParams;
  const visibleTabs = useMemo(
    () => filterTabsByViewport(tabs, viewportRuntime.isPortrait),
    [tabs, viewportRuntime.isPortrait]
  );
  const visibleTabIds = useMemo(() => visibleTabs.map((tab) => tab.id), [visibleTabs]);
  // Keep route admission and MainPanel's canonical tab list intact. Only the
  // sidebar presents the two Zen routes as one Garden destination.
  const sidebarTabs = useMemo(
    () => projectGardenSidebarTabs(visibleTabs, themeId),
    [visibleTabs, themeId],
  );
  const sidebarActiveTabId = resolveDashboardPaneId(themeId, activeTabId);
  const visibleFallbackTabId = useMemo(
    () => resolvePolicyFallbackTabId(visibleTabIds, {
      preferredFallbackTabId: fallbackTabId,
    }),
    [fallbackTabId, visibleTabIds]
  );

  const handleTabIntent = useCallback((targetTabId, { kind = 'unknown' } = {}) => {
    if (!visibleTabIds.includes(targetTabId) || targetTabId === activeTabId) return;
    if (visibleTabs.find((tab) => tab.id === targetTabId)?.pending === true) return;
    recordDashboardTabIntent({ tabId: targetTabId, kind, themeId });
    void preloadDashboardTabIntent({
      tabId: targetTabId,
      themeId,
    }).catch((error) => {
      console.warn(`[DashboardTabPreload] ${targetTabId}`, error);
    });
  }, [activeTabId, themeId, visibleTabIds, visibleTabs]);

  const handleTabChange = useCallback((targetTabId, params = null) => {
    if (!visibleTabIds.length) {
      return;
    }
    const resolvedTabId = resolveAccessibleTabId(targetTabId, visibleTabIds, {
      preferredFallbackTabId: visibleFallbackTabId,
    });
    if (resolvedTabId === activeTabId) {
      if (params !== activeTabParams) onTabChange(resolvedTabId, params);
      return;
    }
    // Selection also starts the declared preload when no pointer/focus intent
    // preceded it. Module and critical widgets can load before the lazy tab mounts.
    handleTabIntent(resolvedTabId, { kind: 'selection' });
    startDashboardTabEntryTrace({
      tabId: resolvedTabId,
      themeId,
      source: resolvedTabId === targetTabId ? 'navigation' : 'fallback-navigation',
    });
    onTabChange(resolvedTabId, resolvedTabId === targetTabId ? (params || null) : null);
  }, [
    activeTabId,
    activeTabParams,
    onTabChange,
    visibleFallbackTabId,
    visibleTabIds,
    isCompactPortrait,
    themeId,
    handleTabIntent,
  ]);


  const bodyStyles = useMemo(() => ({
    overflow: '',
    ...(ambientPresentation?.themeId === themeId
      ? ambientPresentation.cssVariables
      : null),
  }), [ambientPresentation, themeId]);
  const mainPresentationEmphasisMode = mainPresentationProjection?.visualEmphasis?.active === true
    && typeof mainPresentationProjection.visualEmphasis.mode === 'string'
    ? mainPresentationProjection.visualEmphasis.mode
    : undefined;

  const viewportVars = useMemo(
    () => {
      const activeSidebarWidth = viewportRuntime.isPortrait
        ? '100%'
        : (sidebarDisplayMode === 'icons'
          ? '92px'
          : '180px');
      const activeFrameColumns = viewportRuntime.isPortrait
        ? '1fr'
        : (sidebarDisplayMode === 'icons'
          ? '92px minmax(0, 1fr)'
          : 'var(--console-sidebar-width) minmax(0, 1fr)');
      return {
        '--console-sidebar-width': activeSidebarWidth,
        '--console-frame-columns': activeFrameColumns,
        '--ui-scale': String(viewportRuntime.uiScale),
        '--ui-density-scale': String(viewportRuntime.densityScale),
        '--ui-font-scale': String(viewportRuntime.fontScale),
        '--ui-viewport-width': `${viewportRuntime.width}px`,
        '--ui-viewport-height': `${viewportRuntime.height}px`,
      };
    },
    [
      sidebarDisplayMode,
      viewportRuntime.isPortrait,
      viewportRuntime.uiScale,
      viewportRuntime.densityScale,
      viewportRuntime.fontScale,
      viewportRuntime.width,
      viewportRuntime.height,
    ]
  );
  const viewportBackdrop = ambientPresentation?.themeId === themeId
    ? (
      <div
        aria-hidden="true"
        className="zen-ambient-viewport-backdrop absolute inset-0"
        data-zen-ambient-phase={ambientPresentation.phase}
      />
    )
    : null;

  useEffect(() => {
    if (!visibleTabIds.length) return;
    const resolvedTabId = resolveAccessibleTabId(activeTabId, visibleTabIds, {
      preferredFallbackTabId: visibleFallbackTabId,
    });
    if (resolvedTabId === activeTabId) return;
    onTabChange(resolvedTabId, null);
  }, [activeTabId, onTabChange, visibleFallbackTabId, visibleTabIds]);

  return (
    <>
      <BodyStyle
        classList={['js-enabled']}
        classToggles={{
          'ui-portrait': viewportRuntime.isPortrait,
          'ui-portrait-desktop': isPortraitDesktop,
          'ui-portrait-compact': isCompactPortrait,
          'ui-landscape': !viewportRuntime.isPortrait,
        }}
        styles={bodyStyles}
      />

      <Scaler
        enabled={viewportRuntime.scalerEnabled}
        // The outside HUD and its reserved space must move in one layout pass.
        animateResize={!developmentHudAvailable}
        mode={viewportRuntime.uiMode}
        background={viewportBackdrop}
        marginX={viewportRuntime.marginX}
        marginY={viewportRuntime.marginY}
        marginTop={viewportRuntime.marginTop}
        marginRight={consoleMarginRight}
        marginBottom={viewportRuntime.marginBottom}
        marginLeft={consoleMarginLeft}
      >
        <div
          className="relative h-full w-full console-shell"
          data-zen-ambient-phase={ambientPresentation?.themeId === themeId
            ? ambientPresentation.phase
            : undefined}
          data-ui-orientation={viewportRuntime.uiMode}
          data-ui-mode={viewportRuntime.uiMode}
          data-ui-layout={viewportRuntime.layoutMode}
          style={viewportVars}
        >
          <JourneyProgressDockContext.Provider value={developmentHudAvailable}>
            <DashboardDevelopmentDockContext.Provider value={bonsaiDebugDock}>
            <div className="relative flex h-full w-full">
              {bonsaiDebugDockAvailable && <div
                ref={setBonsaiDebugHost}
                className="dashboard-bonsai-debug-dock pointer-events-none absolute top-1/2 z-40 -translate-y-1/2"
                style={{ left: `calc(100% + ${developmentHudGap}px)`, width: bonsaiDebugWidth }}
              />}
              {developmentHudAvailable && (
                <Suspense fallback={null}>
                  <div
                    className="dashboard-development-hud pointer-events-none absolute top-1/2 z-40 -translate-y-1/2"
                    style={{ right: `calc(100% + ${developmentHudGap}px)`, width: developmentHudWidth }}
                  >
                    <DashboardDevelopmentHud
                      expanded={developmentHudExpanded}
                      onExpandedChange={setDevelopmentHudExpanded}
                      appearanceClock={appearanceClock}
                      progressionUnlockDisclosure={progressionUnlockDisclosure}
                    />
                  </div>
                </Suspense>
              )}
              {/* Unified Console Layout */}
              <div
                className="relative min-h-0 flex-1 console-frame"
                data-dashboard-active-tab={activeTabId}
                data-sidebar-mode={sidebarDisplayMode === 'icons' ? 'icons' : 'expanded'}
                data-main-presentation-emphasis={mainPresentationEmphasisMode}
              >
                <Sidebar
                  tabs={sidebarTabs}
                  activeTabId={sidebarActiveTabId}
                  onTabChange={handleTabChange}
                  onTabIntent={handleTabIntent}
                  tabCues={tabCues}
                />

                {/* Main Content Area */}
                <div className="relative w-full h-full min-w-0 min-h-0 panel-transition-wrapper">
                  <div className="console-content !absolute inset-0 !w-full !h-full auto-rows-auto">
                    <MainPanel
                      tabs={visibleTabs}
                      activeTabId={activeTabId}
                      themeId={themeId}
                      params={activeTabParams}
                      onTabChange={handleTabChange}
                      bootShellDismissed={bootShellDismissed}
                      bootShellRevealStarted={bootShellRevealStarted}
                      onMainTabFirstFrameReady={onMainTabFirstFrameReady}
                      onMainTabFirstFrameFailed={onMainTabFirstFrameFailed}
                      onMainPresentationSceneCommitted={onMainPresentationSceneCommitted}
                      mainPresentationProjection={mainPresentationProjection}
                      progressionUnlockDisclosure={progressionUnlockDisclosure}
                      firstVisitSupportSlot={firstVisitSupportSlot}
                    />
                  </div>
                </div>
              </div>

            </div>
            </DashboardDevelopmentDockContext.Provider>
          </JourneyProgressDockContext.Provider>
        </div>
      </Scaler>
    </>
  );
}
