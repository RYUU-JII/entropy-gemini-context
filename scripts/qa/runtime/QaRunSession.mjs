import path from 'node:path';

import {
  loadQaProtocol,
} from '../catalog/qaProtocolRegistry.mjs';
import {
  classifyQaErrorStatus,
  serializeQaError,
} from '../contracts/qaEvidenceContract.mjs';
import {
  QA_RUN_STATUSES,
} from '../contracts/qaTargetContract.mjs';
import {
  QaEvidenceWriter,
} from '../evidence/QaEvidenceWriter.mjs';
import {
  QaRecoveryJournal,
} from '../recovery/QaRecoveryJournal.mjs';
import {
  QaArtifactLease,
} from '../resources/QaArtifactLease.mjs';
import {
  QaBrowserLease,
} from '../resources/QaBrowserLease.mjs';
import {
  QaInitialWindowFocusAnchorLease,
} from '../resources/QaInitialWindowFocusAnchorLease.mjs';
import {
  QaAttachedBrowserOsFocusGuard,
} from '../resources/QaAttachedBrowserOsFocusGuard.mjs';
import {
  QaDisplayLease,
} from '../resources/QaDisplayLease.mjs';
import {
  runQaManagedPersistentBrowserAction,
} from '../browser/qaPersistentBrowserLifecycle.mjs';
import {
  focusQaManagedBrowserTargetForOperator,
  focusQaOwnedBrowserTargetForPreparation,
  requireQaWindowPresentationReceipt,
} from '../browser/qaOperatorBrowserWindow.mjs';
import {
  BROWSER_START_POLICIES,
} from '../../browser-qa/contracts/browserExecutionContract.mjs';
import {
  allowsQaInitialWindowFocusOnce,
  allowsQaOwnedInitialWindowPresentation,
  requireQaOwnedInitialWindowPresentationPolicy,
} from '../contracts/qaInitialWindowFocusPolicy.mjs';
import {
  QaResourceCoordinator,
} from './QaResourceCoordinator.mjs';
import {
  isQaChildCleanupFailure,
  runQaChildProcess,
} from './qaChildProcess.mjs';

const TERMINAL_STATUSES = new Set([
  QA_RUN_STATUSES.PASS,
  QA_RUN_STATUSES.FAIL,
  QA_RUN_STATUSES.BLOCKED,
  QA_RUN_STATUSES.INCONCLUSIVE,
]);

const OPERATOR_HANDOFF_POLICY = Object.freeze({
  focus: 'operator_request_once',
  lifetime: 'until_explicit_cancel',
  cleanup: 'exact_owned_targets',
});

function hasExactOperatorHandoffPolicy(policy) {
  return policy
    && typeof policy === 'object'
    && !Array.isArray(policy)
    && JSON.stringify(Object.keys(policy).sort())
      === JSON.stringify(Object.keys(OPERATOR_HANDOFF_POLICY).sort())
    && policy.focus === OPERATOR_HANDOFF_POLICY.focus
    && policy?.lifetime === OPERATOR_HANDOFF_POLICY.lifetime
    && policy?.cleanup === OPERATOR_HANDOFF_POLICY.cleanup;
}

function resolveOperatorHandoffAuthorization(plan, authorized) {
  if (typeof authorized !== 'boolean') {
    throw new Error('QA_OPERATOR_HANDOFF_AUTHORIZATION_INVALID');
  }
  if (!authorized) return false;
  if (
    plan?.mode !== 'human'
    || !hasExactOperatorHandoffPolicy(plan.operatorHandoffPolicy)
    || plan.environment?.browserClass !== 'managed_persistent'
    || plan.environment.processOwnership !== 'attach_only'
    || plan.environment.lifecyclePolicy !== 'managed'
    || plan.environment.focusPolicy !== 'never'
    || plan.browserExecution?.processOwnership !== 'attach_only'
    || plan.browserExecution?.osFocus !== 'never'
  ) {
    throw new Error('QA_OPERATOR_HANDOFF_AUTHORIZATION_INVALID');
  }
  return true;
}

