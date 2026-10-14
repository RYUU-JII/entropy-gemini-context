import { Theme } from '../../core/base.js';

const ENTROPY_CSS = `
/* ========================================
   Unified Class Name Aliases
   Map new unified class names to Entropy styling
   ======================================== */

[data-theme='entropy'] {
  /* A 6px chassis with the same half-pixel ink rim on both outer halves. */
  --entropy-console-bezel-shadow:
    0 0 0 6px #131517,
    0 0 0 6.5px rgba(0, 0, 0, 0.9);
}

/* Shell Container */
[data-theme='entropy'] .console-shell {
  background: color-mix(in srgb, var(--color-background) 20%, transparent);
  width: 100%;
  height: 100%;
}

/* Console Frame (Main Grid) */
[data-theme='entropy'] .console-frame {
  height: 100%;
  background: transparent;
  border-radius: 0;
  box-shadow: none;
  overflow: visible;
}

/* Sidebar */
[data-theme='entropy'] .console-sidebar {
  position: relative;
  z-index: 10;
  overflow: visible;
  isolation: isolate;
  border-radius: 0;
  border: 6px solid #181a1c;
  border-top-color: #33363a;
  border-bottom-color: #050505;
  border-right: 0;
  background-color: var(--console-plastic-base);
  background-image: none;
  box-shadow:
    /* --- Outer Bezel (Symmetrical 6px Chassis) --- */
    var(--entropy-console-bezel-shadow),
    /* --- Glow & Texture --- */
    0 0 var(--ui-panel-glow-blur) var(--ui-panel-glow-color),
    inset 0 -1px 0 rgba(0, 0, 0, 0.3),
    inset 2px 2px 8px rgba(0, 0, 0, 0.5);
  clip-path: inset(-101px 0 -101px -101px);
}

/* Sidebar Rail */
[data-theme='entropy'] .console-sidebar::after {
  content: '';
  position: absolute;
  top: -12px;
  bottom: -12px;
  right: 0;
  width: var(--ui-rail-size, 20px);
  background-color: #1a1a1a;
  background-image: linear-gradient(180deg, rgba(255, 255, 255, 0.12), transparent 35%, rgba(0, 0, 0, 0.4));
  border-left: 1px solid rgba(0, 0, 0, 0.3);
  border-right: 1px solid rgba(255, 255, 255, 0.05);
  pointer-events: none;
  z-index: 100;
}

/* Content Panel */
[data-theme='entropy'] .console-content {
  position: relative;
  z-index: 5;
  isolation: isolate;
  border-radius: 0;
  border: 6px solid #181a1c;
  border-top-color: #33363a;
  border-bottom-color: #050505;
  border-left: 0;
  display: flex;
  flex-direction: column;
  min-width: 0;
  overflow: visible;
  background-color: var(--console-plastic-base);
  background-image: none;
  box-shadow:
    /* --- Outer Bezel (Symmetrical 6px Chassis) --- */
    var(--entropy-console-bezel-shadow),

    /* --- Glow & Texture --- */
    0 0 var(--ui-panel-glow-blur) var(--ui-panel-glow-color),
    inset 0 -1px 0 rgba(0, 0, 0, 0.3),
    inset 0 2px 8px rgba(0, 0, 0, 0.5);
  clip-path: inset(-101px -101px -101px 0);
}

/* Content Rail */
[data-theme='entropy'] .console-content::before {
  content: '';
  position: absolute;
  top: -12px;
  bottom: -12px;
  left: 0;
  width: var(--ui-rail-size, 20px);
  background-color: #1a1a1a;
  background-image: linear-gradient(180deg, rgba(255, 255, 255, 0.12), transparent 35%, rgba(0, 0, 0, 0.4));
  border-right: 1px solid rgba(0, 0, 0, 0.3);
  border-left: 1px solid rgba(255, 255, 255, 0.05);
  pointer-events: none;
  z-index: 100;
}

/* Stacked panels each have a complete perimeter; only landscape has a side join. */
html[data-theme='entropy'] [data-ui-orientation='portrait'] :is(.console-sidebar, .console-content) {
  border-inline: 6px solid #181a1c;
  clip-path: none;
}

/* Sidebar Controls */
[data-theme='entropy'] .sidebar-controls {
  display: flex;
  flex-direction: column;
  gap: var(--sidebar-controls-gap);
  padding: var(--sidebar-controls-padding);
  height: 100%;
}

/* Navigation Button - Unified */
[data-theme='entropy'] .nav-button {
  position: relative;
  width: 100%;
  aspect-ratio: var(--nav-button-aspect);
  height: var(--nav-button-height);
  padding: var(--nav-button-padding);
  gap: var(--nav-button-gap);
  margin: var(--nav-button-margin);
  --btn-rgb: 255, 60, 0;
  --btn-radius: 6px;
  background:
    radial-gradient(circle at 50% 62%, rgba(255, 255, 255, 0.22) 0%, rgba(255, 255, 255, 0) 46%),
    radial-gradient(circle at 50% 50%, rgba(255, 255, 255, 0.12) 0%, rgba(255, 255, 255, 0) 60%),
    radial-gradient(circle at 50% 50%, #c7c7c7 0%, #bbbbbb 62%, #b0b0b0 100%);
  border: 1px solid rgba(0, 0, 0, 0.18);
  border-radius: var(--btn-radius);
  color: rgba(20, 20, 20, 0.9);
  text-shadow: 0 1px 0 rgba(255, 255, 255, 0.55);
  font-family: var(--font-theme-mono);
  font-size: 0.7rem;
  letter-spacing: 0.08em;
  cursor: pointer;
  isolation: isolate;
  overflow: hidden;
  outline: none;
  box-shadow:
    0 0 0 1px rgba(0, 0, 0, 0.16),
    0 1px 2px rgba(0, 0, 0, 0.2),
    inset 0 1px 0 rgba(255, 255, 255, 0.5),
    inset 0 -1px 0 rgba(0, 0, 0, 0.1),
    inset 0 0 10px rgba(255, 255, 255, 0.18),
    inset 0 0 22px rgba(255, 255, 255, 0.08);
  transition: transform 0.12s ease, box-shadow 0.12s ease, color 0.12s ease, filter 0.12s ease;
  display: flex;
  align-items: center;
  justify-content: center;
  text-transform: uppercase;
}

[data-theme='entropy'] .nav-button::before {
  content: '';
  position: absolute;
  inset: 2px;
  border-radius: calc(var(--btn-radius) - 2px);
  background:
    linear-gradient(180deg, rgba(255, 255, 255, 0.22), rgba(255, 255, 255, 0) 58%),
    radial-gradient(circle at 50% 62%, rgba(255, 255, 255, 0.16) 0%, rgba(255, 255, 255, 0) 64%);
  box-shadow:
    inset 0 0 0 1px rgba(255, 255, 255, 0.18),
    inset 0 0 10px rgba(0, 0, 0, 0.05);
  opacity: 1;
  pointer-events: none;
}

[data-theme='entropy'] .nav-button::after {
  content: '';
  position: absolute;
  inset: 1px;
  border-radius: calc(var(--btn-radius) - 1px);
  background:
    radial-gradient(circle at 50% 50%,
      rgba(255, 255, 255, 0) 68%,
      rgba(255, 255, 255, 0.18) 80%,
      rgba(255, 255, 255, 0) 95%);
  opacity: 0.28;
  pointer-events: none;
}

[data-theme='entropy'] .nav-button:hover:not(:active):not(.is-active) {
  filter: brightness(1.01);
  box-shadow:
    0 0 0 1px rgba(0, 0, 0, 0.18),
    0 2px 4px rgba(0, 0, 0, 0.22),
    inset 0 1px 0 rgba(255, 255, 255, 0.55),
    inset 0 -1px 0 rgba(0, 0, 0, 0.12),
    inset 0 0 12px rgba(255, 255, 255, 0.18);
}

[data-theme='entropy'] .nav-button:active,
[data-theme='entropy'] .nav-button.is-active {
  transform: none;
  background: radial-gradient(circle, rgba(var(--btn-rgb), 0.6) 0%, rgba(20, 20, 20, 1) 100%);
  color: #fff;
  box-shadow:
    0 0 0 1px #111,
    inset 0 0 20px rgba(var(--btn-rgb), 0.8),
    inset 0 0 40px rgba(var(--btn-rgb), 0.25),
    inset 0 0 0 1px rgba(255, 255, 255, 0.08),
    0 0 15px rgba(var(--btn-rgb), 0.4),
    0 2px 0 #050505;
  border-color: rgba(var(--btn-rgb), 0.5);
  text-shadow: 0 0 8px rgba(255, 255, 255, 0.9);
  animation: none;
}

[data-theme='entropy'] .nav-button--accent {
  --btn-rgb: 255, 60, 0;
}

/* Hide lamp element */
[data-theme='entropy'] .nav-button-lamp {
  display: none;
}

/* Nav button label - show only text */
[data-theme='entropy'] .nav-button-icon {
  display: none;
}

[data-theme='entropy'] .nav-button-label {
  font-family: var(--font-theme-mono);
  font-size: 0.7rem;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

/* Settings Button Group */
[data-theme='entropy'] .settings-button-group {
  margin-top: auto;
  padding: var(--settings-button-group-padding);
  margin: var(--settings-button-group-margin);
  border-radius: 4px;
  background-color: #111;
  background-image: repeating-linear-gradient(-45deg,
      #1a1a1a,
      #1a1a1a 8px,
      #0f0f0f 8px,
      #0f0f0f 16px);
  border: 1px solid #000;
  box-shadow: inset 0 1px 4px rgba(0, 0, 0, 0.8);
}

/* Settings Button */
[data-theme='entropy'] .settings-button {
  width: 100%;
  height: var(--settings-button-height);
  padding: var(--settings-button-padding);
  gap: var(--settings-button-gap);
  background: #b91c1c;
  border: 1px solid #7f1d1d;
  border-radius: 2px;
  color: rgba(255, 255, 255, 0.9);
  font-family: var(--font-theme-mono);
  font-weight: 700;
  font-size: 0.7rem;
  letter-spacing: 0.15em;
  text-transform: uppercase;
  text-shadow: 0 -1px 0 rgba(0, 0, 0, 0.5);
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.15),
    inset 0 -1px 0 rgba(0, 0, 0, 0.2),
    0 4px 0 #7f1d1d,
    0 6px 6px rgba(0, 0, 0, 0.5);
  transition: transform 0.05s linear, box-shadow 0.05s linear, background 0.1s;
  cursor: pointer;
}

[data-theme='entropy'] .settings-button:hover {
  background: #c53030;
}

[data-theme='entropy'] .settings-button:active {
  transform: none;
  box-shadow:
    inset 0 2px 8px rgba(0, 0, 0, 0.6),
    0 0 0 #7f1d1d,
    0 0 2px rgba(0, 0, 0, 0.5);
  border-color: rgba(0, 0, 0, 0.5);
  color: rgba(255, 255, 255, 0.7);
}

[data-theme='entropy'] .settings-button .nav-button-icon {
  display: none;
}

/* Panel Viewport */
[data-theme='entropy'] .panel-viewport {
  position: relative;
  height: 100%;
}

/* ========================================
   Shared class contract
   ======================================== */

/* 음각 텍스트 효과 */
[data-theme='entropy'] .engraved-label {
  font-family: var(--font-theme-mono, var(--font-mono, monospace));
  font-size: 0.65rem;
  color: rgba(0, 0, 0, 0.5);
  text-transform: uppercase;
  letter-spacing: 1.5px;
  text-shadow: 1px 1px 0px rgba(255, 255, 255, 0.1);
  pointer-events: none;
}

@keyframes ui-rail-scrape {
  0% {
    opacity: 0;
    transform: translateX(-8px);
  }

  25% {
    opacity: 0.55;
  }

  100% {
    opacity: 0;
    transform: translateX(10px);
  }
}

/* 레거시 호환 */
[data-theme='entropy'] .ui-module.ui-module--controls {
  padding: 10px 8px;
}

[data-theme='entropy'] .ui-panel-window {
  flex: 1;
  min-width: 0;
  min-height: 0;
  border-radius: 10px;
  background-color: var(--color-surface);
  box-shadow:
    inset 2px 2px 4px rgba(0, 0, 0, 0.35),
    inset -1px -1px 2px var(--console-plastic-light);
  border: 0;
  overflow: hidden;
}

[data-theme='entropy'] {
  /* --- LAYOUT CONFIGURATION --- */
  --sidebar-ratio: 10%;
  --sidebar-spacing: var(--density-compact-p);
  --sidebar-gap: var(--density-compact-gap);

  /* Global Overrides */
  background-color: var(--color-background);

  /* Glow Variables (used by shadows) */
  --ui-panel-glow-blur: 45px;
  --ui-panel-glow-color: rgba(255, 255, 255, 0.65);
}

[data-theme='entropy'] .ui-panel-inset {
  background-color: var(--color-surface-elevated);
  border-radius: 8px;
  box-shadow:
    inset 2px 2px 4px rgba(0, 0, 0, 0.4),
    inset -1px -1px 2px var(--console-plastic-light);
}

/* Side controls */
[data-theme='entropy'] .ui-side-controls {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 10px 0;
}

[data-theme='entropy'] .ui-ctrl-btn {
  position: relative;
  width: 100%;
  aspect-ratio: 1 / 1;
  --btn-rgb: 255, 60, 0;
  --btn-radius: 6px;
  background:
    radial-gradient(circle at 50% 62%, rgba(255, 255, 255, 0.22) 0%, rgba(255, 255, 255, 0) 46%),
    radial-gradient(circle at 50% 50%, rgba(255, 255, 255, 0.12) 0%, rgba(255, 255, 255, 0) 60%),
    radial-gradient(circle at 50% 50%, #c7c7c7 0%, #bbbbbb 62%, #b0b0b0 100%);
  border: 1px solid rgba(0, 0, 0, 0.18);
  border-radius: var(--btn-radius);
  color: rgba(20, 20, 20, 0.9);
  text-shadow: 0 1px 0 rgba(255, 255, 255, 0.55);
  font-family: var(--font-theme-mono);
  font-size: 0.7rem;
  letter-spacing: 0.08em;
  cursor: pointer;
  isolation: isolate;
  overflow: hidden;
  outline: none;
  box-shadow:
    0 0 0 1px rgba(0, 0, 0, 0.16),
    0 1px 2px rgba(0, 0, 0, 0.2),
    inset 0 1px 0 rgba(255, 255, 255, 0.5),
    inset 0 -1px 0 rgba(0, 0, 0, 0.1),
    inset 0 0 10px rgba(255, 255, 255, 0.18),
    inset 0 0 22px rgba(255, 255, 255, 0.08);
  transition: transform 0.12s ease, box-shadow 0.12s ease, color 0.12s ease, filter 0.12s ease;
  display: flex;
  align-items: center;
  justify-content: center;
  text-transform: uppercase;
}

[data-theme='entropy'] .ui-ctrl-btn::before {
  content: '';
  position: absolute;
  inset: 2px;
  border-radius: calc(var(--btn-radius) - 2px);
  background:
    linear-gradient(180deg, rgba(255, 255, 255, 0.22), rgba(255, 255, 255, 0) 58%),
    radial-gradient(circle at 50% 62%, rgba(255, 255, 255, 0.16) 0%, rgba(255, 255, 255, 0) 64%);
  box-shadow:
    inset 0 0 0 1px rgba(255, 255, 255, 0.18),
    inset 0 0 10px rgba(0, 0, 0, 0.05);
  opacity: 1;
  pointer-events: none;
}

[data-theme='entropy'] .ui-ctrl-btn::after {
  content: '';
  position: absolute;
  inset: 1px;
  border-radius: calc(var(--btn-radius) - 1px);
  background:
    radial-gradient(circle at 50% 50%,
      rgba(255, 255, 255, 0) 68%,
      rgba(255, 255, 255, 0.18) 80%,
      rgba(255, 255, 255, 0) 95%);
  opacity: 0.28;
  pointer-events: none;
}

[data-theme='entropy'] .ui-ctrl-btn:hover:not(:active):not(.is-active) {
  filter: brightness(1.01);
  box-shadow:
    0 0 0 1px rgba(0, 0, 0, 0.18),
    0 2px 4px rgba(0, 0, 0, 0.22),
    inset 0 1px 0 rgba(255, 255, 255, 0.55),
    inset 0 -1px 0 rgba(0, 0, 0, 0.12),
    inset 0 0 12px rgba(255, 255, 255, 0.18);
}

[data-theme='entropy'] .ui-ctrl-btn:focus-visible {
  box-shadow:
    0 0 0 1px rgba(0, 0, 0, 0.24),
    0 0 0 3px rgba(var(--btn-rgb), 0.26),
    0 3px 6px rgba(0, 0, 0, 0.28),
    inset 0 0 0 1px rgba(255, 255, 255, 0.3),
    inset 0 -1px 0 rgba(0, 0, 0, 0.14);
}

[data-theme='entropy'] .ui-ctrl-btn:active,
[data-theme='entropy'] .ui-ctrl-btn.is-active {
  transform: none;
  background: radial-gradient(circle, rgba(var(--btn-rgb), 0.6) 0%, rgba(20, 20, 20, 1) 100%);
  color: #fff;
  box-shadow:
    0 0 0 1px #111,
    inset 0 0 20px rgba(var(--btn-rgb), 0.8),
    inset 0 0 40px rgba(var(--btn-rgb), 0.25),
    inset 0 0 0 1px rgba(255, 255, 255, 0.08),
    0 0 15px rgba(var(--btn-rgb), 0.4),
    0 2px 0 #050505;
  border-color: rgba(var(--btn-rgb), 0.5);
  text-shadow: 0 0 8px rgba(255, 255, 255, 0.9);
  animation: none;
}

[data-theme='entropy'] .ui-ctrl-btn:active::before,
[data-theme='entropy'] .ui-ctrl-btn.is-active::before {
  background:
    radial-gradient(circle at 50% 14%, rgba(255, 255, 255, 0.22) 0%, rgba(255, 255, 255, 0) 38%),
    radial-gradient(circle at 50% 70%, rgba(var(--btn-rgb), 0.22) 0%, rgba(255, 255, 255, 0) 68%),
    linear-gradient(180deg, rgba(255, 255, 255, 0.12), rgba(255, 255, 255, 0) 58%);
  box-shadow:
    inset 0 0 0 1px rgba(255, 255, 255, 0.1),
    inset 0 -10px 18px rgba(0, 0, 0, 0.38);
  opacity: 1;
}

[data-theme='entropy'] .ui-ctrl-btn:active::after,
[data-theme='entropy'] .ui-ctrl-btn.is-active::after {
  background: radial-gradient(circle at 50% 55%,
      rgba(var(--btn-rgb), 0) 0%,
      rgba(var(--btn-rgb), 0.1) 48%,
      rgba(var(--btn-rgb), 0.28) 74%,
      rgba(var(--btn-rgb), 0) 100%);
  opacity: 0.9;
}

[data-theme='entropy'] .ui-ctrl-btn:disabled,
[data-theme='entropy'] .ui-ctrl-btn.is-disabled {
  cursor: not-allowed;
  opacity: 0.55;
  filter: grayscale(0.2) contrast(0.95);
}

[data-theme='entropy'] .ui-ctrl-btn:active:nth-child(1),
[data-theme='entropy'] .ui-ctrl-btn.is-active:nth-child(1) {
  animation-delay: -1.2s;
}

[data-theme='entropy'] .ui-ctrl-btn:active:nth-child(2),
[data-theme='entropy'] .ui-ctrl-btn.is-active:nth-child(2) {
  animation-delay: -4.5s;
}

[data-theme='entropy'] .ui-ctrl-btn:active:nth-child(3),
[data-theme='entropy'] .ui-ctrl-btn.is-active:nth-child(3) {
  animation-delay: -8.1s;
}

[data-theme='entropy'] .ui-ctrl-btn:active:nth-child(4),
[data-theme='entropy'] .ui-ctrl-btn.is-active:nth-child(4) {
  animation-delay: -2.7s;
}

@keyframes ui-btn-flicker {
  0%, 96%, 100% { filter: brightness(1); }
  96.1% { filter: brightness(0.4); }
  96.2% { filter: brightness(1.3); }
  96.3% { filter: brightness(0.7); }
  96.4% { filter: brightness(1.1); }
  96.5% { filter: brightness(1); }
}

@media (prefers-reduced-motion: reduce) {
  [data-theme='entropy'] .ui-ctrl-btn,
  [data-theme='entropy'] .nav-button {
    transition: none;
  }

  [data-theme='entropy'] .ui-ctrl-btn:active,
  [data-theme='entropy'] .ui-ctrl-btn.is-active {
    animation: none;
  }
}

[data-theme='entropy'] .ui-ctrl-btn.ui-ctrl-btn--accent {
  --btn-rgb: 255, 60, 0;
}

[data-theme='entropy'] .ui-btn-lamp {
  display: none;
}

[data-theme='entropy'] .ui-action-group {
  margin-top: auto;
  padding: 6px;
  border-radius: 4px;
  background-color: #111;
  background-image: repeating-linear-gradient(-45deg,
      #1a1a1a,
      #1a1a1a 8px,
      #0f0f0f 8px,
      #0f0f0f 16px);
  border: 1px solid #000;
  box-shadow: inset 0 1px 4px rgba(0, 0, 0, 0.8);
}

[data-theme='entropy'] .ui-action-danger {
  width: 100%;
  height: 42px;
  background: #b91c1c;
  border: 1px solid #7f1d1d;
  border-radius: 2px;
  color: rgba(255, 255, 255, 0.9);
  font-family: var(--font-theme-mono);
  font-weight: 700;
  font-size: 0.7rem;
  letter-spacing: 0.15em;
  text-transform: uppercase;
  text-shadow: 0 -1px 0 rgba(0, 0, 0, 0.5);
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.15),
    inset 0 -1px 0 rgba(0, 0, 0, 0.2),
    0 4px 0 #7f1d1d,
    0 6px 6px rgba(0, 0, 0, 0.5);
  transition: transform 0.05s linear, box-shadow 0.05s linear, background 0.1s;
  cursor: pointer;
}

[data-theme='entropy'] .ui-action-danger:hover {
  background: #c53030;
}

[data-theme='entropy'] .ui-action-danger:active {
  transform: none;
  box-shadow:
    inset 0 2px 8px rgba(0, 0, 0, 0.6),
    0 0 0 #7f1d1d,
    0 0 2px rgba(0, 0, 0, 0.5);
  border-color: rgba(0, 0, 0, 0.5);
  color: rgba(255, 255, 255, 0.7);
}

/* CRT Module Base */
[data-theme='entropy'] .ui-frame {
  width: 100%;
  height: 100%;
  background: #000;
  border-radius: 16px;
  padding: 16px;
  overflow: visible;
  position: relative;
  box-shadow:
    inset 0 0 30px rgba(0, 0, 0, 0.9),
    inset 0 0 0 4px #333,
    0 10px 20px rgba(0, 0, 0, 0.5),
    0 0 40px rgba(255, 119, 0, 0.1);
  border: 6px solid #222;
  border-top-color: #333;
  border-left-color: #333;
  border-right-color: #111;
  border-bottom-color: #111;
}

[data-theme='entropy'] .ui-frame--scope {
  border-radius: 50%;
  aspect-ratio: 1 / 1;
  height: 100%;
  width: auto;
  max-width: 100%;
  max-height: 100%;
  justify-self: center;
  align-self: center;
  display: flex;
  align-items: center;
  justify-content: center;
}

[data-theme='entropy'] .ui-frame--terminal {
  border-radius: 4px;
  border: 0;
  background: #202020;
  box-shadow:
    0 0 0 1px #000,
    inset 0 1px 0 rgba(255, 255, 255, 0.15),
    inset 0 -1px 0 rgba(0, 0, 0, 0.5),
    inset 2px 0 0 rgba(255, 255, 255, 0.05),
    inset -2px 0 0 rgba(0, 0, 0, 0.5);
  padding: 6px;
  display: flex;
  flex-direction: column;
}

[data-theme='entropy'] .ui-crt-screen {
  width: 100%;
  height: 100%;
  background: var(--crt-black, #0a0a08);
  border-radius: 12px;
  position: relative;
  overflow: hidden;
  color: var(--console-accent);
  text-shadow: 0 0 8px rgba(255, 77, 0, 0.4);
  box-shadow:
    inset 0 0 40px rgba(0, 0, 0, 0.9),
    inset 0 0 0 1px rgba(255, 77, 0, 0.1),
    0 0 30px rgba(255, 119, 0, 0.2);
  background-image: none;
}

[data-theme='entropy'] .ui-frame--scope .ui-crt-screen {
  border-radius: 50%;
}

[data-theme='entropy'] .ui-frame--terminal .ui-crt-screen {
  border-radius: 2px;
  background: #000000;
  color: var(--console-accent);
  text-shadow: none;
  border: 1px solid #000;
  box-shadow:
    inset 0 0 20px rgba(0, 0, 0, 1),
    inset 0 1px 0 rgba(255, 255, 255, 0.2);
}

[data-theme='entropy'] .ui-frame--terminal .ui-crt-screen::after {
  content: '';
  position: absolute;
  inset: 0;
  background: linear-gradient(180deg,
      rgba(255, 255, 255, 0.08) 0%,
      rgba(255, 255, 255, 0.02) 20%,
      transparent 100%);
  pointer-events: none;
  z-index: 10;
}

[data-theme='entropy'] .ui-focus-monitor {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 12px;
  background: rgba(0, 0, 0, 0.3);
  border-top: 1px solid rgba(255, 77, 0, 0.2);
}

[data-theme='entropy'] .ui-graph-container {
  flex: 1;
  position: relative;
  border: 1px solid rgba(255, 77, 0, 0.1);
  background-image:
    linear-gradient(rgba(255, 77, 0, 0.05) 1px, transparent 1px),
    linear-gradient(90deg, rgba(255, 77, 0, 0.05) 1px, transparent 1px);
  background-size: 20px 20px;
  overflow: hidden;
}

[data-theme='entropy'] .ui-graph-line {
  fill: none;
  stroke: var(--console-accent);
  stroke-width: 1.5;
  filter: drop-shadow(0 0 3px rgba(255, 77, 0, 0.5));
}

[data-theme='entropy'] .ui-graph-label {
  font-family: var(--font-theme-mono);
  font-size: 9px;
  color: rgba(255, 77, 0, 0.5);
  text-transform: uppercase;
  display: flex;
  justify-content: space-between;
}

[data-theme='entropy'] .ui-sync-status {
  font-family: var(--font-theme-heading, var(--font-theme-ui, sans-serif));
  font-size: 12px;
  color: var(--console-accent);
  display: flex;
  align-items: center;
  gap: 6px;
}

[data-theme='entropy'] .ui-radar-container {
  width: 100%;
  height: 100%;
  border: 1px solid rgba(255, 77, 0, 0.2);
  border-radius: 50%;
  background:
    radial-gradient(circle at center, transparent 60%, rgba(255, 77, 0, 0.05) 100%);
  position: relative;
  overflow: hidden;
  box-shadow: inset 0 0 40px rgba(0, 0, 0, 0.8);
}

[data-theme='entropy'] .ui-data-panel {
  display: flex;
  flex-direction: column;
  gap: 16px;
  padding: 16px;
  height: 100%;
}

[data-theme='entropy'] .ui-anomaly-card {
  background: rgba(255, 77, 0, 0.03);
  border: 1px solid rgba(255, 77, 0, 0.15);
  padding: 12px 16px;
  border-radius: 4px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  transition: all 0.2s;
}

[data-theme='entropy'] .ui-anomaly-card.is-locked {
  background: rgba(255, 77, 0, 0.1);
  border-color: var(--console-accent);
  box-shadow: 0 0 10px rgba(255, 77, 0, 0.2);
  animation: ui-pulse-orange 2s infinite;
}

@keyframes ui-pulse-orange {
  0% { border-color: rgba(255, 119, 0, 0.4); }
  50% { border-color: rgba(255, 119, 0, 1); }
  100% { border-color: rgba(255, 119, 0, 0.4); }
}

[data-theme='entropy'] .ui-panel-header {
  color: var(--console-accent);
  font-size: 1rem;
  border-bottom: 1px solid rgba(255, 77, 0, 0.3);
  padding-bottom: 5px;
  margin-bottom: 12px;
  text-transform: uppercase;
  letter-spacing: 1px;
}

[data-theme='entropy'] .ui-data-value {
  font-family: var(--font-theme-heading, var(--font-theme-ui, sans-serif));
  font-size: 2.2rem;
  color: var(--console-accent);
  text-shadow: 0 0 12px rgba(255, 77, 0, 0.5);
}

[data-theme='entropy'] .ui-data-unit {
  font-size: 0.9rem;
  color: rgba(255, 77, 0, 0.6);
  margin-left: 5px;
}

@keyframes ui-scan {
  to { transform: rotate(360deg); }
}

[data-theme='entropy'] .ui-fader {
  position: relative;
  width: 100%;
  height: 32px;
  display: flex;
  align-items: center;
}

[data-theme='entropy'] .ui-fader.is-disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

[data-theme='entropy'] .ui-fader.is-disabled .ui-fader-input {
  cursor: not-allowed;
}

[data-theme='entropy'] .ui-fader-track {
  position: relative;
  width: 100%;
  height: 12px;
  background: #a0a095;
  border-radius: 12px;
  box-shadow:
    inset 3px 3px 5px rgba(0, 0, 0, 0.3),
    inset -1px -1px 1px var(--console-plastic-light);
}

[data-theme='entropy'] .ui-fader-fill {
  position: absolute;
  top: 0;
  bottom: 0;
  left: 0;
  width: var(--fader-progress, 0%);
  background: var(--color-accent);
  border-radius: 12px 0 0 12px;
  opacity: 0.25;
}

[data-theme='entropy'] .ui-fader-knob {
  position: absolute;
  top: 50%;
  left: var(--fader-progress, 0%);
  width: 26px;
  height: 20px;
  background: var(--console-bezel);
  border-radius: 4px;
  transform: translate(-50%, -50%);
  box-shadow:
    0 3px 5px rgba(0, 0, 0, 0.4),
    inset 1px 1px 1px rgba(255, 255, 255, 0.1),
    inset -1px -1px 1px rgba(0, 0, 0, 0.2);
}

[data-theme='entropy'] .ui-fader-knob::after {
  content: '';
  position: absolute;
  top: 50%;
  left: 10%;
  width: 80%;
  height: 2px;
  background: #111;
  transform: translateY(-50%);
  box-shadow: 0 1px 0 rgba(255, 255, 255, 0.1);
}

[data-theme='entropy'] .ui-fader-input {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  opacity: 0;
  cursor: pointer;
}

`;

