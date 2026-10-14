import { MESSAGE_ACTIONS } from '../../../src/platform/messaging/messageTypes.js';
import { requireSiteLongTermPatterns } from '../../../src/domains/stats/contracts/siteLongTermPatternContract.js';
import { requireSiteTodayNotes } from '../../../src/domains/stats/contracts/siteTodayNotesContract.js';
import { requireSitesSiteDetailDomain, requireSitesSiteDetailQueryResult } from '../../../src/domains/stats/contracts/sitesSiteDetailContracts.js';
import { requireSettingsCommitAcknowledgement } from '../../../src/domains/settings/config/settingsCommitAcknowledgement.js';
import { evaluate, sleep } from '../../e2e/extensionChromiumHarness.mjs';
import { inspectZenDaySlip, inspectZenNotebookAccess, requireZenLedgerHour } from './dashboardSitesIntelJourney.mjs';
import { inspectSitesReadingIntent, installSitesReadingContinuityProbe } from './dashboardSitesRecordingJourney.mjs';

const CACHE_AGING_MS = 20_000;

function requireProof(condition, code, diagnostic) {
  if (condition) return;
  const error = new Error(code); error.diagnostic = diagnostic; throw error;
}

export function requireStoredSitesReadingDetail(detail, domain, expectedDateStr = undefined) {
  requireProof(detail !== null && typeof detail === 'object' && !Array.isArray(detail)
    && detail.intel !== null && typeof detail.intel === 'object' && !Array.isArray(detail.intel),
  'QA_SITES_STORED_READING_DETAIL_INVALID', { domain, expectedDateStr });
  const canonicalDomain = requireSitesSiteDetailDomain(domain);
  const intel = detail?.intel;
  requireSiteLongTermPatterns(intel?.longTermPatterns);
  requireSiteTodayNotes(intel?.todayNotes);
  requireProof(canonicalDomain === domain && detail?.mode === 'analysis' && detail.domain === domain
    && intel.domain === domain && intel.detailTier === 'full' && !Object.hasOwn(intel, 'captureFixtureId')
    && !Object.hasOwn(detail, 'captureFixtureId') && Number.isFinite(detail.computedAtEpochMs) && detail.computedAtEpochMs > 0
    && intel.todayObserved === true && intel.todayNotes.status === 'observed'
    && (expectedDateStr === undefined || intel.todayNotes.dateStr === expectedDateStr)
    && Array.isArray(intel.todayHourly) && intel.todayHourly.length === 24
    && Array.from(intel.todayHourly).every(value => typeof value === 'number' && Number.isFinite(value) && value >= 0)
    && typeof intel.todayTotal === 'number' && Number.isFinite(intel.todayTotal) && intel.todayTotal > 0
    && Math.abs(intel.todayHourly.reduce((sum, value) => sum + value, 0) - intel.todayTotal) <= 1,
  'QA_SITES_STORED_READING_DETAIL_INVALID', { domain, expectedDateStr });
  const growthHour = intel.todayHourly.findIndex(value => value > 0);
  const positiveNonzeroHour = intel.todayHourly.findIndex((value, hour) => hour > 0 && value > 0);
  // Zero is the product's initial selection. A midnight-only record must still
  // exercise a changed selection; its observed zero-valued hour is real data.
  const selectedHour = positiveNonzeroHour === -1 ? 1 : positiveNonzeroHour;
  return { kind: 'observed-hourly', observed: true, dateStr: intel.todayNotes.dateStr,
    growthHour, selectedHour, domain, source: 'stored-canonical-records' };
}

