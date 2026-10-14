/**
 * Layout Defaults
 * 
 * Centralized default values for layout tokens.
 * Used by utils.js to ensure consistent fallbacks across all themes.
 * 
 * Themes can override any of these values in their layout token definitions.
 */

export const LAYOUT_DEFAULTS = {
    // =========================================
    // Frame Structure
    // =========================================
    frameDisplay: 'grid',
    frameDirection: 'row',
    frameColumns: 'var(--console-sidebar-width) minmax(0, 1fr)',
    frameGap: '0px',
    framePadding: '0px',
    frameOverflow: 'visible',
    shellPadding: '0px',
    shellOverflow: 'visible',

    // =========================================
    // Sidebar Dimensions
    // =========================================
    sidebarRatio: '24%',
    sidebarMin: '240px',
    sidebarMax: '420px',
    sidebarFlex: '0 0 auto',
    sidebarPadding: '0px',
    sidebarOverflow: 'visible',

    // =========================================
    // Content Area
    // =========================================
    contentFlex: '1 1 auto',
    contentPadding: '0px',
    contentBorder: 'none',
    contentOverflow: 'visible',

    // =========================================
    // Panel Viewport
    // =========================================
    panelViewportPadding: '0px',
    panelViewportOverflow: 'visible',

    // =========================================
    // Sidebar Controls
    // =========================================
    sidebarControlsGap: '12px',
    sidebarControlsPadding: '10px 0',
    sidebarControlsHeight: '100%',

    // =========================================
    // Navigation Buttons
    // =========================================
    navButtonAspect: '1 / 1',
    navButtonHeight: 'auto',
    navButtonWidth: '100%',
    navButtonPadding: '0px',
    navButtonGap: '0px',
    navButtonMargin: '0px',
    navButtonAlign: 'stretch',

    // =========================================
    // Settings Buttons
    // =========================================
    settingsButtonHeight: 'auto',
    settingsButtonPadding: '0px',
    settingsButtonGap: '0px',
    settingsButtonGroupPadding: '0px',
    settingsButtonGroupMargin: '0px',

    // =========================================
    // Sidebar Logo
    // =========================================
    sidebarLogoMargin: '0px',
    sidebarLogoPadding: '0px',
    sidebarLogoBorder: 'none',
};
