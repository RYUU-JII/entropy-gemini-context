import { ZEN_FURIN_GEOMETRY as g } from '../../../widgets/tools/recipes/zenFurinGeometry.js';
import { createZenFurinVector } from './zenFurinVector.js';
import { ZEN_FURIN_PAPER_BOUNDS } from '../../../widgets/tools/recipes/zenFurinPaper.js';
import { ZEN_FURIN_PAPER_SHADOW } from '../../../widgets/tools/recipes/zenFurinSceneRecipe.jsx';
import { zenSvgDocument, zenSvgLayer } from './zenSvgRaster.jsx';

export function buildZenFurinMaterialLayers({ color, mantra }) {
  // The gallery hangs Furin from the workspace lintel (ZenArtifactWorkspaceLintel).
  const source = zenSvgDocument(createZenFurinVector({ color, mantra, supportStyle: 'lintel' }), [0, 0, 300, 360]);
  const main = source.querySelector('[data-zen-furin-hanger-motion]');
  const strikerNode = main.querySelector('[data-zen-furin-striker-motion]');
  const paperNode = strikerNode.querySelector('[data-zen-furin-paper-motion]');
  const leaf = paperNode.querySelector('[data-zen-furin-paper-leaf-motion]');
  const front = zenSvgLayer(source, leaf.querySelector('[data-zen-furin-paper-face-source="front"]'));
  const back = zenSvgLayer(source, leaf.querySelector('[data-zen-furin-paper-face-source="back"]'));
  for (const face of [front, back]) {
    face.lastElementChild.setAttribute('style', `filter:${ZEN_FURIN_PAPER_SHADOW}`);
    const group = source.createElementNS('http://www.w3.org/2000/svg', 'g');
    group.setAttribute('style', 'filter:drop-shadow(0 12px 14px rgba(15,23,42,.28))');
    group.appendChild(face.lastElementChild); face.appendChild(group);
  }
  leaf.parentNode.remove();
  const paperCord = zenSvgLayer(source, paperNode);
  paperNode.parentNode.remove();
  const impactNode = main.querySelector('[data-zen-furin-impact-origin]');
  const pulseNode = impactNode.querySelector('circle');
  const pulseSource = zenSvgLayer(source, pulseNode);
  pulseSource.lastElementChild.setAttribute('style', 'filter:blur(0.5px)');
  impactNode.remove();
  const strikerSource = zenSvgLayer(source, strikerNode);
  strikerNode.parentNode.remove();
  const rimNode = main.querySelector('[data-zen-furin-front-rim]');
  const rimSource = zenSvgLayer(source, rimNode); rimNode.remove();
  const mainSource = zenSvgLayer(source, main);
  const koiNode = mainSource.querySelector('[data-zen-furin-koi-motion]');
  const koiSource = zenSvgLayer(source, koiNode);
  koiSource.lastElementChild.setAttribute('style', `color:${color}`);
  const koiPlacement = source.createElementNS('http://www.w3.org/2000/svg', 'g');
  koiPlacement.setAttribute('transform', `translate(${g.bellLeft + 17} ${g.bellTop + 16}) scale(.35)`);
  koiPlacement.appendChild(koiSource.lastElementChild); koiSource.appendChild(koiPlacement);
  koiNode.remove();
  const shimmerGroup = source.createElementNS('http://www.w3.org/2000/svg', 'g');
  shimmerGroup.setAttribute('transform', `translate(${g.bellLeft} ${g.bellTop})`);
  for (const node of [...mainSource.querySelectorAll('path, ellipse')].filter(n => n.style.opacity === '0')) {
    node.style.opacity = '1'; shimmerGroup.appendChild(node);
  }
  const shimmerSource = zenSvgLayer(source, shimmerGroup);
  source.querySelector('[data-zen-furin-hanger-coordinate-space]').remove();
  // Ambient glow is independent of the branch and the pendulum hierarchy.
  const glowNode = source.querySelector('[data-zen-furin-ambient-glow]');
  const glowSource = zenSvgLayer(source, glowNode);
  glowSource.lastElementChild.setAttribute('style', 'filter:blur(24px)');
  glowNode.remove();
  return [
    { name: 'glow', svg: glowSource, bounds: [g.supportX - 120, g.supportY + g.bellCenterY - 120, 240, 240] },
    { name: 'support', svg: source, bounds: [g.supportX - 100, g.supportY - 25, 200, 65] },
    { name: 'main', svg: mainSource, bounds: [-75, -25, 150, g.bellTop + 145] },
    { name: 'koi', svg: koiSource, bounds: [-30, g.bellTop + 8, 80, 40] },
    { name: 'shimmer', svg: shimmerSource, bounds: [-60, g.bellTop - 15, 120, 95] },
    { name: 'striker', svg: strikerSource, bounds: [-35, -20, 70, 165] },
    { name: 'cord', svg: paperCord, bounds: [-8, -6, 16, g.paperCordLength + 12] },
    { name: 'front', svg: front, bounds: ZEN_FURIN_PAPER_BOUNDS },
    { name: 'back', svg: back, bounds: ZEN_FURIN_PAPER_BOUNDS },
    { name: 'pulse', svg: pulseSource, bounds: [-30, -30, 60, 60] },
    { name: 'rim', svg: rimSource, bounds: [-35, g.bellRimY - 4, 70, 18] },
  ];
}
