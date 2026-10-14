import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ArrowLeft, Bug, ChevronRight } from 'lucide-react';
import { useShallow } from 'zustand/react/shallow';

import {
  DashboardTabErrorSurface,
  DashboardTabLoadingSurface,
} from '@/apps/dashboard/loading/DashboardTabStateSurfaces.jsx';
import { useDashboardTabReadiness } from '@/apps/dashboard/loading/useDashboardTabReadiness.js';
import { BUILD_INCLUDE_DEBUG_TOOLS } from '@/platform/build/releaseCapabilities.js';
import {
  DEFAULT_DEBUG_CONFIG,
  normalizeDebugConfig,
} from '@/domains/settings/config/debugConfig.js';
import { useAppTranslation } from '@/ui-kit/hooks/useAppTranslation.js';

import { useProtocolStore, useUIPreferences } from '../../stores/index.js';
import { requireProtocolSyncSuccess } from '../../stores/protocolStoreHelpers.js';
import ExperimentLabOutlet, { preloadExperimentLabIntent } from './ExperimentLabOutlet.jsx';
import {
  EXPERIMENT_LAB_SECTION_IDS,
  getExperimentLabSectionCopyKeys,
  getExperimentLabSections,
  normalizeExperimentLabSectionId,
} from './experimentLabCatalog.js';

function resolveExperimentSectionFlags(themeProfile = {}) {
  return Object.freeze({
    includeVNextSection: themeProfile?.experiment?.enableBonsaiVNext === true,
    includeRenderDebugSection: themeProfile?.experiment?.enableBonsaiRenderDebug === true,
  });
}

