import { runtimeSendMessage } from '../../../platform/chrome/ChromeService.js';
import { MESSAGE_ACTIONS } from '../../../platform/messaging/messageTypes.js';
import {
  normalizeProfileCompatibilityRecovery,
} from '../../../platform/storage/model/ProfileCompatibilityContract.js';
import {
  createSettingsProfileRecoveryResponseError,
  normalizeSettingsProfileRecovery,
} from '../../../platform/storage/settings/SettingsProfileRecoveryContract.js';

function requireProfileGeneration(value) {
  if (
    typeof value !== 'string'
    || !value.trim()
    || value.trim() !== value
  ) {
    throw new Error('DASHBOARD_PROFILE_GENERATION_READINESS_EPOCH_REQUIRED');
  }
  return value;
}

function createReadinessError(code, details = null) {
  const error = new Error(code);
  error.code = code;
  if (details && typeof details === 'object') {
    Object.assign(error, details);
  }
  return error;
}

export async function requestDashboardProfileGenerationReadiness(profileGeneration) {
  const expectedProfileGeneration = requireProfileGeneration(profileGeneration);
  const response = await runtimeSendMessage({
    action: MESSAGE_ACTIONS.GET_PROFILE_GENERATION_READINESS,
    profileGeneration: expectedProfileGeneration,
  });
  if (
    !response
    || typeof response !== 'object'
    || Array.isArray(response)
    || response.profileGeneration !== expectedProfileGeneration
  ) {
    throw createReadinessError(
      'DASHBOARD_PROFILE_GENERATION_READINESS_RESPONSE_MISMATCH',
      {
        expectedProfileGeneration,
        observedProfileGeneration: typeof response?.profileGeneration === 'string'
          ? response.profileGeneration
          : null,
      },
    );
  }
  if (response.success !== true) {
    const responseError = typeof response.error === 'string' && response.error.trim()
      ? response.error.trim()
      : 'DASHBOARD_PROFILE_GENERATION_READINESS_FAILED';
    const profileCompatibilityRecovery = Object.prototype.hasOwnProperty.call(
      response,
      'profileCompatibilityRecovery',
    )
      ? normalizeProfileCompatibilityRecovery(response.profileCompatibilityRecovery)
      : null;
    const settingsProfileRecovery = Object.prototype.hasOwnProperty.call(response, 'settingsProfileRecovery')
      ? normalizeSettingsProfileRecovery(response.settingsProfileRecovery)
      : null;
    if (settingsProfileRecovery !== null && (
      profileCompatibilityRecovery !== null || responseError !== settingsProfileRecovery.failureCode
    )) {
      throw createReadinessError('SETTINGS_PROFILE_RECOVERY_RESPONSE_MISMATCH', {
        profileGeneration: expectedProfileGeneration,
      });
    }
    if (
      profileCompatibilityRecovery !== null
      && responseError !== profileCompatibilityRecovery.failureCode
    ) {
      throw createReadinessError(
        'PROFILE_COMPATIBILITY_RECOVERY_RESPONSE_MISMATCH',
        { profileGeneration: expectedProfileGeneration },
      );
    }
    if (settingsProfileRecovery !== null) {
      throw createSettingsProfileRecoveryResponseError(responseError, settingsProfileRecovery, {
        profileGeneration: expectedProfileGeneration,
      });
    }
    throw createReadinessError(responseError, {
      profileGeneration: expectedProfileGeneration,
      ...(profileCompatibilityRecovery === null
        ? {}
        : { profileCompatibilityRecovery }),
    });
  }
  if (
    Object.prototype.hasOwnProperty.call(response, 'profileCompatibilityRecovery')
    || Object.prototype.hasOwnProperty.call(response, 'settingsProfileRecovery')
  ) {
    throw createReadinessError(
      'DASHBOARD_PROFILE_GENERATION_READINESS_RESPONSE_MISMATCH',
      { expectedProfileGeneration },
    );
  }
  return Object.freeze({
    profileGeneration: expectedProfileGeneration,
  });
}

export default requestDashboardProfileGenerationReadiness;
