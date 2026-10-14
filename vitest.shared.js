import { mergeConfig } from 'vitest/config';
import viteConfig from './vite.config.js';
import AiFailureSummaryReporter from './tests/reporters/AiFailureSummaryReporter.js';

const defaultCoverage = {
  provider: 'v8',
  reporter: ['text', 'html', 'lcov', 'json-summary'],
  reportsDirectory: './coverage',
  include: ['src/**/*.{js,jsx}'],
  exclude: [
    'src/entries/**/*.html',
    'src/manifest.json',
    'src/**/*.css',
  ],
};

export async function createEntropyVitestConfig({
  include,
  exclude = [],
  testTimeout = 10000,
  coverage = null,
} = {}) {
  const resolvedViteConfig = typeof viteConfig === 'function'
    ? await viteConfig({
      command: 'serve',
      mode: 'test',
    })
    : viteConfig;

  const testConfig = {
    reporters: [new AiFailureSummaryReporter()],
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./tests/setup.js'],
    include,
    exclude: ['node_modules', 'dist', ...exclude],
    testTimeout,
    watchExclude: ['node_modules', 'dist'],
  };

  if (coverage) {
    testConfig.coverage = coverage;
  }

  return mergeConfig(resolvedViteConfig, {
    test: testConfig,
  });
}

export { defaultCoverage };
