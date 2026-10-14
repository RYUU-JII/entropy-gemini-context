import { isWindowsQaPlatform } from '../../browser-qa/browser/windowsPlatform.mjs';
import fs from 'node:fs/promises';
import path from 'node:path';
import { inspectWindowsQaChildJob } from '../runtime/qaWindowsChildJob.mjs';

import {
  closeQaCdpTarget,
  listQaCdpTargets,
} from '../browser/qaCdpTargetOwner.mjs';
import {
  terminateLinuxQaChromiumByIdentity,
  terminateWslWindowsQaChromiumByIdentity,
  inspectLinuxQaChromiumOccupancy,
  inspectWslWindowsQaChromiumOccupancy,
} from '../browser/qaChromiumProcessOwner.mjs';
import {
  CdpConnection,
} from '../../browser-qa/cdp/CdpConnection.mjs';
import {
  verifyQaPersistentBrowserIdentity,
} from '../browser/qaPersistentBrowserLifecycle.mjs';
import {
  resolveQaBrowserEnvironment,
} from '../environment/qaLocalConfig.mjs';
import {
  verifyEntropyQaDedicatedProfileOwnership,
} from '../profile/entropyQaProfileMarker.mjs';
import {
  acquireQaBrowserBroker,
} from '../resources/QaBrowserBroker.mjs';
import {
  acquireQaBrowserCapacity,
} from '../resources/QaBrowserCapacityLease.mjs';
import {
  resolveBrowserQaPhysicalResourceIdentities,
} from '../../browser-qa/resources/browserResourceScope.mjs';
import { resolveBrowserInstallation } from '../../browser-qa/lifecycle/browserResourceRegistry.mjs';
import {
  resolveQaBrowserEpoch,
} from '../resources/QaBrowserTargetLease.mjs';
import {
  loadQaConfigForRoot,
} from '../runtime/QaRunCompiler.mjs';
import {
  completeQaRecoveryJournal,
  inspectQaRunnerIdentity,
  readQaRecoveryJournal,
} from './QaRecoveryJournal.mjs';

function fail(code, detail = '') {
  const error = new Error(detail ? `${code}:${detail}` : code);
  error.code = code;
  throw error;
}

function samePath(left, right) {
  if (typeof left !== 'string' || typeof right !== 'string') return left === right;
  return path.normalize(left) === path.normalize(right);
}

function requireCurrentAttachedEnvironment(journal, config) {
  const environmentId = journal.plan.environmentId;
  const current = resolveQaBrowserEnvironment(environmentId, config);
  const recorded = journal.plan.environment;
  const browser = journal.browser;
  if (
    journal.plan.processOwnership !== 'attach_only'
    || recorded?.lifecyclePolicy !== 'managed'
    || recorded?.browserClass !== 'managed_persistent'
    || current?.processOwnership !== 'attach_only'
    || current.lifecyclePolicy !== 'managed'
    || current.browserClass !== 'managed_persistent'
    || current.id !== environmentId
    || current.profileSlotId !== journal.plan.profileSlotId
    || current.profileSlotId !== browser?.profileSlotId
    || current.installationId !== browser?.installationId
    || current.cdpEndpoint !== browser?.cdpEndpoint
    || current.profileDirectory !== browser?.profileDirectory
    || !samePath(current.chrome, browser?.executable)
    || !samePath(current.profile, browser?.userDataDir)
  ) {
    fail('QA_RECOVERY_CURRENT_ENVIRONMENT_MISMATCH', environmentId || 'missing');
  }
  return current;
}

async function readBrowserVersion(cdpEndpoint, fetchImpl) {
  let response;
  try {
    response = await fetchImpl(new URL('/json/version', cdpEndpoint), {
      signal: AbortSignal.timeout(2_000),
    });
  } catch (error) {
    throw new Error('QA_RECOVERY_CDP_VERSION_UNAVAILABLE', { cause: error });
  }
  if (!response?.ok) fail('QA_RECOVERY_CDP_VERSION_UNAVAILABLE');
  const version = await response.json().catch((error) => {
    throw new Error('QA_RECOVERY_CDP_VERSION_INVALID', { cause: error });
  });
  if (typeof version?.webSocketDebuggerUrl !== 'string') {
    fail('QA_RECOVERY_CDP_VERSION_INVALID');
  }
  return version;
}

