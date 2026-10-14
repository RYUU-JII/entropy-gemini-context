import { THEME_IDS } from '../ids.js';
import { getThemePluginStrict } from '../runtime/pluginCatalog.js';

const REDUCED_MOTION_PROPS = Object.freeze({
  initial: false,
  animate: undefined,
  transition: Object.freeze({ duration: 0 }),
});

const DASHBOARD_TAB_TRANSITION_RECIPES = Object.freeze({
  quiet: Object.freeze({
    id: 'quiet',
    mode: 'static',
    clipOverflow: false,
    exitDurationMs: 0,
    variants: null,
  }),
  'zen-breath': Object.freeze({
    id: 'zen-breath',
    mode: 'enter-only',
    clipOverflow: false,
    exitDurationMs: 0,
    willChange: 'opacity',
    variants: Object.freeze({
      initial: Object.freeze({
        // Keep the incoming shell/loading frame visible; Zen breath is a
        // tonal settle, not an opaque navigation cover.
        opacity: 0.9,
      }),
      enter: Object.freeze({
        opacity: 1,
        transition: Object.freeze({
          opacity: Object.freeze({ duration: 0.18, ease: [0.22, 1, 0.36, 1] }),
        }),
      }),
    }),
  }),
  'entropy-stage': Object.freeze({
    id: 'entropy-stage',
    mode: 'stacked',
    clipOverflow: true,
    exitDurationMs: 1480,
    variants: Object.freeze({
      initial: Object.freeze({
        y: '112%',
        scale: 1,
        filter: 'brightness(1.08)',
        visibility: 'hidden',
        zIndex: 10,
      }),
      enter: Object.freeze({
        y: ['112%', '-0.6%', '0%'],
        scale: 1,
        filter: 'brightness(1)',
        visibility: 'visible',
        zIndex: 10,
        transition: Object.freeze({
          y: Object.freeze({
            duration: 1.24,
            delay: 0.16,
            ease: [0.22, 0.85, 0.2, 1],
            times: [0, 0.88, 1],
          }),
          filter: Object.freeze({
            duration: 0.32,
            delay: 0.16,
            ease: 'linear',
          }),
          visibility: Object.freeze({
            delay: 0,
            duration: 0,
          }),
        }),
      }),
      exit: Object.freeze({
        scale: 0.9,
        filter: [
          'brightness(1) blur(0px)',
          'brightness(1) blur(0px)',
          'brightness(0.82) blur(0.6px)',
          'brightness(0.58) blur(1.2px)',
        ],
        originY: 0.5,
        zIndex: 0,
        transition: Object.freeze({
          scale: Object.freeze({
            duration: 1.18,
            delay: 0.1,
            ease: [0.22, 0.8, 0.2, 1],
          }),
          filter: Object.freeze({
            duration: 1.18,
            delay: 0.1,
            ease: [0.22, 0.8, 0.2, 1],
          }),
        }),
      }),
    }),
  }),
  'matrix-trace': Object.freeze({
    id: 'matrix-trace',
    mode: 'enter-only',
    clipOverflow: false,
    exitDurationMs: 0,
    variants: Object.freeze({
      initial: Object.freeze({
        opacity: 0,
        y: 8,
        scale: 0.996,
        filter: 'blur(2.5px) brightness(1.14) saturate(0.88)',
      }),
      enter: Object.freeze({
        opacity: 1,
        y: 0,
        scale: 1,
        filter: 'blur(0px) brightness(1) saturate(1)',
        transition: Object.freeze({
          opacity: Object.freeze({ duration: 0.18, ease: [0.18, 1, 0.24, 1] }),
          y: Object.freeze({ duration: 0.24, ease: [0.18, 1, 0.24, 1] }),
          scale: Object.freeze({ duration: 0.24, ease: [0.18, 1, 0.24, 1] }),
          filter: Object.freeze({ duration: 0.22, ease: [0.18, 1, 0.24, 1] }),
        }),
      }),
    }),
  }),
  'cyberpunk-surge': Object.freeze({
    id: 'cyberpunk-surge',
    mode: 'enter-only',
    clipOverflow: false,
    exitDurationMs: 0,
    variants: Object.freeze({
      initial: Object.freeze({
        opacity: 0,
        x: 14,
        scale: 0.996,
        filter: 'blur(5px) saturate(1.18) brightness(1.08)',
      }),
      enter: Object.freeze({
        opacity: 1,
        x: 0,
        scale: 1,
        filter: 'blur(0px) saturate(1) brightness(1)',
        transition: Object.freeze({
          opacity: Object.freeze({ duration: 0.16, ease: [0.16, 1, 0.3, 1] }),
          x: Object.freeze({ duration: 0.22, ease: [0.16, 1, 0.3, 1] }),
          scale: Object.freeze({ duration: 0.22, ease: [0.16, 1, 0.3, 1] }),
          filter: Object.freeze({ duration: 0.18, ease: [0.16, 1, 0.3, 1] }),
        }),
      }),
    }),
  }),
  'clinical-fade': Object.freeze({
    id: 'clinical-fade',
    mode: 'enter-only',
    clipOverflow: false,
    exitDurationMs: 0,
    variants: Object.freeze({
      initial: Object.freeze({
        opacity: 0,
        y: 2,
        scale: 0.999,
        filter: 'blur(1.5px)',
      }),
      enter: Object.freeze({
        opacity: 1,
        y: 0,
        scale: 1,
        filter: 'blur(0px)',
        transition: Object.freeze({
          opacity: Object.freeze({ duration: 0.14, ease: [0.2, 0.9, 0.2, 1] }),
          y: Object.freeze({ duration: 0.16, ease: [0.2, 0.9, 0.2, 1] }),
          scale: Object.freeze({ duration: 0.16, ease: [0.2, 0.9, 0.2, 1] }),
          filter: Object.freeze({ duration: 0.16, ease: [0.2, 0.9, 0.2, 1] }),
        }),
      }),
    }),
  }),
  'scp-redact': Object.freeze({
    id: 'scp-redact',
    mode: 'enter-only',
    clipOverflow: false,
    exitDurationMs: 0,
    variants: Object.freeze({
      initial: Object.freeze({
        opacity: 0,
        y: 4,
        scale: 0.998,
        filter: 'blur(4px) grayscale(0.22) brightness(0.78)',
      }),
      enter: Object.freeze({
        opacity: 1,
        y: 0,
        scale: 1,
        filter: 'blur(0px) grayscale(0) brightness(1)',
        transition: Object.freeze({
          opacity: Object.freeze({ duration: 0.18, ease: [0.24, 1, 0.3, 1] }),
          y: Object.freeze({ duration: 0.22, ease: [0.24, 1, 0.3, 1] }),
          scale: Object.freeze({ duration: 0.22, ease: [0.24, 1, 0.3, 1] }),
          filter: Object.freeze({ duration: 0.2, ease: [0.24, 1, 0.3, 1] }),
        }),
      }),
    }),
  }),
});

