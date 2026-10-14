/**
 * Theme Utilities
 * 
 * Helper functions for mapping theme tokens into CSS variables.
 */

import { LAYOUT_DEFAULTS } from './data/layoutDefaults.js';
import { resolveThemeInteractionMotionProfile } from './motion/interaction.js';

const DEFAULT_SHADOWS = {
    xs: '0 1px 2px rgba(0, 0, 0, 0.03)',
    sm: '0 1px 3px rgba(0, 0, 0, 0.05)',
    md: '0 4px 6px -1px rgba(0, 0, 0, 0.05), 0 2px 4px -1px rgba(0, 0, 0, 0.03)',
    lg: '0 10px 15px -3px rgba(0, 0, 0, 0.05), 0 4px 6px -2px rgba(0, 0, 0, 0.025)',
    xl: '0 20px 25px -5px rgba(0, 0, 0, 0.06), 0 10px 10px -5px rgba(0, 0, 0, 0.02)',
    '2xl': '0 25px 50px -12px rgba(0, 0, 0, 0.12)',
    glass: '0 8px 32px rgba(0, 0, 0, 0.04)',
    insetSm: 'inset 0 1px 2px rgba(0, 0, 0, 0.05)',
    insetMd: 'inset 0 2px 4px rgba(0, 0, 0, 0.06)',
};

const HEX_RE = /^#([0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})$/i;

const clampNumber = (value, min, max) => Math.min(Math.max(value, min), max);

const normalizeSizeToken = (value) => {
    if (typeof value === 'number' && Number.isFinite(value)) {
        return `${value}px`;
    }
    return typeof value === 'string' ? value.trim() : '';
};

const normalizeLayoutToken = (value) => {
    if (typeof value === 'number' && Number.isFinite(value)) {
        return String(value);
    }
    return typeof value === 'string' ? value.trim() : '';
};

const parseSizeToken = (value) => {
    const token = normalizeSizeToken(value);
    if (!token) return null;
    const match = token.match(/^(-?\d*\.?\d+)([a-z%]*)$/i);
    if (!match) return null;
    return {
        value: parseFloat(match[1]),
        unit: match[2] || 'px',
    };
};

const scaleSizeToken = (value, factor) => {
    const parsed = parseSizeToken(value);
    if (!parsed) return value;
    const scaled = Math.round(parsed.value * factor * 1000) / 1000;
    const unit = parsed.unit || 'px';
    if (scaled === 0) return '0px';
    return `${scaled}${unit}`;
};

const hexToRgb = (hex) => {
    const raw = hex.replace('#', '');
    if (raw.length === 3) {
        return {
            r: parseInt(raw[0] + raw[0], 16),
            g: parseInt(raw[1] + raw[1], 16),
            b: parseInt(raw[2] + raw[2], 16),
        };
    }
    if (raw.length === 6 || raw.length === 8) {
        return {
            r: parseInt(raw.slice(0, 2), 16),
            g: parseInt(raw.slice(2, 4), 16),
            b: parseInt(raw.slice(4, 6), 16),
        };
    }
    return null;
};

const withAlpha = (color, alpha) => {
    if (!color) return '';
    const normalized = color.trim();
    const safeAlpha = clampNumber(alpha, 0, 1);
    if (HEX_RE.test(normalized)) {
        const rgb = hexToRgb(normalized);
        if (!rgb) return normalized;
        return `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${safeAlpha})`;
    }
    return `color-mix(in srgb, ${normalized} ${safeAlpha * 100}%, transparent)`;
};

/**
 * Recursively flattens a nested object of tokens into a flat dictionary of CSS variables.
 * Automatically converts camelCase keys into kebab-case.
 * 
 * @param {Object} tokens - The nested tokens object
 * @param {string} prefix - The current CSS variable prefix string (e.g. '--color')
 * @returns {Object} Flat dictionary of CSS variables
 */
