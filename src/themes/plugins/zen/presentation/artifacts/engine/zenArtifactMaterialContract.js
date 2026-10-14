export const ZEN_ARTIFACT_SVG_SCENES = Object.freeze(['tome-ishi', 'furin', 'shishi-odoshi']);
export function releaseZenArtifactMaterials(layers) {
  for (const layer of layers) layer.bitmap.close();
}