const BASE_SURFACE_MOTION_PROPERTIES = 'opacity, transform, filter';
const DEFAULT_STATE_TRANSITION_EASE = 'var(--ease-out)';

const DASHBOARD_SURFACE_MOTION_FAMILIES = Object.freeze({
  standard: Object.freeze({
    mode: 'reveal',
    duration: 0.24,
    ease: [0.2, 0.9, 0.2, 1],
    y: 8,
    scale: 0.998,
  }),
  paper: Object.freeze({
    mode: 'reveal',
    duration: 0.6,
    ease: [0.22, 1, 0.36, 1],
    y: 10,
    scale: 0.995,
  }),
  [THEME_IDS.ZEN]: Object.freeze({
    mode: 'reveal',
    duration: 0.68,
    ease: [0.22, 1, 0.36, 1],
    y: 12,
    scale: 0.992,
  }),
  [THEME_IDS.MATRIX]: Object.freeze({
    mode: 'reveal',
    duration: 0.24,
    ease: [0.18, 1, 0.24, 1],
    y: 8,
    scale: 0.996,
    filterInitial: 'blur(2px) brightness(1.1) saturate(0.9)',
    filterAnimate: 'blur(0px) brightness(1) saturate(1)',
  }),
  [THEME_IDS.ENTROPY]: Object.freeze({
    mode: 'reveal',
    duration: 0.28,
    ease: [0.22, 0.8, 0.2, 1],
    y: 18,
    filterInitial: 'brightness(1.08)',
    filterAnimate: 'brightness(1)',
  }),
  [THEME_IDS.CYBERPUNK]: Object.freeze({
    mode: 'reveal',
    duration: 0.24,
    ease: [0.16, 1, 0.3, 1],
    x: 12,
    scale: 0.996,
    filterInitial: 'blur(4px) saturate(1.14) brightness(1.08)',
    filterAnimate: 'blur(0px) saturate(1) brightness(1)',
  }),
  [THEME_IDS.CLINICAL]: Object.freeze({
    mode: 'reveal',
    duration: 0.16,
    ease: [0.2, 0.9, 0.2, 1],
    y: 4,
    scale: 0.999,
    filterInitial: 'blur(1.5px)',
    filterAnimate: 'blur(0px)',
  }),
  [THEME_IDS.SCP]: Object.freeze({
    mode: 'reveal',
    duration: 0.22,
    ease: [0.24, 1, 0.3, 1],
    y: 6,
    scale: 0.997,
    filterInitial: 'blur(3px) grayscale(0.18) brightness(0.82)',
    filterAnimate: 'blur(0px) grayscale(0) brightness(1)',
  }),
});