function flattenTokensToCSS(tokens, prefix = '-') {
    return Object.keys(tokens).reduce((acc, key) => {
        const val = tokens[key];
        // Convert camelCase to kebab-case (e.g., surfaceVariant -> surface-variant)
        const kebabKey = key.replace(/([A-Z])/g, "-$1").toLowerCase();

        // Handle special root level prefixes
        let cssKey;
        if (prefix === '-') {
            // Top level categories get mapped to nice prefixes
            let categoryPrefix = kebabKey;
            if (categoryPrefix === 'colors') categoryPrefix = 'color';
            else if (categoryPrefix === 'shapes') categoryPrefix = 'theme';
            else if (categoryPrefix === 'effects') categoryPrefix = ''; // Will become --blur, --glow
            else if (categoryPrefix === 'typography') categoryPrefix = 'font-theme';

            cssKey = categoryPrefix ? `--${categoryPrefix}` : '-';
        } else {
            // Append with a dash, unless the prefix is empty (like for effects)
            cssKey = prefix.endsWith('-') || !prefix ? `${prefix}${kebabKey}` : `${prefix}-${kebabKey}`;
        }

        // Clean up double dashes in the middle
        cssKey = cssKey.replace(/---/g, '--').replace(/^-([^-])/, '--$1');

        if (typeof val === 'object' && val !== null) {
            Object.assign(acc, flattenTokensToCSS(val, cssKey));
        } else {
            acc[cssKey] = val;
        }
        return acc;
    }, {});
}

/**
 * Builds CSS variables from the theme object (Theme-as-Data contract).
 * @param {Object} theme - The theme object
 * @returns {Object} Dictionary of CSS variables
 */
