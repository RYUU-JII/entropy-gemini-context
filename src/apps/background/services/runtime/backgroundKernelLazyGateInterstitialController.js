import { createGateInterstitialController } from '../../../../domains/protection/background/GateInterstitialController.js';

const GATE_PAGE_PATH = 'src/pages/gate.html';
const REQUIRED_INTERVENTION_STATS_RECORDER_METHODS = Object.freeze([
  'recordGateShown',
  'recordGateDecision',
  'recordGateReentry',
  'recordGateEscape',
]);

function normalizeUrl(url) {
  return typeof url === 'string' ? url.trim() : '';
}

function buildGatePageBaseUrl(browserPort) {
  return typeof browserPort?.runtimeGetURL === 'function'
    ? browserPort.runtimeGetURL(GATE_PAGE_PATH) || ''
    : '';
}

function isGatePageUrl(url, browserPort) {
  const normalizedUrl = normalizeUrl(url);
  const baseUrl = buildGatePageBaseUrl(browserPort);
  return !!normalizedUrl && !!baseUrl && normalizedUrl.startsWith(baseUrl);
}

function assertGateSessionRepository(repository) {
  if (
    !repository
    || typeof repository.getSession !== 'function'
    || typeof repository.getSessionByTabId !== 'function'
    || typeof repository.upsertSession !== 'function'
    || typeof repository.updateSession !== 'function'
    || typeof repository.removeSession !== 'function'
    || typeof repository.removeTabSession !== 'function'
  ) {
    throw new Error('GATE_INTERSTITIAL_SESSION_REPOSITORY_REQUIRED');
  }
}

function assertGateBrowserPort(browserPort) {
  if (
    typeof browserPort?.runtimeGetURL !== 'function'
    || typeof browserPort?.tabsUpdate !== 'function'
  ) {
    throw new Error('GATE_INTERSTITIAL_BROWSER_PORT_REQUIRED');
  }
}

function assertGateOwnerFunction(fn, errorCode) {
  if (typeof fn !== 'function') {
    throw new Error(errorCode);
  }
}

function assertInterventionLedger(interventionLedger) {
  if (typeof interventionLedger?.recordDetached !== 'function') {
    throw new Error('GATE_INTERSTITIAL_INTERVENTION_LEDGER_REQUIRED');
  }
}

function assertInterventionStatsRecorder(interventionStatsRecorder) {
  const missingMethod = REQUIRED_INTERVENTION_STATS_RECORDER_METHODS
    .find((method) => typeof interventionStatsRecorder?.[method] !== 'function');
  if (missingMethod) {
    throw new Error(`GATE_INTERSTITIAL_STATS_RECORDER_METHOD_REQUIRED:${missingMethod}`);
  }
}

export function createLazyBackgroundGateInterstitialController({
  gateInterventionSessionRepository,
  interventionLedger,
  applyGateInterventionDecision,
  recordGateInterventionShown,
  interventionStatsRecorder,
  recordDiagnostic,
  runProfileMutationAdmittedTask,
  requestTabClosure,
  browserPort,
  readProtectedTabInventory,
} = {}) {
  assertGateSessionRepository(gateInterventionSessionRepository);
  assertInterventionLedger(interventionLedger);
  assertGateBrowserPort(browserPort);
  assertGateOwnerFunction(
    applyGateInterventionDecision,
    'GATE_INTERSTITIAL_DECISION_HANDLER_REQUIRED',
  );
  assertGateOwnerFunction(
    recordGateInterventionShown,
    'GATE_INTERSTITIAL_SHOWN_RECORDER_REQUIRED',
  );
  assertGateOwnerFunction(
    recordDiagnostic,
    'GATE_INTERSTITIAL_DIAGNOSTICS_REQUIRED',
  );
  assertGateOwnerFunction(
    runProfileMutationAdmittedTask,
    'GATE_INTERSTITIAL_PROFILE_MUTATION_RUNTIME_TASK_OWNER_REQUIRED',
  );
  assertGateOwnerFunction(
    requestTabClosure,
    'GATE_INTERSTITIAL_TAB_CLOSURE_ARBITER_REQUIRED',
  );
  assertInterventionStatsRecorder(interventionStatsRecorder);

  let controllerPromise = null;
  let controllerInstance = null;

  function loadController() {
    if (controllerInstance) return Promise.resolve(controllerInstance);
    controllerPromise ||= Promise.resolve()
      .then(() => {
        controllerInstance = createGateInterstitialController({
          gateInterventionSessionRepository,
          interventionLedger,
          applyGateInterventionDecision,
          recordGateInterventionShown,
          interventionStatsRecorder,
          recordDiagnostic,
          runProfileMutationAdmittedTask,
          requestTabClosure,
          browserPort,
          readProtectedTabInventory,
        });
        return controllerInstance;
      })
      .catch((error) => {
        controllerPromise = null;
        console.error('[BackgroundKernelGateInterstitialController] Failed to load controller.', error);
        throw error;
      });
    return controllerPromise;
  }

  return {
    async refreshDetourSessions(...args) {
      return (await loadController()).refreshDetourSessions(...args);
    },
    async recordPresented(...args) {
      return (await loadController()).recordPresented(...args);
    },
    async preparePresented(...args) {
      return (await loadController()).preparePresented(...args);
    },
    async getGateInterstitialSession(...args) {
      return (await loadController()).getGateInterstitialSession(...args);
    },
    async closeGateInterstitialProtectedTab(...args) {
      return (await loadController()).closeGateInterstitialProtectedTab(...args);
    },
    async releaseIsolationSessions(...args) {
      return (await loadController()).releaseIsolationSessions(...args);
    },
    async handleTabNavigation(...args) {
      return (await loadController()).handleTabNavigation(...args);
    },
    isGatePageUrl: (url) => isGatePageUrl(url, browserPort),
    async presentForRuntimeSnapshot(...args) {
      return (await loadController()).presentForRuntimeSnapshot(...args);
    },
    readTabSession(tabId) {
      return gateInterventionSessionRepository.getSessionByTabId(tabId);
    },
    async removeTabSession(tabId, context = {}) {
      if (controllerInstance) {
        return controllerInstance.removeTabSession(tabId, context);
      }
      const session = await gateInterventionSessionRepository.getSessionByTabId(tabId);
      recordDiagnostic('gate_interstitial_external_removal_requested', {
        sessionId: session?.sessionId || '',
        tabId,
        reason: context?.reason || 'external',
        observedAt: context?.observedAt ?? Date.now(),
        sessionIssuedAt: session?.issuedAt ?? null,
        presentationActive: false,
        controllerLoaded: controllerInstance !== null,
      });
      return gateInterventionSessionRepository.removeTabSession(tabId);
    },
    async submitGateInterstitialDecision(...args) {
      return (await loadController()).submitGateInterstitialDecision(...args);
    },
  };
}
