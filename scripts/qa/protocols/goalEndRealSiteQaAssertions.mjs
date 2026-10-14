import { isDeepStrictEqual } from 'node:util';
import {
  requireFurinActivityDate,
  requireFurinDailyReceipt,
} from '../../../src/platform/storage/nudge/furinDailyReceiptContract.js';
import { requireInterventionExposureSnapshot } from '../../../src/domains/protection/background/runtime/interventionExposureWindow.js';

const MINUTE_MS = 60_000;
const record = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const text = value => typeof value === 'string' && value.length > 0 && value === value.trim();

function proof(condition, code) {
  if (!condition) throw new Error(`QA_GOAL_END_${code}`);
}

/** A fresh observation may follow an item URL change only within this exact
 * native document and semantic surface. No successor document is equivalent. */
export function assertSameGoalDebuggerDocument(expected, observed) {
  const keys = ['tabId', 'documentId', 'sessionKey', 'timeOrigin', 'origin', 'hostname',
    'semanticSurfaceId', 'routeFamily', 'surfaceMode'];
  for (const value of [expected, observed]) {
    proof(record(value) && value.status === 'active' && Number.isSafeInteger(value.tabId) && value.tabId >= 0
      && Number.isFinite(value.timeOrigin) && value.timeOrigin > 0
      && keys.slice(1).filter(key => key !== 'timeOrigin').every(key => text(value[key])),
    'DEBUGGER_DOCUMENT_IDENTITY_REQUIRED');
  }
  proof(keys.every(key => expected[key] === observed[key]), 'DEBUGGER_DOCUMENT_CHANGED');
  return true;
}

export function assertSameGoalDebuggerCapture(expected, observed) {
  for (const value of [expected, observed]) {
    proof(record(value) && Number.isSafeInteger(value.startedAt) && value.startedAt > 0
      && value.captureKind === 'live', 'DEBUGGER_CAPTURE_IDENTITY_REQUIRED');
  }
  proof(expected.startedAt === observed.startedAt && expected.captureKind === observed.captureKind,
    'DEBUGGER_CAPTURE_CHANGED');
  return true;
}

/** The debugger returns null before the lazy feed owner registers its provider.
 * An unloaded provider is different from a loaded, explicitly inactive engine.
 * Neither state manufactures an endpoint or certifies boundary readiness. */
export function readGoalFeedObservation(feed) {
  proof(record(feed) && Object.hasOwn(feed, 'episode'), 'FEED_EPISODE_FIELD_REQUIRED');
  if (feed.episode === null) return { ownerStatus: 'owner_unloaded', goalEntry: null, endpoint: null };
  const episode = feed.episode;
  proof(record(episode) && typeof episode.active === 'boolean' && text(episode.managerState)
    && text(episode.phase) && Array.isArray(episode.blockers) && episode.blockers.every(text)
    && Object.hasOwn(episode, 'goalEntry') && (episode.goalEntry === null || record(episode.goalEntry))
    && record(episode.endpoint) && typeof episode.endpoint.armed === 'boolean'
    && typeof episode.endpoint.active === 'boolean', 'FEED_EPISODE_INVALID');
  return { ownerStatus: episode.active ? 'active' : 'inactive', phase: episode.phase,
    managerState: episode.managerState, blockers: [...episode.blockers],
    goalEntry: episode.goalEntry, endpoint: episode.endpoint };
}

/** Readiness is observed on the exact encountered prelude, never inferred from
 * elapsed wall time or an endpoint belonging to another goal run. */
