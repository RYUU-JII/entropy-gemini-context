import {
  NUDGE_TERMINAL_SEQUENCE_MODES,
  resolveNudgeTerminalSequenceProgress,
} from '../nudge/nudgeGameTerminalSequence.js';
import {
  resolveGlobalSentinelEntryRuptureTimeline,
  resolveGlobalSentinelRiftApertureTimeline,
  GLOBAL_SENTINEL_TERMINAL_MA_MS,
} from '../nudge/nudgeGameGlobalSentinelProtocol.js';
import { strokeGlobalSentinelGlassCrack, drawGlobalSentinelPanelOutage } from './GlobalSentinelGlassMaterial.js';
import {
  resolveGlobalSentinelLcdFracturePlan, resolveGlobalSentinelLcdSurfaceState,
  drawGlobalSentinelLcdDamage, drawGlobalSentinelGlassFracture,
} from './GlobalSentinelLcdMaterial.js';
import { drawGlobalSentinelRepairMaterial } from './GlobalSentinelRepairMaterial.js';
import { drawZenSentinelRecoverySweep, resolveZenSentinelRecoverySurface } from './ZenSentinelRecoverySweep.js';
import { drawZenSentinelInvocation } from './ZenSentinelInvocation.js';
import {
  resolveDirectionDistributedPrimaryCracks,
  resolveGlobalSentinelImpactBleedContour,
} from './globalSentinelFractureGeometry.js';

function clamp(value, min, max) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return min;
  return Math.max(min, Math.min(max, numeric));
}

function resolveBounds(bounds = null) {
  return {
    width: Math.max(1, Number(bounds?.width) || 1),
    height: Math.max(1, Number(bounds?.height) || 1),
  };
}

function resolveSceneRenderBudget(renderBudget) {
  if (!renderBudget?.globalBackground || !renderBudget?.globalDisplay) {
    throw new Error('NUDGE_SCENE_RENDER_BUDGET_REQUIRED');
  }
  return renderBudget;
}

function seededUnit(index, seed = 0) {
  const normalizedSeed = Math.max(0, Math.round(Number(seed) || 0));
  const seededIndex = Number(index) + normalizedSeed * 0.000173;
  const value = Math.sin(seededIndex * 12.9898 + 78.233 + normalizedSeed * 0.01991) * 43758.5453;
  return value - Math.floor(value);
}

function resolveRenderSeed(seed = 0) {
  const numeric = Math.round(Number(seed));
  return Number.isFinite(numeric) && numeric > 0 ? numeric : 0;
}

function varyNumber(value, seed, key, amplitude, min = -Infinity, max = Infinity) {
  if (seed <= 0) return value;
  const variant = (seededUnit(key, seed) - 0.5) * amplitude;
  return clamp(value + variant, min, max);
}

function normalizeImpactPoint(point = null) {
  const source = Array.isArray(point)
    ? { x: point[0], y: point[1] }
    : (point && typeof point === 'object' ? point : null);
  if (point === null) return null;
  if (!source || (Array.isArray(point) && point.length !== 2)
    || !Number.isFinite(source.x) || source.x < 0 || source.x > 1
    || !Number.isFinite(source.y) || source.y < 0 || source.y > 1) {
    throw new Error('global_sentinel_fracture_origin_invalid');
  }
  return [source.x, source.y];
}

function resolveImpactPoint(seed, explicitPoint = null) {
  const normalized = normalizeImpactPoint(explicitPoint);
  if (normalized) return normalized;
  if (seed <= 0) return [0.54, 0.55];
  return [
    varyNumber(0.54, seed, 811, 0.05, 0.48, 0.6),
    varyNumber(0.55, seed, 823, 0.04, 0.49, 0.61),
  ];
}

export const GLOBAL_SIMULATION_BREAK_CRACK_ARCHETYPES = Object.freeze([
  'direction_distributed',
  'diagonal_spine',
  'center_spider',
  'edge_tear',
  'horizontal_lcd_split',
]);

const GLOBAL_SIMULATION_BREAK_SKELETON_CACHE_LIMIT = 24;
const globalSimulationBreakSkeletonCache = new Map();
const globalSentinelCompletedEntryPlanCache = new WeakMap();
const globalSentinelCompletedRiftPlanCache = new WeakMap();
const GLOBAL_SENTINEL_EMPTY_RENDER_POINTS = Object.freeze([]);
const GLOBAL_SENTINEL_COMPLETED_ENTRY_TIMELINE = resolveGlobalSentinelEntryRuptureTimeline(1);
const GLOBAL_SENTINEL_COMPLETED_RIFT_TIMELINE = resolveGlobalSentinelRiftApertureTimeline(1);

function normalizeCrackArchetype(archetype = null) {
  const normalized = String(archetype || '').trim();
  return GLOBAL_SIMULATION_BREAK_CRACK_ARCHETYPES.includes(normalized) ? normalized : '';
}

function resolveCrackArchetype(seed = 0, override = null) {
  if (override === null) return 'direction_distributed';
  const overrideArchetype = normalizeCrackArchetype(override);
  if (overrideArchetype) return overrideArchetype;
  throw new Error('global_sentinel_fracture_archetype_invalid');
}

function pointDistance(a, b) {
  return Math.hypot(Number(a?.[0]) - Number(b?.[0]), Number(a?.[1]) - Number(b?.[1]));
}

function clampPoint(point) {
  return [
    clamp(point?.[0], 0.015, 0.985),
    clamp(point?.[1], 0.015, 0.985),
  ];
}

function vectorFromAngle(angle) {
  return [Math.cos(angle), Math.sin(angle)];
}

function angleFromPoints(from, to) {
  return Math.atan2(Number(to?.[1]) - Number(from?.[1]), Number(to?.[0]) - Number(from?.[0]));
}

function normalizeAngle(angle) {
  let normalized = Number(angle) || 0;
  while (normalized <= -Math.PI) normalized += Math.PI * 2;
  while (normalized > Math.PI) normalized -= Math.PI * 2;
  return normalized;
}

function angleDelta(a, b) {
  return Math.abs(normalizeAngle(a - b));
}

function signedAngleDelta(from, to) {
  return normalizeAngle(to - from);
}

function mixAngles(from, to, toWeight = 0.5) {
  const weight = clamp(toWeight, 0, 1);
  const fromWeight = 1 - weight;
  const x = Math.cos(from) * fromWeight + Math.cos(to) * weight;
  const y = Math.sin(from) * fromWeight + Math.sin(to) * weight;
  if (Math.abs(x) < 0.000001 && Math.abs(y) < 0.000001) return normalizeAngle(to);
  return Math.atan2(y, x);
}

function pointToSegmentDistance(point, from, to) {
  const px = point[0];
  const py = point[1];
  const x1 = from[0];
  const y1 = from[1];
  const x2 = to[0];
  const y2 = to[1];
  const dx = x2 - x1;
  const dy = y2 - y1;
  const lenSq = dx * dx + dy * dy;
  if (lenSq <= 0.000001) return Math.hypot(px - x1, py - y1);
  const t = clamp(((px - x1) * dx + (py - y1) * dy) / lenSq, 0, 1);
  return Math.hypot(px - (x1 + dx * t), py - (y1 + dy * t));
}

function segmentOrientation(a, b, c) {
  return ((b[0] - a[0]) * (c[1] - a[1])) - ((b[1] - a[1]) * (c[0] - a[0]));
}

function segmentBoundsOverlap(a, b, c, d) {
  return Math.max(Math.min(a[0], b[0]), Math.min(c[0], d[0]))
    <= Math.min(Math.max(a[0], b[0]), Math.max(c[0], d[0])) + 0.00001
    && Math.max(Math.min(a[1], b[1]), Math.min(c[1], d[1]))
    <= Math.min(Math.max(a[1], b[1]), Math.max(c[1], d[1])) + 0.00001;
}

function segmentsIntersect(a, b, c, d) {
  if (!segmentBoundsOverlap(a, b, c, d)) return false;
  const o1 = segmentOrientation(a, b, c);
  const o2 = segmentOrientation(a, b, d);
  const o3 = segmentOrientation(c, d, a);
  const o4 = segmentOrientation(c, d, b);
  return o1 * o2 < -0.0000001 && o3 * o4 < -0.0000001;
}

function sharesSegmentEndpoint(from, to, segment) {
  return pointDistance(from, segment.from) < 0.0008
    || pointDistance(from, segment.to) < 0.0008
    || pointDistance(to, segment.from) < 0.0008
    || pointDistance(to, segment.to) < 0.0008;
}

function resolveNearestSegmentDistance(point, segments) {
  if (!Array.isArray(segments) || segments.length === 0) return 1;
  let nearest = 1;
  for (let i = 0; i < segments.length; i += 1) {
    nearest = Math.min(nearest, pointToSegmentDistance(point, segments[i].from, segments[i].to));
  }
  return nearest;
}

function resolveCrackImpactPointForArchetype(seed, archetype, impactPoint = null) {
  const renderSeed = resolveRenderSeed(seed);
  const explicitImpactPoint = normalizeImpactPoint(impactPoint);
  if (explicitImpactPoint) return explicitImpactPoint;
  const base = resolveImpactPoint(renderSeed);
  if (archetype === 'edge_tear') {
    const leftSide = seededUnit(2141, renderSeed) < 0.5;
    return [
      leftSide
        ? varyNumber(0.16, renderSeed, 2147, 0.1, 0.05, 0.28)
        : varyNumber(0.84, renderSeed, 2153, 0.1, 0.72, 0.95),
      varyNumber(base[1], renderSeed, 2159, 0.24, 0.22, 0.78),
    ];
  }
  if (archetype === 'horizontal_lcd_split') {
    return [
      varyNumber(0.5, renderSeed, 2161, 0.12, 0.38, 0.62),
      varyNumber(0.54, renderSeed, 2167, 0.18, 0.38, 0.68),
    ];
  }
  if (archetype === 'center_spider') {
    return [
      varyNumber(0.5, renderSeed, 2171, 0.12, 0.4, 0.6),
      varyNumber(0.5, renderSeed, 2179, 0.1, 0.4, 0.6),
    ];
  }
  return base;
}

