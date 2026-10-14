import { getLocalDateStr } from '../../../lib/index.js';
import { TRACKING_DOMAIN_SESSION_PHASES } from './trackingDomainSessionCheckpoint.js';

function requireOwner(owner, methodName, errorCode) {
  if (!owner || typeof owner[methodName] !== 'function') throw new Error(errorCode);
  return owner;
}

export function createTrackingDomainSessionCollectionAdmission({
  settingsService,
  domainSessionRuntimeState,
  shouldTrackHostname,
  recordSessionDuration,
} = {}) {
  requireOwner(
    settingsService,
    'ensureSettingsCache',
    'TRACKING_DOMAIN_SESSION_COLLECTION_SETTINGS_OWNER_REQUIRED',
  );
  requireOwner(
    settingsService,
    'getSettingsCache',
    'TRACKING_DOMAIN_SESSION_COLLECTION_SETTINGS_OWNER_REQUIRED',
  );
  requireOwner(
    domainSessionRuntimeState,
    'getSessionCursor',
    'TRACKING_DOMAIN_SESSION_COLLECTION_RUNTIME_OWNER_REQUIRED',
  );
  requireOwner(
    domainSessionRuntimeState,
    'abandonActiveSession',
    'TRACKING_DOMAIN_SESSION_COLLECTION_RUNTIME_OWNER_REQUIRED',
  );
  requireOwner(
    domainSessionRuntimeState,
    'resetState',
    'TRACKING_DOMAIN_SESSION_COLLECTION_RUNTIME_OWNER_REQUIRED',
  );
  requireOwner(
    domainSessionRuntimeState,
    'finalizeActiveSession',
    'TRACKING_DOMAIN_SESSION_COLLECTION_RUNTIME_OWNER_REQUIRED',
  );
  requireOwner(
    domainSessionRuntimeState,
    'replayPendingSessionCommit',
    'TRACKING_DOMAIN_SESSION_COLLECTION_RUNTIME_OWNER_REQUIRED',
  );
  if (typeof shouldTrackHostname !== 'function') {
    throw new Error('TRACKING_DOMAIN_SESSION_COLLECTION_POLICY_OWNER_REQUIRED');
  }
  if (typeof recordSessionDuration !== 'function') {
    throw new Error('TRACKING_DOMAIN_SESSION_COLLECTION_DURATION_OWNER_REQUIRED');
  }

  async function discardSessionIfCollectionPolicyRejects() {
    const sessionCursor = domainSessionRuntimeState.getSessionCursor();
    if (!sessionCursor?.hostname) return { sessionCursor, rejection: null };

    await settingsService.ensureSettingsCache();
    const settingsCache = settingsService.getSettingsCache();
    if (shouldTrackHostname(sessionCursor.hostname, settingsCache)) {
      return { sessionCursor, rejection: null };
    }

    if (sessionCursor.phase === TRACKING_DOMAIN_SESSION_PHASES.PENDING_COMMIT) {
      await domainSessionRuntimeState.resetState(sessionCursor.sessionId);
    } else {
      await domainSessionRuntimeState.abandonActiveSession(sessionCursor.sessionId);
    }
    return {
      sessionCursor,
      rejection: {
        discarded: true,
        reason: 'collection_policy_rejected',
        sessionId: sessionCursor.sessionId,
      },
    };
  }

  async function finalizeActiveSession(now, { skipCacheLoad = false, dateStr = null } = {}) {
    const collectionAdmission = await discardSessionIfCollectionPolicyRejects();
    if (collectionAdmission.rejection) return collectionAdmission.rejection;

    const endedAt = Number(now);
    const targetDateStr = typeof dateStr === 'string' && dateStr
      ? dateStr
      : getLocalDateStr(Math.max(0, endedAt - 1));
    await domainSessionRuntimeState.finalizeActiveSession(now, {
      expectedSessionId: collectionAdmission.sessionCursor?.sessionId ?? null,
      targetDateStr,
      onDuration: (sessionCommit) => recordSessionDuration(sessionCommit, { skipCacheLoad }),
    });
    return undefined;
  }

  async function replayPendingSessionCommit({ skipCacheLoad = false } = {}) {
    const collectionAdmission = await discardSessionIfCollectionPolicyRejects();
    if (collectionAdmission.rejection) return collectionAdmission.rejection;

    return domainSessionRuntimeState.replayPendingSessionCommit({
      expectedSessionId: collectionAdmission.sessionCursor?.sessionId ?? null,
      onDuration: (sessionCommit) => recordSessionDuration(sessionCommit, { skipCacheLoad }),
    });
  }

  return {
    finalizeActiveSession,
    replayPendingSessionCommit,
  };
}
