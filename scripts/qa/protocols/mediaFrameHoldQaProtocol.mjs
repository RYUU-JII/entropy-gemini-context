import fs from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { ExtensionChromiumHarness, evaluate, sleep } from '../../e2e/extensionChromiumHarness.mjs';
import { ENTROPY_QA_TRUSTED_PAGE_PATH } from '../../e2e/qaProfileArtifactSlot.mjs';
import { sendTrustedRuntimeMessage } from './gateRuntimeQaProtocol.mjs';
import { requireConsumptionQaSettingsAcknowledgement } from './consumptionEntryQaProtocol.mjs';
import { summarizeSentinelQaSnapshot } from './sentinelProtocolQaProtocol.mjs';
import { MESSAGE_ACTIONS, MESSAGE_TYPES } from '../../../src/platform/messaging/messageTypes.js';
import { DEFAULT_GATE_CONFIG } from '../../../src/domains/settings/config/gateConfig.js';
import { DEFAULT_NUDGE_SETTINGS } from '../../../src/domains/settings/config/nudgeConfig.js';
import { SENTINEL_PROTOCOL_QA_ACTIONS as SENTINEL, SENTINEL_PROTOCOL_QA_CHANNEL } from '../../../src/domains/nudge/runtime/automation/sentinelProtocolQaAutomationContract.dev.js';
import { createMediaFrameHoldFixture, MEDIA_FRAME_HOLD_HOSTS, MEDIA_FRAME_HOLD_PATTERNS,
  requireNativeFrameMediaEvidence } from './mediaFrameHoldFixture.mjs';

function requireProof(condition, code) { if (!condition) throw new Error(`QA_MEDIA_FRAME_HOLD_${code}`); }

const PROBE_COST_COUNTERS = ['fullDocumentScanCount', 'visitedNodeCount', 'incrementalSubtreeScanCount',
  'mutationBatchCount', 'mutationAddedRootCount', 'collapsedMutationRootCount', 'removalPruneCount',
  'inventoryRevision', 'readyMessageCount', 'beginCommandCount', 'renewCommandCount'];

export function requireFrameProbeCostEvidence(before, after, stage) {
  requireProof(['add', 'remove', 'renew'].includes(stage), 'PROBE_COST_STAGE_INVALID');
  requireProof(Array.isArray(before) && before.length === 2 && Array.isArray(after) && after.length === 2,
    'PROBE_COST_FRAMES_REQUIRED');
  requireProof(new Set(after.map(frame => frame.frameId)).size === 2
    && new Set(after.map(frame => new URL(frame.origin).hostname)).size === 2, 'PROBE_COST_FRAME_IDENTITY');
  return after.map(frame => {
    const previous = before.find(item => item.frameId === frame.frameId);
    requireProof(previous && previous.documentId === frame.documentId && previous.instanceId === frame.instanceId
      && frame.origin === previous.origin && MEDIA_FRAME_HOLD_HOSTS.slice(1).includes(new URL(frame.origin).hostname),
    'PROBE_COST_FRAME_IDENTITY');
    requireProof(frame.probe?.active === true && frame.probe.version === 5 && frame.probe.observationError === null
      && frame.probe.audioCount === 1 && frame.probe.videoCount === (stage === 'add' ? 2 : 1), 'PROBE_COST_INVENTORY');
    const delta = {};
    for (const key of PROBE_COST_COUNTERS) {
      requireProof(Number.isSafeInteger(frame.probe[key]) && Number.isSafeInteger(previous.probe?.[key])
        && frame.probe[key] >= previous.probe[key], 'PROBE_COST_COUNTER_INVALID');
      delta[key] = frame.probe[key] - previous.probe[key];
    }
    requireProof(delta.fullDocumentScanCount === 0, 'PROBE_COST_FULL_RESCAN');
    if (stage === 'add') {
      requireProof(delta.mutationBatchCount === 1 && delta.mutationAddedRootCount === 11
        && delta.collapsedMutationRootCount === 10 && delta.incrementalSubtreeScanCount === 1
        && delta.visitedNodeCount === 11 && delta.inventoryRevision > 0, 'PROBE_COST_OVERLAPPING_ADDITION');
    } else if (stage === 'remove') {
      requireProof(delta.mutationBatchCount === 1 && delta.removalPruneCount === 1
        && delta.incrementalSubtreeScanCount === 0 && delta.visitedNodeCount === 0
        && delta.inventoryRevision > 0, 'PROBE_COST_REMOVAL_RESCAN');
    } else {
      requireProof(delta.renewCommandCount === 1 && delta.beginCommandCount === 0
        && delta.readyMessageCount >= 1 && delta.inventoryRevision === 0
        && delta.visitedNodeCount === 0, 'PROBE_COST_DUPLICATE_HOLD_COMMAND');
    }
    return { frameId: frame.frameId, documentId: frame.documentId, instanceId: frame.instanceId, stage, delta };
  });
}

