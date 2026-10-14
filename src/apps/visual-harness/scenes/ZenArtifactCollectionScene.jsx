import { compileZenArtifactSvgMaterials } from '../../../themes/plugins/zen/presentation/artifacts/engine/zenSvgMaterialCompiler.js';
import { measureZenFurinConnections, measureZenFurinCordPaint } from '../../../themes/plugins/zen/presentation/artifacts/engine/zenFurinConnectionDiagnostics.dev.js';
import React, { useLayoutEffect, useRef, useState } from 'react';
import { defineVisualSceneImplementation } from '../visualSceneContract.js';
import { getThemeWidget, preloadThemeWidgetChunk } from '../../../themes/core/registry/index.js';
import { createZenArtifactEngine } from '../../../themes/plugins/zen/presentation/artifacts/engine/zenArtifactEngine.js';
import ZenKineticArtifactReference from '../../../themes/plugins/zen/presentation/artifacts/engine/ZenKineticArtifactReference.jsx';
import { formatLocalDayKey } from '../../../themes/plugins/zen/presentation/artifacts/engine/zenEnsoRecipe.js';
import { createPixiGpuFrameTimer } from '../../../themes/plugins/zen/pond/renderers/pixi/telemetry/pixiGpuFrameTimer.js';
import { buildArtifactActivityState, resolveArtifactRenderState } from '../../../themes/core/tools/artifactPresentation.js';
import { resolveArtifactSimulationRuntime } from '../../../themes/core/artifacts/runtime/simulationRuntime.js';
import '../../dashboard/tailwind.css';
import './zenArtifactEngineScene.css';

const DESCRIPTORS = Object.freeze([
  { id: 'enso', color: '#c5a14a', nightDepth: 0, isActive: true, dayKey: formatLocalDayKey(), constellationVisible: false },
  { id: 'tome-ishi', color: '#8a6752', nightDepth: 0, isActive: true },
  { id: 'ishidouro', color: '#17191c', nightDepth: 0, isActive: true },
  { id: 'furin', color: '#c84f42', isActive: true, mantra: ['此', '刻', '是', '真'] },
  { id: 'shishi-odoshi', color: '#5f8a6d', isActive: true },
]);
// Enso is staged by veiled signals: all three close the circle (the reference
// loop), none leaves it open among the stars.
const ENSO_STAGE_COUNT = 3;
const presentationFor = (descriptor, stage = ENSO_STAGE_COUNT) => (descriptor.id === 'enso'
  ? { constellationVisible: descriptor.constellationVisible, stage, stageCount: ENSO_STAGE_COUNT, instant: true }
  : null);
const SPECIMENS = [
  { key: 'enso-active', descriptor: DESCRIPTORS[0], atMs: 0, presentation: presentationFor(DESCRIPTORS[0]) },
  { key: 'enso-idle', descriptor: { ...DESCRIPTORS[0], isActive: false }, atMs: 0, presentation: presentationFor(DESCRIPTORS[0], 0) },
  { key: 'tome-day', descriptor: DESCRIPTORS[1], atMs: 0 },
  { key: 'tome-night', descriptor: { ...DESCRIPTORS[1], nightDepth: 1 }, atMs: 2250 },
  { key: 'lantern-day', descriptor: DESCRIPTORS[2], atMs: 0 },
  { key: 'lantern-night', descriptor: { ...DESCRIPTORS[2], nightDepth: 1 }, atMs: 1500 },
  { key: 'furin-rest', descriptor: DESCRIPTORS[3], atMs: 0 },
  { key: 'furin-back', descriptor: DESCRIPTORS[3], atMs: 600 },
  { key: 'furin-swing', descriptor: DESCRIPTORS[3], atMs: 8000 },
  // First real contact under the canonical ambient wind, not a forced cue.
  { key: 'furin-impact', descriptor: DESCRIPTORS[3], atMs: 89200 },
  { key: 'shishi-fill', descriptor: DESCRIPTORS[4], atMs: 1000 },
  { key: 'shishi-tip', descriptor: DESCRIPTORS[4], atMs: 4500 },
  { key: 'shishi-dump', descriptor: DESCRIPTORS[4], atMs: 6500 },
  { key: 'shishi-return', descriptor: DESCRIPTORS[4], atMs: 8000 },
];
const WIDGETS = { enso: 'Artifact_Veil', 'tome-ishi': 'Artifact_Brake', ishidouro: 'Artifact_Monolith' };
const nextFrame = () => new Promise(resolve => requestAnimationFrame(resolve));
async function settle() { await nextFrame(); await nextFrame(); }
async function sample(duration) {
  const times = []; let last = await nextFrame(); const start = last;
  do {
    const now = await nextFrame();
    if (document.visibilityState !== 'visible') throw new Error('ZEN_COLLECTION_DOCUMENT_HIDDEN');
    times.push(now - last); last = now;
  } while (last - start < duration);
  times.sort((a, b) => a - b);
  return { samples: times.length, p95Ms: times[Math.floor(times.length * .95)], over25Ms: times.filter(t => t > 25).length };
}

