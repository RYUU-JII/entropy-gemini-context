import { tRuntime } from '../../settings/i18n/runtime.js';
import { requireSiteFurinReflection } from './siteFurinReflectionModel.js';

const COPY_KEYS = Object.freeze({
  title: 'tools:sentinel_flare_protocol.site_furin_reflection_title',
  summary: 'tools:sentinel_flare_protocol.site_furin_reflection_summary',
  unavailable: 'tools:sentinel_flare_protocol.site_furin_reflection_unavailable',
  wind_label: 'tools:sentinel_flare_protocol.site_furin_wind_label',
  wind_hint: 'tools:sentinel_flare_protocol.site_furin_wind_hint',
  wind_keyboard: 'tools:sentinel_flare_protocol.site_furin_wind_keyboard',
  wind_release: 'tools:sentinel_flare_protocol.site_furin_wind_release',
  leaving: 'tools:sentinel_flare_protocol.site_furin_reflection_leaving',
  continue: 'tools:sentinel_flare_protocol.site_furin_reflection_continue',
});
const MEANINGS = Object.freeze({
  clear_wind: () => tRuntime('tools:sentinel_flare_protocol.site_furin_meaning_clear_wind'),
  still_water: () => tRuntime('tools:sentinel_flare_protocol.site_furin_meaning_still_water'),
  one_encounter: () => tRuntime('tools:sentinel_flare_protocol.site_furin_meaning_one_encounter'),
  harmony: () => tRuntime('tools:sentinel_flare_protocol.site_furin_meaning_harmony'),
  one_act: () => tRuntime('tools:sentinel_flare_protocol.site_furin_meaning_one_act'),
  flowing_clouds: () => tRuntime('tools:sentinel_flare_protocol.site_furin_meaning_flowing_clouds'),
});
function copy(key, values) {
  if (!Object.hasOwn(COPY_KEYS, key)) throw new Error('SITE_FURIN_COPY_KEY_INVALID');
  return tRuntime(COPY_KEYS[key], values);
}
const clamp = value => Math.max(0, Math.min(1, value));

