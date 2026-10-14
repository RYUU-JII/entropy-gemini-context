import {
  getTimeWindowRemainingMs,
  isTimeWindowActive,
  normalizeTimeWindowTimestamp,
} from '../../../../lib/timeWindow.js';

export const GATE_PASS_SCOPES = Object.freeze({
  HOST: 'host',
  TAB: 'tab',
});

const GATE_PASS_SCOPE_SET = new Set(Object.values(GATE_PASS_SCOPES));
const PASS_KEY_SEPARATOR = '::';

function normalizeHost(hostname) {
  return typeof hostname === 'string' ? hostname.trim().toLowerCase() : '';
}

function normalizeTabId(tabId) {
  // `Number(null)` and `Number('')` are 0, which would silently address tab 0.
  // "no tab named" must stay distinguishable from "tab 0".
  if (typeof tabId !== 'number') return null;
  return Number.isInteger(tabId) && tabId >= 0 ? tabId : null;
}

function buildScopedKey(hostname, gateKind) {
  return `${hostname}${PASS_KEY_SEPARATOR}${gateKind}`;
}

function pruneExpired(byKey, now) {
  byKey.forEach((until, key) => {
    if (!isTimeWindowActive(until, now)) byKey.delete(key);
  });
  return byKey;
}

/**
 * Two-axis pass ledger for gate interventions.
 *
 * A pass answers "this interruption is already covered by a decision the user
 * made". Which decision it was determines how far the cover reaches, so scope
 * is declared by the grant rather than implied by where the value is stored:
 *
 *   host scope - "I decided about this site." Covers every tab on the host.
 *   tab  scope - "I decided about this tab."  Covers only that tab on that host.
 *
 * A pass is active when either axis is active, so a host grant never has to be
 * duplicated per tab and a tab grant never widens into one.
 *
 * Every scope here is a *time* window, which is what makes it the wrong tool
 * for anything counted. The spread guard is settled by levels instead, in the
 * gate runtime owner.
 */
