import {
  normalizeZenHomeGardenBedLayoutFrame,
  ZEN_HOME_GARDEN_BED_BOUNDARY_OVERSHOOT_CSS_PX,
  ZEN_HOME_GARDEN_BED_LEFT_INTRUSION_CSS_PX,
  ZEN_HOME_GARDEN_BED_LAYOUT_SPACE,
  resolveZenHomeFrameSeamProfile,
} from '@/themes/plugins/zen/api/homeGardenBed.js';
import { requireZenHomeCanopyReadingEnvelope } from '@/themes/plugins/zen/api/homeCanopyReading.js';
import {
  VIEWPORT_LAYOUT_MODES,
} from '../../../layout/useViewportRuntime.js';

const LAYOUT_TOLERANCE_CSS_PX = 1.5;

const toStableLayoutNumber = (value) => Number(Number(value).toFixed(3));
// One straight boundary separates the large water and paper planes. The crown
// remains free to cross it; the line is shared by paint, input and shadow.
const rearPaperEdgeX = stage => stage.width * 0.68;
// A small pond-side continuation lets bodies and leaves meet the cut naturally.
// It is proportional to the shorter visible edge, never the hidden sky width.
const POND_BOUNDARY_CONTINUATION_RATIO = 0.01;

const requireFiniteLayoutNumber = (value, field) => {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    throw new Error(`ZEN_HOME_GARDEN_BED_LAYOUT_${field}_INVALID`);
  }
  return numeric;
};

const normalizeRect = (rect, field) => {
  if (!rect || typeof rect !== 'object') {
    throw new Error(`ZEN_HOME_GARDEN_BED_LAYOUT_${field}_REQUIRED`);
  }
  const left = requireFiniteLayoutNumber(rect.left, `${field}_LEFT`);
  const top = requireFiniteLayoutNumber(rect.top, `${field}_TOP`);
  const right = requireFiniteLayoutNumber(rect.right, `${field}_RIGHT`);
  const bottom = requireFiniteLayoutNumber(rect.bottom, `${field}_BOTTOM`);
  const width = requireFiniteLayoutNumber(rect.width, `${field}_WIDTH`);
  const height = requireFiniteLayoutNumber(rect.height, `${field}_HEIGHT`);
  if (width <= 0 || height <= 0 || right <= left || bottom <= top) {
    throw new Error(`ZEN_HOME_GARDEN_BED_LAYOUT_${field}_EMPTY`);
  }
  return { left, top, right, bottom, width, height };
};

