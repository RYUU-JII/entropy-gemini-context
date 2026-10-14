export const INDICATOR_DENSITY = Object.freeze({
  COMPACT: 'compact',
  EXPANDED: 'expanded',
});

function normalizePositionPx(value) {
  if (value === null || value === undefined) return null;
  const raw = Number(value);
  if (!Number.isFinite(raw)) return null;
  return Math.max(0, Math.min(100_000, Math.round(raw)));
}

export const DEFAULT_INDICATOR_CONFIG = Object.freeze({
  enabled: false,
  density: INDICATOR_DENSITY.COMPACT,
  autoMinimizeMs: 5000,
  positionX: null,
  positionY: null,
});

const ALLOWED_DENSITIES = new Set(Object.values(INDICATOR_DENSITY));

function normalizeDensity(value) {
  const raw = typeof value === 'string' ? value.trim().toLowerCase() : '';
  return ALLOWED_DENSITIES.has(raw) ? raw : DEFAULT_INDICATOR_CONFIG.density;
}

function normalizeAutoMinimizeMs(value) {
  const raw = Number(value);
  if (!Number.isFinite(raw)) return DEFAULT_INDICATOR_CONFIG.autoMinimizeMs;
  return Math.max(1000, Math.min(60_000, Math.round(raw)));
}

export function normalizeIndicatorConfig(config) {
  if (typeof config === 'boolean') {
    return {
      ...DEFAULT_INDICATOR_CONFIG,
      enabled: config,
    };
  }

  const source = config && typeof config === 'object' ? config : {};
  return {
    enabled: typeof source.enabled === 'boolean' ? source.enabled : DEFAULT_INDICATOR_CONFIG.enabled,
    density: normalizeDensity(source.density),
    autoMinimizeMs: normalizeAutoMinimizeMs(source.autoMinimizeMs),
    positionX: normalizePositionPx(source.positionX),
    positionY: normalizePositionPx(source.positionY),
  };
}
