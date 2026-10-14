// User-owned consumption intervals. These are product starting points, not
// empirically calibrated thresholds or selectable model intensity levels.
export const ENSO_INTERVAL_PRESETS = Object.freeze({
  frequent: 8 * 60_000,
  standard: 12 * 60_000,
  spacious: 20 * 60_000,
});

export const DEFAULT_ENSO_INTERVAL_PRESET = 'standard';

export function resolveEnsoIntervalMs(value) {
  if (typeof value !== 'string' || !Object.hasOwn(ENSO_INTERVAL_PRESETS, value)) {
    throw new Error(`ENSO_INTERVAL_PRESET_INVALID:${String(value)}`);
  }
  return ENSO_INTERVAL_PRESETS[value];
}

export function normalizeEnsoGateEntry(entry) {
  if (!entry || typeof entry !== 'object' || Array.isArray(entry)
    || Object.keys(entry).some((key) => !['isActive', 'value'].includes(key))
    || typeof entry.isActive !== 'boolean') {
    throw new Error('ENSO_GATE_ENTRY_INVALID');
  }
  resolveEnsoIntervalMs(entry.value);
  return { isActive: entry.isActive, value: entry.value };
}
