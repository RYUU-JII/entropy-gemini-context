import path from 'node:path';
import { inferBrowserQaPlatform } from './windowsPlatform.mjs';
import {
  readWindowsQaMonitorInventory,
  resolveWindowsQaLaunchPlacement,
} from './windowsLaunchPlacement.mjs';

import {
  probeQaBrowserGpuCapability,
} from './gpuCapability.mjs';
import {
  resolveQaChromiumGraphicsLaunch,
} from './chromiumGraphicsArguments.mjs';
import {
  verifyAttachedBrowserIdentity,
} from './attachedBrowserIdentity.mjs';
import {
  projectBrowserExecutionContract,
} from '../contracts/browserExecutionContract.mjs';
import {
  acquireQaBrowserCapacity,
  borrowQaBrowserCapacity,
} from '../resources/BrowserCapacityLease.mjs';
import {
  QaDisplayLease,
} from '../resources/DisplayLease.mjs';
import {
  normalizeBrowserQaCdpEndpoint,
  resolveBrowserQaPhysicalResourceIdentities,
} from '../resources/browserResourceScope.mjs';

const browserReceipts = new WeakMap();
const PRESENTATIONS = new Set(['foreground', 'background', 'hidden']);

function appendLaunchArgument(args, argument) {
  return args.includes(argument) ? args : [...args, argument];
}

function hasOwn(value, key) {
  return Object.prototype.hasOwnProperty.call(value, key);
}

function renderingRequirementFromExecutionContract(executionContract) {
  return executionContract.gpuRequirement === 'hardware_active_required'
    ? 'physical_gpu_required'
    : 'headless_ok';
}

function gpuRequirementFromRenderingRequirement(renderingRequirement) {
  return renderingRequirement === 'physical_gpu_required'
    ? 'hardware_active_required'
    : 'software_or_unclassified_allowed';
}

function assertPresentationMatchesExecutionContract(presentation, executionContract) {
  if (presentation === null || presentation === undefined) return null;
  if (!PRESENTATIONS.has(presentation)) {
    throw new Error(`QA_PLAYWRIGHT_PRESENTATION_INVALID:${presentation}`);
  }
  let matches = false;
  if (executionContract.processOwnership === 'attach_only') {
    matches = presentation !== 'hidden'
      && executionContract.headless === null
      && executionContract.displayPolicy === 'external_display';
  } else if (presentation === 'hidden') {
    matches = executionContract.headless === true
      && executionContract.displayPolicy === 'none';
  } else if (presentation === 'foreground') {
    matches = executionContract.headless === false
      && executionContract.displayPolicy === 'host_display_required';
  } else {
    matches = executionContract.headless === false
      && executionContract.displayPolicy === 'host_or_managed_display';
  }
  if (!matches) {
    throw new Error(
      `QA_PLAYWRIGHT_PRESENTATION_CONTRACT_MISMATCH:${presentation}`,
    );
  }
  return presentation;
}

