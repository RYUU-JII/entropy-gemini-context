#!/usr/bin/env node

import fs from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const rootDir = process.cwd();

const fail = (message) => {
  console.error(`[boot-timeout-contract] FAIL: ${message}`);
  process.exit(1);
};

const requireFinitePositive = (value, label) => {
  if (!Number.isFinite(value) || value <= 0) {
    fail(`${label} must be a finite positive number. received=${String(value)}`);
  }
};

const readUtf8 = async (relativePath) => (
  fs.readFile(path.resolve(rootDir, relativePath), 'utf8')
);

const assertIncludes = (source, token, filePath) => {
  if (!source.includes(token)) {
    fail(`${filePath} must include "${token}"`);
  }
};

const assertExcludes = (source, token, filePath, message = null) => {
  if (source.includes(token)) {
    fail(message || `${filePath} must not include "${token}"`);
  }
};

const assertCssRuleIncludes = (source, selector, tokens, filePath) => {
  const marker = `${selector} {`;
  const ruleStart = source.indexOf(marker);
  if (ruleStart < 0) {
    fail(`${filePath} must declare ${selector}`);
  }
  const ruleEnd = source.indexOf('}', ruleStart + marker.length);
  if (ruleEnd < 0) {
    fail(`${filePath} has an unterminated ${selector} rule`);
  }
  const rule = source.slice(ruleStart, ruleEnd + 1);
  tokens.forEach((token) => assertIncludes(rule, token, `${filePath}:${selector}`));
};

