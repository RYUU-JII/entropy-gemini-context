import { getZenArtifactGalleryGeometry } from './zenArtifactGalleryGeometry.js';
import { ZEN_ARTIFACT_SVG_SCENES } from './zenArtifactMaterialContract.js';
export const loadZenArtifactGalleryClient = () => import('../../../runtime/worker/ZenArtifactGallerySession.js');

// UI intent only imports the client and, when needed, the canonical SVG compiler.
// Pixi and scene executors are loaded inside the admitted render Worker.
export async function preloadZenArtifactGalleryModules(visualKey = null) {
  const id = visualKey === null ? null : getZenArtifactGalleryGeometry(visualKey).id;
  await Promise.all([loadZenArtifactGalleryClient(),
    ...(ZEN_ARTIFACT_SVG_SCENES.includes(id) ? [import('./zenSvgMaterialCompiler.js')] : [])]);
}
