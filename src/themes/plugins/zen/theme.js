import { Theme } from '../../core/base.js';

const ZEN_CSS = `
@property --zen-ambient-shell-top {
    syntax: '<color>';
    inherits: true;
    initial-value: #fdfbf7;
}

@property --zen-ambient-shell-bottom {
    syntax: '<color>';
    inherits: true;
    initial-value: #f8f6f0;
}

@property --zen-ambient-layer-l2-top {
    syntax: '<color>';
    inherits: true;
    initial-value: #fffdf8;
}

@property --zen-ambient-layer-l2-bottom {
    syntax: '<color>';
    inherits: true;
    initial-value: #faf7ed;
}

@property --zen-ambient-layer-l3-top {
    syntax: '<color>';
    inherits: true;
    initial-value: #fdfbf7;
}

@property --zen-ambient-layer-l3-bottom {
    syntax: '<color>';
    inherits: true;
    initial-value: #f4f1e1;
}

@property --zen-ambient-background {
    syntax: '<color>';
    inherits: true;
    initial-value: #faf7ed;
}

@property --zen-ambient-surface {
    syntax: '<color>';
    inherits: true;
    initial-value: #ffffff;
}

@property --zen-ambient-surface-elevated {
    syntax: '<color>';
    inherits: true;
    initial-value: #fffefb;
}

@property --zen-ambient-surface-sunken {
    syntax: '<color>';
    inherits: true;
    initial-value: #f8f6f0;
}

@property --zen-ambient-surface-overlay {
    syntax: '<color>';
    inherits: true;
    initial-value: #fffdf8;
}

@property --zen-ambient-edge {
    syntax: '<color>';
    inherits: true;
    initial-value: rgba(93, 64, 55, 0.08);
}

@property --zen-ambient-cast-shadow {
    syntax: '<color>';
    inherits: true;
    initial-value: rgba(93, 64, 55, 0.12);
}

@property --zen-ambient-shell-glow {
    syntax: '<color>';
    inherits: true;
    initial-value: rgba(125, 142, 103, 0.05);
}

@property --zen-ambient-light-x {
    syntax: '<percentage>';
    inherits: true;
    initial-value: 18%;
}

@property --zen-ambient-light-y {
    syntax: '<percentage>';
    inherits: true;
    initial-value: 0%;
}

@property --zen-ambient-text {
    syntax: '<color>';
    inherits: true;
    initial-value: #383733;
}

@property --zen-ambient-primary {
    syntax: '<color>';
    inherits: true;
    initial-value: #5d4037;
}

@property --zen-ambient-text-muted {
    syntax: '<color>';
    inherits: true;
    initial-value: #615f5a;
}

@property --zen-ambient-text-subtle {
    syntax: '<color>';
    inherits: true;
    initial-value: #6b6963;
}

@property --zen-ambient-border {
    syntax: '<color>';
    inherits: true;
    initial-value: #b8b2aa;
}

@property --zen-ambient-border-muted {
    syntax: '<color>';
    inherits: true;
    initial-value: #d6d2cc;
}

@property --zen-ambient-border-strong {
    syntax: '<color>';
    inherits: true;
    initial-value: #978f86;
}

/* Shell */
[data-theme='zen'] {
    --artifact-workspace-threshold-width: 8px;
    --artifact-control-rail-width: clamp(380px, 36%, 480px);
}

/*
 * DashboardLayout installs the validated ambient projection on body, the Zen
 * world host. Resolve semantic aliases on that same element so registered
 * custom properties do not collapse to their daytime initial values. Portals
 * mounted under body inherit the same material contract as the console frame.
 */
[data-theme='zen'] body {
    --color-background: var(--zen-ambient-background);
    --color-surface: var(--zen-ambient-surface);
    --color-surface-variant: var(--zen-ambient-surface-sunken);
    --color-surface-elevated: var(--zen-ambient-surface-elevated);
    --color-surface-sunken: var(--zen-ambient-surface-sunken);
    --color-surface-overlay: var(--zen-ambient-surface-overlay);
    --color-glass-bg: color-mix(in srgb, var(--zen-ambient-surface-elevated) 82%, transparent);
    --color-glass-border: var(--zen-ambient-border-muted);
    --color-on-surface: var(--zen-ambient-text);
    --color-on-surface-muted: var(--zen-ambient-text-muted);
    --color-on-surface-subtle: var(--zen-ambient-text-subtle);
    --color-text: var(--zen-ambient-text);
    --color-primary: var(--zen-ambient-primary);
    --color-text-muted: var(--zen-ambient-text-muted);
    --color-border: var(--zen-ambient-border);
    --color-border-muted: var(--zen-ambient-border-muted);
    --color-border-strong: var(--zen-ambient-border-strong);
    --zen-console-edge: var(--zen-ambient-edge);
    --zen-layer-l3-surface: linear-gradient(
        180deg,
        var(--zen-ambient-layer-l3-top),
        var(--zen-ambient-layer-l3-bottom)
    );
    --zen-layer-l2-surface: linear-gradient(
        180deg,
        var(--zen-ambient-layer-l2-top),
        var(--zen-ambient-layer-l2-bottom)
    );
    --zen-layer-l3-cast-shadow: linear-gradient(
        90deg,
        var(--zen-ambient-cast-shadow) 0%,
        color-mix(in srgb, var(--zen-ambient-cast-shadow) 42%, transparent) 38%,
        transparent 100%
    );
    --zen-layer-l2-inset-edge: color-mix(in srgb, var(--zen-ambient-border) 34%, transparent);
    --zen-layer-l2-inset-shadow-inline: -8px 0 18px var(--zen-ambient-cast-shadow);
    --zen-layer-l2-inset-shadow-block: 0 -8px 18px var(--zen-ambient-cast-shadow);
    --zen-console-sidebar-bg: var(--zen-layer-l3-surface);
    --zen-console-content-bg: var(--zen-layer-l2-surface);
    --zen-home-portrait-rhythm-surface:
        linear-gradient(
            180deg,
            color-mix(in srgb, var(--zen-ambient-layer-l2-top) 84%, transparent),
            color-mix(in srgb, var(--zen-ambient-layer-l2-bottom) 72%, transparent)
        );
    --zen-home-portrait-rhythm-edge: var(--zen-ambient-edge);
    --artifact-workspace-threshold-background: var(--zen-layer-l2-surface);
    --artifact-workspace-threshold-edge: var(--zen-layer-l2-inset-edge);
    --artifact-workspace-threshold-shadow: var(--zen-layer-l2-inset-shadow-inline-left);
    --artifact-control-rail-background: var(--zen-layer-l2-surface);
    --artifact-control-rail-edge: var(--zen-layer-l2-inset-edge);
    --artifact-control-rail-shadow: var(--zen-layer-l2-inset-shadow-inline);
    --artifact-control-rail-portrait-shadow: var(--zen-layer-l2-inset-shadow-block);
    --zen-dock-bg: color-mix(in srgb, var(--zen-ambient-surface-elevated) 84%, transparent);
    --zen-dock-border: color-mix(in srgb, var(--zen-ambient-border-strong) 55%, transparent);
    --zen-dock-shadow: 0 8px 30px -4px var(--zen-ambient-cast-shadow), 0 2px 8px -2px color-mix(in srgb, var(--zen-ambient-cast-shadow) 50%, transparent);
    --zen-dock-active-pill: color-mix(in srgb, var(--zen-ambient-primary) 12%, transparent);
    --zen-dock-active-pill-border: color-mix(in srgb, var(--zen-ambient-primary) 24%, transparent);
    --zen-dock-active-text: var(--zen-ambient-text);
    --zen-dock-idle-text: var(--zen-ambient-text-muted);
    transition:
        --zen-ambient-shell-top 1600ms ease,
        --zen-ambient-shell-bottom 1600ms ease,
        --zen-ambient-layer-l2-top 1600ms ease,
        --zen-ambient-layer-l2-bottom 1600ms ease,
        --zen-ambient-layer-l3-top 1600ms ease,
        --zen-ambient-layer-l3-bottom 1600ms ease,
        --zen-ambient-background 1600ms ease,
        --zen-ambient-surface 1600ms ease,
        --zen-ambient-surface-elevated 1600ms ease,
        --zen-ambient-surface-sunken 1600ms ease,
        --zen-ambient-surface-overlay 1600ms ease,
        --zen-ambient-edge 1600ms ease,
        --zen-ambient-cast-shadow 1600ms ease,
        --zen-ambient-shell-glow 1600ms ease,
        --zen-ambient-light-x 1600ms ease,
        --zen-ambient-light-y 1600ms ease,
        --zen-ambient-text 1600ms ease,
        --zen-ambient-primary 1600ms ease,
        --zen-ambient-text-muted 1600ms ease,
        --zen-ambient-text-subtle 1600ms ease,
        --zen-ambient-border 1600ms ease,
        --zen-ambient-border-muted 1600ms ease,
        --zen-ambient-border-strong 1600ms ease;
}

[data-theme='zen'] .console-shell {
    background:
        radial-gradient(
            circle at var(--zen-ambient-light-x) var(--zen-ambient-light-y),
            var(--zen-ambient-shell-glow),
            transparent 34%
        ),
        linear-gradient(
            180deg,
            var(--zen-ambient-shell-top),
            var(--zen-ambient-shell-bottom)
        );
}

/*
 * Scaler leaves a viewport margin around its fitted console frame. That margin
 * is part of the Zen world, not a body-color fallback: it receives the exact
 * same canonical ambient variables as the shell.
 */
[data-theme='zen'] .zen-ambient-viewport-backdrop {
    background:
        radial-gradient(
            ellipse 120% 100% at 50% 50%,
            transparent 50%,
            var(--zen-ambient-vignette-shadow) 100%
        ),
        radial-gradient(
            circle at var(--zen-ambient-light-x) var(--zen-ambient-light-y),
            var(--zen-ambient-shell-glow),
            transparent 34%
        ),
        linear-gradient(
            180deg,
            var(--zen-ambient-shell-top),
            var(--zen-ambient-shell-bottom)
        );
    transition:
        --zen-ambient-shell-top 1600ms ease,
        --zen-ambient-shell-bottom 1600ms ease,
        --zen-ambient-shell-glow 1600ms ease,
        --zen-ambient-vignette-shadow 1600ms ease,
        --zen-ambient-light-x 1600ms ease,
        --zen-ambient-light-y 1600ms ease;
}

[data-theme='zen'] .console-sidebar {
    /* Rows tint this one L3 paper plane; they do not install another surface. */
    --zen-sidebar-rule: var(--zen-console-edge);
    --zen-sidebar-hover: color-mix(in srgb, var(--color-on-surface) 3%, transparent);
    --zen-sidebar-active: color-mix(in srgb, var(--color-accent) 7%, transparent);
    background: var(--zen-console-sidebar-bg);
    border-right: 1px solid var(--zen-console-edge);
    box-shadow: none;
}

html[data-theme='zen'] [data-ui-orientation='portrait'] .console-sidebar {
    border-bottom-color: var(--zen-console-edge);
}

[data-theme='zen'] .console-sidebar::after {
    content: '';
    position: absolute;
    top: 0;
    bottom: 0;
    right: -18px;
    width: 18px;
    pointer-events: none;
    background: var(--zen-layer-l3-cast-shadow);
    opacity: 0.42;
}

[data-theme='zen'] [data-ui-orientation='landscape'] .console-frame[data-dashboard-active-tab='tools'] {
    --artifact-workspace-threshold-width: 18px;
}

[data-theme='zen'] .console-content {
    background: var(--zen-console-content-bg);
    box-shadow: none;
}

[data-theme='zen'] [data-ui-layout='portrait-desktop'] .zen-home-rhythm-slot {
    --zen-rhythm-inscription-background: var(--zen-home-portrait-rhythm-surface);
    --zen-rhythm-inscription-color: #4B4A46;
    box-shadow: inset 1px 0 var(--zen-home-portrait-rhythm-edge);
}

[data-theme='zen'] [data-ui-layout='portrait-desktop'] .zen-home-rhythm-slot .zen-rhythm-marker {
    flex-direction: column;
    align-items: flex-start;
    justify-content: flex-start;
    padding: clamp(28px, 3.4vh, 48px) clamp(22px, 2.8vw, 40px) 28px;
}

[data-theme='zen'] [data-ui-layout='portrait-desktop'] .zen-home-rhythm-slot .zen-rhythm-marker__clock-row {
    flex-direction: column;
    align-items: flex-start;
    gap: 4px;
}

[data-theme='zen'] [data-ui-layout='portrait-desktop'] .zen-home-rhythm-slot .zen-rhythm-marker__time {
    font-size: clamp(38px, 4.2vw, 48px);
    letter-spacing: -0.025em;
}

[data-theme='zen'] [data-ui-layout='portrait-desktop'] .zen-home-rhythm-slot .zen-rhythm-marker__phase {
    font-size: var(--zen-type-caption);
    letter-spacing: var(--zen-tracking-label);
}

[data-theme='zen'] [data-ui-layout='portrait-desktop'] .zen-home-rhythm-slot .zen-rhythm-marker__context {
    width: 100%;
    height: clamp(88px, 10vh, 116px);
    max-width: none;
    min-width: 0;
    margin-top: clamp(20px, 2.4vh, 30px);
    margin-left: 0;
    padding-left: 0;
    text-align: left;
}

[data-theme='zen'] [data-ui-layout='portrait-desktop'] .zen-home-rhythm-slot .zen-rhythm-marker__context-copy {
    top: 0;
    right: auto;
    left: 0;
    max-width: min(100%, 220px);
    text-align: left;
}

[data-theme='zen'] [data-ui-layout='portrait-desktop'] .zen-home-rhythm-slot .zen-rhythm-marker__context-label {
    font-size: var(--zen-type-floor);
}

[data-theme='zen'] [data-ui-layout='portrait-desktop'] .zen-home-rhythm-slot .zen-rhythm-marker__trace-canvas {
    top: auto;
    bottom: 0;
    height: auto;
}

/* First Vision keeps the dashboard geometry intact and changes paint only. */
[data-theme='zen'] .console-sidebar,
[data-theme='zen'] [data-main-presentation-layer='rhythm'] {
    transition:
        filter 760ms cubic-bezier(0.16, 1, 0.3, 1),
        opacity 760ms cubic-bezier(0.16, 1, 0.3, 1);
}

[data-theme='zen'] .zen-main-vision-surface::after {
    content: '';
    position: absolute;
    inset: 0;
    z-index: 20;
    pointer-events: none;
    opacity: 0;
    box-shadow:
        inset 0 0 0 1px rgba(244, 239, 201, 0.56),
        inset 0 0 18px rgba(218, 201, 140, 0.15),
        0 0 24px rgba(203, 183, 121, 0.14);
    transition: opacity 900ms cubic-bezier(0.16, 1, 0.3, 1);
}

[data-theme='zen'] .console-frame[data-main-presentation-emphasis='first_vision_focus'] .console-sidebar {
    opacity: 0.92;
    filter: blur(0.22px) saturate(0.88) contrast(0.96) brightness(0.985);
}

[data-theme='zen'] [data-main-presentation-emphasis='first_vision_focus'] [data-main-presentation-layer='rhythm'] {
    opacity: 0.88;
    filter: blur(0.18px) saturate(0.86) contrast(0.95) brightness(0.985);
}

[data-theme='zen'] [data-main-presentation-emphasis='first_vision_focus'] .zen-main-vision-surface::after {
    opacity: 1;
}

@media (prefers-reduced-motion: reduce) {
    [data-theme='zen'] .console-sidebar,
    [data-theme='zen'] [data-main-presentation-layer='rhythm'],
    [data-theme='zen'] .zen-main-vision-surface::after {
        transition: none;
    }

    [data-theme='zen'] .console-frame[data-main-presentation-emphasis='first_vision_focus'] .console-sidebar,
    [data-theme='zen'] [data-main-presentation-emphasis='first_vision_focus'] [data-main-presentation-layer='rhythm'] {
        filter: saturate(0.88) contrast(0.96) brightness(0.985);
    }
}

@media (forced-colors: active) {
    [data-theme='zen'] .console-frame[data-main-presentation-emphasis='first_vision_focus'] .console-sidebar,
    [data-theme='zen'] [data-main-presentation-emphasis='first_vision_focus'] [data-main-presentation-layer='rhythm'] {
        opacity: 1;
        filter: none;
    }

    [data-theme='zen'] [data-main-presentation-emphasis='first_vision_focus'] .zen-main-vision-surface::after {
        display: none;
    }
}

/* Typography Refinement */
[data-theme='zen'] {
    font-variant-numeric: tabular-nums;
    -webkit-font-smoothing: antialiased;

    /* Zen type contract. The floor is the smallest size any Zen text may use;
       readable at a glance in both Latin and the Hangul fallback face.
       Label tracking/case are tuned for Latin capitals and are relaxed for
       Korean below, where wide tracking breaks syllable blocks apart. */
    --zen-type-floor: 11px;
    --zen-type-caption: 12px;
    --zen-type-body: 13px;
    --zen-tracking-label: 0.14em;
    --zen-tracking-caption: 0.04em;
    --zen-label-case: uppercase;

    /* Fixed inks. Shu (vermilion) marks a fault or an irreversible act.
       Water inks sit on the pond, which stays dark through every ambient phase. */
    --zen-ink-shu: #b4503c;
    --zen-water-ink: #f2f0e2;
    --zen-water-ink-shadow: rgb(6 21 15 / 0.9);
    --zen-water-ink-warn: #ffe1b9;
}

[data-theme='zen']:lang(ko) {
    --zen-tracking-label: 0.04em;
    --zen-tracking-caption: 0;
    --zen-label-case: none;
}

[data-theme='zen']:lang(ko) .font-heading {
    letter-spacing: 0;
}

/* Family comes from the Tailwind utility (--font-theme-*), which this theme's
   tokens.typography feeds. Do NOT redeclare font-family here: a
   [data-theme] block outranks the utility class and would pin zen to the
   app-base stack, making this theme's typography tokens dead config. Only
   zen-specific weight/spacing/rhythm belongs in these rules. */
[data-theme='zen'] .font-heading {
    font-weight: 300;
    letter-spacing: -0.02em;
    line-height: 1.1;
}

[data-theme='zen'] .font-mono {
    letter-spacing: -0.01em;
}

[data-theme='zen'] .font-serif {
    line-height: 1.5;
}

[data-theme='zen'] .font-sans {
    line-height: 1.6;
    letter-spacing: 0.01em;
}

[data-theme='zen'] .nav-button {
    transition: color 0.2s ease, background-color 0.2s ease, border-color 0.2s ease;
    border-radius: 0;
    margin: 0;
    width: 100%;
    padding: 0 24px;
    position: relative;
    background-color: transparent;
    color: var(--color-on-surface-muted);
    border-bottom: 1px solid var(--zen-sidebar-rule);
    font-family: var(--font-theme-ui);
    font-size: 0.75rem;
    letter-spacing: 0.15em;
    text-transform: uppercase;
    font-weight: 500;
    transform: none !important;
}

[data-theme='zen'] .nav-button:hover,
[data-theme='zen'] .nav-button:active,
[data-theme='zen'] .nav-button.is-active {
    transform: none !important;
    box-shadow: none !important;
}

@media (hover: hover) {
    [data-theme='zen'] .nav-button:hover:not(.is-active) {
        background-color: var(--zen-sidebar-hover);
        color: var(--color-on-surface);
    }
}

[data-theme='zen'] .nav-button.is-active {
    background-color: var(--zen-sidebar-active);
    color: var(--color-primary);
}

[data-theme='zen'] .console-sidebar .nav-button:focus-visible,
[data-theme='zen'] .console-sidebar .settings-button:focus-visible {
    outline: 2px solid var(--color-accent);
    outline-offset: -4px;
}

[data-theme='zen'] .nav-button[data-tab='tools'].has-artifact-disclosure-cue:not(.is-active)::after {
    content: "";
    position: absolute;
    inset: 7px 14px;
    pointer-events: none;
    border: 1px solid color-mix(in srgb, var(--color-accent) 42%, transparent);
    background-color: color-mix(in srgb, var(--color-accent) 3%, transparent);
    opacity: 0.5;
    animation: zenArtifactDisclosureNavCueBreath 5.8s ease-in-out infinite;
}

@keyframes zenArtifactDisclosureNavCueBreath {
    0%, 100% {
        opacity: 0.3;
    }
    50% {
        opacity: 0.65;
    }
}

@media (prefers-reduced-motion: reduce) {
    [data-theme='zen'] .nav-button[data-tab='tools'].has-artifact-disclosure-cue:not(.is-active)::after {
        animation: none;
        opacity: 0.62;
    }
}

/* Active indicator (lamp) */
[data-theme='zen'] .nav-button-lamp {
    position: absolute;
    left: 0;
    top: 0;
    bottom: 0;
    width: 4px;
    background-color: var(--color-accent);
    transition: transform 0.4s cubic-bezier(0.16, 1, 0.3, 1);
    transform: scaleY(0);
    transform-origin: bottom;
}

[data-theme='zen'] .nav-button.is-active .nav-button-lamp {
    transform: scaleY(1);
}

[data-theme='zen'] .nav-button-icon {
    transition: all 0.3s ease;
}

[data-theme='zen'] .nav-button.is-active .nav-button-icon,
[data-theme='zen'] .settings-button.is-active .nav-button-icon {
    color: var(--color-accent);
    transform: none;
}

/* Registry Panel Overrides */
[data-theme='zen'] .ui-module {
    background-color: transparent !important;
    border: none !important;
    box-shadow: none !important;
}

/* List Items (Zen Style) */
[data-theme='zen'] .list-item,
[data-theme='zen'] [id^='target-item-'],
[data-theme='zen'] [id^='safe-item-'] {
    border-bottom: 1px solid rgba(93, 64, 55, 0.06) !important;
    border-radius: 0 !important;
    background-color: transparent !important;
    padding-top: 12px !important;
    padding-bottom: 12px !important;
}

[data-theme='zen'] [id^='target-item-']:hover,
[data-theme='zen'] [id^='safe-item-']:hover {
    background-color: rgba(93, 64, 55, 0.02) !important;
}

/* Selected Item (Soft Highlight) */
[data-theme='zen'] [id^='target-item-'].bg-danger\\/10,
[data-theme='zen'] [id^='safe-item-'].bg-success\\/10 {
    background-color: rgba(125, 142, 103, 0.1) !important; /* Cool sage */
    border-color: rgba(125, 142, 103, 0.3) !important;
    box-shadow: none !important;
}

/* Input Fields */
[data-theme='zen'] .ui-input,
[data-theme='zen'] .ui-input-alert {
    background-color: rgba(255, 255, 255, 0.5);
    border: 1px solid var(--color-border);
    color: var(--color-primary);
    box-shadow: none;
    border-radius: 8px;
}

[data-theme='zen'] .ui-input:focus,
[data-theme='zen'] .ui-input-alert:focus {
    border-color: var(--color-primary);
    background-color: transparent;
}

/* Remove Neon Glows */
[data-theme='zen'] .neon-glow {
    box-shadow: none !important;
    border-color: rgba(125, 142, 103, 0.3) !important; /* Default cool border */
}

[data-theme='zen'] .neon-glow.text-danger {
    background-color: #FFEBEE !important; /* Soft Red Bg */
    border-color: #FFCDD2 !important;
    color: #C62828 !important;
}

[data-theme='zen'] .neon-glow.text-success {
    background-color: #EEF1E9 !important; /* Cool green background */
    border-color: #91A081 !important;
    color: #536246 !important;
}

/* Buttons (Soft Pill) */
[data-theme='zen'] .ui-btn {
    transition: color 0.2s ease, background-color 0.2s ease, border-color 0.2s ease, transform 0.4s ease;
}

[data-theme='zen'] .ui-btn[type="submit"] {
    border-radius: 20px !important;
    font-weight: 600 !important;
    letter-spacing: 0.02em !important;
    box-shadow: none !important;
}

[data-theme='zen'] .ui-btn[type="submit"]:hover {
    box-shadow: none !important;
}

[data-theme='zen'] .settings-button {
    transition: color 0.2s ease, background-color 0.2s ease, border-color 0.2s ease;
    border-radius: 0;
    margin: 0;
    width: 100%;
    padding: 0 24px;
    background-color: transparent;
    color: var(--color-on-surface-muted);
    font-size: 0.72rem;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    font-weight: 500;
    transform: none !important;
    box-shadow: none !important;
}

[data-theme='zen'] .settings-button:hover,
[data-theme='zen'] .settings-button:active,
[data-theme='zen'] .settings-button.is-active {
    transform: none !important;
    box-shadow: none !important;
}

[data-theme='zen'] .settings-button.is-active {
    background-color: var(--zen-sidebar-active);
    color: var(--color-primary);
}

@media (hover: hover) {
    [data-theme='zen'] .settings-button:hover:not(.is-active) {
        background-color: var(--zen-sidebar-hover);
        color: var(--color-on-surface);
    }
}

[data-theme='zen'] .settings-button-group {
    background-color: transparent;
    /* The group owns this seam; a child border would paint a second row. */
    border-top: 1px solid var(--zen-sidebar-rule);
}
}`;