function resolveStressAngles(archetype, impactPoint, seed) {
  const renderSeed = resolveRenderSeed(seed);
  if (archetype === 'center_spider') {
    const count = 5 + Math.floor(seededUnit(2203, renderSeed) * 2);
    const base = seededUnit(2207, renderSeed) * Math.PI * 2;
    return Array.from({ length: count }, (_, index) => (
      base + (Math.PI * 2 * index) / count + (seededUnit(2213 + index, renderSeed) - 0.5) * 0.24
    ));
  }
  if (archetype === 'edge_tear') {
    const fromLeft = impactPoint[0] < 0.5;
    const inward = fromLeft ? 0 : Math.PI;
    return [
      inward + varyNumber(0, renderSeed, 2221, 0.24),
      inward + varyNumber(-0.44, renderSeed, 2227, 0.28),
      inward + varyNumber(0.46, renderSeed, 2231, 0.28),
      inward + varyNumber(-0.92, renderSeed, 2237, 0.22),
      inward + varyNumber(0.96, renderSeed, 2243, 0.22),
    ];
  }
  if (archetype === 'horizontal_lcd_split') {
    return [
      Math.PI + varyNumber(0, renderSeed, 2251, 0.12),
      varyNumber(0, renderSeed, 2257, 0.12),
      Math.PI + varyNumber(-0.12, renderSeed, 2263, 0.18),
      varyNumber(0.14, renderSeed, 2267, 0.18),
      -Math.PI / 2 + varyNumber(0, renderSeed, 2273, 0.14),
      Math.PI / 2 + varyNumber(0, renderSeed, 2279, 0.14),
    ];
  }
  const base = varyNumber(-0.32, renderSeed, 2281, 0.24);
  return [
    base,
    base + Math.PI + varyNumber(0, renderSeed, 2287, 0.18),
    base - 0.92 + varyNumber(0, renderSeed, 2293, 0.22),
    base + 1.08 + varyNumber(0, renderSeed, 2297, 0.24),
  ];
}

function scoreCrackCandidate({
  candidate,
  current,
  direction,
  existingSegments,
  impactPoint,
  kind = 'primary',
  seed,
  stressAngle,
  key,
  turnDebt = 0,
}) {
  if (candidate[0] <= 0.014 || candidate[0] >= 0.986 || candidate[1] <= 0.014 || candidate[1] >= 0.986) {
    return -120;
  }
  let score = 0;
  const nextAngle = angleFromPoints(current, candidate);
  score += Math.cos(angleDelta(nextAngle, direction)) * 2.4;
  score += Math.cos(angleDelta(nextAngle, stressAngle)) * 1.55;
  const turnAmount = angleDelta(nextAngle, direction);
  const sharpTurnLimit = kind === 'branch' ? 0.7 : 0.46;
  score -= Math.max(0, turnAmount - sharpTurnLimit) * (kind === 'branch' ? 1.2 : 2.35);
  score -= clamp(turnDebt, 0, 1.8) * Math.max(0, turnAmount - 0.16) * (kind === 'branch' ? 0.7 : 1.35);
  if (kind === 'primary') {
    const radialAngle = angleFromPoints(impactPoint, candidate);
    const radialDelta = angleDelta(nextAngle, radialAngle);
    score += Math.cos(radialDelta) * 0.9;
    score -= Math.max(0, radialDelta - 0.76) * 0.85;
  }
  const outward = pointDistance(candidate, impactPoint) - pointDistance(current, impactPoint);
  score += outward * 7.4;
  score += seededUnit(key, seed) * 0.42;

  for (let i = 0; i < existingSegments.length; i += 1) {
    const segment = existingSegments[i];
    if (sharesSegmentEndpoint(current, candidate, segment)) continue;
    if (segmentsIntersect(current, candidate, segment.from, segment.to)) return -200;
  }

  const nearest = resolveNearestSegmentDistance(candidate, existingSegments);
  if (nearest < 0.018) score -= 5.5;
  else if (nearest < 0.034) score -= 1.8;
  else if (nearest > 0.18) score += 0.28;
  return score;
}

function chooseCrackNextPoint({
  current,
  direction,
  existingSegments,
  impactPoint,
  pathIndex,
  seed,
  stepIndex,
  stressAngle,
  kind = 'primary',
  turnDebt = 0,
}) {
  const renderSeed = resolveRenderSeed(seed);
  const candidateCount = 9;
  let best = null;
  for (let i = 0; i < candidateCount; i += 1) {
    const key = pathIndex * 503 + stepIndex * 71 + i * 13 + 2309;
    const turnRange = kind === 'branch'
      ? 0.48 + seededUnit(key + 2, renderSeed) * 0.18
      : 0.38 + seededUnit(key + 2, renderSeed) * 0.16;
    const turn = ((i - ((candidateCount - 1) / 2)) / ((candidateCount - 1) / 2)) * turnRange;
    const steeringAngle = mixAngles(direction, stressAngle, kind === 'branch' ? 0.36 : 0.46);
    const angle = normalizeAngle(steeringAngle + turn + (seededUnit(key + 3, renderSeed) - 0.5) * 0.1);
    const stepLength = 0.066 + seededUnit(key + 5, renderSeed) * 0.082;
    const vec = vectorFromAngle(angle);
    const rawCandidate = [
      current[0] + vec[0] * stepLength,
      current[1] + vec[1] * stepLength,
    ];
    const candidate = clampPoint(rawCandidate);
    if (pointDistance(candidate, current) < 0.035) continue;
    const score = scoreCrackCandidate({
      candidate,
      current,
      direction,
      existingSegments,
      impactPoint,
      kind,
      key,
      seed: renderSeed,
      stressAngle,
      turnDebt,
    });
    if (!best || score > best.score) {
      best = { angle, point: candidate, score };
    }
  }
  return best && best.score > -80 ? best : null;
}

function buildCrackPath({
  existingSegments,
  impactPoint,
  kind = 'primary',
  pathIndex,
  seed,
  start,
  stressAngle,
  width,
}) {
  const renderSeed = resolveRenderSeed(seed);
  const maxSteps = kind === 'primary'
    ? 4 + Math.floor(seededUnit(pathIndex * 19 + 2311, renderSeed) * 4)
    : 2 + Math.floor(seededUnit(pathIndex * 23 + 2317, renderSeed) * 3);
  const points = [impactPoint];
  let current = impactPoint;
  let direction = stressAngle;
  let previousTurnSign = 0;
  let turnDebt = 0;
  for (let stepIndex = 0; stepIndex < maxSteps; stepIndex += 1) {
    const next = chooseCrackNextPoint({
      current,
      direction,
      existingSegments,
      impactPoint,
      kind,
      pathIndex,
      seed: renderSeed,
      stepIndex,
      stressAngle,
      turnDebt,
    });
    if (!next) break;
    existingSegments.push({
      from: current,
      kind,
      pathIndex,
      to: next.point,
    });
    points.push(next.point);
    const signedTurn = signedAngleDelta(direction, next.angle);
    const turnSign = Math.abs(signedTurn) < 0.08 ? 0 : Math.sign(signedTurn);
    const turnAmount = Math.abs(signedTurn);
    turnDebt = turnSign !== 0 && turnSign === previousTurnSign
      ? clamp(turnDebt + turnAmount, 0, kind === 'branch' ? 1.2 : 1.55)
      : turnAmount * 0.35;
    if (turnSign !== 0) previousTurnSign = turnSign;
    current = next.point;
    direction = next.angle;
    if (
      stepIndex >= 2
      && (current[0] <= 0.03 || current[0] >= 0.97 || current[1] <= 0.03 || current[1] >= 0.97)
    ) {
      break;
    }
  }
  return points.length > 1
    ? {
      kind,
      points: Object.freeze(points.map((point) => Object.freeze(point))),
      start,
      width,
    }
    : null;
}

function branchSegmentCrossesExisting(from, to, existingSegments) {
  return existingSegments.some((segment) => {
    if (from === segment.from || from === segment.to || to === segment.from || to === segment.to) return false;
    if (Math.max(Math.min(from[0], to[0]), Math.min(segment.from[0], segment.to[0]))
      > Math.min(Math.max(from[0], to[0]), Math.max(segment.from[0], segment.to[0]))
      || Math.max(Math.min(from[1], to[1]), Math.min(segment.from[1], segment.to[1]))
      > Math.min(Math.max(from[1], to[1]), Math.max(segment.from[1], segment.to[1]))) return false;
    const sourceFrom = segmentOrientation(from, to, segment.from);
    const sourceTo = segmentOrientation(from, to, segment.to);
    const branchFrom = segmentOrientation(segment.from, segment.to, from);
    const branchTo = segmentOrientation(segment.from, segment.to, to);
    return sourceFrom * sourceTo <= 0 && branchFrom * branchTo <= 0;
  });
}

