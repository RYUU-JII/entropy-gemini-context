import {
  normalizeRuntimeArtifactId,
  PROTECTION_RUNTIME_ARTIFACT_IDS,
} from '../contracts/artifactIds.js';
import { PROTECTION_CANONICAL_ARTIFACT_IDS } from './artifactFamilyCatalog.js';

const {
  TIME_ANCHOR,
  SENTINEL_FLARE,
  MEMORY_PURGE,
  ENTRY_CHECKPOINT,
  RETURN_GUARD,
  DETOUR_SPREAD_GUARD,
} = PROTECTION_RUNTIME_ARTIFACT_IDS;
const {
  BARRIER,
  FLARE,
  ECHO,
  GATE,
} = PROTECTION_CANONICAL_ARTIFACT_IDS;

export const RUNTIME_ARTIFACT_CATALOG = Object.freeze({
  [TIME_ANCHOR]: Object.freeze({
    id: TIME_ANCHOR,
    artifactId: BARRIER,
    familyId: BARRIER,
    phase: 'active',
    featureKeys: Object.freeze(['ensoGate', 'infiniteScrollGuard', 'textRhythm']),
    armsWhenEnabled: true,
    armTriggers: Object.freeze([]),
    // This policy state never grants a consumption decision. Cadence and the
    // fresh content-boundary admission remain the sole activation authorities.
    engageTriggers: Object.freeze([]),
    cleanupTriggers: Object.freeze([]),
    cooldownMs: 5_000,
  }),
  [SENTINEL_FLARE]: Object.freeze({
    id: SENTINEL_FLARE,
    artifactId: FLARE,
    familyId: FLARE,
    phase: 'active',
    featureKeys: Object.freeze([]),
    armsWhenEnabled: false,
    armTriggers: Object.freeze(['BUDGET_NEAR_EXHAUSTED']),
    engageTriggers: Object.freeze(['BUDGET_EXCEEDED']),
    cleanupTriggers: Object.freeze([]),
    cooldownMs: 30_000,
  }),
  [MEMORY_PURGE]: Object.freeze({
    id: MEMORY_PURGE,
    artifactId: ECHO,
    familyId: ECHO,
    phase: 'post_exit',
    featureKeys: Object.freeze([]),
    armsWhenEnabled: false,
    armTriggers: Object.freeze([]),
    engageTriggers: Object.freeze([]),
    cleanupTriggers: Object.freeze(['SESSION_END', 'SITE_EXIT']),
    cooldownMs: 0,
  }),
  [ENTRY_CHECKPOINT]: Object.freeze({
    id: ENTRY_CHECKPOINT,
    artifactId: GATE,
    familyId: GATE,
    phase: 'pre_entry',
    featureKeys: Object.freeze([]),
    armsWhenEnabled: true,
    armTriggers: Object.freeze([]),
    engageTriggers: Object.freeze(['ENTRY_CHECKPOINT_REQUIRED']),
    cleanupTriggers: Object.freeze([]),
    cooldownMs: 0,
  }),
  [RETURN_GUARD]: Object.freeze({
    id: RETURN_GUARD,
    artifactId: GATE,
    familyId: GATE,
    phase: 'reentry',
    featureKeys: Object.freeze([]),
    armsWhenEnabled: true,
    armTriggers: Object.freeze([]),
    engageTriggers: Object.freeze(['RETURN_GUARD_REQUIRED']),
    cleanupTriggers: Object.freeze([]),
    cooldownMs: 0,
  }),
  [DETOUR_SPREAD_GUARD]: Object.freeze({
    id: DETOUR_SPREAD_GUARD,
    artifactId: BARRIER,
    familyId: BARRIER,
    phase: 'context_switch',
    featureKeys: Object.freeze([]),
    armsWhenEnabled: true,
    armTriggers: Object.freeze([]),
    engageTriggers: Object.freeze(['DETOUR_SPREAD_DETECTED']),
    cleanupTriggers: Object.freeze([]),
    // No clock damping. DETOUR_SPREAD_DETECTED is edge-shaped upstream: it
    // fires on a rise in the protected-tab count past the level already
    // acknowledged, so repetition is bounded by further spreading rather than
    // by elapsed time.
    cooldownMs: 0,
  }),
});

export function getRuntimeArtifactDefinition(artifactId) {
  const normalizedArtifactId = normalizeRuntimeArtifactId(artifactId);
  return RUNTIME_ARTIFACT_CATALOG?.[normalizedArtifactId] || null;
}
