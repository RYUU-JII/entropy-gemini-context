#!/usr/bin/env node

import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import fs from 'node:fs/promises';
import fsSync from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { chromium } from 'playwright';
import { createVisualMediaMembershipContracts } from './sites/visualMediaMembershipProbe.mjs';

import {
  projectBrowserExecutionContract,
} from '../browser-qa/contracts/browserExecutionContract.mjs';
import {
  ExtensionChromiumHarness,
  readEntropyQaProfileMarker,
  sleep,
} from './extensionChromiumHarness.mjs';
import {
  ENTROPY_QA_TRUSTED_PAGE_PATH,
  stageEntropyQaArtifact,
} from './qaProfileArtifactSlot.mjs';
import {
  SITE_SCENARIO_SUITE_METADATA,
  buildScenarioSettings,
  getSiteScenarioHostPermissions,
  getSiteScenarios,
} from './sites/scenarioCatalog.mjs';
import {
  RUNTIME_DEBUGGER_AUTOMATION_ACTIONS,
  activateScenarioTab,
  analyzeScenarioArtifactDisclosure,
  clearDiagnosticArtifactDisclosureOverride,
  collectPageMetrics,
  collectContentRuntimeDiagnostics,
  collectProtectionRuntimeEvidence,
  collectScenarioConfigurationEvidence,
  collectStorageSummary,
  collectTargetSnapshot,
  collectTrackingRuntimeEvidence,
  configureScenario,
  createExtensionRuntimeCollector,
  createPageRuntimeCollector,
  createSafeRuntimeError,
  getContentRuntimeEventCursor,
  prepareLaneArtifactDisclosure,
  readScenarioPageState,
  runScenarioActions,
  sendRuntimeDebuggerAutomationAction,
  waitForScenarioSettingsPropagation,
  waitForScenarioReadiness,
} from './sites/siteRuntimeBrowser.mjs';
import {
  aggregateShortFormCompletenessEvidence,
  analyzeDebuggerValidity,
  analyzeDiagnosticActivation,
  analyzeObservableEffect,
  analyzeUserSettingsDisableActivation,
  classifyRequiredScenarioActionBlocker,
  classifySiteRun,
  createDiagnosticConditionContracts,
  createRootVisualContinuityContracts,
  extractDebuggerCostEvidence,
  extractDebuggerPhaseCostEvidence,
  extractShortFormCompletenessEvidence,
  needsLazyBaselineReset,
  createPageRuntimeErrorContracts,
  projectTargetingHealthAcceptanceContracts,
  SITE_E2E_DEBUGGER_COST_PHASES,
  SITE_E2E_TARGETING_HEALTH_ACCEPTANCE_MODES,
} from './sites/siteRunAnalysis.mjs';
import {
  compareMetricsWithApprovedBaseline,
  createRuntimeActionAttributionContract,
  createSitePerformanceWorkloadFingerprint,
  diffCdpMetricSnapshots,
  diffStorageSnapshots,
  evaluateSitePerformanceSampleEligibility,
  evaluateConfirmedRuntimeBudgets,
  sanitizeSiteHarnessUrl,
  summarizeActionRuntimeAttribution,
  summarizeMetricRepeats,
  summarizeNormalizedSitePerformanceMetrics,
  summarizeSitePerformanceMetricCoverage,
  summarizeSitePerformanceWorkload,
} from './sites/siteRuntimeMetrics.mjs';
import {
  SITE_RUN_OUTCOMES,
  combineSiteRunOutcomes,
  writeSiteSuiteReport,
} from './sites/siteRuntimeReport.mjs';
import { DEFAULT_GATE_CONFIG } from '../../src/domains/settings/config/gateConfig.js';
import { DEFAULT_NUDGE_SETTINGS } from '../../src/domains/settings/config/nudgeConfig.js';
import { DATA_COLLECTION_MODES } from '../../src/domains/settings/config/dataCollectionPolicy.js';
import { INSIGHTS_CONSENT } from '../../src/domains/settings/config/insightsMode.js';
import {
  admitQaExtensionBrowserChildExecution,
} from '../qa/contracts/qaBrowserChildExecutionContract.mjs';

const scriptPath = fileURLToPath(import.meta.url);
const scriptDir = path.dirname(scriptPath);
const rootDir = path.resolve(scriptDir, '../..');
const DEFAULT_REPORT_DIR = path.join(rootDir, 'reports/e2e/sites');
const DEFAULT_REPEAT = 1;
const INITIAL_ACTIVATION_TIMEOUT_MS = 75_000;
const FINAL_DEBUGGER_SETTLE_TIMEOUT_MS = 5_000;
const FINAL_DEBUGGER_SETTLE_POLL_INTERVAL_MS = 200;
const FINAL_DEBUGGER_SETTLE_TRAJECTORY_LIMIT = 32;
const DEBUGGER_SETTLE_OWNER_IDS = Object.freeze([
  'observerHub',
  'socialMetrics',
  'textShuffle',
]);
const TARGETING_HEALTH_PROBE_IDS = Object.freeze(['socialMetrics', 'shortForm']);
const LANE_IDS = Object.freeze(['diagnostic', 'release']);
const SITE_MEASUREMENT_PROFILE_IDS = new Set([
  'contract',
  'contention',
  'benchmark',
]);
const FRESH_DISPOSABLE_BROWSER_REPEAT_ISOLATION = 'fresh_disposable_browser';
const SHA256_HEX_PATTERN = /^[a-f0-9]{64}$/u;
const REPEAT_ISOLATION_EPOCH_KEYS = Object.freeze([
  'browserEpochDigest',
  'browserProcessOwnership',
  'cleanupState',
  'mode',
  'profileEpochDigest',
  'profileOwnership',
  'profileRetained',
  'temporaryExtensionRetained',
  'version',
]);
const LIFECYCLE_ACTIONS = new Set(['navigate', 'reload']);
const RUNNER_OWNED_ACTIONS = new Set([
  'settings_patch',
  'disable',
  'reenable',
  'takeover_checkpoint',
]);

export function isRuntimeDebuggerInstrumentationEnabled({
  lane,
  measurementProfile = null,
} = {}) {
  return lane === 'diagnostic'
    && !['contract', 'benchmark'].includes(measurementProfile);
}

function parsePositiveInteger(rawValue, code, { minimum = 1, maximum = 20 } = {}) {
  const value = Number(rawValue);
  if (!Number.isSafeInteger(value) || value < minimum || value > maximum) {
    throw new Error(`${code}:${rawValue}`);
  }
  return value;
}

export function parseSiteRuntimeE2EArgs(argv) {
  const options = {
    suite: 'release-core',
    lane: 'both',
    profile: null,
    site: null,
    featureGroup: null,
    repeat: DEFAULT_REPEAT,
    reportDir: DEFAULT_REPORT_DIR,
    keepProfile: false,
    headless: true,
    chromePath: null,
    diagnosticDist: null,
    releaseDist: null,
    build: true,
    settleMs: 1_500,
    failOnInconclusive: false,
    measurementProfile: null,
    repeatIsolation: null,
  };
  for (const arg of argv) {
    if (arg === '--headed') options.headless = false;
    else if (arg === '--headless') options.headless = true;
    else if (arg === '--keep-profile') options.keepProfile = true;
    else if (arg === '--no-build') options.build = false;
    else if (arg === '--fail-on-inconclusive') options.failOnInconclusive = true;
    else if (arg.startsWith('--suite=')) options.suite = arg.slice('--suite='.length);
    else if (arg.startsWith('--lane=')) options.lane = arg.slice('--lane='.length);
    else if (arg.startsWith('--profile=')) options.profile = arg.slice('--profile='.length);
    else if (arg.startsWith('--site=')) options.site = arg.slice('--site='.length);
    else if (arg.startsWith('--feature-group=')) {
      options.featureGroup = arg.slice('--feature-group='.length);
    }
    else if (arg.startsWith('--measurement-profile=')) {
      options.measurementProfile = arg.slice('--measurement-profile='.length);
    }
    else if (arg.startsWith('--repeat-isolation=')) {
      const isolation = arg.slice('--repeat-isolation='.length);
      options.repeatIsolation = isolation === 'fresh-disposable-browser'
        ? FRESH_DISPOSABLE_BROWSER_REPEAT_ISOLATION
        : isolation;
    }
    else if (arg.startsWith('--repeat=')) {
      options.repeat = parsePositiveInteger(arg.slice('--repeat='.length), 'SITE_E2E_REPEAT_INVALID');
    } else if (arg.startsWith('--report-dir=')) {
      options.reportDir = arg.slice('--report-dir='.length);
    } else if (arg.startsWith('--chrome=')) {
      options.chromePath = arg.slice('--chrome='.length);
    } else if (arg.startsWith('--diagnostic-dist=')) {
      options.diagnosticDist = arg.slice('--diagnostic-dist='.length);
    } else if (arg.startsWith('--release-dist=')) {
      options.releaseDist = arg.slice('--release-dist='.length);
    } else if (arg.startsWith('--settle-ms=')) {
      options.settleMs = parsePositiveInteger(
        arg.slice('--settle-ms='.length),
        'SITE_E2E_SETTLE_MS_INVALID',
        { minimum: 100, maximum: 30_000 },
      );
    } else {
      throw new Error(`SITE_E2E_ARGUMENT_UNKNOWN:${arg}`);
    }
  }
  if (!SITE_SCENARIO_SUITE_METADATA[options.suite]) {
    throw new Error(`SITE_E2E_SUITE_UNKNOWN:${options.suite}`);
  }
  if (!['diagnostic', 'release', 'both'].includes(options.lane)) {
    throw new Error(`SITE_E2E_LANE_INVALID:${options.lane}`);
  }
  if (
    options.measurementProfile !== null
    && !SITE_MEASUREMENT_PROFILE_IDS.has(options.measurementProfile)
  ) {
    throw new Error(`SITE_E2E_MEASUREMENT_PROFILE_INVALID:${options.measurementProfile || 'missing'}`);
  }
  if (
    options.repeatIsolation !== null
    && options.repeatIsolation !== FRESH_DISPOSABLE_BROWSER_REPEAT_ISOLATION
  ) {
    throw new Error(
      `SITE_E2E_REPEAT_ISOLATION_INVALID:${options.repeatIsolation || 'missing'}`,
    );
  }
  if (options.repeatIsolation !== null && options.profile !== null) {
    throw new Error('SITE_E2E_REPEAT_ISOLATION_PROFILE_FORBIDDEN');
  }
  if (options.repeatIsolation !== null && options.keepProfile) {
    throw new Error('SITE_E2E_REPEAT_ISOLATION_RETAINED_PROFILE_FORBIDDEN');
  }
  if (options.repeatIsolation !== null && options.lane !== 'diagnostic') {
    throw new Error('SITE_E2E_REPEAT_ISOLATION_DIAGNOSTIC_LANE_REQUIRED');
  }
  if (!options.reportDir?.trim()) throw new Error('SITE_E2E_REPORT_DIR_REQUIRED');
  if (options.profile !== null && !options.profile.trim()) {
    throw new Error('SITE_E2E_QA_PROFILE_REQUIRED');
  }
  if (options.featureGroup !== null && !options.featureGroup.trim()) {
    throw new Error('SITE_E2E_FEATURE_GROUP_REQUIRED');
  }
  if (!options.build) {
    const requestedLanes = options.lane === 'both' ? LANE_IDS : [options.lane];
    requestedLanes.forEach((lane) => {
      const dist = lane === 'diagnostic' ? options.diagnosticDist : options.releaseDist;
      if (!dist?.trim()) throw new Error(`SITE_E2E_${lane.toUpperCase()}_DIST_REQUIRED`);
    });
  }
  return options;
}

const WSL_WINDOWS_CHROME_PATH = '/mnt/c/Program Files/Google/Chrome/Application/chrome.exe';

export function createSiteE2EChromeExecutableCandidates({
  explicitPath = null,
  headless = true,
  platform = process.platform,
  environment = process.env,
  playwrightPath = chromium.executablePath(),
  windowsChromePath = WSL_WINDOWS_CHROME_PATH,
} = {}) {
  void headless;
  void platform;
  void windowsChromePath;
  const automaticCandidates = [
    playwrightPath,
    '/usr/bin/google-chrome-stable',
    '/usr/bin/google-chrome',
    '/usr/bin/chromium',
    '/usr/bin/chromium-browser',
  ];
  return [...new Set([
    explicitPath,
    environment.CHROME_BIN,
    environment.GOOGLE_CHROME_BIN,
    ...automaticCandidates,
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  ].filter(Boolean))];
}

function findChromeExecutable(explicitPath = null, { headless = true } = {}) {
  const hasLinuxDisplay = !!(
    process.env.DISPLAY?.trim()
    || process.env.WAYLAND_DISPLAY?.trim()
  );
  const explicitlySelected = !!(
    explicitPath
    || process.env.CHROME_BIN?.trim()
    || process.env.GOOGLE_CHROME_BIN?.trim()
  );
  if (process.platform === 'linux' && !headless && !hasLinuxDisplay && !explicitlySelected) {
    throw new Error('SITE_E2E_HEADED_DISPLAY_REQUIRED:use_a_desktop_display_or_xvfb-run');
  }
  const candidates = createSiteE2EChromeExecutableCandidates({ explicitPath, headless });
  const resolved = candidates.find((candidate) => fsSync.existsSync(candidate));
  if (!resolved) throw new Error('SITE_E2E_CHROMIUM_EXECUTABLE_NOT_FOUND');
  return path.resolve(resolved);
}

async function runCommand(command, args, { env = process.env } = {}) {
  await new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: rootDir,
      env,
      stdio: 'inherit',
      shell: process.platform === 'win32',
    });
    child.once('error', reject);
    child.once('exit', (code, signal) => {
      if (code === 0) resolve();
      else reject(new Error(
        `SITE_E2E_COMMAND_FAILED:${command}:${code ?? signal ?? 'unknown'}`,
      ));
    });
  });
}

async function readBuildInfo(distDir, expectedProfile) {
  const manifestPath = path.join(distDir, 'manifest.json');
  const buildInfoPath = path.join(distDir, 'entropy-build-info.json');
  const [manifest, buildInfo] = await Promise.all([
    fs.readFile(manifestPath, 'utf8').then(JSON.parse),
    fs.readFile(buildInfoPath, 'utf8').then(JSON.parse),
  ]);
  if (manifest?.manifest_version !== 3) {
    throw new Error(`SITE_E2E_MANIFEST_V3_REQUIRED:${distDir}`);
  }
  if (buildInfo?.releaseProfile !== expectedProfile) {
    throw new Error(
      `SITE_E2E_BUILD_PROFILE_MISMATCH:${expectedProfile}:${buildInfo?.releaseProfile || 'missing'}`,
    );
  }
  return { manifest, buildInfo };
}

async function prepareLaneArtifact(lane, options, buildRoot) {
  const expectedProfile = lane === 'diagnostic' ? 'dev' : 'public';
  const explicitDist = lane === 'diagnostic' ? options.diagnosticDist : options.releaseDist;
  const distDir = explicitDist
    ? path.resolve(rootDir, explicitDist)
    : path.join(buildRoot, `${lane}-dist`);
  if (options.build && !explicitDist) {
    console.error(`[site-e2e] building ${lane} lane -> ${distDir}`);
    await runCommand('npm', ['run', 'build:bundle', '--', '--emptyOutDir'], {
      env: {
        ...process.env,
        ENTROPY_RELEASE_PROFILE: expectedProfile,
        ENTROPY_EXTENSION_OUT_DIR: distDir,
      },
    });
  }
  const artifact = await readBuildInfo(distDir, expectedProfile);
  if (lane === 'release') {
    await runCommand(process.execPath, [
      path.join(rootDir, 'scripts/ci/check-public-build-debug-surface.mjs'),
      distDir,
    ]);
  }
  return {
    lane,
    distDir,
    sourceRetained: Boolean(explicitDist),
    sourceLifecycle: explicitDist ? 'external_retained' : 'temporary_removed_after_run',
    ...artifact,
  };
}

export function createLaneBuildReportMetadata(artifact, laneResult) {
  const sourceRetained = artifact?.sourceRetained === true;
  const temporaryExtensionRetained = laneResult?.temporaryExtensionRetained === true;
  return {
    releaseProfile: artifact.buildInfo.releaseProfile,
    buildId: artifact.buildInfo.buildId,
    gitCommitSha: artifact.buildInfo.gitCommitSha,
    dirty: artifact.buildInfo.dirty,
    sourcePath: sourceRetained ? artifact.distDir : null,
    sourceRetained,
    sourceLifecycle: artifact.sourceLifecycle,
    temporaryExtensionPath: temporaryExtensionRetained
      ? laneResult.temporaryExtensionPath
      : null,
    temporaryExtensionRetained,
    temporaryExtensionLifecycle: laneResult?.temporaryExtensionLifecycle
      || 'temporary_removed_after_lane',
  };
}

export function createScenarioSettingsPayload(scenario, enabled) {
  return {
    // Runtime-effect QA never owns history deletion or bookmark concealment,
    // including when a persistent QA profile previously enabled them.
    historyCleanupForBlocked: false,
    concealBlockedBookmarks: false,
    filteringMode: 'blocklist',
    permissionMode: 'selective',
    rulesMode: 'managed',
    dataCollectionMode: DATA_COLLECTION_MODES.PROTECTED_SITES,
    insightsConsent: INSIGHTS_CONSENT.PROTECTED_ONLY,
    gateConfig: {
      ...structuredClone(DEFAULT_GATE_CONFIG),
      entryCheckpoint: {
        ...structuredClone(DEFAULT_GATE_CONFIG.entryCheckpoint),
        enabled: false,
      },
      returnGuard: {
        ...structuredClone(DEFAULT_GATE_CONFIG.returnGuard),
        enabled: false,
      },
      detourSpreadGuard: {
        ...structuredClone(DEFAULT_GATE_CONFIG.detourSpreadGuard),
        enabled: false,
      },
    },
    nudgeConfig: structuredClone(DEFAULT_NUDGE_SETTINGS),
    filterSettings: buildScenarioSettings(scenario, { enabled }),
  };
}

function actionsForLane(scenario, lane, predicate) {
  return scenario.actions.filter((action) => (
    (action.lane === 'both' || action.lane === lane)
    && predicate(action)
  ));
}

function findLastScenarioAction(actions, kind) {
  for (let index = actions.length - 1; index >= 0; index -= 1) {
    if (actions[index]?.kind === kind) return actions[index];
  }
  return null;
}

function resolveRequiredTargetingHealthProbeIds(scenario) {
  const activeFilterKeys = new Set(
    Array.isArray(scenario?.expectedActivation?.activeFilterKeys)
      ? scenario.expectedActivation.activeFilterKeys
      : [],
  );
  return [
    ...(
      scenario?.expectedActivation?.socialMetrics
      || activeFilterKeys.has('socialMetrics')
        ? ['socialMetrics']
        : []
    ),
    ...(activeFilterKeys.has('shortFormBlock') ? ['shortForm'] : []),
  ];
}

export function createReproductionCommand(options, lane, scenario, {
  repeat = 1,
} = {}) {
  if (!Number.isSafeInteger(repeat) || repeat < 1 || repeat > 20) {
    throw new Error(`SITE_E2E_REPRODUCTION_REPEAT_INVALID:${repeat}`);
  }
  const args = [
    'npm run e2e:sites --',
    `--suite=${options.suite}`,
    `--lane=${lane}`,
    `--site=${scenario.siteId}`,
    `--repeat=${repeat}`,
    options.headless ? '--headless' : '--headed',
    ...(options.chromePath
      ? [`--chrome=${JSON.stringify(path.resolve(options.chromePath))}`]
      : []),
    ...(options.profile ? [`--profile=${JSON.stringify(path.resolve(options.profile))}`] : []),
    ...(options.measurementProfile
      ? [`--measurement-profile=${options.measurementProfile}`]
      : []),
    ...(options.featureGroup ? [`--feature-group=${options.featureGroup}`] : []),
    ...(options.repeatIsolation
      ? [`--repeat-isolation=${options.repeatIsolation.replaceAll('_', '-')}`]
      : []),
    `--report-dir=${JSON.stringify(path.resolve(options.reportDir))}`,
  ];
  return args.join(' ');
}

export function createPersistedSiteRuntimeOptions(options, overrides = {}) {
  const persisted = { ...options, ...overrides };
  if (persisted.repeatIsolation === null || persisted.repeatIsolation === undefined) {
    delete persisted.repeatIsolation;
  }
  return persisted;
}

