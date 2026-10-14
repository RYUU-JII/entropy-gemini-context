import { isAdaptiveFrictionFeatureKey, materializeAdaptiveFrictionEntry, requireAdaptiveFrictionEntry, ADAPTIVE_FRICTION_FEATURE_KEYS } from '../../settings/config/adaptiveFrictionProfiles.js';
import { FRICTION_INTENSITY_BANDS, requireFrictionIntensityDelta, resolveFrictionIntensityBand } from '../../settings/config/frictionIntensityBands.js';
import { isKnownFeatureKey } from '../protocol/contracts/featureKeys.js';
import { normalizeCanonicalBinaryFilterEntry } from '../../settings/config/canonicalBinaryFilterProfiles.js';
import { FULLSCREEN_VISUAL_FEATURE_KEYS, resolveFullscreenVisualPolicy } from './fullscreenVisualPolicy.js';
import { isVisualFrictionProfileKey, normalizeVisualFrictionSetting, requireVisualFrictionScale, VISUAL_FRICTION_FEATURE_KEYS } from '../../settings/config/visualFrictionProfiles.js';

export const FRICTION_MODIFIER_OPERATIONS = Object.freeze({
  ADJUST_INTENSITY: 'adjust_intensity',
  SUSPEND: 'suspend',
  SCALE_STRENGTH: 'scale_strength',
});

export const FRICTION_MODIFIER_TARGETS = Object.freeze({
  FEATURE_KEYS: 'feature_keys',
  ADJUSTABLE_FILTERS: 'adjustable_filters',
  VISUAL_FILTERS: 'visual_filters',
  ALL_FEATURES: 'all_features',
});

export const FRICTION_MODIFIER_SCOPE_KINDS = Object.freeze({
  CONTENT_LOCAL: 'content_local',
  DOMAIN: 'domain',
  GLOBAL_SESSION: 'global_session',
  DURABLE_DOMAIN: 'durable_domain',
});

export const FRICTION_MODIFIER_SOURCES = Object.freeze({
  POLICY_STRENGTHENING: 'policy_strengthening',
  SCHEDULE_RELAXATION: 'schedule_relaxation',
  FURIN_OVERRUN: 'furin_overrun',
  FURIN_STAY_SUSPENSION: 'furin_stay_suspension',
  COOLING_CURVE: 'cooling_curve',
});

export const FRICTION_MODIFIER_PRIORITIES = Object.freeze({
  POLICY_STRENGTHENING: 220,
  SCHEDULE_RELAXATION: 300,
  FURIN_OVERRUN: 400,
  FURIN_STAY_SUSPENSION: 900,
  COOLING_CURVE: 250,
});

export const VISUAL_FRICTION_MODIFIER_FEATURE_KEYS = VISUAL_FRICTION_FEATURE_KEYS;

export const INTENSITY_ADJUSTABLE_FRICTION_MODIFIER_FEATURE_KEYS = ADAPTIVE_FRICTION_FEATURE_KEYS;

const OPERATION_SET = new Set(Object.values(FRICTION_MODIFIER_OPERATIONS));
const TARGET_SET = new Set(Object.values(FRICTION_MODIFIER_TARGETS));
const SCOPE_KIND_SET = new Set(Object.values(FRICTION_MODIFIER_SCOPE_KINDS));

function isPlainObject(value) {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function cloneFilterEntry(entry) {
  if (!isPlainObject(entry)) return entry;
  return { ...entry };
}

function cloneFilterRecord(filters) {
  if (!isPlainObject(filters)) {
    throw new Error('FRICTION_MODIFIER_FILTERS_INVALID');
  }
  return Object.entries(filters).reduce((acc, [key, entry]) => {
    acc[key] = cloneFilterEntry(entry);
    return acc;
  }, {});
}

function normalizeModifierId(value, source) {
  const normalized = typeof value === 'string' ? value.trim() : '';
  if (normalized) return normalized;
  const sourceText = typeof source === 'string' ? source.trim() : '';
  if (sourceText) return sourceText;
  throw new Error('FRICTION_MODIFIER_ID_REQUIRED');
}

function normalizeModifierSource(value) {
  const normalized = typeof value === 'string' ? value.trim() : '';
  if (!normalized) throw new Error('FRICTION_MODIFIER_SOURCE_REQUIRED');
  return normalized;
}

function normalizeModifierOperation(value) {
  const normalized = typeof value === 'string' ? value.trim() : '';
  if (!OPERATION_SET.has(normalized)) {
    throw new Error(`FRICTION_MODIFIER_OPERATION_INVALID:${normalized || 'empty'}`);
  }
  return normalized;
}

function normalizeModifierPriority(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return 0;
  return Math.round(numeric);
}

function normalizeModifierExpiresAt(value) {
  if (value === null || value === undefined) return null;
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    throw new Error('FRICTION_MODIFIER_EXPIRES_AT_INVALID');
  }
  return numeric;
}

