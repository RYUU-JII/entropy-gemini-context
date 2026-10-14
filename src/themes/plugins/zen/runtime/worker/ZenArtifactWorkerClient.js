import { acquireZenHomeRendererWorkerChannel } from './ZenHomeRendererWorkerSession.js';
import { ZEN_HOME_RENDERER_CHANNEL } from './zenHomeRendererWorkerProtocol.js';
import { ZEN_ARTIFACT_MESSAGE as M, requireZenArtifactMessage, releaseZenArtifactMessage } from './zenArtifactWorkerProtocol.js';
import { snapshotZenArtifactDescriptor } from '../../presentation/artifacts/engine/zenArtifactDescriptor.js';
import { runRenderLoop } from '@/platform/rendering/renderLoop.js';
import { ARTIFACT_FIXED_RENDER_BUDGET } from '@/themes/core/tools/artifactMotionBudget.js';
import { resolveZenArtifactGalleryResolution } from '../../presentation/artifacts/engine/zenArtifactGalleryGeometry.js';

export function createZenArtifactWorkerClient({ canvas: initialCanvas = null, devicePixelRatio, onError }) {
  const resolution = resolveZenArtifactGalleryResolution(devicePixelRatio).effectivePixelRatio;
  let canvas = null, sink = null;
  const attachCanvas = next => {
    if (canvas && canvas !== next) throw new Error('ZEN_ARTIFACT_PRESENTATION_ALREADY_ATTACHED');
    const context = next.getContext('bitmaprenderer');
    if (!context) throw new Error('ZEN_ARTIFACT_BITMAP_PRESENTATION_UNAVAILABLE');
    canvas = next; sink = context;
  };
  if (initialCanvas) attachCanvas(initialCanvas);
  const port = acquireZenHomeRendererWorkerChannel({ channel: ZEN_HOME_RENDERER_CHANNEL.ARTIFACTS });
  const requests = new Map(), tickets = new WeakSet();
  let requestSequence = 0, generation = 0, displayedGeneration = 0;
  let disposed = false, failure = null, preparing = false, queued = null, prepared = null;
  let displayed = null;
  let snapshot = null, frameProgress = null, stopLoop = null, drawing = false, elapsedMs = 0;
  let displayedFrames = 0, displayP95Samples = [], discardedFrames = 0;
  const stop = () => { stopLoop?.(); stopLoop = null; elapsedMs = 0; };
  const clearPrepared = () => { if (prepared) { prepared.bitmap.close(); prepared = null; discardedFrames += 1; } };
  const fail = error => {
    if (failure || disposed) return;
    failure = error; stop(); clearPrepared();
    for (const request of requests.values()) { clearTimeout(request.timeout); request.reject(error); }
    requests.clear(); queued?.reject(error); queued = null; onError(error);
  };
  const request = message => new Promise((resolve, reject) => {
    if (disposed || failure) { reject(failure || new Error('ZEN_ARTIFACT_CLIENT_DISPOSED')); return; }
    const requestId = ++requestSequence;
    const timeout = setTimeout(() => fail(new Error('ZEN_ARTIFACT_WORKER_RESPONSE_TIMEOUT')), 25000);
    requests.set(requestId, { resolve, reject, timeout });
    try { port.postMessage({ ...message, requestId }); } catch (error) { fail(error); }
  });
  port.onerror = event => fail(event.error);
  port.onmessage = ({ data }) => {
    let message;
    try { message = requireZenArtifactMessage(data); } catch (error) { releaseZenArtifactMessage(data); fail(error); return; }
    if (disposed || failure) { releaseZenArtifactMessage(message); return; }
    if (message.type === M.MATERIALS_REQUEST) {
      void import('../../presentation/artifacts/engine/zenSvgMaterialCompiler.js').then(({ compileZenArtifactSvgMaterials }) =>
        compileZenArtifactSvgMaterials(message.descriptor, message.resolution)).then(layers => {
        if (disposed || failure) { for (const layer of layers) layer.bitmap.close(); return; }
        const reply = { type: M.MATERIALS, requestId: message.requestId, layers };
        try { port.postMessage(reply, layers.map(layer => layer.bitmap)); }
        catch (error) { releaseZenArtifactMessage(reply); fail(error); }
      }).catch(error => {
        if (!disposed && !failure) {
          try { port.postMessage({ type: M.MATERIALS_ERROR, requestId: message.requestId, message: error.message }); }
          catch (postError) { fail(postError); }
        }
      });
      return;
    }
    if (message.type === M.ERROR) { fail(new Error(message.message)); return; }
    const pending = requests.get(message.requestId);
    if (!pending || message.type !== M.RESULT) { releaseZenArtifactMessage(message); fail(new Error('ZEN_ARTIFACT_WORKER_RESPONSE_UNEXPECTED')); return; }
    requests.delete(message.requestId); clearTimeout(pending.timeout);
    // Scene inspection/p95 remain sampled. Actual Worker submits are exact on
    // every DRAW, including a late frame whose bitmap is discarded after parking.
    if (Object.hasOwn(message, 'snapshot')) {
      snapshot = message.snapshot;
      frameProgress = { frameCount: snapshot.frameCount, timeMs: snapshot.timeMs };
    }
    if (message.receipt.status === 'drawn') {
      frameProgress = { frameCount: message.receipt.frameCount, timeMs: message.receipt.timeMs };
    }
    pending.resolve(message);
  };
  const initialized = request({ type: M.INIT, width: 640, height: 960, devicePixelRatio });
  // Initialization belongs to this client even before its first React request.
  void initialized.catch(fail);
  const display = bitmap => {
    if (!sink || !canvas) { bitmap.close(); throw new Error('ZEN_ARTIFACT_PRESENTATION_NOT_ATTACHED'); }
    const started = performance.now();
    if (canvas.width !== bitmap.width) canvas.width = bitmap.width;
    if (canvas.height !== bitmap.height) canvas.height = bitmap.height;
    try { sink.transferFromImageBitmap(bitmap); }
    catch (error) { bitmap.close(); throw error; }
    displayP95Samples.push(performance.now() - started);
    if (displayP95Samples.length > 600) displayP95Samples.shift();
    displayedFrames += 1;
  };
  const play = ownerGeneration => {
    stop();
    stopLoop = runRenderLoop({ targetFps: ARTIFACT_FIXED_RENDER_BUDGET.targetFps, pauseWhenDocumentHidden: true,
      respectReducedMotion: true, onRender({ elapsedMs: delta }) {
        elapsedMs = Math.min(250, elapsedMs + delta);
        if (drawing || preparing || ownerGeneration !== generation || disposed || failure) return;
        drawing = true;
        const deltaMs = elapsedMs; elapsedMs = 0;
        void request({ type: M.DRAW, elapsedMs: deltaMs }).then(message => {
          if (!stopLoop || ownerGeneration !== generation || ownerGeneration !== displayedGeneration) {
            releaseZenArtifactMessage(message); discardedFrames += 1; return;
          }
          display(message.bitmap);
        }).catch(fail).finally(() => { drawing = false; pump(); });
      } });
  };
  const pump = () => {
    if (preparing || drawing || !queued || disposed || failure) return;
    const task = queued; queued = null; preparing = true;
    void (async () => {
      try {
        await initialized;
        if (disposed) throw new Error('ZEN_ARTIFACT_CLIENT_DISPOSED');
        if (failure) throw failure;
        // Initialization may finish after parking or a newer selection. Fence
        // dispatch too: discarding its later bitmap cannot undo a scene build.
        if (task.generation !== generation) { task.resolve({ status: 'superseded' }); return; }
        const message = await request({ type: M.PREPARE, descriptor: task.descriptor, options: task.options });
        if (disposed || failure || task.generation !== generation) {
          releaseZenArtifactMessage(message); discardedFrames += 1; task.resolve({ status: 'superseded' }); return;
        }
        if (!message.bitmap || message.receipt.status !== 'committed') throw new Error('ZEN_ARTIFACT_WORKER_FRAME_REQUIRED');
        const ticket = Object.freeze({ status: 'prepared', generation: task.generation, key: message.receipt.key });
        tickets.add(ticket); prepared = { ticket, requestId: message.requestId, bitmap: message.bitmap, receipt: message.receipt, animate: task.options.animate };
        task.resolve(ticket);
      } catch (error) { task.reject(error); fail(error); }
      finally { preparing = false; pump(); }
    })();
  };
  return {
    attachCanvas,
    detachCanvas() { this.pause(); canvas = null; sink = null; },
    // Static raked-ground frame. Independent of the artifact generation fence:
    // the caller owns ordering and displays the returned bitmap itself.
    renderGround(ground) {
      return request({ type: M.GROUND, ground }).then(message => {
        if (message.receipt?.status !== 'ground_rendered' || message.receipt.key !== ground.key || !message.bitmap) {
          releaseZenArtifactMessage(message);
          throw new Error('ZEN_ARTIFACT_WORKER_GROUND_RESULT_INVALID');
        }
        return message.bitmap;
      });
    },
    prepareFrame(descriptor, options) {
      if (disposed || failure) return Promise.reject(failure || new Error('ZEN_ARTIFACT_CLIENT_DISPOSED'));
      stop(); clearPrepared();
      const nextGeneration = ++generation;
      queued?.resolve({ status: 'superseded' });
      return new Promise((resolve, reject) => {
        queued = { descriptor: snapshotZenArtifactDescriptor(descriptor), options: structuredClone(options), generation: nextGeneration, resolve, reject };
        pump();
      });
    },
    commitFrame(ticket) {
      if (!tickets.has(ticket)) throw new Error('ZEN_ARTIFACT_FRAME_TICKET_INVALID');
      if (ticket.generation !== generation || prepared?.ticket !== ticket || disposed || failure) return { status: 'superseded' };
      const frame = prepared; prepared = null;
      display(frame.bitmap); displayedGeneration = generation;
      if (frame.animate) play(generation);
      const receipt = { ...frame.receipt, presentation: 'worker_bitmap', requestId: frame.requestId,
        displayedGeneration, resolution };
      displayed = { ticket, receipt };
      return receipt;
    },
    reuseDisplayedFrame(ticket) {
      if (!tickets.has(ticket)) throw new Error('ZEN_ARTIFACT_FRAME_TICKET_INVALID');
      if (disposed || failure || !canvas || displayed?.ticket !== ticket
        || ticket.generation !== generation || displayedGeneration !== generation) return { status: 'superseded' };
      // The sink already owns these pixels. Never re-consume its ImageBitmap or
      // restart the live simulation for a DOM-only publication.
      return { ...displayed.receipt, reusedDisplay: true };
    },
    pause() {
      stop(); generation += 1; clearPrepared();
      queued?.resolve({ status: 'superseded' }); queued = null;
    },
    snapshot() {
      if (!snapshot) return { status: 'initializing', loopRunning: false, backend: 'worker_bitmap', generation, displayedGeneration };
      const sorted = [...displayP95Samples].sort((a,b) => a-b);
      return { ...snapshot, ...frameProgress, disposed, generation, displayedGeneration, loopRunning: stopLoop !== null, backend: 'worker_bitmap', displayedFrames, discardedFrames,
        displayP95Ms: sorted.length ? sorted[Math.floor((sorted.length - 1) * .95)] : null,
        pendingFrameCount: Number(drawing) + Number(prepared !== null), pendingRequestCount: requests.size,
        workerChannelSessionId: port.channelSessionId };
    },
    dispose() {
      if (disposed) return;
      disposed = true; stop(); clearPrepared();
      const error = new Error('ZEN_ARTIFACT_CLIENT_DISPOSED');
      for (const pending of requests.values()) { clearTimeout(pending.timeout); pending.reject(error); }
      requests.clear(); queued?.resolve({ status: 'superseded' }); queued = null;
      port.terminate('zen_artifact_gallery_disposed');
    },
  };
}