const DASHBOARD_SURFACE_RECIPES = Object.freeze({
  'sites.registry.root': Object.freeze({
    y: 10,
    scale: 0.996,
  }),
  'sites.registry.search': Object.freeze({
    delay: 0.04,
    y: 12,
  }),
  'sites.registry.row': Object.freeze({
    baseDelay: 0.12,
    indexStep: 0.035,
    maxIndex: 8,
    y: 10,
    scale: 0.998,
  }),
  'sites.target.header': Object.freeze({
    delay: 0.04,
    y: 16,
  }),
  'sites.target.goal': Object.freeze({
    delay: 0.1,
    y: 14,
  }),
  'sites.target.trend': Object.freeze({
    delay: 0.16,
    y: 14,
  }),
  'sites.notice.banner': Object.freeze({
    delay: 0.02,
    y: 10,
    scale: 0.995,
  }),
  'sites.notice.aggregate': Object.freeze({
    delay: 0.04,
    y: 10,
    scale: 0.996,
  }),
  'sites.notice.error': Object.freeze({
    delay: 0.06,
    y: 8,
    scale: 0.995,
  }),
  'sites.notice.detail-status': Object.freeze({
    delay: 0.02,
    y: 6,
    scale: 1,
  }),
  'tools.gallery.selection': Object.freeze({
    mode: 'fade',
    // Selection is admitted after preload; never hide the prepared replacement.
    initialOpacity: 1,
    filterInitial: 'none',
    filterAnimate: 'none',
    duration: 0.12,
    ease: 'linear',
  }),
  'tools.gallery.panel': Object.freeze({
    mode: 'fade',
    initialOpacity: 1,
    filterInitial: 'none',
    filterAnimate: 'none',
    duration: 0.18,
    ease: 'linear',
    motionByFamily: Object.freeze({
      [THEME_IDS.ENTROPY]: Object.freeze({
        initial: Object.freeze({ opacity: 1, y: '104%' }),
        animate: Object.freeze({ opacity: 1, y: Object.freeze(['104%', '-0.7%', '0%']) }),
        transition: Object.freeze({
          duration: 0.68,
          ease: Object.freeze([0.22, 0.78, 0.2, 1]),
          times: Object.freeze([0, 0.9, 1]),
        }),
      }),
    }),
  }),
  'schedule.timeline.hover-chip': Object.freeze({
    duration: 0.18,
    y: 10,
    scale: 1,
  }),
  'schedule.timeline.drag-overlay': Object.freeze({
    duration: 0.16,
    y: 6,
    scale: 0.96,
  }),
});

