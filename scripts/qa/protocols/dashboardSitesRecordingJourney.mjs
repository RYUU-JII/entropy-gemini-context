import { MESSAGE_ACTIONS } from '../../../src/platform/messaging/messageTypes.js';
import { requireSitesSiteDetailQueryResult } from '../../../src/domains/stats/contracts/sitesSiteDetailContracts.js';
import { requireSitesRecordingPolicy } from '../../../src/domains/stats/contracts/sitesRecordingContracts.js';
import { requireSiteLongTermPatterns } from '../../../src/domains/stats/contracts/siteLongTermPatternContract.js';
import { requireSiteTodayNotes } from '../../../src/domains/stats/contracts/siteTodayNotesContract.js';
import { buildSiteIntelCaptureFixture } from '../../../src/apps/dashboard/qa/siteIntelCaptureFixtures.dev.js';
import { inspectZenDaySlip, inspectZenNotebookAccess, requireZenLedgerHour } from './dashboardSitesIntelJourney.mjs';
import { evaluate, sleep } from '../../e2e/extensionChromiumHarness.mjs';

const DOMAIN = 'youtube.com';
const OBSERVATION_MS = 65_000;
// A just-opened dashboard still has a valid 15-second background snapshot.
// Exercise invalidation after it ages, instead of demanding a cache bypass.
const INVALIDATION_DELAY_MS = 20_000;

export function requireSitesRecordingScenario({ scenario, surface, resizeTo }) {
  if (scenario === 'none') return false;
  if (['intel-reading', 'observed-reading-refresh'].includes(scenario) && surface === 'sites' && resizeTo === undefined) return false;
  if (scenario !== 'recording-refresh' || surface !== 'sites' || resizeTo !== undefined) {
    throw new Error('QA_SITES_RECORDING_SCENARIO_INVALID');
  }
  return true;
}

function requireResponse(response, operation) {
  if (response?.success !== true) {
    const error = new Error(`QA_SITES_${operation}_FAILED`);
    error.diagnostic = response;
    throw error;
  }
  return response;
}

async function commitSettings(send, items) {
  const response = requireResponse(await send({ action: MESSAGE_ACTIONS.SET_SETTINGS, items }), 'SETTINGS');
  for (const [key, value] of Object.entries(items)) {
    if (JSON.stringify(response.committedItems?.[key]) !== JSON.stringify(value)) {
      throw new Error(`QA_SITES_SETTINGS_ACK_MISMATCH:${key}`);
    }
  }
}

export async function prepareSitesRecordingJourney(send) {
  await commitSettings(send, {
    globalGoal: 120, dataCollectionMode: 'all_sites_minimal', insightsConsent: 'all_sites',
    trackingExcludedUrls: [],
  });
}

async function readSnapshot(send) {
  const response = requireResponse(await send({ action: MESSAGE_ACTIONS.GET_SITES_SNAPSHOT }), 'SNAPSHOT');
  requireSitesRecordingPolicy(response.sitesSnapshot?.recording);
  return response.sitesSnapshot;
}

async function readDetail(send, snapshot, domain = DOMAIN) {
  return requireSitesSiteDetailQueryResult(requireResponse(await send({
    action: MESSAGE_ACTIONS.GET_SITES_SITE_DETAIL,
    domain, siteDetailRevision: snapshot.siteDetailRevision,
  }), 'DETAIL')).sitesSiteDetail;
}

export function requireInactiveSitesRuntimeCap(response) {
  requireResponse(response, 'RUNTIME_SNAPSHOT');
  const snapshot = response.snapshot;
  const runtime = snapshot?.runtime;
  if (snapshot?.scope?.host !== DOMAIN || runtime?.available !== true
      || runtime.strategy?.declaredTargetMinutes !== 0
      || runtime.strategy?.effectiveTargetMinutes !== 0
      || runtime.strategy?.metrics?.budgetPressure !== 0
      || runtime.plan?.trace?.budgetRatio !== 0) {
    const error = new Error('QA_SITES_RUNTIME_CAP_ADMISSION_FAILED');
    error.diagnostic = response;
    throw error;
  }
  return snapshot;
}

async function readInactiveRuntimeCap(send) {
  return requireInactiveSitesRuntimeCap(await send({
    action: MESSAGE_ACTIONS.REFRESH_PROTECTION_RUNTIME_SNAPSHOT, hostname: DOMAIN,
  }));
}

export function installSitesCapFocusTrace(selector) {
  if (window.__ENTROPY_SITES_CAP_FOCUS_QA__) throw new Error('QA_SITES_CAP_FOCUS_PROBE_ALREADY_INSTALLED');
  const startedAt = performance.now();
  const timeline = [];
  let dropped = 0;
  let previousState = '';
  const describe = element => element ? { tag: element.tagName, id: element.id, className: element.getAttribute('class') } : null;
  const ancestors = target => {
    const result = [];
    for (let element = target; element && result.length < 24; element = element.parentElement) {
      const style = getComputedStyle(element);
      result.push({ ...describe(element), inert: element.inert, inertAttribute: element.getAttribute('inert'),
        hidden: element.hidden, hiddenAttribute: element.getAttribute('hidden'),
        disabledFieldset: element.tagName === 'FIELDSET' ? element.disabled : null,
        display: style.display, visibility: style.visibility, contentVisibility: style.contentVisibility });
    }
    return result;
  };
  const record = (reason, event = null) => {
    const owner = document.querySelector(selector);
    const target = owner?.querySelector('.sites-cap-inline-editor input[type="number"]');
    const state = {
      activeElement: describe(document.activeElement), targetPresent: Boolean(target),
      targetConnected: target?.isConnected, targetDisabled: target?.disabled,
      targetMatchesDisabled: target?.matches(':disabled'), targetAncestors: ancestors(target),
      capAdmission: owner?.dataset.capAdmission,
      sitesSnapshotAdmission: document.querySelector('#sites-tab')?.dataset.sitesSnapshotAdmission,
    };
    const key = JSON.stringify(state);
    if (reason === 'state' && key === previousState) return;
    previousState = key;
    if (timeline.length === 64) { dropped += 1; return; }
    timeline.push({ elapsedMs: performance.now() - startedAt, reason, ...state,
      ...(event ? { eventTarget: describe(event.target), relatedTarget: describe(event.relatedTarget) } : {}) });
  };
  const originalFocus = HTMLElement.prototype.focus;
  const trackedInputSelector = selector + ' .sites-cap-inline-editor input[type="number"]';
  function observedFocus(...args) {
    const tracked = this instanceof HTMLElement && this.matches(trackedInputSelector);
    if (tracked) record('focus-call', { target: this, relatedTarget: document.activeElement });
    try {
      const result = Reflect.apply(originalFocus, this, args);
      if (tracked) record('focus-return', { target: this, relatedTarget: document.activeElement });
      return result;
    } catch (error) {
      if (tracked) record('focus-throw', { target: this, relatedTarget: document.activeElement });
      throw error;
    }
  }
  HTMLElement.prototype.focus = observedFocus;
  const onFocus = event => record(event.type, event);
  document.addEventListener('focusin', onFocus, true);
  document.addEventListener('focusout', onFocus, true);
  const observer = new MutationObserver(() => record('state'));
  observer.observe(document.querySelector('#root'), { subtree: true, childList: true,
    attributes: true, attributeFilter: ['disabled', 'inert', 'hidden', 'data-cap-admission', 'data-sites-snapshot-admission'] });
  record('start');
  window.__ENTROPY_SITES_CAP_FOCUS_QA__ = {
    stop() {
      record('stop'); observer.disconnect();
      document.removeEventListener('focusin', onFocus, true);
      document.removeEventListener('focusout', onFocus, true);
      if (HTMLElement.prototype.focus !== observedFocus) throw new Error('QA_SITES_CAP_FOCUS_PROBE_OWNER_CHANGED');
      HTMLElement.prototype.focus = originalFocus;
      return { selector, elapsedMs: performance.now() - startedAt, dropped, timeline };
    },
  };
  return true;
}

