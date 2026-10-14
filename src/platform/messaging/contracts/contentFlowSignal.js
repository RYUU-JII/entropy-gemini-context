export const CONTENT_FLOW_SIGNAL_SCHEMA_VERSION = 1;
export const CONTENT_FLOW_SCROLL_SPIKE_MAX_BATCH_COUNT = 10_000;
// The background lease must expire first so the sender can observe a named
// commit failure before its own transport channel closes.
export const CONTENT_FLOW_SIGNAL_COMMIT_DEADLINE_MS = 1_500;
export const CONTENT_FLOW_SIGNAL_DELIVERY_TIMEOUT_MS = 2_000;

export const CONTENT_FLOW_SIGNAL_KINDS = Object.freeze({
  SCROLL_SPIKE: 'scroll_spike',
  SHORT_MEDIA_ATTENTION: 'short_media_attention',
});

const COMMON_KEYS = Object.freeze(['schemaVersion', 'kind', 'observedAt']);
const SIGNAL_KEYS = Object.freeze({
  [CONTENT_FLOW_SIGNAL_KINDS.SCROLL_SPIKE]: Object.freeze([
    ...COMMON_KEYS,
    'scrollSpikeBursts',
    'fastScrollBursts',
  ]),
  [CONTENT_FLOW_SIGNAL_KINDS.SHORT_MEDIA_ATTENTION]: Object.freeze([...COMMON_KEYS, 'watchMs']),
});

function hasExactKeys(value, expectedKeys) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const actualKeys = Object.keys(value);
  return actualKeys.length === expectedKeys.length
    && expectedKeys.every((key) => Object.prototype.hasOwnProperty.call(value, key));
}

function requirePositiveTimestamp(value) {
  if (!Number.isSafeInteger(value) || value <= 0) {
    throw new Error('CONTENT_FLOW_SIGNAL_OBSERVED_AT_INVALID');
  }
  return value;
}

function requirePositiveMeasurement(value, fieldName) {
  if (!Number.isFinite(value) || value <= 0) {
    throw new Error(`CONTENT_FLOW_SIGNAL_${fieldName.toUpperCase()}_INVALID`);
  }
  return value;
}

function requireCount(value, fieldName, { allowZero = false } = {}) {
  if (
    !Number.isSafeInteger(value)
    || value < (allowZero ? 0 : 1)
    || value > CONTENT_FLOW_SCROLL_SPIKE_MAX_BATCH_COUNT
  ) {
    throw new Error(`CONTENT_FLOW_SIGNAL_${fieldName.toUpperCase()}_INVALID`);
  }
  return value;
}

export function readContentFlowSignal(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('CONTENT_FLOW_SIGNAL_INVALID');
  }
  if (value.schemaVersion !== CONTENT_FLOW_SIGNAL_SCHEMA_VERSION) {
    throw new Error('CONTENT_FLOW_SIGNAL_VERSION_UNSUPPORTED');
  }
  const expectedKeys = SIGNAL_KEYS[value.kind];
  if (!expectedKeys) {
    throw new Error('CONTENT_FLOW_SIGNAL_KIND_INVALID');
  }
  if (!hasExactKeys(value, expectedKeys)) {
    throw new Error('CONTENT_FLOW_SIGNAL_SHAPE_INVALID');
  }

  const base = {
    schemaVersion: CONTENT_FLOW_SIGNAL_SCHEMA_VERSION,
    kind: value.kind,
    observedAt: requirePositiveTimestamp(value.observedAt),
  };
  if (value.kind === CONTENT_FLOW_SIGNAL_KINDS.SCROLL_SPIKE) {
    const scrollSpikeBursts = requireCount(value.scrollSpikeBursts, 'scroll_spike_bursts');
    const fastScrollBursts = requireCount(value.fastScrollBursts, 'fast_scroll_bursts', {
      allowZero: true,
    });
    if (fastScrollBursts > scrollSpikeBursts) {
      throw new Error('CONTENT_FLOW_SIGNAL_FAST_SCROLL_BURSTS_EXCEED_TOTAL');
    }
    return {
      ...base,
      scrollSpikeBursts,
      fastScrollBursts,
    };
  }
  return {
    ...base,
    watchMs: requirePositiveMeasurement(value.watchMs, 'watch_ms'),
  };
}

export function createContentFlowSignal({ kind, observedAt = Date.now(), ...measurement } = {}) {
  return readContentFlowSignal({
    schemaVersion: CONTENT_FLOW_SIGNAL_SCHEMA_VERSION,
    kind,
    observedAt,
    ...measurement,
  });
}
