import {
  clamp as clampValue,
  computeTailJointPose,
  DEFAULT_KOI_TUNING,
  computePectoralStrokeWave,
  normalizeCyclePhase,
  parseHexColorSafe,
  resolveTailShadowCanvasFit,
  wrapAngle,
} from '../../../../themes/plugins/zen/api/koi.js';
import { getKoiBodyRadius } from './KoiRenderGeometry.js';

function createVoidFinGradient(ctx, x, y, radius, alpha) {
  const gradient = ctx.createRadialGradient(x, y, 0, x, y, radius);
  gradient.addColorStop(0, `rgba(0, 0, 0, ${alpha})`);
  gradient.addColorStop(0.5, `rgba(0, 0, 0, ${alpha})`);
  gradient.addColorStop(0.82, `rgba(0, 0, 0, ${alpha * 0.9})`);
  gradient.addColorStop(1, `rgba(0, 0, 0, ${alpha * 0.58})`);
  return gradient;
}

export function drawKoiPectoralFins(adapter, ctx, x, y, angle, size, radius, isMain, bend = 0, idx = 0, isShadow = false, renderPolicy = null) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  ctx.fillStyle = adapter.colorFin || 'rgba(255, 255, 255, 0.5)';

  const cfg = adapter.tuning || DEFAULT_KOI_TUNING;
  const baseScale = isMain
    ? (cfg.pectoralSize !== undefined ? cfg.pectoralSize : 0.9)
    : (cfg.ventralSize !== undefined ? cfg.ventralSize : 0.45);
  const fs = size * baseScale;

  const sideOffset = isMain
    ? (cfg.pectoralPosSide !== undefined ? cfg.pectoralPosSide : 1.0)
    : (cfg.ventralPosSide !== undefined ? cfg.ventralPosSide : 1.0);

  const baseAngle = isMain
    ? (cfg.pectoralAngle !== undefined ? cfg.pectoralAngle : 0.7)
    : (cfg.ventralAngle !== undefined ? cfg.ventralAngle : 0.7);

  const bendClamp = Math.max(-0.6, Math.min(0.6, bend));
  const turnThreshold = clampValue(cfg.pectoralTurnThreshold ?? 0.0018, 0, 0.08);
  const turnRateRef = Math.max(
    turnThreshold + 1e-6,
    clampValue(cfg.pectoralTurnRateRef ?? 0.078, 0.01, 0.35),
  );
  const turnAbs = Math.abs(adapter.turnRate || 0);
  const turnBlend = clampValue((turnAbs - turnThreshold) / Math.max(1e-6, turnRateRef - turnThreshold), 0, 1);
  const driveSide = adapter.turnRate > turnThreshold ? 1 : (adapter.turnRate < -turnThreshold ? -1 : 0);
  const driveAmpBoost = clampValue(cfg.pectoralDriveAmpBoost ?? 0.58, 0, 1.8);
  const opposingAmpMin = clampValue(cfg.pectoralOpposingAmpMin ?? 0.36, 0.05, 1.0);
  const driveSweep = clampValue(cfg.pectoralDriveSweep ?? 0.18, -0.8, 0.8);
  const opposingFold = clampValue(cfg.pectoralOpposingFold ?? 0.44, 0, 1.4);
  const opposingRecoveryFeather = clampValue(cfg.pectoralOpposingRecoveryFeather ?? 0.4, 0, 0.9);
  const strokeRecoveryStart = clampValue(
    Number.isFinite(cfg.pectoralStrokePowerEndPhase) ? cfg.pectoralStrokePowerEndPhase : 0.42,
    0.1,
    0.88,
  );
  const strokeRecoveryEnd = clampValue(
    Number.isFinite(cfg.pectoralStrokeRecoveryEndPhase) ? cfg.pectoralStrokeRecoveryEndPhase : 0.82,
    strokeRecoveryStart + 0.03,
    0.98,
  );

  [1, -1].forEach((side) => {
    const finPhase = side === 1 ? adapter.finPhaseR : adapter.finPhaseL;
    const flutterAmp = isMain ? (cfg.pectoralFlutterAmp ?? 0.34) : 0.02;
    const phased = finPhase - idx * 0.15;
    const phaseNorm = normalizeCyclePhase(phased);
    const strokeWave = computePectoralStrokeWave(phased, {
      preloadPhase: cfg.pectoralStrokePreloadPhase,
      powerEndPhase: cfg.pectoralStrokePowerEndPhase,
      recoveryEndPhase: cfg.pectoralStrokeRecoveryEndPhase,
      overshootPhase: cfg.pectoralStrokeOvershootPhase,
      preloadDepth: cfg.pectoralStrokePreloadDepth,
      overshootAmplitude: cfg.pectoralStrokeOvershootAmp,
    });

    const isDriveFin = driveSide !== 0 && side === driveSide;
    const isOpposingFin = driveSide !== 0 && side !== driveSide;
    let strokeScale = 1;
    if (isDriveFin) strokeScale += turnBlend * driveAmpBoost;
    if (isOpposingFin) strokeScale *= 1 - turnBlend * (1 - opposingAmpMin);

    let finWave = strokeWave * flutterAmp * strokeScale;
    if (isOpposingFin && turnBlend > 0.001) {
      const recoveryGate = clampValue(
        (phaseNorm - strokeRecoveryStart) / Math.max(1e-6, strokeRecoveryEnd - strokeRecoveryStart),
        0,
        1,
      );
      finWave *= 1 - recoveryGate * opposingRecoveryFeather * turnBlend;
    }

    let foldOffset = 0;
    if (isDriveFin) foldOffset += turnBlend * driveSweep;
    if (isOpposingFin) foldOffset -= turnBlend * opposingFold;

    const fl = bendClamp * 0.45 + finWave + foldOffset;

    ctx.save();
    ctx.translate(0, radius * side * sideOffset);
    if (side === -1) ctx.scale(1, -1);
    const finAngle = clampValue(baseAngle + fl, -1.4, 2.2);
    ctx.rotate(finAngle);

    if (isShadow) {
      const finShadowAlpha = clampValue(
        Number.isFinite(Number(adapter.shadowFinAlpha)) ? Number(adapter.shadowFinAlpha) : 0.34,
        0.08,
        1,
      );
      ctx.fillStyle = renderPolicy?.mode === 'shadow'
        ? createVoidFinGradient(ctx, 0, 0, fs * 1.05, finShadowAlpha)
        : `rgba(0, 0, 0, ${finShadowAlpha})`;
    } else {
      const finGradient = ctx.createRadialGradient(0, 0, 0, 0, 0, fs);
      const finBaseColor = parseHexColorSafe(adapter.colorFin, '#FFFFFF');
      const { r: fr, g: fgChannel, b: fb } = finBaseColor;
      const shade = isMain ? 1.0 : 0.84;
      const r1 = Math.round(fr * shade);
      const g1 = Math.round(fgChannel * shade);
      const b1 = Math.round(fb * shade);

      finGradient.addColorStop(0, `rgba(${r1}, ${g1}, ${b1}, 0.95)`);
      finGradient.addColorStop(0.6, `rgba(${r1}, ${g1}, ${b1}, 0.8)`);
      finGradient.addColorStop(1, `rgba(${r1}, ${g1}, ${b1}, 0.5)`);
      ctx.fillStyle = finGradient;
    }

    ctx.beginPath();
    ctx.moveTo(0, 0);
    if (adapter.finStyle === 'flowing') {
      const widthScale = cfg.pectoralWidthScale !== undefined ? cfg.pectoralWidthScale : 1.0;
      const tipRoundness = cfg.pectoralTipRoundness !== undefined ? cfg.pectoralTipRoundness : 1.0;
      const leadCurve = cfg.pectoralLeadingCurvature !== undefined ? cfg.pectoralLeadingCurvature : 0.0;
      const trailCurve = cfg.pectoralTrailingCurvature !== undefined ? cfg.pectoralTrailingCurvature : 0.0;

      ctx.quadraticCurveTo(
        fs * (0.1 + leadCurve), fs * 0.4,
        -fs * 0.3, fs * 1.0,
      );

      ctx.bezierCurveTo(
        -fs * (0.5 * widthScale * tipRoundness), fs * 0.9,
        -fs * (0.75 * widthScale + trailCurve), fs * 0.4,
        0, 0,
      );
    } else {
      ctx.lineTo(-fs * 0.6, fs * 0.2);
      ctx.lineTo(-fs, fs * 0.8);
      ctx.lineTo(-fs * 0.2, fs);
      ctx.closePath();
    }
    ctx.fill();
    if (isShadow) {
      const outlineColorRaw = adapter.shadowOutlineColor;
      const outlineColor = typeof outlineColorRaw === 'string' ? outlineColorRaw.trim() : '';
      if (outlineColor) {
        const widthScale = clampValue(Number(adapter.shadowOutlineWidthScale), 0.008, 0.08);
        ctx.save();
        ctx.strokeStyle = outlineColor;
        ctx.lineJoin = 'round';
        ctx.lineCap = 'round';
        ctx.lineWidth = Math.max(0.52, size * widthScale * (isMain ? 1.05 : 0.9));
        ctx.shadowColor = outlineColor;
        ctx.shadowBlur = Math.max(0.55, size * 0.06);
        ctx.stroke();
        ctx.restore();
      }
    }
    ctx.restore();
  });
  ctx.restore();
}

