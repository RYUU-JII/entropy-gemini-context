#!/usr/bin/env node

import fs from 'node:fs/promises';
import path from 'node:path';
import {
  findShortFormPlatformImportBoundaryViolations,
  SHORT_FORM_PLATFORM_IMPORT_BOUNDARY,
} from './shortFormPlatformImportBoundary.mjs';

const rootDir = process.cwd();
const failures = [];

const requiredFiles = Object.freeze([
  'src/domains/protection/runtime/fullscreenVisualPolicy.js',
  'tests/fullscreenVisualPolicy.test.js',
  'tests/settingsPersistenceCapability.test.js',
  'tests/ensoIntervalSettings.test.js',
  'src/domains/settings/config/frictionIntensityBands.js',
  'src/domains/settings/config/visualFrictionProfiles.js',
  'src/domains/settings/config/adaptiveFrictionProfiles.js',
  'src/domains/settings/config/filterValueSemantics.js',
  'src/domains/protection/content/prepaintVisualAssets.js',
  'scripts/release/prepaintVisualAssetsPlugin.mjs',
  'tests/adaptiveFrictionProfiles.test.js',
  'tests/canonicalArtifactTelemetryProfiles.test.js',
  'src/domains/protection/runtime/frictionModifierResolver.js',
  'src/domains/protection/runtime/frictionModifierSessionState.js',
  'src/domains/protection/contracts/compiledRuntimeFilterPlanContract.js',
  'src/domains/protection/content/runtime/ProtectionFrictionModifierRuntime.js',
  'src/platform/scheduling/mainThreadCooperativeScheduler.js',
  'src/platform/scheduling/cooperativeMutationBatchQueue.js',
  'src/domains/protection/background/runtime/FeedFlowRuntimeStateOwner.js',
  'src/domains/nudge/visual/socialMetrics/core/runtimeState.js',
  'src/domains/nudge/visual/socialMetrics/core/compiledScanPlan.js',
  'src/domains/nudge/visual/socialMetrics/core/diagnosticsRuntimeBridge.js',
  'src/domains/nudge/visual/socialMetrics/core/scanRuntimeBridge.js',
  'src/domains/nudge/visual/socialMetrics/core/mutationGroupRouter.js',
  'src/domains/nudge/visual/socialMetrics/core/ownedMutationRuntimeBridge.js',
  'src/domains/nudge/visual/socialMetrics/core/ownedMutationLedger.js',
  'src/domains/nudge/visual/socialMetrics/core/documentNodeIdentity.js',
  'src/domains/nudge/visual/socialMetrics/core/selectorDriftRecoveryContract.js',
  'src/domains/nudge/visual/socialMetrics/core/observerInterestPlan.js',
  'src/domains/nudge/visual/socialMetrics/adapters/hostTextPatternCatalog.js',
  'src/domains/nudge/visual/socialMetrics/adapters/xMetricEffectOwner.js',
  'tests/socialMetricsXEffectOwner.test.js',
  'src/domains/nudge/visual/socialMetrics/adapters/redditSemanticMutationAttributes.js',
  'src/domains/nudge/targeting/siteIdentityCatalog.js',
  'src/domains/nudge/targeting/contracts/targetProfileContracts.js',
  'src/domains/nudge/core/targetingHealthContract.js',
  'src/lib/dom/selectorAttributeDependencies.js',
  'src/platform/storage/runtime/FrictionModifierSessionRepository.js',
  'tests/frictionModifierResolver.test.js',
  'tests/frictionModifierSessionState.test.js',
  'tests/visualManagerFullscreenRelaxation.test.js',
  'tests/frictionTargetingPerformanceGuards.test.js',
  'tests/observerHubPerfDebug.test.js',
  'tests/siteTargetProfiles.test.js',
  'tests/targetProfileContracts.test.js',
  'tests/targetingHealthContract.test.js',
  'tests/selectorAttributeDependencies.test.js',
  'tests/textShuffleDirectSelectors.test.js',
  'tests/visualManagerMediaGate.test.js',
  'tests/compiledRuntimeFilterPlanContract.test.js',
  'tests/protectionKeyedEffectDedup.test.js',
  'tests/mainThreadCooperativeScheduler.test.js',
  'tests/cooperativeMutationBatchQueue.test.js',
  'src/domains/nudge/behavior/pagedScrollIntentActuator.js',
  'tests/pagedScrollIntentActuator.test.js',
  'tests/socialMetricsManager.youtubeMetadata.test.js',
  'tests/fixtures/youtubeSelectorDriftScenarios.js',
  'tests/youtubeSelectorDriftMetamorphic.test.js',
  'reports/youtube-selector-drift-phase4/2026-08-13/corpus-candidates.json',
  'reports/youtube-selector-drift-phase4/2026-08-13/capture-manifest.json',
  'reports/youtube-selector-drift-phase4/2026-08-13/audit-report.md',
  'tests/youtubeSelectorDriftIndependentCorpus.audit.test.js',
  'tests/socialMetricsSelectorDriftExpansion.test.js',
  'reports/social-selector-drift-phase4/2026-08-14/corpus-candidates.json',
  'reports/social-selector-drift-phase4/2026-08-14/capture-manifest.json',
  'reports/social-selector-drift-phase4/2026-08-14/audit-report.md',
  'tests/socialSelectorDriftIndependentCorpus.audit.test.js',
  'tests/socialMetricMutationGroupRouter.test.js',
  'tests/socialMetricObserverInterestPlan.test.js',
  'tests/runtimeDebuggerProbeCatalog.test.js',
  'tests/siteRuntimeE2E.test.js',
  'scripts/e2e/sites/siteRuntimeReport.mjs',
  'scripts/e2e/sites/layoutCycleAnalysis.mjs',
  'tests/siteLayoutCycleOracle.test.js',
  'tests/socialMetricsOwnedMutationLedger.test.js',
  'tests/socialMetricsDocumentNodeIdentity.test.js',
  'tests/socialMetricsScanController.test.js',
  'tests/socialMetricsRuntimePeerContracts.test.js',
  'tests/socialMetricsDiagnosticsSnapshotRuntime.test.js',
  'src/domains/nudge/runtime-debugger/RuntimeDebuggerShortFormOracle.js',
  'tests/runtimeDebuggerShortFormOracle.test.js',
  'tests/shortFormPlatformImportBoundary.test.js',
  'src/domains/nudge/video-skip/videoSkipListenerLedger.js',
  'src/domains/nudge/video-skip/videoSkipEventHandlers.js',
  'src/domains/nudge/video-skip/videoSkipMediaAdapter.js',
  'src/domains/nudge/video-skip/videoSkipMainWorldActuator.js',
  'src/domains/nudge/video-skip/VideoSkipMainWorldActuatorTransport.js',
  'src/domains/nudge/video-skip/videoSkipControlSurfaceCatalog.js',
  'src/domains/nudge/video-skip/VideoSkipControlSurfaceRuntime.js',
  'src/platform/storage/runtime/VideoSkipPoolRepository.js',
  'src/platform/storage/runtime/videoSkipPoolContract.js',
  'src/platform/storage/runtime/VideoSkipPoolWriteTransport.js',
  'src/platform/storage/runtime/VideoSkipPoolWriteCoordinator.js',
  'src/apps/background/services/runtime/messageRoutes/videoSkipPoolMessageRoutes.js',
  'tests/videoSkipListenerLedger.test.js',
  'tests/videoSkipMediaAdapter.test.js',
  'tests/videoSkipMainWorldActuator.test.js',
  'tests/videoSkipMainWorldActuatorTransport.test.js',
  'tests/videoSkipControlSurfaceRuntime.test.js',
  'tests/videoSkipPoolRepository.test.js',
  'tests/videoSkipPoolWriteTransport.test.js',
  'tests/videoSkipPoolWriteCoordinator.test.js',
  'src/domains/nudge/feed-flow/learning/FeedStructureLearner.js',
  'src/domains/nudge/feed-flow/config/ensoFeedHorizonRuntimeConfig.js',
  'src/domains/protection/contracts/feedTopologyAuthorityContract.js',
  'src/domains/nudge/feed-flow/topology/FeedTopologyRecoveryProtocol.js',
  'src/domains/nudge/feed-flow/topology/FeedLocalTopologyProbe.js',
  'src/domains/nudge/feed-flow/topology/FeedTopologyCertificationRuntime.js',
  'src/domains/nudge/feed-flow/topology/feedTopologyReadinessPresentation.js',
  'src/domains/nudge/feed-flow/topology/FeedTopologyPersistenceClient.js',
  'src/domains/nudge/feed-flow/topology/FeedTopologyPersistentCertificationService.js',
  'src/domains/nudge/feed-flow/topology/feedTopologyCertificateModel.js',
  'src/domains/nudge/feed-flow/topology/feedTopologyCertificationContracts.js',
  'src/platform/storage/model/FeedTopologyCertificateCheckpointContract.js',
  'src/platform/storage/model/FeedTopologyCertificateCheckpointRepository.js',
  'src/apps/background/services/runtime/messageRoutes/feedTopologyCertificateMessageRoutes.js',
  'src/domains/nudge/feed-flow/actuation/FeedActuationSafetyJudge.js',
  'src/domains/nudge/feed-flow/actuation/feedEndpointAdapterCatalog.js',
  'src/domains/nudge/feed-flow/actuation/feedEndpointTopologyInspection.js',
  'src/domains/nudge/feed-flow/actuation/FeedShippedTopologyProbe.js',
  'src/domains/nudge/feed-flow/actuation/FeedEndpointBoundaryResolver.js',
  'src/domains/nudge/feed-flow/contracts/feedEndpointPlanContract.js',
  'src/domains/nudge/feed-flow/terminus/feedEndpointBoundaryMotionProfile.js',
  'src/domains/nudge/feed-flow/terminus/feedEndpointTailPaintProfile.js',
  'src/domains/nudge/feed-flow/terminus/FeedEndpointBoundaryMotion.js',
  'src/domains/nudge/feed-flow/terminus/FeedEndpointForwardControlLease.js',
  'src/domains/nudge/feed-flow/terminus/FeedEndpointLease.js',
  'src/domains/nudge/feed-flow/terminus/FeedTerminusStageMachine.js',
  'src/domains/nudge/feed-flow/terminus/TerminusSurface.js',
  'src/domains/nudge/attention/rewardDriftEvidence.js',
  'src/domains/nudge/attention/RewardDriftObservationRuntime.js',
  'src/domains/nudge/attention/FeedBingeObservationWindow.js',
  'src/domains/nudge/attention/feedFlowBingeEvidence.js',
  'src/domains/nudge/attention/dopamineBingeDetector.js',
  'src/domains/nudge/attention/dopamineBingeEvidenceRuntime.js',
  'src/domains/nudge/attention/consumptionPatternClassifier.js',
  'src/domains/nudge/feed-flow/registry/feedSurfaceProfiles.js',
  'src/domains/nudge/feed-flow/registry/feedSurfaceRegistry.js',
  'src/domains/nudge/feed-flow/tempo/feedTempoContracts.js',
  'src/domains/nudge/feed-flow/tempo/FeedTempoEpisodeAssembler.js',
  'src/domains/nudge/feed-flow/tempo/feedTempoAdaptiveProfileModel.js',
  'src/domains/nudge/feed-flow/tempo/FeedTempoProfileLearner.js',
  'src/domains/nudge/feed-flow/tempo/FeedTempoPersistenceClient.js',
  'src/domains/nudge/feed-flow/tempo/FeedTempoPersistentProfileService.js',
  'src/domains/nudge/feed-flow/tempo/FeedTempoRuntime.js',
  'src/platform/storage/model/FeedTempoProfileCheckpointContract.js',
  'src/platform/storage/model/FeedTempoProfileCheckpointRepository.js',
  'src/domains/nudge/interaction/EnsoSpawnPolicy.js',
  'src/domains/nudge/interaction/EnsoRewardRearmPolicy.js',
  'src/domains/nudge/interaction/ensoSpawnSources.js',
  'src/domains/nudge/interaction/ensoInterventionCandidate.js',
  'src/domains/nudge/interaction/EnsoFeedSurfaceEntryGrace.js',
  'src/domains/nudge/interaction/EnsoRuntimeEpisodeManager.js',
  'src/domains/nudge/feed-flow/FeedBoundaryEpisodeCoordinator.js',
  'src/domains/nudge/runtime/furinEntryBoundary.js',
  'src/domains/nudge/interaction/ensoFeedEpisodeAdmission.js',
  'src/domains/nudge/interaction/ensoGateSurface.js',
  'src/domains/nudge/runtime/interventionAdmissionKernel.js',
  'src/domains/nudge/runtime/InterventionAdmissionArbiter.js',
  'src/domains/nudge/runtime/InterventionAdmissionShadow.js',
  'src/domains/nudge/runtime/interventionAdmissionRuntime.dev.js',
  'src/domains/nudge/runtime/interventionAdmissionRuntime.public.js',
  'tests/feedStructureLearner.test.js',
  'tests/feedTopologyRecoveryProtocol.test.js',
  'tests/feedTopologyLocalCertification.test.js',
  'tests/feedActuationSafetyJudge.test.js',
  'tests/feedEndpointPlanContract.test.js',
  'tests/feedEndpointBoundaryMotion.test.js',
  'tests/feedEndpointTailPaintProfile.test.js',
  'tests/feedHorizonQa.test.js',
  'tests/feedTerminusStageMachine.test.js',
  'tests/dopamineBingeDetector.test.js',
  'tests/consumptionPatternClassifier.test.js',
  'tests/interventionAdmissionKernel.test.js',
  'tests/interventionAdmissionArbiter.test.js',
  'tests/interventionAdmissionShadow.test.js',
  'tests/interventionAdmissionBuildProfile.test.js',
  'tests/ensoSpawnPolicy.test.js',
  'tests/rewardDriftObservationRuntime.test.js',
  'tests/rewardObservationPolicyIsolation.test.js',
  'tests/ensoRewardPresentationIsolation.test.js',
  'tests/ensoFeedSurfaceEntryGrace.test.js',
  'tests/feedSurfaceProfiles.test.js',
  'tests/feedTempoEpisodeAssembler.test.js',
  'tests/feedTempoPersistentProfile.test.js',
  'tests/feedTempoProfileLearner.test.js',
  'tests/runtimeDebuggerFeedProbe.test.js',
  'tests/ensoPlatformShadowScenarios.test.js',
  'scripts/dev/enso-shadow-scenario-matrix.mjs',
  'scripts/e2e/extensionChromiumHarness.mjs',
  'scripts/e2e/feedHorizonQaPresetCatalog.mjs',
  'scripts/e2e/feedHorizonQa.mjs',
  'scripts/e2e/feedHorizonInspectionE2E.mjs',
  'scripts/qa/catalog/qaTargetRegistry.mjs',
  'scripts/qa/protocols/feedHorizonQaProtocol.mjs',
  'scripts/qa/resources/QaBrowserLease.mjs',
  'src/domains/protection/domain/basicProtectionRecentTrajectory.js',
  'src/domains/protection/strategy/contracts/basicStrategyContextContract.js',
  'src/domains/protection/strategy/catalog/basicStrategyPolicy.js',
  'src/apps/dashboard/utils/protectionRuntimeInsights.js',
  'src/apps/dashboard/bootstrap/dashboardLaunchContext.js',
  'src/apps/dashboard/tabs/sites/SitesTab.jsx',
  'src/apps/dashboard/workspaces/sites/SitesManagementSurface.jsx',
  'src/domains/protection/background/protocol/dispatch/ProtectionNudgeDispatchContext.js',
  'docs/product/dashboard/basic-protection-strategy-prd.md',
  'docs/architecture/repository/friction-nudge-effect-boundary-map.md',
  'docs/architecture/runtime/feed-flow-runtime-target-architecture.md',
]);

const sourceScanRoots = Object.freeze([
  'src/apps/content',
  'src/domains/protection/content',
  'src/domains/nudge/visual',
]);

const sourceExtensions = new Set(['.js', '.jsx', '.mjs', '.ts', '.tsx']);

const allowedApplyProtectionEffectsFiles = new Set([
  'src/domains/protection/content/ProtectionStateApplier.js',
  'src/domains/protection/content/runtime/ProtectionFrictionModifierRuntime.js',
]);

const allowedClearAllProtectionEffectsFiles = new Set([
  'src/domains/protection/content/ProtectionRegistry.js',
  'src/domains/protection/content/runtime/ProtectionFrictionModifierRuntime.js',
]);

const absolute = (relativePath) => path.resolve(rootDir, relativePath);

function fail(message) {
  failures.push(message);
}

async function readUtf8(relativePath) {
  return fs.readFile(absolute(relativePath), 'utf8');
}

async function requireFile(relativePath) {
  try {
    await fs.access(absolute(relativePath));
  } catch {
    fail(`${relativePath}: required friction runtime architecture file is missing.`);
  }
}

async function forbidFile(relativePath) {
  try {
    await fs.access(absolute(relativePath));
    fail(`${relativePath}: retired friction targeting file must not be reintroduced.`);
  } catch (error) {
    if (error?.code !== 'ENOENT') throw error;
  }
}

function requireIncludes(source, relativePath, snippets) {
  snippets.forEach((snippet) => {
    if (!source.includes(snippet)) {
      fail(`${relativePath}: missing required friction runtime marker: ${snippet}`);
    }
  });
}

function requireExcludes(source, relativePath, snippets) {
  snippets.forEach((snippet) => {
    if (source.includes(snippet)) {
      fail(`${relativePath}: forbidden friction runtime marker is present: ${snippet}`);
    }
  });
}

function requireOrdered(source, relativePath, markers, explanation) {
  let cursor = 0;
  for (const marker of markers) {
    const next = source.indexOf(marker, cursor);
    if (next < 0) {
      fail(`${relativePath}: ${explanation}; missing or out-of-order marker: ${marker}`);
      return;
    }
    cursor = next + marker.length;
  }
}

function readSection(source, startMarker, endMarker = null) {
  const start = source.indexOf(startMarker);
  if (start < 0) return '';
  const end = endMarker ? source.indexOf(endMarker, start + startMarker.length) : -1;
  return source.slice(start, end >= 0 ? end : undefined);
}

