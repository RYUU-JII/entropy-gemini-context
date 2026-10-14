import { TRACKING_DOMAIN_SESSION_PHASES, requireStoredDomainSession } from './trackingDomainSessionCheckpoint.js';

export function createTrackingSessionDurationRecorder({
  statsCollector,
} = {}) {
  async function recordSessionDuration(
    sessionCommit,
    { skipCacheLoad = false } = {},
  ) {
    const pendingCommit = requireStoredDomainSession(sessionCommit);
    if (pendingCommit.phase !== TRACKING_DOMAIN_SESSION_PHASES.PENDING_COMMIT) {
      const error = new Error('TRACKING_SESSION_DURATION_PENDING_COMMIT_REQUIRED');
      error.code = 'TRACKING_SESSION_DURATION_PENDING_COMMIT_REQUIRED';
      throw error;
    }
    const {
      durationMs,
      endedAt,
      hostname,
      sessionId,
      startedAt,
      targetDateStr,
    } = pendingCommit;
    return statsCollector.recordDaySession({
      durationMs,
      endedAt,
      hostname,
      now: endedAt,
      sessionId,
      skipCacheLoad,
      startedAt,
      dateStr: targetDateStr,
    });
  }

  return {
    recordSessionDuration,
  };
}
