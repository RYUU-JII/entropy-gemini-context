import { NUDGE_FRAME_HOST_CAPABILITY_CONTRACT } from '../NudgeExtensionFrameWorkerProbeProtocol.js';

const DEFAULT_CAPABILITY_TTL_MS = 10_000;
const MAX_PENDING_CAPABILITIES = 128;
const MAX_BOUNDARY_VALUE_LENGTH = 180;

function createCapabilityError(code) {
  const error = new Error(code);
  error.code = code;
  return error;
}

function requireBoundaryValue(value, code) {
  if (
    typeof value !== 'string'
    || !value.trim()
    || value.length > MAX_BOUNDARY_VALUE_LENGTH
    || value.trim() !== value
  ) {
    throw createCapabilityError(code);
  }
  return value;
}

function requireTabId(value, code) {
  const tabId = Number(value);
  if (!Number.isInteger(tabId) || tabId < 0) {
    throw createCapabilityError(code);
  }
  return tabId;
}

function createSecureCapabilityToken(cryptoRef) {
  if (typeof cryptoRef?.getRandomValues !== 'function') {
    throw createCapabilityError('NUDGE_FRAME_HOST_CAPABILITY_SECURE_RANDOM_REQUIRED');
  }
  const words = new Uint32Array(8);
  cryptoRef.getRandomValues(words);
  const token = Array.from(words, (word) => word.toString(16).padStart(8, '0')).join('');
  if (!/^[a-f0-9]{64}$/u.test(token)) {
    throw createCapabilityError('NUDGE_FRAME_HOST_CAPABILITY_TOKEN_INVALID');
  }
  return token;
}

function resolveNow(now) {
  const value = Number(now());
  if (!Number.isFinite(value) || value < 0) {
    throw createCapabilityError('NUDGE_FRAME_HOST_CAPABILITY_CLOCK_INVALID');
  }
  return value;
}

export function createNudgeFrameHostCapabilityBroker({
  now = Date.now,
  cryptoRef = globalThis.crypto,
  ttlMs = DEFAULT_CAPABILITY_TTL_MS,
} = {}) {
  if (typeof now !== 'function') {
    throw createCapabilityError('NUDGE_FRAME_HOST_CAPABILITY_CLOCK_REQUIRED');
  }
  const resolvedTtlMs = Number(ttlMs);
  if (!Number.isFinite(resolvedTtlMs) || resolvedTtlMs <= 0) {
    throw createCapabilityError('NUDGE_FRAME_HOST_CAPABILITY_TTL_INVALID');
  }

  const pendingByToken = new Map();
  const tokenBySessionId = new Map();

  function removeToken(token) {
    const entry = pendingByToken.get(token);
    pendingByToken.delete(token);
    if (entry && tokenBySessionId.get(entry.sessionId) === token) {
      tokenBySessionId.delete(entry.sessionId);
    }
  }

  function pruneExpired(atMs = resolveNow(now)) {
    for (const [token, entry] of pendingByToken.entries()) {
      if (entry.expiresAtMs <= atMs) removeToken(token);
    }
  }

  function issue({ sessionId, nonce, tabId } = {}) {
    const issuedAtMs = resolveNow(now);
    pruneExpired(issuedAtMs);
    const resolvedSessionId = requireBoundaryValue(
      sessionId,
      'NUDGE_FRAME_HOST_CAPABILITY_SESSION_REQUIRED',
    );
    const resolvedNonce = requireBoundaryValue(
      nonce,
      'NUDGE_FRAME_HOST_CAPABILITY_NONCE_REQUIRED',
    );
    const resolvedTabId = requireTabId(tabId, 'NUDGE_FRAME_HOST_CAPABILITY_TAB_REQUIRED');
    const existingToken = tokenBySessionId.get(resolvedSessionId);
    if (existingToken) removeToken(existingToken);
    if (pendingByToken.size >= MAX_PENDING_CAPABILITIES) {
      throw createCapabilityError('NUDGE_FRAME_HOST_CAPABILITY_CAPACITY_EXCEEDED');
    }

    const capability = createSecureCapabilityToken(cryptoRef);
    if (pendingByToken.has(capability)) {
      throw createCapabilityError('NUDGE_FRAME_HOST_CAPABILITY_COLLISION');
    }
    const expiresAtMs = issuedAtMs + resolvedTtlMs;
    pendingByToken.set(capability, Object.freeze({
      contract: NUDGE_FRAME_HOST_CAPABILITY_CONTRACT,
      sessionId: resolvedSessionId,
      nonce: resolvedNonce,
      tabId: resolvedTabId,
      issuedAtMs,
      expiresAtMs,
    }));
    tokenBySessionId.set(resolvedSessionId, capability);

    return Object.freeze({
      contract: NUDGE_FRAME_HOST_CAPABILITY_CONTRACT,
      sessionId: resolvedSessionId,
      capability,
      expiresAtMs,
    });
  }

  function consume({ sessionId, nonce, capability, tabId } = {}) {
    const consumedAtMs = resolveNow(now);
    pruneExpired(consumedAtMs);
    const resolvedSessionId = requireBoundaryValue(
      sessionId,
      'NUDGE_FRAME_HOST_CAPABILITY_SESSION_REQUIRED',
    );
    const resolvedNonce = requireBoundaryValue(
      nonce,
      'NUDGE_FRAME_HOST_CAPABILITY_NONCE_REQUIRED',
    );
    const resolvedCapability = requireBoundaryValue(
      capability,
      'NUDGE_FRAME_HOST_CAPABILITY_TOKEN_REQUIRED',
    );
    const resolvedTabId = requireTabId(tabId, 'NUDGE_FRAME_HOST_CAPABILITY_TAB_REQUIRED');
    const entry = pendingByToken.get(resolvedCapability);
    if (!entry) {
      throw createCapabilityError('NUDGE_FRAME_HOST_CAPABILITY_NOT_FOUND');
    }
    if (
      entry.sessionId !== resolvedSessionId
      || entry.nonce !== resolvedNonce
      || entry.tabId !== resolvedTabId
    ) {
      throw createCapabilityError('NUDGE_FRAME_HOST_CAPABILITY_BINDING_MISMATCH');
    }

    removeToken(resolvedCapability);
    return Object.freeze({
      contract: NUDGE_FRAME_HOST_CAPABILITY_CONTRACT,
      sessionId: resolvedSessionId,
      authorized: true,
      consumedAtMs,
    });
  }

  return Object.freeze({
    issue,
    consume,
    getPendingCount: () => pendingByToken.size,
  });
}
