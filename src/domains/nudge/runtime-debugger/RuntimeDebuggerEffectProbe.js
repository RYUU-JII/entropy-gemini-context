import VisualManager from '../visual/visualManager.js';
import TextShuffleManager from '../textShuffleManager.js';
import shortFormBlockManager from '../short-form/index.js';
import videoElementObserver from '../video/VideoElementObserver.js';

const EFFECT_OWNERS = Object.freeze({
  visual: VisualManager,
  textShuffle: TextShuffleManager,
  shortForm: shortFormBlockManager,
  videoObservation: videoElementObserver,
});

function getErrorMessage(error, fallback) {
  return String(error?.message || error || fallback);
}

function normalizeSnapshot(probeId, owner) {
  if (!owner || typeof owner.getDebugSnapshot !== 'function') {
    return {
      loaded: true,
      available: false,
      active: false,
      debugEnabled: false,
      probeId,
      error: `${probeId.toUpperCase()}_DEBUG_SNAPSHOT_UNAVAILABLE`,
      stats: {},
      recentOperations: [],
    };
  }
  try {
    const snapshot = owner.getDebugSnapshot();
    if (!snapshot || typeof snapshot !== 'object') {
      throw new Error(`${probeId.toUpperCase()}_DEBUG_SNAPSHOT_INVALID`);
    }
    const recentOperations = Array.isArray(snapshot.recentOperations)
      ? snapshot.recentOperations
      : (Array.isArray(snapshot.stats?.recentOperations) ? snapshot.stats.recentOperations : []);
    return {
      ...snapshot,
      probeId,
      loaded: snapshot.loaded !== false,
      available: snapshot.available !== false,
      stats: snapshot.stats && typeof snapshot.stats === 'object' ? snapshot.stats : {},
      recentOperations: recentOperations.map((entry) => ({ ...entry })),
    };
  } catch (error) {
    return {
      loaded: true,
      available: false,
      active: false,
      debugEnabled: false,
      probeId,
      error: getErrorMessage(error, `${probeId.toUpperCase()}_DEBUG_SNAPSHOT_FAILED`),
      stats: {},
      recentOperations: [],
    };
  }
}

function getOperationCount(snapshot = {}) {
  const stats = snapshot.stats || {};
  const direct = Number(stats.operations ?? snapshot.operations);
  if (Number.isFinite(direct)) return Math.max(0, direct);
  const derived = [
    stats.fullScans,
    stats.rootScans,
    stats.observerBatches,
    stats.initialRefreshes,
    stats.urlRefreshes,
    stats.deliveryAttempts,
  ].reduce((sum, value) => sum + (Number(value) || 0), 0);
  return Math.max(0, derived);
}

export class RuntimeDebuggerEffectProbe {
  constructor({ owners = EFFECT_OWNERS } = {}) {
    this._owners = owners;
    this._operationCursors = new Map();
  }

  getSnapshot() {
    return Object.fromEntries(
      Object.entries(this._owners).map(([probeId, owner]) => [probeId, normalizeSnapshot(probeId, owner)]),
    );
  }

  sample({ establishBaseline = false, capturedAt = Date.now() } = {}) {
    const effects = this.getSnapshot();
    const events = [];
    const evidenceGaps = [];
    Object.entries(effects).forEach(([probeId, snapshot]) => {
      const operationCount = getOperationCount(snapshot);
      const previousCount = this._operationCursors.get(probeId);
      this._operationCursors.set(probeId, operationCount);
      if (establishBaseline || previousCount === undefined || operationCount <= previousCount) return;
      const expectedOperations = operationCount - previousCount;
      const addedCount = Math.min(
        expectedOperations,
        snapshot.recentOperations.length,
      );
      if (addedCount < expectedOperations) {
        evidenceGaps.push({
          probeId,
          source: 'recent_operations',
          expectedOperations,
          retainedEvents: addedCount,
        });
      }
      const addedOperations = addedCount > 0
        ? snapshot.recentOperations.slice(-addedCount)
        : [];
      addedOperations.forEach((operation) => {
        events.push({
          probeId,
          type: operation.type || operation.source || operation.phase || 'operation',
          capturedAt,
          details: { ...operation },
        });
      });
    });
    return { effects, events, evidenceGaps };
  }

  resetEventCursors() {
    this._operationCursors.clear();
  }
}

export default RuntimeDebuggerEffectProbe;
