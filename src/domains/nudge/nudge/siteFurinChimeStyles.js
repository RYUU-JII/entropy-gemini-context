export const SITE_FURIN_CHIME_STYLES = `
:host([data-site-furin-chime]) { pointer-events:auto !important; color-scheme:dark;
  --furin-ink:#efede7; --furin-muted:#b0aaa0; }
:host([data-site-furin-chime]) #nudgeScene { background:transparent !important; pointer-events:auto;
  display:flex; align-items:center; justify-content:center; }
:host([data-site-furin-chime]) #nudgeScene::before,
:host([data-site-furin-chime]) #nudgeScene::after,
:host([data-site-furin-chime]) #nudgeScrim,
:host([data-site-furin-chime]) #nudgeCanvas,
:host([data-site-furin-chime]) #nudgeRitualGuide,
:host([data-site-furin-chime]) #nudgeSiteFurinAction,
:host([data-site-furin-chime]) #nudgeModalBackdrop { display:none !important; }
.furin-distance { position:absolute; inset:0; pointer-events:none; background:#191918;
  animation:furin-distance-in 300ms ease-out both; }
.furin-composition { position:relative; width:min(460px,calc(100% - 48px)); padding:16px 0 24px;
  display:flex; flex-direction:column; align-items:center; }
.furin-stage-frame { position:relative; width:min(340px,42vh,76vw); aspect-ratio:300/360;
  flex:none; margin-bottom:clamp(-52px,-6vh,-24px); pointer-events:auto; }
.furin-stage { width:100%; height:100%; opacity:0; will-change:transform; pointer-events:none; }
.furin-wind { position:absolute; inset:0; width:100%; height:100%; border:0; padding:0;
  border-radius:24px; background:transparent; touch-action:none; user-select:none; cursor:grab; }
.furin-wind:active { cursor:grabbing; }
.furin-wind:disabled { cursor:default; }
.furin-wind:focus-visible { outline:1px solid #c8c0ae; outline-offset:6px; }
.furin-reflection { width:100%; text-align:center; color:var(--furin-ink);
  font:400 14px/1.6 var(--font-theme-ui,system-ui,sans-serif); pointer-events:auto; }
.furin-sr-only, .furin-reflection-status:not([role=alert]) { position:absolute; width:1px; height:1px;
  padding:0; margin:-1px; overflow:hidden; clip-path:inset(50%); white-space:nowrap; border:0; }
.furin-caption { display:grid; justify-items:center; align-items:start; min-height:44px; margin:12px 0 0; }
.furin-caption > p { grid-area:1/1; margin:0; max-width:340px; }
.furin-summary { color:var(--furin-muted); font-size:11px; line-height:1.7;
  font-variant-numeric:tabular-nums; overflow-wrap:anywhere; margin:8px 0 0; }
.furin-wind-hint { font-size:12px; color:#c8c0b3; line-height:1.8; word-break:keep-all; }
.furin-wind-keyboard { display:none; color:#c8c0b3; font-size:12px; line-height:1.8; }
.furin-composition:has(.furin-wind:focus-visible) .furin-wind-hint { visibility:hidden; }
.furin-composition:has(.furin-wind:focus-visible) .furin-wind-keyboard { display:block; }
.furin-meaning { font:400 17px/1.6 var(--font-theme-serif,serif); letter-spacing:.08em;
  color:#e7dfce; opacity:0; pointer-events:none; }
.furin-reflection-actions { margin:10px auto 0; }
.furin-continue { min-width:88px; min-height:44px; padding:8px 12px; border:0; border-radius:2px;
  color:var(--furin-muted); background:transparent; font:400 13px/1.5 var(--font-theme-ui,system-ui,sans-serif);
  text-decoration:underline; text-underline-offset:5px; text-decoration-color:#777065; cursor:pointer; }
.furin-continue:hover:not(:disabled) { color:var(--furin-ink); }
.furin-continue:focus-visible { outline:1px solid #ddd7ca; outline-offset:3px; }
.furin-continue:disabled { opacity:.5; cursor:default; }
.furin-reflection-status[role=alert] { color:#efb9ad; font-size:12px; line-height:1.7; margin:8px 0 0; }
@keyframes furin-distance-in { from { opacity:0; } to { opacity:1; } }
@media(max-height:620px) { .furin-stage-frame {width:min(240px,32vh,70vw);} .furin-composition {padding:8px 0;}
  .furin-caption {margin-top:8px;} .furin-summary {margin-top:4px;} .furin-reflection-actions {margin-top:6px;} }
@media(prefers-reduced-motion:reduce) { .furin-distance {animation:none;} .furin-stage {will-change:auto;} }
`;
