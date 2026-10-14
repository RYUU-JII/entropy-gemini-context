import {
  CEREMONY_COMPLETION_POLICIES,
  CEREMONY_IDS,
  FIRST_VISION_DESCENT_RENDER_PROFILE,
  FIRST_VISION_DESCENT_TIMELINE,
  getCeremonyDurationMs,
} from '../../../platform/ceremony/ceremonyContracts.js';

const freeze = (value) => Object.freeze(value);

export const PRESENTATION_EVENT_IDS = freeze({
  FIRST_VISION: 'first_vision',
});

export const FIRST_VISION_PRESENTATION_EVENT_PLAN = freeze({
  eventId: PRESENTATION_EVENT_IDS.FIRST_VISION,
  ceremonyId: CEREMONY_IDS.FIRST_VISION_DESCENT,
  ceremonyDurationMs: getCeremonyDurationMs(CEREMONY_IDS.FIRST_VISION_DESCENT),
  timeline: FIRST_VISION_DESCENT_TIMELINE,
  renderProfile: FIRST_VISION_DESCENT_RENDER_PROFILE,
  overlay: freeze({
    completionPolicy: CEREMONY_COMPLETION_POLICIES.RELEASE_GATED,
  }),
});

export const PRESENTATION_EVENT_PLAN_BY_ID = freeze({
  [FIRST_VISION_PRESENTATION_EVENT_PLAN.eventId]: FIRST_VISION_PRESENTATION_EVENT_PLAN,
});

export function getPresentationEventPlan(eventId) {
  const normalizedEventId = typeof eventId === 'string' ? eventId.trim() : '';
  const plan = PRESENTATION_EVENT_PLAN_BY_ID[normalizedEventId];
  if (!plan) {
    throw new Error(`Unknown presentation event plan: ${String(eventId)}.`);
  }
  return plan;
}
