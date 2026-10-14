export default [
  {
    ignores: ['dist/**', 'coverage/**', 'node_modules/**', 'src/shared/workers/stats.worker.js'],
  },
  {
    linterOptions: {
      reportUnusedDisableDirectives: 'off',
    },
    files: ['src/**/*.{js,jsx}'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      parserOptions: {
        ecmaFeatures: {
          jsx: true,
        },
      },
      globals: {
        window: 'readonly',
        document: 'readonly',
        localStorage: 'readonly',
        chrome: 'readonly',
        requestAnimationFrame: 'readonly',
        cancelAnimationFrame: 'readonly',
      },
    },
    rules: {
      'no-undef': 'off',
      'no-unused-vars': 'off',
    },
  },
  {
    files: ['src/themes/**/*.{js,jsx}'],
    rules: {
      'no-restricted-imports': ['error', {
        patterns: [
          {
            group: [
              '@/apps/dashboard/**',
              '**/apps/dashboard/**',
            ],
            message: 'Theme code must use theme-core shared seams or app-provided props instead of importing dashboard owners.',
          },
          {
            group: [
              '@/themes/core/widgets/shared/sites/*',
              '**/themes/core/widgets/shared/sites/*',
              '!@/themes/core/widgets/shared/sites/index.js',
              '!**/themes/core/widgets/shared/sites/index.js',
            ],
            message: 'Use "@/themes/core/widgets/shared/sites/index.js" instead of deep-importing shared rules internals.',
          },
          {
            group: [
              '@/themes/core/widgets/shared/filter/*',
              '**/themes/core/widgets/shared/filter/*',
              '!@/themes/core/widgets/shared/filter/index.js',
              '!**/themes/core/widgets/shared/filter/index.js',
            ],
            message: 'Use "@/themes/core/widgets/shared/filter/index.js" instead of deep-importing shared filter internals.',
          },
          {
            group: [
              '@/themes/core/widgets/shared/preview/*',
              '**/themes/core/widgets/shared/preview/*',
              '!@/themes/core/widgets/shared/preview/Common.jsx',
              '!**/themes/core/widgets/shared/preview/Common.jsx',
            ],
            message: 'Use "@/themes/core/widgets/shared/preview/Common.jsx" as the only preview shared seam.',
          },
          {
            group: [
              '@/themes/core/react/*',
              '**/themes/core/react/*',
              '!@/themes/core/react/useResolvedThemeState.js',
              '!**/themes/core/react/useResolvedThemeState.js',
            ],
            message: 'Use "@/themes/core/react/useResolvedThemeState.js" instead of deep-importing theme react internals.',
          },
        ],
      }],
    },
  },
  {
    files: [
      'src/themes/core/widgets/shared/**/*.{js,jsx}',
      'src/themes/core/react/**/*.{js,jsx}',
    ],
    rules: {
      'no-restricted-imports': ['error', {
        patterns: [
          {
            group: [
              '@/apps/**',
              '**/apps/**',
            ],
            message: 'Shared theme seams must not import app owners directly.',
          },
          {
            group: [
              '@/themes/plugins/**',
              '**/themes/plugins/**',
            ],
            message: 'Shared theme seams must not import theme plugin implementations directly.',
          },
          {
            group: [
              '@/platform/**',
              '**/platform/**',
            ],
            message: 'Shared theme seams must stay presentational and must not import platform owners directly.',
          },
        ],
      }],
    },
  },
  {
    files: ['src/ui-kit/**/*.{js,jsx}'],
    rules: {
      'no-restricted-imports': ['error', {
        patterns: [
          {
            group: [
              '@/apps/dashboard/**',
              '**/apps/dashboard/**',
            ],
            message: 'ui-kit must stay dashboard-neutral. Read theme state through theme-core seams instead of dashboard stores.',
          },
          {
            group: [
              '@/themes/core/widgets/shared/sites/*',
              '**/themes/core/widgets/shared/sites/*',
              '!@/themes/core/widgets/shared/sites/index.js',
              '!**/themes/core/widgets/shared/sites/index.js',
            ],
            message: 'Use "@/themes/core/widgets/shared/sites/index.js" instead of deep-importing shared rules internals.',
          },
          {
            group: [
              '@/themes/core/widgets/shared/filter/*',
              '**/themes/core/widgets/shared/filter/*',
              '!@/themes/core/widgets/shared/filter/index.js',
              '!**/themes/core/widgets/shared/filter/index.js',
            ],
            message: 'Use "@/themes/core/widgets/shared/filter/index.js" instead of deep-importing shared filter internals.',
          },
          {
            group: [
              '@/themes/core/widgets/shared/preview/*',
              '**/themes/core/widgets/shared/preview/*',
              '!@/themes/core/widgets/shared/preview/Common.jsx',
              '!**/themes/core/widgets/shared/preview/Common.jsx',
            ],
            message: 'Use "@/themes/core/widgets/shared/preview/Common.jsx" as the only preview shared seam.',
          },
          {
            group: [
              '@/themes/core/react/*',
              '**/themes/core/react/*',
              '!@/themes/core/react/useResolvedThemeState.js',
              '!**/themes/core/react/useResolvedThemeState.js',
            ],
            message: 'Use "@/themes/core/react/useResolvedThemeState.js" instead of deep-importing theme react internals.',
          },
        ],
      }],
    },
  },
  {
    files: [
      'src/apps/**/*.{js,jsx}',
      'src/domains/**/*.{js,jsx}',
      'src/platform/**/*.{js,jsx}',
      'src/lib/**/*.{js,jsx}',
    ],
    rules: {
      'no-restricted-imports': ['error', {
        patterns: [
          {
            group: [
              '@/themes/plugins/*/widgets/**',
              '**/themes/plugins/*/widgets/**',
            ],
            message: 'Use "@/themes/core/registry/index.js" for theme widgets, or a theme plugin public API when one exists.',
          },
          {
            group: [
              '@/themes/components/widgets/index.js',
              '**/themes/components/widgets/index.js',
              '@/themes/core/loaders/widgets.js',
              '**/themes/core/loaders/widgets.js',
            ],
            message: 'Use "@/themes/core/registry/index.js" for theme widget lookup and preload APIs.',
          },
          {
            group: [
              '@/themes/core/widgets/shared/sites/*',
              '**/themes/core/widgets/shared/sites/*',
              '!@/themes/core/widgets/shared/sites/index.js',
              '!**/themes/core/widgets/shared/sites/index.js',
            ],
            message: 'Use "@/themes/core/widgets/shared/sites/index.js" instead of deep-importing shared rules internals.',
          },
          {
            group: [
              '@/themes/core/widgets/shared/filter/*',
              '**/themes/core/widgets/shared/filter/*',
              '!@/themes/core/widgets/shared/filter/index.js',
              '!**/themes/core/widgets/shared/filter/index.js',
            ],
            message: 'Use "@/themes/core/widgets/shared/filter/index.js" instead of deep-importing shared filter internals.',
          },
          {
            group: [
              '@/themes/core/widgets/shared/preview/*',
              '**/themes/core/widgets/shared/preview/*',
              '!@/themes/core/widgets/shared/preview/Common.jsx',
              '!**/themes/core/widgets/shared/preview/Common.jsx',
            ],
            message: 'Use "@/themes/core/widgets/shared/preview/Common.jsx" as the only preview shared seam.',
          },
          {
            group: [
              '@/themes/core/react/*',
              '**/themes/core/react/*',
              '!@/themes/core/react/useResolvedThemeState.js',
              '!**/themes/core/react/useResolvedThemeState.js',
            ],
            message: 'Use "@/themes/core/react/useResolvedThemeState.js" instead of deep-importing theme react internals.',
          },
        ],
      }],
    },
  },
];