export function requireFrameHoldSupport(snapshot, stage) {
  requireProof(snapshot?.version === 1 && Array.isArray(snapshot.frames) && Array.isArray(snapshot.requiredOrigins)
    && Number.isInteger(snapshot.activeHolds) && ['known_frames', 'unknown'].includes(snapshot.coverage), 'SUPPORT_SHAPE');
  requireProof(snapshot.frames.every(frame => frame.seek === 'unsupported'), 'FRAME_SEEK_OVERCLAIM');
  if (stage === 'held') {
    const childFrames = snapshot.frames.filter(frame => frame.status !== 'managed_by_top');
    requireProof(snapshot.activeHolds > 0 && snapshot.coverage === 'known_frames'
      && snapshot.status === 'applied' && childFrames.length >= 2
      && childFrames.every(frame => frame.pause === 'supported' && frame.resume === 'supported'
        && Number.isInteger(frame.frameId) && frame.frameId > 0 && typeof frame.documentId === 'string' && frame.documentId.length > 0
        && frame.status === 'held' && frame.commandAccepted === true && frame.verifiedPaused === true
        && frame.observedCount >= 2 && frame.failedCount === 0), 'HOLD_EFFECT_UNVERIFIED');
  } else if (stage === 'revoked') {
    requireProof(snapshot.activeHolds > 0 && snapshot.coverage === 'known_frames' && snapshot.status === 'partial'
      && snapshot.frames.some(frame => frame.status === 'permission_required' && frame.pause === 'unavailable')
      && snapshot.frames.some(frame => frame.status === 'held' && frame.verifiedPaused === true)
      && snapshot.requiredOrigins.some(origin => new URL(origin).hostname === MEDIA_FRAME_HOLD_HOSTS[2]),
    'REVOCATION_UNREPORTED');
  } else if (stage === 'resumed') {
    requireProof(snapshot.activeHolds === 0 && snapshot.frames.length >= 2
      && snapshot.frames.every(frame => frame.status === 'released' && frame.commandAccepted === true
        && frame.resumedCount === 2 && frame.resumeFailedCount === 0), 'RESUME_EFFECT_UNVERIFIED');
  } else if (stage === 'released') {
    requireProof(snapshot.activeHolds === 0, 'STALE_HOLD_RETAINED');
  } else throw new Error('QA_MEDIA_FRAME_HOLD_SUPPORT_STAGE_INVALID');
  return snapshot;
}