const DASHBOARD_STATE_TRANSITION_RECIPES = Object.freeze({
  'dashboard.control.button': Object.freeze({
    properties: ['background-color', 'border-color', 'color', 'box-shadow', 'opacity'],
    duration: 'var(--duration-fast)',
    ease: 'var(--ease-out)',
  }),
  'dashboard.control.toggle-track': Object.freeze({
    properties: ['background-color', 'border-color', 'box-shadow', 'opacity'],
    duration: 'var(--duration-normal)',
    ease: 'var(--ease-in-out)',
  }),
  'dashboard.control.toggle-knob': Object.freeze({
    properties: ['transform', 'background-color', 'border-color', 'box-shadow'],
    duration: 'var(--duration-normal)',
    ease: 'var(--ease-in-out)',
  }),
  'dashboard.control.progress': Object.freeze({
    properties: ['width', 'opacity', 'background-color'],
    duration: 'var(--duration-normal)',
    ease: 'var(--ease-out)',
  }),
  'dashboard.control.handle-guide': Object.freeze({
    properties: ['width', 'background-color', 'opacity'],
    duration: 'var(--duration-fast)',
    ease: 'var(--ease-out)',
  }),
  'settings.list.card': Object.freeze({
    properties: ['background-color', 'border-color', 'box-shadow', 'opacity'],
    duration: 'var(--duration-normal)',
    ease: 'var(--ease-out)',
  }),
  'settings.list.chevron': Object.freeze({
    properties: ['transform', 'color'],
    duration: 'var(--duration-normal)',
    ease: 'var(--ease-out)',
  }),
  'settings.list.section-body': Object.freeze({
    properties: ['max-height', 'opacity', 'padding'],
    duration: 'var(--duration-normal)',
    ease: 'var(--ease-in-out)',
  }),
  'settings.permissions.section-body': Object.freeze({
    properties: ['grid-template-rows', 'opacity', 'margin-top', 'padding-top', 'border-color'],
    duration: 'var(--duration-slow)',
    ease: 'var(--ease-in-out)',
  }),
  'filter.navigator.card': Object.freeze({
    properties: ['background-color', 'border-color', 'box-shadow'],
    duration: 'var(--duration-normal)',
    ease: 'var(--ease-out)',
  }),
  'filter.sidebar.category': Object.freeze({
    properties: ['background-color', 'border-color', 'color', 'box-shadow'],
    duration: 'var(--duration-normal)',
    ease: 'var(--ease-out)',
  }),
  'filter.preview.selector-shell': Object.freeze({
    properties: ['background-color', 'border-color', 'box-shadow'],
    duration: 'var(--duration-fast)',
    ease: 'var(--ease-out)',
  }),
  'filter.preview.selector-chevron': Object.freeze({
    properties: ['transform', 'color'],
    duration: 'var(--duration-fast)',
    ease: 'var(--ease-out)',
  }),
  'filter.preview.selector-menu': Object.freeze({
    properties: ['opacity', 'transform', 'box-shadow', 'border-color'],
    duration: 'var(--duration-fast)',
    ease: 'var(--ease-out)',
  }),
  'filter.preview.selector-option': Object.freeze({
    properties: ['background-color', 'border-color', 'color', 'box-shadow'],
    duration: 'var(--duration-fast)',
    ease: 'var(--ease-out)',
  }),
  'schedule.header.toggle-track': Object.freeze({
    properties: ['background-color', 'border-color', 'box-shadow'],
    duration: 'var(--duration-normal)',
    ease: 'var(--ease-in-out)',
  }),
  'schedule.header.toggle-knob': Object.freeze({
    properties: ['transform', 'background-color', 'border-color', 'box-shadow'],
    duration: 'var(--duration-normal)',
    ease: 'var(--ease-in-out)',
  }),
  'schedule.panel.row': Object.freeze({
    properties: ['background-color', 'border-color', 'box-shadow', 'opacity'],
    duration: 'var(--duration-normal)',
    ease: 'var(--ease-out)',
  }),
  'schedule.panel.inline-action': Object.freeze({
    properties: ['opacity', 'color', 'background-color', 'border-color'],
    duration: 'var(--duration-fast)',
    ease: 'var(--ease-out)',
  }),
  'schedule.panel.add-button': Object.freeze({
    properties: ['background-color', 'border-color', 'color', 'box-shadow'],
    duration: 'var(--duration-fast)',
    ease: 'var(--ease-out)',
  }),
  'schedule.presets.button': Object.freeze({
    properties: ['background-color', 'border-color', 'color', 'box-shadow'],
    duration: 'var(--duration-fast)',
    ease: 'var(--ease-out)',
  }),
  'schedule.day.button': Object.freeze({
    properties: ['background-color', 'border-color', 'color', 'box-shadow', 'opacity', 'transform'],
    duration: 'var(--duration-fast)',
    ease: 'var(--ease-out)',
  }),
  'schedule.block-strip.mode': Object.freeze({
    properties: ['background-color', 'border-color', 'color', 'box-shadow'],
    duration: 'var(--duration-fast)',
    ease: 'var(--ease-out)',
  }),
  'schedule.editor.passive-block': Object.freeze({
    properties: ['left', 'width', 'border-color', 'background-color', 'opacity'],
    duration: 'var(--duration-normal)',
    ease: 'var(--ease-in-out)',
  }),
});

