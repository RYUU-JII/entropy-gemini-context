import {
  GATE_QA_AUTOMATION_ACTIONS,
  createDetourSpreadQaRuntimeSnapshot,
  createEntryCheckpointQaRuntimeSnapshot,
  createGateQaAutomationResponse,
  parseGateQaAutomationRequest,
} from '../../../../../domains/protection/background/automation/gateQaAutomationContract.dev.js';
import { getInterventionAdmissionService } from '../../../../../domains/protection/background/runtime/InterventionAdmissionService.js';
import {
  assertTrustedQaAutomationHarnessSender,
  requireQaAutomationTargetWebTab,
} from '../../../../../platform/security/qaAutomationHarnessTrust.dev.js';

function requireGateController(gateInterstitialController) {
  if (
    typeof gateInterstitialController?.presentForRuntimeSnapshot !== 'function'
    || typeof gateInterstitialController?.readTabSession !== 'function'
    || typeof gateInterstitialController?.removeTabSession !== 'function'
    || typeof gateInterstitialController?.isGatePageUrl !== 'function'
  ) {
    throw new Error('GATE_QA_AUTOMATION_CONTROLLER_REQUIRED');
  }
  return gateInterstitialController;
}

function requireBrowserPort(browserPort) {
  if (
    typeof browserPort?.getRuntimeId !== 'function'
    || typeof browserPort?.tabsGet !== 'function'
  ) {
    throw new Error('GATE_QA_AUTOMATION_BROWSER_PORT_REQUIRED');
  }
  return browserPort;
}

function resolveFailureCode(error) {
  const candidate = typeof error?.code === 'string' && error.code.trim()
    ? error.code.trim()
    : typeof error?.message === 'string' && error.message.trim()
      ? error.message.trim()
      : 'GATE_QA_AUTOMATION_FAILED';
  return /^[A-Z0-9_:.-]{1,160}$/u.test(candidate)
    ? candidate
    : 'GATE_QA_AUTOMATION_FAILED';
}

function requireCommittedGateSession(
  committedSession,
  presentation,
  targetTabId,
  expectedGateKind,
) {
  if (!committedSession) {
    throw new Error('GATE_QA_AUTOMATION_SESSION_COMMIT_MISSING');
  }
  if (committedSession.sessionId !== presentation.sessionId) {
    throw new Error('GATE_QA_AUTOMATION_SESSION_COMMIT_ID_MISMATCH');
  }
  if (committedSession.tabId !== targetTabId) {
    throw new Error('GATE_QA_AUTOMATION_SESSION_COMMIT_TAB_MISMATCH');
  }
  if (committedSession.gateKind !== expectedGateKind) {
    throw new Error('GATE_QA_AUTOMATION_SESSION_COMMIT_KIND_MISMATCH');
  }
  if (committedSession.status !== 'pending') {
    throw new Error('GATE_QA_AUTOMATION_SESSION_COMMIT_STATUS_MISMATCH');
  }
  return committedSession;
}

function requireGateQaAdmission(presentation) {
  const refusal = presentation?.handled === false && typeof presentation.reason === 'string'
    ? /^admission:([a-z_]+)$/u.exec(presentation.reason) : null;
  if (refusal) throw new Error(`GATE_QA_AUTOMATION_ADMISSION_${refusal[1].toUpperCase()}`);
}

function resolveProtectedTabHostname(url) {
  try {
    return new URL(url).hostname.trim().toLowerCase();
  } catch (_error) {
    return '';
  }
}

function createResolvedProtectedTab(tab) {
  const protectedTab = {
    tabId: Number(tab.id),
    hostname: resolveProtectedTabHostname(tab.url),
    url: tab.url,
    title: typeof tab.title === 'string' ? tab.title : '',
    favIconUrl: typeof tab.favIconUrl === 'string' ? tab.favIconUrl : '',
    active: tab.active === true,
  };
  if (Number.isSafeInteger(Number(tab.windowId)) && Number(tab.windowId) >= 0) {
    protectedTab.windowId = Number(tab.windowId);
  }
  if (Number.isSafeInteger(Number(tab.index)) && Number(tab.index) >= 0) {
    protectedTab.index = Number(tab.index);
  }
  if (Number.isSafeInteger(Number(tab.openerTabId)) && Number(tab.openerTabId) >= 0) {
    protectedTab.openerTabId = Number(tab.openerTabId);
  }
  return Object.freeze(protectedTab);
}

