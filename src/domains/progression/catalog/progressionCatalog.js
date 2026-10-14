import {
  PROGRESSION_CONDITION_TYPES,
  PROGRESSION_FEATURE_IDS,
  PROGRESSION_FEATURE_KINDS,
} from '../contracts/progressionIds.js';
import {
  PROGRESSION_ARTIFACT_PRESENTATION_POLICY,
  PROGRESSION_EXPERIENCE_PRESENTATION_POLICY,
  getProgressionSiteSlotPolicy,
} from '../policy/progressionPolicy.js';
import { resolveProgressionFamilyUnlockDay } from '../policy/progressionJourneyPolicy.js';

const {
  ALWAYS,
  FIRST_VISION_SPENT,
} = PROGRESSION_CONDITION_TYPES;

const {
  ARTIFACT_BARRIER,
  ARTIFACT_VEIL_SHORTFORM_BLOCK,
  ARTIFACT_BRAKE_SKIP_FRICTION,
  ARTIFACT_BARRIER_DETOUR_SPREAD_GUARD,
  ARTIFACT_BRAKE,
  ARTIFACT_BRAKE_NAVIGATION_BUTTON_LOCK,
  ARTIFACT_BRAKE_SCROLL_FRICTION,
  ARTIFACT_ECHO,
  ARTIFACT_ECHO_BOOKMARK_CONCEAL,
  ARTIFACT_ECHO_HISTORY_CLEANUP,
  ARTIFACT_FLARE,
  ARTIFACT_FLARE_SENTINEL,
  ARTIFACT_GATE,
  ARTIFACT_GATE_ENTRY_CHECKPOINT,
  ARTIFACT_GATE_RETURN_GUARD,
  ARTIFACT_LENS,
  ARTIFACT_LENS_BLUR,
  ARTIFACT_LENS_BRIGHTNESS,
  ARTIFACT_LENS_CONTRAST,
  ARTIFACT_LENS_GRAYSCALE,
  ARTIFACT_LENS_SATURATION,
  ARTIFACT_BRAKE_INPUT_VISUAL_BRAKE,
  ARTIFACT_BARRIER_TEXT_RHYTHM,
  ARTIFACT_VEIL,
  ARTIFACT_BARRIER_INTENT_THRESHOLD,
  ARTIFACT_VEIL_SOCIAL_METRICS,
  ARTIFACT_VEIL_TIME_SIGNALS,
  FIRST_VISION,
  SEEDLING_REALITY,
  SITE_SLOT_1,
  SITE_SLOT_2,
  SITE_SLOT_3,
  SITE_SLOT_4,
  SITE_SLOT_5,
} = PROGRESSION_FEATURE_IDS;

const always = Object.freeze([{ type: ALWAYS }]);
const afterVision = Object.freeze([{ type: FIRST_VISION_SPENT }]);

function requireSlotPolicy(featureId) {
  const policy = getProgressionSiteSlotPolicy(featureId);
  if (!policy) {
    throw new Error(`PROGRESSION_SITE_SLOT_POLICY_REQUIRED:${featureId}`);
  }
  return policy;
}

function requireArtifactMetadata(featureId) {
  const metadata = PROGRESSION_ARTIFACT_PRESENTATION_POLICY.featureMetadata[featureId];
  if (!metadata) {
    throw new Error(`PROGRESSION_ARTIFACT_POLICY_REQUIRED:${featureId}`);
  }
  return metadata;
}

function slotFeature({ id, order }) {
  const policy = requireSlotPolicy(id);
  return feature({
    id,
    kind: PROGRESSION_FEATURE_KINDS.SITE_SLOT,
    stage: policy.unlockDay,
    order,
    reveal: policy.reveal,
    unlock: policy.unlock,
    metadata: {
      slotIndex: policy.slotIndex,
      presentationMode: policy.presentationMode,
    },
  });
}

