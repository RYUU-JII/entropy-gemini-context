import { evaluate } from '../../e2e/extensionChromiumHarness.mjs';
import { assertDashboardArtifactMotion } from './dashboardArtifactMotionEvidence.mjs';
import { artifactGallerySelection } from './dashboardArtifactGallerySelection.mjs';

export function inspectArtifactJourneyResolution({ expectedResolution, snapshot, receipt, width, height }) {
  return { expectedResolution, width, height, snapshot, receipt,
    ready: snapshot?.resolution === expectedResolution && receipt?.resolution === expectedResolution
      && Number.isInteger(snapshot?.generation) && snapshot.generation === snapshot.displayedGeneration
      && receipt.displayedGeneration === snapshot.displayedGeneration
      && width === Math.floor(640 * expectedResolution) && height === Math.floor(960 * expectedResolution) };
}

// After the timing pass, enable the two kinetic families through their actual
// settings controls in the isolated QA profile, then verify their declared
// simulation mode, clock progress and live pose motion.
export async function activateDashboardArtifactMotion(harness, page, family) {
  if (!['gate', 'flare'].includes(family)) throw new Error('QA_ARTIFACT_MOTION_FAMILY_INVALID');
  const result = await evaluate(harness.cdp, page.sessionId, `(${async function activate(familyId) {
    const canvas = document.querySelector('canvas[data-zen-artifact-engine="gallery"]');
    const childId = familyId === 'gate' ? 'entryCheckpoint' : 'sentinelFlare';
    const rowSelector = `[data-artifact-control-child-key="${childId}"][data-zen-artifact-control-box]`;
    const wait = async (predicate, label) => {
      const started = performance.now();
      while (!predicate()) {
        if (performance.now() - started > 20000) throw new Error(`QA_ARTIFACT_MOTION_TIMEOUT:${familyId}:${label}`);
        await new Promise(resolve => setTimeout(resolve, 16));
      }
    };
    await wait(() => document.querySelector(rowSelector)?.querySelector('button[aria-expanded][aria-controls]'), 'binary-disclosure');
    const row = document.querySelector(rowSelector);
    const summary = row.querySelector('button[aria-expanded][aria-controls]');
    if (summary.getAttribute('aria-expanded') === 'false') summary.click();
    await wait(() => summary.getAttribute('aria-expanded') === 'true', 'binary-disclosure-open');
    const action = row.querySelector('button[data-artifact-control-value]');
    if (!action || !['__on__', '__off__'].includes(action.dataset.artifactControlValue)
      || action.closest('[hidden]')) throw new Error(`QA_ARTIFACT_MOTION_BINARY_ACTION_INVALID:${familyId}`);
    await wait(() => !action.disabled, 'control-enabled');
    if (action.dataset.artifactControlValue === '__on__') action.click();
    const read = () => {
      canvas.dispatchEvent(new Event('zen-artifact-engine-inspect'));
      return JSON.parse(canvas.dataset.zenArtifactEngineSnapshot);
    };
    await wait(() => document.querySelector(rowSelector)?.dataset.zenArtifactBoxState === 'on'
      && document.querySelector(rowSelector)?.dataset.zenArtifactBoxPending === 'false'
      && canvas.dataset.zenArtifactEngineStatus === 'ready' && read().loopRunning, 'running');
    const before = read();
    await new Promise(resolve => setTimeout(resolve, 750));
    // Worker diagnostics use a bounded metrics cadence. Keep the motion
    // oracle on a genuinely newer sample rather than a repeated cache read.
    await wait(() => read().sampledAtMs > before.sampledAtMs, 'diagnostic-sample-progress');
    const after = read();
    return { family: familyId, before, after };
  }.toString()})(${JSON.stringify(family)})`, { timeoutMs: 45000 });
  return assertDashboardArtifactMotion(result);
}

