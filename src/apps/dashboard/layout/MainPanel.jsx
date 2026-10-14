import React, { memo, useMemo, Suspense, useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { getDashboardTabTransitionProfile } from '@/themes/core/motion/index.js';
import { useAppTranslation } from '../../../ui-kit/hooks/useAppTranslation.js';
import {
  DashboardTabErrorSurface,
  DashboardTabLoadingSurface,
  DashboardTabRetryAction,
} from '../loading/DashboardTabStateSurfaces.jsx';
import {
  getPreloadedDashboardTabComponent,
  preloadDashboardTabModule,
} from '../loading/preloadDashboardTab.js';
import {
  DASHBOARD_TAB_COMPONENT_LOADERS,
  shouldDashboardTabKeepAlive,
} from '../tabs/registry.js';
import {
  isZenGardenRoute,
  resolveDashboardPaneId,
} from '../workspaces/garden/gardenRouteFamily.js';

function TabPlaceholder({ tab, isLoading = false, t }) {
  return (
    <section id={tab.id} className="block w-full h-full p-8 animate-pulse">
      <header className="mb-10 space-y-4">
        {/* Skeleton Title */}
        <div className="h-8 w-48 bg-white/10 rounded" />
        {/* Skeleton Desc */}
        <div className="h-4 w-96 bg-white/5 rounded" />
      </header>
      <div className="w-full h-64 border border-white/5 bg-white/5 rounded-lg flex items-center justify-center">
        {isLoading && (
          <div className="flex flex-col items-center gap-4">
            <div className="w-8 h-8 border-2 border-t-accent border-transparent rounded-full animate-spin" />
            <span className="text-xs font-mono text-accent/50 uppercase tracking-widest">{t('dashboard.main_panel.loading_module')}</span>
          </div>
        )}
        {!isLoading && <p>{tab.placeholder}</p>}
      </div>
    </section>
  );
}

function renderTabSuspenseFallback(tab, t) {
  return (
    <DashboardTabLoadingSurface
      tabId={tab?.id}
      label={tab?.title || t('dashboard.main_panel.loading_module')}
    />
  );
}

const createLazyTabComponent = (tabId) => (
  React.lazy(() => preloadDashboardTabModule(tabId))
);

// First-attempt identities stay stable across MainPanel mounts. A failed attempt is
// deliberately replaced with a new identity by the local retry owner below.
const INITIAL_TAB_COMPONENTS = Object.freeze(
  Object.fromEntries(
    Object.keys(DASHBOARD_TAB_COMPONENT_LOADERS).map((tabId) => [
      tabId,
      createLazyTabComponent(tabId),
    ]),
  ),
);

class DashboardTabModuleErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error) {
    if (typeof this.props.onError === 'function') {
      this.props.onError(error);
    }
  }

  render() {
    if (this.state.error) return this.props.renderError(this.state.error);
    return this.props.children;
  }
}

/**
 * MainPanel Component - Unified Tab Content Area
 * 
 * Renders the active tab plus explicit transition/keep-alive panes.
 * Boot and idle preload ownership stays in bootSurfaceWarmup.
 */