function artifactFeature({
  id,
  kind,
  order,
}) {
  const metadata = requireArtifactMetadata(id);
  // Family disclosure is the only access owner. Catalog entries must not
  // retain independent visit/friction/day conditions that evaluation ignores.
  return Object.freeze({
    id,
    kind,
    stage: resolveProgressionFamilyUnlockDay(metadata.artifactId),
    order,
    metadata,
  });
}

function feature({
  id,
  kind,
  stage,
  order,
  reveal = afterVision,
  unlock = reveal,
  metadata = {},
}) {
  return Object.freeze({
    id,
    kind,
    stage,
    order,
    reveal,
    unlock,
    metadata: Object.freeze({ ...metadata }),
  });
}

export const PROGRESSION_CATALOG = Object.freeze([
  feature({
    id: FIRST_VISION,
    kind: PROGRESSION_FEATURE_KINDS.EXPERIENCE,
    stage: 0,
    order: 0,
    reveal: always,
    unlock: always,
    metadata: PROGRESSION_EXPERIENCE_PRESENTATION_POLICY.firstVision,
  }),
  feature({
    id: SEEDLING_REALITY,
    kind: PROGRESSION_FEATURE_KINDS.EXPERIENCE,
    stage: 1,
    order: 1,
    metadata: PROGRESSION_EXPERIENCE_PRESENTATION_POLICY.seedlingReality,
  }),
  slotFeature({
    id: SITE_SLOT_1,
    order: 10,
  }),
  slotFeature({
    id: SITE_SLOT_2,
    order: 20,
  }),
  slotFeature({
    id: SITE_SLOT_3,
    order: 30,
  }),
  slotFeature({
    id: SITE_SLOT_4,
    order: 40,
  }),
  slotFeature({
    id: SITE_SLOT_5,
    order: 50,
  }),
  artifactFeature({
    id: ARTIFACT_LENS,
    kind: PROGRESSION_FEATURE_KINDS.ARTIFACT_FAMILY,
    order: 100,
  }),
  artifactFeature({
    id: ARTIFACT_LENS_GRAYSCALE,
    kind: PROGRESSION_FEATURE_KINDS.ARTIFACT_CHILD,
    order: 101,
  }),
  artifactFeature({
    id: ARTIFACT_LENS_BLUR,
    kind: PROGRESSION_FEATURE_KINDS.ARTIFACT_CHILD,
    order: 102,
  }),
  artifactFeature({
    id: ARTIFACT_LENS_BRIGHTNESS,
    kind: PROGRESSION_FEATURE_KINDS.ARTIFACT_CHILD,
    order: 103,
  }),
  artifactFeature({
    id: ARTIFACT_LENS_CONTRAST,
    kind: PROGRESSION_FEATURE_KINDS.ARTIFACT_CHILD,
    order: 104,
  }),
  artifactFeature({
    id: ARTIFACT_LENS_SATURATION,
    kind: PROGRESSION_FEATURE_KINDS.ARTIFACT_CHILD,
    order: 105,
  }),
  artifactFeature({
    id: ARTIFACT_BARRIER_TEXT_RHYTHM,
    kind: PROGRESSION_FEATURE_KINDS.ARTIFACT_CHILD,
    order: 106,
  }),
  artifactFeature({
    id: ARTIFACT_BRAKE_INPUT_VISUAL_BRAKE,
    kind: PROGRESSION_FEATURE_KINDS.ARTIFACT_CHILD,
    order: 107,
  }),
  artifactFeature({
    id: ARTIFACT_VEIL,
    kind: PROGRESSION_FEATURE_KINDS.ARTIFACT_FAMILY,
    order: 200,
  }),
  artifactFeature({
    id: ARTIFACT_VEIL_TIME_SIGNALS,
    kind: PROGRESSION_FEATURE_KINDS.ARTIFACT_CHILD,
    order: 201,
  }),
  artifactFeature({
    id: ARTIFACT_VEIL_SOCIAL_METRICS,
    kind: PROGRESSION_FEATURE_KINDS.ARTIFACT_CHILD,
    order: 202,
  }),
  artifactFeature({
    id: ARTIFACT_BARRIER_INTENT_THRESHOLD,
    kind: PROGRESSION_FEATURE_KINDS.ARTIFACT_CHILD,
    order: 203,
  }),
  artifactFeature({
    id: ARTIFACT_BRAKE,
    kind: PROGRESSION_FEATURE_KINDS.ARTIFACT_FAMILY,
    order: 250,
  }),
  artifactFeature({
    id: ARTIFACT_BRAKE_SCROLL_FRICTION,
    kind: PROGRESSION_FEATURE_KINDS.ARTIFACT_CHILD,
    order: 252,
  }),
  artifactFeature({
    id: ARTIFACT_BRAKE_NAVIGATION_BUTTON_LOCK,
    kind: PROGRESSION_FEATURE_KINDS.ARTIFACT_CHILD,
    order: 254,
  }),
  artifactFeature({
    id: ARTIFACT_GATE,
    kind: PROGRESSION_FEATURE_KINDS.ARTIFACT_FAMILY,
    order: 300,
  }),
  artifactFeature({
    id: ARTIFACT_GATE_ENTRY_CHECKPOINT,
    kind: PROGRESSION_FEATURE_KINDS.ARTIFACT_CHILD,
    order: 301,
  }),
  artifactFeature({
    id: ARTIFACT_GATE_RETURN_GUARD,
    kind: PROGRESSION_FEATURE_KINDS.ARTIFACT_CHILD,
    order: 302,
  }),
  artifactFeature({
    id: ARTIFACT_BARRIER,
    kind: PROGRESSION_FEATURE_KINDS.ARTIFACT_FAMILY,
    order: 400,
  }),
  artifactFeature({
    id: ARTIFACT_VEIL_SHORTFORM_BLOCK,
    kind: PROGRESSION_FEATURE_KINDS.ARTIFACT_CHILD,
    order: 401,
  }),
  artifactFeature({
    id: ARTIFACT_BRAKE_SKIP_FRICTION,
    kind: PROGRESSION_FEATURE_KINDS.ARTIFACT_CHILD,
    order: 402,
  }),
  artifactFeature({
    id: ARTIFACT_BARRIER_DETOUR_SPREAD_GUARD,
    kind: PROGRESSION_FEATURE_KINDS.ARTIFACT_CHILD,
    order: 403,
  }),
  artifactFeature({
    id: ARTIFACT_FLARE,
    kind: PROGRESSION_FEATURE_KINDS.ARTIFACT_FAMILY,
    order: 500,
  }),
  artifactFeature({
    id: ARTIFACT_FLARE_SENTINEL,
    kind: PROGRESSION_FEATURE_KINDS.ARTIFACT_CHILD,
    order: 501,
  }),
  artifactFeature({
    id: ARTIFACT_ECHO,
    kind: PROGRESSION_FEATURE_KINDS.ARTIFACT_FAMILY,
    order: 600,
  }),
  artifactFeature({
    id: ARTIFACT_ECHO_HISTORY_CLEANUP,
    kind: PROGRESSION_FEATURE_KINDS.ARTIFACT_CHILD,
    order: 601,
  }),
  artifactFeature({
    id: ARTIFACT_ECHO_BOOKMARK_CONCEAL,
    kind: PROGRESSION_FEATURE_KINDS.ARTIFACT_CHILD,
    order: 602,
  }),
]);

export const PROGRESSION_CATALOG_BY_ID = Object.freeze(
  PROGRESSION_CATALOG.reduce((acc, entry) => {
    acc[entry.id] = entry;
    return acc;
  }, {}),
);

export function getProgressionCatalogEntry(featureId) {
  return typeof featureId === 'string'
    ? PROGRESSION_CATALOG_BY_ID[featureId.trim()] || null
    : null;
}
