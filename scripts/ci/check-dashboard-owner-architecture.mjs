#!/usr/bin/env node

import fs from 'node:fs/promises';
import path from 'node:path';

const rootDir = process.cwd();
const failures = [];

const REQUIRED_FILES = Object.freeze([
  'src/apps/dashboard/bootstrap/dashboardBootThemeContext.js',
  'src/apps/dashboard/bootstrap/dashboardBootShellThemeContext.js',
  'src/apps/dashboard/bootstrap/dashboardDocumentThemeInitialization.js',
  'src/apps/dashboard/bootstrap/dashboardEntryStageTraceContract.js',
  'src/apps/dashboard/bootstrap/dashboardLaunchContext.js',
  'src/apps/dashboard/bootstrap/dashboardThemeBootRuntimeHandoff.js',
  'src/themes/core/runtime/dashboardBootRuntime.js',
  'src/apps/dashboard/tabs/loadingPolicy.js',
  'src/apps/dashboard/tabs/registry.js',
  'src/apps/dashboard/loading/preloadDashboardTab.js',
  'src/apps/dashboard/loading/DashboardTabStateSurfaces.jsx',
  'src/apps/dashboard/loading/DashboardActionAsyncBoundary.jsx',
  'src/apps/dashboard/tabs/experiment/experimentLabCatalog.js',
  'src/apps/dashboard/tabs/experiment/ExperimentHubTab.jsx',
  'src/apps/dashboard/tabs/experiment/ExperimentLabOutlet.jsx',
  'src/apps/dashboard/tabs/experiment/ExperimentWorkspace.jsx',
  'src/apps/dashboard/tabs/experiment/clse/CLSELab.jsx',
  'src/apps/dashboard/tabs/sites/preloadSitesTabData.js',
  'src/apps/dashboard/tabs/schedule/components/ScheduleSpecialSessionWorkspace.jsx',
  'src/apps/dashboard/tabs/settings/components/SettingsControlPrimitives.jsx',
  'src/apps/dashboard/tabs/settings/layout/SettingsShell.jsx',
  'src/apps/dashboard/tabs/settings/SettingsSecondarySectionBoundary.jsx',
  'src/apps/dashboard/tabs/settings/settingsPermissionProjection.js',
  'src/apps/dashboard/tabs/settings/settingsSectionModuleResource.js',
  'src/apps/dashboard/tabs/settings/sections/SettingsSafetySection.jsx',
  'src/apps/dashboard/tabs/settings/sections/SettingsWorkspaceSection.jsx',
  'src/apps/dashboard/tabs/settings/sections/SettingsProtectionSection.jsx',
  'src/apps/dashboard/artifacts/artifactDisclosureSnapshotResource.js',
  'src/apps/dashboard/artifacts/artifactWorkspaceLayout.css',
  'src/apps/dashboard/hooks/useStatusController.js',
  'src/apps/dashboard/hooks/useProtectionRuntimeSubscription.js',
  'src/apps/dashboard/hooks/useProtectionNudgeDispatchControl.js',
  'src/apps/dashboard/hooks/artifactSettings/useArtifactSettingsCommands.js',
  'src/apps/dashboard/hooks/artifactSettings/useFlareArtifactSettingsFamily.js',
  'src/apps/dashboard/hooks/useProtectionEchoArtifactControl.js',
  'src/apps/dashboard/hooks/useProtectionBlockedHistoryControl.js',
  'src/apps/dashboard/hooks/useProtectionArtifactWorkflowGeneration.js',
  'src/apps/dashboard/hooks/protectionRuntimeSubscriptionBridge.js',
  'src/apps/dashboard/hooks/useProtectionArtifactsControlPlane.js',
  'src/apps/dashboard/tabs/tools/selectedArtifactControllerResource.js',
  'src/apps/dashboard/tabs/tools/selectedControllers/SelectedEchoArtifactController.jsx',
  'src/apps/dashboard/tabs/tools/components/SelectedArtifactControllerBoundary.jsx',
  'src/apps/dashboard/tabs/tools/components/StorageSupportWorkspace.jsx',
  'src/apps/dashboard/tabs/tools/useStorageSupportVisibility.js',
  'src/apps/dashboard/settings/controls/SettingRow.jsx',
  'src/apps/dashboard/stores/useSecurityStore.js',
  'src/apps/dashboard/stores/settingsCommandBus.js',
  'src/apps/dashboard/stores/protocolStoreCommands.js',
  'src/apps/dashboard/utils/protectionArtifactsControlPlane.js',
  'src/domains/protection/contracts/compiledRuntimeFilterPlanContract.js',
  'src/domains/protection/runtime/canonicalArtifactTelemetry.js',
  'src/apps/dashboard/tabs/filter/useFilterSettingsEditor.js',
  'src/apps/dashboard/tabs/filter/useFilterRuntimeModel.js',
  'src/apps/dashboard/tabs/main/home/dailyFlowPressureProfile.js',
  'src/apps/dashboard/tabs/main/home/dailyFlowViewModel.js',
  'src/apps/dashboard/tabs/main/home/HomeScanWorkspace.jsx',
  'src/apps/dashboard/presentation/ZenAppPetalHost.jsx',
  'src/themes/plugins/zen/api/petalField.js',
  'src/themes/plugins/zen/api/petalSource.js',
  'src/themes/plugins/zen/presentation/petals/ZenAppPetalLayer.jsx',
  'src/themes/plugins/zen/runtime/petals/zenAppPetalField.js',
  'src/themes/plugins/zen/runtime/petals/zenPetalFieldBridge.js',
  'src/apps/dashboard/tabs/main/home/SessionSummaryAiEnrichment.jsx',
  'src/apps/dashboard/ai/sessionSummaryPresentation.js',
  'src/apps/dashboard/ai/SessionSummaryAiPanel.jsx',
  'src/apps/dashboard/presentation/mainPresentationDecision.js',
  'src/apps/dashboard/presentation/mainPresentationSessionState.js',
  'src/apps/dashboard/presentation/useMainPresentationScene.js',
  'src/apps/dashboard/presentation/dashboardAppearanceClock.js',
  'src/apps/dashboard/presentation/useDashboardZenAmbientPresentation.js',
  'src/apps/dashboard/components/ZenAppearanceTimeControl.jsx',
  'src/themes/core/presentation/mainSceneContract.js',
  'src/themes/plugins/zen/presentation/environment/zenAmbientPresentation.js',
  'src/themes/plugins/zen/presentation/environment/zenShellMaterialProjection.js',
  'src/themes/plugins/zen/presentation/environment/zenEnvironmentShellMaterials.js',
  'src/themes/plugins/zen/presentation/main/zenMainSceneProjection.js',
  'src/apps/dashboard/tabs/main/home/homeBriefViewModel.js',
  'src/apps/dashboard/tabs/main/home/homeHabitCueViewModel.js',
  'src/apps/dashboard/tabs/main/home/rhythmTopSitesViewModel.js',
  'src/apps/dashboard/stores/analysisSnapshotRefreshPolicy.js',
  'src/apps/dashboard/stores/analysisStoreResponseContracts.js',
]);

const FORBIDDEN_FILES = Object.freeze([
  'src/apps/dashboard/tabs/main/home/ZenHomeBlossomField.jsx',
  'src/themes/plugins/zen/api/homeBlossomField.js',
  'src/apps/dashboard/loading/policy.js',
  'src/apps/dashboard/utils/tabAccessPolicy.js',
  'src/apps/dashboard/tabs/tools/useProtectionRuntimeSubscription.js',
  'src/apps/dashboard/tabs/tools/protectionRuntimeSubscriptionBridge.js',
  'src/apps/dashboard/tabs/tools/utils.js',
  'src/apps/dashboard/tabs/tools/artifactRuntimeState.js',
  'src/apps/dashboard/tabs/theme/ThemeTab.jsx',
  'src/apps/dashboard/tabs/clse/CLSETab.jsx',
  'src/apps/dashboard/labEntries/clseEntry.dev.js',
  'src/apps/dashboard/labEntries/clseEntry.public.js',
  'src/apps/dashboard/tabs/settings/components/BehaviorInsightsCard.jsx',
  'src/apps/dashboard/tabs/settings/components/DisplayThemeSelector.jsx',
  'src/apps/dashboard/tabs/settings/components/SafetyControlPanel.jsx',
  'src/apps/dashboard/tabs/settings/components/SettingsChecklistPanel.jsx',
  'src/apps/dashboard/tabs/settings/components/SettingsOverview.jsx',
  'src/apps/dashboard/tabs/settings/components/SettingsSurfaceCard.jsx',
  'src/apps/dashboard/tabs/settings/layout/SettingsSideNav.jsx',
  'src/apps/dashboard/components/DevTimeMasterSlider.jsx',
  'src/lib/devClock.js',
]);

const IMPORT_SCAN_ROOTS = Object.freeze([
  'src',
  'tests',
  'scripts',
]);

const FORBIDDEN_IMPORT_TOKENS = Object.freeze([
  'ZenHomeBlossomField.jsx',
  'homeBlossomField.js',
  'apps/dashboard/loading/policy.js',
  'apps/dashboard/utils/tabAccessPolicy.js',
  'apps/dashboard/tabs/tools/useProtectionRuntimeSubscription.js',
  'apps/dashboard/tabs/tools/protectionRuntimeSubscriptionBridge.js',
  'apps/dashboard/tabs/tools/utils.js',
  'apps/dashboard/tabs/tools/artifactRuntimeState.js',
  '@dashboard-clse-tab-entry',
  'apps/dashboard/tabs/clse/CLSETab.jsx',
  'lib/devClock.js',
]);

