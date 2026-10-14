import fs from 'node:fs/promises';
import path from 'node:path';

import {
  classifyInterventionConsumptionPattern,
} from '../../../src/domains/nudge/attention/consumptionPatternClassifier.js';
import {
  resolveDopamineBingeDetection,
} from '../../../src/domains/nudge/attention/dopamineBingeDetector.js';
import {
  RUNTIME_DEBUGGER_AUTOMATION_ACTIONS,
} from '../../../src/domains/nudge/runtime-debugger/automation/runtimeDebuggerAutomationContract.dev.js';
import { evaluate, sleep } from '../extensionChromiumHarness.mjs';
import {
  readDebuggerPayload,
  runTrustedFeedStep,
  summarizeFeedSnapshot,
} from '../feedHorizonCausalE2E.mjs';
import {
  sendRuntimeDebuggerAutomationAction,
} from '../sites/siteRuntimeBrowser.mjs';
import {
  analyzeFeedConsumptionResearchCurve,
  createFeedConsumptionResearchMarkdownReport,
} from './feedConsumptionResearchAnalysis.mjs';
import {
  createFeedConsumptionResearchCheckpoint,
  getFeedConsumptionResearchJourney,
  normalizeFeedConsumptionResearchCandidateThreshold,
  normalizeFeedConsumptionResearchReferenceDwellMs,
  resolveFeedConsumptionResearchCapturedAt,
} from './feedConsumptionResearchContract.mjs';
import {
  projectVirtualFeedTempoReference,
} from './feedConsumptionResearchReplay.mjs';
import {
  projectMatureSessionFeedAdmission,
} from './feedConsumptionResearchTiming.mjs';

const CONTENT_BEARING_KEYS = new Set([
  'author',
  'channelId',
  'href',
  'itemId',
  'itemKey',
  'pathname',
  'rawUrl',
  'selector',
  'selectors',
  'text',
  'title',
  'url',
]);

const FEED_FLOW_COST_COUNTER_KEYS = Object.freeze([
  'mutationScanCount',
  'mutationScanTotalMs',
  'mutationRootCount',
  'mutationCandidateCount',
  'freshItemCount',
  'dominantScanCount',
  'dominantScanTotalMs',
  'dominantCandidateCount',
  'dominantRawCandidateCount',
  'dominantNestedCandidateCount',
  'geometryReadCount',
  'topologyProbeCount',
  'topologyProbeTotalMs',
  'topologyProbeCandidateCount',
  'advanceCount',
]);

const OBSERVER_HUB_COST_COUNTER_KEYS = Object.freeze([
  'flushes',
  'mutations',
  'addedNodes',
  'removedNodes',
  'textNodes',
  'attributeTargets',
  'flushDurationTotalMs',
  'queueWaitTotalMs',
  'debugFlushOverheadTotalMs',
  'debugFlushOverheadCount',
  'debugSnapshotReadTotalMs',
  'debugSnapshotReadCount',
]);

const OBSERVER_SUBSCRIBER_COST_COUNTER_KEYS = Object.freeze([
  'calls',
  'totalMs',
  'totalMutations',
  'totalAddedNodes',
  'totalRemovedNodes',
  'totalTextNodes',
  'totalAttributeTargets',
]);

const SOCIAL_METRICS_COST_COUNTER_KEYS = Object.freeze([
  'mutationSchedules',
  'zeroRootSchedules',
  'selectorRootTotal',
  'semanticRootTotal',
  'rootTotal',
  'queuedScans',
  'scanAdmissions',
  'enqueuedScans',
  'mergedScans',
  'routedMutationGroups',
  'skippedMutationGroups',
  'routedRuleSkips',
  'hostRootRelevanceSkips',
  'selfMutationRecordsConsumed',
  'skippedIrrelevantScans',
  'admittedFullScans',
  'admittedDirtyScans',
  'fullScans',
  'rootScans',
  'executedScans',
  'executedFullScans',
  'executedDirtyScans',
  'candidateCollections',
  'processedCandidates',
  'scanOperations',
  'completedScanOperations',
  'emptyScanOperations',
  'failedScanOperations',
  'cancelledScanOperations',
]);

const SOCIAL_METRICS_TIMING_COUNTER_KEYS = Object.freeze([
  'queueWaitTotalMs',
  'selectorQueryTotalMs',
  'semanticQueryTotalMs',
  'selectorProbeOverheadTotalMs',
  'idleWaitTotalMs',
  'chunkTotalMs',
  'chunkCount',
  'applyTotalMs',
  'applyCount',
  'cleanupTotalMs',
  'cleanupCount',
  'configurationCleanupTotalMs',
  'configurationCleanupCount',
  'scanTotalMs',
]);

const SOCIAL_METRICS_AUDIT_COUNTER_KEYS = Object.freeze([
  'selectorCollections',
  'selectorQueries',
  'selectorHits',
  'semanticHits',
  'candidateUnionCollections',
  'resolvedCandidates',
  'decisionCount',
  'appliedDecisionCount',
  'writeAttempts',
  'actualWrites',
  'unchangedWriteAttempts',
  'ownedMutationRecordAttempts',
  'ownedMutationRecordsArmed',
  'actualWriteDecisions',
  'unchangedNoopDecisions',
  'noWriteDecisions',
  'duplicateScans',
  'avoidableFullRescans',
  'zeroCandidateCollections',
]);

