import { getDefaultThemeId, getThemeDefinition } from '../../../themes/core/catalog.js';
import {
  readStoredThemePreferenceCandidate,
  readThemePreferenceMirror,
  resolveCandidateThemeId,
  resolveThemePreferenceMirrorStorageEvent,
  subscribeStoredThemePreference,
} from '../../../themes/core/state/themePreferenceRepository.js';

const FALLBACK_COLORS = Object.freeze({
  accent: '#8aad94',
  accentStrong: '#a6f4b3',
  alert: '#ff7b7b',
  text: '#e3e7e7',
  textMuted: 'rgba(227, 231, 231, 0.62)',
  background: '#0f1214',
  surface: 'rgba(15, 18, 20, 0.92)',
  surfaceSoft: 'rgba(255, 255, 255, 0.06)',
  border: 'rgba(255, 255, 255, 0.12)',
  borderSoft: 'rgba(255, 255, 255, 0.08)',
  accentMuted: 'rgba(138, 173, 148, 0.22)',
  accentGlow: 'rgba(166, 244, 179, 0.45)',
});

const FALLBACK_FONTS = Object.freeze({
  ui: 'var(--font-theme-ui, var(--font-ui, var(--font-sans, system-ui, sans-serif)))',
  mono: 'var(--font-theme-mono, var(--font-mono, ui-monospace, monospace))',
  heading: 'var(--font-theme-heading, var(--font-heading, var(--font-sans, system-ui, sans-serif)))',
});
const FALLBACK_THEME_ID = getDefaultThemeId();

function clampAlpha(value) {
  const num = Number(value);
  if (!Number.isFinite(num)) return 1;
  return Math.max(0, Math.min(1, num));
}

function hexToRgb(hex) {
  const raw = String(hex || '').trim().replace(/^#/, '');
  if (raw.length === 3) {
    const r = Number.parseInt(raw[0] + raw[0], 16);
    const g = Number.parseInt(raw[1] + raw[1], 16);
    const b = Number.parseInt(raw[2] + raw[2], 16);
    if ([r, g, b].every((v) => Number.isFinite(v))) return { r, g, b };
    return null;
  }
  if (raw.length === 6) {
    const r = Number.parseInt(raw.slice(0, 2), 16);
    const g = Number.parseInt(raw.slice(2, 4), 16);
    const b = Number.parseInt(raw.slice(4, 6), 16);
    if ([r, g, b].every((v) => Number.isFinite(v))) return { r, g, b };
    return null;
  }
  return null;
}

function parseRgbString(input) {
  const match = String(input || '').trim().match(/^rgba?\(([^)]+)\)$/i);
  if (!match) return null;
  const parts = match[1].split(',').map((p) => Number.parseFloat(p.trim()));
  if (parts.length < 3) return null;
  const [r, g, b, a] = parts;
  if (![r, g, b].every((v) => Number.isFinite(v))) return null;
  return { r, g, b, a: Number.isFinite(a) ? clampAlpha(a) : 1 };
}

function parseColor(color) {
  const hex = hexToRgb(color);
  if (hex) return { r: hex.r, g: hex.g, b: hex.b, a: 1 };
  const rgb = parseRgbString(color);
  if (!rgb) return null;
  return { r: rgb.r, g: rgb.g, b: rgb.b, a: clampAlpha(rgb.a) };
}

function toRgbaString(color) {
  if (!color) return '';
  return `rgba(${Math.round(color.r)}, ${Math.round(color.g)}, ${Math.round(color.b)}, ${clampAlpha(color.a)})`;
}

function withAlpha(color, alpha, fallback) {
  const a = clampAlpha(alpha);
  const rgb = parseColor(color);
  if (!rgb) return fallback;
  return toRgbaString({ r: rgb.r, g: rgb.g, b: rgb.b, a });
}

function withMinAlpha(color, minAlpha, fallback) {
  const parsed = parseColor(color);
  if (!parsed) return fallback;
  return toRgbaString({
    r: parsed.r,
    g: parsed.g,
    b: parsed.b,
    a: Math.max(clampAlpha(minAlpha), clampAlpha(parsed.a)),
  });
}

function resolveThemeTokens(themeId) {
  const theme = getThemeDefinition(themeId) || {};
  const colors = theme?.tokens?.colors || {};
  const typography = theme?.tokens?.typography || {};
  const accent = colors.accent || FALLBACK_COLORS.accent;
  const accentStrong = colors.accentSecondary || colors.accentTertiary || accent || FALLBACK_COLORS.accentStrong;
  const text = colors.text || FALLBACK_COLORS.text;
  const textMuted = colors.textMuted || withAlpha(text, 0.64, FALLBACK_COLORS.textMuted);
  const background = colors.background || FALLBACK_COLORS.background;
  const surfaceCandidate = colors.surfaceSunken
    || colors.surface
    || colors.surfaceOverlay
    || withAlpha(background, 0.92, FALLBACK_COLORS.surface);
  const surface = withMinAlpha(surfaceCandidate, 0.9, FALLBACK_COLORS.surface);
  const surfaceSoftCandidate = colors.surfaceSoft
    || withAlpha(colors.surface || text, 0.12, FALLBACK_COLORS.surfaceSoft);
  const surfaceSoft = withMinAlpha(surfaceSoftCandidate, 0.12, FALLBACK_COLORS.surfaceSoft);
  const borderCandidate = colors.borderStrong || colors.glassBorder || colors.border || FALLBACK_COLORS.border;
  const border = withMinAlpha(borderCandidate, 0.22, FALLBACK_COLORS.border);
  const borderSoft = withMinAlpha(
    withAlpha(colors.border || text, 0.42, FALLBACK_COLORS.borderSoft),
    0.16,
    FALLBACK_COLORS.borderSoft,
  );
  const accentMuted = colors.accentMuted || withAlpha(accent, 0.22, FALLBACK_COLORS.accentMuted);
  const accentGlow = withAlpha(accentStrong, 0.45, FALLBACK_COLORS.accentGlow);

  return {
    accent,
    accentStrong,
    accentMuted,
    accentGlow,
    alert: colors.alert || colors.danger || colors.warning || FALLBACK_COLORS.alert,
    text,
    textMuted,
    background,
    surface,
    surfaceSoft,
    border,
    borderSoft,
    fontUi: typography.body || typography.fontFamily || FALLBACK_FONTS.ui,
    fontMono: typography.mono || typography.body || typography.fontFamily || FALLBACK_FONTS.mono,
    fontHeading: typography.heading || typography.body || typography.fontFamily || FALLBACK_FONTS.heading,
  };
}

