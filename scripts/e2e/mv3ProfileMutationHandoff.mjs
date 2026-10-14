import { normalizeProfileMutationResponseHandoff } from '../../src/platform/messaging/contracts/profileMutationResponseHandoff.js';

export async function completeMv3ProfileMutationHandoff(harness, response, { wakeRuntime } = {}) {
  if (typeof wakeRuntime !== 'function') throw new Error('MV3_PROFILE_MUTATION_WAKE_READER_REQUIRED');
  if (response?.success !== true) throw new Error('MV3_PROFILE_MUTATION_SUCCESS_REQUIRED');
  const handoff = normalizeProfileMutationResponseHandoff(response.profileMutationHandoff);
  const previousWorker = await harness.getServiceWorker();
  if (!previousWorker?.targetId) throw new Error('MV3_PROFILE_MUTATION_PRIOR_WORKER_REQUIRED');
  const dashboard = await harness.openPage(
    `chrome-extension://${harness.extensionId}/src/pages/dashboard.html`,
  );
  try {
    // Retire the auxiliary context before ACK can invalidate extension pages.
    await harness.releaseTrustedPage();
    const result = await harness.cdp.send('Runtime.evaluate', {
      expression: `(() => {
        if (location.pathname !== '/src/pages/dashboard.html') throw new Error('MV3_PROFILE_MUTATION_DASHBOARD_REQUIRED');
        const task = chrome.runtime.sendMessage(${JSON.stringify({
          action: 'PROFILE_MUTATION_RESPONSE_ACK', profileMutationHandoff: handoff,
        })});
        if (!task || typeof task.then !== 'function') throw new Error('MV3_PROFILE_MUTATION_ACK_START_FAILED');
        // The product reload may invalidate the ACK return channel. A different
        // worker plus the following canonical read are the completion proof.
        void task.catch(() => undefined);
        return { started: true };
      })()`,
      returnByValue: true,
    }, dashboard.sessionId);
    if (result.exceptionDetails || result.result?.value?.started !== true) {
      throw new Error('MV3_PROFILE_MUTATION_ACK_START_FAILED');
    }
    await harness.waitForServiceWorkerExit({ targetId: previousWorker.targetId });
    await harness.waitForExtensionActive();
    const value = await wakeRuntime();
    const revivedWorker = await harness.waitForServiceWorker({ previousTargetId: previousWorker.targetId });
    return {
      value,
      operation: handoff.operation,
      ackStarted: true,
      previousTargetId: previousWorker.targetId,
      revivedTargetId: revivedWorker.targetId,
    };
  } finally {
    // Chrome extension APIs can be unavailable during reload. The held CDP
    // target lease still owns this exact page and proves its absence directly.
    await harness.releasePageTarget(dashboard);
  }
}
