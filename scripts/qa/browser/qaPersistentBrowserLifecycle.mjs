import {
  inspectQaManagedPersistentChromiumOccupancy,
  terminateQaManagedPersistentChromiumOccupants,
  launchManagedPersistentChromiumProcess,
} from '../../browser-qa/browser/chromiumProcessOwner.mjs';
import {
  attachPlaywrightBrowserOverCdp,
} from '../../browser-qa/browser/playwrightBrowserOwner.mjs';
import {
  BROWSER_EXECUTION_CONTRACT_VERSION,
  defineBrowserExecutionContract,
} from '../../browser-qa/contracts/browserExecutionContract.mjs';
import {
  inspectPersistentBrowserProfileSlot,
  runPersistentBrowserLifecycle,
} from '../../browser-qa/lifecycle/persistentBrowserLifecycle.mjs';
import {
  resolveBrowserProfileSlot,
} from '../../browser-qa/lifecycle/browserResourceRegistry.mjs';
import {
  acquireBrowserBroker,
} from '../../browser-qa/resources/BrowserBroker.mjs';
import {
  acquireBrowserCapacity,
} from '../../browser-qa/resources/BrowserCapacityLease.mjs';
import {
  resolveBrowserQaPhysicalResourceIdentities,
} from '../../browser-qa/resources/browserResourceScope.mjs';
import {
  verifyEntropyQaDedicatedProfileOwnership,
} from '../profile/entropyQaProfileMarker.mjs';
import { persistQaBrowserStartupFailure } from '../evidence/qaBrowserStartupDiagnostics.mjs';

function requireManagedEnvironment(environment) {
  if (
    !environment
    || environment.browserClass !== 'managed_persistent'
    || environment.processOwnership !== 'attach_only'
    || environment.lifecyclePolicy !== 'managed'
    || !environment.profileSlotId
  ) {
    throw new Error(
      `QA_MANAGED_PERSISTENT_ENVIRONMENT_REQUIRED:${environment?.id || 'missing'}`,
    );
  }
  return environment;
}

function resolveManagedEnvironmentProfileSlot(environment, browserResources) {
  if (browserResources !== null && browserResources !== undefined) {
    const registered = resolveBrowserProfileSlot(
      browserResources,
      environment.profileSlotId,
    );
    const embedded = environment.profileSlot || null;
    if (
      embedded
      && (
        embedded.id !== registered.id
        || embedded.installationId !== registered.installationId
        || embedded.installation?.executable !== registered.installation?.executable
        || embedded.installation?.platform !== registered.installation?.platform
        || embedded.userDataDir !== registered.userDataDir
        || embedded.profileDirectory !== registered.profileDirectory
        || embedded.cdpEndpoint !== registered.cdpEndpoint
        || embedded.lifecyclePolicy !== registered.lifecyclePolicy
        || embedded.profileOwnershipPolicy !== registered.profileOwnershipPolicy
        || embedded.focusPolicy !== registered.focusPolicy
        || embedded.launchAudioPolicy !== registered.launchAudioPolicy
      )
    ) {
      throw new Error(
        `QA_MANAGED_PERSISTENT_PROFILE_SLOT_MISMATCH:${environment.id}`,
      );
    }
    return registered;
  }
  const embedded = environment.profileSlot;
  if (
    !embedded
    || embedded.id !== environment.profileSlotId
    || embedded.installationId !== environment.installationId
    || embedded.installation?.id !== embedded.installationId
    || embedded.installation?.source !== 'path'
    || embedded.installation?.executable !== environment.chrome
    || !['linux', 'windows_via_wsl', 'windows'].includes(embedded.installation?.platform)
    || embedded.userDataDir !== environment.profile
    || embedded.profileDirectory !== environment.profileDirectory
    || embedded.cdpEndpoint !== environment.cdpEndpoint
    || embedded.lifecyclePolicy !== 'managed'
    || embedded.profileOwnershipPolicy !== 'dedicated_adapter_proof_required'
    || embedded.focusPolicy !== 'never'
    || environment.focusPolicy !== 'never'
    || !['muted', 'audible'].includes(embedded.launchAudioPolicy)
  ) {
    throw new Error(
      `QA_MANAGED_PERSISTENT_PROFILE_SLOT_SNAPSHOT_REQUIRED:${environment.id}`,
    );
  }
  return embedded;
}

function expectedIdentity(profileSlot) {
  return Object.freeze({
    installationId: profileSlot.installationId,
    executable: profileSlot.installation.executable,
    platform: profileSlot.installation.platform,
    profileSlotId: profileSlot.id,
    userDataDir: profileSlot.userDataDir,
    profileDirectory: profileSlot.profileDirectory,
    cdpEndpoint: profileSlot.cdpEndpoint,
  });
}