export function buildThemeCSSVariables(theme) {
    const tokens = theme?.tokens || {};

    // LAYER 1: Auto-flatten all definition tokens recursively
    const autoVars = flattenTokensToCSS(tokens);

    // Grab references needed for derived calculations
    const colors = tokens.colors || {};
    const typography = tokens.typography || {};
    const shapes = tokens.shapes || {};
    const effects = tokens.effects || {};
    const layout = tokens.layout || {};
    const shadows = tokens.shadows || {};
    const components = tokens.components || {};
    const interactionMotion = resolveThemeInteractionMotionProfile(theme?.behaviors || {});

    // LAYER 2: Canonical derived presentation tokens

    const background = colors.background || colors.primary || colors.surface;
    const surface = colors.surface || colors.primary;
    const surfaceElevated = colors.surfaceVariant || surface;
    const surfaceSunken = colors.surfaceSunken || colors.background || surface;
    const surfaceOverlay = colors.surfaceOverlay || colors.glass || surface;
    const glassBg = colors.glass || surfaceOverlay || surface;
    const glassBorder = colors.glassBorder || colors.border || withAlpha(colors.text, 0.08);

    const accentSecondary = colors.accentSecondary || colors.secondary || colors.alert;
    const accentTertiary = colors.accentTertiary || colors.tertiary || surface;
    const accentHover = colors.accentHover || `color-mix(in srgb, ${colors.accent || '#000'} 85%, white)`;
    const accentMuted = colors.accentMuted || `color-mix(in srgb, ${colors.accent || '#000'} 65%, transparent)`;
    const accentRing = colors.accentRing || withAlpha(colors.accent, 0.25);
    const accentGradientFrom = colors.accentGradientFrom || colors.accent;
    const accentGradientTo = colors.accentGradientTo || accentSecondary || colors.accent;

    const textMuted = colors.textMuted || colors.text;
    const textSubtle = colors.textSubtle || textMuted;
    const onAccent = colors.onAccent || colors.text;

    const danger = colors.danger || colors.alert;
    const dangerMuted = colors.dangerMuted || danger;
    const success = colors.success || colors.accent;
    const successMuted = colors.successMuted || success;
    const warning = colors.warning || colors.accent;
    const warningMuted = colors.warningMuted || warning;

    const border = colors.border || withAlpha(colors.text, 0.12);
    const borderMuted = colors.borderMuted || withAlpha(colors.text, 0.06);
    const borderStrong = colors.borderStrong || withAlpha(colors.text, 0.4);

    const baseRadius = normalizeSizeToken(shapes.borderRadius || shapes.radius || '0px');
    const radiusXs = scaleSizeToken(baseRadius, 0.33);
    const radiusSm = scaleSizeToken(baseRadius, 0.66);
    const radiusMd = baseRadius || '0px';
    const radiusLg = scaleSizeToken(baseRadius, 1.5);
    const radiusXl = scaleSizeToken(baseRadius, 2);
    const radius2xl = scaleSizeToken(baseRadius, 2.66);

    const shadow2xl = shadows['2xl'] || shadows.xxl || DEFAULT_SHADOWS['2xl'];

    const buttonTokens = components.buttons || {};
    const dangerButton = buttonTokens.danger || {};
    const safeButton = buttonTokens.safe || {};
    const neutralButton = buttonTokens.neutral || {};

    const charts = components.charts || {};
    const usageBar = components.usageBar || {};
    const usageBarGradientFrom = usageBar.gradientFrom || accentGradientFrom;
    const usageBarGradientTo = usageBar.gradientTo || accentGradientTo;
    const usageBarGradient = usageBar.gradient || `linear-gradient(135deg, ${usageBarGradientFrom}, ${usageBarGradientTo})`;

    const consoleTokens = components.console || {};
    const consoleBase = consoleTokens.plasticBase || surface;
    const consoleLight = consoleTokens.plasticLight || 'color-mix(in srgb, var(--color-surface, #fff) 70%, white)';
    const consoleShadow = consoleTokens.plasticShadow || 'color-mix(in srgb, var(--color-surface, #fff) 70%, black)';
    const consoleBezel = consoleTokens.bezel || surfaceSunken;
    const consoleScreen = consoleTokens.screen || surfaceSunken;
    const consoleAccent = consoleTokens.accentOrange || colors.accent;
    const consoleNoise = consoleTokens.noise || 'none';

    const derivedVars = {
        '--color-background': background,
        // Surface & glass
        '--color-surface': surface,
        '--color-surface-elevated': surfaceElevated,
        '--color-surface-sunken': surfaceSunken,
        '--color-surface-overlay': surfaceOverlay,
        '--color-glass-bg': glassBg,
        '--color-glass-border': glassBorder,

        // Text
        '--color-on-surface': colors.text,
        '--color-on-surface-muted': textMuted,
        '--color-on-surface-subtle': textSubtle,

        // Accents
        '--color-accent': colors.accent,
        '--color-accent-secondary': accentSecondary,
        '--color-accent-tertiary': accentTertiary,
        '--color-accent-hover': accentHover,
        '--color-accent-muted': accentMuted,
        '--color-accent-ring': accentRing,
        '--color-accent-gradient-from': accentGradientFrom,
        '--color-accent-gradient-to': accentGradientTo,
        '--color-on-accent': onAccent,

        // Status
        '--color-danger': danger,
        '--color-danger-muted': dangerMuted,
        '--color-success': success,
        '--color-success-muted': successMuted,
        '--color-warning': warning,
        '--color-warning-muted': warningMuted,

        // Borders
        '--color-border': border,
        '--color-border-muted': borderMuted,
        '--color-border-strong': borderStrong,

        // Shadows
        '--shadow-xs': shadows.xs || DEFAULT_SHADOWS.xs,
        '--shadow-sm': shadows.sm || DEFAULT_SHADOWS.sm,
        '--shadow-md': shadows.md || DEFAULT_SHADOWS.md,
        '--shadow-lg': shadows.lg || DEFAULT_SHADOWS.lg,
        '--shadow-xl': shadows.xl || DEFAULT_SHADOWS.xl,
        '--shadow-2xl': shadow2xl,
        '--shadow-glass': shadows.glass || DEFAULT_SHADOWS.glass,
        '--shadow-focus-ring': shadows.focusRing || `0 0 0 3px ${accentRing}`,
        '--shadow-inset-sm': shadows.insetSm || DEFAULT_SHADOWS.insetSm,
        '--shadow-inset-md': shadows.insetMd || DEFAULT_SHADOWS.insetMd,

        // Buttons
        '--btn-danger-bg': dangerButton.bg || withAlpha(danger, 0.12),
        '--btn-danger-fg': dangerButton.fg || danger,
        '--btn-danger-border': dangerButton.border || withAlpha(danger, 0.2),
        '--btn-danger-hover': dangerButton.hover || withAlpha(danger, 0.18),
        '--btn-safe-bg': safeButton.bg || withAlpha(success, 0.12),
        '--btn-safe-fg': safeButton.fg || success,
        '--btn-safe-border': safeButton.border || withAlpha(success, 0.2),
        '--btn-safe-hover': safeButton.hover || withAlpha(success, 0.18),
        '--btn-neutral-bg': neutralButton.bg || withAlpha(border, 0.12),
        '--btn-neutral-fg': neutralButton.fg || textMuted,
        '--btn-neutral-border': neutralButton.border || withAlpha(border, 0.2),
        '--btn-neutral-hover': neutralButton.hover || withAlpha(border, 0.18),

        // Charts
        '--chart-safe': charts.safe || success,
        '--chart-safe-hover': charts.safeHover || successMuted,
        '--chart-blocked': charts.blocked || danger,
        '--chart-blocked-hover': charts.blockedHover || dangerMuted,
        '--chart-grid': charts.grid || withAlpha(textMuted, 0.15),

        // Usage bar
        '--usage-bar-bg': usageBar.bg || withAlpha(colors.accent, 0.1),
        '--usage-bar-blocked-bg': usageBar.blockedBg || withAlpha(danger, 0.1),
        '--usage-bar-gradient': usageBarGradient,

        // Typography projection
        '--font-theme-heading': typography.heading || typography.fontFamily,
        '--font-theme-ui': typography.body || typography.fontFamily,
        '--font-theme-mono': typography.mono || typography.fontFamily,
        '--font-theme-serif': typography.serif || typography.heading || 'serif',
        '--font-theme-calligraphy': typography.calligraphy || '--font-calligraphy',
        '--font-theme-letter-spacing': typography.letterSpacing || '0em',

        // Transitions
        '--transition-style': interactionMotion.style,
        '--transition-duration-base': interactionMotion.duration,
        '--transition-property-interactive': interactionMotion.properties,
        '--hover-transform': interactionMotion.hover,
        '--active-transform': interactionMotion.active,
        '--default-transition-duration': interactionMotion.duration,
        '--default-transition-timing-function': interactionMotion.style,

        // Effects projection
        '--blur-intensity': effects.blur,
        '--glow-shadow': effects.glow,
        '--glow-intensity': Number.isFinite(Number(effects.glow)) ? effects.glow : '1',
        '--scanline-opacity': effects.scanline,
        '--noise-opacity': effects.noise,

        // Shapes (Derived sizes)
        '--radius-xs': radiusXs,
        '--radius-sm': radiusSm,
        '--radius-md': radiusMd,
        '--radius-lg': radiusLg,
        '--radius-xl': radiusXl,
        '--radius-2xl': radius2xl,
        '--radius-pill': '9999px',
        '--theme-border-style': shapes.borderStyle || '1px solid',

        // Console presentation variables
        '--console-sidebar-width': normalizeSizeToken(layout.sidebarWidth) || autoVars['--layout-sidebar-width'],
        '--console-plastic-base': consoleBase || autoVars['--components-console-plastic-base'],
        '--console-plastic-light': consoleLight,
        '--console-plastic-shadow': consoleShadow,
        '--console-bezel': consoleBezel || autoVars['--components-console-bezel'],
        '--console-screen': consoleScreen || autoVars['--components-console-screen'],
        '--console-accent': consoleAccent || autoVars['--components-console-accent-orange'],
        '--console-noise': consoleNoise || autoVars['--components-console-noise'],

        // Canonical layout projection
        '--console-shell-padding': normalizeSizeToken(layout.shellPadding) || LAYOUT_DEFAULTS.shellPadding,
        '--console-shell-overflow': normalizeLayoutToken(layout.shellOverflow) || LAYOUT_DEFAULTS.shellOverflow,
        '--console-frame-display': normalizeLayoutToken(layout.frameDisplay) || LAYOUT_DEFAULTS.frameDisplay,
        '--console-frame-direction': normalizeLayoutToken(layout.frameDirection) || LAYOUT_DEFAULTS.frameDirection,
        '--console-frame-columns': normalizeLayoutToken(layout.frameColumns) || LAYOUT_DEFAULTS.frameColumns,
        '--console-frame-gap': normalizeSizeToken(layout.frameGap) || LAYOUT_DEFAULTS.frameGap,
        '--console-frame-padding': normalizeSizeToken(layout.framePadding) || LAYOUT_DEFAULTS.framePadding,
        '--console-frame-overflow': normalizeLayoutToken(layout.frameOverflow) || LAYOUT_DEFAULTS.frameOverflow,

        ...(normalizeSizeToken(layout.sidebarRatio) && { '--sidebar-ratio': normalizeSizeToken(layout.sidebarRatio) }),
        ...(normalizeSizeToken(layout.sidebarMin) && { '--layout-sidebar-min': normalizeSizeToken(layout.sidebarMin) }),
        ...(normalizeSizeToken(layout.sidebarMax) && { '--layout-sidebar-max': normalizeSizeToken(layout.sidebarMax) }),

        '--console-sidebar-flex': normalizeLayoutToken(layout.sidebarFlex) || LAYOUT_DEFAULTS.sidebarFlex,
        '--console-sidebar-padding': normalizeSizeToken(layout.sidebarPadding) || LAYOUT_DEFAULTS.sidebarPadding,
        '--console-sidebar-overflow': normalizeLayoutToken(layout.sidebarOverflow) || LAYOUT_DEFAULTS.sidebarOverflow,
        '--console-content-flex': normalizeLayoutToken(layout.contentFlex) || LAYOUT_DEFAULTS.contentFlex,
        '--console-content-padding': normalizeSizeToken(layout.contentPadding) || LAYOUT_DEFAULTS.contentPadding,
        '--console-content-border': normalizeLayoutToken(layout.contentBorder) || LAYOUT_DEFAULTS.contentBorder,
        '--console-content-overflow': normalizeLayoutToken(layout.contentOverflow) || LAYOUT_DEFAULTS.contentOverflow,

        '--panel-viewport-padding': normalizeSizeToken(layout.panelViewportPadding) || LAYOUT_DEFAULTS.panelViewportPadding,
        '--panel-viewport-overflow': normalizeLayoutToken(layout.panelViewportOverflow) || LAYOUT_DEFAULTS.panelViewportOverflow,
        '--sidebar-controls-gap': normalizeSizeToken(layout.sidebarControlsGap) || LAYOUT_DEFAULTS.sidebarControlsGap,
        '--sidebar-controls-padding': normalizeSizeToken(layout.sidebarControlsPadding) || LAYOUT_DEFAULTS.sidebarControlsPadding,
        '--nav-button-aspect': normalizeLayoutToken(layout.navButtonAspect) || LAYOUT_DEFAULTS.navButtonAspect,
        '--nav-button-height': normalizeSizeToken(layout.navButtonHeight) || LAYOUT_DEFAULTS.navButtonHeight,
        '--nav-button-width': normalizeSizeToken(layout.navButtonWidth) || LAYOUT_DEFAULTS.navButtonWidth,
        '--nav-button-padding': normalizeSizeToken(layout.navButtonPadding) || LAYOUT_DEFAULTS.navButtonPadding,
        '--nav-button-gap': normalizeSizeToken(layout.navButtonGap) || LAYOUT_DEFAULTS.navButtonGap,
        '--nav-button-margin': normalizeSizeToken(layout.navButtonMargin) || LAYOUT_DEFAULTS.navButtonMargin,
        '--nav-button-align': normalizeLayoutToken(layout.navButtonAlign) || LAYOUT_DEFAULTS.navButtonAlign,
        '--settings-button-height': normalizeSizeToken(layout.settingsButtonHeight) || LAYOUT_DEFAULTS.settingsButtonHeight,
        '--settings-button-padding': normalizeSizeToken(layout.settingsButtonPadding) || LAYOUT_DEFAULTS.settingsButtonPadding,
        '--settings-button-gap': normalizeSizeToken(layout.settingsButtonGap) || LAYOUT_DEFAULTS.settingsButtonGap,
        '--settings-button-group-padding': normalizeSizeToken(layout.settingsButtonGroupPadding) || LAYOUT_DEFAULTS.settingsButtonGroupPadding,
        '--settings-button-group-margin': normalizeSizeToken(layout.settingsButtonGroupMargin) || LAYOUT_DEFAULTS.settingsButtonGroupMargin,
        '--sidebar-logo-margin': normalizeSizeToken(layout.sidebarLogoMargin) || LAYOUT_DEFAULTS.sidebarLogoMargin,
        '--sidebar-logo-padding': normalizeSizeToken(layout.sidebarLogoPadding) || LAYOUT_DEFAULTS.sidebarLogoPadding,
        '--sidebar-logo-border': normalizeLayoutToken(layout.sidebarLogoBorder) || LAYOUT_DEFAULTS.sidebarLogoBorder,
        '--sidebar-controls-height': normalizeSizeToken(layout.sidebarControlsHeight) || LAYOUT_DEFAULTS.sidebarControlsHeight,

        // UI rail layout projection
        '--ui-rail-size': normalizeSizeToken(layout.railSize) || autoVars['--layout-rail-size'],
        '--ui-rail-base': normalizeLayoutToken(layout.railBase) || autoVars['--layout-rail-base'],
        '--ui-rail-edge': normalizeLayoutToken(layout.railEdge) || autoVars['--layout-rail-edge'],
        '--ui-unit-padding': normalizeSizeToken(layout.unitPadding) || autoVars['--layout-unit-padding'],
        '--ui-rail-sidebar-width': normalizeSizeToken(layout.railSidebarWidth) || autoVars['--layout-rail-sidebar-width'],
    };

    // Merge auto-flattened vars and derived vars. Derived vars override the auto-flattened ones.
    return {
        ...autoVars,
        ...derivedVars
    };
}

/**
 * Injects CSS variables into a DOM element.
 * 
 * @param {HTMLElement} element - The target element (usually document.documentElement)
 * @param {Object} variables - The dictionary of CSS variables
 */
export function injectCSSVariables(element, variables) {
    for (const [key, value] of Object.entries(variables)) {
        if (value === undefined || value === null || value === '') continue;
        element.style.setProperty(key, value);
    }
}

/**
 * Injects custom CSS rules into a dedicated style tag.
 * Used for theme-specific overrides (animations, complex selectors) that cannot be handled by CSS variables.
 * 
 * @param {string} cssContent - Raw CSS string
 */
export function injectCustomCSS(cssContent) {
    const STYLE_ID = 'theme-custom-css';
    let styleTag = document.getElementById(STYLE_ID);

    if (!styleTag) {
        styleTag = document.createElement('style');
        styleTag.id = STYLE_ID;
        document.head.appendChild(styleTag);
    }

    styleTag.textContent = cssContent || '';
}