function applyIndicatorThemeVars(root, themeId) {
  if (!root) return;
  root.dataset.theme = themeId;
  const tokens = resolveThemeTokens(themeId);
  root.style.setProperty('--indicator-theme-accent', tokens.accent);
  root.style.setProperty('--indicator-theme-accent-strong', tokens.accentStrong);
  root.style.setProperty('--indicator-theme-accent-muted', tokens.accentMuted);
  root.style.setProperty('--indicator-theme-accent-glow', tokens.accentGlow);
  root.style.setProperty('--indicator-theme-alert', tokens.alert);
  root.style.setProperty('--indicator-theme-text', tokens.text);
  root.style.setProperty('--indicator-theme-text-muted', tokens.textMuted);
  root.style.setProperty('--indicator-theme-background', tokens.background);
  root.style.setProperty('--indicator-theme-surface', tokens.surface);
  root.style.setProperty('--indicator-theme-surface-soft', tokens.surfaceSoft);
  root.style.setProperty('--indicator-theme-border', tokens.border);
  root.style.setProperty('--indicator-theme-border-soft', tokens.borderSoft);
  root.style.setProperty('--indicator-theme-font-ui', tokens.fontUi);
  root.style.setProperty('--indicator-theme-font-mono', tokens.fontMono);
  root.style.setProperty('--indicator-theme-font-heading', tokens.fontHeading);
}

export function createIndicatorThemeAdapter({ getRoot }) {
  let onThemeChange = null;
  let onStorageChange = null;
  let detachStoredThemePreference = null;
  let themeHydrationPromise = null;
  let activeThemeId = readThemePreferenceMirror(FALLBACK_THEME_ID);

  function applyTheme(themeId) {
    const root = typeof getRoot === 'function' ? getRoot() : null;
    if (!root) return;
    applyIndicatorThemeVars(root, themeId);
  }

  function syncThemeFromChromeStorage() {
    if (themeHydrationPromise) return themeHydrationPromise;

    themeHydrationPromise = readStoredThemePreferenceCandidate()
      .then((themeId) => {
        if (!themeId || themeId === activeThemeId) return;
        activeThemeId = themeId;
        applyTheme(activeThemeId);
      })
      .catch(() => {})
      .finally(() => {
        themeHydrationPromise = null;
      });

    return themeHydrationPromise;
  }

  function applyNow() {
    applyTheme(activeThemeId);
  }

  function attach() {
    if (!onThemeChange) {
      onThemeChange = (event) => {
        const candidateThemeId = resolveCandidateThemeId(event?.detail?.theme);
        if (!candidateThemeId || candidateThemeId === activeThemeId) {
          applyNow();
          return;
        }
        activeThemeId = candidateThemeId;
        applyNow();
      };
      window.addEventListener('themechange', onThemeChange);
    }
    if (!onStorageChange) {
      onStorageChange = (event) => {
        const mirrorEvent = resolveThemePreferenceMirrorStorageEvent(event);
        if (!mirrorEvent.matches) return;
        const candidateThemeId = mirrorEvent.themeId;
        if (candidateThemeId) {
          if (candidateThemeId !== activeThemeId) {
            activeThemeId = candidateThemeId;
          }
          applyNow();
          return;
        }
        activeThemeId = readThemePreferenceMirror(activeThemeId || FALLBACK_THEME_ID);
        applyNow();
      };
      window.addEventListener('storage', onStorageChange);
    }

    if (!detachStoredThemePreference) {
      detachStoredThemePreference = subscribeStoredThemePreference((nextThemeId) => {
        if (!nextThemeId || nextThemeId === activeThemeId) return;
        activeThemeId = nextThemeId;
        applyNow();
      });
    }
    activeThemeId = readThemePreferenceMirror(activeThemeId || FALLBACK_THEME_ID);
    applyNow();
    void syncThemeFromChromeStorage();
  }

  function detach() {
    if (onThemeChange) {
      window.removeEventListener('themechange', onThemeChange);
      onThemeChange = null;
    }
    if (onStorageChange) {
      window.removeEventListener('storage', onStorageChange);
      onStorageChange = null;
    }
    if (detachStoredThemePreference) {
      detachStoredThemePreference();
      detachStoredThemePreference = null;
    }
  }

  return {
    applyNow,
    attach,
    detach,
  };
}