export function stopSitesCapFocusTrace() {
  const probe = window.__ENTROPY_SITES_CAP_FOCUS_QA__;
  if (!probe) throw new Error('QA_SITES_CAP_FOCUS_PROBE_REQUIRED');
  const trace = probe.stop();
  delete window.__ENTROPY_SITES_CAP_FOCUS_QA__;
  return trace;
}

export function inspectSitesDomWait(targetSelector = null) {
  const describe = element => {
    if (!element) return null;
    const rect = element.getBoundingClientRect();
    const style = getComputedStyle(element);
    return {
      tag: element.tagName, id: element.id, className: element.getAttribute('class'),
      outerHTML: element.outerHTML.slice(0, 2048), connected: element.isConnected,
      disabled: typeof element.disabled === 'boolean' ? element.disabled : null,
      visibility: style.visibility, display: style.display, opacity: style.opacity,
      hasClientRects: element.getClientRects().length > 0,
      rect: { x: rect.x, y: rect.y, width: rect.width, height: rect.height },
    };
  };
  const target = targetSelector === null ? null : document.querySelector(targetSelector);
  return {
    visibilityState: document.visibilityState, documentHasFocus: document.hasFocus(),
    activeElement: describe(document.activeElement), targetSelector,
    targetCount: targetSelector === null ? null : document.querySelectorAll(targetSelector).length,
    target: describe(target), targetIsActive: target !== null && target === document.activeElement,
    capAdmission: target?.closest('[data-cap-admission]')?.dataset.capAdmission,
    sitesSnapshotAdmission: document.querySelector('#sites-tab')?.dataset.sitesSnapshotAdmission,
  };
}

async function waitForDom(harness, page, condition, signal, targetSelector = null) {
  const deadline = Date.now() + 30_000;
  while (Date.now() < deadline) {
    signal?.throwIfAborted();
    if (await evaluate(harness.cdp, page.sessionId, `Boolean(${condition})`)) return;
    await sleep(150);
  }
  const error = new Error(`QA_SITES_DOM_TIMEOUT:${condition}`);
  try {
    error.diagnostic = { condition, ...await evaluate(harness.cdp, page.sessionId,
      `(${inspectSitesDomWait.toString()})(${JSON.stringify(targetSelector)})`) };
  } catch (diagnosticError) {
    error.diagnostic = { condition, targetSelector,
      diagnosticCollectionError: { name: diagnosticError.name, message: diagnosticError.message } };
  }
  throw error;
}

async function openCap(harness, page, selector, signal) {
  // The Zen global cap belongs to root management, not the domain sheet.
  if (selector === '[data-sites-hud]') {
    const returnDomain = await evaluate(harness.cdp, page.sessionId, `(() => {
      const owner = document.querySelector('[data-sites-hud]');
      const workspace = document.querySelector('.sites-sites-workspace');
      if (owner?.dataset.capPresentation !== 'workspace' || workspace.dataset.mode !== 'notebook') return null;
      if (window.__ENTROPY_SITES_CAP_RETURN_DOMAIN__ !== undefined) throw Error('QA_SITES_CAP_RETURN_ALREADY_OWNED');
      const domain = document.querySelector('.sites-notebook-heading h2').textContent.trim();
      window.__ENTROPY_SITES_CAP_RETURN_DOMAIN__ = domain; return domain;
    })()`);
    if (returnDomain !== null) {
      for (let index = 0; index < 4; index++) {
        const returned = await evaluate(harness.cdp, page.sessionId, `(() => {
          if (document.querySelector('.sites-sites-workspace').dataset.mode === 'ledger') return true;
          const back = document.querySelector('[data-workspace-action="back"]');
          if (!back) throw Error('QA_SITES_CAP_ROOT_BACK_REQUIRED'); back.click(); return false;
        })()`);
        if (returned) break;
        await evaluate(harness.cdp, page.sessionId, 'new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))');
      }
      await waitForDom(harness, page, "document.querySelector('.sites-sites-workspace').dataset.mode === 'ledger'", signal);
    }
    await evaluate(harness.cdp, page.sessionId, `(() => {
      const trigger = document.querySelector('[data-sites-global-cap-trigger]');
      const menu = trigger?.closest('details'); if (menu) menu.open = true;
    })()`);
  }
  await evaluate(harness.cdp, page.sessionId, `(() => {
    const menu = document.querySelector(${JSON.stringify(selector)})?.closest('.zen-record-management');
    if (menu && !menu.open) menu.querySelector('summary').click();
  })()`);
  const trigger = `(() => {
    const owner = document.querySelector(${JSON.stringify(selector)});
    if (owner?.dataset.capPresentation === 'workspace') {
      return [...document.querySelectorAll('[data-sites-global-cap-trigger]')].find(node => node.getClientRects().length);
    }
    return owner?.querySelector('.sites-cap-readout__value');
  })()`;
  await waitForDom(harness, page, trigger, signal);
  await evaluate(harness.cdp, page.sessionId, `(() => { const button = ${trigger}; button.scrollIntoView({ block: 'nearest', behavior: 'instant' }); button.click(); })()`);
  await waitForDom(harness, page, `document.querySelector(${JSON.stringify(selector + ' .sites-cap-inline-editor input[type="number"]')})?.getClientRects().length`, signal);
}

async function closeCap(harness, page, selector) {
  await evaluate(harness.cdp, page.sessionId, `document.querySelector(${JSON.stringify(selector + ' .sites-cap-inline-editor button[type="button"]')}).click()`);
  if (selector === '[data-sites-hud]') {
    await evaluate(harness.cdp, page.sessionId, `(async () => {
      const domain = window.__ENTROPY_SITES_CAP_RETURN_DOMAIN__;
      if (domain === undefined) return;
      delete window.__ENTROPY_SITES_CAP_RETURN_DOMAIN__;
      const row = [...document.querySelectorAll('button[aria-controls="sites-site-detail"]')].find(node => node.title === domain);
      if (!row?.getClientRects().length) throw Error('QA_SITES_CAP_RETURN_ROW_REQUIRED');
      row.click(); await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    })()`);
  }
}

