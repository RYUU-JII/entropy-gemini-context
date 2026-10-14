const record = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const exact = (value, keys) => record(value) && Object.keys(value).sort().join('|') === [...keys].sort().join('|');
const text = value => typeof value === 'string' && value.length > 0 && value === value.trim();
const nullableText = value => value === null || text(value);

export const GOAL_END_DELIVERY_STATES = Object.freeze([
  'not_attained', 'disabled', 'waiting_for_safe_boundary', 'surface_unsupported', 'error', 'delivered',
]);
const PHASES = [null, 'dispatching', 'entry_waiting', 'entry_cancelling', 'presented', 'episode_completed'];
const RENDERERS = [null, 'site_furin', 'global_furin', 'combined_global_furin', 'budget_horizon'];

function requireScope(value) {
  if (!exact(value, ['attained', 'delivery', 'reason', 'phase', 'runId', 'renderer'])
    || typeof value.attained !== 'boolean' || !GOAL_END_DELIVERY_STATES.includes(value.delivery)
    || !nullableText(value.reason) || !nullableText(value.runId)
    || !PHASES.includes(value.phase) || !RENDERERS.includes(value.renderer)
    || (value.delivery === 'delivered' && (value.runId === null || value.renderer === null))
    || (value.delivery !== 'delivered' && value.renderer !== null)) {
    throw new Error('GOAL_END_SUMMARY_SCOPE_INVALID');
  }
  return Object.freeze({ ...value });
}

/** A read DTO, never an admission or receipt owner. Absence is explicit for
 * snapshots that do not have a current host read; present invalid data fails. */
export function requireGoalEndSummary(value) {
  if (!exact(value, ['version', 'hostname', 'dateStr', 'site', 'global'])
    || value.version !== 1 || !text(value.hostname) || normalizeDomain(value.hostname) !== value.hostname
    || !/^\d{4}-\d{2}-\d{2}$/.test(value.dateStr)) {
    throw new Error('GOAL_END_SUMMARY_INVALID');
  }
  requireFurinActivityDate(value.dateStr);
  return Object.freeze({ ...value, site: requireScope(value.site), global: requireScope(value.global) });
}

export function normalizeOptionalGoalEndSummary(value) {
  return value === null || value === undefined ? null : requireGoalEndSummary(value);
}
import { normalizeDomain } from '../../../lib/domain.js';
import { requireFurinActivityDate } from '../../../platform/storage/nudge/furinDailyReceiptContract.js';
