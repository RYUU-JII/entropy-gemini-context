export const NUDGE_GAME_TEMPLATE = `
            <style>
                :host { all: initial; }
                :host {
                    --nudge-accent: #ff3b30;
                    --nudge-glow: rgba(255, 59, 48, 0.35);
                    --nudge-text: #f8fafc;
                    --nudge-surface: rgba(10, 12, 18, 0.94);
                    --nudge-scrim: rgba(6, 8, 12, 0.3);
                    --nudge-modal-backdrop: rgba(6, 8, 12, 0.55);
                    --nudge-modal-backdrop-blur: 6px;
                    --nudge-modal-surface: var(--nudge-surface);
                    --nudge-modal-ink: var(--nudge-text);
                    --nudge-modal-muted: rgba(248, 250, 252, 0.72);
                    --nudge-modal-border: rgba(255, 255, 255, 0.08);
                    --nudge-modal-btn-bg: rgba(8, 12, 18, 0.75);
                    --nudge-modal-btn-border: rgba(255, 255, 255, 0.18);
                    --nudge-modal-btn-ink: var(--nudge-text);
                    --nudge-modal-btn-primary-bg: var(--nudge-accent);
                    --nudge-modal-btn-primary-border: transparent;
                    --nudge-modal-btn-primary-ink: #0b0f14;
                    --nudge-hud-surface: rgba(10, 12, 18, 0.46);
                    --nudge-hud-border: rgba(255, 255, 255, 0.12);
                    --nudge-hud-inner: rgba(255, 255, 255, 0.09);
                    --nudge-hud-ink: #f8fafc;
                    --nudge-hud-muted: rgba(248, 250, 252, 0.7);
                    --nudge-hud-meter-track: rgba(255, 255, 255, 0.16);
                    --nudge-hud-meter-fill: var(--nudge-accent);
                    --nudge-hud-meter-fill-alt: #22d3ee;
                    --nudge-hud-tag: rgba(255, 255, 255, 0.9);
                    --nudge-protocol-edge-opacity: 0;
                    --nudge-protocol-edge-width: 0px;
                    --nudge-protocol-noise-opacity: 0;
                    --nudge-protocol-vignette-opacity: 0;
                    --nudge-protocol-glitch-opacity: 0;
                    --nudge-protocol-red-signal-opacity: 0;
                    --nudge-protocol-collapse-opacity: 0;
                    --nudge-protocol-collapse-blur: 0px;
                    --nudge-page-blur: 2px;
                    --nudge-page-dim: 0.18;
                    --nudge-ritual-progress: 0;
                    --nudge-ritual-time-progress: 0;
                    --nudge-global-sentinel-simulation-progress: 0;
                    --nudge-global-sentinel-sync-level: 0;
                    --nudge-global-sentinel-sync-pressure: 0;
                    --nudge-global-sentinel-sync-pressure-relief: 0;
                    --nudge-global-sentinel-fracture: 0;
                    --nudge-global-sentinel-integrity: 1;
                    --nudge-global-starter-feedback-x: 50%;
                    --nudge-global-starter-feedback-y: 48%;
                    --nudge-rift-target-x: 50%;
                    --nudge-rift-target-y: 48%;
                    --nudge-rift-auto-ms: 16000ms;
                    --nudge-site-furin-return-progress: 0;
                    --nudge-site-furin-attunement-progress: 0;
                    --nudge-site-furin-guidance-progress: 0;
                    --nudge-site-furin-current-strength: 1;
                    --nudge-site-furin-school-coherence: 0;
                    --nudge-site-furin-return-point-dwell: 0;
                    --nudge-site-furin-descent-progress: 0;
                    --nudge-site-furin-quiet-hold-progress: 0;
                }
                .scene.is-global-entry-press canvas, .scene.is-global-entry-press iframe {
                    filter: brightness(0.58) saturate(0.45);
                    opacity: 0.68;
                    transition: filter 80ms ease-out, opacity 80ms ease-out;
                }
                .scene { position: fixed; inset: 0; pointer-events: none; }
                /* Site page-dim atmosphere is owned here (the parent shadow shell):
                   site_furin must read as the REAL page receding, so the veil
                   and vignette sit over the live page. Global sentinel is
                   different: its worker canvas owns the white LCD
                   simulation-break panel and foreground cracks. */
                .scene.is-site-protocol::before {
                    content: '';
                    position: fixed;
                    inset: 0;
                    pointer-events: none;
                    z-index: 1;
                    background:
                        radial-gradient(circle at 50% 50%, rgba(255, 255, 255, 0.08), transparent 28%),
                        radial-gradient(circle at 50% 50%, rgba(125, 142, 103, 0.14), transparent 52%);
                    opacity: calc(0.26 + var(--nudge-page-dim));
                    mix-blend-mode: soft-light;
                }
                /* zen site_furin — Return Current. This is the gentle "your
                   self-set time is up" ritual, not the escalated global sentinel.
                   The page recedes into a pearl-blue dream while the school gathers
                   into one wake. The chromatic veil rides continuous return progress.
                   Scrim sits below the koi canvas (page recession); the ::before
                   vignette sits above it (edge mist). Terminal phases stay untouched. */
                .scene.is-zen.is-site-protocol::before {
                    background:
                        radial-gradient(ellipse at 50% 46%, rgba(86, 102, 164, 0) 30%, rgba(48, 42, 102, 0.28) 64%, rgba(20, 16, 54, 0.76) 100%),
                        linear-gradient(135deg, rgba(89, 112, 170, 0.08), rgba(126, 79, 145, 0.14));
                    opacity: calc(0.16 + var(--nudge-site-furin-attunement-progress) * 0.14 + var(--nudge-site-furin-return-progress) * 0.46 - var(--nudge-site-furin-quiet-hold-progress) * 0.08);
                    mix-blend-mode: normal;
                    transition: opacity 1.2s cubic-bezier(0.4, 0, 0.2, 1);
                }
                .scene.is-zen.is-site-furin-prelude::before {
                    opacity: 0;
                    transition-duration: 1.8s;
                }
                /* global sentinel - simulation break. The worker canvas paints
                   the white LCD grid, repair seams, light leaks, and front-glass
                   cracks; this host layer adds only the sync-pressure edge falloff. */
                .scene.is-global-protocol::before {
                    content: '';
                    position: fixed;
                    inset: 0;
                    pointer-events: none;
                    z-index: 1;
                    background: radial-gradient(ellipse at 50% 44%, rgba(255, 255, 255, 0) 36%, rgba(226, 232, 240, 0.44) 100%);
                    opacity: calc(0.18 + var(--nudge-global-sentinel-sync-pressure) * 0.34 - var(--nudge-global-sentinel-fracture) * 0.12);
                    transition: opacity 1.2s cubic-bezier(0.4, 0, 0.2, 1);
                }
                .scene.is-global-protocol::after {
                    content: '';
                    position: fixed;
                    inset: 0;
                    pointer-events: none;
                    z-index: 3;
                    opacity: 0;
                    mix-blend-mode: screen;
                }
                @keyframes nudgeGlobalStarterFeedback {
                    0% { opacity: 0.78; filter: blur(0) contrast(1.2); }
                    48% { opacity: 0.46; filter: blur(1px) contrast(1.55); }
                    100% { opacity: 0; filter: blur(7px) contrast(0.8); }
                }
                .scene.is-global-protocol.is-global-sentinel-awaiting-start::before {
                    opacity: 0.055;
                    background: radial-gradient(ellipse at 50% 48%, rgba(255, 255, 255, 0.12), transparent 46%);
                    transition-duration: 0.38s;
                }
                .scene.is-global-protocol.is-global-starter-feedback::after {
                    background:
                        radial-gradient(ellipse at var(--nudge-global-starter-feedback-x) var(--nudge-global-starter-feedback-y), rgba(224, 255, 236, 0.58) 0 3%, rgba(125, 211, 252, 0.22) 7%, transparent 22%),
                        radial-gradient(ellipse at 50% 48%, rgba(255, 255, 255, 0.1), transparent 45%);
                    animation: nudgeGlobalStarterFeedback 0.76s cubic-bezier(0.16, 0.84, 0.18, 1) both;
                }
                .scene.is-global-protocol.is-global-sentinel-rupture-reveal::after {
                    opacity: 0;
                    animation: none;
                }
                .scene.is-global-protocol .canvas {
                    z-index: 2;
                }
                @keyframes nudgeGlobalNoiseShift {
                    0% { transform: translate3d(0, 0, 0); opacity: var(--nudge-protocol-noise-opacity); }
                    25% { transform: translate3d(-1.5%, 0.8%, 0); opacity: calc(var(--nudge-protocol-noise-opacity) * 0.72); }
                    50% { transform: translate3d(1.2%, -1%, 0); opacity: var(--nudge-protocol-noise-opacity); }
                    75% { transform: translate3d(-0.6%, 1.4%, 0); opacity: calc(var(--nudge-protocol-noise-opacity) * 0.86); }
                    100% { transform: translate3d(0, 0, 0); opacity: var(--nudge-protocol-noise-opacity); }
                }
                @keyframes nudgeGlobalSignalTear {
                    0%, 80%, 100% { clip-path: inset(0 0 0 0); filter: contrast(1) saturate(1); }
                    82% { clip-path: inset(12% 0 72% 0); filter: contrast(1.45) saturate(1.4); }
                    84% { clip-path: inset(58% 0 28% 0); filter: contrast(1.25) saturate(1.2); }
                    86% { clip-path: inset(34% 0 51% 0); filter: contrast(1.6) saturate(1.55); }
                    88% { clip-path: inset(0 0 0 0); filter: contrast(1.08) saturate(1.05); }
                }
                @keyframes nudgeEscapeCanvasCollapse {
                    0% { opacity: 1; transform: scale(1); filter: blur(0) contrast(1); }
                    32% { opacity: 0.96; transform: scale(1.012) skewX(-0.7deg); filter: blur(1px) contrast(1.35); }
                    52% { opacity: 0.72; transform: scale(0.986) skewX(1.2deg); filter: blur(2px) contrast(1.65) saturate(0.65); }
                    74% { opacity: 0.4; transform: scale(1.025) skewX(-1.6deg); filter: blur(5px) contrast(0.82) saturate(0.25); }
                    100% { opacity: 0; transform: scale(1.06); filter: blur(8px) contrast(0.55) saturate(0); }
                }
                @keyframes nudgeEscapeFieldCollapse {
                    0% { opacity: 1; filter: blur(0); }
                    55% { opacity: 0.88; filter: blur(1px) contrast(1.3); }
                    100% { opacity: 0.15; filter: blur(7px) contrast(0.55); }
                }
                @keyframes nudgeEscapeSignalBurst {
                    0% { opacity: var(--nudge-protocol-glitch-opacity); filter: contrast(1.1); }
                    32% { opacity: calc(var(--nudge-protocol-glitch-opacity) + 0.18); filter: contrast(1.8); }
                    64% { opacity: calc(var(--nudge-protocol-glitch-opacity) + 0.28); filter: contrast(2.2) saturate(1.6); }
                    100% { opacity: 0; filter: contrast(0.4) saturate(0); }
                }
                .scrim {
                    position: absolute;
                    inset: 0;
                    background: var(--nudge-scrim);
                    opacity: 0.45;
                    transition: opacity 0.3s ease;
                }
                .scene.is-scene-escape .scrim {
                    opacity: calc(0.72 + var(--nudge-page-dim) * 0.2);
                }
                .scene.is-scene-collapse .scrim {
                    opacity: calc(0.88 + var(--nudge-page-dim) * 0.1);
                }
                .scene.is-scene-banish .scrim {
                    opacity: calc(0.78 + var(--nudge-page-dim) * 0.2);
                }
                .scene.is-scene-resyncing .scrim {
                    opacity: 0.55;
                }
                .scene.is-scene-resync .scrim {
                    opacity: 0.35;
                }
                .scene.is-ritual-active .scrim {
                    opacity: calc(0.48 + var(--nudge-page-dim) * 0.2);
                }
                .scene.is-zen.is-site-protocol.is-ritual-active .scrim,
                .scene.is-zen.is-site-protocol.is-scene-reflection .scrim {
                    background:
                        radial-gradient(ellipse at 50% 40%, rgba(151, 183, 218, 0.13) 0%, rgba(74, 77, 139, 0.42) 58%, rgba(29, 22, 70, 0.76) 100%),
                        linear-gradient(148deg, rgba(39, 57, 108, 0.48), rgba(91, 57, 111, 0.38));
                    opacity: calc(0.24 + var(--nudge-ritual-progress) * 0.4 - var(--nudge-site-furin-quiet-hold-progress) * 0.06);
                    backdrop-filter: blur(calc(var(--nudge-page-blur) + 0.8px)) saturate(calc(0.9 - var(--nudge-site-furin-return-progress) * 0.18)) brightness(calc(0.9 - var(--nudge-site-furin-return-progress) * 0.1));
                    -webkit-backdrop-filter: blur(calc(var(--nudge-page-blur) + 0.8px)) saturate(calc(0.9 - var(--nudge-site-furin-return-progress) * 0.18)) brightness(calc(0.9 - var(--nudge-site-furin-return-progress) * 0.1));
                    transition: opacity 1.2s cubic-bezier(0.4, 0, 0.2, 1), background 1.2s ease, backdrop-filter 1.2s ease;
                }
                .scene.is-zen.is-site-protocol.is-site-furin-guiding .scrim {
                    opacity: calc(0.28 + var(--nudge-site-furin-return-progress) * 0.4 + var(--nudge-site-furin-guidance-progress) * 0.02);
                }
                .scene.is-zen.is-site-protocol.is-site-furin-quiet-hold .scrim {
                    opacity: calc(0.68 - var(--nudge-site-furin-quiet-hold-progress) * 0.08);
                    backdrop-filter: blur(calc(var(--nudge-page-blur) + 1.2px)) saturate(0.72) brightness(calc(0.82 + var(--nudge-site-furin-quiet-hold-progress) * 0.06));
                    -webkit-backdrop-filter: blur(calc(var(--nudge-page-blur) + 1.2px)) saturate(0.72) brightness(calc(0.82 + var(--nudge-site-furin-quiet-hold-progress) * 0.06));
                }
                .scene.is-zen.is-site-protocol.is-site-furin-prelude .scrim {
                    opacity: 0;
                    backdrop-filter: none;
                    -webkit-backdrop-filter: none;
                }
                /* global sentinel — LCD backlight veil; sync pressure washes
                   the page toward white while fracture lets the live page bleed back. */
                .scene.is-global-protocol .scrim {
                    background: rgb(255, 255, 255);
                    opacity: calc(0.24 + var(--nudge-global-sentinel-sync-pressure) * 0.32 - var(--nudge-global-sentinel-fracture) * 0.16);
                    backdrop-filter: blur(calc(var(--nudge-page-blur) + 1px)) saturate(calc(0.24 + var(--nudge-global-sentinel-fracture) * 0.42)) brightness(calc(1.04 + var(--nudge-global-sentinel-sync-pressure) * 0.08));
                    -webkit-backdrop-filter: blur(calc(var(--nudge-page-blur) + 1px)) saturate(calc(0.24 + var(--nudge-global-sentinel-fracture) * 0.42)) brightness(calc(1.04 + var(--nudge-global-sentinel-sync-pressure) * 0.08));
                    transition: opacity 1.2s cubic-bezier(0.4, 0, 0.2, 1), background 1.2s ease;
                }
                .scene.is-global-protocol.is-global-sentinel-awaiting-start .scrim {
                    background: rgba(255, 255, 255, 0.08);
                    opacity: 0.035;
                    backdrop-filter: blur(0.25px) saturate(0.98) brightness(1.01);
                    -webkit-backdrop-filter: blur(0.25px) saturate(0.98) brightness(1.01);
                    transition-duration: 0.38s;
                }
                .scene.is-global-protocol.is-ritual-active .scrim {
                    opacity: calc(0.32 + var(--nudge-global-sentinel-sync-pressure) * 0.36 - var(--nudge-global-sentinel-fracture) * 0.18);
                }
                .scene.is-global-protocol.is-global-sentinel-awaiting-start.is-ritual-active .scrim {
                    opacity: 0.04;
                }
                .scene.is-global-protocol.is-global-sentinel-rupture-reveal .scrim,
                .scene.is-global-protocol.is-global-sentinel-rupture-reveal.is-ritual-active .scrim {
                    /* Keep the live page optically intact outside the worker's
                       clipped rupture instead of opening a second host veil. */
                    opacity: 0;
                    backdrop-filter: none;
                    -webkit-backdrop-filter: none;
                    transition-duration: 0.12s;
                }
                .scene.is-global-protocol.is-scene-escape .scrim,
                .scene.is-global-protocol.is-scene-collapse .scrim {
                    background: rgb(255, 255, 255);
                    opacity: 0.86;
                }
                .scene.is-global-protocol.is-scene-resync .scrim {
                    background: rgb(255, 255, 255);
                    opacity: 0.6;
                }
                .scene.is-global-protocol.is-scene-rift .scrim {
                    opacity: 0;
                    backdrop-filter: none;
                    -webkit-backdrop-filter: none;
                }
                .global-lcd-row-fault {
                    display: none;
                    position: absolute;
                    inset: 0;
                    pointer-events: none;
                }
                .scene.is-global-protocol.is-global-lcd-row-fault .global-lcd-row-fault {
                    display: block;
                }
                .global-lcd-row-fault i {
                    position: absolute;
                    left: 0;
                    width: 100%;
                    top: var(--nudge-lcd-row-y, 35%);
                    height: 13px;
                    backdrop-filter: invert(var(--nudge-lcd-row-polarity, 0)) contrast(2.4) saturate(2.2);
                    border-top: 1px solid rgba(105, 243, 239, 0.55);
                    border-bottom: 1px solid rgba(246, 69, 122, 0.5);
                }
                .global-lcd-row-fault i:nth-child(2) {
                    top: calc(var(--nudge-lcd-row-y, 35%) + 19%);
                    left: 17%;
                    width: 67%;
                    height: 4px;
                }
                .global-lcd-row-fault i:nth-child(3) {
                    top: calc(var(--nudge-lcd-row-y, 35%) - 8%);
                    width: 38%;
                    height: 26px;
                }
                @media (prefers-reduced-motion: reduce) {
                    .scene.is-global-protocol.is-global-lcd-row-fault .global-lcd-row-fault { display: none; }
                }
                .canvas {
                    position: absolute;
                    inset: 0;
                    width: 100%;
                    height: 100%;
                    pointer-events: auto;
                    cursor: crosshair;
                    transform-origin: 50% 50%;
                    will-change: transform, opacity, filter;
                }
                .scene.is-site-furin-return-current .canvas {
                    touch-action: none;
                }
                .scene.is-site-furin-prelude .canvas,
                .scene.is-site-furin-guidance .canvas {
                    cursor: grab;
                }
                .scene.is-site-furin-attunement .canvas,
                .scene.is-site-furin-prelude .canvas:active,
                .scene.is-site-furin-guidance .canvas:active {
                    cursor: grabbing;
                }
                .scene.is-global-protocol.is-global-sentinel-awaiting-start .canvas {
                    cursor: pointer;
                }
                .global-sentinel-action,
                .site-furin-action {
                    position: fixed;
                    left: 50%;
                    bottom: max(22px, env(safe-area-inset-bottom));
                    z-index: 5;
                    max-width: min(34rem, calc(100vw - 32px));
                    padding: 10px 16px;
                    border: 1px solid rgba(51, 65, 85, 0.28);
                    border-radius: 999px;
                    background: rgba(248, 250, 252, 0.94);
                    box-shadow: 0 10px 30px rgba(15, 23, 42, 0.18);
                    color: #0f172a;
                    font: 600 13px/1.35 ui-sans-serif, system-ui, sans-serif;
                    letter-spacing: 0.01em;
                    opacity: 0;
                    pointer-events: none;
                    transform: translate(-50%, 8px);
                    transition: opacity 0.16s ease, transform 0.16s ease;
                }
                .site-furin-action {
                    border-color: rgba(180, 215, 202, 0.34);
                    background: rgba(8, 31, 29, 0.86);
                    color: rgba(232, 248, 241, 0.96);
                    font-family: var(--font-theme-ui, var(--font-sans, system-ui, sans-serif));
                }
                .global-sentinel-action:focus-visible,
                .site-furin-action:focus-visible {
                    opacity: 1;
                    outline: 3px solid rgba(14, 116, 144, 0.72);
                    outline-offset: 3px;
                    transform: translate(-50%, 0);
                }
                .scene.is-global-sentinel-awaiting-start .global-sentinel-action,
                .scene.is-global-sentinel-learning .global-sentinel-action {
                    opacity: 0.94;
                    transform: translate(-50%, 0);
                    background: rgba(246, 250, 252, 0.88);
                    border-color: rgba(95, 131, 146, 0.18);
                    box-shadow: 0 5px 22px rgba(13, 32, 44, 0.08);
                    font-family: var(--font-theme-ui, system-ui, sans-serif);
                    font-weight: 400;
                }
                .site-furin-action:focus-visible {
                    outline-color: rgba(170, 214, 197, 0.82);
                }
                .global-sentinel-status {
                    position: fixed;
                    width: 1px;
                    height: 1px;
                    padding: 0;
                    margin: -1px;
                    overflow: hidden;
                    clip: rect(0 0 0 0);
                    white-space: nowrap;
                    border: 0;
                }
                .scene.is-global-protocol.is-global-sentinel-scroll-locked .canvas {
                    touch-action: none;
                }
                .scene.is-scene-escape .canvas {
                    pointer-events: none;
                    cursor: default;
                    animation: nudgeEscapeCanvasCollapse 0.76s cubic-bezier(0.2, 0.82, 0.18, 1) both;
                }
                .scene.is-scene-collapse .canvas {
                    pointer-events: none;
                    cursor: default;
                    animation: nudgeEscapeCanvasCollapse 1.1s cubic-bezier(0.18, 0.82, 0.16, 1) both;
                }
                .scene.is-scene-banish .canvas,
                .scene.is-scene-resyncing .canvas {
                    pointer-events: none;
                    cursor: default;
                }
                .scene.is-scene-banish .canvas {
                    filter: contrast(1.12) saturate(0.42);
                    transition: filter 0.32s ease;
                }
                .scene.is-scene-resyncing .canvas {
                    opacity: 0.72;
                    filter: grayscale(0.72) contrast(0.72) blur(0.6px);
                    transition: opacity 0.42s ease, filter 0.42s ease;
                }
                .scene.is-scene-resync .canvas {
                    pointer-events: none;
                    cursor: default;
                    opacity: 0.42;
                    filter: grayscale(1) contrast(0.62) blur(1px);
                    transition: opacity 0.42s ease, filter 0.42s ease;
                }
                .scene.is-scene-rift .canvas {
                    pointer-events: none;
                    cursor: default;
                    opacity: 1;
                    filter: none;
                    transition: opacity 0.18s ease;
                }
                .scene.is-scene-escape::before {
                    animation: nudgeEscapeFieldCollapse 0.76s cubic-bezier(0.2, 0.82, 0.18, 1) both;
                }
                .scene.is-scene-collapse::before {
                    animation: nudgeEscapeFieldCollapse 1.1s cubic-bezier(0.18, 0.82, 0.16, 1) both;
                }
                .scene.is-global-protocol.is-scene-escape::after {
                    animation:
                        nudgeGlobalNoiseShift 0.08s steps(2, end) infinite,
                        nudgeGlobalSignalTear 0.34s steps(1, end) infinite,
                        nudgeEscapeSignalBurst 0.76s cubic-bezier(0.2, 0.82, 0.18, 1) both;
                }
                .scene.is-global-protocol.is-scene-collapse::after {
                    animation:
                        nudgeGlobalNoiseShift 0.07s steps(2, end) infinite,
                        nudgeGlobalSignalTear 0.28s steps(1, end) infinite,
                        nudgeEscapeSignalBurst 1.1s cubic-bezier(0.18, 0.82, 0.16, 1) both;
                }
                .scene.is-global-protocol.is-scene-rift::before {
                    opacity: 0;
                }
                .rift-invite {
                    position: absolute;
                    inset: 0;
                    z-index: 5;
                    pointer-events: none;
                    opacity: 0;
                    transition: opacity 0.2s ease;
                }
                .rift-invite[hidden] { display: none; }
                .scene.is-global-protocol.is-scene-rift .rift-invite {
                    opacity: 1;
                }
                .rift-invite__button {
                    position: absolute;
                    left: var(--nudge-rift-target-x, 50%);
                    top: var(--nudge-rift-target-y, 48%);
                    width: clamp(180px, 40vmin, 420px);
                    aspect-ratio: 1 / 1;
                    border: 0;
                    padding: 0;
                    background: transparent;
                    cursor: zoom-in;
                    pointer-events: auto;
                    touch-action: manipulation;
                    transform: translate(-50%, -50%);
                }
                .rift-invite__button::after {
                    content: '';
                    position: absolute;
                    inset: 0;
                    background: radial-gradient(ellipse, rgba(200, 222, 207, 0.12), rgba(184, 210, 198, 0.035) 58%, transparent 82%);
                    opacity: 0;
                    pointer-events: none;
                    transition: opacity 0.8s ease;
                }
                .rift-invite__button:focus-visible {
                    outline: 2px solid rgba(194, 222, 205, 0.92);
                    outline-offset: -2px;
                }
                .rift-invite__button:hover::after,
                .rift-invite__button:focus-visible::after {
                    opacity: 1;
                }
                .rift-invite__caption {
                    position: absolute;
                    left: clamp(min(12rem, 50%), var(--nudge-rift-caption-x, 50%), calc(100% - min(12rem, 50%)));
                    width: min(22rem, calc(100% - 32px));
                    margin: 0;
                    pointer-events: none;
                    color: rgba(33, 62, 57, 0.9);
                    font: 400 12px/1.5 var(--font-theme-ui, system-ui, sans-serif);
                    letter-spacing: 0.03em;
                    text-align: center;
                    text-wrap: balance;
                }
                .ritual-guide {
                    position: absolute;
                    top: clamp(24px, 6.5vh, 68px);
                    left: 50%;
                    right: auto;
                    bottom: auto;
                    display: flex;
                    width: min(720px, calc(100vw - 40px));
                    padding: 0;
                    border: 0;
                    border-radius: 0;
                    background: transparent;
                    color: var(--nudge-text);
                    font-family: var(--font-theme-ui, var(--font-sans, system-ui, sans-serif));
                    flex-direction: column;
                    align-items: center;
                    text-align: center;
                    text-wrap: balance;
                    pointer-events: none;
                    opacity: 0;
                    transform: translate(-50%, -10px) scale(0.985);
                    transition: opacity 0.32s ease, transform 0.42s cubic-bezier(0.22, 1, 0.36, 1);
                    z-index: 4;
                    isolation: isolate;
                    filter: drop-shadow(0 2px 12px rgba(7, 16, 18, 0.46));
                }
                .ritual-guide[hidden] {
                    display: none;
                }
                .ritual-guide::before {
                    content: '';
                    position: absolute;
                    z-index: -1;
                    inset: -30px -72px -34px;
                    background: radial-gradient(
                        ellipse at center,
                        rgba(9, 25, 26, 0.34) 0%,
                        rgba(9, 25, 26, 0.14) 42%,
                        transparent 74%
                    );
                    opacity: 0.9;
                }
                .scene.is-ritual-active.is-ritual-guide-visible .ritual-guide {
                    opacity: 1;
                    transform: translate(-50%, 0) scale(1);
                }
                .scene.is-global-protocol .ritual-guide {
                    border-color: rgba(17, 24, 39, 0.2);
                    background:
                        linear-gradient(180deg, rgba(255, 255, 255, 0.84), rgba(242, 242, 238, 0.72)),
                        repeating-linear-gradient(0deg, rgba(17, 24, 39, 0.045) 0 1px, transparent 1px 5px);
                    color: rgba(16, 20, 24, 0.92);
                    box-shadow:
                        0 16px 42px rgba(0, 0, 0, 0.18),
                        inset 0 0 0 1px rgba(255, 255, 255, 0.62);
                }
                .scene.is-scene-escape .ritual-guide,
                .scene.is-scene-banish .ritual-guide,
                .scene.is-scene-resyncing .ritual-guide,
                .scene.is-scene-collapse .ritual-guide,
                .scene.is-scene-resync .ritual-guide,
                .scene.is-scene-rift .ritual-guide,
                .scene.is-scene-escape .hud,
                .scene.is-scene-banish .hud,
                .scene.is-scene-resyncing .hud,
                .scene.is-scene-collapse .hud,
                .scene.is-scene-resync .hud,
                .scene.is-scene-rift .hud {
                    opacity: 0;
                    transform: translateY(10px);
                    transition-duration: 0.16s;
                }
                .scene.is-site-protocol.is-site-furin-return-complete .hud,
                .scene.is-site-protocol.is-scene-reflection .hud {
                    opacity: 0;
                    transform: translateY(10px);
                    transition-duration: 0.16s;
                }
                .ritual-title {
                    font-size: 10.5px;
                    font-weight: 700;
                    text-transform: uppercase;
                    letter-spacing: 0.18em;
                    line-height: 1.35;
                    color: rgba(205, 229, 219, 0.76);
                }
                .scene.is-global-protocol .ritual-title {
                    color: rgba(14, 18, 24, 0.74);
                    text-shadow: none;
                }
                .ritual-body {
                    margin-top: 7px;
                    max-width: 660px;
                    font-size: clamp(18px, 2.15vw, 24px);
                    font-weight: 650;
                    line-height: 1.35;
                    letter-spacing: -0.018em;
                    color: rgba(247, 252, 249, 0.96);
                    text-shadow: 0 2px 14px rgba(0, 0, 0, 0.58);
                }
                .ritual-hint {
                    margin-top: 8px;
                    max-width: 620px;
                    font-size: 12.5px;
                    font-weight: 450;
                    line-height: 1.62;
                    letter-spacing: 0.012em;
                    color: rgba(222, 238, 230, 0.76);
                    text-shadow: 0 1px 10px rgba(0, 0, 0, 0.54);
                }
                .ritual-signal {
                    position: relative;
                    width: 58px;
                    height: 24px;
                    margin-bottom: 7px;
                    opacity: 0.88;
                }
                .ritual-signal__core {
                    position: absolute;
                    left: 50%;
                    top: 50%;
                    width: 6px;
                    height: 6px;
                    border-radius: 50%;
                    background: rgba(222, 241, 230, 0.96);
                    box-shadow: 0 0 12px rgba(176, 218, 199, 0.76);
                    transform: translate(-50%, -50%);
                }
                .ritual-signal__wake {
                    position: absolute;
                    left: 50%;
                    top: 50%;
                    height: 12px;
                    border-top: 1px solid rgba(191, 224, 207, 0.74);
                    border-radius: 50%;
                    transform: translate(-50%, -26%);
                }
                .ritual-signal__wake--near {
                    width: 28px;
                }
                .ritual-signal__wake--far {
                    width: 50px;
                    opacity: 0.52;
                }
                @keyframes nudgeGuideSignalPulse {
                    0%, 100% { opacity: 0.48; transform: translate(-50%, -26%) scaleX(0.82); }
                    50% { opacity: 0.92; transform: translate(-50%, -26%) scaleX(1.08); }
                }
                @keyframes nudgeGuideSignalDrift {
                    0%, 100% { transform: translateX(-5px); }
                    50% { transform: translateX(5px); }
                }
                @keyframes nudgeGuideSignalSettle {
                    0%, 100% { opacity: 0.56; }
                    50% { opacity: 0.9; }
                }
                .scene.is-site-furin-prelude .ritual-signal__wake,
                .scene.is-site-furin-attunement .ritual-signal__wake {
                    animation: nudgeGuideSignalPulse 1.7s ease-in-out infinite;
                }
                .scene.is-site-furin-guidance .ritual-signal {
                    animation: nudgeGuideSignalDrift 2.8s ease-in-out infinite;
                }
                .scene.is-site-furin-return-point .ritual-signal {
                    animation: nudgeGuideSignalSettle 2.2s ease-in-out infinite;
                }
                .scene.is-site-furin-return-point .ritual-signal__core {
                    transform: translate(-50%, -50%) scale(calc(1 + var(--nudge-site-furin-return-point-dwell) * 0.42));
                    box-shadow:
                        0 0 12px rgba(176, 218, 199, 0.76),
                        0 0 calc(10px + 16px * var(--nudge-site-furin-return-point-dwell)) rgba(176, 218, 199, 0.38);
                }
                .scene.is-site-furin-descent .ritual-signal,
                .scene.is-site-furin-quiet-hold .ritual-signal {
                    animation: nudgeGuideSignalSettle 3.2s ease-in-out infinite;
                }
                .ritual-steps {
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    gap: 6px;
                    margin-top: 14px;
                    height: 3px;
                }
                .ritual-step {
                    width: 18px;
                    height: 2px;
                    border-radius: 999px;
                    background: rgba(197, 224, 211, 0.2);
                    transform: scaleX(0.72);
                    transition: width 0.35s ease, opacity 0.35s ease, transform 0.35s ease, background 0.35s ease;
                }
                .scene.is-site-furin-prelude .ritual-step--connect,
                .scene.is-site-furin-attunement .ritual-step--connect,
                .scene.is-site-furin-guidance .ritual-step--return,
                .scene.is-site-furin-descent .ritual-step--settle,
                .scene.is-site-furin-quiet-hold .ritual-step--settle {
                    width: 34px;
                    background: rgba(216, 238, 226, 0.88);
                    box-shadow: 0 0 10px rgba(168, 211, 191, 0.42);
                    transform: scaleX(1);
                }
                .scene.is-site-furin-guidance .ritual-step--connect,
                .scene.is-site-furin-descent .ritual-step--connect,
                .scene.is-site-furin-descent .ritual-step--return,
                .scene.is-site-furin-quiet-hold .ritual-step--connect,
                .scene.is-site-furin-quiet-hold .ritual-step--return {
                    background: rgba(197, 224, 211, 0.48);
                    transform: scaleX(1);
                }
                .scene.is-global-protocol .ritual-body {
                    color: rgba(14, 18, 24, 0.78);
                }
                .ritual-meter {
                    margin-top: 10px;
                    height: 4px;
                    width: 100%;
                    border-radius: 99px;
                    overflow: hidden;
                    background: rgba(255, 255, 255, 0.16);
                }
                /* Ritual progress is diegetic in normal presentation. When the
                   diagnostic HUD is enabled, state monitoring is owned by the
                   single top-left HUD panel instead of a second guide panel. */
                .scene.is-global-protocol .ritual-guide,
                .scene.is-global-protocol .ritual-meter,
                .scene.is-hud-visible .ritual-guide,
                .scene.is-hud-visible .ritual-meter {
                    display: none;
                }
                /* site furin progress is diegetic — the dusk deepening IS the
                   progress. A fillable bar invites finishing it fast, which is
                   the exact arousal the ritual exists to lower. */
                .scene.is-site-furin-return-current .ritual-meter {
                    display: none;
                }
                .scene.is-zen.is-site-protocol .ritual-title {
                    display: block;
                }
                .ritual-meter-fill {
                    width: calc(var(--nudge-ritual-progress) * 100%);
                    height: 100%;
                    border-radius: inherit;
                    background: var(--nudge-accent);
                    box-shadow: 0 0 14px var(--nudge-glow);
                    transition: width 0.22s ease-out;
                }
                .scene.is-global-protocol .ritual-meter {
                    background: rgba(17, 24, 39, 0.14);
                }
                .scene.is-global-protocol .ritual-meter-fill {
                    background: linear-gradient(90deg, #050607, #23272f, #dfe3df);
                    box-shadow: 0 0 18px rgba(17, 24, 39, 0.18);
                }
                .scene.is-global-protocol.is-ritual-failed .ritual-meter-fill {
                    width: calc(var(--nudge-ritual-time-progress) * 100%);
                    background: linear-gradient(90deg, #f8fafc, #9ca3af, #111827);
                    box-shadow: 0 0 18px rgba(17, 24, 39, 0.24);
                }
                .hud {
                    position: absolute;
                    /* The selected worker's iframe occupies layer 3. */
                    z-index: 6;
                    top: 12px;
                    left: 12px;
                    display: none;
                    flex-direction: column;
                    gap: 5px;
                    box-sizing: border-box;
                    width: min(310px, calc(100vw - 24px));
                    padding: 11px 12px;
                    border: 1px solid rgba(255, 255, 255, 0.14);
                    border-radius: 8px;
                    background: rgba(16, 20, 22, 0.92);
                    color: #e4e9e7;
                    font-family: var(--font-theme-ui, system-ui, sans-serif);
                    font-size: 10px;
                    line-height: 1.45;
                    letter-spacing: 0;
                    font-variant-numeric: tabular-nums;
                    overflow-wrap: anywhere;
                    box-shadow: 0 3px 12px rgba(0, 0, 0, 0.12);
                    pointer-events: none;
                    contain: layout style;
                }
                .scene.is-hud-visible .hud {
                    display: flex;
                    opacity: 1;
                    transform: none;
                }
                .hud-title {
                    font-size: 9px;
                    font-weight: 600;
                    letter-spacing: 0.09em;
                    color: #aab8b1;
                }
                .hud-status {
                    font-size: 11px;
                    font-weight: 600;
                }
                .hud-meter {
                    height: 3px;
                    width: 100%;
                    margin-top: 2px;
                    background: rgba(255, 255, 255, 0.12);
                    border-radius: 2px;
                    overflow: hidden;
                }
                .hud-meter-fill {
                    height: 100%;
                    width: 0%;
                    background: var(--nudge-accent);
                    transition: width 0.2s ease;
                }
                .hud-meter-label, .hud-hint { color: #bcc7c1; }
                .hud-telemetry {
                    margin-top: 2px;
                    padding-top: 7px;
                    border-top: 1px solid rgba(255, 255, 255, 0.1);
                    color: #9faea6;
                    font-size: 10px;
                    line-height: 1.6;
                    white-space: pre-line;
                }
                .scene.is-zen .hud {
                    border-color: var(--nudge-hud-border);
                    background: var(--nudge-hud-surface);
                    color: var(--nudge-hud-ink);
                }
                .scene.is-zen .hud-title { color: var(--nudge-hud-tag); }
                .scene.is-zen .hud-meter { background: var(--nudge-hud-meter-track); }
                .scene.is-zen .hud-meter-fill { background: var(--nudge-hud-meter-fill); }
                .scene.is-zen .hud-meter-label,
                .scene.is-zen .hud-hint,
                .scene.is-zen .hud-telemetry { color: var(--nudge-hud-muted); }
                .scene.is-zen .hud-telemetry { border-color: var(--nudge-hud-inner); }
                .scene.is-zen .ritual-guide {
                    border: 0;
                    background: transparent;
                    color: rgba(245, 251, 247, 0.96);
                    box-shadow: none;
                    font-family: var(--font-theme-ui, var(--font-sans, system-ui, sans-serif));
                }
                .scene.is-zen .ritual-title {
                    color: rgba(205, 229, 219, 0.76);
                    font-family: var(--font-theme-ui, var(--font-sans, system-ui, sans-serif));
                }
                .scene.is-zen .ritual-body {
                    color: rgba(247, 252, 249, 0.96);
                }
                .scene.is-zen .ritual-meter {
                    background: rgba(93, 64, 55, 0.14);
                }
                .scene.is-zen .ritual-meter-fill {
                    background: linear-gradient(90deg, var(--nudge-hud-meter-fill), var(--nudge-hud-meter-fill-alt));
                    box-shadow: none;
                }
                .scene.is-zen.is-global-protocol .ritual-guide {
                    border-color: rgba(17, 24, 39, 0.18);
                    background:
                        linear-gradient(180deg, rgba(255, 255, 255, 0.88), rgba(242, 242, 238, 0.76)),
                        repeating-linear-gradient(0deg, rgba(17, 24, 39, 0.045) 0 1px, transparent 1px 6px);
                    color: rgba(17, 24, 39, 0.88);
                    box-shadow:
                        0 16px 42px rgba(0, 0, 0, 0.18),
                        inset 0 0 0 1px rgba(255, 255, 255, 0.66);
                }
                .scene.is-zen.is-global-protocol .ritual-title {
                    color: rgba(17, 24, 39, 0.7);
                    text-shadow: none;
                }
                .scene.is-zen.is-global-protocol .ritual-body {
                    color: rgba(17, 24, 39, 0.78);
                }
                .scene.is-zen.is-global-protocol .ritual-meter {
                    background: rgba(17, 24, 39, 0.14);
                }
                .scene.is-zen.is-global-protocol .ritual-meter-fill {
                    background: linear-gradient(90deg, #050607, #23272f, #dfe3df);
                    box-shadow: 0 0 18px rgba(17, 24, 39, 0.2);
                }
                @media (max-width: 640px) {
                    .scene.is-zen .hud {
                        top: 10px;
                        left: 10px;
                        max-width: calc(100vw - 20px);
                        min-width: 0;
                    }
                    .scene.is-zen .hud-meter {
                        width: 100%;
                    }
                    .ritual-guide,
                    .scene.is-zen .ritual-guide {
                        top: 18px;
                        left: 50%;
                        right: auto;
                        bottom: auto;
                        width: calc(100vw - 28px);
                    }
                    .ritual-guide::before {
                        inset: -24px -20px -28px;
                    }
                    .ritual-body {
                        font-size: clamp(16px, 5vw, 20px);
                    }
                    .ritual-hint {
                        max-width: 94vw;
                        font-size: 11.5px;
                        line-height: 1.55;
                    }
                }
                @media (max-height: 520px) {
                    .ritual-guide,
                    .scene.is-zen .ritual-guide {
                        top: 12px;
                    }
                    .ritual-signal {
                        display: none;
                    }
                    .ritual-body {
                        margin-top: 4px;
                        font-size: 16px;
                    }
                    .ritual-hint {
                        margin-top: 5px;
                    }
                    .ritual-steps {
                        margin-top: 8px;
                    }
                }
                @media (prefers-reduced-motion: reduce) {
                    .scene.is-global-protocol::after {
                        animation: none !important;
                    }
                    .ritual-guide,
                    .ritual-signal,
                    .ritual-signal__wake,
                    .ritual-step {
                        animation: none !important;
                        transition-duration: 0.01ms !important;
                    }
                }
                .modal-backdrop {
                    position: fixed;
                    inset: 0;
                    background: var(--nudge-modal-backdrop);
                    backdrop-filter: blur(var(--nudge-modal-backdrop-blur));
                    pointer-events: auto;
                    display: none;
                    align-items: center;
                    justify-content: center;
                    padding: 20px;
                }
                .modal-backdrop.is-open { display: flex; }
                .modal {
                    width: min(520px, 92vw);
                    background: var(--nudge-modal-surface);
                    color: var(--nudge-modal-ink);
                    border: 1px solid var(--nudge-modal-border);
                    border-radius: 18px;
                    box-shadow: 0 22px 55px rgba(0,0,0,0.25);
                    padding: 18px 18px 16px;
                    font-family: var(--font-theme-ui, var(--font-sans, system-ui, sans-serif));
                }
                .modal-tag { display: none; }
                .modal h3 { margin: 0 0 6px; font-size: 18px; }
                .modal p { margin: 0 0 14px; color: var(--nudge-modal-muted); line-height: 1.45; }
                .modal-divider { display: none; }
                .actions { display: flex; gap: 10px; justify-content: flex-end; flex-wrap: wrap; }
                .choices { display: none; }
                .choice-card { display: none; }
                .btn {
                    border: 1px solid var(--nudge-modal-btn-border);
                    background: var(--nudge-modal-btn-bg);
                    color: var(--nudge-modal-btn-ink);
                    padding: 10px 14px;
                    border-radius: 12px;
                    font-weight: 700;
                    cursor: pointer;
                }
                .btn.primary {
                    background: var(--nudge-modal-btn-primary-bg);
                    color: var(--nudge-modal-btn-primary-ink);
                    border-color: var(--nudge-modal-btn-primary-border);
                    box-shadow: 0 0 18px var(--nudge-glow);
                }
                .btn:focus-visible { outline: 3px solid rgba(99, 102, 241, 0.35); outline-offset: 2px; }

                /* ── Zen Modal ── */
                @keyframes zenModalGlitchIn {
                    0% { opacity: 0; transform: translateY(8px) skewX(-1.5deg); filter: blur(4px); }
                    12% { opacity: 0.7; transform: translateY(-2px) skewX(2deg); filter: blur(0); }
                    18% { opacity: 0.4; transform: translateY(1px) skewX(-3deg); filter: blur(2px); }
                    28% { opacity: 0.9; transform: translateY(0) skewX(0.5deg); filter: blur(0); }
                    35% { opacity: 0.6; transform: translateY(-1px) skewX(-1deg); }
                    50% { opacity: 1; transform: none; filter: none; }
                    100% { opacity: 1; transform: none; filter: none; }
                }
                @keyframes zenGlitchLine {
                    0%, 100% { opacity: 0; transform: translateY(0); }
                    8% { opacity: 0.6; transform: translateY(-40px); }
                    12% { opacity: 0; transform: translateY(20px); }
                    35% { opacity: 0.3; transform: translateY(-10px); }
                    42% { opacity: 0; }
                }
                @keyframes zenInkSpread {
                    0% { width: 0; opacity: 0; }
                    40% { width: 60%; opacity: 0.7; }
                    100% { width: 100%; opacity: 1; }
                }
                .scene.is-zen ~ .modal-backdrop {
                    background: rgba(18, 14, 10, 0.42);
                    backdrop-filter: blur(3px);
                    -webkit-backdrop-filter: blur(3px);
                }
                .scene.is-zen ~ .modal-backdrop.is-open .modal {
                    animation: zenModalGlitchIn 0.7s cubic-bezier(0.22, 1, 0.36, 1) both;
                    width: min(480px, 90vw);
                    background:
                        url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 200 200'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='200' height='200' filter='url(%23n)' opacity='0.035'/%3E%3C/svg%3E"),
                        linear-gradient(175deg, rgba(253, 250, 243, 0.98) 0%, rgba(247, 241, 230, 0.96) 100%);
                    border: 1px solid rgba(93, 64, 55, 0.18);
                    border-radius: 6px;
                    box-shadow:
                        0 1px 0 rgba(93, 64, 55, 0.08),
                        0 20px 50px rgba(31, 24, 18, 0.18),
                        inset 0 1px 0 rgba(255, 255, 255, 0.5);
                    padding: 0;
                    overflow: hidden;
                    font-family: var(--font-theme-ui, var(--font-sans, system-ui, sans-serif));
                    color: #3A2B24;
                    position: relative;
                }
                .scene.is-zen ~ .modal-backdrop.is-open .modal::before {
                    content: '';
                    position: absolute;
                    top: 0; left: 0; right: 0;
                    height: 3px;
                    background: linear-gradient(90deg, transparent, rgba(93, 64, 55, 0.5), rgba(125, 142, 103, 0.6), rgba(93, 64, 55, 0.5), transparent);
                    animation: zenInkSpread 0.9s 0.3s ease-out both;
                }
                .scene.is-zen ~ .modal-backdrop.is-open .modal::after {
                    content: '';
                    position: absolute;
                    top: 0; left: 0; right: 0;
                    height: 100%;
                    background: linear-gradient(180deg, rgba(255,255,255,0) 0%, rgba(255,255,255,0) 49%, rgba(180, 120, 80, 0.04) 50%, rgba(255,255,255,0) 51%);
                    pointer-events: none;
                    animation: zenGlitchLine 0.7s ease-out both;
                }
                .scene.is-zen ~ .modal-backdrop .modal-tag {
                    display: block;
                    padding: 14px 22px 0;
                    font-family: var(--font-theme-ui, var(--font-sans, system-ui, sans-serif));
                    font-size: 9px;
                    font-weight: 700;
                    letter-spacing: 0.28em;
                    text-transform: uppercase;
                    color: rgba(93, 64, 55, 0.52);
                }
                .scene.is-zen ~ .modal-backdrop .modal-tag::before {
                    content: '⊘ ';
                    opacity: 0.7;
                }
                .scene.is-zen ~ .modal-backdrop .modal h3 {
                    padding: 8px 22px 0;
                    margin: 0;
                    font-size: 19px;
                    font-weight: 700;
                    line-height: 1.4;
                    letter-spacing: -0.01em;
                    color: #2F241E;
                }
                .scene.is-zen ~ .modal-backdrop .modal p {
                    padding: 6px 22px 0;
                    margin: 0;
                    font-size: 13.5px;
                    line-height: 1.65;
                    color: rgba(74, 58, 50, 0.82);
                    letter-spacing: 0.005em;
                }
                .scene.is-zen ~ .modal-backdrop .modal-divider {
                    display: block;
                    margin: 16px 22px 0;
                    height: 1px;
                    background: linear-gradient(90deg, transparent, rgba(93, 64, 55, 0.2), transparent);
                }
                .scene.is-zen ~ .modal-backdrop .actions {
                    display: none;
                }
                .scene.is-zen ~ .modal-backdrop .choices {
                    display: flex;
                    gap: 10px;
                    padding: 14px 18px 18px;
                }
                .scene.is-zen ~ .modal-backdrop .choice-card {
                    display: flex;
                    flex-direction: column;
                    flex: 1;
                    padding: 14px 16px;
                    border-radius: 8px;
                    border: 1px solid rgba(93, 64, 55, 0.15);
                    background: rgba(255, 255, 255, 0.55);
                    cursor: pointer;
                    transition: all 0.25s ease;
                    position: relative;
                    overflow: hidden;
                }
                .scene.is-zen ~ .modal-backdrop .choice-card::after {
                    content: '';
                    position: absolute;
                    inset: 0;
                    background: radial-gradient(circle at var(--ripple-x, 50%) var(--ripple-y, 50%), rgba(125, 142, 103, 0.15) 0%, transparent 70%);
                    opacity: 0;
                    transition: opacity 0.3s ease;
                    pointer-events: none;
                }
                .scene.is-zen ~ .modal-backdrop .choice-card:hover {
                    border-color: rgba(93, 64, 55, 0.28);
                    background: rgba(255, 255, 255, 0.75);
                    box-shadow: 0 4px 16px rgba(31, 24, 18, 0.08);
                    transform: translateY(-1px);
                }
                .scene.is-zen ~ .modal-backdrop .choice-card:hover::after {
                    opacity: 1;
                }
                .scene.is-zen ~ .modal-backdrop .choice-card:active {
                    transform: translateY(0);
                    transition-duration: 0.08s;
                }
                .scene.is-zen ~ .modal-backdrop .choice-card.choice-drift {
                    border-color: rgba(111, 139, 116, 0.34);
                    background: rgba(244, 249, 243, 0.78);
                }
                .scene.is-zen ~ .modal-backdrop .choice-card.choice-drift:hover,
                .scene.is-zen ~ .modal-backdrop .choice-card.choice-drift:focus-visible {
                    border-color: rgba(96, 132, 105, 0.58);
                    background: rgba(239, 248, 239, 0.94);
                }
                .scene.is-zen ~ .modal-backdrop .choice-title {
                    font-size: 14px;
                    font-weight: 700;
                    color: #2F241E;
                    margin-bottom: 4px;
                    letter-spacing: 0.01em;
                }
                .scene.is-zen ~ .modal-backdrop .choice-desc {
                    font-size: 11.5px;
                    line-height: 1.5;
                    color: rgba(74, 58, 50, 0.68);
                    letter-spacing: 0.005em;
                }
                .scene.is-zen ~ .modal-backdrop .choice-card:focus-visible {
                    outline: 2px solid rgba(125, 142, 103, 0.6);
                    outline-offset: 2px;
                }
            </style>
            <div class="scene" id="nudgeScene">
                <div class="scrim" id="nudgeScrim"></div>
                <div class="global-lcd-row-fault" aria-hidden="true"><i></i><i></i><i></i></div>
                <canvas class="canvas" id="nudgeCanvas"></canvas>
                <button class="site-furin-action" id="nudgeSiteFurinAction" type="button" aria-label="" aria-keyshortcuts="Enter Space" tabindex="-1" hidden disabled></button>
                <button class="global-sentinel-action" id="nudgeGlobalSentinelAction" type="button" aria-label="" aria-keyshortcuts="Enter Space" aria-live="polite" aria-atomic="true" tabindex="-1" hidden disabled></button>
                <div class="global-sentinel-status" id="nudgeGlobalSentinelStatus" role="status" aria-live="polite" aria-atomic="true"></div>
                <div class="ritual-guide" id="nudgeRitualGuide" role="status" aria-live="polite" aria-atomic="true">
                    <div class="ritual-signal" aria-hidden="true">
                        <span class="ritual-signal__wake ritual-signal__wake--far"></span>
                        <span class="ritual-signal__wake ritual-signal__wake--near"></span>
                        <span class="ritual-signal__core"></span>
                    </div>
                    <div class="ritual-title" id="nudgeRitualTitle"></div>
                    <div class="ritual-body" id="nudgeRitualBody"></div>
                    <div class="ritual-hint" id="nudgeRitualHint"></div>
                    <div class="ritual-steps" aria-hidden="true">
                        <span class="ritual-step ritual-step--connect"></span>
                        <span class="ritual-step ritual-step--return"></span>
                        <span class="ritual-step ritual-step--settle"></span>
                    </div>
                    <div class="ritual-meter"><div class="ritual-meter-fill" id="nudgeRitualMeter"></div></div>
                </div>
                <div class="hud" id="nudgeHud">
                    <div class="hud-title" id="nudgeHudTitle"></div>
                    <div class="hud-status" id="nudgeHudStatus"></div>
                    <div class="hud-meter"><div class="hud-meter-fill" id="nudgeHudMeter"></div></div>
                    <div class="hud-meter-label" id="nudgeHudMeterLabel"></div>
                    <div class="hud-hint" id="nudgeHudHint"></div>
                    <div class="hud-telemetry" id="nudgeHudTelemetry"></div>
                </div>
                <div class="rift-invite" id="nudgeRiftInvite" hidden aria-hidden="true">
                    <button class="rift-invite__button" id="nudgeRiftInviteButton" type="button" aria-label="" tabindex="-1" disabled></button>
                    <p class="rift-invite__caption" id="nudgeRiftInviteCaption" aria-hidden="true"></p>
                </div>
            </div>
            <div class="modal-backdrop" id="nudgeModalBackdrop" role="dialog" aria-modal="true" aria-label="">
                <div class="modal">
                    <div class="modal-tag" id="nudgeModalTag"></div>
                    <h3 id="nudgeTitle"></h3>
                    <p id="nudgeBody"></p>
                    <div class="modal-divider"></div>
                    <div class="actions">
                        <button class="btn primary" id="nudgeContinueBtn" type="button"></button>
                        <button class="btn" id="nudgeLeaveBtn" type="button"></button>
                    </div>
                    <div class="choices">
                        <button class="choice-card choice-drift" id="nudgeChoiceDrift" type="button">
                            <span class="choice-title" id="nudgeChoiceDriftTitle"></span>
                            <span class="choice-desc" id="nudgeChoiceDriftDesc"></span>
                        </button>
                        <button class="choice-card choice-escape" id="nudgeChoiceEscape" type="button">
                            <span class="choice-title" id="nudgeChoiceEscapeTitle"></span>
                            <span class="choice-desc" id="nudgeChoiceEscapeDesc"></span>
                        </button>
                    </div>
                </div>
            </div>
        `;