async function recordPreview(canvas, signal) {
  if (signal.aborted) throw new Error('ZEN_COLLECTION_VIDEO_ABORTED');
  const mimeType = 'video/webm;codecs=vp9';
  if (!MediaRecorder.isTypeSupported(mimeType)) throw new Error('ZEN_COLLECTION_VIDEO_CODEC_UNAVAILABLE');
  const stream = canvas.captureStream(30);
  let recorder;
  const chunks = [];
  let timeout;
  let abort;
  try {
    recorder = new MediaRecorder(stream, { mimeType, videoBitsPerSecond: 2_000_000 });
    const recording = new Promise((resolve,reject) => {
      recorder.ondataavailable = event => { if (event.data.size) chunks.push(event.data); };
      recorder.onstop = resolve;
      recorder.onerror = event => reject(new Error(`ZEN_COLLECTION_VIDEO_FAILED:${event.error?.message}`));
      abort = () => { if (recorder.state !== 'inactive') recorder.stop(); reject(new Error('ZEN_COLLECTION_VIDEO_ABORTED')); };
      signal.addEventListener('abort',abort,{once:true});
      recorder.start();
      timeout = setTimeout(() => recorder.stop(),3000);
    });
    await recording;
    if (!chunks.length) throw new Error('ZEN_COLLECTION_VIDEO_EMPTY');
    return await new Promise((resolve,reject) => {
      const reader = new FileReader(); reader.onload = () => resolve(reader.result); reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(new Blob(chunks,{type:mimeType}));
    });
  } finally {
    clearTimeout(timeout); signal.removeEventListener('abort',abort);
    if (recorder && recorder.state !== 'inactive') recorder.stop();
    stream.getTracks().forEach(track => track.stop());
  }
}

function Reference({ descriptor, atMs }) {
  const ref = useRef(null);
  useLayoutEffect(() => {
    let active = true;
    settle().then(() => {
      if (!active || !ref.current) return;
      if (descriptor.id === 'tome-ishi') {
        const knot = ref.current.querySelector('[data-tome-ishi-knot]');
        knot.style.opacity = atMs === 2250 ? '1' : '.9';
        knot.style.filter = atMs === 2250 ? 'drop-shadow(0 0 4px rgba(226,206,186,.55))' : 'drop-shadow(0 0 1px rgba(168,126,91,.25))';
      }
    });
    return () => { active = false; };
  }, [descriptor, atMs]);
  const Widget = WIDGETS[descriptor.id] ? getThemeWidget('zen', WIDGETS[descriptor.id]) : null;
  const context = {
    environment: { nightDepth: descriptor.nightDepth },
    motion: { budget: { mode: 'still', isStill: true, isAmbient: false, isFull: false, shouldAnimate: false } },
    renderState: { isVisuallyActive: descriptor.isActive, shouldRenderEffects: descriptor.isActive, reducedMotion: true },
  };
  return <div className="zen-engine-specimen" ref={ref}>
    {Widget ? <Widget color={descriptor.color} isActive={descriptor.isActive} artifactRenderContext={context} />
      : <ZenKineticArtifactReference descriptor={descriptor} atMs={atMs} />}
  </div>;
}