const RUNTIME_OWNER_COST_COUNTER_KEYS = Object.freeze([
  'calls',
  'totalMs',
  'totalUnits',
]);

const FEED_CONSUMPTION_STABILITY_PROBE_KEY = '__entropyFeedConsumptionStabilityProbeV1';

async function evaluateInFeedPage(harness, page, evaluator, input) {
  if (typeof evaluator !== 'function' || !page?.sessionId) {
    throw new Error('FEED_CONSUMPTION_STABILITY_EVALUATION_CONTEXT_INVALID');
  }
  return evaluate(
    harness.cdp,
    page.sessionId,
    `(${evaluator.toString()})(${JSON.stringify(input)})`,
  );
}

async function installFeedConsumptionStabilityProbe(harness, page) {
  return evaluateInFeedPage(harness, page, (probeKey) => {
    if (globalThis[probeKey]) {
      throw new Error('FEED_CONSUMPTION_STABILITY_PROBE_ALREADY_INSTALLED');
    }

    const now = () => performance.now();
    const scrollPositions = new WeakMap();
    const scrollTargets = new WeakSet();
    let stepIndex = -1;
    let stepPhase = 'idle';
    let scrollEventCount = 0;
    let sampledTargetCount = 0;
    let upwardJumpCount = 0;
    let topResetCount = 0;
    let maximumUpwardJumpPx = 0;
    let maximumDownwardMovePx = 0;
    let lastUpwardJumpStepIndex = null;
    let layoutShiftCount = 0;
    let layoutShiftValue = 0;
    let layoutShiftWithoutRecentInputCount = 0;
    let layoutShiftWithoutRecentInputValue = 0;
    let socialMetricLayoutShiftCount = 0;
    let socialMetricLayoutShiftValue = 0;
    let maximumLayoutShiftValue = 0;
    let observerCallbackCount = 0;
    let observerCallbackTotalMs = 0;
    let observerCallbackMaxMs = 0;

    const getDocumentScroller = () => document.scrollingElement || document.documentElement;
    const toScrollTarget = (target) => (
      target === document || target === document.documentElement || target === document.body
        ? getDocumentScroller()
        : (target instanceof Element ? target : getDocumentScroller())
    );
    const rememberScrollTarget = (target) => {
      const resolved = toScrollTarget(target);
      if (!(resolved instanceof Element)) return null;
      if (!scrollTargets.has(resolved)) {
        scrollTargets.add(resolved);
        sampledTargetCount += 1;
      }
      if (!scrollPositions.has(resolved)) {
        scrollPositions.set(resolved, Number(resolved.scrollTop) || 0);
      }
      return resolved;
    };
    const findInputScroller = (target) => {
      let current = target instanceof Element ? target : null;
      for (let depth = 0; current && depth < 12; depth += 1) {
        if (current.scrollHeight > current.clientHeight + 2) return current;
        current = current.parentElement;
      }
      return getDocumentScroller();
    };
    const sampleScrollTarget = (target) => {
      const resolved = rememberScrollTarget(target);
      if (!resolved) return;
      const previous = Number(scrollPositions.get(resolved)) || 0;
      const current = Number(resolved.scrollTop) || 0;
      const delta = current - previous;
      scrollPositions.set(resolved, current);
      scrollEventCount += 1;
      if (delta > 0) maximumDownwardMovePx = Math.max(maximumDownwardMovePx, delta);
      const viewportHeight = Math.max(1, Number(resolved.clientHeight) || innerHeight || 1);
      const jumpThreshold = Math.max(160, viewportHeight * 0.35);
      if (delta <= -jumpThreshold) {
        upwardJumpCount += 1;
        maximumUpwardJumpPx = Math.max(maximumUpwardJumpPx, Math.abs(delta));
        lastUpwardJumpStepIndex = stepIndex >= 0 ? stepIndex : null;
        if (current <= Math.max(8, viewportHeight * 0.02) && previous >= viewportHeight) {
          topResetCount += 1;
        }
      }
    };
    const onPotentialInput = (event) => {
      rememberScrollTarget(findInputScroller(event.target));
    };
    const onScroll = (event) => sampleScrollTarget(event.target);
    addEventListener('wheel', onPotentialInput, { capture: true, passive: true });
    addEventListener('keydown', onPotentialInput, { capture: true });
    addEventListener('scroll', onScroll, { capture: true, passive: true });
    rememberScrollTarget(getDocumentScroller());

    const socialMetricAttributes = [
      'data-friction-social-engagement',
      'data-friction-social-exposure',
      'data-friction-social-instagram-collapse',
    ];
    const isSocialMetricShiftSource = (node) => {
      if (!(node instanceof Element)) return false;
      let current = node;
      for (let depth = 0; current && depth < 6; depth += 1) {
        if (socialMetricAttributes.some((attribute) => current.hasAttribute(attribute))) return true;
        current = current.parentElement;
      }
      return false;
    };

    let layoutObserver = null;
    const Observer = globalThis.PerformanceObserver;
    const supported = Array.isArray(Observer?.supportedEntryTypes)
      && Observer.supportedEntryTypes.includes('layout-shift');
    if (supported) {
      layoutObserver = new Observer((list) => {
        const callbackStartedAt = now();
        try {
          list.getEntries().forEach((entry) => {
            const value = Math.max(0, Number(entry.value) || 0);
            layoutShiftCount += 1;
            layoutShiftValue += value;
            maximumLayoutShiftValue = Math.max(maximumLayoutShiftValue, value);
            if (entry.hadRecentInput !== true) {
              layoutShiftWithoutRecentInputCount += 1;
              layoutShiftWithoutRecentInputValue += value;
            }
            const socialSource = Array.from(entry.sources || [])
              .some((source) => isSocialMetricShiftSource(source?.node));
            if (socialSource) {
              socialMetricLayoutShiftCount += 1;
              socialMetricLayoutShiftValue += value;
            }
          });
        } finally {
          const elapsed = Math.max(0, now() - callbackStartedAt);
          observerCallbackCount += 1;
          observerCallbackTotalMs += elapsed;
          observerCallbackMaxMs = Math.max(observerCallbackMaxMs, elapsed);
        }
      });
      layoutObserver.observe({ type: 'layout-shift', buffered: false });
    }

    const summarizeActionGeometry = () => {
      const scopes = Array.from(document.querySelectorAll([
        'main[role="main"] article',
        'main article',
        'section[role="dialog"]',
        'div[role="dialog"]',
      ].join(','))).slice(0, 16);
      const rowClusters = [];
      scopes.forEach((scope) => {
        const rowBands = [];
        Array.from(scope.querySelectorAll('button, [role="button"]')).slice(0, 48)
          .forEach((control) => {
            if (!control.querySelector('svg, [role="img"]')) return;
            const interactiveAncestor = control.parentElement?.closest('button, [role="button"]');
            if (interactiveAncestor && scope.contains(interactiveAncestor)) return;
            if (control.querySelector('button, [role="button"]')) return;
            const rect = control.getBoundingClientRect();
            if (
              rect.width < 12
              || rect.height < 12
              || rect.width > 160
              || rect.height > 100
              || rect.bottom <= 0
              || rect.top >= innerHeight
            ) return;
            const centerY = rect.top + (rect.height / 2);
            let band = rowBands.find((entry) => Math.abs(entry.centerY - centerY) <= 10);
            if (!band) {
              band = { centerY, controls: [] };
              rowBands.push(band);
            }
            band.controls.push({
              left: rect.left,
              right: rect.right,
              centerX: rect.left + (rect.width / 2),
            });
          });
        rowBands.forEach((band) => {
          const controls = band.controls.sort((left, right) => left.centerX - right.centerX);
          let cluster = [];
          const flushCluster = () => {
            if (cluster.length >= 3 && cluster.length <= 6) rowClusters.push(cluster);
            cluster = [];
          };
          controls.forEach((control) => {
            const previous = cluster.at(-1);
            if (previous && control.centerX - previous.centerX > 96) flushCluster();
            cluster.push(control);
          });
          flushCluster();
        });
      });
      const gaps = [];
      const centerSpacings = [];
      let rowCount = 0;
      let controlCount = 0;
      rowClusters.forEach((controls) => {
        rowCount += 1;
        controlCount += controls.length;
        for (let index = 1; index < controls.length; index += 1) {
          gaps.push(controls[index].left - controls[index - 1].right);
          centerSpacings.push(controls[index].centerX - controls[index - 1].centerX);
        }
      });
      const mean = gaps.length > 0
        ? gaps.reduce((total, value) => total + value, 0) / gaps.length
        : 0;
      const variance = gaps.length > 0
        ? gaps.reduce((total, value) => total + ((value - mean) ** 2), 0) / gaps.length
        : 0;
      const centerMean = centerSpacings.length > 0
        ? centerSpacings.reduce((total, value) => total + value, 0) / centerSpacings.length
        : 0;
      const centerVariance = centerSpacings.length > 0
        ? centerSpacings.reduce(
          (total, value) => total + ((value - centerMean) ** 2),
          0,
        ) / centerSpacings.length
        : 0;
      return {
        rowCount,
        controlCount,
        gapCount: gaps.length,
        meanGapPx: mean,
        minimumGapPx: gaps.length > 0 ? Math.min(...gaps) : 0,
        maximumGapPx: gaps.length > 0 ? Math.max(...gaps) : 0,
        gapStandardDeviationPx: Math.sqrt(variance),
        maximumGapDeviationPx: gaps.length > 0
          ? Math.max(...gaps.map((value) => Math.abs(value - mean)))
          : 0,
        negativeGapCount: gaps.filter((value) => value < 0).length,
        centerSpacingCount: centerSpacings.length,
        meanCenterSpacingPx: centerMean,
        minimumCenterSpacingPx: centerSpacings.length > 0 ? Math.min(...centerSpacings) : 0,
        maximumCenterSpacingPx: centerSpacings.length > 0 ? Math.max(...centerSpacings) : 0,
        centerSpacingStandardDeviationPx: Math.sqrt(centerVariance),
        maximumCenterSpacingDeviationPx: centerSpacings.length > 0
          ? Math.max(...centerSpacings.map((value) => Math.abs(value - centerMean)))
          : 0,
      };
    };

    const resetWindow = () => {
      scrollEventCount = 0;
      upwardJumpCount = 0;
      topResetCount = 0;
      maximumUpwardJumpPx = 0;
      maximumDownwardMovePx = 0;
      lastUpwardJumpStepIndex = null;
      layoutShiftCount = 0;
      layoutShiftValue = 0;
      layoutShiftWithoutRecentInputCount = 0;
      layoutShiftWithoutRecentInputValue = 0;
      socialMetricLayoutShiftCount = 0;
      socialMetricLayoutShiftValue = 0;
      maximumLayoutShiftValue = 0;
      observerCallbackCount = 0;
      observerCallbackTotalMs = 0;
      observerCallbackMaxMs = 0;
      layoutObserver?.takeRecords?.();
    };
    const snapshot = ({ reset = false } = {}) => {
      const geometry = summarizeActionGeometry();
      const result = {
        geometry,
        scroll: {
          eventCount: scrollEventCount,
          sampledTargetCount,
          upwardJumpCount,
          topResetCount,
          maximumUpwardJumpPx,
          maximumDownwardMovePx,
          lastUpwardJumpStepIndex,
          lastStepPhase: stepPhase,
        },
        layoutShift: {
          supported,
          count: layoutShiftCount,
          value: layoutShiftValue,
          withoutRecentInputCount: layoutShiftWithoutRecentInputCount,
          withoutRecentInputValue: layoutShiftWithoutRecentInputValue,
          socialMetricSourceCount: socialMetricLayoutShiftCount,
          socialMetricSourceValue: socialMetricLayoutShiftValue,
          maximumValue: maximumLayoutShiftValue,
        },
        instrumentation: {
          retainsDomNodes: false,
          observerCallbackCount,
          observerCallbackTotalMs,
          observerCallbackMaxMs,
        },
      };
      if (reset) resetWindow();
      return result;
    };
    const stop = () => {
      removeEventListener('wheel', onPotentialInput, { capture: true });
      removeEventListener('keydown', onPotentialInput, { capture: true });
      removeEventListener('scroll', onScroll, { capture: true });
      layoutObserver?.disconnect?.();
    };

    globalThis[probeKey] = Object.freeze({
      mark(nextStepIndex, nextPhase) {
        stepIndex = Number.isSafeInteger(nextStepIndex) ? nextStepIndex : -1;
        stepPhase = String(nextPhase || 'unknown').slice(0, 40);
        rememberScrollTarget(getDocumentScroller());
      },
      snapshot,
      stop,
    });
    return { installed: true, layoutShiftSupported: supported };
  }, FEED_CONSUMPTION_STABILITY_PROBE_KEY);
}

