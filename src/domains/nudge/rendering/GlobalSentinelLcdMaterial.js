import { strokeGlobalSentinelGlassCrack } from './GlobalSentinelGlassStroke.js';
import { resolveGlobalSentinelImpactBleedContour } from './globalSentinelFractureGeometry.js';
import { GLOBAL_SENTINEL_ENTRY_FAULT_CUES, resolveGlobalSentinelSimulationPolicy } from '../nudge/nudgeGameGlobalSentinelProtocol.js';
import { resolveGlobalSentinelPanelFault } from '../nudge/nudgeGameGlobalSentinelEntryFaults.js';
// Screen-space material derived from the canonical fracture skeleton. Panel
// clipping boundaries may extend them; physical glass never adds such segments.
const TAU = Math.PI * 2;
const clamp = (value) => Math.max(0, Math.min(1, value));
const cache = new WeakMap();
const RGB = ['#ff426e', '#75f8b1', '#5dbbff'];
const DEFAULT_FRACTURE_THRESHOLD = resolveGlobalSentinelSimulationPolicy(null).fractureThreshold;
// Material proportions, not a second gameplay threshold. Actual accepted
// damage is normalized by the protocol policy supplied by the engine.
const INNER_ARREST_RATIO = 0.25 / DEFAULT_FRACTURE_THRESHOLD;
const noise = (key) => {
  const value = Math.sin(key * 12.9898 + 78.233) * 43758.5453;
  return value - Math.floor(value);
};
const angleAt = (point, origin) => (Math.atan2(point[1] - origin[1], point[0] - origin[0]) + TAU) % TAU;
const freezePoints = (points) => Object.freeze(points.map(point => Object.freeze(point)));

function measurePolyline(points) {
  const distances = [0];
  for (let index = 1; index < points.length; index += 1) {
    distances.push(distances.at(-1) + Math.hypot(
      points[index][0] - points[index - 1][0], points[index][1] - points[index - 1][1],
    ));
  }
  return Object.freeze(distances);
}

function extentAtDistance(distances, distance) {
  if (distance >= distances.at(-1)) return distances.length - 1;
  for (let index = 1; index < distances.length; index += 1) {
    const length = distances[index] - distances[index - 1];
    if (length > 0 && distance < distances[index]) {
      return index - 1 + Math.max(0, distance - distances[index - 1]) / length;
    }
  }
  return distances.length - 1;
}

const smooth = value => { const t = clamp(value); return t * t * (3 - 2 * t); };

function retainedRayDistance(ray, load) {
  const inner = clamp(load / INNER_ARREST_RATIO);
  const pressure = clamp((load - INNER_ARREST_RATIO) / (1 - INNER_ARREST_RATIO));
  const innerDistance = ray.distances[1]
    + (ray.distances[2] - ray.distances[1]) * ray.innerFraction;
  let distance = innerDistance * inner;
  let previous = innerDistance;
  // A brittle front releases one fixed stress interval, then arrests. Stress
  // thresholds vary by path; the existing fracture scalar remains the owner.
  for (const knot of ray.distances.slice(2)) {
    if (knot <= previous) continue;
    const distributedStart = ray.releaseOffset
      + (previous - innerDistance) / (ray.distances.at(-1) - innerDistance) * (0.88 - ray.releaseOffset);
    // The outermost run stays loaded through the second act. The final
    // accepted act releases it; earlier local intervals may already be spent.
    const reachesEdge = ray.distances.at(-1) - knot < 0.001;
    const start = reachesEdge ? Math.max(0.78, distributedStart) : distributedStart;
    distance += (knot - previous) * smooth((pressure - start) / 0.085);
    previous = knot;
  }
  return distance;
}

function trace(ctx, points, close = false) {
  ctx.beginPath();
  points.forEach((point, index) => index === 0 ? ctx.moveTo(...point) : ctx.lineTo(...point));
  if (close) ctx.closePath();
}

