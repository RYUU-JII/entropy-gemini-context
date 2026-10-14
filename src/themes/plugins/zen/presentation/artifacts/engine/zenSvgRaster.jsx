import { zenSvgDocument } from './zenSvgDocument.jsx';
export { zenSvgDocument, createZenSvgScope } from './zenSvgDocument.jsx';

// Preparation only: compile the canonical vector recipe, never a live DOM
// screenshot. No foreignObject, external images, timers, or per-frame uploads.
export async function rasterZenSvg(svg, bounds, resolution) {
  const element = svg.documentElement || svg;
  const clone = element.cloneNode(true);
  clone.setAttribute('width', bounds[2] * resolution);
  clone.setAttribute('height', bounds[3] * resolution);
  clone.setAttribute('viewBox', bounds.join(' '));
  const source = new XMLSerializer().serializeToString(clone);
  const url = URL.createObjectURL(new Blob([source], { type: 'image/svg+xml' }));
  try {
    const image = new Image();
    image.src = url;
    await image.decode();
    const canvas = document.createElement('canvas');
    canvas.width = Math.ceil(bounds[2] * resolution);
    canvas.height = Math.ceil(bounds[3] * resolution);
    const context = canvas.getContext('2d');
    if (!context) throw new Error('ZEN_ARTIFACT_SVG_CANVAS_UNAVAILABLE');
    context.drawImage(image, 0, 0);
    return canvas;
  } finally { URL.revokeObjectURL(url); }
}

// Extract a named local coordinate layer while retaining its canonical defs.
export function zenSvgLayer(document, node) {
  if (!node) throw new Error('ZEN_ARTIFACT_SVG_LAYER_MISSING');
  const svg = document.documentElement.cloneNode(false);
  const defs = document.querySelector('defs');
  if (defs) svg.appendChild(defs.cloneNode(true));
  svg.appendChild(node.cloneNode(true));
  return svg;
}

export function measureZenSvgBounds(svg) {
  const clone = document.importNode(svg, true);
  clone.style.position = 'absolute'; clone.style.left = '-10000px';
  clone.style.visibility = 'hidden'; clone.style.pointerEvents = 'none';
  document.body.appendChild(clone);
  try {
    const { x, y, width, height } = clone.getBBox();
    if (![x,y,width,height].every(Number.isFinite) || width <= 0 || height <= 0) throw new Error('ZEN_ARTIFACT_SVG_BOUNDS_INVALID');
    return { x, y, width, height };
  } finally { clone.remove(); }
}
