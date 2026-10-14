#!/usr/bin/env node

import { spawn } from 'node:child_process';
import fs from 'node:fs/promises';
import fsSync from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  ExtensionChromiumHarness,
  evaluate,
  sleep,
} from './extensionChromiumHarness.mjs';
import {
  ENTROPY_QA_TRUSTED_PAGE_PATH,
  stageEntropyQaArtifact,
} from './qaProfileArtifactSlot.mjs';
import {
  createSiteE2EChromeExecutableCandidates,
  createScenarioSettingsPayload,
} from './siteRuntimeE2E.mjs';
import {
  RUNTIME_DEBUGGER_AUTOMATION_ACTIONS,
  activateScenarioTab,
  clearDiagnosticArtifactDisclosureOverride,
  collectPageMetrics,
  configureScenario,
  prepareLaneArtifactDisclosure,
  runScenarioActions,
  sendRuntimeDebuggerAutomationAction,
  waitForScenarioReadiness,
} from './sites/siteRuntimeBrowser.mjs';
import {
  extractDebuggerCostEvidence,
} from './sites/siteRunAnalysis.mjs';
import {
  diffCdpMetricSnapshots,
} from './sites/siteRuntimeMetrics.mjs';
import {
  getSiteScenario,
} from './sites/scenarioCatalog.mjs';

const scriptPath = fileURLToPath(import.meta.url);
const scriptDir = path.dirname(scriptPath);
const rootDir = path.resolve(scriptDir, '../..');
const DEFAULT_REPORT_DIR = path.join(rootDir, 'reports/e2e/feed-horizon');
const DEFAULT_MAX_MINUTES = 10;
const DEFAULT_DWELL_MS = 2_600;
const WARMUP_MAX_STEPS = 32;
const DRY_RUN_TIMEOUT_MS = 20_000;
const OUTCOME_TIMEOUT_MS = 12_000;
const DRY_RUN_DEMAND_CAPTURE_TIMEOUT_MS = 4_500;
const DEMAND_CAPTURE_OBSERVATION_SLACK_MS = 4_500;
const DEMAND_CAPTURE_MAX_STILL_GATE_MS = 30_000;
const DEMAND_BURST_ACTION_COUNT = 2;
const FEED_REFRESH_TIMEOUT_MS = 10_000;
const FEED_REFRESH_RESELECT_DELAY_MS = 2_000;
const FEED_REFRESH_STALL_ACTIONS = 8;
const MAX_FEED_REFRESHES = 8;
const REPORT_SCHEMA_VERSION = 1;
const FEED_HORIZON_SCENARIO_ID_BY_SITE = Object.freeze({
  tiktok: 'tiktok-public-feed',
  youtube: 'youtube-shorts-feed-horizon',
  'youtube-home': 'youtube-home-feed-horizon',
  instagram: 'instagram-reels-feed-horizon',
  x: 'x-home-feed-horizon',
  'instagram-home': 'instagram-home-feed-horizon',
  facebook: 'facebook-home-feed-horizon',
});
const QA_PROFILE_REQUIRED_SITE_KEYS = new Set([
  'x',
  'instagram',
  'instagram-home',
  'facebook',
  'youtube-home',
]);

let activeHarnessForInterrupt = null;
let interruptCleanupStarted = false;

function closeActiveHarnessForInterrupt(signal) {
  if (interruptCleanupStarted) return;
  interruptCleanupStarted = true;
  const exitCode = signal === 'SIGINT' ? 130 : 143;
  console.error(`[feed-horizon-e2e] ${signal} received; closing automated Chrome`);
  Promise.resolve(activeHarnessForInterrupt?.close())
    .catch((error) => {
      console.error(
        `[feed-horizon-e2e] interrupt cleanup failed: ${error?.message || error}`,
      );
    })
    .finally(() => process.exit(exitCode));
}

function parseInteger(rawValue, code, { minimum, maximum }) {
  const value = Number(rawValue);
  if (!Number.isSafeInteger(value) || value < minimum || value > maximum) {
    throw new Error(`${code}:${String(rawValue)}`);
  }
  return value;
}

export function parseFeedHorizonCausalArgs(argv) {
  const options = {
    siteId: 'tiktok',
    headless: true,
    chromePath: null,
    profile: null,
    profileDirectory: null,
    diagnosticDist: null,
    build: true,
    reportDir: DEFAULT_REPORT_DIR,
    maxMinutes: DEFAULT_MAX_MINUTES,
    dwellMs: DEFAULT_DWELL_MS,
    dryRunOnly: false,
    skipDryRun: false,
    keepProfile: false,
  };
  for (const arg of argv) {
    if (arg.startsWith('--site=')) options.siteId = arg.slice('--site='.length);
    else if (arg === '--headed') options.headless = false;
    else if (arg === '--headless') options.headless = true;
    else if (arg === '--no-build') options.build = false;
    else if (arg === '--dry-run-only') options.dryRunOnly = true;
    else if (arg === '--skip-dry-run') options.skipDryRun = true;
    else if (arg === '--keep-profile') options.keepProfile = true;
    else if (arg.startsWith('--chrome=')) options.chromePath = arg.slice('--chrome='.length);
    else if (arg.startsWith('--profile=')) options.profile = arg.slice('--profile='.length);
    else if (arg.startsWith('--profile-directory=')) {
      options.profileDirectory = arg.slice('--profile-directory='.length);
    }
    else if (arg.startsWith('--diagnostic-dist=')) {
      options.diagnosticDist = arg.slice('--diagnostic-dist='.length);
    } else if (arg.startsWith('--report-dir=')) {
      options.reportDir = arg.slice('--report-dir='.length);
    } else if (arg.startsWith('--max-minutes=')) {
      options.maxMinutes = parseInteger(
        arg.slice('--max-minutes='.length),
        'FEED_HORIZON_E2E_MAX_MINUTES_INVALID',
        { minimum: 8, maximum: 20 },
      );
    } else if (arg.startsWith('--dwell-ms=')) {
      options.dwellMs = parseInteger(
        arg.slice('--dwell-ms='.length),
        'FEED_HORIZON_E2E_DWELL_MS_INVALID',
        { minimum: 900, maximum: 7_000 },
      );
    } else {
      throw new Error(`FEED_HORIZON_E2E_ARGUMENT_UNKNOWN:${arg}`);
    }
  }
  if (options.dryRunOnly && options.skipDryRun) {
    throw new Error('FEED_HORIZON_E2E_DRY_RUN_MODE_CONFLICT');
  }
  if (!options.dryRunOnly && !options.skipDryRun) {
    throw new Error('FEED_HORIZON_E2E_STAGE_MODE_REQUIRED');
  }
  if (!options.build && !options.diagnosticDist?.trim()) {
    throw new Error('FEED_HORIZON_E2E_DIAGNOSTIC_DIST_REQUIRED');
  }
  if (options.profile !== null) {
    if (!options.profile.trim()) throw new Error('FEED_HORIZON_E2E_QA_PROFILE_REQUIRED');
    if (!path.isAbsolute(options.profile)) {
      throw new Error('FEED_HORIZON_E2E_QA_PROFILE_ABSOLUTE_PATH_REQUIRED');
    }
    options.profile = path.normalize(options.profile);
  }
  if (options.profileDirectory !== null) {
    if (
      !options.profileDirectory.trim()
      || options.profileDirectory !== options.profileDirectory.trim()
    ) {
      throw new Error('FEED_HORIZON_E2E_PROFILE_DIRECTORY_INVALID');
    }
    if (options.profile === null) {
      throw new Error('FEED_HORIZON_E2E_PROFILE_DIRECTORY_REQUIRES_QA_PROFILE');
    }
  }
  if (!options.reportDir?.trim()) throw new Error('FEED_HORIZON_E2E_REPORT_DIR_REQUIRED');
  if (!Object.hasOwn(FEED_HORIZON_SCENARIO_ID_BY_SITE, options.siteId)) {
    throw new Error(`FEED_HORIZON_E2E_SITE_UNSUPPORTED:${String(options.siteId)}`);
  }
  if (QA_PROFILE_REQUIRED_SITE_KEYS.has(options.siteId) && options.profile === null) {
    throw new Error(
      `FEED_HORIZON_E2E_QA_PROFILE_REQUIRED:${options.siteId}`,
    );
  }
  return options;
}

export function getFeedHorizonScenario(siteId) {
  const scenarioId = FEED_HORIZON_SCENARIO_ID_BY_SITE[siteId];
  if (!scenarioId) throw new Error(`FEED_HORIZON_E2E_SITE_UNSUPPORTED:${String(siteId)}`);
  return getSiteScenario(scenarioId);
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
        `FEED_HORIZON_E2E_COMMAND_FAILED:${command}:${code ?? signal ?? 'unknown'}`,
      ));
    });
  });
}

export async function prepareDiagnosticArtifact(options, buildRoot) {
  const distDir = options.diagnosticDist
    ? path.resolve(rootDir, options.diagnosticDist)
    : path.join(buildRoot, 'diagnostic-dist');
  if (options.build) {
    console.error(`[feed-horizon-e2e] building diagnostic lane -> ${distDir}`);
    await runCommand('npm', ['run', 'build:bundle', '--', '--emptyOutDir'], {
      env: {
        ...process.env,
        ENTROPY_RELEASE_PROFILE: 'dev',
        ENTROPY_EXTENSION_OUT_DIR: distDir,
      },
    });
  }
  const buildInfo = JSON.parse(await fs.readFile(
    path.join(distDir, 'entropy-build-info.json'),
    'utf8',
  ));
  if (buildInfo.releaseProfile !== 'dev') {
    throw new Error(
      `FEED_HORIZON_E2E_DIAGNOSTIC_PROFILE_REQUIRED:${buildInfo.releaseProfile || 'missing'}`,
    );
  }
  return { distDir, buildInfo };
}

export function findChromeExecutable(options) {
  const candidates = createSiteE2EChromeExecutableCandidates({
    explicitPath: options.chromePath,
    headless: options.headless,
  });
  const resolved = candidates.find((candidate) => fsSync.existsSync(candidate));
  if (!resolved) throw new Error('FEED_HORIZON_E2E_CHROMIUM_EXECUTABLE_NOT_FOUND');
  return path.resolve(resolved);
}

export function getAutomationPayload(response) {
  const result = response?.result;
  if (result?.payload?.tool === 'entropy.runtimeDebugger') return result.payload;
  if (result?.tool === 'entropy.runtimeDebugger') return result;
  throw new Error('FEED_HORIZON_E2E_DEBUGGER_PAYLOAD_REQUIRED');
}

export function readFeedSnapshot(payload) {
  const feedFlow = payload?.latest?.feedFlow;
  if (!feedFlow || typeof feedFlow !== 'object') {
    throw new Error('FEED_HORIZON_E2E_FEED_SNAPSHOT_REQUIRED');
  }
  return feedFlow;
}

export async function readDebuggerPayload(harness, page) {
  return getAutomationPayload(await sendRuntimeDebuggerAutomationAction(
    harness,
    page,
    RUNTIME_DEBUGGER_AUTOMATION_ACTIONS.SNAPSHOT,
  ));
}

function summarizeTempoMeasurement(measurement) {
  if (!measurement || typeof measurement !== 'object') return null;
  const distribution = measurement.dwellDistribution || null;
  return {
    eligibleDwellCount: Math.max(0, Number(measurement.eligibleDwellCount) || 0),
    censoredDwellCount: Math.max(0, Number(measurement.censoredDwellCount) || 0),
    dwellEligibility: measurement.dwellEligibility
      ? {
        minimumInclusiveMs: Math.max(
          0,
          Number(measurement.dwellEligibility.minimumInclusiveMs) || 0,
        ),
        maximumInclusiveMs: Math.max(
          0,
          Number(measurement.dwellEligibility.maximumInclusiveMs) || 0,
        ),
      }
      : null,
    retention: measurement.retention
      ? {
        strategy: measurement.retention.strategy || null,
        capacity: Math.max(0, Number(measurement.retention.capacity) || 0),
        retainedCount: Math.max(0, Number(measurement.retention.retainedCount) || 0),
        droppedCount: Math.max(0, Number(measurement.retention.droppedCount) || 0),
        coverageRatio: Math.max(0, Number(measurement.retention.coverageRatio) || 0),
      }
      : null,
    censoring: measurement.censoring
      ? {
        belowMinimumCount: Math.max(
          0,
          Number(measurement.censoring.belowMinimumCount) || 0,
        ),
        aboveMaximumCount: Math.max(
          0,
          Number(measurement.censoring.aboveMaximumCount) || 0,
        ),
        multiTransitionCount: Math.max(
          0,
          Number(measurement.censoring.multiTransitionCount) || 0,
        ),
        trailingCount: Math.max(0, Number(measurement.censoring.trailingCount) || 0),
        trailingObservedDwellMs: Math.max(
          0,
          Number(measurement.censoring.trailingObservedDwellMs) || 0,
        ),
      }
      : null,
    retainedActiveDwellMs: Math.max(
      0,
      Number(measurement.retainedActiveDwellMs) || 0,
    ),
    totalActiveDwellMs: Math.max(0, Number(measurement.totalActiveDwellMs) || 0),
    rapidDwellThresholdMs: Math.max(
      0,
      Number(measurement.rapidDwellThresholdMs) || 0,
    ),
    rapidDwellCount: Math.max(0, Number(measurement.rapidDwellCount) || 0),
    rapidDwellShare: Math.max(0, Number(measurement.rapidDwellShare) || 0),
    dwellDistribution: distribution
      ? {
        version: Math.max(0, Number(distribution.version) || 0),
        bucketSemantics: distribution.bucketSemantics || null,
        exclusiveUpperBoundsMs: Array.isArray(distribution.exclusiveUpperBoundsMs)
          ? [...distribution.exclusiveUpperBoundsMs]
          : [],
        counts: Array.isArray(distribution.counts) ? [...distribution.counts] : [],
        overflowCount: Math.max(0, Number(distribution.overflowCount) || 0),
      }
      : null,
  };
}

function summarizeFeedTempo(tempo) {
  if (!tempo || typeof tempo !== 'object') return null;
  const currentEpisode = tempo.trajectory?.currentEpisode || null;
  const lastEpisode = tempo.lastEpisode || tempo.trajectory?.lastEpisode || null;
  const measurement = currentEpisode || lastEpisode;
  return {
    version: Math.max(0, Number(tempo.version) || 0),
    mode: tempo.mode || null,
    persistence: tempo.persistence || null,
    state: tempo.state || null,
    checkpoint: tempo.checkpoint
      ? {
        state: tempo.checkpoint.state || null,
        failure: tempo.checkpoint.failure || null,
      }
      : null,
    researchWriteFence: tempo.researchWriteFence
      ? { ...tempo.researchWriteFence }
      : null,
    trajectory: tempo.trajectory
      ? {
        state: tempo.trajectory.state || null,
        surface: tempo.trajectory.surface
          ? { ...tempo.trajectory.surface }
          : null,
        counters: tempo.trajectory.counters
          ? { ...tempo.trajectory.counters }
          : null,
      }
      : null,
    measurementSource: currentEpisode ? 'current_episode' : lastEpisode ? 'last_episode' : null,
    measurement: summarizeTempoMeasurement(measurement),
  };
}

