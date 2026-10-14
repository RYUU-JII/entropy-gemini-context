import {
  closeQaCdpTarget,
  createQaCdpPageTarget,
  listQaCdpTargets,
  readQaCdpPageTargetWindow,
} from '../../browser-qa/browser/cdpTargetOwner.mjs';
import { CdpConnection } from '../../browser-qa/cdp/CdpConnection.mjs';
import {
  QaBrowserTargetLease,
  resolveQaBrowserEpoch,
} from '../../browser-qa/resources/BrowserTargetLease.mjs';
import {
  isWindowsChromeExecutable,
  normalizeChromiumHarnessCdpEndpoint,
} from '../../e2e/extensionChromiumHarness.mjs';
import {
  inspectWindowsChromeForegroundState,
  minimizeWindowsChromeWindow,
} from '../drivers/windowsChromeToolbarDriver.mjs';
import { focusQaManagedBrowserTargetForPreparation } from '../browser/qaOperatorBrowserWindow.mjs';

const ANCHOR_PURPOSE = 'initial_window_focus_anchor';

function requireFunction(value, code) {
  if (typeof value !== 'function') throw new Error(code);
  return value;
}

function requireRecoveryJournal(journal) {
  for (const method of [
    'recordBrowser',
    'reserveTarget',
    'admitTarget',
    'releaseTarget',
  ]) {
    requireFunction(
      journal?.[method],
      `QA_INITIAL_WINDOW_FOCUS_ANCHOR_RECOVERY_OWNER_REQUIRED:${method}`,
    );
  }
  return journal;
}

