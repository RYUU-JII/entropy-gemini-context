import { PROGRESSION_BONSAI_FULL_FORM_DAY_COUNT } from '../contracts/progressionBonsaiRelease.js';
import { PROGRESSION_ARTIFACT_JOURNEY_TARGET_DAY_COUNT } from './progressionJourneyPolicy.js';
import { PROGRESSION_DIRECT_REGISTRATION_DAY_COUNT,
  PROGRESSION_REGISTRATION_TARGET_DAY_COUNT } from './progressionRegistrationPolicy.js';

// This horizon only bounds preview controls and synthetic QA preparation. Each
// product policy evaluates the unbounded facts under its own schedule.
export const PROGRESSION_DEBUG_PREVIEW_TARGET_DAY_COUNT = Math.max(
  PROGRESSION_BONSAI_FULL_FORM_DAY_COUNT, PROGRESSION_ARTIFACT_JOURNEY_TARGET_DAY_COUNT,
  PROGRESSION_DIRECT_REGISTRATION_DAY_COUNT, PROGRESSION_REGISTRATION_TARGET_DAY_COUNT,
);