function persistentIdentityProbeExecutionContract(profileSlot) {
  return defineBrowserExecutionContract({
    contractVersion: BROWSER_EXECUTION_CONTRACT_VERSION,
    processOwnership: 'attach_only',
    headless: null,
    startPolicy: profileSlot.lifecyclePolicy === 'managed'
      ? 'managed_explicit'
      : 'external',
    displayPolicy: 'external_display',
    documentVisibility: 'background_allowed',
    targetActivation: 'background',
    osFocus: 'never',
    audioPolicy: profileSlot.launchAudioPolicy,
    gpuRequirement: 'software_or_unclassified_allowed',
    webglRequirement: 'optional',
    extensionRuntime: 'none',
  });
}

async function releaseLifecycleLeasesReverse(leases, message) {
  const errors = [];
  for (const lease of [...leases].reverse()) {
    await lease.release().catch((error) => errors.push(error));
  }
  if (errors.length === 1) throw errors[0];
  if (errors.length > 1) throw new AggregateError(errors, message);
}

export async function verifyQaPersistentBrowserIdentity({
  rootDir,
  profileSlot,
  ownerId = `qa-browser-identity:${profileSlot?.id || 'unknown'}:pid=${process.pid}`,
  capacityLease = null,
  attachmentFactory = attachPlaywrightBrowserOverCdp,
} = {}) {
  const identity = expectedIdentity(profileSlot);
  const attachment = await attachmentFactory(
    profileSlot.cdpEndpoint,
    {},
    {
      rootDir,
      ownerId,
      executionPlan: persistentIdentityProbeExecutionContract(profileSlot),
      renderingRequirement: 'headless_ok',
      audioPolicy: profileSlot.launchAudioPolicy,
      expectedBrowserIdentity: identity,
      ...(capacityLease ? { capacityLease } : {}),
    },
  );
  let primaryError = null;
  try {
    if (attachment.browserIdentity?.status !== 'declared_identity_verified') {
      throw new Error('QA_PERSISTENT_BROWSER_IDENTITY_UNVERIFIED');
    }
    return attachment.browserIdentity;
  } catch (error) {
    primaryError = error;
    throw error;
  } finally {
    const cleanupErrors = [];
    await attachment.release().catch((error) => cleanupErrors.push(error));
    if (cleanupErrors.length > 0) {
      if (primaryError) {
        throw new AggregateError(
          [primaryError, ...cleanupErrors],
          'QA_PERSISTENT_BROWSER_IDENTITY_AND_DETACH_FAILED',
          { cause: primaryError },
        );
      }
      if (cleanupErrors.length === 1) throw cleanupErrors[0];
      throw new AggregateError(
        cleanupErrors,
        'QA_PERSISTENT_BROWSER_IDENTITY_DETACH_FAILED',
      );
    }
  }
}

export async function inspectQaPersistentBrowserEnvironment({
  rootDir,
  environment,
  browserResources,
  fetchImpl = globalThis.fetch,
  stat,
  verifyIdentity = verifyQaPersistentBrowserIdentity,
  verifyDedicatedProfileOwnership = verifyEntropyQaDedicatedProfileOwnership,
} = {}) {
  if (!environment?.profileSlotId) {
    throw new Error(
      `QA_PERSISTENT_BROWSER_PROFILE_SLOT_REQUIRED:${environment?.id || 'missing'}`,
    );
  }
  const profileSlot = resolveBrowserProfileSlot(
    browserResources,
    environment.profileSlotId,
  );
  let dedicatedProfileOwnership = null;
  if (profileSlot.lifecyclePolicy === 'managed') {
    try {
      dedicatedProfileOwnership = await verifyDedicatedProfileOwnership({
        profileSlot,
        action: 'inspect',
      });
    } catch (error) {
      dedicatedProfileOwnership = Object.freeze({
        status: 'unverified',
        reason: error?.message || String(error),
      });
    }
  }
  return inspectPersistentBrowserProfileSlot(profileSlot, {
    fetchImpl,
    ...(stat ? { stat } : {}),
    dedicatedProfileOwnership,
    verifyBrowserIdentity: ({ profileSlot: slot }) => verifyIdentity({
      rootDir,
      profileSlot: slot,
    }),
  });
}