async function collectSourceFiles(relativeDir) {
  const entries = await fs.readdir(absolute(relativeDir), { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const relativePath = path.join(relativeDir, entry.name).replaceAll(path.sep, '/');
    if (entry.isDirectory()) {
      files.push(...await collectSourceFiles(relativePath));
      continue;
    }
    if (!entry.isFile() || !sourceExtensions.has(path.extname(entry.name))) continue;
    files.push(relativePath);
  }

  return files;
}

async function collectActiveSourceFiles() {
  const fileSets = await Promise.all(sourceScanRoots.map(collectSourceFiles));
  return Array.from(new Set(fileSets.flat())).sort();
}

async function checkShortFormPlatformImportBoundary() {
  const importGraphRoots = ['src', 'scripts/e2e', 'scripts/qa'];
  const sourceFiles = Array.from(new Set((await Promise.all(
    importGraphRoots.map(collectSourceFiles),
  )).flat())).sort();
  const sourceEntries = await Promise.all(sourceFiles.map(async (relativePath) => ({
    relativePath,
    source: await readUtf8(relativePath),
  })));
  const violations = findShortFormPlatformImportBoundaryViolations(sourceEntries);
  violations.forEach(({ importerPath, specifier, resolvedPath }) => {
    fail(
      `${importerPath}: Short-form platform resolver import ${specifier} resolves to ${resolvedPath}; `
      + `only ${SHORT_FORM_PLATFORM_IMPORT_BOUNDARY.owner} may import `
      + `${SHORT_FORM_PLATFORM_IMPORT_BOUNDARY.targetRoot}/**.`,
    );
  });
}

async function checkRequiredFiles() {
  await Promise.all(requiredFiles.map(requireFile));
  await forbidFile('src/domains/settings/config/filterStepSemantics.js');
  for (const relativePath of [
    'src/domains/nudge/visual/mediaFilterController.js',
    'src/domains/protection/content/prepaintVisualAssets.js',
    'src/lib/filterCssVars.js',
  ]) {
    const source = await readUtf8(relativePath);
    requireIncludes(source, relativePath, [
        relativePath === 'src/domains/nudge/visual/mediaFilterController.js'
          ? 'buildMediaVisualFilterValue'
          : relativePath === 'src/lib/filterCssVars.js' ? 'requireVisualFrictionEntry' : 'grayscaleStrength = percent / 100',
    ]);
    requireExcludes(source, relativePath, [
      'materializeFilterLevelEntry', 'getAdjustedFilterLevelValue', 'MEDIA_BLUR_TONE_BAND_MAP',
    ]);
  }
  const prepaintPluginPath = 'scripts/release/prepaintVisualAssetsPlugin.mjs';
  requireIncludes(await readUtf8(prepaintPluginPath), prepaintPluginPath, [
    'prepaintVisualAssets.js', 'PREPAINT_VISUAL_STYLES', 'this.emitFile',
  ]);
}

async function checkCanonicalRuntimeWiring() {
  const protectionControllerPath = 'src/domains/protection/content/ProtectionController.js';
  const bootstrapEarlyRuntimePath = 'src/domains/protection/content/bootstrapEarlyRuntime.js';
  const bootstrapControllerPath = 'src/apps/content/bootstrapController.js';
  const envelopeContractPath = 'src/domains/protection/protocol/contracts/envelope.js';
  const protectionStateApplierPath = 'src/domains/protection/content/ProtectionStateApplier.js';
  const protectionActivationEnginePath = 'src/domains/protection/content/runtime/ProtectionActivationEngine.js';
  const runtimePath = 'src/domains/protection/content/runtime/ProtectionFrictionModifierRuntime.js';
  const cooperativeSchedulerPath = 'src/platform/scheduling/mainThreadCooperativeScheduler.js';
  const resolverPath = 'src/domains/protection/runtime/frictionModifierResolver.js';
  const sessionStatePath = 'src/domains/protection/runtime/frictionModifierSessionState.js';
  const sessionRepositoryPath = 'src/platform/storage/runtime/FrictionModifierSessionRepository.js';
  const trackingProtectionServicePath = 'src/domains/protection/background/TrackingProtectionService.js';
  const protectionRegistryPath = 'src/domains/protection/content/ProtectionRegistry.js';
  const socialMetricsRuntimeStatePath = 'src/domains/nudge/visual/socialMetrics/core/runtimeState.js';
  const visualManagerPath = 'src/domains/nudge/visual/visualManager.js';
  const videoElementObserverPath = 'src/domains/nudge/video/VideoElementObserver.js';
  const videoSkipManagerPath = 'src/domains/nudge/video-skip/VideoSkipManager.js';
  const videoSkipListenerLedgerPath = 'src/domains/nudge/video-skip/videoSkipListenerLedger.js';
  const videoSkipEventHandlersPath = 'src/domains/nudge/video-skip/videoSkipEventHandlers.js';
  const videoSkipMediaAdapterPath = 'src/domains/nudge/video-skip/videoSkipMediaAdapter.js';
  const videoSkipMainWorldActuatorPath = 'src/domains/nudge/video-skip/videoSkipMainWorldActuator.js';
  const videoSkipMainWorldActuatorTransportPath = 'src/domains/nudge/video-skip/VideoSkipMainWorldActuatorTransport.js';
  const videoSkipControlSurfaceCatalogPath = 'src/domains/nudge/video-skip/videoSkipControlSurfaceCatalog.js';
  const videoSkipControlSurfaceRuntimePath = 'src/domains/nudge/video-skip/VideoSkipControlSurfaceRuntime.js';
  const frictionDebugFlagsPath = 'src/platform/browser/dev/frictionDebugFlags.js';
  const videoSkipPoolRepositoryPath = 'src/platform/storage/runtime/VideoSkipPoolRepository.js';
  const videoSkipPoolWriteTransportPath = 'src/platform/storage/runtime/VideoSkipPoolWriteTransport.js';
  const videoSkipPoolWriteCoordinatorPath = 'src/platform/storage/runtime/VideoSkipPoolWriteCoordinator.js';
  const videoSkipPoolMessageRoutesPath = 'src/apps/background/services/runtime/messageRoutes/videoSkipPoolMessageRoutes.js';
  const backgroundMessageRouterBindingsPath = 'src/apps/background/services/runtime/backgroundKernelMessageRouterBindings.js';
  const boundaryMapPath = 'docs/architecture/repository/friction-nudge-effect-boundary-map.md';

  const [
    protectionControllerSource,
    bootstrapEarlyRuntimeSource,
    bootstrapControllerSource,
    envelopeContractSource,
    protectionStateApplierSource,
    protectionActivationEngineSource,
    runtimeSource,
    cooperativeSchedulerSource,
    resolverSource,
    sessionStateSource,
    sessionRepositorySource,
    trackingProtectionServiceSource,
    protectionRegistrySource,
    socialMetricsRuntimeStateSource,
    visualManagerSource,
    videoElementObserverSource,
    videoSkipManagerSource,
    videoSkipListenerLedgerSource,
    videoSkipEventHandlersSource,
    videoSkipMediaAdapterSource,
    videoSkipMainWorldActuatorSource,
    videoSkipMainWorldActuatorTransportSource,
    videoSkipControlSurfaceCatalogSource,
    videoSkipControlSurfaceRuntimeSource,
    frictionDebugFlagsSource,
    videoSkipPoolRepositorySource,
    videoSkipPoolWriteTransportSource,
    videoSkipPoolWriteCoordinatorSource,
    videoSkipPoolMessageRoutesSource,
    backgroundMessageRouterBindingsSource,
    boundaryMapSource,
  ] = await Promise.all([
    readUtf8(protectionControllerPath),
    readUtf8(bootstrapEarlyRuntimePath),
    readUtf8(bootstrapControllerPath),
    readUtf8(envelopeContractPath),
    readUtf8(protectionStateApplierPath),
    readUtf8(protectionActivationEnginePath),
    readUtf8(runtimePath),
    readUtf8(cooperativeSchedulerPath),
    readUtf8(resolverPath),
    readUtf8(sessionStatePath),
    readUtf8(sessionRepositoryPath),
    readUtf8(trackingProtectionServicePath),
    readUtf8(protectionRegistryPath),
    readUtf8(socialMetricsRuntimeStatePath),
    readUtf8(visualManagerPath),
    readUtf8(videoElementObserverPath),
    readUtf8(videoSkipManagerPath),
    readUtf8(videoSkipListenerLedgerPath),
    readUtf8(videoSkipEventHandlersPath),
    readUtf8(videoSkipMediaAdapterPath),
    readUtf8(videoSkipMainWorldActuatorPath),
    readUtf8(videoSkipMainWorldActuatorTransportPath),
    readUtf8(videoSkipControlSurfaceCatalogPath),
    readUtf8(videoSkipControlSurfaceRuntimePath),
    readUtf8(frictionDebugFlagsPath),
    readUtf8(videoSkipPoolRepositoryPath),
    readUtf8(videoSkipPoolWriteTransportPath),
    readUtf8(videoSkipPoolWriteCoordinatorPath),
    readUtf8(videoSkipPoolMessageRoutesPath),
    readUtf8(backgroundMessageRouterBindingsPath),
    readUtf8(boundaryMapPath),
  ]);

  requireIncludes(protectionControllerSource, protectionControllerPath, [
    "from './runtime/ProtectionFrictionModifierRuntime.js'",
    'await applyProtectionRuntimeEffectsCooperatively(activationPlan.filters',
    'clearProtectionRuntimeEffects()',
    'handleProtectionUpdateMessage(request, sendResponse, receiverEpoch)',
    'receiverEpoch === protectionRuntimeReceiverEpoch',
    'if (respondIfReceiverCancelled()) return;',
    'PROTECTION_RECEIVER_OPERATION_CANCELLED',
  ]);
  requireExcludes(protectionControllerSource, protectionControllerPath, [
    'applyProtectionEffects(activationPlan.filters',
    'clearAllProtectionEffects()',
  ]);

  requireIncludes(bootstrapEarlyRuntimeSource, bootstrapEarlyRuntimePath, [
    "from './runtime/ProtectionFrictionModifierRuntime.js'",
    'applyProtectionRuntimeEffects(filters',
  ]);
  requireExcludes(bootstrapEarlyRuntimeSource, bootstrapEarlyRuntimePath, [
    'applyProtectionEffects(filters',
  ]);

  requireIncludes(bootstrapControllerSource, bootstrapControllerPath, [
    "from '../../domains/protection/content/runtime/ProtectionFrictionModifierRuntime.js'",
    'clearProtectionRuntimeEffects()',
  ]);
  requireExcludes(bootstrapControllerSource, bootstrapControllerPath, [
    'clearAllProtectionEffects()',
  ]);

  const contentLoaderPath = 'src/apps/content/loader.js';
  const contentLoaderSource = await readUtf8(contentLoaderPath);
  requireIncludes(contentLoaderSource, contentLoaderPath, [
    "typeof entry.rootFilter !== 'string'",
    'ROOT_VISUAL_SNAPSHOT_FILTER_REQUIRED',
  ]);
  if (!/if\s*\(entry\.rootFilter\s*===\s*''\)\s*\{\s*suppressPrepaintVisualStyle\(root\);\s*restorePreloadedRootFilter\(\);\s*return;\s*\}/.test(contentLoaderSource)) {
    failures.push(`${contentLoaderPath}: canonical empty root visual plan must suppress prepaint and restore the owned preload`);
  }
  requireExcludes(contentLoaderSource, contentLoaderPath, ['if (!entry.rootFilter)']);

  requireIncludes(envelopeContractSource, envelopeContractPath, [
    'ENVELOPE_HOSTNAME_INVALID',
    'ENVELOPE_ACTIVATION_MAIN_INVALID',
  ]);

  requireIncludes(protectionStateApplierSource, protectionStateApplierPath, [
    'hostname: envelope.hostname',
    'domainClassId: envelope.domainClassId',
    'main: envelope.activation.main',
    'const patch = envelope.patch;',
    "throw new Error('COMPILED_FEATURES_INVALID')",
    "throw new Error('ACTIVATION_FEATURES_INVALID')",
    'ACTIVATION_FEATURE_ENABLED_INVALID',
    'Keyed Effect Error (${effect.key}):',
    'export async function applyProtectionEffectsCooperatively(',
    'PROTECTION_EFFECT_APPLICATION_FAILED',
    'failures.push(error)',
    'await yieldMainThreadContinuation()',
  ]);
  requireExcludes(protectionStateApplierSource, protectionStateApplierPath, [
    'revision: nextRevision ?? 0',
    'hostname: envelope.hostname ||',
    'domainClassId: envelope.domainClassId ||',
    'const patch = envelope.patch || {}',
    'previousState?.activation?.main',
    'request?.domainClassId || null',
    'if (!compiledFeatures || typeof compiledFeatures !== \'object\') return {}',
  ]);

  requireIncludes(protectionActivationEngineSource, protectionActivationEnginePath, [
    'domainClassId: activationState.domainClassId,',
  ]);
  requireExcludes(protectionActivationEngineSource, protectionActivationEnginePath, [
    'activationState.domainClassId || request?.domainClassId || null',
  ]);

  requireIncludes(runtimeSource, runtimePath, [
    'applyFullscreenVisualPolicy(',
    'fullscreenVisualRelaxation',
    'videoFullscreen',
    "'fullscreenchange'",
    'applyProtectionEffects(resolvedFilters',
    'applyProtectionEffectsCooperatively(',
    'effectApplicationEpoch',
    'clearAllProtectionEffects()',
  ]);

  requireExcludes(runtimeSource, runtimePath, [
    'normalizeVideoSkipGuardValue',
    'resolveFrictionModifiedFilters(',
    'createFilterIntensityModifier(',
    'FURIN_OVERRUN',
    'SCHEDULE_RELAXATION',
  ]);

  requireIncludes(cooperativeSchedulerSource, cooperativeSchedulerPath, [
    'MAIN_THREAD_COOPERATIVE_SLICE_BUDGET_MS = 3',
    'MAIN_THREAD_COOPERATIVE_SCHEDULER_YIELD_UNAVAILABLE',
    'globalThis.scheduler',
    'await schedulingOwner.yield()',
  ]);
  requireExcludes(cooperativeSchedulerSource, cooperativeSchedulerPath, [
    'setTimeout(',
    'requestIdleCallback(',
    'requestAnimationFrame(',
  ]);

  requireIncludes(resolverSource, resolverPath, [
    'FRICTION_MODIFIER_OPERATIONS',
    'FRICTION_MODIFIER_TARGETS',
    'resolveFrictionModifiedFilters(',
    'FRICTION_MODIFIER_INTENSITY_TARGET_INVALID',
  ]);

  requireIncludes(sessionStateSource, sessionStatePath, [
    'selectFrictionModifiersForHostname',
    'resolveActiveFrictionModifierIntents(Object.values(state.modifiersById)',
    'FRICTION_MODIFIER_HOSTNAME_REQUIRED',
  ]);

  requireIncludes(sessionRepositorySource, sessionRepositoryPath, [
    'FRICTION_MODIFIER_SESSION_STORAGE_KEY',
    'async upsertModifier(',
    'async removeModifier(',
    'getActiveModifiersForHostname(',
  ]);

  requireIncludes(trackingProtectionServiceSource, trackingProtectionServicePath, [
    'frictionModifierSessionRepository.getActiveModifiersForHostname',
    'runtimeModifiers,',
  ]);

  requireExcludes(visualManagerSource, visualManagerPath, [
    'relaxVisualFrictionInFullscreen',
    'fullscreen_visual_relaxation',
    'fullscreenchange',
    'normalizeVideoSkipGuardValue',
    'withFilterIntensityAdjustment',
  ]);

  requireExcludes(protectionRegistrySource, protectionRegistryPath, [
    'HardLockLayer',
    'hardLockLayer',
    'resolveCanonicalSocialMetricsSetting',
  ]);
  requireIncludes(protectionRegistrySource, protectionRegistryPath, [
    'return VideoManager.setVideoSkipEnabled(true, val);',
    'return VideoManager.setVideoSkipEnabled(false);',
    'return VideoManager.setShortFormBlockEnabled(true);',
    'return VideoManager.setShortFormBlockEnabled(false);',
    'projectCompiledRuntimeSocialMetricsSetting(filters)',
  ]);
  requireIncludes(socialMetricsRuntimeStateSource, socialMetricsRuntimeStatePath, [
    'resolveSocialMetricVisibilityFromSetting',
  ]);
  requireExcludes(socialMetricsRuntimeStateSource, socialMetricsRuntimeStatePath, [
    'resolveSocialMetricVisibilityState',
    'normalizeFilterSettings',
  ]);

  requireIncludes(videoSkipManagerSource, videoSkipManagerPath, [
    "from './videoSkipEventHandlers.js'",
    'createVideoSkipEventHandlers({',
    'this._createVideoEventHandlerPort(video, st)',
    'attachVideoSkipListenerLedger({',
    'detachVideoSkipListenerLedger(ledger)',
    'this._pendingListenerCleanup = new Map();',
    "'video_handlers_detach_incomplete'",
    'adapterResolution',
    'resolveVideoSkipMediaAdapter({',
    'this.storage.setErrorCallback((error, details) => {',
    "reportVideoSkipFailure('storage_persist', error, details);",
    'this._storageTeardownPromise = null;',
    "reportVideoSkipFailure('manager_remove_storage_flush', error);",
    '_recordVideoEvent(video, st, eventName, details = null) {',
    "recordProtectionFeatureEvent('videoSkipGuard', eventName, details);",
    "this._recordVideoEvent(video, st, 'revert_aborted', details);",
    "new Error('VIDEO_SKIP_CLEANUP_RETRY_REQUIRED')",
    'videoElementObserver.getLiveVideos()',
    'if (this.storage === storageOwner) {',
    "from './videoSkipControlSurfaceCatalog.js'",
    "from './VideoSkipControlSurfaceRuntime.js'",
    'this._installControlSurface();',
    "this._runCleanupStep('cleanup_control_surface'",
    'this._controlSurface?.trackVideo(video)',
    'this._controlSurface?.untrackVideo(video);',
    'includeDiagnostics: this._debug',
  ]);
  requireExcludes(videoSkipManagerSource, videoSkipManagerPath, [
    'const onTimeUpdate = () =>',
    'const onSeeking = (event) =>',
    '_setVideoCurrentTime(',
    '_resolveYouTubePlayer(',
    "id: 'native_video'",
    'videos.forEach((video) => {',
    'videoElementObserver.reconcileExistingVideos()',
    '_scheduleVideoAttachRescans(',
    'videoAttachRescanDelaysMs',
    '_triggerMirageEasterEgg(',
    'entropy_mirage_easter_egg_date',
    'setMiragePhase(',
  ]);
  const indicatorFacadePath = 'src/domains/nudge/visual/statusIndicator.js';
  const indicatorFacade = await readUtf8(indicatorFacadePath);
  requireIncludes(indicatorFacade, indicatorFacadePath, [
    'showAttemptReason(kind)', 'clearAttemptReason(kind)',
    'epoch === reasonEpoch[kind]',
  ]);
  requireExcludes(indicatorFacade, indicatorFacadePath, ['setMiragePhase(']);

  requireIncludes(videoSkipListenerLedgerSource, videoSkipListenerLedgerPath, [
    'VIDEO_SKIP_LISTENER_EVENT_NAMES',
    'VIDEO_SKIP_DIAGNOSTIC_LISTENER_EVENT_NAMES',
    'videoSkipListenerRemainingLedger',
    'detachVideoSkipListenerLedger(ledger)',
    'remainingLedger',
    'includeDiagnostics = false',
  ]);

  const videoSkipDebugFlagSection = readSection(
    frictionDebugFlagsSource,
    'export function isVideoSkipDebugEnabled() {',
  );
  requireIncludes(videoSkipDebugFlagSection, frictionDebugFlagsPath, [
    'VIDEO_SKIP_DEBUG_FLAG_STORAGE_KEY',
    'fallback: false',
  ]);
  requireExcludes(videoSkipDebugFlagSection, frictionDebugFlagsPath, [
    'isFrictionDebugEnabled()',
  ]);

  requireIncludes(videoSkipEventHandlersSource, videoSkipEventHandlersPath, [
    'VIDEO_SKIP_EVENT_HANDLER_PORT_METHOD_REQUIRED:',
    'const onTimeUpdate = () =>',
    'const onSeeking = (event) =>',
    'port.commitStablePosition(',
    'port.commitProgressSample({',
  ]);
  requireExcludes(videoSkipEventHandlersSource, videoSkipEventHandlersPath, [
    'attachVideoSkipListenerLedger(',
    'detachVideoSkipListenerLedger(',
    'VideoSkipPoolRepository',
    'resolveVideoSkipMediaAdapter',
    'signalGate',
    'requestAnimationFrame(',
    'setTimeout(',
    'manager.',
    'port.storage',
    'this._states',
    'this._videos',
    'st.lastStableTime =',
    'st.lastChargeTime =',
    'st.lastProgressLogAt =',
    'st.lastProgressBufferedEnd =',
  ]);

  requireIncludes(videoSkipMediaAdapterSource, videoSkipMediaAdapterPath, [
    'VIDEO_SKIP_MAIN_WORLD_ADAPTER_ID',
    'youtubeActuator',
    "reason: 'youtube_player_unavailable'",
    'verifyPosition: true',
    'releaseVideoSkipMediaTarget',
    'getVideoSkipMediaSourceFingerprint(video)',
    'VIDEO_SKIP_MEDIA_TARGET_STALE',
  ]);
  requireExcludes(videoSkipMediaAdapterSource, videoSkipMediaAdapterPath, [
    'return video.play?.();',
    'documentRef',
    'windowRef',
    '.seekTo(',
    '.playVideo(',
    'verifyPosition: false',
  ]);

  requireIncludes(videoSkipMainWorldActuatorSource, videoSkipMainWorldActuatorPath, [
    'executeVideoSkipYouTubeCommandInMainWorld',
    'expectedHostname',
    "player.seekTo(targetTime, true)",
    'player.playVideo()',
    "return fail('origin_mismatch')",
    "return fail('command_failed')",
    'request.mediaToken',
    "return fail('media_target_mismatch')",
  ]);
  requireExcludes(videoSkipMainWorldActuatorSource, videoSkipMainWorldActuatorPath, [
    'runtimeSendMessage',
    'chrome.scripting',
    'window.postMessage',
    'localStorage',
    'globalThis.movie_player',
  ]);

  requireIncludes(
    videoSkipMainWorldActuatorTransportSource,
    videoSkipMainWorldActuatorTransportPath,
    [
      'MESSAGE_ACTIONS.EXECUTE_VIDEO_SKIP_MAIN_WORLD_COMMAND',
      'runtimeSendMessageReliable({',
      'requireVideoSkipMainWorldActuatorResult',
      'VIDEO_SKIP_MAIN_WORLD_TRANSPORT_FAILED',
    ],
  );

  requireIncludes(
    videoSkipControlSurfaceCatalogSource,
    videoSkipControlSurfaceCatalogPath,
    [
      "resolveSiteId(hostname)",
      "youtube: defineProfile('youtube'",
      "x: defineProfile('x'",
      "instagram: defineProfile('instagram'",
      "tiktok: defineProfile('tiktok'",
      "reddit: defineProfile('reddit'",
      'NON_VOLUME_RANGE_SELECTOR',
    ],
  );
  requireExcludes(
    videoSkipControlSurfaceCatalogSource,
    videoSkipControlSurfaceCatalogPath,
    [
      'MutationObserver',
      'querySelectorAll(',
      'currentTime =',
    ],
  );

  requireIncludes(
    videoSkipControlSurfaceRuntimeSource,
    videoSkipControlSurfaceRuntimePath,
    [
      'VIDEO_SKIP_TIMELINE_LOCK_ATTRIBUTE',
      'VideoSkipControlSurfaceRuntime',
      'subscribeMediaMutations',
      'normalizeVideoMutationRoots(addedNodes)',
      'scope.contains(node)',
      'node.contains(scope)',
      'this._mediaMutationUnsub();',
      'resolveLockState',
      'trackVideo(video)',
      'untrackVideo(video)',
      'playerRootMatched',
      'attributeTargets',
      'isDeclaredNativeTimeline',
      "videos.length !== 1 || videos[0] !== video",
      'excludedTargetSelector',
      'isMediaShadowRoot',
      'shouldDeferGestureToRoot',
      '_removeRootInputs',
      ':has(video)',
      'event.preventDefault();',
      'event.stopImmediatePropagation();',
      "style.setAttribute('data-friction-owner', STYLE_OWNER);",
      "this._document.documentElement.removeAttribute(VIDEO_SKIP_TIMELINE_LOCK_ATTRIBUTE);",
    ],
  );
  requireExcludes(
    videoSkipControlSurfaceRuntimeSource,
    videoSkipControlSurfaceRuntimePath,
    [
      'MutationObserver',
      'currentTime =',
      '.seekTo(',
      '.playVideo(',
    ],
  );
  // Control projection may query the already-resolved player solely to prove
  // a unique video, or query declared timelines within an owned scope/subtree.
  // Any other query receiver (including document/body) remains forbidden.
  const unscopedControlQueries = videoSkipControlSurfaceRuntimeSource
    .replace(/(?:playerRoot|declared)\.querySelectorAll\('video'\)/g, '')
    .replace(/(?:scope|subtree)\??\.querySelectorAll\?\.\(this\.profile\.timelineTargetSelector\)/g, '');
  requireExcludes(unscopedControlQueries, videoSkipControlSurfaceRuntimePath, ['querySelectorAll']);

  requireIncludes(videoSkipPoolRepositorySource, videoSkipPoolRepositoryPath, [
    'this._persistWriteChain = Promise.resolve();',
    'this._persistWriteSequence = 0;',
    'pool.updatedAt = Math.max(Date.now(), previousUpdatedAt + 1);',
    'const mergedCooldownUntil = Math.max(currentCooldownUntil, nextCooldownUntil);',
    'storageRepairRequired: currentCooldownUntil > nextCooldownUntil',
    'const writePromise = this._persistWriteChain.then(async () => {',
    'const canonicalSnapshot = await this.poolWriter.merge(snapshot);',
    'this._onPersistError(error, {',
    'snapshot: writeContext.snapshot,',
    'if (this._extensionContextInvalidated) return null;',
    '_abandonForInvalidatedExtensionContext() {',
    'return flushPromise;',
  ]);
  requireExcludes(videoSkipPoolRepositorySource, videoSkipPoolRepositoryPath, [
    'this.poolStore.set(',
  ]);

  requireIncludes(videoSkipPoolWriteTransportSource, videoSkipPoolWriteTransportPath, [
    'MESSAGE_ACTIONS.MERGE_VIDEO_SKIP_POOL',
    'runtimeSendMessageReliable({',
    'VIDEO_SKIP_POOL_WRITE_TRANSPORT_FAILED',
  ]);

  requireIncludes(videoSkipPoolWriteCoordinatorSource, videoSkipPoolWriteCoordinatorPath, [
    'this._mergeChain = Promise.resolve();',
    'const currentSnapshot = await this.poolStore.get();',
    'mergeVideoSkipPoolSnapshots(currentSnapshot, candidateSnapshot)',
    'await this.poolStore.set(result.snapshot);',
  ]);

  requireIncludes(videoSkipPoolMessageRoutesSource, videoSkipPoolMessageRoutesPath, [
    'MESSAGE_ACTIONS.MERGE_VIDEO_SKIP_POOL',
    'MESSAGE_ACTIONS.EXECUTE_VIDEO_SKIP_MAIN_WORLD_COMMAND',
    'isTrustedExtensionTabSender(sender)',
    'resolveTrustedSenderTabId(sender)',
    'resolveSenderFrameId(sender)',
    'VIDEO_SKIP_MAIN_WORLD_TARGET_OVERRIDE_FORBIDDEN',
    'mergeVideoSkipPool(message?.snapshot)',
  ]);

  requireIncludes(backgroundMessageRouterBindingsSource, backgroundMessageRouterBindingsPath, [
    'VideoSkipPoolWriteCoordinator.getInstance()',
    'mergeVideoSkipPool: (snapshot) => videoSkipPoolWriteCoordinator.merge(snapshot)',
    'contentScriptOrchestrator.executeVideoSkipMainWorldCommand(request)',
  ]);

  requireIncludes(videoElementObserverSource, videoElementObserverPath, [
    'SUBSCRIBER_RETRY_DELAYS_MS',
    "root.querySelectorAll('*').forEach((candidate) => {",
    'seenShadowRoots.add(shadowRoot)',
    'pendingRetries: new Map()',
    'retryExhausted: new WeakSet()',
    '_scheduleSubscriberDeliveryRetry(video, subscriber, retryAttempt)',
    "'subscriber_video_added_retry_exhausted'",
  ]);
  requireExcludes(videoElementObserverSource, videoElementObserverPath, [
    "querySelectorAll('video')",
  ]);

  requireIncludes(boundaryMapSource, boundaryMapPath, [
    'ProtectionFrictionModifierRuntime',
    'Background/session friction modifiers',
    'No active release writer is currently registered',
    'Enso foreground cadence',
    '`InterventionAdmissionService.captureEnsoCadenceBoundary`',
    '`interventionAdmissionClient.getEnsoCadence`',
    'Feed boundary observation and opportunity',
    'Historical reward/feed evidence research',
    'enso-feed-horizon-runtime-config-v4',
    'VisualManager consumes already-resolved filter strength',
    'reject back to the caller warning boundary',
    'videoSkipListenerLedger.js',
    'videoSkipMediaAdapter.js',
    'videoSkipMainWorldActuator.js',
    'VideoSkipMainWorldActuatorTransport',
    'VideoSkipPoolRepository',
    '`storage_persist`',
    '`revert_aborted`',
    '`VIDEO_SKIP_CLEANUP_RETRY_REQUIRED`',
    '`broken / targeting_health_probe_contract_invalid`',
    'single bounded diagnostic rebaseline only for that exact transition',
    'single background write queue',
    'simultaneous tab teardown',
    'single consumption route',
    'exact consumer/video pair',
    'YouTube-to-native actuation fallback',
    'callers cannot',
    'sole `executeScript` owner',
  ]);
  requireExcludes(boundaryMapSource, boundaryMapPath, [
    'HardLockLayer',
    'hard-lock layer',
    '`hard_lock`',
    'Runtime dopamine-binge evidence',
    'one content-local cross-source presentation cooldown',
    'temporarily satisfies only detector and timing admission inputs',
    'begin the bounded continue pass',
  ]);
}

async function checkNoRuntimeBypass() {
  const files = await collectActiveSourceFiles();
  await Promise.all(files.map(async (relativePath) => {
    const source = await readUtf8(relativePath);
    if (
      source.includes('applyProtectionEffects')
      && !allowedApplyProtectionEffectsFiles.has(relativePath)
    ) {
      fail(`${relativePath}: must route effect application through ProtectionFrictionModifierRuntime.`);
    }
    if (
      source.includes('clearAllProtectionEffects')
      && !allowedClearAllProtectionEffectsFiles.has(relativePath)
    ) {
      fail(`${relativePath}: must route effect cleanup through ProtectionFrictionModifierRuntime.`);
    }
    if (
      source.includes('globalThis.scheduler')
      || /\bscheduler\s*\.\s*yield\s*\(/u.test(source)
    ) {
      fail(`${relativePath}: must route cooperative yielding through the platform scheduling seam.`);
    }
  }));
}

async function checkNoUndeclaredSessionModifierWriters() {
  const files = await collectSourceFiles('src');
  const forbiddenWriterCalls = [
    '.upsertModifier(',
    '.replaceModifiers(',
    '.removeModifier(',
  ];

  await Promise.all(files.map(async (relativePath) => {
    const source = await readUtf8(relativePath);
    forbiddenWriterCalls.forEach((token) => {
      if (source.includes(token)) {
        fail(`${relativePath}: session friction modifier writers are reserved; declare an active release owner in the friction runtime boundary map before calling ${token}.`);
      }
    });
  }));
}

async function checkSelectorTargetingContracts() {
  const siteIdentityCatalogPath = 'src/domains/nudge/targeting/siteIdentityCatalog.js';
  const targetProfileContractsPath =
    'src/domains/nudge/targeting/contracts/targetProfileContracts.js';
  const behaviorTargetProfilesPath = 'src/domains/nudge/behavior/behaviorTargetProfiles.js';
  const interactionTargetProfilesPath =
    'src/domains/nudge/interaction/interactionTargetProfiles.js';
  const textTargetProfilesPath = 'src/domains/nudge/text/textTargetProfiles.js';
  const mediaTargetProfilesPath = 'src/domains/nudge/visual/mediaTargetProfiles.js';
  const socialMetricTargetProfilesPath =
    'src/domains/nudge/visual/socialMetrics/adapters/socialMetricTargetProfiles.js';
  const feedSurfaceProfilesPath = 'src/domains/nudge/feed-flow/registry/feedSurfaceProfiles.js';
  const targetingHealthContractPath = 'src/domains/nudge/core/targetingHealthContract.js';
  const socialTargetingHealthProjectorPath =
    'src/domains/nudge/visual/socialMetrics/core/targetingHealthProjector.js';
  const shortFormTargetingHealthProjectorPath =
    'src/domains/nudge/runtime-debugger/core/runtimeDebuggerShortFormTargetingHealth.js';
  const siteRunAnalysisPath = 'scripts/e2e/sites/siteRunAnalysis.mjs';
  const siteRuntimeReportPath = 'scripts/e2e/sites/siteRuntimeReport.mjs';
  const selectorAttributeDependenciesPath = 'src/lib/dom/selectorAttributeDependencies.js';
  const observerHubPath = 'src/lib/dom/ObserverHub.js';
  const cooperativeMutationQueuePath =
    'src/platform/scheduling/cooperativeMutationBatchQueue.js';
  const mediaFilterPath = 'src/domains/nudge/visual/mediaFilterController.js';
  const observerControllerPath = 'src/domains/nudge/visual/observerController.js';
  const textShufflePath = 'src/domains/nudge/textShuffleManager.js';
  const textShuffleTargetResolverPath =
    'src/domains/nudge/text/textShuffleTargetResolver.js';
  const textShuffleMutationQueuePath =
    'src/domains/nudge/text/textShuffleMutationQueue.js';
  const textShuffleOwnershipLedgerPath =
    'src/domains/nudge/text/textShuffleOwnershipLedger.js';
  const visualManagerPath = 'src/domains/nudge/visual/visualManager.js';
  const styleInjectionPath = 'src/domains/nudge/visual/styleInjection.js';
  const socialMetricsManagerPath = 'src/domains/nudge/visual/socialMetricsManager.js';
  const socialCompiledScanPlanPath =
    'src/domains/nudge/visual/socialMetrics/core/compiledScanPlan.js';
  const socialRuntimeStatePath =
    'src/domains/nudge/visual/socialMetrics/core/runtimeState.js';
  const socialHostTextPatternCatalogPath =
    'src/domains/nudge/visual/socialMetrics/adapters/hostTextPatternCatalog.js';
  const socialDiagnosticsRuntimeBridgePath =
    'src/domains/nudge/visual/socialMetrics/core/diagnosticsRuntimeBridge.js';
  const socialDiagnosticsSnapshotRuntimePath =
    'src/domains/nudge/visual/socialMetrics/core/diagnosticsSnapshotRuntime.js';
  const socialDiagnosticsValueUtilsPath =
    'src/domains/nudge/visual/socialMetrics/core/diagnosticsValueUtils.js';
  const socialScanRuntimeBridgePath =
    'src/domains/nudge/visual/socialMetrics/core/scanRuntimeBridge.js';
  const socialScanControllerPath =
    'src/domains/nudge/visual/socialMetrics/core/scanController.js';
  const socialDirtyRootReducerPath =
    'src/domains/nudge/visual/socialMetrics/core/dirtyRootReducer.js';
  const socialSemanticActionMetricMatcherPath =
    'src/domains/nudge/visual/socialMetrics/core/semanticActionMetricMatcher.js';
  const socialSelectorDriftRecoveryContractPath =
    'src/domains/nudge/visual/socialMetrics/core/selectorDriftRecoveryContract.js';
  const socialDebugInstrumentationPath = 'src/domains/nudge/visual/socialMetrics/core/debugInstrumentation.js';
  const socialMutationRouterPath = 'src/domains/nudge/visual/socialMetrics/core/mutationGroupRouter.js';
  const socialObserverInterestPlanPath =
    'src/domains/nudge/visual/socialMetrics/core/observerInterestPlan.js';
  const socialPlatformSemanticAdaptersPath =
    'src/domains/nudge/visual/socialMetrics/adapters/platformSemanticAdapters.js';
  const socialRedditSemanticMutationAttributesPath =
    'src/domains/nudge/visual/socialMetrics/adapters/redditSemanticMutationAttributes.js';
  const socialRedditShadowMetricsOwnerPath =
    'src/domains/nudge/visual/socialMetrics/adapters/redditShadowMetricsOwner.js';
  const socialOwnedMutationRuntimeBridgePath =
    'src/domains/nudge/visual/socialMetrics/core/ownedMutationRuntimeBridge.js';
  const socialOwnedMutationLedgerPath = 'src/domains/nudge/visual/socialMetrics/core/ownedMutationLedger.js';
  const socialDocumentNodeIdentityPath = 'src/domains/nudge/visual/socialMetrics/core/documentNodeIdentity.js';
  const youtubeAdapterPath = 'src/domains/nudge/visual/socialMetrics/adapters/youtubeAdapter.js';
  const xAdapterPath = 'src/domains/nudge/visual/socialMetrics/adapters/xAdapter.js';
  const instagramAdapterPath =
    'src/domains/nudge/visual/socialMetrics/adapters/instagramAdapter.js';
  const youtubeSelectorDriftScenariosPath =
    'tests/fixtures/youtubeSelectorDriftScenarios.js';
  const youtubeSelectorDriftMetamorphicTestPath =
    'tests/youtubeSelectorDriftMetamorphic.test.js';
  const youtubeSelectorDriftIndependentCorpusTestPath =
    'tests/youtubeSelectorDriftIndependentCorpus.audit.test.js';
  const socialSelectorDriftExpansionTestPath =
    'tests/socialMetricsSelectorDriftExpansion.test.js';
  const socialSelectorDriftIndependentCorpusTestPath =
    'tests/socialSelectorDriftIndependentCorpus.audit.test.js';
  const socialSelectorDriftCorpusPath =
    'reports/social-selector-drift-phase4/2026-08-14/corpus-candidates.json';
  const shortFormBlockManagerPath = 'src/domains/nudge/short-form/ShortFormBlockManager.js';
  const shortFormTargetResolverPath =
    'src/domains/nudge/short-form/shortFormTargetResolver.js';
  const youtubeShortFormResolverPath =
    'src/domains/nudge/short-form/platforms/youtubeShortFormResolver.js';
  const tiktokShortFormResolverPath =
    'src/domains/nudge/short-form/platforms/tiktokShortFormResolver.js';
  const shortFormTargetOutcomeDevPath =
    'src/domains/nudge/short-form/shortFormTargetOutcome.dev.js';
  const shortFormTargetOutcomePublicPath =
    'src/domains/nudge/short-form/shortFormTargetOutcome.public.js';
  const runtimeDiscoveryLedgerDevPath =
    'src/domains/nudge/runtime-debugger/discovery/runtimeDiscoveryLedger.dev.js';
  const runtimeDiscoveryLedgerPublicPath =
    'src/domains/nudge/runtime-debugger/discovery/runtimeDiscoveryLedger.public.js';
  const runtimeContentionLedgerDevPath =
    'src/domains/nudge/runtime-debugger/contention/runtimeContentionLedger.dev.js';
  const runtimeContentionLedgerPublicPath =
    'src/domains/nudge/runtime-debugger/contention/runtimeContentionLedger.public.js';
  const viteConfigPath = 'vite.config.js';
  const runtimeDebuggerPath = 'src/domains/nudge/runtime-debugger/RuntimeDebuggerRuntime.js';
  const runtimeDebuggerShortFormOraclePath = 'src/domains/nudge/runtime-debugger/RuntimeDebuggerShortFormOracle.js';
  const runtimeDebuggerSessionPath = 'src/domains/nudge/runtime-debugger/core/runtimeDebuggerSession.js';
  const runtimeDebuggerAnalysisPath = 'src/domains/nudge/runtime-debugger/core/runtimeDebuggerAnalysis.js';
  const runtimeDebuggerReportPath = 'src/domains/nudge/runtime-debugger/core/runtimeDebuggerReport.js';
  const runtimeDebuggerSanitizerPath = 'src/domains/nudge/runtime-debugger/core/runtimeDebuggerSanitizer.js';
  const runtimeDebuggerProbeCatalogPath = 'src/domains/nudge/runtime-debugger/RuntimeDebuggerProbeCatalog.js';
  const runtimeDebuggerOverlayPath = 'src/domains/nudge/runtime-debugger/RuntimeDebuggerOverlay.js';
  const runtimeDebuggerOverlayStylePath = 'src/domains/nudge/runtime-debugger/RuntimeDebuggerOverlayStyle.js';
  const runtimeDebuggerMeasurementGuidePath = 'src/domains/nudge/runtime-debugger/RuntimeDebuggerMeasurementGuide.js';
  const protectionControllerPath = 'src/domains/protection/content/ProtectionController.js';
  const domTargetingArchitecturePath =
    'docs/architecture/runtime/dom-targeting-runtime-architecture.md';
  const socialMetricsSeamMapPath =
    'docs/architecture/repository/social-metrics-seam-map.md';
  const visualTargetQaChecklistPath =
    'docs/operations/qa/friction-visual-target-qa-checklist.md';
  const realSiteE2ePath = 'docs/operations/qa/real-site-e2e.md';
  const [
    siteIdentityCatalog,
    observerHub,
    cooperativeMutationQueue,
    mediaFilter,
    observerController,
    textShuffle,
    textShuffleTargetResolver,
    textShuffleMutationQueue,
    textShuffleOwnershipLedger,
    visualManager,
    styleInjection,
    socialMetricsManager,
    socialDiagnosticsRuntimeBridge,
    socialDiagnosticsSnapshotRuntime,
    socialDiagnosticsValueUtils,
    socialScanRuntimeBridge,
    socialScanController,
    socialDirtyRootReducer,
    socialSemanticActionMetricMatcher,
    socialDebugInstrumentation,
    socialOwnedMutationRuntimeBridge,
    youtubeAdapter,
    xAdapter,
    instagramAdapter,
    youtubeSelectorDriftScenarios,
    youtubeSelectorDriftMetamorphicTest,
    youtubeSelectorDriftIndependentCorpusTest,
    socialSelectorDriftExpansionTest,
    socialSelectorDriftIndependentCorpusTest,
    socialSelectorDriftCorpus,
    shortFormBlockManager,
    shortFormTargetResolver,
    youtubeShortFormResolver,
    tiktokShortFormResolver,
    shortFormTargetOutcomeDev,
    shortFormTargetOutcomePublic,
    runtimeDiscoveryLedgerDev,
    runtimeDiscoveryLedgerPublic,
    runtimeContentionLedgerDev,
    runtimeContentionLedgerPublic,
    viteConfig,
    runtimeDebugger,
    runtimeDebuggerShortFormOracle,
    runtimeDebuggerSession,
    runtimeDebuggerAnalysis,
    runtimeDebuggerReport,
    runtimeDebuggerSanitizer,
    runtimeDebuggerProbeCatalog,
    runtimeDebuggerOverlay,
    runtimeDebuggerOverlayStyle,
    runtimeDebuggerMeasurementGuide,
    protectionController,
  ] = await Promise.all([
    readUtf8(siteIdentityCatalogPath),
    readUtf8(observerHubPath),
    readUtf8(cooperativeMutationQueuePath),
    readUtf8(mediaFilterPath),
    readUtf8(observerControllerPath),
    readUtf8(textShufflePath),
    readUtf8(textShuffleTargetResolverPath),
    readUtf8(textShuffleMutationQueuePath),
    readUtf8(textShuffleOwnershipLedgerPath),
    readUtf8(visualManagerPath),
    readUtf8(styleInjectionPath),
    readUtf8(socialMetricsManagerPath),
    readUtf8(socialDiagnosticsRuntimeBridgePath),
    readUtf8(socialDiagnosticsSnapshotRuntimePath),
    readUtf8(socialDiagnosticsValueUtilsPath),
    readUtf8(socialScanRuntimeBridgePath),
    readUtf8(socialScanControllerPath),
    readUtf8(socialDirtyRootReducerPath),
    readUtf8(socialSemanticActionMetricMatcherPath),
    readUtf8(socialDebugInstrumentationPath),
    readUtf8(socialOwnedMutationRuntimeBridgePath),
    readUtf8(youtubeAdapterPath),
    readUtf8(xAdapterPath),
    readUtf8(instagramAdapterPath),
    readUtf8(youtubeSelectorDriftScenariosPath),
    readUtf8(youtubeSelectorDriftMetamorphicTestPath),
    readUtf8(youtubeSelectorDriftIndependentCorpusTestPath),
    readUtf8(socialSelectorDriftExpansionTestPath),
    readUtf8(socialSelectorDriftIndependentCorpusTestPath),
    readUtf8(socialSelectorDriftCorpusPath),
    readUtf8(shortFormBlockManagerPath),
    readUtf8(shortFormTargetResolverPath),
    readUtf8(youtubeShortFormResolverPath),
    readUtf8(tiktokShortFormResolverPath),
    readUtf8(shortFormTargetOutcomeDevPath),
    readUtf8(shortFormTargetOutcomePublicPath),
    readUtf8(runtimeDiscoveryLedgerDevPath),
    readUtf8(runtimeDiscoveryLedgerPublicPath),
    readUtf8(runtimeContentionLedgerDevPath),
    readUtf8(runtimeContentionLedgerPublicPath),
    readUtf8(viteConfigPath),
    readUtf8(runtimeDebuggerPath),
    readUtf8(runtimeDebuggerShortFormOraclePath),
    readUtf8(runtimeDebuggerSessionPath),
    readUtf8(runtimeDebuggerAnalysisPath),
    readUtf8(runtimeDebuggerReportPath),
    readUtf8(runtimeDebuggerSanitizerPath),
    readUtf8(runtimeDebuggerProbeCatalogPath),
    readUtf8(runtimeDebuggerOverlayPath),
    readUtf8(runtimeDebuggerOverlayStylePath),
    readUtf8(runtimeDebuggerMeasurementGuidePath),
    readUtf8(protectionControllerPath),
  ]);
  const [
    socialCompiledScanPlan,
    socialRuntimeState,
    socialHostTextPatternCatalog,
    socialMutationRouter,
    socialOwnedMutationLedger,
    socialDocumentNodeIdentity,
    socialSelectorDriftRecoveryContract,
    targetProfileContracts,
    behaviorTargetProfiles,
    interactionTargetProfiles,
    textTargetProfiles,
    mediaTargetProfiles,
    socialMetricTargetProfiles,
    feedSurfaceProfiles,
    targetingHealthContract,
    socialTargetingHealthProjector,
    shortFormTargetingHealthProjector,
    siteRunAnalysis,
    siteRuntimeReport,
    selectorAttributeDependencies,
    socialObserverInterestPlan,
    socialPlatformSemanticAdapters,
    socialRedditSemanticMutationAttributes,
    socialRedditShadowMetricsOwner,
  ] = await Promise.all([
    readUtf8(socialCompiledScanPlanPath),
    readUtf8(socialRuntimeStatePath),
    readUtf8(socialHostTextPatternCatalogPath),
    readUtf8(socialMutationRouterPath),
    readUtf8(socialOwnedMutationLedgerPath),
    readUtf8(socialDocumentNodeIdentityPath),
    readUtf8(socialSelectorDriftRecoveryContractPath),
    readUtf8(targetProfileContractsPath),
    readUtf8(behaviorTargetProfilesPath),
    readUtf8(interactionTargetProfilesPath),
    readUtf8(textTargetProfilesPath),
    readUtf8(mediaTargetProfilesPath),
    readUtf8(socialMetricTargetProfilesPath),
    readUtf8(feedSurfaceProfilesPath),
    readUtf8(targetingHealthContractPath),
    readUtf8(socialTargetingHealthProjectorPath),
    readUtf8(shortFormTargetingHealthProjectorPath),
    readUtf8(siteRunAnalysisPath),
    readUtf8(siteRuntimeReportPath),
    readUtf8(selectorAttributeDependenciesPath),
    readUtf8(socialObserverInterestPlanPath),
    readUtf8(socialPlatformSemanticAdaptersPath),
    readUtf8(socialRedditSemanticMutationAttributesPath),
    readUtf8(socialRedditShadowMetricsOwnerPath),
  ]);
  const [
    domTargetingArchitecture,
    socialMetricsSeamMap,
    visualTargetQaChecklist,
    realSiteE2e,
  ] = await Promise.all([
    readUtf8(domTargetingArchitecturePath),
    readUtf8(socialMetricsSeamMapPath),
    readUtf8(visualTargetQaChecklistPath),
    readUtf8(realSiteE2ePath),
  ]);
  await Promise.all([
    'src/domains/nudge/core/targets.js',
    'src/domains/nudge/textTargetRegistry.js',
    'src/domains/nudge/visual/socialSurfaceController.js',
    'src/domains/settings/config/sites.js',
    'src/domains/settings/config/siteSelectors/profileContract.js',
    'src/domains/settings/config/siteSelectors/profileCompiler.js',
  ].map(forbidFile));
  const nudgeRuntimeFiles = await collectSourceFiles('src/domains/nudge');
  await Promise.all(nudgeRuntimeFiles.map(async (relativePath) => {
    const source = await readUtf8(relativePath);
    if (source.includes('feedItemTargets')) {
      fail(`${relativePath}: ambiguous cross-owner feedItemTargets is forbidden; use the owning target vocabulary.`);
    }
    if (
      source.includes('settings/config/sites.js')
      || source.includes('getSiteSelectors')
      || source.includes('getSiteSelectorProfile')
    ) {
      fail(`${relativePath}: retired shared site-selector ownership must not return to nudge runtime.`);
    }
    ['textVisualTargets', 'visualContainerHints'].forEach((field) => {
      if (source.includes(field)) {
        fail(`${relativePath}: retired target field ${field} must not return to nudge runtime.`);
      }
    });
  }));

  requireIncludes(siteIdentityCatalog, siteIdentityCatalogPath, [
    'defineSiteIdentityCatalog(catalog)',
    'normalizeSiteHostname(hostname',
    'resolveSiteId(hostname',
    'hostname_owner_collision',
    'SITE_IDENTITY_HOSTNAME_INVALID:',
    'hostname_shape_required',
    'redundant_hostname_alias',
    'export const SUPPORTED_SITE_IDS',
  ]);
  requireExcludes(siteIdentityCatalog, siteIdentityCatalogPath, [
    'querySelector',
    'metricSelectors',
    'visualMediaCandidates',
    'feedObservationItemTargets',
  ]);
  requireIncludes(targetProfileContracts, targetProfileContractsPath, [
    'TARGET_VALUE_KINDS',
    'TARGET_MERGE_POLICIES',
    'unknown_schema_option',
    'unknown_definition_option',
    'schema_coverage_invalid',
    'canonical_owner_id_required',
    'canonical_target_field_key_required',
    'TARGET_PROFILE_VALUE_INVALID:',
    'empty_map_override_forbidden',
    'empty_selector_extension_forbidden',
    'export function cloneAndFreezeTargetValue(value)',
    'export function defineTargetProfileFields(',
    'export function createTargetProfileResolver(',
  ]);
  requireIncludes(behaviorTargetProfiles, behaviorTargetProfilesPath, [
    'feedObservationItemTargets',
    "ownerId: 'behavior'",
    'createTargetProfileResolver({',
  ]);
  requireIncludes(interactionTargetProfiles, interactionTargetProfilesPath, [
    'rewardContentItemTargets',
    'rewardContainerTargets',
    'rewardMediaTargets',
    'continuousFeedContextTargets',
    'inputDelayBypassTargets',
    'validateInteractionTargets(targets)',
    "ownerId: 'interaction'",
  ]);
  requireIncludes(textTargetProfiles, textTargetProfilesPath, [
    'TEXT_TARGET_PROFILE_SCHEMA',
    'validateTextTargets(targets)',
    "ownerId: 'text'",
  ]);
  requireIncludes(mediaTargetProfiles, mediaTargetProfilesPath, [
    'MEDIA_TARGET_PROFILE_SCHEMA',
    'validateMediaTargets(targets)',
    "ownerId: 'media'",
  ]);
  requireIncludes(socialMetricTargetProfiles, socialMetricTargetProfilesPath, [
    'SOCIAL_METRIC_FILTER_KEYS',
    'metricSelectors',
    'scanRoots',
    'validateSocialMetricTargets',
    "ownerId: 'social_metrics'",
  ]);
  requireIncludes(feedSurfaceProfiles, feedSurfaceProfilesPath, [
    "from '../../targeting/siteIdentityCatalog.js'",
    'SUPPORTED_SITE_IDS',
    'function createProfile(definition)',
    'export function requireFeedSurfacePathname(pathname)',
    'FEED_SURFACE_SITE_COVERAGE_INVALID',
    'getFeedDiscoveryItemSelector(hostname)',
  ]);
  [
    behaviorTargetProfiles,
    interactionTargetProfiles,
    textTargetProfiles,
    mediaTargetProfiles,
    socialMetricTargetProfiles,
    feedSurfaceProfiles,
  ].forEach((source) => requireExcludes(source, 'owner target profile', [
    'feedItemTargets',
    'getSiteSelectors',
    'getSiteSelectorProfile',
  ]));
  requireIncludes(targetingHealthContract, targetingHealthContractPath, [
    'TARGETING_HEALTH_CONTRACT_VERSION',
    'TARGETING_HEALTH_VOCABULARY',
    'Object.getPrototypeOf(value)',
    'Reflect.ownKeys(value)',
    'Object.getOwnPropertyDescriptor(value, key)',
    'PLAIN_OBJECT_REQUIRED',
    'SYMBOL_FIELD_INVALID',
    'DATA_PROPERTY_REQUIRED',
    'NOT_ENUMERABLE',
    'validateTargetingHealthSnapshot(snapshot)',
    'createTargetingHealthSnapshot(fields)',
    'createTargetingHealthProjector(config)',
    'PENDING_EFFECT_EVIDENCE_INVALID',
    'CLEAR_DRIFT_EVIDENCE_INVALID',
    'CLEAR_DRIFT_INDEPENDENT_OPPORTUNITY_REQUIRED',
    'SUSPECTED_DRIFT_EVIDENCE_INVALID',
  ]);
  requireExcludes(targetingHealthContract, targetingHealthContractPath, [
    'querySelector',
    'MutationObserver',
    'localStorage',
    'sessionStorage',
    'document.',
    'window.',
  ]);
  requireIncludes(socialTargetingHealthProjector, socialTargetingHealthProjectorPath, [
    "SOCIAL_METRICS_TARGETING_HEALTH_OWNER_ID = 'social_metrics'",
    'opportunitySource: TARGETING_HEALTH_OPPORTUNITY_SOURCE.OWNER',
    'projectSocialMetricsTargetingHealth({',
    "const TERMINAL_DISPOSITIONS = new Set(['unknown', 'apply', 'clear', 'mixed'])",
    'terminalDispositionTargetCount',
    'terminalApplyTargetCount + terminalClearTargetCount + terminalUnknownTargetCount',
    "terminalDisposition === 'apply' && homogeneousApply",
    "terminalDisposition === 'clear' && homogeneousClear",
    "terminalDisposition === 'mixed' && classifiedMixed",
    'terminalUnclassifiedReconciliationWriteCount > 0',
    'TARGETING_HEALTH_DRIFT.NOT_EVALUABLE',
    'observed_target_effect_applied_coverage_unknown',
    'observed_target_effect_restored_coverage_unknown',
  ]);
  requireExcludes(socialTargetingHealthProjector, socialTargetingHealthProjectorPath, [
    'querySelector',
    'MutationObserver',
    'localStorage',
    'document.',
    'lastOperationApplyActualWrites',
    'lastOperationCleanupActualWrites',
    'lastDecisionKind',
    'lastDecisionWriteOutcome',
  ]);
  requireIncludes(shortFormTargetingHealthProjector, shortFormTargetingHealthProjectorPath, [
    "ownerId: 'short_form'",
    'opportunitySource: TARGETING_HEALTH_OPPORTUNITY_SOURCE.INDEPENDENT',
    'projectRuntimeDebuggerShortFormTargetingHealth({',
    'TARGETING_HEALTH_DRIFT.NOT_EVALUABLE',
  ]);
  requireExcludes(shortFormTargetingHealthProjector, shortFormTargetingHealthProjectorPath, [
    'querySelector',
    'MutationObserver',
    'localStorage',
    'document.',
  ]);
  requireIncludes(siteRunAnalysis, siteRunAnalysisPath, [
    "from '../../../src/domains/nudge/core/targetingHealthContract.js'",
    'new Set(Object.values(TARGETING_HEALTH_VALIDITY))',
    'validateTargetingHealthSnapshot(snapshot)',
    'analyzeCanonicalProbeMeasurement(probe)',
    'Number.isSafeInteger(probe.operationCount)',
    "reason = 'probe_operation_count_invalid'",
    "reason = 'targeting_health_contract_invalid'",
    "reason = 'targeting_health_probe_validity_mismatch'",
    "reason = 'targeting_health_probe_operation_mismatch'",
    'needsLazyBaselineReset(payload = null)',
    'LAZY_SOCIAL_BASELINE_OPERATION_ERROR',
    'matchingProbes.length !== 1',
    'validateTargetingHealthSnapshot(details.targetingHealth)',
    'SHORT_FORM_COMPLETENESS_SITE_ID_OPTIONAL_STATES',
    '!SHORT_FORM_COMPLETENESS_SITE_ID_OPTIONAL_STATES.has(snapshot.state)',
  ]);
  requireIncludes(selectorAttributeDependencies, selectorAttributeDependenciesPath, [
    'extractSelectorAttributeDependencies',
    'addImplicitIdentityDependencies',
    'compileSelectorAttributeDependencyPlan',
    'DEFAULT_INITIAL_SCAN_ONLY_SELECTOR_ATTRIBUTES',
    'ATTRIBUTE_NAME_PATTERN',
    'normalizeAttributeList',
    'validateDenseStringArrayShape',
    'Reflect.ownKeys(values)',
    'sparse_array_forbidden',
    'symbol_property_forbidden',
    'enumerable_data_property_required',
    'value.toLowerCase()',
    'requiredObservedAttributes',
    'initialScanOnlyAttributes',
  ]);
  requireIncludes(observerHub, observerHubPath, [
    "from '@runtime-contention-ledger'",
    "ownerId: 'observerHub'",
    'subscribers: subscriberSpans',
    '_matchesSubscriberMutation',
    '_buildMutationPayload',
    'FLUSH_WATCHDOG_MS',
    '_cancelPendingFlush()',
    'options.subtree',
    'subscriberCounters',
    'flushDurationTotalMs',
    'getObservationContext()',
    'this.observationEpoch += 1',
    'this.deliverySequence += 1',
    'pendingMutationCount: this.pendingMutations.length',
  ]);
  requireIncludes(mediaFilter, mediaFilterPath, [
    'resolveMediaTargetingPlan',
    'observerAttributes: resolveMediaObserverAttributes(config)',
    'filterRelevantMediaMutationRoots',
    'applyMediaFiltersToRoots',
    'createCompositeMediaFilterAnimation',
    'updateCompositeMediaFilterAnimation',
    'additiveCompositeSupportDocuments',
    "composite: 'add'",
    "fill: 'both'",
    "'compositeEffectCancelMs'",
    '() => cached.animation.cancel(),',
    'existing.active === true',
    'animation.oncancel = () => {',
    'const nextTargets = new Set();',
    'const restorePlans = [];',
    'const applyPlans = [];',
    'restorePlans.forEach((plan) => commitMediaFilterRestore(manager, plan));',
    'applyPlans.forEach((plan) => commitMediaFilterApply(manager, plan));',
  ]);
  requireExcludes(mediaFilter, mediaFilterPath, [
    "el.style.setProperty('filter'",
    "el.style.removeProperty('filter'",
    'window.getComputedStyle(el)',
    'rebaseMediaFilterCacheForExternalWrite',
    'animation?.playState',
  ]);
  requireOrdered(mediaFilter, mediaFilterPath, [
    'export function applyMediaFiltersToRoots(',
    'const nextTargets = new Set();',
    'const restorePlans = [];',
    'const plannedRestores = new Set();',
    'if (!root || nextTargets.has(el) || plannedRestores.has(el)) continue;',
    'plannedRestores.add(el);',
    'const applyPlans = [];',
    'restorePlans.forEach((plan) => commitMediaFilterRestore(manager, plan));',
    'applyPlans.forEach((plan) => commitMediaFilterApply(manager, plan));',
  ], 'media target membership and restore deduplication must settle before owned composite effects change');
  requireOrdered(mediaFilter, mediaFilterPath, [
    'export async function applyMediaFiltersToRootsCooperatively(',
    'const nextTargets = new Set();',
    'const restorePlans = [];',
    'const plannedRestores = new Set();',
    'if (!root || nextTargets.has(el) || plannedRestores.has(el)) return;',
    'plannedRestores.add(el);',
    'restorePlans.push(el);',
    'const applyPlans = [];',
    'const restoreCompleted = await runCooperativeMediaSequence(restorePlans, reconcileTarget, schedulingState);',
    'const applyCompleted = await runCooperativeMediaSequence(applyPlans, reconcileTarget, schedulingState);',
  ], 'cooperative media reconciliation must preserve next-target membership, restore deduplication, and restore-before-apply order');
  requireIncludes(cooperativeMutationQueue, cooperativeMutationQueuePath, [
    "from './mainThreadCooperativeScheduler.js'",
    'const MUTATION_BATCH_KEYS = Object.freeze([',
    'let pending = createPendingBatch()',
    'await yieldContinuation();',
    'await consumeBatch(batch, {',
    'generation === expectedGeneration',
    'function cancel() {',
    'clearPending();',
  ]);
  requireExcludes(cooperativeMutationQueue, cooperativeMutationQueuePath, [
    'setTimeout(',
    'requestIdleCallback(',
    'requestAnimationFrame(',
    'MutationObserver',
    'querySelector',
  ]);
  const textShufflePresentationPath = 'src/domains/nudge/text/textShufflePresentation.js';
  const textShufflePresentation = await readUtf8(textShufflePresentationPath);
  requireIncludes(textShufflePresentation, textShufflePresentationPath, [
    'createTextShufflePresentation', 'childNodes.length === 1',
    'content: attr(', '/ ""', 'function release(node)', 'function dispose()',
  ]);
  requireExcludes(textShufflePresentation, textShufflePresentationPath, [
    'innerHTML',
    'MutationObserver', 'setInterval', '__react',
  ]);
  if (/\bnode\.(?:nodeValue|textContent)\s*=(?!=|>)/.test(textShufflePresentation)) {
    failures.push(`${textShufflePresentationPath}: presentation must not write native source text`);
  }
  requireIncludes(textShuffle, textShufflePath, [
    "from '@runtime-contention-ledger'",
    "from './text/textShuffleTargetResolver.js'",
    "from './text/textShuffleMutationQueue.js'",
    "from './text/textShuffleOwnershipLedger.js'",
    "from '../../platform/scheduling/cooperativeMutationBatchQueue.js'",
    'export function createTextShuffleManager({',
    'const mutationIngress = createMutationIngress({',
    'queue.releasePendingWorkInSubtree(nextNode);',
    'ledger.restoreTrackedNode(node);',
    'resolver.resolveTrackedTextNodeOwnership(node)',
    'ledger.iterateMutationRevalidation({',
    'ledger.rebaseTrackedOwnership(node, ownership);',
    'resolver.resolveObserverAttributeFilter()',
    'async function revalidateTrackedMutationRoots(roots, schedulingState)',
    'mutationIngress.enqueue({',
    'mutationIngress.cancel();',
    'const TextShuffleManager = createTextShuffleManager();',
  ]);
  const textRevalidationSection = readSection(
    textShuffle,
    'async function revalidateTrackedMutationRoots(roots, schedulingState)',
    'async function processObserverMutationBatch({',
  );
  requireOrdered(textRevalidationSection, textShufflePath, [
    'const revalidationSteps = ledger.iterateMutationRevalidation({',
    'for (const { node } of revalidationSteps) {',
    'requestSliceContinuation(',
    'resolver.resolveTrackedTextNodeOwnership(node)',
    'for (const rootNode of [...attributeRoots, ...childListRoots]) {',
    'enqueueNode(rootNode);',
  ], 'Text mutation batches must dedupe ownership checks before enqueueing affected roots');
  const removedTextMutationSection = readSection(
    textShuffle,
    'for (const nextNode of collapseTextShuffleMutationNodes(removedNodes)) {',
    'const revalidationCompleted = await revalidateTrackedMutationRoots(',
  );
  requireOrdered(removedTextMutationSection, textShufflePath, [
    'queue.releasePendingWorkInSubtree(nextNode);',
    'for (const node of trackedNodes) {',
    'ledger.restoreTrackedNode(node);',
  ], 'removed Text subtrees must release queued cursors before restoring owned text');
  requireExcludes(textShuffle, textShufflePath, [
    'new WeakMap()',
    'new Set()',
    'new Map()',
    'requestIdleCallback',
    'getTextTargets',
    'node.nodeValue = shuffled',
  ]);
  requireIncludes(textShuffleTargetResolver, textShuffleTargetResolverPath, [
    'export function collapseTextShuffleMutationNodes(nodes = [])',
    'function collapseTextShuffleDependencyNodes(nodes = [])',
    'const candidateSet = new Set();',
    'const ancestorCandidateCache = new WeakMap();',
    'current = current.parentNode;',
    'export function createTextShuffleTargetResolver({',
    "|| selector.length === 0",
    '|| selector !== selector.trim()',
    'function collectTopLevelTextRoots(',
    'function resolveApplyRoots(',
    'return result.roots;',
    'function resolveMutationEnqueueTarget(',
    'function qualifyTextNode(',
    "'shuffle_text_target_closest'",
    'function isTrackedTextNodeEligible(',
    'function resolveTrackedTextNodeOwnership(',
    'targetOwner: target.element',
    'const attributeMutations = mutations',
    '...(attributeMutations.length === 0 ? attributeTargets : [])',
    "filter((mutation) => mutation?.type === 'childList')",
    'node.getRootNode?.() !== rootDocument',
    'function resolveObserverAttributeFilter(',
  ]);
  requireExcludes(textShuffleTargetResolver, textShuffleTargetResolverPath, [
    'textShuffleManager',
    'textShuffleMutationQueue',
    'textShuffleOwnershipLedger',
    'node.nodeValue =',
    'setAttribute(',
    'removeAttribute(',
    'observerHub',
  ]);
  requireIncludes(textShuffleMutationQueue, textShuffleMutationQueuePath, [
    'TEXT_SHUFFLE_APPLY_CHUNK_SIZE = 150',
    'TEXT_SHUFFLE_APPLY_VISIT_CHUNK_SIZE = 600',
    'TEXT_SHUFFLE_PENDING_SUBTREE_CHUNK_SIZE = 6',
    'TEXT_SHUFFLE_MUTATION_TEXT_CHUNK_SIZE = 100',
    'TEXT_SHUFFLE_MUTATION_SUCCESS_CHUNK_SIZE = 150',
    'TEXT_SHUFFLE_FLUSH_DEBOUNCE_MS = 120',
    'TEXT_SHUFFLE_IDLE_TIMEOUT_MS = 200',
    'TEXT_SHUFFLE_WORK_SLICE_BUDGET_MS = 3',
    'export function createTextShuffleMutationQueue({',
    'const pendingSubtreeTasks = new Map();',
    'const pendingSubtreeReplayRoots = new Set();',
    'pendingSubtreeReplayRoots.add(pendingRoot);',
    'complete: !pendingSubtreeReplayRoots.has(rootNode)',
    'function releasePendingWorkInSubtree(rootNode)',
  ]);
  requireExcludes(textShuffleMutationQueue, textShuffleMutationQueuePath, [
    'textShuffleManager',
    'textShuffleTargetResolver',
    'textShuffleOwnershipLedger',
    'getTextTargets',
    'node.nodeValue =',
    'setAttribute(',
    'removeAttribute(',
  ]);
  requireIncludes(textShuffleOwnershipLedger, textShuffleOwnershipLedgerPath, [
    'export function createTextShuffleOwnershipLedger({',
    'const trackedNodes = new Set();',
    'let originalTextByNode = new WeakMap();',
    'let shuffledTextByNode = new WeakMap();',
    'let trackedParentByNode = new WeakMap();',
    'let trackedTargetOwnerByNode = new WeakMap();',
    'let trackedNodesByParent = new WeakMap();',
    'let trackedNodesByTargetOwner = new WeakMap();',
    'node.nodeValue === shuffled',
    'function rebaseTrackedParent(node, parent)',
    'function rebaseTrackedOwnership(node, { parent, targetOwner } = {})',
    'function* iterateMutationRevalidation({',
    'const seenNodes = new Set();',
    'const visitedAncestryNodes = new WeakSet();',
    'const visitedTrackedParents = new WeakSet();',
    "rootNode.querySelectorAll?.('*')",
    'function restoreTrackedSubtree(rootNode, nodes = null)',
    'function shouldProcessTrackedNode(node)',
  ]);
  requireExcludes(textShuffleOwnershipLedger, textShuffleOwnershipLedgerPath, [
    'textShuffleManager',
    'textShuffleTargetResolver',
    'textShuffleMutationQueue',
    'getTextTargets',
    'observerHub',
  ]);
  const textRevalidationCursorSection = readSection(
    textShuffleOwnershipLedger,
    'function* iterateMutationRevalidation({',
    'function restoreTrackedSubtree(rootNode, nodes = null)',
  );
  requireOrdered(textRevalidationCursorSection, textShuffleOwnershipLedgerPath, [
    'const seenNodes = new Set();',
    'function* visitMutationTargetOwners(rootNode)',
    'function* visitTrackedSubtree(rootNode)',
    'createNodeIterator(rootNode, NodeFilter.SHOW_ELEMENT)',
    'yield* visitIndexedNodes(trackedNodesByParent.get(parent))',
    'for (const rootNode of attributeRoots)',
    'for (const rootNode of childListRoots)',
  ], 'Text revalidation discovery must be resumable and dedupe one ObserverHub batch inside the ledger owner');
  requireExcludes(textRevalidationCursorSection, textShuffleOwnershipLedgerPath, [
    'querySelectorAll',
    'TEXT_SHUFFLE_MARKER_ATTRIBUTE',
    'Array.from(trackedNodes)',
    'for (const node of trackedNodes)',
  ], 'Text revalidation must not depend on public markers or eagerly scan the global tracked set');
  requireIncludes(observerController, observerControllerPath, [
    "from '../../../platform/scheduling/cooperativeMutationBatchQueue.js'",
    'createMediaFilterMutationQueue(manager)',
    'collectShortFormContextPromotionRoots',
    'managedTargetStyleRootsSkipped',
    "attributeNames.has('style')",
    '_filterRelevantMediaMutationRoots',
    '_applyMediaFiltersToRootsCooperatively',
    'manager._mediaFilterMutationQueue?.enqueue(payload, {',
  ]);
  requireExcludes(observerController, observerControllerPath, [
    'manager._applyMediaFiltersToRoots(relevantRoots',
  ]);
  requireExcludes(visualManager, visualManagerPath, [
    'data-friction-visual-target',
    'data-friction-visual-video',
    '_targetObserverUnsub',
    '_videoTargetObserverUnsub',
  ]);
  requireIncludes(visualManager, visualManagerPath, [
    'UNKNOWN_DIMENSION_MEDIA_LOAD_GRACE_MS',
    "from '@runtime-contention-ledger'",
    "ownerId: 'visualMedia'",
  ]);
  requireExcludes(styleInjection, styleInjectionPath, [
    'will-change: filter, opacity, text-shadow, transform',
    'data-friction-social-surface-target',
  ]);
  requireIncludes(socialMetricsManager, socialMetricsManagerPath, [
    "from './socialMetrics/core/diagnosticsRuntimeBridge.js'",
    'createSocialMetricsDiagnosticsRuntime,',
    "from './socialMetrics/core/diagnosticsValueUtils.js'",
    "from './socialMetrics/core/scanRuntimeBridge.js'",
    'createSocialMetricsScanRuntime,',
    "from './socialMetrics/core/ownedMutationRuntimeBridge.js'",
    'createSocialMetricsOwnedMutationRuntime,',
    'export function createSocialMetricsRuntime({',
    'const lifecycleState = {',
    'const root = Object.freeze({',
    'const diagnosticsOwnerPort = Object.freeze({',
    'const diagnosticsScanPort = Object.freeze({',
    'const diagnosticsOwnedMutationPort = Object.freeze({',
    'diagnosticsRuntime = createSocialMetricsDiagnosticsRuntime({',
    'const ownedMutationOwnerPort = Object.freeze({',
    'const ownedMutationDiagnosticsPort = Object.freeze({',
    'ownedMutationRuntime = createSocialMetricsOwnedMutationRuntime({',
    'const scanOwnerPort = Object.freeze({',
    'const scanDiagnosticsPort = Object.freeze({',
    'const scanOwnedMutationPort = Object.freeze({',
    'scanRuntime = createSocialMetricsScanRuntime({',
    'const SocialMetricsManager = createSocialMetricsRuntime();',
    'youtube_root_relevance_selector_failed',
    'routeSocialMetricMutationGroups',
    'diagnosticsRuntime._recordMutationRoutingDebug(routes, dispositions, roots)',
    'ownedMutationRuntime.filterPayload(payload)',
    '_getCandidateMatcherHelpers()',
    '_filterScanRootsForGroup(group, filterKeys, roots)',
    '_flushCleanupQueues(ctx)',
    'rootsPrevalidated: true',
    "from './socialMetrics/adapters/hostTextPatternCatalog.js'",
    'resolveTextPatterns: getSocialMetricTextPatternsForHost',
    'compileSocialMetricObserverInterest({',
    'getPlatformSemanticMutationAttributes(root._getHost())',
    'lifecycleState.observerInterestPlan?.observedAttributes',
    'attributeNames: observerInterestPlan.groupAttributeNames[entry.group]',
    'diagnosticsRuntime.recordCandidateProvenance(entry, candidate, provenance)',
  ]);
  requireExcludes(socialMetricsManager, socialMetricsManagerPath, [
    "from '@runtime-discovery-ledger'",
    'runWithFastStyleMutationRecorder',
    'pendingOwnedMutationCount:',
    '_scanQueue: []',
    '_pendingMutationRoutes: new Map()',
    '_collectCandidates(entry = {}) {',
    '_scanAndMarkGroup(group, filterKeys = [], {',
    '...createSocialMetrics',
    'createSocialMetricsDiagnosticsRuntimeBridge',
    'createSocialMetricsScanRuntimeBridge',
    'createSocialMetricsOwnedMutationRuntimeBridge',
    'installSocialMetricsScanRuntimeCompatibility',
    'Object.defineProperties',
    'this.',
  ]);
  requireIncludes(socialCompiledScanPlan, socialCompiledScanPlanPath, [
    'validateSocialMetricTargets',
    'targetProfileOverride === null',
    'rootSelector,',
    'plans: Object.freeze(plans)',
    'patternMap: Object.freeze(patternMap)',
    'function requireTextPatternResolver(resolveTextPatterns)',
    'SOCIAL_METRIC_TEXT_PATTERN_RESOLVER_REQUIRED',
    'const patterns = textPatternResolver(host, filterKey)',
    'SOCIAL_METRIC_TEXT_PATTERN_RESULT_REQUIRED:',
  ]);
  requireExcludes(socialCompiledScanPlan, socialCompiledScanPlanPath, [
    'hasSocialMetricSelectors',
  ]);
  requireIncludes(socialRuntimeState, socialRuntimeStatePath, [
    'host: compiled.host',
    'rootSelector: compiled.rootSelector',
  ]);
  requireIncludes(socialObserverInterestPlan, socialObserverInterestPlanPath, [
    'compileSelectorAttributeDependencyPlan',
    'compileSocialMetricObserverInterest',
    'function requirePlan(plan, index)',
    'SOCIAL_METRIC_OBSERVER_INTEREST_GROUP_INVALID:',
    'SOCIAL_METRIC_OBSERVER_INTEREST_SELECTORS_REQUIRED:',
    'SOCIAL_METRIC_OBSERVER_INTEREST_ROOT_SELECTOR_REQUIRED',
    'semanticMutationAttributes',
    'ownerMutationAttributes',
    'groupAttributeNames',
    'initialScanOnlyAttributes',
  ]);
  requireIncludes(socialPlatformSemanticAdapters, socialPlatformSemanticAdaptersPath, [
    'ACTION_SEMANTIC_MUTATION_ATTRIBUTES',
    'REDDIT_SEMANTIC_MUTATION_ATTRIBUTES',
    'TIKTOK_SEMANTIC_MUTATION_ATTRIBUTES',
    'getPlatformSemanticMutationAttributes',
    'createFacebookSemanticMetricCandidateCollectionPlan(entry)',
    'createInstagramSemanticMetricCandidateCollectionPlan(entry)',
    'createRedditSemanticMetricCandidateCollectionPlan(entry)',
    'createTikTokSemanticMetricCandidateCollectionPlan(entry)',
    'createMetricCandidateCollectionPlan:',
    'createScopeCursor:',
    'createYoutubeSemanticMetricCandidateCollectionPlan',
    'createXSemanticMetricCandidateCollectionPlan(entry)',
  ]);
  requireExcludes(socialPlatformSemanticAdapters, socialPlatformSemanticAdaptersPath, [
    'collectScope:',
  ]);
  const metricCollectionCursorPath = 'src/domains/nudge/visual/socialMetrics/core/metricCollectionCursor.js';
  const metricCollectionCursor = await readUtf8(metricCollectionCursorPath);
  requireIncludes(metricCollectionCursor, metricCollectionCursorPath, [
    'const NODES_PER_STEP = 32',
    'export function createMetricCollectionPlan(',
    'collapseMutationSourceNodes',
    'createScopeCursor(scope)',
    'root.ownerDocument.createNodeIterator(root, NodeFilter.SHOW_ELEMENT)',
    'visited < NODES_PER_STEP',
    'resolveElement(element)',
    'seenCandidates.has(candidate)',
    'SOCIAL_METRIC_COLLECTION_CANDIDATES_INVALID',
  ]);
  requireExcludes(metricCollectionCursor, metricCollectionCursorPath, [
    'new MutationObserver',
    'querySelectorAll',
    'localStorage',
    'chrome.storage',
    'setAttribute(',
    'setText(',
    'setStyleProperty(',
  ]);
  requireIncludes(
    socialRedditSemanticMutationAttributes,
    socialRedditSemanticMutationAttributesPath,
    [
      'REDDIT_SEMANTIC_MUTATION_ATTRIBUTES',
      "'data-action-bar-action'",
      "'data-post-click-location'",
      "'downvote'",
      "'name'",
      "'number'",
      "'upvote'",
    ],
  );
  requireIncludes(socialRedditShadowMetricsOwner, socialRedditShadowMetricsOwnerPath, [
    "from './redditSemanticMutationAttributes.js'",
    'attributeFilter: REDDIT_SEMANTIC_MUTATION_ATTRIBUTES',
  ]);
  requireIncludes(socialMutationRouter, socialMutationRouterPath, [
    'attributeNames: new Set()',
    'allowedAttributeNames',
    'matchMutationRule(signals, rule, attributeNames)',
  ]);
  requireExcludes(socialCompiledScanPlan, socialCompiledScanPlanPath, [
    'function getTextPatternsForHost(',
    'const numericCounter',
    'const countLabelSignal',
    'facebookFeedbackCountSignal',
    '/조회수|views?/i',
  ]);
  requireIncludes(socialHostTextPatternCatalog, socialHostTextPatternCatalogPath, [
    'function getYoutubeTextPatterns(filterKey)',
    "if (filterKey === 'timeSignals') {",
    String.raw`/^\s*\d+\s*(?:s|m|h|d|w|mo|y)\s+ago\s*$/i`,
    'function getXTextPatterns(filterKey)',
    'function getInstagramTextPatterns(filterKey)',
    'function getTikTokTextPatterns(filterKey)',
    'function getFacebookTextPatterns(filterKey)',
    'function getRedditTextPatterns(filterKey)',
    'export function getSocialMetricTextPatternsForHost(hostname, filterKey)',
  ]);
  const youtubeTextPatternOwner = socialHostTextPatternCatalog.slice(
    socialHostTextPatternCatalog.indexOf('function getYoutubeTextPatterns(filterKey)'),
    socialHostTextPatternCatalog.indexOf('function getXTextPatterns(filterKey)'),
  );
  requireIncludes(youtubeTextPatternOwner, socialHostTextPatternCatalogPath, [
    'timeSignal,', 'englishAgoSignal,', 'dateSignal,',
    String.raw`/^\s*\d+\s*(?:s|m|h|d|w|mo|y)\s+ago\s*$/i`,
  ]);
  requireExcludes(socialHostTextPatternCatalog, socialHostTextPatternCatalogPath, [
    '/core/',
    'getSiteSelectors',
  ]);
  requireIncludes(
    socialDiagnosticsRuntimeBridge,
    socialDiagnosticsRuntimeBridgePath,
    [
      'export function createSocialMetricsDiagnosticsRuntime({',
      'ownerPort,',
      'scanPort,',
      'ownedMutationPort,',
      'SOCIAL_METRICS_DIAGNOSTICS_OWNER_PORT_REQUIRED',
      'SOCIAL_METRICS_DIAGNOSTICS_SCAN_PORT_REQUIRED',
      'SOCIAL_METRICS_DIAGNOSTICS_OWNED_MUTATION_PORT_REQUIRED',
      "from './diagnosticsSnapshotRuntime.js'",
      "from './diagnosticsValueUtils.js'",
      'const state = {',
      'const runtime = Object.freeze({',
      'const snapshotRuntime = createSocialMetricsDiagnosticsSnapshotRuntime({',
      'readSnapshotState: () => Object.freeze({',
      'state._auditMode === SOCIAL_METRICS_AUDIT_MODES.DEEP',
      'selectorProbeMs',
      '_getNodeIdentityRegistry',
      'beginDebugMeasurementEpoch',
      '_recordConfigurationCleanupTiming',
      '_recordMutationRoutingDebug',
      '_recordRuntimeDiscoveryVisit',
      'getTargetingHealthSnapshot() {',
      'return snapshotRuntime.getTargetingHealthSnapshot();',
      'getDebugSnapshot() {',
      'return snapshotRuntime.getDebugSnapshot();',
      'recordSocialMetricsTerminalDisposition(state, ctx, {',
      'unidentifiedTargetCount: decisionTargets.length - targetIdentityKeys.length',
      'operation.lastDecisionKind = classifyTargetingHealthDecisionKind(action)',
      "from '@runtime-discovery-ledger'",
      "'scan_root'",
      "'candidate_visit'",
      "'effect_target'",
      'social_metrics_selector_semantic_union',
    ],
  );
  requireExcludes(
    socialDiagnosticsRuntimeBridge,
    socialDiagnosticsRuntimeBridgePath,
    [
      'createSocialMetricsDiagnosticsRuntimeBridge',
      'createSocialMetricsOwnedMutationRuntime',
      'Object.defineProperties',
      'this.',
      'querySelector',
      'querySelectorAll',
    ],
  );
  requireIncludes(
    socialDiagnosticsSnapshotRuntime,
    socialDiagnosticsSnapshotRuntimePath,
    [
      'export function createSocialMetricsDiagnosticsSnapshotRuntime({',
      'ownerPort,',
      'scanPort,',
      'ownedMutationPort,',
      'statePort,',
      'SOCIAL_METRICS_DIAGNOSTICS_SNAPSHOT_OWNER_PORT_REQUIRED',
      'SOCIAL_METRICS_DIAGNOSTICS_SNAPSHOT_SCAN_PORT_REQUIRED',
      'SOCIAL_METRICS_DIAGNOSTICS_SNAPSHOT_OWNED_MUTATION_PORT_REQUIRED',
      'SOCIAL_METRICS_DIAGNOSTICS_SNAPSHOT_STATE_PORT_REQUIRED',
      'SOCIAL_METRICS_DIAGNOSTICS_SCAN_PHASE_INVALID',
      'const runtime = Object.freeze({',
      'const lifecycle = ownerPort.readLifecycleSnapshot();',
      'const scanSnapshot = scanPort.readSnapshot();',
      'const scanPhase = requireScanPhase(scanSnapshot.scanPhase);',
      'const ownedMutationSnapshot = ownedMutationPort.getPendingSnapshot();',
      'readTargetingHealthMeasurementEpoch(state)',
      'measurementEpochOperationCount',
      'pendingOwnedMutationCount',
      'expiredOwnedMutationByDeliveryCount',
      'recordedLastOperation?.executionOrdinal === executedScans',
      'recordedLastOperation.measurementEpoch === measurementEpoch',
      'recordedLastOperation.siteId === siteId',
      'recordedLastOperation.activationSignature === activationSignature',
      "requireTargetingHealthCount(lastOperation.selectorHitCount, 'selector_hit_count')",
      "requireTargetingHealthCount(lastOperation.semanticHitCount, 'semantic_hit_count')",
      "requireTargetingHealthCount(lastOperation.revalidationEvidenceCount, 'revalidation_evidence_count')",
      "requireTargetingHealthCount(lastOperation.decisionCount, 'resolved_target_count')",
      'terminalDisposition: lastOperation === null',
      "'terminal_disposition_target_count'",
      "'terminal_apply_target_count'",
      "'terminal_clear_target_count'",
      "'terminal_unknown_target_count'",
      "'terminal_unclassified_reconciliation_write_count'",
      'targetingHealth: runtime.getTargetingHealthSnapshot()',
    ],
  );
  requireExcludes(
    socialDiagnosticsSnapshotRuntime,
    socialDiagnosticsSnapshotRuntimePath,
    [
      'Element',
      'querySelector',
      'querySelectorAll',
      '/adapters/',
      'observerHub',
      'recordSocialMetricsWriteAttempt',
      'recordRuntimeDiscoveryVisit',
      'this.',
    ],
  );
  requireIncludes(
    socialDiagnosticsValueUtils,
    socialDiagnosticsValueUtilsPath,
    [
      'export function nowMs()',
      'export function roundMs(value)',
      'export function compactText(value, limit = DIAGNOSTIC_TEXT_LIMIT)',
      'export function compactSelector(selector, limit = 120)',
    ],
  );
  requireExcludes(
    socialDiagnosticsValueUtils,
    socialDiagnosticsValueUtilsPath,
    [
      'socialMetricsManager',
      'diagnosticsRuntimeBridge',
      '/adapters/',
      'querySelector',
      'this.',
    ],
  );
  requireIncludes(
    socialScanRuntimeBridge,
    socialScanRuntimeBridgePath,
    [
      'createSocialMetricsScanRuntimeState',
      'export function createSocialMetricsScanRuntime({',
      "from './diagnosticsValueUtils.js'",
      'SOCIAL_METRICS_SCAN_RUNTIME_REPORTER_REQUIRED',
      'SOCIAL_METRICS_SCAN_OWNER_PORT_',
      'SOCIAL_METRICS_SCAN_DIAGNOSTICS_PORT_',
      'SOCIAL_METRICS_SCAN_OWNED_MUTATION_PORT_REQUIRED',
      'SOCIAL_METRICS_SCAN_SCHEDULER_COLLABORATOR_REQUIRED',
      'const state = createSocialMetricsScanRuntimeState();',
      'const runtime = Object.freeze({',
      'collectMetricCandidates',
      'applyMetricScanCandidate',
      'scheduleMutationDrivenSocialMetricScan',
      'runSocialMetricScanChunk',
      'state._scanQueue',
      'ownerPort.readScanConfiguration().activeScanGroups',
      'ownerPort.filterScanRootsForGroup',
      'ownerPort.getCandidateMatcherHelpers()',
      'ownerPort.flushCleanupQueues(ctx)',
      'ownedMutationPort.runWithCandidateWriteCapture(',
      'ownedMutationPort.runWithScanChunkMutationCapture(',
      'readSnapshot() {',
      'resetRuntimeState() {',
    ],
  );
  requireExcludes(
    socialScanRuntimeBridge,
    socialScanRuntimeBridgePath,
    [
      '/adapters/',
      'isYoutubeSocialMetricRootRelevant',
      'applyTikTokMetricLabel',
      'applyInstagramReplacement',
      'clearMetricMarks',
      'restoreAllMetricArtifacts',
      'observerHub',
      'Object.defineProperties',
      'installSocialMetricsScanRuntimeCompatibility',
      'createSocialMetricsScanRuntimeBridge',
      'diagnosticsRuntimeBridge',
      'this.',
    ],
  );
  requireIncludes(socialScanRuntimeBridge, socialScanRuntimeBridgePath, [
    "_scanPhase: 'settled'",
    '_scanCollectionPromise: null',
    '_scanCleanup: null',
    '_scanCleanupTimer: null',
    "scanCleanupPending: typeof state._scanCleanup === 'function'",
    'scanCleanupDeadlineScheduled: state._scanCleanupTimer !== null',
    'state._scanCleanup = null;',
    'cancelSocialMetricScan(state);',
    "cleanupError ? 'failed' : 'cancelled'",
    'createMainThreadSliceDeadline',
    'yieldMainThreadContinuation',
    'COLLECTION_FILTER_BATCH_SIZE = 64',
    'queryMetricCandidates',
    "phase: 'selector_query'",
    "phase: 'candidate_filter'",
    "phase: 'semantic_scope_discovery'",
    "phase: 'semantic_query'",
    'plan.createScopeCursor(scope)',
    'SOCIAL_METRICS_SEMANTIC_COLLECTION_CURSOR_INVALID',
    'SOCIAL_METRICS_SEMANTIC_COLLECTION_CURSOR_RESULT_INVALID',
    "phase: 'union_materialization'",
    'if (!isCurrent()) return [];',
    'return runtime._waitForScanDrain();',
  ]);
  requireOrdered(socialScanRuntimeBridge, socialScanRuntimeBridgePath, [
    'cancelSocialMetricScan(state);',
    'diagnosticsPort.finishScanOperation(',
    'diagnosticsPort.clearMutationScheduleContext();',
  ], 'Social cancellation must include cleanup settlement in its terminal operation evidence');
  requireIncludes(socialScanController, socialScanControllerPath, [
    'const SCAN_WORK_SLICE_BUDGET_MS = 3;',
    'const SCAN_CLEANUP_MAX_DEFERRAL_MS = 48;',
    'function scheduleScanCleanupDeadline(manager, helpers)',
    'clearActiveScanState(manager, { preserveCleanup: Boolean(cleanupError) });',
    'function isCollectionCurrent(manager, entry, generation)',
    'manager._scanPhase === \'collecting\'',
    'manager._scanCollectionPromise = collectionPromise;',
    'manager._scanCleanup = () => helpers.flushCleanupQueues(entry);',
    'if (manager._scanCursor < manager._scanCandidates.length) {',
    'scheduleScanCleanupDeadline(manager, helpers);',
    'const cleanupError = attemptScanContextCleanup(manager, helpers, scanContext);',
  ]);
  const socialIncompleteScanChunk = readSection(
    socialScanController,
    'if (manager._scanCursor < manager._scanCandidates.length) {',
    'clearScanCleanupDeadline(manager);',
  );
  requireExcludes(socialIncompleteScanChunk, socialScanControllerPath, [
    'attemptScanContextCleanup',
  ]);
  requireIncludes(socialDirtyRootReducer, socialDirtyRootReducerPath, [
    'export function collectUniqueMutationSourceNodes(nodes = [])',
    'export function collapseMutationSourceNodes(nodes = [])',
    'const seen = new Set(elements);',
    'ancestor = ancestor.parentElement;',
  ]);
  requireIncludes(
    socialSemanticActionMetricMatcher,
    socialSemanticActionMetricMatcherPath,
    [
      'const sources = collectUniqueMutationSourceNodes([',
      'const broadSources = [];',
      'const closestButtonCache = new WeakMap();',
      'const closestContainerCache = new WeakMap();',
      'export function resolveClosestElementCached(element, selector, cache)',
      'if (hasResolvedLocalRoot) return;',
      'broadSources.push(element);',
      'collapseMutationSourceNodes(broadSources).forEach((element) => {',
      "minScoreMargin: 0",
      "if (best && runnerUp && best.score - runnerUp.score < minScoreMargin) return null;",
    ],
  );
  requireIncludes(
    socialSelectorDriftRecoveryContract,
    socialSelectorDriftRecoveryContractPath,
    [
      "SEMANTIC_ONLY: 'semantic_only'",
      "siteId: 'youtube'",
      'SOCIAL_METRICS_SELECTOR_DRIFT_SURFACES',
      "X_ACTION_GROUP: 'x_action_group'",
      "INSTAGRAM_FEED_ACTION: 'instagram_feed_action'",
      "INSTAGRAM_REEL_ACTION: 'instagram_reel_action'",
      "INSTAGRAM_PROFILE_STATS: 'instagram_profile_stats'",
      "INSTAGRAM_GRID_OVERLAY: 'instagram_grid_overlay'",
      "INSTAGRAM_DIALOG: 'instagram_dialog'",
      'SOCIAL_METRICS_SELECTOR_DRIFT_POLICIES',
      "siteId: 'x'",
      "siteId: 'instagram'",
      "'feedbackCounts'",
      "'viewCounts'",
      "'timeSignals'",
      "'audienceCounts'",
      'certificationEpochs: 3',
      'isSocialMetricsSelectorDriftPilotDecision',
      'policy.surfaces.includes(surface)',
    ],
  );
  requireExcludes(
    socialSelectorDriftRecoveryContract,
    socialSelectorDriftRecoveryContractPath,
    [
      'querySelector',
      'MutationObserver',
      'localStorage',
      'chrome.storage',
      'runtimeSelector',
    ],
  );
  requireIncludes(socialScanRuntimeBridge, socialScanRuntimeBridgePath, [
    'diagnosticsPort.recordCandidateProvenance(entry, candidate, provenance)',
    'SOCIAL_METRICS_CANDIDATE_PROVENANCE.SEMANTIC_ONLY',
    'SOCIAL_METRICS_CANDIDATE_PROVENANCE.SELECTOR_SEMANTIC_OVERLAP',
  ]);
  requireIncludes(socialDiagnosticsRuntimeBridge, socialDiagnosticsRuntimeBridgePath, [
    'readSocialMetricsCandidateProvenance(',
    'recordSocialMetricsSelectorDriftRecovery(state, ctx, {',
    'surface: decision.recoverySurface || null',
    'actualWriteTargetIdentityKeys: writeCapture',
    'writeOutcome,',
  ]);
  requireIncludes(socialDebugInstrumentation, socialDebugInstrumentationPath, [
    '_candidateProvenanceByNode: new WeakMap()',
    '_selectorDriftRecoveryByTarget: new Map()',
    'const surfaces = new Set();',
    'surfaces: Object.freeze(Array.from(surfaces).sort())',
    "SOCIAL_METRICS_SELECTOR_DRIFT_WRITE_TARGET_IDENTITIES_INVALID",
    "effectOwner: 'social_metrics_owned_mutation_ledger'",
    'runtimeSelectorGenerated: false',
    'canonicalProfileWritten: false',
  ]);
  requireIncludes(siteRunAnalysis, siteRunAnalysisPath, [
    'socialLatestStats.selectorDriftRecovery || {}',
    'socialLatestSelectorDriftRecovery.observedOperations',
    'selectorDriftRecoveryActualWriteTargetCount > 0',
    "effectOwner: 'social_metrics_owned_mutation_ledger'",
    'runtimeSelectorGenerated: false',
    'canonicalProfileWritten: false',
  ]);
  requireIncludes(siteRuntimeReport, siteRuntimeReportPath, [
    'function summarizeSelectorDriftRecovery(validInternalRuns)',
    'readVerifiedRepeatIsolationEpoch(run)',
    'SOCIAL_METRICS_SELECTOR_DRIFT_PILOT.certificationEpochs',
    "'selector_drift_recovered_human_review_required'",
    'automaticCanonicalProfileWrite: false',
    'runtimeSelectorGenerated: false',
  ]);
  requireOrdered(
    socialSemanticActionMetricMatcher,
    socialSemanticActionMetricMatcherPath,
    [
      'sources.forEach((node) => {',
      'broadSources.push(element);',
      'collapseMutationSourceNodes(broadSources).forEach((element) => {',
    ],
    'capped semantic discovery must resolve exact local sources before collapsed broad scans',
  );
  requireIncludes(youtubeAdapter, youtubeAdapterPath, [
    'views?\\\\s*${YOUTUBE_SEMANTIC_COUNT_TEXT_SOURCE}',
    'export function createYoutubeSemanticMetricCandidateCollectionPlan(ctx = {})',
    'const YOUTUBE_SEMANTIC_CURSOR_BATCH_SIZE = 8;',
    'function createYoutubeSemanticMetricScopeCursor(scope, ctx = {})',
    'createScopeCursor: (scope) => createYoutubeSemanticMetricScopeCursor(scope, ctx)',
    'drainYoutubeSemanticMetricScopeCursor(',
    'function collectYoutubeAddedNodeLocalRoots(element, roots, caches)',
    'function collectYoutubeLocalMutationRoots(element, roots, caches)',
    'function collectYoutubeAddedNodeBroadRoots(element, roots)',
    'closestSemanticScope === element',
    'const nestedRoots = discoveredRoots.filter((root) => root !== element);',
    'const broadAddedNodes = [];',
    'localContext: new WeakMap()',
    'scanScope: new WeakMap()',
    'watchLink: new WeakMap()',
    'collectSemanticActionMutationRoots(payload, YOUTUBE_SEMANTIC_ACTION_PROFILE)',
    'collapseMutationSourceNodes(broadAddedNodes).forEach((element) => {',
  ]);
  requireExcludes(youtubeAdapter, youtubeAdapterPath, [
    'collectYoutubeSemanticMetricCandidatesForScope',
    'collectScope:',
  ]);
  requireOrdered(youtubeAdapter, youtubeAdapterPath, [
    'addedNodes.forEach((node) => {',
    'localMutationNodes.forEach((node) => {',
    'collectSemanticActionMutationRoots(payload, YOUTUBE_SEMANTIC_ACTION_PROFILE)',
    'collapseMutationSourceNodes(broadAddedNodes).forEach((element) => {',
  ], 'YouTube capped discovery must settle local evidence before broad added-subtree scans');
  requireIncludes(youtubeSelectorDriftScenarios, youtubeSelectorDriftScenariosPath, [
    'YOUTUBE_SELECTOR_DRIFT_BEFORE_AFTER_SCENARIOS',
    'watch_like_class_churn_wrapper_and_foreign_controls',
    'shorts_like_button_count_sibling_reparent',
    'watch_metadata_token_row_hidden_insertions_and_class_drop',
    'legacy_metadata_user_observed_unitless_count_after_hidden_nodes',
    'ambiguous_duplicate_like_counts',
    'foreign_share_count_near_empty_like_action',
    'YOUTUBE_SELECTOR_DRIFT_LATE_HYDRATION_SCENARIO',
    'Views 8.7K',
  ]);
  requireIncludes(youtubeSelectorDriftMetamorphicTest, youtubeSelectorDriftMetamorphicTestPath, [
    "node.removeAttribute('data-oracle-id')",
    'beforeRoot.replaceWith(afterSurface.root)',
    'getSocialMetricsSubscriber().handler({',
    "state: 'recovered'",
    'actualWriteTargetCount: 1',
    'runtimeSelectorGenerated: false',
    'canonicalProfileWritten: false',
    'expectRestoredEffect(afterTarget, scenario.expected, originalAfterText)',
    'fails closed without touching any oracle negative control',
    'late hydration remains pending until semantic action and count evidence arrive',
  ]);
  requireIncludes(
    youtubeSelectorDriftIndependentCorpusTest,
    youtubeSelectorDriftIndependentCorpusTestPath,
    [
      "status: 'candidate_only'",
      'productSelectorOrScoreUsedForOracle: false',
      "node.removeAttribute('data-oracle-id')",
      'expect(negativeApplied).toEqual([])',
      'expect(reenabled).toEqual(applied)',
      "fixture.oracle.disposition === 'expected_target'",
      'expect(applied).toEqual([target])',
      "'ambiguity_fail_closed'",
      "'negative_control'",
      'expect(applied).toEqual([])',
    ],
  );
  requireIncludes(xAdapter, xAdapterPath, [
    'X_ACTION_MIN_SCORE_MARGIN = 12',
    'minScoreMargin: X_ACTION_MIN_SCORE_MARGIN',
    'function resolveXActionMetricEdge(',
    'resolveSemanticActionMetricCandidate(match.button, profile)',
    'winner?.target === el && winner.type === match.type ? match : null',
    'export function requiresXActionMetricQualification(',
    'SOCIAL_METRICS_SELECTOR_DRIFT_SURFACES.X_ACTION_GROUP',
    'getXSelectorDriftSurface',
    'export function createXSemanticMetricCandidateCollectionPlan(',
    'createScopeCursor(scope)',
    'scope.ownerDocument.createNodeIterator(scope, NodeFilter.SHOW_ELEMENT)',
    'resolveSemanticActionMetricCandidate(element, profile)',
  ]);
  requireExcludes(readSection(xAdapter, 'export function getXMetricInfo(', 'export function createXSemanticMetricCandidateCollectionPlan('), xAdapterPath, [
    'xSemanticSurfaceByElement.get',
    'xSemanticInfoByElement.get',
  ]);
  const xEffectOwnerPath = 'src/domains/nudge/visual/socialMetrics/adapters/xMetricEffectOwner.js';
  const xEffectOwner = await readUtf8(xEffectOwnerPath);
  requireIncludes(xEffectOwner, xEffectOwnerPath, [
    'export function createXMetricEffectOwner()',
    'function createCursor(group, roots)',
    'function clearGroup(group, restore)',
  ]);
  requireExcludes(xEffectOwner, xEffectOwnerPath, [
    'new MutationObserver',
    'document.querySelectorAll',
    'getXMetricInfo',
  ]);
  const tiktokEffectOwnerPath = 'src/domains/nudge/visual/socialMetrics/adapters/tiktokMetricEffectOwner.js';
  const tiktokEffectOwner = await readUtf8(tiktokEffectOwnerPath);
  requireIncludes(tiktokEffectOwner, tiktokEffectOwnerPath, [
    'export function createTikTokMetricEffectOwner()',
    'const records = new Map()',
    'const dependencyScopes = new WeakMap()',
    'function apply(target, metricTarget, ctx, info)',
    'record.ownsMark',
    'record.ownsCollapse',
    'function createCursor(group, roots)',
    'visited < 32',
    'scope.ownerDocument.createNodeIterator(scope, NodeFilter.SHOW_ELEMENT)',
    'pending?.get(scope) === revision',
    'function clearGroup(group)',
    'function collectMutationRoots(payload)',
    'dependencyScopes.has(target.parentElement)',
  ]);
  requireExcludes(tiktokEffectOwner, tiktokEffectOwnerPath, [
    'new MutationObserver',
    'querySelectorAll',
    'getTikTokMetricInfo',
    'localStorage',
    'chrome.storage',
  ]);
  requireIncludes(socialScanRuntimeBridge, socialScanRuntimeBridgePath, [
    "phase: 'effect_revalidation'",
    'revalidateXMetricEffect(record, entry, helpers)',
    'if (unit.repeat !== true) cursor += 1;',
    'semanticUnit.repeat = !step.done && isCurrent();',
  ]);
  requireIncludes(socialDirtyRootReducer, socialDirtyRootReducerPath, [
    'collectRemovalMutationTargets(payload)',
  ]);
  requireIncludes(instagramAdapter, instagramAdapterPath, [
    'function findInstagramActionCountCandidate(',
    'function revalidateInstagramSemanticInfo(',
    'findInstagramActionCountCandidate(button, root) !== el',
    "!el.closest?.('[hidden], [aria-hidden=\"true\"]')",
    'return candidates.size === 1 ? [...candidates][0] : null;',
    'SOCIAL_METRICS_SELECTOR_DRIFT_SURFACES.INSTAGRAM_FEED_ACTION',
    'SOCIAL_METRICS_SELECTOR_DRIFT_SURFACES.INSTAGRAM_REEL_ACTION',
    'SOCIAL_METRICS_SELECTOR_DRIFT_SURFACES.INSTAGRAM_PROFILE_STATS',
    'SOCIAL_METRICS_SELECTOR_DRIFT_SURFACES.INSTAGRAM_GRID_OVERLAY',
    'SOCIAL_METRICS_SELECTOR_DRIFT_SURFACES.INSTAGRAM_DIALOG',
    'getInstagramSelectorDriftSurface',
  ]);
  requireIncludes(socialSelectorDriftExpansionTest, socialSelectorDriftExpansionTestPath, [
    'recovers a class and test-id churned X Like count with exact restore parity',
    'keeps an equal X Like candidate pair fail-closed',
    'recovers one visible Instagram $id count and restores it',
    'recovers Instagram profile stats without touching adjacent text',
    'recovers an Instagram grid overlay count but ignores the media and caption',
    'ignores hidden Instagram background copies and applies only the dialog target',
    'runtimeSelectorGenerated: false',
    'canonicalProfileWritten: false',
  ]);
  requireIncludes(
    socialSelectorDriftIndependentCorpusTest,
    socialSelectorDriftIndependentCorpusTestPath,
    [
      "status: 'candidate_only'",
      'productSelectorOrScoreUsedForOracle: false',
      "node.removeAttribute('data-oracle-id')",
      'expect(negativeApplied).toEqual([])',
      'expect(new Set(applied).size).toBe(applied.length)',
      'expect(effects(mounted.root)).toEqual([])',
      'expect(effects(mounted.root)).toEqual(applied)',
      "fixture.oracle.disposition === 'expected_targets'",
      "expect(fixture.oracle.disposition).toBe('ambiguity_fail_closed')",
    ],
  );
  requireIncludes(socialSelectorDriftCorpus, socialSelectorDriftCorpusPath, [
    '"status": "candidate_only"',
    '"productSelectorOrScoreUsedForOracle": false',
    '"live_x_post_action_group_class_churn_en"',
    '"live_x_like_equal_leaf_ambiguity_en"',
    '"live_instagram_feed_action_row_ko"',
    '"live_instagram_reels_action_rail_ko"',
    '"live_instagram_profile_stats_ko"',
    '"live_instagram_grid_hover_overlay_ko"',
    '"live_instagram_dialog_unowned_numeric_ko"',
  ]);
  requireIncludes(
    socialOwnedMutationRuntimeBridge,
    socialOwnedMutationRuntimeBridgePath,
    [
      'export function createSocialMetricsOwnedMutationRuntime({',
      'SOCIAL_METRICS_OWNED_MUTATION_RUNTIME_CLOCK_REQUIRED',
      'SOCIAL_METRICS_OWNED_MUTATION_OWNER_PORT_REQUIRED',
      'SOCIAL_METRICS_OWNED_MUTATION_DIAGNOSTICS_PORT_',
      'const state = {',
      'createOwnedMutationLedger',
      'runWithFastStyleMutationRecorder',
      'SOCIAL_METRIC_ATTRS.FACEBOOK_REPLY_LABEL,',
      'function filterPayload(payload)',
      'function syncObservationContext()',
      'state.scanChunkMutationCaptureActive',
      'function runWithCandidateWriteCapture(ctx, operation)',
      'function runWithScanChunkMutationCapture(scanContext, operation)',
      'function getPendingSnapshot()',
      'function resetRuntimeState()',
      'return Object.freeze({',
    ],
  );
  requireExcludes(
    socialOwnedMutationRuntimeBridge,
    socialOwnedMutationRuntimeBridgePath,
    [
      'createSocialMetricsOwnedMutationRuntimeBridge',
      'diagnosticsRuntimeBridge',
      'Object.defineProperties',
      'this.',
      '/adapters/',
    ],
  );
  requireIncludes(socialDebugInstrumentation, socialDebugInstrumentationPath, [
    "from '@runtime-contention-ledger'",
    "ownerId: 'socialMetrics'",
    "phase: 'scan_chunk'",
    'SOCIAL_METRICS_DEEP_COLLECTION_LIMIT = 12',
    'SOCIAL_METRICS_DEEP_SELECTOR_LIMIT = 8',
    'startSocialMetricsScanOperation',
    'flushIds',
    'selectorProbeOverheadTotalMs',
    'recordSocialMetricsWriteAttempt',
    'recordSocialMetricsTerminalDisposition',
    '_terminalDispositionByTarget: new Map()',
    '_terminalUnidentifiedTargetCount: 0',
    'terminalUnclassifiedReconciliationWriteCount: 0',
    'reconciliationTargetIdentityKey',
    'if (reconciliationDisposition && reconciliationTargetIdentityKey)',
    'operation.terminalUnclassifiedReconciliationWriteCount += 1',
    'terminalDispositionTargetCount',
    'terminalApplyTargetCount',
    'terminalClearTargetCount',
    'terminalUnknownTargetCount',
    'actualWrites',
    'appliedTargetDecisionCount',
    'admittedFullScans',
    'executedFullScans',
    'duplicateScanEvidenceState',
    'avoidableFullRescanEvidenceState',
    'scanEvidenceProbeMs',
    'configurationCleanupTotalMs',
    'recordSocialMetricsConfigurationCleanup',
    'executionOrdinal: stats.executedScans',
    'selectorHitCount: 0',
    'semanticHitCount: 0',
    'decisionCount: 0',
    "lastDecisionKind: 'unknown'",
    "lastDecisionWriteOutcome: 'unknown'",
    'executionOrdinal: operation.executionOrdinal',
  ]);
  requireIncludes(socialMutationRouter, socialMutationRouterPath, [
    'SOCIAL_METRIC_MUTATION_GROUP_RULES',
    'routeSocialMetricMutationGroups',
    'SOCIAL_METRIC_MUTATION_ROOT_RELEVANCE_REQUIRED',
  ]);
  requireIncludes(socialOwnedMutationLedger, socialOwnedMutationLedgerPath, [
    'createOwnedMutationLedger',
    'pendingByTarget = new WeakMap()',
    'observedCount <= pendingTokenCount',
    'getPendingSnapshot',
    'setObservationContext',
    'SOCIAL_METRICS_OWNED_MUTATION_MAX_AGE_MS',
    'SOCIAL_METRICS_OWNED_MUTATION_MAX_DELIVERY_LAG',
    'if (pendingCount === 0)',
    'deliveryExpiredCount',
    'valueMismatchCount',
    'createProjectionBucket',
  ]);
  requireIncludes(socialDocumentNodeIdentity, socialDocumentNodeIdentityPath, [
    'createDocumentNodeIdentityRegistry',
    'identityByNode = new WeakMap()',
    'SOCIAL_METRICS_NODE_IDENTITY_FOREIGN_DOCUMENT',
  ]);
  requireIncludes(runtimeDebuggerSession, runtimeDebuggerSessionPath, [
    'RUNTIME_DEBUGGER_SESSION_VERSION = 2',
    'baseline:',
    'deltaSamples:',
    'computeNumericCounterDelta',
    "event.probeId === normalizedProbeId || event.probeId === 'runtimeDebugger'",
    'errors: sessionErrors',
    'cloneSelectedEvidence',
    'probes: selectedProbeResults.map((probe) => sanitizeRuntimeDebuggerValue(probe))',
  ]);
  requireIncludes(runtimeDebuggerAnalysis, runtimeDebuggerAnalysisPath, [
    'baselineCovered = true',
    "reason = 'baseline_coverage_missing'",
    'activationKnown = true',
    "reason = 'activation_state_unavailable'",
    'analyzeRuntimeDebuggerShortFormCompleteness',
    'RUNTIME_DEBUGGER_PROBE_VALIDITY = TARGETING_HEALTH_VALIDITY',
    "reason = 'short_form_terminal_causality_unproven'",
    'agentInterpretationRequired: false',
    'instrumentationCompletenessProven: false',
    'RUNTIME_DEBUGGER_SCANNER_WORK_LEDGER_VERSION = 3',
    "'timings.instrumentedElapsedMs'",
    "'timings.knownInPathDebuggerOverheadMs'",
    "'timings.estimatedProductElapsedMs'",
    "experimentPolicy: 'shadow_first_independent_oracle_required'",
    "ownerScope: 'social_metrics_candidate_discovery'",
    'crossOwnerComparable: false',
    'automaticWinnerSelection: false',
    'productCorrectnessNoninferiorityProven: false',
    'createRuntimeDebuggerCrossOwnerDiscoveryLedger',
    "policy: 'shared_flush_coactivity_not_duplicate_work'",
    'duplicateDiscoveryProven: false',
    'ownerDimensionsComparable: false',
    'createExactDiscoveryIdentityEvidence',
    'sameFlushReasonNodeOverlapProven',
    "redundancyReason: 'same_node_scope_can_serve_distinct_feature_outputs'",
    'recordOverheadByOwner',
    'snapshotReadOverheadMs',
  ]);
  requireIncludes(shortFormBlockManager, shortFormBlockManagerPath, [
    "from '@runtime-discovery-ledger'",
    "from '@short-form-target-outcome'",
    "from './shortFormTargetResolver.js'",
    'generation: this._costDebugState.generation',
    'resolveShortFormDiscoveryWorkReason',
    "this._recordDiscoveryVisit('scan_root'",
    "this._recordDiscoveryVisit('candidate_visit'",
    "this._recordDiscoveryVisit('effect_target'",
    'recordShortFormTargetOutcome(target',
    'this._recordPruned(pruneMode, target)',
    'this._recordRestored(target)',
    '...(payload.textNodes || [])',
    "characterData: getShortFormRuleForHostname(window.location.hostname)?.id === 'youtube'",
    'this._hiddenTargetReasons.get(target) !== expectedPruneReason',
    'readOwnedHideReason: (target) => this._hiddenTargetReasons.get(target)',
  ]);
  requireExcludes(shortFormBlockManager, shortFormBlockManagerPath, [
    'tiktokShortFormOwner',
    'YOUTUBE_CHANNEL_TAB_SELECTOR',
    'YOUTUBE_GUIDE_ENTRY_SELECTOR',
    'YOUTUBE_SHORTS_GRID_SHELF_SELECTOR',
    'YOUTUBE_FEED_ITEM_SELECTOR',
    'TIKTOK_FEED_ITEM_SELECTOR',
    '_isLikelyYouTubeShortsChannelTab',
    '_pruneYouTubeShortsFeedItems',
    '_reconcileTikTokSingleVideoFeed',
  ]);
  requireIncludes(shortFormTargetResolver, shortFormTargetResolverPath, [
    "from './platforms/youtubeShortFormResolver.js'",
    "from './platforms/tiktokShortFormResolver.js'",
    'export function normalizeShortFormMutationRoots(',
    'export function resolveShortFormNavigationActionIntent(',
    'export function resolveShortFormTargetActionIntents({',
    "type: 'block_navigation'",
    "type: 'prune'",
    'return Object.freeze([...genericIntents, ...platformIntents]);',
  ]);
  requireExcludes(shortFormTargetResolver, shortFormTargetResolverPath, [
    'setAttribute(',
    'removeAttribute(',
    'appendChild(',
    '.remove()',
    'addEventListener(',
    'setTimeout(',
    'setInterval(',
    'recordProtection',
    'RuntimeDebugger',
    'runtime-debugger',
  ]);
  requireIncludes(youtubeShortFormResolver, youtubeShortFormResolverPath, [
    'export function collectYouTubeShortFormLabelMutationRoots(',
    "'youtube_channel_tab_no_longer_shorts'",
    'export function normalizeYouTubeShortFormMutationRoots({',
    'export function resolveYouTubeShortFormActionIntents({',
    '...resolveChannelTabIntents({ root, dom, currentUrl })',
    '...resolveGuideEntryIntents({ root, dom, currentUrl })',
    '...resolveFilterChipIntents({ root, dom, readOwnedHideReason })',
    'function resolveOwnedFilterChipAncestor(',
    "readOwnedHideReason?.(target) === 'youtube_shorts_filter_chip'",
    "new Set(['active', 'hidden', 'is-watch-page'])",
    'const gridIntents = resolveGridShelfIntents({ root, dom })',
    '...resolveFeedItemIntents({ root, dom, currentUrl, prunedShelves })',
    'YOUTUBE_CARD_DISCOVERY_SELECTOR',
    '...resolveContinuationIntents({ root, dom })',
    "reason: 'youtube_shorts_channel_tab'",
    "reason: 'youtube_shorts_filter_chip'",
    "reason: 'youtube_shorts_feed_item'",
    "type: 'restore'",
  ]);
  requireIncludes(tiktokShortFormResolver, tiktokShortFormResolverPath, [
    'export function resolveTikTokShortFormActionIntents({',
    'TIKTOK_FEED_ITEM_SELECTOR',
    "reason: 'tiktok_single_video_followup'",
    "'tiktok_selected_video_or_non_feed_surface'",
    "'tiktok_feed_membership_revoked'",
    "expectedPruneReason: 'tiktok_single_video_followup'",
    "pruneModeOverride: 'hide'",
  ]);
  [youtubeShortFormResolver, tiktokShortFormResolver].forEach((source) => {
    requireExcludes(source, 'Short-form platform resolver', [
      'setAttribute(',
      'removeAttribute(',
      'appendChild(',
      '.remove()',
      'addEventListener(',
      'setTimeout(',
      'setInterval(',
      'recordProtection',
      'RuntimeDebugger',
      'runtime-debugger',
    ]);
  });
  requireIncludes(shortFormTargetOutcomeDev, shortFormTargetOutcomeDevPath, [
    'const outcomesByTarget = new WeakMap()',
    'recordShortFormTargetOutcome',
    'readShortFormTargetOutcome',
    '[normalized.action]: normalized',
  ]);
  requireExcludes(shortFormTargetOutcomeDev, shortFormTargetOutcomeDevPath, [
    'window.',
    'globalThis.',
    'localStorage',
    'RuntimeDebugger',
  ]);
  requireIncludes(shortFormTargetOutcomePublic, shortFormTargetOutcomePublicPath, [
    'recordShortFormTargetOutcome',
    'return false',
    'readShortFormTargetOutcome',
    'return null',
  ]);
  requireExcludes(shortFormTargetOutcomePublic, shortFormTargetOutcomePublicPath, [
    'WeakMap',
    'owner_target_operation',
    'RuntimeDebugger',
  ]);
  requireIncludes(runtimeDiscoveryLedgerDev, runtimeDiscoveryLedgerDevPath, [
    'const RUNTIME_DISCOVERY_RECORD_LIMIT = 4096',
    'nodeIds: new WeakMap()',
    'beginRuntimeDiscoverySession',
    'recordRuntimeDiscoveryVisit',
    'readRuntimeDiscoveryLedgerSnapshot',
    'weakmap_numeric_node_id',
    'extraDomReads: 0',
    'recordOverheadByOwner',
    'recordCallCountByOwner',
    'snapshotReadOverheadMs',
  ]);
  requireExcludes(runtimeDiscoveryLedgerDev, runtimeDiscoveryLedgerDevPath, [
    'querySelector',
    'textContent',
    'getAttribute',
    'window.',
    'localStorage',
  ]);
  requireIncludes(runtimeDiscoveryLedgerPublic, runtimeDiscoveryLedgerPublicPath, [
    'beginRuntimeDiscoverySession',
    'recordRuntimeDiscoveryVisit',
    'return false',
    'readRuntimeDiscoveryLedgerSnapshot',
    'return null',
  ]);
  requireExcludes(runtimeDiscoveryLedgerPublic, runtimeDiscoveryLedgerPublicPath, [
    'WeakMap',
    'runtime_discovery_identity_records_measured',
    'same_node_scope_can_serve_distinct_feature_outputs',
  ]);
  requireIncludes(runtimeContentionLedgerDev, runtimeContentionLedgerDevPath, [
    'const SCROLL_FRAME_RETENTION_LIMIT = 2048',
    'const WINDOW_TIMELINE_RETENTION_LIMIT = 4096',
    'beginRuntimeContentionSession',
    'recordRuntimeScrollFrame',
    "'scrollPagedIntent'",
    'pagedIntentInputCount',
    'pagedCommitCount',
    'inputToFrameMs',
    'recordRuntimeOwnerWork',
    'readRuntimeContentionLedgerSnapshot',
    'temporal_overlap_not_causal_proof',
    'bounded_scalar_owner_timeline_measured',
    'nested_observer_subscriber',
    'nested_owner_spans_are_non_additive_temporal_correlation_evidence',
    'retainsDomNodes: false',
    'extraDomReads: 0',
    'recordOverheadByKind',
    "supportedTypes.includes('longtask')",
  ]);
  requireExcludes(runtimeContentionLedgerDev, runtimeContentionLedgerDevPath, [
    'querySelector',
    'textContent',
    'getAttribute',
    'localStorage',
    'MutationObserver',
  ]);
  requireIncludes(runtimeContentionLedgerPublic, runtimeContentionLedgerPublicPath, [
    'beginRuntimeContentionSession',
    'isRuntimeContentionSessionActive',
    'recordRuntimeScrollFrame',
    'recordRuntimeOwnerWork',
    'readRuntimeContentionLedgerSnapshot',
    'return null',
  ]);
  requireExcludes(runtimeContentionLedgerPublic, runtimeContentionLedgerPublicPath, [
    'PerformanceObserver',
    'longtask',
    'runtime_contention_timeline_measured',
  ]);
  requireIncludes(viteConfig, viteConfigPath, [
    'runtimeContentionLedgerModulePath',
    "'runtimeContentionLedger.dev.js'",
    "'runtimeContentionLedger.public.js'",
    "'@runtime-contention-ledger': runtimeContentionLedgerModulePath",
    'runtimeDiscoveryLedgerModulePath',
    "'runtimeDiscoveryLedger.dev.js'",
    "'runtimeDiscoveryLedger.public.js'",
    "'@runtime-discovery-ledger': runtimeDiscoveryLedgerModulePath",
    'shortFormTargetOutcomeModulePath',
    "'shortFormTargetOutcome.dev.js'",
    "'shortFormTargetOutcome.public.js'",
    "'@short-form-target-outcome': shortFormTargetOutcomeModulePath",
  ]);
  requireIncludes(runtimeDebugger, runtimeDebuggerPath, [
    "from '@runtime-contention-ledger'",
    'beginRuntimeContentionSession()',
    'readRuntimeContentionLedgerSnapshot()',
    'stopRuntimeContentionSession()',
    "from '@runtime-discovery-ledger'",
    'beginRuntimeDiscoverySession()',
    'readRuntimeDiscoveryLedgerSnapshot()',
    'stopRuntimeDiscoverySession()',
    'exactEvidence:',
  ]);
  requireIncludes(runtimeDebuggerShortFormOracle, runtimeDebuggerShortFormOraclePath, [
    "resolveSiteId as resolveCanonicalSiteId",
    'resolveShortFormSiteId(hostname)',
    'projectRuntimeDebuggerShortFormTargetingHealth({',
    'targetingHealth,',
    'MAX_OPPORTUNITIES = 1024',
    'MAX_DROPPED_OPPORTUNITY_IDS = 512',
    'this._hub.subscribe(this._boundMutationBatch',
    "debugLabel: 'RuntimeDebuggerShortFormOracle.observer'",
    "'product_marker'",
    "'owner_target_operation'",
    "'owner_target_ancestor_operation'",
    "'owner_target_reconcile'",
    "'owner_target_ancestor_reconcile'",
    'readShortFormTargetOutcome',
    'productOperationContractFailureCount',
    'targetOutcomeMismatchCount',
    'causallyProvenTerminalCount',
    'droppedOpportunityObservationCount',
    'droppedOpportunityOverflowCount',
    'sanitizeRuntimeDebuggerValue',
  ]);
  requireExcludes(runtimeDebuggerShortFormOracle, runtimeDebuggerShortFormOraclePath, [
    'new MutationObserver',
    'window.localStorage',
    'globalThis.',
  ]);
  requireIncludes(runtimeDebuggerReport, runtimeDebuggerReportPath, [
    'diagnosticContext = null',
    '## Domain-specific diagnostic context',
    'Operation count is owner work and is not always an opportunity denominator.',
  ]);
  requireIncludes(runtimeDebuggerSanitizer, runtimeDebuggerSanitizerPath, [
    'maxDepth: 9',
  ]);
  requireIncludes(runtimeDebuggerProbeCatalog, runtimeDebuggerProbeCatalogPath, [
    "activeFilterKeys.includes('socialMetrics')",
    'validateTargetingHealthSnapshot(snapshot)',
    'TARGETING_HEALTH_OWNER_MISMATCH:',
    'targetingHealthContractError:',
    'targetingHealthValidityConsistent:',
    'createExactOwnerOperationDelta',
    'createSocialOwnerOperationEvidence({',
    'isCanonicalInactiveTargetingHealth(targetingHealth)',
    'baselineSnapshot?.loaded === false',
    'inspectOwnerOperationCounter(snapshot)',
    'values.some((value) => value !== values[0])',
    'hasSocialOwnerWorkEvidence(snapshot)',
    'isCanonicalInactiveSocialOwnerSnapshot(latestSnapshot)',
    'baselineOperationCounter.presentCount === 0',
    'inspectMeasurementEpochOperationCounter(snapshot)',
    'measurementEpochOperationCounter.valid',
    'measurementEpochOperationCounter.count <= latestOperationCounter.count',
    "'measurement_epoch_exact'",
    'social.active === socialActive',
    "'not_required_inactive'",
    'operationCounterState: socialOperationEvidence.state',
    'Number.isSafeInteger(value)',
    'TARGETING_HEALTH_MEASURED_OPERATION_REQUIRED',
    'TARGETING_HEALTH_SESSION_VALIDITY_MISMATCH',
    'targetingHealthSessionValidityConsistent:',
    'sessionValidity',
    'selectorToTarget: createRuntimeDebuggerRatio',
    "createEffectProbeResult(session.baseline, latest, delta, 'shortForm'",
    'baselineCovered: socialBaselineCovered',
    "activationKnown: available && typeof snapshot.active === 'boolean'",
    'feedLedgerReady = Number.isFinite(Number(feed.ledger?.counters?.advanceCount))',
    'ready: !!feed.readout && feedLedgerReady',
    'operationCount: feedDelta.ledger?.counters?.advanceCount',
  ]);
  [
    [domTargetingArchitecture, domTargetingArchitecturePath],
    [socialMetricsSeamMap, socialMetricsSeamMapPath],
    [visualTargetQaChecklist, visualTargetQaChecklistPath],
    [realSiteE2e, realSiteE2ePath],
  ].forEach(([source, sourcePath]) => requireExcludes(source, sourcePath, [
    'textVisualTargets',
    'visualContainerHints',
  ]));
  requireIncludes(domTargetingArchitecture, domTargetingArchitecturePath, [
    'current measurement epoch, site id, activation signature, and',
    'execution ordinal',
    'active owner envelope remains a fail-loud activation mismatch',
    'exact `rootSelector`',
    'nonnegative safe-',
    'empty no-op map/selector overrides are rejected',
    'Social Metrics Phase 4 now binds semantic-only candidates',
    'X and Instagram may move from `candidate_only` to certified',
    'three independently owned disposable-browser epochs',
  ]);
  requireIncludes(socialMetricsSeamMap, socialMetricsSeamMapPath, [
    'current measurement epoch with the current site id,',
    'exact scan-root selector',
    '`measurementEpochOperationCount`',
    '`broken / targeting_health_probe_contract_invalid`',
    'single bounded diagnostic rebaseline',
    '`selectorDriftRecoveryContract.js`',
    '`selector_drift_recovered_human_review_required`',
  ]);
  requireIncludes(realSiteE2e, realSiteE2ePath, [
    'targeting_health_probe_contract_invalid',
    'probe-status/health-validity agreement',
    'owner scan work, not an opportunity',
    '`not_required_inactive`',
    'no operation-counter alias or retained',
    'equal nonnegative safe integer',
    '`measurementEpochOperationCount`',
    '`measurement_epoch_exact`',
    'one exact inactive shape',
    'malformed, or regressed counter',
    'paired with canonical inactivity remains an',
    'inactive epoch rule is not a counter fallback',
    'permits one',
    'every physical pending field is known-settled',
    'fixed content-free evidence',
  ]);
  requireIncludes(runtimeDebuggerOverlay, runtimeDebuggerOverlayPath, [
    'RUNTIME_DEBUGGER_OVERLAY_STYLE',
    "panel.setAttribute('role', 'dialog')",
    'role="tablist"',
    'role="tabpanel"',
    'aria-live="polite"',
    'data-action="measurement-guide"',
    "tab.setAttribute('aria-selected'",
    '_renderGuide(state = {})',
    'if (markup === this._guideMarkup) return;',
    '_handleKeydown(event)',
    "['ArrowLeft', 'ArrowRight', 'Home', 'End']",
  ]);
  requireIncludes(runtimeDebuggerOverlayStyle, runtimeDebuggerOverlayStylePath, [
    '--erd-paper: var(--entropy-runtime-debugger-paper',
    '--erd-sage: var(--entropy-runtime-debugger-accent',
    '.guide-panel[hidden]',
    '@media (prefers-reduced-motion: reduce)',
    '@media (forced-colors: active)',
  ]);
  requireExcludes(runtimeDebuggerOverlay, runtimeDebuggerOverlayPath, [
    'themes/plugins/zen',
    'ZenTheme',
  ]);
  requireExcludes(runtimeDebuggerOverlayStyle, runtimeDebuggerOverlayStylePath, [
    'backdrop-filter',
    'var(--color-',
  ]);
  requireIncludes(runtimeDebuggerMeasurementGuide, runtimeDebuggerMeasurementGuidePath, [
    'observer: createGuide({',
    'protection: createGuide({',
    'social: createGuide({',
    'visual: createGuide({',
    'text: createGuide({',
    'short: createGuide({',
    "'video-observer': createGuide({",
    'click: createGuide({',
    'video: createGuide({',
    'feed: createGuide({',
    'sentinel: createGuide({',
    'log: createGuide({',
    '비활성·사용 불가·대기 중·0/0',
    '심층 감사의 selector probe 시간은 디버거 오버헤드',
    'Grayscale 같은 root-only 효과는 이 probe 대상이 아닙니다.',
    '강제스폰 성공은 production Enso admission 성공을 뜻하지 않습니다.',
    'dry-run은 debug-only admission으로 실제 DOM endpoint를 쓰지만',
    'getRuntimeDebuggerMeasurementGuide(tabId)',
    'RUNTIME_DEBUGGER_MEASUREMENT_GUIDE_REQUIRED',
  ]);
  requireIncludes(runtimeDebugger, runtimeDebuggerPath, [
    "acquireFrictionDebugLease('runtime_debugger')",
    '_releaseRuntimeDebugLease()',
    'releaseForcedArm()',
    'removePageLocalStorageItem(CAPTURE_KIND_FLAG_KEY)',
    'diagnosticContext,',
    'createClickGateDiagnosticContext',
    'createVideoDiagnosticContext',
    'beginLoadedSocialMetricsDebugMeasurementEpoch',
    'this._shortFormOracle.start({ observeInitial: false })',
    'this._shortFormOracle.observeDocument()',
    'this._shortFormOracle.getSnapshot({',
    'this._shortFormOracle.stop()',
  ]);
  requireIncludes(protectionController, protectionControllerPath, [
    'RuntimeDebugger.releaseForcedArm();',
  ]);
  requireExcludes(runtimeDebugger, runtimeDebuggerPath, [
    'observerHub.resetDebugSnapshot',
    'resetLoadedSocialMetricsDebugSnapshot',
    'this._feedProbe.reset()',
    'this._sentinelProbe.reset()',
    'createClickGateSummaryText',
    'createVideoSummaryText',
  ]);
  requireIncludes(youtubeAdapter, youtubeAdapterPath, [
    'YOUTUBE_ROOT_RELEVANCE_SELECTOR_FAILED',
  ]);
}

async function checkEnsoFeedEpisodeAuthority() {
  const observationPath = 'src/domains/nudge/feed-flow/FeedObservationRuntime.js';
  const observation = await readUtf8(observationPath);
  requireIncludes(observation, observationPath, [
    'this._historyAllowed || this._consumer !== null',
    'this.flow.recordSupplyReadout(',
    'this.flow.setHistoryAllowed(allowed)',
    'this.flow.setInterventionEnabled(false)',
    'FEED_OBSERVATION_STOP_FAILED',
  ]);
  requireExcludes(observation, observationPath, [
    'EnsoRuntimeEpisodeManager', 'requestEnsoGate', 'new MutationObserver',
  ]);
  const runtimePath = 'src/domains/nudge/feed-flow/index.js';
  const capturePath = 'src/domains/nudge/feed-flow/capture/FeedInputCapture.js';
  const managerPath = 'src/domains/nudge/feed-flow/FeedBoundaryEpisodeCoordinator.js';
  const periodicFacadePath = 'src/domains/nudge/interaction/EnsoRuntimeEpisodeManager.js';
  const periodicFacade = await readUtf8(periodicFacadePath);
  requireIncludes(periodicFacade, periodicFacadePath, [
    'FeedBoundaryEpisodeCoordinator as EnsoRuntimeEpisodeManager',
    "export { default } from '../feed-flow/FeedBoundaryEpisodeCoordinator.js'",
  ]);
  requireExcludes(periodicFacade, periodicFacadePath, [
    'new FeedTerminusController', 'new FeedFlowRuntime', 'attachConsumer(',
    'setInterval(', 'setTimeout(', 'requestEnsoGate(',
  ]);
  const spawnPolicyPath = 'src/domains/nudge/interaction/EnsoSpawnPolicy.js';
  const spawnSourcesPath = 'src/domains/nudge/interaction/ensoSpawnSources.js';
  const consumptionPatternClassifierPath =
    'src/domains/nudge/attention/consumptionPatternClassifier.js';
  const interventionRuntimeDevPath =
    'src/domains/nudge/runtime/interventionAdmissionRuntime.dev.js';
  const interventionShadowPath =
    'src/domains/nudge/runtime/InterventionAdmissionShadow.js';
  const interventionRuntimePublicPath =
    'src/domains/nudge/runtime/interventionAdmissionRuntime.public.js';
  const releaseCapabilitiesPath = 'src/platform/build/releaseCapabilities.js';
  const publicBuildGuardPath = 'scripts/ci/check-public-build-debug-surface.mjs';
  const viteConfigPath = 'vite.config.js';
  const surfaceEntryGracePath = 'src/domains/nudge/interaction/EnsoFeedSurfaceEntryGrace.js';
  const readinessPath = 'src/domains/nudge/interaction/ensoGateReadiness.js';
  const interactionStatePath = 'src/domains/nudge/interaction/interactionState.js';
  const admissionPath = 'src/domains/nudge/interaction/ensoFeedEpisodeAdmission.js';
  const interactionManagerPath = 'src/domains/nudge/interactionManager.js';
  const ensoSurfacePath = 'src/domains/nudge/interaction/ensoGateSurface.js';
  const controllerPath = 'src/domains/nudge/feed-flow/terminus/FeedTerminusController.js';
  const bridgePath = 'src/domains/nudge/feed-flow/bridge/FeedFlowTriggerBridge.js';
  const topologyProtocolPath =
    'src/domains/nudge/feed-flow/topology/FeedTopologyRecoveryProtocol.js';
  const topologyContractPath =
    'src/domains/protection/contracts/feedTopologyAuthorityContract.js';
  const safetyPath = 'src/domains/nudge/feed-flow/actuation/FeedActuationSafetyJudge.js';
  const endpointCatalogPath = 'src/domains/nudge/feed-flow/actuation/feedEndpointAdapterCatalog.js';
  const shippedTopologyProbePath =
    'src/domains/nudge/feed-flow/actuation/FeedShippedTopologyProbe.js';
  const endpointTopologyInspectionPath =
    'src/domains/nudge/feed-flow/actuation/feedEndpointTopologyInspection.js';
  const endpointResolverPath = 'src/domains/nudge/feed-flow/actuation/FeedEndpointBoundaryResolver.js';
  const endpointPlanContractPath =
    'src/domains/nudge/feed-flow/contracts/feedEndpointPlanContract.js';
  const boundaryMotionProfilePath =
    'src/domains/nudge/feed-flow/terminus/feedEndpointBoundaryMotionProfile.js';
  const tailPaintProfilePath =
    'src/domains/nudge/feed-flow/terminus/feedEndpointTailPaintProfile.js';
  const boundaryMotionPath =
    'src/domains/nudge/feed-flow/terminus/FeedEndpointBoundaryMotion.js';
  const forwardControlLeasePath =
    'src/domains/nudge/feed-flow/terminus/FeedEndpointForwardControlLease.js';
  const readinessPresentationPath =
    'src/domains/nudge/feed-flow/topology/feedTopologyReadinessPresentation.js';
  const endpointLeasePath = 'src/domains/nudge/feed-flow/terminus/FeedEndpointLease.js';
  const feedHorizonInspectionPath = 'src/domains/nudge/runtime-debugger/feed-horizon-inspection/FeedHorizonInspectionSession.dev.js';
  const feedHorizonQaCatalogPath = 'scripts/e2e/feedHorizonQaPresetCatalog.mjs';
  const feedHorizonQaPath = 'scripts/e2e/feedHorizonQa.mjs';
  const feedHorizonInspectionRunnerPath = 'scripts/e2e/feedHorizonInspectionE2E.mjs';
  const chromiumHarnessPath = 'scripts/e2e/extensionChromiumHarness.mjs';
  const runtimeConfigPath =
    'src/domains/nudge/feed-flow/config/ensoFeedHorizonRuntimeConfig.js';
  const guardSettingPath = 'src/domains/settings/config/infiniteScrollGuard.js';
  const envelopeAdapterPath =
    'src/domains/protection/background/runtime/EnvelopeAdapter.js';
  const terminusSurfacePath = 'src/domains/nudge/feed-flow/terminus/TerminusSurface.js';
  const scrollOrchestratorPath = 'src/domains/nudge/behavior/scrollInputOrchestrator.js';
  const pagedScrollIntentPath =
    'src/domains/nudge/behavior/pagedScrollIntentActuator.js';
  const supplyProbePath = 'src/domains/nudge/feed-flow/supply/FeedSupplyProbe.js';
  const rewardEvidencePath = 'src/domains/nudge/attention/rewardDriftEvidence.js';
  const feedBingeWindowPath = 'src/domains/nudge/attention/FeedBingeObservationWindow.js';
  const feedBingeEvidencePath = 'src/domains/nudge/attention/feedFlowBingeEvidence.js';
  const dopamineBingeDetectorPath = 'src/domains/nudge/attention/dopamineBingeDetector.js';
  const continuousAdapterPath = 'src/domains/nudge/feed-flow/confirm/ContinuousAdvanceAdapter.js';
  const advanceCoordinatorPath = 'src/domains/nudge/feed-flow/confirm/FeedAdvanceCoordinator.js';
  const siteRuntimeBrowserPath = 'scripts/e2e/sites/siteRuntimeBrowser.mjs';
  const snapshotBridgePath = 'src/domains/protection/contracts/feedFlowSnapshotBridge.js';
  const runtimeStatePath = 'src/apps/background/services/runtime/ProtectionRuntimeStateCoordinator.js';
  const feedFlowRuntimeStatePath =
    'src/domains/protection/background/runtime/FeedFlowRuntimeStateOwner.js';
  const runtimeInputProviderPath = 'src/domains/protection/background/ProtectionRuntimeInputProvider.js';
  const protectionDispatcherPath = 'src/domains/protection/background/ProtectionDispatcher.js';
  const trackingSpecialRuntimePath = 'src/domains/tracking/background/trackingSpecialRuntimeHandlers.js';
  const behaviorTelemetryRecorderPath = 'src/domains/stats/background/collection/behaviorTelemetryRecorder.js';
  const runtimeInputAssemblerPath = 'src/domains/protection/background/ProtectionRuntimeInputAssembler.js';
  const directTriggerResolverPath = 'src/domains/protection/background/observe/DirectTriggerResolver.js';
  const strategyOrchestratorPath = 'src/domains/protection/background/strategy/BasicStrategyOrchestrator.js';
  const protectionContractsPath = 'src/domains/protection/contracts/protectionContracts.js';
  const targetDocPath = 'docs/architecture/runtime/feed-flow-runtime-target-architecture.md';
  const feedBoundaryJudgePath = 'src/domains/nudge/feed-flow/judge/FeedBoundaryJudge.js';
  const feedBoundaryStatePath = 'src/domains/nudge/feed-flow/session/FeedBoundaryState.js';
  const genericFeaturesPath =
    'src/domains/nudge/feed-flow/discovery/genericFeedItemFeatures.js';
  const genericClassifierPath =
    'src/domains/nudge/feed-flow/classify/GenericSurfaceClassifier.js';
  const genericDiscoveryPath =
    'src/domains/nudge/feed-flow/discovery/GenericFeedItemDiscovery.js';
  const [
    runtime,
    capture,
    manager,
    spawnPolicy,
    spawnSources,
    consumptionPatternClassifier,
    interventionRuntimeDev,
    interventionShadow,
    interventionRuntimePublic,
    releaseCapabilities,
    publicBuildGuard,
    viteConfig,
    surfaceEntryGrace,
    readiness,
    interactionState,
    admission,
    interactionManager,
    ensoSurface,
    controller,
    bridge,
    safety,
    endpointCatalog,
    endpointResolver,
    endpointPlanContract,
    boundaryMotionProfile,
    tailPaintProfile,
    boundaryMotion,
    forwardControlLease,
    endpointLease,
    feedHorizonInspection,
    feedHorizonQaCatalog,
    feedHorizonQa,
    feedHorizonInspectionRunner,
    terminusSurface,
    scrollOrchestrator,
    pagedScrollIntent,
    supplyProbe,
    rewardEvidence,
    feedBingeWindow,
    feedBingeEvidence,
    dopamineBingeDetector,
    continuousAdapter,
    advanceCoordinator,
    siteRuntimeBrowser,
    snapshotBridge,
    runtimeState,
    feedFlowRuntimeState,
    runtimeInputProvider,
    protectionDispatcher,
    trackingSpecialRuntime,
    behaviorTelemetryRecorder,
    runtimeInputAssembler,
    directTriggerResolver,
    strategyOrchestrator,
    protectionContracts,
    targetDoc,
  ] = await Promise.all([
    readUtf8(runtimePath),
    readUtf8(capturePath),
    readUtf8(managerPath),
    readUtf8(spawnPolicyPath),
    readUtf8(spawnSourcesPath),
    readUtf8(consumptionPatternClassifierPath),
    readUtf8(interventionRuntimeDevPath),
    readUtf8(interventionShadowPath),
    readUtf8(interventionRuntimePublicPath),
    readUtf8(releaseCapabilitiesPath),
    readUtf8(publicBuildGuardPath),
    readUtf8(viteConfigPath),
    readUtf8(surfaceEntryGracePath),
    readUtf8(readinessPath),
    readUtf8(interactionStatePath),
    readUtf8(admissionPath),
    readUtf8(interactionManagerPath),
    readUtf8(ensoSurfacePath),
    readUtf8(controllerPath),
    readUtf8(bridgePath),
    readUtf8(safetyPath),
    readUtf8(endpointCatalogPath),
    readUtf8(endpointResolverPath),
    readUtf8(endpointPlanContractPath),
    readUtf8(boundaryMotionProfilePath),
    readUtf8(tailPaintProfilePath),
    readUtf8(boundaryMotionPath),
    readUtf8(forwardControlLeasePath),
    readUtf8(endpointLeasePath),
    readUtf8(feedHorizonInspectionPath),
    readUtf8(feedHorizonQaCatalogPath),
    readUtf8(feedHorizonQaPath),
    readUtf8(feedHorizonInspectionRunnerPath),
    readUtf8(terminusSurfacePath),
    readUtf8(scrollOrchestratorPath),
    readUtf8(pagedScrollIntentPath),
    readUtf8(supplyProbePath),
    readUtf8(rewardEvidencePath),
    readUtf8(feedBingeWindowPath),
    readUtf8(feedBingeEvidencePath),
    readUtf8(dopamineBingeDetectorPath),
    readUtf8(continuousAdapterPath),
    readUtf8(advanceCoordinatorPath),
    readUtf8(siteRuntimeBrowserPath),
    readUtf8(snapshotBridgePath),
    readUtf8(runtimeStatePath),
    readUtf8(feedFlowRuntimeStatePath),
    readUtf8(runtimeInputProviderPath),
    readUtf8(protectionDispatcherPath),
    readUtf8(trackingSpecialRuntimePath),
    readUtf8(behaviorTelemetryRecorderPath),
    readUtf8(runtimeInputAssemblerPath),
    readUtf8(directTriggerResolverPath),
    readUtf8(strategyOrchestratorPath),
    readUtf8(protectionContractsPath),
    readUtf8(targetDocPath),
  ]);
  const [
    topologyProtocol,
    topologyContract,
    shippedTopologyProbe,
    endpointTopologyInspection,
    readinessPresentation,
    genericFeatures,
    genericClassifier,
    genericDiscovery,
  ] = await Promise.all([
    readUtf8(topologyProtocolPath),
    readUtf8(topologyContractPath),
    readUtf8(shippedTopologyProbePath),
    readUtf8(endpointTopologyInspectionPath),
    readUtf8(readinessPresentationPath),
    readUtf8(genericFeaturesPath),
    readUtf8(genericClassifierPath),
    readUtf8(genericDiscoveryPath),
  ]);

  await forbidFile('src/domains/nudge/feed-flow/terminus/FeedDemandJudge.js');
  await forbidFile('src/domains/nudge/infinite-scroll/index.js');
  await forbidFile('src/domains/nudge/short-form/tiktokShortFormOwner.js');
  const allRuntimeSourceFiles = await collectSourceFiles('src');
  const retiredManagerImports = [
    "nudge/infinite-scroll",
    "from '../infinite-scroll",
    "from './infinite-scroll",
  ];
  const retiredRuntimeConfigOwners = [
    'normalizeLoopBreakerRuntimeConfig',
    'DEFAULT_LOOP_BREAKER_RUNTIME_CONFIG',
    'buildScrollFlowProfileForLevel',
    'SCROLL_FLOW_LEVEL_PROFILES',
    'LOOP_BREAKER_DETECTION_LEVEL_PROFILES',
  ];
  for (const sourcePath of allRuntimeSourceFiles) {
    const source = await readUtf8(sourcePath);
    requireExcludes(source, sourcePath, retiredManagerImports);
    requireExcludes(source, sourcePath, retiredRuntimeConfigOwners);
  }
  requireIncludes(runtime, runtimePath, [
    "from './learning/FeedStructureLearner.js'",
    "from './topology/FeedTopologyRecoveryProtocol.js'",
    "from './topology/FeedTopologyCertificationRuntime.js'",
    "from './actuation/FeedShippedTopologyProbe.js'",
    'candidateItemSelectors: GENERIC_FEED_ITEM_SELECTOR',
    "from './actuation/FeedActuationSafetyJudge.js'",
    'recordSupplyReadout(readout = null',
    'updateSupplySignals(readout',
    '_finalizeDecisionAuthority(',
    '_withCurrentBehavior(snapshot, now)',
    'this._coordinator.getBehaviorSignals(now)',
    'preserveConsumption = false',
    'requireTransition: true',
    'FEED_FLOW_CONTINUE_DECISION_NOT_RELEASED',
    'READY_SURFACE_VALIDATION_MS',
    '_initializeStructureLearner(nextSurface)',
    'function buildLocalActuationContext(event, surface, runtimeConfig)',
    'getActuationContext() {',
    'attachTopologyAuthority(',
    '_resolveTopologyAuthority()',
    'this._topologyCertificationRuntime.resetLiveVerification({',
    "reason: 'document_hidden'",
    "from './judge/FeedBoundaryJudge.js'",
    "from './session/FeedBoundaryState.js'",
    'burstMachine = new FeedBoundaryState()',
    'judge = new FeedBoundaryJudge()',
    'this._burstMachine.recordAdvance(event)',
    'admissionClient.getEnsoCadence()?.eligible === true',
    'setGoalBoundaryDemand(required)',
    'this._judge.setGoalDemand(required)',
    'this._goalBoundaryDemand === true',
    'onBeforeFeedSurfaceReset',
    'FEED_FLOW_SURFACE_RESET_NOT_ACKNOWLEDGED',
    'semanticSurfaceId',
  ]);
  requireExcludes(runtime, runtimePath, [
    'EXPLICIT_RETREAT_INTENT_KINDS',
    'isExplicitRetreatIntent(intent)',
    'setExplicitRetreatIntentOwner',
    'keyboard_backward',
    'pointer_backward',
  ]);
  requireExcludes(manager, managerPath, [
    'setExplicitRetreatIntentOwner',
    'requestRetreat(',
    '_handleExplicitRetreatIntent(',
  ]);
  requireExcludes(runtime, runtimePath, [
    'resolveFeedEndpointAdapter',
  ]);
  requireIncludes(capture, capturePath, [
    'observerHub.subscribe(',
    "debugLabel: 'FeedInputCapture.observer'",
  ]);
  requireExcludes(capture, capturePath, ['new MutationObserver(']);
  requireIncludes(advanceCoordinator, advanceCoordinatorPath, [
    "from '../config/ensoFeedHorizonRuntimeConfig.js'",
    'requireEnsoFeedHorizonRuntimeConfig(runtimeConfig)',
    'this._config.sensing.paged.requireRecentGesture',
    'VIEWPORT_HIT_TEST_RATIOS',
    '_collectViewportHitCandidates(',
    'Array.from(new Set([...viewportCandidates, ...boundedCandidates]))',
    'resolveOutermostViewportCandidate(',
    '...collectBoundaryCandidates(outermostElements)',
    'visibleScore <= 0',
    'isRenderedDominantCandidate(element, this._window)',
  ]);
  requireIncludes(siteRuntimeBrowser, siteRuntimeBrowserPath, [
    'const outermostCandidates = matchedCandidates.filter(',
    'const boundedCandidateCount = Math.min(',
    'candidateCount: boundedCandidateCount',
  ]);
  requireIncludes(manager, managerPath, [
    "from '../interaction/EnsoSpawnPolicy.js'",
    "from '../interaction/EnsoFeedSurfaceEntryGrace.js'",
    "from '../interaction/ensoFeedEpisodeAdmission.js'",
    "from '../interaction/ensoGateSurface.js'",
    'onDecision: (decision) => this._handleFeedFlowDecision(decision)',
    'onBeforeFeedSurfaceReset:',
    'this._handleFeedSurfaceWillReset(transition)',
    'this._observationRuntime.attachConsumer(this._feedConsumer, this._runtimeConfig)',
    'this._observationRuntime.detachConsumer(this._feedConsumer)',
    'this._interactionManager.acquireInteractionListenerLease(',
    'this._interactionManager.releaseInteractionListenerLease(',
    'resolveEnsoFeedEpisodeAdmission({',
    'spawnPolicyDecision: this._getSpawnPolicyDecision(now)',
    'surfaceEntryGraceDecision:',
    'this._activateSpawnSource(Date.now(), protectionContext);',
    'this._listenerLeaseHeld = true;',
    'this._spawnSourceActive = true;',
    'this._hasLifecycleOwnership() && this._cleanupInFlight()',
    'ENSO_RUNTIME_EPISODE_CLEANUP_PENDING',
    'this._spawnPolicy.reserve({',
    'this._spawnPolicy.commit(this._spawnPermit, { now })',
    'this._spawnPolicy.release(permit)',
    'this._consumeWithheldOpportunity(admission)',
    'this._feedFlowRuntime.consumeOpportunity({',
    'this._claimPreludeSurface({',
    'getActuationContext: () => this._feedFlowRuntime.getActuationContext()',
    'getAdmission: () => this._episodeAdmission',
    'onHorizonEngaged: ({ engagedAt } = {}) => this._commitSpawnPermit(engagedAt)',
    'onEpisodeFailure: ({ phase } = {}) => this._abortEpisode(',
    'onContinueIntent: (intent) => this._handleContinueIntent(intent)',
    'this._interactionManager.requestEnsoGate({',
    'spawnPermit: this._spawnPermit',
    'this._terminusController.resolveContinueIntent(action, {',
    'this._feedFlowRuntime.markContinue({',
    "decision?.actuationSafety?.status === 'safe'",
    "decision?.readiness?.status === 'ready'",
    "this._disarmTerminus('feed_terminus_disarm_retry')",
    "this._state = 'CLEANUP_FAILED'",
    'ENSO_RUNTIME_EPISODE_REMOVE_NOT_CONFIRMED',
    "action === 'neutral'",
    'cadence: admission.cadence',
  ]);
  requireExcludes(manager, managerPath, [
    'new FeedFlowRuntime(',
    'new FeedSupplyProbe(',
    'this._feedFlowRuntime.start(',
    'this._feedFlowRuntime.stop(',
    'this._feedFlowRuntime.recordSupplyReadout(',
  ]);
  requireIncludes(manager, managerPath, [
    'class FeedBoundaryEpisodeCoordinator',
    "GOAL_FEED_SOURCE = 'goal_feed_horizon'",
    'requestGoalEntry({ kind, purpose, runId, goalBinding, onContinue, onCancelled })',
    'requireGoalEpisodeBinding(goalBinding)',
    'goalBinding.runId !== runId || goalBinding.purpose !== purpose',
    'cancelGoalEntry(',
    'getGoalEntrySnapshot()',
    'this._feedFlowRuntime.setGoalBoundaryDemand(true)',
    'this._feedFlowRuntime.setGoalBoundaryDemand(false)',
    'interventionAdmissionClient.boundaryPresented(lease)',
    'interventionAdmissionClient.attachEndpoint(this._goalLease)',
    'this._goalBoundaryAcknowledged',
    'replaceClaim: claim',
    'FEED_GOAL_CLAIM_TRANSFER_INVALID',
    'FEED_GOAL_LEASE_TRANSFER_UNCONFIRMED',
    'releaseLease: releaseLease && !this._goalLeaseTransferred',
    'FEED_GOAL_TERMINUS_CLEANUP_FAILED',
    'FEED_GOAL_CLAIM_CLEANUP_FAILED',
  ]);
  if ((manager.match(/new FeedTerminusController\(/g) || []).length !== 1) {
    fail(`${managerPath}: periodic and goal purposes must share exactly one Terminus instance.`);
  }
  const goalTransfer = readSection(manager, '      onClaimTransferred:', '    })).then((result) =>');
  requireOrdered(goalTransfer, managerPath, [
    'this._goalClaim = null',
    "this._terminusController.resolveContinueIntent('enter')",
    'this._terminusController.disarm()',
    'this._goalLeaseTransferred = true',
    'return true',
  ], 'Host release authority must follow exact claim transfer and physical endpoint cleanup');
  const furinHostPath = 'src/domains/nudge/runtime/SentinelProtocolHost.js';
  const furinHost = await readUtf8(furinHostPath);
  const hostTransfer = readSection(furinHost, '        const transfer = handoff.onClaimTransferred(', '      mode = startMetadata.mode;');
  requireOrdered(hostTransfer, furinHostPath, [
    'handoff.onClaimTransferred(',
    'FURIN_ENTRY_SYNCHRONOUS_CLAIM_TRANSFER_REQUIRED',
    'transfer !== true',
    'FURIN_ENTRY_CLAIM_TRANSFER_UNCONFIRMED',
    'boundaryOwnsAdoptedLease = false',
  ], 'Host cannot own composite lease release before synchronous true cleanup confirmation');
  requireExcludes(manager, managerPath, [
    'advanceEnsoCadence(', 'resetEnsoCadence(', 'budgetRatio =',
    'siteGoals[', 'chrome.storage', 'localStorage', 'FurinDailyReceiptRepository',
  ]);
  const furinEntryPath = 'src/domains/nudge/runtime/furinEntryBoundary.js';
  const furinEntry = await readUtf8(furinEntryPath);
  requireIncludes(furinEntry, furinEntryPath, [
    'classifyFurinEntrySurface', 'classifyFurinEntryAction',
    'FeedSurfaceRegistry', 'isEnsoGateEligibleClickBoundary',
    'resolveClickIntentGateTarget', 'primary_media_boundary_unproven',
    'FURIN_ENTRY_MEDIA_INVENTORY_REQUIRED', 'FURIN_ENTRY_MEDIA_INVENTORY_UNOBSERVED',
    'evidence.getMediaSnapshot()',
    "FEED_REQUIRED: 'feed_required'", "ACTION_BOUNDARY: 'action_boundary'",
    "event.isTrusted !== true", 'event.target.isConnected !== true',
    'evidence.consumePreparedPermit(', 'FURIN_ENTRY_SYNCHRONOUS_PERMIT_REQUIRED',
  ]);
  requireExcludes(furinEntry, furinEntryPath, [
    'setTimeout(', 'setInterval(', 'chrome.storage', 'localStorage',
    'playingCount === 0', 'addEventListener(', 'interventionAdmissionClient.prepare(',
    'collectTabMediaElements', 'collectTabAudioElements',
  ]);
  const entrySeamPath = 'src/domains/nudge/runtime/nudgeEntrySeamGate.js';
  const entrySeam = await readUtf8(entrySeamPath);
  requireIncludes(entrySeam, entrySeamPath, [
    'classifyFurinEntryAction(event, readBoundaryEvidence())',
    'boundaryProof: proof', 'entry_idle_expired', 'entry_cap_expired',
    'FURIN_ENTRY_SURFACE_MODES.ACTION_BOUNDARY',
  ]);
  requireExcludes(entrySeam, entrySeamPath, [
    'handleMediaBoundary', 'GLOBAL_MEDIA_EVENTS', 'KEY_BOUNDARY_SET',
    'isInteractiveBoundaryTarget', 'settle(SENTINEL_ENTRY_SEAM_COMMITS.IDLE)',
    'settle(SENTINEL_ENTRY_SEAM_COMMITS.CAP)',
  ]);
  requireExcludes(manager, managerPath, [
    "from '../behavior/index.js'",
    'getReadout: () =>',
    'forceEnsoGateForDebug',
    'INFINITE_SCROLL_MANAGER',
  ]);
  requireIncludes(surfaceEntryGrace, surfaceEntryGracePath, [
    'ENSO_FEED_SURFACE_ENTRY_GRACE_MS = 2 * 60 * 1000',
    'resolveEnsoFeedSemanticSurfaceId',
    'class EnsoFeedSurfaceEntryGrace',
    'semanticSurfaceId',
    "reason: snapshot.remainingMs > 0 ? 'surface_entry_grace_active' : 'available'",
  ]);
  requireExcludes(surfaceEntryGrace, surfaceEntryGracePath, [
    'window.location',
    '.pathname',
    'semanticSurfaceKey',
    'EnsoSpawnPolicy',
  ]);
  requireIncludes(admission, admissionPath, [
    'resolveEnsoFeedEpisodeAdmission',
    'feedDecision?.cadence?.eligible !== true',
    "source: 'enso_consumption_cadence'",
    'feedDecision?.opportunityReady !== true',
    "feedDecision?.state !== 'interrupt'",
    'feed_horizon_opportunity_pending',
    "readinessStatus !== 'ready'",
    "safetyStatus !== 'safe'",
    "capability === 'observe_only'",
    "spawnPolicyDecision?.source !== 'feed_horizon'",
    'spawnPolicyDecision?.allowed !== true',
    'surfaceEntryGraceDecision',
    'enso_feed_surface_entry_grace_active',
    "episodeKind: 'feed_horizon'",
  ]);
  requireExcludes(admission, admissionPath, [
    'directTriggers',
    'pressureSignals',
  ]);
  requireIncludes(interactionManager, interactionManagerPath, [
    "from './interaction/EnsoSpawnPolicy.js'",
    'syncEnsoSpawnPolicyFromEnsoGateState',
    'source: ENSO_SPAWN_SOURCES.CLICK_INTENT',
    'cadence: readinessSummary?.cadence ?? null',
    'ensoSpawnPolicy.commit(spawnPermit, { now })',
    "reportClickIntentGateInteractionFailure('enso_gate_prepare', error, { source }, diagnosticFeatureKey)",
    'acquireInteractionListenerLease(ownerId)',
    'releaseInteractionListenerLease(ownerId)',
    'applyClickDelay(value, config = {})',
    'applyEnsoGate(value, config = {}, protectionContext)',
    "setRootAttribute(ROOT_STATE_ATTRS.CLICK_DELAY, 'active')",
    "setRootAttribute(ROOT_STATE_ATTRS.ENSO_GATE, 'active')",
    'requestEnsoGate({',
    'spawnPermit = null,',
    "source !== 'feed_horizon'",
    'isEnsoFeedEpisodeAdmissionActive(admission)',
    "admission?.source !== 'enso_consumption_cadence'",
    "admission?.episodeKind !== 'feed_horizon'",
    'ENSO_RUNTIME_EPISODE_LISTENER_LEASE_REQUIRED',
    'ensoSpawnPolicy.inspectPermit(spawnPermit)',
    'replayEnabled: false',
    'onOutcome,',
    'cancelEnsoGateForSource(source',
  ]);
  requireExcludes(interactionManager, interactionManagerPath, [
    'applyClickIntentGate(',
    'removeClickIntentGate(',
    'acquireEnsoRuntimeListenerLease(',
    'releaseEnsoRuntimeListenerLease(',
    'syncEnsoSpawnPolicyFromClickIntentState',
    'sampleCommitPauseMs',
  ]);
  requireIncludes(interactionState, interactionStatePath, [
    'clickDelayMs: 0',
    'clickDelayDistribution: resolveClickDelayDistribution(0)',
    'ensoGateEnabled: false',
    'ensoGateConfig: null',
  ]);
  requireExcludes(interactionState, interactionStatePath, [
    'clickIntentGateDelayMs',
    'clickIntentGateDistribution',
    'clickIntentGateConfig',
  ]);
  requireIncludes(ensoSurface, ensoSurfacePath, [
    "FEED_ENSO_EPISODE_SURFACE_OWNER_ID = 'enso_feed_episode'",
    'claimEnsoFeedPreludeSurface',
    'ownerId: FEED_ENSO_EPISODE_SURFACE_OWNER_ID',
  ]);
  requireIncludes(controller, controllerPath, [
    "from './FeedTerminusStageMachine.js'",
    "from './HorizonContinueGesture.js'",
    '_handleForwardIntent(px, now, input)',
    'this._continueGesture.observe(input, now, {',
    'if (this._pull.isSatisfied(now)) this._continue(now);',
    "from '../actuation/FeedEndpointBoundaryResolver.js'",
    "from './FeedEndpointLease.js'",
    'getActuationContext,',
    'getAdmission,',
    'onHorizonEngaged,',
    'onEpisodeFailure,',
    'onContinueIntent,',
    "if (resolution?.status !== 'resolved' || !resolution.plan) return;",
    'this._endpointLease.commit(plan, {',
    'this._endpointLease.isBoundaryReached() && !this._horizonEngaged',
    "this._notifyEpisodeFailure('feed_endpoint_engage', error)",
    "this._notifyEpisodeFailure('terminus_frame', error)",
    'if (this._endpointLease.shouldCaptureForwardInput() !== true) return;',
    'this._endpointLease.applyBackwardIntent();',
    'resolveContinueIntent(action, { now = Date.now() } = {})',
    "normalizedAction === 'neutral'",
    "normalizedAction === 'leave' || normalizedAction === 'suppressed'",
    "normalizedAction !== 'enter'",
    "abortEpisode(finishedReason = 'enso_episode_aborted')",
    "this._retreat('enso_episode_aborted', { finishedReason })",
    '_confirmCanonicalTransition({',
    'if (!this._releaseEndpoint()) return false;',
    '_restoreEndpointAfterCanonicalFailure(phase, restoreState)',
  ]);
  requireExcludes(controller, controllerPath, [
    'FeedDemandJudge',
    'loopPressure',
    'getReadout',
    'requestEnsoGate',
    'suppressUntil(',
    '_continuePassMs',
    'continue_pass_active',
  ]);
  const continueGesturePath = 'src/domains/nudge/feed-flow/terminus/HorizonContinueGesture.js';
  const continueGesture = await readUtf8(continueGesturePath);
  requireExcludes(continueGesture, continueGesturePath, [
    'setTimeout(', 'setInterval(', 'requestAnimationFrame(',
    'requestEnsoGate', 'interventionAdmissionClient', 'chrome.storage',
  ]);
  requireIncludes(runtime, runtimePath, [
    "'enso_leave'",
    "'enso_suppressed'",
    "'enso_episode_aborted'",
  ]);
  const stageMachinePath = 'src/domains/nudge/feed-flow/terminus/FeedTerminusStageMachine.js';
  const stageMachine = await readUtf8(stageMachinePath);
  requireIncludes(stageMachine, stageMachinePath, [
    'evaluate({ feedDecision = null, admission = null } = {}, now = Date.now())',
    "admissionStatus !== 'admitted' || admission?.admitted !== true",
    "if (!readinessStatus) return 'missing'",
    "if (readinessStatus === 'ready') return 'ready'",
  ]);
  requireExcludes(stageMachine, stageMachinePath, [
    'decision?.learning',
    'delegated_to_actuation_safety',
    'suppressUntil(',
    'continue_pass_active',
  ]);
  requireIncludes(spawnPolicy, spawnPolicyPath, [
    "from '../runtime/interventionAdmissionClient.js'",
    'this._activeSources = new Set()',
    'this._sourcePolicies = new Map()',
    'existingSourcePolicy?.activatedAt ?? normalizedNow',
    'this._admissionRuntime.refreshEnsoCadence()',
    'this._activeSources.add(normalizedSource)',
    "reason: 'source_inactive'",
    "reason: 'episode_active'",
    'reserve({',
    'this._admissionRuntime.reserveEnso({',
    'commit(permit, { now = Date.now() } = {})',
    'this._admissionRuntime.present(episode.interventionLease',
    'release(permit)',
    'this._admissionRuntime.release(episode.interventionLease)',
    'this._admissionRuntime.abort(episode.interventionLease)',
    'committedNow: true',
  ]);
  requireIncludes(spawnSources, spawnSourcesPath, [
    "CLICK_INTENT: 'click_intent'",
    "FEED_HORIZON: 'feed_horizon'",
    'ENSO_SPAWN_SOURCE_SET',
  ]);
  requireIncludes(consumptionPatternClassifier, consumptionPatternClassifierPath, [
    'classifyInterventionConsumptionPattern({',
    "REWARD_WANDERING: 'reward_wandering'",
    "FEED_BINGE: 'feed_binge'",
    "AUDIBLE_MEDIA: 'audible_media'",
    "MIXED: 'mixed'",
    'BINGE_DETECTION_MAX_AGE_MS = 90_000',
    'value.validUntil',
    'weights: Object.freeze({',
  ]);
  requireIncludes(interventionRuntimeDev, interventionRuntimeDevPath, [
    'INTERVENTION_ADMISSION_RUNTIME_ENABLED = true',
    'createInterventionAdmissionRuntime(options = {})',
    'classifyInterventionConsumptionPattern',
    'latestBingeDetection',
    'latestMediaEvidence',
    'consumptionProfile.weights',
    'observeConsumptionEvidence:',
    'shadow.observe({',
    'getShadowSnapshot:',
    'subscribeShadow:',
    'reserveCandidate:',
    'reserveEnso:',
    'createEnsoInterventionCandidate',
  ]);
  requireIncludes(interventionShadow, interventionShadowPath, [
    'DEFAULT_INTERVENTION_SHADOW_EPOCH_MS = 160',
    'observe({',
    'actualAdmission',
    'reduceInterventionAdmission(',
    'createInterventionAdmissionState({ globalMinimumGapMs: 0 })',
    'collision: distinctKinds.size > 1',
    'agreement: comparable',
    "this._notify('epoch_completed')",
  ]);
  requireIncludes(interventionRuntimePublic, interventionRuntimePublicPath, [
    'INTERVENTION_ADMISSION_RUNTIME_ENABLED = false',
    'INTERVENTION_ADMISSION_BUILD_CAPABILITY_DISABLED',
    "reason: 'build_capability_disabled'",
    'observeConsumptionEvidence: rejectDisabledCapability',
    'getShadowSnapshot: rejectDisabledCapability',
  ]);
  requireExcludes(interventionRuntimePublic, interventionRuntimePublicPath, [
    'InterventionAdmissionArbiter',
    'InterventionAdmissionShadow',
    'interventionAdmissionKernel',
    'ensoInterventionCandidate',
  ]);
  requireIncludes(releaseCapabilities, releaseCapabilitiesPath, [
    'BUILD_ENABLE_SHARED_INTERVENTION_ADMISSION',
    'enableSharedInterventionAdmission: BUILD_ENABLE_SHARED_INTERVENTION_ADMISSION',
  ]);
  requireIncludes(viteConfig, viteConfigPath, [
    "resolveExplicitDevCapability('ENTROPY_ENABLE_SHARED_INTERVENTION_ADMISSION')",
    'enableSharedInterventionAdmission,',
    '__ENTROPY_BUILD_ENABLE_SHARED_INTERVENTION_ADMISSION__',
    "'@intervention-admission-runtime': interventionAdmissionRuntimeModulePath",
    'interventionAdmissionRuntime.dev.js',
    'interventionAdmissionRuntime.public.js',
  ]);
  requireExcludes(viteConfig, viteConfigPath, [
    'enableSharedInterventionAdmission: includeDevExperiments',
  ]);
  requireIncludes(publicBuildGuard, publicBuildGuardPath, [
    'developmentOnlyInterventionModuleFragments',
    'src/domains/nudge/attention/consumptionPatternClassifier.js',
    'src/domains/nudge/runtime/InterventionAdmissionShadow.js',
    'checkNoDevelopmentOnlyInterventionArtifacts(moduleInventory)',
  ]);
  requireIncludes(interactionManager, interactionManagerPath, [
    'cadence: admission.cadence',
  ]);
  requireIncludes(manager, managerPath, [
    "this._abortEpisode('enso_boundary_withdrawn')",
    "reason: 'fresh_boundary_required'",
  ]);
  requireExcludes(manager, managerPath, [
    'firstGraceMs:',
    'ENSO_FEED_HORIZON_SOURCE_FIRST_GRACE_MS',
  ]);
  const retiredEnsoTimingOwners = [
    readiness,
    interactionState,
    interactionManager,
    controller,
    stageMachine,
  ].join('\n');
  requireExcludes(retiredEnsoTimingOwners, 'Enso timing non-owner modules', [
    'ensoGateLastTriggeredAt',
    'markEnsoGateTriggered',
  ]);
  requireExcludes(bridge, bridgePath, [
    'emitBehaviorEvent',
    'feedFlowPressure',
    'feedFlowInterrupt',
    'actuationContext',
    'activeScroller',
    'candidateItemSelectors',
  ]);
  requireIncludes(bridge, bridgePath, [
    'this._snapshotRevision = 0',
    'snapshotRevision,',
    'heartbeatIntervalMs',
    'this._lastBackgroundSnapshotPublishedAt',
  ]);
  requireIncludes(topologyProtocol, topologyProtocolPath, [
    "from '../actuation/feedEndpointAdapterCatalog.js'",
    "from '../../../protection/contracts/feedTopologyAuthorityContract.js'",
    'buildAuthorityIdentity(',
    'this._topologyEpoch += 1',
    "capability: canActuate ? selectedAdapter.capability : 'observe_only'",
    'normalizeFeedTopologyLocalCertificateEvidence(',
    'shippedTopologyHealth = null',
    'shipped_topology_live_verified',
    'dynamic_learning_shadow',
    'shipped_topology_live_verification_pending',
    'learnerStatus: learnerReadinessStatus',
    'shipped_topology_drift_locally_recovered',
  ]);
  requireIncludes(topologyContract, topologyContractPath, [
    "CANONICAL_LEARNING: 'canonical_learning'",
    "CANONICAL_VERIFIED: 'canonical_verified'",
    "DRIFT_SUSPECTED: 'drift_suspected'",
    "SHADOW_LEARNING: 'shadow_learning'",
    "LOCALLY_CERTIFIED: 'locally_certified'",
    "QUARANTINED: 'quarantined'",
    'isFeedTopologyActuationAuthorized',
    'FEED_SHIPPED_TOPOLOGY_HEALTH_STATUSES',
  ]);
  requireExcludes(topologyProtocol, topologyProtocolPath, [
    'FeedEndpointLease',
    'FeedTerminusController',
    'document.',
    'window.',
    'querySelector',
    'MutationObserver',
    '.style.',
    '.inert',
    'appendChild',
  ]);
  requireIncludes(shippedTopologyProbe, shippedTopologyProbePath, [
    'FEED_SHIPPED_TOPOLOGY_PROBE_CONTRACT',
    'inspectDeclaredFeedEndpointTopology(',
    "return this._result('mismatch'",
    "phase: 'shipped_health'",
  ]);
  requireIncludes(endpointTopologyInspection, endpointTopologyInspectionPath, [
    'export function inspectDeclaredFeedEndpointTopology(',
    'anchorBranchSelector',
    'laneSelector',
    'scrollerSelector',
    'containmentSelector',
    'scrollerScrollSnapAxis',
    'branchScrollSnapAlign',
    "status: 'mismatch'",
  ]);
  requireExcludes(
    `${shippedTopologyProbe}\n${endpointTopologyInspection}`,
    'read-only shipped topology inspection',
    [
      '.style.setProperty(',
      '.style.removeProperty(',
      '.inert =',
      '.appendChild(',
      '.after(',
      'indexedDB',
      'chrome.storage',
      'localStorage',
      'fetch(',
    ],
  );
  requireIncludes(readinessPresentation, readinessPresentationPath, [
    'presentFeedTopologyReadiness(',
    'isFeedTopologyActuationAuthorized(readiness)',
    "'학습 완료 · 작동 가능'",
    "'구조 변동 · 관찰 중'",
  ]);
  requireExcludes(readinessPresentation, readinessPresentationPath, [
    'document.',
    'window.',
    'querySelector',
    'MutationObserver',
  ]);
  requireIncludes(safety, safetyPath, [
    "from '../../../protection/contracts/feedTopologyAuthorityContract.js'",
    'isFeedTopologyActuationAuthorized(readiness)',
    'actuation_context_topology_epoch_mismatch',
    'readiness_capability_mismatch',
    'readiness_surface_mode_mismatch',
    'learned_surface_mode_mismatch',
    'actuation_context_surface_mode_mismatch',
    'actuation_context_profile_mismatch',
    'actuation_context_semantic_surface_mismatch',
    'connected_candidate_anchor_missing',
    'feed_endpoint_adapter_unavailable',
    'feed_topology_authority_confirmed',
  ]);
  requireExcludes(safety, safetyPath, [
    'feedEndpointAdapterCatalog',
    'resolveFeedEndpointAdapter',
  ]);
  requireIncludes(genericFeatures, genericFeaturesPath, [
    'GENERIC_FEED_ITEM_SELECTOR',
    'readGenericFeedItemFeatures',
    'getGenericFeedItemSiblingSimilarity',
    'hasGenericFeedItemMedia',
    'hasGenericFeedItemAction',
  ]);
  requireIncludes(genericClassifier, genericClassifierPath, [
    "from '../discovery/genericFeedItemFeatures.js'",
    "from '../discovery/feedItemBoundaries.js'",
    'isGenericFeedItemCandidate',
    'resolveFeedItemBoundaries(',
  ]);
  requireIncludes(genericDiscovery, genericDiscoveryPath, [
    "from './genericFeedItemFeatures.js'",
    "from './feedItemBoundaries.js'",
    'isGenericFeedItemCandidate',
    'resolveFeedItemBoundaries(',
    "from './feedItemContentIdentity.js'",
    'FEED_ITEM_DISCOVERY_MUTATIONS_REQUIRED',
    'observeMutations(',
    'needsRevalidation:',
    "'seed_incomplete'",
  ]);
  requireIncludes(advanceCoordinator, advanceCoordinatorPath, [
    '_genericDiscovery.observeMutations(payload)',
    'if (!supply.needsRevalidation)',
    'if (surfaceMode === FEED_SURFACE_MODES.CONTINUOUS) return null;',
  ]);
  requireExcludes(genericDiscovery, genericDiscoveryPath, ['querySelectorAll(', 'countFreshItems(']);
  const itemBoundariesPath = 'src/domains/nudge/feed-flow/discovery/feedItemBoundaries.js';
  const itemIdentityPath = 'src/domains/nudge/feed-flow/discovery/feedItemContentIdentity.js';
  const [itemBoundaries, itemIdentity] = await Promise.all([
    readUtf8(itemBoundariesPath), readUtf8(itemIdentityPath),
  ]);
  requireIncludes(itemBoundaries, itemBoundariesPath, [
    "from './genericFeedItemFeatures.js'", 'readGenericFeedItemFeatures(node)',
    'export function isGenericFeedItemCandidate(', 'export function resolveFeedItemBoundaries(',
  ]);
  requireIncludes(itemIdentity, itemIdentityPath, ['export function buildStableItemContentKey(']);
  requireExcludes(
    `${genericClassifier}\n${genericDiscovery}`,
    'generic feed candidate consumers',
    [
      'CARDISH_CLASS_PATTERN',
      'function getSiblingSimilarityScore',
      'function hasMedia(',
      'function hasRichMedia(',
      'features.textLength',
      'features.siblingSimilarity',
      'function looksLikeFeedItem(',
      'function looksLikeRepeatedItem(',
    ],
  );
  requireIncludes(endpointCatalog, endpointCatalogPath, [
    "adapterId: 'observe_only'",
    "adapterId: 'x_home_timeline_tail'",
    "topologyId: 'x_home_virtual_timeline_lane'",
    "adapterId: 'instagram_home_feed_tail'",
    "topologyId: 'instagram_home_article_lane'",
    "adapterId: 'facebook_home_feed_tail'",
    "topologyId: 'facebook_home_article_lane'",
    "adapterId: 'paged_in_place_tail'",
    "adapterId: 'instagram_reels_snap_tail'",
    "topologyId: 'instagram_reels_snap_lane'",
    "'main[role=\"main\"] > [role=\"toolbar\"] > [role=\"button\"]:nth-child(2):last-child'",
    'controlKind: FEED_ENDPOINT_FORWARD_CONTROL_KINDS.ARIA_BUTTON',
    "adapterId: 'youtube_shorts_sequence_tail'",
    "topologyId: 'youtube_shorts_sequence_lane'",
    "selector: 'ytd-shorts #navigation-button-down button'",
    'controlKind: FEED_ENDPOINT_FORWARD_CONTROL_KINDS.NATIVE_BUTTON',
    'policy: FEED_ENDPOINT_FORWARD_CONTROL_POLICIES.NATIVE_DISABLED_DIMMED',
    "adapterId: 'youtube_home_rich_grid_tail'",
    "adapterId: 'locally_certified_continuous_tail_v1'",
    "adapterId: 'locally_certified_paged_tail_v1'",
    'buildLocallyCertifiedFeedTopologyId(',
    'resolveLocallyCertifiedFeedEndpointAdapter({',
    "topologyId: 'youtube_home_rich_grid_lane'",
    "boundaryBasis: 'anchor_branch_edge'",
    "boundaryBasis: 'completed_wrap_row_edge'",
    "boundaryBasis: 'next_containment_start'",
    "scrollerScrollSnapAxis: 'y'",
    "branchScrollSnapAlign: 'start'",
    "mutationMode: 'sibling_inert_isolation'",
    "isolationLayout: 'collapse'",
    "isolationLayout: 'preserve'",
    "tailLayout: 'flow'",
    "tailLayout: 'absolute_anchor_edge'",
    "tailLayout: 'wrapped_row_flow'",
    "const SEMANTIC_SURFACE_ADAPTERS = Object.freeze({",
    "'x:home': createSemanticSurfaceAdapter(",
    "'instagram:home': createSemanticSurfaceAdapter(",
    "'instagram:reels': createSemanticSurfaceAdapter(",
    "'facebook:home': createSemanticSurfaceAdapter(",
    "'tiktok:feed': createSemanticSurfaceAdapter(",
    "'youtube:shorts': createSemanticSurfaceAdapter(",
    "'youtube:home': createSemanticSurfaceAdapter(",
    'entry.profileId !== normalizedProfileId',
    'entry.surfaceMode !== normalizedSurfaceMode',
    'return OBSERVE_ONLY_ADAPTER',
  ]);
  requireIncludes(endpointResolver, endpointResolverPath, [
    "from './feedEndpointAdapterCatalog.js'",
    "from '../../../protection/contracts/feedTopologyAuthorityContract.js'",
    "from '../terminus/feedEndpointBoundaryMotionProfile.js'",
    "from '../terminus/feedEndpointTailPaintProfile.js'",
    "from '../contracts/feedEndpointPlanContract.js'",
    'resolveAuthorizedAdapter({',
    'feed_topology_authority_catalog_mismatch',
    'feed_topology_local_live_proof_mismatch',
    'topologyContractVersion: authority.contractVersion',
    'topologyEpoch: authority.topologyEpoch',
    'context.activeScroller || findScrollableAncestor(',
    'inspectDeclaredFeedEndpointTopology(',
    'BOUNDARY_BASIS_ANCHOR_BRANCH_EDGE',
    'BOUNDARY_BASIS_COMPLETED_WRAP_ROW_EDGE',
    'BOUNDARY_BASIS_NEXT_CONTAINMENT_START',
    'TAIL_LAYOUT_WRAPPED_ROW_FLOW',
    'containmentSelector',
    'boundaryBasis',
    'collectFollowingNodes(',
    'resolveForwardControl(adapter, this._document)',
    "reason: 'feed_endpoint_forward_control_topology_mismatch'",
    "reasons: ['feed_endpoint_future_supply_missing']",
    "reasons: ['feed_endpoint_geometry_warming']",
    "status: 'resolved'",
    'mutationMode: adapter.mutationMode',
    'isolationLayout: adapter.isolationLayout || null',
    'tailLayout: adapter.tailLayout',
    'tailTopPx: geometry.tailTopPx',
    'laneFlexWrap',
    'completedWrapRowItemCount',
    'completedWrapRowTrailingSpacePx',
    'resolveFeedEndpointBoundaryMotionProfile({',
    'resolveFeedEndpointTailPaintProfile({',
    'const motionEndpointEdge = boundaryEdge',
    'motionEndpointEdge - restEdgePosition + boundaryMotionProfile.revealPx',
    'motionEndpointEdge',
    'supplyBoundaryTravelPx',
    'boundaryMotionProfile,',
    'tailPaintProfile,',
  ]);
  requireIncludes(endpointPlanContract, endpointPlanContractPath, [
    "NATIVE_BUTTON: 'native_button'",
    "ARIA_BUTTON: 'aria_button'",
    "NATIVE_DISABLED_DIMMED: 'native_disabled_dimmed'",
    'validateFeedEndpointForwardControlDefinition(definition)',
    'validateFeedEndpointForwardControlContract(',
    'validateFeedEndpointSurfacePlanContract(plan)',
    'boundaryMotionProfile.capability !== plan.capability',
    'boundaryMotionProfile.surfaceMode !== plan.surfaceMode',
    'tailPaintProfile.surfaceMode !== plan.surfaceMode',
    'FEED_ENDPOINT_SURFACE_PROFILE_MISMATCH',
    'FEED_ENDPOINT_TAIL_HEIGHT_INVALID',
    'FEED_ENDPOINT_OPAQUE_PAINT_REQUIRED',
  ]);
  requireIncludes(boundaryMotionProfile, boundaryMotionProfilePath, [
    "restEdge: 'viewport_end'",
    "endpointEdge: 'tail_start'",
    "elasticMode: 'elastic_tail'",
    "profile.restEdge !== 'viewport_end'",
    "profile.endpointEdge !== 'tail_start'",
    "elasticMode: 'terminal_snap'",
    'validateFeedEndpointBoundaryMotionProfile',
  ]);
  requireIncludes(tailPaintProfile, tailPaintProfilePath, [
    "FEED_ENDPOINT_TAIL_PAINT_PROFILE_VERSION =",
    "INHERITED_OPAQUE: 'inherited_opaque'",
    "TRANSPARENT_NATIVE_BLEED: 'transparent_native_bleed'",
    'resolveFeedEndpointTailPaintProfile({',
    'validateFeedEndpointTailPaintProfile(profile)',
    'FEED_ENDPOINT_TAIL_PAINT_PROFILE_UNSUPPORTED',
    'FEED_ENDPOINT_TAIL_PAINT_PROFILE_INVALID',
  ]);
  requireIncludes(boundaryMotion, boundaryMotionPath, [
    'export class FeedEndpointBoundaryMotion',
    'function isElasticProfile(profile)',
    'function isPagedTerminalProfile(profile)',
    'const FRAME_WATCHDOG_MS = 64;',
    'const MAX_SETTLE_CATCH_UP_MS = 1_000;',
    'const POSITION_EPSILON_PX = 1;',
    'const REST_TOLERANCE_PX = 1;',
    'restTolerancePx: REST_TOLERANCE_PX,',
    'observedDisplacementPx,',
    'velocityPxPerSecond: this._velocityPxPerSecond,',
    'lastForwardInputPx: this._lastForwardInputPx,',
    'forwardInputCount: this._forwardInputCount,',
    'lastInputAgeMs: Math.max(0, capturedAt - this._lastInputAt),',
    'lastFrameAgeMs: Math.max(0, capturedAt - this._lastFrameAt),',
    'handle.watchdogId = setTimeout(run, FRAME_WATCHDOG_MS);',
    'if (handle.settled) return;',
    'synchronize(ts = this._readNow()) {',
    'this._advanceSettleFrame(now);',
    '_isOwnedWrite(position) {',
    'const ownedSettleWrite = (',
    'if (ownedSettleWrite) return true;',
    'Math.abs(position - this._lastOwnedPosition) <= POSITION_EPSILON_PX',
    'if (this._displacementPx <= REST_TOLERANCE_PX) {',
    'let remainingSeconds = elapsedMs / 1000;',
    'const dt = Math.min(remainingSeconds, MAX_FRAME_MS / 1000);',
    'validateFeedEndpointBoundaryMotionProfile(profile)',
    'applyForwardIntent(deltaPx, ts = this._readNow(), input)',
    'reconcileEndpointEdge({',
    'const nextBoundaryPosition = current + (endpointEdge - restEdge)',
    'reconcileExternalPosition(rawPosition = this._readPosition()',
    'shouldCaptureForwardInput() {',
    'if (!isPagedTerminalProfile(this._profile)) return true;',
    'return this._readPosition() >= this._inputCapturePosition - POSITION_EPSILON_PX;',
    'prepareBackwardInput() {',
    'this._restorePagedSnapStyle();',
    'this._profile.maximumDisplacementPx',
    'this._writePosition(this._boundaryPosition)',
    'this._cancelSettleFrame()',
    "this._scroller.style.setProperty('scroll-snap-type', 'none', 'important')",
    'this._restorePagedSnapStyle()',
  ]);
  requireExcludes(boundaryMotion, boundaryMotionPath, [
    '.setAttribute(',
    '.appendChild(',
    'position: fixed',
    'transform:',
  ]);
  requireIncludes(forwardControlLease, forwardControlLeasePath, [
    'export class FeedEndpointForwardControlLease',
    'validateFeedEndpointForwardControlContract(contract, this._document)',
    'FEED_ENDPOINT_FORWARD_CONTROL_KINDS.NATIVE_BUTTON',
    'FEED_ENDPOINT_FORWARD_CONTROL_KINDS.ARIA_BUTTON',
    'FEED_ENDPOINT_FORWARD_CONTROL_POLICIES.NATIVE_DISABLED_DIMMED',
    "'pointerdown'",
    "'keydown'",
    "this._element.setAttribute('tabindex', '-1')",
    "this._element.setAttribute('aria-disabled', 'true')",
    "this._element.style.setProperty('opacity', '0.42', 'important')",
    'event?.stopImmediatePropagation?.();',
    'this._restore();',
  ]);
  requireExcludes(forwardControlLease, forwardControlLeasePath, [
    'querySelector',
    'MutationObserver',
    'position: fixed',
    'appendChild(',
  ]);
  requireIncludes(endpointLease, endpointLeasePath, [
    "from '../../../protection/contracts/feedTopologyAuthorityContract.js'",
    "from './FeedEndpointBoundaryMotion.js'",
    "from './FeedEndpointForwardControlLease.js'",
    "from './feedEndpointTailPaintProfile.js'",
    "from '../contracts/feedEndpointPlanContract.js'",
    "const MARKER_ID = 'entropy-feed-endpoint-marker'",
    "const TAIL_ID = 'entropy-feed-endpoint-tail'",
    "const QUARANTINE_ID = 'entropy-feed-endpoint-quarantine'",
    "const ENDPOINT_OWNERSHIP_PROPERTY = '__entropyFeedEndpointOwnershipV1'",
    "const SIBLING_INERT_ISOLATION_MODE = 'sibling_inert_isolation'",
    "const PRESERVE_ISOLATION_LAYOUT = 'preserve'",
    "const FLOW_TAIL_LAYOUT = 'flow'",
    "const ABSOLUTE_ANCHOR_EDGE_TAIL_LAYOUT = 'absolute_anchor_edge'",
    "const WRAPPED_ROW_FLOW_TAIL_LAYOUT = 'wrapped_row_flow'",
    'SUPPORTED_MUTATION_MODES.has(plan.mutationMode)',
    'SUPPORTED_ISOLATION_LAYOUTS.has(plan.isolationLayout)',
    'SUPPORTED_TAIL_LAYOUTS.has(plan.tailLayout)',
    'plan.topologyContractVersion !== FEED_TOPOLOGY_AUTHORITY_VERSION',
    'FEED_ENDPOINT_TOPOLOGY_AUTHORITY_PAIR_UNAUTHORIZED',
    'FEED_ENDPOINT_TOPOLOGY_EPOCH_INVALID',
    'FEED_ENDPOINT_LOCAL_TOPOLOGY_CERTIFICATE_INVALID',
    "this._invalidate('feed_topology_local_certificate_expired')",
    'tail.dataset.entropyFeedEndpointTailLayout = plan.tailLayout',
    'tail.dataset.entropyFeedEndpointSemanticSurface = plan.semanticSurfaceId',
    'tail.dataset.entropyFeedEndpointBoundaryBasis = plan.boundaryBasis',
    'tail.dataset.entropyFeedEndpointCompletedWrapRowItemCount',
    'tail.dataset.entropyFeedEndpointMotion = plan.boundaryMotionProfile.mode',
    'tail.dataset.entropyFeedEndpointEdge = plan.boundaryMotionProfile.endpointEdge',
    'tail.dataset.entropyFeedEndpointTailPaint = plan.tailPaintProfile.mode',
    'validateFeedEndpointSurfacePlanContract(plan)',
    'validateFeedEndpointForwardControlContract(',
    "FEED_ENDPOINT_TAIL_PAINT_MODES.TRANSPARENT_NATIVE_BLEED",
    "tail.style.setProperty('background-color', tailBackground, 'important')",
    'const tailHeightPx = plan.tailHeightPx;',
    'this._boundaryMotion.engage({',
    'shouldCaptureForwardInput() {',
    'this._boundaryMotion.shouldCaptureForwardInput()',
    'applyBackwardIntent() {',
    'this._boundaryMotion.prepareBackwardInput()',
    'this._boundaryMotion.applyForwardIntent(deltaPx, ts, input)',
    'const endpointRect = this._tail.getBoundingClientRect()',
    'restEdgePosition: restEdgePosition - profile.revealPx',
    'this._boundaryMotion.reconcileEndpointEdge({',
    'if (this._boundaryReached) this._reconcileBoundaryGeometry();',
    "this._invalidate('feed_endpoint_boundary_geometry_reconcile_failed'",
    'this._boundaryMotion.reconcileExternalPosition();',
    'this._syncForwardControlState();',
    'this._forwardControlLease.setTerminal(',
    "this._invalidate('feed_endpoint_forward_drift_restore_failed'",
    "tail.style.setProperty('flex', '0 0 100%', 'important')",
    'restoreOwnedEndpoint(this._ownership, this._document)',
    'FEED_ENDPOINT_TRACKED_NODE_OWNERSHIP_LOST',
    'FEED_ENDPOINT_ISOLATION_METADATA_INCOMPLETE',
    'FEED_ENDPOINT_ISOLATION_LAYOUT_MISMATCH',
    "node.style.setProperty('visibility', 'hidden', 'important')",
    'matchesPlanContainment(',
    'FEED_ENDPOINT_CONTAINMENT_ANCHOR_MISMATCH',
    'allowInterleaved = false',
    'this._plan.anchorBranch.nextSibling === this._marker',
    'this._marker.nextSibling === this._tail',
    'this._tail.nextSibling === this._quarantine',
    'this._containFollowingNodes();',
    'this._isolateFollowingNodes();',
    "debugLabel: 'FeedEndpointLease.observer'",
    'this._orchestrator.engageForwardBoundary({',
    "onForwardInput: (deltaPx, ts) => this.applyForwardIntent(deltaPx, ts, { kind: 'wheel' })",
    'onBackwardInput: () => this.applyBackwardIntent()',
    'this._orchestrator.releaseForwardBoundary();',
  ]);
  requireExcludes(endpointLease, endpointLeasePath, ['new MutationObserver(']);
  const feedFlowSourceFiles = await collectSourceFiles('src/domains/nudge/feed-flow');
  const feedDomMutationOwners = new Set([
    boundaryMotionPath,
    forwardControlLeasePath,
    endpointLeasePath,
    terminusSurfacePath,
  ]);
  const siteDomMutationMarkers = [
    '.style.setProperty(',
    '.style.removeProperty(',
    '.inert =',
    ".setAttribute('aria-hidden'",
    '.appendChild(',
    '.after(',
  ];
  for (const sourcePath of feedFlowSourceFiles) {
    if (feedDomMutationOwners.has(sourcePath)) continue;
    const source = await readUtf8(sourcePath);
    requireExcludes(
      source,
      sourcePath,
      siteDomMutationMarkers,
    );
    requireExcludes(source, sourcePath, [
      'settings/config/infiniteScrollGuard.js',
    ]);
  }
  const [
    runtimeConfig,
    guardSetting,
    envelopeAdapter,
    chromiumHarness,
  ] = await Promise.all([
    readUtf8(runtimeConfigPath),
    readUtf8(guardSettingPath),
    readUtf8(envelopeAdapterPath),
    readUtf8(chromiumHarnessPath),
  ]);
  requireIncludes(runtimeConfig, runtimeConfigPath, [
    "ENSO_FEED_HORIZON_RUNTIME_CONFIG_VERSION =",
    "'enso-feed-horizon-runtime-config-v4'",
    'requireEnsoFeedHorizonRuntimeConfig(value)',
    'buildEnsoFeedHorizonRuntimeConfig({',
    'Object.values(ENSO_INTERVAL_PRESETS).includes(value.intervalMs)',
    "'contractVersion'",
    "'intervalMs'",
    "'sensing'",
    "'inhibitors'",
    'ENSO_FEED_CONFIG_SHAPE_INVALID',
    'ENSO_FEED_CONFIG_VERSION_INVALID',
    'ENSO_FEED_INTERVAL_INVALID',
    'ENSO_FEED_INHIBITOR_INVALID',
  ]);
  requireExcludes(runtimeConfig, runtimeConfigPath, [
    ...retiredRuntimeConfigOwners,
    'ForLevel', 'continuePassMs', 'relapseWindowMs', 'tauMs', 'dose',
    "'episode'", "'seam'", 'idleResetMs', 'minFreshItems',
  ]);
  requireIncludes(runtime, runtimePath, [
    "from './config/ensoFeedHorizonRuntimeConfig.js'",
    'requireEnsoFeedHorizonRuntimeConfig(runtimeConfig)',
    "observationKind: 'advance'",
    "observationKind: 'supply'",
    'consumeOpportunity({',
    'this._judge.releaseOpportunity({ preserveCadence: true })',
    "'feed_horizon_opportunity_consumed'",
  ]);
  requireExcludes(runtime, runtimePath, [
    '_latchedInterruptDecision',
    'candidateCooldownMs',
    'this._burstMachine.markInterrupt',
  ]);
  requireIncludes(manager, managerPath, [
    "from './config/ensoFeedHorizonRuntimeConfig.js'",
    'setFeedHorizonRuntimeConfig(runtimeConfig)',
    'requireEnsoFeedHorizonRuntimeConfig(runtimeConfig)',
  ]);
  requireExcludes(manager, managerPath, [
    'settings/config/infiniteScrollGuard.js',
  ]);
  requireIncludes(guardSetting, guardSettingPath, [
    'normalizeInfiniteScrollGuardValue(rawValue)',
    'Enso Feed Horizon runtime tuning is intentionally owned by',
  ]);
  requireExcludes(guardSetting, guardSettingPath, retiredRuntimeConfigOwners);
  requireIncludes(envelopeAdapter, envelopeAdapterPath, [
    "from '../../../nudge/feed-flow/config/ensoFeedHorizonRuntimeConfig.js'",
    'buildEnsoFeedHorizonRuntimeConfig({',
    'resolveEnsoIntervalMs(',
    'deriveEnsoFeedHorizonControllerFilter(',
  ]);
  requireIncludes(feedHorizonInspection, feedHorizonInspectionPath, [
    'resolvePendingEndpointDecision(canonicalDecision, {',
    'if (!this.isActive() || endpointCommitted) return canonicalDecision;',
    'this._pendingEndpointDecision = Object.freeze({',
    "decision: 'inspection_forced'",
    'requestEnsoGateCalled: false',
  ]);
  requireExcludes(feedHorizonInspection, feedHorizonInspectionPath, [
    'requestEnsoGate(',
  ]);
  requireIncludes(feedHorizonQaCatalog, feedHorizonQaCatalogPath, [
    "from '../qa/catalog/qaTargetRegistry.mjs'",
    "from '../qa/contracts/qaTargetContract.mjs'",
    'export const FEED_HORIZON_QA_MODES = QA_MODES;',
    "'instagram-reels'",
    "'youtube-shorts'",
    "'instagram-home'",
    "'youtube-home'",
    'resolveFeedHorizonQaPreset(value)',
    'getQaTarget(qaTargetId)',
  ]);
  requireIncludes(feedHorizonQa, feedHorizonQaPath, [
    "from '../qa/entropyQa.mjs'",
    'runQaTarget({',
    'targetId: preset.qaTargetId',
    'mode: options.mode',
    "'hold-ms': options.holdMs",
    "'dwell-ms': options.dwellMs",
    'rebuild: options.rebuild',
  ]);
  requireExcludes(feedHorizonQa, feedHorizonQaPath, [
    "'--operator-driven'",
    "'warmup'",
    "'rearm'",
    "'status'",
    'requestEnsoGate(',
    'preflightFeedHorizonQaBrowser',
    'inspectFeedHorizonQaArtifact',
    'normalizeChromiumHarnessCdpEndpoint',
    'feedHorizonInspectionE2E.mjs',
    "from 'node:child_process'",
  ]);
  const qaTargetRegistryPath = 'scripts/qa/catalog/qaTargetRegistry.mjs';
  const feedHorizonQaProtocolPath = 'scripts/qa/protocols/feedHorizonQaProtocol.mjs';
  const qaBrowserLeasePath = 'scripts/qa/resources/QaBrowserLease.mjs';
  const [
    qaTargetRegistry,
    feedHorizonQaProtocol,
    qaBrowserLease,
  ] = await Promise.all([
    readUtf8(qaTargetRegistryPath),
    readUtf8(feedHorizonQaProtocolPath),
    readUtf8(qaBrowserLeasePath),
  ]);
  requireIncludes(qaTargetRegistry, qaTargetRegistryPath, [
    "'feed/tiktok'",
    "'feed/youtube-shorts'",
    "'feed/instagram-reels'",
    "'feed/x-home'",
    "'feed/instagram-home'",
    "'feed/facebook-home'",
    "'feed/youtube-home'",
    'supportedModes: [QA_MODES.HUMAN, QA_MODES.AGENT]',
    "environmentId: 'authenticated'",
    "artifactId: 'dev_extension'",
    "resourceClaims: ['runtime:feed-horizon']",
  ]);
  requireIncludes(feedHorizonQaProtocol, feedHorizonQaProtocolPath, [
    "artifact?.id !== 'dev_extension'",
    "browser?.processOwnership !== 'attach_only'",
    'feedHorizonInspectionE2E.mjs',
    '`--mode=${plan.mode}`',
    '`--site=${plan.protocolOptions.siteId}`',
    '`--cdp-endpoint=${browser.cdpEndpoint}`',
    "'--no-build'",
    "completionEvidence?.productionGateCount !== 0",
    "completionEvidence?.finalPhase !== 'enso_would_open'",
    'browserProcessPreserved: true',
  ]);
  requireExcludes(feedHorizonQaProtocol, feedHorizonQaProtocolPath, [
    'requestEnsoGate(',
    'Browser.close',
    'Target.activateTarget',
  ]);
  requireIncludes(qaBrowserLease, qaBrowserLeasePath, [
    "processOwnership === 'attach_only'",
    "cleanupPolicy: effectiveEnvironment.processOwnership === 'attach_only'",
    "? 'preserve_process'",
    "? 'detached_only'",
  ]);
  requireExcludes(qaBrowserLease, qaBrowserLeasePath, [
    'Browser.close',
  ]);
  requireIncludes(feedHorizonInspectionRunner, feedHorizonInspectionRunnerPath, [
    'async function driveInspectionEndpointCommit({',
    'resolveInspectionEndpointCommitDrivePolicy(scenario)',
    'ENDPOINT_COMMIT_DRIVE_POLICY_BY_SURFACE_MODE',
    'maximumSteps: 32',
    'runTrustedEndpointForwardStep({',
    "phase: 'boundary'",
    'actionOffset: endpointCommit.actions.length',
    'commitActionCount: endpointCommit.actions.length',
    "'--cdp-endpoint='",
    'normalizeChromiumHarnessCdpEndpoint(',
    'FEED_HORIZON_INSPECTION_ATTACH_PRESENTATION_OPTION_FORBIDDEN',
    "browserProcessPolicy: options.cdpEndpoint",
    "? 'attach_only_preserve_browser'",
    'active: options.cdpEndpoint ? false : true',
    'cdpEndpoint: options.cdpEndpoint',
    'classifyInspectionPreflightState(summary, scenario)',
    'FEED_HORIZON_INSPECTION_PREFLIGHT_BLOCKED',
    'isInspectionBoundaryMotionAtRest(feedFlow)',
    'motion.settling === false',
    'displacementPx <= restTolerancePx',
    'FEED_HORIZON_INSPECTION_FEEDBACK_BOUNDARY_MOTION_SETTLE_TIMEOUT',
    'const INSPECTION_RENEWED_DEMAND_POLICY = Object.freeze({',
    'actionsPerBurst:',
    'maximumActions:',
    'actionDwellMs:',
    'feedbackObservationMs:',
    'feedbackPollMs:',
    'async function runHumanInspectionLifecycle({',
    "status: 'READY_FOR_HUMAN'",
    "preparationMode: 'human_input'",
    'syntheticInputCount: 0',
    "endpoint.leaseState !== 'idle'",
    "status: 'AGENT_CANARY_COMPLETE'",
  ]);
  requireExcludes(feedHorizonInspectionRunner, feedHorizonInspectionRunnerPath, [
    'Target.activateTarget',
    'focusWindow: true',
    'Browser.close',
    'launchChrome(',
    'syntheticPreparation',
  ]);
  requireIncludes(chromiumHarness, chromiumHarnessPath, [
    'normalizeChromiumHarnessCdpEndpoint(value)',
    'createChromeAttachSpec({',
    'resolveAttachedHarnessExtension(cdp, extensionPath)',
    "installMode: 'attached_existing'",
    'this.attachOnly = this.cdpEndpoint !== null',
    'allowLocked: this.attachOnly',
    'background: this.attachOnly',
    'if (this.attachOnly) return [];',
    'CHROMIUM_HARNESS_ATTACH_ACTIVE_TAB_FORBIDDEN',
    'enableNoFocusPageExecution(page)',
    'activateOwnedPageWithoutWindowFocus(page)',
    'Emulation.setFocusEmulationEnabled',
    'Page.setWebLifecycleState',
    'windowFocusRequested: false',
    'CHROMIUM_HARNESS_NO_FOCUS_EXECUTION_NOT_CONFIRMED',
    'const browserCloseRequested = !!this.cdp',
    '&& this.ownedBrowserIdentityVerified;',
    'if (!this.attachOnly) {',
  ]);
  requireIncludes(terminusSurface, terminusSurfacePath, [
    'surfaceMode = null,',
    "if (!['continuous', 'paged'].includes(surfaceMode))",
    'host.dataset.surfaceMode = surfaceMode',
    ':host([data-surface-mode="continuous"]) .end-face',
    'mountTarget.appendChild(host)',
    "shell.setAttribute('aria-hidden', 'true')",
    "status.setAttribute('role', 'status')",
    'className = \'horizon-mark\'',
    'getHostElement() {',
  ]);
  requireExcludes(terminusSurface, terminusSurfacePath, [
    'position: fixed',
    'class="veil"',
    'documentElement.appendChild(host)',
    'body.appendChild(host)',
    'tRuntime(',
    'data-action',
    '<button',
    'aria-label',
  ]);
  requireIncludes(scrollOrchestrator, scrollOrchestratorPath, [
    "from '@runtime-contention-ledger'",
    "from './pagedScrollIntentActuator.js'",
    'createPagedScrollIntentActuator()',
    'this._applyPagedScrollIntent(',
    "recordProtectionFeatureEvent('scrollFriction', 'paged_scroll_intent_armed'",
    'isRuntimeContentionSessionActive()',
    'recordRuntimeOwnerWork({',
    "ownerId: 'scrollPagedIntent'",
    'recordRuntimeScrollFrame({',
    'shouldCaptureForwardInput = null,',
    'onBackwardInput = null,',
    'this._forwardBoundary.shouldCaptureForwardInput() !== true',
    "reportScrollFrictionFailure('forward_boundary_capture_gate'",
    'onForwardInput = null,',
    'releaseForwardBoundary() {',
    'if (this._forwardBoundary.onForwardInput)',
    'this._forwardBoundary.onForwardInput(deltaY, Date.now())',
    'this._forwardBoundary.onBackwardInput',
    'this._forwardBoundary.onBackwardInput(deltaY, Date.now())',
    'if (!this._forwardBoundary.onBackwardInput) return false;',
    'SCROLL_FORWARD_BOUNDARY_BACKWARD_PREPARE_REJECTED',
    'const passPx = Math.min(deltaY, remainingPx);',
    'const blockedPx = Math.max(0, deltaY - passPx);',
    'if (this._isForwardBoundaryActive() && this._applyForwardBoundary(event, startEl, deltaY))',
  ]);
  requireIncludes(pagedScrollIntent, pagedScrollIntentPath, [
    "from '../feed-flow/registry/feedSurfaceProfiles.js'",
    "id: 'paged-scroll-intent-v1'",
    'holdMs: 140',
    'commitLockMs: 360',
    'FEED_SEMANTIC_SURFACE_IDS.YOUTUBE_SHORTS',
    'export function resolvePagedScrollSnapDelta({',
    'session.holdTimer = schedule(() => commit(target, session), policy.holdMs);',
    'appliedDeltaY = Number(session.applyDelta(target, deltaY)) || 0;',
  ]);
  requireExcludes(pagedScrollIntent, pagedScrollIntentPath, [
    'requestAnimationFrame',
    'scheduler.yield',
    'applyFrostedStoneImpulse',
    'scrollIntoView',
  ]);
  const endpointActuationSources = [
    endpointCatalog,
    endpointResolver,
    endpointPlanContract,
    boundaryMotionProfile,
    tailPaintProfile,
    boundaryMotion,
    forwardControlLease,
    endpointLease,
    controller,
  ].join('\n');
  requireExcludes(endpointActuationSources, 'feed endpoint actuation modules', [
    'fetch(',
    'XMLHttpRequest',
    'navigator.serviceWorker',
    'chrome.webRequest',
    'browser.webRequest',
    'declarativeNetRequest',
  ]);
  requireIncludes(supplyProbe, supplyProbePath, [
    'key = `c${containerSeq}`;',
  ]);
  requireExcludes(supplyProbe, supplyProbePath, [
    'el.id',
    'el.className',
  ]);
  requireIncludes(rewardEvidence, rewardEvidencePath, [
    'projectRewardDriftEvidence',
    'advanceRewardDriftEvidence',
    'DEFAULT_SCORE_CAP_MULTIPLIER',
    'effectiveSampleMass',
    'confidenceMass',
    "lastReason: 'idle_reset'",
  ]);
  requireIncludes(feedBingeWindow, feedBingeWindowPath, [
    'class FeedBingeObservationWindow',
    'recordAdvance(event = {})',
    'recordSupplyReadout(readout = {}, { now = Date.now() } = {})',
    "source: 'enso_feed_observation_window'",
  ]);
  requireExcludes(feedBingeWindow, feedBingeWindowPath, [
    'directTriggers',
    'pressureSignals',
    'actuationSafety',
    'candidateState',
    'cooldownUntil',
  ]);
  requireIncludes(continuousAdapter, continuousAdapterPath, [
    '_pendingScreenfulDelta',
    '_accumulationIdleResetMs',
    'const confirmedSteps = Math.floor(',
    'this._resetPending();',
  ]);
  requireIncludes(feedBingeEvidence, feedBingeEvidencePath, [
    'projectFeedFlowBingeEvidence',
    'measurementConfidence',
    'repeatedObservationCertainty',
    'activityFreshness',
    'sustainedProgressionFloor',
    'supplyLift',
    'deliberateRelief',
  ]);
  requireExcludes(feedBingeEvidence, feedBingeEvidencePath, [
    'directTriggers',
    'pressureSignals',
    'actuationSafety',
    'candidateState',
  ]);
  requireIncludes(dopamineBingeDetector, dopamineBingeDetectorPath, [
    'resolveDopamineBingeDetection',
    'corroborationLift',
    'FEED_EVIDENCE_MAX_AGE_MS',
  ]);
  requireExcludes(dopamineBingeDetector, dopamineBingeDetectorPath, [
    'personalContext',
    'PERSONAL_LIFT_MAX',
    'bounded_personal_risk_lift',
  ]);
  requireExcludes(readiness, readinessPath, [
    'personalLift',
    'bingeDetection.personal',
    'state.clickDelay',
    'sampleClickPauseMs',
    'sampleClickDelayMs',
  ]);
  requireIncludes(readiness, readinessPath, [
    'const cadence = admissionClient.getEnsoCadence()',
    'isEnsoGateEligibleClickBoundary(boundary)',
    'cadence?.eligible !== true',
  ]);
  requireIncludes(snapshotBridge, snapshotBridgePath, [
    'normalizeSnapshotRevision',
    'assertInfiniteScrollTriggerInvariant',
    'assertSurfaceCapabilityInvariant',
    'snapshotRevision,',
  ]);
  requireIncludes(runtimeState, runtimeStatePath, [
    "from '../../../../domains/protection/background/runtime/FeedFlowRuntimeStateOwner.js'",
    'createFeedFlowRuntimeStateOwner({',
    'sourceLimit: feedFlowSourceLimit',
    'prepareFeedFlowSnapshot,',
    'commitFeedFlowSnapshot,',
  ]);
  requireExcludes(runtimeState, runtimeStatePath, [
    'const feedFlowSourceByTabId = new Map()',
    'const invalidFeedFlowDocumentIdsByTabId = new Map()',
    'PROTECTION_FEED_FLOW_',
    'normalizeFeedFlowSnapshot',
    'buildFeedFlowSource',
    '_commitToken',
  ]);
  requireIncludes(feedFlowRuntimeState, feedFlowRuntimeStatePath, [
    'const feedFlowSourceByTabId = new Map()',
    'const invalidFeedFlowDocumentIdsByTabId = new Map()',
    'PROTECTION_FEED_FLOW_SOURCE_DOCUMENT_ID_INVALID',
    'PROTECTION_FEED_FLOW_SOURCE_DOCUMENT_CHANGED',
    'PROTECTION_FEED_FLOW_SOURCE_HOST_CHANGED',
    'PROTECTION_FEED_FLOW_DUPLICATE_REVISION_CONFLICT',
    'PROTECTION_FEED_FLOW_SOURCE_CAPACITY_EXCEEDED',
    'previousDocumentId',
    'hasEquivalentFeedContentMetrics',
    'olderRevisionAtSameTime',
    'normalizedSnapshot.snapshotRevision === retainedOrder.snapshotRevision',
  ]);
  requireExcludes(feedFlowRuntimeState, feedFlowRuntimeStatePath, [
    'clearFeedFlowSnapshot({ hostname: normalizedHostname })',
    'buildFeedContentFlowDelta',
    'contentFlowDelta',
  ]);
  requireIncludes(runtimeInputProvider, runtimeInputProviderPath, [
    'if (source === null) return null',
    'tabId: source?.tabId',
    'documentId: source?.documentId',
  ]);
  requireIncludes(protectionDispatcher, protectionDispatcherPath, [
    'resolveFeedFlowRuntimeSource',
    'PROTECTION_FEED_FLOW_CONTENT_DOCUMENT_ID_REQUIRED',
    'feedFlowSource,',
  ]);
  requireIncludes(trackingSpecialRuntime, trackingSpecialRuntimePath, [
    'resolveSenderDocumentId',
    'resolveSenderFrameId',
    'INVALID_SENDER_DOCUMENT',
    'INVALID_SENDER_FRAME',
    'documentId,',
  ]);
  requireIncludes(behaviorTelemetryRecorder, behaviorTelemetryRecorderPath, [
    'BEHAVIOR_TELEMETRY_FEED_SOURCE_DOCUMENT_ID_INVALID',
    'requireFeedHistoryReceipt',
    'documentId: normalizedSource.documentId',
    'feedHistory,',
  ]);
  requireExcludes(runtimeInputAssembler, runtimeInputAssemblerPath, [
    'feedFlowDirectTriggers',
    'feedFlowPressureSignals',
    'mergeDirectTriggers(runtimeDirectTriggers, feedFlowSnapshot',
    'mergePressureSignals(feedFlowSnapshot',
  ]);
  requireExcludes(directTriggerResolver, directTriggerResolverPath, [
    'INFINITE_SCROLL_DETECTED',
    'infiniteScrollDetected',
  ]);
  requireExcludes(strategyOrchestrator, strategyOrchestratorPath, [
    'INFINITE_SCROLL_DETECTED',
    'LOOP_BREAKER',
  ]);
  requireExcludes(protectionContracts, protectionContractsPath, [
    "'INFINITE_SCROLL_DETECTED'",
  ]);
  const [feedBoundaryJudge, feedBoundaryState] = await Promise.all([
    readUtf8(feedBoundaryJudgePath),
    readUtf8(feedBoundaryStatePath),
  ]);
  requireIncludes(feedBoundaryJudge, feedBoundaryJudgePath, [
    "from '../config/ensoFeedHorizonRuntimeConfig.js'",
    'requireEnsoFeedHorizonRuntimeConfig(config)',
    'getCadence = () => admissionClient.getEnsoCadence()',
    'const cadence = this._getCadence()',
    'setGoalDemand(required)',
    'if (!this._goalDemand && !cadence?.eligible)',
    'this._config.inhibitors.intentionalityWindowMs',
    'this._config.inhibitors.backtrackWindowMs',
    "inhibitors.push('document_surface_excluded')",
    "observationKind === 'advance' && snapshot.advanceCount > 0 && !inhibitors.length",
    'if (inhibitors.length || (this._boundaryAt > 0',
    'releaseOpportunity() { this.reset(); }',
    'opportunityReady: this._opportunityReady',
    'cadence, burstId:',
  ]);
  requireIncludes(feedBoundaryState, feedBoundaryStatePath, [
    'class FeedBoundaryState',
    "if (event.direction !== 'forward') return this.getSnapshot()",
    'FEED_BOUNDARY_TIMESTAMP_INVALID',
    'advanceCount: previous.advanceCount + 1',
    'lastAdvanceAt: ts',
    'updateSupplySignals(readout)',
    'getSnapshot() { return { ...this._snapshot }; }',
  ]);
  const supplyUpdate = readSection(feedBoundaryState, '  updateSupplySignals(', '  clearInterventionControl(');
  requireIncludes(supplyUpdate, feedBoundaryStatePath, ['{ supply: readout }']);
  requireExcludes(supplyUpdate, feedBoundaryStatePath, [
    'recordAdvance(', 'advanceCount:', 'screenfulsConsumed:', 'itemTransitions:',
    'freshItemsSeen:', 'lastAdvanceAt:', '.reset(',
  ]);
  // The production boundary keeps observations and a short opportunity only.
  // Neither source may reconstruct the background consumption clock or use
  // the parked score/dose model as an admission input.
  for (const [source, sourcePath] of [
    [feedBoundaryJudge, feedBoundaryJudgePath], [feedBoundaryState, feedBoundaryStatePath],
  ]) {
    requireExcludes(source, sourcePath, [
      'FeedFlowJudge', 'FeedHorizonSeamGate', 'FeedBurstStateMachine',
      'FeedBingeObservationWindow', 'dopamineBinge', 'FeedConsumptionDoseTracker',
      'FeedConsumptionPaceWindow', 'feedTempo', '_dose', '_maturity',
      'minFreshItems', 'scoreThreshold', 'advanceEnsoCadence(', 'resetEnsoCadence(',
      'consumedMs:', 'consumedMs +=', 'setInterval(', 'setTimeout(',
      'chrome.storage', 'localStorage', 'INFINITE_SCROLL_DETECTED',
    ]);
  }
  requireIncludes(targetDoc, targetDocPath, [
    '- Status: Active',
    'Canonical owner table',
    'ensoIntervalPolicy.js',
    'trackingEnsoCadenceBridge.js',
    'InterventionAdmissionService.js',
    'interventionAdmissionClient.js',
    'FeedObservationRuntime.js',
    'feed-topology-certification-runtime.md',
    'FeedEndpointBoundaryResolver',
    'FeedEndpointBoundaryMotion',
    'FeedEndpointLease',
    'FeedBoundaryState',
    'FeedBoundaryJudge',
    'ensoCadencePolicy',
    'ensoFeedEpisodeAdmission.js',
    'EnsoSpawnPolicy',
    'reservation',
    'EnsoRuntimeEpisodeManager',
    'EnsoFeedSurfaceEntryGrace',
    'enso-feed-horizon-runtime-config-v4',
    'ensoFeedHorizonRuntimeConfig.js',
    'surface entry grace',
    'no cooldown clock',
    'read-only',
    'Manual QA',
    'check:enso:research-boundary',
  ]);
}

async function checkEnsoCadenceAndPresentationBoundary() {
  // The observation/rearm files remain research owners. Preserve their pure
  // observation contracts without wiring them back into production admission.
  const observationPath = 'src/domains/nudge/attention/RewardDriftObservationRuntime.js';
  const aggregatorPath = 'src/domains/nudge/attention/dopamineBingeEvidenceRuntime.js';
  const rearmPath = 'src/domains/nudge/interaction/EnsoRewardRearmPolicy.js';
  const readinessPath = 'src/domains/nudge/interaction/ensoGateReadiness.js';
  const spawnPath = 'src/domains/nudge/interaction/EnsoSpawnPolicy.js';
  const feedManagerPath = 'src/domains/nudge/feed-flow/FeedBoundaryEpisodeCoordinator.js';
  const clickManagerPath = 'src/domains/nudge/interactionManager.js';
  const cadencePath = 'src/domains/protection/background/runtime/ensoCadencePolicy.js';
  const clientPath = 'src/domains/nudge/runtime/interventionAdmissionClient.js';
  const trackingBridgePath = 'src/domains/tracking/background/trackingEnsoCadenceBridge.js';
  const [observation, aggregator, rearm, readiness, spawn, feedManager, clickManager] = await Promise.all(
    [observationPath, aggregatorPath, rearmPath, readinessPath, spawnPath, feedManagerPath, clickManagerPath].map(readUtf8),
  );
  requireIncludes(observation, observationPath, [
    'class RewardDriftObservationRuntime', 'recordTransition(', 'getEvidence(',
    'advanceRewardDriftEvidence', 'projectRewardDriftEvidence', 'summarizeRewardDriftEvidence',
    'REWARD_DRIFT_OBSERVATION_TIME_REVERSED',
  ]);
  const observationRead = readSection(observation, '\n  getEvidence(', '\n  hasObservation(');
  requireIncludes(observationRead, observationPath, ['projectRewardDriftEvidence', 'summarizeRewardDriftEvidence']);
  requireExcludes(observationRead, observationPath, ['this._evidence =', 'this._tuning =', '.clear(']);
  requireIncludes(aggregator, aggregatorPath, [
    'new RewardDriftObservationRuntime()', 'configureRewardObservation(', 'recordRewardTransition(',
    'DOPAMINE_BINGE_REWARD_EVIDENCE_OVERRIDE_UNSUPPORTED',
    'rewardEvidence: this.getRewardEvidence({ now })',
    'return this._rewardObservation.getEvidence({ now })',
  ]);
  requireExcludes(aggregator, aggregatorPath, ['this._rewardEvidence', 'observeRewardEvidence']);
  requireIncludes(rearm, rearmPath, [
    'class EnsoRewardRearmPolicy', 'presentationRevision !== this._presentationRevision',
    'ENSO_REWARD_REARM_PRESENTATION_REVERSED', "kind: 'enso_reward_rearm'", 'this.clearPending(',
  ]);
  requireExcludes(rearm, rearmPath, [
    "kind: 'reward_drift'", 'observeRewardEvidence', 'configureRewardObservation',
    'dopamineBingeEvidenceRuntime', 'RewardDriftObservationRuntime',
  ]);
  requireIncludes(readiness, readinessPath, [
    'const cadence = admissionClient.getEnsoCadence()',
    'isEnsoGateEligibleClickBoundary(boundary)',
    'if (!forceEntryForDebug && cadence?.eligible !== true)',
    'if (!spawn.allowed)', 'cadence: readiness.cadence',
    "'enso_consumption_interval_due'",
  ]);
  requireExcludes(readiness, readinessPath, [
    'summarizeRewardDriftEvidence', 'advanceRewardDriftEvidence', 'projectRewardDriftEvidence',
    'resolve({ rewardEvidence', 'state.rewardDrift',
  ]);
  for (const [source, sourcePath] of [[readiness, readinessPath], [spawn, spawnPath],
    [feedManager, feedManagerPath], [clickManager, clickManagerPath]]) {
    requireExcludes(source, sourcePath, [
      'dopamineBingeEvidenceRuntime', 'EnsoRewardRearmPolicy', 'FeedConsumptionDoseTracker',
      'FeedConsumptionPaceWindow', 'scoreBasis:', 'scoreThreshold:', 'observedScore:',
      '_lastPresentationCooldownMs', 'firstGraceMs:', 'cooldownMs:',
      'ENSO_FEED_HORIZON_SOURCE_FIRST_GRACE_MS', 'continuePassMs:',
      'advanceEnsoCadence(', 'resetEnsoCadence(', 'consumedMs:', 'consumedMs +=',
    ]);
  }
  const [cadence, client, trackingBridge] = await Promise.all(
    [cadencePath, clientPath, trackingBridgePath].map(readUtf8),
  );
  requireIncludes(cadence, cadencePath, [
    "from '../../../settings/config/ensoIntervalPolicy.js'",
    'requireEnsoCadenceState(state)', 'ENSO_CADENCE_STATE_INVALID',
    'requireEnsoCadencePoint(point)', 'ENSO_CADENCE_RECEIPT_INVALID',
    'interval.endedAt - interval.startedAt <= ENSO_CADENCE_MAX_OBSERVATION_GAP_MS',
    'Math.max(interval.startedAt, previous.observedAt, previous.resetAt)',
    'occupied || !previous.enabled ? 0 : elapsed',
    'owner.manual === false', 'projectEnsoCadence(state, intervalMs, reason = null)',
  ]);
  const cadenceProjection = readSection(cadence, 'export function projectEnsoCadence(', null);
  requireExcludes(cadenceProjection, cadencePath, [
    'Date.now(', 'advanceEnsoCadence(', 'resetEnsoCadence(', 'state.consumedMs =',
    'state.observedAt =', 'state.revision =',
  ]);
  requireIncludes(client, clientPath, [
    'ENSO_CADENCE_DTO_INVALID',
    'value.remainingMs !== value.intervalMs - value.consumedMs',
    'value.revision < ensoCadence.revision',
    'function refreshEnsoCadence()', 'function getEnsoCadence()',
    'if (generation === revision) receiveCadence(result.cadence)',
    'documentInvalidated = true', 'return stale ? null : ensoCadence',
  ]);
  requireExcludes(client, clientPath, [
    'advanceEnsoCadence(', 'resetEnsoCadence(', 'consumedMs:', 'consumedMs +=',
    'setInterval(', 'setTimeout(',
  ]);
  requireIncludes(trackingBridge, trackingBridgePath, [
    'admission.captureEnsoCadenceBoundary(at)',
    'tracker.getActiveTabInfo()', 'tracker.getOperationalIdleState()',
    'tracker.readProtectedTabScope(', 'admission.observeEnsoCadence(',
    'receipt.revision !== admission.captureEnsoCadenceObservation()',
    'admission.settleEnsoCadenceBoundary(receipt)',
  ]);
  for (const [source, sourcePath] of [[cadence, cadencePath], [trackingBridge, trackingBridgePath]]) {
    requireExcludes(source, sourcePath, [
      'setInterval(', 'setTimeout(', '.addListener(', '.addEventListener(',
      'new MutationObserver(', 'new IntersectionObserver(', 'querySelector',
      'chrome.storage', 'localStorage', 'dopamineBinge', 'feedTempo',
    ]);
  }
  requireIncludes(spawn, spawnPath, [
    'this._presentationRevision = 0', 'this._presentationRevision += 1',
    'presentationRevision: this._presentationRevision', 'ENSO_SPAWN_POLICY_PRESENTATION_REVISION_EXHAUSTED',
  ]);
  const commit = readSection(spawn, '\n  commit(', '\n  release(');
  requireOrdered(commit, spawnPath, [
    'if (episode.phase === ENSO_SPAWN_EPISODE_PHASES.PRESENTED)', 'committedNow: false',
    'this._presentationRevision += 1', 'committedNow: true',
  ], 'only a newly committed presentation may advance its identity; duplicate commits must return first');
  requireExcludes(readSection(spawn, '\n  _hardReset(', '\n  configure('), spawnPath, ['_presentationRevision']);
  requireExcludes(spawn, spawnPath, [
    'rewardDriftEvidence', 'RewardDriftObservationRuntime', 'EnsoRewardRearmPolicy',
    'clearRewardEvidence', 'resetRewardDrift', 'recordRewardTransition',
  ]);
  for (const [source, sourcePath] of [
    [readSection(feedManager, '\n  _commitSpawnPermit(', '\n  _releaseSpawnPermit('), feedManagerPath],
    [readSection(clickManager, '  gate.surfaceClaim = surfaceResult.claim;', '  state.ensoGateCanvasContextFailureReported'), clickManagerPath],
  ]) {
    requireIncludes(source, sourcePath, ['.commit(']);
    requireExcludes(source, sourcePath, [
      'resetRewardDrift', 'clearRewardDrift', 'clearRewardEvidence', 'recordRewardTransition',
      'configureRewardObservation', 'dopamineBingeEvidenceRuntime',
    ]);
  }
}

async function checkFeedTopologyCertificationBoundary() {
  const paths = {
    referenceDiscovery: 'src/domains/nudge/feed-flow/discovery/FeedContinuousReferenceDiscovery.js',
    probe: 'src/domains/nudge/feed-flow/topology/FeedLocalTopologyProbe.js',
    runtime: 'src/domains/nudge/feed-flow/topology/FeedTopologyCertificationRuntime.js',
    client: 'src/domains/nudge/feed-flow/topology/FeedTopologyPersistenceClient.js',
    service: 'src/domains/nudge/feed-flow/topology/FeedTopologyPersistentCertificationService.js',
    model: 'src/domains/nudge/feed-flow/topology/feedTopologyCertificateModel.js',
    contracts: 'src/domains/nudge/feed-flow/topology/feedTopologyCertificationContracts.js',
    checkpointContract:
      'src/platform/storage/model/FeedTopologyCertificateCheckpointContract.js',
    checkpointRepository:
      'src/platform/storage/model/FeedTopologyCertificateCheckpointRepository.js',
    route:
      'src/apps/background/services/runtime/messageRoutes/feedTopologyCertificateMessageRoutes.js',
    coreServices:
      'src/apps/background/services/runtime/backgroundKernelCoreServices.js',
    messageTypes: 'src/platform/messaging/contracts/messageTypes.js',
    targetDoc: 'docs/architecture/runtime/feed-topology-certification-runtime.md',
    storageDoc: 'docs/architecture/storage/storage-architecture-target.md',
    boundaryMap: 'docs/architecture/repository/friction-nudge-effect-boundary-map.md',
  };
  const entries = await Promise.all(
    Object.entries(paths).map(async ([key, filePath]) => [
      key,
      await readUtf8(filePath),
    ]),
  );
  const source = Object.fromEntries(entries);

  requireIncludes(source.referenceDiscovery, paths.referenceDiscovery, [
    'new FeedLocalTopologyProbe(',
    'candidateItemSelectors: GENERIC_FEED_ITEM_SELECTOR',
    'topology.discovery?.complete === false',
    'scroller.contains(node)',
    'local_reference_lane_ambiguous',
    'local_reference_hit_test_unavailable',
    "phase: 'local_reference_acquisition'",
  ]);
  requireExcludes(source.referenceDiscovery, paths.referenceDiscovery, [
    '.querySelectorAll(',
    '.style.setProperty(',
    '.style.removeProperty(',
    '.inert =',
    '.appendChild(',
    '.after(',
    'runtimeSendMessageReliable',
    'indexedDB',
    'chrome.storage',
    'localStorage',
    'fetch(',
    'FEED_TOPOLOGY_AUTHORITY_STATES',
    'normalizeFeedTopologyLocalCertificateEvidence',
  ]);
  requireIncludes(source.probe, paths.probe, [
    'FEED_LOCAL_TOPOLOGY_DESCRIPTOR_CONTRACT',
    'buildFeedLocalTopologyFingerprint(descriptor)',
    'findRepeatedLane({',
    'resolveFutureBranchProof(',
    'local_topology_candidate_discovery_incomplete',
    'scroller.contains(lane)',
    'maximumElements: this._maximumCandidates',
    "candidateCardinality: 'one_per_branch'",
    "mutationMode: 'sibling_inert_isolation'",
  ]);
  requireExcludes(source.probe, paths.probe, [
    '.querySelectorAll(',
    '.style.setProperty(',
    '.style.removeProperty(',
    '.inert =',
    '.appendChild(',
    '.after(',
    'runtimeSendMessageReliable',
    'indexedDB',
    'chrome.storage',
    'localStorage',
    'fetch(',
  ]);
  requireIncludes(source.runtime, paths.runtime, [
    'new FeedLocalTopologyProbe()',
    'new FeedTopologyPersistenceClient()',
    'FEED_TOPOLOGY_LIVE_CERTIFICATION_POLICY.liveStabilitySamples',
    'FEED_TOPOLOGY_LIVE_CERTIFICATION_POLICY.minimumLiveProbeIntervalMs',
    'FEED_TOPOLOGY_LIVE_CERTIFICATION_POLICY.certifiedValidationIntervalMs',
    'FEED_TOPOLOGY_LIVE_CERTIFICATION_POLICY.shadowValidationIntervalMs',
    'FEED_TOPOLOGY_LIVE_CERTIFICATION_POLICY.liveProofTtlMs',
    'this._queueFactOnce({',
    'const submissionKey = `${this._surfaceKey}:${outcome}:${fingerprint}`',
    'resetLiveVerification({ reason =',
    'normalizeFeedTopologyLocalCertificateEvidence({',
  ]);
  requireExcludes(source.runtime, paths.runtime, [
    '.style.setProperty(',
    '.style.removeProperty(',
    '.inert =',
    '.appendChild(',
    '.after(',
    'indexedDB',
    'chrome.storage',
    'localStorage',
    'fetch(',
    'this._submittedFacts.clear()',
  ]);
  requireIncludes(source.contracts, paths.contracts, [
    'FEED_TOPOLOGY_LOCAL_CERTIFICATE_EVIDENCE_CONTRACT',
    'FEED_TOPOLOGY_LIVE_CERTIFICATION_POLICY',
    'normalizeFeedTopologyObservationFact(value)',
    'normalizeFeedTopologyLocalCertificateEvidence(value)',
    'minimumLearnerConfidence: 0.72',
    'minimumLearnerSampleCount: 8',
    'liveStabilitySamples: 3',
    'minimumLiveProbeIntervalMs: 750',
    'certifiedValidationIntervalMs: 2_500',
    'shadowValidationIntervalMs: 10_000',
    'liveProofTtlMs: 10_000',
  ]);
  requireIncludes(source.model, paths.model, [
    'decayEvidence(certificate, now)',
    'duplicate_observation_ignored',
    'stale_observation_ignored',
    'fingerprint_rotated',
    'certificate_invalidated',
    'certificate_issued',
  ]);
  requireExcludes(source.model, paths.model, [
    'document.',
    'window.',
    'querySelector',
    'indexedDB',
    'chrome.storage',
    'localStorage',
  ]);
  requireIncludes(source.checkpointContract, paths.checkpointContract, [
    "'feed_topology_certificate_checkpoint_v1'",
    'evidenceHalfLifeMs: 14 * 24 * 60 * 60 * 1000',
    'certificateTtlMs: 30 * 24 * 60 * 60 * 1000',
    'minimumObservationCount: 3',
    'minimumObservationDayCount: 2',
    'minimumEffectiveEvidence: 2.4',
    'requireFeedTopologyCertificateCheckpoint(',
    'rebaseFeedTopologyCertificateCheckpoint(',
  ]);
  requireIncludes(source.checkpointRepository, paths.checkpointRepository, [
    'ModelStateRepository',
    'getEntryWithProfileEpoch',
    'compareAndSetValueWithProfileEpoch',
    'expectedRevision',
    'FEED_TOPOLOGY_CERTIFICATE_NEXT_REVISION_INVALID',
  ]);
  requireIncludes(source.service, paths.service, [
    'resolveProfileResetGeneration(lifecycle)',
    'this._assertWriteAdmission({ expectedResetId: profileEpoch })',
    'for (let attempt = 1; attempt <= this._casAttemptLimit; attempt += 1)',
    'FEED_TOPOLOGY_PERSISTED_CERTIFICATE_CONFLICT_EXHAUSTED',
  ]);
  requireIncludes(source.client, paths.client, [
    'runtimeSendMessageReliable',
    'MESSAGE_ACTIONS.GET_FEED_TOPOLOGY_CERTIFICATE_CHECKPOINT',
    'MESSAGE_ACTIONS.COMMIT_FEED_TOPOLOGY_OBSERVATION',
    'normalizeFeedTopologyObservationFact(rawFact)',
  ]);
  requireExcludes(source.client, paths.client, [
    'indexedDB',
    'chrome.storage',
    'localStorage',
    'fetch(',
  ]);
  requireIncludes(source.route, paths.route, [
    'isTrustedExtensionTabSender(sender)',
    'resolveSenderFrameId(sender) === 0',
    'MESSAGE_ACTIONS.GET_FEED_TOPOLOGY_CERTIFICATE_CHECKPOINT',
    'MESSAGE_ACTIONS.COMMIT_FEED_TOPOLOGY_OBSERVATION',
  ]);
  requireIncludes(source.coreServices, paths.coreServices, [
    'FeedTopologyCertificateCheckpointRepository.getInstance()',
    'createFeedTopologyPersistentCertificationService({',
    'checkpointRepository: feedTopologyCertificateCheckpointRepository',
    'profileLifecycleRepository: profileResetLifecycleRepository',
  ]);
  requireIncludes(source.messageTypes, paths.messageTypes, [
    "GET_FEED_TOPOLOGY_CERTIFICATE_CHECKPOINT: 'GET_FEED_TOPOLOGY_CERTIFICATE_CHECKPOINT'",
    "COMMIT_FEED_TOPOLOGY_OBSERVATION: 'COMMIT_FEED_TOPOLOGY_OBSERVATION'",
  ]);
  requireIncludes(source.targetDoc, paths.targetDoc, [
    '- Status: Active',
    'Canonical owner table',
    'FeedTopologyRecoveryProtocol.js',
    'FeedTopologyPersistentCertificationService.js',
    'FeedTopologyCertificateCheckpointRepository.js',
    '`feed_local_topology_descriptor_v1`',
    '`feed_topology_certificate_checkpoint_v1`',
    'evidence half-life는 14일',
    'certificate TTL은',
    '서로 다른 UTC day 두 개',
    'tab hide는 live proof를 지우고',
    '최소 750ms 간격',
    '10초 동안 새 live sample이 없으면',
    'hot path DOM scan을 제한한다',
    'server/network lookup과 session-memory certificate fallback은 없다',
  ]);
  requireIncludes(source.storageDoc, paths.storageDoc, [
    'canonical generic feed-topology certificate checkpoint',
    '`feed_topology_certificate_checkpoint_v1`',
    'at least 3 distinct document-session observations',
    '14-day',
    '30-day TTL',
    'server lookup',
  ]);
  requireIncludes(source.boundaryMap, paths.boundaryMap, [
    'Generic feed topology certification',
    'one corroboration/invalidation fact per document session',
    'epoch-fenced multi-session/multi-day certificate',
    'a second feed DOM writer',
  ]);
}

async function checkFeedTempoObservationBoundary() {
  const runtimePath = 'src/domains/nudge/feed-flow/index.js';
  const tempoContractsPath = 'src/domains/nudge/feed-flow/tempo/feedTempoContracts.js';
  const episodeAssemblerPath = 'src/domains/nudge/feed-flow/tempo/FeedTempoEpisodeAssembler.js';
  const adaptiveModelPath = 'src/domains/nudge/feed-flow/tempo/feedTempoAdaptiveProfileModel.js';
  const profileLearnerPath = 'src/domains/nudge/feed-flow/tempo/FeedTempoProfileLearner.js';
  const persistenceClientPath = 'src/domains/nudge/feed-flow/tempo/FeedTempoPersistenceClient.js';
  const persistenceServicePath = 'src/domains/nudge/feed-flow/tempo/FeedTempoPersistentProfileService.js';
  const tempoRuntimePath = 'src/domains/nudge/feed-flow/tempo/FeedTempoRuntime.js';
  const checkpointContractPath = 'src/platform/storage/model/FeedTempoProfileCheckpointContract.js';
  const checkpointRepositoryPath = 'src/platform/storage/model/FeedTempoProfileCheckpointRepository.js';
  const diagnosticStatePath = 'src/domains/nudge/feed-flow/diagnostics/feedFlowDiagnosticState.js';
  const debuggerProbePath = 'src/domains/nudge/runtime-debugger/RuntimeDebuggerFeedProbe.js';
  const judgePath = 'src/domains/nudge/feed-flow/judge/FeedFlowJudge.js';
  const dopamineDetectorPath = 'src/domains/nudge/attention/dopamineBingeDetector.js';
  const admissionPath = 'src/domains/nudge/interaction/ensoFeedEpisodeAdmission.js';
  const scenarioCatalogPath = 'scripts/e2e/sites/scenarioCatalog.mjs';
  const scenarioContractsPath = 'scripts/e2e/sites/scenarioContracts.mjs';
  const siteRunAnalysisPath = 'scripts/e2e/sites/siteRunAnalysis.mjs';
  const scenarioCatalogTestPath = 'tests/siteE2EScenarioCatalog.test.js';
  const siteRuntimeTestPath = 'tests/siteRuntimeE2E.test.js';
  const realSiteDocPath = 'docs/operations/qa/real-site-e2e.md';
  // Retired model tuning is documented only by its explicit historical snapshot.
  const targetDocPath = 'scripts/dev/enso-model-research/legacy-feed/feed-flow-runtime-before-time-policy.md';
  const boundaryMapPath = 'docs/architecture/repository/friction-nudge-effect-boundary-map.md';
  const [
    runtime,
    tempoContracts,
    episodeAssembler,
    adaptiveModel,
    profileLearner,
    persistenceClient,
    persistenceService,
    tempoRuntime,
    checkpointContract,
    checkpointRepository,
    diagnosticState,
    debuggerProbe,
    judge,
    dopamineDetector,
    admission,
    scenarioCatalog,
    scenarioContracts,
    siteRunAnalysis,
    scenarioCatalogTest,
    siteRuntimeTest,
    realSiteDoc,
    targetDoc,
    boundaryMap,
  ] = await Promise.all([
    readUtf8(runtimePath),
    readUtf8(tempoContractsPath),
    readUtf8(episodeAssemblerPath),
    readUtf8(adaptiveModelPath),
    readUtf8(profileLearnerPath),
    readUtf8(persistenceClientPath),
    readUtf8(persistenceServicePath),
    readUtf8(tempoRuntimePath),
    readUtf8(checkpointContractPath),
    readUtf8(checkpointRepositoryPath),
    readUtf8(diagnosticStatePath),
    readUtf8(debuggerProbePath),
    readUtf8(judgePath),
    readUtf8(dopamineDetectorPath),
    readUtf8(admissionPath),
    readUtf8(scenarioCatalogPath),
    readUtf8(scenarioContractsPath),
    readUtf8(siteRunAnalysisPath),
    readUtf8(scenarioCatalogTestPath),
    readUtf8(siteRuntimeTestPath),
    readUtf8(realSiteDocPath),
    readUtf8(targetDocPath),
    readUtf8(boundaryMapPath),
  ]);

  requireExcludes(runtime, runtimePath, [
    "from './tempo/FeedTempoRuntime.js'",
    'this._tempoRuntime.recordIntent(intent);',
    'this._tempoRuntime.recordActivity(activity);',
    'this._tempoRuntime.handleVisibilityChange(payload);',
    'this._tempoRuntime.recordAdvance(event);',
    'this._tempoRuntime.setInterventionExposure(active,',
    'tempo: this._tempoRuntime.getSnapshot()',
  ]);
  requireIncludes(await readUtf8('scripts/dev/enso-model-research/README.md'), 'scripts/dev/enso-model-research/README.md', [
    'offline_only',
    'FeedTempoRuntime',
    'FeedStructureLearner',
  ]);
  requireExcludes(runtime, runtimePath, ['this._tempoRuntime.markIntervention(']);
  requireIncludes(tempoContracts, tempoContractsPath, [
    'FEED_TEMPO_METRIC_GRAIN',
    'PERSONAL_BASELINE_METRIC_GRAINS.PAGED_ITEM_DWELL',
    'normalizeFeedTempoDiagnosticSnapshot',
    'buildFeedTempoProfileKey(surface)',
  ]);
  requireIncludes(episodeAssembler, episodeAssemblerPath, [
    'recordAdvance(event = {})',
    'flush({',
    'eligibleForObservedBaseline',
    "this._episode.surface.surfaceMode === 'paged'",
    'this._episode.interventionState === FEED_TEMPO_INTERVENTION_STATES.UNASSISTED',
  ]);
  requireExcludes(episodeAssembler, episodeAssemblerPath, [
    'MutationObserver',
    'querySelector',
    'localStorage',
    'chrome.storage',
    'indexedDB',
  ]);
  requireIncludes(profileLearner, profileLearnerPath, [
    'hydrateProfileState(surface, profileState',
    "throw new Error('FEED_TEMPO_PROFILE_DURABLE_COMMIT_REQUIRED')",
    'FEED_TEMPO_PROFILE_PERSISTENCE',
  ]);
  requireExcludes(profileLearner, profileLearnerPath, [
    'localStorage',
    'chrome.storage',
    'indexedDB',
  ]);
  requireIncludes(adaptiveModel, adaptiveModelPath, [
    'evaluateFeedTempoEpisodeAgainstProfile({',
    'isFeedTempoEpisodeEligibleForPersistence(rawFact)',
    'applyEligibleEpisodeToFeedTempoCheckpoint({',
    'FEED_TEMPO_PROFILE_POLICY.evidenceHalfLifeMs',
    'FEED_TEMPO_PROFILE_POLICY.confidenceHalfLifeMs',
    'FEED_TEMPO_PROFILE_POLICY.maximumCenterStepRatio',
    'FEED_TEMPO_PROFILE_POLICY.normativePagedDwellMs',
  ]);
  requireOrdered(
    readSection(
      adaptiveModel,
      'export function applyEligibleEpisodeToFeedTempoCheckpoint({',
      'export function restoreFeedTempoAdaptiveProfile({',
    ),
    adaptiveModelPath,
    [
      'const evaluation = evaluateFeedTempoEpisodeAgainstProfile({',
      'const nextProfile = applyEpisodeToProfile(',
      'const nextCheckpoint = requireFeedTempoProfileCheckpoint({',
    ],
    'feed tempo checkpoint must compare before applying one atomic update',
  );
  requireIncludes(checkpointContract, checkpointContractPath, [
    "FEED_TEMPO_PROFILE_CHECKPOINT_KEY = (",
    "'feed_tempo_adaptive_profile_checkpoint_v1'",
    "FEED_TEMPO_PROFILE_PERSISTENCE = 'indexeddb_checkpoint'",
    'evidenceHalfLifeMs: 30 * 24 * 60 * 60 * 1000',
    'confidenceHalfLifeMs: 7 * 24 * 60 * 60 * 1000',
    'maximumCenterStepRatio: 0.04',
    'normativePagedDwellMs: 5_000',
    'profileLimit: 16',
    'sampleRetention: 128',
    'requireFeedTempoProfileCheckpoint(value',
  ]);
  requireIncludes(checkpointRepository, checkpointRepositoryPath, [
    'ModelStateRepository',
    'getEntryWithProfileEpoch',
    'compareAndSetValueWithProfileEpoch',
    'expectedRevision',
    'FEED_TEMPO_CHECKPOINT_NEXT_REVISION_INVALID',
  ]);
  requireIncludes(persistenceService, persistenceServicePath, [
    'resolveProfileResetGeneration(lifecycle)',
    'this._assertWriteAdmission({ expectedResetId: profileEpoch })',
    'for (let attempt = 1; attempt <= this._casAttemptLimit; attempt += 1)',
    "throw new Error('FEED_TEMPO_PERSISTED_CHECKPOINT_CONFLICT_EXHAUSTED')",
  ]);
  requireIncludes(persistenceClient, persistenceClientPath, [
    'runtimeSendMessageReliable',
    'MESSAGE_ACTIONS.GET_FEED_TEMPO_PROFILE_CHECKPOINT',
    'MESSAGE_ACTIONS.COMMIT_FEED_TEMPO_PROFILE_EPISODE',
  ]);
  requireExcludes(persistenceClient, persistenceClientPath, [
    'localStorage',
    'chrome.storage',
    'indexedDB',
  ]);
  requireIncludes(tempoRuntime, tempoRuntimePath, [
    "mode: 'observe_only'",
    'FEED_TEMPO_PROFILE_PERSISTENCE',
    "mode: 'persisted_shadow'",
    "backend: 'indexeddb_model_state'",
    'this._persistenceClient.restoreSurface(normalizedSurface)',
    'this._persistenceClient.commitEpisode(fact)',
    'this._profileLearner.hydrateProfileState(',
  ]);
  requireIncludes(diagnosticState, diagnosticStatePath, [
    'normalizeFeedTempoDiagnosticSnapshot(snapshot)',
    'latestTempoSnapshot',
  ]);
  requireExcludes(diagnosticState, diagnosticStatePath, [
    'cloneContentFreeValue',
  ]);
  requireIncludes(debuggerProbe, debuggerProbePath, [
    'getFeedTempoDiagnosticSnapshot',
    'tempo: getFeedTempoDiagnosticSnapshot()',
  ]);
  requireExcludes(judge, judgePath, ['FeedTempo', 'personalBaseline']);
  requireExcludes(dopamineDetector, dopamineDetectorPath, [
    'FeedTempo',
    'feedTempo',
  ]);
  requireExcludes(admission, admissionPath, [
    'FeedTempo',
    'feedTempo',
  ]);
  requireIncludes(scenarioCatalog, scenarioCatalogPath, [
    "diagnosticCondition('feed-tempo-observe-only', 'debug_path_equals'",
    "path: 'feedFlow.tempo.mode'",
    "diagnosticCondition('feed-tempo-persistence-owner', 'debug_path_equals'",
    "expected: 'indexeddb_checkpoint'",
    "diagnosticCondition('feed-tempo-checkpoint-ready', 'debug_path_equals'",
    "path: 'feedFlow.tempo.checkpoint.state'",
    "diagnosticCondition('feed-tempo-cost-measured', 'debug_path_equals'",
    "path: 'feedFlow.tempo.cost.measurementState'",
    "diagnosticCondition('feed-tempo-dwell-observed', 'debug_counter_increased'",
    "'feedFlow.tempo.trajectory.counters.eligibleDwellCount'",
    "diagnosticCondition('feed-tempo-profile-restored', 'debug_number_at_least'",
    "path: 'feedFlow.tempo.profile.sampleCount'",
    "diagnosticCondition('feed-tempo-checkpoint-revision-restored', 'debug_number_at_least'",
  ]);
  requireIncludes(scenarioCatalog, scenarioCatalogPath, [
    "diagnosticCondition('feed-tempo-profile-restored', 'debug_number_at_least', {\n          path: 'feedFlow.tempo.profile.sampleCount',\n          minimum: 1,\n          minimumFeedOpportunityCount: 1,\n        })",
    "diagnosticCondition('feed-tempo-checkpoint-revision-restored', 'debug_number_at_least', {\n          path: 'feedFlow.tempo.profile.checkpointStateRevision',\n          minimum: 0,\n          minimumFeedOpportunityCount: 1,\n        })",
  ]);
  requireIncludes(scenarioContracts, scenarioContractsPath, [
    'SITE_SCENARIO_FEED_OPPORTUNITY_GATED_CONDITION_KINDS',
    "'debug_path_equals'",
    "'debug_number_at_least'",
    'SITE_SCENARIO_FEED_OPPORTUNITY_GATE_KIND_INVALID',
    'SITE_SCENARIO_FEED_OPPORTUNITY_GATE_ACTION_REQUIRED',
  ]);
  requireIncludes(siteRunAnalysis, siteRunAnalysisPath, [
    'export function applyFeedOpportunityWorkloadGate({',
    'SITE_SCENARIO_FEED_OPPORTUNITY_GATED_CONDITION_KINDS.includes(condition?.kind)',
    "measurementState: 'workload_insufficient'",
    '({ status, evidence } = applyFeedOpportunityWorkloadGate({',
  ]);
  requireIncludes(scenarioCatalogTest, scenarioCatalogTestPath, [
    'limits feed-opportunity workload gates to the two pure diagnostic rules',
    'minimumFeedOpportunityCount: 1',
  ]);
  requireIncludes(siteRuntimeTest, siteRuntimeTestPath, [
    'uses one pure feed-opportunity workload gate for equality and numeric floors',
    'warns for empty disposable tempo restore only when the feed oracle saw no opportunity',
  ]);
  requireIncludes(realSiteDoc, realSiteDocPath, [
    '`WARN / workload_insufficient`',
    '`opportunityCount >= 1`',
  ]);
  requireIncludes(targetDoc, targetDocPath, [
    'Personal tempo shadow observation',
    '`paged_item_dwell`',
    '`observe_only`',
    'cross-session persisted shadow profile',
    '고정된 영구 기준선이 아니라',
    'evidence weight는 30일 반감기',
    'confidence freshness는 7일 반감기',
    '직전 center의 4%',
    '0.75x..1.25x',
    '`feed_tempo_adaptive_profile_checkpoint_v1`',
    'session-memory fallback',
  ]);
  requireIncludes(boundaryMap, boundaryMapPath, [
    'Historical feed tempo research',
    '`FeedTempoEpisodeAssembler.recordAdvance`',
    'comparison precedes learning inside the archived hypothesis',
    'production has no hydration, commit route, research write fence or personal-model I/O',
    'typed old checkpoints are preserved without starting a writer',
    'check:enso:research-boundary',
  ]);
}

async function checkEnsoSemanticSurfaceContracts() {
  const runtimePath = 'src/domains/nudge/feed-flow/index.js';
  const profilesPath = 'src/domains/nudge/feed-flow/registry/feedSurfaceProfiles.js';
  const registryPath = 'src/domains/nudge/feed-flow/registry/feedSurfaceRegistry.js';
  const gracePath = 'src/domains/nudge/interaction/EnsoFeedSurfaceEntryGrace.js';
  const shadowPath = 'scripts/dev/enso-shadow-scenario-matrix.mjs';
  const shadowTestPath = 'tests/ensoPlatformShadowScenarios.test.js';
  const profileTestPath = 'tests/feedSurfaceProfiles.test.js';
  const [runtime, profiles, registry, grace, shadow, shadowTest, profileTest] = await Promise.all([
    readUtf8(runtimePath),
    readUtf8(profilesPath),
    readUtf8(registryPath),
    readUtf8(gracePath),
    readUtf8(shadowPath),
    readUtf8(shadowTestPath),
    readUtf8(profileTestPath),
  ]);

  requireIncludes(profiles, profilesPath, [
    "DEFAULT_ROUTE: 'default:route'",
    "X_HOME: 'x:home'",
    "X_DOCUMENT: 'x:document'",
    "FACEBOOK_HOME: 'facebook:home'",
    "FACEBOOK_DOCUMENT: 'facebook:document'",
    "INSTAGRAM_REELS: 'instagram:reels'",
    "TIKTOK_FEED: 'tiktok:feed'",
    "TIKTOK_DOCUMENT: 'tiktok:document'",
    "YOUTUBE_HOME: 'youtube:home'",
    "YOUTUBE_BROWSE: 'youtube:browse'",
    "YOUTUBE_SHORTS: 'youtube:shorts'",
    "YOUTUBE_WATCH: 'youtube:watch'",
    'resolveFeedSurfaceRoute',
    'isShortLinkHost',
    'FEED_SURFACE_MODES.DOCUMENT',
  ]);
  requireExcludes(profiles, profilesPath, [
    'defaultMode:',
    'semanticSurfaceKey',
  ]);
  requireIncludes(registry, registryPath, [
    'semanticSurfaceId: surfaceRoute.semanticSurfaceId',
    'routeFamily: surfaceRoute.routeFamily',
    "'candidateItemSelectors'",
    '? surfaceRoute.candidateItemSelectors',
    "contentClass: isDocumentSurface",
  ]);
  const signatureStart = runtime.indexOf('function buildSurfaceSignature(surface)');
  const signatureEnd = runtime.indexOf('function buildLocalActuationContext', signatureStart);
  if (signatureStart < 0 || signatureEnd <= signatureStart) {
    fail(`${runtimePath}: canonical surface-signature function boundary is missing.`);
  } else {
    const signatureSource = runtime.slice(signatureStart, signatureEnd);
    requireIncludes(signatureSource, runtimePath, ['surface.semanticSurfaceId']);
    requireExcludes(signatureSource, runtimePath, ['surface.pathname']);
  }
  requireIncludes(runtime, runtimePath, [
    'const rawRouteChanged =',
    'onBeforeFeedSurfaceReset',
    'FEED_FLOW_SURFACE_RESET_NOT_ACKNOWLEDGED',
    'validateResolvedFeedSurface(',
    'profileId: surface.profileId',
    'semanticSurfaceId: surface.semanticSurfaceId',
    'contentClass: surface.contentClass',
    'scrollerHint: surface.scrollerHint',
  ]);
  requireIncludes(grace, gracePath, [
    'ENSO_FEED_SURFACE_ENTRY_GRACE_MS = 2 * 60 * 1000',
    'resolveEnsoFeedSemanticSurfaceId',
    'surface_entry_grace_active',
  ]);
  requireExcludes(grace, gracePath, [
    '.pathname',
    'semanticSurfaceKey',
  ]);
  requireIncludes(shadow, shadowPath, [
    'FeedBingeObservationWindow',
    'projectFeedFlowBingeEvidence',
    'resolveDopamineBingeDetection',
    'resolveFeedEndpointAdapter',
    "id: 'youtube_rapid_shorts'",
    "id: 'tiktok_profile_document'",
    "id: 'x_status_document'",
  ]);
  requireIncludes(shadowTest, shadowTestPath, [
    'keeps equivalent short-form behavior on one common Enso scale',
    'separates a detector candidate from permission to mutate the feed',
    "semanticSurfaceId: 'tiktok:document'",
  ]);
  requireIncludes(profileTest, profileTestPath, [
    'FEED_SEMANTIC_SURFACE_IDS.YOUTUBE_SHORTS',
    'FEED_SEMANTIC_SURFACE_IDS.X_HOME',
    'FEED_SEMANTIC_SURFACE_IDS.X_DOCUMENT',
    'FEED_SEMANTIC_SURFACE_IDS.FACEBOOK_HOME',
    'FEED_SEMANTIC_SURFACE_IDS.FACEBOOK_DOCUMENT',
    'FEED_SEMANTIC_SURFACE_IDS.TIKTOK_DOCUMENT',
    'FEED_SEMANTIC_SURFACE_IDS.YOUTUBE_HOME',
  ]);
}

async function checkBasicStrategyReferenceContracts() {
  const trajectoryPath = 'src/domains/protection/domain/basicProtectionRecentTrajectory.js';
  const contextContractPath = 'src/domains/protection/strategy/contracts/basicStrategyContextContract.js';
  const policyPath = 'src/domains/protection/strategy/catalog/basicStrategyPolicy.js';
  const decisionPath = 'src/domains/protection/domain/protectionRuntimeDecision.js';
  const orchestratorPath = 'src/domains/protection/background/strategy/BasicStrategyOrchestrator.js';
  const strategyContractPath = 'src/domains/protection/strategy/contracts/strategyContracts.js';
  const snapshotBridgePath = 'src/domains/protection/contracts/protectionRuntimeSnapshotBridge.js';
  const inputProviderPath = 'src/domains/protection/background/ProtectionRuntimeInputProvider.js';
  const runtimeInsightsPath = 'src/apps/dashboard/utils/protectionRuntimeInsights.js';
  const dashboardLaunchPath = 'src/apps/dashboard/bootstrap/dashboardLaunchContext.js';
  const sitesTabPath = 'src/apps/dashboard/tabs/sites/SitesTab.jsx';
  const sitesSurfacePath = 'src/apps/dashboard/workspaces/sites/SitesManagementSurface.jsx';
  const nudgeDispatchContextPath = 'src/domains/protection/background/protocol/dispatch/ProtectionNudgeDispatchContext.js';
  const docPath = 'docs/product/dashboard/basic-protection-strategy-prd.md';
  const [
    trajectory,
    contextContract,
    policy,
    decision,
    orchestrator,
    strategyContract,
    snapshotBridge,
    inputProvider,
    runtimeInsights,
    dashboardLaunch,
    sitesTab,
    sitesSurface,
    nudgeDispatchContext,
    doc,
  ] = await Promise.all([
    readUtf8(trajectoryPath),
    readUtf8(contextContractPath),
    readUtf8(policyPath),
    readUtf8(decisionPath),
    readUtf8(orchestratorPath),
    readUtf8(strategyContractPath),
    readUtf8(snapshotBridgePath),
    readUtf8(inputProviderPath),
    readUtf8(runtimeInsightsPath),
    readUtf8(dashboardLaunchPath),
    readUtf8(sitesTabPath),
    readUtf8(sitesSurfacePath),
    readUtf8(nudgeDispatchContextPath),
    readUtf8(docPath),
  ]);

  requireIncludes(trajectory, trajectoryPath, [
    'getBasicRecentUsageDateWindow',
    'index - BASIC_RECENT_USAGE_WINDOW_DAYS',
    'return { observed: false, activeMs: null }',
    'return { observed: true, activeMs: 0 }',
    'averageDailyMs: observedDays > 0 ? activeTotalMs / observedDays : null',
    'BASIC_RECENT_USAGE_DOMAIN_ACTIVE_FACT_INVALID',
  ]);
  requireExcludes(trajectory, trajectoryPath, [
    '.slice(-7)',
    'buildDomainUsageWindowSummary',
    'ensureNumber(',
  ]);
  requireIncludes(contextContract, contextContractPath, [
    "BASIC_RECENT_USAGE_TRAJECTORY_VERSION = 'basic-protection-recent-trajectory-v1'",
    "BASIC_TARGET_RECOMMENDATION_VERSION = 'basic-target-recommendation-v2'",
    'BASIC_TARGET_NORMATIVE_DEFAULT_MINUTES = 30',
    'BASIC_TARGET_MAX_RECOMMENDED_MINUTES = 180',
    "RECENT_USAGE_TRAJECTORY: 'recent_usage_trajectory'",
    'PERSONAL_BASELINE_ROLES.RECENT_TRAJECTORY',
    'PERSONAL_BASELINE_ROLES.ADAPTIVE_REFERENCE',
    'PERSONAL_BASELINE_METRIC_GRAINS.DAY',
    'BASIC_TARGET_NORMATIVE_DEFAULT_SOURCE',
    'deriveBasicTargetRecommendationRelation',
    'recentUsageAverageDailyMs',
    'currentPartialDayMinutes',
    'value.source !== expected.source',
    'requireBasicTargetRecommendationForTrajectory',
    'BASIC_TARGET_RECOMMENDATION_TRAJECTORY_RELATION_INVALID',
    'value.requiresUserReview !== true',
    'value.autoApply !== false',
  ]);
  requireIncludes(policy, policyPath, [
    'BASIC_TARGET_NORMATIVE_DEFAULT_MINUTES',
    'BASIC_TARGET_MAX_RECOMMENDED_MINUTES',
    "lifecyclePhase: 'stabilize'",
    "effectiveTargetSource: 'declared_target'",
    'normativeDefaultTargetMinutes: BASIC_TARGET_NORMATIVE_DEFAULT_MINUTES',
    'maxRecommendedTargetMinutes: BASIC_TARGET_MAX_RECOMMENDED_MINUTES',
    'deriveBasicTargetRecommendationRelation',
    'recentUsageAverageDailyMs: trajectory.averageDailyMs',
    'currentPartialDayMinutes: todayMinutes',
    'requireBasicTargetRecommendationForTrajectory',
    'requiresUserReview: true',
    'autoApply: false',
  ]);
  requireExcludes(policy, policyPath, [
    'BASIC_TARGET_RECOMMENDATION_SOURCES.RECENT_TRAJECTORY',
    'resolveBasicStrategyPhase',
    'resolveBasicEffectiveTargetMinutes',
    'export function resolveBasicRecommendedTargetMinutes',
    'acclimateTargetWeights',
    'daysSinceGoalSet',
  ]);
  requireIncludes(decision, decisionPath, [
    'buildBasicProtectionRecentUsageTrajectory',
    'effectiveTargetMinutes: normalizedDeclaredTargetMinutes',
    'effectiveTargetSource: BASIC_STRATEGY_POLICY_DEFAULTS.effectiveTargetSource',
    'recentUsageTrajectory',
    'targetRecommendation',
  ]);
  requireIncludes(orchestrator, orchestratorPath, [
    "strategyContext.lifecyclePhase !== 'stabilize'",
    'BASIC_STRATEGY_EFFECTIVE_TARGET_RELATION_INVALID',
    'requireBasicTargetRecommendationForTrajectory',
    'recentUsageTrajectory: normalizedStrategyContext.recentUsageTrajectory',
    'targetRecommendation: normalizedStrategyContext.targetRecommendation',
  ]);
  requireExcludes(orchestrator, orchestratorPath, [
    "lifecyclePhase === 'acclimate'",
    'effective_target_softened',
  ]);
  requireIncludes(strategyContract, strategyContractPath, [
    'STRATEGY_LIFECYCLE_PHASES = Object.freeze([',
    "'stabilize'",
    'STRATEGY_LIFECYCLE_PHASE_INVALID',
    'requireBasicTargetRecommendationForTrajectory',
    'const recentUsageTrajectory = cloneRecentUsageTrajectory(source.recentUsageTrajectory)',
    'source.targetRecommendation,',
    'recentUsageTrajectory,',
  ]);
  requireExcludes(strategyContract, strategyContractPath, [
    "  'acclimate',",
    "  'converge',",
    'export function normalizeStrategyLifecyclePhase',
  ]);
  requireIncludes(snapshotBridge, snapshotBridgePath, [
    'runtime.strategy ? normalizeStrategyDecision(runtime.strategy) : null',
  ]);
  requireIncludes(inputProvider, inputProviderPath, [
    'getBasicRecentUsageDateWindow(now, statsCache)',
    'const selectedDateStrs = [...completedDateStrs, dateStr]',
    'PROTECTION_RUNTIME_INPUT_STATS_DOMAIN_ACTIVE_INVALID',
    'active: domainStats.active',
  ]);
  requireExcludes(inputProvider, inputProviderPath, [
    '.slice(-7)',
    'active: ensureNumber(dayStats?.domains',
  ]);
  requireIncludes(runtimeInsights, runtimeInsightsPath, [
    'PERSONAL_BASELINE_ROLES',
    'strategy.targetRecommendation?.role === PERSONAL_BASELINE_ROLES.ADAPTIVE_REFERENCE',
    'strategy.targetRecommendation.requiresUserReview === true',
    'strategy.targetRecommendation.autoApply === false',
    "runtime_insights.target_meta_declared",
  ]);
  requireExcludes(runtimeInsights, runtimeInsightsPath, [
    "role === 'adaptive_reference'",
    "strategy.lifecyclePhase === 'acclimate'",
    'runtime_insights.target_settling',
    'runtime_insights.target_meta_effective',
    'Number(strategy.recommendedTargetMinutes)',
  ]);
  requireExcludes(dashboardLaunch, dashboardLaunchPath, [
    "query.get('recommendedTargetMinutes')",
    "query.get('declaredTargetMinutes')",
    'function normalizeMinutes(',
  ]);
  requireIncludes(sitesTab, sitesTabPath, [
    "import SitesManagementSurface from '../../workspaces/sites/SitesManagementSurface.jsx'",
    '<SitesManagementSurface {...props} />',
  ]);
  requireIncludes(sitesSurface, sitesSurfacePath, [
    'snapshot: normalizedRuntimeInsightSnapshot',
    'PERSONAL_BASELINE_ROLES',
    'targetRecommendation?.role !== PERSONAL_BASELINE_ROLES.ADAPTIVE_REFERENCE',
    'targetRecommendation.requiresUserReview !== true',
    'targetRecommendation.autoApply !== false',
  ]);
  const forbiddenSitesTargetAuthority = [
    "role !== 'adaptive_reference'",
    'routeRecommendedTargetMinutes',
    'routeDeclaredTargetMinutes',
    'actionParams.recommendedTargetMinutes',
    'actionParams.declaredTargetMinutes',
  ];
  requireExcludes(sitesTab, sitesTabPath, forbiddenSitesTargetAuthority);
  requireExcludes(sitesSurface, sitesSurfacePath, forbiddenSitesTargetAuthority);
  requireIncludes(nudgeDispatchContext, nudgeDispatchContextPath, [
    "params.set('tab', 'sites')",
    "params.set('domain', hostname)",
    "params.set('recovery', recoveryAction)",
  ]);
  requireExcludes(nudgeDispatchContext, nudgeDispatchContextPath, [
    "params.set('recommendedTargetMinutes'",
    "params.set('declaredTargetMinutes'",
    'readOptionalRecoveryTargetMinutes',
    'resolveRecoveryStrategy',
  ]);
  requireIncludes(doc, docPath, [
    'Basic has one current runtime lifecycle value: `stabilize`',
    'effectiveTargetMinutes = declaredTargetMinutes',
    '`requiresUserReview=true`',
    '`autoApply=false`',
    '`maxRecommendedTargetMinutes=180`',
  ]);
}

async function checkSiteTargetingSemanticNegativeControl() {
  const scenarioCatalogPath = 'scripts/e2e/sites/scenarioCatalog.mjs';
  const scenarioContractsPath = 'scripts/e2e/sites/scenarioContracts.mjs';
  const siteRuntimeBrowserPath = 'scripts/e2e/sites/siteRuntimeBrowser.mjs';
  const siteRunAnalysisPath = 'scripts/e2e/sites/siteRunAnalysis.mjs';
  const semanticControlTestPath = 'tests/siteTargetingSemanticNegativeControl.test.js';
  const realSiteE2ePath = 'docs/operations/qa/real-site-e2e.md';
  const [
    scenarioCatalog,
    scenarioContracts,
    siteRuntimeBrowser,
    siteRunAnalysis,
    semanticControlTest,
    realSiteE2e,
  ] = await Promise.all([
    readUtf8(scenarioCatalogPath),
    readUtf8(scenarioContractsPath),
    readUtf8(siteRuntimeBrowserPath),
    readUtf8(siteRunAnalysisPath),
    readUtf8(semanticControlTestPath),
    readUtf8(realSiteE2ePath),
  ]);

  requireIncludes(scenarioContracts, scenarioContractsPath, [
    'SITE_TARGETING_SEMANTIC_NEGATIVE_CONTROL_KINDS = Object.freeze({',
    "HTML_VIDEO_ELEMENT: 'html_video_element'",
    "'semanticNegativeControls'",
    'SITE_SCENARIO_TARGETING_ORACLE_SHAPE_INVALID',
    'SITE_SCENARIO_TARGETING_SEMANTIC_NEGATIVE_CONTROL_SHAPE_INVALID',
    'SITE_SCENARIO_TARGETING_SEMANTIC_NEGATIVE_CONTROL_KIND_INVALID',
    'SITE_SCENARIO_TARGETING_SEMANTIC_NEGATIVE_CONTROL_MINIMUM_INVALID',
    'SITE_SCENARIO_TARGETING_SEMANTIC_NEGATIVE_CONTROL_KIND_DUPLICATE',
    'control.minimum !== 1',
  ]);
  requireIncludes(scenarioCatalog, scenarioCatalogPath, [
    "id: 'tiktok-text-targeting'",
    'negativeSelectors: [],',
    'semanticNegativeControls: [',
    'SITE_TARGETING_SEMANTIC_NEGATIVE_CONTROL_KINDS.HTML_VIDEO_ELEMENT',
    'minimum: 1',
  ]);
  requireExcludes(scenarioCatalog, scenarioCatalogPath, [
    "negativeSelectors: ['video']",
  ]);
  requireIncludes(siteRuntimeBrowser, siteRuntimeBrowserPath, [
    'const sampleSemanticNegativeControlStyles =',
    "document.getElementsByTagName('video')",
    'element instanceof HTMLVideoElement',
    "keyPrefix: 'semantic:' + control.kind",
    'input.targetingOracle.semanticNegativeControls.length > 0',
    '...sampleSemanticNegativeControlStyles(',
  ]);
  requireIncludes(siteRunAnalysis, siteRunAnalysisPath, [
    'const reenabledNegative = compareTargetingStyleSamples(',
    'reenabledNegative.matchedSampleCount === 0',
    'reenabledNegative.changedSampleCount === 0',
    'reenabledComparison: reenabledNegative',
    "'targeting_negative_controls_unchanged'",
  ]);
  requireIncludes(semanticControlTest, semanticControlTestPath, [
    "test('declares one frozen typed video control without a raw product selector'",
    "test('enforces the exact targeting-oracle and closed semantic-control schema'",
    "test('samples only visible HTMLVideoElement controls under semantic keys'",
    "test('reuses one negative contract for active and re-enabled comparisons'",
    "key: 'semantic:html_video_element:0'",
  ]);
  requireIncludes(realSiteE2e, realSiteE2ePath, [
    'closed QA-owned semantic negative control',
    '`html_video_element / minimum=1`',
    '`HTMLVideoElement`',
    '`semantic:html_video_element:<ordinal>`',
    're-enabled-to-disabled comparisons',
    'insufficient `WARN`, never PASS',
  ]);
}

async function checkSiteLayoutCycleOracle() {
  const layoutCycleAnalysisPath = 'scripts/e2e/sites/layoutCycleAnalysis.mjs';
  const scenarioCatalogPath = 'scripts/e2e/sites/scenarioCatalog.mjs';
  const scenarioContractsPath = 'scripts/e2e/sites/scenarioContracts.mjs';
  const siteRuntimeBrowserPath = 'scripts/e2e/sites/siteRuntimeBrowser.mjs';
  const siteRunAnalysisPath = 'scripts/e2e/sites/siteRunAnalysis.mjs';
  const layoutCycleTestPath = 'tests/siteLayoutCycleOracle.test.js';
  const realSiteE2ePath = 'docs/operations/qa/real-site-e2e.md';
  const [
    layoutCycleAnalysis,
    scenarioCatalog,
    scenarioContracts,
    siteRuntimeBrowser,
    siteRunAnalysis,
    layoutCycleTest,
    realSiteE2e,
  ] = await Promise.all([
    readUtf8(layoutCycleAnalysisPath),
    readUtf8(scenarioCatalogPath),
    readUtf8(scenarioContractsPath),
    readUtf8(siteRuntimeBrowserPath),
    readUtf8(siteRunAnalysisPath),
    readUtf8(layoutCycleTestPath),
    readUtf8(realSiteE2ePath),
  ]);

  requireIncludes(layoutCycleAnalysis, layoutCycleAnalysisPath, [
    "LAYOUT_CYCLE_ORACLE_KIND = 'owner_marker_visibility_cycle'",
    "LAYOUT_CYCLE_ORACLE_RELATION = 'candidate_scoped'",
    "LAYOUT_CYCLE_OPPORTUNITY_KIND = 'youtube_watch_info_view_time_only'",
    "LAYOUT_CYCLE_OPPORTUNITY_CONTAINER_SELECTOR = 'ytd-watch-info-text'",
    'export function analyzeLayoutCycleOracle({',
    "contractId: 'layout_cycle_active_collapsed'",
    "contractId: 'layout_cycle_disabled_restored'",
    "contractId: 'layout_cycle_reenabled_collapsed'",
    "reason: 'candidate_scoped_owner_relation_not_observed'",
    "reason: 'declared_collapsed_container_marker_remains_visible'",
    "reason: 'collapsed_container_retains_visible_layout_ancestor'",
    "reason: 'native_view_time_opportunity_not_observed'",
    "reason: 'native_view_time_opportunity_not_collapsed'",
    'sample.collapsedOwnedNativeOpportunityCount > 0',
    'sample.nativeOpportunityCount > sample.candidateCount',
    "reason: 'declared_collapsed_container_marker_remains_after_disable'",
    "reason: 'native_view_time_opportunity_not_restored'",
  ]);
  requireExcludes(layoutCycleAnalysis, layoutCycleAnalysisPath, [
    'querySelector',
    'textContent',
    'innerHTML',
    'location.',
  ]);
  requireIncludes(scenarioCatalog, scenarioCatalogPath, [
    'layoutCycleOracle: {',
    'opportunityKind: LAYOUT_CYCLE_OPPORTUNITY_KIND',
    'relation: LAYOUT_CYCLE_ORACLE_RELATION',
    "ownerMarkerSelector: '[data-friction-youtube-metadata-collapsed]'",
    'ownedMetricSelectors: [',
    "'[data-friction-social-engagement=\"1\"]'",
    "'[data-friction-social-exposure=\"1\"]'",
    'collapsedContainerSelectors: [',
    'LAYOUT_CYCLE_OPPORTUNITY_CONTAINER_SELECTOR',
    "'ytd-watch-metadata .yt-content-metadata-view-model__metadata-row'",
    "'ytd-watch-metadata [role=\"group\"]'",
    'restoredCandidateSelectors: [',
    "'ytd-watch-metadata #metadata-line'",
  ]);
  requireIncludes(scenarioContracts, scenarioContractsPath, [
    "Object.hasOwn(observableEffects, 'layoutCycleOracle')",
    "'opportunityKind'",
    "'ownedMetricSelectors'",
    "'collapsedContainerSelectors'",
    'SITE_SCENARIO_LAYOUT_CYCLE_ORACLE_RELATION_INVALID',
    'SITE_SCENARIO_LAYOUT_CYCLE_OPPORTUNITY_KIND_INVALID',
    'SITE_SCENARIO_LAYOUT_CYCLE_OPPORTUNITY_CONTAINER_REQUIRED',
    'SITE_SCENARIO_LAYOUT_CYCLE_OWNED_METRIC_SELECTORS_REQUIRED',
    'SITE_SCENARIO_LAYOUT_CYCLE_COLLAPSED_CONTAINER_SELECTORS_REQUIRED',
    'SITE_SCENARIO_LAYOUT_CYCLE_COLLAPSED_CONTAINER_MARKER_DEPENDENT',
    'SITE_SCENARIO_LAYOUT_CYCLE_COLLAPSED_CONTAINER_RESTORE_CANDIDATE_REQUIRED',
    'SITE_SCENARIO_LAYOUT_CYCLE_OWNED_METRIC_MARKER_COLLISION',
    'SITE_SCENARIO_LAYOUT_CYCLE_RESTORED_CANDIDATE_MARKER_DEPENDENT',
  ]);
  requireIncludes(siteRuntimeBrowser, siteRuntimeBrowserPath, [
    'const YOUTUBE_WATCH_INFO_OPPORTUNITY_CLASSIFIER = Object.freeze({',
    'function resolveLayoutCycleOpportunityClassifier(oracle)',
    'const classifyNativeOpportunity = (container) => {',
    'normalizeAccessibleText(nested)',
    'return hasView && hasTime && signalLeaves.length > 0',
    'const markerElements = selectUniqueElements([oracle.ownerMarkerSelector]);',
    'const restoredCandidates = selectUniqueElements(oracle.restoredCandidateSelectors);',
    'const candidateDescendantOwnerMarkers = new Set();',
    'const declaredCollapsedContainerMarkers = markerElements.filter(',
    '(selector) => element.matches(selector)',
    'marker.querySelector(selector) !== null',
    'candidateOwnerMarkerCount: candidateOwnerMarkers.length',
    'candidateDescendantOwnerMarkerCount: candidateDescendantOwnerMarkers.size',
    'collapsedOwnedMetadataContainerCount: collapsedOwnedMetadataContainers.length',
    'nativeOpportunityCount: nativeOpportunities.length',
    'collapsedOwnedNativeOpportunityCount,',
    'visibleNativeOpportunityCount,',
    'visibleDeclaredCollapsedContainerMarkerCount,',
    'visibleRestoredAncestorOfCollapsedContainerCount,',
    'visibleOwnerMarkedCandidateCount:',
    'const collapsedCount = restoredCandidates.filter(isCollapsedCandidate).length;',
    "style.display === 'none' && rect.width === 0 && rect.height === 0",
    'visibleRestoredTargetCount',
  ]);
  requireExcludes(siteRuntimeBrowser, siteRuntimeBrowserPath, [
    'const collapsedCount = markerElements.filter',
    'marker.contains(candidate)',
    'candidate.contains(marker)',
  ]);
  requireIncludes(siteRunAnalysis, siteRunAnalysisPath, [
    "from './layoutCycleAnalysis.mjs'",
    'const layoutCycleObserved = [',
    '? analyzeLayoutCycleOracle({',
    '...(layoutCycle === null ? [] : layoutCycle.contracts)',
  ]);
  requireIncludes(layoutCycleTest, layoutCycleTestPath, [
    "test('adds layout-cycle contracts to the observable-effect result only when observed'",
    "test('excludes individual metric markers and counts only collapsed owned containers'",
    'accepts only independently declared collapsed metadata container identities',
    'classifies only a strict native watch-info opportunity',
    'collapsed owner container without same-row native opportunity correlation',
    "name: 'document-global marker without a candidate relation'",
    "reason: 'candidate_scoped_owner_relation_not_observed'",
    'expect(nonOracleEffect.layoutCycle).toBeNull();',
    "id.startsWith('layout_cycle_')",
  ]);
  requireIncludes(realSiteE2e, realSiteE2ePath, [
    '`youtube_watch_info_view_time_only`',
    'never consults an extension owner marker',
    'correlated to the exact same native-opportunity row',
    'This excludes arbitrary nested wrappers as well as',
    "directly match one of the",
    '`collapsedContainerSelectors`',
    'Candidate ancestry is diagnostic evidence only',
    'visible restored candidate that contains',
    'declared collapsed-container selector is also required',
    'Any visible exact',
    'Active and re-enabled collapse passes only with an',
    '`layout_cycle_active_collapsed`, `layout_cycle_disabled_restored`, and',
    'a non-layout-oracle scenario receives no layout-cycle contracts',
  ]);
}

async function checkMediaDiscoveryOwnership() {
  const ownerPath = 'src/domains/nudge/video/VideoElementObserver.js';
  const accessPath = 'src/domains/nudge/media/mediaShadowRootAccess.js';
  const holdPath = 'src/domains/nudge/media/PageMediaHold.js';
  const activityPath = 'src/domains/nudge/media/PageMediaActivityObserver.js';
  const globalPath = 'src/domains/nudge/nudge/nudgeGameMediaSuppression.js';
  const [owner, access, hold, globalHold] = await Promise.all(
    [ownerPath, accessPath, holdPath, globalPath].map(readUtf8),
  );
  requireIncludes(owner, ownerPath, [
    'getVideoElementObserverForDocument', 'registerMediaRoot',
    'getObservedRoots', 'attributeTargets', 'readMediaShadowRoot',
    'getMediaSnapshot', 'observedAudio', 'observedFrames', 'synchronousInitialInventory',
    'ownerDocument !== documentRef',
  ]);
  requireIncludes(access, accessPath, [
    'getExtensionApi', 'openOrClosedShadowRoot',
    "'open_and_closed'", "'open_only'", 'MEDIA_SHADOW_ROOT_ACCESS_FAILED',
  ]);
  requireExcludes(access, accessPath, ['globalThis.chrome', 'globalThis.browser']);
  requireIncludes(hold, holdPath, ['getVideoElementObserverForDocument', 'subscribeMediaMutations', 'synchronousInitialInventory: true', 'getMediaSnapshot']);
  requireExcludes(hold, holdPath, ['new MutationObserver', 'setInterval(', 'querySelectorAll', 'collectTabMediaElements', 'reconcileExistingVideos']);
  const activity = await readUtf8(activityPath);
  requireIncludes(activity, activityPath, ['getMediaSnapshot', 'observedAudio']);
  requireExcludes(activity, activityPath, ['new MutationObserver', 'querySelectorAll', 'collectTabAudioElements']);
  requireIncludes(globalHold, globalPath, ['createPageMediaHold']);
  // Product volume fades may retain their timer; inventory polling may not.
  requireExcludes(globalHold, globalPath, ['new MutationObserver', 'SWEEP_INTERVAL_MS', 'querySelectorAll(', 'collectTabMediaElements']);
}

async function checkFrameMediaControlBoundary() {
  const brokerPath = 'src/domains/protection/background/runtime/FrameMediaControlBroker.js';
  const receiverPath = 'src/apps/content/mediaFrameProbe.js';
  const routesPath = 'src/domains/tracking/background/trackingFrameMediaHandlers.js';
  const bindingPath = 'src/apps/background/services/runtime/backgroundKernelContentScriptBindings.js';
  const registrationPath = 'src/domains/tracking/background/ManagedContentScriptSync.js';
  const broker = await readUtf8(brokerPath);
  const receiver = await readUtf8(receiverPath);
  requireIncludes(broker, brokerPath, [
    'readAdmission', 'admissionLeaseId', 'requireFrameMediaResult',
    '{ documentId: frame.documentId }', 'FRAME_MEDIA_LEASE_MS',
    'FRAME_MEDIA_HOLD_NOT_FOUND', 'verifiedPaused:', 'invalidatePermissions',
    'inventoryRevision', 'receipts',
  ]);
  requireExcludes(broker, brokerPath, ['chrome.storage', 'chrome.scripting', "world: 'MAIN'", 'setInterval(']);
  requireIncludes(receiver, receiverPath, [
    'CONTENT_MEDIA_FRAME_CONTROL_READY', 'CONTENT_MEDIA_FRAME_CONTROL_EXIT',
    'CONTENT_MEDIA_FRAME_CONTROL_DISCOVER', 'validateBackgroundSender',
    'receiverDocumentId', 'receiverInstanceId', 'MEDIA_FRAME_CONTROL_LEASE_EXPIRED',
  ]);
  requireExcludes(receiver, receiverPath, ['chrome.storage', 'chrome.tabs', 'chrome.scripting', 'window.postMessage(']);
  requireIncludes(await readUtf8(routesPath), routesPath, [
    'isTrustedExtensionTabSender', 'isTrustedExtensionPageSender',
    'resolveSenderDocumentId', 'FRAME_MEDIA_DOCUMENT_INACTIVE',
  ]);
  requireIncludes(await readUtf8(bindingPath), bindingPath, [
    'createFrameMediaControlBroker', 'getInterventionAdmissionService().snapshot()',
    'hasPermission: permissionsContainsStrict',
  ]);
  requireIncludes(await readUtf8(registrationPath), registrationPath, [
    'allFrames: false', 'mediaFrameMatches', 'applyMediaFrameContentScript({ matches: mediaFrameMatches })',
  ]);
}

async function main() {
  await checkRequiredFiles();
  await checkCanonicalRuntimeWiring();
  await checkMediaDiscoveryOwnership();
  await checkFrameMediaControlBoundary();
  await checkNoRuntimeBypass();
  await checkNoUndeclaredSessionModifierWriters();
  await checkShortFormPlatformImportBoundary();
  await checkSelectorTargetingContracts();
  await checkSiteTargetingSemanticNegativeControl();
  await checkSiteLayoutCycleOracle();
  await checkEnsoFeedEpisodeAuthority();
  await checkEnsoCadenceAndPresentationBoundary();
  await checkFeedTopologyCertificationBoundary();
  await checkFeedTempoObservationBoundary();
  await checkEnsoSemanticSurfaceContracts();
  await checkBasicStrategyReferenceContracts();

  if (failures.length > 0) {
    console.error('[friction-runtime-architecture] FAIL:');
    failures.forEach((message) => console.error(`- ${message}`));
    process.exit(1);
  }

  console.log('[friction-runtime-architecture] PASS: friction modifier and Enso feed-episode boundaries are intact.');
}

main().catch((error) => {
  console.error('[friction-runtime-architecture] Unexpected error:', error);
  process.exit(1);
});
