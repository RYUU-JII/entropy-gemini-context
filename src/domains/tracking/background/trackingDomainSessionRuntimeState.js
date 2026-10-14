import {
  TRACKING_DOMAIN_SESSION_PHASES,
  createActiveDomainSessionCursor,
  createPendingDomainSessionCommit,
  requireDomainSessionStoreReadResult,
  requireStoredDomainSession,
} from './trackingDomainSessionCheckpoint.js';

function requireDurationOwner(onDuration) {
  if (typeof onDuration !== 'function') {
    const error = new Error('TRACKING_DOMAIN_SESSION_DURATION_OWNER_REQUIRED');
    error.code = 'TRACKING_DOMAIN_SESSION_DURATION_OWNER_REQUIRED';
    throw error;
  }
  return onDuration;
}

function requireSessionStore(sessionStore) {
  if (
    !sessionStore
    || typeof sessionStore.readOptional !== 'function'
    || typeof sessionStore.set !== 'function'
    || typeof sessionStore.remove !== 'function'
  ) {
    throw new Error('TRACKING_DOMAIN_SESSION_STATE_SESSION_STORE_REQUIRED');
  }
  return sessionStore;
}

function requireSessionKey(sessionDomainSessionKey) {
  if (typeof sessionDomainSessionKey !== 'string' || !sessionDomainSessionKey.trim()) {
    throw new Error('TRACKING_DOMAIN_SESSION_STATE_KEY_REQUIRED');
  }
  return sessionDomainSessionKey;
}

function createDefaultSessionId() {
  const randomUUID = globalThis.crypto?.randomUUID;
  if (typeof randomUUID !== 'function') {
    throw new Error('TRACKING_DOMAIN_SESSION_ID_FACTORY_REQUIRED');
  }
  return `tracking-domain-session:${randomUUID.call(globalThis.crypto)}`;
}

function requireSessionIdFactory(createSessionId) {
  if (typeof createSessionId !== 'function') {
    throw new Error('TRACKING_DOMAIN_SESSION_ID_FACTORY_REQUIRED');
  }
  return createSessionId;
}

function requireProfileMutationAdmissionOwner(owner) {
  if (
    !owner
    || typeof owner.assertDrainingOrQuiesced !== 'function'
    || typeof owner.assertOpen !== 'function'
    || typeof owner.assertQuiesced !== 'function'
  ) {
    throw new Error('TRACKING_DOMAIN_SESSION_PROFILE_MUTATION_ADMISSION_OWNER_REQUIRED');
  }
  return owner;
}

function cloneCursor(cursor) {
  return cursor ? { ...cursor } : null;
}