export function isGoalHorizonContinuationReady(sample, { runId, leaseId }) {
  proof(text(runId) && text(leaseId), 'CONTINUATION_IDENTITY_INVALID');
  proof(record(sample) && record(sample.dom), 'CONTINUATION_SAMPLE_INVALID');
  if (sample.goalEntry === null || sample.endpoint === null) return false;
  proof(record(sample.goalEntry) && record(sample.endpoint), 'CONTINUATION_SAMPLE_INVALID');
  return sample.goalEntry.runId === runId && sample.goalEntry.leaseId === leaseId
    && sample.goalEntry.boundaryAcknowledged === true && sample.goalEntry.handingOff === false
    && sample.endpoint.armed === true && sample.endpoint.active === true && sample.endpoint.boundaryReached === true
    && sample.endpoint.controlsLive === true && sample.endpoint.holdRemainingMs === 0
    && sample.endpoint.continueIntentPending === false && sample.dom.visible === true
    && sample.dom.feedEndpoint === true && sample.dom.furin === false;
}

/** Read the committed admission end containing this actual final paint. A
 * DOM disappearance or the separate nudge terminal timestamp is no substitute. */
export function readGoalEpisodeEndFromExposure(exposure, presentedAt) {
  requireInterventionExposureSnapshot(exposure);
  proof(Number.isSafeInteger(presentedAt) && presentedAt > 0, 'PRESENTED_AT_INVALID');
  if (exposure.status !== 'observed') return null;
  const interval = exposure.intervals.find(value => value.kind === 'presented'
    && value.startedAt <= presentedAt && value.endedAt > presentedAt
    && exposure.settledThroughAt >= value.endedAt);
  return interval === undefined ? null : interval.endedAt;
}

function activeMilliseconds(value) {
  proof(Number.isSafeInteger(value) && value >= 0, 'ACTIVE_MS_INVALID');
  return value;
}

/** Set the next attainable integer-minute goal from a canonical real usage read.
 * This changes a goal, never usage, timestamps or the tracking clock. */
export function nextNaturalGoalMinutes(activeMs) {
  const minutes = Math.floor(activeMilliseconds(activeMs) / MINUTE_MS) + 1;
  proof(Number.isSafeInteger(minutes * MINUTE_MS), 'NEXT_GOAL_OUT_OF_RANGE');
  return minutes;
}

function requireRecordedBudgetFacts(facts, protectedSite) {
  proof(record(facts) && facts.protected === protectedSite, 'PROTECTION_FACTS_INVALID');
  requireFurinActivityDate(facts.dateStr);
  proof(text(facts.hostname) && facts.hostname === facts.hostname.toLowerCase(), 'HOSTNAME_INVALID');
  activeMilliseconds(facts.siteObservedMs);
  activeMilliseconds(facts.globalActiveMs);
  if (protectedSite) {
    activeMilliseconds(facts.siteActiveMs);
    proof(facts.siteActiveMs <= facts.siteObservedMs, 'CHARGE_EXCEEDS_OBSERVATION');
  } else proof(facts.siteActiveMs === null, 'UNPROTECTED_SITE_BUDGET_PRESENT');
}

function requireSameRecordedBudgetScope(before, after) {
  proof(before.hostname === after.hostname && before.dateStr === after.dateStr, 'CHARGE_SCOPE_CHANGED');
  proof(after.siteObservedMs >= before.siteObservedMs && after.globalActiveMs >= before.globalActiveMs,
    'RECORDED_BUDGET_REGRESSED');
}

/** For an isolated run with only this newly protected host, pre-registration
 * observation cannot become charge. The registration ACK may already include
 * real post-registration use, bounded by the newly observed suffix. */
export function assertRegistrationDoesNotRetrocharge(before, after) {
  requireRecordedBudgetFacts(before, false);
  requireRecordedBudgetFacts(after, true);
  requireSameRecordedBudgetScope(before, after);
  proof(before.siteObservedMs > 0, 'PRE_REGISTRATION_OBSERVATION_REQUIRED');
  proof(after.siteActiveMs <= after.siteObservedMs - before.siteObservedMs,
    'PRE_REGISTRATION_USAGE_CHARGED');
  proof(after.globalActiveMs - before.globalActiveMs === after.siteActiveMs,
    'REGISTRATION_GLOBAL_CHARGE_MISMATCH');
  return true;
}