function getBridgePayload(response) {
  if (response?.result?.payload) return response.result.payload;
  if (response?.result?.tool && response.result?.version) return response.result;
  return null;
}

export function getDiagnosticLifecycleSettlePayload(segment) {
  const payload = segment?.finalSettle?.lastPayload;
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    throw new Error('SITE_E2E_DIAGNOSTIC_LIFECYCLE_SETTLE_PAYLOAD_REQUIRED');
  }
  return payload;
}

export function extractDiagnosticProtectionRuntime(payload = null) {
  const protection = payload?.latest?.protection;
  if (!protection || typeof protection !== 'object') return null;
  return {
    ...(protection.summary?.runtime || {}),
    featureStates: protection.runtime?.featureStates || null,
  };
}

function getBridgeMarkdown(response) {
  return typeof response?.result?.markdown === 'string' ? response.result.markdown : null;
}

const DEBUGGER_OVERHEAD_DELTA_FIELDS = Object.freeze([
  'snapshotReadMs',
  'snapshotReadCount',
  'observerBookkeepingMs',
  'observerBookkeepingCount',
  'selectorProbeMs',
  'provenanceProbeMs',
  'writeProbeMs',
  'scanEvidenceProbeMs',
]);

export function diffDebuggerOverhead(after = null, before = null) {
  return Object.fromEntries(DEBUGGER_OVERHEAD_DELTA_FIELDS.map((key) => {
    const rawAfterValue = after?.[key];
    const rawBeforeValue = before?.[key];
    if (
      rawAfterValue === null
      || rawAfterValue === undefined
      || typeof rawAfterValue === 'boolean'
      || rawBeforeValue === null
      || rawBeforeValue === undefined
      || typeof rawBeforeValue === 'boolean'
    ) return [key, null];
    const afterValue = Number(rawAfterValue);
    const beforeValue = Number(rawBeforeValue);
    if (!Number.isFinite(afterValue) || !Number.isFinite(beforeValue)) return [key, null];
    const delta = afterValue - beforeValue;
    return [key, delta >= 0 ? Math.round(delta * 100) / 100 : null];
  }));
}

function createNavigationContracts(results = []) {
  return results
    .filter((result) => result.expectedRedirectPath)
    .map((result) => ({
      id: `navigation_redirect:${result.urlId || 'route'}`,
      status: result.observedPath === result.expectedRedirectPath ? 'PASS' : 'FAIL',
      evidence: {
        expectedPath: result.expectedRedirectPath,
        observedPath: result.observedPath,
      },
    }));
}

function conditionAppliesToLane(condition, lane) {
  return condition?.lane === 'both' || condition?.lane === lane;
}

function selectReadinessConditionObservation(
  condition,
  { readinessObservation, activeObservation },
) {
  if (condition.kind === 'selector_any_present') {
    return {
      observation: activeObservation,
      observationPhase: 'active_settled',
    };
  }
  return {
    observation: readinessObservation,
    observationPhase: 'readiness',
  };
}

export function createReadinessConditionContracts(
  scenario,
  lane,
  { readinessObservation, activeObservation },
) {
  return (scenario.readiness?.conditions || [])
    .filter((condition) => conditionAppliesToLane(condition, lane))
    .flatMap((condition) => {
      const { observation, observationPhase } = selectReadinessConditionObservation(
        condition,
        { readinessObservation, activeObservation },
      );
      let passed = null;
      let evidence = null;
      if (condition.kind === 'document_ready_state') {
        passed = observation?.readyState === condition.expected;
        evidence = {
          expected: condition.expected,
          actual: observation?.readyState || null,
          observationPhase,
        };
      } else if (condition.kind === 'url_path_equals') {
        passed = observation?.pathname === condition.expected;
        evidence = {
          expected: condition.expected,
          actual: observation?.pathname || null,
          observationPhase,
        };
      } else if (condition.kind === 'media_ready_state') {
        const actual = Number(observation?.media?.readyState);
        passed = Number.isFinite(actual) && actual >= Number(condition.minimumReadyState);
        evidence = {
          minimum: condition.minimumReadyState,
          actual: Number.isFinite(actual) ? actual : null,
          observationPhase,
        };
      } else if (condition.kind === 'selector_any_present') {
        const actual = Number(observation?.conditionSelectorCounts?.[condition.id]) || 0;
        passed = actual > 0;
        evidence = { actual, observationPhase };
      }
      return passed === null ? [] : [{
        id: condition.id,
        status: passed ? 'PASS' : 'FAIL',
        evidence,
      }];
    });
}

export function createObservableConditionContracts({
  scenario,
  lane,
  effect,
  activeObservation,
  disabledObservation,
  lifecycleResults,
  stimulusResults,
}) {
  const conditions = [
    ...(scenario.observableEffects?.conditions || []),
    ...(scenario.settle?.conditions || []),
  ];
  const activationDependentKinds = new Set([
    'selector_any_applied',
    'computed_visibility',
    'root_attributes_present',
    'computed_style_changed',
    'media_seek_reverted',
    'url_redirect',
  ]);
  return conditions
    .filter((condition) => conditionAppliesToLane(condition, lane))
    .flatMap((condition) => {
      let status = null;
      let evidence = null;
      if (condition.kind === 'selector_any_applied') {
        const minimum = Math.max(1, Number(condition.minimum) || 1);
        const actual = Number(effect.appliedTargetCount) || 0;
        status = actual >= minimum ? 'PASS' : (condition.conditionalOn ? 'WARN' : 'FAIL');
        evidence = { minimum, actual, conditionalOn: condition.conditionalOn || null };
      } else if (condition.kind === 'computed_visibility') {
        const actual = Number(effect.appliedHiddenCount) || 0;
        status = actual > 0 ? 'PASS' : (condition.conditionalOn ? 'WARN' : 'FAIL');
        evidence = { expected: condition.expected, hiddenTargetCount: actual };
      } else if (condition.kind === 'root_attributes_present') {
        const minimum = Math.max(1, Number(condition.minimum) || 1);
        const actual = Number(effect.activeRootSignalCount) || 0;
        status = actual >= minimum ? 'PASS' : 'FAIL';
        evidence = { minimum, actual };
      } else if (condition.kind === 'computed_style_changed') {
        status = effect.styleChanged ? 'PASS' : 'FAIL';
        evidence = {
          properties: condition.properties || [],
          changed: effect.styleChanged === true,
        };
      } else if (condition.kind === 'media_seek_reverted') {
        const seek = stimulusResults.find((result) => result.kind === 'seek');
        const before = Number.isFinite(seek?.before) ? seek.before : null;
        const closestAfter = Number.isFinite(seek?.closestAfter) ? seek.closestAfter : null;
        const actionAfter = Number.isFinite(seek?.after) ? seek.after : null;
        const finalAfter = Number.isFinite(activeObservation?.media?.currentTime)
          ? activeObservation.media.currentTime
          : null;
        const after = closestAfter ?? actionAfter;
        const measuredMinimumDrift = Number.isFinite(seek?.minimumDriftSeconds)
          ? seek.minimumDriftSeconds
          : null;
        const drift = measuredMinimumDrift !== null
          ? measuredMinimumDrift
          : before !== null && after !== null
            ? Math.abs(after - before)
            : null;
        status = drift === null
          ? 'WARN'
          : drift <= Number(condition.maximumDriftSeconds) ? 'PASS' : 'FAIL';
        evidence = {
          before,
          after,
          finalAfter,
          drift,
          maximumDriftSeconds: condition.maximumDriftSeconds,
          observationCount: Number(seek?.observationCount) || 0,
          observationWindowMs: Number(seek?.observationWindowMs) || null,
        };
      } else if (condition.kind === 'url_redirect') {
        const navigation = lifecycleResults.find((result) => (
          result.expectedRedirectPath === condition.expectedPath
        ));
        status = navigation
          ? (navigation.observedPath === condition.expectedPath ? 'PASS' : 'FAIL')
          : 'WARN';
        evidence = {
          expectedPath: condition.expectedPath,
          observedPath: navigation?.observedPath || null,
        };
      } else if (condition.kind === 'selector_absent') {
        const actual = Number(activeObservation?.conditionSelectorCounts?.[condition.id]) || 0;
        status = actual === 0 ? 'PASS' : 'FAIL';
        evidence = { actual };
      } else if (condition.kind === 'selectors_absent_after_disable') {
        const actual = Number(disabledObservation?.conditionSelectorCounts?.[condition.id]) || 0;
        status = actual === 0 ? 'PASS' : 'FAIL';
        evidence = { actual };
      } else if (condition.kind === 'root_attribute_absent') {
        const present = activeObservation?.conditionAttributePresent?.[condition.id];
        status = present === false ? 'PASS' : 'FAIL';
        evidence = { attribute: condition.attribute, present: present ?? null };
      } else if (condition.kind === 'stable_samples') {
        status = activeObservation?.settleStable === true ? 'PASS' : 'WARN';
        evidence = {
          expectedSamples: condition.samples,
          observedSamples: activeObservation?.settleSampleCount || 1,
        };
      }
      if (
        status === 'FAIL'
        && activationDependentKinds.has(condition.kind)
        && !['measured', 'broken'].includes(effect.status)
      ) {
        status = 'WARN';
        evidence = { ...evidence, measurementState: effect.status };
      }
      if (
        (
          condition.kind === 'selectors_absent_after_disable'
          || (
            condition.kind === 'computed_style_changed'
            && condition.compareTo === 'disabled_baseline'
          )
        )
        && !['measured', 'broken'].includes(effect.cleanupState)
      ) {
        status = 'WARN';
        evidence = { ...evidence, disableBaselineState: effect.cleanupState || 'unavailable' };
      }
      return status === null ? [] : [{ id: condition.id, status, evidence }];
    });
}

function observationSettleSignature(observation) {
  return JSON.stringify({
    candidateCount: observation?.candidateCount ?? null,
    appliedTargetCount: observation?.appliedTargetCount ?? null,
    activeRootSignalCount: observation?.activeRootSignalCount ?? null,
    settleSelectorCount: observation?.settleSelectorCount ?? null,
    candidateStyle: observation?.candidateStyle ?? null,
  });
}

async function collectSettledScenarioObservation(harness, page, scenario, lane) {
  const stableConditions = (scenario.settle?.conditions || []).filter((condition) => (
    condition.kind === 'stable_samples' && conditionAppliesToLane(condition, lane)
  ));
  const sampleCount = Math.max(
    1,
    ...stableConditions.map((condition) => Math.max(1, Number(condition.samples) || 1)),
  );
  const intervalMs = Math.max(
    0,
    ...stableConditions.map((condition) => Math.max(0, Number(condition.intervalMs) || 0)),
  );
  const observations = [];
  for (let index = 0; index < sampleCount; index += 1) {
    if (index > 0 && intervalMs > 0) await sleep(intervalMs);
    observations.push(await readScenarioPageState(harness, page, scenario));
  }
  const signatures = observations.map(observationSettleSignature);
  return {
    ...observations.at(-1),
    settleSampleCount: observations.length,
    settleStable: signatures.every((signature) => signature === signatures[0]),
  };
}

function pendingQueuesSettled(costEvidence) {
  return costEvidence?.measurementStates?.efficiency?.settled ?? null;
}

