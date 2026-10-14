import fs from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { ExtensionChromiumHarness, evaluate, sleep } from '../../e2e/extensionChromiumHarness.mjs';
import { ENTROPY_QA_TRUSTED_PAGE_PATH } from '../../e2e/qaProfileArtifactSlot.mjs';
import { sendTrustedRuntimeMessage } from './gateRuntimeQaProtocol.mjs';
import { requireConsumptionQaSettingsAcknowledgement } from './consumptionEntryQaProtocol.mjs';
import { collectTrackingRuntimeEvidence, sendRuntimeDebuggerAutomationAction, RUNTIME_DEBUGGER_AUTOMATION_ACTIONS as DEBUG } from '../../e2e/sites/siteRuntimeBrowser.mjs';
import { getAutomationPayload, getFeedHorizonScenario, readFeedSnapshot, runTrustedFeedStep,
  runTrustedEndpointForwardStep } from '../../e2e/feedHorizonCausalE2E.mjs';
import { MESSAGE_ACTIONS } from '../../../src/platform/messaging/messageTypes.js';
import { SENTINEL_PROTOCOL_QA_CHANNEL, SENTINEL_PROTOCOL_QA_ACTIONS as SENTINEL } from '../../../src/domains/nudge/runtime/automation/sentinelProtocolQaAutomationContract.dev.js';
import { CONFIG_DEFAULT_FILTER_SETTINGS } from '../../../src/domains/settings/config/index.js';
import { DEFAULT_GATE_CONFIG } from '../../../src/domains/settings/config/gateConfig.js';
import { DEFAULT_NUDGE_SETTINGS } from '../../../src/domains/settings/config/nudgeConfig.js';
import { DEFAULT_ARTIFACT_CONTROL_STATE } from '../../../src/domains/settings/config/artifactControlState.js';
import { createDefaultSettingsCache } from '../../../src/apps/background/services/settingsCacheState.js';
import { DEFAULT_THEME_ID } from '../../../src/themes/core/ids.js';
import { serializeQaError } from '../contracts/qaEvidenceContract.mjs';
import { getFeedSurfaceProfile, resolveFeedSurfaceRoute } from '../../../src/domains/nudge/feed-flow/registry/feedSurfaceProfiles.js';
import { normalizeSiteHostname } from '../../../src/domains/nudge/targeting/siteIdentityCatalog.js';
import { HORIZON_WHEEL_QUIET_MS } from '../../../src/domains/nudge/feed-flow/terminus/HorizonContinueGesture.js';
import { MODEL_STATE_INITIAL_PROFILE_EPOCH } from '../../../src/platform/storage/model/ProfileEpochContract.js';
import { GOAL_DELIVERY_QA_CHARGE_ACTION, parseGoalDeliveryQaFixtureRequest,
  requireGoalDeliveryQaFixtureResponse } from '../../../src/domains/stats/contracts/goalDeliveryQaFixtureContract.dev.js';
import { nextNaturalGoalMinutes, readGoalEpisodeEndFromExposure, readGoalFeedObservation, requireGoalEndQaObservation,
  readNewGoalPrimaryMediaRefusal, assertGoalPreludePending, isGoalHorizonContinuationReady,
  assertSameGoalDebuggerDocument, assertSameGoalDebuggerCapture,
  assertNoFinalGoalReceipt, assertGoalRunCancelled,
  assertRegistrationDoesNotRetrocharge, assertProtectedChargeAdvanced,
  assertCombinedGoalReceipt, assertSameHostGoalReceiptUnchanged,
  assertLaterSiteAfterGlobalReceipt } from './goalEndRealSiteQaAssertions.mjs';

const SITES = Object.freeze([
  { domain: 'youtube.com', siteId: 'youtube', url: 'https://www.youtube.com/shorts/3_YhyeHjOWI' },
  { domain: 'tiktok.com', siteId: 'tiktok', url: 'https://www.tiktok.com/foryou' },
]);
const MINUTE = 60_000;
function proof(value, code) { if (!value) throw new Error(`QA_GOAL_END_REAL_SITE_${code}`); }

// The ordinary export uses production Tracking clocks and recorded usage only.
// The separate functional export supplies explicitly synthetic canonical charge;
// both retain real goal selection, recovery, boundaries and final paint receipts.
export const executeQaProtocol = options => executeGoalEndsQa(options, false);

// A separate named scope. Ordinary collection QA cannot enable this fixture by
// supplying options to its executor or by retrying an ordinary failed run.
export const executeFunctionalQaProtocol = options => executeGoalEndsQa(options, true);

const SNAPSHOT_URL_RACE = 'SITE_E2E_RUNTIME_DEBUGGER_RELAY_FAILED:DEBUG_RUNTIME_SESSION_SNAPSHOT:RUNTIME_DEBUGGER_AUTOMATION_TARGET_TAB_NAVIGATED';

/** Retry only this rejected read, once, through the unchanged strict relay.
 * The existing debugger capture and exact native document must survive it. */
export async function readGoalQaDebuggerSnapshot({ readSnapshot, readIdentity, previous, record }) {
  try { return await readSnapshot(); }
  catch (race) {
    if (race?.message !== SNAPSHOT_URL_RACE) throw race;
    const evidence = { race: serializeQaError(race), expected: previous === undefined ? null : previous,
      before: null, after: null, capture: null };
    try {
      await record('debugger_snapshot_url_race', { ...evidence });
      assertSameGoalDebuggerDocument(previous?.document, previous?.document);
      assertSameGoalDebuggerCapture(previous?.capture, previous?.capture);
      evidence.before = await readIdentity();
      assertSameGoalDebuggerDocument(previous.document, evidence.before);
      await record('debugger_snapshot_same_document_before_fresh_read', { ...evidence });
      const payload = await readSnapshot();
      evidence.capture = { startedAt: payload?.session?.startedAt, captureKind: payload?.session?.captureKind };
      evidence.after = await readIdentity();
      assertSameGoalDebuggerDocument(previous.document, evidence.after);
      assertSameGoalDebuggerCapture(previous.capture, evidence.capture);
      await record('debugger_snapshot_same_document_fresh_read', { ...evidence });
      return payload;
    } catch (error) {
      const failure = new Error('QA_GOAL_END_REAL_SITE_SNAPSHOT_FRESH_READ_REJECTED', { cause: error });
      failure.details = { ...evidence, failure: serializeQaError(error) };
      try { await record('debugger_snapshot_fresh_read_rejected', failure.details); }
      catch (evidenceError) {
        throw new AggregateError([failure, evidenceError], 'QA_GOAL_END_REAL_SITE_SNAPSHOT_EVIDENCE_INCOMPLETE', { cause: failure });
      }
      throw failure;
    }
  }
}

/** Supply real content advances to the existing learner before a TikTok
 * endpoint exists. Input/DOM receipts never substitute for product readiness. */
export async function runGoalQaTikTokBoundaryAdvance({ harness, page, index, readMedia, record }) {
  const before = await readMedia();
  const action = await runTrustedFeedStep({ harness, page, scenario: getFeedHorizonScenario('tiktok'),
    index, dwellMs: 700, collectOracle: true, direction: 'forward' });
  const after = await readMedia();
  const receipt = { tabId: page.tabId, index, before, action, after,
    nativeAdvanceObserved: action.opportunity?.state === 'measured' && action.opportunity.dominantChanged === true };
  await record('tiktok_pre_endpoint_native_advance', receipt);
  return receipt;
}

export async function sendGoalQaAcknowledgedCommand({ request, send, record, requireAcknowledgement, context }) {
  let reply;
  let commandError = null;
  try {
    reply = await send(request);
    requireAcknowledgement(reply);
  } catch (error) { commandError = error; }
  const details = { request, replyReceived: reply !== undefined, reply, context };
  if (commandError !== null) commandError.details = details;
  try {
    // These private-profile commands have bounded, declared settings/rule ACKs.
    // Keep the actual commit/propagation result; an unknown outcome is never retried.
    await record('settings_command_ack', details);
  } catch (evidenceError) {
    if (commandError !== null) {
      const failure = new AggregateError([commandError, evidenceError],
        'QA_GOAL_END_REAL_SITE_COMMAND_EVIDENCE_INCOMPLETE', { cause: commandError });
      failure.details = details;
      throw failure;
    }
    evidenceError.details = details;
    throw evidenceError;
  }
  if (commandError !== null) throw commandError;
  return reply;
}

