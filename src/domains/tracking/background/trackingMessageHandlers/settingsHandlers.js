import { MESSAGE_ACTIONS } from '../../../../platform/messaging/messageTypes.js';
import { BUILD_INCLUDE_DEBUG_TOOLS } from '../../../../platform/build/releaseCapabilities.js';
import { createProtectionPresetCommandService } from '../../../protection/background/protectionPresetCommandService.js';
import {
  normalizeChangedKeys,
} from '../../../settings/config/settingsUpdateKeys.js';
import { assertSettingsCommandMutationValues } from '../../../settings/config/settingsCommandContract.js';
import { buildSettingsOwnerCommandResponse } from '../../../settings/config/settingsCommitAcknowledgement.js';
import { isPrivilegedSettingsFlowSender, isTrustedExtensionPageSender } from '../../../../platform/security/senderTrust.js';
import { createSiteRuleCommandService } from '../siteRuleCommandService.js';
import {
  SETTINGS_PROPAGATION_WAIT_TIMEOUT_MS,
  requireSettingsPropagationRetryKeys,
  requireSettingsPropagationWaitRequest,
  requireSettingsPropagationWaitResult,
} from '../../../settings/config/settingsPropagationCommandContract.js';
import { runAsyncHandler } from './runtimeHandlerUtils.js';
import { buildSiteRegistrationRejectionResponse } from '../../../progression/contracts/siteRegistrationRejection.js';

const SET_SETTINGS_PROPAGATION_WAIT_TIMEOUT_MS = 15_000;

function summarizeSender(sender = null) {
  return {
    id: typeof sender?.id === 'string' && sender.id.trim() ? sender.id.trim() : null,
    url: typeof sender?.url === 'string' && sender.url.trim() ? sender.url.trim() : null,
    documentUrl: typeof sender?.documentUrl === 'string' && sender.documentUrl.trim()
      ? sender.documentUrl.trim()
      : null,
    origin: typeof sender?.origin === 'string' && sender.origin.trim() ? sender.origin.trim() : null,
    tabId: Number.isFinite(Number(sender?.tab?.id)) ? Math.floor(Number(sender.tab.id)) : null,
    frameId: Number.isFinite(Number(sender?.frameId)) ? Math.floor(Number(sender.frameId)) : null,
  };
}

function formatSettingsHandlerDiagnostic(event, details = {}) {
  let serializedDetails;
  try {
    serializedDetails = JSON.stringify(details);
  } catch {
    serializedDetails = '{"error":"SETTINGS_HANDLER_LOG_UNSERIALIZABLE"}';
  }
  return `[SETTINGS_FLOW][settingsHandlers][${event}] ${serializedDetails}`;
}

function requireSettingsFunction(fn, errorCode) {
  if (typeof fn !== 'function') {
    throw new Error(errorCode);
  }
  return fn;
}

function hasOwnProperty(source, key) {
  return Object.prototype.hasOwnProperty.call(source || {}, key);
}

function buildPropagationResponse(result) {
  return result?.propagation && typeof result.propagation === 'object'
    ? { propagation: { ...result.propagation } }
    : {};
}

function requireSettingsService(settingsService) {
  if (
    !settingsService
    || typeof settingsService.applySettingsChange !== 'function'
    || typeof settingsService.commitSettingsMutation !== 'function'
  ) {
    throw new Error('SETTINGS_SERVICE_OWNER_REQUIRED');
  }
  return settingsService;
}

function requirePropagationWaitRequest(request, sender) {
  if (!hasOwnProperty(request, 'waitForPropagation')) return false;
  if (typeof request.waitForPropagation !== 'boolean') {
    throw new Error('SETTINGS_PROPAGATION_WAIT_FLAG_INVALID');
  }
  if (request.waitForPropagation !== true) return false;
  if (!isPrivilegedSettingsFlowSender(sender)) {
    throw new Error('SETTINGS_PROPAGATION_WAIT_PRIVILEGED_REQUIRED');
  }
  return true;
}

