import {
  buildKoiBodyContour,
  createKoiBodyPath2D,
  DEFAULT_KOI_TUNING,
  resolveKoiBodyRadius,
  traceKoiBodyContourPath,
} from '../../../../themes/plugins/zen/api/koi.js';

const KOI_EXPRESSION_VISUAL_SCALE_MIN = 0.96;
const KOI_EXPRESSION_VISUAL_SCALE_MAX = 1.18;
const KOI_BODY_VISUAL_ANCHOR_RATIO = 0.35;

const clampNumber = (value, min, max) => (
  Math.min(max, Math.max(min, value))
);

const toFiniteNumber = (value, fallback = 0) => {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : fallback;
};

const toSafeIndex = (value, fallback = 0) => {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? Math.round(numeric) : fallback;
};

export function resolveKoiDimensionInputs(adapter, tuningOverride) {
  const cfg = tuningOverride || adapter.tuning || DEFAULT_KOI_TUNING;
  const tunedBaseSize = Number(cfg.baseSize);
  const currentBaseSize = Number(adapter.baseSize);
  const baseSize = Number.isFinite(tunedBaseSize) && tunedBaseSize > 0 && currentBaseSize !== tunedBaseSize
    ? tunedBaseSize
    : currentBaseSize > 0
      ? currentBaseSize
      : adapter.getSize();
  const historyLength = Math.max(1, Math.round(Number(cfg.historyLength) || 20));

  return {
    cfg,
    baseSize,
    historyLength,
    segmentSpacing: baseSize * 0.21,
  };
}

export function getKoiBodyRadius(adapter, t, size) {
  return resolveKoiBodyRadius(t, size, adapter.tuning || DEFAULT_KOI_TUNING);
}

export function resolveKoiExpressionVisualScale(adapter = null) {
  return clampNumber(
    toFiniteNumber(adapter?.expressionProfile?.size?.effectiveScale, 1),
    KOI_EXPRESSION_VISUAL_SCALE_MIN,
    KOI_EXPRESSION_VISUAL_SCALE_MAX,
  );
}

export function resolveKoiBodyVisualAnchorIndex(history = []) {
  const length = Array.isArray(history) ? history.length : 0;
  if (length <= 1) return 0;
  return Math.max(0, Math.min(
    length - 1,
    Math.floor((length - 1) * KOI_BODY_VISUAL_ANCHOR_RATIO),
  ));
}

export function resolveKoiSpineRenderAngle(point = null, fallback = 0) {
  const numeric = Number(point?.angle);
  return Number.isFinite(numeric) ? numeric : fallback;
}

export function resolveKoiRenderSpinePoint({
  history = [],
  renderSpine = history,
  index = 0,
  fallbackIndex = 0,
} = {}) {
  const sourceHistory = Array.isArray(history) ? history : [];
  const sourceSpine = Array.isArray(renderSpine) ? renderSpine : sourceHistory;
  const safeIndex = Math.max(0, Math.min(
    Math.max(sourceHistory.length, sourceSpine.length) - 1,
    toSafeIndex(index, fallbackIndex),
  ));
  const fallback = sourceHistory[safeIndex] || sourceHistory[fallbackIndex] || sourceSpine[fallbackIndex] || null;
  const point = sourceSpine[safeIndex] || fallback || { x: 0, y: 0, angle: 0 };
  const fallbackAngle = resolveKoiSpineRenderAngle(fallback, 0);
  return {
    x: toFiniteNumber(point?.x, toFiniteNumber(fallback?.x, 0)),
    y: toFiniteNumber(point?.y, toFiniteNumber(fallback?.y, 0)),
    angle: resolveKoiSpineRenderAngle(point, fallbackAngle),
  };
}

export function projectKoiVisualPoint(point = null, anchor = null, scale = 1) {
  const sourceX = toFiniteNumber(point?.x, 0);
  const sourceY = toFiniteNumber(point?.y, 0);
  const anchorX = toFiniteNumber(anchor?.x, sourceX);
  const anchorY = toFiniteNumber(anchor?.y, sourceY);
  const visualScale = clampNumber(
    toFiniteNumber(scale, 1),
    KOI_EXPRESSION_VISUAL_SCALE_MIN,
    KOI_EXPRESSION_VISUAL_SCALE_MAX,
  );
  return {
    x: anchorX + ((sourceX - anchorX) * visualScale),
    y: anchorY + ((sourceY - anchorY) * visualScale),
    angle: Number.isFinite(Number(point?.angle)) ? Number(point.angle) : undefined,
  };
}