export async function removeGoalQaOwnedRule({ domain, send, record, context }) {
  const request = { action: MESSAGE_ACTIONS.REMOVE_SITE_RULE, domain, type: 'blocked', waitForPropagation: true };
  const reply = await send(request);
  const acknowledgementError = reply?.success === true && reply.propagation?.status === 'succeeded'
    ? null : new Error('QA_GOAL_END_REAL_SITE_RULE_RESTORE_ACK');
  if (acknowledgementError !== null) {
    acknowledgementError.code = acknowledgementError.message;
    acknowledgementError.stage = 'configuration_cleanup';
  }
  try {
    // Keep the actual response, including a rejected commit or propagation
    // timeout. Cleanup never retries an outcome that may already be committed.
    await record('owned_site_rule_removal_ack', { request, replyReceived: reply !== undefined, reply, context });
  } catch (evidenceError) {
    if (acknowledgementError !== null) {
      throw new AggregateError([acknowledgementError, evidenceError],
        'QA_GOAL_END_REAL_SITE_RULE_RESTORE_EVIDENCE_INCOMPLETE', { cause: acknowledgementError });
    }
    throw evidenceError;
  }
  if (acknowledgementError !== null) throw acknowledgementError;
  return reply;
}

/** Native read-only DOM inventory. Element.closest deliberately retains the
 * same tree boundary as the product classifier; root-host chains show what lies
 * beyond it. All media sources retain only origins. Iframe identity additionally
 * permits a bounded HTTP(S) pathname or exact about:blank; opaque schemes never
 * expose paths. Passive-auth query evidence is boolean only; no source queries,
 * hashes, userinfo, srcdoc or document contents are retained. */
export function collectGoalBoundaryMediaInventory(documentRef, candidateItemSelectors) {
  const describe = node => ({ tag: node.localName, id: node.getAttribute('id'), class: node.getAttribute('class') });
  const describeAncestor = node => ({ ...describe(node), hidden: node.hidden === true,
    ariaHidden: node.getAttribute('aria-hidden'), display: documentRef.defaultView.getComputedStyle(node).display,
    contentVisibility: documentRef.defaultView.getComputedStyle(node).contentVisibility,
    clientRects: node.getClientRects().length });
  const frameIdentity = (source, includeRoleHints = false) => {
    if (source === null || source === '') return { status: 'absent' };
    let url;
    try { url = new URL(source, documentRef.baseURI); }
    catch { return { status: 'invalid' }; }
    if (url.protocol === 'http:' || url.protocol === 'https:') {
      const identity = { status: 'observed', scheme: url.protocol, origin: url.origin,
        pathname: url.pathname.slice(0, 256), pathnameTruncated: url.pathname.length > 256 };
      if (includeRoleHints) {
        const query = url.searchParams;
        const continues = query.getAll('continue');
        let continueIsYoutubeSignin = false;
        if (continues.length === 1) {
          try {
            const target = new URL(continues[0]);
            continueIsYoutubeSignin = target.protocol === 'https:' && target.hostname === 'www.youtube.com'
              && target.pathname === '/signin' && target.username === '' && target.password === '' && target.port === '';
          } catch { /* An invalid target remains a false role hint; no URL value is retained. */ }
        }
        Object.assign(identity, { serviceIsYoutube: query.getAll('service').length === 1 && query.get('service') === 'youtube',
          passiveTrue: query.getAll('passive').length === 1 && query.get('passive') === 'true',
          hasContinue: query.has('continue'), continueIsYoutubeSignin, hasRedirectUri: query.has('redirect_uri') });
      }
      return identity;
    }
    if (url.protocol === 'about:' && url.pathname === 'blank') return { status: 'opaque', scheme: 'about:', pathname: 'blank' };
    return { status: 'unknown', scheme: url.protocol };
  };
  const roots = [documentRef];
  const media = [];
  for (let index = 0; index < roots.length; index += 1) {
    const root = roots[index];
    for (const node of root.querySelectorAll('*')) {
      if (node.shadowRoot !== null) roots.push(node.shadowRoot);
      if (!['video', 'audio', 'iframe'].includes(node.localName)) continue;
      const rect = node.getBoundingClientRect();
      const style = documentRef.defaultView.getComputedStyle(node);
      const ancestors = [];
      let parent = node.parentElement;
      while (parent !== null) { ancestors.push(describeAncestor(parent)); parent = parent.parentElement; }
      const rootHosts = [];
      let rootHost = node.getRootNode().host;
      while (rootHost !== undefined) { rootHosts.push(describeAncestor(rootHost)); rootHost = rootHost.getRootNode().host; }
      const source = typeof node.currentSrc === 'string' && node.currentSrc.length > 0
        ? node.currentSrc : node.getAttribute('src');
      let sourceOrigin = { status: 'absent' };
      if (source !== null && source !== '') {
        try { sourceOrigin = { status: 'observed', origin: new URL(source, documentRef.baseURI).origin }; }
        catch { sourceOrigin = { status: 'invalid' }; }
      }
      let nativeFacts;
      if (node.localName === 'iframe') {
        let frameDocumentFacts;
        try {
          const frameDocument = node.contentDocument;
          frameDocumentFacts = frameDocument === null
            ? { status: 'unknown', reason: 'frame_document_unavailable' }
            : { status: 'accessible', identity: frameIdentity(frameDocument.URL), readyState: frameDocument.readyState,
              counts: { video: frameDocument.querySelectorAll('video').length,
                audio: frameDocument.querySelectorAll('audio').length, iframe: frameDocument.querySelectorAll('iframe').length,
                script: frameDocument.querySelectorAll('script').length,
                bodyChildElements: frameDocument.body === null ? null : frameDocument.body.childElementCount } };
        } catch (error) { frameDocumentFacts = { status: 'unknown', reason: 'frame_document_access_denied', errorName: error.name }; }
        nativeFacts = { iframe: { sourceIdentity: frameIdentity(source, true), srcdocPresent: node.hasAttribute('srcdoc'),
          sandbox: node.getAttribute('sandbox')?.slice(0, 512) ?? null, allow: node.getAttribute('allow')?.slice(0, 512) ?? null,
          document: frameDocumentFacts } };
      } else {
        const sources = [...node.querySelectorAll('source')];
        nativeFacts = { playback: { paused: node.paused, ended: node.ended, readyState: node.readyState, networkState: node.networkState,
          hasSrcObject: node.srcObject !== null && node.srcObject !== undefined,
          srcAttributePresent: node.hasAttribute('src'), srcPresent: node.getAttribute('src') !== null && node.getAttribute('src').trim() !== '',
          currentSrcPresent: typeof node.currentSrc === 'string' && node.currentSrc !== '',
          sourceChildren: { count: sources.length, withSrc: sources.filter(child => child.getAttribute('src') !== null && child.getAttribute('src').trim() !== '').length },
          constants: Object.fromEntries(['HAVE_NOTHING', 'HAVE_METADATA', 'HAVE_CURRENT_DATA', 'HAVE_FUTURE_DATA', 'HAVE_ENOUGH_DATA',
            'NETWORK_EMPTY', 'NETWORK_IDLE', 'NETWORK_LOADING', 'NETWORK_NO_SOURCE'].map(key => [key, node[key]])) } };
      }
      const candidate = candidateItemSelectors === null ? null : node.closest(candidateItemSelectors);
      media.push({ ...describe(node), ancestors, rootHosts, sourceOrigin, ...nativeFacts,
        rect: { x: rect.x, y: rect.y, width: rect.width, height: rect.height },
        visibility: { connected: node.isConnected, display: style.display, visibility: style.visibility,
          opacity: style.opacity, clientRects: node.getClientRects().length },
        matchesCandidateSelectors: candidateItemSelectors !== null && node.matches(candidateItemSelectors),
        closestCandidate: candidate === null ? null : describe(candidate) });
    }
  }
  return { documentVisible: documentRef.visibilityState === 'visible', rootCount: roots.length, media };
}