export function inspectSitesCapEditing(selector) {
  const owner = document.querySelector(selector);
  const form = owner?.querySelector('.sites-cap-inline-editor');
  const input = form?.querySelector('input[type="number"]');
  const boundedCanvas = document.documentElement.dataset.theme === 'zen';
  const fullyVisible = node => {
    if (!node?.getClientRects().length || node.closest('[hidden], [inert]')) return false;
    const rect = node.getBoundingClientRect();
    if (rect.left < -1 || rect.top < -1 || rect.right > innerWidth + 1 || rect.bottom > innerHeight + 1) return false;
    for (let owner = node.parentElement; owner; owner = owner.parentElement) {
      const css = getComputedStyle(owner), r = owner.getBoundingClientRect();
      if ((['auto', 'scroll', 'hidden', 'clip'].includes(css.overflowX)
          && (rect.left < r.left + owner.clientLeft - 1 || rect.right > r.left + owner.clientLeft + owner.clientWidth + 1))
        || (['auto', 'scroll', 'hidden', 'clip'].includes(css.overflowY)
          && (rect.top < r.top + owner.clientTop - 1 || rect.bottom > r.top + owner.clientTop + owner.clientHeight + 1))) return false;
    }
    return true;
  };
  return { present: Boolean(form && input && input.getClientRects().length), inline: Boolean(form && owner.contains(form)),
    disabled: input?.disabled, value: input?.value,
    applyDisabled: form?.querySelector('button[type="submit"]')?.disabled,
    cancelAvailable: Boolean(form?.querySelector('button[type="button"]:not(:disabled)')),
    boundedCanvas, completeEditor: Boolean(form && [form, input, ...form.querySelectorAll('button')].every(fullyVisible)),
    noSlider: !form?.querySelector('input[type="range"]'),
    noDialog: !form?.closest('[role="dialog"], [aria-modal="true"]') };
}

export function requireSitesCapEditing(state, disabled) {
  if (!state.present || !state.inline || state.disabled !== disabled
    || (disabled && !state.applyDisabled) || !state.cancelAvailable || !state.noSlider || !state.noDialog) {
    const error = new Error('QA_SITES_CAP_EDITING_MISMATCH'); error.diagnostic = { disabled, state }; throw error;
  }
  if (state.boundedCanvas === true && state.completeEditor !== true) {
    const error = new Error('QA_SITES_CAP_EDITOR_CLIPPED'); error.diagnostic = state; throw error;
  }
  return state;
}

async function assertCapEditing(harness, page, selector, disabled, signal) {
  await openCap(harness, page, selector, signal);
  const state = await evaluate(harness.cdp, page.sessionId, `(${inspectSitesCapEditing.toString()})(${JSON.stringify(selector)})`);
  await closeCap(harness, page, selector);
  return requireSitesCapEditing(state, disabled);
}

export function inspectSitesReadingIntent() {
  const panel = document.querySelector('#sites-site-detail');
  if (!panel) return null;
  const visible = node => Boolean(node?.getClientRects().length
    && !node.closest('[hidden], [inert], [aria-hidden="true"]'));
  if (panel.dataset.variant !== 'zen') {
    const reading = panel.querySelector('[data-intel-page]');
    return { kind: 'analytical', ready: visible(reading),
      intent: { page: reading ? reading.dataset.intelPage : null } };
  }
  const reading = panel.querySelector('.zen-site-ledger');
  const viewport = reading?.querySelector('.zen-site-ledger__viewport[data-view]');
  const owner = document.querySelector('#sites-tab');
  const bounded = Boolean(owner && viewport && owner.scrollHeight <= owner.clientHeight + 1
    && owner.scrollWidth <= owner.clientWidth + 1 && Math.abs(owner.scrollTop) <= 1
    && viewport.scrollHeight <= viewport.clientHeight + 1 && viewport.scrollWidth <= viewport.clientWidth + 1);
  return { kind: 'zen-ledger',
    ready: visible(viewport) && bounded && Boolean(viewport.textContent.trim())
      && ['annotations', 'evidence', 'slip', 'basis'].includes(viewport.dataset.view),
    intent: {
      view: viewport ? viewport.dataset.view : null,
      annotation: viewport?.dataset.focusKind ? { kind: viewport.dataset.focusKind, id: viewport.dataset.focusId } : null,
      selectedDate: viewport?.dataset.selectedDate ? viewport.dataset.selectedDate : null,
      returnView: viewport?.dataset.returnView ? viewport.dataset.returnView : null,
      basisPageIndex: viewport ? Number(viewport.dataset.basisPageIndex) : null,
      dayView: viewport?.dataset.dayView ? viewport.dataset.dayView : null,
      selectedHour: viewport ? Number(viewport.dataset.selectedHour) : null,
      dayAnchor: viewport?.dataset.dayAnchor ? viewport.dataset.dayAnchor : null,
      fieldAnchor: viewport?.dataset.fieldAnchor ? viewport.dataset.fieldAnchor : null,
      annotationAnchor: viewport?.dataset.annotationAnchor ? viewport.dataset.annotationAnchor : null,
    } };
}

export function requireSitesReadingDay(detail) {
  const intel = detail?.intel;
  if (detail?.mode !== 'analysis' || detail.domain !== DOMAIN || typeof intel?.todayObserved !== 'boolean'
    || typeof intel.todayNotes?.dateStr !== 'string' || !/^\d{4}-\d{2}-\d{2}$/u.test(intel.todayNotes.dateStr)
    || intel.todayNotes.status !== (intel.todayObserved ? 'observed' : 'missing')) {
    throw new Error('QA_SITES_READING_DAY_OBSERVATION_INVALID');
  }
  return { kind: intel.todayObserved ? 'observed-hourly' : 'unobserved-summary',
    observed: intel.todayObserved, dateStr: intel.todayNotes.dateStr, selectedHour: intel.todayObserved ? 17 : null };
}

export function requireSitesObservedReadingFixture(intel) {
  requireSiteLongTermPatterns(intel?.longTermPatterns);
  requireSiteTodayNotes(intel?.todayNotes);
  const selection = requireSitesReadingDay({ mode: 'analysis', domain: DOMAIN, intel });
  if (intel?.domain !== DOMAIN || intel.captureFixtureId !== 'mixed' || !selection.observed
    || !Array.isArray(intel.todayHourly) || intel.todayHourly.length !== 24
    || intel.todayHourly.some(value => typeof value !== 'number' || !Number.isFinite(value) || value < 0)
    || typeof intel.todayTotal !== 'number' || !Number.isFinite(intel.todayTotal)
    || Math.abs(intel.todayHourly.reduce((sum, value) => sum + value, 0) - intel.todayTotal) > 1
    || intel.todayHourly[12] <= 0) throw new Error('QA_SITES_OBSERVED_READING_SOURCE_INVALID');
  return { ...selection, selectedHour: 12, source: 'producer-source-fixture', fixtureId: 'mixed' };
}

