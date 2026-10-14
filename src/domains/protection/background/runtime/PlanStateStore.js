function normalizeHost(host) {
  return typeof host === 'string' ? host.trim().toLowerCase() : '';
}

function normalizeTabId(tabId) {
  const num = Number(tabId);
  return Number.isInteger(num) ? num : -1;
}

export function buildPlanStateKey({
  host = '',
  tabId = -1,
} = {}) {
  return `${normalizeHost(host)}::${normalizeTabId(tabId)}`;
}

export function createPlanStateStore() {
  const stateByKey = new Map();

  function get(scope = {}) {
    return stateByKey.get(buildPlanStateKey(scope)) || null;
  }

  function set(scope = {}, value = null) {
    const key = buildPlanStateKey(scope);
    if (!value) {
      stateByKey.delete(key);
      return null;
    }

    const nextValue = {
      ...value,
      host: normalizeHost(scope.host),
      tabId: normalizeTabId(scope.tabId),
    };
    stateByKey.set(key, nextValue);
    return nextValue;
  }

  function clear(scope = {}) {
    const hasHost = typeof scope.host === 'string' && scope.host.trim().length > 0;
    const hasTabId = Number.isInteger(Number(scope.tabId));

    if (!hasHost && !hasTabId) {
      stateByKey.clear();
      return;
    }

    for (const [key, value] of stateByKey.entries()) {
      const hostMatches = !hasHost || value.host === normalizeHost(scope.host);
      const tabMatches = !hasTabId || value.tabId === normalizeTabId(scope.tabId);
      if (hostMatches && tabMatches) {
        stateByKey.delete(key);
      }
    }
  }

  function entries() {
    return Array.from(stateByKey.values());
  }

  return {
    get,
    set,
    clear,
    entries,
  };
}
