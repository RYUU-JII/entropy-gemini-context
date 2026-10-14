import { createSiteFurinReflectionFixture } from '../../../../../domains/nudge/runtime/automation/siteFurinReflectionFixture.dev.js';
import {
  SENTINEL_PROTOCOL_QA_ACTIONS,
  createSentinelProtocolQaResponse,
  parseSentinelProtocolQaRequest,
} from '../../../../../domains/nudge/runtime/automation/sentinelProtocolQaAutomationContract.dev.js';
import {
  normalizeNudgeRuntimeContext,
} from '../../../../../domains/nudge/runtime/nudgeRuntimeContext.js';
import {
  buildSiteFurinChimeConfig,
} from '../../../../../domains/nudge/runtime/sentinelProtocolEntryPolicy.js';
import {
  DEFAULT_NUDGE_RUNTIME_ASSET,
  DEFAULT_NUDGE_RUNTIME_TUNING,
  normalizeNudgeRuntimeConfig,
} from '../../../../../domains/settings/config/nudgeConfig.js';
import {
  getSentinelFlareNudgeCopy,
} from '../../../../../domains/settings/i18n/nudgeCopy.js';
import { MESSAGE_TYPES } from '../../../../../platform/messaging/messageTypes.js';
import { readFurinGoalEndState } from '../../../../../domains/nudge/runtime/session/readFurinGoalEndState.js';
import { getInterventionAdmissionService } from '../../../../../domains/protection/background/runtime/InterventionAdmissionService.js';
import {
  assertTrustedQaAutomationHarnessSender,
  requireQaAutomationTargetWebTab,
} from '../../../../../platform/security/qaAutomationHarnessTrust.dev.js';

const ACTIONS = Object.freeze(Object.values(SENTINEL_PROTOCOL_QA_ACTIONS));

function resolveFailureCode(error) {
  if (error?.message === 'debug_control_blocked_by_production') {
    return 'SENTINEL_PROTOCOL_QA_PRODUCTION_SESSION_ACTIVE';
  }
  const code = typeof error?.code === 'string' && error.code.trim()
    ? error.code.trim()
    : typeof error?.message === 'string' && error.message.trim()
      ? error.message.trim()
      : 'SENTINEL_PROTOCOL_QA_FAILED';
  // Runtime phase prefixes (for example "start:") are canonical diagnostics.
  // Preserve those codes while still excluding free-form page/error text.
  return /^[A-Za-z0-9_:.-]{1,160}$/u.test(code) ? code : 'SENTINEL_PROTOCOL_QA_FAILED';
}

function requireDependencies(browserPort, contentScriptOrchestrator) {
  if (
    typeof browserPort?.getRuntimeId !== 'function'
    || typeof browserPort?.tabsGet !== 'function'
    || typeof browserPort?.tabsSendMessage !== 'function'
  ) {
    throw new Error('SENTINEL_PROTOCOL_QA_BROWSER_PORT_REQUIRED');
  }
  if (typeof contentScriptOrchestrator?.ensureContentScriptReady !== 'function') {
    throw new Error('SENTINEL_PROTOCOL_QA_CONTENT_ORCHESTRATOR_REQUIRED');
  }
}

function buildQaRuntimePayload(payload, { runId } = {}) {
  const runtimeContext = normalizeNudgeRuntimeContext({
    themeId: 'zen',
    language: 'ko',
    variantId: 'zen',
  });
  const copy = getSentinelFlareNudgeCopy(runtimeContext, {
    protocolScope: payload.protocolScope,
  });
  const defaults = {
    ...DEFAULT_NUDGE_RUNTIME_TUNING,
    asset: DEFAULT_NUDGE_RUNTIME_ASSET,
    protocol: copy.protocol,
    message: copy.message,
  };
  const normalizedConfig = normalizeNudgeRuntimeConfig({
    protocolScope: payload.protocolScope,
    ...(payload.protocolScope === 'site' ? { deliveryForm: payload.deliveryForm } : {}),
    protocolVariant: payload.protocolScope === 'global' ? 'global_sentinel' : 'site_furin',
    protocolIntensity: payload.protocolIntensity,
    hudVisible: payload.hudVisible,
    visualThemeId: runtimeContext.themeId,
    asset: DEFAULT_NUDGE_RUNTIME_ASSET,
    protocol: copy.protocol,
    message: copy.message,
  }, { defaults });
  const config = payload.protocolScope === 'site'
    ? buildSiteFurinChimeConfig(normalizedConfig)
    : normalizedConfig;
  return Object.freeze({
    config: Object.freeze({
      ...config,
      ...(payload.protocolScope === 'site' ? { siteFurinReflection:createSiteFurinReflectionFixture() } : {}),
      __nudgeRunId: runId,
    }),
    runtimeContext,
  });
}