export function inspectSitesReadingDay() {
  const slip = document.querySelector('#sites-site-detail .zen-site-ledger-slip');
  const range = slip?.querySelector('[data-ledger-hour-select]');
  const result = slip?.querySelector('[data-selected-hour]');
  return { visible: Boolean(slip?.getClientRects().length && !slip.closest('[hidden], [inert], [aria-hidden="true"]')),
    dateStr: slip?.dataset.date, dayView: slip?.dataset.dayView,
    durationText: slip?.querySelector('.zen-site-ledger-slip__duration')?.textContent.trim(),
    missingText: slip?.querySelector('.zen-site-ledger-slip__sentence')?.textContent.trim(),
    detailActionCount: slip?.querySelectorAll('[data-day-action]:not(:disabled):not([data-day-action="summary"])').length,
    rangeCount: slip?.querySelectorAll('[data-ledger-hour-select]').length,
    hourCellCount: slip?.querySelectorAll('[data-hour]').length,
    resultCount: slip?.querySelectorAll('[data-selected-hour]').length,
    metricCount: slip?.querySelectorAll('.zen-site-ledger-slip__metrics dd, .zen-site-ledger-slip__summary-facts, .zen-site-ledger-slip__context-fact').length,
    hour: range ? Number(range.value) : null, valueText: range?.getAttribute('aria-valuetext'),
    resultHour: result ? Number(result.dataset.selectedHour) : null, resultText: result?.textContent.trim() };
}

export function requireUnobservedSitesReadingDay(day, selection) {
  if (selection?.kind !== 'unobserved-summary' || selection.observed !== false
    || !day.visible || day.dateStr !== selection.dateStr || day.dayView !== 'summary'
    || !day.durationText || /[0-9]/u.test(day.durationText) || !day.missingText
    || ['detailActionCount', 'rangeCount', 'hourCellCount', 'resultCount', 'metricCount'].some(key => day[key] !== 0)) {
    const error = new Error('QA_SITES_UNOBSERVED_READING_DAY_INVALID'); error.diagnostic = { selection, day }; throw error;
  }
  return day;
}

async function selectSitesReadingIntent({ harness, page, signal, zen, readingDay }) {
  if (zen) {
    await waitForDom(harness, page,
      "document.querySelector('#sites-site-detail .zen-site-ledger__viewport[data-view=\"slip\"]') && document.querySelector('#sites-site-detail [data-ledger-action=\"history\"]')", signal);
    await evaluate(harness.cdp, page.sessionId, "document.querySelector('#sites-site-detail [data-ledger-action=\"history\"]').click()");
    for (let index = 0; index < 40; index++) {
      const selected = await evaluate(harness.cdp, page.sessionId, `(() => {
        const reading = document.querySelector('#sites-site-detail .zen-site-ledger');
        const today = [...reading.querySelectorAll('.zen-record-dates button[data-date]')].find(node => node.dataset.date === ${JSON.stringify(readingDay.dateStr)} && !node.closest('[inert], [aria-hidden="true"]'));
        if (today) { today.click(); return true; }
        const next = reading.querySelector('.zen-record-dates [data-ledger-action="next-page"]');
        if (!next || next.disabled) throw Error('QA_SITES_READING_TODAY_UNREACHABLE'); next.click(); return false;
      })()`);
      await evaluate(harness.cdp, page.sessionId, 'new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))');
      if (selected) break;
      if (index === 39) throw Error('QA_SITES_READING_PAGE_LIMIT');
    }
    await waitForDom(harness, page,
      "document.querySelector('#sites-site-detail .zen-site-ledger__viewport[data-view=\"slip\"] .zen-site-ledger-slip[data-date]')?.getClientRects().length", signal);
    if (!readingDay.observed) {
      requireUnobservedSitesReadingDay(await evaluate(harness.cdp, page.sessionId,
        `(${inspectSitesReadingDay.toString()})()`), readingDay);
    } else {
      for (let index = 0; index < 12; index += 1) {
        const opened = await evaluate(harness.cdp, page.sessionId, `(() => {
          const slip = document.querySelector('#sites-site-detail .zen-site-ledger-slip');
          const hours = [...slip.querySelectorAll('[data-day-action="hours"]')]
            .find(node => node.getClientRects().length && !node.closest('[hidden], [inert], [aria-hidden="true"]'));
          if (hours) { hours.click(); return true; }
          const next = slip.querySelector('[data-ledger-action="next-page"]');
          if (!next || next.disabled) throw new Error('QA_SITES_READING_HOURS_UNREACHABLE');
          next.click(); return false;
        })()`);
        await evaluate(harness.cdp, page.sessionId, 'new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))');
        if (opened) break;
        if (index === 11) throw new Error('QA_SITES_READING_DAY_PAGE_LIMIT');
      }
      await waitForDom(harness, page,
        "document.querySelector('#sites-site-detail [data-day-view=\"hours\"] [data-ledger-hour-select]')?.getClientRects().length", signal);
      await evaluate(harness.cdp, page.sessionId,
        "document.querySelector('#sites-site-detail [data-ledger-hour-select]').focus({preventScroll:true})");
      for (const [key, code] of [['End', 35], ...Array.from({ length: 23 - readingDay.selectedHour }, () => ['ArrowLeft', 37])]) {
        for (const type of ['keyDown', 'keyUp']) await harness.cdp.send('Input.dispatchKeyEvent', {
          type, key, code: key, windowsVirtualKeyCode: code,
        }, page.sessionId);
      }
      await waitForDom(harness, page,
        `document.querySelector('#sites-site-detail [data-ledger-hour-select]')?.value === '${readingDay.selectedHour}'`, signal);
    }
    await evaluate(harness.cdp, page.sessionId, 'document.querySelector(\'#sites-site-detail [data-ledger-action="basis"]\').click()');
    await waitForDom(harness, page,
      "document.querySelector('#sites-site-detail .zen-site-ledger__viewport[data-view=\"basis\"]')?.getClientRects().length", signal);
  } else {
    await waitForDom(harness, page,
      "document.querySelectorAll('#sites-site-detail [data-intel-state] [role=\"tab\"]')[1]?.getClientRects().length", signal);
    await evaluate(harness.cdp, page.sessionId,
      'document.querySelectorAll(\'#sites-site-detail [data-intel-state] [role="tab"]\')[1].click()');
    await waitForDom(harness, page,
      "document.querySelector('#sites-site-detail [data-intel-page=\"evidence\"]')?.getClientRects().length", signal);
  }
  const reading = await evaluate(harness.cdp, page.sessionId, `(${inspectSitesReadingIntent.toString()})()`);
  if (!reading?.ready || (zen && (!reading.intent.selectedDate
    || reading.intent.view !== 'basis' || reading.intent.returnView !== 'slip'
    || reading.intent.selectedDate !== readingDay.dateStr || !reading.intent.dayAnchor
    || (readingDay.observed ? reading.intent.dayView !== 'hours' || reading.intent.selectedHour !== readingDay.selectedHour
      : reading.intent.dayView !== 'summary')))
    || (!zen && reading.intent.page !== 'evidence')) {
    const error = new Error('QA_SITES_READING_INTENT_NOT_SELECTED'); error.diagnostic = reading; throw error;
  }
  return reading;
}

