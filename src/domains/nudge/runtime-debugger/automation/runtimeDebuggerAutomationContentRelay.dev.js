import {
  isTrustedExtensionBackgroundSender,
} from '../../../../platform/security/senderTrust.js';
import {
  RUNTIME_DEBUGGER_AUTOMATION_ACTIONS,
  createRuntimeDebuggerAutomationResponse,
  isRuntimeDebuggerAutomationAction,
  parseRuntimeDebuggerAutomationRequest,
} from './runtimeDebuggerAutomationContract.dev.js';

let runtimeDebuggerModulePromise = null;

function loadRuntimeDebuggerModule() {
  runtimeDebuggerModulePromise ||= import('@runtime-debugger');
  return runtimeDebuggerModulePromise;
}

function resolveFailureCode(error, fallback = 'RUNTIME_DEBUGGER_AUTOMATION_CONTENT_FAILED') {
  const code = typeof error?.code === 'string' && error.code.trim()
    ? error.code.trim()
    : typeof error?.message === 'string' && error.message.trim()
      ? error.message.trim()
      : fallback;
  return /^[A-Z0-9_:.-]{1,160}$/.test(code) ? code : fallback;
}

function requireRuntimeOwner(module) {
  const runtime = module?.default;
  const requiredMethods = [
    'startAutomationSession',
    'resetAutomationSession',
    'snapshotAutomationSession',
    'projectRuntimeContentionWindowAutomation',
    'reportAutomationSession',
    'setTerminusDryRunAutomation',
    'controlFeedHorizonInspectionAutomation',
    'setFeedConsumptionResearchAutomation',
    'forceEnsoGateAutomation',
    'dismissEnsoGateAutomation',
    'stopAutomationSession',
  ];
  if (!runtime || requiredMethods.some((methodName) => typeof runtime[methodName] !== 'function')) {
    throw new Error('RUNTIME_DEBUGGER_AUTOMATION_OWNER_INVALID');
  }
  return runtime;
}

async function dispatchRuntimeDebuggerAutomationAction(request, loadRuntimeDebugger) {
  const runtime = requireRuntimeOwner(await loadRuntimeDebugger());
  if (request.action === RUNTIME_DEBUGGER_AUTOMATION_ACTIONS.START) {
    return runtime.startAutomationSession({ captureKind: request.payload.captureKind });
  }
  if (request.action === RUNTIME_DEBUGGER_AUTOMATION_ACTIONS.RESET) {
    return runtime.resetAutomationSession();
  }
  if (request.action === RUNTIME_DEBUGGER_AUTOMATION_ACTIONS.SNAPSHOT) {
    return runtime.snapshotAutomationSession();
  }
  if (request.action === RUNTIME_DEBUGGER_AUTOMATION_ACTIONS.PROJECT_CONTENTION_WINDOW) {
    return runtime.projectRuntimeContentionWindowAutomation(request.payload);
  }
  if (request.action === RUNTIME_DEBUGGER_AUTOMATION_ACTIONS.REPORT) {
    return runtime.reportAutomationSession();
  }
  if (request.action === RUNTIME_DEBUGGER_AUTOMATION_ACTIONS.SET_TERMINUS_DRY_RUN) {
    return runtime.setTerminusDryRunAutomation({
      enabled: request.payload.enabled,
    });
  }
  if (
    request.action
    === RUNTIME_DEBUGGER_AUTOMATION_ACTIONS.CONTROL_FEED_HORIZON_INSPECTION
  ) {
    return runtime.controlFeedHorizonInspectionAutomation(request.payload);
  }
  if (
    request.action
    === RUNTIME_DEBUGGER_AUTOMATION_ACTIONS.SET_FEED_CONSUMPTION_RESEARCH
  ) {
    return runtime.setFeedConsumptionResearchAutomation(request.payload);
  }
  if (request.action === RUNTIME_DEBUGGER_AUTOMATION_ACTIONS.FORCE_ENSO_GATE) {
    return runtime.forceEnsoGateAutomation(request.payload);
  }
  if (request.action === RUNTIME_DEBUGGER_AUTOMATION_ACTIONS.DISMISS_ENSO_GATE) {
    return runtime.dismissEnsoGateAutomation();
  }
  if (request.action === RUNTIME_DEBUGGER_AUTOMATION_ACTIONS.STOP) {
    return runtime.stopAutomationSession();
  }
  throw new Error('RUNTIME_DEBUGGER_AUTOMATION_ACTION_INVALID');
}

export function createRuntimeDebuggerAutomationContentRelay({
  loadRuntimeDebugger = loadRuntimeDebuggerModule,
} = {}) {
  if (typeof loadRuntimeDebugger !== 'function') {
    throw new Error('RUNTIME_DEBUGGER_AUTOMATION_LOADER_REQUIRED');
  }

  return function handleRuntimeDebuggerAutomationContentMessage(
    message,
    sender,
    sendResponse,
  ) {
    if (!isRuntimeDebuggerAutomationAction(message?.action)) return false;

    let request;
    try {
      request = parseRuntimeDebuggerAutomationRequest(message, {
        requireBackgroundRelay: true,
      });
      if (!isTrustedExtensionBackgroundSender(sender)) {
        throw new Error('RUNTIME_DEBUGGER_AUTOMATION_BACKGROUND_SENDER_UNTRUSTED');
      }
    } catch (error) {
      const fallbackRequest = {
        channel: message?.channel,
        action: message?.action,
        requestId: message?.requestId,
        targetTabId: message?.targetTabId,
        payload: message?.payload,
        relay: 'background',
      };
      try {
        sendResponse?.(createRuntimeDebuggerAutomationResponse(fallbackRequest, {
          success: false,
          error: resolveFailureCode(error),
        }));
      } catch (_responseError) {
        sendResponse?.({
          success: false,
          error: resolveFailureCode(error),
        });
      }
      return false;
    }

    void dispatchRuntimeDebuggerAutomationAction(request, loadRuntimeDebugger)
      .then((result) => {
        sendResponse?.(createRuntimeDebuggerAutomationResponse(request, {
          success: true,
          result,
        }));
      })
      .catch((error) => {
        sendResponse?.(createRuntimeDebuggerAutomationResponse(request, {
          success: false,
          error: resolveFailureCode(error),
        }));
      });
    return true;
  };
}

export const handleRuntimeDebuggerAutomationContentMessage = (
  createRuntimeDebuggerAutomationContentRelay()
);

export const handleBuildCapabilityContentMessage = (
  handleRuntimeDebuggerAutomationContentMessage
);

export default handleRuntimeDebuggerAutomationContentMessage;
