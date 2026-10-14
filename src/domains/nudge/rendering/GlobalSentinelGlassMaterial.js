import { drawGlobalSentinelLcdCollapse } from './GlobalSentinelLcdMaterial.js';

export { strokeGlobalSentinelGlassCrack } from './GlobalSentinelGlassStroke.js';

export function drawGlobalSentinelPanelOutage(ctx, width, height, reveal, {
  reducedMotion = false,
  fracturePlan,
  renderProfile,
} = {}) {
  if (!reveal.active || reveal.timeline.fieldVisible) return;
  const { blackout, signalKick } = reveal.timeline;
  if (blackout <= 0 && signalKick <= 0) return;
  ctx.save();
  ctx.globalCompositeOperation = 'source-over';
  if (blackout < 1 && signalKick > 0) {
    drawGlobalSentinelLcdCollapse(ctx, fracturePlan, renderProfile, reveal.timeline, reducedMotion);
  }
  // The last pass occludes all panels, live-page remnants, ink and emission.
  if (blackout > 0) {
    ctx.globalAlpha = blackout;
    ctx.fillStyle = '#020305';
    ctx.fillRect(0, 0, width, height);
  }
  ctx.restore();
}