function resolveForwardRoomInCanvas(ctx, originX, originY, directionAngle) {
    const canvas = ctx?.canvas;
    if (!canvas) return Number.POSITIVE_INFINITY;
    const transform = typeof ctx?.getTransform === 'function' ? ctx.getTransform() : null;
    const scaleX = Math.max(1e-6, Math.abs(Number(transform?.a) || 1));
    const scaleY = Math.max(1e-6, Math.abs(Number(transform?.d) || 1));
    const logicalWidth = (Number(canvas.width) || 0) / scaleX;
    const logicalHeight = (Number(canvas.height) || 0) / scaleY;
    if (logicalWidth <= 0 || logicalHeight <= 0) return Number.POSITIVE_INFINITY;

    const dirX = Math.cos(directionAngle);
    const dirY = Math.sin(directionAngle);
    const eps = 1e-6;
    let t = Number.POSITIVE_INFINITY;

    if (dirX > eps) t = Math.min(t, (logicalWidth - originX) / dirX);
    else if (dirX < -eps) t = Math.min(t, (0 - originX) / dirX);
    if (dirY > eps) t = Math.min(t, (logicalHeight - originY) / dirY);
    else if (dirY < -eps) t = Math.min(t, (0 - originY) / dirY);

    return t > 0 ? t : Number.POSITIVE_INFINITY;
}