export function createTrackingDomainSessionRuntimeState({
  sessionStore,
  sessionDomainSessionKey,
  createSessionId = createDefaultSessionId,
  profileMutationAdmissionOwner,
} = {}) {
  const resolvedSessionStore = requireSessionStore(sessionStore);
  const resolvedSessionDomainSessionKey = requireSessionKey(sessionDomainSessionKey);
  const resolvedCreateSessionId = requireSessionIdFactory(createSessionId);
  const profileMutationAdmission = requireProfileMutationAdmissionOwner(
    profileMutationAdmissionOwner,
  );
  let currentCursor = null;
  let checkpointMutationTail = Promise.resolve();

  function enqueueCheckpointMutation(task) {
    profileMutationAdmission.assertOpen();
    const operation = checkpointMutationTail.then(task, task);
    checkpointMutationTail = operation.catch(() => undefined);
    return operation;
  }

  async function persistCursor(cursor) {
    const snapshot = requireStoredDomainSession(cursor);
    await resolvedSessionStore.set({
      [resolvedSessionDomainSessionKey]: snapshot,
    });
    currentCursor = snapshot;
    return cloneCursor(snapshot);
  }

  async function clearCursor(expectedSessionId = null) {
    if (
      expectedSessionId !== null
      && currentCursor
      && currentCursor.sessionId !== expectedSessionId
    ) {
      const error = new Error('TRACKING_DOMAIN_SESSION_CURSOR_OWNERSHIP_CHANGED');
      error.code = 'TRACKING_DOMAIN_SESSION_CURSOR_OWNERSHIP_CHANGED';
      throw error;
    }
    await resolvedSessionStore.remove(resolvedSessionDomainSessionKey);
    if (expectedSessionId === null || currentCursor?.sessionId === expectedSessionId) {
      currentCursor = null;
    }
  }

  function init() {
    return enqueueCheckpointMutation(async () => {
      const readResult = requireDomainSessionStoreReadResult(
        await resolvedSessionStore.readOptional(resolvedSessionDomainSessionKey),
      );
      currentCursor = readResult.found
        ? requireStoredDomainSession(readResult.value)
        : null;
      return cloneCursor(currentCursor);
    });
  }

  function getSessionCursor() {
    profileMutationAdmission.assertOpen();
    return cloneCursor(currentCursor);
  }

  const assertCursorOwnership = (expectedSessionId) => {
    if (expectedSessionId === undefined) return;
    const actualSessionId = currentCursor?.sessionId ?? null;
    if (actualSessionId !== expectedSessionId) {
      const error = new Error('TRACKING_DOMAIN_SESSION_CURSOR_OWNERSHIP_CHANGED');
      error.code = 'TRACKING_DOMAIN_SESSION_CURSOR_OWNERSHIP_CHANGED';
      throw error;
    }
  };

  function hasPendingCommit() {
    profileMutationAdmission.assertOpen();
    return currentCursor?.phase === TRACKING_DOMAIN_SESSION_PHASES.PENDING_COMMIT;
  }

  function startActiveSession(hostname, now) {
    return enqueueCheckpointMutation(async () => {
      if (
        currentCursor?.phase === TRACKING_DOMAIN_SESSION_PHASES.ACTIVE
        && currentCursor.hostname === hostname
      ) {
        return cloneCursor(currentCursor);
      }
      if (currentCursor?.phase === TRACKING_DOMAIN_SESSION_PHASES.PENDING_COMMIT) {
        const error = new Error('TRACKING_DOMAIN_SESSION_COMMIT_PENDING');
        error.code = 'TRACKING_DOMAIN_SESSION_COMMIT_PENDING';
        throw error;
      }
      if (currentCursor) {
        const error = new Error('TRACKING_DOMAIN_SESSION_REPLACEMENT_REQUIRES_FINALIZE');
        error.code = 'TRACKING_DOMAIN_SESSION_REPLACEMENT_REQUIRES_FINALIZE';
        throw error;
      }
      const cursor = createActiveDomainSessionCursor({
        sessionId: resolvedCreateSessionId(),
        hostname,
        startedAt: now,
      });
      return persistCursor(cursor);
    });
  }

  function abandonActiveSession(expectedSessionId = undefined) {
    return enqueueCheckpointMutation(async () => {
      assertCursorOwnership(expectedSessionId);
      if (!currentCursor) return false;
      if (currentCursor.phase === TRACKING_DOMAIN_SESSION_PHASES.PENDING_COMMIT) {
        const error = new Error('TRACKING_DOMAIN_SESSION_COMMIT_PENDING');
        error.code = 'TRACKING_DOMAIN_SESSION_COMMIT_PENDING';
        throw error;
      }
      await clearCursor(expectedSessionId === undefined ? currentCursor.sessionId : expectedSessionId);
      return true;
    });
  }

  async function commitPendingCursor(pendingCursor, onDuration) {
    const recordDuration = requireDurationOwner(onDuration);
    await recordDuration(cloneCursor(pendingCursor));
    await clearCursor(pendingCursor.sessionId);
    return cloneCursor(pendingCursor);
  }

  function finalizeActiveSession(now, {
    targetDateStr,
    onDuration,
    expectedSessionId = undefined,
  } = {}) {
    return enqueueCheckpointMutation(async () => {
      assertCursorOwnership(expectedSessionId);
      if (!currentCursor) return null;
      if (currentCursor.phase === TRACKING_DOMAIN_SESSION_PHASES.PENDING_COMMIT) {
        return commitPendingCursor(currentCursor, onDuration);
      }

      const endedAt = Number(now);
      if (!Number.isSafeInteger(endedAt) || endedAt < 0) {
        const error = new Error('TRACKING_DOMAIN_SESSION_END_REQUIRED');
        error.code = 'TRACKING_DOMAIN_SESSION_END_REQUIRED';
        throw error;
      }
      if (endedAt <= currentCursor.startedAt) {
        await clearCursor(currentCursor.sessionId);
        return null;
      }

      requireDurationOwner(onDuration);
      const pendingCursor = createPendingDomainSessionCommit(currentCursor, {
        endedAt,
        targetDateStr,
      });
      await persistCursor(pendingCursor);
      return commitPendingCursor(pendingCursor, onDuration);
    });
  }

  function replayPendingSessionCommit({
    onDuration,
    expectedSessionId = undefined,
  } = {}) {
    return enqueueCheckpointMutation(async () => {
      assertCursorOwnership(expectedSessionId);
      if (!currentCursor) return null;
      if (currentCursor.phase !== TRACKING_DOMAIN_SESSION_PHASES.PENDING_COMMIT) {
        return null;
      }
      return commitPendingCursor(currentCursor, onDuration);
    });
  }

  function resetState(expectedSessionId = null) {
    return enqueueCheckpointMutation(async () => {
      await clearCursor(expectedSessionId);
    });
  }

  const drainForProfileMutation = async () => {
    profileMutationAdmission.assertDrainingOrQuiesced();
    while (true) {
      const observedTail = checkpointMutationTail;
      await observedTail;
      if (observedTail === checkpointMutationTail) return;
    }
  };

  const resetForTerminalProfileMutation = async () => {
    profileMutationAdmission.assertQuiesced();
    await drainForProfileMutation();
    currentCursor = null;
  };

  return {
    abandonActiveSession,
    drainForProfileMutation,
    finalizeActiveSession,
    getSessionCursor,
    hasPendingCommit,
    init,
    replayPendingSessionCommit,
    resetForTerminalProfileMutation,
    resetState,
    startActiveSession,
  };
}
