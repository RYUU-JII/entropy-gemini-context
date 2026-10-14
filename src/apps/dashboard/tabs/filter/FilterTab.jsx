import React, { useMemo } from 'react';
import { useShallow } from 'zustand/react/shallow';

import { useAppTranslation } from '../../../../ui-kit/hooks/useAppTranslation.js';
import { getCanonicalArtifactDefinition } from '../../../../domains/protection/catalog/artifactFamilyCatalog.js';
import { useDashboardTabReadiness } from '../../loading/useDashboardTabReadiness.js';
import {
  DashboardTabErrorSurface,
  DashboardTabLoadingSurface,
} from '../../loading/DashboardTabStateSurfaces.jsx';
import { useProtectionRuntimeSubscription } from '../../hooks/useProtectionRuntimeSubscription.js';
import { useProtocolStore, useUIPreferences } from '../../stores/index.js';
import FilterSettingsSidebar from './FilterSettingsSidebar.jsx';
import ProtectionControlSidebar from './ProtectionControlSidebar.jsx';
import PreviewMockupTop from './preview/PreviewMockupTop.jsx';
import SettingsPreviewSection from './preview/SettingsPreviewSection.jsx';
import { summarizeProtectionPreviewLanes } from './protectionPreviewScenarios.js';
import { useFilterRuntimeModel } from './useFilterRuntimeModel.js';
import { useFilterSettingsEditor } from './useFilterSettingsEditor.js';
import ArtifactNavigator from './ArtifactFamilyNavigator.jsx';

const FILTER_NAV_ARTIFACT_IDS = Object.freeze(['lens', 'veil', 'brake']);

