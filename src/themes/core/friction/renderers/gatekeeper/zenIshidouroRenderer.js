const STATE_BY_ELEMENT = new WeakMap();

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function normalizeNumber(value, fallback = 0) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : fallback;
}

function getState(element) {
  let state = STATE_BY_ELEMENT.get(element);
  if (state) return state;

  state = {
    glow: 0.18,
    hold: 0,
    sway: 0,
  };
  STATE_BY_ELEMENT.set(element, state);
  return state;
}

function applyVisualState(element, state) {
  const glow = clamp(state.glow, 0.08, 1.35);
  const hold = clamp(state.hold, 0, 1);
  const sway = clamp(state.sway, -6, 6);
  const coreScale = 1 + (glow * 0.08) + (hold * 0.16);
  const mistOpacity = clamp(0.18 + (glow * 0.16) + (hold * 0.18), 0.18, 0.7);

  element.style.setProperty('--friction-zen-lantern-glow', glow.toFixed(3));
  element.style.setProperty('--friction-zen-lantern-hold', hold.toFixed(3));
  element.style.setProperty('--friction-zen-lantern-sway', `${sway.toFixed(2)}deg`);
  element.style.setProperty('--friction-zen-lantern-core-scale', coreScale.toFixed(3));
  element.style.setProperty('--friction-zen-lantern-mist-opacity', mistOpacity.toFixed(3));
}

export const zenIshidouroGatekeeperRenderer = Object.freeze({
  id: 'zen_ishidouro',
  getOrnamentMarkup() {
    return '';
  },
  getFullLayoutMarkup({ copy = {} } = {}) {
    return `
      <div class="friction-zen-layout">
        <div class="friction-zen-layout__content">
          <div class="friction-zen-layout__text">
            <div class="friction-gatekeeper-text">${copy.titleText || ''}</div>
            <div class="friction-gatekeeper-subtitle">${copy.subtitleText || ''}</div>
            <div class="friction-gatekeeper-reason" ${copy.reasonText ? '' : 'style="display:none"'}>${copy.reasonText || ''}</div>
          </div>

          <div class="friction-zen-ishidouro" aria-hidden="true">
            <div class="friction-zen-ishidouro__halo"></div>
            <div class="friction-zen-ishidouro__mist"></div>
            <div class="friction-zen-ishidouro__body">
              <div class="friction-zen-ishidouro__finial"></div>
              <div class="friction-zen-ishidouro__roof-cap"></div>
              <div class="friction-zen-ishidouro__roof"></div>
              <div class="friction-zen-ishidouro__house">
                <div class="friction-zen-ishidouro__core"></div>
                <span class="friction-zen-ishidouro__grille friction-zen-ishidouro__grille--v is-left"></span>
                <span class="friction-zen-ishidouro__grille friction-zen-ishidouro__grille--v is-right"></span>
                <span class="friction-zen-ishidouro__grille friction-zen-ishidouro__grille--h is-top"></span>
                <span class="friction-zen-ishidouro__grille friction-zen-ishidouro__grille--h is-bottom"></span>
              </div>
              <div class="friction-zen-ishidouro__plinth"></div>
              <div class="friction-zen-ishidouro__pillar"></div>
              <div class="friction-zen-ishidouro__base friction-zen-ishidouro__base--top"></div>
              <div class="friction-zen-ishidouro__base friction-zen-ishidouro__base--mid"></div>
              <div class="friction-zen-ishidouro__base friction-zen-ishidouro__base--shadow"></div>
            </div>
            <div class="friction-zen-ishidouro__motes">
              <span class="friction-zen-ishidouro__mote" style="--x: 18%; --delay: 0.08s; --size: 5px"></span>
              <span class="friction-zen-ishidouro__mote" style="--x: 38%; --delay: 0.36s; --size: 4px"></span>
              <span class="friction-zen-ishidouro__mote" style="--x: 62%; --delay: 0.18s; --size: 6px"></span>
              <span class="friction-zen-ishidouro__mote" style="--x: 82%; --delay: 0.54s; --size: 4px"></span>
            </div>
          </div>

          <div class="friction-zen-layout__action">
            <button class="friction-gatekeeper-btn" aria-label="${copy.ctaText || ''}">
              <div class="friction-gatekeeper-progress"></div>
              <span class="friction-gatekeeper-title" style="position:relative; z-index:1;">${copy.ctaText || ''}</span>
            </button>
          </div>
        </div>
      </div>
    `;
  },
  onMount(element) {
    const state = getState(element);
    state.glow = 0.18;
    state.hold = 0;
    state.sway = 0;
    applyVisualState(element, state);
  },
  onUnmount(element) {
    STATE_BY_ELEMENT.delete(element);
  },
  onScrollGlow(element, { scrollGlow } = {}) {
    const state = getState(element);
    const glow = clamp(normalizeNumber(scrollGlow, 0), 0, 1.4);

    state.glow = Math.max(0.16 + (glow * 0.62), state.glow * 0.88);
    state.sway *= 0.8;
    applyVisualState(element, state);
  },
  onTug(element, { deltaY } = {}) {
    const state = getState(element);
    const rawDelta = clamp(normalizeNumber(deltaY, 0), 0, 520);
    if (rawDelta <= 0) return;

    state.glow = clamp(state.glow + clamp(rawDelta / 760, 0.08, 0.28), 0.14, 1.35);
    state.sway = clamp((state.sway * 0.35) + clamp(rawDelta / 90, 0.8, 5.2), -6, 6);

    applyVisualState(element, state);
  },
  onHoldProgress(element, { progress, isPressing } = {}) {
    const state = getState(element);
    state.hold = clamp(normalizeNumber(progress, 0) / 100, 0, 1);

    if (isPressing) {
      state.glow = Math.max(state.glow, 0.28 + (state.hold * 0.9));
      state.sway *= 0.68;
    }

    applyVisualState(element, state);
  },
  getUnlockOverlayClass() {
    return 'pattern-zen-ishidouro';
  },
  getUnlockDurationMs() {
    return 460;
  },
});
