const FULL_ONLY_TESTS = Object.freeze([
  'tests/contentBootstrapArtifactContract.test.js',
  'tests/themes/themeWidgetRegistry.test.js',
  'tests/themes/zenGenerationContracts.test.js',
  'tests/themes/zenBonsaiGoldenReplayFixtureContract.test.js',
]);

const OPTIONAL_LOGIC_FAST_TESTS = Object.freeze([
  'tests/themes/zenEngineIsolation.test.js',
]);

const CRITICAL_LOGIC_TESTS = Object.freeze([
  'tests/backgroundMessageRouter.test.js',
  'tests/bootstrapContentRuntimePhases.test.js',
  'tests/capabilityGateSelectivePermissions.test.js',
  'tests/clseMessageHandlerSecurity.test.js',
  'tests/clseSettingsStore.test.js',
  'tests/contentBootstrapArtifactContract.test.js',
  'tests/contentLoaderClassicScriptContract.test.js',
  'tests/contentScriptOrchestrator.test.js',
  'tests/cryptoService.test.js',
  'tests/indexedDbImportSnapshotHardening.test.js',
  'tests/keyStore.test.js',
  'tests/managedContentScriptSyncPermissionMode.test.js',
  'tests/passcodeSecurityContract.test.js',
  'tests/protectionEngineContract.test.js',
  'tests/protectionProfileResolver.test.js',
  'tests/protectionProtocolContracts.test.js',
  'tests/protectionRuntimeCoordinator.test.js',
  'tests/protectionRuntimeDecisionService.test.js',
  'tests/protectionRuntimeSnapshotBuilder.test.js',
  'tests/protectionRuntimeStateCoordinator.test.js',
  'tests/protectionSettingsQueryService.test.js',
  'tests/protocolSettingsCommandService.test.js',
  'tests/protocolSettingsQueryService.test.js',
  'tests/runtimeSessionStore.test.js',
  'tests/securityDomainPermissionsHardening.test.js',
  'tests/senderTrust.test.js',
  'tests/settingsClientContracts.test.js',
  'tests/settingsCommandBus.test.js',
  'tests/settingsServiceApplyChange.test.js',
  'tests/settingsTransport.test.js',
  'tests/settingsUpdateKeys.test.js',
  'tests/statsCollector.test.js',
  'tests/statsQueryHandlersTemporalProtocol.test.js',
  'tests/statsRuntimeServiceRuntimePath.test.js',
  'tests/storageRetentionPolicy.test.js',
  'tests/storageSurfaceRegistry.test.js',
  'tests/tabTimeTrackerRolloverMonotonic.test.js',
  'tests/themePreferenceRepository.test.js',
  'tests/themePreferenceSettingsQueryService.test.js',
  'tests/themeStateRegistry.test.js',
  'tests/themes/themeBootLoaderRegistry.test.js',
  'tests/themes/themeRuntimeThemeIdContract.test.js',
  'tests/themes/themeWidgetRegistry.test.js',
  'tests/themes/toolsArtifactContracts.test.js',
  'tests/trackingMessageHandlerSecurity.test.js',
  'tests/trackingMessageHandlerSettingsContract.test.js',
  'tests/trackingRuntimeMessageRoutes.test.js',
  'tests/workerRequestClient.test.js',
  'tests/workerRuntimeContracts.test.js',
]);

const CRITICAL_DOM_TESTS = Object.freeze([
  'tests/contentLoaderRootVisualPreload.test.js',
  'tests/interactionManagerDocumentStartSafety.test.js',
  'tests/shortFormYoutubeSelectorSafety.test.js',
  'tests/textPipelineDirectSelectors.test.js',
  'tests/textShuffleDirectSelectors.test.js',
  'tests/useSecurityStoreSettingsSync.test.js',
  'tests/visualManagerRootFilter.test.js',
]);

