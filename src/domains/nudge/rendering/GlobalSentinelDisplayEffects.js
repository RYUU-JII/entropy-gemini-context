const TAU = Math.PI * 2;

function clamp(value, min, max) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return min;
  return Math.max(min, Math.min(max, numeric));
}

function unit(value) {
  return clamp(value, 0, 1);
}

function finite(value, fallback = 0) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : fallback;
}

function seededUnit(index, seed = 0) {
  const stableSeed = Math.max(0, Math.round(finite(seed)));
  const x = finite(index) + stableSeed * 0.000173;
  const wave = Math.sin(x * 12.9898 + 78.233 + stableSeed * 0.01991) * 43758.5453;
  return wave - Math.floor(wave);
}

function resolveBounds(bounds = null) {
  return {
    width: Math.max(1, finite(bounds?.width, 1)),
    height: Math.max(1, finite(bounds?.height, 1)),
  };
}

function normalizePoint(point, fallback) {
  const source = Array.isArray(point)
    ? { x: point[0], y: point[1] }
    : (point && typeof point === 'object' ? point : null);
  if (!source || !Number.isFinite(Number(source.x)) || !Number.isFinite(Number(source.y))) {
    return fallback;
  }
  return [clamp(source.x, 0.02, 0.98), clamp(source.y, 0.02, 0.98)];
}

function readStageUnit(stageProfile, key, fallback) {
  const value = stageProfile && typeof stageProfile === 'object' ? stageProfile[key] : undefined;
  return Number.isFinite(Number(value)) ? unit(value) : unit(fallback);
}

function rgba(red, green, blue, alpha) {
  return `rgba(${red}, ${green}, ${blue}, ${unit(alpha)})`;
}

// The engine exposes a quadratic-ish decaying remainder. Recovering its age
// here gives each hit a sharp snap, a short RGB slice, then a settling crater.
export function resolveGlobalSentinelImpactTimeline({
  impact = 0,
  impactStrength = 0,
} = {}) {
  const remaining = unit(impact);
  const strength = Math.max(remaining, unit(impactStrength));
  if (remaining <= 0.0001 || strength <= 0.0001) {
    return Object.freeze({
      active: false,
      bloom: 0,
      crater: 0,
      progress: 1,
      remaining: 0,
      slice: 0,
      snap: 0,
      spall: 0,
      strength,
    });
  }

  const envelope = unit(remaining / strength);
  const progress = unit(1 - (envelope ** (1 / 2.6)));
  const snap = unit((1 - progress / 0.28) * envelope);
  const slice = unit((1 - progress / 0.7) * (0.7 + envelope * 0.3));
  const bloom = unit((1 - progress / 0.88) * (0.45 + strength * 0.55));
  const crater = unit(Math.min(1, progress / 0.13) * (1 - progress * 0.34));
  const spall = unit(Math.min(1, progress / 0.1) * (1 - Math.max(0, progress - 0.48) / 0.5));
  return Object.freeze({
    active: true,
    bloom,
    crater,
    progress,
    remaining,
    slice,
    snap,
    spall,
    strength,
  });
}

function resolveDisplayState(options = {}) {
  const fracture = unit(options.fracture);
  const syncPressure = unit(options.syncPressure);
  const terminalBanish = unit(options.terminalBanish);
  const terminalResync = unit(options.terminalResync);
  const stageProfile = options.stageProfile;
  const profile = options.renderBudget?.globalDisplay;
  if (!profile) {
    throw new Error('GLOBAL_SENTINEL_DISPLAY_RENDER_BUDGET_REQUIRED');
  }
  const terminalFade = unit(1 - terminalResync * 0.9 - (terminalBanish ** 3) * 0.58);
  const damage = unit((fracture + terminalBanish * 0.22) * (1 - terminalResync * 0.96));
  const originPoint = normalizePoint(options.originPoint, [0.52, 0.54]);
  const impactPoint = normalizePoint(options.impactPoint, originPoint);
  return {
    damage,
    detail: readStageUnit(stageProfile, 'lineDefect', damage),
    aperture: readStageUnit(stageProfile, 'aperture', damage),
    chip: readStageUnit(stageProfile, 'chip', damage),
    fracture,
    impactPoint,
    impactSerial: Math.max(0, Math.round(finite(options.impactSerial))),
    originPoint,
    profile,
    seed: Math.max(0, Math.round(finite(options.seed))),
    syncPressure,
    terminalBanish,
    terminalFade,
    terminalResync,
    timeMs: finite(options.timeMs),
    timeline: resolveGlobalSentinelImpactTimeline(options),
  };
}