async function markFeedConsumptionStabilityProbe(harness, page, stepIndex, phase) {
  return evaluateInFeedPage(harness, page, ({
    probeKey,
    stepIndex: nextStepIndex,
    phase: nextPhase,
  }) => {
    const probe = globalThis[probeKey];
    if (!probe) throw new Error('FEED_CONSUMPTION_STABILITY_PROBE_NOT_INSTALLED');
    probe.mark(nextStepIndex, nextPhase);
    return true;
  }, {
    probeKey: FEED_CONSUMPTION_STABILITY_PROBE_KEY,
    stepIndex,
    phase,
  });
}

async function readFeedConsumptionStabilityProbe(
  harness,
  page,
  { reset = false, stop = false } = {},
) {
  return evaluateInFeedPage(harness, page, ({
    probeKey,
    reset: shouldReset,
    stop: shouldStop,
  }) => {
    const probe = globalThis[probeKey];
    if (!probe) throw new Error('FEED_CONSUMPTION_STABILITY_PROBE_NOT_INSTALLED');
    const snapshot = probe.snapshot({ reset: shouldReset });
    if (shouldStop) {
      probe.stop();
      delete globalThis[probeKey];
    }
    return snapshot;
  }, {
    probeKey: FEED_CONSUMPTION_STABILITY_PROBE_KEY,
    reset,
    stop,
  });
}

