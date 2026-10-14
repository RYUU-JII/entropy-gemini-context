import { evaluate, sleep } from '../../e2e/extensionChromiumHarness.mjs';
import { MESSAGE_ACTIONS } from '../../../src/platform/messaging/messageTypes.js';
import { PROGRESSION_ARTIFACT_JOURNEY_TARGET_DAY_COUNT } from '../../../src/domains/progression/policy/progressionJourneyPolicy.js';
import { PROGRESSION_JOURNEY_STARTER_FAMILY_IDS } from '../../../src/domains/progression/policy/progressionJourneyPolicy.js';
import { artifactGallerySelection } from './dashboardArtifactGallerySelection.mjs';

// Reuses the already allowlisted, run-owned loopback registration fixture.
// This scenario proves application admission/commit, not Chrome's permission UI.
export const FIRST_SITE_FIXTURE_DOMAIN = 'native-video.localhost';
export const FIRST_SITE_TEMPORARY_MANIFEST = Object.freeze({
  requiredPermissions: ['scripting'],
  requiredHostPermissions: ['*://native-video.localhost/*', '*://*.native-video.localhost/*'],
});

const requireProof = (condition, step) => {
  if (!condition) throw new Error('QA_FIRST_SITE_JOURNEY_FAILED:' + step);
};
const scope = { pageUrl: 'http://native-video.localhost/', hostname: FIRST_SITE_FIXTURE_DOMAIN };
async function readSnapshot(send) {
  const result = await send({ action: MESSAGE_ACTIONS.GET_POPUP_SITE_SNAPSHOT, ...scope });
  requireProof(result?.success === true, 'popup_snapshot');
  return result.snapshot;
}

export async function prepareDashboardFirstSiteJourney(send) {
  const before = await readSnapshot(send);
  requireProof(before.access.requiresDashboardRegistration === true && !before.protection.isProtected
    && before.access.sitesManagementVisible === false,
    'fresh_profile_requires_dashboard');
  const gate = await send({ action: MESSAGE_ACTIONS.POPUP_QUEUE_BLOCK_DOMAIN,
    domain: FIRST_SITE_FIXTURE_DOMAIN });
  requireProof(gate?.success === true && gate.requiresDashboard === true && gate.pending === false,
    'popup_admission_before_dashboard');
  requireProof(!(await readSnapshot(send)).protection.isProtected, 'gate_did_not_register');
  return { before, gate };
}