const REQUIRED_CONTRACTS = Object.freeze([
  {
    file: 'src/apps/dashboard/presentation/dashboardAppearanceClock.js',
    includes: [
      "REALTIME: 'realtime'",
      "CUSTOM: 'custom'",
      'resolveDashboardAppearanceEpochMs',
      'DASHBOARD_APPEARANCE_CLOCK_MODE_INVALID',
      'DASHBOARD_APPEARANCE_REALTIME_EPOCH_INVALID',
    ],
  },
  {
    file: 'src/apps/dashboard/presentation/useDashboardZenAmbientPresentation.js',
    includes: [
      'ZEN_REALTIME_TEMPORAL_AUTHORITY',
      'buildZenTemporalAuthority',
      'resolveDashboardAppearanceEpochMs({',
      'resolveZenAmbientPresentation({',
      'clockMode: appearanceClockMode === DASHBOARD_APPEARANCE_CLOCK_MODES.REALTIME',
      'environmentMode,',
      'appearanceClockMode !== DASHBOARD_APPEARANCE_CLOCK_MODES.REALTIME',
      'temporalAuthority,',
    ],
  },
  {
    file: 'src/apps/dashboard/components/ZenAppearanceTimeControl.jsx',
    includes: [
      'onModeChange',
      'onCustomHourChange',
      'DASHBOARD_APPEARANCE_CLOCK_MODES.CUSTOM',
    ],
  },
  {
    file: 'src/themes/plugins/zen/presentation/environment/zenShellMaterialProjection.js',
    includes: [
      'ZEN_SHELL_MATERIAL_PROJECTION_VERSION',
      'normalizeZenWorldAmbientGrammar',
      'projectZenShellMaterials',
      'requireZenShellMaterialProjection',
      'ZEN_SHELL_MATERIAL_PROJECTION_CONTRAST_INVALID',
      'ZEN_SHELL_MATERIAL_ENVIRONMENT_FIELD_INVALID',
    ],
  },
  {
    file: 'src/themes/plugins/zen/presentation/environment/zenEnvironmentShellMaterials.js',
    includes: [
      'export function resolveZenEnvironmentShellMaterials(environmentState)',
      'const materials = new WeakMap()',
      'requireZenWorldAmbientGrammar(environmentState.ambientChromaticState)',
      'projectZenShellMaterials(chromaticState, environmentState)',
      'ZEN_SHELL_MATERIAL_ENVIRONMENT_REQUIRED',
    ],
  },
  {
    file: 'src/themes/plugins/zen/presentation/environment/zenAmbientPresentation.js',
    includes: [
      "from './zenShellMaterialProjection.js'",
      "from './zenEnvironmentShellMaterials.js'",
      'const shellMaterials = resolveZenEnvironmentShellMaterials(envState)',
      'resolveZenWorldWeatherSkyPalette',
      'shellMaterials,',
      "'--zen-ambient-surface'",
      "'--zen-ambient-text-subtle'",
      "'--zen-ambient-border-strong'",
    ],
  },
  {
    file: 'src/themes/plugins/zen/theme.js',
    includes: [
      "[data-theme='zen'] body",
      '--color-surface: var(--zen-ambient-surface)',
      '--color-on-surface: var(--zen-ambient-text)',
      '--color-on-surface-subtle: var(--zen-ambient-text-subtle)',
    ],
  },
  {
    file: 'src/domains/protection/contracts/compiledRuntimeFilterPlanContract.js',
    includes: [
      'requireCompiledRuntimeFilterPlan',
      'normalizeCompiledRuntimeInterventionPlan',
      'projectCompiledRuntimeSocialMetricsSetting',
      'projectCompiledRuntimeFilterPlanForTelemetry',
      'COMPILED_RUNTIME_FILTER_ENTRY_VALUE_REQUIRED',
      'requireAdaptiveFrictionEntry(featureKey, entry)',
    ],
  },
  {
    file: 'src/domains/settings/config/adaptiveFrictionProfiles.js',
    includes: [
      'requireVisualFrictionEntry(key, entry)',
      "Object.hasOwn(entry, 'frictionModifierScale') ? requireVisualFrictionScale(entry.frictionModifierScale).strengthPermille : 1000",
      'getVisualFrictionProfile(key, selectedBand, entry.value, scale)',
      'requireTextRhythmRuntimeProfile(entry.value)',
      'ADAPTIVE_FRICTION_ENTRY_BAND_MISMATCH:textRhythm',
    ],
  },
  {
    file: 'src/domains/settings/config/visualFrictionProfiles.js',
    includes: [
      'export function requireVisualFrictionScale(value)',
      "Object.keys(value).sort().join('|') !== 'priority|strengthPermille'",
      'value.strengthPermille < 0 || value.strengthPermille > 1000',
      '!Number.isInteger(value.priority)',
      'VISUAL_FRICTION_SCALE_INVALID',
      "Object.hasOwn(entry, 'frictionModifierScale') ? requireVisualFrictionScale(entry.frictionModifierScale).strengthPermille : 1000",
      'getVisualFrictionProfile(key, entry.band, requireVisualFrictionStrength(entry.strength), scale)',
      '!Object.is(entry.value, profile.value)',
      'VISUAL_FRICTION_ENTRY_VALUE_MISMATCH',
    ],
  },
  {
    file: 'src/domains/protection/contracts/protectionRuntimeSnapshotBridge.js',
    includes: [
      './compiledRuntimeFilterPlanContract.js',
      'normalizeCompiledRuntimeInterventionPlan(runtime.plan)',
    ],
  },
  {
    file: 'src/domains/protection/runtime/canonicalArtifactTelemetry.js',
    includes: [
      '../contracts/compiledRuntimeFilterPlanContract.js',
      'projectCompiledRuntimeFilterPlanForTelemetry(',
    ],
  },
  {
    file: 'src/apps/dashboard/stores/settingsCommandBus.js',
    includes: [
      'settingsCommitAcknowledgement.js',
      'settingsDashboardCommandContract.js',
      'requireSettingsCommitAcknowledgement(result?.items, dirtyKeys)',
      'assertSettingsCommandChannelPatch(normalizedChannel, nextPatch)',
      'mergeKeys(Object.keys(nextPatch), pendingKeys)',
      'Object.values(channelKeys).flat()',
      'export function createSettingsCommandChannelClient(channel)',
      'export function assertSettingsCommandBusReadAdmission()',
    ],
  },
  {
    file: 'src/apps/dashboard/stores/protocolStoreCommands.js',
    includes: [
      'protocolSettingsClient.js',
      'runProtocolSettingsCommand({',
      'reconcileAcknowledgedProtocolSettings(get, set, result, result.items, intent)',
      'syncProtocolSettingsFromStorage(get, set, Object.keys(acknowledgedItems))',
      'const raw = await readProtocolSettingsSnapshot(defaults)',
      'assertProtocolSettingsReadAdmission();',
    ],
  },
  {
    file: 'src/apps/dashboard/stores/usePreferenceStore.js',
    includes: [
      'preferenceSettingsClient.js',
      'const snapshot = await readThemePreferenceSettingsSnapshot(defaults)',
      'assertPreferenceSettingsReadAdmission();',
      'await reconcilePreferenceSetting(set, result, THEME_PREFERENCE_STORAGE_KEY)',
      'await reconcilePreferenceSetting(set, result, SIDEBAR_DISPLAY_MODE_STORAGE_KEY)',
      'await reconcilePreferenceSetting(set, result, ZEN_RENDER_PRESET_STORAGE_KEY)',
    ],
  },
  ...[
    ['protocolSettingsClient.js', 'assertProtocolSettingsReadAdmission'],
    ['preferenceSettingsClient.js', 'assertPreferenceSettingsReadAdmission'],
  ].map(([file, readAdmission]) => ({
    file: `src/apps/dashboard/stores/${file}`,
    includes: [`export function ${readAdmission}()`, 'return assertSettingsCommandBusReadAdmission();'],
  })),
  {
    file: 'src/domains/settings/config/settingsCommitAcknowledgement.js',
    includes: [
      'export function requireSettingsCommitAcknowledgement(',
      'export function completeSettingsOwnerAcknowledgement({',
      'error.missingKeys = normalizeKeys(missingKeys)',
      'requiredCommittedKeys = []',
    ],
  },
  {
    file: 'src/domains/settings/config/settingsRuntimeCommandAcknowledgement.js',
    includes: [
      'export function requireSettingsRuntimeCommandAcknowledgement(action, response)',
      'export function requireSettingsOwnerCommandAcknowledgement(action, response)',
      'requireSettingsRuntimeCommandContract(action)',
      'contract.acknowledgement.requireChangedKeyItemCoverage',
    ],
  },
  {
    file: 'src/apps/dashboard/DashboardPage.jsx',
    includes: [
      './bootstrap/DashboardAdmissionBoundary.jsx',
      "./tabs/registry.js",
      "./bootstrap/dashboardLaunchContext.js",
      'isDashboardUserControlReleased',
      'const forceMainTabDuringBoot = !bootUserControlReleased',
      'resolveZenMainSceneProjection({ mainPresentationDecision })',
      'environmentMode: mainPresentationProjection?.pond?.environmentMode || null',
    ],
  },
  {
    file: 'src/apps/dashboard/bootstrap/DashboardAdmissionBoundary.jsx',
    includes: [
      'useDashboardProfileMutationLifecycle',
      'useSecurityVaultStatus',
      'generationReadinessEnabled: vault.status.protectionReady === true && !retainVaultReset',
      'DashboardProfileMutationRecovery',
      'onResetFlowRetentionChange={setRetainVaultReset}',
    ],
    excludes: ['chrome.storage', 'localStorage', 'ProfileResetLifecycleRepository'],
  },
  {
    file: 'src/apps/dashboard/bootstrap/bootManager.js',
    includes: [
      'export const isDashboardUserControlReleased = (state)',
      'state?.dismissible === true',
      'state?.forcedVisualRelease === true',
    ],
  },
  {
    file: 'src/apps/dashboard/presentation/mainPresentationDecision.js',
    includes: [
      'themes/core/presentation/mainSceneContract.js',
      'buildMainPresentationSceneCommitKey',
      'renderTarget:',
    ],
  },
  {
    file: 'src/apps/dashboard/presentation/mainPresentationSessionState.js',
    includes: [
      'FIRST_VISION_SCENE_COMMITTED',
      'COVER_OPAQUE',
      'CURRENT_SCENE_COMMITTED',
      'SPENT_PERSISTED',
    ],
  },
  {
    file: 'src/themes/plugins/zen/presentation/main/zenMainSceneProjection.js',
    includes: [
      'themes/core/presentation/mainSceneContract.js',
      'sceneCommitKey',
      'holdAtCover',
      'releaseCover',
      'ZEN_MAIN_VISUAL_EMPHASIS_MODES',
      'FIRST_VISION_VISUAL_EMPHASIS_PHASES',
      'visualEmphasis',
    ],
  },
  {
    file: 'src/apps/dashboard/bootstrap/bootSurfaceWarmup.js',
    includes: [
      "../tabs/registry.js",
      "./dashboardLaunchContext.js",
      "const BOOT_VISUAL_TAB_ID = 'main'",
      'buildInteractiveWarmupEntries({ targetTabId, targetThemeId })',
      'buildDeferredWarmupEntries({',
      'getDashboardTabBootDataPreloadEntries',
      'warmupDashboardSurfaceInteractive',
    ],
  },
  {
    file: 'src/apps/dashboard/tabs/loadingPolicy.js',
    includes: [
      'DASHBOARD_LOADING_CLASSES',
      'DASHBOARD_TAB_LOADING_POLICY_CATALOG',
      'getDashboardTabLoadingPolicyDefinition',
      'getDashboardTabThemeWidgetTypes',
      'getDashboardTabHydrationKeys',
      'getDashboardTabReadinessProfile',
      'getDashboardTabLoadingFrameId',
      'getDashboardTabIntentPreloadScope',
      'getDashboardTabBootPreloadScope',
      'getDashboardTabBootDataPreloadIds',
      'getDashboardTabAllowedAsyncBoundaryIds',
      'isDashboardTabAsyncBoundaryAllowed',
      'DASHBOARD_TAB_ASYNC_BOUNDARY_IDS.MAIN_SESSION_SUMMARY_AI',
      'DASHBOARD_TAB_ASYNC_BOUNDARY_IDS.SETTINGS_SAFETY',
      'DASHBOARD_TAB_ASYNC_BOUNDARY_IDS.SETTINGS_WORKSPACE',
      'DASHBOARD_TAB_ASYNC_BOUNDARY_IDS.SETTINGS_PROTECTION',
      'getDashboardTabDeferredThemeWidgetTypes',
      'resolveDashboardTabWidgetThemeId',
    ],
  },
  {
    file: 'src/apps/dashboard/loading/preloadDashboardTab.js',
    includes: [
      'preloadDashboardTabModule',
      'getPreloadedDashboardTabComponent',
      'DASHBOARD_TAB_MODULE_DEFAULT_EXPORT_MISSING',
      'preloadDashboardTabIntent',
      'preloadDashboardTabBoot',
      'isDashboardTabEnabled',
      'DASHBOARD_TAB_INTENT_TARGET_UNAVAILABLE',
      'DASHBOARD_TAB_INTENT_PRELOAD_SCOPE_INVALID',
      'preloadThemeWidgetChunk',
      'withDynamicImportRecovery',
      'dashboard-tab:',
    ],
  },
  {
    file: 'src/apps/dashboard/loading/DashboardTabStateSurfaces.jsx',
    includes: [
      'getDashboardTabLoadingFrameId',
      "data-loading-frame=\"artifact-workspace\"",
      'artifact-workspace__control-rail',
      'policyTabId',
    ],
  },
  {
    file: 'src/apps/dashboard/tabs/experiment/experimentLabCatalog.js',
    includes: [
      'EXPERIMENT_LAB_SECTION_IDS',
      "CLSE: 'clse'",
      'getExperimentLabReadinessProfile',
      'hasAsyncExperimentLabModule',
    ],
  },
  {
    file: 'src/apps/dashboard/tabs/experiment/ExperimentLabOutlet.jsx',
    includes: [
      "import('./clse/CLSELab.jsx')",
      "import('./ExperimentWorkspace.jsx')",
      'preloadExperimentLabSection',
      'preloadExperimentLabIntent',
      'getDashboardTabReadinessProfile',
      'preloadThemeWidgetChunk',
      'ExperimentLabModuleErrorBoundary',
      'resetExperimentLabModulePreloadCache',
      'isDynamicImportFailure',
      'withDynamicImportRecovery',
      'reloadAfterDynamicImportFailure',
      'policyTabId="experiment"',
    ],
  },
  {
    file: 'src/apps/dashboard/tabs/experiment/clse/CLSELab.jsx',
    includes: [
      'export default function CLSELab',
      'Promise.all([',
      'hasResolvedSnapshotRef',
      'requestRevisionRef',
      'fetchDiagnostics',
      'diagnosticsRevisionRef',
      'controlDraftDirtyRef',
      "subTab === 'baseline' && BaselineView()",
    ],
  },
  {
    file: 'src/apps/dashboard/tabs/tools/components/useArtifactGalleryController.js',
    includes: [
      'getThemeWidgetChunkState',
      'ARTIFACT_WIDGET_PRELOAD_NOT_READY',
      'selectionRequestRevisionRef',
      'canSelectArtifactIndex',
      'isArtifactIndexSelectable',
      "phase: 'requested'",
      'artifactWidgetSignature',
    ],
  },
  {
    file: 'src/themes/core/registry/index.js',
    includes: [
      'getThemeWidgetChunkState',
      'getWidgetChunkState',
    ],
  },
  {
    file: 'src/apps/dashboard/artifacts/artifactDisclosureSnapshotResource.js',
    includes: [
      'readArtifactDisclosureSnapshotResource',
      'subscribeArtifactDisclosureSnapshotResource',
      'if (inFlightRead)',
      'return inFlightRead',
    ],
  },
  {
    file: 'src/apps/dashboard/tabs/registry.js',
    includes: [
      "./loadingPolicy.js",
      'getDashboardTabLoadingPolicyDefinition',
      'requireDashboardTabCopyValue',
      'DASHBOARD_TAB_ROUTE_COPY_REQUIRED',
      'DASHBOARD_TAB_ICON_REQUIRED',
      "load: () => import('./main/MainTab.jsx')",
      "load: () => import('./sites/SitesTab.jsx')",
      "import('./sites/preloadSitesTabData.js')",
      'getDashboardTabBootDataPreloadEntries',
    ],
  },
  {
    file: 'src/apps/dashboard/labEntries/experimentEntry.dev.js',
    includes: [
      "import('../tabs/experiment/ExperimentHubTab.jsx')",
    ],
  },
  {
    file: 'src/apps/dashboard/bootstrap/dashboardLaunchContext.js',
    includes: [
      "candidate === 'notification'",
    ],
  },
  {
    file: 'src/apps/dashboard/tabs/settings/components/NotificationsPanel.jsx',
    includes: [
      'NOTIFICATIONS_PANEL_MASTER_HANDLER_REQUIRED',
    ],
  },
  {
    file: 'src/apps/dashboard/tabs/settings/components/AppChromePanel.jsx',
    includes: [
      'SETTINGS_APP_CHROME_SAVE_FAILED',
      'describeAppChromeActionError',
    ],
  },
  {
    file: 'src/apps/dashboard/tabs/settings/components/PermissionGate.jsx',
    includes: [
      'localUsagePolicyRequiresPrecisionPermission',
      'FlowHistoryControls',
      'PERMISSION_GATE_USAGE_POLICY_HANDLER_REQUIRED',
      'PRECISION_RAW_DATA_RESULT_INVALID',
      '<SettingsFeedback message={statusMessage} tone="danger" />',
    ],
  },
  {
    file: 'src/apps/dashboard/tabs/settings/components/SecurityPanel.jsx',
    includes: [
      '<div className="contents">',
    ],
  },
  {
    file: 'src/apps/dashboard/tabs/settings/components/DataLifecyclePanel.jsx',
    includes: [
      "resultTone = 'neutral'",
      'tone={resultTone}',
    ],
  },
  {
    file: 'src/apps/dashboard/tabs/settings/components/LanguagePanel.jsx',
    includes: [
      'SETTINGS_LANGUAGE_CHANGE_FAILED',
      'describeLanguageActionError',
      'LANGUAGE_REGION_SOLAR_HANDLER_REQUIRED',
      'SOLAR_LOCATION_MODES.MANUAL',
    ],
  },
  {
    file: 'src/apps/dashboard/tabs/settings/components/SettingsControlPrimitives.jsx',
    includes: [
      'export function SettingsLedger(',
      'export function SettingsGroup(',
      'export function SettingsRow(',
      'export function SettingsChoiceGroup(',
      'export function SettingsSwitch(',
      'export function SettingsFeedback(',
      'export function SettingsInlineTask(',
      'export function SettingsDisclosure(',
    ],
  },
  {
    file: 'src/apps/dashboard/tabs/settings/settingsSectionModuleResource.js',
    includes: [
      "import('./sections/SettingsSafetySection.jsx')",
      "import('./sections/SettingsWorkspaceSection.jsx')",
      "import('./sections/SettingsProtectionSection.jsx')",
      "boundaryId: 'dashboard-settings-protection'",
      'withDynamicImportRecovery',
      'loadSettingsSecondarySectionModule',
      'getReadySettingsSecondarySectionComponent',
      'scheduleSettingsSecondarySectionPreloads',
      'preloadSettingsSecondarySectionIntent',
      'SETTINGS_SECONDARY_SECTION_IDLE_TIMEOUT_MS',
    ],
  },
  {
    file: 'src/apps/dashboard/tabs/settings/SettingsSecondarySectionBoundary.jsx',
    includes: [
      'DashboardActionAsyncBoundary',
      'DASHBOARD_TAB_ASYNC_BOUNDARY_IDS.SETTINGS_SAFETY',
      'DASHBOARD_TAB_ASYNC_BOUNDARY_IDS.SETTINGS_WORKSPACE',
      'DASHBOARD_TAB_ASYNC_BOUNDARY_IDS.SETTINGS_PROTECTION',
      'getReadySettingsSecondarySectionComponent',
      'clearSettingsSecondarySectionModuleRecord',
      'DASHBOARD_TAB_ASYNC_BOUNDARY_UNDECLARED:settings',
      'const [ReadySettingsSection] = useState(',
    ],
  },
  {
    file: 'src/apps/dashboard/tabs/settings/layout/SettingsShell.jsx',
    includes: [
      'onPointerEnter={() => onSectionIntent?.(section.id)}',
      'onPointerDown={() => onSectionIntent?.(section.id)}',
      'onFocus={() => onSectionIntent?.(section.id)}',
    ],
  },
  {
    file: 'src/apps/dashboard/tabs/settings/sections/SettingsSafetySection.jsx',
    includes: [
      '../components/SecurityPanel.jsx',
      '../components/DataLifecyclePanel.jsx',
      '<SettingsLedgerColumns layout="safety">',
    ],
  },
  {
    file: 'src/apps/dashboard/tabs/settings/sections/SettingsWorkspaceSection.jsx',
    includes: [
      '../components/AppChromePanel.jsx',
      '../components/LanguagePanel.jsx',
      '../components/NotificationsPanel.jsx',
      '<SettingsLedgerColumns layout="workspace">',
    ],
  },
  {
    file: 'src/apps/dashboard/tabs/settings/sections/SettingsProtectionSection.jsx',
    includes: [
      'useRuntimeParkedStoreSlice(useProtocolStore, selectProtectionSettings, isRuntimeActive)',
      'requireCoolingCurve(state.coolingCurve)',
      'requireNudgeGoalEnds(state.nudgeConfig.goalEnds)',
      'requireArtifactControlState(state.artifactControlState)',
      'requireProtocolSyncSuccess(await action())',
      'SETTINGS_PROTECTION_NAVIGATION_OWNER_REQUIRED',
      'SETTINGS_PROTECTION_RECORDING_NAVIGATION_REQUIRED',
    ],
  },
  {
    file: 'src/apps/dashboard/tabs/schedule/ScheduleTab.jsx',
    includes: [
      'normalizeScheduleNotificationRouteIntent',
      '../../../../domains/notifications/advisory/scheduleNotificationAdvisory.js',
      '../../../../platform/security/capabilityGate.js',
      'ensurePermission: ensureNotificationsPermissionStrict',
      "openOnEntry: routeNotificationIntent === 'notifications'",
      'notificationControl={notificationControl}',
      'DASHBOARD_TAB_ASYNC_BOUNDARY_IDS.SCHEDULE_SPECIAL_SESSION',
      "import('./components/ScheduleSpecialSessionWorkspace.jsx')",
      'DashboardActionAsyncBoundary',
      'withDynamicImportRecovery',
    ],
    excludes: ['await setNotificationsConfig('],
  },
  {
    file: 'src/apps/dashboard/tabs/sites/preloadSitesTabData.js',
    includes: [
      'SITES_DATA_PRELOAD_PROTOCOL_NOT_READY',
      'SITES_DATA_PRELOAD_ANALYSIS_NOT_READY',
      'preloadSitesPolicySnapshot',
      'preloadSitesSiteDetail',
      'export function preloadSitesTabData',
    ],
  },
  {
    file: 'src/domains/notifications/advisory/scheduleNotificationAdvisory.js',
    includes: [
      'export function normalizeScheduleNotificationRouteIntent',
    ],
  },
  {
    file: 'src/apps/dashboard/tabs/schedule/components/ScheduleRhythmWorkspace.jsx',
    includes: [
      "'./ScheduleBlockWorkbench.jsx'",
      'notificationControl={notificationControl}',
    ],
  },
  {
    file: 'src/apps/dashboard/tabs/schedule/components/ScheduleBlockWorkbench.jsx',
    includes: [
      'notificationControl?.openOnEntry',
      'await notificationControl.ensurePermission()',
      'await latest.onCommit(result.schedule)',
      'selectionRef.current !== blockId',
      'latestRef.current',
      'editScheduleBlock',
      'role="switch"',
    ],
  },
  {
    file: 'src/apps/dashboard/tabs/schedule/components/ScheduleUtilityDock.jsx',
    includes: [
      'SCHEDULE_UTILITY_SPECIAL_SESSION_HANDLER_REQUIRED',
      'SCHEDULE_UTILITY_NOTIFICATION_HANDLER_REQUIRED',
    ],
  },
  {
    file: 'src/apps/dashboard/bootstrap/dashboardBootShellThemeContext.js',
    includes: [
      "../../../themes/core/state/themePreferenceMirror.js",
      "resolveDashboardBootShellThemeId",
    ],
  },
  {
    file: 'src/apps/dashboard/bootstrap/dashboardBootThemeContext.js',
    includes: [
      "./dashboardBootShellThemeContext.js",
      "resolveBootPrewarmSection",
    ],
  },
  {
    file: 'src/apps/dashboard/bootstrap/dashboardDocumentThemeInitialization.js',
    includes: [
      "./dashboardBootThemeContext.js",
      'resolveDashboardBootThemeId',
      'initializeDocumentThemeForThemeId',
    ],
    excludes: [
      "./dashboardLaunchContext.js",
      "../tabs/registry.js",
    ],
  },
  {
    file: 'src/apps/dashboard/bootstrap/dashboardEntryStageTraceContract.js',
    includes: [
      "const DASHBOARD_ENTRY_STAGE_EVENT_PREFIX = 'dashboard_entry:stage_import'",
      'createDashboardEntryStageTraceEvent',
      'parseDashboardEntryStageTraceEvent',
      'projectDashboardEntryStageTrace',
      'requireDashboardEntryStageTraceProjection',
      "'theme_boot_runtime'",
    ],
  },
  {
    file: 'src/apps/dashboard/bootstrap/dashboardThemeBootRuntimeHandoff.js',
    includes: [
      'createDashboardThemeBootRuntimeHandoffOwner',
      'startDashboardThemeBootRuntimeHandoff',
      'releaseDashboardThemeBootRuntimeHandoff',
      'releaseRequestedReason',
      'DASHBOARD_THEME_BOOT_RUNTIME_HANDOFF_RESULT_INVALID',
    ],
  },
  {
    file: 'src/themes/core/runtime/dashboardBootRuntime.js',
    includes: [
      'prepareDashboardThemeBootRuntime',
      'prepareZenHomeRendererWorkerSession',
      'status: \'not_declared\'',
      'get reservationState()',
      'DASHBOARD_THEME_BOOT_RUNTIME_RESERVATION_INVALID',
    ],
  },
  {
    file: 'src/apps/dashboard/main.jsx',
    includes: [
      "loadDashboardStage('theme_boot_runtime'",
      'createDashboardEntryStageTraceEvent',
      'startDashboardThemeBootRuntimeHandoff',
      'releaseDashboardThemeBootRuntimeHandoff',
      "'dashboard_runtime_initialization_failed'",
    ],
    excludes: [
      'plugins/zen/runtime/worker',
      'prepareDashboardThemeBootRuntime(bootThemeId)',
    ],
  },
  {
    file: 'src/apps/dashboard/bootShell.js',
    includes: [
      "./bootstrap/dashboardBootShellThemeContext.js",
      "resolveDashboardBootShellThemeId",
    ],
  },
  {
    file: 'src/apps/dashboard/layout/DashboardLayout.jsx',
    includes: [
      "../tabs/registry.js",
      "../loading/preloadDashboardTab.js",
      'preloadDashboardTabIntent',
      'data-main-presentation-emphasis',
      'ambientPresentation.cssVariables',
    ],
  },
  {
    file: 'src/apps/dashboard/layout/Sidebar.jsx',
    includes: [
      'onTabIntent',
      'onPointerEnter',
      'onPointerDown',
      'onFocus',
    ],
  },
  {
    file: 'src/apps/dashboard/layout/MainPanel.jsx',
    includes: [
      "../tabs/registry.js",
      '../loading/preloadDashboardTab.js',
      'getPreloadedDashboardTabComponent',
      'preloadDashboardTabModule',
      'tabComponentChoiceRef',
    ],
  },
  {
    file: 'src/apps/dashboard/loading/useDashboardTabReadiness.js',
    includes: [
      "../tabs/loadingPolicy.js",
      'getDashboardTabReadinessProfile',
      'getThemeWidgetChunkState',
      'DASHBOARD_TAB_HYDRATION_KEY_UNKNOWN',
      'DASHBOARD_TAB_THEME_ID_REQUIRED',
      "loadError",
      'analysisProjections',
      'selectAnalysisError',
      'useAnalysisProjectionDemand',
      'canonicalWidgetsReady',
      "hydrationError",
    ],
  },
  {
    file: 'src/apps/dashboard/stores/useCLSEStore.js',
    includes: [
      "loadError",
      "failClseLoad",
      "refreshStatusAfterFailedWrite",
      'requireCommittedClseStatusPatch',
      'const pendingClseMutationsByKey = new Map()',
      'const clseCommitRevisionsByKey = new Map(',
      'function beginClseStatusRead()',
      'function applyClseStatusRead(set, get, status, readContext, errorCode)',
      'function runCommittedClseMutation',
      'patch = requireCanonicalCLSEControlSnapshot(',
      "'CLSE_PREWARM_STATUS_INVALID'",
      'CLSE_SETTINGS_COMMIT_ACK_INVALID',
      'const committedPatch = requireCommittedClseStatusPatch',
      'applyStatusPatch(set, committedPatch)',
    ],
  },
  {
    file: 'src/apps/dashboard/hooks/useProtectionArtifactsControlPlane.js',
    includes: [
      "./artifactSettings/useArtifactFamilyProtocolSlice.js",
      "./useProtectionRuntimeSubscription.js",
      "createArtifactRuntimeSelector",
      "state.artifactControlState.familySuspensions[artifactId]",
      "decorateArtifactFamilyWithControlState",
    ],
  },
  {
    file: 'src/apps/dashboard/tabs/tools/selectedArtifactControllerResource.js',
    includes: [
      "import('./selectedControllers/SelectedLensArtifactController.jsx')",
      "import('./selectedControllers/SelectedVeilArtifactController.jsx')",
      "import('./selectedControllers/SelectedBrakeArtifactController.jsx')",
      "import('./selectedControllers/SelectedBarrierArtifactController.jsx')",
      "import('./selectedControllers/SelectedGateArtifactController.jsx')",
      "import('./selectedControllers/SelectedFlareArtifactController.jsx')",
      "import('./selectedControllers/SelectedEchoArtifactController.jsx')",
      'TOOLS_SELECTED_ARTIFACT_CONTROLLER',
      'controllerRecords.get(artifactId) !== record',
      'retryToolsSelectedArtifactController',
    ],
  },
  {
    file: 'src/apps/dashboard/tabs/tools/selectedControllers/SelectedEchoArtifactController.jsx',
    includes: [
      'useProtectionEchoArtifactControl',
      'useProtectionBlockedHistoryControl',
      'useRuntimeParkedStoreSlice',
      'historyOperationBusy',
      'navigationBlocked',
    ],
  },
  {
    file: 'src/apps/dashboard/tabs/tools/components/SelectedArtifactControllerBoundary.jsx',
    includes: [
      'mountedRef',
      'loadRevisionRef',
      'retryToolsSelectedArtifactController',
      'loadState.artifactId === artifactId',
    ],
  },
  {
    file: 'src/apps/dashboard/tabs/main/MainTab.jsx',
    includes: [
      "@/apps/dashboard/hooks/useStatusController.js",
      "@/apps/dashboard/hooks/useProtectionRuntimeSubscription.js",
    ],
  },
  {
    file: 'src/apps/dashboard/tabs/experiment/ExperimentHubTab.jsx',
    includes: [
      './ExperimentLabOutlet.jsx',
      'preloadExperimentLabIntent',
      'surfaceId: EXPERIMENT_LAB_SECTION_IDS.HOME',
      'onPointerDown',
      'onReturnHome={handleReturnHome}',
    ],
  },
  {
    file: 'src/apps/dashboard/tabs/experiment/ExperimentWorkspace.jsx',
    includes: [
      "@/apps/dashboard/hooks/useStatusController.js",
    ],
  },
  {
    file: 'src/apps/dashboard/hooks/useStatusController.js',
    includes: [
      'removeSiteRule: state.removeSiteRule',
      'upsertSiteRule: state.upsertSiteRule',
      'return removeSiteRule({',
      'return upsertSiteRule({',
      "type: 'blocked'",
    ],
  },
  {
    file: 'src/apps/dashboard/stores/protocolRulesSlice.js',
    includes: [
      "new Error('INVALID_SITE_RULE_TYPE')",
      'type !== \'blocked\' && type !== \'allowed\'',
      "confirmExactMove: true",
    ],
  },
  {
    file: 'src/apps/dashboard/tabs/filter/FilterTab.jsx',
    includes: [
      "./preview/SettingsPreviewSection.jsx",
      "./preview/PreviewMockupTop.jsx",
      "../../hooks/useProtectionRuntimeSubscription.js",
      "./useFilterSettingsEditor.js",
      "./useFilterRuntimeModel.js",
    ],
  },
  {
    file: 'src/apps/dashboard/tabs/filter/useFilterRuntimeModel.js',
    includes: [
      "../../../../domains/protection/runtime/canonicalArtifactTelemetry.js",
      "../../utils/protectionRuntimeInsights.js",
      "./protectionPreviewScenarios.js",
    ],
  },
  {
    file: 'src/apps/dashboard/tabs/filter/FilterSettingsSidebar.jsx',
    includes: [
      "../../settings/controls/SettingRow.jsx",
    ],
  },
  {
    file: 'src/apps/dashboard/tabs/settings/SettingsTab.jsx',
    includes: [
      "useSecurityStore",
      "resolveSettingsNotificationCapability",
      "isNotificationCapabilityOwnerError",
      "SETTINGS_NOTIFICATION_CAPABILITY_INVALID",
      'if (!response?.success)',
      "response?.error || 'SETTINGS_PROPAGATION_FAILED'",
      'requireProtocolSyncSuccess(await setPrecisionInsightsPolicy',
      'requireProtocolSyncSuccess(await setNotificationsConfig',
      "SETTINGS_NOTIFICATIONS_SAVE_FAILED",
      'requireProtocolSyncSuccess(await setSolarLocationProfile',
      "SETTINGS_SOLAR_LOCATION_SAVE_FAILED",
      "SETTINGS_DATA_ACTION_FAILED",
      "setDataStatusTone('danger')",
      "readDashboardPermissionSnapshot({ force, tabId: 'settings' })",
      'getFreshDashboardPermissionSnapshot',
      'projectSettingsPermissionState',
      'areSettingsPermissionStatesEqual',
      'SettingsSecondarySectionBoundary',
      'scheduleSettingsSecondarySectionPreloads',
      'preloadSettingsSecondarySectionIntent',
      'sectionId={SETTINGS_SECTION_IDS.PROTECTION}',
      'onNavigate: onTabChange',
      'onOpenRecording: () => handleSectionChange(SETTINGS_SECTION_IDS.PERMISSIONS)',
    ],
  },
  {
    file: 'src/apps/dashboard/hooks/useProtectionBlockedHistoryControl.js',
    includes: [
      "../stores/useSecurityStore.js",
      'useProtectionArtifactWorkflowGeneration',
      'isWorkflowGenerationCurrent',
    ],
  },
  {
    file: 'src/apps/dashboard/hooks/useProtectionEchoArtifactControl.js',
    includes: [
      'useProtectionArtifactWorkflowGeneration',
      'ARTIFACT_WORKFLOW_INACTIVE',
      'isWorkflowGenerationCurrent',
    ],
  },
  {
    file: 'src/apps/dashboard/hooks/artifactSettings/useArtifactSettingsCommands.js',
    includes: [
      'setFilterSettings((current)',
      'setGateConfig((current)',
      'normalizeFilterSettings',
      'normalizeGateConfig',
    ],
  },
  {
    file: 'src/apps/dashboard/tabs/tools/ToolsTab.jsx',
    includes: [
      'DASHBOARD_TAB_ASYNC_BOUNDARY_IDS.TOOLS_STORAGE_SUPPORT',
      'preloadToolsSelectedArtifactController',
      "import('./components/StorageSupportWorkspace.jsx')",
      'withDynamicImportRecovery',
      'DashboardActionAsyncBoundary',
    ],
  },
  {
    file: 'src/apps/dashboard/loading/DashboardActionAsyncBoundary.jsx',
    includes: [
      'DashboardActionAsyncErrorBoundary',
      'data-dashboard-async-boundary',
      'DASHBOARD_ACTION_ASYNC_BOUNDARY_ID_REQUIRED',
      'DASHBOARD_ACTION_ASYNC_ERROR_RENDERER_REQUIRED',
    ],
  },
  {
    file: 'src/apps/dashboard/tabs/tools/useToolsTabController.js',
    includes: [
      'useStorageSupportVisibility',
      'canSelectArtifactByIndex',
      'isSelectedArtifactNavigationBlocked',
      'buildArtifactNavigationItems',
      'committedRef',
      'preloadToolsSelectedArtifactController(selectedArtifactId)',
    ],
  },
  {
    file: 'src/apps/dashboard/tabs/tools/components/StorageSupportWorkspace.jsx',
    includes: [
      'useSecurityStore',
      'getDestructiveActionAuthPolicy',
      'useStorageSupportController',
    ],
  },
  {
    file: 'src/apps/dashboard/tabs/tools/buildToolsArtifacts.jsx',
    includes: [
      'buildToolsArtifactGalleryItems',
      'materializeSelectedOnly',
      'buildArtifactNavigationItem',
    ],
  },
  {
    file: 'src/apps/dashboard/tabs/settings/SettingsListSection.jsx',
    includes: [
      "../../settings/controls/SettingRow.jsx",
    ],
  },
  {
    file: 'src/apps/dashboard/tabs/tools/artifactActivationState.js',
    includes: [
      "../../../../domains/protection/runtime/canonicalArtifactTelemetry.js",
    ],
  },
  {
    file: 'src/apps/dashboard/stores/useProtocolStore.js',
    includes: [
      "normalizeDataCollectionMode,",
      "prewarm.dataCollectionMode",
      "raw.dataCollectionMode",
      "requireProtocolFilterSettingsPayload",
    ],
  },
  {
    file: 'src/apps/dashboard/stores/protocolStoreHelpers.js',
    includes: [
      "normalizeDataCollectionMode,",
      "payload.dataCollectionMode",
      "PROTOCOL_FILTER_SETTINGS_PAYLOAD_INVALID",
      "requireProtocolFilterSettingsPayload",
      'export function requireProtocolSyncSuccess',
      'if (!result?.error) return result',
      'if (result.error instanceof Error) throw result.error',
    ],
  },
  {
    file: 'src/apps/dashboard/stores/useSecurityStore.js',
    includes: [
      'const pendingSecurityMutationsByKey = new Map()',
      'const securityCommitRevisionsByKey = new Map(',
      'function beginSecuritySettingsRead()',
      'function markSecuritySettingCommitted(key)',
      'function applySecurityReadSnapshot(set, get, snapshot, readContext)',
      'function readCommittedSecurityState',
      'function runCommittedSecurityMutation',
      'pendingMutation && Object.is(pendingMutation.requestedValue, requestedValue)',
      'result.patch[MASTER_PASSCODE_KEY]',
      'result.patch[RESET_GUARD_KEY]',
      'result.patch[HIGH_SECURITY_MODE_KEY]',
      'deriveDestructiveActionAuthPolicy(readCommittedSecurityState(get()))',
    ],
  },
  ...[
    'protocolSettingsClient.js',
    'preferenceSettingsClient.js',
    'securitySettingsClient.js',
    'clseSettingsClient.js',
  ].map((file) => ({
    file: `src/apps/dashboard/stores/${file}`,
    includes: [
      'createSettingsCommandChannelClient',
      'SETTINGS_COMMAND_CHANNELS.',
    ],
  })),
  {
    file: 'src/apps/dashboard/stores/useAnalysisStore.js',
    includes: [
      './analysisSnapshotRefreshPolicy.js',
      './analysisStoreResponseContracts.js',
      'ANALYSIS_PROJECTION_REFRESH_REASON',
      'createAnalysisProjectionRefreshState',
      'clearCycleProjectionTrailingRefresh',
      'clearStatusSnapshotTrailingRefresh',
      'requireBootstrapAnalysisPayload',
      'requireCycleProjectionPayload',
      'requireStatusSnapshotPayload',
      'requireSitesSnapshotPayload',
    ],
  },
  {
    file: 'src/apps/dashboard/stores/analysisStoreResponseContracts.js',
    includes: [
      'createAnalysisResponseError',
      'ANALYSIS_BOOTSTRAP_STATUS_SNAPSHOT_INVALID',
      'STATUS_SNAPSHOT_RESPONSE_INVALID',
      'SITES_SNAPSHOT_RESPONSE_INVALID',
    ],
  },
  {
    file: 'src/apps/dashboard/tabs/main/home/HomeScanWorkspace.jsx',
    includes: [
      '@/apps/dashboard/ai/sessionSummaryPresentation.js',
      './SessionSummaryAiEnrichment.jsx',
      'resolveZenPondRosterAuthority',
      'rosterAuthoritySource: effectivePondRosterAuthority.source',
      'scannerDomainCandidateList',
      'data-main-presentation-emphasis',
      '@/apps/dashboard/workspaces/garden/ZenGardenFrame.jsx',
      '<ZenGardenFrame',
      'isTabActive: pondActive',
      'isTabActive: bonsaiActive',
      'resolveZenHomeFirstViewportNotification',
      'firstViewportReadyNotifiedTokenRef',
    ],
  },
  {
    file: 'src/apps/dashboard/workspaces/garden/ZenGardenFrame.jsx',
    includes: [
      'zen-main-vision-surface',
      'ref={stageRef}',
      'ref={pondRef}',
      'ref={bonsaiRef}',
      '{pondSlot}',
      '{bonsaiSlot}',
    ],
  },
  {
    file: 'src/themes/plugins/zen/presentation/petals/ZenAppPetalLayer.jsx',
    includes: [
      'createZenAppPetalField',
      'runRenderLoop',
      'respectReducedMotion: true',
      'ZEN_APP_PETAL_RENDER_BUDGET',
    ],
  },
  {
    file: 'src/themes/plugins/zen/api/petalField.js',
    includes: [
      'ZenAppPetalLayer.jsx',
    ],
  },
  {
    file: 'src/apps/dashboard/tabs/main/home/SessionSummaryAiEnrichment.jsx',
    includes: [
      'DASHBOARD_TAB_ASYNC_BOUNDARY_IDS.MAIN_SESSION_SUMMARY_AI',
      "import('@/apps/dashboard/ai/SessionSummaryAiPanel.jsx')",
      'DashboardActionAsyncBoundary',
      'requestIdleCallback',
      'postFirstFrameReady === true',
      'mainWidgetThemeId !== THEME_IDS.ZEN',
      'MAIN_SESSION_SUMMARY_AI_THEME_INVALID',
      'onClick={retry}',
    ],
  },
  {
    file: 'src/apps/dashboard/ai/SessionSummaryAiPanel.jsx',
    includes: [
      'generation.resultSignature !== inputSignature',
    ],
  },
  {
    file: 'src/apps/dashboard/tabs/main/home/buildHomeScanSnapshot.js',
    includes: [
      './dailyFlowPressureProfile.js',
      'buildDailyFlowPressureProfile',
      './dailyFlowViewModel.js',
      'buildDailyFlowViewModel',
      'buildLensHourlySeries',
      './homeBriefViewModel.js',
      'buildHomeBriefViewModel',
      './homeHabitCueViewModel.js',
      'resolveHomeHabitCue',
      './rhythmTopSitesViewModel.js',
      'buildRhythmTopSitesViewModel',
    ],
  },
]);

