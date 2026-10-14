import {
  hasChromeRuntime,
  runtimeSendMessage,
  runtimeSendMessageReliable,
} from '../../../chrome/ChromeService.js';
import { MESSAGE_ACTIONS } from '../../../messaging/contracts/messageTypes.js';
import {
  listSettingsOwnerCommandContracts,
  requireSettingsRuntimeCommandContract,
} from '../../../../domains/settings/config/settingsCommandContract.js';
import {
  buildSettingsRuntimeCommandRequest,
} from '../../../../domains/settings/config/settingsCommandRequestBuilders.js';
import {
  buildSettingsOwnerNoopAcknowledgement,
  requireSettingsRuntimeCommandAcknowledgement,
} from '../../../../domains/settings/config/settingsRuntimeCommandAcknowledgement.js';
import {
  SETTINGS_BOUNDARY_ERROR_CODES,
  isSettingsBoundaryError,
} from '../../settings/SettingsPersistenceCapability.js';
import { isPlainObject } from '../storageValueUtils.js';
import { requireSiteRegistrationRejectionDetails } from '../../../../domains/progression/contracts/siteRegistrationRejection.js';
const SETTINGS_PATCH_COMMAND_CONTRACT = requireSettingsRuntimeCommandContract(
  MESSAGE_ACTIONS.SET_SETTINGS,
);
const SETTINGS_APPLY_TIMEOUT_MS = SETTINGS_PATCH_COMMAND_CONTRACT.delivery.timeoutMs;
const SETTINGS_APPLY_RETRY_DELAY_MS = SETTINGS_PATCH_COMMAND_CONTRACT.delivery.retryDelayMs;
const TRANSIENT_SETTINGS_ERROR_CODES = new Set([
  'TIMEOUT',
  'RUNTIME_UNAVAILABLE',
  'SETTINGS_MESSAGE_DELIVERY_FAILED',
  'RUNTIME_LAST_ERROR',
]);
const TRANSIENT_SETTINGS_ERROR_FRAGMENTS = Object.freeze([
  'Could not establish connection',
  'Receiving end does not exist',
  'The message port closed',
  'Extension context invalidated',
]);
export const SETTINGS_TRANSPORT_READ_ERROR_CODES = Object.freeze({
  READ_FAILED: 'SETTINGS_READ_FAILED',
  RELAY_REJECTED: 'SETTINGS_READ_RELAY_REJECTED',
});

function isExtensionOrigin() {
  if (typeof location === 'undefined') return true;
  return location.protocol === 'chrome-extension:';
}

function cloneDefaults(defaults) {
  if (defaults === null) return {};
  return isPlainObject(defaults) ? { ...defaults } : {};
}

function createSettingsApplyError(code, extra = {}) {
  const message = typeof code === 'string' && code.trim()
    ? code.trim()
    : 'SETTINGS_APPLY_FAILED';
  const error = new Error(message);
  error.code = message;
  Object.assign(error, extra);
  return error;
}

function requireExpectedProfileGeneration(value) {
  if (
    typeof value !== 'string'
    || !value.trim()
    || value.trim() !== value
  ) {
    throw createSettingsApplyError('SETTINGS_EXPECTED_PROFILE_GENERATION_INVALID');
  }
  return value;
}

function createSettingsReadError(code, extra = {}) {
  const message = typeof code === 'string' && code.trim()
    ? code.trim()
    : SETTINGS_BOUNDARY_ERROR_CODES.UNKNOWN_KEYS;
  const error = new Error(message);
  error.code = message;
  Object.assign(error, extra);
  return error;
}

function describeSettingsApplyError(error) {
  return {
    code: typeof error?.code === 'string' && error.code.trim() ? error.code.trim() : null,
    message: typeof error?.message === 'string' && error.message.trim()
      ? error.message.trim()
      : String(error || 'UNKNOWN_ERROR'),
    name: typeof error?.name === 'string' && error.name.trim() ? error.name.trim() : null,
  };
}

function formatSettingsApplyFlowLog(event, details = {}) {
  let serializedDetails = '';
  try {
    serializedDetails = JSON.stringify(details);
  } catch (_error) {
    serializedDetails = '{"error":"SETTINGS_FLOW_LOG_UNSERIALIZABLE"}';
  }
  return `[SETTINGS_FLOW][transport][${event}] ${serializedDetails}`;
}

