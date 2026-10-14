import {
  resolveGlobalSentinelLcdFracturePlan,
  drawGlobalSentinelLcdDamage,
} from '../../domains/nudge/rendering/GlobalSentinelLcdMaterial.js';
import { drawNudgeProtocolSceneBackground } from '../../domains/nudge/rendering/NudgeProtocolSceneBackground.js';
import { resolveNudgeRenderBudget } from '../../domains/nudge/rendering/nudgeRenderBudget.js';

const arrivals = new WeakMap();
const panelPlans = new WeakMap();
const MAX_TEXTURE_WIDTH = 1600;
const MAX_TEXTURE_HEIGHT = 1000;
const renderBudget = resolveNudgeRenderBudget('normal');
const smoothstep = (value) => {
  const t = Math.max(0, Math.min(1, value));
  return t * t * (3 - 2 * t);
};

export function resolveRoom478ArrivalPanels(plan) {
  if (!plan?.skeleton || !Number.isFinite(plan.width) || plan.width <= 0
    || !Number.isFinite(plan.height) || plan.height <= 0) {
    throw new Error('room_478_arrival_plan_invalid');
  }
  const saved = panelPlans.get(plan);
  if (saved) return saved;
  const lcd = resolveGlobalSentinelLcdFracturePlan(plan.skeleton, plan.width, plan.height);
  const panels = lcd.panels.map((panel) => {
    const points = panel.points;
    const area = Math.abs(points.reduce((sum, point, index) => {
      const next = points[(index + 1) % points.length];
      return sum + point[0] * next[1] - next[0] * point[1];
    }, 0)) / 2;
    if (!Number.isFinite(area) || area <= 0) throw new Error('room_478_arrival_panel_invalid');
    const center = points.reduce((sum, point) => [
      sum[0] + point[0] / points.length,
      sum[1] + point[1] / points.length,
    ], [0, 0]);
    return Object.freeze({
      index: panel.index,
      points,
      area,
      angle: Math.atan2(center[1] - lcd.origin[1], center[0] - lcd.origin[0]),
    });
  });
  const totalArea = panels.reduce((sum, panel) => sum + panel.area, 0);
  if (Math.abs(totalArea - plan.width * plan.height) > plan.width * plan.height * 1e-6) {
    throw new Error('room_478_arrival_panel_coverage_invalid');
  }
  const result = Object.freeze(panels);
  panelPlans.set(plan, result);
  return result;
}

export function resolveRoom478ArrivalProjection(plan, progress, reducedMotion = false) {
  if (!Number.isFinite(progress) || progress < 0 || progress > 1) {
    throw new Error('room_478_arrival_progress_invalid');
  }
  const panels = resolveRoom478ArrivalPanels(plan);
  const reach = Math.hypot(plan.width, plan.height) * 1.45;
  const opacity = 1 - smoothstep(reducedMotion ? progress : (progress - 0.88) / 0.1);
  return Object.freeze(panels.map((panel, index) => {
    const lag = index / Math.max(1, panels.length - 1) * 0.065;
    const release = smoothstep((progress - 0.135 - lag) / (0.72 - lag));
    return Object.freeze({
      ...panel,
      x: reducedMotion ? 0 : Math.cos(panel.angle) * reach * release,
      y: reducedMotion ? 0 : Math.sin(panel.angle) * reach * release,
      opacity,
    });
  }));
}

function trace(context, points) {
  context.beginPath();
  points.forEach((point, index) => {
    if (index === 0) context.moveTo(point[0], point[1]);
    else context.lineTo(point[0], point[1]);
  });
  context.closePath();
}

