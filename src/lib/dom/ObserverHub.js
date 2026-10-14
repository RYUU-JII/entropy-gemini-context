import { isObserverHubPerfDebugEnabled } from '@friction-debug-flags';
import { recordRuntimeOwnerWork } from '@runtime-contention-ledger';

const DEBUG_FLAG_REFRESH_MS = 1000;
const RECENT_FLUSH_LIMIT = 20;
const FLUSH_WATCHDOG_MS = 250;
const TINY_FLUSH_MUTATION_LIMIT = 4;
const MUTATION_KIND_CHILD_LIST = 1;
const MUTATION_KIND_CHARACTER_DATA = 2;
const MUTATION_KIND_ATTRIBUTES = 4;

function nowMs() {
  if (typeof performance !== 'undefined' && typeof performance.now === 'function') {
    return performance.now();
  }
  return Date.now();
}

function normalizeDebugLabel(label, fallback = 'anonymous') {
  const value = String(label || '').trim();
  return value || fallback;
}

function normalizeAttributeFilter(values) {
  if (!Array.isArray(values)) return [];
  return Array.from(new Set(values
    .filter((name) => typeof name === 'string')
    .map((name) => name.trim())
    .filter(Boolean)))
    .sort();
}

function createOptionsKey(options = {}) {
  return JSON.stringify([
    !!options.childList,
    !!options.subtree,
    !!options.characterData,
    !!options.attributes,
    Array.isArray(options.attributeFilter) ? options.attributeFilter : [],
  ]);
}

function getMutationKindFlag(mutation) {
  if (mutation?.type === 'childList') return MUTATION_KIND_CHILD_LIST;
  if (mutation?.type === 'characterData') return MUTATION_KIND_CHARACTER_DATA;
  if (mutation?.type === 'attributes') return MUTATION_KIND_ATTRIBUTES;
  return 0;
}

function createMutationKindMask(options = {}) {
  let mask = 0;
  if (options.childList) mask |= MUTATION_KIND_CHILD_LIST;
  if (options.characterData) mask |= MUTATION_KIND_CHARACTER_DATA;
  if (options.attributes) mask |= MUTATION_KIND_ATTRIBUTES;
  return mask;
}

function getObserverHubErrorMessage(error, fallback = 'OBSERVER_HUB_FAILURE') {
  return String(error?.message || error || fallback);
}

class ObserverHub {
  constructor() {
    this.subscribers = new Map();
    this.observer = null;
    this.pendingMutations = [];
    this.pendingMutationKindMask = 0;
    this.pendingOptionsChanged = false;
    this.pendingMutationQueuedAt = null;
    this.pendingAttributeMutationCounts = new Map();
    this.flushScheduled = false;
    this.flushFrameId = null;
    this.flushWatchdogId = null;
    this.activeOptions = null;
    this.activeOptionsKey = null;
    this.observationRoot = null;
    this.observationEpoch = 0;
    this.deliverySequence = 0;
    this._debugEnabled = false;
    this._debugLastCheckTs = 0;
    this._debugFlushSequence = 0;
    this._debugState = this._createDebugState();
  }

  subscribe(handler, options = {}) {
    if (typeof handler !== 'function') return () => {};
    const token = Symbol('observerHubSubscriber');
    const debugLabel = normalizeDebugLabel(
      options.debugLabel,
      handler.name || `subscriber_${this.subscribers.size + 1}`
    );
    const attributeFilter = normalizeAttributeFilter(options.attributeFilter);
    const normalized = {
      childList: !!options.childList,
      subtree: options.subtree !== undefined ? !!options.subtree : true,
      characterData: !!options.characterData,
      attributes: !!options.attributes || attributeFilter.length > 0,
      attributeFilter,
    };

    const subscriber = {
      handler,
      options: normalized,
      debugLabel,
      payloadKey: createOptionsKey(normalized),
      mutationKindMask: createMutationKindMask(normalized),
      attributeFilterSet: attributeFilter.length > 0 ? new Set(attributeFilter) : null,
    };
    this.subscribers.set(token, subscriber);
    try {
      this._ensureObserver();
    } catch (error) {
      this.subscribers.delete(token);
      try {
        this._ensureObserver();
      } catch (rollbackError) {
        if (error && typeof error === 'object') error.rollbackError = rollbackError;
      }
      throw error;
    }
    return () => this.unsubscribe(token);
  }

