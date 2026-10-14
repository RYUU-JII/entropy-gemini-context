export const SPIKE_PROTOCOL_VERSION = 1;

export const SPIKE_SIGNAL_TYPE = Object.freeze({
  TAB_SWITCH: 'tab_switch_spike',
  NAVIGATION_LOOP: 'navigation_loop_spike',
  SCROLL_VOLATILITY: 'scroll_volatility_spike',
  MEDIA_SEEK: 'media_seek_spike',
  COMPOSITE: 'composite_spike',
  SUSTAINED_DRIFT: 'sustained_drift',
});

export const SPIKE_SIGNAL_SOURCE = Object.freeze({
  CLSE_LOAD_SPIKE: 'clse_load_spike',
  CLSE_SUSTAINED_LOAD: 'clse_sustained_load',
  PROTOCOL_INPUT: 'protocol_input',
});

export const SPIKE_REASON_CODE = Object.freeze({
  RAPID_TAB_SWITCHING: 'rapid_tab_switching',
  NAVIGATION_LOOP: 'navigation_loop',
  SCROLL_VOLATILITY: 'scroll_volatility',
  MEDIA_SKIMMING: 'media_skimming',
  MULTI_SIGNAL_BURST: 'multi_signal_burst',
  SUSTAINED_DRIFT: 'sustained_drift',
});

const SPIKE_SIGNAL_FIELDS = Object.freeze([
  'id',
  'type',
  'source',
  'observedAtMs',
  'durationMs',
  'severity',
  'confidence',
  'reasonCodes',
  'window',
  'metrics',
]);
const SPIKE_WINDOW_FIELDS = Object.freeze(['startedAtMs', 'endedAtMs']);
const SPIKE_METRICS_FIELDS = Object.freeze(['value', 'components']);
const SPIKE_SIGNAL_TYPE_SET = new Set(Object.values(SPIKE_SIGNAL_TYPE));
const SPIKE_SIGNAL_SOURCE_SET = new Set(Object.values(SPIKE_SIGNAL_SOURCE));
const SPIKE_REASON_CODE_SET = new Set(Object.values(SPIKE_REASON_CODE));

const isPlainObject = (value) => (
  Boolean(value && typeof value === 'object' && !Array.isArray(value))
);

const hasExactKeys = (value, expectedKeys) => {
  if (!isPlainObject(value)) return false;
  const actualKeys = Object.keys(value).sort();
  const canonicalKeys = [...expectedKeys].sort();
  return actualKeys.length === canonicalKeys.length
    && actualKeys.every((key, index) => key === canonicalKeys[index]);
};

const failSpikeSignal = (field) => {
  throw new Error(`SPIKE_SIGNAL_V1_CONTRACT_INVALID:${field}`);
};

const requireNonNegativeInteger = (value, field) => {
  if (!Number.isSafeInteger(value) || value < 0) failSpikeSignal(field);
  return value;
};

const requireRatio = (value, field) => {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0 || value > 1) {
    failSpikeSignal(field);
  }
  return value;
};

export function normalizeSpikeSignal(candidate = null) {
  if (!hasExactKeys(candidate, SPIKE_SIGNAL_FIELDS)) failSpikeSignal('fields');
  if (typeof candidate.id !== 'string' || !candidate.id || candidate.id.trim() !== candidate.id) {
    failSpikeSignal('id');
  }
  if (!SPIKE_SIGNAL_TYPE_SET.has(candidate.type)) failSpikeSignal('type');
  if (!SPIKE_SIGNAL_SOURCE_SET.has(candidate.source)) failSpikeSignal('source');

  const observedAtMs = requireNonNegativeInteger(candidate.observedAtMs, 'observedAtMs');
  const durationMs = requireNonNegativeInteger(candidate.durationMs, 'durationMs');
  const severity = requireRatio(candidate.severity, 'severity');
  const confidence = requireRatio(candidate.confidence, 'confidence');

  if (!Array.isArray(candidate.reasonCodes)
    || candidate.reasonCodes.some((code) => !SPIKE_REASON_CODE_SET.has(code))
    || new Set(candidate.reasonCodes).size !== candidate.reasonCodes.length) {
    failSpikeSignal('reasonCodes');
  }
  if (!hasExactKeys(candidate.window, SPIKE_WINDOW_FIELDS)) failSpikeSignal('window.fields');
  const startedAtMs = requireNonNegativeInteger(candidate.window.startedAtMs, 'window.startedAtMs');
  const endedAtMs = requireNonNegativeInteger(candidate.window.endedAtMs, 'window.endedAtMs');
  if (endedAtMs < startedAtMs || observedAtMs < endedAtMs) failSpikeSignal('window.order');

  if (!hasExactKeys(candidate.metrics, SPIKE_METRICS_FIELDS)) failSpikeSignal('metrics.fields');
  if (candidate.metrics.value !== null
    && (typeof candidate.metrics.value !== 'number' || !Number.isFinite(candidate.metrics.value))) {
    failSpikeSignal('metrics.value');
  }
  if (!Array.isArray(candidate.metrics.components)) failSpikeSignal('metrics.components');

  return {
    id: candidate.id,
    type: candidate.type,
    source: candidate.source,
    observedAtMs,
    durationMs,
    severity,
    confidence,
    reasonCodes: [...candidate.reasonCodes],
    window: { startedAtMs, endedAtMs },
    metrics: {
      value: candidate.metrics.value,
      components: [...candidate.metrics.components],
    },
  };
}

export function normalizeSpikeSignals(candidates = []) {
  if (!Array.isArray(candidates)) failSpikeSignal('list');
  return candidates.map((entry) => normalizeSpikeSignal(entry));
}