function extendToEdge(points, width, height) {
  const origin = points[0];
  const last = points.at(-1);
  const dx = last[0] - origin[0];
  const dy = last[1] - origin[1];
  const tx = dx > 0 ? (width - origin[0]) / dx : dx < 0 ? -origin[0] / dx : Infinity;
  const ty = dy > 0 ? (height - origin[1]) / dy : dy < 0 ? -origin[1] / dy : Infinity;
  const t = Math.min(tx, ty);
  return [...points, [origin[0] + dx * t, origin[1] + dy * t]];
}

export function resolveGlobalSentinelLcdFracturePlan(skeleton, width, height) {
  if (!skeleton?.primaryPaths?.length || !Array.isArray(skeleton.branchPaths) || !(width > 0 && height > 0)) {
    throw new Error('GLOBAL_SENTINEL_LCD_SKELETON_AND_BOUNDS_REQUIRED');
  }
  const saved = cache.get(skeleton);
  if (saved?.width === width && saved?.height === height) return saved;
  const origin = Object.freeze([skeleton.impactPoint[0] * width, skeleton.impactPoint[1] * height]);
  const seed = skeleton.renderSeed * 0.0191;
  const rays = skeleton.primaryPaths.map((path, pathIndex) => {
    const points = path.points.map(([x, y]) => [x * width, y * height]);
    if (!(points.length >= 3) || points.some(point => !point.every(Number.isFinite))) {
      throw new Error('GLOBAL_SENTINEL_GLASS_PRIMARY_INVALID');
    }
    if (!(Math.hypot(points[1][0] - points[0][0], points[1][1] - points[0][1]) > 0)) {
      throw new Error('GLOBAL_SENTINEL_GLASS_IMPACT_SEGMENT_INVALID');
    }
    return Object.freeze({ points: freezePoints(points), distances: measurePolyline(points),
      angle: angleAt(points.at(-1), origin), pathIndex,
      innerFraction: 0.38 + noise(seed + pathIndex * 43) * 0.24,
      releaseOffset: 0.035 + noise(seed + pathIndex * 59) * 0.12 });
  }).sort((a, b) => a.angle - b.angle);
  const branches = skeleton.branchPaths.map(path => {
    const source = skeleton.primaryPaths[path.sourcePathIndex];
    const sourcePointIndex = source?.points.indexOf(path.points[0]);
    const sourceRayIndex = rays.findIndex(ray => ray.pathIndex === path.sourcePathIndex);
    if (!(sourcePointIndex > 0 && sourcePointIndex < source.points.length - 1) || sourceRayIndex < 0) {
      throw new Error('GLOBAL_SENTINEL_GLASS_BRANCH_ATTACHMENT_INVALID');
    }
    const points = freezePoints(path.points.map(([x, y]) => [x * width, y * height]));
    return Object.freeze({ points, distances: measurePolyline(points),
      sourceRayIndex, sourcePathIndex: path.sourcePathIndex, sourcePointIndex });
  });
  const corners = [[width, height], [0, height], [0, 0], [width, 0]];
  const panels = rays.map((ray, index) => {
    const next = rays[(index + 1) % rays.length];
    const span = (next.angle - ray.angle + TAU) % TAU;
    const between = corners.map(point => ({ point, offset: (angleAt(point, origin) - ray.angle + TAU) % TAU }))
      .filter(corner => corner.offset > 0 && corner.offset < span).sort((a, b) => a.offset - b.offset);
    // Every edge is either an existing fracture, its collinear extension, or a
    // viewport edge. Transparent survivors reveal the actual page in place.
    return Object.freeze({
      index,
      key: seed + index * 113,
      points: freezePoints([...extendToEdge(ray.points, width, height),
        ...between.map(corner => corner.point), ...extendToEdge(next.points, width, height).reverse()]),
      anchor: ray.points[1],
    });
  });
  // Glass sectors and electrical address banks are different layers. Even a
  // three-ray crack needs several independent failures, with live page islands
  // surviving until the last blow. These splits never add a new glass line.
  const zones = panels.flatMap(panel => {
    const axis = noise(panel.key + 57) > 0.5 ? 0 : 1;
    const low = Math.min(...panel.points.map(p => p[axis]));
    const high = Math.max(...panel.points.map(p => p[axis]));
    const count = noise(panel.key + 97) > 0.5 ? 3 : 2;
    return Array.from({ length: count }, (_, index) => ({
      ...panel,
      clipRect: Object.freeze(axis === 0
        ? [low + (high - low) * index / count, 0, (high - low) / count, height]
        : [0, low + (high - low) * index / count, width, (high - low) / count]),
    }));
  });
  const zoneOrder = zones.map((_, index) => index).sort((a, b) => noise(seed + a * 139) - noise(seed + b * 139));
  const faultZones = Object.freeze(zones.map((zone, index) => Object.freeze({
    ...zone, index,
    cueIndex: zoneOrder.indexOf(index) % GLOBAL_SENTINEL_ENTRY_FAULT_CUES.length,
    overdrive: zoneOrder.indexOf(index) < GLOBAL_SENTINEL_ENTRY_FAULT_CUES.length && noise(seed + index * 31) > 0.4,
  })));
  const plan = Object.freeze({ width, height, origin, seed, renderSeed: skeleton.renderSeed,
    impactPoint: skeleton.impactPoint, rays: Object.freeze(rays), branches: Object.freeze(branches), panels: Object.freeze(panels),
    faultZones });
  cache.set(skeleton, plan);
  return plan;
}