export async function runDashboardFirstSiteJourney({ harness, page, send, capture, prepared, waitForSettled }) {
  const dom = expression => evaluate(harness.cdp, page.sessionId, expression);
  const nativeInputTraceKey = '__ENTROPY_QA_FIRST_SITE_NATIVE_INPUT__';
  await dom(`(() => {
    const key = ${JSON.stringify(nativeInputTraceKey)};
    if (globalThis[key]) throw new Error('QA_FIRST_SITE_NATIVE_TRACE_ALREADY_INSTALLED');
    const controller = new AbortController();
    let rafId = null;
    if (!PerformanceObserver.supportedEntryTypes.includes('long-animation-frame')) {
      throw new Error('QA_FIRST_SITE_LONG_FRAME_OBSERVER_UNSUPPORTED');
    }
    const recordLongFrames = entries => {
      for (const entry of entries) {
        for (const sample of trace.registrations) {
          if (entry.startTime >= sample.startedAtMs + 3500
            || entry.startTime + entry.duration <= sample.startedAtMs) continue;
          if (sample.longFrames.length >= 128) {
            sample.error = 'QA_FIRST_SITE_LONG_FRAME_OBSERVER_OVERFLOW';
            continue;
          }
          sample.longFrames.push(entry.toJSON());
        }
      }
    };
    const observer = new PerformanceObserver(list => recordLongFrames(list.getEntries()));
    const closeObservers = [];
    const trace = { events: [], registrations: [], expectedSelector: null, dispose: () => {
      controller.abort();
      if (rafId !== null) cancelAnimationFrame(rafId);
      recordLongFrames(observer.takeRecords());
      observer.disconnect();
      closeObservers.forEach(closeObserver => closeObserver.disconnect());
    } };
    observer.observe({ type: 'long-animation-frame' });
    const describe = node => node instanceof Element ? {
      tag: node.tagName.toLowerCase(), id: node.id || null,
      candidate: node.getAttribute('data-first-site-registration-candidate'),
      submit: node.hasAttribute('data-first-site-registration-submit'), controls: node.getAttribute('aria-controls'),
    } : null;
    for (const type of ['pointerdown', 'pointerup', 'click', 'focusin', 'keydown', 'input', 'submit']) {
      document.addEventListener(type, event => {
        const target = event.target;
        const editor = target instanceof Element ? target.closest('[data-first-site-registration-editor]') : null;
        if (type === 'submit' && editor) {
          const sample = { startedAtMs: performance.now(), editorClosedMs: null, editorRemovedMs: null, maxRafGapMs: 0,
            maxRafGap: null, longFrames: [], worker: [] };
          sample.startedAtEpochMs = performance.timeOrigin + sample.startedAtMs;
          trace.registrations.push(sample);
          const closeObserver = new MutationObserver(() => {
            if (editor.isConnected) return;
            sample.editorRemovedMs = performance.now() - sample.startedAtMs;
            closeObserver.disconnect();
          });
          closeObservers.push(closeObserver);
          closeObserver.observe(editor.parentElement, { childList: true, subtree: true });
          let previous = sample.startedAtMs, nextMetricsAt = previous, metricsPending = false;
          const observe = now => {
            if (now - previous > sample.maxRafGapMs) {
              sample.maxRafGapMs = now - previous;
              sample.maxRafGap = { fromMs: previous - sample.startedAtMs,
                toMs: now - sample.startedAtMs, editorPresent: Boolean(
                  document.querySelector('[data-first-site-registration-editor]')) };
            }
            previous = now;
            if (sample.editorClosedMs === null && !document.querySelector('[data-first-site-registration-editor]')) {
              sample.editorClosedMs = performance.now() - sample.startedAtMs;
            }
            if (now >= nextMetricsAt && !metricsPending) {
              nextMetricsAt = now + 50;
              metricsPending = true;
              globalThis.__ZEN_POND_WATER_EFFECTS_DEBUG.metrics().then(metrics => {
                sample.worker.push({ atMs: performance.now() - sample.startedAtMs,
                  frames: metrics.sampleFrames, frameMs: metrics.mainMetrics.frameMs,
                  entitySyncMs: metrics.mainMetrics.stageMs?.entitySyncMs,
                  materialPresence: metrics.mainMetrics.koiRender.firstSiteMaterialPresence });
              }).catch(error => { sample.error = error.message; }).finally(() => { metricsPending = false; });
            }
            if (!controller.signal.aborted && performance.now() - sample.startedAtMs < 3500) {
              rafId = requestAnimationFrame(observe);
            } else { sample.finished = true; rafId = null; }
          };
          rafId = requestAnimationFrame(observe);
        }
        const ancestry = [];
        for (let node = target; node instanceof Element && ancestry.length < 5; node = node.parentElement) {
          ancestry.push(describe(node));
        }
        trace.events.push({ type, trusted: event.isTrusted, atMs: performance.now(),
          expectedSelector: trace.expectedSelector,
          matchesExpected: target instanceof Element && trace.expectedSelector !== null
            && Boolean(target.closest(trace.expectedSelector)),
          target: describe(target), ancestry, active: describe(document.activeElement),
          x: event.clientX, y: event.clientY, key: event.key,
          value: target instanceof HTMLInputElement ? target.value : undefined,
          ariaBusy: editor?.getAttribute('aria-busy'),
        });
        if (trace.events.length > 80) trace.events.shift();
      }, { capture: true, signal: controller.signal });
    }
    globalThis[key] = trace;
    return true;
  })()`);
  const nativeFailure = async (code, selector, control) => {
    const trace = await dom(`globalThis[${JSON.stringify(nativeInputTraceKey)}].events`);
    throw new Error(code + ':' + JSON.stringify({ selector, control, nativeEvents: trace }));
  };
  const guidanceHealth = [];
  const readFromDashboard = message => dom(`(() => {
      if (location.origin !== ${JSON.stringify(`chrome-extension://${harness.extensionId}`)}
        || location.pathname !== '/src/pages/dashboard.html' || document.hidden) {
        throw new Error('QA_FIRST_SITE_DASHBOARD_SENDER_REQUIRED');
      }
      const startedAtMs = Date.now();
      const started = performance.now();
      return new Promise((resolve) => {
        chrome.runtime.sendMessage(${JSON.stringify(message)}, (response) => {
          resolve({ response, runtimeError: chrome.runtime.lastError?.message || null,
            startedAtMs, finishedAtMs: Date.now(), durationMs: performance.now() - started,
            senderPath: location.pathname });
        });
      });
    })()`);
  const readGuidanceHealth = async (phase, expectedProfileGeneration = null) => {
    const delivery = await readFromDashboard({ action: MESSAGE_ACTIONS.GET_GUIDANCE_STATE,
      surface: 'dashboard', ...(expectedProfileGeneration === null ? {} : { profileGeneration: expectedProfileGeneration }) });
    requireProof(delivery.runtimeError === null && delivery.response?.success === true,
      `guidance_query_${phase}:${delivery.runtimeError || delivery.response?.error || 'invalid_response'}`);
    const { response } = delivery;
    const state = response.result;
    requireProof(state?.contract === 'guidance_state_v1', `guidance_contract_${phase}`);
    requireProof(typeof response.profileGeneration === 'string' && response.profileGeneration.length > 0
      && state.profileGeneration === response.profileGeneration
      && (expectedProfileGeneration === null || state.profileGeneration === expectedProfileGeneration),
    `guidance_generation_${phase}`);
    requireProof(state.preview === false && state.firstVisionSpent === true
      && Number.isInteger(state.journeyDay) && state.journeyDay >= 0
      && state.journeyDay <= PROGRESSION_ARTIFACT_JOURNEY_TARGET_DAY_COUNT
      && state.canonicalJourneyDay === state.journeyDay
      && typeof state.installationAdmissionBlocked === 'boolean', `guidance_canonical_state_${phase}`);
    requireProof(state.receipts !== null && typeof state.receipts === 'object' && !Array.isArray(state.receipts)
      && Object.values(state.receipts).every((receipt) => receipt?.revision === 1
        && ['presentedAtMs', 'dismissedAtMs', 'completedAtMs'].every((field) => receipt[field] === null
          || Number.isInteger(receipt[field]) && receipt[field] >= 0)), `guidance_receipts_${phase}`);
    requireProof(Number.isFinite(delivery.durationMs) && delivery.durationMs >= 0
      && Number.isInteger(delivery.startedAtMs) && Number.isInteger(delivery.finishedAtMs),
    `guidance_read_timing_${phase}`);
    guidanceHealth.push({ phase, source: 'actual_dashboard_runtime_message', ...delivery, state });
    return state;
  };
  const until = async (read, predicate, step, timeoutMs = 30000) => {
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
      const value = await read();
      if (predicate(value)) return value;
      await sleep(100);
    }
    throw new Error('QA_FIRST_SITE_JOURNEY_TIMEOUT:' + step);
  };
  const click = async selector => {
    const deadline = Date.now() + 30000;
    let control;
    let previousRect = null;
    const readControl = (point = null) => dom(`(() => {
      const selector = ${JSON.stringify(selector)};
      globalThis[${JSON.stringify(nativeInputTraceKey)}].expectedSelector = selector;
      const node = document.querySelector(selector);
      const editor = node?.closest('[data-first-site-registration-editor]');
      const disabled = node ? node.matches(':disabled') || node.getAttribute('aria-disabled') === 'true' : null;
      const ariaBusy = editor?.getAttribute('aria-busy') ?? null;
      const r = node?.getBoundingClientRect();
      const visible = Boolean(r && r.width > 0 && r.height > 0
        && getComputedStyle(node).visibility === 'visible'
        && !node.closest('[hidden],[inert],[aria-hidden=true]'));
      const available = visible && disabled === false && (!editor || ariaBusy === 'false');
      if (available && ${point === null}) node.scrollIntoView({ block: 'nearest' });
      const rect = available ? node.getBoundingClientRect() : null;
      const center = rect ? { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 } : null;
      const candidate = ${JSON.stringify(point)} || center;
      const hit = candidate ? document.elementFromPoint(candidate.x, candidate.y) : null;
      const intendedHit = Boolean(node && hit && (node === hit || node.contains(hit)));
      return { exists: Boolean(node), disabled, ariaBusy, visible, available, intendedHit,
        hit: hit ? { tag: hit.tagName, id: hit.id,
          candidate: hit.closest('[data-first-site-registration-candidate]')?.getAttribute('data-first-site-registration-candidate') } : null,
        rect: rect ? { x: rect.x, y: rect.y, width: rect.width, height: rect.height } : null, point: center };
    })()`);
    while (Date.now() < deadline) {
      control = await readControl();
      const stable = control.available && control.intendedHit && previousRect
        && Object.keys(previousRect).every(key => Math.abs(previousRect[key] - control.rect[key]) < 0.5);
      if (stable) {
        const point = control.point;
        await harness.cdp.send('Input.dispatchMouseEvent', { type: 'mouseMoved', ...point }, page.sessionId);
        const proof = await readControl(point);
        if (proof.available && proof.intendedHit
          && Math.abs(proof.point.x - point.x) < 0.5 && Math.abs(proof.point.y - point.y) < 0.5) {
          control = proof;
          break;
        }
      }
      previousRect = control.available ? control.rect : null;
      await sleep(100);
    }
    if (!control?.available || !control.intendedHit || Date.now() >= deadline) {
      await nativeFailure('QA_FIRST_SITE_CONTROL_UNAVAILABLE', selector, control);
    }
    const point = control.point;
    await harness.cdp.send('Input.dispatchMouseEvent', { type: 'mouseMoved', ...point }, page.sessionId);
    for (const type of ['mousePressed', 'mouseReleased']) {
      await harness.cdp.send('Input.dispatchMouseEvent', { type, ...point, button: 'left',
        buttons: type === 'mousePressed' ? 1 : 0, clickCount: 1 }, page.sessionId);
    }
  };
  const navigationEvidence = [];
  const readNavigation = () => dom(`(() => {
    const sidebar = document.getElementById('dashboard-sidebar');
    const toggle = document.querySelector('button[aria-controls="dashboard-sidebar"]');
    return { placement: sidebar?.dataset.sidebarPlacement ?? null,
      hidden: sidebar?.getAttribute('aria-hidden') === 'true', inert: sidebar?.inert === true,
      togglePresent: Boolean(toggle), expanded: toggle?.getAttribute('aria-expanded') ?? null,
      activeTab: document.querySelector('[data-dashboard-active-tab]')?.dataset.dashboardActiveTab ?? null };
  })()`);
  const navigateTab = async tab => {
    const before = await readNavigation();
    requireProof(before.placement === 'docked' || before.placement === 'drawer', 'navigation_sidebar_owner');
    let opened = null;
    if (before.placement === 'drawer' && (before.hidden || before.inert)) {
      requireProof(before.hidden && before.inert && before.togglePresent && before.expanded === 'false',
        'navigation_closed_drawer_state');
      await click('button[aria-controls="dashboard-sidebar"]');
      opened = await until(readNavigation, value => value.placement === 'drawer' && !value.hidden
        && !value.inert && value.expanded === 'true', `navigation_drawer_open_${tab}`, 10000);
    }
    await click(`button[data-tab="${tab}"]`);
    const after = await until(readNavigation, value => value.activeTab === tab && (value.placement === 'docked'
      || value.placement === 'drawer' && value.hidden && value.inert && value.expanded === 'false'),
    `navigation_tab_selected_${tab}`, 10000);
    navigationEvidence.push({ tab, before, opened, after });
  };
  const editorPresent = () => dom('Boolean(document.querySelector("[data-first-site-registration-editor]"))');
  const editorCaptureReadiness = [];
  const captureEditor = async name => {
    const readiness = await until(() => dom(`(() => {
      const editor = document.querySelector('[data-first-site-registration-editor]');
      if (!editor) return null;
      const style = getComputedStyle(editor), rect = editor.getBoundingClientRect();
      return { opacity: Number(style.opacity), visible: !document.hidden && style.visibility === 'visible'
        && rect.width > 0 && rect.height > 0,
        insideViewport: rect.top >= 0 && rect.bottom <= innerHeight && rect.left >= 0 && rect.right <= innerWidth };
    })()`), value => value?.visible && value.insideViewport && value.opacity === 1,
    `editor_visual_settled_${name}`, 10000);
    editorCaptureReadiness.push({ name, ...readiness });
    await capture(name);
  };
  const enterText = async (selector, text) => {
    await click(selector);
    const focused = await dom(`document.activeElement === document.querySelector(${JSON.stringify(selector)})`);
    if (!focused) await nativeFailure('QA_FIRST_SITE_INPUT_FOCUS_MISMATCH', selector,
      await dom(`({ activeId: document.activeElement?.id, activeTag: document.activeElement?.tagName })`));
    await harness.cdp.send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'a', code: 'KeyA',
      modifiers: 2, windowsVirtualKeyCode: 65 }, page.sessionId);
    await harness.cdp.send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'a', code: 'KeyA',
      modifiers: 2, windowsVirtualKeyCode: 65 }, page.sessionId);
    await harness.cdp.send('Input.insertText', { text: String(text) }, page.sessionId);
    const value = await dom(`document.querySelector(${JSON.stringify(selector)}).value`);
    if (value !== String(text)) await nativeFailure('QA_FIRST_SITE_INPUT_VALUE_MISMATCH', selector,
      { expectedValue: String(text), actualValue: value });
  };
  const inspectEditor = () => dom(`(() => {
    const d = document.querySelector('[data-first-site-registration-editor]');
    if (!d) return null;
    const r = d.getBoundingClientRect();
    const candidate = d.querySelector('[data-first-site-registration-candidate]');
    const goal = d.querySelector('#zen-invitation-koi-goal');
    const slider = d.querySelector('#zen-invitation-koi-goal-slider');
    return { candidateDomain: candidate?.getAttribute('data-first-site-registration-candidate') ?? null,
      candidateText: candidate?.textContent ?? null,
      domain: d.querySelector('#zen-invitation-koi-domain')?.value ?? null,
      goalMinutes: goal ? Number(goal.value) : null,
      sliderMinutes: slider ? Number(slider.value) : null,
      focus: document.activeElement?.id ?? null,
      submitFocused: Boolean(document.activeElement?.matches('[data-first-site-registration-submit]')),
      modal: Boolean(d.closest('[role=dialog],[aria-modal=true]')),
      width: r.width, height: r.height,
      insideViewport: r.top >= 0 && r.bottom <= innerHeight && r.left >= 0 && r.right <= innerWidth };
  })()`);
  const registerFixtureViaEditor = async () => {
    await enterText('#zen-invitation-koi-domain', FIRST_SITE_FIXTURE_DOMAIN);
    const draft = await inspectEditor();
    requireProof(draft.goalMinutes === null && draft.sliderMinutes === null, 'registration_has_no_time_controls');
    await click('[data-first-site-registration-submit]');
    // Keep screenshot capture, removal and the next registration outside this
    // measurement window; they are not costs of submitting the current editor.
    await until(() => dom(`globalThis[${JSON.stringify(nativeInputTraceKey)}]
      .registrations.at(-1)?.finished === true`), Boolean, 'registration_observation_complete', 6000);
  };
  const visited = await readSnapshot(send);
  requireProof(visited.access.requiresDashboardRegistration === true,
    'dashboard_visit_does_not_end_registration_journey');
  await until(editorPresent, Boolean, 'url_intent_opens_editor');
  const intentPicker = await inspectEditor();
  requireProof(intentPicker.candidateDomain === FIRST_SITE_FIXTURE_DOMAIN
    && intentPicker.candidateText.includes(FIRST_SITE_FIXTURE_DOMAIN)
    && intentPicker.goalMinutes === null && intentPicker.sliderMinutes === null && intentPicker.submitFocused
    && !intentPicker.modal && intentPicker.insideViewport, 'url_intent_candidate_focus_layout');
  await captureEditor('intent-picker');
  await click('[data-first-site-registration-edit]');
  const editedIntent = await until(inspectEditor, value => value?.domain === FIRST_SITE_FIXTURE_DOMAIN
    && value.goalMinutes === null && value.sliderMinutes === null,
    'carried_intent_expands_with_same_domain');
  requireProof(!editedIntent.modal && editedIntent.insideViewport, 'carried_intent_edit_stays_inline');
  await click('[data-first-site-registration-cancel]');
  await until(editorPresent, value => !value, 'url_intent_cancel');
  requireProof(!(await readSnapshot(send)).protection.isProtected, 'url_intent_is_uncommitted');
  const consumedIntentUrl = await dom(`(() => {
    const params = new URLSearchParams(location.search);
    return { setup: params.get('setup'), domain: params.get('domain'), goalMinutes: params.get('goalMinutes') };
  })()`);
  requireProof(Object.values(consumedIntentUrl).every(value => value === null),
    'accepted_intent_url_consumed_without_replay');
  const initialGuidance = await until(() => readGuidanceHealth('invitation'),
    state => Number.isInteger(state.receipts['garden.first_site']?.presentedAtMs),
    'first_site_guidance_presented');
  const starterRead = await readFromDashboard({ action: MESSAGE_ACTIONS.GET_ARTIFACT_DISCLOSURE_SNAPSHOT,
    profileGeneration: initialGuidance.profileGeneration });
  requireProof(starterRead.runtimeError === null && starterRead.response?.success === true
    && starterRead.response.profileGeneration === initialGuidance.profileGeneration,
    `starter_disclosure_query:${starterRead.runtimeError || starterRead.response?.error || 'invalid_response'}`);
  const starterDisclosure = starterRead.response.snapshot;
  requireProof(starterDisclosure?.unlockProgress?.canonicalQualifiedUseDayCount === 0
    && starterDisclosure.disclosedFamilyIds?.length === PROGRESSION_JOURNEY_STARTER_FAMILY_IDS.length
    && PROGRESSION_JOURNEY_STARTER_FAMILY_IDS.every((family) => starterDisclosure.disclosedFamilyIds.includes(family)
      && starterDisclosure.entriesByFamilyId?.[family]?.visible === true
      && starterDisclosure.entriesByFamilyId[family].configurable === true
      && starterDisclosure.entriesByFamilyId[family].runtimeEligible === true), 'starter_disclosure_after_first_vision');
  const inspectStarterGallery = () => dom(`(() => {
    const tools = document.getElementById('tools');
    const navigation = tools?.querySelector('[data-artifact-gallery-index="path"]');
    const visible = (node) => {
      if (!node || node.closest('[hidden],[inert],[aria-hidden=true]')) return false;
      const rect = node.getBoundingClientRect();
      return rect.width > 1 && rect.height > 1 && rect.bottom > 0 && rect.right > 0
        && rect.top < innerHeight && rect.left < innerWidth && getComputedStyle(node).visibility === 'visible';
    };
    const canvas = tools?.querySelector('canvas[data-zen-artifact-engine="gallery"]');
    const order = navigation ? navigation.dataset.artifactPathOrder.split('|') : [];
    const locked = navigation ? navigation.dataset.artifactPathLocked.split('|') : [];
    const items = order.map(familyId => ({
      familyId,
      locked: locked.includes(familyId),
      available: visible(navigation) && !locked.includes(familyId)
        && Boolean(navigation.getAttribute('aria-label')),
      selected: navigation.dataset.artifactPathCurrent === familyId,
      loadState: canvas?.dataset.zenArtifactEngineStatus === 'ready' ? 'idle' : 'pending',
    }));
    return { activeTab: document.querySelector('[data-dashboard-active-tab]')?.dataset.dashboardActiveTab,
      visible: visible(navigation), items, controlsVisible: visible(tools?.querySelector('[data-artifact-control-rail]')) };
  })()`);
  const verifyStarterGallery = async () => {
    await navigateTab('tools');
    const starterGallery = await until(inspectStarterGallery, value => value.activeTab === 'tools' && value.visible
      && value.items.filter(item => !item.locked && item.available).length === PROGRESSION_JOURNEY_STARTER_FAMILY_IDS.length
      && PROGRESSION_JOURNEY_STARTER_FAMILY_IDS.every(family => value.items.some(item => item.familyId === family
        && !item.locked && item.available)), 'starter_gallery_accessible_after_first_vision', 10000);
    const starterSelections = [];
    for (const family of PROGRESSION_JOURNEY_STARTER_FAMILY_IDS) {
      await dom(`(${artifactGallerySelection.toString()})('QA_FIRST_SITE_GALLERY', () =>
        document.querySelector('canvas[data-zen-artifact-engine="gallery"]')?.dataset.zenArtifactEngineStatus === 'ready'
      ).select(${JSON.stringify(family)})`);
      const selection = await until(inspectStarterGallery, value => value.activeTab === 'tools' && value.controlsVisible
        && value.items.some(item => item.familyId === family && !item.locked && item.available && item.selected
          && item.loadState === 'idle'), `starter_selection_${family}`, 10000);
      starterSelections.push({ familyId: family, selection });
    }
    await capture('starters');
    await navigateTab('main');
    await until(() => dom('document.querySelector("[data-dashboard-active-tab]")?.dataset.dashboardActiveTab'),
      value => value === 'main', 'main_return_from_starters', 10000);
    await waitForSettled();
    return { starterGallery, starterSelections };
  };
  await capture('invitation');
  const invitationHitPresent = () => dom('document.querySelector("[data-first-site-registration-entry]")?.dataset.invitationAttending === "true"');
  const acquireInvitationHit = async () => {
    const water = await dom(`(() => {
      const canvas = document.querySelector('[data-main-presentation-surface="pond"] canvas');
      if (!canvas) throw new Error('QA_FIRST_SITE_POND_CANVAS_MISSING');
      const r = canvas.getBoundingClientRect();
      if (r.width <= 0 || r.height <= 0) throw new Error('QA_FIRST_SITE_POND_CANVAS_HIDDEN');
      return { x: r.x, y: r.y, width: r.width, height: r.height };
    })()`);
    // Pointer leave clears the previously acknowledged hover. The button's
    // attending field projects worker hoverAction hit feedback, not the fish's
    // wider behavioral attendance radius. A screenshot does not refresh it.
    const deadline = Date.now() + 30000;
    await harness.cdp.send('Input.dispatchMouseEvent', { type: 'mouseMoved',
      x: water.x - 4, y: water.y - 4 }, page.sessionId);
    await until(invitationHitPresent, value => !value, 'invitation_hover_cleared',
      Math.max(1, deadline - Date.now()));
    const axis = (extent, spacing) => {
      const start = Math.min(16, extent / 4);
      const span = extent - start * 2;
      const steps = Math.max(1, Math.ceil(span / spacing));
      return Array.from({ length: steps + 1 }, (_, index) => start + span * index / steps);
    };
    let attemptedPoints = 0;
    // Search outward from the water's centre before refining. Every point still
    // requires actual worker hover
    // feedback for 180ms while the pointer stays still before it can be clicked.
    for (const spacing of [64, 32]) {
      const xs = axis(water.width, spacing)
        .sort((a, b) => Math.abs(a - water.width / 2) - Math.abs(b - water.width / 2));
      const ys = axis(water.height, spacing)
        .sort((a, b) => Math.abs(a - water.height / 2) - Math.abs(b - water.height / 2));
      for (const x of xs) {
        for (const y of ys) {
          if (Date.now() + 240 >= deadline) break;
          const point = { x: water.x + x, y: water.y + y };
          await harness.cdp.send('Input.dispatchMouseEvent', { type: 'mouseMoved', ...point }, page.sessionId);
          attemptedPoints += 1;
          await sleep(60);
          if (!await invitationHitPresent()) continue;
          await sleep(180);
          if (Date.now() < deadline && await invitationHitPresent()) return { point, attemptedPoints, water,
            spacing, candidatePointCount: xs.length * ys.length, acknowledgedAtMs: Date.now() };
        }
      }
    }
    const error = new Error('QA_FIRST_SITE_JOURNEY_FAILED:visible_invitation_hit_and_hover_feedback');
    error.diagnostic = { water, attemptedPoints, snapshot: await readSnapshot(send),
      presentation: await dom(`(async () => {
        const entry = document.querySelector('[data-first-site-registration-entry]');
        const metrics = await globalThis.__ZEN_POND_WATER_EFFECTS_DEBUG.metrics();
        return { entry: entry ? { attending: entry.dataset.invitationAttending,
          firstUseHint: entry.dataset.firstUseHint, rect: entry.getBoundingClientRect().toJSON() } : null,
          koi: metrics.mainMetrics.koiRender, frames: metrics.sampleFrames,
          readiness: document.querySelector('[data-pond-readiness-phase]')?.dataset.pondReadinessPhase,
          runtimeHealth: metrics.runtimeHealth,
          registrations: globalThis[${JSON.stringify(nativeInputTraceKey)}].registrations };
      })()`) };
    throw error;
  };
  const clickAcknowledgedInvitation = async hit => {
    const clickDispatchedAtMs = Date.now();
    for (const type of ['mousePressed', 'mouseReleased']) {
      await harness.cdp.send('Input.dispatchMouseEvent', { type, ...hit.point, button: 'left',
        buttons: type === 'mousePressed' ? 1 : 0, clickCount: 1 }, page.sessionId);
    }
    return clickDispatchedAtMs;
  };
  const invitationHover = await acquireInvitationHit();
  await capture('invitation-hover');
  // The koi keeps swimming during capture. Reacquire its real hit immediately
  // before input instead of treating a photographed coordinate as a live target.
  const invitationClick = await acquireInvitationHit();
  const koiPoint = invitationClick.point;
  const clickDispatchedAtMs = await clickAcknowledgedInvitation(invitationClick);
  await until(editorPresent, Boolean, 'editor_open');
  const picker = await inspectEditor();
  requireProof(picker.focus === 'zen-invitation-koi-domain'
    && picker.goalMinutes === null && picker.sliderMinutes === null
    && !picker.modal && picker.insideViewport, 'native_editor_focus_without_time_layout');
  await captureEditor('picker');
  await click('[data-first-site-registration-cancel]');
  await until(editorPresent, value => !value, 'editor_cancel');
  const cancelled = await readSnapshot(send);
  requireProof(!cancelled.protection.isProtected && cancelled.access.managedSiteCount === 0,
    'cancel_does_not_register');
  await click('[data-first-site-registration-entry]');
  await until(editorPresent, Boolean, 'editor_reopen');
  await registerFixtureViaEditor();
  const registered = await until(() => readSnapshot(send), value => value.protection.isProtected,
    'one_click_registration');
  await until(editorPresent, value => !value, 'successful_editor_close');
  requireProof(registered.protection.goalMinutes === 0
    && registered.access.managedSiteCount === 1 && registered.access.requiresDashboardRegistration === true
    && registered.access.sitesManagementVisible === true,
    'site_registered_without_time_goal');
  const completion = await until(() => dom(`(() => {
    const node = document.querySelector('[data-first-site-registration-feedback]');
    if (!node) return null;
    const r = node.getBoundingClientRect();
    return { domain: node.dataset.firstSiteRegistrationFeedback, text: node.textContent,
      role: node.getAttribute('role'), liveStatus: node.getAttribute('aria-live'),
      insideViewport: r.top >= 0 && r.bottom <= innerHeight && r.left >= 0 && r.right <= innerWidth };
  })()`), Boolean, 'completion_feedback');
  requireProof(completion.domain === FIRST_SITE_FIXTURE_DOMAIN
    && completion.role === 'status' && completion.liveStatus === 'polite'
    && completion.insideViewport, 'completion_receipt_and_layout');
  const firstAssignment = await until(() => dom(`(async () => {
    const metrics = await globalThis.__ZEN_POND_WATER_EFFECTS_DEBUG.metrics();
    return { firstSiteRevealCount: metrics.mainMetrics.koiRender.firstSiteRevealCount,
      visibleFishCount: metrics.mainMetrics.koiRender.visibleFishCount,
      shadowSentinelCount: metrics.mainMetrics.koiRender.shadowSentinelCount,
      invitationEnteringCount: metrics.mainMetrics.koiRender.invitationEnteringCount,
      fishCount: metrics.mainMetrics.koiRender.fishCount };
  })()`), value => value.firstSiteRevealCount === 1 && value.visibleFishCount >= 1
    && value.fishCount === 1 && value.shadowSentinelCount === 0 && value.invitationEnteringCount === 0,
    'shadow_assignment_consumes_final_slot');
  const completedGuidance = await readGuidanceHealth('completion', initialGuidance.profileGeneration);
  requireProof(Number.isInteger(completedGuidance.receipts['garden.first_site']?.completedAtMs),
    'first_site_guidance_completion_settled');
  await capture('completion');
  const postRegistrationPond = await until(() => dom(`(async () => {
    const metrics = await globalThis.__ZEN_POND_WATER_EFFECTS_DEBUG.metrics();
    return { visibleFishCount: metrics.mainMetrics.koiRender.visibleFishCount,
      shadowSentinelCount: metrics.mainMetrics.koiRender.shadowSentinelCount,
      invitationEnteringCount: metrics.mainMetrics.koiRender.invitationEnteringCount };
  })()`), value => value.visibleFishCount === 1 && value.invitationEnteringCount === 0
      && value.shadowSentinelCount === 0, 'no_successor_when_daily_capacity_filled', 30000);
  requireProof(await dom('!document.querySelector("[data-first-site-registration-entry]")'),
    'full_capacity_has_no_registration_shadow_entry');
  const fullCapacityHandoff = await send({ action: MESSAGE_ACTIONS.POPUP_QUEUE_BLOCK_DOMAIN,
    domain: 'other.localhost' });
  requireProof(fullCapacityHandoff?.success === true && fullCapacityHandoff.requiresDashboard === true
    && fullCapacityHandoff.pending === false, 'early_popup_remains_dashboard_handoff');
  requireProof((await readSnapshot(send)).access.managedSiteCount === 1, 'handoff_did_not_register');
  await capture('slot-filled');
  const { starterGallery, starterSelections } = await verifyStarterGallery();
  const removal = await send({ action: MESSAGE_ACTIONS.REMOVE_SITE_RULE,
    domain: FIRST_SITE_FIXTURE_DOMAIN, type: 'blocked', waitForPropagation: true });
  requireProof(removal?.success === true, 'remove_final_site');
  const removed = await readSnapshot(send);
  requireProof(!removed.protection.isProtected && removed.access.managedSiteCount === 0
    && removed.access.requiresDashboardRegistration === true && removed.access.sitesManagementVisible === true,
    'last_site_removal_keeps_management_without_completing_journey');
  const restore = await send({ action: MESSAGE_ACTIONS.POPUP_COMMIT_BLOCK_DOMAIN,
    domain: FIRST_SITE_FIXTURE_DOMAIN });
  requireProof(restore?.success === true && restore.blocked === false && restore.requiresDashboard === true
    && restore.pending === false, 'later_popup_cannot_bypass_early_journey');
  requireProof(!(await readSnapshot(send)).protection.isProtected, 'restore_handoff_is_uncommitted');
  await until(() => dom(`(async () => {
    const metrics = await globalThis.__ZEN_POND_WATER_EFFECTS_DEBUG.metrics();
    return metrics.mainMetrics.koiRender.shadowSentinelCount === 1;
  })()`), Boolean,
    'removed_site_restores_registration_slot');
  // The completed discovery guide no longer exposes the native entry by itself.
  // Reacquire and click the restored shadow's actual worker-acknowledged body.
  const restorationClick = await acquireInvitationHit();
  const restorationDispatchedAtMs = await clickAcknowledgedInvitation(restorationClick);
  await until(editorPresent, Boolean, 'restore_editor_open');
  await registerFixtureViaEditor();
  const restored = await until(() => readSnapshot(send), value => value.protection.isProtected,
    'restore_via_main_registration');
  await until(editorPresent, value => !value, 'restore_editor_closed');
  requireProof(restored.protection.goalMinutes === 0
    && restored.access.managedSiteCount === 1, 'restored_site_registered_without_time_goal');
  // Registration/removal rebuilds the canonical bonsai picture. Its accepted
  // painted state, rather than a fixed delay, owns the final capture admission.
  await waitForSettled();
  await readGuidanceHealth('registered', initialGuidance.profileGeneration);
  await until(() => dom(`(async () => {
    const metrics = await globalThis.__ZEN_POND_WATER_EFFECTS_DEBUG.metrics();
    return metrics.mainMetrics.koiRender.firstSiteMaterialPresence;
  })()`), value => value === 1, 'restored_material_complete');
  await capture('registered');
  const nativeInputEvidence = await dom(`(() => {
    const key = ${JSON.stringify(nativeInputTraceKey)};
    const trace = globalThis[key];
    trace.dispose();
    delete globalThis[key];
    return { events: trace.events, registrations: trace.registrations };
  })()`);
  requireProof(nativeInputEvidence.registrations.length >= 2
    && nativeInputEvidence.registrations.every(sample => !sample.error && sample.finished
      && sample.worker.length > 0),
    'registration_observations_available');
  const firstTransition = nativeInputEvidence.registrations[0].worker;
  requireProof(firstTransition.some(sample => sample.materialPresence > 0 && sample.materialPresence < 1)
    && firstTransition.some(sample => sample.materialPresence === 1), 'registration_material_transition');
  return { prepared, visited, koiPoint, guidanceHealth,
    nativeInputEvidence: nativeInputEvidence.events, registrationObservations: nativeInputEvidence.registrations,
    editorCaptureReadiness, navigationEvidence,
    starterAccess: { disclosureRead: starterRead, gallery: starterGallery, selections: starterSelections },
    invitationHitEvidence: { beforeCapture: invitationHover, beforeClick: invitationClick,
      acknowledgedToClickMs: clickDispatchedAtMs - invitationClick.acknowledgedAtMs,
      restoration: { beforeClick: restorationClick,
        acknowledgedToClickMs: restorationDispatchedAtMs - restorationClick.acknowledgedAtMs } },
    intentPicker, editedIntent, consumedIntentUrl, picker, cancelled, registered, completion, firstAssignment, postRegistrationPond,
    fullCapacityHandoff, removed, restore, restored,
    permissionScope: 'pregranted_named_loopback_fixture; Chrome_permission_prompt_not_measured',
    inputScope: 'owned_dashboard_target_native_mouse_and_keyboard; no_repeated_activation_or_OS_focus' };
}
