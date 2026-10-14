import {
  VIDEO_SKIP_CONTROL_SURFACE_QA_ACTIONS,
  createVideoSkipControlSurfaceQaResponse,
  parseVideoSkipControlSurfaceQaRequest,
} from '../../../../../domains/nudge/video-skip/automation/videoSkipControlSurfaceQaContract.dev.js';
import {
  assertTrustedQaAutomationHarnessSender,
  requireQaAutomationTargetWebTab,
} from '../../../../../platform/security/qaAutomationHarnessTrust.dev.js';

const ACTIONS = Object.freeze(Object.values(VIDEO_SKIP_CONTROL_SURFACE_QA_ACTIONS));

function resolveFailureCode(error) {
  const code = typeof error?.code === 'string' && error.code.trim()
    ? error.code.trim()
    : typeof error?.message === 'string' && error.message.trim()
      ? error.message.trim()
      : 'VIDEO_SKIP_CONTROL_SURFACE_QA_FAILED';
  return /^[A-Z0-9_:.-]{1,160}$/u.test(code)
    ? code
    : 'VIDEO_SKIP_CONTROL_SURFACE_QA_FAILED';
}

function requireDependencies(browserPort, contentScriptOrchestrator) {
  if (
    typeof browserPort?.getRuntimeId !== 'function'
    || typeof browserPort?.tabsGet !== 'function'
    || typeof browserPort?.tabsSendMessage !== 'function'
  ) {
    throw new Error('VIDEO_SKIP_CONTROL_SURFACE_QA_BROWSER_PORT_REQUIRED');
  }
  if (typeof contentScriptOrchestrator?.ensureContentScriptReady !== 'function') {
    throw new Error('VIDEO_SKIP_CONTROL_SURFACE_QA_CONTENT_ORCHESTRATOR_REQUIRED');
  }
}

async function requireContentDelivery(browserPort, targetTabId, request) {
  const delivery = await browserPort.tabsSendMessage(targetTabId, request, { frameId: 0 });
  if (delivery?.error) {
    throw new Error('VIDEO_SKIP_CONTROL_SURFACE_QA_CONTENT_DELIVERY_FAILED');
  }
  const response = delivery?.response;
  if (
    response?.success !== true
    || response.channel !== request.channel
    || response.action !== request.action
    || response.requestId !== request.requestId
    || response.targetTabId !== request.targetTabId
  ) {
    throw new Error(
      response?.error || 'VIDEO_SKIP_CONTROL_SURFACE_QA_CONTENT_RESPONSE_INVALID',
    );
  }
  return response.result;
}

async function executeRequest({
  message,
  sender,
  browserPort,
  contentScriptOrchestrator,
}) {
  requireDependencies(browserPort, contentScriptOrchestrator);
  assertTrustedQaAutomationHarnessSender(sender, browserPort, {
    errorCode: 'VIDEO_SKIP_CONTROL_SURFACE_QA_HARNESS_SENDER_UNTRUSTED',
  });
  const request = parseVideoSkipControlSurfaceQaRequest(message);
  const initialTab = requireQaAutomationTargetWebTab(
    await browserPort.tabsGet(request.targetTabId),
    request.targetTabId,
    { errorCode: 'VIDEO_SKIP_CONTROL_SURFACE_QA_TARGET_TAB_UNAVAILABLE' },
  );
  const ready = await contentScriptOrchestrator.ensureContentScriptReady(request.targetTabId, {
    url: initialTab.url,
    reason: `video_skip_control_surface_qa:${request.action.toLowerCase()}`,
  });
  if (ready?.ok !== true) {
    throw new Error(
      ready?.error || ready?.reason || 'VIDEO_SKIP_CONTROL_SURFACE_QA_CONTENT_NOT_READY',
    );
  }
  const currentTab = requireQaAutomationTargetWebTab(
    await browserPort.tabsGet(request.targetTabId),
    request.targetTabId,
    { errorCode: 'VIDEO_SKIP_CONTROL_SURFACE_QA_TARGET_TAB_UNAVAILABLE' },
  );
  if (currentTab.url !== initialTab.url) {
    throw new Error('VIDEO_SKIP_CONTROL_SURFACE_QA_TARGET_TAB_NAVIGATED');
  }
  return requireContentDelivery(browserPort, request.targetTabId, request);
}

export function createVideoSkipControlSurfaceQaMessageRoutes({
  browserPort,
  contentScriptOrchestrator,
} = {}) {
  const actions = Object.create(null);
  ACTIONS.forEach((action) => {
    actions[action] = (message, sender, sendResponse) => {
      void executeRequest({
        message,
        sender,
        browserPort,
        contentScriptOrchestrator,
      }).then(
        (result) => sendResponse?.(createVideoSkipControlSurfaceQaResponse(message, {
          success: true,
          result,
        })),
        (error) => {
          let response;
          try {
            response = createVideoSkipControlSurfaceQaResponse(message, {
              success: false,
              error: resolveFailureCode(error),
            });
          } catch (_responseError) {
            response = { success: false, error: resolveFailureCode(error) };
          }
          sendResponse?.(response);
        },
      );
      return true;
    };
  });
  return { actions };
}

export default createVideoSkipControlSurfaceQaMessageRoutes;