export function installSitesReadingContinuityProbe(readReading) {
  if (window.__ENTROPY_SITES_READING_QA__) throw new Error('QA_SITES_READING_PROBE_ALREADY_INSTALLED');
  const owner = document.querySelector('#sites-tab');
  const workspace = owner?.querySelector('.sites-sites-workspace');
  const reading = readReading();
  if (!owner || !workspace || !reading?.ready) throw new Error('QA_SITES_READING_REQUIRED');
  const zen = reading.kind === 'zen-ledger';
  if (zen) {
    if (owner.scrollHeight > owner.clientHeight + 1 || Math.abs(owner.scrollTop) > 1) throw new Error('QA_SITES_BOUNDED_READING_REQUIRED');
  } else {
    if (owner.scrollHeight - owner.clientHeight < 120) throw new Error('QA_SITES_LONG_READING_REQUIRED');
    owner.scrollTop = Math.min(320, (owner.scrollHeight - owner.clientHeight) / 2);
  }
  const initial = { scrollTop: owner.scrollTop, scrollHeight: owner.scrollHeight,
    clientWidth: owner.clientWidth, computedAt: Number(owner.dataset.sitesSnapshotComputedAt), reading };
  if ((!zen && initial.scrollTop < 60) || !Number.isFinite(initial.computedAt) || initial.computedAt <= 0) {
    throw new Error('QA_SITES_READING_INITIAL_POSITION_INVALID');
  }
  const startedAt = performance.now(), failures = [], transitions = [];
  let previousAdmission = null, pendingSeen = false, minimumScrollTop = initial.scrollTop;
  const check = () => {
    const admission = owner.dataset.sitesSnapshotAdmission;
    const pending = admission !== 'ready';
    const failed = [];
    if (admission !== previousAdmission) {
      transitions.push({ admission, elapsedMs: performance.now() - startedAt,
        scrollTop: owner.scrollTop, scrollHeight: owner.scrollHeight });
      previousAdmission = admission;
    }
    if (pending) {
      pendingSeen = true;
      if (owner.querySelector('#sites-site-detail, .zen-ledger')) failed.push('withdrawn-business-reading-retained');
    }
    minimumScrollTop = Math.min(minimumScrollTop, owner.scrollTop);
    if (!owner.isConnected || document.querySelector('#sites-tab') !== owner
      || !workspace.isConnected || owner.querySelector('.sites-sites-workspace') !== workspace) failed.push('reading-owner-replaced');
    if (Math.abs(owner.scrollTop - initial.scrollTop) > 1) failed.push('reading-position-lost');
    if (zen && owner.scrollHeight > owner.clientHeight + 1) failed.push('reading-vertical-overflow');
    if (Math.abs(owner.clientWidth - initial.clientWidth) > 1 || owner.scrollWidth > owner.clientWidth + 1) failed.push('reading-width-or-overflow-changed');
    if (owner.querySelector('[role="alert"]')) failed.push('reading-query-alert');
    if (failed.length && failures.length < 20) failures.push({ elapsedMs: performance.now() - startedAt, admission,
      scrollTop: owner.scrollTop, scrollHeight: owner.scrollHeight, failed });
  };
  const observer = new MutationObserver(check);
  observer.observe(owner, { subtree: true, childList: true, attributes: true });
  const timer = setInterval(check, 50);
  check();
  window.__ENTROPY_SITES_READING_QA__ = { stop() {
    check(); observer.disconnect(); clearInterval(timer);
    return { initial, pendingSeen, minimumScrollTop, transitions, failures,
      elapsedMs: performance.now() - startedAt, final: { admission: owner.dataset.sitesSnapshotAdmission,
        scrollTop: owner.scrollTop, scrollHeight: owner.scrollHeight, clientWidth: owner.clientWidth,
        computedAt: Number(owner.dataset.sitesSnapshotComputedAt),
        reading: readReading() } };
  } };
  return initial;
}

export function requireSitesReadingContinuity(state, zen) {
  const before = state.initial.reading;
  const after = state.final.reading;
  const expectedKind = zen ? 'zen-ledger' : 'analytical';
  const selection = state.selection;
  const zenDayValid = selection?.observed === true && selection.kind === 'observed-hourly'
    ? before?.intent?.dayView === 'hours' && Number.isInteger(selection.selectedHour)
      && selection.selectedHour >= 0 && selection.selectedHour <= 23 && before.intent.selectedHour === selection.selectedHour
    : selection?.observed === false && selection.kind === 'unobserved-summary'
      && selection.selectedHour === null && before?.intent?.dayView === 'summary';
  const selectionValid = zen
    ? Boolean(before?.intent?.selectedDate && before.intent.view === 'basis' && before.intent.returnView === 'slip'
      && Number.isSafeInteger(before.intent.basisPageIndex) && before.intent.basisPageIndex >= 0
      && zenDayValid && before.intent.selectedDate === selection.dateStr && Number.isSafeInteger(before.intent.selectedHour)
      && before.intent.selectedHour >= 0 && before.intent.selectedHour <= 23 && before.intent.dayAnchor && before.intent.fieldAnchor)
    : before?.intent?.page === 'evidence';
  if (!state.pendingSeen || state.failures.length || state.final.admission !== 'ready'
    || !Number.isFinite(state.final.computedAt) || state.final.computedAt <= state.initial.computedAt
    || before?.kind !== expectedKind || after?.kind !== expectedKind
    || !before.ready || !after.ready || !selectionValid
    || JSON.stringify(after.intent) !== JSON.stringify(before.intent)) {
    const error = new Error('QA_SITES_READING_REFRESH_CONTINUITY_FAILED');
    error.diagnostic = state; throw error;
  }
  return state;
}

async function observeVisibleReadingRefresh({ harness, page, send, signal, evidence, zen, selectedReading, readingDay }) {
  // Let the same canonical background cache age before another invalidation.
  // Query withdrawal and newer admission are real. The caller's explicit
  // selection receipt distinguishes canonical data from producer-source fixtures.
  const startedAt = Date.now();
  while (Date.now() - startedAt < INVALIDATION_DELAY_MS) {
    signal?.throwIfAborted();
    await sleep(Math.min(1000, INVALIDATION_DELAY_MS - (Date.now() - startedAt)));
  }
  await waitForDom(harness, page,
    `document.querySelector('#sites-tab')?.dataset.sitesSnapshotAdmission === 'ready' && document.querySelector('.sites-sites-workspace')?.dataset.contentPending !== 'true' && (${inspectSitesReadingIntent.toString()})()?.ready`, signal);
  const restoredReading = await evaluate(harness.cdp, page.sessionId, `(${inspectSitesReadingIntent.toString()})()`);
  if (JSON.stringify(restoredReading) !== JSON.stringify(selectedReading)) {
    const error = new Error('QA_SITES_READING_RETURN_INTENT_LOST');
    error.diagnostic = { selectedReading, restoredReading }; throw error;
  }
  const initial = await evaluate(harness.cdp, page.sessionId,
    `(${installSitesReadingContinuityProbe.toString()})(${inspectSitesReadingIntent.toString()})`);
  let continuity;
  try {
    await evaluate(harness.cdp, page.sessionId, 'new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))');
    // A reset-hour ACK schedules a later activity boundary and need not change
    // today's query identity. A changed saved cap immediately changes policy.
    await commitSettings(send, { globalGoal: 121 });
    await waitForDom(harness, page,
      `document.querySelector('#sites-tab')?.dataset.sitesSnapshotAdmission === 'ready' && document.querySelector('.sites-sites-workspace')?.dataset.contentPending !== 'true' && Number(document.querySelector('#sites-tab')?.dataset.sitesSnapshotComputedAt) > ${initial.computedAt} && (${inspectSitesReadingIntent.toString()})()?.ready`, signal);
    // Cross a paint boundary so native scroll clamping, if any, is observable.
    await evaluate(harness.cdp, page.sessionId, 'new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))');
  } finally {
    continuity = await evaluate(harness.cdp, page.sessionId, `(() => {
      const result = window.__ENTROPY_SITES_READING_QA__.stop();
      delete window.__ENTROPY_SITES_READING_QA__; return result;
    })()`);
    continuity.selection = readingDay;
    await evidence.event('QA_SITES_READING_REFRESH_CONTINUITY_OBSERVED', continuity);
  }
  return requireSitesReadingContinuity(continuity, zen);
}

