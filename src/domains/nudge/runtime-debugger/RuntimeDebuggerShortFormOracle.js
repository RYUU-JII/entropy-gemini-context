import observerHub from '../../../lib/dom/ObserverHub.js';
import { resolveSiteId as resolveCanonicalSiteId } from '../targeting/siteIdentityCatalog.js';
import {
  analyzeRuntimeDebuggerShortFormCompleteness,
  projectRuntimeDebuggerShortFormTargetingHealth,
  sanitizeRuntimeDebuggerValue,
} from './core/index.js';
import { readShortFormTargetOutcome } from '@short-form-target-outcome';

const MAX_OPPORTUNITIES = 1024;
const MAX_DROPPED_OPPORTUNITY_IDS = 512;
const MAX_RECENT_OPPORTUNITIES = 32;
const MAX_TARGET_OUTCOME_ANCESTOR_DEPTH = 32;
const HIDDEN_TARGET_SELECTOR = '[data-friction-shortform-hidden="1"]';
const OPPORTUNITY_LINK_SELECTOR = [
  'a[href*="/shorts"]',
  'a[href*="/reel"]',
  'a[data-e2e="nav-foryou"]',
  'a[data-e2e="nav-following"]',
].join(',');
const YOUTUBE_STRUCTURAL_SELECTOR = [
  'ytd-reel-item-renderer',
  'ytd-reel-video-renderer',
  'ytd-reel-shelf-renderer',
  'ytd-rich-shelf-renderer[is-shorts]',
  'ytm-shorts-lockup-view-model-v2',
  'ytm-shorts-lockup-view-model',
  '.shortsLockupViewModelHost',
  '[is-shorts]',
].join(',');
const LABEL_CANDIDATE_SELECTOR = [
  'yt-tab-shape[role="tab"]',
  'ytd-guide-entry-renderer',
  'ytd-mini-guide-entry-renderer',
  'ytd-guide-collapsible-entry-renderer',
].join(',');
const EXCLUDED_CONTEXT_SELECTOR = [
  'ytd-comments',
  'ytd-comment-thread-renderer',
  'ytd-comment-view-model',
  'ytd-comment-renderer',
  'ytd-comment-replies-renderer',
  '#comments',
  '#comment-teaser',
  '#comment-input',
].join(',');
const OPPORTUNITY_UNIT_SELECTOR = [
  'ytm-shorts-lockup-view-model-v2',
  'ytm-shorts-lockup-view-model',
  '.shortsLockupViewModelHost',
  'ytd-reel-item-renderer',
  'ytd-reel-video-renderer',
  'ytd-rich-item-renderer',
  'ytd-video-renderer',
  'ytd-grid-video-renderer',
  'ytd-compact-video-renderer',
  'ytd-guide-entry-renderer',
  'ytd-mini-guide-entry-renderer',
  'ytd-guide-collapsible-entry-renderer',
  'yt-tab-shape[role="tab"]',
  'ytd-continuation-item-renderer',
  'ytd-reel-shelf-renderer',
  'ytd-rich-shelf-renderer',
  'grid-shelf-view-model',
  'article',
  '[role="listitem"]',
  'li',
].join(',');
const SHORT_FORM_SITE_IDS = new Set(['youtube', 'instagram', 'facebook', 'tiktok']);

function nowMs(windowRef) {
  if (typeof windowRef?.performance?.now === 'function') return windowRef.performance.now();
  return Date.now();
}

function roundMs(value) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? Number(numeric.toFixed(2)) : 0;
}

function normalizeOperationInteger(value) {
  return Number.isSafeInteger(value) && value >= 0 ? value : null;
}

function normalizeOptionalOperationInteger(value) {
  if (value === null || value === undefined) return null;
  return normalizeOperationInteger(value);
}

function operationIdentityKey(generation, operationId) {
  return `${generation}:${operationId}`;
}

function sameOptionalOperationInteger(left, right) {
  return normalizeOptionalOperationInteger(left) === normalizeOptionalOperationInteger(right);
}

function resolveShortFormSiteId(hostname) {
  const siteId = resolveCanonicalSiteId(hostname);
  return SHORT_FORM_SITE_IDS.has(siteId) ? siteId : null;
}

function isElement(value, windowRef) {
  const ElementCtor = windowRef?.Element;
  return typeof ElementCtor === 'function' && value instanceof ElementCtor;
}

function safeMatches(element, selector) {
  try {
    return element.matches(selector);
  } catch {
    return false;
  }
}

function safeClosest(element, selector) {
  try {
    return element.closest(selector);
  } catch {
    return null;
  }
}

