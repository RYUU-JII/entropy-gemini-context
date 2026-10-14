export const VIDEO_SKIP_GUARD_POLICIES = Object.freeze({
  HARD_BLOCK: 'hard_block',
});

// `cooldownMs` is the dormant cooldown ledger's only knob. The guard ships as an
// unconditional hard block, so it stays 0 and is read only where
// BUILD_ENABLE_VIDEO_SKIP_COOLDOWN gates the ledger back on.
export const VIDEO_SKIP_GUARD_POLICY_PROFILES = Object.freeze({
  [VIDEO_SKIP_GUARD_POLICIES.HARD_BLOCK]: Object.freeze({
    mode: VIDEO_SKIP_GUARD_POLICIES.HARD_BLOCK,
    cooldownMs: 0,
  }),
});

export const DEFAULT_VIDEO_SKIP_GUARD_VALUE = Object.freeze({
  mode: VIDEO_SKIP_GUARD_POLICIES.HARD_BLOCK,
});

const VIDEO_SKIP_GUARD_POLICY_SET = new Set(Object.values(VIDEO_SKIP_GUARD_POLICIES));

function isPlainObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

export function normalizeVideoSkipGuardPolicy(value) {
  if (value === 'cooldown' || value === VIDEO_SKIP_GUARD_POLICIES.HARD_BLOCK) {
    return VIDEO_SKIP_GUARD_POLICIES.HARD_BLOCK;
  }
  if (!VIDEO_SKIP_GUARD_POLICY_SET.has(value)) {
    throw new Error(`VIDEO_SKIP_GUARD_POLICY_INVALID:${value || 'missing'}`);
  }
  return value;
}

export function normalizeVideoSkipGuardValue(rawValue = DEFAULT_VIDEO_SKIP_GUARD_VALUE) {
  if (!isPlainObject(rawValue)) {
    throw new Error('VIDEO_SKIP_GUARD_VALUE_INVALID');
  }
  const expectedFields = ['mode'];
  const fields = Object.keys(rawValue);
  if (
    fields.length !== expectedFields.length
    || expectedFields.some((field) => !Object.prototype.hasOwnProperty.call(rawValue, field))
  ) {
    throw new Error('VIDEO_SKIP_GUARD_VALUE_INVALID');
  }

  return {
    mode: normalizeVideoSkipGuardPolicy(rawValue.mode),
  };
}

export function resolveVideoSkipGuardProfile(rawValue = DEFAULT_VIDEO_SKIP_GUARD_VALUE) {
  const normalized = normalizeVideoSkipGuardValue(rawValue);
  return Object.freeze({
    ...normalized,
    ...VIDEO_SKIP_GUARD_POLICY_PROFILES[normalized.mode],
  });
}