const FORBIDDEN_SUBSTRINGS = Object.freeze([
  {
    file: 'src/apps/dashboard/tabs/schedule/ScheduleTab.jsx',
    tokens: [
      'shouldActivateScheduleNotificationPrompt',
      'notificationPromptActive',
    ],
  },
  {
    file: 'src/domains/notifications/advisory/scheduleNotificationAdvisory.js',
    tokens: [
      'shouldActivateScheduleNotificationPrompt',
      'requireCanonicalNotificationsConfig',
      'requireAdvisoryBoolean',
      'requireAdvisoryBlockCount',
    ],
  },
  {
    file: 'src/apps/dashboard/presentation/useDashboardZenAmbientPresentation.js',
    tokens: [
      'globalThis.Date',
      '__zen_dev_time_override__',
      'zen-dev-time-change',
      'debugConfig',
    ],
  },
  {
    file: 'src/apps/dashboard/components/ZenAppearanceTimeControl.jsx',
    tokens: [
      'useProtocolStore',
      'debugConfig',
      'setDebugConfig',
    ],
  },
  {
    file: 'src/domains/protection/runtime/canonicalArtifactTelemetry.js',
    tokens: [
      'normalizeFilterSettings',
      'normalizeRuntimeFilterPlan',
      'RUNTIME_FILTER_PLAN_BASE',
      'filterEntry?.step',
    ],
  },
  {
    file: 'src/apps/dashboard/tabs/main/home/HomeScanWorkspace.jsx',
    tokens: [
      '@/apps/dashboard/ai/index.js',
      '@/apps/dashboard/ai/SessionSummaryAiPanel.jsx',
      'firstViewportReadyNotifiedRef = useRef(false)',
    ],
  },
  {
    file: 'src/apps/dashboard/DashboardPage.jsx',
    tokens: [
      './utils/tabAccessPolicy.js',
      'const forceMainTabDuringBoot = !boot.dismissible',
      'bootShellRevealStarted={boot.dismissible}',
    ],
  },
  {
    file: 'src/apps/dashboard/bootstrap/bootSurfaceWarmup.js',
    tokens: [
      '../loading/policy.js',
    ],
  },
  {
    file: 'src/apps/dashboard/layout/DashboardLayout.jsx',
    tokens: [
      '../utils/tabAccessPolicy.js',
    ],
  },
  {
    file: 'src/apps/dashboard/layout/MainPanel.jsx',
    tokens: [
      '../loading/policy.js',
      'getDashboardBootPreloadTabIds',
      'getDashboardTabLoader',
    ],
  },
  {
    file: 'src/apps/dashboard/loading/useDashboardTabReadiness.js',
    tokens: [
      './policy.js',
      '../tabs/registry.js',
    ],
  },
  {
    file: 'src/apps/dashboard/tabs/loadingPolicy.js',
    tokens: [
      './registry.js',
      'MainTab.jsx',
      'SitesTab.jsx',
      'ScheduleTab.jsx',
      'FilterTab.jsx',
      'ToolsTab.jsx',
      'SettingsTab.jsx',
      'ExperimentTab.jsx',
      'ExperimentHubTab.jsx',
      'ExperimentWorkspace.jsx',
      'CLSETab.jsx',
      'CLSELab.jsx',
    ],
  },
  {
    file: 'src/apps/dashboard/tabs/registry.js',
    tokens: [
      "id: 'clse'",
      '@dashboard-clse-tab-entry',
    ],
  },
  {
    file: 'src/themes/core/data/tabIcons.jsx',
    tokens: [
      'clse:',
    ],
  },
  {
    file: 'src/apps/dashboard/hooks/useProtectionArtifactsControlPlane.js',
    tokens: [
      '../tabs/tools/',
      './useProtectionEchoArtifactControl.js',
      './useProtectionBlockedHistoryControl.js',
      './useProtectionNudgeDispatchControl.js',
    ],
  },
  {
    file: 'src/apps/dashboard/hooks/useStatusController.js',
    tokens: [
      'setBlockedUrls',
      'setAllowedUrls',
      'setSiteGoals',
    ],
  },
  {
    file: 'src/apps/dashboard/stores/protocolRulesSlice.js',
    tokens: [
      'setBlockedUrls:',
      'setAllowedUrls:',
      'setSiteGoals:',
    ],
  },
  {
    file: 'src/apps/dashboard/hooks/useProtectionRuntimeSubscription.js',
    tokens: [
      '../tabs/tools/',
    ],
  },
  {
    file: 'src/apps/dashboard/hooks/protectionRuntimeSubscriptionBridge.js',
    tokens: [
      '../tabs/tools/',
    ],
  },
  {
    file: 'src/apps/dashboard/utils/protectionArtifactsControlPlane.js',
    tokens: [
      '../tabs/tools/',
    ],
  },
  {
    file: 'src/apps/dashboard/tabs/main/MainTab.jsx',
    tokens: [
      '../tools/',
    ],
  },
  {
    file: 'src/apps/dashboard/tabs/filter/FilterTab.jsx',
    tokens: [
      '../tools/',
      'useProtectionArtifactsControlPlane',
    ],
  },
  {
    file: 'src/apps/dashboard/tabs/tools/artifactCards/buildSentinelFlareCard.jsx',
    tokens: [
      'showExperimental',
      'handleSpawn',
      'handleStop',
    ],
  },
  {
    file: 'src/apps/dashboard/tabs/settings/SettingsTab.jsx',
    tokens: [
      'dispatchSettingsCommand(',
      'readSettingsSnapshot(',
      'MASTER_PASSCODE_KEY',
      'RESET_GUARD_KEY',
      "./components/SecurityPanel.jsx",
      "./components/DataLifecyclePanel.jsx",
      "./components/AppChromePanel.jsx",
      "./components/LanguagePanel.jsx",
      "./components/NotificationsPanel.jsx",
      "./sections/SettingsProtectionSection.jsx",
    ],
  },
  ...[
    'sections/SettingsSafetySection.jsx',
    'sections/SettingsWorkspaceSection.jsx',
  ].map((fileName) => ({
    file: `src/apps/dashboard/tabs/settings/${fileName}`,
    tokens: [
      'ChromeService.js',
      'runtimeSendMessage',
      '/stores/',
      'useProtocolStore',
      'useSecurityStore',
    ],
  })),
  {
    file: 'src/apps/dashboard/tabs/settings/sections/SettingsProtectionSection.jsx',
    tokens: [
      'ChromeService.js',
      'runtimeSendMessage',
      'readSettingsSnapshot(',
      'dispatchSettingsCommand(',
      'chrome.storage',
      'localStorage',
      'BudgetSnapshotReader',
      'resolveCoolingCurve(',
    ],
  },
  ...[
    'PermissionGate.jsx',
    'SecurityPanel.jsx',
    'DataLifecyclePanel.jsx',
    'AppChromePanel.jsx',
    'LanguagePanel.jsx',
    'NotificationsPanel.jsx',
  ].map((fileName) => ({
    file: `src/apps/dashboard/tabs/settings/components/${fileName}`,
    tokens: [
      'isZen',
      "ui-kit/Panel.jsx",
      "ui-kit/index.js",
      'overflow-y-auto',
    ],
  })),
  {
    file: 'src/apps/dashboard/tabs/settings/components/PermissionGate.jsx',
    tokens: [
      'SectionShell',
      'RadioOption',
    ],
  },
  {
    file: 'src/apps/dashboard/hooks/artifactSettings/useArtifactSettingsCommands.js',
    tokens: [
      'readSettingsSnapshot(',
      'platform/storage/settings/SettingsQueryService.js',
    ],
  },
  {
    file: 'src/apps/dashboard/hooks/artifactSettings/useFlareArtifactSettingsFamily.js',
    tokens: [
      'runtimeSendMessage',
      'NUDGE_CONFIG_UPDATED',
    ],
  },
  {
    file: 'src/apps/dashboard/hooks/useProtectionBlockedHistoryControl.js',
    tokens: [
      'readSettingsSnapshot(',
      'MASTER_PASSCODE_KEY',
      'RESET_GUARD_KEY',
    ],
  },
  {
    file: 'src/apps/dashboard/tabs/tools/useToolsTabController.js',
    tokens: [
      'useProtocolStore',
      'useProtectionArtifactsControlPlane',
      'useProtectionArtifactSettingsControl',
      'buildToolsArtifacts',
      'useSecurityStore',
      'useStorageSupportController',
      'readSettingsSnapshot(',
      'MASTER_PASSCODE_KEY',
      'RESET_GUARD_KEY',
    ],
  },
  {
    file: 'src/apps/dashboard/stores/useProtocolStore.js',
    tokens: [
      './settingsCommandBus.js',
      'platform/storage/settings/SettingsQueryService.js',
      'readSettingsSnapshot(',
      'dispatchSettingsCommand(',
      'runSettingsChannelCommand(',
      'setTrackingScope:',
      'resolveDataCollectionModeFromSettingsInput(',
      'resolveDataCollectionModeFromTrackingScope(',
      'resolveTrackingScopeFromDataCollectionMode(',
      "trackingScope: 'blocked'",
      'prewarm.filterSettings || CONFIG_DEFAULT_FILTER_SETTINGS',
      'raw.filterSettings || CONFIG_DEFAULT_FILTER_SETTINGS',
      'normalizeFilterSettings(value || CONFIG_DEFAULT_FILTER_SETTINGS)',
    ],
  },
  {
    file: 'src/apps/dashboard/stores/protocolStoreHelpers.js',
    tokens: [
      'resolveDataCollectionModeFromSettingsInput(',
      'resolveDataCollectionModeFromTrackingScope(',
      'settingsPatch.trackingScope = resolvedTrackingScope',
      'statePatch.trackingScope',
      'currentState.trackingScope',
      'payload.filterSettings || CONFIG_DEFAULT_FILTER_SETTINGS',
    ],
  },
  {
    file: 'src/apps/dashboard/stores/usePreferenceStore.js',
    tokens: [
      './settingsCommandBus.js',
      'dispatchSettingsCommand(',
      'getSettingsCommandPendingPatch(',
      'return resolveThemeId(get().themeId);',
      'return normalizeSidebarDisplayMode(get().sidebarDisplayMode);',
    ],
  },
  {
    file: 'src/apps/dashboard/stores/useSecurityStore.js',
    tokens: [
      './settingsCommandBus.js',
      'dispatchSettingsCommand(',
      'getSettingsCommandPendingPatch(',
      'getPendingSecuritySettingsPatch(',
      'getEffectiveSecurityState(',
    ],
  },
  {
    file: 'src/apps/dashboard/stores/useCLSEStore.js',
    tokens: [
      './settingsCommandBus.js',
      'dispatchSettingsCommand(',
      'getSettingsCommandPendingPatch(',
    ],
  },
  {
    file: 'src/apps/dashboard/stores/protocolSettingsClient.js',
    tokens: [
      './settingsClient.js',
      'platform/storage/settings/SettingsQueryService.js',
      'readSettingsSnapshot(',
    ],
  },
  {
    file: 'src/apps/dashboard/tabs/main/home/buildHomeScanSnapshot.js',
    tokens: [
      'function buildDailyFlowPressureProfile',
      'function buildDailyFlowViewModel',
      'function buildBriefChips',
      'function buildBriefSupportText',
      'function buildBriefVerdict',
      'function buildDefaultPrimaryAction',
      'function buildFallbackPrimaryAction',
      'function buildHabitCueMetricParams',
      'function buildLensHourlySeries',
      'function buildProtectionAction',
      'function buildRhythmTopSites',
      'function buildRhythmTopSitesViewModel',
      'function buildSitesAction',
      'function buildScoreSetupAction',
      'function buildScoreSetupChips',
      'function dedupeActions',
      'function dedupeChips',
      'function findRollingPressureDomain',
      'function getProjectionBuckets',
      'function getBucketForDisplayIndex',
      'function normalizeCueDomain',
      'function resolveBriefStatusLabel',
      'function resolveBriefTone',
      'function resolveHomeHabitCue',
    ],
  },
]);