async function returnSitesReadingDay({ harness, page, signal, selectedReading, readingDay }) {
  await evaluate(harness.cdp, page.sessionId, `(() => {
    const back = [...document.querySelectorAll('#sites-site-detail [data-ledger-action="back"]')]
      .find(node => node.getClientRects().length && !node.closest('[hidden], [inert], [aria-hidden="true"]'));
    if (!back) throw new Error('QA_SITES_READING_BACK_UNREACHABLE'); back.click();
  })()`);
  await waitForDom(harness, page,
    "document.querySelector('#sites-site-detail .zen-site-ledger__viewport[data-view=\"slip\"] .zen-site-ledger-slip')?.getClientRects().length", signal);
  await evaluate(harness.cdp, page.sessionId, 'new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))');
  const dayReturn = await evaluate(harness.cdp, page.sessionId, `(() => {
    const reading = (${inspectSitesReadingIntent.toString()})();
    return { reading, ...(${inspectSitesReadingDay.toString()})() };
  })()`);
  const before = selectedReading.intent, after = dayReturn.reading?.intent;
  if (!readingDay.observed) requireUnobservedSitesReadingDay(dayReturn, readingDay);
  if (!dayReturn.reading?.ready || after?.view !== 'slip' || after.dayView !== before.dayView
    || after.selectedDate !== before.selectedDate || after.selectedHour !== before.selectedHour || after.dayAnchor !== before.dayAnchor
    || JSON.stringify(after.annotation) !== JSON.stringify(before.annotation)
    || after.fieldAnchor !== before.fieldAnchor || after.annotationAnchor !== before.annotationAnchor
    || (readingDay.observed && (dayReturn.hour !== readingDay.selectedHour || dayReturn.resultHour !== readingDay.selectedHour
      || !dayReturn.valueText || !dayReturn.resultText))) {
    const error = new Error('QA_SITES_READING_DAY_RETURN_FAILED'); error.diagnostic = { selection: readingDay, dayReturn }; throw error;
  }
  return { ...dayReturn, selection: readingDay };
}

export async function runDashboardSitesObservedReadingRefreshJourney({ harness, page, send, signal, evidence, capture, resizeReading }) {
  if (typeof capture !== 'function') throw new Error('QA_SITES_OBSERVED_READING_CAPTURE_OWNER_REQUIRED');
  if (typeof resizeReading !== 'function') throw new Error('QA_SITES_OBSERVED_READING_RESIZE_OWNER_REQUIRED');
  const initial = await readSnapshot(send);
  if (initial.recording.effectiveScope !== 'all_sites') throw new Error('QA_SITES_INITIAL_SCOPE_INVALID');
  const fixture = buildSiteIntelCaptureFixture('mixed', DOMAIN);
  const readingDay = requireSitesObservedReadingFixture(fixture);
  const canonicalDay = requireSitesReadingDay(await readDetail(send, initial));
  const selectedRow = `Array.from(document.querySelectorAll('button[aria-controls="sites-site-detail"]')).find(button => button.textContent.includes('${DOMAIN}'))`;
  await waitForDom(harness, page, selectedRow, signal);
  await evaluate(harness.cdp, page.sessionId, `${selectedRow}.click()`);
  await waitForDom(harness, page,
    "document.querySelector('#sites-site-detail[data-variant=\"zen\"] [data-intel-capture-case=\"mixed\"]')?.getClientRects().length", signal);
  const selectedReading = await selectSitesReadingIntent({ harness, page, signal, zen: true, readingDay });
  const inspectAccess = async phase => {
    const access = await evaluate(harness.cdp, page.sessionId, `(${inspectZenNotebookAccess.toString()})()`);
    if (!access || access.mode !== 'notebook' || !access.accessible) {
      const error = new Error('QA_SITES_OBSERVED_READING_NOT_ACCESSIBLE:' + phase); error.diagnostic = access; throw error;
    }
    return access;
  };
  const inspectHour = async () => {
    const day = requireZenLedgerHour(await evaluate(harness.cdp, page.sessionId,
      `(${inspectZenDaySlip.toString()})()`), readingDay.selectedHour, fixture.todayHourly[readingDay.selectedHour]);
    if (day.date !== readingDay.dateStr || !day.range.focused
      || JSON.stringify(day.focus) !== JSON.stringify(selectedReading.intent.annotation)) {
      const error = new Error('QA_SITES_OBSERVED_READING_HOUR_CONTEXT_LOST'); error.diagnostic = day; throw error;
    }
    return day;
  };
  const beforeReturn = await returnSitesReadingDay({ harness, page, signal, selectedReading, readingDay });
  const before = { returned: beforeReturn, hour: await inspectHour(), access: await inspectAccess('before') };
  await capture('before');
  const resized = [];
  for (const viewportName of ['desktop-low', 'portrait-narrow', 'initial']) {
    const receipt = await resizeReading(viewportName);
    await evaluate(harness.cdp, page.sessionId, 'new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))');
    const current = await evaluate(harness.cdp, page.sessionId, `(${inspectSitesReadingIntent.toString()})()`);
    if (!current?.ready || JSON.stringify(current.intent) !== JSON.stringify(before.returned.reading.intent)) {
      const error = new Error('QA_SITES_READING_RESIZE_INTENT_LOST'); error.diagnostic = { viewportName, current, before }; throw error;
    }
    resized.push({ viewportName, receipt, hour: await inspectHour(), access: await inspectAccess('resized-' + viewportName) });
  }
  await evaluate(harness.cdp, page.sessionId, 'document.querySelector(\'#sites-site-detail [data-ledger-action="basis"]\').click()');
  await waitForDom(harness, page,
    "document.querySelector('#sites-site-detail .zen-site-ledger__viewport[data-view=\"basis\"]')?.getClientRects().length", signal);
  const basisAccess = await inspectAccess('basis');
  await evidence.event('QA_SITES_OBSERVED_READING_SOURCE_DECLARED', {
    selection: readingDay, canonicalDay, source: 'existing mixed source observations through buildRuleSiteIntel and strict contracts',
    actualSettingsQuery: true, storedStatsSeeded: false, collectionCertified: false,
  });
  const continuity = await observeVisibleReadingRefresh({ harness, page, send, signal, evidence,
    zen: true, selectedReading, readingDay });
  const afterReturn = await returnSitesReadingDay({ harness, page, signal, selectedReading, readingDay });
  const after = { returned: afterReturn, hour: await inspectHour(), access: await inspectAccess('after') };
  if (after.hour.context !== before.hour.context || JSON.stringify(after.hour.hours) !== JSON.stringify(before.hour.hours)
    || ['left', 'top', 'width', 'height'].some(key => Math.abs(after.access.body.rect[key] - before.access.body.rect[key]) > 1)) {
    const error = new Error('QA_SITES_OBSERVED_READING_RETURN_CHANGED'); error.diagnostic = { before, after }; throw error;
  }
  await capture('after');
  return { schemaVersion: 1, selection: readingDay, canonicalDay, before, resized, basisAccess, continuity, after,
    source: 'existing fixed mixed source observations projected by the production read-model producer/contracts',
    refresh: 'real acknowledged saved-cap policy invalidation, withdrawal and newer admitted query snapshot',
    storedStatsSeeded: false, collectionCertified: false,
    limitation: 'This run proves observed UI reading intent across real query admission/remount. Displayed observations are a source fixture, not stored user records or collection evidence.' };
}

