#!/usr/bin/env node
import { inferBrowserQaPlatform } from '../browser-qa/browser/windowsPlatform.mjs';

import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import readline from 'node:readline/promises';
import { registerQaChildAbortCleanup } from '../qa/runtime/qaChildAbortRegistry.mjs';
import { fileURLToPath } from 'node:url';

import {
  ExtensionChromiumHarness,
  evaluate,
  isWindowsChromeExecutable,
  normalizeChromiumHarnessCdpEndpoint,
  sleep,
} from './extensionChromiumHarness.mjs';
import {
  defineEntropyQaArtifactContentIdentity,
  ENTROPY_QA_TRUSTED_PAGE_PATH,
  resolveEntropyQaArtifactSlot,
  stageEntropyQaArtifact,
} from './qaProfileArtifactSlot.mjs';
import {
  classifyEndpointIsolationForScenario,
  classifyInstagramReelsHoldStability,
  classifyNativeEndpointMorphology,
  findChromeExecutable,
  getFeedHorizonScenario,
  prepareDiagnosticArtifact,
  readDebuggerPayload,
  readEndpointMorphology,
  readFeedSnapshot,
  resolveScenarioEndpointCapability,
  runFeedHorizonProductionCausalChain,
  verifyFeedHorizonGateNeutralBackward,
  runTrustedEndpointForwardStep,
  runWarmup,
  summarizeFeedSnapshot,
  waitForFeedState,
} from './feedHorizonCausalE2E.mjs';
import {
  createScenarioSettingsPayload,
} from './siteRuntimeE2E.mjs';
import {
  QA_MODES as FEED_HORIZON_QA_MODES,
} from '../qa/contracts/qaTargetContract.mjs';
import {
  admitQaAttachedExtensionBrowserChildExecution,
} from '../qa/contracts/qaBrowserChildExecutionContract.mjs';
import {
  resolveQaBrowserObservation,
} from '../qa/contracts/qaBrowserObservationContract.mjs';
import {
  proveEntropyAttachedArtifactRuntimeReadiness,
  observeEntropyAttachedPageExecution,
  classifyEntropyAttachedPageExecution,
} from '../qa/protocols/attachOnlyActivePageAdapter.mjs';
import {
  inspectWindowsChromeForegroundState,
} from '../qa/drivers/windowsChromeToolbarDriver.mjs';
import {
  RUNTIME_DEBUGGER_AUTOMATION_ACTIONS,
  activateScenarioTab,
  clearDiagnosticArtifactDisclosureOverride,
  configureScenario,
  prepareLaneArtifactDisclosure,
  sendRuntimeDebuggerAutomationAction,
  waitForScenarioReadiness,
} from './sites/siteRuntimeBrowser.mjs';
import {
  runFeedConsumptionResearchJourney,
} from './feed-consumption-research/feedConsumptionResearchBrowser.mjs';
const scriptPath = fileURLToPath(import.meta.url);
const rootDir = path.resolve(path.dirname(scriptPath), '../..');
const DEFAULT_STILL_GATE_MS = 10_000;
const DEFAULT_DWELL_MS = 1_350;
const ENDPOINT_COMMIT_INITIAL_SETTLE_MS = 500;
const ENDPOINT_COMMIT_DRIVE_POLICY_BY_SURFACE_MODE = Object.freeze({
  paged: Object.freeze({
    surfaceMode: 'paged',
    maximumSteps: 12,
  }),
  continuous: Object.freeze({
    surfaceMode: 'continuous',
    maximumSteps: 32,
  }),
});
const BOUNDARY_DRIVE_MAX_STEPS = 8;
const INSPECTION_RENEWED_DEMAND_POLICY = Object.freeze({
  actionsPerBurst: 6,
  maximumActions: 12,
  actionDwellMs: 50,
  feedbackObservationMs: 750,
  feedbackPollMs: 50,
});
const INSPECTION_SETTLE_BUFFER_MS = 5_000;
const ENDPOINT_READINESS_MAX_PASSES = 4;
const ENDPOINT_CONTROL_MAX_ATTEMPTS = 3;
const DEFAULT_OPERATOR_ADVANCE_COUNT = 4;
const OPERATOR_ARM_POLL_MS = 500;

let activeHarness = null;
let activeCleanupContext = null;
let cleanupStarted = false;

export function assertInspectionOsFocusPreserved(baseline, afterActivation, {
  browserObservation = null,
} = {}) {
  const observation = resolveQaBrowserObservation(browserObservation);
  if (baseline === null && afterActivation === null) {
    return Object.freeze({ applicable: false, preserved: null });
  }
  if (
    baseline?.operation !== 'inspect_foreground'
    || afterActivation?.operation !== 'inspect_foreground'
    || typeof baseline.browserIsForeground !== 'boolean'
    || typeof afterActivation.browserIsForeground !== 'boolean'
  ) {
    throw new Error('FEED_HORIZON_INSPECTION_OS_FOCUS_EVIDENCE_INVALID');
  }
  if (observation !== null) {
    // Native document/frame/foreground eligibility has its own evidence owner.
    // Reading this state neither proves nor performs a focus action; an operator
    // may keep Chrome foreground or switch apps without an automated repair.
    return Object.freeze({
      applicable: true,
      preserved: null,
      browserObservation: observation,
      baselineBrowserIsForeground: baseline.browserIsForeground,
      browserIsForeground: afterActivation.browserIsForeground,
      policy: 'native_observation',
      evidenceRole: 'window_state_only_no_focus_action',
    });
  }
  if (baseline.browserIsForeground === true) {
    const error = new Error('QA_BROWSER_OS_FOCUS_BASELINE_FOREGROUND');
    error.code = 'QA_BROWSER_OS_FOCUS_BASELINE_FOREGROUND';
    throw error;
  }
  if (afterActivation.browserIsForeground === true) {
    const error = new Error('QA_BROWSER_OS_FOCUS_CONTRACT_VIOLATION');
    error.code = 'QA_BROWSER_OS_FOCUS_CONTRACT_VIOLATION';
    throw error;
  }
  return Object.freeze({ applicable: true, preserved: true });
}

export function projectInspectionReadinessBlocker(readiness) {
  const reason = readiness?.blocker?.reason;
  const requiredFlag = {
    login_surface: 'authSurface', captcha: 'captchaSurface',
    two_factor: 'twoFactorSurface', consent_takeover: 'consentSurface',
  }[reason];
  if (readiness?.ready !== false || !requiredFlag
    || readiness.state?.[requiredFlag] !== true) return null;
  return {
    status: 'blocked', reason,
    evidence: { schemaVersion: 2, stage: 'site_readiness',
      authSurface: readiness.state.authSurface === true,
      captchaSurface: readiness.state.captchaSurface === true,
      twoFactorSurface: readiness.state.twoFactorSurface === true,
      consentSurface: readiness.state.consentSurface === true },
  };
}

async function inspectAttachedWindowsChromeForeground(options) {
  if (
    !options.cdpEndpoint
    || !isWindowsChromeExecutable(options.chromePath)
  ) return null;
  return inspectWindowsChromeForegroundState({
    chromePath: options.chromePath,
    cdpEndpoint: options.cdpEndpoint,
  });
}

export async function requireInspectionExecution({ harness, page, observation, phase }) {
  if (observation === null) return null;
  const execution = await observeEntropyAttachedPageExecution(harness, page);
  const reason = classifyEntropyAttachedPageExecution(execution, observation);
  const evidence = { schemaVersion: 1, phase, observation, reason, execution };
  console.log(JSON.stringify({ status: 'AGENT_EXECUTION_OBSERVED', evidence }));
  if (reason !== 'ready') {
    const error = new Error(`FEED_HORIZON_EXECUTION_UNAVAILABLE:${reason}`);
    error.feedHorizonExecutionBlocker = evidence;
    throw error;
  }
  return evidence;
}

export function resolveInspectionEndpointCommitDrivePolicy(scenario) {
  const surfaceMode = scenario?.feedConsumption?.surfaceMode;
  const policy = ENDPOINT_COMMIT_DRIVE_POLICY_BY_SURFACE_MODE[surfaceMode];
  if (!policy) {
    throw new Error(
      `FEED_HORIZON_INSPECTION_ENDPOINT_COMMIT_SURFACE_MODE_UNSUPPORTED:${String(surfaceMode)}`,
    );
  }
  return policy;
}

export function createFeedResearchSettingsPayload(scenario, featureProfile = 'feed_only') {
  const payload = createScenarioSettingsPayload(scenario, true);
  const profile = {
    feed_only: { socialMetrics: false, videoSkipGuard: false },
    feed_social: { socialMetrics: true, videoSkipGuard: false },
    feed_video_skip: { socialMetrics: false, videoSkipGuard: true },
    feed_social_video_skip: { socialMetrics: true, videoSkipGuard: true },
  }[featureProfile];
  if (!profile) {
    throw new Error('FEED_HORIZON_INSPECTION_RESEARCH_FEATURE_PROFILE_INVALID');
  }
  const socialMetrics = payload?.filterSettings?.socialMetrics;
  const videoSkipGuard = payload?.filterSettings?.videoSkipGuard;
  if (!socialMetrics || typeof socialMetrics !== 'object') {
    throw new Error('FEED_HORIZON_INSPECTION_RESEARCH_SOCIAL_SETTINGS_REQUIRED');
  }
  if (!videoSkipGuard || typeof videoSkipGuard !== 'object') {
    throw new Error('FEED_HORIZON_INSPECTION_RESEARCH_VIDEO_SKIP_SETTINGS_REQUIRED');
  }
  return {
    ...payload,
    filterSettings: {
      ...payload.filterSettings,
      socialMetrics: {
        ...socialMetrics,
        isActive: profile.socialMetrics,
      },
      videoSkipGuard: {
        ...videoSkipGuard,
        isActive: profile.videoSkipGuard,
      },
    },
  };
}

function parseInteger(value, code, minimum, maximum) {
  const numeric = Number(value);
  if (!Number.isSafeInteger(numeric) || numeric < minimum || numeric > maximum) {
    throw new Error(`${code}:${String(value)}`);
  }
  return numeric;
}

function parseFiniteNumber(value, code, minimum, maximum) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric < minimum || numeric > maximum) {
    throw new Error(`${code}:${String(value)}`);
  }
  return numeric;
}

