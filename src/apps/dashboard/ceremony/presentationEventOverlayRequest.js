import {
  CEREMONY_COMPLETION_POLICIES,
  normalizeCeremonyId,
} from '../../../platform/ceremony/ceremonyContracts.js';
import {
  PRESENTATION_EVENT_IDS,
  getPresentationEventPlan,
} from './presentationEventCeremonyPlan.js';

const freeze = (value) => Object.freeze(value);

const PRESENTATION_EVENT_OVERLAY_MODES = freeze({
  FIRST_VISION_DESCENT: 'first_vision_descent',
});

function hasObjectShape(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function buildInactiveOverlayRequest(reason) {
  return freeze({
    active: false,
    eventId: null,
    ceremonyId: null,
    completionPolicy: CEREMONY_COMPLETION_POLICIES.PLAYBACK,
    holdAtCover: false,
    releaseCover: false,
    reason,
  });
}

function resolvePlanCeremonyId(plan) {
  const ceremonyId = normalizeCeremonyId(plan?.ceremonyId);
  if (!ceremonyId) {
    throw new Error('Presentation event overlay plan has no valid ceremony id.');
  }
  return ceremonyId;
}

function resolvePlanCompletionPolicy(plan) {
  const completionPolicy = plan?.overlay?.completionPolicy;
  if (completionPolicy !== CEREMONY_COMPLETION_POLICIES.RELEASE_GATED) {
    throw new Error('Presentation event overlay plan has no valid completion policy.');
  }
  return completionPolicy;
}

function buildFirstVisionDescentOverlayRequest(overlayProjection) {
  const plan = getPresentationEventPlan(PRESENTATION_EVENT_IDS.FIRST_VISION);
  return freeze({
    active: true,
    eventId: plan.eventId,
    ceremonyId: resolvePlanCeremonyId(plan),
    completionPolicy: resolvePlanCompletionPolicy(plan),
    holdAtCover: overlayProjection.holdAtCover === true,
    releaseCover: overlayProjection.releaseCover === true,
    reason: 'first_vision_descent',
  });
}

export function resolvePresentationEventOverlayRequest({
  overlayProjection = null,
} = {}) {
  if (!hasObjectShape(overlayProjection)) {
    return buildInactiveOverlayRequest('missing_overlay_projection');
  }

  if (overlayProjection.active !== true) {
    return buildInactiveOverlayRequest('overlay_inactive');
  }

  const mode = typeof overlayProjection.mode === 'string'
    ? overlayProjection.mode.trim()
    : '';
  if (!mode) {
    throw new Error('Presentation event overlay projection is active without a mode.');
  }

  if (mode === PRESENTATION_EVENT_OVERLAY_MODES.FIRST_VISION_DESCENT) {
    return buildFirstVisionDescentOverlayRequest(overlayProjection);
  }

  throw new Error(`Unsupported presentation event overlay mode: ${mode}.`);
}
