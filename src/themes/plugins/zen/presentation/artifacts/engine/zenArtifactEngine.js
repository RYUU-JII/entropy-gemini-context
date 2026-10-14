import { BaseTexture, Container, Renderer, Sprite, Texture } from '../../../runtime/worker/zenPixiWorkerRuntime.js';
import { ZEN_ARTIFACT_SVG_SCENES, releaseZenArtifactMaterials } from './zenArtifactMaterialContract.js';
import { runRenderLoop } from '@/platform/rendering/renderLoop.js';
import { ARTIFACT_FIXED_RENDER_BUDGET } from '@/themes/core/tools/artifactMotionBudget.js';
import { resolveRenderResolution } from '@/platform/rendering/renderBudgetContract.js';
import { getZenArtifactMaterialKey, snapshotZenArtifactDescriptor } from './zenArtifactDescriptor.js';
import { loadZenArtifactSceneFactory } from './zenArtifactSceneModules.js';
import { createZenKaresansuiHeightfieldRenderer } from '../karesansui/zenKaresansuiHeightfieldRenderer.js';
const MAX_SCENES = 4;
const MAX_TEXTURE_BYTES = 24 * 1024 * 1024;
let nextEngineId = 1;

function createSceneAssets(resolution, budgetBytes, layers) {
  const textures = [];
  const materials = new Map();
  let bytes = 0;
  let disposed = false;
  return {
    material(name) {
      if (disposed) throw new Error('ZEN_ARTIFACT_ASSETS_DISPOSED');
      if (materials.has(name)) return materials.get(name);
      const layer = layers.find(item => item.name === name);
      if (!layer) throw new Error(`ZEN_ARTIFACT_MATERIAL_LAYER_MISSING:${name}`);
      const texture = this.texture(layer.bitmap);
      materials.set(name, texture);
      return texture;
    },
    sprite(name) {
      const sprite = new Sprite(this.material(name));
      const layer = layers.find(item => item.name === name);
      sprite.position.set(layer.bounds[0], layer.bounds[1]);
      return sprite;
    },
    texture(canvas, textureResolution = resolution) {
      if (disposed) throw new Error('ZEN_ARTIFACT_ASSETS_DISPOSED');
      if (bytes + canvas.width * canvas.height * 4 > budgetBytes) throw new Error('ZEN_ARTIFACT_SCENE_TEXTURE_BUDGET_EXCEEDED');
      const texture = new Texture(new BaseTexture(canvas, { resolution: textureResolution, mipmap: 0 }));
      textures.push(texture);
      bytes += canvas.width * canvas.height * 4;
      return texture;
    },
    get bytes() { return bytes; },
    dispose() {
      if (disposed) return;
      disposed = true;
      textures.forEach((texture) => texture.destroy(true));
      textures.length = 0;
      materials.clear();
      releaseZenArtifactMaterials(layers);
    },
  };
}

function percentile(values, fraction) {
  if (!values.length) return null;
  return [...values].sort((a, b) => a - b)[Math.floor((values.length - 1) * fraction)];
}

