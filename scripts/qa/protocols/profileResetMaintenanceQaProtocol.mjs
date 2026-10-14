import { ExtensionChromiumHarness } from '../../e2e/extensionChromiumHarness.mjs';
import { completeMv3ProfileMutationHandoff } from '../../e2e/mv3ProfileMutationHandoff.mjs';
import { defineEntropyQaAttachedArtifactStage, ENTROPY_QA_TRUSTED_PAGE_PATH } from '../../e2e/qaProfileArtifactSlot.mjs';
import { MESSAGE_ACTIONS } from '../../../src/platform/messaging/contracts/messageTypes.js';
import { normalizeProfileMutationResponseHandoff } from '../../../src/platform/messaging/contracts/profileMutationResponseHandoff.js';
import { normalizeSettingsProfileRecovery } from '../../../src/platform/storage/settings/SettingsProfileRecoveryContract.js';
import {
  proveEntropyAttachedArtifactRuntimeReadiness,
  requireEntropyProfileResetMaintenanceEligibility,
} from './attachOnlyActivePageAdapter.mjs';
import { sendTrustedRuntimeMessage } from './gateRuntimeQaProtocol.mjs';

const TARGET_ID = 'maintenance/profile-reset';
const MAINTENANCE_SCOPE = 'authorized_settings_contract_reset_and_runtime_readiness';
const RESET_REFUSAL_CODES = new Set([
  'UNAUTHORIZED_RUNTIME_SENDER', 'HIGH_SECURITY_PASSCODE_REQUIRED',
  'RESET_AUTH_REQUIRED', 'RESET_AUTH_HASH_INVALID', 'RESET_AUTH_FAILED',
]);

function requireResetEligibility(eligibility, artifact) {
  if (eligibility?.status !== 'profile_reset_eligible' || eligibility.generationMatch !== true
    || eligibility.artifactRuntimeIdentity?.status !== 'artifact_runtime_identity_verified'
    || eligibility.artifactRuntimeIdentity.buildId !== artifact.buildId
    || eligibility.artifactRuntimeIdentity.releaseProfile !== artifact.releaseProfile) {
    throw new Error('QA_PROFILE_RESET_MAINTENANCE_ELIGIBILITY_REQUIRED');
  }
  const recovery = normalizeSettingsProfileRecovery(eligibility.recovery);
  if (recovery.failureCode !== 'SETTINGS_STORED_VALUE_INVALID'
    || recovery.documentKey !== 'settings.core' || recovery.key !== 'nudgeConfig') {
    throw new Error('QA_PROFILE_RESET_MAINTENANCE_RECOVERY_MISMATCH');
  }
  return recovery;
}

function requireResetResponse(response) {
  if (response?.success !== true) {
    const refusal = new Error('QA_PROFILE_RESET_MAINTENANCE_RESET_REFUSED');
    refusal.code = 'QA_PROFILE_RESET_MAINTENANCE_RESET_REFUSED';
    if (RESET_REFUSAL_CODES.has(response?.error)) {
      refusal.cause = new Error(response.error);
      refusal.cause.code = response.error;
    }
    throw refusal;
  }
  if (Object.hasOwn(response, 'warnings')
    && (!Array.isArray(response.warnings) || response.warnings.length !== 0)) {
    throw new Error('QA_PROFILE_RESET_MAINTENANCE_RESET_WARNINGS');
  }
  const handoff = normalizeProfileMutationResponseHandoff(response.profileMutationHandoff);
  if (handoff.operation !== 'full_reset') {
    throw new Error('QA_PROFILE_RESET_MAINTENANCE_HANDOFF_OPERATION_MISMATCH');
  }
  return handoff;
}

function requireResetCompletion(completion) {
  const validWorkerId = value => typeof value === 'string' && value.length > 0
    && value === value.trim();
  if (completion?.operation !== 'full_reset' || completion.ackStarted !== true
    || !validWorkerId(completion.previousTargetId) || !validWorkerId(completion.revivedTargetId)
    || completion.previousTargetId === completion.revivedTargetId) {
    throw new Error('QA_PROFILE_RESET_MAINTENANCE_HANDOFF_COMPLETION_REQUIRED');
  }
}

