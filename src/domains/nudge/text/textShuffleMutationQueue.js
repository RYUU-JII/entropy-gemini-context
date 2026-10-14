export const TEXT_SHUFFLE_APPLY_CHUNK_SIZE = 150;
export const TEXT_SHUFFLE_APPLY_VISIT_CHUNK_SIZE = 600;
export const TEXT_SHUFFLE_PENDING_SUBTREE_CHUNK_SIZE = 6;
export const TEXT_SHUFFLE_MUTATION_TEXT_CHUNK_SIZE = 100;
export const TEXT_SHUFFLE_MUTATION_SUCCESS_CHUNK_SIZE = 150;
export const TEXT_SHUFFLE_FLUSH_DEBOUNCE_MS = 120;
export const TEXT_SHUFFLE_IDLE_TIMEOUT_MS = 200;
export const TEXT_SHUFFLE_WORK_SLICE_BUDGET_MS = 3;
export const TEXT_SHUFFLE_MAX_RECENT_OPERATIONS = 24;

function createDebugState(wallNow) {
  return {
    startedAt: wallNow(),
    operations: 0,
    observerPayloads: 0,
    mutationInputs: 0,
    enqueuedTextNodes: 0,
    enqueuedSubtrees: 0,
    coalescedTextNodes: 0,
    coalescedSubtrees: 0,
    deferredFlushes: 0,
    coalescedFlushSchedules: 0,
    initialChunks: 0,
    mutationFlushes: 0,
    visitedNodes: 0,
    processedNodes: 0,
    unchangedNodes: 0,
    totalQueueWaitMs: 0,
    totalWorkMs: 0,
    maxWorkMs: 0,
    recentOperations: [],
  };
}

function defaultNow() {
  return performance.now();
}

function scheduleIdleWork(callback) {
  if (typeof requestIdleCallback === 'function') {
    return {
      id: requestIdleCallback(callback, { timeout: TEXT_SHUFFLE_IDLE_TIMEOUT_MS }),
      type: 'idle',
    };
  }
  return {
    id: setTimeout(() => callback({ didTimeout: true, timeRemaining: () => 0 }), 0),
    type: 'timeout',
  };
}

function cancelIdleWork(handle) {
  if (!handle) return;
  if (handle.type === 'idle' && typeof cancelIdleCallback === 'function') {
    cancelIdleCallback(handle.id);
    return;
  }
  clearTimeout(handle.id);
}

function hasWorkBudget(deadline, startedAt, workStarted, now) {
  if (!deadline || !workStarted) return true;
  if (now() - startedAt >= TEXT_SHUFFLE_WORK_SLICE_BUDGET_MS) return false;
  return deadline.didTimeout || deadline.timeRemaining() > 1;
}

function isNodeWithinSubtree(rootNode, node) {
  if (!rootNode || !node) return false;
  if (rootNode === node) return true;
  return typeof rootNode.contains === 'function' && rootNode.contains(node);
}

