import {
  CONFIG_DEFAULT_FILTER_SETTINGS,
  SOCIAL_METRIC_OPTION_DEFAULTS,
  isAdaptiveFrictionFeatureKey,
  isVisualFrictionProfileKey,
  requireAdaptiveFrictionEntry,
  materializeAdaptiveFrictionEntry,
} from '../../settings/config/index.js';
import { FEATURE_KEYS, isKnownFeatureKey } from '../protocol/contracts/featureKeys.js';
import { normalizeInterventionPlan } from './protectionContracts.js';

const SOCIAL_METRIC_OPTION_KEYS = Object.freeze(
  Object.keys(SOCIAL_METRIC_OPTION_DEFAULTS),
);

function isPlainObject(value) {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function hasOwn(record, key) {
  return Object.prototype.hasOwnProperty.call(record, key);
}

function requireCompiledSocialMetricOptions(value) {
  if (!isPlainObject(value)) {
    throw new Error('COMPILED_RUNTIME_FILTER_ENTRY_FIELD_INVALID:socialMetrics:value');
  }

  const optionKeys = Object.keys(value);
  const hasExactOptionKeys = optionKeys.length === SOCIAL_METRIC_OPTION_KEYS.length
    && optionKeys.every((optionKey) => SOCIAL_METRIC_OPTION_KEYS.includes(optionKey));
  const hasBooleanOptions = SOCIAL_METRIC_OPTION_KEYS.every(
    (optionKey) => typeof value[optionKey] === 'boolean',
  );
  if (!hasExactOptionKeys || !hasBooleanOptions) {
    throw new Error('COMPILED_RUNTIME_FILTER_ENTRY_FIELD_INVALID:socialMetrics:value');
  }
}

function requireCompiledRuntimeFilterEntry(featureKey, entry) {
  if (!isPlainObject(entry)) {
    throw new Error(`COMPILED_RUNTIME_FILTER_ENTRY_INVALID:${featureKey}`);
  }
  if (typeof entry.isActive !== 'boolean') {
    throw new Error(`COMPILED_RUNTIME_FILTER_ENTRY_FIELD_INVALID:${featureKey}:isActive`);
  }
  if (hasOwn(entry, 'step')) {
    throw new Error(`COMPILED_RUNTIME_FILTER_ENTRY_FIELD_INVALID:${featureKey}:step`);
  }

  if (isAdaptiveFrictionFeatureKey(featureKey)) {
    requireAdaptiveFrictionEntry(featureKey, entry);
  } else if (!hasOwn(entry, 'value') || entry.value === undefined) {
    throw new Error(`COMPILED_RUNTIME_FILTER_ENTRY_VALUE_REQUIRED:${featureKey}`);
  }

  if (featureKey === 'socialMetrics') {
    requireCompiledSocialMetricOptions(entry.value);
  }

  return { ...entry };
}

export function requireCompiledRuntimeFilterPlan(rawFilterPlan) {
  if (rawFilterPlan === undefined) return {};
  if (!isPlainObject(rawFilterPlan)) {
    throw new Error('COMPILED_RUNTIME_FILTER_PLAN_INVALID');
  }

  return Object.entries(rawFilterPlan).reduce((acc, [featureKey, entry]) => {
    if (!isKnownFeatureKey(featureKey)) {
      throw new Error(`COMPILED_RUNTIME_FILTER_PLAN_KEY_UNKNOWN:${featureKey}`);
    }
    acc[featureKey] = requireCompiledRuntimeFilterEntry(featureKey, entry);
    return acc;
  }, {});
}

export function normalizeCompiledRuntimeInterventionPlan(rawPlan) {
  const normalizedPlan = normalizeInterventionPlan(rawPlan);
  const rawFilterPlan = isPlainObject(rawPlan) ? rawPlan.filterPlan : undefined;
  return {
    ...normalizedPlan,
    filterPlan: requireCompiledRuntimeFilterPlan(rawFilterPlan),
  };
}

export function projectCompiledRuntimeSocialMetricsSetting(rawFilterPlan) {
  const compiledFilterPlan = requireCompiledRuntimeFilterPlan(rawFilterPlan);
  const socialMetricsEntry = compiledFilterPlan.socialMetrics;
  if (!socialMetricsEntry) {
    throw new Error('COMPILED_RUNTIME_FILTER_ENTRY_REQUIRED:socialMetrics');
  }
  return {
    isActive: socialMetricsEntry.isActive,
    value: { ...socialMetricsEntry.value },
  };
}

const COMPILED_FILTER_TELEMETRY_BASE = Object.freeze(
  FEATURE_KEYS.reduce((acc, featureKey) => {
    const defaultEntry = CONFIG_DEFAULT_FILTER_SETTINGS[featureKey];
    if (!isPlainObject(defaultEntry)) {
      throw new Error(`COMPILED_RUNTIME_FILTER_DEFAULT_MISSING:${featureKey}`);
    }

    if (isAdaptiveFrictionFeatureKey(featureKey)) {
      acc[featureKey] = Object.freeze(materializeAdaptiveFrictionEntry(featureKey, { ...defaultEntry, isActive: false }));
    } else if (featureKey === 'socialMetrics') {
      acc[featureKey] = Object.freeze({
        isActive: false,
        value: Object.freeze({ ...SOCIAL_METRIC_OPTION_DEFAULTS }),
      });
    } else {
      acc[featureKey] = Object.freeze({ isActive: false });
    }
    return acc;
  }, {}),
);

export function projectCompiledRuntimeFilterPlanForTelemetry(rawFilterPlan) {
  const compiledFilterPlan = requireCompiledRuntimeFilterPlan(rawFilterPlan);
  const projection = FEATURE_KEYS.reduce((acc, featureKey) => {
    acc[featureKey] = { ...COMPILED_FILTER_TELEMETRY_BASE[featureKey] };
    return acc;
  }, {});

  Object.entries(compiledFilterPlan).forEach(([featureKey, entry]) => {
    if (isAdaptiveFrictionFeatureKey(featureKey)) {
      projection[featureKey] = {
        isActive: entry.isActive,
        band: entry.band,
        value: entry.value,
        ...(isVisualFrictionProfileKey(featureKey) ? { strength: entry.strength, effectiveStrength: entry.effectiveStrength } : {}),
      };
      return;
    }
    if (featureKey === 'socialMetrics') {
      projection[featureKey] = {
        isActive: entry.isActive,
        value: { ...entry.value },
      };
      return;
    }
    projection[featureKey] = { isActive: entry.isActive };
  });

  return projection;
}
