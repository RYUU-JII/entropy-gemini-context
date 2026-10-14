import {
  buildStatsTransitionEdgeKey,
  createEmptyDomainStats,
  createEmptyStatsDay,
  normalizeStatsDomainKey,
  resolveStatsHourlyBucketStartTs,
} from '../../contracts/statsContracts.js';
import {
  accumulateDomainElapsed,
  incrementDomainVisit,
  recordDomainIntervention as recordDomainInterventionMutation,
  recordDomainNavigationIntent as recordDomainNavigationIntentMutation,
  recordDomainContentFlow as recordDomainContentFlowMutation,
  recordDomainBackgroundPressure as recordDomainBackgroundPressureMutation,
  recordStatsSwitch,
  recordDomainTabContext as recordDomainTabContextMutation,
  recordSessionCommit,
} from '../aggregation/statsAggregator.js';
import {
  ensureDomainRecord,
  ensureStatsDayRecord,
  touchDomainTrackPoint as touchDomainTrackPointMutation,
} from '../aggregation/statsAggregateScaffold.js';
import { getLocalDateStr } from '../../../../lib/index.js';
import { prepareFeedHistoryContribution, requireFeedHistoryReceipt } from '../../contracts/feedContentFlowReceipt.js';
import { prepareInterventionHistoryReceipt } from '../../contracts/interventionHistoryReceipt.js';
import { createGoalDeliveryQaStatsFixtureBatch } from '@goal-delivery-qa-stats-fixture';