export function createGateInterventionPassLedger({ gateKinds } = {}) {
  if (!Array.isArray(gateKinds) || !gateKinds.length) {
    throw new Error('GATE_PASS_LEDGER_KINDS_REQUIRED');
  }
  const gateKindSet = new Set(gateKinds);

  // `${hostname}::${gateKind}` -> until
  const hostPasses = new Map();
  // tabId -> Map<`${hostname}::${gateKind}`, until>
  const tabPassesByTabId = new Map();

  function requireGateKind(gateKind) {
    if (!gateKindSet.has(gateKind)) {
      throw new Error(`GATE_PASS_LEDGER_KIND_INVALID:${String(gateKind)}`);
    }
    return gateKind;
  }

  function requireScope(scope) {
    if (!GATE_PASS_SCOPE_SET.has(scope)) {
      throw new Error(`GATE_PASS_LEDGER_SCOPE_INVALID:${String(scope)}`);
    }
    return scope;
  }

  function grant({
    gateKind,
    scope,
    hostname,
    tabId = null,
    until,
    now = Date.now(),
  } = {}) {
    const resolvedGateKind = requireGateKind(gateKind);
    const resolvedScope = requireScope(scope);
    const normalizedHostname = normalizeHost(hostname);
    if (!normalizedHostname) {
      throw new Error('GATE_PASS_LEDGER_HOSTNAME_REQUIRED');
    }
    const normalizedUntil = normalizeTimeWindowTimestamp(until);
    const key = buildScopedKey(normalizedHostname, resolvedGateKind);

    if (resolvedScope === GATE_PASS_SCOPES.HOST) {
      pruneExpired(hostPasses, now);
      const previousUntil = normalizeTimeWindowTimestamp(hostPasses.get(key));
      hostPasses.set(key, Math.max(previousUntil, normalizedUntil));
      return {
        scope: resolvedScope,
        hostname: normalizedHostname,
        tabId: null,
        until: hostPasses.get(key),
      };
    }

    const normalizedTabId = normalizeTabId(tabId);
    if (normalizedTabId === null) {
      throw new Error('GATE_PASS_LEDGER_TAB_ID_REQUIRED');
    }
    const byKey = tabPassesByTabId.get(normalizedTabId) || new Map();
    pruneExpired(byKey, now);
    const previousUntil = normalizeTimeWindowTimestamp(byKey.get(key));
    byKey.set(key, Math.max(previousUntil, normalizedUntil));
    tabPassesByTabId.set(normalizedTabId, byKey);
    return {
      scope: resolvedScope,
      hostname: normalizedHostname,
      tabId: normalizedTabId,
      until: byKey.get(key),
    };
  }

  /**
   * Effective pass expiry for one gate kind: the later of the two axes, and 0
   * when neither is active. Callers treat 0 as "no pass".
   */
  function resolveUntil({
    gateKind,
    hostname,
    tabId = null,
    now = Date.now(),
  } = {}) {
    const resolvedGateKind = requireGateKind(gateKind);
    const normalizedHostname = normalizeHost(hostname);
    if (!normalizedHostname) return 0;
    const key = buildScopedKey(normalizedHostname, resolvedGateKind);

    const hostUntil = normalizeTimeWindowTimestamp(hostPasses.get(key));
    const activeHostUntil = isTimeWindowActive(hostUntil, now) ? hostUntil : 0;

    const normalizedTabId = normalizeTabId(tabId);
    if (normalizedTabId === null) return activeHostUntil;

    const tabUntil = normalizeTimeWindowTimestamp(
      tabPassesByTabId.get(normalizedTabId)?.get(key),
    );
    const activeTabUntil = isTimeWindowActive(tabUntil, now) ? tabUntil : 0;
    return Math.max(activeHostUntil, activeTabUntil);
  }

  function isActive({ gateKind, hostname, tabId = null, now = Date.now() } = {}) {
    return resolveUntil({ gateKind, hostname, tabId, now }) > 0;
  }

  /**
   * Effective expiry for every gate kind, shaped for projection into the gate
   * runtime snapshot.
   */
  function snapshotFor({ hostname, tabId = null, now = Date.now() } = {}) {
    const snapshot = {};
    gateKindSet.forEach((gateKind) => {
      snapshot[gateKind] = resolveUntil({ gateKind, hostname, tabId, now });
    });
    return snapshot;
  }

  function resolveActiveScope(hostUntil, tabUntil, now) {
    // Names the axis carrying the pass furthest, so a diagnostic reads back the
    // widest statement still standing rather than the narrowest.
    const active = [
      [GATE_PASS_SCOPES.HOST, hostUntil],
      [GATE_PASS_SCOPES.TAB, tabUntil],
    ].filter(([, until]) => isTimeWindowActive(until, now));
    if (!active.length) return '';
    return active.reduce(
      (widest, entry) => (entry[1] > widest[1] ? entry : widest),
    )[0];
  }

  /**
   * Per-axis breakdown for diagnostics: which axis is covering this gate, and
   * for how much longer.
   */
  function describeFor({ gateKind, hostname, tabId = null, now = Date.now() } = {}) {
    const resolvedGateKind = requireGateKind(gateKind);
    const normalizedHostname = normalizeHost(hostname);
    const key = buildScopedKey(normalizedHostname, resolvedGateKind);
    const hostUntil = normalizeTimeWindowTimestamp(hostPasses.get(key));
    const normalizedTabId = normalizeTabId(tabId);
    const tabUntil = normalizedTabId === null
      ? 0
      : normalizeTimeWindowTimestamp(tabPassesByTabId.get(normalizedTabId)?.get(key));
    const until = resolveUntil({
      gateKind: resolvedGateKind,
      hostname: normalizedHostname,
      tabId: normalizedTabId,
      now,
    });
    return {
      gateKind: resolvedGateKind,
      hostname: normalizedHostname,
      tabId: normalizedTabId,
      hostUntil: isTimeWindowActive(hostUntil, now) ? hostUntil : 0,
      tabUntil: isTimeWindowActive(tabUntil, now) ? tabUntil : 0,
      until,
      remainingMs: until > 0 ? getTimeWindowRemainingMs(until, now) : 0,
      scope: resolveActiveScope(hostUntil, tabUntil, now),
    };
  }

  function evictTab(tabId) {
    const normalizedTabId = normalizeTabId(tabId);
    if (normalizedTabId === null) return false;
    return tabPassesByTabId.delete(normalizedTabId);
  }

  function evictHost(hostname) {
    const normalizedHostname = normalizeHost(hostname);
    if (!normalizedHostname) return false;
    const prefix = `${normalizedHostname}${PASS_KEY_SEPARATOR}`;
    let evicted = false;
    hostPasses.forEach((_until, key) => {
      if (key.startsWith(prefix)) {
        hostPasses.delete(key);
        evicted = true;
      }
    });
    tabPassesByTabId.forEach((byKey, tabId) => {
      byKey.forEach((_until, key) => {
        if (key.startsWith(prefix)) {
          byKey.delete(key);
          evicted = true;
        }
      });
      if (!byKey.size) tabPassesByTabId.delete(tabId);
    });
    return evicted;
  }

  function clear() {
    hostPasses.clear();
    tabPassesByTabId.clear();
  }

  return Object.freeze({
    clear,
    describeFor,
    evictHost,
    evictTab,
    grant,
    isActive,
    resolveUntil,
    snapshotFor,
  });
}

export default createGateInterventionPassLedger;
