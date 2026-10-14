import {
  normalizeInterventionPlan,
  normalizeObservation,
  normalizeProtectionProfile,
} from '../../contracts/protectionContracts.js';
import { PROTECTION_REASON_CODES } from '../../contracts/reasonCodes.js';
import { createLevelResolver } from './LevelResolver.js';
import { createLaneCompiler } from './LaneCompiler.js';
import { createFilterPlanCompiler } from './FilterPlanCompiler.js';
import { createArtifactPlanResolver } from './ArtifactPlanResolver.js';

function dedupeReasons(reasons = []) {
  return Array.from(new Set((Array.isArray(reasons) ? reasons : []).filter(Boolean)));
}

export function createInterventionPlanner({
  levelResolver = createLevelResolver(),
  laneCompiler = createLaneCompiler(),
  filterPlanCompiler = createFilterPlanCompiler(),
  artifactPlanResolver = createArtifactPlanResolver(),
} = {}) {
  function plan({
    profile,
    observation,
    previousPlan = null,
    runtimeState = {},
  } = {}) {
    const normalizedProfile = normalizeProtectionProfile(profile);
    const normalizedObservation = normalizeObservation(observation);
    const levelResult = levelResolver.resolve({
      profile: normalizedProfile,
      observation: normalizedObservation,
      previousState: runtimeState,
    });
    const lanes = laneCompiler.compile({
      profile: normalizedProfile,
      level: levelResult.level,
    });
    const filterPlan = filterPlanCompiler.compile({
      lanes,
    });
    const artifacts = artifactPlanResolver.resolve({
      profile: normalizedProfile,
      observation: normalizedObservation,
      cooldowns: runtimeState?.cooldowns,
      previousArtifacts: previousPlan?.artifacts,
    });
    const reasons = dedupeReasons([
      ...levelResult.reasons,
      ...(normalizedObservation.directTriggers.length > 0
        ? [PROTECTION_REASON_CODES.DIRECT_TRIGGER_PRESENT]
        : []),
    ]);

    return normalizeInterventionPlan({
      state: {
        level: levelResult.level,
        reasons,
      },
      lanes,
      filterPlan,
      artifacts,
      trace: {
        budgetRatio: normalizedObservation.budgetRatio,
        pressureSignals: normalizedObservation.pressureSignals,
        directTriggers: normalizedObservation.directTriggers,
      },
    });
  }

  return {
    plan,
  };
}
