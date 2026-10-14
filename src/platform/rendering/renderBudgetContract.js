export const RENDER_BUDGET_SCHEMA_VERSION = 1;
export const RENDER_PIXEL_RATIO_CAPS = Object.freeze([1, 1.25, 1.5, 2]);

export function requireRenderPixelRatioCap(value) {
  if (!RENDER_PIXEL_RATIO_CAPS.includes(value)) {
    throw new Error('RENDER_BUDGET_PIXEL_RATIO_CAP_UNSUPPORTED');
  }
  return value;
}

function assertFiniteNumber(value, field) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    throw new Error(`RENDER_BUDGET_${field.toUpperCase()}_INVALID`);
  }
  return numeric;
}

function assertNonEmptyString(value, field) {
  const normalized = typeof value === 'string' ? value.trim() : '';
  if (!normalized) {
    throw new Error(`RENDER_BUDGET_${field.toUpperCase()}_INVALID`);
  }
  return normalized;
}

export function createRenderBudget({
  policyId,
  targetFps,
  pixelRatioCap,
  maxRenderPixels,
} = {}) {
  const resolvedTargetFps = assertFiniteNumber(targetFps, 'target_fps');
  const resolvedPixelRatioCap = assertFiniteNumber(pixelRatioCap, 'pixel_ratio_cap');
  const resolvedMaxRenderPixels = Math.floor(assertFiniteNumber(
    maxRenderPixels,
    'max_render_pixels',
  ));

  if (resolvedTargetFps <= 0 || resolvedTargetFps > 240) {
    throw new Error('RENDER_BUDGET_TARGET_FPS_OUT_OF_RANGE');
  }
  requireRenderPixelRatioCap(resolvedPixelRatioCap);
  if (resolvedMaxRenderPixels < 1 || resolvedMaxRenderPixels > 134_217_728) {
    throw new Error('RENDER_BUDGET_MAX_RENDER_PIXELS_OUT_OF_RANGE');
  }

  return Object.freeze({
    schemaVersion: RENDER_BUDGET_SCHEMA_VERSION,
    policyId: assertNonEmptyString(policyId, 'policy_id'),
    targetFps: resolvedTargetFps,
    pixelRatioCap: resolvedPixelRatioCap,
    maxRenderPixels: resolvedMaxRenderPixels,
  });
}

export function resolveRenderResolution({
  cssWidth,
  cssHeight,
  devicePixelRatio,
  renderBudget,
} = {}) {
  if (!renderBudget || renderBudget.schemaVersion !== RENDER_BUDGET_SCHEMA_VERSION) {
    throw new Error('RENDER_BUDGET_CONTRACT_REQUIRED');
  }
  return resolveRasterResolution({ cssWidth, cssHeight, devicePixelRatio,
    pixelRatioCap: renderBudget.pixelRatioCap, maxRenderPixels: renderBudget.maxRenderPixels });
}

// Static canvases and scheduled renderers share the same resolution calculation.
// Caps are discrete policy choices; the effective ratio preserves fractional DPR
// and can go below one to respect the owning surface's pixel budget.
export function resolveRasterResolution({
  cssWidth, cssHeight, devicePixelRatio, pixelRatioCap, maxRenderPixels,
} = {}) {
  const width = assertFiniteNumber(cssWidth, 'css_width');
  const height = assertFiniteNumber(cssHeight, 'css_height');
  const requestedRatio = assertFiniteNumber(devicePixelRatio, 'device_pixel_ratio');
  if (width <= 0 || height <= 0) {
    throw new Error('RENDER_BUDGET_VIEWPORT_OUT_OF_RANGE');
  }
  if (requestedRatio <= 0) {
    throw new Error('RENDER_BUDGET_DEVICE_PIXEL_RATIO_OUT_OF_RANGE');
  }
  requireRenderPixelRatioCap(pixelRatioCap);
  if (!Number.isInteger(maxRenderPixels) || maxRenderPixels < 1 || maxRenderPixels > 134_217_728) {
    throw new Error('RENDER_BUDGET_MAX_RENDER_PIXELS_OUT_OF_RANGE');
  }

  const ratioFromPixelBudget = Math.sqrt(maxRenderPixels / (width * height));
  const effectivePixelRatio = Math.min(
    requestedRatio,
    pixelRatioCap,
    ratioFromPixelBudget,
  );
  const pixelWidth = Math.max(1, Math.floor(width * effectivePixelRatio));
  const pixelHeight = Math.max(1, Math.floor(height * effectivePixelRatio));

  return Object.freeze({
    cssWidth: width,
    cssHeight: height,
    requestedPixelRatio: requestedRatio,
    effectivePixelRatio,
    pixelWidth,
    pixelHeight,
    pixelCount: pixelWidth * pixelHeight,
    limitedByPixelRatioCap: pixelRatioCap < requestedRatio
      && pixelRatioCap <= ratioFromPixelBudget,
    limitedByPixelBudget: ratioFromPixelBudget < requestedRatio
      && ratioFromPixelBudget < pixelRatioCap,
  });
}
