import {
  inspectQaEnvironment,
} from '../environment/qaDoctor.mjs';
import {
  verifyQaPersistentBrowserIdentity,
} from '../browser/qaPersistentBrowserLifecycle.mjs';
import {
  acquireQaBrowserBroker,
} from './QaBrowserBroker.mjs';
import {
  requiresBrowserNoFocusBaselinePage,
} from '../../browser-qa/contracts/browserExecutionContract.mjs';

function allowsManagedExtensionSlotPendingStage(environment, executionPlan) {
  return environment?.browserClass === 'managed_persistent'
    && environment.processOwnership === 'attach_only'
    && environment.lifecyclePolicy === 'managed'
    && executionPlan?.processOwnership === 'attach_only'
    && executionPlan.startPolicy === 'managed_ensure_before_attach'
    && executionPlan.extensionRuntime === 'required';
}

export class QaBrowserLease {
  constructor({
    rootDir,
    ownerId,
    ownedSessionId = null,
    environment,
    executionPlan = null,
    evidence,
    doctorOptions = {},
    allowInitialWindowFocusOnce = false,
    allowOperatorHandoffFirstPage = false,
    brokerFactory = acquireQaBrowserBroker,
    identityVerifier = verifyQaPersistentBrowserIdentity,
    identityAttachmentFactory = null,
  }) {
    this.rootDir = rootDir;
    this.ownerId = ownerId;
    this.ownedSessionId = ownedSessionId;
    this.environment = environment;
    this.executionPlan = executionPlan;
    this.evidence = evidence;
    this.doctorOptions = doctorOptions;
    this.allowInitialWindowFocusOnce = allowInitialWindowFocusOnce === true;
    this.allowOperatorHandoffFirstPage = allowOperatorHandoffFirstPage === true;
    this.brokerFactory = brokerFactory;
    this.identityVerifier = identityVerifier;
    this.identityAttachmentFactory = identityAttachmentFactory;
    this.brokerLease = null;
    this.effectiveEnvironment = null;
    this.browserIdentity = null;
    this.baselinePageTargetCount = null;
    this.dedicatedProfileOwnership = null;
    this.extensionSlotAdmission = null;
  }

