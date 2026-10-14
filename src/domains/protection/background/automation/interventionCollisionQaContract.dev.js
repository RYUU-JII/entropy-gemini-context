import { DEFAULT_PROTECTION_POLICY_PAYLOAD } from '../protocol/dispatch/ProtectionDispatchPolicyPayload.js';

export const INTERVENTION_COLLISION_QA_ACTION = 'QA_INTERVENTION_COLLISION';
export const INTERVENTION_COLLISION_QA_CHANNEL = 'entropy.intervention.collision.qa.v1';
const OPERATIONS = new Set(['read', 'furin', 'isolation', 'stop_auto', 'replay_enso_end', 'prepare_enso_candidate']);
const ID = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,95}$/u;

export function parseInterventionCollisionQaRequest(message) {
  if (!message || message.channel !== INTERVENTION_COLLISION_QA_CHANNEL
    || message.action !== INTERVENTION_COLLISION_QA_ACTION || typeof message.requestId !== 'string' || !ID.test(message.requestId)
    || !Number.isSafeInteger(message.targetTabId) || message.targetTabId < 0
    || !OPERATIONS.has(message.operation)) throw new Error('COLLISION_QA_REQUEST_INVALID');
  const payload = message.payload;
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) throw new Error('COLLISION_QA_PAYLOAD_INVALID');
  const expected = { read: [], prepare_enso_candidate: [], furin: ['scope'], isolation: [], stop_auto: ['runId'],
    replay_enso_end: ['leaseId', 'documentId'] }[message.operation];
  if (Object.keys(payload).length !== expected.length || expected.some((key) => !Object.hasOwn(payload, key))) {
    throw new Error('COLLISION_QA_PAYLOAD_KEYS_INVALID');
  }
  if (message.operation === 'furin' && !['site', 'global', 'combined'].includes(payload.scope)) throw new Error('COLLISION_QA_SCOPE_INVALID');
  for (const key of expected.filter((entry) => entry !== 'scope')) {
    if (typeof payload[key] !== 'string' || !payload[key] || payload[key].length > 120) throw new Error('COLLISION_QA_ID_INVALID');
  }
  return { ...message, payload: { ...payload } };
}

// A fixed candidate fixture, never an observation/history write or clock override.
// The real dispatch owner still selects/coalesces the target and owns run/debt/ACK.
export function createCollisionFurinCandidate(scope, hostname, now = Date.now()) {
  if (!['site', 'global', 'combined'].includes(scope)) throw new Error('COLLISION_QA_SCOPE_INVALID');
  if (typeof hostname !== 'string' || !/^collision-[ab]\.localhost$/u.test(hostname)) {
    throw new Error('COLLISION_QA_HOSTNAME_INVALID');
  }
  const date = new Date(now);
  const dateStr = [date.getFullYear(), String(date.getMonth() + 1).padStart(2, '0'), String(date.getDate()).padStart(2, '0')].join('-');
  const global = scope !== 'site';
  return {
    activityDay: { basis: 'activity-day', dateStr, resetHour: 0, activeMs: 60_000,
      // The candidate has a synthetic budget, not measured history. Use the
      // canonical unavailable-coverage DTO; the dispatch owner supplies targetMs.
      reflection: { schemaVersion: 1, hostname, cycleStartAt: null, observedAt: null,
        activeMs: 60_000, representedMs: 0, segments: [], coverage: 'unavailable' } },
    dispatch: { isBlockedDomain: true, shouldApply: true },
    policy: { ...DEFAULT_PROTECTION_POLICY_PAYLOAD, reason: 'qa_collision_candidate',
      siteGoalMinutes: 1, protocolTargetMinutes: 1,
      protocolTargetSource: scope === 'global' ? 'global_protocol' : 'site_goal',
      globalCapExceeded: global, globalCapBlockedMs: global ? 60_000 : 0,
      globalCapLimitMs: global ? 60_000 : 0 },
    plan: { state: { level: 1 }, artifacts: { sentinelFlare: 'armed' } },
  };
}