export function summarizeFeedSnapshot(feedFlow, capturedAt = Date.now()) {
  const readiness = feedFlow?.semantic?.readiness || null;
  const safety = feedFlow?.semantic?.actuationSafety || null;
  const episode = feedFlow?.episode || null;
  const admission = episode?.admission || null;
  return {
    capturedAt,
    semanticState: feedFlow?.semantic?.state || null,
    advanceCount: Math.max(0, Number(feedFlow?.ledger?.counters?.advanceCount) || 0),
    itemTransitions: Math.max(
      0,
      Number(feedFlow?.semantic?.metrics?.itemTransitions) || 0,
    ),
    readiness: readiness
      ? {
        status: readiness.status || null,
        capability: readiness.capability || null,
        sampleCount: Math.max(0, Number(readiness.sampleCount) || 0),
        confidence: Number(readiness.confidence) || 0,
        reasons: Array.isArray(readiness.reasons) ? [...readiness.reasons] : [],
      }
      : null,
    actuationSafety: safety
      ? {
        status: safety.status || null,
        capability: safety.capability || null,
        reasons: Array.isArray(safety.reasons) ? [...safety.reasons] : [],
      }
      : null,
    tempo: summarizeFeedTempo(feedFlow?.tempo),
    binge: feedFlow?.binge && typeof feedFlow.binge === 'object'
      ? globalThis.structuredClone(feedFlow.binge)
      : null,
    episode: episode
      ? {
        phase: episode.phase || null,
        managerState: episode.managerState || null,
          blockers: Array.isArray(episode.blockers) ? [...episode.blockers] : [],
          admissionTransport: episode.admissionTransport
            ? globalThis.structuredClone(episode.admissionTransport)
            : null,
        feedDecision: episode.feedDecision
          ? {
            decisionId: episode.feedDecision.decisionId || null,
            state: episode.feedDecision.state || null,
            candidateState: episode.feedDecision.candidateState || null,
            confidence: Number(episode.feedDecision.confidence) || 0,
            loopScore: Number(episode.feedDecision.loopScore) || 0,
            reasons: Array.isArray(episode.feedDecision.reasons)
              ? [...episode.feedDecision.reasons]
              : [],
            metrics: episode.feedDecision.metrics
              && typeof episode.feedDecision.metrics === 'object'
              ? globalThis.structuredClone(episode.feedDecision.metrics)
              : null,
            readiness: {
              status: episode.feedDecision.readiness?.status || null,
              capability: episode.feedDecision.readiness?.capability || null,
            },
            actuationSafety: {
              status: episode.feedDecision.actuationSafety?.status || null,
              capability: episode.feedDecision.actuationSafety?.capability || null,
              reasons: Array.isArray(episode.feedDecision.actuationSafety?.reasons)
                ? [...episode.feedDecision.actuationSafety.reasons]
                : [],
            },
          }
          : null,
        admission: admission
          ? {
            status: admission.status || null,
            admitted: admission.admitted === true,
            feedLoad: Number(admission.feedLoad) || 0,
            pressure: Number(admission.pressure) || 0,
            confidence: Number(admission.confidence) || 0,
            reasons: Array.isArray(admission.reasons) ? [...admission.reasons] : [],
            surfaceGraceRemainingMs: Math.max(
              0,
              Number(admission.surfaceEntryGrace?.remainingMs) || 0,
            ),
            firstGraceRemainingMs: Math.max(
              0,
              Number(admission.spawnPolicy?.firstGraceRemainingMs) || 0,
            ),
            spawnPolicyReason: admission.spawnPolicy?.reason || null,
          }
          : null,
        detection: episode.detection && typeof episode.detection === 'object'
          ? globalThis.structuredClone(episode.detection)
          : null,
        endpoint: episode.endpoint
          ? {
            armed: episode.endpoint.armed === true,
            active: episode.endpoint.active === true,
            controlsLive: episode.endpoint.controlsLive === true,
            continueIntentPending: episode.endpoint.continueIntentPending === true,
            boundaryReached: episode.endpoint.boundaryReached === true,
            boundaryReachedAt: Math.max(
              0,
              Number(episode.endpoint.boundaryReachedAt) || 0,
            ),
            stillGateMs: episode.endpoint.stillGateMs === null
              ? null
              : Math.max(0, Number(episode.endpoint.stillGateMs) || 0),
            holdRemainingMs: Math.max(
              0,
              Number(episode.endpoint.holdRemainingMs) || 0,
            ),
            leaseState: episode.endpoint.leaseState || null,
            resolutionStatus: episode.endpoint.resolutionStatus || null,
            resolutionReasons: Array.isArray(episode.endpoint.resolutionReasons)
              ? [...episode.endpoint.resolutionReasons]
              : [],
            boundaryMotion: episode.endpoint.boundaryMotion
              ? {
                mode: episode.endpoint.boundaryMotion.mode || null,
                displacementPx: Math.max(
                  0,
                  Number(episode.endpoint.boundaryMotion.displacementPx) || 0,
                ),
                maximumDisplacementPx: Math.max(
                  0,
                  Number(episode.endpoint.boundaryMotion.maximumDisplacementPx) || 0,
                ),
                restTolerancePx: Math.max(
                  0,
                  Number(episode.endpoint.boundaryMotion.restTolerancePx) || 0,
                ),
                settling: episode.endpoint.boundaryMotion.settling === true,
                diagnostics: episode.endpoint.boundaryMotion.diagnostics
                  && typeof episode.endpoint.boundaryMotion.diagnostics === 'object'
                  ? {
                    observedDisplacementPx: Math.max(
                      0,
                      Number(
                        episode.endpoint.boundaryMotion.diagnostics.observedDisplacementPx,
                      ) || 0,
                    ),
                    velocityPxPerSecond: Number(
                      episode.endpoint.boundaryMotion.diagnostics.velocityPxPerSecond,
                    ) || 0,
                    lastInputAgeMs: Math.max(
                      0,
                      Number(episode.endpoint.boundaryMotion.diagnostics.lastInputAgeMs) || 0,
                    ),
                    lastFrameAgeMs: Math.max(
                      0,
                      Number(episode.endpoint.boundaryMotion.diagnostics.lastFrameAgeMs) || 0,
                    ),
                  }
                  : null,
              }
              : null,
          }
          : null,
        inspection: episode.inspection
          ? globalThis.structuredClone(episode.inspection)
          : null,
      }
      : null,
    dryRun: feedFlow?.dryRun
      ? {
        enabled: feedFlow.dryRun.enabled === true,
        phase: feedFlow.dryRun.phase || null,
        endpoint: feedFlow.dryRun.endpoint
          ? {
            armed: feedFlow.dryRun.endpoint.armed === true,
            active: feedFlow.dryRun.endpoint.active === true,
            controlsLive: feedFlow.dryRun.endpoint.controlsLive === true,
            continueIntentPending: feedFlow.dryRun.endpoint.continueIntentPending === true,
            boundaryReached: feedFlow.dryRun.endpoint.boundaryReached === true,
            leaseState: feedFlow.dryRun.endpoint.leaseState || null,
            resolutionStatus: feedFlow.dryRun.endpoint.resolutionStatus || null,
            resolutionReasons: Array.isArray(feedFlow.dryRun.endpoint.resolutionReasons)
              ? [...feedFlow.dryRun.endpoint.resolutionReasons]
              : [],
          }
          : null,
      }
      : null,
  };
}

function summarizeFeedRuntimeAvailability(payload) {
  const feedFlow = readFeedSnapshot(payload);
  const feature = payload?.latest?.protection?.features?.infiniteScrollGuard || null;
  return {
    feedFlowKeys: Object.keys(feedFlow).sort(),
    semanticAvailable: !!feedFlow.semantic,
    episodeAvailable: !!feedFlow.episode,
    featureAvailable: !!feature,
    featureActive: feature?.active === true,
    featureLoaded: feature?.loaded !== false,
    featureErrors: Math.max(0, Number(feature?.errorCount) || 0),
    debuggerErrorCount: Array.isArray(payload?.latest?.debugger?.errors)
      ? payload.latest.debugger.errors.length
      : 0,
  };
}

export function resolveDemandCaptureWaitBudgetMs(endpoint) {
  if (!endpoint || typeof endpoint !== 'object' || Array.isArray(endpoint)) {
    throw new Error('FEED_HORIZON_E2E_DEMAND_CAPTURE_ENDPOINT_REQUIRED');
  }
  if (endpoint.boundaryReached !== true) {
    throw new Error('FEED_HORIZON_E2E_DEMAND_CAPTURE_BOUNDARY_REQUIRED');
  }
  const stillGateMs = Number(endpoint.stillGateMs);
  const holdRemainingMs = Number(endpoint.holdRemainingMs);
  if (
    !Number.isSafeInteger(stillGateMs)
    || stillGateMs < 0
    || stillGateMs > DEMAND_CAPTURE_MAX_STILL_GATE_MS
  ) {
    throw new Error(
      `FEED_HORIZON_E2E_DEMAND_CAPTURE_STILL_GATE_INVALID:${String(endpoint.stillGateMs)}`,
    );
  }
  if (
    !Number.isSafeInteger(holdRemainingMs)
    || holdRemainingMs < 0
    || holdRemainingMs > stillGateMs
  ) {
    throw new Error(
      `FEED_HORIZON_E2E_DEMAND_CAPTURE_HOLD_REMAINING_INVALID:${String(
        endpoint.holdRemainingMs,
      )}`,
    );
  }
  return holdRemainingMs + DEMAND_CAPTURE_OBSERVATION_SLACK_MS;
}

function projectTrustedWheelScrollContext(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const numberOrNull = (candidate) => {
    if (
      candidate === null
      || candidate === undefined
      || candidate === ''
      || typeof candidate === 'boolean'
    ) return null;
    return Number.isFinite(Number(candidate)) ? Number(candidate) : null;
  };
  const tagNameOrNull = (candidate) => (
    typeof candidate === 'string' && /^[a-z][a-z0-9-]{0,31}$/u.test(candidate)
      ? candidate
      : null
  );
  const overflowOrOther = (candidate) => (
    ['auto', 'clip', 'hidden', 'other', 'overlay', 'scroll', 'visible'].includes(candidate)
      ? candidate
      : 'other'
  );
  return {
    pointSource: value.pointSource === 'selector' ? 'selector' : 'viewport',
    pointAvailable: value.pointAvailable === true,
    targetAvailable: value.targetAvailable === true,
    targetVisible: value.targetVisible === true,
    hitAvailable: value.hitAvailable === true,
    hitTagName: tagNameOrNull(value.hitTagName),
    hitInsideTarget: value.hitInsideTarget === true,
    hitInsideMain: value.hitInsideMain === true,
    scrollOwnerCandidateKind: value.scrollOwnerCandidateKind === 'element'
      ? 'element'
      : 'root',
    scrollOwnerCandidateTagName: tagNameOrNull(value.scrollOwnerCandidateTagName),
    scrollOwnerCandidateDepthFromHit: numberOrNull(value.scrollOwnerCandidateDepthFromHit),
    scrollOwnerCandidateIsTarget: value.scrollOwnerCandidateIsTarget === true,
    scrollOwnerCandidateIsMain: value.scrollOwnerCandidateIsMain === true,
    scrollOwnerCandidateMatchesBefore: value.scrollOwnerCandidateMatchesBefore === true,
    scrollOwnerCandidateScrollTop: numberOrNull(value.scrollOwnerCandidateScrollTop),
    scrollOwnerCandidateScrollHeight: numberOrNull(value.scrollOwnerCandidateScrollHeight),
    scrollOwnerCandidateClientHeight: numberOrNull(value.scrollOwnerCandidateClientHeight),
    scrollOwnerCandidateOverflowY: overflowOrOther(value.scrollOwnerCandidateOverflowY),
    scrollOwnerCandidateCanScrollForward: value.scrollOwnerCandidateCanScrollForward === true,
    rootScrollTop: numberOrNull(value.rootScrollTop),
    rootScrollHeight: numberOrNull(value.rootScrollHeight),
    rootClientHeight: numberOrNull(value.rootClientHeight),
    rootOverflowY: overflowOrOther(value.rootOverflowY),
    rootHasScrollRange: value.rootHasScrollRange === true,
    rootCanScrollForward: value.rootCanScrollForward === true,
    rootOverflowLocked: value.rootOverflowLocked === true,
    htmlOverflowY: overflowOrOther(value.htmlOverflowY),
    bodyOverflowY: overflowOrOther(value.bodyOverflowY),
    htmlOverflowLocked: value.htmlOverflowLocked === true,
    bodyOverflowLocked: value.bodyOverflowLocked === true,
    bodyPositionFixed: value.bodyPositionFixed === true,
    renderedDialogCount: numberOrNull(value.renderedDialogCount),
  };
}

function projectTrustedWheelScrollEvidence(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const numberOrNull = (candidate) => {
    if (
      candidate === null
      || candidate === undefined
      || candidate === ''
      || typeof candidate === 'boolean'
    ) return null;
    return Number.isFinite(Number(candidate)) ? Number(candidate) : null;
  };
  return {
    schemaVersion: value.schemaVersion === 1 ? 1 : null,
    state: ['before_only', 'measured', 'unavailable'].includes(value.state)
      ? value.state
      : 'unavailable',
    before: projectTrustedWheelScrollContext(value.before),
    after: projectTrustedWheelScrollContext(value.after),
    rootDelta: numberOrNull(value.rootDelta),
    scrollOwnerCandidateDelta: numberOrNull(value.scrollOwnerCandidateDelta),
    scrollOwnerCandidateComparable: value.scrollOwnerCandidateComparable === true,
  };
}

export function summarizeActionResult(result) {
  const opportunity = result?.opportunity || null;
  return {
    kind: result?.kind || null,
    stepId: result?.stepId || null,
    direction: result?.direction === 'backward' ? 'backward' : 'forward',
    status: result?.status || null,
    reason: result?.reason || null,
    trustedInput: result?.trustedInput === true,
    inputKind: result?.inputKind || null,
    deltaY: Number.isFinite(result?.deltaY) ? result.deltaY : null,
    scrollEvidence: projectTrustedWheelScrollEvidence(result?.scrollEvidence),
    opportunity: opportunity
      ? {
        state: opportunity.state || null,
        reason: opportunity.reason || null,
        durationMs: (
          Number.isFinite(Number(opportunity.finishedAt))
          && Number.isFinite(Number(opportunity.startedAt))
        )
          ? Math.max(0, Number(opportunity.finishedAt) - Number(opportunity.startedAt))
          : null,
        dominantChanged: opportunity.evidence?.dominantChanged === true,
        progressRatio: Number.isFinite(Number(opportunity.evidence?.progressRatio))
          ? Number(opportunity.evidence.progressRatio)
          : null,
        candidateDelta: Number.isFinite(Number(opportunity.evidence?.candidateDelta))
          ? Number(opportunity.evidence.candidateDelta)
          : null,
      }
      : null,
  };
}

export function classifyTrustedWheelPageBlocker(action) {
  const scrollEvidence = action?.scrollEvidence;
  const before = scrollEvidence?.before;
  const after = scrollEvidence?.after;
  const dialogPersisted = (
    Number(before?.renderedDialogCount) >= 1
    && Number(after?.renderedDialogCount) >= 1
  );
  const targetReady = (
    before?.pointAvailable === true
    && after?.pointAvailable === true
    && before?.targetAvailable === true
    && after?.targetAvailable === true
    && before?.targetVisible === true
    && after?.targetVisible === true
  );
  const overlayInterceptedTarget = (
    before?.hitInsideTarget === false
    && after?.hitInsideTarget === false
  );
  const scrollLockObserved = (
    before?.rootOverflowLocked === true
    || after?.rootOverflowLocked === true
    || before?.htmlOverflowLocked === true
    || after?.htmlOverflowLocked === true
    || before?.bodyOverflowLocked === true
    || after?.bodyOverflowLocked === true
    || before?.bodyPositionFixed === true
    || after?.bodyPositionFixed === true
  );
  const trustedForwardWheelStalled = (
    action?.kind === 'trusted_wheel'
    && action?.direction === 'forward'
    && action?.status === 'performed'
    && action?.trustedInput === true
    && action?.inputKind === 'wheel'
    && action?.opportunity?.state === 'armed_idle'
    && scrollEvidence?.schemaVersion === 1
    && scrollEvidence?.state === 'measured'
    && scrollEvidence?.rootDelta === 0
    && scrollEvidence?.scrollOwnerCandidateComparable === true
    && scrollEvidence?.scrollOwnerCandidateDelta === 0
  );
  if (
    !trustedForwardWheelStalled
    || !targetReady
    || !dialogPersisted
    || (!overlayInterceptedTarget && !scrollLockObserved)
  ) return null;
  return Object.freeze({
    status: 'blocked',
    reason: 'rendered_dialog_blocks_trusted_feed_scroll',
    evidence: Object.freeze({
      schemaVersion: 1,
      trustedInput: true,
      inputKind: 'wheel',
      direction: 'forward',
      opportunityState: 'armed_idle',
      targetAvailable: true,
      targetVisible: true,
      hitInsideTargetBefore: before.hitInsideTarget === true,
      hitInsideTargetAfter: after.hitInsideTarget === true,
      rootDelta: 0,
      scrollOwnerCandidateDelta: 0,
      scrollOwnerCandidateComparable: true,
      scrollOwnerCandidateKind: after.scrollOwnerCandidateKind,
      rootCanScrollForward: before.rootCanScrollForward === true,
      scrollOwnerCandidateCanScrollForward:
        before.scrollOwnerCandidateCanScrollForward === true,
      rootOverflowLocked: (
        before.rootOverflowLocked === true || after.rootOverflowLocked === true
      ),
      htmlOverflowLocked: (
        before.htmlOverflowLocked === true || after.htmlOverflowLocked === true
      ),
      bodyOverflowLocked: (
        before.bodyOverflowLocked === true || after.bodyOverflowLocked === true
      ),
      bodyPositionFixed: (
        before.bodyPositionFixed === true || after.bodyPositionFixed === true
      ),
      renderedDialogCountBefore: Math.min(20, Number(before.renderedDialogCount)),
      renderedDialogCountAfter: Math.min(20, Number(after.renderedDialogCount)),
    }),
  });
}

export function shouldRecoverUnavailableFeedInput(result) {
  return (
    result?.status === 'unavailable'
    && result?.reason === 'feed_oracle_not_ready'
    && result?.trustedInput !== true
  );
}

export function resolveFeedStepSupplementalDwellMs(requestedDwellMs) {
  const requested = Math.max(0, Number(requestedDwellMs) || 0);
  const delegated = Math.max(50, Math.min(2_000, requested || 350));
  return Math.max(0, Math.round(requested - delegated));
}

function resolvePagedTrustedInputTargetSelector(siteId) {
  if (siteId === 'youtube') return '#shorts-container';
  if (siteId === 'instagram') {
    return 'main[role="main"] > div:first-child';
  }
  return null;
}