function normalizeManagement(management) {
  if (!management || typeof management !== 'object' || Array.isArray(management)) {
    throw new Error('QA_PLAYWRIGHT_MANAGEMENT_INVALID');
  }
  if (!management.executionPlan) {
    throw new Error('QA_PLAYWRIGHT_EXECUTION_CONTRACT_REQUIRED');
  }
  const executionContract = projectBrowserExecutionContract(management.executionPlan);
  const contractRenderingRequirement = renderingRequirementFromExecutionContract(
    executionContract,
  );
  if (
    hasOwn(management, 'renderingRequirement')
    && !['headless_ok', 'headed_required', 'physical_gpu_required']
      .includes(management.renderingRequirement)
  ) {
    throw new Error(
      `QA_PLAYWRIGHT_RENDERING_REQUIREMENT_INVALID:${management.renderingRequirement}`,
    );
  }
  if (
    hasOwn(management, 'renderingRequirement')
    && (
      gpuRequirementFromRenderingRequirement(management.renderingRequirement)
        !== executionContract.gpuRequirement
      || (
        management.renderingRequirement === 'headed_required'
        && executionContract.headless === true
      )
    )
  ) {
    throw new Error('QA_PLAYWRIGHT_RENDERING_CONTRACT_MISMATCH');
  }
  if (
    hasOwn(management, 'audioPolicy')
    && management.audioPolicy !== executionContract.audioPolicy
  ) {
    throw new Error('QA_PLAYWRIGHT_AUDIO_CONTRACT_MISMATCH');
  }
  const presentation = assertPresentationMatchesExecutionContract(
    management.presentation,
    executionContract,
  );
  const launchEnvironment = management.launchEnvironment || {};
  if (
    typeof launchEnvironment !== 'object'
    || Array.isArray(launchEnvironment)
    || Object.values(launchEnvironment).some((value) => typeof value !== 'string')
  ) {
    throw new Error('QA_PLAYWRIGHT_LAUNCH_ENVIRONMENT_INVALID');
  }
  const displayReceipt = management.displayReceipt || null;
  if (
    displayReceipt
    && (
      typeof displayReceipt !== 'object'
      || Array.isArray(displayReceipt)
      || typeof displayReceipt.kind !== 'string'
      || !displayReceipt.launchEnvironment
    )
  ) {
    throw new Error('QA_PLAYWRIGHT_DISPLAY_RECEIPT_INVALID');
  }
  const identityPolicy = management.identityPolicy
    || 'declared_identity_required';
  if (!['declared_identity_required', 'endpoint_only_explicit'].includes(identityPolicy)) {
    throw new Error(`QA_PLAYWRIGHT_IDENTITY_POLICY_INVALID:${identityPolicy}`);
  }
  if (management.capacityLease && management.capacityFactory) {
    throw new Error('QA_PLAYWRIGHT_CAPACITY_MANAGEMENT_CONFLICT');
  }
  const capacityMode = management.capacityMode === undefined ? 'exclusive' : management.capacityMode;
  if (!['exclusive', 'shared_capture'].includes(capacityMode)
    || (capacityMode === 'shared_capture' && (
      executionContract.processOwnership !== 'owned' || executionContract.extensionRuntime !== 'none'
    ))) throw new Error('QA_PLAYWRIGHT_CAPACITY_MODE_INVALID');
  return {
    rootDir: path.resolve(management.rootDir || process.cwd()),
    ownerId: management.ownerId || `qa-playwright:pid=${process.pid}`,
    executionContract,
    presentation,
    renderingRequirement: contractRenderingRequirement,
    audioPolicy: executionContract.audioPolicy,
    launchEnvironment,
    displayReceipt,
    identityPolicy,
    expectedBrowserIdentity: management.expectedBrowserIdentity || null,
    browserType: management.browserType || null,
    capacityLease: management.capacityLease || null,
    capacityMode,
    capacityFactory: management.capacityFactory || acquireQaBrowserCapacity,
    displayLeaseFactory: management.displayLeaseFactory
      || ((options) => new QaDisplayLease(options)),
    monitorInventory: management.monitorInventory || readWindowsQaMonitorInventory,
  };
}

function resolveAttachCapacityIdentities(cdpEndpoint, expectedBrowserIdentity) {
  return resolveBrowserQaPhysicalResourceIdentities({
    cdpEndpoint,
    ...(expectedBrowserIdentity ? {
      userDataDir: expectedBrowserIdentity.userDataDir
        ?? expectedBrowserIdentity.profile,
      profileDirectory: expectedBrowserIdentity.profileDirectory,
    } : {}),
  });
}

function managedBrowserProxy(browser, closeManagedBrowser) {
  return new Proxy(browser, {
    get(target, property) {
      if (property === 'close') return closeManagedBrowser;
      const value = Reflect.get(target, property, target);
      return typeof value === 'function' ? value.bind(target) : value;
    },
  });
}

