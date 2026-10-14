import { ZEN_FURIN_GEOMETRY as g } from '../../widgets/tools/recipes/zenFurinGeometry.js';
import { ZEN_FURIN_INK_GLYPHS } from './zenFurinInkGlyphs.js';

const SVG_NS = 'http://www.w3.org/2000/svg';
const clamp = value => Math.max(0, Math.min(1, value));
const GLYPH_SIZE = 24;
const GLYPH_SCALE = 0.82;
const ROW_PITCH = 21;
const TOP = 7;

export function createZenFurinInk(svg, { characters, reducedMotion = false } = {}) {
  if (typeof characters !== 'string' || Array.from(characters).length !== 4) {
    throw new Error('zen_furin_ink_characters_invalid');
  }
  const glyphs = Array.from(characters).map(character => {
    if (!Object.hasOwn(ZEN_FURIN_INK_GLYPHS, character)) {
      throw new Error(`zen_furin_ink_glyph_unsupported:${character}`);
    }
    return { character, strokes: ZEN_FURIN_INK_GLYPHS[character] };
  });
  const faces = ['front', 'back'].map(side => {
    const source = svg.querySelector(`[data-zen-furin-paper-face-source="${side}"]`);
    if (!source) throw new Error(`zen_furin_ink_face_missing:${side}`);
    return { side, source };
  });
  const strokeCount = glyphs.reduce((total, { strokes }) => total + strokes.length, 0);
  const sources = faces.map(({ side, source }) => {
    const group = svg.ownerDocument.createElementNS(SVG_NS, 'g');
    group.setAttribute('data-zen-furin-ink', side);
    group.setAttribute('data-zen-furin-ink-characters', characters);
    group.setAttribute('fill', 'none');
    group.setAttribute('stroke', '#49423a');
    group.setAttribute('stroke-linecap', 'round');
    group.setAttribute('stroke-linejoin', 'round');
    group.style.opacity = '0';
    if (side === 'back') group.setAttribute('transform', `translate(${g.paperWidth} 0) scale(-1 1)`);
    const paths = [];
    glyphs.forEach(({ character, strokes }, row) => {
      const glyphGroup = svg.ownerDocument.createElementNS(SVG_NS, 'g');
      const left = (g.paperWidth - GLYPH_SIZE * GLYPH_SCALE) / 2;
      glyphGroup.setAttribute('transform', `translate(${left} ${TOP + row * ROW_PITCH}) scale(${GLYPH_SCALE})`);
      glyphGroup.setAttribute('data-zen-furin-ink-glyph', character);
      strokes.forEach(([d, width]) => {
        const path = svg.ownerDocument.createElementNS(SVG_NS, 'path');
        path.setAttribute('d', d);
        path.setAttribute('stroke-width', String(width));
        path.setAttribute('pathLength', '1');
        path.setAttribute('stroke-dasharray', '1 1');
        path.setAttribute('stroke-dashoffset', '1');
        path.setAttribute('data-zen-furin-ink-stroke', String(paths.length));
        glyphGroup.appendChild(path);
        paths.push(path);
      });
      group.appendChild(glyphGroup);
    });
    // Both faces are existing defs consumed by every curved paper band. Ink
    // shares the leaf's flex, yaw and clipping instead of following it in text.
    source.insertBefore(group, source.lastElementChild);
    return { side, group, paths };
  });

  let previousProgress = null;
  return {
    render(progress) {
      const amount = clamp(progress);
      if (amount === previousProgress) return;
      previousProgress = amount;
      sources.forEach(({ side, group, paths }) => {
        const opacity = side === 'front' ? 0.92 : 0.25;
        group.style.opacity = amount > 0 ? String(reducedMotion ? opacity * amount : opacity) : '0';
        group.setAttribute('data-zen-furin-ink-progress', String(amount));
        paths.forEach((path, index) => {
          const stroke = reducedMotion ? 1 : clamp((amount * (strokeCount + 3) - index) / 4);
          path.style.opacity = String(Math.min(1, stroke * 4));
          path.setAttribute('stroke-dashoffset', String(1 - stroke));
        });
      });
    },
  };
}