export async function runDashboardSitesRecordingJourney({ harness, page, send, signal, evidence, capture }) {
  if (typeof capture !== 'function') throw new Error('QA_SITES_RECORDING_CAPTURE_OWNER_REQUIRED');
  const initial = await readSnapshot(send);
  if (initial.recording.effectiveScope !== 'all_sites') throw new Error('QA_SITES_INITIAL_SCOPE_INVALID');
  const selectedRow = `Array.from(document.querySelectorAll('button[aria-controls="sites-site-detail"]')).find(button => button.textContent.includes('${DOMAIN}'))`;
  await waitForDom(harness, page, selectedRow, signal);
  await evaluate(harness.cdp, page.sessionId, `${selectedRow}.click()`);
  await waitForDom(harness, page, "document.querySelector('#sites-site-detail') && document.querySelector('[data-site-cap][data-domain=\"youtube.com\"]')", signal);
  const zen = await evaluate(harness.cdp, page.sessionId, "document.querySelector('#sites-site-detail').dataset.variant === 'zen'");
  const readingDay = zen ? requireSitesReadingDay(await readDetail(send, initial)) : null;
  const selectedReading = await selectSitesReadingIntent({ harness, page, signal, zen, readingDay });
  if (zen) await evidence.event('QA_SITES_READING_DAY_SELECTED', { selection: readingDay, reading: selectedReading });
  await evaluate(harness.cdp, page.sessionId, `(${installSitesCapFocusTrace.toString()})('[data-sites-hud]')`);
  let capFocusError = null;
  try {
    await openCap(harness, page, '[data-sites-hud]', signal);
    await waitForDom(harness, page, "document.activeElement === document.querySelector('[data-sites-hud] .sites-cap-inline-editor input[type=\"number\"]')", signal,
      '[data-sites-hud] .sites-cap-inline-editor input[type="number"]');
  } catch (error) {
    capFocusError = error;
    throw error;
  } finally {
    try {
      const capFocusTrace = await evaluate(harness.cdp, page.sessionId, `(${stopSitesCapFocusTrace.toString()})()`);
      if (capFocusError) capFocusError.diagnostic = { ...capFocusError.diagnostic, capFocusTrace };
      await evidence.event('QA_SITES_CAP_FOCUS_OBSERVED', capFocusTrace);
    } catch (traceError) {
      if (!capFocusError) throw traceError;
      capFocusError.diagnostic = { ...capFocusError.diagnostic,
        capFocusTraceError: { name: traceError.name, message: traceError.message } };
    }
  }
  await evaluate(harness.cdp, page.sessionId, `(() => {
    const input = document.querySelector('[data-sites-hud] .sites-cap-inline-editor input[type="number"]');
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
    setter.call(input, '121');
    input.dispatchEvent(new Event('input', { bubbles: true }));
    document.querySelector('.sites-cap-editor__details summary').click();
    input.focus({ preventScroll: true });
  })()`);
  await waitForDom(harness, page, "document.querySelector('[data-sites-hud]').dataset.editing === 'true'", signal);
  await capture('global-cap');
  const probeInstalled = await evaluate(harness.cdp, page.sessionId, `(() => {
    if (window.__ENTROPY_SITES_RECORDING_QA__) throw new Error('QA_SITES_PROBE_ALREADY_INSTALLED');
    const workspace = document.querySelector('.sites-sites-workspace');
    const readReading = (${inspectSitesReadingIntent.toString()});
    const selectedReading = ${JSON.stringify(selectedReading)};
    const input = document.querySelector('[data-sites-hud] .sites-cap-inline-editor input[type="number"]');
    const utility = document.querySelector('#zen-sites-global-cap');
    const dedicated = document.querySelector('[data-sites-hud]').dataset.capPresentation === 'workspace';
    const initialRect = workspace.getBoundingClientRect();
    const initialComputedAt = Number(document.querySelector('#sites-tab').dataset.sitesSnapshotComputedAt);
    if (!Number.isFinite(initialComputedAt) || initialComputedAt <= 0) throw new Error('QA_SITES_SNAPSHOT_DIAGNOSTICS_REQUIRED');
    const failures = [];
    const check = () => {
      const current = workspace.getBoundingClientRect();
      const failed = [];
      if (!workspace.isConnected || document.querySelector('.sites-sites-workspace') !== workspace) failed.push('workspace-replaced');
      if (dedicated) {
        if (!utility?.isConnected || !utility.contains(input) || !input.getClientRects().length) failed.push('utility-editor-lost');
      } else {
        const admitted = document.querySelector('#sites-tab')?.dataset.sitesSnapshotAdmission === 'ready';
        const currentDetail = document.querySelector('#sites-site-detail');
        if (admitted && workspace.dataset.contentPending !== 'true') {
          const reading = readReading();
          if (!reading?.ready || JSON.stringify(reading.intent) !== JSON.stringify(selectedReading.intent)) {
            failed.push('reading-intent-lost');
          }
        }
        if (!admitted && currentDetail) failed.push('withdrawn-reading-retained');
      }
      if (!input.isConnected || document.activeElement !== input || input.value !== '121') failed.push('draft-or-focus-lost');
      if (document.querySelector('#sites-tab [role="alert"]')) failed.push('query-alert');
      if (Math.abs(current.width - initialRect.width) > 1 || workspace.scrollWidth > workspace.clientWidth + 1) failed.push('workspace-width-or-overflow-changed');
      if (failed.length && failures.length < 20) failures.push({ elapsedMs: performance.now() - startedAt, failed });
    };
    const startedAt = performance.now();
    const observer = new MutationObserver(check);
    observer.observe(document.querySelector('#sites-tab'), { subtree: true, childList: true, attributes: true });
    const timer = setInterval(check, 250);
    window.__ENTROPY_SITES_RECORDING_QA__ = { stop() {
      check(); observer.disconnect(); clearInterval(timer);
      return { elapsedMs: performance.now() - startedAt, failures,
        initialComputedAt, finalComputedAt: Number(document.querySelector('#sites-tab')?.dataset.sitesSnapshotComputedAt),
        visible: document.visibilityState === 'visible' };
    } };
    return true;
  })()`);
  if (!probeInstalled) throw new Error('QA_SITES_PROBE_REQUIRED');
  const resetHour = (initial.globalExposureAverage.resetHour + 1) % 24;
  let continuity;
  try {
    const startedAt = Date.now();
    while (Date.now() - startedAt < INVALIDATION_DELAY_MS) {
      signal?.throwIfAborted();
      await sleep(Math.min(1000, INVALIDATION_DELAY_MS - (Date.now() - startedAt)));
    }
    requireResponse(await send({ action: MESSAGE_ACTIONS.SET_RESET_HOUR, hour: resetHour }), 'RESET_HOUR');
    while (Date.now() - startedAt < OBSERVATION_MS) {
      signal?.throwIfAborted();
      await sleep(Math.min(1000, OBSERVATION_MS - (Date.now() - startedAt)));
    }
  } finally {
    continuity = await evaluate(harness.cdp, page.sessionId, `(() => {
      const result = window.__ENTROPY_SITES_RECORDING_QA__.stop();
      delete window.__ENTROPY_SITES_RECORDING_QA__; return result;
    })()`);
    await evidence.event('QA_SITES_REFRESH_CONTINUITY_OBSERVED', continuity);
  }
  if (continuity.failures.length || !continuity.visible
      || continuity.elapsedMs < OBSERVATION_MS
      || !Number.isFinite(continuity.finalComputedAt)
      || continuity.finalComputedAt <= continuity.initialComputedAt) {
    const error = new Error('QA_SITES_REFRESH_CONTINUITY_FAILED');
    error.diagnostic = continuity;
    throw error;
  }
  // Explicit Cancel proves the observation draft never changed the saved cap.
  await closeCap(harness, page, '[data-sites-hud]');
  const cancelledCap = await assertCapEditing(harness, page, '[data-sites-hud]', false, signal);
  if (cancelledCap.value !== '120') throw new Error('QA_SITES_CANCEL_CHANGED_SAVED_CAP');
  const readingContinuity = await observeVisibleReadingRefresh({ harness, page, send, signal, evidence, zen, selectedReading, readingDay });
  let dayReturn = null;
  if (zen) {
    dayReturn = await returnSitesReadingDay({ harness, page, signal, selectedReading, readingDay });
    await evidence.event('QA_SITES_READING_DAY_RETURN_OBSERVED', dayReturn);
  }
  const phases = [];
  await commitSettings(send, { globalGoal: 120, dataCollectionMode: 'off' });
  let snapshot = await readSnapshot(send);
  let detail = await readDetail(send, snapshot);
  if (snapshot.recording.effectiveScope !== 'off' || snapshot.recording.globalCapAvailable
      || detail.mode !== 'policy_only' || detail.capAvailability.available || detail.intel !== null
      || snapshot.totalExposure !== 0 || snapshot.globalExposureAverage.averageMs !== null) {
    throw new Error('QA_SITES_OFF_RECORDING_CONTRACT_FAILED');
  }
  await waitForDom(harness, page, "document.querySelector('#sites-site-detail[data-detail-mode=\"policy_only\"]')", signal);
  if (await evaluate(harness.cdp, page.sessionId,
    `Boolean(document.querySelector('#sites-site-detail .zen-site-ledger, #sites-site-detail [data-intel-page]'))`)) {
    throw new Error('QA_SITES_REVOKED_READING_RETAINED');
  }
  const globalOff = await assertCapEditing(harness, page, '[data-sites-hud]', true, signal);
  const localOff = await assertCapEditing(harness, page, '[data-site-cap]', true, signal);
  if (globalOff.value !== '120' || localOff.value !== '30') throw new Error('QA_SITES_SAVED_CAP_CHANGED');
  phases.push({ scope: 'off', recording: snapshot.recording, detailMode: detail.mode,
    globalOff, localOff, runtimeCap: await readInactiveRuntimeCap(send) });

  await commitSettings(send, { dataCollectionMode: 'protected_sites', insightsConsent: 'protected_only' });
  snapshot = await readSnapshot(send);
  detail = await readDetail(send, snapshot);
  const outside = await readDetail(send, snapshot, 'example.com');
  if (snapshot.recording.effectiveScope !== 'protected_sites' || !snapshot.recording.globalCapAvailable
      || detail.mode !== 'analysis' || !detail.recording.enabled
      || outside.mode !== 'policy_only' || outside.recording.reason !== 'outside_scope'
      || snapshot.siteRegistry.entries.some(entry => entry.type !== 'blocked')) {
    throw new Error('QA_SITES_PROTECTED_SCOPE_CONTRACT_FAILED');
  }
  await waitForDom(harness, page, "document.querySelector('#sites-site-detail') && !document.querySelector('#sites-site-detail[data-detail-mode=\"policy_only\"]')", signal);
  phases.push({ scope: 'protected_sites', recording: snapshot.recording,
    protectedDetailMode: detail.mode, outsideDetailMode: outside.mode,
    globalCap: await assertCapEditing(harness, page, '[data-sites-hud]', false, signal) });

  await commitSettings(send, { trackingExcludedUrls: [DOMAIN] });
  snapshot = await readSnapshot(send);
  detail = await readDetail(send, snapshot);
  if (snapshot.recording.excludedProtectedCount !== 1 || detail.mode !== 'policy_only'
      || detail.recording.reason !== 'excluded' || detail.capAvailability.available
      || !snapshot.siteRegistry.byDomain[DOMAIN]) throw new Error('QA_SITES_EXCLUDED_PROTECTION_CONTRACT_FAILED');
  await waitForDom(harness, page, "document.querySelector('#sites-site-detail[data-detail-mode=\"policy_only\"]')", signal);
  phases.push({ scope: 'protected_sites_excluded', recording: snapshot.recording,
    localCap: await assertCapEditing(harness, page, '[data-site-cap]', true, signal),
    runtimeCap: await readInactiveRuntimeCap(send) });
  return { schemaVersion: 1, continuity, readingContinuity, dayReturn, phases, invalidationDelayMs: INVALIDATION_DELAY_MS,
    observation: 'real elapsed time and canonical reset-hour invalidation; no clock/stats injection',
    limitation: 'Current-policy queries and UI/runtime cap admission are checked. The selected canonical day observation declares observed-hourly or unobserved-summary coverage; a missing day proves no hourly retention. No foreground usage is generated; zero returned usage is not evidence of absent writes under active browsing.' };
}
