import { createStorageProfileMutationActionHandlers } from '../../../../domains/tracking/background/trackingMessageHandlers/storageSupportHandlers.js';
import { createActionSenderPolicy } from '../../../../domains/tracking/background/trackingMessagePolicies/actionSenderPolicy.js';
import { createDestructiveActionPolicy } from '../../../../domains/tracking/background/trackingMessagePolicies/destructiveActionPolicy.js';
import { runAsyncHandler } from '../../../../domains/tracking/background/trackingMessageHandlers/runtimeHandlerUtils.js';
import { MESSAGE_ACTIONS } from '../../../../platform/messaging/messageTypes.js';
import {
  areProfileMutationResponseHandoffsEqual,
  normalizeProfileMutationResponseHandoff,
} from '../../../../platform/messaging/contracts/profileMutationResponseHandoff.js';
import { isTrustedDashboardPageSender } from '../../../../platform/security/senderTrust.js';
import {
  PROFILE_RESET_LIFECYCLE_STATUS,
  normalizeProfileResetLifecycleState,
} from '../../../../platform/storage/runtime/ProfileResetLifecycleRepository.js';

const PROFILE_MUTATION_CONTROL_ACTIONS = Object.freeze([
  MESSAGE_ACTIONS.RESET_APP_DATA,
  MESSAGE_ACTIONS.IMPORT_STORAGE_SNAPSHOT,
  MESSAGE_ACTIONS.PROFILE_MUTATION_RESPONSE_ACK,
]);

function requireProfileMutationControlOwner(owner, methodName, errorCode) {
  if (!owner || typeof owner[methodName] !== 'function') {
    throw new Error(errorCode);
  }
  return owner[methodName].bind(owner);
}

function requireProfileMutationControlFunction(value, errorCode) {
  if (typeof value !== 'function') throw new Error(errorCode);
  return value;
}

function createProfileMutationResponseAckError(code, extra = {}) {
  const error = new Error(code);
  error.code = code;
  Object.assign(error, extra);
  return error;
}

function requireProfileMutationRuntimeGateSnapshot(value) {
  if (
    !value
    || typeof value !== 'object'
    || Array.isArray(value)
    || typeof value.phase !== 'string'
    || (value.closedResetId !== null && typeof value.closedResetId !== 'string')
  ) {
    throw createProfileMutationResponseAckError(
      'PROFILE_MUTATION_RESPONSE_ACK_RUNTIME_GATE_SNAPSHOT_INVALID',
    );
  }
  return value;
}