function resolveGardenBedLayoutFrame({
  layoutMode,
  stageRect,
  pondRect = null,
  bonsaiRect,
  pressureRailRect = null,
} = {}) {
  if (!Object.values(VIEWPORT_LAYOUT_MODES).includes(layoutMode)) {
    throw new Error(`ZEN_HOME_GARDEN_BED_LAYOUT_MODE_INVALID:${String(layoutMode || 'missing')}`);
  }
  const stage = normalizeRect(stageRect, 'STAGE');
  const bonsai = normalizeRect(bonsaiRect, 'BONSAI');

  if (
    bonsai.left < stage.left - LAYOUT_TOLERANCE_CSS_PX
    || bonsai.right > stage.right + LAYOUT_TOLERANCE_CSS_PX
    || bonsai.top < stage.top - LAYOUT_TOLERANCE_CSS_PX
    || bonsai.bottom > stage.bottom + LAYOUT_TOLERANCE_CSS_PX
  ) {
    throw new Error('ZEN_HOME_GARDEN_BED_LAYOUT_BONSAI_EXCEEDS_STAGE');
  }

  if (layoutMode !== VIEWPORT_LAYOUT_MODES.LANDSCAPE) {
    return normalizeZenHomeGardenBedLayoutFrame({
      coordinateSpace: ZEN_HOME_GARDEN_BED_LAYOUT_SPACE,
      layoutMode,
      boundaryOvershootCssPx: 0,
      leftIntrusionCssPx: 0,
      support: 'planter',
      bedInsetLeftCssPx: 0,
      surfaceSize: Object.freeze({
        width: toStableLayoutNumber(bonsai.width),
        height: toStableLayoutNumber(bonsai.height),
      }),
      sceneViewport: Object.freeze({
        x: 0,
        y: 0,
        width: toStableLayoutNumber(bonsai.width),
        height: toStableLayoutNumber(bonsai.height),
      }),
    });
  }

  const pond = normalizeRect(pondRect, 'POND');
  const pressureRail = normalizeRect(pressureRailRect, 'PRESSURE_RAIL');
  // Landscape water is one continuous field beneath the tree. Its CSS aperture
  // owns the visible edge; the bonsai slot remains a measurement-only anchor.
  if (Math.abs(pressureRail.bottom - stage.bottom) > LAYOUT_TOLERANCE_CSS_PX) {
    throw new Error('ZEN_HOME_GARDEN_BED_LAYOUT_LOWER_DATUM_MISMATCH');
  }

  const boundaryOvershootCssPx = ZEN_HOME_GARDEN_BED_BOUNDARY_OVERSHOOT_CSS_PX;
  const leftIntrusionCssPx = toStableLayoutNumber(Math.min(
    ZEN_HOME_GARDEN_BED_LEFT_INTRUSION_CSS_PX,
    pond.width * 0.06,
  ));
  // The measured right-hand frame is the planting anchor, not the crown's clip.
  // Transparent pondward paint space preserves the same mature canopy in both
  // work-area modes without enlarging the bed or its pressure-rail joint.
  const canopyIntrusionCssPx = toStableLayoutNumber(Math.min(
    Math.max(0, bonsai.left - stage.left - boundaryOvershootCssPx),
    pond.width * 0.52,
  ));
  const bedInsetLeftCssPx = toStableLayoutNumber(Math.max(0, canopyIntrusionCssPx - leftIntrusionCssPx));
  const sceneX = toStableLayoutNumber(bedInsetLeftCssPx + leftIntrusionCssPx + boundaryOvershootCssPx);
  const sceneY = 0;
  const sceneWidth = toStableLayoutNumber(bonsai.width);
  const sceneHeight = toStableLayoutNumber(bonsai.height);
  // The stage check above admits up to 1.5 CSS px of measurement disagreement.
  // Cover both admitted anchors before adding the overshoot; otherwise that
  // same disagreement consumes its reserve and fails the stricter contract.
  // Quantize adjacent lengths first so a second rounding of world coordinates
  // cannot remove 0.001 px from a shared edge.
  const rightClearance = toStableLayoutNumber(Math.max(0, stage.right - bonsai.right));
  const bottomClearance = toStableLayoutNumber(Math.max(0, stage.bottom - bonsai.bottom));
  // Paint must cover the complete measured outer edge before reserving its
  // bleed. Flooring here leaves up to one CSS pixel of sky beside the stone.
  // Home clips beyond that edge by this same reserve without becoming a scroll
  // container; the dashboard frame owns the final visible crop.
  const surfaceWidth = toStableLayoutNumber(
    sceneX + sceneWidth + rightClearance + boundaryOvershootCssPx,
  );
  const surfaceHeight = toStableLayoutNumber(sceneY + sceneHeight + bottomClearance);
  const surfaceLeft = bonsai.left - sceneX - stage.left;
  const rearEdgeX = rearPaperEdgeX(stage) - surfaceLeft;

  if (
    surfaceWidth <= 0
    || surfaceHeight <= 0
    || sceneX < 0
    || sceneY < 0
    || sceneX + bonsai.width > surfaceWidth + LAYOUT_TOLERANCE_CSS_PX
    || sceneY + bonsai.height > surfaceHeight + LAYOUT_TOLERANCE_CSS_PX
  ) {
    throw new Error('ZEN_HOME_GARDEN_BED_LAYOUT_SURFACE_CONTRACT_INVALID');
  }

  return normalizeZenHomeGardenBedLayoutFrame({
    coordinateSpace: ZEN_HOME_GARDEN_BED_LAYOUT_SPACE,
    layoutMode,
    support: 'frame-seam',
    rearPaperEdge: {
      topX: rearEdgeX,
      bottomX: rearEdgeX,
    },
    boundaryOvershootCssPx,
    leftIntrusionCssPx: toStableLayoutNumber(leftIntrusionCssPx),
    bedInsetLeftCssPx: toStableLayoutNumber(bedInsetLeftCssPx),
    surfaceSize: Object.freeze({
      width: toStableLayoutNumber(surfaceWidth),
      height: toStableLayoutNumber(surfaceHeight),
    }),
    sceneViewport: Object.freeze({
      x: toStableLayoutNumber(sceneX),
      y: toStableLayoutNumber(sceneY),
      width: sceneWidth,
      height: sceneHeight,
    }),
  });
}