async function readRuntimeTargetMarker(cdp, target, markerProperty) {
  const attached = await cdp.send('Target.attachToTarget', {
    targetId: target.targetId,
    flatten: true,
  });
  const sessionId = attached?.sessionId;
  if (typeof sessionId !== 'string' || !sessionId) {
    fail('QA_RECOVERY_TARGET_SESSION_INVALID', target.targetId);
  }
  try {
    await cdp.send('Runtime.enable', {}, sessionId);
    const result = await cdp.send('Runtime.evaluate', {
      expression: `globalThis[${JSON.stringify(markerProperty)}]`,
      returnByValue: true,
      awaitPromise: false,
    }, sessionId);
    return result?.result?.value;
  } finally {
    await cdp.send('Target.detachFromTarget', { sessionId }).catch(() => {});
  }
}

async function recoverAttachedTargets({
  rootDir,
  journal,
  fetchImpl,
  brokerFactory,
  capacityFactory,
  identityVerifier,
  dedicatedProfileVerifier,
  cdpFactory,
}) {
  if (typeof journal.plan.configPath !== 'string') {
    fail('QA_RECOVERY_CONFIG_PATH_REQUIRED');
  }
  const config = await loadQaConfigForRoot({
    rootDir,
    configPath: journal.plan.configPath,
    requireExisting: true,
  });
  const environment = requireCurrentAttachedEnvironment(journal, config);
  const resourceIdentities = resolveBrowserQaPhysicalResourceIdentities({
    cdpEndpoint: environment.cdpEndpoint,
    userDataDir: environment.profile,
    profileDirectory: environment.profileDirectory,
  });
  const broker = await brokerFactory({
    rootDir,
    environment,
    ownerId: `qa-recovery:${journal.runId}`,
  });
  let capacity = null;
  let cdp = null;
  let primaryError = null;
  try {
    capacity = await capacityFactory({
      rootDir,
      ownerId: `qa-recovery:${journal.runId}:capacity`,
      browserResourceIdentities: resourceIdentities,
    });
    const dedicated = await dedicatedProfileVerifier({
      profileSlot: environment.profileSlot,
    });
    if (
      dedicated?.status !== 'dedicated_profile_verified'
      || dedicated.profileSlotId !== environment.profileSlotId
    ) {
      fail('QA_RECOVERY_DEDICATED_PROFILE_UNVERIFIED');
    }
    const identity = await identityVerifier({
      rootDir,
      profileSlot: environment.profileSlot,
      ownerId: `qa-recovery:${journal.runId}:identity`,
      capacityLease: capacity,
    });
    if (identity?.status !== 'declared_identity_verified') {
      fail('QA_RECOVERY_BROWSER_IDENTITY_UNVERIFIED');
    }
    const version = await readBrowserVersion(environment.cdpEndpoint, fetchImpl);
    const browserEpoch = resolveQaBrowserEpoch(version);
    if (browserEpoch !== journal.browser?.browserEpoch) {
      // The browser that minted these targets is gone, so the targets went with
      // it. The epoch guard exists to stop this from closing targets in a browser
      // the journal does not describe, and reporting them absent touches nothing
      // at all -- it is strictly safer than what it replaces.
      //
      // Failing here instead stranded the run's resource locks permanently:
      // releaseStaleResourceClaims runs after target recovery and never got the
      // chance, so any run whose browser died mid-flight reserved its artifact
      // forever, with `recover` -- the only declared releaser -- refusing the
      // one run that needed it. Report and continue to the release.
      return Object.freeze(journal.targets
        .filter((target) => target.state === 'admitted')
        .map((target) => Object.freeze({
          targetId: target.targetId,
          purpose: target.purpose,
          status: 'already_absent',
          proof: 'QA_RECOVERY_BROWSER_EPOCH_MISMATCH',
        })));
    }
    cdp = cdpFactory(version.webSocketDebuggerUrl);
    await cdp.open();
    const outcomes = [];
    for (const ownedTarget of journal.targets.filter((target) => (
      target.state === 'admitted'
    ))) {
      const targets = await listQaCdpTargets(cdp);
      const current = targets.find((target) => (
        target.targetId === ownedTarget.targetId
      ));
      if (!current) {
        outcomes.push(Object.freeze({
          targetId: ownedTarget.targetId,
          purpose: ownedTarget.purpose,
          status: 'already_absent',
          proof: 'browser_epoch_target_absence',
        }));
        continue;
      }
      if (current.type !== 'page') {
        fail('QA_RECOVERY_TARGET_TYPE_MISMATCH', ownedTarget.targetId);
      }
      if (ownedTarget.proofKind === 'runtime_marker') {
        const marker = await readRuntimeTargetMarker(
          cdp,
          current,
          ownedTarget.markerProperty,
        );
        if (marker !== ownedTarget.targetNonce) {
          fail('QA_RECOVERY_TARGET_NONCE_MISMATCH', ownedTarget.targetId);
        }
      } else if (
        ownedTarget.proofKind === 'exact_initial_url'
        && current.url !== ownedTarget.initialUrl
      ) {
        fail('QA_RECOVERY_TARGET_URL_MISMATCH', ownedTarget.targetId);
      }
      const receipt = await closeQaCdpTarget(cdp, ownedTarget.targetId);
      outcomes.push(Object.freeze({
        targetId: ownedTarget.targetId,
        purpose: ownedTarget.purpose,
        status: receipt.status,
        proof: ownedTarget.proofKind,
      }));
    }
    return Object.freeze(outcomes);
  } catch (error) {
    primaryError = error;
    throw error;
  } finally {
    const cleanupErrors = [];
    try {
      cdp?.close();
    } catch (error) {
      cleanupErrors.push(error);
    }
    await capacity?.release().catch((error) => cleanupErrors.push(error));
    await broker.release().catch((error) => cleanupErrors.push(error));
    if (cleanupErrors.length > 0) {
      if (primaryError) {
        throw new AggregateError(
          [primaryError, ...cleanupErrors],
          'QA_RECOVERY_BROWSER_AND_CLEANUP_FAILED',
          { cause: primaryError },
        );
      }
      if (cleanupErrors.length === 1) throw cleanupErrors[0];
      throw new AggregateError(cleanupErrors, 'QA_RECOVERY_BROWSER_CLEANUP_FAILED');
    }
  }
}

