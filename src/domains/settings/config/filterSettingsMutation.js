import { CONFIG_DEFAULT_FILTER_SETTINGS, normalizeFilterSettings } from './index.js';

function isRecord(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function requirePatch(value, shape, path) {
  if (!isRecord(value)) throw new Error(`FILTER_SETTINGS_PATCH_INVALID:${path}`);
  for (const [key, entry] of Object.entries(value)) {
    if (!Object.hasOwn(shape, key)) throw new Error(`FILTER_SETTINGS_PATCH_KEY_UNKNOWN:${path}.${key}`);
    if (typeof entry === 'undefined') throw new Error(`FILTER_SETTINGS_PATCH_INVALID:${path}.${key}`);
    if (isRecord(shape[key])) {
      requirePatch(entry, shape[key], `${path}.${key}`);
    } else if (key === 'isActive' && typeof entry !== 'boolean') {
      throw new Error(`FILTER_SETTINGS_PATCH_INVALID:${path}.${key}`);
    }
  }
  return value;
}

function mergeRecords(previous, next) {
  const result = { ...previous };
  for (const [key, value] of Object.entries(next)) {
    result[key] = isRecord(value)
      ? mergeRecords(isRecord(previous[key]) ? previous[key] : {}, value)
      : value;
  }
  return result;
}

// The runtime command carries only changed feature fields. Composing pending
// intents preserves unrelated edits; canonical storage/ACKs remain full snapshots.
export function mergeFilterSettingsMutationPatches(previous, next) {
  requirePatch(previous, CONFIG_DEFAULT_FILTER_SETTINGS, 'filterSettings');
  requirePatch(next, CONFIG_DEFAULT_FILTER_SETTINGS, 'filterSettings');
  return mergeRecords(previous, next);
}

export function applyFilterSettingsMutationPatch(current, patch) {
  if (!isRecord(current)) throw new Error('FILTER_SETTINGS_MUTATION_BASE_REQUIRED');
  requirePatch(patch, CONFIG_DEFAULT_FILTER_SETTINGS, 'filterSettings');
  return normalizeFilterSettings(mergeRecords(normalizeFilterSettings(current), patch));
}

function changedFields(previous, next) {
  const patch = {};
  for (const [key, value] of Object.entries(next)) {
    if (isRecord(value)) {
      const nested = changedFields(previous[key], value);
      if (Object.keys(nested).length > 0) patch[key] = nested;
    } else if (!Object.is(previous[key], value)) {
      patch[key] = value;
    }
  }
  return patch;
}

export function createFilterSettingsMutationPatch(previous, next) {
  return changedFields(normalizeFilterSettings(previous), normalizeFilterSettings(next));
}