function describeCauseMessage(cause) {
  if (!cause) return null;
  if (typeof cause === 'string' && cause.trim()) return cause.trim();
  if (typeof cause?.message === 'string' && cause.message.trim()) return cause.message.trim();
  const fallback = String(cause || '').trim();
  return fallback || null;
}

function describeSettingsReadError(error) {
  const message = typeof error?.message === 'string' && error.message.trim()
    ? error.message.trim()
    : String(error || 'UNKNOWN_ERROR');
  const causeMessage = describeCauseMessage(error?.cause);
  return {
    code: typeof error?.code === 'string' && error.code.trim() ? error.code.trim() : null,
    message,
    name: typeof error?.name === 'string' && error.name.trim() ? error.name.trim() : null,
    causeMessage,
  };
}

function isTransientSettingsRuntimeError(error) {
  const details = describeSettingsReadError(error);
  const parts = [
    details.code,
    details.message,
    details.causeMessage,
  ].filter(Boolean);
  return parts.some((part) => {
    if (TRANSIENT_SETTINGS_ERROR_CODES.has(part)) return true;
    return TRANSIENT_SETTINGS_ERROR_FRAGMENTS.some((fragment) => part.includes(fragment));
  });
}

function formatRequestedKeys(requestedKeys = []) {
  return Array.isArray(requestedKeys) && requestedKeys.length
    ? requestedKeys.join(',')
    : '(none)';
}

function formatSettingsReadLogDetail({ requestedKeys = [], error }) {
  const details = describeSettingsReadError(error);
  const tokens = [
    `requestedKeys=${formatRequestedKeys(requestedKeys)}`,
    `code=${details.code || 'n/a'}`,
    `name=${details.name || 'n/a'}`,
    `message=${details.message}`,
  ];
  if (details.causeMessage) {
    tokens.push(`cause=${details.causeMessage}`);
  }
  tokens.push(`transient=${isTransientSettingsRuntimeError(error) ? 'true' : 'false'}`);
  return tokens.join(' ');
}