export function parseFeedHorizonInspectionArgs(argv) {
  const options = {
    siteId: 'tiktok',
    headless: true,
    presentationOptionExplicit: false,
    build: true,
    chromePath: null,
    cdpEndpoint: null,
    profile: null,
    profileDirectory: null,
    profileSlotId: null,
    extensionSlotAdmission: null,
    artifactId: null,
    artifactInputDigest: null,
    artifactBuildId: null,
    artifactReleaseProfile: null,
    diagnosticDist: null,
    captureDir: null,
    dwellMs: DEFAULT_DWELL_MS,
    stillGateMs: DEFAULT_STILL_GATE_MS,
    // 0 means "no natural-gate drive", which is every existing target.
    gateDriveMs: 0,
    inspectionGate: false,
    operatorDriven: false,
    operatorAdvanceCount: DEFAULT_OPERATOR_ADVANCE_COUNT,
    executionMode: null,
    researchJourney: null,
    researchOutputDir: null,
    researchCandidateThreshold: 0.78,
    researchReferenceDwellMs: 5_000,
    researchFeatureProfile: 'feed_only',
    requireVideo: false,
    browserObservation: null,
  };
  let operatorAdvanceCountExplicit = false;
  for (const arg of argv) {
    if (arg.startsWith('--site=')) options.siteId = arg.slice('--site='.length);
    else if (arg === '--headless') {
      options.headless = true;
      options.presentationOptionExplicit = true;
    } else if (arg === '--headed') {
      options.headless = false;
      options.presentationOptionExplicit = true;
    } else if (arg === '--no-build') options.build = false;
    else if (arg === '--require-video') options.requireVideo = true;
    else if (arg === '--inspection-gate') options.inspectionGate = true;
    else if (arg.startsWith('--browser-observation=')) {
      options.browserObservation = resolveQaBrowserObservation(
        arg.slice('--browser-observation='.length),
      );
    }
    else if (arg.startsWith('--capture-dir=')) {
      options.captureDir = path.resolve(arg.slice('--capture-dir='.length));
    } else if (arg.startsWith('--chrome=')) options.chromePath = arg.slice('--chrome='.length);
    else if (arg.startsWith('--cdp-endpoint=')) {
      options.cdpEndpoint = normalizeChromiumHarnessCdpEndpoint(
        arg.slice('--cdp-endpoint='.length),
      );
    } else if (arg.startsWith('--profile=')) {
      options.profile = arg.slice('--profile='.length);
    } else if (arg.startsWith('--profile-directory=')) {
      options.profileDirectory = arg.slice('--profile-directory='.length);
    } else if (arg.startsWith('--profile-slot-id=')) {
      options.profileSlotId = arg.slice('--profile-slot-id='.length);
    } else if (arg.startsWith('--extension-slot-admission=')) {
      options.extensionSlotAdmission = arg.slice(
        '--extension-slot-admission='.length,
      );
    } else if (arg.startsWith('--artifact-id=')) {
      options.artifactId = arg.slice('--artifact-id='.length);
    } else if (arg.startsWith('--artifact-input-digest=')) {
      options.artifactInputDigest = arg.slice('--artifact-input-digest='.length);
    } else if (arg.startsWith('--artifact-build-id=')) {
      options.artifactBuildId = arg.slice('--artifact-build-id='.length);
    } else if (arg.startsWith('--artifact-release-profile=')) {
      options.artifactReleaseProfile = arg.slice('--artifact-release-profile='.length);
    } else if (arg.startsWith('--diagnostic-dist=')) {
      options.diagnosticDist = arg.slice('--diagnostic-dist='.length);
    } else if (arg === '--operator-driven') {
      options.operatorDriven = true;
    } else if (arg.startsWith('--mode=')) {
      const executionMode = arg.slice('--mode='.length);
      if (!Object.values(FEED_HORIZON_QA_MODES).includes(executionMode)) {
        throw new Error(
          `FEED_HORIZON_INSPECTION_MODE_UNSUPPORTED:${executionMode || 'missing'}`,
        );
      }
      options.executionMode = executionMode;
    } else if (arg.startsWith('--operator-advance-count=')) {
      operatorAdvanceCountExplicit = true;
      options.operatorAdvanceCount = parseInteger(
        arg.slice('--operator-advance-count='.length),
        'FEED_HORIZON_INSPECTION_OPERATOR_ADVANCE_COUNT_INVALID',
        2,
        12,
      );
    } else if (arg.startsWith('--dwell-ms=')) {
      options.dwellMs = parseInteger(
        arg.slice('--dwell-ms='.length),
        'FEED_HORIZON_INSPECTION_DWELL_MS_INVALID',
        900,
        7_000,
      );
    } else if (arg.startsWith('--gate-drive-ms=')) {
      // 0 keeps every existing target on the endpoint-driven path unchanged.
      options.gateDriveMs = parseInteger(
        arg.slice('--gate-drive-ms='.length),
        'FEED_HORIZON_INSPECTION_GATE_DRIVE_MS_INVALID',
        0,
        900_000,
      );
    } else if (arg.startsWith('--still-gate-ms=')) {
      options.stillGateMs = parseInteger(
        arg.slice('--still-gate-ms='.length),
        'FEED_HORIZON_INSPECTION_STILL_GATE_MS_INVALID',
        0,
        30_000,
      );
    } else if (arg.startsWith('--research-journey=')) {
      options.researchJourney = arg.slice('--research-journey='.length);
    } else if (arg.startsWith('--research-output-dir=')) {
      options.researchOutputDir = arg.slice('--research-output-dir='.length);
    } else if (arg.startsWith('--research-candidate-threshold=')) {
      options.researchCandidateThreshold = parseFiniteNumber(
        arg.slice('--research-candidate-threshold='.length),
        'FEED_HORIZON_INSPECTION_RESEARCH_THRESHOLD_INVALID',
        0.55,
        0.9,
      );
    } else if (arg.startsWith('--research-reference-dwell-ms=')) {
      options.researchReferenceDwellMs = parseInteger(
        arg.slice('--research-reference-dwell-ms='.length),
        'FEED_HORIZON_INSPECTION_RESEARCH_REFERENCE_DWELL_INVALID',
        3_750,
        6_250,
      );
    } else if (arg.startsWith('--research-feature-profile=')) {
      options.researchFeatureProfile = arg.slice('--research-feature-profile='.length);
    } else {
      throw new Error(`FEED_HORIZON_INSPECTION_ARGUMENT_UNKNOWN:${arg}`);
    }
  }
  if (!options.profile || !path.isAbsolute(options.profile)) {
    throw new Error('FEED_HORIZON_INSPECTION_QA_PROFILE_ABSOLUTE_REQUIRED');
  }
  options.profile = path.normalize(options.profile);
  if (options.inspectionGate && (options.executionMode !== FEED_HORIZON_QA_MODES.AGENT
    || options.gateDriveMs > 0 || options.researchJourney)) {
    throw new Error('FEED_HORIZON_INSPECTION_GATE_MODE_CONFLICT');
  }
  if (options.requireVideo && (options.executionMode !== FEED_HORIZON_QA_MODES.AGENT || !options.captureDir)) {
    throw new Error('FEED_HORIZON_VIDEO_INSPECTION_REQUIRES_AGENT_CAPTURE');
  }
  if (operatorAdvanceCountExplicit && !options.operatorDriven) {
    throw new Error('FEED_HORIZON_INSPECTION_OPERATOR_MODE_REQUIRED');
  }
  if (options.executionMode && options.operatorDriven) {
    throw new Error('FEED_HORIZON_INSPECTION_MODE_CONFLICT');
  }
  if (options.operatorDriven && !options.cdpEndpoint && options.headless) {
    throw new Error('FEED_HORIZON_INSPECTION_OPERATOR_HEADED_REQUIRED');
  }
  if (options.cdpEndpoint) {
    if (options.presentationOptionExplicit) {
      throw new Error(
        'FEED_HORIZON_INSPECTION_ATTACH_PRESENTATION_OPTION_FORBIDDEN',
      );
    }
    if (!options.profileDirectory) {
      throw new Error(
        'FEED_HORIZON_INSPECTION_ATTACH_PROFILE_DIRECTORY_REQUIRED',
      );
    }
    if (!options.chromePath || !path.isAbsolute(options.chromePath)) {
      throw new Error(
        'FEED_HORIZON_INSPECTION_ATTACH_CHROME_ABSOLUTE_REQUIRED',
      );
    }
    options.chromePath = path.normalize(options.chromePath);
  }
  if (
    options.profileDirectory !== null
    && (
      !options.profileDirectory.trim()
      || options.profileDirectory !== options.profileDirectory.trim()
    )
  ) {
    throw new Error('FEED_HORIZON_INSPECTION_PROFILE_DIRECTORY_INVALID');
  }
  if (
    options.profileSlotId !== null
    && (
      !options.profileSlotId.trim()
      || options.profileSlotId !== options.profileSlotId.trim()
      || !/^[a-z][a-z0-9_.-]*$/u.test(options.profileSlotId)
    )
  ) {
    throw new Error('FEED_HORIZON_INSPECTION_PROFILE_SLOT_ID_INVALID');
  }
  if (
    options.extensionSlotAdmission !== null
    && !['ready', 'pending_stage'].includes(options.extensionSlotAdmission)
  ) {
    throw new Error('FEED_HORIZON_INSPECTION_EXTENSION_SLOT_ADMISSION_INVALID');
  }
  const artifactIdentityValues = [
    options.artifactId,
    options.artifactInputDigest,
    options.artifactBuildId,
    options.artifactReleaseProfile,
  ];
  if (
    artifactIdentityValues.some((value) => value !== null)
    && artifactIdentityValues.some((value) => value === null)
  ) {
    throw new Error('FEED_HORIZON_INSPECTION_ARTIFACT_IDENTITY_INCOMPLETE');
  }
  if (!options.build) {
    if (!options.diagnosticDist || !path.isAbsolute(options.diagnosticDist)) {
      throw new Error('FEED_HORIZON_INSPECTION_DIAGNOSTIC_DIST_ABSOLUTE_REQUIRED');
    }
    options.diagnosticDist = path.normalize(options.diagnosticDist);
  }
  if (![
    'tiktok',
    'youtube',
    'instagram',
    'x',
    'instagram-home',
    'facebook',
    'youtube-home',
  ].includes(options.siteId)) {
    throw new Error(`FEED_HORIZON_INSPECTION_SITE_UNSUPPORTED:${String(options.siteId)}`);
  }
  if (options.researchJourney !== null) {
    if (!options.researchJourney.trim()) {
      throw new Error('FEED_HORIZON_INSPECTION_RESEARCH_JOURNEY_REQUIRED');
    }
    if (!options.researchOutputDir || !path.isAbsolute(options.researchOutputDir)) {
      throw new Error('FEED_HORIZON_INSPECTION_RESEARCH_OUTPUT_DIR_ABSOLUTE_REQUIRED');
    }
    options.researchOutputDir = path.normalize(options.researchOutputDir);
    if (options.operatorDriven || options.executionMode === FEED_HORIZON_QA_MODES.HUMAN) {
      throw new Error('FEED_HORIZON_INSPECTION_RESEARCH_AUTOMATION_REQUIRED');
    }
    if (![
      'feed_only',
      'feed_social',
      'feed_video_skip',
      'feed_social_video_skip',
    ].includes(options.researchFeatureProfile)) {
      throw new Error('FEED_HORIZON_INSPECTION_RESEARCH_FEATURE_PROFILE_INVALID');
    }
  } else if (options.researchOutputDir !== null) {
    throw new Error('FEED_HORIZON_INSPECTION_RESEARCH_JOURNEY_REQUIRED');
  } else if (options.researchFeatureProfile !== 'feed_only') {
    throw new Error('FEED_HORIZON_INSPECTION_RESEARCH_JOURNEY_REQUIRED');
  }
  return options;
}