async function requireContentDelivery(browserPort, targetTabId, message) {
  const delivery = await browserPort.tabsSendMessage(targetTabId, message, { frameId: 0 });
  if (delivery?.error) throw new Error('SENTINEL_PROTOCOL_QA_CONTENT_DELIVERY_FAILED');
  if (delivery?.response?.ok !== true) {
    throw new Error(delivery?.response?.error || 'SENTINEL_PROTOCOL_QA_CONTENT_RESPONSE_INVALID');
  }
  return delivery.response;
}

async function executeRequest({
  message,
  sender,
  browserPort,
  contentScriptOrchestrator,
  readGoalEndState,
  readInterventionExposure,
}) {
  requireDependencies(browserPort, contentScriptOrchestrator);
  assertTrustedQaAutomationHarnessSender(sender, browserPort, {
    errorCode: 'SENTINEL_PROTOCOL_QA_HARNESS_SENDER_UNTRUSTED',
  });
  const request = parseSentinelProtocolQaRequest(message);
  const initialTab = requireQaAutomationTargetWebTab(
    await browserPort.tabsGet(request.targetTabId),
    request.targetTabId,
    { errorCode: 'SENTINEL_PROTOCOL_QA_TARGET_TAB_UNAVAILABLE' },
  );
  if (request.action === SENTINEL_PROTOCOL_QA_ACTIONS.READ_GOAL_STATE) {
    const [goalEndState, interventionExposure] = await Promise.all([
      readGoalEndState(),
      readInterventionExposure(),
    ]);
    return { goalEndState, interventionExposure };
  }
  const ready = await contentScriptOrchestrator.ensureContentScriptReady(request.targetTabId, {
    url: initialTab.url,
    reason: `sentinel_protocol_qa:${request.action.toLowerCase()}`,
  });
  if (ready?.ok !== true) {
    throw new Error(ready?.error || ready?.reason || 'SENTINEL_PROTOCOL_QA_CONTENT_NOT_READY');
  }
  const currentTab = requireQaAutomationTargetWebTab(
    await browserPort.tabsGet(request.targetTabId),
    request.targetTabId,
    { errorCode: 'SENTINEL_PROTOCOL_QA_TARGET_TAB_UNAVAILABLE' },
  );
  if (currentTab.url !== initialTab.url) {
    throw new Error('SENTINEL_PROTOCOL_QA_TARGET_TAB_NAVIGATED');
  }

  if (request.action === SENTINEL_PROTOCOL_QA_ACTIONS.START) {
    const runtimePayload = buildQaRuntimePayload(request.payload, {
      runId: request.requestId,
    });
    return requireContentDelivery(browserPort, request.targetTabId, {
      type: MESSAGE_TYPES.NUDGE_DEBUG_START,
      payload: runtimePayload,
    });
  }
  if (request.action === SENTINEL_PROTOCOL_QA_ACTIONS.SNAPSHOT) {
    return requireContentDelivery(browserPort, request.targetTabId, {
      type: MESSAGE_TYPES.NUDGE_DEBUG_SNAPSHOT,
      payload: {},
    });
  }
  return requireContentDelivery(browserPort, request.targetTabId, {
    type: MESSAGE_TYPES.NUDGE_DEBUG_STOP,
    payload: {},
  });
}

export function createSentinelProtocolQaAutomationMessageRoutes({
  browserPort,
  contentScriptOrchestrator,
  readGoalEndState = readFurinGoalEndState,
  readInterventionExposure = () => getInterventionAdmissionService().readExposureSnapshot(),
} = {}) {
  const actions = Object.create(null);
  ACTIONS.forEach((action) => {
    actions[action] = (message, sender, sendResponse) => {
      void executeRequest({
        message,
        sender,
        browserPort,
        contentScriptOrchestrator,
        readGoalEndState,
        readInterventionExposure,
      }).then(
        (result) => sendResponse?.(createSentinelProtocolQaResponse(message, {
          success: true,
          result,
        })),
        (error) => {
          let response;
          try {
            response = createSentinelProtocolQaResponse(message, {
              success: false,
              error: resolveFailureCode(error),
            });
          } catch (_responseError) {
            response = {
              success: false,
              error: resolveFailureCode(error),
            };
          }
          sendResponse?.(response);
        },
      );
      return true;
    };
  });
  return { actions };
}

export default createSentinelProtocolQaAutomationMessageRoutes;
