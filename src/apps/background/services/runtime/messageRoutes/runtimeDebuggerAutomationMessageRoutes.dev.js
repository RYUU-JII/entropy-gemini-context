import {
  RUNTIME_DEBUGGER_AUTOMATION_ACTIONS,
  createRuntimeDebuggerAutomationContentRequest,
  createRuntimeDebuggerAutomationResponse,
  parseRuntimeDebuggerAutomationRequest,
  requireRuntimeDebuggerAutomationResponse,
} from '../../../../../domains/nudge/runtime-debugger/automation/runtimeDebuggerAutomationContract.dev.js';
import {
  assertTrustedQaAutomationHarnessSender,
  requireQaAutomationTargetWebTab,
} from '../../../../../platform/security/qaAutomationHarnessTrust.dev.js';

const ACTION_VALUES = Object.freeze(Object.values(RUNTIME_DEBUGGER_AUTOMATION_ACTIONS));

function resolveFailureCode(error, fallback = 'RUNTIME_DEBUGGER_AUTOMATION_RELAY_FAILED') {
  const code = typeof error?.code === 'string' && error.code.trim()
    ? error.code.trim()
    : typeof error?.message === 'string' && error.message.trim()
      ? error.message.trim()
      : fallback;
  return /^[A-Z0-9_:.-]{1,160}$/.test(code) ? code : fallback;
}

function requireBrowserPort(browserPort) {
  if (
    !browserPort
    || typeof browserPort.getRuntimeId !== 'function'
    || typeof browserPort.tabsGet !== 'function'
    || typeof browserPort.tabsSendMessage !== 'function'
  ) {
    throw new Error('RUNTIME_DEBUGGER_AUTOMATION_BROWSER_PORT_REQUIRED');
  }
  return browserPort;
}

function requireContentScriptOrchestrator(contentScriptOrchestrator) {
  if (typeof contentScriptOrchestrator?.ensureContentScriptReady !== 'function') {
    throw new Error('RUNTIME_DEBUGGER_AUTOMATION_CONTENT_ORCHESTRATOR_REQUIRED');
  }
  return contentScriptOrchestrator;
}

function requireContentReady(result) {
  if (!result || typeof result !== 'object' || result.ok !== true) {
    const reason = typeof result?.error === 'string' && result.error
      ? result.error
      : typeof result?.reason === 'string' && result.reason
        ? result.reason
        : 'RUNTIME_DEBUGGER_AUTOMATION_CONTENT_NOT_READY';
    const error = new Error(reason);
    error.code = reason;
    throw error;
  }
  return result;
}

async function relayRuntimeDebuggerAutomationRequest({
  message,
  sender,
  browserPort,
  contentScriptOrchestrator,
}) {
  const resolvedBrowserPort = requireBrowserPort(browserPort);
  const resolvedContentScriptOrchestrator = requireContentScriptOrchestrator(
    contentScriptOrchestrator,
  );
  assertTrustedQaAutomationHarnessSender(sender, resolvedBrowserPort, {
    errorCode: 'RUNTIME_DEBUGGER_AUTOMATION_HARNESS_SENDER_UNTRUSTED',
  });
  const request = parseRuntimeDebuggerAutomationRequest(message);
  const firstTab = requireQaAutomationTargetWebTab(
    await resolvedBrowserPort.tabsGet(request.targetTabId),
    request.targetTabId,
    { errorCode: 'RUNTIME_DEBUGGER_AUTOMATION_TARGET_TAB_UNAVAILABLE' },
  );
  requireContentReady(await resolvedContentScriptOrchestrator.ensureContentScriptReady(
    request.targetTabId,
    {
      url: firstTab.url,
      reason: `runtime_debugger_automation:${request.action.toLowerCase()}`,
    },
  ));
  const currentTab = requireQaAutomationTargetWebTab(
    await resolvedBrowserPort.tabsGet(request.targetTabId),
    request.targetTabId,
    { errorCode: 'RUNTIME_DEBUGGER_AUTOMATION_TARGET_TAB_UNAVAILABLE' },
  );
  if (currentTab.url !== firstTab.url) {
    throw new Error('RUNTIME_DEBUGGER_AUTOMATION_TARGET_TAB_NAVIGATED');
  }

  const contentRequest = createRuntimeDebuggerAutomationContentRequest(request);
  const delivery = await resolvedBrowserPort.tabsSendMessage(
    request.targetTabId,
    contentRequest,
    { frameId: 0 },
  );
  if (delivery?.error) {
    throw new Error('RUNTIME_DEBUGGER_AUTOMATION_CONTENT_DELIVERY_FAILED');
  }
  return requireRuntimeDebuggerAutomationResponse(delivery?.response, contentRequest);
}

export function createRuntimeDebuggerAutomationMessageRoutes({
  browserPort,
  contentScriptOrchestrator,
} = {}) {
  const actions = Object.create(null);

  ACTION_VALUES.forEach((action) => {
    actions[action] = (message, sender, sendResponse) => {
      void relayRuntimeDebuggerAutomationRequest({
        message,
        sender,
        browserPort,
        contentScriptOrchestrator,
      }).then(
        (response) => sendResponse?.(response),
        (error) => {
          let response;
          try {
            response = createRuntimeDebuggerAutomationResponse(message, {
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

export function createBuildCapabilityMessageRoutes(dependencies) {
  return createRuntimeDebuggerAutomationMessageRoutes(dependencies);
}

export default createRuntimeDebuggerAutomationMessageRoutes;