const DASHBOARD_DIRECT_SETTINGS_COMMAND_EXCEPTIONS = new Set([
  'src/apps/dashboard/stores/settingsClient.js',
]);

const DASHBOARD_DIRECT_SETTINGS_COMMAND_TOKEN =
  'platform/storage/settings/SettingsCommandService.js';
const DASHBOARD_DIRECT_GENERIC_PATCH_TOKEN = 'applySettingsPatchViaRuntime';
const DASHBOARD_DIRECT_SETTINGS_QUERY_EXCEPTIONS = new Set([]);
const DASHBOARD_DIRECT_SETTINGS_QUERY_TOKEN =
  'platform/storage/settings/SettingsQueryService.js';
const DASHBOARD_DIRECT_GENERIC_READ_TOKEN = 'readSettingsSnapshot(';
const ZEN_SHELL_MATERIAL_PROJECTION_TOKEN = 'zenShellMaterialProjection.js';
const ZEN_SHELL_MATERIAL_PROJECTION_CONSUMERS = new Set([
  'src/themes/plugins/zen/presentation/environment/zenAmbientPresentation.js',
  'src/themes/plugins/zen/presentation/environment/zenEnvironmentShellMaterials.js',
]);
const ZEN_SHELL_MATERIAL_PROJECTOR_OWNER = 'src/themes/plugins/zen/presentation/environment/zenShellMaterialProjection.js';
const ZEN_SHELL_MATERIAL_PRESENTATION_OWNER = 'src/themes/plugins/zen/presentation/environment/zenEnvironmentShellMaterials.js';