function pendingTrajectoryNumber(value) {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function pendingTrajectoryBoolean(value) {
  return typeof value === 'boolean' ? value : null;
}

function createPendingTrajectoryEntry({
  attempt,
  elapsedMs,
  costEvidence,
  settle,
}) {
  const pending = costEvidence?.pending || {};
  return {
    attempt,
    elapsedMs,
    settled: pendingTrajectoryBoolean(settle?.settled),
    pending: {
      observerMutations: pendingTrajectoryNumber(pending.observerMutations),
      socialQueue: pendingTrajectoryNumber(pending.socialQueue),
      socialDirtyRoots: pendingTrajectoryNumber(pending.socialDirtyRoots),
      socialOwnedMutations: pendingTrajectoryNumber(pending.socialOwnedMutations),
      socialOwnedMutationOldestAgeMs:
        pendingTrajectoryNumber(pending.socialOwnedMutationOldestAgeMs),
      socialTimer: pendingTrajectoryBoolean(pending.socialTimer),
      socialIdle: pendingTrajectoryBoolean(pending.socialIdle),
      socialCurrentScan: pendingTrajectoryBoolean(pending.socialCurrentScan),
      socialForceFullScan: pendingTrajectoryBoolean(pending.socialForceFullScan),
      textPendingNodes: pendingTrajectoryNumber(pending.textPendingNodes),
      textPendingSubtrees: pendingTrajectoryNumber(pending.textPendingSubtrees),
      textPendingSubtreeTasks: pendingTrajectoryNumber(pending.textPendingSubtreeTasks),
      textFlushScheduled: pendingTrajectoryBoolean(pending.textFlushScheduled),
      textIdleChunkScheduled: pendingTrajectoryBoolean(pending.textIdleChunkScheduled),
      visualPendingRechecks: pendingTrajectoryNumber(costEvidence?.visualMedia?.pendingRecheckCount),
    },
  };
}

function appendBoundedPendingTrajectory(trajectory, entry) {
  if (trajectory.length < FINAL_DEBUGGER_SETTLE_TRAJECTORY_LIMIT) {
    trajectory.push(entry);
    return;
  }
  // Preserve the first observation and the most recent attempts. Attempt ids
  // make any bounded middle omission explicit without retaining page data.
  trajectory.splice(1, 1);
  trajectory.push(entry);
}

function settleEvidenceToken(value, maxLength = 120) {
  return typeof value === 'string'
    && value.length <= maxLength
    && /^[A-Za-z0-9_.:-]+$/u.test(value)
    ? value
    : null;
}

function settleEvidenceTokenList(value) {
  return (Array.isArray(value) ? value : [])
    .map((entry) => settleEvidenceToken(entry))
    .filter(Boolean)
    .slice(0, 32);
}

function createDebuggerPendingTrajectoryEvidence(value) {
  return (Array.isArray(value) ? value : []).slice(0, 32).map((entry) => ({
    attempt: pendingTrajectoryNumber(entry?.attempt),
    elapsedMs: pendingTrajectoryNumber(entry?.elapsedMs),
    settled: pendingTrajectoryBoolean(entry?.settled),
    pending: {
      observerMutations: pendingTrajectoryNumber(entry?.pending?.observerMutations),
      socialQueue: pendingTrajectoryNumber(entry?.pending?.socialQueue),
      socialDirtyRoots: pendingTrajectoryNumber(entry?.pending?.socialDirtyRoots),
      socialOwnedMutations: pendingTrajectoryNumber(entry?.pending?.socialOwnedMutations),
      socialOwnedMutationOldestAgeMs:
        pendingTrajectoryNumber(entry?.pending?.socialOwnedMutationOldestAgeMs),
      socialTimer: pendingTrajectoryBoolean(entry?.pending?.socialTimer),
      socialIdle: pendingTrajectoryBoolean(entry?.pending?.socialIdle),
      socialCurrentScan: pendingTrajectoryBoolean(entry?.pending?.socialCurrentScan),
      socialForceFullScan: pendingTrajectoryBoolean(entry?.pending?.socialForceFullScan),
      textPendingNodes: pendingTrajectoryNumber(entry?.pending?.textPendingNodes),
      textPendingSubtrees: pendingTrajectoryNumber(entry?.pending?.textPendingSubtrees),
      textPendingSubtreeTasks:
        pendingTrajectoryNumber(entry?.pending?.textPendingSubtreeTasks),
      textFlushScheduled: pendingTrajectoryBoolean(entry?.pending?.textFlushScheduled),
      textIdleChunkScheduled:
        pendingTrajectoryBoolean(entry?.pending?.textIdleChunkScheduled),
      visualPendingRechecks: pendingTrajectoryNumber(entry?.pending?.visualPendingRechecks),
    },
  }));
}

function createDebuggerSettleOwnerEvidence(settle) {
  const owners = settle?.owners;
  if (!owners || typeof owners !== 'object' || Array.isArray(owners)) return null;
  return Object.fromEntries(DEBUGGER_SETTLE_OWNER_IDS.flatMap((ownerId) => {
    const owner = owners[ownerId];
    if (!owner || typeof owner !== 'object' || Array.isArray(owner)) return [];
    return [[ownerId, {
      required: typeof owner.required === 'boolean' ? owner.required : null,
      state: settleEvidenceToken(owner.state),
      reason: settleEvidenceToken(owner.reason),
      ownerState: settleEvidenceToken(owner.ownerState),
      ownerReason: settleEvidenceToken(owner.ownerReason),
      settled: typeof owner.settled === 'boolean' ? owner.settled : null,
      unsettledFields: settleEvidenceTokenList(owner.unsettledFields),
      unavailableFields: settleEvidenceTokenList(owner.unavailableFields),
    }]];
  }));
}

function createDebuggerProbeContractEvidence(payload) {
  const probes = Array.isArray(payload?.probes) ? payload.probes : [];
  const entries = TARGETING_HEALTH_PROBE_IDS.flatMap((probeId) => {
    const matches = probes.filter((probe) => probe?.probeId === probeId);
    if (matches.length === 0) return [];
    const probe = matches[0];
    const details = probe?.details && typeof probe.details === 'object'
      && !Array.isArray(probe.details)
      ? probe.details
      : {};
    const targetingHealth = details.targetingHealth
      && typeof details.targetingHealth === 'object'
      && !Array.isArray(details.targetingHealth)
      ? details.targetingHealth
      : {};
    return [[probeId, {
      matchCount: matches.length,
      status: settleEvidenceToken(probe?.status),
      reason: settleEvidenceToken(probe?.reason),
      measurable: typeof probe?.measurable === 'boolean' ? probe.measurable : null,
      operationCount: Number.isSafeInteger(probe?.operationCount)
        && probe.operationCount >= 0
        ? probe.operationCount
        : null,
      canonicalActive: typeof details.canonicalActive === 'boolean'
        ? details.canonicalActive
        : null,
      baselineCovered: typeof details.baselineCovered === 'boolean'
        ? details.baselineCovered
        : null,
      targetingHealthValidity: settleEvidenceToken(targetingHealth.validity),
      targetingHealthReasonCode: settleEvidenceToken(targetingHealth.reasonCode),
      targetingHealthContractError:
        settleEvidenceToken(details.targetingHealthContractError),
      baselineTargetingHealthContractError:
        settleEvidenceToken(details.baselineTargetingHealthContractError),
      targetingHealthProbeContractError:
        settleEvidenceToken(details.targetingHealthProbeContractError),
    }]];
  });
  return entries.length > 0 ? Object.fromEntries(entries) : null;
}

function createDebuggerProtectionActivationEvidence(payload) {
  const summary = payload?.latest?.protection?.summary;
  if (!summary || typeof summary !== 'object' || Array.isArray(summary)) return null;
  const applied = summary.runtime;
  const attempt = summary.runtimeAttempt;
  const safeActiveFilterKeys = (value) => (Array.isArray(value) ? value : [])
    .map((entry) => settleEvidenceToken(entry))
    .filter(Boolean)
    .slice(0, 32);
  const safeRevision = (value) => (
    Number.isSafeInteger(value) && value >= 0 ? value : null
  );
  const safeTimestamp = (value) => (
    Number.isFinite(value) && value >= 0 ? value : null
  );
  const appliedEvidence = applied && typeof applied === 'object' && !Array.isArray(applied)
    ? {
      source: settleEvidenceToken(applied.source),
      shouldActivate: pendingTrajectoryBoolean(applied.shouldActivate),
      shouldMutate: pendingTrajectoryBoolean(applied.shouldMutate),
      traceId: settleEvidenceToken(applied.traceId),
      revision: safeRevision(applied.revision),
      activeFilterKeys: safeActiveFilterKeys(applied.activeFilterKeys),
      lastUpdatedAt: safeTimestamp(applied.lastUpdatedAt),
    }
    : null;
  const attemptEvidence = attempt
    && typeof attempt === 'object'
    && !Array.isArray(attempt)
    ? {
      source: settleEvidenceToken(attempt.source),
      shouldActivate: pendingTrajectoryBoolean(attempt.shouldActivate),
      shouldMutate: pendingTrajectoryBoolean(attempt.shouldMutate),
      error: settleEvidenceToken(attempt.error),
      staleIgnored: pendingTrajectoryBoolean(attempt.staleIgnored),
      staleReason: settleEvidenceToken(attempt.staleReason),
      needsResync: pendingTrajectoryBoolean(attempt.needsResync),
      resyncReason: settleEvidenceToken(attempt.resyncReason),
      traceId: settleEvidenceToken(attempt.traceId),
      expectedBaseRevision: safeRevision(attempt.expectedBaseRevision),
      receivedBaseRevision: safeRevision(attempt.receivedBaseRevision),
      expectedRevision: safeRevision(attempt.expectedRevision),
      receivedRevision: safeRevision(attempt.receivedRevision),
      attemptedAt: safeTimestamp(attempt.attemptedAt),
    }
    : null;
  return appliedEvidence || attemptEvidence
    ? { applied: appliedEvidence, attempt: attemptEvidence }
    : null;
}

export function createDebuggerSettleReportEvidence(settleResult) {
  if (!settleResult) return null;
  const protectionActivation = createDebuggerProtectionActivationEvidence(
    settleResult.lastPayload,
  );
  return {
    state: settleEvidenceToken(settleResult.state),
    reason: settleEvidenceToken(settleResult.reason),
    settled: typeof settleResult.settled === 'boolean' ? settleResult.settled : null,
    timedOut: settleResult.timedOut === true,
    attempts: Number.isSafeInteger(settleResult.attempts) && settleResult.attempts >= 0
      ? settleResult.attempts
      : null,
    elapsedMs: Number.isFinite(settleResult.elapsedMs) && settleResult.elapsedMs >= 0
      ? settleResult.elapsedMs
      : null,
    unsettledFields: settleEvidenceTokenList(settleResult.settle?.unsettledFields),
    unavailableFields: settleEvidenceTokenList(settleResult.settle?.unavailableFields),
    owners: createDebuggerSettleOwnerEvidence(settleResult.settle),
    probeContracts: createDebuggerProbeContractEvidence(settleResult.lastPayload),
    ...(protectionActivation ? { protectionActivation } : {}),
    pendingTrajectory: createDebuggerPendingTrajectoryEvidence(
      settleResult.pendingTrajectory,
    ),
    pendingTrajectoryTruncated: settleResult.pendingTrajectoryTruncated === true,
    conditionWait: settleResult.conditionWait ? {
      elapsedMs: pendingTrajectoryNumber(settleResult.conditionWait.elapsedMs),
      settled: pendingTrajectoryBoolean(settleResult.conditionWait.settled),
      timedOut: pendingTrajectoryBoolean(settleResult.conditionWait.timedOut),
      pendingConditionIds: settleEvidenceTokenList(settleResult.conditionWait.pendingConditionIds),
      timedOutConditionIds: settleEvidenceTokenList(settleResult.conditionWait.timedOutConditionIds),
      budgets: settleResult.conditionWait.budgets.slice(0, 32).map((budget) => ({
        id: settleEvidenceToken(budget.id), timeoutMs: pendingTrajectoryNumber(budget.timeoutMs),
      })),
    } : null,
  };
}

export async function waitForFinalDebuggerSettle({
  lane,
  scenario = null,
  readSnapshot,
  analyzeCostEvidence = extractDebuggerCostEvidence,
  timeoutMs = FINAL_DEBUGGER_SETTLE_TIMEOUT_MS,
  pollIntervalMs = FINAL_DEBUGGER_SETTLE_POLL_INTERVAL_MS,
  now = Date.now,
  delay = sleep,
} = {}) {
  if (lane !== 'diagnostic') {
    return {
      state: 'not_in_release',
      reason: 'runtime_debugger_not_in_release',
      settled: null,
      timedOut: false,
      attempts: 0,
      elapsedMs: 0,
      lastResponse: null,
      lastPayload: null,
      costEvidence: null,
      settle: null,
      pendingTrajectory: [],
      pendingTrajectoryTruncated: false,
    };
  }
  if (typeof readSnapshot !== 'function') {
    throw new Error('SITE_E2E_FINAL_DEBUGGER_SNAPSHOT_READER_REQUIRED');
  }
  if (typeof analyzeCostEvidence !== 'function') {
    throw new Error('SITE_E2E_FINAL_DEBUGGER_COST_ANALYZER_REQUIRED');
  }
  const boundedTimeoutMs = Number.isFinite(Number(timeoutMs))
    ? Math.max(0, Number(timeoutMs))
    : FINAL_DEBUGGER_SETTLE_TIMEOUT_MS;
  const boundedPollIntervalMs = Number.isFinite(Number(pollIntervalMs))
    ? Math.max(1, Number(pollIntervalMs))
    : FINAL_DEBUGGER_SETTLE_POLL_INTERVAL_MS;
  const startedAt = now();
  const waitConditions = (scenario?.settle?.conditions || []).filter(
    (condition) => condition.waitTimeoutMs !== undefined,
  );
  let attempts = 0;
  let lastResponse = null;
  let lastPayload = null;
  let costEvidence = null;
  let settle = null;
  let conditionWait = null;
  const pendingTrajectory = [];

  while (true) {
    lastResponse = await readSnapshot();
    attempts += 1;
    lastPayload = getBridgePayload(lastResponse);
    costEvidence = analyzeCostEvidence(lastPayload);
    settle = costEvidence.measurementStates.efficiency;
    const elapsedMs = Math.max(0, now() - startedAt);
    const conditionResults = createDiagnosticConditionContracts(
      { settle: { conditions: waitConditions } }, lastPayload,
    );
    const pendingConditions = conditionResults.filter((condition) => condition.status !== 'PASS');
    const expiredConditions = pendingConditions.filter((condition) => elapsedMs >=
      waitConditions.find((candidate) => candidate.id === condition.id).waitTimeoutMs);
    conditionWait = waitConditions.length === 0 ? null : {
      elapsedMs,
      settled: pendingConditions.length === 0,
      timedOut: expiredConditions.length > 0,
      pendingConditionIds: pendingConditions.map((condition) => condition.id),
      timedOutConditionIds: expiredConditions.map((condition) => condition.id),
      budgets: waitConditions.map(({ id, waitTimeoutMs }) => ({ id, timeoutMs: waitTimeoutMs })),
    };
    appendBoundedPendingTrajectory(pendingTrajectory, createPendingTrajectoryEntry({
      attempt: attempts,
      elapsedMs,
      costEvidence,
      settle,
    }));
    if (settle.settled === true && (pendingConditions.length === 0 || expiredConditions.length > 0)) {
      return {
        state: settle.state,
        reason: settle.reason,
        settled: true,
        timedOut: false,
        attempts,
        elapsedMs,
        lastResponse,
        lastPayload,
        costEvidence,
        settle,
        conditionWait,
        pendingTrajectory,
        pendingTrajectoryTruncated: attempts > pendingTrajectory.length,
      };
    }
    if (settle.settled !== true && elapsedMs >= boundedTimeoutMs) {
      return {
        state: settle.state,
        reason: settle.reason,
        settled: settle.settled,
        timedOut: true,
        attempts,
        elapsedMs,
        lastResponse,
        lastPayload,
        costEvidence,
        settle,
        conditionWait,
        pendingTrajectory,
        pendingTrajectoryTruncated: attempts > pendingTrajectory.length,
      };
    }
    const nextDeadlineMs = settle.settled === true
      ? Math.min(...pendingConditions.map((condition) =>
        waitConditions.find((candidate) => candidate.id === condition.id).waitTimeoutMs))
      : boundedTimeoutMs;
    await delay(Math.min(boundedPollIntervalMs, Math.max(1, nextDeadlineMs - elapsedMs)));
  }
}

function sameSortedStrings(left = [], right = []) {
  const normalizedLeft = [...left].sort((a, b) => a.localeCompare(b));
  const normalizedRight = [...right].sort((a, b) => a.localeCompare(b));
  return normalizedLeft.length === normalizedRight.length
    && normalizedLeft.every((value, index) => value === normalizedRight[index]);
}

async function waitForScenarioConfigurationState(harness, scenario, {
  enabled,
  timeoutMs = 10_000,
} = {}) {
  const expectedActiveFilterSettingKeys = enabled ? scenario.settings.activeKeys : [];
  const deadline = Date.now() + timeoutMs;
  let evidence = null;
  while (Date.now() < deadline) {
    evidence = await collectScenarioConfigurationEvidence(harness, scenario);
    if (
      evidence.targetBlocked === true
      && evidence.filteringMode === 'blocklist'
      && evidence.permissionMode === 'selective'
      && evidence.rulesMode === 'managed'
      && evidence.dataCollectionMode === 'protected_sites'
      && evidence.insightsConsent === 'protected_only'
      && sameSortedStrings(
        evidence.activeFilterSettingKeys,
        expectedActiveFilterSettingKeys,
      )
    ) {
      return {
        state: 'measured',
        expectedActiveFilterSettingKeys,
        evidence,
      };
    }
    await sleep(200);
  }
  return {
    state: 'broken',
    expectedActiveFilterSettingKeys,
    evidence,
  };
}

async function waitForDisabledScenarioCleanup(harness, page, scenario, {
  timeoutMs = 10_000,
} = {}) {
  const deadline = Date.now() + timeoutMs;
  let observation = null;
  while (Date.now() < deadline) {
    observation = await readScenarioPageState(harness, page, scenario);
    if (
      Number(observation?.disableCleanupAppliedTargetCount) === 0
      && Number(observation?.disableCleanupRootSignalCount) === 0
      && Number(observation?.settleSelectorCount) === 0
    ) {
      return { state: 'measured', observation };
    }
    await sleep(200);
  }
  return { state: 'broken', observation };
}

async function waitForInitialObservableActivation(harness, page, scenario, {
  lane,
  timeoutMs = INITIAL_ACTIVATION_TIMEOUT_MS,
} = {}) {
  const deadline = Date.now() + timeoutMs;
  let last = null;
  let runtime = null;
  let lastRuntimeReadAt = 0;
  let lastDispatchAt = 0;
  let lastReloadedStrategy = null;
  while (Date.now() < deadline) {
    last = await readScenarioPageState(harness, page, scenario);
    if (
      Number(last?.appliedTargetCount) > 0
      || Number(last?.activeRootSignalCount) > 0
    ) {
      return {
        state: 'measured',
        waitedMs: timeoutMs - Math.max(0, deadline - Date.now()),
        observation: last,
        runtime,
      };
    }
    const now = Date.now();
    if (now - lastRuntimeReadAt >= 1_000) {
      lastRuntimeReadAt = now;
      runtime = await collectProtectionRuntimeEvidence(harness, scenario, { refresh: true });
      if (
        runtime?.strategy?.state
        && runtime.strategy.state !== 'observe'
        && now - lastDispatchAt >= 2_000
      ) {
        lastDispatchAt = now;
        if (runtime.strategy.state !== lastReloadedStrategy) {
          lastReloadedStrategy = runtime.strategy.state;
          await harness.reloadPage(page, { ignoreCache: false, timeoutMs: 45_000 });
        }
        await activateScenarioTab(harness, page, { lane });
      }
    }
    await sleep(500);
  }
  return {
    state: last?.readinessSatisfied === true ? 'armed_idle' : 'unavailable',
    waitedMs: timeoutMs,
    observation: last,
    runtime,
  };
}

async function readApprovedBaseline(suite) {
  const baselinePath = path.join(rootDir, 'scripts/e2e/sites/baselines', `${suite}.json`);
  try {
    return {
      path: baselinePath,
      value: JSON.parse(await fs.readFile(baselinePath, 'utf8')),
    };
  } catch (error) {
    if (error?.code === 'ENOENT') return { path: baselinePath, value: null };
    throw error;
  }
}

function selectApprovedBaseline(baseline, { scenario, lane, browser, headless }) {
  const entry = baseline?.entries?.[scenario.id]?.[lane]?.[headless ? 'headless' : 'headed'];
  if (!entry) return null;
  if (entry.browserProduct && entry.browserProduct !== browser) return null;
  return entry;
}

async function collectBlockedRun({
  scenario,
  lane,
  repeatIndex,
  options,
  blocker,
  browser = null,
  errors = [],
  progression = null,
  configuration = null,
  build = null,
}) {
  return {
    schemaVersion: 1,
    outcome: SITE_RUN_OUTCOMES.INCONCLUSIVE,
    classification: blocker.classification,
    blocker,
    lane,
    repeatIndex,
    scenarioId: scenario.id,
    siteId: scenario.siteId,
    routeId: new URL(scenario.urls.primary).pathname,
    url: sanitizeSiteHarnessUrl(scenario.urls.primary),
    features: scenario.expectedActivation.activeFilterKeys,
    activation: {
      state: 'unavailable',
      expectedActiveFilterKeys: scenario.expectedActivation.activeFilterKeys,
      activeFilterKeys: [],
      social: null,
    },
    observableEffect: {
      status: 'unavailable',
      candidateCount: null,
      appliedTargetCount: null,
      cleanupState: 'unavailable',
      reenabled: null,
    },
    costs: {
      before: null,
      after: null,
      delta: null,
      storage: null,
    },
    progression,
    cleanup: { pendingQueuesSettled: null },
    debugger: {
      availability: isRuntimeDebuggerInstrumentationEnabled({
        lane,
        measurementProfile: options?.measurementProfile,
      }) ? 'unavailable' : 'not_requested',
    },
    contracts: [],
    errors,
    browser,
    ...(configuration ? { configuration } : {}),
    ...(build ? { build } : {}),
    reproductionCommand: createReproductionCommand(options, lane, scenario),
    artifacts: {},
  };
}

const CONTENT_RUNTIME_SETTLEMENT_EVENT_NAMES = new Set([
  'protection_tab_updated_admission_url_reconciled',
  'protection_tab_updated_dispatch_settled',
  'protection_tab_updated_dispatch_rejected',
]);

function createScenarioBuildIdentity(artifact) {
  return {
    releaseProfile: artifact.buildInfo.releaseProfile,
    buildId: artifact.buildInfo.buildId,
    gitCommitSha: artifact.buildInfo.gitCommitSha,
    dirty: artifact.buildInfo.dirty,
  };
}

export function createContentRuntimeSettlementLedger() {
  const eventsByIdentity = new Map();
  const windowByCheckpoint = new Map();

  function add(checkpoint, diagnostics) {
    if (!diagnostics || typeof diagnostics !== 'object') return diagnostics;
    if (diagnostics.window && typeof diagnostics.window === 'object') {
      windowByCheckpoint.set(checkpoint, Object.freeze({ checkpoint, ...diagnostics.window }));
    }
    for (const event of Array.isArray(diagnostics.events) ? diagnostics.events : []) {
      if (!CONTENT_RUNTIME_SETTLEMENT_EVENT_NAMES.has(event?.event)) continue;
      if (!Number.isSafeInteger(event?.id) || !Number.isSafeInteger(event?.recordedAt)) continue;
      const identity = `${event.recordedAt}:${event.id}:${event.event}`;
      if (!eventsByIdentity.has(identity)) eventsByIdentity.set(identity, event);
    }
    return diagnostics;
  }

  function snapshot() {
    return {
      events: Array.from(eventsByIdentity.values()).sort((left, right) => (
        left.recordedAt - right.recordedAt || left.id - right.id
      )),
      windows: Array.from(windowByCheckpoint.values(), (window) => ({ ...window })),
      eventCount: eventsByIdentity.size,
      anyWindowMayBeTruncated: Array.from(windowByCheckpoint.values()).some(
        (window) => window.windowMayBeTruncated === true,
      ),
    };
  }

  return Object.freeze({ add, snapshot });
}

export async function runScenarioMeasurementPrelude({
  lane,
  startDiagnosticSession,
  settleDiagnosticSession,
  resetDiagnosticSession,
  onDiagnosticStarted,
  collectBaseline,
  runMeasurementActions,
}) {
  if (lane === 'diagnostic') {
    await startDiagnosticSession();
    onDiagnosticStarted();
    await settleDiagnosticSession();
    await resetDiagnosticSession();
  }
  const baseline = await collectBaseline();
  const actionResults = await runMeasurementActions();
  return { baseline, actionResults };
}

export async function runDiagnosticAwareLifecycleActions({
  lane,
  actions,
  runAction,
  stopDiagnosticSession,
  settleDiagnosticSessionBeforeStop,
  startDiagnosticSession,
  settleDiagnosticSession,
  resetDiagnosticSession,
  onDiagnosticStopped,
  onDiagnosticStarted,
}) {
  const results = [];
  const completedSegments = [];
  for (const [actionIndex, action] of actions.entries()) {
    const crossesDocumentBoundary = LIFECYCLE_ACTIONS.has(action.kind);
    if (lane === 'diagnostic' && crossesDocumentBoundary) {
      const finalSettle = await settleDiagnosticSessionBeforeStop();
      const response = await stopDiagnosticSession();
      onDiagnosticStopped();
      completedSegments.push({
        actionIndex,
        endedBeforeAction: action.kind,
        finalSettle,
        response,
      });
    }
    results.push(...await runAction(action));
    if (lane === 'diagnostic' && crossesDocumentBoundary) {
      await startDiagnosticSession(action.kind === 'reload' ? 'reload' : 'live');
      onDiagnosticStarted();
      await settleDiagnosticSession();
      await resetDiagnosticSession();
    }
  }
  return { results, completedSegments };
}

function createDiagnosticBaselineSettleError(settle, lazyBaselineReset = null) {
  const error = new Error(
    `SITE_E2E_DIAGNOSTIC_BASELINE_SETTLE_REQUIRED:${settle.reason || settle.state}`,
  );
  error.siteE2ESafeDetails = {
    kind: 'diagnostic_baseline_settle',
    settle: createDebuggerSettleReportEvidence(settle),
    ...(lazyBaselineReset ? { lazyBaselineReset } : {}),
  };
  return error;
}

function isExactLazySocialBaselineSettleFailure(settleResult) {
  if (
    settleResult?.settled !== null
    || settleResult?.timedOut !== true
    || settleResult?.state !== 'unavailable'
    || settleResult?.reason !== 'final_snapshot_settle_state_unavailable'
    || !needsLazyBaselineReset(settleResult.lastPayload)
  ) {
    return false;
  }
  const settle = settleResult.settle;
  const owners = settle?.owners;
  const ownerKeys = owners && typeof owners === 'object' && !Array.isArray(owners)
    ? Reflect.ownKeys(owners)
    : [];
  if (
    settle?.state !== 'unavailable'
    || settle?.reason !== 'final_snapshot_settle_state_unavailable'
    || settle?.settled !== null
    || !Array.isArray(settle.unsettledFields)
    || settle.unsettledFields.length !== 0
    || !Array.isArray(settle.unavailableFields)
    || settle.unavailableFields.length !== 0
    || !owners
    || typeof owners !== 'object'
    || Array.isArray(owners)
    || ownerKeys.length !== DEBUGGER_SETTLE_OWNER_IDS.length
    || ownerKeys.some((ownerId) => (
      typeof ownerId !== 'string' || !DEBUGGER_SETTLE_OWNER_IDS.includes(ownerId)
    ))
  ) {
    return false;
  }
  const social = owners.socialMetrics;
  if (
    social?.required !== true
    || social.state !== 'unavailable'
    || social.reason !== 'owner_probe_not_measurable'
    || social.ownerState !== 'broken'
    || social.ownerReason !== 'targeting_health_probe_contract_invalid'
    || social.settled !== null
    || !Array.isArray(social.unsettledFields)
    || social.unsettledFields.length !== 0
    || !Array.isArray(social.unavailableFields)
    || social.unavailableFields.length !== 0
  ) {
    return false;
  }
  return DEBUGGER_SETTLE_OWNER_IDS
    .filter((ownerId) => ownerId !== 'socialMetrics')
    .every((ownerId) => {
      const owner = owners[ownerId];
      return (
        owner?.required === false
        && owner.state === 'inactive'
        && owner.reason === 'owner_inactive'
        && owner.settled === null
        && Array.isArray(owner.unsettledFields)
        && owner.unsettledFields.length === 0
        && Array.isArray(owner.unavailableFields)
        && owner.unavailableFields.length === 0
      )
        || (
          owner?.required === true
          && owner.state === 'measured'
          && owner.reason === 'final_snapshot_settled'
          && owner.settled === true
          && Array.isArray(owner.unsettledFields)
          && owner.unsettledFields.length === 0
          && Array.isArray(owner.unavailableFields)
          && owner.unavailableFields.length === 0
        );
    });
}

export async function settleDiagnosticSessionBeforeBaseline(harness, page, {
  settleDiagnosticSession = () => settleDiagnosticSessionForCapture(harness, page),
  resetDiagnosticSession = () => sendRuntimeDebuggerAutomationAction(
    harness,
    page,
    RUNTIME_DEBUGGER_AUTOMATION_ACTIONS.RESET,
  ),
} = {}) {
  if (typeof settleDiagnosticSession !== 'function') {
    throw new Error('SITE_E2E_DIAGNOSTIC_BASELINE_SETTLE_FUNCTION_REQUIRED');
  }
  if (typeof resetDiagnosticSession !== 'function') {
    throw new Error('SITE_E2E_DIAGNOSTIC_BASELINE_RESET_FUNCTION_REQUIRED');
  }
  const initialSettle = await settleDiagnosticSession();
  if (initialSettle.settled === true) return initialSettle;
  if (!isExactLazySocialBaselineSettleFailure(initialSettle)) {
    throw createDiagnosticBaselineSettleError(initialSettle);
  }

  const recoveryEvidence = {
    reason: 'lazy_social_metrics_baseline_stale',
    eligible: true,
    attempted: true,
    completed: false,
    initialSettle: createDebuggerSettleReportEvidence(initialSettle),
  };
  // This rotates only the Runtime Debugger measurement epoch. It does not retry
  // a product owner, rescan the DOM, or recover selector/targeting behavior.
  try {
    await resetDiagnosticSession();
  } catch (_error) {
    const error = new Error('SITE_E2E_DIAGNOSTIC_LAZY_BASELINE_RESET_FAILED');
    error.siteE2ESafeDetails = {
      kind: 'diagnostic_baseline_settle',
      settle: createDebuggerSettleReportEvidence(initialSettle),
      lazyBaselineReset: recoveryEvidence,
    };
    throw error;
  }

  const retriedSettle = await settleDiagnosticSession();
  if (retriedSettle.settled !== true) {
    throw createDiagnosticBaselineSettleError(retriedSettle, {
      ...recoveryEvidence,
      completed: true,
    });
  }
  return retriedSettle;
}

async function settleDiagnosticSessionForCapture(harness, page) {
  return waitForFinalDebuggerSettle({
    lane: 'diagnostic',
    readSnapshot: () => sendRuntimeDebuggerAutomationAction(
      harness,
      page,
      RUNTIME_DEBUGGER_AUTOMATION_ACTIONS.SNAPSHOT,
    ),
    timeoutMs: FINAL_DEBUGGER_SETTLE_TIMEOUT_MS,
  });
}

async function startDiagnosticSessionAfterDocumentBoundary(harness, page, captureKind, {
  timeoutMs = 30_000,
  onContentRuntimeDiagnostics = null,
} = {}) {
  await activateScenarioTab(harness, page, { lane: 'diagnostic' });
  const deadline = Date.now() + timeoutMs;
  let lastDiagnostics = null;
  let lastError = null;
  while (Date.now() < deadline) {
    lastDiagnostics = await collectContentRuntimeDiagnostics(harness, page);
    onContentRuntimeDiagnostics?.(lastDiagnostics);
    if (['receiver_ready', 'active'].includes(lastDiagnostics.currentSession?.status)) {
      try {
        return await sendRuntimeDebuggerAutomationAction(
          harness,
          page,
          RUNTIME_DEBUGGER_AUTOMATION_ACTIONS.START,
          { captureKind },
        );
      } catch (error) {
        const message = String(error?.message || error || '');
        if (
          !message.includes('RUNTIME_DEBUGGER_AUTOMATION_CONTENT_DELIVERY_FAILED')
          && !message.includes('RUNTIME_DEBUGGER_AUTOMATION_CONTENT_NOT_READY')
          && !message.includes('RUNTIME_DEBUGGER_AUTOMATION_TARGET_TAB_UNAVAILABLE')
        ) {
          throw error;
        }
        lastError = error;
      }
    }
    await sleep(200);
  }
  throw new Error([
    'SITE_E2E_RUNTIME_DEBUGGER_CONTENT_RELAY_NOT_READY',
    lastDiagnostics?.currentSession?.status || lastDiagnostics?.availability || 'unavailable',
    lastError?.message || lastDiagnostics?.error || 'timeout',
  ].join(':'));
}

async function runOneScenario({
  harness,
  artifact,
  scenario,
  lane,
  repeatIndex,
  options,
  approvedBaseline,
  laneProgression,
}) {
  const pageErrors = [];
  let page = null;
  let pageCollector = null;
  let extensionCollector = null;
  let extensionErrorCursor = null;
  let debuggerStarted = false;
  let storageBefore = null;
  let metricsBefore = null;
  let metricsDisabled = null;
  let targetsAfterClose = null;
  let progression = null;
  let tabActivationReceipt = null;
  let measurementStartedAt = null;
  let measurementFinishedAt = null;
  const contentRuntimeSettlementLedger = createContentRuntimeSettlementLedger();
  const buildIdentity = createScenarioBuildIdentity(artifact);
  const collectScenarioContentRuntime = async (checkpoint) => {
    if (!page) return null;
    const diagnostics = await collectContentRuntimeDiagnostics(harness, page);
    return contentRuntimeSettlementLedger.add(checkpoint, diagnostics);
  };
  const collectScenarioContentRuntimeBestEffort = async (checkpoint) => {
    try {
      return await collectScenarioContentRuntime(checkpoint);
    } catch (error) {
      pageErrors.push(createSafeRuntimeError(error, `content_runtime_${checkpoint}`));
      return null;
    }
  };
  const createScenarioContentRuntimeConfiguration = (extra = {}) => ({
    ...extra,
    contentRuntimeSettlementEvidence: contentRuntimeSettlementLedger.snapshot(),
  });
  const diagnosticInstrumentation = isRuntimeDebuggerInstrumentationEnabled({
    lane,
    measurementProfile: options.measurementProfile,
  });
  try {
    const artifactDisclosure = analyzeScenarioArtifactDisclosure(
      scenario,
      laneProgression?.snapshot,
    );
    progression = {
      state: artifactDisclosure.state,
      reason: artifactDisclosure.reason,
      preparationMode: laneProgression?.mode || 'unavailable',
      requestedDay: laneProgression?.requestedDay ?? null,
      firstVision: laneProgression?.firstVision || null,
      requiredFamilyIds: artifactDisclosure.requiredFamilyIds,
      eligibleFamilyIds: artifactDisclosure.eligibleFamilyIds,
      lockedFamilyIds: artifactDisclosure.lockedFamilyIds,
      byFeature: artifactDisclosure.byFeature,
      unlockProgress: laneProgression?.snapshot?.unlockProgress
        ? {
          source: laneProgression.snapshot.unlockProgress.source,
          canonicalQualifiedUseDayCount:
            laneProgression.snapshot.unlockProgress.canonicalQualifiedUseDayCount,
          qualifiedUseDayCount: laneProgression.snapshot.unlockProgress.qualifiedUseDayCount,
          debugOverrideActive: laneProgression.snapshot.unlockProgress.debugOverrideActive,
          effectiveFamilyIds: laneProgression.snapshot.unlockProgress.effectiveFamilyIds,
        }
        : null,
    };
    if (artifactDisclosure.state !== 'measured') {
      return collectBlockedRun({
        scenario,
        lane,
        repeatIndex,
        options,
        blocker: {
          classification: 'inconclusive',
          reason: artifactDisclosure.reason || 'artifact_disclosure_snapshot_unavailable',
          requiredFamilyIds: artifactDisclosure.requiredFamilyIds,
          lockedFamilyIds: artifactDisclosure.lockedFamilyIds,
          takeoverCheckpoint: false,
        },
        browser: harness.browserVersion?.Browser || null,
        progression,
        build: buildIdentity,
      });
    }
    const enabledSettings = createScenarioSettingsPayload(scenario, true);
    const disabledSettings = createScenarioSettingsPayload(scenario, false);
    const privacyMode = scenario.auth.mode === 'qa_profile_required' ? 'login' : 'public';
    extensionCollector = await createExtensionRuntimeCollector(harness, { privacyMode });
    extensionErrorCursor = await extensionCollector.createErrorCursor();
    const initialConfiguration = await configureScenario(harness, scenario, enabledSettings);
    const initialConfigurationState = await waitForScenarioConfigurationState(
      harness,
      scenario,
      { enabled: true },
    );
    storageBefore = await collectStorageSummary(harness);

    page = await harness.openPage(scenario.urls.primary, { active: true, timeoutMs: 45_000 });
    pageCollector = await createPageRuntimeCollector(harness, page, {
      privacyMode,
    });
    // Install the isolated-world long-task observer before the measured document.
    await harness.reloadPage(page, { ignoreCache: false, timeoutMs: 45_000 });
    tabActivationReceipt = await activateScenarioTab(harness, page, { lane });

    let lifecycleResults = [];
    let readiness = await waitForScenarioReadiness(harness, page, scenario, {
      timeoutMs: 30_000,
    });
    const lastDocumentResponse = pageCollector.snapshot().documentResponses?.at(-1) || null;
    const responseBlocker = classifyDocumentResponseBlocker(lastDocumentResponse);
    if (!readiness.ready || responseBlocker) {
      const blockedContentRuntime = await collectScenarioContentRuntimeBestEffort(
        'readiness_blocked_final',
      );
      const blockedRuntimeCollection = pageCollector.snapshot();
      const after = await collectPageMetrics(harness, page, {
        label: 'blocked',
        longTasks: blockedRuntimeCollection.longTasks,
        longTaskMeasurement: blockedRuntimeCollection.longTaskMeasurement,
        scenario,
      });
      return collectBlockedRun({
        scenario,
        lane,
        repeatIndex,
        options,
        blocker: responseBlocker || readiness.blocker,
        browser: harness.browserVersion?.Browser || null,
        progression,
        configuration: createScenarioContentRuntimeConfiguration({
          contentRuntimeFinal: blockedContentRuntime,
        }),
        build: buildIdentity,
        errors: [
          ...blockedRuntimeCollection.errors,
          ...extensionCollector.snapshot().errors,
          ...(after ? [] : [{ phase: 'metrics', message: 'unavailable' }]),
        ],
      });
    }

    await activateScenarioTab(harness, page, { lane });
    await sleep(500);
    const configurationEvidence = await collectScenarioConfigurationEvidence(harness, scenario);
    const trackingBeforeActivation = await collectTrackingRuntimeEvidence(harness, page);
    const runtimeBeforeActivation = await collectProtectionRuntimeEvidence(
      harness,
      scenario,
      { refresh: true },
    );
    const activationAttempts = [];
    let initialActivation = await waitForInitialObservableActivation(
      harness,
      page,
      scenario,
      { lane, timeoutMs: 45_000 },
    );
    activationAttempts.push({ phase: 'natural', ...initialActivation });
    let runtimeAfterActivationWait = runtimeBeforeActivation;
    if (initialActivation.state !== 'measured') {
      runtimeAfterActivationWait = await collectProtectionRuntimeEvidence(
        harness,
        scenario,
        { refresh: true },
      );
      await configureScenario(harness, scenario, disabledSettings);
      await activateScenarioTab(harness, page, { lane });
      await sleep(500);
      await configureScenario(harness, scenario, enabledSettings);
      await activateScenarioTab(harness, page, { lane });
      await harness.reloadPage(page, { ignoreCache: false, timeoutMs: 45_000 });
      await activateScenarioTab(harness, page, { lane });
      const reconciled = await waitForInitialObservableActivation(
        harness,
        page,
        scenario,
        { lane, timeoutMs: 12_000 },
      );
      activationAttempts.push({ phase: 'settings_reconcile', ...reconciled });
      if (reconciled.state === 'measured') initialActivation = reconciled;
    }
    runtimeAfterActivationWait = await collectProtectionRuntimeEvidence(
      harness,
      scenario,
      { refresh: true },
    );
    const trackingAfterActivationWait = await collectTrackingRuntimeEvidence(harness, page);
    const contentRuntimeDiagnostics = await collectScenarioContentRuntime('initial');

    const measurementActions = actionsForLane(
      scenario,
      lane,
      (action) => !RUNNER_OWNED_ACTIONS.has(action.kind),
    );
    const lifecycleActions = measurementActions.filter((action) => (
      LIFECYCLE_ACTIONS.has(action.kind)
    ));
    const stimulusActions = measurementActions.filter((action) => (
      !LIFECYCLE_ACTIONS.has(action.kind)
    ));
    let diagnosticSnapshotResponse = null;
    let diagnosticReportResponse = null;
    let diagnosticStopResponse = null;
    let disabledDiagnosticResponse = null;
    let diagnosticActiveSettle = null;
    let disabledDiagnosticSettle = null;
    let diagnosticFinalSettle = null;
    let diagnosticLifecycleSegments = [];
    const measurementPrelude = await runScenarioMeasurementPrelude({
      lane: diagnosticInstrumentation ? 'diagnostic' : 'release',
      startDiagnosticSession: () => startDiagnosticSessionAfterDocumentBoundary(
        harness,
        page,
        'live',
        {
          onContentRuntimeDiagnostics: (diagnostics) => {
            contentRuntimeSettlementLedger.add('diagnostic_start_poll', diagnostics);
          },
        },
      ),
      resetDiagnosticSession: () => sendRuntimeDebuggerAutomationAction(
        harness,
        page,
        RUNTIME_DEBUGGER_AUTOMATION_ACTIONS.RESET,
      ),
      onDiagnosticStarted: () => {
        debuggerStarted = true;
      },
      settleDiagnosticSession: () => settleDiagnosticSessionBeforeBaseline(harness, page),
      collectBaseline: async () => {
        pageCollector.clearLongTasks();
        pageCollector.clearLongAnimationFrames();
        const baselineRuntimeCollection = pageCollector.snapshot();
        const baseline = await collectPageMetrics(harness, page, {
          label: 'before-stimulus',
          longTasks: [],
          longTaskMeasurement: baselineRuntimeCollection.longTaskMeasurement,
          scenario,
        });
        measurementStartedAt = Date.now();
        return baseline;
      },
      runMeasurementActions: async () => {
        const measurement = await runDiagnosticAwareLifecycleActions({
          lane: diagnosticInstrumentation ? 'diagnostic' : 'release',
          actions: measurementActions,
          runAction: async (action) => {
            const result = await runScenarioActions(
              harness,
              page,
              scenario,
              [action],
              {
                collectFeedOracle: diagnosticInstrumentation,
                collectRuntimeCost: options.measurementProfile === 'contention',
                collectRuntimeContention: diagnosticInstrumentation
                  && options.measurementProfile === 'contention',
                projectCausalWindow: pageCollector.projectCausalWindow,
              },
            );
            if (LIFECYCLE_ACTIONS.has(action.kind)) {
              await waitForScenarioReadiness(harness, page, scenario, {
                timeoutMs: 30_000,
              });
              pageCollector.clearLongAnimationFrames();
            }
            return result;
          },
          stopDiagnosticSession: () => sendRuntimeDebuggerAutomationAction(
            harness,
            page,
            RUNTIME_DEBUGGER_AUTOMATION_ACTIONS.STOP,
          ),
          settleDiagnosticSessionBeforeStop: () => (
            settleDiagnosticSessionForCapture(harness, page)
          ),
          startDiagnosticSession: (captureKind) => (
            startDiagnosticSessionAfterDocumentBoundary(harness, page, captureKind, {
              onContentRuntimeDiagnostics: (diagnostics) => {
                contentRuntimeSettlementLedger.add('diagnostic_restart_poll', diagnostics);
              },
            })
          ),
          settleDiagnosticSession: () => settleDiagnosticSessionBeforeBaseline(harness, page),
          resetDiagnosticSession: () => sendRuntimeDebuggerAutomationAction(
            harness,
            page,
            RUNTIME_DEBUGGER_AUTOMATION_ACTIONS.RESET,
          ),
          onDiagnosticStopped: () => {
            debuggerStarted = false;
          },
          onDiagnosticStarted: () => {
            debuggerStarted = true;
          },
        });
        diagnosticLifecycleSegments = measurement.completedSegments;
        return measurement.results;
      },
    });
    metricsBefore = measurementPrelude.baseline;
    lifecycleResults = measurementPrelude.actionResults.filter((result) => (
      LIFECYCLE_ACTIONS.has(result.kind)
    ));
    const stimulusResults = measurementPrelude.actionResults.filter((result) => (
      !LIFECYCLE_ACTIONS.has(result.kind)
    ));
    readiness = await waitForScenarioReadiness(harness, page, scenario, {
      timeoutMs: 30_000,
    });
    if (!readiness.ready) {
      const blockedContentRuntime = await collectScenarioContentRuntimeBestEffort(
        'post_lifecycle_blocked_final',
      );
      return collectBlockedRun({
        scenario,
        lane,
        repeatIndex,
        options,
        blocker: readiness.blocker,
        browser: harness.browserVersion?.Browser || null,
        progression,
        configuration: createScenarioContentRuntimeConfiguration({
          contentRuntime: contentRuntimeDiagnostics,
          contentRuntimeFinal: blockedContentRuntime,
        }),
        build: buildIdentity,
        errors: [
          ...pageCollector.snapshot().errors,
          ...extensionCollector.snapshot().errors,
        ],
      });
    }
    await activateScenarioTab(harness, page, { lane });
    const postLifecycleActivation = await waitForInitialObservableActivation(
      harness,
      page,
      scenario,
      { lane, timeoutMs: 8_000 },
    );

    await sleep(options.settleMs);

    if (diagnosticInstrumentation) {
      diagnosticActiveSettle = await waitForFinalDebuggerSettle({
        lane,
        readSnapshot: () => sendRuntimeDebuggerAutomationAction(
          harness,
          page,
          RUNTIME_DEBUGGER_AUTOMATION_ACTIONS.SNAPSHOT,
        ),
        analyzeCostEvidence: (phasePayload) => extractDebuggerPhaseCostEvidence({
          phase: SITE_E2E_DEBUGGER_COST_PHASES.ACTIVE_STIMULUS,
          endPayload: phasePayload,
        }),
        timeoutMs: Math.max(FINAL_DEBUGGER_SETTLE_TIMEOUT_MS, options.settleMs),
      });
      diagnosticSnapshotResponse = diagnosticActiveSettle.lastResponse;
      if (needsLazyBaselineReset(getBridgePayload(diagnosticSnapshotResponse))) {
        await sendRuntimeDebuggerAutomationAction(
          harness,
          page,
          RUNTIME_DEBUGGER_AUTOMATION_ACTIONS.RESET,
        );
        const boundedScroll = findLastScenarioAction(stimulusActions, 'scroll');
        if (boundedScroll) {
          await runScenarioActions(harness, page, scenario, [{
            ...boundedScroll,
            maximumSteps: Math.min(2, Number(boundedScroll.maximumSteps) || 2),
          }]);
        }
        await sleep(options.settleMs);
        diagnosticActiveSettle = await waitForFinalDebuggerSettle({
          lane,
          readSnapshot: () => sendRuntimeDebuggerAutomationAction(
            harness,
            page,
            RUNTIME_DEBUGGER_AUTOMATION_ACTIONS.SNAPSHOT,
          ),
          analyzeCostEvidence: (phasePayload) => extractDebuggerPhaseCostEvidence({
            phase: SITE_E2E_DEBUGGER_COST_PHASES.ACTIVE_STIMULUS,
            endPayload: phasePayload,
          }),
          timeoutMs: Math.max(FINAL_DEBUGGER_SETTLE_TIMEOUT_MS, options.settleMs),
        });
        diagnosticSnapshotResponse = diagnosticActiveSettle.lastResponse;
      }
    }

    const activeObservation = await collectSettledScenarioObservation(
      harness,
      page,
      scenario,
      lane,
    );
    const contentRuntimeBeforeDisable = await collectScenarioContentRuntime('before_disable');
    if (diagnosticInstrumentation) {
      diagnosticActiveSettle = await waitForFinalDebuggerSettle({
        lane,
        readSnapshot: () => sendRuntimeDebuggerAutomationAction(
          harness,
          page,
          RUNTIME_DEBUGGER_AUTOMATION_ACTIONS.SNAPSHOT,
        ),
        analyzeCostEvidence: (phasePayload) => extractDebuggerPhaseCostEvidence({
          phase: SITE_E2E_DEBUGGER_COST_PHASES.ACTIVE_STIMULUS,
          endPayload: phasePayload,
        }),
        timeoutMs: Math.max(FINAL_DEBUGGER_SETTLE_TIMEOUT_MS, options.settleMs),
      });
      diagnosticSnapshotResponse = diagnosticActiveSettle.lastResponse;
    }
    const disableDispatchCursor = getContentRuntimeEventCursor(contentRuntimeBeforeDisable);
    const disabledConfiguration = await configureScenario(
      harness,
      scenario,
      disabledSettings,
    );
    const disabledConfigurationState = await waitForScenarioConfigurationState(
      harness,
      scenario,
      { enabled: false },
    );
    const disabledPropagation = await waitForScenarioSettingsPropagation(
      harness,
      page,
      {
        receipt: disabledConfiguration.settings.propagation,
        afterEventId: disableDispatchCursor,
        timeoutMs: Math.max(10_000, options.settleMs),
      },
    );
    await activateScenarioTab(harness, page, { lane });
    await collectProtectionRuntimeEvidence(harness, scenario, { refresh: true });
    const disabledCleanup = await waitForDisabledScenarioCleanup(
      harness,
      page,
      scenario,
      { timeoutMs: Math.max(10_000, options.settleMs) },
    );
    const disabledObservation = disabledCleanup.observation;
    const contentRuntimeAfterDisable = await collectScenarioContentRuntime('after_disable');
    const disabledRuntimeCollection = pageCollector.snapshot();
    metricsDisabled = await collectPageMetrics(harness, page, {
      label: 'after-disable',
      longTasks: [],
      longTaskMeasurement: disabledRuntimeCollection.longTaskMeasurement,
      scenario,
    });
    if (diagnosticInstrumentation) {
      const activePhasePayload = getBridgePayload(diagnosticSnapshotResponse);
      disabledDiagnosticSettle = await waitForFinalDebuggerSettle({
        lane,
        readSnapshot: () => sendRuntimeDebuggerAutomationAction(
          harness,
          page,
          RUNTIME_DEBUGGER_AUTOMATION_ACTIONS.SNAPSHOT,
        ),
        analyzeCostEvidence: (phasePayload) => extractDebuggerPhaseCostEvidence({
          phase: SITE_E2E_DEBUGGER_COST_PHASES.DISABLE_CLEANUP,
          startPayload: activePhasePayload,
          endPayload: phasePayload,
          requireSocialMetricsTransition: Boolean(
            scenario.expectedActivation?.socialMetrics,
          ),
        }),
        timeoutMs: Math.max(FINAL_DEBUGGER_SETTLE_TIMEOUT_MS, options.settleMs),
      });
      disabledDiagnosticResponse = disabledDiagnosticSettle.lastResponse;
    }

    const reenabledConfiguration = await configureScenario(
      harness,
      scenario,
      enabledSettings,
    );
    const reenabledConfigurationState = await waitForScenarioConfigurationState(
      harness,
      scenario,
      { enabled: true },
    );
    await activateScenarioTab(harness, page, { lane });
    const boundedScroll = findLastScenarioAction(stimulusActions, 'scroll');
    if (boundedScroll) {
      await runScenarioActions(harness, page, scenario, [{
        ...boundedScroll,
        maximumSteps: Math.min(2, Number(boundedScroll.maximumSteps) || 2),
      }]);
    }
    const reenabledActivation = await waitForInitialObservableActivation(
      harness,
      page,
      scenario,
      { lane, timeoutMs: Math.max(10_000, options.settleMs) },
    );
    const reenabledObservation = reenabledActivation.observation
      || await readScenarioPageState(harness, page, scenario);
    const contentRuntimeAfterReenable = await collectScenarioContentRuntime('after_reenable');

    if (diagnosticInstrumentation) {
      const disabledPhasePayload = getBridgePayload(disabledDiagnosticResponse);
      diagnosticFinalSettle = await waitForFinalDebuggerSettle({
        lane,
        scenario,
        readSnapshot: () => sendRuntimeDebuggerAutomationAction(
          harness,
          page,
          RUNTIME_DEBUGGER_AUTOMATION_ACTIONS.SNAPSHOT,
        ),
        analyzeCostEvidence: (phasePayload) => extractDebuggerPhaseCostEvidence({
          phase: SITE_E2E_DEBUGGER_COST_PHASES.REENABLE_STIMULUS,
          startPayload: disabledPhasePayload,
          endPayload: phasePayload,
          requireSocialMetricsTransition: Boolean(
            scenario.expectedActivation?.socialMetrics,
          ),
        }),
        timeoutMs: Math.max(FINAL_DEBUGGER_SETTLE_TIMEOUT_MS, options.settleMs),
      });
      diagnosticReportResponse = await sendRuntimeDebuggerAutomationAction(
        harness,
        page,
        RUNTIME_DEBUGGER_AUTOMATION_ACTIONS.REPORT,
      );
      diagnosticStopResponse = await sendRuntimeDebuggerAutomationAction(
        harness,
        page,
        RUNTIME_DEBUGGER_AUTOMATION_ACTIONS.STOP,
      );
      debuggerStarted = false;
    }

    const runtimeCollection = pageCollector.snapshot();
    const metricsAfter = await collectPageMetrics(harness, page, {
      label: 'after-stimulus',
      longTasks: runtimeCollection.longTasks,
      longTaskMeasurement: runtimeCollection.longTaskMeasurement,
      scenario,
    });
    measurementFinishedAt = Date.now();
    const storageAfter = await collectStorageSummary(harness);
    const storageGrowth = diffStorageSnapshots(storageBefore, storageAfter);

    // Release-lane strategy snapshots are not revision/dispatch-correlated with
    // the page observation. Keep initial latency as its own conservative state;
    // the independent active/disabled/reenabled DOM observations own effect
    // acceptance below.
    const effectActivationState = initialActivation.state;
    const effect = analyzeObservableEffect({
      activeObservation,
      disabledObservation,
      reenabledObservation,
      activationState: effectActivationState,
      disablePropagation: disabledPropagation,
    });
    const contracts = [
      ...createNavigationContracts(lifecycleResults),
      ...createReadinessConditionContracts(scenario, lane, {
        readinessObservation: readiness.state,
        activeObservation,
      }),
      ...effect.contracts,
      ...createRootVisualContinuityContracts(stimulusResults),
      ...createVisualMediaMembershipContracts(stimulusResults),
      ...createObservableConditionContracts({
        scenario,
        lane,
        effect,
        activeObservation,
        disabledObservation,
        lifecycleResults,
        stimulusResults,
      }),
      {
        id: 'scenario_tab_activation_proof',
        status: 'PASS',
        evidence: {
          lane: tabActivationReceipt.lane,
          proofKind: tabActivationReceipt.proofKind,
          active: tabActivationReceipt.active,
          activeTabObserved: lane === 'release'
            ? tabActivationReceipt.activeTabObserved
            : null,
          trackingObserved: lane === 'diagnostic'
            ? tabActivationReceipt.trackingObserved
            : null,
          windowFocusRequested: tabActivationReceipt.windowFocusRequested,
        },
      },
      {
        id: 'scenario_settings_readback',
        status: (
          configurationEvidence.targetBlocked === true
          && configurationEvidence.filteringMode === 'blocklist'
          && configurationEvidence.permissionMode === 'selective'
          && configurationEvidence.rulesMode === 'managed'
          && configurationEvidence.dataCollectionMode === 'protected_sites'
          && configurationEvidence.insightsConsent === 'protected_only'
        ) ? 'PASS' : 'FAIL',
        evidence: configurationEvidence,
      },
      {
        id: 'initial_settings_activation_readback',
        status: initialConfigurationState.state === 'measured' ? 'PASS' : 'FAIL',
        evidence: initialConfigurationState,
      },
      {
        id: 'disable_settings_readback',
        status: disabledConfigurationState.state === 'measured' ? 'PASS' : 'FAIL',
        evidence: disabledConfigurationState,
      },
      {
        id: 'user_settings_disable_propagation_completed',
        status: ['measured', 'not_required'].includes(disabledPropagation.state)
          ? 'PASS'
          : disabledPropagation.state === 'broken' ? 'FAIL' : 'WARN',
        evidence: disabledPropagation,
      },
      {
        id: 'reenable_settings_readback',
        status: reenabledConfigurationState.state === 'measured' ? 'PASS' : 'FAIL',
        evidence: reenabledConfigurationState,
      },
      {
        id: 'content_runtime_session_ready',
        status: ['receiver_ready', 'active'].includes(
          contentRuntimeDiagnostics.currentSession?.status,
        ) ? 'PASS' : 'FAIL',
        evidence: {
          availability: contentRuntimeDiagnostics.availability,
          status: contentRuntimeDiagnostics.currentSession?.status || null,
          documentId: contentRuntimeDiagnostics.currentSession?.documentId || null,
        },
      },
      {
        id: 'lifecycle_reactivation_observable',
        status: postLifecycleActivation.state === 'measured'
          ? 'PASS'
          : effectActivationState === 'broken' ? 'FAIL' : 'WARN',
        evidence: {
          state: postLifecycleActivation.state,
          waitedMs: postLifecycleActivation.waitedMs,
        },
      },
      {
        id: 'initial_activation_observable',
        status: initialActivation.state === 'measured'
          ? 'PASS'
          : effectActivationState === 'broken' ? 'FAIL' : 'WARN',
        evidence: {
          state: effectActivationState,
          waitedMs: activationAttempts.reduce(
            (total, attempt) => total + (Number(attempt.waitedMs) || 0),
            0,
          ),
          runtimeBefore: runtimeBeforeActivation,
          runtimeAfterWait: runtimeAfterActivationWait,
          trackingBefore: trackingBeforeActivation,
          trackingAfterWait: trackingAfterActivationWait,
        },
      },
    ];

    let activation;
    let debuggerEvidence = {
      availability: diagnosticInstrumentation ? 'unavailable' : 'not_requested',
      validity: {},
      overhead: {},
    };
    if (diagnosticInstrumentation) {
      activation = analyzeDiagnosticActivation({
        response: diagnosticReportResponse,
        expectedActiveFilterKeys: scenario.expectedActivation.activeFilterKeys,
        expectedSocial: scenario.expectedActivation.socialMetrics,
      });
      contracts.push(...activation.contracts);
      const disabledPayload = getBridgePayload(disabledDiagnosticResponse);
      const disabledRuntime = extractDiagnosticProtectionRuntime(disabledPayload);
      const disabledActivation = analyzeUserSettingsDisableActivation(disabledRuntime, {
        propagation: disabledPropagation,
      });
      contracts.push({
        id: 'user_settings_disable_sources_inactive',
        status: disabledActivation.state === 'measured'
          ? 'PASS'
          : disabledActivation.state === 'broken' ? 'FAIL' : 'WARN',
        evidence: disabledActivation,
      });
      const payload = activation.payload;
      activation = { ...activation, payload: undefined };
      const reportCostEvidence = extractDebuggerCostEvidence(payload);
      const primaryPayload = diagnosticFinalSettle?.lastPayload || null;
      const activePhasePayload = getBridgePayload(diagnosticSnapshotResponse);
      const disabledPhasePayload = getBridgePayload(disabledDiagnosticResponse);
      const requiredTargetingHealthProbeIds = resolveRequiredTargetingHealthProbeIds(
        scenario,
      );
      contracts.push(...projectTargetingHealthAcceptanceContracts({
        scopeId: 'active_stimulus',
        mode: SITE_E2E_TARGETING_HEALTH_ACCEPTANCE_MODES.ACTIVE,
        payload: activePhasePayload,
        requiredProbeIds: requiredTargetingHealthProbeIds,
      }));
      contracts.push(...projectTargetingHealthAcceptanceContracts({
        scopeId: 'disabled_cleanup',
        mode: SITE_E2E_TARGETING_HEALTH_ACCEPTANCE_MODES.DISABLED,
        payload: disabledPhasePayload,
        requiredProbeIds: requiredTargetingHealthProbeIds,
      }));
      contracts.push(...projectTargetingHealthAcceptanceContracts({
        scopeId: 'reenable_final',
        mode: SITE_E2E_TARGETING_HEALTH_ACCEPTANCE_MODES.ACTIVE,
        payload: primaryPayload,
        requiredProbeIds: requiredTargetingHealthProbeIds,
      }));
      const phaseCostEvidence = {
        scope: 'current_document_session',
        identityPolicy: 'cross_phase_identity_cardinality_is_insufficient',
        activeStimulus: diagnosticActiveSettle?.costEvidence || (
          activePhasePayload
            ? extractDebuggerPhaseCostEvidence({
              phase: SITE_E2E_DEBUGGER_COST_PHASES.ACTIVE_STIMULUS,
              endPayload: activePhasePayload,
            })
            : null
        ),
        disableCleanup: disabledDiagnosticSettle?.costEvidence || (
          activePhasePayload && disabledPhasePayload
            ? extractDebuggerPhaseCostEvidence({
              phase: SITE_E2E_DEBUGGER_COST_PHASES.DISABLE_CLEANUP,
              startPayload: activePhasePayload,
              endPayload: disabledPhasePayload,
              requireSocialMetricsTransition: Boolean(
                scenario.expectedActivation?.socialMetrics,
              ),
            })
            : null
        ),
        reenableStimulus: disabledPhasePayload && primaryPayload
          ? extractDebuggerPhaseCostEvidence({
            phase: SITE_E2E_DEBUGGER_COST_PHASES.REENABLE_STIMULUS,
            startPayload: disabledPhasePayload,
            endPayload: primaryPayload,
            requireSocialMetricsTransition: Boolean(
              scenario.expectedActivation?.socialMetrics,
            ),
          })
          : null,
      };
      const lifecyclePayloads = diagnosticLifecycleSegments.map(
        getDiagnosticLifecycleSettlePayload,
      );
      const shortFormCompleteness = aggregateShortFormCompletenessEvidence([
        ...lifecyclePayloads.map(extractShortFormCompletenessEvidence),
        extractShortFormCompletenessEvidence(primaryPayload),
      ]);
      contracts.push(...createDiagnosticConditionContracts(scenario, payload, {
        activePayload: activePhasePayload || payload,
        settlePayload: primaryPayload || payload,
        shortFormCompleteness,
        feedJourneyPayload: activePhasePayload || payload,
        actionResults: stimulusResults,
        eventPayloads: [
          ...lifecyclePayloads,
          primaryPayload,
          payload,
        ],
      }));
      const costEvidence = extractDebuggerCostEvidence(primaryPayload);
      if (scenario.expectedActivation?.socialMetrics) {
        (costEvidence?.scannerStructuralAudit?.checks || []).forEach((check) => {
          contracts.push({
            id: check.id,
            status: check.status,
            evidence: check,
            note: check.status === 'WARN'
              ? 'The structural counter was not measured; a zero value is not treated as proof.'
              : null,
          });
        });
        (costEvidence?.scannerConservationAudit?.checks || []).forEach((check) => {
          contracts.push({
            id: check.id,
            status: check.status,
            evidence: check,
            note: check.status === 'WARN'
              ? 'The scanner work ledger was not measured; conservation is not inferred from zero.'
              : null,
          });
        });
        Object.entries({
          active_stimulus: phaseCostEvidence.activeStimulus,
          disable_cleanup: phaseCostEvidence.disableCleanup,
          reenable_stimulus: phaseCostEvidence.reenableStimulus,
        }).forEach(([phaseId, evidence]) => {
          const phaseSettle = evidence?.measurementStates?.efficiency || null;
          contracts.push({
            id: `debugger_phase_${phaseId}_settled`,
            status: phaseSettle?.settled === true
              ? 'PASS'
              : phaseSettle?.settled === false || phaseSettle?.state === 'broken'
                ? 'FAIL'
                : 'WARN',
            evidence: phaseSettle,
          });
          contracts.push({
            id: `debugger_phase_${phaseId}_work_ledger`,
            status: evidence?.workLedger?.state === 'broken'
              ? 'FAIL'
              : evidence?.workLedger?.state === 'measured'
                ? 'PASS'
                : 'WARN',
            evidence: evidence?.workLedger || null,
            note: (
              evidence?.workLedger?.partialMeasurements || []
            ).includes('identity_cardinality')
              ? 'Phase-local exact-node identity cardinality is intentionally not inferred across the shared measurement epoch.'
              : null,
          });
          (evidence?.scannerConservationAudit?.checks || []).forEach((check) => {
            contracts.push({
              id: `debugger_phase_${phaseId}:${check.id}`,
              status: check.status,
              evidence: check,
            });
          });
        });
      }
      const stopPayload = getBridgePayload(diagnosticStopResponse);
      const stopCostEvidence = extractDebuggerCostEvidence(stopPayload);
      const postMeasurementOverhead = {
        report: diffDebuggerOverhead(
          reportCostEvidence.overhead,
          costEvidence?.overhead,
        ),
        stop: diffDebuggerOverhead(
          stopCostEvidence.overhead,
          reportCostEvidence.overhead,
        ),
        total: diffDebuggerOverhead(
          stopCostEvidence.overhead,
          costEvidence?.overhead,
        ),
      };
      const lifecycleSegments = diagnosticLifecycleSegments.map((segment) => {
        const segmentPayload = getDiagnosticLifecycleSettlePayload(segment);
        const segmentCostEvidence = extractDebuggerCostEvidence(segmentPayload);
        return {
          actionIndex: segment.actionIndex,
          endedBeforeAction: segment.endedBeforeAction,
          finalSettle: createDebuggerSettleReportEvidence(segment.finalSettle),
          validity: analyzeDebuggerValidity(segmentPayload),
          overhead: segmentCostEvidence.overhead,
          costEvidence: segmentCostEvidence,
          shortFormCompleteness: extractShortFormCompletenessEvidence(segmentPayload),
        };
      });
      lifecycleSegments.forEach((segment, index) => {
        const segmentNumber = index + 1;
        contracts.push(...projectTargetingHealthAcceptanceContracts({
          scopeId: `lifecycle_segment_${segmentNumber}`,
          mode: SITE_E2E_TARGETING_HEALTH_ACCEPTANCE_MODES.ACTIVE,
          payload: getDiagnosticLifecycleSettlePayload(
            diagnosticLifecycleSegments[index],
          ),
          requiredProbeIds: requiredTargetingHealthProbeIds,
        }));
        contracts.push({
          id: `debugger_lifecycle_segment_settled:${segmentNumber}`,
          status: segment.finalSettle?.settled === true ? 'PASS' : 'FAIL',
          evidence: {
            segmentNumber,
            actionIndex: segment.actionIndex,
            endedBeforeAction: segment.endedBeforeAction,
            finalSettle: segment.finalSettle,
          },
        });
        if (scenario.expectedActivation?.socialMetrics) {
          (segment.costEvidence?.scannerStructuralAudit?.checks || []).forEach((check) => {
            contracts.push({
              id: `debugger_lifecycle_segment_${segmentNumber}:${check.id}`,
              status: check.status,
              evidence: {
                segmentNumber,
                actionIndex: segment.actionIndex,
                endedBeforeAction: segment.endedBeforeAction,
                check,
              },
              note: check.status === 'WARN'
                ? 'The structural counter was not measured in this document session; zero is not treated as proof.'
                : null,
            });
          });
          (segment.costEvidence?.scannerConservationAudit?.checks || []).forEach((check) => {
            contracts.push({
              id: `debugger_lifecycle_segment_${segmentNumber}:${check.id}`,
              status: check.status,
              evidence: {
                segmentNumber,
                actionIndex: segment.actionIndex,
                endedBeforeAction: segment.endedBeforeAction,
                check,
              },
            });
          });
        }
      });
      contracts.push({
        id: 'debugger_lifecycle_segments_available',
        status: lifecycleSegments.length === lifecycleActions.length ? 'PASS' : 'WARN',
        evidence: {
          expected: lifecycleActions.length,
          captured: lifecycleSegments.length,
          documentSessionRestarts: lifecycleActions.length,
        },
      });
      const queuesSettled = pendingQueuesSettled(costEvidence);
      contracts.push({
        id: 'debugger_pending_queues_settled',
        status: queuesSettled === true ? 'PASS' : (queuesSettled === null ? 'WARN' : 'FAIL'),
        evidence: {
          pending: costEvidence?.pending || null,
          polling: createDebuggerSettleReportEvidence(diagnosticFinalSettle),
          reportPending: reportCostEvidence.pending,
        },
      });
      const ownedMutationIntegrity = costEvidence?.ownedMutationIntegrity || null;
      if (ownedMutationIntegrity?.state !== 'inactive') {
        contracts.push({
          id: 'owned_mutation_fail_open_events',
          status: ownedMutationIntegrity?.state === 'measured'
            ? (ownedMutationIntegrity.clean ? 'PASS' : 'WARN')
            : 'WARN',
          evidence: ownedMutationIntegrity,
          note: ownedMutationIntegrity?.clean === false
            ? 'Pending self-write ownership settled by fail-open expiry or invalidation; scanner work remains measurable but is not a clean suppression result.'
            : null,
        });
      }
      debuggerEvidence = {
        availability: 'measured',
        validity: analyzeDebuggerValidity(primaryPayload),
        overhead: costEvidence?.overhead || {},
        costEvidence,
        phaseCostEvidence,
        shortFormCompleteness,
        provenance: {
          primaryCostPayload: 'final_settle_snapshot',
          reportPayload: 'post_measurement_report',
          stopPayload: 'post_measurement_stop',
        },
        postMeasurementOverhead,
        finalSettle: createDebuggerSettleReportEvidence(diagnosticFinalSettle),
        settleTrajectories: {
          activeStimulus: createDebuggerSettleReportEvidence(diagnosticActiveSettle),
          disableCleanup: createDebuggerSettleReportEvidence(disabledDiagnosticSettle),
          reenableStimulus: createDebuggerSettleReportEvidence(diagnosticFinalSettle),
        },
        lifecycleSegments,
        payload: primaryPayload,
        reportPayload: payload,
        stopPayload,
        reportMarkdown: getBridgeMarkdown(diagnosticReportResponse),
        stopMarkdown: getBridgeMarkdown(diagnosticStopResponse),
      };
    } else {
      activation = {
        state: effect.status,
        activeFilterKeys: null,
        activeFilterKeysState: 'runtime_debugger_not_requested',
        expectedActiveFilterKeys: scenario.expectedActivation.activeFilterKeys,
        social: null,
      };
    }

    const contentRuntimeBeforeErrorRefresh = await collectScenarioContentRuntime(
      'before_extension_error_refresh',
    );
    const extensionRuntimeCollection = await extensionCollector.refreshAfterErrorCursor(
      extensionErrorCursor,
    );
    const contentRuntimeFinal = await collectScenarioContentRuntime(
      'after_extension_error_refresh',
    );
    const extensionCollectorErrors = extensionRuntimeCollection.errors.filter(
      (entry) => entry.source === 'extension_service_worker_collector',
    );
    const extensionErrors = extensionRuntimeCollection.errors.filter(
      (entry) => entry.source !== 'extension_service_worker_collector',
    );
    const pageRuntimeErrors = runtimeCollection.errors.filter((entry) => (
      entry.source !== 'long_task_instrumentation'
      && entry.source !== 'long_animation_frame_instrumentation'
      && entry.source !== 'cdp_binding'
    ));
    contracts.push({
      id: 'long_task_instrumentation_available',
      status: ['armed_idle', 'measured'].includes(metricsAfter.longTasks.status)
        ? 'PASS'
        : 'WARN',
      evidence: metricsAfter.longTasks,
    });
    contracts.push({
      id: 'long_animation_frame_instrumentation_available',
      status: runtimeCollection.longAnimationFrameMeasurement?.state === 'measured'
        ? 'PASS'
        : 'WARN',
      evidence: runtimeCollection.longAnimationFrameMeasurement,
    });
    contracts.push({
      id: 'extension_service_worker_error_collection_available',
      status: extensionRuntimeCollection.availability === 'measured' ? 'PASS' : 'WARN',
      evidence: {
        availability: extensionRuntimeCollection.availability,
        reason: extensionRuntimeCollection.reason,
        restartCount: extensionRuntimeCollection.restartCount,
        reattachCount: extensionRuntimeCollection.reattachCount,
        coverageGapCount: extensionRuntimeCollection.coverageGapCount,
        attachFailureCount: extensionRuntimeCollection.attachFailureCount,
      },
    });
    if (extensionErrors.length > 0) {
      contracts.push({
        id: 'extension_uncaught_errors_absent',
        status: 'FAIL',
        evidence: { count: extensionErrors.length },
      });
    }
    contracts.push(...createPageRuntimeErrorContracts(pageRuntimeErrors, scenario.pageRuntimeErrorPolicy));

    await extensionCollector.dispose();
    extensionCollector = null;
    extensionErrorCursor = null;
    pageCollector.dispose();
    pageCollector = null;
    await harness.closePage(page);
    page = null;
    await sleep(1_500);
    targetsAfterClose = await collectTargetSnapshot(harness, scenario);
    const confirmedBudgets = evaluateConfirmedRuntimeBudgets({
      storageGrowth,
      targetsAfterClose,
    });
    contracts.push(...confirmedBudgets);

    const costs = {
      before: metricsBefore,
      disabled: metricsDisabled,
      after: metricsAfter,
      delta: diffCdpMetricSnapshots(metricsBefore, metricsAfter),
      measurementWindowMs: measurementStartedAt === null
        ? null
        : Math.max(0, (measurementFinishedAt || Date.now()) - measurementStartedAt),
      storage: storageGrowth,
      targetsAfterClose,
      collectors: {
        longTasks: {
          status: metricsAfter.longTasks.status,
          reason: metricsAfter.longTasks.reason,
          readyCount: metricsAfter.longTasks.readyCount,
          failureCount: metricsAfter.longTasks.failureCount,
        },
        longAnimationFrames: {
          status: runtimeCollection.longAnimationFrameMeasurement?.state || 'unavailable',
          reason: runtimeCollection.longAnimationFrameMeasurement?.reason || 'unavailable',
          readyCount: runtimeCollection.longAnimationFrameMeasurement?.readyCount ?? null,
          failureCount: runtimeCollection.longAnimationFrameMeasurement?.failureCount ?? null,
          observedEntryCount: runtimeCollection.longAnimationFrames?.length ?? null,
        },
        extensionServiceWorker: {
          availability: extensionRuntimeCollection.availability,
          reason: extensionRuntimeCollection.reason,
          workerTargetId: extensionRuntimeCollection.workerTargetId,
          workerTargetIds: extensionRuntimeCollection.workerTargetIds,
          restartCount: extensionRuntimeCollection.restartCount,
          reattachCount: extensionRuntimeCollection.reattachCount,
          coverageGapCount: extensionRuntimeCollection.coverageGapCount,
          attachFailureCount: extensionRuntimeCollection.attachFailureCount,
        },
      },
    };
    const performance = {
      status: 'unavailable',
      reason: 'repeat_group_pending',
      metrics: {
        heapGrowthBytes: costs.delta.jsHeapUsedBytes,
        domNodeGrowth: costs.delta.nodes,
        listenerGrowth: costs.delta.jsEventListeners,
        mutationObserverGrowth: costs.delta.objectCardinality?.mutationObservers ?? null,
        intersectionObserverGrowth: costs.delta.objectCardinality?.intersectionObservers ?? null,
        resizeObserverGrowth: costs.delta.objectCardinality?.resizeObservers ?? null,
        pageWorkerGrowth: costs.delta.objectCardinality?.workers ?? null,
        longTaskCount: costs.after.longTasks.count,
        longTaskTotalMs: costs.after.longTasks.totalMs,
        longTaskMaxMs: costs.after.longTasks.maxMs,
        localStorageGrowthBytes: costs.storage.localGrowthBytes,
      },
    };
    const runtimeAttribution = options.measurementProfile === 'contention'
      ? summarizeActionRuntimeAttribution(stimulusResults, {
        longAnimationFrames: runtimeCollection.longAnimationFrames,
        longAnimationFrameMeasurement: runtimeCollection.longAnimationFrameMeasurement,
      })
      : {
        schemaVersion: 1,
        state: 'not_requested',
        reason: 'contention_measurement_profile_required',
      };
    if (options.measurementProfile === 'contention') {
      contracts.push(createRuntimeActionAttributionContract(runtimeAttribution, {
        requireContention: diagnosticInstrumentation,
      }));
      if (diagnosticInstrumentation) {
        contracts.push({
          id: 'runtime_loaf_owner_correlation_measured',
          status: runtimeAttribution.responsiveness?.contentionState === 'measured'
            ? 'PASS'
            : ['partial', 'incomplete'].includes(
              runtimeAttribution.responsiveness?.contentionState,
            ) ? 'FAIL' : 'WARN',
          evidence: {
            state: runtimeAttribution.responsiveness?.contentionState || 'unavailable',
            ownerOverlappingFrameCount: runtimeAttribution.responsiveness
              ?.ownerOverlappingFrameCount ?? null,
            ownerStyleAndLayoutPhaseOverlappingFrameCount: runtimeAttribution
              .responsiveness?.ownerStyleAndLayoutPhaseOverlappingFrameCount ?? null,
            semantics: 'same_frame_temporal_overlap_not_causal_proof',
          },
        });
      }
    }

    const phaseBoundaryDrift = Object.values(
      debuggerEvidence.phaseCostEvidence || {},
    ).some((evidence) => evidence?.boundary?.classification === 'contract_drift');
    const actionBlocker = classifyRequiredScenarioActionBlocker(stimulusResults);
    const classification = phaseBoundaryDrift
      ? {
        outcome: SITE_RUN_OUTCOMES.INCONCLUSIVE,
        classification: 'contract_drift',
      }
      : classifySiteRun({
        blocker: actionBlocker,
        contracts,
        performanceStatus: 'PASS',
      });
    const costEvidence = debuggerEvidence.costEvidence || null;
    return {
      schemaVersion: 1,
      outcome: classification.outcome,
      classification: classification.classification,
      blocker: actionBlocker,
      lane,
      repeatIndex,
      scenarioId: scenario.id,
      siteId: scenario.siteId,
      routeId: new URL(scenario.urls.primary).pathname,
      url: sanitizeSiteHarnessUrl(scenario.urls.primary),
      features: scenario.expectedActivation.activeFilterKeys,
      activation: {
        state: activation.state,
        expectedActiveFilterKeys: activation.expectedActiveFilterKeys,
        activeFilterKeys: activation.activeFilterKeys,
        social: activation.social,
      },
      observableEffect: effect,
      actions: measurementPrelude.actionResults,
      configuration: {
        initial: initialConfiguration,
        disabled: disabledConfiguration,
        reenabled: reenabledConfiguration,
        readback: configurationEvidence,
        initialReadback: initialConfigurationState,
        disabledReadback: disabledConfigurationState,
        disabledPropagation,
        reenabledReadback: reenabledConfigurationState,
        disabledCleanupState: effect.cleanupState,
        disabledDomCleanupState: disabledCleanup.state,
        reenabledActivationState: reenabledActivation.state,
        initialActivation: {
          state: initialActivation.state,
          waitedMs: activationAttempts.reduce(
            (total, attempt) => total + (Number(attempt.waitedMs) || 0),
            0,
          ),
          attempts: activationAttempts.map((attempt) => ({
            phase: attempt.phase,
            state: attempt.state,
            waitedMs: attempt.waitedMs,
          })),
          runtimeBefore: runtimeBeforeActivation,
          runtimeAfterWait: runtimeAfterActivationWait,
          trackingBefore: trackingBeforeActivation,
          trackingAfterWait: trackingAfterActivationWait,
        },
        contentRuntime: contentRuntimeDiagnostics,
        contentRuntimeBeforeDisable,
        contentRuntimeAfterDisable,
        contentRuntimeAfterReenable,
        contentRuntimeBeforeErrorRefresh,
        contentRuntimeFinal,
        contentRuntimeSettlementEvidence: contentRuntimeSettlementLedger.snapshot(),
      },
      costs,
      progression,
      cleanup: {
        pendingQueuesSettled: pendingQueuesSettled(costEvidence),
      },
      debugger: debuggerEvidence,
      runtimeAttribution,
      performance,
      contracts,
      errors: [
        ...runtimeCollection.errors,
        ...extensionCollectorErrors,
        ...extensionErrors,
        ...pageErrors,
      ],
      browser: harness.browserVersion?.Browser || null,
      build: buildIdentity,
      reproductionCommand: createReproductionCommand(options, lane, scenario),
      artifacts: {},
    };
  } catch (error) {
    pageErrors.push(createSafeRuntimeError(error, 'scenario'));
    const contentRuntimeBeforeErrorRefresh = await collectScenarioContentRuntimeBestEffort(
      'exception_before_extension_error_refresh',
    );
    let extensionErrors = [];
    if (extensionCollector && !extensionErrorCursor) {
      extensionErrors = [
        createSafeRuntimeError(
          new Error('SITE_E2E_EXTENSION_ERROR_CURSOR_REQUIRED'),
          'extension_worker_collector_cursor',
        ),
      ];
    } else if (extensionCollector) {
      try {
        extensionErrors = (
          await extensionCollector.refreshAfterErrorCursor(extensionErrorCursor)
        ).errors;
      } catch (collectorError) {
        extensionErrors = [
          ...extensionCollector.snapshotAfterErrorCursor(extensionErrorCursor).errors,
          createSafeRuntimeError(collectorError, 'extension_worker_collector_refresh'),
        ];
      }
    }
    const contentRuntimeFinal = await collectScenarioContentRuntimeBestEffort(
      'exception_after_extension_error_refresh',
    );
    return {
      ...(await collectBlockedRun({
        scenario,
        lane,
        repeatIndex,
        options,
        blocker: { classification: 'inconclusive', reason: 'scenario_exception' },
        browser: harness.browserVersion?.Browser || null,
        progression,
        configuration: createScenarioContentRuntimeConfiguration({
          contentRuntimeBeforeErrorRefresh,
          contentRuntimeFinal,
        }),
        build: buildIdentity,
        errors: [
          ...extensionErrors,
          ...pageErrors,
        ],
      })),
      outcome: String(error?.message || '').includes('CONTRACT')
        ? SITE_RUN_OUTCOMES.FAIL
        : SITE_RUN_OUTCOMES.INCONCLUSIVE,
    };
  } finally {
    if (debuggerStarted && page) {
      await sendRuntimeDebuggerAutomationAction(
        harness,
        page,
        RUNTIME_DEBUGGER_AUTOMATION_ACTIONS.STOP,
      ).catch(() => {});
    }
    await extensionCollector?.dispose?.().catch(() => {});
    pageCollector?.dispose?.();
    if (page) await harness.closePage(page).catch(() => {});
  }
}

function classifyDocumentResponseBlocker(lastDocumentResponse) {
  if (lastDocumentResponse?.status === 401) {
    return { classification: 'auth_required', reason: 'http_401' };
  }
  if ([403, 429].includes(lastDocumentResponse?.status)) {
    return {
      classification: 'blocked',
      reason: `http_${lastDocumentResponse.status}`,
    };
  }
  return null;
}

function readReferenceMeasurementWindowMs(referenceRuns, scenario, repeatIndex) {
  const exact = referenceRuns.find((run) => (
    run?.lane === 'release'
    && run?.scenarioId === scenario.id
    && run?.repeatIndex === repeatIndex
  ));
  const value = Number(exact?.costs?.measurementWindowMs);
  return Number.isFinite(value) && value >= 0 ? value : null;
}

function createExtensionDisabledControlBase({
  scenario,
  repeatIndex,
  options,
  browser,
}) {
  return {
    schemaVersion: 1,
    runKind: 'extension_disabled_control',
    outcome: SITE_RUN_OUTCOMES.INCONCLUSIVE,
    classification: 'inconclusive',
    measurementState: 'unavailable',
    lane: 'control',
    repeatIndex,
    scenarioId: scenario.id,
    siteId: scenario.siteId,
    routeId: new URL(scenario.urls.primary).pathname,
    url: sanitizeSiteHarnessUrl(scenario.urls.primary),
    features: scenario.expectedActivation.activeFilterKeys,
    activation: {
      state: 'not_applicable_extension_disabled',
      expectedActiveFilterKeys: scenario.expectedActivation.activeFilterKeys,
      activeFilterKeys: null,
      social: null,
    },
    observableEffect: {
      status: 'not_evaluated_extension_disabled',
      cleanupState: 'not_applicable_extension_disabled',
      reenabled: null,
    },
    extension: {
      state: 'disabled',
      launchPolicy: 'disable_all_extensions',
      productConfigurationPhases: 'not_applicable',
    },
    readiness: { initial: null, postLifecycle: null },
    actions: [],
    costs: {
      before: null,
      after: null,
      delta: null,
      measurementWindowMs: null,
      referenceMeasurementWindowMs: null,
      clockDriftMs: null,
      storage: {
        state: 'inactive',
        reason: 'extension_disabled',
        localGrowthBytes: null,
        sessionGrowthBytes: null,
      },
      targetsAfterClose: null,
      collectors: {
        longTasks: { status: 'unavailable', reason: 'not_started' },
        longAnimationFrames: { status: 'unavailable', reason: 'not_started' },
        extensionServiceWorker: {
          availability: 'inactive',
          reason: 'extension_disabled',
        },
      },
    },
    cleanup: { pageTargetClosed: null },
    debugger: { availability: 'not_loaded_control' },
    runtimeAttribution: {
      schemaVersion: 1,
      state: 'not_requested',
      reason: 'contention_measurement_profile_required',
    },
    contracts: [],
    errors: [],
    browser,
    reproductionCommand: `${createReproductionCommand(options, 'release', scenario)} # control runs automatically`,
    artifacts: {},
  };
}

function classifyControlActions(actions) {
  const invalid = actions.filter((action) => action.status !== 'performed');
  if (invalid.length === 0) {
    return { state: 'measured', classification: null, outcome: SITE_RUN_OUTCOMES.PASS };
  }
  if (invalid.some((action) => action.status === 'forbidden_target')) {
    return {
      state: 'broken',
      classification: 'contract_drift',
      outcome: SITE_RUN_OUTCOMES.INCONCLUSIVE,
    };
  }
  return {
    state: 'insufficient',
    classification: 'inconclusive',
    outcome: SITE_RUN_OUTCOMES.WARN,
  };
}

async function bringControlPageToFront(harness, page) {
  await harness.cdp.send('Page.bringToFront', {}, page.sessionId).catch(() => {});
}

function isExtensionDisabledControlHarness(harness) {
  return (
    harness?.extensionEnabled === false
    && harness.extensionId === null
    && harness.extensionInstallMode === 'disabled'
    && harness.chromeLaunchSpec?.args?.includes('--disable-extensions')
  );
}

export async function openExtensionDisabledControlKeepalive(harness) {
  if (
    !isExtensionDisabledControlHarness(harness)
    || typeof harness.openPage !== 'function'
  ) {
    throw new Error('SITE_E2E_CONTROL_KEEPALIVE_EXTENSION_DISABLED_REQUIRED');
  }
  return harness.openPage('about:blank', {
    active: false,
    timeoutMs: 10_000,
  });
}

export async function runExtensionDisabledControlScenario({
  harness,
  scenario,
  repeatIndex,
  options,
  referenceRuns = [],
}) {
  const result = createExtensionDisabledControlBase({
    scenario,
    repeatIndex,
    options,
    browser: harness.browserVersion?.Browser || null,
  });
  let page = null;
  let pageCollector = null;
  let measurementStartedAt = null;
  let metricsBefore = null;
  let metricsAfter = null;
  let runtimeCollection = null;
  let measurementFinishedAt = null;
  try {
    if (!isExtensionDisabledControlHarness(harness)) {
      throw new Error('SITE_E2E_CONTROL_EXTENSION_DISABLED_CONTRACT_REQUIRED');
    }
    result.contracts.push({
      id: 'extension_fully_disabled',
      status: 'PASS',
      evidence: {
        extensionId: harness.extensionId,
        installMode: harness.extensionInstallMode,
        launchFlag: '--disable-extensions',
      },
    });

    page = await harness.openPage(scenario.urls.primary, {
      active: true,
      timeoutMs: 45_000,
    });
    pageCollector = await createPageRuntimeCollector(harness, page, {
      privacyMode: 'public',
    });
    await harness.reloadPage(page, { ignoreCache: false, timeoutMs: 45_000 });
    await bringControlPageToFront(harness, page);

    const initialReadiness = await waitForScenarioReadiness(harness, page, scenario, {
      timeoutMs: 30_000,
    });
    result.readiness.initial = initialReadiness.state;
    const responseBlocker = classifyDocumentResponseBlocker(
      pageCollector.snapshot().documentResponses?.at(-1) || null,
    );
    if (!initialReadiness.ready || responseBlocker) {
      const blocker = responseBlocker || initialReadiness.blocker || {
        classification: 'inconclusive',
        reason: 'control_initial_readiness_unavailable',
      };
      result.classification = blocker.classification;
      result.blocker = blocker;
      result.measurementState = blocker.classification === 'contract_drift'
        ? 'broken'
        : 'unavailable';
    } else {
      await sleep(500);
      pageCollector.clearLongTasks();
      pageCollector.clearLongAnimationFrames();
      const baselineRuntimeCollection = pageCollector.snapshot();
      metricsBefore = await collectPageMetrics(harness, page, {
        label: 'control-before-stimulus',
        longTasks: [],
        longTaskMeasurement: baselineRuntimeCollection.longTaskMeasurement,
        scenario,
      });
      measurementStartedAt = Date.now();

      const measurementActions = actionsForLane(
        scenario,
        'release',
        // This controlled effect lifecycle has no extension-disabled analogue;
        // it is functional evidence, not a matched CPU workload.
        (action) => !RUNNER_OWNED_ACTIONS.has(action.kind)
          && action.kind !== 'visual_media_membership_probe',
      );
      for (const action of measurementActions) {
        result.actions.push(...await runScenarioActions(
          harness,
          page,
          scenario,
          [action],
          {
            collectRuntimeCost: options.measurementProfile === 'contention',
            collectRuntimeContention: false,
            projectCausalWindow: pageCollector.projectCausalWindow,
          },
        ));
        if (LIFECYCLE_ACTIONS.has(action.kind)) {
          const lifecycleReadiness = await waitForScenarioReadiness(
            harness,
            page,
            scenario,
            { timeoutMs: 30_000 },
          );
          result.readiness.postLifecycle = lifecycleReadiness.state;
          pageCollector.clearLongAnimationFrames();
        }
      }
      const postLifecycleReadiness = await waitForScenarioReadiness(
        harness,
        page,
        scenario,
        { timeoutMs: 30_000 },
      );
      result.readiness.postLifecycle = postLifecycleReadiness.state;
      if (!postLifecycleReadiness.ready) {
        result.classification = postLifecycleReadiness.blocker?.classification || 'inconclusive';
        result.blocker = postLifecycleReadiness.blocker || {
          classification: 'inconclusive',
          reason: 'control_post_lifecycle_readiness_unavailable',
        };
        result.measurementState = result.classification === 'contract_drift'
          ? 'broken'
          : 'unavailable';
      } else {
        await bringControlPageToFront(harness, page);
        await sleep(options.settleMs);

        const boundedScroll = findLastScenarioAction(measurementActions, 'scroll');
        if (boundedScroll) {
          result.actions.push(...await runScenarioActions(harness, page, scenario, [{
            ...boundedScroll,
            maximumSteps: Math.min(2, Number(boundedScroll.maximumSteps) || 2),
          }], {
            collectRuntimeCost: options.measurementProfile === 'contention',
            collectRuntimeContention: false,
            projectCausalWindow: pageCollector.projectCausalWindow,
          }));
        }

        const referenceMeasurementWindowMs = readReferenceMeasurementWindowMs(
          referenceRuns,
          scenario,
          repeatIndex,
        );
        result.costs.referenceMeasurementWindowMs = referenceMeasurementWindowMs;
        const elapsedMs = Date.now() - measurementStartedAt;
        const remainingMs = referenceMeasurementWindowMs === null
          ? options.settleMs
          : Math.max(0, Math.min(45_000, referenceMeasurementWindowMs - elapsedMs));
        if (remainingMs > 0) await sleep(remainingMs);

        result.observation = await readScenarioPageState(harness, page, scenario);
        const actionClassification = classifyControlActions(result.actions);
        result.measurementState = actionClassification.state;
        result.classification = actionClassification.classification;
        result.outcome = actionClassification.outcome;
      }
    }

    runtimeCollection = pageCollector.snapshot();
    metricsAfter = await collectPageMetrics(harness, page, {
      label: 'control-after-stimulus',
      longTasks: runtimeCollection.longTasks,
      longTaskMeasurement: runtimeCollection.longTaskMeasurement,
      scenario,
    });
    measurementFinishedAt = Date.now();
  } catch (error) {
    result.measurementState = 'broken';
    result.classification = 'inconclusive';
    result.outcome = SITE_RUN_OUTCOMES.INCONCLUSIVE;
    result.blocker = {
      classification: 'inconclusive',
      reason: 'control_scenario_exception',
    };
    result.errors.push(createSafeRuntimeError(error, 'control_scenario'));
  } finally {
    runtimeCollection ||= pageCollector?.snapshot?.() || null;
    if (!metricsAfter && page && pageCollector) {
      metricsAfter = await collectPageMetrics(harness, page, {
        label: 'control-final',
        longTasks: runtimeCollection?.longTasks || [],
        longTaskMeasurement: runtimeCollection?.longTaskMeasurement || null,
        scenario,
      }).catch(() => null);
      if (metricsAfter) measurementFinishedAt = Date.now();
    }
    pageCollector?.dispose?.();
    if (page) await harness.closePage(page).catch(() => {});
    await sleep(1_500);
    result.costs.targetsAfterClose = await collectTargetSnapshot(harness, scenario)
      .catch(() => null);
    result.cleanup.pageTargetClosed = page ? true : null;
  }

  const measurementWindowMs = measurementStartedAt === null
    ? null
    : Math.max(0, (measurementFinishedAt || Date.now()) - measurementStartedAt);
  result.costs.before = metricsBefore;
  result.costs.after = metricsAfter;
  result.costs.delta = metricsBefore && metricsAfter
    ? diffCdpMetricSnapshots(metricsBefore, metricsAfter)
    : null;
  result.costs.measurementWindowMs = measurementWindowMs;
  result.costs.clockDriftMs = (
    measurementWindowMs === null
    || result.costs.referenceMeasurementWindowMs === null
  ) ? null : measurementWindowMs - result.costs.referenceMeasurementWindowMs;
  result.costs.collectors.longTasks = {
    status: metricsAfter?.longTasks?.status || 'unavailable',
    reason: metricsAfter?.longTasks?.reason || 'metrics_unavailable',
    readyCount: metricsAfter?.longTasks?.readyCount ?? null,
    failureCount: metricsAfter?.longTasks?.failureCount ?? null,
  };
  result.costs.collectors.longAnimationFrames = {
    status: runtimeCollection?.longAnimationFrameMeasurement?.state || 'unavailable',
    reason: runtimeCollection?.longAnimationFrameMeasurement?.reason || 'metrics_unavailable',
    readyCount: runtimeCollection?.longAnimationFrameMeasurement?.readyCount ?? null,
    failureCount: runtimeCollection?.longAnimationFrameMeasurement?.failureCount ?? null,
    observedEntryCount: runtimeCollection?.longAnimationFrames?.length ?? null,
  };
  result.runtimeAttribution = options.measurementProfile === 'contention'
    ? summarizeActionRuntimeAttribution(result.actions, {
      longAnimationFrames: runtimeCollection?.longAnimationFrames || [],
      longAnimationFrameMeasurement: runtimeCollection?.longAnimationFrameMeasurement || null,
    })
    : {
      schemaVersion: 1,
      state: 'not_requested',
      reason: 'contention_measurement_profile_required',
    };
  result.errors.push(...(runtimeCollection?.errors || []));
  result.contracts.push({
    id: 'control_flow_measurement_available',
    status: result.measurementState === 'measured'
      ? 'PASS'
      : 'WARN',
    evidence: {
      state: result.measurementState,
      actionCount: result.actions.length,
      classification: result.classification,
    },
  });
  result.contracts.push({
    id: 'control_long_task_instrumentation_available',
    status: ['armed_idle', 'measured'].includes(metricsAfter?.longTasks?.status)
      ? 'PASS'
      : 'WARN',
    evidence: result.costs.collectors.longTasks,
  });
  result.contracts.push({
    id: 'control_long_animation_frame_instrumentation_available',
    status: result.costs.collectors.longAnimationFrames.status === 'measured'
      ? 'PASS'
      : 'WARN',
    evidence: result.costs.collectors.longAnimationFrames,
  });
  return result;
}

async function runExtensionDisabledControlLane({
  scenarios,
  options,
  chromePath,
  referenceRuns,
}) {
  const controlBrowserExecution = projectExtensionDisabledControlBrowserExecution(
    options.browserExecution,
  );
  const harness = new ExtensionChromiumHarness({
    chromePath,
    distDir: '.',
    rootDir,
    headless: options.headless,
    browserExecution: controlBrowserExecution,
    audioPolicy: options.audioPolicy,
    renderingRequirement: options.renderingRequirement,
    keepTemp: options.keepProfile && !options.profile,
    qaProfileDir: null,
    tempPrefix: 'entropy-site-e2e-control-',
    extensionEnabled: false,
  });
  const runs = [];
  try {
    await harness.start();
    await openExtensionDisabledControlKeepalive(harness);
    console.error(
      `[site-e2e] control browser=${harness.browserVersion?.Browser || 'unknown'}`
      + ' extension=disabled process=single_keepalive_target',
    );
    for (const scenario of scenarios) {
      for (let repeatIndex = 1; repeatIndex <= options.repeat; repeatIndex += 1) {
        console.error(`[site-e2e] control ${scenario.id} repeat=${repeatIndex}/${options.repeat}`);
        const run = await runExtensionDisabledControlScenario({
          harness,
          scenario,
          repeatIndex,
          options,
          referenceRuns,
        });
        runs.push(run);
        console.error(
          `[site-e2e] ${run.outcome} control ${scenario.id} repeat=${repeatIndex}`
          + ` state=${run.measurementState}`,
        );
      }
    }
    return {
      runs,
      browser: {
        product: harness.browserVersion?.Browser || null,
        protocolVersion: harness.browserVersion?.['Protocol-Version'] || null,
        executable: chromePath,
        headless: options.headless,
      },
      profilePath: harness.userDataDir,
      profileRetained: harness.keepTemp,
    };
  } finally {
    await harness.close();
  }
}

export function projectExtensionDisabledControlBrowserExecution(browserExecution) {
  if (browserExecution === null || browserExecution === undefined) return null;
  return projectBrowserExecutionContract({
    ...browserExecution,
    extensionRuntime: 'none',
  });
}

async function runLane({
  lane,
  artifact,
  scenarios,
  options,
  chromePath,
  approvedBaseline,
  qaProfile,
  repeatIndexes = null,
}) {
  const qaProfilePath = options.profile ? path.resolve(options.profile) : null;
  const temporaryManifest = {
    requiredPermissions: ['scripting'],
    requiredHostPermissions: getSiteScenarioHostPermissions({
      suite: options.suite,
      siteId: options.site,
      featureGroup: options.featureGroup,
    }),
  };
  const qaArtifact = qaProfilePath
    ? await stageEntropyQaArtifact({
      profileDir: qaProfilePath,
      sourceDir: artifact.distDir,
      temporaryManifest,
    })
    : null;
  const harness = new ExtensionChromiumHarness({
    chromePath,
    distDir: qaArtifact?.slotDir || artifact.distDir,
    rootDir,
    headless: options.headless,
    browserExecution: options.browserExecution,
    audioPolicy: options.audioPolicy,
    renderingRequirement: options.renderingRequirement,
    keepTemp: options.keepProfile && !options.profile,
    qaProfileDir: qaProfilePath,
    tempPrefix: `entropy-site-e2e-${lane}-`,
    temporaryManifest: qaArtifact ? null : temporaryManifest,
    loadInPlace: !!qaArtifact,
    trustedPagePath: qaArtifact ? ENTROPY_QA_TRUSTED_PAGE_PATH : null,
  });
  const runs = [];
  let laneProgression = null;
  let diagnosticOverrideActive = false;
  let laneResult = null;
  let repeatIsolationEpochIdentity = null;
  let repeatIsolationTempRoot = null;
  try {
    await harness.start();
    if (qaArtifact) {
      if (harness.uninstallExtensionOnClose) {
        throw new Error('SITE_E2E_QA_PROFILE_UNINSTALL_LIFECYCLE_FORBIDDEN');
      }
      await harness.reloadExtensionFromSource();
    }
    console.error(`[site-e2e] ${lane} browser=${harness.browserVersion?.Browser || 'unknown'}`);
    laneProgression = await prepareLaneArtifactDisclosure(harness, {
      lane,
      scenarios,
      disposableProfile: !options.profile,
      canonicalProgressionFixture: lane === 'release'
        ? qaProfile?.marker?.fixtures?.canonicalProgression || null
        : null,
    });
    diagnosticOverrideActive = lane === 'diagnostic';
    const admittedRepeatIndexes = repeatIndexes === null
      ? Array.from({ length: options.repeat }, (_, index) => index + 1)
      : repeatIndexes;
    if (
      !Array.isArray(admittedRepeatIndexes)
      || admittedRepeatIndexes.length === 0
      || admittedRepeatIndexes.some((repeatIndex) => (
        !Number.isSafeInteger(repeatIndex)
        || repeatIndex < 1
        || repeatIndex > options.repeat
      ))
      || new Set(admittedRepeatIndexes).size !== admittedRepeatIndexes.length
    ) {
      throw new Error('SITE_E2E_REPEAT_INDEX_SET_INVALID');
    }
    for (const scenario of scenarios) {
      for (const repeatIndex of admittedRepeatIndexes) {
        console.error(`[site-e2e] ${lane} ${scenario.id} repeat=${repeatIndex}/${options.repeat}`);
        const run = await runOneScenario({
          harness,
          artifact,
          scenario,
          lane,
          repeatIndex,
          options,
          approvedBaseline,
          laneProgression,
        });
        runs.push(run);
        console.error(`[site-e2e] ${run.outcome} ${lane} ${scenario.id} repeat=${repeatIndex}`);
      }
    }
    if (diagnosticOverrideActive) {
      await clearDiagnosticArtifactDisclosureOverride(harness, {
        clearQaSessionState: !!qaArtifact,
      });
      diagnosticOverrideActive = false;
    }
    if (options.repeatIsolation === FRESH_DISPOSABLE_BROWSER_REPEAT_ISOLATION) {
      repeatIsolationEpochIdentity = createVerifiedRepeatIsolationEpochIdentity(harness);
      repeatIsolationTempRoot = harness.tempRoot;
    }
    laneResult = {
      runs,
      browser: {
        product: harness.browserVersion?.Browser || null,
        protocolVersion: harness.browserVersion?.['Protocol-Version'] || null,
        executable: chromePath,
        headless: options.headless,
      },
      profilePath: harness.userDataDir,
      temporaryExtensionPath: qaArtifact?.slotDir
        || (harness.keepTemp ? harness.extensionDir : null),
      temporaryExtensionRetained: !!qaArtifact || harness.keepTemp,
      temporaryExtensionLifecycle: qaArtifact
        ? 'persistent_qa_artifact_slot'
        : harness.keepTemp
        ? 'retained_with_disposable_profile'
        : 'temporary_removed_after_lane',
    };
  } finally {
    if (diagnosticOverrideActive) {
      await clearDiagnosticArtifactDisclosureOverride(harness, {
        clearQaSessionState: !!qaArtifact,
      }).catch((error) => {
        console.error(`[site-e2e] diagnostic progression cleanup failed: ${error.message}`);
      });
    }
    await harness.close();
  }
  if (repeatIsolationEpochIdentity) {
    await assertRepeatIsolationTempRootRemoved(repeatIsolationTempRoot);
    laneResult.repeatIsolationEpoch = Object.freeze({
      ...repeatIsolationEpochIdentity,
      cleanupState: 'completed',
    });
  }
  return laneResult;
}

function sameBrowserReportIdentity(left, right) {
  return left?.product === right?.product
    && left?.protocolVersion === right?.protocolVersion
    && left?.executable === right?.executable
    && left?.headless === right?.headless;
}

function isCompleteBrowserReportIdentity(browser) {
  return typeof browser?.product === 'string'
    && browser.product.length > 0
    && typeof browser.protocolVersion === 'string'
    && browser.protocolVersion.length > 0
    && typeof browser.executable === 'string'
    && browser.executable.length > 0
    && typeof browser.headless === 'boolean';
}

function createSha256Scalar(value) {
  return `sha256:${createHash('sha256').update(value).digest('hex')}`;
}

function hasExactKeys(value, keys) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const actual = Object.keys(value).sort();
  const expected = [...keys].sort();
  return actual.length === expected.length
    && actual.every((key, index) => key === expected[index]);
}

