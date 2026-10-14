let pixiWaterEffectsLayerFactoryPromise = null;
let cachedCreatePixiWaterEffectsLayer = null;

const requirePixiWaterEffectsLayerFactory = (factory) => {
  if (typeof factory !== 'function') {
    throw new Error('ZEN_PIXI_WATER_EFFECTS_LAYER_EXPORT_MISSING');
  }
  return factory;
};

export const admitPixiWaterEffectsLayerFactory = (factory) => {
  const admittedFactory = requirePixiWaterEffectsLayerFactory(factory);
  if (
    typeof cachedCreatePixiWaterEffectsLayer === 'function'
    && cachedCreatePixiWaterEffectsLayer !== admittedFactory
  ) {
    throw new Error('ZEN_PIXI_WATER_EFFECTS_LAYER_FACTORY_CONFLICT');
  }
  cachedCreatePixiWaterEffectsLayer = admittedFactory;
  pixiWaterEffectsLayerFactoryPromise = Promise.resolve(admittedFactory);
  return admittedFactory;
};

export const createNoopPixiWaterEffectsLayer = () => ({
  displayObjects: [],
  benthicObjects: [],
  refractedSurfaceObjects: [],
  cloudReflectionObjects: [],
  topShadowObjects: [],
  surfaceObjects: [],
  initMetrics: { totalMs: 0, skipped: true },
  getTopShadowProbe: () => null,
  getTemporalState: () => null,
  setTemporalState: () => {},
  tick: () => null,
  destroy: () => {},
});

export const loadPixiWaterEffectsLayerFactory = async () => {
  if (typeof cachedCreatePixiWaterEffectsLayer === 'function') {
    return cachedCreatePixiWaterEffectsLayer;
  }
  if (!pixiWaterEffectsLayerFactoryPromise) {
    pixiWaterEffectsLayerFactoryPromise = import('./pixiWaterEffectsLayer.js')
      .then((module) => {
        return admitPixiWaterEffectsLayerFactory(
          module?.createPixiWaterEffectsLayer,
        );
      })
      .catch((error) => {
        pixiWaterEffectsLayerFactoryPromise = null;
        throw error;
      });
  }
  return pixiWaterEffectsLayerFactoryPromise;
};