  unsubscribe(token) {
    if (!this.subscribers.has(token)) return;
    const subscriber = this.subscribers.get(token);
    this.subscribers.delete(token);
    try {
      this._ensureObserver();
    } catch (error) {
      this.subscribers.set(token, subscriber);
      throw error;
    }
  }

  _ensureObserver() {
    if (this.subscribers.size === 0) {
      this._disconnect();
      this._cancelPendingFlush();
      return;
    }

    const merged = this._mergeOptions();
    const shouldReconnect = !this._isSameOptions(merged, this.activeOptions);

    if (!this.observer) {
      this.observer = new MutationObserver((mutations) => this._handleMutations(mutations));
    }

    if (shouldReconnect) {
      // disconnect() discards native records not yet delivered to our callback.
      // Keep those records in the existing batch when only subscriptions change.
      this._handleMutations(this.observer.takeRecords());
      if (this.pendingMutations.length > 0) this.pendingOptionsChanged = true;
      this._disconnect();
      try {
        const root = document.documentElement || document;
        this.observer.observe(root, merged);
        this.observationRoot = root;
        this.observationEpoch += 1;
        this.activeOptions = merged;
        this.activeOptionsKey = createOptionsKey(merged);
      } catch (error) {
        this.activeOptions = null;
        this.activeOptionsKey = null;
        this._reportFailure('observe', error, {
          options: merged,
        });
        throw error;
      }
    }
  }

  _mergeOptions() {
    const merged = {
      childList: false,
      subtree: false,
      characterData: false,
      attributes: false,
    };
    const attributeFilterSet = new Set();
    let observesAllAttributes = false;

    for (const { options } of this.subscribers.values()) {
      merged.childList = merged.childList || options.childList;
      merged.subtree = merged.subtree || options.subtree;
      merged.characterData = merged.characterData || options.characterData;
      merged.attributes = merged.attributes || options.attributes;
      if (options.attributes && options.attributeFilter.length === 0) {
        observesAllAttributes = true;
      }
      if (Array.isArray(options.attributeFilter)) {
        options.attributeFilter.forEach((name) => attributeFilterSet.add(name));
      }
    }

    if (!observesAllAttributes && attributeFilterSet.size > 0) {
      merged.attributes = true;
      merged.attributeFilter = Array.from(attributeFilterSet).sort();
    }

    return merged;
  }

  _isSameOptions(next, prev) {
    if (!next || !prev) return false;
    if (next.childList !== prev.childList) return false;
    if (next.subtree !== prev.subtree) return false;
    if (next.characterData !== prev.characterData) return false;
    if (next.attributes !== prev.attributes) return false;

    const nextFilter = Array.isArray(next.attributeFilter) ? next.attributeFilter : [];
    const prevFilter = Array.isArray(prev.attributeFilter) ? prev.attributeFilter : [];
    if (nextFilter.length !== prevFilter.length) return false;
    for (let i = 0; i < nextFilter.length; i += 1) {
      if (nextFilter[i] !== prevFilter[i]) return false;
    }
    return true;
  }

  _disconnect() {
    if (!this.observer) return;
    try {
      this.observer.disconnect();
      this.activeOptions = null;
      this.activeOptionsKey = null;
      this.observationRoot = null;
    } catch (error) {
      this._reportFailure('disconnect', error);
      throw error;
    }
  }

