import { ZEN_FURIN_GEOMETRY as g } from './zenFurinGeometry.js';

// Both renderers sample this tied-top curve. Margins retain the baked shadow;
// body rows line up exactly with the SVG clips and the retained mesh vertices.
export const ZEN_FURIN_PAPER_BOUNDS = Object.freeze([-55, -30, 142, 190]);
export const ZEN_FURIN_PAPER_ROWS = Object.freeze([
  -30, ...Array.from({ length: 13 }, (_, index) => index * g.paperHeight / 12), 160,
]);

export function projectZenFurinPaperOffset(skew, y) {
  const t = y / g.paperHeight;
  const bend = Math.tan(skew * Math.PI / 180) * g.paperHeight;
  return bend * (t <= 0 ? 0 : t >= 1 ? 2 * t - 1 : t * t);
}

export function projectZenFurinPaperBand(skew, row) {
  const y0 = ZEN_FURIN_PAPER_ROWS[row], y1 = ZEN_FURIN_PAPER_ROWS[row + 1];
  const x0 = projectZenFurinPaperOffset(skew, y0);
  const slope = (projectZenFurinPaperOffset(skew, y1) - x0) / (y1 - y0);
  // Commas are valid in both CSS transforms and SVG transform attributes.
  return `matrix(1, 0, ${slope}, 1, ${x0 - slope * y0}, 0)`;
}