export const ZenTheme = new Theme({
    id: 'zen',
    meta: {
        name: 'Zen',
        description: 'A quiet place to grow your focus.',
    },
    customCSS: ZEN_CSS,
    tokens: {
        colors: {
            primary: '#5D4037', // Earth Brown (Text)
            accent: '#7D8E67', // Cool sage green
            alert: '#E57373', // Soft Red (Coral)
            text: '#4A4A4A', // Soft Charcoal

            background: '#FDFBF7', // Warm Cream (Paper)
            surface: '#FFFFFF', // White Card
            surfaceVariant: '#F4F1E1', // Light Beige
            surfaceSunken: '#F8F6F0', // Slightly darker cream
            surfaceOverlay: 'rgba(125, 142, 103, 0.05)', // Very faint cool green tint

            textMuted: '#8D8D8D', // Warm Grey
            textSubtle: '#B0BEC5', // Pale Blue Grey

            glass: 'rgba(255, 255, 255, 0.8)',
            glassBorder: 'rgba(125, 142, 103, 0.2)', // Cool sage border
            border: '#E8E6E1', // Warm Grey Border
            borderMuted: '#F0EFE9',
            borderStrong: '#D7CCC8', // Light Brown Border

            accentSecondary: '#FFB74D', // Soft Orange (Sun)
            accentTertiary: '#4DD0E1', // Sky Blue
            accentHover: '#68775C', // Darker cool sage
            accentMuted: 'rgba(125, 142, 103, 0.1)',
            accentRing: 'rgba(125, 142, 103, 0.3)',
            accentGradientFrom: '#7D8E67',
            accentGradientTo: '#91A081', // Lighter cool sage
            onAccent: '#FFFFFF',

            danger: '#E57373',
            dangerMuted: '#FFEBEE',
            success: '#7D8E67',
            successMuted: '#EEF1E9',
            warning: '#FFD54F',
            warningMuted: '#FFFDE7',
        },
        typography: {
            // Every family here must resolve to a face the app actually ships
            // (see the @font-face set in themes/styles/tokens/typography.css).
            // Naming an unshipped face would silently fall through to the next
            // stack entry and render differently per machine.
            fontFamily: 'var(--font-sans)',
            letterSpacing: '0.01em',
            heading: 'var(--font-sans)',
            body: 'var(--font-sans)',
            mono: 'var(--font-mono)',
            serif: "'App Serif Local', 'Zen Korean Serif Local', serif",
            // No rustic calligraphy. Use a sleek Serif for 'special' text.
            calligraphy: "'App Serif Local', 'Zen Korean Serif Local', serif",
        },
        shapes: {
            borderRadius: '8px', // Restraint-first curvature for compact UI chrome
            borderStyle: 'solid',
        },
        effects: {
            blur: '8px',
            glow: '0 4px 12px rgba(125, 142, 103, 0.15)', // Soft cool green glow
            scanline: 'none',
            noise: '0',
        },
        layout: {
            // Frame Structure (Required for proper grid layout)
            frameColumns: 'var(--console-sidebar-width) minmax(0, 1fr)',
            frameGap: '0px',
            framePadding: '0px',
            frameOverflow: 'hidden',

            // Content Area
            contentPadding: '0px',
            panelViewportPadding: '0px',

            // Theme-specific styling
            railBase: '#FDFBF7',
            railEdge: 'transparent',
            sidebarPadding: '0px',
            sidebarControlsPadding: '24px 0',
            sidebarControlsGap: '0px',
            navButtonAspect: 'auto',
            navButtonHeight: '64px',
            navButtonWidth: '100%',
            navButtonPadding: '0 24px',
            navButtonGap: '12px',
            navButtonMargin: '0',
            navButtonAlign: 'stretch',
            settingsButtonHeight: '50px',
            settingsButtonPadding: '0 24px',
            settingsButtonGap: '8px',
            settingsButtonGroupPadding: '0',
            settingsButtonGroupMargin: 'auto 0 0',
        },
        shadows: {
            sm: '0 2px 4px rgba(0,0,0,0.02)',
            md: '0 4px 12px rgba(93, 64, 55, 0.08)', // Warm shadow
            lg: '0 12px 24px rgba(93, 64, 55, 0.12)',
            glass: '0 8px 32px rgba(125, 142, 103, 0.1)',
        }
    },
    audio: {
        bgm: null,
        clickSound: 'click-soft.mp3', // Placeholder
        alertSound: 'chime-gentle.mp3', // Placeholder
        hoverSound: null,
    },
    behaviors: {
        lensHoverAction: 'lift', // Gentle lift effect
        scrollPhysics: 'bouncy', // Elastic scrolling
        transitionStyle: 'bloom', // Custom Bloom Effect
        transitionDuration: '0.6s', // Slow, relaxed
        cursorStyle: 'pointer', // Standard pointer
    },
    slots: {
        background: null,
    }
});