function createVerifiedRepeatIsolationEpochIdentity(harness) {
  const browserIdentity = harness?.browserIdentity;
  const ownerTokenSha256 = browserIdentity?.proof?.ownerTokenSha256;
  const profilePath = typeof harness?.userDataDir === 'string'
    ? path.resolve(harness.userDataDir)
    : null;
  const tempRoot = typeof harness?.tempRoot === 'string'
    ? path.resolve(harness.tempRoot)
    : null;
  if (
    harness?.attachOnly !== false
    || harness?.browserOwnership !== 'harness_launched_browser'
    || harness?.ownedBrowserIdentityVerified !== true
    || browserIdentity?.status !== 'owned_endpoint_identity_verified'
    || typeof browserIdentity.userDataDir !== 'string'
    || !browserIdentity.userDataDir
    || !SHA256_HEX_PATTERN.test(ownerTokenSha256 || '')
    || harness?.qaProfileDir !== null
    || harness?.keepTemp !== false
    || harness?.loadInPlace !== false
    || profilePath === null
    || tempRoot === null
    || profilePath !== path.join(tempRoot, 'profile')
    || path.resolve(harness?.extensionDir || '') !== path.join(tempRoot, 'extension')
  ) {
    throw new Error('SITE_E2E_REPEAT_ISOLATION_VERIFIED_EPOCH_REQUIRED');
  }
  return Object.freeze({
    version: 1,
    mode: FRESH_DISPOSABLE_BROWSER_REPEAT_ISOLATION,
    browserEpochDigest: `sha256:${ownerTokenSha256}`,
    profileEpochDigest: createSha256Scalar(profilePath),
    browserProcessOwnership: 'owned',
    profileOwnership: 'harness_disposable',
    profileRetained: false,
    temporaryExtensionRetained: false,
  });
}

