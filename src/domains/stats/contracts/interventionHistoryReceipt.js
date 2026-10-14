// Historical fact identity is scoped by the existing profile lifetime. These
// receipts share the hourly counter commit; they are not a policy or retry log.
export const INTERVENTION_HISTORY_RECEIPTS_PER_HOUR_LIMIT = 128;
export const INTERVENTION_HISTORY_EVENTS = Object.freeze(['shown', 'continued', 'left', 'escape_closed', 'reentered']);
const KEYS = ['exposureId', 'hostname', 'event', 'at', 'shownAt', 'dateStr', 'bucketStartTs'];
const fail = code => { throw new Error(`INTERVENTION_HISTORY_${code}`); };
const timestamp = value => Number.isSafeInteger(value) && value >= 0;
const record = value => value && typeof value === 'object' && !Array.isArray(value);
const dateString = value => {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
};

export function requireInterventionHistoryFacts(facts, exposureShownAt, recordedEvents) {
  if (!record(facts) || !Object.hasOwn(facts, 'shown')) fail('FACTS_INVALID');
  const expected = recordedEvents.filter(event => INTERVENTION_HISTORY_EVENTS.includes(event));
  if (Object.keys(facts).length !== expected.length) fail('FACTS_EVENTS_MISMATCH');
  const result = {};
  for (const event of expected) {
    const fact = facts[event];
    if (!record(fact) || Object.keys(fact).length !== 4 || !timestamp(fact.at) || !timestamp(fact.shownAt)
      || fact.at < exposureShownAt || fact.shownAt > fact.at
      || !dateString(fact.dateStr) || !timestamp(fact.bucketStartTs)
      || fact.at < fact.bucketStartTs || fact.at >= fact.bucketStartTs + 7_200_000
      || (event === 'shown' && (fact.at !== exposureShownAt || fact.shownAt !== exposureShownAt))) fail('FACT_INVALID');
    result[event] = Object.freeze({ ...fact });
  }
  return Object.freeze(result);
}

export function requireInterventionHistoryReceipt(value) {
  if (!record(value) || Object.keys(value).length !== KEYS.length || KEYS.some(key => !Object.hasOwn(value, key))
    || typeof value.exposureId !== 'string' || !value.exposureId.trim() || value.exposureId.trim() !== value.exposureId || value.exposureId.length > 160
    || typeof value.hostname !== 'string' || !value.hostname || value.hostname !== value.hostname.trim().toLowerCase() || value.hostname.length > 253
    || !INTERVENTION_HISTORY_EVENTS.includes(value.event)
    || !timestamp(value.at) || !timestamp(value.shownAt) || value.shownAt > value.at
    || !dateString(value.dateStr)
    || !timestamp(value.bucketStartTs) || value.at < value.bucketStartTs || value.at >= value.bucketStartTs + 7_200_000) fail('RECEIPT_INVALID');
  return Object.freeze({ ...value });
}

export function interventionHistoryReceiptKey(value) { return JSON.stringify([value.exposureId, value.event]); }

export function requireInterventionHistoryReceipts(values, { bucketStartTs = null, dateStr = null } = {}) {
  if (!Array.isArray(values) || values.length > 24 * INTERVENTION_HISTORY_RECEIPTS_PER_HOUR_LIMIT) fail('RECEIPTS_INVALID');
  const seen = new Set(), hours = new Map();
  return Object.freeze(values.map(value => {
    const receipt = requireInterventionHistoryReceipt(value);
    const key = interventionHistoryReceiptKey(receipt);
    if (seen.has(key)) fail('RECEIPT_DUPLICATE');
    if (bucketStartTs !== null && receipt.bucketStartTs !== bucketStartTs) fail('BUCKET_MISMATCH');
    if (dateStr !== null && receipt.dateStr !== dateStr) fail('DATE_MISMATCH');
    seen.add(key);
    const count = (hours.get(receipt.bucketStartTs) || 0) + 1;
    if (count > INTERVENTION_HISTORY_RECEIPTS_PER_HOUR_LIMIT) fail('CAPACITY_EXCEEDED');
    hours.set(receipt.bucketStartTs, count);
    return receipt;
  }));
}

export function prepareInterventionHistoryReceipt(values, incoming) {
  const receipt = requireInterventionHistoryReceipt(incoming);
  const key = interventionHistoryReceiptKey(receipt);
  const previous = values.find(value => interventionHistoryReceiptKey(value) === key);
  if (previous) {
    if (KEYS.some(key => previous[key] !== receipt[key])) fail('SOURCE_CONFLICT');
    return null;
  }
  return requireInterventionHistoryReceipts([...values, receipt]);
}

export function assertInterventionHistoryReceiptsCovered(receipts, domains) {
  const counts = new Map();
  for (const receipt of receipts) {
    const required = counts.get(receipt.hostname) || {};
    const fields = receipt.event === 'shown' ? ['frictionShown']
      : receipt.event === 'escape_closed' ? ['escapeClosed']
        : receipt.event === 'reentered'
          ? (receipt.at > receipt.shownAt && receipt.at - receipt.shownAt <= 1_800_000
            ? ['reenteredWithin30m', ...(receipt.at - receipt.shownAt <= 300_000 ? ['reenteredWithin5m'] : [])] : [])
          : [receipt.event];
    for (const field of fields) required[field] = (required[field] || 0) + 1;
    counts.set(receipt.hostname, required);
  }
  for (const [hostname, fields] of counts) {
    for (const [field, expected] of Object.entries(fields)) {
      const actual = domains?.[hostname]?.interventions?.[field];
      if (!Number.isSafeInteger(actual) || actual < expected) fail('FACTS_UNDERCOUNT');
    }
  }
}
