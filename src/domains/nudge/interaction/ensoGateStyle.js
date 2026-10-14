import { CLICK_ENSO_GATE_STYLE_ID } from './interactionConstants.js';
import { getDocumentRef } from './interactionDom.js';

export function ensureEnsoGateStyle() {
  const doc = getDocumentRef();
  if (!doc?.head) throw new Error('BARRIER_BOUNDARY_STYLE_DOCUMENT_UNAVAILABLE');
  let style = doc.getElementById(CLICK_ENSO_GATE_STYLE_ID);
  if (!style) { style = doc.createElement('style'); style.id = CLICK_ENSO_GATE_STYLE_ID; doc.head.appendChild(style); }
  style.textContent = `
    .friction-click-enso-gate { --boundary-shift: 0; --boundary-travel: 112px; position: fixed; inset: 0; z-index: 2147483647; display: grid; place-content: center; justify-items: center; gap: 48px; overflow: hidden; color: var(--boundary-text); background: color-mix(in srgb, var(--boundary-background) 97%, transparent); isolation: isolate; touch-action: none; user-select: none; outline: none; cursor: ew-resize; font-family: var(--font-theme-ui, system-ui, sans-serif); }
    .friction-click-enso-gate::before { content: ''; position: absolute; z-index: -1; inset: -20%; background: radial-gradient(ellipse at 50% 50%, color-mix(in srgb, var(--boundary-accent) 8%, transparent), transparent 65%); transform: translateX(calc(var(--boundary-shift) * 4%)); pointer-events: none; }
    .friction-click-enso-gate[data-theme='zen'] { background: #101210f7; }
    .consumption-boundary__title { position: absolute; top: calc(50% - 138px); margin: 0; font-size: 13px; font-weight: 400; letter-spacing: .18em; opacity: .8; }
    .consumption-boundary__track { position: absolute; left: 50%; top: 50%; transform: translate(-50%, -50%); width: min(440px, 88vw); height: 104px; display: flex; align-items: center; justify-content: space-between; }
    .consumption-boundary__track::before { content: ''; position: absolute; left: 14%; right: 14%; top: 50%; height: 1px; background: linear-gradient(90deg, transparent, color-mix(in srgb, var(--boundary-text) 26%, transparent), transparent); }
    .consumption-boundary__handle { position: absolute; left: calc(50% - 24px); top: 26px; width: 48px; height: 52px; border: 1px solid color-mix(in srgb, var(--boundary-text) 35%, transparent); background: var(--boundary-background); box-shadow: 0 8px 32px #0005; transform: translateX(calc(var(--boundary-shift) * var(--boundary-travel))); }
    .consumption-boundary__handle::before { content: ''; position: absolute; left: 23px; top: 12px; height: 26px; width: 1px; background: var(--boundary-text); opacity: .8; }
    [data-theme='zen'] .consumption-boundary__handle { border-radius: 43% 48% 38% 46%; background: radial-gradient(ellipse at 35% 25%, #383b34, #161a16 70%); border-color: #707766; }
    .consumption-boundary__label { position: relative; font-size: 12px; opacity: .7; transition: opacity 160ms; }
    [data-direction='leave'] .consumption-boundary__label--leave, [data-direction='enter'] .consumption-boundary__label--enter { opacity: 1; }
    [data-ready='true'] .consumption-boundary__handle { border-color: var(--boundary-accent); box-shadow: 0 0 28px color-mix(in srgb, var(--boundary-accent) 14%, transparent); }
    .consumption-boundary__instruction { position: absolute; top: calc(50% + 108px); margin: 0; max-width: 80vw; text-align: center; font-size: 12px; line-height: 1.8; opacity: .72; }
    .consumption-boundary__status { position: absolute; top: calc(50% + 76px); min-height: 20px; font-size: 12px; opacity: .82; }
    [data-entry='summoning'] .consumption-boundary__track { opacity: .35; }
    .friction-click-enso-gate[data-resolving='true'] { pointer-events: none; animation: consumption-boundary-release var(--friction-click-enso-outcome-ms) ease-out both; }
    @keyframes consumption-boundary-release { to { opacity: 0; } }
    @media (prefers-reduced-motion: reduce) { .consumption-boundary__label { transition: none; } .friction-click-enso-gate[data-resolving='true'] { animation: none; } }
  `;
}
