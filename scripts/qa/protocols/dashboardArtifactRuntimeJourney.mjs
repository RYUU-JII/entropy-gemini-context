import { evaluate, sleep } from '../../e2e/extensionChromiumHarness.mjs';
import { artifactGallerySelection } from './dashboardArtifactGallerySelection.mjs';

const FAMILIES = Object.freeze(['veil', 'lens', 'brake', 'barrier', 'gate', 'flare', 'echo']);
// Parking leaves Tools for Rhythm: it is in every theme's sidebar, while Zen's
// garden keeps Sites out of it.
export const ARTIFACT_RUNTIME_PARK_TAB = 'schedule';
const REQUIRED_METRICS = Object.freeze(['Timestamp', 'TaskDuration', 'ScriptDuration', 'JSHeapUsedSize', 'Nodes', 'JSEventListeners']);

export function requireArtifactRuntimeDisclosure(snapshot) {
  const ids = snapshot?.orderedFamilyIds;
  if (!Array.isArray(ids) || ids.length !== FAMILIES.length || new Set(ids).size !== FAMILIES.length
    || FAMILIES.some(family => !ids.includes(family)
      || snapshot.entriesByFamilyId?.[family]?.visible !== true
      || snapshot.entriesByFamilyId?.[family]?.configurable !== true
      || snapshot.entriesByFamilyId?.[family]?.runtimeEligible !== true)) {
    throw new Error('QA_ARTIFACT_RUNTIME_DISCLOSURE_REQUIRED');
  }
  return snapshot;
}

export function isArtifactRuntimePresentationCurrent({ themeId, family, stageReady, canvasPresent, scene, status, snapshot, receipt }) {
  if (stageReady !== true) return false;
  if (themeId !== 'zen') return true;
  const scenes = { veil: 'enso', lens: 'shoji', brake: 'tome-ishi', barrier: 'ishidouro', gate: 'shishi-odoshi', flare: 'furin', echo: 'great-wave' };
  return canvasPresent === true && scene === scenes[family] && status === 'ready'
    && Number.isSafeInteger(snapshot?.generation) && snapshot.generation > 0
    && snapshot.displayedGeneration === snapshot.generation && receipt?.displayedGeneration === snapshot.generation;
}

export function summarizeArtifactRuntimeWindow(before, after, observation) {
  for (const metrics of [before?.metrics, after?.metrics]) {
    if (!metrics || REQUIRED_METRICS.some(key => !Number.isFinite(metrics[key]) || metrics[key] < 0)) {
      throw new Error('QA_ARTIFACT_RUNTIME_METRICS_INVALID');
    }
  }
  const elapsedSeconds = after.metrics.Timestamp - before.metrics.Timestamp;
  const taskSeconds = after.metrics.TaskDuration - before.metrics.TaskDuration;
  const scriptSeconds = after.metrics.ScriptDuration - before.metrics.ScriptDuration;
  if (elapsedSeconds <= 0 || taskSeconds < 0 || scriptSeconds < 0) throw new Error('QA_ARTIFACT_RUNTIME_METRICS_NOT_CURRENT');
  if (observation?.documentVisible !== true || observation?.durationMs < 1800 || observation?.rafCount < 2) {
    throw new Error('QA_ARTIFACT_RUNTIME_NATIVE_FRAMES_REQUIRED');
  }
  return {
    before, after, observation, elapsedSeconds,
    mainThreadTaskBusyPercent: taskSeconds / elapsedSeconds * 100,
    mainThreadScriptBusyPercent: scriptSeconds / elapsedSeconds * 100,
    heapUsedBytes: after.metrics.JSHeapUsedSize,
    heapChangeBytes: after.metrics.JSHeapUsedSize - before.metrics.JSHeapUsedSize,
    nodeChange: after.metrics.Nodes - before.metrics.Nodes,
    listenerChange: after.metrics.JSEventListeners - before.metrics.JSEventListeners,
  };
}

