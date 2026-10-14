import {
  normalizeProtectionProfile,
} from '../../contracts/protectionContracts.js';
import { getPostureProfile } from '../../catalog/postureProfiles.js';
import { createObservationAssembler } from '../observe/ObservationAssembler.js';
import { createInterventionPlanner } from '../policy/InterventionPlanner.js';
import { createBasicStrategyOrchestrator } from '../strategy/BasicStrategyOrchestrator.js';
import { createStrategyProfileCompiler } from '../strategy/StrategyProfileCompiler.js';
import { updateArtifactCooldowns } from '../policy/ArtifactPlanResolver.js';
import { createPlanStateStore } from './PlanStateStore.js';

function normalizeHost(host) {
  return typeof host === 'string' ? host.trim().toLowerCase() : '';
}

function normalizeNow(now) {
  const num = Number(now);
  return Number.isFinite(num) ? num : Date.now();
}

function computeDeescalationNotBefore({
  previousLevel = 1,
  nextLevel = 1,
  now = Date.now(),
  holdMs = 0,
  previousDeescalationNotBefore = 0,
} = {}) {
  if (nextLevel > previousLevel) {
    return now + holdMs;
  }
  if (nextLevel < previousLevel) {
    return previousDeescalationNotBefore;
  }
  return previousDeescalationNotBefore;
}

export function createProtectionEngine({
  observationAssembler = createObservationAssembler(),
  interventionPlanner = createInterventionPlanner(),
  strategyOrchestrator = createBasicStrategyOrchestrator(),
  strategyProfileCompiler = createStrategyProfileCompiler(),
  planStateStore = createPlanStateStore(),
} = {}) {
  function buildNextState({
    host,
    tabId,
    profile,
    context = {},
    now = Date.now(),
  } = {}) {
    const normalizedHost = normalizeHost(host);
    const normalizedNow = normalizeNow(now);
    const normalizedProfile = normalizeProtectionProfile(profile);
    const previousState = planStateStore.get({ host: normalizedHost, tabId }) || {};
    const observation = observationAssembler.assemble({
      profile: normalizedProfile,
      host: normalizedHost,
      tabId,
      context,
      now: normalizedNow,
    });
    const strategy = strategyOrchestrator.decide({
      profile: normalizedProfile,
      observation,
      previousDecision: previousState.strategy,
      strategyContext: context?.strategyContext,
    });
    const effectiveProfile = strategyProfileCompiler.compile({
      profile: normalizedProfile,
      decision: strategy,
    });
    const plan = interventionPlanner.plan({
      profile: effectiveProfile,
      observation,
      previousPlan: previousState.plan,
      runtimeState: {
        level: previousState.plan?.state?.level,
        deescalationNotBefore: previousState.deescalationNotBefore,
        cooldowns: previousState.cooldowns,
      },
    });
    const postureProfile = getPostureProfile(effectiveProfile.posture);
    const cooldowns = updateArtifactCooldowns({
      artifacts: plan.artifacts,
      observation,
      cooldowns: previousState.cooldowns,
    });
    const deescalationNotBefore = computeDeescalationNotBefore({
      previousLevel: previousState.plan?.state?.level || 1,
      nextLevel: plan.state.level,
      now: observation.now,
      holdMs: postureProfile.deescalationHoldMs,
      previousDeescalationNotBefore: previousState.deescalationNotBefore || 0,
    });

    return {
      host: normalizedHost,
      tabId,
      profile: normalizedProfile,
      observation,
      plan,
      previousState,
      nextState: {
        plan,
        strategy,
        effectiveProfile,
        cooldowns,
        deescalationNotBefore,
        lastObservation: observation,
      },
    };
  }

  function evaluate(input = {}) {
    const result = buildNextState(input);
    planStateStore.set({
      host: result.host,
      tabId: input.tabId,
    }, result.nextState);

    return {
      host: result.host,
      observation: result.observation,
      strategy: result.nextState.strategy,
      effectiveProfile: result.nextState.effectiveProfile,
      plan: result.plan,
      state: result.nextState,
    };
  }

  function reset(scope = {}) {
    planStateStore.clear(scope);
  }

  return {
    evaluate,
    reset,
  };
}
