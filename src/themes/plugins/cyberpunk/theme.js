import { Theme } from '../../core/base.js';

const CYBERPUNK_CSS = `
[data-theme='cyberpunk'] {
  --ui-mesh:
    linear-gradient(90deg, rgba(0, 243, 255, 0.1) 1px, transparent 1px),
    linear-gradient(0deg, rgba(106, 92, 255, 0.1) 1px, transparent 1px),
    radial-gradient(circle at 20% 20%, rgba(0, 243, 255, 0.18), transparent 55%);
  --ui-mesh-size: 120px 120px, 120px 120px, 220px 220px;
  --ui-mesh-opacity: 0.24;
  --ui-mesh-blend: screen;
  --entropy-intensity: 0.34;
}

[data-theme='cyberpunk'] .console-shell {
  background:
    radial-gradient(circle at top left, rgba(0, 243, 255, 0.08), transparent 28%),
    radial-gradient(circle at bottom right, rgba(106, 92, 255, 0.14), transparent 34%),
    linear-gradient(180deg, rgba(2, 4, 10, 0.96), rgba(6, 10, 24, 0.96));
  width: 100%;
  height: 100%;
}

[data-theme='cyberpunk'] .console-frame {
  height: 100%;
  background: transparent;
  border-radius: 0;
  box-shadow: none;
  overflow: visible;
}

[data-theme='cyberpunk'] .console-sidebar {
  position: relative;
  z-index: 10;
  overflow: visible;
  isolation: isolate;
  border-radius: 0;
  border: 6px solid #07101f;
  border-top-color: #102241;
  border-bottom-color: #02050d;
  border-right: 0;
  background:
    linear-gradient(180deg, rgba(215, 235, 245, 0.98), rgba(185, 211, 228, 0.98));
  box-shadow:
    0 0 0 6px #030814,
    0 0 24px rgba(0, 243, 255, 0.12),
    inset 0 -1px 0 rgba(0, 0, 0, 0.22),
    inset 1px 1px 0 rgba(255, 255, 255, 0.18);
  clip-path: inset(-101px 0 -101px -101px);
}

[data-theme='cyberpunk'] .console-sidebar::after {
  content: '';
  position: absolute;
  top: -12px;
  bottom: -12px;
  right: 0;
  width: var(--ui-rail-size, 20px);
  background:
    linear-gradient(180deg, rgba(0, 243, 255, 0.16), rgba(30, 27, 75, 0.94)),
    linear-gradient(180deg, rgba(255, 255, 255, 0.1), transparent 35%, rgba(0, 0, 0, 0.28));
  border-left: 1px solid rgba(0, 243, 255, 0.22);
  border-right: 1px solid rgba(255, 255, 255, 0.08);
  pointer-events: none;
  z-index: 100;
}

[data-theme='cyberpunk'] .console-content {
  position: relative;
  z-index: 5;
  isolation: isolate;
  border-radius: 0;
  border: 6px solid #07101f;
  border-top-color: #102241;
  border-bottom-color: #02050d;
  border-left: 0;
  display: flex;
  flex-direction: column;
  min-width: 0;
  overflow: visible;
  background:
    linear-gradient(180deg, rgba(215, 235, 245, 0.98), rgba(185, 211, 228, 0.98));
  box-shadow:
    0 0 0 6px #030814,
    0 0 24px rgba(0, 243, 255, 0.12),
    inset 0 -1px 0 rgba(0, 0, 0, 0.22),
    inset 0 1px 0 rgba(255, 255, 255, 0.18);
  clip-path: inset(-101px -101px -101px 0);
}

[data-theme='cyberpunk'] .console-content::before {
  content: '';
  position: absolute;
  top: -12px;
  bottom: -12px;
  left: 0;
  width: var(--ui-rail-size, 20px);
  background:
    linear-gradient(180deg, rgba(0, 243, 255, 0.16), rgba(30, 27, 75, 0.94)),
    linear-gradient(180deg, rgba(255, 255, 255, 0.1), transparent 35%, rgba(0, 0, 0, 0.28));
  border-right: 1px solid rgba(0, 243, 255, 0.22);
  border-left: 1px solid rgba(255, 255, 255, 0.08);
  pointer-events: none;
  z-index: 100;
}

/* Stacked panels each have a complete perimeter; only landscape has a side join. */
html[data-theme='cyberpunk'] [data-ui-orientation='portrait'] :is(.console-sidebar, .console-content) {
  border-inline: 6px solid #07101f;
  clip-path: none;
}

[data-theme='cyberpunk'] .artifact-workspace [data-artifact-gallery-nav-track='true'] {
  /* The dock shares the dark instrument bay, rather than the light shell. */
  --color-surface: #071727;
  --color-surface-elevated: #102a42;
  --color-surface-sunken: #050913;
  --color-on-surface: #def3ff;
  --color-on-surface-muted: #9dc2df;
  --color-on-surface-subtle: #88b5d7;
  --color-border: #42647a;
  background: var(--color-surface-overlay);
}

[data-theme='cyberpunk'] .nav-button {
  --btn-rgb: 0, 243, 255;
  background:
    radial-gradient(circle at 50% 50%, rgba(0, 243, 255, 0.22) 0%, rgba(255, 255, 255, 0.75) 70%, rgba(173, 216, 230, 0.96) 100%);
  border: 1px solid rgba(0, 243, 255, 0.2);
  color: rgba(8, 12, 24, 0.94);
  text-shadow: 0 1px 0 rgba(255, 255, 255, 0.58);
  box-shadow:
    0 0 0 1px rgba(4, 10, 22, 0.16),
    0 2px 6px rgba(0, 0, 0, 0.18),
    inset 0 0 0 1px rgba(255, 255, 255, 0.25);
}

[data-theme='cyberpunk'] .nav-button-icon {
  flex-shrink: 0;
}

[data-theme='cyberpunk'] .nav-button-label {
  min-width: 0;
  font-size: 14px;
  line-height: 1.25;
  word-break: keep-all;
}

[data-theme='cyberpunk'] .nav-button.is-active,
[data-theme='cyberpunk'] .nav-button:active {
  background: linear-gradient(145deg, #083047, #102241);
  color: #def3ff;
  text-shadow: none;
  box-shadow:
    0 0 0 1px rgba(0, 243, 255, 0.46),
    inset 0 0 18px rgba(0, 243, 255, 0.55),
    inset 0 0 36px rgba(106, 92, 255, 0.24),
    0 0 18px rgba(0, 243, 255, 0.32);
}

[data-theme='cyberpunk'] .settings-button {
  background: #1d4ed8;
  border-color: #1e40af;
  color: #f8fbff;
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.15),
    inset 0 -1px 0 rgba(0, 0, 0, 0.2),
    0 4px 0 #1e3a8a,
    0 6px 6px rgba(0, 0, 0, 0.5);
}

[data-theme='cyberpunk'] .settings-button:hover {
  background: #2563eb;
}
`;