/** No other protected host is consuming during this isolated observation. An
 * ordinary recorded foreground suffix must enter Site and Global together. */
export function assertProtectedChargeAdvanced(before, after, minimumMs = 1) {
  requireRecordedBudgetFacts(before, true);
  requireRecordedBudgetFacts(after, true);
  requireSameRecordedBudgetScope(before, after);
  proof(Number.isSafeInteger(minimumMs) && minimumMs > 0, 'CHARGE_MINIMUM_INVALID');
  const charged = after.siteActiveMs - before.siteActiveMs;
  proof(charged >= minimumMs, 'POST_REGISTRATION_CHARGE_DIVERGENCE');
  proof(after.siteObservedMs - before.siteObservedMs === charged,
    'POST_REGISTRATION_OBSERVATION_DIVERGENCE');
  proof(after.globalActiveMs - before.globalActiveMs === charged,
    'POST_REGISTRATION_GLOBAL_DIVERGENCE');
  return true;
}

function requireState(state) {
  proof(record(state) && Object.keys(state).sort().join(',') === 'dailyReceipt,pending,terminal'
    && record(state.pending) && record(state.terminal), 'STATE_INVALID');
  if (state.dailyReceipt !== null) requireFurinDailyReceipt(state.dailyReceipt);
  return state;
}

export function requireGoalEndQaObservation(value) {
  proof(record(value) && Object.hasOwn(value, 'goalEndState')
    && Object.hasOwn(value, 'interventionExposure'), 'AUTHORITATIVE_GOAL_OBSERVATION_REQUIRED');
  requireState(value.goalEndState);
  requireInterventionExposureSnapshot(value.interventionExposure);
  return value;
}

/** Prelude-only ownership check. Background pending precedes content dispatch;
 * an unhanded content run cannot outlive that exact canonical pending run.
 * Handoff/final-paint observations belong to later lifecycle assertions. */
export function assertGoalPreludePending(state, { goalEntry, finalPresented }) {
  requireState(state);
  proof(typeof finalPresented === 'boolean', 'PRELUDE_PRESENTATION_STATE_INVALID');
  if (goalEntry === null) return true;
  proof(record(goalEntry) && text(goalEntry.runId) && typeof goalEntry.handingOff === 'boolean', 'PRELUDE_ENTRY_INVALID');
  if (goalEntry.handingOff || finalPresented
    || (state.dailyReceipt !== null && !noReceiptForRun(state.dailyReceipt, goalEntry.runId))) return true;
  proof(Object.values(state.pending).some(value => record(value) && value.runId === goalEntry.runId),
    'PRELUDE_PENDING_RUN_MISSING');
  return true;
}

/** A previous cancellation/refusal cannot fail a later boundary wait. Only a
 * newly committed exact-host refusal from the actual goal owner qualifies. */
export function readNewGoalPrimaryMediaRefusal(state, { startedAt, hostname, tabId }) {
  requireState(state);
  proof(Number.isSafeInteger(startedAt) && startedAt > 0 && text(hostname)
    && Number.isSafeInteger(tabId) && tabId > 0, 'BOUNDARY_WAIT_IDENTITY_INVALID');
  const refusals = Object.values(state.terminal).filter(value => record(value)
    && value.status === 'aborted' && value.reason === 'primary_media_boundary_unproven'
    && Number.isSafeInteger(value.endedAt) && value.endedAt > startedAt
    && record(value.goalBinding) && value.goalBinding.hostname === hostname && value.goalBinding.tabId === tabId);
  proof(refusals.length <= 1, 'BOUNDARY_REFUSAL_AMBIGUOUS');
  if (refusals.length === 0) return null;
  const refusal = refusals[0];
  proof(text(refusal.runId) && refusal.goalBinding.runId === refusal.runId
    && text(refusal.goalBinding.key) && state.terminal[refusal.goalBinding.key] === refusal,
  'BOUNDARY_REFUSAL_BINDING_INVALID');
  return refusal;
}