export function readQaPlaywrightBrowserReceipt(browser) {
  return browserReceipts.get(browser) || null;
}

export async function attachQaPlaywrightBrowserOverCdp(
  cdpEndpoint,
  connectOptions = {},
  management = {},
) {
  if (typeof cdpEndpoint !== 'string' || !cdpEndpoint.trim()) {
    throw new Error('QA_PLAYWRIGHT_CDP_ENDPOINT_REQUIRED');
  }
  const owner = normalizeManagement(management);
  if (owner.executionContract.processOwnership !== 'attach_only') {
    throw new Error('QA_PLAYWRIGHT_ATTACH_EXECUTION_OWNERSHIP_INVALID');
  }
  if (
    owner.identityPolicy === 'declared_identity_required'
    && !owner.expectedBrowserIdentity
  ) {
    throw new Error('QA_PLAYWRIGHT_EXPECTED_BROWSER_IDENTITY_REQUIRED');
  }
  if (
    owner.identityPolicy === 'endpoint_only_explicit'
    && owner.expectedBrowserIdentity
  ) {
    throw new Error('QA_PLAYWRIGHT_IDENTITY_POLICY_CONFLICT');
  }
  const browserType = owner.browserType || (await import('playwright')).chromium;
  if (typeof browserType?.connectOverCDP !== 'function') {
    throw new Error('QA_PLAYWRIGHT_CDP_BROWSER_TYPE_INVALID');
  }
  const browserResourceIdentities = resolveAttachCapacityIdentities(
    cdpEndpoint,
    owner.expectedBrowserIdentity,
  );
  const capacityLease = owner.capacityLease
    ? borrowQaBrowserCapacity(owner.capacityLease, { browserResourceIdentities })
    : await owner.capacityFactory({
      rootDir: owner.rootDir,
      ownerId: owner.ownerId,
      browserResourceIdentities,
    });
  let browser;
  let gpuCapability;
  let browserIdentity;
  try {
    browser = await browserType.connectOverCDP(cdpEndpoint, connectOptions);
    const cdp = await browser.newBrowserCDPSession();
    try {
      browserIdentity = await verifyAttachedBrowserIdentity(cdp, {
        cdpEndpoint,
        expectedBrowserIdentity: owner.expectedBrowserIdentity,
      });
      gpuCapability = await probeQaBrowserGpuCapability(cdp, {
        renderingRequirement: owner.renderingRequirement,
      });
    } finally {
      await cdp.detach().catch(() => {});
    }
  } catch (error) {
    const rollbackErrors = [];
    if (browser) {
      await browser.close().catch((closeError) => rollbackErrors.push(closeError));
    }
    await capacityLease.release().catch((releaseError) => rollbackErrors.push(releaseError));
    if (rollbackErrors.length > 0) {
      throw new AggregateError(
        [error, ...rollbackErrors],
        `QA_PLAYWRIGHT_ATTACH_ROLLBACK_FAILED:${error?.message || error}`,
        { cause: error },
      );
    }
    throw error;
  }
  let releasePromise = null;
  const release = () => {
    if (!releasePromise) {
      releasePromise = (async () => {
        const errors = [];
        // A Browser returned by connectOverCDP is connection-owned: Playwright
        // close disconnects this client, while the external browser process stays alive.
        if (browser.isConnected?.() !== false) {
          await browser.close().catch((error) => errors.push(error));
        }
        await capacityLease.release().catch((error) => errors.push(error));
        if (errors.length === 1) throw errors[0];
        if (errors.length > 1) {
          throw new AggregateError(
            errors,
            'QA_PLAYWRIGHT_ATTACHMENT_RELEASE_FAILED',
          );
        }
        return Object.freeze({
          resource: 'playwright_cdp_attachment',
          status: 'released',
          connectionAction: 'playwright_connection_disconnected',
          processAction: 'external_browser_preserved',
        });
      })();
    }
    return releasePromise;
  };
  browser.once?.('disconnected', () => {
    void release().catch(() => {});
  });
  const receipt = Object.freeze({
    ownerId: owner.ownerId,
    processOwnership: 'attach_only',
    executionContract: owner.executionContract,
    identityPolicy: owner.identityPolicy,
    browserIdentity,
    gpuCapability,
  });
  browserReceipts.set(browser, receipt);
  const proxy = managedBrowserProxy(browser, release);
  browserReceipts.set(proxy, receipt);
  return Object.freeze({
    browser: proxy,
    browserIdentity,
    gpuCapability,
    disconnect: release,
    release,
  });
}

