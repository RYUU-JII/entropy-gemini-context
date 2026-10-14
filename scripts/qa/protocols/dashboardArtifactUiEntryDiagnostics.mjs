import fs from 'node:fs/promises';
import { startDashboardRenderTraceCapture } from './dashboardBootRenderTrace.mjs';

// Diagnostic-only sampling on the capture owner's existing document session.
// No target, focus, browser, or product runtime ownership lives here.
export async function captureArtifactUiCpuProfile({ harness, page, outputPath, traceOutputPath, run }) {
  const send = (method, params = {}) => harness.cdp.send(method, params, page.sessionId, { timeoutMs: 10000 });
  const stopTrace = await startDashboardRenderTraceCapture(harness.cdp, traceOutputPath);
  let started = false, enabled = false;
  try {
    await send('Profiler.enable');
    enabled = true;
    await send('Profiler.setSamplingInterval', { interval: 1000 });
    await send('Profiler.start');
    started = true;
    return await run();
  } finally {
    try {
      if (started) {
        const { profile } = await send('Profiler.stop');
        if (!Array.isArray(profile?.nodes) || !Array.isArray(profile?.samples)
          || profile.nodes.length > 25000 || profile.samples.length > 200000) throw new Error('QA_ARTIFACT_UI_PROFILE_INVALID_OR_OVERFLOW');
        await fs.writeFile(outputPath, JSON.stringify(profile));
      }
    } finally {
      try { if (enabled) await send('Profiler.disable'); }
      finally { await stopTrace(); }
    }
  }
}

// Serialized into that same owned page, with no method replacement or runtime
// preload. A missing browser capability is a diagnostic failure, not empty data.
export function installArtifactUiEntryProbe(experiment = 'none') {
  if (!PerformanceObserver.supportedEntryTypes.includes('long-animation-frame')) throw new Error('QA_ARTIFACT_UI_LOAF_UNSUPPORTED');
  const experiments = {
    none: null,
    'warm-bitmap-sink': null,
    'without-grain-filter': ['[data-zen-karesansui-layer="fine-grain"]', 'filter', 'none'],
    'without-nav-backdrop': ['[data-artifact-gallery-nav-track="true"]', 'backdrop-filter', 'none'],
    'without-ground': ['[data-zen-karesansui-ground]', 'display', 'none'],
  };
  if (!Object.hasOwn(experiments, experiment)) throw new Error('QA_ARTIFACT_UI_EXPERIMENT_UNKNOWN');
  const change = experiments[experiment];
  let style = null;
  if (change) {
    style = document.createElement('style');
    style.dataset.entropyQaArtifactUiExperiment = experiment;
    style.textContent = `${change[0]} { ${change[1]}: ${change[2]} !important; }`;
    document.head.appendChild(style);
  }
  const frames = [], resources = [];
  let overflow = false, stopped = false;
  const observer = new PerformanceObserver(list => {
    for (const entry of list.getEntries()) {
      const target = entry.entryType === 'long-animation-frame' ? frames : resources;
      if (target.length >= 512) { overflow = true; continue; }
      target.push(entry.toJSON());
    }
  });
  try { observer.observe({ entryTypes: ['long-animation-frame', 'resource'] }); }
  catch (error) { observer.disconnect(); style?.remove(); throw error; }
  return {
    stop() {
      if (stopped) return;
      stopped = true;
      for (const entry of observer.takeRecords()) {
        const target = entry.entryType === 'long-animation-frame' ? frames : resources;
        if (target.length >= 512) overflow = true;
        else target.push(entry.toJSON());
      }
      observer.disconnect();
      let targets, applied;
      try {
        targets = change ? [...document.querySelectorAll(change[0])] : [];
        applied = !change || (targets.length > 0 && targets.every(node => getComputedStyle(node).getPropertyValue(change[1]) === change[2]));
      } finally { style?.remove(); }
      if (overflow) throw new Error('QA_ARTIFACT_UI_ENTRY_OBSERVER_OVERFLOW');
      if (!applied) throw new Error('QA_ARTIFACT_UI_EXPERIMENT_NOT_APPLIED');
      return { frames, resources, experiment, experimentApplied: applied, experimentTargetCount: targets.length, styleRestored: !style?.isConnected, timeOriginMs: performance.timeOrigin,
        scope: 'Document LoAF/resource observers; rendering tail is not isolated GPU or physical display time.' };
    },
  };
}
