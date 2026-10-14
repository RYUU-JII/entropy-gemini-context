#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const rootDir = process.cwd();
const scannedExtensions = new Set(['.js', '.mjs', '.cjs', '.html', '.json']);
const ignoredExtensions = new Set(['.map']);
const PUBLIC_BUILD_INFO_SCHEMA_VERSION = 1;
const MODULE_INVENTORY_SCHEMA_VERSION = 1;
const MODULE_INVENTORY_RELATIVE_PATH = '.vite/entropy-module-inventory.json';
const PUBLIC_EXTENSION_TARGETS = new Set(['chrome', 'whale', 'firefox', 'safari']);
const LOWERCASE_GIT_OBJECT_ID = /^[0-9a-f]{40}$/;
const LOWERCASE_SHA256 = /^[0-9a-f]{64}$/;

const NUDGE_RENDER_HOST_BUNDLE_NAME = /^nudgeRenderHost(?:-[A-Za-z0-9_-]+)?\.js$/;
const NUDGE_RENDER_HOST_LEGACY_DISABLE_SIGNATURE = 'frame_host_debug_tools_disabled';
const APPROVED_SERVICE_WORKER_WAKE_DIAGNOSTIC_MODULE = (
  'src/apps/background/services/runtime/support/BackgroundServiceWorkerWakeTelemetry.js'
);
const APPROVED_SERVICE_WORKER_WAKE_DIAGNOSTIC_GLOBAL = (
  '__ENTROPY_SERVICE_WORKER_WAKE_TELEMETRY__'
);
const ZEN_DEVELOPMENT_WORKSPACE_DEV_ENTRY = (
  'src/themes/plugins/zen/runtime/buildEntries/zenDevelopmentWorkspaceState.dev.js'
);
const ZEN_DEVELOPMENT_WORKSPACE_PUBLIC_ENTRY = (
  'src/themes/plugins/zen/runtime/buildEntries/zenDevelopmentWorkspaceState.public.js'
);
const nudgeRenderHostRequiredSignatures = Object.freeze([
  Object.freeze({
    label: 'HOST_READY event',
    test: (source) => source.includes('HOST_READY'),
  }),
  Object.freeze({
    label: 'nudge_swarm render mode',
    test: (source) => /["']nudge_swarm["']/.test(source),
  }),
  Object.freeze({
    label: 'persistent runtime admission',
    test: (source) => source.includes('persistent') && /["']runtime["']/.test(source),
  }),
]);

const forbiddenPathFragments = Object.freeze([
  'CLSEAlertOverlay',
  'CLSETab',
  'CLSELab',
  'ExperimentTab',
  'ExperimentHubTab',
  'ExperimentWorkspace',
  'FilterTab',
  'FilterTest',
  'StatsPipelineDiagnosticsLab',
  'ZenBonsaiRenderDebugLab',
  'SentinelProtocolLab',
  'SentinelFlareDebugLauncher',
  'DebugModePanel',
  'RuntimeDebuggerOverlay',
  'RuntimeDebuggerShortFormOracle',
  'shortFormTargetOutcome.dev',
  'runtimeDiscoveryLedger.dev',
  'runtimeContentionLedger.dev',
  'runtimeDebuggerAutomationContract.dev',
  'runtimeDebuggerAutomationContentRelay.dev',
  'runtimeDebuggerAutomationMessageRoutes.dev',
  'buildCapabilityMessageRoutes.dev',
  'buildCapabilityContentRelay.dev',
  'audioDullingQaContract.dev',
  'audioDullingQaMessageRoutes.dev',
  'audioDullingQaBrowserPort.dev',
  'audioDullingQaPopupBootstrap.dev',
  'gateQaAutomationContract.dev',
  'gateQaAutomationMessageRoutes.dev',
  'settingsPropagationQaFixture.dev',
  'settingsPropagationQaFixtureContract.dev',
  'settingsPropagationQaFixtureMessageRoutes.dev',
  'goalDeliveryQaFixtureMessageRoutes.dev',
  'goalDeliveryQaFixtureContract.dev',
  'goalDeliveryQaStatsFixture.dev',
  'QA_GOAL_DELIVERY_CHARGE',
  'interventionCollisionQaContract.dev',
  'interventionCollisionQaMessageRoutes.dev',
  'interventionCollisionQaFixture.dev',
  'sentinelProtocolQaAutomationContract.dev',
  'sentinelProtocolQaAutomationMessageRoutes.dev',
  'videoSkipControlSurfaceQaContract.dev',
  'videoSkipControlSurfaceQaMessageRoutes.dev',
  'QA_VIDEO_SKIP_CONTROL_SURFACE_START',
  'entropy.video-skip-control-surface.qa.v1',
  'qaAutomationHarnessTrust.dev',
  'qaScenarioTabActivationContract.dev',
  'qaScenarioTabActivationMessageRoutes.dev',
  'FeedHorizonInspectionSession.dev',
  'feedHorizonInspection.dev',
  'feedHorizonInspectionContract.dev',
  'artifactDisclosureProjection.dev',
  'ProgressionUnlockDebugControl.dev',
  'FirstVisionDevelopmentProjection.dev',
  'progressionDebugActions.dev',
  'progressionUnlockDebugContract.dev',
  'progressionDebugRepository.dev',
  'ProgressionUnlockDebugRepository',
  'qaProgressionProvisioningMessageRoutes.dev',
  'zenMainCaptureProfile.dev',
  'sitesIntelCaptureProfile.dev',
  'siteIntelCaptureFixtures.dev',
  'ZenCoreStatusVNext',
  'ZenCoreStatusClassicExperiment',
  'ZenCoreStatusVNextWorkspace',
  'ZenWorkspaceState',
  'ZenWorkspaceStorage',
  'model/vnext/factors',
  'zenDevelopmentWorkspaceState.dev',
  'VNextPreferenceModel',
  'zenVNextOptimizer.worker',
  'zenVNextPreferenceTrainer.worker',
  'zenAbTrialEvaluator.worker',
  'zenLatentOptimizer.worker',
  'disabledZenExperimentalWorker.worker',
  'researchLearning',
  'structuralAB',
  'zenCoreStatusVNext.dev',
  'zenCoreStatusClassicExperiment.dev',
]);

const forbiddenManifestFragments = Object.freeze([
  'goalDeliveryQaFixtureMessageRoutes.dev',
  'goalDeliveryQaFixtureContract.dev',
  'goalDeliveryQaStatsFixture.dev',
  'QA_GOAL_DELIVERY_CHARGE',
  'settingsPropagationQaFixture.dev',
  'settingsPropagationQaFixtureContract.dev',
  'settingsPropagationQaFixtureMessageRoutes.dev',
  'FilterTab',
  'FilterTest',
  'ZenCoreStatusVNext',
  'ZenCoreStatusClassicExperiment',
  'ZenCoreStatusVNextWorkspace',
  'ZenWorkspaceState',
  'ZenWorkspaceStorage',
  'model/vnext/factors',
  'zenDevelopmentWorkspaceState.dev',
  'VNextPreferenceModel',
  'zenVNextOptimizer.worker',
  'zenVNextPreferenceTrainer.worker',
  'zenAbTrialEvaluator.worker',
  'zenLatentOptimizer.worker',
  'disabledZenExperimentalWorker.worker',
  'researchLearning',
  'structuralAB',
  'zenCoreStatusVNext.dev',
  'zenCoreStatusClassicExperiment.dev',
  'runtimeDebuggerAutomationContract.dev',
  'runtimeDebuggerAutomationContentRelay.dev',
  'runtimeDebuggerAutomationMessageRoutes.dev',
  'buildCapabilityMessageRoutes.dev',
  'buildCapabilityContentRelay.dev',
  'audioDullingQaContract.dev',
  'audioDullingQaMessageRoutes.dev',
  'audioDullingQaBrowserPort.dev',
  'audioDullingQaPopupBootstrap.dev',
  'gateQaAutomationContract.dev',
  'gateQaAutomationMessageRoutes.dev',
  'interventionCollisionQaContract.dev',
  'interventionCollisionQaMessageRoutes.dev',
  'interventionCollisionQaFixture.dev',
  'sentinelProtocolQaAutomationContract.dev',
  'sentinelProtocolQaAutomationMessageRoutes.dev',
  'videoSkipControlSurfaceQaContract.dev',
  'videoSkipControlSurfaceQaMessageRoutes.dev',
  'QA_VIDEO_SKIP_CONTROL_SURFACE_START',
  'entropy.video-skip-control-surface.qa.v1',
  'qaAutomationHarnessTrust.dev',
  'qaScenarioTabActivationContract.dev',
  'qaScenarioTabActivationMessageRoutes.dev',
  'FeedHorizonInspectionSession.dev',
  'feedHorizonInspection.dev',
  'feedHorizonInspectionContract.dev',
  'shortFormTargetOutcome.dev',
  'runtimeDiscoveryLedger.dev',
  'runtimeContentionLedger.dev',
  'FirstVisionDevelopmentProjection.dev',
  'progressionDebugActions.dev',
  'progressionUnlockDebugContract.dev',
  'progressionDebugRepository.dev',
  'ProgressionUnlockDebugRepository',
  'qaProgressionProvisioningMessageRoutes.dev',
  'zenMainCaptureProfile.dev',
  'sitesIntelCaptureProfile.dev',
  'siteIntelCaptureFixtures.dev',
]);

const forbiddenSignatures = Object.freeze([
  'QA_GOAL_DELIVERY_CHARGE',
  'entropy-goal-delivery-qa',
  'goal_delivery_qa_charge_v1',
  'QA_SETTINGS_PROPAGATION_ARM',
  'QA_SETTINGS_PROPAGATION_READ',
  'QA_SETTINGS_PROPAGATION_RELEASE',
  'entropy-settings-propagation-qa',
  '__ENTROPY_BOOT_TELEMETRY__',
  '__ENTROPY_TAB_ENTRY_TELEMETRY__',
  '__ENTROPY_ZEN_RENDER_TRACE__',
  'zen_bonsai_plume_model_timing_v1',
  '__ENTROPY_QA_ZEN_MODEL_PROFILE_READY__',
  '__ENTROPY_QA_ZEN_MODEL_PROFILE_ACK__',
  'entropy_debug_zen_render_trace',
  'dumpBaseline',
  'PerformanceObserver',
  'longtask',
  'CLSE_SCROLL_DATA',
  'CLSE_MEDIA_DATA',
  'CLSE_CONTENT_DATA',
  'zenTrace.dev',
  'entropy.runtimeDebugger',
  'short_form_terminal_causality_unproven',
  'same_flush_prune_batch',
  'owner_target_operation',
  'owner_target_ancestor_operation',
  'owner_target_reconcile',
  'owner_target_ancestor_reconcile',
  'runtimeDebuggerAutomation',
  'RuntimeDebuggerAutomation',
  'RUNTIME_DEBUGGER_AUTOMATION',
  'entropy.gate.qa.v1',
  'GATE_QA_AUTOMATION',
  'QA_GATE_PRESENT_ENTRY_CHECKPOINT',
  'QA_GATE_PRESENT_DETOUR_SPREAD',
  'QA_GATE_DISMISS',
  'QA_INTERVENTION_COLLISION',
  'entropy.intervention.collision.qa.v1',
  'prepare_enso_candidate',
  'collision_enso_operational_prerequisite',
  'entropy.sentinel.qa.v1',
  'SENTINEL_PROTOCOL_QA',
  'QA_SENTINEL_PROTOCOL_START',
  'QA_SENTINEL_PROTOCOL_SNAPSHOT',
  'QA_SENTINEL_PROTOCOL_STOP',
  'entropy.audioDullingQa.v1',
  'QA_AUDIO_DULLING_',
  'QA_AUDIO_DULLING_PREPARE',
  'runtime_discovery_identity_records_measured',
  'same_node_scope_can_serve_distinct_feature_outputs',
  'weakmap_numeric_node_id',
  'DEBUG_RUNTIME_SESSION_START',
  'DEBUG_RUNTIME_SESSION_RESET',
  'DEBUG_RUNTIME_SESSION_SNAPSHOT',
  'DEBUG_RUNTIME_SESSION_REPORT',
  'DEBUG_RUNTIME_SET_TERMINUS_DRY_RUN',
  'DEBUG_RUNTIME_CONTROL_FEED_HORIZON_INSPECTION',
  'DEBUG_RUNTIME_SET_FEED_CONSUMPTION_RESEARCH',
  'DEBUG_RUNTIME_FORCE_ENSO_GATE',
  'DEBUG_RUNTIME_DISMISS_ENSO_GATE',
  'DEBUG_QA_ACTIVATE_SCENARIO_TAB',
  'DEBUG_RUNTIME_SET_FEED_HORIZON_INSPECTION',
  'DEBUG_RUNTIME_SESSION_STOP',
  'ENTROPY_ARTIFACT_DISCLOSURE_PROJECTION_DEV',
  'ENTROPY_PROGRESSION_UNLOCK_DEBUG_DEV',
  'ENTROPY_FIRST_VISION_DEVELOPMENT_PROJECTION_DEV',
  'DEBUG_SET_PROGRESSION_UNLOCK_DAY',
  'DEBUG_SET_PROGRESSION_UNLOCK_MODE',
  'DEBUG_CLEAR_PROGRESSION_UNLOCK_OVERRIDE',
  'DEBUG_RESET_FIRST_VISION_PROGRESSION',
  'QA_PROVISION_CANONICAL_PROGRESSION',
  'QA_CLEAR_PROGRESSION_SESSION_STATE',
  'ENTROPY_ZEN_MAIN_CAPTURE_PROFILE_DEV',
  '__ENTROPY_ZEN_MAIN_CAPTURE_PROFILE__',
  'entropy-qa-capture',
  'progression_unlock_debug_v1',
  'progression_unlock_debug_v2',
  'progression_unlock_debug_v3',
  'first_vision_preview',
  'zen_bonsai_workspace_mode',
  'zen_vnext_seed',
  'zen_vnext_factors',
  'zen_vnext_reliability_hint',
]);

const dormantAudioCaptureModuleFragments = Object.freeze([
  'src/apps/offscreen/main.js',
  'src/apps/offscreen/audioDullingGraph.js',
  'src/pages/offscreen.html',
  'src/domains/protection/background/audioDulling/AudioDullingCoordinator.js',
  'src/domains/protection/audioDulling/audioDullingResolutionPlan.js',
  'src/domains/protection/background/protocol/dispatch/ProtectionAudioDullingDispatchBridge.js',
  'src/domains/protection/content/runtime/AudioDullingActivationChip.js',
]);

const dormantAudioCaptureSignatures = Object.freeze([
  'getUserMedia',
  'chromeMediaSource',
  'tabCapture.getMediaStreamId',
  'tabCaptureGetMediaStreamId',
  'startAudioDullingCaptureForTab',
  'getAudioDullingTabState',
]);

const developmentOnlyInterventionModuleFragments = Object.freeze([
  'src/domains/nudge/media/PageMediaActivityObserver.js',
  'src/domains/nudge/media/mediaConsumptionEvidence.js',
  'src/domains/nudge/attention/consumptionPatternClassifier.js',
  'src/domains/nudge/runtime/InterventionAdmissionArbiter.js',
  'src/domains/nudge/runtime/InterventionAdmissionShadow.js',
  'src/domains/nudge/runtime/interventionAdmissionRuntime.dev.js',
  'src/domains/nudge/interaction/ensoInterventionCandidate.js',
  'src/domains/protection/audioDulling/suikinkutsuInterventionCandidate.js',
]);

class PublicBuildDebugSurfaceCheckError extends Error {
  constructor(message) {
    super(message);
    this.name = 'PublicBuildDebugSurfaceCheckError';
  }
}

function fail(message) {
  throw new PublicBuildDebugSurfaceCheckError(message);
}

function createCheckContext(outputDir = 'dist-prod') {
  const outDir = path.resolve(rootDir, outputDir || 'dist-prod');
  return Object.freeze({
    outDir,
    buildInfoPath: path.resolve(outDir, 'entropy-build-info.json'),
    manifestPath: path.resolve(outDir, '.vite/manifest.json'),
    moduleInventoryPath: path.resolve(outDir, MODULE_INVENTORY_RELATIVE_PATH),
    nudgeRenderHostHtmlPath: path.resolve(outDir, 'src/pages/nudge-render-host.html'),
  });
}

function collectFiles(dir, files = []) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      collectFiles(fullPath, files);
      continue;
    }
    const extension = path.extname(entry.name);
    if (ignoredExtensions.has(extension)) continue;
    if (scannedExtensions.has(extension)) {
      files.push(fullPath);
    }
  }
  return files;
}

