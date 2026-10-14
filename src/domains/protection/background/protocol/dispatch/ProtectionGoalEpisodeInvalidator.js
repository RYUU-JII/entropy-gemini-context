import { MESSAGE_TYPES } from '../../../../../platform/messaging/messageTypes.js';
import { NUDGE_PENDING_PHASES, requireNudgeCancellationReason } from '../../../../nudge/runtime/session/nudgeSessionCore.js';
import { areGoalEpisodeBindingsEqual } from '../../../../nudge/runtime/goalEpisodeBinding.js';
import { readUnservedGoalEpisodes, markNudgeGoalCancelling } from '../../../../nudge/runtime/session/nudgeSessionGoalCancellationState.js';
import { completeNudgeGoalCancellation } from '../../../../tracking/background/nudgeManagerAbortKeyState.js';

export function createProtectionGoalEpisodeInvalidator({ interventionAdmission, browserPort,
  readEpisodes = readUnservedGoalEpisodes, markCancelling = markNudgeGoalCancelling,
  terminalize = completeNudgeGoalCancellation, scheduleTerminalEffects } = {}) {
  if (typeof scheduleTerminalEffects !== 'function') throw new Error('PROTECTION_GOAL_EFFECT_SCHEDULER_REQUIRED');
  for (const method of ['validateGoalBinding', 'cancelGoalBinding', 'invalidateGoalAuthorization']) {
    if (typeof interventionAdmission?.[method] !== 'function') throw new Error('PROTECTION_GOAL_ADMISSION_OWNER_REQUIRED');
  }
  for (const method of ['tabsGetLiveness', 'webNavigationGetFrame', 'tabsSendMessage']) {
    if (typeof browserPort?.[method] !== 'function') throw new Error('PROTECTION_GOAL_BROWSER_OWNER_REQUIRED');
  }

  async function cleanPendingDocument(binding) {
    const liveness = await browserPort.tabsGetLiveness(binding.tabId);
    if (liveness?.tabId !== binding.tabId || !['alive', 'gone'].includes(liveness.status)) {
      throw new Error('PROTECTION_GOAL_TAB_LIVENESS_INVALID');
    }
    if (liveness.status === 'gone') return;
    const frame = await browserPort.webNavigationGetFrame({ tabId: binding.tabId, frameId: 0 });
    // A replaced/removed top document cannot retain a visible entry seam. The
    // cancelling checkpoint also refuses a delayed callback from that document.
    if (frame === null) return;
    if (typeof frame?.documentId !== 'string' || !frame.documentId) throw new Error('PROTECTION_GOAL_DOCUMENT_ID_REQUIRED');
    if (frame.documentId !== binding.documentId) return;
    const result = await browserPort.tabsSendMessage(binding.tabId,
      { type: MESSAGE_TYPES.NUDGE_STOP, payload: { runIds: [binding.runId] } },
      { documentId: binding.documentId }, { timeoutMs: 800 });
    const receipt = result?.response;
    if (result?.error || receipt?.ok !== true || receipt.cleaned !== true
      || receipt.runIds?.length !== 1 || receipt.runIds[0] !== binding.runId) {
      throw new Error('PROTECTION_GOAL_ENTRY_CLEANUP_UNCONFIRMED');
    }
  }

  async function revalidate({ tabId = null, now = Date.now() } = {}) {
    const cancelled = [];
    for (const episode of await readEpisodes({ tabId })) {
      const binding = episode.goalBinding;
      const validity = episode.phase === NUDGE_PENDING_PHASES.ENTRY_CANCELLING
        ? { valid: false, reason: episode.cancellationReason }
        : await interventionAdmission.validateGoalBinding(binding, { tabId: binding.tabId, documentId: binding.documentId });
      if (validity.valid) continue;
      const cancellation = await markCancelling(binding, { reason: validity.reason });
      if (cancellation === null) continue;
      if (!cancellation || !Object.isFrozen(cancellation)
        || Reflect.ownKeys(cancellation).length !== 2
        || !Object.hasOwn(cancellation, 'reason') || !Object.hasOwn(cancellation, 'goalBinding')
        || !areGoalEpisodeBindingsEqual(cancellation.goalBinding, binding)) {
        throw new Error('PROTECTION_GOAL_CANCELLATION_RECEIPT_INVALID');
      }
      const reason = requireNudgeCancellationReason(cancellation.reason);
      const cleanup = await interventionAdmission.cancelGoalBinding(binding, { reason });
      if (cleanup?.accepted !== true || cleanup.cleaned !== true) throw new Error('PROTECTION_GOAL_ADMISSION_CLEANUP_UNCONFIRMED');
      await cleanPendingDocument(binding);
      const result = await terminalize(binding, { now });
      if (!['applied', 'already_applied'].includes(result?.outcome) || !result.entry) {
        throw new Error('PROTECTION_GOAL_CANCELLATION_COMPLETION_UNCONFIRMED');
      }
      const scheduled = scheduleTerminalEffects({ tabId: binding.tabId, runId: binding.runId, reason });
      if (scheduled?.status !== 'scheduled') throw new Error('PROTECTION_GOAL_EFFECT_SCHEDULE_RECEIPT_INVALID');
      const ended = result.outcome === 'applied';
      cancelled.push({ key: binding.key, runId: binding.runId, reason, ended });
    }
    return { cancelled };
  }
  return { revalidate, invalidate: () => interventionAdmission.invalidateGoalAuthorization() };
}
