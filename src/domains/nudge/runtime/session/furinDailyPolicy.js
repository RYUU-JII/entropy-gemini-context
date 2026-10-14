import { FurinDailyReceiptRepository } from '../../../../platform/storage/nudge/FurinDailyReceiptRepository.js';
import { FURIN_DAILY_RECEIPT_VERSION, FURIN_DAILY_SITE_LIMIT, requireFurinActivityDate, requireFurinDailyReceipt,
  requireFurinDeliveryForm } from '../../../../platform/storage/nudge/furinDailyReceiptContract.js';
import { withNudgeSessionLock } from './nudgeSessionStore.js';
import { NUDGE_GLOBAL_PROTOCOL_DAY_HOST } from './nudgeSessionShared.js';
import { requireGoalEpisodeBinding } from '../goalEpisodeBinding.js';

const repository = new FurinDailyReceiptRepository();

export function clearFurinDailyReceiptForProfileReset() {
  return withNudgeSessionLock(() => repository.clear());
}

export function furinDayFromKey(key) {
  if (typeof key !== 'string' || !key.includes('|')) throw new Error('FURIN_DAY_KEY_INVALID');
  return requireFurinActivityDate(key.slice(0, key.indexOf('|')));
}

export function decideFurinDailyDelivery(state, { dateStr, hostname, protocolScope }) {
  requireFurinActivityDate(dateStr);
  if (!['site', 'global'].includes(protocolScope)) throw new Error('FURIN_DAILY_SCOPE_INVALID');
  if (typeof hostname !== 'string' || !hostname) throw new Error('FURIN_DAILY_HOSTNAME_REQUIRED');
  if (state !== null) requireFurinDailyReceipt(state);
  if (state !== null && state.dateStr > dateStr) return { eligible: false, reason: 'stale_activity_day', deliveryForm: null };
  const current = state?.dateStr === dateStr ? state : null;
  if (protocolScope === 'global' && current?.global) return { eligible: false, reason: 'global_already_presented', deliveryForm: null };
  if (protocolScope === 'site' && current !== null && Object.hasOwn(current.siteEnds, hostname)) {
    return { eligible: false, reason: 'site_already_presented', deliveryForm: null };
  }
  return { eligible: true, reason: 'eligible', deliveryForm: protocolScope === 'site' && (current?.fullSite || current?.global) ? 'brief' : 'full' };
}

export function hasFurinDailyPresentation(state, key) {
  const separatorAt = key.indexOf('|');
  const dateStr = furinDayFromKey(key);
  if (state === null || state.dateStr !== dateStr) return false;
  requireFurinDailyReceipt(state);
  const hostname = key.slice(separatorAt + 1);
  return hostname === NUDGE_GLOBAL_PROTOCOL_DAY_HOST ? state.global !== null : Object.hasOwn(state.siteEnds, hostname);
}

// Caller holds withNudgeSessionLock. No independent lock, cache, timer or writer.
export function readFurinDailyReceipt() { return repository.read(); }

export async function recordFurinDailyPresentation(key, pending, now) {
  const dateStr = furinDayFromKey(key);
  const state = await repository.read();
  const form = requireFurinDeliveryForm(pending.deliveryForm);
  if (!Number.isSafeInteger(now) || now <= 0 || typeof pending.runId !== 'string' || !pending.runId) {
    throw new Error('FURIN_PRESENTATION_RECEIPT_INVALID');
  }
  const scope = pending.protocolClaim.protocolScope;
  const binding = requireGoalEpisodeBinding(pending.goalBinding);
  if (binding.hostname !== pending.hostname || binding.dateStr !== dateStr || binding.key !== key || binding.runId !== pending.runId
    || binding.purpose !== (scope === 'global' ? 'global_goal' : 'site_goal')) throw new Error('FURIN_PRESENTATION_BINDING_MISMATCH');
  const combined = scope === 'global' && binding.coveredScopes.includes('site');
  const existing = state?.dateStr === dateStr
    ? (scope === 'global' ? state.global : state.sites[pending.hostname]) : null;
  if (existing?.runId === pending.runId) return;
  const decision = decideFurinDailyDelivery(state, { dateStr, hostname: pending.hostname, protocolScope: scope });
  if (!decision.eligible || decision.deliveryForm !== form) throw new Error(`FURIN_PRESENTATION_DAILY_CONFLICT:${decision.reason}`);
  if (combined && !decideFurinDailyDelivery(state, { dateStr, hostname: pending.hostname, protocolScope: 'site' }).eligible) {
    throw new Error('FURIN_PRESENTATION_COMBINED_SITE_CONFLICT');
  }
  const next = state?.dateStr === dateStr ? structuredClone(state)
    : { version: FURIN_DAILY_RECEIPT_VERSION, dateStr, fullSite: null, global: null, sites: {}, siteEnds: {} };
  const receipt = { runId: pending.runId, presentedAt: now, source: 'actual_presentation' };
  if (scope === 'global') {
    next.global = receipt;
    if (combined) next.siteEnds[pending.hostname] = { runId: pending.runId, presentedAt: now,
      renderer: 'combined_global_furin', scopes: ['global', 'site'] };
  }
  else {
    if (Object.keys(next.sites).length >= FURIN_DAILY_SITE_LIMIT) throw new Error('FURIN_DAILY_SITE_LIMIT_REACHED');
    next.sites[pending.hostname] = { ...receipt, deliveryForm: form };
    next.siteEnds[pending.hostname] = { runId: pending.runId, presentedAt: now, renderer: 'site_furin', scopes: ['site'] };
    if (form === 'full') next.fullSite = { ...receipt, hostname: pending.hostname };
  }
  if (Object.keys(next.siteEnds).length > FURIN_DAILY_SITE_LIMIT) throw new Error('FURIN_DAILY_SITE_LIMIT_REACHED');
  await repository.write(next);
}
