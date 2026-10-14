import { isHostnameInList } from '../../../lib/index.js';
import { getSentinelFlareNudgeCopy } from '../../../domains/settings/i18n/nudgeCopy.js';
import {
  DEFAULT_NUDGE_RUNTIME_ASSET,
  DEFAULT_NUDGE_RUNTIME_TUNING,
  DEFAULT_NUDGE_SETTINGS,
  normalizeStoredNudgeConfig,
  normalizeNudgeRuntimeConfig,
} from '../../../domains/settings/config/nudgeConfig.js';
import { normalizeNudgeRuntimeContext } from '../../../domains/nudge/runtime/nudgeRuntimeContext.js';

export const DEFAULT_NUDGE_DEBUG_CONFIG = Object.freeze({
  ...DEFAULT_NUDGE_RUNTIME_TUNING,
});

export function isWebUrl(url) {
  return typeof url === 'string' && (url.startsWith('http://') || url.startsWith('https://'));
}

export function normalizeNudgeAutoConfig(raw) {
  return normalizeStoredNudgeConfig(raw, { defaults: DEFAULT_NUDGE_SETTINGS });
}

export function resolveBlockedDomainActiveMs(dayDomains, blockedDomain) {
  if (!dayDomains || typeof dayDomains !== 'object') return 0;
  if (typeof blockedDomain !== 'string' || !blockedDomain.trim()) return 0;

  let total = 0;
  for (const [domain, domainData] of Object.entries(dayDomains)) {
    if (!isHostnameInList(domain, [blockedDomain])) continue;
    total += Math.max(0, Number(domainData?.active) || 0);
  }
  return total;
}

export function buildNudgeDebugConfig(config, runtimeContext = null) {
  const normalizedRuntimeContext = normalizeNudgeRuntimeContext(runtimeContext);
  const sentinelCopy = getSentinelFlareNudgeCopy(normalizedRuntimeContext);
  const defaults = {
    ...DEFAULT_NUDGE_RUNTIME_TUNING,
    asset: DEFAULT_NUDGE_RUNTIME_ASSET,
    protocol: sentinelCopy.protocol,
    message: sentinelCopy.message,
  };
  return normalizeNudgeRuntimeConfig(
    {
      ...config,
      visualThemeId: normalizedRuntimeContext.themeId,
      asset: DEFAULT_NUDGE_RUNTIME_ASSET,
      protocol: sentinelCopy.protocol,
      message: sentinelCopy.message,
    },
    { defaults },
  );
}