function currentReceipt(state, dateStr) {
  requireFurinActivityDate(dateStr);
  const { dailyReceipt } = requireState(state);
  proof(dailyReceipt === null || dailyReceipt.dateStr <= dateStr, 'ACTIVITY_DAY_REGRESSED');
  return dailyReceipt !== null && dailyReceipt.dateStr === dateStr ? dailyReceipt : null;
}

function requireIdentity({ dateStr, hostname, runId }) {
  requireFurinActivityDate(dateStr);
  proof(text(hostname) && hostname === hostname.toLowerCase() && hostname.length <= 253, 'HOSTNAME_INVALID');
  proof(text(runId), 'RUN_ID_INVALID');
}

function requireAttainmentFacts(facts) {
  requireIdentity(facts);
  activeMilliseconds(facts.siteActiveMs);
  activeMilliseconds(facts.globalActiveMs);
  proof(Number.isSafeInteger(facts.siteTargetMs) && facts.siteTargetMs > 0
    && Number.isSafeInteger(facts.globalTargetMs) && facts.globalTargetMs > 0, 'TARGET_MS_INVALID');
}

function noReceiptForRun(receipt, runId) {
  if (receipt === null) return true;
  return ![receipt.global, receipt.fullSite, ...Object.values(receipt.sites), ...Object.values(receipt.siteEnds)]
    .some(value => value !== null && value.runId === runId);
}

export function assertNoFinalGoalReceipt(state, { dateStr, runId }) {
  proof(text(runId), 'RUN_ID_INVALID');
  proof(noReceiptForRun(currentReceipt(state, dateStr), runId), 'FINAL_RECEIPT_BEFORE_HANDOFF');
  return true;
}

export function assertGoalRunCancelled(state, { key, runId, reason }) {
  requireState(state);
  proof(text(key) && text(runId) && text(reason), 'CANCELLATION_IDENTITY_INVALID');
  const separator = key.indexOf('|');
  proof(separator === 10 && key.length > 11, 'CANCELLATION_KEY_INVALID');
  const dateStr = key.slice(0, separator);
  proof(!Object.values(state.pending).some(entry => record(entry) && entry.runId === runId), 'CANCELLED_RUN_STILL_PENDING');
  const terminal = state.terminal[key];
  proof(record(terminal) && terminal.runId === runId && terminal.reason === reason
    && record(terminal.goalBinding) && terminal.goalBinding.key === key
    && terminal.goalBinding.runId === runId, 'CANCELLATION_TERMINAL_MISMATCH');
  assertNoFinalGoalReceipt(state, { dateStr, runId });
  return true;
}

function receiptTransition(beforeState, afterState, facts) {
  requireIdentity(facts);
  const before = currentReceipt(beforeState, facts.dateStr);
  const after = currentReceipt(afterState, facts.dateStr);
  proof(after !== null, 'ACTUAL_DAILY_RECEIPT_REQUIRED');
  proof(noReceiptForRun(before, facts.runId), 'RUN_ALREADY_RECEIPTED');
  proof(before === null || !Object.hasOwn(before.siteEnds, facts.hostname), 'SITE_ALREADY_DELIVERED');
  const end = after.siteEnds[facts.hostname];
  proof(end !== undefined && end.runId === facts.runId, 'SITE_END_RUN_MISMATCH');
  return { before, after, end };
}

function unchangedOtherSites(before, after, hostname) {
  const preceding = before === null ? {} : before.siteEnds;
  const withoutHost = map => Object.fromEntries(Object.entries(map).filter(([host]) => host !== hostname));
  proof(isDeepStrictEqual(withoutHost(preceding), withoutHost(after.siteEnds)), 'UNRELATED_SITE_COVERAGE_CHANGED');
  proof(isDeepStrictEqual(withoutHost(before === null ? {} : before.sites), withoutHost(after.sites)),
    'UNRELATED_SITE_PRESENTATION_CHANGED');
  proof(before === null || before.fullSite === null || isDeepStrictEqual(before.fullSite, after.fullSite),
    'PRIOR_FULL_SITE_RECEIPT_CHANGED');
}