function normalizeHostname(value) {
  const normalized = typeof value === 'string' ? value.trim().toLowerCase() : '';
  return normalized || '';
}

export function normalizeFrictionModifierScope(value) {
  if (!isPlainObject(value)) {
    throw new Error('FRICTION_MODIFIER_SCOPE_REQUIRED');
  }
  const kind = typeof value.kind === 'string' ? value.kind.trim() : '';
  if (!SCOPE_KIND_SET.has(kind)) {
    throw new Error(`FRICTION_MODIFIER_SCOPE_INVALID:${kind || 'empty'}`);
  }
  if (
    kind === FRICTION_MODIFIER_SCOPE_KINDS.DOMAIN
    || kind === FRICTION_MODIFIER_SCOPE_KINDS.DURABLE_DOMAIN
  ) {
    const hostname = normalizeHostname(value.hostname);
    if (!hostname) {
      throw new Error('FRICTION_MODIFIER_SCOPE_HOSTNAME_REQUIRED');
    }
    return Object.freeze({ kind, hostname });
  }
  return Object.freeze({ kind });
}

export function createFrictionModifierScopeContext(value = {}) {
  if (!isPlainObject(value)) {
    throw new Error('FRICTION_MODIFIER_SCOPE_CONTEXT_REQUIRED');
  }
  const kind = typeof value.kind === 'string' ? value.kind.trim() : '';
  if (!SCOPE_KIND_SET.has(kind)) {
    throw new Error(`FRICTION_MODIFIER_SCOPE_CONTEXT_INVALID:${kind || 'empty'}`);
  }
  const hostname = normalizeHostname(value.hostname);
  if (
    (kind === FRICTION_MODIFIER_SCOPE_KINDS.DOMAIN || kind === FRICTION_MODIFIER_SCOPE_KINDS.DURABLE_DOMAIN)
    && !hostname
  ) {
    throw new Error('FRICTION_MODIFIER_SCOPE_CONTEXT_HOSTNAME_REQUIRED');
  }
  return Object.freeze({
    kind,
    ...(hostname ? { hostname } : {}),
  });
}

function normalizeFeatureKeys(featureKeys) {
  if (!Array.isArray(featureKeys)) {
    throw new Error('FRICTION_MODIFIER_FEATURE_KEYS_REQUIRED');
  }
  const normalized = featureKeys.map((featureKey) => (
    typeof featureKey === 'string' ? featureKey.trim() : ''
  ));
  const invalidKey = normalized.find((featureKey) => !isKnownFeatureKey(featureKey));
  if (invalidKey !== undefined) {
    throw new Error(`FRICTION_MODIFIER_FEATURE_KEY_INVALID:${invalidKey || 'empty'}`);
  }
  return Array.from(new Set(normalized));
}

function normalizeModifierTarget(value) {
  const source = isPlainObject(value)
    ? value
    : { kind: FRICTION_MODIFIER_TARGETS.FEATURE_KEYS, featureKeys: value };
  const kind = typeof source.kind === 'string'
    ? source.kind.trim()
    : FRICTION_MODIFIER_TARGETS.FEATURE_KEYS;
  if (!TARGET_SET.has(kind)) {
    throw new Error(`FRICTION_MODIFIER_TARGET_INVALID:${kind || 'empty'}`);
  }

  if (kind === FRICTION_MODIFIER_TARGETS.FEATURE_KEYS) {
    return {
      kind,
      featureKeys: normalizeFeatureKeys(source.featureKeys),
    };
  }

  return { kind };
}

export function doesFrictionModifierScopeApply(scope, scopeContext = null) {
  const normalizedScope = normalizeFrictionModifierScope(scope);
  if (!scopeContext) return true;
  const context = createFrictionModifierScopeContext(scopeContext);

  if (normalizedScope.kind === FRICTION_MODIFIER_SCOPE_KINDS.GLOBAL_SESSION) {
    return true;
  }
  if (normalizedScope.kind === FRICTION_MODIFIER_SCOPE_KINDS.CONTENT_LOCAL) {
    return context.kind === FRICTION_MODIFIER_SCOPE_KINDS.CONTENT_LOCAL;
  }
  return !!context.hostname && context.hostname === normalizedScope.hostname;
}