function requireArtifactEngineSnapshot(snapshot) {
  if (!snapshot || !Number.isSafeInteger(snapshot.engineId) || snapshot.engineId < 1
    || typeof snapshot.workerChannelSessionId !== 'string' || !snapshot.workerChannelSessionId
    || ['frameCount', 'displayedFrames', 'generation', 'displayedGeneration', 'pendingFrameCount', 'pendingRequestCount']
      .some(key => !Number.isSafeInteger(snapshot[key]) || snapshot[key] < 0)) {
    throw new Error('QA_ARTIFACT_RUNTIME_ENGINE_COUNTERS_INVALID');
  }
}

function hasOngoingWidgetMotion(observation) {
  return observation.runningInfiniteAnimations > 0 || observation.unpausedIndefiniteSvgAnimations > 0
    || (observation.widgetMutationCount > 0 && observation.lastWidgetMutationOffsetMs >= observation.durationMs - 500);
}

export function requireArtifactRuntimeRetainedEngine(first, current) {
  requireArtifactEngineSnapshot(first);
  requireArtifactEngineSnapshot(current);
  if (first.engineId !== current.engineId || first.workerChannelSessionId !== current.workerChannelSessionId) {
    throw new Error('QA_ARTIFACT_RUNTIME_ENGINE_REPLACED');
  }
}

export function requireArtifactRuntimeFamilyParking(active, parked, returned) {
  if (parked?.observation?.activeTab !== ARTIFACT_RUNTIME_PARK_TAB || returned?.observation?.activeTab !== 'tools') {
    throw new Error('QA_ARTIFACT_RUNTIME_TAB_STATE_INVALID');
  }
  const beforeEngine = active.observation.engine;
  const observation = parked.observation;
  if (observation.runningInfiniteAnimations !== 0 || observation.unpausedIndefiniteSvgAnimations !== 0
    || observation.unpausedIndefiniteSvgAnimationsBefore !== 0
    || (!beforeEngine && observation.widgetMutationCount !== 0)) {
    throw new Error('QA_ARTIFACT_RUNTIME_PARKED_VISUAL_UPDATES');
  }
  if (beforeEngine) {
    const before = observation.engineBefore, after = observation.engine, resumed = returned.observation.engine;
    for (const snapshot of [active.observation.engineBefore, beforeEngine, before, after, returned.observation.engineBefore, resumed]) {
      requireArtifactEngineSnapshot(snapshot);
    }
    if (before.loopRunning || after.loopRunning
      || before.pendingFrameCount !== 0 || before.pendingRequestCount !== 0
      || after.pendingFrameCount !== 0 || after.pendingRequestCount !== 0
      || after.frameCount !== before.frameCount || after.displayedFrames !== before.displayedFrames) {
      throw new Error('QA_ARTIFACT_RUNTIME_PARKED_DRAW');
    }
    if ([active.observation.engineBefore, before, after, returned.observation.engineBefore, resumed].some(snapshot => snapshot.engineId !== beforeEngine.engineId
      || snapshot.workerChannelSessionId !== beforeEngine.workerChannelSessionId)
      || resumed.generation !== resumed.displayedGeneration
      || resumed.frameCount <= after.frameCount || resumed.displayedFrames <= after.displayedFrames) {
      throw new Error('QA_ARTIFACT_RUNTIME_RETURN_ACK_INVALID');
    }
    if (beforeEngine.loopRunning) {
      for (const window of [active, returned]) {
        requireArtifactEngineSnapshot(window.observation.engineBefore);
        if (!window.observation.engine.loopRunning
          || window.observation.engine.frameCount - window.observation.engineBefore.frameCount < 2
          || window.observation.engine.displayedFrames - window.observation.engineBefore.displayedFrames < 2) {
          throw new Error('QA_ARTIFACT_RUNTIME_WINDOW_DRAW_PROGRESS_REQUIRED');
        }
      }
    }
  } else if (hasOngoingWidgetMotion(active.observation) && !hasOngoingWidgetMotion(returned.observation)) {
    throw new Error('QA_ARTIFACT_RUNTIME_WINDOW_WIDGET_MOTION_REQUIRED');
  }
  return { galleryUpdatesStopped: true, sameEngine: beforeEngine ? true : null, returned: true };
}

