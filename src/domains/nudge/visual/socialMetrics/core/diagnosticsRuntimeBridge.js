import { isFrictionDebugEnabled } from '@friction-debug-flags';
import { recordRuntimeDiscoveryVisit } from '@runtime-discovery-ledger';
import { resolveSiteId } from '../../../targeting/siteIdentityCatalog.js';
import {
  SOCIAL_METRIC_ATTRS,
} from '../../../core/index.js';
import {
  createDocumentNodeIdentityRegistry,
} from './documentNodeIdentity.js';
import {
  createSocialMetricsDiagnosticsSnapshotRuntime,
} from './diagnosticsSnapshotRuntime.js';
import {
  compactText,
  roundMs,
} from './diagnosticsValueUtils.js';
import {
  SOCIAL_METRICS_AUDIT_MODES,
  SOCIAL_METRICS_DEEP_COLLECTION_LIMIT,
  SOCIAL_METRICS_DEEP_SELECTOR_LIMIT,
  beginSocialMetricsScanChunk,
  consumeSocialMetricsMutationSchedule,
  createSocialMetricsDebugStats,
  finishSocialMetricsScanChunk,
  finishSocialMetricsScanOperation,
  normalizeSocialMetricsAuditMode,
  recordSocialMetricsConfigurationCleanup,
  recordSocialMetricsMutationSchedule,
  recordSocialMetricsScanApply,
  recordSocialMetricsScanCleanup,
  recordSocialMetricsScanCollection,
  recordSocialMetricsScanIdleScheduled,
  readSocialMetricsCandidateProvenance,
  recordSocialMetricsCandidateProvenance,
  recordSocialMetricsSelectorDriftRecovery,
  recordSocialMetricsTerminalDisposition,
  recordSocialMetricsWriteAttempt,
  startSocialMetricsScanOperation,
} from './debugInstrumentation.js';

export {
  SOCIAL_METRICS_AUDIT_MODES,
  normalizeSocialMetricsAuditMode,
};

const AUDIT_RECENT_LIMIT = 20;
const AUDIT_ROOT_LIMIT = 4;
const AUDIT_STACK_CANDIDATE_THRESHOLD = 80;

function classifyTargetingHealthDecisionKind(action) {
  const normalized = String(action || '');
  if (!normalized) return 'unknown';
  if (normalized.startsWith('clear:') || normalized === 'skip:empty-text') return 'clear';
  if (
    normalized.startsWith('mark:')
    || normalized.startsWith('replace:')
    || normalized.startsWith('collapse:')
    || (normalized.startsWith('skip:') && normalized.endsWith('-unchanged'))
  ) return 'apply';
  return 'unknown';
}

function requireTargetingHealthCount(value, field) {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new Error(`SOCIAL_METRICS_TARGETING_HEALTH_${field.toUpperCase()}_INVALID`);
  }
  return value;
}

function getElementDescriptor(el) {
  if (!(el instanceof Element)) return null;
  const tag = String(el.tagName || '').toLowerCase();
  const id = el.id ? `#${el.id}` : '';
  const classes = Array.from(el.classList || []).slice(0, 3).map((name) => `.${name}`).join('');
  return `${tag}${id}${classes}`;
}

function summarizeRootElement(el) {
  if (!(el instanceof Element)) return null;
  const path = [];
  let current = el;
  for (let depth = 0; current instanceof Element && depth < 4; depth += 1) {
    path.unshift(getElementDescriptor(current));
    current = current.parentElement;
  }
  return {
    node: getElementDescriptor(el),
    path: path.filter(Boolean).join(' > '),
    aria: compactText(el.getAttribute?.('aria-label')),
    original: compactText(el.getAttribute?.(SOCIAL_METRIC_ATTRS.ORIGINAL_TEXT)),
  };
}

function summarizeElement(el) {
  const rootSummary = summarizeRootElement(el);
  if (!rootSummary) return null;
  return {
    node: rootSummary.node,
    path: rootSummary.path,
    text: compactText(el.textContent),
    aria: rootSummary.aria,
    original: rootSummary.original,
  };
}

function summarizeTargets(target) {
  if (Array.isArray(target)) {
    return target
      .filter((entry) => entry instanceof Element)
      .slice(0, 4)
      .map((entry) => summarizeElement(entry));
  }
  if (target instanceof Element) return summarizeElement(target);
  return null;
}

