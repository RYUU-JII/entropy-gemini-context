import { InterventionAdmissionService } from '../../../src/domains/protection/background/runtime/InterventionAdmissionService.js';
import { createGoalEpisodeBinding } from '../../../src/domains/nudge/runtime/goalEpisodeBinding.js';
import { resolveActivityDayWindow } from '../../../src/domains/stats/shared/activityDay.js';

// Reuses the production service; only I/O and clock are simulated. No Chrome API
// is invoked and no production repository instance is constructed.
export function createAdmissionHarness({ startedAt = 100_000 } = {}) {
  let time = startedAt, stored, serial = 0, foregroundTabId = 0, failNextWrite = false;
  const documents = new Map(Array.from({ length: 8 }, (_, tab) => [tab, `document:${tab}`]));
  const receipts = new Map(), gates = new Map();
  const goals = new Map();
  const repository = {
    async read() { return { found: stored !== undefined, value: structuredClone(stored) }; },
    async write(value) {
      if (failNextWrite) { failNextWrite = false; throw new Error('SIMULATED_SESSION_WRITE_FAILURE'); }
      stored = structuredClone(value);
    },
  };
  const browserPort = {
    async tabsGet(tabId) { return { id: tabId, active: tabId === foregroundTabId, windowId: 1 }; },
    async windowsGetLastFocused() { return { id: 1, focused: true }; },
    async tabsGetLiveness(tabId) { return { tabId, status: documents.has(tabId) ? 'alive' : 'gone' }; },
    async webNavigationGetFrame({ tabId }) { return documents.has(tabId) ? { documentId: documents.get(tabId) } : null; },
    async tabsSendMessage(tabId, request, options) {
      if (options.frameId !== 0 || options.documentId !== documents.get(tabId)
        || !receipts.has(request.leaseId)) return { error: 'no exact receiver', response: null };
      const receipt = receipts.get(request.leaseId);
      if (request.operation === 'revoke') receipt.active = false;
      return { error: null, response: { leaseId: request.leaseId, ...receipt } };
    },
  };
  const gateRepository = { async getSessionByTabId(tabId) { return gates.get(tabId) ?? null; } };
  const restart = () => new InterventionAdmissionService({ repository, browserPort, gateRepository,
    runProfileMutationAdmittedTask: async ({ task }) => task(),
    readGoalPriority: async () => ({ goalReady: false, reason: null, isCurrent: () => true }),
    readGoalAuthorization: async ({ goalBinding }) => goals.get(goalBinding.key),
    // This harness measures admission/exposure, not Gate history. Model the
    // required operational receipt and an immediately completed history port;
    // durable history ordering is tested with the real controller and stores.
    onGatePresented: async (sessionId, tabId, presentedAt) => Object.freeze({
      sessionId, tabId, presentedAt, completion: Promise.resolve(),
    }), now: () => time });
  let service = restart();
  return {
    get service() { return service; },
    now: () => time,
    setTime(at) {
      if (!Number.isSafeInteger(at) || at < time) throw new Error('SIMULATED_CLOCK_REGRESSED');
      time = at;
    },
    focus(tabId) { foregroundTabId = tabId; },
    documents, receipts, gates,
    restart() { service = restart(); },
    failWrite() { failNextWrite = true; },
    raw: () => structuredClone(stored),
    async request(kind, overrides = {}) {
      const tabId = Object.hasOwn(overrides, 'tabId') ? overrides.tabId : foregroundTabId;
      const candidate = { kind, gateKind: null, tabId, documentId: documents.get(tabId),
        requestId: `request:${++serial}`, manual: false, observedAt: time, ...overrides };
      if (!candidate.manual && ['site_furin', 'global_sentinel'].includes(kind)) {
        // This offline exposure harness owns explicit synthetic attainment;
        // production authorization never reads these facts or identities.
        const scope = kind === 'site_furin' ? 'site' : 'global';
        const hostname = 'example.com', dateStr = resolveActivityDayWindow({ now: time, resetHour: 4 }).startDateStr;
        const facts = { hostname, profileGeneration: 'offline-evaluation-profile', isCurrent: () => true, documentCurrent: true, permissionAvailable: true,
          documentCurrent: true, permissionAvailable: true,
          activityDay: { basis: 'activity-day', dateStr, resetHour: 4, activeMs: 600_000 },
          settings: { nudgeConfig: { goalEnds: { site: true, global: true } }, dataCollectionMode: 'protected_sites', insightsConsent: 'protected_only',
            blockedUrls: [hostname], siteGoals: { [hostname]: 10 }, trackingExcludedUrls: [], protectionPresetAssignments: { sitePresetIds: {} } },
          runtimeSnapshot: { policy: { siteGoalMinutes: 10, globalCapLimitMs: 1_800_000, globalCapBlockedMs: 1_800_000 },
            dispatch: { isBlockedDomain: true, shouldApply: true }, plan: { artifacts: { sentinelFlare: 'armed' } } } };
        const key = `${dateStr}|${scope === 'global' ? '__global_protocol__' : hostname}`;
        const goalBinding = createGoalEpisodeBinding({ ...facts, key, runId: candidate.requestId, tabId,
          documentId: candidate.documentId, protocolClaim: { protocolScope: scope },
          triggerTarget: { source: scope === 'global' ? 'global_protocol' : 'site_goal', targetMs: scope === 'global' ? 1_800_000 : 600_000 } });
        facts.pending = { runId: candidate.requestId, tabId, goalBinding };
        goals.set(key, facts);
        candidate.goalBinding = goalBinding;
        candidate.source = 'furin_entry_action';
      }
      const result = await service.request(candidate);
      if (result.accepted && result.reason !== 'existing') {
        receipts.set(result.lease.leaseId, { active: true, presentedAt: 0, cleaned: true });
        if (candidate.gateKind !== null) gates.set(tabId, { sessionId: candidate.requestId });
      }
      return result;
    },
    async present(lease) {
      const result = lease.gateKind === null ? await service.transition(lease, 'presented')
        : await service.presentGate(lease.requestId, lease.tabId);
      if (result.accepted) receipts.get(lease.leaseId).presentedAt = time;
      return result;
    },
    async end(lease) {
      const result = await service.transition(lease, 'ended');
      if (result.accepted) {
        receipts.get(lease.leaseId).active = false;
        if (gates.get(lease.tabId)?.sessionId === lease.requestId) gates.delete(lease.tabId);
      }
      return result;
    },
  };
}