// No per-frame random positions. Both passes use the same clipped driver
// pattern; only its exposure changes as a sector loses power.
function drawDrivers(ctx, plan, panel, budget, strength, entry, fault = null) {
  const { width, height } = plan;
  // Driver detail is a scene-wide budget, shared by the frozen glass panels.
  // More fracture directions must not multiply the declared render work.
  const count = Math.max(1, Math.floor(budget.fractureDriverColumns / plan.panels.length));
  const rows = Math.max(1, Math.floor(budget.fractureDriverRows / plan.panels.length));
  ctx.lineWidth = entry ? 0.85 : 0.65;
  for (let channel = 0; channel < 3; channel += 1) {
    ctx.beginPath();
    for (let column = 0; column < count; column += 1) {
      const key = panel.key + column * 23;
      if (fault && fault.age < 0 && column % 11 !== 0) continue;
      if (fault && fault.age >= 0 && fault.age < 310 && (column + Math.floor(fault.age / 43)) % 7 === 0) continue;
      // Dense ribbon islands alternate with long areas of unlit liquid crystal.
      const group = noise(panel.key + Math.floor(column / 9) * 71);
      if (group < (entry ? 0.3 : 0.67)) continue;
      const groupIndex = Math.floor(column / 12);
      const groupX = groupIndex === 0 ? panel.anchor[0] : noise(panel.key + groupIndex * 47) * width;
      const sourceX = column % 4 === 0
        ? noise(key) * width
        : groupX + (column % 12) * (1.8 + group * 2.4);
      const x = Math.floor(sourceX) + channel + (fault?.jitter || 0) * (column % 9 === 0 ? 11 : 0);
      ctx.moveTo(x, 0);
      ctx.lineTo(x, height);
      if (entry && group > 0.76) {
        ctx.moveTo(x + 4, 0);
        ctx.lineTo(x + 4, height);
      }
    }
    ctx.strokeStyle = RGB[channel];
    ctx.globalAlpha = strength * (entry ? 0.85 : 0.33);
    ctx.stroke();
  }
  ctx.beginPath();
  for (let row = 0; row < rows; row += 1) {
    const y = Math.floor((row + noise(panel.key + row * 13)) / rows * height);
    ctx.moveTo(0, y);
    ctx.lineTo(width, y);
  }
  ctx.lineWidth = 0.6;
  ctx.strokeStyle = entry ? '#a6c0ea' : '#3f7992';
  ctx.globalAlpha = strength * (entry ? 0.3 : 0.08);
  ctx.stroke();
  // A stuck source-driver ribbon carries visibly separate subpixels. Clipping
  // terminates each column exactly against the irregular fracture boundary.
  const x = Math.round(panel.anchor[0]);
  const ribbon = entry ? 12 : 5;
  for (let column = 0; column < ribbon; column += 1) {
    ctx.globalAlpha = strength * (0.24 + noise(panel.key + column * 3) * 0.65);
    ctx.fillStyle = RGB[column % 3];
    ctx.fillRect(x + column * 2, 0, column % 4 === 0 ? 1.7 : 0.7, height);
  }
}

