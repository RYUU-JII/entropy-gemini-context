import { MESSAGE_ACTIONS } from '../../../../../platform/messaging/messageTypes.js';
import { PROGRESSION_DEBUG_ACTIONS } from '@progression-debug-actions';
import { isTrustedExtensionPageSender, isTrustedDashboardPageSender } from '../../../../../platform/security/senderTrust.js';
import { BUILD_INCLUDE_DEBUG_TOOLS } from '../../../../../platform/build/releaseCapabilities.js';

const REQUIRED_PROGRESSION_SERVICE_METHODS = Object.freeze([
  'readArtifactDisclosureSnapshot',
  'readFirstVisionSnapshot',
  'recordFirstVisionPresented',
  'recordFirstVisionSpent',
  'recordDashboardFirstVisit',
  'claimBonsaiFirstBloom',
  'recordSiteRegistrationInvitationsAdmitted',
]);

const REQUIRED_DEBUG_PROGRESSION_SERVICE_METHODS = Object.freeze([
  'setProgressionUnlockDebugMode',
  'setProgressionUnlockDebugDay',
  'clearProgressionUnlockDebugOverride',
  'completeProgressionUnlockDebugReplay',
  'resetFirstVisionForDebug',
]);

function sendUntrustedSender(sendResponse) {
  sendResponse?.({ success: false, error: 'UNTRUSTED_SENDER' });
  return false;
}

function requireProfileGenerationMessage(message) {
  if (!Object.prototype.hasOwnProperty.call(message || {}, 'profileGeneration')) {
    throw new Error('PROGRESSION_PROFILE_GENERATION_REQUIRED');
  }
  const value = message.profileGeneration;
  if (typeof value !== 'string' || !value.trim()) {
    throw new Error('PROGRESSION_PROFILE_GENERATION_REQUIRED');
  }
  return value.trim();
}

function resolveProgressionRequestError(error, failureCode) {
  if (typeof error?.code === 'string' && error.code.trim()) {
    return error.code.trim();
  }
  if (typeof error?.message === 'string' && error.message.trim()) {
    return error.message.trim();
  }
  return failureCode;
}

function handleTrustedProgressionRequest({
  sender,
  sendResponse,
  operation,
  resultKey,
  failureCode,
  message = null,
  profileGenerationRequired = false,
}) {
  if (!isTrustedExtensionPageSender(sender)) {
    return sendUntrustedSender(sendResponse);
  }

  let profileGeneration = null;
  if (profileGenerationRequired) {
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
  }

  void Promise.resolve()
    .then(() => operation(profileGeneration))
    .then((result) => {
      sendResponse?.({
        success: true,
        [resultKey]: result,
        ...(profileGenerationRequired ? { profileGeneration } : {}),
      });
    })
    .catch((error) => {
      sendResponse?.({
        success: false,
        error: resolveProgressionRequestError(error, failureCode),
        ...(profileGenerationRequired ? { profileGeneration } : {}),
      });
    });
  return true;
}

