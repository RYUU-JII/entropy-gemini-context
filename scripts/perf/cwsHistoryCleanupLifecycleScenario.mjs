import fs from 'node:fs/promises';
import path from 'node:path';
import { MESSAGE_ACTIONS } from '../../src/platform/messaging/messageTypes.js';
import { STORAGE_SESSION_KEYS } from '../../src/platform/storage/runtime/RuntimeSessionRepository.js';

const CONTROLLER_NAME = 'Entropy MV3 Lifecycle Controller';

function requireScenarioFunction(value, code) {
  if (typeof value !== 'function') throw new Error(code);
  return value;
}

export async function prepareCwsHistoryCleanupControllerExtension({ tempRoot } = {}) {
  if (typeof tempRoot !== 'string' || !tempRoot.trim()) {
    throw new Error('MV3_HISTORY_CONTROLLER_TEMP_ROOT_REQUIRED');
  }
  const extensionDir = path.join(tempRoot, 'lifecycle-controller-extension');
  await fs.mkdir(extensionDir, { recursive: true });
  await fs.writeFile(path.join(extensionDir, 'manifest.json'), `${JSON.stringify({
    manifest_version: 3,
    name: CONTROLLER_NAME,
    version: '1.0.0',
    permissions: ['history', 'management'],
  }, null, 2)}\n`);
  await fs.writeFile(
    path.join(extensionDir, 'controller.html'),
    '<!doctype html><meta charset="utf-8"><title>Entropy MV3 Lifecycle Controller</title>',
  );
  return extensionDir;
}

