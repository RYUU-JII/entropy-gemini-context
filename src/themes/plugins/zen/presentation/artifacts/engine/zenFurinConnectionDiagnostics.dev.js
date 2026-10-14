import { ZEN_FURIN_GEOMETRY as g } from '../../../widgets/tools/recipes/zenFurinGeometry.js';
import { buildZenFurinMaterialLayers } from './zenFurinMaterials.js';
import { rasterZenSvg } from './zenSvgRaster.jsx';

// Matrix continuity cannot prove that a stroke painted. Exercise the actual
// material compiler and browser rasterizer, retaining the shared paint defs.
export async function measureZenFurinCordPaint(descriptor) {
  const source = buildZenFurinMaterialLayers(descriptor).find(layer => layer.name === 'main').svg;
  const rows = {};
  for (const mode of ['canonical', 'objectBoundingBoxControl']) {
    const svg = source.cloneNode(false);
    svg.appendChild(source.querySelector('defs').cloneNode(true));
    const cord = source.querySelector('[data-zen-furin-upper-cord]').cloneNode(true);
    svg.appendChild(cord);
    if (mode === 'objectBoundingBoxControl') {
      const id = /^url\(#([^)]+)\)$/.exec(cord.getAttribute('stroke'))[1];
      svg.querySelector(`[id="${id}"]`).setAttribute('gradientUnits', 'objectBoundingBox');
    }
    const canvas = await rasterZenSvg(svg, [-2, 0, 4, g.bellTop], 2);
    const pixels = canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height).data;
    let paintedRows = 0;
    for (let y = 2; y < canvas.height - 2; y += 1) {
      if (Array.from({ length: canvas.width }, (_, x) => pixels[(y * canvas.width + x) * 4 + 3])
        .some(alpha => alpha > 32)) paintedRows += 1;
    }
    rows[mode] = { paintedRows, sampledRows: canvas.height - 4 };
  }
  if (rows.canonical.paintedRows < rows.canonical.sampledRows * 0.95
    || rows.objectBoundingBoxControl.paintedRows !== 0) {
    throw new Error(`ZEN_FURIN_CORD_PAINT_INVALID:${JSON.stringify(rows)}`);
  }
  return rows;
}

// QA-only observation of actual renderer matrices, not a second pose solver.
export function measureZenFurinConnections(svg) {
  const point = (selector, x, y) => {
    const node = svg.querySelector(selector);
    const matrix = svg.getScreenCTM().inverse().multiply(node.getScreenCTM());
    return new DOMPoint(x, y).matrixTransform(matrix);
  };
  const hanger = '[data-zen-furin-hanger-motion]';
  const striker = '[data-zen-furin-striker-motion]';
  const paper = '[data-zen-furin-paper-motion]';
  const leaf = '[data-zen-furin-paper-leaf-motion]';
  const gap = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
  const errors = {
    support: gap(point(hanger, 0, 0), { x: g.supportX, y: g.supportY }),
    supportTie: gap(point('[data-zen-furin-support]', 0, 0), point(hanger, 0, 0)),
    internalTie: gap(point(hanger, 0, g.strikerPivotY), point(striker, 0, 0)),
    clapperTie: gap(point(striker, 0, g.strikerLength), point(paper, 0, 0)),
    paperTie: gap(point(paper, 0, g.paperCordLength), point(leaf, g.paperWidth / 2, 0)),
    paperFlexTie: gap(point(leaf, g.paperWidth / 2, 0), point('[data-zen-furin-paper-band="1"]', g.paperWidth / 2, 0)),
  };
  if (Object.values(errors).some(error => !Number.isFinite(error) || error > 0.02)) {
    throw new Error(`ZEN_FURIN_ATTACHMENT_GAP:${JSON.stringify(errors)}`);
  }
  return errors;
}
