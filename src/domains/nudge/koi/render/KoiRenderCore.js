import { clamp as clampValue } from '../../../../themes/plugins/zen/api/koi.js';
import {
  createKoiRenderFrameState,
  resolveKoiRenderPolicy,
} from './KoiRenderContract.js';
import {
  createKoiBodyPath,
  resolveKoiExpressionVisualScale,
  resolveKoiRenderContract,
} from './KoiRenderGeometry.js';
import { drawKoiBodyShape } from './KoiRenderBody.js';
import { drawKoiPectoralFins } from './KoiRenderFins.js';
import { drawKoiLabel } from './KoiRenderDecorations.js';
import { drawKoiDebugVectors, drawKoiStatusOverlay } from './KoiRenderDebug.js';

function applyCanvasShadowSurfaceTransform(ctx, surface) {
  if (!surface?.anchor?.point) {
    throw new Error('KOI_SHADOW_SURFACE_CONTRACT_MISSING');
  }
  const anchor = surface.anchor.point;
  const offset = surface.offset || {};
  ctx.translate(
    (Number(anchor.x) || 0) + (Number(offset.x) || 0),
    (Number(anchor.y) || 0) + (Number(offset.y) || 0),
  );
  ctx.scale(Math.max(0.01, Number(surface.scale) || 1), Math.max(0.01, Number(surface.scale) || 1));
  ctx.translate(-(Number(anchor.x) || 0), -(Number(anchor.y) || 0));
}

