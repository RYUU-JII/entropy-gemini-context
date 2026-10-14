import { normalizeDomain } from '../../../lib/domain.js';
import { getHostname } from '../../../lib/index.js';
import { isSiteRuleMatch } from '../../../lib/siteIdentity.js';
import { requireTabEvaporationCheckpoint } from '../../../platform/storage/runtime/TabEvaporationCheckpointRepository.js';

export function isBlockedTabUrl(url, blockedUrls = []) {
  if (typeof url !== 'string' || !/^https?:\/\//.test(url)) return false;
  const hostname = getHostname(url);
  return !!hostname && blockedUrls.some(rule => isSiteRuleMatch(hostname, normalizeDomain(rule)));
}

function isInactiveCandidate(tab, blockedUrls, now) {
  return tab && Number.isSafeInteger(tab.id) && tab.id >= 0
    && tab.active === false && tab.pinned === false && tab.audible === false
    && !tab.pendingUrl && tab.status !== 'loading'
    && Number.isFinite(tab.lastAccessed) && tab.lastAccessed > 0 && tab.lastAccessed <= now
    && isBlockedTabUrl(tab.url, blockedUrls);
}

function requirePolicy({ timeoutMs, blockedUrls, isCurrent }) {
  if (!Number.isSafeInteger(timeoutMs) || timeoutMs <= 0) throw new Error('TAB_EVAPORATION_TIMEOUT_INVALID');
  if (!Array.isArray(blockedUrls) || blockedUrls.some(rule => typeof rule !== 'string' || !normalizeDomain(rule))) {
    throw new Error('TAB_EVAPORATION_SCOPE_INVALID');
  }
  if (typeof isCurrent !== 'function') throw new Error('TAB_EVAPORATION_POLICY_FENCE_REQUIRED');
}

/** One observed-inactivity checkpoint and one sweep per worker. Browser reads
 * select candidates; current policy and a final live read authorize removal.
 * lastAccessed detects intervening activation, never starts an inactivity timer.
 */
export function createTabEvaporationManager({ browserPort, checkpointRepository,
  onTabEvaporated = null, now = () => Date.now() } = {}) {
  for (const method of ['tabsQuery', 'tabsGet', 'tabsRemove']) {
    if (typeof browserPort?.[method] !== 'function') throw new Error(`TAB_EVAPORATION_BROWSER_PORT_METHOD_REQUIRED:${method}`);
  }
  for (const method of ['read', 'write', 'clear']) {
    if (typeof checkpointRepository?.[method] !== 'function') throw new Error(`TAB_EVAPORATION_CHECKPOINT_OWNER_REQUIRED:${method}`);
  }
  let tail = Promise.resolve();
  let inFlight = null;
  let generation = 0;
  let resetPending = false;
  const enqueue = work => {
    const task = tail.then(work);
    tail = task.then(() => undefined, () => undefined);
    return task;
  };

  function reset() {
    generation += 1;
    resetPending = true;
    return enqueue(async () => {
      await checkpointRepository.clear();
      resetPending = false;
    });
  }

  function sweepStaleTabs(policy) {
    requirePolicy(policy);
    if (inFlight) return inFlight;
    const { timeoutMs, isCurrent } = policy;
    const blockedUrls = [...new Set(policy.blockedUrls.map(normalizeDomain))].sort();
    const policyKey = JSON.stringify({ timeoutMs, blockedUrls });
    const epoch = generation;
    const current = () => epoch === generation && isCurrent();
    const task = enqueue(async () => {
      if (resetPending) throw new Error('TAB_EVAPORATION_RESET_PENDING');
      const result = { status: 'completed', evaporated: [], failures: [] };
      const cancelled = () => ({ ...result, status: 'cancelled' });
      if (!current()) return cancelled();
      const raw = await checkpointRepository.read();
      const previous = raw === null ? null : requireTabEvaporationCheckpoint(raw);
      if (!current()) return cancelled();
      const tabs = await browserPort.tabsQuery({ active: false, pinned: false, audible: false });
      if (!Array.isArray(tabs)) throw new Error('TAB_EVAPORATION_TAB_INVENTORY_INVALID');
      if (!current()) return cancelled();
      const observedAt = now();
      if (!Number.isSafeInteger(observedAt) || observedAt < 0) throw new Error('TAB_EVAPORATION_CLOCK_INVALID');
      const prior = new Map((previous?.policyKey === policyKey ? previous.tabs : []).map(tab => [tab.tabId, tab]));
      const retained = new Map();
      const seen = new Set();
      for (const tab of tabs) {
        if (!current()) return cancelled();
        if (!isInactiveCandidate(tab, blockedUrls, observedAt) || seen.has(tab.id)) continue;
        seen.add(tab.id);
        const old = prior.get(tab.id);
        const sameInterval = old && old.url === tab.url && old.lastAccessed === tab.lastAccessed
          && old.inactiveSince <= observedAt;
        const entry = sameInterval ? old : {
          tabId: tab.id, url: tab.url, lastAccessed: tab.lastAccessed, inactiveSince: observedAt,
        };
        retained.set(tab.id, entry);
        if (observedAt - entry.inactiveSince < timeoutMs) continue;
        try {
          const live = await browserPort.tabsGet(tab.id);
          if (!current()) return cancelled();
          // Null is the browser port's exact-tab-gone receipt. Unknown/API errors throw.
          if (live === null || !isInactiveCandidate(live, blockedUrls, observedAt)
            || live.id !== tab.id || live.url !== entry.url || live.lastAccessed !== entry.lastAccessed) {
            retained.delete(tab.id);
            continue;
          }
          const removal = await browserPort.tabsRemove(tab.id);
          if (removal?.success !== true) throw new Error(`TAB_EVAPORATION_REMOVE_FAILED:${removal?.error || 'INVALID_REMOVAL_RECEIPT'}`);
          retained.delete(tab.id);
          const fact = { tabId: tab.id, url: entry.url, domain: getHostname(entry.url) };
          result.evaporated.push({ ...fact, idleMs: observedAt - entry.inactiveSince });
          if (onTabEvaporated) await onTabEvaporated(fact);
        } catch (error) {
          result.failures.push({ tabId: tab.id, error: error?.message || String(error) });
        }
      }
      if (!current()) return cancelled();
      const checkpoint = { version: 1, policyKey, tabs: [...retained.values()] };
      if (JSON.stringify(checkpoint) !== JSON.stringify(previous)) {
        try {
          await checkpointRepository.write(checkpoint);
        } catch (error) {
          result.failures.push({ tabId: null, phase: 'checkpoint', error: error?.message || String(error) });
        }
      }
      return current() ? result : cancelled();
    });
    inFlight = task.then(result => {
      if (result.failures.length) {
        const summary = result.failures.slice(0, 8).map(failure => ({ ...failure, error: failure.error.slice(0, 240) }));
        const error = new Error(`TAB_EVAPORATION_SWEEP_FAILED:${result.failures.length} summary=${JSON.stringify(summary)}`);
        error.code = 'TAB_EVAPORATION_SWEEP_FAILED';
        error.result = { ...result, status: 'failed', cancelled: result.status === 'cancelled' };
        throw error;
      }
      return result;
    }).finally(() => { inFlight = null; });
    return inFlight;
  }

  return { sweepStaleTabs, reset };
}