export function createProgressionMessageRoutes({ progressionService } = {}) {
  if (!progressionService) {
    throw new Error('PROGRESSION_MESSAGE_ROUTE_OWNER_REQUIRED');
  }
  for (const methodName of REQUIRED_PROGRESSION_SERVICE_METHODS) {
    if (typeof progressionService[methodName] !== 'function') {
      throw new Error(`PROGRESSION_MESSAGE_ROUTE_OWNER_METHOD_REQUIRED:${methodName}`);
    }
  }
  if (BUILD_INCLUDE_DEBUG_TOOLS) {
    for (const methodName of REQUIRED_DEBUG_PROGRESSION_SERVICE_METHODS) {
      if (typeof progressionService[methodName] !== 'function') {
        throw new Error(`PROGRESSION_MESSAGE_ROUTE_OWNER_METHOD_REQUIRED:${methodName}`);
      }
    }
  }

  return {
    actions: {
      [MESSAGE_ACTIONS.CLAIM_BONSAI_FIRST_BLOOM]: (message, sender, sendResponse) => {
        if (!isTrustedDashboardPageSender(sender)) return sendUntrustedSender(sendResponse);
        return handleTrustedProgressionRequest({
          message, sender, sendResponse,
          operation: (profileGeneration) => progressionService.claimBonsaiFirstBloom({
            expectedProfileGeneration: profileGeneration,
          }),
          resultKey: 'receipt', failureCode: 'BONSAI_FIRST_BLOOM_CLAIM_FAILED',
          profileGenerationRequired: true,
        });
      },
      [MESSAGE_ACTIONS.RECORD_SITE_REGISTRATION_INVITATIONS_ADMITTED]: (message, sender, sendResponse) => {
        if (!isTrustedDashboardPageSender(sender)) return sendUntrustedSender(sendResponse);
        return handleTrustedProgressionRequest({
          message, sender, sendResponse,
          operation: (profileGeneration) => progressionService.recordSiteRegistrationInvitationsAdmitted({
            capacity: message.capacity, expectedProfileGeneration: profileGeneration,
          }),
          resultKey: 'receipt', failureCode: 'SITE_REGISTRATION_INVITATIONS_ADMISSION_RECORD_FAILED',
          profileGenerationRequired: true,
        });
      },
      [MESSAGE_ACTIONS.RECORD_DASHBOARD_FIRST_VISIT]: (message, sender, sendResponse) => {
        if (!isTrustedDashboardPageSender(sender)) return sendUntrustedSender(sendResponse);
        return handleTrustedProgressionRequest({
          message, sender, sendResponse,
          operation: (profileGeneration) => progressionService.recordDashboardFirstVisit({
            expectedProfileGeneration: profileGeneration,
          }),
          resultKey: 'access', failureCode: 'DASHBOARD_FIRST_VISIT_RECORD_FAILED',
          profileGenerationRequired: true,
        });
      },
      [MESSAGE_ACTIONS.GET_ARTIFACT_DISCLOSURE_SNAPSHOT]: (message, sender, sendResponse) => (
        handleTrustedProgressionRequest({
          message,
          sender,
          sendResponse,
          operation: (profileGeneration) => progressionService.readArtifactDisclosureSnapshot({
            expectedProfileGeneration: profileGeneration,
          }),
          resultKey: 'snapshot',
          failureCode: 'ARTIFACT_DISCLOSURE_SNAPSHOT_READ_FAILED',
          profileGenerationRequired: true,
        })
      ),
      ...(BUILD_INCLUDE_DEBUG_TOOLS ? {
        [PROGRESSION_DEBUG_ACTIONS.COMPLETE_FIRST_VISION_PREVIEW]: (message, sender, sendResponse) => (
          handleTrustedProgressionRequest({
            message, sender, sendResponse,
            operation: (profileGeneration) => progressionService.completeProgressionUnlockDebugReplay({
              expectedProjection: message?.expectedProjection,
              expectedProfileGeneration: profileGeneration,
            }),
            resultKey: 'completion', failureCode: 'PROGRESSION_FIRST_VISION_PREVIEW_COMPLETE_FAILED',
            profileGenerationRequired: true,
          })
        ),
        [PROGRESSION_DEBUG_ACTIONS.SET_UNLOCK_DAY]: (message, sender, sendResponse) => (
          handleTrustedProgressionRequest({
            message,
            sender,
            sendResponse,
            operation: (profileGeneration) => progressionService.setProgressionUnlockDebugDay({
              dayCount: message?.dayCount,
              expectedProfileGeneration: profileGeneration,
            }),
            resultKey: 'snapshot',
            failureCode: 'PROGRESSION_UNLOCK_DEBUG_SET_FAILED',
            profileGenerationRequired: true,
          })
        ),
        [PROGRESSION_DEBUG_ACTIONS.SET_UNLOCK_MODE]: (message, sender, sendResponse) => (
          handleTrustedProgressionRequest({
            message,
            sender,
            sendResponse,
            operation: (profileGeneration) => progressionService.setProgressionUnlockDebugMode({
              mode: message?.mode,
              dayCount: message?.dayCount,
              expectedProfileGeneration: profileGeneration,
            }),
            resultKey: 'snapshot',
            failureCode: 'PROGRESSION_UNLOCK_DEBUG_MODE_SET_FAILED',
            profileGenerationRequired: true,
          })
        ),
        [PROGRESSION_DEBUG_ACTIONS.CLEAR_UNLOCK_OVERRIDE]: (
          message,
          sender,
          sendResponse,
        ) => (
          handleTrustedProgressionRequest({
            message,
            sender,
            sendResponse,
            operation: (profileGeneration) => progressionService.clearProgressionUnlockDebugOverride({
              expectedProfileGeneration: profileGeneration,
            }),
            resultKey: 'snapshot',
            failureCode: 'PROGRESSION_UNLOCK_DEBUG_CLEAR_FAILED',
            profileGenerationRequired: true,
          })
        ),
        [PROGRESSION_DEBUG_ACTIONS.RESET_FIRST_VISION]: (message, sender, sendResponse) => (
          handleTrustedProgressionRequest({
            message,
            sender,
            sendResponse,
            operation: (profileGeneration) => progressionService.resetFirstVisionForDebug({
              expectedProfileGeneration: profileGeneration,
            }),
            resultKey: 'snapshot',
            failureCode: 'FIRST_VISION_DEBUG_RESET_FAILED',
            profileGenerationRequired: true,
          })
        ),
      } : {}),
      [MESSAGE_ACTIONS.GET_FIRST_VISION_PROGRESSION_SNAPSHOT]: (message, sender, sendResponse) => (
        handleTrustedProgressionRequest({
          message,
          sender,
          sendResponse,
          operation: (profileGeneration) => progressionService.readFirstVisionSnapshot({
            expectedProfileGeneration: profileGeneration,
          }),
          resultKey: 'snapshot',
          failureCode: 'FIRST_VISION_PROGRESSION_SNAPSHOT_READ_FAILED',
          profileGenerationRequired: true,
        })
      ),
      [MESSAGE_ACTIONS.RECORD_FIRST_VISION_PRESENTED]: (message, sender, sendResponse) => (
        handleTrustedProgressionRequest({
          message,
          sender,
          sendResponse,
          operation: (profileGeneration) => progressionService.recordFirstVisionPresented({
            expectedProfileGeneration: profileGeneration,
          }),
          resultKey: 'snapshot',
          failureCode: 'FIRST_VISION_PRESENTED_RECORD_FAILED',
          profileGenerationRequired: true,
        })
      ),
      [MESSAGE_ACTIONS.RECORD_FIRST_VISION_SPENT]: (message, sender, sendResponse) => (
        handleTrustedProgressionRequest({
          message,
          sender,
          sendResponse,
          operation: (profileGeneration) => progressionService.recordFirstVisionSpent({
            expectedProfileGeneration: profileGeneration,
          }),
          resultKey: 'snapshot',
          failureCode: 'FIRST_VISION_SPENT_RECORD_FAILED',
          profileGenerationRequired: true,
        })
      ),
    },
  };
}

export default createProgressionMessageRoutes;