// All rectangles share the Home stage's CSS-pixel coordinate space. Measure
// outer grid slots only: consuming these bounds must never resize the inputs.
export function resolveZenHomeCompositionLayoutFrame({
  layoutMode,
  stageRect,
  pondRect,
  bonsaiRect,
  pressureRailRect,
} = {}) {
  const stage = normalizeRect(stageRect, 'STAGE');
  const pond = normalizeRect(pondRect, 'POND');
  const rail = normalizeRect(pressureRailRect, 'PRESSURE_RAIL');
  const gardenBed = resolveGardenBedLayoutFrame({
    layoutMode, stageRect, pondRect, bonsaiRect, pressureRailRect,
  });
  for (const [name, rect] of [['POND', pond], ['PRESSURE_RAIL', rail]]) {
    if (
      rect.left < stage.left - LAYOUT_TOLERANCE_CSS_PX
      || rect.right > stage.right + LAYOUT_TOLERANCE_CSS_PX
      || rect.top < stage.top - LAYOUT_TOLERANCE_CSS_PX
      || rect.bottom > stage.bottom + LAYOUT_TOLERANCE_CSS_PX
    ) throw new Error(`ZEN_HOME_COMPOSITION_${name}_EXCEEDS_STAGE`);
  }
  if (
    Math.abs(rail.top - pond.bottom) > LAYOUT_TOLERANCE_CSS_PX
    || rail.left < pond.left - LAYOUT_TOLERANCE_CSS_PX
    || (layoutMode !== VIEWPORT_LAYOUT_MODES.LANDSCAPE
      && rail.right > pond.right + LAYOUT_TOLERANCE_CSS_PX)
  ) throw new Error('ZEN_HOME_COMPOSITION_PRESSURE_POND_ALIGNMENT_INVALID');

  let dataRight = rail.right;
  if (layoutMode === VIEWPORT_LAYOUT_MODES.LANDSCAPE) {
    const seam = resolveZenHomeFrameSeamProfile(gardenBed);
    const surfaceLeft = bonsaiRect.left - gardenBed.sceneViewport.x;
    // The graph ends at the stone footing; no segment or pointer target runs
    // under the garden bed.
    dataRight = Math.min(dataRight, surfaceLeft + seam.bedLeftX);
  }
  const dataWidth = dataRight - rail.left;
  if (dataWidth <= 0) throw new Error('ZEN_HOME_COMPOSITION_PRESSURE_SAFE_WIDTH_EMPTY');
  const relativeRect = (left, top, width, height) => Object.freeze({
    x: toStableLayoutNumber(left - stage.left),
    y: toStableLayoutNumber(top - stage.top),
    width: toStableLayoutNumber(width),
    height: toStableLayoutNumber(height),
  });
  // The ledger is a sheet over the entire pond, including its top padding. The
  // architectural panel line owns its right edge; transparent canopy paint and
  // the lower footing may overlap the sheet without shrinking this rectangle.
  const workAreaRect = layoutMode === VIEWPORT_LAYOUT_MODES.LANDSCAPE
    ? relativeRect(stage.left, stage.top, rearPaperEdgeX(stage), rail.top - stage.top)
    : relativeRect(pond.left, pond.top, pond.width, pond.height);
  if (workAreaRect.width <= 0 || workAreaRect.height <= 0) {
    throw new Error('ZEN_HOME_COMPOSITION_WORK_AREA_EMPTY');
  }

  return Object.freeze({
    coordinateSpace: ZEN_HOME_GARDEN_BED_LAYOUT_SPACE,
    layoutMode,
    gardenBed,
    workAreaRect,
    canopyViewportRect: layoutMode === VIEWPORT_LAYOUT_MODES.LANDSCAPE
      ? relativeRect(bonsaiRect.left - gardenBed.sceneViewport.x, bonsaiRect.top,
        gardenBed.sceneViewport.x + gardenBed.sceneViewport.width, gardenBed.sceneViewport.height)
      : null,
    gardenAperture: layoutMode === VIEWPORT_LAYOUT_MODES.LANDSCAPE
      ? resolveGardenAperture({ stage, pond, bonsai: normalizeRect(bonsaiRect, 'BONSAI'), gardenBed })
      : null,
    pressure: Object.freeze({
      dataRect: relativeRect(rail.left, rail.top, dataWidth, rail.height),
      seamWidth: toStableLayoutNumber(rail.right - dataRight),
    }),
  });
}