const main = async () => {
  const bootConfigPath = path.resolve(rootDir, 'src/apps/dashboard/bootstrap/bootConfig.js');
  const bootConfigModule = await import(pathToFileURL(bootConfigPath).href);

  const {
    BOOT_CORE_TIMEOUT_MS,
    BOOT_LAZY_IDLE_TIMEOUT_MS,
    BOOT_SURFACE_WARMUP_TIMEOUT_MS,
    BOOT_SURFACE_INTERACTIVE_TIMEOUT_MS,
    BOOT_SURFACE_DEFERRED_TIMEOUT_MS,
    BOOT_SURFACE_DEFERRED_IDLE_TIMEOUT_MS,
    BOOT_PREWARM_REQUEST_TIMEOUT_MS,
    BOOT_SHELL_INITIAL_PAINT_TIMEOUT_MS,
    BOOT_SHELL_HARD_TIMEOUT_MS,
  } = bootConfigModule;

  requireFinitePositive(BOOT_CORE_TIMEOUT_MS, 'BOOT_CORE_TIMEOUT_MS');
  requireFinitePositive(BOOT_LAZY_IDLE_TIMEOUT_MS, 'BOOT_LAZY_IDLE_TIMEOUT_MS');
  requireFinitePositive(BOOT_SURFACE_WARMUP_TIMEOUT_MS, 'BOOT_SURFACE_WARMUP_TIMEOUT_MS');
  requireFinitePositive(BOOT_SURFACE_INTERACTIVE_TIMEOUT_MS, 'BOOT_SURFACE_INTERACTIVE_TIMEOUT_MS');
  requireFinitePositive(BOOT_SURFACE_DEFERRED_TIMEOUT_MS, 'BOOT_SURFACE_DEFERRED_TIMEOUT_MS');
  requireFinitePositive(BOOT_SURFACE_DEFERRED_IDLE_TIMEOUT_MS, 'BOOT_SURFACE_DEFERRED_IDLE_TIMEOUT_MS');
  requireFinitePositive(BOOT_PREWARM_REQUEST_TIMEOUT_MS, 'BOOT_PREWARM_REQUEST_TIMEOUT_MS');
  requireFinitePositive(
    BOOT_SHELL_INITIAL_PAINT_TIMEOUT_MS,
    'BOOT_SHELL_INITIAL_PAINT_TIMEOUT_MS',
  );
  requireFinitePositive(BOOT_SHELL_HARD_TIMEOUT_MS, 'BOOT_SHELL_HARD_TIMEOUT_MS');

  if (BOOT_SHELL_HARD_TIMEOUT_MS <= BOOT_CORE_TIMEOUT_MS) {
    fail('BOOT_SHELL_HARD_TIMEOUT_MS must be greater than BOOT_CORE_TIMEOUT_MS');
  }
  if (BOOT_PREWARM_REQUEST_TIMEOUT_MS > BOOT_CORE_TIMEOUT_MS) {
    fail('BOOT_PREWARM_REQUEST_TIMEOUT_MS must not exceed BOOT_CORE_TIMEOUT_MS');
  }
  if (BOOT_SHELL_INITIAL_PAINT_TIMEOUT_MS >= BOOT_CORE_TIMEOUT_MS) {
    fail('BOOT_SHELL_INITIAL_PAINT_TIMEOUT_MS must be less than BOOT_CORE_TIMEOUT_MS');
  }
  if (BOOT_SURFACE_WARMUP_TIMEOUT_MS > BOOT_CORE_TIMEOUT_MS) {
    fail('BOOT_SURFACE_WARMUP_TIMEOUT_MS must not exceed BOOT_CORE_TIMEOUT_MS');
  }
  if (BOOT_SURFACE_INTERACTIVE_TIMEOUT_MS > BOOT_CORE_TIMEOUT_MS) {
    fail('BOOT_SURFACE_INTERACTIVE_TIMEOUT_MS must not exceed BOOT_CORE_TIMEOUT_MS');
  }
  if (BOOT_SURFACE_DEFERRED_TIMEOUT_MS > BOOT_SHELL_HARD_TIMEOUT_MS) {
    fail('BOOT_SURFACE_DEFERRED_TIMEOUT_MS must not exceed BOOT_SHELL_HARD_TIMEOUT_MS');
  }

  const bootManagerSource = await readUtf8('src/apps/dashboard/bootstrap/bootManager.js');
  const bootRendererReadinessSource = await readUtf8('src/apps/dashboard/bootstrap/bootShellRendererReadiness.js');
  const mainTabSource = await readUtf8('src/apps/dashboard/tabs/main/MainTab.jsx');
  const mainPanelSource = await readUtf8('src/apps/dashboard/layout/MainPanel.jsx');
  const mainFirstVisualCoordinatorSource = await readUtf8(
    'src/apps/dashboard/tabs/main/firstVisual/useZenHomeFirstVisualCoordinator.js',
  );
  const mainFirstVisualCoordinatorStateSource = await readUtf8(
    'src/apps/dashboard/tabs/main/firstVisual/zenHomeFirstVisualCoordinatorState.js',
  );
  const mainHomeWorkspaceSource = await readUtf8(
    'src/apps/dashboard/tabs/main/home/HomeScanWorkspace.jsx',
  );
  const zenGardenFrameSource = await readUtf8(
    'src/apps/dashboard/workspaces/garden/ZenGardenFrame.jsx',
  );
  const mainHomeWorkspaceCssSource = await readUtf8(
    'src/apps/dashboard/tabs/main/home/homeScanWorkspace.css',
  );
  const zenHomeFirstVisualReadinessContractSource = await readUtf8(
    'src/themes/plugins/zen/runtime/zenHomeFirstVisualReadinessContract.js',
  );
  const bootPrewarmSource = await readUtf8('src/apps/dashboard/bootstrap/bootPrewarmClient.js');
  const bootSurfaceSource = await readUtf8('src/apps/dashboard/bootstrap/bootSurfaceWarmup.js');
  const bootShellSource = await readUtf8('src/apps/dashboard/bootShell.js');
  const bootShellStartupTestSource = await readUtf8('tests/dashboardBootShellStartup.test.js');
  const bootSequenceArchitectureSource = await readUtf8(
    'docs/apps/dashboard/dashboard-boot-sequence-architecture.md',
  );

  assertIncludes(bootManagerSource, "from './bootConfig.js'", 'bootManager.js');
  assertIncludes(bootPrewarmSource, "from './bootConfig.js'", 'bootPrewarmClient.js');
  assertIncludes(bootSurfaceSource, "from './bootConfig.js'", 'bootSurfaceWarmup.js');
  assertIncludes(bootShellSource, "from './bootstrap/bootConfig.js'", 'bootShell.js');
  assertIncludes(bootRendererReadinessSource, 'BOOT_SHELL_RENDERER_READY_NOT_DECLARED', 'bootShellRendererReadiness.js');
  assertIncludes(bootRendererReadinessSource, 'THEME_BOOT_SHELL_RENDERER_STATUS.TIMEOUT', 'bootShellRendererReadiness.js');
  assertIncludes(bootRendererReadinessSource, 'renderer_ready_timeout', 'bootShellRendererReadiness.js');
  assertIncludes(bootManagerSource, 'boot:core_wait_budget_exceeded', 'bootManager.js');
  assertIncludes(bootManagerSource, 'coreWaitBudgetExceeded', 'bootManager.js');
  assertIncludes(bootManagerSource, 'mainTabFirstFrameWaitBudgetExceeded', 'bootManager.js');
  assertIncludes(bootManagerSource, 'BOOT_SEQUENCE_ALREADY_RUNNING', 'bootManager.js');
  assertIncludes(bootManagerSource, 'BOOT_MAIN_FIRST_FRAME_DUPLICATE', 'bootManager.js');
  assertIncludes(bootManagerSource, 'BOOT_MAIN_FIRST_FRAME_FAILED', 'bootManager.js');
  assertIncludes(bootManagerSource, 'boot_manager:core_timeout_visual_wait', 'bootManager.js');
  assertIncludes(bootManagerSource, "runTask('fetchBootPrewarmSnapshot'", 'bootManager.js');
  assertIncludes(bootManagerSource, 'prewarm:snapshot', 'bootManager.js');
  assertIncludes(
    bootSurfaceSource,
    'const entryAbortController = new AbortController()',
    'bootSurfaceWarmup.js',
  );
  assertIncludes(
    bootSurfaceSource,
    'signal: entryAbortController.signal',
    'bootSurfaceWarmup.js',
  );
  assertIncludes(
    bootSurfaceSource,
    "abortEntry('warmup_deadline_exceeded')",
    'bootSurfaceWarmup.js',
  );
  assertIncludes(bootShellSource, 'boot_shell:hard_timeout_fail_open', 'bootShell.js');
  assertIncludes(bootShellSource, "dismiss('hard_timeout')", 'bootShell.js');
  assertIncludes(
    bootShellSource,
    'BOOT_SHELL_INITIAL_PAINT_TIMEOUT_MS',
    'bootShell.js',
  );
  assertIncludes(bootShellSource, 'let settled = false;', 'bootShell.js');
  assertIncludes(
    bootShellSource,
    "() => settle('raf_liveness_timeout')",
    'bootShell.js',
  );
  assertIncludes(
    bootShellSource,
    'boot_shell:initial_paint_liveness_fallback',
    'bootShell.js',
  );
  const hardTimeoutCallbackStart = bootShellSource.indexOf(
    'hardTimeoutId = window.setTimeout(() => {',
  );
  const hardTimeoutCallbackEnd = bootShellSource.indexOf(
    '}, BOOT_SHELL_HARD_TIMEOUT_MS);',
    hardTimeoutCallbackStart,
  );
  if (hardTimeoutCallbackStart < 0 || hardTimeoutCallbackEnd < 0) {
    fail('bootShell.js must retain one bounded hard-timeout callback');
  }
  const hardTimeoutCallbackSource = bootShellSource.slice(
    hardTimeoutCallbackStart,
    hardTimeoutCallbackEnd,
  );
  assertIncludes(
    hardTimeoutCallbackSource,
    'startDashboardImport();',
    'bootShell.js:hard-timeout callback',
  );
  if (
    hardTimeoutCallbackSource.indexOf('startDashboardImport();')
      > hardTimeoutCallbackSource.indexOf('getDashboardBootSnapshotFromWindow()')
  ) {
    fail('bootShell.js hard timeout must start the dashboard import before snapshot recovery');
  }
  [
    'admits the normal initial paint after exactly two animation frames and imports once',
    'imports once through the bounded initial-paint fallback when animation frames stop',
    'ignores a late animation frame after the initial-paint fallback settles',
    'hard timeout starts the dashboard import even when initial-paint admission never settles',
  ].forEach((token) => assertIncludes(
    bootShellStartupTestSource,
    token,
    'dashboardBootShellStartup.test.js',
  ));
  [
    '`BOOT_SHELL_INITIAL_PAINT_TIMEOUT_MS`',
    'single-settlement',
    'idempotent `startDashboardImport()`',
  ].forEach((token) => assertIncludes(
    bootSequenceArchitectureSource,
    token,
    'dashboard-boot-sequence-architecture.md',
  ));
  assertIncludes(mainTabSource, 'useZenHomeFirstVisualCoordinator', 'MainTab.jsx');
  assertIncludes(mainPanelSource, 'componentDidCatch(error)', 'MainPanel.jsx');
  assertIncludes(
    mainPanelSource,
    'main_tab_module_or_render_failed',
    'MainPanel.jsx',
  );
  assertIncludes(mainPanelSource, 'MAIN_TAB_RENDER_FAILED', 'MainPanel.jsx');
  assertIncludes(
    mainFirstVisualCoordinatorSource,
    'ZEN_MAIN_FIRST_FRAME_SOFT_BUDGET_MS',
    'useZenHomeFirstVisualCoordinator.js',
  );
  assertIncludes(
    mainFirstVisualCoordinatorSource,
    'ZEN_MAIN_FIRST_FRAME_PROGRESS_WATCHDOG_MS',
    'useZenHomeFirstVisualCoordinator.js',
  );
  assertIncludes(
    mainFirstVisualCoordinatorSource,
    'main_tab:first_frame_soft_budget_exceeded',
    'useZenHomeFirstVisualCoordinator.js',
  );
  assertIncludes(
    mainFirstVisualCoordinatorSource,
    'main_tab:first_frame_progress_watchdog',
    'useZenHomeFirstVisualCoordinator.js',
  );
  assertIncludes(
    mainFirstVisualCoordinatorSource,
    'main_tab:first_visual_failed',
    'useZenHomeFirstVisualCoordinator.js',
  );
  assertIncludes(
    mainFirstVisualCoordinatorStateSource,
    'reduceZenHomeFirstVisualCoordinatorState',
    'zenHomeFirstVisualCoordinatorState.js',
  );
  assertIncludes(
    zenHomeFirstVisualReadinessContractSource,
    'ZEN_HOME_FIRST_VISUAL_MILESTONES',
    'zenHomeFirstVisualReadinessContract.js',
  );
  assertIncludes(
    zenHomeFirstVisualReadinessContractSource,
    'shouldAcceptZenHomeFirstVisualPhaseTransition',
    'zenHomeFirstVisualReadinessContract.js',
  );

  // The app Garden frame owns these actual DOM slots. Home supplies their
  // content/ACKs; requiring its retired class map no longer guards geometry.
  assertIncludes(mainHomeWorkspaceSource, '<ZenGardenFrame', 'HomeScanWorkspace.jsx');
  for (const classNameToken of [
    'zen-home-stage',
    'zen-home-pond-slot',
    'zen-home-side-column',
    'zen-home-rhythm-slot',
  ]) {
    const declaration = zenGardenFrameSource.match(
      new RegExp(`className="([^"]*\\b${classNameToken}\\b[^"]*)"`),
    )?.[1] || null;
    if (!declaration) {
      fail(`ZenGardenFrame.jsx must declare ${classNameToken}`);
    }
    if (/(?:^|\s)(?:sm|md|lg|xl|2xl):/.test(declaration)) {
      fail(
        `ZenGardenFrame.jsx ${classNameToken} must not select Zen Home geometry `
        + 'through a viewport-width utility breakpoint.',
      );
    }
  }

  assertCssRuleIncludes(
    mainHomeWorkspaceCssSource,
    "[data-ui-layout='landscape'] .zen-home-stage",
    [
      'grid-template-columns:',
      'grid-template-rows:',
    ],
    'homeScanWorkspace.css',
  );
  assertCssRuleIncludes(
    mainHomeWorkspaceCssSource,
    "[data-ui-layout='landscape'] .zen-home-pond-slot",
    [
      'grid-column: 1 / -1;',
      'grid-row: 1;',
    ],
    'homeScanWorkspace.css',
  );
  assertCssRuleIncludes(
    mainHomeWorkspaceCssSource,
    "[data-ui-layout='landscape'] .zen-home-side-column",
    [
      'grid-column: 2;',
      'grid-row: 1;',
      'margin-top: 0;',
    ],
    'homeScanWorkspace.css',
  );
  assertCssRuleIncludes(
    mainHomeWorkspaceCssSource,
    "[data-ui-layout='landscape'] .zen-home-pressure-slot",
    [
      'grid-column: 1 / -1;',
      'grid-row: 2;',
    ],
    'homeScanWorkspace.css',
  );

  const legacyTokens = [
    'const BOOT_TIMEOUT_MS =',
    'const PREWARM_REQUEST_TIMEOUT_MS =',
    'const SURFACE_WARMUP_TIMEOUT_MS =',
    'const SURFACE_DEFERRED_WARMUP_TIMEOUT_MS =',
    'const BOOT_SHELL_HARD_TIMEOUT_MS = 18000',
  ];

  const scanTargets = [
    ['src/apps/dashboard/bootstrap/bootManager.js', bootManagerSource],
    ['src/apps/dashboard/bootstrap/bootShellRendererReadiness.js', bootRendererReadinessSource],
    ['src/apps/dashboard/bootstrap/bootPrewarmClient.js', bootPrewarmSource],
    ['src/apps/dashboard/bootstrap/bootSurfaceWarmup.js', bootSurfaceSource],
    ['src/apps/dashboard/bootShell.js', bootShellSource],
    ['src/apps/dashboard/tabs/main/MainTab.jsx', mainTabSource],
    [
      'src/apps/dashboard/tabs/main/firstVisual/useZenHomeFirstVisualCoordinator.js',
      mainFirstVisualCoordinatorSource,
    ],
    [
      'src/apps/dashboard/tabs/main/firstVisual/zenHomeFirstVisualCoordinatorState.js',
      mainFirstVisualCoordinatorStateSource,
    ],
    [
      'src/themes/plugins/zen/runtime/zenHomeFirstVisualReadinessContract.js',
      zenHomeFirstVisualReadinessContractSource,
    ],
  ];

  for (const [filePath, source] of scanTargets) {
    legacyTokens.forEach((token) => {
      if (source.includes(token)) {
        fail(`${filePath} still contains legacy timeout token: ${token}`);
      }
    });
  }

  assertExcludes(
    bootShellSource,
    "throw failBootShell('BOOT_SHELL_HARD_TIMEOUT'",
    'bootShell.js',
    'bootShell.js hard timeout must fail-open the visible shell instead of crashing.',
  );
  assertExcludes(
    bootShellSource,
    'BOOT_SHELL_DEGRADED_DISMISS_REQUEST',
    'bootShell.js',
    'bootShell.js must dismiss degraded-ready snapshots instead of crashing them.',
  );
  assertExcludes(
    bootShellSource,
    'BOOT_SHELL_DEGRADED_INITIAL_SNAPSHOT',
    'bootShell.js',
    'bootShell.js must dismiss degraded-ready initial snapshots instead of crashing them.',
  );
  assertExcludes(
    bootManagerSource,
    'forceDismissByTimeout',
    'bootManager.js',
    'bootManager.js must not own visible-shell dismissal on timeout.',
  );
  assertExcludes(
    bootManagerSource,
    "createBootManagerFailureError('BOOT_CORE_TIMEOUT'",
    'bootManager.js',
    'bootManager.js core wait budget must not create a fatal BOOT_CORE_TIMEOUT failure.',
  );
  assertExcludes(
    bootManagerSource,
    'failBootByTimeout',
    'bootManager.js',
    'bootManager.js must record timeout diagnostics instead of failing boot by timeout.',
  );
  assertExcludes(
    bootManagerSource,
    'BUILD_INCLUDE_DEBUG_TOOLS',
    'bootManager.js',
    'bootManager.js prewarm readiness must not differ between dev and public release builds.',
  );
  assertExcludes(
    `${mainTabSource}\n${mainFirstVisualCoordinatorSource}`,
    'ZEN_MAIN_FIRST_FRAME_ACK_TIMEOUT',
    'MainTab.jsx',
    'MainTab first visual readiness must use soft-budget progress tracing and explicit fatal reports, not fatal ACK timeout throws.',
  );
  assertExcludes(
    `${mainTabSource}\n${mainFirstVisualCoordinatorSource}`,
    'zen_home_composite_first_frame_timeout',
    'MainTab first visual readiness',
    'MainTab first visual readiness must not report degraded timeout readiness.',
  );

  console.log('[boot-timeout-contract] PASS: boot timeout contracts are centralized and consistent.');
};

main().catch((error) => {
  console.error('[boot-timeout-contract] Unexpected error:', error);
  process.exit(1);
});