function requireOperatorHandoffRequest(request) {
  const expectedKeys = ['targetId', 'targetTabId', 'targetWindow'];
  const targetWindowKeys = ['status', 'targetId', 'windowBounds', 'windowId'];
  const windowBoundsKeys = ['height', 'left', 'top', 'width', 'windowState'];
  const targetWindow = request?.targetWindow;
  const windowBounds = targetWindow?.windowBounds;
  if (
    !request
    || typeof request !== 'object'
    || Array.isArray(request)
    || JSON.stringify(Object.keys(request).sort()) !== JSON.stringify(expectedKeys)
    || typeof request.targetId !== 'string'
    || !request.targetId
    || request.targetId !== request.targetId.trim()
    || !Number.isSafeInteger(request.targetTabId)
    || request.targetTabId < 0
    || !targetWindow
    || typeof targetWindow !== 'object'
    || Array.isArray(targetWindow)
    || JSON.stringify(Object.keys(targetWindow).sort())
      !== JSON.stringify(targetWindowKeys)
    || targetWindow.status !== 'target_window_verified'
    || targetWindow.targetId !== request.targetId
    || !Number.isSafeInteger(targetWindow.windowId)
    || targetWindow.windowId <= 0
    || !windowBounds
    || typeof windowBounds !== 'object'
    || Array.isArray(windowBounds)
    || JSON.stringify(Object.keys(windowBounds).sort())
      !== JSON.stringify(windowBoundsKeys)
    || !Number.isSafeInteger(windowBounds.left)
    || !Number.isSafeInteger(windowBounds.top)
    || !Number.isSafeInteger(windowBounds.width)
    || windowBounds.width <= 0
    || !Number.isSafeInteger(windowBounds.height)
    || windowBounds.height <= 0
    || !['normal', 'minimized', 'maximized', 'fullscreen'].includes(
      windowBounds.windowState,
    )
  ) {
    throw new Error('QA_OPERATOR_HANDOFF_REQUEST_INVALID');
  }
  return Object.freeze({
    targetId: request.targetId,
    targetTabId: request.targetTabId,
    targetWindow: Object.freeze({
      status: targetWindow.status,
      targetId: targetWindow.targetId,
      windowId: targetWindow.windowId,
      windowBounds: Object.freeze({
        left: windowBounds.left,
        top: windowBounds.top,
        width: windowBounds.width,
        height: windowBounds.height,
        windowState: windowBounds.windowState,
      }),
    }),
  });
}

function requireOperatorHandoffFocusReceipt(receipt, request, browser) {
  if (
    receipt?.contractVersion !== 1
    || receipt.status !== 'READY'
    || receipt.policy !== OPERATOR_HANDOFF_POLICY.focus
    || receipt.targetId !== request.targetId
    || receipt.windowId !== request.targetWindow.windowId
    || receipt.processId !== browser?.browserIdentity?.proof?.pid
    || receipt.browserIsForeground !== true
    || receipt.windowVisible !== true
    || receipt.targetWindowCorrelated !== true
  ) {
    throw new Error('QA_OPERATOR_HANDOFF_FOCUS_RECEIPT_INVALID');
  }
  return receipt;
}

function requireInitialOwnedWindowRequest(request, journal) {
  const expectedKeys = ['cdp', 'child', 'tabId', 'targetId'];
  if (!request || typeof request !== 'object' || Array.isArray(request)
    || JSON.stringify(Object.keys(request).sort()) !== JSON.stringify(expectedKeys)
    || !request.child || typeof request.child !== 'object'
    || typeof request.cdp?.send !== 'function'
    || typeof request.targetId !== 'string' || !request.targetId
    || request.targetId !== request.targetId.trim()
    || !Number.isSafeInteger(request.tabId) || request.tabId < 0) {
    throw new Error('QA_INITIAL_OWNED_WINDOW_REQUEST_INVALID');
  }
  const scenarioTargets = journal.targets.filter(target => target.purpose === 'scenario_page');
  const tabProved = target => Number.isSafeInteger(target.tabId) && target.tabId >= 0;
  // The disposable reload owner journals its native management seed without a
  // Chrome tab id, then closes it before product UI. Only that fully released
  // marker contract is preparation; proved UI history stays counted after close.
  const closedNativePreparationSeed = target => target.tabId === null
    && target.state === 'released' && target.proofKind === 'runtime_marker'
    && target.initialUrl === 'about:blank'
    && ['closed', 'already_absent'].includes(target.releaseStatus)
    && target.browserEpoch === journal.browser?.browserEpoch;
  const initialTargets = scenarioTargets.filter(tabProved);
  const target = initialTargets[0];
  if (journal.state !== 'active' || journal.browser?.processOwnership !== 'owned'
    || !/^[a-f0-9]{64}$/u.test(journal.ownedProcess?.ownerTokenSha256 || '')
    || scenarioTargets.some(entry => !tabProved(entry) && !closedNativePreparationSeed(entry))
    || initialTargets.length !== 1 || target?.state !== 'admitted'
    || !['runtime_marker', 'exact_initial_url'].includes(target.proofKind)
    || target.targetId !== request.targetId || target.tabId !== request.tabId
    || target.browserEpoch !== journal.browser.browserEpoch) {
    throw new Error('QA_INITIAL_OWNED_WINDOW_TARGET_NOT_OWNED');
  }
  return request;
}

