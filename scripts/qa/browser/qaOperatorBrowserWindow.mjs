import { inferBrowserQaPlatform, isWindowsQaPlatform } from '../../browser-qa/browser/windowsPlatform.mjs';
import { requireQaOwnedInitialWindowPresentationPolicy } from '../contracts/qaInitialWindowFocusPolicy.mjs';
import {
  readQaOwnedChromiumProcessReceipt,
  verifyQaOwnedChromiumEndpointIdentity,
} from '../../browser-qa/browser/chromiumProcessOwner.mjs';
import {
  closeQaCdpTarget,
  createQaCdpPageTarget,
  listQaCdpTargets,
  navigateQaCdpPageTarget,
  readQaCdpPageTargetWindow,
} from '../../browser-qa/browser/cdpTargetOwner.mjs';
import { CdpConnection } from '../../browser-qa/cdp/CdpConnection.mjs';
import {
  resolveBrowserProfileSlot,
} from '../../browser-qa/lifecycle/browserResourceRegistry.mjs';
import {
  probePersistentBrowserCdp,
  projectBrowserQaDedicatedProfileOwnership,
} from '../../browser-qa/lifecycle/persistentBrowserLifecycle.mjs';
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
  focusWindowsChromeWindow,
  inspectWindowsChromeForegroundState,
} from '../drivers/windowsChromeToolbarDriver.mjs';
import {
  verifyEntropyQaDedicatedProfileOwnership,
} from '../profile/entropyQaProfileMarker.mjs';
import {
  runQaManagedPersistentBrowserAction,
  verifyQaPersistentBrowserIdentity,
} from './qaPersistentBrowserLifecycle.mjs';

const OPERATOR_WINDOW_OWNER_PURPOSE = 'operator_window';

function requireOperatorPageUrl(value) {
  if (typeof value !== 'string' || !value || value !== value.trim()) {
    throw new Error('QA_OPERATOR_BROWSER_PAGE_URL_REQUIRED');
  }
  if (value === 'about:blank') return value;
  let parsed;
  try {
    parsed = new URL(value);
  } catch (cause) {
    throw new Error('QA_OPERATOR_BROWSER_PAGE_URL_INVALID', { cause });
  }
  if (
    !['http:', 'https:'].includes(parsed.protocol)
    || parsed.username
    || parsed.password
  ) {
    throw new Error('QA_OPERATOR_BROWSER_PAGE_URL_FORBIDDEN');
  }
  return parsed.href;
}

function requireManagedWindowsEnvironment(environment, browserResources) {
  if (
    !environment
    || environment.browserClass !== 'managed_persistent'
    || environment.processOwnership !== 'attach_only'
    || environment.lifecyclePolicy !== 'managed'
    || !environment.profileSlotId
  ) {
    throw new Error(
      `QA_OPERATOR_BROWSER_MANAGED_ENVIRONMENT_REQUIRED:${environment?.id || 'missing'}`,
    );
  }
  const profileSlot = resolveBrowserProfileSlot(
    browserResources,
    environment.profileSlotId,
  );
  if (!isWindowsQaPlatform(profileSlot.installation.platform)) {
    throw new Error(
      `QA_OPERATOR_BROWSER_WINDOWS_CHROME_REQUIRED:${environment.id}`,
    );
  }
  return profileSlot;
}

async function releaseReverse(resources, message) {
  const errors = [];
  for (const resource of [...resources].reverse()) {
    await resource.release().catch((error) => errors.push(error));
  }
  if (errors.length === 1) throw errors[0];
  if (errors.length > 1) throw new AggregateError(errors, message);
}

function flattenErrors(error) {
  return error instanceof AggregateError ? [...error.errors] : [error];
}

