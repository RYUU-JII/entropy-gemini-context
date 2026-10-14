function normalizeTabId(tabId) {
  if (tabId === null || tabId === undefined) return null;
  if (typeof tabId === 'string' && !tabId.trim()) return null;
  const value = Number(tabId);
  if (!Number.isInteger(value) || value < 0) return null;
  return value;
}

function normalizeLimit(limit, fallback = 40) {
  const value = Number(limit);
  if (!Number.isFinite(value) || value <= 0) return fallback;
  return Math.min(200, Math.max(1, Math.floor(value)));
}

function cloneEntry(entry) {
  if (!entry || typeof entry !== 'object') return null;
  return {
    ...entry,
  };
}

export function createContentRuntimeDiagnostics({
  maxEntries = 200,
} = {}) {
  const capacity = normalizeLimit(maxEntries, 200);
  let sequence = 0;
  let entries = [];

  function record(event, payload = {}) {
    const eventName = typeof event === 'string' ? event.trim() : '';
    if (!eventName) {
      throw new Error('CONTENT_RUNTIME_DIAGNOSTIC_EVENT_REQUIRED');
    }

    const entry = {
      id: ++sequence,
      recordedAt: Date.now(),
      event: eventName,
      ...payload,
      tabId: normalizeTabId(payload?.tabId),
    };

    entries.push(entry);
    if (entries.length > capacity) {
      entries = entries.slice(entries.length - capacity);
    }
    return cloneEntry(entry);
  }

  function list({
    tabId = null,
    limit = 40,
  } = {}) {
    const normalizedTabId = normalizeTabId(tabId);
    const normalizedLimit = normalizeLimit(limit, 40);
    const filtered = normalizedTabId === null
      ? entries
      : entries.filter((entry) => entry?.tabId === normalizedTabId);
    return filtered.slice(-normalizedLimit).map((entry) => cloneEntry(entry));
  }

  function getMeta() {
    return {
      generatedAt: Date.now(),
      maxEntries: capacity,
      totalEntries: entries.length,
      nextSequence: sequence + 1,
    };
  }

  return {
    getMeta,
    list,
    record,
  };
}

export default createContentRuntimeDiagnostics;
