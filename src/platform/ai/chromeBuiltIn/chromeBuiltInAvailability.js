import {
  AI_AVAILABILITY_STATES,
  AI_PROVIDER_IDS,
  createAiAvailability,
} from '@/domains/ai/index.js';

export const CHROME_BUILT_IN_RAW_AVAILABILITY = Object.freeze({
  AVAILABLE: 'available',
  DOWNLOADABLE: 'downloadable',
  DOWNLOADING: 'downloading',
  UNAVAILABLE: 'unavailable',
});

export function normalizeChromeBuiltInAvailability(rawAvailability) {
  const raw = typeof rawAvailability === 'string' ? rawAvailability.trim().toLowerCase() : '';
  if (raw === CHROME_BUILT_IN_RAW_AVAILABILITY.AVAILABLE) {
    return createAiAvailability({
      providerId: AI_PROVIDER_IDS.CHROME_BUILT_IN_LANGUAGE_MODEL,
      state: AI_AVAILABILITY_STATES.AVAILABLE,
      reasonCode: 'ready',
      canCreateSession: true,
      requiresUserActivation: false,
    });
  }
  if (raw === CHROME_BUILT_IN_RAW_AVAILABILITY.DOWNLOADABLE) {
    return createAiAvailability({
      providerId: AI_PROVIDER_IDS.CHROME_BUILT_IN_LANGUAGE_MODEL,
      state: AI_AVAILABILITY_STATES.DOWNLOADABLE,
      reasonCode: 'model_download_required',
      canCreateSession: true,
      requiresUserActivation: true,
    });
  }
  if (raw === CHROME_BUILT_IN_RAW_AVAILABILITY.DOWNLOADING) {
    return createAiAvailability({
      providerId: AI_PROVIDER_IDS.CHROME_BUILT_IN_LANGUAGE_MODEL,
      state: AI_AVAILABILITY_STATES.DOWNLOADING,
      reasonCode: 'model_download_in_progress',
      canCreateSession: true,
      requiresUserActivation: true,
    });
  }
  if (raw === CHROME_BUILT_IN_RAW_AVAILABILITY.UNAVAILABLE) {
    return createAiAvailability({
      providerId: AI_PROVIDER_IDS.CHROME_BUILT_IN_LANGUAGE_MODEL,
      state: AI_AVAILABILITY_STATES.UNAVAILABLE,
      reasonCode: 'not_supported',
      canCreateSession: false,
      requiresUserActivation: false,
    });
  }
  return createAiAvailability({
    providerId: AI_PROVIDER_IDS.CHROME_BUILT_IN_LANGUAGE_MODEL,
    state: AI_AVAILABILITY_STATES.ERROR,
    reasonCode: 'unknown_availability_state',
    details: { rawAvailability },
    canCreateSession: false,
    requiresUserActivation: false,
  });
}