function buildBranchCrackPath({
  anchor,
  anchorProgress,
  existingSegments,
  localAngle,
  pathIndex,
  seed,
  sourcePathIndex,
}) {
  const renderSeed = resolveRenderSeed(seed);
  const side = seededUnit(pathIndex * 31 + 2333, renderSeed) < 0.5 ? -1 : 1;
  const branchAngle = normalizeAngle(localAngle + side * (0.18 + seededUnit(pathIndex * 37 + 2339, renderSeed) * 0.16));
  const direction = vectorFromAngle(branchAngle);
  const sourceDirection = vectorFromAngle(localAngle);
  const normal = [-direction[1], direction[0]];
  const span = 0.026 + seededUnit(pathIndex * 47 + 2351, renderSeed) * 0.036;
  const firstRun = 0.34 + seededUnit(pathIndex * 53 + 2357, renderSeed) * 0.1;
  const stressJog = span * side * (0.012 + seededUnit(pathIndex * 59 + 2371, renderSeed) * 0.016);
  const points = [
    anchor,
    [anchor[0] + direction[0] * span * firstRun + normal[0] * stressJog,
      anchor[1] + direction[1] * span * firstRun + normal[1] * stressJog],
    [anchor[0] + direction[0] * span, anchor[1] + direction[1] * span],
  ];
  // 짧은 전방 가지 하나를 먼저 검증하고, 수용할 때만 기존 균열에 등록한다.
  for (let index = 1; index < points.length; index += 1) {
    const from = points[index - 1];
    const to = points[index];
    const dx = to[0] - from[0];
    const dy = to[1] - from[1];
    if (!to.every((value) => Number.isFinite(value) && value >= 0 && value <= 1)
      || dx * direction[0] + dy * direction[1] <= 0
      || dx * sourceDirection[0] + dy * sourceDirection[1] <= 0
      || branchSegmentCrossesExisting(from, to, existingSegments)) return null;
  }
  for (let index = 1; index < points.length; index += 1) {
    existingSegments.push({ from: points[index - 1], kind: 'branch', pathIndex, to: points[index] });
  }
  return {
    kind: 'branch',
    points: Object.freeze(points.map((point) => Object.freeze(point))),
    sourcePathIndex,
    start: clamp(0.24 + anchorProgress * 0.34 + seededUnit(pathIndex * 41 + 2341, renderSeed) * 0.14, 0.22, 0.74),
    width: 0.34 + seededUnit(pathIndex * 43 + 2347, renderSeed) * 0.32,
  };
}

function collectCrackNodes(paths) {
  const nodes = [];
  for (let pathIndex = 0; pathIndex < paths.length; pathIndex += 1) {
    const path = paths[pathIndex];
    const points = Array.isArray(path?.points) ? path.points : [];
    for (let pointIndex = 0; pointIndex < points.length; pointIndex += 1) {
      nodes.push({
        path,
        pathIndex,
        point: points[pointIndex],
        pointIndex,
        progress: points.length <= 1 ? 0 : pointIndex / (points.length - 1),
      });
    }
  }
  return nodes;
}

function resolveSkeletonLineSpan(axis, anchorPoint, seed, index) {
  const renderSeed = resolveRenderSeed(seed);
  const anchor = axis === 'y' ? anchorPoint[0] : anchorPoint[1];
  const direction = seededUnit(index * 97 + 2351, renderSeed) < 0.5 ? -1 : 1;
  if (seededUnit(index * 101 + 2357, renderSeed) < 0.34) return [0, 1];
  if (direction < 0) {
    return [
      clamp(anchor - (0.24 + seededUnit(index * 103 + 2363, renderSeed) * 0.5), 0, 0.96),
      clamp(anchor + seededUnit(index * 107 + 2369, renderSeed) * 0.16, 0.04, 1),
    ];
  }
  return [
    clamp(anchor - seededUnit(index * 109 + 2371, renderSeed) * 0.16, 0, 0.96),
    clamp(anchor + (0.24 + seededUnit(index * 113 + 2377, renderSeed) * 0.5), 0.04, 1),
  ];
}

function buildSkeletonLineDefects(paths, seed) {
  const renderSeed = resolveRenderSeed(seed);
  const nodes = collectCrackNodes(paths).filter((node) => (
    node.pointIndex > 0
    && node.progress > 0.18
    && node.progress < 0.96
  ));
  const defects = [];
  for (let i = 0; i < nodes.length && defects.length < 7; i += 1) {
    const node = nodes[i];
    const key = node.pathIndex * 127 + node.pointIndex * 17 + 2381;
    if (seededUnit(key, renderSeed) < 0.52 && defects.length >= 2) continue;
    const axis = seededUnit(key + 3, renderSeed) < 0.58 ? 'y' : 'x';
    const span = resolveSkeletonLineSpan(axis, node.point, renderSeed, defects.length + i);
    defects.push(Object.freeze({
      anchor: Object.freeze(node.point),
      axis,
      color: [
        LCD_DEFECT_COLORS.cyan,
        LCD_DEFECT_COLORS.red,
        LCD_DEFECT_COLORS.green,
      ][defects.length % 3],
      glow: 8 + seededUnit(key + 7, renderSeed) * 12,
      pos: axis === 'y' ? node.point[1] : node.point[0],
      spanEnd: Math.max(span[0] + 0.04, span[1]),
      spanStart: Math.min(span[0], span[1] - 0.04),
      start: clamp(node.path.start + node.progress * 0.26 + 0.08 + seededUnit(key + 11, renderSeed) * 0.12, 0.14, 0.78),
      width: 0.8 + seededUnit(key + 13, renderSeed) * 1.6,
    }));
  }
  return Object.freeze(defects);
}

function buildSkeletonChips(paths, seed) {
  const renderSeed = resolveRenderSeed(seed);
  return Object.freeze(collectCrackNodes(paths)
    .filter((node) => node.pointIndex > 0 && node.progress > 0.2)
    .filter((node) => seededUnit(node.pathIndex * 131 + node.pointIndex * 19 + 2393, renderSeed) > 0.46)
    .slice(0, 9)
    .map((node, index) => Object.freeze({
      r: 0.5 + seededUnit(index * 137 + 2399, renderSeed) * 0.9,
      start: clamp(node.path.start + node.progress * 0.28 + 0.1, 0.22, 0.82),
      x: node.point[0],
      y: node.point[1],
    })));
}

function buildSkeletonFacets(primaryPaths, seed) {
  const renderSeed = resolveRenderSeed(seed);
  const facets = [];
  for (let i = 0; i < primaryPaths.length - 1 && facets.length < 5; i += 1) {
    const a = primaryPaths[i];
    const b = primaryPaths[i + 1];
    if (!a?.points?.[1] || !b?.points?.[1]) continue;
    const aPoint = a.points[Math.min(a.points.length - 1, 1 + Math.floor(seededUnit(i * 149 + 2407, renderSeed) * Math.max(1, a.points.length - 2)))];
    const bPoint = b.points[Math.min(b.points.length - 1, 1 + Math.floor(seededUnit(i * 151 + 2411, renderSeed) * Math.max(1, b.points.length - 2)))];
    facets.push(Object.freeze({
      alpha: 0.09 + seededUnit(i * 157 + 2417, renderSeed) * 0.08,
      points: Object.freeze([
        Object.freeze(primaryPaths[0].points[0]),
        Object.freeze(aPoint),
        Object.freeze(bPoint),
      ]),
      start: clamp(0.34 + i * 0.08 + seededUnit(i * 163 + 2423, renderSeed) * 0.12, 0.28, 0.78),
    }));
  }
  return Object.freeze(facets);
}

export function resolveGlobalSimulationBreakCrackSkeleton({
  archetype = null,
  impactPoint = null,
  seed = 0,
} = {}) {
  if (!Number.isSafeInteger(seed) || seed < 0 || seed > 0x7fffffff) {
    throw new Error('global_sentinel_fracture_seed_invalid');
  }
  const renderSeed = resolveRenderSeed(seed);
  const crackArchetype = resolveCrackArchetype(renderSeed, archetype);
  const resolvedImpactPoint = Object.freeze(
    resolveCrackImpactPointForArchetype(renderSeed, crackArchetype, impactPoint),
  );
  const cacheKey = [
    renderSeed,
    crackArchetype,
    resolvedImpactPoint[0],
    resolvedImpactPoint[1],
  ].join(':');
  const cached = globalSimulationBreakSkeletonCache.get(cacheKey);
  if (cached) {
    // Refresh insertion order so the small cache behaves as an activation-local
    // LRU while background and foreground share the same frozen geometry plan.
    globalSimulationBreakSkeletonCache.delete(cacheKey);
    globalSimulationBreakSkeletonCache.set(cacheKey, cached);
    return cached;
  }
  const existingSegments = [];
  const primaryPaths = [];
  if (crackArchetype === 'direction_distributed') {
    primaryPaths.push(...resolveDirectionDistributedPrimaryCracks({ seed: renderSeed, impactPoint: resolvedImpactPoint }));
    for (let pathIndex = 0; pathIndex < primaryPaths.length; pathIndex += 1) {
      const points = primaryPaths[pathIndex].points;
      for (let index = 1; index < points.length; index += 1) {
        existingSegments.push({ from: points[index - 1], to: points[index], kind: 'primary', pathIndex });
      }
    }
  } else {
    const stressAngles = resolveStressAngles(crackArchetype, resolvedImpactPoint, renderSeed);
    for (let i = 0; i < stressAngles.length; i += 1) {
      const path = buildCrackPath({
        existingSegments,
        impactPoint: resolvedImpactPoint,
        kind: 'primary',
        pathIndex: i,
        seed: renderSeed,
        start: clamp(0.08 + i * 0.055 + seededUnit(i * 167 + 2429, renderSeed) * 0.06, 0.06, 0.42),
        stressAngle: stressAngles[i],
        width: 0.82 + seededUnit(i * 173 + 2437, renderSeed) * 0.72,
      });
      if (path) primaryPaths.push(Object.freeze(path));
    }
  }

  const branchPaths = [];
  for (let pathIndex = 0; pathIndex < primaryPaths.length; pathIndex += 1) {
    const path = primaryPaths[pathIndex];
    const points = path.points;
    for (let pointIndex = 1; pointIndex < points.length - 1 && branchPaths.length < 6; pointIndex += 1) {
      const key = pathIndex * 179 + pointIndex * 29 + 2441;
      if (seededUnit(key, renderSeed) < 0.64) continue;
      const localAngle = angleFromPoints(points[pointIndex - 1], points[pointIndex + 1]);
      const branch = buildBranchCrackPath({
        anchor: points[pointIndex],
        anchorProgress: pointIndex / Math.max(1, points.length - 1),
        existingSegments,
        localAngle,
        pathIndex: primaryPaths.length + branchPaths.length,
        seed: renderSeed,
        sourcePathIndex: pathIndex,
      });
      if (branch) branchPaths.push(Object.freeze(branch));
    }
  }

  const paths = primaryPaths.concat(branchPaths);
  const skeleton = Object.freeze({
    archetype: crackArchetype,
    branchPaths: Object.freeze(branchPaths),
    chips: buildSkeletonChips(paths, renderSeed),
    facets: buildSkeletonFacets(primaryPaths, renderSeed),
    impactPoint: resolvedImpactPoint,
    lineDefects: buildSkeletonLineDefects(paths, renderSeed),
    primaryPaths: Object.freeze(primaryPaths),
    renderSeed,
  });
  globalSimulationBreakSkeletonCache.set(cacheKey, skeleton);
  if (globalSimulationBreakSkeletonCache.size > GLOBAL_SIMULATION_BREAK_SKELETON_CACHE_LIMIT) {
    const oldestKey = globalSimulationBreakSkeletonCache.keys().next().value;
    globalSimulationBreakSkeletonCache.delete(oldestKey);
  }
  return skeleton;
}

