import { recordProtectionFeatureEvent } from '../../protection/content/runtime/protectionRuntimeDiagnostics.js';
import {
  RITUAL_SURFACE_INPUT_POLICY_MODES,
  RITUAL_SURFACE_TYPES,
  claimRitualSurface,
  getRitualSurfaceSnapshot,
} from '../runtime/ritualSurfaceArbiter.js';
import interventionAdmissionClient from '../runtime/interventionAdmissionClient.js';

export const CLICK_ENSO_GATE_SURFACE_OWNER_ID = 'click_enso_gate_active';
export const FEED_ENSO_EPISODE_SURFACE_OWNER_ID = 'enso_feed_episode';

const ENSO_GATE_INPUT_EVENT_TYPES = Object.freeze([
  'auxclick',
  'beforeinput',
  'click',
  'contextmenu',
  'dblclick',
  'dragstart',
  'drop',
  'input',
  'keydown',
  'keypress',
  'keyup',
  'mousedown',
  'mousemove',
  'mouseup',
  'paste',
  'pointercancel',
  'pointerdown',
  'pointermove',
  'pointerup',
  'touchend',
  'touchmove',
  'touchstart',
  'wheel',
]);

const ENSO_GATE_ALLOWED_ROUTING_EVENTS = new Set([
  'click',
  'mousedown',
  'mousemove',
  'mouseup',
  'pointercancel',
  'pointerdown',
  'pointermove',
  'pointerup',
]);

function isAllowedEnsoGateInputEvent({ event } = {}) {
  const eventType = event?.type || '';
  if (ENSO_GATE_ALLOWED_ROUTING_EVENTS.has(eventType)) return true;
  return ['keydown', 'keyup'].includes(eventType) && ['Escape', 'ArrowLeft', 'ArrowRight'].includes(event?.key);
}

function recordEnsoGateBlockedInput(
  { eventType = '', key = '', point = null } = {},
  getActiveGate = null,
  diagnosticFeatureKey = 'ensoGate',
) {
  const gate = typeof getActiveGate === 'function' ? getActiveGate() : null;
  recordProtectionFeatureEvent(
    gate?.diagnosticFeatureKey || diagnosticFeatureKey,
    gate?.debugSpawn ? 'enso_gate_debug_page_input_blocked' : 'enso_gate_page_input_blocked',
    {
      eventType,
      key,
      point,
      debugSpawn: gate?.debugSpawn === true,
      tagName: gate?.target?.tagName || null,
    },
  );
}

function createEnsoGateInputPolicy({
  getActiveGate = null,
  diagnosticFeatureKey = 'ensoGate',
} = {}) {
  return {
    mode: RITUAL_SURFACE_INPUT_POLICY_MODES.LOCK_TO_SURFACE,
    eventTypes: ENSO_GATE_INPUT_EVENT_TYPES,
    isAllowedEvent: isAllowedEnsoGateInputEvent,
    onBlockedInput: (details) => recordEnsoGateBlockedInput(
      details,
      getActiveGate,
      diagnosticFeatureKey,
    ),
  };
}

export function claimEnsoGateSurface({
  event = null,
  debugSpawn = false,
  preparedDebugLease = null,
  source = 'click_intent',
  ownerId = CLICK_ENSO_GATE_SURFACE_OWNER_ID,
  diagnosticFeatureKey = 'ensoGate',
  onSuppress = null,
  getActiveGate = null,
} = {}) {
  let admissionLease = interventionAdmissionClient.currentLease(RITUAL_SURFACE_TYPES.ENSO_GATE);
  // A detector QA fixture can consume only the exact lease its own preceding
  // prepare acquired. Default manual debug still cannot adopt an ordinary owner.
  if (debugSpawn && admissionLease && !admissionLease.manual && preparedDebugLease !== admissionLease) return { accepted: false, reason: 'production_intervention_owned', claim: null };
  if (debugSpawn && !admissionLease) {
    const admission = interventionAdmissionClient.tryReserve({ kind: RITUAL_SURFACE_TYPES.ENSO_GATE, source: 'manual_enso', manual: true });
    if (!admission.accepted) return { accepted: false, reason: 'admission_pending', claim: null };
    admissionLease = admission.lease;
  }
  return claimRitualSurface({
    type: RITUAL_SURFACE_TYPES.ENSO_GATE,
    ownerId,
    admissionLease,
    replaceClaim: source === 'feed_horizon' ? getRitualSurfaceSnapshot().dominant : null,
    metadata: {
      phase: event?.type || 'press_start',
      debugSpawn,
      source,
    },
    inputPolicy: createEnsoGateInputPolicy({
      getActiveGate,
      diagnosticFeatureKey,
    }),
    onSuppress,
  });
}

export function claimEnsoFeedPreludeSurface({ onSuppress = null } = {}) {
  return claimRitualSurface({
    type: RITUAL_SURFACE_TYPES.ENSO_GATE,
    ownerId: FEED_ENSO_EPISODE_SURFACE_OWNER_ID,
    admissionLease: interventionAdmissionClient.currentLease(RITUAL_SURFACE_TYPES.ENSO_GATE),
    metadata: {
      phase: 'feed_horizon',
      source: 'feed_horizon',
    },
    onSuppress,
  });
}
