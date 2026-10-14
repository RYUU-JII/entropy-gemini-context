const SCAN_CHUNK_SIZE = 96;
const SCAN_WORK_SLICE_BUDGET_MS = 3;
const SCAN_CLEANUP_MAX_DEFERRAL_MS = 48;
const IDLE_TIMEOUT_MS = 200;
const SCAN_DEBOUNCE_MS = 100;
const ROUTE_CORRELATION_LIMIT = 20;
const MUTATION_SCAN_SOURCE = 'mutation';
const FULL_SCAN_SOURCE = 'scheduled_full';

function nowMs() {
  if (typeof performance !== 'undefined' && typeof performance.now === 'function') {
    return performance.now();
  }
  return Date.now();
}

function getDebugFlushIds(debugContext) {
  const values = Array.isArray(debugContext?.flushIds)
    ? debugContext.flushIds
    : [debugContext?.flushId];
  return values
    .filter((value) => value !== null && value !== undefined)
    .map(Number)
    .filter((value) => Number.isFinite(value));
}

function hasScanChunkBudget(deadline, startedAt, processed) {
  if (processed === 0) return true;
  if (nowMs() - startedAt >= SCAN_WORK_SLICE_BUDGET_MS) return false;
  if (deadline?.didTimeout === true) return true;
  return Number(deadline?.timeRemaining?.()) > 1;
}

function mergeRouteDebugScheduleContext(current, debugContext) {
  if (!debugContext || typeof debugContext !== 'object') return current || null;
  const scheduledAt = Number(debugContext.scheduledAt);
  const currentScheduledAt = Number(current?.scheduledAt);
  const nextScheduledAt = Number.isFinite(scheduledAt) ? scheduledAt : nowMs();
  return {
    scheduledAt: Math.min(
      Number.isFinite(currentScheduledAt) ? currentScheduledAt : Number.POSITIVE_INFINITY,
      nextScheduledAt,
    ),
    flushIds: Array.from(new Set([
      ...(current?.flushIds || []),
      ...getDebugFlushIds(debugContext),
    ])).slice(-ROUTE_CORRELATION_LIMIT),
  };
}

function findQueuedGroupIndex(manager, group) {
  if (!Array.isArray(manager?._scanQueue)) return -1;
  return manager._scanQueue.findIndex((entry) => entry?.group === group);
}

function hasQueuedDominantFullScan(manager, group) {
  const index = findQueuedGroupIndex(manager, group);
  if (index < 0) return false;
  const entry = manager._scanQueue[index];
  return entry?.roots === null && entry?.scanSource === FULL_SCAN_SOURCE;
}

function enforceQueuedFullDominance(manager, group, fullScanEvidence = null) {
  const index = findQueuedGroupIndex(manager, group);
  if (index < 0) return;
  const entry = manager._scanQueue[index];
  manager._scanQueue[index] = {
    ...entry,
    roots: null,
    scanSource: FULL_SCAN_SOURCE,
    routingEvidence: null,
    fullScanEvidence: fullScanEvidence || entry.fullScanEvidence || null,
  };
}

function createDirtyRootSufficiencyEvidence(route) {
  const dirtyRootCount = route?.roots instanceof Set
    ? route.roots.size
    : (Array.isArray(route?.roots) ? route.roots.length : 0);
  if (dirtyRootCount > 0 && route?.rootsPrevalidated === true) {
    return {
      dirtyRootsSufficient: true,
      dirtyRootCount,
      reason: 'prevalidated_routed_dirty_roots_available',
    };
  }
  return {
    dirtyRootsSufficient: null,
    dirtyRootCount,
    reason: dirtyRootCount > 0
      ? 'dirty_root_prevalidation_unavailable'
      : 'routed_dirty_roots_unavailable',
  };
}

function scheduleIdleWork(fn) {
  if (typeof requestIdleCallback === 'function') {
    return { id: requestIdleCallback(fn, { timeout: IDLE_TIMEOUT_MS }), type: 'idle' };
  }
  const id = setTimeout(() => fn({ didTimeout: true, timeRemaining: () => 0 }), 0);
  return { id, type: 'timeout' };
}