export function resolveKoiTailFinGeometry(adapter, pos, size, isShadow = false, resolveForwardRoom = () => Number.POSITIVE_INFINITY) {
  if (!pos) return null;
  const history = Array.isArray(adapter.history) ? adapter.history : [];
  const turnRate = adapter.turnRate || 0;
  const turnAbs = Math.abs(turnRate);
  const bank = adapter.banking || 0;

  const cfg = adapter.tuning || DEFAULT_KOI_TUNING;
  const tailSpreadBase = clampValue(cfg.tailFinSpread ?? 0.4, 0.12, 1.2);
  const tailNotchDepth = clampValue(cfg.tailFinNotchDepth ?? 0.75, 0.45, 0.95);
  const tailBaseWidthScale = clampValue(cfg.tailFinBaseWidth ?? 1.0, 0.35, 2.0);
  const tailRoundness = clampValue(cfg.tailFinRoundness ?? 1.0, 0.35, 2.0);
  const tailEdgeSharpness = clampValue(cfg.tailFinEdgeSharpness ?? 1.0, 0.4, 2.0);
  const tailRootOffset = clampValue(cfg.tailFinRootOffset ?? 0.2, 0.0, 0.55);
  const tailVeinAlpha = clampValue(cfg.tailFinVeinAlpha ?? 1.0, 0.0, 2.0);
  const tailTurnSpreadGain = clampValue(cfg.tailFinTurnSpreadGain ?? 0.45, 0.0, 2.0);

  const baseWidth = getKoiBodyRadius(adapter, 0.98, size) * 0.4 * tailBaseWidthScale;
  const tailLength = size * (adapter.variant === 'elegant' ? 1.1 : 0.9) * (cfg.tailFinSize || 1.0);
  const tailColor = parseHexColorSafe(adapter.colorTail, adapter.colorFin || '#FFFFFF').hex;

  const tailPose = computeTailJointPose({
    history,
    tipPos: pos,
    turnRate,
    bank,
    tailTurnSpreadGain,
    clampFn: clampValue,
  });
  const jointRootAngle = tailPose.jointRootAngle;
  const jointTipAngle = tailPose.jointTipAngle;
  const bodyForwardAngle = tailPose.bodyForwardAngle;
  const fx = Math.cos(bodyForwardAngle);
  const fy = Math.sin(bodyForwardAngle);
  let rootX = pos.x + fx * size * tailRootOffset;
  let rootY = pos.y + fy * size * tailRootOffset;

  const forwardRoom = resolveForwardRoom(rootX, rootY, jointTipAngle);
  const shadowFit = isShadow
    ? resolveTailShadowCanvasFit({
      forwardRoom,
      tailLength,
      size,
      clampFn: clampValue,
    })
    : { rootShift: 0, lengthScale: 1 };
  if (isShadow && shadowFit.rootShift > 1e-6) {
    const dirX = Math.cos(jointTipAngle);
    const dirY = Math.sin(jointTipAngle);
    rootX -= dirX * shadowFit.rootShift;
    rootY -= dirY * shadowFit.rootShift;
  }
  const shadowLengthScale = isShadow ? shadowFit.lengthScale : 1;

  const px = Math.cos(jointRootAngle - Math.PI / 2);
  const py = Math.sin(jointRootAngle - Math.PI / 2);
  const lerpAngle = (a, b, t) => a + wrapAngle(b - a) * t;

  const lobes = [-1, 1].map(sideIndex => {
    const bankShift = bank * size * 0.12 * sideIndex;
    const lRootX = rootX + px * bankShift;
    const lRootY = rootY + py * bankShift;

    const sideDrag = turnRate * (0.75 + sideIndex * 0.18);
    const rootAngle = jointRootAngle - sideDrag * 0.45;
    const tipAngle = jointTipAngle - sideDrag * 0.88;
    const forwardAngle = lerpAngle(rootAngle, tipAngle, 0.54);

    const spreadMult = isShadow ? (0.9 + shadowLengthScale * 0.1) : 1.0;
    const lengthMult = isShadow ? shadowLengthScale : 1.0;
    const spreadAngle = clampValue(tailSpreadBase + turnAbs * 1.55 * tailTurnSpreadGain, 0.12, 1.25) * spreadMult;
    const currentLength = tailLength * lengthMult;

    const rootDx = Math.cos(rootAngle - Math.PI / 2);
    const rootDy = Math.sin(rootAngle - Math.PI / 2);
    const tipDx = Math.cos(tipAngle - Math.PI / 2);
    const tipDy = Math.sin(tipAngle - Math.PI / 2);

    const lBase = {
      x: lRootX - fx * size * 0.08 + rootDx * baseWidth * spreadMult,
      y: lRootY - fy * size * 0.08 + rootDy * baseWidth * spreadMult,
    };
    const rBase = {
      x: lRootX - fx * size * 0.08 - rootDx * baseWidth * spreadMult,
      y: lRootY - fy * size * 0.08 - rootDy * baseWidth * spreadMult,
    };

    const lTip = {
      x: lRootX + Math.cos(tipAngle - spreadAngle) * currentLength,
      y: lRootY + Math.sin(tipAngle - spreadAngle) * currentLength,
    };
    const rTip = {
      x: lRootX + Math.cos(tipAngle + spreadAngle) * currentLength,
      y: lRootY + Math.sin(tipAngle + spreadAngle) * currentLength,
    };
    const cTip = {
      x: lRootX + Math.cos(forwardAngle) * currentLength * tailNotchDepth,
      y: lRootY + Math.sin(forwardAngle) * currentLength * tailNotchDepth,
    };

    const edgeLinearity = clampValue(0.4 / tailEdgeSharpness, 0.22, 0.58);
    const edgeBulgeMain = size * 0.1 * tailRoundness * spreadMult;
    const edgeBulgeTip = size * 0.15 * tailRoundness * spreadMult;
    const notchBlend = size * 0.15 * tailRoundness * spreadMult;
    const notchSideAngle = 0.3 + (tailRoundness - 1) * 0.08;

    return { lRootX, lRootY, lTip, rTip, cTip, start: lBase, curves: [
      [lBase.x + (lTip.x - lBase.x) * edgeLinearity + rootDx * edgeBulgeMain,
        lBase.y + (lTip.y - lBase.y) * edgeLinearity + rootDy * edgeBulgeMain,
        lTip.x + tipDx * edgeBulgeTip,
        lTip.y + tipDy * edgeBulgeTip,
        lTip.x,
        lTip.y],
      [lTip.x - tipDx * size * 0.05 * tailRoundness,
        lTip.y - tipDy * size * 0.05 * tailRoundness,
        cTip.x + Math.cos(tipAngle - notchSideAngle) * notchBlend,
        cTip.y + Math.sin(tipAngle - notchSideAngle) * notchBlend,
        cTip.x,
        cTip.y],
      [cTip.x + Math.cos(tipAngle + notchSideAngle) * notchBlend,
        cTip.y + Math.sin(tipAngle + notchSideAngle) * notchBlend,
        rTip.x + tipDx * size * 0.05 * tailRoundness,
        rTip.y + tipDy * size * 0.05 * tailRoundness,
        rTip.x,
        rTip.y],
      [rTip.x - tipDx * edgeBulgeTip,
        rTip.y - tipDy * edgeBulgeTip,
        rBase.x + (rTip.x - rBase.x) * edgeLinearity - rootDx * edgeBulgeMain,
        rBase.y + (rTip.y - rBase.y) * edgeLinearity - rootDy * edgeBulgeMain,
        rBase.x,
        rBase.y],
      [lRootX - rootDx * baseWidth,
        lRootY - rootDy * baseWidth,
        lRootX + rootDx * baseWidth,
        lRootY + rootDy * baseWidth,
        lBase.x,
        lBase.y]
    ] };
  });
  return { rootX, rootY, tailLength, shadowLengthScale, tailVeinAlpha, tailColor, lobes };
}