export function createTrustedFeedAction(index, dwellMs, {
  collectOracle = true,
  siteId = 'tiktok',
  surfaceMode = 'paged',
  direction = 'forward',
} = {}) {
  if (direction !== 'forward' && direction !== 'backward') {
    throw new Error(`FEED_HORIZON_E2E_DIRECTION_INVALID:${String(direction)}`);
  }
  const phase = index % 5;
  const common = {
    lane: 'diagnostic',
    feedStepId: `feed-horizon-step-${String(index + 1).padStart(3, '0')}`,
    minimumDwellMs: dwellMs,
    requiresTrustedGesture: true,
    direction,
    collectScrollEvidence: true,
    ...(surfaceMode === 'paged' ? { scrollPageRatio: 0.9 } : {}),
  };
  if (surfaceMode === 'paged') {
    const targetSelector = resolvePagedTrustedInputTargetSelector(siteId);
    return {
      ...common,
      kind: 'trusted_wheel',
      ...(targetSelector ? { targetSelector } : {}),
    };
  }
  if (surfaceMode === 'continuous') {
    return {
      ...common,
      kind: 'trusted_wheel',
      ...(siteId === 'instagram'
        ? {
          targetSelector: 'main[role="main"] div:has(> article)',
        }
        : {}),
      maximumDeltaY: collectOracle ? 900 : 1_800,
    };
  }
  if (phase === 2) {
    return {
      ...common,
      kind: 'trusted_key_scroll',
      key: direction === 'backward' ? 'PageUp' : 'PageDown',
    };
  }
  if (phase === 4) {
    return { ...common, kind: 'trusted_touch_swipe', travelY: 620 };
  }
  return {
    ...common,
    kind: 'trusted_wheel',
    maximumDeltaY: collectOracle ? (phase === 1 ? 1_500 : 1_050) : 1_800,
  };
}

export function createTrustedFeedRecoveryAction(primaryAction, {
  siteId,
  surfaceMode,
} = {}) {
  if (
    siteId !== 'tiktok'
    || surfaceMode !== 'paged'
    || primaryAction?.kind !== 'trusted_wheel'
  ) return null;
  return Object.freeze({
    ...primaryAction,
    kind: 'trusted_key_scroll',
    key: primaryAction.direction === 'backward' ? 'ArrowUp' : 'ArrowDown',
  });
}

export async function runTrustedFeedStep({
  harness,
  page,
  scenario,
  index,
  dwellMs,
  collectOracle = true,
  direction = 'forward',
}) {
  const action = createTrustedFeedAction(index, dwellMs, {
    collectOracle,
    siteId: scenario?.siteId,
    surfaceMode: scenario?.feedConsumption?.surfaceMode,
    direction,
  });
  const [result] = await runScenarioActions(
    harness,
    page,
    scenario,
    [action],
    { collectFeedOracle: collectOracle },
  );
  const summary = summarizeActionResult(result);
  let completed = summary;
  const stalledInputRecovery = collectOracle
    && summary.opportunity?.state === 'armed_idle'
    ? createTrustedFeedRecoveryAction(action, {
      siteId: scenario?.siteId,
      surfaceMode: scenario?.feedConsumption?.surfaceMode,
    })
    : null;
  if (stalledInputRecovery) {
    const [recovery] = await runScenarioActions(
      harness,
      page,
      scenario,
      [stalledInputRecovery],
      { collectFeedOracle: true },
    );
    completed = {
      ...summarizeActionResult(recovery),
      oracleRecovery: {
        status: 'attempted',
        reason: 'primary_input_did_not_advance',
        primaryInputKind: summary.inputKind,
        primaryOpportunity: summary.opportunity,
      },
    };
  } else if (collectOracle && shouldRecoverUnavailableFeedInput(result)) {
    const [recovery] = await runScenarioActions(
      harness,
      page,
      scenario,
      [action],
      { collectFeedOracle: false },
    );
    completed = {
      ...summarizeActionResult(recovery),
      opportunity: summary.opportunity,
      oracleRecovery: {
        status: 'performed',
        reason: 'trusted_input_dispatched_without_oracle_score',
        primaryInputKind: summary.inputKind,
        primaryOpportunity: summary.opportunity,
      },
    };
  }
  const supplementalDwellMs = completed.trustedInput
    ? resolveFeedStepSupplementalDwellMs(dwellMs)
    : 0;
  if (supplementalDwellMs > 0) await sleep(supplementalDwellMs);
  return {
    direction,
    ...completed,
    dwell: {
      requestedMs: Math.max(0, Number(dwellMs) || 0),
      supplementalMs: supplementalDwellMs,
    },
  };
}

export function createTrustedEndpointAction(index, {
  phase = 'boundary',
  dwellMs = 100,
  siteId = 'tiktok',
  surfaceMode = 'paged',
} = {}) {
  const common = {
    lane: 'diagnostic',
    feedStepId: `feed-horizon-endpoint-${String(index + 1).padStart(3, '0')}`,
    minimumDwellMs: dwellMs,
    requiresTrustedGesture: true,
  };
  if (phase === 'boundary') {
    if (siteId === 'youtube' && surfaceMode === 'paged') {
      return {
        ...common,
        kind: 'trusted_wheel',
        targetSelector: resolvePagedTrustedInputTargetSelector(siteId),
        maximumDeltaY: 1_800,
      };
    }
    if (siteId === 'instagram' && surfaceMode === 'paged') {
      return {
        ...common,
        kind: 'trusted_wheel',
        targetSelector: resolvePagedTrustedInputTargetSelector(siteId),
        maximumDeltaY: 900,
      };
    }
    if (surfaceMode === 'continuous') {
      return {
        ...common,
        kind: 'trusted_key_scroll',
        key: 'PageDown',
      };
    }
    return {
      ...common,
      kind: 'trusted_key_scroll',
      key: 'PageDown',
    };
  }
  if (phase === 'demand') {
    if (surfaceMode === 'continuous') {
      return {
        ...common,
        kind: 'trusted_wheel',
        maximumDeltaY: 1_800,
      };
    }
    const targetSelector = resolvePagedTrustedInputTargetSelector(siteId);
    return {
      ...common,
      kind: 'trusted_wheel',
      ...(targetSelector ? { targetSelector } : {}),
      maximumDeltaY: 1_800,
    };
  }
  throw new Error(`FEED_HORIZON_E2E_ENDPOINT_PHASE_INVALID:${String(phase)}`);
}

export async function runTrustedEndpointForwardStep({
  harness,
  page,
  scenario,
  index,
  dwellMs = 100,
  phase = 'boundary',
}) {
  const [result] = await runScenarioActions(
    harness,
    page,
    scenario,
    [createTrustedEndpointAction(index, {
      phase,
      dwellMs,
      siteId: scenario?.siteId,
      surfaceMode: scenario?.feedConsumption?.surfaceMode,
    })],
    { collectFeedOracle: false },
  );
  return {
    ...summarizeActionResult(result),
    dwell: {
      requestedMs: dwellMs,
      supplementalMs: 0,
    },
  };
}