const absolute = (relativePath) => path.resolve(rootDir, relativePath);

const addFailure = (message) => {
  failures.push(message);
};

const readUtf8 = async (relativePath) => (
  fs.readFile(absolute(relativePath), 'utf8')
);

const escapeRegExp = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const DASHBOARD_TAB_OWNER_RE = /^src\/apps\/dashboard\/tabs\/([^/]+)(?:\/|$)/;

const isImportLikeReference = (source, token) => {
  const escaped = escapeRegExp(token);
  const patterns = [
    new RegExp(`from\\s+['"][^'"]*${escaped}['"]`, 'g'),
    new RegExp(`import\\(\\s*['"][^'"]*${escaped}['"]\\s*\\)`, 'g'),
    new RegExp(`vi\\.mock\\(\\s*['"][^'"]*${escaped}['"]`, 'g'),
    new RegExp(`require\\(\\s*['"][^'"]*${escaped}['"]\\s*\\)`, 'g'),
  ];
  return patterns.some((pattern) => pattern.test(source));
};

const extractImportSpecifiers = (source) => {
  const specifiers = [];
  const patterns = [
    /from\s+['"]([^'"]+)['"]/g,
    /import\(\s*['"]([^'"]+)\s*['"]\)/g,
    /vi\.mock\(\s*['"]([^'"]+)['"]/g,
    /require\(\s*['"]([^'"]+)\s*['"]\)/g,
  ];

  for (const pattern of patterns) {
    let match = pattern.exec(source);
    while (match) {
      specifiers.push(match[1]);
      match = pattern.exec(source);
    }
  }

  return Array.from(new Set(specifiers));
};

const resolveProjectRelativeImport = (relativePath, specifier) => {
  if (typeof specifier !== 'string' || !specifier.trim()) return null;

  if (specifier.startsWith('@/')) {
    return `src/${specifier.slice(2)}`;
  }

  if (specifier.startsWith('src/')) {
    return specifier;
  }

  if (!specifier.startsWith('.')) {
    return null;
  }

  return path.relative(
    rootDir,
    path.resolve(path.dirname(absolute(relativePath)), specifier),
  ).replaceAll(path.sep, '/');
};

const walkFiles = async (relativePath) => {
  const targetPath = absolute(relativePath);
  const stat = await fs.stat(targetPath);
  if (stat.isFile()) return [relativePath];

  const entries = await fs.readdir(targetPath, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const nextRelativePath = path.posix.join(relativePath, entry.name);
    if (entry.isDirectory()) {
      files.push(...await walkFiles(nextRelativePath));
      continue;
    }
    if (!entry.isFile()) continue;
    if (!/\.(js|jsx|mjs|cjs|ts|tsx)$/.test(entry.name)) continue;
    files.push(nextRelativePath);
  }
  return files;
};

const ensureRequiredFiles = async () => {
  await Promise.all(REQUIRED_FILES.map(async (relativePath) => {
    try {
      await fs.access(absolute(relativePath));
    } catch {
      addFailure(`missing canonical owner file: ${relativePath}`);
    }
  }));
};

const ensureForbiddenFilesAbsent = async () => {
  await Promise.all(FORBIDDEN_FILES.map(async (relativePath) => {
    try {
      await fs.access(absolute(relativePath));
      addFailure(`forbidden compatibility seam still exists: ${relativePath}`);
    } catch {
      // expected
    }
  }));
};

const checkForbiddenImports = async () => {
  const fileGroups = await Promise.all(IMPORT_SCAN_ROOTS.map((root) => walkFiles(root)));
  const files = fileGroups.flat();

  const readConcurrency = 64;
  for (let start = 0; start < files.length; start += readConcurrency) {
    await Promise.all(files.slice(start, start + readConcurrency).map(async (file) => {
      const source = await readUtf8(file);
      if (file.startsWith('src/')
        && (/\bglobalThis\.Date\s*=/u.test(source) || /\bDate\.now\s*=/u.test(source))) {
        addFailure(`${file}: runtime source must not replace the global wall clock.`);
      }
      FORBIDDEN_IMPORT_TOKENS.forEach((token) => {
        if (isImportLikeReference(source, token)) {
          addFailure(`${file}: forbidden compatibility seam import detected for ${token}`);
        }
      });
      if (
        file.startsWith('src/')
        && !ZEN_SHELL_MATERIAL_PROJECTION_CONSUMERS.has(file)
        && isImportLikeReference(source, ZEN_SHELL_MATERIAL_PROJECTION_TOKEN)
      ) {
        addFailure(`${file}: Zen shell materials must be consumed through the cached zenEnvironmentShellMaterials.js ambient-owner seam.`);
      }
      if (file.startsWith('src/')
        && file !== ZEN_SHELL_MATERIAL_PROJECTOR_OWNER
        && file !== ZEN_SHELL_MATERIAL_PRESENTATION_OWNER
        && /\bprojectZenShellMaterials\b/u.test(source)) {
        addFailure(`${file}: shell materials must consume the cached ambient-owner seam, not the projector directly.`);
      }
    }));
  }
};

const checkRequiredContracts = async () => {
  await Promise.all(REQUIRED_CONTRACTS.map(async ({ file, includes }) => {
    try {
      const source = await readUtf8(file);
      includes.forEach((token) => {
        if (!source.includes(token)) {
          addFailure(`${file}: missing canonical owner import/reference ${token}`);
        }
      });
    } catch {
      addFailure(`${file}: could not read file for required contract check`);
    }
  }));
};

const checkForbiddenSubstrings = async () => {
  await Promise.all(FORBIDDEN_SUBSTRINGS.map(async ({ file, tokens }) => {
    try {
      const source = await readUtf8(file);
      tokens.forEach((token) => {
        if (source.includes(token)) {
          addFailure(`${file}: forbidden owner/subtree reference ${token}`);
        }
      });
    } catch {
      addFailure(`${file}: could not read file for forbidden reference check`);
    }
  }));
};

const ensureNoSiblingTabImports = async () => {
  const tabFiles = await walkFiles('src/apps/dashboard/tabs');

  await Promise.all(tabFiles.map(async (relativePath) => {
    const sourceOwnerMatch = relativePath.match(DASHBOARD_TAB_OWNER_RE);
    if (!sourceOwnerMatch) return;
    if (sourceOwnerMatch[1].includes('.')) return;

    const sourceTabId = sourceOwnerMatch[1];
    const source = await readUtf8(relativePath);
    const specifiers = extractImportSpecifiers(source);

    specifiers.forEach((specifier) => {
      const resolved = resolveProjectRelativeImport(relativePath, specifier);
      if (!resolved) return;

      const targetOwnerMatch = resolved.match(DASHBOARD_TAB_OWNER_RE);
      if (!targetOwnerMatch) return;
      if (targetOwnerMatch[1].includes('.')) return;

      const targetTabId = targetOwnerMatch[1];
      if (targetTabId === sourceTabId) return;

      addFailure(
        `${relativePath}: dashboard tabs must not import sibling tab owners directly. Found "${specifier}" -> "${resolved}".`,
      );
    });
  }));
};

const checkDashboardSettingsCommandBoundaries = async () => {
  const files = await walkFiles('src/apps/dashboard');

  await Promise.all(files.map(async (relativePath) => {
    if (DASHBOARD_DIRECT_SETTINGS_COMMAND_EXCEPTIONS.has(relativePath)) return;

    const source = await readUtf8(relativePath);
    if (isImportLikeReference(source, DASHBOARD_DIRECT_SETTINGS_COMMAND_TOKEN)) {
      addFailure(
        `${relativePath}: dashboard feature code must use typed store/settings client seams instead of importing SettingsCommandService directly.`,
      );
    }
    if (source.includes(DASHBOARD_DIRECT_GENERIC_PATCH_TOKEN)) {
      addFailure(
        `${relativePath}: dashboard feature code must not call applySettingsPatchViaRuntime directly.`,
      );
    }
  }));
};

const checkDashboardSettingsQueryBoundaries = async () => {
  const files = await walkFiles('src/apps/dashboard');

  await Promise.all(files.map(async (relativePath) => {
    if (DASHBOARD_DIRECT_SETTINGS_QUERY_EXCEPTIONS.has(relativePath)) return;

    const source = await readUtf8(relativePath);
    if (isImportLikeReference(source, DASHBOARD_DIRECT_SETTINGS_QUERY_TOKEN)) {
      addFailure(
        `${relativePath}: dashboard feature code must use typed store/settings client seams instead of importing SettingsQueryService directly.`,
      );
    }
    if (source.includes(DASHBOARD_DIRECT_GENERIC_READ_TOKEN)) {
      addFailure(
        `${relativePath}: dashboard feature code must not call readSettingsSnapshot directly.`,
      );
    }
  }));
};

const checkClseDashboardFailureContracts = async () => {
  const source = await readUtf8('src/apps/dashboard/stores/useCLSEStore.js');
  if (/refreshStatus\(\)\.catch\(\(\)\s*=>\s*\{\s*\}\)/u.test(source)) {
    addFailure('src/apps/dashboard/stores/useCLSEStore.js: CLSE refresh failures must be surfaced through loadError/warnings, not swallowed.');
  }
  if (/set\(\{\s*loaded:\s*true\s*\}\)/u.test(source)) {
    addFailure('src/apps/dashboard/stores/useCLSEStore.js: CLSE initialization must not mark loaded without a valid status patch.');
  }
  if (!source.includes('requireCanonicalCLSEStatusSnapshot')) {
    addFailure('src/apps/dashboard/stores/useCLSEStore.js: CLSE status responses must be shape-checked before updating dashboard state.');
  }
};

const checkZenAppPetalOwnership = async () => {
  const fieldOwner = 'src/themes/plugins/zen/runtime/petals/zenAppPetalField.js';
  const layerOwner = 'src/themes/plugins/zen/presentation/petals/ZenAppPetalLayer.jsx';
  const hostOwner = 'src/apps/dashboard/presentation/ZenAppPetalHost.jsx';
  const pageOwner = 'src/apps/dashboard/DashboardPage.jsx';
  const landingOwner = 'src/themes/plugins/zen/pond/renderers/worker/core/zenPondPetalLandingReceiver.js';
  const counts = { field: 0, layer: 0, host: 0 };
  const files = await walkFiles('src');
  await Promise.all(files.map(async (file) => {
    const source = await readUtf8(file);
    const fieldCalls = source.match(/\bcreateZenAppPetalField\s*\(/gu) || [];
    if (file.startsWith('src/platform/ceremony/') && /createFirstVisionDescentPetals|petalScale|sakuraRain/u.test(source)) {
      addFailure(`${file}: First Vision must use the shared app petal field; ceremony owns cover only.`);
    }
    if (file !== fieldOwner && fieldCalls.length > 0) {
      if (file !== layerOwner) {
        addFailure(`${file}: airborne petal simulation belongs only to ZenAppPetalLayer.`);
      }
      counts.field += fieldCalls.length;
    }
    const layerMounts = source.match(/<ZenAppPetalLayer\b/gu) || [];
    if (layerMounts.length > 0) {
      if (file !== hostOwner) {
        addFailure(`${file}: app-wide petal layer must mount only in the dashboard petal host.`);
      }
      counts.layer += layerMounts.length;
    }
    const hostMounts = source.match(/<ZenAppPetalHost\b/gu) || [];
    if (hostMounts.length > 0) {
      if (file !== pageOwner) {
        addFailure(`${file}: app-wide petal host belongs outside dashboard tab panes.`);
      }
      counts.host += hostMounts.length;
    }
    if (file.startsWith('src/themes/plugins/zen/pond/')) {
      if (file !== landingOwner && /\bcreateZenLandedFlowerPetal\s*\(/u.test(source)) {
        addFailure(`${file}: landed petals may be created only by the field landing receiver.`);
      }
      for (const token of [
        'syncPetalArray',
        'stepPetalPopulationTowardsTarget',
        'ensureFallingPetalPresence',
        'externalPetalImpact',
        'petalImpactToken',
        'new FlowerPetal(',
      ]) {
        if (source.includes(token)) {
          addFailure(`${file}: retired pond petal supply/input path ${token} must not return.`);
        }
      }
    }
  }));
  for (const [owner, count] of Object.entries(counts)) {
    if (count !== 1) {
      addFailure(`Zen app-wide petal ${owner} must have exactly one production instantiation; found ${count}.`);
    }
  }
};

const main = async () => {
  await ensureRequiredFiles();
  await ensureForbiddenFilesAbsent();
  await checkForbiddenImports();
  await checkRequiredContracts();
  await checkForbiddenSubstrings();
  await ensureNoSiblingTabImports();
  await checkDashboardSettingsCommandBoundaries();
  await checkDashboardSettingsQueryBoundaries();
  await checkClseDashboardFailureContracts();
  await checkZenAppPetalOwnership();

  if (failures.length > 0) {
    failures.forEach((message) => {
      console.error(`[dashboard-owner-architecture] ${message}`);
    });
    process.exit(1);
    return;
  }

  console.log('[dashboard-owner-architecture] PASS: dashboard owner architecture seams are canonical and legacy-free.');
};

main().catch((error) => {
  console.error('[dashboard-owner-architecture] Unexpected error:', error);
  process.exit(1);
});