function cancelIdleWork(handle) {
  if (!handle) return;
  if (handle.type === 'idle' && typeof cancelIdleCallback === 'function') {
    cancelIdleCallback(handle.id);
    return;
  }
  clearTimeout(handle.id);
}

function clearScanCleanupDeadline(manager) {
  if (manager._scanCleanupTimer === null || manager._scanCleanupTimer === undefined) return;
  clearTimeout(manager._scanCleanupTimer);
  manager._scanCleanupTimer = null;
}

function attemptPendingScanCleanup(manager) {
  if (typeof manager._scanCleanup !== 'function') return null;
  try {
    manager._scanCleanup();
    return null;
  } catch (error) {
    return error;
  }
}

function attemptScanContextCleanup(manager, helpers, scanContext) {
  if (typeof manager._scanCleanup === 'function') {
    return attemptPendingScanCleanup(manager);
  }
  try {
    helpers.flushCleanupQueues(scanContext);
    return null;
  } catch (error) {
    return error;
  }
}

function clearActiveScanState(manager, { preserveCleanup = false } = {}) {
  clearScanCleanupDeadline(manager);
  if (!preserveCleanup) manager._scanCleanup = null;
  manager._scanCollectionPromise = null;
  manager._scanCandidates = null;
  manager._scanContext = null;
  manager._scanCursor = 0;
  manager._scanPhase = 'settled';
}

function settleAsyncCleanupFailure(manager, helpers, scanContext, cleanupError) {
  if (manager._scanIdleHandle) {
    cancelIdleWork(manager._scanIdleHandle);
    manager._scanIdleHandle = null;
  }
  clearActiveScanState(manager, { preserveCleanup: true });
  helpers.finishScanOperation?.(scanContext, 'failed', cleanupError);
  helpers.handleScanFailure?.(scanContext, cleanupError);
  if (scanContext?.scanSource === 'update' || scanContext?.scanSource === 'direct') {
    throw cleanupError;
  }
}

function scheduleScanCleanupDeadline(manager, helpers) {
  if (manager._scanCleanupTimer !== null && manager._scanCleanupTimer !== undefined) return;
  if (typeof manager._scanCleanup !== 'function') return;
  manager._scanCleanupTimer = setTimeout(() => {
    manager._scanCleanupTimer = null;
    const scanContext = manager._scanContext;
    if (!manager._scanCandidates || !scanContext) return;
    const cleanupError = attemptPendingScanCleanup(manager);
    if (cleanupError) settleAsyncCleanupFailure(manager, helpers, scanContext, cleanupError);
  }, SCAN_CLEANUP_MAX_DEFERRAL_MS);
}

export function cancelSocialMetricScan(manager) {
  const activeContext = manager._scanContext || null;
  const queuedEntries = Array.isArray(manager._scanQueue) ? [...manager._scanQueue] : [];
  let cleanupError = null;
  manager._scanGeneration = (Number(manager._scanGeneration) || 0) + 1;
  if (manager._scanIdleHandle) {
    cancelIdleWork(manager._scanIdleHandle);
    manager._scanIdleHandle = null;
  }
  clearScanCleanupDeadline(manager);
  cleanupError = attemptPendingScanCleanup(manager);
  clearActiveScanState(manager, { preserveCleanup: Boolean(cleanupError) });
  manager._scanQueue = [];
  manager._pendingMutationRoots.clear();
  manager._pendingMutationRoutes?.clear?.();
  manager._forceFullScan = false;
  if (cleanupError) throw cleanupError;
  return Object.freeze({ activeContext, queuedEntries });
}

function isPromiseLike(value) {
  return !!(value && typeof value.then === 'function');
}

function isCollectionCurrent(manager, entry, generation) {
  return manager._scanContext === entry
    && manager._scanPhase === 'collecting'
    && (Number(manager._scanGeneration) || 0) === generation;
}

