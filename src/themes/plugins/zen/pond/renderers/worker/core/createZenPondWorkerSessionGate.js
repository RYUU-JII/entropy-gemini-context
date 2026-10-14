import {
  ZEN_POND_WORKER_MESSAGE_TYPE,
  ZEN_POND_WORKER_SESSION_FREE_TYPES,
} from './zenPondWorkerProtocol.js';

const isObject = (value) => (
  Boolean(value && typeof value === 'object' && !Array.isArray(value))
);

const resolveSessionMeta = (payload) => (
  isObject(payload?.__session) ? payload.__session : null
);

const resolveSessionKey = (sessionMeta) => (
  typeof sessionMeta?.id === 'string' && sessionMeta.id.trim()
    ? sessionMeta.id.trim()
    : null
);

const resolveSessionSeq = (sessionMeta) => {
  const parsed = Number(sessionMeta?.seq);
  return Number.isFinite(parsed) ? parsed : null;
};

export const createZenPondWorkerSessionGate = ({
  pingType = ZEN_POND_WORKER_MESSAGE_TYPE.PING,
  sessionFreeTypes = ZEN_POND_WORKER_SESSION_FREE_TYPES,
} = {}) => {
  const freeTypeSet = new Set(Array.isArray(sessionFreeTypes) ? sessionFreeTypes : []);
  let activeSessionId = null;
  let lastSessionSeq = -1;

  const reset = () => {
    activeSessionId = null;
    lastSessionSeq = -1;
  };

  const evaluate = ({ type, payload } = {}) => {
    const messageType = typeof type === 'string' ? type : '';
    if (messageType === pingType) {
      return {
        stale: false,
        reason: null,
      };
    }

    if (freeTypeSet.has(messageType)) {
      return {
        stale: false,
        reason: null,
      };
    }

    const sessionMeta = resolveSessionMeta(payload);
    const sessionKey = resolveSessionKey(sessionMeta);
    const sessionSeq = resolveSessionSeq(sessionMeta);

    if (activeSessionId && sessionKey && sessionKey !== activeSessionId) {
      return {
        stale: true,
        reason: 'session_mismatch',
      };
    }

    if (sessionSeq !== null) {
      if (sessionSeq <= lastSessionSeq) {
        return {
          stale: true,
          reason: 'sequence_stale',
        };
      }
      lastSessionSeq = sessionSeq;
    }

    if (!activeSessionId && sessionKey) {
      activeSessionId = sessionKey;
    }

    return {
      stale: false,
      reason: null,
    };
  };

  return Object.freeze({
    evaluate,
    reset,
    getSnapshot: () => ({
      activeSessionId,
      lastSessionSeq,
      freeTypes: Array.from(freeTypeSet),
    }),
  });
};