export function renderKoiWithAdapter(ctx, adapter, frameStateInput = null) {
  if (!ctx || !adapter) return;

  const frameState = createKoiRenderFrameState(frameStateInput || {});
  const {
    frameCount,
    isSelected,
    eyeFB,
    eyeSP,
    envState,
  } = frameState;

  if ((adapter.history?.length || 0) < 5) return;
  const visualScale = resolveKoiExpressionVisualScale(adapter);
  const size = adapter.baseSize * adapter.hoverScale * visualScale;
  const renderPolicy = resolveKoiRenderPolicy(envState);
  const isForcedShadow = renderPolicy?.mode === 'shadow';
  const rawShadowProfile = adapter.shadowRenderProfile && typeof adapter.shadowRenderProfile === 'object'
    ? adapter.shadowRenderProfile
    : {};
  const shadowScale = clampValue(Number(rawShadowProfile.scale) || 0.88, 0.8, 0.95);

  ctx.save();

  const renderContract = resolveKoiRenderContract({
    adapter,
    history: adapter.history,
    renderSpine: adapter.history,
    size,
    visualScale: 1,
    shadowProfile: {
      ...rawShadowProfile,
      scale: shadowScale,
    },
  });
  if (!renderContract) {
    ctx.restore();
    return;
  }
  const renderPose = renderContract.pose;
  const pectoralPose = renderPose.appendages.pectoral;
  const ventralPose = renderPose.appendages.ventral;
  const bodyGeometry = createKoiBodyPath(adapter, null, size, true);

  if (isForcedShadow) {
    ctx.shadowColor = 'rgba(0, 0, 0, 0.24)';
    ctx.shadowBlur = Math.max(0.8, size * 0.08);
    const includePectoral = renderPolicy?.passes?.pectoral !== false;
    const prevShadowBodyAlpha = adapter.shadowBodyAlpha;
    const prevShadowTailAlpha = adapter.shadowTailAlpha;
    const prevShadowFinAlpha = adapter.shadowFinAlpha;
    const prevShadowOutlineColor = adapter.shadowOutlineColor;
    const prevShadowOutlineWidthScale = adapter.shadowOutlineWidthScale;

    const nextShadowBodyAlpha = Number(renderPolicy?.shadowBodyAlpha);
    const nextShadowTailAlpha = Number(renderPolicy?.shadowTailAlpha);
    const nextShadowFinAlpha = Number(renderPolicy?.shadowFinAlpha);
    const nextShadowOutlineColor = typeof renderPolicy?.shadowOutlineColor === 'string'
      ? renderPolicy.shadowOutlineColor
      : '';
    const nextShadowOutlineWidthScale = Number(renderPolicy?.shadowOutlineWidthScale);
    if (Number.isFinite(nextShadowBodyAlpha)) adapter.shadowBodyAlpha = nextShadowBodyAlpha;
    if (Number.isFinite(nextShadowTailAlpha)) adapter.shadowTailAlpha = nextShadowTailAlpha;
    if (Number.isFinite(nextShadowFinAlpha)) adapter.shadowFinAlpha = nextShadowFinAlpha;
    if (nextShadowOutlineColor) adapter.shadowOutlineColor = nextShadowOutlineColor;
    if (Number.isFinite(nextShadowOutlineWidthScale)) {
      adapter.shadowOutlineWidthScale = nextShadowOutlineWidthScale;
    }

    if (includePectoral) {
      drawKoiPectoralFins(
        adapter,
        ctx,
        pectoralPose.point.x,
        pectoralPose.point.y,
        pectoralPose.point.angle,
        size,
        pectoralPose.radius,
        true,
        pectoralPose.bend,
        pectoralPose.index,
        true,
        renderPolicy,
      );
      drawKoiPectoralFins(
        adapter,
        ctx,
        ventralPose.point.x,
        ventralPose.point.y,
        ventralPose.point.angle,
        size * 0.75,
        ventralPose.radius,
        false,
        ventralPose.bend,
        ventralPose.index,
        true,
        renderPolicy,
      );
    }
    drawKoiBodyShape(adapter, ctx, size, true, eyeFB, eyeSP, bodyGeometry, envState);

    adapter.shadowBodyAlpha = prevShadowBodyAlpha;
    adapter.shadowTailAlpha = prevShadowTailAlpha;
    adapter.shadowFinAlpha = prevShadowFinAlpha;
    adapter.shadowOutlineColor = prevShadowOutlineColor;
    adapter.shadowOutlineWidthScale = prevShadowOutlineWidthScale;
    ctx.restore();
    return;
  }

  const shadowEnabled = rawShadowProfile.enabled !== false;
  const shadowCadence = Math.max(0, Math.floor(Number(rawShadowProfile.cadence) || 0));
  const shouldRenderShadow = shadowEnabled
    && shadowCadence > 0
    && ((frameCount + adapter.uid) % shadowCadence === 0);
  if (shouldRenderShadow) {
    const shadowBlur = Math.max(0, Number(rawShadowProfile.blur) || 0);
    const shadowOpacity = clampValue(Number(rawShadowProfile.opacity) || 0.2, 0.06, 0.35);
    const shadowAlphaScale = clampValue(shadowOpacity / 0.2, 0.45, 1.45);

    ctx.save();
    applyCanvasShadowSurfaceTransform(ctx, renderContract.surfaces.shadow);
    ctx.globalAlpha = shadowAlphaScale;
    if (shadowBlur > 0) {
      ctx.shadowColor = `rgba(0, 15, 10, ${clampValue(0.15 + shadowOpacity * 0.7, 0.12, 0.32)})`;
      ctx.shadowBlur = shadowBlur;
    } else {
      ctx.shadowBlur = 0;
    }
    drawKoiBodyShape(adapter, ctx, size, true, eyeFB, eyeSP, bodyGeometry, envState);
    ctx.restore();
  }

  drawKoiPectoralFins(
    adapter,
    ctx,
    pectoralPose.point.x,
    pectoralPose.point.y,
    pectoralPose.point.angle,
    size,
    pectoralPose.radius,
    true,
    pectoralPose.bend,
    pectoralPose.index,
    false,
  );
  drawKoiPectoralFins(
    adapter,
    ctx,
    ventralPose.point.x,
    ventralPose.point.y,
    ventralPose.point.angle,
    size * 0.75,
    ventralPose.radius,
    false,
    ventralPose.bend,
    ventralPose.index,
    false,
  );

  ctx.save();
  drawKoiBodyShape(adapter, ctx, size, false, eyeFB, eyeSP, bodyGeometry, envState);
  ctx.restore();
  drawKoiLabel(adapter, ctx, size);
  if (isSelected) {
    const showVectors = adapter.tuning?.physics?.debugVectors ?? false;
    const showOverlay = adapter.tuning?.physics?.debugOverlay ?? false;
    if (showVectors) {
      drawKoiDebugVectors(adapter, ctx, size);
    }
    if (showOverlay) {
      drawKoiStatusOverlay(adapter, ctx);
    }
  }
  ctx.restore();
}