/**
 * PROJECT: ENTROPY (Layer 2)
 * 
 * The "True" Interface. Industrial, analog, heavy.
 * Orbital instrumentation inspired by the control rooms of 2001: A Space Odyssey.
 */
export const EntropyTheme = new Theme({
  id: 'entropy',
  meta: {
    name: 'PROJECT: ENTROPY',
    description: 'Orbital Console // Precision Instrumentation',
  },
  customCSS: ENTROPY_CSS,
  tokens: {
    colors: {
      // Core (Theme-as-Data)
      primary: '#e6e8eb',
      accent: '#ff4d00',
      alert: '#cc3300',
      text: '#1a1d1f',

      // Extended palette
      background: '#050508',
      surface: '#e6e8eb',
      surfaceVariant: '#d0d2d6',
      surfaceSunken: '#10120e',
      surfaceOverlay: 'rgba(230, 232, 235, 0.95)',
      textMuted: '#4a4d50',
      textSubtle: '#6b6f72',

      accentSecondary: '#f05a00',
      accentTertiary: '#2a2d30',
      accentHover: '#ff6600',
      accentMuted: 'rgba(255, 77, 0, 0.2)',
      accentRing: 'rgba(255, 77, 0, 0.15)',
      accentGradientFrom: '#ff4d00',
      accentGradientTo: '#ff6600',
      onAccent: '#000000',

      danger: '#cc3300',
      dangerMuted: '#e04a4a',
      success: '#22c55e',
      successMuted: '#4ade80',
      warning: '#f59e0b',
      warningMuted: '#fbbf24',

      glass: 'rgba(230, 232, 235, 0.6)',
      glassBorder: 'rgba(255, 255, 255, 0.2)',
      border: 'rgba(0, 0, 0, 0.1)',
      borderMuted: 'rgba(0, 0, 0, 0.05)',
      borderStrong: 'rgba(0, 0, 0, 0.2)',
    },
    typography: {
      // Families must resolve to faces the app actually ships (see the
      // @font-face set in themes/styles/tokens/typography.css). "Share Tech
      // Mono" stays only because --font-mono already lists it as a stack
      // entry; unshipped names are not declared here.
      fontFamily: 'var(--font-sans)',
      letterSpacing: '0.01em',
      heading: 'var(--font-sans)',
      body: 'var(--font-sans)',
      mono: 'var(--font-mono)',
    },
    shapes: {
      borderRadius: '0px',
      borderStyle: '4px solid',
    },
    effects: {
      blur: '0',
      glow: '0 0 15px rgba(255, 77, 0, 0.3)',
      scanline: '0',
      noise: '0',
    },
    layout: {
      railSize: '20px',
      railBase: '#1a1a1a',
      railEdge: 'rgba(255, 255, 255, 0.1)',
      unitPadding: '12px',
      railSidebarWidth: '130px',
      frameColumns: 'var(--console-sidebar-width) minmax(0, 1fr)',
      sidebarPadding: 'var(--ui-unit-padding) calc(var(--ui-unit-padding) + var(--ui-rail-size)) var(--ui-unit-padding) var(--ui-unit-padding)',
      contentPadding: 'var(--ui-unit-padding) var(--ui-unit-padding) var(--ui-unit-padding) calc(var(--ui-unit-padding) + var(--ui-rail-size))',
      sidebarControlsGap: '12px',
      sidebarControlsPadding: '10px 0',
      navButtonAspect: '1 / 1',
      navButtonHeight: '64px',
      navButtonWidth: '64px',
      navButtonPadding: '0px',
      navButtonGap: '0px',
      navButtonMargin: '0px',
      navButtonAlign: 'center',
      settingsButtonHeight: '42px',
      settingsButtonPadding: '0px',
      settingsButtonGap: '0px',
      settingsButtonGroupPadding: '6px',
      settingsButtonGroupMargin: '0px',
    },
    shadows: {
      sm: '0 1px 2px rgba(0, 0, 0, 0.1)',
      md: '0 4px 6px rgba(0, 0, 0, 0.1)',
      lg: '0 10px 15px rgba(0, 0, 0, 0.1)',
      glass: '0 8px 32px rgba(0, 0, 0, 0.05)',
    },
    components: {
      console: {
        plasticBase: '#e6e8eb',
        plasticLight: '#ffffff',
        plasticShadow: '#d0d2d6',
        bezel: '#181a1c',
        screen: '#050505',
        accentOrange: '#ff4d00',
      },
    },
  },
  audio: {
    bgm: 'low-humming-drone.mp3',
    clickSound: 'mechanical-clunk.mp3',
    alertSound: 'siren-entropy.mp3',
    hoverSound: 'static-chirp.mp3',
  },
  behaviors: {
    lensHoverAction: 'entropy',    // Lens breaks when you look at it
    scrollPhysics: 'step',        // Rigid, mechanical scrolling
    transitionStyle: 'instant',   // Hard cuts, no fluff
    transitionDuration: 1500,     // Extended lock for industrial sequences
    cursorStyle: 'crosshair',     // Precision targeting
  },
  // Expansion Slots (Future DLC)
  slots: {
    background: 'starfield', // ✓ Implemented
    // weatherSystem: 'acid-rain', // Not implemented
    // hudStyle: 'retro-grid',     // Not implemented
  },
});
