import { isFrictionDebugEnabled } from '@friction-debug-flags';

export const FEED_FLOW_DIAGNOSTIC_LEDGER_VERSION = 2;

const DEFAULT_EVENT_LIMIT = 32;
const HARD_EVENT_LIMIT = 32;
const ADVANCE_EVENT_LIMIT = 32;
const DOMINANT_SCAN_TRACE_LIMIT = 24;
const TOPOLOGY_PROBE_TRACE_LIMIT = 24;
const EVENT_TYPES = new Set([
  'intent',
  'mutation_scan',
  'paged_scan_scheduled',
  'paged_scan_executed',
  'paged_transition_suppressed',
  'paged_baseline_reconciled',
  'dominant_scan',
  'topology_probe',
  'advance',
]);
const RETAINED_EVENT_TYPES = new Set(['intent', 'advance']);
const INTENT_KINDS = new Set(['wheel', 'scroll', 'keydown', 'touch', 'pointer', 'unknown']);
const SURFACE_MODES = new Set(['continuous', 'paged', 'hybrid', 'document', 'unknown']);
const MUTATION_INCOMPLETE_REASONS = new Set(['visit_limit', 'seed_incomplete', 'invalid_selector']);
const ADVANCE_SOURCES = new Set([
  'screenful',
  'mutation',
  'dominant_item',
  'hybrid_score',
  'unknown',
]);
const PAGED_CONFIRMATION_REASONS = new Set([
  'intent_immediate',
  'intent_settle',
  'scroll_settle',
  'mutation_immediate',
  'mutation_settle',
  'media_play_settle',
  'baseline_sync',
  'baseline_settle',
  'gesture_deadline',
  'unknown',
]);
const WINNER_IDENTITY_SOURCES = new Set([
  'content_key',
  'media_revision',
  'node_token',
  'unknown',
]);
const TOPOLOGY_PROBE_PHASES = new Set([
  'shipped_health',
  'local_reference_acquisition',
  'local_certification',
  'local_actuation_recheck',
]);
const TOPOLOGY_PROBE_STATUSES = new Set([
  'unavailable',
  'unsupported',
  'pending',
  'resolved',
  'mismatch',
  'invalid',
  'unsafe',
]);

function finiteNonNegative(value) {
  const numeric = Number(value);
  return Number.isFinite(numeric) && numeric >= 0 ? numeric : 0;
}

function integerNonNegative(value) {
  return Math.max(0, Math.round(finiteNonNegative(value)));
}

function normalizeDurationMs(value) {
  return Math.round(finiteNonNegative(value) * 1000) / 1000;
}

function normalizeEnum(value, allowed, fallback) {
  const normalized = typeof value === 'string' ? value : '';
  return allowed.has(normalized) ? normalized : fallback;
}

function normalizeOpaqueToken(value) {
  const normalized = typeof value === 'string' ? value.trim().toLowerCase() : '';
  return /^item-[a-f0-9]{8}$/u.test(normalized) ? normalized : '';
}

function createCounters() {
  return {
    intentCount: 0,
    forwardIntentCount: 0,
    backwardIntentCount: 0,
    wheelIntentCount: 0,
    scrollIntentCount: 0,
    keydownIntentCount: 0,
    touchIntentCount: 0,
    pointerIntentCount: 0,
    unknownIntentCount: 0,
    mutationScanCount: 0,
    mutationScanTotalMs: 0,
    mutationRootCount: 0,
    mutationCandidateCount: 0,
    freshItemCount: 0,
    mutationIncompleteCount: 0,
    mutationRevalidationCount: 0,
    mutationVisitedElements: 0,
    pagedScanScheduledCount: 0,
    pagedScanCoalescedCount: 0,
    pagedScanExecutedCount: 0,
    pagedTransitionSuppressedCount: 0,
    pagedBaselineReconciledCount: 0,
    dominantScanCount: 0,
    dominantScanTotalMs: 0,
    dominantCandidateCount: 0,
    dominantRawCandidateCount: 0,
    dominantNestedCandidateCount: 0,
    geometryReadCount: 0,
    topologyProbeCount: 0,
    topologyProbeTotalMs: 0,
    topologyProbeMaxMs: 0,
    topologyProbeResolvedCount: 0,
    topologyProbeCandidateCount: 0,
    topologyProbeFutureBranchCount: 0,
    advanceCount: 0,
    itemTransitionCount: 0,
    screenfulAdvanceTotal: 0,
  };
}

