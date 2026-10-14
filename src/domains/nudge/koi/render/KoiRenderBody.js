import {
  clamp as clampValue,
  resolveHeadwardAngleFromHistory,
  traceKoiBodyContourPath,
} from '../../../../themes/plugins/zen/api/koi.js';
import { createKoiBodyPath, getKoiBodyRadius } from './KoiRenderGeometry.js';
import { drawKoiTailFin } from './KoiRenderFins.js';
import { drawKoiDorsalFin, drawKoiPattern } from './KoiRenderDecorations.js';

function hasRenderablePath(path) {
  return !!path && typeof path === 'object';
}

function normalizeBodyGeometry(pathOrGeometry, leftPoints = null, rightPoints = null) {
  if (pathOrGeometry && typeof pathOrGeometry === 'object' && Array.isArray(pathOrGeometry.leftPoints)) {
    return pathOrGeometry;
  }
  return {
    path: pathOrGeometry,
    leftPoints,
    rightPoints,
  };
}

function withBodyGeometryPath(ctx, bodyGeometry, callback) {
  if (!ctx || typeof callback !== 'function') return;
  if (hasRenderablePath(bodyGeometry?.path)) {
    callback(bodyGeometry.path, true);
    return;
  }
  ctx.beginPath();
  traceKoiBodyContourPath(ctx, bodyGeometry);
  callback(null, false);
}

function lerpPoint(left, right, amount) {
  const t = clampValue(amount, 0, 1);
  return {
    x: left.x + (right.x - left.x) * t,
    y: left.y + (right.y - left.y) * t,
  };
}

function drawShadowVoidCracks(adapter, ctx, size, bodyGeometry, renderPolicy = null) {
  const crackColor = typeof renderPolicy?.shadowCrackColor === 'string'
    ? renderPolicy.shadowCrackColor.trim()
    : '';
  const leftPoints = Array.isArray(bodyGeometry?.leftPoints) ? bodyGeometry.leftPoints : [];
  const rightPoints = Array.isArray(bodyGeometry?.rightPoints) ? bodyGeometry.rightPoints : [];
  const pointCount = Math.min(leftPoints.length, rightPoints.length);
  if (!crackColor || pointCount < 8) return;

  const ratios = [0.22, 0.36, 0.53, 0.69];
  const uid = Number(adapter?.uid) || 0;
  const lineWidthScale = clampValue(
    Number(renderPolicy?.shadowCrackLineWidthScale),
    0.004,
    0.024,
  );

  ctx.save();
  withBodyGeometryPath(ctx, bodyGeometry, (pathHandle, hasPath) => {
    if (hasPath) ctx.clip(pathHandle);
    else ctx.clip();
  });
  ctx.strokeStyle = crackColor;
  ctx.lineWidth = Math.max(0.45, size * lineWidthScale);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.shadowBlur = 0;

  for (let i = 0; i < ratios.length; i += 1) {
    const index = Math.max(1, Math.min(pointCount - 2, Math.round((pointCount - 1) * ratios[i])));
    const left = leftPoints[index];
    const right = rightPoints[index];
    if (!left || !right) continue;

    const side = ((uid + i) % 2) === 0 ? -1 : 1;
    const startT = side < 0 ? 0.42 : 0.58;
    const endT = side < 0 ? 0.12 : 0.88;
    const start = lerpPoint(left, right, startT);
    const end = lerpPoint(left, right, endT);
    const mid = lerpPoint(left, right, (startT + endT) * 0.5);
    const kink = ((uid % 7) - 3) * 0.035;

    ctx.beginPath();
    ctx.moveTo(start.x, start.y);
    ctx.lineTo(
      mid.x + (right.y - left.y) * kink,
      mid.y - (right.x - left.x) * kink,
    );
    ctx.lineTo(end.x, end.y);
    ctx.stroke();
  }

  ctx.restore();
}