function shortPathForAnchor(anchor, siteId, baseUrl) {
  let parsed;
  try {
    parsed = new URL(anchor.getAttribute('href') || anchor.href || '', baseUrl);
  } catch {
    return null;
  }
  if (resolveCanonicalSiteId(parsed.hostname) !== siteId) return null;
  const path = String(parsed.pathname || '');
  if (
    siteId === 'youtube'
    && /^\/shorts(?:\/|$)/iu.test(path)
  ) return 'shorts_route_link';
  if (
    siteId === 'instagram'
    && /^\/(?:reel|reels)(?:\/|$)/iu.test(path)
  ) {
    return 'reel_route_link';
  }
  if (
    siteId === 'facebook'
    && /^\/reels?(?:\/|$)/iu.test(path)
  ) {
    return 'reel_route_link';
  }
  if (
    siteId === 'tiktok'
  ) {
    const navigationId = anchor.getAttribute('data-e2e');
    if (
      navigationId === 'nav-foryou'
      && (path === '/' || /^\/foryou(?:\/|$)/iu.test(path))
    ) {
      return 'for_you_navigation';
    }
    if (
      navigationId === 'nav-following'
      && /^\/following(?:\/|$)/iu.test(path)
    ) {
      return 'following_navigation';
    }
  }
  return null;
}

function classifyOpportunityKind(element) {
  const tagName = String(element?.tagName || '').toLowerCase();
  if (tagName.includes('tab')) return 'tab';
  if (tagName.includes('guide')) return 'guide';
  if (tagName.includes('continuation')) return 'continuation';
  if (tagName.includes('shelf') || tagName === 'grid-shelf-view-model') return 'shelf';
  if (tagName === 'article') return 'card';
  return 'card';
}

function isShortLabelCandidate(element) {
  const normalized = String(element?.textContent || '').replace(/\s+/gu, ' ').trim().toLowerCase();
  return normalized === 'shorts' || normalized === '쇼츠';
}

function isEffectivelyHidden(element, windowRef) {
  if (!isElement(element, windowRef) || !element.isConnected) return false;
  let current = element;
  let depth = 0;
  while (current && depth < 16) {
    try {
      const style = windowRef.getComputedStyle(current);
      if (
        style.display === 'none'
        || style.visibility === 'hidden'
        || Number.parseFloat(style.opacity) === 0
      ) return true;
    } catch {
      return false;
    }
    current = current.parentElement;
    depth += 1;
  }
  return false;
}

function createStats() {
  return {
    mutationBatches: 0,
    observedRoots: 0,
    opportunityObservations: 0,
    duplicateOpportunityObservations: 0,
    droppedOpportunities: 0,
    droppedOpportunityObservations: 0,
    droppedOpportunityOverflow: 0,
    queryFailures: 0,
    targetOutcomeReadFailures: 0,
    probeMs: 0,
    probeMaxMs: 0,
    probeCount: 0,
    snapshotReadMs: 0,
    snapshotReadMaxMs: 0,
    snapshotReadCount: 0,
  };
}

export class RuntimeDebuggerShortFormOracle {
  constructor({
    windowRef = typeof window !== 'undefined' ? window : null,
    documentRef = typeof document !== 'undefined' ? document : null,
    hub = observerHub,
  } = {}) {
    this._window = windowRef;
    this._document = documentRef;
    this._hub = hub;
    this._unsubscribe = null;
    this._started = false;
    this._generation = 0;
    this._nextNodeId = 0;
    this._nodeIds = new WeakMap();
    this._opportunities = new Map();
    this._droppedOpportunityIds = new Set();
    this._stats = createStats();
    this._evidenceSiteId = null;
    this._startedAt = 0;
    this._boundMutationBatch = (payload, debugContext) => {
      this._observeMutationBatch(payload, debugContext);
    };
  }

