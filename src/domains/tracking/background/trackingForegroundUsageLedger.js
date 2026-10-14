import { getHostname } from '../../../lib/index.js';
import { resolveCollectionPolicySnapshot } from '../../settings/config/dataCollectionPolicy.js';
import { isTrackableTabUrl } from '../../stats/background/collection/tabActivityCollector.js';
import {
  createPreviousTabSettlementDiagnostic,
  normalizeTabId,
} from './trackingTabActivityBatchDiagnostics.js';
import { TRACKING_DOMAIN_SESSION_PHASES } from './trackingDomainSessionCheckpoint.js';
import { createForegroundResumeReconciler } from './trackingForegroundResumeReconciler.js';
import { createTrackingForegroundSegmentSealer } from './trackingForegroundSegmentSealer.js';

export function createTrackingForegroundUsageLedger({
  consumptionLedger,
  resolveConsumptionScope,
  settingsService,
  statsCollector,
  activeTabRuntimeState,
  domainSessionRuntimeState,
  idleDetector,
  shouldTrackHostname,
  resolveTimedFilteringMode,
  resolveStatsCategoryIdFromModeState,
  getExtensionId = () => '',
  statsRuntimeHealthLedger,
} = {}) {
  if (
    !domainSessionRuntimeState
    || typeof domainSessionRuntimeState.startActiveSession !== 'function'
    || typeof domainSessionRuntimeState.abandonActiveSession !== 'function'
    || typeof domainSessionRuntimeState.getSessionCursor !== 'function'
  ) {
    throw new Error('TRACKING_FOREGROUND_USAGE_LEDGER_DOMAIN_SESSION_STATE_REQUIRED');
  }
  const resolveNow = (value) => (Number.isFinite(Number(value)) ? Number(value) : Date.now());

  const isStarted = (activeTabInfo) => {
    const startedAt = activeTabInfo?.startedAt;
    return startedAt !== null
      && typeof startedAt !== 'undefined'
      && Number.isFinite(Number(startedAt));
  };

  const {
    getLastPreviousTabSettlementDiagnostic,
    rememberDiagnostic,
    sealCurrentSegment,
  } = createTrackingForegroundSegmentSealer({
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
    isSegmentStarted: isStarted,
  });

  /**
   * `startActiveSession` refuses to replace a live cursor, and this function
   * owns the only call to it. Callers decide whether to finalize first by
   * comparing the *active tab info* hostname, which is a different store: that
   * one moves on every observed tab, while the cursor only moves when a
   * foreground segment actually opens. A single observation that opens no
   * segment separates them, and from then on the callers' comparison reads
   * equal and skips the finalize this needs. So the precondition is verified
   * here, against the cursor itself, before it can be violated.
   *
   * Runs before the incoming tab is written into the active tab info, so the
   * segment being sealed is still the outgoing one.
   */
  async function settleDivergedDomainSessionCursor(nextHostname, openedAt) {
    const sessionCursor = domainSessionRuntimeState.getSessionCursor();
    if (!sessionCursor || sessionCursor.hostname === nextHostname) return null;
    // A commit in flight is a different invariant - undrained, not diverged -
    // and startActiveSession raises it by name. Leave it to do that.
    if (sessionCursor.phase === TRACKING_DOMAIN_SESSION_PHASES.PENDING_COMMIT) return null;

    const activeTabInfo = activeTabRuntimeState.getActiveTabInfo();
    // The segment carries the time, so bank it before the cursor goes.
    await sealCurrentSegment({
      now: openedAt,
      reopen: false,
      reason: 'domain_session_cursor_divergence',
    });
    // When this session actually ended is unknowable here - it lapsed silently
    // somewhere between the last opened segment and now - so it is abandoned
    // rather than finalized against a fabricated end. Same answer the resume
    // reconciler gives to the same ambiguity.
    await domainSessionRuntimeState.abandonActiveSession(sessionCursor.sessionId);
    return rememberDiagnostic(createPreviousTabSettlementDiagnostic({
      status: 'watch',
      code: 'domain_session_cursor_divergence',
      targetTabId: normalizeTabId(activeTabInfo?.tabId),
      hostname: sessionCursor.hostname,
      attemptedAt: openedAt,
      elapsedMs: openedAt - Number(sessionCursor.startedAt),
      message: `active_info=${activeTabInfo?.hostname || 'none'} incoming=${nextHostname}`,
    }));
  }

  async function openForegroundTab(tab, now = Date.now(), { foregroundObserved = false } = {}) {
    const openedAt = resolveNow(now);
    const url = typeof tab?.url === 'string' ? tab.url : '';
    const hostname = getHostname(url);
    const extensionId = getExtensionId();
    const isTrackable = !!(
      hostname
      && isTrackableTabUrl(url, { extensionId })
      && hostname !== extensionId
    );

    if (!isTrackable) {
      await activeTabRuntimeState.updateUntrackedActiveTabInfo(tab || null, openedAt);
      await domainSessionRuntimeState.abandonActiveSession();
      return { opened: false, hostname: null, reason: 'not_trackable' };
    }

    await settingsService.ensureSettingsCache();
    const settingsCache = settingsService.getSettingsCache();
    if (!shouldTrackHostname(hostname, settingsCache)) {
      await activeTabRuntimeState.updateUntrackedActiveTabInfo(tab, openedAt);
      await domainSessionRuntimeState.abandonActiveSession();
      return { opened: false, hostname, reason: 'policy_rejected' };
    }

    await settleDivergedDomainSessionCursor(hostname, openedAt);

    const shouldStart = foregroundObserved === true || idleDetector.isActive() || !!tab.audible;
    await activeTabRuntimeState.updateActiveTabInfo(tab, openedAt, {
      foregroundObserved: shouldStart,
    });
    const activeInfo = activeTabRuntimeState.getActiveTabInfo();
    if (isStarted(activeInfo)) {
      await domainSessionRuntimeState.startActiveSession(hostname, Number(activeInfo.startedAt));
      return { opened: true, hostname, reason: 'started' };
    }
    return { opened: false, hostname, reason: 'not_started' };
  }

  async function sealActiveSegment(
    now = Date.now(),
    {
      reopen = true,
      reason = 'foreground_segment_heartbeat',
      skipCacheLoad = false,
      dateStr = null,
    } = {},
  ) {
    const diagnostic = await sealCurrentSegment({
      now,
      reopen,
      reason,
      skipCacheLoad,
      dateStr,
    });
    return {
      hostname: diagnostic.status === 'pass' ? diagnostic.hostname : null,
      elapsed: diagnostic.status === 'pass' ? diagnostic.elapsedMs : 0,
      diagnostic,
    };
  }

  const reconcileForegroundSegmentForObservedTab = createForegroundResumeReconciler({
    getActiveTabInfo: activeTabRuntimeState.getActiveTabInfo,
    setActiveTabSegmentStartedAt: activeTabRuntimeState.setActiveTabSegmentStartedAt,
    abandonActiveSession: domainSessionRuntimeState.abandonActiveSession,
    getActiveSessionCursor: domainSessionRuntimeState.getSessionCursor,
    startActiveSession: domainSessionRuntimeState.startActiveSession,
    sealCurrentSegment,
    rememberDiagnostic,
    isSegmentStarted: isStarted,
    resolveNow,
  });

  async function settlePreviousTab(nowOverride = null, lastActiveTabIdOverride = null) {
    const targetTabId = normalizeTabId(lastActiveTabIdOverride) ?? normalizeTabId(activeTabRuntimeState.getLastActiveTabId());
    const diagnostic = await sealCurrentSegment({
      now: resolveNow(nowOverride),
      expectedTabId: targetTabId,
      reopen: false,
      reason: 'settle_previous_tab',
    });
    return diagnostic.status === 'pass';
  }

  async function primeActiveTrackingBoundary(now = Date.now()) {
    // Settings propagation is not a browser observation. Read the active
    // owner only after hydration, and never open or retime a segment here.
    await settingsService.ensureSettingsCache();
    const activeTabInfo = activeTabRuntimeState.getActiveTabInfo();
    if (!activeTabInfo || !activeTabInfo.hostname) {
      return { primed: false, hostname: null };
    }

    const settingsCache = settingsService.getSettingsCache();
    const hostname = activeTabInfo.hostname;
    if (!shouldTrackHostname(hostname, settingsCache)) {
      await sealCurrentSegment({ now: resolveNow(now), reopen: false, reason: 'settings_collection_boundary' });
      return { primed: false, hostname };
    }
    // An admitted live segment keeps its unsealed prefix. A closed segment
    // needs the ordinary foreground observer to reopen, even if OS idle is active.
    return { primed: isStarted(activeTabInfo), hostname };
  }

  async function primeNewDayAt(
    startOfDayTs,
    { dateStr = null, skipCacheLoad = false } = {},
  ) {
    const activeTabInfo = activeTabRuntimeState.getActiveTabInfo();
    const hostname = activeTabInfo?.hostname;
    const settingsCache = settingsService.getSettingsCache();
    const collectionPolicy = resolveCollectionPolicySnapshot(settingsCache);
    if (hostname && shouldTrackHostname(hostname, settingsCache)) {
      await statsCollector.touchDomainTrackPoint({
        hostname,
        now: startOfDayTs,
        dateStr,
        skipCacheLoad,
        collectionPolicy,
      });
    }
    if (activeTabInfo) {
      const shouldStart = idleDetector.isActive() || activeTabInfo.audible;
      await activeTabRuntimeState.setActiveTabSegmentStartedAt(shouldStart ? startOfDayTs : null);
      if (shouldStart && hostname && shouldTrackHostname(hostname, settingsCache)) {
        await domainSessionRuntimeState.startActiveSession(hostname, startOfDayTs);
      } else {
        await domainSessionRuntimeState.abandonActiveSession();
      }
    }
  }

  return {
    getLastPreviousTabSettlementDiagnostic,
    openForegroundTab,
    primeActiveTrackingBoundary,
    primeNewDayAt,
    reconcileForegroundSegmentForObservedTab,
    sealActiveSegment,
    sealCurrentSegment,
    settlePreviousTab,
  };
}
