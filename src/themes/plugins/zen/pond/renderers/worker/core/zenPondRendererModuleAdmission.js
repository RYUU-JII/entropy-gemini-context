import {
  admitPixiWaterEffectsLayerFactory,
} from '../../pixi/pixiWaterEffectsLayerLoader.js';
import {
  getZenPondStaticBenthicAssetSnapshot,
  prepareZenPondStaticBenthicAssets,
} from '../../pixi/visualProfiles/zenPondStaticBenthicAssets.js';

const roundMs = (value) => (
  Number.isFinite(Number(value))
    ? Math.round(Number(value) * 10) / 10
    : null
);

const requireSceneRenderer = (module) => {
  if (typeof module?.mountZenPixiSceneRenderer !== 'function') {
    throw new Error('ZEN_POND_WORKER_RENDERER_EXPORT_MISSING');
  }
  return module.mountZenPixiSceneRenderer;
};

const requireWaterEffectsLayer = (module) => {
  if (typeof module?.createPixiWaterEffectsLayer !== 'function') {
    throw new Error('ZEN_PIXI_WATER_EFFECTS_LAYER_EXPORT_MISSING');
  }
  return module.createPixiWaterEffectsLayer;
};

const normalizeAdmissionError = (error) => {
  const message = error instanceof Error ? error.message : String(error);
  const normalized = new Error(`ZEN_POND_RENDERER_MODULE_ADMISSION_FAILED:${message}`);
  normalized.cause = error;
  return normalized;
};

export const createZenPondRendererModuleAdmission = ({
  loadSceneModule = () => import('../../pixi/ZenPixiSceneRenderer.js'),
  loadWaterModule = () => import('../../pixi/pixiWaterEffectsLayer.js'),
  admitWaterEffectsLayerFactory = admitPixiWaterEffectsLayerFactory,
  prepareStaticBenthicAssets = prepareZenPondStaticBenthicAssets,
  readStaticBenthicAssetSnapshot = getZenPondStaticBenthicAssetSnapshot,
  readNowMs = () => globalThis.performance.now(),
} = {}) => {
  let state = 'idle';
  let startedAtMs = null;
  let settledAtMs = null;
  let terminalPromise = null;
  let sceneRendererRequested = false;
  let waterEffectsRequested = false;
  let sceneModuleStartedAtMs = null;
  let sceneModuleSettledAtMs = null;
  let waterModuleStartedAtMs = null;
  let waterModuleSettledAtMs = null;
  let waterFactoryAdmittedAtMs = null;
  let staticBenthicAssetsRequested = false;

  const readTimestamp = () => Number(readNowMs());
  const durationBetween = (start, end) => (
    start !== null
    && end !== null
    && Number.isFinite(Number(start))
    && Number.isFinite(Number(end))
      ? roundMs(Number(end) - Number(start))
      : null
  );

  const prepare = () => {
    if (terminalPromise) return terminalPromise;

    state = 'loading';
    startedAtMs = readTimestamp();
    sceneRendererRequested = true;
    waterEffectsRequested = true;
    sceneModuleStartedAtMs = readTimestamp();
    const sceneModulePromise = Promise.resolve()
      .then(loadSceneModule)
      .then(
        (sceneModule) => {
          sceneModuleSettledAtMs = readTimestamp();
          return sceneModule;
        },
        (error) => {
          sceneModuleSettledAtMs = readTimestamp();
          throw error;
        },
      );
    waterModuleStartedAtMs = readTimestamp();
    const waterModulePromise = Promise.resolve()
      .then(loadWaterModule)
      .then((waterModule) => {
        waterModuleSettledAtMs = readTimestamp();
        const factory = requireWaterEffectsLayer(waterModule);
        const admittedFactory = admitWaterEffectsLayerFactory(factory);
        waterFactoryAdmittedAtMs = readTimestamp();
        return admittedFactory;
      }, (error) => {
        waterModuleSettledAtMs = readTimestamp();
        throw error;
      });
    staticBenthicAssetsRequested = true;
    const staticBenthicAssetsPromise = Promise.resolve()
      .then(prepareStaticBenthicAssets);
    terminalPromise = Promise.all([
      sceneModulePromise,
      waterModulePromise,
      staticBenthicAssetsPromise,
    ]).then(([sceneModule]) => {
      const mountZenPixiSceneRenderer = requireSceneRenderer(sceneModule);
      settledAtMs = readTimestamp();
      state = 'ready';
      return Object.freeze({ mountZenPixiSceneRenderer });
    }).catch((error) => {
      settledAtMs = readTimestamp();
      state = 'failed';
      throw normalizeAdmissionError(error);
    });
    return terminalPromise;
  };

  return Object.freeze({
    prepare,
    loadSceneRenderer: async () => {
      const admitted = await prepare();
      return admitted.mountZenPixiSceneRenderer;
    },
    getSnapshot: () => {
      const hasStart = startedAtMs !== null;
      const hasSettlement = settledAtMs !== null;
      const start = hasStart ? Number(startedAtMs) : Number.NaN;
      const settlement = hasSettlement ? Number(settledAtMs) : Number.NaN;
      return Object.freeze({
        state,
        startedAtMs: Number.isFinite(start) ? roundMs(start) : null,
        settledAtMs: Number.isFinite(settlement) ? roundMs(settlement) : null,
        durationMs: Number.isFinite(start) && Number.isFinite(settlement)
          ? roundMs(settlement - start)
          : null,
        sceneModuleDurationMs: durationBetween(
          sceneModuleStartedAtMs,
          sceneModuleSettledAtMs,
        ),
        waterModuleDurationMs: durationBetween(
          waterModuleStartedAtMs,
          waterModuleSettledAtMs,
        ),
        waterFactoryAdmissionDurationMs: durationBetween(
          waterModuleSettledAtMs,
          waterFactoryAdmittedAtMs,
        ),
        staticBenthicAssetsRequested,
        staticBenthicAssets: readStaticBenthicAssetSnapshot(),
        sceneRendererRequested,
        waterEffectsRequested,
      });
    },
  });
};

export const zenPondRendererModuleAdmission = createZenPondRendererModuleAdmission();