function readCostCounter(source, key, owner) {
  const value = Number(source?.[key]);
  if (!Number.isFinite(value) || value < 0) {
    throw new Error(`FEED_CONSUMPTION_RESEARCH_COST_COUNTER_INVALID:${owner}:${key}`);
  }
  return value;
}

function createCostCounterDelta(start, end, keys, owner) {
  return Object.freeze(Object.fromEntries(keys.map((key) => {
    const before = readCostCounter(start, key, owner);
    const after = readCostCounter(end, key, owner);
    if (after < before) {
      throw new Error(`FEED_CONSUMPTION_RESEARCH_COST_COUNTER_RESET:${owner}:${key}`);
    }
    return [key, round(after - before, 3)];
  })));
}

function createZeroCostCounters(keys) {
  return Object.fromEntries(keys.map((key) => [key, 0]));
}

function createKeyedCostCounterDelta(start, end, keys, owner) {
  const startEntries = start && typeof start === 'object' ? start : {};
  const endEntries = end && typeof end === 'object' ? end : {};
  const entryKeys = Array.from(new Set([
    ...Object.keys(startEntries),
    ...Object.keys(endEntries),
  ])).sort();
  return Object.freeze(entryKeys.map((entryKey) => {
    const before = startEntries[entryKey] || createZeroCostCounters(keys);
    const after = endEntries[entryKey] || createZeroCostCounters(keys);
    const delta = createCostCounterDelta(before, after, keys, `${owner}:${entryKey}`);
    const calls = Number(delta.calls) || 0;
    const totalMs = Number(delta.totalMs) || 0;
    return Object.freeze({
      ownerId: entryKey,
      ...delta,
      averageMs: calls > 0 ? round(totalMs / calls, 4) : 0,
    });
  }).filter((entry) => (
    Object.entries(entry).some(([key, value]) => (
      key !== 'ownerId' && key !== 'averageMs' && Number(value) > 0
    ))
  )));
}