  _createDebugState() {
    return {
      startedAt: nowMs(),
      flushCount: 0,
      mutationCount: 0,
      addedNodeCount: 0,
      removedNodeCount: 0,
      textNodeCount: 0,
      attributeTargetCount: 0,
      errorCount: 0,
      lastError: null,
      flushDurationTotalMs: 0,
      flushDurationMaxMs: 0,
      attributeOnlyFlushCount: 0,
      childOnlyFlushCount: 0,
      mixedFlushCount: 0,
      tinyFlushCount: 0,
      queueWaitTotalMs: 0,
      queueWaitMaxMs: 0,
      attributeMutationCounts: new Map(),
      debugFlushOverheadTotalMs: 0,
      debugFlushOverheadMaxMs: 0,
      debugFlushOverheadCount: 0,
      debugSnapshotReadTotalMs: 0,
      debugSnapshotReadMaxMs: 0,
      debugSnapshotReadCount: 0,
      maxPendingMutations: 0,
      maxBatchMutations: 0,
      lastFlushId: null,
      recentFlushes: [],
      subscriberStats: new Map(),
    };
  }

  getObservationContext() {
    const root = this.observationRoot;
    if (!root || !Number.isSafeInteger(this.observationEpoch) || this.observationEpoch < 1) {
      return null;
    }
    const documentRef = root.nodeType === 9 ? root : root.ownerDocument;
    if (!documentRef) return null;
    return {
      documentRef,
      observationRoot: root,
      observationEpoch: this.observationEpoch,
      deliverySequence: this.deliverySequence,
    };
  }

  _reportFailure(phase, error, details = {}) {
    const entry = {
      ts: Date.now(),
      phase,
      error: getObserverHubErrorMessage(error),
      ...details,
    };
    this._debugState.errorCount += 1;
    this._debugState.lastError = entry;
    if (typeof console !== 'undefined') {
      console.warn?.('[ObserverHub] runtime failure', entry);
    }
    return entry;
  }

  _syncDebugMode(force = false) {
    const ts = nowMs();
    if (!force && ts - this._debugLastCheckTs < DEBUG_FLAG_REFRESH_MS) return;
    this._debugLastCheckTs = ts;
    const enabled = isObserverHubPerfDebugEnabled();
    if (enabled === this._debugEnabled) return;
    this._debugEnabled = enabled;
    this._debugState = this._createDebugState();
  }

  _recordSubscriberStats(debugLabel, payload, durationMs, mutationCount) {
    const label = normalizeDebugLabel(debugLabel);
    let stat = this._debugState.subscriberStats.get(label);
    if (!stat) {
      stat = {
        calls: 0,
        totalMs: 0,
        maxMs: 0,
        totalMutations: 0,
        totalAddedNodes: 0,
        totalRemovedNodes: 0,
        totalTextNodes: 0,
        totalAttributeTargets: 0,
      };
      this._debugState.subscriberStats.set(label, stat);
    }
    stat.calls += 1;
    stat.totalMs += durationMs;
    if (durationMs > stat.maxMs) stat.maxMs = durationMs;
    stat.totalMutations += mutationCount;
    stat.totalAddedNodes += payload.addedNodes.length;
    stat.totalRemovedNodes += payload.removedNodes.length;
    stat.totalTextNodes += payload.textNodes.length;
    stat.totalAttributeTargets += payload.attributeTargets.length;
  }