async function assertRepeatIsolationTempRootRemoved(tempRoot) {
  try {
    await fs.lstat(tempRoot);
  } catch (error) {
    if (error?.code === 'ENOENT') return;
    throw new Error(
      `SITE_E2E_REPEAT_ISOLATION_CLEANUP_PROOF_FAILED:${error?.code || error?.name || 'unknown'}`,
      { cause: error },
    );
  }
  throw new Error('SITE_E2E_REPEAT_ISOLATION_TEMP_ROOT_RETAINED');
}

function validateRepeatIsolationEpoch(epoch, repeatIndex) {
  if (
    !hasExactKeys(epoch, REPEAT_ISOLATION_EPOCH_KEYS)
    || epoch.version !== 1
    || epoch.mode !== FRESH_DISPOSABLE_BROWSER_REPEAT_ISOLATION
    || !/^sha256:[a-f0-9]{64}$/u.test(epoch.browserEpochDigest || '')
    || !/^sha256:[a-f0-9]{64}$/u.test(epoch.profileEpochDigest || '')
    || epoch.browserProcessOwnership !== 'owned'
    || epoch.profileOwnership !== 'harness_disposable'
    || epoch.profileRetained !== false
    || epoch.temporaryExtensionRetained !== false
    || epoch.cleanupState !== 'completed'
  ) {
    throw new Error(`SITE_E2E_REPEAT_ISOLATION_EPOCH_RECEIPT_INVALID:${repeatIndex}`);
  }
  return epoch;
}