export function drawKoiBodyShape(adapter, ctx, size, isShadow, eyeFB, eyeSP, bodyGeometry = null, envState = null) {
  const renderPolicy = envState?.renderPolicy && typeof envState.renderPolicy === 'object'
    ? envState.renderPolicy
    : null;
  const includeTail = renderPolicy?.passes?.tail !== false;
  if (includeTail) {
    drawKoiTailFin(adapter, ctx, adapter.tailPos, size, isShadow, renderPolicy);
  }

  const { path, leftPoints, rightPoints } = bodyGeometry || createKoiBodyPath(adapter, null, size, true);

  if (isShadow) {
    if (renderPolicy?.passes?.body === false) return;
    const alphaRaw = Number(renderPolicy?.shadowBodyAlpha ?? adapter.shadowBodyAlpha);
    const alpha = Number.isFinite(alphaRaw)
      ? Math.max(0.05, Math.min(1, alphaRaw))
      : 0.1;
    ctx.fillStyle = `rgba(0, 0, 0, ${alpha})`;
    withBodyGeometryPath(ctx, bodyGeometry, (pathHandle, hasPath) => {
      if (hasPath) ctx.fill(pathHandle);
      else ctx.fill();
    });
    drawShadowVoidCracks(adapter, ctx, size, bodyGeometry, renderPolicy);

    const outlineColorRaw = renderPolicy?.shadowOutlineColor ?? adapter.shadowOutlineColor;
    const outlineColor = typeof outlineColorRaw === 'string' ? outlineColorRaw.trim() : '';
    const outlineWidthScale = clampValue(
      Number(renderPolicy?.shadowOutlineWidthScale ?? adapter.shadowOutlineWidthScale),
      0.008,
      0.08,
    );
    if (outlineColor) {
      ctx.save();
      ctx.strokeStyle = outlineColor;
      ctx.lineJoin = 'round';
      ctx.lineCap = 'round';
      ctx.lineWidth = Math.max(0.7, size * outlineWidthScale);
      ctx.shadowColor = outlineColor;
      ctx.shadowBlur = Math.max(0.6, size * 0.08);
      withBodyGeometryPath(ctx, bodyGeometry, (pathHandle, hasPath) => {
        if (hasPath) ctx.stroke(pathHandle);
        else ctx.stroke();
      });
      ctx.restore();
    }
    return;
  }

  const head = adapter.history[0];
  const gradient = ctx.createLinearGradient(head.x, head.y, adapter.tailPos.x, adapter.tailPos.y);
  gradient.addColorStop(0, adapter.mixColor(adapter.colorBody, '#FFFFFF', 0.2));
  gradient.addColorStop(0.3, adapter.colorBody);
  gradient.addColorStop(1, adapter.mixColor(adapter.colorBody, '#000000', 0.1));
  ctx.fillStyle = gradient;
  withBodyGeometryPath(ctx, bodyGeometry, (pathHandle, hasPath) => {
    if (hasPath) ctx.fill(pathHandle);
    else ctx.fill();
  });

  ctx.save();
  withBodyGeometryPath(ctx, bodyGeometry, (pathHandle, hasPath) => {
    if (hasPath) ctx.clip(pathHandle);
    else ctx.clip();
  });
  drawKoiPattern(adapter, ctx, size);
  ctx.restore();

  drawKoiBodyDirectionalShade(adapter, ctx, size, bodyGeometry, leftPoints, rightPoints, envState);
  drawKoiDorsalFin(adapter, ctx, size);

  ctx.save();
  const peduncleIdx = Math.max(0, adapter.history.length - 3);
  const peduncle = adapter.history[peduncleIdx];
  if (peduncle) {
    const peduncleAngle = resolveHeadwardAngleFromHistory(adapter.history, peduncleIdx, peduncle.angle);
    ctx.strokeStyle = 'rgba(0,0,0,0.1)';
    ctx.lineWidth = size * 0.03;
    ctx.beginPath();
    const pr = getKoiBodyRadius(adapter, peduncleIdx / adapter.history.length, size) * 0.9;
    const px = Math.cos(peduncleAngle - Math.PI / 2);
    const py = Math.sin(peduncleAngle - Math.PI / 2);
    const fx = Math.cos(peduncleAngle);
    const fy = Math.sin(peduncleAngle);
    ctx.moveTo(peduncle.x + px * pr, peduncle.y + py * pr);
    ctx.quadraticCurveTo(
      peduncle.x + fx * size * 0.2,
      peduncle.y + fy * size * 0.2,
      peduncle.x - px * pr,
      peduncle.y - py * pr,
    );
    ctx.stroke();
  }

  const neckIdx = Math.min(7, adapter.history.length - 1);
  const neck = adapter.history[neckIdx];
  if (neck) {
    const neckAngle = resolveHeadwardAngleFromHistory(adapter.history, neckIdx, neck.angle);
    ctx.strokeStyle = 'rgba(0,0,0,0.1)';
    ctx.lineWidth = size * 0.05;
    ctx.beginPath();
    const nr = getKoiBodyRadius(adapter, neckIdx / adapter.history.length, size);
    const nx = Math.cos(neckAngle);
    const ny = Math.sin(neckAngle);
    const sx = Math.cos(neckAngle - Math.PI / 2);
    const sy = Math.sin(neckAngle - Math.PI / 2);

    ctx.moveTo(neck.x + sx * nr, neck.y + sy * nr);

    const depth = size * 0.5;
    const spread = nr * 0.3;

    const cp1x = neck.x + sx * spread + nx * depth;
    const cp1y = neck.y + sy * spread + ny * depth;
    const cp2x = neck.x - sx * spread + nx * depth;
    const cp2y = neck.y - sy * spread + ny * depth;

    ctx.bezierCurveTo(cp1x, cp1y, cp2x, cp2y, neck.x - sx * nr, neck.y - sy * nr);
    ctx.stroke();
  }
  ctx.restore();

  drawKoiEyeSimple(adapter, ctx, size, eyeFB, eyeSP);
}