export async function launchQaPlaywrightBrowser(
  launchOptions = {},
  management = {},
) {
  if (!launchOptions || typeof launchOptions !== 'object' || Array.isArray(launchOptions)) {
    throw new Error('QA_PLAYWRIGHT_LAUNCH_OPTIONS_INVALID');
  }
  const owner = normalizeManagement(management);
  if (owner.capacityLease && owner.capacityMode !== 'shared_capture') {
    throw new Error('QA_PLAYWRIGHT_LAUNCH_CAPACITY_RESERVATION_FORBIDDEN');
  }
  if (owner.executionContract.processOwnership !== 'owned') {
    throw new Error('QA_PLAYWRIGHT_LAUNCH_EXECUTION_OWNERSHIP_INVALID');
  }
  const browserType = owner.browserType || (await import('playwright')).chromium;
  if (!browserType || typeof browserType.launch !== 'function') {
    throw new Error('QA_PLAYWRIGHT_BROWSER_TYPE_INVALID');
  }
  if (
    hasOwn(launchOptions, 'headless')
    && launchOptions.headless !== owner.executionContract.headless
  ) {
    throw new Error('QA_PLAYWRIGHT_LAUNCH_HEADLESS_CONTRACT_MISMATCH');
  }
  const headless = owner.executionContract.headless;
  const executablePath = launchOptions.executablePath
    || browserType.executablePath?.()
    || null;
  const executionPlan = Object.freeze({
    ...owner.executionContract,
    ...(owner.presentation ? { presentation: owner.presentation } : {}),
    renderingRequirement: owner.renderingRequirement,
  });
  const browserDescriptor = Object.freeze({
    processOwnership: 'owned',
    chrome: executablePath,
  });

  const capacityLease = owner.capacityLease
    ? borrowQaBrowserCapacity(owner.capacityLease, {
      rootDir: owner.rootDir, reservationMode: owner.capacityMode,
    }) : await owner.capacityFactory({
    rootDir: owner.rootDir,
    ownerId: owner.ownerId,
    reservationMode: owner.capacityMode,
  });
  let displayLease = null;
  let display = null;
  let browser = null;
  try {
    if (owner.displayReceipt) {
      display = owner.displayReceipt;
      displayLease = Object.freeze({
        release: async () => Object.freeze({
          resource: 'display',
          status: 'delegated_to_outer_owner',
        }),
      });
    } else {
      displayLease = owner.displayLeaseFactory({
        rootDir: owner.rootDir,
        executionPlan,
        browser: browserDescriptor,
        processEnvironment: {
          ...process.env,
          ...owner.launchEnvironment,
        },
      });
      display = await displayLease.acquire();
    }
    let args = Array.isArray(launchOptions.args) ? [...launchOptions.args] : [];
    if (
      owner.audioPolicy === 'audible'
      && args.some((argument) => (
        argument === '--mute-audio' || argument.startsWith('--mute-audio=')
      ))
    ) {
      throw new Error('QA_PLAYWRIGHT_AUDIO_LAUNCH_ARGUMENT_CONFLICT');
    }
    if (owner.audioPolicy === 'muted') args = appendLaunchArgument(args, '--mute-audio');
    const graphicsLaunch = resolveQaChromiumGraphicsLaunch({
      args,
      executionContract: owner.executionContract,
      displayReceipt: display,
    });
    args = [...graphicsLaunch.args];
    const windowPlacement = resolveWindowsQaLaunchPlacement({
      args,
      headless,
      platform: executablePath ? inferBrowserQaPlatform(executablePath)
        : display.kind === 'windows_desktop' && process.platform === 'win32' ? 'windows' : 'linux',
      monitorInventory: owner.monitorInventory,
    });
    args = [...windowPlacement.args];
    browser = await browserType.launch({
      ...launchOptions,
      headless,
      args,
      env: {
        ...process.env,
        ...owner.launchEnvironment,
        ...display.launchEnvironment,
        ...(launchOptions.env || {}),
      },
    });
    const cdp = await browser.newBrowserCDPSession();
    let gpuCapability;
    try {
      gpuCapability = await probeQaBrowserGpuCapability(cdp, {
        renderingRequirement: owner.renderingRequirement,
      });
    } finally {
      await cdp.detach().catch(() => {});
    }

    let infrastructureRelease = null;
    const releaseInfrastructure = () => {
      if (!infrastructureRelease) {
        infrastructureRelease = (async () => {
          const errors = [];
          await displayLease.release().catch((error) => errors.push(error));
          await capacityLease.release().catch((error) => errors.push(error));
          if (errors.length === 1) throw errors[0];
          if (errors.length > 1) {
            throw new AggregateError(errors, 'QA_PLAYWRIGHT_INFRASTRUCTURE_RELEASE_FAILED');
          }
        })();
      }
      return infrastructureRelease;
    };
    browser.once?.('disconnected', () => {
      void releaseInfrastructure().catch(() => {});
    });
    let closePromise = null;
    const closeManagedBrowser = () => {
      if (!closePromise) {
        closePromise = (async () => {
          let browserCloseError = null;
          await browser.close().catch((error) => {
            browserCloseError = error;
          });
          let releaseError = null;
          await releaseInfrastructure().catch((error) => {
            releaseError = error;
          });
          if (browserCloseError && releaseError) {
            throw new AggregateError(
              [browserCloseError, releaseError],
              'QA_PLAYWRIGHT_BROWSER_AND_INFRASTRUCTURE_CLOSE_FAILED',
            );
          }
          if (browserCloseError) throw browserCloseError;
          if (releaseError) throw releaseError;
        })();
      }
      return closePromise;
    };
    const proxy = managedBrowserProxy(browser, closeManagedBrowser);
    const receipt = Object.freeze({
      ownerId: owner.ownerId,
      executionContract: owner.executionContract,
      presentation: owner.presentation,
      headless,
      audioPolicy: owner.audioPolicy,
      display,
      gpuCapability,
      graphicsLaunchPolicy: graphicsLaunch.policy,
      windowPlacement: windowPlacement.receipt,
      capacityReservation: owner.capacityLease ? owner.capacityLease.owner : capacityLease.owner,
    });
    browserReceipts.set(browser, receipt);
    browserReceipts.set(proxy, receipt);
    return proxy;
  } catch (error) {
    const cleanupErrors = [];
    if (browser) await browser.close().catch((cleanupError) => cleanupErrors.push(cleanupError));
    if (displayLease) {
      await displayLease.release().catch((cleanupError) => cleanupErrors.push(cleanupError));
    }
    await capacityLease.release().catch((cleanupError) => cleanupErrors.push(cleanupError));
    if (cleanupErrors.length > 0) {
      throw new AggregateError(
        [error, ...cleanupErrors],
        `QA_PLAYWRIGHT_LAUNCH_ROLLBACK_FAILED:${error?.message || error}`,
        { cause: error },
      );
    }
    throw error;
  }
}

export {
  attachQaPlaywrightBrowserOverCdp as attachPlaywrightBrowserOverCdp,
  launchQaPlaywrightBrowser as launchPlaywrightBrowser,
  readQaPlaywrightBrowserReceipt as readPlaywrightBrowserReceipt,
};
