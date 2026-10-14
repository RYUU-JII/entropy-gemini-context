import { resolve } from 'node:path';
import { defineConfig } from 'vitest/config';
import {
  getDomFastTests,
  getFullOnlyTests,
  getOptionalLogicFastTests,
  getRootThemeLogicFastTests,
} from './scripts/dev/fastTestProfile.mjs';
import { collectResearchOnlyTests } from './scripts/ci/releaseTestLane.mjs';

const logicScope = String(process.env.ENTROPY_FAST_LOGIC_SCOPE || 'all').trim().toLowerCase();
const optionalLogicExclude = process.env.ENTROPY_FAST_LOGIC_EXCLUDE_OPTIONAL === '1'
  ? getOptionalLogicFastTests()
  : [];
const rootThemeLogicTests = getRootThemeLogicFastTests();
const scopeExclude = logicScope === 'core'
  ? [
    'tests/themes/**/*.test.js',
    'tests/themes/**/*.spec.js',
    ...rootThemeLogicTests,
  ]
  : logicScope === 'theme'
    ? ['tests/*.test.js', 'tests/*.spec.js']
    : [];
const scopeInclude = logicScope === 'theme'
  ? ['tests/themes/**/*.{test,spec}.js', ...rootThemeLogicTests]
  : ['tests/**/*.{test,spec}.{js,jsx}'];

const slowLocalExclude = [
  'tests/tmp*.test.{js,jsx}',
  'tests/**/*.test.jsx',
  'tests/**/*.spec.jsx',
  ...getFullOnlyTests(),
  ...getDomFastTests(),
  ...optionalLogicExclude,
  ...scopeExclude,
  // This lane is a fast proxy for what ships, and pre-push verification gates on it.
  // The detached research lane is product-ineligible by its own contract and is allowed
  // to carry unmet targets, so it must not decide whether this lane is green.
  ...collectResearchOnlyTests(),
];

const srcDir = resolve(__dirname, 'src');

export default defineConfig({
  resolve: {
    alias: {
      '/apps': resolve(srcDir, 'apps'),
      '/pages': resolve(srcDir, 'pages'),
      '@': srcDir,
      '@clse-service-runtime': resolve(srcDir, 'domains/behavior/CLSEService.js'),
      '@dashboard-boot-telemetry': resolve(srcDir, 'apps/dashboard/bootstrap/bootTelemetry.dev.js'),
      '@dashboard-experiment-tab-entry': resolve(srcDir, 'apps/dashboard/labEntries/experimentEntry.dev.js'),
      '@content-clse-alert-overlay': resolve(srcDir, 'domains/behavior/clseAlertOverlayLoader.dev.js'),
      '@content-clse-reporter': resolve(srcDir, 'domains/behavior/collectors/contentClseReporter.dev.js'),
      '@friction-debug-flags': resolve(srcDir, 'platform/browser/dev/frictionDebugFlags.js'),
      '@build-capability-message-routes': resolve(srcDir, 'apps/background/services/runtime/messageRoutes/runtimeDebuggerAutomationMessageRoutes.dev.js'),
      '@settings-propagation-qa-fixture': resolve(srcDir, 'apps/background/services/runtime/support/settingsPropagationQaFixture.dev.js'),
      '@progression-debug-actions': resolve(srcDir, 'domains/progression/debug/progressionDebugActions.dev.js'),
      '@qa-progression-provisioning-routes': resolve(srcDir, 'apps/background/services/runtime/messageRoutes/qaProgressionProvisioningMessageRoutes.dev.js'),
      '@runtime-debugger': resolve(srcDir, 'domains/nudge/runtime-debugger/index.js'),
      '@theme-widget-module-map': resolve(srcDir, 'themes/core/loaders/widgetModuleMap.dev.js'),
      '@zen-core-status-classic-experiment-entry': resolve(srcDir, 'themes/plugins/zen/runtime/buildEntries/zenCoreStatusClassicExperiment.dev.js'),
      '@zen-core-status-vnext-entry': resolve(srcDir, 'themes/plugins/zen/runtime/buildEntries/zenCoreStatusVNext.dev.js'),
      '@zen-development-workspace-state-entry': resolve(srcDir, 'themes/plugins/zen/runtime/buildEntries/zenDevelopmentWorkspaceState.dev.js'),
      '@zen-trace': resolve(srcDir, 'lib/debug/zenTrace.dev.js'),
      '@zen-ab-trial-worker': `${resolve(srcDir, 'themes/plugins/zen/workers/zenAbTrialEvaluator.worker.js')}?worker`,
      '@zen-latent-optimizer-worker': `${resolve(srcDir, 'themes/plugins/zen/workers/zenLatentOptimizer.worker.js')}?worker`,
      '@zen-vnext-optimizer-worker': `${resolve(srcDir, 'themes/plugins/zen/workers/zenVNextOptimizer.worker.js')}?worker`,
      '@zen-vnext-preference-trainer-worker': `${resolve(srcDir, 'themes/plugins/zen/workers/zenVNextPreferenceTrainer.worker.js')}?worker`,
    },
  },
  esbuild: {
    jsx: 'automatic',
    jsxDev: false,
  },
  test: {
    environment: 'node',
    globals: true,
    setupFiles: ['./tests/setup.node.js'],
    include: scopeInclude,
    exclude: ['node_modules', 'dist', ...slowLocalExclude],
    testTimeout: 10000,
    watchExclude: ['node_modules', 'dist'],
  },
});