function normalizeEvent(type, details, sequence, now) {
  const ts = Math.max(0, Number(details?.ts) || Number(now) || Date.now());
  const event = { sequence, ts, type };

  if (type === 'intent') {
    return {
      ...event,
      kind: normalizeEnum(details?.kind, INTENT_KINDS, 'unknown'),
      direction: details?.direction === 'backward' ? 'backward' : 'forward',
    };
  }
  if (type === 'mutation_scan') {
    return {
      ...event,
      mutationRoots: integerNonNegative(details?.mutationRoots),
      candidateCount: integerNonNegative(details?.candidateCount),
      complete: details?.complete === true,
      reason: normalizeEnum(details?.reason, MUTATION_INCOMPLETE_REASONS, null),
      needsRevalidation: details?.needsRevalidation === true,
      freshItems: details?.complete === true ? integerNonNegative(details?.freshItems) : null,
      visitedElements: integerNonNegative(details?.visitedElements),
      durationMs: normalizeDurationMs(details?.durationMs),
    };
  }
  if (type === 'paged_scan_scheduled') {
    return {
      ...event,
      coalesced: details?.coalesced === true,
    };
  }
  if (type === 'paged_scan_executed') {
    return event;
  }
  if (type === 'paged_transition_suppressed') {
    return event;
  }
  if (type === 'paged_baseline_reconciled') {
    return event;
  }
  if (type === 'dominant_scan') {
    return {
      ...event,
      candidateCount: integerNonNegative(details?.candidateCount),
      rawCandidateCount: integerNonNegative(details?.rawCandidateCount),
      nestedCandidateCount: integerNonNegative(details?.nestedCandidateCount),
      geometryReads: integerNonNegative(details?.geometryReads),
      winnerFound: details?.winnerFound === true,
      winnerToken: normalizeOpaqueToken(details?.winnerToken),
      winnerActiveMedia: details?.winnerActiveMedia === true,
      durationMs: normalizeDurationMs(details?.durationMs),
    };
  }
  if (type === 'topology_probe') {
    return {
      ...event,
      phase: normalizeEnum(details?.phase, TOPOLOGY_PROBE_PHASES, 'local_certification'),
      status: normalizeEnum(details?.status, TOPOLOGY_PROBE_STATUSES, 'invalid'),
      surfaceMode: normalizeEnum(details?.surfaceMode, SURFACE_MODES, 'unknown'),
      candidateCount: integerNonNegative(details?.candidateCount),
      futureBranchCount: integerNonNegative(details?.futureBranchCount),
      durationMs: normalizeDurationMs(details?.durationMs),
    };
  }
  const advance = {
    ...event,
    surfaceMode: normalizeEnum(details?.surfaceMode, SURFACE_MODES, 'unknown'),
    source: normalizeEnum(details?.source, ADVANCE_SOURCES, 'unknown'),
    direction: details?.direction === 'backward' ? 'backward' : 'forward',
    itemTransitions: integerNonNegative(details?.itemTransitions),
    screenfulDelta: finiteNonNegative(details?.screenfulDelta),
  };
  const hasPagedConfirmation = (
    Object.hasOwn(details || {}, 'confirmationReason')
    || Object.hasOwn(details || {}, 'winnerToken')
  );
  if (!hasPagedConfirmation) return advance;
  return {
    ...advance,
    gestureSequence: integerNonNegative(details?.gestureSequence),
    gestureKind: normalizeEnum(details?.gestureKind, INTENT_KINDS, 'unknown'),
    confirmationReason: normalizeEnum(
      details?.confirmationReason,
      PAGED_CONFIRMATION_REASONS,
      'unknown',
    ),
    confirmationDelayMs: normalizeDurationMs(details?.confirmationDelayMs),
    previousWinnerToken: normalizeOpaqueToken(details?.previousWinnerToken),
    winnerToken: normalizeOpaqueToken(details?.winnerToken),
    winnerActiveMedia: details?.winnerActiveMedia === true,
    winnerIdentitySource: normalizeEnum(
      details?.winnerIdentitySource,
      WINNER_IDENTITY_SOURCES,
      'unknown',
    ),
    activeVideoChanged: details?.activeVideoChanged === true,
  };
}

