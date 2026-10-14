import { clamp as clampValue } from '../../../../themes/plugins/zen/api/koi.js';

function drawArrow(ctx, ox, oy, dx, dy, color) {
  const len = Math.hypot(dx, dy);
  if (len < 1e-4) return;
  const nx = dx / len;
  const ny = dy / len;
  const hx = ox + dx;
  const hy = oy + dy;
  const headSize = Math.max(4, Math.min(10, len * 0.16));
  const px = -ny;
  const py = nx;

  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = 1.6;
  ctx.beginPath();
  ctx.moveTo(ox, oy);
  ctx.lineTo(hx, hy);
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(hx, hy);
  ctx.lineTo(hx - nx * headSize + px * headSize * 0.6, hy - ny * headSize + py * headSize * 0.6);
  ctx.lineTo(hx - nx * headSize - px * headSize * 0.6, hy - ny * headSize - py * headSize * 0.6);
  ctx.closePath();
  ctx.fill();
}

export function drawKoiStatusOverlay(adapter, ctx) {
  const head = adapter.history?.[0];
  if (!head) return;
  const dbg = adapter.debugInfo;
  if (!dbg) return;
  const x = head.x + 26;
  const y = head.y - 62;
  const w = 248;
  const lineH = 14;
  const p = 8;
  const lines = [
    `${dbg.model || 'model?'} | ${dbg.mode}/${dbg.cTurn}`,
    `spd ${dbg.speed.toFixed(3)} thr ${dbg.throttle.toFixed(2)} brk ${dbg.brake.toFixed(2)}`,
    `turn ${dbg.turnRate.toFixed(3)} cyc ${dbg.cycleRate.toFixed(3)} tw ${dbg.waveBlend.toFixed(2)}`,
    `kap ${(dbg.turnRef ?? 0).toFixed(3)} ref ${(dbg.turnCommit ?? 0).toFixed(3)} amp ${(dbg.cpgAmp ?? 0).toFixed(2)} omg ${(dbg.cpgOmega ?? 0).toFixed(3)}`,
    `preset ${String(dbg.preset || 'n/a')} slip ${(dbg.slipDeg ?? 0).toFixed(1)}deg`,
    `auth ${(dbg.turnAuthority ?? 0).toFixed(2)} stall ${(dbg.spinStall ?? 0).toFixed(1)}`,
    `act g ${(dbg.globalActivity ?? 1).toFixed(2)} s ${(dbg.sleepBlend ?? 0).toFixed(2)} f ${(dbg.finalActivity ?? 1).toFixed(2)}`,
    `sim x${(dbg.speedScale ?? 1).toFixed(2)} dt x${(dbg.simStepScale ?? 1).toFixed(2)} fin x${(dbg.finFlutterSpeed ?? 1).toFixed(2)}`,
    `wav a${(dbg.waveAmp ?? 1).toFixed(2)} l${(dbg.waveLen ?? 1).toFixed(2)} ph ${Math.abs(dbg.phaseTravel ?? 0).toFixed(2)}`,
    `head ${Math.abs(dbg.headSway ?? 0).toFixed(3)} swim ${Math.abs(dbg.swimScale ?? 0).toFixed(2)} out ${dbg.output.toFixed(4)}`,
  ];
  const h = p * 2 + lines.length * lineH + 4;

  ctx.save();
  ctx.fillStyle = 'rgba(6, 16, 26, 0.82)';
  ctx.strokeStyle = 'rgba(137, 207, 240, 0.55)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.rect(x, y, w, h);
  ctx.fill();
  ctx.stroke();

  ctx.font = '11px ui-monospace, SFMono-Regular, Menlo, Consolas, monospace';
  ctx.fillStyle = 'rgba(214, 243, 255, 0.95)';
  for (let i = 0; i < lines.length; i += 1) {
    ctx.fillText(lines[i], x + p, y + p + 11 + i * lineH);
  }
  ctx.restore();
}

export function drawKoiDebugVectors(adapter, ctx, size = 12) {
  const head = adapter.history?.[0];
  if (!head) return;

  const velocityScale = clampValue(140 + size * 2.2, 120, 210);
  const headingLen = size * 2.1;
  const propulsionLen = size * 1.7;
  const steerLen = size * 1.45;

  ctx.save();
  drawArrow(
    ctx,
    head.x,
    head.y,
    Math.cos(adapter.bodyHeading) * headingLen,
    Math.sin(adapter.bodyHeading) * headingLen,
    'rgba(255, 180, 90, 0.88)',
  );
  drawArrow(
    ctx,
    head.x,
    head.y,
    Math.cos(adapter.propulsionDir) * propulsionLen,
    Math.sin(adapter.propulsionDir) * propulsionLen,
    'rgba(140, 220, 255, 0.82)',
  );
  drawArrow(
    ctx,
    head.x,
    head.y,
    Math.cos(adapter.steerTargetAngle || adapter.bodyHeading) * steerLen,
    Math.sin(adapter.steerTargetAngle || adapter.bodyHeading) * steerLen,
    'rgba(160, 255, 160, 0.78)',
  );
  drawArrow(
    ctx,
    head.x,
    head.y,
    (adapter.velocity?.x || 0) * velocityScale,
    (adapter.velocity?.y || 0) * velocityScale,
    'rgba(255, 120, 120, 0.86)',
  );
  ctx.restore();
}