function readFeedFlow(payload) {
  const feedFlow = payload?.latest?.feedFlow;
  if (!feedFlow || typeof feedFlow !== 'object') {
    throw new Error('FEED_HORIZON_INSPECTION_FEED_FLOW_REQUIRED');
  }
  return feedFlow;
}

function printState(label, payload) {
  const summary = summarizeFeedSnapshot(readFeedFlow(payload));
  const featureDiagnostics = payload?.latest?.protection?.features?.infiniteScrollGuard || {};
  const recentFeatureErrors = Array.isArray(featureDiagnostics.history)
    ? featureDiagnostics.history.filter((entry) => entry?.type === 'error').slice(-6)
    : [];
  const debuggerErrors = Array.isArray(payload?.latest?.debugger?.errors)
    ? payload.latest.debugger.errors.slice(-6)
    : [];
  console.log(JSON.stringify({
    label,
    muted: true,
    readiness: summary.readiness,
    actuationSafety: summary.actuationSafety,
    advanceCount: summary.advanceCount,
    endpointDecision: summary.episode?.feedDecision || null,
    episode: summary.episode,
    failures: {
      lastFeatureError: featureDiagnostics.lastError || null,
      recentFeatureErrors,
      debuggerErrors,
    },
  }, null, 2));
  return summary;
}

function isCanonicalEndpointReady(summary, scenario) {
  const decision = summary?.episode?.feedDecision;
  const expectedCapability = resolveScenarioEndpointCapability(scenario);
  return (
    decision?.readiness?.status === 'ready'
    && decision?.readiness?.capability === expectedCapability
    && decision?.actuationSafety?.status === 'safe'
    && decision?.actuationSafety?.capability === expectedCapability
  );
}

const TERMINAL_PREFLIGHT_READINESS_REASONS = new Set([
  'shipped_topology_live_mismatch',
  'shipped_topology_scroller_mismatch',
  'topology_drift_suspected',
]);

export function classifyInspectionPreflightState(summary, scenario) {
  if (isCanonicalEndpointReady(summary, scenario)) {
    return Object.freeze({
      status: 'ready',
      reason: 'canonical_endpoint_ready',
    });
  }
  const readinessReasons = Array.isArray(summary?.readiness?.reasons)
    ? summary.readiness.reasons
    : [];
  const terminalReasons = readinessReasons.filter(
    (reason) => TERMINAL_PREFLIGHT_READINESS_REASONS.has(reason),
  );
  if (
    summary?.readiness?.status === 'ready'
    && summary?.actuationSafety?.status === 'unsafe'
    && terminalReasons.length > 0
  ) {
    return Object.freeze({
      status: 'blocked',
      reason: 'canonical_topology_mismatch',
      terminalReasons: Object.freeze([...terminalReasons]),
      safetyReasons: Object.freeze([
        ...(Array.isArray(summary?.actuationSafety?.reasons)
          ? summary.actuationSafety.reasons
          : []),
      ]),
    });
  }
  return Object.freeze({
    status: 'warming',
    reason: 'canonical_endpoint_learning',
  });
}

export function classifyOperatorInspectionArmReadiness({
  summary,
  scenario,
  baselineAdvanceCount,
  requiredAdvanceCount = DEFAULT_OPERATOR_ADVANCE_COUNT,
}) {
  if (
    !Number.isSafeInteger(requiredAdvanceCount)
    || requiredAdvanceCount < 2
    || requiredAdvanceCount > 12
  ) {
    throw new Error(
      `FEED_HORIZON_INSPECTION_OPERATOR_ADVANCE_COUNT_INVALID:${String(requiredAdvanceCount)}`,
    );
  }
  const baseline = Math.max(0, Math.round(Number(baselineAdvanceCount) || 0));
  const currentAdvanceCount = Math.max(
    0,
    Math.round(Number(summary?.advanceCount) || 0),
  );
  const observedAdvanceCount = Math.max(0, currentAdvanceCount - baseline);
  const endpointReady = isCanonicalEndpointReady(summary, scenario);
  return Object.freeze({
    status: observedAdvanceCount >= requiredAdvanceCount && endpointReady
      ? 'ready_to_arm'
      : 'waiting',
    endpointReady,
    baselineAdvanceCount: baseline,
    currentAdvanceCount,
    observedAdvanceCount,
    requiredAdvanceCount,
  });
}

export function isInspectionBoundaryMotionAtRest(feedFlow) {
  const endpoint = feedFlow?.episode?.endpoint;
  const motion = endpoint?.boundaryMotion;
  const displacementPx = Number(motion?.displacementPx);
  const restTolerancePx = Number(motion?.restTolerancePx);
  return (
    endpoint?.boundaryReached === true
    && motion
    && motion.settling === false
    && Number.isFinite(displacementPx)
    && Number.isFinite(restTolerancePx)
    && restTolerancePx >= 0
    && displacementPx <= restTolerancePx
  );
}

async function ensureAutomationSession(harness, page, captureKind = 'live') {
  try {
    return await readDebuggerPayload(harness, page);
  } catch (error) {
    const message = String(error?.message || error);
    if (!message.includes('RUNTIME_DEBUGGER_AUTOMATION_SESSION_INACTIVE')) throw error;
  }
  const response = await sendRuntimeDebuggerAutomationAction(
    harness,
    page,
    RUNTIME_DEBUGGER_AUTOMATION_ACTIONS.START,
    { captureKind },
  );
  return response?.result?.payload || response?.result;
}

async function armFromOperatorProgress({
  harness,
  page,
  scenario,
  options,
  control,
}) {
  const initialPayload = await ensureAutomationSession(harness, page, 'reload');
  let summary = summarizeFeedSnapshot(readFeedFlow(initialPayload));
  let baselineAdvanceCount = summary.advanceCount;
  let previousAdvanceCount = summary.advanceCount;
  let previousSignature = '';

  while (!control.cancelled) {
    const payload = await ensureAutomationSession(harness, page, 'reload');
    summary = summarizeFeedSnapshot(readFeedFlow(payload));
    if (summary?.episode?.inspection?.active === true) {
      return {
        status: 'ALREADY_ARMED',
        syntheticInputCount: 0,
        summary,
      };
    }
    if (summary.advanceCount < previousAdvanceCount) {
      baselineAdvanceCount = summary.advanceCount;
    }
    previousAdvanceCount = summary.advanceCount;
    const preflight = classifyInspectionPreflightState(summary, scenario);
    if (preflight.status === 'blocked') {
      throw new Error(
        `FEED_HORIZON_INSPECTION_PREFLIGHT_BLOCKED:${JSON.stringify({
          preflight,
          summary,
        })}`,
      );
    }
    const readiness = classifyOperatorInspectionArmReadiness({
      summary,
      scenario,
      baselineAdvanceCount,
      requiredAdvanceCount: options.operatorAdvanceCount,
    });
    const signature = JSON.stringify({
      observedAdvanceCount: readiness.observedAdvanceCount,
      endpointReady: readiness.endpointReady,
      readinessStatus: summary.readiness?.status || null,
      safetyStatus: summary.actuationSafety?.status || null,
    });
    if (signature !== previousSignature) {
      previousSignature = signature;
      console.log(JSON.stringify({
        label: 'operator-arm-progress',
        muted: true,
        syntheticInputCount: 0,
        ...readiness,
        readiness: summary.readiness,
        actuationSafety: summary.actuationSafety,
      }, null, 2));
    }
    if (readiness.status === 'ready_to_arm') {
      try {
        const armedPayload = await controlInspection({
          harness,
          page,
          command: 'arm',
          stillGateMs: options.stillGateMs,
        });
        const armedSummary = printState('operator-armed', armedPayload);
        console.log(JSON.stringify({
          label: 'operator-arm',
          status: 'ARMED',
          muted: true,
          syntheticInputCount: 0,
          observedAdvanceCount: readiness.observedAdvanceCount,
          requiredAdvanceCount: readiness.requiredAdvanceCount,
          next: 'Continue scrolling to reach the native endpoint boundary.',
        }, null, 2));
        return {
          status: 'ARMED',
          syntheticInputCount: 0,
          summary: armedSummary,
        };
      } catch (error) {
        if (!String(error?.message || error).includes(
          'ENSO_FEED_HORIZON_INSPECTION_ENDPOINT_NOT_READY',
        )) {
          throw error;
        }
      }
    }
    await sleep(OPERATOR_ARM_POLL_MS);
  }
  if (control.cancelled) {
    return {
      status: 'CANCELLED',
      syntheticInputCount: 0,
      summary,
    };
  }
  throw new Error('FEED_HORIZON_INSPECTION_OPERATOR_ARM_CANCEL_STATE_INVALID');
}

async function hasVisibleInspectionVideo(harness, page) {
  return evaluate(harness.cdp, page.sessionId, `(() =>
    Array.from(document.querySelectorAll('video')).some(video => {
      const r = video.getBoundingClientRect();
      return r.width > 0 && r.height > 0 && r.right > 0 && r.left < innerWidth
        && Math.min(r.bottom, innerHeight) - Math.max(0, r.top) >= innerHeight * 0.42
        && video.readyState >= 2 && !video.error && !video.closest('[inert]');
    }))()`);
}