export function requireArtifactRuntimeParking(active, parked, returned) {
  if (parked?.observation?.activeTab !== ARTIFACT_RUNTIME_PARK_TAB || returned?.observation?.activeTab !== 'tools') {
    throw new Error('QA_ARTIFACT_RUNTIME_TAB_STATE_INVALID');
  }
  if (parked.observation.runningInfiniteAnimations !== 0 || parked.observation.unpausedIndefiniteSvgAnimations !== 0
    || parked.observation.unpausedIndefiniteSvgAnimationsBefore !== 0
    || (!active.observation.engine && parked.observation.widgetMutationCount !== 0)) {
    throw new Error('QA_ARTIFACT_RUNTIME_PARKED_VISUAL_UPDATES');
  }
  const first = active.observation.engine;
  const before = parked.observation.engineBefore;
  const after = parked.observation.engine;
  const resumed = returned.observation.engine;
  if (!first) {
    for (const window of [active, returned]) {
      const observation = window.observation;
      if (!hasOngoingWidgetMotion(observation)) {
        throw new Error('QA_ARTIFACT_RUNTIME_WINDOW_WIDGET_MOTION_REQUIRED');
      }
    }
  }
  if (first) {
    for (const snapshot of [active.observation.engineBefore, first, before, after, returned.observation.engineBefore, resumed]) {
      requireArtifactEngineSnapshot(snapshot);
    }
    for (const window of [active, returned]) {
      if (!window.observation.engine.loopRunning
        || window.observation.engine.frameCount - window.observation.engineBefore.frameCount < 2
        || window.observation.engine.displayedFrames - window.observation.engineBefore.displayedFrames < 2) {
        throw new Error('QA_ARTIFACT_RUNTIME_WINDOW_DRAW_PROGRESS_REQUIRED');
      }
    }
    if (!before || !after || !resumed || before.loopRunning || after.loopRunning
      || after.frameCount !== before.frameCount || after.pendingFrameCount !== 0 || after.pendingRequestCount !== 0) {
      throw new Error('QA_ARTIFACT_RUNTIME_PARKED_DRAW');
    }
    if (first.engineId !== after.engineId || first.engineId !== resumed.engineId
      || [active.observation.engineBefore, before, after, returned.observation.engineBefore, resumed]
        .some(snapshot => snapshot.workerChannelSessionId !== first.workerChannelSessionId)
      || resumed.loopRunning !== true || resumed.frameCount <= after.frameCount
      || resumed.generation !== resumed.displayedGeneration) {
      throw new Error('QA_ARTIFACT_RUNTIME_RETURN_ACK_INVALID');
    }
  }
  return { galleryUpdatesStopped: true, sameEngine: first ? true : null, returned: true };
}