  start({ observeInitial = true } = {}) {
    if (this._started) return false;
    if (!this._window || !this._document || typeof this._hub?.subscribe !== 'function') {
      throw new Error('RUNTIME_DEBUGGER_SHORT_FORM_ORACLE_ENVIRONMENT_REQUIRED');
    }
    this.reset();
    this._unsubscribe = this._hub.subscribe(this._boundMutationBatch, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['href'],
      debugLabel: 'RuntimeDebuggerShortFormOracle.observer',
    });
    if (typeof this._unsubscribe !== 'function') {
      throw new Error('RUNTIME_DEBUGGER_SHORT_FORM_ORACLE_SUBSCRIPTION_REQUIRED');
    }
    this._started = true;
    if (observeInitial) this.observeDocument();
    return true;
  }

  stop() {
    if (!this._started) return false;
    const unsubscribe = this._unsubscribe;
    this._unsubscribe = null;
    this._started = false;
    if (typeof unsubscribe === 'function') unsubscribe();
    return true;
  }

  reset() {
    this._generation += 1;
    this._nextNodeId = 0;
    this._nodeIds = new WeakMap();
    this._opportunities = new Map();
    this._droppedOpportunityIds = new Set();
    this._stats = createStats();
    this._evidenceSiteId = resolveShortFormSiteId(this._window?.location?.hostname);
    this._startedAt = nowMs(this._window);
  }

  observeDocument() {
    const root = this._document?.documentElement;
    if (!root) return 0;
    return this._inspectRoots([root], {
      source: 'initial_document',
      flushId: null,
      deliverySequence: null,
    });
  }

  _getNodeIdentity(node) {
    if (!isElement(node, this._window)) return null;
    let nodeId = this._nodeIds.get(node);
    if (!nodeId) {
      nodeId = ++this._nextNodeId;
      this._nodeIds.set(node, nodeId);
    }
    return `g${this._generation}:n${nodeId}`;
  }

  _queryAllIncludingRoot(root, selector) {
    if (!isElement(root, this._window)) return [];
    const results = [];
    try {
      if (root.matches(selector)) results.push(root);
      root.querySelectorAll(selector).forEach((entry) => results.push(entry));
    } catch {
      this._stats.queryFailures += 1;
    }
    return results;
  }

  _isExcluded(element) {
    return !!safeClosest(element, EXCLUDED_CONTEXT_SELECTOR);
  }

  _resolveOpportunityUnit(seed) {
    return safeClosest(seed, OPPORTUNITY_UNIT_SELECTOR) || seed;
  }

  _resolveProductMarker(node, anchor = null) {
    if (safeMatches(node, HIDDEN_TARGET_SELECTOR)) return node;
    return safeClosest(anchor || node, HIDDEN_TARGET_SELECTOR);
  }

  _readTargetOutcomeLineage(
    node,
    { maxDepth = MAX_TARGET_OUTCOME_ANCESTOR_DEPTH } = {},
  ) {
    const lineage = [];
    let current = node;
    let depth = 0;
    while (
      isElement(current, this._window)
      && depth <= maxDepth
    ) {
      try {
        const outcome = readShortFormTargetOutcome(current);
        if (outcome) {
          lineage.push({
            outcome,
            relation: depth === 0 ? 'self' : 'ancestor',
            depth,
          });
        }
      } catch {
        this._stats.targetOutcomeReadFailures += 1;
      }
      current = current.parentElement;
      depth += 1;
    }
    return lineage;
  }

  _hasCurrentOpportunityEvidence(opportunity) {
    const node = opportunity?.node;
    if (!isElement(node, this._window) || !node.isConnected) return true;
    const siteId = resolveShortFormSiteId(this._window?.location?.hostname);
    if (!siteId) return false;
    const baseUrl = String(this._window?.location?.href || '');
    const anchors = this._queryAllIncludingRoot(node, OPPORTUNITY_LINK_SELECTOR);
    if (anchors.some((anchor) => !!shortPathForAnchor(anchor, siteId, baseUrl))) return true;
    if (siteId !== 'youtube') return false;
    if (this._queryAllIncludingRoot(node, YOUTUBE_STRUCTURAL_SELECTOR).length > 0) return true;
    return this._queryAllIncludingRoot(node, LABEL_CANDIDATE_SELECTOR)
      .some((element) => isShortLabelCandidate(element));
  }

  _recordReclassifiedOpportunities(roots, context) {
    const flushId = Number(context?.flushId);
    if (!Number.isFinite(flushId)) return;
    const candidates = Array.from(new Set(roots || []))
      .filter((root) => isElement(root, this._window));
    if (candidates.length === 0) return;
    this._opportunities.forEach((opportunity) => {
      const node = opportunity.node;
      if (!isElement(node, this._window) || !node.isConnected) return;
      const affected = candidates.some((root) => (
        root === node || node.contains(root) || root.contains(node)
      ));
      if (!affected || this._hasCurrentOpportunityEvidence(opportunity)) return;
      if (opportunity.reclassifiedFlushId === null) {
        opportunity.reclassifiedFlushId = flushId;
      }
    });
  }

  _recordOpportunity(unit, anchor, {
    kind,
    evidence,
    source,
    flushId,
    deliverySequence,
  }) {
    if (!isElement(unit, this._window) || this._isExcluded(unit)) return false;
    const identity = this._getNodeIdentity(unit);
    if (!identity) return false;
    const existing = this._opportunities.get(identity);
    this._stats.opportunityObservations += 1;
    if (existing) {
      existing.evidence.add(evidence);
      if (!existing.anchor && isElement(anchor, this._window)) existing.anchor = anchor;
      existing.productMarkerObserved = existing.productMarkerObserved
        || !!this._resolveProductMarker(unit, anchor);
      existing.reclassifiedFlushId = null;
      existing.retiredProof = null;
      existing.retiredReclassifiedFlushId = null;
      existing.retiredTargetRelation = null;
      existing.retiredTargetDepth = null;
      existing.reconciliationOperationIds = [];
      existing.lastSeenFlushId = Number.isFinite(Number(flushId)) ? Number(flushId) : null;
      this._stats.duplicateOpportunityObservations += 1;
      return false;
    }
    if (this._droppedOpportunityIds.has(identity)) {
      this._stats.droppedOpportunityObservations += 1;
      return false;
    }
    if (this._opportunities.size >= MAX_OPPORTUNITIES) {
      this._stats.droppedOpportunityObservations += 1;
      if (this._droppedOpportunityIds.size < MAX_DROPPED_OPPORTUNITY_IDS) {
        this._droppedOpportunityIds.add(identity);
        this._stats.droppedOpportunities += 1;
      } else {
        this._stats.droppedOpportunityOverflow += 1;
      }
      return false;
    }
    const observedAt = nowMs(this._window);
    this._opportunities.set(identity, {
      identity,
      node: unit,
      anchor: isElement(anchor, this._window) ? anchor : null,
      kind,
      evidence: new Set([evidence]),
      source,
      firstSeenAt: observedAt,
      firstSeenFlushId: Number.isFinite(Number(flushId)) ? Number(flushId) : null,
      firstSeenDeliverySequence: Number.isFinite(Number(deliverySequence))
        ? Number(deliverySequence)
        : null,
      lastSeenFlushId: Number.isFinite(Number(flushId)) ? Number(flushId) : null,
      terminalState: null,
      terminalAt: null,
      terminalProof: null,
      terminalOperationIds: [],
      terminalTargetRelation: null,
      terminalTargetDepth: null,
      retiredProof: null,
      retiredReclassifiedFlushId: null,
      retiredTargetRelation: null,
      retiredTargetDepth: null,
      reconciliationOperationIds: [],
      productMarkerObserved: !!this._resolveProductMarker(unit, anchor),
      reclassifiedFlushId: null,
    });
    return true;
  }

  _inspectRoot(root, context, siteId) {
    const baseUrl = String(this._window?.location?.href || '');
    let added = 0;
    const anchors = this._queryAllIncludingRoot(root, OPPORTUNITY_LINK_SELECTOR);
    anchors.forEach((anchor) => {
      if (this._isExcluded(anchor)) return;
      const evidence = shortPathForAnchor(anchor, siteId, baseUrl);
      if (!evidence) return;
      const unit = this._resolveOpportunityUnit(anchor);
      if (this._recordOpportunity(unit, anchor, {
        ...context,
        kind: classifyOpportunityKind(unit),
        evidence,
      })) added += 1;
    });

    if (siteId === 'youtube') {
      const structural = this._queryAllIncludingRoot(root, YOUTUBE_STRUCTURAL_SELECTOR);
      structural.forEach((element) => {
        if (this._isExcluded(element)) return;
        const knownAnchor = this._queryAllIncludingRoot(element, OPPORTUNITY_LINK_SELECTOR)
          .some((anchor) => !!shortPathForAnchor(anchor, siteId, baseUrl));
        if (knownAnchor) return;
        const unit = this._resolveOpportunityUnit(element);
        if (this._recordOpportunity(unit, null, {
          ...context,
          kind: classifyOpportunityKind(unit),
          evidence: 'shorts_structural_renderer',
        })) added += 1;
      });
      const labelCandidates = this._queryAllIncludingRoot(root, LABEL_CANDIDATE_SELECTOR);
      labelCandidates.forEach((element) => {
        if (this._isExcluded(element) || !isShortLabelCandidate(element)) return;
        const unit = this._resolveOpportunityUnit(element);
        if (this._recordOpportunity(unit, null, {
          ...context,
          kind: classifyOpportunityKind(unit),
          evidence: 'shorts_accessible_label',
        })) added += 1;
      });
    }
    return added;
  }

  _inspectRoots(roots, context) {
    const siteId = resolveShortFormSiteId(this._window?.location?.hostname);
    if (!siteId || siteId !== this._evidenceSiteId) return 0;
    const startedAt = nowMs(this._window);
    let added = 0;
    Array.from(new Set(roots || [])).forEach((root) => {
      if (!isElement(root, this._window)) return;
      this._stats.observedRoots += 1;
      added += this._inspectRoot(root, context, siteId);
    });
    const durationMs = Math.max(0, nowMs(this._window) - startedAt);
    this._stats.probeMs += durationMs;
    this._stats.probeMaxMs = Math.max(this._stats.probeMaxMs, durationMs);
    this._stats.probeCount += 1;
    return added;
  }

  _observeMutationBatch(payload = {}, debugContext = null) {
    if (!this._started) return;
    this._stats.mutationBatches += 1;
    const roots = [
      ...(payload.addedNodes || []),
      ...(payload.attributeTargets || []),
    ];
    const context = {
      source: 'observer_flush',
      flushId: debugContext?.flushId ?? null,
      deliverySequence: debugContext?.deliverySequence ?? null,
    };
    this._recordReclassifiedOpportunities(roots, context);
    this._inspectRoots(roots, context);
  }

  _resolveTerminalEvidence(opportunity) {
    const node = opportunity.node;
    const anchor = opportunity.anchor;
    const marked = this._resolveProductMarker(node, anchor);
    if (!node?.isConnected) {
      return { state: 'removed', productMarker: !!marked };
    }
    if (
      isEffectivelyHidden(node, this._window)
      || isEffectivelyHidden(anchor, this._window)
      || isEffectivelyHidden(marked, this._window)
    ) return { state: 'hidden', productMarker: !!marked };
    return { state: 'pending', productMarker: false };
  }

  getSnapshot({
    active = false,
    ownerAvailable = true,
    ownerObserverAttached = false,
    observerHubSnapshot = null,
    productOperations = [],
  } = {}) {
    const snapshotStartedAt = nowMs(this._window);
    const operationsByIdentity = new Map();
    let productOperationContractFailures = 0;
    (Array.isArray(productOperations) ? productOperations : []).forEach((operation) => {
      const prunedCount = normalizeOperationInteger(operation?.pruned);
      const restoredCount = normalizeOperationInteger(operation?.restored);
      const hasTargetOutcome = (prunedCount || 0) > 0 || (restoredCount || 0) > 0;
      if (!hasTargetOutcome) return;
      const generation = normalizeOperationInteger(operation?.generation);
      const operationId = normalizeOperationInteger(operation?.operationId);
      const flushId = normalizeOptionalOperationInteger(operation?.flushId);
      const deliverySequence = normalizeOptionalOperationInteger(operation?.deliverySequence);
      if (
        generation === null
        || operationId === null
        || prunedCount === null
        || restoredCount === null
        || (
          operation?.flushId !== null
          && operation?.flushId !== undefined
          && flushId === null
        )
        || (
          operation?.deliverySequence !== null
          && operation?.deliverySequence !== undefined
          && deliverySequence === null
        )
      ) {
        productOperationContractFailures += 1;
        return;
      }
      const identityKey = operationIdentityKey(generation, operationId);
      if (operationsByIdentity.has(identityKey)) {
        productOperationContractFailures += 1;
        return;
      }
      operationsByIdentity.set(identityKey, {
        generation,
        operationId,
        flushId,
        deliverySequence,
        prunedCount,
        restoredCount,
      });
    });
    const resolveTargetOperation = (outcome, expectedAction) => {
      if (!outcome || outcome.action !== expectedAction) return null;
      const generation = normalizeOperationInteger(outcome.generation);
      const operationId = normalizeOperationInteger(outcome.operationId);
      if (generation === null || operationId === null) return null;
      const operation = operationsByIdentity.get(operationIdentityKey(generation, operationId));
      if (!operation) return null;
      const count = expectedAction === 'pruned'
        ? operation.prunedCount
        : operation.restoredCount;
      if (
        count <= 0
        || !sameOptionalOperationInteger(operation.flushId, outcome.flushId)
        || !sameOptionalOperationInteger(
          operation.deliverySequence,
          outcome.deliverySequence,
        )
      ) return null;
      return operation;
    };
    const resolveLineageOperation = (
      lineage,
      outcomeKey,
      expectedAction,
      acceptsEntry = () => true,
    ) => {
      for (const entry of lineage) {
        if (!acceptsEntry(entry)) continue;
        const operation = resolveTargetOperation(entry.outcome?.[outcomeKey], expectedAction);
        if (operation) return { ...entry, operation };
      }
      return null;
    };

    const counts = {
      observedOpportunityCount: this._opportunities.size,
      opportunityCount: 0,
      retiredCount: 0,
      terminalCount: 0,
      hiddenCount: 0,
      removedCount: 0,
      pendingCount: 0,
      attributedTerminalCount: 0,
      unattributedTerminalCount: 0,
      causallyProvenTerminalCount: 0,
      unprovenTerminalCount: 0,
    };
    let totalEffectLatencyMs = 0;
    let maxEffectLatencyMs = 0;
    let targetOutcomeMismatchCount = 0;
    const recentOpportunities = [];
    this._opportunities.forEach((opportunity) => {
      const terminalEvidence = this._resolveTerminalEvidence(opportunity);
      const terminalState = terminalEvidence.state;
      const currentOpportunityEvidence = this._hasCurrentOpportunityEvidence(opportunity);
      const previouslyProductProven = opportunity.productMarkerObserved
        || opportunity.terminalProof !== null;
      if (opportunity.node?.isConnected === true && currentOpportunityEvidence) {
        opportunity.reclassifiedFlushId = null;
        opportunity.retiredProof = null;
        opportunity.retiredReclassifiedFlushId = null;
        opportunity.retiredTargetRelation = null;
        opportunity.retiredTargetDepth = null;
        opportunity.reconciliationOperationIds = [];
      }
      const reconciliationCandidate = (
        opportunity.node?.isConnected === true
        && currentOpportunityEvidence === false
        && previouslyProductProven
        && opportunity.reclassifiedFlushId !== null
      );
      const shouldCaptureInitialMarkerOperation = (
        terminalEvidence.productMarker
        && opportunity.terminalProof === null
      );
      const targetOutcomeLineage = terminalState === 'removed' || reconciliationCandidate
        ? this._readTargetOutcomeLineage(opportunity.node)
        : shouldCaptureInitialMarkerOperation
          ? this._readTargetOutcomeLineage(opportunity.node, { maxDepth: 0 })
          : [];
      const pruneMatch = resolveLineageOperation(
        targetOutcomeLineage,
        'pruned',
        'pruned',
        (entry) => (
          (
            terminalState === 'removed'
            && entry.outcome?.pruned?.mode === 'remove'
          )
          || (
            terminalState === 'hidden'
            && entry.relation === 'self'
            && (
              entry.outcome?.pruned?.mode === 'hide'
              || entry.outcome?.pruned?.mode === 'collapse'
            )
          )
          || (
            reconciliationCandidate
            && opportunity.productMarkerObserved
            && entry.relation === 'self'
            && (
              entry.outcome?.pruned?.mode === 'hide'
              || entry.outcome?.pruned?.mode === 'collapse'
            )
          )
        ),
      );
      const restoreMatch = resolveLineageOperation(
        targetOutcomeLineage,
        'restored',
        'restored',
        (entry) => (
          entry.relation === 'self'
          || (
            entry.relation === 'ancestor'
            && opportunity.terminalProof === 'owner_target_ancestor_operation'
            && opportunity.terminalTargetDepth === entry.depth
          )
        ),
      );
      const pruneOperation = pruneMatch?.operation || null;
      const restoreOperation = restoreMatch?.operation || null;
      const productOperationIds = pruneOperation
        ? [pruneOperation.operationId]
        : [...opportunity.terminalOperationIds];
      const reconciliationOperationIds = restoreOperation
        ? [restoreOperation.operationId]
        : [...opportunity.reconciliationOperationIds];
      const exactRestoreMatched = restoreOperation !== null
        && sameOptionalOperationInteger(
          opportunity.reclassifiedFlushId,
          restoreOperation.flushId,
        );
      const retainedRestoreMatched = (
        opportunity.retiredProof === 'owner_target_reconcile'
        || opportunity.retiredProof === 'owner_target_ancestor_reconcile'
      )
        && opportunity.retiredReclassifiedFlushId === opportunity.reclassifiedFlushId;
      const retiredAfterOwnerReconcile = (
        opportunity.node?.isConnected === true
        && currentOpportunityEvidence === false
        && previouslyProductProven
        && (exactRestoreMatched || retainedRestoreMatched)
      );
      if (
        targetOutcomeLineage.some((entry) => entry.outcome?.restored)
        && opportunity.reclassifiedFlushId !== null
        && previouslyProductProven
        && !retiredAfterOwnerReconcile
      ) targetOutcomeMismatchCount += 1;
      if (retiredAfterOwnerReconcile) {
        if (exactRestoreMatched) {
          opportunity.retiredProof = restoreMatch.relation === 'self'
            ? 'owner_target_reconcile'
            : 'owner_target_ancestor_reconcile';
          opportunity.retiredReclassifiedFlushId = opportunity.reclassifiedFlushId;
          opportunity.retiredTargetRelation = restoreMatch.relation;
          opportunity.retiredTargetDepth = restoreMatch.depth;
          opportunity.reconciliationOperationIds = [restoreOperation.operationId];
          if (pruneOperation) {
            opportunity.terminalOperationIds = [pruneOperation.operationId];
          }
        }
        counts.retiredCount += 1;
        recentOpportunities.push({
          opportunityId: opportunity.identity,
          kind: opportunity.kind,
          evidence: Array.from(opportunity.evidence).sort(),
          source: opportunity.source,
          firstSeenOffsetMs: roundMs(opportunity.firstSeenAt - this._startedAt),
          firstSeenFlushId: opportunity.firstSeenFlushId,
          firstSeenDeliverySequence: opportunity.firstSeenDeliverySequence,
          terminalState: 'retired',
          causalProof: opportunity.retiredProof,
          causalTargetRelation: opportunity.retiredTargetRelation,
          causalTargetDepth: opportunity.retiredTargetDepth,
          effectLatencyMs: null,
          productOperationIds,
          reconciliationOperationIds,
        });
        return;
      }
      const currentProof = terminalState === 'pending'
        ? null
        : terminalEvidence.productMarker
          ? 'product_marker'
          : pruneOperation
            ? (
              pruneMatch.relation === 'self'
                ? 'owner_target_operation'
                : 'owner_target_ancestor_operation'
            )
            : null;
      if (
        terminalState !== 'pending'
        && !terminalEvidence.productMarker
        && !opportunity.terminalProof
        && targetOutcomeLineage.some((entry) => entry.outcome?.pruned)
        && !pruneOperation
      ) targetOutcomeMismatchCount += 1;
      if (terminalState === 'pending') {
        opportunity.terminalState = null;
        opportunity.terminalAt = null;
        opportunity.terminalProof = null;
        opportunity.terminalOperationIds = [];
        opportunity.terminalTargetRelation = null;
        opportunity.terminalTargetDepth = null;
      } else {
        const terminalTransitioned = opportunity.terminalState !== terminalState;
        if (terminalTransitioned || opportunity.terminalAt === null) {
          opportunity.terminalAt = nowMs(this._window);
        }
        opportunity.terminalState = terminalState;
        opportunity.terminalProof = currentProof
          || (
            terminalState === 'removed' && !terminalTransitioned
              ? opportunity.terminalProof
              : null
          );
        if (currentProof === 'owner_target_operation'
          || currentProof === 'owner_target_ancestor_operation') {
          opportunity.terminalTargetRelation = pruneMatch.relation;
          opportunity.terminalTargetDepth = pruneMatch.depth;
        } else if (currentProof === 'product_marker' || !opportunity.terminalProof) {
          opportunity.terminalTargetRelation = null;
          opportunity.terminalTargetDepth = null;
        }
        if (pruneOperation) {
          opportunity.terminalOperationIds = [pruneOperation.operationId];
        } else if (!opportunity.terminalProof) {
          opportunity.terminalOperationIds = [];
        }
      }
      const resolvedState = terminalState;
      counts.opportunityCount += 1;
      if (resolvedState === 'pending') {
        counts.pendingCount += 1;
      } else {
        counts.terminalCount += 1;
        if (resolvedState === 'hidden') counts.hiddenCount += 1;
        if (resolvedState === 'removed') counts.removedCount += 1;
      }
      if (resolvedState !== 'pending') {
        if (opportunity.terminalProof) {
          counts.attributedTerminalCount += 1;
          counts.causallyProvenTerminalCount += 1;
        } else {
          counts.unattributedTerminalCount += 1;
          counts.unprovenTerminalCount += 1;
        }
      }
      const effectLatencyMs = opportunity.terminalAt === null
        ? null
        : Math.max(0, opportunity.terminalAt - opportunity.firstSeenAt);
      if (effectLatencyMs !== null) {
        totalEffectLatencyMs += effectLatencyMs;
        maxEffectLatencyMs = Math.max(maxEffectLatencyMs, effectLatencyMs);
      }
      recentOpportunities.push({
        opportunityId: opportunity.identity,
        kind: opportunity.kind,
        evidence: Array.from(opportunity.evidence).sort(),
        source: opportunity.source,
        firstSeenOffsetMs: roundMs(opportunity.firstSeenAt - this._startedAt),
        firstSeenFlushId: opportunity.firstSeenFlushId,
        firstSeenDeliverySequence: opportunity.firstSeenDeliverySequence,
        terminalState: resolvedState,
        causalProof: opportunity.terminalProof,
        causalTargetRelation: opportunity.terminalTargetRelation,
        causalTargetDepth: opportunity.terminalTargetDepth,
        effectLatencyMs: effectLatencyMs === null ? null : roundMs(effectLatencyMs),
        productOperationIds: [...opportunity.terminalOperationIds],
        reconciliationOperationIds,
      });
    });

    const observerPendingMutationCount = observerHubSnapshot?.pendingMutationCount;
    const observerFlushScheduled = observerHubSnapshot?.flushScheduled;
    const observerFactsValid = Number.isSafeInteger(observerPendingMutationCount)
      && observerPendingMutationCount >= 0
      && typeof observerFlushScheduled === 'boolean';
    const observerSettled = observerFactsValid
      && observerPendingMutationCount === 0
      && observerFlushScheduled === false;
    const siteId = resolveShortFormSiteId(this._window?.location?.hostname);
    const siteEvidenceCurrent = siteId === this._evidenceSiteId;
    const oracleCoverageEstablished = siteEvidenceCurrent && this._stats.observedRoots > 0;
    const ownerScopeAvailable = ownerAvailable === true && siteId !== null;
    const evidenceGapCount = (
      this._stats.queryFailures
      + this._stats.targetOutcomeReadFailures
      + this._stats.droppedOpportunities
      + (this._stats.droppedOpportunityOverflow > 0 ? 1 : 0)
      + productOperationContractFailures
      + targetOutcomeMismatchCount
      + (active === true && !observerFactsValid ? 1 : 0)
    );
    const analysis = analyzeRuntimeDebuggerShortFormCompleteness({
      active: active === true,
      available: ownerScopeAvailable,
      ownerObserverAttached: ownerObserverAttached === true,
      oracleAttached: this._started && typeof this._unsubscribe === 'function',
      oracleCoverageEstablished,
      siteEvidenceCurrent,
      observerSettled,
      opportunityCount: counts.opportunityCount,
      terminalCount: counts.terminalCount,
      causallyProvenTerminalCount: counts.causallyProvenTerminalCount,
      pendingCount: counts.pendingCount,
      evidenceGapCount,
    });

    const snapshotReadMs = Math.max(0, nowMs(this._window) - snapshotStartedAt);
    this._stats.snapshotReadMs += snapshotReadMs;
    this._stats.snapshotReadMaxMs = Math.max(this._stats.snapshotReadMaxMs, snapshotReadMs);
    this._stats.snapshotReadCount += 1;
    const targetingHealth = projectRuntimeDebuggerShortFormTargetingHealth({
      siteId,
      active: active === true,
      available: ownerScopeAvailable,
      completeness: analysis,
    });
    const snapshot = sanitizeRuntimeDebuggerValue({
      ...analysis,
      siteId,
      evidenceSiteId: this._evidenceSiteId,
      oracleAttached: this._started && typeof this._unsubscribe === 'function',
      ownerObserverAttached: ownerObserverAttached === true,
      counts,
      timing: {
        totalEffectLatencyMs: roundMs(totalEffectLatencyMs),
        maxEffectLatencyMs: roundMs(maxEffectLatencyMs),
        averageEffectLatencyMs: counts.terminalCount > 0
          ? roundMs(totalEffectLatencyMs / counts.terminalCount)
          : null,
      },
      overhead: {
        probeMs: roundMs(this._stats.probeMs),
        probeMaxMs: roundMs(this._stats.probeMaxMs),
        probeCount: this._stats.probeCount,
        snapshotReadMs: roundMs(this._stats.snapshotReadMs),
        snapshotReadMaxMs: roundMs(this._stats.snapshotReadMaxMs),
        snapshotReadCount: this._stats.snapshotReadCount,
      },
      ledger: {
        mutationBatches: this._stats.mutationBatches,
        observedRoots: this._stats.observedRoots,
        opportunityObservations: this._stats.opportunityObservations,
        duplicateOpportunityObservations: this._stats.duplicateOpportunityObservations,
        opportunityCapacity: MAX_OPPORTUNITIES,
        queryFailureCount: this._stats.queryFailures,
        targetOutcomeReadFailureCount: this._stats.targetOutcomeReadFailures,
        targetOutcomeMismatchCount,
        productOperationContractFailureCount: productOperationContractFailures,
        droppedOpportunityCount: this._stats.droppedOpportunities,
        droppedOpportunityObservationCount: this._stats.droppedOpportunityObservations,
        droppedOpportunityOverflowCount: this._stats.droppedOpportunityOverflow,
        evidenceGapCount,
        recentOpportunities: recentOpportunities.slice(-MAX_RECENT_OPPORTUNITIES),
      },
    });
    return {
      ...snapshot,
      targetingHealth,
    };
  }
}

export default RuntimeDebuggerShortFormOracle;