export function buildGoalDeliveryTrustedHelperHtml(source, seal) {
  parseGoalDeliveryQaFixtureRequest({ action: GOAL_DELIVERY_QA_CHARGE_ACTION, requestId: 'helper-seal',
    payload: { ...seal, profileGeneration: MODEL_STATE_INITIAL_PROFILE_EPOCH,
      hostname: 'youtube.com', observedDeltaMs: 1, protectedDeltaMs: 0 } });
  proof(typeof source === 'string' && source.length <= 30_000
    && !source.includes('entropy-goal-delivery-qa'), 'FUNCTIONAL_HELPER_SOURCE_INVALID');
  return `${source}<meta name="entropy-goal-delivery-qa" content="${seal.nonce}">`
    + `<meta name="entropy-goal-delivery-qa-profile" content="ephemeral">`
    + `<meta name="entropy-goal-delivery-qa-run" content="${seal.runId}">`
    + '<meta name="entropy-goal-delivery-qa-execution" content="owned-headless">'
    + '<meta name="entropy-goal-delivery-qa-target" content="intervention/goal-ends">'
    + '<meta name="entropy-goal-delivery-qa-scope" content="goal_delivery_functional">';
}

async function executeGoalEndsQa({ plan, artifact, browser, evidence, attachmentsDir,
  registerCleanup, reportBrowserGpuCapability, recoveryJournal, signal }, functional) {
  if (functional) proof(plan.target.id === 'intervention/goal-ends'
    && plan.target.protocolId === 'goal_ends_functional' && plan.environment?.lifecyclePolicy === 'per_run'
    && artifact.releaseProfile === 'dev', 'FUNCTIONAL_SCOPE_REQUIRED');
  // Reject before constructing a harness: this functional target cannot open,
  // focus, restore, minimize or reposition a physical browser window.
  proof(artifact.id === 'dev_extension' && browser.processOwnership === 'owned'
    && plan.target.environmentId === 'ephemeral' && plan.browserExecution.headless === true
    && plan.browserExecution.presentation === 'hidden' && plan.browserExecution.displayPolicy === 'none'
    && plan.browserExecution.osFocus === 'never' && plan.browserExecution.audioPolicy === 'muted', 'HEADLESS_OWNED_REQUIRED');
  const seal = functional ? { nonce: randomUUID(), profileKind: 'ephemeral', runId: plan.runId,
    execution: 'owned-headless', targetId: 'intervention/goal-ends', scope: 'goal_delivery_functional' } : null;
  const fixtureScope = functional ? { fixture: { scope: 'controlled_canonical_v2_charge', synthetic: true,
    naturalCollectionCertified: false }, synthetic: true, naturalCollectionCertified: false } : {};
  const harness = new ExtensionChromiumHarness({ chromePath: browser.chrome, distDir: artifact.path,
    rootDir: plan.rootDir, headless: plan.browserExecution.headless, browserExecution: plan.browserExecution,
    capacityReservationMode: plan.browserCapacityMode,
    audioPolicy: plan.browserExecution.audioPolicy, launchEnvironment: browser.launchEnvironment,
    renderingRequirement: plan.browserExecution.renderingRequirement, keepTemp: false,
    temporaryManifest: { requiredPermissions: ['idle', 'scripting', 'webNavigation'], requiredHostPermissions: SITES.map(site => `${new URL(site.url).origin}/*`) },
    tempPrefix: functional ? 'entropy-goal-ends-functional-' : 'entropy-goal-ends-real-site-',
    trustedPagePath: ENTROPY_QA_TRUSTED_PAGE_PATH,
    ...(functional ? { trustedPageSource: buildGoalDeliveryTrustedHelperHtml(
      '<!doctype html><meta charset="utf-8"><title>Entropy goal delivery functional QA</title>', seal) } : {}),
    recoveryJournal });
  registerCleanup('goal_ends_real_site_browser', () => harness.close());
  const trace = [];
  let protocolFailure = null;
  const record = async (label, value) => {
    trace.push({ label, at: Date.now(), value });
    await evidence.event('QA_GOAL_END_REAL_SITE_BOUNDARY', { label, value });
    console.log(JSON.stringify({ event: 'QA_GOAL_END_REAL_SITE_PROGRESS', label }));
    return value;
  };
  registerCleanup('goal_ends_real_site_trace', async () => {
    await fs.writeFile(path.join(attachmentsDir, functional ? 'goal-ends-functional.json' : 'goal-ends-real-site.json'), JSON.stringify({ trace,
      eligibility: functional ? 'controlled_canonical_v2_charge_fixture' : 'canonical_goal_edits_against_actual_recorded_time',
      injectedUsage: functional, injectedClock: false, manualFurinStart: false,
      ...(functional ? { synthetic: true, naturalCollectionCertified: false } : {}),
      browserMode: 'owned_headless', physicalForegroundCertified: false }, null, 2));
    return { samples: trace.length };
  });
  await harness.start();
  await reportBrowserGpuCapability(harness.gpuCapability);
  const runtimePermissions = await harness.evaluateInTrustedPage(`chrome.permissions.contains({ permissions: ['idle', 'scripting', 'webNavigation'] })`);
  await record('required_runtime_permissions', { granted: runtimePermissions });
  proof(runtimePermissions === true, 'RUNTIME_PERMISSIONS_REQUIRED');
  const send = message => sendTrustedRuntimeMessage(harness, message);
  async function charge(hostname, observedDeltaMs, protectedDeltaMs, label) {
    proof(functional, 'ORDINARY_COLLECTION_FIXTURE_FORBIDDEN');
    const request = parseGoalDeliveryQaFixtureRequest({ action: GOAL_DELIVERY_QA_CHARGE_ACTION,
      requestId: `goal-charge:${randomUUID()}`, payload: { ...seal,
        profileGeneration: MODEL_STATE_INITIAL_PROFILE_EPOCH, hostname, observedDeltaMs, protectedDeltaMs } });
    // Additive commands are issued once. An unknown outcome fails this run;
    // polling/retry only reads committed canonical facts and never replays it.
    const response = await send(request);
    proof(response?.ok === true, `FUNCTIONAL_FIXTURE_REJECTED:${response?.error}`);
    const reply = requireGoalDeliveryQaFixtureResponse(response, request);
    return record(label, reply.receipt);
  }
  if (functional) {
    const readiness = await send({ action: MESSAGE_ACTIONS.GET_PROFILE_GENERATION_READINESS,
      profileGeneration: MODEL_STATE_INITIAL_PROFILE_EPOCH });
    proof(readiness?.success === true && readiness.profileGeneration === MODEL_STATE_INITIAL_PROFILE_EPOCH,
      'FUNCTIONAL_PRIVATE_PROFILE_REQUIRED');
    await record('functional_fixture_scope', { synthetic: true, naturalCollectionCertified: false,
      profileGeneration: MODEL_STATE_INITIAL_PROFILE_EPOCH, runId: plan.runId });
  }
  const settings = items => sendGoalQaAcknowledgedCommand({ send, record,
    request: { action: MESSAGE_ACTIONS.SET_SETTINGS, items, waitForPropagation: true },
    requireAcknowledgement: reply => requireConsumptionQaSettingsAcknowledgement(reply, items),
    context: { runId: plan.runId, operation: 'settings' } });
  async function goal(domain, minutes, operation = 'goal') {
    return sendGoalQaAcknowledgedCommand({ send, record,
      request: { action: MESSAGE_ACTIONS.UPSERT_SITE_RULE, domain, type: 'blocked', goalMinutes: minutes, waitForPropagation: true },
      requireAcknowledgement: reply => proof(reply?.success === true && reply.propagation?.status === 'succeeded', 'GOAL_ACK'),
      context: { runId: plan.runId, operation } });
  }
  const preferences = (site, global) => ({ ...structuredClone(DEFAULT_NUDGE_SETTINGS),
    goalEnds: { site, global } });
  const configuration = { 'app-theme': 'zen', filteringMode: 'blocklist', permissionMode: 'selective', rulesMode: 'managed',
    historyCleanupForBlocked: false, concealBlockedBookmarks: false, tabEvaporationForBlocked: false,
    dataCollectionMode: 'all_sites_minimal', insightsConsent: 'all_sites', trackingExcludedUrls: [],
    artifactControlState: structuredClone(DEFAULT_ARTIFACT_CONTROL_STATE),
    filterSettings: Object.fromEntries(Object.entries(CONFIG_DEFAULT_FILTER_SETTINGS).map(([key, entry]) =>
      [key, { ...structuredClone(entry), isActive: false }])),
    gateConfig: structuredClone(DEFAULT_GATE_CONFIG), nudgeConfig: preferences(false, false),
    globalGoal: 480, globalCapNotifyOnExceeded: false };
  const keys = Object.keys(configuration);
  const canonicalDefaults = { ...createDefaultSettingsCache(), 'app-theme': DEFAULT_THEME_ID };
  const requestedKeys = [...keys, 'blockedUrls', 'allowedUrls', 'siteGoals'];
  const originalReply = await send({ action: MESSAGE_ACTIONS.GET_SETTINGS,
    keys: requestedKeys, defaults: Object.fromEntries(requestedKeys.map(key => [key, canonicalDefaults[key]])) });
  await record('configuration_snapshot_contract', { success: originalReply?.success,
    error: originalReply?.error, availableKeys: Object.keys(originalReply?.settings || {}),
    missingKeys: keys.filter(key => !Object.hasOwn(originalReply?.settings || {}, key)) });
  proof(originalReply?.success === true && keys.every(key => Object.hasOwn(originalReply.settings, key))
    && Array.isArray(originalReply.settings.blockedUrls) && Array.isArray(originalReply.settings.allowedUrls)
    && originalReply.settings.siteGoals !== null && typeof originalReply.settings.siteGoals === 'object', 'SETTINGS_SNAPSHOT');
  const original = originalReply.settings;
  const addedRules = [];
  const changedGoals = new Set();
  const matches = (hostname, domain) => hostname === domain || hostname.endsWith(`.${domain}`);
  registerCleanup('goal_ends_real_site_configuration', async () => {
    await settings({ nudgeConfig: preferences(false, false) });
    for (const domain of changedGoals) {
      if (addedRules.includes(domain)) continue;
      const target = Object.hasOwn(original.siteGoals, domain) ? original.siteGoals[domain] : 0;
      const current = await send({ action: MESSAGE_ACTIONS.GET_SETTINGS, keys: ['siteGoals'] });
      proof(current?.success === true && current.settings.siteGoals !== null, 'RESTORE_GOAL_READ');
      let value = Object.hasOwn(current.settings.siteGoals, domain) ? current.settings.siteGoals[domain] : 0;
      while (target - value > 30) { value += 30; await goal(domain, value); }
      await goal(domain, target);
    }
    for (const domain of addedRules) {
      await removeGoalQaOwnedRule({ domain, send, record, context: {
        runId: plan.runId, addedRules: [...addedRules], changedGoals: [...changedGoals],
        originalBlockedUrls: original.blockedUrls,
        protocolFailure: protocolFailure === null ? null : serializeQaError(protocolFailure),
      } });
    }
    await settings(Object.fromEntries(keys.map(key => [key, original[key]])));
    return { effectiveSettingsRestored: true, removedOwnedRules: addedRules,
      actualDailyReceiptsPreservedUntilOwnedProfileCleanup: true };
  });
  await settings(configuration);
  for (const { domain } of SITES) {
    proof(!original.allowedUrls.some(rule => matches(domain, rule)), 'SITE_EXPLICITLY_ALLOWED');
    proof(!original.blockedUrls.some(rule => matches(domain, rule)), 'PRE_REGISTERED_SITE_CANNOT_PROVE_CHARGE_BOUNDARY');
  }
  async function enroll(domain) {
    addedRules.push(domain);
    changedGoals.add(domain);
    await goal(domain, 0, 'enroll');
    const request = { action: MESSAGE_ACTIONS.GET_SETTINGS,
      keys: ['blockedUrls', 'allowedUrls', 'siteGoals', 'siteRuleTimeline', 'filteringMode', 'dataCollectionMode'] };
    const enrolled = await sendGoalQaAcknowledgedCommand({ request, send, record,
      requireAcknowledgement: reply => proof(reply?.success === true && Array.isArray(reply.settings?.blockedUrls)
        && reply.settings.blockedUrls.includes(domain), 'REGISTERED_POLICY_REQUIRED'),
      context: { runId: plan.runId, operation: 'enroll_readback', domain } });
    await record(`registered_policy_readback_${domain}`, enrolled);
  }
  async function until(label, read, accept, { timeout = 190_000, input = null } = {}) {
    const deadline = Date.now() + timeout;
    let value;
    let inputAt = 0;
    do {
      signal?.throwIfAborted();
      value = await read();
      if (accept(value)) return record(label, value);
      if (input && Date.now() - inputAt >= 4500) { await input(); inputAt = Date.now(); }
      await sleep(700);
    } while (Date.now() < deadline);
    await record(`${label}_timeout`, value);
    throw new Error(`QA_GOAL_END_REAL_SITE_TIMEOUT:${label}`);
  }
  const pages = [];
  const ownedSites = new Map();
  async function playSiteMedia(page) {
    const media = await until(functional ? 'functional_site_media_playing' : 'ordinary_site_media_playing', async () => {
      const result = await harness.cdp.send('Runtime.evaluate', {
        expression: `(async () => {
          const candidates = [...document.querySelectorAll('video')].map(media => {
            const rect = media.getBoundingClientRect();
            return { media, area: Math.max(0, Math.min(innerWidth, rect.right) - Math.max(0, rect.left))
              * Math.max(0, Math.min(innerHeight, rect.bottom) - Math.max(0, rect.top)) };
          }).filter(value => value.area > 0).sort((a, b) => b.area - a.area);
          if (!candidates.length) return { available: false };
          const media = candidates[0].media;
          media.muted = false; media.volume = 1;
          try { await media.play(); }
          catch (error) { return { available: true, playing: false, error: error.name }; }
          return { available: true, playing: !media.paused && !media.ended,
            readyState: media.readyState, muted: media.muted, volume: media.volume };
        })()`, awaitPromise: true, returnByValue: true, userGesture: true,
      }, page.sessionId);
      proof(!result.exceptionDetails, 'MEDIA_PLAY_EVALUATION_FAILED');
      return result.result.value;
    }, value => value.playing && value.readyState >= 2 && !value.muted && value.volume > 0,
    { timeout: 20_000 });
    if (functional) return record('functional_media_prepared', { ...media, hostAudioPolicy: 'muted',
      naturalCollectionCertified: false, physicalForegroundCertified: false });
    const native = await harness.evaluateInTrustedPage(`new Promise(resolve => {
      let settled = false;
      const finish = value => { if (!settled) { settled = true; clearTimeout(timer); resolve(value); } };
      const timer = setTimeout(() => finish({ idleError: 'native_idle_query_timeout' }), 5000);
      chrome.tabs.get(${page.tabId}, tab => {
        const tabError = chrome.runtime.lastError?.message;
        try {
          chrome.idle.queryState(60, idleState => finish({ tabError, idleError: chrome.runtime.lastError?.message,
            tabId: tab?.id, active: tab?.active, audible: tab?.audible, muted: tab?.mutedInfo?.muted, idleState }));
        } catch (error) { finish({ tabError, idleError: error.name }); }
      });
    })`);
    await record('ordinary_media_recording_basis', { ...native, hostAudioPolicy: 'muted',
      idleStateInjected: false, physicalForegroundCertified: false });
    proof(!native.tabError && !native.idleError && native.tabId === page.tabId && native.active
      && (native.idleState === 'active' || (native.idleState === 'idle' && native.audible === true)),
    'RECORDING_SOURCE_UNAVAILABLE');
  }
  async function open(site, { startDebugger = true } = {}) {
    const page = await harness.openPage(site.url, { active: true });
    pages.push(page);
    ownedSites.set(page.tabId, site);
    await harness.activateOwnedEphemeralPageWithoutWindowFocus(page);
    await record(`opened_${site.domain}`, { tabId: page.tabId, processOwnership: 'owned', headless: true });
    if (startDebugger) await sendRuntimeDebuggerAutomationAction(harness, page, DEBUG.START, { captureKind: 'live' });
    if (!functional) {
      const tracking = await record(`ordinary_tracking_admission_${site.domain}`,
        await collectTrackingRuntimeEvidence(harness, page));
    // Headless target activation is not production foreground admission. Do not
    // spend a recording tick or mutate the clock when its source is unavailable.
    proof(tracking.availability === 'measured' && tracking.lastActiveTabId === page.tabId
      && Number.isInteger(tracking.focusedWindowId) && tracking.focusedWindowId >= 0,
    'RECORDING_SOURCE_UNAVAILABLE');
    }
    await playSiteMedia(page);
    return page;
  }
  async function execution(page, label) {
    const nativeDocument = await evaluate(harness.cdp, page.sessionId,
      '({visible:document.visibilityState === "visible", hidden:document.hidden, readyState:document.readyState})');
    proof(nativeDocument.visible && !nativeDocument.hidden && nativeDocument.readyState === 'complete', 'NATIVE_DOCUMENT_UNAVAILABLE');
    return record(label, { ...nativeDocument, headless: true, physicalForegroundCertified: false });
  }
  const wheel = page => harness.cdp.send('Input.dispatchMouseEvent', { type: 'mouseWheel', x: 460, y: 360,
    deltaX: 0, deltaY: 320 }, page.sessionId);
  async function facts(domain, { protectedSite = true } = {}) {
    const reply = await send({ action: MESSAGE_ACTIONS.GET_SITES_SNAPSHOT });
    const snapshot = reply?.sitesSnapshot;
    const entry = snapshot?.siteRegistry?.byDomain?.[domain];
    const budget = entry?.protectionBudget;
    proof(reply?.success === true && snapshot.recording.globalCapAvailable === true
      && Number.isSafeInteger(snapshot.totalExposure) && snapshot.totalExposure >= 0
      && snapshot.registryDay?.basis === 'activity-day'
      && typeof snapshot.registryDay.range?.startDateStr === 'string', 'RECORDED_FACTS_REQUIRED');
    if (!protectedSite && entry === undefined) return { status: 'unobserved',
      dateStr: snapshot.registryDay.range.startDateStr, hostname: domain, globalActiveMs: snapshot.totalExposure };
    proof(entry?.recording?.enabled === true && Number.isSafeInteger(entry.usage?.observedMs)
      && entry.usage.observedMs >= 0, 'OBSERVED_FACTS_REQUIRED');
    proof(protectedSite ? entry.type === 'blocked' && Number.isSafeInteger(budget?.chargedMs)
      && budget.chargedMs >= 0 && Number.isSafeInteger(budget.goalMs)
      : entry.type === 'tracked' && budget === null, 'PROTECTION_FACTS_REQUIRED');
    return { dateStr: snapshot.registryDay.range.startDateStr, hostname: domain,
      status: 'observed', protected: protectedSite,
      siteActiveMs: protectedSite ? budget.chargedMs : null, siteTargetMs: protectedSite ? budget.goalMs : null,
      siteObservedMs: entry.usage.observedMs, globalActiveMs: snapshot.totalExposure };
  }
  async function runtimeState(page) {
    const requestId = `goal-read:${randomUUID()}`;
    const reply = await send({ channel: SENTINEL_PROTOCOL_QA_CHANNEL, action: SENTINEL.READ_GOAL_STATE,
      requestId, targetTabId: page.tabId, payload: {} });
    proof(reply?.success === true && reply.requestId === requestId, `PASSIVE_STATE:${reply?.error}`);
    return requireGoalEndQaObservation(reply.result);
  }
  const state = async page => (await runtimeState(page)).goalEndState;
  const latestFeedPayload = new Map();
  const feedOwnerStatuses = new Map();
  const latestObservationIdentity = new Map();
  async function readObservationIdentity(page) {
    const site = ownedSites.get(page.tabId);
    proof(pages.includes(page) && site !== undefined, 'SNAPSHOT_OWNED_TAB_REQUIRED');
    const readNative = () => evaluate(harness.cdp, page.sessionId,
      '({ timeOrigin: performance.timeOrigin, origin: location.origin, hostname: location.hostname, pathname: location.pathname })');
    const native = await readNative();
    const diagnostics = await send({ action: MESSAGE_ACTIONS.DEBUG_GET_CONTENT_RUNTIME_DIAGNOSTICS,
      targetTabId: page.tabId, limit: 1 });
    const session = diagnostics?.snapshot?.currentSession;
    proof(diagnostics?.success === true && session?.status === 'active' && session.tabId === page.tabId
      && typeof session.documentId === 'string' && session.documentId.length > 0
      && typeof session.sessionKey === 'string' && session.sessionKey.length > 0
      && typeof session.url === 'string', 'SNAPSHOT_CANONICAL_DOCUMENT_REQUIRED');
    const sessionUrl = new URL(session.url);
    const route = resolveFeedSurfaceRoute(native);
    const identity = { status: session.status, tabId: page.tabId, documentId: session.documentId, sessionKey: session.sessionKey,
      timeOrigin: native.timeOrigin, origin: native.origin, hostname: normalizeSiteHostname(native.hostname),
      semanticSurfaceId: route.semanticSurfaceId, routeFamily: route.routeFamily, surfaceMode: route.surfaceMode };
    const sameSurface = location => {
      const surface = resolveFeedSurfaceRoute(location);
      return location.origin === native.origin && normalizeSiteHostname(location.hostname) === site.domain
        && surface.semanticSurfaceId === route.semanticSurfaceId && surface.routeFamily === route.routeFamily
        && surface.surfaceMode === route.surfaceMode;
    };
    const after = await readNative();
    proof(identity.hostname === site.domain && sameSurface(sessionUrl) && sameSurface(after)
      && after.timeOrigin === native.timeOrigin, 'SNAPSHOT_NATIVE_DOCUMENT_CHANGED');
    assertSameGoalDebuggerDocument(identity, identity);
    return identity;
  }
  async function sample(page) {
    const payload = await readGoalQaDebuggerSnapshot({
      readSnapshot: async () => getAutomationPayload(await sendRuntimeDebuggerAutomationAction(harness, page, DEBUG.SNAPSHOT)),
      readIdentity: () => readObservationIdentity(page), previous: latestObservationIdentity.get(page.tabId), record,
    });
    const flow = readFeedSnapshot(payload);
    const feed = readGoalFeedObservation(flow);
    if (feedOwnerStatuses.get(page.tabId) !== feed.ownerStatus) {
      feedOwnerStatuses.set(page.tabId, feed.ownerStatus);
      await record(`feed_owner_readiness_${page.tabId}`, { ...feed,
        semantic: flow.semantic, observation: flow.observation });
    }
    const dom = await evaluate(harness.cdp, page.sessionId, `(() => ({
      visible: document.visibilityState === 'visible', timeOrigin: performance.timeOrigin,
      furin: !!document.getElementById('friction-nudge-root'),
      wind: !!document.getElementById('friction-nudge-root')?.shadowRoot?.getElementById('nudgeFurinWind'),
      gate: !!document.getElementById('enso-gate-root'),
      feedEndpoint: ['entropy-feed-terminus', 'entropy-feed-endpoint-marker', 'entropy-feed-endpoint-tail',
        'entropy-feed-endpoint-quarantine'].some(id => document.getElementById(id) !== null),
    }))()`);
    const committed = await runtimeState(page);
    const observationIdentity = { document: await readObservationIdentity(page),
      capture: { startedAt: payload.session?.startedAt, captureKind: payload.session?.captureKind } };
    proof(observationIdentity.document.timeOrigin === dom.timeOrigin, 'SNAPSHOT_NATIVE_DOCUMENT_CHANGED');
    assertSameGoalDebuggerCapture(observationIdentity.capture, observationIdentity.capture);
    latestFeedPayload.set(page.tabId, payload);
    latestObservationIdentity.set(page.tabId, observationIdentity);
    return { at: Date.now(), goalEndState: committed.goalEndState,
      interventionExposure: committed.interventionExposure, feed,
      goalEntry: feed.goalEntry, endpoint: feed.endpoint, dom, observationIdentity };
  }
  const capture = async (page, name) => {
    const file = path.join(attachmentsDir, `${name}.png`);
    const image = await harness.cdp.send('Page.captureScreenshot', { format: 'png', fromSurface: true }, page.sessionId);
    await fs.writeFile(file, Buffer.from(image.data, 'base64'));
    return file;
  };
  async function mediaInventory(page) {
    const location = await evaluate(harness.cdp, page.sessionId, '({ hostname: location.hostname, pathname: location.pathname })');
    const profile = getFeedSurfaceProfile(location.hostname);
    const route = resolveFeedSurfaceRoute(location);
    const selectors = Object.hasOwn(route, 'candidateItemSelectors') ? route.candidateItemSelectors : profile.candidateItemSelectors;
    const inventory = await evaluate(harness.cdp, page.sessionId,
      `(${collectGoalBoundaryMediaInventory.toString()})(document, ${JSON.stringify(selectors)})`);
    return { profileId: profile.id, route, candidateItemSelectors: selectors, inventory };
  }
  async function readyBoundary(page, label, kind) {
    const startedAt = Date.now();
    const hostname = normalizeSiteHostname(await evaluate(harness.cdp, page.sessionId, 'location.hostname'));
    const site = ownedSites.get(page.tabId);
    let nativeAdvanceIndex = 0;
    const nativeAdvance = () => runGoalQaTikTokBoundaryAdvance({ harness, page, index: nativeAdvanceIndex++, record,
      readMedia: async () => {
        const native = await mediaInventory(page);
        return { profileId: native.profileId, route: native.route, documentVisible: native.inventory.documentVisible,
          media: native.inventory.media.filter(value => value.tag === 'video')
            .map(({ closestCandidate, rect, visibility, playback }) => ({ closestCandidate, rect, visibility, playback })) };
      } });
    return until(label, async () => {
      const value = await sample(page);
      try { assertGoalPreludePending(value.goalEndState, { goalEntry: value.goalEntry, finalPresented: value.dom.furin }); }
      catch (error) {
        error.details = { sample: value };
        try { await record(`${label}_prelude_owner_inconsistent`, value); }
        catch (diagnosticError) {
          throw new AggregateError([error, diagnosticError], 'QA_GOAL_END_REAL_SITE_BOUNDARY_EVIDENCE_INCOMPLETE', { cause: error });
        }
        throw error;
      }
      const refusal = readNewGoalPrimaryMediaRefusal(value.goalEndState, { startedAt, hostname, tabId: page.tabId });
      if (refusal !== null) {
        const error = new Error('QA_GOAL_END_REAL_SITE_PRIMARY_MEDIA_BOUNDARY_UNPROVEN');
        error.code = error.message;
        error.stage = 'goal_boundary';
        try {
          await record(`${label}_primary_media_refused`, { refusal, sample: value });
          await record(`${label}_primary_media_inventory`, await mediaInventory(page));
        } catch (diagnosticError) {
          throw new AggregateError([error, diagnosticError], 'QA_GOAL_END_REAL_SITE_BOUNDARY_EVIDENCE_INCOMPLETE', { cause: error });
        }
        throw error;
      }
      return value;
    }, value => value.goalEntry?.kind === kind
      && typeof value.goalEntry.leaseId === 'string' && value.endpoint.armed,
    { input: site?.siteId === 'tiktok' ? nativeAdvance : () => wheel(page) });
  }
  async function encounter(page, label, runId) {
    return until(label, () => sample(page), value => value.goalEntry?.runId === runId
      && value.goalEntry.boundaryAcknowledged === true, { input: () => wheel(page), timeout: 90_000 });
  }
  async function continueHorizon(page, site, entry, label) {
    const identity = { runId: entry.goalEntry.runId, leaseId: entry.goalEntry.leaseId };
    await until(`${label}_controls_ready`, () => sample(page), value => isGoalHorizonContinuationReady(value, identity), { timeout: 30_000 });
    // End the arrival gesture after actual readiness. A new native forward
    // action supplies the production pull threshold; polling cannot supply it.
    await sleep(HORIZON_WHEEL_QUIET_MS + 50);
    const ready = await record(`${label}_fresh_input_ready`, await sample(page));
    proof(isGoalHorizonContinuationReady(ready, identity), 'CONTINUATION_STATE_CHANGED');
    assertGoalPreludePending(ready.goalEndState, { goalEntry: ready.goalEntry, finalPresented: ready.dom.furin });
    const action = await runTrustedEndpointForwardStep({ harness, page,
      scenario: { siteId: site.siteId, feedConsumption: { surfaceMode: 'paged' } },
      index: 0, dwellMs: 100, phase: 'demand' });
    await record(`${label}_fresh_forward_input`, { ...identity, action });
    proof(action.status === 'performed' && action.trustedInput === true && action.inputKind === 'wheel'
      && Number.isFinite(action.deltaY) && action.deltaY > 0, 'CONTINUATION_NATIVE_INPUT_REQUIRED');
  }
  async function cancel(page, domain, entry, minutes, label) {
    proof(entry.goalEntry !== null && entry.dom.visible && !entry.dom.furin, 'CANCEL_PRECONDITION');
    const runId = entry.goalEntry.runId;
    const pending = Object.values(entry.goalEndState.pending).find(value => value.runId === runId);
    proof(pending?.goalBinding?.key, 'EXACT_CANCELLATION_BINDING');
    await goal(domain, minutes);
    const cancelled = await until(label, () => sample(page), value => value.goalEntry === null
      && value.feed.ownerStatus !== 'owner_unloaded'
      && !value.dom.furin && !value.dom.feedEndpoint
      && !Object.values(value.goalEndState.pending).some(item => item.runId === runId), { timeout: 25_000 });
    proof(cancelled.dom.visible && cancelled.dom.timeOrigin === entry.dom.timeOrigin, 'CANCELLATION_VISIBILITY_CAUSE');
    assertGoalRunCancelled(cancelled.goalEndState, { key: pending.goalBinding.key, runId, reason: 'goal_values_changed' });
    return cancelled;
  }
  async function waitWithoutDelivery(page, untilAt, label) {
    while (Date.now() < untilAt) {
      signal?.throwIfAborted();
      const value = await sample(page);
      proof(value.dom.visible && value.goalEntry?.leaseId == null && !value.dom.furin && !value.dom.feedEndpoint
        && (value.feed.ownerStatus === 'owner_unloaded' ? value.endpoint === null : !value.endpoint.active),
      'RECOVERY_AUTOPRESENTED');
      await sleep(Math.min(1000, Math.max(1, untilAt - Date.now())));
    }
    return record(label, await sample(page));
  }
  try {
    // Record ordinary use before protection registration. These historical
    // observations remain visible but cannot become a newly enabled cap charge.
    const secondary = await open(SITES[1], { startDebugger: false });
    if (functional) await charge(SITES[1].domain, MINUTE, 0, 'functional_pre_registration_observation_fixture');
    const beforeRegistration = await until(functional ? 'secondary_fixture_use_before_registration' : 'secondary_real_use_before_registration',
      () => facts(SITES[1].domain, { protectedSite: false }), value =>
        value.status === 'observed' && value.siteObservedMs >= MINUTE);
    proof(beforeRegistration.globalActiveMs === 0, 'UNPROTECTED_USAGE_CHARGED_GLOBAL');
    await enroll(SITES[1].domain);
    const secondaryStart = await facts(SITES[1].domain);
    assertRegistrationDoesNotRetrocharge(beforeRegistration, secondaryStart);
    await record('registration_excludes_prior_observation', { beforeRegistration, registered: secondaryStart });
    await sendRuntimeDebuggerAutomationAction(harness, secondary, DEBUG.START, { captureKind: 'live' });
    if (functional) await charge(SITES[1].domain, MINUTE, MINUTE, 'functional_post_registration_charge_fixture');
    const firstChargedTick = await until(functional ? 'first_controlled_post_registration_charge' : 'first_ordinary_post_registration_charge', () => facts(SITES[1].domain),
      value => value.siteObservedMs > secondaryStart.siteObservedMs, { timeout: 90_000 });
    assertProtectedChargeAdvanced(secondaryStart, firstChargedTick);
    await until(functional ? 'secondary_controlled_charged_minute' : 'secondary_real_recorded_minute', async () => {
      const current = await facts(SITES[1].domain);
      if (current.siteObservedMs - secondaryStart.siteObservedMs >= MINUTE) {
        await record('post_registration_attainment_basis', { initial: secondaryStart, current });
        proof(current.siteActiveMs - secondaryStart.siteActiveMs >= MINUTE, 'POST_REGISTRATION_CHARGE_DIVERGENCE');
        assertProtectedChargeAdvanced(secondaryStart, current, MINUTE);
      }
      return current;
    }, value =>
      value.siteActiveMs - secondaryStart.siteActiveMs >= MINUTE);
    await execution(secondary, 'secondary_execution');
    await enroll(SITES[0].domain);
    const primary = await open(SITES[0]);
    let currentFacts = await facts(SITES[0].domain);
    const initialState = await state(primary);
    const daily = initialState.dailyReceipt;
    if (daily !== null && daily.dateStr === currentFacts.dateStr
      && (daily.global !== null || Object.hasOwn(daily.siteEnds, SITES[0].domain) || Object.hasOwn(daily.siteEnds, SITES[1].domain))) {
      return { status: 'BLOCKED', ...fixtureScope,
        reason: 'existing_actual_goal_receipt_preserved', dateStr: currentFacts.dateStr };
    }
    const siteMinutes = nextNaturalGoalMinutes(currentFacts.siteActiveMs);
    proof(siteMinutes < 478, 'DAY_BUDGET_TOO_LARGE');
    await goal(SITES[0].domain, siteMinutes);
    await settings({ nudgeConfig: preferences(true, true) });
    if (functional) {
      const outstanding = siteMinutes * MINUTE - (await facts(SITES[0].domain)).siteActiveMs;
      if (outstanding > 0) await charge(SITES[0].domain, outstanding, outstanding, 'functional_primary_attainment_fixture');
    }
    currentFacts = await until(functional ? 'primary_fixture_goal_attained' : 'primary_natural_goal_attained', () => facts(SITES[0].domain), value =>
      value.siteActiveMs >= siteMinutes * MINUTE);
    let entry = await readyBoundary(primary, 'site_horizon_attached_barrier_off', 'site_furin');
    proof(entry.goalEntry.boundaryAcknowledged === false && !entry.dom.furin && !entry.dom.gate, 'PRE_ENCOUNTER_REQUIRED');
    assertNoFinalGoalReceipt(entry.goalEndState, { dateStr: currentFacts.dateStr, runId: entry.goalEntry.runId });
    const globalMinutes = Math.floor(currentFacts.globalActiveMs / MINUTE);
    proof(globalMinutes >= 1 && globalMinutes <= 478, 'ACTUAL_GLOBAL_MINUTE_REQUIRED');
    await settings({ globalGoal: globalMinutes });
    const stillSite = await record('global_attained_preserves_site_owner', await sample(primary));
    proof(stillSite.goalEntry?.runId === entry.goalEntry.runId && stillSite.goalEntry.leaseId === entry.goalEntry.leaseId
      && stillSite.goalEntry.kind === 'site_furin' && !stillSite.dom.furin, 'GLOBAL_STOLE_SITE_PRELUDE');
    await settings({ nudgeConfig: preferences(true, false) });
    await cancel(primary, SITES[0].domain, stillSite, siteMinutes + 2, 'goal_increase_cancel_before_encounter');
    await goal(SITES[0].domain, siteMinutes);
    entry = await readyBoundary(primary, 'fresh_site_horizon_after_cancel', 'site_furin');
    entry = await encounter(primary, 'site_horizon_encountered', entry.goalEntry.runId);
    await capture(primary, 'site-horizon-before-cancellation');
    assertNoFinalGoalReceipt(entry.goalEndState, { dateStr: currentFacts.dateStr, runId: entry.goalEntry.runId });
    proof(!entry.dom.furin && !entry.dom.gate, 'PASSIVE_HORIZON_STARTED_FINAL');
    await cancel(primary, SITES[0].domain, entry, siteMinutes + 2, 'goal_increase_cancel_after_encounter');
    await settings({ nudgeConfig: preferences(false, false) });
    await goal(SITES[0].domain, siteMinutes);
    await settings({ nudgeConfig: preferences(true, true), globalGoal: globalMinutes });
    entry = await readyBoundary(primary, 'fresh_combined_horizon', 'global_sentinel');
    entry = await encounter(primary, 'combined_horizon_encountered', entry.goalEntry.runId);
    const beforeCombined = entry.goalEndState;
    const combinedRunId = entry.goalEntry.runId;
    assertNoFinalGoalReceipt(beforeCombined, { dateStr: currentFacts.dateStr, runId: combinedRunId });
    await capture(primary, 'combined-horizon');
    await continueHorizon(primary, SITES[0], entry, 'combined_horizon_continue');
    const combined = await until('actual_combined_global_furin', () => sample(primary), value =>
      value.dom.furin && value.goalEndState.dailyReceipt?.global?.runId === combinedRunId, { timeout: 30_000 });
    currentFacts = await facts(SITES[0].domain);
    assertCombinedGoalReceipt(beforeCombined, combined.goalEndState, { ...currentFacts, runId: combinedRunId,
      siteTargetMs: siteMinutes * MINUTE, globalTargetMs: globalMinutes * MINUTE });
    await capture(primary, 'actual-combined-global-furin');
    // Editing an already-delivered goal preserves its actual receipt. Explicit
    // policy OFF then ends the experience; Global gameplay is outside this QA.
    await settings({ globalGoal: globalMinutes + 2 });
    const afterPaintEdit = await record('goal_change_after_paint_preserves_receipt', await sample(primary));
    assertSameHostGoalReceiptUnchanged(combined.goalEndState, afterPaintEdit.goalEndState,
      { dateStr: currentFacts.dateStr, hostname: SITES[0].domain });
    proof(afterPaintEdit.goalEndState.dailyReceipt.global.runId === combinedRunId
      && afterPaintEdit.goalEndState.dailyReceipt.global.presentedAt === combined.goalEndState.dailyReceipt.global.presentedAt,
    'POST_PAINT_GLOBAL_RECEIPT_CHANGED');
    await settings({ nudgeConfig: preferences(false, false) });
    const globalEnded = await until('explicit_policy_off_ends_presented_global', () => sample(primary), value =>
      !value.dom.furin && value.goalEntry === null
      && value.feed.ownerStatus !== 'owner_unloaded'
      && readGoalEpisodeEndFromExposure(value.interventionExposure,
        combined.goalEndState.dailyReceipt.global.presentedAt) !== null, { timeout: 25_000 });
    assertSameHostGoalReceiptUnchanged(combined.goalEndState, globalEnded.goalEndState,
      { dateStr: currentFacts.dateStr, hostname: SITES[0].domain });
    const endedAt = readGoalEpisodeEndFromExposure(globalEnded.interventionExposure,
      combined.goalEndState.dailyReceipt.global.presentedAt);
    await record('global_admission_end_acknowledged', { runId: combinedRunId,
      leaseId: entry.goalEntry.leaseId, presentedAt: combined.goalEndState.dailyReceipt.global.presentedAt, endedAt });
    await harness.activateOwnedEphemeralPageWithoutWindowFocus(secondary);
    await execution(secondary, 'secondary_execution_after_global');
    while (Date.now() < endedAt + 15_000) { signal?.throwIfAborted(); await sleep(700); }
    const secondaryFacts = await facts(SITES[1].domain);
    const laterMinutes = functional ? nextNaturalGoalMinutes(secondaryFacts.siteActiveMs)
      : Math.floor(secondaryFacts.siteActiveMs / MINUTE);
    proof(laterMinutes >= 1, 'LATER_SITE_ACTUAL_MINUTE_REQUIRED');
    await goal(SITES[1].domain, laterMinutes);
    await settings({ nudgeConfig: preferences(true, false) });
    if (functional) {
      const outstanding = laterMinutes * MINUTE - (await facts(SITES[1].domain)).siteActiveMs;
      if (outstanding > 0) await charge(SITES[1].domain, outstanding, outstanding, 'functional_later_site_attainment_fixture');
    }
    await record('near_site_goal_armed', { sinceGlobalEndMs: Date.now() - endedAt, facts: secondaryFacts, goalMinutes: laterMinutes });
    await waitWithoutDelivery(secondary, endedAt + 44_000, 'near_site_waits_during_recovery');
    await waitWithoutDelivery(secondary, endedAt + 47_000, 'recovery_expiry_does_not_autopresent');
    entry = await readyBoundary(secondary, 'later_site_horizon_after_fresh_input', 'site_furin');
    entry = await encounter(secondary, 'later_site_horizon_encountered', entry.goalEntry.runId);
    const beforeLater = entry.goalEndState;
    const laterRunId = entry.goalEntry.runId;
    await continueHorizon(secondary, SITES[1], entry, 'later_site_horizon_continue');
    const later = await until('actual_later_brief_site_furin', () => sample(secondary), value =>
      value.dom.wind && value.goalEndState.dailyReceipt?.sites?.[SITES[1].domain]?.runId === laterRunId, { timeout: 30_000 });
    assertLaterSiteAfterGlobalReceipt(beforeLater, later.goalEndState, { dateStr: secondaryFacts.dateStr,
      hostname: SITES[1].domain, runId: laterRunId });
    await capture(secondary, 'actual-later-brief-site-furin');
    const button = await until('site_continue_ready', () => evaluate(harness.cdp, secondary.sessionId, `(() => {
      const node = document.getElementById('friction-nudge-root')?.shadowRoot?.getElementById('nudgeFurinContinue');
      if (!node || node.disabled) return null;
      const rect = node.getBoundingClientRect(); return { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 };
    })()`), value => value !== null, { timeout: 12_000 });
    for (const type of ['mousePressed', 'mouseReleased']) await harness.cdp.send('Input.dispatchMouseEvent', {
      type, button: 'left', buttons: type === 'mousePressed' ? 1 : 0, clickCount: 1, ...button }, secondary.sessionId);
    await until('site_explicit_continue_completed', () => sample(secondary), value => !value.dom.furin, { timeout: 12_000 });
    await waitWithoutDelivery(secondary, Date.now() + 47_000, 'same_day_after_recovery_no_new_delivery');
    // Reload the same host/day. A fresh document/input cannot create a second
    // Site receipt. Keep both the pre-existing and current Global receipt.
    await harness.navigatePage(secondary, SITES[1].url);
    await sendRuntimeDebuggerAutomationAction(harness, secondary, DEBUG.START, { captureKind: 'live' });
    await wheel(secondary);
    await sleep(2500);
    const reloaded = await record('same_host_day_reload_no_duplicate', await sample(secondary));
    proof(reloaded.dom.visible && !reloaded.dom.furin && !reloaded.dom.feedEndpoint
      && reloaded.goalEntry === null, 'SAME_DAY_DUPLICATE_SURFACE');
    assertSameHostGoalReceiptUnchanged(later.goalEndState, reloaded.goalEndState,
      { dateStr: secondaryFacts.dateStr, hostname: SITES[1].domain });
    const sameHostTab = await open(SITES[1]);
    await wheel(sameHostTab);
    await sleep(2500);
    const anotherTab = await record('same_host_day_another_tab_no_duplicate', await sample(sameHostTab));
    proof(anotherTab.dom.visible && !anotherTab.dom.furin && !anotherTab.dom.feedEndpoint
      && anotherTab.goalEntry === null, 'ANOTHER_TAB_DUPLICATE_SURFACE');
    assertSameHostGoalReceiptUnchanged(later.goalEndState, anotherTab.goalEndState,
      { dateStr: secondaryFacts.dateStr, hostname: SITES[1].domain });
    return { status: 'PASS', protocol: functional ? 'goal_ends_functional' : 'goal_ends_real_site', artifactBuildId: artifact.buildId,
      ...fixtureScope,
      scenarios: ['pre_registration_usage_excluded_from_charge',
        functional ? 'controlled_post_registration_charge' : 'first_ordinary_post_registration_tick_charged',
        'barrier_off_horizon_before_furin', 'global_does_not_steal_site_prelude',
        'goal_increase_cancel_before_encounter', 'goal_increase_cancel_after_encounter',
        'actual_combined_global_site_receipt', 'post_paint_goal_edit_preserves_receipt',
        'near_site_recovery_then_brief_delivery', 'same_host_day_reload_no_duplicate', 'same_host_day_another_tab_no_duplicate'],
      limitations: [functional
        ? 'Controlled canonical V2 charge fixtures establish eligibility; collection, elapsed usage and human foreground are not certified.'
        : 'Near eligibility is arranged by real goal edits against actual recorded time; no natural 15-second clock threshold claim.',
        'Headless ordinary Tracking observations do not certify physical foreground or human consumption time.',
        'Later Site delivery proves an actual surface and the canonical brief receipt; private renderer configuration is not observed.',
        'Global gameplay completion and manual human experience quality are outside this target.'] };
  } catch (error) {
    protocolFailure = error;
    const diagnosticFailures = [];
    const recordFailure = async (label, value) => {
      try { await record(label, value); }
      catch (recordError) { diagnosticFailures.push(recordError); }
    };
    try { await record('failure_content_runtime_diagnostics_global', await send({
      action: MESSAGE_ACTIONS.DEBUG_GET_CONTENT_RUNTIME_DIAGNOSTICS, limit: 120 })); }
    catch (diagnosticError) { await recordFailure('failure_content_runtime_diagnostics_global_unavailable', { error: diagnosticError.message }); }
    try { await record('failure_sites_snapshot', await send({ action: MESSAGE_ACTIONS.GET_SITES_SNAPSHOT })); }
    catch (diagnosticError) { await recordFailure('failure_sites_snapshot_unavailable', { error: diagnosticError.message }); }
    for (let index = 0; index < pages.length; index += 1) {
      const tabId = pages[index].tabId;
      if (latestFeedPayload.has(tabId)) await recordFailure(`failure_feed_debugger_${index}`, latestFeedPayload.get(tabId));
      try { await record(`failure_content_runtime_diagnostics_${index}`, await send({
        action: MESSAGE_ACTIONS.DEBUG_GET_CONTENT_RUNTIME_DIAGNOSTICS, targetTabId: tabId, limit: 60 })); }
      catch (diagnosticError) { await recordFailure('failure_content_runtime_diagnostics_unavailable', { index, error: diagnosticError.message }); }
      try { await record(`failure_media_inventory_${index}`, await mediaInventory(pages[index])); }
      catch (diagnosticError) { await recordFailure('failure_media_inventory_unavailable', { index, error: diagnosticError.message }); }
      try { await record(`failure_tracking_${index}`, await send({ action: 'DEBUG_GET_TRACKING_RUNTIME_STATE' })); }
      catch (diagnosticError) { await recordFailure('failure_tracking_unavailable', { index, error: diagnosticError.message }); }
      try { await capture(pages[index], `failure-${index}`); }
      catch (captureError) { await recordFailure('failure_capture_unavailable', { index, error: captureError.message }); }
    }
    if (diagnosticFailures.length) {
      throw new AggregateError([error, ...diagnosticFailures], 'QA_GOAL_END_FAILURE_EVIDENCE_INCOMPLETE', { cause: error });
    }
    if (!functional && error.message === 'QA_GOAL_END_REAL_SITE_RECORDING_SOURCE_UNAVAILABLE') {
      return { status: 'BLOCKED', reason: 'ordinary_recording_source_unavailable',
        browserMode: 'owned_headless', noWindowOrFocusRetry: true,
        limitations: ['No goal delivery or cancellation assertion was reached; native target activation did not admit production Tracking.'] };
    }
    throw error;
  }
}