export function resolveGlobalSentinelRiftAperturePlan({
  impactPoint = null,
  progress = 1,
  seed = 0,
  skeleton = null,
  width = 1,
  height = 1,
} = {}) {
  if (!Number.isSafeInteger(seed) || seed < 0 || seed > 0x7fffffff
    || !Number.isFinite(progress) || progress < 0 || progress > 1
    || !Number.isFinite(width) || width <= 0 || !Number.isFinite(height) || height <= 0) {
    throw new Error('global_sentinel_rift_geometry_invalid');
  }
  const renderSeed = resolveRenderSeed(seed);
  const resolvedSkeleton = skeleton || resolveGlobalSimulationBreakCrackSkeleton({
    impactPoint,
    seed: renderSeed,
  });
  const normalizedProgress = clamp(progress, 0, 1);
  const completedBoundsKey = `${renderSeed}:${width}:${height}`;
  if (normalizedProgress >= 1) {
    const cached = globalSentinelCompletedRiftPlanCache.get(resolvedSkeleton);
    if (cached?.boundsKey === completedBoundsKey) return cached.plan;
  }
  const origin = resolvedSkeleton?.impactPoint || resolveImpactPoint(renderSeed, impactPoint);
  const sourcePaths = Array.isArray(resolvedSkeleton?.primaryPaths)
    ? resolvedSkeleton.primaryPaths
    : [];
  if (sourcePaths.length < 3) {
    throw new Error('global_sentinel_rift_aperture_primary_paths_missing');
  }
  const candidates = sourcePaths.map((path, pathIndex) => {
    const points = Array.isArray(path?.points) ? path.points : [];
    const furthestCandidateIndex = Math.min(2, points.length - 1);
    if (furthestCandidateIndex < 1) {
      throw new Error(`global_sentinel_rift_aperture_path_node_missing:${pathIndex}`);
    }
    const pointIndex = furthestCandidateIndex === 1
      ? 1
      : (seededUnit(pathIndex * 229 + 3203, renderSeed) < 0.7 ? 1 : 2);
    const point = points[pointIndex];
    return {
      angle: angleFromPoints(origin, point),
      openKey: seededUnit(pathIndex * 233 + 3217, renderSeed),
      pathIndex,
      point: Object.freeze([point[0], point[1]]),
      pointIndex,
    };
  });
  const selectedDepths = new Set(candidates.map((candidate) => candidate.pointIndex));
  if (candidates.length > 1 && selectedDepths.size === 1) {
    const pivot = Math.floor(seededUnit(3299, renderSeed) * candidates.length) % candidates.length;
    const candidate = candidates[pivot];
    const alternateIndex = candidate.pointIndex === 1 ? 2 : 1;
    const alternatePoint = sourcePaths[candidate.pathIndex]?.points?.[alternateIndex];
    if (alternatePoint) {
      candidate.pointIndex = alternateIndex;
      candidate.point = Object.freeze([alternatePoint[0], alternatePoint[1]]);
      candidate.angle = angleFromPoints(origin, alternatePoint);
    }
  }
  const openingOrder = [...candidates]
    .sort((a, b) => a.openKey - b.openKey)
    .reduce((orders, node, index) => orders.set(node.pathIndex, index), new Map());
  const selectedNodes = candidates
    .map((node) => Object.freeze({
      angle: node.angle,
      openOrder: openingOrder.get(node.pathIndex) || 0,
      pathIndex: node.pathIndex,
      point: node.point,
      pointIndex: node.pointIndex,
    }))
    .sort((a, b) => a.angle - b.angle);
  const timeline = normalizedProgress >= 1
    ? GLOBAL_SENTINEL_COMPLETED_RIFT_TIMELINE
    : resolveGlobalSentinelRiftApertureTimeline(normalizedProgress);
  const originX = origin[0] * width;
  const originY = origin[1] * height;
  const count = Math.max(1, selectedNodes.length);
  const normalizedTearAnchors = selectedNodes.map((node) => {
    const delay = count > 1 ? (node.openOrder / (count - 1)) * 0.14 : 0;
    const localUnfold = easeOutCubic(clamp(
      (timeline.unfold - delay) / Math.max(0.001, 1 - delay),
      0,
      1,
    ));
    const punctureScale = timeline.puncture * 0.055;
    const settleOvershoot = Math.sin(timeline.settle * Math.PI) * 0.032;
    const radialScale = clamp(
      punctureScale + localUnfold * (0.945 + settleOvershoot),
      0,
      1.04,
    );
    return Object.freeze([
      origin[0] + (node.point[0] - origin[0]) * radialScale,
      origin[1] + (node.point[1] - origin[1]) * radialScale,
    ]);
  });
  const contour = resolveGlobalSentinelImpactBleedContour({
    seed: renderSeed, impactPoint: origin, width, height, damage: 0.4, scale: timeline.puncture,
  });
  const anchorContour = selectedNodes.map((node) => {
    const angle = Math.atan2((node.point[1] - origin[1]) * height, (node.point[0] - origin[0]) * width);
    return contour.reduce((nearest, point) => (
      angleDelta(angleFromPoints([originX, originY], point), angle)
        < angleDelta(angleFromPoints([originX, originY], nearest), angle) ? point : nearest
    ));
  });
  const tearAnchorContour = normalizedTearAnchors.map((point) => Object.freeze([
    point[0] * width,
    point[1] * height,
  ]));
  const normalizedContour = contour.map((point) => Object.freeze([
    point[0] / width,
    point[1] / height,
  ]));

  const plan = Object.freeze({
    active: selectedNodes.length >= 3 && timeline.puncture > 0.001,
    anchorContour: Object.freeze(anchorContour),
    contour: Object.freeze(contour),
    normalizedContour: Object.freeze(normalizedContour),
    origin: Object.freeze([origin[0], origin[1]]),
    originX,
    originY,
    renderSeed,
    selectedNodes: Object.freeze(selectedNodes),
    tearAnchorContour: Object.freeze(tearAnchorContour),
    timeline,
  });
  if (normalizedProgress >= 1) {
    globalSentinelCompletedRiftPlanCache.set(
      resolvedSkeleton,
      Object.freeze({ boundsKey: completedBoundsKey, plan }),
    );
  }
  return plan;
}

function easeOutCubic(value) {
  const t = clamp(value, 0, 1);
  return 1 - ((1 - t) ** 3);
}

function resolveAppear(sync, start = 0, end = 1) {
  if (sync <= start) return 0;
  if (sync >= end) return 1;
  return easeOutCubic((sync - start) / Math.max(0.001, end - start));
}

function resolveFractureStageProfile(fracture, syncPressure = 0, terminalResync = 0) {
  const raw = clamp(fracture, 0, 1);
  const terminal = clamp(terminalResync, 0, 1);
  const repairPressure = resolveRepairMaskPressure(syncPressure, raw, terminal);
  const repairClosure = clamp(terminal * 0.94, 0, 1);
  const retained = clamp(raw * (1 - terminal * 0.82), 0, 1);
  const length = clamp(retained * (1 - repairClosure * 0.18), 0, 1);
  const hairline = clamp(resolveAppear(retained, 0.04, 0.18) * (1 - repairClosure * 0.08), 0, 1);
  const branchPresence = clamp(resolveAppear(retained, 0.34, 0.56) * (1 - repairClosure * 0.28), 0, 1);
  const aperture = clamp(resolveAppear(retained, 0.52, 0.75) * (1 - repairClosure * 0.86), 0, 1);
  const debrisLeak = clamp(resolveAppear(retained, 0.56, 0.78) * (1 - repairClosure * 0.92), 0, 1);
  const facet = clamp(resolveAppear(retained, 0.48, 0.72) * (1 - repairClosure * 0.84), 0, 1);
  const lineDefect = clamp(resolveAppear(retained, 0.28, 0.72) * 0.3 * (1 - repairClosure * 0.5), 0, 1);
  const joint = clamp(resolveAppear(retained, 0.3, 0.62) * (1 - repairClosure * 0.36), 0, 1);
  return {
    raw,
    retained,
    hairline,
    length,
    branchPresence,
    aperture,
    debrisLeak,
    lightLeak: clamp(debrisLeak * (0.48 + aperture * 0.52), 0, 1),
    chip: debrisLeak,
    facet,
    lineDefect,
    joint,
    crackAlphaScale: clamp(0.56 + hairline * 0.2 + aperture * 0.24, 0, 1),
    crackWidthScale: clamp(0.42 + length * 0.3 + aperture * 0.92, 0.34, 1.64),
    repairPressure,
    repairClosure,
  };
}