export function resolveKoiShadowSurfaceProjection({
  adapter = null,
  history = adapter?.history,
  renderSpine = history,
  anchorIndex = resolveKoiBodyVisualAnchorIndex(history),
  depth = adapter?.depth,
  scale = 1,
  offsetBase = 15,
  offsetDepthScale = 10,
  offsetScale = 1,
  offsetYScale = 1.5,
} = {}) {
  const sourceHistory = Array.isArray(history) ? history : [];
  if (sourceHistory.length === 0) return null;
  const safeAnchorIndex = Math.max(0, Math.min(
    sourceHistory.length - 1,
    toSafeIndex(anchorIndex, resolveKoiBodyVisualAnchorIndex(sourceHistory)),
  ));
  const anchorPoint = resolveKoiRenderSpinePoint({
    history: sourceHistory,
    renderSpine,
    index: safeAnchorIndex,
  });
  const shadowOffset = (
    toFiniteNumber(offsetBase, 15)
    + toFiniteNumber(depth, 0) * toFiniteNumber(offsetDepthScale, 10)
  ) * toFiniteNumber(offsetScale, 1);
  return {
    kind: 'shadow',
    anchor: {
      index: safeAnchorIndex,
      point: anchorPoint,
    },
    scale: Math.max(0.01, toFiniteNumber(scale, 1)),
    offset: {
      x: shadowOffset,
      y: shadowOffset * toFiniteNumber(offsetYScale, 1.5),
    },
  };
}

export function projectKoiShadowSurfacePoint(point = null, surface = null, output = null) {
  if (!surface?.anchor?.point) return null;
  const target = output && typeof output === 'object' ? output : {};
  const sourceX = toFiniteNumber(point?.x, 0);
  const sourceY = toFiniteNumber(point?.y, 0);
  const anchorPoint = surface.anchor.point;
  const anchorX = toFiniteNumber(anchorPoint?.x, sourceX);
  const anchorY = toFiniteNumber(anchorPoint?.y, sourceY);
  const shadowScale = Math.max(0.01, toFiniteNumber(surface.scale, 1));
  const offsetX = toFiniteNumber(surface.offset?.x, 0);
  const offsetY = toFiniteNumber(surface.offset?.y, 0);
  target.x = anchorX + ((sourceX - anchorX) * shadowScale) + offsetX;
  target.y = anchorY + ((sourceY - anchorY) * shadowScale) + offsetY;
  target.angle = Number.isFinite(Number(point?.angle)) ? Number(point.angle) : undefined;
  return target;
}

export function resolveKoiAppendageIndices({
  historyLength = 0,
  neckIndex = 0,
  tuning = null,
} = {}) {
  const length = Math.max(0, Math.floor(Number(historyLength) || 0));
  if (length <= 0) {
    return {
      pectoralIndex: 0,
      ventralIndex: 0,
    };
  }
  const cfg = tuning && typeof tuning === 'object' ? tuning : {};
  const maxBodyIndex = Math.max(0, length - 2);
  const baseNeckIndex = Math.max(0, toSafeIndex(neckIndex, 0));
  const pectoralShift = toSafeIndex(cfg.pectoralPosShift, 0);
  const ventralShift = toSafeIndex(cfg.ventralPosShift, 0);
  const rawPectoralIndex = Math.round(length * 0.3) + pectoralShift;
  const pectoralIndex = Math.max(
    0,
    Math.min(maxBodyIndex, Math.max(baseNeckIndex + 1, rawPectoralIndex)),
  );
  const rawVentralIndex = Math.round(length * 0.55) + ventralShift;
  const ventralIndex = Math.max(
    0,
    Math.min(maxBodyIndex, Math.max(pectoralIndex + 2, rawVentralIndex)),
  );
  return {
    pectoralIndex,
    ventralIndex,
  };
}

