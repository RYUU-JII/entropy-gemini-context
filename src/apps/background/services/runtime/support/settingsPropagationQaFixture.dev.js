import {
  SETTINGS_PROPAGATION_QA_ACTIONS,
  SETTINGS_PROPAGATION_QA_LEASE_CONTRACT,
  SETTINGS_PROPAGATION_QA_LEASE_TTL_MS,
  isSettingsPropagationQaFilterTaskChangedKeys,
  parseSettingsPropagationQaFixtureRequest,
  requireSettingsPropagationQaSeal,
  settingsPropagationQaError,
} from '../../../../../domains/settings/config/settingsPropagationQaFixtureContract.dev.js';
import {
  requireSettingsPropagationContext,
  throwIfSettingsPropagationCancelled,
} from '../../../../../domains/settings/contracts/settingsPropagationContext.js';

const ACTIVE_STATUSES = new Set(['armed', 'holding', 'failing']);

function requireBinding(owner) {
  if (!owner || typeof owner !== 'object'
    || !Number.isSafeInteger(owner.tabId) || owner.tabId < 0
    || typeof owner.documentId !== 'string' || owner.documentId.length > 256
    || !owner.documentId || owner.documentId.trim() !== owner.documentId) {
    throw settingsPropagationQaError('SENDER_BINDING_INVALID');
  }
  return Object.freeze({ ...requireSettingsPropagationQaSeal(owner),
    tabId: owner.tabId, documentId: owner.documentId });
}

function sameBinding(a, b) {
  return ['nonce', 'profileKind', 'runId', 'tabId', 'documentId'].every(key => a[key] === b[key]);
}

function snapshot(lease) {
  return Object.freeze({
    contract: SETTINGS_PROPAGATION_QA_LEASE_CONTRACT,
    leaseId: lease.leaseId,
    mode: lease.mode,
    status: lease.status,
    taskId: lease.taskId,
    commitVersion: lease.commitVersion,
    changedKeys: Object.freeze([...lease.changedKeys]),
    attemptCount: lease.attemptCount,
    armedAt: lease.armedAt,
    expiresAt: lease.expiresAt,
  });
}

export function createSettingsPropagationQaFixture({ broadcastSettingsUpdate }) {
  if (typeof broadcastSettingsUpdate !== 'function') {
    throw settingsPropagationQaError('BROADCAST_OWNER_REQUIRED');
  }
  let lease = null;

  function settle(current, status, error = null) {
    if (!ACTIVE_STATUSES.has(current.status)) return;
    current.status = status;
    clearTimeout(current.expiryTimer);
    for (const [signal, callback] of current.abortListeners) {
      signal.removeEventListener('abort', callback);
    }
    current.abortListeners.clear();
    if (current.hold) {
      const hold = current.hold;
      current.hold = null;
      if (error) hold.reject(error);
      else hold.resolve();
    }
  }

  function requireOwnedLease(payload, owner, action) {
    const request = parseSettingsPropagationQaFixtureRequest({
      action, requestId: 'fixture-owner', payload,
    });
    const binding = requireBinding(owner);
    if (!lease || lease.leaseId !== request.payload.leaseId) {
      throw settingsPropagationQaError('LEASE_UNKNOWN');
    }
    if (!sameBinding(lease.binding, binding)
      || !['nonce', 'profileKind', 'runId'].every(key => payload[key] === binding[key])) {
      throw settingsPropagationQaError('LEASE_FOREIGN');
    }
    return lease;
  }

  const settingsPropagationQaFixture = Object.freeze({
    arm(payload, owner) {
      const request = parseSettingsPropagationQaFixtureRequest({
        action: SETTINGS_PROPAGATION_QA_ACTIONS.ARM, requestId: 'fixture-owner', payload,
      });
      const binding = requireBinding(owner);
      if (!['nonce', 'profileKind', 'runId'].every(key => payload[key] === binding[key])) {
        throw settingsPropagationQaError('LEASE_FOREIGN');
      }
      if (lease && ACTIVE_STATUSES.has(lease.status)) {
        throw settingsPropagationQaError('LEASE_BUSY');
      }
      const armedAt = Date.now();
      const current = {
        leaseId: crypto.randomUUID(), binding,
        mode: request.payload.mode,
        status: 'armed', taskId: null, commitVersion: null, changedKeys: [], attemptCount: 0,
        armedAt, expiresAt: armedAt + SETTINGS_PROPAGATION_QA_LEASE_TTL_MS,
        abortListeners: new Map(), hold: null, expiryTimer: null,
      };
      current.expiryTimer = setTimeout(() => {
        settle(current, 'expired', settingsPropagationQaError('LEASE_EXPIRED'));
      }, SETTINGS_PROPAGATION_QA_LEASE_TTL_MS);
      lease = current;
      return snapshot(current);
    },
    read(payload, owner) {
      return snapshot(requireOwnedLease(payload, owner, SETTINGS_PROPAGATION_QA_ACTIONS.READ));
    },
    release(payload, owner) {
      const current = requireOwnedLease(payload, owner, SETTINGS_PROPAGATION_QA_ACTIONS.RELEASE);
      settle(current, 'released');
      return snapshot(current);
    },
  });

  async function wrappedBroadcastSettingsUpdate(...args) {
    if (!lease || !ACTIVE_STATUSES.has(lease.status)) {
      return broadcastSettingsUpdate(...args);
    }
    const context = requireSettingsPropagationContext(args[0]?.propagationContext);
    if (!context) return broadcastSettingsUpdate(...args);
    const current = lease;
    if (current.taskId !== null
      && (current.taskId !== context.taskId || current.commitVersion !== context.commitVersion)) {
      settle(current, 'superseded', settingsPropagationQaError('TASK_SUPERSEDED'));
      return broadcastSettingsUpdate(...args);
    }
    const keys = args[0]?.changedKeys;
    if (current.taskId === null) {
      if (!isSettingsPropagationQaFilterTaskChangedKeys(keys)) {
        return broadcastSettingsUpdate(...args);
      }
      if (!Number.isSafeInteger(context.commitVersion) || context.commitVersion < 0) {
        throw settingsPropagationQaError('CONTEXT_INVALID');
      }
      current.taskId = context.taskId;
      current.commitVersion = context.commitVersion;
      current.changedKeys = [...keys];
    }
    if (context.signal.aborted) {
      settle(current, 'superseded');
      throwIfSettingsPropagationCancelled(context, 'qa_broadcast_entry');
    }
    const onAbort = () => {
      const error = settingsPropagationQaError('TASK_SUPERSEDED');
      settle(current, 'superseded', error);
    };
    if (!current.abortListeners.has(context.signal)) {
      context.signal.addEventListener('abort', onAbort, { once: true });
      current.abortListeners.set(context.signal, onAbort);
    }
    current.attemptCount += 1;
    if (current.mode === 'fail') {
      current.status = 'failing';
      throw settingsPropagationQaError('INJECTED_FAILURE');
    }
    if (current.hold) throw settingsPropagationQaError('CONCURRENT_EXECUTION');
    current.status = 'holding';
    await new Promise((resolve, reject) => { current.hold = { resolve, reject }; });
    throwIfSettingsPropagationCancelled(context, 'qa_broadcast_release');
    return broadcastSettingsUpdate(...args);
  }

  return { broadcastSettingsUpdate: wrappedBroadcastSettingsUpdate, settingsPropagationQaFixture };
}