export function requireQaWindowPresentationReceipt(presentation) {
  const expectedKeys = ['after', 'before', 'expected', 'placement'];
  const validBounds = value => Array.isArray(value) && value.length === 4
    && value.every(Number.isSafeInteger) && value[2] > 0 && value[3] > 0;
  const validPresentation = value => Array.isArray(value) && value.length === 5
    && validBounds(value.slice(0, 4)) && [1, 2, 3].includes(value[4]);
  if (!presentation || typeof presentation !== 'object' || Array.isArray(presentation)
    || JSON.stringify(Object.keys(presentation).sort()) !== JSON.stringify(expectedKeys)
    || ![presentation.before, presentation.expected, presentation.after].every(validPresentation)) {
    throw new Error('QA_OPERATOR_BROWSER_PRESENTATION_RECEIPT_REQUIRED');
  }
  const { before, expected, after, placement } = presentation;
  const placementKeys = ['geometryTolerance', 'monitorCount', 'moveRequested', 'policy',
    'selectedMonitor', 'selectedPrimary', 'selectedWorkArea', 'status'];
  if (!placement || typeof placement !== 'object' || Array.isArray(placement)
    || JSON.stringify(Object.keys(placement).sort()) !== JSON.stringify(placementKeys)
    || placement.policy !== 'secondary_preferred'
    || !Number.isSafeInteger(placement.monitorCount) || placement.monitorCount < 1
    || typeof placement.moveRequested !== 'boolean' || typeof placement.selectedPrimary !== 'boolean'
    || !validBounds(placement.selectedMonitor) || !validBounds(placement.selectedWorkArea)
    || placement.status !== (placement.monitorCount === 1 ? 'single_monitor_unchanged' : 'secondary_selected')
    || placement.selectedPrimary !== (placement.monitorCount === 1)
    || (placement.moveRequested && placement.monitorCount === 1)
    || ![0, 32].includes(placement.geometryTolerance)) {
    throw new Error('QA_OPERATOR_BROWSER_MONITOR_PLACEMENT_RECEIPT_INVALID');
  }
  const [monitorX, monitorY, monitorWidth, monitorHeight] = placement.selectedMonitor;
  const [workX, workY, workWidth, workHeight] = placement.selectedWorkArea;
  if (workX < monitorX || workY < monitorY
    || workX + workWidth > monitorX + monitorWidth
    || workY + workHeight > monitorY + monitorHeight) {
    throw new Error('QA_OPERATOR_BROWSER_MONITOR_PLACEMENT_RECEIPT_INVALID');
  }
  const maximizedRestore = expected[4] === 3 && (placement.moveRequested || before[4] === 2);
  if (placement.geometryTolerance !== (maximizedRestore ? 32 : 0)
    || (before[4] !== 2 && expected[4] !== before[4])
    || expected[4] === 2
    || (!placement.moveRequested && before[4] !== 2
      && before.some((value, index) => value !== expected[index]))
    || (!placement.moveRequested && before[4] === 2 && expected[4] === 1
      && before.slice(0, 4).some((value, index) => value !== expected[index]))
    || (maximizedRestore && placement.selectedWorkArea.some((value, index) => value !== expected[index]))) {
    throw new Error('QA_OPERATOR_BROWSER_PRESENTATION_CHANGED');
  }
  if (placement.moveRequested && expected[4] === 1) {
    const width = Math.min(before[2], workWidth);
    const height = Math.min(before[3], workHeight);
    const planned = [workX + Math.floor((workWidth - width) / 2),
      workY + Math.floor((workHeight - height) / 2), width, height];
    if (planned.some((value, index) => value !== expected[index])) {
      throw new Error('QA_OPERATOR_BROWSER_PRESENTATION_CHANGED');
    }
  }
  if (after.some((value, index) => Math.abs(value - expected[index])
    > (index === 4 ? 0 : placement.geometryTolerance))) {
    throw new Error('QA_OPERATOR_BROWSER_PRESENTATION_CHANGED');
  }
  return Object.freeze({ before: Object.freeze([...before]), expected: Object.freeze([...expected]),
    after: Object.freeze([...after]), placement: Object.freeze({ ...placement,
      selectedMonitor: Object.freeze([...placement.selectedMonitor]),
      selectedWorkArea: Object.freeze([...placement.selectedWorkArea]) }) });
}

function requireForegroundReceipt(receipt, {
  targetWindowCorrelationRequired,
}) {
  if (
    receipt?.ok !== true
    || receipt.operation !== 'focus_window'
    || receipt.focusRequested !== true
    || receipt.browserIsForeground !== true
    || receipt.windowVisible !== true
    || !Number.isSafeInteger(receipt.processVisibleWindowCount)
    || receipt.processVisibleWindowCount < 1
    || receipt.windowMatchCount !== 1
    || receipt.targetWindowCorrelated !== targetWindowCorrelationRequired
    || !Number.isInteger(receipt.processId)
  ) {
    throw new Error('QA_OPERATOR_BROWSER_FOREGROUND_RECEIPT_INVALID');
  }
  requireQaWindowPresentationReceipt(receipt.presentation);
  return receipt;
}