async function ensureEndpointReadiness({ harness, page, scenario, dwellMs, requireVideo = false }) {
  let current = printState(
    'pre-arm',
    await ensureAutomationSession(harness, page, 'reload'),
  );
  let preflight = classifyInspectionPreflightState(current, scenario);
  if (preflight.status === 'ready' && (!requireVideo || await hasVisibleInspectionVideo(harness, page))) return current;
  if (preflight.status === 'blocked') {
    throw new Error(
      `FEED_HORIZON_INSPECTION_PREFLIGHT_BLOCKED:${JSON.stringify({
        preflight,
        summary: current,
      })}`,
    );
  }
  for (let pass = 0; pass < ENDPOINT_READINESS_MAX_PASSES; pass += 1) {
    const warmup = await runWarmup({
      harness,
      page,
      scenario,
      dwellMs,
      readinessPredicate: requireVideo ? () => hasVisibleInspectionVideo(harness, page) : null,
      stopPredicate: (summary) => {
        const state = classifyInspectionPreflightState(summary, scenario);
        return state.status === 'blocked' ? state : null;
      },
    });
    current = printState(
      `pre-arm-warmup-${pass + 1}`,
      await readDebuggerPayload(harness, page),
    );
    preflight = classifyInspectionPreflightState(current, scenario);
    if (preflight.status === 'ready' && (!requireVideo || await hasVisibleInspectionVideo(harness, page))) return current;
    if (warmup.status === 'BLOCKED' && warmup.blocker?.status === 'blocked') {
      const error = new Error(
        `FEED_HORIZON_INSPECTION_PAGE_BLOCKED:${warmup.blocker.reason}`,
      );
      error.feedHorizonPageBlocker = warmup.blocker;
      throw error;
    }
    if (preflight.status === 'blocked') {
      throw new Error(
        `FEED_HORIZON_INSPECTION_PREFLIGHT_BLOCKED:${JSON.stringify({
          preflight,
          warmupReason: warmup.reason || null,
          summary: current,
        })}`,
      );
    }
    if (warmup.status !== 'PASS') break;
  }
  throw new Error(
    `FEED_HORIZON_INSPECTION_ENDPOINT_NOT_READY:${JSON.stringify(current)}`,
  );
}

async function controlInspection({
  harness,
  page,
  command,
  stillGateMs,
  handoffMode = 'feedback_only',
}) {
  const response = await sendRuntimeDebuggerAutomationAction(
    harness,
    page,
    RUNTIME_DEBUGGER_AUTOMATION_ACTIONS.CONTROL_FEED_HORIZON_INSPECTION,
    command === 'disarm'
      ? { command }
      : {
        command,
        stillGateMs,
        handoffMode,
      },
  );
  return response?.result?.payload || response?.result;
}

async function beginInspectionCycle({
  harness,
  page,
  scenario,
  command,
  options,
}) {
  let lastError = null;
  for (let attempt = 0; attempt < ENDPOINT_CONTROL_MAX_ATTEMPTS; attempt += 1) {
    await ensureEndpointReadiness({
      harness,
      page,
      scenario,
      dwellMs: options.dwellMs,
      requireVideo: options.requireVideo,
    });
    if (options.requireVideo && options.captureDir) {
      await captureHorizonPresentation({ harness, page, scenario,
        outputDir: options.captureDir, phase: 'ready-to-arm' });
    }
    try {
      return await controlInspection({
        harness,
        page,
        command,
        stillGateMs: options.stillGateMs,
        handoffMode: options.inspectionGate ? 'production' : 'feedback_only',
      });
    } catch (error) {
      lastError = error;
      const endpointReadinessChanged = String(error?.message || error).includes(
        'ENSO_FEED_HORIZON_INSPECTION_ENDPOINT_NOT_READY',
      );
      if (!endpointReadinessChanged || attempt + 1 >= ENDPOINT_CONTROL_MAX_ATTEMPTS) {
        throw error;
      }
      console.error(
        `[feed-horizon-inspection] canonical endpoint readiness changed before ${command};`
        + ` retry=${attempt + 2}/${ENDPOINT_CONTROL_MAX_ATTEMPTS}`,
      );
    }
  }
  throw lastError || new Error('FEED_HORIZON_INSPECTION_CONTROL_NOT_ATTEMPTED');
}

function waitForInspectionEndpointCommit({
  harness,
  page,
  timeoutMs,
}) {
  return waitForFeedState({
    harness,
    page,
    timeoutMs,
    pollMs: 100,
    predicate: (feedFlow) => (
      feedFlow?.episode?.inspection?.active === true
      && feedFlow?.episode?.endpoint?.leaseState === 'committed'
      && feedFlow?.episode?.endpoint?.active === true
    ),
    abortPredicate: (feedFlow) => feedFlow?.episode?.inspection?.active !== true,
  });
}

async function driveInspectionEndpointCommit({
  harness,
  page,
  scenario,
}) {
  const drivePolicy = resolveInspectionEndpointCommitDrivePolicy(scenario);
  const commitActions = [];
  let committed = await waitForInspectionEndpointCommit({
    harness,
    page,
    timeoutMs: ENDPOINT_COMMIT_INITIAL_SETTLE_MS,
  });
  while (
    !committed.ok
    && committed.aborted !== true
    && commitActions.length < drivePolicy.maximumSteps
  ) {
    commitActions.push(await runTrustedEndpointForwardStep({
      harness,
      page,
      scenario,
      index: commitActions.length,
      dwellMs: 100,
      phase: 'boundary',
    }));
    committed = await waitForInspectionEndpointCommit({
      harness,
      page,
      timeoutMs: 1_000,
    });
  }
  if (!committed.ok) {
    printState('endpoint-commit-failed', committed.payload);
    throw new Error(
      `FEED_HORIZON_INSPECTION_ENDPOINT_COMMIT_${committed.aborted ? 'ABORTED' : 'TIMEOUT'}:${JSON.stringify({
        drivePolicy,
        snapshot: committed.snapshot,
      })}`,
    );
  }
  return {
    actions: commitActions,
    drivePolicy,
    payload: committed.payload,
  };
}

async function emitHumanInspectionHandoff({
  harness,
  page,
  scenario,
  options,
  artifactSync,
}) {
  const payload = await ensureAutomationSession(harness, page, 'reload');
  const summary = printState('human-handoff', payload);
  const preflight = classifyInspectionPreflightState(summary, scenario);
  if (preflight.status === 'blocked') {
    throw new Error(
      `FEED_HORIZON_INSPECTION_PREFLIGHT_BLOCKED:${JSON.stringify({
        preflight,
        summary,
      })}`,
    );
  }
  const morphology = await readEndpointMorphology(harness, page);
  const inspection = summary?.episode?.inspection || {};
  const endpoint = summary?.episode?.endpoint || {};
  const endpointArtifactCount = [
    morphology.markerCount,
    morphology.tailCount,
    morphology.quarantineCount,
    morphology.terminusCount,
  ].reduce((total, count) => total + Math.max(0, Number(count) || 0), 0);
  if (
    inspection.active === true
    || endpoint.armed === true
    || endpoint.active === true
    || endpoint.boundaryReached === true
    || endpoint.leaseState !== 'idle'
    || endpointArtifactCount !== 0
    || morphology.gateCount !== 0
  ) {
    throw new Error(
      `FEED_HORIZON_INSPECTION_HUMAN_HANDOFF_INVALID:${JSON.stringify({
        inspection,
        endpoint,
        endpointArtifactCount,
        morphology,
      })}`,
    );
  }
  console.log(JSON.stringify({
    status: 'READY_FOR_HUMAN',
    muted: true,
    preparationMode: 'human_input',
    syntheticInputCount: 0,
    inspectionArmed: false,
    endpointLeaseState: endpoint.leaseState,
    boundaryReached: false,
    requiredAdvanceCount: options.operatorAdvanceCount,
    productionGateCount: morphology.gateCount,
    surfaceMode: scenario.feedConsumption?.surfaceMode || null,
    capability: resolveScenarioEndpointCapability(scenario),
    artifactSync,
    next: 'Scroll naturally. Inspection arms only after confirmed human feed advances.',
  }));
  return {
    summary,
    morphology,
  };
}

async function monitorHumanInspection({
  harness,
  page,
  control,
}) {
  let previousSignature = '';
  while (!control.cancelled) {
    let payload;
    try {
      payload = await ensureAutomationSession(harness, page, 'reload');
    } catch (error) {
      if (!control.cancelled) {
        console.error(
          `[feed-horizon-inspection] human monitor stopped: ${error?.message || error}`,
        );
      }
      return;
    }
    const summary = summarizeFeedSnapshot(readFeedFlow(payload));
    const inspection = summary?.episode?.inspection || {};
    const endpoint = summary?.episode?.endpoint || {};
    const signature = JSON.stringify({
      active: inspection.active === true,
      phase: inspection.phase || null,
      finishedReason: inspection.finishedReason || null,
      boundaryReached: endpoint.boundaryReached === true,
      controlsLive: endpoint.controlsLive === true,
      continueIntentPending: endpoint.continueIntentPending === true,
    });
    if (signature !== previousSignature) {
      previousSignature = signature;
      console.log(JSON.stringify({
        status: inspection.active === true
          ? 'HUMAN_OBSERVATION_PROGRESS'
          : 'HUMAN_INSPECTION_ENDED',
        phase: inspection.phase || null,
        finishedReason: inspection.finishedReason || null,
        boundaryReached: endpoint.boundaryReached === true,
        controlsLive: endpoint.controlsLive === true,
        continueIntentPending: endpoint.continueIntentPending === true,
        productionGateRequested: false,
      }));
    }
    if (inspection.active !== true && inspection.phase === 'failed') return;
    await sleep(OPERATOR_ARM_POLL_MS);
  }
}

async function runHumanInspectionLifecycle({
  harness,
  page,
  scenario,
  options,
  artifactSync,
  control,
}) {
  await emitHumanInspectionHandoff({
    harness,
    page,
    scenario,
    options,
    artifactSync,
  });
  const arm = await armFromOperatorProgress({
    harness,
    page,
    scenario,
    options,
    control,
  });
  if (control.cancelled || arm.status === 'CANCELLED') return arm;
  if (!['ARMED', 'ALREADY_ARMED'].includes(arm.status)) {
    throw new Error(
      `FEED_HORIZON_INSPECTION_HUMAN_ARM_INVALID:${String(arm.status)}`,
    );
  }
  await monitorHumanInspection({
    harness,
    page,
    control,
  });
  return arm;
}

function inspectionEnded(feedFlow) {
  return feedFlow?.episode?.inspection?.active !== true;
}

