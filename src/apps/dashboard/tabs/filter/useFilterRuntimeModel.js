import { useMemo } from 'react';
import { requireCoolingCurve } from '../../../../domains/settings/config/coolingCurvePolicy.js';

import {
  normalizeProtectionArtifactRuntimeSnapshot,
  selectCanonicalProtectionArtifactChildRuntimeStates,
} from '../../../../domains/protection/runtime/canonicalArtifactTelemetry.js';
import { selectProtectionSummary } from '../../../../domains/protection/selectors/protectionSummarySelectors.js';
import { buildProtectionRuntimeInsightCards } from '../../utils/protectionRuntimeInsights.js';
import { PROTECTION_PREVIEW_SCENARIOS } from './protectionPreviewScenarios.js';

const COOLING_PRESETS = Object.freeze([
  Object.freeze({
    id: 'gentle',
    titleKey: 'filter.cooling_gentle_title',
    descKey: 'filter.cooling_gentle_desc',
  }),
  Object.freeze({
    id: 'standard',
    titleKey: 'filter.cooling_standard_title',
    descKey: 'filter.cooling_standard_desc',
  }),
  Object.freeze({
    id: 'steep',
    titleKey: 'filter.cooling_steep_title',
    descKey: 'filter.cooling_steep_desc',
  }),
]);

function resolveStatusModel({
  runtimeAvailable,
  runtimeHost,
  runtimeSummary,
  activeFilterCount,
  activeArtifacts,
  standbyArtifacts,
  tTabs,
}) {
  if (!runtimeAvailable || !runtimeHost) {
    return {
      tone: 'muted',
      label: tTabs('filter.status_idle', { }),
      detail: '',
      host: runtimeHost,
      activeFilterCount,
      activeArtifacts: [],
      standbyArtifacts: [],
    };
  }

  if (runtimeSummary.budgetRatio >= 0.9) {
    return {
      tone: 'warn',
      label: tTabs('filter.status_near_target', { }),
      detail: '',
      host: runtimeHost,
      activeFilterCount,
      activeArtifacts,
      standbyArtifacts,
    };
  }

  if (activeArtifacts.length > 0) {
    return {
      tone: 'active',
      label: tTabs('filter.status_active', { }),
      detail: '',
      host: runtimeHost,
      activeFilterCount,
      activeArtifacts,
      standbyArtifacts,
    };
  }

  return {
    tone: 'ok',
    label: tTabs('filter.status_ready', { }),
    detail: '',
    host: runtimeHost,
    activeFilterCount,
    activeArtifacts,
    standbyArtifacts,
  };
}

function projectGoalEndStatus(status, summary, tTabs) {
  if (!summary || !status.host) return status;
  const combined = summary.site.renderer === 'combined_global_furin'
    && summary.global.runId === summary.site.runId;
  const tones = { error: 'alert', surface_unsupported: 'warn', waiting_for_safe_boundary: 'warn', delivered: 'ok' };
  const labels = { error: 'error', surface_unsupported: 'unsupported', waiting_for_safe_boundary: 'waiting', delivered: 'delivered' };
  const goalEnds = ['global', 'site'].flatMap(scope => {
    const entry = summary[scope];
    if (!Object.hasOwn(tones, entry.delivery) || (combined && scope === 'site')) return [];
    const displayScope = combined && scope === 'global' ? 'combined' : scope;
    const labelKey = entry.phase === 'entry_cancelling' ? 'cancelling' : labels[entry.delivery];
    return [{ scope: displayScope, delivery: entry.delivery,
      title: tTabs(`filter.goal_end_${displayScope}`, {}),
      label: tTabs(`filter.goal_end_${labelKey}`, {}),
      detail: tTabs(`filter.goal_end_${entry.delivery === 'delivered' && combined ? 'combined_delivered' : labelKey}_desc`, {}),
      tone: tones[entry.delivery],
    }];
  });
  const lead = goalEnds.find(entry => entry.delivery !== 'delivered') || goalEnds[0];
  return lead ? { ...status, tone: lead.tone, label: lead.label, goalEnds } : status;
}