function resolveModifierTargetKeys(target, filters) {
  switch (target.kind) {
    case FRICTION_MODIFIER_TARGETS.FEATURE_KEYS:
      return target.featureKeys;
    case FRICTION_MODIFIER_TARGETS.ADJUSTABLE_FILTERS:
      return INTENSITY_ADJUSTABLE_FRICTION_MODIFIER_FEATURE_KEYS.filter((featureKey) => (
        Object.prototype.hasOwnProperty.call(filters, featureKey)
      ));
    case FRICTION_MODIFIER_TARGETS.VISUAL_FILTERS:
      return VISUAL_FRICTION_MODIFIER_FEATURE_KEYS.filter((featureKey) => Object.prototype.hasOwnProperty.call(filters, featureKey));
    case FRICTION_MODIFIER_TARGETS.ALL_FEATURES:
      return Object.keys(filters).filter(isKnownFeatureKey);
    default:
      throw new Error(`FRICTION_MODIFIER_TARGET_INVALID:${target.kind || 'empty'}`);
  }
}

function materializeResolvedFilters(filters) {
  return Object.fromEntries(Object.entries(filters).map(([key, entry]) => {
    const resolved = isAdaptiveFrictionFeatureKey(key)
      ? materializeAdaptiveFrictionEntry(key, entry, entry.band)
      : cloneFilterEntry(entry);
    if (FULLSCREEN_VISUAL_FEATURE_KEYS.includes(key)) {
      const sources = new Set(entry.frictionModifierSources);
      resolved.fullscreenPolicy = resolveFullscreenVisualPolicy({
        targetOverrun: sources.has(FRICTION_MODIFIER_SOURCES.FURIN_OVERRUN),
        scheduleRelaxation: sources.has(FRICTION_MODIFIER_SOURCES.SCHEDULE_RELAXATION)
          && entry.band === FRICTION_INTENSITY_BANDS.RELAXED,
      });
    }
    return [key, resolved];
  }));
}

function getModifierState(states, featureKey) {
  if (!states.has(featureKey)) {
    states.set(featureKey, {
      intensityDelta: 0,
      positivePriority: null,
      negativePriority: null,
      suspended: false,
      sources: new Set(),
      ids: new Set(),
      scale: null,
    });
  }
  return states.get(featureKey);
}

function noteIntensityModifierState(state, modifier) {
  if (modifier.delta > 0) {
    state.positivePriority = state.positivePriority === null
      ? modifier.priority
      : Math.max(state.positivePriority, modifier.priority);
    return;
  }
  if (modifier.delta < 0) {
    state.negativePriority = state.negativePriority === null
      ? modifier.priority
      : Math.max(state.negativePriority, modifier.priority);
  }
}

function resolveDominantIntensityDelta(state) {
  const positivePriority = state.positivePriority;
  const negativePriority = state.negativePriority;
  if (positivePriority === null && negativePriority === null) return 0;
  if (positivePriority !== null && negativePriority === null) return 1;
  if (negativePriority !== null && positivePriority === null) return -1;
  if (positivePriority > negativePriority) return 1;
  if (negativePriority > positivePriority) return -1;
  return 0;
}

function attachModifierMetadata(entry, state) {
  if (!isPlainObject(entry)) return entry;
  const sources = Array.from(state.sources).sort();
  const ids = Array.from(state.ids).sort();
  return {
    ...entry,
    frictionModifierApplied: true,
    frictionModifierSources: sources,
    frictionModifierIds: ids,
    frictionModifierPriorities: {
      positive: state.positivePriority,
      negative: state.negativePriority,
    },
    ...(state.suspended ? { frictionModifierSuspended: true } : {}),
    ...(state.scale !== null ? { frictionModifierScale: state.scale } : {}),
  };
}