// Chrome's actual site-access UI backend is used only in the disposable harness.
// No permission API, receiver, media method, response, or clock is replaced.
export async function configureMediaFrameHoldPermissions(harness, { revokeNested = false } = {}) {
  requireProof(harness.attachOnly === false && harness.ownedBrowserIdentityVerified === true,
    'PERMISSIONS_DISPOSABLE_BROWSER_REQUIRED');
  await harness.withExtensionManagementPage(page => evaluate(harness.cdp, page.sessionId, `(async () => {
    if (location.href !== 'chrome://extensions/') throw new Error('QA_FRAME_PERMISSION_PAGE_INVALID');
    const extensionId = ${JSON.stringify(harness.extensionId)};
    const patterns = ${JSON.stringify(MEDIA_FRAME_HOLD_PATTERNS)};
    if (${revokeNested}) {
      await chrome.developerPrivate.removeHostPermission(extensionId, patterns[2]);
    } else {
      await chrome.developerPrivate.updateExtensionConfiguration({ extensionId, hostAccess: 'ON_SPECIFIC_SITES' });
      for (const host of patterns) await chrome.developerPrivate.addHostPermission(extensionId, host);
    }
    return { configured: true };
  })()`, { timeoutMs: 10_000 }));
  const permissions = await harness.evaluateInTrustedPage(`Promise.all(${JSON.stringify(MEDIA_FRAME_HOLD_PATTERNS)}
    .map(async origin => ({ origin, granted: await chrome.permissions.contains({ origins: [origin] }) })))`);
  requireProof(permissions.length === 3 && permissions.every((entry, index) =>
    entry.granted === !(revokeNested && index === 2)), 'PERMISSIONS_NOT_APPLIED');
  return permissions;
}