export function createStatsCollector({
  loadStatsCache,
  getStatsCache,
  getStatsDateStr,
  markStatsDirty,
  commitStatsMutation,
} = {}) {
  if (
    typeof loadStatsCache !== 'function'
    || typeof getStatsCache !== 'function'
    || typeof getStatsDateStr !== 'function'
    || typeof markStatsDirty !== 'function'
  ) {
    throw new Error('STATS_COLLECTOR_RUNTIME_ACCESSORS_REQUIRED');
  }
  if (typeof commitStatsMutation !== 'function') {
    throw new Error('STATS_COLLECTOR_COMMIT_OWNER_REQUIRED');
  }
  const commitDirtyStats = commitStatsMutation;

  function normalizeHourFromTimestamp(value, targetDateStr = null) {
    const timestamp = Number(value);
    if (!Number.isFinite(timestamp)) return null;
    if (
      typeof targetDateStr === 'string'
      && targetDateStr
      && getLocalDateStr(timestamp) !== targetDateStr
      && timestamp > 0
      && getLocalDateStr(timestamp - 1) === targetDateStr
    ) {
      return new Date(timestamp - 1).getHours();
    }
    const hour = new Date(timestamp).getHours();
    return Number.isInteger(hour) && hour >= 0 && hour < 24 ? hour : null;
  }

  function resolveTouchedHoursForRange({
    startTs = null,
    endTs = null,
    elapsedMs = 0,
  } = {}) {
    const end = endTs !== null && typeof endTs !== 'undefined' && Number.isFinite(Number(endTs))
      ? Number(endTs)
      : null;
    if (end === null) return [];
    const elapsed = Number(elapsedMs);
    const start = startTs !== null && typeof startTs !== 'undefined' && Number.isFinite(Number(startTs))
      ? Number(startTs)
      : Number.isFinite(elapsed) && elapsed > 0
        ? end - elapsed
        : end;
    if (!Number.isFinite(start) || end <= start) {
      const endHour = normalizeHourFromTimestamp(end);
      return endHour === null ? [] : [endHour];
    }

    const hours = new Set();
    let cursor = start;
    while (cursor < end) {
      const hour = normalizeHourFromTimestamp(cursor);
      if (hour !== null) hours.add(hour);
      const cursorDate = new Date(cursor);
      const nextHour = new Date(cursorDate);
      nextHour.setMinutes(60, 0, 0);
      const next = Math.min(end, nextHour.getTime());
      if (next <= cursor) break;
      cursor = next;
    }
    return [...hours].sort((left, right) => left - right);
  }

  function applyDomainCollectionPolicy(domainData, collectionPolicy = null, now = Date.now()) {
    if (!domainData || !collectionPolicy || typeof collectionPolicy !== 'object') return false;
    const timestamp = Number.isFinite(Number(now)) ? Number(now) : Date.now();
    const previous = domainData.collection && typeof domainData.collection === 'object'
      ? domainData.collection
      : {};
    const next = {
      firstCapturedAt: Number.isFinite(Number(previous.firstCapturedAt)) && Number(previous.firstCapturedAt) > 0
        ? Number(previous.firstCapturedAt)
        : timestamp,
      lastCapturedAt: timestamp,
      dataCollectionMode: typeof collectionPolicy.dataCollectionMode === 'string'
        ? collectionPolicy.dataCollectionMode
        : null,
      precisionInsightsMode: typeof collectionPolicy.precisionInsightsMode === 'string'
        ? collectionPolicy.precisionInsightsMode
        : null,
    };

    const changed = previous.firstCapturedAt !== next.firstCapturedAt
      || previous.lastCapturedAt !== next.lastCapturedAt
      || previous.dataCollectionMode !== next.dataCollectionMode
      || previous.precisionInsightsMode !== next.precisionInsightsMode;
    domainData.collection = next;
    return changed;
  }

  async function collectBatch(
    {
      now = Date.now(),
      skipCacheLoad = false,
      dateStr: dateStrOverride = null,
      requireDurableCommit = false,
    } = {},
    callback,
  ) {
    if (typeof callback !== 'function') {
      throw new Error('STATS_COLLECTOR_BATCH_CALLBACK_REQUIRED');
    }

    const targetNow = Number.isFinite(Number(now)) ? Number(now) : Date.now();
    if (!skipCacheLoad) {
      await loadStatsCache(targetNow);
    }

    const dateStr = typeof dateStrOverride === 'string' && dateStrOverride
      ? dateStrOverride
      : getStatsDateStr();
    if (!dateStr) {
      const error = new Error('STATS_COLLECTOR_DATE_UNAVAILABLE');
      error.code = 'STATS_COLLECTOR_DATE_UNAVAILABLE';
      throw error;
    }
    const statsCache = getStatsCache();
    const dayData = ensureStatsDayRecord(statsCache, dateStr, {
      createEmptyDayStats: createEmptyStatsDay,
    });
    if (!dayData) {
      const error = new Error('STATS_COLLECTOR_DAY_UNAVAILABLE');
      error.code = 'STATS_COLLECTOR_DAY_UNAVAILABLE';
      throw error;
    }

    let changed = false;
    const dirtyHours = new Set();
    const dirtyDomainKeysByHour = new Map();
    const dirtyTransitionEdgeKeysByHour = new Map();
    const markScopedKey = (target, hour, key) => {
      if (!Number.isInteger(hour) || hour < 0 || hour >= 24 || !key) return;
      if (!target.has(hour)) target.set(hour, new Set());
      target.get(hour).add(key);
    };
    const markDirtyHour = (timestamp) => {
      const hour = normalizeHourFromTimestamp(timestamp, dateStr);
      if (hour !== null) dirtyHours.add(hour);
      return hour;
    };
    const markDirtyHours = (hours = []) => {
      const normalizedHours = [];
      hours.forEach((hour) => {
        const normalized = Math.floor(Number(hour));
        if (Number.isInteger(normalized) && normalized >= 0 && normalized < 24) {
          dirtyHours.add(normalized);
          normalizedHours.push(normalized);
        }
      });
      return Array.from(new Set(normalizedHours));
    };
    const markDirtyDomainForHours = (hostname, hours = []) => {
      const normalizedHours = markDirtyHours(hours);
      const domainKey = normalizeStatsDomainKey(hostname);
      if (!domainKey) return;
      normalizedHours.forEach((hour) => {
        markScopedKey(dirtyDomainKeysByHour, hour, domainKey);
      });
    };
    const markDirtyDomainForHour = (hostname, hour) => {
      const domainKey = normalizeStatsDomainKey(hostname);
      if (hour !== null && domainKey) {
        markScopedKey(dirtyDomainKeysByHour, hour, domainKey);
      }
    };
    const markDirtyDomainAt = (hostname, timestamp) => {
      const hour = markDirtyHour(timestamp);
      markDirtyDomainForHour(hostname, hour);
    };
    const markDirtyTransitionForHour = (fromHostname, toHostname, hour) => {
      const edgeKey = buildStatsTransitionEdgeKey({
        fromDomain: fromHostname,
        toDomain: toHostname,
      });
      if (hour !== null && edgeKey) {
        markScopedKey(dirtyTransitionEdgeKeysByHour, hour, edgeKey);
      }
    };
    const collection = {
      dateStr,
      ensureDomainTrackingState({
        hostname,
        now: domainNow = targetNow,
        collectionPolicy = null,
      } = {}) {
        const result = ensureDomainRecord(dayData, hostname, {
          createEmptyDomainStats,
          now: domainNow,
        });
        const policyChanged = applyDomainCollectionPolicy(
          result?.domainData,
          collectionPolicy,
          domainNow,
        );
        if (result?.created || policyChanged) {
          changed = true;
          markDirtyDomainAt(result?.hostname, domainNow);
        }
        return {
          domainData: result?.domainData || null,
          created: !!result?.created,
          hostname: result?.hostname || null,
          activeCommittedThroughAt: Number(result?.domainData?.activeCommittedThroughAt) || 0,
          lastTrackedTime: Number(result?.domainData?.lastTrackedTime) || 0,
        };
      },
      touchDomainTrackPoint({
        hostname,
        now: pointNow = targetNow,
        collectionPolicy = null,
      } = {}) {
        const result = touchDomainTrackPointMutation({
          dayData,
          hostname,
          now: pointNow,
          createEmptyDomainStats,
        });
        const policyChanged = applyDomainCollectionPolicy(
          dayData?.domains?.[typeof hostname === 'string' ? hostname.trim().toLowerCase() : ''],
          collectionPolicy,
          pointNow,
        );
        if (result?.touched || policyChanged) {
          changed = true;
          markDirtyDomainAt(hostname, pointNow);
        }
        return result;
      },
      recordDomainElapsed({
        hostname,
        elapsedMs,
        isActive,
        recordActiveIntervals = false,
        now: elapsedNow = targetNow,
        startTs = null,
        isBlockedDomain = false,
        categoryId = 'other',
        collectionPolicy = null,
      } = {}) {
        const result = accumulateDomainElapsed({
          dayData,
          hostname,
          elapsedMs,
          isActive,
          recordActiveIntervals,
          now: elapsedNow,
          startTs,
          isBlockedDomain,
          categoryId,
          createEmptyDomainStats,
        });
        const policyChanged = applyDomainCollectionPolicy(
          dayData?.domains?.[typeof hostname === 'string' ? hostname.trim().toLowerCase() : ''],
          collectionPolicy,
          elapsedNow,
        );
        if (result?.applied) {
          changed = true;
          const touchedHours = resolveTouchedHoursForRange({
            startTs: result.appliedStartTs,
            endTs: elapsedNow,
            elapsedMs: result.appliedElapsedMs,
          });
          markDirtyDomainForHours(hostname, touchedHours);
        }
        if (policyChanged) {
          changed = true;
          markDirtyDomainAt(hostname, elapsedNow);
        }
        return result;
      },
      recordDomainVisit({
        hostname,
        now: visitNow = targetNow,
        count = 1,
      } = {}) {
        const result = incrementDomainVisit({
          dayData,
          hostname,
          now: visitNow,
          count,
          createEmptyDomainStats,
        });
        if (result) {
          changed = true;
          markDirtyDomainAt(hostname, visitNow);
        }
        return result;
      },
      recordDaySwitch({
        switchKey,
        fromHostname = null,
        toHostname = null,
        now: switchNow = targetNow,
      } = {}) {
        const result = recordStatsSwitch({
          dayData,
          switchKey,
          fromHostname,
          toHostname,
          now: switchNow,
          createEmptyDomainStats,
        });
        if (result) {
          changed = true;
          // A switch mutates two domain marginals and one edge in the same
          // hour. Resolve the local time boundary once for all three keys.
          const switchHour = markDirtyHour(switchNow);
          markDirtyDomainForHour(fromHostname, switchHour);
          markDirtyDomainForHour(toHostname, switchHour);
          markDirtyTransitionForHour(fromHostname, toHostname, switchHour);
        }
        return result;
      },
      recordDaySession({
        durationMs,
        hostname = null,
        sessionId,
        startedAt,
        now: sessionNow = targetNow,
        endedAt = sessionNow,
      } = {}) {
        const result = recordSessionCommit({
          dayData,
          hostname,
          sessionId,
          startedAt,
          endedAt,
          durationMs,
          createEmptyDomainStats,
        });
        if (result.applied || result.duplicate) {
          changed = true;
          const touchedHours = resolveTouchedHoursForRange({
            endTs: endedAt,
            elapsedMs: durationMs,
          });
          markDirtyDomainForHours(hostname, touchedHours);
        }
        return result;
      },
      recordDomainIntervention({
        hostname,
        type,
        now: interventionNow = targetNow,
        shownAt = null,
        interventionReceipt = null,
      } = {}) {
        let nextReceipts = null;
        if (interventionReceipt !== null) {
          if (interventionReceipt.hostname !== hostname || interventionReceipt.at !== interventionNow
            || interventionReceipt.shownAt !== shownAt || interventionReceipt.event !== type
            || interventionReceipt.dateStr !== dateStr || getLocalDateStr(interventionNow) !== dateStr
            || interventionReceipt.bucketStartTs !== resolveStatsHourlyBucketStartTs(dateStr, new Date(interventionNow).getHours())) {
            throw new Error('INTERVENTION_HISTORY_SOURCE_MISMATCH');
          }
          nextReceipts = prepareInterventionHistoryReceipt(
            Object.hasOwn(dayData, 'interventionHistoryReceipts') ? dayData.interventionHistoryReceipts : [], interventionReceipt);
          if (nextReceipts === null) return false;
        }
        const result = recordDomainInterventionMutation({
          dayData,
          hostname,
          type,
          now: interventionNow,
          shownAt,
          createEmptyDomainStats,
        });
        if (result) {
          if (nextReceipts !== null) dayData.interventionHistoryReceipts = nextReceipts;
          changed = true;
          markDirtyDomainAt(hostname, interventionNow);
        }
        return result;
      },
      recordDomainNavigationIntent({
        hostname,
        transitionType,
        transitionQualifiers = [],
        now: navigationNow = targetNow,
      } = {}) {
        const result = recordDomainNavigationIntentMutation({
          dayData,
          hostname,
          transitionType,
          transitionQualifiers,
          now: navigationNow,
          createEmptyDomainStats,
        });
        if (result) {
          changed = true;
          markDirtyDomainAt(hostname, navigationNow);
        }
        return result;
      },
      recordDomainTabContext({
        hostname,
        fromNewTab = false,
        sameDomainOpenTabs = 0,
        totalOpenTabs = 0,
        now: tabContextNow = targetNow,
      } = {}) {
        const result = recordDomainTabContextMutation({
          dayData,
          hostname,
          fromNewTab,
          sameDomainOpenTabs,
          totalOpenTabs,
          now: tabContextNow,
          createEmptyDomainStats,
        });
        if (result) {
          changed = true;
          markDirtyDomainAt(hostname, tabContextNow);
        }
        return result;
      },
      recordDomainContentFlow({
        hostname,
        scrollSpikeBursts = 0,
        fastScrollBursts = 0,
        feedPressureSignals = 0,
        feedInterruptSignals = 0,
        feedAdvanceBursts = 0,
        feedSkimSignals = 0,
        shortMediaAttentionSignals = 0,
        shortMediaWatchMs = 0,
        maxFeedScreenfuls = 0,
        maxFeedItemTransitions = 0,
        now: contentFlowNow = targetNow,
      } = {}) {
        const result = recordDomainContentFlowMutation({
          dayData,
          hostname,
          scrollSpikeBursts,
          fastScrollBursts,
          feedPressureSignals,
          feedInterruptSignals,
          feedAdvanceBursts,
          feedSkimSignals,
          shortMediaAttentionSignals,
          shortMediaWatchMs,
          maxFeedScreenfuls,
          maxFeedItemTransitions,
          now: contentFlowNow,
          createEmptyDomainStats,
        });
        if (result) {
          changed = true;
          markDirtyDomainAt(hostname, contentFlowNow);
        }
        return result;
      },
      recordDomainFeedHistory({ hostname, feedHistory } = {}) {
        feedHistory = requireFeedHistoryReceipt(feedHistory);
        if (hostname !== feedHistory.hostname) throw new Error('STATS_FEED_HISTORY_HOST_MISMATCH');
        if (getLocalDateStr(feedHistory.observedAt) !== dateStr) {
          throw new Error('STATS_FEED_HISTORY_DATE_MISMATCH');
        }
        if (Object.hasOwn(dayData, 'feedHistoryResetAt') && feedHistory.startedAt <= dayData.feedHistoryResetAt) {
          return { feedHistoryResetAt: dayData.feedHistoryResetAt };
        }
        const receipts = Object.hasOwn(dayData, 'feedHistoryReceipts') ? dayData.feedHistoryReceipts : [];
        const contribution = prepareFeedHistoryContribution(receipts, feedHistory);
        if (!contribution) return false;
        // Synchronous mutation: facts and their receipt enter the same dirty
        // hourly projection. A failed durable barrier retains both for retry.
        collection.recordDomainContentFlow({ hostname, ...contribution.stats, now: feedHistory.observedAt });
        dayData.feedHistoryReceipts = contribution.receipts;
        changed = true;
        markDirtyDomainAt(hostname, feedHistory.observedAt);
        return true;
      },
      recordDomainBackgroundPressure({
        hostname,
        mediaMs = 0,
        lingerMs = 0,
        staleMs = 0,
        now: pressureNow = targetNow,
        startTs = null,
      } = {}) {
        const result = recordDomainBackgroundPressureMutation({
          dayData,
          hostname,
          mediaMs,
          lingerMs,
          staleMs,
          now: pressureNow,
          startTs,
          createEmptyDomainStats,
        });
        if (result?.applied) {
          changed = true;
          const touchedHours = resolveTouchedHoursForRange({
            startTs,
            endTs: pressureNow,
            elapsedMs: Math.max(
              Number(mediaMs) || 0,
              Number(lingerMs) || 0,
              Number(staleMs) || 0,
            ),
          });
          markDirtyDomainForHours(hostname, touchedHours);
        }
        return result;
      },
    };

    Object.assign(collection, createGoalDeliveryQaStatsFixtureBatch({
      dayData, targetNow, markDirtyDomainAt, markChanged: () => { changed = true; },
    }));

    let value = null;
    let callbackError = null;
    try {
      value = await callback(collection);
    } catch (error) {
      callbackError = error;
    }

    let commitError = null;
    if (changed || requireDurableCommit) {
      try {
        const sortedDirtyHours = [...dirtyHours].sort((left, right) => left - right);
        const hourScopes = Object.fromEntries(sortedDirtyHours.map((hour) => [
          hour,
          {
            domainKeys: Array.from(dirtyDomainKeysByHour.get(hour) || []).sort(),
            transitionEdgeKeys: Array.from(
              dirtyTransitionEdgeKeysByHour.get(hour) || [],
            ).sort(),
          },
        ]));
        if (changed) {
          markStatsDirty({
            dateStr,
            hours: sortedDirtyHours,
            hourScopes,
          });
        }
        await commitDirtyStats({
          dateStr,
          hours: sortedDirtyHours,
          ...(requireDurableCommit ? { requireDurableCommit: true } : {}),
        });
      } catch (error) {
        commitError = error;
      }
    }

    if (callbackError && commitError) {
      const error = new AggregateError(
        [callbackError, commitError],
        'Stats collector callback and durable commit both failed.',
      );
      error.code = 'STATS_COLLECTOR_CALLBACK_AND_COMMIT_FAILED';
      throw error;
    }
    if (callbackError) throw callbackError;
    if (commitError) throw commitError;
    return {
      value,
      changed,
      dateStr,
    };
  }

  async function ensureDomainTrackingState(options = {}) {
    const { value } = await collectBatch({
      now: options.now,
      skipCacheLoad: options.skipCacheLoad,
      dateStr: options.dateStr,
    }, (collection) => collection.ensureDomainTrackingState(options));
    return value;
  }

  async function prepareCollectionBoundary({ now = Date.now() } = {}) {
    const targetNow = Number.isFinite(Number(now)) ? Number(now) : Date.now();
    await loadStatsCache(targetNow);
    const dateStr = getStatsDateStr();
    if (!dateStr) {
      const error = new Error('STATS_COLLECTOR_DATE_UNAVAILABLE');
      error.code = 'STATS_COLLECTOR_DATE_UNAVAILABLE';
      throw error;
    }
    return { dateStr, now: targetNow };
  }

  async function touchDomainTrackPoint(options = {}) {
    const { value } = await collectBatch({
      now: options.now,
      skipCacheLoad: options.skipCacheLoad,
      dateStr: options.dateStr,
    }, (collection) => collection.touchDomainTrackPoint(options));
    return value;
  }

  async function recordDomainElapsed(options = {}) {
    const { value } = await collectBatch({
      now: options.now,
      skipCacheLoad: options.skipCacheLoad,
      dateStr: options.dateStr,
      requireDurableCommit: options.isActive === true,
    }, (collection) => collection.recordDomainElapsed(options));
    return value;
  }

  async function recordDomainVisit(options = {}) {
    const { value } = await collectBatch({
      now: options.now,
      skipCacheLoad: options.skipCacheLoad,
      dateStr: options.dateStr,
    }, (collection) => collection.recordDomainVisit(options));
    return value;
  }

  async function recordDaySwitch(options = {}) {
    const { value } = await collectBatch({
      now: options.now,
      skipCacheLoad: options.skipCacheLoad,
      dateStr: options.dateStr,
    }, (collection) => collection.recordDaySwitch(options));
    return value;
  }

  async function recordDaySession(options = {}) {
    const { value } = await collectBatch({
      now: options.now,
      skipCacheLoad: options.skipCacheLoad,
      dateStr: options.dateStr,
      requireDurableCommit: true,
    }, (collection) => collection.recordDaySession(options));
    return value;
  }

  async function recordDomainIntervention(options = {}) {
    const { value } = await collectBatch({
      now: options.now,
      skipCacheLoad: options.skipCacheLoad,
      dateStr: options.dateStr,
      requireDurableCommit: true,
    }, (collection) => collection.recordDomainIntervention(options));
    return value;
  }

  async function recordDomainNavigationIntent(options = {}) {
    const { value } = await collectBatch({
      now: options.now,
      skipCacheLoad: options.skipCacheLoad,
      dateStr: options.dateStr,
    }, (collection) => collection.recordDomainNavigationIntent(options));
    return value;
  }

  async function recordDomainTabContext(options = {}) {
    const { value } = await collectBatch({
      now: options.now,
      skipCacheLoad: options.skipCacheLoad,
      dateStr: options.dateStr,
    }, (collection) => collection.recordDomainTabContext(options));
    return value;
  }

  async function recordDomainContentFlow(options = {}) {
    const { value } = await collectBatch({
      now: options.now,
      skipCacheLoad: options.skipCacheLoad,
      dateStr: options.dateStr,
      requireDurableCommit: true,
    }, (collection) => Object.hasOwn(options, 'feedHistory')
      ? collection.recordDomainFeedHistory(options)
      : collection.recordDomainContentFlow(options));
    return value;
  }

  return {
    collectBatch,
    prepareCollectionBoundary,
    ensureDomainTrackingState,
    touchDomainTrackPoint,
    recordDomainElapsed,
    recordDomainVisit,
    recordDaySwitch,
    recordDaySession,
    recordDomainIntervention,
    recordDomainNavigationIntent,
    recordDomainTabContext,
    recordDomainContentFlow,
  };
}
