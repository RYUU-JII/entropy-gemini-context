import { Theme } from '../../core/base.js';

const SCP_CSS = `
/* SCP Component Styles */
[data-theme='scp'] .ui-module {
    background: var(--color-surface-elevated);
    border: 1px solid var(--color-border);
    box-shadow: none;
    border-radius: var(--radius-md);
}

[data-theme='scp'] .ui-panel {
    background: var(--color-surface);
    border: 1px solid var(--color-border);
}

[data-theme='scp'] .entropy-header {
    font-family: var(--font-display);
    letter-spacing: -0.01em;
    text-transform: none;
    text-shadow: none;
    font-weight: 700;
}

[data-theme='scp'] :is(.ui-btn, .entropy-btn) {
    background: var(--color-surface-elevated);
    border: 1px solid var(--color-border-strong);
    color: var(--color-text);
    text-transform: uppercase;
    font-size: 11px;
    letter-spacing: 0.05em;
    box-shadow: 0 1px 2px rgba(0, 0, 0, 0.2);
    transition: all 0.15s ease;
}

[data-theme='scp'] :is(.ui-btn, .entropy-btn):hover {
    border-color: var(--color-text);
    background: var(--color-surface-variant);
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.3);
}

[data-theme='scp'] :is(.ui-btn, .entropy-btn).active {
    background: var(--color-text);
    color: var(--color-background);
    border-color: var(--color-text);
}

[data-theme='scp'] :is(.ui-btn, .entropy-btn).alert {
    border-color: var(--color-danger);
    color: var(--color-danger);
}

[data-theme='scp'] :is(.ui-btn, .entropy-btn).alert:hover {
    background: var(--color-danger);
    color: var(--color-on-accent);
}

/* Sidebar (Secure Console) - Aligned to Clinical form */
[data-theme='scp'] .console-sidebar {
    background: var(--color-surface);
    border-right: 1px solid var(--color-border);
    box-shadow: none;
}

[data-theme='scp'] .sidebar-controls {
    gap: var(--sidebar-controls-gap);
    padding: var(--sidebar-controls-padding);
    height: auto;
}

[data-theme='scp'] .sidebar-controls::before {
    content: 'LABORATORY';
    /* Pair to CLINICAL */
    display: block;
    font-size: 0.7rem;
    font-weight: 700;
    letter-spacing: 0.35em;
    color: var(--color-on-surface-subtle);
    margin: 0 0 16px 0;
    padding-bottom: 12px;
    border-bottom: 1px solid var(--color-border);
}

[data-theme='scp'] .nav-button {
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

[data-theme='scp'] .nav-button:hover {
    background: var(--color-surface-elevated);
    border-color: var(--color-border);
    color: var(--color-on-surface);
}

[data-theme='scp'] .nav-button.is-active {
    background: color-mix(in srgb, var(--color-accent) 12%, var(--color-surface));
    border-color: color-mix(in srgb, var(--color-accent) 40%, var(--color-border));
    color: var(--color-accent);
}

[data-theme='scp'] .nav-button-lamp {
    left: 8px;
    width: 2px;
    height: 60%;
    background: var(--color-accent);
    opacity: 0;
    border-radius: 999px;
    transition: opacity 0.15s ease;
}

[data-theme='scp'] .nav-button.is-active .nav-button-lamp {
    opacity: 1;
}

[data-theme='scp'] .nav-button-icon {
    width: 18px;
    height: 18px;
    color: inherit;
}

[data-theme='scp'] .nav-button-icon svg {
    stroke-width: 1.6;
    stroke-linecap: square;
    stroke-linejoin: miter;
}

[data-theme='scp'] .nav-button-label {
    font-weight: 600;
    letter-spacing: inherit;
}

[data-theme='scp'] .settings-button-group {
    border-top: 1px solid var(--color-border);
}

[data-theme='scp'] .settings-button {
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

[data-theme='scp'] .settings-button:hover,
[data-theme='scp'] .settings-button.is-active {
    border-color: color-mix(in srgb, var(--color-accent) 40%, var(--color-border));
    color: var(--color-accent);
    background: color-mix(in srgb, var(--color-accent) 10%, var(--color-surface));
}

/* Input Fields */
[data-theme='scp'] .ui-input {
    background: var(--color-surface-sunken);
    border: 1px solid var(--color-border-strong);
    color: var(--color-text);
    box-shadow: inset 0 1px 2px rgba(0, 0, 0, 0.2);
}

[data-theme='scp'] .ui-input:focus {
    border-color: var(--color-accent);
    outline: 2px solid rgba(255, 0, 0, 0.1);
}

/* Special: Foundation Grid Background */
[data-theme='scp'] #dashboard-root::before {
    content: '';
    position: absolute;
    inset: 0;
    background-image:
        linear-gradient(rgba(255, 255, 255, 0.03) 1px, transparent 1px),
        linear-gradient(90deg, rgba(255, 255, 255, 0.03) 1px, transparent 1px);
    background-size: 40px 40px;
    pointer-events: none;
    z-index: 0;
    opacity: 0.8;
}

[data-theme='scp'] ::-webkit-scrollbar {
    width: 8px;
    height: 8px;
    background: transparent;
}

[data-theme='scp'] ::-webkit-scrollbar-thumb {
    background: var(--color-border-strong);
    border-radius: 4px;
    border: 2px solid var(--color-background);
}

[data-theme='scp'] ::-webkit-scrollbar-track {
    background: transparent;
}
`;