export function createZenArtifactEngine({
  canvas, width, height, devicePixelRatio,
  createFrameTimer = null, onFrame = null, onError,
  prepareMaterials = null,
  clockDomain = 'document',
  maxScenes = MAX_SCENES, textureBudgetBytes = MAX_TEXTURE_BYTES,
}) {
  if (typeof onError !== 'function') throw new Error('ZEN_ARTIFACT_ENGINE_ERROR_HANDLER_REQUIRED');
  if (!Number.isInteger(maxScenes) || maxScenes < 1 || maxScenes > 7
    || !Number.isFinite(textureBudgetBytes) || textureBudgetBytes <= 0 || textureBudgetBytes > 64 * 1024 * 1024) {
    throw new Error('ZEN_ARTIFACT_CACHE_BUDGET_INVALID');
  }
  const size = resolveRenderResolution({
    cssWidth: width, cssHeight: height, devicePixelRatio, renderBudget: ARTIFACT_FIXED_RENDER_BUDGET,
  });
  const resolution = size.effectivePixelRatio;
  const rendererInitStartedAtMs = performance.now();
  const renderer = new Renderer({
    view: canvas, width, height, resolution, autoDensity: true,
    backgroundAlpha: 0, antialias: true, clearBeforeRender: true,
    powerPreference: 'low-power',
    zenPondSpriteBatchDialect: true,
    zenPondTilingSpriteDialect: true,
  });
  const rendererInitCompletedAtMs = performance.now();
  const engineId = nextEngineId++;
  const stage = new Container();
  const cache = new Map();
  const pending = new Map();
  const preparingAssets = new Set();
  const submitSamples = [];
  const updateSamples = [];
  let timer = createFrameTimer?.({ renderer }) || null;
  let selected = null;
  let requestGeneration = 0;
  let requestedKey = null;
  let preparedSelection = null;
  const selectionTickets = new WeakSet();
  let disposed = false;
  let stopLoop = null;
  let frameCount = 0;
  let sceneBuilds = 0;
  let cacheHits = 0;
  let sceneDisposals = 0;
  let timeMs = 0;
  let error = null;
  let ground = null;

  const assertAlive = () => {
    if (disposed) throw new Error('ZEN_ARTIFACT_ENGINE_DISPOSED');
    if (error) throw error;
  };
  const stop = () => {
    stopLoop?.();
    stopLoop = null;
  };
  const fail = (failure) => {
    error = failure;
    stop();
    onError(failure);
  };
  const onContextLost = (event) => {
    event.preventDefault();
    fail(new Error('ZEN_ARTIFACT_WEBGL_CONTEXT_LOST'));
  };
  canvas.addEventListener('webglcontextlost', onContextLost);
  const release = (entry) => {
    entry.scene.root.destroy({ children: true });
    entry.scene.dispose?.();
    entry.assets.dispose();
    sceneDisposals += 1;
  };
  const prune = (protectedEntry = selected) => {
    let bytes = [...cache.values()].reduce((sum, entry) => sum + entry.assets.bytes, 0);
    for (const [key, entry] of cache) {
      if (cache.size <= maxScenes && bytes <= textureBudgetBytes) break;
      if (entry === selected || entry === protectedEntry || key === requestedKey) continue;
      cache.delete(key);
      bytes -= entry.assets.bytes;
      release(entry);
    }
    if (bytes > textureBudgetBytes) throw new Error('ZEN_ARTIFACT_SCENE_TEXTURE_BUDGET_EXCEEDED');
  };
  const record = (samples, value) => {
    if (samples.length === 600) samples.shift();
    samples.push(value);
  };
  const draw = (atMs) => {
    assertAlive();
    if (!selected) throw new Error('ZEN_ARTIFACT_SCENE_NOT_SELECTED');
    if (!Number.isFinite(atMs) || atMs < 0) throw new Error('ZEN_ARTIFACT_SCENE_TIME_INVALID');
    timeMs = atMs;
    const updateStart = performance.now();
    selected.scene.update(timeMs);
    const updateMs = performance.now() - updateStart;
    record(updateSamples, updateMs);
    timer?.begin();
    const submitStart = performance.now();
    try { renderer.render(stage); } finally { timer?.end(); }
    const submitCompletedAtMs = performance.now();
    const submitMs = submitCompletedAtMs - submitStart;
    record(submitSamples, submitMs);
    frameCount += 1;
    // Optional development capture, outside the timed render bracket. Read
    // the buffer in this task, before the browser may discard it on present.
    onFrame?.(canvas);
    return { frameCount, timeMs, updateMs, submitMs, submitStartedAtMs: submitStart, submitCompletedAtMs };
  };
  const prepare = async (descriptor) => {
    assertAlive();
    const key = getZenArtifactMaterialKey(descriptor);
    if (cache.has(key)) {
      cacheHits += 1;
      const entry = cache.get(key);
      cache.delete(key);
      cache.set(key, entry);
      return entry;
    }
    if (pending.has(key)) return pending.get(key);
    if (pending.size >= maxScenes) throw new Error('ZEN_ARTIFACT_PREPARATION_CAPACITY_EXCEEDED');
    // Keep the validated cache identity and lazy preparation inputs atomic even
    // when an imperative caller reuses its descriptor object for a newer state.
    const presentation = snapshotZenArtifactDescriptor(descriptor);
    const preparation = (async () => {
      const started = performance.now();
      const create = await loadZenArtifactSceneFactory(presentation.id);
      const loadMs = performance.now() - started;
      assertAlive();
      let layers = [];
      if (ZEN_ARTIFACT_SVG_SCENES.includes(presentation.id)) {
        if (typeof prepareMaterials !== 'function') throw new Error('ZEN_ARTIFACT_MATERIAL_COMPILER_REQUIRED');
        layers = await prepareMaterials(presentation, resolution);
        if (disposed) { releaseZenArtifactMaterials(layers); assertAlive(); }
      }
      const assets = createSceneAssets(resolution, textureBudgetBytes, layers);
      preparingAssets.add(assets);
      let scene = null;
      try {
        const bakeStarted = performance.now();
        scene = await create({ ...presentation, assets, resolution, webGLVersion: renderer.context.webGLVersion });
        assertAlive();
        scene.root.position.set(width / 2, height / 2);
        scene.place?.(width / 2, height / 2);
        const entry = { key, scene, assets, id: presentation.id, loadMs, prepareMs: performance.now() - started, bakeMs: performance.now() - bakeStarted };
        if (assets.bytes > textureBudgetBytes) {
          throw new Error('ZEN_ARTIFACT_SCENE_TEXTURE_BUDGET_EXCEEDED');
        }
        cache.set(key, entry);
        prune(entry);
        sceneBuilds += 1;
        return entry;
      } catch (failure) {
        cache.delete(key);
        scene?.root.destroy({ children: true });
        scene?.dispose?.();
        assets.dispose();
        throw failure;
      } finally { preparingAssets.delete(assets); }
    })();
    pending.set(key, preparation);
    try { return await preparation; } finally { pending.delete(key); }
  };

  const api = {
    renderGround(request) {
      assertAlive();
      if (!ground) ground = createZenKaresansuiHeightfieldRenderer({ renderer });
      const bitmap = ground.render(request);
      return { bitmap, renderCount: ground.snapshot().renderCount };
    },
    prepare,
    async prepareSelection(descriptor) {
      assertAlive();
      const input = snapshotZenArtifactDescriptor(descriptor);
      const key = getZenArtifactMaterialKey(input);
      const generation = ++requestGeneration;
      requestedKey = key;
      preparedSelection = null;
      const started = performance.now();
      try {
        const entry = await prepare(input);
        if (disposed || generation !== requestGeneration) return { status: 'superseded' };
        const ticket = Object.freeze({ status: 'prepared', key, engineId, generation });
        selectionTickets.add(ticket);
        preparedSelection = { ticket, entry, descriptor: input, started, submitted: false };
        return ticket;
      } catch (failure) {
        if (generation === requestGeneration) requestedKey = null;
        throw failure;
      }
    },
    commitSelection(ticket, { atMs = 0, animate = false, presentation = null, origin = null,
      preserveTime = false, descriptor = null } = {}) {
      assertAlive();
      if (!selectionTickets.has(ticket)) throw new Error('ZEN_ARTIFACT_SELECTION_TICKET_INVALID');
      if (preparedSelection?.ticket !== ticket || ticket.generation !== requestGeneration) return { status: 'superseded' };
      const input = descriptor === null ? preparedSelection.descriptor : descriptor;
      if (getZenArtifactMaterialKey(input) !== ticket.key) throw new Error('ZEN_ARTIFACT_SELECTION_DESCRIPTOR_MISMATCH');
      if (origin !== null && (!Number.isFinite(origin.x) || !Number.isFinite(origin.y))) throw new Error('ZEN_ARTIFACT_SCENE_ORIGIN_INVALID');
      const { entry } = preparedSelection;
      const started = preparedSelection.submitted ? performance.now() : preparedSelection.started;
      stop();
      const nextTime = preserveTime && selected?.id === entry.id ? timeMs : atMs;
      const continuity = preserveTime && selected?.id === entry.id ? selected.scene.continuity?.() : null;
      stage.removeChildren();
      selected = entry;
      stage.addChild(entry.scene.root);
      entry.scene.configure?.(presentation, continuity, input);
      const x = origin ? origin.x : width / 2;
      const y = origin ? origin.y : height / 2;
      entry.scene.root.position.set(x, y);
      entry.scene.place?.(x, y);
      const firstFrame = draw(nextTime);
      requestedKey = null;
      preparedSelection.submitted = true;
      prune();
      if (animate) api.play();
      return { status: 'committed', key: entry.key, engineId, transitionMs: performance.now() - started,
        loadMs: entry.loadMs, prepareMs: entry.prepareMs, bakeMs: entry.bakeMs, firstFrame };
    },
    async select(descriptor, options) {
      const ticket = await api.prepareSelection(descriptor);
      return ticket.status === 'superseded' ? ticket : api.commitSelection(ticket, options);
    },
    draw,
    getTimeMs() { assertAlive(); return timeMs; },
    pause: stop,
    play() {
      assertAlive();
      if (!selected) throw new Error('ZEN_ARTIFACT_SCENE_NOT_SELECTED');
      stop();
      stopLoop = runRenderLoop({
        targetFps: ARTIFACT_FIXED_RENDER_BUDGET.targetFps,
        pauseWhenDocumentHidden: true,
        respectReducedMotion: true,
        onRender({ elapsedMs }) {
          try { draw(timeMs + elapsedMs); } catch (failure) { fail(failure); }
        },
      });
    },
    resetMeasurement() {
      submitSamples.length = 0;
      updateSamples.length = 0;
      timer?.dispose();
      timer = createFrameTimer?.({ renderer }) || null;
    },
    snapshot() {
      return {
        engineId, disposed, error: error?.message || null, selected: selected?.key || null,
        timeMs, sampledAtMs: performance.now(),
        clockDomain, timeOriginMs: performance.timeOrigin,
        rendererInitialization: { startedAtMs: rendererInitStartedAtMs, completedAtMs: rendererInitCompletedAtMs,
          durationMs: rendererInitCompletedAtMs - rendererInitStartedAtMs },
        loopRunning: stopLoop !== null, frameCount, sceneBuilds, cacheHits, sceneDisposals,
        cacheEntries: cache.size, textureBytes: [...cache.values()].reduce((sum, entry) => sum + entry.assets.bytes, 0),
        textureBudgetBytes, resolution, geometry: selected?.scene.geometry || null,
        presentation: selected?.scene.inspect?.() || null,
        updateP95Ms: percentile(updateSamples, 0.95), submitP95Ms: percentile(submitSamples, 0.95),
        measuredFrames: submitSamples.length, gpu: timer?.snapshot() || null,
      };
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      requestGeneration += 1;
      preparedSelection = null;
      requestedKey = null;
      stop();
      timer?.dispose();
      for (const assets of preparingAssets) assets.dispose();
      preparingAssets.clear();
      stage.removeChildren();
      for (const entry of cache.values()) release(entry);
      cache.clear();
      selected = null;
      ground?.dispose();
      stage.destroy();
      canvas.removeEventListener('webglcontextlost', onContextLost);
      renderer.destroy(false);
    },
  };
  return api;
}
