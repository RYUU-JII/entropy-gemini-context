import {
  SOCIAL_METRIC_ATTRS,
} from '../../../core/index.js';
import {
  SOCIAL_METRIC_GROUPS,
} from '../contracts/socialMetricContracts.js';
import {
  applyMetricScanCandidate,
  collectMetricCandidates,
  queryMetricCandidates,
  revalidateXMetricEffect,
  revalidateTikTokMetricEffect,
} from './candidateMatcher.js';
import {
  cancelSocialMetricScan,
  runSocialMetricScanChunk,
  scheduleMutationDrivenSocialMetricScan,
  scheduleSocialMetricScanChunk,
  startNextSocialMetricScan,
} from './scanController.js';
import {
  SOCIAL_METRICS_CORRELATION_LIMIT,
  SOCIAL_METRICS_DEEP_SELECTOR_LIMIT,
} from './debugInstrumentation.js';
import {
  SOCIAL_METRICS_CANDIDATE_PROVENANCE,
} from './selectorDriftRecoveryContract.js';
import {
  createMainThreadSliceDeadline,
  yieldMainThreadContinuation,
} from '../../../../../platform/scheduling/mainThreadCooperativeScheduler.js';
import {
  isRuntimeContentionSessionActive,
  recordRuntimeOwnerWork,
} from '@runtime-contention-ledger';
import {
  compactSelector,
  compactText,
  nowMs,
  roundMs,
} from './diagnosticsValueUtils.js';

function createSocialMetricsScanRuntimeState() {
  return {
    _scanGeneration: 0,
    _scanPhase: 'settled',
    _scanCollectionPromise: null,
    _scanTimer: null,
    _scanIdleHandle: null,
    _scanCandidates: null,
    _scanCleanup: null,
    _scanCleanupTimer: null,
    _scanCursor: 0,
    _scanContext: null,
    _scanQueue: [],
    _pendingMutationRoots: new Set(),
    _pendingMutationRoutes: new Map(),
    _forceFullScan: false,
    _scanDrainWaiter: null,
    _scanFailure: null,
  };
}

function getLatestFlushId(entry = {}) {
  const values = Array.isArray(entry?.debugScheduleContext?.flushIds)
    ? entry.debugScheduleContext.flushIds
    : [entry?.debugScheduleContext?.flushId];
  return values
    .map(Number)
    .filter((value) => Number.isFinite(value))
    .at(-1) || null;
}

const COLLECTION_FILTER_BATCH_SIZE = 64;

function createCollectionUnitRunner({
  entry,
  units,
  createSliceDeadline,
  yieldContinuation,
  isCurrent,
  finish,
}) {
  const deadline = createSliceDeadline();
  let cursor = 0;
  let processedInSlice = 0;

  function runUnit(unit) {
    const measureContention = isRuntimeContentionSessionActive();
    const startedAt = measureContention ? nowMs() : 0;
    let result;
    try {
      result = unit.run();
      return result;
    } finally {
      if (measureContention) {
        const endedAt = nowMs();
        recordRuntimeOwnerWork({
          ownerId: 'socialMetrics',
          phase: unit.phase,
          source: entry?.scanSource || 'unknown',
          startedAt,
          endedAt,
          units: typeof unit.readUnits === 'function'
            ? unit.readUnits(result)
            : 1,
          flushId: getLatestFlushId(entry),
        });
      }
    }
  }

  function resume() {
    while (cursor < units.length) {
      if (!isCurrent()) { entry.collectionState = 'cancelled'; return []; }
      if (!deadline.hasTime(processedInSlice)) {
        const continuation = yieldContinuation();
        return Promise.resolve(continuation).then(() => {
          if (!isCurrent()) { entry.collectionState = 'cancelled'; return []; }
          deadline.reset();
          processedInSlice = 0;
          return resume();
        });
      }
      const unit = units[cursor];
      runUnit(unit);
      // A cursor keeps one work unit until exhaustion. Retaining/reinserting
      // every processed hop made continuation queues quadratic in DOM size.
      if (unit.repeat !== true) cursor += 1;
      processedInSlice += 1;
    }
    if (!isCurrent()) { entry.collectionState = 'cancelled'; return []; }
    entry.collectionState = 'exhausted';
    return finish();
  }

  return resume();
}