export async function runCwsHistoryCleanupLifecycleScenario({
  extensionId,
  controllerExtensionId,
  pageSessionId,
  probeUrl,
  withExtensionPage,
  evaluate,
  sendExtensionMessage,
  openOwnedTarget,
  closeOwnedTarget,
  navigateOwnedTarget,
  sendCdp,
  getExtensionWorkerTarget,
  sleep,
  serviceWorkerDiagnostics,
  prepareSecurityVault,
} = {}) {
  if (typeof extensionId !== 'string' || !extensionId) {
    throw new Error('MV3_HISTORY_SCENARIO_EXTENSION_ID_REQUIRED');
  }
  if (typeof controllerExtensionId !== 'string' || !controllerExtensionId) {
    throw new Error('MV3_HISTORY_SCENARIO_CONTROLLER_ID_REQUIRED');
  }
  if (
    !Number.isSafeInteger(Number(pageSessionId))
    && !(typeof pageSessionId === 'string' && pageSessionId)
  ) {
    throw new Error('MV3_HISTORY_SCENARIO_PAGE_SESSION_REQUIRED');
  }
  if (typeof probeUrl !== 'string' || !probeUrl.startsWith('http://')) {
    throw new Error('MV3_HISTORY_SCENARIO_PROBE_URL_REQUIRED');
  }
  [
    ['withExtensionPage', withExtensionPage],
    ['evaluate', evaluate],
    ['sendExtensionMessage', sendExtensionMessage],
    ['openOwnedTarget', openOwnedTarget],
    ['closeOwnedTarget', closeOwnedTarget],
    ['navigateOwnedTarget', navigateOwnedTarget],
    ['sendCdp', sendCdp],
    ['getExtensionWorkerTarget', getExtensionWorkerTarget],
    ['sleep', sleep],
    ['prepareSecurityVault', prepareSecurityVault],
  ].forEach(([name, value]) => requireScenarioFunction(
    value,
    `MV3_HISTORY_SCENARIO_${name.toUpperCase()}_REQUIRED`,
  ));
  if (!serviceWorkerDiagnostics?.snapshot) {
    throw new Error('MV3_HISTORY_SCENARIO_WORKER_DIAGNOSTICS_REQUIRED');
  }

  const settingsResponse = await withExtensionPage((sessionId) => sendExtensionMessage(
    sessionId,
    {
      action: MESSAGE_ACTIONS.SET_SETTINGS,
      items: { historyCleanupForBlocked: true },
      waitForPropagation: true,
    },
  ));
  if (!settingsResponse?.success || settingsResponse?.propagation?.status !== 'succeeded') {
    throw new Error(`MV3_HISTORY_CLEANUP_ENABLE_FAILED:${JSON.stringify(settingsResponse)}`);
  }

  const sentinel = await withExtensionPage((sessionId) => evaluate(
    sessionId,
    `new Promise((resolve) => {
      chrome.storage.session.set({
        [${JSON.stringify(STORAGE_SESSION_KEYS.HISTORY_CLEANUP_ACTIVATION)}]: {
          schemaVersion: 999,
          state: 'qa_reload_sentinel',
        },
      }, () => resolve({
        stored: !chrome.runtime.lastError,
        error: chrome.runtime.lastError && chrome.runtime.lastError.message,
      }));
    })`,
  ));
  if (sentinel?.stored !== true || sentinel?.error) {
    throw new Error(`MV3_HISTORY_ACTIVATION_SENTINEL_WRITE_FAILED:${JSON.stringify(sentinel)}`);
  }

  const controller = await openOwnedTarget(
    `chrome-extension://${controllerExtensionId}/controller.html`,
    { extensionApiProfile: 'history_controller' },
  );
  const workerBeforeReload = await getExtensionWorkerTarget();
  const setEnabled = (enabled) => evaluate(
    controller.sessionId,
    `new Promise((resolve) => {
      chrome.management.setEnabled(${JSON.stringify(extensionId)}, ${enabled === true}, () => {
        const error = chrome.runtime.lastError && chrome.runtime.lastError.message;
        chrome.management.get(${JSON.stringify(extensionId)}, (extension) => resolve({
          requestedEnabled: ${enabled === true},
          enabled: extension && extension.enabled,
          error: error || (chrome.runtime.lastError && chrome.runtime.lastError.message),
        }));
      });
    })`,
    { userGesture: true },
  );
  const readVisits = (targetUrl) => evaluate(
    controller.sessionId,
    `new Promise((resolve) => {
      chrome.history.getVisits({ url: ${JSON.stringify(targetUrl)} }, (items) => resolve({
        items: Array.isArray(items) ? items : [],
        error: chrome.runtime.lastError && chrome.runtime.lastError.message,
      }));
    })`,
  );

  try {
    const disableReceipt = await setEnabled(false);
    if (disableReceipt?.enabled !== false || disableReceipt?.error) {
      throw new Error(`MV3_HISTORY_EXTENSION_DISABLE_FAILED:${JSON.stringify(disableReceipt)}`);
    }
    const disabledDeadline = Date.now() + 8_000;
    while (await getExtensionWorkerTarget()) {
      if (Date.now() >= disabledDeadline) {
        throw new Error('MV3_HISTORY_EXTENSION_DISABLE_WORKER_STILL_ACTIVE');
      }
      await sleep(100);
    }

    const targetUrl = `${probeUrl}?history-disabled-gap=${Date.now()}`;
    await navigateOwnedTarget(pageSessionId, targetUrl);
    const navigationHistory = await sendCdp('Page.getNavigationHistory', {}, pageSessionId);
    if (!navigationHistory?.entries?.some((entry) => entry?.url === targetUrl)) {
      throw new Error(`MV3_HISTORY_NAVIGATION_NOT_RECORDED:${JSON.stringify(navigationHistory)}`);
    }
    const visitsWhileDisabled = await readVisits(targetUrl);
    if (visitsWhileDisabled?.error || visitsWhileDisabled?.items?.length < 1) {
      throw new Error(`MV3_HISTORY_DISABLED_VISIT_MISSING:${JSON.stringify(visitsWhileDisabled)}`);
    }

    const enableReceipt = await setEnabled(true);
    if (enableReceipt?.enabled !== true || enableReceipt?.error) {
      throw new Error(`MV3_HISTORY_EXTENSION_REENABLE_FAILED:${JSON.stringify(enableReceipt)}`);
    }
    const securityVault = await prepareSecurityVault('unlock');
    const localReady = securityVault?.mode === 'local' && securityVault.operation === 'already_unlocked';
    const passphraseReady = securityVault?.mode === 'passphrase' && securityVault.operation === 'unlock';
    if (securityVault?.state !== 'unlocked' || securityVault.version !== 1 || (!localReady && !passphraseReady)) {
      throw new Error('MV3_HISTORY_REENABLE_VAULT_READINESS_REQUIRED');
    }
    const wakeResponse = await withExtensionPage((sessionId) => sendExtensionMessage(
      sessionId,
      {
        action: MESSAGE_ACTIONS.GET_SETTINGS,
        defaults: { historyCleanupForBlocked: false },
        keys: ['historyCleanupForBlocked'],
      },
    ));
    if (!wakeResponse?.success || wakeResponse?.settings?.historyCleanupForBlocked !== true) {
      throw new Error(`MV3_HISTORY_REENABLE_WAKE_FAILED:${JSON.stringify(wakeResponse)}`);
    }

    const finalState = await withExtensionPage(async (sessionId) => {
      const deadline = Date.now() + 12_000;
      let state = null;
      while (Date.now() < deadline) {
        const checkpoint = await evaluate(sessionId, `new Promise((resolve) => {
          const key = ${JSON.stringify(STORAGE_SESSION_KEYS.HISTORY_CLEANUP_ACTIVATION)};
          chrome.storage.session.get([key], (result) => resolve({
            value: result && result[key],
            error: chrome.runtime.lastError && chrome.runtime.lastError.message,
          }));
        })`);
        const visits = await readVisits(targetUrl);
        state = {
          checkpoint,
          visitCount: Array.isArray(visits?.items) ? visits.items.length : null,
          visitsError: visits?.error || null,
        };
        if (
          checkpoint?.value?.schemaVersion === 1
          && checkpoint?.value?.state === 'completed'
          && state.visitCount === 0
          && !state.visitsError
        ) return state;
        await sleep(100);
      }
      throw new Error(`MV3_HISTORY_CLEANUP_STATE_TIMEOUT:${JSON.stringify(state)}`);
    });

    const workerAfterReload = await getExtensionWorkerTarget();
    if (
      workerBeforeReload?.targetId
      && workerAfterReload?.targetId === workerBeforeReload.targetId
    ) {
      throw new Error(`MV3_HISTORY_EXTENSION_WORKER_NOT_REPLACED:${workerBeforeReload.targetId}`);
    }
    return {
      targetUrl,
      navigationHistoryEntryCount: navigationHistory.entries.length,
      settingsPropagation: settingsResponse.propagation,
      sentinel,
      disableReceipt,
      visitsWhileDisabled: visitsWhileDisabled.items.length,
      reactivation: {
        enableReceipt,
        securityVault,
        workerBeforeTargetId: workerBeforeReload?.targetId || null,
        workerAfterTargetId: workerAfterReload?.targetId || null,
        wakeResponse,
      },
      finalState,
      workerDiagnostics: await serviceWorkerDiagnostics.snapshot(
        workerAfterReload?.targetId,
      ),
    };
  } finally {
    await closeOwnedTarget(controller.targetId);
  }
}
