import { clampNumber, getEnsoGateVisualTones } from './EnsoGateTimeline.js';
import { ensureEnsoGateStyle } from './ensoGateStyle.js';
import { getDocumentRef } from './interactionDom.js';
import { tRuntime } from '../../settings/i18n/runtime.js';
import { getCurrentDocumentTheme } from '../../../themes/core/documentTheme.js';
import { getThemeDefinition } from '../../../themes/core/catalog.js';
const focusByView = new WeakMap();

export function createEnsoGateAnchor(target, event) {
  const rect = target.getBoundingClientRect();
  return { clientX: Number.isFinite(event?.clientX) ? event.clientX : rect.left + rect.width / 2, clientY: Number.isFinite(event?.clientY) ? event.clientY : rect.top + rect.height / 2 };
}

export function positionEnsoGateView(view) { view.style.inset = '0'; }

export function createEnsoGateView() {
  const doc = getDocumentRef();
  if (!doc?.body) throw new Error('BARRIER_BOUNDARY_DOCUMENT_UNAVAILABLE');
  ensureEnsoGateStyle();
  const view = doc.createElement('div');
  view.className = 'friction-click-enso-gate';
  view.dataset.theme = getCurrentDocumentTheme();
  view.dataset.zone = 'armed';
  view.dataset.entry = 'summoning';
  view.setAttribute('role', 'dialog');
  view.setAttribute('aria-modal', 'true');
  view.setAttribute('aria-label', tRuntime('common:consumption_boundary.title'));
  view.tabIndex = 0;
  const colors = getThemeDefinition(view.dataset.theme).tokens.colors;
  // Barrier's Zen threshold is a charcoal surface, independent of the light garden.
  const palette = view.dataset.theme === 'zen'
    ? { accent: '#a9b39d', text: '#dcded2', background: '#101210' }
    : { accent: colors.accent, text: colors.text, background: colors.background };
  for (const [name, value] of Object.entries(palette)) {
    if (typeof value !== 'string') throw new Error('BARRIER_BOUNDARY_THEME_TOKEN_MISSING:' + name);
    view.style.setProperty('--boundary-' + name, value);
  }
  const title = doc.createElement('p');
  title.className = 'consumption-boundary__title';
  title.textContent = tRuntime('common:consumption_boundary.title');
  const track = doc.createElement('div');
  track.className = 'consumption-boundary__track';
  const labels = {
    leave: tRuntime('common:consumption_boundary.leave'),
    enter: tRuntime('common:consumption_boundary.enter'),
  };
  for (const side of ['leave', 'enter']) {
    const label = doc.createElement('span');
    label.className = 'consumption-boundary__label consumption-boundary__label--' + side;
    label.textContent = labels[side];
    track.appendChild(label);
  }
  const handle = doc.createElement('div');
  handle.className = 'consumption-boundary__handle';
  handle.setAttribute('aria-hidden', 'true');
  track.appendChild(handle);
  const instruction = doc.createElement('p');
  instruction.className = 'consumption-boundary__instruction';
  instruction.textContent = tRuntime('common:consumption_boundary.instruction');
  const status = doc.createElement('span');
  status.className = 'consumption-boundary__status';
  status.setAttribute('role', 'status');
  status.setAttribute('aria-live', 'polite');
  view.append(title, track, instruction, status);
  focusByView.set(view, doc.activeElement);
  doc.body.appendChild(view);
  view.focus({ preventScroll: true });
  return view;
}