// Explicit maintenance only. The product reset owner retains authentication and
// storage mutation authority; startup still returns the ordinary strict receipt.
export async function executeQaProtocol({ plan, artifact, browser, evidence,
  recoveryJournal, registerCleanup, reportBrowserGpuCapability, signal }) {
  if (plan.parameters?.confirmEraseEntropyData !== true) {
    throw new Error('QA_PROFILE_RESET_MAINTENANCE_CONFIRMATION_REQUIRED');
  }
  if (plan.target?.id !== TARGET_ID || plan.protocolOptions?.scope !== MAINTENANCE_SCOPE) {
    throw new Error('QA_PROFILE_RESET_MAINTENANCE_TARGET_REQUIRED');
  }
  signal?.throwIfAborted();
  const artifactIdentity = { artifactId: artifact.id, inputDigest: artifact.inputDigest,
    buildId: artifact.buildId, releaseProfile: artifact.releaseProfile };
  const temporaryManifest = { requiredPermissions: [], requiredHostPermissions: [] };
  const attachedArtifactStage = defineEntropyQaAttachedArtifactStage({ browser,
    browserExecution: plan.browserExecution, sourceDir: artifact.path,
    artifactIdentity, temporaryManifest });
  let resetPreparation = null;
  let resetPreparationAttempted = false;
  let startupPreparationOpen = true;
  let harness;
  const assertResetPreparationActive = (context) => {
    signal?.throwIfAborted();
    if (!startupPreparationOpen || context.harness !== harness
      || harness.childCloseOperation || !harness.cdp
      || !harness.extensionId || context.extensionId !== harness.extensionId) {
      throw new Error('QA_PROFILE_RESET_MAINTENANCE_PREPARATION_CLOSED');
    }
  };
  const prepareResetAndReadiness = async (context) => {
    if (resetPreparationAttempted) throw new Error('QA_PROFILE_RESET_MAINTENANCE_ALREADY_REQUESTED');
    resetPreparationAttempted = true;
    assertResetPreparationActive(context);
    const eligibility = await requireEntropyProfileResetMaintenanceEligibility({
      ...context, targetId: TARGET_ID,
    });
    const recovery = requireResetEligibility(eligibility, artifact);
    assertResetPreparationActive(context);
    const response = await sendTrustedRuntimeMessage(harness, { action: MESSAGE_ACTIONS.RESET_APP_DATA });
    const handoff = requireResetResponse(response);
    await evidence.event('QA_PROFILE_RESET_MAINTENANCE_RESET_ACCEPTED', {
      operation: handoff.operation, recovery,
    });
    assertResetPreparationActive(context);
    const completion = await completeMv3ProfileMutationHandoff(harness, response, {
      wakeRuntime: () => proveEntropyAttachedArtifactRuntimeReadiness(context),
    });
    requireResetCompletion(completion);
    assertResetPreparationActive(context);
    resetPreparation = Object.freeze({
      operation: completion.operation,
      ackStarted: completion.ackStarted, previousTargetId: completion.previousTargetId,
      revivedTargetId: completion.revivedTargetId, recovery,
    });
    await evidence.event('QA_PROFILE_RESET_MAINTENANCE_PREPARED', resetPreparation);
    assertResetPreparationActive(context);
    return completion.value;
  };
  harness = new ExtensionChromiumHarness({ chromePath: browser.chrome,
    distDir: browser.extensionSlot, rootDir: plan.rootDir, headless: plan.browserExecution.headless,
    browserExecution: plan.browserExecution, audioPolicy: plan.browserExecution.audioPolicy,
    launchEnvironment: browser.launchEnvironment, renderingRequirement: plan.browserExecution.renderingRequirement,
    cdpEndpoint: browser.cdpEndpoint, expectedBrowserIdentity: browser.browserIdentity,
    attachedArtifactStage, keepTemp: false, qaProfileDir: browser.profile,
    qaProfileDirectory: browser.profileDirectory, loadInPlace: true,
    trustedPagePath: ENTROPY_QA_TRUSTED_PAGE_PATH,
    attachedArtifactRuntimeReadiness: prepareResetAndReadiness, recoveryJournal });
  registerCleanup('profile_reset_maintenance_browser', () => harness.close());
  try { await harness.start(); } finally { startupPreparationOpen = false; }
  await reportBrowserGpuCapability(harness.gpuCapability);
  const activation = harness.attachedArtifactSyncReceipt;
  if (!resetPreparation || activation?.status !== 'managed_artifact_runtime_ready'
    || activation.runtimeReadyProved !== true || typeof activation.runtimeRefresh !== 'boolean') {
    throw new Error('QA_PROFILE_RESET_MAINTENANCE_ACTIVATION_RECEIPT_REQUIRED');
  }
  const readiness = activation.runtimeReadiness;
  if (readiness?.runtimeReady !== true || readiness.artifactRuntimeIdentity?.buildId !== artifact.buildId) {
    throw new Error('QA_PROFILE_RESET_MAINTENANCE_LIVE_BUILD_UNPROVEN');
  }
  const receipt = Object.freeze({ status: 'PASS', buildId: artifact.buildId,
    extensionId: activation.extensionId, verdictScope: 'infrastructure', scope: MAINTENANCE_SCOPE,
    activationAction: activation.activationAction, runtimeReadyProved: true,
    resetPreparation, readiness });
  await evidence.event('QA_PROFILE_RESET_MAINTENANCE_READY', receipt);
  return receipt;
}
