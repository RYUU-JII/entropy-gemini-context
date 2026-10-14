import { getHostname } from '../../../lib/index.js';
import {
  createPreviousTabSettlementDiagnostic,
  normalizeTabId,
} from './trackingTabActivityBatchDiagnostics.js';

export function createForegroundResumeReconciler({
  getActiveTabInfo,
  setActiveTabSegmentStartedAt,
  abandonActiveSession,
  getActiveSessionCursor,
  startActiveSession,
  sealCurrentSegment,
  rememberDiagnostic,
  isSegmentStarted,
  resolveNow,
} = {}) {
  if (
    typeof getActiveTabInfo !== 'function'
    || typeof setActiveTabSegmentStartedAt !== 'function'
    || typeof abandonActiveSession !== 'function'
    || typeof getActiveSessionCursor !== 'function'
    || typeof startActiveSession !== 'function'
    || typeof sealCurrentSegment !== 'function'
    || typeof rememberDiagnostic !== 'function'
    || typeof isSegmentStarted !== 'function'
    || typeof resolveNow !== 'function'
  ) {
    throw new Error('TRACKING_FOREGROUND_RESUME_RECONCILER_DEPENDENCIES_REQUIRED');
  }

  return async function reconcileForegroundSegmentForObservedTab(
    tab,
    now = Date.now(),
    { foregroundObserved = false, reason = 'foreground_segment_reconcile' } = {},
  ) {
    const attemptedAt = resolveNow(now);
    const activeTabInfo = getActiveTabInfo();
    const sessionCursor = getActiveSessionCursor();
    if (sessionCursor?.phase === 'pending_commit') {
      const error = new Error('TRACKING_DOMAIN_SESSION_PENDING_COMMIT_NOT_DRAINED');
      error.code = 'TRACKING_DOMAIN_SESSION_PENDING_COMMIT_NOT_DRAINED';
      throw error;
    }
    if (!activeTabInfo || !activeTabInfo.hostname || !isSegmentStarted(activeTabInfo)) {
      if (sessionCursor) {
        await abandonActiveSession();
      }
      return { reconciled: false, action: 'none', diagnostic: null };
    }

    const targetTabId = normalizeTabId(activeTabInfo.tabId);
    const observedTabId = normalizeTabId(tab?.id);
    const observedHostname = getHostname(typeof tab?.url === 'string' ? tab.url : '');
    if (
      foregroundObserved === true
      && targetTabId !== null
      && observedTabId === targetTabId
      && observedHostname === activeTabInfo.hostname
    ) {
      if (
        sessionCursor
        && (
          sessionCursor.hostname !== activeTabInfo.hostname
          || sessionCursor.startedAt > Number(activeTabInfo.startedAt)
        )
      ) {
        await setActiveTabSegmentStartedAt(null);
        await abandonActiveSession();
        const diagnostic = rememberDiagnostic(createPreviousTabSettlementDiagnostic({
          status: 'watch',
          code: 'domain_session_resume_identity_mismatch',
          targetTabId,
          hostname: activeTabInfo.hostname,
          attemptedAt,
          elapsedMs: attemptedAt - Number(activeTabInfo.startedAt),
          message: reason,
        }));
        return { reconciled: false, action: 'ambiguous', diagnostic };
      }
      if (!sessionCursor) {
        await startActiveSession(activeTabInfo.hostname, Number(activeTabInfo.startedAt));
      }
      const diagnostic = await sealCurrentSegment({
        now: attemptedAt,
        expectedTabId: targetTabId,
        reopen: false,
        reason,
      });
      return { reconciled: diagnostic.status === 'pass', action: 'sealed', diagnostic };
    }

    const startedAt = Number(activeTabInfo.startedAt);
    await setActiveTabSegmentStartedAt(null);
    await abandonActiveSession();
    const diagnostic = rememberDiagnostic(createPreviousTabSettlementDiagnostic({
      status: 'watch',
      code: 'foreground_segment_resume_ambiguous',
      targetTabId,
      hostname: activeTabInfo.hostname,
      attemptedAt,
      elapsedMs: attemptedAt - startedAt,
      message: reason,
    }));
    return { reconciled: false, action: 'ambiguous', diagnostic };
  };
}
