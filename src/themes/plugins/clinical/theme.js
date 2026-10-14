import { Theme } from '../../core/base.js';

const CLINICAL_CSS = `
/* Clinical Component Styles */
[data-theme='clinical'] .ui-module {
    background: var(--color-surface-elevated);
    border: 1px solid var(--color-border);
    box-shadow: none;
    border-radius: var(--radius-md);
}

[data-theme='clinical'] .ui-panel {
    background: var(--color-surface);
    border: 1px solid var(--color-border);
}

[data-theme='clinical'] .entropy-header {
    font-family: var(--font-display);
    letter-spacing: -0.01em;
    text-transform: none;
    text-shadow: none;
    font-weight: 700;
}

[data-theme='clinical'] :is(.ui-btn, .entropy-btn) {
    background: white;
    border: 1px solid var(--color-border-strong);
    color: var(--color-text);
    text-transform: uppercase;
    font-size: 11px;
    letter-spacing: 0.05em;
    box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);
    transition: all 0.15s ease;
}

[data-theme='clinical'] :is(.ui-btn, .entropy-btn):hover {
    border-color: var(--color-text);
    background: #F9FAFB;
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05);
}

[data-theme='clinical'] :is(.ui-btn, .entropy-btn).active {
    background: var(--color-text);
    color: white;
    border-color: var(--color-text);
}

[data-theme='clinical'] :is(.ui-btn, .entropy-btn).alert {
    border-color: var(--color-danger);
    color: var(--color-danger);
}

[data-theme='clinical'] :is(.ui-btn, .entropy-btn).alert:hover {
    background: var(--color-danger);
    color: white;
}

/* Sidebar (Clinical Console) */
[data-theme='clinical'] .console-sidebar {
    background: var(--color-surface);
    border-right: 1px solid var(--color-border);
    box-shadow: none;
}

[data-theme='clinical'] .sidebar-controls {
    gap: var(--sidebar-controls-gap);
    padding: var(--sidebar-controls-padding);
    height: auto;
}

[data-theme='clinical'] .sidebar-controls::before {
    content: 'LABORATORY';
    display: block;
    font-size: 0.7rem;
    font-weight: 700;
    letter-spacing: 0.35em;
    color: var(--color-on-surface-subtle);
    margin: 0 0 16px 0;
    padding-bottom: 12px;
    border-bottom: 1px solid var(--color-border);
}

[data-theme='clinical'] .nav-button {
    display: flex;
    align-items: center;
    justify-content: flex-start;
    height: var(--nav-button-height);
    padding: var(--nav-button-padding);
    gap: var(--nav-button-gap);
    background: transparent;
    border: 1px solid transparent;
    border-radius: var(--radius-sm);
    color: var(--color-on-surface-muted);
    font-family: var(--font-theme-ui);
    font-size: 0.72rem;
    font-weight: 600;
    letter-spacing: 0.22em;
    text-transform: uppercase;
    transition: background 0.15s ease, border-color 0.15s ease, color 0.15s ease;
}

[data-theme='clinical'] .nav-button:hover {
    background: var(--color-surface-elevated);
    border-color: var(--color-border);
    color: var(--color-on-surface);
}

[data-theme='clinical'] .nav-button.is-active {
    background: color-mix(in srgb, var(--color-accent) 8%, white);
    border-color: color-mix(in srgb, var(--color-accent) 30%, var(--color-border));
    color: var(--color-accent);
}

[data-theme='clinical'] .nav-button-lamp {
    left: 8px;
    width: 2px;
    height: 60%;
    background: var(--color-accent);
    opacity: 0;
    border-radius: 999px;
    transition: opacity 0.15s ease;
}

[data-theme='clinical'] .nav-button.is-active .nav-button-lamp {
    opacity: 1;
}

[data-theme='clinical'] .nav-button-icon {
    width: 18px;
    height: 18px;
    color: inherit;
}

[data-theme='clinical'] .nav-button-icon svg {
    stroke-width: 1.6;
    stroke-linecap: square;
    stroke-linejoin: miter;
}

[data-theme='clinical'] .nav-button-label {
    font-weight: 600;
    letter-spacing: inherit;
}

[data-theme='clinical'] .settings-button-group {
    border-top: 1px solid var(--color-border);
}

[data-theme='clinical'] .settings-button {
    display: flex;
    align-items: center;
    justify-content: flex-start;
    height: var(--settings-button-height);
    padding: var(--settings-button-padding);
    gap: var(--settings-button-gap);
    background: transparent;
    border: 1px solid var(--color-border);
    border-radius: var(--radius-sm);
    color: var(--color-on-surface-muted);
    font-family: var(--font-theme-ui);
    font-size: 0.72rem;
    font-weight: 600;
    letter-spacing: 0.22em;
    text-transform: uppercase;
    transition: background 0.15s ease, border-color 0.15s ease, color 0.15s ease;
}

[data-theme='clinical'] .settings-button:hover,
[data-theme='clinical'] .settings-button.is-active {
    border-color: color-mix(in srgb, var(--color-accent) 30%, var(--color-border));
    color: var(--color-accent);
    background: color-mix(in srgb, var(--color-accent) 6%, white);
}

/* Input Fields */
[data-theme='clinical'] .ui-input {
    background: white;
    border: 1px solid var(--color-border-strong);
    color: var(--color-text);
    box-shadow: inset 0 1px 2px rgba(0, 0, 0, 0.02);
}

[data-theme='clinical'] .ui-input:focus {
    border-color: var(--color-primary);
    outline: 2px solid rgba(0, 0, 0, 0.05);
}

/* Special: Grid Background */
[data-theme='clinical'] #dashboard-root::before {
    content: '';
    position: absolute;
    inset: 0;
    background-image:
        linear-gradient(rgba(0,0,0,0.05) 1px, transparent 1px),
        linear-gradient(90deg, rgba(0,0,0,0.05) 1px, transparent 1px);
    background-size: 20px 20px;
    pointer-events: none;
    z-index: 0;
    opacity: 0.5;
}

[data-theme='clinical'] ::-webkit-scrollbar {
    width: 8px;
    height: 8px;
    background: transparent;
}

[data-theme='clinical'] ::-webkit-scrollbar-thumb {
    background: #E5E7EB;
    border-radius: 4px;
    border: 2px solid var(--color-background);
}

[data-theme='clinical'] ::-webkit-scrollbar-track {
    background: transparent;
}
`;