export function setEnsoGateRouteVars(view, frame) {
  if (!view) return;
  const progress = frame?.signedProgress;
  if (!Number.isFinite(progress) || progress < -1 || progress > 1) throw new Error('BARRIER_BOUNDARY_ROUTE_INVALID');
  view.style.setProperty('--boundary-shift', String(progress));
  return Math.abs(progress);
}
export function getGestureRouteProgress(frame) {
  if (!Number.isFinite(frame?.progress) || frame.progress < 0 || frame.progress > 1) throw new Error('BARRIER_BOUNDARY_PROGRESS_INVALID');
  return frame.progress;
}
export function getGestureDataZone(frame) { return frame?.ready ? (frame.direction > 0 ? 'enter-ready' : 'leave-ready') : frame?.phase === 'armed' ? 'armed' : 'tracking'; }
export function getGestureFeedbackState(frame) { return frame?.ready ? 'ready' : 'tracking'; }
export function drawEnsoGateGestureFrame(gate, frame) {
  if (!gate?.view || !frame) return;
  gate.view.style.setProperty('--boundary-travel', frame.radius + 'px');
  gate.view.dataset.direction = frame.direction > 0 ? 'enter' : frame.direction < 0 ? 'leave' : 'neutral';
  gate.view.dataset.ready = String(frame.ready === true);
  const status = gate.view.querySelector('.consumption-boundary__status');
  const key = frame.ready ? (frame.direction > 0 ? 'release_enter' : 'release_leave') : 'idle';
  if (status.dataset.message !== key) {
    status.dataset.message = key;
    const messages = {
      idle: tRuntime('common:consumption_boundary.idle'),
      release_enter: tRuntime('common:consumption_boundary.release_enter'),
      release_leave: tRuntime('common:consumption_boundary.release_leave'),
    };
    status.textContent = messages[key];
  }
}
export function fadeEnsoGateRetryInk(view) { if (view) view.dataset.ready = 'false'; }
export function removeEnsoGateView(view) {
  const previous = focusByView.get(view);
  const restoreFocus = view?.ownerDocument?.activeElement === view;
  focusByView.delete(view);
  view?.remove();
  if (restoreFocus && previous?.isConnected) previous.focus({ preventScroll: true });
}
export function setEnsoGateOutcomePresentation(view, action, durationMs) {
  if (!view) return;
  view.dataset.resolving = 'true';
  view.dataset.outcome = action;
  view.style.setProperty('--friction-click-enso-outcome-ms', durationMs + 'ms');
}
export function setTargetEnsoFeedback(target, active, frameOrZone = 'guard', config = {}) {
  if (!(target instanceof Element) || !target.isConnected) return;
  if (!active) return;
  const progressByZone = {
    guard: 0.08,
    impulse: 0.34,
    wake: 0.68,
    release: 0.92,
    drawing: 0.18,
    sealed: 0.92,
    unsealing: 0.62,
    'enter-ready': 0.72,
  };
  const progress = frameOrZone && typeof frameOrZone === 'object'
    ? frameOrZone.progress
    : progressByZone[frameOrZone] ?? 0.08;
  const tones = frameOrZone && typeof frameOrZone === 'object' && frameOrZone.tones
    ? frameOrZone.tones
    : getEnsoGateVisualTones(progress, config);
  const impulseTone = clampNumber(tones.impulse, 0, 1);
  const wakeTone = clampNumber(tones.wake, 0, 1);
  const releaseTone = clampNumber(tones.release, 0, 1);
  const opacity = clampNumber(0.76 - (impulseTone * 0.055) + (wakeTone * 0.085) + (releaseTone * 0.035), 0.68, 0.86);
  const saturation = clampNumber(0.88 - (impulseTone * 0.16) + (wakeTone * 0.25) + (releaseTone * 0.08), 0.68, 1.18);
  const brightness = clampNumber(0.96 - (impulseTone * 0.035) + (wakeTone * 0.08) + (releaseTone * 0.04), 0.9, 1.1);
  const contrast = clampNumber(1 - (impulseTone * 0.04) + (releaseTone * 0.04), 0.94, 1.08);
  const nextOpacity = opacity.toFixed(3);
  const nextFilter = `saturate(${saturation.toFixed(3)}) brightness(${brightness.toFixed(3)}) contrast(${contrast.toFixed(3)})`;
  if (target.style.getPropertyValue('opacity') !== nextOpacity) {
    target.style.setProperty('opacity', nextOpacity);
  }
  if (target.style.getPropertyValue('filter') !== nextFilter) {
    target.style.setProperty('filter', nextFilter);
  }
}
