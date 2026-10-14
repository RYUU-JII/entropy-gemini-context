// Glass edge material. The scene skeleton remains the aperture owner.
const unit = (value) => Math.max(0, Math.min(1, value));

function grain(value) {
  const n = Math.sin(value * 12.9898 + 78.233) * 43758.5453;
  return n - Math.floor(n);
}

export function strokeGlobalSentinelGlassCrack(ctx, points, {
  alpha = 1,
  baseWidth = 2,
  taper = true,
  maxStepsPerSegment = 40,
} = {}) {
  if (points.length < 2 || alpha <= 0) return;
  const vertices = [];
  for (const point of points) {
    const previous = vertices.at(-1);
    if (!previous || Math.hypot(point[0] - previous[0], point[1] - previous[1]) >= 0.1) vertices.push(point);
  }
  if (vertices.length < 2) return;
  const segments = vertices.slice(1).map((point, index) => {
    const from = vertices[index];
    const dx = point[0] - from[0], dy = point[1] - from[1];
    const length = Math.hypot(dx, dy);
    return { from, dx, dy, length, nx: -dy / length, ny: dx / length };
  });
  const upper = [], lower = [], shadowFace = [], details = [];
  const key = vertices[0][0] * 0.07 + vertices[0][1] * 0.13;
  const faceWidth = Math.max(0.24, Math.min(1.05, baseWidth * 0.46));
  const sampleLimit = Math.max(0, Math.floor(maxStepsPerSegment) - 1);
  let travelled = 0;
  for (let segment = 0; segment < segments.length; segment += 1) {
    const edge = segments[segment];
    const segmentStart = travelled;
    const start = upper.length - (segment > 0 ? 1 : 0);
    const incidence = -edge.nx * 0.6 - edge.ny * 0.8;
    const materialAt = distance => {
      // Fixed distance samples, including the unfinished final interval, keep
      // exposed glass invariant when the visible prefix grows. Past the detail
      // allowance the edge stays straight rather than resampling the whole ray.
      const sample = Math.min(sampleLimit, distance / 16);
      const lo = Math.floor(sample), hi = Math.min(sampleLimit, lo + 1);
      const widthAt = index => {
        const absoluteDistance = segmentStart + index * 16;
        const grainKey = key + absoluteDistance * 0.09;
        const attenuation = taper ? 0.32 + 0.68 * Math.exp(-absoluteDistance / 120) : 1;
        return faceWidth * (0.62 + grain(grainKey) * 0.38) * attenuation;
      };
      return widthAt(lo) + (widthAt(hi) - widthAt(lo)) * (sample - lo);
    };
    const distances = [];
    if (segment === 0) distances.push(0);
    for (let step = 1; step <= sampleLimit && step * 16 < edge.length; step += 1) distances.push(step * 16);
    distances.push(edge.length);
    for (const distance of distances) {
      const t = distance / edge.length, width = materialAt(distance);
      const x = edge.from[0] + edge.dx * t, y = edge.from[1] + edge.dy * t;
      // Local bevel joins never depend on an unrevealed successor segment.
      upper.push([x + edge.nx * width, y + edge.ny * width]);
      lower.push([x - edge.nx * width, y - edge.ny * width]);
      shadowFace.push(incidence >= 0 ? lower.at(-1) : upper.at(-1));
    }
    details.push({ ...edge, start, end: upper.length - 1, key: key + travelled * 0.09, incidence, materialAt });
    travelled += edge.length;
  }
  ctx.save();
  ctx.shadowBlur = 0;
  ctx.lineCap = 'butt';
  ctx.lineJoin = 'bevel';
  ctx.globalAlpha = unit(alpha) * 0.88;
  ctx.strokeStyle = '#30343a';
  ctx.lineWidth = Math.max(0.58, Math.min(1.15, baseWidth * 0.38));
  ctx.beginPath();
  vertices.forEach(([x, y], index) => {
    if (index === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  });
  ctx.stroke();
  // A continuous dark cut face sits opposite the fixed top-left reflection.
  // It closes on the exact fracture, not a translated copy of the full path.
  ctx.beginPath();
  ctx.moveTo(...vertices[0]);
  for (const point of shadowFace) ctx.lineTo(...point);
  ctx.lineTo(...vertices.at(-1));
  for (let i = vertices.length - 2; i >= 0; i -= 1) ctx.lineTo(...vertices[i]);
  ctx.closePath();
  ctx.globalAlpha = unit(alpha) * 0.68;
  ctx.fillStyle = '#282d33';
  ctx.fill();

  for (const edge of details) {
    // A one-sample allowance owns only the attached structural face/core.
    // Reflection and chips are decoration, not an alternative fracture path.
    if (sampleLimit === 0) break;
    const incidence = edge.incidence;
    const lit = incidence >= 0 ? upper : lower;
    const light = Math.abs(incidence);
    ctx.globalAlpha = unit(alpha) * (0.56 + light * 0.36);
    ctx.lineWidth = Math.max(0.42, Math.min(0.8, baseWidth * 0.22));
    ctx.strokeStyle = '#f7f8fa';
    ctx.beginPath();
    let hasReflection = false;
    for (let i = edge.start; i < edge.end; i += 1) {
      if (grain(key + i * 19) < 0.22) continue;
      ctx.moveTo(...lit[i]);
      ctx.lineTo(...lit[i + 1]);
      hasReflection = true;
    }
    if (hasReflection) ctx.stroke();
    // One small, irregular conchoidal reflection stays attached to this face;
    // it is glass detail rather than a repeated triangular decoration.
    const chipDistance = 24 + grain(edge.key + 53) * 48;
    const chipLength = 2.4 + grain(edge.key + 61) * 2;
    if (baseWidth > 1.3 && edge.length > chipDistance + chipLength && grain(edge.key + 47) > 0.28) {
      const sign = incidence >= 0 ? 1 : -1;
      const nx = edge.nx * sign, ny = edge.ny * sign;
      const tx = edge.dx / edge.length, ty = edge.dy / edge.length;
      const chipWidth = edge.materialAt(chipDistance);
      const p = [edge.from[0] + tx * chipDistance + nx * chipWidth,
        edge.from[1] + ty * chipDistance + ny * chipWidth];
      const q = [p[0] + tx * chipLength, p[1] + ty * chipLength];
      const reach = Math.min(1.1, chipWidth * (0.7 + grain(edge.key + 59) * 0.5));
      ctx.fillStyle = '#e9ebee';
      ctx.globalAlpha = unit(alpha) * (0.3 + light * 0.26);
      ctx.beginPath();
      ctx.moveTo(...p);
      ctx.lineTo(...q);
      ctx.lineTo(q[0] - tx * chipLength * 0.24 + nx * reach * 0.58,
        q[1] - ty * chipLength * 0.24 + ny * reach * 0.58);
      ctx.lineTo(p[0] + tx * chipLength * 0.36 + nx * reach,
        p[1] + ty * chipLength * 0.36 + ny * reach);
      ctx.lineTo(p[0] + tx * chipLength * 0.08 + nx * reach * 0.34,
        p[1] + ty * chipLength * 0.08 + ny * reach * 0.34);
      ctx.closePath();
      ctx.fill();
    }
  }
  ctx.restore();
}