export function assertCombinedGoalReceipt(beforeState, afterState, facts) {
  requireAttainmentFacts(facts);
  proof(facts.siteActiveMs >= facts.siteTargetMs && facts.globalActiveMs >= facts.globalTargetMs,
    'COMBINED_GOALS_NOT_ATTAINED');
  const { before, after, end } = receiptTransition(beforeState, afterState, facts);
  proof(before === null || before.global === null, 'GLOBAL_ALREADY_DELIVERED');
  proof(after.global !== null && after.global.runId === facts.runId
    && after.global.presentedAt === end.presentedAt && end.renderer === 'combined_global_furin'
    && isDeepStrictEqual(end.scopes, ['global', 'site']), 'COMBINED_RECEIPT_MISMATCH');
  proof(!Object.hasOwn(after.sites, facts.hostname)
    && isDeepStrictEqual(before === null ? {} : before.sites, after.sites)
    && isDeepStrictEqual(before === null ? null : before.fullSite, after.fullSite), 'COMBINED_FAKE_SITE_PRESENTATION');
  unchangedOtherSites(before, after, facts.hostname);
  return true;
}

export function assertSiteOnlyGoalReceipt(beforeState, afterState, facts) {
  requireAttainmentFacts(facts);
  proof(facts.siteActiveMs >= facts.siteTargetMs && facts.globalActiveMs < facts.globalTargetMs,
    'SITE_ONLY_ATTAINMENT_MISMATCH');
  const { before, after, end } = receiptTransition(beforeState, afterState, facts);
  proof(end.renderer === 'site_furin' && isDeepStrictEqual(end.scopes, ['site'])
    && after.sites[facts.hostname]?.runId === facts.runId, 'SITE_ONLY_RECEIPT_MISMATCH');
  proof(isDeepStrictEqual(before === null ? null : before.global, after.global), 'UNATTAINED_GLOBAL_COVERED');
  unchangedOtherSites(before, after, facts.hostname);
  return true;
}

export function assertSameHostGoalReceiptUnchanged(beforeState, afterState, { dateStr, hostname }) {
  requireIdentity({ dateStr, hostname, runId: 'receipt-comparison' });
  const before = currentReceipt(beforeState, dateStr);
  const after = currentReceipt(afterState, dateStr);
  proof(before !== null && after !== null && Object.hasOwn(before.siteEnds, hostname), 'PRIOR_SITE_RECEIPT_REQUIRED');
  proof(isDeepStrictEqual(before.siteEnds[hostname], after.siteEnds[hostname])
    && isDeepStrictEqual(before.sites[hostname], after.sites[hostname]), 'DUPLICATE_SITE_DELIVERY');
  return true;
}

export function assertLaterSiteAfterGlobalReceipt(beforeState, afterState, facts) {
  const { before, after, end } = receiptTransition(beforeState, afterState, facts);
  proof(before !== null && before.global !== null, 'PRIOR_GLOBAL_RECEIPT_REQUIRED');
  proof(isDeepStrictEqual(before.global, after.global), 'PRIOR_GLOBAL_RECEIPT_CHANGED');
  proof(end.renderer === 'site_furin' && isDeepStrictEqual(end.scopes, ['site'])
    && end.presentedAt > before.global.presentedAt && after.sites[facts.hostname]?.runId === facts.runId
    && after.sites[facts.hostname].deliveryForm === 'brief', 'LATER_SITE_MUST_BE_BRIEF');
  proof(isDeepStrictEqual(before.fullSite, after.fullSite), 'LATER_SITE_SPENT_FULL_OPPORTUNITY');
  unchangedOtherSites(before, after, facts.hostname);
  return true;
}
