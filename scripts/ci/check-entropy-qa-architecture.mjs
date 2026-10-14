#!/usr/bin/env node

import fs from 'node:fs/promises';
import path from 'node:path';
import { getBuildCheckPlan } from './buildCheckManifest.mjs';
import { classifyQaErrorStatus } from '../qa/contracts/qaEvidenceContract.mjs';
import { EXTENSION_ARTIFACT_CHECK_PATHS } from './extensionArtifactCheckCatalog.mjs';

import {
  listQaProtocolIds,
} from '../qa/catalog/qaProtocolRegistry.mjs';
import {
  getQaTarget,
  listQaTargets,
} from '../qa/catalog/qaTargetRegistry.mjs';
import {
  QA_HUMAN_SETUP_DEFAULT_SITE_ID,
  QA_HUMAN_SETUP_FEATURES,
  QA_HUMAN_SETUP_SITE_IDS,
  QA_HUMAN_SETUP_SITES,
} from '../qa/catalog/qaHumanSetupCatalog.mjs';
import {
  getSiteScenarios,
} from '../e2e/sites/scenarioCatalog.mjs';

const rootDir = process.cwd();
const failures = [];

const requiredFiles = Object.freeze([
  'scripts/browser-qa/README.md',
  'docs/operations/qa/entropy-qa-control-plane.md',
  'docs/operations/qa/visual-capture-harness.md',
  'docs/architecture/runtime/dom-targeting-runtime-architecture.md',
  'docs/operations/qa/mv3-lifecycle-e2e.md',
  'docs/operations/qa/echo-artifacts-e2e.md',
  'scripts/qa/protocols/echoArtifactsQaProtocol.mjs',
  'tests/echoArtifactsQa.test.js',
  'scripts/qa/protocols/faviconQaProtocol.mjs',
  'tests/faviconQaProtocol.test.js',
  'docs/operations/qa/cws-runtime-measurement.md',
  'scripts/qa/entropyQa.mjs',
  'scripts/qa/cli/qaCliHelp.mjs',
  'scripts/qa/cli/qaCliOutput.mjs',
  'scripts/qa/cli/qaArtifactCommand.mjs',
  'scripts/qa/cli/qaArtifactArgs.mjs',
  'scripts/qa/cli/qaExplorationGuide.mjs',
  'scripts/qa/cli/qaExplorationArgs.mjs',
  'scripts/qa/cli/qaExplorationCommand.mjs',
  'scripts/qa/exploration/qaExplorationEnvironment.mjs',
  'scripts/qa/exploration/qaExplorationEvidence.mjs',
  'scripts/qa/exploration/qaExplorationReadiness.mjs',
  'scripts/qa/exploration/qaExplorationSession.mjs',
  'scripts/qa/exploration/qaExplorationRecovery.mjs',
  'scripts/ci/extensionArtifactCheckCatalog.mjs',
  'tests/qaSessionVerdict.test.js',
  'tests/qaOwnedInitialWindowPresentation.test.js',
  'tests/qaArtifactAdmissionLifetime.test.js',
  'tests/qaExplorationSession.test.js',
  'tests/qaExplorationRecovery.test.js',
  'tests/devExtensionBuildInputs.test.js',
  'tests/devExtensionArtifactPublisher.test.js',
  'scripts/qa/evidence/qaRunReport.mjs',
  'docs/operations/qa/agent-qa-workflow.md',
  'scripts/qa/catalog/qaTargetRegistry.mjs',
  'scripts/qa/catalog/qaProtocolRegistry.mjs',
  'scripts/qa/catalog/qaHumanSetupCatalog.mjs',
  'scripts/qa/contracts/qaTargetContract.mjs',
  'scripts/qa/contracts/qaExecutionPlanContract.mjs',
  'scripts/qa/contracts/qaEvidenceContract.mjs',
  'scripts/qa/contracts/qaArtifactAdmissionContract.mjs',
  'scripts/qa/contracts/qaInitialWindowFocusPolicy.mjs',
  'scripts/qa/contracts/qaBrowserRequirementContract.mjs',
  'scripts/qa/contracts/qaBrowserChildExecutionContract.mjs',
  'scripts/browser-qa/contracts/browserExecutionContract.mjs',
  'scripts/browser-qa/browser/chromiumGraphicsArguments.mjs',
  'scripts/browser-qa/browser/windowsLaunchPlacement.mjs',
  'scripts/browser-qa/browser/windowsMonitorInventory.ps1',
  'tests/browserQaWindowsLaunchPlacement.test.js',
  'scripts/browser-qa/browser/chromiumGpuInfoCollectionArguments.mjs',
  'scripts/qa/protocols/dashboardBootGpuInfoCollectionProbe.mjs',
  'tests/qaChromiumGpuInfoCollectionArguments.test.js',
  'tests/dashboardBootGpuInfoCollectionProbe.test.js',
  'scripts/browser-qa/browser/gpuCapability.mjs',
  'scripts/browser-qa/browser/attachedBrowserIdentity.mjs',
  'scripts/browser-qa/browser/chromiumProcessOwner.mjs',
  'scripts/browser-qa/browser/linuxProcessIdentity.mjs',
  'scripts/browser-qa/browser/playwrightBrowserOwner.mjs',
  'scripts/browser-qa/browser/cdpTargetOwner.mjs',
  'scripts/browser-qa/cdp/CdpConnection.mjs',
  'scripts/browser-qa/network/loopbackTcpProbe.mjs',
  'scripts/qa/browser/qaCdpTargetOwner.mjs',
  'scripts/qa/browser/qaChromiumProcessOwner.mjs',
  'scripts/qa/browser/qaOperatorBrowserWindow.mjs',
  'scripts/qa/browser/qaPersistentBrowserLifecycle.mjs',
  'scripts/qa/browser/qaPlaywrightBrowserOwner.mjs',
  'scripts/qa/desktop/entropyQaDesktopShortcut.mjs',
  'scripts/browser-qa/lifecycle/browserResourceRegistry.mjs',
  'scripts/browser-qa/lifecycle/persistentBrowserLifecycle.mjs',
  'scripts/browser-qa/resources/BrowserBroker.mjs',
  'scripts/browser-qa/resources/BrowserCapacityLease.mjs',
  'scripts/browser-qa/resources/BrowserTargetLease.mjs',
  'scripts/browser-qa/resources/DisplayLease.mjs',
  'scripts/browser-qa/resources/browserResourceScope.mjs',
  'scripts/qa/environment/qaBrowserInventory.mjs',
  'scripts/qa/environment/qaGpuCapability.mjs',
  'scripts/qa/environment/qaLocalConfig.mjs',
  'scripts/qa/environment/qaDoctor.mjs',
  'scripts/qa/profile/entropyQaProfileMarker.mjs',
  'scripts/qa/runtime/QaRunCompiler.mjs',
  'scripts/qa/runtime/QaRunSession.mjs',
  'scripts/qa/runtime/QaResourceCoordinator.mjs',
  'scripts/qa/runtime/qaChildProcess.mjs',
  'scripts/qa/runtime/qaWindowsChildJob.mjs',
  'scripts/qa/runtime/qaChildCooperativeAbort.mjs',
  'scripts/qa/runtime/qaChildAbortRegistry.mjs',
  'scripts/qa/drivers/windowsQaChildJob.ps1',
  'scripts/qa/drivers/windowsQaChildJob.cs',
  'scripts/qa/runtime/qaSignalCoordinator.mjs',
  'scripts/qa/resources/QaArtifactLease.mjs',
  'scripts/qa/resources/QaBrowserLease.mjs',
  'scripts/qa/resources/QaInitialWindowFocusAnchorLease.mjs',
  'scripts/qa/resources/QaAttachedBrowserOsFocusGuard.mjs',
  'scripts/qa/resources/QaBrowserBroker.mjs',
  'scripts/qa/resources/QaBrowserCapacityLease.mjs',
  'scripts/qa/resources/QaBrowserTargetLease.mjs',
  'scripts/qa/resources/QaDisplayLease.mjs',
  'scripts/qa/recovery/qaRecoveryInspector.mjs',
  'scripts/qa/recovery/QaRecoveryJournal.mjs',
  'scripts/qa/recovery/qaRecoveryRunner.mjs',
  'scripts/e2e/qaManagedXvfbChild.mjs',
  'scripts/qa/evidence/QaEvidenceWriter.mjs',
  'scripts/qa/evidence/qaAtomicJson.mjs',
  'tests/qaAtomicJson.test.js',
  'scripts/qa/drivers/windowsChromeToolbarDriver.mjs',
  'scripts/qa/drivers/windowsChromeToolbarAutomation.ps1',
  'scripts/qa/drivers/windowsEntropyQaDesktopShortcut.ps1',
  'scripts/qa/protocols/commandQaProtocol.mjs',
  'scripts/qa/protocols/attachOnlyActivePageAdapter.mjs',
  'scripts/qa/protocols/profileResetMaintenanceQaProtocol.mjs',
  'tests/profileResetMaintenanceQa.test.js',
  'scripts/qa/protocols/settingsConcurrencyQaProtocol.mjs',
  'scripts/qa/protocols/settingsPropagationQaProtocol.mjs',
  'tests/settingsConcurrencyQa.test.js',
  'tests/settingsPropagationQa.test.js',
  'tests/settingsPropagationQaFixture.test.js',
  'tests/settingsPropagationQaFixtureRoutes.test.js',
  'src/domains/settings/config/settingsPropagationQaFixtureContract.dev.js',
  'src/apps/background/services/runtime/support/settingsPropagationQaFixture.dev.js',
  'src/apps/background/services/runtime/support/settingsPropagationQaFixture.public.js',
  'src/apps/background/services/runtime/messageRoutes/settingsPropagationQaFixtureMessageRoutes.dev.js',
  'scripts/qa/protocols/audioDullingQaProtocol.mjs',
  'scripts/qa/protocols/feedHorizonQaProtocol.mjs',
  'scripts/qa/protocols/feedConsumptionResearchQaProtocol.mjs',
  'scripts/qa/protocols/gateRuntimeQaProtocol.mjs',
  'scripts/qa/protocols/mediaFrameHoldQaProtocol.mjs',
  'scripts/qa/protocols/mediaFrameHoldFixture.mjs',
  'scripts/qa/protocols/humanSetupQaProtocol.mjs',
  'scripts/qa/protocols/sentinelProtocolQaProtocol.mjs',
  'scripts/qa/protocols/goalEndsRealSiteQaProtocol.mjs',
  'scripts/qa/protocols/videoSkipControlSurfaceQaProtocol.mjs',
  'scripts/qa/protocols/siteRuntimeQaProtocol.mjs',
  'scripts/qa/protocols/siteRuntimeAttachedQaProtocol.mjs',
  'scripts/qa/protocols/visualCaptureQaProtocol.mjs',
  'scripts/qa/protocols/dashboardCaptureQaProtocol.mjs',
  'scripts/qa/contracts/dashboardCaptureViewportContract.mjs',
  'scripts/qa/protocols/dashboardCaptureDiagnostics.mjs',
  'scripts/qa/protocols/dashboardBootArtifactDiagnostics.mjs',
  'scripts/dev/visual-harness/visualHarnessServer.mjs',
  'scripts/dev/visual-harness/visualHarnessViteContract.mjs',
  'scripts/dev/visual-harness/visualHarnessSelectedScene.mjs',
  'scripts/qa/protocols/youtubeSelectorDriftCorpusQaProtocol.mjs',
  'scripts/qa/protocols/socialSelectorDriftCorpusQaProtocol.mjs',
  'scripts/e2e/chromiumHarnessTempCleanup.mjs',
  'scripts/e2e/internal/managedAttachedExtensionSlot.mjs',
  'scripts/e2e/mv3DataLifecycleE2E.mjs',
  'scripts/e2e/mv3LifecycleE2E.mjs',
  'scripts/e2e/releaseLifecycleMatrix.mjs',
  'scripts/e2e/siteRuntimeE2E.mjs',
  'scripts/e2e/feedHorizonQa.mjs',
  'scripts/e2e/feed-consumption-research/feedConsumptionResearchAnalysis.mjs',
  'scripts/e2e/feedHorizonQaPresetCatalog.mjs',
  'scripts/dev/zen-pond-render-research/README.md',
  'scripts/dev/zen-pond-render-research/host/agentRunner.mjs',
  'scripts/perf/cwsServiceWorkerWakeContract.mjs',
  'scripts/perf/cwsServiceWorkerColdQuiescence.mjs',
  'scripts/perf/cwsServiceWorkerDiagnostics.mjs',
  'scripts/perf/cwsCdpConnection.mjs',
  'scripts/perf/cwsChromeRuntime.mjs',
  'scripts/perf/measureCwsRuntime.mjs',
  'scripts/perf/cwsHistoryCleanupLifecycleScenario.mjs',
  'scripts/perf/cwsVisualPresentation.mjs',
  'tests/cwsVisualPresentation.test.js',
  'tests/siteRuntimeCollectorAvailability.test.js',
  'src/platform/security/qaAutomationHarnessTrust.dev.js',
  'src/domains/protection/background/audioDulling/audioDullingQaContract.dev.js',
  'src/domains/protection/content/buildCapabilityContentRelay.dev.js',
  'src/domains/protection/content/runtime/AudioDullingActivationChip.js',
  'src/domains/protection/background/automation/gateQaAutomationContract.dev.js',
  'src/domains/nudge/runtime-debugger/RuntimeDebuggerRuntime.js',
  'src/domains/nudge/runtime-debugger/automation/runtimeDebuggerAutomationContract.dev.js',
  'src/domains/nudge/runtime-debugger/automation/runtimeDebuggerAutomationContentRelay.dev.js',
  'src/domains/nudge/runtime/automation/sentinelProtocolQaAutomationContract.dev.js',
  'src/domains/nudge/video-skip/automation/videoSkipControlSurfaceQaContract.dev.js',
  'src/apps/background/services/runtime/messageRoutes/audioDullingQaMessageRoutes.dev.js',
  'src/apps/background/services/runtime/messageRoutes/gateQaAutomationMessageRoutes.dev.js',
  'src/apps/background/services/runtime/messageRoutes/runtimeDebuggerAutomationMessageRoutes.dev.js',
  'src/apps/background/services/runtime/messageRoutes/sentinelProtocolQaAutomationMessageRoutes.dev.js',
  'src/apps/background/services/runtime/messageRoutes/videoSkipControlSurfaceQaMessageRoutes.dev.js',
  'src/apps/background/services/runtime/messageRoutes/buildCapabilityMessageRoutes.dev.js',
  'src/apps/visual-harness/scenes/SiteFurinSequenceScene.jsx',
  'src/apps/visual-harness/scenes/GlobalSentinelSequenceScene.jsx',
  'src/apps/dashboard/qa/zenMainCaptureProfileContract.js',
  'src/apps/dashboard/qa/zenMainCaptureProfile.dev.js',
  'src/apps/dashboard/qa/zenMainCaptureProfile.public.js',
  'tests/entropyQaContracts.test.js',
  'tests/entropyQaArtifactCli.test.js',
  'tests/mediaFrameHoldQaProtocol.test.js',
  'tests/zenMainCaptureProfileContract.test.js',
  'tests/visualHarnessViteIsolation.test.js',
  'tests/visualHarnessSelectedScene.test.js',
  'tests/entropyQaDesktopShortcut.test.js',
  'tests/qaOperatorBrowserWindow.test.js',
  'tests/qaOperatorHandoffSession.test.js',
  'tests/entropyQaRuntime.test.js',
  'tests/entropyQaRecovery.test.js',
  'tests/browserQaLifecycle.test.js',
  'tests/qaBrowserBroker.test.js',
  'tests/qaBrowserLease.test.js',
  'tests/qaInitialWindowFocusAnchorLease.test.js',
  'tests/qaInitialWindowFocusPolicy.test.js',
  'tests/qaAttachedBrowserOsFocusGuard.test.js',
  'tests/qaCdpTargetOwner.test.js',
  'tests/qaChromiumProcessOwner.test.js',
  'tests/qaDisplayLease.test.js',
  'tests/qaPlaywrightBrowserOwner.test.js',
  'tests/browserQaExecutionContract.test.js',
  'tests/siteRuntimeQaProtocol.test.js',
  'tests/youtubeSelectorDriftCorpusQaProtocol.test.js',
  'tests/socialSelectorDriftCorpusQaProtocol.test.js',
  'tests/attachOnlyActivePageAdapter.test.js',
  'tests/audioDullingQaProtocolFocus.test.js',
  'tests/browserQaCdpConnection.test.js',
  'tests/extensionCdpConnectionAdapter.test.js',
  'tests/managedAttachedExtensionSlot.test.js',
  'tests/windowsChromeToolbarDriver.test.js',
  'tests/cwsServiceWorkerWakeContract.test.js',
  'tests/cwsServiceWorkerColdQuiescence.test.js',
  'tests/cwsServiceWorkerDiagnostics.test.js',
  'tests/cwsCdpConnection.test.js',
  'tests/cwsChromeRuntime.test.js',
  'tests/publicBuildDebugSurface.test.js',
  'tests/audioDullingQaBridge.test.js',
  'tests/audioDullingActivationChip.test.js',
  'tests/feedHorizonQa.test.js',
  'tests/feedConsumptionResearch.test.js',
  'tests/feedConsumptionResearchQa.test.js',
  'tests/feedHorizonInspectionFocus.test.js',
  'tests/gateQaAutomationBridge.test.js',
  'tests/humanSetupQaContracts.test.js',
  'tests/qaHumanSetupCatalog.test.js',
  'tests/runtimeDebuggerAutomationBridge.test.js',
  'tests/runtimeDebuggerOverlay.test.js',
  'tests/sentinelProtocolQaAutomationBridge.test.js',
  'tests/sentinelProtocolQaProtocol.test.js',
  'tests/videoSkipControlSurfaceQaBridge.test.js',
  'tests/videoSkipControlSurfaceQaContentRelay.test.js',
  'tests/videoSkipControlSurfaceQaProtocol.test.js',
  'tests/themes/zenPondResearchHarness.test.js',
]);

async function read(relativePath) {
  return fs.readFile(path.join(rootDir, relativePath), 'utf8');
}

function requireCondition(condition, message) {
  if (!condition) failures.push(message);
}

function sameStringArray(left, right) {
  return Array.isArray(left)
    && left.length === right.length
    && left.every((value, index) => value === right[index]);
}

for (const relativePath of requiredFiles) {
  const exists = await fs.access(path.join(rootDir, relativePath))
    .then(() => true, () => false);
  requireCondition(exists, `missing required QA control-plane file: ${relativePath}`);
}

const neutralBrowserQaRoot = path.join(rootDir, 'scripts/browser-qa');
const neutralBrowserQaFiles = (await fs.readdir(neutralBrowserQaRoot, {
  recursive: true,
  withFileTypes: true,
}))
  .filter((entry) => entry.isFile() && entry.name.endsWith('.mjs'))
  .map((entry) => path.join(entry.parentPath, entry.name));
const neutralDependencyFailures = [];
for (const absolutePath of neutralBrowserQaFiles) {
  const relativePath = path.relative(rootDir, absolutePath).replaceAll('\\', '/');
  const source = await fs.readFile(absolutePath, 'utf8');
  const specifiers = [
    ...source.matchAll(/\bfrom\s+['"]([^'"]+)['"]/gu),
    ...source.matchAll(/\bimport\s*\(\s*['"]([^'"]+)['"]\s*\)/gu),
    ...source.matchAll(/(?:^|\n)\s*import\s*['"]([^'"]+)['"]/gu),
  ].map((match) => match[1]);
  for (const specifier of specifiers) {
    if (specifier.startsWith('node:') || specifier === 'playwright') continue;
    if (!specifier.startsWith('.')) {
      neutralDependencyFailures.push(`${relativePath}:external:${specifier}`);
      continue;
    }
    const resolved = path.resolve(path.dirname(absolutePath), specifier);
    const neutralRelative = path.relative(neutralBrowserQaRoot, resolved);
    if (
      neutralRelative === '..'
      || neutralRelative.startsWith(`..${path.sep}`)
      || path.isAbsolute(neutralRelative)
    ) {
      neutralDependencyFailures.push(`${relativePath}:escape:${specifier}`);
    }
  }
  if (
    relativePath !== 'scripts/browser-qa/runtime/managedXvfbChild.mjs'
    && /\bprocess\.argv\b/u.test(source)
  ) {
    neutralDependencyFailures.push(`${relativePath}:process.argv`);
  }
}
requireCondition(
  neutralDependencyFailures.length === 0,
  `neutral browser-QA runtime escaped its dependency boundary: ${neutralDependencyFailures.join(',')}`,
);

const neutralCompatibilityExports = Object.freeze({
  'scripts/qa/browser/qaCdpTargetOwner.mjs': '../../browser-qa/browser/cdpTargetOwner.mjs',
  'scripts/qa/browser/qaChromiumProcessOwner.mjs': '../../browser-qa/browser/chromiumProcessOwner.mjs',
  'scripts/qa/environment/qaGpuCapability.mjs': '../../browser-qa/browser/gpuCapability.mjs',
  'scripts/qa/resources/QaBrowserBroker.mjs': '../../browser-qa/resources/BrowserBroker.mjs',
  'scripts/qa/resources/QaBrowserCapacityLease.mjs': '../../browser-qa/resources/BrowserCapacityLease.mjs',
  'scripts/qa/resources/QaBrowserTargetLease.mjs': '../../browser-qa/resources/BrowserTargetLease.mjs',
  'scripts/qa/resources/QaDisplayLease.mjs': '../../browser-qa/resources/DisplayLease.mjs',
});
for (const [relativePath, specifier] of Object.entries(neutralCompatibilityExports)) {
  const source = await read(relativePath);
  const executableLines = source
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith('//'));
  requireCondition(
    executableLines.length === 1
      && executableLines[0] === `export * from '${specifier}';`,
    `Entropy browser-QA compatibility module regained implementation ownership: ${relativePath}`,
  );
}
const qaPlaywrightCompatibilityOwner = await read(
  'scripts/qa/browser/qaPlaywrightBrowserOwner.mjs',
);
requireCondition(
  qaPlaywrightCompatibilityOwner.includes(
    "from '../../browser-qa/browser/playwrightBrowserOwner.mjs'",
  )
    && qaPlaywrightCompatibilityOwner.includes(
      "from '../../browser-qa/contracts/browserExecutionContract.mjs'",
    )
    && qaPlaywrightCompatibilityOwner.includes(
      'synthesizeLegacyAttachExecutionContract',
    )
    && qaPlaywrightCompatibilityOwner.includes(
      'synthesizeLegacyLaunchExecutionContract',
    )
    && qaPlaywrightCompatibilityOwner.includes(
      'attachNeutralPlaywrightBrowserOverCdp(',
    )
    && qaPlaywrightCompatibilityOwner.includes('launchNeutralPlaywrightBrowser(')
    && !/\b(?:chromium|firefox|webkit)\.(?:launch|launchPersistentContext|connectOverCDP)\s*\(/u
      .test(qaPlaywrightCompatibilityOwner),
  'Entropy Playwright compatibility must own only legacy contract synthesis and delegate browser work',
);

const targets = listQaTargets();
const registeredProtocolIds = new Set(listQaProtocolIds());
targets.forEach((target) => {
  requireCondition(
    registeredProtocolIds.has(target.protocolId),
    `QA target references an unregistered protocol: ${target.id}:${target.protocolId}`,
  );
  if (target.protocolId === 'command') {
    requireCondition(
      typeof target.protocolOptions.script === 'string',
      `command QA target must name one script: ${target.id}`,
    );
  }
});
const expectedHumanSetupSites = Object.freeze([
  ['youtube', 'https://www.youtube.com/', 'https://www.youtube.com'],
  ['youtube-shorts', 'https://www.youtube.com/shorts/', 'https://www.youtube.com'],
  ['x', 'https://x.com/home', 'https://x.com'],
  ['instagram', 'https://www.instagram.com/', 'https://www.instagram.com'],
  ['instagram-reels', 'https://www.instagram.com/reels/', 'https://www.instagram.com'],
  ['tiktok', 'https://www.tiktok.com/', 'https://www.tiktok.com'],
  ['reddit', 'https://www.reddit.com/r/popular/', 'https://www.reddit.com'],
  ['facebook', 'https://www.facebook.com/', 'https://www.facebook.com'],
]);
const expectedHumanSetupFeatures = Object.freeze([
  [
    'site_furin',
    'human/site-furin',
    'sentinel_protocol',
    'direct_realization',
    'runtime:sentinel-protocol',
  ],
  [
    'global_sentinel',
    'human/global-furin',
    'sentinel_protocol',
    'direct_realization',
    'runtime:sentinel-protocol',
  ],
  [
    'shishi_odoshi',
    'human/shishi-odoshi',
    'gate_interstitial',
    'direct_realization',
    'runtime:gate-interstitial',
  ],
  [
    'enso_gate',
    'human/enso-gate',
    'interaction_manager',
    'debug_realization_without_detector_admission',
    'runtime:nudge-debugger',
  ],
  [
    'detour_spread_guard',
    'human/detour-spread-guard',
    'gate_interstitial',
    'owned_tab_realization_without_detector_admission',
    'runtime:gate-interstitial',
  ],
]);
requireCondition(
  QA_HUMAN_SETUP_DEFAULT_SITE_ID === 'youtube'
    && sameStringArray(
      QA_HUMAN_SETUP_SITE_IDS,
      expectedHumanSetupSites.map(([siteId]) => siteId),
    )
    && JSON.stringify(QA_HUMAN_SETUP_SITES.map((site) => [
      site.id,
      site.defaultUrl,
      site.allowedOrigin,
    ])) === JSON.stringify(expectedHumanSetupSites)
    && JSON.stringify(QA_HUMAN_SETUP_FEATURES.map((feature) => [
      feature.id,
      feature.targetId,
    ])) === JSON.stringify(
      expectedHumanSetupFeatures.map(([featureId, targetId]) => [featureId, targetId]),
    ),
  'human setup catalog must retain canonical exact-origin sites and one target identity per composable feature',
);
const humanSetupTargets = targets.filter((target) => target.family === 'human');
requireCondition(
  registeredProtocolIds.has('human_setup')
    && sameStringArray(
      humanSetupTargets.map((target) => target.id),
      expectedHumanSetupFeatures.map(([, targetId]) => targetId),
    ),
  'human setup must publish exactly five feature targets instead of a site-by-feature target matrix',
);
expectedHumanSetupFeatures.forEach(([
  featureId,
  targetId,
  productOwner,
  admissionMode,
  productResourceClaim,
]) => {
  const target = humanSetupTargets.find((entry) => entry.id === targetId);
  requireCondition(
    target?.protocolId === 'human_setup'
      && target.lane === 'real_site'
      && target.environmentId === 'authenticated'
      && target.artifactId === 'dev_extension'
      && sameStringArray(target.supportedModes, ['human'])
      && target.browserRequirements?.authentication === 'persistent'
      && target.browserRequirements?.extensionRuntime === 'required'
      && target.browserRequirements?.rendering === 'headed_required'
      && target.browserRequirements?.defaultPresentation === 'foreground'
      && target.browserRequirements?.hiddenAllowed === false
      && target.browserRequirements?.documentVisibility === 'visible_required'
      && target.browserRequirements?.targetActivation === 'active'
      && target.browserRequirements?.osFocus === 'never'
      && sameStringArray(
        target.resourceClaims,
        ['runtime:human-setup', productResourceClaim],
      )
      && target.parameters?.site?.default === QA_HUMAN_SETUP_DEFAULT_SITE_ID
      && sameStringArray(target.parameters?.site?.values, QA_HUMAN_SETUP_SITE_IDS)
      && target.parameters?.url?.type === 'string'
      && target.parameters?.url?.cliName === 'url'
      && target.parameters?.rebuild?.default === false
      && JSON.stringify(target.operatorHandoffPolicy) === JSON.stringify({
        focus: 'operator_request_once',
        lifetime: 'until_explicit_cancel',
        cleanup: 'exact_owned_targets',
      })
      && target.protocolOptions?.featureId === featureId
      && target.protocolOptions?.productOwner === productOwner
      && target.protocolOptions?.admissionMode === admissionMode,
    `human setup target lost its typed human-only exact-handoff contract: ${targetId}`,
  );
});
const siteFurinHumanTarget = humanSetupTargets.find(
  (target) => target.id === 'human/site-furin',
);
const globalFurinHumanTarget = humanSetupTargets.find(
  (target) => target.id === 'human/global-furin',
);
const detourSpreadHumanTarget = humanSetupTargets.find(
  (target) => target.id === 'human/detour-spread-guard',
);
requireCondition(
  [siteFurinHumanTarget, globalFurinHumanTarget].every((target) => (
    target?.parameters?.intensityPercent?.minimum === 0
    && target.parameters.intensityPercent.maximum === 100
    && target.parameters.intensityPercent.default === 88
    && target.parameters.hudVisible?.default === false
    && target.parameters.captureScreenshots?.default === false
  ))
    && detourSpreadHumanTarget?.parameters?.maxProtectedTabs?.minimum === 1
    && detourSpreadHumanTarget.parameters.maxProtectedTabs.maximum === 20
    && detourSpreadHumanTarget.parameters.openTabCount?.minimum === 2
    && detourSpreadHumanTarget.parameters.openTabCount.maximum === 25
    && !Object.hasOwn(detourSpreadHumanTarget.parameters, 'presentationMode'),
  'human setup feature parameters must remain bounded and target-owned',
);
for (const target of targets.filter((entry) => entry.protocolId === 'command')) {
  const scriptPath = path.join(rootDir, target.protocolOptions.script);
  const exists = await fs.access(scriptPath).then(() => true, () => false);
  requireCondition(
    exists,
    `command QA target script is unavailable: ${target.id}:${target.protocolOptions.script}`,
  );
}
for (const target of targets.filter((entry) => entry.protocolId === 'site_runtime')) {
  requireCondition(
    target.artifactId === null
      && target.protocolOptions.artifactOwnership === 'site_runtime_lane'
      && target.resourceClaims.includes('artifact:dev_extension')
      && target.resourceClaims.includes('artifact:public_extension'),
    `site-runtime target must retain lane artifact ownership and shared-path locks: ${target.id}`,
  );
}
const redditSurfaceAttachedTarget = targets.find((target) => (
  target.id === 'site/reddit-surface-attached'
));
requireCondition(
  redditSurfaceAttachedTarget?.protocolId === 'site_runtime_attached'
    && redditSurfaceAttachedTarget.environmentId === 'authenticated'
    && redditSurfaceAttachedTarget.artifactId === null
    && redditSurfaceAttachedTarget.supportedModes.length === 1
    && redditSurfaceAttachedTarget.supportedModes[0] === 'agent'
    && redditSurfaceAttachedTarget.browserRequirements.osFocus === 'never'
    && redditSurfaceAttachedTarget.browserRequirements.extensionRuntime === 'none'
    && redditSurfaceAttachedTarget.browserRequirements.documentVisibility === 'background_allowed'
    && redditSurfaceAttachedTarget.browserRequirements.targetActivation === 'background'
    && redditSurfaceAttachedTarget.browserRequirements.defaultPresentation === 'background'
    && redditSurfaceAttachedTarget.protocolOptions.scope
      === 'managed_browser_reddit_access_and_dom_structural_opportunity_only'
    && redditSurfaceAttachedTarget.protocolOptions.settingsAndSiteRulePolicy
      === 'zero_settings_and_site_rule_commands'
    && redditSurfaceAttachedTarget.protocolOptions.existingTargetPolicy
      === 'unique_exact_route_attach_evaluate_detach'
    && !redditSurfaceAttachedTarget.resourceClaims.includes('artifact:public_extension')
    && redditSurfaceAttachedTarget.resourceClaims.includes('runtime:site-e2e'),
  'Reddit attached surface target must remain a no-artifact, background, zero settings/site-rule command observation of one existing route',
);
const tiktokFeedFlowTarget = targets.find((target) => (
  target.id === 'site/tiktok-feed-flow'
));
const youtubeSelectorDriftTarget = targets.find((target) => (
  target.id === 'site/youtube-selector-drift'
));
const youtubeSelectorDriftCorpusPublicTarget = targets.find((target) => (
  target.id === 'site/youtube-selector-drift-corpus-public'
));
const youtubeSelectorDriftCorpusAuthenticatedTarget = targets.find((target) => (
  target.id === 'site/youtube-selector-drift-corpus-authenticated'
));
const socialSelectorDriftCorpusAuthenticatedTarget = targets.find((target) => (
  target.id === 'site/social-selector-drift-corpus-authenticated'
));
const youtubeSelectorDriftScenarios = youtubeSelectorDriftTarget
  ? getSiteScenarios({
    suite: youtubeSelectorDriftTarget.protocolOptions.suite,
    siteId: youtubeSelectorDriftTarget.parameters.site?.default,
    featureGroup: youtubeSelectorDriftTarget.protocolOptions.featureGroups?.social,
  })
  : [];
requireCondition(
  youtubeSelectorDriftTarget?.protocolId === 'site_runtime'
    && youtubeSelectorDriftTarget.environmentId === 'ephemeral'
    && youtubeSelectorDriftTarget.protocolOptions.suite === 'release-core'
    && youtubeSelectorDriftTarget.protocolOptions.siteSelection === true
    && youtubeSelectorDriftTarget.protocolOptions.repeatIsolation
      === 'fresh_disposable_browser'
    && youtubeSelectorDriftTarget.protocolOptions.featureGroups?.social
      === 'video-shortform-social'
    && !Object.hasOwn(youtubeSelectorDriftTarget.protocolOptions, 'reportAcceptance')
    && youtubeSelectorDriftTarget.parameters.site?.default === 'youtube'
    && youtubeSelectorDriftTarget.parameters.site?.values?.length === 1
    && youtubeSelectorDriftTarget.parameters.site.values[0] === 'youtube'
    && youtubeSelectorDriftTarget.parameters.lane?.default === 'diagnostic'
    && youtubeSelectorDriftTarget.parameters.lane?.values?.length === 1
    && youtubeSelectorDriftTarget.parameters.lane.values[0] === 'diagnostic'
    && youtubeSelectorDriftTarget.parameters.feature?.default === 'social'
    && youtubeSelectorDriftTarget.parameters.feature?.values?.length === 1
    && youtubeSelectorDriftTarget.parameters.feature.values[0] === 'social'
    && youtubeSelectorDriftTarget.parameters.repeat?.minimum === 3
    && youtubeSelectorDriftTarget.parameters.repeat?.default === 3
    && youtubeSelectorDriftTarget.browserRequirements.osFocus === 'never'
    && youtubeSelectorDriftTarget.resourceClaims.includes('runtime:site-e2e'),
  'YouTube selector-drift observation must retain three fresh diagnostic browser/profile epochs',
);
requireCondition(
  youtubeSelectorDriftScenarios.length === 1
    && youtubeSelectorDriftScenarios[0]?.id === 'youtube-public-core'
    && Array.isArray(
      youtubeSelectorDriftScenarios[0].expectedActivation?.socialMetrics?.activeMetricKeys,
    )
    && youtubeSelectorDriftScenarios[0].expectedActivation.socialMetrics
      .activeMetricKeys.includes('feedbackCounts'),
  'YouTube selector-drift observation must reuse the canonical release-core Social Metrics scenario',
);
const selectorCorpusContract = (target) => (
  target?.protocolId === 'youtube_selector_drift_corpus'
  && target.artifactId === null
  && target.supportedModes.length === 1
  && target.supportedModes[0] === 'agent'
  && target.browserRequirements.extensionRuntime === 'none'
  && target.browserRequirements.osFocus === 'never'
  && target.protocolOptions.scope
    === 'youtube_selector_drift_independent_candidate_corpus'
  && target.protocolOptions.collectionPolicy
    === 'read_only_bounded_redacted_human_review_required'
  && target.protocolOptions.productDetectorInfluence === false
  && target.protocolOptions.profileWritePolicy === 'forbidden'
  && target.protocolOptions.existingTargetPolicy
    === 'unique_existing_route_attach_evaluate_detach'
  && target.resourceClaims.length === 1
  && target.resourceClaims[0] === 'runtime:youtube-selector-drift-corpus'
);
requireCondition(
  selectorCorpusContract(youtubeSelectorDriftCorpusPublicTarget)
    && youtubeSelectorDriftCorpusPublicTarget.environmentId === 'ephemeral'
    && youtubeSelectorDriftCorpusPublicTarget.browserRequirements.authentication === 'none'
    && youtubeSelectorDriftCorpusPublicTarget.browserRequirements.defaultPresentation === 'hidden'
    && youtubeSelectorDriftCorpusPublicTarget.browserRequirements.documentVisibility
      === 'visible_required'
    && youtubeSelectorDriftCorpusPublicTarget.browserRequirements.targetActivation === 'active'
    && youtubeSelectorDriftCorpusPublicTarget.parameters.surface?.default === 'watch'
    && sameStringArray(
      youtubeSelectorDriftCorpusPublicTarget.parameters.surface?.values,
      ['watch', 'shorts'],
    )
    && youtubeSelectorDriftCorpusPublicTarget.parameters.locale?.default === 'ko'
    && sameStringArray(
      youtubeSelectorDriftCorpusPublicTarget.parameters.locale?.values,
      ['en', 'ko'],
    ),
  'YouTube public selector corpus must remain a no-extension disposable Korean/English bounded observation',
);
requireCondition(
  selectorCorpusContract(youtubeSelectorDriftCorpusAuthenticatedTarget)
    && youtubeSelectorDriftCorpusAuthenticatedTarget.environmentId === 'authenticated'
    && youtubeSelectorDriftCorpusAuthenticatedTarget.browserRequirements.authentication
      === 'persistent'
    && youtubeSelectorDriftCorpusAuthenticatedTarget.browserRequirements.defaultPresentation
      === 'background'
    && youtubeSelectorDriftCorpusAuthenticatedTarget.browserRequirements.documentVisibility
      === 'background_allowed'
    && youtubeSelectorDriftCorpusAuthenticatedTarget.browserRequirements.targetActivation
      === 'background'
    && youtubeSelectorDriftCorpusAuthenticatedTarget.parameters.surface?.default === 'watch'
    && sameStringArray(
      youtubeSelectorDriftCorpusAuthenticatedTarget.parameters.surface?.values,
      ['watch', 'shorts'],
    )
    && !Object.hasOwn(
      youtubeSelectorDriftCorpusAuthenticatedTarget.parameters,
      'locale',
    ),
  'YouTube authenticated selector corpus must only borrow one existing managed-browser route without focus or navigation',
);
const youtubeSelectorCorpusProtocol = await read(
  'scripts/qa/protocols/youtubeSelectorDriftCorpusQaProtocol.mjs',
);
requireCondition(
  youtubeSelectorCorpusProtocol.includes('ExtensionChromiumHarness')
    && youtubeSelectorCorpusProtocol.includes("extensionEnabled: false")
    && youtubeSelectorCorpusProtocol.includes("targetCreationCount: 1")
    && youtubeSelectorCorpusProtocol.includes("targetCreationCount: 0")
    && youtubeSelectorCorpusProtocol.includes("processAction: 'attach_disconnect_only'")
    && youtubeSelectorCorpusProtocol.includes('STABILIZATION_QUIET_MS = 500')
    && youtubeSelectorCorpusProtocol.includes('STABILIZATION_TIMEOUT_MS = 6_000')
    && youtubeSelectorCorpusProtocol.includes('if (nodeCount >= 96 || depth > 6)')
    && youtubeSelectorCorpusProtocol.includes("'Accept-Language'")
    && youtubeSelectorCorpusProtocol.includes('Emulation.setLocaleOverride')
    && youtubeSelectorCorpusProtocol.includes('yt-player-quick-action-buttons')
    && youtubeSelectorCorpusProtocol.includes("node.matches('like-button-view-model")
    && youtubeSelectorCorpusProtocol.includes("pathData: '[REDACTED]'")
    && youtubeSelectorCorpusProtocol.includes('const countPattern = /^(?:조회수')
    && youtubeSelectorCorpusProtocol.includes('const timePattern = /^(?:')
    && youtubeSelectorCorpusProtocol.includes("profileWritePolicy !== 'forbidden'")
    && youtubeSelectorCorpusProtocol.includes('productDetectorInfluence: false')
    && youtubeSelectorCorpusProtocol.includes('Target.detachFromTarget')
    && !youtubeSelectorCorpusProtocol.includes("from '../../../src/domains/nudge")
    && !youtubeSelectorCorpusProtocol.includes('EXPERIMENT_FLAGS')
    && !youtubeSelectorCorpusProtocol.includes('ytcfg.get'),
  'YouTube selector corpus protocol must retain bounded independent read-only capture, strict redaction, and attach-only cleanup',
);
requireCondition(
  socialSelectorDriftCorpusAuthenticatedTarget?.protocolId
    === 'social_selector_drift_corpus'
    && socialSelectorDriftCorpusAuthenticatedTarget.environmentId === 'authenticated'
    && socialSelectorDriftCorpusAuthenticatedTarget.artifactId === null
    && socialSelectorDriftCorpusAuthenticatedTarget.supportedModes.length === 1
    && socialSelectorDriftCorpusAuthenticatedTarget.supportedModes[0] === 'agent'
    && socialSelectorDriftCorpusAuthenticatedTarget.browserRequirements.authentication
      === 'persistent'
    && socialSelectorDriftCorpusAuthenticatedTarget.browserRequirements.extensionRuntime
      === 'none'
    && socialSelectorDriftCorpusAuthenticatedTarget.browserRequirements.defaultPresentation
      === 'background'
    && socialSelectorDriftCorpusAuthenticatedTarget.browserRequirements.documentVisibility
      === 'background_allowed'
    && socialSelectorDriftCorpusAuthenticatedTarget.browserRequirements.targetActivation
      === 'background'
    && socialSelectorDriftCorpusAuthenticatedTarget.browserRequirements.osFocus === 'never'
    && socialSelectorDriftCorpusAuthenticatedTarget.parameters.surface?.default === 'x_post'
    && sameStringArray(
      socialSelectorDriftCorpusAuthenticatedTarget.parameters.surface?.values,
      [
        'x_post',
        'instagram_feed',
        'instagram_reels',
        'instagram_profile_grid_dialog',
      ],
    )
    && socialSelectorDriftCorpusAuthenticatedTarget.parameters
      .allowInitialWindowFocusOnce?.default === false
    && socialSelectorDriftCorpusAuthenticatedTarget.protocolOptions.scope
      === 'social_selector_drift_independent_candidate_corpus'
    && socialSelectorDriftCorpusAuthenticatedTarget.protocolOptions.collectionPolicy
      === 'read_only_bounded_redacted_human_review_required'
    && socialSelectorDriftCorpusAuthenticatedTarget.protocolOptions
      .productDetectorInfluence === false
    && socialSelectorDriftCorpusAuthenticatedTarget.protocolOptions.profileWritePolicy
      === 'forbidden'
    && socialSelectorDriftCorpusAuthenticatedTarget.protocolOptions.targetPolicy
      === 'protocol_owned_exact_target_create_navigate_observe_close'
    && socialSelectorDriftCorpusAuthenticatedTarget.resourceClaims.length === 1
    && socialSelectorDriftCorpusAuthenticatedTarget.resourceClaims[0]
      === 'runtime:social-selector-drift-corpus',
  'X and Instagram selector corpus must retain one background owned target, no focus, no extension, and independent candidate-only evidence',
);
const socialSelectorCorpusProtocol = await read(
  'scripts/qa/protocols/socialSelectorDriftCorpusQaProtocol.mjs',
);
requireCondition(
  socialSelectorCorpusProtocol.includes("const TARGET_POLICY = 'protocol_owned_exact_target_create_navigate_observe_close'")
    && socialSelectorCorpusProtocol.includes('productDetectorInfluence !== false')
    && socialSelectorCorpusProtocol.includes("profileWritePolicy !== 'forbidden'")
    && socialSelectorCorpusProtocol.includes("targetPolicy !== TARGET_POLICY")
    && socialSelectorCorpusProtocol.includes("background: true")
    && socialSelectorCorpusProtocol.includes('activateTarget: false')
    && socialSelectorCorpusProtocol.includes('enableQaCdpNoFocusPageExecution')
    && socialSelectorCorpusProtocol.includes("Target.attachToTarget")
    && socialSelectorCorpusProtocol.includes("Target.detachFromTarget")
    && socialSelectorCorpusProtocol.includes('targetActivationCount: 0')
    && socialSelectorCorpusProtocol.includes('osFocusRequestIssued: false')
    && socialSelectorCorpusProtocol.includes('baselinePageTargetSetPreserved: true')
    && socialSelectorCorpusProtocol.includes('if (nodeCount >= 80 || depth > 5)')
    && socialSelectorCorpusProtocol.includes("pathData: '[REDACTED]'")
    && socialSelectorCorpusProtocol.includes("'instagram_profile_grid_dialog'")
    && socialSelectorCorpusProtocol.includes("'pointerover'")
    && socialSelectorCorpusProtocol.includes('candidates[0].click()')
    && socialSelectorCorpusProtocol.includes('uniqueMetricLeaf')
    && !socialSelectorCorpusProtocol.includes("from '../../../src/domains/nudge")
    && !socialSelectorCorpusProtocol.includes('EXPERIMENT_FLAGS')
    && !socialSelectorCorpusProtocol.includes('svg path'),
  'X and Instagram selector corpus protocol must retain bounded redaction, exact owned-target cleanup, no-focus execution, and fail-closed opportunity evidence',
);
const tiktokFeedFlowScenarios = tiktokFeedFlowTarget
  ? getSiteScenarios({
    suite: tiktokFeedFlowTarget.protocolOptions.suite,
    siteId: tiktokFeedFlowTarget.parameters.site?.default,
  })
  : [];
requireCondition(
  tiktokFeedFlowTarget?.protocolId === 'site_runtime'
    && tiktokFeedFlowTarget.environmentId === 'ephemeral'
    && tiktokFeedFlowTarget.protocolOptions.suite === 'release-core'
    && tiktokFeedFlowTarget.protocolOptions.siteSelection === true
    && tiktokFeedFlowTarget.protocolOptions.repeatIsolation
      === 'fresh_disposable_browser'
    && !Object.hasOwn(tiktokFeedFlowTarget.protocolOptions, 'measurementProfiles')
    && tiktokFeedFlowTarget.protocolOptions.reportAcceptance?.kind
      === 'feed_consumption_exact_match'
    && tiktokFeedFlowTarget.protocolOptions.reportAcceptance
      ?.minimumOpportunityCountPerRun === 2
    && tiktokFeedFlowTarget.protocolOptions.reportAcceptance?.scenarioId
      === 'tiktok-public-feed'
    && tiktokFeedFlowTarget.parameters.site?.default === 'tiktok'
    && tiktokFeedFlowTarget.parameters.site?.values?.length === 1
    && tiktokFeedFlowTarget.parameters.site.values[0] === 'tiktok'
    && tiktokFeedFlowTarget.parameters.lane?.default === 'diagnostic'
    && tiktokFeedFlowTarget.parameters.lane?.values?.length === 1
    && tiktokFeedFlowTarget.parameters.lane.values[0] === 'diagnostic'
    && tiktokFeedFlowTarget.parameters.repeat?.default === 3
    && tiktokFeedFlowTarget.browserRequirements.osFocus === 'never'
    && tiktokFeedFlowTarget.resourceClaims.includes('runtime:site-e2e'),
  'TikTok FeedFlow acceptance must retain its isolated diagnostic release-core route and two-opportunity per-run gate',
);
requireCondition(
  tiktokFeedFlowScenarios.length === 1
    && tiktokFeedFlowScenarios[0]?.id === 'tiktok-public-feed'
    && tiktokFeedFlowScenarios[0].observableEffects?.conditions?.some((condition) => (
      condition.id === 'feed-consumption-exact-match'
        && condition.kind === 'debug_feed_consumption_journey'
        && condition.path === 'feedFlow.ledger'
        && condition.lane === 'diagnostic'
    )),
  'TikTok FeedFlow acceptance target must resolve the canonical exact-match release-core scenario',
);
for (const target of targets.filter((entry) => entry.protocolId === 'audio_dulling')) {
  requireCondition(
    target.id === 'audio/suikinkutsu'
      && target.environmentId === 'authenticated'
      && target.artifactId === 'dev_extension'
      && target.supportedModes.length === 2
      && target.supportedModes[0] === 'human'
      && target.supportedModes[1] === 'agent'
      && target.browserRequirements.osFocus === 'request_once'
      && target.resourceClaims.includes('runtime:audio-dulling'),
    `audio-dulling target must retain human/agent, authenticated attach-only, and dev-artifact ownership: ${target.id}`,
  );
}
// Three families enter through the same attach-only Feed owner but hold mutually
// exclusive contracts. The platform family runs feedback-only inspection; the
// gate family runs the production causal chain and must never arm inspection.
const feedHorizonTargets = targets.filter((entry) => (
  entry.protocolId === 'feed_horizon' && entry.family === 'feed'
));
const feedGateTargets = targets.filter((entry) => entry.family === 'feed_gate');
const feedGestureTargets = targets.filter((entry) => entry.family === 'feed_gesture');
requireCondition(feedGestureTargets.length === 1 && feedGestureTargets.every(target => (
  target.id === 'feed/gesture/instagram-reels'
  && target.protocolId === 'feed_horizon'
  && target.environmentId === 'authenticated'
  && target.artifactId === 'dev_extension'
  && target.supportedModes.length === 1 && target.supportedModes[0] === 'agent'
  && target.protocolOptions.gateMode === 'manual_handoff'
  && target.browserObservation === 'document'
  && target.browserRequirements.osFocus === 'never'
  && !Object.hasOwn(target.parameters, 'gateDriveMs')
  && target.resourceClaims.includes('runtime:feed-horizon')
)), 'Reels Gesture Gate must retain explicit manual admission and document observation');
for (const target of targets.filter((entry) => (
  entry.supportedModes.includes('agent')
  && Object.hasOwn(entry.parameters, 'allowInitialWindowFocusOnce')
))) {
  requireCondition(
    target.parameters.allowInitialWindowFocusOnce.default === false
      && target.browserRequirements.osFocus === 'never',
    `QA preparation must require explicit initial-window focus opt-in while preserving steady-state focus: ${target.id}`,
  );
}
requireCondition(
  feedHorizonTargets.length === 7,
  'Feed Horizon QA must publish seven named platform/surface targets',
);
requireCondition(
  feedGateTargets.length === 3,
  'Feed gate QA must publish three natural-gate surface targets',
);
for (const target of feedGateTargets) {
  requireCondition(
    target.protocolId === 'feed_horizon'
      && target.environmentId === 'authenticated'
      && target.artifactId === 'dev_extension'
      && target.supportedModes.length === 1
      && target.supportedModes[0] === 'agent'
      && target.browserRequirements.osFocus === 'never'
      // Without a drive budget the runner falls back to the endpoint-driven path
      // and the target silently stops testing the gate it is named for.
      && Number(target.parameters.gateDriveMs?.default) > 0
      // Production Gate timing belongs to the endpoint owner. The inspection
      // hold override is deliberately absent from this target family.
      && !Object.hasOwn(target.parameters, 'holdMs')
      && target.resourceClaims.includes('runtime:feed-horizon'),
    `Feed gate target must be an agent-only natural-gate drive: ${target.id}`,
  );
}
for (const target of feedHorizonTargets) {
  requireCondition(
    target.environmentId === 'authenticated'
      && target.artifactId === 'dev_extension'
      && target.supportedModes.length === 2
      && target.supportedModes[0] === 'human'
      && target.supportedModes[1] === 'agent'
      && target.browserRequirements.osFocus === 'never'
      && target.parameters.holdMs?.default === 10_000
      && target.browserObservation === 'document'
      && target.parameters.allowInitialWindowFocusOnce?.default === false
      && target.resourceClaims.includes('runtime:feed-horizon'),
    `Feed Horizon target must retain attach-only human/agent ownership and native document observation: ${target.id}`,
  );
}
for (const target of targets.filter((entry) => entry.protocolId === 'sentinel_runtime')) {
  requireCondition(
    target.environmentId === 'authenticated'
      && target.artifactId === 'dev_extension'
      && target.supportedModes.length === 2
      && target.supportedModes[0] === 'human'
      && target.supportedModes[1] === 'agent'
      && target.parameters.captureScreenshots?.default === false
      && target.parameters.allowInitialWindowFocusOnce?.default === false
      && target.resourceClaims.includes('runtime:sentinel-protocol')
      && ['site', 'global'].includes(target.protocolOptions.protocolScope),
    `Sentinel runtime target must retain attach-only human/agent ownership, explicit initial preparation, and opt-in screenshots: ${target.id}`,
  );
}
const dashboardCaptureTarget = targets.find((entry) => (
  entry.id === 'dashboard/capture'
));
requireCondition(
  targets.filter(target => target.browserRequirements?.hiddenAllowed === true)
    .every(target => ['headless_ok', 'headless_required'].includes(target.browserRequirements.rendering)
      && target.browserRequirements.authentication === 'none'
      && target.browserRequirements.defaultPresentation === 'hidden'
      && target.browserRequirements.osFocus === 'never'),
  'headless-capable automated targets must default to hidden without authentication substitution or native focus authority',
);
requireCondition(
  dashboardCaptureTarget?.family === 'dashboard'
    && dashboardCaptureTarget.protocolId === 'dashboard_capture'
    && dashboardCaptureTarget.environmentId === 'ephemeral'
    && dashboardCaptureTarget.artifactId === 'dev_extension'
    && dashboardCaptureTarget.supportedModes.length === 1
    && dashboardCaptureTarget.supportedModes[0] === 'agent'
    && dashboardCaptureTarget.browserRequirements.rendering === 'headless_ok'
    && dashboardCaptureTarget.browserRequirements.webgl === 'required'
    && dashboardCaptureTarget.browserRequirements.defaultPresentation === 'hidden'
    && dashboardCaptureTarget.browserRequirements.hiddenAllowed === true
    && dashboardCaptureTarget.browserRequirements.osFocus === 'never'
    && dashboardCaptureTarget.parameters.surface?.default === 'main'
    && dashboardCaptureTarget.parameters.surface?.values.includes('artifacts')
    && dashboardCaptureTarget.parameters.theme?.default === 'zen'
    && dashboardCaptureTarget.parameters.koiState?.default === 'full'
    && dashboardCaptureTarget.parameters.bonsaiState?.default === 'full'
    && dashboardCaptureTarget.parameters.appearanceTime?.default === '12:00'
    && dashboardCaptureTarget.parameters.weather?.default === 'clear'
    && dashboardCaptureTarget.resourceClaims.includes('runtime:dashboard-capture'),
  'Dashboard capture target must default to headless with required WebGL, isolated Main and Artifacts surfaces and the full Zen Main profile',
);
const dashboardBootTarget = targets.find((entry) => (
  entry.id === 'dashboard/boot'
));
requireCondition(
  dashboardBootTarget?.family === 'dashboard'
    && dashboardBootTarget.protocolId === 'dashboard_capture'
    && dashboardBootTarget.environmentId === 'ephemeral'
    && dashboardBootTarget.artifactId === 'dev_extension'
    && dashboardBootTarget.supportedModes.length === 1
    && dashboardBootTarget.supportedModes[0] === 'agent'
    && dashboardBootTarget.browserRequirements.rendering === 'headless_ok'
    && dashboardBootTarget.browserRequirements.webgl === 'required'
    && dashboardBootTarget.browserRequirements.defaultPresentation === 'hidden'
    && dashboardBootTarget.browserRequirements.hiddenAllowed === true
    && dashboardBootTarget.browserRequirements.osFocus === 'never'
    && dashboardBootTarget.parameters.theme?.default === 'zen'
    && dashboardBootTarget.parameters.samples?.default === 3
    && dashboardBootTarget.parameters.samples?.minimum === 1
    && dashboardBootTarget.parameters.samples?.maximum === 5
    && dashboardBootTarget.parameters.cpuProfile?.default === false
    && dashboardBootTarget.protocolOptions.operation === 'boot_probe'
    && dashboardBootTarget.protocolOptions.samplePolicy
      === 'one_cold_then_warm_same_owned_browser'
    && dashboardBootTarget.protocolOptions.artifactPreparationPolicy
      === 'prepare_built_artifact_in_fresh_owned_browser_before_measurement'
    && dashboardBootTarget.resourceClaims.includes('runtime:dashboard-capture'),
  'Dashboard boot target must prepare a newly built artifact in a disposable browser before measuring bounded cold/warm samples in one fresh owned browser',
);
const videoSkipControlSurfaceTargets = targets.filter((entry) => (
  entry.protocolId === 'video_skip_control_surface'
));
requireCondition(
  videoSkipControlSurfaceTargets.length === 7,
  'VideoSkip control-surface QA must publish seven named platform/surface targets',
);
for (const target of videoSkipControlSurfaceTargets) {
  requireCondition(
    target.family === 'video_skip'
      && target.environmentId === 'authenticated'
      && target.artifactId === 'dev_extension'
      && target.supportedModes.length === 1
      && target.supportedModes[0] === 'agent'
      && target.browserRequirements.osFocus === 'never'
      && target.browserRequirements.extensionRuntime === 'required'
      && target.browserRequirements.documentVisibility === 'visible_required'
      && target.browserRequirements.targetActivation === 'active'
      && target.parameters.policy?.default === 'hard_block'
      && JSON.stringify(target.parameters.policy.values) === JSON.stringify(['hard_block'])
      && target.parameters.allowInitialWindowFocusOnce?.default === false
      && target.protocolOptions.activationPolicy
        === 'dev_only_exact_tab_session_no_settings_or_site_rule_writes'
      && target.resourceClaims.includes('runtime:video-skip-control-surface'),
    `VideoSkip control-surface target must retain exact-tab dev ownership and canonical hard-block coverage: ${target.id}`,
  );
}

const qaFiles = (await fs.readdir(path.join(rootDir, 'scripts/qa'), {
  recursive: true,
  withFileTypes: true,
}))
  .filter((entry) => entry.isFile() && entry.name.endsWith('.mjs'))
  .map((entry) => path.join(entry.parentPath, entry.name));
for (const absolutePath of qaFiles) {
  const source = await fs.readFile(absolutePath, 'utf8');
  const relativePath = path.relative(rootDir, absolutePath).replaceAll('\\', '/');
  if (relativePath !== 'scripts/qa/entropyQa.mjs') {
    requireCondition(
      !source.includes('process.argv'),
      `only scripts/qa/entropyQa.mjs may read process.argv: ${relativePath}`,
    );
  }
}

const entropyQaCli = await read('scripts/qa/entropyQa.mjs');
const entropyQaCliHelp = await read('scripts/qa/cli/qaCliHelp.mjs');
const entropyQaCliOutput = await read('scripts/qa/cli/qaCliOutput.mjs');
const qaArtifactCommand = await read('scripts/qa/cli/qaArtifactCommand.mjs');
const extensionReloadProtocol = await read('scripts/qa/protocols/extensionReloadQaProtocol.mjs');
const goalEndsRealSiteTarget = getQaTarget('consumption/goal-ends');
requireCondition(
  goalEndsRealSiteTarget.protocolId === 'goal_ends_real_site'
    && goalEndsRealSiteTarget.lane === 'real_site'
    && goalEndsRealSiteTarget.environmentId === 'ephemeral'
    && goalEndsRealSiteTarget.artifactId === 'dev_extension'
    && goalEndsRealSiteTarget.browserObservation === null
    && sameStringArray(goalEndsRealSiteTarget.supportedModes, ['agent'])
    && goalEndsRealSiteTarget.browserRequirements.authentication === 'none'
    && goalEndsRealSiteTarget.browserRequirements.defaultPresentation === 'hidden'
    && goalEndsRealSiteTarget.browserRequirements.rendering === 'headless_required'
    && goalEndsRealSiteTarget.browserRequirements.hiddenAllowed === true
    && goalEndsRealSiteTarget.browserRequirements.osFocus === 'never'
    && sameStringArray(goalEndsRealSiteTarget.resourceClaims,
      ['runtime:gate-interstitial', 'runtime:feed-horizon', 'runtime:sentinel-protocol'])
    && sameStringArray(Object.keys(goalEndsRealSiteTarget.parameters).sort(),
      ['presentation', 'rebuild'])
    && !Object.hasOwn(goalEndsRealSiteTarget.protocolOptions, 'initialWindowPresentation'),
  'real-site goal ends must retain owned ephemeral headless defaults and exact intervention resources without OS focus grants or fixture/timing parameters',
);
const goalEndsFunctionalTarget = getQaTarget('intervention/goal-ends');
requireCondition(
  goalEndsFunctionalTarget.protocolId === 'goal_ends_functional'
    && goalEndsFunctionalTarget.lane === 'effect'
    && goalEndsFunctionalTarget.concurrency === 'isolated_functional'
    && goalEndsFunctionalTarget.environmentId === 'ephemeral'
    && goalEndsFunctionalTarget.artifactId === 'dev_extension'
    && goalEndsFunctionalTarget.browserObservation === null
    && sameStringArray(goalEndsFunctionalTarget.supportedModes, ['agent'])
    && goalEndsFunctionalTarget.browserRequirements.authentication === 'none'
    && goalEndsFunctionalTarget.browserRequirements.defaultPresentation === 'hidden'
    && goalEndsFunctionalTarget.browserRequirements.rendering === 'headless_required'
    && goalEndsFunctionalTarget.browserRequirements.hiddenAllowed === true
    && goalEndsFunctionalTarget.browserRequirements.osFocus === 'never'
    && sameStringArray(goalEndsFunctionalTarget.resourceClaims,
      ['runtime:gate-interstitial', 'runtime:feed-horizon', 'runtime:sentinel-protocol'])
    && sameStringArray(Object.keys(goalEndsFunctionalTarget.parameters).sort(), ['presentation', 'rebuild'])
    && !Object.hasOwn(goalEndsFunctionalTarget.protocolOptions, 'initialWindowPresentation'),
  'controlled goal delivery must remain a separately named dev-only owned ephemeral headless functional target without timing or focus options',
);
const goalEndsFunctionalProtocol = await read('scripts/qa/protocols/goalEndsFunctionalQaProtocol.mjs');
const goalEndsSharedProtocol = await read('scripts/qa/protocols/goalEndsRealSiteQaProtocol.mjs');
const goalDeliveryFixtureRoute = await read('src/apps/background/services/runtime/messageRoutes/goalDeliveryQaFixtureMessageRoutes.dev.js');
requireCondition(
  goalEndsFunctionalProtocol.includes('executeFunctionalQaProtocol as executeQaProtocol')
    && goalEndsSharedProtocol.includes('executeGoalEndsQa(options, false)')
    && goalEndsSharedProtocol.includes('executeGoalEndsQa(options, true)')
    && goalEndsSharedProtocol.includes("plan.target.id === 'intervention/goal-ends'")
    && goalEndsSharedProtocol.includes("plan.target.protocolId === 'goal_ends_functional'")
    && goalEndsSharedProtocol.includes("plan.environment?.lifecyclePolicy === 'per_run'")
    && goalEndsSharedProtocol.includes("artifact.releaseProfile === 'dev'")
    && goalEndsSharedProtocol.includes('naturalCollectionCertified: false')
    && goalDeliveryFixtureRoute.includes('requireCurrentHelperDocument')
    && goalDeliveryFixtureRoute.includes("cache: 'no-store'")
    && goalDeliveryFixtureRoute.includes('resolveProfileResetGeneration(lifecycle) !== payload.profileGeneration')
    && goalDeliveryFixtureRoute.includes('runStatsMutationBatch')
    && goalDeliveryFixtureRoute.includes('skipCacheLoad: true, requireDurableCommit: true'),
  'goal-delivery synthetic facts must have a separate sealed dev-only functional executor, live helper/generation proof and durable Stats FIFO admission without nested hydration',
);
const extensionReloadTarget = getQaTarget('qa/extension-reload');
const qaPackage = JSON.parse(await read('package.json'));
requireCondition(
  qaPackage.scripts['qa:open'] === 'node ./scripts/qa/entropyQa.mjs browser page authenticated --url=about:blank'
    && qaPackage.scripts['qa:reload'] === 'node ./scripts/qa/entropyQa.mjs run qa/extension-reload'
    && extensionReloadTarget.environmentId === 'authenticated'
    && extensionReloadTarget.protocolId === 'extension_reload'
    && extensionReloadTarget.artifactId === 'dev_extension'
    && extensionReloadProtocol.includes('defineEntropyQaAttachedArtifactStage(')
    && extensionReloadProtocol.includes('registerCleanup(')
    && extensionReloadProtocol.includes('if (!activation.runtimeRefresh)')
    && extensionReloadProtocol.includes('await harness.reloadExtensionFromSource()')
    && extensionReloadProtocol.includes('proveEntropyAttachedArtifactRuntimeReadiness(')
    && extensionReloadProtocol.includes('QA_EXTENSION_RELOAD_LIVE_BUILD_UNPROVEN')
    && !/CdpConnection|playwright|child_process|chrome\.storage|SET_SETTINGS|setSettings|stopServiceWorker|Extensions\.loadUnpacked/iu.test(extensionReloadProtocol),
  'manual QA open/reload must delegate to the declared persistent browser and artifact harness, prove the live build, and preserve settings/site tabs/process ownership',
);
const profileResetMaintenanceTarget = getQaTarget('maintenance/profile-reset');
const profileResetMaintenanceProtocol = await read('scripts/qa/protocols/profileResetMaintenanceQaProtocol.mjs');
const profileResetMaintenanceAdapter = await read('scripts/qa/protocols/attachOnlyActivePageAdapter.mjs');
requireCondition(
  profileResetMaintenanceTarget.environmentId === 'authenticated'
    && profileResetMaintenanceTarget.protocolId === 'profile_reset_maintenance'
    && profileResetMaintenanceTarget.artifactId === 'dev_extension'
    && JSON.stringify(profileResetMaintenanceTarget.supportedModes) === JSON.stringify(['agent'])
    && profileResetMaintenanceTarget.parameters.confirmEraseEntropyData?.default === false
    && profileResetMaintenanceTarget.parameters.confirmEraseEntropyData?.cliName === 'confirm-erase-entropy-data'
    && profileResetMaintenanceTarget.protocolOptions.scope === 'authorized_settings_contract_reset_and_runtime_readiness'
    && profileResetMaintenanceProtocol.includes('plan.parameters?.confirmEraseEntropyData !== true')
    && profileResetMaintenanceProtocol.includes('QA_PROFILE_RESET_MAINTENANCE_ALREADY_REQUESTED')
    && profileResetMaintenanceProtocol.includes('requireEntropyProfileResetMaintenanceEligibility(')
    && profileResetMaintenanceProtocol.includes('sendTrustedRuntimeMessage(harness, { action: MESSAGE_ACTIONS.RESET_APP_DATA })')
    && profileResetMaintenanceProtocol.includes('normalizeProfileMutationResponseHandoff(')
    && profileResetMaintenanceProtocol.includes('completeMv3ProfileMutationHandoff(')
    && profileResetMaintenanceProtocol.includes('proveEntropyAttachedArtifactRuntimeReadiness(context)')
    && profileResetMaintenanceProtocol.includes('registerCleanup(')
    && profileResetMaintenanceProtocol.includes('QA_PROFILE_RESET_MAINTENANCE_PREPARED')
    && !/CdpConnection|playwright|child_process|chrome\.storage|deleteDatabase|prepareDisposableExtensionReload|reloadExtensionFromSource|(?:passcode|authorization)\s*:|resetId:\s*handoff/iu.test(profileResetMaintenanceProtocol)
    && profileResetMaintenanceAdapter.includes('export async function requireEntropyProfileResetMaintenanceEligibility(')
    && profileResetMaintenanceAdapter.includes("targetId !== 'maintenance/profile-reset'")
    && profileResetMaintenanceAdapter.includes("recovery.key !== 'nudgeConfig'")
    && profileResetMaintenanceAdapter.includes('QA_PROFILE_RESET_MAINTENANCE_ELIGIBILITY_REJECTED')
    && !extensionReloadProtocol.includes('RESET_APP_DATA'),
  'explicit invalid-profile maintenance must preserve exact typed eligibility, canonical security/reset and Dashboard ACK, one-shot preparation, unchanged strict readiness and ordinary reload data preservation',
);
const humanSetupCatalog = await read('scripts/qa/catalog/qaHumanSetupCatalog.mjs');
const humanSetupCatalogTest = await read('tests/qaHumanSetupCatalog.test.js');
const humanSetupContractsTest = await read('tests/humanSetupQaContracts.test.js');
const qaArtifactLease = await read('scripts/qa/resources/QaArtifactLease.mjs');
const qaRecoveryInspector = await read(
  'scripts/qa/recovery/qaRecoveryInspector.mjs',
);
const qaRecoveryJournal = await read(
  'scripts/qa/recovery/QaRecoveryJournal.mjs',
);
const qaAtomicJson = await read('scripts/qa/evidence/qaAtomicJson.mjs');
const qaRecoveryRunner = await read(
  'scripts/qa/recovery/qaRecoveryRunner.mjs',
);
const qaRecoveryTest = await read('tests/entropyQaRecovery.test.js');
const qaEvidenceRetention = await read(
  'scripts/qa/evidence/qaEvidenceRetention.mjs',
);
const qaEvidenceRetentionTest = await read(
  'tests/entropyQaEvidenceRetention.test.js',
);
requireCondition(
  entropyQaCli.includes("command === 'artifact'")
    && entropyQaCli.includes('parseQaArtifactCommand(positionals, options)')
    && entropyQaCli.includes('executeQaArtifactCommand(parsed, { rootDir })')
    && qaArtifactCommand.includes("from '../../dev/devExtensionArtifactPublisher.mjs'")
    && qaArtifactCommand.includes('status: inspectDevExtensionRealUsePin')
    && qaArtifactCommand.includes('pin: pinDevExtensionForRealUse')
    && qaArtifactCommand.includes('release: releaseDevExtensionRealUsePin')
    && !/\b(?:from\s+|import\s*)['"](?:node:(?:fs|child_process)|[^'"]*(?:browser|playwright|cdp))[^'"]*['"]/iu.test(qaArtifactCommand),
  'artifact CLI must delegate pin/status/exact release to the canonical publisher without browser or filesystem ownership',
);
requireCondition(
  entropyQaCli.includes("'help'")
    && entropyQaCli.includes("'recovery'")
    && entropyQaCli.includes("'retention'")
    && entropyQaCli.includes('inspectQaArtifactRequirement(plan)')
    && entropyQaCli.includes('inspectQaRecoveryState({ rootDir })')
    && entropyQaCli.includes('recoverQaRun({')
    && entropyQaCliHelp.includes('Doctor never starts a')
    && entropyQaCliHelp.includes('recovery recover <run-id>')
    && entropyQaCliOutput.includes('printQaDoctorResult')
    && entropyQaCliOutput.includes('initialWindowBootstrap?.policy')
    && entropyQaCliOutput.includes('initial-window-required=')
    && entropyQaCliOutput.includes('printQaRecoveryInspection')
    && entropyQaCliOutput.includes('printQaRecoveryResult')
    && entropyQaCliOutput.includes('printQaRetentionInspection'),
  'public QA CLI must expose help, exact doctor cost inspection, recovery inspection, explicit durable recovery, and read-only retention planning',
);
requireCondition(
  humanSetupCatalog.includes("QA_HUMAN_SETUP_DEFAULT_SITE_ID = 'youtube'")
    && humanSetupCatalog.includes('parsed.origin !== site.allowedOrigin')
    && humanSetupCatalog.includes('QA_HUMAN_SETUP_URL_ORIGIN_MISMATCH')
    && humanSetupCatalog.includes('QA_HUMAN_SETUP_SITE_UNKNOWN')
    && humanSetupCatalog.includes('QA_HUMAN_SETUP_FEATURE_UNKNOWN')
    && humanSetupCatalogTest.includes(
      'canonicalizes only declared feature aliases at the input boundary',
    )
    && humanSetupCatalogTest.includes(
      'accepts URL overrides only on the selected preset exact origin',
    ),
  'human setup catalog must fail closed to declared aliases and exact selected-site origins',
);
requireCondition(
  entropyQaCli.includes("command === 'setup'")
    && entropyQaCli.includes('resolveQaHumanSetupInvocation(positionals)')
    && entropyQaCli.includes("['mode', 'site', 'presentation']")
    && entropyQaCli.includes("mode: 'human'")
    && entropyQaCli.includes("presentation: 'foreground'")
    && entropyQaCli.includes("event: 'QA_HUMAN_SETUP_REQUESTED'")
    && entropyQaCli.includes('operatorHandoffAuthorized: true')
    && (entropyQaCli.match(/operatorHandoffAuthorized:\s*true/gu) || []).length === 1
    && entropyQaCli.includes('QA_OPERATOR_HANDOFF_COMMAND_REQUIRED')
    && entropyQaCli.includes('if (input.target.operatorHandoffPolicy)')
    && entropyQaCliHelp.includes('setup [site] <feature>')
    && humanSetupContractsTest.includes(
      'normalizes setup shorthand and forbids direct run from acquiring focus',
    ),
  'only the setup command may grant one human target the bounded operator-handoff capability',
);
requireCondition(
  qaArtifactLease.includes('export async function inspectQaArtifactRequirement(plan)')
    && qaArtifactLease.includes('createDevExtensionInputFingerprint')
    && qaArtifactLease.includes("action: 'reuse_exact'")
    && qaArtifactLease.includes("action: 'build_on_run'")
    && qaArtifactLease.includes("action: 'rebuild_forced'")
    && qaArtifactLease.includes('QA_ARTIFACT_PUBLIC_BUILD_DIRTY')
    && qaArtifactLease.includes('QA_ARTIFACT_PUBLIC_SOURCE_COMMIT_MISMATCH'),
  'artifact owner must share the canonical dev fingerprint and project exact clean public provenance before mutation',
);
requireCondition(
  qaEvidenceRetention.includes('dryRun: true')
    && qaEvidenceRetention.includes('mutationAllowed: false')
    && !qaEvidenceRetention.includes('fs.rm(')
    && !qaEvidenceRetention.includes('fs.unlink(')
    && !qaEvidenceRetention.includes('fs.rename(')
    && qaEvidenceRetentionTest.includes('never mutates it'),
  'QA evidence retention must remain an observation-only dry-run owner',
);
const qaEvidencePruner = await read('scripts/qa/evidence/qaEvidencePruner.mjs');
requireCondition(
  qaEvidencePruner.includes('requireQaEvidenceRoot(rootDir)')
    && qaEvidencePruner.includes("['evidence:retention']")
    && qaEvidencePruner.includes('candidate.fingerprint')
    && qaEvidencePruner.includes('requireQaRetentionRunId(candidate.runId)')
    && qaEvidencePruner.includes('QA_EVIDENCE_RETENTION_TRASH_UNRESOLVED')
    && qaEvidencePruner.includes('fs.rm(removed, { recursive: true, force: false })')
    && qaEvidenceRetention.includes('QA_EVIDENCE_RETENTION_CHECKOUT_FORBIDDEN')
    && qaEvidenceRetention.includes('QA_EVIDENCE_RETENTION_PINNED')
    && qaEvidenceRetentionTest.includes('external directory intact'),
  'Explicit evidence pruning must use a bounded locked plain-run owner, revalidation and pin/checkout/link protection',
);
requireCondition(
  qaRecoveryInspector.includes('automaticMutationAllowed: false')
    && qaRecoveryInspector.includes("'inspect_exact_process_and_target_identity'")
    && qaRecoveryInspector.includes('![1, 2].includes(report.contractVersion)')
    && qaRecoveryInspector.includes('historicalTerminalRunCount')
    && qaRecoveryInspector.includes('RUN_ID_PATTERN')
    && qaRecoveryInspector.includes('invalidRunRootCount')
    && !qaRecoveryInspector.includes('Target.closeTarget')
    && !qaRecoveryInspector.includes('Browser.close')
    && !qaRecoveryInspector.includes('fs.rm(')
    && !qaRecoveryInspector.includes('fs.unlink(')
    && qaRecoveryTest.includes('refuses automatic mutation authority'),
  'recovery inspection must remain observation-only and must not inherit mutation authority',
);
requireCondition(
  qaRecoveryJournal.includes('writeQaJsonAtomic(filePath, value)')
    && qaRecoveryJournal.includes('await fs.chmod(filePath, 0o600)')
    && qaAtomicJson.includes('mode = 0o600')
    && qaAtomicJson.includes("flag: 'wx', mode")
    && qaRecoveryJournal.includes('readQaProcessStartToken')
    && qaRecoveryJournal.includes('processStartToken')
    && qaRecoveryJournal.includes('__entropyQaRecoveryTargetNonceV1')
    && qaRecoveryJournal.includes('expectedSessionToken')
    && qaRecoveryJournal.includes("snapshot.state = 'recovered'")
    && qaRecoveryRunner.includes('QA_RECOVERY_RUNNER_STILL_ACTIVE')
    && qaRecoveryRunner.includes('QA_RECOVERY_CURRENT_ENVIRONMENT_MISMATCH')
    && qaRecoveryRunner.includes('QA_RECOVERY_BROWSER_EPOCH_MISMATCH')
    && qaRecoveryRunner.includes('QA_RECOVERY_TARGET_NONCE_MISMATCH')
    && qaRecoveryRunner.includes('verifyEntropyQaDedicatedProfileOwnership')
    && qaRecoveryRunner.includes('verifyQaPersistentBrowserIdentity')
    && qaRecoveryRunner.includes('managed_persistent_process_preserved')
    && qaRecoveryRunner.includes('closeQaCdpTarget(cdp, ownedTarget.targetId)')
    && qaRecoveryRunner.includes('terminateLinuxQaChromiumByIdentity')
    && qaRecoveryRunner.includes('terminateWslWindowsQaChromiumByIdentity')
    && qaRecoveryRunner.includes('QA_RECOVERY_OWNED_PROCESS_START_TOKEN_REQUIRED')
    && !qaRecoveryRunner.includes("cdp.send('Browser.close'")
    && qaRecoveryTest.includes('closes only a browser-epoch and nonce proven target')
    && qaRecoveryTest.includes('refuses recovery while the exact runner is still active'),
  'explicit recovery must require a dead runner and exact journal, process, profile, browser-epoch, target-nonce, and lock identities',
);

const targetContract = await read('scripts/qa/contracts/qaTargetContract.mjs');
const browserObservationContract = await read('scripts/qa/contracts/qaBrowserObservationContract.mjs');
requireCondition(
  targetContract.includes('QA_TARGET_NON_DATA_VALUE_FORBIDDEN')
    && targetContract.includes("focus: 'operator_request_once'")
    && targetContract.includes("lifetime: 'until_explicit_cancel'")
    && targetContract.includes("cleanup: 'exact_owned_targets'")
    && targetContract.includes('QA_TARGET_OPERATOR_HANDOFF_POLICY_KEY_UNKNOWN')
    && targetContract.includes('QA_TARGET_OPERATOR_HANDOFF_HUMAN_MODE_REQUIRED')
    && humanSetupContractsTest.includes(
      'rejects malformed or agent-only operator handoff target policies',
    ),
  'target contract must reject non-data manifests and admit only the exact human operator-handoff policy',
);
const executionPlanContract = await read(
  'scripts/qa/contracts/qaExecutionPlanContract.mjs',
);
requireCondition(
  executionPlanContract.includes('operatorHandoffPolicy: target.operatorHandoffPolicy')
    && !executionPlanContract.includes('`browser:${')
    && !executionPlanContract.includes('`profile:${')
    && !executionPlanContract.includes('`extension-slot:${')
    && humanSetupContractsTest.includes(
      'projects operator handoff policy without widening browser OS focus',
    ),
  'execution plans must project exact operator handoff policy without widening browser, profile, extension-slot, or OS-focus authority',
);
const browserExecutionContract = await read(
  'scripts/browser-qa/contracts/browserExecutionContract.mjs',
);
const qaBrowserRequirementContract = await read(
  'scripts/qa/contracts/qaBrowserRequirementContract.mjs',
);
const qaBrowserChildExecutionContract = await read(
  'scripts/qa/contracts/qaBrowserChildExecutionContract.mjs',
);
requireCondition(
  browserExecutionContract.includes("VISIBLE_REQUIRED: 'visible_required'")
    && browserExecutionContract.includes("ACTIVE: 'active'")
    && browserExecutionContract.includes("NEVER: 'never'")
    && browserExecutionContract.includes("MANAGED_EXPLICIT: 'managed_explicit'")
    && browserExecutionContract.includes(
      "MANAGED_ENSURE_BEFORE_ATTACH: 'managed_ensure_before_attach'",
    )
    && browserExecutionContract.includes('createBrowserExecutionEnvironment')
    && browserExecutionContract.includes('readBrowserExecutionEnvironmentIfPresent')
    && browserExecutionContract.includes('assertBrowserExecutionContractMatches')
    && browserExecutionContract.includes("REQUIRED: 'required'")
    && browserExecutionContract.includes("'webglRequirement'")
    && !browserExecutionContract.includes('BROWSER_EXECUTION_ATTACH_OS_FOCUS_FORBIDDEN')
    && qaBrowserRequirementContract.includes('defineBrowserExecutionContract')
    && qaBrowserRequirementContract.includes(
      'BROWSER_START_POLICIES.MANAGED_ENSURE_BEFORE_ATTACH',
    )
    && qaBrowserRequirementContract.includes(
      'environment.focusPolicy !== BROWSER_OS_FOCUS.REQUEST_ONCE',
    )
    && !qaBrowserRequirementContract.includes('windowFocus'),
  'browser execution must compile presentation presets into orthogonal reusable leaves',
);
requireCondition(
  qaBrowserChildExecutionContract.includes('readBrowserExecutionEnvironmentIfPresent')
    && qaBrowserChildExecutionContract.includes('assertBrowserExecutionContractMatches')
    && qaBrowserChildExecutionContract.includes("processOwnership: 'owned'")
    && qaBrowserChildExecutionContract.includes("startPolicy: 'automatic'")
    && qaBrowserChildExecutionContract.includes(
      "'QA_BROWSER_CHILD_RENDERING_CONTRACT_MISMATCH:'",
    ),
  'browser-owning children must admit the serialized execution leaves as authority',
);

const browserExecutionChildConsumers = Object.freeze([
  'scripts/e2e/mv3DataLifecycleE2E.mjs',
  'scripts/e2e/mv3LifecycleE2E.mjs',
  'scripts/e2e/releaseLifecycleMatrix.mjs',
  'scripts/e2e/siteRuntimeE2E.mjs',
  'scripts/perf/measureCwsRuntime.mjs',
]);
for (const relativePath of browserExecutionChildConsumers) {
  const source = await read(relativePath);
  requireCondition(
    source.includes('admitQaExtensionBrowserChildExecution('),
    `browser-owning child does not consume the serialized execution contract: ${relativePath}`,
  );
}
const browserGpuCapability = await read(
  'scripts/browser-qa/browser/gpuCapability.mjs',
);
const zenPondResearchAgentRunner = await read(
  'scripts/dev/zen-pond-render-research/host/agentRunner.mjs',
);
const zenPondResearchReadme = await read(
  'scripts/dev/zen-pond-render-research/README.md',
);
const zenPondResearchTest = await read(
  'tests/themes/zenPondResearchHarness.test.js',
);
requireCondition(
  zenPondResearchAgentRunner.includes(
    'if (options.headed && !options.cdpEndpoint)',
  ),
  'external Zen pond CDP research must not bring an attached page to front',
);
requireCondition(
  zenPondResearchAgentRunner.includes("allowExternalCdpOsFocus: false")
    && zenPondResearchAgentRunner.includes("argument === '--allow-external-cdp-os-focus'")
    && zenPondResearchAgentRunner.includes(
      "fail('cdp_endpoint_requires_allow_external_cdp_os_focus')",
    )
    && zenPondResearchAgentRunner.includes("osFocus: 'request_once'")
    && zenPondResearchAgentRunner.includes('executionPlan: buildExternalCdpExecutionPlan')
    && zenPondResearchReadme.includes('focus preservation is not proven')
    && zenPondResearchTest.includes(
      'cdp_endpoint_requires_allow_external_cdp_os_focus',
    ),
  'external Zen pond CDP capture must block until bounded OS-focus capability is explicit',
);
requireCondition(
  browserGpuCapability.includes('activeRendererClass')
    && browserGpuCapability.includes('hardwareAvailability')
    && browserGpuCapability.includes("capability?.activeRendererClass !== 'hardware'"),
  'physical-GPU admission must distinguish available hardware from the active renderer',
);

const browserLease = await read('scripts/qa/resources/QaBrowserLease.mjs');
const browserLeaseTest = await read('tests/qaBrowserLease.test.js');
requireCondition(
  browserLease.includes("'attach_only'")
    && browserLease.includes("'preserve_process'")
    && browserLease.includes('acquireQaBrowserBroker')
    && browserLease.includes("'detached_only'")
    && !browserLease.includes('runQaManagedPersistentBrowserAction'),
  'browser lease must preserve the authenticated attach-only process and must never start it',
);
requireCondition(
  !browserLease.includes('Browser.close'),
  'browser lease must never close an attach-only browser',
);
requireCondition(
  browserExecutionContract.includes('requiresBrowserNoFocusBaselinePage')
    && browserLease.includes('const pageTargetInventoryRequired = noFocusBaselineRequired')
    && browserLease.includes('|| this.allowInitialWindowFocusOnce')
    && browserLease.includes('|| this.allowOperatorHandoffFirstPage')
    && entropyQaCli.includes(
      'const pageTargetInventoryRequired = noFocusExecutionBaselineRequired',
    )
    && entropyQaCli.includes('|| initialWindowFocusOnceAllowed')
    && entropyQaCli.includes('|| operatorHandoffFirstPageAllowed')
    && browserLease.includes('&& !this.allowInitialWindowFocusOnce')
    && browserLease.includes('&& !this.allowOperatorHandoffFirstPage ? 1 : 0')
    && browserLease.includes('QA_ATTACH_ONLY_NO_FOCUS_BASELINE_PAGE_REQUIRED')
    && browserLeaseTest.includes(
      'blocks no-focus active attachment before creating the browser first window',
    )
    && browserLeaseTest.includes(
      'inventories an empty background target for an authorized initial window anchor',
    )
    && browserLeaseTest.includes(
      'admits an empty managed browser only for an authorized operator handoff first page',
    ),
  'attach-only no-focus runs must inventory an empty browser only for a shared initial-window or exact operator-handoff first-page capability',
);
const browserInventory = await read('scripts/qa/environment/qaBrowserInventory.mjs');
requireCondition(
  browserLease.includes('verifyQaPersistentBrowserIdentity')
    && browserLease.includes('QA_BROWSER_IDENTITY_VERIFIED')
    && browserInventory.includes('verifyQaPersistentBrowserIdentity')
    && browserInventory.includes("'declared_identity_verified'"),
  'attach-only browser status and run admission must share exact declared identity verification',
);
requireCondition(
  browserLease.includes('allowsManagedExtensionSlotPendingStage')
    && browserLease.includes("executionPlan.startPolicy === 'managed_ensure_before_attach'")
    && browserLease.includes("executionPlan.extensionRuntime === 'required'")
    && browserLease.includes('allowManagedExtensionSlotBootstrap:')
    && browserLease.includes('extensionSlotAdmission: this.extensionSlotAdmission')
    && !browserLease.includes('acquireQaBrowserCapacity')
    && !browserLease.includes('borrowQaBrowserCapacity')
    && browserLeaseTest.includes(
      'admits an exact missing managed extension slot as pending stage without creating it',
    )
    && browserLeaseTest.includes(
      'keeps a missing external extension slot blocked even when a caller requests bootstrap',
    )
    && browserLeaseTest.includes(
      'keeps a noncanonical missing managed extension slot blocked',
    ),
  'browser admission may expose only the exact managed required-extension slot as pending stage and must not own mutating browser capacity',
);

const persistentBrowserLifecycle = await read(
  'scripts/browser-qa/lifecycle/persistentBrowserLifecycle.mjs',
);
const qaPersistentBrowserLifecycle = await read(
  'scripts/qa/browser/qaPersistentBrowserLifecycle.mjs',
);
const qaOperatorBrowserWindow = await read(
  'scripts/qa/browser/qaOperatorBrowserWindow.mjs',
);
const devPublisher = await read('scripts/dev/devExtensionArtifactPublisher.mjs');
const devArtifactLease = await read('scripts/qa/resources/QaArtifactLease.mjs');
requireCondition(
  devPublisher.includes('captureDevExtensionBuildInputs')
    && devPublisher.includes('buildRoot: inputs.rootDir')
    && devArtifactLease.includes('withDevExtensionPublicationLock')
    && devArtifactLease.includes('path: this.pinnedDir')
    && !devArtifactLease.includes('afterBuildInput'),
  'Dev QA must pin a complete canonical snapshot publication instead of consuming mutable dist or rechecking live source after build',
);
const qaOperatorBrowserWindowTest = await read(
  'tests/qaOperatorBrowserWindow.test.js',
);
const entropyQaDesktopShortcut = await read(
  'scripts/qa/desktop/entropyQaDesktopShortcut.mjs',
);
const windowsEntropyQaDesktopShortcut = await read(
  'scripts/qa/drivers/windowsEntropyQaDesktopShortcut.ps1',
);
const entropyQaDesktopShortcutTest = await read(
  'tests/entropyQaDesktopShortcut.test.js',
);
const operatorBrowserImports = [
  ...qaOperatorBrowserWindow.matchAll(/\bfrom\s+['"]([^'"]+)['"]/gu),
].map((match) => match[1]).sort();
const expectedOperatorBrowserImports = Object.freeze([
  '../../browser-qa/browser/chromiumProcessOwner.mjs',
  '../../browser-qa/browser/windowsPlatform.mjs',
  '../../browser-qa/browser/cdpTargetOwner.mjs',
  '../../browser-qa/cdp/CdpConnection.mjs',
  '../../browser-qa/lifecycle/browserResourceRegistry.mjs',
  '../../browser-qa/lifecycle/persistentBrowserLifecycle.mjs',
  '../../browser-qa/resources/BrowserBroker.mjs',
  '../../browser-qa/resources/BrowserCapacityLease.mjs',
  '../../browser-qa/resources/browserResourceScope.mjs',
  '../contracts/qaInitialWindowFocusPolicy.mjs',
  '../drivers/windowsChromeToolbarDriver.mjs',
  '../profile/entropyQaProfileMarker.mjs',
  './qaPersistentBrowserLifecycle.mjs',
].sort());
const boundedOperatorTargetFocusOwner = qaOperatorBrowserWindow.slice(
  qaOperatorBrowserWindow.indexOf(
    'async function focusQaManagedBrowserTarget({',
  ),
  qaOperatorBrowserWindow.indexOf(
    'async function runQaManagedBrowserOperatorAction({',
  ),
);
const qaEvidenceContract = await read(
  'scripts/qa/contracts/qaEvidenceContract.mjs',
);
const qaArtifactAdmissionContract = await read('scripts/qa/contracts/qaArtifactAdmissionContract.mjs');
requireCondition(
  classifyQaErrorStatus(new Error('QA_ARTIFACT_PUBLIC_BUILD_DIRTY')) === 'BLOCKED'
    && classifyQaErrorStatus(new Error('QA_ARTIFACT_INPUT_CHANGED_DURING_BUILD')) === 'FAIL'
    && classifyQaErrorStatus(new Error('OTHER:QA_ARTIFACT_PUBLIC_BUILD_DIRTY')) === 'FAIL'
    && qaArtifactAdmissionContract.includes("'QA_ARTIFACT_PUBLIC_BUILD_DIRTY'")
    && !qaArtifactAdmissionContract.includes("'QA_ARTIFACT_INPUT_CHANGED_DURING_BUILD'")
    && qaArtifactLease.includes('requiresCurrentCommitTreeAndLockfile: true')
    && qaArtifactLease.includes('manualBrowserReloadRequired: false'),
  'public prerequisites must stay BLOCKED with explicit repair steps while build execution failures remain FAIL',
);
const entropyQaContractsTest = await read('tests/entropyQaContracts.test.js');
const loopbackTcpProbe = await read(
  'scripts/browser-qa/network/loopbackTcpProbe.mjs',
);
const qaDoctor = await read('scripts/qa/environment/qaDoctor.mjs');
const entropyQaProfileMarker = await read(
  'scripts/qa/profile/entropyQaProfileMarker.mjs',
);
const browserQaLifecycleTest = await read('tests/browserQaLifecycle.test.js');
const extensionChromiumHarnessTest = await read(
  'tests/extensionChromiumHarness.test.js',
);
requireCondition(
  qaDoctor.includes("failures.push('no_focus_baseline_page_missing')")
    && qaDoctor.includes(
      'includeTargetCounts: includeCdpTargetCounts || minimumPageTargetCount > 0',
    ),
  'QA doctor must observe baseline page counts for no-focus attach admission',
);
requireCondition(
  qaDoctor.includes('allowManagedExtensionSlotBootstrap = false')
    && qaDoctor.includes("extensionSlot === 'missing'")
    && qaDoctor.includes("`${environment.profile}.entropy-extension-slot`")
    && qaDoctor.includes("extensionSlot: managedExtensionSlotPendingStage ? 'pending_stage'")
    && !qaDoctor.includes('fs.mkdir(')
    && !qaDoctor.includes('fs.cp(')
    && !qaDoctor.includes('fs.rename('),
  'managed extension-slot bootstrap admission must remain exact and observation-only',
);
requireCondition(
  persistentBrowserLifecycle.includes("'--no-startup-window'")
    && persistentBrowserLifecycle.includes("'--enable-automation'")
    && persistentBrowserLifecycle.includes("'--enable-unsafe-extension-debugging'")
    && !persistentBrowserLifecycle.includes("'--start-minimized'"),
  'managed persistent browser startup must create no native startup window and expose exact command-line identity evidence',
);
requireCondition(
  qaOperatorBrowserWindow.includes('runQaManagedPersistentBrowserAction')
    && qaOperatorBrowserWindow.includes("action: 'ensure'")
    && qaOperatorBrowserWindow.includes('acquireBrowserBroker')
    && qaOperatorBrowserWindow.includes('acquireBrowserCapacity')
    && qaOperatorBrowserWindow.includes('verifyQaPersistentBrowserIdentity')
    && qaOperatorBrowserWindow.includes('createQaCdpPageTarget')
    && qaOperatorBrowserWindow.includes('navigateQaCdpPageTarget')
    && qaOperatorBrowserWindow.includes('focusWindowsChromeWindow')
    && qaOperatorBrowserWindow.includes("policy: 'operator_request_once'")
    && qaOperatorBrowserWindow.includes("? 'page_created_and_focused'")
    && qaOperatorBrowserWindow.includes("? 'requested_url_navigation_requested'")
    && qaOperatorBrowserWindow.includes('QA_OPERATOR_BROWSER_FOREGROUND_PROCESS_MISMATCH')
    && qaOperatorBrowserWindow.includes('QA_OPERATOR_BROWSER_IDENTITY_PROCESS_REQUIRED')
    && qaOperatorBrowserWindow.includes('QA_OPERATOR_BROWSER_PRE_FOCUS_TARGET_REQUIRED')
    && qaOperatorBrowserWindow.includes('expectedProcessId: identityProcessId')
    && qaOperatorBrowserWindow.includes('requireTargetWindowReceipt(await readTargetWindow(cdp, focusTargetId))')
    && qaOperatorBrowserWindow.includes('QA_OPERATOR_BROWSER_PRE_FOCUS_TARGET_MISMATCH')
    && !qaOperatorBrowserWindow.includes('expectedWindowBounds: null')
    && qaOperatorBrowserWindow.includes('await focusQaManagedBrowserTargetForOperator({')
    && qaOperatorBrowserWindow.includes('background: pageUrl !== null')
    && qaOperatorBrowserWindow.includes('export function openQaManagedBrowserPage(')
    && qaOperatorBrowserWindow.includes('await closeTarget(cdp, createdTarget.targetId)')
    && qaOperatorBrowserWindowTest.includes(
      'creates, navigates, activates, focuses, and hands off one product-QA-protocol-free page',
    )
    && qaOperatorBrowserWindowTest.includes(
      'closes only the newly created page when navigation fails',
    )
    && entropyQaCli.includes("browserCommand === 'page'")
    && entropyQaCliHelp.includes('browser page <managed-environment>')
    && JSON.stringify(operatorBrowserImports)
      === JSON.stringify(expectedOperatorBrowserImports)
    && !qaOperatorBrowserWindow.includes('Page.navigate')
    && !qaOperatorBrowserWindow.includes('Target.activateTarget')
    && !qaOperatorBrowserWindow.includes('SetForegroundWindow'),
  'operator-visible managed Chrome must keep separate reuse and exact-page handoff paths behind identity, target ownership, cleanup, and bounded Windows focus',
);
requireCondition(
  boundedOperatorTargetFocusOwner.length > 0
    && qaOperatorBrowserWindow.includes("receipt.status !== 'target_window_verified'")
    && boundedOperatorTargetFocusOwner.includes("browser.processOwnership !== 'attach_only'")
    && boundedOperatorTargetFocusOwner.includes("browser.lifecyclePolicy !== 'managed'")
    && boundedOperatorTargetFocusOwner.includes(
      "browser.browserIdentity?.status !== 'declared_identity_verified'",
    )
    && boundedOperatorTargetFocusOwner.includes('expectedProcessId: identityProcessId')
    && boundedOperatorTargetFocusOwner.includes(
      'expectedWindowBounds: exactTargetWindow.windowBounds',
    )
    && boundedOperatorTargetFocusOwner.includes('targetWindowCorrelated: true')
    && !boundedOperatorTargetFocusOwner.includes('runQaManagedPersistentBrowserAction')
    && !boundedOperatorTargetFocusOwner.includes('acquireBrowserBroker')
    && !boundedOperatorTargetFocusOwner.includes('acquireBrowserCapacity')
    && !boundedOperatorTargetFocusOwner.includes('createQaCdpPageTarget')
    && !boundedOperatorTargetFocusOwner.includes('navigateQaCdpPageTarget')
    && qaOperatorBrowserWindowTest.includes(
      'focuses one exact verified target without acquiring browser lifecycle resources',
    )
    && qaOperatorBrowserWindowTest.includes(
      'rejects an unverified target-window handoff before requesting focus',
    ),
  'bounded operator handoff focus must consume an exact pre-verified target/window receipt without reacquiring lifecycle, broker, capacity, or target ownership',
);
requireCondition(
  entropyQaDesktopShortcut.includes('Entropy QA Chrome.lnk')
    && entropyQaDesktopShortcut.includes(
      'npm run qa -- browser page authenticated --url=about:blank',
    )
    && entropyQaDesktopShortcut.includes('runEntropyQaDesktopShortcutAction')
    && windowsEntropyQaDesktopShortcut.includes("[ValidateSet('install', 'validate')]")
    && windowsEntropyQaDesktopShortcut.includes('temporaryShortcut.Save()')
    && windowsEntropyQaDesktopShortcut.includes('Require-ExactShortcut $temporaryActual')
    && windowsEntropyQaDesktopShortcut.includes(
      'Move-Item -LiteralPath $temporaryPath -Destination $shortcutPath -Force',
    )
    && windowsEntropyQaDesktopShortcut.includes('Require-ExactShortcut $actual $expected')
    && entropyQaDesktopShortcutTest.includes(
      'defines the exact blank-page operator shortcut contract',
    )
    && entropyQaCli.includes("browserCommand === 'shortcut'")
    && entropyQaCliHelp.includes('browser shortcut <install|validate>')
    && !entropyQaDesktopShortcut.includes('sentinel/global/runtime')
    && !entropyQaDesktopShortcut.includes('furin'),
  'operator desktop shortcut must remain an exact staged blank-page product-protocol-free owner behind the public QA CLI',
);
requireCondition(
  persistentBrowserLifecycle.includes("'browser_identity_unverified'")
    && persistentBrowserLifecycle.includes('processLease.rollback()')
    && persistentBrowserLifecycle.includes('processLease.handoff({')
    && qaPersistentBrowserLifecycle.includes('expectedBrowserIdentity')
    && qaPersistentBrowserLifecycle.includes('attachPlaywrightBrowserOverCdp')
    && qaPersistentBrowserLifecycle.includes(
      'executionPlan: persistentIdentityProbeExecutionContract(profileSlot)',
    )
    && qaPersistentBrowserLifecycle.includes("startPolicy: profileSlot.lifecyclePolicy === 'managed'")
    && qaPersistentBrowserLifecycle.includes('launchManagedPersistentChromiumProcess'),
  'managed persistent readiness must prove declared identity, rollback pre-ready failures, and hand off only through shared owners',
);
const firstDedicatedProofIndex = persistentBrowserLifecycle.indexOf(
  'let dedicatedProfileOwnership = await admitDedicatedProfileOwnership',
);
const lifecycleLeaseIndex = persistentBrowserLifecycle.indexOf(
  'const lease = await acquireLease',
);
requireCondition(
  loopbackTcpProbe.includes('createConnection({ host, port })')
    && loopbackTcpProbe.includes('socket?.destroy?.()')
    && loopbackTcpProbe.includes('clearTimer(timer)')
    && !loopbackTcpProbe.includes('socket.write(')
    && !loopbackTcpProbe.includes('timer?.unref?.()')
    && persistentBrowserLifecycle.includes('probeBrowserQaLoopbackTcpEndpoint')
    && qaDoctor.includes('probeBrowserQaLoopbackTcpEndpoint')
    && browserQaLifecycleTest.includes(
      'keeps the bounded timeout live and destroys a blackholed probe socket',
    )
    && browserQaLifecycleTest.includes(
      'does not create an HTTP request when the loopback CDP port is absent',
    ),
  'persistent lifecycle and status must share a bounded no-byte loopback preflight without unref timeout exit or socket leakage',
);
requireCondition(
  persistentBrowserLifecycle.includes('verifyDedicatedProfileOwnership')
    && persistentBrowserLifecycle.includes(
      "profileOwnershipPolicy !== DEDICATED_PROFILE_OWNERSHIP_POLICY",
    )
    && firstDedicatedProofIndex >= 0
    && lifecycleLeaseIndex > firstDedicatedProofIndex
    && entropyQaProfileMarker.includes("schemaVersion: QA_PROFILE_MARKER_SCHEMA_VERSION")
    && entropyQaProfileMarker.includes('QA_PROFILE_LEGACY_MARKER_SCHEMA_VERSION')
    && entropyQaProfileMarker.includes('allowLocked: true')
    && entropyQaProfileMarker.includes('allowProvisioning: false')
    && qaPersistentBrowserLifecycle.includes(
      "from '../profile/entropyQaProfileMarker.mjs'",
    )
    && qaDoctor.includes("from '../profile/entropyQaProfileMarker.mjs'")
    && !persistentBrowserLifecycle.includes('entropyQaProfileMarker')
    && browserQaLifecycleTest.includes(
      'before lease, process inspection, or launch',
    )
    && extensionChromiumHarnessTest.includes(
      'accepts the strict schema-1 natural QA profile marker',
    )
    && extensionChromiumHarnessTest.includes(
      'rejects a symbolic-link marker file',
    ),
  'managed lifecycle must require adapter-proven dedicated profile ownership before leasing or launch while Entropy reuses its canonical strict marker validator',
);

const childProcessRuntime = await read('scripts/qa/runtime/qaChildProcess.mjs');
const childProcessRuntimeTest = await read('tests/entropyQaRuntime.test.js');
const windowsChildJob = await read('scripts/qa/runtime/qaWindowsChildJob.mjs');
const windowsChildNative = await read('scripts/qa/drivers/windowsQaChildJob.cs');
const windowsChildDriver = await read('scripts/qa/drivers/windowsQaChildJob.ps1');
const windowsChildTest = await read('tests/qaWindowsChildJob.test.js');
requireCondition(
  childProcessRuntime.includes('runWindowsQaChildJob(')
    && windowsChildJob.includes('reserveChildJob(')
    && windowsChildJob.indexOf('admitChildJob(') < windowsChildJob.indexOf("else socket.write('start\\n')")
    && windowsChildNative.includes('0x2000D')
    && windowsChildNative.includes('0x2000; // KILL_ON_JOB_CLOSE; no breakaway.')
    && windowsChildNative.includes('TerminateJobObject(job,130)')
    && !windowsChildNative.includes('AssignProcessToJobObject')
    && windowsChildDriver.includes('windows_job_active_process_zero')
    && windowsChildDriver.includes('ProtectCleanupFromConsoleInterrupts()')
    && windowsChildTest.includes('parent death closes only its job')
    && windowsChildTest.includes('preserving an unrelated process'),
  'Windows QA children must enter their Job atomically, journal identity before resume, and prove zero members without PID-tree kill authority',
);
const childTreeTermination = childProcessRuntime.slice(
  childProcessRuntime.indexOf('async function terminateQaChildTree('),
  childProcessRuntime.indexOf('export async function runQaChildProcess('),
);
requireCondition(
  childProcessRuntime.includes('async function listLinuxDescendantPids(')
    && childProcessRuntime.includes("if (process.platform !== 'linux') return [];")
    && childProcessRuntime.includes('async function signalQaChildTree(')
    && childProcessRuntime.includes('async function waitForQaChildTreeExit(')
    && childTreeTermination.includes("signalQaChildTree(child, trackedPids, 'SIGINT', {")
    && childTreeTermination.includes('includeDescendants: false')
    && childTreeTermination.includes("signalQaChildTree(child, trackedPids, 'SIGTERM', {")
    && childTreeTermination.includes("signalQaChildTree(child, trackedPids, 'SIGKILL', {")
    && (childTreeTermination.match(/includeDescendants: true/gu) || []).length === 2
    && childProcessRuntime.includes('QA_CHILD_PROCESS_TREE_CLEANUP_INCOMPLETE')
    && childProcessRuntime.includes('QA_RUN_ABORTED')
    && childProcessRuntimeTest.includes(
      'escalates abort cleanup through the spawned child process tree',
    )
    && childProcessRuntimeTest.includes('process.kill(grandchildPid, 0)'),
  'QA child processes must retain lineage-scoped bounded abort escalation, verified tree exit, and stable abort classification',
);

const runSession = await read('scripts/qa/runtime/QaRunSession.mjs');
const qaEvidenceWriter = await read('scripts/qa/evidence/QaEvidenceWriter.mjs');
requireCondition(
  qaAtomicJson.includes("platform === 'win32'")
    && qaAtomicJson.includes('Object.freeze([100, 500, 2_000])')
    && qaAtomicJson.includes("error?.code !== 'EPERM'")
    && qaAtomicJson.includes('await rename(temporaryPath, filePath)')
    && qaAtomicJson.includes('QA_ATOMIC_JSON_RENAME_RETRY')
    && qaAtomicJson.includes('QA_ATOMIC_JSON_CLEANUP_FAILED')
    && qaEvidenceWriter.includes('writeQaJsonAtomic')
    && qaRecoveryJournal.includes('writeQaJsonAtomic'),
  'QA JSON writers share bounded same-path Windows rename retries, preserve native failures and surface exact candidate cleanup failures',
);
const protocolResultOwner = runSession.slice(runSession.indexOf('function normalizeProtocolResult('),
  runSession.indexOf('function requireArtifactAdmissionClaims('));
requireCondition(
  protocolResultOwner.includes('QA_PROTOCOL_RESULT_REQUIRED')
    && protocolResultOwner.includes("Object.hasOwn(result, 'status')")
    && protocolResultOwner.includes('TERMINAL_STATUSES.has(status)')
    && !protocolResultOwner.includes('QA_RUN_STATUSES.PASS')
    && classifyQaErrorStatus(new AggregateError([new Error('QA_CDP_UNAVAILABLE'),
      new Error('BROKER_RELEASE_FAILED')], 'QA_BROWSER_BROKER_PREFLIGHT_ROLLBACK_FAILED:QA_CDP_UNAVAILABLE')) === 'FAIL'
    && classifyQaErrorStatus(new Error('OTHER:QA_CDP_UNAVAILABLE')) === 'FAIL'
    && classifyQaErrorStatus(new Error('QA_ATTACH_ONLY_NO_FOCUS_BASELINE_PAGE_REQUIRED')) === 'BLOCKED',
  'protocol verdicts require explicit terminal results and error details cannot hide rollback failures',
);
const qaResourceCoordinator = await read('scripts/qa/runtime/QaResourceCoordinator.mjs');
const qaResourceAcquire = qaResourceCoordinator.slice(
  qaResourceCoordinator.indexOf('async acquire(resourceKey)'),
  qaResourceCoordinator.indexOf('async releaseAll()'),
);
requireCondition(
  qaRecoveryJournal.includes('QA_RECOVERY_JOURNAL_WRITE_FAILED')
    && qaRecoveryJournal.includes('await writeOperation')
    && qaRecoveryJournal.includes("['acquired', 'released'].includes(entry.state)")
    && qaResourceAcquire.includes('this.leases.push(')
    && qaResourceAcquire.includes('recordResourceClaimAcquired(')
    && qaResourceAcquire.indexOf('this.leases.push(')
      < qaResourceAcquire.indexOf('recordResourceClaimAcquired(')
    && !qaResourceAcquire.includes('fs.unlink(lockPath)'),
  'journal write failures reject their callers without poisoning cleanup sequencing; exact fenced leases remain owned through acquire journaling and release retries',
);
const qaPlanContract = await read('scripts/qa/contracts/qaExecutionPlanContract.mjs');
const artifactAdmissionWaitTest = await read('tests/qaArtifactAdmissionWait.test.js');
requireCondition(
  qaPlanContract.includes('artifactAdmissionClaims')
    && qaPlanContract.includes('parameters.rebuildDuringRun !== true')
    && qaArtifactLease.includes("isolation: 'immutable_run_copy'")
    && runSession.includes('QA_ARTIFACT_ADMISSION_IMMUTABLE_PIN_REQUIRED')
    && runSession.includes('await coordinator.releaseClaims(artifactAdmissionClaims)')
    && runSession.indexOf('QA_ARTIFACT_ADMISSION_RELEASED') < runSession.indexOf('managedBrowserLifecycle = await ensureManagedPersistentBrowser')
    && qaResourceCoordinator.includes('QA_RESOURCE_RELEASE_NOT_OWNED')
    && qaResourceCoordinator.includes('this.leases = this.leases.filter((lease) => retained.has(lease))'),
  'private dev pins release admission claims before browser preparation while failed releases and runtime claims remain owned',
);
requireCondition(
  qaResourceCoordinator.includes('QA_ARTIFACT_ADMISSION_WAIT_TIMEOUT_MS = 180_000')
    && qaResourceCoordinator.includes("claim !== 'artifact:dev_extension' || !claims.includes(claim)")
    && qaResourceCoordinator.includes('artifactAdmissionClaims.includes(resourceKey)')
    && qaResourceCoordinator.includes('QA_ARTIFACT_ADMISSION_TIMEOUT')
    && qaResourceCoordinator.includes('await delay(')
    && qaResourceCoordinator.includes('throwIfAborted(signal)')
    && runSession.includes('onAdmissionWait: detail => evidence.event(')
    && runSession.includes('QA_ARTIFACT_ADMISSION_WAITING')
    && runSession.includes('QA_ARTIFACT_ADMISSION_WAIT_COMPLETE')
    && artifactAdmissionWaitTest.includes('admits two queued preparations automatically')
    && artifactAdmissionWaitTest.includes('runtime conflicts remain immediate')
    && artifactAdmissionWaitTest.includes('timeout reports BLOCKED while preserving a live foreign artifact owner')
    && artifactAdmissionWaitTest.includes('abort ends waiting promptly and preserves the live owner and its token'),
  'only declared immutable artifact admission may wait, with bounded abortable atomic acquisition and durable observations; runtime/profile/capacity conflicts cannot be bypassed or foreign locks stolen',
);
const explorationOwner = await read('scripts/qa/exploration/qaExplorationSession.mjs');
const explorationEnvironment = await read('scripts/qa/exploration/qaExplorationEnvironment.mjs');
const explorationGuide = await read('scripts/qa/cli/qaExplorationGuide.mjs');
const explorationRecovery = await read('scripts/qa/exploration/qaExplorationRecovery.mjs');
const explorationEvidence = await read('scripts/qa/exploration/qaExplorationEvidence.mjs');
requireCondition(
  explorationOwner.includes('acquireBrowserBroker') && explorationOwner.includes('acquireBrowserCapacity')
    && explorationOwner.includes('verifyQaPersistentBrowserIdentity')
    && explorationOwner.includes('verifyEntropyQaDedicatedProfileOwnership')
    && explorationOwner.includes('QA_EXPLORATION_SESSION_OWNER_UNVERIFIED')
    && explorationOwner.includes("status: 'exploration_closing'")
    && explorationOwner.includes('namedQaVerdict: null') && explorationOwner.includes('liveBuildProved: false')
    && explorationEnvironment.includes("distribution !== 'chrome_for_testing'")
    && explorationGuide.includes("comparison === 'regular-chrome'")
    && !/CdpConnection|playwright|child_process|Target\.createTarget|Target\.closeTarget|reloadExtensionFromSource/u.test(explorationOwner),
  'direct exploration retains canonical profile ownership without browser mutation or a named verdict; comparison pins are explicit',
);
requireCondition(
  explorationOwner.includes('readQaProcessStartToken')
    && explorationOwner.includes('resourceClaims:')
    && explorationRecovery.includes('inspectQaRunnerIdentity')
    && explorationRecovery.includes('QA_EXPLORATION_RUNNER_START_IDENTITY_REQUIRED')
    && explorationRecovery.includes('QA_EXPLORATION_RESOURCE_CLAIMS_UNVERIFIED')
    && explorationRecovery.includes('canonical_exclusive_acquisition')
    && explorationRecovery.includes('acquireBrowserBroker')
    && explorationRecovery.includes('acquireBrowserCapacity')
    && explorationRecovery.includes('sourceSessionDigest')
    && explorationRecovery.includes('publishQaExplorationJson')
    && explorationEvidence.includes('await fs.link(temporaryPath, filePath)')
    && explorationRecovery.includes("'recovery.json'")
    && explorationRecovery.includes("originalEvidenceAction: 'preserved'")
    && !/CdpConnection|playwright|child_process|process\.kill|Target\.createTarget|Target\.closeTarget|terminate.*Chromium/u.test(explorationRecovery),
  'exploration crash recovery proves original runner absence and exclusive exact resources while preserving original evidence and browser/process owners',
);
const devInputPublisher = await read('scripts/dev/devExtensionArtifactPublisher.mjs');
const publicationLockAcquire = devInputPublisher.slice(
  devInputPublisher.indexOf('async function acquirePublicationLock('),
  devInputPublisher.indexOf('export async function withDevExtensionPublicationLock('),
);
requireCondition(
  publicationLockAcquire.includes('const current = await readLockOwner()')
    && publicationLockAcquire.includes('current.raw === existing.raw')
    && publicationLockAcquire.includes('!isProcessAlive(current.record.pid)')
    && (publicationLockAcquire.match(/return await openLock\(\)/gu) || []).length === 2
    && !publicationLockAcquire.includes('fs.unlink(lockPath)'),
  'publication waiters retry exact exclusive acquisition and revalidate dead-owner snapshots without removing an observed owner lock',
);
const artifactBuildWrapper = await read('scripts/ci/run-vite-build-with-content-bootstrap-check.mjs');
requireCondition(
  EXTENSION_ARTIFACT_CHECK_PATHS.length === 10
    && new Set(EXTENSION_ARTIFACT_CHECK_PATHS).size === EXTENSION_ARTIFACT_CHECK_PATHS.length
    && devInputPublisher.includes('...EXTENSION_ARTIFACT_CHECK_PATHS')
    && artifactBuildWrapper.includes('for (const relativePath of EXTENSION_ARTIFACT_CHECK_PATHS)')
    && !devInputPublisher.includes("'scripts/ci',"),
  'artifact snapshot inputs and build verification share one ordered catalog without unrelated structural guard invalidation',
);
const operatorHandoffSessionTest = await read(
  'tests/qaOperatorHandoffSession.test.js',
);
const initialWindowFocusPolicy = await read(
  'scripts/qa/contracts/qaInitialWindowFocusPolicy.mjs',
);
const initialWindowFocusPolicyTest = await read(
  'tests/qaInitialWindowFocusPolicy.test.js',
);
const managedEnsureIndex = runSession.indexOf(
  'managedBrowserLifecycle = await ensureManagedPersistentBrowser',
);
const browserLeaseConstructionIndex = runSession.indexOf(
  'const browserLease = browserLeaseFactory',
);
const browserLeaseAcquireIndex = runSession.indexOf(
  'browser = await browserLease.acquire()',
);
const initialWindowAnchorAcquireIndex = runSession.indexOf(
  'initialWindowFocusAnchor = await anchorLease.acquire()',
);
const protocolExecuteIndex = runSession.indexOf(
  'protocol.execute(Object.freeze({',
);
requireCondition(
  runSession.includes("focus: 'operator_request_once'")
    && runSession.includes("lifetime: 'until_explicit_cancel'")
    && runSession.includes("cleanup: 'exact_owned_targets'")
    && runSession.includes("plan?.mode !== 'human'")
    && runSession.includes("plan.environment?.browserClass !== 'managed_persistent'")
    && runSession.includes("plan.environment.processOwnership !== 'attach_only'")
    && runSession.includes("plan.environment.focusPolicy !== 'never'")
    && runSession.includes("plan.browserExecution?.osFocus !== 'never'")
    && runSession.includes('allowOperatorHandoffFirstPage: operatorHandoffEnabled')
    && runSession.includes('QA_OPERATOR_HANDOFF_ALREADY_REQUESTED')
    && runSession.indexOf('operatorHandoffAttempted = true')
      < runSession.indexOf('const request = requireOperatorHandoffRequest(rawRequest)')
    && runSession.includes("target.state === 'admitted'")
    && runSession.includes('target.targetId === request.targetId')
    && runSession.includes('target.tabId === request.targetTabId')
    && runSession.includes('admittedTargets.length !== 1')
    && runSession.includes('QA_OPERATOR_HANDOFF_TARGET_NOT_OWNED')
    && runSession.includes('targetWindow: request.targetWindow')
    && runSession.includes("evidence.event('QA_OPERATOR_HANDOFF_READY'")
    && operatorHandoffSessionTest.includes(
      'provides one authorized exact-target foreground handoff while retaining osFocus never',
    )
    && operatorHandoffSessionTest.includes(
      'does not expose focus authority to an ordinary run even when the target declares policy',
    )
    && operatorHandoffSessionTest.includes(
      'consumes the one-time request even when exact journal ownership validation fails',
    ),
  'operator handoff must be a setup-authorized, once-consumed, exact journal-owned target capability over steady-state osFocus never',
);
requireCondition(
  runSession.includes('QA_PROTOCOL_CLEANUP_DUPLICATE')
    && runSession.includes('QA_CLEANUP_INCOMPLETE')
    && runSession.includes("registerCleanup('display_lease'")
    && runSession.includes('reportBrowserGpuCapability')
    && runSession.includes('BROWSER_START_POLICIES.MANAGED_ENSURE_BEFORE_ATTACH')
    && runSession.includes("action: 'ensure'")
    && runSession.includes("evidence.event('QA_MANAGED_BROWSER_ENSURED'")
    && managedEnsureIndex >= 0
    && browserLeaseConstructionIndex > managedEnsureIndex
    && childProcessRuntimeTest.includes(
      'ensures a managed persistent browser before the session attach lease',
    )
    && childProcessRuntimeTest.includes(
      'does not ensure an operator-owned external browser before attach',
    )
    && childProcessRuntimeTest.includes(
      'fails managed ensure contention before attach without retry or fallback',
    ),
  'QA run session must ensure only a compiled managed slot before attach, retain unique cleanup ownership, display lifetime, GPU evidence, and fail on incomplete cleanup',
);
requireCondition(
  initialWindowFocusPolicy.includes("plan.mode === 'agent'")
    && initialWindowFocusPolicy.includes(
      'plan.parameters?.allowInitialWindowFocusOnce === true',
    )
    && runSession.includes('allowsQaInitialWindowFocusOnce(plan)')
    && runSession.includes('initialWindowFocusAnchorLeaseFactory')
    && runSession.includes('attachedBrowserOsFocusGuardFactory')
    && runSession.includes("const sessionOsFocusGuardRequired = plan.mode === 'agent'")
    && runSession.includes("browser?.processOwnership === 'attach_only'")
    && runSession.includes("browser.osFocus === 'never'")
    && runSession.includes("'initial_window_focus_anchor'")
    && runSession.includes("'attached_browser_os_focus_guard'")
    && runSession.includes("'QA_INITIAL_WINDOW_FOCUS_ANCHOR_READY'")
    && runSession.includes("'after_protocol_targets_closed_before_anchor_release'")
    && runSession.includes('initialWindowFocusAnchor,')
    && entropyQaCli.includes('resolveQaInitialWindowFocusPolicy(plan)')
    && entropyQaCli.includes('initialWindowBootstrap: Object.freeze({')
    && entropyQaCli.includes('scope: initialWindowFocusScope')
    && entropyQaCli.includes("'new_managed_process_started_by_same_run_only'")
    && entropyQaCli.includes("'existing_process_attach_no_focus'")
    && browserLeaseAcquireIndex >= 0
    && initialWindowAnchorAcquireIndex > browserLeaseAcquireIndex
    && protocolExecuteIndex > initialWindowAnchorAcquireIndex
    && initialWindowFocusPolicyTest.includes(
      'keeps human runs and non-authorized agent runs on an existing-page baseline',
    )
    && childProcessRuntimeTest.includes(
      'owns one shared initial-window anchor only for this run',
    )
    && runSession.includes("managedBrowserLifecycle?.lifecycleAction === 'started'")
    && runSession.includes('QA_INITIAL_WINDOW_STARTED_PROCESS_IDENTITY_CHANGED')
    && runSession.indexOf('await protocolLoader(plan.protocolId)')
      < runSession.indexOf('await ensureManagedPersistentBrowser(plan,')
    && childProcessRuntimeTest.includes(
      "expect(cleanupOrder).toEqual(['display', 'final-focus', 'anchor', 'browser'])",
    )
    && childProcessRuntimeTest.includes(
      'keeps an already-foreground agent baseline BLOCKED without masking it during cleanup',
    ),
  'the upper QA session must exclusively own the agent-only initial-window anchor and verify focus after exact target cleanup',
);
const ownedInitialPresentationTest = await read('tests/qaOwnedInitialWindowPresentation.test.js');
const failureWindowAttributionTest = await read('tests/qaFailureWindowAttribution.test.js');
const integratedProtectionProtocol = await read('scripts/qa/protocols/integratedProtectionQaProtocol.mjs');
const ownedWindowObservation = qaOperatorBrowserWindow.slice(
  qaOperatorBrowserWindow.indexOf('export async function observeQaOwnedBrowserWindows('),
  qaOperatorBrowserWindow.indexOf('async function runQaManagedBrowserOperatorAction('),
);
const failureWindowObservation = integratedProtectionProtocol.slice(
  integratedProtectionProtocol.indexOf('export async function observeIntegratedFailureWindows('),
  integratedProtectionProtocol.indexOf('export async function executeQaProtocol('),
);
const failureCapture = integratedProtectionProtocol.slice(
  integratedProtectionProtocol.indexOf('async function captureFailure(error)'),
  integratedProtectionProtocol.indexOf('async function controlState('),
);
requireCondition(
  ownedWindowObservation.includes('await verifyOwnedIdentity(child, cdp)')
    && ownedWindowObservation.includes('window.windowId !== tab.windowId')
    && ownedWindowObservation.includes('await inspectForeground(')
    && ownedWindowObservation.includes('expectedProcessId: identity.proof.pid')
    && ownedWindowObservation.includes("scope: 'verified_process_main_window'")
    && ownedWindowObservation.includes('targetWindowCorrelated: false')
    && !ownedWindowObservation.includes('focusWindow')
    && !ownedWindowObservation.includes('expectedWindowBounds:')
    && failureWindowObservation.includes("target.state === 'admitted'")
    && failureWindowObservation.includes('target.browserEpoch === epoch')
    && failureWindowObservation.includes('QA_INTEGRATED_WINDOW_OBSERVATION_HELPER_REQUIRED')
    && failureWindowObservation.includes('chrome.tabs.query({ active: true, windowId }')
    && !/activateOwned|chrome\.(?:tabs|windows)\.(?:create|update)|focusQa/u.test(failureWindowObservation)
    && failureCapture.indexOf('await observeIntegratedFailureWindows(') >= 0
    && failureCapture.indexOf('await observeIntegratedFailureWindows(') < failureCapture.indexOf('await screenshot(')
    && failureWindowAttributionTest.includes('rejects another native process instead of attributing its foreground state')
    && failureWindowAttributionTest.includes('requires the existing admitted helper and never recreates one during failure capture')
    && failureWindowAttributionTest.includes('does not accept an active-tab query from another window'),
  'journey failure attribution must read exact owned target/tab/window identity before capture and keep process MainWindow foreground separate without focus or helper creation',
);
const ownedInitialPresentationTargets = targets.filter(
  target => target.protocolOptions.initialWindowPresentation === 'windows_agent_present_once',
);
requireCondition(
  JSON.stringify(ownedInitialPresentationTargets.map(target => target.id).sort())
      === JSON.stringify(['dashboard/sites-stored-reading-refresh', 'gate/entry-checkpoint/consumption', 'gate/entry-checkpoint/runtime',
        'journey/protection', 'settings/concurrency', 'settings/propagation'])
    && ownedInitialPresentationTargets.every(target => (
      target.parameters.allowInitialWindowFocusOnce?.default === false
      && target.browserRequirements.defaultPresentation === (target.browserRequirements.hiddenAllowed ? 'hidden' : 'foreground')
      && target.browserRequirements.osFocus === 'never'
      && target.environmentId === 'ephemeral'
    ))
    && initialWindowFocusPolicy.includes('allowsQaOwnedInitialWindowPresentation')
    && initialWindowFocusPolicy.includes("plan.environment?.processOwnership === 'owned'")
    && initialWindowFocusPolicy.includes("plan.environment.lifecyclePolicy === 'per_run'")
    && initialWindowFocusPolicy.includes("plan.browserExecution.presentation === 'foreground'")
    && runSession.includes('requestInitialOwnedWindowPresentation')
    && runSession.includes('QA_INITIAL_OWNED_WINDOW_ALREADY_REQUESTED')
    && runSession.indexOf('initialOwnedWindowPresentationAttempted = true')
      < runSession.indexOf('const request = requireInitialOwnedWindowRequest(rawRequest, journal)')
    && runSession.includes('initialTargets.length !== 1')
    && runSession.includes('Number.isSafeInteger(target.tabId) && target.tabId >= 0')
    && runSession.includes('scenarioTargets.filter(tabProved)')
    && runSession.includes("target.state === 'released' && target.proofKind === 'runtime_marker'")
    && runSession.includes("['closed', 'already_absent'].includes(target.releaseStatus)")
    && runSession.includes('scenarioTargets.some(entry => !tabProved(entry) && !closedNativePreparationSeed(entry))')
    && runSession.includes('target.browserEpoch !== journal.browser.browserEpoch')
    && runSession.includes('expectedOwnerTokenSha256: journal.ownedProcess.ownerTokenSha256')
    && runSession.includes('assertPreparationActive: assertInitialOwnedPreparationActive')
    && runSession.includes('await initialOwnedWindowPresentationPending?.catch(() => {})')
    && /\} catch \(error\) \{\r?\n    protocolExecutionOpen = false;/u.test(runSession)
    && qaOperatorBrowserWindow.includes('await verifyOwnedIdentity(child, cdp)')
    && qaOperatorBrowserWindow.includes('readOwnedProcessReceipt = readQaOwnedChromiumProcessReceipt')
    && qaOperatorBrowserWindow.includes('readTargetWindow = readQaCdpPageTargetWindow')
    && qaOperatorBrowserWindow.includes('expectedProcessId: identity.proof.pid')
    && qaOperatorBrowserWindow.includes('expectedWindowBounds: targetWindow.windowBounds')
    && qaOperatorBrowserWindow.includes("reason: 'non_windows_presentation_contract'")
    && ownedInitialPresentationTest.includes('fences cancellation after deferred identity and window reads before native focus')
    && ownedInitialPresentationTest.includes('rejects an unowned child or another run token before native focus')
    && ownedInitialPresentationTest.includes('drains an unawaited initial request before cleanup and fences the closed session without late READY')
    && ownedInitialPresentationTest.includes('closes preparation immediately on protocol failure while error evidence is still pending')
    && ownedInitialPresentationTest.includes('admits first tab-proved UI after the canonical released native startup seed and trusted helper')
    && ownedInitialPresentationTest.includes('Gate targets consume the same upper-session grant before input and cannot renew it')
    && ownedInitialPresentationTest.includes('Gate opt-out withholds the initial grant')
    && ownedInitialPresentationTest.includes('failed Gate preparation consumes the grant without a second focus attempt')
    && ownedInitialPresentationTest.includes('closed_prior_ui'),
  'owned foreground presentation must be one upper-session initial grant bound to a live owned process and first exact journaled target, with cancellation, privacy and cleanup proof',
);
const humanPermissionPresentationTargets = targets.filter(
  target => target.protocolOptions.initialWindowPresentation === 'windows_human_permission_present_once',
);
requireCondition(
  humanPermissionPresentationTargets.length === 1
    && humanPermissionPresentationTargets[0].id === 'settings/permissions'
    && humanPermissionPresentationTargets[0].protocolId === 'settings_permissions'
    && humanPermissionPresentationTargets[0].supportedModes.join(',') === 'human'
    && humanPermissionPresentationTargets[0].environmentId === 'ephemeral'
    && humanPermissionPresentationTargets[0].browserObservation === null
    && humanPermissionPresentationTargets[0].parameters.allowInitialWindowFocusOnce.default === false
    && humanPermissionPresentationTargets[0].browserRequirements.defaultPresentation === 'foreground'
    && humanPermissionPresentationTargets[0].browserRequirements.osFocus === 'never'
    && !humanPermissionPresentationTargets[0].operatorHandoffPolicy
    && initialWindowFocusPolicy.includes("plan.targetId === 'settings/permissions'")
    && initialWindowFocusPolicy.includes("plan.protocolId === 'settings_permissions'")
    && initialWindowFocusPolicy.includes("plan.environment?.id === 'ephemeral'")
    && initialWindowFocusPolicy.includes('requireQaOwnedInitialWindowPresentationPolicy')
    && runSession.includes('receipt.policy !== presentationPolicy')
    && runSession.includes('presentationPolicy: initialOwnedWindowPresentationPolicy')
    && qaOperatorBrowserWindow.includes('requireQaOwnedInitialWindowPresentationPolicy(presentationPolicy)'),
  'only the exact finite human native-permission target may reuse once-only owned initial presentation with a closed declared policy and matching receipt, without persistent operator handoff',
);
const settingsConcurrencyProtocol = await read('scripts/qa/protocols/settingsConcurrencyQaProtocol.mjs');
const settingsPropagationProtocol = await read('scripts/qa/protocols/settingsPropagationQaProtocol.mjs');
const settingsPropagationFixture = await read('src/apps/background/services/runtime/support/settingsPropagationQaFixture.dev.js');
const settingsPropagationFixturePublic = await read('src/apps/background/services/runtime/support/settingsPropagationQaFixture.public.js');
const settingsPropagationFixtureRoutes = await read('src/apps/background/services/runtime/messageRoutes/settingsPropagationQaFixtureMessageRoutes.dev.js');
const settingsPropagationFixtureContract = await read('src/domains/settings/config/settingsPropagationQaFixtureContract.dev.js');
const settingsPropagationComposition = await read('src/apps/background/services/runtime/backgroundKernelSettingsPropagationBindings.js');
const settingsQaControlPlane = await read('docs/operations/qa/entropy-qa-control-plane.md');
const settingsQaTargets = ['settings/concurrency', 'settings/propagation'].map(getQaTarget);
requireCondition(
  settingsQaTargets.every(target => target.environmentId === 'ephemeral'
    && target.artifactId === 'dev_extension' && target.supportedModes.join(',') === 'agent'
    && target.parameters.theme.values.join(',') === 'zen'
    && target.resourceClaims.includes('runtime:settings-command-validation'))
    && [settingsConcurrencyProtocol, settingsPropagationProtocol].every(source =>
      source.includes('new ExtensionChromiumHarness(')
      && source.includes('requireEntropyAttachedArtifactRuntimeIdentity')
      && source.includes('requestInitialOwnedWindowPresentation')
      && !/chrome\.storage\.(?:local|session)\.(?:set|remove|clear)|Target\.createTarget|Target\.closeTarget|spawn\(/u.test(source))
    && settingsConcurrencyProtocol.includes('RAPID_OVERLAP_NOT_PROVEN')
    && settingsConcurrencyProtocol.includes('draftAfterOtherSave')
    && settingsPropagationProtocol.includes('MINIMUM_HOLD_MS = 16_000')
    && settingsPropagationProtocol.includes('attemptCount === 4')
    && settingsPropagationProtocol.includes('actual_retry_control')
    && settingsPropagationProtocol.includes('buildSettingsPropagationTrustedPageSource'),
  'settings QA uses exact ephemeral dev ownership, actual conflicting UI intents and actual task delay/failure/retry without storage or browser lifecycle bypasses',
);
const settingsPermissionsProtocol = await read('scripts/qa/protocols/settingsPermissionsQaProtocol.mjs');
const settingsPermissionsTarget = getQaTarget('settings/permissions');
requireCondition(
  [integratedProtectionProtocol, settingsConcurrencyProtocol, settingsPermissionsProtocol]
    .every(source => source.includes('readIntegratedFirstUseUi')
      && source.includes('completeIntegratedFirstUseOffPolicy')
      && !source.includes('insights-consent-title'))
    && ['data-main-first-use-registration', 'data-first-use-recording', 'data-first-use-start', 'data-first-use-browse']
      .every(token => integratedProtectionProtocol.includes(token))
    && integratedProtectionProtocol.includes('ui.recordingChecked === false')
    && integratedProtectionProtocol.includes("insightsConsent === 'unset'")
    && integratedProtectionProtocol.includes('requireBootPrewarmDashboardSnapshot(reply.snapshot)')
    && integratedProtectionProtocol.includes('BOOT_PREWARM_SNAPSHOT_INVALIDATED')
    && integratedProtectionProtocol.includes('registerFirstSite: true')
    && integratedProtectionProtocol.includes('FIRST_SITE_NO_IMPLICIT_TIME_GOAL')
    && integratedProtectionProtocol.includes('verifyIntegratedLockedProtectionRevival')
    && integratedProtectionProtocol.includes('harness.reloadExtensionFromSource()')
    && integratedProtectionProtocol.includes('LOG_LOCK_PROTECTION_REQUIRED')
    && integratedProtectionProtocol.includes('LOG_LOCK_ENCRYPTED_LOG_PREFIX_CHANGED')
    && !/\.checked\s*=(?!=)|dispatchEvent\(|chrome\.storage\.(?:local|session)\.(?:set|remove|clear)/u.test(integratedProtectionProtocol),
  'first-use QA must use the existing Main form with unchecked recording, actual Start/Browse input and current policy reconciliation; optional log lock must preserve real protection across the exact reload and original encrypted data',
);
requireCondition(
  settingsPermissionsTarget.artifactId === 'dev_extension'
    && settingsPermissionsTarget.parameters.theme.values.join(',') === 'zen'
    && settingsPermissionsTarget.resourceClaims.includes('runtime:settings-command-validation')
    && settingsPermissionsTarget.protocolOptions.permissionPolicy === 'native_prompt_no_pregrant'
    && settingsPermissionsProtocol.includes('requiredPermissions: [], requiredHostPermissions: []')
    && settingsPermissionsProtocol.includes('SETTINGS_PERMISSIONS_NATIVE_RESPONSE_TIMEOUT_MS = 120_000')
    && settingsPermissionsProtocol.includes('MAXIMUM_DURATION_MS = 420_000')
    && settingsPermissionsProtocol.includes('requireEntropyAttachedArtifactRuntimeIdentity')
    && settingsPermissionsProtocol.includes('requestInitialOwnedWindowPresentation')
    && settingsPermissionsProtocol.includes('completeIntegratedFirstUseOffPolicy')
    && settingsPermissionsProtocol.includes('chrome.permissions.getAll()')
    && settingsPermissionsProtocol.includes('chrome.permissions.contains(')
    && settingsPermissionsProtocol.includes('driver.requireCanonicalUnchanged(response.settings)')
    && settingsPermissionsProtocol.includes("clickRepair: () => click(repairExpression())")
    && settingsPermissionsProtocol.includes('nativeClickObserved: false')
    && settingsPermissionsProtocol.includes('nativeInputAutomation: false')
    && settingsPermissionsProtocol.includes('state.receiverCapabilityVersion === CONTENT_RECEIVER_CAPABILITY_VERSION')
    && settingsPermissionsProtocol.includes('sample.documentId')
    && !/chrome\.permissions\.(?:request|remove)|Browser\.(?:grantPermissions|setPermission|resetPermissions)|chrome\.storage\.(?:local|session)\.(?:set|remove|clear)|Target\.createTarget|Target\.closeTarget|spawn\(/u.test(settingsPermissionsProtocol)
    && settingsQaControlPlane.includes('nativeClickObserved: false')
    && settingsQaControlPlane.includes('finite, human-assisted target'),
  'native permission QA must use the real product CTA without pregrants or permission setters, require actual read-only API and response states, preserve canonical settings and prove content admission within finite owned cleanup',
);
const capSaveObserver = settingsConcurrencyProtocol.slice(
  settingsConcurrencyProtocol.indexOf('export function installSettingsConcurrencyCapSaveObservation('),
  settingsConcurrencyProtocol.indexOf('export function requireSettingsConcurrencyComplete('),
);
requireCondition(
  capSaveObserver.includes('new view.MutationObserver(sample)')
    && capSaveObserver.includes('event.isTrusted !== true')
    && capSaveObserver.includes('findCap() === cap')
    && capSaveObserver.includes("cap?.querySelector('form.sites-cap-inline-editor')")
    && capSaveObserver.includes("cap.querySelector('form.sites-cap-inline-editor') === form && form.isConnected")
    && capSaveObserver.includes('form.id === formId && observedDocument.getElementById(formId) === form')
    && capSaveObserver.includes("form.querySelector('input[type=\"number\"]') === input")
    && capSaveObserver.includes('input.form === form')
    && capSaveObserver.includes("form.querySelector('button[type=\"submit\"]') === submit")
    && capSaveObserver.includes("cap.getAttribute('data-editing') !== 'true'")
    && capSaveObserver.includes("phase !== 'success'")
    && capSaveObserver.includes('input.value !== String(appliedMinutes)')
    && capSaveObserver.includes("fail('CAP_SAVE_TRUSTED_SUBMIT_REQUIRED')")
    && capSaveObserver.includes("fail('CAP_SAVE_ERROR')")
    && capSaveObserver.includes("fail('CAP_SAVE_NODE_REPLACED')")
    && capSaveObserver.includes("fail('CAP_SAVE_OBSERVATION_TIMEOUT')")
    && capSaveObserver.includes('30_000')
    && capSaveObserver.includes('observer.disconnect()')
    && capSaveObserver.includes('view.clearTimeout(timer)')
    && capSaveObserver.includes('delete view[key]')
    && capSaveObserver.includes('identity: Object.freeze(')
    && capSaveObserver.includes('currentCapPresent: Boolean(currentCap)')
    && capSaveObserver.includes('documentVisibility: observedDocument.visibilityState')
    && !/\.value\s*=|\.setAttribute\(|\.dispatchEvent\(/u.test(capSaveObserver)
    && settingsConcurrencyProtocol.includes("requireProof(disposed === true, 'CAP_SAVE_OBSERVER_CLEANUP_FAILED')")
    && settingsQaControlPlane.includes('idle alone never proves a save'),
  'concurrency cap save observes actual trusted success before idle, binds exact DOM nodes, rejects timeout/error/replacement and verifies readonly probe cleanup',
);
requireCondition(
  settingsPropagationComposition.includes("from '@settings-propagation-qa-fixture'")
    && settingsPropagationComposition.includes('broadcastSettingsUpdate: propagationComposition.broadcastSettingsUpdate')
    && settingsPropagationFixturePublic.includes('return { broadcastSettingsUpdate };')
    && !/import|settingsPropagationQaFixture:|QA_SETTINGS_/u.test(settingsPropagationFixturePublic)
    && settingsPropagationFixtureContract.includes('SETTINGS_PROPAGATION_QA_LEASE_TTL_MS = 45000')
    && settingsPropagationFixtureContract.includes("from '../../protection/protocol/features/featureCatalog.js'")
    && settingsPropagationFixtureContract.includes('isSettingsPropagationQaFilterTaskChangedKeys(lease.changedKeys)')
    && settingsPropagationFixtureContract.includes('new Set(keys).size !== keys.length')
    && settingsPropagationFixture.includes('isSettingsPropagationQaFilterTaskChangedKeys(keys)')
    && settingsPropagationFixture.includes('current.changedKeys = [...keys]')
    && !settingsPropagationFixture.includes('keys.length !== current.keys.length')
    && settingsPropagationFixture.includes('context.taskId')
    && settingsPropagationFixture.includes('context.commitVersion')
    && settingsPropagationFixture.includes("settle(current, 'expired'")
    && settingsPropagationFixture.includes('context.signal.addEventListener')
    && settingsPropagationFixtureRoutes.includes('sender.documentId')
    && settingsPropagationFixtureRoutes.includes('requireSourceSeal(source, payload)')
    && settingsPropagationFixtureRoutes.includes('assertTrustedQaAutomationHarnessSender')
    && !/chrome\.storage|localStorage|SET_SETTINGS|WAIT_SETTINGS_PROPAGATION/u.test(settingsPropagationFixture + settingsPropagationFixtureRoutes)
    && settingsQaControlPlane.includes('forty-five-second')
    && settingsQaControlPlane.includes('The complete task metadata is retained in the lease')
    && settingsQaControlPlane.includes('settingsPropagationQaFixture.public.js'),
  'development fault injection is a bounded copied-harness lease on the actual task broadcast port; public composition preserves the original port and no canonical receipt or storage owner changes',
);
requireCondition(
  qaPersistentBrowserLifecycle.includes(
    'BROWSER_QA_MANAGED_PROCESS_SLOT_INSPECTION_BLOCKED',
  )
    && qaPersistentBrowserLifecycle.includes('{ cause: error }')
    && classifyQaErrorStatus(new Error('BROWSER_QA_MANAGED_PROCESS_SLOT_INSPECTION_BLOCKED')) === 'BLOCKED'
    && qaEvidenceContract.includes('code: readNamedQaErrorCode(error.cause)')
    && runSession.includes('causeCode: errorDetail.cause?.code || null')
    && childProcessRuntimeTest.includes(
      'blocks a raw managed-slot inspection failure before attach and preserves safe evidence',
    ),
  'managed process-slot inspection failures must block before launch and retain only bounded named evidence',
);
requireCondition(
  persistentBrowserLifecycle.includes('boundedIdentityFailureCode(error)')
    && persistentBrowserLifecycle.includes("reason: 'identity_verifier_failed'")
    && persistentBrowserLifecycle.includes("'prelaunch_identity'")
    && persistentBrowserLifecycle.includes("'post_launch_identity'")
    && persistentBrowserLifecycle.includes(
      "error.code = 'BROWSER_QA_CDP_ENDPOINT_IDENTITY_UNVERIFIED'",
    )
    && qaEvidenceContract.includes('stage: readQaErrorStage(error)')
    && qaEvidenceContract.includes('stage: readQaErrorStage(error.cause)')
    && runSession.includes(
      'errorStage: errorDetail.stage || errorDetail.cause?.stage || null',
    )
    && browserQaLifecycleTest.includes(
      'projects identity verifier failures into bounded named evidence',
    ),
  'managed identity admission must retain a bounded cause code and pre/post-launch stage without copying sensitive verifier messages',
);
requireCondition(
  qaEvidenceContract.includes("'creation_token_quarantined'")
    && qaEvidenceContract.includes('QA_TARGET_OWNERSHIP_TOKEN_PATTERN')
    && classifyQaErrorStatus(new Error('QA_CDP_PAGE_TARGET_CREATION_RECOVERY_UNRESOLVED')) === 'BLOCKED'
    && qaEvidenceContract.includes('retiredSlotPreserved: true')
    && qaEvidenceContract.includes('errors: serializeQaAggregateErrors(error)')
    && entropyQaContractsTest.includes(
      'serializes bounded artifact and target recovery receipts without local paths',
    ),
  'QA evidence must classify target/artifact recovery as blocked and preserve only bounded recovery capabilities',
);

const browserBroker = await read('scripts/browser-qa/resources/BrowserBroker.mjs');
const browserCapacity = await read(
  'scripts/browser-qa/resources/BrowserCapacityLease.mjs',
);
const browserResourceScope = await read(
  'scripts/browser-qa/resources/browserResourceScope.mjs',
);
const browserCapacityTest = await read('tests/qaBrowserCapacityLease.test.js');
const displayLease = await read('scripts/browser-qa/resources/DisplayLease.mjs');
const gpuCapability = await read('scripts/browser-qa/browser/gpuCapability.mjs');
const chromiumGraphicsArguments = await read(
  'scripts/browser-qa/browser/chromiumGraphicsArguments.mjs',
);
const chromiumGpuInfoCollectionArguments = await read(
  'scripts/browser-qa/browser/chromiumGpuInfoCollectionArguments.mjs',
);
const dashboardGpuInfoCollectionProbe = await read(
  'scripts/qa/protocols/dashboardBootGpuInfoCollectionProbe.mjs',
);
const playwrightBrowserOwner = await read(
  'scripts/browser-qa/browser/playwrightBrowserOwner.mjs',
);
const displayLeaseTest = await read('tests/qaDisplayLease.test.js');
const playwrightBrowserOwnerTest = await read('tests/qaPlaywrightBrowserOwner.test.js');
const cdpTargetOwner = await read('scripts/browser-qa/browser/cdpTargetOwner.mjs');
const cdpTargetOwnerTest = await read('tests/qaCdpTargetOwner.test.js');
const attachedBrowserIdentity = await read(
  'scripts/browser-qa/browser/attachedBrowserIdentity.mjs',
);
const attachedBrowserIdentityTest = await read('tests/attachedBrowserIdentity.test.js');
const chromiumProcessOwner = await read(
  'scripts/browser-qa/browser/chromiumProcessOwner.mjs',
);
const linuxProcessIdentity = await read(
  'scripts/browser-qa/browser/linuxProcessIdentity.mjs',
);
const chromiumProcessOwnerTest = await read('tests/qaChromiumProcessOwner.test.js');
const linuxManagedProfileOccupancy = chromiumProcessOwner.slice(
  chromiumProcessOwner.indexOf('async function listLinuxQaChromiumProfileMatches'),
  chromiumProcessOwner.indexOf('async function listLinuxQaChromiumIdentityMatches'),
);
const windowsManagedProfileOccupancy = chromiumProcessOwner.slice(
  chromiumProcessOwner.indexOf('async function listWslWindowsQaChromiumProfileMatches'),
  chromiumProcessOwner.indexOf('export async function inspectWslWindowsQaChromiumIdentity'),
);
requireCondition(
  browserBroker.includes('server.listen(endpoint.port, endpoint.host)')
    && browserBroker.includes("state: 'idle'")
    && browserBroker.includes("state: 'leased'")
    && browserBroker.includes("'external_process_preserved'"),
  'browser broker must use process-held ownership, observation-only state, and preserve attach-only Chrome',
);
requireCondition(
  displayLease.includes('QA_DISPLAY_FOREGROUND_HOST_REQUIRED')
    && displayLease.includes('QA_DISPLAY_PHYSICAL_GPU_VIRTUAL_DISPLAY_FORBIDDEN')
    && displayLease.includes("kind: 'managed_xvfb'")
    && displayLease.includes('path.dirname(fileURLToPath(import.meta.url))')
    && displayLease.includes("'../runtime/managedXvfbChild.mjs'")
    && !displayLease.includes("path.resolve(rootDir, 'scripts/browser-qa/runtime"),
  'display lease must keep foreground on a host display and bound managed Xvfb ownership',
);
requireCondition(
  playwrightBrowserOwner.includes('management.rootDir || process.cwd()')
    && !playwrightBrowserOwner.includes("fileURLToPath(import.meta.url)")
    && displayLeaseTest.includes(
      'resolves the managed Xvfb helper from the neutral module location',
    )
    && playwrightBrowserOwnerTest.includes(
      'scopes default resource ownership to the caller working directory',
    ),
  'neutral browser owners must resolve package helpers from import.meta and caller scope from cwd',
);
requireCondition(
  gpuCapability.includes('projectQaBrowserGpuCapability')
    && gpuCapability.includes('QA_BROWSER_PHYSICAL_GPU_REQUIRED')
    && gpuCapability.includes('KNOWN_HARDWARE_VENDOR_IDS')
    && gpuCapability.includes('rendererEvidenceClass')
    && gpuCapability.includes('rendererEvidenceSource')
    && gpuCapability.includes('softwareRendererDetected'),
  'GPU capability must retain one fail-closed hardware/software projector',
);
requireCondition(
  chromiumGraphicsArguments.includes('managed_xvfb_swiftshader_webgl')
    && chromiumGraphicsArguments.includes("'--use-gl=angle'")
    && chromiumGraphicsArguments.includes("'--use-angle=swiftshader-webgl'")
    && chromiumGraphicsArguments.includes("'--enable-unsafe-swiftshader'")
    && chromiumGraphicsArguments.includes('BROWSER_WEBGL_REQUIREMENTS.REQUIRED')
    && playwrightBrowserOwner.includes('resolveQaChromiumGraphicsLaunch'),
  'WebGL launch policy must remain explicit and scoped to owned managed-Xvfb execution',
);
requireCondition(
  chromiumGpuInfoCollectionArguments.includes('projectBrowserExecutionContract')
    && chromiumGpuInfoCollectionArguments.includes('BROWSER_PROCESS_OWNERSHIP.OWNED')
    && chromiumGpuInfoCollectionArguments.includes('BROWSER_START_POLICIES.AUTOMATIC')
    && chromiumGpuInfoCollectionArguments.includes("platform !== 'win32'")
    && chromiumGpuInfoCollectionArguments.includes('BROWSER_WEBGL_REQUIREMENTS.REQUIRED')
    && chromiumGpuInfoCollectionArguments.includes("'--collect-dawn-info-eagerly'")
    && chromiumGpuInfoCollectionArguments.includes('QA_BROWSER_GPU_INFO_COLLECTION_ARGUMENT_CONFLICT')
    && chromiumGpuInfoCollectionArguments.includes('QA_BROWSER_GPU_INFO_COLLECTION_GPU_BACKEND_CONFLICT')
    && dashboardGpuInfoCollectionProbe.includes('QA_CHROMIUM_DAWN_EAGER_ARGUMENT')
    && dashboardGpuInfoCollectionProbe.includes('rawArgumentsRetained: false')
    && dashboardGpuInfoCollectionProbe.includes("status: 'not_recorded', histogram: null")
    && dashboardGpuInfoCollectionProbe.includes('QA_BOOT_GPU_INFO_COLLECTION_RESEARCH_SCENARIO_INVALID'),
  'GPU startup research must use one closed owned Windows launch policy and retain bounded positive evidence without raw argv or invented histogram defaults',
);
requireCondition(
  playwrightBrowserOwner.includes('acquireQaBrowserCapacity')
    && playwrightBrowserOwner.includes('QaDisplayLease')
    && playwrightBrowserOwner.includes('probeQaBrowserGpuCapability')
    && playwrightBrowserOwner.includes('external_browser_preserved')
    && playwrightBrowserOwner.includes('QA_PLAYWRIGHT_EXECUTION_CONTRACT_REQUIRED')
    && playwrightBrowserOwner.includes('QA_PLAYWRIGHT_AUDIO_CONTRACT_MISMATCH')
    && playwrightBrowserOwner.includes('QA_PLAYWRIGHT_RENDERING_CONTRACT_MISMATCH')
    && playwrightBrowserOwner.includes('QA_PLAYWRIGHT_PRESENTATION_CONTRACT_MISMATCH')
    && !playwrightBrowserOwner.includes('synthesizeLegacyAttachExecutionContract')
    && !playwrightBrowserOwner.includes('synthesizeLegacyLaunchExecutionContract')
    && cdpTargetOwner.includes("send('Target.createTarget'")
    && cdpTargetOwner.includes("'Target.closeTarget',")
    && chromiumProcessOwner.includes('spawnProcess(chromePath, launchArgs')
    && chromiumProcessOwner.includes("audioPolicy = 'muted'"),
  'browser launch, attach, display, GPU, process, and CDP target creation must stay behind named owners',
);
requireCondition(
  cdpTargetOwner.includes("recoverAmbiguousCreation = false")
    && cdpTargetOwner.includes("const ownershipToken = recoverAmbiguousCreation ? randomUUID()")
    && cdpTargetOwner.includes("'Target.setDiscoverTargets', { discover: true }")
    && cdpTargetOwner.includes('candidateTargetIds = new Set([')
    && cdpTargetOwner.includes('QA_CDP_PAGE_TARGET_CREATION_RECOVERY_UNRESOLVED')
    && cdpTargetOwner.includes('QA_CDP_PAGE_TARGET_OPTION_UNKNOWN')
    && cdpTargetOwner.includes("'Target.attachToTarget'")
    && cdpTargetOwner.includes("'Page.navigate'")
    && cdpTargetOwner.includes("'Target.activateTarget'")
    && cdpTargetOwner.includes('activateTarget = true')
    && cdpTargetOwner.includes('if (activateTarget) {')
    && cdpTargetOwner.includes("'Target.detachFromTarget'")
    && cdpTargetOwner.includes('enableQaCdpNoFocusPageExecution')
    && cdpTargetOwner.includes("'Emulation.setFocusEmulationEnabled'")
    && cdpTargetOwner.includes("'Page.setWebLifecycleState'")
    && cdpTargetOwner.includes("'no_focus_execution_confirmed'")
    && cdpTargetOwner.includes('QA_CDP_PAGE_TARGET_NAVIGATION_REJECTED')
    && cdpTargetOwner.includes('requireOwnedPageTargetNavigationReceipt')
    && cdpTargetOwner.includes('QA_CDP_PAGE_TARGET_NAVIGATION_IDENTITY_MISMATCH')
    && cdpTargetOwner.includes('DEFAULT_TARGET_NAVIGATION_DETACH_TIMEOUT_MS')
    && cdpTargetOwner.includes("'Browser.getWindowForTarget'")
    && cdpTargetOwner.includes('QA_CDP_PAGE_TARGET_WINDOW_RECEIPT_INVALID')
    && cdpTargetOwnerTest.includes(
      'closes only the exact token target observed after an ambiguous create timeout',
    )
    && cdpTargetOwnerTest.includes(
      'quarantines unresolved token ownership instead of claiming absence',
    )
    && cdpTargetOwnerTest.includes(
      'never closes a mismatching response target and recovers only the exact nonce page',
    )
    && cdpTargetOwnerTest.includes(
      'shrinks discovery, create, and identity commands against one absolute deadline',
    )
    && cdpTargetOwnerTest.includes(
      'rejects caller-supplied ownership capability options before CDP mutation',
    )
    && cdpTargetOwnerTest.includes(
      'navigates and activates one exact owned page target before detaching',
    )
    && cdpTargetOwnerTest.includes(
      'navigates one exact owned background page without activating its window',
    )
    && cdpTargetOwnerTest.includes(
      'enables visible page execution on one owned background target without OS focus',
    )
    && cdpTargetOwnerTest.includes(
      'detaches and fails loudly when exact page navigation is rejected',
    )
    && cdpTargetOwnerTest.includes(
      'rejects a bare or mismatching target before CDP navigation mutation',
    )
    && cdpTargetOwnerTest.includes(
      'still attempts bounded detachment after the navigation deadline is consumed',
    ),
  'CDP page creation and navigation must retain exact target ownership, bounded attachment, activation, detachment, and ambiguous-create quarantine',
);
const exactTargetWindowReadOwner = cdpTargetOwner.slice(
  cdpTargetOwner.indexOf('export async function readQaCdpPageTargetWindow('),
  cdpTargetOwner.indexOf('function requireOwnedPageTargetNavigationReceipt('),
);
requireCondition(
  exactTargetWindowReadOwner.length > 0
    && exactTargetWindowReadOwner.includes("'Target.getTargetInfo'")
    && exactTargetWindowReadOwner.includes('targetInfo?.targetInfo?.targetId !== exactTargetId')
    && exactTargetWindowReadOwner.includes("targetInfo.targetInfo.type !== 'page'")
    && exactTargetWindowReadOwner.includes('QA_CDP_PAGE_TARGET_WINDOW_IDENTITY_MISMATCH')
    && exactTargetWindowReadOwner.includes("'Browser.getWindowForTarget'")
    && exactTargetWindowReadOwner.indexOf("'Target.getTargetInfo'")
      < exactTargetWindowReadOwner.indexOf("'Browser.getWindowForTarget'")
    && !exactTargetWindowReadOwner.includes("'Target.getTargets'")
    && !exactTargetWindowReadOwner.includes("'Target.activateTarget'")
    && cdpTargetOwnerTest.includes(
      'reads one exact page target window without enumerating or activating targets',
    )
    && cdpTargetOwnerTest.includes(
      'rejects a non-page or mismatching exact target before reading window state',
    ),
  'operator target-window correlation must read one exact page target before window lookup without enumeration or activation',
);
requireCondition(
  linuxManagedProfileOccupancy.includes("readChromiumSwitchValues(args, 'user-data-dir')")
    && !linuxManagedProfileOccupancy.includes('profileDirectory')
    && !linuxManagedProfileOccupancy.includes('remote-debugging-port')
    && windowsManagedProfileOccupancy.includes(
      'Get-BrowserQaManagedProfileOccupant',
    )
    && windowsManagedProfileOccupancy.includes('$profilePattern')
    && !windowsManagedProfileOccupancy.includes('$expectedExecutable')
    && !windowsManagedProfileOccupancy.includes('$debugPortPattern')
    && !windowsManagedProfileOccupancy.includes('$profileDirectoryPattern')
    && chromiumProcessOwner.includes("conflictKind: 'cdp_port_in_use'")
    && chromiumProcessOwner.includes("'managed_user_data_dir_in_use'")
    && chromiumProcessOwner.includes('const ownedProcessPredicate = [')
    && chromiumProcessOwner.includes('const profileOccupancyPredicate = [')
    && chromiumProcessOwner.includes('windowsProcessQueryFailureDetail(error)')
    && chromiumProcessOwnerTest.includes(
      'across profile and port changes',
    )
    && chromiumProcessOwnerTest.includes(
      'blocks a reachable CDP port even when the managed user-data root is absent',
    )
    && chromiumProcessOwnerTest.includes(
      'composes Windows exact identity predicates without semicolon-split operators',
    )
    && chromiumProcessOwnerTest.includes(
      'keeps Windows query diagnostics bounded and redacts the private owner token',
    ),
  'managed prelaunch occupancy must independently reserve the entire user-data root and CDP port without broadening exact termination authority',
);
requireCondition(
  browserResourceScope.includes('resolveBrowserQaPhysicalResourceIdentities')
    && browserResourceScope.includes("resourceType: 'cdp_origin'")
    && browserResourceScope.includes("resourceType: 'user_data_dir'")
    && !browserResourceScope.includes("resourceType: 'profile_slot'")
    && browserResourceScope.includes('Chromium singleton ownership')
    && browserCapacity.includes('browserResourceIdentities')
    && browserCapacity.includes('releaseCapacityLeasesReverse')
    && browserCapacity.includes('capacityLeaseRecords = new WeakMap()')
    && browserCapacity.includes('QA_BROWSER_CAPACITY_BORROWERS_ACTIVE')
    && browserCapacity.includes('borrowQaBrowserCapacity')
    && playwrightBrowserOwner.includes('resolveAttachCapacityIdentities(')
    && browserCapacityTest.includes(
      'canonicalizes Windows user-data roots independently of profile directory',
    )
    && browserCapacityTest.includes(
      'serializes endpoint and user-data root as independent host-global resources',
    ),
  'attach capacity must serialize CDP origin and canonical user-data root as independent host-global resources without profile-directory partitioning',
);
requireCondition(
  chromiumProcessOwner.includes('verifyQaOwnedChromiumEndpointIdentity')
    && chromiumProcessOwner.includes("cdp.send('Browser.getBrowserCommandLine')")
    && chromiumProcessOwner.includes('actualOwnerToken !== record.ownerToken')
    && chromiumProcessOwner.includes('pid: record.receipt.pid')
    && chromiumProcessOwner.includes('processStartToken')
    && linuxProcessIdentity.includes('inspectLinuxSpawnedProcessIdentity')
    && linuxProcessIdentity.includes('commandLineCarriesExactArgument')
    && linuxProcessIdentity.includes(
      "method: 'linux_procfs_spawn_pid_start_token_executable_capability'",
    )
    && chromiumProcessOwner.includes('requiresWindowsCimProof')
    && chromiumProcessOwner.includes(
      "osProcessIdentity.method !== 'windows_cim_exact_arguments'",
    )
    && chromiumProcessOwner.includes("status: 'owned_endpoint_identity_verified'")
    && chromiumProcessOwnerTest.includes(
      'admits an owned CDP endpoint only with the private spawn token and exact tuple',
    )
    && chromiumProcessOwnerTest.includes(
      'rejects a different CDP browser before OS admission',
    )
    && chromiumProcessOwnerTest.includes(
      'admits a WSL Windows executable basename only after exact CIM proof',
    )
    && chromiumProcessOwnerTest.includes(
      'rejects a mismatched WSL Windows executable basename before CIM proof',
    )
    && chromiumProcessOwnerTest.includes(
      'after Chromium rewrites argv as one process title',
    )
    && chromiumProcessOwnerTest.includes(
      'treats PID reuse as owned-process absence',
    ),
  'owned CDP admission must bind Linux to the spawned PID/start-token capability and require exact Windows CIM proof for basename-only executable evidence',
);
requireCondition(
  attachedBrowserIdentity.includes('verifyExecutableCommandLineEvidence')
    && attachedBrowserIdentity.includes("return 'basename_only_os_proof_required'")
    && attachedBrowserIdentity.includes('projectExactOsProcessIdentity(')
    && attachedBrowserIdentity.includes(
      '`browser_command_line_tuple+${osProcessIdentity.method}`',
    )
    && attachedBrowserIdentityTest.includes(
      'combines a matching Windows basename with exact command-line tuple and OS proof',
    )
    && attachedBrowserIdentityTest.includes(
      'treats a basename mismatch as terminal and never consults OS proof',
    )
    && attachedBrowserIdentityTest.includes(
      'keeps the command-line tuple authoritative when basename needs OS proof',
    ),
  'basename-only executable evidence must retain authoritative command-line tuple checks and require exact OS process proof',
);
const managedPersistentHandoffOwner = chromiumProcessOwner.slice(
  chromiumProcessOwner.indexOf('async handoff({ browserIdentity } = {})'),
  chromiumProcessOwner.indexOf('\n  });\n}\n\nexport {', chromiumProcessOwner.indexOf(
    'async handoff({ browserIdentity } = {})',
  )),
);
const chromiumStartupStderr = await read('scripts/browser-qa/browser/chromiumStartupStderr.mjs');
requireCondition(
  chromiumProcessOwner.includes('captureChromiumStartupStderr(child.stderr')
    && managedPersistentHandoffOwner.includes('startupStderr.stop()')
    && chromiumStartupStderr.includes('CHROMIUM_STARTUP_STDERR_MAX_BYTES')
    && chromiumStartupStderr.includes('stream?.unref?.()')
    && persistentBrowserLifecycle.includes('processLease.readStartupDiagnostics()')
    && qaPersistentBrowserLifecycle.includes('persistQaBrowserStartupFailure(error, { rootDir })')
    && runSession.includes('startupEvidence: errorDetail.startupEvidence'),
  'startup evidence must stay with canonical process/lifecycle/evidence owners and cannot pin a handed-off browser launcher',
);
requireCondition(
  managedPersistentHandoffOwner.includes('await inspectExactProcess({')
    && (managedPersistentHandoffOwner.match(/assertHealthy\(\);/gu) || []).length >= 2
    && chromiumProcessOwnerTest.includes(
      'rejects a WSL $exitKind exit racing exact native handoff proof',
    ),
  'managed WSL handoff must reject a nonzero or signaled interop exit racing exact native proof',
);
requireCondition(
  playwrightBrowserOwner.includes('borrowQaBrowserCapacity(owner.capacityLease')
    && qaPersistentBrowserLifecycle.includes('capacityLease: lifecycleCapacity'),
  'nested lifecycle identity attach must borrow an authentic held capacity without releasing its parent locks',
);

const browserRuntimeFiles = (await fs.readdir(path.join(rootDir, 'scripts'), {
  recursive: true,
  withFileTypes: true,
}))
  .filter((entry) => entry.isFile() && /\.(?:mjs|cjs|js)$/u.test(entry.name))
  .map((entry) => path.join(entry.parentPath, entry.name))
  .filter((absolutePath) => !path.relative(rootDir, absolutePath).replaceAll('\\', '/').startsWith('scripts/ci/'));
const rawPlaywrightOwners = [];
const rawCdpTargetOwners = [];
const rawChromiumProcessOwners = [];
const rawCdpWebSocketOwners = [];
const managedAttachedExtensionSlotConsumers = [];
for (const absolutePath of browserRuntimeFiles) {
  const relativePath = path.relative(rootDir, absolutePath).replaceAll('\\', '/');
  const source = await fs.readFile(absolutePath, 'utf8');
  if (
    relativePath !== 'scripts/browser-qa/browser/playwrightBrowserOwner.mjs'
    && relativePath !== 'scripts/generate-icons.mjs'
    && /\b(?:chromium|firefox|webkit)\.(?:launch|launchPersistentContext|connectOverCDP)\s*\(/u
      .test(source)
  ) {
    rawPlaywrightOwners.push(relativePath);
  }
  if (
    relativePath !== 'scripts/browser-qa/browser/cdpTargetOwner.mjs'
    && /Target\.(?:createTarget|closeTarget)/u.test(source)
  ) {
    rawCdpTargetOwners.push(relativePath);
  }
  if (
    relativePath !== 'scripts/browser-qa/browser/chromiumProcessOwner.mjs'
    && /\bspawn\(\s*chromePath\s*,/u.test(source)
  ) {
    rawChromiumProcessOwners.push(relativePath);
  }
  if (
    relativePath !== 'scripts/browser-qa/cdp/CdpConnection.mjs'
    && /new\s+this\.WebSocketImpl\s*\(/u.test(source)
  ) {
    rawCdpWebSocketOwners.push(relativePath);
  }
  if (source.includes('internal/managedAttachedExtensionSlot.mjs')) {
    managedAttachedExtensionSlotConsumers.push(relativePath);
  }
}
requireCondition(
  rawPlaywrightOwners.length === 0,
  `raw Playwright browser owners bypass qaPlaywrightBrowserOwner: ${rawPlaywrightOwners.join(',')}`,
);
requireCondition(
  rawCdpTargetOwners.length === 0,
  `raw CDP target owners bypass qaCdpTargetOwner: ${rawCdpTargetOwners.join(',')}`,
);
requireCondition(
  rawChromiumProcessOwners.length === 0,
  `raw Chromium process owners bypass qaChromiumProcessOwner: ${rawChromiumProcessOwners.join(',')}`,
);
requireCondition(
  rawCdpWebSocketOwners.length === 0,
  `raw CDP WebSocket owners bypass browser-qa CdpConnection: ${rawCdpWebSocketOwners.join(',')}`,
);
requireCondition(
  JSON.stringify(managedAttachedExtensionSlotConsumers)
    === JSON.stringify(['scripts/e2e/extensionChromiumHarness.mjs']),
  `managed attached extension mutation bypasses ExtensionChromiumHarness: ${
    managedAttachedExtensionSlotConsumers.join(',')
  }`,
);

const evidenceWriter = await read('scripts/qa/evidence/QaEvidenceWriter.mjs');
requireCondition(
  evidenceWriter.includes('QA_RUN_ROOT_EXISTS')
    && evidenceWriter.indexOf("'cleanup.json'") < evidenceWriter.indexOf("'run.json'"),
  'QA evidence must use an exclusive run root and commit run.json after cleanup.json',
);

const siteProtocol = await read('scripts/qa/protocols/siteRuntimeQaProtocol.mjs');
const siteProtocolTest = await read('tests/siteRuntimeQaProtocol.test.js');
const attachedSiteProtocol = await read(
  'scripts/qa/protocols/siteRuntimeAttachedQaProtocol.mjs',
);
const attachedSiteProtocolTest = await read(
  'tests/siteRuntimeAttachedQaProtocol.test.js',
);
const qaControlPlaneDoc = await read('docs/operations/qa/entropy-qa-control-plane.md');
const realSiteE2EDoc = await read('docs/operations/qa/real-site-e2e.md');
const domTargetingArchitectureDoc = await read(
  'docs/architecture/runtime/dom-targeting-runtime-architecture.md',
);
const commandProtocol = await read('scripts/qa/protocols/commandQaProtocol.mjs');
const visualProtocol = await read('scripts/qa/protocols/visualCaptureQaProtocol.mjs');
const visualHarnessServer = await read('scripts/dev/visual-harness/visualHarnessServer.mjs');
const visualHarnessViteContract = await read(
  'scripts/dev/visual-harness/visualHarnessViteContract.mjs',
);
const extensionViteConfig = await read('vite.config.js');
const visualGitObservationSource = await read('scripts/dev/visual-harness/visualHarnessReport.mjs');
const gitObservationTest = await read('tests/qaGitObservation.test.js');
requireCondition(
  visualGitObservationSource.includes("['--no-optional-locks', 'status', '--short']")
    && extensionViteConfig.includes("['--no-optional-locks', 'status', '--porcelain=v1', '--untracked-files=normal']")
    && qaArtifactLease.includes("'--no-optional-locks',\n    'status',")
    && gitObservationTest.includes('reports a clean touched worktree without refreshing the shared index')
    && gitObservationTest.includes('retains dirty-path evidence and preserves an existing foreign index lock'),
  'visual QA/build Git status observers must suppress optional index writes while preserving clean/dirty evidence and foreign index ownership',
);
const visualHarnessViteIsolationTest = await read('tests/visualHarnessViteIsolation.test.js');
const visualHarnessSelectedScene = await read('scripts/dev/visual-harness/visualHarnessSelectedScene.mjs');
const visualHarnessSelectedSceneTest = await read('tests/visualHarnessSelectedScene.test.js');
const visualHarnessBrowserEntry = await read('src/apps/visual-harness/main.jsx');
const visualHarnessSceneCatalog = await read('src/apps/visual-harness/sceneCatalog.js');
const visualCaptureHarnessDoc = await read('docs/operations/qa/visual-capture-harness.md');
const visualCapturePipeline = await read('scripts/dev/visual-harness/captureVisualScene.mjs');
requireCondition(
  executionPlanContract.includes("target.protocolId === 'visual_capture'")
    && executionPlanContract.includes('QA_VISUAL_CAPTURE_CONCURRENCY_ENVIRONMENT_INVALID')
    && executionPlanContract.includes('`${claim}:${runId}`')
    && browserBroker.includes('QA_BROWSER_BROKER_OWNED_SESSION_INVALID')
    && browserCapacity.includes('PROJECT_CAPTURE_SLOTS = 2')
    && browserCapacity.includes('startCaptureResponder(endpoint, snapshot)')
    && browserCapacity.includes('QA_BROWSER_CAPACITY_SHARED_CAPTURE_REQUIRES_OWNED_PROJECT')
    && browserCapacity.includes("record.reservationMode !== reservationMode")
    && visualCapturePipeline.indexOf('await acquireQaBrowserCapacity(')
      < visualCapturePipeline.indexOf('await startVisualHarnessServer(')
    && visualHarnessServer.includes('cacheDir = path.join(cacheRoot, randomUUID())')
    && visualCaptureHarnessDoc.includes('a third run')
    && browserCapacityTest.includes('admits two isolated captures across worktrees, blocks a third and keeps exclusive runs isolated')
    && browserCapacityTest.includes('keeps capture ownership responsive while the source process is CPU-bound'),
  'two isolated visual captures must retain bounded project capacity, owned-session brokers, private borrows and exact cache cleanup; persistent or performance resources cannot be partitioned',
);
const isolatedFunctionalTest = await read('tests/qaIsolatedFunctionalConcurrency.test.js');
const functionalHarnessSource = await read('scripts/e2e/extensionChromiumHarness.mjs');
requireCondition(
  targetContract.includes("EXCLUSIVE_MEASUREMENT: 'exclusive_measurement'")
    && targetContract.includes("ISOLATED_FUNCTIONAL: 'isolated_functional'")
    && executionPlanContract.includes('QA_ISOLATED_FUNCTIONAL_ENVIRONMENT_INVALID')
    && executionPlanContract.includes("isolatedFunctional && claim.startsWith('runtime:')")
    && executionPlanContract.includes('isolatedFunctionalTarget && browserExecution?.headless === true')
    && executionPlanContract.includes('environmentSnapshot.extensionSlot')
    && executionPlanContract.includes('parameters.rebuildDuringRun === true')
    && runSession.includes("['shared_capture', 'isolated_functional'].includes(plan.browserConcurrency)")
    && functionalHarnessSource.includes('capacityReservationMode = \'exclusive\'')
    && functionalHarnessSource.includes('CHROMIUM_HARNESS_CAPACITY_RESERVATION_INVALID')
    && functionalHarnessSource.includes('this.browserExecution.headless !== true')
    && functionalHarnessSource.includes('reservationMode: this.capacityReservationMode')
    && browserCapacity.includes('QA_BROWSER_CAPACITY_ISOLATED_FUNCTIONAL_REQUIRES_OWNED_PROJECT')
    && isolatedFunctionalTest.includes('blocks third and exclusive measurements')
    && isolatedFunctionalTest.includes('never partitions shared physical browser capacity or brokers')
    && qaControlPlaneDoc.includes('concurrency: isolated_functional'),
  'isolated functional QA must retain explicit owned-only admission, run-scoped runtime/broker claims, bounded capacity and exact cleanup while measurements and shared profiles stay exclusive',
);
requireCondition(
  commandProtocol.includes('readCommandQaProtocolReport')
    && commandProtocol.includes('QA_COMMAND_REPORT_SCHEMA_MISMATCH')
    && commandProtocol.includes('QA_COMMAND_CHILD_EXIT_OUTCOME_MISMATCH')
    && commandProtocol.includes('reportJsonPath'),
  'generic command QA must own one schema-checked report and preserve child/report outcome semantics',
);
requireCondition(
  visualHarnessServer.includes('mode: VISUAL_HARNESS_VITE_MODE')
    && visualHarnessViteContract.includes("VISUAL_HARNESS_VITE_MODE = 'entropy-visual-harness'")
    && visualHarnessViteContract.includes('VISUAL_HARNESS_VITE_COMMAND_INVALID')
    && extensionViteConfig.includes('isVisualHarnessViteServe({ command, mode })')
    && extensionViteConfig.includes('plugins: visualHarnessServe')
    && visualHarnessViteIsolationTest.includes(
      'excludes extension and CRX output owners from visual capture serve',
    )
    && visualHarnessViteIsolationTest.includes(
      "pluginNames.some((name) => name.startsWith('crx:'))",
    )
    && visualCaptureHarnessDoc.includes('The visual harness has no authority to produce an unpacked extension.')
    && visualCaptureHarnessDoc.includes('dist`, `dist-prod`'),
  'visual capture Vite must use its named serve mode and exclude CRX/extension output owners',
);
requireCondition(
  visualHarnessServer.includes('optimizeDeps: { entries: selectedScenes.optimizeEntries }')
    && visualHarnessSelectedScene.includes('getVisualSceneSource(sceneId)')
    && visualHarnessSelectedScene.includes('const optimizeEntries = [COMMON_ENTRY, ...new Set(')
    && !visualHarnessSelectedScene.includes('noDiscovery')
    && !visualHarnessBrowserEntry.includes('sceneCatalog')
    && visualHarnessSceneCatalog.includes('sourceModule:')
    && !visualHarnessSceneCatalog.includes('load: () => import(')
    && visualHarnessSelectedSceneTest.includes('keeps complete Node discovery while deriving only selected real optimizer roots')
    && visualHarnessSelectedSceneTest.includes('rejects entry/document mismatch before importing any implementation')
    && visualHarnessServer.includes('await server.transformRequest(root)')
    && visualHarnessServer.includes('await Promise.allSettled(roots.map(async (root)')
    && visualHarnessServer.includes('selectedScenes.sceneIds.map(selectedScenes.entryPathForScene)')
    && visualHarnessServer.includes("'/@vite/client'")
    && visualHarnessServer.includes('await server.waitForRequestsIdle()')
    && !visualHarnessServer.includes('warmupRequest(')
    && visualHarnessSelectedSceneTest.includes('admits all exact HTML and selected source roots concurrently before static import idle')
    && visualHarnessSelectedSceneTest.includes('settles every admitted transform before closing and preserves the original rejection')
    && visualCaptureHarnessDoc.includes('literal import of only its implementation'),
  'visual capture dependency scanning and browser admission must use catalog-selected source roots without changing discovery or extension inputs',
);
const directHarnessProtocolSources = await Promise.all([
  'scripts/qa/protocols/gateRuntimeQaProtocol.mjs',
  'scripts/qa/protocols/audioDullingQaProtocol.mjs',
  'scripts/qa/protocols/sentinelProtocolQaProtocol.mjs',
  'scripts/qa/protocols/humanSetupQaProtocol.mjs',
].map((relativePath) => read(relativePath)));
const humanSetupProtocol = directHarnessProtocolSources[3];
const humanSentinelReadiness = await read('scripts/qa/protocols/humanSentinelReadiness.mjs');
requireCondition(
  attachedSiteProtocol.includes('managed_browser_reddit_access_and_dom_structural_opportunity_only')
    && attachedSiteProtocol.includes("ATTACHED_SETTINGS_SITE_RULE_POLICY = 'zero_settings_and_site_rule_commands'")
    && attachedSiteProtocol.includes("ATTACHED_EXISTING_TARGET_POLICY = 'unique_exact_route_attach_evaluate_detach'")
    && attachedSiteProtocol.includes("'Target.attachToTarget'")
    && attachedSiteProtocol.includes("'Target.detachFromTarget'")
    && attachedSiteProtocol.includes("ownership: 'operator_owned_borrowed_observation'")
    && attachedSiteProtocol.includes('baselinePageTargetSetPreserved')
    && attachedSiteProtocol.includes("productEffectAcceptance: 'not_claimed'")
    && attachedSiteProtocol.includes('settingsCommandCount: 0')
    && attachedSiteProtocol.includes('siteRuleCommandCount: 0')
    && attachedSiteProtocol.includes('artifactStageCount: 0')
    && attachedSiteProtocol.includes('pageNavigationCount: 0')
    && attachedSiteProtocol.includes('pageActivationCount: 0')
    && attachedSiteProtocol.includes('boundedScrollCount: 0')
    && attachedSiteProtocol.includes("profileSiteRuntimeSideEffects: 'not_measured_not_restored'")
    && attachedSiteProtocol.includes('structuralRecoveryUsed')
    && attachedSiteProtocol.includes('catalogSelectorCoverage')
    && attachedSiteProtocol.includes('validateRedditSurfaceObservation')
    && attachedSiteProtocol.includes('verifyAttachedBrowserIdentity')
    && attachedSiteProtocol.includes('attachedBrowserObservation: Object.freeze({')
    && attachedSiteProtocol.includes('browserEpochDigest: sha256Json(browserEpoch)')
    && attachedSiteProtocolTest.includes(
      'attaches to one exact existing target, evaluates once, and detaches without mutation',
    )
    && attachedSiteProtocolTest.includes(
      'rejects a connected-browser identity mismatch before target admission',
    ),
  'Reddit attached protocol must borrow one existing route for attach/evaluate/detach only and retain non-product-acceptance scope',
);
const attachedForbiddenMutationPatterns = Object.freeze([
  /\bSET_SETTINGS\b/u,
  /\bUPSERT_SITE_RULE\b/u,
  /\bREMOVE_SITE_RULE\b/u,
  /\bconfigureScenario\b/u,
  /\breadAttachedSiteRuntimeSettingsSnapshot\b/u,
  /\brestoreAttachedSiteRuntimeSettingsSnapshot\b/u,
  /\binspectAttachedScenarioSiteRulePrecondition\b/u,
  /\bcreateQaCdpPageTarget\b/u,
  /\bExtensionChromiumHarness\b/u,
  /\bstageEntropyQaArtifact\b/u,
  /['"]Target\.createTarget['"]/u,
  /['"]Target\.closeTarget['"]/u,
  /['"]Page\.navigate['"]/u,
  /['"]Target\.activateTarget['"]/u,
  /\bcloseQaCdpTarget\b/u,
  /\bwindow\.scrollBy\b/u,
]);
requireCondition(
  attachedForbiddenMutationPatterns.every((pattern) => !pattern.test(attachedSiteProtocol))
    && !attachedSiteProtocol.includes("from '../../e2e/sites/siteRuntimeBrowser.mjs'"),
  'Reddit attached surface protocol must not import or invoke settings/site-rule mutation owners',
);
const attachedStructuralOwnerSource = attachedSiteProtocol.slice(
  attachedSiteProtocol.indexOf('const redditPermalinkPath = (anchor) => {'),
  attachedSiteProtocol.indexOf('const posts = new Set('),
);
const attachedChallengeOwnerSource = attachedSiteProtocol.slice(
  attachedSiteProtocol.indexOf('const ownerChallengeShaped = ['),
  attachedSiteProtocol.indexOf('const challengeSelectorPresent ='),
);
requireCondition(
  attachedStructuralOwnerSource.length > 0
    && attachedStructuralOwnerSource.includes("url.pathname.includes('/comments/')")
    && attachedStructuralOwnerSource.includes('url.origin === location.origin')
    && attachedStructuralOwnerSource.includes('.filter((anchor) => visible(anchor))')
    && attachedStructuralOwnerSource.includes('depth < 8')
    && attachedStructuralOwnerSource.includes('signalCount >= 2')
    && attachedStructuralOwnerSource.includes('ownedPermalinkPaths.size === 1')
    && attachedStructuralOwnerSource.includes(
      'const structuralPosts = new Set(structuralRootByPermalinkPath.values())',
    )
    && !attachedStructuralOwnerSource.includes('input.post')
    && attachedSiteProtocol.includes('descendants(structuralPosts, [')
    && attachedSiteProtocol.includes('relationshipEvidence: {')
    && attachedChallengeOwnerSource.includes("safeQueryAll(document, ['h1', 'h2'])")
    && !attachedChallengeOwnerSource.includes("'main'")
    && attachedSiteProtocolTest.includes(
      'recovers structural opportunities without catalog post selectors',
    )
    && attachedSiteProtocolTest.includes(
      'does not promote short normal main text to a challenge owner',
    ),
  'Reddit attached structural oracle must remain catalog-post-independent and challenge text must stay heading-owner bounded',
);
requireCondition(
  qaControlPlaneDoc.includes('Unattended, user-invisible automation')
    && qaControlPlaneDoc.includes('owned target with explicit `--presentation=hidden`')
    && qaControlPlaneDoc.includes('Visible attached automation that must not steal focus')
    && qaControlPlaneDoc.includes('`browser open authenticated`')
    && qaControlPlaneDoc.includes('`browser page authenticated [--url=...]`')
    && qaControlPlaneDoc.includes('`background` is not a synonym for invisible')
    && qaControlPlaneDoc.includes('does not override `osFocus: never`')
    && qaControlPlaneDoc.includes('must not borrow the operator page command'),
  'QA presentation docs must separate hidden automation, attached no-focus execution, and explicit operator page focus authority',
);
requireCondition(
  siteProtocol.includes('`--chrome=${browser.chrome}`')
    && commandProtocol.includes('CHROME_BIN: browser.chrome')
    && visualProtocol.includes('chromePath: browser.chrome'),
  'owned-browser protocols must consume the control-plane Chromium executable',
);
requireCondition(
  siteProtocol.includes('createBrowserExecutionEnvironment(plan.browserExecution)')
    && commandProtocol.includes('createBrowserExecutionEnvironment(plan.browserExecution)')
    && visualProtocol.includes('browserExecution: plan.browserExecution')
    && directHarnessProtocolSources.every((source) => (
      source.includes('browserExecution: plan.browserExecution')
    )),
  'protocol adapters must preserve the browser execution leaves instead of reducing them to headed/headless',
);
const humanHarnessCleanupRegistrationIndex = humanSetupProtocol.indexOf(
  "registerCleanup('human_setup_harness'",
);
requireCondition(
  humanSetupProtocol.includes("observation: ['site_furin', 'global_sentinel'].includes(feature.id) ? 'document' : 'emulated'")
    && humanSetupProtocol.includes("await evidence.event('QA_HUMAN_SETUP_TARGET_ADMITTED', admission.receipt)"),
  'manual Sentinel setup must use native document readiness and record its target evidence without borrowing production tracking admission',
);
const humanFeatureCleanupRegistrationIndex = humanSetupProtocol.indexOf(
  "registerCleanup('human_setup_feature'",
);
const humanFeatureReadinessIndex = humanSetupProtocol.indexOf(
  'const readiness = await prepareFeature({',
);
const humanOperatorHandoffIndex = humanSetupProtocol.indexOf(
  'const focusReceipt = await requestOperatorHandoff({',
);
const humanReadyEvidenceIndex = humanSetupProtocol.indexOf(
  "await evidence.event('QA_HUMAN_SETUP_READY', ready)",
);
const humanCancellationWaitIndex = humanSetupProtocol.indexOf(
  'await waitForHumanSetupCancellation(signal)',
);
const humanSentinelStartCapture = humanSetupProtocol.slice(
  humanSetupProtocol.indexOf('if (parameters.captureScreenshots) {'),
  humanSetupProtocol.indexOf("await evidence.event('QA_HUMAN_SETUP_SENTINEL_INVOKED'"),
);
const humanSentinelHandoffCapture = humanSetupProtocol.slice(
  humanSetupProtocol.indexOf('if (captureScreenshots && !captured && snapshot.active) {'),
  humanSetupProtocol.indexOf('captured = true;') + 'captured = true;'.length,
);
requireCondition(
  humanSetupProtocol.includes("from './humanSentinelReadiness.mjs'")
    && humanSetupProtocol.includes('inspectHumanSentinelSurface(harness, page)')
    && humanSetupProtocol.includes('accept: (value) => isHumanSentinelReady(value, scope)')
    && humanSentinelReadiness.includes('harness.cdp, page.sessionId')
    && humanSentinelReadiness.includes('diagnostics?.protocolScope === scope')
    && humanSentinelReadiness.includes('diagnostics.workerFirstFrameReady === true')
    && humanSentinelReadiness.includes('diagnostics.rootConnected === true')
    && humanSentinelReadiness.includes("surface?.documentVisibility === 'visible'")
    && humanSentinelReadiness.includes("scope === 'site' ? surface.furin : surface.frame")
    && humanSentinelReadiness.includes("diagnostics.canvasRuntimeOwner === 'host_dom'")
    && humanSentinelReadiness.includes("#nudgeFurinStage svg")
    && humanSentinelReadiness.includes("diagnostics.globalSentinelGamePhase === 'awaiting_start'")
    && humanSentinelReadiness.includes('runtime.liveCount > 0')
    && !humanSentinelReadiness.includes('Input.dispatch')
    && !humanSentinelReadiness.includes('Page.captureScreenshot')
    && (humanSetupProtocol.match(/'Page\.captureScreenshot'/gu) || []).length === 2
    && [humanSentinelStartCapture, humanSentinelHandoffCapture].every((branch) => (
      branch.includes("harness.cdp.send('Page.captureScreenshot'")
      && branch.includes('captureBeyondViewport: false')
      && branch.includes('page.sessionId, { timeoutMs: 8_000 }')
    )),
  'human Sentinel readiness must use the exact page and real visible first frame; optional captures stay bounded to the two explicit opt-in branches',
);
requireCondition(
  humanSetupProtocol.includes("plan?.mode !== 'human'")
    && humanSetupProtocol.includes("plan?.operatorHandoffPolicy?.focus !== 'operator_request_once'")
    && humanSetupProtocol.includes("artifact?.id !== 'dev_extension'")
    && humanSetupProtocol.includes("artifact?.releaseProfile !== 'dev'")
    && humanSetupProtocol.includes("browser?.processOwnership !== 'attach_only'")
    && humanSetupProtocol.includes("browser?.lifecyclePolicy !== 'managed'")
    && humanSetupProtocol.includes('resolveQaHumanSetupUrl({')
    && humanSetupProtocol.includes('requiredHostPermissions: [`${parsedTargetUrl.origin}/*`]')
    && humanSetupProtocol.includes('defineEntropyQaAttachedArtifactStage({')
    && humanSetupProtocol.includes('openEntropyAttachOnlyActivePage({')
    && humanSetupProtocol.includes('SENTINEL_PROTOCOL_QA_ACTIONS.START')
    && humanSetupProtocol.includes('SENTINEL_PROTOCOL_QA_ACTIONS.SNAPSHOT')
    && humanSetupProtocol.includes('SENTINEL_PROTOCOL_QA_ACTIONS.STOP')
    && humanSetupProtocol.includes('GATE_QA_AUTOMATION_ACTIONS.PRESENT_ENTRY_CHECKPOINT')
    && humanSetupProtocol.includes('GATE_QA_AUTOMATION_ACTIONS.PRESENT_DETOUR_SPREAD')
    && humanSetupProtocol.includes('GATE_QA_AUTOMATION_ACTIONS.DISMISS')
    && humanSetupProtocol.includes('RUNTIME_DEBUGGER_AUTOMATION_ACTIONS.FORCE_ENSO_GATE')
    && humanSetupProtocol.includes('RUNTIME_DEBUGGER_AUTOMATION_ACTIONS.DISMISS_ENSO_GATE')
    && humanSetupProtocol.includes(".gate-page[data-gate-kind=\"entryCheckpoint\"]")
    && humanSetupProtocol.includes("value?.ready === '1'")
    && humanSetupProtocol.includes('value?.shishiScenePresent === true')
    && humanSetupProtocol.includes('[data-zen-shishi-scene="actual"]')
    && humanSetupProtocol.includes("document.querySelector('.friction-click-enso-gate')")
    && humanSetupProtocol.includes('.gate-page[data-gate-kind="detourSpreadGuard"]')
    && humanSetupProtocol.includes('value.count === `${parameters.openTabCount}/${parameters.maxProtectedTabs}`')
    && humanSetupProtocol.includes('value.href === presentation.gatePageUrl')
    && humanSetupProtocol.includes('value.topLevel === true')
    && humanSetupProtocol.includes('QA_HUMAN_SETUP_TARGET_FEATURE_MISMATCH')
    && humanSetupProtocol.includes(
      'protectedTabs: protectedTabs.map(({ tabId, url }) => ({ tabId, url }))',
    )
    && humanHarnessCleanupRegistrationIndex >= 0
    && humanFeatureCleanupRegistrationIndex > humanHarnessCleanupRegistrationIndex
    && humanOperatorHandoffIndex > humanFeatureCleanupRegistrationIndex
    && humanOperatorHandoffIndex > humanSetupProtocol.indexOf("await markStage('target_admitted')")
    && humanFeatureReadinessIndex > humanOperatorHandoffIndex
    && humanReadyEvidenceIndex > humanFeatureReadinessIndex
    && humanCancellationWaitIndex > humanReadyEvidenceIndex
    && (humanSetupProtocol.match(/await requestOperatorHandoff\(\{/gu) || []).length === 1
    && humanSetupProtocol.includes('targetId: page.targetId')
    && humanSetupProtocol.includes('targetTabId: page.tabId')
    && humanSetupProtocol.includes('targetWindow: admission.receipt.targetWindow')
    && humanSetupProtocol.includes("status: 'READY_FOR_HUMAN'")
    && humanSetupProtocol.includes('syntheticInputCount: 0')
    && humanSetupProtocol.includes("runnerOwnership: 'retained_until_explicit_cancel'")
    && !humanSetupProtocol.includes('Input.dispatch')
    && !humanSetupProtocol.includes('chrome.storage.')
    && !humanSetupProtocol.includes('focusWindowsChromeWindow')
    && !humanSetupProtocol.includes('runQaManagedPersistentBrowserAction')
    && humanSetupContractsTest.includes(
      'holds until explicit cancellation and exposes feature-specific instructions',
    ),
  'human setup must prepare one exact owned window once before feature realization, prove the real surface before READY, then retain ownership without synthetic input until explicit cancellation',
);
requireCondition(
  siteProtocol.includes('readSiteRuntimeProtocolReport')
    && siteProtocol.includes('QA_SITE_RUNTIME_REPORT_DIRECTORY_COUNT_INVALID')
    && siteProtocol.includes('QA_SITE_RUNTIME_REPORT_ROOT_INVALID')
    && siteProtocol.includes('QA_SITE_RUNTIME_REPORT_FILE_INVALID')
    && siteProtocol.includes('QA_SITE_RUNTIME_REPORT_SHAPE_INVALID')
    && siteProtocol.includes('QA_SITE_RUNTIME_REPORT_SUITE_MISMATCH')
    && siteProtocol.includes('QA_SITE_RUNTIME_REPORT_LANES_MISMATCH')
    && siteProtocol.includes('QA_SITE_RUNTIME_REPORT_LANE_COVERAGE_INVALID')
    && siteProtocol.includes('QA_SITE_RUNTIME_REPORT_RUN_REPEAT_COVERAGE_INVALID')
    && siteProtocol.includes('QA_SITE_RUNTIME_REPORT_CONTROL_COVERAGE_INVALID')
    && siteProtocol.includes('combineSiteRunOutcomes')
    && siteProtocol.includes('QA_SITE_RUNTIME_REPORT_OUTCOME_MISMATCH')
    && siteProtocol.includes('QA_SITE_RUNTIME_ACCEPTANCE_GATE_FAILED')
    && siteProtocol.includes('QA_SITE_RUNTIME_ACCEPTANCE_OPPORTUNITY_FLOOR_UNMET')
    && siteProtocol.includes('run.siteId !== reportAcceptance.siteId')
    && siteProtocol.includes('scenarioId !== reportAcceptance.scenarioId')
    && siteProtocol.includes('reportAcceptance: plan.protocolOptions.reportAcceptance')
    && siteProtocol.includes('QA_SITE_RUNTIME_CHILD_EXIT_OUTCOME_MISMATCH')
    && siteProtocol.includes('QA_SITE_RUNTIME_CHILD_REPORT_REQUIRED_AFTER_NONZERO')
    && siteProtocol.includes('suiteOutcome: reportResult.suiteOutcome')
    && siteProtocol.includes('return QA_RUN_STATUSES.INCONCLUSIVE')
    && siteProtocolTest.includes('accepts the full aggregate emitted by the canonical report writer')
    && siteProtocolTest.includes('reads the persisted FAIL report after canonical child exit 1')
    && siteProtocolTest.includes('rejects report-root and report.json symlinks')
    && siteProtocolTest.includes('TikTok 5/1/1 opportunity characterization as typed INCONCLUSIVE')
    && siteProtocolTest.includes('TikTok 5/1/0 armed-idle characterization as typed INCONCLUSIVE')
    && siteProtocolTest.includes('wrong site or scenario identity')
    && qaControlPlaneDoc.includes('QA_SITE_RUNTIME_REPORT_OUTCOME_MISMATCH')
    && qaControlPlaneDoc.includes('QA_SITE_RUNTIME_ACCEPTANCE_GATE_FAILED')
    && qaControlPlaneDoc.includes('QA_SITE_RUNTIME_ACCEPTANCE_OPPORTUNITY_FLOOR_UNMET')
    && qaControlPlaneDoc.includes('QA_SITE_RUNTIME_CHILD_EXIT_OUTCOME_MISMATCH')
    && realSiteE2EDoc.includes('recomputed worst outcome')
    && realSiteE2EDoc.includes('QA_SITE_RUNTIME_CHILD_REPORT_REQUIRED_AFTER_NONZERO'),
  'site-runtime protocol must validate exact owned report evidence, recompute lane/control outcomes, and reconcile the canonical child exit',
);
requireCondition(
  realSiteE2EDoc.includes('correctness characterization rather')
    && realSiteE2EDoc.includes('per-repeat\nopportunity counts of `0/5/5`')
    && realSiteE2EDoc.includes('Canonical named-target acceptance nevertheless remains pending')
    && domTargetingArchitectureDoc.includes(
      'characterization rather than a named acceptance PASS',
    )
    && domTargetingArchitectureDoc.includes('bounded fresh-isolation invocation')
    && domTargetingArchitectureDoc.includes('clean-commit canonical\n  acceptance remains pending'),
  'TikTok FeedFlow measured exact-match evidence must remain characterization while canonical per-repeat acceptance is pending',
);
const siteRuntimeBrowser = await read('scripts/e2e/sites/siteRuntimeBrowser.mjs');
const siteRuntimeMetrics = await read('scripts/e2e/sites/siteRuntimeMetrics.mjs');
const siteRunAnalysis = await read('scripts/e2e/sites/siteRunAnalysis.mjs');
const qaScenarioTabActivationRoutes = await read(
  'src/apps/background/services/runtime/messageRoutes/qaScenarioTabActivationMessageRoutes.dev.js',
);
const qaScenarioTabActivationContract = await read(
  'src/platform/security/qaScenarioTabActivationContract.dev.js',
);
const extensionChromiumHarness = await read('scripts/e2e/extensionChromiumHarness.mjs');
const siteRuntimeE2E = await read('scripts/e2e/siteRuntimeE2E.mjs');
const siteRuntimeE2ETest = await read('tests/siteRuntimeE2E.test.js');
const siteRuntimeCollectorAvailabilityTest = await read(
  'tests/siteRuntimeCollectorAvailability.test.js',
);
requireCondition(
  siteRuntimeBrowser.includes('scriptTimelineEntries.length >= 64')
    && siteRuntimeBrowser.includes("source: bucket")
    && siteRuntimeBrowser.includes('forcedStyleAndLayoutDurationMs')
    && siteRuntimeMetrics.includes('same_frame_temporal_overlap_not_causal_proof')
    && siteRuntimeMetrics.includes('ownerStyleAndLayoutPhaseOverlapMs')
    && siteRuntimeMetrics.includes('ownerExtensionScriptOverlapMs')
    && siteRuntimeE2E.includes("id: 'runtime_loaf_owner_correlation_measured'")
    && siteRuntimeCollectorAvailabilityTest.includes("state: 'measured'")
    && qaControlPlaneDoc.includes('same-frame and style/layout-phase overlap')
    && realSiteE2EDoc.includes('causal invalidation ownership'),
  'site runtime must correlate bounded sanitized LoAF timing with diagnostic owner spans without claiming causal invalidation ownership',
);
requireCondition(
  siteProtocol.includes("args.push(`--repeat-isolation=${invocation.repeatIsolation.replaceAll('_', '-')}`)")
    && siteProtocol.includes('expectedRepeatIsolation: invocation.repeatIsolation || null')
    && siteProtocol.includes('QA_SITE_RUNTIME_REPORT_OPTIONS_REPEAT_ISOLATION_MISMATCH')
    && siteProtocol.includes('QA_SITE_RUNTIME_REPORT_REPEAT_ISOLATION_EVIDENCE_INVALID')
    && siteProtocol.includes('QA_SITE_RUNTIME_REPORT_REPEAT_ISOLATION_UNEXPECTED')
    && siteProtocol.includes('QA_SITE_RUNTIME_REPORT_REPEAT_ISOLATION_EPOCH_REUSED')
    && siteProtocol.includes('QA_SITE_RUNTIME_REPORT_REPEAT_ISOLATION_TOPOLOGY_INVALID')
    && siteProtocol.includes('browserEpochDigest')
    && siteProtocol.includes('profileEpochDigest')
    && siteRuntimeE2E.includes('export async function runLaneWithRepeatIsolation(')
    && siteRuntimeE2E.includes('repeatIndexes: [repeatIndex]')
    && siteRuntimeE2E.includes('SITE_E2E_REPEAT_ISOLATION_PROFILE_EPOCH_INVALID')
    && siteRuntimeE2E.includes('SITE_E2E_REPEAT_ISOLATION_ARTIFACT_RETAINED')
    && siteRuntimeE2E.includes('SITE_E2E_REPEAT_ISOLATION_EPOCH_REUSED')
    && siteRuntimeE2E.includes('SITE_E2E_REPEAT_ISOLATION_BROWSER_IDENTITY_INVALID')
    && siteRuntimeE2E.includes('SITE_E2E_REPEAT_ISOLATION_TEMP_ROOT_RETAINED')
    && siteRuntimeE2E.includes('repeat: options.repeat')
    && siteRuntimeE2E.includes('await harness.close();')
    && siteRuntimeE2ETest.includes(
      'runs every isolated repeat in one distinct disposable browser epoch',
    )
    && siteRuntimeE2ETest.includes(
      'fails isolated repeats on profile reuse or retained epoch artifacts',
    )
    && siteRuntimeE2ETest.includes(
      'requires exact cleanup facts and unique verified browser/profile epoch digests',
    )
    && siteRuntimeE2ETest.includes(
      'preserves the requested repeat count in aggregate reproduction commands',
    )
    && siteProtocolTest.includes(
      'requires persisted proof of the target-declared fresh repeat browser isolation',
    )
    && siteProtocolTest.includes('rejects incomplete per-run isolation cleanup evidence')
    && siteProtocolTest.includes(
      'rejects isolation declarations and receipts on non-isolated targets',
    )
    && siteProtocolTest.includes(
      'rejects reused epoch digests and contradictory disposable topology',
    )
    && siteProtocolTest.includes(
      'rejects an isolated aggregate reproduction command that shrinks repeat coverage',
    )
    && qaControlPlaneDoc.includes('repeatIsolation=fresh_disposable_browser')
    && qaControlPlaneDoc.includes('Aggregate reproduction commands keep')
    && realSiteE2EDoc.includes('all six repeats recorded exactly')
    && domTargetingArchitectureDoc.includes(
      'fresh disposable browser/profile epoch for every repeat',
    ),
  'TikTok FeedFlow acceptance must prove one owned disposable browser epoch per repeat',
);
requireCondition(
  siteRuntimeBrowser.includes('focusWindow = false')
    && siteRuntimeBrowser.includes("lane === 'release'")
    && siteRuntimeBrowser.includes('activateOwnedEphemeralPageWithoutWindowFocus')
    && siteRuntimeBrowser.includes("proofKind: 'release_external_active_tab'")
    && siteRuntimeBrowser.includes('trackingObserved: null')
    && siteRuntimeBrowser.includes('createQaScenarioTabActivationRequest')
    && siteRuntimeBrowser.includes('result?.trackingObserved !== true')
    && siteRuntimeBrowser.includes("proofKind: 'diagnostic_tracking_admission'")
    && siteRuntimeE2E.includes("id: 'scenario_tab_activation_proof'")
    && siteRuntimeE2E.includes("activeTabObserved: lane === 'release'")
    && siteRuntimeE2E.includes("trackingObserved: lane === 'diagnostic'")
    && qaScenarioTabActivationRoutes.includes('runtime?.lastActiveTabId === tabId')
    && qaScenarioTabActivationRoutes.includes('assertTrustedQaAutomationHarnessSender')
    && qaScenarioTabActivationContract.includes('QA_SCENARIO_TAB_ACTIVATION_OS_FOCUS_FORBIDDEN')
    && qaControlPlaneDoc.includes('release_external_active_tab')
    && realSiteE2EDoc.includes('diagnostic_tracking_admission'),
  'site runtime must split release external activation proof from diagnostic tracking admission without OS focus',
);

requireCondition(
  siteRuntimeBrowser.includes('function findLatestProtectionDispatchTerminalEvent(')
    && siteRuntimeBrowser.includes("terminalEvent?.event === 'dispatch_succeeded'")
    && siteRuntimeBrowser.includes("terminalEvent?.event === 'dispatch_failed'")
    && siteRuntimeBrowser.includes("reason: 'settings_propagation_task_succeeded'")
    && siteRuntimeE2ETest.includes(
      'uses the latest terminal dispatch after a retryable failed attempt',
    )
    && siteRuntimeE2ETest.includes(
      'does not let an uncorrelated dispatch event override a settled task receipt',
    )
    && siteRuntimeE2ETest.includes(
      'waits through a retryable dispatch failure for the later acknowledgement',
    )
    && siteRuntimeE2ETest.includes(
      'reports a terminal dispatch failure only after the bounded wait expires',
    )
    && siteRuntimeE2ETest.includes(
      'keeps initial targeting coverage nonblocking while activation is armed idle',
    )
    && siteRuntimeE2ETest.includes(
      'keeps a settled targeting miss fail-loud after measured activation',
    )
    && siteRuntimeE2ETest.includes(
      'keeps independently observed physical targeting effects measured despite initial latency',
    )
    && siteRuntimeE2E.includes('const effectActivationState = initialActivation.state;')
    && siteRunAnalysis.includes('if (activeEffectObserved) status = \'measured\';')
    && realSiteE2EDoc.includes('runtime dispatch events do not carry a task')
    && realSiteE2EDoc.includes('initial positive comparison is `WARN / armed_idle`')
    && realSiteE2EDoc.includes('physical effect authority'),
  'site runtime must use canonical propagation receipts, terminal retry ordering, and activation-scoped targeting coverage',
);

const siteReadinessConditionOwner = siteRuntimeE2E.slice(
  siteRuntimeE2E.indexOf('function selectReadinessConditionObservation('),
  siteRuntimeE2E.indexOf('export function createObservableConditionContracts('),
);
requireCondition(
  siteReadinessConditionOwner.includes("condition.kind === 'selector_any_present'")
    && siteReadinessConditionOwner.includes('observation: activeObservation')
    && siteReadinessConditionOwner.includes("observationPhase: 'active_settled'")
    && siteReadinessConditionOwner.includes('observation: readinessObservation')
    && siteReadinessConditionOwner.includes("observationPhase: 'readiness'")
    && siteRuntimeE2E.includes('createReadinessConditionContracts(scenario, lane, {')
    && siteRuntimeE2E.includes('readinessObservation: readiness.state')
    && siteRuntimeE2E.includes('activeObservation,')
    && !siteReadinessConditionOwner.includes('activeObservation ||')
    && !siteReadinessConditionOwner.includes('activeObservation ??')
    && siteRuntimeE2ETest.includes(
      'uses active-settled selector opportunity without masking a settled selector miss',
    )
    && siteRuntimeE2ETest.includes(
      "evidence: { actual: 2, observationPhase: 'active_settled' }",
    )
    && siteRuntimeE2ETest.includes(
      "evidence: { actual: 0, observationPhase: 'active_settled' }",
    )
    && realSiteE2EDoc.includes('Readiness-condition phase ownership is explicit')
    && realSiteE2EDoc.includes('zero matches in the active-settled observation remain `FAIL`'),
  'site selector opportunity acceptance must use one active-settled observation while non-selector readiness remains on its bounded readiness phase',
);

const extensionRuntimeCollectorOwner = siteRuntimeBrowser.slice(
  siteRuntimeBrowser.indexOf('export async function createExtensionRuntimeCollector('),
  siteRuntimeBrowser.indexOf('function safeSiteE2EDiagnosticToken('),
);
requireCondition(
  extensionRuntimeCollectorOwner.includes('const ownedErrorCursorSequences = new WeakMap()')
    && extensionRuntimeCollectorOwner.includes('let errorSequence = 0')
    && extensionRuntimeCollectorOwner.includes('createErrorCursor')
    && extensionRuntimeCollectorOwner.includes('snapshotAfterErrorCursor')
    && extensionRuntimeCollectorOwner.includes('refreshAfterErrorCursor')
    && extensionRuntimeCollectorOwner.includes('SITE_E2E_EXTENSION_ERROR_CURSOR_INVALID')
    && extensionRuntimeCollectorOwner.includes("entry.source === 'extension_service_worker_collector'")
    && siteRuntimeE2E.includes('extensionErrorCursor = await extensionCollector.createErrorCursor()')
    && siteRuntimeE2E.includes('extensionCollector.refreshAfterErrorCursor(')
    && siteRuntimeE2E.includes("id: 'extension_uncaught_errors_absent'")
    && siteRuntimeE2E.includes('evidence: { count: extensionErrors.length }')
    && siteRuntimeCollectorAvailabilityTest.includes(
      'projects only service-worker errors recorded after the scenario cursor',
    )
    && siteRuntimeCollectorAvailabilityTest.includes(
      'retains collector lifecycle errors that predate the scenario cursor',
    )
    && realSiteE2EDoc.includes('collector-owned monotonic error cursor')
    && realSiteE2EDoc.includes('a current-scenario error still fails without')
    && !extensionRuntimeCollectorOwner.includes('allowlist'),
  'site runtime must attribute service-worker errors after an opaque scenario cursor without suppressing current failures',
);

const ownedEphemeralActivationOwner = extensionChromiumHarness.slice(
  extensionChromiumHarness.indexOf('async activateOwnedEphemeralPageWithoutWindowFocus(page)'),
  extensionChromiumHarness.indexOf('async navigatePage(page, url'),
);
requireCondition(
  extensionChromiumHarness.includes('requireExactOwnedHarnessPage(')
    && ownedEphemeralActivationOwner.includes('chrome.tabs.update')
    && ownedEphemeralActivationOwner.includes('chrome.tabs.query')
    && ownedEphemeralActivationOwner.includes('activeTabObserved: true')
    && ownedEphemeralActivationOwner.includes('windowFocusRequested: false')
    && !ownedEphemeralActivationOwner.includes('chrome.windows.update')
    && !ownedEphemeralActivationOwner.includes('Target.activateTarget'),
  'owned ephemeral release activation must prove only the exact harness-owned active tab',
);
const feedHorizonInspectionE2E = await read(
  'scripts/e2e/feedHorizonInspectionE2E.mjs',
);
const feedHorizonInspectionFocusTest = await read(
  'tests/feedHorizonInspectionFocus.test.js',
);
const initialWindowFocusAnchorLease = await read(
  'scripts/qa/resources/QaInitialWindowFocusAnchorLease.mjs',
);
const initialWindowFocusAnchorLeaseTest = await read(
  'tests/qaInitialWindowFocusAnchorLease.test.js',
);
const attachedBrowserOsFocusGuard = await read(
  'scripts/qa/resources/QaAttachedBrowserOsFocusGuard.mjs',
);
const attachedBrowserOsFocusGuardTest = await read(
  'tests/qaAttachedBrowserOsFocusGuard.test.js',
);
const feedConsumptionResearchQaProtocol = await read(
  'scripts/qa/protocols/feedConsumptionResearchQaProtocol.mjs',
);
const feedConsumptionResearchSuite = await read(
  'scripts/qa/feedConsumptionResearchSuite.mjs',
);
const feedConsumptionResearchAnalysis = await read(
  'scripts/e2e/feed-consumption-research/feedConsumptionResearchAnalysis.mjs',
);
const feedConsumptionResearchTest = await read(
  'tests/feedConsumptionResearch.test.js',
);
const feedConsumptionResearchQaTest = await read(
  'tests/feedConsumptionResearchQa.test.js',
);
const managedAttachedExtensionSlot = await read(
  'scripts/e2e/internal/managedAttachedExtensionSlot.mjs',
);
const qaProfileArtifactSlot = await read(
  'scripts/e2e/qaProfileArtifactSlot.mjs',
);
const qaArtifactSlotTransaction = await read(
  'scripts/e2e/internal/entropyQaArtifactSlotTransaction.mjs',
);
const managedAttachedExtensionSlotTest = await read(
  'tests/managedAttachedExtensionSlot.test.js',
);
requireCondition(
  extensionChromiumHarness.includes('CdpConnection as BrowserQaCdpConnection')
    && extensionChromiumHarness.includes('class CdpConnection extends BrowserQaCdpConnection')
    && !extensionChromiumHarness.includes('new this.WebSocketImpl')
    && !extensionChromiumHarness.includes('this.pending = new Map()'),
  'Extension Chromium harness must remain a thin adapter over the Browser QA CDP transport',
);
requireCondition(
  extensionChromiumHarness.includes(
    "const expectedExtensionRuntime = extensionEnabled ? 'required' : 'none'",
  )
    && extensionChromiumHarness.includes(
      'CHROMIUM_HARNESS_BROWSER_EXECUTION_EXTENSION_MISMATCH',
    )
    && siteRuntimeE2E.includes(
      'const controlBrowserExecution = projectExtensionDisabledControlBrowserExecution(',
    )
    && siteRuntimeE2E.includes('browserExecution: controlBrowserExecution')
    && siteRuntimeE2E.includes("extensionRuntime: 'none'"),
  'each Extension Chromium process must admit the exact extension-runtime leaf',
);
const attachNoFocusActivationOwner = extensionChromiumHarness.slice(
  extensionChromiumHarness.indexOf('async activateOwnedPageWithoutWindowFocus(page)'),
  extensionChromiumHarness.indexOf('async navigatePage(page, url'),
);
requireCondition(
  attachNoFocusActivationOwner.includes('chrome.tabs.update')
    && attachNoFocusActivationOwner.includes('windowFocusRequested: false')
    && !attachNoFocusActivationOwner.includes('chrome.windows.update'),
  'attach-only target activation must never turn tab activation into OS-window focus',
);
requireCondition(
  feedHorizonInspectionE2E.includes('inspectWindowsChromeForegroundState')
    && feedHorizonInspectionE2E.includes('QA_BROWSER_OS_FOCUS_PRESERVED')
    && feedHorizonInspectionE2E.includes('QA_BROWSER_OS_FOCUS_OBSERVED')
    && feedHorizonInspectionE2E.includes('QA_BROWSER_OS_FOCUS_CONTRACT_VIOLATION')
    && feedHorizonInspectionFocusTest.includes(
      'fails when scenario activation brings Chrome to the foreground',
    ),
  'Feed inspection must distinguish native focus observation from strict background preservation without requesting focus',
);
requireCondition(
  initialWindowFocusAnchorLease.includes('QaBrowserTargetLease')
    && initialWindowFocusAnchorLease.includes('createQaCdpPageTarget')
    && initialWindowFocusAnchorLease.includes('onOwnershipPrepared: async')
    && initialWindowFocusAnchorLease.includes('recoveryJournal.reserveTarget')
    && initialWindowFocusAnchorLease.includes('recoveryJournal.admitTarget')
    && initialWindowFocusAnchorLease.includes('recoveryJournal.releaseTarget')
    && initialWindowFocusAnchorLease.includes('minimizeWindowsChromeWindow')
    && initialWindowFocusAnchorLease.includes('inspectWindowsChromeForegroundState')
    && initialWindowFocusAnchorLease.includes('initialForegroundSideEffectAllowed: true')
    && initialWindowFocusAnchorLease.includes('initialFocusRequested: false')
    && runSession.includes("'initial_window_focus_anchor'")
    && !feedConsumptionResearchQaProtocol.includes(
      'new QaInitialWindowFocusAnchorLease',
    )
    && initialWindowFocusAnchorLeaseTest.includes(
      'owns, minimizes, proves, and closes exactly one first-window anchor',
    ),
  'the shared initial-window preparation must remain upper-session scoped, recovery-journaled, and exact-target cleaned; default background preparation minimizes',
);
requireCondition(
  attachedBrowserOsFocusGuard.includes('inspectWindowsChromeForegroundState')
    && attachedBrowserOsFocusGuard.includes(
      'QA_BROWSER_OS_FOCUS_BASELINE_FOREGROUND',
    )
    && attachedBrowserOsFocusGuard.includes(
      'QA_BROWSER_OS_FOCUS_CONTRACT_VIOLATION',
    )
    && attachedBrowserOsFocusGuardTest.includes(
      'proves the browser remains outside the foreground across bounded checkpoints',
    )
    && attachedBrowserOsFocusGuardTest.includes(
      'blocks a foreground baseline and any later focus acquisition',
    ),
  'attached Windows agent protocols must share a read-only fail-loud steady-state OS-focus guard',
);
requireCondition(
  feedConsumptionResearchSuite.includes(
    'directionality: point.observationDirectionality',
  )
    && feedConsumptionResearchSuite.includes(
      'metrics: point.feedDecisionDirectionality',
    )
    && feedConsumptionResearchAnalysis.includes('terminalTriggerOutcomeSeparated')
    && feedConsumptionResearchAnalysis.includes('resolveTriggerOutcome')
    && feedConsumptionResearchTest.includes(
      'uses full-journey trigger outcomes when aligned prefixes collide',
    )
    && feedConsumptionResearchQaTest.includes(
      "directionality_evidence_missing",
    ),
  'Feed research matrix projection must preserve directionality and distinguish aligned-prefix similarity from full-journey trigger collisions',
);
const extensionHarnessStartOwner = extensionChromiumHarness.slice(
  extensionChromiumHarness.indexOf('async start()'),
  extensionChromiumHarness.indexOf('async withTrustedPage(worker)'),
);
const extensionAttachCapacity = extensionHarnessStartOwner.indexOf(
  'this.browserCapacityLease = await acquireQaBrowserCapacity({',
);
const extensionAttachStage = extensionHarnessStartOwner.indexOf(
  'const staged = await stageEntropyQaArtifact({',
);
const extensionAttachOpen = extensionHarnessStartOwner.indexOf('await this.cdp.open();');
const extensionAttachIdentity = extensionHarnessStartOwner.indexOf(
  'await verifyExtensionHarnessAttachedBrowser(this.cdp',
  extensionAttachOpen,
);
const extensionAttachManagedLoad = extensionHarnessStartOwner.indexOf(
  'ensureManagedAttachedExtensionSlot(',
  extensionAttachIdentity,
);
const extensionHarnessReloadOwner = extensionChromiumHarness.slice(
  extensionChromiumHarness.indexOf('async reloadExtensionFromSource()'),
  extensionChromiumHarness.indexOf('async stopServiceWorker()'),
);
const managedArtifactSyncOwner = extensionChromiumHarness.slice(
  extensionChromiumHarness.indexOf('async synchronizeManagedAttachedArtifactRuntime('),
  extensionChromiumHarness.indexOf('async start()'),
);
requireCondition(
  extensionHarnessReloadOwner.includes('this.withExtensionManagementPage(')
    && extensionHarnessReloadOwner.includes('chrome.developerPrivate.reload(id,')
    && extensionHarnessReloadOwner.includes('EXTENSION_RELOAD_EXACT_ID_NOT_ACTIVE')
    && extensionHarnessReloadOwner.includes('if (loadError) throw new Error(')
    && extensionHarnessReloadOwner.includes('loadExtension: reloadExact')
    && extensionHarnessReloadOwner.includes('await this.waitForServiceWorkerExit(')
    && extensionHarnessReloadOwner.includes('await this.waitForServiceWorker(')
    && !extensionHarnessReloadOwner.includes('Extensions.loadUnpacked')
    && !extensionHarnessReloadOwner.includes('chrome.runtime.reload'),
  'extension reload must use the single exact Chrome reload operation, retain managed target protection and prove old-worker exit/replacement without re-registration or another strategy',
);
requireCondition(
  extensionAttachCapacity !== -1
    && extensionAttachStage > extensionAttachCapacity
    && extensionAttachOpen > extensionAttachStage
    && extensionAttachIdentity > extensionAttachOpen
    && extensionAttachManagedLoad > extensionAttachIdentity
    && extensionChromiumHarness.includes('expectedBrowserIdentity: this.expectedBrowserIdentity')
    && extensionChromiumHarness.includes('resolveBrowserQaPhysicalResourceIdentities({')
    && directHarnessProtocolSources.slice(1).every((source) => (
      !source.includes('stageEntropyQaArtifact({')
    ))
    && feedHorizonInspectionE2E.includes(
      'const attachedArtifactStage = managedAttach',
    )
    && feedHorizonInspectionE2E.includes(
      ': await stageEntropyQaArtifact({',
    )
    && extensionChromiumHarness.includes(
      "from './internal/managedAttachedExtensionSlot.mjs'",
    )
    && qaProfileArtifactSlot.includes("mutationPolicy: 'managed_atomic_sync'")
    && qaProfileArtifactSlot.includes('inputDigest: requireCanonicalString(')
    && qaProfileArtifactSlot.includes('contentIdentityDigest: contentIdentity.digest')
    && qaProfileArtifactSlot.includes("action: 'reused_exact_slot'")
    && qaProfileArtifactSlot.includes("action: contentIdentity ? 'staged_changed'")
    && qaProfileArtifactSlot.indexOf(
      'resolveEntropyQaArtifactActivationReceiptPath(slotDir)',
    ) < qaProfileArtifactSlot.indexOf(
      'await fs.cp(resolvedSourceDir, stagingDir',
    )
    && qaProfileArtifactSlot.includes('ENTROPY_QA_ARTIFACT_SOURCE_CHANGED_DURING_STAGE')
    && qaProfileArtifactSlot.includes('publishEntropyQaArtifactSlotTransaction({')
    && qaArtifactSlotTransaction.includes('let retired = false')
    && qaArtifactSlotTransaction.includes('let published = false')
    && qaArtifactSlotTransaction.includes('ENTROPY_QA_ARTIFACT_SLOT_PUBLISH_FAILED')
    && qaArtifactSlotTransaction.includes('ENTROPY_QA_ARTIFACT_SLOT_ROLLBACK_FAILED')
    && qaArtifactSlotTransaction.includes(
      'ENTROPY_QA_ARTIFACT_SLOT_TRANSACTION_RECOVERY_FAILED',
    )
    && qaArtifactSlotTransaction.includes("status: 'retired_slot_preserved'")
    && extensionHarnessStartOwner.includes('artifactIdentity: this.attachedArtifactStage.artifactIdentity')
    && extensionHarnessStartOwner.includes('reuseExisting: true')
    && managedArtifactSyncOwner.includes('reused_active_runtime')
    && managedArtifactSyncOwner.includes('runtimeRefresh = true')
    && managedArtifactSyncOwner.includes('await this.attachedArtifactRuntimeReadiness(')
    && managedArtifactSyncOwner.includes(
      "runtimeArtifactIdentity?.status !== 'artifact_runtime_identity_verified'",
    )
    && managedArtifactSyncOwner.includes(
      'this.attachedArtifactStage.artifactIdentity.buildId',
    )
    && managedArtifactSyncOwner.indexOf('await this.attachedArtifactRuntimeReadiness(')
      < managedArtifactSyncOwner.indexOf('await writeEntropyQaArtifactActivationReceipt({')
    && directHarnessProtocolSources.slice(1, 3).every((source) => (
      source.includes("browser.lifecyclePolicy === 'managed'")
      && source.includes(
        "attachedArtifactRuntimeReadiness: browser.lifecyclePolicy === 'managed'",
      )
      && !source.includes('await harness.reloadExtensionFromSource();')
    ))
    && humanSetupProtocol.includes("browser?.lifecyclePolicy !== 'managed'")
    && humanSetupProtocol.includes(
      'attachedArtifactRuntimeReadiness: proveEntropyAttachedArtifactRuntimeReadiness',
    )
    && !humanSetupProtocol.includes('await harness.reloadExtensionFromSource();')
    && feedHorizonInspectionE2E.includes(
      'const attachedArtifactStage = managedAttach',
    )
    && feedHorizonInspectionE2E.includes(
      'attachedArtifactRuntimeReadiness: managedAttach',
    )
    && extensionChromiumHarness.includes(
      'CHROMIUM_HARNESS_ARTIFACT_READINESS_WITHOUT_STAGE_FORBIDDEN',
    )
    && managedAttachedExtensionSlot.includes('managedSlotAction: \'loaded_exact_slot\'')
    && managedAttachedExtensionSlot.includes(
      "blocked('noncanonical_unpacked_extension_present')",
    )
    && managedAttachedExtensionSlotTest.includes(
      'blocks a noncanonical unpacked baseline before load mutation',
    )
    && managedAttachedExtensionSlotTest.includes('uninstallOnClose: false')
    && extensionChromiumHarness.includes("'managed_extension_load_anchor'")
    && extensionChromiumHarness.includes(
      'anchorTarget = await createQaCdpPageTarget(this.cdp, {',
    )
    && extensionChromiumHarness.includes('findUnexpectedPageTargets(')
    && extensionChromiumHarness.includes(
      "managedExtensionLoadTargetBlocked(\n            'postload_page_delta'",
    )
    && extensionChromiumHarness.includes(
      'await this.releaseOwnedTarget(anchorTarget.targetId);',
    )
    && !extensionChromiumHarness.includes("'managed_extension_load_page'")
    && extensionHarnessReloadOwner.includes(
      'this.runManagedAttachedExtensionLoadMutation(reload, { loadExtension: reloadExact })',
    )
    && extensionHarnessReloadOwner.includes('await this.waitForServiceWorkerExit(')
    && extensionHarnessReloadOwner.includes('await this.waitForServiceWorker({ previousTargetId:')
    && !extensionHarnessReloadOwner.includes('chrome.runtime.reload()')
    && extensionChromiumHarnessTest.includes(
      'creates and closes one exact owned anchor for every managed load mutation',
    )
    && extensionChromiumHarnessTest.includes(
      'preserves and blocks an openerless blank page created during managed load',
    )
    && extensionChromiumHarnessTest.includes(
      'closes a causally owned anchor even if it navigates after managed load',
    )
    && extensionChromiumHarnessTest.includes(
      'blocks pre-load page drift before mutation and preserves that page',
    )
    && extensionChromiumHarnessTest.includes(
      'cleans the exact owned anchor when the managed load command fails',
    )
    && extensionChromiumHarnessTest.includes(
      'aggregates managed load and exact anchor cleanup failures without losing ownership',
    )
    && extensionChromiumHarnessTest.includes(
      'reuses only an integrity-checked managed slot with the exact content identity',
    )
    && extensionChromiumHarnessTest.includes(
      'blocks an untrusted malformed content receipt instead of silently replacing it',
    )
    && extensionChromiumHarnessTest.includes(
      'skips managed runtime reload only for the exact browser-epoch activation receipt',
    )
    && extensionChromiumHarnessTest.includes(
      'does not commit managed activation when canonical runtime readiness fails',
    )
    && extensionChromiumHarnessTest.includes(
      'rejects router readiness from a runtime serving the wrong artifact identity',
    )
    && extensionChromiumHarnessTest.includes(
      'restores the exact retired artifact slot when publish rename fails',
    )
    && extensionChromiumHarnessTest.includes(
      'preserves retired artifact evidence and reports both failures when rollback fails',
    ),
  'Extension attach must sync one identity-receipted managed artifact under endpoint/user-data-root capacity, prove runtime readiness before activation commit, and leave external attach discovery-only',
);
const extensionOwnedLaunch = extensionChromiumHarness.indexOf(
  'this.chrome = launchChrome({',
);
const extensionOwnedOpen = extensionChromiumHarness.indexOf(
  'await this.cdp.open();',
  extensionOwnedLaunch,
);
const extensionOwnedIdentity = extensionChromiumHarness.indexOf(
  'await verifyQaOwnedChromiumEndpointIdentity(',
  extensionOwnedOpen,
);
const extensionOwnedFirstMutation = extensionChromiumHarness.indexOf(
  'probeQaBrowserGpuCapability(this.cdp',
  extensionOwnedOpen,
);
const extensionOwnedCleanup = extensionChromiumHarness.slice(
  extensionChromiumHarness.indexOf('async close()'),
  extensionChromiumHarness.indexOf('export async function launchExtensionChromiumHarness'),
);
requireCondition(
  extensionOwnedLaunch !== -1
    && extensionOwnedOpen > extensionOwnedLaunch
    && extensionOwnedIdentity > extensionOwnedOpen
    && extensionOwnedFirstMutation > extensionOwnedIdentity
    && extensionChromiumHarness.includes("'--enable-automation'")
    && extensionOwnedCleanup.includes('this.ownedBrowserIdentityVerified')
    && extensionOwnedCleanup.indexOf('this.ownedBrowserIdentityVerified')
      < extensionOwnedCleanup.indexOf("this.cdp.send('Browser.close'"),
  'owned Extension Chrome must prove its exact spawned endpoint before mutation or Browser.close',
);
const mv3LifecycleWrapper = await read('scripts/e2e/mv3LifecycleE2E.mjs');
const cwsRuntimeHarness = await read('scripts/perf/measureCwsRuntime.mjs');
const cwsHistoryCleanupLifecycleScenario = await read(
  'scripts/perf/cwsHistoryCleanupLifecycleScenario.mjs',
);
const cwsServiceWorkerDiagnostics = await read('scripts/perf/cwsServiceWorkerDiagnostics.mjs');
const cwsServiceWorkerColdQuiescence = await read(
  'scripts/perf/cwsServiceWorkerColdQuiescence.mjs',
);
const cwsCdpConnection = await read('scripts/perf/cwsCdpConnection.mjs');
const browserQaCdpConnection = await read(
  'scripts/browser-qa/cdp/CdpConnection.mjs',
);
const cwsChromeRuntime = await read('scripts/perf/cwsChromeRuntime.mjs');
const cwsVisualPresentation = await read('scripts/perf/cwsVisualPresentation.mjs');
const cwsWakeContract = await read('scripts/perf/cwsServiceWorkerWakeContract.mjs');
const cwsServiceWorkerDiagnosticsTest = await read('tests/cwsServiceWorkerDiagnostics.test.js');
const cwsServiceWorkerColdQuiescenceTest = await read(
  'tests/cwsServiceWorkerColdQuiescence.test.js',
);
const cwsCdpConnectionTest = await read('tests/cwsCdpConnection.test.js');
const browserQaCdpConnectionTest = await read(
  'tests/browserQaCdpConnection.test.js',
);
const extensionCdpConnectionAdapterTest = await read(
  'tests/extensionCdpConnectionAdapter.test.js',
);
const cwsChromeRuntimeTest = await read('tests/cwsChromeRuntime.test.js');
const cwsVisualPresentationTest = await read('tests/cwsVisualPresentation.test.js');
const cwsWakeContractTest = await read('tests/cwsServiceWorkerWakeContract.test.js');
const mv3LifecycleDoc = await read('docs/operations/qa/mv3-lifecycle-e2e.md');
const cwsRuntimeDoc = await read('docs/operations/qa/cws-runtime-measurement.md');
requireCondition(
  extensionChromiumHarness.includes("from './chromiumHarnessTempCleanup.mjs'")
    && cwsChromeRuntime.includes("from '../e2e/chromiumHarnessTempCleanup.mjs'"),
  'owned Chromium harnesses must share one bounded temp-root cleanup seam',
);
requireCondition(
  mv3LifecycleWrapper.includes("'scripts/perf/measureCwsRuntime.mjs'")
    && !mv3LifecycleWrapper.includes('acquireQaBrowserCapacity')
    && mv3LifecycleWrapper.includes('resolveEffectiveHeadless(effectiveBrowserArgs)')
    && mv3LifecycleWrapper.includes("arg === '--headed-software-gl'"),
  'MV3 wrapper must delegate browser capacity to its CWS browser owner instead of deadlocking on a nested lease',
);
const cwsRuntimeMain = cwsRuntimeHarness.slice(
  cwsRuntimeHarness.indexOf('async function main()'),
  cwsRuntimeHarness.indexOf('const PAGE_PERFORMANCE_PROBE_SOURCE'),
);
const cwsRuntimeConfiguration = cwsRuntimeHarness.slice(
  cwsRuntimeHarness.indexOf('async function configureExtension('),
  cwsRuntimeHarness.indexOf('async function collectHarnessSnapshot('),
);
const cwsRuntimeCleanup = cwsRuntimeHarness.slice(
  cwsRuntimeHarness.indexOf('async function cleanupCwsRuntime('),
  cwsRuntimeHarness.indexOf('async function main()'),
);
requireCondition(
  cwsRuntimeMain.indexOf('try {') < cwsRuntimeMain.indexOf('createCwsRuntimeTempRoots(')
    && cwsRuntimeMain.includes('cleanupCwsRuntime({')
    && cwsRuntimeMain.includes('browserCapacityLease.release()')
    && cwsRuntimeMain.includes('displayLease?.release()')
    && cwsRuntimeCleanup.includes('cleanupOwnedCwsRuntimeTempRoots({'),
  'CWS initialization and owned-root cleanup must share the main try/finally boundary',
);
const cwsOwnedOpen = cwsRuntimeMain.indexOf('await cdp.open();');
const cwsOwnedIdentity = cwsRuntimeMain.indexOf(
  'await verifyQaOwnedChromiumEndpointIdentity(chrome, cdp);',
);
const cwsOwnedFirstMutation = cwsRuntimeMain.indexOf("cdp.send('SystemInfo.getInfo')");
requireCondition(
  cwsOwnedOpen !== -1
    && cwsOwnedIdentity > cwsOwnedOpen
    && cwsOwnedFirstMutation > cwsOwnedIdentity
    && cwsRuntimeHarness.includes("'--enable-automation'")
    && cwsRuntimeCleanup.includes('ownedBrowserIdentityVerified === true')
    && cwsRuntimeCleanup.indexOf('ownedBrowserIdentityVerified === true')
      < cwsRuntimeCleanup.indexOf("cdp.send('Browser.close'"),
  'CWS owned Chrome must prove its exact spawned endpoint before mutation or Browser.close',
);
requireCondition(
  (cwsRuntimeConfiguration.match(/waitForPropagation: true/gu) || []).length === 2
    && cwsRuntimeConfiguration.includes('SET_SETTINGS propagation incomplete')
    && cwsRuntimeConfiguration.includes('UPSERT_SITE_RULE propagation incomplete')
    && cwsRuntimeHarness.includes('accumulateCwsWorkerRevivalEvidence(')
    && cwsRuntimeHarness.includes('includeGlobalContentRuntimeDiagnostics: true')
    && cwsRuntimeHarness.includes('globalContentRuntimeDiagnostics')
    && cwsWakeContract.includes('accumulateCwsWorkerRevivalEvidence')
    && cwsWakeContract.includes('runtimeProbeRecoveredEvent')
    && cwsWakeContract.includes("event?.event === 'existing_runtime_probe_recovered'")
    && cwsWakeContract.includes(
      'snapshot?.globalContentRuntimeDiagnostics?.snapshot?.events',
    )
    && cwsWakeContractTest.includes(
      'latches same-build runtime-probe recovery as worker-revival continuity evidence',
    )
    && cwsRuntimeHarness.includes("'retained_session'")
    && cwsRuntimeHarness.includes('MV3_LIFECYCLE_CATCH_UP_READINESS_FAILED'),
  'CWS lifecycle setup must await terminal settings propagation and admit retained-session, same-build probe recovery, or loader reinjection only after successful global catch-up',
);
[
  "wakeSamples: 3",
  'dashboardVisualSamples: 1',
  'thresholdSampleFloor = 20',
  'projectCwsWakeRuntimeContract(sample)',
  'sample.runtimeContract = runtimeContract',
  'workerDiagnostics?.collectorErrors?.length === 0',
  'summarizeCwsWakeLatencies(',
  "schemaVersion: 3",
  'failures: [',
  "wakeMeasurement?.status === 'failed' && !wakeMeasurement?.summary",
  'diagnosticsAttachedAtEpochMs',
  'timedPairDispatchAtHostEpochMs',
  'timedPairCompletedAtHostEpochMs',
  'warmRequestSentAtEpochMs',
  'warmResponseAtEpochMs',
  'const messageTransport = await openTarget(',
  '{ messageSessionId: messageTransport.sessionId }',
  'CWS_PAGE_READINESS_SNAPSHOT_EXPRESSION',
  'previousReadinessSnapshot = await waitForPageReady(',
  'previousDocumentGeneration: previousReadinessSnapshot.documentGeneration',
  'presentCwsVisualTarget(cdp, dashboard);',
  'requireVisible: true',
  'initialDocumentReadiness,',
  'initialPresentationEvidence:',
  'dashboard.presentationEvidence,',
  'attachDashboardVisualAdmissionDiagnostics(error, {',
  'presentationEvidence,',
  'documentReadiness:',
  'completedVisualSampleReadiness,',
  'beforeReload:',
  'afterReload:',
  'projectCwsPageReadyTimeoutDiagnostics({',
  'CWS_PAGE_READY_TIMEOUT:',
  '--require-dashboard-visual-threshold',
  'releaseThresholdEligible',
  'SystemInfo.getInfo',
  '--browser-profile-dir=',
  'terminateQaOwnedChromiumProcess',
  'ownsBrowserProfileRoot',
  'cleanupOwnedCwsRuntimeTempRoots',
  "from './cwsCdpConnection.mjs'",
  "from './cwsServiceWorkerColdQuiescence.mjs'",
  'quiesceCwsServiceWorkerBeforeColdProbe({',
  'coldQuiescence: stoppedTarget.coldQuiescence',
  'CWS_MEASUREMENT_EXTENSION_PUBLIC_KEY',
  'manifest.key = CWS_MEASUREMENT_EXTENSION_PUBLIC_KEY',
  'additionalExtensionDirs: controllerExtensionDir ? [controllerExtensionDir] : []',
  "lifecycleControllerInstall.installMode !== 'command_line'",
  'MV3_LIFECYCLE_CONTROLLER_COMMAND_LINE_OWNERSHIP_REQUIRED',
].forEach((token) => {
  requireCondition(
    cwsRuntimeHarness.includes(token),
    `CWS lifecycle harness missing wake measurement/report contract: ${token}`,
  );
});
requireCondition(
  cwsHistoryCleanupLifecycleScenario.includes("extensionApiProfile: 'history_controller'")
    && cwsServiceWorkerDiagnostics.includes("extensionApiProfile === 'history_controller'")
    && cwsServiceWorkerDiagnosticsTest.includes(
      "extensionApiProfile: 'history_controller'",
    ),
  'CWS history controller must use its narrow history/management page-readiness profile',
);
const cwsOpenTargetOwner = cwsRuntimeHarness.slice(
  cwsRuntimeHarness.indexOf('async function openTarget('),
  cwsRuntimeHarness.indexOf('async function navigateTarget('),
);
const cwsDashboardVisualOwner = cwsRuntimeHarness.slice(
  cwsRuntimeHarness.indexOf('async function runDashboardColdReloadScenario('),
  cwsRuntimeHarness.indexOf('function diffMetric('),
);
const cwsDashboardReloadActivationIndex = cwsDashboardVisualOwner.indexOf(
  'await presentCwsVisualTarget(cdp, dashboard);',
);
const cwsDashboardPreReloadReadinessIndex = cwsDashboardVisualOwner.indexOf(
  'previousReadinessSnapshot = await waitForPageReady(',
);
const cwsDashboardColdQuiescenceIndex = cwsDashboardVisualOwner.indexOf(
  'stoppedTarget = await stopExtensionServiceWorker(',
);
const cwsDashboardReloadIndex = cwsDashboardVisualOwner.indexOf(
  "await cdp.send('Page.reload', { ignoreCache: false }, dashboard.sessionId);",
);
const cwsDashboardPostQuiescenceBeforeReload = cwsDashboardVisualOwner.slice(
  cwsDashboardColdQuiescenceIndex,
  cwsDashboardReloadIndex,
);
requireCondition(
  cwsOpenTargetOwner.includes('visualPresentation = false')
    && cwsOpenTargetOwner.includes(
      'await presentCwsVisualTarget(cdp, { targetId, sessionId });',
    )
    && cwsOpenTargetOwner.indexOf('await presentCwsVisualTarget(')
      > cwsOpenTargetOwner.indexOf("cdp.send('Target.attachToTarget'")
    && cwsOpenTargetOwner.indexOf('await presentCwsVisualTarget(')
      < cwsOpenTargetOwner.indexOf('let readinessSnapshot')
    && cwsDashboardVisualOwner.includes('visualPresentation: true')
    && (cwsRuntimeHarness.match(/visualPresentation: true/g) || []).length === 1
    && cwsDashboardVisualOwner.includes('await presentCwsVisualTarget(cdp, dashboard);')
    && (cwsDashboardVisualOwner.match(/requireVisible: true/g) || []).length >= 3
    && cwsDashboardVisualOwner.includes('initialDocumentReadiness,')
    && cwsDashboardVisualOwner.includes('documentReadiness:')
    && cwsDashboardVisualOwner.includes('completedVisualSampleReadiness,')
    && cwsDashboardVisualOwner.includes("lifecyclePhase: 'dashboard_visual_page_admission'")
    && cwsDashboardVisualOwner.includes("lifecyclePhase: 'dashboard_visual_cold_quiescence'")
    && cwsDashboardVisualOwner.includes(
      "lifecyclePhase: 'dashboard_visual_reload_page_admission'",
    )
    && cwsDashboardReloadActivationIndex >= 0
    && cwsDashboardReloadActivationIndex < cwsDashboardPreReloadReadinessIndex
    && cwsDashboardPreReloadReadinessIndex < cwsDashboardColdQuiescenceIndex
    && cwsDashboardColdQuiescenceIndex < cwsDashboardReloadIndex
    && !cwsDashboardPostQuiescenceBeforeReload.includes('presentCwsVisualTarget(')
    && !cwsDashboardPostQuiescenceBeforeReload.includes('waitForPageReady('),
  'CWS dashboard visual samples must present the owning window/page, admit only visible documents, and retain generation evidence',
);
[
  "cdp.send('Browser.getWindowForTarget', { targetId })",
  "cdp.send('Browser.setWindowBounds'",
  "bounds: { windowState: NORMAL_WINDOW_STATE }",
  "cdp.send('Browser.getWindowBounds', { windowId })",
  "cdp.send('Target.activateTarget', { targetId })",
  "cdp.send('Page.bringToFront', {}, sessionId)",
  'CWS_VISUAL_PRESENTATION_WINDOW_ID_INVALID',
  'CWS_VISUAL_PRESENTATION_WINDOW_STATE_INVALID',
  'CWS_VISUAL_PRESENTATION_WINDOW_RESTORE_FAILED',
  'finalWindowState,',
  'restored,',
].forEach((token) => {
  requireCondition(
    cwsVisualPresentation.includes(token),
    `CWS visual presentation owner missing window/page admission contract: ${token}`,
  );
});
[
  'activates and fronts a target whose %s window is already presentable',
  'restores a minimized window before activating and fronting its page',
  'fails presentation when a minimized window restores to %s',
  'fails before presentation commands when Chrome omits a bounded window id',
  'fails before presentation commands when Chrome reports window state %s',
  'rejects an incomplete visual target identity',
].forEach((token) => {
  requireCondition(
    cwsVisualPresentationTest.includes(token),
    `CWS visual presentation test missing deterministic case: ${token}`,
  );
});
[
  'CWS_SERVICE_WORKER_COLD_QUIET_WINDOW_MS = 100',
  'CWS_SERVICE_WORKER_COLD_QUIESCENCE_TIMEOUT_MS = 8_000',
  'CWS_SERVICE_WORKER_COLD_POLL_INTERVAL_MS = 25',
  'export async function quiesceCwsServiceWorkerBeforeColdProbe',
  'state.closedTargetIds.has(targetId)',
  'state.quietSinceEpochMs = null',
  'CWS_SERVICE_WORKER_COLD_QUIESCENCE_TIMEOUT',
  'recentObservedTargetIds',
  'lastClosedTarget: state.lastClosedTarget',
].forEach((token) => {
  requireCondition(
    cwsServiceWorkerColdQuiescence.includes(token),
    `CWS cold-quiescence owner missing bounded stop contract: ${token}`,
  );
});
[
  'closes every pre-probe successor and returns only after a continuous quiet window',
  'does not mistake the first different successor for a stopped worker',
  'fails continuous reactivation at the deadline with bounded target diagnostics',
  'fails loudly when an observed successor cannot be closed',
  "'worker-auto-revived'",
  'recentObservedTargetIds).toHaveLength(20)',
].forEach((token) => {
  requireCondition(
    cwsServiceWorkerColdQuiescenceTest.includes(token),
    `CWS cold-quiescence test missing deterministic case: ${token}`,
  );
});
[
  'export function isWslWindowsChromeExecutable',
  'export function resolveChromeLaunchPaths',
  'export function getWslWindowsFreePort',
  'export function buildWindowsChromeProfileArgumentPattern',
  'export async function cleanupOwnedCwsRuntimeTempRoots',
  'export async function createCwsRuntimeTempRoots',
  'ownsBrowserProfileRoot: false',
  'CWS_MEASUREMENT_EXTENSION_ID',
  'deriveChromeExtensionIdFromPublicKey',
  'export function projectChromeGraphicsInfo',
  'projectQaBrowserGpuCapability',
].forEach((token) => {
  requireCondition(
    cwsChromeRuntime.includes(token),
    `CWS Chrome runtime owner missing cross-OS/profile/GPU contract: ${token}`,
  );
});
requireCondition(
  chromiumProcessOwner.includes('buildWindowsChromiumSwitchArgumentPattern')
    && chromiumProcessOwner.includes('browser-qa-owner-token')
    && chromiumProcessOwner.includes('terminateWslWindowsQaChromiumByIdentity')
    && cwsRuntimeCleanup.includes('terminateQaOwnedChromiumProcess')
    && !extensionChromiumHarness.includes('.IndexOf($target')
    && !cwsChromeRuntime.includes('Stop-Process'),
  'owned Windows Chrome cleanup must use the neutral exact owner-token process boundary',
);
[
  'recognizes only a Windows executable reached through WSL',
  'never owns or deletes a caller-provided reusable profile',
  'cleans only harness-owned roots and never a caller-owned reusable profile',
  'cleans a separately owned implicit profile before its extension temp root',
  'cleans a partially-created owned temp root when profile initialization fails',
  'pins the harness public key to the reusable-profile extension id',
  'matches only the exact Chrome user-data-dir argument boundary',
  'classifies hardware, software, and missing GPU evidence without guessing',
  'Microsoft Basic Render Driver',
  'unknown active renderer',
  'unknown virtual adapter',
].forEach((token) => {
  requireCondition(
    cwsChromeRuntimeTest.includes(token),
    `CWS Chrome runtime test missing deterministic case: ${token}`,
  );
});
[
  'CdpConnection as BrowserQaCdpConnection',
  'extends BrowserQaCdpConnection',
  'DEFAULT_CWS_CDP_REQUEST_TIMEOUT_MS = 30_000',
  'CWS_CDP_REQUEST_TIMEOUT',
  'CWS_CDP_WEBSOCKET_CLOSED',
  'method=${method}',
  "session=${sessionId || 'browser'}",
].forEach((token) => {
  requireCondition(
    cwsCdpConnection.includes(token),
    `CWS CDP compatibility adapter missing transport contract: ${token}`,
  );
});
requireCondition(
  !cwsCdpConnection.includes('new this.WebSocketImpl')
    && !cwsCdpConnection.includes('this.pending = new Map()')
    && !cwsCdpConnection.includes("addEventListener('message'"),
  'CWS CDP compatibility adapter must not own a second WebSocket state machine',
);
[
  'DEFAULT_BROWSER_QA_CDP_OPEN_TIMEOUT_MS = 10_000',
  'DEFAULT_BROWSER_QA_CDP_REQUEST_TIMEOUT_MS = 30_000',
  'setOpenTimeout',
  'clearPending(requestId)',
  'rejectAllPending',
  'handleMalformedMessage(cause)',
  'BROWSER_QA_CDP_WEBSOCKET_OPEN_TIMEOUT',
  'BROWSER_QA_CDP_WEBSOCKET_CLOSED',
  'localClose: true',
].forEach((token) => {
  requireCondition(
    browserQaCdpConnection.includes(token),
    `Browser QA CDP owner missing bounded transport contract: ${token}`,
  );
});
[
  'fails a WebSocket that never opens within the shared transport bound',
  'fails a missing transport response within the request bound with method/session diagnostics',
  'clears the request timer when a result settles the command',
  'clears the request timer and retains command identity on a protocol error',
  'clears every timer and rejects each pending method when the socket closes',
].forEach((token) => {
  requireCondition(
    cwsCdpConnectionTest.includes(token),
    `CWS CDP test missing deterministic case: ${token}`,
  );
});
[
  'bounds WebSocket open and removes every opening listener on timeout',
  'rejects pending work and clears timers on local close without a close event',
  'retains exact request identity when the remote socket closes',
  'terminally closes a corrupted protocol stream before another request',
].forEach((token) => {
  requireCondition(
    browserQaCdpConnectionTest.includes(token),
    `Browser QA CDP test missing deterministic case: ${token}`,
  );
});
[
  'maps the shared bounded-open failure to the harness error surface',
  'retains envelope subscriptions and command timeout messages',
].forEach((token) => {
  requireCondition(
    extensionCdpConnectionAdapterTest.includes(token),
    `Extension CDP adapter test missing deterministic case: ${token}`,
  );
});
[
  'export class ServiceWorkerCdpDiagnostics',
  'instrumentationMode: this.pauseWorkerOnStart',
  "'non_pausing_measurement'",
  "type: 'service_worker'",
  'Runtime.runIfWaitingForDebugger',
  'export const CWS_PAGE_READINESS_SNAPSHOT_EXPRESSION',
  'export function isCwsPageReadinessSnapshotReady',
  'Number(globalThis.performance?.timeOrigin)',
  'documentGeneration <= Number.MAX_SAFE_INTEGER',
  'documentGeneration === normalizedPreviousGeneration',
  "['hidden', 'visible'].includes(rawVisibilityState)",
  "normalizePageVisibilityState(snapshot?.visibilityState) !== 'visible'",
  'export function projectCwsPageReadyTimeoutDiagnostics',
  'priorDocumentGeneration:',
  'currentDocumentGeneration:',
  "expectedProtocol !== 'chrome-extension:'",
  'extensionApis?.storageSession === true',
].forEach((token) => {
  requireCondition(
    cwsServiceWorkerDiagnostics.includes(token),
    `CWS service-worker diagnostics owner missing collection contract: ${token}`,
  );
});
[
  'starts non-pausing measurement without attaching to or enabling the worker runtime',
  'attaches once for a read and deduplicates repeated attached events',
  'clears detached state when the same target is reattached and reads telemetry',
  'pause mode auto-attaches only service workers and resumes every waiting worker',
  'rejects about:blank even when its document is complete',
  'rejects a committed extension page while harness APIs are unavailable',
  'accepts the canonical committed extension harness page with required APIs',
  'keeps visibility admission opt-in for non-visual harness lanes',
  'admits a visual page only when bounded visibility is explicitly visible',
  'rejects a same-URL reload snapshot while its document generation is unchanged',
  'accepts a same-URL reload snapshot only after its document generation changes',
  'rejects page readiness without a finite bounded document generation',
  'projects prior and current document generations into page-ready timeout diagnostics',
].forEach((token) => {
  requireCondition(
    cwsServiceWorkerDiagnosticsTest.includes(token),
    `CWS service-worker diagnostics test missing deterministic case: ${token}`,
  );
});
[
  "from '../../src/platform/messaging/messageTypes.js'",
  'calculateCwsNearestRankPercentile',
  "typeof value === 'number' && Number.isFinite(value)",
  'MESSAGE_ACTION_INVALID:${label}',
  'PAGE_TIMED_PAIR_ORDER_INVALID',
  'HOST_TARGET_OBSERVATION_WINDOW_INVALID',
  'HOST_DIAGNOSTICS_PERTURBED_TIMED_PAIR',
  'MILESTONE_NOT_READY:',
  'RUNTIME_MESSAGES_DROPPED',
  'projectCwsDashboardVisualFirstFrameSample',
  'summarizeCwsDashboardVisualFirstFrames',
  'projectCwsDashboardVisualEvidence',
  "'headed_hardware'",
  'releaseThresholdEligible',
].forEach((token) => {
  requireCondition(
    cwsWakeContract.includes(token),
    `CWS wake contract missing fail-closed token: ${token}`,
  );
});
requireCondition(
  !cwsWakeContract.includes(
    'timing.requestSentAtEpochMs,\n    timing.targetObservedAtEpochMs',
  )
    && cwsWakeContract.includes(
      'timing.targetObservedAtEpochMs < timing.timedPairDispatchAtHostEpochMs',
    )
    && cwsWakeContract.includes(
      'timing.diagnosticsAttachedAtEpochMs < timing.timedPairCompletedAtHostEpochMs',
    ),
  'CWS wake ordering must keep page and Node-host clock domains separate',
);
[
  "toBe(10)",
  "toBe(19)",
  "[null, undefined, '4']",
  "action: 'OTHER_ACTION'",
  'sequence: 3',
  'admits ten non-degraded dashboard frames and summarizes strict visual p95',
  'rejects degraded or forced dashboard frames instead of timing them as visual success',
  'promotes only headed hardware evidence into a release visual threshold',
  'keeps page and host order valid with $label',
  'host clock ahead of the page realm',
  'host clock behind the page realm',
  'target observed before host dispatch',
  'target observed after the host evaluate completed',
  'CDP diagnostics attached before the timed pair completed',
  'page response precedes its page request',
].forEach((token) => {
  requireCondition(
    cwsWakeContractTest.includes(token),
    `CWS wake contract test missing deterministic case: ${token}`,
  );
});
[
  '--wake-samples=<count>',
  '--pause-worker-on-start',
  '20 non-pausing samples',
  'Only external',
  'opened before each measurement',
  '`about:blank`',
  '`chrome.runtime.sendMessage`',
  '`chrome.storage.local/session`',
  '`performance.timeOrigin`',
  '`document.visibilityState`',
  '`Browser.getWindowForTarget`',
  '`Browser.getWindowBounds`',
  '`Page.bringToFront`',
  '`documentReadiness`',
  'visual-lane-only',
  '`priorDocumentGeneration`',
  '`currentDocumentGeneration`',
  '--dashboard-visual-samples=10',
  '--require-nondegraded-dashboard-frame',
  '--require-dashboard-visual-threshold',
  '--browser-profile-dir=',
  '`releaseThresholdEligible=true`',
  '`--headed-software-gl`',
  '30-second transport-response',
  '`amciafhohbkbchlofkghlokclochehko`',
  'secondary Microsoft Basic Render Driver',
  '`timedPairDispatchAtHostEpochMs`',
  '`timedPairCompletedAtHostEpochMs`',
  'clock domain',
  '100ms continuous no-worker',
  '`CWS_SERVICE_WORKER_COLD_QUIESCENCE_TIMEOUT`',
  'last closed target id',
].forEach((token) => {
  requireCondition(
    mv3LifecycleDoc.includes(token) || cwsRuntimeDoc.includes(token),
    `MV3/CWS Active docs missing wake measurement policy: ${token}`,
  );
});

const legacyFeedLauncher = await read('scripts/e2e/feedHorizonQa.mjs');
[
  "from 'node:child_process'",
  'build:bundle',
  'normalizeChromiumHarnessCdpEndpoint',
  'globalThis.fetch',
].forEach((forbiddenText) => {
  requireCondition(
    !legacyFeedLauncher.includes(forbiddenText),
    `legacy Feed QA adapter retained retired ownership: ${forbiddenText}`,
  );
});
requireCondition(
  legacyFeedLauncher.includes('runQaTarget'),
  'legacy Feed QA adapter must delegate to the control plane',
);

const feedProtocol = await read('scripts/qa/protocols/feedHorizonQaProtocol.mjs');
requireCondition(
  !feedProtocol.includes('chunk.includes(marker)')
    && feedProtocol.includes('QA_FEED_AGENT_COMPLETION_CONTRACT_INVALID')
    && feedProtocol.includes('QA_FEED_AGENT_GATE_CONTRACT_INVALID')
    && feedProtocol.includes('AGENT_GATE_COMPLETE')
    && feedProtocol.includes("Object.hasOwn(plan.parameters, 'holdMs')")
    && feedProtocol.includes('holdCompleted'),
  'Feed QA completion must distinguish structured inspection and production-gate evidence',
);
requireCondition(
  feedProtocol.includes('{ requireCompleteRetention: !productionGateExpected }')
    && feedProtocol.includes('retainedCount + droppedCount === eligibleDwellCount')
    && feedProtocol.includes('retainedCount / eligibleDwellCount')
    && feedProtocol.includes('retainedActiveDwellMs < totalActiveDwellMs')
    && feedProtocol.includes('distributionTotal === eligibleDwellCount'),
  'Feed QA must preserve complete ordinary canaries and admit only consistent ordered-tail overflow for long natural-gate runs',
);

const feedInspectionRunner = await read('scripts/e2e/feedHorizonInspectionE2E.mjs');
const feedCausalRunner = await read('scripts/e2e/feedHorizonCausalE2E.mjs');
requireCondition(
  feedProtocol.includes('createBrowserExecutionEnvironment(plan.browserExecution)')
    && qaBrowserChildExecutionContract.includes(
      'export function admitQaAttachedExtensionBrowserChildExecution',
    )
    && qaBrowserChildExecutionContract.includes(
      'QA_BROWSER_CHILD_ATTACH_START_POLICY_INVALID',
    )
    && feedInspectionRunner.includes(
      'admitQaAttachedExtensionBrowserChildExecution(',
    )
    && feedInspectionRunner.includes('browserExecution: options.browserExecution')
    && feedInspectionRunner.includes('audioPolicy: options.audioPolicy')
    && feedInspectionRunner.includes(
      'renderingRequirement: options.renderingRequirement',
    )
    && feedInspectionRunner
      .split('artifactSync: harness.attachedArtifactSyncReceipt').length === 5
    && feedInspectionRunner.includes('rootDir,')
    && !feedInspectionRunner.includes("rootDir: '/'"),
  'Feed child must preserve and admit the complete attach execution contract',
);
const productionGateBranch = feedInspectionRunner.slice(
  feedInspectionRunner.indexOf('if (options.gateDriveMs > 0)'),
  feedInspectionRunner.indexOf('const canary = await runControlCommand({'),
);
requireCondition(
  feedInspectionRunner.includes('if (options.gateDriveMs > 0)')
    && productionGateBranch.includes('runFeedHorizonProductionCausalChain({')
    && productionGateBranch.includes("status: 'AGENT_GATE_COMPLETE'")
    && productionGateBranch.includes('return;'),
  'natural-gate QA must finish the production causal chain before the feedback-only branch',
);
requireCondition(
  feedCausalRunner.includes('export function projectNaturalGateMilestone(feedFlow)')
    && feedCausalRunner.includes('FEED_HORIZON_E2E_CANONICAL_GATE_DECISION_REQUIRED')
    && feedCausalRunner.includes('observeNaturalGateMilestones(')
    && feedCausalRunner.includes('naturalGateObservation,\n      feedFlow,'),
  'production causal QA must preserve canonical armed/opportunity/seam decision evidence',
);
const productionBackwardBranch = feedCausalRunner.slice(
  feedCausalRunner.indexOf('backwardAction = await runTrustedFeedStep({'),
  feedCausalRunner.indexOf('backwardNavigation = await waitForFeedState({'),
);
requireCondition(
  productionBackwardBranch.includes('backwardAction = await runTrustedFeedStep({')
    && productionBackwardBranch.includes("direction: 'backward',")
    && productionBackwardBranch.includes('collectOracle: false,')
    && !feedCausalRunner.includes(
      "dispatchKey(harness, page, 'ArrowUp', 'ArrowUp', 38)",
    )
    && feedCausalRunner.includes('neutralMorphology = await readEndpointMorphology')
    && feedCausalRunner.includes('neutralMorphology?.gateCount === 0')
    && feedCausalRunner.includes('backwardMorphology?.exactOrder === true')
    && feedCausalRunner.includes('backwardAdvanceCountUnchanged')
    && feedCausalRunner.includes('backward_navigation_trusted_input_not_performed')
    && feedCausalRunner.includes('backward_navigation_fabricated_forward_advance')
    && feedCausalRunner.includes('backward_navigation_did_not_move_native_scroller')
    && feedInspectionRunner.includes(
      'backwardNavigation: causalChain.backwardNavigation?.evidence || null',
    )
    && feedProtocol.includes("'backwardTrustedInputPerformed'")
    && feedProtocol.includes("'backwardAdvanceCountUnchanged'")
    && feedProtocol.includes("backward?.direction === 'backward'")
    && feedProtocol.includes('backward?.oracleRecoveryUsed === false'),
  'production causal QA must use one oracle-free native backward gesture and prove neutral-baseline state, morphology, movement, and advance invariance',
);
requireCondition(
  feedCausalRunner.includes("siteId === 'instagram'")
    && feedCausalRunner.includes(
      "targetSelector: 'main[role=\"main\"] div:has(> article)'",
    )
    && feedCausalRunner.includes(
      'collectScrollEvidence: true',
    )
    && feedCausalRunner.includes('rootDelta=${String(action.scrollEvidence.rootDelta)}')
    && feedCausalRunner.includes(
      'ownerCandidateDelta=${String(action.scrollEvidence.scrollOwnerCandidateDelta)}',
    )
    && siteRuntimeBrowser.includes('buildTrustedWheelScrollEvidence(')
    && siteRuntimeBrowser.includes('scrollOwnerCandidateMatchesBefore')
    && siteRuntimeBrowser.includes('SITE_E2E_SCROLL_EVIDENCE_RUNTIME_COST_INCOMPATIBLE')
    && feedCausalRunner.includes('classifyTrustedWheelPageBlocker(action)')
    && feedCausalRunner.includes('rendered_dialog_blocks_trusted_feed_scroll')
    && feedInspectionRunner.includes("status: 'AGENT_PAGE_BLOCKED'")
    && feedProtocol.includes("markerPayloads.get('AGENT_PAGE_BLOCKED')")
    && feedProtocol.includes('QA_FEED_AGENT_PAGE_BLOCKER_CONTRACT_INVALID')
    && feedProtocol.includes('status: QA_RUN_STATUSES.BLOCKED')
    && feedCausalRunner.includes("if (surfaceMode === 'continuous')"),
  'Instagram continuous Feed QA must target the declared article lane, preserve bounded scroll diagnostics, and prove any dialog interception classified as an external blocker',
);
requireCondition(
  feedCausalRunner.includes('scrollPageRatio: 0.9')
    && siteRuntimeBrowser.includes('resolveTrustedWheelMagnitude(action, beforeScrollContext)')
    && siteRuntimeBrowser.includes('SITE_E2E_WHEEL_MAGNITUDE_CONFLICT')
    && feedInspectionRunner.includes('projectInspectionReadinessBlocker(readiness)')
    && feedProtocol.includes("evidence.stage === 'site_readiness'")
    && feedProtocol.includes('evidence[requiredFlag] === true'),
  'Feed QA must size paged input from one measured page and require observed readiness flags for authentication blockers',
);
requireCondition(
  feedInspectionRunner.includes('while (!control.cancelled)')
    && !feedInspectionRunner.includes('OPERATOR_ARM_TIMEOUT_MS')
    && !feedInspectionRunner.includes('FEED_HORIZON_INSPECTION_OPERATOR_ARM_TIMEOUT'),
  'human Feed QA handoff must wait for explicit cancellation instead of expiring',
);

const gateProtocol = await read('scripts/qa/protocols/gateRuntimeQaProtocol.mjs');
const attachOnlyActivePageAdapter = await read(
  'scripts/qa/protocols/attachOnlyActivePageAdapter.mjs',
);
const attachOnlyActivePageAdapterTest = await read(
  'tests/attachOnlyActivePageAdapter.test.js',
);
requireCondition(
  browserObservationContract.includes('QA_TARGET_FOREGROUND_OBSERVATION_CONFLICT')
    && browserObservationContract.includes('QA_BROWSER_OBSERVATION_UNRESOLVED')
    && targetContract.includes('normalizeQaBrowserObservation')
    && initialWindowFocusPolicy.includes("plan.browserObservation === 'foreground'")
    && initialWindowFocusAnchorLease.includes('this.acquireAttempted = true')
    && initialWindowFocusAnchorLease.includes('focusQaManagedBrowserTargetForPreparation')
    && initialWindowFocusAnchorLease.includes('QA_INITIAL_WINDOW_PRESENTATION_TARGET_MISMATCH')
    && runSession.includes('QA_BROWSER_OS_FOCUS_OBSERVED')
    && attachOnlyActivePageAdapter.includes('observeEntropyAttachedPageExecution')
    && attachOnlyActivePageAdapter.includes('classifyEntropyAttachedPageExecution')
    && attachOnlyActivePageAdapter.includes("['document', 'animation'].includes(observation) ? null : await trackingAdmission")
    && attachOnlyActivePageAdapterTest.includes('native foreground observation never enables document focus emulation'),
  'foreground observation must declare native prerequisites, use one journaled initial presentation owner, and never emulate document focus',
);
const audioDullingFocusTest = await read(
  'tests/audioDullingQaProtocolFocus.test.js',
);
requireCondition(
  attachOnlyActivePageAdapter.includes('active: false')
    && attachOnlyActivePageAdapter.includes('enableNoFocusPageExecution(page)')
    && attachOnlyActivePageAdapter.includes('activateOwnedPageWithoutWindowFocus(page)')
    && attachOnlyActivePageAdapter.includes("'DEBUG_GET_TRACKING_RUNTIME_STATE'")
    && attachOnlyActivePageAdapter.includes('lastActiveTabId !== targetTabId')
    && attachOnlyActivePageAdapter.includes('DEFAULT_TRACKING_PROBE_TIMEOUT_MS')
    && attachOnlyActivePageAdapter.includes(
      'POST_RELOAD_TRACKING_READINESS_TIMEOUT_MS = 12_000',
    )
    && attachOnlyActivePageAdapter.includes(
      'POST_RELOAD_TRACKING_READINESS_PROBE_TIMEOUT_MS = 2_000',
    )
    && attachOnlyActivePageAdapter.includes(
      'export async function proveEntropyAttachedArtifactRuntimeReadiness',
    )
    && attachOnlyActivePageAdapter.includes("chrome.runtime.getURL('entropy-build-info.json')")
    && attachOnlyActivePageAdapter.includes("{ cache: 'no-store' }")
    && attachOnlyActivePageAdapter.includes('chrome.runtime.getManifest()')
    && attachOnlyActivePageAdapter.includes("status: 'artifact_runtime_identity_verified'")
    && attachOnlyActivePageAdapter.includes('coldDeadlineAtMs')
    && attachOnlyActivePageAdapter.includes('trustedPageDeadlineAtMs')
    && extensionChromiumHarness.includes('trustedPageDeadlineAtMs = null')
    && extensionChromiumHarness.includes('deadlineAtMs: absoluteDeadlineAtMs')
    && extensionChromiumHarness.includes('commandTimeoutMs: remainingUntilDeadline()')
    && cdpTargetOwner.includes("QA_CDP_PAGE_TARGET_TIMEOUT_INVALID")
    && cdpTargetOwner.includes("import { randomUUID } from 'node:crypto'")
    && cdpTargetOwner.includes("recoverAmbiguousCreation = false")
    && cdpTargetOwner.includes("QA_CDP_PAGE_TARGET_OPTION_UNKNOWN")
    && cdpTargetOwner.includes("'Target.setDiscoverTargets', { discover: true }")
    && cdpTargetOwner.includes('QA_CDP_PAGE_TARGET_CREATION_RECOVERY_UNRESOLVED')
    && cdpTargetOwner.includes('candidateTargetIds = new Set([')
    && cdpTargetOwner.includes('deadlineAtMs - Date.now()')
    && attachOnlyActivePageAdapter.includes(
      'POST_RELOAD_RESULT_DELIVERY_GRACE_MS = 250',
    )
    && attachOnlyActivePageAdapter.includes("evidenceRole: 'runtime_readiness_only'")
    && attachOnlyActivePageAdapter.includes('TRACKING_DIAGNOSTIC_FIELDS')
    && attachOnlyActivePageAdapter.includes('TRACKING_RESPONSE_STATES')
    && attachOnlyActivePageAdapter.includes('TRACKING_RESPONSE_ERROR_CODES')
    && attachOnlyActivePageAdapter.includes('classifyTrackingResponse.toString()')
    && attachOnlyActivePageAdapter.includes("errorCodes.includes(response.error) ? response.error : 'unclassified'")
    && attachOnlyActivePageAdapterTest.includes('preserves only the named readiness rejection code %s in serialized failure evidence')
    && attachOnlyActivePageAdapterTest.includes('classifies rejected response shape %j without exporting its values')
    && attachOnlyActivePageAdapter.includes('diagnostics === null')
    && attachOnlyActivePageAdapter.includes('probeSettled || completed')
    && attachOnlyActivePageAdapter.includes("failureKind = 'probe_timeout'")
    && attachOnlyActivePageAdapter.includes('windowFocusRequested: false')
    && attachOnlyActivePageAdapterTest.includes(
      'creates in background and proves active semantics without a window-focus request',
    )
    && attachOnlyActivePageAdapterTest.includes(
      'fails instead of accepting another tab as tracking evidence',
    )
    && attachOnlyActivePageAdapterTest.includes(
      'retries when one tracking probe loses its runtime callback',
    )
    && attachOnlyActivePageAdapterTest.includes(
      'fails closed within the admission deadline when every probe callback is lost',
    )
    && attachOnlyActivePageAdapterTest.includes(
      'proves live code identity on %s before accepting readiness',
    )
    && attachOnlyActivePageAdapterTest.includes(
      'keeps post-reload readiness separate from exact target admission',
    )
    && extensionChromiumHarnessTest.includes(
      'includes first trusted-page target creation in an absolute evaluation deadline',
    )
    && extensionChromiumHarnessTest.includes(
      'bounds trusted-page evaluation by the time remaining after target admission',
    )
    && extensionChromiumHarnessTest.includes(
      'preserves retired artifact evidence and reports both failures when rollback fails',
    )
    && attachOnlyActivePageAdapterTest.includes(
      'treats a canonical explicit runtime-readiness failure as terminal',
    )
    && attachOnlyActivePageAdapterTest.includes(
      'rejects successful tracking claims without complete bounded diagnostics',
    )
    && attachOnlyActivePageAdapterTest.includes(
      'rejects an old runtime build before probing the canonical message router',
    )
    && attachOnlyActivePageAdapter.includes('response.buildInfo?.buildId !== expectedBuild.buildId')
    && attachOnlyActivePageAdapterTest.includes(
      'rejects old running code even when the build-info file has already changed',
    )
    && attachOnlyActivePageAdapterTest.includes(
      'rejects a partially applied runtime manifest missing its %s',
    ),
  'attach-only active pages must separate bounded post-refresh router readiness from warm exact-target, no-focus admission',
);
const earlySettingsReadinessObserver = attachOnlyActivePageAdapter.slice(
  attachOnlyActivePageAdapter.indexOf('async function observeEarlySettingsReadiness('),
  attachOnlyActivePageAdapter.indexOf('// Serialized into the existing trusted-page probe.'),
);
requireCondition(
  earlySettingsReadinessObserver.includes("chrome.runtime.sendMessage({ action: 'GET_SETTINGS', keys: [] }")
    && (earlySettingsReadinessObserver.match(/chrome\.runtime\.sendMessage\(/gu) || []).length === 1
    && earlySettingsReadinessObserver.includes('JSON.stringify(EARLY_SETTINGS_READ_ERROR_CODES)')
    && earlySettingsReadinessObserver.includes('errorCodes.includes(response.error)')
    && earlySettingsReadinessObserver.includes('trustedPageDeadlineAtMs - Date.now() - POST_RELOAD_RESULT_DELIVERY_GRACE_MS')
    && earlySettingsReadinessObserver.includes('harness.childCloseOperation')
    && earlySettingsReadinessObserver.includes("registerQaChildAbortCleanup(cancelObservation, { phase: 'protocol' })")
    && earlySettingsReadinessObserver.includes('unregisterAbort()')
    && earlySettingsReadinessObserver.includes("keys.join(',') === 'code,reason,status'")
    && !/chrome\.storage|response\.settings|setInterval|while\s*\(/u.test(earlySettingsReadinessObserver)
    && attachOnlyActivePageAdapter.includes('error.earlyReadinessDiagnostic = Object.freeze(earlyReadiness)')
    && attachOnlyActivePageAdapter.includes('throw error;')
    && attachOnlyActivePageAdapterTest.includes('observes one empty canonical settings read after a strict readiness failure')
    && attachOnlyActivePageAdapterTest.includes('bounds a missing early-read callback and ignores its late settings response')
    && attachOnlyActivePageAdapterTest.includes('cancels the bounded early diagnostic through the existing child cleanup owner')
    && qaControlPlaneDoc.includes('`GET_SETTINGS({keys:[]})`')
    && qaControlPlaneDoc.includes('original strict reload FAIL'),
  'failed attached readiness may observe one bounded empty canonical boot read without settings values, retries, storage bypass or changing the original failure',
);
const profileReadinessObserver = attachOnlyActivePageAdapter.slice(
  attachOnlyActivePageAdapter.indexOf('function readProfileReadinessPacket('),
  attachOnlyActivePageAdapter.indexOf('async function observeEarlySettingsReadiness('),
);
requireCondition(
  profileReadinessObserver.includes('chrome.storage.local.get([storageKey]')
    && (profileReadinessObserver.match(/chrome\.storage\.local\.get\(/gu) || []).length === 1
    && profileReadinessObserver.includes("action: 'GET_PROFILE_GENERATION_READINESS', profileGeneration: generation")
    && (profileReadinessObserver.match(/chrome\.runtime\.sendMessage\(/gu) || []).length === 1
    && profileReadinessObserver.includes('new ProfileResetLifecycleStore({')
    && profileReadinessObserver.includes('keys.length !== 1 || keys[0] !== PROFILE_RESET_LIFECYCLE_STORAGE_KEY')
    && profileReadinessObserver.includes("throw new Error('QA_ATTACH_PROFILE_DIAGNOSTIC_READ_ONLY')")
    && profileReadinessObserver.includes('new ProfileResetLifecycleRepository({ lifecycleStore })')
    && profileReadinessObserver.includes('requireModelStateProfileEpochId(resolveProfileResetGeneration(await repository.read()))')
    && profileReadinessObserver.includes('packet.present ? { [PROFILE_RESET_LIFECYCLE_STORAGE_KEY]: packet.value } : {}')
    && profileReadinessObserver.includes('normalizeSettingsProfileRecovery(packet.recovery)')
    && profileReadinessObserver.includes('normalizeProfileCompatibilityRecovery(packet.recovery)')
    && profileReadinessObserver.includes('packet.code !== recovery.failureCode')
    && profileReadinessObserver.includes('phaseDeadlineAtMs - Date.now()')
    && profileReadinessObserver.includes('POST_RELOAD_TRACKING_READINESS_PROBE_TIMEOUT_MS')
    && profileReadinessObserver.includes("registerQaChildAbortCleanup(cancelObservation, { phase: 'protocol' })")
    && profileReadinessObserver.includes('harness.childCloseOperation')
    && !/chrome\.storage\.(?:local|session)\.(?:set|remove|clear)|SET_SETTINGS|response\.settings(?:\b|\[)|setInterval|while\s*\(/u.test(profileReadinessObserver)
    && attachOnlyActivePageAdapter.includes("if (earlyReadiness.status === 'rejected')")
    && attachOnlyActivePageAdapter.includes('error.profileReadinessDiagnostic = Object.freeze(profileReadiness)')
    && attachOnlyActivePageAdapterTest.includes('diagnoses the typed current generation once without exporting lifecycle or settings values')
    && attachOnlyActivePageAdapterTest.includes('rejects present invalid lifecycle')
    && attachOnlyActivePageAdapterTest.includes('shares one bounded deadline between the lifecycle and dedicated readiness callbacks')
    && attachOnlyActivePageAdapterTest.includes('cancels the typed lifecycle observation without issuing a dedicated readiness request')
    && qaControlPlaneDoc.includes('`profileReadinessDiagnostic`')
    && qaControlPlaneDoc.includes('A ready diagnostic retains the original'),
  'failed attached readiness diagnostics must use one read-only typed lifecycle key, exact current-generation readiness and normalized metadata within the shared deadline without storage writes or changing FAIL',
);
requireCondition(
  attachOnlyActivePageAdapter.includes('targetWindowReader = readQaCdpPageTargetWindow')
    && attachOnlyActivePageAdapter.includes("targetWindow?.status !== 'target_window_verified'")
    && attachOnlyActivePageAdapter.includes('targetWindow.targetId !== page.targetId')
    && attachOnlyActivePageAdapter.includes('targetWindow.windowId !== targetTab.windowId')
    && attachOnlyActivePageAdapter.includes('targetWindow,')
    && attachOnlyActivePageAdapter.includes('windowFocusRequested: false')
    && attachOnlyActivePageAdapterTest.includes(
      'creates in background and proves active semantics without a window-focus request',
    )
    && attachOnlyActivePageAdapterTest.includes(
      'rejects target-window proof that does not match the activated exact tab',
    ),
  'attach-only admission must carry exact target/window correlation without consuming OS-focus authority',
);
requireCondition(
  gateProtocol.includes('GATE_QA_AUTOMATION_ACTIONS.PRESENT_ENTRY_CHECKPOINT')
    && gateProtocol.includes('presentation.sessionCommit')
    && gateProtocol.includes('rootDir: plan.rootDir')
    && !gateProtocol.includes("rootDir: '/'"),
  'Gate runtime protocol must use the typed canonical presentation/session commit',
);
requireCondition(
  !gateProtocol.includes('chrome.storage.'),
  'Gate runtime protocol must not inspect or seed raw storage',
);
requireCondition(
  gateProtocol.includes("from './securityVaultQaFixture.mjs'")
    && gateProtocol.includes('await ensureQaSecurityVaultReady(harness, {')
    && gateProtocol.includes("passphrase: randomBytes(32).toString('base64url')")
    && gateProtocol.includes("evidence.event('QA_GATE_SECURITY_VAULT_READY', securityVault)")
    && qaControlPlaneDoc.includes('`QA_GATE_SECURITY_VAULT_READY`'),
  'Gate runtime must prepare its disposable vault through the canonical Dashboard fixture with an unrecorded random passphrase',
);

const gateAutomationRoute = await read(
  'src/apps/background/services/runtime/messageRoutes/gateQaAutomationMessageRoutes.dev.js',
);
const gateAutomationContract = await read(
  'src/domains/protection/background/automation/gateQaAutomationContract.dev.js',
);
const gateAutomationBridgeTest = await read('tests/gateQaAutomationBridge.test.js');
requireCondition(
  gateAutomationRoute.includes('controller.presentForRuntimeSnapshot')
    && gateAutomationRoute.includes('controller.readTabSession')
    && gateAutomationRoute.includes('controller.removeTabSession'),
  'Gate QA automation must present, certify, and clean up through the canonical controller',
);
requireCondition(
  gateAutomationContract.includes("PRESENT_DETOUR_SPREAD: 'QA_GATE_PRESENT_DETOUR_SPREAD'")
    && gateAutomationContract.includes("const expectedKeys = ['maxProtectedTabs', 'protectedTabs']")
    && !gateAutomationContract.includes('DETOUR_PRESENTATION_MODES')
    && gateAutomationContract.includes('detourEntryObserved: true')
    && gateAutomationContract.includes('getGateProtectedTabThreshold(maxProtectedTabs)')
    && gateAutomationContract.includes('keys.length !== 2')
    && gateAutomationContract.includes("!keys.includes('tabId')")
    && gateAutomationContract.includes("!keys.includes('url')")
    && gateAutomationContract.includes('seenTabIds.has(tabId)')
    && gateAutomationContract.includes("parsed.protocol !== 'http:'")
    && gateAutomationContract.includes("parsed.protocol !== 'https:'")
    && gateAutomationContract.includes('parsed.username')
    && gateAutomationContract.includes('parsed.password')
    && gateAutomationContract.includes('GATE_QA_AUTOMATION_TARGET_TAB_NOT_PROTECTED')
    && (gateAutomationRoute.match(/await resolveExactProtectedTabs\(/gu) || []).length === 1
    && gateAutomationRoute.includes('GATE_QA_AUTOMATION_PROTECTED_TAB_URL_MISMATCH')
    && gateAutomationRoute.includes('createDetourSpreadQaRuntimeSnapshot({')
    && gateAutomationRoute.includes('request.payload.protectedTabs')
    && gateAutomationRoute.includes("presentation.reason !== 'redirected'")
    && gateAutomationRoute.includes("presentation.documentDisposition !== 'redirected'")
    && gateAutomationRoute.includes('presentation.message != null || presentation.presentationTransaction != null')
    && gateAutomationRoute.includes('requireCommittedDetourSession(')
    && gateAutomationRoute.includes('sessionCommit: Object.freeze({')
    && !gateAutomationRoute.includes('resolvedBrowserPort.tabsSendMessage(')
    && !gateAutomationRoute.includes('surfaceCommit:')
    && gateAutomationBridgeTest.includes('requires a bounded exact detour tab set containing the presentation target')
    && gateAutomationBridgeTest.includes('presents Detour in the canonical top-level Gate and checks the committed exact tab set')
    && gateAutomationBridgeTest.includes('detour QA redirects without requiring a content receiver')
    && gateAutomationBridgeTest.includes('rejects detour presentation when a declared protected tab URL is stale'),
  'Detour QA must verify the bounded exact tab/url set before the canonical full-page redirect and certify its committed session without a content-surface ACK',
);

const runtimeDebuggerAutomationContract = await read(
  'src/domains/nudge/runtime-debugger/automation/runtimeDebuggerAutomationContract.dev.js',
);
const runtimeDebuggerAutomationContentRelay = await read(
  'src/domains/nudge/runtime-debugger/automation/runtimeDebuggerAutomationContentRelay.dev.js',
);
const runtimeDebuggerAutomationRoute = await read(
  'src/apps/background/services/runtime/messageRoutes/runtimeDebuggerAutomationMessageRoutes.dev.js',
);
const runtimeDebuggerRuntime = await read(
  'src/domains/nudge/runtime-debugger/RuntimeDebuggerRuntime.js',
);
const runtimeDebuggerAutomationBridgeTest = await read(
  'tests/runtimeDebuggerAutomationBridge.test.js',
);
const runtimeDebuggerOverlayTest = await read('tests/runtimeDebuggerOverlay.test.js');
const forceEnsoAutomationOwner = runtimeDebuggerRuntime.slice(
  runtimeDebuggerRuntime.indexOf('forceEnsoGateAutomation(options = {}) {'),
  runtimeDebuggerRuntime.indexOf('dismissEnsoGateAutomation() {'),
);
const dismissEnsoAutomationOwner = runtimeDebuggerRuntime.slice(
  runtimeDebuggerRuntime.indexOf('dismissEnsoGateAutomation() {'),
  runtimeDebuggerRuntime.indexOf('  stopAutomationSession() {'),
);
requireCondition(
  runtimeDebuggerAutomationContract.includes(
    "FORCE_ENSO_GATE: 'DEBUG_RUNTIME_FORCE_ENSO_GATE'",
  )
    && runtimeDebuggerAutomationContract.includes(
      "DISMISS_ENSO_GATE: 'DEBUG_RUNTIME_DISMISS_ENSO_GATE'",
    )
    && runtimeDebuggerAutomationContentRelay.includes("'forceEnsoGateAutomation'")
    && runtimeDebuggerAutomationContentRelay.includes("'dismissEnsoGateAutomation'")
    && runtimeDebuggerAutomationContentRelay.includes(
      'RUNTIME_DEBUGGER_AUTOMATION_ACTIONS.FORCE_ENSO_GATE',
    )
    && runtimeDebuggerAutomationContentRelay.includes(
      'RUNTIME_DEBUGGER_AUTOMATION_ACTIONS.DISMISS_ENSO_GATE',
    )
    && runtimeDebuggerAutomationRoute.includes('assertTrustedQaAutomationHarnessSender')
    && (runtimeDebuggerAutomationRoute.match(/resolvedBrowserPort\.tabsGet\(/gu) || []).length === 2
    && runtimeDebuggerAutomationRoute.includes('currentTab.url !== firstTab.url')
    && runtimeDebuggerAutomationRoute.includes('RUNTIME_DEBUGGER_AUTOMATION_TARGET_TAB_NAVIGATED')
    && runtimeDebuggerAutomationRoute.includes('{ frameId: 0 }')
    && forceEnsoAutomationOwner.includes('this._assertAutomationSessionActive()')
    && forceEnsoAutomationOwner.includes('InteractionManager.forceEnsoGateForDebug(options)')
    && runtimeDebuggerAutomationContentRelay.includes('runtime.forceEnsoGateAutomation(request.payload)')
    && runtimeDebuggerAutomationContract.includes("payload.admissionMode === undefined ? 'manual' : payload.admissionMode")
    && runtimeDebuggerAutomationContract.includes("!['manual', 'ordinary'].includes(admissionMode)")
    && runtimeDebuggerAutomationContract.includes("payloadKeys.some((key) => key !== 'admissionMode')")
    && forceEnsoAutomationOwner.includes('!surface.active || !surface.canvasPresent')
    && dismissEnsoAutomationOwner.includes('this._assertAutomationSessionActive()')
    && dismissEnsoAutomationOwner.includes('InteractionManager.cancelEnsoGateForSource(')
    && dismissEnsoAutomationOwner.includes("'runtime_debugger_automation_dismiss'")
    && dismissEnsoAutomationOwner.includes('surface.active')
    && runtimeDebuggerRuntime.includes('surfaceCount > 1')
    && runtimeDebuggerRuntime.includes('RUNTIME_DEBUGGER_AUTOMATION_ENSO_GATE_SURFACE_DUPLICATE')
    && runtimeDebuggerAutomationBridgeTest.includes(
      'rejects action payload drift instead of silently dropping unknown fields',
    )
    && runtimeDebuggerAutomationBridgeTest.includes(
      'relays a typed harness request to the exact top-frame target tab',
    )
    && runtimeDebuggerAutomationBridgeTest.includes(
      'only through the RuntimeDebuggerRuntime owner',
    )
    && runtimeDebuggerOverlayTest.includes(
      'forces and dismisses the real Enso surface through narrow automation actions',
    )
    && runtimeDebuggerOverlayTest.includes('RUNTIME_DEBUGGER_AUTOMATION_SESSION_INACTIVE'),
  'Enso QA must default to manual, admit only an explicit ordinary detector fixture, and use the trusted exact-tab relay and active RuntimeDebuggerRuntime interaction owner',
);

const collisionEnsoAdmissionSurface = await read('src/domains/nudge/interaction/ensoGateSurface.js');
const collisionEnsoAdmissionTests = await read('tests/ensoGateQaAdmission.test.js');
requireCondition(
  collisionEnsoAdmissionSurface.includes('preparedDebugLease !== admissionLease')
    && collisionEnsoAdmissionSurface.includes("reason: 'production_intervention_owned'")
    && collisionEnsoAdmissionTests.includes('manual debug cannot adopt an existing ordinary lease')
    && collisionEnsoAdmissionTests.includes('a copied or older QA receipt cannot bypass ownership'),
  'The Enso detector fixture must consume its exact prepared lease and never adopt an existing production owner',
);

const sentinelProtocol = await read(
  'scripts/qa/protocols/sentinelProtocolQaProtocol.mjs',
);
const sentinelProtocolTest = await read(
  'tests/sentinelProtocolQaProtocol.test.js',
);
const sentinelAutomationRoute = await read(
  'src/apps/background/services/runtime/messageRoutes/sentinelProtocolQaAutomationMessageRoutes.dev.js',
);
const sentinelGoalReadStart = sentinelAutomationRoute.indexOf('if (request.action === SENTINEL_PROTOCOL_QA_ACTIONS.READ_GOAL_STATE)');
const sentinelContentPreparationStart = sentinelAutomationRoute.indexOf('const ready = await contentScriptOrchestrator.ensureContentScriptReady');
const sentinelGoalReadOwner = sentinelAutomationRoute.slice(sentinelGoalReadStart, sentinelContentPreparationStart);
requireCondition(
  sentinelGoalReadStart > sentinelAutomationRoute.indexOf('assertTrustedQaAutomationHarnessSender(sender, browserPort,')
    && sentinelGoalReadStart > sentinelAutomationRoute.indexOf('const initialTab = requireQaAutomationTargetWebTab(')
    && sentinelContentPreparationStart > sentinelGoalReadStart
    && sentinelAutomationRoute.includes('readGoalEndState = readFurinGoalEndState')
    && sentinelAutomationRoute.includes('readInterventionExposure = () => getInterventionAdmissionService().readExposureSnapshot()')
    && sentinelGoalReadOwner.includes('readGoalEndState()')
    && sentinelGoalReadOwner.includes('readInterventionExposure()')
    && !/requireContentDelivery|ensureContentScriptReady|tabsSendMessage|\.snapshot\(|\.reconcile\(/u.test(sentinelGoalReadOwner),
  'Sentinel goal evidence must remain a trusted exact-web-tab typed passive read before content preparation, without reconciliation or manual realization',
);
requireCondition(
  sentinelAutomationRoute.includes('__nudgeRunId: runId')
    && sentinelAutomationRoute.includes('runId: request.requestId'),
  'Sentinel QA debug starts must retain a request-scoped run identity for the Room 478 handoff',
);
requireCondition(
  sentinelProtocol.includes("browser?.processOwnership !== 'attach_only'")
    && sentinelProtocol.includes('openEntropyAttachOnlyActivePage({')
    && sentinelProtocol.includes('proveEntropyAttachedArtifactRuntimeReadiness')
    && sentinelProtocol.includes('readEntropyPostRefreshTrackingRuntimeReadiness(harness)')
    && sentinelProtocol.includes("evidence.event('QA_TRACKING_RUNTIME_POST_REFRESH_READY'")
    && sentinelProtocol.includes('postRefreshRuntimeReadiness,')
    && sentinelProtocol.includes('rootDir: plan.rootDir')
    && !sentinelProtocol.includes("rootDir: '/'")
    && !sentinelProtocol.includes("active: plan.browserExecution.targetActivation === 'active'")
    && sentinelProtocol.includes('SENTINEL_PROTOCOL_QA_ACTIONS.START')
    && sentinelProtocol.includes('SENTINEL_PROTOCOL_QA_ACTIONS.SNAPSHOT')
    && sentinelProtocol.includes('SENTINEL_PROTOCOL_QA_ACTIONS.STOP')
    && sentinelProtocol.includes('plan.parameters.captureScreenshots')
    && sentinelProtocol.includes('requiredHostPermissions: [`${targetUrl.origin}/*`]')
    && sentinelProtocol.includes('browserProcessPreserved: true')
    && sentinelProtocol.includes("cdp.subscribe('Page.screencastFrame'")
    && sentinelProtocol.includes("cdp.send('Page.startScreencast'")
    && !sentinelProtocol.includes("cdp.send('Page.captureScreenshot'")
    && sentinelProtocol.includes('snapshot.siteFurinReady')
    && sentinelProtocol.includes('diagnostics.siteFurinVisibleElapsedMs')
    && sentinelProtocol.includes('QA_SITE_FURIN_ISOLATION_FAILED')
    && sentinelProtocol.includes('QA_SENTINEL_SITE_CONTINUE_RESOLVED')
    && sentinelProtocol.includes("type: 'mouseMoved', button: 'none', buttons: 0")
    && sentinelProtocol.includes('driveSiteFurinWindGesture')
    && sentinelProtocol.includes('QA_SITE_FURIN_SWEEP_CANCELLATION_FAILED')
    && sentinelProtocol.includes("control: 'nudgeFurinWind', mechanism: 'native_pointer_sweep'")
    && sentinelProtocol.includes("clickShadowButton(options.harness, options.page, 'nudgeFurinContinue')")
    && sentinelProtocol.includes('siteFurinExitElapsedMs')
    && sentinelProtocol.includes('waitForSiteFurinTabClosed')
    && sentinelProtocol.includes('QA_SITE_FURIN_CLOSE_PROOF_INVALID')
    && sentinelProtocol.includes('qaTabRemovalSent: false')
    && sentinelProtocol.includes('snapshot.globalSentinelHitAftermathPhase')
    && sentinelProtocol.includes('snapshot.globalSentinelHitAftermathSerial')
    && sentinelProtocol.includes('snapshot.globalSentinelRiftOpenProgress')
    && sentinelProtocol.includes("'nudgeRiftInviteButton'")
    && sentinelProtocol.includes('waitForGlobalSentinelRoom478Ready')
    && sentinelProtocol.includes("SENTINEL_ROOM478_PAGE_PATH = '/src/pages/room-478.html'")
    && sentinelProtocol.includes("mechanism: siteTabClosed ? 'product_site_furin_tab_close' : 'product_global_rift_handoff'")
    && sentinelProtocol.includes('qaStopSent: false')
    && sentinelProtocol.includes('new QaAttachedBrowserOsFocusGuard({')
    && sentinelProtocol.includes("nativeObservation: plan.browserObservation === 'document'")
    && sentinelProtocol.includes('observation: plan.browserObservation')
    && sentinelProtocol.includes('requireEntropyAttachedPageExecution(harness, page, plan.browserObservation)')
    && sentinelProtocol.includes("requireExecution('before_start')")
    && sentinelProtocol.includes("requireExecution('after_start')")
    && sentinelProtocol.includes("requireExecution('completion')")
    && !sentinelProtocol.includes('enableNoFocusPageExecution')
    && sentinelProtocol.includes("observeBaseline('before_harness_start')")
    && sentinelProtocol.includes("assertPreserved('after_harness_start')")
    && sentinelProtocol.includes("assertPreserved('after_target_activation')")
    && sentinelProtocol.includes("assertPreserved('after_protocol_completion')")
    && sentinelProtocol.includes("receipt.policy === 'native_observation'")
    && sentinelProtocol.includes("'QA_BROWSER_OS_FOCUS_OBSERVED' : 'QA_BROWSER_OS_FOCUS_PRESERVED'")
    && sentinelProtocolTest.includes('Sentinel protocol QA stage frame recorder')
    && sentinelAutomationRoute.includes('assertTrustedQaAutomationHarnessSender')
    && sentinelAutomationRoute.includes('buildSiteFurinChimeConfig')
    && sentinelAutomationRoute.includes('MESSAGE_TYPES.NUDGE_DEBUG_START')
    && sentinelAutomationRoute.includes('MESSAGE_TYPES.NUDGE_DEBUG_SNAPSHOT')
    && sentinelAutomationRoute.includes('MESSAGE_TYPES.NUDGE_DEBUG_STOP'),
  'Sentinel QA must retain trusted attach-only routing, canonical Site chime, full-rift Room 478 completion, explicit screenshot consent, and bounded cleanup',
);

const videoSkipControlSurfaceProtocol = await read(
  'scripts/qa/protocols/videoSkipControlSurfaceQaProtocol.mjs',
);
const videoSkipControlSurfaceAutomationRoute = await read(
  'src/apps/background/services/runtime/messageRoutes/videoSkipControlSurfaceQaMessageRoutes.dev.js',
);
const videoSkipControlSurfaceContentRelay = await read(
  'src/domains/protection/content/buildCapabilityContentRelay.dev.js',
);
requireCondition(
  videoSkipControlSurfaceProtocol.includes("browser?.processOwnership !== 'attach_only'")
    && videoSkipControlSurfaceProtocol.includes('openEntropyAttachOnlyActivePage({')
    && videoSkipControlSurfaceProtocol.includes('proveEntropyAttachedArtifactRuntimeReadiness')
    && videoSkipControlSurfaceProtocol.includes('readEntropyPostRefreshTrackingRuntimeReadiness(harness)')
    && videoSkipControlSurfaceProtocol.includes("evidence.event('QA_TRACKING_RUNTIME_POST_REFRESH_READY'")
    && videoSkipControlSurfaceProtocol.includes('rootDir: plan.rootDir')
    && !videoSkipControlSurfaceProtocol.includes("rootDir: '/'")
    && videoSkipControlSurfaceProtocol.includes('VIDEO_SKIP_CONTROL_SURFACE_QA_ACTIONS.START')
    && videoSkipControlSurfaceProtocol.includes('VIDEO_SKIP_CONTROL_SURFACE_QA_ACTIONS.SNAPSHOT')
    && videoSkipControlSurfaceProtocol.includes('VIDEO_SKIP_CONTROL_SURFACE_QA_ACTIONS.STOP')
    && videoSkipControlSurfaceProtocol.includes('const requestedPolicies = [plan.parameters.policy]')
    && videoSkipControlSurfaceProtocol.includes("runtimeSnapshot?.mode === 'hard_block'")
    && videoSkipControlSurfaceProtocol.includes("reason: 'video_not_observed'")
    && videoSkipControlSurfaceProtocol.includes("reason: 'declared_player_timeline_not_observed'")
    && videoSkipControlSurfaceProtocol.includes("assertPreserved('after_protocol_completion')")
    && videoSkipControlSurfaceProtocol.includes('browserProcessPreserved: true')
    && !videoSkipControlSurfaceProtocol.includes('chrome.storage.')
    && videoSkipControlSurfaceAutomationRoute.includes('assertTrustedQaAutomationHarnessSender')
    && videoSkipControlSurfaceAutomationRoute.includes('ensureContentScriptReady')
    && videoSkipControlSurfaceAutomationRoute.includes("{ frameId: 0 }")
    && videoSkipControlSurfaceAutomationRoute.includes(
      'VIDEO_SKIP_CONTROL_SURFACE_QA_TARGET_TAB_NAVIGATED',
    )
    && videoSkipControlSurfaceContentRelay.includes('isTrustedExtensionBackgroundSender')
    && videoSkipControlSurfaceContentRelay.includes(
      'VIDEO_SKIP_CONTROL_SURFACE_QA_RUNTIME_ALREADY_OWNED',
    )
    && videoSkipControlSurfaceContentRelay.includes('await VideoSkipManager.remove()'),
  'VideoSkip control-surface QA must retain trusted exact-tab activation, canonical hard-block evidence, no-settings ownership, and explicit teardown',
);

const dashboardCaptureProtocol = await read(
  'scripts/qa/protocols/dashboardCaptureQaProtocol.mjs',
);
const dashboardArtifactRuntimeJourney = await read('scripts/qa/protocols/dashboardArtifactRuntimeJourney.mjs');
requireCondition(
  dashboardCaptureProtocol.includes('plan.parameters.artifactRuntimeJourney')
    && dashboardCaptureProtocol.includes('runDashboardArtifactRuntimeJourney({ harness, page, pageDiagnostics, themeId,')
    && dashboardCaptureProtocol.includes('captureFamilyScreenshot: family =>')
    && dashboardCaptureProtocol.includes('captureScreenshot(harness, page, screenshotPath)')
    && dashboardArtifactRuntimeJourney.includes('QA_ARTIFACT_RUNTIME_CAPTURE_OWNER_REQUIRED')
    && dashboardArtifactRuntimeJourney.includes('await captureFamilyScreenshot(family)')
    && dashboardCaptureProtocol.includes('requireArtifactRuntimeDisclosure(progressionResponse.snapshot)')
    && dashboardArtifactRuntimeJourney.includes('capturePerformanceCheckpoint')
    && dashboardArtifactRuntimeJourney.includes('requireArtifactRuntimeFamilyParking(')
    && dashboardArtifactRuntimeJourney.includes('unpausedIndefiniteSvgAnimationsBefore')
    && dashboardArtifactRuntimeJourney.includes('workerChannelSessionId')
    && dashboardArtifactRuntimeJourney.includes('QA_ARTIFACT_RUNTIME_DOCUMENT_HIDDEN')
    && dashboardArtifactRuntimeJourney.includes('QA_ARTIFACT_RUNTIME_WIDGET_MISSING')
    && dashboardArtifactRuntimeJourney.includes('pendingRequestCount === 0')
    && dashboardArtifactRuntimeJourney.includes('observer.disconnect()')
    && !dashboardArtifactRuntimeJourney.includes('new ExtensionChromiumHarness')
    && !dashboardArtifactRuntimeJourney.includes('Target.createTarget')
    && !dashboardArtifactRuntimeJourney.includes('Page.bringToFront'),
  'Artifact runtime diagnostics must be opt-in on the existing owned capture document with complete canonical disclosure, native visibility, every-family drained parking including SVG timelines, retained Worker identity and deterministic probe cleanup',
);
const dashboardCaptureDiagnostics = await read(
  'scripts/qa/protocols/dashboardCaptureDiagnostics.mjs',
);
const dashboardBootArtifactDiagnostics = await read(
  'scripts/qa/protocols/dashboardBootArtifactDiagnostics.mjs',
);
const dashboardCaptureZenTrace = await read('src/lib/debug/zenTrace.dev.js');
const zenMainCaptureProfile = await read(
  'src/apps/dashboard/qa/zenMainCaptureProfile.dev.js',
);
const zenMainCapturePublicProfile = await read(
  'src/apps/dashboard/qa/zenMainCaptureProfile.public.js',
);
requireCondition(
  dashboardCaptureProtocol.includes('ExtensionChromiumHarness')
    && dashboardCaptureProtocol.includes('browserExecution: plan.browserExecution')
    && dashboardCaptureProtocol.includes('displayReceipt: browser.display')
    && dashboardCaptureProtocol.includes('RECOMMENDED_LOCAL_ANALYSIS_PROFILE_PATCH')
    && dashboardCaptureProtocol.includes('...recommendedProfile')
    && dashboardCaptureProtocol.includes('PROGRESSION_DEBUG_ACTIONS.SET_UNLOCK_DAY')
    && dashboardCaptureProtocol.includes("'Page.captureScreenshot'")
    && dashboardCaptureProtocol.includes("harness.openPage('about:blank'")
    && dashboardCaptureProtocol.includes('harness.navigatePage(page, dashboardUrl')
    && dashboardCaptureProtocol.includes("'dashboard-boot.json'")
    && dashboardCaptureProtocol.includes("captureSearchParams.set('entropy-qa-boot-trace', 'full')")
    && dashboardCaptureProtocol.includes('configurePage(harness, page, DASHBOARD_CAPTURE_VIEWPORT)')
    && dashboardCaptureProtocol.includes('configurePage(harness, page, resizeViewport)')
    && dashboardCaptureProtocol.includes('QA_DASHBOARD_CAPTURE_RESIZE_IDENTITY_FAILED')
    && dashboardCaptureProtocol.includes('dashboard-resize.json')
    && dashboardCaptureProtocol.includes('QA_DASHBOARD_CAPTURE_BOOT_HEALTH_FAILED')
    && dashboardCaptureProtocol.includes('QA_DASHBOARD_BOOT_HEALTH_FAILED')
    && dashboardCaptureProtocol.includes('QA_DASHBOARD_BOOT_ARTIFACT_PREPARATION_STARTED')
    && dashboardCaptureProtocol.includes('classifyDashboardBootArtifactPreparationHealth')
    && dashboardCaptureProtocol.includes('accepted_software_visual_wait')
    && dashboardCaptureProtocol.includes('activeRendererClass === \'software\'')
    && dashboardCaptureProtocol.includes('QA_DASHBOARD_BOOT_ARTIFACT_PREPARATION_SOFTWARE_VISUAL_WAIT_ACCEPTED')
    && dashboardCaptureProtocol.includes('dashboard-boot-artifact-preparation.json')
    && dashboardCaptureProtocol.includes("cacheState: 'artifact_preparation'")
    && dashboardCaptureProtocol.includes('readDashboardBootArtifactGraph')
    && dashboardCaptureProtocol.includes('capturePerformanceCheckpoint')
    && dashboardCaptureProtocol.includes('cpuProfile: request.cpuProfile')
    && dashboardCaptureProtocol.includes('stopCpuProfile')
    && dashboardCaptureProtocol.includes('requireCpuProfile: request.cpuProfile')
    && dashboardCaptureProtocol.includes('projectHomeWorkerTimeline')
    && dashboardCaptureProtocol.includes('traceMode: plan.parameters.traceMode')
    && dashboardCaptureProtocol.includes("evidence.event('QA_DASHBOARD_CAPTURE_READY'")
    && dashboardCaptureProtocol.includes("artifacts: Object.freeze({ tabId: 'tools' })")
    && !dashboardCaptureProtocol.includes('chrome.storage.')
    && dashboardCaptureDiagnostics.includes('createDashboardPageDiagnostics')
    && dashboardCaptureDiagnostics.includes("'Runtime.exceptionThrown'")
    && dashboardCaptureDiagnostics.includes("['error', 'warning']")
    && dashboardCaptureDiagnostics.includes("'Network.loadingFailed'")
    && dashboardCaptureDiagnostics.includes('classifyDashboardCaptureHealth')
    && dashboardCaptureDiagnostics.includes('dashboard_boot_forced_visual_release')
    && dashboardCaptureDiagnostics.includes("'Performance.getMetrics'")
    && dashboardCaptureDiagnostics.includes("'Profiler.start'")
    && dashboardCaptureDiagnostics.includes("'Profiler.stop'")
    && dashboardCaptureDiagnostics.includes('summarizeCpuProfile')
    && dashboardCaptureDiagnostics.includes('dashboard_cpu_profile_missing')
    && dashboardBootArtifactDiagnostics.includes("'src/apps/dashboard/main.jsx'")
    && dashboardBootArtifactDiagnostics.includes("'src/pages/dashboard.html'")
    && dashboardBootArtifactDiagnostics.includes('resolveStageManifestKey')
    && dashboardBootArtifactDiagnostics.includes('moduleInventory.chunks[entry.file].includes(stage.entryKey)')
    && dashboardBootArtifactDiagnostics.includes('QA_DASHBOARD_BOOT_ARTIFACT_ENTRY_PROVENANCE_INVALID')
    && dashboardBootArtifactDiagnostics.includes("'src/i18n/dashboardConfig.js'")
    && dashboardCaptureZenTrace.includes("search.get('entropy-qa-boot-trace')")
    && dashboardCaptureZenTrace.includes("requestedMode === 'off'")
    && dashboardCaptureZenTrace.includes('ZEN_TRACE_MODE.MARKS')
    && dashboardCaptureZenTrace.includes("source: 'dashboard_capture_boot'")
    && zenMainCaptureProfile.includes('ENTROPY_ZEN_MAIN_CAPTURE_PROFILE_DEV')
    && zenMainCaptureProfile.includes('buildZenKoiRosterSnapshot')
    && zenMainCaptureProfile.includes('buildZenWeatherAuthoritySnapshot')
    && zenMainCaptureProfile.includes('dataIsolationMode: true')
    && zenMainCapturePublicProfile.includes('return null')
    && zenMainCapturePublicProfile.includes('return projection'),
  'Dashboard capture QA must use one owned extension harness, pre-navigation exact-session boot/load diagnostics, boot-only bounded CPU self-time profiling, generic surface routing, canonical theme/progression owners, an isolated Zen Main profile, and a public no-op alias',
);

const siteFurinVisualScene = await read(
  'src/apps/visual-harness/scenes/SiteFurinSequenceScene.jsx',
);
const globalSentinelVisualScene = await read(
  'src/apps/visual-harness/scenes/GlobalSentinelSequenceScene.jsx',
);
requireCondition(
  siteFurinVisualScene.includes('createSiteFurinState')
    && siteFurinVisualScene.includes('advanceSiteFurinFrame')
    && siteFurinVisualScene.includes('resolveSiteFurinProgress')
    && siteFurinVisualScene.includes('createZenFurinPresentation')
    && globalSentinelVisualScene.includes('createSentinelProtocolSessionController')
    && globalSentinelVisualScene.includes('protocolProgress: protocolSession.buildWorkerProtocolProgress')
    && globalSentinelVisualScene.includes('expectedGlobalOutcome: activation.protocolOutcome')
    && globalSentinelVisualScene.includes('withDeterministicMathRandom'),
  'Sentinel visual scenes must boot and advance through the canonical protocol state and graphic contracts with controlled capture time before readiness',
);

const audioDullingProtocol = await read(
  'scripts/qa/protocols/audioDullingQaProtocol.mjs',
);
requireCondition(
  audioDullingProtocol.includes("browser?.processOwnership !== 'attach_only'")
    && audioDullingProtocol.includes('openEntropyAttachOnlyActivePage({')
    && audioDullingProtocol.includes('proveEntropyAttachedArtifactRuntimeReadiness')
    && audioDullingProtocol.includes('readEntropyPostRefreshTrackingRuntimeReadiness(harness)')
    && audioDullingProtocol.includes("evidence.event('QA_TRACKING_RUNTIME_POST_REFRESH_READY'")
    && audioDullingProtocol.includes('postRefreshRuntimeReadiness,')
    && audioDullingProtocol.includes('rootDir: plan.rootDir')
    && !audioDullingProtocol.includes("rootDir: '/'")
    && !audioDullingProtocol.includes("active: plan.browserExecution.targetActivation === 'active'")
    && !audioDullingProtocol.includes("cdp.send('Target.activateTarget'")
    && audioDullingProtocol.includes('assertAudioDullingNativeFocusPermission(osFocus)')
    && audioDullingFocusTest.includes('admits only an explicit request-once execution leaf')
    && audioDullingProtocol.includes('AUDIO_DULLING_QA_ACTIONS.DROP_CAUGHT') === false
    && audioDullingProtocol.includes('AUDIO_DULLING_QA_ACTIONS.PREPARE')
    && audioDullingProtocol.includes('AUDIO_DULLING_QA_ACTIONS.UPDATE')
    && audioDullingProtocol.includes('AUDIO_DULLING_QA_ACTIONS.STOP')
    && audioDullingProtocol.includes('invitationWindowMs')
    && audioDullingProtocol.includes("requiredPermissions: ['scripting']")
    && audioDullingProtocol.includes('requiredHostPermissions: [`${new URL(targetUrl).origin}/*`]')
    && audioDullingProtocol.includes('ensureAgentToolbarPinned')
    && audioDullingProtocol.includes('inspectAgentBrowserAudioOutput')
    && audioDullingProtocol.includes('startAgentMediaPlayback')
    && audioDullingProtocol.includes('captureRitualStages')
    && audioDullingProtocol.includes('resolveAgentTabTargetId')
    && audioDullingProtocol.includes("'Extensions.triggerAction'")
    && audioDullingProtocol.includes("plan.mode === 'human'"),
  'Suikinkutsu QA must preserve exact-origin attach-only human control and use the canonical bounded agent pin, media, ritual, and tab-action chain',
);

const windowsChromeToolbarDriver = await read(
  'scripts/qa/drivers/windowsChromeToolbarDriver.mjs',
);
const windowsChromeToolbarAutomation = await read(
  'scripts/qa/drivers/windowsChromeToolbarAutomation.ps1',
);
const windowsChromeToolbarDriverTest = await read(
  'tests/windowsChromeToolbarDriver.test.js',
);
const windowsForegroundObservationBranch = windowsChromeToolbarAutomation.slice(
  windowsChromeToolbarAutomation.indexOf("if ($Operation -eq 'inspect_foreground')"),
  windowsChromeToolbarAutomation.indexOf("if ($Operation -eq 'minimize_window')"),
);
const windowsMinimizeBranch = windowsChromeToolbarAutomation.slice(
  windowsChromeToolbarAutomation.indexOf("if ($Operation -eq 'minimize_window')"),
  windowsChromeToolbarAutomation.indexOf("if ($Operation -eq 'inspect' -or"),
);
requireCondition(
  windowsChromeToolbarDriver.includes('parseWindowsChromeToolbarResult')
    && windowsChromeToolbarDriver.includes("Buffer.from(effectiveExpectedName, 'utf8').toString('base64')")
    && windowsChromeToolbarAutomation.includes("$ErrorActionPreference = 'Stop'")
    && windowsChromeToolbarAutomation.includes('[Console]::OutputEncoding = $utf8')
    && windowsChromeToolbarAutomation.includes("'view_1006'")
    && windowsChromeToolbarAutomation.includes('ExpectedNameBase64'),
  'Windows Chrome toolbar automation must stay fail-fast, locale-neutral, and anchored to the stabilized extension-menu owner',
);
requireCondition(
  windowsChromeToolbarDriver.includes("['-ExpectedProcessId', String(expectedProcessId)]")
    && windowsChromeToolbarDriver.includes('QA_WINDOWS_CHROME_EXPECTED_PROCESS_ID_INVALID')
    && windowsChromeToolbarAutomation.includes('QA_WINDOWS_CHROME_PROCESS_ID_MISMATCH')
    && windowsChromeToolbarAutomation.includes(
      'GetVisibleTopLevelWindowsForProcess',
    )
    && windowsChromeToolbarAutomation.includes(
      'QA_WINDOWS_CHROME_TARGET_WINDOW_MATCH_COUNT_INVALID',
    )
    && windowsChromeToolbarAutomation.includes("if ($Operation -ne 'focus_window')")
    && windowsChromeToolbarAutomation.indexOf(
      'QA_WINDOWS_CHROME_PROCESS_ID_MISMATCH',
    ) < windowsChromeToolbarAutomation.indexOf(
      'Set-BrowserForeground $browserProcess',
    )
    && windowsChromeToolbarAutomation.indexOf(
      'QA_WINDOWS_CHROME_TARGET_WINDOW_MATCH_COUNT_INVALID',
    ) < windowsChromeToolbarAutomation.indexOf(
      'Set-BrowserForeground $browserProcess',
    )
    && windowsChromeToolbarDriver.includes('ExpectedWindowBoundsBase64')
    && windowsChromeToolbarAutomation.includes('GetTopLevelWindowBounds')
    && windowsChromeToolbarDriverTest.includes(
      'binds an explicit operator focus request to the pre-verified Windows process id',
    )
    && windowsChromeToolbarDriverTest.includes(
      'rejects an invalid expected process id before Windows automation',
    ),
  'operator focus must bind the pre-verified PID and exactly one target-correlated visible native window before foreground mutation',
);
const boundedWindowsForegroundPreparation = windowsChromeToolbarAutomation.slice(
  windowsChromeToolbarAutomation.indexOf('function Set-BrowserForeground'),
  windowsChromeToolbarAutomation.indexOf('function Find-All'),
);
requireCondition(
  windowsChromeToolbarDriver.includes('QA_WINDOWS_CHROME_TARGET_WINDOW_PROOF_REQUIRED')
    && windowsChromeToolbarAutomation.includes('QA_WINDOWS_CHROME_TARGET_WINDOW_PROOF_REQUIRED')
    && boundedWindowsForegroundPreparation.includes("$placement = if ($Operation -eq 'focus_window')")
    && boundedWindowsForegroundPreparation.includes('PrepareSecondaryPresentation')
    && boundedWindowsForegroundPreparation.includes('VerifyPresentedPlacement($placement.Expected, $presentationAfter, $placement.GeometryTolerance)')
    && windowsChromeToolbarAutomation.includes('EnumDisplayMonitors')
    && windowsChromeToolbarAutomation.includes('QA_WINDOWS_CHROME_MONITOR_ENUMERATION_FAILED')
    && windowsChromeToolbarAutomation.includes('QA_WINDOWS_CHROME_SECONDARY_MONITOR_MOVE_FAILED')
    && windowsChromeToolbarAutomation.includes('PlanSecondaryPresentation')
    && windowsChromeToolbarAutomation.includes('if (!plan.MoveRequested) return plan;')
    && qaOperatorBrowserWindow.includes('requireQaWindowPresentationReceipt')
    && qaOperatorBrowserWindow.includes("placement.policy !== 'secondary_preferred'")
    && qaOperatorBrowserWindow.includes('QA_OPERATOR_BROWSER_MONITOR_PLACEMENT_RECEIPT_INVALID')
    && runSession.includes('presentation = requireQaWindowPresentationReceipt(receipt.presentation)')
    && windowsChromeToolbarDriverTest.includes('plans secondary placement and validates only the declared geometry without calling window APIs')
    && qaOperatorBrowserWindowTest.includes('accepts bounded secondary placement while rejecting arbitrary changes and hidden receipt fields')
    && qaOperatorBrowserWindowTest.includes('bounds maximized monitor relocation while retaining its native maximized state')
    && !windowsForegroundObservationBranch.includes('PrepareSecondaryPresentation'),
  'secondary monitor placement must occur only in bounded exact PID/CDP-window preparation, preserve single/existing-secondary placement, and carry validated expected geometry without widening steady-state focus',
);
requireCondition(
  windowsChromeToolbarDriver.includes('inspectWindowsChromeForegroundState')
    && windowsForegroundObservationBranch.includes('GetForegroundWindow()')
    && !windowsForegroundObservationBranch.includes('SetForegroundWindow')
    && !windowsForegroundObservationBranch.includes('Open-ExtensionsMenu')
    && !windowsForegroundObservationBranch.includes('Click-ElementCenter'),
  'Windows foreground observation must remain read-only and separate from focus-consuming toolbar operations',
);
requireCondition(
  windowsChromeToolbarDriver.includes('minimizeWindowsChromeWindow')
    && windowsMinimizeBranch.includes('ShowWindowAsync(')
    && windowsMinimizeBranch.includes('GetForegroundWindow()')
    && windowsMinimizeBranch.includes('focusRequested = $false')
    && !windowsMinimizeBranch.includes('SetForegroundWindow')
    && !windowsMinimizeBranch.includes('BringWindowToTop')
    && !windowsMinimizeBranch.includes('Open-ExtensionsMenu')
    && !windowsMinimizeBranch.includes('Click-ElementCenter'),
  'Windows first-window release may only minimize and observe; it must not request foreground or synthesize input',
);

const audioDullingQaRoute = await read(
  'src/apps/background/services/runtime/messageRoutes/audioDullingQaMessageRoutes.dev.js',
);
const audioDullingQaContract = await read(
  'src/domains/protection/background/audioDulling/audioDullingQaContract.dev.js',
);
const buildCapabilityContentRelay = await read(
  'src/domains/protection/content/buildCapabilityContentRelay.dev.js',
);
const audioDullingActivationChip = await read(
  'src/domains/protection/content/runtime/AudioDullingActivationChip.js',
);
requireCondition(
  audioDullingQaRoute.includes('assertTrustedQaAutomationHarnessSender')
    && audioDullingQaRoute.includes('assertTrustedInvitationSender')
    && audioDullingQaRoute.includes('AUDIO_DULLING_QA_ACTIONS.INVITATION_ARRIVED')
    && audioDullingQaRoute.includes('settleActionPulse')
    && audioDullingQaRoute.includes('handleToolbarActionClicked')
    && audioDullingQaRoute.includes('restoreActionSurface')
    && audioDullingQaRoute.includes('coordinator.startArmedTab')
    && audioDullingQaRoute.includes('coordinator.stopTab')
    && audioDullingQaRoute.includes('refreshContent: true')
    && audioDullingQaRoute.includes('AUDIO_DULLING_QA_ACTIONS.CONTENT_SNAPSHOT')
    && audioDullingQaContract.includes("CONTENT_SNAPSHOT: 'QA_AUDIO_DULLING_CONTENT_SNAPSHOT'")
    && buildCapabilityContentRelay.includes(
      'AudioDullingActivationChip.getInterventionAdmissionDebugSnapshot()',
    )
    && audioDullingActivationChip.includes(
      'getInterventionAdmissionDebugSnapshot({ now = Date.now() } = {})',
    ),
  'Suikinkutsu QA route must retain split sender trust, exact toolbar invocation, action restoration, coordinator-owned capture lifecycle, and explicit content-local shadow diagnostics',
);

const viteConfig = await read('vite.config.js');
requireCondition(
  viteConfig.includes('messageRoutes/buildCapabilityMessageRoutes.dev.js')
    && viteConfig.includes('messageRoutes/buildCapabilityMessageRoutes.public.js')
    && viteConfig.includes('zenMainCaptureProfile.dev.js')
    && viteConfig.includes('zenMainCaptureProfile.public.js')
    && viteConfig.includes("'@zen-main-capture-profile': zenMainCaptureProfileModulePath"),
  'Vite must select one explicit dev/public build-capability route owner',
);

const publicBuildGuard = await read('scripts/ci/check-public-build-debug-surface.mjs');
const publicBuildGuardTest = await read('tests/publicBuildDebugSurface.test.js');
[
  'audioDullingQaContract.dev',
  'audioDullingQaMessageRoutes.dev',
  'audioDullingQaPopupBootstrap.dev',
  'QA_AUDIO_DULLING_PREPARE',
  'gateQaAutomationContract.dev',
  'gateQaAutomationMessageRoutes.dev',
  'QA_GATE_PRESENT_ENTRY_CHECKPOINT',
  'QA_GATE_PRESENT_DETOUR_SPREAD',
  'interventionCollisionQaContract.dev',
  'interventionCollisionQaMessageRoutes.dev',
  'interventionCollisionQaFixture.dev',
  'QA_INTERVENTION_COLLISION',
  'entropy.intervention.collision.qa.v1',
  'prepare_enso_candidate',
  'collision_enso_operational_prerequisite',
  'runtimeDebuggerAutomationContract.dev',
  'runtimeDebuggerAutomationContentRelay.dev',
  'runtimeDebuggerAutomationMessageRoutes.dev',
  'DEBUG_RUNTIME_FORCE_ENSO_GATE',
  'DEBUG_RUNTIME_DISMISS_ENSO_GATE',
  'sentinelProtocolQaAutomationContract.dev',
  'sentinelProtocolQaAutomationMessageRoutes.dev',
  'QA_SENTINEL_PROTOCOL_START',
  'entropy.sentinel.qa.v1',
  'videoSkipControlSurfaceQaContract.dev',
  'videoSkipControlSurfaceQaMessageRoutes.dev',
  'QA_VIDEO_SKIP_CONTROL_SURFACE_START',
  'entropy.video-skip-control-surface.qa.v1',
  'zenMainCaptureProfile.dev',
  'ENTROPY_ZEN_MAIN_CAPTURE_PROFILE_DEV',
  '__ENTROPY_ZEN_MAIN_CAPTURE_PROFILE__',
  'entropy-qa-capture',
].forEach((signature) => {
  requireCondition(
    publicBuildGuard.includes(signature),
    `public build guard must reject Gate QA surface: ${signature}`,
  );
});
requireCondition(
  publicBuildGuard.includes('checkApprovedServiceWorkerWakeDiagnostic')
    && publicBuildGuard.includes('APPROVED_SERVICE_WORKER_WAKE_DIAGNOSTIC_GLOBAL')
    && publicBuildGuardTest.includes(
      'requires the approved bounded wake diagnostic to stay in its service-worker owner',
    )
    && publicBuildGuardTest.includes('diagnostic global escaped its owner'),
  'public build guard must explicitly own and test the bounded service-worker wake diagnostic exception',
);

const packageJson = JSON.parse(await read('package.json'));
requireCondition(
  packageJson.scripts?.qa === 'node ./scripts/qa/entropyQa.mjs',
  'package.json must expose the canonical npm run qa entrypoint',
);
for (const phase of ['prebuild', 'release']) {
  requireCondition(
    getBuildCheckPlan(phase, { packageScripts: packageJson.scripts })
      .some((check) => check.script === 'check:qa:architecture'),
    `the canonical QA architecture guard must run in the ${phase} check phase`,
  );
}

const retiredLauncherReferences = [];
for (const relativePath of [
  'docs/operations/qa',
  'package.json',
  'scripts/e2e',
  'scripts/qa',
]) {
  const absolutePath = path.join(rootDir, relativePath);
  const stat = await fs.stat(absolutePath);
  if (stat.isFile()) {
    const source = await fs.readFile(absolutePath, 'utf8');
    if (source.includes('/tmp/entropy-open-feed-horizon-full-chain.mjs')) {
      retiredLauncherReferences.push(relativePath);
    }
    continue;
  }
  const entries = await fs.readdir(absolutePath, {
    recursive: true,
    withFileTypes: true,
  });
  for (const entry of entries) {
    if (!entry.isFile()) continue;
    const entryPath = path.join(entry.parentPath, entry.name);
    const source = await fs.readFile(entryPath, 'utf8').catch(() => '');
    if (source.includes('/tmp/entropy-open-feed-horizon-full-chain.mjs')) {
      retiredLauncherReferences.push(path.relative(rootDir, entryPath).replaceAll('\\', '/'));
    }
  }
}
requireCondition(
  retiredLauncherReferences.length === 0,
  `retired temporary Feed launcher remains referenced: ${retiredLauncherReferences.join(',')}`,
);

const faviconTarget = getQaTarget('assets/favicon');
const faviconProtocol = await read('scripts/qa/protocols/faviconQaProtocol.mjs');
const faviconDeliveryFixture = await read('scripts/qa/protocols/faviconQaResponseDeliveryFixture.mjs');
requireCondition(faviconTarget.environmentId === 'ephemeral'
  && faviconTarget.artifactId === 'dev_extension' && faviconTarget.protocolId === 'favicon_cache'
  && faviconTarget.supportedModes.length === 1 && faviconTarget.supportedModes[0] === 'agent'
  && faviconTarget.browserRequirements.osFocus === 'never'
  && faviconTarget.protocolOptions.fixturePolicy === 'owned_ephemeral_favicon'
  && faviconTarget.protocolOptions.networkPolicy === 'exact_local_favicon_cache_no_egress'
  && faviconTarget.protocolOptions.responseDeliveryPolicy === 'owned_native_response_delay'
  && faviconProtocol.includes('requireIntegratedDisposableFixtureOwner(harness)')
  && faviconProtocol.includes('createFaviconQaLocalCacheUrl(harness.extensionId, fixture.url)')
  && faviconProtocol.includes("harness.cdp.subscribe('Network.requestWillBeSent'")
  && faviconProtocol.includes("FAVICON_QA_SYNTHETIC_ICON_URLS.includes(request.request.url)")
  && faviconProtocol.includes('requireFaviconQaNoEgress')
  && faviconProtocol.includes('native_http_cache_warmed') && faviconProtocol.includes('nativeIconRequestCount() > 0')
  && faviconProtocol.includes('nativeIconUrl = ownedNativeIconUrl')
  && !faviconProtocol.includes('fixture.setImage')
  && faviconProtocol.includes('native_source_rebound') && faviconProtocol.includes('NATIVE_SOURCE_REBIND_REQUIRED')
  && faviconProtocol.includes('localCacheReads === 2')
  && faviconProtocol.includes('native_pre_race_baseline') && faviconProtocol.includes('PRE_RACE_NATIVE_BYTES_CHANGED')
  && faviconProtocol.includes('requests.length === 3') && faviconProtocol.includes('await requireNativeProof(3)')
  && faviconProtocol.includes('expectedNativeSha256: warmedNative.sha256')
  && faviconProtocol.includes('RESPONSE_DELIVERY_RESTORE_REQUIRED')
  && faviconDeliveryFixture.includes('Reflect.apply(nativeFetch, this, args)')
  && faviconDeliveryFixture.includes('response.clone().arrayBuffer()')
  && faviconDeliveryFixture.includes("Object.defineProperty(scope, 'fetch', descriptor)")
  && faviconDeliveryFixture.includes('ORIGINAL_RESPONSE_CONSUMED')
  && faviconDeliveryFixture.includes('CLEAR_ACK_REQUIRED') && faviconDeliveryFixture.includes('EXPIRED')
  && faviconDeliveryFixture.includes("removeEventListener('abort'")
  && !faviconProtocol.includes('Fetch.fulfillRequest') && !/new\s+Response\s*\(/u.test(faviconDeliveryFixture)
  && !faviconProtocol.includes('FAVICON_QA_HTTPS_URLS')
  && !/Target\.(?:createTarget|closeTarget)|new WebSocket|from ['"]playwright['"]/u.test(faviconProtocol),
  'Favicon QA must retain owned native HTTP/cache evidence, untouched bounded Response delivery and descriptor restoration, remote-request rejection and no substitute browser owner');

const echoArtifactsTarget = getQaTarget('artifacts/echo');
const echoArtifactsProtocol = await read('scripts/qa/protocols/echoArtifactsQaProtocol.mjs');
requireCondition(echoArtifactsTarget.environmentId === 'ephemeral'
  && echoArtifactsTarget.artifactId === 'dev_extension' && echoArtifactsTarget.protocolId === 'echo_artifacts'
  && echoArtifactsTarget.supportedModes.length === 1 && echoArtifactsTarget.supportedModes[0] === 'agent'
  && echoArtifactsProtocol.includes('requireIntegratedDisposableFixtureOwner(harness)')
  && echoArtifactsProtocol.includes('real_wall_clock') && echoArtifactsProtocol.includes('checkpointWrites: false')
  && echoArtifactsProtocol.includes('requireEchoWorkerEvidence')
  && !/Target\.(?:createTarget|closeTarget)|new WebSocket|from ['"]playwright['"]/u.test(echoArtifactsProtocol),
  'Echo artifact QA must retain disposable harness ownership, real deadlines and exact worker/checkpoint proof');

const tabManagementTarget = getQaTarget('artifacts/tab-management');
const tabManagementProtocol = await read('scripts/qa/protocols/tabManagementQaProtocol.mjs');
requireCondition(tabManagementTarget.environmentId === 'ephemeral'
  && tabManagementTarget.artifactId === 'dev_extension' && tabManagementTarget.protocolId === 'tab_management'
  && tabManagementTarget.supportedModes.length === 1 && tabManagementTarget.supportedModes[0] === 'agent'
  && tabManagementTarget.browserRequirements.targetActivation === 'active'
  && tabManagementTarget.protocolOptions.permissionPolicy === 'temporary_manifest_tab_groups'
  && tabManagementProtocol.includes('requireIntegratedDisposableFixtureOwner(harness)')
  && tabManagementProtocol.includes('createTabManagementTemporaryManifest')
  && tabManagementProtocol.includes('ensureQaSecurityVaultReady(harness')
  && tabManagementProtocol.includes('checkpointWrites: false')
  && tabManagementProtocol.includes('MESSAGE_ACTIONS.SET_SETTINGS')
  && tabManagementProtocol.includes('requireTabManagementNativeEvidence')
  && !/Target\.(?:createTarget|closeTarget)|new WebSocket|from ['"]playwright['"]/u.test(tabManagementProtocol),
  'Native tab-group QA must retain disposable harness ownership, temporary permission promotion, canonical settings and real browser evidence');

const detourRuntimeTarget = getQaTarget('gate/detour-spread/runtime');
const detourRuntimeProtocol = await read('scripts/qa/protocols/gateDetourRuntimeQaProtocol.mjs');
requireCondition(detourRuntimeTarget.environmentId === 'ephemeral'
  && detourRuntimeTarget.artifactId === 'dev_extension' && detourRuntimeTarget.protocolId === 'gate_detour_runtime'
  && detourRuntimeTarget.supportedModes.length === 1 && detourRuntimeTarget.supportedModes[0] === 'agent'
  && detourRuntimeTarget.browserRequirements.osFocus === 'never'
  && detourRuntimeProtocol.includes('requireIntegratedDisposableFixtureOwner(harness)')
  && detourRuntimeProtocol.includes('ensureQaSecurityVaultReady(harness')
  && detourRuntimeProtocol.includes('MESSAGE_ACTIONS.UPSERT_SITE_RULE')
  && detourRuntimeProtocol.includes('MESSAGE_ACTIONS.SET_SETTINGS')
  && detourRuntimeProtocol.includes('GATE_QA_AUTOMATION_ACTIONS.PRESENT_DETOUR_SPREAD')
  && detourRuntimeProtocol.includes('readAuthorizedGateSession(harness')
  && detourRuntimeProtocol.includes('requireDetourRuntimeSurface')
  && detourRuntimeProtocol.includes('requireDetourTutorialUnchanged')
  && detourRuntimeProtocol.includes('harness.closePage(external)')
  && detourRuntimeProtocol.includes("'Input.dispatchMouseEvent'")
  && detourRuntimeProtocol.includes('await harness.releasePageTarget(sibling)')
  && !/storage\.(?:local|session)\.(?:get|set)|Target\.(?:createTarget|closeTarget)|new WebSocket|from ['"]playwright['"]/u.test(detourRuntimeProtocol),
  'Detour runtime QA must retain isolated harness/vault ownership, canonical rules and inventory, actual top-level Gate and real selected/external close outcomes without raw storage or substitute browser control');

const mediaFrameHoldTarget = listQaTargets().find(target => target.id === 'media/frame-hold');
requireCondition(mediaFrameHoldTarget?.environmentId === 'ephemeral'
  && mediaFrameHoldTarget?.artifactId === 'dev_extension'
  && mediaFrameHoldTarget?.protocolId === 'media_frame_hold',
  'frame hold QA must retain its named disposable extension owner');
const mediaFrameHoldProtocol = await read('scripts/qa/protocols/mediaFrameHoldQaProtocol.mjs');
requireCondition(mediaFrameHoldProtocol.includes('withExtensionManagementPage')
  && mediaFrameHoldProtocol.includes('ownedBrowserIdentityVerified')
  && mediaFrameHoldProtocol.includes('requireNativeFrameMediaEvidence')
  && mediaFrameHoldProtocol.includes('verifiedPaused === true')
  && !/Target\.(?:createTarget|closeTarget)|new WebSocket|from ['"]playwright['"]/u.test(mediaFrameHoldProtocol),
  'frame hold QA must verify native effects and keep browser/permission ownership in the disposable harness');

if (failures.length > 0) {
  failures.forEach((failure) => {
    process.stderr.write(`[entropy-qa-architecture] ${failure}\n`);
  });
  process.exitCode = 1;
} else {
  process.stdout.write('[entropy-qa-architecture] PASS\n');
}
