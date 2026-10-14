import { resolveDomainBlockState } from '../../settings/config/blockingPolicy.js';
import { resolveCollectionPolicySnapshot } from '../../settings/config/dataCollectionPolicy.js';
import {
  clonePreviousTabSettlementDiagnostic,
  createPreviousTabSettlementDiagnostic,
  normalizeTabId,
} from './trackingTabActivityBatchDiagnostics.js';

function requireForegroundSegmentSealerOwner(owner, methodName, errorCode) {
  if (!owner || typeof owner[methodName] !== 'function') throw new Error(errorCode);
}

export function createTrackingForegroundSegmentSealer({
  consumptionLedger,
  resolveConsumptionScope,
  settingsService,
  statsCollector,
  activeTabRuntimeState,
  domainSessionRuntimeState,
  shouldTrackHostname,
  resolveTimedFilteringMode,
  resolveStatsCategoryIdFromModeState,
  statsRuntimeHealthLedger,
  resolveNow,
  isSegmentStarted,
} = {}) {
  requireForegroundSegmentSealerOwner(consumptionLedger, 'recordForegroundSegment', 'TRACKING_CONSUMPTION_LEDGER_REQUIRED');
  requireForegroundSegmentSealerOwner(consumptionLedger, 'closeForegroundContext', 'TRACKING_CONSUMPTION_LEDGER_REQUIRED');
  if (typeof resolveConsumptionScope !== 'function') throw new Error('TRACKING_CONSUMPTION_SCOPE_OWNER_REQUIRED');
  requireForegroundSegmentSealerOwner(
    statsRuntimeHealthLedger,
    'recordActiveSealDiagnostic',
    'TRACKING_FOREGROUND_USAGE_LEDGER_RUNTIME_HEALTH_REQUIRED',
  );
  requireForegroundSegmentSealerOwner(
    statsCollector,
    'prepareCollectionBoundary',
    'TRACKING_FOREGROUND_USAGE_LEDGER_COLLECTION_BOUNDARY_REQUIRED',
  );

  let lastPreviousTabSettlementDiagnostic = null;
  let foregroundSealTail = Promise.resolve();

  function rememberDiagnostic(diagnostic) {
    lastPreviousTabSettlementDiagnostic = diagnostic;
    try {
      statsRuntimeHealthLedger.recordActiveSealDiagnostic({ diagnostic });
    } catch (error) {
      console.warn('[TrackingForegroundUsageLedger] Failed to record active seal health:', error);
    }
    return diagnostic;
  }

  function getLastPreviousTabSettlementDiagnostic() {
    return clonePreviousTabSettlementDiagnostic(lastPreviousTabSettlementDiagnostic);
  }

  async function sealCurrentSegmentOwned({
    now,
    expectedTabId = null,
    reason = 'foreground_segment_seal',
    reopen = false,
    skipCacheLoad = false,
    dateStr = null,
  } = {}) {
    const attemptedAt = resolveNow(now);
    await settingsService.ensureSettingsCache();
    const activeTabInfo = activeTabRuntimeState.getActiveTabInfo();
    const expectedNormalizedTabId = normalizeTabId(expectedTabId);
    const activeInfoTabId = normalizeTabId(activeTabInfo?.tabId);
    const targetTabId = expectedNormalizedTabId !== null ? expectedNormalizedTabId : activeInfoTabId;
    const hostname = typeof activeTabInfo?.hostname === 'string' && activeTabInfo.hostname
      ? activeTabInfo.hostname
      : null;

    if (!activeTabInfo || !hostname) {
      return rememberDiagnostic(createPreviousTabSettlementDiagnostic({
        status: expectedNormalizedTabId !== null ? 'watch' : 'skipped',
        code: 'foreground_segment_missing',
        targetTabId,
        attemptedAt,
      }));
    }
    if (expectedNormalizedTabId !== null && activeInfoTabId !== expectedNormalizedTabId) {
      return rememberDiagnostic(createPreviousTabSettlementDiagnostic({
        status: 'fail',
        code: 'foreground_segment_tab_mismatch',
        targetTabId,
        hostname,
        attemptedAt,
        message: `active=${activeInfoTabId}`,
      }));
    }
    const settingsCache = settingsService.getSettingsCache();
    if (!shouldTrackHostname(hostname, settingsCache)) {
      const cursor = domainSessionRuntimeState.getSessionCursor();
      // Queue both retirements before yielding; a later observation cannot
      // have its new session abandoned by this settings boundary.
      await Promise.all([
        activeTabRuntimeState.setActiveTabSegmentStartedAt(null),
        cursor ? domainSessionRuntimeState.abandonActiveSession(cursor.sessionId) : Promise.resolve(),
      ]);
      return rememberDiagnostic(createPreviousTabSettlementDiagnostic({
        status: 'skipped',
        code: 'foreground_segment_policy_rejected',
        targetTabId,
        hostname,
        attemptedAt,
        elapsedMs: isSegmentStarted(activeTabInfo) ? attemptedAt - Number(activeTabInfo.startedAt) : 0,
      }));
    }
    if (!isSegmentStarted(activeTabInfo)) {
      return rememberDiagnostic(createPreviousTabSettlementDiagnostic({
        status: 'watch',
        code: 'foreground_segment_not_started',
        targetTabId,
        hostname,
        attemptedAt,
      }));
    }

    const startedAt = Number(activeTabInfo.startedAt);
    const elapsed = attemptedAt - startedAt;
    if (elapsed <= 0) {
      if (elapsed === 0 && !reopen) {
        await consumptionLedger.closeForegroundContext({ tabId: activeInfoTabId, hostname, at: attemptedAt });
      }
      await activeTabRuntimeState.setActiveTabSegmentStartedAt(reopen ? attemptedAt : null);
      return rememberDiagnostic(createPreviousTabSettlementDiagnostic({
        status: 'watch',
        code: 'foreground_segment_non_positive_elapsed',
        targetTabId,
        hostname,
        attemptedAt,
        elapsedMs: elapsed,
      }));
    }

    const collectionPolicy = resolveCollectionPolicySnapshot(settingsCache);
    const blockedState = resolveDomainBlockState({
      hostname,
      blockedUrls: settingsCache.blockedUrls,
      allowedUrls: settingsCache.allowedUrls,
      filteringMode: resolveTimedFilteringMode(settingsCache, attemptedAt),
    });
    const consumptionScope = await resolveConsumptionScope({ hostname, settings: settingsCache, now: attemptedAt });
    if (!consumptionScope || typeof consumptionScope.ok !== 'boolean'
      || typeof consumptionScope.isBlockedDomain !== 'boolean') throw new Error('TRACKING_CONSUMPTION_SCOPE_INVALID');
    const result = await statsCollector.recordDomainElapsed({
      hostname,
      elapsedMs: elapsed,
      isActive: true,
      recordActiveIntervals: consumptionScope.ok && consumptionScope.isBlockedDomain,
      now: attemptedAt,
      startTs: startedAt,
      isBlockedDomain: consumptionScope.ok && consumptionScope.isBlockedDomain,
      categoryId: resolveStatsCategoryIdFromModeState(blockedState),
      collectionPolicy,
      skipCacheLoad,
      dateStr,
    });

    if (result?.applied && !Number.isFinite(Number(result.appliedElapsedMs))) {
      const error = new Error('TRACKING_FOREGROUND_APPLIED_ELAPSED_REQUIRED');
      error.code = 'TRACKING_FOREGROUND_APPLIED_ELAPSED_REQUIRED';
      throw error;
    }
    const appliedElapsed = result?.applied ? Math.max(0, Number(result.appliedElapsedMs)) : 0;
    const segmentSettled = !!result?.applied || result?.coveredByActiveCommitCursor === true;
    if (segmentSettled) {
      // Stats durable ACK -> derived fact checkpoint -> active cursor advance.
      // A failed derived write leaves the source cursor available for replay;
      // the ledger's watermark also handles an already-committed stats retry.
      await consumptionLedger.recordForegroundSegment({
        tabId: activeInfoTabId,
        hostname,
        startedAt,
        endedAt: attemptedAt,
        isProtected: consumptionScope.ok && consumptionScope.isBlockedDomain,
        audible: activeTabInfo.audible,
        closed: !reopen,
      });
    }
    await activeTabRuntimeState.setActiveTabSegmentStartedAt(
      reopen && segmentSettled ? attemptedAt : null,
    );

    return rememberDiagnostic(createPreviousTabSettlementDiagnostic({
      status: segmentSettled ? 'pass' : 'watch',
      code: segmentSettled ? 'foreground_segment_closed' : 'foreground_segment_no_change',
      targetTabId,
      hostname,
      attemptedAt,
      elapsedMs: appliedElapsed,
      message: reason,
    }));
  }

  async function sealCurrentSegment(options = {}) {
    let ownedOptions = options;
    if (options?.skipCacheLoad !== true) {
      const prepared = await statsCollector.prepareCollectionBoundary({ now: options?.now });
      ownedOptions = {
        ...options,
        dateStr: prepared.dateStr,
        skipCacheLoad: true,
      };
    }
    const operation = foregroundSealTail.then(
      () => sealCurrentSegmentOwned(ownedOptions),
      () => sealCurrentSegmentOwned(ownedOptions),
    );
    foregroundSealTail = operation.catch(() => undefined);
    return operation;
  }

  return {
    getLastPreviousTabSettlementDiagnostic,
    rememberDiagnostic,
    sealCurrentSegment,
  };
}
