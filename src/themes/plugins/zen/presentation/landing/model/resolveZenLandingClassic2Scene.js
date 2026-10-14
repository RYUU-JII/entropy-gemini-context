import {
  applyZenBonsaiGrowthProjectionToStage,
  resolveZenBonsaiGrowthProjection,
} from '../../../model/ZenBonsaiGrowthProjection.js';
import { normalizeZenBonsaiLifeState } from '../../../model/ZenBonsaiLifeState.js';
import { STAGES } from '../../../model/ZenBonsaiStageContract.js';
import { SeededRandom } from '../../../model/SeededRandom.js';
import { SakuraSpecies } from '../../../model/SakuraSpecies.js';
import {
  projectZenBonsaiClassic2DevelopmentTopology,
  resolveZenBonsaiClassic2DisplayCandidateStage,
  resolveZenBonsaiClassic2RenderStage,
  ZEN_BONSAI_CLASSIC2_WOOD_CLOCK_POLICIES,
} from '../../../model/classic2/ZenBonsaiClassic2DevelopmentModel.js';

const LANDING_CLASSIC2_SEED = 478;
const LANDING_CLASSIC2_STRUCTURE_DEPTH = 6;
const LANDING_CLASSIC2_REFERENCE_HEIGHT = 360;

let landingCandidateTopology = null;

function clamp01(value) {
  return Math.max(0, Math.min(1, Number(value)));
}

function smoothstep(value) {
  const t = clamp01(value);
  return t * t * (3 - (2 * t));
}

function requireGrowth(value) {
  if (!Number.isFinite(value) || value < 0 || value > 1) {
    throw new Error('ZEN_LANDING_CLASSIC2_GROWTH_INVALID');
  }
  return value;
}

function resolveLifePhase(growth) {
  if (growth < 0.3) return 'seedling';
  if (growth < 0.72) return 'juvenile';
  return 'mature';
}

function resolveLandingCandidateStage() {
  return resolveZenBonsaiClassic2DisplayCandidateStage({
    baseStage: STAGES.BLOOM,
    structureDepth: LANDING_CLASSIC2_STRUCTURE_DEPTH,
    learningProgress: 1,
  });
}

function resolveLandingCandidateTopology() {
  if (landingCandidateTopology) return landingCandidateTopology;
  landingCandidateTopology = SakuraSpecies.generateTopology(
    new SeededRandom(LANDING_CLASSIC2_SEED),
    resolveLandingCandidateStage(),
    LANDING_CLASSIC2_REFERENCE_HEIGHT,
  );
  return landingCandidateTopology;
}

function resolveLandingLifeState(growth) {
  const bloom = smoothstep((growth - 0.72) / 0.28);
  return normalizeZenBonsaiLifeState({
    phase: resolveLifePhase(growth),
    growth: 0.5 + (growth * 0.5),
    vitality: 0.86 + (growth * 0.1),
    stress: 0.025,
    bloom,
    dryness: 0.015,
    branchSag: 0.025 + (growth * 0.025),
    windResponse: 0.72 + (growth * 0.18),
    dataDays: Math.round(growth * 7),
    analysisConfidence: 0.42 + (growth * 0.58),
  });
}

/**
 * Projects the production Classic2 candidate with deterministic, storage-free
 * landing input. This seam owns no repository, lineage, worker, or progression
 * state; the landing only supplies a normalized point on its visual timeline.
 */
export function resolveZenLandingClassic2Scene(growth) {
  const normalizedGrowth = requireGrowth(growth);
  const cameraTopology = resolveLandingCandidateTopology();
  const lifeState = resolveLandingLifeState(normalizedGrowth);
  const growthProjection = resolveZenBonsaiGrowthProjection({
    lifeState,
    structureDepth: LANDING_CLASSIC2_STRUCTURE_DEPTH,
  });
  const projected = projectZenBonsaiClassic2DevelopmentTopology({
    topology: cameraTopology,
    lifeState,
    projection: growthProjection,
    woodClockPolicy: ZEN_BONSAI_CLASSIC2_WOOD_CLOCK_POLICIES.EPHEMERAL_SCRUB,
  });
  const projectedStage = applyZenBonsaiGrowthProjectionToStage(
    resolveLandingCandidateStage(),
    growthProjection,
  );

  return Object.freeze({
    contract: 'zen_landing_classic2_scene_v1',
    identity: Object.freeze({
      model: 'classic2',
      seed: LANDING_CLASSIC2_SEED,
      structureDepth: LANDING_CLASSIC2_STRUCTURE_DEPTH,
      topologyReferenceHeight: LANDING_CLASSIC2_REFERENCE_HEIGHT,
    }),
    topology: projected.topology,
    cameraTopology,
    lifeState,
    growthProjection,
    currentStage: resolveZenBonsaiClassic2RenderStage({
      stage: projectedStage,
      structureDepth: LANDING_CLASSIC2_STRUCTURE_DEPTH,
      growthProjection,
    }),
    diagnostics: projected.diagnostics,
  });
}

export const ZEN_LANDING_CLASSIC2_SCENE_IDENTITY = Object.freeze({
  model: 'classic2',
  seed: LANDING_CLASSIC2_SEED,
  structureDepth: LANDING_CLASSIC2_STRUCTURE_DEPTH,
  topologyReferenceHeight: LANDING_CLASSIC2_REFERENCE_HEIGHT,
});