function runtimeOwnerStatsById(payload) {
  const entries = payload?.latest?.runtimeContention?.ownerWork?.byOwner;
  if (!Array.isArray(entries)) {
    throw new Error('FEED_CONSUMPTION_RESEARCH_RUNTIME_OWNER_COST_REQUIRED');
  }
  return Object.fromEntries(entries.map((entry) => [entry.ownerId, entry]));
}

export function createFeedConsumptionRuntimeCostEvidence(initialPayload, finalPayload) {
  const initialFeedCounters = initialPayload?.latest?.feedFlow?.ledger?.counters;
  const finalFeedCounters = finalPayload?.latest?.feedFlow?.ledger?.counters;
  const initialObserver = initialPayload?.latest?.observerHub;
  const finalObserver = finalPayload?.latest?.observerHub;
  const initialSocialStats = initialPayload?.latest?.socialMetrics?.stats;
  const finalSocialStats = finalPayload?.latest?.socialMetrics?.stats;
  if (!initialFeedCounters || !finalFeedCounters) {
    throw new Error('FEED_CONSUMPTION_RESEARCH_FEED_COST_REQUIRED');
  }
  if (!initialObserver || !finalObserver) {
    throw new Error('FEED_CONSUMPTION_RESEARCH_OBSERVER_COST_REQUIRED');
  }
  if (!initialSocialStats || !finalSocialStats) {
    throw new Error('FEED_CONSUMPTION_RESEARCH_SOCIAL_COST_REQUIRED');
  }

  const startedAt = Number(initialPayload?.session?.latestCapturedAt);
  const endedAt = Number(finalPayload?.session?.latestCapturedAt);
  if (!Number.isFinite(startedAt) || !Number.isFinite(endedAt) || endedAt < startedAt) {
    throw new Error('FEED_CONSUMPTION_RESEARCH_COST_WINDOW_INVALID');
  }

  const runtimeOwners = createKeyedCostCounterDelta(
    runtimeOwnerStatsById(initialPayload),
    runtimeOwnerStatsById(finalPayload),
    RUNTIME_OWNER_COST_COUNTER_KEYS,
    'runtime_owner',
  );
  const initialContention = initialPayload.latest.runtimeContention;
  const finalContention = finalPayload.latest.runtimeContention;
  const longTasks = createCostCounterDelta(
    initialContention.longTasks,
    finalContention.longTasks,
    ['count', 'totalMs'],
    'runtime_long_tasks',
  );

  const evidence = Object.freeze({
    version: 1,
    state: 'measured',
    semantics: 'runtime_debugger_monotonic_delta_over_exact_research_journey',
    window: Object.freeze({
      startedAt,
      endedAt,
      durationMs: round(endedAt - startedAt, 3),
    }),
    feedFlow: createCostCounterDelta(
      initialFeedCounters,
      finalFeedCounters,
      FEED_FLOW_COST_COUNTER_KEYS,
      'feed_flow',
    ),
    observerHub: Object.freeze({
      ...createCostCounterDelta(
        initialObserver,
        finalObserver,
        OBSERVER_HUB_COST_COUNTER_KEYS,
        'observer_hub',
      ),
      subscribers: createKeyedCostCounterDelta(
        initialObserver.subscriberCounters,
        finalObserver.subscriberCounters,
        OBSERVER_SUBSCRIBER_COST_COUNTER_KEYS,
        'observer_subscriber',
      ),
    }),
    socialMetrics: Object.freeze({
      ...createCostCounterDelta(
        initialSocialStats,
        finalSocialStats,
        SOCIAL_METRICS_COST_COUNTER_KEYS,
        'social_metrics',
      ),
      timings: createCostCounterDelta(
        initialSocialStats.timings,
        finalSocialStats.timings,
        SOCIAL_METRICS_TIMING_COUNTER_KEYS,
        'social_metrics_timing',
      ),
      audit: createCostCounterDelta(
        initialSocialStats.audit,
        finalSocialStats.audit,
        SOCIAL_METRICS_AUDIT_COUNTER_KEYS,
        'social_metrics_audit',
      ),
    }),
    runtimeContention: Object.freeze({
      owners: runtimeOwners,
      longTasks: Object.freeze({
        ...longTasks,
        supported: finalContention.longTasks.supported === true,
      }),
      retention: Object.freeze({ ...finalContention.retention }),
      instrumentation: Object.freeze({ ...finalContention.instrumentation }),
    }),
  });
  assertContentFree(evidence);
  return evidence;
}

function round(value, digits = 4) {
  const scale = 10 ** digits;
  return Math.round(Number(value) * scale) / scale;
}

function readFeedFlow(payload) {
  const feedFlow = payload?.latest?.feedFlow;
  if (!feedFlow || typeof feedFlow !== 'object') {
    throw new Error('FEED_CONSUMPTION_RESEARCH_FEED_SNAPSHOT_REQUIRED');
  }
  return feedFlow;
}

function assertContentFree(value, pathParts = []) {
  if (Array.isArray(value)) {
    value.forEach((entry, index) => assertContentFree(entry, [...pathParts, String(index)]));
    return;
  }
  if (!value || typeof value !== 'object') return;
  Object.entries(value).forEach(([key, entry]) => {
    if (CONTENT_BEARING_KEYS.has(key)) {
      throw new Error(
        `FEED_CONSUMPTION_RESEARCH_CONTENT_KEY_FORBIDDEN:${[...pathParts, key].join('.')}`,
      );
    }
    assertContentFree(entry, [...pathParts, key]);
  });
}