function inspectionFeedbackPresented(feedFlow) {
  return (
    feedFlow?.episode?.inspection?.phase === 'enso_would_open'
    && Number(feedFlow?.episode?.inspection?.feedbackPresentedAt) > 0
    && feedFlow?.episode?.endpoint?.continueIntentPending === true
  );
}

export function projectInspectionAdmissionEvidence(summary, surfaceMode) {
  return {
    version: 1,
    surfaceMode,
    confirmedAdvanceCount: summary?.advanceCount,
    inspection: summary?.episode?.inspection,
    admission: summary?.episode?.admission,
    lease: summary?.episode?.admissionTransport?.state?.activeLease,
  };
}

function classifyBoundaryMotionRestAlignment(morphology, scenario) {
  const surfaceMode = scenario?.feedConsumption?.surfaceMode;
  const maximumDisplacementPx = Math.max(
    0,
    Number(morphology?.boundaryMotionMaximumDisplacementPx) || 0,
  );
  const tolerancePx = Math.max(3, (maximumDisplacementPx * 0.1) + 2);
  const endpointPosition = Number(morphology?.tail?.top);
  const restPosition = Number(morphology?.nativeScroller?.viewportTop)
    + Number(morphology?.viewport?.endpointHeight) - Number(morphology?.boundaryRevealPx);
  const offsetPx = Math.abs(endpointPosition - restPosition);
  const nearRestEdgeAligned = (
    Number.isFinite(offsetPx)
    && offsetPx <= tolerancePx
  );
  return {
    status: nearRestEdgeAligned ? 'PASS' : 'FAIL',
    checks: {
      nearRestEdgeAligned,
      endpointEdge: 'tail_start',
      surfaceMode,
    },
    offsetPx,
    tolerancePx,
  };
}

async function driveInspectionCycle({
  harness,
  page,
  scenario,
  options,
  actionOffset = 0,
}) {
  const boundaryActions = [];
  let boundary = await waitForFeedState({
    harness,
    page,
    timeoutMs: 500,
    pollMs: 100,
    predicate: (feedFlow) => feedFlow?.episode?.endpoint?.boundaryReached === true,
    abortPredicate: inspectionEnded,
  });
  while (!boundary.ok && boundaryActions.length < BOUNDARY_DRIVE_MAX_STEPS) {
    boundaryActions.push(await runTrustedEndpointForwardStep({
      harness,
      page,
      scenario,
      index: actionOffset + boundaryActions.length,
      dwellMs: 100,
      phase: 'boundary',
    }));
    boundary = await waitForFeedState({
      harness,
      page,
      timeoutMs: 1_000,
      pollMs: 100,
      predicate: (feedFlow) => feedFlow?.episode?.endpoint?.boundaryReached === true,
      abortPredicate: inspectionEnded,
    });
  }
  if (!boundary.ok) {
    throw new Error(
      `FEED_HORIZON_INSPECTION_BOUNDARY_TIMEOUT:${JSON.stringify(boundary.snapshot)}`,
    );
  }

  const boundaryMotionSettled = await waitForFeedState({
    harness,
    page,
    timeoutMs: options.stillGateMs + INSPECTION_SETTLE_BUFFER_MS,
    pollMs: 50,
    predicate: isInspectionBoundaryMotionAtRest,
    abortPredicate: inspectionEnded,
  });
  if (!boundaryMotionSettled.ok) {
    throw new Error(
      `FEED_HORIZON_INSPECTION_BOUNDARY_MOTION_SETTLE_TIMEOUT:${JSON.stringify(
        boundaryMotionSettled.snapshot,
      )}`,
    );
  }

  const boundaryMorphology = await readEndpointMorphology(harness, page);
  const morphology = classifyNativeEndpointMorphology(boundaryMorphology);
  const isolation = classifyEndpointIsolationForScenario(
    boundaryMorphology,
    scenario,
  );
  const restAlignment = classifyBoundaryMotionRestAlignment(
    boundaryMorphology,
    scenario,
  );
  if (
    morphology.status !== 'PASS'
    || isolation.status !== 'PASS'
    || restAlignment.status !== 'PASS'
  ) {
    throw new Error(
      `FEED_HORIZON_INSPECTION_NATIVE_MORPHOLOGY_INVALID:${JSON.stringify({
        checks: morphology.checks,
        isolationChecks: isolation.checks,
        restAlignment,
        morphology: boundaryMorphology,
      })}`,
    );
  }

  const hold = await waitForFeedState({
    harness,
    page,
    timeoutMs: options.stillGateMs + INSPECTION_SETTLE_BUFFER_MS,
    pollMs: 100,
    predicate: (feedFlow) => (
      feedFlow?.episode?.inspection?.active === true
      && feedFlow?.episode?.endpoint?.controlsLive === true
      && feedFlow?.episode?.inspection?.holdRemainingMs === 0
    ),
    abortPredicate: inspectionEnded,
  });
  if (!hold.ok) {
    throw new Error(
      `FEED_HORIZON_INSPECTION_STILL_HOLD_TIMEOUT:${JSON.stringify(hold.snapshot)}`,
    );
  }

  const visualEvidence = options.captureDir
    ? await captureHorizonPresentation({ harness, page, scenario, outputDir: options.captureDir })
    : null;
  if (options.requireVideo && visualEvidence?.videoPlaybackObserved !== true) {
    throw new Error('FEED_HORIZON_INSPECTION_TERMINAL_VIDEO_NOT_PLAYING');
  }

  const demandActions = [];
  let feedback = {
    ok: false,
    snapshot: hold.snapshot,
  };
  while (
    !feedback.ok
    && demandActions.length
      < INSPECTION_RENEWED_DEMAND_POLICY.maximumActions
  ) {
    const burstEnd = Math.min(
      INSPECTION_RENEWED_DEMAND_POLICY.maximumActions,
      demandActions.length
        + INSPECTION_RENEWED_DEMAND_POLICY.actionsPerBurst,
    );
    while (demandActions.length < burstEnd) {
      demandActions.push(await runTrustedEndpointForwardStep({
        harness,
        page,
        scenario,
        index: actionOffset + boundaryActions.length + demandActions.length,
        dwellMs: INSPECTION_RENEWED_DEMAND_POLICY.actionDwellMs,
        phase: 'demand',
      }));
    }
    feedback = await waitForFeedState({
      harness,
      page,
      timeoutMs:
        INSPECTION_RENEWED_DEMAND_POLICY.feedbackObservationMs,
      pollMs: INSPECTION_RENEWED_DEMAND_POLICY.feedbackPollMs,
      predicate: options.inspectionGate
        ? (feedFlow) => feedFlow?.episode?.managerState === 'ENSO_PENDING'
        : inspectionFeedbackPresented,
      abortPredicate: inspectionEnded,
    });
  }
  if (!feedback.ok) {
    throw new Error(
      `FEED_HORIZON_INSPECTION_FEEDBACK_TIMEOUT:${JSON.stringify({
        demandActions,
        snapshot: feedback.snapshot,
      })}`,
    );
  }
  if (options.inspectionGate) {
    await requireInspectionExecution({ harness, page,
      observation: options.browserObservation, phase: 'gate' });
    const gateMorphology = await readEndpointMorphology(harness, page);
    const gateSummary = summarizeFeedSnapshot(readFeedFlow(feedback.payload));
    if (gateMorphology.gateCount !== 1) {
      throw new Error('FEED_HORIZON_INSPECTION_GATE_NOT_DISPLAYED');
    }
    if (options.captureDir) {
      await captureHorizonPresentation({ harness, page, scenario,
        outputDir: options.captureDir, phase: 'gate' });
    }
    const resolution = await verifyFeedHorizonGateNeutralBackward({
      harness, page, scenario, dwellMs: options.dwellMs,
      actionIndex: actionOffset + boundaryActions.length + demandActions.length,
      gateState: feedback,
    });
    const checks = {
      horizonReached: boundary.ok,
      nativeEndpointOwned: morphology.status === 'PASS' && isolation.status === 'PASS',
      demandCaptureReady: hold.ok,
      renewedDemandOpenedGate: gateMorphology.gateCount === 1,
      ...resolution.checks,
    };
    if (!Object.values(checks).every(value => value === true)) {
      throw new Error(`FEED_HORIZON_INSPECTION_GATE_CHAIN_INVALID:${JSON.stringify({
        checks, backwardNavigation: resolution.evidence,
      })}`);
    }
    return {
      status: 'PASS', boundaryActions, demandActions,
      actualGateCount: gateMorphology.gateCount,
      // The rendered Gate belongs to this manual episode, not production usage.
      productionGateCount: 0,
      inspectionEvidence: projectInspectionAdmissionEvidence(gateSummary, scenario.feedConsumption.surfaceMode),
      visualEvidence,
      morphology: { classification: morphology, isolation, restAlignment,
        boundary: boundaryMorphology, gate: gateMorphology,
        neutral: resolution.neutralMorphology, backward: resolution.backwardMorphology },
      phases: { boundary: boundary.snapshot.episode.inspection,
        hold: hold.snapshot.episode.inspection, gate: gateSummary.episode.inspection },
      causalChain: { reason: 'horizon_veil_neutral_backward_navigation_chain_confirmed',
        actionCount: boundaryActions.length + demandActions.length + 1,
        checks, backwardNavigation: resolution.evidence },
      payload: resolution.backwardNavigation.payload,
    };
  }
  const feedbackMotionSettled = await waitForFeedState({
    harness,
    page,
    timeoutMs: INSPECTION_SETTLE_BUFFER_MS,
    pollMs: 50,
    predicate: isInspectionBoundaryMotionAtRest,
    abortPredicate: inspectionEnded,
  });
  if (!feedbackMotionSettled.ok) {
    throw new Error(
      `FEED_HORIZON_INSPECTION_FEEDBACK_BOUNDARY_MOTION_SETTLE_TIMEOUT:${JSON.stringify(
        feedbackMotionSettled.snapshot,
      )}`,
    );
  }
  const feedbackMorphology = await readEndpointMorphology(harness, page);
  if (feedbackMorphology.gateCount !== 0) {
    throw new Error('FEED_HORIZON_INSPECTION_FEEDBACK_ONLY_GATE_PRESENT');
  }
  const feedbackIsolation = classifyEndpointIsolationForScenario(
    feedbackMorphology,
    scenario,
  );
  const holdStability = (
    scenario.siteId === 'instagram'
    && scenario.feedConsumption?.surfaceMode === 'paged'
  )
    ? classifyInstagramReelsHoldStability({
      boundary: boundaryMorphology,
      feedback: feedbackMorphology,
    })
    : null;
  if (
    feedbackIsolation.status !== 'PASS'
    || (holdStability && holdStability.status !== 'PASS')
  ) {
    throw new Error(
      `FEED_HORIZON_INSPECTION_HOLD_MORPHOLOGY_INVALID:${JSON.stringify({
        isolationChecks: feedbackIsolation.checks,
        holdChecks: holdStability?.checks || null,
        branchGrowth: holdStability?.branchGrowth ?? null,
      })}`,
    );
  }
  return {
    status: 'PASS',
    boundaryActions,
    demandActions,
    morphology: {
      classification: morphology,
      isolation,
      restAlignment,
      feedbackIsolation,
      holdStability,
      boundary: boundaryMorphology,
      feedback: feedbackMorphology,
    },
    productionGateCount: feedbackMorphology.gateCount,
    visualEvidence,
    phases: {
      boundary: boundary.snapshot?.episode?.inspection || null,
      hold: hold.snapshot?.episode?.inspection || null,
      feedback: feedback.snapshot?.episode?.inspection || null,
    },
    payload: feedback.payload,
  };
}