const ROOT_THEME_LOGIC_FAST_TESTS = Object.freeze([
  'tests/bonsaiRepository.test.js',
  'tests/bootPrewarmThemeNormalization.test.js',
  'tests/frictionIndicatorThemeAdapter.test.js',
  'tests/sakuraColdStartCacheFailFast.test.js',
  'tests/sakuraCompilerFailFast.test.js',
  'tests/sakuraLatentOptimizerFailFast.test.js',
  'tests/sakuraMainSnapshotFailFast.test.js',
  'tests/sakuraOptimizationResultFailFast.test.js',
  'tests/sakuraSobolColdStartFailFast.test.js',
  'tests/sakuraStateReconcilerFailFast.test.js',
  'tests/themePreferenceRepository.test.js',
  'tests/themePreferenceSettingsQueryService.test.js',
  'tests/themeStateRegistry.test.js',
  'tests/vnextOptimizationResultFailFast.test.js',
  'tests/zenClassicActionController.test.js',
  'tests/zenClassicPresentationModel.test.js',
  'tests/zenClassicViewPreferences.test.js',
  'tests/zenClassicViewport.test.js',
  'tests/zenClassicWorkspacePanels.test.js',
  'tests/zenClassicWorkspaceRuntime.test.js',
  'tests/zenClassicWorkspaceShell.test.js',
  'tests/zenCoreConfigFailFast.test.js',
  'tests/zenLatentControlPanel.test.js',
  'tests/zenMainScratchpadStateFailFast.test.js',
  'tests/zenModelStateFailFast.test.js',
  'tests/zenPondWorkerRuntimeClientAck.test.js',
  'tests/zenPondWorkerSceneSessionControl.test.js',
  'tests/zenThemeModelState.test.js',
  'tests/zenWorkerControlChannelCoalescer.test.js',
  'tests/zenWorkerRuntimeFlag.test.js',
]);