function pushRecent(list, entry, limit = AUDIT_RECENT_LIMIT) {
  if (!Array.isArray(list)) return;
  list.push(entry);
  if (list.length > limit) {
    list.splice(0, list.length - limit);
  }
}

function captureStack(reason) {
  try {
    const stack = new Error(reason).stack || '';
    return stack.split('\n').slice(1, 7).map((line) => line.trim()).filter(Boolean);
  } catch (_) {
    return [];
  }
}

export function createSocialMetricsDiagnosticsRuntime({
  ownerPort,
  scanPort,
  ownedMutationPort,
  isAuditEnabled = isFrictionDebugEnabled,
} = {}) {
  if (
    typeof ownerPort?.getHost !== 'function'
    || typeof ownerPort?.readLifecycleSnapshot !== 'function'
  ) {
    throw new Error('SOCIAL_METRICS_DIAGNOSTICS_OWNER_PORT_REQUIRED');
  }
  if (typeof scanPort?.readSnapshot !== 'function') {
    throw new Error('SOCIAL_METRICS_DIAGNOSTICS_SCAN_PORT_REQUIRED');
  }
  if (
    typeof ownedMutationPort?.syncObservationContext !== 'function'
    || typeof ownedMutationPort?.getPendingSnapshot !== 'function'
    || typeof ownedMutationPort?.getActiveCandidateWriteCapture !== 'function'
  ) {
    throw new Error('SOCIAL_METRICS_DIAGNOSTICS_OWNED_MUTATION_PORT_REQUIRED');
  }
  if (typeof isAuditEnabled !== 'function') {
    throw new Error('SOCIAL_METRICS_DIAGNOSTICS_AUDIT_READER_REQUIRED');
  }
  const state = {
    _pendingMutationDebug: null,
    _auditMode: SOCIAL_METRICS_AUDIT_MODES.STANDARD,
    _debugScanSequence: 0,
    _debugMeasurementEpoch: 0,
    _debugMeasurementEpochStartExecutedScans: 0,
    _debugStats: createSocialMetricsDebugStats(),
    _nodeIdentityRegistry: null,
    _appliedDecisionCountsByNode: new WeakMap(),
    _actualWriteTargets: new WeakSet(),
  };
  const snapshotStatePort = Object.freeze({
    isAuditEnabled: () => isAuditEnabled(),
    readSnapshotState: () => Object.freeze({
      auditMode: state._auditMode,
      measurementEpoch: state._debugMeasurementEpoch,
      measurementEpochStartExecutedScans: state._debugMeasurementEpochStartExecutedScans,
      debugStats: state._debugStats,
    }),
  });
  const snapshotRuntime = createSocialMetricsDiagnosticsSnapshotRuntime({
    ownerPort,
    scanPort,
    ownedMutationPort,
    statePort: snapshotStatePort,
  });
  const runtime = Object.freeze({
    setDebugAuditMode(mode, { reset = true } = {}) {
      const normalized = normalizeSocialMetricsAuditMode(mode);
      state._auditMode = normalized;
      if (reset) {
        runtime.resetDebugSnapshot();
      } else if (state._debugStats?.audit) {
        state._debugStats.audit.mode = normalized;
      }
      return normalized;
    },

    _isSelectorAuditEnabled() {
      return isAuditEnabled();
    },

    isAuditEnabled() {
      return runtime._isSelectorAuditEnabled();
    },

    recordOwnedMutationLedgerAttempt({ enabled, armed, durationMs } = {}) {
      if (!enabled) return;
      state._debugStats.audit.ownedMutationRecordAttempts += 1;
      if (armed) state._debugStats.audit.ownedMutationRecordsArmed += 1;
      else state._debugStats.audit.ownedMutationRecordRejects += 1;
      state._debugStats.audit.ownedMutationRecordProductMs += Math.max(
        0,
        Number(durationMs) || 0,
      );
    },

    recordOwnedMutationFilter({ enabled, consumedCount, durationMs } = {}) {
      if (enabled) {
        state._debugStats.audit.ownedMutationFilterProductMs += Math.max(
          0,
          Number(durationMs) || 0,
        );
      }
      if ((Number(consumedCount) || 0) > 0) {
        state._debugStats.selfMutationRecordsConsumed += Number(consumedCount) || 0;
      }
    },

    recordWriteAttempt(ctx, details) {
      recordSocialMetricsWriteAttempt(state, ctx, details);
    },

    recordWriteProbeDuration(durationMs) {
      state._debugStats.audit.writeProbeMs += Math.max(0, Number(durationMs) || 0);
    },

    registerActualWriteTarget(target) {
      if (!(target instanceof Element) || state._actualWriteTargets.has(target)) return false;
      state._actualWriteTargets.add(target);
      return true;
    },

    getNodeIdentity(node) {
      return runtime._getNodeIdentity(node);
    },

    formatNodeIdentity(identity) {
      return runtime._formatNodeIdentity(identity);
    },

    _isDeepSelectorAuditEnabled() {
      return runtime._isSelectorAuditEnabled()
        && state._auditMode === SOCIAL_METRICS_AUDIT_MODES.DEEP;
    },

    _canRunDeepSelectorProbe() {
      return runtime._isDeepSelectorAuditEnabled()
        && state._debugStats.audit.deepProbeCollections < SOCIAL_METRICS_DEEP_COLLECTION_LIMIT;
    },

    _startScanOperation(entry = {}) {
      const lifecycle = ownerPort.readLifecycleSnapshot();
      const siteId = resolveSiteId(ownerPort.getHost());
      return startSocialMetricsScanOperation(state, entry, {
        enabled: runtime._isSelectorAuditEnabled(),
        activationSignature: entry.activationSignature ?? lifecycle.lastUpdateSignature,
        getNodeIdentity: (root) => runtime._getNodeIdentity(root),
        measurementEpoch: state._debugMeasurementEpoch,
        siteId,
      });
    },

    _recordScanCollectionTiming(entry = {}, details = {}) {
      recordSocialMetricsScanCollection(state, entry, details);
    },

    _recordScanIdleScheduled(entry = {}) {
      recordSocialMetricsScanIdleScheduled(state, entry);
    },

    _beginScanChunk(entry = {}) {
      return beginSocialMetricsScanChunk(state, entry);
    },

    _finishScanChunk(entry = {}, details = {}) {
      finishSocialMetricsScanChunk(state, entry, details);
    },

    _recordScanApplyTiming(entry = {}, durationMs = 0) {
      recordSocialMetricsScanApply(state, entry, durationMs);
    },

    _recordScanCleanupTiming(entry = {}, durationMs = 0) {
      recordSocialMetricsScanCleanup(state, entry, durationMs);
    },

    _recordConfigurationCleanupTiming(durationMs = 0) {
      recordSocialMetricsConfigurationCleanup(state, durationMs);
    },

    _finishScanOperation(entry = {}, outcome = 'completed', error = null) {
      finishSocialMetricsScanOperation(state, entry, outcome, error);
    },

    _recordMutationScheduleContext(debugContext = null) {
      recordSocialMetricsMutationSchedule(state, debugContext, {
        enabled: runtime._isSelectorAuditEnabled(),
      });
    },

    _consumeMutationScheduleContext() {
      return consumeSocialMetricsMutationSchedule(state, {
        enabled: runtime._isSelectorAuditEnabled(),
      });
    },

    clearMutationScheduleContext() {
      state._pendingMutationDebug = null;
    },

    _recordSelectorAudit(entry = {}, audit = {}) {
      const auditState = state._debugStats.audit;
      if (!auditState || !runtime._isSelectorAuditEnabled()) return;
      const operation = entry?._debugOperation;
      if (operation?._statsRef === state._debugStats) {
        operation.selectorHitCount += Number(audit.selectorHits) || 0;
        operation.semanticHitCount += Number(audit.semanticHits) || 0;
      }
      auditState.enabled = true;
      auditState.mode = state._auditMode;
      auditState.selectorCollections += 1;
      auditState.selectorQueries += Number(audit.selectorQueryCount) || 0;
      auditState.configuredSelectors += Number(audit.selectorCount) || 0;
      auditState.selectorHits += Number(audit.selectorHits) || 0;
      auditState.selectorUniqueHits += Number(audit.selectorUniqueHits) || 0;
      auditState.selectorQueryMs += Number(audit.selectorQueryMs) || 0;
      auditState.selectorProbeMs += Number(audit.selectorProbeMs) || 0;
      auditState.selectorProbeQueries += Number(audit.selectorProbeQueries) || 0;
      auditState.selectorProbeHits += Number(audit.selectorProbeHits) || 0;
      auditState.selectorProbeUniqueHits += Number(audit.selectorProbeUniqueHits) || 0;
      if (audit.deepProbed) auditState.deepProbeCollections += 1;
      else if (state._auditMode === SOCIAL_METRICS_AUDIT_MODES.DEEP) {
        auditState.deepProbeSkippedCollections += 1;
      }
      auditState.semanticHits += Number(audit.semanticHits) || 0;
      auditState.selectorOnlyHits += Number(audit.selectorOnlyHits) || 0;
      auditState.semanticOnlyHits += Number(audit.semanticOnlyHits) || 0;
      auditState.selectorSemanticOverlapHits += Number(audit.selectorSemanticOverlapHits) || 0;
      auditState.candidateUnionCollections += 1;
      if ((Number(audit.semanticOnlyHits) || 0) > 0) {
        auditState.semanticRequiredCollections += 1;
      } else {
        auditState.selectorCompleteCollections += 1;
        if ((Number(audit.semanticHits) || 0) > 0) {
          auditState.semanticZeroIncrementCollections += 1;
        }
      }
      auditState.provenanceProbeMs += Number(audit.provenanceProbeMs) || 0;
      auditState.semanticQueryMs += Number(audit.semanticQueryMs) || 0;
      auditState.resolvedCandidates += Number(audit.resolvedCandidates) || 0;

      const roots = Array.isArray(entry.roots) ? entry.roots : [];
      const rootSummaries = roots
        .slice(0, AUDIT_ROOT_LIMIT)
        .map((root) => summarizeRootElement(root))
        .filter(Boolean);
      const selectorBreakdown = Array.isArray(audit.selectorBreakdown)
        ? audit.selectorBreakdown
          .slice()
          .sort((left, right) => (right.hits - left.hits) || (right.durationMs - left.durationMs))
          .slice(0, SOCIAL_METRICS_DEEP_SELECTOR_LIMIT)
        : [];
      const candidateCount = Number(audit.resolvedCandidates) || 0;
      const selectorHits = Number(audit.selectorHits) || 0;
      const selectorProbeHits = Number(audit.selectorProbeHits) || 0;
      const lowYieldMeasured = audit.deepProbed === true;
      const lowYield = lowYieldMeasured
        && selectorProbeHits > 0
        && candidateCount / selectorProbeHits < 0.25;
      if (lowYield) auditState.lowYieldCollections += 1;
      if (candidateCount === 0) {
        auditState.zeroCandidateCollections += 1;
        const rootKey = entry.roots === null
          ? 'full'
          : (rootSummaries.map((root) => root.path || root.node).join('|') || 'dirty:none');
        const zeroKey = `${entry.group || '-'}:${Array.isArray(entry.filterKeys) ? entry.filterKeys.join(',') : '-'}:${rootKey}`;
        auditState.zeroCandidateCollectionCounts[zeroKey] =
          (Number(auditState.zeroCandidateCollectionCounts[zeroKey]) || 0) + 1;
        const zeroKeys = Object.keys(auditState.zeroCandidateCollectionCounts);
        if (zeroKeys.length > 80) {
          zeroKeys.slice(0, zeroKeys.length - 80).forEach((key) => {
            delete auditState.zeroCandidateCollectionCounts[key];
          });
        }
      }

      const shouldCaptureStack =
        audit.deepProbed === true
        && (
          entry.roots === null
          || candidateCount >= AUDIT_STACK_CANDIDATE_THRESHOLD
          || selectorBreakdown.some((item) => item.hits >= AUDIT_STACK_CANDIDATE_THRESHOLD)
        );
      if (shouldCaptureStack) auditState.stackSamples += 1;

      const record = {
        id: auditState.selectorCollections,
        group: entry.group || null,
        filterKeys: Array.isArray(entry.filterKeys) ? [...entry.filterKeys] : [],
        rootsMode: entry.roots === null ? 'full' : 'dirty',
        rootCount: roots.length,
        roots: rootSummaries,
        selectorCount: Number(audit.selectorCount) || 0,
        selectorQueryCount: Number(audit.selectorQueryCount) || 0,
        selectorHits,
        selectorUniqueHits: Number(audit.selectorUniqueHits) || 0,
        selectorQueryMs: roundMs(audit.selectorQueryMs),
        selectorProbeMs: roundMs(audit.selectorProbeMs),
        selectorProbeQueries: Number(audit.selectorProbeQueries) || 0,
        selectorProbeHits,
        selectorProbeUniqueHits: Number(audit.selectorProbeUniqueHits) || 0,
        selectorProbeTruncated: audit.selectorProbeTruncated === true,
        deepProbed: audit.deepProbed === true,
        semanticHits: Number(audit.semanticHits) || 0,
        selectorOnlyHits: Number(audit.selectorOnlyHits) || 0,
        semanticOnlyHits: Number(audit.semanticOnlyHits) || 0,
        selectorSemanticOverlapHits: Number(audit.selectorSemanticOverlapHits) || 0,
        provenanceProbeMs: roundMs(audit.provenanceProbeMs),
        semanticQueryMs: roundMs(audit.semanticQueryMs),
        resolvedCandidates: candidateCount,
        lowYield,
        lowYieldMeasured,
        selectors: selectorBreakdown,
        stack: shouldCaptureStack ? captureStack('SOCIAL_METRICS_SELECTOR_AUDIT') : [],
      };
      auditState.lastCollection = record;
      pushRecent(auditState.recentCollections, record);
    },

    _getNodeIdentityRegistry() {
      if (!state._nodeIdentityRegistry) {
        state._nodeIdentityRegistry = createDocumentNodeIdentityRegistry({ documentRef: document });
      }
      return state._nodeIdentityRegistry;
    },

    _getNodeIdentity(el) {
      if (!(el instanceof Element)) return null;
      return runtime._getNodeIdentityRegistry().getNodeIdentity(el);
    },

    _getDecisionTargets(el, target) {
      const targets = Array.isArray(target) ? target : [target];
      const resolvedTargets = Array.from(new Set(
        targets.filter((entry) => entry instanceof Element),
      ));
      if (resolvedTargets.length > 0) return resolvedTargets;
      return el instanceof Element ? [el] : [];
    },

    _formatNodeIdentity(identity) {
      if (!identity) return 'unknown';
      return `g${identity.generation}:n${identity.nodeId}`;
    },

    _recordCandidateDecision(el, ctx = {}, decision = {}) {
      const auditState = state._debugStats.audit;
      if (!auditState || !runtime._isSelectorAuditEnabled()) return;
      auditState.enabled = true;
      auditState.decisionCount += 1;
      const action = String(decision.action || 'unknown');
      const isClear = action.startsWith('clear') || action.startsWith('skip');
      if (isClear) auditState.clearedDecisionCount += 1;
      else auditState.appliedDecisionCount += 1;

      const candidateIdentity = runtime._getNodeIdentity(el);
      const decisionTargets = runtime._getDecisionTargets(el, decision.target);
      const targetIdentities = decisionTargets.map((target) => runtime._getNodeIdentity(target));
      const targetSummary = summarizeTargets(decision.target);
      const targetKey = targetIdentities
        .map((identity) => runtime._formatNodeIdentity(identity))
        .join('|') || 'unknown';
      const currentTargetCount = Number(auditState.targetDecisionCounts[targetKey]) || 0;
      auditState.targetDecisionCounts[targetKey] = currentTargetCount + 1;
      if (!isClear) {
        const appliedTargetCount = Number(auditState.appliedTargetDecisionCounts[targetKey]) || 0;
        auditState.appliedTargetDecisionCounts[targetKey] = appliedTargetCount + 1;
        decisionTargets.forEach((target) => {
          runtime._recordRuntimeDiscoveryVisit(
            ctx,
            'effect_target',
            target,
            'social_metrics_applied_decision',
          );
          auditState.appliedTargetDecisionCount += 1;
          const exactTargetCount = Number(state._appliedDecisionCountsByNode.get(target)) || 0;
          state._appliedDecisionCountsByNode.set(target, exactTargetCount + 1);
          if (exactTargetCount > 0) auditState.repeatedTargetDecisions += 1;
          else auditState.uniqueAppliedTargetDecisions += 1;
        });
      }
      const keys = Object.keys(auditState.targetDecisionCounts);
      if (keys.length > 80) {
        keys.slice(0, keys.length - 80).forEach((key) => {
          delete auditState.targetDecisionCounts[key];
        });
      }
      const appliedKeys = Object.keys(auditState.appliedTargetDecisionCounts);
      if (appliedKeys.length > 80) {
        appliedKeys.slice(0, appliedKeys.length - 80).forEach((key) => {
          delete auditState.appliedTargetDecisionCounts[key];
        });
      }

      const writeCapture = ownedMutationPort.getActiveCandidateWriteCapture();
      const unchangedByGuard = action.includes('unchanged');
      const writeOutcome = writeCapture?.actualWrites > 0
        ? 'actual_write'
        : ((writeCapture?.writeAttempts > 0 || unchangedByGuard) ? 'unchanged_noop' : 'no_write');
      const operation = ctx?._debugOperation;
      if (operation?._statsRef === state._debugStats) {
        operation.decisionCount += 1;
        operation.lastDecisionKind = classifyTargetingHealthDecisionKind(action);
        operation.lastDecisionWriteOutcome = writeOutcome;
        const targetIdentityKeys = targetIdentities
          .filter(Boolean)
          .map((identity) => runtime._formatNodeIdentity(identity));
        recordSocialMetricsTerminalDisposition(state, ctx, {
          disposition: operation.lastDecisionKind,
          targetIdentityKeys,
          actualWriteTargetIdentityKeys: writeCapture
            ? Array.from(writeCapture.targetIdentityKeys)
            : [],
          unidentifiedTargetCount: decisionTargets.length - targetIdentityKeys.length,
          writeOutcome,
        });
        const candidateProvenance = readSocialMetricsCandidateProvenance(
          state,
          ctx,
          el,
        );
        recordSocialMetricsSelectorDriftRecovery(state, ctx, {
          siteId: operation.siteId,
          matchedKey: decision.matchedKey || null,
          provenance: candidateProvenance,
          surface: decision.recoverySurface || null,
          disposition: operation.lastDecisionKind,
          targetIdentityKeys,
          actualWriteTargetIdentityKeys: writeCapture
            ? Array.from(writeCapture.targetIdentityKeys)
            : [],
          unidentifiedTargetCount: decisionTargets.length - targetIdentityKeys.length,
          writeOutcome,
        });
      }
      if (writeOutcome === 'actual_write') auditState.actualWriteDecisions += 1;
      else if (writeOutcome === 'unchanged_noop') auditState.unchangedNoopDecisions += 1;
      else auditState.noWriteDecisions += 1;
      const record = {
        id: auditState.decisionCount,
        action,
        group: ctx.group || null,
        matchedKey: decision.matchedKey || null,
        rootsMode: ctx.roots === null ? 'full' : 'dirty',
        text: compactText(decision.text),
        label: compactText(decision.label),
        candidate: summarizeElement(el),
        candidateIdentity,
        target: targetSummary,
        targetIdentities,
        targetCount: Array.isArray(decision.target)
          ? decision.target.filter((target) => target instanceof Element).length
          : (decision.target instanceof Element ? 1 : 0),
        writeOutcome,
        writeAttempts: writeCapture?.writeAttempts || 0,
        actualWrites: writeCapture?.actualWrites || 0,
        unchangedWriteAttempts: writeCapture?.unchangedWriteAttempts || 0,
        actualWriteTargets: writeCapture
          ? Array.from(writeCapture.targetIdentityKeys)
          : [],
      };
      auditState.lastDecision = record;
      pushRecent(auditState.recentDecisions, record);
    },

    _recordMutationRootDebug(payload, selectorRoots, semanticRoots, resolvedRoots) {
      const stats = state._debugStats;
      const selectorCount = Array.isArray(selectorRoots) ? selectorRoots.length : 0;
      const semanticCount = Array.isArray(semanticRoots) ? semanticRoots.length : 0;
      const rootCount = Array.isArray(resolvedRoots) ? resolvedRoots.length : 0;
      stats.mutationSchedules += 1;
      stats.selectorRootTotal += selectorCount;
      stats.semanticRootTotal += semanticCount;
      stats.rootTotal += rootCount;
      stats.lastMutationPayload = {
        addedNodes: Array.isArray(payload?.addedNodes) ? payload.addedNodes.length : 0,
        textNodes: Array.isArray(payload?.textNodes) ? payload.textNodes.length : 0,
        attributeTargets: Array.isArray(payload?.attributeTargets) ? payload.attributeTargets.length : 0,
      };
      stats.lastSelectorRootCount = selectorCount;
      stats.lastSemanticRootCount = semanticCount;
      stats.lastMutationRootCount = rootCount;
      if (rootCount === 0) stats.zeroRootSchedules += 1;
      if (rootCount > stats.maxMutationRootCount) stats.maxMutationRootCount = rootCount;
    },

    _recordQueuedScanDebug(
      group,
      filterKeys,
      roots,
      forceFull,
      disposition = 'enqueued',
      routingEvidence = null,
    ) {
      const stats = state._debugStats;
      const rootCount = Array.isArray(roots) ? roots.length : 0;
      stats.queuedScans += 1;
      stats.scanAdmissions += 1;
      if (disposition === 'merged') stats.mergedScans += 1;
      else stats.enqueuedScans += 1;
      if (forceFull || roots === null) {
        stats.fullScans += 1;
        stats.admittedFullScans += 1;
      } else {
        stats.rootScans += 1;
        stats.admittedDirtyScans += 1;
      }
      stats.lastQueuedScan = {
        group,
        filterKeys: Array.isArray(filterKeys) ? [...filterKeys] : [],
        rootsMode: roots === null ? 'full' : 'dirty',
        rootCount,
        forceFull: forceFull === true,
        disposition,
        mutationKinds: Array.isArray(routingEvidence?.mutationKinds)
          ? [...routingEvidence.mutationKinds]
          : [],
        attributeNames: Array.isArray(routingEvidence?.attributeNames)
          ? [...routingEvidence.attributeNames]
          : [],
      };
    },

    _recordSkippedRootScanDebug(group, filterKeys, roots, reason = 'irrelevant_roots') {
      const stats = state._debugStats;
      stats.skippedIrrelevantScans += 1;
      stats.hostRootRelevanceSkips += 1;
      stats.lastSkippedScan = {
        group,
        filterKeys: Array.isArray(filterKeys) ? [...filterKeys] : [],
        rootsMode: Array.isArray(roots) ? 'dirty' : 'full',
        rootCount: Array.isArray(roots) ? roots.length : 0,
        reason,
      };
    },

    _recordCandidateCollectionDebug(entry, count) {
      const stats = state._debugStats;
      const candidateCount = Math.max(0, Number(count) || 0);
      stats.candidateCollections += 1;
      stats.lastCandidateCount = candidateCount;
      if (candidateCount > stats.maxCandidateCount) stats.maxCandidateCount = candidateCount;
      stats.lastCandidateCollection = {
        group: entry?.group || null,
        rootsMode: entry?.roots === null ? 'full' : 'dirty',
        rootCount: Array.isArray(entry?.roots) ? entry.roots.length : 0,
      };
    },

    _recordMutationRoutingDebug(routes, dispositions, roots) {
      const { activeScanGroups } = ownerPort.readLifecycleSnapshot();
      const mutationRuleSkips = dispositions.filter((
        entry,
      ) => entry.disposition === 'mutation_rule_skipped').length;
      const hostRootRelevanceSkips = dispositions.filter((
        entry,
      ) => entry.disposition === 'host_root_relevance_skipped').length;
      const skippedGroupCount = mutationRuleSkips + hostRootRelevanceSkips;
      state._debugStats.routedMutationGroups += routes.length;
      state._debugStats.skippedMutationGroups += skippedGroupCount;
      state._debugStats.routedRuleSkips += mutationRuleSkips;
      dispositions
        .filter((entry) => entry.disposition === 'host_root_relevance_skipped')
        .forEach((entry) => {
          const activeGroup = activeScanGroups.find(({ group }) => group === entry.group);
          runtime._recordSkippedRootScanDebug(
            entry.group,
            activeGroup?.filterKeys || [],
            roots,
            'host_root_relevance',
          );
        });
      state._debugStats.lastMutationRouting = {
        routeCount: routes.length,
        skippedGroupCount,
        mutationRuleSkipCount: mutationRuleSkips,
        hostRootRelevanceSkipCount: hostRootRelevanceSkips,
        routes: routes.map((route) => ({
          group: route.group,
          filterKeys: [...route.filterKeys],
          rootCount: route.roots.length,
          mutationKinds: [...route.mutationKinds],
          attributeNames: [...route.attributeNames],
        })),
      };
    },

    _recordProcessedCandidate() {
      state._debugStats.processedCandidates += 1;
    },

    _recordScanRootDiscoveryVisit(entry, node) {
      return runtime._recordRuntimeDiscoveryVisit(
        entry,
        'scan_root',
        node,
        entry?.roots === null ? 'social_metrics_full_scope' : 'social_metrics_dirty_scope',
      );
    },

    _recordCandidateDiscoveryVisit(entry, node) {
      return runtime._recordRuntimeDiscoveryVisit(
        entry,
        'candidate_visit',
        node,
        'social_metrics_selector_semantic_union',
      );
    },

    _recordRuntimeDiscoveryVisit(entry, phase, node, ownerReason) {
      const operation = entry?._debugOperation;
      if (!operation) return false;
      return recordRuntimeDiscoveryVisit({
        ownerId: 'socialMetrics',
        phase,
        node,
        flushIds: operation.flushIds,
        workReason: operation.workReason,
        ownerReason,
        source: operation.source,
      });
    },

    getTargetingHealthSnapshot() {
      return snapshotRuntime.getTargetingHealthSnapshot();
    },

    getDebugSnapshot() {
      return snapshotRuntime.getDebugSnapshot();
    },

    resetDebugSnapshot() {
      state._pendingMutationDebug = null;
      state._debugStats = createSocialMetricsDebugStats(state._auditMode);
      state._debugMeasurementEpochStartExecutedScans = 0;
      state._appliedDecisionCountsByNode = new WeakMap();
      state._actualWriteTargets = new WeakSet();
      state._nodeIdentityRegistry?.reset();
    },

    beginDebugMeasurementEpoch() {
      const measurementEpoch = requireTargetingHealthCount(
        state._debugMeasurementEpoch,
        'measurement_epoch',
      );
      const executedScans = requireTargetingHealthCount(
        state._debugStats?.executedScans,
        'executed_scan_count',
      );
      if (!Number.isSafeInteger(measurementEpoch + 1)) {
        throw new Error('SOCIAL_METRICS_TARGETING_HEALTH_MEASUREMENT_EPOCH_INVALID');
      }
      state._debugMeasurementEpoch = measurementEpoch + 1;
      state._debugMeasurementEpochStartExecutedScans = executedScans;
      state._appliedDecisionCountsByNode = new WeakMap();
      state._actualWriteTargets = new WeakSet();
      state._nodeIdentityRegistry?.reset();
      return state._debugMeasurementEpoch;
    },

    startScanOperation(entry = {}) {
      return runtime._startScanOperation(entry);
    },

    recordCandidateProvenance(entry = {}, candidate = null, provenance = null) {
      return recordSocialMetricsCandidateProvenance(
        state,
        entry,
        candidate,
        provenance,
      );
    },

    recordScanCollectionTiming(entry = {}, details = {}) {
      return runtime._recordScanCollectionTiming(entry, details);
    },

    recordSelectorAudit(entry = {}, audit = {}) {
      return runtime._recordSelectorAudit(entry, audit);
    },

    recordCandidateDecision(element, context = {}, decision = {}) {
      return runtime._recordCandidateDecision(element, context, decision);
    },

    finishScanOperation(entry = {}, outcome = 'completed', error = null) {
      return runtime._finishScanOperation(entry, outcome, error);
    },

    resetRuntimeState() {
      state._appliedDecisionCountsByNode = new WeakMap();
      state._actualWriteTargets = new WeakSet();
      state._nodeIdentityRegistry?.reset();
    },
  });
  return runtime;
}