function requireNavigationReceipt(receipt, targetId) {
  if (
    receipt?.status !== 'navigation_requested'
    || receipt.targetId !== targetId
    || !Number.isSafeInteger(receipt.windowId)
    || receipt.windowId <= 0
    || !receipt.windowBounds
    || !Number.isSafeInteger(receipt.windowBounds.left)
    || !Number.isSafeInteger(receipt.windowBounds.top)
    || !Number.isSafeInteger(receipt.windowBounds.width)
    || receipt.windowBounds.width <= 0
    || !Number.isSafeInteger(receipt.windowBounds.height)
    || receipt.windowBounds.height <= 0
    || !['normal', 'minimized', 'maximized', 'fullscreen'].includes(
      receipt.windowBounds.windowState,
    )
  ) {
    throw new Error('QA_OPERATOR_BROWSER_PAGE_NAVIGATION_RECEIPT_INVALID');
  }
  return receipt;
}

function requireTargetWindowReceipt(receipt) {
  const expectedKeys = ['status', 'targetId', 'windowBounds', 'windowId'];
  if (
    !receipt
    || typeof receipt !== 'object'
    || Array.isArray(receipt)
    || JSON.stringify(Object.keys(receipt).sort()) !== JSON.stringify(expectedKeys)
    || receipt.status !== 'target_window_verified'
    || typeof receipt.targetId !== 'string'
    || !receipt.targetId
    || receipt.targetId !== receipt.targetId.trim()
    || !Number.isSafeInteger(receipt.windowId)
    || receipt.windowId <= 0
    || !receipt.windowBounds
    || !Number.isSafeInteger(receipt.windowBounds.left)
    || !Number.isSafeInteger(receipt.windowBounds.top)
    || !Number.isSafeInteger(receipt.windowBounds.width)
    || receipt.windowBounds.width <= 0
    || !Number.isSafeInteger(receipt.windowBounds.height)
    || receipt.windowBounds.height <= 0
    || !['normal', 'minimized', 'maximized', 'fullscreen'].includes(
      receipt.windowBounds.windowState,
    )
  ) {
    throw new Error('QA_OPERATOR_BROWSER_TARGET_WINDOW_RECEIPT_INVALID');
  }
  return receipt;
}

function requireIdentityProcessId(identity) {
  const processId = identity?.proof?.pid;
  if (!Number.isSafeInteger(processId) || processId <= 0) {
    throw new Error('QA_OPERATOR_BROWSER_IDENTITY_PROCESS_REQUIRED');
  }
  return processId;
}

async function focusQaManagedBrowserTarget({
  browser,
  targetWindow,
  focusWindow = focusWindowsChromeWindow,
} = {}) {
  if (
    !browser
    || browser.processOwnership !== 'attach_only'
    || browser.lifecyclePolicy !== 'managed'
    || typeof browser.chrome !== 'string'
    || !browser.chrome
    || typeof browser.cdpEndpoint !== 'string'
    || !browser.cdpEndpoint
    || browser.browserIdentity?.status !== 'declared_identity_verified'
  ) {
    throw new Error('QA_OPERATOR_BROWSER_VERIFIED_MANAGED_BROWSER_REQUIRED');
  }
  if (typeof focusWindow !== 'function') {
    throw new Error('QA_OPERATOR_BROWSER_FOCUS_OWNER_REQUIRED');
  }
  const exactTargetWindow = requireTargetWindowReceipt(targetWindow);
  const identityProcessId = requireIdentityProcessId(browser.browserIdentity);
  const foreground = requireForegroundReceipt(
    await focusWindow({
      chromePath: browser.chrome,
      cdpEndpoint: browser.cdpEndpoint,
      expectedProcessId: identityProcessId,
      expectedWindowBounds: exactTargetWindow.windowBounds,
    }),
    { targetWindowCorrelationRequired: true },
  );
  if (identityProcessId !== foreground.processId) {
    throw new Error('QA_OPERATOR_BROWSER_FOREGROUND_PROCESS_MISMATCH');
  }
  return Object.freeze({
    contractVersion: 1,
    status: 'READY',
    targetId: exactTargetWindow.targetId,
    windowId: exactTargetWindow.windowId,
    processId: foreground.processId,
    browserIsForeground: true,
    windowVisible: true,
    processVisibleWindowCount: foreground.processVisibleWindowCount,
    windowMatchCount: foreground.windowMatchCount,
    targetWindowCorrelated: true,
    presentation: requireQaWindowPresentationReceipt(foreground.presentation),
  });
}

