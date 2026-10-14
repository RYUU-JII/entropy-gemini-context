const SCENE_LOADERS = Object.freeze({
  shoji: () => import('./zenShojiScene.js').then(({ createZenShojiScene }) => createZenShojiScene),
  'great-wave': () => import('./zenGreatWaveScene.js').then(({ createZenGreatWaveScene }) => createZenGreatWaveScene),
  enso: () => import('./zenEnsoScene.js').then(({ createZenEnsoScene }) => createZenEnsoScene),
  'tome-ishi': () => import('./zenTomeIshiScene.js').then(({ createZenTomeIshiScene }) => createZenTomeIshiScene),
  ishidouro: () => import('./zenIshidouroScene.js').then(({ createZenIshidouroScene }) => createZenIshidouroScene),
  furin: () => import('./zenFurinScene.js').then(({ createZenFurinScene }) => createZenFurinScene),
  'shishi-odoshi': () => import('./zenShishiOdoshiScene.js').then(({ createZenShishiOdoshiScene }) => createZenShishiOdoshiScene),
});

// Resolve only the requested construction capability. Returning a namespace
// would make unrelated reference exports observable to the production Worker.
export function loadZenArtifactSceneFactory(id) {
  if (!Object.hasOwn(SCENE_LOADERS, id)) throw new Error('ZEN_ARTIFACT_SCENE_UNKNOWN');
  return SCENE_LOADERS[id]();
}

