// Runtime grayscale is quantized to integer percent; cold prepaint uses the same surface.
// The registration owner registers only tiers admitted for protected hosts.
export const PREPAINT_VISUAL_STYLES = Object.freeze(Array.from({ length: 101 }, (_, percent) => {
  const grayscaleStrength = percent / 100;
  return Object.freeze({
    tierId: 'visual-' + percent,
    id: 'entropy-prepaint-visual-v2-' + percent,
    path: 'src/apps/content/prepaint/prepaint-visual-' + percent + '.css',
    grayscaleStrength,
    source: ':root:not([data-entropy-prepaint-suppressed="1"]) {\n  filter: grayscale(' + grayscaleStrength + ') !important;\n}\n',
  });
}));
