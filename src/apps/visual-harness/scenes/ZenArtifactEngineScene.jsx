import { compileZenArtifactSvgMaterials } from '../../../themes/plugins/zen/presentation/artifacts/engine/zenSvgMaterialCompiler.js';
import React, { useLayoutEffect, useRef, useState } from 'react';
import { defineVisualSceneImplementation } from '../visualSceneContract.js';
import ZenShojiVisualCore from '../../../themes/plugins/zen/presentation/artifacts/shoji/ZenShojiVisualCore.jsx';
import { getThemeWidget, preloadThemeWidgetChunk } from '../../../themes/core/registry/index.js';
import { createZenArtifactEngine } from '../../../themes/plugins/zen/presentation/artifacts/engine/zenArtifactEngine.js';
import { createZenGreatWaveGrid } from '../../../themes/plugins/zen/presentation/artifacts/engine/zenGreatWaveRecipe.js';
import { zenEaseInOut } from '../../../themes/plugins/zen/presentation/artifacts/engine/zenArtifactTiming.js';
import { createPixiGpuFrameTimer } from '../../../themes/plugins/zen/pond/renderers/pixi/telemetry/pixiGpuFrameTimer.js';
import '../../dashboard/tailwind.css';
import './zenArtifactEngineScene.css';

const SHOJI = Object.freeze({ id: 'shoji', nightDepth: 0 });
const WAVE = Object.freeze({ id: 'great-wave', color: '#2f6f9e', isActive: true });
const SPECIMENS = Object.freeze([
  { key: 'shoji-day', title: 'Shoji · daylight', descriptor: SHOJI, atMs: 0 },
  { key: 'shoji-dusk', title: 'Shoji · dusk', descriptor: { id: 'shoji', nightDepth: 0.5 }, atMs: 0 },
  { key: 'shoji-night', title: 'Shoji · night', descriptor: { id: 'shoji', nightDepth: 1 }, atMs: 0 },
  { key: 'shoji-float', title: 'Shoji · float at 1.875 seconds', descriptor: SHOJI, atMs: 1875 },
  { key: 'wave-active', title: 'GreatWave · active at 1.25 seconds', descriptor: WAVE, atMs: 1250 },
  { key: 'wave-idle', title: 'GreatWave · idle at 3 seconds', descriptor: { ...WAVE, isActive: false }, atMs: 3000 },
]);

const nextFrame = () => new Promise((resolve) => requestAnimationFrame(resolve));
async function settleFrames() { await nextFrame(); await nextFrame(); }

function summarizeIntervals(samples) {
  const sorted = [...samples].sort((a, b) => a - b);
  return {
    samples: sorted.length,
    medianMs: sorted[Math.floor(sorted.length * 0.5)],
    p95Ms: sorted[Math.floor(sorted.length * 0.95)],
    over25Ms: sorted.filter((value) => value > 25).length,
  };
}

async function sampleFrames(durationMs) {
  const samples = [];
  let previous = await nextFrame();
  const start = previous;
  do {
    const now = await nextFrame();
    if (document.visibilityState !== 'visible') throw new Error('ZEN_ENGINE_REVIEW_DOCUMENT_HIDDEN');
    samples.push(now - previous);
    previous = now;
  } while (previous - start < durationMs);
  return summarizeIntervals(samples);
}

