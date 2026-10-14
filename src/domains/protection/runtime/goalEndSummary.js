import { requireNudgeGoalEnds } from '../../settings/config/nudgeConfig.js';
import { requireFurinDailyReceipt } from '../../../platform/storage/nudge/furinDailyReceiptContract.js';
import { requireGoalEpisodeBinding } from '../../nudge/runtime/goalEpisodeBinding.js';
import { normalizePendingEntry, normalizeTerminalEntry, isPendingEntryActive } from '../../nudge/runtime/session/nudgeSessionCore.js';
import { getNudgeDayKey, getNudgeGlobalProtocolDayKey } from '../../nudge/runtime/session/nudgeSessionShared.js';
import { requireGoalEndSummary } from '../contracts/goalEndSummaryContract.js';

const UNSUPPORTED_REASONS = new Set([
  'primary_media_boundary_unproven',
  'surface_not_declared', 'non_web_surface',
]);
const ERROR_REASONS = new Set(['dispatch_failed', 'entry_failed', 'entry_start_failed']);

function scopeState(attained, delivery, reason = null, extra = {}) {
  return { attained, delivery, reason, phase: null, runId: null, renderer: null, ...extra };
}

function sameGoal(binding, { hostname, dateStr, resetHour, siteTargetMs, globalTargetMs }, scope) {
  return binding.hostname === hostname && binding.dateStr === dateStr && binding.resetHour === resetHour
    && binding.coveredScopes.includes(scope)
    && (binding.siteTargetMs === null || binding.siteTargetMs === siteTargetMs)
    && (binding.globalTargetMs === null || binding.globalTargetMs === globalTargetMs);
}

/** Projects canonical current budget facts and acknowledged delivery/lifecycle
 * evidence. No ratio, time extrapolation, surface guess, or new policy decision. */
export function buildGoalEndSummary({ hostname, dateStr, resetHour, now, profileGeneration,
  siteTargetMs, siteActiveMs, globalTargetMs, globalActiveMs,
  enabled, recording, protected: isProtected, state, isBindingCurrent }) {
  requireNudgeGoalEnds(enabled);
  if (![siteTargetMs, siteActiveMs, globalTargetMs, globalActiveMs, now].every(value => Number.isSafeInteger(value) && value >= 0)
    || !Number.isInteger(resetHour) || resetHour < 0 || resetHour > 23
    || ![recording?.site, recording?.global, isProtected].every(value => typeof value === 'boolean')
    || !state || !state.pending || !state.terminal
    || typeof profileGeneration !== 'string' || !profileGeneration.trim()
    || typeof isBindingCurrent !== 'function') throw new Error('GOAL_END_SUMMARY_FACTS_REQUIRED');
  const facts = { hostname, dateStr, resetHour, siteTargetMs, globalTargetMs };
  const daily = state.dailyReceipt === null ? null : requireFurinDailyReceipt(state.dailyReceipt);
  const currentDay = daily?.dateStr === dateStr ? daily : null;
  const siteKey = getNudgeDayKey(dateStr, hostname);
  const globalKey = getNudgeGlobalProtocolDayKey(dateStr);
  const keys = [siteKey, globalKey];
  const allPending = Object.values(state.pending).map(value => normalizePendingEntry(value))
    .filter(value => value !== null && isPendingEntryActive(value, now));
  const pending = allPending.filter(value => keys.includes(value.goalBinding.key));
  const current = binding => {
    const result = isBindingCurrent(binding);
    if (typeof result !== 'boolean') throw new Error('GOAL_END_SUMMARY_CURRENT_BINDING_PROOF_INVALID');
    return result;
  };

  const project = (scope, targetMs, activeMs, receipt) => {
    const basisAvailable = recording[scope];
    const attained = basisAvailable && targetMs > 0 && activeMs >= targetMs;
    if (receipt) return scopeState(attained, 'delivered', 'actual_presentation', {
      runId: receipt.runId, renderer: scope === 'site' ? receipt.renderer
        : currentDay.siteEnds[hostname]?.runId === receipt.runId ? 'combined_global_furin' : 'global_furin',
    });
    const cancelling = allPending.find(entry => entry.phase === 'entry_cancelling'
      && entry.goalBinding.hostname === hostname && entry.goalBinding.profileGeneration === profileGeneration
      && entry.goalBinding.coveredScopes.includes(scope));
    if (cancelling) return scopeState(attained, 'waiting_for_safe_boundary', 'goal_entry_cancelling', {
      phase: 'entry_cancelling', runId: cancelling.runId,
    });
    if (daily !== null && daily.dateStr > dateStr) return scopeState(attained, 'error', 'stale_activity_day');
    if (!basisAvailable || !enabled[scope] || !isProtected) return scopeState(attained, 'disabled',
      !basisAvailable ? 'no_basis' : !enabled[scope] ? 'goal_end_disabled' : 'protection_inactive');
    if (!attained) return scopeState(false, 'not_attained', targetMs === 0 ? 'no_budget' : 'goal_not_attained');
    const owner = pending.find(entry => sameGoal(entry.goalBinding, facts, scope) && current(entry.goalBinding));
    if (owner && ['presented', 'episode_completed'].includes(owner.phase)) {
      return scopeState(true, 'error', 'final_receipt_unavailable', { phase: owner.phase, runId: owner.runId });
    }
    if (owner) return scopeState(true, 'waiting_for_safe_boundary', 'owned_entry_wait', {
      phase: owner.phase, runId: owner.runId,
    });
    for (const key of keys) {
      const terminal = normalizeTerminalEntry(state.terminal[key], now);
      if (!terminal || !terminal.goalBinding) continue;
      const binding = requireGoalEpisodeBinding(terminal.goalBinding);
      if (terminal.runId !== binding.runId || !sameGoal(binding, facts, scope) || !current(binding)) continue;
      if (UNSUPPORTED_REASONS.has(terminal.reason)) return scopeState(true, 'surface_unsupported', terminal.reason, { runId: terminal.runId });
      if (ERROR_REASONS.has(terminal.reason)) return scopeState(true, 'error', terminal.reason, { runId: terminal.runId });
    }
    return scopeState(true, 'waiting_for_safe_boundary', 'fresh_safe_boundary_required');
  };
  return requireGoalEndSummary({ version: 1, hostname, dateStr,
    site: project('site', siteTargetMs, siteActiveMs, currentDay?.siteEnds[hostname]),
    global: project('global', globalTargetMs, globalActiveMs, currentDay?.global),
  });
}