const MainPanel = memo(function MainPanel(props) {
  const { t } = useAppTranslation('common');
  const {
    activeTabId,
    onTabChange,
    tabs,
    themeId = '',
    params,
    bootShellDismissed = false,
    bootShellRevealStarted = false,
    onMainTabFirstFrameReady = null,
    onMainTabFirstFrameFailed = null,
    onMainPresentationSceneCommitted = null,
    mainPresentationProjection = null,
    progressionUnlockDisclosure = null,
    firstVisitSupportSlot = null,
  } = props;
  const tabTransitionProfile = useMemo(
    () => getDashboardTabTransitionProfile(themeId),
    [themeId],
  );
  const usesStackedTabTransitions = tabTransitionProfile.mode === 'stacked';
  const usesEnterOnlyTabTransitions = tabTransitionProfile.mode === 'enter-only';
  const activePaneId = resolveDashboardPaneId(themeId, activeTabId);
  const activeTab = tabs?.find((tab) => tab.id === activePaneId) || tabs?.[0];
  const visibleTabIds = useMemo(() => (tabs || []).map((tab) => tab.id), [tabs]);
  const tabById = useMemo(() => {
    const map = new Map();
    (tabs || []).forEach((tab) => map.set(tab.id, tab));
    return map;
  }, [tabs]);
  const retainedTabIdsRef = useRef(new Set());
  const tabParamsRef = useRef(new Map());
  // Lightweight presentation state also survives standalone Sites unmounts.
  // Zen's admitted sheet stays mounted under Garden with its runtime parked.
  const sitesPresentationStateRef = useRef({});
  const gardenSitesAdmittedRef = useRef(false);
  const gardenRouteRef = useRef('main');
  if (isZenGardenRoute(themeId, activeTabId)) gardenRouteRef.current = activeTabId;
  if (themeId === 'zen' && activeTabId === 'sites') gardenSitesAdmittedRef.current = true;
  const tabComponentChoiceRef = useRef(new Map());
  const previousActiveTabIdRef = useRef(activePaneId);
  const tabTransitionFirstRenderRef = useRef(true);
  const tabTransitionExitTimerMapRef = useRef(new Map());
  const [exitingTabIds, setExitingTabIds] = useState(() => new Set());
  const [tabLoadAttempts, setTabLoadAttempts] = useState(() => new Map());
  const pendingExitTabId = usesStackedTabTransitions
    && typeof previousActiveTabIdRef.current === 'string'
    && previousActiveTabIdRef.current
    && previousActiveTabIdRef.current !== activePaneId
    ? previousActiveTabIdRef.current
    : null;
  const activeTabWasRetainedBeforeRender = typeof activePaneId === 'string'
    && activePaneId
    && retainedTabIdsRef.current.has(activePaneId);
  const activeTabUsesKeepAlive = typeof activePaneId === 'string'
    && activePaneId
    && shouldDashboardTabKeepAlive(activePaneId);
  // Kept-alive tabs are persistent surfaces; returning to them should not replay entry motion.
  const activeTabWasKeptAliveBeforeRender = Boolean(
    activeTabWasRetainedBeforeRender && activeTabUsesKeepAlive,
  );

  if (typeof activeTabId === 'string' && activeTabId) {
    retainedTabIdsRef.current.add(activePaneId);
    tabParamsRef.current.set(activeTabId, params || null);
  }

  const renderedTabIds = useMemo(() => {
    return visibleTabIds.filter((tabId) => (
      !(themeId === 'zen' && tabId === 'sites')
      && (tabId === activePaneId
      || tabId === pendingExitTabId
      || exitingTabIds.has(tabId)
      || (retainedTabIdsRef.current.has(tabId) && shouldDashboardTabKeepAlive(tabId)))
    ));
  }, [activePaneId, exitingTabIds, pendingExitTabId, themeId, visibleTabIds]);

  // Unified viewport class - CSS handles theme-specific styling
  const viewportClass = useMemo(() => [
    'flex h-full min-h-0 w-full flex-1 min-w-0 flex-col panel-viewport relative',
    tabTransitionProfile.clipOverflow ? 'overflow-hidden' : '',
  ].join(' '), [tabTransitionProfile.clipOverflow]);

  const containerClass = 'flex flex-1 min-h-0 min-w-0 flex-col';

  useEffect(() => {
    return () => {
      tabTransitionExitTimerMapRef.current.forEach((timerId) => clearTimeout(timerId));
      tabTransitionExitTimerMapRef.current.clear();
    };
  }, []);

  useEffect(() => {
    if (!usesStackedTabTransitions) {
      tabTransitionExitTimerMapRef.current.forEach((timerId) => clearTimeout(timerId));
      tabTransitionExitTimerMapRef.current.clear();
      setExitingTabIds((prev) => (prev.size ? new Set() : prev));
      previousActiveTabIdRef.current = activePaneId;
      tabTransitionFirstRenderRef.current = false;
      return;
    }

    if (typeof activePaneId === 'string' && activePaneId) {
      const activeExitTimer = tabTransitionExitTimerMapRef.current.get(activePaneId);
      if (activeExitTimer) {
        clearTimeout(activeExitTimer);
        tabTransitionExitTimerMapRef.current.delete(activePaneId);
      }
      setExitingTabIds((prev) => {
        if (!prev.has(activePaneId)) return prev;
        const next = new Set(prev);
        next.delete(activePaneId);
        return next;
      });
    }

    const previousActiveTabId = previousActiveTabIdRef.current;
    if (
      typeof previousActiveTabId === 'string'
      && previousActiveTabId
      && previousActiveTabId !== activePaneId
    ) {
      setExitingTabIds((prev) => {
        if (prev.has(previousActiveTabId)) return prev;
        const next = new Set(prev);
        next.add(previousActiveTabId);
        return next;
      });
      const previousTimer = tabTransitionExitTimerMapRef.current.get(previousActiveTabId);
      if (previousTimer) {
        clearTimeout(previousTimer);
      }
      const timerId = setTimeout(() => {
        tabTransitionExitTimerMapRef.current.delete(previousActiveTabId);
        setExitingTabIds((prev) => {
          if (!prev.has(previousActiveTabId)) return prev;
          const next = new Set(prev);
          next.delete(previousActiveTabId);
          return next;
        });
      }, tabTransitionProfile.exitDurationMs);
      tabTransitionExitTimerMapRef.current.set(previousActiveTabId, timerId);
    }

    previousActiveTabIdRef.current = activePaneId;
    tabTransitionFirstRenderRef.current = false;
  }, [activePaneId, tabTransitionProfile.exitDurationMs, usesStackedTabTransitions]);

  const retryTabModule = (tabId) => {
    tabComponentChoiceRef.current.delete(tabId);
    setTabLoadAttempts((current) => {
      const next = new Map(current);
      next.set(tabId, (current.get(tabId) || 0) + 1);
      return next;
    });
  };

  const resolveTabComponent = (tabId) => {
    const tab = tabById.get(tabId);
    if (!tab) return null;
    const loadAttempt = tabLoadAttempts.get(tab.id) || 0;
    let Component = tabComponentChoiceRef.current.get(tab.id);
    if (!Component) {
      Component = getPreloadedDashboardTabComponent(tab.id)
        || (loadAttempt === 0
          ? INITIAL_TAB_COMPONENTS[tab.id]
          : createLazyTabComponent(tab.id));
      if (Component) {
        // Keep the element type stable for the lifetime of this MainPanel.
        // Swapping React.lazy for its resolved component would remount retained tabs.
        tabComponentChoiceRef.current.set(tab.id, Component);
      }
    }
    return Component;
  };

  const renderTabNode = (tabId, { isRuntimeActive, isExiting, isPresented, embedded = false }) => {
    const tab = tabById.get(tabId);
    if (!tab) return null;
    const loadAttempt = tabLoadAttempts.get(tab.id) || 0;
    const Component = resolveTabComponent(tab.id);
    const tabParams = tabParamsRef.current.get(tab.id) || null;
    if (!Component) {
      return <TabPlaceholder key={tab.id} tab={tab} t={t} />;
    }

    const gardenHost = themeId === 'zen' && tab.id === 'main';
    const pathwaysActive = isRuntimeActive && activeTabId === 'sites';
    const pathwaysSlot = gardenHost && gardenSitesAdmittedRef.current
      ? renderTabNode('sites', {
          isRuntimeActive: pathwaysActive,
          isExiting: false,
          isPresented: pathwaysActive,
          embedded: true,
        })
      : null;

    return (
      <DashboardTabModuleErrorBoundary
        key={`${tab.id}:${loadAttempt}`}
        onError={tab.id === 'main' && typeof onMainTabFirstFrameFailed === 'function'
          ? (error) => onMainTabFirstFrameFailed({
              source: 'main_tab_module_or_render_failed',
              themeId,
              failureScope: 'main_tab_root',
              bootImpact: 'degraded',
              error: {
                code: 'MAIN_TAB_RENDER_FAILED',
                message: error instanceof Error ? error.message : String(error),
              },
            })
          : null}
        renderError={(error) => (
          <DashboardTabErrorSurface
            tabId={tab.id}
            title={t('dashboard.main_panel.load_failed')}
            detail={error?.message || String(error)}
            testId={`${tab.id}-module-error`}
            actions={(
              <DashboardTabRetryAction
                label={t('dashboard.main_panel.retry')}
                onRetry={() => retryTabModule(tab.id)}
              />
            )}
          />
        )}
      >
        <Suspense fallback={renderTabSuspenseFallback(tab, t)}>
          <Component
            tab={tab}
            params={tabParams}
            isActive={isPresented}
            isPresented={isPresented}
            isExiting={isExiting}
            isRuntimeActive={isRuntimeActive}
            embedded={embedded}
            gardenMode={gardenHost ? (gardenRouteRef.current === 'sites' ? 'pathways' : 'pond') : undefined}
            pathwaysSlot={pathwaysSlot}
            pathwaysAvailable={gardenHost && tabById.has('sites') && tabById.get('sites').pending !== true}
            onTabChange={onTabChange}
            presentationStateRef={tab.id === 'sites' ? sitesPresentationStateRef : undefined}
            bootShellDismissed={bootShellDismissed}
            bootShellRevealStarted={bootShellRevealStarted}
            onMainTabFirstFrameReady={onMainTabFirstFrameReady}
            onMainTabFirstFrameFailed={onMainTabFirstFrameFailed}
            onMainPresentationSceneCommitted={onMainPresentationSceneCommitted}
            mainPresentationProjection={mainPresentationProjection}
            progressionUnlockDisclosure={progressionUnlockDisclosure}
            firstVisitSupportSlot={tab.id === 'main' && activeTabId === 'main' ? firstVisitSupportSlot : null}
          />
        </Suspense>
      </DashboardTabModuleErrorBoundary>
    );
  };

  const renderTab = (tabId) => {
    const tab = tabById.get(tabId);
    if (!tab) return null;
    const isRuntimeActive = tab.id === activePaneId;
    const isExiting = !isRuntimeActive
      && (tab.id === pendingExitTabId || exitingTabIds.has(tab.id));
    const isPresented = isRuntimeActive || isExiting;
    const tabNode = renderTabNode(tabId, { isRuntimeActive, isExiting, isPresented });

    if (usesStackedTabTransitions) {
      const shouldRunEnterAnimation = isRuntimeActive && !tabTransitionFirstRenderRef.current;
      const animateState = isRuntimeActive ? 'enter' : isExiting ? 'exit' : 'initial';
      return (
        <motion.div
          key={tab.id}
          inert={!isRuntimeActive}
          className="absolute inset-0 h-full w-full"
          variants={tabTransitionProfile.variants}
          initial={shouldRunEnterAnimation ? 'initial' : false}
          animate={animateState}
          style={{
            willChange: tabTransitionProfile.willChange || 'transform',
            transformStyle: 'preserve-3d',
            backfaceVisibility: 'hidden',
            isolation: 'isolate',
            pointerEvents: isRuntimeActive ? 'auto' : 'none',
          }}
        >
          <div className="flex h-full min-h-0 w-full flex-col relative">
            {tabNode}
          </div>
        </motion.div>
      );
    }

    if (usesEnterOnlyTabTransitions) {
      const shouldRunEnterAnimation = (
        isRuntimeActive
        && !tabTransitionFirstRenderRef.current
        && !activeTabWasKeptAliveBeforeRender
      );
      return (
        <motion.div
          key={tab.id}
          inert={!isRuntimeActive}
          className={`${isRuntimeActive ? 'flex' : 'hidden'} flex-1 min-h-0 h-full flex-col relative w-full`}
          variants={tabTransitionProfile.variants}
          initial={shouldRunEnterAnimation ? 'initial' : false}
          animate={isRuntimeActive ? 'enter' : undefined}
          style={{
            willChange: tabTransitionProfile.willChange || 'transform, opacity, filter',
            pointerEvents: isRuntimeActive ? 'auto' : 'none',
          }}
        >
          {tabNode}
        </motion.div>
      );
    }

    return (
      <div
        key={tab.id}
        inert={!isRuntimeActive}
        className={`${isRuntimeActive ? 'flex' : 'hidden'} flex-1 min-h-0 h-full flex-col relative w-full`}
      >
        {tabNode}
      </div>
    );
  };

  return (
    <div className={containerClass}>
      <div className={viewportClass}>
        {!activeTab && (
          <TabPlaceholder
            t={t}
            tab={{
              id: 'missing',
              title: t('dashboard.main_panel.missing_tab_title'),
              description: '',
              placeholder: t('dashboard.main_panel.missing_tab_placeholder'),
            }}
          />
        )}
        {activeTab && renderedTabIds.map((tabId) => renderTab(tabId))}
      </div>
    </div>
  );
}, (prevProps, nextProps) => {
  return (
    prevProps.activeTabId === nextProps.activeTabId &&
    prevProps.themeId === nextProps.themeId &&
    prevProps.bootShellDismissed === nextProps.bootShellDismissed &&
    prevProps.bootShellRevealStarted === nextProps.bootShellRevealStarted &&
    prevProps.onMainTabFirstFrameReady === nextProps.onMainTabFirstFrameReady &&
    prevProps.onMainTabFirstFrameFailed === nextProps.onMainTabFirstFrameFailed &&
    prevProps.onMainPresentationSceneCommitted === nextProps.onMainPresentationSceneCommitted &&
    prevProps.mainPresentationProjection === nextProps.mainPresentationProjection &&
    prevProps.progressionUnlockDisclosure === nextProps.progressionUnlockDisclosure &&
    prevProps.firstVisitSupportSlot === nextProps.firstVisitSupportSlot &&
    prevProps.params === nextProps.params &&
    prevProps.tabs === nextProps.tabs &&
    prevProps.onTabChange === nextProps.onTabChange
  );
});

export default MainPanel;