export function createBackgroundKernelProfileMutationControlBindings({
  settingsPersistence,
  storageSupportBindings,
  readProfileMutationLifecycle,
  profileMutationRuntimeGate,
} = {}) {
  const readSettingsSnapshot = requireProfileMutationControlOwner(
    settingsPersistence,
    'get',
    'BACKGROUND_PROFILE_MUTATION_CONTROL_SETTINGS_READ_OWNER_REQUIRED',
  );
  const importStorageSnapshot = requireProfileMutationControlOwner(
    storageSupportBindings,
    'importStorageSnapshot',
    'BACKGROUND_PROFILE_MUTATION_CONTROL_IMPORT_OWNER_REQUIRED',
  );
  const resetAppData = requireProfileMutationControlOwner(
    storageSupportBindings,
    'resetAppData',
    'BACKGROUND_PROFILE_MUTATION_CONTROL_RESET_OWNER_REQUIRED',
  );
  const completeProfileMutationRuntimeHandoff = requireProfileMutationControlOwner(
    storageSupportBindings,
    'completeProfileMutationRuntimeHandoff',
    'BACKGROUND_PROFILE_MUTATION_CONTROL_RUNTIME_HANDOFF_OWNER_REQUIRED',
  );
  const readMutationLifecycle = requireProfileMutationControlFunction(
    readProfileMutationLifecycle,
    'BACKGROUND_PROFILE_MUTATION_CONTROL_LIFECYCLE_READ_OWNER_REQUIRED',
  );
  const readRuntimeGateSnapshot = requireProfileMutationControlOwner(
    profileMutationRuntimeGate,
    'getSnapshot',
    'BACKGROUND_PROFILE_MUTATION_CONTROL_RUNTIME_GATE_OWNER_REQUIRED',
  );
  const { authorizeActionSender } = createActionSenderPolicy();
  const { authorizeDestructiveRuntimeAction } = createDestructiveActionPolicy({
    readSecuritySnapshot: readSettingsSnapshot,
  });
  const ownedHandlers = createStorageProfileMutationActionHandlers({
    authorizeDestructiveRuntimeAction,
    readSettingsSnapshot,
    readProfileMutationLifecycle: readMutationLifecycle,
    importStorageSnapshot,
    resetAppData,
  });

  let pendingHandoff = null;
  let acknowledgedHandoff = null;
  const acknowledgeProfileMutationResponse = (request, sender, sendResponse) => {
    if (!isTrustedDashboardPageSender(sender)) {
      sendResponse?.({
        success: false,
        error: 'PROFILE_MUTATION_RESPONSE_ACK_UNAUTHORIZED',
      });
      return true;
    }

    return runAsyncHandler(
      sendResponse,
      async () => {
        const handoff = normalizeProfileMutationResponseHandoff(
          request?.profileMutationHandoff,
        );
        const reservedHandoff = acknowledgedHandoff || pendingHandoff;
        if (reservedHandoff !== null) {
          throw createProfileMutationResponseAckError(
            areProfileMutationResponseHandoffsEqual(reservedHandoff, handoff)
              ? 'PROFILE_MUTATION_RESPONSE_ACK_DUPLICATE'
              : 'PROFILE_MUTATION_RESPONSE_ACK_STALE',
          );
        }
        pendingHandoff = handoff;

        try {
          const rawLifecycle = await readMutationLifecycle();
          if (rawLifecycle === null) {
            throw createProfileMutationResponseAckError(
              'PROFILE_MUTATION_RESPONSE_ACK_LIFECYCLE_NOT_COMPLETE',
            );
          }
          const lifecycle = normalizeProfileResetLifecycleState(rawLifecycle);
          if (lifecycle.status !== PROFILE_RESET_LIFECYCLE_STATUS.COMPLETE) {
            throw createProfileMutationResponseAckError(
              'PROFILE_MUTATION_RESPONSE_ACK_LIFECYCLE_NOT_COMPLETE',
              { lifecycle },
            );
          }
          if (lifecycle.resetId !== handoff.resetId) {
            throw createProfileMutationResponseAckError(
              'PROFILE_MUTATION_RESPONSE_ACK_STALE',
              { lifecycle, handoff },
            );
          }
          if (lifecycle.operation !== handoff.operation) {
            throw createProfileMutationResponseAckError(
              'PROFILE_MUTATION_RESPONSE_ACK_LIFECYCLE_MISMATCH',
              { lifecycle, handoff },
            );
          }

          const gate = requireProfileMutationRuntimeGateSnapshot(
            readRuntimeGateSnapshot(),
          );
          if (gate.phase !== 'reload_pending') {
            throw createProfileMutationResponseAckError(
              'PROFILE_MUTATION_RESPONSE_ACK_RUNTIME_GATE_NOT_RELOAD_PENDING',
              { gate },
            );
          }
          if (gate.closedResetId !== handoff.resetId) {
            throw createProfileMutationResponseAckError(
              'PROFILE_MUTATION_RESPONSE_ACK_RUNTIME_GATE_MISMATCH',
              { gate, handoff },
            );
          }

          acknowledgedHandoff = handoff;
          pendingHandoff = null;
          return {
            success: true,
            profileMutationHandoff: handoff,
          };
        } catch (error) {
          if (
            pendingHandoff !== null
            && areProfileMutationResponseHandoffsEqual(pendingHandoff, handoff)
          ) {
            pendingHandoff = null;
          }
          throw error;
        }
      },
      (error) => ({
        success: false,
        error: error?.code || error?.message || 'PROFILE_MUTATION_RESPONSE_ACK_FAILED',
      }),
      (response) => {
        if (response?.success !== true) return;
        completeProfileMutationRuntimeHandoff({
          profileMutationHandoff: response.profileMutationHandoff,
        });
      },
    );
  };

  return Object.freeze(Object.fromEntries(
    PROFILE_MUTATION_CONTROL_ACTIONS.map((action) => [
      action,
      (request, sender, sendResponse) => {
        if (action === MESSAGE_ACTIONS.PROFILE_MUTATION_RESPONSE_ACK) {
          return acknowledgeProfileMutationResponse(request, sender, sendResponse);
        }
        const senderAuthorization = authorizeActionSender(action, sender);
        if (!senderAuthorization.authorized) {
          sendResponse?.({
            success: false,
            error: senderAuthorization.error,
          });
          return true;
        }
        return ownedHandlers[action](request, sender, sendResponse);
      },
    ]),
  ));
}

export default createBackgroundKernelProfileMutationControlBindings;
