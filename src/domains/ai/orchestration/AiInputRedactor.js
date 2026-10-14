const BLOCKED_INPUT_KEYS = new Set([
  'html',
  'innerHTML',
  'rawHtml',
  'rawLog',
  'rawLogs',
  'url',
  'urls',
  'rawUrl',
  'rawUrls',
  'documentUrl',
  'pageUrl',
  'fullUrl',
  'href',
  'history',
  'documentText',
  'bodyText',
  'pageText',
  'rawText',
  'innerText',
  'textContent',
  'referrer',
  'referer',
].map(normalizeInputKey));

const DEFAULT_REDACTION_LIMITS = Object.freeze({
  maxDepth: 6,
  maxArrayItems: 16,
  maxStringLength: 700,
});

const URL_VALUE_PATTERN = /\b(?:(?:https?|chrome-extension|moz-extension|file):\/\/|www\.)[^\s)]+/gi;
const RAW_DOCUMENT_KEY_PATTERN = /^(?:raw|page|document|body|inner|full).*(?:html|text|log|logs)$/;

function normalizeInputKey(key) {
  return String(key).trim().toLowerCase().replace(/[\s_-]+/g, '');
}

function isBlockedInputKey(key) {
  const normalizedKey = normalizeInputKey(key);
  return BLOCKED_INPUT_KEYS.has(normalizedKey)
    || normalizedKey.endsWith('url')
    || normalizedKey.endsWith('urls')
    || RAW_DOCUMENT_KEY_PATTERN.test(normalizedKey);
}

function truncateString(value, maxStringLength) {
  if (value.length <= maxStringLength) return value;
  return `${value.slice(0, Math.max(0, maxStringLength - 3))}...`;
}

function redactStringValue(value, limits) {
  return truncateString(value.replace(URL_VALUE_PATTERN, '[redacted-url]'), limits.maxStringLength);
}

function redactValue(value, depth, limits) {
  if (depth > limits.maxDepth) return '[depth-limit]';
  if (value === null) return null;
  if (typeof value === 'string') return redactStringValue(value, limits);
  if (typeof value === 'number' || typeof value === 'boolean') return value;
  if (Array.isArray(value)) {
    return value.slice(0, limits.maxArrayItems).map((item) => redactValue(item, depth + 1, limits));
  }
  if (typeof value !== 'object') return null;

  const next = {};
  for (const [key, child] of Object.entries(value)) {
    if (isBlockedInputKey(key)) {
      next[key] = '[redacted]';
      continue;
    }
    next[key] = redactValue(child, depth + 1, limits);
  }
  return next;
}

export function redactAiInput(value, limits = {}) {
  const resolvedLimits = {
    ...DEFAULT_REDACTION_LIMITS,
    ...(limits && typeof limits === 'object' ? limits : {}),
  };
  return redactValue(value, 0, resolvedLimits);
}