export function hasInspectionVideoPlayback(samples) {
  if (!Array.isArray(samples) || samples.length !== 2) return false;
  const [first, second] = samples.map(sample => sample?.presentation);
  if (!Array.isArray(first?.media) || !Array.isArray(second?.media)) return false;
  if (first.mediaScope !== second.mediaScope) return false;
  if (first.mediaScope === 'endpoint_anchor') {
    if (typeof first.anchorBranchId !== 'string' || first.anchorBranchId.length === 0
      || first.anchorBranchId !== second.anchorBranchId) return false;
  } else if (first.mediaScope !== 'viewport'
    || samples.some(sample => sample.phase === 'rest' || sample.phase === 'rest-later')) return false;
  const exposed = (video, viewport) => {
    const bounds = video?.bounds;
    if (!bounds || !viewport
      || ![bounds.x, bounds.y, bounds.width, bounds.height, viewport.width, viewport.height].every(Number.isFinite)
      || bounds.width <= 0 || bounds.height <= 0 || viewport.width <= 0 || viewport.height <= 0) return false;
    const width = Math.max(0, Math.min(bounds.x + bounds.width, viewport.width) - Math.max(0, bounds.x));
    const height = Math.max(0, Math.min(bounds.y + bounds.height, viewport.height) - Math.max(0, bounds.y));
    // Paged videos occupy a narrow lane on wide screens. Require half of the
    // drawable video width, plus the same 42% viewport-height as arm admission.
    return width >= Math.min(bounds.width, viewport.width) * 0.5
      && height >= viewport.height * 0.42;
  };
  const playable = (video, viewport) => exposed(video, viewport)
    && video.readyState >= 2 && video.errorCode === null
    && video.paused === false && video.inert === false && video.decodedFrames > 0
    && video.visibility === 'visible' && Number(video.opacity) > 0
    && Number.isFinite(video.currentTime) && Number.isFinite(video.decodedFrames)
    && typeof video.elementId === 'string' && video.elementId.length > 0;
  return first.media.some((before) => playable(before, first.viewport)
    && second.media.some((after) => playable(after, second.viewport)
      && before.elementId === after.elementId
      && after.decodedFrames > before.decodedFrames
      && after.currentTime !== before.currentTime));
}

export async function captureHorizonPresentation({ harness, page, scenario, outputDir, phase = 'rest' }) {
  await fs.mkdir(outputDir, { recursive: true });
  const execution = await observeEntropyAttachedPageExecution(harness, page);
  const executionPath = path.join(outputDir, `horizon-${phase}-execution.json`);
  await fs.writeFile(executionPath, JSON.stringify({ phase, execution }, null, 2));
  console.log(JSON.stringify({ status: 'AGENT_HORIZON_CAPTURE_EXECUTION', executionPath }));
  // Focus emulation keeps DOM work alive in a minimized window. It cannot
  // supply a drawable browser surface, and is not screenshot admission.
  const captureStatus = classifyEntropyAttachedPageExecution(execution, 'document');
  if (captureStatus !== 'ready') {
    const error = new Error(`FEED_HORIZON_CAPTURE_UNAVAILABLE:${captureStatus}`);
    error.feedHorizonCaptureBlocker = {
      schemaVersion: 1, phase, reason: captureStatus, execution, executionPath,
    };
    throw error;
  }
  const samples = [];
  const captureKey = `__entropy_qa_video_capture_${Date.now()}`;
  await evaluate(harness.cdp, page.sessionId, `Object.defineProperty(globalThis, ${JSON.stringify(captureKey)}, {
    configurable: true, value: { ids: new WeakMap(), serial: 0 }
  }) && true`);
  try {
    for (const samplePhase of [phase, `${phase}-later`]) {
      if (samples.length > 0) await sleep(900);
      const presentation = await evaluate(harness.cdp, page.sessionId, `(() => {
        const capture = globalThis[${JSON.stringify(captureKey)}];
        if (!capture) throw new Error('FEED_HORIZON_VIDEO_CAPTURE_IDENTITY_REQUIRED');
        const elementId = video => {
          if (!capture.ids.has(video)) capture.ids.set(video, ${JSON.stringify(captureKey)} + ':' + ++capture.serial);
          return capture.ids.get(video);
        };
        const host = document.getElementById('entropy-feed-terminus');
        const root = host?.shadowRoot;
        const marker = document.getElementById('entropy-feed-endpoint-marker');
        const tail = document.getElementById('entropy-feed-endpoint-tail');
        // FeedEndpointLease inserts anchor -> marker -> tail. This identifies
        // the exact endpoint branch without site selectors or a visible-video fallback.
        const anchor = marker?.previousElementSibling;
        const anchorOwned = !!(anchor && marker.nextElementSibling === tail
          && tail?.contains(host) && anchor.parentElement === tail.parentElement);
        const mediaScope = anchorOwned ? 'endpoint_anchor'
          : ${JSON.stringify(phase)} === 'ready-to-arm' && !marker && !tail ? 'viewport' : 'endpoint_unavailable';
        const mediaRoot = anchorOwned ? anchor : mediaScope === 'viewport' ? document : null;
        const rect = (node) => {
          if (!node) return null;
          const r = node.getBoundingClientRect();
          return { x: r.x, y: r.y, width: r.width, height: r.height };
        };
        return {
          pageTitle: document.title,
          viewport: { width: innerWidth, height: innerHeight, dpr: devicePixelRatio },
          visibility: document.visibilityState,
          reducedMotion: matchMedia('(prefers-reduced-motion: reduce)').matches,
          surfaceMode: host?.dataset.surfaceMode,
          mediaScope, anchorBranchId: anchorOwned ? elementId(anchor) : null,
          host: rect(host), tail: rect(host?.parentElement),
          title: { text: root?.querySelector('[data-k="phrase-title"]')?.textContent,
            bounds: rect(root?.querySelector('[data-k="phrase-title"]')) },
          subtitle: { text: root?.querySelector('[data-k="phrase-subtitle"]')?.textContent,
            bounds: rect(root?.querySelector('[data-k="phrase-subtitle"]')) },
          media: Array.from(mediaRoot?.querySelectorAll('video') || []).filter((video) => {
            const r = video.getBoundingClientRect();
            const width = Math.max(0, Math.min(r.right, innerWidth) - Math.max(0, r.left));
            const height = Math.max(0, Math.min(r.bottom, innerHeight) - Math.max(0, r.top));
            return r.width > 0 && r.height > 0 && innerWidth > 0 && innerHeight > 0
              && width >= Math.min(r.width, innerWidth) * 0.5 && height >= innerHeight * 0.42;
          }).slice(0, 8).map((video) => ({
            elementId: elementId(video),
            bounds: rect(video), readyState: video.readyState, networkState: video.networkState,
            paused: video.paused, ended: video.ended, currentTime: video.currentTime,
            width: video.videoWidth, height: video.videoHeight, errorCode: video.error?.code ?? null,
            decodedFrames: video.getVideoPlaybackQuality().totalVideoFrames,
            inert: !!video.closest('[inert]'), visibility: getComputedStyle(video).visibility,
            opacity: getComputedStyle(video).opacity,
          })),
        };
      })()`);
      const imagePath = path.join(outputDir, `horizon-${samplePhase}.png`);
      const capture = await harness.cdp.send('Page.captureScreenshot', {
        format: 'png', fromSurface: true,
      }, page.sessionId);
      if (typeof capture?.data !== 'string' || !capture.data) {
        throw new Error('FEED_HORIZON_PRESENTATION_CAPTURE_REQUIRED');
      }
      await fs.writeFile(imagePath, Buffer.from(capture.data, 'base64'));
      samples.push({ phase: samplePhase, imagePath, presentation });
    }
  } finally {
    await evaluate(harness.cdp, page.sessionId, `delete globalThis[${JSON.stringify(captureKey)}]`);
  }
  const reportPath = path.join(outputDir, phase === 'rest'
    ? 'horizon-presentation.json' : `horizon-presentation-${phase}.json`);
  const report = { siteId: scenario.siteId, phase, samples,
    videoPlaybackObserved: hasInspectionVideoPlayback(samples),
    textStable: samples[0].presentation.host === null ? null
      : samples[0].presentation.title.text === samples[1].presentation.title.text
      && samples[0].presentation.subtitle.text === samples[1].presentation.subtitle.text };
  await fs.writeFile(reportPath, JSON.stringify(report, null, 2));
  console.log(JSON.stringify({ status: 'AGENT_HORIZON_CAPTURED', reportPath }));
  return { reportPath, videoPlaybackObserved: report.videoPlaybackObserved };
}

