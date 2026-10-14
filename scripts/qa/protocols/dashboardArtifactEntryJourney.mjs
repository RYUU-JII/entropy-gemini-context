import { evaluate } from '../../e2e/extensionChromiumHarness.mjs';
import { installArtifactWebGlStartupProbe } from './dashboardArtifactStartupProbe.mjs';
import { installArtifactUiEntryProbe } from './dashboardArtifactUiEntryDiagnostics.mjs';

export function summarizeArtifactEntryLongTasks(tasks, started, finished) {
  const overlapping = tasks.filter(task => task.startTime < finished && task.startTime + task.duration > started)
    .map(task => ({ ...task, overlapMs: Math.min(finished, task.startTime + task.duration) - Math.max(started, task.startTime) }));
  return { longTasks: overlapping,
    longTaskTotalMs: overlapping.reduce((sum, task) => sum + task.duration, 0),
    longTaskOverlapMs: overlapping.reduce((sum, task) => sum + task.overlapMs, 0) };
}

// Uses only this capture's existing page and actual sidebar controls. The first
// entry has no synthetic hover/preload lead; later entries reuse the same canvas.
export async function runDashboardArtifactEntryJourney(harness, page, { startupDiagnostics = false, uiDiagnostics = false, uiExperiment = 'none', fromTab = 'sites' } = {}) {
  const result = await evaluate(harness.cdp, page.sessionId, `(${async function journey(installProbe, installUiProbe, experiment, initialTab, summarizeLongTasks) {
    const selector = 'canvas[data-zen-artifact-engine="gallery"]';
    // Zen Sites belongs to the retained garden pane. Rhythm is an actual
    // sidebar destination that leaves Tools for every entry origin.
    const parkTab = 'schedule';
    const activeTab = () => document.querySelector('[data-dashboard-active-tab]')?.dataset.dashboardActiveTab;
    const navigate = tab => {
      const control = document.querySelector('#dashboard-sidebar button[data-tab="' + tab + '"]');
      if (!control || control.disabled) throw new Error('QA_ARTIFACT_ENTRY_NAVIGATION_REQUIRED:' + tab);
      control.click();
    };
    const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
    const wait = async (predicate, step) => {
      const start = performance.now();
      while (!predicate()) {
        if (performance.now() - start > 20000) throw new Error('QA_ARTIFACT_ENTRY_TIMEOUT:' + step);
        await pause(8);
      }
    };
    const paint = async () => {
      let timer;
      try {
        await Promise.race([
          new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))),
          new Promise((_, reject) => { timer = setTimeout(() => reject(new Error('QA_ARTIFACT_ENTRY_PAINT_TIMEOUT')), 10000); }),
        ]);
      } finally { clearTimeout(timer); }
    };
    const read = canvas => {
      canvas.dispatchEvent(new Event('zen-artifact-engine-inspect'));
      return JSON.parse(canvas.dataset.zenArtifactEngineSnapshot);
    };
    const samples = [], longTasks = [], frameEvents = [];
    let canvas = null, frameRequest = 0, lastFrame = null, firstRafAtMs = null, maxFrameGapMs = 0;
    let step = 'initial';
    let startupProbe = null, startupDiagnostics = null, uiProbe = null, sinkWarmup = null;
    const recordTasks = entries => {
      for (const entry of entries) longTasks.push({ startTime: entry.startTime, duration: entry.duration });
    };
    const observer = new PerformanceObserver(list => recordTasks(list.getEntries()));
    observer.observe({ type: 'longtask' });
    const recordFrame = event => {
      if (event.target.matches?.(selector) && frameEvents.length < 128) frameEvents.push(structuredClone(event.detail));
    };
    document.addEventListener('zen-artifact-frame', recordFrame);
    const sampleFrame = now => {
      if (lastFrame !== null) maxFrameGapMs = Math.max(maxFrameGapMs, now - lastFrame);
      else firstRafAtMs = performance.now();
      lastFrame = now;
      frameRequest = requestAnimationFrame(sampleFrame);
    };
    try {
      if (!['main', 'sites'].includes(initialTab) || activeTab() !== initialTab || document.querySelector(selector)) throw new Error('QA_ARTIFACT_ENTRY_INITIAL_STATE_INVALID');
      if (experiment === 'warm-bitmap-sink') {
        const warmStarted = performance.now();
        const warmCanvas = document.createElement('canvas');
        warmCanvas.width = 1; warmCanvas.height = 1;
        warmCanvas.style.cssText = 'position:fixed;left:0;bottom:0;width:1px;height:1px;pointer-events:none;z-index:2147483647';
        let bitmap = null;
        try {
          bitmap = await createImageBitmap(new ImageData(new Uint8ClampedArray([128, 128, 128, 255]), 1, 1));
          const sink = warmCanvas.getContext('bitmaprenderer');
          if (!sink) throw new Error('QA_ARTIFACT_UI_BITMAP_SINK_UNAVAILABLE');
          document.body.appendChild(warmCanvas);
          sink.transferFromImageBitmap(bitmap); bitmap = null;
          await paint();
        } finally { bitmap?.close(); warmCanvas.remove(); }
        sinkWarmup = { durationMs: performance.now() - warmStarted, canvasRemoved: !warmCanvas.isConnected };
      }
      if (installProbe) startupProbe = installProbe();
      if (installUiProbe) uiProbe = installUiProbe(experiment);
      for (let index = 0; index < 4; index += 1) {
        // Install/drain observers before the task containing this click begins.
        await pause(0);
        recordTasks(observer.takeRecords());
        longTasks.length = 0; frameEvents.length = 0;
        step = index === 0 ? 'first-entry' : 'return-' + index;
        if (document.visibilityState !== 'visible') throw new Error('QA_ARTIFACT_ENTRY_DOCUMENT_HIDDEN');
        const before = canvas ? read(canvas) : null;
        lastFrame = null; firstRafAtMs = null; maxFrameGapMs = 0;
        frameRequest = requestAnimationFrame(sampleFrame);
        const started = performance.now();
        if (uiProbe) performance.mark('entropy-qa:artifact-entry:' + step + ':start');
        const phases = [];
        let lastPhase = '';
        navigate('tools');
        await wait(() => {
          const node = document.querySelector(selector);
          const loading = document.querySelector('[data-loading-frame="artifact-workspace"]');
          const phase = [activeTab(), loading ? 'workspace-loading' : 'workspace', node ? node.dataset.zenArtifactEngineStatus || 'canvas-mounted' : 'no-canvas'].join(':');
          if (phase !== lastPhase) {
            phases.push({ phase, atMs: performance.now() - started });
            lastPhase = phase;
          }
          return activeTab() === 'tools' && frameEvents.some(event => event.type === 'commit' && event.atMs >= started)
            && node?.dataset.zenArtifactEngineStatus === 'ready'
            && node.getBoundingClientRect().width > 0;
        }, step);
        const readyMs = performance.now() - started;
        const firstCommit = frameEvents.find(event => event.type === 'commit' && event.atMs >= started);
        if (uiProbe) performance.mark('entropy-qa:artifact-entry:' + step + ':ready');
        await paint();
        const finished = performance.now();
        if (uiProbe) performance.mark('entropy-qa:artifact-entry:' + step + ':paint');
        cancelAnimationFrame(frameRequest);
        const current = document.querySelector(selector);
        if (canvas && canvas !== current) throw new Error('QA_ARTIFACT_ENTRY_CANVAS_REPLACED');
        canvas = current;
        const after = read(canvas);
        await pause(60); // Deliver the bounded observer queue after the paint opportunity.
        recordTasks(observer.takeRecords());
        if (frameEvents.length === 128) throw new Error('QA_ARTIFACT_ENTRY_EVENT_CAPACITY');
        samples.push({ kind: step, startedAtMs: started, readyMs, paintOpportunityMs: finished - started, maxFrameGapMs,
          firstRafMs: firstRafAtMs - started, firstCommitMs: firstCommit.atMs - started, firstCommit,
          frameEvents: frameEvents.filter(event => event.atMs >= started && event.atMs <= finished),
          phases, tabEntry: window.__ENTROPY_TAB_ENTRY_TELEMETRY__.getSnapshot(),
          ...summarizeLongTasks(longTasks, started, finished),
          receipt: firstCommit.receipt, before, after });
        if (index === 0 && startupProbe) startupDiagnostics = startupProbe.stop();
        if (index < 3) {
          step = 'park-' + (index + 1);
          navigate(parkTab);
          await wait(() => activeTab() === parkTab, step);
          await pause(650);
          if (read(canvas).loopRunning) throw new Error('QA_ARTIFACT_ENTRY_PARKED_LOOP');
        }
      }
      return { fromTab: initialTab, parkTab, samples, startupDiagnostics, sinkWarmup, uiDiagnostics: uiProbe?.stop(), timingScope: 'Sidebar DOM click without hover to first current commit, observed ready canvas and second-rAF paint opportunity; not native input latency or physical display latency.' };
    } catch (error) {
      return { failure: { message: error.message, step, parkTab, activeTab: activeTab(), visibility: document.visibilityState, samples,
        frameEvents, canvasStatus: document.querySelector(selector)?.dataset.zenArtifactEngineStatus } };
    } finally { observer.disconnect(); document.removeEventListener('zen-artifact-frame', recordFrame); cancelAnimationFrame(frameRequest); startupProbe?.stop(); uiProbe?.stop(); }
  }.toString()})(${startupDiagnostics ? installArtifactWebGlStartupProbe.toString() : 'null'}, ${uiDiagnostics ? installArtifactUiEntryProbe.toString() : 'null'}, ${JSON.stringify(uiExperiment)}, ${JSON.stringify(fromTab)}, ${summarizeArtifactEntryLongTasks.toString()})`, { timeoutMs: 120000 });
  if (result.failure) {
    const error = new Error(result.failure.message);
    error.diagnostic = result.failure;
    throw error;
  }
  return result;
}
