import { parseHexColorSafe } from '../../../../themes/plugins/zen/api/koi.js';
import { getKoiBodyRadius } from './KoiRenderGeometry.js';

const TWO_PI = Math.PI * 2;

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

const toFiniteNumber = (value, fallback = 0) => {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : fallback;
};

function drawOrganicMarkPath(ctx, mark, localX, localY, baseR) {
  const points = Math.max(8, Math.min(24, Math.round(toFiniteNumber(mark.edgePoints, 14))));
  const scaleX = clamp(toFiniteNumber(mark.scaleX, 1), 0.35, 2.1);
  const scaleY = clamp(toFiniteNumber(mark.scaleY, 1), 0.35, 1.8);
  const rotation = toFiniteNumber(mark.rotation, 0);
  const noiseOffset = toFiniteNumber(mark.noiseOffset, 0);
  const edgeAmpA = clamp(toFiniteNumber(mark.edgeAmpA, 0.13), 0, 0.28);
  const edgeAmpB = clamp(toFiniteNumber(mark.edgeAmpB, 0.08), 0, 0.2);
  const edgeLobesA = Math.max(1, Math.min(7, Math.round(toFiniteNumber(mark.edgeLobesA, 3))));
  const edgeLobesB = Math.max(2, Math.min(10, Math.round(toFiniteNumber(mark.edgeLobesB, 5))));
  const edgePhaseA = toFiniteNumber(mark.edgePhaseA, noiseOffset);
  const edgePhaseB = toFiniteNumber(mark.edgePhaseB, noiseOffset * 0.5);
  const cosRot = Math.cos(rotation);
  const sinRot = Math.sin(rotation);

  ctx.beginPath();
  for (let j = 0; j <= points; j += 1) {
    const ang = (j / points) * TWO_PI;
    const rMod = clamp(
      1
        + Math.sin(ang * edgeLobesA + edgePhaseA + noiseOffset) * edgeAmpA
        + Math.cos(ang * edgeLobesB + edgePhaseB) * edgeAmpB,
      0.58,
      1.42,
    );
    const rawX = Math.cos(ang) * baseR * scaleX * rMod;
    const rawY = Math.sin(ang) * baseR * scaleY * rMod;
    const lx = localX + rawX * cosRot - rawY * sinRot;
    const ly = localY + rawX * sinRot + rawY * cosRot;

    if (j === 0) ctx.moveTo(lx, ly);
    else ctx.lineTo(lx, ly);
  }
  ctx.closePath();
}

function drawScaledEllipsePath(ctx, mark, localX, localY, baseR, yScale = 1) {
  const scaleX = clamp(toFiniteNumber(mark.scaleX, 1), 0.35, 2.1);
  const scaleY = clamp(toFiniteNumber(mark.scaleY, 1), 0.35, 1.8);
  const rotation = toFiniteNumber(mark.rotation, 0);
  ctx.beginPath();
  ctx.ellipse(localX, localY, baseR * scaleX, baseR * yScale * scaleY, rotation, 0, TWO_PI);
}

