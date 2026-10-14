import { ensureNumber } from '../../../lib/index.js';
import { resolveDomainBlockState } from '../../settings/config/blockingPolicy.js';
import { resolveCollectionPolicySnapshot } from '../../settings/config/dataCollectionPolicy.js';

export function createApplyBackgroundTabTimeWithCollection({
  settingsService,
  idleDetector,
  shouldTrackHostname,
  resolveTimedFilteringMode,
  resolveStatsCategoryIdFromModeState,
  longGapLimitMs = 60 * 60 * 1000,
} = {}) {
  return async function applyBackgroundTabTimeWithCollection(
    collection,
    hostname,
    now,
    blockedUrlsOverride = null,
    {
      idleOverride = false,
      backgroundPressure = null,
      settingsCacheOverride = null,
      idleStateOverride = null,
    } = {},
  ) {
    if (!settingsCacheOverride) {
      await settingsService.ensureSettingsCache();
    }
    const settingsCache = settingsCacheOverride || settingsService.getSettingsCache();
    if (!shouldTrackHostname(hostname, settingsCache)) {
      return false;
    }
    const collectionPolicy = resolveCollectionPolicySnapshot(settingsCache);

    const {
      domainData,
      created,
      activeCommittedThroughAt,
      lastTrackedTime,
    } = collection.ensureDomainTrackingState({
      hostname,
      now,
      collectionPolicy,
    });
    if (!domainData) return false;
    if (created) return true;

    const lastTime = Math.max(
      ensureNumber(lastTrackedTime),
      ensureNumber(activeCommittedThroughAt),
    );

    if (lastTime === 0 || lastTime > now) {
      console.log(`[TabTimeTracker] Initializing time for ${hostname}`);
      collection.touchDomainTrackPoint({
        hostname,
        now,
        collectionPolicy,
      });
      return true;
    }

    const elapsed = now - lastTime;
    if (elapsed > longGapLimitMs) {
      console.log(`[TabTimeTracker] Gap too large (${Math.round(elapsed / 1000)}s) for ${hostname}, skipping.`);
      collection.touchDomainTrackPoint({
        hostname,
        now,
        collectionPolicy,
      });
      return true;
    }

    const idleStateNow = typeof idleStateOverride === 'string'
      ? idleStateOverride
      : idleDetector.getCurrentIdleState();
    if (idleStateNow !== 'active' && !idleOverride) {
      if (lastTime !== now) {
        collection.touchDomainTrackPoint({
          hostname,
          now,
          collectionPolicy,
        });
        return true;
      }
      return false;
    }

    if (elapsed < 100) return false;

    const effectiveStart = now - elapsed;
    const blockedUrls = Array.isArray(blockedUrlsOverride)
      ? blockedUrlsOverride
      : settingsCache.blockedUrls;
    const modeState = resolveDomainBlockState({
      hostname,
      blockedUrls,
      allowedUrls: settingsCache.allowedUrls,
      filteringMode: resolveTimedFilteringMode(settingsCache, now),
    });

    const result = collection.recordDomainElapsed({
      hostname,
      elapsedMs: elapsed,
      isActive: false,
      now,
      startTs: effectiveStart,
      isBlockedDomain: !!modeState.isBlockedDomain,
      categoryId: resolveStatsCategoryIdFromModeState(modeState),
      collectionPolicy,
    });

    if (typeof collection.recordDomainBackgroundPressure === 'function') {
      const pressure = backgroundPressure && typeof backgroundPressure === 'object'
        ? backgroundPressure
        : { mediaMs: 0, lingerMs: 0, staleMs: 0 };
      collection.recordDomainBackgroundPressure({
        hostname,
        mediaMs: pressure.mediaMs,
        lingerMs: pressure.lingerMs,
        staleMs: pressure.staleMs,
        now,
        startTs: effectiveStart,
      });
    }

    return !!result?.applied;
  };
}