function requireInitialOwnedWindowReceipt(receipt, request, presentationPolicy) {
  requireQaOwnedInitialWindowPresentationPolicy(presentationPolicy);
  const commonKeys = ['contractVersion', 'initialFocusRequested', 'policy', 'processId', 'status', 'targetId', 'windowId'];
  const ready = receipt?.status === 'READY';
  const expectedKeys = [...commonKeys, ...(ready
    ? ['browserIsForeground', 'presentation', 'targetWindowCorrelated', 'windowVisible']
    : ['reason'])].sort();
  if (!receipt || typeof receipt !== 'object' || Array.isArray(receipt)
    || JSON.stringify(Object.keys(receipt).sort()) !== JSON.stringify(expectedKeys)
    || receipt.contractVersion !== 1 || receipt.policy !== presentationPolicy
    || receipt.targetId !== request.targetId
    || !Number.isSafeInteger(receipt.windowId) || receipt.windowId <= 0
    || !Number.isSafeInteger(receipt.processId) || receipt.processId <= 0
    || (ready ? receipt.initialFocusRequested !== true
      || receipt.browserIsForeground !== true || receipt.windowVisible !== true
      || receipt.targetWindowCorrelated !== true
      : receipt.status !== 'not_required' || receipt.initialFocusRequested !== false
        || receipt.reason !== 'non_windows_presentation_contract')) {
    throw new Error('QA_INITIAL_OWNED_WINDOW_RECEIPT_INVALID');
  }
  let presentation;
  if (ready) {
    try { presentation = requireQaWindowPresentationReceipt(receipt.presentation); }
    catch (cause) { throw new Error('QA_INITIAL_OWNED_WINDOW_RECEIPT_INVALID', { cause }); }
  }
  return Object.freeze({ ...receipt, ...(ready ? { presentation } : {}), tabId: request.tabId });
}

function normalizeProtocolResult(result) {
  if (result === undefined || result === null) {
    throw new Error('QA_PROTOCOL_RESULT_REQUIRED');
  }
  if (typeof result !== 'object' || Array.isArray(result)) {
    throw new Error('QA_PROTOCOL_RESULT_INVALID');
  }
  if (!Object.hasOwn(result, 'status')) {
    throw new Error('QA_PROTOCOL_STATUS_REQUIRED');
  }
  const status = result.status;
  if (!TERMINAL_STATUSES.has(status)) {
    throw new Error(`QA_PROTOCOL_STATUS_INVALID:${status}`);
  }
  try {
    JSON.stringify(result);
  } catch (error) {
    throw new Error('QA_PROTOCOL_RESULT_NOT_SERIALIZABLE', { cause: error });
  }
  return Object.freeze({ ...result, status });
}

function requireArtifactAdmissionClaims(plan) {
  const claims = plan.artifactAdmissionClaims;
  if (!Array.isArray(claims) || new Set(claims).size !== claims.length
    || claims.some((claim) => claim !== 'artifact:dev_extension'
      || !plan.resourceClaims.includes(claim))
    || (claims.length > 0 && (plan.artifactId !== 'dev_extension'
      || plan.parameters.rebuildDuringRun === true))) {
    throw new Error('QA_ARTIFACT_ADMISSION_CLAIMS_INVALID');
  }
  return claims;
}

function requireImmutableAdmissionPin(plan, artifact) {
  const pinsRoot = path.join(plan.rootDir, '.artifacts', 'qa', 'artifact-leases');
  if (artifact?.id !== 'dev_extension' || artifact.status !== 'ready'
    || artifact.isolation !== 'immutable_run_copy'
    || !['built_for_run', 'reused'].includes(artifact.ownership)
    || !path.isAbsolute(artifact.path || '') || !path.isAbsolute(artifact.sourcePath || '')
    || path.dirname(path.normalize(artifact.path)) !== pinsRoot
    || !/^dev-[a-zA-Z0-9]+$/u.test(path.basename(artifact.path))
    || path.normalize(artifact.path) === path.normalize(artifact.sourcePath)
    || typeof artifact.buildId !== 'string' || !artifact.buildId) {
    throw new Error('QA_ARTIFACT_ADMISSION_IMMUTABLE_PIN_REQUIRED');
  }
}