function getDashboardSurfaceRecipe(surfaceId) {
  const recipe = DASHBOARD_SURFACE_RECIPES[surfaceId];
  if (!recipe) {
    throw new Error(`[ThemeMotion] Unsupported dashboard surface motion id '${surfaceId}'.`);
  }
  return recipe;
}

function getDashboardStateTransitionRecipe(stateId) {
  const recipe = DASHBOARD_STATE_TRANSITION_RECIPES[stateId];
  if (!recipe) {
    throw new Error(`[ThemeMotion] Unsupported dashboard state transition id '${stateId}'.`);
  }
  return recipe;
}

function normalizeTransitionPropertyList(properties) {
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

function normalizeDashboardMotionFamily(family = 'standard') {
  if (typeof family !== 'string' || !family.trim()) {
    return 'standard';
  }

  const rawFamily = family.trim().toLowerCase();
  if (rawFamily === 'default') return 'standard';
  if (DASHBOARD_SURFACE_MOTION_FAMILIES[rawFamily]) return rawFamily;

  throw new Error(`[ThemeMotion] Unsupported dashboard motion family '${family}'.`);
}

function resolveFamilyMotionValue(surfaceRecipe, key, normalizedFamily) {
  const familyValues = surfaceRecipe?.[key];
  if (!familyValues || typeof familyValues !== 'object') {
    return undefined;
  }
  return Object.prototype.hasOwnProperty.call(familyValues, normalizedFamily)
    ? familyValues[normalizedFamily]
    : undefined;
}

function resolveMotionFilters(surfaceRecipe, familyRecipe, normalizedFamily) {
  return {
    initial: resolveFamilyMotionValue(surfaceRecipe, 'filterInitialByFamily', normalizedFamily)
      ?? surfaceRecipe.filterInitial
      ?? familyRecipe.filterInitial,
    animate: resolveFamilyMotionValue(surfaceRecipe, 'filterAnimateByFamily', normalizedFamily)
      ?? surfaceRecipe.filterAnimate
      ?? familyRecipe.filterAnimate,
  };
}

function buildRevealMotionProps(surfaceRecipe, familyRecipe, delay, normalizedFamily) {
  const initial = { opacity: 0 };
  const animate = { opacity: 1 };

  const resolvedX = surfaceRecipe.x ?? familyRecipe.x;
  const resolvedY = surfaceRecipe.y ?? familyRecipe.y;
  const resolvedScale = surfaceRecipe.scale ?? familyRecipe.scale;
  const resolvedFilters = resolveMotionFilters(surfaceRecipe, familyRecipe, normalizedFamily);

  if (Number.isFinite(resolvedX) && resolvedX !== 0) {
    initial.x = resolvedX;
    animate.x = 0;
  }

  if (Number.isFinite(resolvedY) && resolvedY !== 0) {
    initial.y = resolvedY;
    animate.y = 0;
  }

  if (typeof resolvedScale === 'number' && resolvedScale !== 1) {
    initial.scale = resolvedScale;
    animate.scale = 1;
  }

  if (resolvedFilters.initial || resolvedFilters.animate) {
    initial.filter = resolvedFilters.initial || 'none';
    animate.filter = resolvedFilters.animate || 'none';
  }

  return {
    initial,
    animate,
    transition: {
      duration: surfaceRecipe.duration ?? familyRecipe.duration,
      delay,
      ease: surfaceRecipe.ease ?? familyRecipe.ease,
    },
  };
}

export function getDashboardTabTransitionProfile(themeId) {
  const themePlugin = getThemePluginStrict(themeId, 'dashboard tab transition profile');
  const resolvedThemeId = themePlugin.id;
  const recipeId = themePlugin.profile?.dashboard?.tabTransition;

  if (typeof recipeId !== 'string' || !recipeId.trim()) {
    throw new Error(
      `[ThemeMotion] Theme '${resolvedThemeId}' must declare a dashboard tab transition recipe.`,
    );
  }

  const profile = DASHBOARD_TAB_TRANSITION_RECIPES[recipeId];
  if (!profile) {
    throw new Error(
      `[ThemeMotion] Unknown dashboard tab transition recipe '${recipeId}' for theme '${resolvedThemeId}'.`,
    );
  }

  return profile;
}

export function buildDashboardSurfaceMotion(
  surfaceId,
  { family = 'standard', reduced = false, index = 0, delay: overrideDelay } = {},
) {
  if (reduced) {
    return REDUCED_MOTION_PROPS;
  }

  const surfaceRecipe = getDashboardSurfaceRecipe(surfaceId);
  const normalizedFamily = normalizeDashboardMotionFamily(family);
  const familyRecipe = DASHBOARD_SURFACE_MOTION_FAMILIES[normalizedFamily];
  const familyMotion = surfaceRecipe.motionByFamily?.[normalizedFamily];
  if (familyMotion) return familyMotion;
  const boundedIndex = Number.isFinite(index)
    ? Math.max(0, Math.min(index, surfaceRecipe.maxIndex ?? index))
    : 0;
  const delay = typeof overrideDelay === 'number'
    ? overrideDelay
    : (surfaceRecipe.delay ?? 0) + (surfaceRecipe.baseDelay ?? 0) + (surfaceRecipe.indexStep ?? 0) * boundedIndex;
  const mode = surfaceRecipe.mode ?? familyRecipe.mode ?? 'reveal';

  if (mode === 'fade') {
    const resolvedFilters = resolveMotionFilters(surfaceRecipe, familyRecipe, normalizedFamily);
    const initial = { opacity: surfaceRecipe.initialOpacity ?? 0 };
    const animate = { opacity: 1 };

    if (resolvedFilters.initial || resolvedFilters.animate) {
      initial.filter = resolvedFilters.initial || 'none';
      animate.filter = resolvedFilters.animate || 'none';
    }

    return {
      initial,
      animate,
      transition: {
        duration: surfaceRecipe.duration ?? familyRecipe.duration,
        delay,
        ease: surfaceRecipe.ease ?? familyRecipe.ease,
      },
    };
  }

  if (mode !== 'reveal') {
    throw new Error(`[ThemeMotion] Unsupported dashboard surface motion mode '${mode}' for '${surfaceId}'.`);
  }

  return buildRevealMotionProps(surfaceRecipe, familyRecipe, delay, normalizedFamily);
}

export function getDashboardSurfaceMotionStyle() {
  return Object.freeze({
    willChange: BASE_SURFACE_MOTION_PROPERTIES,
  });
}

export function getDashboardStateTransitionStyle(stateId, { delay = null } = {}) {
  const recipe = getDashboardStateTransitionRecipe(stateId);
  const properties = normalizeTransitionPropertyList(recipe.properties);
  const style = {
    transitionProperty: properties,
    transitionDuration: recipe.duration,
    transitionTimingFunction: recipe.ease || DEFAULT_STATE_TRANSITION_EASE,
  };

  if (typeof delay === 'string' && delay.trim()) {
    style.transitionDelay = delay.trim();
  } else if (typeof delay === 'number' && Number.isFinite(delay) && delay > 0) {
    style.transitionDelay = `${delay}ms`;
  }

  return Object.freeze(style);
}
