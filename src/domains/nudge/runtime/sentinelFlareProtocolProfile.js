export const SENTINEL_FLARE_PROTOCOL_SCOPES = Object.freeze({
  SITE: 'site',
  GLOBAL: 'global',
});

export const SENTINEL_FLARE_PROTOCOL_VARIANTS = Object.freeze({
  SITE_FURIN: 'site_furin',
  GLOBAL_SENTINEL: 'global_sentinel',
});

export const DEFAULT_SENTINEL_FLARE_PROTOCOL_PROFILE = Object.freeze({
  protocolScope: SENTINEL_FLARE_PROTOCOL_SCOPES.SITE,
  protocolIntensity: 0.62,
  protocolVariant: SENTINEL_FLARE_PROTOCOL_VARIANTS.SITE_FURIN,
  escalationReason: 'site_target',
});

const SENTINEL_FLARE_PROTOCOL_SCOPE_SET = new Set(Object.values(SENTINEL_FLARE_PROTOCOL_SCOPES));
const SENTINEL_FLARE_PROTOCOL_VARIANT_SET = new Set(Object.values(SENTINEL_FLARE_PROTOCOL_VARIANTS));

function clamp(value, min, max) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return min;
  return Math.max(min, Math.min(max, numeric));
}

function normalizeIntensity(value, fallback = DEFAULT_SENTINEL_FLARE_PROTOCOL_PROFILE.protocolIntensity) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return clamp(fallback, 0.35, 1);
  return clamp(numeric, 0.35, 1);
}

function normalizeString(value) {
  return typeof value === 'string' ? value.trim().toLowerCase() : '';
}

export function isSentinelFlareProtocolScope(value) {
  return SENTINEL_FLARE_PROTOCOL_SCOPE_SET.has(value);
}

export function isSentinelFlareProtocolVariant(value) {
  return SENTINEL_FLARE_PROTOCOL_VARIANT_SET.has(value);
}

export function assertSentinelFlareProtocolScope(value, context = 'sentinel_flare_protocol_scope') {
  const normalized = normalizeString(value);
  if (isSentinelFlareProtocolScope(normalized)) return normalized;
  throw new Error(`${context}_invalid:${String(value)}`);
}

export function assertSentinelFlareProtocolVariant(value, context = 'sentinel_flare_protocol_variant') {
  const normalized = normalizeString(value);
  if (isSentinelFlareProtocolVariant(normalized)) return normalized;
  throw new Error(`${context}_invalid:${String(value)}`);
}

export function normalizeSentinelFlareProtocolScope(value, fallback = DEFAULT_SENTINEL_FLARE_PROTOCOL_PROFILE.protocolScope) {
  const normalized = normalizeString(value);
  if (!normalized) {
    return assertSentinelFlareProtocolScope(fallback, 'sentinel_flare_protocol_scope_fallback');
  }
  return assertSentinelFlareProtocolScope(normalized);
}

export function normalizeSentinelFlareProtocolVariant(value, fallback = DEFAULT_SENTINEL_FLARE_PROTOCOL_PROFILE.protocolVariant) {
  const normalized = normalizeString(value);
  if (!normalized) {
    return assertSentinelFlareProtocolVariant(fallback, 'sentinel_flare_protocol_variant_fallback');
  }
  return assertSentinelFlareProtocolVariant(normalized);
}

export function normalizeSentinelFlareProtocolProfile(raw = {}, fallback = DEFAULT_SENTINEL_FLARE_PROTOCOL_PROFILE) {
  const source = raw && typeof raw === 'object' ? raw : {};
  const base = fallback && typeof fallback === 'object'
    ? fallback
    : DEFAULT_SENTINEL_FLARE_PROTOCOL_PROFILE;
  const scope = normalizeSentinelFlareProtocolScope(source.protocolScope, base.protocolScope);
  const variantFallback = scope === SENTINEL_FLARE_PROTOCOL_SCOPES.GLOBAL
    ? SENTINEL_FLARE_PROTOCOL_VARIANTS.GLOBAL_SENTINEL
    : SENTINEL_FLARE_PROTOCOL_VARIANTS.SITE_FURIN;
  const baseScope = normalizeSentinelFlareProtocolScope(base.protocolScope);
  const baseVariant = baseScope === scope ? base.protocolVariant : variantFallback;
  const protocolVariant = normalizeSentinelFlareProtocolVariant(
    source.protocolVariant,
    baseVariant || variantFallback,
  );
  if (protocolVariant !== variantFallback) {
    throw new Error(`sentinel_flare_protocol_variant_scope_mismatch:${scope}:${protocolVariant}`);
  }
  const escalationReason = typeof source.escalationReason === 'string' && source.escalationReason.trim()
    ? source.escalationReason.trim().toLowerCase()
    : (base.escalationReason || DEFAULT_SENTINEL_FLARE_PROTOCOL_PROFILE.escalationReason);

  return {
    protocolScope: scope,
    protocolIntensity: normalizeIntensity(
      source.protocolIntensity ?? base.protocolIntensity,
      base.protocolIntensity,
    ),
    protocolVariant,
    escalationReason,
  };
}

function resolveSiteIntensity(triggerSource) {
  if (triggerSource === 'site_goal') return 0.64;
  return 0.62;
}

function resolveEscalationReason({ triggerSource, debtMode, force }) {
  if (force) return 'debug';
  if (debtMode) return 'debt_retry';
  if (triggerSource === 'global_protocol' || triggerSource === 'protocol_target') return 'global_budget';
  if (triggerSource === 'site_goal') return 'site_target';
  return triggerSource || 'site_target';
}

export function deriveSentinelFlareProtocolProfile({
  runtimeSnapshot = null,
  triggerTarget = null,
  reason = '',
  debtMode = false,
  force = false,
} = {}) {
  const triggerSource = normalizeString(triggerTarget?.source || reason);
  if (triggerSource === 'near_global_combined') throw new Error('SENTINEL_RETIRED_NEAR_GLOBAL_TRIGGER');
  const policy = runtimeSnapshot?.policy && typeof runtimeSnapshot.policy === 'object'
    ? runtimeSnapshot.policy
    : {};
  const protocolTargetSource = normalizeString(policy.protocolTargetSource || policy.referenceTargetSource);
  const globalProtocolTarget = triggerSource === 'protocol_target'
    && protocolTargetSource === 'global_protocol';
  const shouldEscalateGlobal = !force && (
    globalProtocolTarget
    || triggerSource === 'global_protocol'
    || triggerSource === 'global_budget'
  );

  if (shouldEscalateGlobal) {
    const debtIntensityBoost = debtMode ? 0.04 : 0;
    return {
      protocolScope: SENTINEL_FLARE_PROTOCOL_SCOPES.GLOBAL,
      protocolIntensity: clamp(0.88 + debtIntensityBoost, 0.35, 1),
      protocolVariant: SENTINEL_FLARE_PROTOCOL_VARIANTS.GLOBAL_SENTINEL,
      escalationReason: resolveEscalationReason({ triggerSource, debtMode, force }),
    };
  }

  return {
    protocolScope: SENTINEL_FLARE_PROTOCOL_SCOPES.SITE,
    protocolIntensity: force ? 0.52 : resolveSiteIntensity(triggerSource),
    protocolVariant: SENTINEL_FLARE_PROTOCOL_VARIANTS.SITE_FURIN,
    escalationReason: resolveEscalationReason({ triggerSource, debtMode, force }),
  };
}
