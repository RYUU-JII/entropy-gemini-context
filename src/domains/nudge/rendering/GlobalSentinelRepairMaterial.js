const unit = value => Math.max(0, Math.min(1, value));
const smooth = value => { const t = unit(value); return t * t * (3 - 2 * t); };
const mix = (a, b, t) => a + (b - a) * t;
const pointAt = (a, b, t) => [mix(a[0], b[0], t), mix(a[1], b[1], t)];
const sites = new WeakMap();

export function resolveGlobalSentinelRefractureGrowth(elapsedMs) {
  if (!Number.isFinite(elapsedMs) || elapsedMs < 0) {
    throw new Error('GLOBAL_SENTINEL_REFRACTURE_TIME_INVALID');
  }
  // Physical impact is sub-frame. Project the accepted canonical fracture on
  // the first display frame; optical settling never delays its visible front.
  return 1;
}

// A repair site is a section of an existing primary fracture. Neither a fish
// position nor an accepted click can invent a disconnected crack or aperture.
export function resolveGlobalSentinelRepairSite(skeleton, beatIndex) {
  if (!skeleton?.primaryPaths?.length || !Number.isInteger(beatIndex) || beatIndex < 0) {
    throw new Error('GLOBAL_SENTINEL_REPAIR_SITE_INPUT_INVALID');
  }
  let plans = sites.get(skeleton);
  if (!plans) {
    plans = skeleton.primaryPaths.map((path, index) => {
      const points = [pointAt(path.points[0], path.points[1], 0.28), path.points[1]];
      return Object.freeze({
        pathIndex: index,
        points: Object.freeze(points.map(point => Object.freeze(point))),
        anchor: Object.freeze(pointAt(points[0], points[1], 0.72)),
        path: path.points,
        origin: skeleton.impactPoint,
      });
    });
    sites.set(skeleton, plans);
  }
  return plans[(beatIndex + skeleton.renderSeed % plans.length) % plans.length];
}

export function resolveGlobalSentinelRepairFrame({
  skeleton, rhythm, fracture, entity, burst, now, scenePhase,
  repairAmount, repairElapsedMs, repairDurationMs, repairBeatIndex,
  reducedMotion = false,
}) {
  if (scenePhase !== 'ritual') return null;
  if (burst?.hitAftermath === true && burst.repairSite) {
    const progress = unit((now - burst.startedAtMs) / burst.durationMs);
    if (progress < 1) {
      const elapsedMs = Math.max(0, now - burst.startedAtMs);
      const growth = resolveGlobalSentinelRefractureGrowth(elapsedMs);
      return {
        mode: 'rupture', site: burst.repairSite, actor: burst.repairSource,
        progress, elapsedMs, growth, opacity: 1 - smooth((progress - 0.78) / 0.22),
        displayFracture: fracture,
        fractureBefore: burst.fractureBefore, fractureAfter: fracture,
        terminal: burst.terminalHit, reducedMotion,
      };
    }
  }
  if (rhythm.beatIndex < 0) return null;
  let sealed = null;
  if (repairAmount > 0 && repairElapsedMs > 0) {
    if (!Number.isInteger(repairBeatIndex) || repairBeatIndex < 0) {
      throw new Error('GLOBAL_SENTINEL_REPAIR_BEAT_REQUIRED');
    }
    sealed = {
      site: resolveGlobalSentinelRepairSite(skeleton, repairBeatIndex),
      // Continue from the closing vulnerability window, without reopening
      // the already stitched section at the exact moment a beat is missed.
      progress: 0.76 + 0.24 * smooth(repairElapsedMs / repairDurationMs),
    };
  }
  if (rhythm.active && !rhythm.consumed && entity && ['approach', 'lock', 'active'].includes(rhythm.phase)) {
    const contact = smooth((rhythm.telegraphProgress - 0.12) / 0.58);
    return {
      mode: 'weave', site: resolveGlobalSentinelRepairSite(skeleton, rhythm.beatIndex),
      actor: entity, contact, sealed,
      progress: contact * (0.42 + (rhythm.phase === 'active' ? 0.34 * rhythm.vulnerabilityProgress : 0)),
      tension: rhythm.phase === 'active' ? 1 : smooth((rhythm.telegraphProgress - 0.58) / 0.42),
      opacity: smooth(rhythm.telegraphProgress / 0.24), displayFracture: fracture, reducedMotion,
    };
  }
  return sealed ? { mode: 'sealed', sealed, displayFracture: fracture, reducedMotion } : null;
}