export function resolveGlobalSimulationBreakDebugProfile({
  archetype = null,
  fracture = 0,
  seed = 0,
  syncPressure = 0,
  terminalResync = 0,
} = {}) {
  const renderSeed = resolveRenderSeed(seed);
  const skeleton = resolveGlobalSimulationBreakCrackSkeleton({ archetype, seed: renderSeed });
  return {
    archetype: skeleton.archetype,
    branchPathCount: skeleton.branchPaths.length,
    lineDefectCount: skeleton.lineDefects.length,
    primaryPathCount: skeleton.primaryPaths.length,
    renderSeed,
    ...resolveFractureStageProfile(fracture, syncPressure, terminalResync),
  };
}

export function resolveGlobalSentinelTerminalDisplayProgress(sequence = null, now = Date.now()) {
  const terminal = resolveNudgeTerminalSequenceProgress(sequence, { now });
  if (!terminal.active) return { banish: 0, ma: 0, resync: 0 };
  const eased = clamp(terminal.eased, 0, 1);
  if (terminal.mode === NUDGE_TERMINAL_SEQUENCE_MODES.BANISH) {
    const durationMs = Math.max(1, Number(terminal.durationMs));
    const maMs = Math.min(
      GLOBAL_SENTINEL_TERMINAL_MA_MS,
      Math.max(0, durationMs - 1),
    );
    const releaseDurationMs = Math.max(1, durationMs - maMs);
    const releaseProgress = clamp(
      (Number(terminal.elapsedMs) - maMs) / releaseDurationMs,
      0,
      1,
    );
    return {
      banish: easeOutCubic(releaseProgress),
      ma: maMs > 0 ? clamp(1 - Number(terminal.elapsedMs) / maMs, 0, 1) : 0,
      resync: 0,
    };
  }
  return {
    banish: 0,
    ma: 0,
    resync: terminal.mode === NUDGE_TERMINAL_SEQUENCE_MODES.RESYNC ? eased : 0,
  };
}

const LCD_DEFECT_COLORS = Object.freeze({
  cyan: Object.freeze([56, 189, 248]),
  red: Object.freeze([248, 113, 113]),
  green: Object.freeze([74, 222, 128]),
  white: Object.freeze([255, 255, 255]),
  graphite: Object.freeze([47, 54, 63]),
});

const LCD_CRACK_COLORS = Object.freeze([
  Object.freeze([46, 52, 62]),
  Object.freeze([93, 107, 119]),
  Object.freeze([103, 73, 92]),
  Object.freeze([67, 115, 126]),
  Object.freeze([111, 93, 63]),
]);

const LCD_REPAIR_MASK_SEAL_COLORS = Object.freeze([
  Object.freeze([245, 250, 255]),
  Object.freeze([238, 248, 255]),
  Object.freeze([255, 244, 247]),
  Object.freeze([239, 252, 247]),
]);

const LCD_REPAIR_MASK_SEAM_COLORS = Object.freeze([
  Object.freeze([188, 220, 255]),
  Object.freeze([255, 183, 197]),
  Object.freeze([176, 232, 216]),
]);

const LCD_REPAIR_SEAMS = Object.freeze([
  Object.freeze({ axis: 'y', pos: 0.16, start: 0.08, width: 1.1, glow: 18, color: Object.freeze([188, 220, 255]) }),
  Object.freeze({ axis: 'y', pos: 0.31, start: 0.18, width: 1.3, glow: 22, color: Object.freeze([255, 183, 197]) }),
  Object.freeze({ axis: 'y', pos: 0.49, start: 0.3, width: 1.05, glow: 18, color: Object.freeze([176, 232, 216]) }),
  Object.freeze({ axis: 'y', pos: 0.67, start: 0.44, width: 1.24, glow: 20, color: Object.freeze([188, 220, 255]) }),
  Object.freeze({ axis: 'x', pos: 0.21, start: 0.24, width: 1, glow: 16, color: Object.freeze([255, 183, 197]) }),
  Object.freeze({ axis: 'x', pos: 0.78, start: 0.56, width: 0.94, glow: 14, color: Object.freeze([176, 232, 216]) }),
]);

function drawLcdGrid(ctx, width, height, sync) {
  const cell = Math.max(3, Math.ceil(width / 480));
  ctx.save();
  ctx.lineWidth = 0.55;
  for (const [channel, color] of ['233, 60, 91', '46, 152, 109', '48, 104, 198'].entries()) {
    ctx.strokeStyle = `rgba(${color}, ${0.025 + sync * 0.009})`;
    ctx.beginPath();
    for (let x = channel * cell / 3; x < width; x += cell) {
      ctx.moveTo(x, 0);
      ctx.lineTo(x, height);
    }
    ctx.stroke();
  }
  ctx.strokeStyle = 'rgba(31, 43, 60, 0.026)';
  ctx.beginPath();
  const row = Math.max(3, Math.ceil(height / 300));
  for (let y = row; y < height; y += row) {
    ctx.moveTo(0, y);
    ctx.lineTo(width, y);
  }
  ctx.stroke();
  ctx.restore();
}

function resolveRepairMaskPressure(syncPressure, fracture, terminalResync = 0) {
  const damage = clamp(fracture, 0, 1);
  const terminal = clamp(terminalResync, 0, 1);
  if (damage <= 0.001 && terminal <= 0.001) return 0;
  return clamp(terminal * 0.96, 0, 1);
}

function drawResyncTerminalSnap(ctx, width, height, terminalResync = 0, seed = 0) {
  const t = clamp(terminalResync, 0, 1);
  if (t <= 0.001) return;
  const renderSeed = resolveRenderSeed(seed);
  const snap = resolveAppear(t, 0.04, 0.44);
  const clampdown = resolveAppear(t, 0.42, 0.92);

  ctx.save();
  ctx.globalCompositeOperation = 'source-over';
  const wash = ctx.createRadialGradient(
    width * 0.5,
    height * 0.48,
    Math.max(width, height) * 0.08,
    width * 0.5,
    height * 0.48,
    Math.max(width, height) * (0.7 + snap * 0.16),
  );
  wash.addColorStop(0, `rgba(255, 255, 255, ${0.08 + snap * 0.26})`);
  wash.addColorStop(0.58, `rgba(248, 250, 252, ${0.04 + snap * 0.18})`);
  wash.addColorStop(1, `rgba(226, 232, 240, ${snap * 0.1})`);
  ctx.fillStyle = wash;
  ctx.fillRect(0, 0, width, height);

  const bandCount = 5;
  for (let i = 0; i < bandCount; i += 1) {
    const y = height * (0.12 + i * 0.19 + (seededUnit(i * 17 + 5, renderSeed) - 0.5) * 0.045);
    const h = Math.max(1, height * (0.002 + seededUnit(i * 23 + 7, renderSeed) * 0.006));
    ctx.fillStyle = `rgba(255, 255, 255, ${snap * (0.1 + seededUnit(i * 29 + 11, renderSeed) * 0.12)})`;
    ctx.fillRect(0, y, width, h);
    ctx.fillStyle = `rgba(56, 189, 248, ${snap * 0.035})`;
    ctx.fillRect(width * seededUnit(i * 31 + 13, renderSeed), y + h * 1.8, width * 0.2, Math.max(1, h * 0.45));
  }

  if (clampdown > 0) {
    ctx.fillStyle = `rgba(255, 255, 255, ${clampdown * 0.2})`;
    ctx.fillRect(0, 0, width, height);
  }
  ctx.restore();
}

function resolveEntryRevealProgress(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return 1;
  return clamp(numeric, 0, 1);
}

function resolveCompletedEntryRupturePlan({
  skeleton,
  renderSeed,
  width,
  height,
}) {
  const boundsKey = `${renderSeed}:${width}:${height}`;
  const cached = globalSentinelCompletedEntryPlanCache.get(skeleton);
  if (cached?.boundsKey === boundsKey) return cached.plan;
  const origin = skeleton?.impactPoint || [0.5, 0.5];
  const plan = Object.freeze({
    active: true,
    clipped: false,
    contour: GLOBAL_SENTINEL_EMPTY_RENDER_POINTS,
    progress: 1,
    renderSeed,
    surfacePaths: GLOBAL_SENTINEL_EMPTY_RENDER_POINTS,
    timeline: GLOBAL_SENTINEL_COMPLETED_ENTRY_TIMELINE,
    x: width * origin[0],
    y: height * origin[1],
  });
  globalSentinelCompletedEntryPlanCache.set(skeleton, Object.freeze({ boundsKey, plan }));
  return plan;
}

function resolveEntrySurfaceCrackPaths(skeleton) {
  // Diagnostic metadata references the committed skeleton directly. Physical
  // painting belongs to the shared LCD glass pass, not another reveal model.
  const sourcePaths = skeleton.primaryPaths;
  const project = (path, pathIndex, attachment = {}) => Object.freeze({
    front: 1, pathIndex, kind: path.kind, extent: path.points.length - 1,
    ...attachment, points: path.points,
  });
  const primary = sourcePaths.map((path, pathIndex) => project(path, pathIndex));
  const branches = skeleton.branchPaths.map((path, index) => {
    const source = sourcePaths[path.sourcePathIndex];
    const sourcePointIndex = source?.points.indexOf(path.points[0]);
    if (!(sourcePointIndex > 0 && sourcePointIndex < source.points.length - 1)) {
      throw new Error('GLOBAL_SENTINEL_GLASS_BRANCH_ATTACHMENT_INVALID');
    }
    return project(path, sourcePaths.length + index, { sourcePathIndex: path.sourcePathIndex, sourcePointIndex });
  });
  return Object.freeze(primary.concat(branches));
}