function drawAmbientMicroTears(ctx, width, height, state) {
  const presence = state.terminalFade * (0.04 + state.detail * 0.14 + state.syncPressure * 0.025);
  if (presence <= 0.001) return;
  const count = state.profile.microTears;
  const pulse = 0.82 + Math.sin(state.timeMs * 0.007) * 0.18;
  ctx.save();
  ctx.globalAlpha = presence * pulse;
  ctx.lineCap = 'square';
  ctx.lineWidth = 0.9;
  ctx.strokeStyle = 'rgba(18, 27, 38, 0.82)';
  // These seed-stable linelets are LCD row defects, never crack skeleton paths.
  for (let index = 0; index < count; index += 1) {
    const x = width * (0.05 + seededUnit(index * 31 + 3, state.seed) * 0.9);
    const y = height * (0.07 + seededUnit(index * 37 + 5, state.seed) * 0.86);
    const length = Math.max(5, width * (0.006 + seededUnit(index * 41 + 7, state.seed) * 0.018));
    const vertical = seededUnit(index * 43 + 11, state.seed) > 0.82;
    ctx.beginPath();
    ctx.moveTo(x, y);
    if (vertical) {
      ctx.lineTo(x + 0.6, y + length * 0.38);
      ctx.lineTo(x - 0.4, y + length);
    } else {
      ctx.lineTo(x + length * 0.46, y + (index % 2 ? 1 : -1));
      ctx.lineTo(x + length, y + 0.35);
    }
    ctx.stroke();
  }
  ctx.restore();
}

