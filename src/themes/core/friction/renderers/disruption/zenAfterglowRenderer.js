const STYLE_ID = 'visual-effect-disruption-style-zen';

const ZEN_DISRUPTION_CSS = `
@keyframes ve-zen-bloom {
  0% { opacity: 0; transform: scale(0.9); }
  24% { opacity: 0.95; transform: scale(1); }
  100% { opacity: 0; transform: scale(1.16); }
}
@keyframes ve-zen-ring {
  0% { opacity: 0; transform: scale(0.7); }
  35% { opacity: 0.8; }
  100% { opacity: 0; transform: scale(1.42); }
}
@keyframes ve-zen-mist {
  0% { opacity: 0; transform: translateY(10px); }
  25% { opacity: 0.48; }
  100% { opacity: 0; transform: translateY(-16px); }
}
.visual-effect-overlay--zen {
  --ve-zen-a: 143, 188, 143;
  --ve-zen-b: 176, 149, 106;
  --ve-zen-flash: rgba(253, 251, 247, 0.88);
  position: fixed;
  inset: 0;
  z-index: 2147483647;
  pointer-events: none;
  overflow: hidden;
}
.visual-effect-overlay--zen .visual-effect-zen-bloom {
  position: absolute;
  inset: 0;
  background:
    radial-gradient(circle at 50% 84%, rgba(var(--ve-zen-a), 0.28) 0%, rgba(var(--ve-zen-b), 0.18) 24%, transparent 66%),
    radial-gradient(circle at 50% 88%, var(--ve-zen-flash) 0%, transparent 56%);
  mix-blend-mode: screen;
  animation: ve-zen-bloom 0.42s ease-out forwards;
}
.visual-effect-overlay--zen .visual-effect-zen-ring {
  position: absolute;
  left: 50%;
  bottom: 12%;
  width: min(72vw, 520px);
  aspect-ratio: 1 / 1;
  border: 2px solid rgba(var(--ve-zen-b), 0.42);
  border-radius: 999px;
  transform: translate(-50%, 50%);
  animation: ve-zen-ring 0.46s cubic-bezier(0.22, 1, 0.36, 1) forwards;
}
.visual-effect-overlay--zen .visual-effect-zen-ring.is-secondary {
  width: min(58vw, 420px);
  border-color: rgba(var(--ve-zen-a), 0.34);
  animation-delay: 0.06s;
}
.visual-effect-overlay--zen .visual-effect-zen-mist {
  position: absolute;
  inset: auto 0 0 0;
  height: min(34vh, 260px);
  background:
    linear-gradient(to top, rgba(244, 241, 225, 0.22), rgba(244, 241, 225, 0)),
    radial-gradient(circle at 50% 95%, rgba(var(--ve-zen-a), 0.18), transparent 70%);
  animation: ve-zen-mist 0.44s ease-out forwards;
}
`;

function ensureStyle() {
  if (document.getElementById(STYLE_ID)) return;
  const styleEl = document.createElement('style');
  styleEl.id = STYLE_ID;
  styleEl.textContent = ZEN_DISRUPTION_CSS;
  document.head.appendChild(styleEl);
}

function getBody() {
  return document.body || document.documentElement;
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

export const zenAfterglowDisruptionRenderer = Object.freeze({
  id: 'zen_afterglow',
  play({ effectProfile, signal }) {
    if (signal?.aborted) return Promise.resolve();
    ensureStyle();

    const overlay = document.createElement('div');
    overlay.className = 'visual-effect-overlay--zen';
    overlay.style.setProperty('--ve-zen-a', effectProfile.layerAChannels);
    overlay.style.setProperty('--ve-zen-b', effectProfile.layerBChannels);
    overlay.style.setProperty('--ve-zen-flash', effectProfile.flashColor);

    const bloom = document.createElement('div');
    bloom.className = 'visual-effect-zen-bloom';

    const ringPrimary = document.createElement('div');
    ringPrimary.className = 'visual-effect-zen-ring';

    const ringSecondary = document.createElement('div');
    ringSecondary.className = 'visual-effect-zen-ring is-secondary';

    const mist = document.createElement('div');
    mist.className = 'visual-effect-zen-mist';

    overlay.appendChild(bloom);
    overlay.appendChild(ringPrimary);
    overlay.appendChild(ringSecondary);
    overlay.appendChild(mist);
    (document.body || document.documentElement).appendChild(overlay);

    const root = document.documentElement;
    const body = getBody();
    const originalFilter = root.style.filter;
    const originalTransform = body.style.transform;

    return new Promise((resolve) => {
      let frame = 0;
      let frameId = null;
      let settled = false;
      const finish = () => {
        if (settled) return;
        settled = true;
        if (frameId !== null) cancelAnimationFrame(frameId);
        signal?.removeEventListener('abort', finish);
        overlay.remove();
        root.style.filter = originalFilter;
        body.style.transform = originalTransform;
        resolve();
      };
      signal?.addEventListener('abort', finish, { once: true });
      const duration = Math.max(12, Math.floor(effectProfile.durationFrames * 1.18));
      const amplitude = clamp(effectProfile.shakeAmplitudePx * 0.11, 0.4, 1.6);

      const animate = () => {
        if (settled) return;
        if (frame >= duration) {
          finish();
          return;
        }

        const phase = frame / duration;
        const decay = 1 - phase;
        const driftX = Math.sin(phase * Math.PI * 1.8) * amplitude * decay;
        const driftY = Math.cos(phase * Math.PI * 1.1) * amplitude * 0.6 * decay;
        body.style.transform = `translate3d(${driftX.toFixed(2)}px, ${(-driftY).toFixed(2)}px, 0)`;
        root.style.filter = `brightness(${(1 + (decay * 0.06)).toFixed(3)}) saturate(${(1 + (decay * 0.05)).toFixed(3)})`;

        frame += 1;
        frameId = requestAnimationFrame(animate);
      };

      frameId = requestAnimationFrame(animate);
    });
  },
});
