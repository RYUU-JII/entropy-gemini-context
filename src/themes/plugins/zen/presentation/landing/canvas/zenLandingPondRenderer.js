import {
  ZEN_LANDING_BENTHIC_GRAINS,
  ZEN_LANDING_BENTHIC_PATCHES,
  ZEN_LANDING_CAUSTIC_RIBBONS,
  ZEN_LANDING_KOI,
  ZEN_LANDING_PETALS,
  ZEN_LANDING_REFRACTION_BANDS,
  ZEN_LANDING_WATER_THREADS,
} from './zenLandingPondGeometry.js';
import {
  buildCanonicalKoiAppendageGeometry,
  buildKoiBodyContour,
  resolveKoiBodyRadius,
  traceKoiAppendagePath,
  traceKoiBodyContourPath,
} from '../../../api/landingKoi.js';

const TAU = Math.PI * 2;
const WATER_TOP_RATIO = 0.37;
const STILL_WIND = Object.freeze({ x: 0, strength: 0 });

function clamp01(value) {
  return Math.max(0, Math.min(1, value));
}

function mix(left, right, amount) {
  return left + ((right - left) * amount);
}

function smoothstep(value) {
  const amount = clamp01(value);
  return amount * amount * (3 - (2 * amount));
}

function resolveSurfaceField(frame, normalizedX, normalizedY, phase = 0) {
  const { presentation, timeSeconds } = frame;
  const { state } = presentation;
  const wind = state.wind.x * state.wind.strength;
  const advectedX = normalizedX + (wind * timeSeconds * 0.004);
  const longWave = Math.sin(
    (advectedX * TAU * 1.38)
      + (normalizedY * TAU * 0.72)
      + (timeSeconds * 0.17)
      + phase,
  );
  const crossWave = Math.sin(
    (normalizedY * TAU * 2.16)
      - (advectedX * TAU * 0.54)
      - (timeSeconds * 0.12)
      + (phase * 0.63),
  );
  const fineWave = Math.sin(
    ((advectedX + normalizedY) * TAU * 3.1)
      + (timeSeconds * 0.23)
      - (phase * 0.31),
  );
  const motion = mix(1, 0.24, presentation.pondStillness * 0.78);
  return {
    cross: ((crossWave * 0.68) + (fineWave * 0.32)) * motion,
    height: ((longWave * 0.56) + (crossWave * 0.31) + (fineWave * 0.13)) * motion,
  };
}