function requireSettledPropagationOutcome(outcome, taskId) {
  if (
    !outcome
    || typeof outcome !== 'object'
    || Array.isArray(outcome)
    || !['succeeded', 'failed', 'timed_out'].includes(outcome.status)
    || !Number.isInteger(outcome.taskId)
    || outcome.taskId < taskId
  ) {
    throw new Error('SETTINGS_PROPAGATION_WAIT_OUTCOME_INVALID');
  }
  return outcome;
}

async function settleRequestedPropagation(result, {
  waitForPropagation,
  settingsService,
} = {}) {
  const propagationReceipt = result?.propagation;
  if (waitForPropagation !== true || propagationReceipt?.status !== 'scheduled') {
    return result;
  }
  const waitForSettingsPropagationTask = requireSettingsFunction(
    settingsService?.waitForSettingsPropagationTask,
    'SETTINGS_PROPAGATION_TASK_WAITER_REQUIRED',
  );
  const propagationStarted = BUILD_INCLUDE_DEBUG_TOOLS ? performance.now() : null;
  const propagation = requireSettledPropagationOutcome(
    await waitForSettingsPropagationTask(
      propagationReceipt.taskId,
      { timeoutMs: SET_SETTINGS_PROPAGATION_WAIT_TIMEOUT_MS },
    ),
    propagationReceipt.taskId,
  );
  if (BUILD_INCLUDE_DEBUG_TOOLS) console.debug('[SETTINGS_FLOW][timing]', JSON.stringify({
    phase: 'propagation_wait', taskId: propagation.taskId,
    commitVersion: result.version, status: propagation.status,
    durationMs: performance.now() - propagationStarted,
  }));
  return {
    ...result,
    propagation,
    applied: {
      ...result?.applied,
      refreshed: propagation?.applied?.refreshed === true || result?.applied?.refreshed === true,
      syncScripts: propagation?.applied?.syncScripts === true || result?.applied?.syncScripts === true,
      broadcast: propagation?.applied?.broadcast === true || result?.applied?.broadcast === true,
    },
  };
}

function resolveSiteRuleService({
  injectedSiteRuleService,
  settingsService,
}) {
  const service = injectedSiteRuleService || createSiteRuleCommandService({
    settingsService,
  });
  if (
    typeof service?.upsertSiteRule !== 'function'
    || typeof service.removeSiteRule !== 'function'
    || typeof service.updateSiteRule !== 'function'
  ) {
    throw new Error('SETTINGS_SITE_RULE_SERVICE_REQUIRED');
  }
  return service;
}

function resolveProtectionPresetService({
  injectedProtectionPresetService,
  settingsService,
}) {
  const service = injectedProtectionPresetService || createProtectionPresetCommandService({
    settingsService,
  });
  if (
    typeof service?.createProtectionPreset !== 'function'
    || typeof service.updateProtectionPreset !== 'function'
    || typeof service.deleteProtectionPreset !== 'function'
    || typeof service.assignGlobalProtectionPreset !== 'function'
  ) {
    throw new Error('SETTINGS_PROTECTION_PRESET_SERVICE_REQUIRED');
  }
  return service;
}