// Serialized into dashboard/capture's existing owned document. Its finite probe
// observes native rAF and one gallery subtree equally in all measurement windows.
// It never patches product methods, supplies synthetic frames or changes OS focus.
async function artifactRuntimePageAction(action, family, themeId, isPresentationCurrent, createSelection, parkTab) {
  const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
  const tab = () => document.querySelector('[data-dashboard-active-tab]')?.dataset.dashboardActiveTab;
  const canvas = () => document.querySelector('canvas[data-zen-artifact-engine="gallery"]');
  const readEngine = () => {
    const node = canvas();
    if (!node) return null;
    node.dispatchEvent(new Event('zen-artifact-engine-inspect'));
    if (!node.dataset.zenArtifactEngineSnapshot) {
      if (node.dataset.zenArtifactEngineStatus !== 'ready') return undefined;
      throw new Error('QA_ARTIFACT_RUNTIME_ENGINE_SNAPSHOT_REQUIRED');
    }
    return JSON.parse(node.dataset.zenArtifactEngineSnapshot);
  };
  const ensureVisible = () => {
    if (document.hidden || document.visibilityState !== 'visible') throw new Error('QA_ARTIFACT_RUNTIME_DOCUMENT_HIDDEN');
  };
  const wait = async (predicate, step) => {
    const started = performance.now();
    while (!predicate()) {
      ensureVisible();
      if (performance.now() - started > 20000) throw new Error('QA_ARTIFACT_RUNTIME_TIMEOUT:' + step);
      await pause(16);
    }
  };
  const requireWidget = () => {
    const missing = document.querySelector('[data-artifact-renderer-widget-status="missing"]');
    if (missing) throw new Error('QA_ARTIFACT_RUNTIME_WIDGET_MISSING:' + missing.dataset.artifactRendererTheme + ':' + missing.dataset.artifactRendererWidgetName);
  };
  const ready = expectedFamily => {
    const node = canvas();
    return isPresentationCurrent({ themeId, family: expectedFamily,
      stageReady: document.querySelector('[data-artifact-render-stage-ready]')?.dataset.artifactRenderStageReady === 'true',
      canvasPresent: Boolean(node), scene: node?.dataset.zenArtifactEngineScene,
      status: node?.dataset.zenArtifactEngineStatus, snapshot: readEngine(),
      receipt: node?.dataset.zenArtifactEngineReceipt ? JSON.parse(node.dataset.zenArtifactEngineReceipt) : undefined });
  };
  // Quickbar themes click the family; the Zen path walks to it one settled
  // neighbour at a time through its edge thresholds.
  const gallery = createSelection('QA_ARTIFACT_RUNTIME', (expectedFamily) => {
    ensureVisible();
    requireWidget();
    return ready(expectedFamily);
  });
  ensureVisible();
  if (action === 'select') {
    const path = await gallery.select(family);
    return { family, path, engine: readEngine() };
  }
  if (action === 'park' || action === 'return') {
    const selectedFamily = gallery.selectedFamily();
    if (!selectedFamily) throw new Error('QA_ARTIFACT_RUNTIME_SELECTED_FAMILY_REQUIRED');
    const destination = action === 'park' ? parkTab : 'tools';
    const navigation = document.querySelector('#dashboard-sidebar button[data-tab="' + destination + '"]');
    if (!navigation) throw new Error('QA_ARTIFACT_RUNTIME_NAVIGATION_REQUIRED');
    navigation.click();
    await wait(() => {
      if (tab() !== destination) return false;
      const engine = readEngine();
      if (action === 'park') return !engine || (!engine.loopRunning && engine.pendingRequestCount === 0 && engine.pendingFrameCount === 0);
      requireWidget();
      return ready(selectedFamily);
    }, action);
    if (action === 'park' && themeId !== 'zen') {
      const visual = document.querySelector('[data-artifact-gallery-render-space]');
      if (!visual) throw new Error('QA_ARTIFACT_RUNTIME_VISUAL_REQUIRED');
      // OFF may settle a finite spring. Admit a quiet baseline rather than
      // misclassifying that bounded transition as a retained infinite loop.
      let lastMutationAtMs = performance.now();
      const observer = new MutationObserver(() => { lastMutationAtMs = performance.now(); });
      observer.observe(visual, { subtree: true, attributes: true, childList: true, characterData: true });
      try {
        await wait(() => performance.now() - lastMutationAtMs >= 500
          && visual.getAnimations({ subtree: true }).every(animation => animation.playState !== 'running'
            || animation.effect?.getComputedTiming().iterations !== Infinity), 'park-quiescent');
      } finally { observer.disconnect(); }
    }
    return { activeTab: tab(), engine: readEngine() };
  }
  if (action !== 'measure') throw new Error('QA_ARTIFACT_RUNTIME_ACTION_INVALID');
  requireWidget();
  const root = document.querySelector('[data-artifact-gallery-canvas-region="true"]');
  if (!root) throw new Error('QA_ARTIFACT_RUNTIME_GALLERY_REQUIRED');
  const visual = root.querySelector('[data-artifact-gallery-render-space]');
  if (!visual) throw new Error('QA_ARTIFACT_RUNTIME_VISUAL_REQUIRED');
  const readIndefiniteSvgAnimations = () => [...visual.querySelectorAll('animate[repeatCount="indefinite"], animateTransform[repeatCount="indefinite"], animateMotion[repeatCount="indefinite"]')]
    .filter(animation => !animation.ownerSVGElement.animationsPaused()).length;
  const unpausedIndefiniteSvgAnimationsBefore = readIndefiniteSvgAnimations();
  const engineBefore = readEngine();
  let visible = true, rafCount = 0, request = 0, lastFrame = null;
  let galleryMutationCount = 0, widgetMutationCount = 0, lastWidgetMutationAtMs = null, overflow = false;
  const gaps = [];
  const recordMutations = entries => { galleryMutationCount += entries.length; };
  const observer = new MutationObserver(recordMutations);
  observer.observe(root, { subtree: true, attributes: true, childList: true, characterData: true });
  const recordWidgetMutations = entries => {
    widgetMutationCount += entries.length;
    if (entries.length) lastWidgetMutationAtMs = performance.now();
  };
  const widgetObserver = new MutationObserver(recordWidgetMutations);
  widgetObserver.observe(visual, { subtree: true, attributes: true, childList: true, characterData: true });
  const onVisibility = () => { if (document.hidden || document.visibilityState !== 'visible') visible = false; };
  document.addEventListener('visibilitychange', onVisibility);
  const frame = atMs => {
    rafCount += 1;
    if (lastFrame !== null) {
      if (gaps.length < 1024) gaps.push(atMs - lastFrame);
      else overflow = true;
    }
    lastFrame = atMs;
    request = requestAnimationFrame(frame);
  };
  const started = performance.now();
  request = requestAnimationFrame(frame);
  try {
    await pause(2000);
    recordMutations(observer.takeRecords());
    recordWidgetMutations(widgetObserver.takeRecords());
    onVisibility();
    if (overflow) throw new Error('QA_ARTIFACT_RUNTIME_FRAME_SAMPLE_OVERFLOW');
    const animations = visual.getAnimations({ subtree: true });
    const sorted = gaps.slice().sort((a, b) => a - b);
    return {
      durationMs: performance.now() - started, documentVisible: visible, activeTab: tab(), rafCount,
      rafGapP95Ms: sorted.length ? sorted[Math.floor((sorted.length - 1) * .95)] : null,
      rafGapMaxMs: sorted.length ? sorted[sorted.length - 1] : null,
      galleryMutationCount, widgetMutationCount,
      lastWidgetMutationOffsetMs: lastWidgetMutationAtMs === null ? null : lastWidgetMutationAtMs - started,
      runningInfiniteAnimations: animations.filter(animation => animation.playState === 'running'
        && animation.effect?.getComputedTiming().iterations === Infinity).length,
      unpausedIndefiniteSvgAnimationsBefore, unpausedIndefiniteSvgAnimations: readIndefiniteSvgAnimations(),
      engineBefore, engine: readEngine(),
    };
  } finally {
    cancelAnimationFrame(request);
    observer.disconnect();
    widgetObserver.disconnect();
    document.removeEventListener('visibilitychange', onVisibility);
  }
}

