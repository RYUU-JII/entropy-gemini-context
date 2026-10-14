import {
  FEED_CONTENT_FLOW_COUNT_FIELDS,
  FEED_CONTENT_FLOW_MAX_FIELDS,
  FEED_CONTENT_FLOW_PROGRESS_FIELDS,
  FEED_CONTENT_FLOW_STAT_FIELDS,
  buildContentFlowStatsFromFeedSnapshotDelta,
  createEmptyFeedContentFlowStats,
  getFeedContentFlowHourStart,
  requireFeedContentFlowHistory,
} from '../../../stats/contracts/feedContentFlowHistory.js';
import { createRandomUuid } from '../../../../lib/randomUuid.js';

export class FeedContentFlowHistoryAccumulator {
  constructor({ createProducerId = createRandomUuid } = {}) {
    if (typeof createProducerId !== 'function') {
      throw new Error('FEED_CONTENT_FLOW_HISTORY_PRODUCER_FACTORY_REQUIRED');
    }
    this._createProducerId = createProducerId;
    this._allowed = false;
    this._producerId = null;
    this._history = null;
    this._sequence = 0;
    this._lastHistoryResetAt = -1;
    this.clearObservationBaseline();
  }

  setHistoryAllowed(allowed) {
    if (typeof allowed !== 'boolean') {
      throw new Error('FEED_CONTENT_FLOW_HISTORY_PERMISSION_INVALID');
    }
    if (allowed === this._allowed) return false;
    this._beginHistoryGeneration(allowed);
    this._allowed = allowed;
    return true;
  }

  _beginHistoryGeneration(allowed = this._allowed) {
    const producerId = allowed ? this._createProducerId() : null;
    this._history = null;
    this._sequence = 0;
    this._producerId = producerId;
    // Existing cumulative burst metrics do not become historical facts when
    // consent resumes. Dwell cannot be partitioned, so wait for the next burst.
    this._offsetMetrics = this._latestRawSnapshot?.metrics || null;
    this._dwellEligible = this._latestRawSnapshot === null;
    this._previousProjectedSnapshot = this._latestRawSnapshot
      ? this._projectAllowedSnapshot(this._latestRawSnapshot)
      : null;
  }

  resetHistoryAfterDeletion(resetAt) {
    if (!Number.isSafeInteger(resetAt) || resetAt < 0) {
      throw new Error('FEED_CONTENT_FLOW_HISTORY_RESET_AT_INVALID');
    }
    if (!this._allowed || !this._history || this._history.startedAt > resetAt
      || resetAt <= this._lastHistoryResetAt) return false;
    this._lastHistoryResetAt = resetAt;
    this._beginHistoryGeneration();
    return true;
  }

  _projectAllowedSnapshot(snapshot) {
    const metrics = { ...snapshot.metrics };
    if (this._offsetMetrics) {
      FEED_CONTENT_FLOW_PROGRESS_FIELDS.forEach((field) => {
        metrics[field] = Math.max(0, metrics[field] - this._offsetMetrics[field]);
      });
    }
    if (!this._dwellEligible) metrics.medianDwellMs = null;
    return { state: snapshot.state, metrics };
  }

  observe(snapshot, { burstId = '' } = {}) {
    const bucketStartTs = getFeedContentFlowHourStart(snapshot.checkedAt);
    const priorRaw = this._latestRawSnapshot;
    const burstChanged = Boolean(this._latestBurstId && burstId && this._latestBurstId !== burstId);
    const metricsRegressed = priorRaw && FEED_CONTENT_FLOW_PROGRESS_FIELDS.some((field) => (
      snapshot.metrics[field] < priorRaw.metrics[field]
    ));
    if (burstChanged || metricsRegressed) {
      this._offsetMetrics = null;
      this._dwellEligible = true;
      this._previousProjectedSnapshot = null;
    }
    this._latestRawSnapshot = snapshot;
    this._latestBurstId = burstId;
    if (!this._allowed) return null;
    if (snapshot.checkedAt <= this._lastHistoryResetAt) {
      this._offsetMetrics = snapshot.metrics;
      this._dwellEligible = false;
      this._previousProjectedSnapshot = this._projectAllowedSnapshot(snapshot);
      return null;
    }

    const projected = this._projectAllowedSnapshot(snapshot);
    const delta = buildContentFlowStatsFromFeedSnapshotDelta({
      snapshot: projected,
      previousSnapshot: this._previousProjectedSnapshot,
    });
    this._previousProjectedSnapshot = projected;
    const sameHour = this._history?.bucketStartTs === bucketStartTs;
    const stats = sameHour ? { ...this._history.stats } : createEmptyFeedContentFlowStats();
    FEED_CONTENT_FLOW_COUNT_FIELDS.forEach((field) => { stats[field] += delta[field]; });
    FEED_CONTENT_FLOW_MAX_FIELDS.forEach((field) => {
      stats[field] = Math.max(stats[field], delta[field]);
    });
    const changed = !sameHour || FEED_CONTENT_FLOW_STAT_FIELDS.some((field) => (
      stats[field] !== this._history.stats[field]
    ));
    if (changed) {
      this._sequence += 1;
      this._history = requireFeedContentFlowHistory({
        producerId: this._producerId,
        bucketStartTs,
        startedAt: sameHour ? this._history.startedAt : snapshot.checkedAt,
        observedAt: snapshot.checkedAt,
        sequence: this._sequence,
        stats,
      });
    }
    return requireFeedContentFlowHistory(this._history);
  }

  clearObservationBaseline() {
    this._latestRawSnapshot = null;
    this._latestBurstId = '';
    this._previousProjectedSnapshot = null;
    this._offsetMetrics = null;
    this._dwellEligible = true;
  }
}

export default FeedContentFlowHistoryAccumulator;