async function executeCleanupStack(cleanupStack, evidence) {
  const outcomes = [];
  for (const cleanup of [...cleanupStack].reverse()) {
    try {
      const detail = await cleanup.release();
      outcomes.push(Object.freeze({
        id: cleanup.id,
        status: 'released',
        detail: detail || null,
      }));
    } catch (error) {
      outcomes.push(Object.freeze({
        id: cleanup.id,
        status: 'failed',
        error: error?.message || String(error),
        errorDetail: serializeQaError(error),
      }));
      try {
        await evidence.event('QA_CLEANUP_FAILED', {
          id: cleanup.id,
          error: error?.message || String(error),
        });
      } catch (evidenceError) {
        outcomes.push(Object.freeze({
          id: `${cleanup.id}:evidence`,
          status: 'failed',
          error: evidenceError?.message || String(evidenceError),
          errorDetail: serializeQaError(evidenceError),
        }));
      }
    }
  }
  return Object.freeze(outcomes);
}

function createQaAbortError(signal) {
  const reason = signal.reason;
  const detail = reason instanceof Error
    ? reason.message
    : String(reason || 'signal');
  const error = new Error(
    detail.startsWith('QA_RUN_ABORTED')
      ? detail
      : `QA_RUN_ABORTED:${detail}`,
    reason instanceof Error ? { cause: reason } : undefined,
  );
  error.code = 'QA_RUN_ABORTED';
  return error;
}

function throwIfAborted(signal) {
  if (signal?.aborted) throw createQaAbortError(signal);
}

async function ensureManagedPersistentBrowser(plan, {
  signal,
  lifecycleRunner,
  evidence,
}) {
  const environment = plan.environment;
  if (environment?.browserClass !== 'managed_persistent') return null;
  if (
    environment.processOwnership !== 'attach_only'
    || environment.lifecyclePolicy !== 'managed'
    || plan.browserExecution?.startPolicy
      !== BROWSER_START_POLICIES.MANAGED_ENSURE_BEFORE_ATTACH
  ) {
    throw new Error(
      `QA_MANAGED_BROWSER_SESSION_CONTRACT_INVALID:${environment.id || 'missing'}`,
    );
  }
  if (typeof lifecycleRunner !== 'function') {
    throw new Error('QA_MANAGED_BROWSER_SESSION_LIFECYCLE_RUNNER_REQUIRED');
  }
  const result = await lifecycleRunner({
    rootDir: plan.rootDir,
    environment,
    action: 'ensure',
    signal,
  });
  if (
    result?.status !== 'READY'
    || result.profileSlotId !== environment.profileSlotId
    || !['already_ready', 'started'].includes(result.lifecycleAction)
  ) {
    throw new Error(
      `QA_MANAGED_BROWSER_SESSION_ENSURE_INVALID:${environment.id}`,
    );
  }
  await evidence.event('QA_MANAGED_BROWSER_ENSURED', {
    environmentId: environment.id,
    profileSlotId: environment.profileSlotId,
    lifecycleAction: result.lifecycleAction,
  });
  return result;
}

