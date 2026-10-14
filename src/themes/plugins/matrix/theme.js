import { Theme } from '../../core/base.js';

const MATRIX_CSS = `
[data-theme='matrix'] {
  /* --- Core Palette (Deep Void) --- */
  --bg-void: #000000;
  --bg-chassis: #0a0a0a;
  --bg-panel: rgba(0, 15, 0, 0.3);
  --bg-element: #0f140f;

  /* --- Terminal Palette --- */
  --terminal-primary: #00ff41;
  --terminal-dim: #008f11;
  --terminal-bright: #ccffcc;
  --terminal-alert: #ff3333;
  --terminal-warn: #ffcc00;

  /* --- UI Tokens --- */
  --frame-border: 1px solid var(--terminal-dim);
  --frame-radius: 2px;
  --radius-lg: 0px;

  /* --- Unified Theme Variable Mapping --- */
  --console-plastic-base: var(--bg-chassis);
  --color-surface: var(--bg-panel);
  --color-surface-elevated: var(--bg-element);
  --color-surface-sunken: rgba(0, 0, 0, 0.6);
  --color-border: var(--terminal-dim);
  --color-text: var(--terminal-primary);
  --color-accent: var(--terminal-primary);

  --font-theme-mono: 'VT323', monospace;

  /* --- Effects --- */
  --text-glow: 0 0 4px rgba(0, 255, 65, 0.4);
  --crt-scanline: repeating-linear-gradient(0deg,
      rgba(0, 0, 0, 0.2),
      rgba(0, 0, 0, 0.2) 1px,
      transparent 1px,
      transparent 2px);

  --entropy-shell-glow: inset 0 0 100px rgba(0, 255, 65, 0.05);
  --entropy-content-bg: transparent;
  --entropy-sidebar-title: 'MATRIX NAV';
}

/* ==========================================================================
   Shell & Frame (The Cyberdeck Chassis)
   ========================================================================== */

[data-theme='matrix'] .console-shell {
  background-color: transparent;
  border: none;
  box-shadow: var(--entropy-shell-glow);
}

[data-theme='matrix'] .console-frame {
  background: transparent;
  border: none;
  position: relative;
}

[data-theme='matrix'] .console-frame::after {
  content: '';
  position: absolute;
  inset: 0;
  background: var(--crt-scanline);
  pointer-events: none;
  z-index: 9999;
  opacity: 0.3;
}

/* ==========================================================================
   Sidebar (Tactical Menu / HUD)
   ========================================================================== */

[data-theme='matrix'] {
  --console-frame-gap: 0px;
}

[data-theme='matrix'] .console-sidebar {
  background: transparent;
  border: none;
  position: relative;
  isolation: isolate;
}

[data-theme='matrix'] .console-sidebar::before {
  content: '';
  position: absolute;
  top: 12px;
  bottom: 12px;
  right: 0;
  width: 1px;
  background: linear-gradient(180deg, transparent, rgba(0, 255, 65, 0.18), transparent);
  opacity: 0.7;
  pointer-events: none;
  z-index: 0;
}

/* ==========================================================================
   Entropy UI Components (Standardized)
   ========================================================================== */

[data-theme='matrix'] .entropy-input {
  background: rgba(0, 15, 0, 0.3);
  border: none;
  border-bottom: 1px solid var(--terminal-dim);
  color: var(--terminal-primary);
  font-family: var(--font-theme-mono);
  text-transform: uppercase;
  letter-spacing: 0.1em;
  transition: all 0.2s ease;
}

[data-theme='matrix'] .entropy-input:focus {
  border-bottom-color: var(--terminal-bright);
  background: rgba(0, 30, 0, 0.5);
  box-shadow: 0 4px 12px -4px var(--terminal-primary);
  outline: none;
}

[data-theme='matrix'] :is(.ui-btn, .entropy-btn) {
  background: transparent;
  border: 1px solid rgba(0, 255, 65, 0.3);
  color: var(--terminal-dim);
  text-transform: uppercase;
  font-family: var(--font-theme-mono);
  letter-spacing: 0.1em;
  cursor: pointer;
  transition: all 0.2s;
}

[data-theme='matrix'] :is(.ui-btn, .entropy-btn):hover {
  border-color: var(--terminal-primary);
  color: var(--terminal-primary);
  box-shadow: 0 0 8px rgba(0, 255, 65, 0.2);
  text-shadow: 0 0 4px var(--terminal-primary);
}

[data-theme='matrix'] :is(.ui-btn, .entropy-btn).active {
  background: var(--terminal-primary);
  color: #000;
  border-color: var(--terminal-primary);
  box-shadow: 0 0 12px var(--terminal-primary);
  text-shadow: none;
  font-weight: bold;
}

[data-theme='matrix'] .entropy-badge {
  font-family: var(--font-theme-mono);
  text-transform: uppercase;
  letter-spacing: 0.1em;
  border: 1px solid currentColor;
  padding: 2px 8px;
  font-size: 0.7em;
  background: rgba(0, 0, 0, 0.4);
}

/* --- Semantic UI Framework (Theme Impl) --- */

[data-theme='matrix'] .ui-panel {
  background: rgba(0, 15, 0, 0.3);
  border: 1px solid rgba(0, 143, 17, 0.3);
  box-shadow: 0 0 4px rgba(0, 255, 65, 0.05);
}

[data-theme='matrix'] .ui-panel-sunken {
  background: rgba(0, 10, 0, 0.4);
  border: 1px solid rgba(0, 143, 17, 0.15);
}

[data-theme='matrix'] .ui-divider {
  border-color: rgba(0, 143, 17, 0.3);
}

[data-theme='matrix'] .ui-header-text {
  font-family: var(--font-theme-mono);
  font-weight: 900;
  text-transform: uppercase;
  letter-spacing: 0.2em;
  color: var(--terminal-dim);
}

[data-theme='matrix'] .ui-label-text {
  font-family: var(--font-theme-mono);
  font-size: 0.65rem;
  text-transform: uppercase;
  letter-spacing: 0.2em;
  color: rgba(0, 255, 65, 0.5);
}

[data-theme='matrix'] .ui-input {
  background: transparent;
  border: none;
  border-bottom: 1px solid rgba(0, 143, 17, 0.3);
  color: var(--terminal-primary);
  font-family: var(--font-theme-mono);
  outline: none;
  transition: border-color 0.2s;
}

[data-theme='matrix'] .ui-input:focus {
  border-color: var(--terminal-primary);
  box-shadow: 0 4px 6px -4px rgba(0, 255, 65, 0.1);
}

[data-theme='matrix'] .ui-input-alert {
  background: transparent;
  border: none;
  border-bottom: 1px solid rgba(255, 51, 51, 0.3);
  color: var(--terminal-alert);
  font-family: var(--font-theme-mono);
  outline: none;
  transition: border-color 0.2s;
}

[data-theme='matrix'] .ui-input-alert:focus {
  border-color: var(--terminal-alert);
  box-shadow: 0 4px 6px -4px rgba(255, 51, 51, 0.1);
}

/* Shared utility classes */
[data-theme='matrix'] .entropy-panel {
  background: rgba(0, 15, 0, 0.3);
  border: 1px solid rgba(0, 143, 17, 0.3);
  box-shadow: 0 0 4px rgba(0, 255, 65, 0.05);
}

/* Decorative "Connectors" */
[data-theme='matrix'] .console-sidebar::after,
[data-theme='matrix'] .console-content::before {
  display: none;
}

/* ==========================================================================
   Content Panel (Main Display)
   ========================================================================== */

[data-theme='matrix'] .console-content {
  background: var(--entropy-content-bg);
  padding: 0;
}

[data-theme='matrix'] .console-content::after {
  display: none;
}

[data-theme='matrix'] .console-content::before {
  display: none;
}

[data-theme='matrix'] .panel-viewport {
  background: transparent;
  border-radius: 0;
  box-shadow: none;
  padding: 0;
}

[data-theme='matrix'] .panel-viewport>* {
  background: transparent;
  color: var(--terminal-primary);
  font-family: var(--font-theme-mono);
  text-shadow: var(--text-glow);
}

[data-theme='matrix'] .panel-viewport>*::before {
  display: none;
}

[data-theme='matrix'] .panel-viewport>*::after {
  display: none;
}

/* ==========================================================================
   HUD Layout Overrides
   ========================================================================== */

[data-theme='matrix'] .main-tab-core>div,
[data-theme='matrix'] .main-tab-radar .radar-panel,
[data-theme='matrix'] .main-tab-target>div,
[data-theme='matrix'] .main-tab-bottom {
  background: transparent !important;
  border: none !important;
  box-shadow: none !important;
  position: relative;
  overflow: visible !important;
}

/* Corner Brackets */
[data-theme='matrix'] .main-tab-core>div::before,
[data-theme='matrix'] .main-tab-radar .radar-panel::before,
[data-theme='matrix'] .main-tab-target>div::before,
[data-theme='matrix'] .main-tab-bottom::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  width: 8px;
  height: 8px;
  border-top: 1px solid var(--terminal-dim);
  border-left: 1px solid var(--terminal-dim);
  opacity: 0.5;
  z-index: 10;
  pointer-events: none;
  transition: all 0.3s ease;
}

[data-theme='matrix'] .main-tab-core>div::after,
[data-theme='matrix'] .main-tab-radar .radar-panel::after,
[data-theme='matrix'] .main-tab-target>div::after,
[data-theme='matrix'] .main-tab-bottom::after {
  content: '';
  position: absolute;
  bottom: 0;
  right: 0;
  width: 8px;
  height: 8px;
  border-bottom: 1px solid var(--terminal-dim);
  border-right: 1px solid var(--terminal-dim);
  opacity: 0.5;
  z-index: 10;
  pointer-events: none;
  transition: all 0.3s ease;
}

[data-theme='matrix'] .main-tab-core>div:hover::before,
[data-theme='matrix'] .main-tab-radar .radar-panel:hover::before,
[data-theme='matrix'] .main-tab-target>div:hover::before,
[data-theme='matrix'] .main-tab-bottom:hover::before,
[data-theme='matrix'] .main-tab-core>div:hover::after,
[data-theme='matrix'] .main-tab-radar .radar-panel:hover::after,
[data-theme='matrix'] .main-tab-target>div:hover::after,
[data-theme='matrix'] .main-tab-bottom:hover::after {
  opacity: 1;
  border-color: var(--terminal-primary);
  width: 12px;
  height: 12px;
}

[data-theme='matrix'] .widget-value {
  font-size: 2rem;
  font-weight: bold;
  color: var(--terminal-primary);
  text-shadow: var(--text-glow);
  margin-top: auto;
  margin-bottom: auto;
}

[data-theme='matrix'] .widget-subtext {
  font-size: 0.8rem;
  color: var(--terminal-dim);
  margin-top: 4px;
}

/* ==========================================================================
   Navigation Buttons
   ========================================================================== */

[data-theme='matrix'] .nav-button {
  width: 100%;
  height: 60px !important;
  aspect-ratio: unset;
  margin-bottom: 10px;
  background: rgba(0, 255, 65, 0.05);
  border: 1px solid var(--terminal-dim);
  border-left: 4px solid var(--terminal-dim);
  border-radius: 0;
  color: var(--terminal-dim);
  font-family: var(--font-theme-mono);
  font-weight: bold;
  font-size: 1rem;
  text-transform: uppercase;
  letter-spacing: 1px;
  box-shadow: none;
  transition: all 0.2s ease;
  display: flex;
  align-items: center;
  justify-content: flex-start;
  gap: var(--nav-button-gap);
  padding: var(--nav-button-padding);
}

[data-theme='matrix'] .nav-button:hover:not(:disabled) {
  background: rgba(0, 255, 65, 0.1);
  color: var(--terminal-primary);
  border-color: var(--terminal-primary);
  text-shadow: var(--text-glow);
  box-shadow: inset 0 0 10px rgba(0, 255, 65, 0.1);
}

[data-theme='matrix'] .nav-button.is-active,
[data-theme='matrix'] .nav-button:active:not(:disabled) {
  background: var(--terminal-primary);
  color: #000;
  border-color: var(--terminal-primary);
  border-left-width: 8px;
  box-shadow: 0 0 15px rgba(0, 255, 65, 0.4);
  transform: none;
}

[data-theme='matrix'] .nav-button-label {
  text-shadow: inherit;
  font-size: 14px;
  line-height: 1.25;
  letter-spacing: 0;
  white-space: nowrap;
}

[data-theme='matrix'] .nav-button-label::before {
  content: '[';
  margin-right: 2px;
  opacity: 0;
}

[data-theme='matrix'] .nav-button-label::after {
  content: ']';
  margin-left: 2px;
  opacity: 0;
}

[data-theme='matrix'] .nav-button-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 18px;
  height: 18px;
  opacity: 0.65;
}

[data-theme='matrix'] .nav-button:hover:not(:disabled) .nav-button-icon,
[data-theme='matrix'] .nav-button.is-active .nav-button-icon {
  opacity: 1;
}

[data-theme='matrix'] .sidebar-controls {
  position: relative;
  z-index: 1;
  gap: 10px;
  padding: 28px 0 0 0;
}

[data-theme='matrix'] .nav-button-lamp {
  display: none;
}

[data-theme='matrix'] .sidebar-controls::before {
  content: var(--entropy-sidebar-title, 'MATRIX NAV');
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  padding: 0 0 10px 20px;
  font-family: var(--font-theme-mono);
  font-size: 0.7rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.22em;
  color: rgba(0, 255, 65, 0.45);
  border-bottom: 1px solid rgba(0, 255, 65, 0.12);
  pointer-events: none;
}

[data-theme='matrix'] .nav-button:hover:not(:disabled) .nav-button-label::before,
[data-theme='matrix'] .nav-button:hover:not(:disabled) .nav-button-label::after,
[data-theme='matrix'] .nav-button.is-active .nav-button-label::before,
[data-theme='matrix'] .nav-button.is-active .nav-button-label::after {
  opacity: 0.45;
}

[data-theme='matrix'] .settings-button {
  background: transparent;
  border: 1px solid var(--terminal-dim);
  border-radius: 0;
  height: 40px;
  color: var(--terminal-dim);
  font-family: var(--font-theme-heading, var(--font-theme-mono, monospace));
  font-size: 1.1rem;
  font-weight: bold;
  text-transform: uppercase;
  justify-content: flex-start;
  padding-left: 20px;
  gap: 10px;
}

[data-theme='matrix'] .settings-button:hover,
[data-theme='matrix'] .settings-button:active {
  background: rgba(255, 51, 51, 0.1);
  border-color: var(--terminal-alert);
  color: var(--terminal-alert);
  box-shadow: 0 0 10px rgba(255, 51, 51, 0.2);
}

[data-theme='matrix'] .settings-button:hover .nav-button-icon,
[data-theme='matrix'] .settings-button:active .nav-button-icon,
[data-theme='matrix'] .settings-button.is-active .nav-button-icon {
  opacity: 1;
}

[data-theme='matrix'] .settings-button-group {
  background: transparent;
  border: none;
  box-shadow: none;
  padding: 0;
  margin-top: 14px;
  padding-top: 14px;
  border-top: 1px solid rgba(0, 255, 65, 0.12);
}

/* ==========================================================================
   Internal Component Overrides
   ========================================================================== */

[data-theme='matrix'] .border-border-strong {
  border-color: var(--terminal-primary);
  box-shadow: 0 0 5px rgba(0, 255, 65, 0.3);
}

[data-theme='matrix'] .border-border {
  border-color: var(--terminal-dim);
}

[data-theme='matrix'] ::-webkit-scrollbar {
  width: 8px;
}

[data-theme='matrix'] ::-webkit-scrollbar-track {
  background: var(--bg-element);
  border-left: 1px solid var(--terminal-dim);
}

[data-theme='matrix'] ::-webkit-scrollbar-thumb {
  background: var(--terminal-dim);
  border: none;
}

[data-theme='matrix'] ::-webkit-scrollbar-thumb:hover {
  background: var(--terminal-primary);
}

/* ==========================================================================
   Signal Scanner (Radar) Customization
   ========================================================================== */

[data-theme='matrix'] .signal-scanner-wrapper {
  background: transparent !important;
  border: none !important;
  border-radius: 0 !important;
  box-shadow: none !important;
  border-color: rgba(0, 255, 65, 0.2) !important;
}

[data-theme='matrix'] .radar-viewport {
  border-radius: 0;
  overflow: hidden;
  background-color: rgba(0, 8, 0, 0.9);
  background-image:
    repeating-linear-gradient(0deg,
      rgba(0, 255, 65, 0.05),
      rgba(0, 255, 65, 0.05) 1px,
      transparent 1px,
      transparent 10px),
    repeating-linear-gradient(90deg,
      rgba(0, 255, 65, 0.05),
      rgba(0, 255, 65, 0.05) 1px,
      transparent 1px,
      transparent 10px);
  box-shadow:
    inset 0 0 24px rgba(0, 255, 65, 0.12),
    inset 0 0 60px rgba(0, 0, 0, 0.8);
  clip-path: polygon(10% 0, 90% 0, 100% 10%, 100% 90%, 90% 100%, 10% 100%, 0 90%, 0 10%);
}

[data-theme='matrix'] .radar-frame::before {
  content: '';
  position: absolute;
  inset: 0;
  border-radius: 0;
  border: 1px solid rgba(0, 255, 65, 0.22);
  box-shadow:
    0 0 10px rgba(0, 255, 65, 0.12),
    inset 0 0 14px rgba(0, 255, 65, 0.08);
  pointer-events: none;
  clip-path: polygon(10% 0, 90% 0, 100% 10%, 100% 90%, 90% 100%, 10% 100%, 0 90%, 0 10%);
}

[data-theme='matrix'] .radar-frame::after {
  content: '';
  position: absolute;
  inset: 0;
  border-radius: 0;
  background:
    radial-gradient(circle, rgba(0, 0, 0, 0) 55%, rgba(0, 0, 0, 0.7) 100%);
  pointer-events: none;
  clip-path: polygon(10% 0, 90% 0, 100% 10%, 100% 90%, 90% 100%, 10% 100%, 0 90%, 0 10%);
}

[data-theme='matrix'] .scanner-grid {
  gap: 0;
  background: transparent;
  border: none;
}

[data-theme='matrix'] .radar-section {
  background: transparent !important;
  border-right: 1px solid rgba(0, 255, 65, 0.15) !important;
}

[data-theme='matrix'] .anomaly-section {
  background: rgba(0, 10, 0, 0.3) !important;
}

[data-theme='matrix'] .ui-anomaly-card {
  background: transparent;
  border: 1px solid var(--terminal-dim);
  border-radius: 0;
  margin-bottom: 8px;
  padding: 8px;
  transition: all 0.2s ease;
  position: relative;
}

[data-theme='matrix'] .ui-anomaly-card:hover {
  background: rgba(0, 255, 65, 0.1);
  border-color: var(--terminal-primary);
  box-shadow: 0 0 10px rgba(0, 255, 65, 0.1);
}

[data-theme='matrix'] .ui-anomaly-card.is-locked {
  background: rgba(0, 255, 65, 0.2);
  border-color: var(--terminal-primary);
  box-shadow: 0 0 15px rgba(0, 255, 65, 0.2);
}

[data-theme='matrix'] .ui-anomaly-card.is-locked::before {
  content: '>>';
  position: absolute;
  left: -12px;
  color: var(--terminal-primary);
  font-weight: bold;
  animation: blink 1s infinite;
}

[data-theme='matrix'] .bg-surface-elevated {
  background-color: rgba(0, 255, 65, 0.02) !important;
  border: none !important;
  box-shadow: none !important;
  backdrop-filter: blur(4px);
}

[data-theme='matrix'] .border-border {
  border-color: rgba(0, 255, 65, 0.1) !important;
}

[data-theme='matrix'] .bg-surface-elevated::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  width: 12px;
  height: 12px;
  border-top: 1px solid var(--terminal-primary);
  border-left: 1px solid var(--terminal-primary);
  opacity: 0.4;
  pointer-events: none;
}

[data-theme='matrix'] .bg-surface-elevated::after {
  content: '';
  position: absolute;
  bottom: 0;
  right: 0;
  width: 12px;
  height: 12px;
  border-bottom: 1px solid var(--terminal-primary);
  border-right: 1px solid var(--terminal-primary);
  opacity: 0.4;
  pointer-events: none;
}

/* ==========================================================================
   View Transitions (Scanwipe) - Matrix Exclusive
   ========================================================================== */

@keyframes matrix-exit {
  0% {
    opacity: 1;
    transform: translateX(0);
    filter: blur(0);
  }

  20% {
    opacity: 0.8;
    transform: translateX(-5px);
    filter: blur(2px);
  }

  100% {
    opacity: 0;
    transform: translateX(20px);
    filter: blur(5px);
  }
}

@keyframes matrix-enter {
  0% {
    opacity: 0;
    transform: translateX(-20px);
    filter: blur(5px);
  }

  80% {
    opacity: 0.8;
    transform: translateX(5px);
    filter: blur(2px);
  }

  100% {
    opacity: 1;
    transform: translateX(0);
    filter: blur(0);
  }
}

/* Laser Wipe Line */
[data-theme='matrix'] :is(.transition-scan-line, .entropy-laser-line) {
  position: absolute;
  top: 0;
  bottom: 0;
  width: 2px;
  background: var(--terminal-primary);
  box-shadow: 0 0 15px var(--terminal-primary), 0 0 30px var(--terminal-primary);
  z-index: 20;
  pointer-events: none;
}

[data-theme='matrix'] :is(.transition-scan-line-heavy, .entropy-laser-line-heavy) {
  position: absolute;
  top: 0;
  bottom: 0;
  width: 4px;
  background: var(--terminal-primary);
  box-shadow: 0 0 20px var(--terminal-primary), 0 0 40px var(--terminal-primary);
  z-index: 10000;
  pointer-events: none;
}

`;