// A reading exclusion never changes the full paper, physical support or ACK
// inputs. A receipt for another committed CSS frame is explicitly pending.
export function resolveZenHomeCompositionReadingInset({ compositionFrame, canopyEnvelope }) {
  const space = resolveZenHomeCompositionReadingSpace({ compositionFrame, canopyEnvelope });
  if (space === null) return null;
  return toStableLayoutNumber(Math.max(0, ...space.bands.map(band => space.width - band.right)));
}

export function resolveZenHomeCompositionReadingSpace({ compositionFrame, canopyEnvelope }) {
  if (compositionFrame === null) return null;
  const { workAreaRect } = compositionFrame;
  if (compositionFrame.layoutMode !== VIEWPORT_LAYOUT_MODES.LANDSCAPE) return { width: workAreaRect.width, bands: [] };
  if (canopyEnvelope === null) return null;
  const envelope = requireZenHomeCanopyReadingEnvelope(canopyEnvelope);
  if (envelope.layoutSignature !== JSON.stringify(compositionFrame.gardenBed)) return null;
  const { canopyViewportRect } = compositionFrame;
  if (!canopyViewportRect || !workAreaRect) throw new Error('ZEN_HOME_COMPOSITION_READING_FRAME_REQUIRED');
  const bands = envelope.bands.flatMap((left, index) => {
    if (left === null) return [];
    const right = Math.min(workAreaRect.width, canopyViewportRect.x + canopyViewportRect.width * left - workAreaRect.x);
    if (!(right > 0)) throw new Error('ZEN_HOME_COMPOSITION_READING_WIDTH_EMPTY');
    return [{ top: canopyViewportRect.y + index / envelope.bands.length * canopyViewportRect.height - workAreaRect.y,
      bottom: canopyViewportRect.y + (index + 1) / envelope.bands.length * canopyViewportRect.height - workAreaRect.y, right }];
  });
  // The stone lip crosses the paper independently of the tree. Reserve only
  // its own height, using the same foreground profile as paint and hit testing.
  const foreground = resolveZenHomeFrameSeamProfile(compositionFrame.gardenBed).foreground;
  const footingRight = Math.min(workAreaRect.width,
    canopyViewportRect.x + Math.min(...foreground.map(point => point.x)) - workAreaRect.x);
  if (!(footingRight > 0)) throw new Error('ZEN_HOME_COMPOSITION_READING_FOOTING_WIDTH_EMPTY');
  bands.push({
    top: canopyViewportRect.y + Math.min(...foreground.map(point => point.y)) - workAreaRect.y,
    bottom: canopyViewportRect.y + Math.max(...foreground.map(point => point.y)) - workAreaRect.y,
    right: footingRight,
  });
  return { width: workAreaRect.width, bands };
}