export default function ExperimentHubTab({ tab, isActive = true, onTabChange = null }) {
  const { t } = useAppTranslation('tools');
  const { themeId, themeProfile } = useUIPreferences();
  const {
    debugConfig,
    setDebugConfig,
  } = useProtocolStore(useShallow((state) => ({
    debugConfig: state.debugConfig,
    setDebugConfig: state.setDebugConfig,
  })));
  const [activeSection, setActiveSection] = useState(EXPERIMENT_LAB_SECTION_IDS.HOME);
  const [debugConfigStatus, setDebugConfigStatus] = useState('');
  const sectionFlags = useMemo(
    () => resolveExperimentSectionFlags(themeProfile),
    [themeProfile],
  );
  const labSections = useMemo(
    () => getExperimentLabSections(sectionFlags),
    [sectionFlags],
  );
  const resolvedActiveSection = useMemo(
    () => normalizeExperimentLabSectionId(activeSection, {
      ...sectionFlags,
      fallbackSectionId: EXPERIMENT_LAB_SECTION_IDS.HOME,
    }),
    [activeSection, sectionFlags],
  );
  const readiness = useDashboardTabReadiness({
    tabId: 'experiment',
    themeId,
    isActive,
    surfaceId: EXPERIMENT_LAB_SECTION_IDS.HOME,
  });
  const resolvedDebugConfig = useMemo(
    () => normalizeDebugConfig(debugConfig, { defaults: DEFAULT_DEBUG_CONFIG }),
    [debugConfig],
  );
  const runtimeDebuggerEnabled = resolvedDebugConfig.enabled === true
    && resolvedDebugConfig.runtimeDebuggerEnabled === true;
  const sectionCopyKeys = getExperimentLabSectionCopyKeys(resolvedActiveSection);
  const sectionMeta = {
    label: t(sectionCopyKeys.label),
    title: t(sectionCopyKeys.title),
    description: t(sectionCopyKeys.description),
  };

  useEffect(() => {
    if (resolvedActiveSection === activeSection) return;
    setActiveSection(resolvedActiveSection);
  }, [activeSection, resolvedActiveSection]);

  const handleReturnHome = useCallback(() => {
    setActiveSection(EXPERIMENT_LAB_SECTION_IDS.HOME);
  }, []);
  const handleLabIntent = useCallback((sectionId) => {
    void preloadExperimentLabIntent({ sectionId, themeId }).catch((error) => {
      console.warn('[ExperimentHubTab] Lab intent preload failed.', error);
    });
  }, [themeId]);
  const handleRuntimeDebuggerToggle = useCallback((nextEnabled) => {
    if (typeof setDebugConfig !== 'function') return;
    void setDebugConfig((current) => {
      const normalized = normalizeDebugConfig(current, { defaults: DEFAULT_DEBUG_CONFIG });
      return {
        ...normalized,
        enabled: nextEnabled ? true : normalized.enabled,
        runtimeDebuggerEnabled: nextEnabled === true,
      };
    }).then((result) => {
      requireProtocolSyncSuccess(result);
      setDebugConfigStatus(t(
        nextEnabled
          ? 'experiment.runtime_debugger_option.saved_on'
          : 'experiment.runtime_debugger_option.saved_off',
      ));
    }).catch(() => {
      setDebugConfigStatus(t('experiment.runtime_debugger_option.save_failed'));
    });
  }, [setDebugConfig, t]);

  const shellId = tab?.id || 'experiment';
  const shellTitle = tab?.title || sectionMeta.title;
  if (readiness.phase === 'loading') {
    return (
      <DashboardTabLoadingSurface
        tabId={shellId}
        policyTabId="experiment"
        label={shellTitle}
        testId="experiment-tab-loading"
      />
    );
  }
  if (readiness.phase === 'error') {
    return (
      <DashboardTabErrorSurface
        tabId={shellId}
        title={shellTitle}
        detail={readiness.error?.message}
        testId="experiment-tab-error"
      />
    );
  }

  return (
    <section
      id={shellId}
      className={`${isActive ? 'flex' : 'hidden'} h-full min-h-0 w-full flex-col gap-2`}
    >
      <div className="shrink-0 flex min-w-0 flex-wrap items-center gap-2 px-1">
        {resolvedActiveSection !== EXPERIMENT_LAB_SECTION_IDS.HOME ? (
          <button
            type="button"
            onClick={handleReturnHome}
            className="inline-flex h-8 items-center gap-1.5 rounded-[8px] border border-on-surface/10 bg-surface-sunken/50 px-2.5 text-[10px] font-black uppercase tracking-[0.08em] text-on-surface-muted transition-colors hover:border-accent/30 hover:text-on-surface focus:outline-hidden focus:ring-2 focus:ring-accent/35"
          >
            <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
            <span>{t('experiment.lab_actions.back')}</span>
          </button>
        ) : null}
        <div className="min-w-0">
          <h3 className="text-sm font-bold text-on-surface">{sectionMeta.title}</h3>
          <p className="text-[11px] text-on-surface-muted">{sectionMeta.description}</p>
        </div>
      </div>

      {resolvedActiveSection === EXPERIMENT_LAB_SECTION_IDS.HOME ? (
        <div className="min-h-0 min-w-0 flex-1 overflow-auto px-1 pb-1">
          <div className="grid min-w-0 gap-3 md:grid-cols-2 xl:grid-cols-3">
            {BUILD_INCLUDE_DEBUG_TOOLS ? (
              <div className="rounded-[8px] border border-on-surface/10 bg-surface/85 p-4 shadow-sm">
                <div className="flex min-w-0 items-start gap-3">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[8px] bg-surface-sunken text-on-surface-muted">
                    <Bug className="h-4 w-4" aria-hidden="true" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-[10px] font-black uppercase tracking-[0.12em] text-on-surface-muted">
                      {t('experiment.runtime_debugger_option.eyebrow')}
                    </div>
                    <div className="mt-1 text-sm font-bold text-on-surface">
                      {t(runtimeDebuggerEnabled
                        ? 'experiment.runtime_debugger_option.status_on'
                        : 'experiment.runtime_debugger_option.status_off')}
                    </div>
                    <p className="mt-1 text-xs leading-relaxed text-on-surface-muted">
                      {t('experiment.runtime_debugger_option.desc')}
                    </p>
                  </div>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={runtimeDebuggerEnabled}
                    aria-label={t('experiment.runtime_debugger_option.title')}
                    onClick={() => handleRuntimeDebuggerToggle(!runtimeDebuggerEnabled)}
                    className={`relative mt-0.5 inline-flex h-8 w-14 shrink-0 rounded-full border-2 transition-colors focus:outline-hidden focus:ring-2 focus:ring-accent/35 ${runtimeDebuggerEnabled
                      ? 'border-accent/35 bg-accent/20'
                      : 'border-border bg-surface-elevated/35'}`}
                  >
                    <span className={`pointer-events-none mt-0.5 inline-block h-6 w-6 transform rounded-full shadow transition-transform ${runtimeDebuggerEnabled
                      ? 'translate-x-6 bg-accent'
                      : 'translate-x-1 bg-surface'}`}
                    />
                  </button>
                </div>
                {debugConfigStatus ? (
                  <div className="mt-3 rounded-[8px] border border-border/25 bg-surface-sunken/40 px-3 py-2 text-[10px] font-semibold text-on-surface-muted">
                    {debugConfigStatus}
                  </div>
                ) : null}
              </div>
            ) : null}

            {labSections.map((sectionId) => {
              const copyKeys = getExperimentLabSectionCopyKeys(sectionId);
              return (
                <button
                  key={sectionId}
                  type="button"
                  data-experiment-section={sectionId}
                  onClick={() => setActiveSection(sectionId)}
                  onPointerEnter={() => handleLabIntent(sectionId)}
                  onPointerDown={() => handleLabIntent(sectionId)}
                  onFocus={() => handleLabIntent(sectionId)}
                  className="group flex min-h-[112px] min-w-0 flex-col justify-between rounded-[8px] border border-on-surface/10 bg-surface/85 p-4 text-left shadow-sm transition-colors hover:border-accent/30 hover:bg-surface-elevated/65 focus:outline-hidden focus:ring-2 focus:ring-accent/35"
                >
                  <span className="min-w-0">
                    <span className="block text-[10px] font-black uppercase tracking-[0.12em] text-on-surface-muted">
                      {t(copyKeys.label)}
                    </span>
                    <span className="mt-1 block text-sm font-bold text-on-surface">
                      {t(copyKeys.title)}
                    </span>
                    <span className="mt-1 block text-xs leading-relaxed text-on-surface-muted">
                      {t(copyKeys.description)}
                    </span>
                  </span>
                  <span className="mt-3 inline-flex items-center text-[10px] font-black uppercase tracking-[0.08em] text-accent">
                    {t('experiment.lab_actions.open')}
                    <ChevronRight className="ml-1 h-3.5 w-3.5" aria-hidden="true" />
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      ) : (
        <ExperimentLabOutlet
          sectionId={resolvedActiveSection}
          isActive={isActive}
          loadingLabel={sectionMeta.title}
          errorTitle={t('experiment.lab_module_error_title')}
          retryLabel={t('experiment.lab_module_retry')}
          tab={tab}
          onTabChange={onTabChange}
          onReturnHome={handleReturnHome}
        />
      )}
    </section>
  );
}