export async function focusQaManagedBrowserTargetForOperator(options) {
  return Object.freeze({ ...await focusQaManagedBrowserTarget(options), policy: 'operator_request_once' });
}

// Same exact PID/window correlation as operator handoff; authority and lifetime
// belong to the run's initial preparation lease, never to a protocol retry.
export async function focusQaManagedBrowserTargetForPreparation(options) {
  return Object.freeze({ ...await focusQaManagedBrowserTarget(options), policy: 'agent_present_once' });
}

// The upper run session owns this single-use preparation grant. The live child
// must belong to the neutral process owner and the same journaled run before a
// native window is touched; attached/managed admission remains separate above.
export async function focusQaOwnedBrowserTargetForPreparation({
  child,
  cdp,
  targetId,
  expectedOwnerTokenSha256,
  assertPreparationActive,
  presentationPolicy = 'windows_agent_present_once',
  readOwnedProcessReceipt = readQaOwnedChromiumProcessReceipt,
  verifyOwnedIdentity = verifyQaOwnedChromiumEndpointIdentity,
  readTargetWindow = readQaCdpPageTargetWindow,
  focusWindow = focusWindowsChromeWindow,
} = {}) {
  requireQaOwnedInitialWindowPresentationPolicy(presentationPolicy);
  if (typeof assertPreparationActive !== 'function') {
    throw new Error('QA_INITIAL_OWNED_WINDOW_PREPARATION_GUARD_REQUIRED');
  }
  assertPreparationActive();
  const launch = readOwnedProcessReceipt(child);
  if (launch?.processOwnership !== 'owned'
    || !/^[a-f0-9]{64}$/u.test(expectedOwnerTokenSha256 || '')
    || launch.ownerTokenSha256 !== expectedOwnerTokenSha256) {
    throw new Error('QA_INITIAL_OWNED_WINDOW_PROCESS_NOT_OWNED');
  }
  const identity = await verifyOwnedIdentity(child, cdp);
  assertPreparationActive();
  if (identity?.status !== 'owned_endpoint_identity_verified'
    || identity.proof?.ownerTokenSha256 !== expectedOwnerTokenSha256
    || !Number.isSafeInteger(identity.proof.pid) || identity.proof.pid <= 0
    || !Number.isSafeInteger(identity.remoteDebuggingPort)
    || identity.remoteDebuggingPort < 1024 || identity.remoteDebuggingPort > 65535) {
    throw new Error('QA_INITIAL_OWNED_WINDOW_IDENTITY_INVALID');
  }
  const targetWindow = requireTargetWindowReceipt(await readTargetWindow(cdp, targetId));
  assertPreparationActive();
  if (targetWindow.targetId !== targetId) {
    throw new Error('QA_INITIAL_OWNED_WINDOW_TARGET_MISMATCH');
  }
  const platform = inferBrowserQaPlatform(launch.executablePath);
  if (!isWindowsQaPlatform(platform)) {
    return Object.freeze({ contractVersion: 1, status: 'not_required',
      policy: presentationPolicy, reason: 'non_windows_presentation_contract',
      targetId, windowId: targetWindow.windowId, processId: identity.proof.pid,
      initialFocusRequested: false });
  }
  const foreground = requireForegroundReceipt(await focusWindow({
    chromePath: launch.executablePath,
    cdpEndpoint: `http://127.0.0.1:${identity.remoteDebuggingPort}`,
    expectedProcessId: identity.proof.pid,
    expectedWindowBounds: targetWindow.windowBounds,
  }), { targetWindowCorrelationRequired: true });
  if (foreground.processId !== identity.proof.pid) {
    throw new Error('QA_INITIAL_OWNED_WINDOW_FOREGROUND_PROCESS_MISMATCH');
  }
  return Object.freeze({ contractVersion: 1, status: 'READY',
    policy: presentationPolicy, targetId, windowId: targetWindow.windowId,
    processId: foreground.processId, initialFocusRequested: true,
    browserIsForeground: true, windowVisible: true, targetWindowCorrelated: true,
    presentation: requireQaWindowPresentationReceipt(foreground.presentation) });
}