function resolveGardenAperture({ stage, pond, bonsai, gardenBed }) {
  const profile = resolveZenHomeFrameSeamProfile(gardenBed);
  const surfaceLeft = bonsai.left - gardenBed.sceneViewport.x;
  const surfaceTop = bonsai.top;
  const stagePoint = p => ({ x: p.x + surfaceLeft - stage.left, y: p.y + surfaceTop - stage.top });
  const polygon = points => `polygon(${points.map(p => `${toStableLayoutNumber(p.x)}px ${toStableLayoutNumber(p.y)}px`).join(', ')})`;
  // A broad rear plane; its vertical edge quietly passes behind the crown
  // instead of turning it into another rectangular card. Foreground occlusion is shared
  // with the painted frame seam, including petal hit testing.
  const receiver = gardenBed.rearPaperEdge;
  const receiverSlope = (receiver.bottomX - receiver.topX) / gardenBed.surfaceSize.height;
  const topX = receiver.topX - receiverSlope * (surfaceTop - stage.top) + surfaceLeft - stage.left;
  const bottomX = topX + receiverSlope * stage.height;
  const rearTop = { x: topX, y: 0 };
  const rearBottom = { x: bottomX, y: stage.height };
  const edgeAt = y => topX + (bottomX - topX) * y / stage.height;
  const pondTop = pond.top - stage.top;
  const pondBottom = pond.bottom - stage.top;
  const visiblePondWidth = Math.min(pond.width,
    Math.max(edgeAt(pondTop), edgeAt(pondBottom)) - (pond.left - stage.left));
  if (visiblePondWidth <= 0) throw new Error('ZEN_HOME_COMPOSITION_POND_APERTURE_EMPTY');
  const pondViewportWidth = toStableLayoutNumber(Math.min(pond.width,
    visiblePondWidth + Math.min(visiblePondWidth, pond.height) * POND_BOUNDARY_CONTINUATION_RATIO));
  const rearPoints = [rearTop, { x: stage.width, y: 0 },
    { x: stage.width, y: stage.height }, rearBottom];
  // Let the dashboard viewport crop the outer paint once. Rasterizing a filled polygon
  // at that same boundary exposes the lighter frame through partial edge pixels.
  // Extend only the paint; the boundary and all input/landing geometry stay fixed.
  const bleed = gardenBed.boundaryOvershootCssPx;
  const rearPaintPoints = [
    { x: edgeAt(-bleed), y: -bleed },
    { x: stage.width + bleed, y: -bleed },
    { x: stage.width + bleed, y: stage.height + bleed },
    { x: edgeAt(stage.height + bleed), y: stage.height + bleed },
  ];
  // Contact shadow is confined to a narrow strip on the water side of the
  // shared edge. A solid line alone makes the two planes look like a cutout.
  const depth = Math.min(18, stage.width * 0.014);
  const edgeLength = Math.hypot(bottomX - topX, stage.height);
  const shadowOffset = { x: -stage.height / edgeLength * depth, y: (bottomX - topX) / edgeLength * depth };
  const shadowTop = { x: rearTop.x + shadowOffset.x, y: rearTop.y + shadowOffset.y };
  const shadowBottom = { x: rearBottom.x + shadowOffset.x, y: rearBottom.y + shadowOffset.y };
  const points = vertices => vertices.map(p => `${toStableLayoutNumber(p.x)},${toStableLayoutNumber(p.y)}`).join(' ');
  return Object.freeze({
    surfaceSize: Object.freeze({ width: stage.width, height: stage.height }),
    pondViewportWidth,
    rearClipPath: polygon(rearPoints),
    rearPlanePoints: points(rearPaintPoints),
    rearShadowPoints: points([rearTop, rearBottom, shadowBottom, shadowTop]),
    rearEdge: Object.freeze({ top: rearTop, bottom: rearBottom, shadowEnd: shadowTop }),
    pondClipPath: polygon([
      { x: 0, y: 0 },
      { x: edgeAt(pondTop) - (pond.left - stage.left), y: 0 },
      { x: edgeAt(pondBottom) - (pond.left - stage.left), y: pond.height },
      { x: 0, y: pond.height },
    ]),
    foregroundClipPath: polygon(profile.foreground.map(stagePoint)),
  });
}
