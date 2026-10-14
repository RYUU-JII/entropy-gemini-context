import { VISUAL_FRICTION_CONTROLS } from '../../settings/config/visualFrictionProfiles.js';
import {
  PROTECTION_CANONICAL_ARTIFACT_CATALOG,
  PROTECTION_CANONICAL_ARTIFACT_ID_LIST,
} from './artifactFamilyCatalog.js';
import {
  SOCIAL_METRIC_SCOPES,
} from '../../settings/config/socialMetricScope.js';
import { DEFAULT_ENSO_INTERVAL_PRESET } from '../../settings/config/ensoIntervalPolicy.js';

export const ARTIFACT_RECOMMENDATION_IDS = Object.freeze({
  GENTLE_START_V1: 'gentle_start_v1',
});

const GENTLE_START_V1 = ARTIFACT_RECOMMENDATION_IDS.GENTLE_START_V1;

// Recommendations are explicit, one-shot configuration commands. They are not
// family enable state and are never re-applied by resume.
export const ARTIFACT_RECOMMENDATION_CATALOG = Object.freeze({
  lens: Object.freeze({
    id: GENTLE_START_V1,
    config: Object.freeze({
      grayscale: Object.freeze({ enabled: false, strength: VISUAL_FRICTION_CONTROLS.saturation.defaultStrength }),
      blur: Object.freeze({ enabled: false, strength: VISUAL_FRICTION_CONTROLS.blur.defaultStrength }),
      brightness: Object.freeze({ enabled: true, strength: VISUAL_FRICTION_CONTROLS.brightness.defaultStrength }),
      contrast: Object.freeze({ enabled: false, strength: VISUAL_FRICTION_CONTROLS.contrast.defaultStrength }),
      saturation: Object.freeze({ enabled: true, strength: VISUAL_FRICTION_CONTROLS.colorSaturation.defaultStrength }),
    }),
  }),
  brake: Object.freeze({
    id: GENTLE_START_V1,
    config: Object.freeze({
      clickPause: Object.freeze({ enabled: false }),
      scrollFriction: Object.freeze({ enabled: true }),
      inputVisualBrake: Object.freeze({ enabled: true }),
      skipFriction: Object.freeze({ enabled: false }),
    }),
  }),
  gate: Object.freeze({
    id: GENTLE_START_V1,
    config: Object.freeze({
      entryCheckpoint: Object.freeze({ enabled: true }),
      returnGuard: Object.freeze({ enabled: false }),
    }),
  }),
  flare: Object.freeze({
    id: GENTLE_START_V1,
    config: Object.freeze({
      enabled: true,
    }),
  }),
  barrier: Object.freeze({
    id: GENTLE_START_V1,
    config: Object.freeze({
      intentThreshold: Object.freeze({ enabled: false, interval: DEFAULT_ENSO_INTERVAL_PRESET }),
      textRhythm: Object.freeze({ enabled: false }),
      detourSpreadGuard: Object.freeze({
        enabled: false,
        maxProtectedTabs: 3,
      }),
    }),
  }),
  echo: Object.freeze({
    id: GENTLE_START_V1,
    config: Object.freeze({
      // History cleanup is destructive and must never be recommendation-owned.
      historyCleanupEnabled: false,
      bookmarkConcealEnabled: true,
      tabEvaporationEnabled: false,
      tabEvaporationTimeoutMinutes: 5,
    }),
  }),
  veil: Object.freeze({
    id: GENTLE_START_V1,
    config: Object.freeze({
      socialMetrics: Object.freeze({
        enabled: true,
        scope: SOCIAL_METRIC_SCOPES.REACTIONS,
      }),
      timeSignals: Object.freeze({ enabled: false }),
      shortformBlock: Object.freeze({ enabled: true }),
    }),
  }),
});

function assertArtifactRecommendationCatalog() {
  const recommendationFamilyIds = Object.keys(ARTIFACT_RECOMMENDATION_CATALOG);
  if (
    recommendationFamilyIds.length !== PROTECTION_CANONICAL_ARTIFACT_ID_LIST.length
    || PROTECTION_CANONICAL_ARTIFACT_ID_LIST.some(
      (familyId) => !Object.hasOwn(ARTIFACT_RECOMMENDATION_CATALOG, familyId),
    )
  ) {
    throw new Error('[artifactRecommendationCatalog] Recommendations must cover every artifact family exactly once.');
  }

  recommendationFamilyIds.forEach((familyId) => {
    const recommendation = ARTIFACT_RECOMMENDATION_CATALOG[familyId];
    if (!Object.values(ARTIFACT_RECOMMENDATION_IDS).includes(recommendation?.id)) {
      throw new Error(`[artifactRecommendationCatalog] Invalid recommendation id for "${familyId}".`);
    }
    if (!recommendation?.config || typeof recommendation.config !== 'object') {
      throw new Error(`[artifactRecommendationCatalog] Missing recommendation config for "${familyId}".`);
    }
    if (familyId !== 'echo' && familyId !== 'flare') {
      const { releaseChildren } = PROTECTION_CANONICAL_ARTIFACT_CATALOG[familyId];
      const unknownChild = Object.keys(recommendation.config)
        .find((childId) => !releaseChildren.includes(childId));
      if (unknownChild) {
        throw new Error(`[artifactRecommendationCatalog] Recommendation child "${unknownChild}" is not owned by "${familyId}".`);
      }
    }
  });

  if (ARTIFACT_RECOMMENDATION_CATALOG.echo.config.historyCleanupEnabled !== false) {
    throw new Error('[artifactRecommendationCatalog] Echo recommendation must not enable destructive history cleanup.');
  }
}

assertArtifactRecommendationCatalog();

export function getArtifactRecommendation(familyId, recommendationId = GENTLE_START_V1) {
  const normalizedFamilyId = typeof familyId === 'string' ? familyId.trim() : '';
  const recommendation = ARTIFACT_RECOMMENDATION_CATALOG[normalizedFamilyId] || null;
  if (!recommendation || recommendation.id !== recommendationId) return null;
  return recommendation;
}

export function getDefaultArtifactRecommendation(familyId) {
  return getArtifactRecommendation(familyId, GENTLE_START_V1);
}
