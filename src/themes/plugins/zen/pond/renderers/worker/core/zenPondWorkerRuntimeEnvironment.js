import {
  ensurePixiWorkerCanvasEventSurface,
  requirePixiWorkerRuntimeEnvironment,
  resolveCanvasWebGLTextureCaps as resolveSharedCanvasWebGLTextureCaps,
  resolvePixiWorkerRendererDiagnostics,
} from '../../../../runtime/worker/zenPixiWorkerEnvironment.js';
import { WORKER_RENDERER_POLICY } from './zenPondWorkerPolicy.js';

export const ensureCanvasEventSurface = (canvas = null) => (
  ensurePixiWorkerCanvasEventSurface(canvas)
);

export const requireRuntimeEnvironment = () => {
  requirePixiWorkerRuntimeEnvironment();
};

export const resolveWorkerRendererDiagnostics = ({ runtimeState = null } = {}) => (
  resolvePixiWorkerRendererDiagnostics({
    runtimeState,
    strictWorkerOnly: WORKER_RENDERER_POLICY.strictWorkerOnly === true,
  })
);

export const resolveCanvasWebGLTextureCaps = (canvas = null) => (
  resolveSharedCanvasWebGLTextureCaps(canvas)
);