function drawPolarizerBruise(ctx, width, height, state) {
  if (state.damage <= 0.012) return;
  const minSide = Math.min(width, height);
  const x = state.originPoint[0] * width;
  const y = state.originPoint[1] * height;
  const impactLift = state.timeline.crater * 0.28;
  const radius = minSide * (0.085 + state.damage * 0.2 + impactLift * 0.035);
  const alpha = state.terminalFade * (0.085 + state.damage * 0.28 + impactLift * 0.1);
  ctx.save();
  ctx.globalCompositeOperation = 'multiply';
  const bruise = ctx.createRadialGradient(x, y, radius * 0.04, x, y, radius);
  bruise.addColorStop(0, rgba(9, 13, 20, alpha));
  bruise.addColorStop(0.22, rgba(78, 37, 92, alpha * 0.82));
  bruise.addColorStop(0.48, rgba(17, 105, 117, alpha * 0.62));
  bruise.addColorStop(0.72, rgba(172, 111, 45, alpha * 0.34));
  bruise.addColorStop(1, 'rgba(24, 32, 42, 0)');
  ctx.fillStyle = bruise;
  ctx.fillRect(x - radius, y - radius, radius * 2, radius * 2);
  ctx.globalAlpha = state.terminalFade * (0.36 + state.damage * 0.34);
  ctx.fillStyle = '#10131f';
  ctx.beginPath();
  const coreRadius = radius * (0.13 + state.damage * 0.16);
  const lobes = Array.from({ length: 18 }, (_, index) => {
    const angle = index / 18 * TAU;
    const reach = coreRadius * (0.68 + seededUnit(index * 47 + 251, state.seed) * 0.58);
    return [x + Math.cos(angle) * reach * 1.3, y + Math.sin(angle) * reach * 0.68];
  });
  const first = lobes[0];
  const last = lobes[lobes.length - 1];
  ctx.moveTo((first[0] + last[0]) / 2, (first[1] + last[1]) / 2);
  for (let index = 0; index < lobes.length; index += 1) {
    const point = lobes[index];
    const next = lobes[(index + 1) % lobes.length];
    ctx.quadraticCurveTo(point[0], point[1], (point[0] + next[0]) / 2, (point[1] + next[1]) / 2);
  }
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

function drawDeadCells(ctx, width, height, state) {
  const presence = state.terminalFade * state.damage * (0.25 + state.detail * 0.75);
  if (presence <= 0.006) return;
  const minSide = Math.min(width, height);
  const originX = state.originPoint[0] * width;
  const originY = state.originPoint[1] * height;
  const spread = minSide * (0.045 + state.damage * 0.18);
  const count = Math.max(2, Math.round(state.profile.deadCells * (0.35 + state.detail * 0.65)));
  ctx.save();
  ctx.globalAlpha = Math.min(0.72, 0.2 + presence * 0.62);
  for (let index = 0; index < count; index += 1) {
    const angle = seededUnit(index * 47 + 13, state.seed) * TAU;
    const radius = spread * Math.sqrt(seededUnit(index * 53 + 17, state.seed));
    const x = originX + Math.cos(angle) * radius;
    const y = originY + Math.sin(angle) * radius * 0.64;
    const size = state.profile.deadCellLargeEvery > 0
      && index % state.profile.deadCellLargeEvery === 0
      ? 3
      : (state.profile.deadCellMediumEvery > 0
        && index % state.profile.deadCellMediumEvery === 0 ? 2 : 1);
    const color = seededUnit(index * 59 + 19, state.seed);
    ctx.fillStyle = color > 0.9
      ? 'rgba(20, 214, 225, 0.8)'
      : (color < 0.08 ? 'rgba(244, 70, 92, 0.78)' : 'rgba(19, 25, 33, 0.88)');
    ctx.fillRect(Math.round(x), Math.round(y), size, Math.max(1, size * 0.62));
  }
  ctx.restore();
}

function drawBacklightSnap(ctx, width, height, state) {
  const { timeline } = state;
  if (!timeline.active || timeline.bloom <= 0.002) return;
  const minSide = Math.min(width, height);
  const x = state.impactPoint[0] * width;
  const y = state.impactPoint[1] * height;
  const radius = minSide * (0.07 + timeline.progress * 0.2 + timeline.strength * 0.035);
  ctx.save();
  ctx.globalCompositeOperation = 'screen';
  const bloom = ctx.createRadialGradient(x, y, 0, x, y, radius);
  bloom.addColorStop(0, rgba(255, 255, 255, timeline.bloom * 0.8));
  bloom.addColorStop(0.18, rgba(187, 235, 255, timeline.bloom * 0.42));
  bloom.addColorStop(0.52, rgba(255, 107, 139, timeline.snap * 0.13));
  bloom.addColorStop(1, 'rgba(255, 255, 255, 0)');
  ctx.fillStyle = bloom;
  ctx.fillRect(x - radius, y - radius, radius * 2, radius * 2);
  ctx.restore();
}

function drawRgbSlice(ctx, width, height, state) {
  const { timeline } = state;
  if (!timeline.active || timeline.slice <= 0.002) return;
  const x = state.impactPoint[0] * width;
  const y = state.impactPoint[1] * height;
  const phase = seededUnit(state.impactSerial * 67 + 23, state.seed) * 2 - 1;
  const rows = state.profile.rgbSliceRows;
  const span = width * (0.15 + timeline.strength * 0.2);
  ctx.save();
  for (let index = 0; index < rows; index += 1) {
    const rowY = y + (index - (rows - 1) / 2) * 4.5 + phase * 2;
    const heightPx = Math.max(1, 1.4 + timeline.snap * 2.6 - index * 0.16);
    const alpha = timeline.slice * (0.26 - index * 0.025);
    ctx.globalCompositeOperation = 'source-over';
    ctx.fillStyle = rgba(12, 17, 25, alpha * 0.44);
    ctx.fillRect(x - span * 0.5 + phase * 7, rowY, span, heightPx * 0.8);
    ctx.globalCompositeOperation = 'screen';
    ctx.fillStyle = rgba(255, 47, 91, alpha);
    ctx.fillRect(x - span * 0.52 - 3, rowY - 1, span, heightPx);
    ctx.fillStyle = rgba(54, 222, 255, alpha * 1.12);
    ctx.fillRect(x - span * 0.48 + 3, rowY + 1, span, heightPx);
    ctx.fillStyle = rgba(255, 255, 255, alpha * 0.7);
    ctx.fillRect(x - span * 0.5, rowY, span, Math.max(1, heightPx * 0.38));
  }
  ctx.restore();
}

function drawCrater(ctx, width, height, point, state, energy, transient = false) {
  if (energy <= 0.004) return;
  const minSide = Math.min(width, height);
  const x = point[0] * width;
  const y = point[1] * height;
  const base = minSide * ((transient ? 0.016 : 0.013) + energy * (transient ? 0.035 : 0.026));
  const rings = state.profile.craterRings;
  ctx.save();
  ctx.globalCompositeOperation = transient ? 'screen' : 'source-over';
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  if (state.profile.shadowsEnabled) {
    ctx.shadowColor = transient ? 'rgba(196, 238, 255, 0.62)' : 'rgba(9, 14, 21, 0.32)';
    ctx.shadowBlur = Math.max(3, base * (transient ? 0.5 : 0.24));
  }
  for (let index = 0; index < rings; index += 1) {
    const scale = 1 + index * 0.34;
    ctx.globalAlpha = state.terminalFade * energy * (transient ? 0.82 : 0.94) * (1 - index * 0.18);
    ctx.strokeStyle = transient ? 'rgba(240, 251, 255, 0.94)' : 'rgba(32, 39, 49, 0.82)';
    ctx.lineWidth = Math.max(0.75, base * (0.105 - index * 0.014));
    ctx.beginPath();
    ctx.ellipse(x, y, base * scale, base * scale * (0.72 + index * 0.04), -0.13, 0, TAU);
    ctx.stroke();
  }
  ctx.restore();
}

function drawMicroSpall(ctx, width, height, state) {
  const { timeline } = state;
  const energy = timeline.spall * state.terminalFade;
  if (!timeline.active || energy <= 0.004) return;
  const minSide = Math.min(width, height);
  const x = state.impactPoint[0] * width;
  const y = state.impactPoint[1] * height;
  const count = Math.max(2, Math.round(state.profile.spall * (0.45 + timeline.strength * 0.55)));
  ctx.save();
  ctx.globalCompositeOperation = 'source-over';
  ctx.globalAlpha = energy * 0.78;
  ctx.fillStyle = 'rgba(16, 22, 31, 0.82)';
  ctx.strokeStyle = 'rgba(92, 200, 222, 0.76)';
  ctx.lineWidth = 0.8;
  for (let index = 0; index < count; index += 1) {
    const key = state.impactSerial * 131 + index * 17;
    const angle = seededUnit(key + 29, state.seed) * TAU;
    const travel = minSide * (0.018 + seededUnit(key + 31, state.seed) * 0.055) * (0.55 + timeline.progress);
    const size = Math.max(1.2, minSide * (0.0015 + seededUnit(key + 37, state.seed) * 0.0028));
    const px = x + Math.cos(angle) * travel;
    const py = y + Math.sin(angle) * travel * 0.76;
    ctx.beginPath();
    ctx.moveTo(px + Math.cos(angle) * size, py + Math.sin(angle) * size);
    ctx.lineTo(px + Math.cos(angle + 2.3) * size, py + Math.sin(angle + 2.3) * size);
    ctx.lineTo(px + Math.cos(angle - 2.15) * size, py + Math.sin(angle - 2.15) * size);
    ctx.closePath();
    ctx.fill();
    if (state.profile.spallStrokeEnabled) ctx.stroke();
  }
  ctx.restore();
}

function normalizeFrontSegment(segment) {
  if (!segment || typeof segment !== 'object') return null;
  const from = normalizePoint(segment.from, null);
  const to = normalizePoint(segment.to, null);
  if (!from || !to) return null;
  return {
    from,
    kind: typeof segment.kind === 'string' ? segment.kind : 'primary',
    to,
    width: clamp(segment.width, 0.2, 4),
  };
}

function drawPropagationFronts(ctx, width, height, state, frontSegments) {
  const segments = Array.isArray(frontSegments)
    ? frontSegments.map(normalizeFrontSegment).filter(Boolean)
    : [];
  if (segments.length === 0) return;
  const stress = state.terminalFade * unit(
    0.34 + state.timeline.remaining * 0.72 + state.aperture * 0.3 + state.terminalBanish * 0.22,
  );
  ctx.save();
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  for (let index = 0; index < segments.length; index += 1) {
    const segment = segments[index];
    const fromX = segment.from[0] * width;
    const fromY = segment.from[1] * height;
    const toX = segment.to[0] * width;
    const toY = segment.to[1] * height;
    const branch = segment.kind === 'branch' || segment.kind === 'micro';
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = state.terminalFade * unit(
      0.3 + state.damage * 0.38 + state.timeline.remaining * 0.2,
    );
    ctx.strokeStyle = branch ? 'rgba(20, 50, 61, 0.9)' : 'rgba(13, 18, 27, 0.94)';
    ctx.lineWidth = Math.max(1.45, segment.width * 2.25);
    ctx.beginPath();
    ctx.moveTo(fromX, fromY);
    ctx.lineTo(toX, toY);
    ctx.stroke();
    ctx.globalCompositeOperation = 'screen';
    if (state.profile.shadowsEnabled) {
      ctx.globalAlpha = stress * 0.34;
      ctx.strokeStyle = branch ? 'rgba(85, 218, 255, 0.72)' : 'rgba(255, 92, 134, 0.68)';
      ctx.lineWidth = Math.max(2, segment.width * 3.2);
      ctx.shadowColor = branch ? 'rgba(74, 211, 255, 0.9)' : 'rgba(255, 103, 142, 0.86)';
      ctx.shadowBlur = state.profile.frontShadowBlur;
      ctx.beginPath();
      ctx.moveTo(fromX, fromY);
      ctx.lineTo(toX, toY);
      ctx.stroke();
    }
    ctx.globalAlpha = stress * (branch ? 0.74 : 0.9);
    ctx.strokeStyle = branch ? 'rgba(205, 248, 255, 0.96)' : 'rgba(255, 248, 250, 0.98)';
    ctx.lineWidth = Math.max(0.7, segment.width);
    ctx.beginPath();
    ctx.moveTo(fromX, fromY);
    ctx.lineTo(toX, toY);
    ctx.stroke();
    if (state.profile.frontEndpointEnabled) {
      ctx.beginPath();
      ctx.arc(toX, toY, Math.max(1.2, segment.width * 1.15), 0, TAU);
      ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
      ctx.fill();
    }
  }
  ctx.restore();
}

export function drawGlobalSentinelDisplayImpactBackground(ctx, bounds, options = {}) {
  if (!ctx) return false;
  const { width, height } = resolveBounds(bounds);
  const state = resolveDisplayState(options);
  drawBacklightSnap(ctx, width, height, state);
  drawPolarizerBruise(ctx, width, height, state);
  drawDeadCells(ctx, width, height, state);
  drawAmbientMicroTears(ctx, width, height, state);
  return true;
}

export function drawGlobalSentinelDisplayImpactForeground(ctx, bounds, options = {}) {
  if (!ctx) return false;
  const { width, height } = resolveBounds(bounds);
  const state = resolveDisplayState(options);
  drawRgbSlice(ctx, width, height, state);
  // The canonical origin is textured by the fracture material web. Only a
  // fresh accepted hit gets a transient pressure ring at its own hit point.
  drawCrater(ctx, width, height, state.impactPoint, state, state.timeline.crater, true);
  drawMicroSpall(ctx, width, height, state);
  // No path is invented here: only the topology owner's active fronts glow.
  drawPropagationFronts(ctx, width, height, state, options.frontSegments);
  return true;
}
