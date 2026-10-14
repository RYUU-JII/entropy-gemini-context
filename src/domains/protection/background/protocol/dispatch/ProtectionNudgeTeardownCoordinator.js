import { requireGoalEpisodeBinding } from '../../../../nudge/runtime/goalEpisodeBinding.js';

function requireFunction(fn, errorCode) {
  if (typeof fn !== 'function') throw new Error(errorCode);
  return fn;
}

function requireTabId(tabId) {
  if (!Number.isInteger(tabId) || tabId < 0) {
    throw new Error('PROTECTION_NUDGE_TEARDOWN_TAB_ID_INVALID');
  }
  return tabId;
}

export function createProtectionNudgeTeardownCoordinator({
  sendStopToTab,
  abortNudgesForTab,
  scheduleTerminalEffects,
  readActiveOwner,
} = {}) {
  const sendStop = requireFunction(
    sendStopToTab,
    'PROTECTION_NUDGE_TEARDOWN_STOP_OWNER_REQUIRED',
  );
  const terminalizeTab = requireFunction(
    abortNudgesForTab,
    'PROTECTION_NUDGE_TEARDOWN_SESSION_OWNER_REQUIRED',
  );
  const scheduleEffects = requireFunction(
    scheduleTerminalEffects,
    'PROTECTION_NUDGE_TEARDOWN_EFFECT_SCHEDULER_REQUIRED',
  );

  async function terminalizeSession(tabId, { reason, now, runIds = null, mutationFence = null }) {
    const terminalization = await terminalizeTab(tabId, { reason, now, ...(runIds === null ? {} : { runIds }),
      ...(mutationFence === null ? {} : { mutationFence }) });
    if (
      terminalization?.terminalEffectsPending === true
      || Number(terminalization?.outboxEnqueuedCount) > 0
    ) {
      const receipt = scheduleEffects({
        tabId,
        reason,
        outboxEnqueuedCount: terminalization.outboxEnqueuedCount,
        pendingOutboxCount: terminalization.pendingOutboxCount,
      });
      if (receipt?.status !== 'scheduled') {
        throw new Error('PROTECTION_NUDGE_TEARDOWN_EFFECT_SCHEDULE_RECEIPT_INVALID');
      }
    }
    return terminalization;
  }

  async function terminalizeGoneTab(tabId, {
    reason = 'tab_removed',
    now = Date.now(),
    runIds = null,
  } = {}) {
    const normalizedTabId = requireTabId(tabId);
    return terminalizeSession(normalizedTabId, { reason, now, runIds });
  }

  async function reconcileLiveDocument(tabId, { now = Date.now(), reason = 'document_replaced',
    readCurrentTopFrame, mutationFence } = {}) {
    const normalizedTabId = requireTabId(tabId);
    requireFunction(readCurrentTopFrame, 'PROTECTION_NUDGE_NAVIGATION_DOCUMENT_READER_REQUIRED');
    requireFunction(mutationFence?.assertCurrent, 'PROTECTION_NUDGE_NAVIGATION_MUTATION_FENCE_REQUIRED');
    const snapshot = await requireFunction(readActiveOwner, 'PROTECTION_NUDGE_TEARDOWN_OWNER_READER_REQUIRED')(normalizedTabId, { now });
    if (!Array.isArray(snapshot?.owners)) throw new Error('PROTECTION_NUDGE_NAVIGATION_OWNERS_INVALID');
    const owners = snapshot.owners.map(owner => {
      const binding = requireGoalEpisodeBinding(owner.goalBinding);
      if (binding.tabId !== normalizedTabId || binding.runId !== owner.runId || binding.key !== owner.key) {
        throw new Error('PROTECTION_NUDGE_NAVIGATION_OWNER_MISMATCH');
      }
      return { runId: owner.runId, documentId: binding.documentId };
    });
    if (owners.length === 0) return { retainedRunIds: [], retiredRunIds: [], terminalization: null };
    mutationFence.assertCurrent('nudge_document_reconcile_after_owner');
    const frame = await readCurrentTopFrame();
    mutationFence.assertCurrent('nudge_document_reconcile_after_probe');
    if (typeof frame?.documentId !== 'string' || !frame.documentId || frame.documentId !== frame.documentId.trim()
      || (Object.hasOwn(frame, 'documentLifecycle') && frame.documentLifecycle !== 'active')) {
      throw new Error('PROTECTION_NUDGE_NAVIGATION_DOCUMENT_REQUIRED');
    }
    const retainedRunIds = owners.filter(owner => owner.documentId === frame.documentId).map(owner => owner.runId);
    const retiredRunIds = owners.filter(owner => owner.documentId !== frame.documentId).map(owner => owner.runId);
    if (retiredRunIds.length === 0) return { retainedRunIds, retiredRunIds, terminalization: null };
    mutationFence.assertCurrent('nudge_document_reconcile_before_terminalize');
    const terminalization = await terminalizeSession(normalizedTabId, { reason, now, runIds: retiredRunIds, mutationFence });
    return { retainedRunIds, retiredRunIds, terminalization };
  }

  async function stopLiveTab(tab, {
    reason = 'nudge_stop',
    now = Date.now(),
  } = {}) {
    const tabId = requireTabId(tab?.id);
    const owner = await requireFunction(readActiveOwner, 'PROTECTION_NUDGE_TEARDOWN_OWNER_READER_REQUIRED')(tabId);
    const runIds = owner.owners.map((entry) => entry.runId);
    let stopResult = null;
    let stopError = null;
    try {
      stopResult = await sendStop(tab, { reason, now, runIds });
    } catch (error) {
      stopError = error;
    }

    const terminalization = await terminalizeSession(tabId, { reason, now, runIds });
    if (stopError) {
      stopError.nudgeTerminalization = terminalization;
      throw stopError;
    }
    return {
      stopResult,
      terminalization,
    };
  }

  return {
    stopLiveTab,
    terminalizeGoneTab,
    reconcileLiveDocument,
  };
}