function delay(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function shouldSuppressTransientSettingsApplyLogs(error, quietTransientFailures = false) {
  if (!quietTransientFailures) return false;
  return isTransientSettingsApplyError(error?.code || error?.message || '');
}

export function isTransientSettingsApplyError(code) {
  if (typeof code !== 'string' || !code.trim()) return false;
  const normalized = code.trim();
  if (TRANSIENT_SETTINGS_ERROR_CODES.has(normalized)) return true;
  return normalized.includes('Could not establish connection')
    || normalized.includes('Receiving end does not exist')
    || normalized.includes('The message port closed')
    || normalized.includes('Extension context invalidated');
}

export function createSettingsTransport({
  hasChromeRuntimeFn = hasChromeRuntime,
  isExtensionOriginFn = isExtensionOrigin,
  runtimeSendMessageFn = runtimeSendMessage,
  runtimeSendMessageReliableFn = runtimeSendMessageReliable,
  settingsPersistence,
} = {}) {
  if (!settingsPersistence || typeof settingsPersistence.get !== 'function') {
    throw new Error('SETTINGS_TRANSPORT_PERSISTENCE_REQUIRED');
  }

  async function readSettingsSnapshot(defaults = {}) {
    const requested = defaults === null ? null : cloneDefaults(defaults);
    if (requested === null) {
      throw createSettingsReadError(SETTINGS_BOUNDARY_ERROR_CODES.FULL_SNAPSHOT_FORBIDDEN);
    }

    const requestedKeys = Object.keys(requested);
    if (!isExtensionOriginFn()) {
      if (!hasChromeRuntimeFn()) {
        throw createSettingsReadError(SETTINGS_TRANSPORT_READ_ERROR_CODES.RELAY_REJECTED, {
          requestedKeys,
        });
      }
      let response;
      try {
        response = await runtimeSendMessageFn({
          action: MESSAGE_ACTIONS.GET_SETTINGS,
          defaults: requested,
          keys: requestedKeys,
        });
      } catch (error) {
        throw createSettingsReadError(SETTINGS_TRANSPORT_READ_ERROR_CODES.RELAY_REJECTED, {
          cause: error,
          requestedKeys,
        });
      }
      if (response?.success && response?.settings && typeof response.settings === 'object') {
        return response.settings;
      }
      if (response && response.success === false) {
        throw createSettingsReadError(
          response?.error || SETTINGS_TRANSPORT_READ_ERROR_CODES.RELAY_REJECTED,
          {
            requestedKeys,
          },
        );
      }
      throw createSettingsReadError(SETTINGS_TRANSPORT_READ_ERROR_CODES.RELAY_REJECTED, {
        requestedKeys,
      });
    }

    try {
      if (!requestedKeys.length) return {};
      return await settingsPersistence.get(requested);
    } catch (error) {
      if (isSettingsBoundaryError(error)) {
        throw error;
      }
      const logDetail = formatSettingsReadLogDetail({ requestedKeys, error });
      if (isTransientSettingsRuntimeError(error)) {
        console.warn(
          `[settingsTransport] Canonical settings read unavailable during extension context transition: ${logDetail}`,
        );
      } else {
        console.error(
          `[settingsTransport] Failed to read canonical settings snapshot: ${logDetail}`,
        );
      }
      throw createSettingsReadError(SETTINGS_TRANSPORT_READ_ERROR_CODES.READ_FAILED, {
        cause: error,
        requestedKeys,
      });
    }
  }

  async function applySettingsPatchViaRuntime(
    items = {},
    {
      expectedProfileGeneration = null,
      timeoutMs = SETTINGS_APPLY_TIMEOUT_MS,
      retryCount = SETTINGS_PATCH_COMMAND_CONTRACT.delivery.retryCount,
      retryDelayMs = SETTINGS_APPLY_RETRY_DELAY_MS,
      quietTransientFailures = false,
      waitForPropagation = false,
      authorization = null,
    } = {},
  ) {
    const payload = isPlainObject(items) ? items : {};
    if (Object.keys(payload).length === 0) {
      return {
        changedKeys: [],
        committedItems: {},
        version: null,
        propagation: null,
        applied: {
          refreshed: false,
          syncScripts: false,
          broadcast: false,
        },
      };
    }

    const maxAttempts = Math.max(
      1,
      Number.isFinite(Number(retryCount)) ? Math.floor(Number(retryCount)) + 1 : 2,
    );
    let lastError = null;
    const payloadKeys = Object.keys(payload);
    const generationBoundPayload = expectedProfileGeneration === null
      ? {
        action: MESSAGE_ACTIONS.SET_SETTINGS,
        items: payload,
      }
      : {
        action: MESSAGE_ACTIONS.SET_SETTINGS,
        items: payload,
        expectedProfileGeneration: requireExpectedProfileGeneration(expectedProfileGeneration),
      };
    if (waitForPropagation === true) {
      generationBoundPayload.waitForPropagation = true;
    }
    if (authorization !== null) {
      generationBoundPayload.authorization = authorization;
    }

    for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
      const delivery = await runtimeSendMessageReliableFn(
        generationBoundPayload,
        { timeoutMs },
      );

      if (!delivery?.ok) {
        lastError = createSettingsApplyError(
          delivery?.error || 'SETTINGS_MESSAGE_DELIVERY_FAILED',
        );
        if (!shouldSuppressTransientSettingsApplyLogs(lastError, quietTransientFailures)) {
          console.warn(formatSettingsApplyFlowLog('delivery_failed', {
            attempt: attempt + 1,
            maxAttempts,
            payloadKeys,
            error: describeSettingsApplyError(lastError),
          }));
        }
      } else {
        const response = delivery?.response;
        if (!response?.success) {
          lastError = createSettingsApplyError(response?.error || 'SETTINGS_APPLY_FAILED', {
            ...requireSiteRegistrationRejectionDetails(response),
            forbiddenKeys: Array.isArray(response?.forbiddenKeys)
              ? [...response.forbiddenKeys]
              : [],
          });
          console.warn(formatSettingsApplyFlowLog('apply_rejected', {
            attempt: attempt + 1,
            maxAttempts,
            payloadKeys,
            error: describeSettingsApplyError(lastError),
            forbiddenKeys: Array.isArray(response?.forbiddenKeys)
              ? [...response.forbiddenKeys]
              : [],
          }));
        } else {
          try {
            const acknowledgement = requireSettingsRuntimeCommandAcknowledgement(
              MESSAGE_ACTIONS.SET_SETTINGS,
              response,
            );
            return {
              ...acknowledgement,
              propagation: isPlainObject(acknowledgement.propagation)
                ? { ...acknowledgement.propagation }
                : null,
            };
          } catch (error) {
            lastError = error instanceof Error
              ? error
              : createSettingsApplyError('SETTINGS_COMMIT_ACK_INVALID');
          }
        }
      }

      const shouldRetry = attempt < (maxAttempts - 1)
        && isTransientSettingsApplyError(lastError?.code || lastError?.message || '');
      if (!shouldRetry) {
        if (!shouldSuppressTransientSettingsApplyLogs(lastError, quietTransientFailures)) {
          console.error(formatSettingsApplyFlowLog('apply_failed', {
            attempt: attempt + 1,
            maxAttempts,
            payloadKeys,
            error: describeSettingsApplyError(lastError),
          }));
        }
        throw lastError;
      }
      await delay(retryDelayMs);
    }

    throw lastError || createSettingsApplyError('SETTINGS_APPLY_FAILED');
  }

  async function runOwnerRuntimeCommand(
    {
      contract,
      payload,
      timeoutMs,
      retryCount,
      retryDelayMs,
      logContext = {},
    } = {},
  ) {
    const {
      action,
      commandFamily,
      fallbackErrorCode,
    } = contract;
    const maxAttempts = Math.max(
      1,
      Number.isFinite(Number(retryCount)) ? Math.floor(Number(retryCount)) + 1 : 2,
    );
    let lastError = null;

    for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
      const delivery = await runtimeSendMessageReliableFn(payload, { timeoutMs });

      if (!delivery?.ok) {
        lastError = createSettingsApplyError(
          delivery?.error || 'SETTINGS_MESSAGE_DELIVERY_FAILED',
        );
        console.warn(formatSettingsApplyFlowLog('owner_command_delivery_failed', {
          action,
          commandFamily,
          attempt: attempt + 1,
          maxAttempts,
          ...logContext,
          error: describeSettingsApplyError(lastError),
        }));
      } else {
        const response = delivery?.response;
        if (response?.success === false) {
          lastError = createSettingsApplyError(response?.error || fallbackErrorCode,
            requireSiteRegistrationRejectionDetails(response) || {});
          console.warn(formatSettingsApplyFlowLog('owner_command_rejected', {
            action,
            commandFamily,
            attempt: attempt + 1,
            maxAttempts,
            ...logContext,
            error: describeSettingsApplyError(lastError),
          }));
        } else {
          try {
            return requireSettingsRuntimeCommandAcknowledgement(action, response);
          } catch (error) {
            lastError = error instanceof Error
              ? error
              : createSettingsApplyError('SETTINGS_COMMIT_ACK_INVALID');
            console.warn(formatSettingsApplyFlowLog('owner_command_ack_invalid', {
              action,
              commandFamily,
              attempt: attempt + 1,
              maxAttempts,
              ...logContext,
              acknowledgementField: lastError?.field || null,
              error: describeSettingsApplyError(lastError),
            }));
          }
        }
      }

      const shouldRetry = attempt < (maxAttempts - 1)
        && isTransientSettingsApplyError(lastError?.code || lastError?.message || '');
      if (!shouldRetry) {
        console.error(formatSettingsApplyFlowLog('owner_command_failed', {
          action,
          commandFamily,
          attempt: attempt + 1,
          maxAttempts,
          ...logContext,
          error: describeSettingsApplyError(lastError),
        }));
        throw lastError;
      }
      await delay(retryDelayMs);
    }

    throw lastError || createSettingsApplyError(fallbackErrorCode);
  }

  async function runSettingsOwnerCommandViaRuntime(action, input = {}, options = {}) {
    const contract = requireSettingsRuntimeCommandContract(action);
    const request = buildSettingsRuntimeCommandRequest(action, input);
    if (request.noopFields) {
      return buildSettingsOwnerNoopAcknowledgement(action, request.noopFields);
    }
    return runOwnerRuntimeCommand({
      contract,
      payload: options.waitForPropagation === true
        ? { ...request.payload, waitForPropagation: true }
        : request.payload,
      timeoutMs: options.timeoutMs ?? contract.delivery.timeoutMs,
      retryCount: options.retryCount ?? contract.delivery.retryCount,
      retryDelayMs: options.retryDelayMs ?? contract.delivery.retryDelayMs,
      logContext: request.logContext,
    });
  }

  const ownerCommandMethods = Object.fromEntries(
    listSettingsOwnerCommandContracts().map((contract) => [
      contract.transportMethod,
      (input = {}, options = {}) => runSettingsOwnerCommandViaRuntime(
        contract.action,
        input,
        options,
      ),
    ]),
  );

  return {
    applySettingsPatchViaRuntime,
    readSettingsSnapshot,
    ...ownerCommandMethods,
  };
}
