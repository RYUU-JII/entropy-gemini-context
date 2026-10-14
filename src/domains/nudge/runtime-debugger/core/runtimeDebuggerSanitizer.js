const DEFAULT_LIMITS = Object.freeze({
  maxDepth: 9,
  maxArrayItems: 32,
  maxObjectKeys: 64,
  maxStringLength: 512,
});

const HARD_LIMITS = Object.freeze({
  maxDepth: 10,
  maxArrayItems: 100,
  maxObjectKeys: 160,
  maxStringLength: 2000,
});

const UNSAFE_OBJECT_KEYS = new Set(['__proto__', 'constructor', 'prototype']);
const SENSITIVE_VALUE_KEYS = new Set([
  'apikey',
  'authorization',
  'cookie',
  'password',
  'refreshtoken',
  'secret',
  'setcookie',
  'token',
  'accesstoken',
]);

function resolveLimit(value, fallback, hardLimit) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric < 1) return fallback;
  return Math.min(Math.floor(numeric), hardLimit);
}

function resolveLimits(overrides = {}) {
  return {
    maxDepth: resolveLimit(overrides.maxDepth, DEFAULT_LIMITS.maxDepth, HARD_LIMITS.maxDepth),
    maxArrayItems: resolveLimit(
      overrides.maxArrayItems,
      DEFAULT_LIMITS.maxArrayItems,
      HARD_LIMITS.maxArrayItems,
    ),
    maxObjectKeys: resolveLimit(
      overrides.maxObjectKeys,
      DEFAULT_LIMITS.maxObjectKeys,
      HARD_LIMITS.maxObjectKeys,
    ),
    maxStringLength: resolveLimit(
      overrides.maxStringLength,
      DEFAULT_LIMITS.maxStringLength,
      HARD_LIMITS.maxStringLength,
    ),
  };
}

function truncateString(value, maxLength) {
  const text = String(value);
  if (text.length <= maxLength) return text;
  return `${text.slice(0, Math.max(0, maxLength - 1))}…`;
}

function isUrlKey(key) {
  return /(?:^|[_-])(?:href|url)$/i.test(key) || /(?:Href|URL|Url)$/.test(key);
}

function isSensitiveValueKey(key) {
  return SENSITIVE_VALUE_KEYS.has(String(key).replace(/[_-]/g, '').toLowerCase());
}

function getObjectTag(value) {
  try {
    return Object.prototype.toString.call(value).slice(8, -1) || 'Object';
  } catch {
    return 'Object';
  }
}

function isPlainObject(value) {
  if (!value || typeof value !== 'object') return false;
  try {
    const prototype = Object.getPrototypeOf(value);
    return prototype === Object.prototype || prototype === null;
  } catch {
    return false;
  }
}

export function sanitizeRuntimeDebuggerUrl(value, { maxLength = DEFAULT_LIMITS.maxStringLength } = {}) {
  const boundedMaxLength = resolveLimit(
    maxLength,
    DEFAULT_LIMITS.maxStringLength,
    HARD_LIMITS.maxStringLength,
  );
  const raw = String(value ?? '');
  if (!raw) return '';

  try {
    const parsed = new URL(raw);
    parsed.search = '';
    parsed.hash = '';
    parsed.username = '';
    parsed.password = '';
    return truncateString(parsed.toString(), boundedMaxLength);
  } catch {
    const boundary = raw.search(/[?#]/);
    const withoutQueryOrHash = boundary >= 0 ? raw.slice(0, boundary) : raw;
    return truncateString(withoutQueryOrHash, boundedMaxLength);
  }
}

export function sanitizeRuntimeDebuggerValue(value, options = {}) {
  const limits = resolveLimits(options);
  const ancestors = new WeakSet();

  const visit = (current, depth, key = '') => {
    if (isSensitiveValueKey(key)) return '[Redacted]';
    if (current === null || current === undefined) return null;
    if (typeof current === 'string') {
      if (isUrlKey(key)) {
        return sanitizeRuntimeDebuggerUrl(current, { maxLength: limits.maxStringLength });
      }
      return truncateString(current, limits.maxStringLength);
    }
    if (typeof current === 'boolean') return current;
    if (typeof current === 'number') {
      return Number.isFinite(current) ? current : '[NonFiniteNumber]';
    }
    if (typeof current === 'bigint') {
      return truncateString(`${current.toString()}n`, limits.maxStringLength);
    }
    if (typeof current === 'function' || typeof current === 'symbol') {
      return `[Unsupported:${typeof current}]`;
    }
    if (depth >= limits.maxDepth) return '[DepthLimit]';
    if (ancestors.has(current)) return '[Circular]';

    if (current instanceof Date) {
      const time = current.getTime();
      return Number.isFinite(time) ? current.toISOString() : '[InvalidDate]';
    }
    if (current instanceof Error) {
      return {
        name: truncateString(current.name || 'Error', limits.maxStringLength),
        message: truncateString(current.message || '', limits.maxStringLength),
      };
    }

    ancestors.add(current);
    try {
      if (Array.isArray(current)) {
        const length = Math.min(current.length, limits.maxArrayItems);
        const sanitized = [];
        for (let index = 0; index < length; index += 1) {
          let item;
          try {
            item = current[index];
          } catch {
            item = '[Unreadable]';
          }
          sanitized.push(visit(item, depth + 1, String(index)));
        }
        if (current.length > limits.maxArrayItems) sanitized.push('[ArrayLimit]');
        return sanitized;
      }

      if (!isPlainObject(current)) return `[${getObjectTag(current)}]`;

      const sanitized = Object.create(null);
      let allKeys;
      try {
        allKeys = Object.keys(current).filter((itemKey) => !UNSAFE_OBJECT_KEYS.has(itemKey));
      } catch {
        return '[UnreadableObject]';
      }
      const keys = allKeys.slice(0, limits.maxObjectKeys);
      for (const itemKey of keys) {
        let item;
        try {
          item = current[itemKey];
        } catch {
          item = '[Unreadable]';
        }
        sanitized[itemKey] = visit(item, depth + 1, itemKey);
      }
      if (allKeys.length > limits.maxObjectKeys) {
        sanitized._truncated = '[ObjectKeyLimit]';
      }
      return sanitized;
    } finally {
      ancestors.delete(current);
    }
  };

  return visit(value, 0);
}