function resolveDetection(summary, evidence, now, candidateThreshold) {
  if (summary.episode?.detection) {
    return {
      detection: summary.episode.detection,
      source: 'runtime_episode_manager',
    };
  }
  if (!evidence) return { detection: null, source: 'unavailable' };
  return {
    detection: resolveDopamineBingeDetection({
      feedEvidence: evidence,
      now,
      candidateThreshold,
    }),
    source: 'canonical_model_projection',
  };
}

function countMeasuredActions(checkpoints) {
  return checkpoints.filter((checkpoint) => (
    checkpoint.step.kind === 'advance'
    && checkpoint.driver?.action?.opportunity?.state === 'measured'
  )).length;
}

function incrementCount(counts, value, unavailable = 'unavailable') {
  const key = typeof value === 'string' && value ? value : unavailable;
  counts[key] = (counts[key] || 0) + 1;
}

function createInitialRuntimeState(feedFlow) {
  const observation = feedFlow.binge?.observation || null;
  return Object.freeze({
    semanticState: feedFlow.semanticState,
    readiness: feedFlow.readiness,
    actuationSafety: feedFlow.actuationSafety,
    observation: Object.freeze({
      advanceCount: Math.max(0, Number(observation?.advanceCount) || 0),
      surfaceMode: observation?.surfaceMode || 'unknown',
      surfaceProfileId: observation?.loopSignals?.context?.surfaceProfileId || '',
    }),
  });
}

export function createFeedConsumptionMeasurementDiagnostics(trace) {
  const advanceCheckpoints = trace.checkpoints.filter(
    (checkpoint) => checkpoint.step.kind === 'advance',
  );
  const opportunityStates = {};
  const opportunityReasons = {};
  const primaryOpportunityReasons = {};
  const inputKinds = {};
  const runtimeSurfaceModes = {};
  let performedCount = 0;
  let measuredCount = 0;
  let recoveryAttemptCount = 0;
  let maximumRuntimeAdvanceCount = Math.max(
    0,
    Number(trace.initialRuntimeState?.observation?.advanceCount) || 0,
  );

  advanceCheckpoints.forEach((checkpoint) => {
    const action = checkpoint.driver?.action || {};
    const opportunity = action.opportunity || {};
    if (action.trustedInput === true) performedCount += 1;
    if (opportunity.state === 'measured') measuredCount += 1;
    if (action.oracleRecovery?.status) recoveryAttemptCount += 1;
    incrementCount(opportunityStates, opportunity.state);
    incrementCount(opportunityReasons, opportunity.reason);
    incrementCount(inputKinds, action.inputKind);
    incrementCount(runtimeSurfaceModes, checkpoint.observation?.surfaceMode, 'unknown');
    if (action.oracleRecovery?.primaryOpportunity) {
      incrementCount(
        primaryOpportunityReasons,
        action.oracleRecovery.primaryOpportunity.reason,
      );
    }
    maximumRuntimeAdvanceCount = Math.max(
      maximumRuntimeAdvanceCount,
      Math.max(0, Number(checkpoint.observation?.advanceCount) || 0),
    );
  });

  const initialAdvanceCount = Math.max(
    0,
    Number(trace.initialRuntimeState?.observation?.advanceCount) || 0,
  );
  const runtimeAdvanceDelta = Math.max(0, maximumRuntimeAdvanceCount - initialAdvanceCount);
  const failureModes = [];
  const initialConditions = [];
  if (trace.initialRuntimeState?.readiness?.status !== 'ready') {
    initialConditions.push('runtime_semantic_cold_learning');
  }
  const measurementCoverage = advanceCheckpoints.length > 0
    ? measuredCount / advanceCheckpoints.length
    : 0;
  if (measuredCount < Math.min(3, advanceCheckpoints.length) || measurementCoverage < 0.6) {
    failureModes.push('measurement_coverage_below_required');
  }
  if (
    performedCount === advanceCheckpoints.length
    && measuredCount === 0
    && Number(opportunityStates.armed_idle || 0) > 0
  ) failureModes.push('bounded_inputs_without_dom_progress');
  if (
    runtimeAdvanceDelta === 0
    && Number(runtimeSurfaceModes.unknown || 0) === advanceCheckpoints.length
  ) failureModes.push('runtime_feed_observation_uninitialized');
  if (Number(opportunityStates.insufficient || 0) > 0) {
    failureModes.push('dom_oracle_measurement_insufficient');
  }

  return Object.freeze({
    version: 1,
    status: failureModes.length === 0 ? 'measured' : 'degraded',
    initialConditions: Object.freeze(initialConditions),
    failureModes: Object.freeze(failureModes),
    opportunityStates: Object.freeze(opportunityStates),
    opportunityReasons: Object.freeze(opportunityReasons),
    primaryOpportunityReasons: Object.freeze(primaryOpportunityReasons),
    inputKinds: Object.freeze(inputKinds),
    runtimeSurfaceModes: Object.freeze(runtimeSurfaceModes),
    recoveryAttemptCount,
    measurementCoverage: round(measurementCoverage),
    initialRuntimeAdvanceCount: initialAdvanceCount,
    maximumRuntimeAdvanceCount,
    runtimeAdvanceDelta,
  });
}