function trace(ctx, points) {
  ctx.beginPath();
  points.forEach((point, i) => i === 0 ? ctx.moveTo(...point) : ctx.lineTo(...point));
}

function drawRepairPatch(ctx, width, height, site, progress, budget, { tension = 0, opacity = 1 } = {}) {
  if (progress <= 0 || opacity <= 0) return;
  const a = [site.points[0][0] * width, site.points[0][1] * height];
  const b = [site.points[1][0] * width, site.points[1][1] * height];
  const length = Math.hypot(b[0] - a[0], b[1] - a[1]);
  if (length < 1) return;
  const normal = [-(b[1] - a[1]) / length, (b[0] - a[0]) / length];
  const end = pointAt(a, b, progress);
  const halfWidth = Math.max(1.7, Math.min(3.2, Math.min(width, height) * 0.003));
  ctx.save();
  ctx.globalCompositeOperation = 'source-over';
  ctx.shadowBlur = 0;
  // A restored strip of LCD, rather than a glow floating above an unchanged
  // black crack. It actually occludes fracture ink and defective subpixels.
  const paper = ctx.createLinearGradient(
    a[0] - normal[0] * halfWidth, a[1] - normal[1] * halfWidth,
    a[0] + normal[0] * halfWidth, a[1] + normal[1] * halfWidth,
  );
  paper.addColorStop(0, 'rgba(242, 248, 251, 0)');
  paper.addColorStop(0.3, 'rgba(242, 248, 251, 1)');
  paper.addColorStop(0.7, 'rgba(242, 248, 251, 1)');
  paper.addColorStop(1, 'rgba(242, 248, 251, 0)');
  trace(ctx, [
    [a[0] + normal[0] * halfWidth, a[1] + normal[1] * halfWidth],
    [end[0] + normal[0] * halfWidth, end[1] + normal[1] * halfWidth],
    [end[0] - normal[0] * halfWidth, end[1] - normal[1] * halfWidth],
    [a[0] - normal[0] * halfWidth, a[1] - normal[1] * halfWidth],
  ]);
  ctx.closePath();
  ctx.globalAlpha = opacity * 0.98;
  ctx.fillStyle = paper;
  ctx.fill();
  // Small compression marks lie on the contacted seam, not a coloured fabric
  // pattern laid over the display. They close into the restored LCD material.
  ctx.beginPath();
  const spacing = halfWidth * (0.42 - progress * 0.25);
  for (let i = 0; i < budget.repairStitches; i += 1) {
    const t = (i + 0.35 + Math.sin(i * 2.71) * 0.16) / budget.repairStitches;
    if (t > progress) break;
    const point = pointAt(a, b, t);
    ctx.moveTo(point[0] - normal[0] * spacing, point[1] - normal[1] * spacing);
    ctx.lineTo(point[0] + normal[0] * spacing, point[1] + normal[1] * spacing);
  }
  ctx.lineWidth = 0.45;
  ctx.globalAlpha = opacity * (0.25 + tension * 0.12) * Math.sqrt(1 - progress);
  ctx.strokeStyle = '#737a80';
  ctx.stroke();
  const tangent = [(b[0] - a[0]) / length, (b[1] - a[1]) / length];
  trace(ctx, [a, end]);
  ctx.strokeStyle = '#8e969c';
  ctx.lineWidth = 0.5;
  ctx.globalAlpha = opacity * (0.42 + tension * 0.26) * (1 - progress);
  ctx.stroke();
  const lightSign = -normal[0] * 0.6 - normal[1] * 0.8 >= 0 ? 1 : -1;
  const glint = end;
  const reach = 0.6 + tension * 0.2;
  // A tiny attached bevel answers contact; no round flash invents a new hole.
  trace(ctx, [
    glint,
    [glint[0] + tangent[0] * 1.7, glint[1] + tangent[1] * 1.7],
    [glint[0] + tangent[0] * 0.8 + normal[0] * lightSign * reach,
      glint[1] + tangent[1] * 0.8 + normal[1] * lightSign * reach],
  ]);
  ctx.closePath();
  ctx.fillStyle = '#f7f8fa';
  ctx.globalAlpha = opacity * 0.42 * (1 - smooth((progress - 0.9) / 0.1));
  ctx.fill();
  ctx.restore();
}

