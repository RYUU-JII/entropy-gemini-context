import { DASHBOARD_BOOT_EVENT_NAME } from '../../../src/apps/dashboard/bootstrap/bootEvents.js';
import { evaluate, sleep } from '../../e2e/extensionChromiumHarness.mjs';

const BINDING = '__entropyQaBootInteractionReady';
function observeInteraction(bootEventName, binding) {
  const state = { status: 'waiting', events: [], eventTimings: [], longTasks: [], revealAt: null,
    eventTimingSupported: PerformanceObserver.supportedEntryTypes.includes('event') };
  window.__ENTROPY_QA_BOOT_INTERACTION__ = state;
  const observers = [];
  if (state.eventTimingSupported) {
    const observer = new PerformanceObserver(list => {
      for (const e of list.getEntries()) {
        if (state.eventTimings.length >= 80) { state.overflow = true; break; }
        state.eventTimings.push({ name: e.name, startTime: e.startTime,
          inputDelayMs: e.processingStart - e.startTime, processingMs: e.processingEnd - e.processingStart,
          durationMs: e.duration, interactionId: e.interactionId });
      }
    });
    observer.observe({ type: 'event', durationThreshold: 16 }); observers.push(observer);
  }
  const tasks = new PerformanceObserver(list => {
    for (const e of list.getEntries()) {
      if (state.longTasks.length >= 100) { state.overflow = true; break; }
      if (state.revealAt !== null) state.longTasks.push({ startTime: e.startTime, duration: e.duration });
    }
  });
  tasks.observe({ type: 'longtask' }); observers.push(tasks);
  const listen = event => {
    if (state.revealAt === null || !event.target.closest?.('button[data-tab="sites"]')) return;
    if (state.events.length >= 80) { state.overflow = true; return; }
    state.events.push({ type: event.type, trusted: event.isTrusted, timestamp: event.timeStamp,
      observedAt: performance.now(), queueToCaptureMs: performance.now() - event.timeStamp });
    if (event.type === 'click') state.clickAt = event.timeStamp;
  };
  const types = ['pointerover', 'pointerdown', 'pointerup', 'click'];
  for (const type of types) window.addEventListener(type, listen, true);
  let raf = 0;
  const checkReady = () => {
    const activeTab = document.querySelector('[data-dashboard-active-tab]')?.dataset.dashboardActiveTab;
    const ready = activeTab === 'sites' && document.getElementById('sites-tab')
      && !document.querySelector('[data-testid="sites-tab-loading"], [data-testid="sites-tab-error"]');
    if (state.clickAt !== undefined && ready) {
      state.readyAt = performance.now();
      requestAnimationFrame(() => {
        state.nextFrameAt = performance.now(); state.status = 'complete';
      });
    } else raf = requestAnimationFrame(checkReady);
  };
  window.addEventListener(bootEventName, function onBoot(event) {
    if (state.revealAt !== null || event.detail?.shellDismissed !== true) return;
    window.removeEventListener(bootEventName, onBoot);
    state.revealAt = performance.now();
    window[binding]('ready');
    raf = requestAnimationFrame(checkReady);
  });
  state.dispose = () => {
    cancelAnimationFrame(raf);
    for (const observer of observers) observer.disconnect();
    for (const type of types) window.removeEventListener(type, listen, true);
  };
}

export async function installDashboardBootInteractionProbe(harness, page, scenario) {
  const { cdp } = harness;
  let started = false, dispatchOutcome = null;
  const release = cdp.subscribe('Runtime.bindingCalled', event => {
    if (event.sessionId !== page.sessionId || event.params?.name !== BINDING || started) return;
    started = true;
    // Capture errors immediately, even when boot completion is still being awaited.
    dispatchOutcome = (async () => {
      if (scenario === 'warmup') await sleep(1400);
      const point = await evaluate(cdp, page.sessionId, `(() => {
        const button = document.querySelector('button[data-tab="sites"]');
        if (!button || button.disabled) throw new Error('QA_BOOT_INPUT_TARGET_MISSING');
        const rect = button.getBoundingClientRect();
        const x = rect.x + rect.width / 2, y = rect.y + rect.height / 2;
        if (!rect.width || !rect.height || !button.contains(document.elementFromPoint(x, y)))
          throw new Error('QA_BOOT_INPUT_TARGET_OCCLUDED');
        return { x, y };
      })()`);
      await cdp.send('Input.dispatchMouseEvent', { type: 'mouseMoved', ...point }, page.sessionId);
      await sleep(60);
      await cdp.send('Input.dispatchMouseEvent', { type: 'mousePressed', button: 'left', buttons: 1, clickCount: 1, ...point }, page.sessionId);
      await cdp.send('Input.dispatchMouseEvent', { type: 'mouseReleased', button: 'left', buttons: 0, clickCount: 1, ...point }, page.sessionId);
      return { error: null };
    })().catch(error => ({ error: error.message }));
  });
  try {
    await cdp.send('Runtime.addBinding', { name: BINDING }, page.sessionId);
    await cdp.send('Page.addScriptToEvaluateOnNewDocument', {
      source: `(${observeInteraction.toString()})(${JSON.stringify(DASHBOARD_BOOT_EVENT_NAME)}, ${JSON.stringify(BINDING)});`,
    }, page.sessionId);
  } catch (error) { release(); throw error; }
  return {
    async collect(signal) {
      const deadline = Date.now() + 12_000;
      while (Date.now() < deadline) {
        signal?.throwIfAborted();
        if (dispatchOutcome) {
          const outcome = await dispatchOutcome;
          if (outcome.error) throw new Error(outcome.error);
        }
        const state = await evaluate(cdp, page.sessionId, `(() => {
          const { dispose, ...state } = window.__ENTROPY_QA_BOOT_INTERACTION__;
          return state;
        })()`);
        if (state.status === 'complete') {
          // Event Timing is delivered after paint; retain a bounded flush interval.
          await sleep(100);
          const result = await evaluate(cdp, page.sessionId, `(() => {
            const state = window.__ENTROPY_QA_BOOT_INTERACTION__; state.dispose();
            const { dispose, ...result } = state; return result;
          })()`);
          if (result.overflow || !result.events.some(e => e.type === 'click' && e.trusted))
            throw new Error('QA_BOOT_INPUT_EVIDENCE_INVALID');
          return { scenario, ...result, clickAfterRevealMs: result.clickAt - result.revealAt,
            clickToReadyMs: result.readyAt - result.clickAt,
            clickToNextFrameMs: result.nextFrameAt - result.clickAt };
        }
        await sleep(50);
      }
      throw new Error('QA_BOOT_INPUT_COMPLETION_TIMEOUT');
    },
    dispose: release,
  };
}