export async function readEndpointMorphology(harness, page) {
  return evaluate(harness.cdp, page.sessionId, `(() => {
    const isTransparent = (value) => {
      const normalized = String(value || '').replace(/\\s+/g, '').toLowerCase();
      return !normalized
        || normalized === 'transparent'
        || normalized === 'rgba(0,0,0,0)'
        || normalized === 'hsla(0,0%,0%,0)';
    };
    const marker = document.getElementById('entropy-feed-endpoint-marker');
    const tail = document.getElementById('entropy-feed-endpoint-tail');
    const quarantine = document.getElementById('entropy-feed-endpoint-quarantine');
    const host = document.getElementById('entropy-feed-terminus');
    const gate = document.querySelector('.friction-click-enso-gate');
    const youtubeForwardControl = document.querySelector(
      'ytd-shorts #navigation-button-down button',
    );
    const youtubeForwardControlStyle = youtubeForwardControl
      ? getComputedStyle(youtubeForwardControl)
      : null;
    const instagramForwardControl = document.querySelector(
      'main[role="main"] > [role="toolbar"] > [role="button"]:nth-child(2):last-child',
    );
    const instagramForwardControlStyle = instagramForwardControl
      ? getComputedStyle(instagramForwardControl)
      : null;
    const rect = tail?.getBoundingClientRect?.() || null;
    const style = tail ? getComputedStyle(tail) : null;
    const shell = host?.shadowRoot?.querySelector?.('.host') || null;
    const visibleShellTextLength = (() => {
      if (!shell) return 0;
      const clone = shell.cloneNode(true);
      // The endpoint is diegetic: the screen-reader status line and the two
      // sanctioned Zen phrase nodes are the only text it is allowed to carry.
      // Excluding them by their declared identity hooks keeps this measuring
      // what the check is named for -- product chrome leaking into the shell.
      clone.querySelectorAll?.(
        '.sr-only, [data-k="phrase-title"], [data-k="phrase-subtitle"]',
      ).forEach((element) => element.remove());
      return String(clone.textContent || '').trim().length;
    })();
    const viewportWidth = Math.max(1, window.innerWidth || document.documentElement.clientWidth || 1);
    const viewportHeight = Math.max(1, window.innerHeight || document.documentElement.clientHeight || 1);
    const declaredYoutubeLane = document.querySelector('#shorts-inner-container');
    const instagramReelsRoute = /^\\/(?:reels?|explore\\/reels)(?:\\/|$)/i.test(
      location.pathname,
    );
    const declaredInstagramLane = (
      location.hostname === 'www.instagram.com'
      && instagramReelsRoute
    )
      ? document.querySelector('main[role="main"] > div:first-child')
      : null;
    const lane = marker?.parentElement
      || declaredYoutubeLane
      || declaredInstagramLane
      || null;
    const youtubeRenderer = lane?.querySelector?.('ytd-reel-video-renderer') || null;
    const instagramVideoBranch = declaredInstagramLane
      ? Array.from(declaredInstagramLane.children).find(
        (element) => element.matches?.('div') && element.querySelector?.('video'),
      ) || null
      : null;
    const anchor = marker?.previousElementSibling
      || youtubeRenderer?.closest?.('div.reel-video-in-sequence-new')
      || instagramVideoBranch
      || null;
    const laneStyle = lane ? getComputedStyle(lane) : null;
    const parsedLaneRowGap = Number.parseFloat(laneStyle?.rowGap || '');
    const laneRowGapPx = Number.isFinite(parsedLaneRowGap)
      ? Math.max(0, parsedLaneRowGap)
      : 0;
    const laneRect = lane?.getBoundingClientRect?.() || null;
    const anchorRect = anchor?.getBoundingClientRect?.() || null;
    const youtubeSequenceBranches = lane
      ? Array.from(lane.children).filter(
        (element) => element.matches?.('div.reel-video-in-sequence-new'),
      )
      : [];
    const instagramNativeBranches = declaredInstagramLane
      ? Array.from(declaredInstagramLane.children).filter((element) => (
        element.matches?.('div')
        && ![
          'entropy-feed-endpoint-marker',
          'entropy-feed-endpoint-tail',
          'entropy-feed-endpoint-quarantine',
          'entropy-feed-terminus',
        ].includes(element.id)
      ))
      : [];
    const instagramSnapBranches = instagramNativeBranches.filter((element) => (
      String(getComputedStyle(element).scrollSnapAlign || '').split(/\\s+/).includes('start')
    ));
    const instagramMain = declaredInstagramLane?.parentElement?.matches?.('main[role="main"]')
      ? declaredInstagramLane.parentElement
      : null;
    const instagramOutsideLaneSiblings = instagramMain
      ? Array.from(instagramMain.children).filter(
        (element) => element !== declaredInstagramLane,
      )
      : [];
    const isolatedElements = Array.from(document.querySelectorAll(
      '[data-entropy-feed-endpoint-isolated="true"]',
    ));
    const endpointTopologyId = tail?.dataset?.entropyFeedEndpointTopology || null;
    const matchesContinuousBranch = (element) => {
      if (!(element instanceof Element)) return false;
      if (endpointTopologyId === 'x_home_virtual_timeline_lane') {
        return element.matches('div[data-testid="cellInnerDiv"]');
      }
      if (endpointTopologyId === 'instagram_home_article_lane') {
        return element.matches('main[role="main"] article');
      }
      if (endpointTopologyId === 'facebook_home_article_lane') {
        return !!element.querySelector?.('[role="article"]');
      }
      if (endpointTopologyId === 'youtube_home_rich_grid_lane') {
        return element.matches(
          ':is(ytd-rich-item-renderer, ytd-rich-section-renderer, '
            + 'ytd-continuation-item-renderer)',
        );
      }
      return false;
    };
    const continuousNativeBranches = lane
      ? Array.from(lane.children).filter(matchesContinuousBranch)
      : [];
    const youtubeHomeAnchorRow = (
      endpointTopologyId === 'youtube_home_rich_grid_lane'
      && anchor
      && anchorRect
      && lane
    )
      ? Array.from(lane.children).filter((element) => {
        if (!element.matches?.('ytd-rich-item-renderer')) return false;
        const candidateRect = element.getBoundingClientRect();
        return Math.abs(candidateRect.top - anchorRect.top) <= 2;
      })
      : [];
    const youtubeHomeAnchorRowMetrics = youtubeHomeAnchorRow.map((element) => {
      const candidateRect = element.getBoundingClientRect();
      const candidateStyle = getComputedStyle(element);
      const parsedMarginBottom = Number.parseFloat(candidateStyle.marginBottom || '');
      const marginBottomPx = Number.isFinite(parsedMarginBottom)
        ? parsedMarginBottom
        : 0;
      return {
        bottom: candidateRect.bottom,
        marginBottomPx,
        flowBottom: candidateRect.bottom + marginBottomPx,
      };
    });
    const youtubeHomeRowFlowEdge = youtubeHomeAnchorRowMetrics.length > 0
      ? Math.max(
        ...youtubeHomeAnchorRowMetrics.map((metric) => metric.flowBottom),
      ) + laneRowGapPx
      : null;
    const collapsedIsolationStateEnforcedCount = isolatedElements.filter((element) => (
      element.getAttribute('data-entropy-feed-endpoint-isolation-layout') === 'collapse'
      && getComputedStyle(element).display === 'none'
      && element.inert === true
      && element.getAttribute('aria-hidden') === 'true'
    )).length;
    const preservedIsolationStateEnforcedCount = isolatedElements.filter((element) => (
      element.getAttribute('data-entropy-feed-endpoint-isolation-layout') === 'preserve'
      && getComputedStyle(element).display !== 'none'
      && getComputedStyle(element).visibility === 'hidden'
      && element.inert === true
      && element.getAttribute('aria-hidden') === 'true'
    )).length;
    const isolatedStateEnforcedCount = (
      collapsedIsolationStateEnforcedCount
      + preservedIsolationStateEnforcedCount
    );
    const nativePaint = (() => {
      let cursor = lane;
      while (cursor instanceof Element) {
        const candidate = getComputedStyle(cursor).backgroundColor;
        if (!isTransparent(candidate)) {
          return {
            backgroundColor: candidate,
            sourceTagName: cursor.tagName,
          };
        }
        cursor = cursor.parentElement;
      }
      return {
        backgroundColor: 'rgba(0, 0, 0, 0)',
        sourceTagName: null,
      };
    })();
    const scroller = (() => {
      const declaredYoutubeScroller = lane?.closest?.('#shorts-container') || null;
      if (declaredYoutubeScroller) return declaredYoutubeScroller;
      if (declaredInstagramLane) return declaredInstagramLane;
      let cursor = lane;
      while (cursor && cursor !== document.body) {
        const candidateStyle = getComputedStyle(cursor);
        if (
          /(auto|scroll|overlay)/.test(candidateStyle.overflowY)
          && cursor.scrollHeight > cursor.clientHeight + 1
        ) return cursor;
        cursor = cursor.parentElement;
      }
      return document.scrollingElement;
    })();
    const scrollerStyle = scroller ? getComputedStyle(scroller) : null;
    const endpointViewportHeight = Math.max(
      1,
      Number(scroller?.clientHeight)
        || Number(scroller?.getBoundingClientRect?.()?.height)
        || viewportHeight,
    );
    return {
      path: location.pathname,
      timeOrigin: Math.round(performance.timeOrigin),
      readyState: document.readyState,
      visibilityState: document.visibilityState,
      markerCount: document.querySelectorAll('#entropy-feed-endpoint-marker').length,
      tailCount: document.querySelectorAll('#entropy-feed-endpoint-tail').length,
      quarantineCount: document.querySelectorAll('#entropy-feed-endpoint-quarantine').length,
      terminusCount: document.querySelectorAll('#entropy-feed-terminus').length,
      gateCount: document.querySelectorAll('.friction-click-enso-gate').length,
      exactOrder: !!(
        marker
        && tail
        && quarantine
        && marker.parentNode === tail.parentNode
        && tail.parentNode === quarantine.parentNode
        && marker.nextSibling === tail
        && tail.nextSibling === quarantine
      ),
      adapterId: tail?.dataset?.entropyFeedEndpointAdapter || null,
      profileId: tail?.dataset?.entropyFeedEndpointProfile || null,
      semanticSurfaceId:
        tail?.dataset?.entropyFeedEndpointSemanticSurface || null,
      boundaryBasis:
        tail?.dataset?.entropyFeedEndpointBoundaryBasis || null,
      completedWrapRowItemCount: Math.max(
        0,
        Number(tail?.dataset?.entropyFeedEndpointCompletedWrapRowItemCount) || 0,
      ),
      surfaceMode: tail?.dataset?.entropyFeedEndpointSurfaceMode || null,
      boundaryMotionMode: tail?.dataset?.entropyFeedEndpointMotion || null,
      boundaryMotionEndpointEdge:
        tail?.dataset?.entropyFeedEndpointEdge || null,
      boundaryRevealPx: Number(tail?.dataset?.entropyFeedEndpointReveal),
      boundaryMotionMaximumDisplacementPx: Math.max(
        0,
        Number(tail?.dataset?.entropyFeedEndpointMaximumDisplacement) || 0,
      ),
      topologyId: endpointTopologyId,
      tailLayout: tail?.dataset?.entropyFeedEndpointTailLayout || null,
      tailPaintMode: tail?.dataset?.entropyFeedEndpointTailPaint || null,
      mutationMode: quarantine?.dataset?.entropyFeedEndpointMutationMode || null,
      quarantineChildCount: quarantine?.childNodes?.length || 0,
      isolatedElementCount: isolatedElements.length,
      isolatedStateEnforcedCount,
      collapsedIsolationStateEnforcedCount,
      preservedIsolationStateEnforcedCount,
      isolatedInNativeLaneCount: isolatedElements.filter(
        (element) => element.parentNode === lane,
      ).length,
      isolatedOutsideNativeLaneCount: isolatedElements.filter(
        (element) => element.parentNode !== lane,
      ).length,
      continuousNativeBranchCount: continuousNativeBranches.length,
      continuousIsolatedBranchCount: isolatedElements.filter(
        (element) => element.parentNode === lane && matchesContinuousBranch(element),
      ).length,
      continuousIsolatedNonBranchCount: isolatedElements.filter(
        (element) => element.parentNode === lane && !matchesContinuousBranch(element),
      ).length,
      continuousPreservedGeometryCount: isolatedElements.filter((element) => {
        if (
          element.parentNode !== lane
          || !matchesContinuousBranch(element)
          || element.getAttribute('data-entropy-feed-endpoint-isolation-layout') !== 'preserve'
        ) return false;
        const branchRect = element.getBoundingClientRect();
        return branchRect.width > 0 && branchRect.height > 0;
      }).length,
      continuousTopologyExact: (
        endpointTopologyId === 'x_home_virtual_timeline_lane'
          ? (
            lane?.matches?.(
              '[data-testid="primaryColumn"] section[role="region"] > div[aria-label] > div'
            ) === true
            && scroller === document.scrollingElement
          )
          : endpointTopologyId === 'instagram_home_article_lane'
            ? (
              lane?.matches?.('main[role="main"] div:has(> article)') === true
              && scroller === document.scrollingElement
            )
            : endpointTopologyId === 'facebook_home_article_lane'
              ? (
                lane?.matches?.(
                  '[role="main"] [role="feed"] > div:has(> div [role="article"])'
                ) === true
                && document.documentElement.id === 'facebook'
                && scroller === document.scrollingElement
              )
              : endpointTopologyId === 'youtube_home_rich_grid_lane'
                ? (
                  lane?.matches?.('ytd-rich-grid-renderer #contents') === true
                  && laneStyle?.display === 'flex'
                  && String(laneStyle?.flexDirection || '').startsWith('row')
                  && String(laneStyle?.flexWrap || '').includes('wrap')
                  && scroller === document.scrollingElement
                )
                : false
      ),
      youtubeHomeCompletedRowBoundary: (
        youtubeHomeAnchorRow.length > 0
        && youtubeHomeAnchorRow.at(-1) === anchor
        && tail?.dataset?.entropyFeedEndpointBoundaryBasis
          === 'completed_wrap_row_edge'
        && Number(tail?.dataset?.entropyFeedEndpointCompletedWrapRowItemCount)
          === youtubeHomeAnchorRow.length
        && Number.isFinite(youtubeHomeRowFlowEdge)
        && rect
        && Math.abs(rect.top - youtubeHomeRowFlowEdge) <= 2
      ),
      youtubeHomeAnchorRowItemCount: youtubeHomeAnchorRow.length,
      youtubeHomeAnchorRowMetrics: youtubeHomeAnchorRowMetrics.map((metric) => ({
        bottom: Math.round(metric.bottom),
        marginBottomPx: metric.marginBottomPx,
        flowBottom: Math.round(metric.flowBottom),
      })),
      youtubeSequenceBranchCount: youtubeSequenceBranches.length,
      youtubeRendererCount: lane?.querySelectorAll?.('ytd-reel-video-renderer')?.length || 0,
      youtubeActiveSequenceBranchIndex: youtubeSequenceBranches.indexOf(anchor),
      youtubeSequenceBranches: youtubeSequenceBranches.slice(0, 16).map((element, index) => {
        const branchRect = element.getBoundingClientRect();
        const branchStyle = getComputedStyle(element);
        return {
          index,
          hasRenderer: element.contains(youtubeRenderer),
          top: Math.round(branchRect.top),
          bottom: Math.round(branchRect.bottom),
          width: Math.round(branchRect.width),
          height: Math.round(branchRect.height),
          display: branchStyle.display,
          position: branchStyle.position,
          transform: branchStyle.transform,
          snapAlign: branchStyle.scrollSnapAlign,
          inert: element.inert === true,
          ariaHidden: element.getAttribute('aria-hidden'),
        };
      }),
      youtubeIsolatedSequenceBranchCount: isolatedElements.filter(
        (element) => (
          element.parentNode === lane
          && element.matches?.('div.reel-video-in-sequence-new')
        ),
      ).length,
      youtubeIsolatedNonSequenceCount: isolatedElements.filter(
        (element) => !element.matches?.('div.reel-video-in-sequence-new'),
      ).length,
      youtubeControlNodeCount: lane
        ? Array.from(lane.children).filter(
          (element) => ['DOM-IF', 'DOM-REPEAT'].includes(element.tagName),
        ).length
        : 0,
      youtubeIsolatedControlNodeCount: isolatedElements.filter(
        (element) => ['DOM-IF', 'DOM-REPEAT'].includes(element.tagName),
      ).length,
      youtubeForwardControl: youtubeForwardControl ? {
        connected: youtubeForwardControl.isConnected === true,
        disabled: youtubeForwardControl.disabled === true,
        ariaDisabled: youtubeForwardControl.getAttribute('aria-disabled'),
        terminalMarker: youtubeForwardControl.getAttribute(
          'data-entropy-feed-endpoint-forward-control',
        ),
        opacity: youtubeForwardControlStyle?.opacity || null,
        cursor: youtubeForwardControlStyle?.cursor || null,
        filter: youtubeForwardControlStyle?.filter || null,
      } : null,
      instagramNativeBranchCount: instagramNativeBranches.length,
      instagramSnapBranchCount: instagramSnapBranches.length,
      instagramActiveSnapBranchIndex: instagramSnapBranches.indexOf(anchor),
      instagramSnapBranches: instagramSnapBranches.slice(0, 16).map((element, index) => {
        const branchRect = element.getBoundingClientRect();
        const branchStyle = getComputedStyle(element);
        return {
          index,
          hasVideo: !!element.querySelector?.('video'),
          top: Math.round(branchRect.top),
          bottom: Math.round(branchRect.bottom),
          width: Math.round(branchRect.width),
          height: Math.round(branchRect.height),
          display: branchStyle.display,
          snapAlign: branchStyle.scrollSnapAlign,
          inert: element.inert === true,
          ariaHidden: element.getAttribute('aria-hidden'),
        };
      }),
      instagramIsolatedSnapBranchCount: isolatedElements.filter(
        (element) => (
          element.parentNode === declaredInstagramLane
          && instagramSnapBranches.includes(element)
        ),
      ).length,
      instagramPreservedSnapGeometryCount: isolatedElements.filter((element) => {
        if (
          element.parentNode !== declaredInstagramLane
          || !instagramSnapBranches.includes(element)
          || element.getAttribute('data-entropy-feed-endpoint-isolation-layout') !== 'preserve'
        ) return false;
        const branchRect = element.getBoundingClientRect();
        return branchRect.width > 0 && branchRect.height > 0;
      }).length,
      instagramIsolatedNonSnapCount: isolatedElements.filter(
        (element) => (
          element.parentNode === declaredInstagramLane
          && !instagramSnapBranches.includes(element)
        ),
      ).length,
      instagramScrollerExact: (
        !!declaredInstagramLane
        && scroller === declaredInstagramLane
        && /^(auto|scroll|overlay)$/.test(scrollerStyle?.overflowY || '')
      ),
      instagramAllBranchesSnapAligned: (
        instagramNativeBranches.length > 0
        && instagramSnapBranches.length === instagramNativeBranches.length
      ),
      instagramOutsideLaneSiblingCount: instagramOutsideLaneSiblings.length,
      instagramIsolatedOutsideLaneSiblingCount: isolatedElements.filter(
        (element) => instagramOutsideLaneSiblings.includes(element),
      ).length,
      instagramForwardControl: instagramForwardControl ? {
        connected: instagramForwardControl.isConnected === true,
        role: instagramForwardControl.getAttribute('role'),
        ariaDisabled: instagramForwardControl.getAttribute('aria-disabled'),
        tabIndex: instagramForwardControl.getAttribute('tabindex'),
        terminalMarker: instagramForwardControl.getAttribute(
          'data-entropy-feed-endpoint-forward-control',
        ),
        opacity: instagramForwardControlStyle?.opacity || null,
        cursor: instagramForwardControlStyle?.cursor || null,
        filter: instagramForwardControlStyle?.filter || null,
      } : null,
      tail: rect ? {
        left: Math.round(rect.left),
        right: Math.round(rect.right),
        top: Math.round(rect.top),
        bottom: Math.round(rect.bottom),
        width: Math.round(rect.width),
        height: Math.round(rect.height),
        widthRatio: Number((rect.width / viewportWidth).toFixed(4)),
        heightRatio: Number((rect.height / endpointViewportHeight).toFixed(4)),
        backgroundColor: style?.backgroundColor || null,
        color: style?.color || null,
        overflow: style?.overflow || null,
        position: style?.position || null,
        flexBasis: style?.flexBasis || null,
        snapAlign: style?.scrollSnapAlign || null,
        startsAfterAnchor: anchorRect ? rect.top >= anchorRect.bottom - 2 : false,
        laneWidthAligned: laneRect
          ? (
            Math.abs(rect.width - laneRect.width) <= Math.max(8, laneRect.width * 0.02)
            && Math.abs(rect.left - laneRect.left) <= Math.max(8, laneRect.width * 0.02)
          )
          : false,
        anchorWidthAligned: anchorRect
          ? (
            Math.abs(rect.width - anchorRect.width) <= Math.max(8, anchorRect.width * 0.02)
            && Math.abs(rect.left - anchorRect.left) <= Math.max(8, anchorRect.width * 0.02)
          )
          : false,
        paintMatchesNative: (
          (
            tail?.dataset?.entropyFeedEndpointTailPaint
              === 'transparent_native_bleed'
            && isTransparent(style?.backgroundColor)
          )
          || style?.backgroundColor === nativePaint.backgroundColor
        ),
      } : null,
      nativeLane: lane && laneRect ? {
        tagName: lane.tagName,
        childCount: lane.childNodes.length,
        top: Math.round(laneRect.top),
        bottom: Math.round(laneRect.bottom),
        width: Math.round(laneRect.width),
        display: laneStyle?.display || null,
        flexDirection: laneStyle?.flexDirection || null,
        flexWrap: laneStyle?.flexWrap || null,
        rowGap: laneStyle?.rowGap || null,
        rowGapPx: laneRowGapPx,
        position: laneStyle?.position || null,
        backgroundColor: laneStyle?.backgroundColor || null,
      } : null,
      nativePaint,
      nativeAnchor: anchor && anchorRect ? {
        tagName: anchor.tagName,
        top: Math.round(anchorRect.top),
        bottom: Math.round(anchorRect.bottom),
        width: Math.round(anchorRect.width),
        height: Math.round(anchorRect.height),
        connected: anchor.isConnected === true,
      } : null,
      nativeScroller: scroller ? {
        tagName: scroller.tagName,
        rootLike: scroller === document.scrollingElement
          || scroller === document.documentElement
          || scroller === document.body,
        viewportTop: Math.round(
          scroller === document.scrollingElement
            || scroller === document.documentElement
            || scroller === document.body
            ? 0
            : scroller.getBoundingClientRect().top,
        ),
        scrollTop: Math.round(scroller.scrollTop || window.scrollY || 0),
        scrollHeight: Math.round(scroller.scrollHeight || 0),
        clientHeight: Math.round(scroller.clientHeight || viewportHeight),
        overflowY: scrollerStyle?.overflowY || null,
        scrollSnapType: scrollerStyle?.scrollSnapType || null,
      } : null,
      shell: shell ? {
        engaged: shell.dataset.engaged || null,
        controls: shell.dataset.controls || null,
        visibleTextLength: visibleShellTextLength,
        ariaHidden: shell.getAttribute('aria-hidden'),
      } : null,
      viewport: {
        width: viewportWidth,
        height: viewportHeight,
        endpointHeight: Math.round(endpointViewportHeight),
      },
      pageCandidateCount: document.querySelectorAll(
        '[data-e2e="recommend-list-item-container"], [data-e2e*="feed-item" i], '
          + 'ytd-reel-video-renderer, #shorts-inner-container > div.reel-video-in-sequence-new, '
          + 'ytd-rich-grid-renderer #contents > ytd-rich-item-renderer:has(yt-lockup-view-model), '
          + 'main article[data-testid="tweet"], main[role="main"] article, '
          + '[role="main"] [role="feed"] [role="article"], '
          + 'main[role="main"] > div:first-child > div, video'
      ).length,
      scrollY: Math.max(0, Math.round(window.scrollY || document.scrollingElement?.scrollTop || 0)),
      gate: gate ? {
        zone: gate.dataset.zone || null,
        entry: gate.dataset.entry || null,
        ariaHidden: gate.getAttribute('aria-hidden'),
      } : null,
    };
  })()`);
}

export function classifyNativeEndpointMorphology(morphology) {
  const paged = morphology?.surfaceMode === 'paged';
  const motionMode = morphology?.boundaryMotionMode;
  const endpointEdge = morphology?.boundaryMotionEndpointEdge;
  const maximumDisplacementPx = Math.max(
    0,
    Number(morphology?.boundaryMotionMaximumDisplacementPx) || 0,
  );
  const continuousMotionDeclared = paged || (
    endpointEdge === 'tail_start'
    && (
      (motionMode === 'elastic_tail' && maximumDisplacementPx > 0)
      || (motionMode === 'exact_boundary' && maximumDisplacementPx === 0)
    )
  );
  const pagedMotionDeclared = !paged || (
    endpointEdge === 'tail_start'
    && (
      (motionMode === 'terminal_snap' && maximumDisplacementPx > 0)
      || (motionMode === 'exact_boundary' && maximumDisplacementPx === 0)
    )
  );
  const pagedRestTolerancePx = Math.max(
    3,
    (maximumDisplacementPx * 0.1) + 2,
  );
  const height = Number(morphology?.viewport?.endpointHeight);
  const expectedReveal = Math.min(height * 0.4, Math.min(224, Math.max(176, Math.round(height * 0.26))));
  const revealDeclared = morphology?.boundaryRevealPx === expectedReveal;
  const restEdge = Number(morphology?.nativeScroller?.viewportTop) + height - expectedReveal;
  const pagedAnchorAtRestEdge = !paged || (
    Number.isFinite(Number(morphology?.tail?.top))
    && Math.abs(Number(morphology.tail.top) - restEdge) <= pagedRestTolerancePx
  );
  const continuousTailWithinMotionEnvelope = paged || (
    continuousMotionDeclared
    && Number.isFinite(Number(morphology?.tail?.top))
    && Number.isFinite(Number(morphology?.viewport?.endpointHeight))
    && Number(morphology.tail.top)
      <= restEdge + 3
    && Number(morphology.tail.top)
      >= restEdge - maximumDisplacementPx - 3
  );
  const checks = {
    singletonArtifacts: [
      morphology?.markerCount,
      morphology?.tailCount,
      morphology?.quarantineCount,
      morphology?.terminusCount,
    ].every((count) => count === 1),
    exactNativeOrder: morphology?.exactOrder === true,
    viewportSizedTail: Number(morphology?.tail?.heightRatio) >= 1,
    nativeItemWidthAligned: (
      morphology?.tail?.laneWidthAligned === true
      || morphology?.tail?.anchorWidthAligned === true
    ),
    followsNativeAnchor: morphology?.tail?.startsAfterAnchor === true,
    nativePaintMatched: morphology?.tail?.paintMatchesNative === true,
    tailPaintModeDeclared: paged
      ? morphology?.tailPaintMode === 'transparent_native_bleed'
      : morphology?.tailPaintMode === 'inherited_opaque',
    tailLayoutDeclared: ['flow', 'absolute_anchor_edge', 'wrapped_row_flow'].includes(
      morphology?.tailLayout,
    ),
    pagedSnapPreserved: !paged || morphology?.tail?.snapAlign === 'start',
    continuousMotionDeclared,
    pagedMotionDeclared,
    revealDeclared,
    pagedAnchorAtRestEdge,
    continuousTailWithinMotionEnvelope,
    silentProductSurface: morphology?.shell?.visibleTextLength === 0,
  };
  return {
    status: Object.values(checks).every(Boolean) ? 'PASS' : 'FAIL',
    checks,
  };
}