function requireRepairContactFront(width, height, site, lcdSurface) {
  if (!Number.isInteger(site?.pathIndex) || !Array.isArray(lcdSurface?.rays)) {
    throw new Error('GLOBAL_SENTINEL_REPAIR_LCD_FRONT_REQUIRED');
  }
  const matching = lcdSurface.rays.filter(ray => ray?.pathIndex === site.pathIndex);
  if (matching.length !== 1 || !Array.isArray(matching[0].points) || matching[0].points.length < 2) {
    throw new Error('GLOBAL_SENTINEL_REPAIR_LCD_FRONT_REQUIRED');
  }
  if (!(Number.isFinite(width) && width > 0 && Number.isFinite(height) && height > 0)
    || !Array.isArray(site.anchor) || site.anchor.length !== 2 || !site.anchor.every(Number.isFinite)
    || !matching[0].points.every(point => Array.isArray(point) && point.length === 2 && point.every(Number.isFinite))) {
    throw new Error('GLOBAL_SENTINEL_REPAIR_LCD_FRONT_INVALID');
  }
  // The selected LCD front proves this contact still belongs to the visible
  // network. Its points are never spliced, traced or shaded by the repair pass.
}

function resolveRepairOpticalSettling(frame) {
  // An artistic damping envelope for contact width/light, not a fracture speed
  // or another clock. The entire accepted path is already visible at elapsed 0.
  return Math.exp(-frame.elapsedMs / 55);
}

function drawRepairContact(ctx, width, height, frame) {
  const settling = resolveRepairOpticalSettling(frame);
  const a = frame.site.points[0], b = frame.site.points[1];
  const dx = (b[0] - a[0]) * width, dy = (b[1] - a[1]) * height;
  const length = Math.hypot(dx, dy);
  if (length < 1) return;
  const tangent = [dx / length, dy / length], normal = [-dy / length, dx / length];
  const contact = [frame.site.anchor[0] * width, frame.site.anchor[1] * height];
  const halfWidth = Math.max(1.7, Math.min(3.2, Math.min(width, height) * 0.003));
  const contactLength = Math.max(3.4, halfWidth * (1.8 + settling * 1.8));
  ctx.save();
  ctx.globalCompositeOperation = 'source-over';
  ctx.shadowBlur = 0;
  trace(ctx, [
    [contact[0] - tangent[0] * contactLength / 2, contact[1] - tangent[1] * contactLength / 2],
    [contact[0] + tangent[0] * contactLength / 2, contact[1] + tangent[1] * contactLength / 2],
  ]);
  ctx.strokeStyle = '#30343a';
  ctx.lineWidth = 0.65 + settling * 0.3;
  ctx.globalAlpha = frame.opacity * settling;
  ctx.stroke();
  const lightSign = -normal[0] * 0.6 - normal[1] * 0.8 >= 0 ? 1 : -1;
  const reach = 0.8 + settling * 0.35;
  trace(ctx, [contact,
    [contact[0] + tangent[0] * 1.7, contact[1] + tangent[1] * 1.7],
    [contact[0] + tangent[0] * 0.8 + normal[0] * lightSign * reach,
      contact[1] + tangent[1] * 0.8 + normal[1] * lightSign * reach],
  ]);
  ctx.closePath();
  ctx.fillStyle = '#f7f8fa';
  ctx.globalAlpha = frame.opacity * settling * 0.55;
  ctx.fill();
  ctx.restore();
}

export function drawGlobalSentinelRepairMaterial(ctx, width, height, frame, budget, lcdSurface) {
  if (!frame) return;
  if (frame.mode === 'rupture') {
    if (!frame.reducedMotion) {
      requireRepairContactFront(width, height, frame.site, lcdSurface);
      drawRepairContact(ctx, width, height, frame);
    }
    return;
  }
  if (frame.sealed) drawRepairPatch(ctx, width, height, frame.sealed.site, frame.sealed.progress, budget);
  if (frame.mode === 'weave') {
    drawRepairPatch(ctx, width, height, frame.site, frame.progress, budget, frame);
  }
}