function finishCandidateCollection(manager, helpers, entry, generation, candidates) {
  if (!isCollectionCurrent(manager, entry, generation)) return;
  manager._scanCollectionPromise = null;
  if (!Array.isArray(candidates) || candidates.length === 0) {
    const cleanupError = attemptPendingScanCleanup(manager);
    if (cleanupError) {
      settleAsyncCleanupFailure(manager, helpers, entry, cleanupError);
      return;
    }
    clearActiveScanState(manager);
    helpers.finishScanOperation?.(entry, entry.revalidationEvidenceCount > 0 ? 'completed' : 'empty');
    helpers.settleScanDrain?.();
    startNextSocialMetricScan(manager, helpers);
    return;
  }

  manager._scanCandidates = candidates;
  manager._scanCursor = 0;
  manager._scanPhase = 'applying';
  manager._scanCleanup = () => helpers.flushCleanupQueues(entry);
  scheduleSocialMetricScanChunk(manager, helpers);
}

function failCandidateCollection(manager, helpers, entry, generation, error) {
  if (!isCollectionCurrent(manager, entry, generation)) return;
  manager._scanCollectionPromise = null;
  const cleanupError = attemptPendingScanCleanup(manager);
  if (cleanupError && error && typeof error === 'object') error.cleanupError = cleanupError;
  clearActiveScanState(manager, { preserveCleanup: Boolean(cleanupError) });
  helpers.finishScanOperation?.(entry, 'failed', error);
  helpers.handleScanFailure?.(entry, error);
  if (entry?.scanSource === 'update' || entry?.scanSource === 'direct') {
    manager._scanQueue = [];
    helpers.settleScanDrain?.();
    return;
  }
  helpers.settleScanDrain?.();
  startNextSocialMetricScan(manager, helpers);
}

export function startNextSocialMetricScan(manager, helpers) {
  if (
    manager._scanCandidates
    || manager._scanIdleHandle
    || manager._scanCleanup
    || manager._scanCollectionPromise
    || manager._scanContext
  ) return;
  if (manager._scanQueue.length === 0) return;

  const next = manager._scanQueue.shift();
  helpers.startScanOperation?.(next);
  const generation = Number(manager._scanGeneration) || 0;
  manager._scanContext = next;
  manager._scanPhase = 'collecting';
  if (next.isX) manager._scanCleanup = () => helpers.flushCleanupQueues(next);
  let collectionResult;
  try {
    collectionResult = helpers.collectCandidates(next, {
      isCurrent: () => isCollectionCurrent(manager, next, generation),
    });
  } catch (error) {
    failCandidateCollection(manager, helpers, next, generation, error);
    return;
  }

  if (isPromiseLike(collectionResult)) {
    const collectionPromise = Promise.resolve(collectionResult)
      .then((candidates) => {
        finishCandidateCollection(manager, helpers, next, generation, candidates);
      })
      .catch((error) => {
        failCandidateCollection(manager, helpers, next, generation, error);
      });
    manager._scanCollectionPromise = collectionPromise;
    return;
  }
  finishCandidateCollection(manager, helpers, next, generation, collectionResult);
}

export function scheduleSocialMetricScanChunk(manager, helpers) {
  if (manager._scanIdleHandle) return;
  helpers.recordScanIdleScheduled?.(manager._scanContext);
  manager._scanIdleHandle = scheduleIdleWork((deadline) => {
    manager._scanIdleHandle = null;
    if (typeof helpers.runScanChunk === 'function') helpers.runScanChunk(deadline);
    else runSocialMetricScanChunk(manager, deadline, helpers);
  });
}