export function resolveGlobalSentinelEntryRupturePlan({
  active = true,
  progress = 1,
  impactPoint = null,
  skeleton = null,
  seed = 0,
  width = 1,
  height = 1,
} = {}) {
  const reveal = resolveEntryRevealProgress(progress);
  const renderSeed = resolveRenderSeed(seed);
  const resolvedSkeleton = skeleton || resolveGlobalSimulationBreakCrackSkeleton({
    impactPoint,
    seed: renderSeed,
  });
  const timeline = resolveGlobalSentinelEntryRuptureTimeline(active === true ? reveal : 1);
  const normalized = resolvedSkeleton?.impactPoint
    || normalizeImpactPoint(impactPoint)
    || resolveImpactPoint(renderSeed);
  const x = width * normalized[0];
  const y = height * normalized[1];
  if (active !== true) {
    return Object.freeze({
      active: false,
      clipped: false,
      contour: GLOBAL_SENTINEL_EMPTY_RENDER_POINTS,
          progress: 1,
      renderSeed,
      surfacePaths: GLOBAL_SENTINEL_EMPTY_RENDER_POINTS,
        timeline,
      x,
      y,
    });
  }
  if (reveal >= 0.995) {
    return resolveCompletedEntryRupturePlan({
      renderSeed,
      skeleton: resolvedSkeleton,
      width,
      height,
    });
  }
  return Object.freeze({
    active: true,
    clipped: false,
    contour: GLOBAL_SENTINEL_EMPTY_RENDER_POINTS,
    progress: reveal,
    renderSeed,
    surfacePaths: resolveEntrySurfaceCrackPaths(resolvedSkeleton),
    timeline,
    x,
    y,
  });
}

function resolveEntryRevealState({
  active = true,
  progress = 1,
  impactPoint = null,
  skeleton = null,
  seed = 0,
  width,
  height,
} = {}) {
  return resolveGlobalSentinelEntryRupturePlan({
    active,
    progress,
    impactPoint,
    skeleton,
    seed,
    width,
    height,
  });
}