  getDebugSnapshot() {
    const snapshotReadStartedAt = this._debugEnabled ? nowMs() : 0;
    const subscriberStats = new Map(this._debugState.subscriberStats);
    if (this._debugEnabled) {
      for (const { debugLabel } of this.subscribers.values()) {
        if (subscriberStats.has(debugLabel)) continue;
        subscriberStats.set(debugLabel, {
          calls: 0,
          totalMs: 0,
          maxMs: 0,
          totalMutations: 0,
          totalAddedNodes: 0,
          totalRemovedNodes: 0,
          totalTextNodes: 0,
          totalAttributeTargets: 0,
        });
      }
    }
    const subscribers = Array.from(subscriberStats.entries())
      .map(([label, stat]) => ({
        label,
        calls: stat.calls,
        totalMs: Number(stat.totalMs.toFixed(2)),
        maxMs: Number(stat.maxMs.toFixed(2)),
        avgMs: stat.calls > 0 ? Number((stat.totalMs / stat.calls).toFixed(2)) : 0,
        totalMutations: stat.totalMutations,
        totalAddedNodes: stat.totalAddedNodes,
        totalRemovedNodes: stat.totalRemovedNodes,
        totalTextNodes: stat.totalTextNodes,
        totalAttributeTargets: stat.totalAttributeTargets,
      }))
      .sort((a, b) => b.totalMs - a.totalMs);
    const subscriberCounters = Object.fromEntries(subscribers.map((entry) => [entry.label, {
      calls: entry.calls,
      totalMs: entry.totalMs,
      totalMutations: entry.totalMutations,
      totalAddedNodes: entry.totalAddedNodes,
      totalRemovedNodes: entry.totalRemovedNodes,
      totalTextNodes: entry.totalTextNodes,
      totalAttributeTargets: entry.totalAttributeTargets,
    }]));

    const flushCount = this._debugState.flushCount;
    const avgFlushMs = flushCount > 0
      ? Number((this._debugState.flushDurationTotalMs / flushCount).toFixed(2))
      : 0;

    const snapshot = {
      debugEnabled: this._debugEnabled,
      startedAt: this._debugState.startedAt,
      flushes: flushCount,
      mutations: this._debugState.mutationCount,
      addedNodes: this._debugState.addedNodeCount,
      removedNodes: this._debugState.removedNodeCount,
      textNodes: this._debugState.textNodeCount,
      attributeTargets: this._debugState.attributeTargetCount,
      errors: this._debugState.errorCount,
      lastError: this._debugState.lastError,
      flushDurationTotalMs: Number(this._debugState.flushDurationTotalMs.toFixed(2)),
      avgFlushMs,
      maxFlushMs: Number(this._debugState.flushDurationMaxMs.toFixed(2)),
      attributeOnlyFlushes: this._debugState.attributeOnlyFlushCount,
      childOnlyFlushes: this._debugState.childOnlyFlushCount,
      mixedFlushes: this._debugState.mixedFlushCount,
      tinyFlushes: this._debugState.tinyFlushCount,
      queueWaitTotalMs: Number(this._debugState.queueWaitTotalMs.toFixed(2)),
      queueWaitMaxMs: Number(this._debugState.queueWaitMaxMs.toFixed(2)),
      debugFlushOverheadTotalMs: Number(
        this._debugState.debugFlushOverheadTotalMs.toFixed(2),
      ),
      debugFlushOverheadMaxMs: Number(
        this._debugState.debugFlushOverheadMaxMs.toFixed(2),
      ),
      debugFlushOverheadCount: this._debugState.debugFlushOverheadCount,
      attributeMutationCounts: Object.fromEntries(
        Array.from(this._debugState.attributeMutationCounts.entries())
          .sort(([left], [right]) => left.localeCompare(right)),
      ),
      maxPendingMutations: this._debugState.maxPendingMutations,
      maxBatchMutations: this._debugState.maxBatchMutations,
      lastFlushId: this._debugState.lastFlushId,
      recentFlushes: this._debugState.recentFlushes.map((entry) => ({ ...entry })),
      subscriberCount: this.subscribers.size,
      deliverySequence: this.deliverySequence,
      pendingMutationCount: this.pendingMutations.length,
      flushScheduled: this.flushScheduled,
      activeOptions: this.activeOptions
        ? {
          ...this.activeOptions,
          ...(Array.isArray(this.activeOptions.attributeFilter)
            ? { attributeFilter: [...this.activeOptions.attributeFilter] }
            : {}),
        }
        : null,
      subscriberStats: subscribers,
      subscriberCounters,
    };
    if (this._debugEnabled) {
      const snapshotReadMs = Math.max(0, nowMs() - snapshotReadStartedAt);
      this._debugState.debugSnapshotReadTotalMs += snapshotReadMs;
      if (snapshotReadMs > this._debugState.debugSnapshotReadMaxMs) {
        this._debugState.debugSnapshotReadMaxMs = snapshotReadMs;
      }
      this._debugState.debugSnapshotReadCount += 1;
    }
    snapshot.debugSnapshotReadTotalMs = Number(
      this._debugState.debugSnapshotReadTotalMs.toFixed(2),
    );
    snapshot.debugSnapshotReadMaxMs = Number(
      this._debugState.debugSnapshotReadMaxMs.toFixed(2),
    );
    snapshot.debugSnapshotReadCount = this._debugState.debugSnapshotReadCount;
    return snapshot;
  }