function Reference({ descriptor, live = false, atMs = 0 }) {
  const ZenGreatWave = getThemeWidget('zen', 'Artifact_Lethe');
  const element = useRef(null);
  useLayoutEffect(() => {
    if (live || !element.current) return;
    let cancelled = false;
    const freeze = () => {
      if (cancelled || !element.current) return;
    if (descriptor.id === 'shoji' && atMs > 0) {
      const nodes = element.current.querySelectorAll('[data-shoji-float-axis], [data-shoji-float-shadow]');
      nodes.forEach((node) => {
        node.getAnimations().forEach((animation) => {
          animation.pause();
          animation.currentTime = atMs;
        });
        const computed = getComputedStyle(node);
        const transform = computed.transform;
        const opacity = computed.opacity;
        node.style.animation = 'none';
        node.style.transform = transform;
        node.style.opacity = opacity;
      });
    }
    if (descriptor.id === 'great-wave') {
      const grid = createZenGreatWaveGrid(descriptor);
      const duration = descriptor.isActive ? 3600 : 6800;
      const distance = descriptor.isActive ? 3 : 1.1;
      element.current.querySelectorAll('svg > g').forEach((node, index) => {
        const wave = grid[index];
        const phase = (Math.max(0, atMs - wave.delay * 1000) % duration) / duration;
        const y = wave.y - zenEaseInOut(phase < 0.5 ? phase * 2 : (1 - phase) * 2) * distance;
        node.style.transform = `translateY(${y}px)`;
      });
    }
    };
    // Framer's first scheduled render writes its initial transform after layout.
    // Freeze the reference only after that write, before capture admission.
    settleFrames().then(freeze);
    return () => { cancelled = true; };
  }, [descriptor, live, atMs]);
  const context = {
    motion: { budget: { mode: live ? 'ambient' : 'still', isStill: !live, isAmbient: live, isFull: false, shouldAnimate: live } },
    renderState: { isVisuallyActive: descriptor.isActive, shouldRenderEffects: descriptor.isActive },
  };
  return (
    <div className="zen-engine-specimen" ref={element}>
      {descriptor.id === 'shoji' ? (
        <ZenShojiVisualCore nightDepth={descriptor.nightDepth} shouldAnimateFloat={live || atMs > 0}
          motionBudgetMode={live ? 'ambient' : 'still'} ariaHidden={false} ariaLabel="Shoji reference" />
      ) : <ZenGreatWave color={descriptor.color} isActive={descriptor.isActive} artifactRenderContext={context} />}
    </div>
  );
}

