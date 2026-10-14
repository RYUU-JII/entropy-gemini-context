import {
  QA_SCENARIO_TAB_ACTIVATION_ACTION,
  createQaScenarioTabActivationResponse,
  parseQaScenarioTabActivationRequest,
} from '../../../../../platform/security/qaScenarioTabActivationContract.dev.js';
import {
  assertTrustedQaAutomationHarnessSender,
  requireQaAutomationTargetWebTab,
} from '../../../../../platform/security/qaAutomationHarnessTrust.dev.js';

const OWNERSHIP_POLL_ATTEMPTS = 40;
const OWNERSHIP_POLL_INTERVAL_MS = 50;

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function resolveFailureCode(error) {
  const candidate = typeof error?.code === 'string' && error.code.trim()
    ? error.code.trim()
    : typeof error?.message === 'string' && error.message.trim()
      ? error.message.trim()
      : 'QA_SCENARIO_TAB_ACTIVATION_FAILED';
  return /^[A-Z0-9_:.-]{1,160}$/u.test(candidate)
    ? candidate
    : 'QA_SCENARIO_TAB_ACTIVATION_FAILED';
}

function requireDependencies(browserPort, getTrackingRuntimeState) {
  if (
    typeof browserPort?.getRuntimeId !== 'function'
    || typeof browserPort?.tabsGet !== 'function'
    || typeof browserPort?.tabsUpdate !== 'function'
  ) {
    throw new Error('QA_SCENARIO_TAB_ACTIVATION_BROWSER_PORT_REQUIRED');
  }
  if (typeof getTrackingRuntimeState !== 'function') {
    throw new Error('QA_SCENARIO_TAB_ACTIVATION_TRACKING_OWNER_REQUIRED');
  }
  return { browserPort, getTrackingRuntimeState };
}

function requireHarnessTabId(sender) {
  const tabId = Number(sender?.tab?.id);
  if (!Number.isSafeInteger(tabId) || tabId < 0) {
    throw new Error('QA_SCENARIO_TAB_ACTIVATION_HARNESS_TAB_REQUIRED');
  }
  return tabId;
}

async function activateTab(browserPort, tabId, errorCode) {
  const update = await browserPort.tabsUpdate(tabId, { active: true });
  if (update?.error || update?.tab?.active !== true || update?.tab?.id !== tabId) {
    throw new Error(update?.error || errorCode);
  }
  return update.tab;
}

async function waitForTrackingOwnership(getTrackingRuntimeState, tabId) {
  let runtime = null;
  for (let attempt = 1; attempt <= OWNERSHIP_POLL_ATTEMPTS; attempt += 1) {
    runtime = getTrackingRuntimeState();
    if (runtime?.lastActiveTabId === tabId) {
      return { observed: true, runtime };
    }
    if (attempt < OWNERSHIP_POLL_ATTEMPTS) {
      await delay(OWNERSHIP_POLL_INTERVAL_MS);
    }
  }
  return { observed: false, runtime };
}

async function executeQaScenarioTabActivation({
  message,
  sender,
  browserPort,
  getTrackingRuntimeState,
}) {
  const dependencies = requireDependencies(browserPort, getTrackingRuntimeState);
  assertTrustedQaAutomationHarnessSender(sender, browserPort, {
    errorCode: 'QA_SCENARIO_TAB_ACTIVATION_HARNESS_SENDER_UNTRUSTED',
  });
  const request = parseQaScenarioTabActivationRequest(message);
  requireHarnessTabId(sender);
  const firstTargetTab = requireQaAutomationTargetWebTab(
    await browserPort.tabsGet(request.targetTabId),
    request.targetTabId,
    { errorCode: 'QA_SCENARIO_TAB_ACTIVATION_TARGET_TAB_UNAVAILABLE' },
  );

  const currentTargetTab = requireQaAutomationTargetWebTab(
    await browserPort.tabsGet(request.targetTabId),
    request.targetTabId,
    { errorCode: 'QA_SCENARIO_TAB_ACTIVATION_TARGET_TAB_UNAVAILABLE' },
  );
  if (currentTargetTab.url !== firstTargetTab.url) {
    throw new Error('QA_SCENARIO_TAB_ACTIVATION_TARGET_TAB_NAVIGATED');
  }

  const activeTarget = await activateTab(
    dependencies.browserPort,
    request.targetTabId,
    'QA_SCENARIO_TAB_ACTIVATION_TARGET_ACTIVATION_FAILED',
  );
  const ownership = await waitForTrackingOwnership(
    dependencies.getTrackingRuntimeState,
    request.targetTabId,
  );
  return Object.freeze({
    active: true,
    trackingObserved: ownership.observed,
    tabId: activeTarget.id,
    windowId: Number.isSafeInteger(activeTarget.windowId) ? activeTarget.windowId : null,
    focusedWindowId: Number.isSafeInteger(ownership.runtime?.focusedWindowId)
      ? ownership.runtime.focusedWindowId
      : null,
    lastActiveTabId: Number.isSafeInteger(ownership.runtime?.lastActiveTabId)
      ? ownership.runtime.lastActiveTabId
      : null,
    windowFocusRequested: false,
  });
}

export function createQaScenarioTabActivationMessageRoutes({
  browserPort,
  getTrackingRuntimeState,
} = {}) {
  return {
    actions: {
      [QA_SCENARIO_TAB_ACTIVATION_ACTION]: (message, sender, sendResponse) => {
        void executeQaScenarioTabActivation({
          message,
          sender,
          browserPort,
          getTrackingRuntimeState,
        }).then(
          (result) => sendResponse?.(createQaScenarioTabActivationResponse(message, {
            success: true,
            result,
          })),
          (error) => {
            let response;
            try {
              response = createQaScenarioTabActivationResponse(message, {
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
      },
    },
  };
}

export default createQaScenarioTabActivationMessageRoutes;