function withAlpha(color, alpha) {
  const value = typeof color === 'string' ? color.trim() : '';
  const shortHex = value.match(/^#([\da-f])([\da-f])([\da-f])$/iu);
  if (shortHex) {
    const [, r, g, b] = shortHex;
    return `rgb(${Number.parseInt(`${r}${r}`, 16)} ${Number.parseInt(`${g}${g}`, 16)} ${Number.parseInt(`${b}${b}`, 16)} / ${alpha})`;
  }
  const fullHex = value.match(/^#([\da-f]{2})([\da-f]{2})([\da-f]{2})$/iu);
  if (fullHex) {
    return `rgb(${Number.parseInt(fullHex[1], 16)} ${Number.parseInt(fullHex[2], 16)} ${Number.parseInt(fullHex[3], 16)} / ${alpha})`;
  }
  if (/^rgb\([^/]+\)$/iu.test(value)) {
    return value.replace(/\)$/u, ` / ${alpha})`);
  }
  throw new Error(`ZEN_LANDING_POND_ALPHA_COLOR_INVALID:${value}`);
}

function midpoint(left, right) {
  return {
    x: (left.x + right.x) * 0.5,
    y: (left.y + right.y) * 0.5,
  };
}

function traceSmoothLine(ctx, points) {
  if (points.length < 2) return;
  ctx.beginPath();
  ctx.moveTo(points[0].x, points[0].y);
  for (let index = 1; index < points.length - 1; index += 1) {
    const middle = midpoint(points[index], points[index + 1]);
    ctx.quadraticCurveTo(points[index].x, points[index].y, middle.x, middle.y);
  }
  const last = points[points.length - 1];
  ctx.lineTo(last.x, last.y);
}

function withPondClip(ctx, frame, draw) {
  const waterTop = frame.height * WATER_TOP_RATIO;
  ctx.save();
  ctx.beginPath();
  ctx.rect(0, waterTop, frame.width, frame.height - waterTop);
  ctx.clip();
  draw(waterTop, frame.height - waterTop);
  ctx.restore();
}

function drawWaterBase(ctx, frame) {
  const { height, presentation, width } = frame;
  const { palette, state } = presentation;
  const waterTop = height * WATER_TOP_RATIO;
  const daylight = state.environment.daylight;
  const night = state.environment.nightDepth;
  const recovery = presentation.gardenRecovery;
  const [waterDepth, waterMid, waterSurface] = palette.waterSpectrum;
  const gradient = ctx.createLinearGradient(0, waterTop, 0, height);
  gradient.addColorStop(0, 'rgb(255 255 255 / 0)');
  gradient.addColorStop(0.065, withAlpha(waterSurface, 0.24 + (daylight * 0.12)));
  gradient.addColorStop(0.24, withAlpha(waterSurface, 0.72 + (recovery * 0.1)));
  gradient.addColorStop(0.62, withAlpha(waterMid, 0.9 + (night * 0.06)));
  gradient.addColorStop(1, withAlpha(waterDepth, 0.96 + (night * 0.04)));
  ctx.fillStyle = gradient;
  ctx.fillRect(0, waterTop, width, height - waterTop);

  const mineralWash = ctx.createLinearGradient(0, waterTop, width, height);
  mineralWash.addColorStop(0, withAlpha(palette.bankNear, 0.035 + (recovery * 0.02)));
  mineralWash.addColorStop(0.46, withAlpha(palette.bankRear, 0.018));
  mineralWash.addColorStop(1, withAlpha(waterDepth, 0.07 + (night * 0.1)));
  ctx.fillStyle = mineralWash;
  ctx.fillRect(0, waterTop, width, height - waterTop);

  const reflectedSky = ctx.createLinearGradient(0, waterTop, 0, waterTop + (height * 0.2));
  reflectedSky.addColorStop(0, withAlpha(palette.paper, 0.12 + (daylight * 0.11)));
  reflectedSky.addColorStop(0.34, withAlpha(palette.skyBottom, 0.045 + (daylight * 0.04)));
  reflectedSky.addColorStop(1, withAlpha(waterMid, 0));
  ctx.fillStyle = reflectedSky;
  ctx.fillRect(0, waterTop, width, height * 0.22);
}

function drawBenthicField(ctx, frame) {
  const { height, presentation, width } = frame;
  const daylight = presentation.state.environment.daylight;
  const night = presentation.state.environment.nightDepth;
  const recovery = presentation.gardenRecovery;
  const visibility = clamp01(0.34 + (daylight * 0.34) + (recovery * 0.26) - (night * 0.16));
  const tones = [
    [presentation.palette.bankNear, presentation.palette.bankRear],
    [presentation.palette.bankRear, presentation.palette.waterSpectrum[0]],
    [presentation.palette.paper, presentation.palette.bankNear],
  ];

  withPondClip(ctx, frame, () => {
    for (const patch of ZEN_LANDING_BENTHIC_PATCHES) {
      const field = resolveSurfaceField(frame, patch.x, patch.y, patch.rotation);
      const x = (patch.x * width) + (field.cross * width * 0.0028);
      const y = (patch.y * height) + (field.height * height * 0.0022);
      const radiusX = patch.radiusX * width;
      const radiusY = patch.radiusY * height;
      const [centerColor, edgeColor] = tones[patch.tone];
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(patch.rotation);
      ctx.scale(radiusX, radiusY);
      const patchGradient = ctx.createRadialGradient(-0.18, -0.12, 0.04, 0, 0, 1);
      patchGradient.addColorStop(0, withAlpha(centerColor, visibility * patch.opacity * 0.26));
      patchGradient.addColorStop(0.58, withAlpha(edgeColor, visibility * patch.opacity * 0.16));
      patchGradient.addColorStop(1, withAlpha(edgeColor, 0));
      ctx.fillStyle = patchGradient;
      ctx.fillRect(-1, -1, 2, 2);
      ctx.restore();
    }

    ctx.fillStyle = withAlpha(presentation.palette.bankNear, visibility * 0.11);
    for (const grain of ZEN_LANDING_BENTHIC_GRAINS) {
      const field = resolveSurfaceField(frame, grain.x, grain.y, grain.x * TAU);
      ctx.globalAlpha = grain.opacity;
      ctx.beginPath();
      ctx.ellipse(
        (grain.x * width) + (field.cross * width * 0.0019),
        (grain.y * height) + (field.height * height * 0.0015),
        grain.radius,
        grain.radius * 0.55,
        grain.x * 2.4,
        0,
        TAU,
      );
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  });
}

function drawCausticField(ctx, frame) {
  const { height, presentation, timeSeconds, width } = frame;
  const daylight = presentation.state.environment.daylight;
  const night = presentation.state.environment.nightDepth;
  const recovery = presentation.gardenRecovery;
  const visibility = clamp01(0.18 + (daylight * 0.52) + (recovery * 0.22) - (night * 0.24));
  if (visibility <= 0.001) return;

  withPondClip(ctx, frame, () => {
    ctx.save();
    ctx.globalCompositeOperation = 'screen';
    ctx.lineCap = 'round';
    for (const ribbon of ZEN_LANDING_CAUSTIC_RIBBONS) {
      const field = resolveSurfaceField(frame, ribbon.x, ribbon.y, ribbon.phase);
      const phase = ribbon.phase + (timeSeconds * ribbon.cadence * 0.12);
      const pulse = 0.56 + (Math.sin(phase) * 0.18) + (field.height * 0.12);
      const depth = clamp01((ribbon.y - WATER_TOP_RATIO) / (1 - WATER_TOP_RATIO));
      const depthFade = mix(1, 0.44, depth);
      const alpha = visibility * ribbon.intensity * depthFade * clamp01(pulse) * 0.13;
      const length = ribbon.length * width;
      const x = (ribbon.x * width) + (field.cross * width * 0.005);
      const y = (ribbon.y * height) + (field.height * height * 0.004);
      const bend = ribbon.bend * length * 0.18;

      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(ribbon.rotation + (field.cross * 0.035));
      ctx.strokeStyle = `rgb(238 225 179 / ${alpha})`;
      ctx.lineWidth = ribbon.weight * 2.35;
      ctx.beginPath();
      ctx.moveTo(-length * 0.5, 0);
      ctx.bezierCurveTo(
        -length * 0.18,
        bend,
        length * 0.16,
        -bend * 0.72,
        length * 0.5,
        field.height * 1.8,
      );
      ctx.stroke();

      ctx.strokeStyle = `rgb(255 246 213 / ${alpha * 0.72})`;
      ctx.lineWidth = Math.max(0.42, ribbon.weight * 0.56);
      ctx.beginPath();
      ctx.moveTo(-length * 0.46, 0.3);
      ctx.bezierCurveTo(
        -length * 0.16,
        bend * 0.82,
        length * 0.17,
        -bend * 0.6,
        length * 0.47,
        field.height,
      );
      ctx.stroke();
      ctx.restore();
    }
    ctx.restore();
  });
}

function drawRefractionBands(ctx, frame) {
  const { height, presentation, timeSeconds, width } = frame;
  const daylight = presentation.state.environment.daylight;
  const night = presentation.state.environment.nightDepth;
  const presence = clamp01(0.34 + (daylight * 0.24) + (night * 0.12));

  withPondClip(ctx, frame, () => {
    ctx.save();
    ctx.lineCap = 'round';
    for (const band of ZEN_LANDING_REFRACTION_BANDS) {
      const points = [];
      for (let index = 0; index <= 8; index += 1) {
        const normalizedX = index / 8;
        const field = resolveSurfaceField(frame, normalizedX, band.y, band.phase);
        points.push({
          x: normalizedX * width,
          y: (band.y * height)
            + (field.height * height * band.amplitude)
            + (Math.sin((normalizedX * TAU * 1.4) + band.phase + (timeSeconds * band.cadence * 0.08)) * 1.8),
        });
      }
      ctx.globalCompositeOperation = band.polarity > 0 ? 'screen' : 'multiply';
      ctx.strokeStyle = band.polarity > 0
        ? `rgb(177 196 169 / ${presence * band.opacity * 0.025})`
        : `rgb(18 45 45 / ${presence * band.opacity * 0.045})`;
      ctx.lineWidth = band.width;
      traceSmoothLine(ctx, points);
      ctx.stroke();
    }
    ctx.restore();
  });
}

function drawDepthFalloff(ctx, frame) {
  const { height, presentation, width } = frame;
  const night = presentation.state.environment.nightDepth;
  const [waterDepth] = presentation.palette.waterSpectrum;
  withPondClip(ctx, frame, (waterTop, pondHeight) => {
    ctx.save();
    ctx.translate(width * 0.51, waterTop + (pondHeight * 0.47));
    ctx.scale(width * 0.62, pondHeight * 0.72);
    const falloff = ctx.createRadialGradient(0, -0.05, 0.08, 0, 0, 1);
    falloff.addColorStop(0, withAlpha(waterDepth, 0));
    falloff.addColorStop(0.56, withAlpha(waterDepth, 0.025));
    falloff.addColorStop(0.82, withAlpha(waterDepth, 0.12 + (night * 0.08)));
    falloff.addColorStop(1, withAlpha(waterDepth, 0.3 + (night * 0.18)));
    ctx.fillStyle = falloff;
    ctx.fillRect(-1.35, -1.35, 2.7, 2.7);
    ctx.restore();
  });
}

function drawYoonseul(ctx, frame) {
  const { height, presentation, timeSeconds, width } = frame;
  const { state } = presentation;
  const daylight = state.environment.daylight;
  const warmth = state.environment.warmth;
  const pressure = presentation.scrollPressure;
  const stillness = presentation.pondStillness;
  const sheen = clamp01(0.12 + (daylight * 0.62) + (warmth * 0.2));

  withPondClip(ctx, frame, () => {
    ctx.lineCap = 'round';
    for (const thread of ZEN_LANDING_WATER_THREADS) {
      const phase = (timeSeconds * 0.2 * thread.cadence) + thread.phase;
      const shimmer = mix(
        0.28 + (0.5 + (Math.sin(phase) * 0.5)) * 0.72,
        0.42,
        stillness * 0.72,
      );
      const windShift = state.wind.x * state.wind.strength * width * 0.012;
      const pressureShift = Math.sin(phase * 0.63) * pressure * width * 0.006;
      const x = (thread.x * width) + windShift + pressureShift;
      const y = (thread.y * height)
        + (Math.sin(phase * 0.48) * thread.amplitude * mix(1, 0.28, stillness));
      const length = thread.length * width;
      const bend = (thread.tilt + (state.wind.x * 0.06)) * length;
      ctx.strokeStyle = `rgb(231 224 197 / ${sheen * shimmer * 0.2})`;
      ctx.lineWidth = 0.45 + (thread.weight * 0.42);
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.quadraticCurveTo(
        x + (length * 0.5),
        y + bend + (Math.sin(phase) * thread.amplitude),
        x + length,
        y + (bend * 0.34),
      );
      ctx.stroke();
    }
  });
}

function buildKoiGeometry(scale, tailPhase) {
  const length = 76 * scale;
  const halfWidth = 8.6 * scale;
  const points = [];
  const pointCount = 13;

  for (let index = 0; index < pointCount; index += 1) {
    const progress = index / (pointCount - 1);
    const rearWave = Math.sin(tailPhase + (progress * Math.PI * 1.72));
    const waveAmount = halfWidth * 0.34 * (progress ** 1.72);
    points.push({
      x: length * (0.49 - (progress * 0.98)),
      y: rearWave * waveAmount,
      progress,
      angle: 0,
    });
  }

  const bodySize = halfWidth / 0.85;
  for (let index = 0; index < points.length; index += 1) {
    const previous = points[Math.max(0, index - 1)];
    const next = points[Math.min(points.length - 1, index + 1)];
    const dx = next.x - previous.x;
    const dy = next.y - previous.y;
    const magnitude = Math.max(0.001, Math.hypot(dx, dy));
    const progress = points[index].progress;
    points[index].tangentX = dx / magnitude;
    points[index].tangentY = dy / magnitude;
    points[index].normalX = -dy / magnitude;
    points[index].normalY = dx / magnitude;
    points[index].radius = resolveKoiBodyRadius(progress, bodySize);
    points[index].angle = Math.atan2(-dy, -dx);
  }

  const contour = buildKoiBodyContour({ history: points, size: bodySize });
  const appendages = buildCanonicalKoiAppendageGeometry({
    history: points,
    size: bodySize,
    finAngleOffset: Math.sin(tailPhase) * 0.055,
  });
  return {
    appendages,
    contour,
    halfWidth,
    length,
    points,
  };
}

function traceCanonicalKoiBody(ctx, geometry) {
  ctx.beginPath();
  traceKoiBodyContourPath(ctx, geometry.contour);
}

function traceCanonicalKoiAppendage(ctx, geometry) {
  ctx.beginPath();
  traceKoiAppendagePath(ctx, geometry);
}

function drawKoiPattern(ctx, geometry, pattern, palette) {
  traceCanonicalKoiBody(ctx, geometry);
  ctx.save();
  ctx.clip();
  for (const patch of pattern) {
    const pointIndex = Math.min(
      geometry.points.length - 1,
      Math.max(0, Math.round(patch.at * (geometry.points.length - 1))),
    );
    const point = geometry.points[pointIndex];
    const centerX = point.x + (point.normalX * point.radius * patch.side);
    const centerY = point.y + (point.normalY * point.radius * patch.side);
    ctx.save();
    ctx.translate(centerX, centerY);
    ctx.rotate(Math.atan2(point.tangentY, point.tangentX) + patch.rotation);
    if (patch.colorRole === 'secondary' && !palette.secondary) {
      throw new Error('ZEN_LANDING_KOI_SECONDARY_COLOR_REQUIRED');
    }
    ctx.fillStyle = patch.colorRole === 'secondary' ? palette.secondary : palette.pattern;
    ctx.beginPath();
    ctx.ellipse(
      0,
      0,
      geometry.length * patch.length,
      point.radius * patch.width,
      0,
      0,
      TAU,
    );
    ctx.fill();
    ctx.restore();
  }
  ctx.restore();
}

function drawKoiAtPose(ctx, {
  angle,
  depth,
  finPhase,
  opacity,
  palette,
  pattern,
  scale,
  x,
  y,
}, geometry) {
  if (opacity <= 0.001) return null;

  const depthAmount = clamp01(depth);
  const shadowOffset = (4.5 + (depthAmount * 8)) * scale;
  ctx.save();
  ctx.translate(x + (shadowOffset * 0.42), y + shadowOffset);
  ctx.rotate(angle);
  ctx.globalAlpha = opacity * mix(0.16, 0.075, depthAmount);
  ctx.fillStyle = 'rgb(2 10 13)';
  ctx.filter = `blur(${mix(1.6, 4.2, depthAmount) * scale}px)`;
  traceCanonicalKoiBody(ctx, geometry);
  ctx.fill();
  ctx.restore();

  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  ctx.globalAlpha = opacity * mix(1, 0.82, depthAmount);

  const tailGradient = ctx.createLinearGradient(
    -geometry.length * 0.3,
    0,
    -geometry.length * 0.7,
    0,
  );
  tailGradient.addColorStop(0, withAlpha(palette.fin, 0.62));
  tailGradient.addColorStop(0.56, withAlpha(palette.fin, 0.36));
  tailGradient.addColorStop(1, withAlpha(palette.fin, 0.08));
  ctx.fillStyle = tailGradient;
  traceCanonicalKoiAppendage(ctx, geometry.appendages.tail);
  ctx.fill();

  const finAlpha = 0.38 + (Math.sin(finPhase) * 0.055);
  ctx.fillStyle = withAlpha(palette.fin, finAlpha);
  for (const fin of geometry.appendages.fins) {
    traceCanonicalKoiAppendage(ctx, fin);
    ctx.fill();
  }

  const bodyGradient = ctx.createLinearGradient(
    geometry.length * 0.48,
    0,
    -geometry.length * 0.46,
    0,
  );
  bodyGradient.addColorStop(0, palette.highlight);
  bodyGradient.addColorStop(0.3, palette.body);
  bodyGradient.addColorStop(1, palette.shade);
  ctx.fillStyle = bodyGradient;
  traceCanonicalKoiBody(ctx, geometry);
  ctx.fill();
  drawKoiPattern(ctx, geometry, pattern, palette);

  traceCanonicalKoiBody(ctx, geometry);
  ctx.save();
  ctx.clip();
  const volumeGradient = ctx.createLinearGradient(
    0,
    -geometry.halfWidth * 1.2,
    0,
    geometry.halfWidth * 1.2,
  );
  volumeGradient.addColorStop(0, withAlpha(palette.shade, 0.32));
  volumeGradient.addColorStop(0.34, 'rgb(255 250 226 / 0.09)');
  volumeGradient.addColorStop(0.5, 'rgb(255 250 226 / 0.16)');
  volumeGradient.addColorStop(0.68, 'rgb(255 250 226 / 0.035)');
  volumeGradient.addColorStop(1, withAlpha(palette.shade, 0.38));
  ctx.fillStyle = volumeGradient;
  ctx.fillRect(
    -geometry.length * 0.56,
    -geometry.halfWidth * 1.35,
    geometry.length * 1.12,
    geometry.halfWidth * 2.7,
  );
  ctx.restore();

  traceCanonicalKoiBody(ctx, geometry);
  ctx.strokeStyle = withAlpha(palette.shade, 0.24);
  ctx.lineWidth = Math.max(0.45, scale * 0.7);
  ctx.stroke();

  const highlightPoints = geometry.points.slice(0, 7).map((point) => ({
    x: point.x + (point.normalX * point.radius * 0.43),
    y: point.y + (point.normalY * point.radius * 0.43),
  }));
  traceSmoothLine(ctx, highlightPoints);
  ctx.strokeStyle = 'rgb(244 235 208 / 0.22)';
  ctx.lineWidth = Math.max(0.65, scale * 1.2);
  ctx.lineCap = 'round';
  ctx.stroke();

  const gill = geometry.points[2];
  ctx.beginPath();
  ctx.moveTo(
    gill.x + (gill.normalX * gill.radius * 0.68),
    gill.y + (gill.normalY * gill.radius * 0.68),
  );
  ctx.quadraticCurveTo(
    gill.x - (gill.tangentX * geometry.length * 0.018),
    gill.y - (gill.tangentY * geometry.length * 0.018),
    gill.x - (gill.normalX * gill.radius * 0.68),
    gill.y - (gill.normalY * gill.radius * 0.68),
  );
  ctx.strokeStyle = withAlpha(palette.shade, 0.24);
  ctx.lineWidth = Math.max(0.42, scale * 0.58);
  ctx.stroke();

  const head = geometry.points[0];
  const eyeX = head.x + (head.tangentX * geometry.length * 0.045);
  const eyeY = head.y + (head.tangentY * geometry.length * 0.045);
  ctx.fillStyle = palette.accent;
  for (const side of [-1, 1]) {
    ctx.beginPath();
    ctx.arc(
      eyeX + (head.normalX * head.radius * side * 0.5),
      eyeY + (head.normalY * head.radius * side * 0.5),
      Math.max(0.72, scale * 1.05),
      0,
      TAU,
    );
    ctx.fill();
  }
  ctx.restore();
  return geometry;
}

function projectLocalPoint(pose, point) {
  const cos = Math.cos(pose.angle);
  const sin = Math.sin(pose.angle);
  return {
    x: pose.x + (point.x * cos) - (point.y * sin),
    y: pose.y + (point.x * sin) + (point.y * cos),
  };
}

function drawKoiWake(ctx, frame, pose, geometry, strength) {
  if (!geometry || strength <= 0.001) return;
  const tail = projectLocalPoint(pose, geometry.points[geometry.points.length - 1]);
  const wakeScale = Math.max(8, geometry.length * 0.18);
  const pressure = frame.presentation.scrollPressure;
  ctx.save();
  ctx.translate(tail.x, tail.y);
  ctx.rotate(pose.angle);
  ctx.strokeStyle = `rgb(224 219 193 / ${strength * (0.11 + (pressure * 0.05))})`;
  ctx.lineCap = 'round';
  for (let index = 0; index < 2; index += 1) {
    const distance = wakeScale * (1.2 + (index * 0.82));
    const spread = wakeScale * (0.38 + (index * 0.24));
    ctx.lineWidth = Math.max(0.42, 0.82 - (index * 0.18));
    ctx.beginPath();
    ctx.moveTo(-distance * 0.08, 0);
    ctx.quadraticCurveTo(-distance * 0.54, -spread, -distance, -spread * 0.76);
    ctx.moveTo(-distance * 0.08, 0);
    ctx.quadraticCurveTo(-distance * 0.54, spread, -distance, spread * 0.76);
    ctx.stroke();
  }
  ctx.restore();
}

const GARDEN_KOI_REVEAL_THRESHOLDS = Object.freeze([0.04, 0.34, 0.64]);

function resolveGardenKoiPose(koi, index, frame) {
  const { height, presentation, timeSeconds, width } = frame;
  const pressure = presentation.scrollPressure;
  const phase = (timeSeconds * koi.speed * (0.14 + (pressure * 0.024))) + koi.phase;
  const wanderPhase = (phase * 0.43) + (koi.phase * 1.7);
  const orbitX = koi.orbitX * width;
  const orbitY = koi.orbitY * height;
  const wanderAmount = mix(0.15, 0.06, koi.glide);
  const localX = (Math.cos(phase) * orbitX)
    + (Math.cos(wanderPhase) * orbitX * wanderAmount);
  const localY = (Math.sin(phase) * orbitY)
    + (Math.sin(wanderPhase * 0.83) * orbitY * wanderAmount);
  const localDx = (-Math.sin(phase) * orbitX)
    - (Math.sin(wanderPhase) * orbitX * wanderAmount * 0.43);
  const localDy = (Math.cos(phase) * orbitY)
    + (Math.cos(wanderPhase * 0.83) * orbitY * wanderAmount * 0.357);
  const orbitCos = Math.cos(koi.orbitTilt);
  const orbitSin = Math.sin(koi.orbitTilt);
  const x = (koi.x * width) + (localX * orbitCos) - (localY * orbitSin);
  const y = (koi.y * height) + (localX * orbitSin) + (localY * orbitCos);
  const dx = (localDx * orbitCos) - (localDy * orbitSin);
  const dy = (localDx * orbitSin) + (localDy * orbitCos);
  const tailPhase = (timeSeconds * mix(1.2, 0.92, koi.glide))
    + (phase * 1.7)
    + koi.phase;
  const surfaceField = resolveSurfaceField(frame, x / width, y / height, koi.phase);
  const depth = clamp01(koi.depth
    + (Math.sin(wanderPhase * 0.62) * 0.045)
    + (surfaceField.height * 0.015));
  const reveal = smoothstep(
    (presentation.gardenKoiProgress - GARDEN_KOI_REVEAL_THRESHOLDS[index]) / 0.2,
  );
  return {
    angle: Math.atan2(dy, dx) + (Math.sin(tailPhase * 0.22) * 0.012),
    depth,
    finPhase: tailPhase + (index * 0.8),
    opacity: reveal
      * (0.56 + (presentation.gardenRecovery * 0.26)),
    palette: koi.palette,
    pattern: koi.pattern,
    scale: koi.scale * Math.min(1.2, Math.max(0.72, width / 1100)),
    tailPhase,
    wake: koi.wake * (0.84 + (Math.sin(tailPhase * 0.54) * 0.1)),
    x: x + (surfaceField.cross * 1.4),
    y: y + (surfaceField.height * 1.2),
  };
}

function drawGardenKoi(ctx, frame) {
  const poses = ZEN_LANDING_KOI.map((koi, index) => resolveGardenKoiPose(koi, index, frame));
  const geometries = poses.map((pose) => buildKoiGeometry(pose.scale, pose.tailPhase));
  withPondClip(ctx, frame, () => {
    for (let index = 0; index < poses.length; index += 1) {
      const pose = poses[index];
      drawKoiWake(
        ctx,
        frame,
        pose,
        geometries[index],
        pose.opacity * pose.wake * mix(1, 0.24, pose.depth),
      );
    }
    for (let index = 0; index < poses.length; index += 1) {
      drawKoiAtPose(ctx, poses[index], geometries[index]);
    }
  });
}

function drawSurfaceGlaze(ctx, frame) {
  const { height, presentation, width } = frame;
  const daylight = presentation.state.environment.daylight;
  const night = presentation.state.environment.nightDepth;
  const [waterDepth, waterMid, waterSurface] = presentation.palette.waterSpectrum;
  withPondClip(ctx, frame, (waterTop, pondHeight) => {
    const glaze = ctx.createLinearGradient(0, waterTop, 0, waterTop + pondHeight);
    glaze.addColorStop(0, withAlpha(presentation.palette.paper, 0.03 + (daylight * 0.03)));
    glaze.addColorStop(0.38, withAlpha(waterSurface, 0.018));
    glaze.addColorStop(0.72, withAlpha(waterMid, 0.022 + (night * 0.014)));
    glaze.addColorStop(1, withAlpha(waterDepth, 0.032 + (night * 0.025)));
    ctx.fillStyle = glaze;
    ctx.fillRect(0, waterTop, width, pondHeight);

    ctx.save();
    ctx.globalCompositeOperation = 'screen';
    ctx.translate(width * 0.33, waterTop + (pondHeight * 0.28));
    ctx.scale(width * 0.46, pondHeight * 0.32);
    const lens = ctx.createRadialGradient(0, 0, 0.04, 0, 0, 1);
    lens.addColorStop(0, withAlpha(presentation.palette.paper, 0.04 + (daylight * 0.035)));
    lens.addColorStop(0.64, withAlpha(waterSurface, 0.014));
    lens.addColorStop(1, withAlpha(waterSurface, 0));
    ctx.fillStyle = lens;
    ctx.fillRect(-1, -1, 2, 2);
    ctx.restore();
  });
}

function drawPetals(ctx, frame) {
  const { height, presentation, timeSeconds, width } = frame;
  const presence = presentation.petalPresence * (0.72 + (presentation.gardenRecovery * 0.28));
  if (presence <= 0.001) return;

  const wind = presentation.state.motionMode === 'reduced'
    ? STILL_WIND
    : presentation.state.wind;
  for (const petal of ZEN_LANDING_PETALS) {
    const reveal = clamp01((presence * 1.5) - petal.delay);
    if (reveal <= 0.001) continue;
    const phase = petal.phase + (timeSeconds * petal.drift * 0.11);
    const x = (petal.x * width) + (Math.sin(phase) * 8) + (wind.x * wind.strength * 16);
    const y = (petal.y * height) + (Math.cos(phase * 0.8) * 4);
    const scale = petal.scale * Math.min(1.25, Math.max(0.82, width / 900));

    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(petal.rotation + (Math.sin(phase) * 0.2));
    ctx.scale(scale, scale);
    ctx.globalAlpha = reveal * 0.5;
    ctx.fillStyle = 'rgb(235 187 181)';
    ctx.beginPath();
    ctx.moveTo(0, -5);
    ctx.bezierCurveTo(7, -4, 8, 3, 0, 7);
    ctx.bezierCurveTo(-7, 3, -6, -3, 0, -5);
    ctx.fill();
    ctx.restore();
  }
}

export function renderZenLandingPond(ctx, frame) {
  ctx.clearRect(0, 0, frame.width, frame.height);
  drawWaterBase(ctx, frame);
  drawBenthicField(ctx, frame);
  drawCausticField(ctx, frame);
  drawRefractionBands(ctx, frame);
  drawDepthFalloff(ctx, frame);
  drawGardenKoi(ctx, frame);
  drawSurfaceGlaze(ctx, frame);
  drawYoonseul(ctx, frame);
  drawPetals(ctx, frame);
}
