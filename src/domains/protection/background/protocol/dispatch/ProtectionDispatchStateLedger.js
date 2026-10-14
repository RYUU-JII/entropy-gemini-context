import { isKnownDomainClassId } from '../../../protocol/scope/classCatalog.js';

export function createProtectionDispatchStateLedger() {
  const lastProtectionPayloadByTab = new Map();
  const lastProtectionContextByTab = new Map();
  const lastEnvelopeRevisionByTab = new Map();
  const lastEnvelopeStateByTab = new Map();
  const receiverEnvelopeRevisionFloorByTab = new Map();

  function isPlainObject(value) {
    return value !== null && typeof value === 'object' && !Array.isArray(value);
  }

  function requireTabId(tabId) {
    if (!Number.isInteger(tabId) || tabId < 0) {
      throw new Error('PROTECTION_DISPATCH_LEDGER_TAB_ID_INVALID');
    }
    return tabId;
  }

  function requireSignature(signature) {
    if (typeof signature !== 'string' || !signature.trim()) {
      throw new Error('PROTECTION_DISPATCH_LEDGER_SIGNATURE_INVALID');
    }
    return signature;
  }

  function requireEnvelopeRevision(value, errorCode) {
    if (!Number.isSafeInteger(value) || value < 0) {
      throw new Error(errorCode);
    }
    return value;
  }

  function requireEnvelopeState(state, revision) {
    if (!isPlainObject(state)) {
      throw new Error('PROTECTION_DISPATCH_LEDGER_ENVELOPE_STATE_INVALID');
    }
    if (
      requireEnvelopeRevision(
        state.revision,
        'PROTECTION_DISPATCH_LEDGER_ENVELOPE_STATE_REVISION_INVALID',
      ) !== revision
    ) {
      throw new Error('PROTECTION_DISPATCH_LEDGER_ENVELOPE_STATE_REVISION_MISMATCH');
    }
    if (typeof state.hostname !== 'string' || !state.hostname.trim()) {
      throw new Error('PROTECTION_DISPATCH_LEDGER_ENVELOPE_STATE_HOSTNAME_INVALID');
    }
    if (!isKnownDomainClassId(state.domainClassId)) {
      throw new Error('PROTECTION_DISPATCH_LEDGER_ENVELOPE_STATE_DOMAIN_CLASS_INVALID');
    }
    if (!isPlainObject(state.activation) || !isPlainObject(state.activation.features)) {
      throw new Error('PROTECTION_DISPATCH_LEDGER_ENVELOPE_STATE_ACTIVATION_INVALID');
    }
    if (!isPlainObject(state.compiledFeatures)) {
      throw new Error('PROTECTION_DISPATCH_LEDGER_ENVELOPE_STATE_COMPILED_INVALID');
    }
    if (!isPlainObject(state.featureHashes)) {
      throw new Error('PROTECTION_DISPATCH_LEDGER_ENVELOPE_STATE_HASHES_INVALID');
    }
    return state;
  }

  function requireEnvelopeResult(envelopeResult) {
    if (!isPlainObject(envelopeResult)) {
      throw new Error('PROTECTION_DISPATCH_LEDGER_ENVELOPE_RESULT_INVALID');
    }
    const revision = requireEnvelopeRevision(
      envelopeResult.revision,
      'PROTECTION_DISPATCH_LEDGER_ENVELOPE_REVISION_INVALID',
    );
    return {
      ...envelopeResult,
      state: requireEnvelopeState(envelopeResult.state, revision),
    };
  }

  function requireProtectionContext(context) {
    if (!isPlainObject(context)) {
      throw new Error('PROTECTION_DISPATCH_LEDGER_CONTEXT_INVALID');
    }
    if (typeof context.hostname !== 'string' || !context.hostname.trim()) {
      throw new Error('PROTECTION_DISPATCH_LEDGER_CONTEXT_HOSTNAME_INVALID');
    }
    if (typeof context.isBlockedDomain !== 'boolean') {
      throw new Error('PROTECTION_DISPATCH_LEDGER_CONTEXT_BLOCKED_FLAG_INVALID');
    }
    return {
      hostname: context.hostname.trim().toLowerCase(),
      isBlockedDomain: context.isBlockedDomain,
    };
  }

  function resetTab(tabId) {
    const key = requireTabId(tabId);
    lastProtectionPayloadByTab.delete(key);
    lastProtectionContextByTab.delete(key);
    lastEnvelopeRevisionByTab.delete(key);
    lastEnvelopeStateByTab.delete(key);
    receiverEnvelopeRevisionFloorByTab.delete(key);
  }

  function resetDispatchAttempt(tabId) {
    const key = requireTabId(tabId);
    const knownReceiverRevision = [
      lastEnvelopeRevisionByTab.get(key),
      receiverEnvelopeRevisionFloorByTab.get(key),
    ].reduce((highest, revision) => (
      Number.isSafeInteger(revision) && revision >= 0
        ? Math.max(highest, revision)
        : highest
    ), 0);
    lastProtectionPayloadByTab.delete(key);
    lastProtectionContextByTab.delete(key);
    lastEnvelopeRevisionByTab.delete(key);
    lastEnvelopeStateByTab.delete(key);
    receiverEnvelopeRevisionFloorByTab.set(key, knownReceiverRevision);
  }

  function noteReceiverEnvelopeRevisionFloor(tabId, revision) {
    const key = requireTabId(tabId);
    const resolvedRevision = requireEnvelopeRevision(
      revision,
      'PROTECTION_DISPATCH_LEDGER_RECEIVER_REVISION_INVALID',
    );
    const previousFloor = receiverEnvelopeRevisionFloorByTab.has(key)
      ? receiverEnvelopeRevisionFloorByTab.get(key)
      : 0;
    receiverEnvelopeRevisionFloorByTab.set(key, Math.max(previousFloor, resolvedRevision));
  }

  function getPreviousEnvelopeInput(tabId, { forceSnapshot = false } = {}) {
    const key = requireTabId(tabId);
    const receiverRevisionFloor = receiverEnvelopeRevisionFloorByTab.has(key)
      ? receiverEnvelopeRevisionFloorByTab.get(key)
      : 0;
    if (forceSnapshot) {
      return {
        previousEnvelopeState: null,
        previousRevision: receiverRevisionFloor,
      };
    }
    const hasPreviousState = lastEnvelopeStateByTab.has(key);
    const hasPreviousRevision = lastEnvelopeRevisionByTab.has(key);
    if (!hasPreviousState && !hasPreviousRevision) {
      return {
        previousEnvelopeState: null,
        previousRevision: receiverRevisionFloor,
      };
    }
    if (!hasPreviousState || !hasPreviousRevision) {
      throw new Error('PROTECTION_DISPATCH_LEDGER_PREVIOUS_ENVELOPE_INCOMPLETE');
    }
    return {
      previousEnvelopeState: lastEnvelopeStateByTab.get(key),
      previousRevision: lastEnvelopeRevisionByTab.get(key),
    };
  }

  function rememberContext(tabId, context) {
    lastProtectionContextByTab.set(requireTabId(tabId), requireProtectionContext(context));
  }

  function hasMatchingSignature(tabId, signature) {
    return lastProtectionPayloadByTab.get(requireTabId(tabId)) === requireSignature(signature);
  }

  function commitDispatchSuccess(tabId, {
    signature,
    envelopeResult,
  } = {}) {
    const key = requireTabId(tabId);
    const resolvedSignature = requireSignature(signature);
    const resolvedEnvelopeResult = requireEnvelopeResult(envelopeResult);
    lastProtectionPayloadByTab.set(key, resolvedSignature);
    lastEnvelopeRevisionByTab.set(key, resolvedEnvelopeResult.revision);
    lastEnvelopeStateByTab.set(key, resolvedEnvelopeResult.state);
    receiverEnvelopeRevisionFloorByTab.delete(key);
  }

  function getLastProtectionContextByTab() {
    return {
      get: (tabId) => lastProtectionContextByTab.get(requireTabId(tabId)),
    };
  }

  return {
    commitDispatchSuccess,
    getLastProtectionContextByTab,
    getPreviousEnvelopeInput,
    hasMatchingSignature,
    noteReceiverEnvelopeRevisionFloor,
    rememberContext,
    resetDispatchAttempt,
    resetTab,
  };
}