function drawImpactBleed(ctx, plan, damage, alpha) {
  const points = resolveGlobalSentinelImpactBleedContour({
    seed: plan.renderSeed, impactPoint: plan.impactPoint,
    width: plan.width, height: plan.height, damage,
  });
  ctx.save();
  trace(ctx, points, true);
  ctx.lineWidth = 3;
  ctx.strokeStyle = '#9765ad';
  ctx.globalAlpha = alpha * 0.2;
  ctx.stroke();
  ctx.fillStyle = '#080e18';
  ctx.globalAlpha = alpha;
  ctx.fill();
  ctx.restore();
}

// Entry and restored LCD consume this same projected glass, optical material
// and scene-wide detail allowance. This pass owns every physical crack stroke.
export function drawGlobalSentinelGlassFracture(ctx, plan, budget, strength, surface) {
  if (!plan || !budget || !Array.isArray(surface?.rays) || !Array.isArray(surface.branches)
    || surface.rays.length !== plan.rays.length || surface.branches.length !== plan.branches.length
    || surface.rays.some((ray, index) => ray.pathIndex !== plan.rays[index].pathIndex)) {
    throw new Error('GLOBAL_SENTINEL_GLASS_SURFACE_REQUIRED');
  }
  ctx.save();
  const primarySegments = plan.rays.reduce((sum, ray) => sum + ray.points.length - 1, 0);
  const totalSegments = primarySegments + plan.branches.reduce((sum, branch) => sum + branch.points.length - 1, 0);
  // Attached branches share the existing primary glass sample allowance. The
  // LCD driver/fault budget and the electrical address banks are unchanged.
  const glassSteps = budget.fractureBloomEnabled
    ? Math.max(1, Math.floor(primarySegments * 8 / totalSegments)) : 1;
  for (let index = 0; index < plan.rays.length; index += 1) {
    const primary = plan.rays[index].pathIndex < 3;
    strokeGlobalSentinelGlassCrack(ctx, surface.rays[index].points, {
      alpha: strength * (primary ? 0.82 : 0.58),
      baseWidth: Math.max(0.9, Math.min(plan.width, plan.height) * (primary ? 0.0022 : 0.0012)),
      maxStepsPerSegment: glassSteps,
    });
  }
  for (const branch of surface.branches) {
    if (branch.extent <= 0.001) continue;
    strokeGlobalSentinelGlassCrack(ctx, branch.points, {
      alpha: strength * 0.5,
      baseWidth: Math.max(0.5, Math.min(plan.width, plan.height) * 0.00075),
      maxStepsPerSegment: glassSteps,
    });
  }
  ctx.restore();
}