async function readBrowserVersion(cdpEndpoint, {
  fetchImpl = globalThis.fetch,
  timeoutMs = 2_000,
} = {}) {
  requireFunction(fetchImpl, 'QA_INITIAL_WINDOW_FOCUS_ANCHOR_FETCH_REQUIRED');
  const endpoint = normalizeChromiumHarnessCdpEndpoint(cdpEndpoint);
  const response = await fetchImpl(new URL('/json/version', endpoint), {
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (!response?.ok) {
    throw new Error('QA_INITIAL_WINDOW_FOCUS_ANCHOR_CDP_VERSION_UNAVAILABLE');
  }
  const version = await response.json();
  if (
    typeof version?.Browser !== 'string'
    || !version.Browser
    || typeof version.webSocketDebuggerUrl !== 'string'
    || !version.webSocketDebuggerUrl
  ) {
    throw new Error('QA_INITIAL_WINDOW_FOCUS_ANCHOR_CDP_VERSION_INVALID');
  }
  return Object.freeze(version);
}

export class QaInitialWindowFocusAnchorLease {
  constructor({
    ownerId,
    browser,
    recoveryJournal,
    fetchImpl = globalThis.fetch,
    cdpFactory = (webSocketUrl) => new CdpConnection(webSocketUrl),
    createTarget = createQaCdpPageTarget,
    listTargets = listQaCdpTargets,
    closeTarget = closeQaCdpTarget,
    minimizeWindow = minimizeWindowsChromeWindow,
    inspectForeground = inspectWindowsChromeForegroundState,
    presentWindow = false,
    expectedBrowserEpoch = null,
    readTargetWindow = readQaCdpPageTargetWindow,
    focusTargetWindow = focusQaManagedBrowserTargetForPreparation,
  } = {}) {
    if (typeof ownerId !== 'string' || !ownerId.trim()) {
      throw new Error('QA_INITIAL_WINDOW_FOCUS_ANCHOR_OWNER_REQUIRED');
    }
    if (
      browser?.processOwnership !== 'attach_only'
      || browser.initialWindowFocusOnceAllowed !== true
      || (!presentWindow && browser.baselinePageTargetCount !== 0)
      || typeof browser.cdpEndpoint !== 'string'
      || !browser.cdpEndpoint
    ) {
      throw new Error('QA_INITIAL_WINDOW_FOCUS_ANCHOR_ADMISSION_INVALID');
    }
    if (typeof presentWindow !== 'boolean'
      || (presentWindow && (browser.lifecyclePolicy !== 'managed'
        || browser.browserIdentity?.status !== 'declared_identity_verified'))) {
      throw new Error('QA_INITIAL_WINDOW_PRESENTATION_MANAGED_IDENTITY_REQUIRED');
    }
    if (!isWindowsChromeExecutable(browser.chrome)) {
      throw new Error('QA_INITIAL_WINDOW_FOCUS_ANCHOR_WINDOWS_CHROME_REQUIRED');
    }
    this.ownerId = ownerId;
    this.presentWindow = presentWindow;
    if (expectedBrowserEpoch !== null
      && (typeof expectedBrowserEpoch !== 'string' || !expectedBrowserEpoch.trim())) {
      throw new Error('QA_INITIAL_WINDOW_FOCUS_ANCHOR_EXPECTED_EPOCH_INVALID');
    }
    this.expectedBrowserEpoch = expectedBrowserEpoch;
    this.readTargetWindow = requireFunction(readTargetWindow, 'QA_INITIAL_WINDOW_TARGET_WINDOW_OWNER_REQUIRED');
    this.focusTargetWindow = requireFunction(focusTargetWindow, 'QA_INITIAL_WINDOW_FOCUS_OWNER_REQUIRED');
    this.acquireAttempted = false;
    this.browser = browser;
    this.recoveryJournal = requireRecoveryJournal(recoveryJournal);
    this.fetchImpl = fetchImpl;
    this.cdpFactory = requireFunction(
      cdpFactory,
      'QA_INITIAL_WINDOW_FOCUS_ANCHOR_CDP_FACTORY_REQUIRED',
    );
    this.createTarget = requireFunction(
      createTarget,
      'QA_INITIAL_WINDOW_FOCUS_ANCHOR_TARGET_CREATOR_REQUIRED',
    );
    this.listTargets = requireFunction(
      listTargets,
      'QA_INITIAL_WINDOW_FOCUS_ANCHOR_TARGET_LIST_OWNER_REQUIRED',
    );
    this.closeTarget = requireFunction(
      closeTarget,
      'QA_INITIAL_WINDOW_FOCUS_ANCHOR_TARGET_CLOSE_OWNER_REQUIRED',
    );
    this.minimizeWindow = requireFunction(
      minimizeWindow,
      'QA_INITIAL_WINDOW_FOCUS_ANCHOR_MINIMIZE_OWNER_REQUIRED',
    );
    this.inspectForeground = requireFunction(
      inspectForeground,
      'QA_INITIAL_WINDOW_FOCUS_ANCHOR_FOREGROUND_OBSERVER_REQUIRED',
    );
    this.cdp = null;
    this.targetLease = null;
    this.reservation = null;
    this.targetId = null;
  }

  async acquire() {
    if (this.acquireAttempted) {
      throw new Error('QA_INITIAL_WINDOW_FOCUS_ANCHOR_ALREADY_ACQUIRED');
    }
    this.acquireAttempted = true;
    const version = await readBrowserVersion(this.browser.cdpEndpoint, {
      fetchImpl: this.fetchImpl,
    });
    const browserEpoch = resolveQaBrowserEpoch(version);
    if (this.expectedBrowserEpoch !== null && browserEpoch !== this.expectedBrowserEpoch) {
      throw new Error('QA_INITIAL_WINDOW_STARTED_PROCESS_EPOCH_CHANGED');
    }
    await this.recoveryJournal.recordBrowser({
      processOwnership: 'attach_only',
      browserEpoch,
      cdpEndpoint: this.browser.cdpEndpoint,
      executable: this.browser.chrome,
      userDataDir: this.browser.profile,
      profileDirectory: this.browser.profileDirectory,
      profileSlotId: this.browser.profileSlotId || null,
    });
    this.targetLease = new QaBrowserTargetLease({
      browserEpoch,
      ownerId: this.ownerId,
    });
    this.cdp = this.cdpFactory(version.webSocketDebuggerUrl);
    await this.cdp.open();

    try {
      const baselineTargets = await this.listTargets(this.cdp);
      if (!this.presentWindow && baselineTargets.some((target) => target?.type === 'page')) {
        throw new Error('QA_INITIAL_WINDOW_FOCUS_ANCHOR_BASELINE_CHANGED');
      }
      const target = await this.createTarget(this.cdp, {
        url: 'about:blank',
        background: !this.presentWindow,
        recoverAmbiguousCreation: true,
        ownerPurpose: ANCHOR_PURPOSE,
        browserEpoch,
        onOwnershipPrepared: async ({ ownershipUrl }) => {
          this.reservation = await this.recoveryJournal.reserveTarget({
            browserEpoch,
            purpose: ANCHOR_PURPOSE,
            initialUrl: ownershipUrl,
          });
        },
      });
      if (!this.reservation) {
        throw new Error('QA_INITIAL_WINDOW_FOCUS_ANCHOR_RESERVATION_REQUIRED');
      }
      this.targetId = target.targetId;
      this.targetLease.register({
        targetId: target.targetId,
        purpose: ANCHOR_PURPOSE,
        initialUrl: target.initialUrl,
      });
      await this.recoveryJournal.admitTarget({
        reservationId: this.reservation.reservationId,
        targetId: target.targetId,
        proofKind: 'exact_initial_url',
        initialUrl: target.initialUrl,
      });

      if (this.presentWindow) {
        const targetWindow = await this.readTargetWindow(this.cdp, this.targetId);
        if (targetWindow?.targetId !== this.targetId) {
          throw new Error('QA_INITIAL_WINDOW_PRESENTATION_TARGET_MISMATCH');
        }
        const presentation = await this.focusTargetWindow({ browser: this.browser, targetWindow });
        if (presentation?.policy !== 'agent_present_once' || presentation.status !== 'READY'
          || presentation.targetId !== this.targetId || presentation.windowId !== targetWindow.windowId
          || presentation.browserIsForeground !== true || presentation.windowVisible !== true) {
          throw new Error('QA_INITIAL_WINDOW_PRESENTATION_RECEIPT_INVALID');
        }
        return Object.freeze({ status: 'ready', purpose: ANCHOR_PURPOSE,
          initialForegroundSideEffectAllowed: true, initialFocusRequested: true,
          minimized: false, browserIsForeground: true, presentation });
      }
      const minimizeReceipt = await this.minimizeWindow({
        chromePath: this.browser.chrome,
        cdpEndpoint: this.browser.cdpEndpoint,
      });
      if (
        minimizeReceipt?.minimized !== true
        || minimizeReceipt.browserIsForeground !== false
        || minimizeReceipt.focusRequested !== false
        || !Number.isInteger(minimizeReceipt.minimizeRequestCount)
        || minimizeReceipt.minimizeRequestCount < 1
      ) {
        throw new Error('QA_INITIAL_WINDOW_FOCUS_ANCHOR_MINIMIZE_RECEIPT_INVALID');
      }
      const foregroundReceipt = await this.inspectForeground({
        chromePath: this.browser.chrome,
        cdpEndpoint: this.browser.cdpEndpoint,
      });
      if (foregroundReceipt?.browserIsForeground !== false) {
        throw new Error('QA_INITIAL_WINDOW_FOCUS_ANCHOR_FOCUS_RELEASE_UNVERIFIED');
      }
      return Object.freeze({
        status: 'ready',
        purpose: ANCHOR_PURPOSE,
        initialForegroundSideEffectAllowed: true,
        initialFocusRequested: false,
        minimized: true,
        browserIsForeground: false,
        focusRequestedByMinimize: false,
        minimizeRequestCount: minimizeReceipt.minimizeRequestCount,
      });
    } catch (error) {
      const cleanupErrors = [];
      try {
        await this.release();
      } catch (cleanupError) {
        cleanupErrors.push(cleanupError);
      }
      if (cleanupErrors.length > 0) {
        throw new AggregateError(
          [error, ...cleanupErrors],
          'QA_INITIAL_WINDOW_FOCUS_ANCHOR_ACQUIRE_AND_CLEANUP_FAILED',
        );
      }
      throw error;
    }
  }

  async release() {
    let targetReceipt = null;
    try {
      if (this.targetId && this.targetLease?.owns(this.targetId)) {
        targetReceipt = await this.targetLease.release(this.targetId, {
          closeTarget: (targetId) => this.closeTarget(this.cdp, targetId),
        });
        await this.recoveryJournal.releaseTarget({
          targetId: this.targetId,
          status: targetReceipt.status,
        });
        this.targetId = null;
      }
      return Object.freeze({
        resource: 'initial_window_focus_anchor',
        status: targetReceipt?.status || 'not_acquired',
        browserProcessAction: 'external_process_preserved',
      });
    } finally {
      this.cdp?.close();
      this.cdp = null;
    }
  }
}