export function runSocialMetricScanChunk(manager, deadline, helpers) {
  if (!manager._scanCandidates || !manager._scanContext) return;
  const scanContext = manager._scanContext;
  const chunkStartedAt = helpers.beginScanChunk?.(scanContext) ?? null;
  const workStartedAt = nowMs();
  let processed = 0;

  let applyError = null;
  try {
    while (
      manager._scanCursor < manager._scanCandidates.length &&
      processed < SCAN_CHUNK_SIZE &&
      hasScanChunkBudget(deadline, workStartedAt, processed)
    ) {
      const el = manager._scanCandidates[manager._scanCursor];
      manager._scanCursor += 1;
      processed += 1;
      helpers.applyScanCandidate(el, scanContext);
    }
  } catch (error) {
    applyError = error;
  }

  try {
    helpers.finishScanChunk?.(scanContext, {
      startedAt: chunkStartedAt,
      processed,
    });
  } catch (finishError) {
    if (applyError && typeof applyError === 'object') applyError.finishChunkError = finishError;
    else applyError = finishError;
  }

  if (applyError) {
    manager._scanPhase = 'terminal_cleanup';
    clearScanCleanupDeadline(manager);
    const cleanupError = attemptScanContextCleanup(manager, helpers, scanContext);
    if (cleanupError && applyError && typeof applyError === 'object') {
      applyError.cleanupError = cleanupError;
    }
    clearActiveScanState(manager, { preserveCleanup: Boolean(cleanupError) });
    helpers.finishScanOperation?.(scanContext, 'failed', applyError);
    helpers.handleScanFailure?.(scanContext, applyError);
    if (scanContext?.scanSource === 'update' || scanContext?.scanSource === 'direct') {
      manager._scanQueue = [];
      helpers.settleScanDrain?.();
      return;
    }
    helpers.settleScanDrain?.();
    if (!cleanupError) startNextSocialMetricScan(manager, helpers);
    return;
  }

  if (manager._scanCursor < manager._scanCandidates.length) {
    scheduleScanCleanupDeadline(manager, helpers);
    scheduleSocialMetricScanChunk(manager, helpers);
    return;
  }

  clearScanCleanupDeadline(manager);
  manager._scanPhase = 'terminal_cleanup';
  const cleanupError = attemptScanContextCleanup(manager, helpers, scanContext);
  clearActiveScanState(manager, { preserveCleanup: Boolean(cleanupError) });
  if (cleanupError) {
    helpers.finishScanOperation?.(scanContext, 'failed', cleanupError);
    helpers.handleScanFailure?.(scanContext, cleanupError);
    if (scanContext?.scanSource === 'update' || scanContext?.scanSource === 'direct') {
      manager._scanQueue = [];
      helpers.settleScanDrain?.();
      return;
    }
    helpers.settleScanDrain?.();
    return;
  }
  helpers.finishScanOperation?.(scanContext, 'completed');
  helpers.settleScanDrain?.();
  startNextSocialMetricScan(manager, helpers);
}

