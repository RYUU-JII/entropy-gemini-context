import {
  clampLevel,
  normalizeObservation,
  normalizeProtectionProfile,
} from '../../contracts/protectionContracts.js';
import { PROTECTION_REASON_CODES } from '../../contracts/reasonCodes.js';
import { getPostureProfile } from '../../catalog/postureProfiles.js';

function resolveBaseLevel(budgetRatio, postureProfile) {
  if (budgetRatio >= postureProfile.level4At) return 4;
  if (budgetRatio >= postureProfile.level3At) return 3;
  if (budgetRatio >= postureProfile.level2At) return 2;
  return 1;
}

function collectBudgetReasons(budgetRatio, postureProfile) {
  const reasons = [];

  if (budgetRatio >= postureProfile.level2At) {
    reasons.push(PROTECTION_REASON_CODES.BUDGET_RATIO_ELEVATED);
  }
  if (budgetRatio >= postureProfile.level3At) {
    reasons.push(PROTECTION_REASON_CODES.BUDGET_RATIO_HIGH);
  }
  if (budgetRatio >= postureProfile.level4At) {
    reasons.push(PROTECTION_REASON_CODES.BUDGET_RATIO_CRITICAL);
  }

  return reasons;
}

export function createLevelResolver() {
  function resolve({
    profile,
    observation,
    previousState = null,
  } = {}) {
    const normalizedProfile = normalizeProtectionProfile(profile);
    const normalizedObservation = normalizeObservation(observation);
    const postureProfile = getPostureProfile(normalizedProfile.posture);
    const budgetRatio = normalizedObservation.budgetRatio;
    const baseLevel = resolveBaseLevel(budgetRatio, postureProfile);
    const hasPressureSignals = normalizedObservation.pressureSignals.length > 0;
    const pressureBonus = hasPressureSignals ? 1 : 0;

    let level = clampLevel(Math.min(4, baseLevel + pressureBonus));
    const previousLevel = clampLevel(previousState?.level || 1);
    const deescalationNotBefore = Number(previousState?.deescalationNotBefore) || 0;

    if (level < previousLevel && normalizedObservation.now < deescalationNotBefore) {
      level = previousLevel;
    }

    const reasons = [
      ...collectBudgetReasons(budgetRatio, postureProfile),
      ...(hasPressureSignals ? [PROTECTION_REASON_CODES.PRESSURE_SIGNAL_PRESENT] : []),
    ];

    return {
      level,
      baseLevel,
      pressureBonus,
      postureProfile,
      reasons,
    };
  }

  return {
    resolve,
  };
}