function createTraceSummary(trace, analysis, researchWriteFence) {
  const requestedAdvanceCount = trace.journey.steps.filter(
    (step) => step.kind === 'advance',
  ).length;
  const performedAdvanceCount = trace.checkpoints.filter((checkpoint) => (
    checkpoint.step.kind === 'advance'
    && checkpoint.driver?.action?.trustedInput === true
  )).length;
  const measuredAdvanceCount = countMeasuredActions(trace.checkpoints);
  const measurementCoverage = requestedAdvanceCount > 0
    ? measuredAdvanceCount / requestedAdvanceCount
    : 0;
  const status = (
    performedAdvanceCount === requestedAdvanceCount
    && measuredAdvanceCount >= Math.min(3, requestedAdvanceCount)
    && measurementCoverage >= 0.6
    && analysis.directionalityEvidence.captureStatus !== 'missing'
  ) ? 'PASS' : 'INCONCLUSIVE';
  const measurementDiagnostics = createFeedConsumptionMeasurementDiagnostics(trace);
  return Object.freeze({
    version: 2,
    status,
    researchVerdict: analysis.researchExpectation.status,
    journeyId: trace.journey.id,
    siteId: trace.siteId,
    surfaceMode: trace.surfaceMode,
    featureProfile: trace.featureProfile,
    modelBlind: true,
    behavioralBranchInputs: Object.freeze(['journey_step', 'dom_oracle_recovery']),
    modelOutputsUsedAsBehavioralBranches: false,
    requestedAdvanceCount,
    performedAdvanceCount,
    measuredAdvanceCount,
    measurementCoverage: round(measurementCoverage),
    measurementDiagnostics,
    runtimeCostEvidence: trace.runtimeCostEvidence,
    stabilityEvidence: trace.stabilityEvidence,
    researchWriteFence,
    analysis,
  });
}

async function writeResearchArtifacts(outputDir, trace, summary) {
  await fs.mkdir(outputDir, { recursive: true });
  const tracePath = path.join(outputDir, 'trace.jsonl');
  const summaryPath = path.join(outputDir, 'summary.json');
  const markdownPath = path.join(outputDir, 'report.md');
  const traceLines = trace.checkpoints.map((checkpoint) => JSON.stringify(checkpoint));
  await fs.writeFile(tracePath, `${traceLines.join('\n')}\n`, 'utf8');
  await fs.writeFile(summaryPath, `${JSON.stringify({ trace, summary }, null, 2)}\n`, 'utf8');
  await fs.writeFile(markdownPath, createFeedConsumptionResearchMarkdownReport({
    curveCount: 1,
    curves: [summary.analysis],
    comparisons: [],
    collisions: [],
    timerOnlyViolationCount: summary.analysis.timerOnlyIncreaseCount,
  }, {
    title: `Feed Consumption Research: ${trace.siteId} / ${trace.journey.id}`,
  }), 'utf8');
  return Object.freeze({ tracePath, summaryPath, markdownPath });
}