export function normalizeFrictionModifierIntent(intent = {}) {
  if (!isPlainObject(intent)) {
    throw new Error('FRICTION_MODIFIER_INTENT_INVALID');
  }
  const source = normalizeModifierSource(intent.source);
  const operation = normalizeModifierOperation(intent.operation);
  const target = normalizeModifierTarget(intent.target);
  if (operation === FRICTION_MODIFIER_OPERATIONS.SCALE_STRENGTH) {
    if (target.kind !== FRICTION_MODIFIER_TARGETS.FEATURE_KEYS || target.featureKeys.length === 0
      || target.featureKeys.some(key => !isVisualFrictionProfileKey(key))) {
      throw new Error('FRICTION_MODIFIER_OPERATION_TARGET_INVALID');
    }
    if (!Number.isInteger(intent.strengthPermille) || intent.strengthPermille < 0 || intent.strengthPermille > 1000) {
      throw new Error('FRICTION_MODIFIER_STRENGTH_PERMILLE_INVALID');
    }
  }
  const delta = operation === FRICTION_MODIFIER_OPERATIONS.ADJUST_INTENSITY
    ? requireFrictionIntensityDelta(intent.delta)
    : 0;
  if (operation === FRICTION_MODIFIER_OPERATIONS.ADJUST_INTENSITY && delta === 0) {
    throw new Error('FRICTION_MODIFIER_INTENSITY_DELTA_REQUIRED');
  }

  return Object.freeze({
    id: normalizeModifierId(intent.id, source),
    source,
    operation,
    scope: normalizeFrictionModifierScope(intent.scope),
    target,
    ...(operation === FRICTION_MODIFIER_OPERATIONS.SCALE_STRENGTH ? { strengthPermille: intent.strengthPermille } : {}),
    delta,
    active: intent.active !== false,
    priority: normalizeModifierPriority(intent.priority),
    expiresAt: normalizeModifierExpiresAt(intent.expiresAt),
  });
}

export function createFrictionStrengthScaleModifier({ id, source, featureKeys, strengthPermille, priority = 0, scope } = {}) {
  return normalizeFrictionModifierIntent({ id, source, operation: FRICTION_MODIFIER_OPERATIONS.SCALE_STRENGTH,
    target: { kind: FRICTION_MODIFIER_TARGETS.FEATURE_KEYS, featureKeys }, strengthPermille, priority, scope });
}

export function createFilterIntensityModifier({
  id,
  source,
  featureKeys,
  target = null,
  delta,
  priority = 0,
  expiresAt = null,
  active = true,
  scope,
} = {}) {
  return normalizeFrictionModifierIntent({
    id,
    source,
    operation: FRICTION_MODIFIER_OPERATIONS.ADJUST_INTENSITY,
    scope,
    target: target || {
      kind: FRICTION_MODIFIER_TARGETS.FEATURE_KEYS,
      featureKeys,
    },
    delta,
    priority,
    expiresAt,
    active,
  });
}

export function createFrictionSuspendModifier({
  id,
  source,
  featureKeys,
  target = null,
  priority = 0,
  expiresAt = null,
  active = true,
  scope,
} = {}) {
  return normalizeFrictionModifierIntent({
    id,
    source,
    operation: FRICTION_MODIFIER_OPERATIONS.SUSPEND,
    scope,
    target: target || {
      kind: FRICTION_MODIFIER_TARGETS.FEATURE_KEYS,
      featureKeys,
    },
    priority,
    expiresAt,
    active,
  });
}

export function resolveActiveFrictionModifierIntents(modifiers = [], { now = Date.now(), scopeContext = null } = {}) {
  if (!Array.isArray(modifiers)) {
    throw new Error('FRICTION_MODIFIERS_INVALID');
  }
  return modifiers
    .map(normalizeFrictionModifierIntent)
    .filter((modifier) => modifier.active && (
      modifier.expiresAt === null || modifier.expiresAt > now
    ))
    .filter((modifier) => doesFrictionModifierScopeApply(modifier.scope, scopeContext))
    .sort((a, b) => a.priority - b.priority || a.id.localeCompare(b.id));
}