export function drawKoiBodyDirectionalShade(adapter, ctx, size, pathOrGeometry, leftPoints, rightPoints, envState = null) {
  const bodyGeometry = normalizeBodyGeometry(pathOrGeometry, leftPoints, rightPoints);
  const history = adapter.history;
  if (!Array.isArray(history) || history.length < 3) return;
  if (!Array.isArray(bodyGeometry.leftPoints) || !Array.isArray(bodyGeometry.rightPoints)) return;

  const midIdx = Math.max(1, Math.min(history.length - 2, Math.floor(history.length * 0.34)));
  const center = history[midIdx];
  const left = bodyGeometry.leftPoints[midIdx] || bodyGeometry.leftPoints[0];
  const right = bodyGeometry.rightPoints[midIdx] || bodyGeometry.rightPoints[0];
  if (!center || !left || !right) return;
  const centerAngle = resolveHeadwardAngleFromHistory(history, midIdx, center.angle);

  let nx = left.x - right.x;
  let ny = left.y - right.y;
  const width = Math.hypot(nx, ny);
  if (width < 1e-3) return;
  nx /= width;
  ny /= width;

  const rawSunAngle = Number(envState?.sunAngle);
  const sunAngle = Number.isFinite(rawSunAngle)
    ? rawSunAngle
    : (centerAngle - Math.PI * 0.75);
  const lightX = Math.cos(sunAngle);
  const lightY = Math.sin(sunAngle);
  if (nx * lightX + ny * lightY < 0) {
    nx *= -1;
    ny *= -1;
  }

  const rawLightIntensity = Number(envState?.lightIntensity);
  const daylight = Math.max(0, Math.min(1,
    Number.isFinite(rawLightIntensity) ? (rawLightIntensity - 0.2) / 1.25 : 0.65,
  ));
  const shadowAlpha = Math.max(0.07, Math.min(0.14, 0.13 - daylight * 0.05));
  const midAlpha = Math.max(0.02, Math.min(0.04, 0.02 + daylight * 0.02));
  const highlightAlpha = Math.max(0.09, Math.min(0.16, 0.09 + daylight * 0.07));
  const span = Math.max(size * 0.85, width * 2.4);
  const gx0 = center.x - nx * span;
  const gy0 = center.y - ny * span;
  const gx1 = center.x + nx * span;
  const gy1 = center.y + ny * span;

  ctx.save();
  ctx.globalCompositeOperation = 'source-atop';
  const shade = ctx.createLinearGradient(gx0, gy0, gx1, gy1);
  shade.addColorStop(0, `rgba(0, 0, 0, ${shadowAlpha})`);
  shade.addColorStop(0.43, `rgba(0, 0, 0, ${shadowAlpha * 0.35})`);
  shade.addColorStop(0.6, `rgba(255, 255, 255, ${midAlpha})`);
  shade.addColorStop(1, `rgba(255, 255, 255, ${highlightAlpha})`);
  ctx.fillStyle = shade;
  withBodyGeometryPath(ctx, bodyGeometry, (pathHandle, hasPath) => {
    if (hasPath) ctx.fill(pathHandle);
    else ctx.fill();
  });

  ctx.restore();
}

export function drawKoiEyeSimple(adapter, ctx, size, eyeFB, eyeSP) {
  const phys = adapter.tuning?.physics || {};
  const eyeAnchorRaw = Number(phys.eventEyeAnchorIndex);
  const eyeAnchorIdx = Math.min(
    adapter.history.length - 1,
    Math.max(1, Number.isFinite(eyeAnchorRaw) ? Math.round(eyeAnchorRaw) : 3),
  );
  const anchor = adapter.history[eyeAnchorIdx];
  const t = eyeAnchorIdx / (adapter.history.length - 1);
  const hr = getKoiBodyRadius(adapter, t, size);
  const angle = resolveHeadwardAngleFromHistory(adapter.history, eyeAnchorIdx, anchor?.angle);

  const eyeOffsetSide = hr * (0.85 + eyeSP * 0.1);
  const eyeOffsetForward = size * (0.05 - eyeFB * 0.1);

  const fx = Math.cos(angle);
  const fy = Math.sin(angle);
  const sx = Math.cos(angle - Math.PI / 2);
  const sy = Math.sin(angle - Math.PI / 2);

  const centerX = anchor.x + fx * eyeOffsetForward;
  const centerY = anchor.y + fy * eyeOffsetForward;

  const drawSingleEye = (side) => {
    const ex = centerX + sx * eyeOffsetSide * side;
    const ey = centerY + sy * eyeOffsetSide * side;

    ctx.save();
    ctx.translate(ex, ey);
    ctx.rotate(angle);
    ctx.fillStyle = adapter.eyeColor;
    ctx.beginPath();
    ctx.ellipse(0, 0, size * 0.08, size * 0.06, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  };

  drawSingleEye(1);
  drawSingleEye(-1);
}