export async function runQaManagedPersistentBrowserAction({
  rootDir,
  environment,
  browserResources = null,
  action,
  signal = null,
  startupTimeoutMs,
  fetchImpl = globalThis.fetch,
  stat,
  translateWslPath,
  wait,
  now,
  brokerFactory = acquireBrowserBroker,
  capacityFactory = acquireBrowserCapacity,
  processLauncher = launchManagedPersistentChromiumProcess,
  processSlotInspector = inspectQaManagedPersistentChromiumOccupancy,
  processTerminator = terminateQaManagedPersistentChromiumOccupants,
  verifyIdentity = verifyQaPersistentBrowserIdentity,
  verifyDedicatedProfileOwnership = verifyEntropyQaDedicatedProfileOwnership,
} = {}) {
  const managedEnvironment = requireManagedEnvironment(environment);
  const profileSlot = resolveManagedEnvironmentProfileSlot(
    managedEnvironment,
    browserResources,
  );
  let lifecycleCapacity = null;
  return runPersistentBrowserLifecycle({
    action,
    profileSlot,
    signal,
    fetchImpl,
    verifyDedicatedProfileOwnership,
    ...(stat ? { stat } : {}),
    ...(translateWslPath ? { translateWslPath } : {}),
    ...(wait ? { wait } : {}),
    ...(now ? { now } : {}),
    ...(startupTimeoutMs === undefined ? {} : { startupTimeoutMs }),
    acquireLease: async () => {
      const ownerId = `browser-lifecycle:${action}:${managedEnvironment.id}:pid=${process.pid}`;
      const broker = await brokerFactory({
        rootDir,
        environment: managedEnvironment,
        ownerId,
      });
      let capacity = null;
      try {
        capacity = await capacityFactory({
          rootDir,
          ownerId,
          browserResourceIdentities: resolveBrowserQaPhysicalResourceIdentities({
            cdpEndpoint: profileSlot.cdpEndpoint,
            userDataDir: profileSlot.userDataDir,
            profileDirectory: profileSlot.profileDirectory,
          }),
        });
        if (!capacity || typeof capacity.release !== 'function') {
          throw new Error('QA_BROWSER_LIFECYCLE_CAPACITY_LEASE_INVALID');
        }
        lifecycleCapacity = capacity;
        await broker.updateRuntime({
          status: 'lifecycle',
          profileSlotId: profileSlot.id,
          nextAction: action,
        });
      } catch (error) {
        try {
          await releaseLifecycleLeasesReverse(
            [broker, ...(capacity ? [capacity] : [])],
            'QA_BROWSER_LIFECYCLE_LEASE_ROLLBACK_INCOMPLETE',
          );
        } catch (releaseError) {
          throw new AggregateError(
            [error, releaseError],
            'QA_BROWSER_LIFECYCLE_BROKER_ROLLBACK_FAILED',
            { cause: error },
          );
        }
        lifecycleCapacity = null;
        throw error;
      }
      let releasePromise = null;
      return Object.freeze({
        release() {
          if (!releasePromise) {
            releasePromise = releaseLifecycleLeasesReverse(
              [broker, capacity],
              'QA_BROWSER_LIFECYCLE_LEASE_RELEASE_INCOMPLETE',
            ).then((receipt) => {
              lifecycleCapacity = null;
              return receipt;
            }).catch((error) => {
              releasePromise = null;
              throw error;
            });
          }
          return releasePromise;
        },
      });
    },
    launchProcess: async (launchSpec) => {
      return processLauncher({
        chromePath: launchSpec.executable,
        args: launchSpec.args,
        audioPolicy: launchSpec.audioPolicy,
        launchEnvironment: launchSpec.launchEnvironment,
      }, {
        profileSlotId: launchSpec.profileSlotId,
        platform: launchSpec.platform,
        expectedBrowserIdentity: launchSpec.expectedBrowserIdentity,
      });
    },
    terminateProcess: async (launchSpec) => processTerminator({
      platform: launchSpec.platform,
      expectedBrowserIdentity: launchSpec.expectedBrowserIdentity,
    }),
    inspectProcessSlotAvailability: async (launchSpec, { allowPresent = false } = {}) => {
      let occupancy;
      try {
        occupancy = await processSlotInspector({
          platform: launchSpec.platform,
          expectedBrowserIdentity: launchSpec.expectedBrowserIdentity,
        });
      } catch (error) {
        const blocked = new Error(
          `BROWSER_QA_MANAGED_PROCESS_SLOT_INSPECTION_BLOCKED:${launchSpec.profileSlotId}`,
          { cause: error },
        );
        blocked.code = 'BROWSER_QA_MANAGED_PROCESS_SLOT_INSPECTION_BLOCKED';
        blocked.stage = 'prelaunch_process_slot_inspection';
        throw blocked;
      }
      if (occupancy.status === 'present') {
        // A stop is the one action for which an occupied slot is the point.
        if (allowPresent) return occupancy;
        const error = new Error(
          `BROWSER_QA_MANAGED_PROCESS_ALREADY_PRESENT:${launchSpec.profileSlotId}`,
        );
        error.code = 'BROWSER_QA_MANAGED_PROCESS_ALREADY_PRESENT';
        error.occupancy = occupancy;
        throw error;
      }
      return occupancy;
    },
    verifyBrowserIdentity: ({ profileSlot: slot }) => {
      if (!lifecycleCapacity) {
        throw new Error('QA_BROWSER_LIFECYCLE_CAPACITY_RESERVATION_REQUIRED');
      }
      return verifyIdentity({
        rootDir,
        profileSlot: slot,
        capacityLease: lifecycleCapacity,
      });
    },
  }).catch(async (error) => {
    throw await persistQaBrowserStartupFailure(error, { rootDir });
  });
}