export function drawKoiPattern(adapter, ctx, size) {
  if (adapter.patternStyle === 'checkered') {
    ctx.save();
    ctx.globalCompositeOperation = 'source-atop';
    ctx.strokeStyle = adapter.colorSecondary || 'rgba(0,0,0,0.15)';
    ctx.lineWidth = size * 0.03;
    ctx.globalAlpha = 0.6;

    for (let i = 2; i < adapter.history.length - 8; i += 2) {
      const point = adapter.history[i];
      if (!point) continue;
      const radius = getKoiBodyRadius(adapter, i / adapter.history.length, size);
      const nx = Math.cos(point.angle);
      const ny = Math.sin(point.angle);
      const px = Math.cos(point.angle - Math.PI / 2);
      const py = Math.sin(point.angle - Math.PI / 2);

      ctx.beginPath();
      for (let side = -1; side <= 1; side += 2) {
        const params = [
          point.x + px * radius * side * 0.8,
          point.y + py * radius * side * 0.8,
          point.x - nx * size * 0.4 + px * radius * side * 0.45,
          point.y - ny * size * 0.4 + py * radius * side * 0.45,
          point.x + px * radius * side * 0.1,
          point.y + py * radius * side * 0.1,
        ];
        ctx.moveTo(params[0], params[1]);
        ctx.quadraticCurveTo(params[2], params[3], params[4], params[5]);
      }
      ctx.stroke();
    }
    ctx.restore();
  } else if (adapter.patternStyle === 'lateral-stripe') {
    ctx.save();
    ctx.fillStyle = adapter.colorPattern;
    ctx.globalCompositeOperation = 'source-atop';
    for (let i = 4; i < adapter.history.length - 6; i += 2) {
      const point = adapter.history[i];
      const radius = size * 0.18;
      ctx.beginPath();
      ctx.arc(point.x, point.y, radius, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  } else {
    if (!adapter.patternMarks || adapter.patternMarks.length === 0) return;

    if (adapter._patternMarksSortedSource !== adapter.patternMarks) {
      adapter._patternMarksSortedSource = adapter.patternMarks;
      adapter._patternMarksSorted = [...adapter.patternMarks].sort((a, b) => {
        const scoreA = a.kind === 'patch' ? 0 : 1;
        const scoreB = b.kind === 'patch' ? 0 : 1;
        return scoreA - scoreB;
      });
    }
    const marks = adapter._patternMarksSorted || adapter.patternMarks;

    ctx.save();
    for (const mark of marks) {
      let fillStyle = adapter.colorPattern;
      if (mark.color === 'secondary') fillStyle = adapter.colorSecondary;
      else if (mark.color === 'accent') fillStyle = adapter.colorAccent;

      ctx.fillStyle = fillStyle;
      ctx.globalAlpha = 0.95;

      const idx = Math.floor(mark.t * (adapter.history.length - 1));
      const point = adapter.history[idx];
      if (!point) continue;

      const bodyRadius = getKoiBodyRadius(adapter, mark.t, size);

      ctx.save();
      ctx.translate(point.x, point.y);
      ctx.rotate(point.angle);

      const localX = 0;
      const localY = mark.side * bodyRadius * 1.5;
      const baseR = size * mark.scale * 1.2;

      if (mark.organic) {
        drawOrganicMarkPath(ctx, mark, localX, localY, baseR);
        ctx.fill();
      } else if (mark.kind === 'circle') {
        drawScaledEllipsePath(ctx, mark, localX, localY, baseR);
        ctx.fill();
      } else if (mark.kind === 'spot') {
        drawScaledEllipsePath(ctx, mark, localX, localY, baseR, 0.8);
        ctx.fill();
      } else {
        const points = 10;
        ctx.beginPath();
        for (let j = 0; j <= points; j += 1) {
          const ang = (j / points) * Math.PI * 2;
          const rMod = 1 + Math.sin(ang * 3 + mark.noiseOffset) * 0.15 + Math.cos(ang * 5) * 0.1;
          const radius = baseR * rMod;

          const lx = localX + Math.cos(ang) * radius;
          const ly = localY + Math.sin(ang) * radius;

          if (j === 0) ctx.moveTo(lx, ly);
          else ctx.lineTo(lx, ly);
        }
        ctx.fill();
      }
      ctx.restore();
    }
    ctx.restore();
  }

  if (adapter.scaleType === 'doitsu') {
    drawKoiDoitsuZipper(adapter, ctx, size);
  }

  if (adapter.variant === 'threat') drawKoiDorsalSpines(adapter, ctx, size);
  else if (adapter.variant === 'trash') drawKoiScars(adapter, ctx, size);
}

export function drawKoiDoitsuZipper(adapter, ctx, size) {
  if (!Array.isArray(adapter.history) || adapter.history.length < 12) return;

  const startIdx = 2;
  const endIdx = Math.max(startIdx + 1, adapter.history.length - 7);
  const total = endIdx - startIdx + 1;
  const targetScales = Math.max(8, Math.min(12, Math.floor(total / 2.4)));
  const step = Math.max(1, Math.floor(total / targetScales));

  ctx.save();
  for (let idx = startIdx; idx <= endIdx; idx += step) {
    const point = adapter.history[idx];
    if (!point) continue;

    const t = idx / (adapter.history.length - 1);
    const bodyRadius = getKoiBodyRadius(adapter, t, size);
    const scaleW = Math.max(size * 0.13, bodyRadius * 0.36);
    const scaleH = Math.max(size * 0.065, bodyRadius * 0.17);

    ctx.save();
    ctx.translate(point.x, point.y);
    ctx.rotate(point.angle);
    ctx.fillStyle = 'rgba(242, 247, 252, 0.32)';
    ctx.strokeStyle = 'rgba(78, 96, 112, 0.42)';
    ctx.lineWidth = Math.max(0.8, size * 0.012);
    ctx.beginPath();
    ctx.ellipse(0, 0, scaleW, scaleH, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.restore();

    if (adapter.doitsuMode === 'mirror' && idx % (step * 2) === 0) {
      const nx = Math.cos(point.angle - Math.PI / 2);
      const ny = Math.sin(point.angle - Math.PI / 2);
      const sideOffset = bodyRadius * 0.78;
      const sideW = scaleW * 0.58;
      const sideH = scaleH * 0.68;

      for (let side = -1; side <= 1; side += 2) {
        ctx.save();
        ctx.translate(point.x + nx * sideOffset * side, point.y + ny * sideOffset * side);
        ctx.rotate(point.angle);
        ctx.fillStyle = 'rgba(232, 238, 245, 0.2)';
        ctx.strokeStyle = 'rgba(70, 86, 102, 0.3)';
        ctx.lineWidth = Math.max(0.7, size * 0.01);
        ctx.beginPath();
        ctx.ellipse(0, 0, sideW, sideH, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        ctx.restore();
      }
    }
  }
  ctx.restore();
}

export function drawKoiGinrinSparkle(adapter, ctx, size) {
  if (!Array.isArray(adapter.history) || adapter.history.length < 10) return;

  const qualityScaleRaw = Number(adapter.ginrinQualityScale);
  const qualityScale = Number.isFinite(qualityScaleRaw)
    ? Math.max(0, Math.min(1, qualityScaleRaw))
    : 1;
  if (qualityScale <= 0) return;

  const density = Math.max(0.4, Math.min(1.6, Number(adapter.ginrinDensity) || 1)) * qualityScale;
  const sparkleCount = Math.max(4, Math.min(12, Math.round(8 * density)));
  const phase = adapter.swimCycle || 0;

  ctx.save();
  for (let i = 0; i < sparkleCount; i += 1) {
    const raw = (i + 0.35) / sparkleCount;
    const jitter = Math.sin((i + 1) * 13.17 + phase * 1.6) * 0.035;
    const t = Math.max(0.08, Math.min(0.92, raw + jitter));
    const idx = Math.max(1, Math.min(adapter.history.length - 2, Math.floor(t * (adapter.history.length - 1))));
    const point = adapter.history[idx];
    if (!point) continue;

    const bodyRadius = getKoiBodyRadius(adapter, t, size);
    const nx = Math.cos(point.angle - Math.PI / 2);
    const ny = Math.sin(point.angle - Math.PI / 2);
    const side = Math.sin(i * 7.41 + phase * 2.2) * bodyRadius * 0.22;
    const px = point.x + nx * side;
    const py = point.y + ny * side;

    const blink = 0.45 + 0.55 * (0.5 + 0.5 * Math.sin(phase * 3.1 + i * 2.17));
    const alpha = 0.14 + blink * 0.34;
    const radius = Math.max(0.8, size * (0.014 + (i % 3) * 0.0035));

    ctx.fillStyle = `rgba(255, 255, 255, ${alpha})`;
    ctx.beginPath();
    ctx.arc(px, py, radius, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

export function drawKoiDorsalSpines(adapter, ctx, size) {
  ctx.save();
  ctx.fillStyle = adapter.colorAccent;
  ctx.globalAlpha = 0.85;
  for (let i = 4; i < adapter.history.length - 8; i += 6) {
    const point = adapter.history[i];
    const t = i / (adapter.history.length - 1);
    const radius = getKoiBodyRadius(adapter, t, size);
    const nx = Math.cos(point.angle - Math.PI / 2);
    const ny = Math.sin(point.angle - Math.PI / 2);
    const tx = Math.cos(point.angle);
    const ty = Math.sin(point.angle);
    const bx = point.x + nx * radius * 0.7;
    const by = point.y + ny * radius * 0.7;
    const sl = radius * (0.35 + adapter.aggression * 0.35);
    ctx.beginPath();
    ctx.moveTo(bx + tx * radius * 0.35, by + ty * radius * 0.35);
    ctx.lineTo(bx + nx * sl, by + ny * sl);
    ctx.lineTo(bx - tx * radius * 0.35, by - ty * radius * 0.35);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();
}

export function drawKoiScars(adapter, ctx, size) {
  ctx.save();
  ctx.strokeStyle = adapter.colorAccent;
  ctx.globalAlpha = 0.4;
  ctx.lineWidth = Math.max(1, size * 0.04);
  for (let i = 8; i < adapter.history.length - 14; i += 12) {
    const point = adapter.history[i];
    const t = i / (adapter.history.length - 1);
    const radius = getKoiBodyRadius(adapter, t, size);
    const nx = Math.cos(point.angle - Math.PI / 2);
    const ny = Math.sin(point.angle - Math.PI / 2);
    const tx = Math.cos(point.angle);
    const ty = Math.sin(point.angle);
    ctx.beginPath();
    ctx.moveTo(point.x - nx * radius * 0.4, point.y - ny * radius * 0.4);
    ctx.lineTo(point.x + nx * radius * 0.4 + tx * radius * 0.15, point.y + ny * radius * 0.4 + ty * radius * 0.15);
    ctx.stroke();
  }
  ctx.restore();
}

export function drawKoiDorsalFin(adapter, ctx, size) {
  const startIdx = Math.floor(adapter.history.length * 0.4);
  const endIdx = Math.floor(adapter.history.length * 0.9);
  const finHeight = size * 0.6;

  if (startIdx >= adapter.history.length || endIdx >= adapter.history.length) return;

  ctx.save();
  ctx.beginPath();

  const rootPoints = [];
  for (let i = startIdx; i <= endIdx; i += 1) {
    rootPoints.push(adapter.history[i]);
  }

  const tipPoints = [];
  for (let i = startIdx; i <= endIdx; i += 1) {
    const point = adapter.history[i];
    const nx = Math.cos(point.angle - Math.PI / 2);
    const ny = Math.sin(point.angle - Math.PI / 2);
    const t = (i - startIdx) / (endIdx - startIdx);
    const profile = Math.sin(t * Math.PI);
    const h = finHeight * profile;
    const offset = -adapter.banking * h * 1.5;

    tipPoints.push({
      x: point.x + nx * offset,
      y: point.y + ny * offset,
    });
  }

  if (rootPoints.length < 2) {
    ctx.restore();
    return;
  }

  ctx.moveTo(rootPoints[0].x, rootPoints[0].y);
  for (let i = 1; i < rootPoints.length; i += 1) {
    ctx.lineTo(rootPoints[i].x, rootPoints[i].y);
  }
  for (let i = tipPoints.length - 1; i >= 0; i -= 1) {
    ctx.lineTo(tipPoints[i].x, tipPoints[i].y);
  }
  ctx.closePath();

  const baseC = parseHexColorSafe(adapter.colorFin, '#FFFFFF');
  const { r, g, b } = baseC;

  const midRoot = rootPoints[Math.floor(rootPoints.length / 2)];
  const midTip = tipPoints[Math.floor(tipPoints.length / 2)];
  const grad = ctx.createLinearGradient(midRoot.x, midRoot.y, midTip.x, midTip.y);
  grad.addColorStop(0, `rgba(${r}, ${g}, ${b}, 0.95)`);
  grad.addColorStop(0.5, `rgba(${r}, ${g}, ${b}, 0.75)`);
  grad.addColorStop(1, `rgba(${r}, ${g}, ${b}, 0.45)`);

  ctx.fillStyle = grad;
  ctx.fill();

  ctx.strokeStyle = `rgba(${r}, ${g}, ${b}, ${0.5 + Math.abs(adapter.banking) * 0.4})`;
  ctx.lineWidth = 1;
  ctx.beginPath();
  const tipStart = tipPoints[0];
  ctx.moveTo(tipStart.x, tipStart.y);
  for (let i = 1; i < tipPoints.length; i += 1) {
    ctx.lineTo(tipPoints[i].x, tipPoints[i].y);
  }
  ctx.stroke();

  ctx.restore();
}

export function drawKoiLabel(adapter, ctx, size) {
  if (adapter.labelOpacity > 0 && adapter.domain) {
    ctx.save();
    ctx.translate(adapter.x, adapter.y - size);
    ctx.globalAlpha = adapter.labelOpacity;
    ctx.font = '700 12px "Pretendard", sans-serif';
    const text = adapter.domain;
    const metrics = ctx.measureText(text);
    const px = 8;
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    ctx.beginPath();
    ctx.roundRect(-metrics.width / 2 - px, -20, metrics.width + px * 2, 24, 12);
    ctx.fill();
    ctx.fillStyle = '#FFF';
    ctx.textAlign = 'center';
    ctx.fillText(text, 0, -4);
    ctx.restore();
  }
}