function drawElectricalFractureEdges(ctx, plan, budget, strength) {
  ctx.save();
  for (let index = 0; index < plan.rays.length; index += 1) {
    const points = plan.rays[index].points;
    ctx.globalCompositeOperation = 'lighter';
    trace(ctx, points);
    ctx.globalAlpha = strength * 0.14;
    ctx.strokeStyle = '#659bff';
    ctx.lineWidth = budget.fractureBloomEnabled ? 5 : 1.8;
    ctx.stroke();
    ctx.globalAlpha = strength * 0.88;
    ctx.strokeStyle = '#d8f3ff';
    ctx.lineWidth = 0.8;
    ctx.stroke();
    ctx.beginPath();
    const fullPoints = plan.rays[index].points;
    for (let segment = 1; segment < points.length; segment += 1) {
      const a = fullPoints[segment - 1];
      const b = fullPoints[segment];
      const steps = Math.min(Math.ceil(budget.fractureMicroRays * 0.42), Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) / 13));
      for (let step = 0; step < steps; step += 1) {
        const t = (step + noise(plan.seed + segment * 31 + step * 7)) / steps;
        const x = a[0] + (b[0] - a[0]) * t;
        const y = a[1] + (b[1] - a[1]) * t;
        ctx.moveTo(x, y - 1);
        ctx.lineTo(x, y + 2 + step % 3);
      }
    }
    ctx.strokeStyle = RGB[index % 3];
    ctx.globalAlpha = strength * 0.76;
    ctx.lineWidth = 0.75;
    ctx.stroke();
  }
  ctx.restore();
}

export function drawGlobalSentinelLcdCollapse(ctx, plan, budget, timeline, reducedMotion = false) {
  if (!plan || !budget) throw new Error('GLOBAL_SENTINEL_LCD_MATERIAL_PLAN_AND_BUDGET_REQUIRED');
  const { signalKick, elapsedMs } = timeline;
  for (const panel of plan.faultZones) {
    const fault = resolveGlobalSentinelPanelFault(elapsedMs, panel.cueIndex, panel.key, reducedMotion);
    if (!fault.active) continue;
    ctx.save();
    trace(ctx, panel.points, true);
    ctx.clip();
    ctx.beginPath();
    ctx.rect(...panel.clipRect);
    ctx.clip();
    ctx.fillStyle = panel.index % 3 === 1 ? '#0a1020' : '#03060b';
    ctx.globalAlpha = fault.dead ? 1 : 0;
    ctx.fillRect(0, 0, plan.width, plan.height);
    // One overdriven pale panel, with other pieces retaining the live page.
    if (panel.overdrive && fault.flash > 0) {
      ctx.fillStyle = '#d2e3e9';
      ctx.globalAlpha = fault.flash;
      ctx.fillRect(0, 0, plan.width, plan.height);
    }
    const energy = fault.driver;
    if (panel.index % 3 === 0 && energy > 0.01) {
      const top = plan.height * (0.48 + noise(panel.key + 79) * 0.25);
      const bandHeight = plan.height * 0.17;
      const backlight = ctx.createLinearGradient(0, top, 0, top + bandHeight);
      backlight.addColorStop(0, 'rgba(178,208,242,0)');
      backlight.addColorStop(0.62, 'rgba(215,230,191,0.24)');
      backlight.addColorStop(0.88, 'rgba(242,249,204,0.7)');
      backlight.addColorStop(1, 'rgba(193,217,228,0.08)');
      ctx.globalAlpha = energy;
      ctx.fillStyle = backlight;
      ctx.fillRect(0, top, plan.width, bandHeight);
      ctx.beginPath();
      for (let row = 0; row < budget.fractureDriverRows; row += 1) {
        const y = top + row / budget.fractureDriverRows * bandHeight;
        ctx.moveTo(0, y);
        ctx.lineTo(plan.width, y);
      }
      ctx.strokeStyle = '#060b19';
      ctx.lineWidth = 1;
      ctx.globalAlpha = energy * 0.76;
      ctx.stroke();
    }
    drawDrivers(ctx, plan, panel, budget, energy, true, fault);
    // A torn row jumps independently of the glass contour. Alive sectors
    // remain transparent, so the real page survives between latched failures.
    if (fault.jitter !== 0) {
      const y = Math.round(plan.height * noise(panel.key + 211));
      ctx.globalAlpha = 0.88;
      ctx.fillStyle = '#050710';
      ctx.fillRect(0, y, plan.width, 6 + panel.index % 4 * 3);
      ctx.fillStyle = RGB[panel.index % 3];
      ctx.fillRect(plan.width * noise(panel.key + 43) + fault.jitter * 17, y - 2, plan.width * 0.46, 1);
    }
    ctx.restore();
  }
  drawImpactBleed(ctx, plan, 0.5, signalKick * 0.9);
  const currentCue = GLOBAL_SENTINEL_ENTRY_FAULT_CUES.find(cue => elapsedMs >= cue && elapsedMs < cue + 125);
  const edgeEnergy = currentCue === undefined || reducedMotion ? 0.24 : 0.88;
  drawElectricalFractureEdges(ctx, plan, budget, signalKick * edgeEnergy);
}

