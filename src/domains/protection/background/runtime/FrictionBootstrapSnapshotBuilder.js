import {
  FILTERING_MODES,
  resolveFilteringModeBySchedule,
} from '../../../settings/config/blockingPolicy.js';
import {
  normalizeRulesMode,
  DEFAULT_RULES_MODE,
} from '../../../settings/config/siteRules.js';
import {
  EARLY_APPLY_RUNTIME_FILTER_KEYS,
  EARLY_APPLY_VISUAL_FILTER_KEYS,
} from '../../../settings/config/frictionPipeline.js';
import {
  DEFAULT_FRICTION_BOOTSTRAP_TTL_MS,
  FRICTION_BOOTSTRAP_SCHEMA_VERSION,
} from '../../../../platform/storage/bootstrap/BootstrapSnapshotRepository.js';

function normalizeHostname(value) {
  return typeof value === 'string' ? value.trim().toLowerCase() : '';
}

function isPlainObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function normalizeThemeToken(value) {
  return typeof value === 'string' && value.trim()
    ? value.trim()
    : null;
}

function requirePositiveInteger(value, errorCode) {
  if (!Number.isInteger(value) || value <= 0) {
    throw new Error(errorCode);
  }
  return value;
}

function requireNonNegativeInteger(value, errorCode) {
  if (!Number.isInteger(value) || value < 0) {
    throw new Error(errorCode);
  }
  return value;
}

function requireBootstrapRuntimeSnapshot(runtimeSnapshot) {
  if (!isPlainObject(runtimeSnapshot)) {
    throw new Error('FRICTION_BOOTSTRAP_RUNTIME_SNAPSHOT_REQUIRED');
  }
  return runtimeSnapshot;
}

function resolveBootstrapHostname(hostname, runtimeSnapshot) {
  const explicitHostname = normalizeHostname(hostname);
  if (explicitHostname) return explicitHostname;
  const snapshotHostname = normalizeHostname(runtimeSnapshot.hostname);
  if (snapshotHostname) return snapshotHostname;
  throw new Error('FRICTION_BOOTSTRAP_HOSTNAME_REQUIRED');
}

function requireBootstrapDispatch(dispatch) {
  if (!isPlainObject(dispatch)) {
    throw new Error('FRICTION_BOOTSTRAP_DISPATCH_REQUIRED');
  }
  if (typeof dispatch.shouldApply !== 'boolean') {
    throw new Error('FRICTION_BOOTSTRAP_DISPATCH_FIELD_INVALID:shouldApply');
  }
  if (typeof dispatch.isBlockedDomain !== 'boolean') {
    throw new Error('FRICTION_BOOTSTRAP_DISPATCH_FIELD_INVALID:isBlockedDomain');
  }
  return dispatch;
}

function requireEnvelopeResult(envelopeResult) {
  if (!isPlainObject(envelopeResult)) {
    throw new Error('FRICTION_BOOTSTRAP_ENVELOPE_RESULT_REQUIRED');
  }
  if (!isPlainObject(envelopeResult.envelope)) {
    throw new Error('FRICTION_BOOTSTRAP_ENVELOPE_FIELD_INVALID:envelope');
  }
  return envelopeResult;
}

function resolveCompiledFeatures(envelopeResult) {
  if (
    isPlainObject(envelopeResult.state)
    && Object.prototype.hasOwnProperty.call(envelopeResult.state, 'compiledFeatures')
  ) {
    if (!isPlainObject(envelopeResult.state.compiledFeatures)) {
      throw new Error('FRICTION_BOOTSTRAP_ENVELOPE_FIELD_INVALID:compiledFeatures');
    }
    return envelopeResult.state.compiledFeatures;
  }
  if (Object.prototype.hasOwnProperty.call(envelopeResult.envelope, 'compiledFeatures')) {
    if (!isPlainObject(envelopeResult.envelope.compiledFeatures)) {
      throw new Error('FRICTION_BOOTSTRAP_ENVELOPE_FIELD_INVALID:compiledFeatures');
    }
    return envelopeResult.envelope.compiledFeatures;
  }
  throw new Error('FRICTION_BOOTSTRAP_ENVELOPE_FIELD_INVALID:compiledFeatures');
}

function resolveEnvelopeRevision(envelopeResult) {
  if (Object.prototype.hasOwnProperty.call(envelopeResult, 'revision')) {
    return requireNonNegativeInteger(
      envelopeResult.revision,
      'FRICTION_BOOTSTRAP_ENVELOPE_FIELD_INVALID:revision',
    );
  }
  if (
    isPlainObject(envelopeResult.state)
    && Object.prototype.hasOwnProperty.call(envelopeResult.state, 'revision')
  ) {
    return requireNonNegativeInteger(
      envelopeResult.state.revision,
      'FRICTION_BOOTSTRAP_ENVELOPE_FIELD_INVALID:revision',
    );
  }
  throw new Error('FRICTION_BOOTSTRAP_ENVELOPE_FIELD_INVALID:revision');
}

