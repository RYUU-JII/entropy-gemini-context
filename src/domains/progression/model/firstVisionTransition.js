import {
  PROGRESSION_EXPERIENCE_PRESENTATION_POLICY,
} from '../policy/progressionPolicy.js';

function requireNonNegativeDuration(value, field) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric < 0) {
    throw new Error(`FIRST_VISION_TRANSITION_DURATION_INVALID:${field}`);
  }
  return Math.floor(numeric);
}

export function getFirstVisionTransitionGatePolicy() {
  return PROGRESSION_EXPERIENCE_PRESENTATION_POLICY.firstVision.transitionGate;
}

export function resolveFirstVisionDreamDwellMs({
  transitionGate = getFirstVisionTransitionGatePolicy(),
} = {}) {
  return requireNonNegativeDuration(
    transitionGate?.minimumVisionDurationMs,
    'minimumVisionDurationMs',
  ) + requireNonNegativeDuration(
    transitionGate?.descentDelayAfterTriggerMs,
    'descentDelayAfterTriggerMs',
  );
}

export default resolveFirstVisionDreamDwellMs;