export default function FilterTab({
  tab,
  isActive,
  isClosing,
  onTabChange,
}) {
  const { t: tTabs } = useAppTranslation('filter');
  const { t: tTools } = useAppTranslation('tools');
  const {
    filterSettings,
    setFilterSettings,
    coolingCurve,
  } = useProtocolStore(useShallow((state) => ({
    filterSettings: state.filterSettings,
    setFilterSettings: state.setFilterSettings,
    coolingCurve: state.coolingCurve,
  })));
  const { themeProfile, themeId } = useUIPreferences();
  const filterTabReadiness = useDashboardTabReadiness({
    tabId: 'filter',
    themeId,
    isActive,
  });
  const tabFontClass = 'font-mono';
  const { snapshot: artifactRuntimeSnapshot } = useProtectionRuntimeSubscription({
    enabled: isActive,
  });
  const {
    advancedOpen,
    categoryStats,
    handleCompoundChange,
    handleShadowChange,
    handleToggle,
    handleValueCommit,
    handleValueInput,
    localSettings,
    previewPlatformId,
    previewScenarioId,
    previewSettings,
    selectedCategory,
    setAdvancedOpen,
    setPreviewPlatformId,
    setPreviewScenarioId,
    setSelectedCategory,
    showExperimental,
  } = useFilterSettingsEditor({
    filterSettings,
    isActive,
    setFilterSettings,
    themeProfile,
  });

  const previewLaneSummary = useMemo(
    () => summarizeProtectionPreviewLanes(previewSettings),
    [previewSettings],
  );
  const {
    coolingPreset,
    insightLabels,
    laneCards,
    runtimeInsightCards,
    scenarioOptions,
    sidebarLabels,
    status,
  } = useFilterRuntimeModel({
    artifactRuntimeSnapshot,
    coolingCurve,
    onTabChange,
    previewLaneSummary,
    tTabs,
    tTools,
  });
  const activeArtifactId = selectedCategory || FILTER_NAV_ARTIFACT_IDS[0];

  const artifactFamilyCopyById = useMemo(() => FILTER_NAV_ARTIFACT_IDS.reduce((acc, artifactId) => {
    const artifactDefinition = getCanonicalArtifactDefinition(artifactId);
    acc[artifactId] = {
      title: tTools(artifactDefinition?.titleKey || `artifacts.${artifactId}.title`),
      description: tTools(artifactDefinition?.descriptionKey || `artifacts.${artifactId}.desc`),
    };
    return acc;
  }, {}), [tTools]);

  const themedCategoryStats = useMemo(
    () => categoryStats.map((category) => ({
      ...category,
      label: artifactFamilyCopyById[category.key]?.title || category.label,
      description: artifactFamilyCopyById[category.key]?.description || category.description,
    })),
    [artifactFamilyCopyById, categoryStats],
  );

  const artifactNavigatorItems = useMemo(() => {
    const categoryStatsByKey = themedCategoryStats.reduce((acc, entry) => {
      acc[entry.key] = entry;
      return acc;
    }, {});
    const familyEyebrows = {
      lens: 'Visual',
      veil: 'Signals',
      brake: 'Friction',
    };

    return FILTER_NAV_ARTIFACT_IDS.map((artifactId) => {
      const artifactDefinition = getCanonicalArtifactDefinition(artifactId);
      const categoryStat = categoryStatsByKey[artifactId];
      const totalCount = Math.max(0, Number(categoryStat?.total) || 0);
      const activeCount = Math.max(0, Number(categoryStat?.active) || 0);
      const meta = `${activeCount} active / ${totalCount}`;

      return {
        id: artifactId,
        title: artifactFamilyCopyById[artifactId]?.title || tTools(artifactDefinition?.titleKey || `artifacts.${artifactId}.title`),
        description: artifactFamilyCopyById[artifactId]?.description || tTools(artifactDefinition?.descriptionKey || `artifacts.${artifactId}.desc`),
        eyebrow: familyEyebrows[artifactId] || '',
        meta,
      };
    });
  }, [artifactFamilyCopyById, themedCategoryStats, tTools]);

  const handleCategoryChange = (key) => {
    setSelectedCategory(key);
  };

  const handleArtifactSelectById = (artifactId) => {
    handleCategoryChange(artifactId);
  };

  if (!isActive) {
    return (
      <section
        id={tab?.id || 'filter'}
        className={`hidden h-full min-h-0 w-full flex-col overflow-hidden ${tabFontClass}`}
      />
    );
  }

  if (filterTabReadiness.phase === 'loading') {
    return (
      <DashboardTabLoadingSurface
        tabId={tab?.id || 'filter'}
        label={tTabs('common:status.loading')}
        sectionClassName={tabFontClass}
      />
    );
  }

  if (filterTabReadiness.phase === 'error') {
    return (
      <DashboardTabErrorSurface
        tabId={tab?.id || 'filter'}
        title={tTabs('common:status.error')}
        detail={filterTabReadiness.error?.message}
        sectionClassName={tabFontClass}
      />
    );
  }

  return (
    <section
      id={tab?.id || 'filter'}
      className={`flex h-full min-h-0 w-full flex-col gap-4 overflow-hidden ${tabFontClass}`}
    >
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-[20px] border border-border/15 bg-surface">
        <ArtifactNavigator
          artifacts={artifactNavigatorItems}
          activeArtifactId={activeArtifactId}
          onSelect={handleArtifactSelectById}
        />

        <div className="grid min-h-0 flex-1 overflow-hidden xl:grid-cols-[minmax(0,1fr)_400px]">
          <main className="relative flex min-h-0 flex-col overflow-hidden border-r border-border bg-surface-elevated/20">
            <PreviewMockupTop
              platformId={previewPlatformId}
              onPlatformChange={setPreviewPlatformId}
              themeId={themeId}
            />

            <div className="relative flex-1 min-h-0 overflow-hidden">
              <SettingsPreviewSection
                activeSettings={previewSettings}
                isOpen={!isClosing}
                platformId={previewPlatformId}
                themeId={themeId}
              />
            </div>
          </main>

          <ProtectionControlSidebar
            status={status}
            coolingPreset={coolingPreset}
            onOpenProtectionSettings={typeof onTabChange === 'function' ? () => onTabChange('settings', { section: 'protection' }) : null}
            scenarios={scenarioOptions}
            activeScenarioId={previewScenarioId}
            onScenarioChange={setPreviewScenarioId}
            laneCards={laneCards}
            insightCards={runtimeInsightCards}
            insightLabels={insightLabels}
            advancedOpen={advancedOpen}
            onAdvancedToggle={() => setAdvancedOpen((prev) => !prev)}
            onOpenLabs={() => onTabChange?.('tools')}
            labels={sidebarLabels}
            showAdvanced
          >
            <FilterSettingsSidebar
              embedded
              selectedCategory={selectedCategory}
              onCategoryChange={handleCategoryChange}
              settings={localSettings}
              showExperimental={showExperimental}
              onToggle={handleToggle}
              onValueChange={handleValueCommit}
              onRangeInput={handleValueInput}
              onRangeCommit={handleValueCommit}
              onShadowChange={handleShadowChange}
              onCompoundChange={handleCompoundChange}
              categoryStats={themedCategoryStats}
            />
          </ProtectionControlSidebar>
        </div>
      </div>
    </section>
  );
}