export function requireStoredSitesHourAdvance(beforeDetail, afterDetail, selection) {
  requireProof(selection?.kind === 'observed-hourly' && selection.observed === true
    && selection.source === 'stored-canonical-records' && typeof selection.domain === 'string'
    && typeof selection.dateStr === 'string' && Number.isInteger(selection.selectedHour)
    && selection.selectedHour >= 1 && selection.selectedHour <= 23
    && Number.isInteger(selection.growthHour) && selection.growthHour >= 0 && selection.growthHour <= 23,
  'QA_SITES_STORED_READING_HOUR_DID_NOT_ADVANCE', { selection });
  const before = requireStoredSitesReadingDetail(beforeDetail, selection?.domain, selection?.dateStr);
  requireStoredSitesReadingDetail(afterDetail, selection.domain, selection.dateStr);
  const hour = selection.growthHour;
  const beforeSessionCount = beforeDetail.intel.todaySessionStats?.count;
  const afterSessionCount = afterDetail.intel.todaySessionStats?.count;
  requireProof(selection.kind === 'observed-hourly' && selection.observed === true
    && selection.source === 'stored-canonical-records' && Number.isInteger(hour) && hour >= 0 && hour <= 23
    && before.dateStr === selection.dateStr && before.growthHour === hour && before.selectedHour === selection.selectedHour
    && beforeDetail.intel.todayHourly[hour] > 0
    && afterDetail.intel.todayHourly[hour] > beforeDetail.intel.todayHourly[hour]
    && afterDetail.intel.todayTotal > beforeDetail.intel.todayTotal
    && Number.isSafeInteger(beforeSessionCount) && beforeSessionCount > 0
    && Number.isSafeInteger(afterSessionCount) && afterSessionCount > beforeSessionCount,
  'QA_SITES_STORED_READING_HOUR_DID_NOT_ADVANCE', { selection });
  return { dateStr: selection.dateStr, growthHour: hour, selectedHour: selection.selectedHour,
    beforeActiveMs: beforeDetail.intel.todayHourly[hour], afterActiveMs: afterDetail.intel.todayHourly[hour],
    deltaActiveMs: afterDetail.intel.todayHourly[hour] - beforeDetail.intel.todayHourly[hour],
    beforeTotalMs: beforeDetail.intel.todayTotal, afterTotalMs: afterDetail.intel.todayTotal,
    beforeSessionCount, afterSessionCount };
}

export function requireStoredSitesRangeFocus(focus) {
  requireProof(focus?.documentFocused === true && focus.rangePresent === true && focus.rangeFocused === true,
    'QA_SITES_STORED_READING_RANGE_FOCUS_LOST', focus);
  return focus;
}

export function requireStoredSitesReadingContinuity(state, selection, view) {
  const before = state?.initial?.reading, after = state?.final?.reading;
  const intent = before?.intent;
  requireProof(['hours', 'basis'].includes(view) && selection?.source === 'stored-canonical-records'
    && selection.observed === true && selection.kind === 'observed-hourly'
    && Number.isInteger(selection.selectedHour) && selection.selectedHour >= 1 && selection.selectedHour <= 23
    && state.pendingSeen === true && Array.isArray(state.failures) && state.failures.length === 0
    && state.final.admission === 'ready' && Number.isFinite(state.initial.computedAt)
    && Number.isFinite(state.final.computedAt) && state.final.computedAt > state.initial.computedAt
    && before?.kind === 'zen-ledger' && after?.kind === 'zen-ledger' && before.ready && after.ready
    && intent.view === (view === 'hours' ? 'slip' : 'basis') && intent.dayView === 'hours'
    && (view !== 'basis' || intent.returnView === 'slip')
    && intent.selectedDate === selection.dateStr && intent.selectedHour === selection.selectedHour
    && typeof intent.dayAnchor === 'string' && intent.dayAnchor.length > 0
    && typeof intent.fieldAnchor === 'string' && intent.fieldAnchor.length > 0
    && Number.isSafeInteger(intent.basisPageIndex) && intent.basisPageIndex >= 0
    && intent.annotation === null && intent.annotationAnchor === null
    && JSON.stringify(after.intent) === JSON.stringify(intent),
  'QA_SITES_STORED_READING_CONTINUITY_FAILED', { selection, view, state });
  return state;
}