export function classifyContinuousEndpointIsolation(morphology, siteId) {
  const isolatedCount = Math.max(0, Number(morphology?.isolatedElementCount) || 0);
  const expected = {
    x: {
      adapterId: 'x_home_timeline_tail',
      semanticSurfaceId: 'x:home',
      topologyId: 'x_home_virtual_timeline_lane',
      tailLayout: 'absolute_anchor_edge',
    },
    instagram: {
      adapterId: 'instagram_home_feed_tail',
      semanticSurfaceId: 'instagram:home',
      topologyId: 'instagram_home_article_lane',
      tailLayout: 'flow',
    },
    facebook: {
      adapterId: 'facebook_home_feed_tail',
      semanticSurfaceId: 'facebook:home',
      topologyId: 'facebook_home_article_lane',
      tailLayout: 'flow',
    },
    youtube: {
      adapterId: 'youtube_home_rich_grid_tail',
      semanticSurfaceId: 'youtube:home',
      topologyId: 'youtube_home_rich_grid_lane',
      tailLayout: 'wrapped_row_flow',
    },
  }[siteId] || null;
  if (!expected) {
    throw new Error(`FEED_HORIZON_E2E_CONTINUOUS_SITE_UNSUPPORTED:${String(siteId)}`);
  }
  const checks = {
    namedAdapterMatched: (
      morphology?.adapterId === expected.adapterId
      && morphology?.topologyId === expected.topologyId
      && morphology?.profileId === siteId
      && morphology?.semanticSurfaceId === expected.semanticSurfaceId
      && morphology?.surfaceMode === 'continuous'
    ),
    nativeTopologyExact: morphology?.continuousTopologyExact === true,
    inPlaceMutationMode: morphology?.mutationMode === 'sibling_inert_isolation',
    layoutPreservingIsolation: (
      isolatedCount > 0
      && Number(morphology?.preservedIsolationStateEnforcedCount) === isolatedCount
      && Number(morphology?.collapsedIsolationStateEnforcedCount) === 0
      && Number(morphology?.continuousPreservedGeometryCount) === isolatedCount
    ),
    futureBranchesIsolated: (
      isolatedCount > 0
      && Number(morphology?.continuousIsolatedBranchCount) === isolatedCount
      && Number(morphology?.continuousNativeBranchCount) > isolatedCount
      && Number(morphology?.continuousIsolatedNonBranchCount) === 0
    ),
    isolatedBranchesStayInLane: (
      Number(morphology?.isolatedInNativeLaneCount) === isolatedCount
      && Number(morphology?.isolatedOutsideNativeLaneCount) === 0
    ),
    quarantineRemainsEmpty: Number(morphology?.quarantineChildCount) === 0,
    tailLayoutMatched: morphology?.tailLayout === expected.tailLayout,
    virtualLaneTailPositioned: (
      siteId !== 'x'
      || (
        morphology?.tail?.position === 'absolute'
        && morphology?.nativeLane?.position !== 'static'
      )
    ),
    wrappedRowBoundaryExact: (
      siteId !== 'youtube'
      || (
        morphology?.youtubeHomeCompletedRowBoundary === true
        && morphology?.boundaryBasis === 'completed_wrap_row_edge'
        && Number(morphology?.completedWrapRowItemCount) > 0
        && morphology?.nativeLane?.display === 'flex'
        && String(morphology?.nativeLane?.flexDirection || '').startsWith('row')
        && String(morphology?.nativeLane?.flexWrap || '').includes('wrap')
        && morphology?.tail?.flexBasis === '100%'
      )
    ),
  };
  return {
    status: Object.values(checks).every(Boolean) ? 'PASS' : 'FAIL',
    checks,
  };
}

export function classifyTikTokEndpointIsolation(morphology) {
  const isolatedCount = Math.max(0, Number(morphology?.isolatedElementCount) || 0);
  const checks = {
    inPlaceMutationMode: morphology?.mutationMode === 'sibling_inert_isolation',
    quarantineRemainsEmpty: Number(morphology?.quarantineChildCount) === 0,
    nativeSiblingsIsolated: isolatedCount > 0,
    isolatedStateEnforced: (
      Number(morphology?.isolatedStateEnforcedCount) === isolatedCount
    ),
    isolatedSiblingsStayInLane: (
      Number(morphology?.isolatedInNativeLaneCount) === isolatedCount
      && Number(morphology?.isolatedOutsideNativeLaneCount) === 0
    ),
  };
  return {
    status: Object.values(checks).every(Boolean) ? 'PASS' : 'FAIL',
    checks,
  };
}

export function classifyYoutubeShortsEndpointIsolation(morphology) {
  const isolatedCount = Math.max(0, Number(morphology?.isolatedElementCount) || 0);
  const isolatedSequenceCount = Math.max(
    0,
    Number(morphology?.youtubeIsolatedSequenceBranchCount) || 0,
  );
  const checks = {
    inPlaceMutationMode: morphology?.mutationMode === 'sibling_inert_isolation',
    quarantineRemainsEmpty: Number(morphology?.quarantineChildCount) === 0,
    isolatedStateEnforced: (
      isolatedCount > 0
      && Number(morphology?.isolatedStateEnforcedCount) === isolatedCount
    ),
    futureSequenceBranchesIsolated: (
      isolatedCount > 0
      && isolatedSequenceCount === isolatedCount
      && Number(morphology?.youtubeSequenceBranchCount) > isolatedSequenceCount
    ),
    frameworkControlsPreserved: (
      Number(morphology?.youtubeControlNodeCount) > 0
      && Number(morphology?.youtubeIsolatedControlNodeCount) === 0
      && Number(morphology?.youtubeIsolatedNonSequenceCount) === 0
    ),
    nativeForwardControlTerminal: (
      morphology?.youtubeForwardControl?.connected === true
      && morphology.youtubeForwardControl.disabled === true
      && morphology.youtubeForwardControl.ariaDisabled === 'true'
      && morphology.youtubeForwardControl.terminalMarker === 'true'
      && Number(morphology.youtubeForwardControl.opacity) <= 0.42
    ),
    isolatedBranchesStayInLane: (
      Number(morphology?.isolatedInNativeLaneCount) === isolatedCount
      && Number(morphology?.isolatedOutsideNativeLaneCount) === 0
    ),
  };
  return {
    status: Object.values(checks).every(Boolean) ? 'PASS' : 'FAIL',
    checks,
  };
}

export function classifyInstagramReelsEndpointIsolation(morphology) {
  const isolatedCount = Math.max(0, Number(morphology?.isolatedElementCount) || 0);
  const isolatedSnapCount = Math.max(
    0,
    Number(morphology?.instagramIsolatedSnapBranchCount) || 0,
  );
  const checks = {
    inPlaceMutationMode: morphology?.mutationMode === 'sibling_inert_isolation',
    quarantineRemainsEmpty: Number(morphology?.quarantineChildCount) === 0,
    isolatedStateEnforced: (
      isolatedCount > 0
      && Number(morphology?.isolatedStateEnforcedCount) === isolatedCount
    ),
    nativeSnapGeometryPreserved: (
      isolatedCount > 0
      && Number(morphology?.preservedIsolationStateEnforcedCount) === isolatedCount
      && Number(morphology?.collapsedIsolationStateEnforcedCount) === 0
      && Number(morphology?.instagramPreservedSnapGeometryCount) === isolatedCount
    ),
    futureSnapBranchesIsolated: (
      isolatedCount > 0
      && isolatedSnapCount === isolatedCount
      && Number(morphology?.instagramSnapBranchCount) > isolatedSnapCount
      && Number(morphology?.instagramIsolatedNonSnapCount) === 0
    ),
    nativeSnapScrollerPreserved: (
      morphology?.instagramScrollerExact === true
      && morphology?.instagramAllBranchesSnapAligned === true
    ),
    readableFooterSnapHeld: morphology?.nativeScroller?.scrollSnapType === 'none',
    outsideLaneControlsPreserved: (
      Number(morphology?.instagramOutsideLaneSiblingCount) > 0
      && Number(morphology?.instagramIsolatedOutsideLaneSiblingCount) === 0
    ),
    nativeForwardControlTerminal: (
      morphology?.instagramForwardControl?.connected === true
      && morphology.instagramForwardControl.role === 'button'
      && morphology.instagramForwardControl.ariaDisabled === 'true'
      && morphology.instagramForwardControl.tabIndex === '-1'
      && morphology.instagramForwardControl.terminalMarker === 'true'
      && Number(morphology.instagramForwardControl.opacity) <= 0.42
    ),
    isolatedBranchesStayInLane: (
      Number(morphology?.isolatedInNativeLaneCount) === isolatedCount
      && Number(morphology?.isolatedOutsideNativeLaneCount) === 0
    ),
  };
  return {
    status: Object.values(checks).every(Boolean) ? 'PASS' : 'FAIL',
    checks,
  };
}

export function classifyInstagramReelsHoldStability({
  boundary,
  feedback,
  maximumBranchGrowth = 16,
} = {}) {
  const boundaryCount = Math.max(0, Number(boundary?.instagramNativeBranchCount) || 0);
  const feedbackCount = Math.max(0, Number(feedback?.instagramNativeBranchCount) || 0);
  const branchGrowth = feedbackCount - boundaryCount;
  const boundaryScrollHeight = Math.max(0, Number(boundary?.nativeScroller?.scrollHeight) || 0);
  const feedbackScrollHeight = Math.max(0, Number(feedback?.nativeScroller?.scrollHeight) || 0);
  const checks = {
    sameDocument: (
      Number.isFinite(Number(boundary?.timeOrigin))
      && Number(boundary.timeOrigin) === Number(feedback?.timeOrigin)
    ),
    exactNativeScrollerRetained: (
      boundary?.instagramScrollerExact === true
      && feedback?.instagramScrollerExact === true
    ),
    nativeScrollExtentPreserved: (
      boundaryScrollHeight > 0
      && feedbackScrollHeight >= boundaryScrollHeight - 2
    ),
    branchGrowthBounded: (
      branchGrowth >= 0
      && branchGrowth <= Math.max(0, Number(maximumBranchGrowth) || 0)
    ),
  };
  return {
    status: Object.values(checks).every(Boolean) ? 'PASS' : 'FAIL',
    checks,
    branchGrowth,
    maximumBranchGrowth,
  };
}

async function readNativeFeedRefreshState(harness, page, scenario) {
  const selectors = scenario?.feedConsumption?.oracle?.selectors;
  if (!Array.isArray(selectors) || selectors.length === 0) {
    throw new Error('FEED_HORIZON_E2E_REFRESH_SELECTORS_REQUIRED');
  }
  return evaluate(harness.cdp, page.sessionId, `((input) => {
    const hash = (value) => {
      let result = 2166136261;
      const text = String(value || '');
      for (let index = 0; index < text.length; index += 1) {
        result ^= text.charCodeAt(index);
        result = Math.imul(result, 16777619);
      }
      return result >>> 0;
    };
    const matched = Array.from(document.querySelectorAll(input.selectors.join(', ')))
      .slice(0, 64);
    const candidates = matched.filter((candidate) => (
      !matched.some((other) => other !== candidate && other.contains(candidate))
    ));
    const signatures = candidates.flatMap((candidate) => {
      const parts = [];
      ['data-item-id', 'data-video-id', 'data-post-id', 'data-id'].forEach((name) => {
        const value = candidate.getAttribute?.(name);
        if (value) parts.push(name + ':' + value);
      });
      const link = candidate.matches?.('a[href*="/video/"]')
        ? candidate
        : candidate.querySelector?.('a[href*="/video/"]');
      if (link?.href) {
        try {
          parts.push('path:' + new URL(link.href, location.href).pathname);
        } catch (_) {
          // An invalid site URL cannot contribute to the opaque fingerprint.
        }
      }
      const video = candidate.matches?.('video')
        ? candidate
        : candidate.querySelector?.('video');
      const mediaSource = video?.currentSrc || video?.src || video?.poster || '';
      if (mediaSource) parts.push('media:' + hash(mediaSource).toString(16));
      return parts.length > 0 ? [hash(parts.join('|')).toString(16).padStart(8, '0')] : [];
    }).sort();
    const readNav = (selector) => {
      const nav = document.querySelector(selector);
      const rect = nav?.getBoundingClientRect?.() || null;
      let targetPath = null;
      if (nav?.href) {
        try {
          targetPath = new URL(nav.href, location.href).pathname;
        } catch (_) {
          targetPath = null;
        }
      }
      const visible = !!(
        rect
        && rect.width > 0
        && rect.height > 0
        && rect.bottom > 0
        && rect.right > 0
        && rect.top < window.innerHeight
        && rect.left < window.innerWidth
      );
      return {
        count: document.querySelectorAll(selector).length,
        visible,
        targetPath,
        x: visible ? Math.round(rect.left + (rect.width / 2)) : null,
        y: visible ? Math.round(rect.top + (rect.height / 2)) : null,
      };
    };
    return {
      path: location.pathname,
      timeOrigin: Math.round(performance.timeOrigin),
      visibleDialogCount: Array.from(document.querySelectorAll(
        '[role="dialog"], [aria-modal="true"]'
      )).filter((dialog) => {
        const rect = dialog.getBoundingClientRect?.();
        const style = getComputedStyle(dialog);
        return !!(
          rect
          && rect.width > 0
          && rect.height > 0
          && style.display !== 'none'
          && style.visibility !== 'hidden'
        );
      }).length,
      candidateCount: candidates.length,
      signatureCount: signatures.length,
      supplyDigest: signatures.length > 0
        ? hash(signatures.join('|')).toString(16).padStart(8, '0')
        : null,
      nav: readNav('[data-e2e="nav-foryou"]'),
      followingNav: readNav('[data-e2e="nav-following"]'),
    };
  })(${JSON.stringify({ selectors })})`);
}

export function classifyNativeFeedRefresh({
  before,
  after,
  clicked,
  beforeAdvanceCount,
  afterAdvanceCount,
} = {}) {
  const passiveAdvanceDelta = Math.max(
    0,
    (Number(afterAdvanceCount) || 0) - (Number(beforeAdvanceCount) || 0),
  );
  const isForYouSurfacePath = (value) => (
    value === '/'
    || /^\/foryou(?:\/|$)/iu.test(String(value || ''))
  );
  const checks = {
    trustedClickPerformed: clicked === true,
    navSingletonVisible: before?.nav?.count === 1 && before?.nav?.visible === true,
    sameSurfaceTarget: (
      isForYouSurfacePath(before?.path)
      && isForYouSurfacePath(before?.nav?.targetPath)
      && isForYouSurfacePath(after?.path)
    ),
    documentContinuous: (
      Number.isFinite(Number(before?.timeOrigin))
      && Number(before.timeOrigin) === Number(after?.timeOrigin)
    ),
    supplyFingerprintChanged: (
      typeof before?.supplyDigest === 'string'
      && typeof after?.supplyDigest === 'string'
      && before.supplyDigest !== after.supplyDigest
    ),
    passiveAdvanceAbsent: passiveAdvanceDelta === 0,
  };
  const safe = [
    checks.trustedClickPerformed,
    checks.navSingletonVisible,
    checks.sameSurfaceTarget,
    checks.documentContinuous,
    checks.passiveAdvanceAbsent,
  ].every(Boolean);
  return {
    status: !safe
      ? 'FAIL'
      : checks.supplyFingerprintChanged
        ? 'PASS'
        : 'NO_EFFECT',
    checks,
    passiveAdvanceDelta,
  };
}

export function classifyNativeFeedReselection({
  before,
  intermediate,
  after,
  followingClicked,
  forYouClicked,
  beforeAdvanceCount,
  afterAdvanceCount,
} = {}) {
  const passiveAdvanceDelta = Math.max(
    0,
    (Number(afterAdvanceCount) || 0) - (Number(beforeAdvanceCount) || 0),
  );
  const isForYouSurfacePath = (value) => (
    value === '/'
    || /^\/foryou(?:\/|$)/iu.test(String(value || ''))
  );
  const hasSameSupply = (left, right) => (
    typeof left?.supplyDigest === 'string'
    && typeof right?.supplyDigest === 'string'
    && left.supplyDigest === right.supplyDigest
  );
  const checks = {
    followingClickPerformed: followingClicked === true,
    followingNavSingletonVisible: (
      before?.followingNav?.count === 1
      && before?.followingNav?.visible === true
      && /^\/following(?:\/|$)/iu.test(String(before?.followingNav?.targetPath || ''))
    ),
    inertIntermediateState: (
      isForYouSurfacePath(before?.path)
      && isForYouSurfacePath(intermediate?.path)
      && hasSameSupply(before, intermediate)
      && Number(intermediate?.visibleDialogCount) === 0
    ),
    forYouClickPerformed: forYouClicked === true,
    forYouNavSingletonVisible: (
      intermediate?.nav?.count === 1
      && intermediate?.nav?.visible === true
      && isForYouSurfacePath(intermediate?.nav?.targetPath)
    ),
    forYouSurfaceRestored: isForYouSurfacePath(after?.path),
    documentContinuous: (
      Number.isFinite(Number(before?.timeOrigin))
      && Number(before.timeOrigin) === Number(intermediate?.timeOrigin)
      && Number(before.timeOrigin) === Number(after?.timeOrigin)
    ),
    supplyFingerprintChanged: (
      typeof intermediate?.supplyDigest === 'string'
      && typeof after?.supplyDigest === 'string'
      && intermediate.supplyDigest !== after.supplyDigest
    ),
    visibleDialogAbsent: Number(after?.visibleDialogCount) === 0,
    passiveAdvanceAbsent: passiveAdvanceDelta === 0,
  };
  const safeChecks = Object.entries(checks)
    .filter(([name]) => name !== 'supplyFingerprintChanged')
    .map(([, value]) => value);
  const safe = safeChecks.every(Boolean);
  return {
    status: !safe
      ? 'FAIL'
      : checks.supplyFingerprintChanged
        ? 'PASS'
        : 'NO_EFFECT',
    checks,
    passiveAdvanceDelta,
  };
}

async function dispatchTrustedPointClick(harness, page, nav) {
  if (
    nav?.count !== 1
    || nav.visible !== true
    || !Number.isFinite(Number(nav.x))
    || !Number.isFinite(Number(nav.y))
  ) return false;
  await harness.cdp.send('Input.dispatchMouseEvent', {
    type: 'mousePressed',
    x: Number(nav.x),
    y: Number(nav.y),
    button: 'left',
    clickCount: 1,
  }, page.sessionId);
  await harness.cdp.send('Input.dispatchMouseEvent', {
    type: 'mouseReleased',
    x: Number(nav.x),
    y: Number(nav.y),
    button: 'left',
    clickCount: 1,
  }, page.sessionId);
  return true;
}