function ZenArtifactCollectionScene({ signalReady }) {
  const canvasRef = useRef(null);
  const [current, setCurrent] = useState('Preparing materials');
  const [result, setResult] = useState(null);
  const [images, setImages] = useState(null);
  const [error, setError] = useState(null);
  useLayoutEffect(() => {
    let active = true; let contextInfo = null;
    const recordingAbort = new AbortController();
    let recordingContext = null;
    const canvas = canvasRef.current;
    const engine = createZenArtifactEngine({ prepareMaterials: compileZenArtifactSvgMaterials, canvas, width: 640, height: 640, devicePixelRatio: window.devicePixelRatio,
      createFrameTimer: ({ renderer }) => {
        const gl = renderer.gl, debug = gl.getExtension('WEBGL_debug_renderer_info');
        contextInfo = { version: gl.getParameter(gl.VERSION), renderer: gl.getParameter(debug ? debug.UNMASKED_RENDERER_WEBGL : gl.RENDERER) };
        return createPixiGpuFrameTimer({ renderer, enabled: true });
      }, onError: failure => { if (active) setError(failure); },
      onFrame: frame => {
        if (!recordingContext) return;
        recordingContext.fillStyle = '#faf9f5';
        recordingContext.fillRect(0,0,frame.width,frame.height);
        recordingContext.drawImage(frame,0,0);
      },
    });
    const run = async () => {
      const frames = [], transitions = [];
      for (const descriptor of DESCRIPTORS) {
        setCurrent(descriptor.id);
        const benchmark = descriptor.id === 'ishidouro' ? { ...descriptor, nightDepth: 1 } : descriptor;
        const atMs = descriptor.id === 'shishi-odoshi' ? 5000 : 0;
        transitions.push(await engine.select(benchmark, { atMs, animate: true, presentation: presentationFor(benchmark) }));
        await sample(350); engine.resetMeasurement();
        const intervals = await sample(2200); engine.pause();
        const before = engine.snapshot();
        frames.push({ scene: descriptor.id, descriptor: benchmark, startAtMs: atMs, intervals, engine: before });
        for (let i = 0; i < 2; i += 1) transitions.push(await engine.select(benchmark, { presentation: presentationFor(benchmark) }));
        if (engine.snapshot().sceneBuilds !== before.sceneBuilds) throw new Error('ZEN_COLLECTION_CACHED_SCENE_REBUILT');
      }
      const warm = engine.snapshot();
      if (warm.cacheEntries > 4 || warm.cacheHits < 10 || warm.sceneDisposals < 1) throw new Error('ZEN_COLLECTION_CACHE_BOUND_FAILED');
      if (transitions.some(t => t.engineId !== warm.engineId) || canvasRef.current !== canvas) throw new Error('ZEN_COLLECTION_RENDERER_REPLACED');
      await sample(250);
      if (engine.snapshot().frameCount !== warm.frameCount) throw new Error('ZEN_COLLECTION_IDLE_REDRAW');
      // Encoding is deliberately outside all timing samples. Review water and
      // articulated motion as motion, in addition to the static comparisons.
      const videos = {};
      const recordingCanvas = document.createElement('canvas');
      recordingCanvas.width=canvas.width; recordingCanvas.height=canvas.height;
      for (const descriptor of DESCRIPTORS) {
        setCurrent(`${descriptor.id} / recording preview`);
        const preview = descriptor.id === 'ishidouro' ? { ...descriptor, nightDepth: 1 } : descriptor;
        recordingContext=recordingCanvas.getContext('2d',{alpha:false});
        if (!recordingContext) throw new Error('ZEN_COLLECTION_VIDEO_CANVAS_UNAVAILABLE');
        await engine.select(preview,{atMs:descriptor.id === 'shishi-odoshi' ? 5000 : 0,animate:true,presentation:presentationFor(preview)});
        videos[descriptor.id] = await recordPreview(recordingCanvas,recordingAbort.signal);
        engine.pause();
        recordingContext=null;
      }
      console.info(`ZEN_ARTIFACT_COLLECTION_VIDEOS ${JSON.stringify(videos)}`);
      const snapshots = {}, poses = {};
      for (const specimen of SPECIMENS) {
        await engine.select(specimen.descriptor, { atMs: specimen.atMs, presentation: specimen.presentation ?? null }); engine.draw(specimen.atMs);
        snapshots[specimen.key] = canvas.toDataURL('image/png');
        poses[specimen.key] = engine.snapshot().presentation;
        if (specimen.key === 'furin-impact'
          && (poses[specimen.key].impactCount < 1 || poses[specimen.key].impact.opacity <= 0)) {
          throw new Error('ZEN_FURIN_CONTACT_CUE_MISSING');
        }
      }
      // Exercise configure() with the ordinary ON-but-not-engaged contract.
      // Unconfigured isActive replay always uses live wind and missed this bug.
      const activity = buildArtifactActivityState({ artifactId: 'flare', configuredActive: true });
      const renderState = resolveArtifactRenderState({ artifactActivity: activity });
      const armedPresentation = { ...resolveArtifactSimulationRuntime({ artifactActivity: activity,
        artifactRenderState: renderState }), shouldAnimateAmbient: true };
      await engine.select(DESCRIPTORS[3], { presentation: armedPresentation });
      const paintedKoiLocal = engine.snapshot().presentation.paintedKoiLocal;
      const angleRanges = Array.from({ length: 3 }, () => ({ min: 0, max: 0 }));
      for (let frame = 1; frame <= 600; frame += 1) {
        engine.draw(frame * 1000 / 60);
        const observed = engine.snapshot().presentation;
        if (observed.paintedKoiLocal.x !== paintedKoiLocal.x || observed.paintedKoiLocal.y !== paintedKoiLocal.y) {
          throw new Error('ZEN_FURIN_PAINT_DETACHED_FROM_GLASS');
        }
        observed.angles.forEach((angle, i) => {
          angleRanges[i].min = Math.min(angleRanges[i].min, angle);
          angleRanges[i].max = Math.max(angleRanges[i].max, angle);
        });
      }
      if (armedPresentation.simulationMode !== 'settle'
        || angleRanges.some(({ min, max }) => max - min < 0.1)) throw new Error('ZEN_FURIN_ARMED_MOTION_MISSING');
      poses.furinArmed = { ...engine.snapshot().presentation, angleRanges };
      snapshots['furin-armed'] = canvas.toDataURL('image/png');
      const furinCordPaint = await measureZenFurinCordPaint(DESCRIPTORS[3]);
      const beforeDisposal = engine.snapshot(); engine.dispose(); const afterDisposal = engine.snapshot();
      if (!afterDisposal.disposed || afterDisposal.textureBytes || afterDisposal.cacheEntries || afterDisposal.loopRunning) throw new Error('ZEN_COLLECTION_DISPOSAL_FAILED');
      const report = { schemaVersion: 1, kind: 'remaining-artifact-renderer-review', viewport: [640, 640], devicePixelRatio: window.devicePixelRatio,
        visibility: document.visibilityState, contextInfo, descriptors: DESCRIPTORS, frames, transitions, poses, furinCordPaint, warm, beforeDisposal, afterDisposal,
        limitations: ['Candidate GPU only; no equivalent CSS/SVG GPU measurement.',
          'Frozen canonical geometry/physics references omit autonomous secondary effects; this is not a pixel-equality assertion.',
          'Water shares the transparent SVG material; GPU refraction and SVG highlights are presentation equivalents. Lantern materials are recompiled from CSS construction.',
          'No dashboard/MV3 integration or behavioral gate certification.'],
      };
      if (!active) return;
      setImages(snapshots); setResult(report);
      console.info(`ZEN_ARTIFACT_COLLECTION_REVIEW ${JSON.stringify(report)}`);
    };
    run().catch(failure => { if (active) setError(failure); });
    return () => { active = false; recordingContext=null; recordingAbort.abort(); engine.dispose(); };
  }, []);
  useLayoutEffect(() => {
    let active = true;
    if (images && result) settle().then(settle).then(() => {
      if (!active) return;
      const connections = SPECIMENS.filter(specimen => specimen.descriptor.id === 'furin').map(specimen => ({
        specimen: specimen.key,
        errors: measureZenFurinConnections(document.querySelector(`[data-visual-capture="${specimen.key}-reference"] svg`)),
      }));
      console.info(`ZEN_FURIN_CONNECTIONS ${JSON.stringify(connections)}`);
      signalReady();
    }).catch(failure => { if (active) setError(failure); });
    return () => { active = false; };
  }, [images, result, signalReady]);
  if (error) throw error;
  return <main className="zen-engine-review zen-engine-collection">
    <header><p>ENTROPY / ZEN</p><h1>Remaining five artifact scenes</h1><p>Canonical presentation reference / retained Pixi candidate. Secondary motion differs in frozen reference views.</p></header>
    <div className="zen-engine-benchmark" style={{ display: result ? 'none' : 'block' }}><p>{current}</p><canvas ref={canvasRef} /></div>
    {images && <section data-visual-capture="collection-comparison">{SPECIMENS.map(s => <article key={s.key} data-visual-capture={s.key}>
      <h2>{s.key} · {s.atMs / 1000} s</h2><div className="zen-engine-pair">
        <div data-visual-capture={`${s.key}-reference`}><Reference descriptor={s.descriptor} atMs={s.atMs} /></div>
        <img data-visual-capture={`${s.key}-candidate`} src={images[s.key]} alt={`${s.key} candidate`} />
      </div></article>)}<article data-visual-capture="furin-armed">
        <h2>Furin · enabled and waiting · actual configured Pixi scene</h2>
        <img src={images['furin-armed']} alt="Armed Furin in an ambient breeze" />
      </article></section>}
    {result && <section className="zen-engine-results" data-visual-capture="collection-results"><h2>One renderer · bounded cache · no idle frames · disposed</h2>
      <table><thead><tr><th>Scene</th><th>Update p95</th><th>Submit p95</th><th>GPU average</th><th>Samples</th></tr></thead>
        <tbody>{result.frames.map(f => <tr key={f.scene}><td>{f.scene}</td><td>{f.engine.updateP95Ms.toFixed(3)} ms</td>
          <td>{f.engine.submitP95Ms.toFixed(3)} ms</td><td>{f.engine.gpu.avgGpuMs} ms</td><td>{f.engine.gpu.sampleCount}</td></tr>)}</tbody></table>
      <p>Renderer timings exclude CSS compositor cost and do not establish an overall speedup. Cache: at most four scenes, 24 MiB source textures.</p>
    </section>}
  </main>;
}
export default defineVisualSceneImplementation({ Component: ZenArtifactCollectionScene,
  prepare: () => Promise.all(Object.values(WIDGETS).map(id => preloadThemeWidgetChunk('zen', id))),
});
