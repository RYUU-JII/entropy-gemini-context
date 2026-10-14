import { MESSAGE_ACTIONS } from '../../../../../platform/messaging/messageTypes.js';
import { requireModelStateProfileEpochId } from '../../../../../platform/storage/model/ProfileEpochContract.js';
import {
  resolveProfileCompatibilityRecovery,
} from '../../../../../platform/storage/model/ProfileCompatibilityContract.js';
import { isTrustedExtensionPageSender } from '../../../../../platform/security/senderTrust.js';
import { resolveSettingsProfileRecovery } from '../../../../../platform/storage/settings/SettingsProfileRecoveryContract.js';

function resolveRequestError(error, fallbackCode) {
  if (typeof error?.code === 'string' && error.code) return error.code;
  if (typeof error?.message === 'string' && error.message) return error.message;
  return fallbackCode;
}

function requireProfileGenerationMessage(message) {
  if (!Object.prototype.hasOwnProperty.call(message || {}, 'profileGeneration')) {
    throw new Error('PROFILE_GENERATION_READINESS_PROFILE_GENERATION_REQUIRED');
  }
  return requireModelStateProfileEpochId(
    message.profileGeneration,
    'PROFILE_GENERATION_READINESS_PROFILE_GENERATION_REQUIRED',
  );
}

function buildProfileGenerationReadinessFailure(error, profileGeneration) {
  const response = {
    success: false,
    error: resolveRequestError(error, 'PROFILE_GENERATION_READINESS_ASSERT_FAILED'),
    profileGeneration,
  };
  const profileCompatibilityRecovery = resolveProfileCompatibilityRecovery(error);
  if (profileCompatibilityRecovery !== null) {
    response.profileCompatibilityRecovery = profileCompatibilityRecovery;
  }
  const settingsProfileRecovery = resolveSettingsProfileRecovery(error);
  if (settingsProfileRecovery !== null) response.settingsProfileRecovery = settingsProfileRecovery;
  return response;
}

export function createProfileGenerationMessageRoutes({
  profileGenerationReadiness,
} = {}) {
  if (
    !profileGenerationReadiness
    || typeof profileGenerationReadiness.assertReady !== 'function'
  ) {
    throw new Error('PROFILE_GENERATION_READINESS_MESSAGE_ROUTE_OWNER_REQUIRED');
  }

  return {
    actions: {
      [MESSAGE_ACTIONS.GET_PROFILE_GENERATION_READINESS]: (message, sender, sendResponse) => {
        if (!isTrustedExtensionPageSender(sender)) {
          sendResponse?.({
            success: false,
            error: 'UNTRUSTED_SENDER',
            profileGeneration: null,
          });
          return false;
        }

        let profileGeneration;
        try {
          profileGeneration = requireProfileGenerationMessage(message);
        } catch (error) {
          sendResponse?.({
            success: false,
            error: error.message,
            profileGeneration: null,
          });
          return false;
        }

        void Promise.resolve()
          .then(() => profileGenerationReadiness.assertReady({
            expectedProfileGeneration: profileGeneration,
          }))
          .then((result) => {
            if (result?.profileGeneration !== profileGeneration) {
              throw new Error('PROFILE_GENERATION_READINESS_RESULT_MISMATCH');
            }
            sendResponse?.({ success: true, profileGeneration });
          })
          .catch((error) => {
            let response;
            try {
              response = buildProfileGenerationReadinessFailure(error, profileGeneration);
            } catch (recoveryContractError) {
              response = {
                success: false,
                error: resolveRequestError(
                  recoveryContractError,
                  'PROFILE_COMPATIBILITY_RECOVERY_CONTRACT_INVALID',
                ),
                profileGeneration,
              };
            }
            sendResponse?.(response);
          });
        return true;
      },
    },
  };
}

export default createProfileGenerationMessageRoutes;