function revealPolyline(points, extent) {
  const whole = Math.min(points.length - 1, Math.floor(extent));
  const visible = points.slice(0, whole + 1);
  if (whole < points.length - 1) {
    const from = points[whole];
    const to = points[whole + 1];
    const part = extent - whole;
    visible.push([from[0] + (to[0] - from[0]) * part, from[1] + (to[1] - from[1]) * part]);
  }
  return visible;
}

// One fixed network survives both sides of the power cut. Rewind reveals a
// shorter prefix of the same paths; it never scales or regenerates their points.
function requireLcdDamageAndPolicy(damage, fractureThreshold) {
  if (!Number.isFinite(damage) || !Number.isFinite(fractureThreshold) || fractureThreshold <= 0 || fractureThreshold > 1) {
    throw new Error('GLOBAL_SENTINEL_LCD_DAMAGE_AND_POLICY_REQUIRED');
  }
}

export function resolveGlobalSentinelLcdSurfaceState(plan, { damage, fractureThreshold = DEFAULT_FRACTURE_THRESHOLD, recovery = 1, rupture = null }) {
  requireLcdDamageAndPolicy(damage, fractureThreshold);
  if (rupture?.mode === 'rupture' && !Number.isFinite(rupture.displayFracture)) {
    throw new Error('GLOBAL_SENTINEL_LCD_RUPTURE_FRACTURE_REQUIRED');
  }
  if (rupture?.mode === 'rupture' && (!Number.isInteger(rupture.site?.pathIndex)
    || !plan.rays.some(ray => ray.pathIndex === rupture.site.pathIndex)
    || !Number.isFinite(rupture.fractureBefore) || !Number.isFinite(rupture.fractureAfter)
    || !Number.isFinite(rupture.growth))) {
    throw new Error('GLOBAL_SENTINEL_LCD_RUPTURE_SITE_AND_STRESS_REQUIRED');
  }
  const visibleDamage = rupture?.mode === 'rupture' ? rupture.displayFracture : damage;
  const load = clamp(visibleDamage / fractureThreshold);
  const growth = clamp((load - INNER_ARREST_RATIO) / (1 - INNER_ARREST_RATIO));
  const rewind = clamp(recovery);
  // Dynamic glass fracture is faster than a presented frame. The accepted
  // load selects arrested lengths; neither age nor angular rank grows tips.
  // Canonical miss repair and the explicit giant sweep still own healing.
  const rays = plan.rays.map(ray => {
    const retained = retainedRayDistance(ray, load);
    const distance = ray.distances.at(-1) + (retained - ray.distances.at(-1)) * rewind;
    const extent = extentAtDistance(ray.distances, distance);
    return { pathIndex: ray.pathIndex, extent, distance, growth,
      points: revealPolyline(ray.points, extent) };
  });
  return {
    growth,
    faultStrength: (1 - rewind) + rewind * growth,
    rewinding: rewind > 0 && rewind < 1,
    rays,
    branches: plan.branches.map(branch => {
      const parent = rays[branch.sourceRayIndex];
      const source = plan.rays[branch.sourceRayIndex];
      const sourceDistance = source.distances[branch.sourcePointIndex];
      const attachment = clamp((parent.distance - sourceDistance) / (source.distances.at(-1) - sourceDistance));
      const extent = extentAtDistance(branch.distances, branch.distances.at(-1) * attachment);
      return { extent, sourceRayIndex: branch.sourceRayIndex, sourcePointIndex: branch.sourcePointIndex,
        points: revealPolyline(branch.points, extent) };
    }),
  };
}

