const ELEMENT_NODE = 1;
const TEXT_NODE = 3;
const DOCUMENT_NODE = 9;
const ATTRIBUTE_MUTATION = 'attributes';
const CHILD_LIST_MUTATION = 'childList';
const CHARACTER_DATA_MUTATION = 'characterData';

export const SOCIAL_METRICS_OWNED_MUTATION_MAX_AGE_MS = 5000;
export const SOCIAL_METRICS_OWNED_MUTATION_MAX_DELIVERY_LAG = 4;

function defaultNow() {
  if (typeof performance !== 'undefined' && typeof performance.now === 'function') {
    return performance.now();
  }
  return Date.now();
}

function requireElement(target) {
  if (!target || target.nodeType !== ELEMENT_NODE) {
    throw new Error('SOCIAL_METRICS_OWNED_MUTATION_TARGET_REQUIRED');
  }
  return target;
}

function requireOwnField(value, field) {
  if (!Object.prototype.hasOwnProperty.call(value || {}, field)) {
    throw new Error(`SOCIAL_METRICS_OWNED_MUTATION_${field.toUpperCase()}_REQUIRED`);
  }
  return value[field];
}

function requireObservationContext({
  documentRef,
  observationRoot,
  observationEpoch,
  deliverySequence = 0,
} = {}) {
  if (!documentRef || documentRef.nodeType !== DOCUMENT_NODE) {
    throw new Error('SOCIAL_METRICS_OWNED_MUTATION_DOCUMENT_REQUIRED');
  }
  const rootIsDocument = observationRoot?.nodeType === DOCUMENT_NODE;
  const rootIsElement = observationRoot?.nodeType === ELEMENT_NODE;
  if (!rootIsDocument && !rootIsElement) {
    throw new Error('SOCIAL_METRICS_OWNED_MUTATION_OBSERVATION_ROOT_REQUIRED');
  }
  if (
    (rootIsDocument && observationRoot !== documentRef)
    || (rootIsElement && observationRoot.ownerDocument !== documentRef)
  ) {
    throw new Error('SOCIAL_METRICS_OWNED_MUTATION_OBSERVATION_ROOT_FOREIGN');
  }
  if (!Number.isSafeInteger(observationEpoch) || observationEpoch < 1) {
    throw new Error('SOCIAL_METRICS_OWNED_MUTATION_OBSERVATION_EPOCH_INVALID');
  }
  if (!Number.isSafeInteger(deliverySequence) || deliverySequence < 0) {
    throw new Error('SOCIAL_METRICS_OWNED_MUTATION_DELIVERY_SEQUENCE_INVALID');
  }
  return {
    documentRef,
    observationRoot,
    observationEpoch,
    deliverySequence,
  };
}

function createProjectionBucket() {
  return { items: [], seen: new Set() };
}

function pushUnique(bucket, value) {
  if (!value || bucket.seen.has(value)) return;
  bucket.seen.add(value);
  bucket.items.push(value);
}

function projectMutations(mutations = []) {
  const projection = {
    addedNodes: createProjectionBucket(),
    removedNodes: createProjectionBucket(),
    textNodes: createProjectionBucket(),
    attributeTargets: createProjectionBucket(),
  };
  mutations.forEach((mutation) => {
    if (mutation?.type === CHILD_LIST_MUTATION) {
      Array.from(mutation.addedNodes || []).forEach((node) => {
        pushUnique(projection.addedNodes, node);
      });
      Array.from(mutation.removedNodes || []).forEach((node) => {
        pushUnique(projection.removedNodes, node);
      });
      return;
    }
    if (mutation?.type === CHARACTER_DATA_MUTATION) {
      pushUnique(projection.textNodes, mutation.target);
      return;
    }
    if (mutation?.type === ATTRIBUTE_MUTATION) {
      pushUnique(projection.attributeTargets, mutation.target);
    }
  });
  return projection;
}

function preserveUnprojectedPayloadNodes(payload, allProjection, nextProjection) {
  ['addedNodes', 'removedNodes', 'textNodes', 'attributeTargets'].forEach((field) => {
    const projected = allProjection[field];
    (Array.isArray(payload?.[field]) ? payload[field] : []).forEach((node) => {
      if (!projected.seen.has(node)) pushUnique(nextProjection[field], node);
    });
  });
}

function createFilteredPayload(payload, allMutations, retainedMutations) {
  const allProjection = projectMutations(allMutations);
  const nextProjection = projectMutations(retainedMutations);
  preserveUnprojectedPayloadNodes(payload, allProjection, nextProjection);
  return {
    ...payload,
    mutations: retainedMutations,
    addedNodes: nextProjection.addedNodes.items,
    removedNodes: nextProjection.removedNodes.items,
    textNodes: nextProjection.textNodes.items,
    attributeTargets: nextProjection.attributeTargets.items,
  };
}