export function createSettingsActionHandlers(context = {}) {
  const {
    authorizeSettingsWriteSender,
    buildSettingsReadPayload,
    redactSensitiveSettingsPayload,
    readSettingsSnapshot: readSettings,
    settingsService,
    siteRuleService: injectedSiteRuleService,
    protectionPresetService: injectedProtectionPresetService,
    updateOperationalTimestamp,
  } = context;
  const authorizeWriteSender = requireSettingsFunction(
    authorizeSettingsWriteSender,
    'SETTINGS_WRITE_AUTH_OWNER_REQUIRED',
  );
  const buildReadPayload = requireSettingsFunction(
    buildSettingsReadPayload,
    'SETTINGS_READ_PAYLOAD_OWNER_REQUIRED',
  );
  const redactSettingsPayload = requireSettingsFunction(
    redactSensitiveSettingsPayload,
    'SETTINGS_REDACTION_OWNER_REQUIRED',
  );
  const readSettingsSnapshot = requireSettingsFunction(
    readSettings,
    'SETTINGS_READ_OWNER_REQUIRED',
  );
  const updateSettingsOperationalTimestamp = requireSettingsFunction(
    updateOperationalTimestamp,
    'SETTINGS_OPERATIONAL_TIMESTAMP_OWNER_REQUIRED',
  );
  const resolvedSettingsService = requireSettingsService(settingsService);
  const siteRuleService = resolveSiteRuleService({
    injectedSiteRuleService,
    settingsService: resolvedSettingsService,
  });
  const protectionPresetService = resolveProtectionPresetService({
    injectedProtectionPresetService,
    settingsService: resolvedSettingsService,
  });

  function runSettingsChangedHandler({
    actionReason = 'settings_changed',
    fallbackKeys = [],
  } = {}) {
    return (request, sender, sendResponse) => runAsyncHandler(
      sendResponse,
      async () => {
        updateSettingsOperationalTimestamp();
        const requestedChangedKeys = normalizeChangedKeys(
          Array.isArray(request?.keys) && request.keys.length > 0 ? request.keys : fallbackKeys,
        );
        const { changedKeys, applied, version } = await resolvedSettingsService.applySettingsChange({
          actionReason,
          changedKeys: requestedChangedKeys,
          sender,
          persist: false,
          invalidateFilterCache: true,
          refreshForBroadcast: true,
          reportBroadcastAsRefresh: true,
        });

        return {
          success: true,
          changedKeys,
          version,
          applied: {
            refreshed: applied.refreshed,
            syncScripts: applied.syncScripts,
            broadcast: applied.broadcast,
          },
        };
      },
      (error) => ({
        success: false,
        error: error?.code || error?.message || 'SETTINGS_CHANGED_FAILED',
        ...buildPropagationResponse(error),
      }),
    );
  }

  return {
    [MESSAGE_ACTIONS.WAIT_SETTINGS_PROPAGATION]: (request, sender, sendResponse) => runAsyncHandler(
      sendResponse,
      async () => {
        if (!isTrustedExtensionPageSender(sender)) throw new Error('SETTINGS_PROPAGATION_WAIT_FORBIDDEN');
        const requested = requireSettingsPropagationWaitRequest(request);
        const waitForTask = requireSettingsFunction(
          resolvedSettingsService.waitForSettingsPropagationTask,
          'SETTINGS_PROPAGATION_TASK_WAITER_REQUIRED',
        );
        const propagation = await waitForTask(requested.taskId, {
          timeoutMs: SETTINGS_PROPAGATION_WAIT_TIMEOUT_MS,
          expectedOwnerEpoch: requested.ownerEpoch,
        });
        if (propagation?.status === 'profile_mutation_quiesced') {
          throw new Error('SETTINGS_PROPAGATION_PROFILE_MUTATION_QUIESCED');
        }
        return { success: true, propagation: requireSettingsPropagationWaitResult(propagation, requested) };
      },
      (error) => ({
        success: false,
        error: error?.code || error?.message || 'SETTINGS_PROPAGATION_WAIT_FAILED',
      }),
    ),
    [MESSAGE_ACTIONS.RETRY_SETTINGS_PROPAGATION]: (request, sender, sendResponse) => runAsyncHandler(
      sendResponse,
      async () => {
        if (!isPrivilegedSettingsFlowSender(sender)) throw new Error('SETTINGS_PROPAGATION_RETRY_FORBIDDEN');
        const keys = requireSettingsPropagationRetryKeys(request?.keys);
        const result = await resolvedSettingsService.applySettingsChange({
          actionReason: 'retry_settings_propagation',
          changedKeys: keys,
          sender,
          persist: false,
          invalidateFilterCache: true,
          refreshForBroadcast: true,
          propagationWaitTimeoutMs: SETTINGS_PROPAGATION_WAIT_TIMEOUT_MS,
        });
        return { success: true, ...result };
      },
      (error) => ({
        success: false,
        error: error?.code || error?.message || 'SETTINGS_PROPAGATION_RETRY_FAILED',
        ...(error?.propagation ? {
          version: error.propagation.commitVersion,
          changedKeys: [...error.propagation.changedKeys],
          ...buildPropagationResponse(error),
        } : {}),
      }),
    ),
    [MESSAGE_ACTIONS.GET_SETTINGS]: (request, sender, sendResponse) => runAsyncHandler(
      sendResponse,
      async () => {
        const readRequest = buildReadPayload(request);
        if (readRequest.payload === null) {
          return {
            success: false,
            error: 'SETTINGS_SCOPE_FORBIDDEN',
          };
        }

        const {
          safePayload,
          redactedDefaults,
          redactedKeys,
        } = redactSettingsPayload(readRequest.payload);
        const settings = Object.keys(safePayload).length > 0
          ? await readSettingsSnapshot(safePayload)
          : {};
        const nextSettings = {
          ...(settings && typeof settings === 'object' ? settings : {}),
          ...redactedDefaults,
        };

        return {
          success: true,
          settings: nextSettings,
          redactedKeys,
        };
      },
      (error) => ({
        success: false,
        settings: {},
        error: error?.code || error?.message || 'GET_SETTINGS_FAILED',
      }),
    ),

    [MESSAGE_ACTIONS.SET_SETTINGS]: (request, sender, sendResponse) => runAsyncHandler(
      sendResponse,
      async () => {
        const items = request?.items && typeof request.items === 'object' ? request.items : {};
        assertSettingsCommandMutationValues(items);
        const waitForPropagation = requirePropagationWaitRequest(request, sender);
        const writeAuthorization = authorizeWriteSender({ sender, items });
        if (!writeAuthorization.authorized) {
          console.warn(formatSettingsHandlerDiagnostic('write_forbidden', {
            sender: summarizeSender(sender),
            itemKeys: Object.keys(items),
            forbiddenKeys: Array.isArray(writeAuthorization.forbiddenKeys)
              ? [...writeAuthorization.forbiddenKeys]
              : [],
            error: writeAuthorization.error,
            privilegedSender: isPrivilegedSettingsFlowSender(sender),
          }));
          const rejection = {
            success: false,
            error: writeAuthorization.error,
          };
          if (writeAuthorization.forbiddenKeys.length > 0) {
            rejection.forbiddenKeys = writeAuthorization.forbiddenKeys;
          }
          return rejection;
        }

        const {
          changedKeys,
          committedItems,
          applied,
          propagation: propagationReceipt,
          version,
        } = await resolvedSettingsService.applySettingsChange({
          actionReason: 'set_settings',
          items,
          sender,
          securityAuthorization: request?.authorization,
          persist: true,
          emitSettingsUpdated: false,
          invalidateFilterCache: true,
          refreshForBroadcast: false,
          reportBroadcastAsRefresh: false,
        });
        let propagation = propagationReceipt;
        if (waitForPropagation && propagationReceipt?.status === 'scheduled') {
          const waitForSettingsPropagationTask = requireSettingsFunction(
            resolvedSettingsService.waitForSettingsPropagationTask,
            'SETTINGS_PROPAGATION_TASK_WAITER_REQUIRED',
          );
          propagation = requireSettledPropagationOutcome(
            await waitForSettingsPropagationTask(
              propagationReceipt.taskId,
              { timeoutMs: SET_SETTINGS_PROPAGATION_WAIT_TIMEOUT_MS },
            ),
            propagationReceipt.taskId,
          );
        }
        if (!changedKeys.length) {
          const {
            safePayload: safeCommittedItems,
          } = redactSettingsPayload(committedItems, { writeAcknowledgement: true });
          return {
            success: true,
            changedKeys,
            committedItems: safeCommittedItems,
            version,
            propagation: null,
            applied: {
              refreshed: false,
              syncScripts: false,
              broadcast: false,
            },
          };
        }

        const {
          safePayload: safeCommittedItems,
        } = redactSettingsPayload(committedItems, { writeAcknowledgement: true });

        return {
          success: true,
          changedKeys,
          committedItems: safeCommittedItems,
          version,
          propagation: propagation && typeof propagation === 'object'
            ? propagation
            : null,
          applied: {
            refreshed: propagation?.applied?.refreshed === true || applied.refreshed,
            syncScripts: propagation?.applied?.syncScripts === true || applied.syncScripts,
            broadcast: propagation?.applied?.broadcast === true || applied.broadcast,
          },
        };
      },
      (error) => buildSiteRegistrationRejectionResponse(error)
        || ({ success: false, error: error?.message || 'SET_SETTINGS_FAILED' }),
    ),

    [MESSAGE_ACTIONS.UPSERT_SITE_RULE]: (request, sender, sendResponse) => runAsyncHandler(
      sendResponse,
      async () => {
        const waitForPropagation = requirePropagationWaitRequest(request, sender);
        const result = await siteRuleService.upsertSiteRule({
          domain: request?.domain,
          type: request?.type,
          goalMinutes: request?.goalMinutes,
          confirmExactMove: request?.confirmExactMove === true,
          ...(hasOwnProperty(request, 'firstUseRecording') ? { firstUseRecording: request.firstUseRecording } : {}),
          sender,
          actionReason: 'upsert_site_rule',
        });

        const settledResult = await settleRequestedPropagation(result, {
          waitForPropagation,
          settingsService: resolvedSettingsService,
        });
        return buildSettingsOwnerCommandResponse(MESSAGE_ACTIONS.UPSERT_SITE_RULE, settledResult);
      },
      (error) => buildSiteRegistrationRejectionResponse(error)
        || ({ success: false, error: error?.message || 'UPSERT_SITE_RULE_FAILED' }),
    ),

    [MESSAGE_ACTIONS.COMPLETE_FIRST_USE]: (request, sender, sendResponse) => runAsyncHandler(
      sendResponse,
      async () => {
        const waitForPropagation = requirePropagationWaitRequest(request, sender);
        const result = await siteRuleService.completeFirstUse({ sender });
        const settledResult = await settleRequestedPropagation(result, {
          waitForPropagation, settingsService: resolvedSettingsService,
        });
        return buildSettingsOwnerCommandResponse(MESSAGE_ACTIONS.COMPLETE_FIRST_USE, settledResult);
      },
      (error) => ({ success: false, error: error?.message || 'COMPLETE_FIRST_USE_FAILED' }),
    ),

    [MESSAGE_ACTIONS.REMOVE_SITE_RULE]: (request, sender, sendResponse) => runAsyncHandler(
      sendResponse,
      async () => {
        const waitForPropagation = requirePropagationWaitRequest(request, sender);
        const result = await siteRuleService.removeSiteRule({
          domain: request?.domain,
          type: request?.type,
          sender,
          actionReason: 'remove_site_rule',
        });

        const settledResult = await settleRequestedPropagation(result, {
          waitForPropagation,
          settingsService: resolvedSettingsService,
        });
        return buildSettingsOwnerCommandResponse(MESSAGE_ACTIONS.REMOVE_SITE_RULE, settledResult);
      },
      (error) => ({ success: false, error: error?.message || 'REMOVE_SITE_RULE_FAILED' }),
    ),

    [MESSAGE_ACTIONS.UPDATE_SITE_RULE]: (request, sender, sendResponse) => runAsyncHandler(
      sendResponse,
      async () => {
        const waitForPropagation = requirePropagationWaitRequest(request, sender);
        const updateInput = {
          domain: request?.domain,
          sender,
          actionReason: 'update_site_rule',
        };
        if (hasOwnProperty(request, 'goalMinutes')) {
          updateInput.goalMinutes = request.goalMinutes;
        }
        if (hasOwnProperty(request, 'presetId')) {
          updateInput.presetId = request.presetId;
        }
        if (hasOwnProperty(request, 'policy')) {
          updateInput.policy = request.policy;
        }
        const result = await siteRuleService.updateSiteRule(updateInput);
        const settledResult = await settleRequestedPropagation(result, {
          waitForPropagation,
          settingsService: resolvedSettingsService,
        });

        return buildSettingsOwnerCommandResponse(MESSAGE_ACTIONS.UPDATE_SITE_RULE, settledResult);
      },
      (error) => ({ success: false, error: error?.message || 'UPDATE_SITE_RULE_FAILED' }),
    ),

    [MESSAGE_ACTIONS.CREATE_PROTECTION_PRESET]: (request, sender, sendResponse) => runAsyncHandler(
      sendResponse,
      async () => {
        const waitForPropagation = requirePropagationWaitRequest(request, sender);
        const result = await protectionPresetService.createProtectionPreset({
          label: request?.label,
          sourcePresetId: request?.sourcePresetId,
          sender,
          actionReason: 'create_protection_preset',
        });

        const settledResult = await settleRequestedPropagation(result, {
          waitForPropagation,
          settingsService: resolvedSettingsService,
        });
        return buildSettingsOwnerCommandResponse(
          MESSAGE_ACTIONS.CREATE_PROTECTION_PRESET,
          settledResult,
        );
      },
      (error) => ({ success: false, error: error?.message || 'CREATE_PROTECTION_PRESET_FAILED' }),
    ),

    [MESSAGE_ACTIONS.UPDATE_PROTECTION_PRESET]: (request, sender, sendResponse) => runAsyncHandler(
      sendResponse,
      async () => {
        const waitForPropagation = requirePropagationWaitRequest(request, sender);
        const result = await protectionPresetService.updateProtectionPreset({
          presetId: request?.presetId,
          patch: request?.patch,
          sender,
          actionReason: 'update_protection_preset',
        });

        const settledResult = await settleRequestedPropagation(result, {
          waitForPropagation,
          settingsService: resolvedSettingsService,
        });
        return buildSettingsOwnerCommandResponse(
          MESSAGE_ACTIONS.UPDATE_PROTECTION_PRESET,
          settledResult,
        );
      },
      (error) => ({ success: false, error: error?.message || 'UPDATE_PROTECTION_PRESET_FAILED' }),
    ),

    [MESSAGE_ACTIONS.DELETE_PROTECTION_PRESET]: (request, sender, sendResponse) => runAsyncHandler(
      sendResponse,
      async () => {
        const waitForPropagation = requirePropagationWaitRequest(request, sender);
        const result = await protectionPresetService.deleteProtectionPreset({
          presetId: request?.presetId,
          sender,
          actionReason: 'delete_protection_preset',
        });

        const settledResult = await settleRequestedPropagation(result, {
          waitForPropagation,
          settingsService: resolvedSettingsService,
        });
        return buildSettingsOwnerCommandResponse(
          MESSAGE_ACTIONS.DELETE_PROTECTION_PRESET,
          settledResult,
        );
      },
      (error) => ({ success: false, error: error?.message || 'DELETE_PROTECTION_PRESET_FAILED' }),
    ),

    [MESSAGE_ACTIONS.ASSIGN_GLOBAL_PROTECTION_PRESET]: (request, sender, sendResponse) => runAsyncHandler(
      sendResponse,
      async () => {
        const waitForPropagation = requirePropagationWaitRequest(request, sender);
        const result = await protectionPresetService.assignGlobalProtectionPreset({
          presetId: request?.presetId,
          sender,
          actionReason: 'assign_global_protection_preset',
        });

        const settledResult = await settleRequestedPropagation(result, {
          waitForPropagation,
          settingsService: resolvedSettingsService,
        });
        return buildSettingsOwnerCommandResponse(
          MESSAGE_ACTIONS.ASSIGN_GLOBAL_PROTECTION_PRESET,
          settledResult,
        );
      },
      (error) => ({ success: false, error: error?.message || 'ASSIGN_GLOBAL_PROTECTION_PRESET_FAILED' }),
    ),

    [MESSAGE_ACTIONS.SETTINGS_CHANGED]: runSettingsChangedHandler({
      actionReason: 'settings_changed',
    }),
  };
}