export function scheduleMutationDrivenSocialMetricScan(manager, payload, helpers, debugContext = null) {
  if (!payload) {
    manager._forceFullScan = true;
  } else {
    const roots = helpers.collectMutationRoots(payload);
    if (roots.length === 0) return;
    const routes = helpers.routeMutationGroups?.(payload, roots) || [];
    if (!Array.isArray(routes) || routes.length === 0) return;
    if (!(manager._pendingMutationRoutes instanceof Map)) {
      manager._pendingMutationRoutes = new Map();
    }
    routes.forEach(({
      group,
      filterKeys,
      roots: routeRoots,
      mutationKinds,
      attributeNames,
      causalRoots,
      rootsPrevalidated,
    }) => {
      const existing = manager._pendingMutationRoutes.get(group);
      const pending = existing || {
        group,
        filterKeys: new Set(),
        roots: new Set(),
        mutationKinds: new Set(),
        attributeNames: new Set(),
        causalRoots: new Set(),
        rootsPrevalidated: rootsPrevalidated === true,
        debugScheduleContext: null,
      };
      if (existing) {
        pending.rootsPrevalidated = pending.rootsPrevalidated === true
          && rootsPrevalidated === true;
      }
      (Array.isArray(filterKeys) ? filterKeys : []).forEach((key) => pending.filterKeys.add(key));
      (Array.isArray(mutationKinds) ? mutationKinds : [])
        .forEach((kind) => pending.mutationKinds.add(kind));
      (Array.isArray(attributeNames) ? attributeNames : [])
        .forEach((name) => pending.attributeNames.add(name));
      (Array.isArray(causalRoots) ? causalRoots : [])
        .forEach((root) => pending.causalRoots.add(root));
      (Array.isArray(routeRoots) ? routeRoots : []).forEach((root) => {
        pending.roots.add(root);
        manager._pendingMutationRoots.add(root);
      });
      pending.debugScheduleContext = mergeRouteDebugScheduleContext(
        pending.debugScheduleContext,
        debugContext,
      );
      manager._pendingMutationRoutes.set(group, pending);
    });
  }
  helpers.recordMutationSchedule?.(debugContext);

  if (manager._scanTimer) return;
  manager._scanTimer = setTimeout(() => {
    manager._scanTimer = null;
    const forceFull = manager._forceFullScan;
    const pendingRoutes = manager._pendingMutationRoutes instanceof Map
      ? Array.from(manager._pendingMutationRoutes.values())
      : [];
    const pendingRouteByGroup = new Map(
      pendingRoutes.map((route) => [route.group, route]),
    );
    manager._pendingMutationRoots.clear();
    manager._pendingMutationRoutes?.clear?.();
    manager._forceFullScan = false;
    const debugScheduleContext = helpers.consumeMutationSchedule?.() || null;

    const activeScanGroups = typeof helpers.getActiveScanGroups === 'function'
      ? helpers.getActiveScanGroups()
      : manager._activeScanGroups;
    if (!Array.isArray(activeScanGroups)) {
      throw new Error('SOCIAL_METRICS_ACTIVE_SCAN_GROUPS_REQUIRED');
    }
    const scanGroups = forceFull
      ? activeScanGroups.map(({ group, filterKeys }) => ({
        group,
        filterKeys,
        roots: null,
        fullScanEvidence: createDirtyRootSufficiencyEvidence(
          pendingRouteByGroup.get(group),
        ),
      }))
      : pendingRoutes.map(({
        group,
        filterKeys,
        roots,
        mutationKinds,
        attributeNames,
        causalRoots,
        rootsPrevalidated,
        debugScheduleContext: routeDebugScheduleContext,
      }) => ({
        group,
        filterKeys: Array.from(filterKeys),
        roots: helpers.normalizeRoots(Array.from(roots)),
        causalRoots: helpers.normalizeRoots(Array.from(causalRoots)),
        debugScheduleContext: routeDebugScheduleContext || debugScheduleContext,
        routingEvidence: {
          mutationKinds: Array.from(mutationKinds),
          attributeNames: Array.from(attributeNames),
          rootsPrevalidated: rootsPrevalidated === true,
        },
      }));

    scanGroups.forEach(({
      group,
      filterKeys,
      roots: routedRoots,
      causalRoots = [],
      routingEvidence = null,
      fullScanEvidence = null,
      debugScheduleContext: routedDebugScheduleContext = debugScheduleContext,
    }) => {
      const queuedFullAlreadyDominates = hasQueuedDominantFullScan(manager, group);
      const queuedFullEvidence = queuedFullAlreadyDominates
        ? createDirtyRootSufficiencyEvidence({
          roots: routedRoots,
          rootsPrevalidated: routingEvidence?.rootsPrevalidated === true,
        })
        : null;
      helpers.queueGroupScan(group, filterKeys, {
        roots: forceFull ? null : routedRoots,
        causalRoots: forceFull ? [] : causalRoots,
        forceFull,
        source: forceFull ? FULL_SCAN_SOURCE : MUTATION_SCAN_SOURCE,
        debugScheduleContext: routedDebugScheduleContext,
        routingEvidence,
        fullScanEvidence,
      });
      if (forceFull || queuedFullAlreadyDominates) {
        enforceQueuedFullDominance(
          manager,
          group,
          fullScanEvidence || queuedFullEvidence,
        );
      }
    });
  }, SCAN_DEBOUNCE_MS);
}
