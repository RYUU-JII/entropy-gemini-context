import { chromium } from 'playwright';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

const SIZES = [16, 48, 128];

// Color: warm rose that reads on both light and dark toolbars
const INK = { r: 200, g: 96, b: 122 };

function buildIconHTML(size) {
  const { r, g, b } = INK;
  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<style>* { margin: 0; padding: 0; } body { width: ${size}px; height: ${size}px; overflow: hidden; background: transparent; }</style>
</head>
<body>
<canvas id="c" width="${size}" height="${size}"></canvas>
<script>
(function () {
  const TAU = Math.PI * 2;
  const sz = ${size};
  const r = ${r}, g = ${g}, b = ${b};

  function deg(d) { return d * Math.PI / 180; }
  function lerp(a, b, t) { return a + (b - a) * t; }
  function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }
  function smoothstep(e0, e1, x) {
    const t = clamp((x - e0) / (e1 - e0), 0, 1);
    return t * t * (3 - 2 * t);
  }

  const cx = sz * 0.5;
  const cy = sz * 0.5;
  const outerR = sz * 0.46;
  const maxWidth = sz * 0.27;
  const tailWidth = maxWidth * 0.40;   // tail is 40% of head — snail shell connect
  const startAngle = deg(122);
  const sweep = deg(370);              // 10° overlap so tail tucks under head
  const count = 360;

  // Width profile: ramp 0→max, hold, taper max→tail
  function getWidth(t) {
    if (t < 0.065) return lerp(0, maxWidth, t / 0.065);
    if (t < 0.72)  return maxWidth;
    return lerp(maxWidth, tailWidth, (t - 0.72) / 0.28);
  }

  const outerPts = [];
  const innerPts = [];

  for (let i = 0; i < count; i++) {
    const t = i / (count - 1);
    const angle = startAngle + sweep * t;
    const w = getWidth(t);
    outerPts.push({ x: cx + Math.cos(angle) * outerR, y: cy + Math.sin(angle) * outerR });
    innerPts.push({ x: cx + Math.cos(angle) * (outerR - w), y: cy + Math.sin(angle) * (outerR - w) });
  }

  const canvas = document.getElementById('c');
  const ctx = canvas.getContext('2d');

  function drawShape(alpha) {
    // Draw tail first (lower z), then head on top for snail-shell layering
    // Tail region: last 30% of sweep (the 40%-width section)
    const tailStart = Math.floor(count * 0.70);

    // Tail layer (slightly transparent so head reads over it)
    ctx.beginPath();
    ctx.moveTo(outerPts[tailStart].x, outerPts[tailStart].y);
    for (let i = tailStart + 1; i < outerPts.length; i++) ctx.lineTo(outerPts[i].x, outerPts[i].y);
    for (let i = innerPts.length - 1; i >= tailStart; i--) ctx.lineTo(innerPts[i].x, innerPts[i].y);
    ctx.closePath();
    ctx.fillStyle = 'rgba(' + r + ',' + g + ',' + b + ',' + (alpha * 0.82) + ')';
    ctx.fill();

    // Main head+body (full stroke, head covers tail overlap)
    ctx.beginPath();
    ctx.moveTo(outerPts[0].x, outerPts[0].y);
    for (let i = 1; i <= tailStart; i++) ctx.lineTo(outerPts[i].x, outerPts[i].y);
    for (let i = tailStart; i >= 0; i--) ctx.lineTo(innerPts[i].x, innerPts[i].y);
    ctx.closePath();
    ctx.fillStyle = 'rgba(' + r + ',' + g + ',' + b + ',' + alpha + ')';
    ctx.fill();
  }

  // Shadow pass
  ctx.save();
  ctx.shadowBlur = sz * 0.04;
  ctx.shadowColor = 'rgba(' + r + ',' + g + ',' + b + ',0.35)';
  drawShape(0.15);
  ctx.restore();

  // Main pass
  drawShape(0.93);

  window._iconDone = true;
})();
</script>
</body>
</html>`;
}

const browser = await chromium.launch();

for (const size of SIZES) {
  const page = await browser.newPage();
  await page.setViewportSize({ width: size, height: size });
  await page.setContent(buildIconHTML(size));
  await page.waitForFunction(() => window._iconDone === true);

  const outputPath = join(__dirname, `../public/icons/icon${size}.png`);
  await page.screenshot({
    path: outputPath,
    clip: { x: 0, y: 0, width: size, height: size },
    omitBackground: true,
  });
  await page.close();
  console.log(`✓ icon${size}.png`);
}

await browser.close();