async function recoverOwnedProcess(journal, {
  linuxTerminator,
  windowsTerminator,
}) {
  const identity = journal.ownedProcess;
  if (!identity) fail('QA_RECOVERY_OWNED_PROCESS_IDENTITY_REQUIRED');
  if (
    identity.platform === 'linux'
    && (
      !Number.isSafeInteger(identity.pid)
      || identity.pid < 1
      || typeof identity.processStartToken !== 'string'
      || !/^linux-proc:\d+$/u.test(identity.processStartToken)
    )
  ) {
    fail('QA_RECOVERY_OWNED_PROCESS_START_TOKEN_REQUIRED');
  }
  const terminate = identity.platform === 'linux'
    ? linuxTerminator
    : isWindowsQaPlatform(identity.platform)
      ? windowsTerminator
      : null;
  if (!terminate) fail('QA_RECOVERY_OWNED_PROCESS_PLATFORM_INVALID');
  const receipt = await terminate(identity);
  if (!['terminated', 'already_absent'].includes(receipt?.status)) {
    fail('QA_RECOVERY_OWNED_PROCESS_RECEIPT_INVALID');
  }
  const targets = journal.targets
    .filter((target) => target.state === 'admitted')
    .map((target) => Object.freeze({
      targetId: target.targetId,
      purpose: target.purpose,
      status: 'already_absent',
      proof: 'exact_owned_process_terminated',
    }));
  return Object.freeze({
    process: Object.freeze({
      status: receipt.status,
      action: receipt.processAction,
      processCount: receipt.processCount ?? null,
    }),
    targets: Object.freeze(targets),
  });
}

