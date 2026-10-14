import { UTILITY_COLOR_PALETTE } from './src/themes/styles/tokens/utilityColorPalette.js';

const withAlpha = (variable) =>
  `color-mix(in srgb, var(${variable}) calc(<alpha-value> * 100%), transparent)`;

export default {
  darkMode: ['class', '.dark'],
  theme: {
    extend: {
      // ═══════════════════════════════════════════════════════════════
      // COLORS (All CSS Variable tokens)
      // ═══════════════════════════════════════════════════════════════
      colors: {
        ...UTILITY_COLOR_PALETTE,
        // Surface (backgrounds)
        surface: {
          DEFAULT: withAlpha('--color-surface'),
          elevated: withAlpha('--color-surface-elevated'),
          sunken: withAlpha('--color-surface-sunken'),
          overlay: withAlpha('--color-surface-overlay'),
          variant: withAlpha('--color-surface-elevated'),
        },
        // Glass effect
        glass: {
          bg: withAlpha('--color-glass-bg'),
          border: withAlpha('--color-glass-border'),
        },
        // Accent (primary brand color)
        accent: {
          DEFAULT: withAlpha('--color-accent'),
          hover: withAlpha('--color-accent-hover'),
          muted: withAlpha('--color-accent-muted'),
          ring: withAlpha('--color-accent-ring'),
          secondary: withAlpha('--color-accent-secondary'),
          tertiary: withAlpha('--color-accent-tertiary'),
        },
        'on-accent': withAlpha('--color-on-accent'),
        'on-surface': {
          DEFAULT: withAlpha('--color-on-surface'),
          muted: withAlpha('--color-on-surface-muted'),
          subtle: withAlpha('--color-on-surface-subtle'),
        },
        // Semantic status colors
        danger: withAlpha('--color-danger'),
        success: withAlpha('--color-success'),
        warning: withAlpha('--color-warning'),
        // Border colors
        border: {
          DEFAULT: withAlpha('--color-border'),
          muted: withAlpha('--color-border-muted'),
          strong: withAlpha('--color-border-strong'),
        },
      },

      // ═══════════════════════════════════════════════════════════════
      // TEXT COLORS (on-surface variants)
      // ═══════════════════════════════════════════════════════════════
      textColor: {
        'on-surface': {
          DEFAULT: withAlpha('--color-on-surface'),
          muted: withAlpha('--color-on-surface-muted'),
        },
      },

      // ═══════════════════════════════════════════════════════════════
      // FONT FAMILIES (Theme-aware)
      // ═══════════════════════════════════════════════════════════════
      fontFamily: {
        sans: ['var(--font-theme-ui)', 'var(--font-sans)', 'sans-serif'],
        mono: ['var(--font-theme-mono)', 'var(--font-mono)', 'monospace'],
        heading: ['var(--font-theme-heading)', 'var(--font-sans)', 'sans-serif'],
        serif: ['var(--font-theme-serif)', 'var(--font-serif)', 'serif'],
        calligraphy: ['var(--font-theme-calligraphy)', 'cursive'],
      },

      // ═══════════════════════════════════════════════════════════════
      // BOX SHADOWS (CSS Variable tokens)
      // ═══════════════════════════════════════════════════════════════
      boxShadow: {
        DEFAULT: '0 1px 3px 0 rgb(0 0 0 / 0.1), 0 1px 2px -1px rgb(0 0 0 / 0.1)',
        inner: 'inset 0 2px 4px 0 rgb(0 0 0 / 0.05)',
        xs: 'var(--shadow-xs)',
        sm: 'var(--shadow-sm)',
        md: 'var(--shadow-md)',
        lg: 'var(--shadow-lg)',
        xl: 'var(--shadow-xl)',
        '2xl': 'var(--shadow-2xl)',
        glass: 'var(--shadow-glass)',
        'focus-ring': 'var(--shadow-focus-ring)',
        'inset-sm': 'var(--shadow-inset-sm)',
        'inset-md': 'var(--shadow-inset-md)',
      },
      dropShadow: {
        sm: '0 1px 1px rgb(0 0 0 / 0.05)',
        DEFAULT: ['0 1px 2px rgb(0 0 0 / 0.1)', '0 1px 1px rgb(0 0 0 / 0.06)'],
        md: ['0 4px 3px rgb(0 0 0 / 0.07)', '0 2px 2px rgb(0 0 0 / 0.06)'],
        lg: ['0 10px 8px rgb(0 0 0 / 0.04)', '0 4px 3px rgb(0 0 0 / 0.1)'],
        xl: ['0 20px 13px rgb(0 0 0 / 0.03)', '0 8px 5px rgb(0 0 0 / 0.08)'],
        '2xl': '0 25px 25px rgb(0 0 0 / 0.15)',
      },

      // ═══════════════════════════════════════════════════════════════
      // BACKDROP BLUR (Theme-aware)
      // ═══════════════════════════════════════════════════════════════
      backdropBlur: {
        DEFAULT: '8px',
        sm: '4px',
        theme: 'var(--blur-intensity)',
      },
      blur: {
        DEFAULT: '8px',
        sm: '4px',
      },

      // ═══════════════════════════════════════════════════════════════
      // TRANSITIONS (Theme-aware)
      // ═══════════════════════════════════════════════════════════════
      transitionDuration: {
        theme: 'var(--transition-duration-base)',
        instant: 'var(--duration-instant)',
        fast: 'var(--duration-fast)',
        normal: 'var(--duration-normal)',
        slow: 'var(--duration-slow)',
      },
      transitionTimingFunction: {
        theme: 'var(--transition-style)',
        spring: 'var(--ease-spring)',
        'spring-soft': 'var(--ease-spring-soft)',
        smooth: 'var(--ease-smooth)',
      },
      animation: {
        'spin-fast': 'spin 0.5s linear infinite',
        'spin-slow': 'spin 3s linear infinite',
        'reset-sync': 'resetSync 0.2s cubic-bezier(0.25, 0.46, 0.45, 0.94) both',
        'channel-shift': 'channelShift 0.15s steps(2, end) both',
        'flicker': 'flicker 0.15s infinite',
        'text-shake': 'text-shake 0.8s infinite',
        'tearing': 'tearing 0.2s infinite linear alternate-reverse',
      },
      keyframes: {
        resetSync: {
          '0%': { transform: 'skewX(0deg)', filter: 'none' },
          '20%': { transform: 'skewX(-15deg)', filter: 'blur(1px) contrast(200%)' },
          '60%': { transform: 'skewX(5deg)', filter: 'blur(0.5px)' },
          '100%': { transform: 'skewX(0deg)', filter: 'none' },
        },
        channelShift: {
          '0%': { textShadow: 'none' },
          '50%': {
            textShadow: '4px 0 var(--channel-shift-r, rgba(255, 96, 96, 0.7)), -4px 0 var(--channel-shift-b, rgba(96, 160, 255, 0.7))',
          },
          '100%': { textShadow: 'none' },
        },
        flicker: {
          '0%, 10%, 20%, 50%, 80%, 100%': { opacity: '0.95' },
          '5%, 15%': { opacity: '0.85' },
        },
        'text-shake': {
          '0%': { transform: 'translate(1px, 1px)' },
          '10%': { transform: 'translate(-1px, -2px)' },
          '20%': { transform: 'translate(-3px, 0px)' },
          '30%': { transform: 'translate(3px, 2px)' },
          '40%': { transform: 'translate(1px, -1px)' },
          '50%': { transform: 'translate(-1px, 2px)' },
          '60%': { transform: 'translate(-3px, 1px)' },
          '70%': { transform: 'translate(3px, 1px)' },
          '80%': { transform: 'translate(-1px, -1px)' },
          '90%': { transform: 'translate(1px, 2px)' },
          '100%': { transform: 'translate(1px, -2px)' },
        },
        tearing: {
          '0%': { clipPath: 'inset(40% 0 61% 0)', transform: 'translateX(-5px)' },
          '20%': { clipPath: 'inset(92% 0 1% 0)', transform: 'translateX(5px)' },
          '40%': { clipPath: 'inset(43% 0 1% 0)', transform: 'translateX(-5px)' },
          '60%': { clipPath: 'inset(25% 0 58% 0)', transform: 'translateX(5px)' },
          '80%': { clipPath: 'inset(54% 0 7% 0)', transform: 'translateX(-5px)' },
          '100%': { clipPath: 'inset(58% 0 43% 0)', transform: 'translateX(5px)' },
        },
      },
      backgroundImage: {
        'noise-pattern': "url('data:image/svg+xml;utf8,%3Csvg viewBox=\"0 0 200 200\" xmlns=\"http://www.w3.org/2000/svg\"%3E%3Cfilter id=\"noiseFilter\"%3E%3CfeTurbulence type=\"fractalNoise\" baseFrequency=\"0.65\" numOctaves=\"3\" stitchTiles=\"stitch\"/%3E%3C/filter%3E%3Crect width=\"100%25\" height=\"100%25\" filter=\"url(%23noiseFilter)\" opacity=\"0.1\"/%3E%3C/svg%3E')",
      },

      // ═══════════════════════════════════════════════════════════════
      // BORDER RADIUS (Design tokens)
      // ═══════════════════════════════════════════════════════════════
      borderRadius: {
        DEFAULT: '0.25rem',
        sm: '0.125rem',
        theme: 'var(--radius-lg)',
        'theme-sm': 'var(--radius-sm)',
        'theme-md': 'var(--radius-md)',
        'theme-lg': 'var(--radius-lg)',
        'theme-xl': 'var(--radius-xl)',
      },
      gridTemplateColumns: {
        '24': 'repeat(24, minmax(0, 1fr))',
      },
    },
  },
  plugins: [],
};
