import { DEFAULT_PROTECTION_POSTURE, normalizeProtectionPosture } from '../contracts/protectionContracts.js';

export const POSTURE_PROFILES = Object.freeze({
  gentle: Object.freeze({
    level2At: 0.7,
    level3At: 0.9,
    level4At: 0.98,
    deescalationHoldMs: 120_000,
  }),
  balanced: Object.freeze({
    level2At: 0.6,
    level3At: 0.85,
    level4At: 0.95,
    deescalationHoldMs: 120_000,
  }),
  strict: Object.freeze({
    level2At: 0.5,
    level3At: 0.75,
    level4At: 0.9,
    deescalationHoldMs: 120_000,
  }),
});

export function getPostureProfile(posture = DEFAULT_PROTECTION_POSTURE) {
  const normalized = normalizeProtectionPosture(posture);
  return POSTURE_PROFILES[normalized] || POSTURE_PROFILES[DEFAULT_PROTECTION_POSTURE];
}
