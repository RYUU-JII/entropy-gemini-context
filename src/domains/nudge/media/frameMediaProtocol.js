// Versioned wire contract shared by the top-document client and background owner.
// The registered classic receiver mirrors this contract without module imports.
export const FRAME_MEDIA_VERSION = 1;
export const FRAME_MEDIA_LEASE_MS = 60_000;
export const FRAME_MEDIA_HEARTBEAT_MS = 15_000;
export const FRAME_MEDIA_MAX_FRAMES = 64;
export const FRAME_MEDIA_MAX_ORIGINS = 32;

// getRandomValues is available to extension content scripts on HTTP documents;
// randomUUID is secure-context-only. Always use this cryptographic UUID owner.
export function createFrameMediaId(cryptoRef = globalThis.crypto) {
  if (typeof cryptoRef?.getRandomValues !== 'function') throw new Error('FRAME_MEDIA_CRYPTO_UNAVAILABLE');
  const bytes = cryptoRef.getRandomValues(new Uint8Array(16));
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = Array.from(bytes, (value) => value.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

export function requireFrameMediaId(value) {
  if (typeof value !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)) {
    throw new Error('FRAME_MEDIA_ID_INVALID');
  }
  return value;
}

export function requireFrameMediaOrigin(value) {
  let parsed;
  try { parsed = new URL(value); } catch { throw new Error('FRAME_MEDIA_ORIGIN_INVALID'); }
  if (!['http:', 'https:'].includes(parsed.protocol) || value !== parsed.origin) {
    throw new Error('FRAME_MEDIA_ORIGIN_INVALID');
  }
  return parsed.origin;
}

export function requireFrameMediaHold(payload) {
  if (!payload || payload.version !== FRAME_MEDIA_VERSION
    || !['begin', 'renew', 'end'].includes(payload.action)
    || typeof payload.resume !== 'boolean'
    || (payload.action !== 'end' && payload.resume)
    || !Array.isArray(payload.frameOrigins) || payload.frameOrigins.length > FRAME_MEDIA_MAX_ORIGINS) {
    throw new Error('FRAME_MEDIA_HOLD_INVALID');
  }
  return { version: FRAME_MEDIA_VERSION, action: payload.action,
    holdId: requireFrameMediaId(payload.holdId), resume: payload.resume,
    frameOrigins: [...new Set(payload.frameOrigins.map(requireFrameMediaOrigin))] };
}

export function requireFrameMediaReady(payload) {
  if (!payload || payload.version !== FRAME_MEDIA_VERSION
    || typeof payload.topReachable !== 'boolean'
    || !Number.isSafeInteger(payload.inventoryRevision) || payload.inventoryRevision < 0
    || payload.capabilities?.pause !== 'supported' || payload.capabilities?.resume !== 'supported'
    || payload.capabilities?.seek !== 'unsupported'
    || !['observed', 'failed'].includes(payload.observation)
    || (payload.observation === 'observed'
      ? !Number.isSafeInteger(payload.observedMediaCount) || payload.observedMediaCount < 0
      : payload.observedMediaCount !== null)) throw new Error('FRAME_MEDIA_READY_INVALID');
  return { version: FRAME_MEDIA_VERSION, instanceId: requireFrameMediaId(payload.instanceId),
    inventoryRevision: payload.inventoryRevision,
    topReachable: payload.topReachable, observation: payload.observation,
    observedMediaCount: payload.observedMediaCount,
    capabilities: { pause: 'supported', resume: 'supported', seek: 'unsupported' } };
}

export function requireFrameMediaResult(result, expected) {
  if (!result || result.version !== FRAME_MEDIA_VERSION
    || result.instanceId !== expected.instanceId || result.documentId !== expected.documentId
    || result.holdId !== expected.holdId || typeof result.accepted !== 'boolean'
    || !['held', 'partial', 'released', 'managed_by_top', 'rejected'].includes(result.status)
    || !(result.observedCount === null || (Number.isSafeInteger(result.observedCount) && result.observedCount >= 0))
    || !(result.errorCode === null || (typeof result.errorCode === 'string' && result.errorCode.length > 0))) {
    throw new Error('FRAME_MEDIA_RESULT_INVALID');
  }
  for (const key of ['attemptedCount', 'pausedCount', 'failedCount', 'resumedCount', 'resumeFailedCount']) {
    if (!Number.isSafeInteger(result[key]) || result[key] < 0) throw new Error('FRAME_MEDIA_RESULT_INVALID');
  }
  if (result.pausedCount > result.attemptedCount || result.failedCount > result.attemptedCount) {
    throw new Error('FRAME_MEDIA_RESULT_INVALID');
  }
  return result;
}

export function requireFrameMediaSupportSnapshot(result, { holdId } = {}) {
  const validError = (value) => value === null || (typeof value === 'string' && value.length > 0);
  const validCount = (value) => Number.isSafeInteger(value) && value >= 0;
  if (!result || result.version !== FRAME_MEDIA_VERSION
    || !['pending', 'applied', 'partial', 'released', 'unavailable'].includes(result.status)
    || !['known_frames', 'unknown'].includes(result.coverage)
    || !Array.isArray(result.frames) || result.frames.length > FRAME_MEDIA_MAX_FRAMES
    || !Array.isArray(result.requiredOrigins) || result.requiredOrigins.length > FRAME_MEDIA_MAX_ORIGINS
    || !validError(result.errorCode) || !validCount(result.activeHolds)
    || (holdId !== undefined && result.holdId !== holdId)) {
    throw new Error('FRAME_MEDIA_HOLD_RESULT_INVALID');
  }
  if (result.holdId !== null) requireFrameMediaId(result.holdId);
  const seenFrames = new Set();
  const frames = result.frames.map((frame) => {
    if (!Number.isInteger(frame?.frameId) || frame.frameId <= 0 || seenFrames.has(frame.frameId)
      || !(frame.documentId === null || (typeof frame.documentId === 'string' && frame.documentId.length > 0))
      || !['ready', 'held', 'partial', 'released', 'managed_by_top', 'receiver_unavailable', 'permission_required', 'failed'].includes(frame.status)
      || !['supported', 'unavailable'].includes(frame.pause) || !['supported', 'unavailable'].includes(frame.resume)
      || frame.seek !== 'unsupported' || typeof frame.commandAccepted !== 'boolean' || typeof frame.verifiedPaused !== 'boolean'
      || (frame.verifiedPaused && !frame.commandAccepted) || !validError(frame.errorCode)
      || !(frame.observedCount === null || validCount(frame.observedCount))) {
      throw new Error('FRAME_MEDIA_HOLD_FRAME_RESULT_INVALID');
    }
    for (const key of ['attemptedCount', 'pausedCount', 'failedCount', 'resumedCount', 'resumeFailedCount']) {
      if (!validCount(frame[key])) throw new Error('FRAME_MEDIA_HOLD_FRAME_RESULT_INVALID');
    }
    if (frame.pausedCount > frame.attemptedCount || frame.failedCount > frame.attemptedCount) {
      throw new Error('FRAME_MEDIA_HOLD_FRAME_RESULT_INVALID');
    }
    seenFrames.add(frame.frameId);
    return {
      frameId: frame.frameId, documentId: frame.documentId, status: frame.status,
      pause: frame.pause, resume: frame.resume, seek: frame.seek,
      commandAccepted: frame.commandAccepted, verifiedPaused: frame.verifiedPaused, errorCode: frame.errorCode,
      observedCount: frame.observedCount, attemptedCount: frame.attemptedCount, pausedCount: frame.pausedCount,
      failedCount: frame.failedCount, resumedCount: frame.resumedCount, resumeFailedCount: frame.resumeFailedCount,
    };
  });
  return {
    version: FRAME_MEDIA_VERSION, holdId: result.holdId, status: result.status, coverage: result.coverage,
    activeHolds: result.activeHolds, frames,
    requiredOrigins: [...new Set(result.requiredOrigins.map(requireFrameMediaOrigin))], errorCode: result.errorCode,
  };
}
