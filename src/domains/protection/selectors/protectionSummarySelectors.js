import {
  hasActiveArtifactStates,
  normalizeInterventionPlan,
} from '../contracts/protectionContracts.js';
import { isEffectFeatureKey } from '../protocol/contracts/featureKeys.js';

const LEVEL_LABELS = Object.freeze({
  1: 'baseline',
  2: 'rising',
  3: 'intense',
  4: 'critical',
  5: 'maximum',
});

export function selectProtectionSummary(plan) {
  const normalized = normalizeInterventionPlan(plan);
  const activeFilterCount = Object.entries(normalized.filterPlan || {})
    .filter(([key, entry]) => isEffectFeatureKey(key) && entry?.isActive)
    .length;

  return {
    level: normalized.state.level,
    levelLabel: LEVEL_LABELS[normalized.state.level] || LEVEL_LABELS[1],
    activeFilterCount,
    hasActiveArtifacts: hasActiveArtifactStates(normalized.artifacts),
    reasons: normalized.state.reasons,
    budgetRatio: normalized.trace.budgetRatio,
  };
}