  resetDebugSnapshot() {
    this._debugState = this._createDebugState();
  }

  refreshDebugMode(force = true) {
    this._syncDebugMode(force);
    return this._debugEnabled;
  }

  _handleMutations(mutations) {
    if (!mutations || mutations.length === 0) return;
    this._syncDebugMode();
    if (this.pendingMutations.length === 0) {
      this.pendingMutationQueuedAt = this._debugEnabled ? nowMs() : null;
    }
    for (const mutation of mutations) {
      this.pendingMutations.push(mutation);
      this.pendingMutationKindMask |= getMutationKindFlag(mutation);
      if (this._debugEnabled && mutation?.type === 'attributes') {
        const attributeName = String(mutation.attributeName || '').trim();
        if (attributeName) {
          const currentCount = this.pendingAttributeMutationCounts.get(attributeName) || 0;
          this.pendingAttributeMutationCounts.set(attributeName, currentCount + 1);
        }
      }
    }
    if (this._debugEnabled && this.pendingMutations.length > this._debugState.maxPendingMutations) {
      this._debugState.maxPendingMutations = this.pendingMutations.length;
    }
    if (this.flushScheduled) return;
    this.flushScheduled = true;
    const flush = () => {
      if (!this.flushScheduled) return;
      this._clearScheduledFlushHandles();
      this._flush();
    };
    this.flushFrameId = requestAnimationFrame(flush);
    this.flushWatchdogId = setTimeout(flush, FLUSH_WATCHDOG_MS);
  }

  _clearScheduledFlushHandles() {
    if (this.flushFrameId !== null) {
      cancelAnimationFrame(this.flushFrameId);
      this.flushFrameId = null;
    }
    if (this.flushWatchdogId !== null) {
      clearTimeout(this.flushWatchdogId);
      this.flushWatchdogId = null;
    }
  }

  _cancelPendingFlush() {
    this._clearScheduledFlushHandles();
    this.flushScheduled = false;
    this.pendingMutations = [];
    this.pendingMutationKindMask = 0;
    this.pendingOptionsChanged = false;
    this.pendingMutationQueuedAt = null;
    this.pendingAttributeMutationCounts = new Map();
  }

  _matchesSubscriberMutation(mutation, options, attributeFilterSet = null) {
    if (!mutation || !options) return false;
    if (!options.subtree) {
      const observationRoot = this.observationRoot || document.documentElement || document;
      if (mutation.target !== observationRoot) return false;
    }
    if (mutation.type === 'childList') return options.childList;
    if (mutation.type === 'characterData') return options.characterData;
    if (mutation.type !== 'attributes' || !options.attributes) return false;

    if (!attributeFilterSet || attributeFilterSet.size === 0) return true;
    return attributeFilterSet.has(mutation.attributeName);
  }

  _buildMutationPayload(mutations, options = null, attributeFilterSet = null) {
    const relevantMutations = [];
    const addedNodes = new Set();
    const removedNodes = new Set();
    const textNodes = new Set();
    const attributeTargets = new Set();

    for (const mutation of mutations) {
      if (
        options
        && !this._matchesSubscriberMutation(mutation, options, attributeFilterSet)
      ) continue;
      relevantMutations.push(mutation);
      if (mutation.type === 'childList') {
        mutation.addedNodes?.forEach((node) => addedNodes.add(node));
        mutation.removedNodes?.forEach((node) => removedNodes.add(node));
      } else if (mutation.type === 'characterData') {
        if (mutation.target) textNodes.add(mutation.target);
      } else if (mutation.type === 'attributes') {
        if (mutation.target) attributeTargets.add(mutation.target);
      }
    }
    if (relevantMutations.length === 0) return null;

    return {
      mutations: relevantMutations,
      addedNodes: Array.from(addedNodes),
      removedNodes: Array.from(removedNodes),
      textNodes: Array.from(textNodes),
      attributeTargets: Array.from(attributeTargets),
    };
  }