export function drawKoiTailFin(adapter, ctx, pos, size, isShadow = false, renderPolicy = null) {
  if (!pos) return;
  const geometry = resolveKoiTailFinGeometry(adapter, pos, size, isShadow,
    renderPolicy?.tailCanvasFit === false ? undefined : (x, y, angle) => resolveForwardRoomInCanvas(ctx, x, y, angle));
  const { rootX, rootY, tailLength, shadowLengthScale, tailVeinAlpha, tailColor, lobes } = geometry;
  ctx.save();
  const drawLobe = (sideIndex, alphaMult) => {
    const { lRootX, lRootY, lTip, rTip, cTip, start, curves } = lobes[sideIndex < 0 ? 0 : 1];
    ctx.beginPath();
    ctx.moveTo(start.x, start.y);
    for (const curve of curves) ctx.bezierCurveTo(...curve);
    ctx.fill();
    if (isShadow) {
      const outlineColorRaw = adapter.shadowOutlineColor;
      const outlineColor = typeof outlineColorRaw === 'string' ? outlineColorRaw.trim() : '';
      if (outlineColor) {
        const widthScale = clampValue(Number(adapter.shadowOutlineWidthScale), 0.008, 0.08);
        ctx.save();
        ctx.strokeStyle = outlineColor;
        ctx.lineJoin = 'round';
        ctx.lineCap = 'round';
        ctx.lineWidth = Math.max(0.6, size * widthScale);
        ctx.shadowColor = outlineColor;
        ctx.shadowBlur = Math.max(0.6, size * 0.065);
        ctx.stroke();
        ctx.restore();
      }
    }

    if (!isShadow && tailVeinAlpha > 0.01) {
      ctx.strokeStyle = `rgba(255,255,255,${0.15 * tailVeinAlpha * alphaMult})`;
      ctx.lineWidth = Math.max(0.4, 1.2 * (0.8 + tailVeinAlpha * 0.2));
      ctx.beginPath();
      ctx.moveTo(lRootX, lRootY);
      ctx.lineTo(cTip.x, cTip.y);
      ctx.stroke();

      ctx.strokeStyle = `rgba(255,255,255,${0.08 * tailVeinAlpha * alphaMult})`;
      ctx.lineWidth = Math.max(0.2, 0.6 * (0.8 + tailVeinAlpha * 0.4));
      ctx.beginPath();
      ctx.moveTo(lRootX, lRootY);
      ctx.lineTo(lTip.x, lTip.y);
      ctx.moveTo(lRootX, lRootY);
      ctx.lineTo(rTip.x, rTip.y);
      ctx.stroke();
    }
  };

  const { r, g, b } = parseHexColorSafe(tailColor, '#FFFFFF');
  if (isShadow) {
    const tailShadowAlpha = clampValue(
      Number.isFinite(Number(adapter.shadowTailAlpha)) ? Number(adapter.shadowTailAlpha) : 0.34,
      0.08,
      1,
    );
    ctx.fillStyle = renderPolicy?.mode === 'shadow'
      ? createVoidFinGradient(ctx, rootX, rootY, tailLength * shadowLengthScale * 1.05, tailShadowAlpha)
      : `rgba(0, 0, 0, ${tailShadowAlpha * 0.58})`;
    drawLobe(-1, 0.92);
    drawLobe(1, 1.0);
    ctx.restore();
    return;
  }

  const coreL = ctx.createRadialGradient(rootX, rootY, 0, rootX, rootY, tailLength * 1.0);
  coreL.addColorStop(0, `rgba(${r}, ${g}, ${b}, 0.92)`);
  coreL.addColorStop(0.55, `rgba(${r}, ${g}, ${b}, 0.78)`);
  coreL.addColorStop(1, `rgba(${r}, ${g}, ${b}, 0.56)`);
  ctx.fillStyle = coreL;
  drawLobe(-1, 0.82);

  const coreU = ctx.createRadialGradient(rootX, rootY, 0, rootX, rootY, tailLength * 1.0);
  coreU.addColorStop(0, `rgba(${r}, ${g}, ${b}, 0.98)`);
  coreU.addColorStop(0.5, `rgba(${r}, ${g}, ${b}, 0.82)`);
  coreU.addColorStop(1, `rgba(${r}, ${g}, ${b}, 0.62)`);
  ctx.fillStyle = coreU;
  drawLobe(1, 1.0);

  ctx.restore();
}
