import {
  FEED_CONTENT_FLOW_COUNT_FIELDS,
  FEED_CONTENT_FLOW_MAX_FIELDS,
  FEED_CONTENT_FLOW_STAT_FIELDS,
  createEmptyFeedContentFlowStats,
} from './feedContentFlowHistory.js';

function fail(code, hostname = '', field = '') {
  const error = new Error(`STATS_FEED_HISTORY_RECEIPT_${code}${hostname ? `:${hostname}` : ''}${field ? `:${field}` : ''}`);
  error.code = `STATS_FEED_HISTORY_RECEIPT_${code}`;
  throw error;
}

function isRecord(value) {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function requireStat(value, hostname, field) {
  const valid = field === 'maxFeedScreenfuls'
    ? typeof value === 'number' && Number.isFinite(value)
    : Number.isSafeInteger(value);
  if (!valid || value < 0) fail('STAT_INVALID', hostname, field);
  return value;
}

// Receipt identity/shape is validated by requireFeedHistoryReceipts at the
// enclosing boundary. This assertion owns only receipt-to-fact integrity and
// works for both hourly domain deltas and normalized daily domain records.
export function assertFeedHistoryReceiptsCovered(receipts, domains) {
  if (!Array.isArray(receipts) || !isRecord(domains)) fail('COVERAGE_INPUT_INVALID');
  const requiredByHostname = new Map();
  receipts.forEach((receipt) => {
    if (!isRecord(receipt) || typeof receipt.hostname !== 'string' || !receipt.hostname
      || !isRecord(receipt.stats)) fail('COVERAGE_INPUT_INVALID');
    const hostname = receipt.hostname;
    if (!requiredByHostname.has(hostname)) {
      requiredByHostname.set(hostname, createEmptyFeedContentFlowStats());
    }
    const required = requiredByHostname.get(hostname);
    FEED_CONTENT_FLOW_COUNT_FIELDS.forEach((field) => {
      const sum = required[field] + requireStat(receipt.stats[field], hostname, field);
      if (!Number.isSafeInteger(sum)) fail('COUNT_SUM_OVERFLOW', hostname, field);
      required[field] = sum;
    });
    FEED_CONTENT_FLOW_MAX_FIELDS.forEach((field) => {
      required[field] = Math.max(required[field], requireStat(receipt.stats[field], hostname, field));
    });
  });

  requiredByHostname.forEach((required, hostname) => {
    if (!Object.hasOwn(domains, hostname)) {
      if (FEED_CONTENT_FLOW_STAT_FIELDS.some((field) => required[field] > 0)) {
        fail('DOMAIN_FACTS_MISSING', hostname);
      }
      return;
    }
    const behavior = domains[hostname]?.behavior;
    if (!isRecord(behavior)) fail('DOMAIN_BEHAVIOR_INVALID', hostname);
    FEED_CONTENT_FLOW_STAT_FIELDS.forEach((field) => {
      const actual = requireStat(behavior[field], hostname, field);
      // Additional facts without receipts are valid (for example, earlier
      // history). A receipt must never claim more than the facts contain.
      if (actual < required[field]) fail('FACTS_UNDERCOUNT', hostname, field);
    });
  });
}
