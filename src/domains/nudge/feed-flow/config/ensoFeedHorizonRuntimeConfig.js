import { ENSO_INTERVAL_PRESETS, DEFAULT_ENSO_INTERVAL_PRESET } from '../../../settings/config/ensoIntervalPolicy.js';

export const ENSO_FEED_HORIZON_RUNTIME_CONFIG_VERSION = 'enso-feed-horizon-runtime-config-v4';
const MODES = new Set(['auto', 'continuous', 'paged', 'hybrid']);
function exact(value, keys, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value)
    || Object.keys(value).length !== keys.length || keys.some((key) => !Object.hasOwn(value, key))) {
    throw new Error('ENSO_FEED_CONFIG_SHAPE_INVALID:' + label);
  }
}
export function requireEnsoFeedHorizonRuntimeConfig(value) {
  exact(value, ['contractVersion', 'intervalMs', 'sensing', 'inhibitors'], 'root');
  if (value.contractVersion !== ENSO_FEED_HORIZON_RUNTIME_CONFIG_VERSION) throw new Error('ENSO_FEED_CONFIG_VERSION_INVALID');
  if (!Object.values(ENSO_INTERVAL_PRESETS).includes(value.intervalMs)) throw new Error('ENSO_FEED_INTERVAL_INVALID');
  exact(value.sensing, ['mode', 'paged'], 'sensing');
  exact(value.sensing.paged, ['requireRecentGesture'], 'paged');
  exact(value.inhibitors, ['intentionalityWindowMs', 'backtrackWindowMs'], 'inhibitors');
  if (!MODES.has(value.sensing.mode) || typeof value.sensing.paged.requireRecentGesture !== 'boolean') throw new Error('ENSO_FEED_OBSERVATION_CONFIG_INVALID');
  for (const key of ['intentionalityWindowMs', 'backtrackWindowMs']) {
    if (value.inhibitors[key] !== 12_000) throw new Error('ENSO_FEED_INHIBITOR_INVALID:' + key);
  }
  return value;
}
export function buildEnsoFeedHorizonRuntimeConfig({ intervalMs = ENSO_INTERVAL_PRESETS[DEFAULT_ENSO_INTERVAL_PRESET] } = {}) {
  const config = { contractVersion: ENSO_FEED_HORIZON_RUNTIME_CONFIG_VERSION, intervalMs,
    sensing: Object.freeze({ mode: 'auto', paged: Object.freeze({ requireRecentGesture: true }) }),
    inhibitors: Object.freeze({ intentionalityWindowMs: 12_000, backtrackWindowMs: 12_000 }) };
  requireEnsoFeedHorizonRuntimeConfig(config);
  return Object.freeze(config);
}
export const DEFAULT_ENSO_FEED_HORIZON_RUNTIME_CONFIG = buildEnsoFeedHorizonRuntimeConfig();