export function resolveFrictionModifiedFilters(filters = {}, modifiers = [], options = {}) {
  const sourceFilters = cloneFilterRecord(filters);
  for (const [key, entry] of Object.entries(sourceFilters)) {
    if (isPlainObject(entry) && Object.hasOwn(entry, 'frictionModifierScale')) {
      if (!isVisualFrictionProfileKey(key)) throw new Error('FRICTION_MODIFIER_OPERATION_TARGET_INVALID');
      if (!Object.hasOwn(entry, 'frictionModifierPriorities')) throw new Error('FRICTION_MODIFIER_SCALE_METADATA_INVALID');
    }
    if (!isAdaptiveFrictionFeatureKey(key)) continue;
    // Content-local modifiers may receive an already compiled background plan.
    // Recompile from the user's strength, never from a compiled CSS value.
    const compiled = Object.hasOwn(entry, 'band');
    if (compiled) requireAdaptiveFrictionEntry(key, entry);
    else if (isVisualFrictionProfileKey(key)) normalizeVisualFrictionSetting(key, entry);
    else normalizeCanonicalBinaryFilterEntry(key, entry);
    sourceFilters[key] = {
      ...entry,
      ...(compiled && isVisualFrictionProfileKey(key) ? { value: entry.strength } : {}),
      band: compiled ? entry.band : FRICTION_INTENSITY_BANDS.NORMAL,
    };
  }
  const now = options.now ?? Date.now();
  const activeModifiers = resolveActiveFrictionModifierIntents(modifiers, {
    now,
    scopeContext: options.scopeContext || null,
  });
  if (activeModifiers.length === 0) {
    return materializeResolvedFilters(sourceFilters);
  }

  const modifierStates = new Map();
  // Preserve arbitration evidence across the background -> content boundary.
  // A low-priority local relaxation must not overwrite a stronger domain rule.
  for (const [key, entry] of Object.entries(sourceFilters)) {
    if (!isAdaptiveFrictionFeatureKey(key) || !Object.hasOwn(entry, 'frictionModifierPriorities')) continue;
    const priorities = entry.frictionModifierPriorities;
    if (!isPlainObject(priorities)
      || Object.keys(priorities).length !== 2
      || !['positive', 'negative'].every((field) => Object.hasOwn(priorities, field)
        && (priorities[field] === null || Number.isInteger(priorities[field])))) {
      throw new Error(`FRICTION_MODIFIER_PRIORITIES_INVALID:${key}`);
    }
    const state = getModifierState(modifierStates, key);
    for (const field of ['frictionModifierSources', 'frictionModifierIds']) {
      if (!Array.isArray(entry[field]) || !entry[field].every((value) => typeof value === 'string' && value.length > 0)) {
        throw new Error(`FRICTION_MODIFIER_METADATA_INVALID:${key}:${field}`);
      }
    }
    state.positivePriority = priorities.positive;
    state.negativePriority = priorities.negative;
    state.suspended = entry.frictionModifierSuspended === true;
    if (Object.hasOwn(entry, 'frictionModifierScale')) state.scale = requireVisualFrictionScale(entry.frictionModifierScale);
    state.intensityDelta = resolveDominantIntensityDelta(state);
    for (const source of entry.frictionModifierSources) state.sources.add(source);
    for (const id of entry.frictionModifierIds) state.ids.add(id);
  }
  activeModifiers.forEach((modifier) => {
    const targetKeys = resolveModifierTargetKeys(modifier.target, sourceFilters);
    targetKeys.forEach((featureKey) => {
      const state = getModifierState(modifierStates, featureKey);
      state.sources.add(modifier.source);
      state.ids.add(modifier.id);
      if (modifier.operation === FRICTION_MODIFIER_OPERATIONS.SUSPEND) {
        state.suspended = true;
        return;
      }
      if (modifier.operation === FRICTION_MODIFIER_OPERATIONS.SCALE_STRENGTH) {
        const nextScale = { strengthPermille: modifier.strengthPermille, priority: modifier.priority };
        if (state.scale === null || nextScale.priority > state.scale.priority) state.scale = nextScale;
        else if (nextScale.priority === state.scale.priority && nextScale.strengthPermille !== state.scale.strengthPermille) {
          throw new Error('FRICTION_MODIFIER_SCALE_PRIORITY_CONFLICT');
        }
        return;
      }
      if (!isAdaptiveFrictionFeatureKey(featureKey)) {
        throw new Error(`FRICTION_MODIFIER_INTENSITY_TARGET_INVALID:${featureKey}`);
      }
      noteIntensityModifierState(state, modifier);
      state.intensityDelta = resolveDominantIntensityDelta(state);
    });
  });

  modifierStates.forEach((state, featureKey) => {
    if (!Object.prototype.hasOwnProperty.call(sourceFilters, featureKey)) return;
    const current = cloneFilterEntry(sourceFilters[featureKey]);
    if (!isPlainObject(current)) return;

    let next = current;
    if (state.suspended) {
      next = {
        ...next,
        isActive: false,
      };
    } else if (current.isActive === true) {
      next = { ...next, band: resolveFrictionIntensityBand(state.intensityDelta) };
    }
    sourceFilters[featureKey] = attachModifierMetadata(next, state);
  });

  return materializeResolvedFilters(sourceFilters);
}