export async function runLaneWithRepeatIsolation(args, {
  runLaneImpl = runLane,
} = {}) {
  if (args?.options?.repeatIsolation !== FRESH_DISPOSABLE_BROWSER_REPEAT_ISOLATION) {
    return runLaneImpl(args);
  }
  if (args.options.profile || args.options.keepProfile) {
    throw new Error('SITE_E2E_REPEAT_ISOLATION_DISPOSABLE_PROFILE_REQUIRED');
  }
  const expectedScenarioIds = new Set(args.scenarios.map((scenario) => scenario.id));
  const profilePaths = new Set();
  const browserEpochDigests = new Set();
  const profileEpochDigests = new Set();
  const runs = [];
  let canonicalResult = null;
  for (let repeatIndex = 1; repeatIndex <= args.options.repeat; repeatIndex += 1) {
    const epochResult = await runLaneImpl({
      ...args,
      repeatIndexes: [repeatIndex],
    });
    if (
      !Array.isArray(epochResult?.runs)
      || epochResult.runs.length !== expectedScenarioIds.size
      || epochResult.runs.some((run) => (
        run?.lane !== args.lane
        || run?.repeatIndex !== repeatIndex
        || !expectedScenarioIds.has(run?.scenarioId)
      ))
      || new Set(epochResult.runs.map((run) => run.scenarioId)).size
        !== expectedScenarioIds.size
    ) {
      throw new Error(`SITE_E2E_REPEAT_ISOLATION_RUN_COVERAGE_INVALID:${repeatIndex}`);
    }
    if (
      typeof epochResult.profilePath !== 'string'
      || epochResult.profilePath.length === 0
      || profilePaths.has(epochResult.profilePath)
    ) {
      throw new Error(`SITE_E2E_REPEAT_ISOLATION_PROFILE_EPOCH_INVALID:${repeatIndex}`);
    }
    if (
      epochResult.temporaryExtensionRetained !== false
      || epochResult.temporaryExtensionPath !== null
      || epochResult.temporaryExtensionLifecycle !== 'temporary_removed_after_lane'
    ) {
      throw new Error(`SITE_E2E_REPEAT_ISOLATION_ARTIFACT_RETAINED:${repeatIndex}`);
    }
    if (!isCompleteBrowserReportIdentity(epochResult.browser)) {
      throw new Error(`SITE_E2E_REPEAT_ISOLATION_BROWSER_IDENTITY_INVALID:${repeatIndex}`);
    }
    if (canonicalResult && !sameBrowserReportIdentity(canonicalResult.browser, epochResult.browser)) {
      throw new Error(`SITE_E2E_REPEAT_ISOLATION_BROWSER_IDENTITY_MISMATCH:${repeatIndex}`);
    }
    const epoch = validateRepeatIsolationEpoch(
      epochResult.repeatIsolationEpoch,
      repeatIndex,
    );
    if (
      browserEpochDigests.has(epoch.browserEpochDigest)
      || profileEpochDigests.has(epoch.profileEpochDigest)
    ) {
      throw new Error(`SITE_E2E_REPEAT_ISOLATION_EPOCH_REUSED:${repeatIndex}`);
    }
    profilePaths.add(epochResult.profilePath);
    browserEpochDigests.add(epoch.browserEpochDigest);
    profileEpochDigests.add(epoch.profileEpochDigest);
    canonicalResult ||= epochResult;
    const repeatIsolationEvidence = Object.freeze({
      ...epoch,
      epochOrdinal: repeatIndex,
    });
    runs.push(...epochResult.runs.map((run) => ({
      ...run,
      configuration: {
        ...(run.configuration || {}),
        repeatIsolation: repeatIsolationEvidence,
      },
    })));
  }
  const { repeatIsolationEpoch: _canonicalEpoch, ...canonicalLaneResult } = canonicalResult;
  return {
    ...canonicalLaneResult,
    runs,
    profilePath: null,
    temporaryExtensionPath: null,
    temporaryExtensionRetained: false,
    temporaryExtensionLifecycle: 'temporary_removed_after_lane',
  };
}