export async function runFeedConsumptionResearchJourney({
  harness,
  page,
  scenario,
  journeyId,
  outputDir,
  candidateThreshold = 0.78,
  referenceDwellMs = 5_000,
  featureProfile = 'feed_only',
} = {}) {
  if (!harness || !page || !scenario) {
    throw new Error('FEED_CONSUMPTION_RESEARCH_BROWSER_CONTEXT_REQUIRED');
  }
  if (typeof outputDir !== 'string' || !path.isAbsolute(outputDir)) {
    throw new Error('FEED_CONSUMPTION_RESEARCH_OUTPUT_DIR_ABSOLUTE_REQUIRED');
  }
  if (![
    'feed_only',
    'feed_social',
    'feed_video_skip',
    'feed_social_video_skip',
  ].includes(featureProfile)) {
    throw new Error('FEED_CONSUMPTION_RESEARCH_FEATURE_PROFILE_INVALID');
  }
  const surfaceMode = scenario.feedConsumption?.surfaceMode;
  const journey = getFeedConsumptionResearchJourney(journeyId, { surfaceMode });
  const threshold = normalizeFeedConsumptionResearchCandidateThreshold(candidateThreshold);
  const reference = normalizeFeedConsumptionResearchReferenceDwellMs(referenceDwellMs);
  const startedAt = Date.now();
  const checkpoints = [];
  let writeFenceSnapshot = null;
  let latestPayload = null;
  let stabilityProbeInstalled = false;

  const fenceResponse = await sendRuntimeDebuggerAutomationAction(
    harness,
    page,
    RUNTIME_DEBUGGER_AUTOMATION_ACTIONS.SET_FEED_CONSUMPTION_RESEARCH,
    { enabled: true },
  );
  writeFenceSnapshot = fenceResponse.result?.researchWriteFence || null;
  try {
  if (
    writeFenceSnapshot?.active !== true
    || writeFenceSnapshot?.currentEpisodeTainted !== true
  ) {
    throw new Error('FEED_CONSUMPTION_RESEARCH_WRITE_FENCE_NOT_CONFIRMED');
  }

  await installFeedConsumptionStabilityProbe(harness, page);
  stabilityProbeInstalled = true;
  const initialStabilitySnapshot = await readFeedConsumptionStabilityProbe(
    harness,
    page,
    { reset: true },
  );
  const initialPayload = await readDebuggerPayload(harness, page);
  latestPayload = initialPayload;
  const initialRuntimeState = createInitialRuntimeState(
    summarizeFeedSnapshot(readFeedFlow(initialPayload), Date.now()),
  );
  assertContentFree(initialRuntimeState);

  for (let index = 0; index < journey.steps.length; index += 1) {
    const step = journey.steps[index];
    let action = null;
    await markFeedConsumptionStabilityProbe(harness, page, index, 'before_step');
    if (step.kind === 'pause') {
      await sleep(step.durationMs);
      action = {
        kind: 'pause',
        status: 'performed',
        requestedDurationMs: step.durationMs,
      };
    } else {
      action = await runTrustedFeedStep({
        harness,
        page,
        scenario,
        index,
        dwellMs: step.dwellMs,
        direction: step.direction,
        collectOracle: true,
      });
    }
    await markFeedConsumptionStabilityProbe(harness, page, index, 'after_step');
    const payload = await readDebuggerPayload(harness, page);
    latestPayload = payload;
    const feedFlow = readFeedFlow(payload);
    const capturedAt = resolveFeedConsumptionResearchCapturedAt({
      sampledAt: Date.now(),
      evidenceObservedAt: feedFlow.binge?.evidence?.observedAt,
      detectionEvaluatedAt: feedFlow.episode?.detection?.evaluatedAt,
      observationLastAdvanceAt: feedFlow.binge?.observation?.lastAdvanceAt,
    });
    const summary = summarizeFeedSnapshot(feedFlow, capturedAt);
    const observation = summary.binge?.observation || null;
    const evidence = summary.binge?.evidence || null;
    const resolvedDetection = resolveDetection(summary, evidence, capturedAt, threshold);
    const detection = resolvedDetection.detection;
    const consumptionProfile = detection
      ? classifyInterventionConsumptionPattern({
        bingeDetection: detection,
        now: capturedAt,
      })
      : null;
    const feedDecision = summary.episode?.feedDecision || null;
    const matureSessionAdmission = projectMatureSessionFeedAdmission({
      surfaceMode,
      detection,
      feedDecision,
      now: capturedAt,
    });
    const checkpoint = createFeedConsumptionResearchCheckpoint({
      index,
      journeyId: journey.id,
      surfaceMode,
      step,
      capturedAt,
      elapsedMs: capturedAt - startedAt,
      driver: {
        source: 'qa_managed_attached_browser',
        action,
        detectionSource: resolvedDetection.source,
      },
      observation,
      sensorObservation: feedFlow.sensorObservation,
      evidence,
      detection,
      consumptionProfile,
      feedDecision,
      admission: summary.episode?.admission || null,
      matureSessionAdmission,
      personalReference: projectVirtualFeedTempoReference({
        surfaceMode,
        medianDwellMs: evidence?.measurements?.medianDwellMs,
        referenceDwellMs: reference,
      }),
    });
    assertContentFree(checkpoint);
    checkpoints.push(checkpoint);
  }

  const finishedAt = Math.max(Date.now(), checkpoints.at(-1)?.capturedAt || 0);
  const runtimeCostEvidence = createFeedConsumptionRuntimeCostEvidence(
    initialPayload,
    latestPayload,
  );
  const finalStabilitySnapshot = await readFeedConsumptionStabilityProbe(
    harness,
    page,
    { stop: true },
  );
  stabilityProbeInstalled = false;
  const stabilityEvidence = Object.freeze({
    version: 1,
    state: 'measured',
    semantics: 'qa_page_scroll_layout_shift_and_action_geometry_over_exact_research_journey',
    initialGeometry: initialStabilitySnapshot.geometry,
    finalGeometry: finalStabilitySnapshot.geometry,
    scroll: finalStabilitySnapshot.scroll,
    layoutShift: finalStabilitySnapshot.layoutShift,
    instrumentation: finalStabilitySnapshot.instrumentation,
  });
  assertContentFree(stabilityEvidence);
  const trace = Object.freeze({
    version: 1,
    source: 'qa_managed_attached_browser',
    siteId: scenario.siteId,
    journey,
    surfaceMode,
    featureProfile,
    candidateThreshold: threshold,
    referenceDwellMs: reference,
    startedAt,
    finishedAt,
    initialRuntimeState,
    runtimeCostEvidence,
    stabilityEvidence,
    checkpoints: Object.freeze(checkpoints),
  });
  assertContentFree(trace);
  const analysis = analyzeFeedConsumptionResearchCurve(trace);
  const summary = createTraceSummary(trace, analysis, writeFenceSnapshot);
  const paths = await writeResearchArtifacts(outputDir, trace, summary);
  return Object.freeze({ trace, summary, paths });
  } finally {
    if (stabilityProbeInstalled) {
      await readFeedConsumptionStabilityProbe(harness, page, { stop: true });
    }
    const release = await sendRuntimeDebuggerAutomationAction(
      harness,
      page,
      RUNTIME_DEBUGGER_AUTOMATION_ACTIONS.SET_FEED_CONSUMPTION_RESEARCH,
      { enabled: false },
    );
    if (release.result?.researchWriteFence?.active !== false) {
      throw new Error('FEED_CONSUMPTION_RESEARCH_WRITE_FENCE_RELEASE_NOT_CONFIRMED');
    }
  }
}
