import {
  FEED_CONTENT_FLOW_COUNT_FIELDS,
  FEED_CONTENT_FLOW_MAX_FIELDS,
  FEED_CONTENT_FLOW_MAX_CIVIL_HOUR_SPAN_MS,
  requireFeedContentFlowHistory,
} from './feedContentFlowHistory.js';

export const FEED_HISTORY_RECEIPTS_PER_HOUR_LIMIT = 256;
const RECEIPT_KEYS = ['documentId', 'hostname', 'producerId', 'bucketStartTs', 'startedAt', 'observedAt', 'sequence', 'stats'];

function fail(code) {
  throw new Error(`STATS_FEED_HISTORY_${code}`);
}

export function feedHistoryReceiptKey(receipt) {
  return `${receipt.bucketStartTs}:${receipt.documentId}:${receipt.producerId}`;
}

export function requireFeedHistoryReceipt(receipt) {
  if (!receipt || typeof receipt !== 'object' || Array.isArray(receipt)
    || Object.keys(receipt).length !== RECEIPT_KEYS.length
    || RECEIPT_KEYS.some((key) => !Object.hasOwn(receipt, key))) fail('RECEIPT_INVALID');
  if (typeof receipt.documentId !== 'string' || !/^[a-zA-Z0-9._:-]{1,128}$/.test(receipt.documentId)) {
    fail('DOCUMENT_INVALID');
  }
  if (typeof receipt.hostname !== 'string' || !receipt.hostname
    || receipt.hostname !== receipt.hostname.trim().toLowerCase()
    || /[\s/:]/.test(receipt.hostname)) fail('HOST_INVALID');
  const { documentId, hostname, ...history } = receipt;
  const normalized = requireFeedContentFlowHistory(history, { validateLocalHour: false });
  return Object.freeze({ documentId, hostname, ...normalized, stats: Object.freeze(normalized.stats) });
}

// Optional on V1 rows: absence means this row has no receipted feed contribution.
// A present malformed/empty field is never repaired into an absent field.
export function requireFeedHistoryReceipts(receipts, { bucketStartTs = null } = {}) {
  if (!Array.isArray(receipts) || !receipts.length || receipts.length > 24 * FEED_HISTORY_RECEIPTS_PER_HOUR_LIMIT) {
    fail('RECEIPTS_INVALID');
  }
  const seen = new Set();
  const hourCounts = new Map();
  return Object.freeze(receipts.map((value) => {
    const receipt = requireFeedHistoryReceipt(value);
    const key = feedHistoryReceiptKey(receipt);
    if (seen.has(key)) fail('RECEIPT_DUPLICATE');
    if (bucketStartTs !== null && receipt.bucketStartTs !== bucketStartTs) fail('BUCKET_MISMATCH');
    seen.add(key);
    const count = (hourCounts.get(receipt.bucketStartTs) || 0) + 1;
    if (count > FEED_HISTORY_RECEIPTS_PER_HOUR_LIMIT) fail('CAPACITY_EXCEEDED');
    hourCounts.set(receipt.bucketStartTs, count);
    return receipt;
  }));
}

export function prepareFeedHistoryContribution(receipts, incoming) {
  const receipt = requireFeedHistoryReceipt(incoming);
  const key = feedHistoryReceiptKey(receipt);
  const previous = receipts.find((value) => feedHistoryReceiptKey(value) === key);
  if (previous && previous.hostname !== receipt.hostname) fail('SOURCE_HOST_CHANGED');
  if (previous && previous.startedAt !== receipt.startedAt) fail('SOURCE_START_CHANGED');
  if (previous && receipt.sequence < previous.sequence) return null;
  if (previous && receipt.sequence === previous.sequence) {
    if (previous.observedAt !== receipt.observedAt
      || [...FEED_CONTENT_FLOW_COUNT_FIELDS, ...FEED_CONTENT_FLOW_MAX_FIELDS]
        .some((field) => previous.stats[field] !== receipt.stats[field])) fail('SEQUENCE_CONFLICT');
    return null;
  }
  if (previous && receipt.observedAt < previous.observedAt) fail('TIME_REGRESSION');
  const stats = {};
  for (const field of [...FEED_CONTENT_FLOW_COUNT_FIELDS, ...FEED_CONTENT_FLOW_MAX_FIELDS]) {
    if (previous && receipt.stats[field] < previous.stats[field]) fail('COUNTER_REGRESSION');
    stats[field] = FEED_CONTENT_FLOW_COUNT_FIELDS.includes(field)
      ? receipt.stats[field] - (previous ? previous.stats[field] : 0)
      : receipt.stats[field];
  }
  if (!previous && receipts.filter((value) => value.bucketStartTs === receipt.bucketStartTs).length
    >= FEED_HISTORY_RECEIPTS_PER_HOUR_LIMIT) fail('CAPACITY_EXCEEDED');
  return {
    stats,
    receipts: Object.freeze([...receipts.filter((value) => feedHistoryReceiptKey(value) !== key), receipt]),
  };
}

export function requireFeedHistoryResetAt(value, { bucketStartTs = null } = {}) {
  if (!Number.isSafeInteger(value) || value < 0
    || (bucketStartTs !== null && (value < bucketStartTs || value >= bucketStartTs + FEED_CONTENT_FLOW_MAX_CIVIL_HOUR_SPAN_MS))) {
    fail('RESET_AT_INVALID');
  }
  return value;
}