const DOM_FAST_TESTS = Object.freeze([
  'tests/artifactDisclosureSnapshotResource.test.js',
  'tests/audioDullingActivationChip.test.js',
  'tests/backgroundStorageRetentionTasks.test.js',
  'tests/behaviorHubLifecycle.test.js',
  'tests/clseAlertOverlay.test.js',
  'tests/contentLoaderRootVisualPreload.test.js',
  'tests/dashboardLaunchContext.test.js',
  'tests/dashboardLoadingPolicy.test.js',
  'tests/dopamineBingeDetector.test.js',
  'tests/ensoGateGesture.test.js',
  'tests/ensoShortFormRuntimeScenarios.test.js',
  'tests/ensoSpawnPolicy.test.js',
  'tests/feedEndpointLease.test.js',
  'tests/feedEndpointRuntimeIntegration.test.js',
  'tests/feedFlowRuntimeScaffold.test.js',
  'tests/feedFlowSnapshotEvents.test.js',
  'tests/feedSupplyProbe.test.js',
  'tests/feedSurfaceProfiles.test.js',
  'tests/feedTerminusController.test.js',
  'tests/feedTerminusSurface.test.js',
  'tests/feedTopologyLocalCertification.test.js',
  'tests/frictionTargetingPerformanceGuards.test.js',
  'tests/gateInterstitialSurface.test.js',
  'tests/globalSentinelResidueOverlay.test.js',
  'tests/inputDelayManager.test.js',
  'tests/inputVisualBrakeManager.test.js',
  'tests/interactionManagerClickBypass.test.js',
  'tests/interactionManagerClickLifecycle.test.js',
  'tests/interactionManagerDocumentStartSafety.test.js',
  'tests/interactionManagerEnsoFeedEpisode.test.js',
  'tests/interactionManagerScrollLifecycle.test.js',
  'tests/lazySocialMetricsManager.test.js',
  'tests/navigationButtonLockManager.test.js',
  'tests/nudgeEntrySeamGate.test.js',
  'tests/nudgeExtensionFrameWorkerProbe.test.js',
  'tests/nudgeExtensionFrameWorkerRuntime.test.js',
  'tests/nudgeGameHud.test.js',
  'tests/nudgeGameMediaSuppression.test.js',
  'tests/nudgeGameRuntimeCanvasMode.test.js',
  'tests/nudgeGameThemePresentation.test.js',
  'tests/nudgeGlobalSentinelInputGate.test.js',
  'tests/nudgeOverlayHostRiftInvite.test.js',
  'tests/nudgePresageSignal.test.js',
  'tests/nudgeSiteFurinInputGate.test.js',
  'tests/nudgeSwarmEngine.test.js',
  'tests/nudgeSwarmWorkerEntry.test.js',
  'tests/observerHubPerfDebug.test.js',
  'tests/pageMediaActivityObserver.test.js',
  'tests/preferenceStoreSettingsSync.test.js',
  'tests/progression/firstVisionDevelopmentProjection.test.js',
  'tests/protectionControllerNudgeDebugSpawn.test.js',
  'tests/protectionKeyedEffectDedup.test.js',
  'tests/protectionNudgeDispatchContext.test.js',
  'tests/protectionRegistryLazyEffectDiagnostics.test.js',
  'tests/protectionSignalGateCleanup.test.js',
  'tests/protocolStoreInitialize.test.js',
  'tests/protocolStoreSettingsSync.test.js',
  'tests/renderLoop.test.js',
  'tests/ritualSurfaceArbiter.test.js',
  'tests/runtimeDebuggerOverlay.test.js',
  'tests/runtimeDebuggerProbeCatalog.test.js',
  'tests/runtimeDebuggerShortFormOracle.test.js',
  'tests/runtimeDiscoveryLedger.test.js',
  'tests/scrollInputOrchestrator.test.js',
  'tests/scrollSignalTracker.test.js',
  'tests/sentinelProtocolGlobalEntryRuntime.test.js',
  'tests/sentinelProtocolInputController.test.js',
  'tests/sentinelProtocolPresentationAdapter.test.js',
  'tests/shortFormBlockManagerLifecycle.test.js',
  'tests/shortFormFacebookRules.test.js',
  'tests/shortFormInstagramRules.test.js',
  'tests/shortFormTikTokRules.test.js',
  'tests/shortFormYoutubeSelectorSafety.test.js',
  'tests/shortMediaAttentionProbe.test.js',
  'tests/socialMetricsDiagnosticsSnapshotRuntime.test.js',
  'tests/socialMetricsDocumentNodeIdentity.test.js',
  'tests/socialMetricsManager.apiContract.test.js',
  'tests/socialMetricsManager.instagramFastReject.test.js',
  'tests/socialMetricsManager.semanticPlatforms.test.js',
  'tests/socialMetricsManager.tiktok.test.js',
  'tests/socialMetricsManager.xMetadata.test.js',
  'tests/socialMetricsManager.youtubeMetadata.test.js',
  'tests/socialMetricsYoutubeFreshnessBadge.test.js',
  'tests/socialMetricsManagerDebugInstrumentation.test.js',
  'tests/socialMetricsManagerLifecycle.test.js',
  'tests/socialMetricsOwnedMutationLedger.test.js',
  'tests/socialMetricsRuntimePeerContracts.test.js',
  'tests/socialMetricsSelectorDriftExpansion.test.js',
  'tests/socialMetricsTargetingHealthProjector.test.js',
  'tests/socialSelectorDriftIndependentCorpus.audit.test.js',
  'tests/textEffectTargetSelectors.test.js',
  'tests/textPipelineDirectSelectors.test.js',
  'tests/textShuffleDirectSelectors.test.js',
  'tests/textShuffleManagerLifecycle.test.js',
  'tests/textShuffleMutationQueue.test.js',
  'tests/textShuffleOwnershipLedger.test.js',
  'tests/themes/zenAssetCacheFlowerVariants.test.js',
  'tests/themes/zenBonsaiRendererWorkerActualAlpha.test.js',
  'tests/themes/zenBonsaiRendererWorkerLifecycle.test.js',
  'tests/themes/zenEngineIsolation.test.js',
  'tests/themes/zenFishRendererBoundary.test.js',
  'tests/themes/zenInteractionControlPlane.test.js',
  'tests/themes/zenPixiKoiDisplayObjects.test.js',
  'tests/themes/zenSelectionAutoRelease.test.js',
  'tests/themes/zenVnextComparePairPolicy.test.js',
  'tests/themes/zenVnextFeedbackStore.test.js',
  'tests/themes/zenVnextGrowthVM.test.js',
  'tests/themes/zenVnextGrowthVMV2.test.js',
  'tests/themes/zenVnextGrowthVMV3.test.js',
  'tests/themes/zenVnextLoopState.test.js',
  'tests/themes/zenVnextPreferenceModel.test.js',
  'tests/themes/zenVnextPreferenceTraining.test.js',
  'tests/themes/zenVnextProvenanceBuffer.test.js',
  'tests/themes/zenVnextTopologyAdapter.test.js',
  'tests/themes/zenWaterLayerMapping.test.js',
  'tests/themes/zenWaterSurfaceField.test.js',
  'tests/topFrameMediaDiagnosticsReporter.test.js',
  'tests/useSecurityStoreSettingsSync.test.js',
  'tests/videoElementObserver.test.js',
  'tests/videoManager.test.js',
  'tests/videoSkipControlSurfaceQaContentRelay.test.js',
  'tests/videoSkipControlSurfaceRuntime.test.js',
  'tests/videoSkipIndicatorView.test.js',
  'tests/videoSkipManagerLifecycle.test.js',
  'tests/videoSkipManagerSeekGuard.test.js',
  'tests/visualHarnessSceneContract.test.js',
  'tests/visualManagerFullscreenRelaxation.test.js',
  'tests/visualManagerLifecycle.test.js',
  'tests/visualManagerMediaGate.test.js',
  'tests/visualManagerRootFilter.test.js',
  'tests/youtubeSelectorDriftCorpusQaProtocol.test.js',
  'tests/youtubeSelectorDriftIndependentCorpus.audit.test.js',
  'tests/youtubeSelectorDriftMetamorphic.test.js',
  'tests/zenBonsaiDevelopmentalM23SemanticCounterfactualClauseBifurcation.test.js',
  'tests/zenBonsaiDevelopmentalM24SemanticEpisodeRelationLexicon.test.js',
  'tests/zenClassicViewport.test.js',
  'tests/zenLatentControlPanel.test.js',
  'tests/zenMainControlBar.test.js',
  'tests/zenMainSignalScannerRuntime.test.js',
]);