export const SCPTheme = new Theme({
    id: 'scp',
    meta: {
        name: 'SCP Foundation',
        description: 'Secure. Contain. Protect. Administer anomalies with brutalist efficiency.',
    },
    customCSS: SCP_CSS,
    tokens: {
        colors: {
            primary: '#111111',
            accent: '#ff0000', // Warning Red
            alert: '#ff0000',
            text: '#eeeeee',

            background: '#050505',
            surface: '#111111',
            surfaceVariant: '#1a1a1a',
            surfaceSunken: '#000000',
            surfaceOverlay: 'rgba(255, 255, 255, 0.05)',

            textMuted: '#888888',
            textSubtle: '#555555',

            glass: 'rgba(10, 10, 10, 0.95)',
            glassBorder: 'rgba(255, 255, 255, 0.1)',
            border: '#222222',
            borderMuted: '#1a1a1a',
            borderStrong: '#444444',

            accentSecondary: '#ffffff',
            accentTertiary: '#ff6600',
            accentHover: '#ff3333',
            accentMuted: 'rgba(255, 0, 0, 0.1)',
            accentRing: 'rgba(255, 0, 0, 0.3)',
            accentGradientFrom: '#ff0000',
            accentGradientTo: '#990000',
            onAccent: '#FFFFFF',

            danger: '#ff0000',
            dangerMuted: '#330000',
            success: '#00ff41', // Matrix/Terminal Green
            successMuted: '#002200',
            warning: '#ffcc00',
            warningMuted: '#332b00',
        },
        typography: {
            fontFamily: '"Courier Prime", "JetBrains Mono", var(--font-mono)',
            letterSpacing: '0.02em',
            heading: '"Courier Prime", var(--font-serif)',
            body: '"Courier Prime", var(--font-serif)',
            mono: '"JetBrains Mono", var(--font-mono)',
        },
        shapes: {
            borderRadius: '2px', // Matches Clinical
            borderStyle: 'solid',
        },
        effects: {
            blur: '0px',
            glow: '0 0 10px rgba(255, 0, 0, 0.2)',
            scanline: 'subtle',
            noise: '0.02',
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

            // Theme-specific styling
            railBase: '#111111',
            railEdge: '#222222',
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
            sm: 'none',
            md: 'none',
            lg: 'none',
            glass: '0 4px 30px rgba(0, 0, 0, 0.5)',
        }
    },
    audio: {
        bgm: null,
        clickSound: 'typewriter-clack.mp3',
        alertSound: 'foundation-alarm.mp3',
        hoverSound: null,
    },
    behaviors: {
        lensHoverAction: 'static',
        scrollPhysics: 'mechanical',
        transitionStyle: 'blink', // Custom Blink Effect
        transitionDuration: '0.2s',
        cursorStyle: 'default',
    },
    slots: {
        background: null, // TODO: 'foundation-concrete' texture
        // weatherSystem: 'none',
        // hudStyle: 'foundation', // Not implemented
    }
});