/**
 * Independent cyberpunk canonical theme scaffold.
 * This theme no longer derives implementation state from the entropy plugin.
 */
export const CyberpunkTheme = new Theme({
    id: 'cyberpunk',
    meta: {
        name: 'PROJECT: CYBERPUNK',
        description: 'Neon Grid // Independent Interface',
    },
    customCSS: CYBERPUNK_CSS,
    tokens: {
        colors: {
            primary: '#d7ebf5',
            accent: '#00f3ff',
            alert: '#ff2d72',
            text: '#07121f',
            background: '#02040a',
            surface: '#d7ebf5',
            surfaceVariant: '#b9d3e4',
            surfaceSunken: '#050913',
            surfaceOverlay: 'rgba(8, 14, 24, 0.92)',
            textMuted: '#3d4e5d',
            textSubtle: '#5f7488',
            accentSecondary: '#6a5cff',
            accentTertiary: '#1f2937',
            accentHover: '#33f6ff',
            accentMuted: 'rgba(0, 243, 255, 0.24)',
            accentRing: 'rgba(0, 243, 255, 0.22)',
            accentGradientFrom: '#00f3ff',
            accentGradientTo: '#6a5cff',
            onAccent: '#001219',
            danger: '#ff2d72',
            dangerMuted: '#ff4f8a',
            success: '#34d399',
            successMuted: '#6ee7b7',
            warning: '#f59e0b',
            warningMuted: '#fbbf24',
            glass: 'rgba(8, 14, 24, 0.62)',
            glassBorder: 'rgba(0, 243, 255, 0.28)',
            border: 'rgba(148, 163, 184, 0.28)',
            borderMuted: 'rgba(148, 163, 184, 0.16)',
            borderStrong: 'rgba(0, 243, 255, 0.34)',
        },
        typography: {
            fontFamily: '"Rajdhani", var(--font-sans)',
            letterSpacing: '0.03em',
            heading: '"Orbitron", "Rajdhani", var(--font-sans)',
            body: '"Rajdhani", var(--font-sans)',
            mono: '"Share Tech Mono", var(--font-mono)',
        },
        shapes: {
            borderRadius: '0px',
            borderStyle: '4px solid',
        },
        effects: {
            blur: '0',
            glow: '0 0 18px rgba(0, 243, 255, 0.42)',
            scanline: '0',
            noise: '0',
        },
        layout: {
            railSize: '20px',
            railBase: '#1a1a1a',
            railEdge: 'rgba(255, 255, 255, 0.1)',
            unitPadding: '12px',
            railSidebarWidth: '160px',
            frameColumns: 'var(--console-sidebar-width) minmax(0, 1fr)',
            sidebarPadding: 'var(--ui-unit-padding) calc(var(--ui-unit-padding) + var(--ui-rail-size)) var(--ui-unit-padding) var(--ui-unit-padding)',
            contentPadding: 'var(--ui-unit-padding) var(--ui-unit-padding) var(--ui-unit-padding) calc(var(--ui-unit-padding) + var(--ui-rail-size))',
            sidebarControlsGap: '12px',
            sidebarControlsPadding: '10px 0',
            navButtonAspect: 'auto',
            navButtonHeight: '64px',
            navButtonWidth: '100%',
            navButtonPadding: '0 8px',
            navButtonGap: '8px',
            navButtonMargin: '0px',
            navButtonAlign: 'stretch',
            settingsButtonHeight: '42px',
            settingsButtonPadding: '0px',
            settingsButtonGap: '0px',
            settingsButtonGroupPadding: '6px',
            settingsButtonGroupMargin: '0px',
        },
        shadows: {
            sm: '0 1px 2px rgba(0, 0, 0, 0.18)',
            md: '0 4px 8px rgba(0, 0, 0, 0.24)',
            lg: '0 12px 24px rgba(0, 0, 0, 0.34)',
            glass: '0 10px 30px rgba(0, 243, 255, 0.08)',
        },
        components: {
            console: {
                plasticBase: '#d7ebf5',
                plasticLight: '#f1f8ff',
                plasticShadow: '#9db4c7',
                bezel: '#0a0f1a',
                screen: '#02040a',
                accentOrange: '#00f3ff',
            },
        },
    },
    audio: {
        bgm: 'neon-grid-hum.mp3',
        clickSound: 'relay-click.mp3',
        alertSound: 'neon-alarm.mp3',
        hoverSound: 'signal-chirp.mp3',
    },
    behaviors: {
        lensHoverAction: 'entropy',
        scrollPhysics: 'step',
        transitionStyle: 'instant',
        transitionDuration: 1500,
        cursorStyle: 'crosshair',
    },
    slots: {
        background: 'starfield',
    },
});
