#!/usr/bin/env node

import fs from 'node:fs/promises';
import path from 'node:path';

const rootDir = process.cwd();

const fail = (message) => {
  console.error(`[progression-runtime-architecture] FAIL: ${message}`);
  process.exit(1);
};

const readUtf8 = async (relativePath) => fs.readFile(path.resolve(rootDir, relativePath), 'utf8');

const listSourceFiles = async (relativeDir) => {
  const entries = await fs.readdir(path.resolve(rootDir, relativeDir), { withFileTypes: true });
  const nested = await Promise.all(entries.map(async (entry) => {
    const relativePath = path.posix.join(relativeDir, entry.name);
    if (entry.isDirectory()) return listSourceFiles(relativePath);
    return /\.[cm]?[jt]sx?$/.test(entry.name) ? [relativePath] : [];
  }));
  return nested.flat();
};

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

const main = async () => {
  const progressionServicePath = 'src/domains/progression/model/progressionService.js';
  const progressionSnapshotPath = 'src/domains/progression/model/progressionSnapshot.js';
  const mainPresentationConductorPath = 'src/apps/dashboard/presentation/useMainPresentationScene.js';
  const dashboardPagePath = 'src/apps/dashboard/DashboardPage.jsx';
  const firstVisionClientPath = 'src/apps/dashboard/progression/firstVisionProgressionClient.js';
  const progressionRequestClientPath = 'src/apps/dashboard/progression/progressionRequestClient.js';
  const progressionRequestClientSource = await readUtf8(progressionRequestClientPath);
  const firstVisionDevelopmentProjectionDevPath = 'src/apps/dashboard/progression/dev/FirstVisionDevelopmentProjection.dev.js';
  const firstVisionDevelopmentProjectionPublicPath = 'src/apps/dashboard/progression/dev/FirstVisionDevelopmentProjection.public.js';
  const progressionUnlockDebugRepositoryPath = 'src/domains/progression/debug/ProgressionUnlockDebugRepository.js';
  const progressionDebugActionsDevPath = 'src/domains/progression/debug/progressionDebugActions.dev.js';
  const progressionDebugActionsPublicPath = 'src/domains/progression/debug/progressionDebugActions.public.js';
  const progressionDebugContractDevPath = 'src/domains/progression/debug/progressionUnlockDebugContract.dev.js';
  const progressionDebugContractPublicPath = 'src/domains/progression/debug/progressionUnlockDebugContract.public.js';
  const progressionDebugRepositoryDevPath = 'src/domains/progression/debug/progressionDebugRepository.dev.js';
  const progressionDebugRepositoryPublicPath = 'src/domains/progression/debug/progressionDebugRepository.public.js';
  const dashboardProfileGenerationOwnerPath = 'src/apps/dashboard/bootstrap/dashboardProfileGenerationOwner.js';
  const dashboardProfileMutationLifecyclePath = 'src/apps/dashboard/bootstrap/useDashboardProfileMutationLifecycle.js';
  const dashboardProfileGenerationReadinessClientPath = 'src/apps/dashboard/bootstrap/dashboardProfileGenerationReadinessClient.js';
  const zenModelRepositoryPath = 'src/platform/storage/themes/zen/ZenModelRepository.js';
  const zenModelRepositoryCorePath = 'src/platform/storage/themes/zen/ZenModelRepositoryCore.js';
  const mainPresentationStatePath = 'src/apps/dashboard/presentation/mainPresentationSessionState.js';
  const ceremonyPreviewPath = 'src/apps/dashboard/tabs/experiment/CeremonyPreviewLab.jsx';
  const backgroundCoreServicesPath = 'src/apps/background/services/runtime/backgroundKernelCoreServices.js';
  const progressionFactsProviderPath = 'src/domains/progression/model/progressionFactsProvider.js';
  const toolsControllerPath = 'src/apps/dashboard/tabs/tools/useToolsTabController.js';
  const navCuePath = 'src/apps/dashboard/artifacts/useArtifactDisclosureNavCue.js';
  const disclosureRoutePath = 'src/apps/background/services/runtime/messageRoutes/progressionMessageRoutes.js';
  const backgroundMessageRouterPath = 'src/apps/background/services/runtime/BackgroundMessageRouter.js';
  const disclosureBootstrapPath = 'src/apps/background/services/runtime/artifactDisclosureBootstrap.js';
  const trackingSettlementPath = 'src/domains/tracking/background/trackingTabActivitySettlement.js';
  const progressionPolicyPath = 'src/domains/progression/policy/progressionPolicy.js';
  const progressionUnlockPolicyPath = 'src/domains/progression/policy/progressionUnlockPolicy.js';
  const progressionArtifactAccessPolicyPath =
    'src/domains/progression/policy/progressionArtifactAccessPolicy.js';
  const progressionBonsaiReleaseContractPath = 'src/domains/progression/contracts/progressionBonsaiRelease.js';
  const artifactDisclosurePolicyPath = 'src/domains/progression/policy/artifactDisclosurePolicy.js';
  const zenBonsaiUnlockProgressionPath = 'src/themes/plugins/zen/model/ZenBonsaiUnlockProgression.js';
  const bonsaiGrowthRevealStatePath = 'src/apps/dashboard/progression/bonsaiGrowthRevealState.js';
  const bonsaiGrowthRevealPath = 'src/apps/dashboard/progression/BonsaiGrowthReveal.jsx';
  const mainTabPath = 'src/apps/dashboard/tabs/main/MainTab.jsx';
  const homeScanWorkspacePath = 'src/apps/dashboard/tabs/main/home/HomeScanWorkspace.jsx';
  const disclosurePlannerPath = 'src/domains/progression/model/artifactDisclosurePlanner.js';
  const disclosureExperimentPath = 'src/apps/dashboard/tabs/experiment/artifactDisclosureExperimentModel.js';

  const progressionServiceSource = await readUtf8(progressionServicePath);
  ['persistProgressionState', 'const commit = { changed: false }', 'currentOperationCommit = commit',
    'markOperationCommitted()', 'commit.changed && onCommitted !== null',
    'void Promise.resolve().then(() => onCommitted({', 'profileGeneration: committedProfileGeneration',
    'PROGRESSION_COMMIT_OUTSIDE_OPERATION', 'operationQueue.then(async () => {',
    'await assertNormalOperationAdmission(expectedProfileGeneration)']
    .forEach(token => assertIncludes(progressionServiceSource, token, progressionServicePath));
  if ((progressionServiceSource.match(/repository\.writeState\s*\(/g) || []).length !== 1) {
    fail('Ordinary progression persistence must have exactly one repository write call in persistProgressionState.');
  }
  const persistenceStart = progressionServiceSource.indexOf('async function persistProgressionState(');
  const persistenceEnd = progressionServiceSource.indexOf('async function mutateRepositoryState(', persistenceStart);
  const persistenceSource = progressionServiceSource.slice(persistenceStart, persistenceEnd);
  if (persistenceStart < 0 || persistenceEnd <= persistenceStart
    || !/await repository\.writeState\s*\(/.test(persistenceSource)
    || persistenceSource.indexOf('markOperationCommitted()') < persistenceSource.indexOf('await repository.writeState')) {
    fail('persistProgressionState must mark its queued operation committed only after the storage ACK.');
  }
  ['await onCommitted(', 'cachedSnapshot', 'cachedStateUpdatedAtMs']
    .forEach(token => assertExcludes(progressionServiceSource, token, progressionServicePath,
      'The progression queue must neither await its query-capable commit observer nor cache fact-dependent snapshots by progression timestamp.'));
  ['completeProgressionUnlockDebugReplay', 'unlockDebugRepository.completeReplay(expectedProjection',
    'isProgressionBonsaiFirstBloomEligible', 'canonicalFirstVisionSpent: state.firstVision.state',
    'Math.max(next.updatedAtMs, current.updatedAtMs + 1)', 'PROGRESSION_COMMIT_REVISION_EXHAUSTED',
    'clearProgressionUnlockDebugSessionForQa', 'PROGRESSION_QA_CANONICAL_SESSION_CLEANUP_REQUIRED']
    .forEach(token => assertIncludes(progressionServiceSource, token, progressionServicePath));
  const firstVisitClientPath = 'src/apps/dashboard/progression/useDashboardFirstVisit.js';
  const firstVisitClientSource = await readUtf8(firstVisitClientPath);
  ['recordDashboardFirstVisit', 'readSiteRegistrationJourney', 'observeProtectedSiteRegistration',
    'recordSiteRegistrationInvitationsAdmitted',
    'PROGRESSION_MILESTONE_IDS.FIRST_DASHBOARD_VISIT',
    'PROGRESSION_MILESTONE_IDS.FIRST_PROTECTED_SITE_REGISTERED',
    'PROGRESSION_MILESTONE_IDS.DIRECT_SITE_REGISTRATION_UNLOCKED'].forEach(token =>
    assertIncludes(progressionServiceSource, token, progressionServicePath));
  ['RECORD_DASHBOARD_FIRST_VISIT', 'requestDashboardProgression', 'firstDashboardVisitRecorded !== true'].forEach(token =>
    assertIncludes(firstVisitClientSource, token, firstVisitClientPath));
  ['localStorage', 'ProgressionRepository', 'chrome.storage'].forEach(token =>
    assertExcludes(firstVisitClientSource, token, firstVisitClientPath));
  const progressionSnapshotSource = await readUtf8(progressionSnapshotPath);
  const mainPresentationConductorSource = await readUtf8(mainPresentationConductorPath);
  const dashboardPageSource = await readUtf8(dashboardPagePath);
  const firstVisionClientSource = await readUtf8(firstVisionClientPath);
  ['refreshArtifactDisclosureSnapshotResourceAfterMutation', 'notifyGuidanceStateChanged()',
    'FIRST_VISION_SPENT_ACK_STATE_INVALID'].forEach((token) => assertIncludes(firstVisionClientSource, token, firstVisionClientPath));
  const disclosureResourcePath = 'src/apps/dashboard/artifacts/artifactDisclosureSnapshotResource.js';
  const disclosureResourceSource = await readUtf8(disclosureResourcePath);
  ['refreshArtifactDisclosureSnapshotResourceAfterMutation', 'admittedReadGeneration !== readGeneration',
    'ARTIFACT_DISCLOSURE_READ_SUPERSEDED', 'if (inFlightRead === pendingRead)']
    .forEach((token) => assertIncludes(disclosureResourceSource, token, disclosureResourcePath));
  ['connectArtifactDisclosureSnapshotResource', 'isProgressionStateChangedMessage',
    'requireDashboardProfileGeneration()', 'invalidateArtifactDisclosureSnapshotResource',
    'snapshot.stateUpdatedAtMs < currentState.snapshot.stateUpdatedAtMs',
    'incoming.updatedAtMs < accepted.updatedAtMs']
    .forEach(token => assertIncludes(disclosureResourceSource, token, disclosureResourcePath));
  assertExcludes(disclosureResourceSource, 'commitBonsaiFirstBloomOpenedResource', disclosureResourcePath,
    'First-bloom claim ACK must refresh the canonical revisioned snapshot rather than synthesize a receipt projection.');
  const bloomClientPath = 'src/apps/dashboard/progression/bonsaiFirstBloomClient.js';
  const bloomClientSource = await readUtf8(bloomClientPath);
  ['await refreshArtifactDisclosureSnapshotResourceAfterMutation()',
    'assertDashboardProgressionGeneration(response.profileGeneration)']
    .forEach(token => assertIncludes(bloomClientSource, token, bloomClientPath));
  const firstVisionDevelopmentProjectionDevSource = await readUtf8(
    firstVisionDevelopmentProjectionDevPath,
  );
  const firstVisionDevelopmentProjectionPublicSource = await readUtf8(
    firstVisionDevelopmentProjectionPublicPath,
  );
  const progressionUnlockDebugRepositorySource = await readUtf8(
    progressionUnlockDebugRepositoryPath,
  );
  ['async completeReplay(', "['contract', 'mode', 'dayCount', 'updatedAtMs']",
    'current[key] === expected[key]', 'applied: false',
    'Math.max(updatedAtMs, current.updatedAtMs + 1)']
    .forEach(token => assertIncludes(progressionUnlockDebugRepositorySource, token, progressionUnlockDebugRepositoryPath));
  const progressionDebugActionsDevSource = await readUtf8(progressionDebugActionsDevPath);
  const progressionDebugActionsPublicSource = await readUtf8(progressionDebugActionsPublicPath);
  const progressionDebugContractDevSource = await readUtf8(progressionDebugContractDevPath);
  const progressionDebugContractPublicSource = await readUtf8(
    progressionDebugContractPublicPath,
  );
  const progressionDebugRepositoryDevSource = await readUtf8(progressionDebugRepositoryDevPath);
  const progressionDebugRepositoryPublicSource = await readUtf8(
    progressionDebugRepositoryPublicPath,
  );
  const dashboardProfileGenerationOwnerSource = await readUtf8(
    dashboardProfileGenerationOwnerPath,
  );
  const dashboardProfileMutationLifecycleSource = await readUtf8(
    dashboardProfileMutationLifecyclePath,
  );
  const dashboardProfileGenerationReadinessClientSource = await readUtf8(
    dashboardProfileGenerationReadinessClientPath,
  );
  const zenModelRepositorySource = await readUtf8(zenModelRepositoryPath);
  const zenModelRepositoryCoreSource = await readUtf8(zenModelRepositoryCorePath);
  const mainPresentationStateSource = await readUtf8(mainPresentationStatePath);
  const ceremonyPreviewSource = await readUtf8(ceremonyPreviewPath);
  const backgroundCoreServicesSource = await readUtf8(backgroundCoreServicesPath);
  const progressionFactsProviderSource = await readUtf8(progressionFactsProviderPath);
  const toolsControllerSource = await readUtf8(toolsControllerPath);
  const navCueSource = await readUtf8(navCuePath);
  const disclosureRouteSource = await readUtf8(disclosureRoutePath);
  const backgroundMessageRouterSource = await readUtf8(backgroundMessageRouterPath);
  const disclosureBootstrapSource = await readUtf8(disclosureBootstrapPath);
  const trackingSettlementSource = await readUtf8(trackingSettlementPath);
  const progressionPolicySource = await readUtf8(progressionPolicyPath);
  const progressionUnlockPolicySource = await readUtf8(progressionUnlockPolicyPath);
  const journeyPolicyPath = 'src/domains/progression/policy/progressionJourneyPolicy.js';
  const journeyPolicySource = await readUtf8(journeyPolicyPath);
  ['PROGRESSION_JOURNEY_STAGES', "stage(0, [...PROGRESSION_JOURNEY_STARTER_FAMILY_IDS])",
    "stage(2, ['brake'])", "stage(3, ['barrier'])", "stage(4, ['echo'])",
    "stage(5, ['veil'])", 'PROGRESSION_ARTIFACT_JOURNEY_TARGET_DAY_COUNT',
    'stages.findLast((entry) => entry.qualifiedUseDayCount <= dayCount)']
    .forEach((token) => assertIncludes(journeyPolicySource, token, journeyPolicyPath));
  const registrationPolicyPath = 'src/domains/progression/policy/progressionRegistrationPolicy.js';
  const registrationPolicySource = await readUtf8(registrationPolicyPath);
  ['PROGRESSION_REGISTRATION_STAGES', 'PROGRESSION_DIRECT_REGISTRATION_SITE_COUNT = 5',
    'PROGRESSION_DIRECT_REGISTRATION_DAY_COUNT = 5', 'PROGRESSION_REPRESENTED_SITE_LIMIT = 5',
    'resolveProgressionSiteSlotUnlockDay', 'stages.findLast((entry) => entry.qualifiedUseDayCount <= dayCount)',
    'protectedSiteCount >= PROGRESSION_DIRECT_REGISTRATION_SITE_COUNT',
    'qualifiedUseDayCount >= PROGRESSION_DIRECT_REGISTRATION_DAY_COUNT']
    .forEach(token => assertIncludes(registrationPolicySource, token, registrationPolicyPath));
  const qualifiedUseFactsPath = 'src/domains/progression/contracts/qualifiedUseFacts.js';
  const qualifiedUseFactsSource = await readUtf8(qualifiedUseFactsPath);
  ["QUALIFIED_USE_FACTS_CONTRACT = 'qualified_use_facts_v1'", 'canonicalDayCount', 'effectiveDayCount',
    'lastActivityDayKey', 'Number.isSafeInteger(value)', 'requireQualifiedUseFacts']
    .forEach(token => assertIncludes(qualifiedUseFactsSource, token, qualifiedUseFactsPath));
  const qualificationPolicyPath = 'src/domains/progression/policy/qualifiedUsePolicy.js';
  const qualificationPolicySource = await readUtf8(qualificationPolicyPath);
  ['DEFAULT_ACTIVITY_DAY_RESET_HOUR', "from '../../stats/shared/activityDay.js'",
    "'successfully_recorded_managed_protected_visit'"]
    .forEach(token => assertIncludes(qualificationPolicySource, token, qualificationPolicyPath));
  ['targetDayCount', 'first_vision', 'activityDayResetHour: 4']
    .forEach(token => assertExcludes(qualificationPolicySource, token, qualificationPolicyPath));
  const guidanceStatePath = 'src/domains/guidance/contracts/guidanceState.js';
  const guidanceStateSource = await readUtf8(guidanceStatePath);
  ['value > PROGRESSION_ARTIFACT_JOURNEY_TARGET_DAY_COUNT',
    'if (value.previewDay !== null) previewDay(value.previewDay)',
    'GUIDANCE_PREVIEW_DAY_INVALID']
    .forEach(token => assertIncludes(guidanceStateSource, token, guidanceStatePath));
  assertExcludes(guidanceStateSource, 'value > 5', guidanceStatePath,
    'Guidance artifact receipts and raw preview identity must have separate owner bounds.');
  const guidanceServicePath = 'src/domains/guidance/background/GuidanceService.js';
  const guidanceServiceSource = await readUtf8(guidanceServicePath);
  ['artifactStage.qualifiedUseDayCount > ctx.state.lastPresentedJourneyDay',
    'day: artifactStage.qualifiedUseDayCount',
    'recordedStage.qualifiedUseDayCount !== result.qualifiedActivityDayCount',
    'session.previewDay = qualifiedUseFacts.effectiveDayCount']
    .forEach(token => assertIncludes(guidanceServiceSource, token, guidanceServicePath));
  assertExcludes(guidanceServiceSource, 'result.qualifiedActivityDayCount > 5', guidanceServicePath,
    'Journey notifications must follow actual artifact grant stages under the artifact policy, not a copied global horizon.');
  const previewPolicyPath = 'src/domains/progression/policy/progressionPreviewPolicy.js';
  const previewPolicySource = await readUtf8(previewPolicyPath);
  ['PROGRESSION_DEBUG_PREVIEW_TARGET_DAY_COUNT = Math.max(', 'PROGRESSION_BONSAI_FULL_FORM_DAY_COUNT',
    'PROGRESSION_ARTIFACT_JOURNEY_TARGET_DAY_COUNT', 'PROGRESSION_REGISTRATION_TARGET_DAY_COUNT']
    .forEach(token => assertIncludes(previewPolicySource, token, previewPolicyPath));
  for (const [filePath, source, forbidden] of [
    [journeyPolicyPath, journeyPolicySource, ['progressionBonsaiRelease', 'progressionRegistrationPolicy',
      'progressionPreviewPolicy', 'siteRegistrationBudget', 'Math.min(dayCount']],
    [registrationPolicyPath, registrationPolicySource, ['progressionBonsaiRelease', 'progressionJourneyPolicy',
      'progressionPreviewPolicy']],
    [progressionBonsaiReleaseContractPath, await readUtf8(progressionBonsaiReleaseContractPath),
      ['progressionJourneyPolicy', 'progressionRegistrationPolicy', 'progressionPreviewPolicy']],
  ]) forbidden.forEach(token => assertExcludes(source, token, filePath,
    `${filePath} must evaluate raw qualified-use facts under its own policy, without borrowing another consumer's horizon.`));
  ['resolveProgressionSiteSlotUnlockDay(slotIndex)', 'unlockDay === 0 ? afterFirstVision']
    .forEach(token => assertIncludes(progressionPolicySource, token, progressionPolicyPath));
  ['qualifiedDaysAtLeast(2)', 'qualifiedDaysAtLeast(3)', 'qualifiedDaysAtLeast(4)', 'qualifiedDaysAtLeast(5)']
    .forEach(token => assertExcludes(progressionPolicySource, token, progressionPolicyPath,
      'Site-slot feature conditions must derive from registration policy rather than duplicate its thresholds.'));
  ['siteRegistrationBudget', 'representedSiteLimit', 'canonicalDisclosedFamilyIds', 'nextStage',
    'resolveProgressionJourneyFamilyIds', 'resolveProgressionJourneyStage(nextDayCount)']
    .forEach((token) => assertIncludes(progressionUnlockPolicySource, token, progressionUnlockPolicyPath));
  const snapshotImportPath = 'src/platform/storage/internal/storageSnapshotService.js';
  const snapshotImportSource = await readUtf8(snapshotImportPath);
  ['initializeLegacyProgression', 'migrateProgressionState']
    .forEach((token) => assertExcludes(snapshotImportSource, token, snapshotImportPath));
  assertIncludes(snapshotImportSource, 'normalizeProgressionState(value)', snapshotImportPath);
  assertIncludes(progressionUnlockPolicySource,
    'snapshot.orderedFamilyIds.length !== PROGRESSION_JOURNEY_FAMILY_ORDER.length', progressionUnlockPolicyPath);
  const settingsAdmissionPath = 'src/apps/background/services/SettingsService.js';
  const settingsAdmissionSource = await readUtf8(settingsAdmissionPath);
  ['setSiteRegistrationAdmissionOwner', 'await siteRegistrationAdmissionOwner({ currentDomains, nextDomains })',
    'SETTINGS_SITE_REGISTRATION_ADMISSION_OWNER_REQUIRED']
    .forEach((token) => assertIncludes(settingsAdmissionSource, token, settingsAdmissionPath));
  const registrationRejectionPath = 'src/domains/progression/contracts/siteRegistrationRejection.js';
  const registrationRejectionSource = await readUtf8(registrationRejectionPath);
  ['requireSiteRegistrationRejectionDetails', 'buildSiteRegistrationRejectionResponse',
    'createSiteRegistrationLimitError', 'SITE_REGISTRATION_REJECTION_INVALID',
    'siteRegistrationBudget', 'qualifiedUseDayCount', 'nextIncreaseDay']
    .forEach((token) => assertIncludes(registrationRejectionSource, token, registrationRejectionPath));
  ['chrome.storage', 'localStorage', 'Date.now', 'settingsCache']
    .forEach((token) => assertExcludes(registrationRejectionSource, token, registrationRejectionPath));
  for (const [filePath, tokens] of [
    ['src/domains/tracking/background/trackingMessageHandlers/settingsHandlers.js', ['buildSiteRegistrationRejectionResponse(error)']],
    ['src/platform/storage/internal/chrome-storage/settingsTransport.js', ['requireSiteRegistrationRejectionDetails(response)']],
    ['src/apps/dashboard/stores/settingsSyncState.js', ['siteRegistrationRejection: requireSiteRegistrationRejectionDetails(error)']],
    ['src/apps/dashboard/commands/registerSiteRule.js', ['buildSiteRegistrationLimitFeedback(persistResult.error)']],
    ['src/apps/dashboard/tabs/sites/controller/useSitesMutations.js', ['registerSiteRule({', 'moveSiteRuleRegistration({']],
    ['src/apps/background/services/runtime/messageRoutes/popupBlockMessageRoutes.js', ['buildSiteRegistrationRejectionResponse(error)']],
    ['src/domains/tracking/popup/usePopupSiteController.js', ['requireSiteRegistrationRejectionDetails']],
  ]) {
    const source = await readUtf8(filePath);
    tokens.forEach((token) => assertIncludes(source, token, filePath));
  }
  const progressionArtifactAccessPolicySource = await readUtf8(
    progressionArtifactAccessPolicyPath,
  );
  const progressionBonsaiReleaseContractSource = await readUtf8(
    progressionBonsaiReleaseContractPath,
  );
  const artifactDisclosurePolicySource = await readUtf8(artifactDisclosurePolicyPath);
  ['const qualifiedActivityDayCount = state.qualifiedActivityDayCount + 1',
    'lastProcessedActivityDayKey: normalizedActivityDayKey', 'canonicalFirstVisionSpent']
    .forEach(token => assertIncludes(artifactDisclosurePolicySource, token, artifactDisclosurePolicyPath));
  const coordinatorPath = 'src/domains/progression/model/artifactDisclosureCoordinator.js';
  const coordinatorSource = await readUtf8(coordinatorPath);
  ['DEFAULT_ACTIVITY_DAY_RESET_HOUR', "from '../../stats/shared/activityDay.js'",
    'recordSuccessfulManagedProtectionActivityDay({']
    .forEach(token => assertIncludes(coordinatorSource, token, coordinatorPath));
  const qaProvisioningRoutePath = 'src/apps/background/services/runtime/messageRoutes/qaProgressionProvisioningMessageRoutes.dev.js';
  const qaProvisioningRouteSource = await readUtf8(qaProvisioningRoutePath);
  ['clearProgressionUnlockDebugSessionForQa({ expectedProfileGeneration: profileGeneration })',
    'expectedProfileGeneration: profileGeneration', "'/entropy-e2e.html'"]
    .forEach(token => assertIncludes(qaProvisioningRouteSource, token, qaProvisioningRoutePath));
  ['ProgressionUnlockDebugRepository', 'unlockDebugRepository', 'clearStoredProjectionForQaProvisioning()']
    .forEach(token => assertExcludes(qaProvisioningRouteSource, token, qaProvisioningRoutePath,
      'QA routes must enter the generation-admitted service queue before session mutations.'));
  const firstBloomHookPath = 'src/apps/dashboard/progression/useBonsaiFirstBloom.js';
  const firstBloomHookSource = await readUtf8(firstBloomHookPath);
  ['snapshot.bonsaiFirstBloom.eligible', 'useDashboardPresentationAdmission']
    .forEach(token => assertIncludes(firstBloomHookSource, token, firstBloomHookPath));
  ['PROGRESSION_BONSAI_FULL_FORM_DAY_COUNT', 'PROGRESSION_ARTIFACT_JOURNEY_TARGET_DAY_COUNT',
    'canonicalQualifiedUseDayCount >=']
    .forEach(token => assertExcludes(firstBloomHookSource, token, firstBloomHookPath,
      'Home must consume domain first-bloom eligibility rather than reconstructing release thresholds.'));
  const zenBonsaiUnlockProgressionSource = await readUtf8(zenBonsaiUnlockProgressionPath);
  const bonsaiGrowthRevealStateSource = await readUtf8(bonsaiGrowthRevealStatePath);
  const bonsaiGrowthRevealSource = await readUtf8(bonsaiGrowthRevealPath);
  const mainTabSource = await readUtf8(mainTabPath);
  const homeScanWorkspaceSource = await readUtf8(homeScanWorkspacePath);
  const disclosurePlannerSource = await readUtf8(disclosurePlannerPath);
  const disclosureExperimentSource = await readUtf8(disclosureExperimentPath);

  assertIncludes(
    progressionServiceSource,
    'PROGRESSION_FACTS_PROVIDER_REQUIRED',
    progressionServicePath,
  );
  assertIncludes(
    progressionServiceSource,
    'assertProgressionFactsProvider(factsProvider)',
    progressionServicePath,
  );
  assertIncludes(
    progressionServiceSource,
    'buildDegradedProgressionSnapshot({',
    progressionServicePath,
  );
  assertExcludes(
    progressionServiceSource,
    'return { nowMs: now() };',
    progressionServicePath,
    `${progressionServicePath} must not evaluate snapshots with an implicit now-only facts fallback.`,
  );
  [
    'unlockDebugRepository.projectArtifactDisclosureSnapshot(',
    'developmentProjection.dayCount !== null',
    'PROGRESSION_FIRST_VISION_CANONICAL_WRITE_REQUIRES_CANONICAL_MODE',
    'PROGRESSION_FIRST_VISION_DEBUG_RESET_REQUIRES_CANONICAL_MODE',
    'unlockDebugRepository.setCanonicalMode(',
  ].forEach((token) => assertIncludes(
    progressionServiceSource,
    token,
    progressionServicePath,
  ));
  [
    'PROGRESSION_UNLOCK_DEBUG_MODES',
    'progression_unlock_debug_v3',
    'first_vision_preview',
  ].forEach((token) => assertExcludes(
    progressionServiceSource,
    token,
    progressionServicePath,
    `${progressionServicePath} must consume the injected debug owner interface without importing dev-only mode semantics into the public service graph.`,
  ));

  [
    "PROGRESSION_BONSAI_RELEASE_CONTRACT = 'progression_bonsai_release_v1'",
    'PROGRESSION_BONSAI_FULL_FORM_DAY_COUNT = 5',
    'PROGRESSION_UNLOCK_BONSAI_FULL_FORM_SCORE = 88',
    'buildProgressionBonsaiRelease',
    'requireProgressionBonsaiRelease',
    'PROGRESSION_BONSAI_RELEASE_STAGES.find(',
    'isProgressionBonsaiFirstBloomEligible',
    'canonicalMode && firstVisionSpent && bonsaiRelease.fullFormReady && !bonsaiFirstBloomOpened',
  ].forEach((token) => assertIncludes(
    progressionBonsaiReleaseContractSource,
    token,
    progressionBonsaiReleaseContractPath,
  ));
  [
    "JOURNEY_GATED: 'journey_gated'",
    "OPEN: 'open'",
    'PROGRESSION_ARTIFACT_ACCESS_MODE = PROGRESSION_ARTIFACT_ACCESS_MODES.JOURNEY_GATED',
    'requireProgressionArtifactAccessMode',
    'resolveProgressionArtifactAccess',
  ].forEach((token) => assertIncludes(
    progressionArtifactAccessPolicySource,
    token,
    progressionArtifactAccessPolicyPath,
  ));
  [
    "PROGRESSION_UNLOCK_SNAPSHOT_CONTRACT = 'progression_unlock_v3'",
    'snapshot.qualifiedActivityDayCount',
    'canonicalQualifiedUseDayCount',
    'qualifiedUseDayCount',
    'journeyFamilyIds',
    'effectiveFamilyIds',
    'qualifiedUseFacts',
    'bonsaiRelease: buildProgressionBonsaiRelease(qualifiedUseFacts.effectiveDayCount)',
    'canonicalBonsaiRelease: buildProgressionBonsaiRelease(qualifiedUseFacts.canonicalDayCount)',
    'bonsaiFirstBloom: Object.freeze({',
    'snapshot.canonicalFirstVisionSpent',
    'requireArtifactDisclosureSnapshot',
    'requireProgressionUnlockSnapshot(snapshot.unlockProgress, { accessMode: snapshot.accessMode })',
    'unlock.qualifiedUseFacts.canonicalDayCount !== snapshot.qualifiedActivityDayCount',
    'resolveProgressionSiteRegistrationBudget(facts.effectiveDayCount, { accessOpen })',
    'hasPendingProgressionSchedule(qualifiedUseFacts.effectiveDayCount)',
    'hasPendingProgressionSchedule(facts.effectiveDayCount)',
    'value.bonsaiFirstBloom.eligible !== isProgressionBonsaiFirstBloomEligible({',
    'canonicalArtifactAccessMode',
    'unlock.bonsaiFirstBloom.canonicalFirstVisionSpent !== snapshot.canonicalFirstVisionSpent',
  ].forEach((token) => assertIncludes(
    progressionUnlockPolicySource,
    token,
    progressionUnlockPolicyPath,
  ));
  if ((progressionUnlockPolicySource.match(/PROGRESSION_DEBUG_PREVIEW_TARGET_DAY_COUNT/g) || []).length !== 2) {
    fail('The combined production roadmap must inspect each independent schedule; preview maximum is only imported and used to bound debug input.');
  }
  [
    "PROGRESSION_UNLOCK_DEBUG_CONTRACT = 'progression_unlock_debug_v3'",
    "DEVELOP: 'develop'",
    "CANONICAL: 'canonical'",
    "FIRST_VISION_PREVIEW: 'first_vision_preview'",
    'PROGRESSION_UNLOCK_DEBUG_DEFAULT_DAY_COUNT = PROGRESSION_DEBUG_PREVIEW_TARGET_DAY_COUNT',
    'requireProgressionUnlockDebugProjection',
  ].forEach((token) => assertIncludes(
    progressionDebugContractDevSource,
    token,
    progressionDebugContractDevPath,
  ));
  [
    'PROGRESSION_UNLOCK_DEBUG_CONTRACT',
    'PROGRESSION_UNLOCK_DEBUG_MODES',
    'first_vision_preview',
  ].forEach((token) => assertExcludes(
    progressionUnlockPolicySource,
    token,
    progressionUnlockPolicyPath,
    `${progressionUnlockPolicyPath} must keep dev-only progression projection contracts behind the build alias.`,
  ));
  assertExcludes(
    progressionDebugContractPublicSource,
    'progression_unlock_debug',
    progressionDebugContractPublicPath,
  );
  [
    'artifactAccessMode:',
    'managedProtectedVisitDayCount',
    'unlockedFamilyIds',
  ].forEach((token) => assertExcludes(
    progressionUnlockPolicySource,
    token,
    progressionUnlockPolicyPath,
  ));
  assertIncludes(
    artifactDisclosurePolicySource,
    'QUALIFIED_PENDING_FIRST_VISION',
    artifactDisclosurePolicyPath,
  );
  assertExcludes(
    artifactDisclosurePolicySource,
    'FIRST_VISION_NOT_SPENT',
    artifactDisclosurePolicyPath,
  );
  assertIncludes(
    zenBonsaiUnlockProgressionSource,
    'bonsaiRelease: snapshot.bonsaiRelease',
    zenBonsaiUnlockProgressionPath,
  );
  [
    'daysTracked:',
    'protectedVisitCount:',
    'registeredSiteDomains:',
    'bonsaiDebugPreview',
  ].forEach((token) => assertExcludes(
    zenBonsaiUnlockProgressionSource,
    token,
    zenBonsaiUnlockProgressionPath,
    `${zenBonsaiUnlockProgressionPath} must project release age without fabricating evidence facts.`,
  ));
  assertIncludes(
    bonsaiGrowthRevealStateSource,
    'snapshot.canonicalBonsaiRelease.qualifiedUseDayCount',
    bonsaiGrowthRevealStatePath,
  );
  [
    'MAX_TRACKED_DATE_KEYS = 180',
    '.slice(-MAX_TRACKED_DATE_KEYS)',
    'ARTIFACT_DISCLOSURE_ACTIVITY_RESULTS.DUPLICATE_DAY',
    'ARTIFACT_DISCLOSURE_ACTIVITY_RESULTS.STALE_DAY',
    'Math.max(state.updatedAtMs, timestamp)',
  ].forEach((token) => assertIncludes(
    progressionSnapshotSource,
    token,
    progressionSnapshotPath,
  ));
  assertIncludes(
    progressionServiceSource,
    'normalizedActivityDayKey <= lastProcessedActivityDayKey',
    progressionServicePath,
  );
  [
    'useDocumentVisibility()',
    'revalidateOnEnable: true',
    'activeTabId !== MAIN_PRESENTATION_FOCUS_TAB_ID',
    'progressionUnlockDisclosure.refresh()',
  ].forEach((token) => assertIncludes(dashboardPageSource, token, dashboardPagePath));
  assertIncludes(
    mainTabSource,
    '&& !presentedProgressionDisclosure?.snapshot',
    mainTabPath,
  );
  assertIncludes(
    homeScanWorkspaceSource,
    '&& effectiveBonsaiFrameCurrent',
    homeScanWorkspacePath,
  );
  assertIncludes(
    homeScanWorkspaceSource,
    'isZenHomeBonsaiMaterializationAckCurrent(',
    homeScanWorkspacePath,
  );
  assertIncludes(bonsaiGrowthRevealSource, 'useDocumentVisibility()', bonsaiGrowthRevealPath);
  assertIncludes(bonsaiGrowthRevealSource, 'presentationReady', bonsaiGrowthRevealPath);
  assertIncludes(
    bonsaiGrowthRevealStateSource,
    'BONSAI_GROWTH_REVEAL_DEBUG_ACKNOWLEDGEMENT_FORBIDDEN',
    bonsaiGrowthRevealStatePath,
  );
  assertExcludes(
    progressionServiceSource,
    'describeProgressionError(error),\n        ],',
    progressionServicePath,
    `${progressionServicePath} must not convert evaluator/catalog failures into degraded snapshots.`,
  );

  assertIncludes(mainPresentationConductorSource, 'readFirstVisionProgressionSnapshot()', mainPresentationConductorPath);
  assertIncludes(
    mainPresentationConductorSource,
    'resolveFirstVisionPresentationProjection(snapshot)',
    mainPresentationConductorPath,
  );
  assertIncludes(
    mainPresentationConductorSource,
    'persistFirstVisionPresentedForProjection({',
    mainPresentationConductorPath,
  );
  assertIncludes(
    mainPresentationConductorSource,
    'persistFirstVisionSpentForProjection({',
    mainPresentationConductorPath,
  );
  assertIncludes(
    mainPresentationConductorSource,
    'recordCanonical: recordFirstVisionPresented',
    mainPresentationConductorPath,
  );
  assertIncludes(
    mainPresentationConductorSource,
    'recordCanonical: recordFirstVisionSpent',
    mainPresentationConductorPath,
  );
  assertExcludes(mainPresentationConductorSource, 'ProgressionRepository', mainPresentationConductorPath);
  assertExcludes(mainPresentationConductorSource, 'createProgressionService', mainPresentationConductorPath);
  assertExcludes(mainPresentationConductorSource, 'PROGRESSION_EVENT_TYPES', mainPresentationConductorPath);
  assertIncludes(mainPresentationConductorSource, 'boot?.forcedVisualRelease === true', mainPresentationConductorPath);
  assertIncludes(mainPresentationStateSource, 'CURRENT_SCENE_COMMITTED', mainPresentationStatePath);
  assertIncludes(mainPresentationStateSource, 'SPENT_PERSISTED', mainPresentationStatePath);
  assertIncludes(
    mainPresentationStateSource,
    'FIRST_VISION_BOOT_DEGRADED_AFTER_SCENE_COMMIT',
    mainPresentationStatePath,
  );
  assertIncludes(
    mainPresentationStateSource,
    'FIRST_VISION_PRESENTED_PERSIST_FAILED_AFTER_SCENE_COMMIT',
    mainPresentationStatePath,
  );
  assertIncludes(
    mainPresentationConductorSource,
    'resolveMainPresentationCommittedFatalError(state)',
    mainPresentationConductorPath,
  );
  assertIncludes(
    dashboardPageSource,
    'throw mainPresentationScene.fatalError;',
    dashboardPagePath,
  );

  assertIncludes(
    ceremonyPreviewSource,
    'PROGRESSION_UNLOCK_DEBUG_MODES.FIRST_VISION_PREVIEW',
    ceremonyPreviewPath,
  );
  assertIncludes(ceremonyPreviewSource, 'setProgressionUnlockDebugMode(', ceremonyPreviewPath);
  assertExcludes(
    ceremonyPreviewSource,
    'resetFirstVisionProgressionForDebug',
    ceremonyPreviewPath,
  );
  assertExcludes(
    ceremonyPreviewSource,
    'DEBUG_RESET_FIRST_VISION_PROGRESSION',
    ceremonyPreviewPath,
  );
  assertExcludes(ceremonyPreviewSource, 'ProgressionRepository', ceremonyPreviewPath);
  assertExcludes(ceremonyPreviewSource, 'createProgressionService', ceremonyPreviewPath);
  assertExcludes(
    ceremonyPreviewSource,
    '.reset()',
    ceremonyPreviewPath,
    `${ceremonyPreviewPath} must use the session-only first-vision preview seam, not broad progression reset.`,
  );

  assertIncludes(
    firstVisionClientSource,
    'requestDashboardProgression(action, { failureCode })',
    firstVisionClientPath,
  );
  assertIncludes(
    progressionRequestClientSource,
    'requireDashboardProfileGeneration()',
    progressionRequestClientPath,
  );
  assertIncludes(
    firstVisionClientSource,
    'assertDashboardProgressionGeneration(profileGeneration)',
    firstVisionClientPath,
  );
  assertExcludes(
    firstVisionClientSource,
    'ProfileResetLifecycleRepository',
    firstVisionClientPath,
    `${firstVisionClientPath} must consume the page generation owner instead of capturing storage independently.`,
  );
  ['runtimeSendMessage({ action, ...payload, profileGeneration })',
    'assertDashboardProgressionGeneration(profileGeneration)',
    'response?.profileGeneration !== profileGeneration',
    'PROGRESSION_PROFILE_GENERATION_RESPONSE_MISMATCH',
    'PROGRESSION_PROFILE_GENERATION_CHANGED_DURING_REQUEST']
    .forEach(token => assertIncludes(progressionRequestClientSource, token, progressionRequestClientPath));
  for (const filePath of [firstVisitClientPath, firstVisionClientPath,
    'src/apps/dashboard/progression/bonsaiFirstBloomClient.js',
    'src/apps/dashboard/progression/siteRegistrationJourneyClient.js',
    'src/apps/dashboard/progression/progressionUnlockDebugClient.js',
    'src/apps/dashboard/artifacts/artifactDisclosureClient.js']) {
    const source = await readUtf8(filePath);
    assertIncludes(source, 'requestDashboardProgression', filePath);
    ['runtimeSendMessage', 'ProfileResetLifecycleRepository']
      .forEach(token => assertExcludes(source, token, filePath,
        `${filePath} must use the shared progression request/generation owner.`));
  }
  assertIncludes(
    dashboardProfileGenerationOwnerSource,
    'acquireDashboardProfileGeneration',
    dashboardProfileGenerationOwnerPath,
  );
  assertIncludes(
    dashboardProfileGenerationOwnerSource,
    'requireDashboardProfileGeneration',
    dashboardProfileGenerationOwnerPath,
  );
  assertIncludes(
    dashboardProfileGenerationOwnerSource,
    'value.trim() !== value',
    dashboardProfileGenerationOwnerPath,
  );
  assertIncludes(
    dashboardProfileMutationLifecycleSource,
    'acquireDashboardProfileGeneration(profileGeneration)',
    dashboardProfileMutationLifecyclePath,
  );
  assertIncludes(
    dashboardProfileMutationLifecycleSource,
    'releaseDashboardProfileGeneration(generationLease)',
    dashboardProfileMutationLifecyclePath,
  );
  assertIncludes(
    dashboardProfileMutationLifecycleSource,
    'DASHBOARD_PROFILE_GENERATION_LEASE_RELEASE_FAILED',
    dashboardProfileMutationLifecyclePath,
  );
  assertIncludes(
    dashboardProfileMutationLifecycleSource,
    'capturedLifecycleWasClosed = true',
    dashboardProfileMutationLifecyclePath,
  );
  assertIncludes(
    dashboardProfileMutationLifecycleSource,
    'DASHBOARD_PROFILE_MUTATION_LIFECYCLE_EVENT_FAILED',
    dashboardProfileMutationLifecyclePath,
  );
  assertIncludes(
    dashboardProfileMutationLifecycleSource,
    'requestDashboardProfileGenerationReadiness(profileGeneration)',
    dashboardProfileMutationLifecyclePath,
  );
  [
    'PROFILE_MUTATION_RUNTIME_ADMISSION_CLOSED',
    'PROFILE_MUTATION_RUNTIME_ADMISSION_GENERATION_CHANGED',
    'reconcileReadinessFenceTransition',
    'lifecycle = await repository.read()',
    'requiresRuntimeHandoff',
    'blockForRuntimeHandoff({',
    "outcome: 'blocked'",
    "reason: 'readiness_fence_generation_changed'",
    'DASHBOARD_PROFILE_GENERATION_FENCE_RECHECK_FAILED',
  ].forEach((token) => {
    assertIncludes(
      dashboardProfileMutationLifecycleSource,
      token,
      dashboardProfileMutationLifecyclePath,
    );
  });
  assertExcludes(
    dashboardProfileMutationLifecycleSource,
    'forceReloadOnOpen',
    dashboardProfileMutationLifecyclePath,
  );
  assertExcludes(
    dashboardProfileMutationLifecycleSource,
    'window.location.reload',
    dashboardProfileMutationLifecyclePath,
  );
  const readinessFenceReconcileStart = dashboardProfileMutationLifecycleSource.indexOf(
    'const reconcileReadinessFenceTransition = async',
  );
  const readinessAdmissionStart = dashboardProfileMutationLifecycleSource.indexOf(
    'const admitGeneration =',
  );
  if (
    readinessFenceReconcileStart < 0
    || readinessAdmissionStart <= readinessFenceReconcileStart
    || dashboardProfileMutationLifecycleSource
      .slice(readinessFenceReconcileStart, readinessAdmissionStart)
      .includes('requestDashboardProfileGenerationReadiness(')
  ) {
    fail(`${dashboardProfileMutationLifecyclePath} must reconcile named fence transitions from one canonical lifecycle read without retrying readiness.`);
  }
  if (
    dashboardProfileMutationLifecycleSource.indexOf(
      'requestDashboardProfileGenerationReadiness(profileGeneration)',
    ) >= dashboardProfileMutationLifecycleSource.indexOf(
      'acquireDashboardProfileGeneration(profileGeneration)',
    )
  ) {
    fail(`${dashboardProfileMutationLifecyclePath} must receive exact background readiness before acquiring the Dashboard generation lease.`);
  }
  assertIncludes(
    dashboardProfileGenerationReadinessClientSource,
    'MESSAGE_ACTIONS.GET_PROFILE_GENERATION_READINESS',
    dashboardProfileGenerationReadinessClientPath,
  );
  assertIncludes(
    dashboardProfileGenerationReadinessClientSource,
    'response.profileGeneration !== expectedProfileGeneration',
    dashboardProfileGenerationReadinessClientPath,
  );
  assertIncludes(
    dashboardProfileGenerationReadinessClientSource,
    'DASHBOARD_PROFILE_GENERATION_READINESS_RESPONSE_MISMATCH',
    dashboardProfileGenerationReadinessClientPath,
  );
  assertIncludes(
    zenModelRepositoryCoreSource,
    'ZEN_MODEL_PROFILE_GENERATION_ALREADY_BOUND',
    zenModelRepositoryCorePath,
  );
  assertIncludes(
    zenModelRepositorySource,
    'extends ZenModelRepositoryCore',
    zenModelRepositoryPath,
  );
  assertIncludes(
    firstVisionClientSource,
    'MESSAGE_ACTIONS.GET_FIRST_VISION_PROGRESSION_SNAPSHOT',
    firstVisionClientPath,
  );
  assertIncludes(
    firstVisionClientSource,
    'MESSAGE_ACTIONS.RECORD_FIRST_VISION_PRESENTED',
    firstVisionClientPath,
  );
  assertIncludes(
    firstVisionClientSource,
    'MESSAGE_ACTIONS.RECORD_FIRST_VISION_SPENT',
    firstVisionClientPath,
  );
  assertExcludes(
    firstVisionClientSource,
    'DEBUG_',
    firstVisionClientPath,
  );
  assertExcludes(
    firstVisionClientSource,
    'ProgressionUnlockDebug',
    firstVisionClientPath,
  );

  [
    'ENTROPY_FIRST_VISION_DEVELOPMENT_PROJECTION_DEV',
    'requireProgressionUnlockDebugProjection(',
    'PROGRESSION_UNLOCK_DEBUG_MODES.FIRST_VISION_PREVIEW',
    'completeProgressionUnlockDebugReplay(',
    'recordCanonical',
  ].forEach((token) => assertIncludes(
    firstVisionDevelopmentProjectionDevSource,
    token,
    firstVisionDevelopmentProjectionDevPath,
  ));
  [
    'ProgressionRepository',
    'resetProgressionFirstVisionState',
    'DEBUG_RESET_FIRST_VISION_PROGRESSION',
  ].forEach((token) => assertExcludes(
    firstVisionDevelopmentProjectionDevSource,
    token,
    firstVisionDevelopmentProjectionDevPath,
  ));
  [
    'recordCanonical',
    'canonicalWrites: true',
  ].forEach((token) => assertIncludes(
    firstVisionDevelopmentProjectionPublicSource,
    token,
    firstVisionDevelopmentProjectionPublicPath,
  ));
  [
    'ENTROPY_FIRST_VISION_DEVELOPMENT_PROJECTION_DEV',
    'PROGRESSION_UNLOCK_DEBUG_',
    'developmentProjection',
  ].forEach((token) => assertExcludes(
    firstVisionDevelopmentProjectionPublicSource,
    token,
    firstVisionDevelopmentProjectionPublicPath,
  ));

  assertIncludes(progressionServiceSource, 'quiesceForProfileMutation', progressionServicePath);
  assertIncludes(progressionServiceSource, 'clearForProfileMutation', progressionServicePath);
  assertIncludes(progressionServiceSource, 'repository.resetForProfileMutation(', progressionServicePath);
  assertIncludes(progressionServiceSource, 'PROGRESSION_PROFILE_MUTATION_RESET_OWNER_REQUIRED', progressionServicePath);
  assertExcludes(
    progressionServiceSource,
    'resumeAfterProfileMutation',
    progressionServicePath,
    `${progressionServicePath} must remain terminally quiesced; only a fresh worker may bind the next profile generation.`,
  );
  assertIncludes(progressionServiceSource, 'assertNormalOperationAdmission', progressionServicePath);
  assertIncludes(progressionServiceSource, 'expectedProfileGeneration', progressionServicePath);
  assertIncludes(
    progressionSnapshotSource,
    'PROGRESSION_FIRST_VISION_SPENT_REQUIRES_PRESENTED',
    progressionSnapshotPath,
  );
  assertIncludes(progressionServiceSource, 'profileGenerationCapturePromise', progressionServicePath);
  assertIncludes(
    progressionServiceSource,
    'Promise.all([\n      profileGenerationCapturePromise,\n      operationQueue,',
    progressionServicePath,
  );
  assertExcludes(
    ceremonyPreviewSource,
    'readSnapshot(',
    ceremonyPreviewPath,
    `${ceremonyPreviewPath} must stay a session-preview command surface and not evaluate progression snapshots.`,
  );

  assertIncludes(backgroundCoreServicesSource, 'createProgressionFactsProvider({', backgroundCoreServicesPath);
  ['onCommitted:', 'buildProgressionStateChangedMessage']
    .forEach(token => assertIncludes(backgroundCoreServicesSource, token, backgroundCoreServicesPath));
  const progressionStateChangedPath = 'src/domains/progression/contracts/progressionStateChanged.js';
  const progressionStateChangedSource = await readUtf8(progressionStateChangedPath);
  ['Object.keys(message).length === 2', 'MESSAGE_TYPES.PROGRESSION_STATE_CHANGED', 'profileGeneration']
    .forEach(token => assertIncludes(progressionStateChangedSource, token, progressionStateChangedPath));
  ['snapshot:', 'revision:'].forEach(token => assertExcludes(progressionStateChangedSource, token,
    progressionStateChangedPath, 'The progression commit signal must invalidate owner reads, not carry a second state projection.'));
  assertIncludes(backgroundCoreServicesSource, 'getStatsFactsRange: statsRuntimeService.getStatsFactsRange', backgroundCoreServicesPath);
  assertIncludes(backgroundCoreServicesSource, 'factsProvider: progressionFactsProvider', backgroundCoreServicesPath);
  assertIncludes(
    backgroundCoreServicesSource,
    'profileLifecycleRepository: profileResetLifecycleRepository',
    backgroundCoreServicesPath,
  );
  assertIncludes(backgroundCoreServicesSource, 'progressionRepository,', backgroundCoreServicesPath);
  assertIncludes(
    backgroundCoreServicesSource,
    'getProgressionUnlockDebugRepository()',
    backgroundCoreServicesPath,
  );
  assertExcludes(
    backgroundCoreServicesSource,
    'ProgressionUnlockDebugRepository.js',
    backgroundCoreServicesPath,
  );
  assertIncludes(backgroundCoreServicesSource, 'createArtifactDisclosureCoordinator({', backgroundCoreServicesPath);
  assertIncludes(backgroundCoreServicesSource, 'createArtifactDisclosureBootstrap({', backgroundCoreServicesPath);
  assertIncludes(progressionFactsProviderSource, 'PROGRESSION_FACTS_STATS_RANGE_SOURCE_REQUIRED', progressionFactsProviderPath);
  assertIncludes(progressionFactsProviderSource, 'await getStatsFactsRange({', progressionFactsProviderPath);
  assertExcludes(progressionFactsProviderSource, 'statsRepository', progressionFactsProviderPath);
  assertExcludes(progressionFactsProviderSource, '.getStatsRange(', progressionFactsProviderPath);

  [
    [toolsControllerPath, toolsControllerSource],
    [navCuePath, navCueSource],
  ].forEach(([filePath, source]) => {
    assertIncludes(source, 'useArtifactDisclosureSnapshot', filePath);
    assertExcludes(source, 'ProgressionRepository', filePath);
    assertExcludes(source, 'buildProgressionArtifactDisclosurePlan', filePath);
    assertExcludes(source, 'buildArtifactDisclosureSignals', filePath);
  });
  assertIncludes(
    disclosureRouteSource,
    'readArtifactDisclosureSnapshot({',
    disclosureRoutePath,
  );
  assertIncludes(disclosureRouteSource, 'isTrustedExtensionPageSender(sender)', disclosureRoutePath);
  assertIncludes(disclosureRouteSource, 'isTrustedDashboardPageSender(sender)', disclosureRoutePath);
  assertIncludes(disclosureRouteSource, 'recordDashboardFirstVisit({', disclosureRoutePath);
  assertIncludes(disclosureRouteSource, 'readFirstVisionSnapshot({', disclosureRoutePath);
  assertIncludes(disclosureRouteSource, 'recordFirstVisionPresented({', disclosureRoutePath);
  assertIncludes(disclosureRouteSource, 'recordFirstVisionSpent({', disclosureRoutePath);
  assertIncludes(disclosureRouteSource, 'resetFirstVisionForDebug({', disclosureRoutePath);
  assertIncludes(
    disclosureRouteSource,
    '...(BUILD_INCLUDE_DEBUG_TOOLS ? {',
    disclosureRoutePath,
  );
  assertIncludes(
    disclosureRouteSource,
    '[PROGRESSION_DEBUG_ACTIONS.RESET_FIRST_VISION]',
    disclosureRoutePath,
  );
  assertExcludes(
    disclosureRouteSource,
    'MESSAGE_ACTIONS.DEBUG_',
    disclosureRoutePath,
  );
  assertIncludes(disclosureRouteSource, 'expectedProfileGeneration: profileGeneration', disclosureRoutePath);
  assertIncludes(
    backgroundMessageRouterSource,
    'PROFILE_GENERATION_RESPONSE_ACTIONS',
    backgroundMessageRouterPath,
  );
  assertIncludes(
    backgroundMessageRouterSource,
    'response.profileGeneration',
    backgroundMessageRouterPath,
  );
  assertIncludes(
    backgroundMessageRouterSource,
    "from '@progression-debug-actions'",
    backgroundMessageRouterPath,
  );
  assertExcludes(
    backgroundMessageRouterSource,
    'MESSAGE_ACTIONS.DEBUG_',
    backgroundMessageRouterPath,
  );

  [
    'PROGRESSION_UNLOCK_DEBUG_CONTRACT,',
    'buildDefaultProgressionUnlockDebugProjection()',
    'setCanonicalMode(',
    'projectArtifactDisclosureSnapshot(',
  ].forEach((token) => assertIncludes(
    progressionUnlockDebugRepositorySource,
    token,
    progressionUnlockDebugRepositoryPath,
  ));
  ['migrateStoredV1Projection', 'migrateStoredV2Projection', 'LEGACY_PROGRESSION_UNLOCK_DEBUG_CONTRACT']
    .forEach((token) => assertExcludes(progressionUnlockDebugRepositorySource, token, progressionUnlockDebugRepositoryPath));
  assertIncludes(
    progressionUnlockDebugRepositorySource,
    'clearStoredProjectionForQaProvisioning()',
    progressionUnlockDebugRepositoryPath,
  );
  assertIncludes(
    progressionUnlockDebugRepositorySource,
    'await this.sessionRepository.remove(STORAGE_SESSION_KEYS.PROGRESSION_UNLOCK_DEBUG)',
    progressionUnlockDebugRepositoryPath,
  );
  [
    'DEBUG_SET_PROGRESSION_UNLOCK_DAY',
    'DEBUG_SET_PROGRESSION_UNLOCK_MODE',
    'DEBUG_CLEAR_PROGRESSION_UNLOCK_OVERRIDE',
    'DEBUG_RESET_FIRST_VISION_PROGRESSION',
    'QA_PROVISION_CANONICAL_PROGRESSION',
    'QA_CLEAR_PROGRESSION_SESSION_STATE',
  ].forEach((token) => assertIncludes(
    progressionDebugActionsDevSource,
    token,
    progressionDebugActionsDevPath,
  ));
  [
    'DEBUG_SET_',
    'DEBUG_CLEAR_',
    'DEBUG_RESET_',
  ].forEach((token) => assertExcludes(
    progressionDebugActionsPublicSource,
    token,
    progressionDebugActionsPublicPath,
  ));
  assertIncludes(
    progressionDebugRepositoryDevSource,
    "from './ProgressionUnlockDebugRepository.js'",
    progressionDebugRepositoryDevPath,
  );
  assertIncludes(
    progressionDebugRepositoryPublicSource,
    'return null;',
    progressionDebugRepositoryPublicPath,
  );
  assertExcludes(
    progressionDebugRepositoryPublicSource,
    "from './ProgressionUnlockDebugRepository.js'",
    progressionDebugRepositoryPublicPath,
  );
  assertIncludes(disclosureBootstrapSource, 'progressionService.initializeArtifactDisclosure()', disclosureBootstrapPath);
  assertIncludes(disclosureBootstrapSource, 'progressionService.observeProtectedSiteRegistration({', disclosureBootstrapPath);
  assertExcludes(disclosureBootstrapSource, 'resolveGrandfatheredFamilyIds', disclosureBootstrapPath);
  assertExcludes(disclosureBootstrapSource, 'progressionRepository', disclosureBootstrapPath);
  assertIncludes(
    trackingSettlementSource,
    "getSiteCategory(hostname, settingsCache, now) === 'blocked'",
    trackingSettlementPath,
  );
  assertIncludes(
    trackingSettlementSource,
    'await recordManagedProtectedVisit({ hostname, atMs: now })',
    trackingSettlementPath,
  );

  assertIncludes(
    progressionPolicySource,
    'defaultOrder: ARTIFACT_DISCLOSURE_FAMILY_ORDER',
    progressionPolicyPath,
  );
  assertIncludes(
    progressionPolicySource,
    'PROGRESSION_ARTIFACT_PRESENTATION_POLICY',
    progressionPolicyPath,
  );
  assertIncludes(
    progressionPolicySource,
    'PROGRESSION_ARTIFACT_EXPERIMENT_POLICY',
    progressionPolicyPath,
  );
  assertExcludes(
    progressionPolicySource,
    'PROGRESSION_ARTIFACT_DISCLOSURE_POLICY',
    progressionPolicyPath,
    `${progressionPolicyPath} must not expose a broad second artifact disclosure policy.`,
  );
  assertExcludes(
    progressionPolicySource,
    'controlSurface:',
    progressionPolicyPath,
    `${progressionPolicyPath} must not duplicate dashboard artifact control-surface ownership.`,
  );
  assertExcludes(
    progressionPolicySource,
    'semanticTrigger:',
    progressionPolicyPath,
    `${progressionPolicyPath} must not turn interpretation signals into child disclosure gates.`,
  );
  assertIncludes(
    disclosurePlannerSource,
    'const orderedArtifactIds = defaultOrder;',
    disclosurePlannerPath,
  );
  assertIncludes(
    disclosureExperimentSource,
    'PROGRESSION_ARTIFACT_EXPERIMENT_POLICY',
    disclosureExperimentPath,
  );

  const experimentalPlannerConsumers = new Set([
    disclosureExperimentPath,
    'src/domains/progression/index.js',
    disclosurePlannerPath,
  ]);
  const zenExplicitGenerationBindCallsites = new Set([
    dashboardProfileMutationLifecyclePath,
    'src/themes/plugins/zen/contracts/ZenWorkerProfileGenerationContract.js',
  ]);
  const sourceFiles = await listSourceFiles('src');
  for (const filePath of sourceFiles) {
    if (filePath.startsWith('src/apps/dashboard/')) {
      const dashboardSource = await readUtf8(filePath);
      if (dashboardSource.includes('ProgressionRepository')) {
        fail(`${filePath} must not import the production progression repository into Dashboard.`);
      }
      if (dashboardSource.includes('createProgressionService')) {
        fail(`${filePath} must not create a second production progression service in Dashboard.`);
      }
    }
    const source = await readUtf8(filePath);
    assertExcludes(source, 'PROGRESSION_UNLOCK_TARGET_DAY_COUNT', filePath,
      `${filePath} must not restore a global unlock target shared by independent consumer policies.`);
    if (/\brecordProgressionEvent\s*\(/.test(source)
      && ![progressionSnapshotPath, progressionServicePath].includes(filePath)) {
      fail(`${filePath} must not write durable progression events outside the canonical service/model owner.`);
    }
    if (/\bcreateProgressionService\s*\(/.test(source)
      && ![progressionServicePath, backgroundCoreServicesPath].includes(filePath)) {
      fail(`${filePath} must not construct a second production progression service.`);
    }
    if (/\bfrom\s+['"][^'"]*\/ProgressionRepository\.js['"]/.test(source)
      && filePath !== backgroundCoreServicesPath) {
      fail(`${filePath} must receive progression commands/queries from the service instead of importing its durable repository.`);
    }
    if (/\bfrom\s+['"][^'"]*\/ProgressionStateStore\.js['"]/.test(source)
      && filePath !== 'src/platform/storage/progression/ProgressionRepository.js') {
      fail(`${filePath} must not bypass the progression repository to access its typed store.`);
    }
    if (
      source.includes('.bindToProfileGeneration(')
      && !zenExplicitGenerationBindCallsites.has(filePath)
    ) {
      fail(`${filePath} must not bind a Zen profile generation outside the page/worker lease owners.`);
    }
    if (experimentalPlannerConsumers.has(filePath)) continue;
    if (
      source.includes('buildProgressionArtifactDisclosurePlan')
      || source.includes('resolveProgressionArtifactDisclosureOrder')
    ) {
      fail(`${filePath} must not consume the experiment-only artifact disclosure planner.`);
    }
  }

  console.log('[progression-runtime-architecture] PASS: the sole background progression owner, profile-generation admission, and durable disclosure paths stay canonical.');
};

main().catch((error) => {
  console.error('[progression-runtime-architecture] Unexpected error:', error);
  process.exit(1);
});
