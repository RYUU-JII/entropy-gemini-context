import {
  CONFIG_DEFAULT_FILTER_SETTINGS,
  normalizeFilterSettings,
} from '../../../settings/config/index.js';
import { FEATURE_KEYS } from '../../protocol/contracts/featureKeys.js';
import { LANE_IDS } from '../../contracts/laneIds.js';
import { getFilterCapabilityPatch } from '../../catalog/filterCapabilityCatalog.js';

function cloneFilterEntry(entry) {
  if (!entry || typeof entry !== 'object' || Array.isArray(entry)) {
    return {
      isActive: false,
      value: entry ?? null,
    };
  }

  return { ...entry };
}

function buildInactiveFilterPlan() {
  return FEATURE_KEYS.reduce((acc, featureKey) => {
    const entry = cloneFilterEntry(CONFIG_DEFAULT_FILTER_SETTINGS?.[featureKey]);
    acc[featureKey] = {
      ...entry,
      isActive: false,
    };
    return acc;
  }, {});
}

function mergePatch(filterPlan, patch = {}) {
  Object.entries(patch).forEach(([featureKey, patchValue]) => {
    const current = cloneFilterEntry(filterPlan[featureKey]);

    if (patchValue && typeof patchValue === 'object' && !Array.isArray(patchValue)) {
      filterPlan[featureKey] = {
        ...current,
        ...patchValue,
        isActive: patchValue.isActive ?? true,
      };
      return;
    }

    filterPlan[featureKey] = {
      ...current,
      isActive: true,
      value: patchValue,
    };
  });

  return filterPlan;
}

export function createFilterPlanCompiler() {
  function compile({
    lanes = {},
  } = {}) {
    const filterPlan = buildInactiveFilterPlan();

    LANE_IDS.forEach((laneId) => {
      const intensity = Number(lanes?.[laneId]) || 0;
      if (intensity <= 0) return;
      mergePatch(filterPlan, getFilterCapabilityPatch(laneId, intensity));
    });

    return normalizeFilterSettings(filterPlan);
  }

  return {
    compile,
  };
}