function resolveGeneratedAtEpochMs(now) {
  if (!Number.isInteger(now) || now <= 0) {
    throw new Error('FRICTION_BOOTSTRAP_GENERATED_AT_INVALID');
  }
  return now;
}

function resolveDecisionReason(runtimeSnapshot, dispatch) {
  const policyReason = typeof runtimeSnapshot.policy?.reason === 'string'
    ? runtimeSnapshot.policy.reason.trim()
    : '';
  if (policyReason) return policyReason;

  const traceReason = Array.isArray(runtimeSnapshot.trace?.reasonCodes)
    && typeof runtimeSnapshot.trace.reasonCodes[0] === 'string'
    ? runtimeSnapshot.trace.reasonCodes[0].trim()
    : '';
  if (traceReason) return traceReason;

  return dispatch.isBlockedDomain ? 'blocked_domain' : 'unmanaged';
}

function resolveFilteringMode({
  runtimeSnapshot,
  settingsCache,
  generatedAtEpochMs,
}) {
  if (isPlainObject(runtimeSnapshot.scope)) {
    if (
      Object.prototype.hasOwnProperty.call(runtimeSnapshot.scope, 'filteringMode')
      && typeof runtimeSnapshot.scope.filteringMode !== 'string'
    ) {
      throw new Error('FRICTION_BOOTSTRAP_SCOPE_FIELD_INVALID:filteringMode');
    }
    if (typeof runtimeSnapshot.scope.filteringMode === 'string' && runtimeSnapshot.scope.filteringMode.trim()) {
      return runtimeSnapshot.scope.filteringMode.trim();
    }
  }
  return resolveFilteringModeBySchedule({
    filteringMode: settingsCache?.filteringMode || FILTERING_MODES.BLOCKLIST,
    schedule: settingsCache?.relaxationSchedule,
    ts: generatedAtEpochMs,
  });
}

function cloneFeatureEntry(entry, key) {
  if (entry === undefined || entry === null) return null;
  if (!isPlainObject(entry)) {
    throw new Error(`FRICTION_BOOTSTRAP_FEATURE_ENTRY_INVALID:${key}`);
  }
  return {
    ...entry,
  };
}

function pickFeatureEntries(source, keys) {
  return Array.from(keys).reduce((acc, key) => {
    acc[key] = cloneFeatureEntry(source[key], key);
    return acc;
  }, {});
}

export function createFrictionBootstrapSnapshotBuilder({
  settingsCache,
  ttlMs = DEFAULT_FRICTION_BOOTSTRAP_TTL_MS,
} = {}) {
  const resolvedTtlMs = requirePositiveInteger(
    ttlMs,
    'FRICTION_BOOTSTRAP_TTL_INVALID',
  );

  function build({
    hostname,
    runtimeSnapshot,
    now = Date.now(),
    themePresentation = null,
  } = {}) {
    const resolvedRuntimeSnapshot = requireBootstrapRuntimeSnapshot(runtimeSnapshot);
    const resolvedHostname = resolveBootstrapHostname(hostname, resolvedRuntimeSnapshot);
    const dispatch = requireBootstrapDispatch(resolvedRuntimeSnapshot.dispatch);
    const envelopeResult = requireEnvelopeResult(resolvedRuntimeSnapshot.envelopeResult);
    const compiledFeatures = resolveCompiledFeatures(envelopeResult);
    const revision = resolveEnvelopeRevision(envelopeResult);

    const generatedAtEpochMs = resolveGeneratedAtEpochMs(now);
    const rulesMode = normalizeRulesMode(settingsCache?.rulesMode, DEFAULT_RULES_MODE);
    const filteringMode = resolveFilteringMode({
      runtimeSnapshot: resolvedRuntimeSnapshot,
      settingsCache,
      generatedAtEpochMs,
    });
    const reason = resolveDecisionReason(resolvedRuntimeSnapshot, dispatch);
    const themeId = normalizeThemeToken(themePresentation?.themeId);
    const styleVariant = normalizeThemeToken(
      themePresentation?.gatekeeperTheme?.styleVariant
      || themePresentation?.styleVariant
      || themeId,
    );

    return {
      schemaVersion: FRICTION_BOOTSTRAP_SCHEMA_VERSION,
      generatedAtEpochMs,
      staleAfterEpochMs: generatedAtEpochMs + Math.max(
        1_000,
        resolvedTtlMs,
      ),
      host: {
        hostname: resolvedHostname,
      },
      decision: {
        shouldApply: dispatch.shouldApply,
        isBlockedDomain: dispatch.isBlockedDomain,
        reason,
        rulesMode,
        filteringMode,
      },
      visual: {
        filters: pickFeatureEntries(compiledFeatures, EARLY_APPLY_VISUAL_FILTER_KEYS),
      },
      runtime: pickFeatureEntries(compiledFeatures, EARLY_APPLY_RUNTIME_FILTER_KEYS),
      meta: {
        source: 'background-protection-runtime',
        revision,
        themeId,
        styleVariant,
      },
    };
  }

  return {
    build,
  };
}