export function resolveKoiRenderPose({
  adapter = null,
  history = adapter?.history,
  renderSpine = history,
  size = adapter?.baseSize,
  visualScale = resolveKoiExpressionVisualScale(adapter),
} = {}) {
  const sourceHistory = Array.isArray(history) ? history : [];
  if (sourceHistory.length === 0) return null;
  const scale = clampNumber(
    toFiniteNumber(visualScale, 1),
    KOI_EXPRESSION_VISUAL_SCALE_MIN,
    KOI_EXPRESSION_VISUAL_SCALE_MAX,
  );
  const safeSize = Math.max(1, toFiniteNumber(size, toFiniteNumber(adapter?.baseSize, 1)));
  const anchorIndex = resolveKoiBodyVisualAnchorIndex(sourceHistory);
  const anchor = resolveKoiRenderSpinePoint({
    history: sourceHistory,
    renderSpine,
    index: anchorIndex,
  });
  const sourcePointAt = (index) => resolveKoiRenderSpinePoint({
    history: sourceHistory,
    renderSpine,
    index,
  });
  const projectPoint = (point) => projectKoiVisualPoint(point, anchor, scale);
  const {
    pectoralIndex,
    ventralIndex,
  } = resolveKoiAppendageIndices({
    historyLength: sourceHistory.length,
    neckIndex: adapter?.neckIndex,
    tuning: adapter?.tuning,
  });
  const divisor = Math.max(1, (Math.max(2, Number(adapter?.historyLength) || sourceHistory.length) - 1));
  const radiusAt = (index) => getKoiBodyRadius(adapter, index / divisor, safeSize);
  const bendAt = (index) => getKoiLocalBend(adapter, index);
  const peduncleIndex = Math.max(0, sourceHistory.length - 2);
  const tipIndex = Math.max(0, sourceHistory.length - 1);
  const rootPrevIndex = Math.max(0, peduncleIndex - 1);
  const pectoralSourcePoint = sourcePointAt(pectoralIndex);
  const ventralSourcePoint = sourcePointAt(ventralIndex);
  const peduncleSourcePoint = sourcePointAt(peduncleIndex);
  const tipSourcePoint = sourcePointAt(tipIndex);
  const rootPrevSourcePoint = sourcePointAt(rootPrevIndex);

  return {
    visualScale: scale,
    size: safeSize,
    anchor: {
      index: anchorIndex,
      point: anchor,
    },
    appendages: {
      pectoral: {
        index: pectoralIndex,
        sourcePoint: pectoralSourcePoint,
        point: projectPoint(pectoralSourcePoint),
        radius: radiusAt(pectoralIndex),
        bend: bendAt(pectoralIndex),
      },
      ventral: {
        index: ventralIndex,
        sourcePoint: ventralSourcePoint,
        point: projectPoint(ventralSourcePoint),
        radius: radiusAt(ventralIndex),
        bend: bendAt(ventralIndex),
      },
    },
    tail: {
      peduncleIndex,
      tipIndex,
      rootPrevIndex,
      peduncleSourcePoint,
      tipSourcePoint,
      rootPrevSourcePoint,
      pedunclePoint: projectPoint(peduncleSourcePoint),
      tipPoint: projectPoint(tipSourcePoint),
      rootPrevPoint: projectPoint(rootPrevSourcePoint),
    },
  };
}

export function resolveKoiRenderContract({
  adapter = null,
  history = adapter?.history,
  renderSpine = history,
  size = adapter?.baseSize,
  visualScale = resolveKoiExpressionVisualScale(adapter),
  shadowProfile = adapter?.shadowRenderProfile,
  shadowOffsetScale = 1,
} = {}) {
  const pose = resolveKoiRenderPose({
    adapter,
    history,
    renderSpine,
    size,
    visualScale,
  });
  if (!pose) return null;
  const shadowSurface = resolveKoiShadowSurfaceProjection({
    adapter,
    history,
    renderSpine,
    anchorIndex: pose.anchor.index,
    depth: adapter?.depth,
    scale: toFiniteNumber(shadowProfile?.scale, 1),
    offsetScale: shadowOffsetScale,
  });
  return {
    size: pose.size,
    visualScale: pose.visualScale,
    pose,
    surfaces: {
      visible: {
        kind: 'visible',
        anchor: pose.anchor,
        visualScale: pose.visualScale,
      },
      shadow: shadowSurface,
    },
  };
}

