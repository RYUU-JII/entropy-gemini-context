import {
  normalizeSentinelFlareProtocolScope,
  SENTINEL_FLARE_PROTOCOL_SCOPES,
} from '../../nudge/runtime/sentinelFlareProtocolProfile.js';
import { BUILD_INCLUDE_DEBUG_TOOLS } from '../../../platform/build/releaseCapabilities.js';

export const DEFAULT_DEBUG_CONFIG = Object.freeze({
  enabled: false,
  runtimeDebuggerEnabled: false,
  sentinel: Object.freeze({
    defaultProtocolScope: SENTINEL_FLARE_PROTOCOL_SCOPES.SITE,
    hudVisible: false,
    protocolIntensity: 0.62,
  }),
});

const PREDECESSOR_DEBUG_CONFIG_FIELDS = Object.freeze([
  'fieldLauncherEnabled',
  'devTimeOverrideEnabled',
  'devTimeOverrideHour',
]);

function clamp(value, min, max, fallback) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return fallback;
  return Math.max(min, Math.min(max, numeric));
}

export function normalizeDebugConfig(raw, { defaults = DEFAULT_DEBUG_CONFIG } = {}) {
  if (raw && typeof raw === 'object') {
    const predecessorField = PREDECESSOR_DEBUG_CONFIG_FIELDS.find((field) => (
      Object.prototype.hasOwnProperty.call(raw, field)
    ));
    if (predecessorField) {
      throw new Error(`DEBUG_CONFIG_PREDECESSOR_FIELD_FORBIDDEN:${predecessorField}`);
    }
  }
  if (!BUILD_INCLUDE_DEBUG_TOOLS) {
    return {
      enabled: false,
      runtimeDebuggerEnabled: false,
      sentinel: {
        ...DEFAULT_DEBUG_CONFIG.sentinel,
      },
    };
  }

  const source = raw && typeof raw === 'object' ? raw : {};
  const fallback = defaults && typeof defaults === 'object'
    ? defaults
    : DEFAULT_DEBUG_CONFIG;
  const sourceSentinel = source.sentinel && typeof source.sentinel === 'object'
    ? source.sentinel
    : {};
  const fallbackSentinel = fallback.sentinel && typeof fallback.sentinel === 'object'
    ? fallback.sentinel
    : DEFAULT_DEBUG_CONFIG.sentinel;

  return {
    enabled: typeof source.enabled === 'boolean' ? source.enabled : !!fallback.enabled,
    runtimeDebuggerEnabled: typeof source.runtimeDebuggerEnabled === 'boolean'
      ? source.runtimeDebuggerEnabled
      : fallback.runtimeDebuggerEnabled === true,
    sentinel: {
      defaultProtocolScope: normalizeSentinelFlareProtocolScope(
        sourceSentinel.defaultProtocolScope,
        fallbackSentinel.defaultProtocolScope || DEFAULT_DEBUG_CONFIG.sentinel.defaultProtocolScope,
      ),
      hudVisible: typeof sourceSentinel.hudVisible === 'boolean'
        ? sourceSentinel.hudVisible
        : !!fallbackSentinel.hudVisible,
      protocolIntensity: clamp(
        sourceSentinel.protocolIntensity,
        0.35,
        1,
        clamp(fallbackSentinel.protocolIntensity, 0.35, 1, DEFAULT_DEBUG_CONFIG.sentinel.protocolIntensity),
      ),
    },
  };
}