function findLine(content, index) {
  let line = 1;
  for (let offset = 0; offset < index; offset += 1) {
    if (content.charCodeAt(offset) === 10) {
      line += 1;
    }
  }
  return line;
}

function readBuildInfo({ buildInfoPath }) {
  if (!fs.existsSync(buildInfoPath)) {
    fail(`build info is missing: ${path.relative(rootDir, buildInfoPath)}`);
  }
  try {
    return JSON.parse(fs.readFileSync(buildInfoPath, 'utf8'));
  } catch (error) {
    fail(`build info is not valid JSON: ${error?.message || error}`);
  }
  return null;
}

function assertBuildInfoField(condition, message) {
  if (!condition) {
    fail(`public build provenance is invalid: ${message}`);
  }
}

function isCanonicalIsoTimestamp(value) {
  if (typeof value !== 'string' || value.length === 0) return false;
  const timestamp = Date.parse(value);
  if (!Number.isFinite(timestamp)) return false;
  return new Date(timestamp).toISOString() === value;
}

export function validateZenDevelopmentWorkspaceBuildBoundary({
  viteConfigSource,
  devEntrySource,
  publicEntrySource,
} = {}) {
  if (
    typeof viteConfigSource !== 'string'
    || typeof devEntrySource !== 'string'
    || typeof publicEntrySource !== 'string'
  ) {
    fail('Zen development workspace build boundary sources are required.');
  }
  for (const requiredViteSignature of [
    'const zenDevelopmentWorkspaceStateEntryModulePath = resolve(',
    'releaseCapabilities.includeDebugTools',
    "? 'zenDevelopmentWorkspaceState.dev.js'",
    ": 'zenDevelopmentWorkspaceState.public.js'",
    "'@zen-development-workspace-state-entry': zenDevelopmentWorkspaceStateEntryModulePath",
  ]) {
    if (viteConfigSource.includes(requiredViteSignature)) continue;
    fail(`Zen development workspace Vite alias contract is missing: ${requiredViteSignature}.`);
  }
  if (
    !/from\s+['"]\.\.\/\.\.\/state\/ZenWorkspaceState\.js['"]/u.test(devEntrySource)
    || !devEntrySource.includes('export const zenDevelopmentWorkspaceState = Object.freeze({')
  ) {
    fail('Zen development workspace dev entry must own the ZenWorkspaceState projection.');
  }
  const canonicalPublicEntry = 'export const zenDevelopmentWorkspaceState = null;';
  if (publicEntrySource.trim() !== canonicalPublicEntry) {
    fail('Zen development workspace public entry must be the canonical import-free null seam.');
  }
  if (/\bimport\b/u.test(publicEntrySource) || publicEntrySource.includes('ZenWorkspaceState')) {
    fail('Zen development workspace public entry must not import ZenWorkspaceState.');
  }
}

function checkZenDevelopmentWorkspaceBuildBoundary() {
  validateZenDevelopmentWorkspaceBuildBoundary({
    viteConfigSource: fs.readFileSync(path.resolve(rootDir, 'vite.config.js'), 'utf8'),
    devEntrySource: fs.readFileSync(
      path.resolve(rootDir, ZEN_DEVELOPMENT_WORKSPACE_DEV_ENTRY),
      'utf8',
    ),
    publicEntrySource: fs.readFileSync(
      path.resolve(rootDir, ZEN_DEVELOPMENT_WORKSPACE_PUBLIC_ENTRY),
      'utf8',
    ),
  });
}

function containsObjectKey(value, targetKey) {
  if (!value || typeof value !== 'object') return false;
  if (Array.isArray(value)) {
    return value.some((entry) => containsObjectKey(entry, targetKey));
  }
  if (Object.prototype.hasOwnProperty.call(value, targetKey)) return true;
  return Object.values(value).some((entry) => containsObjectKey(entry, targetKey));
}

function validatePublicBuildProvenance(buildInfo) {
  assertBuildInfoField(
    buildInfo && typeof buildInfo === 'object' && !Array.isArray(buildInfo),
    'entropy-build-info.json must contain an object.',
  );
  assertBuildInfoField(
    !containsObjectKey(buildInfo, 'extensionOutDir'),
    'extensionOutDir must not be serialized into the artifact.',
  );
  assertBuildInfoField(
    buildInfo.schemaVersion === PUBLIC_BUILD_INFO_SCHEMA_VERSION,
    `schemaVersion must equal ${PUBLIC_BUILD_INFO_SCHEMA_VERSION}.`,
  );
  assertBuildInfoField(
    typeof buildInfo.buildId === 'string' && buildInfo.buildId.trim().length > 0,
    'buildId must be a non-empty string.',
  );
  assertBuildInfoField(buildInfo.command === 'build', 'command must equal "build".');
  assertBuildInfoField(
    buildInfo.releaseProfile === 'public',
    'releaseProfile must equal "public".',
  );
  assertBuildInfoField(
    PUBLIC_EXTENSION_TARGETS.has(buildInfo.extensionTarget),
    `extensionTarget must be one of ${Array.from(PUBLIC_EXTENSION_TARGETS).join(', ')}.`,
  );
  assertBuildInfoField(
    isCanonicalIsoTimestamp(buildInfo.createdAt),
    'createdAt must be a canonical ISO timestamp.',
  );
  assertBuildInfoField(
    typeof buildInfo.gitCommitSha === 'string'
      && LOWERCASE_GIT_OBJECT_ID.test(buildInfo.gitCommitSha),
    'gitCommitSha must be a 40-character lowercase hexadecimal Git object ID.',
  );
  assertBuildInfoField(
    typeof buildInfo.gitTreeSha === 'string'
      && LOWERCASE_GIT_OBJECT_ID.test(buildInfo.gitTreeSha),
    'gitTreeSha must be a 40-character lowercase hexadecimal Git object ID.',
  );
  assertBuildInfoField(
    typeof buildInfo.dirty === 'boolean',
    'dirty must be a boolean.',
  );
  assertBuildInfoField(
    typeof buildInfo.lockfileSha256 === 'string'
      && LOWERCASE_SHA256.test(buildInfo.lockfileSha256),
    'lockfileSha256 must be a 64-character lowercase hexadecimal SHA-256 digest.',
  );

  const expectedCommitFragment = buildInfo.gitCommitSha.slice(0, 12);
  const expectedTreeState = buildInfo.dirty ? 'dirty' : 'clean';
  assertBuildInfoField(
    buildInfo.buildId.includes(expectedCommitFragment),
    `buildId must encode commit ${expectedCommitFragment}.`,
  );
  assertBuildInfoField(
    buildInfo.buildId.includes(expectedTreeState),
    `buildId must encode tree state ${expectedTreeState}.`,
  );
}

function readManifest({ manifestPath }) {
  if (!fs.existsSync(manifestPath)) {
    fail(`Vite manifest is missing: ${path.relative(rootDir, manifestPath)}`);
  }
  let manifest;
  try {
    manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  } catch (error) {
    fail(`Vite manifest is not valid JSON: ${error?.message || error}`);
  }
  if (!manifest || typeof manifest !== 'object' || Array.isArray(manifest)) {
    fail('Vite manifest must contain an object.');
  }
  return manifest;
}

function collectManifestResearchFindings(manifest) {
  const findings = [];
  for (const [entryKey, rawEntry] of Object.entries(manifest)) {
    if (!rawEntry || typeof rawEntry !== 'object' || Array.isArray(rawEntry)) {
      fail(`Vite manifest entry ${JSON.stringify(entryKey)} must contain an object.`);
    }

    const fields = [['key', entryKey]];
    for (const fieldName of ['src', 'file']) {
      if (rawEntry[fieldName] === undefined) continue;
      if (typeof rawEntry[fieldName] !== 'string') {
        fail(`Vite manifest entry ${JSON.stringify(entryKey)} field ${fieldName} must be a string.`);
      }
      fields.push([fieldName, rawEntry[fieldName]]);
    }
    for (const fieldName of ['imports', 'dynamicImports']) {
      if (rawEntry[fieldName] === undefined) continue;
      if (!Array.isArray(rawEntry[fieldName])
        || rawEntry[fieldName].some((value) => typeof value !== 'string')) {
        fail(
          `Vite manifest entry ${JSON.stringify(entryKey)} field ${fieldName} must be an array of strings.`,
        );
      }
      rawEntry[fieldName].forEach((value, index) => {
        fields.push([`${fieldName}[${index}]`, value]);
      });
    }

    for (const [fieldName, value] of fields) {
      for (const fragment of forbiddenManifestFragments) {
        if (!value.includes(fragment)) continue;
        findings.push({ entryKey, fieldName, value, fragment });
      }
    }
  }
  return findings;
}

function checkPublicManifestResearchInventory(context) {
  const manifest = readManifest(context);
  const findings = collectManifestResearchFindings(manifest);
  if (findings.length > 0) {
    fail([
      'Zen research entries were found in the public Vite manifest:',
      ...findings.map((finding) => (
        `  - ${JSON.stringify(finding.entryKey)} ${finding.fieldName}=${JSON.stringify(finding.value)}`
        + ` (${finding.fragment})`
      )),
    ].join('\n'));
  }
  return manifest;
}

function assertSafeModuleInventoryPath(value, label) {
  if (typeof value !== 'string' || value.length === 0) {
    fail(`${label} must be a non-empty string.`);
  }
  const normalized = value.replaceAll('\\', '/');
  if (
    normalized.includes('\0')
    || path.posix.isAbsolute(normalized)
    || /^[A-Za-z]:\//.test(normalized)
    || normalized === '..'
    || normalized.startsWith('../')
    || normalized.includes('/../')
  ) {
    fail(`${label} must be a safe project-relative path: ${JSON.stringify(value)}`);
  }
}

function readModuleInventory({ moduleInventoryPath }) {
  if (!fs.existsSync(moduleInventoryPath)) {
    fail(`artifact module inventory is missing: ${path.relative(rootDir, moduleInventoryPath)}`);
  }
  let inventory;
  try {
    inventory = JSON.parse(fs.readFileSync(moduleInventoryPath, 'utf8'));
  } catch (error) {
    fail(`artifact module inventory is not valid JSON: ${error?.message || error}`);
  }
  if (!inventory || typeof inventory !== 'object' || Array.isArray(inventory)) {
    fail('artifact module inventory must contain an object.');
  }
  if (inventory.schemaVersion !== MODULE_INVENTORY_SCHEMA_VERSION) {
    fail(
      `artifact module inventory schemaVersion must equal ${MODULE_INVENTORY_SCHEMA_VERSION}.`,
    );
  }
  if (!inventory.chunks || typeof inventory.chunks !== 'object' || Array.isArray(inventory.chunks)) {
    fail('artifact module inventory chunks must contain an object.');
  }

  for (const [artifactFile, moduleIds] of Object.entries(inventory.chunks)) {
    assertSafeModuleInventoryPath(artifactFile, 'artifact module inventory chunk path');
    if (!Array.isArray(moduleIds)) {
      fail(`artifact module inventory chunk must contain an array: ${artifactFile}`);
    }
    moduleIds.forEach((moduleId, index) => {
      assertSafeModuleInventoryPath(
        moduleId,
        `artifact module inventory ${artifactFile}[${index}]`,
      );
    });
  }
  return inventory;
}

function checkPublicModuleInventory(context, manifest) {
  const inventory = readModuleInventory(context);
  const manifestJsFiles = new Set(Object.values(manifest).flatMap((entry) => (
    typeof entry?.file === 'string' && entry.file.endsWith('.js') ? [entry.file] : []
  )));
  for (const artifactFile of manifestJsFiles) {
    if (!Array.isArray(inventory.chunks[artifactFile])) {
      fail(`artifact module inventory is missing a manifest chunk: ${artifactFile}`);
    }
  }

  const findings = [];
  for (const [artifactFile, moduleIds] of Object.entries(inventory.chunks)) {
    for (const moduleId of moduleIds) {
      for (const fragment of forbiddenManifestFragments) {
        if (!moduleId.includes(fragment)) continue;
        findings.push({ artifactFile, moduleId, fragment });
      }
    }
  }
  if (findings.length > 0) {
    fail([
      'Zen research modules were found in the public Rollup module inventory:',
      ...findings.map((finding) => (
        `  - ${finding.artifactFile} <- ${finding.moduleId} (${finding.fragment})`
      )),
    ].join('\n'));
  }
  return inventory;
}

function checkApprovedServiceWorkerWakeDiagnostic(context, inventory) {
  const owningArtifacts = Object.entries(inventory.chunks)
    .filter(([, moduleIds]) => moduleIds.includes(APPROVED_SERVICE_WORKER_WAKE_DIAGNOSTIC_MODULE))
    .map(([artifactFile]) => artifactFile);
  if (owningArtifacts.length !== 1) {
    fail(
      `bounded service-worker wake diagnostic must have one public artifact owner; found ${owningArtifacts.length}.`,
    );
  }
  const ownerArtifact = owningArtifacts[0];
  const escapedArtifacts = [];
  for (const filePath of collectFiles(context.outDir)) {
    const content = fs.readFileSync(filePath, 'utf8');
    if (!content.includes(APPROVED_SERVICE_WORKER_WAKE_DIAGNOSTIC_GLOBAL)) continue;
    escapedArtifacts.push(path.relative(context.outDir, filePath).replaceAll('\\', '/'));
  }
  if (
    escapedArtifacts.length !== 1
    || escapedArtifacts[0] !== ownerArtifact.replaceAll('\\', '/')
  ) {
    fail(
      `approved service-worker wake diagnostic global escaped its owner: ${escapedArtifacts.join(', ') || 'missing'}.`,
    );
  }
  const ownerSource = fs.readFileSync(path.join(context.outDir, ownerArtifact), 'utf8');
  for (const requiredSignature of [
    'snapshot',
    'generationId',
    'telemetryInstalledAtEpochMs',
    'milestones',
    'messages',
    'recentMessages',
    'slowMessages',
    'routePhases',
    'routePhaseError',
    'BACKGROUND_WAKE_TELEMETRY_ROUTE_PHASE_FAILED',
    'readiness_started',
    'readiness_settled',
    'capture_started',
    'capture_settled',
    'acquire_started',
    'acquire_settled',
    'handler_started',
    'handler_returned',
    'CONTENT_FLOW_SIGNAL',
    'messageLimit',
    'droppedMessageCount',
    'OTHER_ACTION',
    'NONCANONICAL_ERROR',
  ]) {
    if (ownerSource.includes(requiredSignature)) continue;
    fail(`approved service-worker wake diagnostic is missing bounded field/action: ${requiredSignature}.`);
  }
}

function isDormantAudioCaptureArtifactPath(relativePath) {
  const normalized = relativePath.replaceAll('\\', '/');
  if (normalized === 'src/pages/offscreen.html') return true;
  return /^assets\/offscreen(?:-[A-Za-z0-9_-]+)?\.js$/u.test(normalized);
}

function checkNoDormantAudioCaptureArtifacts(context, inventory) {
  const findings = [];
  for (const [artifactFile, moduleIds] of Object.entries(inventory.chunks)) {
    for (const moduleId of moduleIds) {
      for (const fragment of dormantAudioCaptureModuleFragments) {
        if (!moduleId.includes(fragment)) continue;
        findings.push(`${artifactFile} <- ${moduleId} (module:${fragment})`);
      }
    }
  }

  for (const filePath of collectFiles(context.outDir)) {
    const relativePath = path.relative(context.outDir, filePath);
    if (isDormantAudioCaptureArtifactPath(relativePath)) {
      findings.push(`${relativePath} (release-excluded path)`);
    }
    const content = fs.readFileSync(filePath, 'utf8');
    for (const signature of dormantAudioCaptureSignatures) {
      const index = content.indexOf(signature);
      if (index === -1) continue;
      findings.push(`${relativePath}:${findLine(content, index)} (signature:${signature})`);
    }
  }

  if (findings.length > 0) {
    fail([
      'Dormant audio-capture code was found in public build artifacts:',
      ...findings.map((finding) => `  - ${finding}`),
    ].join('\n'));
  }
}

function checkNoDevelopmentOnlyInterventionArtifacts(inventory) {
  const findings = [];
  for (const [artifactFile, moduleIds] of Object.entries(inventory.chunks)) {
    for (const moduleId of moduleIds) {
      for (const fragment of developmentOnlyInterventionModuleFragments) {
        if (!moduleId.includes(fragment)) continue;
        findings.push(`${artifactFile} <- ${moduleId} (module:${fragment})`);
      }
    }
  }
  if (findings.length > 0) {
    fail([
      'Development-only intervention admission code was found in public build artifacts:',
      ...findings.map((finding) => `  - ${finding}`),
    ].join('\n'));
  }
}

function resolveNudgeRenderHostBundlePath({ outDir, nudgeRenderHostHtmlPath }) {
  if (!fs.existsSync(nudgeRenderHostHtmlPath)) {
    fail(
      `nudge render host HTML is missing: ${path.relative(rootDir, nudgeRenderHostHtmlPath)}`,
    );
  }

  const html = fs.readFileSync(nudgeRenderHostHtmlPath, 'utf8');
  const scriptSources = Array.from(html.matchAll(
    /<script\b[^>]*\bsrc\s*=\s*["']([^"']+)["'][^>]*>/gi,
  )).map((match) => match[1]);
  const renderHostSources = scriptSources.filter((source) => {
    const sourcePath = String(source || '').split(/[?#]/, 1)[0];
    return NUDGE_RENDER_HOST_BUNDLE_NAME.test(path.posix.basename(sourcePath));
  });

  if (renderHostSources.length !== 1) {
    fail(
      `${path.relative(rootDir, nudgeRenderHostHtmlPath)} must reference exactly one nudgeRenderHost JavaScript bundle; found ${renderHostSources.length}.`,
    );
  }

  const renderHostSource = renderHostSources[0];
  if (/^(?:[a-z]+:)?\/\//i.test(renderHostSource)) {
    fail(
      `${path.relative(rootDir, nudgeRenderHostHtmlPath)} must reference a local nudgeRenderHost bundle: ${renderHostSource}`,
    );
  }

  const sourcePath = renderHostSource.split(/[?#]/, 1)[0];
  const bundlePath = sourcePath.startsWith('/')
    ? path.resolve(outDir, sourcePath.replace(/^\/+/, ''))
    : path.resolve(path.dirname(nudgeRenderHostHtmlPath), sourcePath);
  const bundleRelativePath = path.relative(outDir, bundlePath);
  if (
    bundleRelativePath === '..'
    || bundleRelativePath.startsWith(`..${path.sep}`)
    || path.isAbsolute(bundleRelativePath)
  ) {
    fail(
      `${path.relative(rootDir, nudgeRenderHostHtmlPath)} points outside the build output: ${renderHostSource}`,
    );
  }
  if (!fs.existsSync(bundlePath) || !fs.statSync(bundlePath).isFile()) {
    fail(`nudge render host bundle is missing: ${path.relative(rootDir, bundlePath)}`);
  }
  return bundlePath;
}

function checkNudgeRenderHostRuntimeContract(context) {
  const bundlePath = resolveNudgeRenderHostBundlePath(context);
  const source = fs.readFileSync(bundlePath, 'utf8');
  const bundleLabel = path.relative(rootDir, bundlePath);

  if (source.includes(NUDGE_RENDER_HOST_LEGACY_DISABLE_SIGNATURE)) {
    fail(
      `${bundleLabel} contains the legacy whole-host disable stub ${JSON.stringify(NUDGE_RENDER_HOST_LEGACY_DISABLE_SIGNATURE)}.`,
    );
  }

  for (const requiredSignature of nudgeRenderHostRequiredSignatures) {
    if (requiredSignature.test(source)) continue;
    fail(`${bundleLabel} is missing the public nudge runtime contract: ${requiredSignature.label}.`);
  }
}

export function checkPublicBuildDebugSurface(outputDir = 'dist-prod') {
  const context = createCheckContext(outputDir);
  const { outDir } = context;
  if (!fs.existsSync(outDir)) {
    fail(`output directory not found: ${path.relative(rootDir, outDir)}`);
  }

  const buildInfo = readBuildInfo(context);
  const releaseProfile = buildInfo?.releaseProfile;
  if (releaseProfile === 'dev') {
    return Object.freeze({
      status: 'skipped',
      message: '[public-build-debug-surface] SKIP: releaseProfile=dev.',
    });
  }
  if (releaseProfile !== 'public') {
    fail(`build info releaseProfile must be exactly "public" or "dev"; received ${JSON.stringify(releaseProfile)}.`);
  }

  validatePublicBuildProvenance(buildInfo);
  checkZenDevelopmentWorkspaceBuildBoundary();
  const viteManifest = checkPublicManifestResearchInventory(context);
  const moduleInventory = checkPublicModuleInventory(context, viteManifest);
  checkApprovedServiceWorkerWakeDiagnostic(context, moduleInventory);
  checkNoDormantAudioCaptureArtifacts(context, moduleInventory);
  checkNoDevelopmentOnlyInterventionArtifacts(moduleInventory);

  checkNudgeRenderHostRuntimeContract(context);

  const findings = [];
  for (const filePath of collectFiles(outDir)) {
    const relativePath = path.relative(outDir, filePath);
    for (const fragment of forbiddenPathFragments) {
      if (!relativePath.includes(fragment)) continue;
      findings.push({
        filePath,
        signature: `path:${fragment}`,
        line: 1,
      });
    }
    const content = fs.readFileSync(filePath, 'utf8');
    for (const signature of forbiddenSignatures) {
      const index = content.indexOf(signature);
      if (index === -1) continue;
      findings.push({
        filePath,
        signature,
        line: findLine(content, index),
      });
    }
  }

  if (findings.length > 0) {
    fail([
      'Debug-only signatures were found in public build artifacts:',
      ...findings.map((finding) => (
        `  - ${path.relative(rootDir, finding.filePath)}:${finding.line} (${finding.signature})`
      )),
    ].join('\n'));
  }

  return Object.freeze({
    status: 'passed',
    message: `[public-build-debug-surface] PASS: scanned ${path.relative(rootDir, outDir)}.`,
  });
}

export function runPublicBuildDebugSurfaceCli(
  outputDir = 'dist-prod',
  {
    writeStdout = (message) => console.log(message),
    writeStderr = (message) => console.error(message),
  } = {},
) {
  try {
    const result = checkPublicBuildDebugSurface(outputDir);
    writeStdout(result.message);
    return 0;
  } catch (error) {
    writeStderr(`[public-build-debug-surface] FAIL: ${error?.message || error}`);
    return 1;
  }
}

const currentFilePath = fileURLToPath(import.meta.url);
const invokedFilePath = process.argv[1] ? path.resolve(process.argv[1]) : '';
if (invokedFilePath === currentFilePath) {
  process.exitCode = runPublicBuildDebugSurfaceCli(process.argv[2] || 'dist-prod');
}