async function waitFor(harness, page, expression, signal) {
  const deadline = Date.now() + 30_000;
  while (Date.now() < deadline) {
    signal?.throwIfAborted();
    if (await evaluate(harness.cdp, page.sessionId, `Boolean(${expression})`)) return;
    await sleep(150);
  }
  throw new Error('QA_SITES_STORED_READING_TIMEOUT:' + expression);
}

async function settle(harness, page) {
  await evaluate(harness.cdp, page.sessionId, 'new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))');
}

async function clickAction(harness, page, action, signal) {
  const selector = `#sites-site-detail [data-ledger-action="${action}"]`;
  await waitFor(harness, page, `document.querySelector(${JSON.stringify(selector)})?.getClientRects().length`, signal);
  await evaluate(harness.cdp, page.sessionId, `document.querySelector(${JSON.stringify(selector)}).click()`);
  await settle(harness, page);
}

async function readCurrentDetail(send, domain) {
  const snapshot = await send({ action: MESSAGE_ACTIONS.GET_SITES_SNAPSHOT });
  requireProof(snapshot?.success === true && snapshot.sitesSnapshot, 'QA_SITES_STORED_SNAPSHOT_FAILED', snapshot);
  const response = await send({ action: MESSAGE_ACTIONS.GET_SITES_SITE_DETAIL,
    domain, siteDetailRevision: snapshot.sitesSnapshot.siteDetailRevision });
  requireProof(response?.success === true, 'QA_SITES_STORED_DETAIL_FAILED', response);
  return requireSitesSiteDetailQueryResult(response).sitesSiteDetail;
}

async function commitGoal(send, goal) {
  const response = await send({ action: MESSAGE_ACTIONS.SET_SETTINGS, items: { globalGoal: goal }, waitForPropagation: true });
  const committed = requireSettingsCommitAcknowledgement(response?.committedItems, ['globalGoal']);
  requireProof(response?.success === true && committed.globalGoal === goal
    && Array.isArray(response.changedKeys) && response.changedKeys.includes('globalGoal')
    && response.propagation?.status === 'succeeded', 'QA_SITES_STORED_SETTINGS_ACK_FAILED', response);
}

async function selectStoredHours({ harness, page, signal, selection }) {
  await waitFor(harness, page,
    "document.querySelector('#sites-site-detail .zen-site-ledger__viewport[data-view=\"slip\"]')?.getClientRects().length", signal);
  await clickAction(harness, page, 'history', signal);
  for (let index = 0; index < 40; index += 1) {
    const selected = await evaluate(harness.cdp, page.sessionId, `(() => {
      const field = document.querySelector('#sites-site-detail .zen-record-dates');
      const visible = node => node.getClientRects().length && !node.closest('[hidden], [inert], [aria-hidden="true"]');
      const today = [...field.querySelectorAll('button[data-date]')].find(node => node.dataset.date === ${JSON.stringify(selection.dateStr)} && visible(node));
      if (today) { today.click(); return true; }
      const next = field.querySelector('[data-ledger-action="next-page"]');
      if (!next || next.disabled) throw new Error('QA_SITES_STORED_TODAY_UNREACHABLE');
      next.click(); return false;
    })()`);
    await settle(harness, page);
    if (selected) break;
    if (index === 39) throw new Error('QA_SITES_STORED_FIELD_PAGE_LIMIT');
  }
  await waitFor(harness, page,
    `document.querySelector('#sites-site-detail .zen-site-ledger-slip')?.dataset.date === ${JSON.stringify(selection.dateStr)}`, signal);
  for (let index = 0; index < 12; index += 1) {
    const opened = await evaluate(harness.cdp, page.sessionId, `(() => {
      const slip = document.querySelector('#sites-site-detail .zen-site-ledger-slip');
      const hours = [...slip.querySelectorAll('[data-day-action="hours"]')]
        .find(node => node.getClientRects().length && !node.closest('[hidden], [inert], [aria-hidden="true"]'));
      if (hours) { hours.click(); return true; }
      const next = slip.querySelector('[data-ledger-action="next-page"]');
      if (!next || next.disabled) throw new Error('QA_SITES_STORED_HOURS_UNREACHABLE');
      next.click(); return false;
    })()`);
    await settle(harness, page);
    if (opened) break;
    if (index === 11) throw new Error('QA_SITES_STORED_DAY_PAGE_LIMIT');
  }
  await waitFor(harness, page, "document.querySelector('#sites-site-detail [data-ledger-hour-select]')?.getClientRects().length", signal);
  await evaluate(harness.cdp, page.sessionId,
    "document.querySelector('#sites-site-detail [data-ledger-hour-select]').focus({preventScroll:true})");
  for (const [key, code] of [['Home', 36], ...Array.from({ length: selection.selectedHour }, () => ['ArrowRight', 39])]) {
    for (const type of ['keyDown', 'keyUp']) await harness.cdp.send('Input.dispatchKeyEvent', {
      type, key, code: key, windowsVirtualKeyCode: code,
    }, page.sessionId);
  }
  await settle(harness, page);
}