async function resolveExactProtectedTabs(browserPort, declaredProtectedTabs) {
  return Promise.all(declaredProtectedTabs.map(async (declaredTab) => {
    const tab = requireQaAutomationTargetWebTab(
      await browserPort.tabsGet(declaredTab.tabId),
      declaredTab.tabId,
      { errorCode: 'GATE_QA_AUTOMATION_PROTECTED_TAB_UNAVAILABLE' },
    );
    if (tab.url !== declaredTab.url) {
      throw new Error('GATE_QA_AUTOMATION_PROTECTED_TAB_URL_MISMATCH');
    }
    const resolvedTab = createResolvedProtectedTab(tab);
    if (!resolvedTab.hostname) {
      throw new Error('GATE_QA_AUTOMATION_PROTECTED_TAB_HOST_INVALID');
    }
    return resolvedTab;
  }));
}

function requireDetourPresentation(presentation) {
  requireGateQaAdmission(presentation);
  if (presentation?.handled !== true || presentation.reason !== 'redirected'
    || presentation.documentDisposition !== 'redirected'
    || typeof presentation.sessionId !== 'string' || !presentation.sessionId
    || presentation.message != null || presentation.presentationTransaction != null) {
    throw new Error('GATE_QA_AUTOMATION_DETOUR_PRESENTATION_INVALID');
  }
  return presentation;
}

function requireCommittedDetourSession(
  committedSession,
  presentation,
  request,
  resolvedProtectedTabs,
) {
  const session = requireCommittedGateSession(
    committedSession,
    presentation,
    request.targetTabId,
    'detourSpreadGuard',
  );
  const committedProtectedTabs = Array.isArray(session.protectedTabs)
    ? session.protectedTabs
    : [];
  if (
    session.originalUrl !== request.payload.protectedTabs.find(
      (entry) => entry.tabId === request.targetTabId,
    )?.url
    || session.metrics?.maxProtectedTabs !== request.payload.maxProtectedTabs
    || session.metrics?.protectedTabThreshold !== request.payload.maxProtectedTabs + 1
    || committedProtectedTabs.length !== resolvedProtectedTabs.length
    || resolvedProtectedTabs.some((expectedTab) => {
      const committedTab = committedProtectedTabs.find(
        (entry) => Number(entry?.tabId) === expectedTab.tabId,
      );
      return !committedTab || committedTab.url !== expectedTab.url;
    })
  ) {
    throw new Error('GATE_QA_AUTOMATION_DETOUR_SESSION_COMMIT_MISMATCH');
  }
  return session;
}

function createGateQaMutationFence(targetTabId, targetUrl) {
  let open = true;
  return Object.freeze({
    close() { open = false; },
    fence: Object.freeze({
      assertCurrent: (phase) => {
        if (!open || typeof phase !== 'string' || !phase) {
          throw new Error('GATE_QA_AUTOMATION_MUTATION_FENCE_CLOSED');
        }
        if (!Number.isSafeInteger(targetTabId) || typeof targetUrl !== 'string' || !targetUrl) {
          throw new Error('GATE_QA_AUTOMATION_MUTATION_FENCE_INVALID');
        }
      },
    }),
  });
}

