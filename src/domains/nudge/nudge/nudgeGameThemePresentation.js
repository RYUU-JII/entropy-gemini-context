import { toggleClass } from '../visual/index.js';
import { withAlpha } from './nudgeGameRuntimeUtils.js';

const ZEN_THEME_ID = 'zen';

function setStyleVars(root, vars) {
  for (const [name, value] of Object.entries(vars)) {
    root.style.setProperty(name, value);
  }
}

function buildBaseThemeVars({
  accent,
  background,
  glow,
  surface,
  text,
}) {
  const scrimColor = background.startsWith('#')
    ? withAlpha(background, 0.32)
    : 'rgba(6, 8, 12, 0.3)';
  return {
    '--nudge-accent': accent,
    '--nudge-glow': glow,
    '--nudge-text': text,
    '--nudge-surface': surface,
    '--nudge-scrim': scrimColor,
  };
}

function buildZenThemeVars(palette = {}) {
  return {
    '--nudge-scrim': 'rgba(31, 24, 18, 0.12)',
    '--nudge-modal-backdrop': 'rgba(31, 24, 18, 0.28)',
    '--nudge-modal-backdrop-blur': '2px',
    '--nudge-modal-surface': 'rgba(252, 247, 238, 0.96)',
    '--nudge-modal-ink': '#2F241E',
    '--nudge-modal-muted': 'rgba(74, 58, 50, 0.86)',
    '--nudge-modal-border': 'rgba(93, 64, 55, 0.22)',
    '--nudge-modal-btn-bg': 'rgba(255, 255, 255, 0.72)',
    '--nudge-modal-btn-border': 'rgba(93, 64, 55, 0.28)',
    '--nudge-modal-btn-ink': '#3A2B24',
    '--nudge-modal-btn-primary-bg': '#2E4837',
    '--nudge-modal-btn-primary-border': 'rgba(46, 72, 55, 0.9)',
    '--nudge-modal-btn-primary-ink': '#F8F6F2',
    '--nudge-hud-surface': 'rgba(253, 251, 247, 0.88)',
    '--nudge-hud-border': 'rgba(93, 64, 55, 0.18)',
    '--nudge-hud-inner': 'rgba(93, 64, 55, 0.11)',
    '--nudge-hud-ink': '#4A3A32',
    '--nudge-hud-muted': 'rgba(93, 64, 55, 0.78)',
    '--nudge-hud-meter-track': 'rgba(93, 64, 55, 0.16)',
    '--nudge-hud-meter-fill': palette.accent || '#7D8E67',
    '--nudge-hud-meter-fill-alt': palette.secondary || '#5D8D66',
    '--nudge-hud-tag': 'rgba(93, 64, 55, 0.85)',
  };
}

function buildDefaultThemeVars({
  accent,
  palette,
  surface,
  text,
}) {
  return {
    '--nudge-modal-backdrop': 'rgba(6, 8, 12, 0.55)',
    '--nudge-modal-backdrop-blur': '6px',
    '--nudge-modal-surface': surface,
    '--nudge-modal-ink': text,
    '--nudge-modal-muted': 'rgba(248, 250, 252, 0.72)',
    '--nudge-modal-border': 'rgba(255, 255, 255, 0.08)',
    '--nudge-modal-btn-bg': 'rgba(8, 12, 18, 0.75)',
    '--nudge-modal-btn-border': 'rgba(255, 255, 255, 0.18)',
    '--nudge-modal-btn-ink': text,
    '--nudge-modal-btn-primary-bg': accent,
    '--nudge-modal-btn-primary-border': 'transparent',
    '--nudge-modal-btn-primary-ink': '#0B0F14',
    '--nudge-hud-surface': 'rgba(10, 12, 18, 0.46)',
    '--nudge-hud-border': 'rgba(255, 255, 255, 0.12)',
    '--nudge-hud-inner': 'rgba(255, 255, 255, 0.09)',
    '--nudge-hud-ink': '#F8FAFC',
    '--nudge-hud-muted': 'rgba(248, 250, 252, 0.7)',
    '--nudge-hud-meter-track': 'rgba(255, 255, 255, 0.16)',
    '--nudge-hud-meter-fill': accent,
    '--nudge-hud-meter-fill-alt': palette.secondary || '#22D3EE',
    '--nudge-hud-tag': 'rgba(255, 255, 255, 0.9)',
  };
}

export function applySentinelThemePresentation({
  root = null,
  scene = null,
  theme = null,
  activeThemeId = '',
} = {}) {
  if (!root || !theme) return false;
  const palette = theme.palette || {};
  const accent = palette.primary || '#ff3b30';
  const glow = palette.glow || 'rgba(255, 59, 48, 0.35)';
  const text = palette.text || '#f8fafc';
  const background = palette.background || '#0b0f14';
  const surface = background.startsWith('#') ? withAlpha(background, 0.92) : background;
  const isZenTheme = theme?.id === ZEN_THEME_ID || activeThemeId === ZEN_THEME_ID;

  setStyleVars(root, buildBaseThemeVars({
    accent,
    background,
    glow,
    surface,
    text,
  }));
  if (scene) {
    toggleClass(scene, 'is-zen', isZenTheme);
  }
  setStyleVars(
    root,
    isZenTheme
      ? buildZenThemeVars(palette)
      : buildDefaultThemeVars({
          accent,
          palette,
          surface,
          text,
        }),
  );
  return true;
}