export function useFilterRuntimeModel({
  artifactRuntimeSnapshot,
  coolingCurve,
  onTabChange,
  previewLaneSummary,
  tTabs,
  tTools,
}) {
  const normalizedRuntimeSnapshot = useMemo(
    () => normalizeProtectionArtifactRuntimeSnapshot(artifactRuntimeSnapshot),
    [artifactRuntimeSnapshot],
  );
  const runtimePlan = normalizedRuntimeSnapshot.runtime.plan;
  const runtimeSummary = useMemo(() => selectProtectionSummary(runtimePlan), [runtimePlan]);
  const runtimeHost = normalizedRuntimeSnapshot.scope.host || '';

  const runtimeInsightModel = useMemo(
    () => buildProtectionRuntimeInsightCards(artifactRuntimeSnapshot, tTabs),
    [artifactRuntimeSnapshot, tTabs],
  );
  const runtimeInsightCards = runtimeInsightModel.cards;
  const handleInsightAction = useMemo(
    () => (typeof onTabChange === 'function'
      ? (action) => {
        if (!action?.tabId) return;
        onTabChange(action.tabId, action.params || null);
      }
      : null),
    [onTabChange],
  );

  const coolingPreset = useMemo(() => {
    const selected = COOLING_PRESETS.find(option => option.id === requireCoolingCurve(coolingCurve).preset);
    return { id: selected.id, title: tTabs(selected.titleKey, {}), description: tTabs(selected.descKey, {}) };
  }, [coolingCurve, tTabs]);

  const scenarioOptions = useMemo(() => PROTECTION_PREVIEW_SCENARIOS.map((scenario) => ({
    id: scenario.id,
    label: tTabs(scenario.labelKey, { }),
    description: tTabs(`filter.${scenario.id}_desc`, { }),
  })), [tTabs]);

  const laneCards = useMemo(() => ({
    reward: {
      title: tTabs('filter.lane_reward_title', { }),
      count: previewLaneSummary.reward,
      description: tTabs('filter.lane_reward_desc', { }),
      tone: previewLaneSummary.reward > 0 ? 'active' : 'default',
    },
    pace: {
      title: tTabs('filter.lane_pace_title', { }),
      count: previewLaneSummary.pace,
      description: tTabs('filter.lane_pace_desc', { }),
      tone: previewLaneSummary.pace > 0 ? 'active' : 'default',
    },
    friction: {
      title: tTabs('filter.lane_friction_title', { }),
      count: previewLaneSummary.friction,
      description: tTabs('filter.lane_friction_desc', { }),
      tone: previewLaneSummary.friction > 0 ? 'active' : 'default',
    },
    advanced: {
      title: tTabs('filter.lane_advanced_title', { }),
      count: previewLaneSummary.advanced,
      description: tTabs('filter.lane_advanced_desc', { }),
      tone: previewLaneSummary.advanced > 0 ? 'active' : 'default',
    },
  }), [previewLaneSummary, tTabs]);

  const canonicalArtifactChildRuntimeStates = useMemo(() => ([
    'lens',
    'veil',
    'brake',
    'barrier',
    'flare',
    'echo',
  ].map((artifactId) => ({
    artifactId,
    childStates: selectCanonicalProtectionArtifactChildRuntimeStates(artifactRuntimeSnapshot, artifactId),
  }))), [artifactRuntimeSnapshot]);

  const activeArtifactNames = useMemo(() => canonicalArtifactChildRuntimeStates
    .flatMap(({ artifactId, childStates }) => Object.entries(childStates || {})
      .filter(([, runtime]) => runtime.available && (runtime.state === 'engaged' || runtime.state === 'cleanup'))
      .map(([childId]) => tTools(`artifacts.${artifactId}.children.${childId}.title`))), [
      canonicalArtifactChildRuntimeStates,
      tTools,
    ]);

  const standbyArtifactNames = useMemo(() => canonicalArtifactChildRuntimeStates
    .flatMap(({ artifactId, childStates }) => Object.entries(childStates || {})
      .filter(([, runtime]) => runtime.available && runtime.state === 'armed')
      .map(([childId]) => tTools(`artifacts.${artifactId}.children.${childId}.title`))), [
      canonicalArtifactChildRuntimeStates,
      tTools,
    ]);

  const status = useMemo(() => {
    const status = projectGoalEndStatus(resolveStatusModel({
    runtimeAvailable: normalizedRuntimeSnapshot.runtime.available,
    runtimeHost,
    runtimeSummary,
    activeFilterCount: normalizedRuntimeSnapshot.runtime.available
      ? runtimeSummary.activeFilterCount
      : 0,
    activeArtifacts: activeArtifactNames,
    standbyArtifacts: standbyArtifactNames,
    tTabs,
    }), normalizedRuntimeSnapshot.runtime.goalEndSummary, tTabs);
    const curve = normalizedRuntimeSnapshot.runtime.coolingCurve;
    const curveKeys = { no_budget: 'filter.cooling_no_budget', no_basis: 'filter.cooling_no_basis', active: 'filter.cooling_active' };
    return curve && status.host ? { ...status, coolingCurveNote: tTabs(curveKeys[curve.state], {}) } : status;
  }, [
    activeArtifactNames,
    normalizedRuntimeSnapshot.runtime.available,
    normalizedRuntimeSnapshot.runtime.goalEndSummary,
    normalizedRuntimeSnapshot.runtime.coolingCurve,
    runtimeHost,
    runtimeSummary,
    standbyArtifactNames,
    tTabs,
  ]);

  const insightLabels = useMemo(() => ({
    title: tTabs('filter.insights_heading', { }),
    onAction: handleInsightAction,
    cardLabels: {
      intervention: tTabs('runtime_insights.card_intervention', { }),
      target: tTabs('runtime_insights.card_target', { }),
    },
  }), [handleInsightAction, tTabs]);

  const sidebarLabels = useMemo(() => ({
    nowEyebrow: tTabs('filter.now_eyebrow', { }),
    nowTitle: tTabs('filter.now_heading', { }),
    followingLabel: tTabs('filter.following_label', { }),
    filterCountLabel: tTabs('filter.filter_count_label', { }),
    activeArtifactsLabel: tTabs('filter.active_artifacts_label', { }),
    readyArtifactsLabel: tTabs('filter.ready_artifacts_label', { }),
    noneLabel: tTabs('filter.none_label', { }),
    autoEyebrow: tTabs('filter.auto_eyebrow', { }),
    autoTitle: tTabs('filter.cooling_heading', { }),
    coolingPreview: tTabs('filter.cooling_preview', { }),
    coolingExplanation: tTabs('filter.cooling_explanation', { }),
    coolingCustom: coolingCurve.advanced === null ? '' : tTabs('filter.cooling_custom', { }),
    coolingPolicyLink: tTabs('filter.cooling_policy_link', { }),
    scenarioTitle: tTabs('filter.scenario_heading', { }),
    artifactHubTitle: tTabs('filter.artifact_hub_heading', { }),
    artifactHubBody: tTabs('filter.artifact_hub_body', { }),
    artifactHubAction: tTabs('filter.open_labs', { }),
    artifactHubUnavailable: tTabs('filter.artifact_hub_unavailable', { }),
    lanesTitle: tTabs('filter.lanes_heading', { }),
    advancedTitle: tTabs('filter.advanced_heading', { }),
  }), [tTabs, coolingCurve.advanced]);

  return {
    coolingPreset,
    insightLabels,
    laneCards,
    runtimeInsightCards,
    scenarioOptions,
    sidebarLabels,
    status,
  };
}

export default useFilterRuntimeModel;