async function runNativeFeedRefresh({
  harness,
  page,
  scenario,
  mode = 'for_you_click',
}) {
  const before = await readNativeFeedRefreshState(harness, page, scenario);
  const beforeFeed = summarizeFeedSnapshot(readFeedSnapshot(
    await readDebuggerPayload(harness, page),
  ));
  const clicked = await dispatchTrustedPointClick(harness, page, before.nav);

  const deadline = Date.now() + FEED_REFRESH_TIMEOUT_MS;
  let after = before;
  do {
    await sleep(500);
    after = await readNativeFeedRefreshState(harness, page, scenario);
    if (
      typeof before.supplyDigest === 'string'
      && typeof after.supplyDigest === 'string'
      && before.supplyDigest !== after.supplyDigest
    ) break;
  } while (Date.now() < deadline);
  const afterFeed = summarizeFeedSnapshot(readFeedSnapshot(
    await readDebuggerPayload(harness, page),
  ));
  const classification = classifyNativeFeedRefresh({
    before,
    after,
    clicked,
    beforeAdvanceCount: beforeFeed.advanceCount,
    afterAdvanceCount: afterFeed.advanceCount,
  });
  return {
    ...classification,
    mode,
    before,
    after,
    feed: {
      before: beforeFeed,
      after: afterFeed,
    },
  };
}

async function runNativeFeedReselection({
  harness,
  page,
  scenario,
}) {
  const before = await readNativeFeedRefreshState(harness, page, scenario);
  const beforeFeed = summarizeFeedSnapshot(readFeedSnapshot(
    await readDebuggerPayload(harness, page),
  ));
  const followingClicked = await dispatchTrustedPointClick(
    harness,
    page,
    before.followingNav,
  );
  await sleep(FEED_REFRESH_RESELECT_DELAY_MS);
  const intermediate = await readNativeFeedRefreshState(harness, page, scenario);
  const forYouClicked = await dispatchTrustedPointClick(
    harness,
    page,
    intermediate.nav,
  );

  const deadline = Date.now() + FEED_REFRESH_TIMEOUT_MS;
  let after = intermediate;
  do {
    await sleep(500);
    after = await readNativeFeedRefreshState(harness, page, scenario);
    if (
      typeof intermediate.supplyDigest === 'string'
      && typeof after.supplyDigest === 'string'
      && intermediate.supplyDigest !== after.supplyDigest
    ) break;
  } while (Date.now() < deadline);
  const afterFeed = summarizeFeedSnapshot(readFeedSnapshot(
    await readDebuggerPayload(harness, page),
  ));
  const classification = classifyNativeFeedReselection({
    before,
    intermediate,
    after,
    followingClicked,
    forYouClicked,
    beforeAdvanceCount: beforeFeed.advanceCount,
    afterAdvanceCount: afterFeed.advanceCount,
  });
  return {
    ...classification,
    mode: 'following_noop_for_you_reselect',
    before,
    intermediate,
    after,
    feed: {
      before: beforeFeed,
      after: afterFeed,
    },
  };
}

export function classifyEndpointIsolationForScenario(morphology, scenario) {
  if (scenario?.feedConsumption?.surfaceMode === 'continuous') {
    return classifyContinuousEndpointIsolation(morphology, scenario?.siteId);
  }
  if (scenario?.siteId === 'youtube') {
    return classifyYoutubeShortsEndpointIsolation(morphology);
  }
  if (scenario?.siteId === 'instagram') {
    return classifyInstagramReelsEndpointIsolation(morphology);
  }
  return classifyTikTokEndpointIsolation(morphology);
}

function validateDryMorphology(snapshot, morphology, scenario) {
  const nativeMorphology = classifyNativeEndpointMorphology(morphology);
  const isolation = classifyEndpointIsolationForScenario(morphology, scenario);
  const checks = {
    dryPhase: snapshot?.dryRun?.phase === 'feed_dry'
      || snapshot?.dryRun?.phase === 'controls_live',
    endpointCommitted: snapshot?.dryRun?.endpoint?.leaseState === 'committed',
    boundaryReached: snapshot?.dryRun?.endpoint?.boundaryReached === true,
    ...nativeMorphology.checks,
    ...isolation.checks,
  };
  return {
    status: Object.values(checks).every(Boolean) ? 'PASS' : 'FAIL',
    checks,
  };
}

export async function waitForFeedState({
  harness,
  page,
  predicate,
  abortPredicate = null,
  timeoutMs,
  pollMs = 250,
}) {
  const startedAt = Date.now();
  let payload = null;
  let feedFlow = null;
  while (Date.now() - startedAt < timeoutMs) {
    payload = await readDebuggerPayload(harness, page);
    feedFlow = readFeedSnapshot(payload);
    if (predicate(feedFlow)) {
      return {
        ok: true,
        waitedMs: Date.now() - startedAt,
        payload,
        snapshot: summarizeFeedSnapshot(feedFlow),
      };
    }
    if (typeof abortPredicate === 'function' && abortPredicate(feedFlow)) {
      return {
        ok: false,
        aborted: true,
        waitedMs: Date.now() - startedAt,
        payload,
        snapshot: summarizeFeedSnapshot(feedFlow),
      };
    }
    await sleep(pollMs);
  }
  return {
    ok: false,
    waitedMs: Date.now() - startedAt,
    payload,
    snapshot: feedFlow ? summarizeFeedSnapshot(feedFlow) : null,
  };
}

async function dispatchKey(harness, page, key, code, keyCode) {
  await harness.cdp.send('Input.dispatchKeyEvent', {
    type: 'rawKeyDown',
    key,
    code,
    windowsVirtualKeyCode: keyCode,
    nativeVirtualKeyCode: keyCode,
  }, page.sessionId);
  await harness.cdp.send('Input.dispatchKeyEvent', {
    type: 'keyUp',
    key,
    code,
    windowsVirtualKeyCode: keyCode,
    nativeVirtualKeyCode: keyCode,
  }, page.sessionId);
}

export function resolveScenarioEndpointCapability(scenario) {
  const surfaceMode = scenario?.feedConsumption?.surfaceMode;
  if (surfaceMode === 'paged') return 'paged_hold';
  if (surfaceMode === 'continuous' || surfaceMode === 'hybrid') {
    return 'anchored_continuous';
  }
  throw new Error(
    `FEED_HORIZON_E2E_SURFACE_MODE_UNSUPPORTED:${String(surfaceMode || '')}`,
  );
}

export async function runWarmup({
  harness,
  page,
  scenario,
  dwellMs,
  stopPredicate = null,
  readinessPredicate = null,
}) {
  if (stopPredicate !== null && typeof stopPredicate !== 'function') {
    throw new Error('FEED_HORIZON_E2E_WARMUP_STOP_PREDICATE_INVALID');
  }
  if (readinessPredicate !== null && typeof readinessPredicate !== 'function') {
    throw new Error('FEED_HORIZON_E2E_WARMUP_READINESS_PREDICATE_INVALID');
  }
  const actions = [];
  const feedRefreshes = [];
  const timeline = [];
  let ready = false;
  let consecutiveIdleActions = 0;
  let refreshBlocked = false;
  const expectedCapability = resolveScenarioEndpointCapability(scenario);
  let finalPayload = await readDebuggerPayload(harness, page);
  for (let index = 0; index < WARMUP_MAX_STEPS; index += 1) {
    const action = await runTrustedFeedStep({
      harness,
      page,
      scenario,
      index,
      dwellMs: Math.min(2_000, dwellMs),
    });
    actions.push(action);
    if (action.opportunity?.state === 'measured') consecutiveIdleActions = 0;
    else consecutiveIdleActions += 1;
    finalPayload = await readDebuggerPayload(harness, page);
    const summary = summarizeFeedSnapshot(readFeedSnapshot(finalPayload));
    timeline.push(summary);
    const pageBlocker = classifyTrustedWheelPageBlocker(action);
    if (pageBlocker) {
      console.error(
        `[feed-horizon-e2e] warmup-blocked step=${index + 1}`
        + ` reason=${pageBlocker.reason}`
        + ` rootDelta=${pageBlocker.evidence.rootDelta}`
        + ` ownerCandidateDelta=${pageBlocker.evidence.scrollOwnerCandidateDelta}`
        + ` ownerCandidateKind=${pageBlocker.evidence.scrollOwnerCandidateKind}`
        + ` dialogBefore=${pageBlocker.evidence.renderedDialogCountBefore}`
        + ` dialogAfter=${pageBlocker.evidence.renderedDialogCountAfter}`,
      );
      return {
        status: 'BLOCKED',
        reason: pageBlocker.reason,
        blocker: pageBlocker,
        actionCount: actions.length,
        measuredTransitionCount: actions.filter(
          (entry) => entry.opportunity?.state === 'measured',
        ).length,
        actions,
        feedRefreshes,
        final: summary,
        timeline,
      };
    }
    const stop = stopPredicate?.(summary) || null;
    if (stop) {
      return {
        status: 'BLOCKED',
        reason: stop.reason || 'warmup_stop_requested',
        blocker: stop,
        actionCount: actions.length,
        measuredTransitionCount: actions.filter(
          (entry) => entry.opportunity?.state === 'measured',
        ).length,
        actions,
        feedRefreshes,
        final: summary,
        timeline,
      };
    }
    if (!summary.readiness && index === 0) {
      await sleep(750);
      finalPayload = await readDebuggerPayload(harness, page);
      const availability = summarizeFeedRuntimeAvailability(finalPayload);
      if (!availability.semanticAvailable) {
        console.error(
          `[feed-horizon-e2e] feed-runtime-unavailable ${JSON.stringify(availability)}`,
        );
        return {
          status: 'WARN',
          reason: 'feed_runtime_unavailable',
          actionCount: actions.length,
          measuredTransitionCount: actions.filter(
            (entry) => entry.opportunity?.state === 'measured',
          ).length,
          actions,
          feedRefreshes,
          final: summarizeFeedSnapshot(readFeedSnapshot(finalPayload)),
          timeline,
          runtimeAvailability: availability,
        };
      }
    }
    ready = (
      summary.readiness?.status === 'ready'
      && summary.readiness?.capability === expectedCapability
      && summary.actuationSafety?.status === 'safe'
      && summary.actuationSafety?.capability === expectedCapability
      && summary.advanceCount >= 2
      && (readinessPredicate === null || await readinessPredicate(summary))
    );
    console.error(
      `[feed-horizon-e2e] warmup step=${index + 1}`
      + ` inputDelta=${action.deltaY}`
      + ` opportunity=${action.opportunity?.state || 'unavailable'}`
      + ` advances=${summary.advanceCount}`
      + ` readiness=${summary.readiness?.status || 'missing'}`
      + ` capability=${summary.readiness?.capability || 'missing'}`
      + (action.scrollEvidence
        ? ` rootDelta=${String(action.scrollEvidence.rootDelta)}`
          + ` ownerCandidateDelta=${String(action.scrollEvidence.scrollOwnerCandidateDelta)}`
          + ` ownerCandidateKind=${action.scrollEvidence.after?.scrollOwnerCandidateKind || 'missing'}`
          + ` dialog=${String((action.scrollEvidence.after?.renderedDialogCount || 0) > 0)}`
          + ` scrollEvidence=${JSON.stringify(action.scrollEvidence)}`
        : ''),
    );
    if (ready) break;
    if (
      scenario.siteId === 'tiktok'
      && consecutiveIdleActions >= FEED_REFRESH_STALL_ACTIONS
      && !refreshBlocked
      && feedRefreshes.length < 4
    ) {
      const directRefresh = await runNativeFeedRefresh({ harness, page, scenario });
      feedRefreshes.push(directRefresh);
      let refresh = directRefresh;
      if (directRefresh.status === 'NO_EFFECT' && feedRefreshes.length < 4) {
        refresh = await runNativeFeedReselection({ harness, page, scenario });
        feedRefreshes.push(refresh);
      }
      console.error(
        `[feed-horizon-e2e] warmup-refresh attempt=${feedRefreshes.length}`
        + ` mode=${refresh.mode}`
        + ` status=${refresh.status}`
        + ` supplyChanged=${refresh.checks.supplyFingerprintChanged}`
        + ` passiveAdvanceDelta=${refresh.passiveAdvanceDelta}`,
      );
      consecutiveIdleActions = 0;
      refreshBlocked = refresh.status === 'FAIL';
    }
  }
  return {
    status: ready ? 'PASS' : 'WARN',
    actionCount: actions.length,
    measuredTransitionCount: actions.filter(
      (action) => action.opportunity?.state === 'measured',
    ).length,
    actions,
    feedRefreshes,
    final: summarizeFeedSnapshot(readFeedSnapshot(finalPayload)),
    timeline,
  };
}

async function runDryRunProbe({ harness, page, scenario, actionIndex }) {
  const before = await readEndpointMorphology(harness, page);
  await sendRuntimeDebuggerAutomationAction(
    harness,
    page,
    RUNTIME_DEBUGGER_AUTOMATION_ACTIONS.SET_TERMINUS_DRY_RUN,
    { enabled: true },
  );

  const actions = [];
  const deadline = Date.now() + DRY_RUN_TIMEOUT_MS;
  let state = await waitForFeedState({
    harness,
    page,
    timeoutMs: 4_000,
    predicate: (feedFlow) => (
      feedFlow?.dryRun?.endpoint?.leaseState === 'committed'
    ),
  });
  while (
    Date.now() < deadline
    && state.snapshot?.dryRun?.endpoint?.boundaryReached !== true
  ) {
    actions.push(await runTrustedFeedStep({
      harness,
      page,
      scenario,
      index: actionIndex + actions.length,
      dwellMs: 250,
      collectOracle: false,
    }));
    state = await waitForFeedState({
      harness,
      page,
      timeoutMs: 2_000,
      predicate: (feedFlow) => feedFlow?.dryRun?.endpoint?.boundaryReached === true,
    });
  }
  const engaged = await readEndpointMorphology(harness, page);
  const morphology = validateDryMorphology(state.snapshot, engaged, scenario);
  const demandCapture = await waitForFeedState({
    harness,
    page,
    timeoutMs: DRY_RUN_DEMAND_CAPTURE_TIMEOUT_MS,
    pollMs: 100,
    predicate: (feedFlow) => (
      feedFlow?.dryRun?.endpoint?.controlsLive === true
      || feedFlow?.dryRun?.endpoint?.leaseState === 'idle'
    ),
  });
  const demandCaptureReady = (
    demandCapture.snapshot?.dryRun?.endpoint?.controlsLive === true
  );
  const demandActions = [];
  let continueResolution = {
    ok: false,
    waitedMs: 0,
    payload: null,
    snapshot: demandCapture.snapshot,
  };
  if (demandCaptureReady) {
    while (demandActions.length < DEMAND_BURST_ACTION_COUNT) {
      demandActions.push(await runTrustedEndpointForwardStep({
        harness,
        page,
        scenario,
        index: actionIndex + actions.length,
        dwellMs: 100,
        phase: 'demand',
      }));
      actions.push(demandActions.at(-1));
    }
    continueResolution = await waitForFeedState({
      harness,
      page,
      timeoutMs: 5_000,
      pollMs: 100,
      predicate: (feedFlow) => (
        feedFlow?.dryRun?.enabled === false
        && feedFlow?.dryRun?.endpoint?.leaseState === 'idle'
      ),
    });
  }

  await sendRuntimeDebuggerAutomationAction(
    harness,
    page,
    RUNTIME_DEBUGGER_AUTOMATION_ACTIONS.SET_TERMINUS_DRY_RUN,
    { enabled: false },
  );
  const cleanup = await waitForFeedState({
    harness,
    page,
    timeoutMs: 5_000,
    predicate: (feedFlow) => (
      feedFlow?.dryRun?.enabled === false
      && feedFlow?.dryRun?.endpoint?.leaseState === 'idle'
    ),
  });
  const after = await readEndpointMorphology(harness, page);
  const cleanupChecks = {
    stateIdle: cleanup.ok,
    artifactsAbsent: [
      after.markerCount,
      after.tailCount,
      after.quarantineCount,
      after.terminusCount,
    ].every((count) => count === 0),
    demandCaptureReady,
    renewedDemandCaptured: (
      demandActions.length === DEMAND_BURST_ACTION_COUNT
      && demandActions.every((action) => action.trustedInput === true)
      && continueResolution.ok
    ),
    feedCandidatesPresentBefore: before.pageCandidateCount > 0,
    feedCandidatesPresentAfter: after.pageCandidateCount > 0,
  };
  const cleanupStatus = Object.values(cleanupChecks).every(Boolean) ? 'PASS' : 'FAIL';
  return {
    status: morphology.status === 'PASS' && cleanupStatus === 'PASS' ? 'PASS' : 'FAIL',
    before,
    engaged,
    endpoint: state.snapshot?.dryRun || null,
    morphology,
    actions,
    demandCapture: {
      snapshot: demandCapture.snapshot,
      ready: demandCaptureReady,
      waitedMs: demandCapture.waitedMs,
      continueResolution: continueResolution.snapshot,
    },
    cleanup: {
      status: cleanupStatus,
      checks: cleanupChecks,
      after,
    },
  };
}