export async function runDashboardArtifactRuntimeJourney({ harness, page, pageDiagnostics, themeId, captureFamilyScreenshot }) {
  if (typeof captureFamilyScreenshot !== 'function') throw new Error('QA_ARTIFACT_RUNTIME_CAPTURE_OWNER_REQUIRED');
  const action = (name, family = null) => evaluate(harness.cdp, page.sessionId,
    `(${artifactRuntimePageAction.toString()})(${JSON.stringify(name)}, ${JSON.stringify(family)}, ${JSON.stringify(themeId)}, ${isArtifactRuntimePresentationCurrent.toString()}, ${artifactGallerySelection.toString()}, ${JSON.stringify(ARTIFACT_RUNTIME_PARK_TAB)})`, { timeoutMs: 100000 });
  const memory = [], transitions = [], familyParking = [];
  let active = null, parked = null, returned = null, retainedEngine = null;
  const collectMemory = async label => {
    // Disposable document only, outside every timed CPU/frame window. This
    // separates still-live DOM/listeners from garbage awaiting normal GC.
    await harness.cdp.send('HeapProfiler.collectGarbage', {}, page.sessionId, { timeoutMs: 10000 });
    return pageDiagnostics.capturePerformanceCheckpoint(label);
  };
  const measure = async label => {
    await sleep(1000);
    const before = await pageDiagnostics.capturePerformanceCheckpoint('artifact_runtime_' + label + '_before');
    const observation = await action('measure');
    if (themeId === 'zen') {
      requireArtifactRuntimeRetainedEngine(retainedEngine, observation.engineBefore);
      requireArtifactRuntimeRetainedEngine(retainedEngine, observation.engine);
    }
    const after = await pageDiagnostics.capturePerformanceCheckpoint('artifact_runtime_' + label + '_after');
    return summarizeArtifactRuntimeWindow(before, after, observation);
  };
  try {
    memory.push(await collectMemory('artifact_runtime_initial'));
    for (let pass = 0; pass < 3; pass += 1) {
      for (const family of FAMILIES) {
        const transition = await action('select', family);
        const engine = transition.engine;
        if (themeId === 'zen') {
          if (!retainedEngine) retainedEngine = engine;
          requireArtifactRuntimeRetainedEngine(retainedEngine, engine);
        }
        if (engine && ['cacheEntries', 'textureBytes', 'textureBudgetBytes'].some(key => !Number.isSafeInteger(engine[key]) || engine[key] < 0)) {
          throw new Error('QA_ARTIFACT_RUNTIME_CACHE_ACCOUNTING_REQUIRED');
        }
        if (engine && (engine.cacheEntries > 7 || engine.textureBytes > engine.textureBudgetBytes)) {
          throw new Error('QA_ARTIFACT_RUNTIME_CACHE_BUDGET_EXCEEDED');
        }
        transitions.push({ pass, ...transition });
      }
      memory.push(await collectMemory('artifact_runtime_pass_' + pass));
    }
    for (const family of FAMILIES) {
      const selection = await action('select', family);
      if (themeId === 'zen') requireArtifactRuntimeRetainedEngine(retainedEngine, selection.engine);
      const activeFamily = await measure('active_' + family);
      // Decisive visual evidence is outside every timed runtime window.
      const screenshotPath = await captureFamilyScreenshot(family);
      await action('park');
      const parkedFamily = await measure('parked_' + family);
      await action('return');
      const returnedFamily = await measure('returned_' + family);
      const proof = requireArtifactRuntimeFamilyParking(activeFamily, parkedFamily, returnedFamily);
      familyParking.push({ family, screenshotPath, active: activeFamily, parked: parkedFamily, returned: returnedFamily, proof });
    }
    memory.push(await collectMemory('artifact_runtime_after_family_parking'));
    await action('select', 'lens');
    active = await measure('active');
    await action('park');
    parked = await measure('parked');
    await action('return');
    returned = await measure('returned');
    const parking = requireArtifactRuntimeParking(active, parked, returned);
    return { transitions, memory, familyParking, active, parked, returned, parking,
      heapSampling: 'Explicit document garbage collection before initial/pass memory checkpoints, outside timed CPU/frame windows. Measurement-window heaps use normal GC.',
      scope: 'Owned visible document with finite rAF/mutation instrumentation included; mutation observer overhead depends on activity. CDP main-thread task/script busy time and JS heap; no pure-product/process/Worker/GPU CPU, GPU-memory or physical display latency claim. Bounded heap samples do not prove absence of all leaks.' };
  } catch (error) {
    error.diagnostic = { ...error.diagnostic, artifactRuntimeJourney: { transitions, memory, familyParking, active, parked, returned } };
    throw error;
  }
}