function ZenArtifactEngineScene({ signalReady }) {
  const canvasRef = useRef(null);
  const [measurement, setMeasurement] = useState(null);
  const [images, setImages] = useState(null);
  const [report, setReport] = useState(null);
  const [error, setError] = useState(null);
  useLayoutEffect(() => {
    let active = true;
    const canvas = canvasRef.current;
    let contextInfo = null;
    const engine = createZenArtifactEngine({ prepareMaterials: compileZenArtifactSvgMaterials,
      canvas, width: 480, height: 480, devicePixelRatio: window.devicePixelRatio,
      createFrameTimer: ({ renderer }) => {
        const gl = renderer.gl;
        const info = gl.getExtension('WEBGL_debug_renderer_info');
        contextInfo = {
          version: gl.getParameter(gl.VERSION),
          renderer: info ? gl.getParameter(info.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER),
          rendererInfoAvailable: info !== null,
        };
        return createPixiGpuFrameTimer({ renderer, enabled: true });
      },
      onError: (failure) => { if (active) setError(failure); },
    });
    const run = async () => {
      const transitions = [];
      const frames = [];
      for (const descriptor of [SHOJI, WAVE]) {
        setMeasurement({ backend: 'reference', descriptor });
        await settleFrames();
        await sampleFrames(350);
        frames.push({ scene: descriptor.id, backend: 'reference', intervals: await sampleFrames(2200),
          domNodes: document.querySelector('[data-zen-engine-benchmark] .zen-engine-specimen').querySelectorAll('*').length + 1 });
        setMeasurement({ backend: 'engine', descriptor });
        await settleFrames();
        transitions.push(await engine.select(descriptor, { animate: true }));
        await sampleFrames(350);
        engine.resetMeasurement();
        const intervals = await sampleFrames(2200);
        engine.pause();
        frames.push({ scene: descriptor.id, backend: 'engine', intervals, engine: engine.snapshot(),
          domNodes: 1 });
      }
      for (const descriptor of [SHOJI, WAVE, SHOJI, WAVE, SHOJI, WAVE]) {
        transitions.push(await engine.select(descriptor));
      }
      const warm = engine.snapshot();
      if (warm.sceneBuilds !== 2 || warm.cacheEntries !== 2 || warm.cacheHits < 6) throw new Error('ZEN_ENGINE_WARM_REUSE_FAILED');
      if (transitions.some((entry) => entry.engineId !== warm.engineId)) throw new Error('ZEN_ENGINE_RENDERER_REPLACED');
      if (canvasRef.current !== canvas) throw new Error('ZEN_ENGINE_CANVAS_REPLACED');
      const count = warm.frameCount;
      await sampleFrames(250);
      if (engine.snapshot().frameCount !== count) throw new Error('ZEN_ENGINE_IDLE_DREW_FRAME');
      const abandoned = engine.select({ id: 'shoji', nightDepth: 0.5 });
      const latest = engine.select(WAVE);
      const [oldReceipt, newReceipt] = await Promise.all([abandoned, latest]);
      if (oldReceipt.status !== 'superseded' || newReceipt.status !== 'committed') throw new Error('ZEN_ENGINE_STALE_SCENE_COMMITTED');

      const snapshots = {};
      for (const specimen of SPECIMENS) {
        await engine.select(specimen.descriptor, { atMs: specimen.atMs });
        // Same-task readback before the browser may discard the presented buffer.
        engine.draw(specimen.atMs);
        snapshots[specimen.key] = canvas.toDataURL('image/png');
      }
      const beforeDisposal = engine.snapshot();
      engine.dispose();
      const afterDisposal = engine.snapshot();
      if (!afterDisposal.disposed || afterDisposal.cacheEntries !== 0 || afterDisposal.loopRunning) throw new Error('ZEN_ENGINE_DISPOSAL_FAILED');
      const result = {
        schemaVersion: 1, kind: 'component-renderer-review', viewport: [480, 480],
        devicePixelRatio: window.devicePixelRatio, visibility: document.visibilityState, contextInfo,
        frames, transitions, warm, staleAdmission: { oldReceipt, newReceipt }, beforeDisposal, afterDisposal,
        limitations: ['Frame intervals are page scheduling observations, not whole-browser CPU or compositor cost.',
          'GPU samples bracket this Pixi renderer only; the CSS/SVG reference has no equivalent timer.',
          'This development component scene does not certify dashboard boot or MV3 behavior.'],
      };
      if (!active) return;
      setImages(snapshots);
      setReport(result);
      setMeasurement(null);
      console.info(`ZEN_ARTIFACT_ENGINE_REVIEW ${JSON.stringify(result)}`);
    };
    run().catch((failure) => { if (active) setError(failure); });
    return () => { active = false; engine.dispose(); };
  }, []);
  useLayoutEffect(() => {
    let cancelled = false;
    if (report && images) settleFrames().then(settleFrames).then(() => {
      if (!cancelled) signalReady();
    });
    return () => { cancelled = true; };
  }, [report, images, signalReady]);
  if (error) throw error;
  return (
    <main className="zen-engine-review">
      <header><p>ENTROPY / ZEN</p><h1>Artifact engine · first two scenes</h1>
        <p>Production reference on the left. Shared Pixi renderer on the right.</p></header>
      <div data-zen-engine-benchmark className="zen-engine-benchmark" style={{ display: report ? 'none' : 'block' }}>
        <p>{measurement ? `${measurement.descriptor.id} / ${measurement.backend}` : 'Preparing review'}</p>
        {measurement?.backend === 'reference' && <Reference key={measurement.descriptor.id} descriptor={measurement.descriptor} live />}
        <canvas ref={canvasRef} style={{ display: measurement?.backend === 'engine' ? 'block' : 'none' }} />
      </div>
      {images && <section data-visual-capture="engine-comparison">
        {SPECIMENS.map((specimen) => (
          <article key={specimen.key} data-visual-capture={specimen.key}>
            <h2>{specimen.title}</h2>
            <div className="zen-engine-pair">
              <div data-visual-capture={`${specimen.key}-reference`}><Reference descriptor={specimen.descriptor} atMs={specimen.atMs} /></div>
              <img data-visual-capture={`${specimen.key}-candidate`} src={images[specimen.key]} alt={`${specimen.title}, unified engine`} />
            </div>
          </article>
        ))}
      </section>}
      {report && <section className="zen-engine-results" data-visual-capture="engine-results">
        <h2>Renderer lifetime verified</h2>
        <p>One renderer · two initial scene builds · six warm switches · no idle redraw · stale admission rejected · resources disposed.</p>
        <table><thead><tr><th>Scene</th><th>Backend</th><th>Page rAF p95</th><th>DOM nodes</th><th>JS submit p95</th><th>GPU</th></tr></thead>
          <tbody>{report.frames.map((frame) => <tr key={`${frame.scene}-${frame.backend}`}>
            <td>{frame.scene}</td><td>{frame.backend}</td><td>{frame.intervals.p95Ms.toFixed(2)} ms</td><td>{frame.domNodes}</td>
            <td>{frame.engine ? `${frame.engine.submitP95Ms.toFixed(3)} ms` : 'Not measured'}</td>
            <td>{frame.engine?.gpu?.sampleCount ? `${frame.engine.gpu.avgGpuMs} ms` : frame.engine?.gpu?.reason || 'Not measured'}</td>
          </tr>)}</tbody></table>
        <p>Page rAF pacing is not presented FPS, CPU, or energy. Pixi is capped at 60 renders/second. CSS compositor work is outside its GPU timer.</p>
      </section>}
    </main>
  );
}

export default defineVisualSceneImplementation({
  Component: ZenArtifactEngineScene,
  prepare: () => preloadThemeWidgetChunk('zen', 'Artifact_Lethe'),
});