// Observation has no presentation grant. CDP target-window correlation and the
// native driver's process MainWindow foreground result remain separate facts.
export async function observeQaOwnedBrowserWindows({
  child, cdp, targetTabs, expectedOwnerTokenSha256,
  readOwnedProcessReceipt = readQaOwnedChromiumProcessReceipt,
  verifyOwnedIdentity = verifyQaOwnedChromiumEndpointIdentity,
  readTargetWindow = readQaCdpPageTargetWindow,
  inspectForeground = inspectWindowsChromeForegroundState,
} = {}) {
  const launch = readOwnedProcessReceipt(child);
  if (launch?.processOwnership !== 'owned'
    || !/^[a-f0-9]{64}$/u.test(expectedOwnerTokenSha256 || '')
    || launch.ownerTokenSha256 !== expectedOwnerTokenSha256) {
    throw new Error('QA_OWNED_WINDOW_OBSERVATION_PROCESS_NOT_OWNED');
  }
  if (!Array.isArray(targetTabs) || targetTabs.length < 1
    || targetTabs.some(tab => !tab || typeof tab !== 'object' || Array.isArray(tab))
    || new Set(targetTabs.map(tab => tab.targetId)).size !== targetTabs.length
    || targetTabs.some(tab => typeof tab.targetId !== 'string' || !tab.targetId
      || tab.targetId !== tab.targetId.trim()
      || !Number.isSafeInteger(tab.tabId) || tab.tabId < 0
      || !Number.isSafeInteger(tab.windowId) || tab.windowId <= 0
      || !Number.isSafeInteger(tab.activeTabId) || tab.activeTabId < 0
      || typeof tab.active !== 'boolean'
      || tab.active !== (tab.tabId === tab.activeTabId))) {
    throw new Error('QA_OWNED_WINDOW_OBSERVATION_TABS_INVALID');
  }
  const identity = await verifyOwnedIdentity(child, cdp);
  if (identity?.status !== 'owned_endpoint_identity_verified'
    || identity.proof?.ownerTokenSha256 !== expectedOwnerTokenSha256
    || !Number.isSafeInteger(identity.proof.pid) || identity.proof.pid <= 0
    || !Number.isSafeInteger(identity.remoteDebuggingPort)
    || identity.remoteDebuggingPort < 1024 || identity.remoteDebuggingPort > 65535) {
    throw new Error('QA_OWNED_WINDOW_OBSERVATION_IDENTITY_INVALID');
  }
  const targets = await Promise.all(targetTabs.map(async tab => {
    const window = requireTargetWindowReceipt(await readTargetWindow(cdp, tab.targetId));
    if (window.targetId !== tab.targetId || window.windowId !== tab.windowId) {
      throw new Error('QA_OWNED_WINDOW_OBSERVATION_TARGET_WINDOW_MISMATCH');
    }
    return Object.freeze({ targetId: tab.targetId, tabId: tab.tabId, active: tab.active,
      activeTabId: tab.activeTabId, windowId: window.windowId,
      windowBounds: Object.freeze({ left: window.windowBounds.left, top: window.windowBounds.top,
        width: window.windowBounds.width, height: window.windowBounds.height,
        windowState: window.windowBounds.windowState }) });
  }));
  let nativeForeground;
  if (!isWindowsQaPlatform(inferBrowserQaPlatform(launch.executablePath))) {
    nativeForeground = { status: 'not_supported', reason: 'non_windows_observation_contract',
      scope: 'verified_process_main_window', targetWindowCorrelated: false };
  } else {
    const foreground = await inspectForeground({ chromePath: launch.executablePath,
      cdpEndpoint: `http://127.0.0.1:${identity.remoteDebuggingPort}`,
      expectedProcessId: identity.proof.pid });
    if (foreground?.ok !== true || foreground.operation !== 'inspect_foreground'
      || foreground.processId !== identity.proof.pid
      || typeof foreground.browserIsForeground !== 'boolean') {
      throw new Error('QA_OWNED_WINDOW_OBSERVATION_FOREGROUND_RECEIPT_INVALID');
    }
    nativeForeground = { status: 'observed', scope: 'verified_process_main_window',
      browserIsForeground: foreground.browserIsForeground, targetWindowCorrelated: false };
  }
  return Object.freeze({ contractVersion: 1, status: 'observed', processId: identity.proof.pid,
    targets: Object.freeze(targets), nativeForeground: Object.freeze(nativeForeground),
    focusRequested: false });
}