export class FeedFlowDiagnosticLedger {
  constructor({
    isEnabled = isFrictionDebugEnabled,
    eventLimit = DEFAULT_EVENT_LIMIT,
    now = () => Date.now(),
    performanceNow = () => globalThis?.performance?.now?.() ?? Date.now(),
  } = {}) {
    if (typeof isEnabled !== 'function') {
      throw new Error('FEED_FLOW_DIAGNOSTIC_LEDGER_ENABLED_READER_REQUIRED');
    }
    if (typeof now !== 'function' || typeof performanceNow !== 'function') {
      throw new Error('FEED_FLOW_DIAGNOSTIC_LEDGER_CLOCK_REQUIRED');
    }
    this._isEnabled = isEnabled;
    this._eventLimit = Math.max(
      1,
      Math.min(HARD_EVENT_LIMIT, Math.round(Number(eventLimit) || DEFAULT_EVENT_LIMIT)),
    );
    this._now = now;
    this._performanceNow = performanceNow;
    this.reset();
  }

  isEnabled() {
    return this._isEnabled() === true;
  }

  startMeasure() {
    return this.isEnabled() ? finiteNonNegative(this._performanceNow()) : null;
  }

  elapsedMs(startedAt) {
    if (startedAt === null || startedAt === undefined) return 0;
    return Math.max(0, finiteNonNegative(this._performanceNow()) - finiteNonNegative(startedAt));
  }

  record(type, details = {}) {
    if (!EVENT_TYPES.has(type)) {
      throw new Error(`FEED_FLOW_DIAGNOSTIC_EVENT_TYPE_INVALID:${String(type || '')}`);
    }
    if (!this.isEnabled()) return false;

    this._totalEvents += 1;
    const event = normalizeEvent(type, details, this._totalEvents, this._now());
    this._applyCounters(event);
    this._totalRecords += 1;
    if (type === 'dominant_scan') {
      this._dominantScans.push(event);
      if (this._dominantScans.length > DOMINANT_SCAN_TRACE_LIMIT) {
        this._dominantScans.splice(
          0,
          this._dominantScans.length - DOMINANT_SCAN_TRACE_LIMIT,
        );
      }
    }
    if (type === 'advance') {
      this._advanceEventTotal += 1;
      this._advanceEvents.push({
        ...event,
        sequence: this._advanceEventTotal,
      });
      if (this._advanceEvents.length > ADVANCE_EVENT_LIMIT) {
        this._advanceEvents.splice(
          0,
          this._advanceEvents.length - ADVANCE_EVENT_LIMIT,
        );
      }
    }
    if (RETAINED_EVENT_TYPES.has(type)) {
      this._retainedEventTotal += 1;
      event.sequence = this._retainedEventTotal;
      this._events.push(event);
      if (this._events.length > this._eventLimit) {
        this._events.splice(0, this._events.length - this._eventLimit);
      }
    }
    return true;
  }

  reset() {
    this._totalEvents = 0;
    this._totalRecords = 0;
    this._retainedEventTotal = 0;
    this._advanceEventTotal = 0;
    this._events = [];
    this._advanceEvents = [];
    this._dominantScans = [];
    this._topologyProbes = [];
    this._counters = createCounters();
    return this.getSnapshot();
  }