export async function runQaSession(plan, {
  signal = null,
  evidence = new QaEvidenceWriter(plan),
  doctorOptions = {},
  protocolLoader = loadQaProtocol,
  resourceCoordinatorFactory = (options) => new QaResourceCoordinator(options),
  artifactLeaseFactory = (options) => new QaArtifactLease(options),
  browserLeaseFactory = (options) => new QaBrowserLease(options),
  initialWindowFocusAnchorLeaseFactory = (options) => (
    new QaInitialWindowFocusAnchorLease(options)
  ),
  attachedBrowserOsFocusGuardFactory = (options) => (
    new QaAttachedBrowserOsFocusGuard(options)
  ),
  displayLeaseFactory = (options) => new QaDisplayLease(options),
  managedBrowserLifecycleRunner = runQaManagedPersistentBrowserAction,
  recoveryJournalFactory = (sessionPlan) => new QaRecoveryJournal(sessionPlan),
  operatorHandoffAuthorized = false,
  operatorHandoffFocus = focusQaManagedBrowserTargetForOperator,
  initialOwnedWindowPresentation = focusQaOwnedBrowserTargetForPreparation,
} = {}) {
  const recoveryJournal = recoveryJournalFactory(plan);
  const coordinator = resourceCoordinatorFactory({
    lockRoot: path.join(plan.rootDir, '.artifacts', 'qa', 'locks'),
    runId: plan.runId,
    recoveryJournal,
  });
  const cleanupStack = [];
  const cleanupIds = new Set();
  const registerCleanup = (id, release) => {
    if (typeof id !== 'string' || !id.trim() || typeof release !== 'function') {
      throw new Error('QA_PROTOCOL_CLEANUP_INVALID');
    }
    if (cleanupIds.has(id)) {
      throw new Error(`QA_PROTOCOL_CLEANUP_DUPLICATE:${id}`);
    }
    cleanupIds.add(id);
    cleanupStack.push({ id, release });
  };
  let protocolResult = null;
  let primaryError = null;
  let status = QA_RUN_STATUSES.FAIL;
  let artifact = null;
  let browser = null;
  let browserGpuCapability = null;
  let managedBrowserLifecycle = null;
  let initialWindowFocusAnchor = null;
  let attachedBrowserOsFocusGuard = null;
  let attachedBrowserOsFocusBaseline = null;
  let attachedBrowserOsFocusFinal = null;
  let operatorHandoffEnabled = false;
  let operatorHandoffAttempted = false;
  let operatorHandoffReceipt = null;
  let initialOwnedWindowPresentationAttempted = false;
  let initialOwnedWindowPresentationReceipt = null;
  let initialOwnedWindowPresentationPending = null;
  let protocolExecutionOpen = false;

  await evidence.start();
  await recoveryJournal.start();
  try {
    operatorHandoffEnabled = resolveOperatorHandoffAuthorization(
      plan,
      operatorHandoffAuthorized,
    );
    if (operatorHandoffEnabled && typeof operatorHandoffFocus !== 'function') {
      throw new Error('QA_OPERATOR_HANDOFF_FOCUS_OWNER_REQUIRED');
    }
    throwIfAborted(signal);
    const artifactAdmissionClaims = requireArtifactAdmissionClaims(plan);
    registerCleanup(
      'resource_claims',
      () => coordinator.releaseAll().then((releasedClaims) => ({
        resourceClaims: plan.resourceClaims,
        releasedClaims,
      })),
    );
    await coordinator.acquireAll(plan.resourceClaims, {
      artifactAdmissionClaims,
      signal,
      onAdmissionWait: detail => evidence.event(detail.phase === 'WAITING'
        ? 'QA_ARTIFACT_ADMISSION_WAITING' : 'QA_ARTIFACT_ADMISSION_WAIT_COMPLETE', detail),
    });
    await evidence.event('QA_RESOURCES_ACQUIRED', {
      resourceClaims: plan.resourceClaims,
    });

    throwIfAborted(signal);
    const runChild = (childOptions) => runQaChildProcess({
      ...childOptions,
      cwd: childOptions.cwd || plan.rootDir,
      signal,
      recoveryJournal,
    });
    const artifactLease = artifactLeaseFactory({
      plan,
      runChild,
      evidence,
    });
    registerCleanup('artifact_lease', () => artifactLease.release());
    artifact = await artifactLease.acquire();
    if (artifact) {
      await evidence.event('QA_ARTIFACT_READY', artifact);
    }
    if (artifactAdmissionClaims.length > 0) {
      requireImmutableAdmissionPin(plan, artifact);
      const releasedClaims = await coordinator.releaseClaims(artifactAdmissionClaims);
      await evidence.event('QA_ARTIFACT_ADMISSION_RELEASED', {
        releasedClaims,
        buildId: artifact.buildId,
        isolation: artifact.isolation,
      });
    }

    throwIfAborted(signal);
    // Loading a broken protocol cannot consume a launch or presentation grant.
    const protocol = await protocolLoader(plan.protocolId);
    managedBrowserLifecycle = await ensureManagedPersistentBrowser(plan, {
      signal,
      lifecycleRunner: managedBrowserLifecycleRunner,
      evidence,
    });

    throwIfAborted(signal);
    const initialWindowFocusOnceAllowed = allowsQaInitialWindowFocusOnce(plan)
      && managedBrowserLifecycle?.lifecycleAction === 'started';
    const browserLease = browserLeaseFactory({
      rootDir: plan.rootDir,
      ownerId: `${plan.runId}:${plan.targetId}`,
      ...(['shared_capture', 'isolated_functional'].includes(plan.browserConcurrency)
        ? { ownedSessionId: plan.runId } : {}),
      environment: plan.environment,
      executionPlan: plan.browserExecution,
      allowInitialWindowFocusOnce: initialWindowFocusOnceAllowed,
      allowOperatorHandoffFirstPage: operatorHandoffEnabled,
      evidence,
      doctorOptions,
    });
    registerCleanup('browser_lease', () => browserLease.release());
    browser = await browserLease.acquire();

    const sessionOsFocusGuardRequired = plan.mode === 'agent'
      && browser?.processOwnership === 'attach_only'
      && browser.osFocus === 'never';
    if (
      browser?.processOwnership === 'attach_only'
      && (browser.baselinePageTargetCount === 0 || plan.browserObservation === 'foreground')
      && initialWindowFocusOnceAllowed
    ) {
      const startedPid = managedBrowserLifecycle.launch?.pid;
      const startedIdentity = managedBrowserLifecycle.after?.checks?.identity;
      const startedBrowserEpoch = managedBrowserLifecycle.after?.checks?.cdp?.browserEpoch;
      if (!Number.isSafeInteger(startedPid) || startedPid <= 0
        || startedIdentity?.status !== 'declared_identity_verified'
        || startedIdentity.proof?.pid !== startedPid
        || browser.browserIdentity?.status !== 'declared_identity_verified'
        || browser.browserIdentity.proof?.pid !== startedPid
        || typeof startedBrowserEpoch !== 'string' || !startedBrowserEpoch) {
        throw new Error('QA_INITIAL_WINDOW_STARTED_PROCESS_IDENTITY_CHANGED');
      }
      const anchorLease = initialWindowFocusAnchorLeaseFactory({
        ownerId: `${plan.runId}:initial-window-focus-anchor`,
        browser,
        recoveryJournal,
        expectedBrowserEpoch: startedBrowserEpoch,
        presentWindow: plan.browserObservation === 'foreground',
      });
      initialWindowFocusAnchor = await anchorLease.acquire();
      registerCleanup(
        'initial_window_focus_anchor',
        () => anchorLease.release(),
      );
      await evidence.event(
        'QA_INITIAL_WINDOW_FOCUS_ANCHOR_READY',
        initialWindowFocusAnchor,
      );
    }

    if (sessionOsFocusGuardRequired) {
      const nativeObservation = ['document', 'animation', 'foreground'].includes(plan.browserObservation);
      const focusEvidenceEvent = nativeObservation
        ? 'QA_BROWSER_OS_FOCUS_OBSERVED' : 'QA_BROWSER_OS_FOCUS_PRESERVED';
      // Register after the optional anchor so reverse cleanup proves focus
      // after protocol targets close while the main-window anchor still
      // exists. The anchor closes immediately after this read-only proof.
      registerCleanup('attached_browser_os_focus_guard', async () => {
        if (!attachedBrowserOsFocusGuard || !attachedBrowserOsFocusBaseline) {
          return Object.freeze({
            resource: 'attached_browser_os_focus_guard',
            status: 'not_initialized',
          });
        }
        attachedBrowserOsFocusFinal = await attachedBrowserOsFocusGuard.assertPreserved(
          'after_protocol_targets_closed_before_anchor_release',
        );
        await evidence.event(
          focusEvidenceEvent,
          attachedBrowserOsFocusFinal,
        );
        return attachedBrowserOsFocusFinal;
      });
      attachedBrowserOsFocusGuard = attachedBrowserOsFocusGuardFactory({
        browser, nativeObservation,
      });
      attachedBrowserOsFocusBaseline = await attachedBrowserOsFocusGuard.observeBaseline(
        'before_protocol_execution',
      );
      await evidence.event(
        focusEvidenceEvent,
        attachedBrowserOsFocusBaseline,
      );
    }

    if (browser && plan.browserExecution) {
      const displayLease = displayLeaseFactory({
        rootDir: plan.rootDir,
        executionPlan: plan.browserExecution,
        browser,
        evidence,
      });
      const display = await displayLease.acquire();
      registerCleanup('display_lease', () => displayLease.release());
      const browserWithDisplay = Object.freeze({
        ...browser,
        display,
        launchEnvironment: display.launchEnvironment,
        gpuAdmission: display.gpuAdmission,
      });
      browser = browserWithDisplay;
    }

    throwIfAborted(signal);
    const reportBrowserGpuCapability = async (capability) => {
      if (!capability || typeof capability !== 'object' || Array.isArray(capability)) {
        throw new Error('QA_BROWSER_GPU_CAPABILITY_INVALID');
      }
      if (
        browserGpuCapability
        && JSON.stringify(browserGpuCapability) !== JSON.stringify(capability)
      ) {
        throw new Error('QA_BROWSER_GPU_CAPABILITY_CONFLICT');
      }
      browserGpuCapability = Object.freeze({ ...capability });
      await evidence.event('QA_BROWSER_GPU_CLASSIFIED', browserGpuCapability);
      return browserGpuCapability;
    };
    const requestOperatorHandoff = operatorHandoffEnabled
      ? async (rawRequest) => {
        if (operatorHandoffAttempted) {
          throw new Error('QA_OPERATOR_HANDOFF_ALREADY_REQUESTED');
        }
        operatorHandoffAttempted = true;
        const request = requireOperatorHandoffRequest(rawRequest);
        const admittedTargets = recoveryJournal.readSnapshot().targets.filter(
          (target) => (
            target.state === 'admitted'
            && target.targetId === request.targetId
            && target.tabId === request.targetTabId
          ),
        );
        if (admittedTargets.length !== 1) {
          throw new Error('QA_OPERATOR_HANDOFF_TARGET_NOT_OWNED');
        }
        await evidence.event('QA_OPERATOR_HANDOFF_REQUESTED', {
          policy: OPERATOR_HANDOFF_POLICY.focus,
          targetId: request.targetId,
          targetTabId: request.targetTabId,
          windowId: request.targetWindow.windowId,
        });
        const focused = requireOperatorHandoffFocusReceipt(
          await operatorHandoffFocus({
            browser,
            targetWindow: request.targetWindow,
          }),
          request,
          browser,
        );
        operatorHandoffReceipt = Object.freeze({
          ...focused,
          targetTabId: request.targetTabId,
          lifetime: OPERATOR_HANDOFF_POLICY.lifetime,
          cleanup: OPERATOR_HANDOFF_POLICY.cleanup,
        });
        await evidence.event('QA_OPERATOR_HANDOFF_READY', operatorHandoffReceipt);
        return operatorHandoffReceipt;
      }
      : null;
    const initialOwnedWindowPresentationRequired = allowsQaOwnedInitialWindowPresentation(plan);
    const initialOwnedWindowPresentationPolicy = initialOwnedWindowPresentationRequired
      ? requireQaOwnedInitialWindowPresentationPolicy(plan.protocolOptions.initialWindowPresentation)
      : null;
    const assertInitialOwnedPreparationActive = () => {
      throwIfAborted(signal);
      if (!protocolExecutionOpen) throw new Error('QA_INITIAL_OWNED_WINDOW_SESSION_CLOSED');
    };
    const requestInitialOwnedWindowPresentation = initialOwnedWindowPresentationRequired
      ? (rawRequest) => {
        const pending = (async () => {
          if (!protocolExecutionOpen) throw new Error('QA_INITIAL_OWNED_WINDOW_SESSION_CLOSED');
          if (initialOwnedWindowPresentationAttempted) {
            throw new Error('QA_INITIAL_OWNED_WINDOW_ALREADY_REQUESTED');
          }
          // Consume before validation or any await: failure cannot renew focus.
          initialOwnedWindowPresentationAttempted = true;
          throwIfAborted(signal);
          const journal = recoveryJournal.readSnapshot();
          const request = requireInitialOwnedWindowRequest(rawRequest, journal);
          if (typeof initialOwnedWindowPresentation !== 'function') {
            throw new Error('QA_INITIAL_OWNED_WINDOW_PRESENTATION_OWNER_REQUIRED');
          }
          await evidence.event('QA_INITIAL_OWNED_WINDOW_PRESENTATION_REQUESTED', {
            policy: initialOwnedWindowPresentationPolicy, targetId: request.targetId, tabId: request.tabId,
          });
          assertInitialOwnedPreparationActive();
          const receipt = requireInitialOwnedWindowReceipt(
            await initialOwnedWindowPresentation({
              child: request.child, cdp: request.cdp, targetId: request.targetId,
              expectedOwnerTokenSha256: journal.ownedProcess.ownerTokenSha256,
              assertPreparationActive: assertInitialOwnedPreparationActive,
              presentationPolicy: initialOwnedWindowPresentationPolicy,
            }), request, initialOwnedWindowPresentationPolicy,
          );
          assertInitialOwnedPreparationActive();
          initialOwnedWindowPresentationReceipt = receipt;
          await evidence.event('QA_INITIAL_OWNED_WINDOW_PRESENTATION_READY', initialOwnedWindowPresentationReceipt);
          return initialOwnedWindowPresentationReceipt;
        })();
        // Drain the one admitted operation before process cleanup, including a
        // protocol that incorrectly neglects to await its preparation promise.
        initialOwnedWindowPresentationPending ||= pending;
        pending.catch(() => {});
        return pending;
      } : null;
    protocolExecutionOpen = true;
    protocolResult = normalizeProtocolResult(await protocol.execute(Object.freeze({
      plan,
      artifact,
      browser,
      signal,
      evidence,
      recoveryJournal,
      initialWindowFocusAnchor,
      attachedBrowserOsFocusGuard,
      attachedBrowserOsFocusBaseline,
      attachmentsDir: path.join(plan.runRoot, 'attachments'),
      runChild,
      registerCleanup,
      reportBrowserGpuCapability,
      ...(requestOperatorHandoff ? { requestOperatorHandoff } : {}),
      ...(requestInitialOwnedWindowPresentation ? { requestInitialOwnedWindowPresentation } : {}),
    })));
    protocolExecutionOpen = false;
    if (initialOwnedWindowPresentationRequired && !initialOwnedWindowPresentationReceipt) {
      throw new Error('QA_INITIAL_OWNED_WINDOW_PRESENTATION_REQUIRED');
    }
    throwIfAborted(signal);
    status = protocolResult.status;
  } catch (error) {
    protocolExecutionOpen = false;
    if (isQaChildCleanupFailure(error)) {
      registerCleanup('child_process_cleanup_proof', async () => { throw error; });
    }
    primaryError = signal?.aborted && !isQaChildCleanupFailure(error)
      ? createQaAbortError(signal)
      : error;
    if (primaryError !== error && error?.startupEvidence) {
      primaryError.startupEvidence = error.startupEvidence;
    }
    status = classifyQaErrorStatus(primaryError);
    try {
      const errorDetail = serializeQaError(primaryError);
      await evidence.event('QA_RUN_ERROR', {
        status,
        error: errorDetail.message,
        errorCode: errorDetail.code || null,
        errorStage: errorDetail.stage || errorDetail.cause?.stage || null,
        causeCode: errorDetail.cause?.code || null,
        ...(errorDetail.startupEvidence ? { startupEvidence: errorDetail.startupEvidence } : {}),
      });
    } catch (evidenceError) {
      status = QA_RUN_STATUSES.FAIL;
      const wrappedError = new Error(
        'QA_EVIDENCE_WRITE_FAILED',
        { cause: evidenceError },
      );
      wrappedError.code = 'QA_EVIDENCE_WRITE_FAILED';
      primaryError = wrappedError;
    }
  }

  protocolExecutionOpen = false;
  await initialOwnedWindowPresentationPending?.catch(() => {});
  const cleanup = await executeCleanupStack(cleanupStack, evidence);
  const cleanupFailed = cleanup.some((entry) => entry.status === 'failed');
  if (cleanupFailed) {
    status = QA_RUN_STATUSES.FAIL;
    if (!primaryError || primaryError.message !== 'QA_CLEANUP_INCOMPLETE') {
      const cleanupError = new Error(
        'QA_CLEANUP_INCOMPLETE',
        primaryError ? { cause: primaryError } : undefined,
      );
      cleanupError.code = 'QA_CLEANUP_INCOMPLETE';
      primaryError = cleanupError;
    }
  }
  const report = await evidence.finalize({
    status,
    result: protocolResult
      ? {
        ...protocolResult,
        artifact,
        browserLifecycle: managedBrowserLifecycle
          ? {
            status: managedBrowserLifecycle.status,
            profileSlotId: managedBrowserLifecycle.profileSlotId,
            lifecycleAction: managedBrowserLifecycle.lifecycleAction,
          }
          : null,
        initialWindowFocusAnchor,
        initialOwnedWindowPresentation: initialOwnedWindowPresentationReceipt,
        attachedBrowserOsFocusBaseline,
        attachedBrowserOsFocusFinal,
        operatorHandoff: operatorHandoffReceipt,
        browser: browser
          ? {
            environmentId: browser.environmentId,
            browserClass: browser.browserClass,
            processOwnership: browser.processOwnership,
            focusPolicy: browser.focusPolicy,
            audioPolicy: browser.audioPolicy,
            presentation: browser.presentation,
            headless: browser.headless,
            startPolicy: browser.startPolicy,
            displayPolicy: browser.displayPolicy,
            documentVisibility: browser.documentVisibility,
            targetActivation: browser.targetActivation,
            osFocus: browser.osFocus,
            gpuRequirement: browser.gpuRequirement,
            webglRequirement: browser.webglRequirement,
            effectiveAudioPolicy: browser.effectiveAudioPolicy,
            cleanupPolicy: browser.cleanupPolicy,
            display: browser.display || null,
            gpuCapability: browserGpuCapability,
          }
          : null,
      }
      : null,
    error: primaryError,
    cleanup,
  });
  const recoverySnapshot = recoveryJournal.readSnapshot();
  const recoveryResourcesReleased = recoverySnapshot.resourceClaims.every((claim) => (
    claim.state === 'released'
  )) && recoverySnapshot.targets.every((target) => (
    target.state !== 'admitted'
  )) && recoverySnapshot.childJobs.every((job) => job.state === 'released');
  await recoveryJournal.finalize({
    status: report.status,
    cleanupComplete: cleanup.every((entry) => entry.status === 'released')
      && recoveryResourcesReleased,
  });
  return report;
}