export function createTextShuffleMutationQueue({
  isRuntimeEnabled,
  processTextNode,
  resolveSubtreeRoots,
  createTextWalker = (rootNode) => document.createTreeWalker(rootNode, NodeFilter.SHOW_TEXT),
  recordRuntimeWork = () => {},
  now = defaultNow,
  wallNow = Date.now,
} = {}) {
  if (typeof isRuntimeEnabled !== 'function') {
    throw new Error('TEXT_SHUFFLE_QUEUE_RUNTIME_STATE_OWNER_REQUIRED');
  }
  if (typeof processTextNode !== 'function') {
    throw new Error('TEXT_SHUFFLE_QUEUE_TEXT_PROCESSOR_REQUIRED');
  }
  if (typeof resolveSubtreeRoots !== 'function') {
    throw new Error('TEXT_SHUFFLE_QUEUE_SUBTREE_RESOLVER_REQUIRED');
  }
  if (typeof createTextWalker !== 'function') {
    throw new Error('TEXT_SHUFFLE_QUEUE_WALKER_OWNER_REQUIRED');
  }
  if (
    typeof recordRuntimeWork !== 'function'
    || typeof now !== 'function'
    || typeof wallNow !== 'function'
  ) {
    throw new Error('TEXT_SHUFFLE_QUEUE_DIAGNOSTICS_OWNER_REQUIRED');
  }

  const pendingSubtrees = new Set();
  const pendingTextNodes = new Set();
  const pendingSubtreeTasks = new Map();
  const pendingSubtreeReplayRoots = new Set();
  let debounceTimer = null;
  let flushIdleHandle = null;
  let applyIdleHandle = null;
  let applyWalker = null;
  let applyRoots = null;
  let applyRootIndex = 0;
  let onInitialPassComplete = null;
  let debugEnabled = false;
  let debugState = createDebugState(wallNow);
  let applyChunkScheduledAt = null;
  let flushScheduledAt = null;

  function recordOperation({
    source,
    startedAt = null,
    visited = 0,
    processed = 0,
    durationMs = 0,
    queueWaitMs = 0,
    queueBefore = null,
    queueAfter = null,
  }) {
    if (!debugEnabled) return;
    const normalizedVisited = Math.max(0, Number(visited) || 0);
    const normalizedProcessed = Math.max(0, Number(processed) || 0);
    const normalizedDurationMs = Math.max(0, Number(durationMs) || 0);
    const normalizedQueueWaitMs = Math.max(0, Number(queueWaitMs) || 0);
    const summary = {
      source,
      visited: normalizedVisited,
      processed: normalizedProcessed,
      unchanged: Math.max(0, normalizedVisited - normalizedProcessed),
      durationMs: Number(normalizedDurationMs.toFixed(2)),
      queueWaitMs: Number(normalizedQueueWaitMs.toFixed(2)),
      ...(queueBefore ? { queueBefore: { ...queueBefore } } : {}),
      ...(queueAfter ? { queueAfter: { ...queueAfter } } : {}),
    };
    debugState.operations += 1;
    if (source === 'initial_chunk') debugState.initialChunks += 1;
    if (source === 'mutation_flush') debugState.mutationFlushes += 1;
    debugState.visitedNodes += summary.visited;
    debugState.processedNodes += summary.processed;
    debugState.unchangedNodes += summary.unchanged;
    debugState.totalQueueWaitMs += normalizedQueueWaitMs;
    debugState.totalWorkMs += normalizedDurationMs;
    debugState.maxWorkMs = Math.max(debugState.maxWorkMs, normalizedDurationMs);
    debugState.recentOperations.push(summary);
    if (debugState.recentOperations.length > TEXT_SHUFFLE_MAX_RECENT_OPERATIONS) {
      debugState.recentOperations.splice(
        0,
        debugState.recentOperations.length - TEXT_SHUFFLE_MAX_RECENT_OPERATIONS,
      );
    }
    if (Number.isFinite(startedAt)) {
      recordRuntimeWork({
        ownerId: 'textShuffle',
        phase: source,
        source,
        startedAt,
        endedAt: startedAt + normalizedDurationMs,
        units: normalizedVisited,
        queueWaitMs: normalizedQueueWaitMs,
      });
    }
  }

  function recordObserverPayload(payload = {}) {
    if (!debugEnabled) return;
    debugState.observerPayloads += 1;
    debugState.mutationInputs += [
      payload.addedNodes,
      payload.removedNodes,
      payload.textNodes,
      payload.attributeTargets,
    ].reduce((total, entries) => total + (Array.isArray(entries) ? entries.length : 0), 0);
  }

  function enqueueTextNode(node) {
    if (!node) return false;
    const alreadyPending = pendingTextNodes.has(node);
    pendingTextNodes.add(node);
    if (debugEnabled) {
      debugState[alreadyPending ? 'coalescedTextNodes' : 'enqueuedTextNodes'] += 1;
    }
    return !alreadyPending;
  }

  function enqueueSubtree(node) {
    if (!node) return false;
    let absorbedRootCount = 0;
    for (const pendingRoot of Array.from(pendingSubtrees)) {
      if (pendingRoot === node) {
        if (pendingSubtreeTasks.has(pendingRoot)) {
          pendingSubtreeReplayRoots.add(pendingRoot);
        }
        if (debugEnabled) debugState.coalescedSubtrees += 1;
        return false;
      }
      const taskStarted = pendingSubtreeTasks.has(pendingRoot);
      if (!taskStarted && isNodeWithinSubtree(pendingRoot, node)) {
        if (debugEnabled) debugState.coalescedSubtrees += 1;
        return false;
      }
      if (!taskStarted && isNodeWithinSubtree(node, pendingRoot)) {
        pendingSubtrees.delete(pendingRoot);
        pendingSubtreeReplayRoots.delete(pendingRoot);
        absorbedRootCount += 1;
      }
    }
    pendingSubtrees.add(node);
    if (debugEnabled) {
      debugState.enqueuedSubtrees += 1;
      debugState.coalescedSubtrees += absorbedRootCount;
    }
    return true;
  }

  function releasePendingWorkInSubtree(rootNode) {
    if (!rootNode) return;
    for (const node of Array.from(pendingTextNodes)) {
      if (isNodeWithinSubtree(rootNode, node)) pendingTextNodes.delete(node);
    }
    for (const pendingRoot of Array.from(pendingSubtrees)) {
      if (!isNodeWithinSubtree(rootNode, pendingRoot)) continue;
      pendingSubtrees.delete(pendingRoot);
      pendingSubtreeTasks.delete(pendingRoot);
      pendingSubtreeReplayRoots.delete(pendingRoot);
    }
    for (const [pendingRoot, task] of Array.from(pendingSubtreeTasks.entries())) {
      const taskRootWasRemoved = task.roots.some((taskRoot) => (
        isNodeWithinSubtree(rootNode, taskRoot)
      ));
      const walkerWasInsideRemovedRoot = isNodeWithinSubtree(
        rootNode,
        task.walker?.currentNode,
      );
      if (!taskRootWasRemoved && !walkerWasInsideRemovedRoot) continue;
      pendingSubtreeTasks.delete(pendingRoot);
      pendingSubtreeReplayRoots.delete(pendingRoot);
      if (!pendingRoot?.isConnected) pendingSubtrees.delete(pendingRoot);
    }
  }

  function cancelPendingFlush() {
    if (debounceTimer) {
      clearTimeout(debounceTimer);
      debounceTimer = null;
    }
    if (flushIdleHandle) {
      cancelIdleWork(flushIdleHandle);
      flushIdleHandle = null;
    }
    flushScheduledAt = null;
  }

  function resetMutationState() {
    cancelPendingFlush();
    pendingSubtrees.clear();
    pendingTextNodes.clear();
    pendingSubtreeTasks.clear();
    pendingSubtreeReplayRoots.clear();
  }

  function finishInitialPass() {
    const completion = onInitialPassComplete;
    onInitialPassComplete = null;
    cancelInitialPass();
    completion?.();
  }

  function advanceApplyWalker({ finishOnExhaustion = true } = {}) {
    if (!applyRoots || applyRootIndex >= applyRoots.length) {
      if (finishOnExhaustion) finishInitialPass();
      return false;
    }
    const nextRoot = applyRoots[applyRootIndex];
    applyRootIndex += 1;
    if (!nextRoot || !nextRoot.isConnected) {
      return advanceApplyWalker({ finishOnExhaustion });
    }
    applyWalker = createTextWalker(nextRoot);
    return true;
  }

  function scheduleApplyChunk() {
    if (applyIdleHandle) return;
    if (debugEnabled) applyChunkScheduledAt = now();
    applyIdleHandle = scheduleIdleWork((deadline) => {
      applyIdleHandle = null;
      const queueWaitMs = applyChunkScheduledAt === null ? 0 : now() - applyChunkScheduledAt;
      applyChunkScheduledAt = null;
      runApplyChunk(deadline, queueWaitMs);
    });
  }

  function runApplyChunk(deadline, queueWaitMs = 0) {
    const operationDebugEnabled = debugEnabled;
    const workStartedAt = now();
    const startedAt = operationDebugEnabled ? workStartedAt : 0;
    let processed = 0;
    let visited = 0;
    let iterations = 0;
    let passComplete = false;
    if (!isRuntimeEnabled()) {
      cancelInitialPass();
      return;
    }
    if (!applyWalker) return;

    try {
      while (
        processed < TEXT_SHUFFLE_APPLY_CHUNK_SIZE
        && visited < TEXT_SHUFFLE_APPLY_VISIT_CHUNK_SIZE
        && hasWorkBudget(deadline, workStartedAt, iterations > 0, now)
      ) {
        iterations += 1;
        const node = applyWalker.nextNode();
        if (!node) {
          if (!advanceApplyWalker({ finishOnExhaustion: false })) {
            passComplete = true;
            break;
          }
          continue;
        }
        visited += 1;
        if (processTextNode(node)) processed += 1;
      }
    } finally {
      if (operationDebugEnabled) {
        recordOperation({
          source: 'initial_chunk',
          startedAt,
          visited,
          processed,
          durationMs: now() - startedAt,
          queueWaitMs,
        });
      }
    }
    if (passComplete) {
      finishInitialPass();
    } else if (applyWalker) {
      scheduleApplyChunk();
    }
  }

  function startInitialPass(roots, { onComplete = null } = {}) {
    if (!Array.isArray(roots)) throw new Error('TEXT_SHUFFLE_QUEUE_APPLY_ROOTS_REQUIRED');
    if (onComplete !== null && typeof onComplete !== 'function') {
      throw new Error('TEXT_SHUFFLE_QUEUE_APPLY_COMPLETION_INVALID');
    }
    cancelInitialPass();
    applyRoots = roots;
    applyRootIndex = 0;
    onInitialPassComplete = onComplete;
    if (!advanceApplyWalker()) return false;
    scheduleApplyChunk();
    return true;
  }

  function cancelInitialPass() {
    if (applyIdleHandle) cancelIdleWork(applyIdleHandle);
    applyIdleHandle = null;
    applyWalker = null;
    applyRoots = null;
    applyRootIndex = 0;
    applyChunkScheduledAt = null;
    onInitialPassComplete = null;
  }

  function createPendingSubtreeTask(rootNode) {
    const roots = resolveSubtreeRoots(rootNode);
    if (!Array.isArray(roots) || roots.length === 0) return null;
    return { roots, rootIndex: 0, walker: null };
  }

  function processPendingSubtree(
    rootNode,
    successLimit,
    visitLimit = TEXT_SHUFFLE_APPLY_VISIT_CHUNK_SIZE,
    shouldContinue = null,
  ) {
    let task = pendingSubtreeTasks.get(rootNode);
    if (!task) {
      task = createPendingSubtreeTask(rootNode);
      if (!task) {
        pendingSubtreeReplayRoots.delete(rootNode);
        return { processed: 0, visited: 0, complete: true };
      }
      pendingSubtreeReplayRoots.delete(rootNode);
      pendingSubtreeTasks.set(rootNode, task);
    }
    let processed = 0;
    let visited = 0;
    while (
      processed < successLimit
      && visited < visitLimit
      && (!shouldContinue || shouldContinue(visited))
    ) {
      if (!task.walker) {
        let nextRoot = null;
        while (task.rootIndex < task.roots.length && !nextRoot) {
          const candidate = task.roots[task.rootIndex];
          task.rootIndex += 1;
          if (candidate?.isConnected) nextRoot = candidate;
        }
        if (!nextRoot) {
          pendingSubtreeTasks.delete(rootNode);
          return {
            processed,
            visited,
            complete: !pendingSubtreeReplayRoots.has(rootNode),
          };
        }
        task.walker = createTextWalker(nextRoot);
      }
      const node = task.walker.nextNode();
      if (!node) {
        task.walker = null;
        continue;
      }
      visited += 1;
      if (processTextNode(node)) processed += 1;
    }
    return { processed, visited, complete: false };
  }

  function scheduleFlush() {
    if (pendingSubtrees.size === 0 && pendingTextNodes.size === 0) return false;
    if (debounceTimer || flushIdleHandle) {
      if (debugEnabled) debugState.coalescedFlushSchedules += 1;
      return false;
    }
    if (debugEnabled) {
      debugState.deferredFlushes += 1;
      flushScheduledAt = now();
    }
    debounceTimer = setTimeout(() => {
      debounceTimer = null;
      flushIdleHandle = scheduleIdleWork((deadline) => {
        flushIdleHandle = null;
        const queueWaitMs = flushScheduledAt === null ? 0 : now() - flushScheduledAt;
        flushScheduledAt = null;
        flushPending(queueWaitMs, deadline);
      });
    }, TEXT_SHUFFLE_FLUSH_DEBOUNCE_MS);
    return true;
  }

  function flushPending(queueWaitMs = 0, deadline = null) {
    if (!isRuntimeEnabled()) {
      resetMutationState();
      return;
    }
    const operationDebugEnabled = debugEnabled;
    const workStartedAt = now();
    const startedAt = operationDebugEnabled ? workStartedAt : 0;
    const queueBefore = operationDebugEnabled
      ? { textNodes: pendingTextNodes.size, subtrees: pendingSubtrees.size }
      : null;
    let processed = 0;
    let visitedTextNodes = 0;
    let visitedSubtreeTextNodes = 0;

    for (const node of Array.from(pendingTextNodes)) {
      if (
        visitedTextNodes >= TEXT_SHUFFLE_MUTATION_TEXT_CHUNK_SIZE
        || !hasWorkBudget(deadline, workStartedAt, visitedTextNodes > 0, now)
      ) break;
      pendingTextNodes.delete(node);
      visitedTextNodes += 1;
      if (processTextNode(node)) processed += 1;
    }

    let visitedSubtrees = 0;
    for (const subtree of Array.from(pendingSubtrees)) {
      if (
        processed >= TEXT_SHUFFLE_MUTATION_SUCCESS_CHUNK_SIZE
        || visitedSubtrees >= TEXT_SHUFFLE_PENDING_SUBTREE_CHUNK_SIZE
      ) break;
      visitedSubtrees += 1;
      const result = processPendingSubtree(
        subtree,
        TEXT_SHUFFLE_MUTATION_SUCCESS_CHUNK_SIZE - processed,
        TEXT_SHUFFLE_APPLY_VISIT_CHUNK_SIZE,
        (subtreeVisited) => hasWorkBudget(
          deadline,
          workStartedAt,
          visitedTextNodes + visitedSubtreeTextNodes + subtreeVisited > 0,
          now,
        ),
      );
      processed += result.processed;
      visitedSubtreeTextNodes += result.visited;
      if (result.complete) pendingSubtrees.delete(subtree);
    }

    if (pendingSubtrees.size > 0 || pendingTextNodes.size > 0) scheduleFlush();
    if (operationDebugEnabled) {
      recordOperation({
        source: 'mutation_flush',
        startedAt,
        visited: visitedTextNodes + visitedSubtreeTextNodes,
        processed,
        durationMs: now() - startedAt,
        queueWaitMs,
        queueBefore,
        queueAfter: {
          textNodes: pendingTextNodes.size,
          subtrees: pendingSubtrees.size,
        },
      });
    }
  }

  function getDebugSnapshot() {
    return {
      pendingTextNodeCount: pendingTextNodes.size,
      pendingSubtreeCount: pendingSubtrees.size,
      pendingSubtreeTaskCount: pendingSubtreeTasks.size,
      flushScheduled: !!debounceTimer || !!flushIdleHandle,
      idleChunkScheduled: !!applyIdleHandle,
      stats: {
        ...debugState,
        totalQueueWaitMs: Number(debugState.totalQueueWaitMs.toFixed(2)),
        totalWorkMs: Number(debugState.totalWorkMs.toFixed(2)),
        maxWorkMs: Number(debugState.maxWorkMs.toFixed(2)),
        recentOperations: debugState.recentOperations.map((entry) => ({
          ...entry,
          ...(entry.queueBefore ? { queueBefore: { ...entry.queueBefore } } : {}),
          ...(entry.queueAfter ? { queueAfter: { ...entry.queueAfter } } : {}),
        })),
      },
    };
  }

  function resetDebugSnapshot() {
    debugState = createDebugState(wallNow);
    applyChunkScheduledAt = null;
    flushScheduledAt = null;
  }

  return Object.freeze({
    cancelInitialPass,
    cancelPendingFlush,
    enqueueSubtree,
    enqueueTextNode,
    flushPending,
    getDebugSnapshot,
    getPendingSubtreeCount: () => pendingSubtrees.size,
    getPendingSubtreeReplayCount: () => pendingSubtreeReplayRoots.size,
    getPendingSubtreeTaskCount: () => pendingSubtreeTasks.size,
    getPendingTextNodeCount: () => pendingTextNodes.size,
    hasPendingSubtree: (node) => pendingSubtrees.has(node),
    hasPendingSubtreeReplay: (node) => pendingSubtreeReplayRoots.has(node),
    hasPendingSubtreeTask: (node) => pendingSubtreeTasks.has(node),
    isInitialPassScheduled: () => !!applyIdleHandle,
    processPendingSubtree,
    recordObserverPayload,
    releasePendingWorkInSubtree,
    resetDebugSnapshot,
    resetMutationState,
    runApplyChunk,
    scheduleFlush,
    setDebugEnabled: (value) => {
      debugEnabled = value === true;
    },
    startInitialPass,
  });
}