  getSnapshot() {
    const enabled = this.isEnabled();
    const retainedEventCount = this._events.length;
    return {
      version: FEED_FLOW_DIAGNOSTIC_LEDGER_VERSION,
      state: enabled
        ? this._totalRecords > 0 ? 'measured' : 'armed_idle'
        : 'inactive',
      capacity: this._eventLimit,
      retention: {
        totalEventCount: this._retainedEventTotal,
        retainedEventCount,
        droppedEventCount: Math.max(0, this._retainedEventTotal - retainedEventCount),
      },
      advanceRetention: {
        totalEventCount: this._advanceEventTotal,
        retainedEventCount: this._advanceEvents.length,
        droppedEventCount: Math.max(
          0,
          this._advanceEventTotal - this._advanceEvents.length,
        ),
      },
      counters: { ...this._counters },
      recentEvents: this._events.map((event) => ({ ...event })),
      recentAdvanceEvents: this._advanceEvents.map((event) => ({ ...event })),
      recentDominantScans: this._dominantScans.map((event) => ({ ...event })),
      recentTopologyProbes: this._topologyProbes.map((event) => ({ ...event })),
    };
  }

  _applyCounters(event) {
    const counters = this._counters;
    if (event.type === 'intent') {
      counters.intentCount += 1;
      counters[`${event.direction}IntentCount`] += 1;
      counters[`${event.kind}IntentCount`] += 1;
      return;
    }
    if (event.type === 'mutation_scan') {
      counters.mutationScanCount += 1;
      counters.mutationScanTotalMs += event.durationMs;
      counters.mutationRootCount += event.mutationRoots;
      counters.mutationCandidateCount += event.candidateCount;
      if (event.complete) counters.freshItemCount += event.freshItems;
      else counters.mutationIncompleteCount += 1;
      if (event.needsRevalidation) counters.mutationRevalidationCount += 1;
      counters.mutationVisitedElements += event.visitedElements;
      return;
    }
    if (event.type === 'paged_scan_scheduled') {
      counters.pagedScanScheduledCount += 1;
      if (event.coalesced) counters.pagedScanCoalescedCount += 1;
      return;
    }
    if (event.type === 'paged_scan_executed') {
      counters.pagedScanExecutedCount += 1;
      return;
    }
    if (event.type === 'paged_transition_suppressed') {
      counters.pagedTransitionSuppressedCount += 1;
      return;
    }
    if (event.type === 'paged_baseline_reconciled') {
      counters.pagedBaselineReconciledCount += 1;
      return;
    }
    if (event.type === 'dominant_scan') {
      counters.dominantScanCount += 1;
      counters.dominantScanTotalMs += event.durationMs;
      counters.dominantCandidateCount += event.candidateCount;
      counters.dominantRawCandidateCount += event.rawCandidateCount;
      counters.dominantNestedCandidateCount += event.nestedCandidateCount;
      counters.geometryReadCount += event.geometryReads;
      return;
    }
    if (event.type === 'topology_probe') {
      counters.topologyProbeCount += 1;
      counters.topologyProbeTotalMs += event.durationMs;
      counters.topologyProbeMaxMs = Math.max(
        counters.topologyProbeMaxMs,
        event.durationMs,
      );
      if (event.status === 'resolved') counters.topologyProbeResolvedCount += 1;
      counters.topologyProbeCandidateCount += event.candidateCount;
      counters.topologyProbeFutureBranchCount += event.futureBranchCount;
      this._topologyProbes.push(event);
      if (this._topologyProbes.length > TOPOLOGY_PROBE_TRACE_LIMIT) {
        this._topologyProbes.splice(
          0,
          this._topologyProbes.length - TOPOLOGY_PROBE_TRACE_LIMIT,
        );
      }
      return;
    }
    counters.advanceCount += 1;
    counters.itemTransitionCount += event.itemTransitions;
    counters.screenfulAdvanceTotal += event.screenfulDelta;
  }
}

export default FeedFlowDiagnosticLedger;