/**
 * PROJECT: MATRIX
 * 
 * The Classic Hacker Aesthetic.
 * Digital rain, phosphor green, terminal vibes.
 */
export const MatrixTheme = new Theme({
  id: 'matrix',
  meta: {
    name: 'PROJECT: MATRIX',
    description: 'System Root // Digital Rain',
  },
  customCSS: MATRIX_CSS,
  tokens: {
    colors: {
      // Core
      primary: '#050805',
      accent: '#00ff41',
      alert: '#ff3333',
      text: '#00ff41',

      // Extended palette
      background: '#000000',
      surface: 'rgba(0, 15, 0, 0.3)',
      surfaceVariant: '#0f140f',
      surfaceSunken: 'rgba(0, 0, 0, 0.6)',
      surfaceOverlay: 'rgba(0, 255, 65, 0.06)',
      textMuted: '#008f11',
      textSubtle: '#1f5a2a',

      accentSecondary: '#00c93c',
      accentTertiary: '#0b1a0f',
      accentHover: '#66ff66',
      accentMuted: 'rgba(0, 255, 65, 0.25)',
      accentRing: 'rgba(0, 255, 65, 0.2)',
      accentGradientFrom: '#00ff41',
      accentGradientTo: '#009b2f',
      onAccent: '#000000',

      danger: '#ff3333',
      dangerMuted: '#cc0000',
      success: '#00ff41',
      successMuted: '#1a8f1a',
      warning: '#ffcc00',
      warningMuted: '#cc7a00',

      glass: 'rgba(0, 255, 65, 0.04)',
      glassBorder: 'rgba(0, 255, 65, 0.12)',
      border: '#008f11',
      borderMuted: 'rgba(0, 143, 17, 0.3)',
      borderStrong: '#00ff41',
    },
    typography: {
      fontFamily: '"VT323", var(--font-mono)',
      letterSpacing: '0.02em',
      heading: '"VT323", var(--font-mono)',
      body: '"VT323", var(--font-mono)',
      mono: '"Share Tech Mono", var(--font-mono)',
    },
    shapes: {
      borderRadius: '4px',
      borderStyle: 'solid',
    },
    effects: {
      blur: '1px',
      glow: '0 0 5px rgba(51, 255, 51, 0.5)',
      scanline: 'linear-gradient(to bottom, transparent, rgba(51, 255, 51, 0.1), transparent)',
      noise: '0.05',
    },
    layout: {
      shellPadding: '0px',
      railSize: '20px',
      railBase: 'rgba(0, 255, 65, 0.08)',
      railEdge: 'rgba(0, 255, 65, 0.18)',
      unitPadding: '12px',
      railSidebarWidth: '130px',
      frameColumns: 'var(--console-sidebar-width) minmax(0, 1fr)',
      frameGap: '0px',
      framePadding: '0px',
      sidebarPadding: 'var(--ui-unit-padding) calc(var(--ui-unit-padding) + var(--ui-rail-size)) var(--ui-unit-padding) var(--ui-unit-padding)',
      contentPadding: 'var(--ui-unit-padding) var(--ui-unit-padding) var(--ui-unit-padding) calc(var(--ui-unit-padding) + var(--ui-rail-size))',
      contentBorder: 'none',
      panelViewportPadding: '5px',
      panelViewportOverflow: 'hidden',
      sidebarControlsGap: '10px',
      sidebarControlsPadding: '10px 0 0 0',
      navButtonAspect: 'auto',
      navButtonHeight: '60px',
      navButtonPadding: '0 10px',
      navButtonGap: '8px',
      navButtonMargin: '0 0 10px 0',
      settingsButtonHeight: '40px',
      settingsButtonPadding: '0px',
      settingsButtonGap: '0px',
      settingsButtonGroupPadding: '0px',
      settingsButtonGroupMargin: '0px',
    },
    shadows: {
      sm: '1px 1px 2px rgba(0, 0, 0, 0.2)',
      md: '3px 3px 6px rgba(0, 20, 0, 1)',
      lg: '10px 10px 30px rgba(0, 0, 0, 0.5)',
      glass: 'inset 0 0 20px rgba(0, 0, 0, 0.5)',
    },
  },
  audio: {
    bgm: 'matrix-hum.mp3',
    clickSound: 'digital-blip.mp3',
    alertSound: 'access-denied.mp3',
    hoverSound: 'data-stream.mp3',
  },
  behaviors: {
    lensHoverAction: 'static',
    scrollPhysics: 'clunky',
    transitionStyle: 'scanwipe',
    transitionDuration: 200,
    cursorStyle: 'block',
  },
  slots: {
    background: 'matrix-rain', // ✓ Implemented
    // weatherSystem: 'none',
    // hudStyle: 'retro-terminal', // Not implemented
  }
});