export function createKoiBodyPath(adapter, ctx, size, returnPoints = false) {
  const history = adapter.history;
  const cfg = adapter.tuning || DEFAULT_KOI_TUNING;

  if (!adapter.leftPoints) {
    adapter.leftPoints = [];
    adapter.rightPoints = [];
  }
  const contour = buildKoiBodyContour({
    history,
    size,
    tuning: cfg,
    segmentWave: adapter.segmentWave,
    leftPoints: adapter.leftPoints,
    rightPoints: adapter.rightPoints,
  });
  adapter.leftPoints = contour.leftPoints;
  adapter.rightPoints = contour.rightPoints;

  const path = createKoiBodyPath2D(contour);
  if (ctx) {
    if (path) {
      ctx.fill(path);
    } else {
      ctx.beginPath();
      traceKoiBodyContourPath(ctx, contour);
      ctx.fill();
    }
  }

  if (returnPoints) {
    return {
      path,
      leftPoints: contour.leftPoints,
      rightPoints: contour.rightPoints,
      noseTipX: contour.noseTipX,
      noseTipY: contour.noseTipY,
    };
  }
  return path;
}

export function updateKoiDimensions(adapter, tuningOverride) {
  const {
    cfg,
    baseSize,
    historyLength,
    segmentSpacing,
  } = resolveKoiDimensionInputs(adapter, tuningOverride);

  adapter.variant = 'elegant';

  if (adapter.baseSize !== baseSize) {
    adapter.baseSize = baseSize;
  }

  if (historyLength !== adapter.historyLength) {
    const oldLen = adapter.historyLength;
    adapter.historyLength = historyLength;

    if (adapter.history) {
      if (historyLength > oldLen) {
        const last = adapter.history[oldLen - 1];
        for (let i = oldLen; i < historyLength; i += 1) {
          adapter.history.push({ ...last });
          adapter.tailWaveMemory.push(0);
          adapter.segmentWave.push(0);
        }
      } else {
        adapter.history = adapter.history.slice(0, historyLength);
        adapter.tailWaveMemory = adapter.tailWaveMemory.slice(0, historyLength);
        adapter.segmentWave = adapter.segmentWave.slice(0, historyLength);
      }
    }
    adapter.neckIndex = Math.max(1, Math.min(5, adapter.historyLength) - 1);
  }

  adapter.segmentSpacing = segmentSpacing;
}

export function getKoiLocalBend(adapter, idx) {
  const history = adapter.history;
  const prev = history[Math.max(0, idx - 1)];
  const curr = history[idx];
  const next = history[Math.min(history.length - 1, idx + 1)];
  const a1 = Math.atan2(curr.y - prev.y, curr.x - prev.x);
  const a2 = Math.atan2(next.y - curr.y, next.x - curr.x);
  let delta = a2 - a1;
  while (delta > Math.PI) delta -= Math.PI * 2;
  while (delta < -Math.PI) delta += Math.PI * 2;
  return delta;
}

export function koiContainsPoint(adapter, px, py) {
  const hitPadding = 12;
  const history = Array.isArray(adapter?.history) ? adapter.history : [];
  if (history.length === 0) return false;
  const visualScale = resolveKoiExpressionVisualScale(adapter);
  const anchorIndex = resolveKoiBodyVisualAnchorIndex(history);
  const visualAnchor = history[anchorIndex] || history[0];
  const divisor = Math.max(1, history.length - 1);
  for (let i = 0; i < history.length; i += 2) {
    const point = projectKoiVisualPoint(history[i], visualAnchor, visualScale);
    const t = i / divisor;
    const radius = getKoiBodyRadius(adapter, t, adapter.baseSize * visualScale);
    const dist = Math.hypot(px - point.x, py - point.y);
    if (dist < radius + hitPadding) {
      return true;
    }
  }
  return false;
}
