const STYLE_ID = 'visual-effect-disruption-style-clinical';

const CLINICAL_DISRUPTION_CSS = `
@keyframes ve-clinical-flash {
  0% { opacity: 0; }
  20% { opacity: 1; }
  100% { opacity: 0; }
}
@keyframes ve-clinical-ring {
  0% { transform: scale(0.9); opacity: 0; }
  25% { opacity: 0.75; }
  100% { transform: scale(1.12); opacity: 0; }
}
.visual-effect-overlay--clinical {
  --ve-clinical-a: 220, 234, 247;
  --ve-clinical-b: 148, 163, 184;
  position: fixed;
  inset: 0;
  z-index: 2147483647;
  pointer-events: none;
  overflow: hidden;
}
.visual-effect-overlay--clinical .visual-effect-clinical-flash {
  position: absolute;
  inset: 0;
  background: linear-gradient(to top, rgba(var(--ve-clinical-b), 0.44), rgba(var(--ve-clinical-a), 0.36) 44%, rgba(255, 255, 255, 0));
  animation: ve-clinical-flash 0.4s ease-out forwards;
}
.visual-effect-overlay--clinical .visual-effect-clinical-ring {
  position: absolute;
  left: 50%;
  bottom: 14%;
  width: min(76vw, 560px);
  aspect-ratio: 1 / 1;
  border: 2px solid rgba(var(--ve-clinical-b), 0.65);
  border-radius: 999px;
  transform: translate(-50%, 50%);
  animation: ve-clinical-ring 0.42s ease-out forwards;
}
`;

function ensureStyle() {
  if (document.getElementById(STYLE_ID)) return;
  const styleEl = document.createElement('style');
  styleEl.id = STYLE_ID;
  styleEl.textContent = CLINICAL_DISRUPTION_CSS;
  document.head.appendChild(styleEl);
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function getBody() {
  return document.body || document.documentElement;
}

export const clinicalPulseDisruptionRenderer = Object.freeze({
  id: 'clinical_pulse',
  play({ effectProfile, signal }) {
    if (signal?.aborted) return Promise.resolve();
    ensureStyle();

    const overlay = document.createElement('div');
    overlay.className = 'visual-effect-overlay--clinical';
    overlay.style.setProperty('--ve-clinical-a', effectProfile.layerAChannels);
    overlay.style.setProperty('--ve-clinical-b', effectProfile.layerBChannels);

    const flash = document.createElement('div');
    flash.className = 'visual-effect-clinical-flash';
    const ring = document.createElement('div');
    ring.className = 'visual-effect-clinical-ring';

    overlay.appendChild(flash);
    overlay.appendChild(ring);
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
      const duration = Math.max(10, Math.floor(effectProfile.durationFrames));
      const amplitude = clamp(effectProfile.shakeAmplitudePx * 0.16, 0.8, 2.4);

      const animate = () => {
        if (settled) return;
        if (frame >= duration) {
          finish();
          return;
        }

        const phase = frame / duration;
        const wave = Math.sin(phase * Math.PI * 2.2);
        const decay = 1 - phase;
        body.style.transform = `translate3d(0, ${(-wave * amplitude * decay).toFixed(2)}px, 0)`;
        root.style.filter = `brightness(${(1 + (decay * 0.08)).toFixed(3)}) saturate(${(1 + (decay * 0.04)).toFixed(3)})`;

        frame += 1;
        frameId = requestAnimationFrame(animate);
      };

      frameId = requestAnimationFrame(animate);
    });
  },
});