function prepareArrival(root, plan) {
  const world = root.querySelector('.room-478__world');
  if (!world) throw new Error('room_478_arrival_world_missing');
  const texture = root.ownerDocument.createElement('canvas');
  const canvas = root.ownerDocument.createElement('canvas');
  const scale = Math.min(1, MAX_TEXTURE_WIDTH / plan.width, MAX_TEXTURE_HEIGHT / plan.height);
  texture.width = canvas.width = Math.max(1, Math.round(plan.width * scale));
  texture.height = canvas.height = Math.max(1, Math.round(plan.height * scale));
  const material = texture.getContext('2d');
  const context = canvas.getContext('2d');
  if (!material || !context) throw new Error('room_478_arrival_canvas_unavailable');
  material.scale(scale, scale);
  // This is the Room's settled white LCD projection, using the same seeded
  // material and fracture vertices as Global. It contains no source-page image.
  drawNudgeProtocolSceneBackground(material, plan,
    { background: { owner: 'worker_canvas', mode: 'global_sentinel_field' }, protocolIntensity: 0.88 },
    { renderBudget, simulationBreakSeed: plan.handoff.seed,
      simulationBreakImpactPoint: plan.handoff.origin, simulationBreakArchetype: plan.skeleton.archetype,
      simulationBreakEntryRevealActive: false, fracture: 1, syncPressure: 0, syncLevel: 0, timeMs: 0 });
  const lcd = resolveGlobalSentinelLcdFracturePlan(plan.skeleton, plan.width, plan.height);
  drawGlobalSentinelLcdDamage(material, lcd, renderBudget.globalBackground,
    { damage: 1, opacity: 1, impact: 0, recovery: 1 });
  material.globalCompositeOperation = 'destination-out';
  trace(material, plan.rift.contour);
  material.fill();
  material.globalCompositeOperation = 'source-over';
  canvas.className = 'room-478__arrival-panels';
  canvas.setAttribute('aria-hidden', 'true');
  canvas.setAttribute('data-room478-arrival-panels', '');
  world.append(canvas);
  const state = { canvas, context, texture, scale, plan, progress: null, reducedMotion: null };
  arrivals.set(root, state);
  return state;
}

export function releaseRoom478Arrival(root) {
  const state = arrivals.get(root);
  if (!state) return;
  state.canvas.remove();
  state.canvas.width = state.canvas.height = 0;
  state.texture.width = state.texture.height = 0;
  arrivals.delete(root);
}

export function applyRoom478Arrival(root, frame, plan, { reducedMotion = false, arrivalDurationMs } = {}) {
  root.dataset.room478Arrival = frame.arrivalProgress >= 1 ? 'settled' : 'panels';
  if (frame.arrivalProgress >= 1) {
    releaseRoom478Arrival(root);
    return;
  }
  if (!Number.isFinite(frame.elapsedMs) || frame.elapsedMs < 0
    || !Number.isFinite(arrivalDurationMs) || arrivalDurationMs <= 0) {
    throw new Error('room_478_arrival_clock_invalid');
  }
  let state = arrivals.get(root);
  if (state && state.plan !== plan) {
    releaseRoom478Arrival(root);
    state = null;
  }
  if (!state) state = prepareArrival(root, plan);
  // The experience owns the clock and visibility. Cache paint on its 30 Hz
  // projection boundary; no additional frame loop, timer or pixel readback.
  const paintBucket = Math.floor(frame.elapsedMs / (1000 / 30));
  if (state.progress === paintBucket && state.reducedMotion === reducedMotion) return;
  state.progress = paintBucket;
  state.reducedMotion = reducedMotion;
  const { context, canvas, texture, scale } = state;
  context.setTransform(1, 0, 0, 1, 0, 0);
  context.clearRect(0, 0, canvas.width, canvas.height);
  context.scale(scale, scale);
  resolveRoom478ArrivalProjection(plan, Math.min(1, frame.elapsedMs / arrivalDurationMs), reducedMotion).forEach((panel) => {
    context.save();
    context.globalAlpha = panel.opacity;
    context.translate(panel.x, panel.y);
    trace(context, panel.points);
    context.clip();
    context.drawImage(texture, 0, 0, plan.width, plan.height);
    context.restore();
  });
}