function compactAccess(access) {
  return { accessible: access.accessible, view: access.view, body: access.body.rect,
    requiredControlCount: access.requiredControlCount, verifiedControlCount: access.verifiedControlCount,
    failedControlCount: access.failedControlCount, failedScrollCount: access.failedScrollCount,
    failedTextCount: access.failedTextCount, nestedScrollCount: access.nestedScroll.length };
}

export async function runDashboardSitesStoredReadingJourney({ harness, page, send, signal, evidence, capture,
  domain, detail, advanceStoredRecords }) {
  requireProof(typeof capture === 'function' && typeof advanceStoredRecords === 'function',
    'QA_SITES_STORED_READING_OWNERS_REQUIRED');
  const selection = requireStoredSitesReadingDetail(detail, domain);
  const noFixture = await evaluate(harness.cdp, page.sessionId, `(() => {
    const url = new URL(location.href);
    return !url.searchParams.has('entropy-qa-sites-intel') && !document.querySelector('[data-intel-capture-case]')
      && document.documentElement.dataset.theme === 'zen';
  })()`);
  requireProof(noFixture, 'QA_SITES_STORED_READING_FIXTURE_FORBIDDEN');
  await selectStoredHours({ harness, page, signal, selection });
  const readIntent = () => evaluate(harness.cdp, page.sessionId, `(${inspectSitesReadingIntent.toString()})()`);
  const inspectAccess = async phase => {
    const access = await evaluate(harness.cdp, page.sessionId, `(${inspectZenNotebookAccess.toString()})()`);
    requireProof(access?.mode === 'notebook' && access.accessible, 'QA_SITES_STORED_READING_CLIPPED:' + phase, access);
    return compactAccess(access);
  };
  const readHour = async (expectedDetail, phase) => {
    requireStoredSitesReadingDetail(expectedDetail, domain, selection.dateStr);
    const hour = requireZenLedgerHour(await evaluate(harness.cdp, page.sessionId,
      `(${inspectZenDaySlip.toString()})()`), selection.selectedHour, expectedDetail.intel.todayHourly[selection.selectedHour]);
    requireProof(hour.date === selection.dateStr && hour.focus === null && hour.range.focused
      && hour.hours.length === 24 && hour.hours.every((item, index) => item.hour === index
        && item.activeMs === expectedDetail.intel.todayHourly[index]),
    'QA_SITES_STORED_READING_HOUR_MISMATCH:' + phase, hour);
    return { dateStr: hour.date, selectedHour: hour.selectedHour, dayAnchor: hour.dayAnchor,
      range: hour.range, result: hour.result, context: hour.context, access: await inspectAccess(phase) };
  };
  const before = await readHour(detail, 'before');
  await capture('before');
  const refresh = async (view, goal, advance) => {
    const focusTrace = [];
    const readFocus = async phase => {
      const focus = await evaluate(harness.cdp, page.sessionId, `(() => {
        const active = document.activeElement;
        const range = document.querySelector('#sites-site-detail [data-ledger-hour-select]');
        return { documentFocused: document.hasFocus(), rangePresent: Boolean(range), rangeFocused: active === range,
          active: active ? { tag: active.tagName, id: active.id, type: active.getAttribute('type'), role: active.getAttribute('role') } : null };
      })()`);
      focusTrace.push({ phase, focus });
      await evidence.event('QA_SITES_STORED_READING_FOCUS_OBSERVED', { view, phase, focus });
      return focus;
    };
    const selectedReading = await readIntent();
    const initial = await evaluate(harness.cdp, page.sessionId,
      `(${installSitesReadingContinuityProbe.toString()})(${inspectSitesReadingIntent.toString()})`);
    let continuity, updatedDetail = detail;
    try {
      await readFocus('before-collection');
      if (advance) updatedDetail = await advanceStoredRecords();
      await readFocus('after-collection');
      // The real collection callback may itself read a new canonical snapshot.
      // Age that read too; never rely on a cache bypass or a settings no-op.
      const deadline = Date.now() + CACHE_AGING_MS;
      while (Date.now() < deadline) {
        signal?.throwIfAborted(); await sleep(Math.min(1000, deadline - Date.now()));
      }
      await readFocus('before-invalidation');
      await commitGoal(send, goal);
      await waitFor(harness, page,
        `document.querySelector('#sites-tab')?.dataset.sitesSnapshotAdmission === 'ready'
          && document.querySelector('.sites-sites-workspace')?.dataset.contentPending !== 'true'
          && Number(document.querySelector('#sites-tab')?.dataset.sitesSnapshotComputedAt) > ${initial.computedAt}
          && (${inspectSitesReadingIntent.toString()})()?.ready`, signal);
      await settle(harness, page);
      const admittedFocus = await readFocus('after-admission');
      if (view === 'hours') requireStoredSitesRangeFocus(admittedFocus);
    } finally {
      continuity = await evaluate(harness.cdp, page.sessionId, `(() => {
        const result = window.__ENTROPY_SITES_READING_QA__.stop();
        delete window.__ENTROPY_SITES_READING_QA__; return result;
      })()`);
      await evidence.event('QA_SITES_STORED_READING_CONTINUITY_OBSERVED', { view, selection, ...continuity });
    }
    requireStoredSitesReadingContinuity(continuity, selection, view);
    requireProof(JSON.stringify(selectedReading.intent) === JSON.stringify(continuity.initial.reading.intent),
      'QA_SITES_STORED_READING_PROBE_INTENT_CHANGED');
    const queriedDetail = await readCurrentDetail(send, domain);
    requireStoredSitesReadingDetail(queriedDetail, domain, selection.dateStr);
    requireProof(JSON.stringify(queriedDetail.intel.todayHourly) === JSON.stringify(updatedDetail.intel.todayHourly),
      'QA_SITES_STORED_READING_REQUERY_MISMATCH');
    return { continuity, focusTrace, updatedDetail: queriedDetail, callbackDetail: updatedDetail, access: await inspectAccess(view + '-refreshed') };
  };
  const hoursRefresh = await refresh('hours', 121, true);
  const advancement = requireStoredSitesHourAdvance(detail, hoursRefresh.callbackDetail, selection);
  const hoursAfter = await readHour(hoursRefresh.updatedDetail, 'hours-after');
  await clickAction(harness, page, 'basis', signal);
  await waitFor(harness, page,
    "document.querySelector('#sites-site-detail .zen-site-ledger__viewport[data-view=\"basis\"]')?.getClientRects().length", signal);
  detail = hoursRefresh.updatedDetail;
  const readBasisPage = async () => {
    const basis = await evaluate(harness.cdp, page.sessionId, `(() => {
      const pager = document.querySelector('#sites-site-detail .zen-record-basis .zen-ledger-pages');
      if (!pager) throw new Error('QA_SITES_STORED_READING_BASIS_PAGER_REQUIRED');
      return { pageIndex: Number(pager.dataset.pageIndex), pageCount: Number(pager.dataset.pageCount),
        visibleText: [...pager.querySelectorAll('[data-page-visible="true"]')].map(node => node.textContent.trim()) };
    })()`);
    requireProof(Number.isSafeInteger(basis.pageCount) && basis.pageCount > 0
      && Number.isSafeInteger(basis.pageIndex) && basis.pageIndex >= 0 && basis.pageIndex < basis.pageCount
      && basis.visibleText.length > 0 && basis.visibleText.every(text => text.length > 0),
    'QA_SITES_STORED_READING_BASIS_PAGE_INVALID', basis);
    return basis;
  };
  const basisEntry = await readBasisPage();
  if (basisEntry.pageCount > 1) {
    await evaluate(harness.cdp, page.sessionId, `(() => {
      const next = document.querySelector('#sites-site-detail .zen-record-basis [data-ledger-action="next-page"]');
      if (!next || next.disabled) throw new Error('QA_SITES_STORED_READING_BASIS_NEXT_UNREACHABLE');
      next.click();
    })()`);
    await settle(harness, page);
  }
  const basisPositionBefore = await readBasisPage();
  requireProof(basisPositionBefore.pageCount === basisEntry.pageCount
    && basisPositionBefore.pageIndex === (basisEntry.pageCount > 1 ? 1 : 0),
  'QA_SITES_STORED_READING_BASIS_POSITION_NOT_SELECTED', { basisEntry, basisPositionBefore });
  const basisBefore = await inspectAccess('basis-before');
  const basisRefresh = await refresh('basis', 120, false);
  const basisPositionAfter = await readBasisPage();
  requireProof(JSON.stringify(basisPositionAfter) === JSON.stringify(basisPositionBefore)
    && basisRefresh.continuity.initial.reading.intent.basisPageIndex === basisPositionBefore.pageIndex,
  'QA_SITES_STORED_READING_BASIS_POSITION_CHANGED', { basisPositionBefore, basisPositionAfter });
  await evaluate(harness.cdp, page.sessionId, `(() => {
    const back = [...document.querySelectorAll('[data-workspace-action="back"], #sites-site-detail [data-ledger-action="back"]')]
      .find(node => node.getClientRects().length && !node.closest('[hidden], [inert], [aria-hidden="true"]'));
    if (!back) throw new Error('QA_SITES_STORED_READING_BACK_UNREACHABLE'); back.click();
  })()`);
  await settle(harness, page);
  const after = await readHour(basisRefresh.updatedDetail, 'after');
  const finalReading = await readIntent();
  const expectedReturn = { ...hoursRefresh.continuity.final.reading.intent,
    returnView: basisRefresh.continuity.final.reading.intent.returnView,
    basisPageIndex: basisRefresh.continuity.final.reading.intent.basisPageIndex };
  requireProof(JSON.stringify(finalReading.intent) === JSON.stringify(expectedReturn)
    && ['left', 'top', 'width', 'height'].every(key => Math.abs(after.access.body[key] - before.access.body[key]) <= 1),
  'QA_SITES_STORED_READING_BACK_INTENT_CHANGED', { finalReading });
  await capture('after');
  return { schemaVersion: 1, selection, navigation: 'history → today → native hourly range',
    source: 'production browser foreground tracking through durable stats facts; no capture projection or injected records',
    advancement, before, hoursAfter, basisBefore, after,
    basisPosition: { before: basisPositionBefore, after: basisPositionAfter },
    hoursRefresh: { continuity: hoursRefresh.continuity, focusTrace: hoursRefresh.focusTrace, access: hoursRefresh.access },
    basisRefresh: { continuity: basisRefresh.continuity, focusTrace: basisRefresh.focusTrace, access: basisRefresh.access } };
}