export const ClinicalTheme = new Theme({
    id: 'clinical',
    meta: {
        name: 'Clinical Trial',
        description: 'Immaculate, sterile, high-contrast.',
    },
    customCSS: CLINICAL_CSS,
    tokens: {
        colors: {
            primary: '#111827',
            accent: '#FF3B30', // Medical Red
            alert: '#FF3B30',
            text: '#111827',

            background: '#FFFFFF',
            surface: '#F8F9FA',
            surfaceVariant: '#F1F3F5',
            surfaceSunken: '#F1F3F5',
            surfaceOverlay: 'rgba(0, 0, 0, 0.02)',

            textMuted: '#6B7280',
            textSubtle: '#9CA3AF',

            glass: 'rgba(255, 255, 255, 0.9)',
            glassBorder: 'rgba(0, 0, 0, 0.05)',
            border: '#E5E7EB',
            borderMuted: '#F3F4F6',
            borderStrong: '#D1D5DB',

            accentSecondary: '#34C759', // Pharmacy Green
            accentTertiary: '#007AFF', // Blue
            accentHover: '#FF3B30',
            accentMuted: 'rgba(255, 59, 48, 0.1)',
            accentRing: 'rgba(255, 59, 48, 0.2)',
            accentGradientFrom: '#FF3B30',
            accentGradientTo: '#FF453A',
            onAccent: '#FFFFFF',

            danger: '#FF3B30',
            dangerMuted: '#FEF2F2',
            success: '#34C759',
            successMuted: '#F0FDF4',
            warning: '#FFCC00',
            warningMuted: '#FFFBEB',
        },
        typography: {
            // Families must resolve to faces the app actually ships (see the
            // @font-face set in themes/styles/tokens/typography.css).
            fontFamily: 'var(--font-sans)',
            letterSpacing: '-0.01em',
            heading: 'var(--font-sans)',
            body: 'var(--font-sans)',
            mono: 'var(--font-mono)',
        },
        shapes: {
            borderRadius: '2px',
            borderStyle: 'solid',
        },
        effects: {
            blur: '0px',
            glow: 'none',
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
            panelViewportPadding: '16px 24px',

            // Theme-specific styling - Inherit default metrics but override minimal feel
            railBase: '#FFFFFF',
            railEdge: '#E5E7EB',
            sidebarPadding: '12px 0',
            sidebarControlsPadding: '24px 16px',
            sidebarControlsGap: '8px',
            navButtonAspect: 'auto',
            navButtonHeight: '44px',
            navButtonWidth: '100%',
            navButtonPadding: '0 12px',
            navButtonGap: '12px',
            navButtonMargin: '0',
            navButtonAlign: 'stretch',
            settingsButtonHeight: '44px',
            settingsButtonPadding: '0 12px',
            settingsButtonGap: '10px',
            settingsButtonGroupPadding: '12px 0 0',
            settingsButtonGroupMargin: '12px 0 0',
        },
        shadows: {
            sm: '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
            md: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
            lg: '0 10px 15px -3px rgba(0, 0, 0, 0.1)',
            glass: '0 4px 30px rgba(0, 0, 0, 0.1)',
        }
    },
    audio: {
        bgm: null,
        clickSound: 'click-clean.mp3', // Placeholder
        alertSound: 'alert-medical.mp3', // Placeholder
        hoverSound: null,
    },
    behaviors: {
        lensHoverAction: 'none',
        scrollPhysics: 'default',
        transitionStyle: 'shutter', // Custom Shutter Effect
        transitionDuration: '0.4s',
        cursorStyle: 'default',
    },
    slots: {
        background: null,
        // weatherSystem: 'none',
        // hudStyle: 'clinical',
    }
});
