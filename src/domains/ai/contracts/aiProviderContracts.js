export const AI_PROVIDER_IDS = Object.freeze({
  CHROME_BUILT_IN_LANGUAGE_MODEL: 'chrome-built-in-language-model',
});

export const AI_AVAILABILITY_STATES = Object.freeze({
  AVAILABLE: 'available',
  DOWNLOADABLE: 'downloadable',
  DOWNLOADING: 'downloading',
  UNAVAILABLE: 'unavailable',
  DISABLED: 'disabled',
  ERROR: 'error',
});

const AI_AVAILABILITY_STATE_SET = new Set(Object.values(AI_AVAILABILITY_STATES));

export function normalizeAiAvailabilityState(value) {
  const normalized = typeof value === 'string' ? value.trim().toLowerCase() : '';
  return AI_AVAILABILITY_STATE_SET.has(normalized)
    ? normalized
    : AI_AVAILABILITY_STATES.ERROR;
}

export function createAiAvailability({
  providerId,
  state,
  reasonCode = '',
  details = null,
  canCreateSession = false,
  requiresUserActivation = false,
} = {}) {
  const normalizedState = normalizeAiAvailabilityState(state);
  return Object.freeze({
    providerId: providerId || '',
    state: normalizedState,
    reasonCode: typeof reasonCode === 'string' ? reasonCode : '',
    details: details && typeof details === 'object' ? Object.freeze({ ...details }) : null,
    canCreateSession: Boolean(canCreateSession),
    requiresUserActivation: Boolean(requiresUserActivation),
  });
}

export function isAiProviderUsable(availability) {
  return isAiProviderUsableForPreparation(availability);
}

export function isAiProviderReadyForGeneration(availability) {
  const state = normalizeAiAvailabilityState(availability?.state);
  return state === AI_AVAILABILITY_STATES.AVAILABLE;
}

export function isAiProviderUsableForPreparation(availability) {
  const state = normalizeAiAvailabilityState(availability?.state);
  return state === AI_AVAILABILITY_STATES.AVAILABLE
    || state === AI_AVAILABILITY_STATES.DOWNLOADABLE
    || state === AI_AVAILABILITY_STATES.DOWNLOADING;
}