async function runControlCommand({
  harness,
  page,
  scenario,
  command,
  options,
}) {
  if (command === 'status') {
    return printState('status', await ensureAutomationSession(harness, page, 'reload'));
  }
  if (command === 'dom') {
    const morphology = await readEndpointMorphology(harness, page);
    console.log(JSON.stringify({ label: 'native-dom', morphology }, null, 2));
    return morphology;
  }
  if (command === 'warmup') {
    const warmup = await runWarmup({
      harness,
      page,
      scenario,
      dwellMs: options.dwellMs,
    });
    console.log(JSON.stringify({ label: 'warmup', warmup }, null, 2));
    return warmup;
  }
  if (command === 'disarm') {
    return printState(
      'disarmed',
      await controlInspection({
        harness,
        page,
        command,
        stillGateMs: options.stillGateMs,
      }),
    );
  }
  if (command === 'rearm') {
    const current = readFeedFlow(await ensureAutomationSession(harness, page, 'reload'));
    if (current.episode?.inspection?.active === true) {
      printState(
        'rearm-released',
        await controlInspection({
          harness,
          page,
          command: 'disarm',
          stillGateMs: options.stillGateMs,
        }),
      );
    }
  }
  if (command === 'arm' || command === 'rearm') {
    const armed = await beginInspectionCycle({
      harness,
      page,
      scenario,
      command,
      options,
    });
    printState('inspection-arm-accepted', armed);
  } else {
    throw new Error(`FEED_HORIZON_INSPECTION_COMMAND_UNKNOWN:${command}`);
  }
  const endpointCommit = await driveInspectionEndpointCommit({
    harness,
    page,
    scenario,
  });
  const cycle = await driveInspectionCycle({
    harness,
    page,
    scenario,
    options,
    actionOffset: endpointCommit.actions.length,
  });
  const summary = printState(`${command}ed`, cycle.payload);
  console.log(JSON.stringify({
    label: 'inspection-cycle',
    status: cycle.status,
    browserProcessPolicy: options.cdpEndpoint
      ? 'attach_only_preserve_browser'
      : 'same_process',
    productionGateCount: cycle.productionGateCount,
    commitActionCount: endpointCommit.actions.length,
    commitDrivePolicy: endpointCommit.drivePolicy,
    boundaryActionCount: cycle.boundaryActions.length,
    demandActionCount: cycle.demandActions.length,
    morphology: cycle.morphology,
    phases: cycle.phases,
  }, null, 2));
  return {
    summary,
    endpointCommit,
    cycle,
  };
}

async function cleanup({ buildRoot, progressionOverrideActive, page } = {}) {
  if (cleanupStarted) return;
  cleanupStarted = true;
  const context = {
    ...(activeCleanupContext || {}),
    ...(buildRoot ? { buildRoot } : {}),
    ...(page ? { page } : {}),
    ...(progressionOverrideActive === true ? { progressionOverrideActive } : {}),
  };
  if (context.operatorArmControl) {
    context.operatorArmControl.cancelled = true;
  }
  if (context.humanLifecycleControl) {
    context.humanLifecycleControl.cancelled = true;
  }
  await context.operatorArmTask?.catch(() => {});
  try {
    if (activeHarness && context.page) {
      try {
        await controlInspection({
          harness: activeHarness,
          page: context.page,
          command: 'disarm',
          stillGateMs: DEFAULT_STILL_GATE_MS,
        });
      } catch {
        // The content session may already be gone; the page lifecycle owns its cleanup.
      }
      if (context.progressionOverrideActive) {
        await clearDiagnosticArtifactDisclosureOverride(activeHarness).catch(() => {});
      }
    }
  } finally {
    await activeHarness?.close?.().catch(() => {});
    activeHarness = null;
    if (context.buildRoot) {
      await fs.rm(context.buildRoot, { recursive: true, force: true }).catch(() => {});
    }
    activeCleanupContext = null;
  }
}