  _flush() {
    this._syncDebugMode();
    const flushStartedAt = this._debugEnabled ? nowMs() : 0;
    this._clearScheduledFlushHandles();
    this.flushScheduled = false;
    if (this.pendingMutations.length === 0) return;

    const batch = this.pendingMutations;
    const batchMutationKindMask = this.pendingMutationKindMask;
    const batchOptionsChanged = this.pendingOptionsChanged;
    const batchQueuedAt = this.pendingMutationQueuedAt;
    const batchAttributeMutationCounts = this.pendingAttributeMutationCounts;
    const queueWaitMs = this._debugEnabled && Number.isFinite(batchQueuedAt)
      ? Math.max(0, flushStartedAt - batchQueuedAt)
      : 0;
    this.pendingMutations = [];
    this.pendingMutationKindMask = 0;
    this.pendingOptionsChanged = false;
    this.pendingMutationQueuedAt = null;
    this.deliverySequence += 1;
    if (this._debugEnabled) {
      this.pendingAttributeMutationCounts = new Map();
    } else {
      batchAttributeMutationCounts.clear();
    }

    const flushId = this._debugEnabled ? ++this._debugFlushSequence : null;
    const debugContext = this._debugEnabled
      ? Object.freeze({
        source: 'ObserverHub',
        flushId,
        deliverySequence: this.deliverySequence,
        batchMutationCount: batch.length,
      })
      : null;

    const payloadCache = new Map();
    let payload = null;
    let debugFlushOverheadMs = 0;
    if (this._debugEnabled) {
      const debugBuildStartedAt = nowMs();
      payload = this._buildMutationPayload(batch);
      if (!payload) {
        debugFlushOverheadMs += Math.max(0, nowMs() - debugBuildStartedAt);
        this._debugState.debugFlushOverheadTotalMs += debugFlushOverheadMs;
        this._debugState.debugFlushOverheadMaxMs = Math.max(
          this._debugState.debugFlushOverheadMaxMs,
          debugFlushOverheadMs,
        );
        this._debugState.debugFlushOverheadCount += 1;
        return;
      }
      // A batch can span option epochs; the current union may be narrower than
      // records retained from the previous observation options.
      if (!batchOptionsChanged && this.activeOptionsKey) {
        payloadCache.set(this.activeOptionsKey, payload);
      }
      this._debugState.flushCount += 1;
      this._debugState.lastFlushId = flushId;
      this._debugState.mutationCount += batch.length;
      this._debugState.addedNodeCount += payload.addedNodes.length;
      this._debugState.removedNodeCount += payload.removedNodes.length;
      this._debugState.textNodeCount += payload.textNodes.length;
      this._debugState.attributeTargetCount += payload.attributeTargets.length;
      if (batchMutationKindMask === MUTATION_KIND_ATTRIBUTES) {
        this._debugState.attributeOnlyFlushCount += 1;
      } else if (batchMutationKindMask === MUTATION_KIND_CHILD_LIST) {
        this._debugState.childOnlyFlushCount += 1;
      } else if (
        batchMutationKindMask !== 0
        && (batchMutationKindMask & (batchMutationKindMask - 1)) !== 0
      ) {
        this._debugState.mixedFlushCount += 1;
      }
      if (batch.length <= TINY_FLUSH_MUTATION_LIMIT) {
        this._debugState.tinyFlushCount += 1;
      }
      this._debugState.queueWaitTotalMs += queueWaitMs;
      if (queueWaitMs > this._debugState.queueWaitMaxMs) {
        this._debugState.queueWaitMaxMs = queueWaitMs;
      }
      for (const [attributeName, count] of batchAttributeMutationCounts) {
        const currentCount = this._debugState.attributeMutationCounts.get(attributeName) || 0;
        this._debugState.attributeMutationCounts.set(attributeName, currentCount + count);
      }
      if (batch.length > this._debugState.maxBatchMutations) {
        this._debugState.maxBatchMutations = batch.length;
      }
      debugFlushOverheadMs += Math.max(0, nowMs() - debugBuildStartedAt);
    }

    let deliveredSubscriberCount = 0;
    const subscriberSpans = this._debugEnabled ? [] : null;
    for (const {
      handler,
      options,
      debugLabel,
      payloadKey,
      mutationKindMask,
      attributeFilterSet,
    } of this.subscribers.values()) {
      let subscriberPayload = payloadCache.get(payloadKey);
      if (subscriberPayload === undefined) {
        subscriberPayload = (batchMutationKindMask & mutationKindMask) === 0
          ? null
          : this._buildMutationPayload(batch, options, attributeFilterSet);
        payloadCache.set(payloadKey, subscriberPayload);
      }
      if (!subscriberPayload) continue;
      deliveredSubscriberCount += 1;

      const callStartedAt = this._debugEnabled ? nowMs() : 0;
      try {
        if (debugContext) handler(subscriberPayload, debugContext);
        else handler(subscriberPayload);
      } catch (error) {
        this._reportFailure('subscriber_callback', error, {
          debugLabel,
          mutationCount: subscriberPayload.mutations.length,
        });
      }
      if (this._debugEnabled) {
        const debugSubscriberStatsStartedAt = nowMs();
        const durationMs = Math.max(0, debugSubscriberStatsStartedAt - callStartedAt);
        subscriberSpans.push({
          ownerId: debugLabel,
          startedAt: callStartedAt,
          endedAt: debugSubscriberStatsStartedAt,
          mutationCount: subscriberPayload.mutations.length,
        });
        this._recordSubscriberStats(
          debugLabel,
          subscriberPayload,
          durationMs,
          subscriberPayload.mutations.length,
        );
        debugFlushOverheadMs += Math.max(0, nowMs() - debugSubscriberStatsStartedAt);
      }
    }

    if (this._debugEnabled) {
      const debugFinalizeStartedAt = nowMs();
      const flushDurationMs = Math.max(0, debugFinalizeStartedAt - flushStartedAt);
      this._debugState.flushDurationTotalMs += flushDurationMs;
      if (flushDurationMs > this._debugState.flushDurationMaxMs) {
        this._debugState.flushDurationMaxMs = flushDurationMs;
      }
      const recentFlush = {
        flushId,
        mutationCount: batch.length,
        mutations: batch.length,
        addedNodes: payload.addedNodes.length,
        removedNodes: payload.removedNodes.length,
        textNodes: payload.textNodes.length,
        attributeTargets: payload.attributeTargets.length,
        deliveredSubscribers: deliveredSubscriberCount,
        subscriberCount: deliveredSubscriberCount,
        skippedSubscribers: Math.max(0, this.subscribers.size - deliveredSubscriberCount),
        queueWaitMs: Number(queueWaitMs.toFixed(2)),
        debugOverheadMs: 0,
        durationMs: Number(flushDurationMs.toFixed(2)),
      };
      this._debugState.recentFlushes.push(recentFlush);
      if (this._debugState.recentFlushes.length > RECENT_FLUSH_LIMIT) {
        this._debugState.recentFlushes.splice(
          0,
          this._debugState.recentFlushes.length - RECENT_FLUSH_LIMIT,
        );
      }
      debugFlushOverheadMs += Math.max(0, nowMs() - debugFinalizeStartedAt);
      this._debugState.debugFlushOverheadTotalMs += debugFlushOverheadMs;
      if (debugFlushOverheadMs > this._debugState.debugFlushOverheadMaxMs) {
        this._debugState.debugFlushOverheadMaxMs = debugFlushOverheadMs;
      }
      this._debugState.debugFlushOverheadCount += 1;
      recentFlush.debugOverheadMs = Number(debugFlushOverheadMs.toFixed(2));
      recordRuntimeOwnerWork({
        ownerId: 'observerHub',
        phase: 'mutation_flush',
        source: 'mutation_observer',
        startedAt: flushStartedAt,
        endedAt: flushStartedAt + flushDurationMs,
        units: batch.length,
        flushId,
        queueWaitMs,
        subscribers: subscriberSpans,
      });
    }
  }
}

const observerHub = new ObserverHub();

export { ObserverHub };
export default observerHub;