// Input is explicit; all exit progression comes from the host's visible clock.
export function createSiteFurinReflectionView({ root, stage, data, onAction, onLeave, onWind }) {
  const reflection = data === null ? null : requireSiteFurinReflection(data);
  const doc = root.ownerDocument;
  const composition = stage.closest('.furin-composition');
  const frame = stage.closest('.furin-stage-frame');
  if (!composition || !frame) throw new Error('SITE_FURIN_COMPOSITION_REQUIRED');
  const element = (tag, className, text) => {
    const node = doc.createElement(tag);
    node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  };
  const wind = element('button', 'furin-wind');
  wind.id = 'nudgeFurinWind';
  wind.type = 'button';
  wind.disabled = true;
  wind.setAttribute('aria-label', copy('wind_label'));
  wind.setAttribute('aria-describedby', 'nudgeFurinWindHint');
  frame.append(wind);

  const panel = element('section', 'furin-reflection');
  panel.id = 'nudgeFurinReflection';
  const title = element('h1', 'furin-sr-only', copy('title'));
  title.id = 'nudgeFurinReflectionTitle';
  panel.setAttribute('aria-labelledby', title.id);
  const summary = element('p', 'furin-summary', reflection ? copy('summary', {
    used: Math.floor(reflection.activeMs / 60000), goal: Math.round(reflection.targetMs / 60000),
  }) : copy('unavailable'));
  if (reflection) summary.prepend(element('span', 'furin-sr-only', `${reflection.hostname} · `));
  const caption = element('div', 'furin-caption');
  const hint = element('p', 'furin-wind-hint', copy('wind_hint'));
  hint.id = 'nudgeFurinWindHint';
  const keyboard = element('p', 'furin-wind-keyboard', copy('wind_keyboard'));
  const meaning = element('p', 'furin-meaning');
  meaning.setAttribute('role', 'status');
  meaning.setAttribute('aria-live', 'polite');
  const actions = element('div', 'furin-reflection-actions');
  const proceed = element('button', 'furin-continue', copy('continue'));
  proceed.id = 'nudgeFurinContinue';
  proceed.type = 'button';
  proceed.disabled = true;
  const status = element('p', 'furin-reflection-status');
  status.setAttribute('role', 'status');
  caption.append(hint, keyboard, meaning);
  actions.append(proceed);
  panel.append(title, caption, summary, actions, status);
  composition.append(panel);

  let activePointer = null, startX = 0, lastX = 0, displacement = 0, width = 0;
  let armed = false, disposed = false, ready = false, closing = null;
  const listeners = [];
  const listen = (target, type, fn) => {
    target.addEventListener(type, fn);
    listeners.push(() => target.removeEventListener(type, fn));
  };
  function cancel() {
    const pointer = activePointer;
    activePointer = null;
    armed = false;
    displacement = 0;
    delete frame.dataset.wind;
    hint.textContent = copy('wind_hint');
    if (pointer !== null && wind.hasPointerCapture?.(pointer)) wind.releasePointerCapture(pointer);
    if (!disposed) onWind(0);
  }
  function leave(direction) {
    if (!ready || disposed || closing) return;
    cancel();
    onLeave(direction);
  }
  listen(wind, 'pointerdown', event => {
    if (!ready || event.button !== 0 || event.isPrimary === false || activePointer !== null) return;
    event.preventDefault();
    width = wind.getBoundingClientRect().width;
    if (!Number.isFinite(width) || width <= 0) throw new Error('SITE_FURIN_WIND_BOUNDS_INVALID');
    activePointer = event.pointerId;
    startX = lastX = event.clientX;
    displacement = 0;
    wind.focus({ preventScroll: true });
    wind.setPointerCapture(event.pointerId);
    frame.dataset.wind = 'drawing';
  });
  listen(wind, 'pointermove', event => {
    if (event.pointerId !== activePointer || !ready) return;
    event.preventDefault();
    displacement = event.clientX - startX;
    const delta = event.clientX - lastX;
    lastX = event.clientX;
    armed = Math.abs(displacement) >= Math.max(18, Math.min(40, width * 0.12));
    frame.dataset.wind = armed ? 'ready' : 'drawing';
    hint.textContent = copy(armed ? 'wind_release' : 'wind_hint');
    onWind(Math.max(-1, Math.min(1, delta / (width * 0.08))));
  });
  listen(wind, 'pointerup', event => {
    if (event.pointerId !== activePointer) return;
    const commit = armed;
    const direction = displacement < 0 ? -1 : 1;
    cancel();
    if (commit) leave(direction);
  });
  listen(wind, 'pointercancel', event => { if (event.pointerId === activePointer) cancel(); });
  listen(wind, 'lostpointercapture', event => { if (event.pointerId === activePointer) cancel(); });
  listen(wind, 'blur', cancel);
  listen(wind, 'keydown', event => {
    if (event.key === 'Escape') { event.preventDefault(); cancel(); }
  });
  // Native keyboard and assistive clicks have detail=0. Pointer clicks must sweep.
  listen(wind, 'click', event => { if (event.detail === 0) leave(1); });
  listen(proceed, 'click', () => {
    if (!ready || disposed || closing) return;
    cancel();
    onAction('continue');
  });

  return {
    cancel,
    showCloseFailure() {
      delete panel.dataset.choice;
      panel.style.opacity = frame.style.opacity = '1';
      hint.style.opacity = keyboard.style.opacity = '1';
      summary.style.opacity = actions.style.opacity = '1';
      summary.removeAttribute('aria-hidden');
      actions.removeAttribute('aria-hidden');
      meaning.textContent = '';
      meaning.style.opacity = '0';
      status.textContent = tRuntime('tools:sentinel_flare_protocol.site_furin_close_failed');
      status.setAttribute('role', 'alert');
    },
    update(progress, { presented, pending = false, visual = null } = {}) {
      if (disposed) return;
      ready = presented && !pending && closing === null;
      wind.disabled = proceed.disabled = !ready;
      panel.dataset.phase = progress.phase;
      panel.setAttribute('aria-busy', String(pending && progress.exitChoice === null));
      if (progress.exitChoice !== null) {
        const fade = progress.exitChoice === 'leave'
          ? clamp((1 - progress.exitProgress) / 0.14) : 1 - progress.exitProgress;
        panel.style.opacity = frame.style.opacity = String(fade);
        if (progress.exitChoice === 'leave') {
          hint.style.opacity = keyboard.style.opacity = String(clamp(1 - progress.exitElapsedMs / 180));
          summary.style.opacity = actions.style.opacity = String(clamp(1 - progress.exitElapsedMs / 240));
        }
        if (progress.exitChoice === 'leave' && visual !== null && visual.inkProgress >= 0.35) {
          if (!Object.hasOwn(MEANINGS, visual.inscriptionId)) throw new Error('SITE_FURIN_INSCRIPTION_INVALID');
          if (!meaning.textContent) meaning.textContent = MEANINGS[visual.inscriptionId]();
          meaning.style.opacity = String(clamp((visual.inkProgress - 0.35) / 0.35));
        }
        if (progress.exitComplete && closing !== null) {
          const { resolve } = closing;
          closing = null;
          resolve();
        }
      }
    },
    close({ choice }) {
      if (!['leave', 'stay'].includes(choice)) throw new Error('SITE_FURIN_CHOICE_INVALID');
      if (closing !== null || disposed) throw new Error('SITE_FURIN_CLOSE_STATE_INVALID');
      cancel();
      ready = false;
      wind.disabled = proceed.disabled = true;
      panel.dataset.choice = choice;
      status.textContent = choice === 'leave' ? copy('leaving') : '';
      status.setAttribute('role', 'status');
      if (choice === 'leave') {
        summary.setAttribute('aria-hidden', 'true');
        actions.setAttribute('aria-hidden', 'true');
      }
      return new Promise((resolve, reject) => { closing = { resolve, reject }; });
    },
    dispose() {
      cancel();
      disposed = true;
      if (closing !== null) {
        closing.reject(new DOMException('Furin presentation disposed', 'AbortError'));
        closing = null;
      }
      for (const remove of listeners) remove();
      wind.remove();
      panel.remove();
    },
    snapshot: () => ({ available: reflection !== null, ready, windActive: activePointer !== null, windArmed: armed }),
  };
}