// Runs only inside dashboard/capture's owned, isolated extension page. Uses
// the actual gallery controls and observes the dev renderer's bounded receipt.
// The Zen gallery is a walked path (previous/next only, wrapping), so every
// transition is a step between neighbours through the edge thresholds.
export async function runDashboardArtifactJourney(harness, page) {
  const result = await evaluate(harness.cdp, page.sessionId, `(${async function journey(inspectResolution, createSelection) {
    const scenes = { veil: 'enso', lens: 'shoji', brake: 'tome-ishi', barrier: 'ishidouro', gate: 'shishi-odoshi', flare: 'furin', echo: 'great-wave' };
    const canvasSelector = 'canvas[data-zen-artifact-engine="gallery"]';
    const wait = async (predicate, label, timeout = 20000) => {
      const start = performance.now();
      while (!predicate()) {
        if (performance.now() - start > timeout) throw new Error(`QA_ARTIFACT_JOURNEY_TIMEOUT:${label}`);
        await new Promise(resolve => setTimeout(resolve, 16));
      }
    };
    let canvas = null, first = null, resolutionEvidence = null;
    const read = () => {
      canvas.dispatchEvent(new Event('zen-artifact-engine-inspect'));
      return JSON.parse(canvas.dataset.zenArtifactEngineSnapshot);
    };
    let lostCanvas = false, stopped = false, checks = 0;
    let pendingPlacementChecks = 0, pendingPlacement = null;
    const placementViolations = [];
    const readPlacement = () => {
      const rect = canvas.getBoundingClientRect();
      return { x: rect.x, y: rect.y, width: rect.width, height: rect.height };
    };
    const sample = () => {
      if (stopped) return;
      checks += 1;
      if (document.querySelector(canvasSelector) !== canvas || !canvas.isConnected) lostCanvas = true;
      if (pendingPlacement && canvas.dataset.zenArtifactEngineStatus === 'preparing'
        && canvas.dataset.zenArtifactEngineScene === pendingPlacement.scene) {
        pendingPlacementChecks += 1;
        const actual = readPlacement();
        const driftPx = Math.max(...Object.keys(actual).map(key => Math.abs(actual[key] - pendingPlacement.rect[key])));
        if (driftPx > 0.25 && placementViolations.length < 8) {
          placementViolations.push({ scene: pendingPlacement.scene, driftPx, before: pendingPlacement.rect, actual });
        }
      }
      requestAnimationFrame(sample);
    };
    const transitions = [];
    let step = 'first-frame';
    const waitForPaint = async () => {
      let timeout;
      try {
        await Promise.race([
          new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))),
          new Promise((_, reject) => {
            timeout = setTimeout(() => reject(new Error('QA_ARTIFACT_JOURNEY_PAINT_TIMEOUT')), 10000);
          }),
        ]);
      } finally { clearTimeout(timeout); }
    };
    const gallery = createSelection('QA_ARTIFACT_JOURNEY', family => canvas.dataset.zenArtifactEngineScene === scenes[family]
      && canvas.dataset.zenArtifactEngineStatus === 'ready');
    const stepFamily = async (direction, pass) => {
      if (!gallery.isPath()) throw new Error('QA_ARTIFACT_JOURNEY_PATH_INDEX_REQUIRED');
      const family = gallery.neighbour(direction);
      if (!scenes[family]) throw new Error(`QA_ARTIFACT_JOURNEY_FAMILY_MISSING:${family}`);
      step = `${pass}:${family}:submit`;
      const before = read(), start = performance.now(), fromScene = canvas.dataset.zenArtifactEngineScene;
      pendingPlacement = { scene: fromScene, rect: readPlacement() };
      gallery.press(direction);
      await wait(() => gallery.selectedFamily() === family
        && canvas.dataset.zenArtifactEngineScene === scenes[family]
        && canvas.dataset.zenArtifactEngineStatus === 'ready', family);
      const submittedMs = performance.now() - start;
      step = `${pass}:${family}:paint`;
      await waitForPaint();
      const after = read(); pendingPlacement = null;
      if (placementViolations.length) throw new Error(`QA_ARTIFACT_JOURNEY_PENDING_PLACEMENT_DRIFT:${JSON.stringify(placementViolations)}`);
      if (after.engineId !== first.engineId || lostCanvas) throw new Error('QA_ARTIFACT_JOURNEY_CANVAS_REPLACED');
      transitions.push({ pass, family, fromScene, submittedMs, paintOpportunityMs: performance.now() - start,
        builds: after.sceneBuilds - before.sceneBuilds, receipt: JSON.parse(canvas.dataset.zenArtifactEngineReceipt), snapshot: after });
    };
    try {
      await wait(() => document.querySelector(canvasSelector)?.dataset.zenArtifactEngineStatus === 'ready', 'first-frame');
      canvas = document.querySelector(canvasSelector);
      step = 'current-resolution';
      const resolutionStarted = performance.now();
      while (true) {
        const receiptText = canvas.dataset.zenArtifactEngineReceipt;
        resolutionEvidence = inspectResolution({ expectedResolution: Math.min(window.devicePixelRatio, 2),
          snapshot: read(), receipt: receiptText ? JSON.parse(receiptText) : null, width: canvas.width, height: canvas.height });
        if (canvas.dataset.zenArtifactEngineStatus === 'ready' && resolutionEvidence.ready) break;
        if (performance.now() - resolutionStarted > 20000) throw new Error('QA_ARTIFACT_JOURNEY_RESOLUTION_STALE');
        await new Promise(resolve => setTimeout(resolve, 16));
      }
      first = read();
      requestAnimationFrame(sample);
      step = 'transitions';
      const familyCount = Object.keys(scenes).length;
      if (gallery.pathOrder().length !== familyCount) throw new Error('QA_ARTIFACT_JOURNEY_PATH_COVERAGE');
      // One cold and one warm lap: each lap steps forward through every family
      // and arrives back where it started.
      for (let pass = 0; pass < 2; pass += 1) {
        for (let index = 0; index < familyCount; index += 1) await stepFamily(1, pass);
      }
      // Every directed neighbour pair, both ways round the path, with the same
      // atomic-placement observation. Non-neighbours are unreachable by design.
      for (const direction of [1, -1]) {
        for (let index = 0; index < familyCount; index += 1) await stepFamily(direction, 'directed-pair');
      }
      // Latest intent wins even with several controller admissions in flight:
      // three forward steps pressed as separate tasks, as a person would, without
      // waiting for any of them to settle, land three families on.
      step = 'rapid-latest';
      const rapidOrder = gallery.pathOrder();
      const rapidTarget = rapidOrder[(rapidOrder.indexOf(gallery.selectedFamily()) + 3) % rapidOrder.length];
      for (let press = 0; press < 3; press += 1) {
        gallery.press(1);
        await new Promise(resolve => setTimeout(resolve, 0));
      }
      await wait(() => gallery.selectedFamily() === rapidTarget
        && canvas.dataset.zenArtifactEngineScene === scenes[rapidTarget]
        && canvas.dataset.zenArtifactEngineStatus === 'ready', 'rapid-latest');
      const rapid = read();
      step = 'park';
      // Park on Rhythm: it is in every theme's sidebar (Zen's garden keeps
      // Sites out of it), and leaving Tools is all parking needs.
      const nav = document.querySelector('#dashboard-sidebar [data-tab="schedule"]');
      if (!nav) throw new Error('QA_ARTIFACT_JOURNEY_TAB_NAVIGATION_MISSING');
      nav.click();
      await wait(() => document.querySelector('[data-dashboard-active-tab]')?.dataset.dashboardActiveTab === 'schedule', 'park');
      await wait(() => {
        const snapshot = read();
        return !snapshot.loopRunning && snapshot.pendingFrameCount === 0 && snapshot.pendingRequestCount === 0;
      }, 'park-drained');
      const parked = read();
      await new Promise(resolve => setTimeout(resolve, 300));
      const parkedAfter = read();
      if (parked.loopRunning || parked.frameCount !== parkedAfter.frameCount) throw new Error('QA_ARTIFACT_JOURNEY_PARKED_DRAW');
      step = 'return';
      document.querySelector('[data-tab="tools"]').click();
      await wait(() => document.querySelector('[data-dashboard-active-tab]')?.dataset.dashboardActiveTab === 'tools'
        && canvas.dataset.zenArtifactEngineStatus === 'ready', 'return');
      const returned = read();
      if (returned.engineId !== first.engineId || lostCanvas) throw new Error('QA_ARTIFACT_JOURNEY_RETURN_REPLACED');
      const warm = transitions.filter(row => row.pass === 1);
      if (warm.some(row => row.builds !== 0)) throw new Error('QA_ARTIFACT_JOURNEY_WARM_REBAKE');
      const directedPairCount = new Set(transitions.filter(row => row.pass === 'directed-pair')
        .map(row => `${row.fromScene}->${scenes[row.family]}`)).size;
      if (directedPairCount !== familyCount * 2) throw new Error('QA_ARTIFACT_JOURNEY_DIRECTED_PAIR_COVERAGE');
      return { first, resolutionEvidence, transitions, directedPairCount, rapid, parked, parkedAfter, returned, canvasChecks: checks, lostCanvas,
        pendingPlacementChecks, placementViolations,
        timingScope: 'UI click to renderer submit; second rAF is a paint opportunity, not physical display latency' };
    } catch (error) {
      return { failure: { message: error.message, step, visibility: document.visibilityState,
        engineStatus: canvas?.dataset.zenArtifactEngineStatus, scene: canvas?.dataset.zenArtifactEngineScene,
        resolutionEvidence, snapshot: canvas ? read() : null, transitions, canvasChecks: checks, pendingPlacementChecks, placementViolations } };
    } finally { stopped = true; }
  }.toString()})(${inspectArtifactJourneyResolution.toString()}, ${artifactGallerySelection.toString()})`, { timeoutMs: 180000 });
  if (result.failure) {
    const error = new Error(result.failure.message);
    error.diagnostic = result.failure;
    throw error;
  }
  return result;
}
