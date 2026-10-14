import {
  CEREMONY_IDS,
  normalizeCeremonyId,
} from './ceremonyContracts.js';

export const CEREMONY_REQUEST_EVENT = 'entropy:ceremony-request';

export function buildCeremonyRequest({
  ceremonyId = CEREMONY_IDS.FIRST_VISION_DESCENT,
  seed = Date.now(),
  source = 'unknown',
  metadata = null,
} = {}) {
  const normalizedCeremonyId = normalizeCeremonyId(ceremonyId);
  if (!normalizedCeremonyId) {
    throw new Error('CEREMONY_REQUEST_INVALID_ID');
  }
  return Object.freeze({
    ceremonyId: normalizedCeremonyId,
    seed: Number.isFinite(Number(seed)) ? Number(seed) : Date.now(),
    source: typeof source === 'string' && source.trim() ? source.trim() : 'unknown',
    metadata: metadata && typeof metadata === 'object' ? Object.freeze({ ...metadata }) : null,
  });
}

export function requestCeremony(request = {}) {
  if (typeof window === 'undefined' || typeof window.dispatchEvent !== 'function') {
    return false;
  }
  const detail = buildCeremonyRequest(request);
  window.dispatchEvent(new CustomEvent(CEREMONY_REQUEST_EVENT, { detail }));
  return true;
}
