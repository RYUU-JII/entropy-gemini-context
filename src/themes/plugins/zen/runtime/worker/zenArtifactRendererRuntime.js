import { createZenArtifactEngine } from '../../presentation/artifacts/engine/zenArtifactEngine.js';
import { ensurePixiWorkerCanvasEventSurface } from './zenPixiWorkerEnvironment.js';
import { ZEN_ARTIFACT_MESSAGE as M, requireZenArtifactMessage, releaseZenArtifactMessage } from './zenArtifactWorkerProtocol.js';
import { ARTIFACT_RUNTIME_PROFILE } from '@/themes/core/tools/artifactMotionBudget.js';

export function createZenArtifactRendererRuntime({ postMessage }) {
  let engine = null, canvas = null, disposed = false, preparing = false, materialSequence = 0;
  let nextSnapshotAtMs = 0;
  const materialRequests = new Map();
  const dispose = () => {
    if (disposed) return;
    disposed = true;
    for (const pending of materialRequests.values()) { clearTimeout(pending.timeout); pending.reject(new Error('ZEN_ARTIFACT_WORKER_DISPOSED')); }
    materialRequests.clear(); engine?.dispose(); engine = null; canvas = null;
  };
  const post = (message, transfer = []) => {
    try {
      if (!postMessage(message, transfer)) throw new Error('ZEN_ARTIFACT_WORKER_CHANNEL_CLOSED');
    } catch (error) { releaseZenArtifactMessage(message); throw error; }
  };
  const result = (requestId, receipt, includeFrame) => {
    const bitmap = includeFrame ? canvas.transferToImageBitmap() : null;
    const nowMs = performance.now();
    // INIT/PREPARE acknowledge exact work. Animation carries diagnostics only
    // at the existing metrics cadence; percentile sorting is not frame work.
    const includeSnapshot = receipt.status !== 'drawn' || nowMs >= nextSnapshotAtMs;
    const diagnostics = includeSnapshot ? { snapshot: engine.snapshot() } : {};
    if (includeSnapshot) nextSnapshotAtMs = nowMs + ARTIFACT_RUNTIME_PROFILE.metricsSampleIntervalMs;
    post({ type: M.RESULT, requestId, receipt, bitmap, ...diagnostics }, bitmap ? [bitmap] : []);
  };
  const failure = (requestId, error) => post({ type: M.ERROR, requestId, message: error.message });
  const prepareMaterials = (descriptor, resolution) => new Promise((resolve, reject) => {
    const requestId = ++materialSequence;
    const timeout = setTimeout(() => {
      materialRequests.delete(requestId); reject(new Error('ZEN_ARTIFACT_WORKER_MATERIAL_TIMEOUT'));
    }, 20000);
    materialRequests.set(requestId, { resolve, reject, timeout });
    try { post({ type: M.MATERIALS_REQUEST, requestId, descriptor, resolution }); }
    catch (error) { materialRequests.delete(requestId); clearTimeout(timeout); reject(error); }
  });
  return {
    handleMessage({ data }) {
      const message = requireZenArtifactMessage(data);
      if (message.type === M.DISPOSE) { dispose(); return; }
      if (disposed) { releaseZenArtifactMessage(message); throw new Error('ZEN_ARTIFACT_WORKER_DISPOSED'); }
      const { requestId } = message;
      if (message.type === M.INIT) {
        if (engine) throw new Error('ZEN_ARTIFACT_WORKER_ALREADY_INITIALIZED');
        const { width, height, devicePixelRatio } = message;
        if (width !== 640 || height !== 960 || !Number.isFinite(devicePixelRatio) || devicePixelRatio <= 0) throw new Error('ZEN_ARTIFACT_WORKER_SIZE_INVALID');
        canvas = ensurePixiWorkerCanvasEventSurface(new OffscreenCanvas(width, height));
        engine = createZenArtifactEngine({ canvas, width, height, devicePixelRatio, maxScenes: 7,
          textureBudgetBytes: 48 * 1024 * 1024, prepareMaterials, clockDomain: 'worker', onError: error => failure(requestId, error) });
        result(requestId, { status: 'initialized' }, false);
      } else if (message.type === M.MATERIALS || message.type === M.MATERIALS_ERROR) {
        const pending = materialRequests.get(requestId);
        if (!pending) { releaseZenArtifactMessage(message); return; }
        materialRequests.delete(requestId); clearTimeout(pending.timeout);
        if (message.type === M.MATERIALS_ERROR) pending.reject(new Error(message.message));
        else pending.resolve(message.layers);
      } else if (message.type === M.PREPARE) {
        if (!engine || preparing) throw new Error('ZEN_ARTIFACT_WORKER_PREPARATION_STATE_INVALID');
        preparing = true;
        // Material responses must remain dispatchable while preparation awaits UI
        // SVG compilation; do not block the physical owner's channel message chain.
        void engine.select(message.descriptor, { ...message.options, animate: false, preserveTime: true }).then(receipt => {
          if (!disposed) result(requestId, receipt, receipt.status === 'committed');
        }).catch(error => { if (!disposed) failure(requestId, error); }).finally(() => { preparing = false; });
      } else if (message.type === M.GROUND) {
        // A ground failure is this channel's failure (reported to the client),
        // never a terminal fault of the shared home renderer worker.
        let bitmap = null;
        let renderCount;
        try {
          if (!engine) throw new Error('ZEN_ARTIFACT_WORKER_NOT_INITIALIZED');
          ({ bitmap, renderCount } = engine.renderGround(message.ground));
        } catch (error) { failure(requestId, error); return; }
        post({ type: M.RESULT, requestId, receipt: { status: 'ground_rendered', key: message.ground.key,
          width: bitmap.width, height: bitmap.height, renderCount }, bitmap }, [bitmap]);
      } else if (message.type === M.DRAW) {
        if (!engine || preparing) throw new Error('ZEN_ARTIFACT_WORKER_DRAW_STATE_INVALID');
        const firstFrame = engine.draw(engine.getTimeMs() + message.elapsedMs);
        result(requestId, { status: 'drawn', frameCount: firstFrame.frameCount, timeMs: firstFrame.timeMs, firstFrame }, true);
      } else throw new Error('ZEN_ARTIFACT_WORKER_COMMAND_INVALID');
    },
    dispose,
  };
}
