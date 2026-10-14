import { normalizeSentinelFlareDeliveryForm } from '../runtime/sentinelFlareDeliveryForm.js';

export const SITE_FURIN_PROTOCOL_SYSTEM = 'site_furin_chime';
export const SITE_FURIN_PHASES = Object.freeze({ ARRIVAL:'arrival', CHOICE:'choice' });

// Product hypotheses. One host-owned visible-frame clock; no wall-time success,
// precision score, catch game, or timer-driven absorption.
export function resolveSiteFurinPolicy(config = null) {
  const deliveryForm = normalizeSentinelFlareDeliveryForm(config?.deliveryForm);
  const brief = deliveryForm === 'brief';
  return Object.freeze({
    deliveryForm,
    arrivalMs:brief?450:900,
    leaveMs:2200,
    reducedMotionLeaveMs:1600,
    stayMs:220,
  });
}

export function createSiteFurinState({ config = null } = {}) {
  return { ...resolveSiteFurinPolicy(config), visibleElapsedMs:0,
    action:null, completed:false, readyAtMs:0,
    exitChoice:null, exitElapsedMs:0, exitDurationMs:0 };
}

export function setSiteFurinAction(state, action) {
  if (![null,'continue'].includes(action)) throw new Error('site_furin_action_invalid');
  return state.action === action ? state : { ...state, action };
}

// Called by the host only after the lifecycle has acknowledged this choice.
// The presentation consumes this clock; it cannot commit a choice itself.
export function beginSiteFurinExit(state, choice, { reducedMotion = false } = {}) {
  if (!['leave','stay'].includes(choice)) throw new Error('site_furin_exit_choice_invalid');
  if (typeof reducedMotion !== 'boolean') throw new Error('site_furin_motion_policy_invalid');
  if (state.exitChoice !== null) {
    if (state.exitChoice === choice) return state;
    throw new Error('site_furin_exit_already_started');
  }
  const exitDurationMs = choice === 'stay'
    ? state.stayMs
    : reducedMotion ? state.reducedMotionLeaveMs : state.leaveMs;
  return { ...state, action:null, exitChoice:choice, exitElapsedMs:0, exitDurationMs };
}

export function resetSiteFurinExit(state) {
  return { ...state, action:null, completed:false, readyAtMs:0,
    exitChoice:null, exitElapsedMs:0, exitDurationMs:0 };
}

export function advanceSiteFurinFrame(state, { frameMs, visible, presented } = {}) {
  if (!state || !Number.isFinite(state.visibleElapsedMs)) throw new Error('site_furin_state_invalid');
  if (!Number.isFinite(frameMs) || frameMs < 0) throw new Error('site_furin_frame_invalid');
  if (!presented || !visible || frameMs === 0) return state;
  const dt = Math.min(50,frameMs);
  const next = { ...state, visibleElapsedMs:Math.min(state.arrivalMs,state.visibleElapsedMs+dt) };
  if (state.exitChoice !== null) {
    next.exitElapsedMs = Math.min(state.exitDurationMs,state.exitElapsedMs+dt);
  }
  return Object.keys(next).every(key=>next[key]===state[key]) ? state : next;
}

export function resolveSiteFurinProgress(state) {
  if (!state || !Number.isFinite(state.visibleElapsedMs)) throw new Error('site_furin_state_invalid');
  const ready = state.visibleElapsedMs >= state.arrivalMs;
  const phase = ready ? SITE_FURIN_PHASES.CHOICE : SITE_FURIN_PHASES.ARRIVAL;
  const exitStarted = state.exitChoice !== null;
  const exitComplete = exitStarted && state.exitElapsedMs >= state.exitDurationMs;
  return { protocolSystem:SITE_FURIN_PROTOCOL_SYSTEM, deliveryForm:state.deliveryForm, phase,
    visibleElapsedMs:state.visibleElapsedMs, arrivalMs:state.arrivalMs,
    durationMs:state.arrivalMs, action:state.action,
    continueReady:state.action === 'continue',
    exitChoice:state.exitChoice, exitElapsedMs:state.exitElapsedMs,
    exitDurationMs:state.exitDurationMs,
    exitProgress:exitStarted ? state.exitElapsedMs/state.exitDurationMs : 0,
    exitComplete,
    progress:state.visibleElapsedMs/state.arrivalMs, timeProgress:state.visibleElapsedMs/state.arrivalMs,
    remainingMs:state.arrivalMs-state.visibleElapsedMs,
    completed:state.completed, ready, interactionOpen:true,
    needsFrame:!ready || (exitStarted && !exitComplete) };
}
