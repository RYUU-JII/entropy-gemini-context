import fs from 'node:fs/promises';
import path from 'node:path';
import { ExtensionChromiumHarness, evaluate, sleep } from '../../e2e/extensionChromiumHarness.mjs';
import { ENTROPY_QA_TRUSTED_PAGE_PATH } from '../../e2e/qaProfileArtifactSlot.mjs';
import { sendTrustedRuntimeMessage } from './gateRuntimeQaProtocol.mjs';
import { MESSAGE_ACTIONS } from '../../../src/platform/messaging/messageTypes.js';
import { CONFIG_DEFAULT_FILTER_SETTINGS } from '../../../src/domains/settings/config/index.js';
import { DEFAULT_GATE_CONFIG } from '../../../src/domains/settings/config/gateConfig.js';
import { DEFAULT_NUDGE_SETTINGS } from '../../../src/domains/settings/config/nudgeConfig.js';
import { requireConsumptionQaSettingsAcknowledgement } from './consumptionEntryQaProtocol.mjs';
import { createNativeVideoSkipFixture, NATIVE_VIDEO_SKIP_HOST, NATIVE_VIDEO_SKIP_PATTERN } from './nativeVideoSkipFixture.mjs';

const ACTIONS = { START: 'enable', SNAPSHOT: 'read', STOP: 'disable' };

function requireProof(value, code) { if (!value) throw new Error(`QA_NATIVE_VIDEO_SKIP_${code}`); }

function findNativeMediaControls(root, pseudo) {
  const matches = [];
  function walk(node, native = false) {
    const isNative = native || node.shadowRootType === 'user-agent';
    const attrs = Object.fromEntries(Array.from({ length: (node.attributes?.length || 0) / 2 },
      (_, index) => [node.attributes[index * 2], node.attributes[index * 2 + 1]]));
    if (isNative && attrs.pseudo === pseudo) matches.push(node);
    for (const child of [...(node.children || []), ...(node.shadowRoots || [])]) walk(child, isNative);
  }
  walk(root);
  return matches;
}

export function findNativeMediaControl(root, pseudo) {
  const matches = findNativeMediaControls(root, pseudo);
  requireProof(matches.length === 1, `NATIVE_CONTROL_IDENTITY:${pseudo}:${matches.length}`);
  return matches[0];
}

export function requireNativeSeekEvidence(sample, expected) {
  requireProof(['blocked', 'allowed', 'observe'].includes(expected), 'EXPECTATION_INVALID');
  requireProof(sample?.before?.controls === true && sample.after?.controls === true
    && sample.before.readyState >= 2 && sample.after.readyState >= 2
    && Number.isFinite(sample.before.time) && Number.isFinite(sample.after.time)
    && sample.before.duration >= 170 && sample.after.error === null, 'NATIVE_MEDIA_REQUIRED');
  requireProof(['trusted_native_timeline', 'former_native_timeline_position'].includes(sample.input?.type)
    && Number.isFinite(sample.input.x) && Number.isFinite(sample.input.y)
    && sample.input.backendNodeId > 0 && sample.input.pseudo === '-webkit-media-controls-timeline',
  'NATIVE_INPUT_REQUIRED');
  if (sample.input.type === 'former_native_timeline_position') requireProof(sample.input.display === 'none'
    && sample.input.geometrySource === 'unprotected_quad_projected_to_video', 'REMOVED_TIMELINE_PROOF_REQUIRED');
  const elapsedSeconds = (sample.after.now - sample.before.now) / 1000;
  requireProof(elapsedSeconds >= 0 && elapsedSeconds < 15, 'MEASUREMENT_WINDOW_INVALID');
  const blocked = sample.after.time <= sample.before.time + elapsedSeconds + 2;
  const allowed = sample.after.time - sample.before.time > 15;
  if (expected === 'blocked') requireProof(blocked && !sample.after.seeking, 'SEEK_ESCAPED');
  if (expected === 'allowed') requireProof(allowed, 'BASELINE_SEEK_NOT_PROVEN');
  return { blocked, allowed, deltaSeconds: sample.after.time - sample.before.time,
    elapsedSeconds, observedInputCount: sample.after.inputs.length - sample.before.inputs.length,
    seekingEvents: sample.after.events.filter(event => event.at >= sample.before.now && event.type === 'seeking').length };
}

