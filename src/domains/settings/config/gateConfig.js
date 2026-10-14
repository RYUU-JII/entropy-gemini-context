export const GATE_PROTECTED_TAB_MIN = 1;
export const GATE_PROTECTED_TAB_MAX = 20;
export const GATE_ENTRY_HOLD_MS = 1_500;
export const GATE_KEPT_TAB_PASS_WINDOW_MS = 15 * 60_000;
export const GATE_DETOUR_HOLD_MS = 1_500;
export const GATE_PROTECTED_CONTEXT_CONSUME_DWELL_MS = 12_000;
export const GATE_PROTECTED_CONTEXT_WINDOW_MS = 10 * 60_000;
export const GATE_PROTECTED_CONTEXT_THRESHOLD = 3;
export const GATE_DETOUR_SPREAD_GUARD_DEFAULT_MAX_PROTECTED_TABS = 1;

// Entry and return guards are binary. Detour spread stores the protected-tab
// budget directly so policy meaning never depends on an inverted level map.
export const DEFAULT_GATE_CONFIG = Object.freeze({
  entryCheckpoint: Object.freeze({
    enabled: false,
  }),
  returnGuard: Object.freeze({
    enabled: false,
  }),
  detourSpreadGuard: Object.freeze({
    enabled: false,
    maxProtectedTabs: GATE_DETOUR_SPREAD_GUARD_DEFAULT_MAX_PROTECTED_TABS,
  }),
});

function isPlainObject(value) {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

const GATE_CONFIG_CHILD_IDS = Object.freeze([
  'entryCheckpoint',
  'returnGuard',
  'detourSpreadGuard',
]);

export function normalizeGateMaxProtectedTabs(value) {
  if (
    !Number.isInteger(value)
    || value < GATE_PROTECTED_TAB_MIN
    || value > GATE_PROTECTED_TAB_MAX
  ) {
    throw new Error(`GATE_MAX_PROTECTED_TABS_INVALID:${value ?? 'missing'}`);
  }
  return value;
}

function normalizeGateChild(rawValue, fallbackValue, childId) {
  const source = rawValue === undefined ? fallbackValue : rawValue;
  if (
    !isPlainObject(source)
    || Object.keys(source).length !== 1
    || !Object.prototype.hasOwnProperty.call(source, 'enabled')
  ) {
    throw new Error(`GATE_CHILD_CONFIG_INVALID:${childId}`);
  }
  if (typeof source.enabled !== 'boolean') {
    throw new Error(`GATE_CHILD_ENABLED_INVALID:${childId}`);
  }
  return {
    enabled: source.enabled,
  };
}

function normalizeDetourSpreadGuardChild(rawValue, fallbackValue) {
  const source = rawValue === undefined ? fallbackValue : rawValue;
  if (!isPlainObject(source)) {
    throw new Error('GATE_DETOUR_SPREAD_GUARD_INVALID');
  }
  const expectedFields = ['enabled', 'maxProtectedTabs'];
  const fields = Object.keys(source);
  if (
    fields.length !== expectedFields.length
    || expectedFields.some((field) => !Object.prototype.hasOwnProperty.call(source, field))
  ) {
    throw new Error('GATE_DETOUR_SPREAD_GUARD_INVALID');
  }
  if (typeof source.enabled !== 'boolean') {
    throw new Error('GATE_DETOUR_SPREAD_GUARD_ENABLED_INVALID');
  }
  return {
    enabled: source.enabled,
    maxProtectedTabs: normalizeGateMaxProtectedTabs(source.maxProtectedTabs),
  };
}

export function getGateEntryHoldMs() {
  return GATE_ENTRY_HOLD_MS;
}

export function getGateKeptTabPassWindowMs() {
  return GATE_KEPT_TAB_PASS_WINDOW_MS;
}

export function getGateDetourHoldMs() {
  return GATE_DETOUR_HOLD_MS;
}

export function getGateProtectedContextConsumeDwellMs() {
  return GATE_PROTECTED_CONTEXT_CONSUME_DWELL_MS;
}

export function getGateProtectedContextWindowMs() {
  return GATE_PROTECTED_CONTEXT_WINDOW_MS;
}

export function getGateProtectedContextThreshold() {
  return GATE_PROTECTED_CONTEXT_THRESHOLD;
}

export function getGateProtectedTabThreshold(maxProtectedTabs) {
  return normalizeGateMaxProtectedTabs(maxProtectedTabs) + 1;
}

export function normalizeGateConfig(rawValue, { defaults } = {}) {
  const source = rawValue === undefined ? {} : rawValue;
  const fallback = isPlainObject(defaults) ? defaults : DEFAULT_GATE_CONFIG;
  if (!isPlainObject(source)) {
    throw new Error('GATE_CONFIG_INVALID');
  }
  const unknownChildId = Object.keys(source).find(
    (childId) => !GATE_CONFIG_CHILD_IDS.includes(childId),
  );
  if (unknownChildId) {
    throw new Error(`GATE_CONFIG_CHILD_UNKNOWN:${unknownChildId}`);
  }

  return {
    entryCheckpoint: normalizeGateChild(
      source.entryCheckpoint,
      fallback.entryCheckpoint,
      'entryCheckpoint',
    ),
    returnGuard: normalizeGateChild(
      source.returnGuard,
      fallback.returnGuard,
      'returnGuard',
    ),
    detourSpreadGuard: normalizeDetourSpreadGuardChild(
      source.detourSpreadGuard,
      fallback.detourSpreadGuard,
    ),
  };
}

export function isGateConfigEnabled(rawValue) {
  const normalized = normalizeGateConfig(rawValue);
  return normalized.entryCheckpoint.enabled
    || normalized.returnGuard.enabled
    || normalized.detourSpreadGuard.enabled;
}