export async function runFeedHorizonInspection(options) {
  const buildRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'entropy-feed-horizon-inspection-'));
  activeCleanupContext = {
    buildRoot,
    progressionOverrideActive: false,
    page: null,
  };
  const scenario = getFeedHorizonScenario(options.siteId);
  let progressionOverrideActive = false;
  let page = null;
  let osFocusBaseline = null;
  try {
    const artifact = await prepareDiagnosticArtifact({
      build: options.build,
      diagnosticDist: options.diagnosticDist,
      headless: options.cdpEndpoint ? true : options.headless,
      chromePath: options.chromePath,
    }, buildRoot);
    const temporaryManifest = Object.freeze({
        requiredPermissions: ['scripting'],
        requiredHostPermissions: scenario.allowlistedOrigins.map((origin) => `${origin}/*`),
    });
    const managedAttach = options.browserExecution?.startPolicy
      === 'managed_ensure_before_attach';
    if (
      managedAttach
      && (
        !options.profileSlotId
        || !options.extensionSlotAdmission
        || !options.artifactId
        || !options.artifactInputDigest
        || !options.artifactBuildId
        || !options.artifactReleaseProfile
      )
    ) {
      throw new Error('FEED_HORIZON_INSPECTION_MANAGED_EXTENSION_STAGE_REQUIRED');
    }
    const contentIdentity = managedAttach
      ? defineEntropyQaArtifactContentIdentity({
        artifactIdentity: {
          artifactId: options.artifactId,
          inputDigest: options.artifactInputDigest,
          buildId: options.artifactBuildId,
          releaseProfile: options.artifactReleaseProfile,
        },
        temporaryManifest,
      })
      : null;
    const attachedArtifactStage = managedAttach
      ? Object.freeze({
        contractVersion: 2,
        kind: 'entropy_attached_artifact_stage',
        mutationPolicy: 'managed_atomic_sync',
        profileSlotId: options.profileSlotId,
        lifecyclePolicy: 'managed',
        profileDir: options.profile,
        slotDir: resolveEntropyQaArtifactSlot(options.profile),
        slotAdmission: options.extensionSlotAdmission,
        sourceDir: artifact.distDir,
        artifactIdentity: contentIdentity.artifact,
        contentIdentity,
        contentIdentityDigest: contentIdentity.digest,
        temporaryManifest: contentIdentity.temporaryManifest,
      })
      : null;
    const qaArtifact = options.cdpEndpoint
      ? Object.freeze({
        slotDir: resolveEntropyQaArtifactSlot(options.profile),
        trustedPagePath: ENTROPY_QA_TRUSTED_PAGE_PATH,
      })
      : attachedArtifactStage
      ? Object.freeze({
        slotDir: attachedArtifactStage.slotDir,
        trustedPagePath: ENTROPY_QA_TRUSTED_PAGE_PATH,
      })
      : await stageEntropyQaArtifact({
        profileDir: options.profile,
        sourceDir: artifact.distDir,
        temporaryManifest,
      });
    const harness = new ExtensionChromiumHarness({
      chromePath: findChromeExecutable({
        chromePath: options.chromePath,
        headless: options.headless,
      }),
      distDir: qaArtifact.slotDir,
      rootDir,
      headless: options.headless,
      browserExecution: options.browserExecution,
      audioPolicy: options.audioPolicy,
      renderingRequirement: options.renderingRequirement,
      cdpEndpoint: options.cdpEndpoint,
      expectedBrowserIdentity: options.cdpEndpoint
        ? {
          executable: options.chromePath,
          platform: inferBrowserQaPlatform(options.chromePath),
          profileSlotId: options.profileSlotId,
          userDataDir: options.profile,
          profileDirectory: options.profileDirectory,
          cdpEndpoint: options.cdpEndpoint,
        }
        : null,
      keepTemp: false,
      qaProfileDir: options.profile,
      qaProfileDirectory: options.profileDirectory,
      tempPrefix: 'entropy-feed-horizon-inspection-',
      loadInPlace: true,
      trustedPagePath: ENTROPY_QA_TRUSTED_PAGE_PATH,
      attachedArtifactStage,
      attachedArtifactRuntimeReadiness: managedAttach
        ? proveEntropyAttachedArtifactRuntimeReadiness
        : null,
    });
    activeHarness = harness;
    osFocusBaseline = await inspectAttachedWindowsChromeForeground(options);
    assertInspectionOsFocusPreserved(osFocusBaseline, osFocusBaseline, {
      browserObservation: options.browserObservation,
    });
    await harness.start();
    if (harness.uninstallExtensionOnClose) {
      throw new Error('FEED_HORIZON_INSPECTION_QA_UNINSTALL_FORBIDDEN');
    }
    await harness.reloadExtensionFromSource();
    await prepareLaneArtifactDisclosure(harness, {
      lane: 'diagnostic',
      scenarios: [scenario],
      disposableProfile: true,
    });
    progressionOverrideActive = true;
    activeCleanupContext.progressionOverrideActive = true;
    await configureScenario(
      harness,
      scenario,
      options.researchJourney
        ? createFeedResearchSettingsPayload(scenario, options.researchFeatureProfile)
        : createScenarioSettingsPayload(scenario, true),
    );
    page = await harness.openPage(scenario.urls.primary, {
      active: options.cdpEndpoint ? false : true,
      timeoutMs: 45_000,
    });
    activeCleanupContext.page = page;
    await activateScenarioTab(harness, page, {
      lane: 'diagnostic',
      focusWindow: false,
    });
    if (options.cdpEndpoint && options.browserObservation === null) {
      await harness.enableNoFocusPageExecution(page);
    }
    const osFocusGuard = assertInspectionOsFocusPreserved(
      osFocusBaseline,
      await inspectAttachedWindowsChromeForeground(options),
      { browserObservation: options.browserObservation },
    );
    console.log(JSON.stringify({
      status: options.browserObservation === null
        ? 'QA_BROWSER_OS_FOCUS_PRESERVED'
        : 'QA_BROWSER_OS_FOCUS_OBSERVED',
      ...osFocusGuard,
    }));
    await requireInspectionExecution({ harness, page,
      observation: options.browserObservation, phase: 'before-arm' });
    const readiness = await waitForScenarioReadiness(harness, page, scenario, {
      timeoutMs: 45_000,
    });
    if (!readiness.ready) {
      const error = new Error(
        `FEED_HORIZON_INSPECTION_PAGE_NOT_READY:${readiness.blocker?.reason || 'unknown'}`,
      );
      error.feedHorizonPageBlocker = projectInspectionReadinessBlocker(readiness);
      throw error;
    }
    if (options.captureDir) {
      await captureHorizonPresentation({
        harness, page, scenario, outputDir: options.captureDir, phase: 'before-arm',
      });
    }
    await sendRuntimeDebuggerAutomationAction(
      harness,
      page,
      RUNTIME_DEBUGGER_AUTOMATION_ACTIONS.START,
      { captureKind: 'live' },
    );

    if (options.researchJourney) {
      const research = await runFeedConsumptionResearchJourney({
        harness,
        page,
        scenario,
        journeyId: options.researchJourney,
        outputDir: options.researchOutputDir,
        candidateThreshold: options.researchCandidateThreshold,
        referenceDwellMs: options.researchReferenceDwellMs,
        featureProfile: options.researchFeatureProfile,
      });
      console.log(JSON.stringify({
        status: 'FEED_CONSUMPTION_RESEARCH_COMPLETE',
        outcome: research.summary.status,
        siteId: scenario.siteId,
        journeyId: research.summary.journeyId,
        modelBlind: research.summary.modelBlind,
        researchVerdict: research.summary.researchVerdict,
        featureProfile: research.summary.featureProfile,
        measurementCoverage: research.summary.measurementCoverage,
        tracePath: research.paths.tracePath,
        summaryPath: research.paths.summaryPath,
        markdownPath: research.paths.markdownPath,
      }));
      return research;
    }

    if (options.executionMode === FEED_HORIZON_QA_MODES.HUMAN) {
      const humanLifecycleControl = { cancelled: false };
      activeCleanupContext.humanLifecycleControl = humanLifecycleControl;
      await runHumanInspectionLifecycle({
        harness,
        page,
        scenario,
        options,
        artifactSync: harness.attachedArtifactSyncReceipt,
        control: humanLifecycleControl,
      });
      return;
    } else if (options.executionMode === FEED_HORIZON_QA_MODES.AGENT) {
      if (options.gateDriveMs > 0) {
        // Production-gate QA and feedback-only inspection are mutually
        // exclusive. A production episode intentionally owns the endpoint and
        // Enso reservation, so forcing an inspection afterwards is both invalid
        // and incapable of adding evidence about the shipped user path.
        await ensureEndpointReadiness({
          harness,
          page,
          scenario,
          dwellMs: options.dwellMs,
        });
        const causalChain = await runFeedHorizonProductionCausalChain({
          harness,
          page,
          scenario,
          actionIndex: 0,
          dwellMs: options.dwellMs,
          budgetMs: options.gateDriveMs,
        });
        console.log(JSON.stringify({
          status: 'AGENT_GATE_COMPLETE',
          outcome: causalChain.status,
          muted: true,
          browserProcessPolicy: options.cdpEndpoint
            ? 'attach_only_preserve_browser'
            : 'same_process',
          artifactSync: harness.attachedArtifactSyncReceipt,
          productionGateCount: Number(causalChain.gate?.morphology?.gateCount || 0),
          inspectionActive: causalChain.final?.episode?.inspection?.active === true,
          finalManagerState: causalChain.final?.episode?.managerState || null,
          endpointLeaseState:
            causalChain.final?.episode?.endpoint?.leaseState || null,
          boundaryReached:
            causalChain.final?.episode?.endpoint?.boundaryReached === true,
          tempo: causalChain.final?.tempo || null,
          gateObservation: causalChain.gateObservation || null,
          admissionTrace: (causalChain.phaseTimeline || []).slice(-16).map(({ capturedAt, episode }) => ({
            capturedAt,
            phase: episode?.phase || null,
            admission: episode?.admission || null,
            transport: episode?.admissionTransport || null,
          })),
          causalChain: {
            reason: causalChain.reason,
            durationMs: causalChain.durationMs,
            actionCount: causalChain.actionCount,
            measuredTransitionCount: causalChain.measuredTransitionCount,
            checks: causalChain.checks || null,
            backwardNavigation: causalChain.backwardNavigation?.evidence || null,
          },
        }));
        return;
      }
      const canary = await runControlCommand({
        harness,
        page,
        scenario,
        command: 'arm',
        options,
      });
      await requireInspectionExecution({ harness, page,
        observation: options.browserObservation, phase: 'completion' });
      if (options.inspectionGate) {
        console.log(JSON.stringify({
          status: 'AGENT_INSPECTION_GATE_COMPLETE', outcome: canary.cycle.status,
          admissionMode: 'manual', timingPolicyEvaluated: false,
          actualGateCount: canary.cycle.actualGateCount, productionGateCount: 0,
          artifactSync: harness.attachedArtifactSyncReceipt,
          finalManagerState: canary.summary?.episode?.managerState,
          endpointLeaseState: canary.summary?.episode?.endpoint?.leaseState,
          boundaryReached: canary.summary?.episode?.endpoint?.boundaryReached,
          inspectionEvidence: canary.cycle.inspectionEvidence,
          visualEvidence: canary.cycle.visualEvidence,
          causalChain: canary.cycle.causalChain,
        }));
        return;
      }
      console.log(JSON.stringify({
        status: 'AGENT_CANARY_COMPLETE',
        admissionMode: 'manual',
        timingPolicyEvaluated: false,
        inspectionEvidence: projectInspectionAdmissionEvidence(canary.summary, scenario.feedConsumption.surfaceMode),
        muted: true,
        browserProcessPolicy: options.cdpEndpoint
          ? 'attach_only_preserve_browser'
          : 'same_process',
        artifactSync: harness.attachedArtifactSyncReceipt,
        productionGateCount: canary.cycle.productionGateCount,
        endpointLeaseState: canary.summary?.episode?.endpoint?.leaseState || null,
        boundaryReached: canary.summary?.episode?.endpoint?.boundaryReached === true,
        holdDurationMs: options.stillGateMs,
        holdCompleted: canary.cycle.phases.hold?.holdRemainingMs === 0,
        finalPhase: canary.cycle.phases.feedback?.phase || null,
        phases: [
          canary.cycle.phases.boundary?.phase || null,
          canary.cycle.phases.hold?.phase || null,
          canary.cycle.phases.feedback?.phase || null,
        ],
        tempo: canary.summary?.tempo || null,
        visualEvidence: canary.cycle.visualEvidence,
      }));
      return;
    } else if (options.operatorDriven) {
      const operatorArmControl = { cancelled: false };
      activeCleanupContext.operatorArmControl = operatorArmControl;
      const operatorArmTask = armFromOperatorProgress({
        harness,
        page,
        scenario,
        options,
        control: operatorArmControl,
      });
      activeCleanupContext.operatorArmTask = operatorArmTask;
      void operatorArmTask.catch((error) => {
        console.error(
          `[feed-horizon-inspection] operator arm stopped: ${error?.message || error}`,
        );
      });
    } else {
      try {
        await runControlCommand({
          harness,
          page,
          scenario,
          command: 'arm',
          options,
        });
      } catch (error) {
        console.error(
          `[feed-horizon-inspection] initial arm waiting for operator: ${error?.message || error}`,
        );
      }
    }

    console.log(JSON.stringify({
      status: 'READY',
      muted: true,
      headless: options.cdpEndpoint ? null : options.headless,
      profileDirectory: options.profileDirectory,
      browserProcessPolicy: options.cdpEndpoint
        ? 'attach_only_preserve_browser'
        : 'single_process_until_quit',
      operator: options.operatorDriven
        ? {
          mode: 'manual_scroll',
          requiredAdvanceCount: options.operatorAdvanceCount,
          syntheticInputCount: 0,
        }
        : null,
      commands: ['arm', 'rearm', 'disarm', 'status', 'dom', 'warmup', 'help', 'quit'],
      note: options.operatorDriven
        ? 'Scroll naturally. Inspection arms after confirmed feed advances and ready/safe endpoint evidence.'
        : 'After a page refresh, use arm. During the same content session, use rearm.',
    }, null, 2));

    const terminal = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
      terminal: process.stdin.isTTY,
    });
    while (true) {
      let raw = '';
      try {
        raw = await terminal.question('feed-horizon> ');
      } catch (error) {
        if (error?.code === 'ERR_USE_AFTER_CLOSE') break;
        throw error;
      }
      const command = raw.trim().toLowerCase();
      if (!command) continue;
      if (command === 'quit' || command === 'exit') break;
      if (command === 'help') {
        console.log('arm | rearm | disarm | status | dom | warmup | quit');
        continue;
      }
      try {
        await runControlCommand({
          harness,
          page,
          scenario,
          command,
          options,
        });
      } catch (error) {
        console.error(`[feed-horizon-inspection] ${error?.message || error}`);
      }
    }
    terminal.close();
  } catch (error) {
    if (!error?.feedHorizonCaptureBlocker && !error?.feedHorizonExecutionBlocker
      && options.captureDir && activeHarness?.cdp && page?.sessionId) {
      try {
        await captureHorizonPresentation({
          harness: activeHarness, page, scenario, outputDir: options.captureDir, phase: 'failure',
        });
      } catch (captureError) {
        throw new AggregateError([error, captureError], 'FEED_HORIZON_FAILURE_CAPTURE_FAILED');
      }
    }
    throw error;
  } finally {
    await cleanup({ buildRoot, progressionOverrideActive, page });
  }
}

async function main() {
  const options = admitQaAttachedExtensionBrowserChildExecution(
    parseFeedHorizonInspectionArgs(process.argv.slice(2)),
  );
  try {
    await runFeedHorizonInspection(options);
  } catch (error) {
    if (options.executionMode === FEED_HORIZON_QA_MODES.AGENT && error?.feedHorizonExecutionBlocker) {
      const execution = error.feedHorizonExecutionBlocker;
      console.log(JSON.stringify({ status: 'AGENT_EXECUTION_UNAVAILABLE',
        outcome: execution.phase === 'before-arm' ? 'BLOCKED' : 'INCONCLUSIVE',
        evidence: execution }));
      return;
    }
    if (options.executionMode === FEED_HORIZON_QA_MODES.AGENT && error?.feedHorizonCaptureBlocker) {
      const capture = error.feedHorizonCaptureBlocker;
      console.log(JSON.stringify({ status: 'AGENT_CAPTURE_UNAVAILABLE',
        outcome: capture.phase === 'before-arm' ? 'BLOCKED' : 'INCONCLUSIVE',
        evidence: capture }));
      return;
    }
    if (
      options.executionMode === FEED_HORIZON_QA_MODES.AGENT
      && error?.feedHorizonPageBlocker?.status === 'blocked'
    ) {
      console.log(JSON.stringify({
        status: 'AGENT_PAGE_BLOCKED',
        outcome: 'BLOCKED',
        muted: true,
        browserProcessPolicy: options.cdpEndpoint
          ? 'attach_only_preserve_browser'
          : 'same_process',
        reason: error.feedHorizonPageBlocker.reason,
        evidence: error.feedHorizonPageBlocker.evidence,
      }));
      return;
    }
    throw error;
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === scriptPath) {
  registerQaChildAbortCleanup(() => cleanup(), { phase: 'protocol' });
  process.once('SIGINT', () => {
    void cleanup().finally(() => process.exit(130));
  });
  process.once('SIGTERM', () => {
    void cleanup().finally(() => process.exit(143));
  });
  main().catch((error) => {
    const safeDetails = error?.siteE2ESafeDetails
      ? ` details=${JSON.stringify(error.siteE2ESafeDetails)}`
      : '';
    // Preserve AggregateError causes when failure capture itself also fails.
    console.error(`[feed-horizon-inspection] FAIL${safeDetails}`, error);
    process.exitCode = 1;
  });
}