async function runQaManagedBrowserOperatorAction({
  rootDir,
  environment,
  browserResources,
  pageUrl = null,
  signal = null,
  startupTimeoutMs,
  fetchImpl = globalThis.fetch,
  lifecycleRunner = runQaManagedPersistentBrowserAction,
  brokerFactory = acquireBrowserBroker,
  capacityFactory = acquireBrowserCapacity,
  verifyDedicatedProfileOwnership = verifyEntropyQaDedicatedProfileOwnership,
  verifyIdentity = verifyQaPersistentBrowserIdentity,
  cdpFactory = (webSocketUrl) => new CdpConnection(webSocketUrl),
  listTargets = listQaCdpTargets,
  createTarget = createQaCdpPageTarget,
  navigateTarget = navigateQaCdpPageTarget,
  readTargetWindow = readQaCdpPageTargetWindow,
  closeTarget = closeQaCdpTarget,
  focusWindow = focusWindowsChromeWindow,
} = {}) {
  const profileSlot = requireManagedWindowsEnvironment(
    environment,
    browserResources,
  );
  const lifecycle = await lifecycleRunner({
    rootDir,
    environment,
    browserResources,
    action: 'ensure',
    signal,
    ...(startupTimeoutMs === undefined ? {} : { startupTimeoutMs }),
  });
  const ownerId = `browser-operator-open:${environment.id}:pid=${process.pid}`;
  const broker = await brokerFactory({ rootDir, environment, ownerId });
  let capacity = null;
  let cdp = null;
  let createdTarget = null;
  let navigationReceipt = null;
  let primaryError = null;
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
      throw new Error('QA_OPERATOR_BROWSER_CAPACITY_LEASE_INVALID');
    }
    await broker.updateRuntime({
      status: 'operator_window',
      profileSlotId: profileSlot.id,
      nextAction: 'focus_operator_window',
    });
    const ownership = await verifyDedicatedProfileOwnership({
      profileSlot,
      action: 'open',
    });
    projectBrowserQaDedicatedProfileOwnership(profileSlot, ownership);
    const identity = await verifyIdentity({
      rootDir,
      profileSlot,
      capacityLease: capacity,
    });
    if (identity?.status !== 'declared_identity_verified') {
      throw new Error('QA_OPERATOR_BROWSER_IDENTITY_UNVERIFIED');
    }
    const identityProcessId = requireIdentityProcessId(identity);
    const probe = await probePersistentBrowserCdp(profileSlot.cdpEndpoint, {
      fetchImpl,
    });
    if (
      probe.status !== 'ready'
      || typeof probe.webSocketDebuggerUrl !== 'string'
      || !probe.webSocketDebuggerUrl
      || typeof probe.browserEpoch !== 'string'
      || !probe.browserEpoch
    ) {
      throw new Error('QA_OPERATOR_BROWSER_CDP_UNAVAILABLE');
    }
    cdp = cdpFactory(probe.webSocketDebuggerUrl);
    await cdp.open();
    const baselineTargets = await listTargets(cdp);
    const baselinePages = baselineTargets.filter((target) => target?.type === 'page');
    if (pageUrl !== null || baselinePages.length === 0) {
      createdTarget = await createTarget(cdp, {
        url: 'about:blank',
        background: pageUrl !== null,
        recoverAmbiguousCreation: true,
        ownerPurpose: OPERATOR_WINDOW_OWNER_PURPOSE,
        browserEpoch: probe.browserEpoch,
      });
    }
    if (pageUrl !== null) {
      navigationReceipt = requireNavigationReceipt(
        await navigateTarget(cdp, createdTarget, pageUrl),
        createdTarget.targetId,
      );
    }
    if (createdTarget) {
      const preFocusTargets = await listTargets(cdp);
      if (!preFocusTargets.some((target) => (
        target?.targetId === createdTarget.targetId
        && target?.type === 'page'
      ))) {
        throw new Error('QA_OPERATOR_BROWSER_PRE_FOCUS_TARGET_REQUIRED');
      }
    }
    const focusTargetId = createdTarget ? createdTarget.targetId : baselinePages[0]?.targetId;
    if (!focusTargetId) throw new Error('QA_OPERATOR_BROWSER_PRE_FOCUS_TARGET_REQUIRED');
    const focusTargetWindow = navigationReceipt === null
      ? requireTargetWindowReceipt(await readTargetWindow(cdp, focusTargetId))
      : { status: 'target_window_verified', targetId: createdTarget.targetId,
        windowId: navigationReceipt.windowId, windowBounds: navigationReceipt.windowBounds };
    if (focusTargetWindow.targetId !== focusTargetId) {
      throw new Error('QA_OPERATOR_BROWSER_PRE_FOCUS_TARGET_MISMATCH');
    }
    const foreground = await focusQaManagedBrowserTargetForOperator({
        browser: {
          processOwnership: environment.processOwnership,
          lifecyclePolicy: environment.lifecyclePolicy,
          chrome: profileSlot.installation.executable,
          cdpEndpoint: profileSlot.cdpEndpoint,
          browserIdentity: identity,
        },
        targetWindow: focusTargetWindow,
        focusWindow,
      });
    if (identityProcessId !== foreground.processId) {
      throw new Error('QA_OPERATOR_BROWSER_FOREGROUND_PROCESS_MISMATCH');
    }
    const finalTargets = await listTargets(cdp);
    const finalPageCount = finalTargets.filter((target) => target?.type === 'page').length;
    if (finalPageCount < 1) {
      throw new Error('QA_OPERATOR_BROWSER_VISIBLE_PAGE_REQUIRED');
    }
    if (
      createdTarget
      && !finalTargets.some((target) => (
        target?.targetId === createdTarget.targetId
        && target?.type === 'page'
      ))
    ) {
      throw new Error('QA_OPERATOR_BROWSER_HANDOFF_TARGET_REQUIRED');
    }
    return Object.freeze({
      contractVersion: 1,
      status: 'READY',
      profileSlotId: profileSlot.id,
      environmentId: environment.id,
      lifecycleAction: lifecycle.lifecycleAction,
      windowAction: pageUrl !== null
        ? 'page_created_and_focused'
        : createdTarget
          ? 'created_and_focused'
          : 'focused_existing',
      pageAction: pageUrl !== null
        ? 'requested_url_navigation_requested'
        : createdTarget
          ? 'blank_page_created'
          : 'existing_page_preserved',
      operatorHandoff: true,
      targetId: createdTarget?.targetId || null,
      pageCount: finalPageCount,
      focus: Object.freeze({
        policy: 'operator_request_once',
        processId: foreground.processId,
        browserIsForeground: true,
        windowVisible: true,
        processVisibleWindowCount: foreground.processVisibleWindowCount,
        windowMatchCount: foreground.windowMatchCount,
        targetWindowCorrelated: foreground.targetWindowCorrelated,
        presentation: requireQaWindowPresentationReceipt(foreground.presentation),
      }),
    });
  } catch (error) {
    let failure = error;
    if (createdTarget?.targetId && cdp) {
      try {
        await closeTarget(cdp, createdTarget.targetId);
      } catch (cleanupError) {
        failure = new AggregateError(
          [...flattenErrors(error), ...flattenErrors(cleanupError)],
          'QA_OPERATOR_BROWSER_OPEN_AND_TARGET_CLEANUP_FAILED',
          { cause: error },
        );
      }
    }
    primaryError = failure;
    throw failure;
  } finally {
    cdp?.close();
    const resources = [broker, ...(capacity ? [capacity] : [])];
    try {
      await releaseReverse(
        resources,
        'QA_OPERATOR_BROWSER_LEASE_RELEASE_INCOMPLETE',
      );
    } catch (releaseError) {
      if (primaryError) {
        throw new AggregateError(
          [...flattenErrors(primaryError), ...flattenErrors(releaseError)],
          'QA_OPERATOR_BROWSER_OPEN_AND_RELEASE_FAILED',
          { cause: primaryError },
        );
      }
      throw releaseError;
    }
  }
}

export function openQaManagedBrowserWindow(options = {}) {
  return runQaManagedBrowserOperatorAction(options);
}

export function openQaManagedBrowserPage({
  url = 'about:blank',
  ...options
} = {}) {
  return runQaManagedBrowserOperatorAction({
    ...options,
    pageUrl: requireOperatorPageUrl(url),
  });
}
