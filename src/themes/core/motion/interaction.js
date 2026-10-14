const INTERACTION_BASE_PROPERTIES = 'background-color, border-color, color, opacity, box-shadow, filter';
const INTERACTION_TRANSFORM_PROPERTIES = `${INTERACTION_BASE_PROPERTIES}, transform`;
const INTERACTION_POLICY_RECIPES = Object.freeze({
  default: Object.freeze({}),
  stable: Object.freeze({
    properties: INTERACTION_BASE_PROPERTIES,
    hover: 'none',
    active: 'none',
  }),
});

const INTERACTION_TRANSITION_RECIPES = Object.freeze({
  fade: Object.freeze({
    style: 'var(--ease-out)',
    defaultDurationMs: 250,
    hover: 'none',
    active: 'none',
    properties: INTERACTION_BASE_PROPERTIES,
  }),
  slide: Object.freeze({
    style: 'var(--ease-smooth)',
    defaultDurationMs: 200,
    hover: 'none',
    active: 'none',
    properties: INTERACTION_BASE_PROPERTIES,
  }),
  instant: Object.freeze({
    style: 'steps(1, end)',
    defaultDurationMs: 80,
    hover: 'none',
    active: 'none',
    properties: INTERACTION_BASE_PROPERTIES,
  }),
  bloom: Object.freeze({
    style: 'cubic-bezier(0.22, 1, 0.36, 1)',
    defaultDurationMs: 400,
    hover: 'translateY(-1px)',
    active: 'translateY(0)',
    properties: INTERACTION_TRANSFORM_PROPERTIES,
  }),
  scanwipe: Object.freeze({
    style: 'cubic-bezier(0.16, 1, 0.3, 1)',
    defaultDurationMs: 220,
    hover: 'none',
    active: 'none',
    properties: INTERACTION_BASE_PROPERTIES,
  }),
  shutter: Object.freeze({
    style: 'cubic-bezier(0.4, 0, 0.2, 1)',
    defaultDurationMs: 200,
    hover: 'none',
    active: 'none',
    properties: INTERACTION_BASE_PROPERTIES,
  }),
  blink: Object.freeze({
    style: 'steps(2, end)',
    defaultDurationMs: 120,
    hover: 'none',
    active: 'none',
    properties: INTERACTION_BASE_PROPERTIES,
  }),
});

function clampNumber(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function normalizeInteractionPolicyId(policy = 'default') {
  if (typeof policy !== 'string') {
    throw new Error(`[ThemeMotion] Unsupported interaction policy '${policy}'.`);
  }

  const normalizedPolicy = policy.trim().toLowerCase();
  if (!Object.prototype.hasOwnProperty.call(INTERACTION_POLICY_RECIPES, normalizedPolicy)) {
    throw new Error(`[ThemeMotion] Unsupported interaction policy '${policy}'.`);
  }

  return normalizedPolicy;
}

function normalizeInteractionPropertyList(properties) {
  if (Array.isArray(properties)) {
    return properties
      .map((property) => (typeof property === 'string' ? property.trim() : ''))
      .filter(Boolean)
      .join(', ');
  }

  if (typeof properties === 'string') {
    return properties.trim();
  }

  return '';
}

export function isSupportedInteractionTransitionStyle(style) {
  if (typeof style !== 'string') return false;
  const normalizedStyle = style.trim().toLowerCase();
  return Object.prototype.hasOwnProperty.call(INTERACTION_TRANSITION_RECIPES, normalizedStyle);
}

export function isSupportedInteractionPolicy(policy) {
  if (typeof policy !== 'string') return false;
  const normalizedPolicy = policy.trim().toLowerCase();
  return Object.prototype.hasOwnProperty.call(INTERACTION_POLICY_RECIPES, normalizedPolicy);
}

export function parseMotionDurationMs(
  value,
  fallbackMs = 300,
  { minMs = 40, maxMs = 600 } = {},
) {
  let resolvedDurationMs = fallbackMs;

  if (typeof value === 'number' && Number.isFinite(value) && value > 0) {
    resolvedDurationMs = value;
  } else if (typeof value === 'string') {
    const rawValue = value.trim().toLowerCase();
    if (/^\d+(\.\d+)?ms$/u.test(rawValue)) {
      resolvedDurationMs = Number.parseFloat(rawValue.replace('ms', ''));
    } else if (/^\d+(\.\d+)?s$/u.test(rawValue)) {
      resolvedDurationMs = Number.parseFloat(rawValue.replace('s', '')) * 1000;
    } else {
      const parsed = Number(rawValue);
      if (Number.isFinite(parsed) && parsed > 0) {
        resolvedDurationMs = parsed;
      }
    }
  }

  if (!Number.isFinite(resolvedDurationMs) || resolvedDurationMs <= 0) {
    resolvedDurationMs = fallbackMs;
  }

  return Math.round(clampNumber(resolvedDurationMs, minMs, maxMs));
}

export function resolveThemeInteractionMotionProfile(behaviors = {}) {
  const styleId = typeof behaviors?.transitionStyle === 'string'
    ? behaviors.transitionStyle.trim().toLowerCase()
    : '';

  if (!isSupportedInteractionTransitionStyle(styleId)) {
    throw new Error(`[ThemeMotion] Unsupported interaction transition style '${behaviors?.transitionStyle}'.`);
  }

  const recipe = INTERACTION_TRANSITION_RECIPES[styleId];
  const durationMs = parseMotionDurationMs(behaviors?.transitionDuration, recipe.defaultDurationMs);

  return Object.freeze({
    style: recipe.style,
    duration: `${durationMs}ms`,
    hover: recipe.hover,
    active: recipe.active,
    properties: recipe.properties,
  });
}

export function getInteractionMotionStyle(policy = 'default', overrides = {}) {
  const policyId = normalizeInteractionPolicyId(policy);
  const policyRecipe = INTERACTION_POLICY_RECIPES[policyId];
  const overrideBag = overrides && typeof overrides === 'object' ? overrides : {};
  const style = {};

  const properties = normalizeInteractionPropertyList(
    Object.prototype.hasOwnProperty.call(overrideBag, 'properties')
      ? overrideBag.properties
      : policyRecipe.properties,
  );
  const hover = typeof overrideBag.hover === 'string'
    ? overrideBag.hover.trim()
    : policyRecipe.hover;
  const active = typeof overrideBag.active === 'string'
    ? overrideBag.active.trim()
    : policyRecipe.active;

  if (properties) {
    style['--transition-property-interactive'] = properties;
  }

  if (hover) {
    style['--hover-transform'] = hover;
  }

  if (active) {
    style['--active-transform'] = active;
  }

  return Object.freeze(style);
}
