const STYLE_ID = 'visual-effect-disruption-style-signal';

const SIGNAL_DISRUPTION_CSS = `
@keyframes ve-disruption-flash {
  0% { opacity: 1; background: var(--ve-flash-color); }
  100% { opacity: 0; background: var(--ve-flash-color); }
}
@keyframes ve-disruption-anim-1 {
  0% { clip-path: inset(20% 0 80% 0); transform: translate(-5px, 1px); }
  20% { clip-path: inset(60% 0 10% 0); transform: translate(5px, -1px); }
  40% { clip-path: inset(40% 0 50% 0); transform: translate(-5px, 5px); }
  60% { clip-path: inset(80% 0 5% 0); transform: translate(5px, -5px); }
  80% { clip-path: inset(10% 0 70% 0); transform: translate(-5px, 1px); }
  100% { clip-path: inset(30% 0 50% 0); transform: translate(5px, -1px); }
}
@keyframes ve-disruption-anim-2 {
  0% { clip-path: inset(10% 0 60% 0); transform: translate(5px, -1px); }
  20% { clip-path: inset(80% 0 5% 0); transform: translate(-5px, 5px); }
  40% { clip-path: inset(30% 0 20% 0); transform: translate(5px, 1px); }
  60% { clip-path: inset(10% 0 80% 0); transform: translate(-5px, -5px); }
  80% { clip-path: inset(50% 0 30% 0); transform: translate(5px, 5px); }
  100% { clip-path: inset(20% 0 60% 0); transform: translate(-5px, 1px); }
}
.visual-effect-overlay--signal {
  --ve-flash-color: #fff;
  --ve-layer-a: 255, 0, 0;
  --ve-layer-b: 0, 255, 255;
  position: fixed;
  inset: 0;
  z-index: 2147483647;
  pointer-events: none;
  overflow: hidden;
}
.visual-effect-overlay--signal .visual-effect-flash {
  position: absolute;
  inset: 0;
  animation: ve-disruption-flash 0.35s ease-out forwards;
  mix-blend-mode: hard-light;
}
.visual-effect-overlay--signal .visual-effect-distortion-layer {
  position: absolute;
  inset: 0;
}
.visual-effect-overlay--signal .visual-effect-distortion-layer::before,
.visual-effect-overlay--signal .visual-effect-distortion-layer::after {
  content: "";
  position: absolute;
  inset: 0;
  background: transparent;
}
.visual-effect-overlay--signal .visual-effect-distortion-layer::before {
  animation: ve-disruption-anim-1 0.15s infinite linear alternate-reverse;
  left: -4px;
  background: rgba(var(--ve-layer-a), 0.18);
  mix-blend-mode: color-burn;
}
.visual-effect-overlay--signal .visual-effect-distortion-layer::after {
  animation: ve-disruption-anim-2 0.15s infinite linear alternate-reverse;
  left: 4px;
  background: rgba(var(--ve-layer-b), 0.18);
  mix-blend-mode: exclusion;
}
`;

function ensureStyle() {
  if (document.getElementById(STYLE_ID)) return;
  const styleEl = document.createElement('style');
  styleEl.id = STYLE_ID;
  styleEl.textContent = SIGNAL_DISRUPTION_CSS;
  document.head.appendChild(styleEl);
}

function getTargetBody() {
  return document.body || document.documentElement;
}

export const signalDisruptionRenderer = Object.freeze({
  id: 'signal_disruption',
  play({ effectProfile, signal }) {
    if (signal?.aborted) return Promise.resolve();
    ensureStyle();

    const overlay = document.createElement('div');
    overlay.className = 'visual-effect-overlay--signal';
    overlay.style.setProperty('--ve-flash-color', effectProfile.flashColor);
    overlay.style.setProperty('--ve-layer-a', effectProfile.layerAChannels);
    overlay.style.setProperty('--ve-layer-b', effectProfile.layerBChannels);

    const flash = document.createElement('div');
    flash.className = 'visual-effect-flash';

    const distortion = document.createElement('div');
    distortion.className = 'visual-effect-distortion-layer';

    overlay.appendChild(flash);
    overlay.appendChild(distortion);
    (document.body || document.documentElement).appendChild(overlay);

    const root = document.documentElement;
    const body = getTargetBody();
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
      const duration = Math.max(8, Math.floor(effectProfile.durationFrames));

      const animate = () => {
        if (settled) return;
        if (frame >= duration) {
          finish();
          return;
        }

        const intensity = 1 - (frame / duration);
        const dx = (Math.random() - 0.5) * effectProfile.shakeAmplitudePx * intensity;
        const dy = (Math.random() - 0.5) * effectProfile.shakeAmplitudePx * intensity;
        body.style.transform = `translate(${dx}px, ${dy}px)`;

        if (Math.random() < effectProfile.strobeChance) {
          const hue = Math.floor(Math.random() * effectProfile.hueRangeDeg);
          root.style.filter = `invert(${effectProfile.invertAmount}) hue-rotate(${hue}deg) saturate(${effectProfile.saturation})`;
        } else {
          root.style.filter = 'none';
        }

        frame += 1;
        frameId = requestAnimationFrame(animate);
      };

      frameId = requestAnimationFrame(animate);
    });
  },
});
