import {
  isWindowsChromeExecutable,
} from '../../e2e/extensionChromiumHarness.mjs';
import {
  inspectWindowsChromeForegroundState,
} from '../drivers/windowsChromeToolbarDriver.mjs';

function requireStage(value) {
  if (typeof value !== 'string' || !/^[a-z][a-z0-9_]{1,63}$/u.test(value)) {
    throw new Error('QA_ATTACHED_BROWSER_OS_FOCUS_STAGE_INVALID');
  }
  return value;
}

function requireForegroundReceipt(receipt, stage) {
  if (
    receipt?.operation !== 'inspect_foreground'
    || typeof receipt.browserIsForeground !== 'boolean'
  ) {
    const error = new Error('QA_ATTACHED_BROWSER_OS_FOCUS_EVIDENCE_INVALID');
    error.code = 'QA_ATTACHED_BROWSER_OS_FOCUS_EVIDENCE_INVALID';
    error.stage = stage;
    throw error;
  }
  return receipt;
}

export class QaAttachedBrowserOsFocusGuard {
  constructor({
    browser,
    inspectForeground = inspectWindowsChromeForegroundState,
    nativeObservation = false,
  } = {}) {
    if (
      browser?.processOwnership !== 'attach_only'
      || browser.osFocus !== 'never'
      || typeof browser.chrome !== 'string'
      || typeof browser.cdpEndpoint !== 'string'
    ) {
      throw new Error('QA_ATTACHED_BROWSER_OS_FOCUS_GUARD_ADMISSION_INVALID');
    }
    if (typeof inspectForeground !== 'function') {
      throw new Error('QA_ATTACHED_BROWSER_OS_FOCUS_OBSERVER_REQUIRED');
    }
    this.browser = browser;
    if (typeof nativeObservation !== 'boolean') throw new Error('QA_OS_FOCUS_OBSERVATION_INVALID');
    this.nativeObservation = nativeObservation;
    this.inspectForeground = inspectForeground;
    this.applicable = isWindowsChromeExecutable(browser.chrome);
    this.baselineObserved = false;
  }

  async observeBaseline(stage = 'before_automation') {
    const normalizedStage = requireStage(stage);
    if (this.baselineObserved) {
      throw new Error('QA_ATTACHED_BROWSER_OS_FOCUS_BASELINE_DUPLICATE');
    }
    this.baselineObserved = true;
    if (!this.applicable) {
      return Object.freeze({
        applicable: false,
        browserIsForeground: null,
        preserved: null,
        stage: normalizedStage,
      });
    }
    const receipt = requireForegroundReceipt(
      await this.inspectForeground({
        chromePath: this.browser.chrome,
        cdpEndpoint: this.browser.cdpEndpoint,
      }),
      normalizedStage,
    );
    if (this.nativeObservation) {
      return Object.freeze({ applicable: true, browserIsForeground: receipt.browserIsForeground,
        preserved: null, stage: normalizedStage, policy: 'native_observation',
        evidenceRole: 'window_state_only_no_focus_action' });
    }
    if (receipt.browserIsForeground) {
      const error = new Error('QA_BROWSER_OS_FOCUS_BASELINE_FOREGROUND');
      error.code = 'QA_BROWSER_OS_FOCUS_BASELINE_FOREGROUND';
      error.stage = normalizedStage;
      throw error;
    }
    return Object.freeze({
      applicable: true,
      browserIsForeground: false,
      preserved: true,
      stage: normalizedStage,
    });
  }

  async assertPreserved(stage) {
    const normalizedStage = requireStage(stage);
    if (!this.baselineObserved) {
      throw new Error('QA_ATTACHED_BROWSER_OS_FOCUS_BASELINE_REQUIRED');
    }
    if (!this.applicable) {
      return Object.freeze({
        applicable: false,
        browserIsForeground: null,
        preserved: null,
        stage: normalizedStage,
      });
    }
    const receipt = requireForegroundReceipt(
      await this.inspectForeground({
        chromePath: this.browser.chrome,
        cdpEndpoint: this.browser.cdpEndpoint,
      }),
      normalizedStage,
    );
    if (this.nativeObservation) {
      return Object.freeze({ applicable: true, browserIsForeground: receipt.browserIsForeground,
        preserved: null, stage: normalizedStage, policy: 'native_observation',
        evidenceRole: 'window_state_only_no_focus_action' });
    }
    if (receipt.browserIsForeground) {
      const error = new Error('QA_BROWSER_OS_FOCUS_CONTRACT_VIOLATION');
      error.code = 'QA_BROWSER_OS_FOCUS_CONTRACT_VIOLATION';
      error.stage = normalizedStage;
      throw error;
    }
    return Object.freeze({
      applicable: true,
      browserIsForeground: false,
      preserved: true,
      stage: normalizedStage,
    });
  }
}