async function proveRecordedOwnedProfileAbsent(rootDir, journal, processOccupancyInspector) {
  const recorded = journal.browser;
  if (recorded?.processOwnership !== 'owned' || typeof recorded.executable !== 'string'
    || typeof recorded.userDataDir !== 'string' || !path.isAbsolute(recorded.executable)
    || !path.isAbsolute(recorded.userDataDir)) fail('QA_RECOVERY_OWNED_PROCESS_IDENTITY_REQUIRED');
  const environment = journal.plan.environment;
  if (!environment || !samePath(environment.chrome, recorded.executable)) {
    fail('QA_RECOVERY_RECORDED_PROCESS_IDENTITY_MISMATCH');
  }
  if (typeof journal.plan.configPath !== 'string') fail('QA_RECOVERY_CONFIG_PATH_REQUIRED');
  const config = await loadQaConfigForRoot({ rootDir, configPath: journal.plan.configPath, requireExisting: true });
  const installation = resolveBrowserInstallation(config.browserResources, environment.installationId);
  if (!samePath(installation.executable, recorded.executable)) fail('QA_RECOVERY_RECORDED_PROCESS_IDENTITY_MISMATCH');
  const platform = installation.platform;
  const identity = { executable: recorded.executable, userDataDir: recorded.userDataDir,
    profileDirectory: recorded.profileDirectory, cdpEndpoint: recorded.cdpEndpoint };
  const inspect = processOccupancyInspector || (isWindowsQaPlatform(platform)
    ? inspectWslWindowsQaChromiumOccupancy : platform === 'linux' ? inspectLinuxQaChromiumOccupancy : null);
  if (!inspect) fail('QA_RECOVERY_RECORDED_PROCESS_PLATFORM_INVALID');
  const receipt = await inspect(identity);
  if (receipt?.status !== 'absent' || receipt.processCount !== 0) {
    fail('QA_RECOVERY_RECORDED_PROCESS_ABSENCE_UNPROVEN');
  }
  return Object.freeze({ status: 'already_absent', action: 'recorded_profile_process_absence', processCount: 0 });
}

async function releaseStaleResourceClaims(journal, {
  readFile = fs.readFile,
  lstat = fs.lstat,
  unlink = fs.unlink,
} = {}) {
  const outcomes = [];
  for (const claim of journal.resourceClaims.filter((entry) => (
    entry.state === 'acquired'
  ))) {
    const stat = await lstat(claim.lockPath).catch((error) => {
      if (error?.code === 'ENOENT') return null;
      throw error;
    });
    if (!stat) {
      outcomes.push(Object.freeze({
        resourceKey: claim.resourceKey,
        token: claim.token,
        status: 'already_absent',
      }));
      continue;
    }
    if (!stat.isFile() || stat.isSymbolicLink()) {
      fail('QA_RECOVERY_RESOURCE_LOCK_FILE_INVALID', claim.resourceKey);
    }
    let record;
    try {
      record = JSON.parse(await readFile(claim.lockPath, 'utf8'));
    } catch (error) {
      throw new Error(
        `QA_RECOVERY_RESOURCE_LOCK_RECORD_INVALID:${claim.resourceKey}`,
        { cause: error },
      );
    }
    if (
      record?.runId !== journal.runId
      || record.resourceKey !== claim.resourceKey
      || record.token !== claim.token
      || record.pid !== journal.runner.pid
    ) {
      fail('QA_RECOVERY_RESOURCE_LOCK_IDENTITY_MISMATCH', claim.resourceKey);
    }
    await unlink(claim.lockPath);
    outcomes.push(Object.freeze({
      resourceKey: claim.resourceKey,
      token: claim.token,
      status: 'released',
    }));
  }
  return Object.freeze(outcomes);
}