export function createSocialMetricsScanRuntime({
  reportFailure,
  ownerPort,
  diagnosticsPort,
  ownedMutationPort,
  yieldContinuation = yieldMainThreadContinuation,
  createSliceDeadline = createMainThreadSliceDeadline,
} = {}) {
  if (typeof reportFailure !== 'function') {
    throw new Error('SOCIAL_METRICS_SCAN_RUNTIME_REPORTER_REQUIRED');
  }
  [
    'collectMutationRoots',
    'filterScanRootsForGroup',
    'flushCleanupQueues',
    'getCandidateMatcherHelpers',
    'getSemanticAdapter',
    'normalizeRoots',
    'readScanConfiguration',
    'routeMutationGroups',
    'shouldIncludeCollectedCandidate',
  ].forEach((method) => {
    if (typeof ownerPort?.[method] !== 'function') {
      throw new Error(`SOCIAL_METRICS_SCAN_OWNER_PORT_${method.toUpperCase()}_REQUIRED`);
    }
  });
  [
    'beginScanChunk',
    'canRunDeepSelectorProbe',
    'clearMutationScheduleContext',
    'consumeMutationScheduleContext',
    'finishScanChunk',
    'finishScanOperation',
    'isAuditEnabled',
    'recordCandidateCollection',
    'recordCandidateDiscoveryVisit',
    'recordCandidateProvenance',
    'recordMutationScheduleContext',
    'recordProcessedCandidate',
    'recordQueuedScan',
    'recordScanApplyTiming',
    'recordScanCollectionTiming',
    'recordScanIdleScheduled',
    'recordScanRootDiscoveryVisit',
    'recordSelectorAudit',
    'recordSkippedRootScan',
    'startScanOperation',
  ].forEach((method) => {
    if (typeof diagnosticsPort?.[method] !== 'function') {
      throw new Error(`SOCIAL_METRICS_SCAN_DIAGNOSTICS_PORT_${method.toUpperCase()}_REQUIRED`);
    }
  });
  if (
    typeof ownedMutationPort?.runWithCandidateWriteCapture !== 'function'
    || typeof ownedMutationPort?.runWithScanChunkMutationCapture !== 'function'
  ) {
    throw new Error('SOCIAL_METRICS_SCAN_OWNED_MUTATION_PORT_REQUIRED');
  }
  if (
    typeof yieldContinuation !== 'function'
    || typeof createSliceDeadline !== 'function'
  ) {
    throw new Error('SOCIAL_METRICS_SCAN_SCHEDULER_COLLABORATOR_REQUIRED');
  }
  const state = createSocialMetricsScanRuntimeState();
  const runtime = Object.freeze({
  _getScanControllerHelpers() {
    return {
      collectCandidates: (entry, options) => runtime._collectCandidates(entry, options),
      applyScanCandidate: (el, ctx) => runtime._applyScanCandidate(el, ctx),
      flushCleanupQueues: (ctx) => ownerPort.flushCleanupQueues(ctx),
      collectMutationRoots: (payload) => ownerPort.collectMutationRoots(payload),
      normalizeRoots: (roots) => ownerPort.normalizeRoots(roots),
      routeMutationGroups: (payload, roots) => ownerPort.routeMutationGroups(payload, roots),
      getActiveScanGroups: () => ownerPort.readScanConfiguration().activeScanGroups,
      queueGroupScan: (group, filterKeys, options) => runtime._scanAndMark(group, filterKeys, options),
      handleScanFailure: (entry, error) => runtime._handleScanFailure(entry, error),
      startScanOperation: (entry) => diagnosticsPort.startScanOperation(entry),
      finishScanOperation: (entry, outcome, error) => (
        diagnosticsPort.finishScanOperation(entry, outcome, error)
      ),
      recordScanIdleScheduled: (entry) => diagnosticsPort.recordScanIdleScheduled(entry),
      beginScanChunk: (entry) => diagnosticsPort.beginScanChunk(entry),
      finishScanChunk: (entry, details) => diagnosticsPort.finishScanChunk(entry, details),
      runScanChunk: (deadline) => runtime._runScanChunk(deadline),
      recordMutationSchedule: (debugContext) => (
        diagnosticsPort.recordMutationScheduleContext(debugContext)
      ),
      consumeMutationSchedule: () => diagnosticsPort.consumeMutationScheduleContext(),
      settleScanDrain: () => runtime._settleScanDrain(),
    };
  },

  _collectCandidates(entry = {}, { isCurrent = () => true } = {}) {
    entry.collectionState = 'pending';
    entry.revalidationEvidenceCount = 0;
    const {
      list,
      joinedSelector = '',
      roots = null,
      isInstagram = false,
    } = entry;
    const auditEnabled = diagnosticsPort.isAuditEnabled();
    const units = [];
    const selectorCandidateSet = new Set();
    const semanticCandidateSet = new Set();
    let candidates = [];
    let semanticCandidates = [];
    let resolvedCandidates = [];
    let selectorQueryMs = 0;
    let semanticQueryMs = 0;
    const selectorBreakdown = [];
    let selectorProbeMs = 0;
    let selectorProbeHits = 0;
    let selectorProbeUniqueHits = 0;
    let selectorProbeQueries = 0;
    const deepProbeEnabled = diagnosticsPort.canRunDeepSelectorProbe();
    const selectorsToProbe = deepProbeEnabled && Array.isArray(list)
      ? list.slice(0, SOCIAL_METRICS_DEEP_SELECTOR_LIMIT)
      : [];
    const uniqueSelectorProbeHits = new Set();
    const discoveryRoots = roots === null
      ? [document.documentElement]
      : (Array.isArray(roots) ? roots : []);
    discoveryRoots.forEach((root) => {
      if (root instanceof Element) {
        diagnosticsPort.recordScanRootDiscoveryVisit(entry, root);
      }
    });

    const selectorRootBatches = roots === null
      ? [null]
      : (Array.isArray(roots) ? roots.map((root) => [root]) : []);
    selectorRootBatches.forEach((selectorRoots) => {
      const selectorQueryUnit = {
        phase: 'selector_query',
        run() {
          const selectorStartedAt = auditEnabled ? nowMs() : 0;
          let hits = [];
          try {
            hits = queryMetricCandidates({
              list,
              joinedSelector,
              roots: selectorRoots,
            });
          } catch (error) {
            if (auditEnabled) {
              selectorQueryMs += Math.max(0, nowMs() - selectorStartedAt);
              diagnosticsPort.recordScanCollectionTiming(entry, { selectorQueryMs });
            }
            runtime._reportCandidateCollectionFailure('candidate_selector_query', error, entry, {
              joinedSelector: compactSelector(
                joinedSelector || (Array.isArray(list) ? list.join(',') : ''),
              ),
            });
            throw error;
          }
          if (auditEnabled) selectorQueryMs += Math.max(0, nowMs() - selectorStartedAt);
          const filterUnits = [];
          for (let offset = 0; offset < hits.length; offset += COLLECTION_FILTER_BATCH_SIZE) {
            const batch = hits.slice(offset, offset + COLLECTION_FILTER_BATCH_SIZE);
            filterUnits.push({
              phase: 'candidate_filter',
              run() {
                const included = batch.filter((candidate) => (
                  ownerPort.shouldIncludeCollectedCandidate(candidate, { isInstagram })
                ));
                included.forEach((candidate) => selectorCandidateSet.add(candidate));
                return included;
              },
              readUnits: () => batch.length,
            });
          }
          const insertionIndex = units.indexOf(selectorQueryUnit) + 1;
          units.splice(insertionIndex, 0, ...filterUnits);
          return hits;
        },
        readUnits: (hits) => Array.isArray(hits) ? hits.length : 0,
      };
      units.push(selectorQueryUnit);
    });

    selectorsToProbe.forEach((selector) => {
      units.push({
        phase: 'selector_probe',
        run() {
          const probeStartedAt = nowMs();
          let hits = [];
          try {
            hits = collectMetricCandidates({
              list: [selector],
              joinedSelector: selector,
              roots,
              shouldIncludeCandidate: (el) => (
                ownerPort.shouldIncludeCollectedCandidate(el, { isInstagram })
              ),
            });
          } catch (error) {
            const durationMs = Math.max(0, nowMs() - probeStartedAt);
            selectorProbeMs += durationMs;
            selectorProbeQueries += 1;
            selectorBreakdown.push({
              selector: compactSelector(selector),
              hits: 0,
              durationMs: roundMs(durationMs),
              error: compactText(error?.message || error),
            });
            return [];
          }
          const durationMs = nowMs() - probeStartedAt;
          selectorProbeMs += durationMs;
          selectorProbeQueries += 1;
          selectorProbeHits += hits.length;
          hits.forEach((hit) => uniqueSelectorProbeHits.add(hit));
          selectorBreakdown.push({
            selector: compactSelector(selector),
            hits: hits.length,
            durationMs: roundMs(durationMs),
          });
          return hits;
        },
        readUnits: (hits) => Array.isArray(hits) ? hits.length : 0,
      });
    });

    let selectorOnlyHits = 0;
    let semanticOnlyHits = 0;
    let selectorSemanticOverlapHits = 0;
    let provenanceProbeMs = 0;
    const semanticPlanUnit = {
      phase: 'semantic_scope_discovery',
      run() {
        const semanticStartedAt = auditEnabled ? nowMs() : 0;
        let plan;
        try {
          const semanticAdapter = ownerPort.getSemanticAdapter();
          if (typeof semanticAdapter?.createMetricCandidateCollectionPlan !== 'function') {
            throw new Error('SOCIAL_METRICS_SEMANTIC_COLLECTION_PLAN_REQUIRED');
          }
          plan = semanticAdapter.createMetricCandidateCollectionPlan(entry);
          if (
            !plan
            || !Array.isArray(plan.scopes)
            || typeof plan.createScopeCursor !== 'function'
          ) {
            throw new Error('SOCIAL_METRICS_SEMANTIC_COLLECTION_PLAN_INVALID');
          }
        } catch (error) {
          if (auditEnabled) {
            semanticQueryMs += Math.max(0, nowMs() - semanticStartedAt);
            diagnosticsPort.recordScanCollectionTiming(entry, {
              selectorQueryMs,
              selectorProbeMs,
              semanticQueryMs,
            });
          }
          runtime._reportCandidateCollectionFailure('candidate_semantic_query', error, entry);
          throw error;
        }
        if (auditEnabled) semanticQueryMs += Math.max(0, nowMs() - semanticStartedAt);

        const createSemanticCursorUnit = (scope, cursorState = { cursor: null }) => {
          const semanticUnit = {
            phase: 'semantic_query',
            run() {
              if (!isCurrent()) return [];
              const scopeStartedAt = auditEnabled ? nowMs() : 0;
              let step;
              try {
                if (cursorState.cursor === null) {
                  cursorState.cursor = plan.createScopeCursor(scope);
                  if (typeof cursorState.cursor?.next !== 'function') {
                    throw new Error('SOCIAL_METRICS_SEMANTIC_COLLECTION_CURSOR_INVALID');
                  }
                }
                step = cursorState.cursor.next();
                if (
                  !step
                  || typeof step !== 'object'
                  || typeof step.done !== 'boolean'
                  || (!step.done && !Array.isArray(step.value))
                  || (step.done && step.value !== undefined)
                ) {
                  throw new Error('SOCIAL_METRICS_SEMANTIC_COLLECTION_CURSOR_RESULT_INVALID');
                }
              } catch (error) {
                if (auditEnabled) {
                  semanticQueryMs += Math.max(0, nowMs() - scopeStartedAt);
                  diagnosticsPort.recordScanCollectionTiming(entry, {
                    selectorQueryMs,
                    selectorProbeMs,
                    semanticQueryMs,
                  });
                }
                runtime._reportCandidateCollectionFailure('candidate_semantic_query', error, entry);
                throw error;
              }
              if (auditEnabled) semanticQueryMs += Math.max(0, nowMs() - scopeStartedAt);
              semanticUnit.repeat = !step.done && isCurrent();
              if (!semanticUnit.repeat) return [];

              const hits = step.value;
              hits.forEach((candidate) => semanticCandidateSet.add(candidate));
              return hits;
            },
            readUnits: (hits) => Array.isArray(hits) ? hits.length : 0,
          };
          return semanticUnit;
        };
        const semanticUnits = plan.scopes.map((scope) => createSemanticCursorUnit(scope));
        const insertionIndex = units.indexOf(semanticPlanUnit) + 1;
        units.splice(insertionIndex, 0, ...semanticUnits);
        return plan.scopes;
      },
      readUnits: (scopes) => Array.isArray(scopes) ? scopes.length : 0,
    };
    units.push(semanticPlanUnit);

    const finalizeCollectionUnit = {
      phase: 'collection_finalize',
      run() {
        const selectorHits = auditEnabled ? candidates.length : 0;
        selectorProbeUniqueHits = uniqueSelectorProbeHits.size;
        diagnosticsPort.recordCandidateCollection(entry, resolvedCandidates.length);
        if (auditEnabled) {
          diagnosticsPort.recordScanCollectionTiming(entry, {
            candidateCount: resolvedCandidates.length,
            selectorQueryMs,
            selectorProbeMs,
            semanticQueryMs,
          });
        }
        diagnosticsPort.recordSelectorAudit(entry, {
          selectorCount: Array.isArray(list) ? list.length : 0,
          selectorQueryCount: Array.isArray(list) && list.length > 0 ? 1 : 0,
          selectorHits,
          selectorUniqueHits: selectorHits,
          selectorQueryMs,
          selectorProbeMs,
          selectorProbeQueries,
          selectorProbeHits,
          selectorProbeUniqueHits,
          selectorProbeTruncated: deepProbeEnabled
            && Array.isArray(list)
            && list.length > selectorsToProbe.length,
          deepProbed: selectorsToProbe.length > 0,
          selectorBreakdown,
          semanticHits: semanticCandidates.length,
          selectorOnlyHits,
          semanticOnlyHits,
          selectorSemanticOverlapHits,
          provenanceProbeMs,
          semanticQueryMs,
          resolvedCandidates: resolvedCandidates.length,
        });
        return resolvedCandidates;
      },
      readUnits: (hits) => Array.isArray(hits) ? hits.length : 0,
    };
    const unionMaterializationUnit = {
      phase: 'union_materialization',
      run() {
        candidates = Array.from(selectorCandidateSet);
        semanticCandidates = Array.from(semanticCandidateSet);
        resolvedCandidates = semanticCandidates.length
          ? Array.from(new Set([...candidates, ...semanticCandidates]))
          : candidates;

        const followupUnits = [];
        for (let offset = 0; offset < resolvedCandidates.length; offset += 64) {
          const batch = resolvedCandidates.slice(offset, offset + 64);
          followupUnits.push({
            phase: 'candidate_discovery',
            run() {
              batch.forEach((candidate) => {
                diagnosticsPort.recordCandidateDiscoveryVisit(entry, candidate);
              });
              return batch;
            },
            readUnits: () => batch.length,
          });
        }
        if (auditEnabled) {
          for (let offset = 0; offset < resolvedCandidates.length; offset += 64) {
            const batch = resolvedCandidates.slice(offset, offset + 64);
            followupUnits.push({
              phase: 'candidate_provenance',
              run() {
                const provenanceStartedAt = nowMs();
                batch.forEach((candidate) => {
                  const selectorMatched = selectorCandidateSet.has(candidate);
                  const semanticMatched = semanticCandidateSet.has(candidate);
                  const provenance = selectorMatched && semanticMatched
                    ? SOCIAL_METRICS_CANDIDATE_PROVENANCE.SELECTOR_SEMANTIC_OVERLAP
                    : semanticMatched
                      ? SOCIAL_METRICS_CANDIDATE_PROVENANCE.SEMANTIC_ONLY
                      : SOCIAL_METRICS_CANDIDATE_PROVENANCE.SELECTOR_ONLY;
                  if (provenance === SOCIAL_METRICS_CANDIDATE_PROVENANCE.SELECTOR_ONLY) {
                    selectorOnlyHits += 1;
                  } else if (provenance === SOCIAL_METRICS_CANDIDATE_PROVENANCE.SEMANTIC_ONLY) {
                    semanticOnlyHits += 1;
                  } else {
                    selectorSemanticOverlapHits += 1;
                  }
                  diagnosticsPort.recordCandidateProvenance(entry, candidate, provenance);
                });
                provenanceProbeMs += Math.max(0, nowMs() - provenanceStartedAt);
                return batch;
              },
              readUnits: () => batch.length,
            });
          }
        }
        followupUnits.push(finalizeCollectionUnit);
        const insertionIndex = units.indexOf(unionMaterializationUnit) + 1;
        units.splice(insertionIndex, 0, ...followupUnits);
        return resolvedCandidates;
      },
      readUnits: (hits) => Array.isArray(hits) ? hits.length : 0,
    };
    units.push(unionMaterializationUnit);

    if (entry.isInstagram) {
      const helpers = ownerPort.getCandidateMatcherHelpers();
      const cursor = helpers.createInstagramEffectRevalidationCursor(entry);
      const createRevalidationUnit = () => {
        const unit = {
          phase: 'effect_revalidation',
          run() {
            const step = cursor.next();
            unit.repeat = !step.done;
            if (step.done) return;
            ownedMutationPort.runWithScanChunkMutationCapture(entry, () => {
              entry.revalidationEvidenceCount += step.value.length;
              for (const record of step.value) helpers.revalidateInstagramMetricEffect(record, entry);
            });
          },
        };
        return unit;
      };
      units.push(createRevalidationUnit());
    }

    if (entry.isX || entry.isYoutube || entry.isTikTok || entry.isFacebook) {
      const helpers = ownerPort.getCandidateMatcherHelpers();
      const cursor = helpers.createAccessibleMetricLabelRevalidationCursor(entry);
      const createLabelRevalidationUnit = () => {
        const unit = {
          phase: 'effect_revalidation',
          run() {
            const step = cursor.next();
            unit.repeat = !step.done;
            if (step.done) return;
            ownedMutationPort.runWithScanChunkMutationCapture(entry, () => {
              entry.revalidationEvidenceCount += step.value.length;
              for (const target of step.value) helpers.revalidateAccessibleMetricLabel(target);
            });
          },
        };
        return unit;
      };
      units.push(createLabelRevalidationUnit());
    }

    if (entry.isX) {
      const helpers = ownerPort.getCandidateMatcherHelpers();
      const cursor = helpers.createXEffectRevalidationCursor(entry);
      let prepared = false;
      const flushRevalidationCleanup = () => {
        if (entry.dirtyXMetadataClusters.size === 0) return;
        entry.revalidationEvidenceCount += entry.dirtyXMetadataClusters.size;
        ownerPort.flushCleanupQueues(entry);
      };
      const createRevalidationUnit = () => {
        const unit = {
          phase: 'effect_revalidation',
          run() {
            if (!prepared) {
              for (const root of entry.causalRoots || []) helpers.markXMetadataDirty(root, entry);
              prepared = true;
            }
            const step = cursor.next();
            unit.repeat = !step.done;
            if (step.done) {
              flushRevalidationCleanup();
              return;
            }
            ownedMutationPort.runWithScanChunkMutationCapture(entry, () => {
              entry.revalidationEvidenceCount += step.value.length;
              for (const record of step.value) revalidateXMetricEffect(record, entry, helpers);
              // Include the last positive's decorated ancestors even if the
              // candidate union is empty. No discovery/provenance is fabricated.
              flushRevalidationCleanup();
            });
          },
        };
        return unit;
      };
      units.push(createRevalidationUnit());
    }

    if (entry.isTikTok) {
      const helpers = ownerPort.getCandidateMatcherHelpers();
      const cursor = helpers.createTikTokEffectRevalidationCursor(entry);
      const unit = {
        phase: 'effect_revalidation',
        run() {
          const step = cursor.next();
          unit.repeat = !step.done;
          if (step.done) return;
          ownedMutationPort.runWithScanChunkMutationCapture(entry, () => {
            entry.revalidationEvidenceCount += step.value.length;
            for (const record of step.value) revalidateTikTokMetricEffect(record, entry, helpers);
          });
        },
      };
      units.push(unit);
    }

    return createCollectionUnitRunner({
      entry,
      units,
      createSliceDeadline,
      yieldContinuation,
      isCurrent,
      finish: () => resolvedCandidates,
    });
  },

  _reportCandidateCollectionFailure(phase, error, entry = {}, details = {}) {
    entry.collectionState = 'failed';
    reportFailure(phase, error, {
      group: entry?.group || null,
      filterKeys: Array.isArray(entry?.filterKeys) ? [...entry.filterKeys] : [],
      scanSource: entry?.scanSource || 'unknown',
      rootsMode: entry?.roots === null ? 'full' : 'dirty',
      rootCount: Array.isArray(entry?.roots) ? entry.roots.length : 0,
      selectorCount: Array.isArray(entry?.list) ? entry.list.length : 0,
      ...details,
    });
  },

  _handleScanFailure(entry = {}, error) {
    entry.collectionState = 'failed';
    reportFailure('scan_collect_failed', error, {
      group: entry?.group || null,
      filterKeys: Array.isArray(entry?.filterKeys) ? [...entry.filterKeys] : [],
      scanSource: entry?.scanSource || 'unknown',
      rootsMode: entry?.roots === null ? 'full' : 'dirty',
      rootCount: Array.isArray(entry?.roots) ? entry.roots.length : 0,
    });
    if (entry?.scanSource === 'update' || entry?.scanSource === 'direct') {
      state._scanFailure = error;
    }
  },

  _isScanDrainIdle() {
    return state._scanQueue.length === 0
      && !state._scanContext
      && !state._scanCandidates
      && !state._scanCollectionPromise
      && !state._scanIdleHandle
      && !state._scanCleanup;
  },

  _settleScanDrain() {
    if (!runtime._isScanDrainIdle() || !state._scanDrainWaiter) return false;
    const waiter = state._scanDrainWaiter;
    const failure = state._scanFailure;
    state._scanDrainWaiter = null;
    state._scanFailure = null;
    if (failure) waiter.reject(failure);
    else waiter.resolve(Object.freeze({ completed: true, superseded: false }));
    return true;
  },

  _waitForScanDrain() {
    if (runtime._isScanDrainIdle()) {
      const failure = state._scanFailure;
      state._scanFailure = null;
      if (failure) return Promise.reject(failure);
      return Promise.resolve(Object.freeze({ completed: true, superseded: false }));
    }
    if (state._scanDrainWaiter) return state._scanDrainWaiter.promise;
    let resolve;
    let reject;
    const promise = new Promise((resolvePromise, rejectPromise) => {
      resolve = resolvePromise;
      reject = rejectPromise;
    });
    state._scanDrainWaiter = Object.freeze({ promise, resolve, reject });
    return promise;
  },

  _cancelScan() {
    const scanContext = state._scanContext;
    if (scanContext?.collectionState === 'pending') scanContext.collectionState = 'cancelled';
    const drainWaiter = state._scanDrainWaiter;
    let cleanupError = null;
    try {
      cancelSocialMetricScan(state);
    } catch (error) {
      cleanupError = error;
    }
    if (scanContext?._debugOperation) {
      diagnosticsPort.finishScanOperation(
        scanContext,
        cleanupError ? 'failed' : 'cancelled',
        cleanupError,
      );
    }
    state._scanDrainWaiter = null;
    state._scanFailure = null;
    if (drainWaiter) {
      drainWaiter.resolve(Object.freeze({ completed: false, superseded: true }));
    }
    diagnosticsPort.clearMutationScheduleContext();
    if (cleanupError) throw cleanupError;
  },

  _startNextScan() {
    startNextSocialMetricScan(
      state,
      runtime._getScanControllerHelpers(),
    );
  },

  _scheduleScanChunk() {
    scheduleSocialMetricScanChunk(
      state,
      runtime._getScanControllerHelpers(),
    );
  },

  _applyScanCandidate(el, ctx) {
    diagnosticsPort.recordProcessedCandidate();
    const auditEnabled = diagnosticsPort.isAuditEnabled();
    const timingEnabled = auditEnabled && Boolean(ctx?._debugOperation);
    const startedAt = timingEnabled ? nowMs() : 0;
    try {
      ownedMutationPort.runWithCandidateWriteCapture(
        ctx,
        () => applyMetricScanCandidate(el, ctx, ownerPort.getCandidateMatcherHelpers()),
      );
    } finally {
      if (timingEnabled) {
        diagnosticsPort.recordScanApplyTiming(ctx, Math.max(0, nowMs() - startedAt));
      }
    }
  },

  _runScanChunk(deadline) {
    const scanContext = state._scanContext;
    ownedMutationPort.runWithScanChunkMutationCapture(
      scanContext,
      () => runSocialMetricScanChunk(state, deadline, runtime._getScanControllerHelpers()),
    );
  },

  _getCompiledPlanForGroup(group) {
    return ownerPort.readScanConfiguration().compiledScanPlans.find(
      (plan) => plan.group === group,
    ) || null;
  },

  _validateCandidateSelector(entry = {}) {
    const selector = entry.joinedSelector
      || (Array.isArray(entry.list) ? entry.list.join(',') : '');
    if (!selector) return;
    try {
      document.documentElement?.matches?.(selector);
    } catch (error) {
      runtime._reportCandidateCollectionFailure('candidate_selector_query', error, entry, {
        joinedSelector: compactSelector(selector),
      });
      throw error;
    }
  },

  _scanAndMarkGroup(group, filterKeys = [], {
    roots = null,
    forceFull = false,
    source = 'direct',
    debugScheduleContext = null,
    routingEvidence = null,
    fullScanEvidence = null,
    causalRoots = [],
  } = {}) {
    if (!SOCIAL_METRIC_GROUPS.includes(group) || filterKeys.length === 0) return;
    const plan = runtime._getCompiledPlanForGroup(group);
    if (!plan) return;
    const resolvedFilterKeys = plan.filterKeys.filter((key) => filterKeys.includes(key));
    if (resolvedFilterKeys.length === 0) return;

    const attr = group === 'engagement'
      ? SOCIAL_METRIC_ATTRS.ENGAGEMENT
      : SOCIAL_METRIC_ATTRS.EXPOSURE;
    const normalizedRoots = (forceFull || roots === null) ? null : ownerPort.normalizeRoots(roots);
    const relevantRoots = normalizedRoots === null
      ? null
      : routingEvidence?.rootsPrevalidated === true
        ? normalizedRoots
        : ownerPort.filterScanRootsForGroup(group, resolvedFilterKeys, normalizedRoots);
    if (Array.isArray(normalizedRoots) && relevantRoots.length === 0) {
      diagnosticsPort.recordSkippedRootScan(group, resolvedFilterKeys, normalizedRoots);
      return;
    }

    const nextEntry = {
      ...plan,
      attr,
      group,
      filterKeys: resolvedFilterKeys,
      roots: relevantRoots,
      causalRoots: ownerPort.normalizeRoots(causalRoots),
      dirtyFacebookMetadataClusters: new Set(),
      dirtyMetadataRows: new Set(),
      dirtyXMetadataClusters: new Set(),
      dirtyRedditTimeNodes: new Set(),
      scanSource: source,
      routingEvidence,
      fullScanEvidence,
      activationSignature: ownerPort.readScanConfiguration().lastUpdateSignature,
      debugScheduleContext: diagnosticsPort.isAuditEnabled()
        ? (debugScheduleContext || { scheduledAt: nowMs(), flushIds: [] })
        : null,
    };
    if (source === 'update' || source === 'direct') {
      runtime._validateCandidateSelector(nextEntry);
    }
    const existingIndex = state._scanQueue.findIndex((entry) => entry.group === group);
    diagnosticsPort.recordQueuedScan(
      group,
      resolvedFilterKeys,
      relevantRoots,
      forceFull,
      existingIndex >= 0 ? 'merged' : 'enqueued',
      routingEvidence,
    );
    if (existingIndex >= 0) {
      const current = state._scanQueue[existingIndex];
      let mergedRoots = null;
      if (current.roots !== null && nextEntry.roots !== null) {
        mergedRoots = ownerPort.normalizeRoots([...current.roots, ...nextEntry.roots]);
      }
      const fullDominantEntry = current.roots === null
        ? current
        : (nextEntry.roots === null ? nextEntry : null);
      state._scanQueue[existingIndex] = {
        ...nextEntry,
        filterKeys: Array.from(new Set([...(current.filterKeys || []), ...nextEntry.filterKeys])),
        roots: mergedRoots,
        causalRoots: ownerPort.normalizeRoots([
          ...(current.causalRoots || []),
          ...(nextEntry.causalRoots || []),
        ]),
        scanSource: fullDominantEntry?.scanSource || nextEntry.scanSource,
        routingEvidence: {
          mutationKinds: Array.from(new Set([
            ...(current.routingEvidence?.mutationKinds || []),
            ...(nextEntry.routingEvidence?.mutationKinds || []),
          ])),
          attributeNames: Array.from(new Set([
            ...(current.routingEvidence?.attributeNames || []),
            ...(nextEntry.routingEvidence?.attributeNames || []),
          ])),
          rootsPrevalidated: current.routingEvidence?.rootsPrevalidated === true
            && nextEntry.routingEvidence?.rootsPrevalidated === true,
        },
        fullScanEvidence: fullDominantEntry?.fullScanEvidence || nextEntry.fullScanEvidence,
        activationSignature: fullDominantEntry?.activationSignature || nextEntry.activationSignature,
        debugScheduleContext: current.debugScheduleContext || nextEntry.debugScheduleContext
          ? {
            scheduledAt: Math.min(
              Number(current.debugScheduleContext?.scheduledAt) || Number.POSITIVE_INFINITY,
              Number(nextEntry.debugScheduleContext?.scheduledAt) || Number.POSITIVE_INFINITY,
            ),
            flushIds: Array.from(new Set([
              ...(current.debugScheduleContext?.flushIds || []),
              ...(nextEntry.debugScheduleContext?.flushIds || []),
            ])).slice(-SOCIAL_METRICS_CORRELATION_LIMIT),
          }
          : null,
      };
    } else {
      state._scanQueue.push(nextEntry);
    }
    runtime._startNextScan();
  },

  _scanAndMark(group, filterKeys = [], options = {}) {
    runtime._scanAndMarkGroup(group, filterKeys, options);
  },

  _scheduleScan(payload = null, debugContext = null) {
    scheduleMutationDrivenSocialMetricScan(
      state,
      payload,
      runtime._getScanControllerHelpers(),
      debugContext,
    );
  },

  _clearScanTimer() {
    if (!state._scanTimer) return;
    try {
      clearTimeout(state._scanTimer);
      state._scanTimer = null;
    } catch (error) {
      reportFailure('scan_timer_clear', error);
      throw error;
    }
  },

  _resetScanRuntimeState() {
    if (state._scanCleanupTimer !== null) clearTimeout(state._scanCleanupTimer);
    state._scanCleanup = null;
    state._scanCleanupTimer = null;
    state._pendingMutationRoots.clear();
    state._pendingMutationRoutes.clear();
    state._forceFullScan = false;
    state._scanPhase = 'settled';
    state._scanCollectionPromise = null;
    state._scanFailure = null;
  },

  cancel() {
    return runtime._cancelScan();
  },

  clearTimer() {
    return runtime._clearScanTimer();
  },

  whenSettled() {
    return runtime._waitForScanDrain();
  },

  getCompiledPlanForGroup(group) {
    return runtime._getCompiledPlanForGroup(group);
  },

  readSnapshot() {
    return Object.freeze({
      currentScanContext: state._scanContext,
      scanPhase: state._scanPhase,
      collectionScheduled: Boolean(state._scanCollectionPromise),
      forceFullScan: state._forceFullScan,
      idleScheduled: Boolean(state._scanIdleHandle),
      pendingMutationRootCount: state._pendingMutationRoots.size,
      queueLength: state._scanQueue.length,
      scanCandidateCount: Array.isArray(state._scanCandidates)
        ? state._scanCandidates.length
        : 0,
      scanCleanupPending: typeof state._scanCleanup === 'function',
      scanCleanupDeadlineScheduled: state._scanCleanupTimer !== null,
      scanCursor: state._scanCursor,
      scanTimerScheduled: Boolean(state._scanTimer),
    });
  },

  resetRuntimeState() {
    return runtime._resetScanRuntimeState();
  },

  scanAndMark(group, filterKeys = [], options = {}) {
    return runtime._scanAndMarkGroup(group, filterKeys, options);
  },

  scheduleScan(payload = null, debugContext = null) {
    return runtime._scheduleScan(payload, debugContext);
  },
  });
  return runtime;
}