function phaseKey(summary) {
  return [
    summary?.episode?.phase || 'missing',
    summary?.episode?.admission?.status || 'missing',
    summary?.episode?.admission?.spawnPolicyReason || 'missing',
    summary?.readiness?.status || 'missing',
    summary?.actuationSafety?.status || 'missing',
  ].join(':');
}

export function isFeedEndpointReadyForBoundaryDrive(phase) {
  return ['feed_drying', 'feed_dry', 'enso_pending'].includes(phase);
}

export function projectNaturalGateMilestone(feedFlow) {
  // Read the canonical decision, not `summarizeFeedSnapshot()`. The bounded
  // report summary intentionally omits the judge's transient `armed`,
  // `opportunityReady`, and `seam` internals; using it here would erase the
  // exact evidence this causal lane exists to prove.
  const decision = feedFlow?.episode?.feedDecision || null;
  if (!decision) return null;
  if (
    typeof decision.armed !== 'boolean'
    || typeof decision.opportunityReady !== 'boolean'
    || !decision.seam
    || typeof decision.seam !== 'object'
  ) {
    throw new Error('FEED_HORIZON_E2E_CANONICAL_GATE_DECISION_REQUIRED');
  }
  const admission = feedFlow?.episode?.admission || null;
  const endpoint = feedFlow?.episode?.endpoint || null;
  return Object.freeze({
    decision,
    admissionAdmitted: admission?.admitted === true,
    endpointCommitted: endpoint?.leaseState === 'committed',
  });
}

function observeNaturalGateMilestones(observation, feedFlow, elapsedMs) {
  const milestone = projectNaturalGateMilestone(feedFlow);
  if (!milestone) return;
  const { decision } = milestone;
  if (decision.armed === true && observation.armedAtMs === null) {
    observation.armedAtMs = elapsedMs;
  }
  if (decision.opportunityReady === true && observation.opportunityAtMs === null) {
    observation.opportunityAtMs = elapsedMs;
  }
  if (decision.state === 'interrupt' && observation.interruptAtMs === null) {
    observation.interruptAtMs = elapsedMs;
  }
  if (milestone.admissionAdmitted && observation.admittedAtMs === null) {
    observation.admittedAtMs = elapsedMs;
  }
  if (milestone.endpointCommitted && observation.endpointCommittedAtMs === null) {
    observation.endpointCommittedAtMs = elapsedMs;
  }
  observation.lastDecision = decision;
}

export function finalizeNaturalGateObservation(observation, {
  budgetMs,
  dwellMs,
  stepCount,
  elapsedMs,
}) {
  const decision = observation.lastDecision;
  return Object.freeze({
    budgetMs,
    dwellMs,
    stepCount,
    elapsedMs,
    armedAtMs: observation.armedAtMs,
    opportunityAtMs: observation.opportunityAtMs,
    interruptAtMs: observation.interruptAtMs,
    admittedAtMs: observation.admittedAtMs,
    endpointCommittedAtMs: observation.endpointCommittedAtMs,
    observedArmToInterruptMs: observation.armedAtMs !== null && observation.interruptAtMs !== null
      ? observation.interruptAtMs - observation.armedAtMs
      : null,
    // Current seam ownership may restart after explicit invalidation. Elapsed
    // time since the first sampled arm is a separate diagnostic, not this clock.
    seamWaitMs: decision?.seam?.waitedMs ?? null,
    seamDecision: decision?.seam?.decision || null,
    finalSeam: decision?.seam || null,
    seamHardLimitMs: Number(decision?.seam?.hardLimitMs ?? 0) || null,
    finalState: decision?.state || null,
    finalOpportunityReady: decision?.opportunityReady === true,
    finalDose: Number(decision?.metrics?.dose ?? 0),
    finalEpisodeActiveMs: Number(decision?.metrics?.episodeActiveMs ?? 0),
    finalAdvanceCount: Number(decision?.metrics?.advanceCount ?? 0),
    finalFreshItemsSeen: Number(decision?.metrics?.episodeFreshItemsSeen ?? 0),
    finalReasons: Array.isArray(decision?.reasons)
      ? Object.freeze([...decision.reasons])
      : Object.freeze([]),
  });
}

// Verifies the real Gesture Gate outcome and native backward movement after
// either production or explicitly manual admission. This does not establish
// production cadence eligibility; the caller owns and reports that distinction.
export async function verifyFeedHorizonGateNeutralBackward({
  harness,
  page,
  scenario,
  dwellMs,
  actionIndex,
  gateState,
}) {
  let neutral = null;
  let neutralMorphology = null;
  let neutralEndpointIntact = false;
  let backwardAction = null;
  let backwardNavigation = null;
  let backwardMorphology = null;
  if (gateState.ok) {
    await sleep(900);
    await dispatchKey(harness, page, 'Escape', 'Escape', 27);
    neutral = await waitForFeedState({
      harness,
      page,
      timeoutMs: OUTCOME_TIMEOUT_MS,
      predicate: (feedFlow) => (
        feedFlow?.episode?.managerState === 'HORIZON'
        && feedFlow?.episode?.endpoint?.continueIntentPending === false
        && feedFlow?.episode?.endpoint?.leaseState === 'committed'
        && feedFlow?.episode?.endpoint?.boundaryReached === true
      ),
    });
    neutralMorphology = await readEndpointMorphology(harness, page);
    neutralEndpointIntact = (
      neutral.ok
      && neutralMorphology?.gateCount === 0
      && neutralMorphology?.markerCount === 1
      && neutralMorphology?.tailCount === 1
      && neutralMorphology?.quarantineCount === 1
      && neutralMorphology?.exactOrder === true
    );
    if (neutralEndpointIntact) {
      backwardAction = await runTrustedFeedStep({
        harness,
        page,
        scenario,
        index: actionIndex,
        dwellMs,
        direction: 'backward',
        collectOracle: false,
      });
      backwardNavigation = await waitForFeedState({
        harness,
        page,
        timeoutMs: OUTCOME_TIMEOUT_MS,
        predicate: (feedFlow) => (
          feedFlow?.episode?.managerState === 'HORIZON'
          && feedFlow?.episode?.endpoint?.leaseState === 'committed'
          && feedFlow?.episode?.endpoint?.boundaryReached === true
          && feedFlow?.episode?.endpoint?.continueIntentPending === false
        ),
      });
      backwardMorphology = await readEndpointMorphology(harness, page);
    }
  }

  const backwardScrollMoved = (
    Number.isFinite(Number(neutralMorphology?.nativeScroller?.scrollTop))
    && Number.isFinite(Number(backwardMorphology?.nativeScroller?.scrollTop))
    && Number(backwardMorphology.nativeScroller.scrollTop)
      < Number(neutralMorphology.nativeScroller.scrollTop) - 1
  );
  const backwardInputPerformed = (
    backwardAction?.status === 'performed'
    && backwardAction?.trustedInput === true
  );
  const backwardMorphologyKept = (
    backwardMorphology?.gateCount === 0
    && backwardMorphology?.markerCount === 1
    && backwardMorphology?.tailCount === 1
    && backwardMorphology?.quarantineCount === 1
    && backwardMorphology?.exactOrder === true
  );
  const backwardAdvanceCountUnchanged = (
    Number.isSafeInteger(neutral?.snapshot?.advanceCount)
    && Number.isSafeInteger(backwardNavigation?.snapshot?.advanceCount)
    && backwardNavigation.snapshot.advanceCount === neutral.snapshot.advanceCount
  );
  const checks = {
    neutralKeptHorizon: neutral?.ok === true,
    neutralEndpointIntact,
    backwardTrustedInputPerformed: backwardInputPerformed,
    backwardNativeScrollerMoved: backwardScrollMoved,
    backwardEndpointStateKept: backwardNavigation?.ok === true,
    backwardEndpointMorphologyKept: backwardMorphologyKept,
    backwardAdvanceCountUnchanged,
    backwardNavigationKeptEndpoint: (
      backwardInputPerformed
      && backwardNavigation?.ok === true
      && backwardScrollMoved
      && backwardMorphologyKept
      && backwardAdvanceCountUnchanged
    ),
  };
  const evidence = {
    beforeObservation: neutral?.payload?.latest?.feedFlow?.ledger || null,
    afterObservation: backwardNavigation?.payload?.latest?.feedFlow?.ledger || null,
    direction: backwardAction?.direction || 'backward',
    status: backwardAction?.status || null,
    trustedInput: backwardAction?.trustedInput === true,
    inputKind: backwardAction?.inputKind || null,
    oracleRecoveryUsed: backwardAction?.oracleRecovery != null,
    beforeScrollTop: Number.isFinite(
      Number(neutralMorphology?.nativeScroller?.scrollTop),
    )
      ? Number(neutralMorphology.nativeScroller.scrollTop)
      : null,
    afterScrollTop: Number.isFinite(
      Number(backwardMorphology?.nativeScroller?.scrollTop),
    )
      ? Number(backwardMorphology.nativeScroller.scrollTop)
      : null,
    beforeAdvanceCount: Number.isSafeInteger(
      neutral?.snapshot?.advanceCount,
    )
      ? neutral.snapshot.advanceCount
      : null,
    afterAdvanceCount: Number.isSafeInteger(
      backwardNavigation?.snapshot?.advanceCount,
    )
      ? backwardNavigation.snapshot.advanceCount
      : null,
  };
  return {
    neutral,
    neutralMorphology,
    backwardAction,
    backwardNavigation,
    backwardMorphology,
    checks,
    evidence,
  };
}

// Canonical production causal chain. Both the standalone long-form E2E command
// and the attach-only QA control plane call this exact owner; the feedback-only
// inspection runner must never recreate or follow it with a forced inspection.
export async function runFeedHorizonProductionCausalChain({
  harness,
  page,
  scenario,
  actionIndex,
  dwellMs,
  budgetMs,
}) {
  const startedAt = Date.now();
  const deadline = startedAt + budgetMs;
  const actions = [];
  const feedRefreshes = [];
  const phaseTimeline = [];
  let lastPhaseKey = '';
  let payload = await readDebuggerPayload(harness, page);
  let feedFlow = readFeedSnapshot(payload);
  let summary = summarizeFeedSnapshot(feedFlow);
  let reachedHorizon = false;
  let consecutiveIdleActions = 0;
  let refreshBlocked = false;
  const naturalGateObservation = {
    armedAtMs: null,
    opportunityAtMs: null,
    interruptAtMs: null,
    admittedAtMs: null,
    endpointCommittedAtMs: null,
    lastDecision: null,
  };
  observeNaturalGateMilestones(naturalGateObservation, feedFlow, 0);

  while (Date.now() < deadline) {
    const currentPhaseKey = phaseKey(summary);
    if (currentPhaseKey !== lastPhaseKey || actions.length % 12 === 0) {
      phaseTimeline.push(summary);
      lastPhaseKey = currentPhaseKey;
      console.error(
        `[feed-horizon-e2e] soak elapsed=${Math.round((Date.now() - startedAt) / 1000)}s`
        + ` actions=${actions.length}`
        + ` transitions=${actions.filter((action) => action.opportunity?.state === 'measured').length}`
        + ` phase=${summary.episode?.phase || 'missing'}`
        + ` admission=${summary.episode?.admission?.status || 'missing'}`
        + ` firstGrace=${Math.round((summary.episode?.admission?.firstGraceRemainingMs || 0) / 1000)}s`
        + ` feedLoad=${summary.episode?.admission?.feedLoad || 0}`,
      );
    }
    if (isFeedEndpointReadyForBoundaryDrive(summary.episode?.phase)) {
      reachedHorizon = true;
      break;
    }
    const action = await runTrustedFeedStep({
      harness,
      page,
      scenario,
      index: actionIndex + actions.length,
      dwellMs,
    });
    actions.push(action);
    if (action.opportunity?.state === 'measured') consecutiveIdleActions = 0;
    else consecutiveIdleActions += 1;
    payload = await readDebuggerPayload(harness, page);
    feedFlow = readFeedSnapshot(payload);
    summary = summarizeFeedSnapshot(feedFlow);
    observeNaturalGateMilestones(
      naturalGateObservation,
      feedFlow,
      Date.now() - startedAt,
    );
    if (
      scenario.siteId === 'tiktok'
      && consecutiveIdleActions >= FEED_REFRESH_STALL_ACTIONS
      && !refreshBlocked
      && feedRefreshes.length < MAX_FEED_REFRESHES
    ) {
      const directRefresh = await runNativeFeedRefresh({ harness, page, scenario });
      feedRefreshes.push(directRefresh);
      console.error(
        `[feed-horizon-e2e] feed-refresh attempt=${feedRefreshes.length}`
        + ` mode=${directRefresh.mode}`
        + ` status=${directRefresh.status}`
        + ` supplyChanged=${directRefresh.checks.supplyFingerprintChanged}`
        + ` passiveAdvanceDelta=${directRefresh.passiveAdvanceDelta}`,
      );
      let refresh = directRefresh;
      if (
        directRefresh.status === 'NO_EFFECT'
        && feedRefreshes.length < MAX_FEED_REFRESHES
      ) {
        refresh = await runNativeFeedReselection({ harness, page, scenario });
        feedRefreshes.push(refresh);
        console.error(
          `[feed-horizon-e2e] feed-refresh attempt=${feedRefreshes.length}`
          + ` mode=${refresh.mode}`
          + ` status=${refresh.status}`
          + ` supplyChanged=${refresh.checks.supplyFingerprintChanged}`
          + ` passiveAdvanceDelta=${refresh.passiveAdvanceDelta}`,
        );
      }
      consecutiveIdleActions = 0;
      refreshBlocked = refresh.status === 'FAIL';
      payload = await readDebuggerPayload(harness, page);
      feedFlow = readFeedSnapshot(payload);
      summary = summarizeFeedSnapshot(feedFlow);
      observeNaturalGateMilestones(
        naturalGateObservation,
        feedFlow,
        Date.now() - startedAt,
      );
    }
  }

  if (!reachedHorizon) {
    phaseTimeline.push(summary);
    return {
      status: 'WARN',
      reason: 'causal_soak_timeout_before_horizon',
      durationMs: Date.now() - startedAt,
      actionCount: actions.length,
      measuredTransitionCount: actions.filter(
        (action) => action.opportunity?.state === 'measured',
      ).length,
      actions,
      feedRefreshes,
      phaseTimeline,
      final: summary,
      gateObservation: finalizeNaturalGateObservation(naturalGateObservation, {
        budgetMs,
        dwellMs,
        stepCount: actions.length,
        elapsedMs: Date.now() - startedAt,
      }),
      gate: null,
      cleanup: null,
    };
  }

  const boundaryReached = (feedFlow) => (
    feedFlow?.episode?.phase === 'feed_dry'
    || feedFlow?.episode?.phase === 'enso_pending'
  );
  const committed = await waitForFeedState({
    harness,
    page,
    timeoutMs: 4_000,
    predicate: (feedFlow) => (
      feedFlow?.episode?.endpoint?.leaseState === 'committed'
    ),
  });
  observeNaturalGateMilestones(
    naturalGateObservation,
    readFeedSnapshot(committed.payload),
    Date.now() - startedAt,
  );
  const committedMorphology = await readEndpointMorphology(harness, page);
  const committedEndpointOwned = (
    committed.ok
    && committedMorphology.markerCount === 1
    && committedMorphology.tailCount === 1
    && committedMorphology.quarantineCount === 1
    && committedMorphology.exactOrder === true
  );
  console.error(
    `[feed-horizon-e2e] endpoint-commit state=${committed.ok ? 'committed' : 'missing'}`
    + ` owned=${committedEndpointOwned}`
    + ` marker=${committedMorphology.markerCount}`
    + ` tail=${committedMorphology.tailCount}`
    + ` quarantine=${committedMorphology.quarantineCount}`,
  );
  let horizon = {
    ok: boundaryReached({ episode: summary.episode }),
    snapshot: summary,
  };
  const endpointActions = [];
  while (
    committedEndpointOwned
    && !horizon.ok
    && endpointActions.length < 8
  ) {
    endpointActions.push(await runTrustedEndpointForwardStep({
        harness,
        page,
        scenario,
        index: actionIndex + actions.length + endpointActions.length,
        dwellMs: 100,
        phase: 'boundary',
      }));
    horizon = await waitForFeedState({
      harness,
      page,
      timeoutMs: 1_000,
      predicate: boundaryReached,
    });
  }
  if (!horizon.ok) {
    horizon = await waitForFeedState({
      harness,
      page,
      timeoutMs: 2_000,
      predicate: boundaryReached,
    });
  }
  const horizonMorphology = await readEndpointMorphology(harness, page);
  const demandCaptureWaitBudgetMs = horizon.snapshot?.episode?.phase === 'enso_pending'
    ? 0
    : resolveDemandCaptureWaitBudgetMs(horizon.snapshot?.episode?.endpoint);
  if (demandCaptureWaitBudgetMs > 0) {
    console.error(
      `[feed-horizon-e2e] demand-capture`
      + ` stillGate=${horizon.snapshot?.episode?.endpoint?.stillGateMs}ms`
      + ` holdRemaining=${horizon.snapshot?.episode?.endpoint?.holdRemainingMs}ms`
      + ` waitBudget=${demandCaptureWaitBudgetMs}ms`,
    );
  }
  const demandCapture = horizon.snapshot?.episode?.phase === 'enso_pending'
    ? {
      ok: true,
      waitedMs: 0,
      payload: null,
      snapshot: horizon.snapshot,
    }
    : await waitForFeedState({
      harness,
      page,
      timeoutMs: demandCaptureWaitBudgetMs,
      pollMs: 100,
      predicate: (feedFlow) => (
        feedFlow?.episode?.phase === 'enso_pending'
        || feedFlow?.episode?.endpoint?.controlsLive === true
        || feedFlow?.episode?.endpoint?.leaseState === 'idle'
      ),
    });
  const demandCaptureReady = (
    demandCapture.snapshot?.episode?.phase === 'enso_pending'
    || demandCapture.snapshot?.episode?.endpoint?.controlsLive === true
  );
  const demandCaptureOwnershipLost = (
    demandCapture.snapshot?.episode?.endpoint?.leaseState === 'idle'
  );
  let gateState = {
    ok: demandCapture.snapshot?.episode?.phase === 'enso_pending',
    waitedMs: 0,
    payload: null,
    snapshot: demandCapture.snapshot,
  };
  if (!gateState.ok && demandCaptureReady) {
    const demandActions = [];
    while (
      demandActions.length < DEMAND_BURST_ACTION_COUNT
    ) {
      demandActions.push(await runTrustedEndpointForwardStep({
        harness,
        page,
        scenario,
        index: actionIndex + actions.length + endpointActions.length
          + demandActions.length,
        dwellMs: 100,
        phase: 'demand',
      }));
    }
    endpointActions.push(...demandActions);
    gateState = await waitForFeedState({
      harness,
      page,
      timeoutMs: OUTCOME_TIMEOUT_MS,
      predicate: (feedFlow) => feedFlow?.episode?.phase === 'enso_pending',
    });
  }
  const gateMorphology = await readEndpointMorphology(harness, page);

  const {
    neutral,
    neutralMorphology,
    backwardAction,
    backwardNavigation,
    backwardMorphology,
    checks: gateResolutionChecks,
    evidence: backwardEvidence,
  } = await verifyFeedHorizonGateNeutralBackward({
    harness,
    page,
    scenario,
    dwellMs,
    actionIndex: actionIndex + actions.length + endpointActions.length,
    gateState,
  });

  const checks = {
    horizonReached: horizon.ok,
    nativeEndpointOwned: (
      committedEndpointOwned
      && horizonMorphology.markerCount === 1
      && horizonMorphology.tailCount === 1
      && horizonMorphology.quarantineCount === 1
      && horizonMorphology.exactOrder === true
    ),
    demandCaptureReady,
    renewedDemandOpenedGate: gateState.ok && gateMorphology.gateCount === 1,
    ...gateResolutionChecks,
  };
  const passed = Object.values(checks).every(Boolean);
  const failureReason = !horizon.ok
    ? 'dry_horizon_not_reached'
    : !checks.nativeEndpointOwned
      ? 'native_endpoint_ownership_missing'
      : demandCaptureOwnershipLost
        ? 'endpoint_ownership_lost_before_renewed_demand'
        : !demandCaptureReady
          ? 'demand_capture_gate_timeout'
          : !checks.renewedDemandOpenedGate
            ? 'renewed_demand_did_not_open_veil'
            : !checks.neutralKeptHorizon
              ? 'neutral_did_not_keep_horizon'
              : !checks.neutralEndpointIntact
                ? 'neutral_endpoint_not_intact'
                : !checks.backwardTrustedInputPerformed
                  ? 'backward_navigation_trusted_input_not_performed'
                  : !checks.backwardEndpointStateKept
                    ? 'backward_navigation_lost_horizon_or_endpoint'
                    : !checks.backwardEndpointMorphologyKept
                      ? 'backward_navigation_endpoint_morphology_changed'
                      : !checks.backwardAdvanceCountUnchanged
                        ? 'backward_navigation_fabricated_forward_advance'
                        : 'backward_navigation_did_not_move_native_scroller';
  return {
    status: passed ? 'PASS' : 'FAIL',
    reason: passed
      ? 'horizon_veil_neutral_backward_navigation_chain_confirmed'
      : failureReason,
    durationMs: Date.now() - startedAt,
    actionCount: actions.length,
    measuredTransitionCount: actions.filter(
      (action) => action.opportunity?.state === 'measured',
    ).length,
    actions,
    feedRefreshes,
    endpointActions,
    phaseTimeline,
    final: backwardNavigation?.snapshot || gateState.snapshot || horizon.snapshot || summary,
    gateObservation: finalizeNaturalGateObservation(naturalGateObservation, {
      budgetMs,
      dwellMs,
      stepCount: actions.length,
      elapsedMs: Date.now() - startedAt,
    }),
    checks,
    committed: {
      snapshot: committed.snapshot,
      morphology: committedMorphology,
    },
    horizon: {
      snapshot: horizon.snapshot,
      morphology: horizonMorphology,
    },
    demandCapture: {
      snapshot: demandCapture.snapshot,
      ready: demandCaptureReady,
      ownershipLost: demandCaptureOwnershipLost,
      waitedMs: demandCapture.waitedMs,
      waitBudgetMs: demandCaptureWaitBudgetMs,
    },
    gate: {
      snapshot: gateState.snapshot,
      morphology: gateMorphology,
      neutral: neutral?.snapshot || null,
      neutralMorphology,
    },
    cleanup: {
      snapshot: null,
      morphology: null,
      owner: 'scenario_teardown',
    },
    backwardNavigation: {
      action: backwardAction,
      beforeMorphology: neutralMorphology,
      snapshot: backwardNavigation?.snapshot || null,
      morphology: backwardMorphology,
      evidence: backwardEvidence,
    },
  };
}