export async function executeQaProtocol({ plan, artifact, browser, evidence, attachmentsDir,
  registerCleanup, reportBrowserGpuCapability, signal, recoveryJournal }) {
  requireProof(artifact.id === 'dev_extension' && browser.processOwnership === 'owned', 'OWNED_DEV_REQUIRED');
  const fixture = await createNativeVideoSkipFixture();
  registerCleanup('native_video_fixture', fixture.close);
  const harness = new ExtensionChromiumHarness({ chromePath: browser.chrome, distDir: artifact.path,
    rootDir: plan.rootDir, headless: plan.browserExecution.headless, browserExecution: plan.browserExecution,
    capacityReservationMode: plan.browserCapacityMode,
    audioPolicy: plan.browserExecution.audioPolicy, launchEnvironment: browser.launchEnvironment,
    renderingRequirement: plan.browserExecution.renderingRequirement, keepTemp: false,
    temporaryManifest: { requiredPermissions: ['scripting'], requiredHostPermissions: [NATIVE_VIDEO_SKIP_PATTERN] },
    trustedPagePath: ENTROPY_QA_TRUSTED_PAGE_PATH, tempPrefix: 'entropy-native-video-', recoveryJournal });
  registerCleanup('native_video_browser', () => harness.close());
  await harness.start(); await reportBrowserGpuCapability(harness.gpuCapability);
  const trace = [];
  registerCleanup('native_video_trace', async () => {
    await fs.writeFile(path.join(attachmentsDir, 'native-video-skip.json'), JSON.stringify({ schemaVersion: 1,
      expectation: plan.parameters.expectation, trace }, null, 2)); return { samples: trace.length };
  });
  async function record(label, value) {
    trace.push({ label, value }); await evidence.event('QA_NATIVE_VIDEO_SKIP_BOUNDARY', { label, value });
    console.log(JSON.stringify({ event: 'QA_NATIVE_VIDEO_SKIP_PROGRESS', label })); return value;
  }
  async function until(label, read, accept, timeout = 12000) {
    const end = Date.now() + timeout;
    let value;
    while (Date.now() < end) {
      signal?.throwIfAborted(); value = await read();
      if (accept(value)) return value;
      await sleep(100);
    }
    await record(`${label}_timeout`, value); throw new Error(`QA_NATIVE_VIDEO_SKIP_TIMEOUT:${label}`);
  }
  const filters = Object.fromEntries(Object.entries(structuredClone(CONFIG_DEFAULT_FILTER_SETTINGS))
    .map(([key, value]) => [key, { ...value, isActive: key === 'fullscreenVisualRelaxation' }]));
  filters.videoSkipGuard.value = { mode: 'hard_block' };
  async function settings(items) {
    const response = await sendTrustedRuntimeMessage(harness,
      { action: MESSAGE_ACTIONS.SET_SETTINGS, items, waitForPropagation: true });
    return requireConsumptionQaSettingsAcknowledgement(response, items);
  }
  await settings({ filteringMode: 'blocklist', rulesMode: 'managed', filterSettings: filters,
    'app-theme': 'zen', nudgeConfig: structuredClone(DEFAULT_NUDGE_SETTINGS),
    gateConfig: structuredClone(DEFAULT_GATE_CONFIG) });
  const rule = await sendTrustedRuntimeMessage(harness, { action: MESSAGE_ACTIONS.UPSERT_SITE_RULE,
    domain: NATIVE_VIDEO_SKIP_HOST, type: 'blocked', waitForPropagation: true });
  requireProof(rule?.success === true && rule.propagation?.status === 'succeeded', 'SITE_RULE_ACK_REQUIRED');
  const page = await harness.openPage(fixture.url, { active: true });
  await harness.activateOwnedEphemeralPageWithoutWindowFocus(page);
  const read = () => evaluate(harness.cdp, page.sessionId, 'window.__entropyNativeVideoFixture.read()');
  const ready = await until('loaded', read, value => value.readyState >= 2 && value.duration >= 170);
  await record('loaded', ready);
  let active = false;
  async function runtimeSnapshot() {
    const full = await diagnostics({ full: true });
    const ownership = await evaluate(harness.cdp, page.sessionId, `({
      connectedVideoCount: document.querySelectorAll('video[controls][data-friction-video-skip-native-owner="1"]').length,
      documentLockAttribute: document.documentElement.getAttribute('data-friction-video-skip-timeline-lock')
    })`);
    return { source: 'canonical_protection_diagnostics_and_dom_ownership',
      active: full.features.videoSkipGuard.active,
      gateEnabled: full.runtime?.featureStates?.videoSkipGuard?.enabled === true,
      mode: full.features.videoSkipGuard.lastConfig?.mode,
      ...ownership, diagnostics: full.features.videoSkipGuard };
  }
  async function guard(action) {
    if (action === ACTIONS.SNAPSHOT) return { snapshot: await runtimeSnapshot() };
    const enabled = action === ACTIONS.START;
    const filterSettings = { ...filters, videoSkipGuard: { isActive: enabled, value: { mode: 'hard_block' } } };
    const receipt = await settings({ filterSettings });
    active = enabled;
    const snapshot = await until(enabled ? 'canonical_guard_enabled' : 'canonical_guard_disabled', runtimeSnapshot,
      value => value.active === enabled && value.gateEnabled === enabled && value.connectedVideoCount === (enabled ? 1 : 0));
    return { receipt, snapshot };
  }
  registerCleanup('native_video_guard', async () => active ? { stopped: await guard(ACTIONS.STOP) } : { active: false });
  async function diagnostics({ full = false } = {}) {
    return harness.evaluateInTrustedPage(`chrome.scripting.executeScript({ target: { tabId: ${page.tabId}, frameIds: [0] },
      world: 'ISOLATED', func: () => {
        if (typeof globalThis.__entropyProtectionDiagnosticsSnapshot__ !== 'function') throw new Error('NATIVE_QA_DIAGNOSTICS_MISSING');
        return globalThis.__entropyProtectionDiagnosticsSnapshot__();
      } }).then(results => ${full ? 'results[0].result' : 'results[0].result.features.videoSkipGuard'})`);
  }
  const input = (type, x, y, options = {}) => harness.cdp.send('Input.dispatchMouseEvent',
    { type, x, y, ...options }, page.sessionId);
  async function click(x, y) {
    await input('mouseMoved', x, y);
    await input('mousePressed', x, y, { button: 'left', buttons: 1, clickCount: 1 });
    await input('mouseReleased', x, y, { button: 'left', buttons: 0, clickCount: 1 });
  }
  const baselineControls = new Map();
  async function control(pseudo, { allowHidden = false, reveal = true } = {}) {
    const { rect } = await read();
    if (reveal) await input('mouseMoved', rect.left + rect.width / 2, rect.top + rect.height / 2);
    await sleep(180);
    const { root } = await harness.cdp.send('DOM.getDocument', { depth: -1, pierce: true }, page.sessionId);
    const candidates = [];
    for (const node of findNativeMediaControls(root, pseudo)) {
      const { object } = await harness.cdp.send('DOM.resolveNode', { backendNodeId: node.backendNodeId }, page.sessionId);
      try {
        const { result, exceptionDetails } = await harness.cdp.send('Runtime.callFunctionOn', {
          objectId: object.objectId, returnByValue: true, functionDeclaration: `function() {
            const r = this.getBoundingClientRect(); const s = getComputedStyle(this);
            return { left: r.left, top: r.top, width: r.width, height: r.height,
              visibility: s.visibility, display: s.display, pointerEvents: s.pointerEvents,
              interactivity: s.interactivity, tabIndex: this.tabIndex, disabled: this.disabled,
              text: this.textContent?.slice(0, 48) };
          }` }, page.sessionId);
        requireProof(!exceptionDetails, 'CONTROL_GEOMETRY_FAILED');
        if (allowHidden && pseudo === '-webkit-media-controls-timeline' && result.value.display === 'none') {
          const baseline = baselineControls.get(pseudo);
          requireProof(baseline, 'UNPROTECTED_CONTROL_GEOMETRY_REQUIRED');
          // The protected native rail is absent. These are explicitly former
          // rail positions, projected with its original native video rectangle;
          // they are not claimed to hit an extant native timeline.
          const scaleX = rect.width / baseline.videoRect.width;
          const scaleY = rect.height / baseline.videoRect.height;
          candidates.push({ ...result.value, pseudo, backendNodeId: node.backendNodeId,
            geometrySource: 'unprotected_quad_projected_to_video',
            left: rect.left + (baseline.left - baseline.videoRect.left) * scaleX,
            top: rect.top + (baseline.top - baseline.videoRect.top) * scaleY,
            width: baseline.width * scaleX, height: baseline.height * scaleY });
        }
        if (result.value.width > 2 && result.value.height > 2
          && (allowHidden || result.value.visibility !== 'hidden') && result.value.display !== 'none') {
          // UA range border boxes include padding outside the actual hit target.
          // Read the browser's content quad, which the unprotected baseline proves.
          const { model } = await harness.cdp.send('DOM.getBoxModel', { backendNodeId: node.backendNodeId }, page.sessionId);
          const xs = model.content.filter((_, index) => index % 2 === 0);
          const ys = model.content.filter((_, index) => index % 2 === 1);
          candidates.push({ pseudo, backendNodeId: node.backendNodeId, ...result.value,
            left: Math.min(...xs), top: Math.min(...ys), width: Math.max(...xs) - Math.min(...xs),
            height: Math.max(...ys) - Math.min(...ys) });
        }
      } finally { await harness.cdp.send('Runtime.releaseObject', { objectId: object.objectId }, page.sessionId); }
    }
    requireProof(candidates.length === 1, `VISIBLE_CONTROL_IDENTITY:${pseudo}:${candidates.length}`);
    if (!active && !baselineControls.has(pseudo)) baselineControls.set(pseudo, { ...candidates[0], videoRect: rect });
    return candidates[0];
  }
  async function reset() {
    requireProof(!active, 'RESET_WHILE_PROTECTED');
    await evaluate(harness.cdp, page.sessionId, 'window.__entropyNativeVideoFixture.reset()');
    await until('reset', read, value => !value.seeking && Math.abs(value.time - 10) < 0.1);
  }
  async function key(name, code) {
    await harness.cdp.send('Input.dispatchKeyEvent', { type: 'keyDown', key: name, code: name,
      windowsVirtualKeyCode: code, nativeVirtualKeyCode: code }, page.sessionId);
    await harness.cdp.send('Input.dispatchKeyEvent', { type: 'keyUp', key: name, code: name,
      windowsVirtualKeyCode: code, nativeVirtualKeyCode: code }, page.sessionId);
  }
  async function nativeTimelineFocused(geometry) {
      const { nodes } = await harness.cdp.send('Accessibility.getPartialAXTree',
        { backendNodeId: geometry.backendNodeId, fetchRelatives: false }, page.sessionId);
      return nodes.some(node => node.backendDOMNodeId === geometry.backendNodeId
        && node.properties?.some(property => property.name === 'focused' && property.value?.value === true));
  }
  async function focusTimeline(geometry) {
    let reached = await nativeTimelineFocused(geometry);
    let tabs = 0;
    while (!reached && tabs < 12) { await key('Tab', 9); tabs += 1; reached = await nativeTimelineFocused(geometry); }
    return { reached, tabs };
  }
  async function keyboardSeek(label, expected) {
    const geometry = await control('-webkit-media-controls-timeline', { allowHidden: active });
    const { reached, tabs } = await focusTimeline(geometry);
    if (active && reached) {
      // Tab itself can be page-visible. Expire that unrelated attribution before
      // testing the key consumed inside the user-agent range control.
      await sleep(5400);
      const waitingRuntime = (await guard(ACTIONS.SNAPSHOT)).snapshot;
      requireProof(waitingRuntime.active && waitingRuntime.connectedVideoCount === 1, 'GUARD_OWNERSHIP_LOST');
    }
    const before = await read();
    if (reached) { await key('End', 35); await sleep(1200); }
    const after = await read();
    const runtime = active ? (await guard(ACTIONS.SNAPSHOT)).snapshot : null;
    await record(label, { geometry, reached, tabs, before, after, runtime,
      diagnostics: active ? await diagnostics() : null });
    if (active) requireProof(runtime.active && runtime.connectedVideoCount === 1, 'GUARD_OWNERSHIP_LOST');
    if (expected === 'allowed') requireProof(reached && after.time >= after.duration - 2, 'NATIVE_KEYBOARD_BASELINE_REQUIRED');
    if (expected === 'blocked') {
      requireProof(reached || geometry.interactivity === 'inert' || geometry.disabled === true
        || geometry.visibility === 'hidden' || geometry.display === 'none',
        'KEYBOARD_OPPORTUNITY_UNPROVEN');
      requireProof(after.time <= before.time + (after.now - before.now) / 1000 + 2, 'NATIVE_KEYBOARD_SEEK_ESCAPED');
    }
  }
  async function seek(label, fraction, expected, { drag = false, repeat = false } = {}) {
    const geometry = await control('-webkit-media-controls-timeline', { allowHidden: active });
    const runtimeBefore = active ? (await guard(ACTIONS.SNAPSHOT)).snapshot : null;
    if (active) requireProof(runtimeBefore.active && runtimeBefore.gateEnabled
      && runtimeBefore.connectedVideoCount === 1, 'GUARD_OWNERSHIP_LOST_BEFORE_INPUT');
    const before = await read();
    const x = geometry.left + geometry.width * fraction; const y = geometry.top + geometry.height / 2;
    const started = Date.now();
    if (drag) {
      const fromX = geometry.left + geometry.width * (before.time / before.duration);
      await input('mouseMoved', fromX, y);
      await input('mousePressed', fromX, y, { button: 'left', buttons: 1, clickCount: 1 });
      await sleep(5400);
      for (let step = 1; step <= 8; step += 1) {
        signal?.throwIfAborted();
        await input('mouseMoved', fromX + (x - fromX) * step / 8, y, { button: 'left', buttons: 1 });
        await sleep(80);
      }
      await input('mouseReleased', x, y, { button: 'left', buttons: 0, clickCount: 1 });
    } else {
      await click(x, y);
      if (repeat) { await sleep(100); await click(x, y); }
    }
    await sleep(1200);
    const after = await read();
    const runtime = active ? await until('guard_after_native_input', runtimeSnapshot,
      value => value.active && value.gateEnabled && value.connectedVideoCount === 1, 3000) : null;
    const sample = { before, after, input: { ...geometry,
      type: geometry.display === 'none' ? 'former_native_timeline_position' : 'trusted_native_timeline', x, y,
      fraction, drag, repeat, wallElapsedMs: Date.now() - started }, runtimeBefore, runtime,
      diagnostics: active ? await diagnostics() : null };
    await record(label, sample);
    if (active) requireProof(runtime.active === true && runtime.connectedVideoCount === 1, 'GUARD_OWNERSHIP_LOST');
    return record(`${label}_verdict`, requireNativeSeekEvidence(sample, expected));
  }
  await reset();
  await seek('unprotected_native_seek', 0.60, 'allowed');
  await keyboardSeek('unprotected_native_keyboard', 'allowed');
  // Canonical settings own activation in this disposable profile, so fullscreen
  // reprojection exercises the same owner as ordinary use instead of undoing a
  // manually applied QA-only manager session.
  await record('content_prepare', await guard(ACTIONS.STOP));
  const settled = await until('content_bootstrap', () => diagnostics({ full: true }), value =>
    value.bootstrap !== null && value.runtime?.lastUpdatedAt >= value.runtimeAttempt?.attemptedAt);
  await record('content_bootstrap', { bootstrap: settled.bootstrap, runtime: settled.runtime });
  await reset();
  const focusedGeometry = await control('-webkit-media-controls-timeline');
  const precedingFocus = await focusTimeline(focusedGeometry);
  requireProof(precedingFocus.reached, 'PREACTIVATION_NATIVE_FOCUS_REQUIRED');
  await record('native_timeline_focused_before_guard', precedingFocus);
  await record('guard_start', await guard(ACTIONS.START));
  await until('video_attached', () => guard(ACTIONS.SNAPSHOT), result => result.snapshot.connectedVideoCount === 1);
  const activationGeometry = await control('-webkit-media-controls-timeline', { allowHidden: true });
  const focusedAfterActivation = await nativeTimelineFocused(activationGeometry);
  if (focusedAfterActivation) await sleep(5400);
  const pendingBefore = await read();
  await key('End', 35); await sleep(1200);
  const pendingAfter = await read();
  const pendingRuntime = (await guard(ACTIONS.SNAPSHOT)).snapshot;
  await record('native_focused_activation_keyboard', { focusedAfterActivation, geometry: activationGeometry,
    before: pendingBefore, after: pendingAfter, runtime: pendingRuntime });
  requireProof(pendingRuntime.active && pendingRuntime.connectedVideoCount === 1, 'GUARD_OWNERSHIP_LOST');
  if (plan.parameters.expectation === 'protect') requireProof(pendingAfter.time <= pendingBefore.time + 2,
    'PENDING_NATIVE_KEYBOARD_SEEK_ESCAPED');
  const rect = (await read()).rect;
  await click(rect.left + rect.width / 2, rect.top + rect.height / 2);
  await record('preceding_video_click', await read());
  const expectation = plan.parameters.expectation === 'protect' ? 'blocked' : 'observe';
  await seek('early_native_seek', 0.65, expectation);
  await sleep(5400);
  await seek('late_native_seek', 0.80, expectation);
  await seek('repeated_native_seek', 0.90, expectation, { repeat: true });
  await seek('long_native_drag', 0.94, expectation, { drag: true });
  await keyboardSeek('protected_native_keyboard', expectation);
  await record('native_clock_preserved', await control('-webkit-media-controls-current-time-display'));
  // Native non-seek controls must remain functional during protection.
  const mute = await control('-webkit-media-controls-mute-button');
  const mutedBefore = await read();
  await click(mute.left + mute.width / 2, mute.top + mute.height / 2);
  const mutedAfter = await until('native_mute', read, value => value.muted !== mutedBefore.muted);
  await record('native_mute_preserved', { before: mutedBefore.muted, after: mutedAfter.muted });
  const volume = await control('-webkit-media-controls-volume-slider', { reveal: false });
  await click(volume.left + volume.width * 0.65, volume.top + volume.height / 2);
  const volumeBeforeKey = await until('native_volume_pointer', read, value => value.volume < 0.95 && value.volume > 0.1);
  await key('ArrowLeft', 37);
  const volumeAfterKey = await until('native_volume_keyboard', read, value => value.volume < volumeBeforeKey.volume);
  await record('native_volume_keyboard_preserved', { before: volumeBeforeKey.volume, after: volumeAfterKey.volume });
  const play = await control('-webkit-media-controls-play-button');
  const playingBefore = await read();
  await click(play.left + play.width / 2, play.top + play.height / 2);
  const playingAfter = await until('native_play', read, value => value.paused !== playingBefore.paused);
  await record('native_play_preserved', { before: playingBefore.paused, after: playingAfter.paused });
  if ((await read()).fullscreen) {
    await key('Escape', 27);
    await until('native_fullscreen_preparation_exit', read, value => value.fullscreen === false);
  }
  const fullscreen = await control('-webkit-media-controls-fullscreen-button');
  await click(fullscreen.left + fullscreen.width / 2, fullscreen.top + fullscreen.height / 2);
  const fullscreenEntered = await until('native_fullscreen', () => evaluate(harness.cdp, page.sessionId,
    'document.fullscreenElement === document.querySelector("video")'), value => value === true);
  const fullscreenRuntime = await until('fullscreen_guard_retained', runtimeSnapshot,
    value => value.active && value.gateEnabled && value.connectedVideoCount === 1);
  await key('Escape', 27);
  const fullscreenExited = await until('native_fullscreen_exit', () => evaluate(harness.cdp, page.sessionId,
    'document.fullscreenElement === null'), value => value === true);
  const normalRuntime = await until('fullscreen_exit_guard_retained', runtimeSnapshot,
    value => value.active && value.gateEnabled && value.connectedVideoCount === 1);
  await record('native_fullscreen_preserved', { entered: fullscreenEntered, exited: fullscreenExited,
    fullscreenRuntime, normalRuntime });
  await record('guard_stop', await guard(ACTIONS.STOP));
  await reset();
  await seek('released_native_seek', 0.60, 'allowed');
  return { status: 'PASS', protocol: 'native_video_skip', expectation: plan.parameters.expectation,
    tracePath: path.join(attachmentsDir, 'native-video-skip.json'),
    scope: plan.parameters.expectation === 'protect'
      ? 'Canonical protected-site policy; native VP8/Opus baseline seek, removed-timeline proof, early/late/repeated/drag at former-rail positions, pending/future keyboard focus, native mute/volume keyboard/play/fullscreen and release. No iframe seek, arbitrary-site or visual smoothness certification.'
      : 'Observational native timeline evidence only. PASS certifies fixture/control execution and cleanup, not successful seek protection.' };
}