function createMissingProfileRuns({ scenarios, lanes, options }) {
  const runs = [];
  for (const lane of lanes) {
    for (const scenario of scenarios) {
      for (let repeatIndex = 1; repeatIndex <= options.repeat; repeatIndex += 1) {
        runs.push({
          schemaVersion: 1,
          outcome: SITE_RUN_OUTCOMES.INCONCLUSIVE,
          classification: 'auth_required',
          blocker: {
            classification: 'auth_required',
            reason: 'explicit_qa_profile_missing',
            takeoverCheckpoint: true,
          },
          lane,
          repeatIndex,
          scenarioId: scenario.id,
          siteId: scenario.siteId,
          routeId: new URL(scenario.urls.primary).pathname,
          url: sanitizeSiteHarnessUrl(scenario.urls.primary),
          features: scenario.expectedActivation.activeFilterKeys,
          activation: {
            state: 'unavailable',
            expectedActiveFilterKeys: scenario.expectedActivation.activeFilterKeys,
            activeFilterKeys: [],
            social: null,
          },
          observableEffect: {
            status: 'unavailable',
            cleanupState: 'unavailable',
            reenabled: null,
          },
          costs: { before: null, after: null, delta: null, storage: null },
          cleanup: { pendingQueuesSettled: null },
          debugger: { availability: 'unavailable' },
          contracts: [],
          errors: [],
          reproductionCommand: createReproductionCommand(options, lane, scenario),
          artifacts: {},
        });
      }
    }
  }
  return runs;
}

