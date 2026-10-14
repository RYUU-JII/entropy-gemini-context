import { ARTIFACT_STAGE_SIZE } from '@/themes/core/tools/artifactStageGeometry.js';
import { ARTIFACT_FIXED_RENDER_BUDGET } from '@/themes/core/tools/artifactMotionBudget.js';
import { resolveRenderResolution } from '@/platform/rendering/renderBudgetContract.js';

export const ZEN_ARTIFACT_GALLERY_CANVAS = Object.freeze({ width: 640, height: 960 });
export const resolveZenArtifactGalleryResolution = devicePixelRatio => resolveRenderResolution({
  cssWidth: ZEN_ARTIFACT_GALLERY_CANVAS.width, cssHeight: ZEN_ARTIFACT_GALLERY_CANVAS.height,
  devicePixelRatio, renderBudget: ARTIFACT_FIXED_RENDER_BUDGET,
});
const canvasTop = -ARTIFACT_STAGE_SIZE.height;
export const ZEN_ARTIFACT_GALLERY_CANVAS_STYLE = Object.freeze({
  position: 'absolute', left: (ARTIFACT_STAGE_SIZE.width - ZEN_ARTIFACT_GALLERY_CANVAS.width) / 2,
  top: canvasTop, ...ZEN_ARTIFACT_GALLERY_CANVAS, pointerEvents: 'none',
});
// The stage's bottom centre, in canvas pixels. The stage is anchored there on
// the karesansui centre (scene spec `artifact_origin`).
const GROUND_POINT = Object.freeze({
  x: ZEN_ARTIFACT_GALLERY_CANVAS.width / 2,
  y: ARTIFACT_STAGE_SIZE.height - canvasTop,
});

// `ground` is the point in each scene's local space (relative to its root)
// that rests on the karesansui centre:
// - standing objects: where the body meets the sand, on its visual axis
//   (Tome-ishi's contact shadow, the lantern's plinth, the shishi-odoshi's
//   stand, whose floor line also carries its rock and water impact);
// - floating objects: the sand point directly below them, so `ground.y` is
//   the body's lower edge plus the height it hovers at.
// The scene root is placed so that this point lands on the stage's bottom
// centre; nothing else offsets a Zen artifact.
//
// `lintelY` (optional) is the scene-local height of a support the scene hangs
// from but does not draw: a lintel spanning the workspace, painted by
// ZenArtifactWorkspaceLintel outside the canvas. Furin hangs from it on its
// own short cord, so the bell keeps its pendulum, and it is raised clear of
// the karesansui so it reads as its own place rather than a ring ornament.
const FURIN_SUPPORT_LOCAL_Y = -230; // scene stage offset (-250) + supportY (20)
const scenes = Object.freeze(Object.fromEntries([
  ['lens', 'shoji', { x: 0, y: 175 }],
  ['veil', 'enso', { x: 0, y: 184 }],
  ['brake', 'tome-ishi', { x: 0, y: 112 }],
  ['monolith', 'ishidouro', { x: 0, y: 173 }],
  ['sentinelFlare', 'furin', { x: 0, y: 181 }, FURIN_SUPPORT_LOCAL_Y],
  ['gate', 'shishi-odoshi', { x: 11, y: 138 }],
  ['lethe', 'great-wave', { x: 0, y: 155 }],
].map(([visualKey, id, ground, lintelY = null]) => [visualKey, Object.freeze({
  id,
  ground: Object.freeze(ground),
  origin: Object.freeze({ x: GROUND_POINT.x - ground.x, y: GROUND_POINT.y - ground.y }),
  // Relative to the stage's bottom centre (the karesansui centre on screen).
  lintelOffsetY: lintelY === null ? null : lintelY - ground.y,
})])));

export function getZenArtifactGalleryGeometry(visualKey) {
  if (!Object.hasOwn(scenes, visualKey)) throw new Error('ZEN_ARTIFACT_GALLERY_SCENE_UNKNOWN');
  return scenes[visualKey];
}