function createMarkdownReport(report) {
  const lines = [
    '# Feed Horizon causal E2E',
    '',
    `- Outcome: ${report.outcome}`,
    `- Started: ${report.startedAt}`,
    `- Finished: ${report.finishedAt}`,
    `- Browser: ${report.browser || 'unavailable'}`,
    `- Build: ${report.build?.buildId || 'unavailable'}`,
    '',
    '## Warmup',
    '',
    `- Status: ${report.warmup?.status || 'unavailable'}`,
    `- Trusted actions: ${report.warmup?.actionCount ?? 0}`,
    `- Confirmed transitions: ${report.warmup?.measuredTransitionCount ?? 0}`,
    `- Readiness: ${report.warmup?.final?.readiness?.status || 'unavailable'}`,
    `- Capability: ${report.warmup?.final?.readiness?.capability || 'unavailable'}`,
    '',
    '## Debug-only dry-run',
    '',
    `- Status: ${report.dryRun?.status || 'skipped'}`,
    `- Morphology: ${report.dryRun?.morphology?.status || 'skipped'}`,
    `- Cleanup: ${report.dryRun?.cleanup?.status || 'skipped'}`,
    '',
    '## Production causal soak',
    '',
    `- Status: ${report.causalSoak?.status || 'skipped'}`,
    `- Reason: ${report.causalSoak?.reason || 'skipped'}`,
    `- Duration: ${report.causalSoak?.durationMs ?? 0} ms`,
    `- Trusted actions: ${report.causalSoak?.actionCount ?? 0}`,
    `- Confirmed transitions: ${report.causalSoak?.measuredTransitionCount ?? 0}`,
    `- Final phase: ${report.causalSoak?.final?.episode?.phase || 'unavailable'}`,
    '',
    '## Cost',
    '',
    `- Measurement window: ${report.cost?.measurementWindowMs ?? 0} ms`,
    `- Runtime cost state: ${report.cost?.debugger?.measurementState || 'unavailable'}`,
    `- Feed tempo cost state: ${report.cost?.feedTempo?.measurementState || 'unavailable'}`,
  ];
  if (report.errors.length > 0) {
    lines.push('', '## Errors', '');
    report.errors.forEach((error) => lines.push(`- ${error.phase}: ${error.message}`));
  }
  return `${lines.join('\n')}\n`;
}

async function writeReport(reportDir, report) {
  const runId = new Date().toISOString().replace(/[:.]/g, '-');
  const outputDir = path.resolve(reportDir, runId);
  await fs.mkdir(outputDir, { recursive: true });
  const jsonPath = path.join(outputDir, 'report.json');
  const markdownPath = path.join(outputDir, 'summary.md');
  await Promise.all([
    fs.writeFile(jsonPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8'),
    fs.writeFile(markdownPath, createMarkdownReport(report), 'utf8'),
  ]);
  return { outputDir, jsonPath, markdownPath };
}

function safeError(error, phase) {
  return {
    phase,
    message: String(error?.message || error || 'unknown'),
  };
}

export async function runFeedHorizonCausalE2E(options) {
  const startedAt = new Date().toISOString();
  const buildRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'entropy-feed-horizon-build-'));
  const errors = [];
  let harness = null;
  let page = null;
  let debuggerStarted = false;
  let progressionOverrideActive = false;
  let artifact = null;
  let qaArtifact = null;
  let metricsBefore = null;
  let metricsAfter = null;
  let finalPayload = null;
  let browserVersion = null;
  let warmup = null;
  let dryRun = null;
  let causalSoak = null;
  const scenario = getFeedHorizonScenario(options.siteId);
  try {
    artifact = await prepareDiagnosticArtifact(options, buildRoot);
    const qaProfilePath = options.profile;
    const temporaryManifest = {
      requiredPermissions: ['scripting'],
      requiredHostPermissions: scenario.allowlistedOrigins.map((origin) => `${origin}/*`),
    };
    qaArtifact = qaProfilePath
      ? await stageEntropyQaArtifact({
        profileDir: qaProfilePath,
        sourceDir: artifact.distDir,
        temporaryManifest,
      })
      : null;
    harness = new ExtensionChromiumHarness({
      chromePath: findChromeExecutable(options),
      distDir: qaArtifact?.slotDir || artifact.distDir,
      rootDir: '/',
      headless: options.headless,
      keepTemp: options.keepProfile && !qaProfilePath,
      qaProfileDir: qaProfilePath,
      qaProfileDirectory: options.profileDirectory,
      tempPrefix: 'entropy-feed-horizon-e2e-',
      temporaryManifest: qaArtifact ? null : temporaryManifest,
      loadInPlace: !!qaArtifact,
      trustedPagePath: qaArtifact ? ENTROPY_QA_TRUSTED_PAGE_PATH : null,
    });
    activeHarnessForInterrupt = harness;
    await harness.start();
    if (qaArtifact) {
      if (harness.uninstallExtensionOnClose) {
        throw new Error('FEED_HORIZON_E2E_QA_PROFILE_UNINSTALL_LIFECYCLE_FORBIDDEN');
      }
      await harness.reloadExtensionFromSource();
    }
    browserVersion = harness.browserVersion?.Browser || null;
    await prepareLaneArtifactDisclosure(harness, {
      lane: 'diagnostic',
      scenarios: [scenario],
      disposableProfile: true,
    });
    progressionOverrideActive = true;
    await configureScenario(
      harness,
      scenario,
      createScenarioSettingsPayload(scenario, true),
    );
    page = await harness.openPage(scenario.urls.primary, {
      active: true,
      timeoutMs: 45_000,
    });
    await activateScenarioTab(harness, page, {
      lane: 'diagnostic',
      focusWindow: false,
    });
    const readiness = await waitForScenarioReadiness(harness, page, scenario, {
      timeoutMs: 45_000,
    });
    if (!readiness.ready) {
      throw new Error(
        `FEED_HORIZON_E2E_PAGE_NOT_READY:${readiness.blocker?.reason || 'unknown'}`,
      );
    }
    await sendRuntimeDebuggerAutomationAction(
      harness,
      page,
      RUNTIME_DEBUGGER_AUTOMATION_ACTIONS.START,
      { captureKind: 'live' },
    );
    debuggerStarted = true;
    metricsBefore = await collectPageMetrics(harness, page, {
      label: 'feed-horizon-before',
      longTasks: [],
      longTaskMeasurement: { status: 'unavailable', reason: 'dedicated_causal_probe' },
      scenario,
    });

    warmup = await runWarmup({
      harness,
      page,
      scenario,
      dwellMs: options.dwellMs,
    });
    if (warmup.status !== 'PASS') {
      throw new Error('FEED_HORIZON_E2E_ENDPOINT_READINESS_NOT_REACHED');
    }

    if (!options.skipDryRun) {
      dryRun = await runDryRunProbe({
        harness,
        page,
        scenario,
        actionIndex: warmup.actionCount,
      });
      console.error(
        `[feed-horizon-e2e] dry-run status=${dryRun.status}`
        + ` morphology=${dryRun.morphology.status}`
        + ` cleanup=${dryRun.cleanup.status}`,
      );
      if (dryRun.status !== 'PASS') {
        throw new Error('FEED_HORIZON_E2E_DRY_RUN_CONTRACT_FAILED');
      }
    }

    if (!options.dryRunOnly) {
      causalSoak = await runFeedHorizonProductionCausalChain({
        harness,
        page,
        scenario,
        actionIndex: warmup.actionCount + (dryRun?.actions?.length || 0),
        dwellMs: options.dwellMs,
        budgetMs: options.maxMinutes * 60_000,
      });
    }

    finalPayload = await readDebuggerPayload(harness, page);
    metricsAfter = await collectPageMetrics(harness, page, {
      label: 'feed-horizon-after',
      longTasks: [],
      longTaskMeasurement: { status: 'unavailable', reason: 'dedicated_causal_probe' },
      scenario,
    });
  } catch (error) {
    errors.push(safeError(error, 'run'));
  } finally {
    if (debuggerStarted && harness && page) {
      try {
        const stopped = await sendRuntimeDebuggerAutomationAction(
          harness,
          page,
          RUNTIME_DEBUGGER_AUTOMATION_ACTIONS.STOP,
        );
        finalPayload ||= getAutomationPayload(stopped);
      } catch (error) {
        errors.push(safeError(error, 'debugger_stop'));
      }
    }
    if (harness) {
      try {
        await configureScenario(
          harness,
          scenario,
          createScenarioSettingsPayload(scenario, false),
        );
      } catch (error) {
        errors.push(safeError(error, 'feature_disable'));
      }
    }
    if (progressionOverrideActive && harness) {
      try {
        await clearDiagnosticArtifactDisclosureOverride(harness);
      } catch (error) {
        errors.push(safeError(error, 'progression_cleanup'));
      }
    }
    if (page && harness) {
      await harness.closePage(page).catch((error) => {
        errors.push(safeError(error, 'page_close'));
      });
    }
    if (harness) {
      await harness.close().catch((error) => {
        errors.push(safeError(error, 'harness_close'));
      });
      if (activeHarnessForInterrupt === harness) activeHarnessForInterrupt = null;
    }
    await fs.rm(buildRoot, { recursive: true, force: true });
  }

  const dryRunPass = options.skipDryRun || dryRun?.status === 'PASS';
  const soakPass = options.dryRunOnly || causalSoak?.status === 'PASS';
  const outcome = errors.length > 0
    ? 'FAIL'
    : dryRunPass && soakPass
      ? 'PASS'
      : 'WARN';
  const debuggerCost = finalPayload
    ? extractDebuggerCostEvidence(finalPayload)
    : null;
  const debuggerCostSummary = debuggerCost
    ? {
      measurementState: debuggerCost.measurementStates?.efficiency?.state || 'unavailable',
      measurementStates: debuggerCost.measurementStates || null,
      scanShape: debuggerCost.scanShape || null,
      observer: debuggerCost.observer || null,
      timings: debuggerCost.timings || null,
      overhead: debuggerCost.overhead || null,
    }
    : null;
  const finishedAt = new Date().toISOString();
  const report = {
    schemaVersion: REPORT_SCHEMA_VERSION,
    outcome,
    startedAt,
    finishedAt,
    siteId: scenario.siteId,
    routeId: new URL(scenario.urls.primary).pathname,
    options: {
      siteId: options.siteId,
      headless: options.headless,
      profileKind: options.profile ? 'dedicated_qa' : 'disposable',
      profileDirectory: options.profileDirectory,
      maxMinutes: options.maxMinutes,
      dwellMs: options.dwellMs,
      dryRunOnly: options.dryRunOnly,
      skipDryRun: options.skipDryRun,
    },
    build: artifact?.buildInfo || null,
    browser: browserVersion,
    warmup,
    dryRun,
    causalSoak,
    cost: {
      measurementWindowMs: metricsBefore && metricsAfter
        ? Math.max(
          0,
          Date.parse(metricsAfter.capturedAt) - Date.parse(metricsBefore.capturedAt),
        )
        : null,
      external: metricsBefore && metricsAfter
        ? diffCdpMetricSnapshots(metricsBefore, metricsAfter)
        : null,
      debugger: debuggerCostSummary,
      feedTempo: finalPayload?.latest?.feedFlow?.tempo?.cost || null,
    },
    errors,
  };
  const paths = await writeReport(options.reportDir, report);
  return { report, ...paths };
}

async function main() {
  const options = parseFeedHorizonCausalArgs(process.argv.slice(2));
  const result = await runFeedHorizonCausalE2E(options);
  console.log(`[feed-horizon-e2e] ${result.report.outcome}`);
  console.log(`[feed-horizon-e2e] JSON ${result.jsonPath}`);
  console.log(`[feed-horizon-e2e] Markdown ${result.markdownPath}`);
  if (result.report.outcome === 'FAIL') process.exitCode = 1;
}

if (process.argv[1] && path.resolve(process.argv[1]) === scriptPath) {
  process.once('SIGINT', () => closeActiveHarnessForInterrupt('SIGINT'));
  process.once('SIGTERM', () => closeActiveHarnessForInterrupt('SIGTERM'));
  main().catch((error) => {
    console.error(`[feed-horizon-e2e] FAIL ${error?.stack || error?.message || error}`);
    process.exit(1);
  });
}