export function applyApprovedPerformanceBaselines({
  runs = [],
  scenarios = [],
  approvedBaseline = { path: null, value: null },
  headless = true,
} = {}) {
  const scenarioById = new Map(scenarios.map((scenario) => [scenario.id, scenario]));
  const nextRuns = runs.map((run) => ({
    ...run,
    contracts: Array.isArray(run.contracts) ? [...run.contracts] : [],
  }));
  const groupedIndexes = new Map();
  nextRuns.forEach((run, index) => {
    const key = `${run.lane}:${run.scenarioId}`;
    const indexes = groupedIndexes.get(key) || [];
    indexes.push(index);
    groupedIndexes.set(key, indexes);
  });

  const summaries = {};
  for (const [key, indexes] of groupedIndexes) {
    const group = indexes.map((index) => nextRuns[index]);
    const groupWithEligibility = group.map((run) => ({
      ...run,
      performanceEligibility: evaluateSitePerformanceSampleEligibility(run),
    }));
    const eligibleGroup = groupWithEligibility.filter(
      (run) => run.performanceEligibility.external.eligible,
    );
    const selectedScenario = scenarioById.get(group[0]?.scenarioId);
    const scenario = {
      ...selectedScenario,
      id: selectedScenario?.id ?? group[0]?.scenarioId,
      siteId: selectedScenario?.siteId ?? group[0]?.siteId,
      urls: selectedScenario?.urls ?? { primary: group[0]?.url },
      settings: selectedScenario?.settings,
      expectedActivation: selectedScenario?.expectedActivation ?? {
        activeFilterKeys: group[0]?.features || [],
      },
      actions: selectedScenario?.actions ?? [],
      readiness: selectedScenario?.readiness,
      observableEffects: selectedScenario?.observableEffects,
      settle: selectedScenario?.settle,
      featureGroup: selectedScenario?.featureGroup,
    };
    const medianMetrics = summarizeMetricRepeats(eligibleGroup);
    const workloadFingerprint = createSitePerformanceWorkloadFingerprint({
      scenario,
      lane: group[0]?.lane,
      browserProduct: group[0]?.browser || null,
      headless,
    });
    const workload = summarizeSitePerformanceWorkload(eligibleGroup);
    const normalizedMetrics = summarizeNormalizedSitePerformanceMetrics({
      runs: eligibleGroup,
      metrics: medianMetrics,
      workload,
    });
    const metricSampleCounts = summarizeSitePerformanceMetricCoverage(eligibleGroup);
    const baselineEntry = selectApprovedBaseline(approvedBaseline.value, {
      scenario,
      lane: group[0]?.lane,
      browser: group[0]?.browser || null,
      headless,
    });
    const activationMeasuredSampleCount = group.filter((run) => (
      (
        run.activation?.state === 'measured'
        || (
          run.lane === 'release'
          && run.activation?.state === 'unavailable_effect_confirmed'
        )
      )
      && run.observableEffect?.status === 'measured'
    )).length;
    const performanceEligibility = {
      policy: 'contract_scoped_performance_sample_eligibility',
      totalSampleCount: group.length,
      externalEligibleSampleCount: eligibleGroup.length,
      externalExcludedSampleCount: group.length - eligibleGroup.length,
      internalEligibleSampleCount: eligibleGroup.filter(
        (run) => run.performanceEligibility.internal.eligible,
      ).length,
      samples: groupWithEligibility.map((run) => ({
        repeatIndex: run.repeatIndex,
        external: run.performanceEligibility.external,
        internal: run.performanceEligibility.internal,
        phase: run.performanceEligibility.phase,
        advisoryContractIds: run.performanceEligibility.advisoryContracts.map(
          (entry) => entry.id,
        ),
        blockingContractIds: run.performanceEligibility.blockingContracts.map(
          (entry) => entry.id,
        ),
      })),
    };
    let comparison;
    if (activationMeasuredSampleCount === 0) {
      comparison = {
        status: 'WARN',
        reason: 'activation_not_measured',
        policy: 'read_only_approved_operating_envelope',
        checks: [],
        normalizedMetrics,
        metricSampleCounts,
        workloadFingerprint,
        workload,
        performanceEligibility,
      };
    } else if (eligibleGroup.length === 0) {
      comparison = {
        status: 'WARN',
        reason: 'performance_sample_ineligible_nonpass_contracts',
        policy: 'read_only_approved_operating_envelope',
        checks: [],
        normalizedMetrics,
        metricSampleCounts,
        workloadFingerprint,
        workload,
        performanceEligibility,
      };
    } else {
      comparison = compareMetricsWithApprovedBaseline({
        metrics: medianMetrics,
        normalizedMetrics,
        workloadFingerprint,
        workload,
        metricSampleCounts,
        baseline: baselineEntry,
      });
      comparison.performanceEligibility = performanceEligibility;
    }
    summaries[key] = {
      status: comparison.status,
      reason: comparison.reason,
      classification: comparison.classification || null,
      policy: comparison.policy,
      sampleCount: eligibleGroup.length,
      totalSampleCount: group.length,
      median: medianMetrics,
      normalizedMedian: normalizedMetrics,
      workloadFingerprint,
      workload,
      metricSampleCounts,
      performanceEligibility,
      workloadChecks: comparison.workloadChecks || [],
      checks: comparison.checks,
      approvedBaselinePath: approvedBaseline.path,
    };

    for (const index of indexes) {
      const run = nextRuns[index];
      const runEligibility = groupWithEligibility.find(
        (entry) => entry.repeatIndex === run.repeatIndex,
      )?.performanceEligibility || evaluateSitePerformanceSampleEligibility(run);
      const runComparison = runEligibility.external.eligible
        ? comparison
        : {
          ...comparison,
          status: 'WARN',
          reason: 'performance_sample_ineligible_nonpass_contracts',
          checks: [],
        };
      const contracts = run.contracts.filter(
        (contract) => contract.id !== 'approved_performance_baseline',
      );
      contracts.push({
        id: 'approved_performance_baseline',
        status: runComparison.status,
        evidence: {
          path: approvedBaseline.path,
          reason: runComparison.reason,
          sampleCount: eligibleGroup.length,
          totalSampleCount: group.length,
          median: medianMetrics,
          normalizedMedian: normalizedMetrics,
          workloadFingerprint,
          workload,
          metricSampleCounts,
          workloadChecks: comparison.workloadChecks || [],
          checks: runComparison.checks,
          sampleEligibility: {
            external: runEligibility.external,
            internal: runEligibility.internal,
            phase: runEligibility.phase,
            advisoryContractIds: runEligibility.advisoryContracts.map((entry) => entry.id),
            blockingContractIds: runEligibility.blockingContracts.map((entry) => entry.id),
          },
          cohortEligibility: {
            totalSampleCount: performanceEligibility.totalSampleCount,
            externalEligibleSampleCount: performanceEligibility.externalEligibleSampleCount,
            externalExcludedSampleCount: performanceEligibility.externalExcludedSampleCount,
            internalEligibleSampleCount: performanceEligibility.internalEligibleSampleCount,
          },
        },
      });
      const performance = {
        ...runComparison,
        sample: run.performance?.metrics || null,
        median: medianMetrics,
        normalizedMedian: normalizedMetrics,
        workloadFingerprint,
        workload,
        metricSampleCounts,
        sampleCount: eligibleGroup.length,
        totalSampleCount: group.length,
        baselinePath: approvedBaseline.path,
        sampleEligibility: runEligibility,
        cohortEligibility: performanceEligibility,
      };
      const next = {
        ...run,
        contracts,
        performance,
      };
      if (!run.classification) {
        const classification = runComparison.classification === 'contract_drift'
          ? {
            outcome: SITE_RUN_OUTCOMES.INCONCLUSIVE,
            classification: 'contract_drift',
          }
          : classifySiteRun({
            contracts,
            performanceStatus: runComparison.status,
          });
        next.outcome = classification.outcome;
        next.classification = classification.classification;
      }
      nextRuns[index] = next;
    }
  }
  return { runs: nextRuns, summaries };
}

export function applySiteMeasurementProfileEvaluation({
  runs = [],
  scenarios = [],
  approvedBaseline = { path: null, value: null },
  headless = true,
  measurementProfile = null,
} = {}) {
  if (measurementProfile === null || measurementProfile === 'benchmark') {
    return applyApprovedPerformanceBaselines({
      runs,
      scenarios,
      approvedBaseline,
      headless,
    });
  }
  if (!['contract', 'contention'].includes(measurementProfile)) {
    throw new Error(
      `SITE_E2E_MEASUREMENT_PROFILE_INVALID:${measurementProfile || 'missing'}`,
    );
  }
  return {
    runs: runs.map((run) => ({
      ...run,
      contracts: (Array.isArray(run.contracts) ? run.contracts : []).filter(
        (contract) => contract?.id !== 'approved_performance_baseline',
      ),
      performance: {
        ...(run.performance || {}),
        status: 'not_evaluated',
        reason: `${measurementProfile}_profile_approved_baseline_not_evaluated`,
      },
    })),
    summaries: {},
  };
}

export async function runSiteRuntimeE2E(options) {
  const scenarios = getSiteScenarios({
    suite: options.suite,
    siteId: options.site,
    featureGroup: options.featureGroup,
  });
  const lanes = options.lane === 'both' ? [...LANE_IDS] : [options.lane];
  const suiteMetadata = SITE_SCENARIO_SUITE_METADATA[options.suite];
  const generatedAt = new Date().toISOString();
  const approvedBaseline = await readApprovedBaseline(options.suite);
  const reproductionCommands = scenarios.flatMap((scenario) => (
    lanes.map((lane) => createReproductionCommand(options, lane, scenario, {
      repeat: options.repeat,
    }))
  ));
  const qaProfile = options.profile
    ? await readEntropyQaProfileMarker(path.resolve(options.profile))
    : null;

  if (suiteMetadata.authMode === 'qa_profile_required' && !options.profile) {
    const blockedRuns = createMissingProfileRuns({ scenarios, lanes, options });
    const evaluated = applySiteMeasurementProfileEvaluation({
      runs: blockedRuns,
      scenarios,
      approvedBaseline,
      headless: options.headless,
      measurementProfile: options.measurementProfile,
    });
    return writeSiteSuiteReport({
      schemaVersion: 1,
      generatedAt,
      outcome: SITE_RUN_OUTCOMES.INCONCLUSIVE,
      suite: options.suite,
      lanes,
      options: createPersistedSiteRuntimeOptions(options, { profile: null }),
      browser: null,
      profile: { mode: 'explicit_qa_profile_required', path: null },
      builds: {},
      runs: evaluated.runs,
      controls: [],
      extensionDisabledControl: {
        state: lanes.includes('release') ? 'not_applicable' : 'not_requested',
        reason: lanes.includes('release')
          ? 'authenticated_suite_requires_explicit_profile_and_control_is_disposable_public_only'
          : 'release_lane_not_requested',
      },
      performanceBaselines: evaluated.summaries,
      takeoverCheckpoints: evaluated.runs.map((run) => ({
        scenarioId: run.scenarioId,
        classification: run.classification,
        reason: run.blocker.reason,
      })),
      reproductionCommands,
    }, options.reportDir);
  }

  const chromePath = findChromeExecutable(options.chromePath, { headless: options.headless });
  const buildRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'entropy-site-e2e-builds-'));
  const runs = [];
  const controls = [];
  const builds = {};
  let browser = null;
  const profilePaths = [];
  const controlProfilePaths = [];
  try {
    for (const lane of lanes) {
      const artifact = await prepareLaneArtifact(lane, options, buildRoot);
      const laneResult = await runLaneWithRepeatIsolation({
        lane,
        artifact,
        scenarios,
        options,
        chromePath,
        approvedBaseline,
        qaProfile,
      });
      runs.push(...laneResult.runs);
      browser ||= laneResult.browser;
      profilePaths.push(laneResult.profilePath);
      builds[lane] = createLaneBuildReportMetadata(artifact, laneResult);
    }
    if (
      lanes.includes('release')
      && suiteMetadata.authMode === 'public_no_login'
    ) {
      const controlResult = await runExtensionDisabledControlLane({
        scenarios,
        options,
        chromePath,
        referenceRuns: runs.filter((run) => run.lane === 'release'),
      });
      controls.push(...controlResult.runs);
      browser ||= controlResult.browser;
      controlProfilePaths.push(controlResult.profilePath);
    }
  } finally {
    await fs.rm(buildRoot, { recursive: true, force: true });
  }

  const evaluated = applySiteMeasurementProfileEvaluation({
    runs,
    scenarios,
    approvedBaseline,
    headless: options.headless,
    measurementProfile: options.measurementProfile,
  });
  const evaluatedRuns = evaluated.runs;
  const outcome = combineSiteRunOutcomes([
    ...evaluatedRuns.map((run) => run.outcome),
    ...controls.map((run) => run.outcome),
  ]);
  const takeoverCheckpoints = evaluatedRuns
    .filter((run) => ['auth_required', 'blocked'].includes(run.classification))
    .map((run) => ({
      scenarioId: run.scenarioId,
      lane: run.lane,
      classification: run.classification,
      reason: run.blocker?.reason || null,
    }));
  takeoverCheckpoints.push(...controls
    .filter((run) => ['auth_required', 'blocked'].includes(run.classification))
    .map((run) => ({
      scenarioId: run.scenarioId,
      lane: 'control',
      classification: run.classification,
      reason: run.blocker?.reason || null,
    })));
  const controlStates = [...new Set(controls.map((run) => run.measurementState))];
  return writeSiteSuiteReport({
    schemaVersion: 1,
    generatedAt,
    outcome,
    suite: options.suite,
    lanes,
    options: createPersistedSiteRuntimeOptions(options, {
      profile: options.profile ? path.resolve(options.profile) : null,
    }),
    browser,
    profile: {
      mode: options.profile ? 'explicit_qa_persistent' : 'disposable',
      path: options.profile ? path.resolve(options.profile) : (options.keepProfile ? profilePaths : null),
      retained: !!options.profile || options.keepProfile,
      controlPath: options.keepProfile && !options.profile ? controlProfilePaths : null,
      fixtureProvenance: qaProfile?.marker?.fixtureProvenance || null,
      markerSchemaVersion: qaProfile?.marker?.schemaVersion || null,
    },
    builds,
    runs: evaluatedRuns,
    controls,
    extensionDisabledControl: {
      state: !lanes.includes('release')
        ? 'not_requested'
        : suiteMetadata.authMode !== 'public_no_login'
          ? 'not_applicable'
          : controls.length === 0
            ? 'unavailable'
            : controlStates.every((state) => state === 'measured')
              ? 'measured'
              : 'partial',
      reason: !lanes.includes('release')
        ? 'release_lane_not_requested'
        : suiteMetadata.authMode !== 'public_no_login'
          ? 'authenticated_suite_control_not_automated'
          : controls.length === 0
            ? 'control_runs_missing'
            : null,
      comparisonPolicy: 'informational_product_median_minus_extension_disabled_control_median',
      automaticHardGate: false,
    },
    performanceBaselines: evaluated.summaries,
    takeoverCheckpoints,
    reproductionCommands,
  }, options.reportDir);
}

function printSummary(result) {
  const report = result.report;
  console.log(`[site-e2e] ${report.outcome} suite=${report.suite} lanes=${report.lanes.join(',')}`);
  console.log(`[site-e2e] JSON ${result.jsonPath}`);
  console.log(`[site-e2e] Markdown ${result.markdownPath}`);
  for (const run of report.runs) {
    console.log(
      `[site-e2e] ${run.outcome} ${run.lane}/${run.scenarioId} repeat=${run.repeatIndex}`
      + `${run.classification ? ` classification=${run.classification}` : ''}`,
    );
  }
  for (const control of report.controls || []) {
    console.log(
      `[site-e2e] ${control.outcome} control/${control.scenarioId}`
      + ` repeat=${control.repeatIndex} state=${control.measurementState}`,
    );
  }
}

async function main() {
  const options = admitQaExtensionBrowserChildExecution(
    parseSiteRuntimeE2EArgs(process.argv.slice(2)),
  );
  const result = await runSiteRuntimeE2E(options);
  printSummary(result);
  const allRuns = [...result.report.runs, ...(result.report.controls || [])];
  const hasFail = allRuns.some((run) => run.outcome === SITE_RUN_OUTCOMES.FAIL);
  const hasInconclusive = allRuns.some(
    (run) => run.outcome === SITE_RUN_OUTCOMES.INCONCLUSIVE,
  );
  if (hasFail || (options.failOnInconclusive && hasInconclusive)) process.exitCode = 1;
}

if (process.argv[1] && path.resolve(process.argv[1]) === scriptPath) {
  main().catch((error) => {
    console.error(`[site-e2e] FAIL ${error?.stack || error?.message || error}`);
    process.exit(1);
  });
}