  async acquire() {
    if (!this.environment) return null;
    let effectiveEnvironment = this.environment;
    if (
      this.environment.processOwnership === 'owned'
      && !this.environment.chrome
    ) {
      const { chromium } = await import('playwright');
      effectiveEnvironment = Object.freeze({
        ...this.environment,
        chrome: chromium.executablePath(),
      });
    }
    this.effectiveEnvironment = effectiveEnvironment;
    const noFocusBaselineRequired = requiresBrowserNoFocusBaselinePage(
      this.executionPlan,
    );
    const pageTargetInventoryRequired = noFocusBaselineRequired
      || this.allowInitialWindowFocusOnce
      || this.allowOperatorHandoffFirstPage;
    this.brokerLease = await this.brokerFactory({
      rootDir: this.rootDir,
      environment: effectiveEnvironment,
      ownerId: this.ownerId,
      ...(this.ownedSessionId === null ? {} : { ownedSessionId: this.ownedSessionId }),
    });
    try {
      await this.evidence.event('QA_BROWSER_BROKER_ACQUIRED', {
        environmentId: effectiveEnvironment.id,
        owner: this.brokerLease.owner,
      });
      const inspection = await inspectQaEnvironment(
        effectiveEnvironment,
        {
          ...this.doctorOptions,
          includeCdpTargetCounts: pageTargetInventoryRequired,
          minimumPageTargetCount: noFocusBaselineRequired
            && !this.allowInitialWindowFocusOnce
            && !this.allowOperatorHandoffFirstPage ? 1 : 0,
          allowManagedExtensionSlotBootstrap:
            allowsManagedExtensionSlotPendingStage(
              effectiveEnvironment,
              this.executionPlan,
            ),
        },
      );
      this.dedicatedProfileOwnership = inspection.checks?.dedicatedProfileOwnership || null;
      this.extensionSlotAdmission = inspection.checks?.extensionSlot === 'pending_stage'
        ? 'pending_stage'
        : inspection.checks?.extensionSlot === 'directory'
          ? 'ready'
          : null;
      this.baselinePageTargetCount = inspection.checks?.cdp?.targetCounts?.page ?? null;
      await this.evidence.event('QA_BROWSER_PREFLIGHT', inspection);
      let browserIdentity = null;
      if (
        inspection.status === 'ready'
        && effectiveEnvironment.processOwnership === 'attach_only'
      ) {
        if (
          !effectiveEnvironment.installationId
          || !effectiveEnvironment.profileSlotId
          || !effectiveEnvironment.profileSlot
          || !effectiveEnvironment.chrome
          || !effectiveEnvironment.profile
          || !effectiveEnvironment.profileDirectory
          || !effectiveEnvironment.cdpEndpoint
        ) {
          throw new Error(
            `QA_ATTACHED_BROWSER_DECLARED_IDENTITY_REQUIRED:${effectiveEnvironment.id}`,
          );
        }
        const profileSlot = effectiveEnvironment.profileSlot;
        if (
          profileSlot.id !== effectiveEnvironment.profileSlotId
          || profileSlot.installationId !== effectiveEnvironment.installationId
          || profileSlot.installation?.executable !== effectiveEnvironment.chrome
          || profileSlot.userDataDir !== effectiveEnvironment.profile
          || profileSlot.profileDirectory !== effectiveEnvironment.profileDirectory
          || profileSlot.cdpEndpoint !== effectiveEnvironment.cdpEndpoint
        ) {
          throw new Error(
            `QA_ATTACHED_BROWSER_PROFILE_SLOT_MISMATCH:${effectiveEnvironment.id}`,
          );
        }
        browserIdentity = await this.identityVerifier({
          rootDir: this.rootDir,
          profileSlot,
          ownerId: `${this.ownerId}:identity`,
          ...(this.identityAttachmentFactory
            ? { attachmentFactory: this.identityAttachmentFactory }
            : {}),
        });
        if (browserIdentity?.status !== 'declared_identity_verified') {
          throw new Error(
            `QA_ATTACHED_BROWSER_DECLARED_IDENTITY_UNVERIFIED:${effectiveEnvironment.id}`,
          );
        }
        await this.evidence.event('QA_BROWSER_IDENTITY_VERIFIED', browserIdentity);
        this.browserIdentity = browserIdentity;
      }
      await this.brokerLease.updateRuntime({
        status: inspection.status,
        browser: inspection.checks?.cdp?.browser || null,
        failures: inspection.failures,
        identityStatus: browserIdentity?.status || null,
        ...(inspection.checks?.cdp?.targetCounts
          ? {
            targetCount: inspection.checks.cdp.targetCounts.total,
            pageTargetCount: inspection.checks.cdp.targetCounts.page,
          }
          : {}),
      });
      if (inspection.status !== 'ready') {
        const error = new Error(
          `QA_BROWSER_ENVIRONMENT_BLOCKED:${effectiveEnvironment.id}:${inspection.failures.join(',')}`,
        );
        if (inspection.failures.includes('no_focus_baseline_page_missing')) {
          error.code = 'QA_ATTACH_ONLY_NO_FOCUS_BASELINE_PAGE_REQUIRED';
          error.nextAction = 'open_one_tab_in_declared_qa_browser_then_retry';
        }
        if (inspection.failures.includes('cdp_unavailable')) {
          error.code = 'QA_CDP_UNAVAILABLE';
          error.nextAction = effectiveEnvironment.lifecyclePolicy === 'managed'
            ? `npm run qa -- browser ensure ${effectiveEnvironment.id}`
            : 'start_or_reconnect_declared_qa_chrome';
        }
        throw error;
      }
    } catch (error) {
      const releaseError = await this.brokerLease.release()
        .then(() => null, (brokerReleaseError) => brokerReleaseError);
      if (releaseError) {
        const failure = new AggregateError(
          [error, releaseError],
          `QA_BROWSER_BROKER_PREFLIGHT_ROLLBACK_FAILED:${error?.message || error}`,
          { cause: error },
        );
        failure.code = 'QA_BROWSER_BROKER_PREFLIGHT_ROLLBACK_FAILED';
        throw failure;
      }
      this.brokerLease = null;
      throw error;
    }
    return Object.freeze({
      environmentId: effectiveEnvironment.id,
      browserClass: effectiveEnvironment.browserClass,
      processOwnership: effectiveEnvironment.processOwnership,
      lifecyclePolicy: effectiveEnvironment.lifecyclePolicy,
      installationId: effectiveEnvironment.installationId,
      profileSlotId: effectiveEnvironment.profileSlotId,
      focusPolicy: effectiveEnvironment.focusPolicy,
      audioPolicy: effectiveEnvironment.audioPolicy,
      cdpEndpoint: effectiveEnvironment.cdpEndpoint,
      profile: effectiveEnvironment.profile,
      profileDirectory: effectiveEnvironment.profileDirectory,
      chrome: effectiveEnvironment.chrome,
      extensionSlot: effectiveEnvironment.extensionSlot,
      extensionSlotAdmission: this.extensionSlotAdmission,
      browserIdentity: this.browserIdentity,
      baselinePageTargetCount: this.baselinePageTargetCount,
      initialWindowFocusOnceAllowed: this.allowInitialWindowFocusOnce,
      operatorHandoffFirstPageAllowed: this.allowOperatorHandoffFirstPage,
      dedicatedProfileOwnership: this.dedicatedProfileOwnership,
      presentation: this.executionPlan?.presentation || null,
      headless: this.executionPlan?.headless ?? null,
      startPolicy: this.executionPlan?.startPolicy || null,
      displayPolicy: this.executionPlan?.displayPolicy || null,
      documentVisibility: this.executionPlan?.documentVisibility || null,
      targetActivation: this.executionPlan?.targetActivation || null,
      osFocus: this.executionPlan?.osFocus || null,
      gpuRequirement: this.executionPlan?.gpuRequirement || null,
      webglRequirement: this.executionPlan?.webglRequirement || null,
      extensionRuntime: this.executionPlan?.extensionRuntime || null,
      effectiveAudioPolicy: this.executionPlan?.audioPolicy
        || effectiveEnvironment.audioPolicy,
      cleanupPolicy: effectiveEnvironment.processOwnership === 'attach_only'
        ? 'preserve_process'
        : 'protocol_owned',
    });
  }

  async release() {
    const broker = await this.brokerLease?.release();
    this.brokerLease = null;
    return Object.freeze({
      resource: 'browser',
      status: 'released',
      action: this.environment?.processOwnership === 'attach_only'
        ? 'detached_only'
        : 'process_ownership_delegated_to_protocol',
      broker: broker || null,
    });
  }
}