async function executeGateQaAutomationRequest({
  message,
  sender,
  browserPort,
  gateInterstitialController,
  readConsumptionQaSnapshot,
  releaseGateEntryApprovalForQa,
}) {
  const resolvedBrowserPort = requireBrowserPort(browserPort);
  const controller = requireGateController(gateInterstitialController);
  assertTrustedQaAutomationHarnessSender(sender, resolvedBrowserPort, {
    errorCode: 'GATE_QA_AUTOMATION_HARNESS_SENDER_UNTRUSTED',
  });
  const request = parseGateQaAutomationRequest(message);
  if (request.action === GATE_QA_AUTOMATION_ACTIONS.RELEASE_ENTRY_APPROVAL) {
    if (typeof releaseGateEntryApprovalForQa !== 'function') throw new Error('GATE_QA_ENTRY_OWNER_REQUIRED');
    return releaseGateEntryApprovalForQa(request.payload);
  }
  if (request.action === GATE_QA_AUTOMATION_ACTIONS.READ_CONSUMPTION) {
    if (typeof readConsumptionQaSnapshot !== 'function') throw new Error('GATE_QA_CONSUMPTION_READER_REQUIRED');
    return readConsumptionQaSnapshot(request.targetTabId);
  }
  if (request.action === GATE_QA_AUTOMATION_ACTIONS.READ_EXPOSURE) {
    return getInterventionAdmissionService().readExposureSnapshot();
  }
  if (request.action === GATE_QA_AUTOMATION_ACTIONS.PRESENT_ENTRY_CHECKPOINT) {
    const tab = await resolvedBrowserPort.tabsGet(request.targetTabId);
    const webTab = requireQaAutomationTargetWebTab(tab, request.targetTabId, {
      errorCode: 'GATE_QA_AUTOMATION_TARGET_TAB_UNAVAILABLE',
    });
    const now = Date.now();
    const mutationFenceOwner = createGateQaMutationFence(request.targetTabId, webTab.url);
    let presentation;
    try {
      presentation = await controller.presentForRuntimeSnapshot({
        tabId: request.targetTabId,
        url: webTab.url,
        runtimeSnapshot: createEntryCheckpointQaRuntimeSnapshot({
          now,
          holdMs: request.payload.holdMs,
          intensity: request.payload.intensity,
          recentUse: request.payload.recentUse,
        }),
        now,
        mutationFence: mutationFenceOwner.fence,
      });
    } finally {
      mutationFenceOwner.close();
    }
    requireGateQaAdmission(presentation);
    if (
      presentation?.handled !== true
      || presentation?.reason !== 'redirected'
      || presentation?.documentDisposition !== 'redirected'
      || typeof presentation?.sessionId !== 'string'
      || !controller.isGatePageUrl(presentation?.gatePageUrl)
    ) {
      throw new Error('GATE_QA_AUTOMATION_PRESENTATION_INVALID');
    }
    const committedSession = requireCommittedGateSession(
      await controller.readTabSession(request.targetTabId),
      presentation,
      request.targetTabId,
      'entryCheckpoint',
    );
    return Object.freeze({
      handled: true,
      reason: presentation.reason,
      sessionId: presentation.sessionId,
      gatePageUrl: presentation.gatePageUrl,
      gateKind: 'entryCheckpoint',
      sessionCommit: Object.freeze({
        sessionId: committedSession.sessionId,
        tabId: committedSession.tabId,
        gateKind: committedSession.gateKind,
        status: committedSession.status,
      }),
    });
  }
  if (request.action === GATE_QA_AUTOMATION_ACTIONS.PRESENT_DETOUR_SPREAD) {
    const resolvedProtectedTabs = await resolveExactProtectedTabs(
      resolvedBrowserPort,
      request.payload.protectedTabs,
    );
    const targetTab = resolvedProtectedTabs.find(
      (entry) => entry.tabId === request.targetTabId,
    );
    if (!targetTab) {
      throw new Error('GATE_QA_AUTOMATION_TARGET_TAB_NOT_PROTECTED');
    }
    const now = Date.now();
    const mutationFenceOwner = createGateQaMutationFence(request.targetTabId, targetTab.url);
    let presentation;
    try {
      presentation = requireDetourPresentation(await controller.presentForRuntimeSnapshot({
        tabId: request.targetTabId,
        url: targetTab.url,
        runtimeSnapshot: createDetourSpreadQaRuntimeSnapshot({
          now, maxProtectedTabs: request.payload.maxProtectedTabs, protectedTabs: resolvedProtectedTabs,
        }),
        now, mutationFence: mutationFenceOwner.fence,
      }));
    } finally {
      mutationFenceOwner.close();
    }
    if (!controller.isGatePageUrl(presentation.gatePageUrl)) {
      throw new Error('GATE_QA_AUTOMATION_DETOUR_PRESENTATION_INVALID');
    }
    const committedSession = requireCommittedDetourSession(
      await controller.readTabSession(request.targetTabId), presentation, request, resolvedProtectedTabs,
    );
    return Object.freeze({
      handled: true, reason: presentation.reason, sessionId: presentation.sessionId,
      gatePageUrl: presentation.gatePageUrl, gateKind: 'detourSpreadGuard',
      maxProtectedTabs: request.payload.maxProtectedTabs,
      protectedTabs: Object.freeze(resolvedProtectedTabs.map(({ tabId, url }) => Object.freeze({ tabId, url }))),
      sessionCommit: Object.freeze({
        sessionId: committedSession.sessionId, tabId: committedSession.tabId,
        gateKind: committedSession.gateKind, status: committedSession.status,
      }),
    });
  }
  await controller.removeTabSession(request.targetTabId, {
    reason: 'qa_dismiss',
    observedAt: Date.now(),
  });
  return Object.freeze({
    dismissed: true,
    targetTabId: request.targetTabId,
  });
}

export function createGateQaAutomationMessageRoutes({
  browserPort,
  gateInterstitialController,
  readConsumptionQaSnapshot,
  releaseGateEntryApprovalForQa,
} = {}) {
  const actions = Object.create(null);
  Object.values(GATE_QA_AUTOMATION_ACTIONS).forEach((action) => {
    actions[action] = (message, sender, sendResponse) => {
      void executeGateQaAutomationRequest({
        message,
        sender,
        browserPort,
        gateInterstitialController,
        readConsumptionQaSnapshot,
        releaseGateEntryApprovalForQa,
      }).then(
        (result) => sendResponse?.(createGateQaAutomationResponse(message, {
          success: true,
          result,
        })),
        (error) => {
          let response;
          try {
            response = createGateQaAutomationResponse(message, {
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

export default createGateQaAutomationMessageRoutes;