function drawEntryRuptureSurfaceCracks(ctx, width, height, reveal, backgroundBudget, fracturePlan) {
  if (reveal.timeline.fieldLock >= 0.995) return;
  const minSide = Math.min(width, height);
  const life = clamp(1 - reveal.timeline.fieldLock * 0.9, 0, 1);
  ctx.save();
  drawGlobalSentinelGlassFracture(ctx, fracturePlan, backgroundBudget, life,
    resolveGlobalSentinelLcdSurfaceState(fracturePlan, { damage: 1, recovery: 0 }));
  const knotLife = clamp(1 - reveal.timeline.fieldLock * 0.82, 0, 1);
  if (knotLife > 0.01) {
    const knotRadius = minSide * 0.014;
    ctx.globalCompositeOperation = 'multiply';
    ctx.globalAlpha = knotLife * 0.78;
    ctx.fillStyle = 'rgba(4, 7, 12, 0.9)';
    ctx.beginPath();
    ctx.ellipse(reveal.x, reveal.y, knotRadius, knotRadius * 0.56, -0.14, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

function traceGlobalSentinelRiftContour(ctx, plan, scale = 1, {
  offsetX = 0,
  offsetY = 0,
  scaleY = 1,
} = {}) {
  const points = Array.isArray(plan?.contour) ? plan.contour : [];
  if (points.length < 3) return false;
  const originX = Number(plan?.originX) || 0;
  const originY = Number(plan?.originY) || 0;
  ctx.beginPath();
  for (let index = 0; index < points.length; index += 1) {
    const point = points[index];
    const x = originX + offsetX + (point[0] - originX) * scale;
    const y = originY + offsetY + (point[1] - originY) * scale * scaleY;
    if (index === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.closePath();
  return true;
}

function drawGlobalSentinelRiftInterior(ctx, width, height, plan, {
  backgroundBudget,
  seed = 0,
  timeMs = Date.now(),
  reducedMotion = false,
} = {}) {
  if (!plan?.active || !traceGlobalSentinelRiftContour(ctx, plan)) return;
  const renderSeed = resolveRenderSeed(seed);
  const depth = plan.timeline.depth;
  // The aperture is the small retained impact bleed, not a viewport-sized
  // portal. Its vanishing point and light must remain inside that actual mouth.
  const halfWidth = Math.max(...plan.contour.map(point => Math.abs(point[0] - plan.originX)));
  const halfHeight = Math.max(...plan.contour.map(point => Math.abs(point[1] - plan.originY)));
  const maxSide = Math.max(halfWidth, halfHeight) * 2;
  const minSide = Math.min(halfWidth, halfHeight) * 2;
  const motionTimeMs = reducedMotion ? 0 : Number(timeMs);
  const pulse = reducedMotion ? 0.5
    : 0.5 + Math.sin(motionTimeMs * 0.00115 + renderSeed * 0.017) * 0.5;
  const invitation = plan.timeline.progress === 1 ? 1 : 0;
  const vanishOffsetX = halfWidth * (0.14 + seededUnit(3343, renderSeed) * 0.06);
  const vanishOffsetY = -halfHeight * (0.1 + seededUnit(3347, renderSeed) * 0.04);

  ctx.save();
  ctx.clip();

  const voidField = ctx.createRadialGradient(
    plan.originX + vanishOffsetX,
    plan.originY + vanishOffsetY,
    Math.max(0.1, maxSide * 0.012),
    plan.originX,
    plan.originY,
    Math.max(1, maxSide * (0.31 + depth * 0.18)),
  );
  voidField.addColorStop(0, `rgba(8, 18, 30, ${0.98 - pulse * 0.04})`);
  voidField.addColorStop(0.34, 'rgba(3, 8, 17, 0.995)');
  voidField.addColorStop(0.72, 'rgba(1, 3, 9, 1)');
  voidField.addColorStop(1, 'rgba(0, 1, 4, 1)');
  ctx.fillStyle = voidField;
  ctx.fillRect(0, 0, width, height);

  const farThreshold = ctx.createLinearGradient(0, plan.originY - halfHeight, 0, plan.originY + halfHeight);
  farThreshold.addColorStop(0, 'rgba(92, 125, 154, 0)');
  farThreshold.addColorStop(0.46, `rgba(83, 126, 151, ${0.035 + depth * 0.085})`);
  farThreshold.addColorStop(0.52, `rgba(214, 184, 139, ${0.018 + depth * 0.05 + invitation * 0.04})`);
  farThreshold.addColorStop(0.6, 'rgba(25, 39, 55, 0.018)');
  farThreshold.addColorStop(1, 'rgba(0, 0, 0, 0)');
  ctx.fillStyle = farThreshold;
  ctx.fillRect(0, 0, width, height);

  const distantLight = ctx.createRadialGradient(
    plan.originX + vanishOffsetX,
    plan.originY + vanishOffsetY,
    0,
    plan.originX + vanishOffsetX,
    plan.originY + vanishOffsetY,
    Math.max(1, halfWidth * (0.55 - invitation * 0.12)),
  );
  distantLight.addColorStop(0, `rgba(239, 226, 196, ${(0.26 + invitation * 0.34) * depth})`);
  distantLight.addColorStop(0.18, `rgba(154, 196, 205, ${(0.13 + invitation * 0.08) * depth})`);
  distantLight.addColorStop(0.54, `rgba(194, 159, 119, ${0.035 * depth})`);
  distantLight.addColorStop(1, 'rgba(3, 8, 16, 0)');
  ctx.fillStyle = distantLight;
  ctx.fillRect(0, 0, width, height);

  const horizonX = plan.originX + vanishOffsetX * 0.86;
  const horizonY = plan.originY + vanishOffsetY * 0.86;
  const horizonHalfWidth = halfWidth * 0.42;
  const horizon = ctx.createLinearGradient(
    horizonX - horizonHalfWidth,
    horizonY,
    horizonX + horizonHalfWidth,
    horizonY,
  );
  horizon.addColorStop(0, 'rgba(96, 153, 178, 0)');
  horizon.addColorStop(0.34, `rgba(153, 207, 226, ${(0.12 + invitation * 0.24) * depth})`);
  horizon.addColorStop(0.55, `rgba(231, 211, 176, ${(0.2 + invitation * 0.6) * depth})`);
  horizon.addColorStop(1, 'rgba(72, 121, 146, 0)');
  ctx.fillStyle = horizon;
  ctx.fillRect(
    horizonX - horizonHalfWidth,
    horizonY - Math.max(0.5, minSide * 0.0006),
    horizonHalfWidth * 2,
    Math.max(1, minSide * 0.0012),
  );

  const perspectiveLayers = backgroundBudget.perspectiveLayers;
  const mouthAnchors = Array.isArray(plan.anchorContour) ? plan.anchorContour : [];
  if (backgroundBudget.connectivePassesEnabled && mouthAnchors.length >= 3) {
    ctx.save();
    ctx.globalCompositeOperation = 'screen';
    for (let index = 0; index < mouthAnchors.length; index += 1) {
      const point = mouthAnchors[index];
      const farScale = 0.28;
      const farX = plan.originX
        + vanishOffsetX * 0.72
        + (point[0] - plan.originX) * farScale;
      const farY = plan.originY
        + vanishOffsetY * 0.72
        + (point[1] - plan.originY) * farScale * 0.72;
      const ray = ctx.createLinearGradient(point[0], point[1], farX, farY);
      ray.addColorStop(0, 'rgba(187, 226, 241, 0.17)');
      ray.addColorStop(0.42, 'rgba(79, 127, 151, 0.065)');
      ray.addColorStop(1, 'rgba(214, 184, 139, 0.018)');
      ctx.globalAlpha = depth * (0.68 + (index % 2) * 0.16);
      ctx.strokeStyle = ray;
      ctx.lineWidth = Math.max(0.45, minSide * 0.0008);
      ctx.beginPath();
      ctx.moveTo(point[0], point[1]);
      ctx.lineTo(farX, farY);
      ctx.stroke();
    }
    ctx.restore();
  }

  const moteCount = backgroundBudget.moteCount;
  for (let index = 0; index < moteCount; index += 1) {
    const angle = seededUnit(index * 239 + 3251, renderSeed) * Math.PI * 2;
    const radius = maxSide * (0.025 + seededUnit(index * 241 + 3257, renderSeed) * 0.22);
    const drift = reducedMotion ? 0
      : Math.sin(motionTimeMs * (0.00016 + index * 0.000003) + index) * maxSide * 0.004;
    const x = plan.originX + Math.cos(angle) * radius + drift;
    const y = plan.originY + Math.sin(angle) * radius * 0.58 - drift * 0.42;
    const moteRadius = 0.45 + seededUnit(index * 251 + 3271, renderSeed) * 1.25;
    const alpha = (0.12 + seededUnit(index * 257 + 3281, renderSeed) * 0.3) * depth;
    ctx.fillStyle = index % 5 === 0
      ? `rgba(212, 184, 145, ${alpha * 0.7})`
      : `rgba(179, 218, 238, ${alpha})`;
    ctx.beginPath();
    ctx.arc(x, y, moteRadius, 0, Math.PI * 2);
    ctx.fill();
  }

  if (backgroundBudget.connectivePassesEnabled) {
    for (let layer = 0; layer < perspectiveLayers; layer += 1) {
      const layerProgress = (layer + 1) / perspectiveLayers;
      const scale = 0.78 - layer * 0.145
        + (reducedMotion ? 0 : Math.sin(motionTimeMs * 0.00034 + layer) * 0.006);
      if (!traceGlobalSentinelRiftContour(ctx, plan, scale, {
        offsetX: vanishOffsetX * layerProgress * 0.72,
        offsetY: vanishOffsetY * layerProgress * 0.72,
        scaleY: 1 - layerProgress * 0.26,
      })) continue;
      ctx.globalAlpha = (0.075 + layer * 0.02) * depth;
      ctx.strokeStyle = layer === perspectiveLayers - 1
        ? 'rgba(211, 185, 145, 0.56)'
        : 'rgba(159, 211, 235, 0.62)';
      ctx.lineWidth = Math.max(0.5, minSide * (0.00105 - layer * 0.00008));
      ctx.stroke();
    }
  }
  ctx.restore();
}

function drawGlobalSentinelRiftEdge(ctx, width, height, plan, {
  backgroundBudget,
  timeMs = Date.now(),
  reducedMotion = false,
} = {}) {
  if (!plan?.active) return;
  const minSide = Math.min(width, height);
  const edge = plan.timeline.edge;
  const invitation = plan.timeline.progress === 1 ? 1 : 0;
  const pulse = reducedMotion ? 0.5 : 0.5 + Math.sin(Number(timeMs) * 0.00115) * 0.5;
  const points = plan.contour;
  const halfHeight = Math.max(...points.map(point => Math.abs(point[1] - plan.originY)));
  const insetScale = Math.max(0.72, 1 - Math.min(2.2, halfHeight * 0.24) / halfHeight);
  const mouthAnchors = Array.isArray(plan.anchorContour) ? plan.anchorContour : [];
  const tearAnchors = Array.isArray(plan.tearAnchorContour) ? plan.tearAnchorContour : [];

  ctx.save();
  traceGlobalSentinelRiftContour(ctx, plan);
  ctx.clip();
  for (let index = 0; index < points.length; index += 1) {
    const nextIndex = (index + 1) % points.length;
    const point = points[index];
    const next = points[nextIndex];
    const innerPoint = [
      plan.originX + (point[0] - plan.originX) * insetScale,
      plan.originY + (point[1] - plan.originY) * insetScale,
    ];
    const innerNext = [
      plan.originX + (next[0] - plan.originX) * insetScale,
      plan.originY + (next[1] - plan.originY) * insetScale,
    ];
    const lip = ctx.createLinearGradient(point[0], point[1], innerPoint[0], innerPoint[1]);
    lip.addColorStop(0, `rgba(248, 252, 255, ${(0.46 + invitation * 0.16) * edge})`);
    lip.addColorStop(0.38, `rgba(159, 203, 224, ${0.25 * edge})`);
    lip.addColorStop(1, `rgba(3, 8, 16, ${0.76 * edge})`);
    ctx.fillStyle = lip;
    ctx.beginPath();
    ctx.moveTo(point[0], point[1]);
    ctx.lineTo(next[0], next[1]);
    ctx.lineTo(innerNext[0], innerNext[1]);
    ctx.lineTo(innerPoint[0], innerPoint[1]);
    ctx.closePath();
    ctx.fill();
  }

  for (let index = 0; index < Math.min(mouthAnchors.length, tearAnchors.length); index += 1) {
    const mouth = mouthAnchors[index];
    const tear = tearAnchors[index];
    if (Math.hypot(tear[0] - mouth[0], tear[1] - mouth[1]) < minSide * 0.008) continue;
    ctx.globalAlpha = edge * 0.72;
    ctx.strokeStyle = 'rgba(3, 8, 16, 0.82)';
    ctx.lineWidth = Math.max(0.7, minSide * 0.0013);
    ctx.beginPath();
    ctx.moveTo(mouth[0], mouth[1]);
    ctx.lineTo(tear[0], tear[1]);
    ctx.stroke();
    ctx.globalAlpha = edge * (0.18 + (index % 2) * 0.08);
    ctx.strokeStyle = 'rgba(197, 231, 243, 0.9)';
    ctx.lineWidth = Math.max(0.55, minSide * 0.0009);
    ctx.stroke();
  }

  strokeGlobalSentinelGlassCrack(ctx, [...points, points[0]], {
    alpha: edge * 0.88,
    baseWidth: Math.max(1.1, minSide * 0.0024),
    channelIntensity: 0.22,
    shadowBlurCapPx: backgroundBudget.structuralShadowBlurCapPx,
    taper: false,
  });

  if (backgroundBudget.connectivePassesEnabled) {
    for (let index = 0; index < points.length; index += 1) {
      const point = points[index];
      const next = points[(index + 1) % points.length];
      const midX = (point[0] + next[0]) * 0.5;
      const midY = (point[1] + next[1]) * 0.5;
      const light = clamp(
        0.34
          + ((plan.originX - midX) / minSide) * 0.72
          + ((plan.originY - midY) / minSide) * 1.15,
        0.08,
        1,
      );
      ctx.globalAlpha = edge * light * 0.82;
      ctx.strokeStyle = light > 0.58
        ? 'rgba(247, 252, 255, 0.94)'
        : 'rgba(116, 184, 211, 0.72)';
      ctx.lineWidth = Math.max(0.65, minSide * (0.0006 + light * 0.00055));
      ctx.lineCap = 'butt';
      ctx.lineJoin = 'bevel';
      ctx.shadowColor = 'rgba(176, 225, 244, 0.54)';
      ctx.shadowBlur = Math.min(backgroundBudget.structuralShadowBlurCapPx, minSide * 0.008 * light);
      ctx.beginPath();
      ctx.moveTo(point[0], point[1]);
      ctx.lineTo(next[0], next[1]);
      ctx.stroke();
    }
  }

  if (backgroundBudget.tertiaryPassesEnabled) {
    const litAnchors = mouthAnchors
      .map((point, index) => ({ index, point }))
      .sort((left, right) => (
        (left.point[0] + left.point[1]) - (right.point[0] + right.point[1])
      ))
      .slice(0, 2);
    for (const { index, point } of litAnchors) {
      ctx.globalAlpha = edge * (0.38 + (index % 2) * 0.2 + invitation * (0.12 + pulse * 0.08));
      ctx.fillStyle = invitation ? 'rgba(246, 232, 197, 0.94)' : 'rgba(232, 248, 255, 0.9)';
      ctx.shadowColor = 'rgba(142, 220, 246, 0.72)';
      ctx.shadowBlur = Math.min(backgroundBudget.structuralShadowBlurCapPx, minSide * 0.012);
      ctx.beginPath();
      ctx.arc(point[0], point[1], Math.max(0.7, minSide * 0.0022), 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.restore();
}

// Global breach is its own simulation-break panel. Canonical fracture owns the
// visible crack extent; sync pressure may signal repair intent but cannot erase
// geometry outside an explicit miss pulse or terminal resync.
function drawGlobalSentinelField(ctx, bounds, {
  archetype = null, syncLevel = 0, syncPressure = syncLevel,
  fracture = 0, breakLevel = fracture, intensity = 0.88, renderBudget,
  seed = 0, terminalSequence = null, timeMs = Date.now(), impactPoint = null,
  entryRevealActive = true, entryRevealProgress = 1,
  reducedMotion = false, recoveryStarterBurst = null,
} = {}) {
  const { width, height } = resolveBounds(bounds);
  const terminal = resolveGlobalSentinelTerminalDisplayProgress(terminalSequence, timeMs);
  const sync = clamp(syncPressure + terminal.resync * 0.88, 0, 1);
  if (!entryRevealActive && terminal.resync <= 0.001 && sync <= 0.001 && breakLevel <= 0.001) return;
  const pressure = clamp(intensity, 0.35, 1);
  const renderSeed = resolveRenderSeed(seed);
  resolveSceneRenderBudget(renderBudget);
  const skeleton = resolveGlobalSimulationBreakCrackSkeleton({ archetype, impactPoint, seed: renderSeed });
  const reveal = resolveEntryRevealState({
    active: entryRevealActive, progress: entryRevealProgress, impactPoint,
    skeleton, seed: renderSeed, width, height,
  });
  if (reveal.active && !reveal.timeline.fieldVisible) return;
  const surface = resolveZenSentinelRecoverySurface(width, height, reveal.timeline, reducedMotion,
    recoveryStarterBurst?.koiActor?.getSnapshot());
  ctx.save();
  const panel = ctx.createLinearGradient(0, 0, 0, height);
  const dark = surface.phase !== 'repair_field';
  panel.addColorStop(0, dark ? 'rgba(7, 12, 18, 1)' : 'rgba(248, 252, 255, 1)');
  panel.addColorStop(0.48, dark ? 'rgba(13, 23, 32, 1)' : 'rgba(236, 245, 250, 1)');
  panel.addColorStop(1, dark ? 'rgba(4, 8, 13, 1)' : 'rgba(247, 251, 253, 1)');
  ctx.fillStyle = panel;
  ctx.fillRect(0, 0, width, height);
  if (dark) {
    if (surface.backlightFront > 0) {
      // Reuse the existing backlight pass. The head opens white display
      // columns before the black body; glass remains broken until its tail.
      ctx.save();
      ctx.beginPath();
      ctx.rect(0, 0, surface.backlightFront, height);
      ctx.clip();
      const backlight = ctx.createLinearGradient(0, 0, 0, height);
      backlight.addColorStop(0, 'rgba(248, 252, 255, 1)');
      backlight.addColorStop(0.48, 'rgba(236, 245, 250, 1)');
      backlight.addColorStop(1, 'rgba(247, 251, 253, 1)');
      ctx.fillStyle = backlight;
      ctx.fillRect(0, 0, width, height);
      drawLcdGrid(ctx, width, height, sync);
      ctx.restore();
    }
    ctx.restore();
    return;
  }
  const backlight = ctx.createRadialGradient(width * 0.5, height * 0.48,
    Math.max(width, height) * 0.08, width * 0.5, height * 0.48, Math.max(width, height) * 0.76);
  backlight.addColorStop(0, 'rgba(255, 255, 255, ' + (0.12 + sync * 0.18) + ')');
  backlight.addColorStop(0.56, 'rgba(226, 238, 248, ' + (0.05 + pressure * 0.02 + sync * 0.025) + ')');
  backlight.addColorStop(1, 'rgba(192, 205, 218, ' + (0.025 + sync * 0.055) + ')');
  ctx.fillStyle = backlight;
  ctx.fillRect(0, 0, width, height);
  drawLcdGrid(ctx, width, height, sync);

  ctx.restore();
}

function drawGlobalSimulationBreakForeground(ctx, bounds, {
  archetype = null, fracture = 0, breakLevel = fracture, fractureThreshold, fractureImpact = 0,
  renderBudget, seed = 0, terminalSequence = null, timeMs = Date.now(), impactPoint = null,
  entryRevealActive = true, entryRevealProgress = 1, riftProgress = 0, scenePhase = '',
  reducedMotion = false, repairFrame = null, recoveryStarterBurst = null,
} = {}) {
  const { width, height } = resolveBounds(bounds);
  const terminal = resolveGlobalSentinelTerminalDisplayProgress(terminalSequence, timeMs);
  const rawDamage = clamp(breakLevel * (1 - terminal.resync * 0.82), 0, 1);
  if (!entryRevealActive && terminal.resync <= 0.001 && rawDamage <= 0.001) return;
  const renderSeed = resolveRenderSeed(seed);
  const backgroundBudget = resolveSceneRenderBudget(renderBudget).globalBackground;
  const skeleton = resolveGlobalSimulationBreakCrackSkeleton({ archetype, impactPoint, seed: renderSeed });
  const reveal = resolveEntryRevealState({
    active: entryRevealActive, progress: entryRevealProgress, impactPoint,
    skeleton, seed: renderSeed, width, height,
  });
  const lcdFracturePlan = resolveGlobalSentinelLcdFracturePlan(skeleton, width, height);
  const riftPlan = scenePhase === 'rift' ? resolveGlobalSentinelRiftAperturePlan({
    progress: riftProgress, seed: renderSeed, skeleton, width, height,
  }) : null;
  if (!reveal.active || reveal.timeline.fieldVisible) {
    const surface = resolveZenSentinelRecoverySurface(width, height, reveal.timeline, reducedMotion,
      recoveryStarterBurst?.koiActor?.getSnapshot());
    ctx.save();
    // Entry, rewind and player intervention all reveal prefixes of one LCD map.
    // The giant shadow is a projection of entry recovery, never a hit target.
    const lcdSurface = drawGlobalSentinelLcdDamage(ctx, lcdFracturePlan, backgroundBudget, {
      damage: rawDamage, fractureThreshold, opacity: 1 - terminal.resync * 0.55,
      impact: reducedMotion ? 0 : fractureImpact,
      recoveryFront: reveal.active ? surface.repairFront : null,
      rupture: repairFrame,
    });
    if (reveal.active) {
      drawZenSentinelRecoverySweep(ctx, surface, renderBudget, recoveryStarterBurst, timeMs);
    }
    drawGlobalSentinelRepairMaterial(ctx, width, height, repairFrame, backgroundBudget, lcdSurface);
    drawResyncTerminalSnap(ctx, width, height, terminal.resync, renderSeed);
    ctx.restore();
  } else {
    drawEntryRuptureSurfaceCracks(ctx, width, height, reveal, backgroundBudget, lcdFracturePlan);
    drawZenSentinelInvocation(ctx, width, height, reveal.timeline, recoveryStarterBurst, renderBudget, reducedMotion, timeMs);
  }
  drawGlobalSentinelPanelOutage(ctx, width, height, reveal, {
    reducedMotion, fracturePlan: lcdFracturePlan, renderProfile: backgroundBudget,
  });
  if (riftPlan?.active) {
    drawGlobalSentinelRiftInterior(ctx, width, height, riftPlan, { backgroundBudget, seed: renderSeed, timeMs, reducedMotion });
    drawGlobalSentinelRiftEdge(ctx, width, height, riftPlan, { backgroundBudget, timeMs, reducedMotion });
  }
}

export function drawNudgeProtocolSceneBackground(ctx, bounds, protocolScene = null, options = {}) {
  if (!ctx || protocolScene?.background?.owner !== 'worker_canvas') return false;
  const renderBudget = resolveSceneRenderBudget(options.renderBudget);
  const mode = protocolScene?.background?.mode || '';
  if (mode === 'global_sentinel_field') {
    const fracture = options.fracture ?? options.breakLevel ?? options.progress ?? options.syncLevel;
    const syncPressure = options.syncPressure ?? options.syncLevel;
    drawGlobalSentinelField(ctx, bounds, {
      archetype: options.simulationBreakArchetype,
      attemptedRepairPressure: options.attemptedRepairPressure,
      syncLevel: options.syncLevel,
      syncPressure,
      fracture,
      fractureThreshold: options.fractureThreshold,
      breakLevel: fracture,
      fractureImpact: options.fractureImpact,
      fractureImpactStrength: options.fractureImpactStrength,
      fractureImpactSerial: options.fractureImpactSerial,
      fractureImpactPoint: options.fractureImpactPoint,
      fractureRepairPulse: options.fractureRepairPulse,
      intensity: protocolScene.protocolIntensity,
      renderBudget,
      impactPoint: options.simulationBreakImpactPoint,
      entryRevealActive: options.simulationBreakEntryRevealActive,
      entryRevealProgress: options.simulationBreakEntryRevealProgress,
      entryHandoffVisible: options.simulationBreakEntryHandoffVisible,
      riftProgress: options.simulationBreakRiftProgress,
      scenePhase: options.scenePhase,
      reducedMotion: options.reducedMotion,
      recoveryStarterBurst: options.recoveryStarterBurst,
      seed: options.simulationBreakSeed,
      terminalSequence: options.terminalSequence,
      timeMs: options.timeMs,
    });
    return true;
  }
  throw new Error(`nudge_background_mode_unhandled:${mode}`);
}

export function drawNudgeProtocolSceneForeground(ctx, bounds, protocolScene = null, options = {}) {
  if (!ctx || protocolScene?.background?.owner !== 'worker_canvas') return false;
  const mode = protocolScene?.background?.mode || '';
  if (mode !== 'global_sentinel_field') return false;
  const fracture = options.fracture ?? options.breakLevel ?? options.progress ?? options.syncLevel;
  const syncPressure = options.syncPressure ?? options.syncLevel;
  drawGlobalSimulationBreakForeground(ctx, bounds, {
    archetype: options.simulationBreakArchetype,
    syncLevel: options.syncLevel,
    syncPressure,
    fracture,
    fractureThreshold: options.fractureThreshold,
    breakLevel: fracture,
    fractureImpact: options.fractureImpact,
    fractureImpactStrength: options.fractureImpactStrength,
    fractureImpactSerial: options.fractureImpactSerial,
    fractureImpactPoint: options.fractureImpactPoint,
    fractureRepairPulse: options.fractureRepairPulse,
    intensity: protocolScene.protocolIntensity,
    renderBudget: resolveSceneRenderBudget(options.renderBudget),
    impactPoint: options.simulationBreakImpactPoint,
    entryRevealActive: options.simulationBreakEntryRevealActive,
    entryRevealProgress: options.simulationBreakEntryRevealProgress,
    riftProgress: options.simulationBreakRiftProgress,
    scenePhase: options.scenePhase,
    reducedMotion: options.reducedMotion,
    repairFrame: options.repairFrame,
    recoveryStarterBurst: options.recoveryStarterBurst,
    seed: options.simulationBreakSeed,
    terminalSequence: options.terminalSequence,
    timeMs: options.timeMs,
  });
  return true;
}
