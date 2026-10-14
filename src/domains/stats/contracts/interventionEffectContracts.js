export const INTERVENTION_EFFECT_CLASSES = Object.freeze({
  PRE_ENTRY: 'pre_entry',
  REENTRY_GUARD: 'reentry_guard',
  CONTEXT_SWITCH_GUARD: 'context_switch_guard',
  IN_SESSION_INTERRUPT: 'in_session_interrupt',
  POST_EXIT_ECHO: 'post_exit_echo',
  UNKNOWN: 'unknown',
});

const INTERVENTION_CLASS_SET = new Set(Object.values(INTERVENTION_EFFECT_CLASSES));
const PRE_ENTRY_GATE_KINDS = new Set([
  'entrycheckpoint',
  'entry_checkpoint',
  'preentry',
  'pre_entry',
  'shishiodoshi',
  'shishi_odoshi',
  'shishi-odoshi',
]);

function isPlainObject(value) {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function normalizeString(value, {
  maxLength = 128,
  fallback = '',
  lowercase = false,
} = {}) {
  if (typeof value !== 'string') return fallback;
  const trimmed = value.trim();
  if (!trimmed || trimmed.length > maxLength) return fallback;
  return lowercase ? trimmed.toLowerCase() : trimmed;
}

function normalizeLevel(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return 0;
  return Math.max(0, Math.floor(numeric));
}

function normalizeStringList(values = [], { maxLength = 64, limit = 12 } = {}) {
  return Array.from(new Set(
    (Array.isArray(values) ? values : [])
      .map((value) => normalizeString(value, { maxLength }))
      .filter(Boolean),
  )).slice(0, limit);
}

function normalizeBoolean(value, fallback = false) {
  return typeof value === 'boolean' ? value : fallback;
}

function normalizeCompactRecord(source = {}, { maxEntries = 12, maxKeyLength = 64, maxStringLength = 128 } = {}) {
  if (!isPlainObject(source)) return {};
  const result = {};
  Object.entries(source).some(([key, value]) => {
    const normalizedKey = normalizeString(key, { maxLength: maxKeyLength });
    if (!normalizedKey) return false;
    if (typeof value === 'string') {
      const normalizedValue = normalizeString(value, { maxLength: maxStringLength });
      if (normalizedValue) result[normalizedKey] = normalizedValue;
    } else if (typeof value === 'number' && Number.isFinite(value)) {
      result[normalizedKey] = value;
    } else if (typeof value === 'boolean') {
      result[normalizedKey] = value;
    }
    return Object.keys(result).length >= maxEntries;
  });
  return result;
}

function normalizeInterventionClass(value) {
  const normalized = normalizeString(value, { maxLength: 80, lowercase: true });
  return INTERVENTION_CLASS_SET.has(normalized) ? normalized : '';
}

export function deriveInterventionEffectClass(row = {}) {
  const explicit = normalizeInterventionClass(row.interventionClass);
  if (explicit) return explicit;

  const gateKind = normalizeString(row.gateKind, { maxLength: 80, lowercase: true });
  const artifactFamily = normalizeString(row.artifactFamily, { maxLength: 80, lowercase: true });
  const artifactId = normalizeString(row.artifactId, { maxLength: 128, lowercase: true });

  if (PRE_ENTRY_GATE_KINDS.has(gateKind)) return INTERVENTION_EFFECT_CLASSES.PRE_ENTRY;
  if (gateKind.includes('return') || gateKind.includes('reentry')) {
    return INTERVENTION_EFFECT_CLASSES.REENTRY_GUARD;
  }
  if (gateKind.includes('detour') || gateKind.includes('context') || gateKind.includes('switch')) {
    return INTERVENTION_EFFECT_CLASSES.CONTEXT_SWITCH_GUARD;
  }
  if (artifactFamily === 'echo' || artifactId.includes('memorypurge') || artifactId.includes('memory_purge')) {
    return INTERVENTION_EFFECT_CLASSES.POST_EXIT_ECHO;
  }
  if (
    artifactFamily === 'barrier'
    || artifactFamily === 'gate_interstitial'
    || artifactFamily === 'gate'
    || gateKind
  ) {
    return INTERVENTION_EFFECT_CLASSES.IN_SESSION_INTERRUPT;
  }
  return INTERVENTION_EFFECT_CLASSES.UNKNOWN;
}

function buildArtifactVector(row = {}) {
  return normalizeStringList([
    row.artifactFamily,
    row.artifactId,
    row.gateKind,
    ...(Array.isArray(row.activeChildIds) ? row.activeChildIds : []),
    ...(Array.isArray(row.directTriggers) ? row.directTriggers : []),
  ], { maxLength: 128, limit: 20 });
}

export function resolveInterventionEffectMetadata(row = {}) {
  const interventionClass = deriveInterventionEffectClass(row);
  const resistanceEligible = normalizeBoolean(
    row.resistanceEligible,
    interventionClass !== INTERVENTION_EFFECT_CLASSES.PRE_ENTRY,
  );
  const effectivenessEligible = normalizeBoolean(row.effectivenessEligible, true);
  const severity = normalizeString(row.severity, { maxLength: 64, lowercase: true });
  const holdDurationMs = Math.max(0, Math.floor(Number(row.holdDurationMs) || 0));
  const holdUntil = Math.max(0, Math.floor(Number(row.holdUntil) || 0));
  const levelRecipeVersion = normalizeString(row.levelRecipeVersion, { maxLength: 80 });
  const level = normalizeLevel(row.level ?? row.planLevel);
  const intensityVector = normalizeCompactRecord(
    isPlainObject(row.intensityVector)
      ? row.intensityVector
      : {
          level,
          severity,
          holdDurationMs,
        },
  );

  return {
    interventionClass,
    resistanceEligible,
    effectivenessEligible,
    severity,
    holdDurationMs,
    holdUntil,
    levelRecipeVersion,
    artifactVector: buildArtifactVector(row),
    strategyState: normalizeCompactRecord(row.strategyState),
    intensityVector,
  };
}