function normalizePath(filePath) {
  return String(filePath || '').replace(/\\/g, '/');
}

export function getFullOnlyTests() {
  return [...FULL_ONLY_TESTS];
}

export function getDomFastTests() {
  return [...DOM_FAST_TESTS];
}

export function getOptionalLogicFastTests() {
  return [...OPTIONAL_LOGIC_FAST_TESTS];
}

export function getCriticalLogicTests() {
  return [...CRITICAL_LOGIC_TESTS];
}

export function getCriticalDomTests() {
  return [...CRITICAL_DOM_TESTS];
}

export function getRootThemeLogicFastTests() {
  return [...ROOT_THEME_LOGIC_FAST_TESTS];
}

export function isTmpFastExcluded(filePath) {
  return /^tests\/tmp[^/]*\.test\.(js|jsx)$/u.test(normalizePath(filePath));
}

export function isFullOnlyFastTest(filePath) {
  const normalized = normalizePath(filePath);
  return isTmpFastExcluded(normalized)
    || FULL_ONLY_TESTS.includes(normalized);
}

export function isDomFastTest(filePath) {
  const normalized = normalizePath(filePath);
  return normalized.endsWith('.jsx') || DOM_FAST_TESTS.includes(normalized);
}

export function isRootThemeLogicFastTest(filePath) {
  return ROOT_THEME_LOGIC_FAST_TESTS.includes(normalizePath(filePath));
}

export function classifyFastTestFile(filePath) {
  const normalized = normalizePath(filePath);
  if (isFullOnlyFastTest(normalized)) {
    return 'full';
  }
  if (isDomFastTest(normalized)) {
    return 'dom';
  }
  return 'logic';
}