export async function recoverQaRun({
  rootDir,
  runId,
  fetchImpl = globalThis.fetch,
  runnerInspector = inspectQaRunnerIdentity,
  brokerFactory = acquireQaBrowserBroker,
  capacityFactory = acquireQaBrowserCapacity,
  identityVerifier = verifyQaPersistentBrowserIdentity,
  dedicatedProfileVerifier = verifyEntropyQaDedicatedProfileOwnership,
  cdpFactory = (webSocketUrl) => new CdpConnection(webSocketUrl),
  linuxTerminator = terminateLinuxQaChromiumByIdentity,
  windowsTerminator = terminateWslWindowsQaChromiumByIdentity,
  resourceAdapters = {},
  childJobInspector = inspectWindowsQaChildJob,
  processOccupancyInspector = null,
} = {}) {
  if (typeof rootDir !== 'string' || !path.isAbsolute(rootDir)) {
    fail('QA_RECOVERY_ROOT_ABSOLUTE_REQUIRED');
  }
  const journal = await readQaRecoveryJournal({ rootDir, runId });
  if (!journal) fail('QA_RECOVERY_JOURNAL_REQUIRED', runId || 'missing');
  if (journal.state !== 'active') {
    fail('QA_RECOVERY_JOURNAL_NOT_RECOVERABLE', journal.state);
  }
  const runner = await runnerInspector(journal.runner);
  if (runner.status !== 'absent') {
    fail('QA_RECOVERY_RUNNER_STILL_ACTIVE', runner.proof || 'unknown');
  }
  if (journal.targets.some((target) => target.state === 'reserved')) {
    fail('QA_RECOVERY_RESERVED_TARGET_PROOF_REQUIRED');
  }
  const childJobOutcomes = [];
  if (!Object.hasOwn(journal, 'childJobs')) fail('QA_RECOVERY_CHILD_JOB_CAPABILITY_REQUIRED');
  if (Object.hasOwn(journal, 'childJobs')) {
    if (journal.childJobs.some((job) => job.state === 'cleanup_failed')) fail('QA_RECOVERY_CHILD_CLEANUP_PROOF_REQUIRED');
    if (journal.childJobs.some((job) => job.state === 'unverified_targets'
      || (job.requiresCooperativeCleanup && job.state === 'admitted'))) {
      fail('QA_RECOVERY_CHILD_TARGET_PROOF_REQUIRED');
    }
    for (const job of journal.childJobs.filter((entry) => ['reserved', 'admitted'].includes(entry.state))) {
      const inspection = await childJobInspector(job.jobToken);
      if (inspection.jobToken !== job.jobToken || inspection.absent !== true) {
        fail('QA_RECOVERY_CHILD_JOB_STILL_ACTIVE', job.jobToken);
      }
      childJobOutcomes.push({ jobToken: job.jobToken, status: 'already_absent', proof: 'windows_job_absent_or_empty' });
    }
  }
  let processOutcome;
  let targetOutcomes;
  if (journal.plan.processOwnership === 'owned') {
    if (journal.ownedProcess) {
      const owned = await recoverOwnedProcess(journal, {
        linuxTerminator,
        windowsTerminator,
      });
      processOutcome = owned.process;
      targetOutcomes = owned.targets;
    } else if (journal.browser !== null) {
      processOutcome = await proveRecordedOwnedProfileAbsent(rootDir, journal, processOccupancyInspector);
      targetOutcomes = Object.freeze(journal.targets.filter((target) => target.state === 'admitted')
        .map((target) => Object.freeze({ targetId: target.targetId, purpose: target.purpose,
          status: 'already_absent', proof: 'recorded_profile_process_absence' })));
    } else if (journal.targets.every((target) => target.state !== 'admitted')) {
      processOutcome = Object.freeze({
        status: 'not_required',
        action: 'no_durable_owned_process_record',
        processCount: 0,
      });
      targetOutcomes = Object.freeze([]);
    } else {
      fail('QA_RECOVERY_OWNED_PROCESS_IDENTITY_REQUIRED');
    }
  } else if (
    journal.plan.processOwnership === 'attach_only'
    && journal.targets.every((target) => target.state !== 'admitted')
  ) {
    // A never-recorded browser or already-released target ledger grants no new
    // authority over the current persistent browser. Preserve it and reconcile
    // only this dead runner's exact resource claims.
    processOutcome = Object.freeze({
      status: 'not_required',
      action: journal.browser === null ? 'no_attached_browser_record' : 'all_recorded_attached_targets_released',
      processCount: 0,
    });
    targetOutcomes = Object.freeze([]);
  } else if (journal.plan.processOwnership === 'attach_only') {
    processOutcome = Object.freeze({
      status: 'preserved',
      action: 'managed_persistent_process_preserved',
      processCount: null,
    });
    targetOutcomes = await recoverAttachedTargets({
      rootDir,
      journal,
      fetchImpl,
      brokerFactory,
      capacityFactory,
      identityVerifier,
      dedicatedProfileVerifier,
      cdpFactory,
    });
  } else if (journal.targets.some((target) => target.state === 'admitted')) {
    fail('QA_RECOVERY_BROWSER_OWNERSHIP_REQUIRED');
  } else {
    processOutcome = Object.freeze({
      status: 'not_required',
      action: 'no_browser_owner',
      processCount: 0,
    });
    targetOutcomes = Object.freeze([]);
  }
  const resourceOutcomes = await releaseStaleResourceClaims(
    journal,
    resourceAdapters,
  );
  return completeQaRecoveryJournal({
    rootDir,
    runId,
    expectedSessionToken: journal.sessionToken,
    targetOutcomes,
    resourceOutcomes,
    processOutcome,
    childJobOutcomes,
  });
}