export function drawGlobalSentinelLcdDamage(ctx, plan, budget, { damage, fractureThreshold = DEFAULT_FRACTURE_THRESHOLD, opacity = 1, impact = 0, recovery = 1, recoveryFront = null, rupture = null }) {
  requireLcdDamageAndPolicy(damage, fractureThreshold);
  if (damage <= 0.001 || opacity <= 0.001) return;
  if (Number.isFinite(recoveryFront)) {
    // The head has already restored backlight. Only the measured tail seals
    // these fixed glass paths, revealing a retained prefix behind the body.
    const front = Math.max(0, Math.min(plan.width, recoveryFront));
    const regions = [];
    for (const [left, width, repaired] of [[0, front, 1], [front, plan.width - front, 0]]) {
      if (width <= 0) continue;
      ctx.save();
      ctx.beginPath();
      ctx.rect(left, 0, width, plan.height);
      ctx.clip();
      const surface = drawGlobalSentinelLcdDamage(ctx, plan, budget, { damage, fractureThreshold, opacity, impact, recovery: repaired, rupture });
      regions.push({ left, width, surface });
      ctx.restore();
    }
    if (front > 0 && front < plan.width) {
      // A narrow sealing band marks the glass ownership boundary at the tail.
      // Both networks remain fixed; no blurred/scaled replacement is rendered.
      const feather = Math.max(10, Math.min(24, plan.width * 0.014));
      const light = ctx.createLinearGradient(front - feather, 0, front + feather, 0);
      light.addColorStop(0, 'rgba(242,248,251,0)');
      light.addColorStop(0.5, 'rgba(242,248,251,0.68)');
      light.addColorStop(1, 'rgba(242,248,251,0)');
      ctx.save();
      ctx.globalAlpha = opacity;
      ctx.fillStyle = light;
      ctx.fillRect(front - feather, 0, feather * 2, plan.height);
      ctx.restore();
    }
    // A completed recovery owns one whole-screen prefix. During the moving
    // entry sweep both clipped regions remain explicit; no repair act may
    // substitute one of them as its whole-screen front.
    return regions.length === 1 ? regions[0].surface : { recoveryFront: front, regions };
  }
  const surface = resolveGlobalSentinelLcdSurfaceState(plan, { damage, fractureThreshold, recovery, rupture });
  const presence = clamp(damage / (fractureThreshold * INNER_ARREST_RATIO)) * opacity;
  for (const panel of plan.panels) {
    const severity = ((1 - clamp(recovery)) + clamp(recovery) * surface.rays[panel.index].growth)
      * (0.64 + noise(panel.key) * 0.36);
    if (severity <= 0.001) continue;
    ctx.save();
    trace(ctx, panel.points, true);
    ctx.clip();
    // Keep the entry's exact source-driver columns, confined to small dark
    // islands. White LCD does not receive a second set of pastel screen rails.
    const bandWidth = 2 + Math.min(plan.width, plan.height) * 0.006 * severity;
    const span = plan.height * (0.045 + severity * 0.2);
    const top = panel.anchor[1] - (panel.index % 2 ? span * 0.8 : span * 0.2);
    ctx.beginPath();
    ctx.rect(panel.anchor[0] - 1, top, bandWidth, span);
    ctx.clip();
    ctx.globalAlpha = opacity * Math.sqrt(severity) * 0.96;
    ctx.fillStyle = '#08111c';
    ctx.fillRect(0, 0, plan.width, plan.height);
    drawDrivers(ctx, plan, panel, budget, opacity * severity, true);
    ctx.restore();
  }
  drawGlobalSentinelGlassFracture(ctx, plan, budget, opacity, surface);
  // The original liquid-crystal pocket stays on its canonical contour without
  // burying the fine glass branches beneath an opaque apparent glass hole.
  drawImpactBleed(ctx, plan, 0.4, presence * 0.62);
  return surface;
}