export async function executeQaProtocol({ plan, artifact, browser, evidence, attachmentsDir,
  registerCleanup, reportBrowserGpuCapability, signal, recoveryJournal }) {
  requireProof(artifact.id === 'dev_extension' && browser.processOwnership === 'owned', 'OWNED_DEV_REQUIRED');
  const fixture = await createMediaFrameHoldFixture();
  registerCleanup('media_frame_fixture', fixture.close);
  const harness = new ExtensionChromiumHarness({ chromePath: browser.chrome, distDir: artifact.path,
    rootDir: plan.rootDir, headless: plan.browserExecution.headless, browserExecution: plan.browserExecution,
    audioPolicy: plan.browserExecution.audioPolicy, launchEnvironment: browser.launchEnvironment,
    renderingRequirement: plan.browserExecution.renderingRequirement, keepTemp: false,
    temporaryManifest: { requiredPermissions: ['scripting'], requiredHostPermissions: MEDIA_FRAME_HOLD_PATTERNS },
    trustedPagePath: ENTROPY_QA_TRUSTED_PAGE_PATH, tempPrefix: 'entropy-media-frame-', recoveryJournal });
  registerCleanup('media_frame_browser', () => harness.close());
  await harness.start(); await reportBrowserGpuCapability(harness.gpuCapability);
  const trace = [];
  registerCleanup('media_frame_trace', async () => {
    await fs.writeFile(path.join(attachmentsDir, 'media-frame-hold.json'), JSON.stringify({ schemaVersion: 1, trace }, null, 2));
    return { samples: trace.length };
  });
  async function record(label, value) {
    trace.push({ label, value }); await evidence.event('QA_MEDIA_FRAME_HOLD_BOUNDARY', { label, value });
    console.log(JSON.stringify({ event: 'QA_MEDIA_FRAME_HOLD_PROGRESS', label })); return value;
  }
  async function until(label, read, accept, timeoutMs = 20_000) {
    const deadline = Date.now() + timeoutMs;
    let value;
    while (Date.now() < deadline) {
      signal?.throwIfAborted(); value = await read();
      if (accept(value)) return record(label, value);
      await sleep(200);
    }
    await record(`${label}_timeout`, value); throw new Error(`QA_MEDIA_FRAME_HOLD_TIMEOUT:${label}`);
  }
  async function settings(items) {
    requireConsumptionQaSettingsAcknowledgement(await sendTrustedRuntimeMessage(harness,
      { action: MESSAGE_ACTIONS.SET_SETTINGS, items, waitForPropagation: true }), items);
  }
  await record('permissions_granted', await configureMediaFrameHoldPermissions(harness));
  await settings({ 'app-theme': 'zen', filteringMode: 'blocklist', rulesMode: 'managed',
    gateConfig: structuredClone(DEFAULT_GATE_CONFIG),
    nudgeConfig: { ...structuredClone(DEFAULT_NUDGE_SETTINGS), goalEnds: { site: true, global: true }, visualThemeId: 'zen', hudVisible: false },
    dataCollectionMode: 'all_sites_minimal', insightsConsent: 'all_sites' });
  const rule = await sendTrustedRuntimeMessage(harness, { action: MESSAGE_ACTIONS.UPSERT_SITE_RULE,
    domain: MEDIA_FRAME_HOLD_HOSTS[0], type: 'blocked', waitForPropagation: true });
  requireProof(rule?.success === true && rule.propagation?.status === 'succeeded', 'SITE_RULE_ACK_REQUIRED');
  const page = await harness.openPage(fixture.url, { active: true });
  await harness.activateOwnedEphemeralPageWithoutWindowFocus(page);
  let sentinelActive = false;
  async function sentinel(action) {
    const requestId = randomUUID();
    const response = await sendTrustedRuntimeMessage(harness, { channel: SENTINEL_PROTOCOL_QA_CHANNEL,
      action, requestId, targetTabId: page.tabId,
      payload: action === SENTINEL.START ? { protocolScope: 'site', deliveryForm: 'full' } : {} });
    requireProof(response?.success === true && response.requestId === requestId,
      `SENTINEL:${action}:${response?.error}`);
    if (action === SENTINEL.START) sentinelActive = true;
    if (action === SENTINEL.STOP) sentinelActive = false;
    return response.result;
  }
  registerCleanup('media_frame_sentinel', async () => sentinelActive
    ? { stopped: await sentinel(SENTINEL.STOP) } : { active: false });
  const inspect = () => evaluate(harness.cdp, page.sessionId, 'window.__entropyFrameHoldFixture.request()');
  const play = () => evaluate(harness.cdp, page.sessionId, 'window.__entropyFrameHoldFixture.request("play")');
  async function readProbeCosts() {
    // Exact run-owned tab, existing extension isolated-world diagnostics only.
    // This read neither invokes the receiver nor installs a page/product bridge.
    const results = await harness.evaluateInTrustedPage(`chrome.scripting.executeScript({
      target: { tabId: ${JSON.stringify(page.tabId)}, allFrames: true }, world: 'ISOLATED',
      func: () => {
        const state = globalThis.__entropyMediaFrameProbeState__;
        if (window.top === window) return { top: true, probeInstalled: state?.active === true };
        if (!state?.active || typeof state.getDebugSnapshot !== 'function'
          || typeof state.getControlSnapshot !== 'function') throw new Error('QA_FRAME_PROBE_DIAGNOSTICS_REQUIRED');
        const control = state.getControlSnapshot();
        return { top: false, origin: location.origin, instanceId: control.instanceId,
          receiverDocumentId: control.documentId, probe: state.getDebugSnapshot() };
      }
    })`);
    requireProof(results.length === 3 && results.some(item => item.frameId === 0
      && item.result?.top === true && item.result.probeInstalled === false), 'PROBE_COST_TOP_OWNER');
    const children = results.filter(item => item.frameId !== 0).map(item => {
      requireProof(item.result?.top === false && item.result.receiverDocumentId === item.documentId,
        'PROBE_COST_FRAME_IDENTITY');
      return { frameId: item.frameId, documentId: item.documentId, origin: item.result.origin,
        instanceId: item.result.instanceId, probe: item.result.probe };
    });
    requireProof(children.length === 2, 'PROBE_COST_FRAMES_REQUIRED');
    return children;
  }
  async function measureNativeMutationCosts() {
    let before = await record('probe_cost_baseline', await readProbeCosts());
    for (let round = 1; round <= 2; round += 1) {
      for (const stage of ['add', 'remove']) {
        const actionStartedAt = Date.now();
        const fixtureState = await evaluate(harness.cdp, page.sessionId,
          `window.__entropyFrameHoldFixture.request(${JSON.stringify(`churn-${stage}`)})`);
        requireProof(fixtureState.filter(item => item.node !== 'top').every(item =>
          item.churn.round === round && item.churn.elementCount === 11 && item.churn.connected === (stage === 'add')),
        'PROBE_COST_FIXTURE_ACTION');
        const after = await until(`probe_cost_${stage}_${round}`, readProbeCosts, frames => frames.every(frame => {
          const previous = before.find(item => item.frameId === frame.frameId)?.probe;
          return previous && frame.probe.mutationBatchCount > previous.mutationBatchCount
            && frame.probe.readyMessageCount > previous.readyMessageCount && frame.probe.readyPending === false;
        }));
        await record(`probe_cost_${stage}_${round}_delta`, { elapsedMs: Date.now() - actionStartedAt,
          frames: requireFrameProbeCostEvidence(before, after, stage) });
        before = after;
      }
    }
  }
  const readSentinel = async () => summarizeSentinelQaSnapshot(await sentinel(SENTINEL.SNAPSHOT));
  async function pressSiteChoice(id, milliseconds) {
    const point = await evaluate(harness.cdp, page.sessionId, `(() => {
      const button = document.getElementById('friction-nudge-root')?.shadowRoot?.getElementById(${JSON.stringify(id)});
      if (!button || button.disabled) throw new Error('QA_MEDIA_FRAME_HOLD_SITE_BUTTON_UNAVAILABLE');
      const rect = button.getBoundingClientRect();
      return { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 };
    })()`);
    await harness.cdp.send('Input.dispatchMouseEvent', { type: 'mousePressed', button: 'left', buttons: 1, clickCount: 1, ...point }, page.sessionId);
    try { await sleep(milliseconds); signal?.throwIfAborted(); }
    finally {
      await harness.cdp.send('Input.dispatchMouseEvent', { type: 'mouseReleased', button: 'left', buttons: 0, clickCount: 1, ...point }, page.sessionId);
    }
  }
  async function prepareNativePlayback(nodes = ['top', 'child', 'nested']) {
    // One input in each exact document establishes its own ordinary audio
    // eligibility. Coordinates come from that frame's fixture reply and its
    // parent's measured iframe rectangle; no focus or autoplay flag is changed.
    const frames = await inspect();
    requireProof(frames.length === 3, 'PREPARATION_FRAMES_REQUIRED');
    const targets = frames.filter(frame => nodes.includes(frame.node));
    requireProof(targets.length === nodes.length, 'PREPARATION_TARGETS_REQUIRED');
    for (const frame of targets) {
      const { x, y } = frame.playButton;
      requireProof(Number.isFinite(x) && Number.isFinite(y) && x > 0 && y > 0, 'PREPARATION_GEOMETRY_INVALID');
      await harness.cdp.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x, y,
        button: 'none', buttons: 0 }, page.sessionId);
      await harness.cdp.send('Input.dispatchMouseEvent', { type: 'mousePressed', x, y,
        button: 'left', buttons: 1, clickCount: 1 }, page.sessionId);
      await harness.cdp.send('Input.dispatchMouseEvent', { type: 'mouseReleased', x, y,
        button: 'left', buttons: 0, clickCount: 1 }, page.sessionId);
    }
    const prepared = await inspect();
    const surface = await evaluate(harness.cdp, page.sessionId, `(() => ({
      bodyInert: document.body.inert, rootPresent: !!document.getElementById('friction-nudge-root'),
      fullscreen: !!document.fullscreenElement,
      visibility: document.visibilityState, focused: document.hasFocus(), width: innerWidth, height: innerHeight,
      hitTests: ${JSON.stringify(targets.map(frame => frame.playButton))}.map(point => {
        const element = document.elementFromPoint(point.x, point.y);
        return { point, tag: element?.localName, id: element?.id, inert: element?.inert };
      }) }))()`);
    await record('native_input_receipt', { nodes, before: frames, after: prepared, surface });
    requireProof(prepared.filter(frame => nodes.includes(frame.node)).every(frame =>
      frame.trustedPlayClicks > frames.find(before => before.instanceId === frame.instanceId)?.trustedPlayClicks),
      'PREPARATION_INPUT_NOT_RECEIVED');
    await record('native_input_preparation', prepared.map(({ node, instanceId, playButton, trustedPlayClicks }) =>
      ({ node, instanceId, playButton, trustedPlayClicks })));
  }
  async function verifyNativeProgress(label, before) {
    await sleep(300);
    const progressed = await record(label, await inspect());
    requireNativeFrameMediaEvidence(progressed, { paused: false });
    requireProof(progressed.every(item => {
      const previous = before.find(entry => entry.instanceId === item.instanceId);
      return previous && item.media.every((medium, index) => Math.abs(medium.currentTime - previous.media[index].currentTime) >= 0.03);
    }), 'NATIVE_PLAYBACK_DID_NOT_ADVANCE');
  }
  async function support() {
    const response = await sendTrustedRuntimeMessage(harness,
      { type: MESSAGE_TYPES.GET_MEDIA_FRAME_SUPPORT, payload: { tabId: page.tabId } });
    requireProof(response?.success === true && response.result, 'SUPPORT_RESPONSE_REQUIRED');
    return response.result;
  }
  const nativeState = (snapshot, paused, nodes) => {
    try { requireNativeFrameMediaEvidence(snapshot, { paused, nodes }); return true; }
    catch (error) {
      if (error.message.startsWith('QA_MEDIA_FRAME_HOLD_NATIVE_STATE:')) return false;
      throw error;
    }
  };
  const supportState = stage => snapshot => {
    try { requireFrameHoldSupport(snapshot, stage); return true; }
    catch (error) {
      if (/QA_MEDIA_FRAME_HOLD_(HOLD_EFFECT_UNVERIFIED|RESUME_EFFECT_UNVERIFIED|REVOCATION_UNREPORTED|STALE_HOLD_RETAINED)$/.test(error.message)) return false;
      throw error;
    }
  };
  await until('top_bootstrapped', async () => {
    const result = await sendTrustedRuntimeMessage(harness,
      { action: MESSAGE_ACTIONS.DEBUG_GET_CONTENT_RUNTIME_DIAGNOSTICS, targetTabId: page.tabId, limit: 5 });
    requireProof(result?.success === true, 'BOOTSTRAP_DIAGNOSTICS_REQUIRED');
    return result.snapshot.currentSession;
  }, session => session?.status === 'active' && session.url === fixture.url);
  await prepareNativePlayback();
  const initial = await until('native_playing', inspect, snapshot => nativeState(snapshot, false));
  requireProof(new Set(initial.map(item => item.origin)).size === 3, 'CROSS_ORIGIN_REQUIRED');
  await verifyNativeProgress('native_clock_progress', initial);
  await record('initial_support', await support());
  await measureNativeMutationCosts();
  requireNativeFrameMediaEvidence(await inspect(), { paused: false });
  await record('sentinel_start', await sentinel(SENTINEL.START));
  await until('native_all_paused', inspect, snapshot => nativeState(snapshot, true));
  const heldSupport = await until('held_support', support, supportState('held'));
  await play();
  await until('replay_suppressed', inspect, snapshot => nativeState(snapshot, true));
  const renewBaseline = await record('probe_renew_baseline', await readProbeCosts());
  const renewalStartedAt = Date.now();
  const renewed = await until('probe_renew_observed', readProbeCosts, frames => frames.every(frame => {
    const previous = renewBaseline.find(item => item.frameId === frame.frameId)?.probe;
    return previous && frame.probe.renewCommandCount > previous.renewCommandCount
      && frame.probe.readyMessageCount > previous.readyMessageCount;
  }), 25_000);
  await record('probe_renew_command_delta', { elapsedMs: Date.now() - renewalStartedAt,
    frames: requireFrameProbeCostEvidence(renewBaseline, renewed, 'renew') });
  // Before any frame replacement, all six media are proved originally playing.
  // The real Stay action must restore that cohort without a fixture play call.
  await until('site_choice_ready', readSentinel, snapshot => snapshot.active && snapshot.siteFurinPhase === 'choice'
    && snapshot.siteFurinReady === true, 30_000);
  await pressSiteChoice('nudgeFurinContinue', 1000);
  await until('site_stay_resolved', readSentinel, snapshot => !snapshot.active);
  sentinelActive = false;
  await until('stay_restored_native_cohort', inspect, snapshot => nativeState(snapshot, false));
  await until('stay_verified_resume', support, supportState('resumed'));
  await record('sentinel_restart_after_stay', await sentinel(SENTINEL.START));
  await until('hold_after_stay', inspect, snapshot => nativeState(snapshot, true));
  await until('hold_after_stay_support', support, supportState('held'));
  const beforeNavigation = await inspect();
  await evaluate(harness.cdp, page.sessionId, 'window.__entropyFrameHoldFixture.navigateChild()');
  const navigated = await until('child_navigation_reheld', inspect, snapshot => nativeState(snapshot, true)
    && snapshot.find(item => item.node === 'child')?.instanceId !== beforeNavigation.find(item => item.node === 'child').instanceId
    && snapshot.find(item => item.node === 'nested')?.instanceId !== beforeNavigation.find(item => item.node === 'nested').instanceId);
  const navigatedSupport = await until('navigated_support', support, supportState('held'));
  const heldDocuments = new Set(heldSupport.frames.filter(frame => frame.status !== 'managed_by_top').map(frame => frame.documentId));
  requireProof(navigatedSupport.frames.filter(frame => frame.status !== 'managed_by_top')
    .every(frame => !heldDocuments.has(frame.documentId)), 'STALE_FRAME_DOCUMENT_RETAINED');
  requireProof(navigated.find(item => item.node === 'top').instanceId === initial.find(item => item.node === 'top').instanceId,
    'CHILD_NAVIGATION_REPLACED_TOP');
  await record('nested_permission_revoked', await configureMediaFrameHoldPermissions(harness, { revokeNested: true }));
  await until('revoked_support', support, supportState('revoked'));
  await play();
  await until('revoked_frame_released_remaining_frames_held', inspect, snapshot =>
    nativeState(snapshot, false, ['nested']) && nativeState(snapshot, true, ['top', 'child']));
  await record('sentinel_stop', await sentinel(SENTINEL.STOP));
  await until('sentinel_surface_released', () => evaluate(harness.cdp, page.sessionId,
    `({ bodyInert: document.body.inert, rootPresent: !!document.getElementById('friction-nudge-root'),
      fullscreen: !!document.fullscreenElement, visibility: document.visibilityState, scrollX, scrollY })`),
  snapshot => !snapshot.bodyInert && !snapshot.rootPresent && !snapshot.fullscreen);
  // After STOP, one real top Play button is the fixture's manual playback action.
  // Descendant buttons are autoplay preparation, not a product release contract.
  await prepareNativePlayback(['top']);
  const releasedMedia = await until('all_released', inspect, snapshot => nativeState(snapshot, false));
  await verifyNativeProgress('released_native_clock_progress', releasedMedia);
  await until('released_support', support, supportState('released'));
  // A real top navigation must retire the old document's broker ownership.
  await sentinel(SENTINEL.START);
  await until('second_hold', inspect, snapshot => nativeState(snapshot, true, ['top', 'child']));
  await harness.navigatePage(page, `${fixture.url}?revision=top-replaced`);
  sentinelActive = false;
  const replacement = await record('top_navigation_documents', await inspect());
  requireProof(replacement.every(item => item.instanceId !== navigated.find(previous => previous.node === item.node)?.instanceId),
    'TOP_NAVIGATION_DOCUMENT_NOT_REPLACED');
  const replacementSupport = await until('top_navigation_support', support, supportState('released'));
  const retiredDocuments = new Set(navigatedSupport.frames.map(frame => frame.documentId));
  requireProof(replacementSupport.frames.every(frame => !retiredDocuments.has(frame.documentId)), 'TOP_NAVIGATION_OLD_DOCUMENT_RETAINED');
  await prepareNativePlayback(['top']);
  await until('top_navigation_released', inspect, snapshot => nativeState(snapshot, false)
    && snapshot.find(item => item.node === 'top').instanceId !== initial.find(item => item.node === 'top').instanceId);
  return { status: 'PASS', protocol: 'media_frame_hold', tracePath: path.join(attachmentsDir, 'media-frame-hold.json'),
    scope: 'Real owned Chrome native audio/video, cross-origin nested documents, bounded native mutation scan and heartbeat command counters, product Sentinel hold and real Stay automatic restoration, document replacement, Chrome host-permission revocation and manual playback after STOP; no CPU timing, seek support or real-user admission claim' };
}