function hasPayloadWork(payload) {
  return [
    'mutations',
    'addedNodes',
    'removedNodes',
    'textNodes',
    'attributeTargets',
  ].some((field) => Array.isArray(payload?.[field]) && payload[field].length > 0);
}

function resolveTextOwner(mutation) {
  if (mutation?.type === CHILD_LIST_MUTATION) {
    return mutation.target?.nodeType === ELEMENT_NODE ? mutation.target : null;
  }
  if (mutation?.type !== CHARACTER_DATA_MUTATION) return null;
  const textNode = mutation.target;
  if (!textNode || textNode.nodeType !== TEXT_NODE) return null;
  const parent = textNode.parentElement || textNode.parentNode;
  return parent?.nodeType === ELEMENT_NODE ? parent : null;
}

/**
 * Tracks exact Social Metrics DOM writes without retaining an iterable list of
 * nodes. Expected values remain ephemeral inside WeakMap-owned records, while
 * the public pending snapshot contains only scalar timing/cardinality data.
 */
export function createOwnedMutationLedger({
  documentRef = globalThis.document,
  observationRoot = documentRef?.documentElement || documentRef,
  observationEpoch = 1,
  maxPendingAgeMs = SOCIAL_METRICS_OWNED_MUTATION_MAX_AGE_MS,
  maxDeliveryLag = SOCIAL_METRICS_OWNED_MUTATION_MAX_DELIVERY_LAG,
  now = defaultNow,
} = {}) {
  if (typeof now !== 'function') {
    throw new Error('SOCIAL_METRICS_OWNED_MUTATION_CLOCK_REQUIRED');
  }
  const resolvedMaxAge = Number(maxPendingAgeMs);
  if (!Number.isFinite(resolvedMaxAge) || resolvedMaxAge <= 0) {
    throw new Error('SOCIAL_METRICS_OWNED_MUTATION_MAX_AGE_INVALID');
  }
  const resolvedMaxDeliveryLag = Number(maxDeliveryLag);
  if (!Number.isSafeInteger(resolvedMaxDeliveryLag) || resolvedMaxDeliveryLag < 1) {
    throw new Error('SOCIAL_METRICS_OWNED_MUTATION_MAX_DELIVERY_LAG_INVALID');
  }

  let context = requireObservationContext({
    documentRef,
    observationRoot,
    observationEpoch,
  });
  let pendingByTarget = new WeakMap();
  let pendingTokens = [];
  let pendingCount = 0;
  let lastNow = 0;
  let diagnostics = createDiagnostics();

  function createDiagnostics() {
    return {
      ageExpiredCount: 0,
      deliveryExpiredCount: 0,
      epochInvalidatedCount: 0,
      rootInvalidatedCount: 0,
      targetUnobservedCount: 0,
      valueMismatchCount: 0,
      excessRecordCount: 0,
    };
  }

  function readNow() {
    const value = Number(now());
    if (!Number.isFinite(value) || value < 0) {
      throw new Error('SOCIAL_METRICS_OWNED_MUTATION_CLOCK_INVALID');
    }
    lastNow = Math.max(lastNow, value);
    return lastNow;
  }

  function deactivateToken(token, reason = null) {
    if (!token?.active) return;
    token.active = false;
    pendingCount = Math.max(0, pendingCount - 1);
    if (reason && Object.hasOwn(diagnostics, reason)) diagnostics[reason] += 1;
  }

  function expireTokens(at = readNow()) {
    while (pendingTokens.length > 0) {
      const token = pendingTokens[0];
      if (!token.active) {
        pendingTokens.shift();
        continue;
      }
      const deliveryLag = context.deliverySequence - token.recordedAtDeliverySequence;
      const expiredByDelivery = deliveryLag > resolvedMaxDeliveryLag;
      const expiredByAge = token.expiresAt <= at;
      if (!expiredByDelivery && !expiredByAge) break;
      pendingTokens.shift();
      deactivateToken(
        token,
        expiredByDelivery ? 'deliveryExpiredCount' : 'ageExpiredCount',
      );
    }
  }

  function createPendingToken() {
    const recordedAt = readNow();
    expireTokens(recordedAt);
    const token = {
      active: true,
      epoch: context.observationEpoch,
      recordedAtDeliverySequence: context.deliverySequence,
      recordedAt,
      expiresAt: recordedAt + resolvedMaxAge,
    };
    pendingTokens.push(token);
    pendingCount += 1;
    return token;
  }

  function clearPendingTokens(tokens = [], reason = null) {
    tokens.forEach((token) => deactivateToken(token, reason));
  }

  function getActiveTokens(tokens = []) {
    expireTokens();
    return tokens.filter((token) => (
      token?.active && token.epoch === context.observationEpoch
    ));
  }

  function consumePendingTokens(tokens, count) {
    let remaining = Math.max(0, Number(count) || 0);
    tokens.forEach((token) => {
      if (remaining <= 0 || !token?.active) return;
      deactivateToken(token);
      remaining -= 1;
    });
    return getActiveTokens(tokens);
  }

  function clearAllPending(reason = null) {
    if (reason) pendingTokens.forEach((token) => deactivateToken(token, reason));
    pendingByTarget = new WeakMap();
    pendingTokens = [];
    pendingCount = 0;
  }

  function getPendingState(target, { create = false } = {}) {
    let state = pendingByTarget.get(target);
    let created = false;
    if (!state && create) {
      state = {
        attributes: new Map(),
        text: null,
      };
      pendingByTarget.set(target, state);
      created = true;
    }
    if (!state) return null;
    if (created) return state;
    if (!isTargetObserved(target)) {
      state.attributes.forEach((pending) => (
        clearPendingTokens(pending.tokens, 'targetUnobservedCount')
      ));
      if (state.text) clearPendingTokens(state.text.tokens, 'targetUnobservedCount');
      pendingByTarget.delete(target);
      return null;
    }

    state.attributes.forEach((pending, name) => {
      pending.tokens = getActiveTokens(pending.tokens);
      if (pending.tokens.length === 0) state.attributes.delete(name);
    });
    if (state.text) {
      state.text.tokens = getActiveTokens(state.text.tokens);
      if (state.text.tokens.length === 0) state.text = null;
    }
    releaseEmptyState(target, state);
    return state.attributes.size > 0 || state.text !== null ? state : null;
  }

  function releaseEmptyState(target, state) {
    if (state && state.attributes.size === 0 && state.text === null) {
      pendingByTarget.delete(target);
    }
  }

  function isTargetObserved(target) {
    if (target.ownerDocument !== context.documentRef || target.isConnected !== true) return false;
    const root = context.observationRoot;
    if (root.nodeType === DOCUMENT_NODE) {
      return root === context.documentRef
        && !!context.documentRef.documentElement?.contains(target);
    }
    return root.isConnected === true && (root === target || root.contains(target));
  }

  function recordMutation(record = {}) {
    const target = requireElement(record.target);
    if (!isTargetObserved(target)) return false;
    const state = getPendingState(target, { create: true });
    if (record.kind === 'attribute') {
      const name = String(requireOwnField(record, 'name') || '').trim();
      if (!name) throw new Error('SOCIAL_METRICS_OWNED_MUTATION_NAME_REQUIRED');
      const rawExpectedValue = requireOwnField(record, 'expectedValue');
      const expectedValue = rawExpectedValue === null || rawExpectedValue === undefined
        ? null
        : String(rawExpectedValue);
      const existing = state.attributes.get(name);
      const tokens = existing ? getActiveTokens(existing.tokens) : [];
      state.attributes.set(name, {
        expectedValue,
        tokens: [...tokens, createPendingToken()],
      });
      return true;
    }
    if (record.kind === 'childList') {
      const expectedText = String(requireOwnField(record, 'expectedText') ?? '');
      const tokens = state.text ? getActiveTokens(state.text.tokens) : [];
      state.text = {
        expectedText,
        tokens: [...tokens, createPendingToken()],
      };
      return true;
    }
    throw new Error(`SOCIAL_METRICS_OWNED_MUTATION_KIND_INVALID:${String(record.kind || 'empty')}`);
  }

  function filterPayload(payload) {
    if (pendingCount === 0) return { payload: payload || null, consumedCount: 0 };
    expireTokens();
    if (pendingCount === 0) return { payload: payload || null, consumedCount: 0 };
    const mutations = Array.isArray(payload?.mutations) ? payload.mutations : null;
    if (!mutations || mutations.length === 0) {
      return { payload: payload || null, consumedCount: 0 };
    }

    const attributeGroupsByTarget = new WeakMap();
    const textGroupsByOwner = new WeakMap();
    const groups = [];

    mutations.forEach((mutation) => {
      if (mutation?.type === ATTRIBUTE_MUTATION) {
        const target = mutation.target;
        if (!target || target.nodeType !== ELEMENT_NODE) return;
        const state = getPendingState(target);
        const name = String(mutation.attributeName || '');
        const pending = state?.attributes.get(name);
        if (!pending) return;

        let groupsByName = attributeGroupsByTarget.get(target);
        if (!groupsByName) {
          groupsByName = new Map();
          attributeGroupsByTarget.set(target, groupsByName);
        }
        let group = groupsByName.get(name);
        if (!group) {
          const currentValue = target.hasAttribute(name) ? target.getAttribute(name) : null;
          group = {
            records: [],
            pending,
            expectedMatches: currentValue === pending.expectedValue,
            consume(count) {
              pending.tokens = consumePendingTokens(pending.tokens, count);
              if (pending.tokens.length === 0) state.attributes.delete(name);
              releaseEmptyState(target, state);
            },
            clear(reason = null) {
              if (reason === 'value_mismatch') diagnostics.valueMismatchCount += group.records.length;
              if (reason === 'excess_records') {
                diagnostics.excessRecordCount += Math.max(
                  0,
                  group.records.length - getActiveTokens(pending.tokens).length,
                );
              }
              clearPendingTokens(pending.tokens);
              state.attributes.delete(name);
              releaseEmptyState(target, state);
            },
          };
          groupsByName.set(name, group);
          groups.push(group);
        }
        group.records.push(mutation);
        return;
      }

      const owner = resolveTextOwner(mutation);
      if (!owner) return;
      const state = getPendingState(owner);
      const pending = state?.text;
      if (!pending) return;
      let group = textGroupsByOwner.get(owner);
      if (!group) {
        group = {
          records: [],
          pending,
          expectedMatches: owner.textContent === pending.expectedText,
          consume(count) {
            pending.tokens = consumePendingTokens(pending.tokens, count);
            if (pending.tokens.length === 0) state.text = null;
            releaseEmptyState(owner, state);
          },
          clear(reason = null) {
            if (reason === 'value_mismatch') diagnostics.valueMismatchCount += group.records.length;
            if (reason === 'excess_records') {
              diagnostics.excessRecordCount += Math.max(
                0,
                group.records.length - getActiveTokens(pending.tokens).length,
              );
            }
            clearPendingTokens(pending.tokens);
            state.text = null;
            releaseEmptyState(owner, state);
          },
        };
        textGroupsByOwner.set(owner, group);
        groups.push(group);
      }
      group.records.push(mutation);
    });

    const consumedMutations = new WeakSet();
    let consumedCount = 0;
    groups.forEach((group) => {
      const observedCount = group.records.length;
      const pendingTokenCount = getActiveTokens(group.pending.tokens).length;
      const canConsume = group.expectedMatches
        && observedCount > 0
        && observedCount <= pendingTokenCount;
      if (!canConsume) {
        group.clear(group.expectedMatches ? 'excess_records' : 'value_mismatch');
        return;
      }
      group.records.forEach((mutation) => consumedMutations.add(mutation));
      group.consume(observedCount);
      consumedCount += observedCount;
    });

    if (consumedCount === 0) return { payload, consumedCount: 0 };
    const retainedMutations = mutations.filter((mutation) => !consumedMutations.has(mutation));
    const filteredPayload = createFilteredPayload(payload, mutations, retainedMutations);
    return {
      payload: hasPayloadWork(filteredPayload) ? filteredPayload : null,
      consumedCount,
    };
  }

  function getPendingSnapshot() {
    const at = readNow();
    expireTokens(at);
    const oldestToken = pendingTokens.find((token) => token.active) || null;
    return Object.freeze({
      pendingCount,
      oldestAgeMs: oldestToken ? Math.max(0, at - oldestToken.recordedAt) : null,
      maxPendingAgeMs: resolvedMaxAge,
      maxDeliveryLag: resolvedMaxDeliveryLag,
      observationEpoch: context.observationEpoch,
      deliverySequence: context.deliverySequence,
      ...diagnostics,
    });
  }

  function setObservationContext(nextContext = {}) {
    const resolved = requireObservationContext(nextContext);
    const documentChanged = resolved.documentRef !== context.documentRef;
    const rootChanged = resolved.observationRoot !== context.observationRoot;
    const epochChanged = resolved.observationEpoch !== context.observationEpoch;
    if (documentChanged || rootChanged || epochChanged) {
      clearAllPending(epochChanged ? 'epochInvalidatedCount' : 'rootInvalidatedCount');
    }
    context = resolved;
    return getPendingSnapshot();
  }

  function reset() {
    clearAllPending();
    diagnostics = createDiagnostics();
  }

  return Object.freeze({
    filterPayload,
    getPendingSnapshot,
    recordMutation,
    reset,
    setObservationContext,
  });
}

export default createOwnedMutationLedger;
