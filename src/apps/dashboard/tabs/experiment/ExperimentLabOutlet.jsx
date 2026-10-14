import React, { Suspense } from 'react';

import {
  DashboardTabErrorSurface,
  DashboardTabLoadingSurface,
} from '@/apps/dashboard/loading/DashboardTabStateSurfaces.jsx';
import {
  isDynamicImportFailure,
  reloadAfterDynamicImportFailure,
  withDynamicImportRecovery,
} from '@/platform/extension/dynamicImportRecovery.js';
import { preloadThemeWidgetChunk } from '@/themes/core/registry/index.js';
import { getDashboardTabReadinessProfile } from '../loadingPolicy.js';

import {
  EXPERIMENT_LAB_MODULE_OWNERS,
  getExperimentLabModuleOwner,
  hasAsyncExperimentLabModule,
} from './experimentLabCatalog.js';

const getExperimentLabRecoveryBoundaryId = (moduleOwner) => (
  `dashboard-experiment-lab:${moduleOwner}`
);
const ASYNC_LAB_LOADERS = Object.freeze({
  [EXPERIMENT_LAB_MODULE_OWNERS.WORKSPACE]: withDynamicImportRecovery(
    () => import('./ExperimentWorkspace.jsx'),
    {
      boundaryId: getExperimentLabRecoveryBoundaryId(EXPERIMENT_LAB_MODULE_OWNERS.WORKSPACE),
    },
  ),
  [EXPERIMENT_LAB_MODULE_OWNERS.CLSE]: withDynamicImportRecovery(
    () => import('./clse/CLSELab.jsx'),
    {
      boundaryId: getExperimentLabRecoveryBoundaryId(EXPERIMENT_LAB_MODULE_OWNERS.CLSE),
    },
  ),
});
const modulePreloadCache = new Map();

class ExperimentLabModuleErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  render() {
    if (this.state.error) {
      return this.props.renderError(this.state.error);
    }
    return this.props.children;
  }
}

function preloadExperimentLabModule(sectionId) {
  const moduleOwner = getExperimentLabModuleOwner(sectionId);
  const loader = ASYNC_LAB_LOADERS[moduleOwner];
  if (!hasAsyncExperimentLabModule(sectionId) || typeof loader !== 'function') {
    return Promise.reject(new Error(`EXPERIMENT_LAB_MODULE_NOT_DECLARED:${String(sectionId || '')}`));
  }
  if (modulePreloadCache.has(moduleOwner)) {
    return modulePreloadCache.get(moduleOwner);
  }
  const preloadPromise = Promise.resolve()
    .then(() => loader())
    .catch((error) => {
      modulePreloadCache.delete(moduleOwner);
      throw error;
    });
  modulePreloadCache.set(moduleOwner, preloadPromise);
  return preloadPromise;
}

export function preloadExperimentLabSection(sectionId) {
  if (!hasAsyncExperimentLabModule(sectionId)) {
    return Promise.resolve({ loaded: false, sectionId });
  }
  return preloadExperimentLabModule(sectionId);
}

export async function preloadExperimentLabIntent({ sectionId, themeId } = {}) {
  const readinessProfile = getDashboardTabReadinessProfile('experiment', {
    surfaceId: sectionId,
    themeId,
  });
  if (!readinessProfile || readinessProfile.surfaceId !== sectionId) {
    throw new Error(`EXPERIMENT_LAB_SECTION_UNAVAILABLE:${String(sectionId || '')}`);
  }
  if (readinessProfile.widgetTypes.length > 0 && !themeId) {
    throw new Error(`EXPERIMENT_LAB_INTENT_THEME_ID_REQUIRED:${String(sectionId || '')}`);
  }
  await Promise.all([
    preloadExperimentLabSection(sectionId),
    ...readinessProfile.widgetTypes.map((widgetType) => (
      preloadThemeWidgetChunk(themeId, widgetType)
    )),
  ]);
  return Object.freeze({
    sectionId,
    moduleLoaded: hasAsyncExperimentLabModule(sectionId),
    widgetTypes: Object.freeze([...readinessProfile.widgetTypes]),
  });
}

export function resetExperimentLabModulePreloadCache(sectionId = null) {
  if (sectionId) {
    modulePreloadCache.delete(getExperimentLabModuleOwner(sectionId));
    return;
  }
  modulePreloadCache.clear();
}

export default function ExperimentLabOutlet({
  sectionId,
  isActive = true,
  loadingLabel = '',
  errorTitle = '',
  retryLabel = '',
  tab = null,
  onTabChange = null,
  onReturnHome = null,
} = {}) {
  const [loadAttempt, setLoadAttempt] = React.useState(0);
  const LabComponent = React.useMemo(() => (
    hasAsyncExperimentLabModule(sectionId)
      ? React.lazy(() => preloadExperimentLabModule(sectionId))
      : null
  ), [loadAttempt, sectionId]);
  const moduleOwner = getExperimentLabModuleOwner(sectionId);
  const handleRetry = React.useCallback((error) => {
    if (isDynamicImportFailure(error)) {
      const didReload = reloadAfterDynamicImportFailure({
        boundaryId: getExperimentLabRecoveryBoundaryId(moduleOwner),
      });
      if (didReload) return;
    }
    resetExperimentLabModulePreloadCache(sectionId);
    setLoadAttempt((current) => current + 1);
  }, [moduleOwner, sectionId]);
  if (!LabComponent) return null;

  return (
    <div className="min-h-0 min-w-0 flex-1 overflow-hidden" data-experiment-lab-outlet={sectionId}>
      <ExperimentLabModuleErrorBoundary
        key={`${sectionId}:${loadAttempt}`}
        renderError={(error) => (
          <DashboardTabErrorSurface
            tabId={`experiment-${sectionId}`}
            title={errorTitle || loadingLabel}
            detail={error instanceof Error ? error.message : String(error)}
            actions={(
              <button
                type="button"
                onClick={() => handleRetry(error)}
                className="rounded bg-amber-900 px-3 py-1.5 text-xs font-semibold text-white"
              >
                {retryLabel}
              </button>
            )}
          />
        )}
      >
        <Suspense
          fallback={(
            <DashboardTabLoadingSurface
              tabId={`experiment-${sectionId}`}
              policyTabId="experiment"
              label={loadingLabel}
            />
          )}
        >
          {moduleOwner === EXPERIMENT_LAB_MODULE_OWNERS.CLSE ? (
            <LabComponent isActive={isActive} />
          ) : (
            <LabComponent
              tab={tab}
              isActive={isActive}
              onTabChange={onTabChange}
              initialSectionId={sectionId}
              onReturnHome={onReturnHome}
              embedded={true}
            />
          )}
        </Suspense>
      </ExperimentLabModuleErrorBoundary>
    </div>
  );
}
