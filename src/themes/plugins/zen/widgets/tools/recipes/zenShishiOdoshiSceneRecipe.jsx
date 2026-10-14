import { motion } from 'framer-motion';
import { ZEN_SHISHI_WATER_MATERIAL as WATER, ZEN_SHISHI_DROPLET_KEY_TIMES, ZEN_SHISHI_GROUND_BEADS,
  resolveZenShishiDropletPose, resolveZenShishiGroundDropletPose } from './zenShishiOdoshiWaterMaterial.js';
import {
  createArtifactSceneEllipse,
  createArtifactSceneGroup,
  createArtifactSceneNode,
  createArtifactScenePath,
  createArtifactSceneRect,
} from '../../../../../core/artifacts/scene/sceneGraph.js';

import {
  SHISHI_ODOSHI_TUBE_WIDTH,
  SHISHI_ODOSHI_TUBE_HEIGHT,
  SHISHI_ODOSHI_TUBE_LEFT,
  SHISHI_ODOSHI_TUBE_TOP,
  SHISHI_ODOSHI_TUBE_PIVOT_X,
  SHISHI_ODOSHI_TUBE_PIVOT_Y,
  SHISHI_ODOSHI_TUBE_MOUTH_X,
  SHISHI_ODOSHI_TUBE_MOUTH_Y,
  SHISHI_ODOSHI_MOUTH_ELLIPSE_RX,
  SHISHI_ODOSHI_MOUTH_ELLIPSE_RY,
  SHISHI_ODOSHI_MOUTH_ELLIPSE_ROTATE,
  SHISHI_ODOSHI_SACRED_STREAM_MAX_HEIGHT,
  SHISHI_ODOSHI_STREAM_SOURCE_Y,
  SHISHI_ODOSHI_FREE_FALL_STREAM_HEIGHT,
  SHISHI_ODOSHI_STREAM_CAPTURE_CENTER_X,
  SHISHI_ODOSHI_GROUND_SPLASH_WORLD_Y,
  SHISHI_ODOSHI_LIP_SPLASH_LEFT,
  SHISHI_ODOSHI_GROUND_VIEW,
  SHISHI_ODOSHI_STAND_GEOMETRY as STAND,
  SHISHI_ODOSHI_ROCK_GEOMETRY as ROCK,
} from './zenShishiOdoshiGeometry.js';

const TUBE_RIM_OUTER_RX = 23.5;
const TUBE_RIM_OUTER_RY = 4.9;
const TUBE_JOINT_COLUMNS = Object.freeze([90, 180, 283]);
const TUBE_CAVITY_DEPTH_X = 5;
const STAND_AXLE_X = SHISHI_ODOSHI_TUBE_LEFT + SHISHI_ODOSHI_TUBE_PIVOT_X;
const STAND_AXLE_Y = SHISHI_ODOSHI_TUBE_TOP + SHISHI_ODOSHI_TUBE_PIVOT_Y;
const BACK_STAND_CENTER_X = STAND_AXLE_X + STAND.backOffsetX;
const FRONT_STAND_CENTER_X = STAND_AXLE_X + STAND.frontOffsetX;
const STAND_DEPTH_SLOPE = SHISHI_ODOSHI_GROUND_VIEW.depthY / SHISHI_ODOSHI_GROUND_VIEW.depthX;
const BACK_STAND_TOP = STAND.frontTop - (STAND.frontOffsetX - STAND.backOffsetX) * STAND_DEPTH_SLOPE;
const BACK_STAND_HEIGHT = STAND.height;
const BACK_STAND_WIDTH = STAND.backWidth;
const BACK_STAND_LEFT = BACK_STAND_CENTER_X - BACK_STAND_WIDTH / 2;
const FRONT_STAND_TOP = STAND.frontTop;
const FRONT_STAND_HEIGHT = STAND.height;
const FRONT_STAND_WIDTH = STAND.frontWidth;
const FRONT_STAND_LEFT = FRONT_STAND_CENTER_X - FRONT_STAND_WIDTH / 2;
const STAND_DEPTH_ANGLE = Math.atan2(
  FRONT_STAND_TOP - BACK_STAND_TOP,
  FRONT_STAND_CENTER_X - BACK_STAND_CENTER_X,
);
const STAND_DEPTH_ROTATE = STAND_DEPTH_ANGLE * 180 / Math.PI;
// The visible surface of a cylinder is ahead of its projected centerline.
// This shallow view projects 55% of the post radius along the depth axis.
const STAND_FACE_DEPTH_PROJECTION = 0.55;
const BACK_STAND_BORE = resolveStandBore(BACK_STAND_CENTER_X, BACK_STAND_WIDTH);
const FRONT_STAND_BORE = resolveStandBore(FRONT_STAND_CENTER_X, FRONT_STAND_WIDTH);
const BACK_AXLE_LENGTH = -BACK_STAND_BORE.alongAxis;
const FRONT_AXLE_LENGTH = FRONT_STAND_BORE.alongAxis;
const STAND_BORE_RX = 1.9;
const STAND_BORE_RY = 2.8;
const ROCK_BODY_PATH = `M 8 37 C 3 28 5 21 12 16 C 17 13 20 7 30 4
  C 39 1 49 3 58 10 C 62 14 70 16 73 22 C 78 29 77 37 69 43
  C 61 48 42 49 26 47 C 17 47 10 43 8 37 Z`;
const GROUND_RIPPLE_TOP = SHISHI_ODOSHI_GROUND_SPLASH_WORLD_Y - 24;
const GROUND_RIPPLE_CONTAINER_LEFT = SHISHI_ODOSHI_STREAM_CAPTURE_CENTER_X - 50;
const CAPTURE_BASE_STREAM_WIDTH = 6.4;
const CAPTURE_BASE_STREAM_LEFT = SHISHI_ODOSHI_STREAM_CAPTURE_CENTER_X - CAPTURE_BASE_STREAM_WIDTH / 2;
const CAPTURE_CORE_STREAM_WIDTH = 1.05;
const CAPTURE_CORE_STREAM_LEFT = SHISHI_ODOSHI_STREAM_CAPTURE_CENTER_X + 1.5 - CAPTURE_CORE_STREAM_WIDTH / 2;
const CAPTURE_STREAM_CLIP_LEFT = CAPTURE_BASE_STREAM_LEFT - 3.5;
const CAPTURE_STREAM_CLIP_WIDTH = 16;
const FREE_FALL_BASE_STREAM_WIDTH = 4.8;
const FREE_FALL_BASE_STREAM_LEFT = SHISHI_ODOSHI_STREAM_CAPTURE_CENTER_X - FREE_FALL_BASE_STREAM_WIDTH / 2;
const FREE_FALL_CORE_STREAM_WIDTH = 0.8;
const FREE_FALL_CORE_STREAM_LEFT = SHISHI_ODOSHI_STREAM_CAPTURE_CENTER_X + 1.1 - FREE_FALL_CORE_STREAM_WIDTH / 2;
const FREE_FALL_STREAM_CLIP_LEFT = FREE_FALL_BASE_STREAM_LEFT - 2.8;
const FREE_FALL_STREAM_CLIP_WIDTH = 12;
const TAIL_STREAM_WIDTH = 6.4;
const TAIL_STREAM_LEFT = SHISHI_ODOSHI_STREAM_CAPTURE_CENTER_X - TAIL_STREAM_WIDTH / 2;
// Motion defaults SVG transforms to the painted fill box. Water scales and
// rotates about its physical local origin, independent of asymmetric contours.
const WATER_LOCAL_TRANSFORM = Object.freeze({ originX: 0, originY: 0, transformBox: 'view-box' });

function formatNumber(value) {
  return Number(value.toFixed(2));
}

function createStop(offset, stopColor, stopOpacity) {
  return createArtifactSceneNode('stop', {
    offset,
    stopColor,
    ...(stopOpacity === undefined ? {} : { stopOpacity }),
  });
}

function resolveRotatedEllipsePoint(cx, cy, rx, ry, rotationDeg, angleRad) {
  const ellipseX = rx * Math.cos(angleRad);
  const ellipseY = ry * Math.sin(angleRad);
  const theta = (rotationDeg * Math.PI) / 180;
  const cosTheta = Math.cos(theta);
  const sinTheta = Math.sin(theta);

  return {
    x: cx + (ellipseX * cosTheta) - (ellipseY * sinTheta),
    y: cy + (ellipseX * sinTheta) + (ellipseY * cosTheta),
  };
}

function sampleEllipseRange({ cx, cy, rx, ry, rotationDeg, startAngle, endAngle, steps = 18 }) {
  const points = [];
  for (let index = 0; index <= steps; index += 1) {
    const progress = index / steps;
    const angle = startAngle + ((endAngle - startAngle) * progress);
    points.push(resolveRotatedEllipsePoint(cx, cy, rx, ry, rotationDeg, angle));
  }
  return points;
}

function createClosedPathFromPoints(points) {
  if (!Array.isArray(points) || points.length === 0) {
    throw new Error('[zenShishiOdoshiSceneRecipe] Cannot create a path from an empty point list.');
  }

  const [firstPoint, ...restPoints] = points;
  const commands = [`M ${formatNumber(firstPoint.x)} ${formatNumber(firstPoint.y)}`];
  for (const point of restPoints) {
    commands.push(`L ${formatNumber(point.x)} ${formatNumber(point.y)}`);
  }
  commands.push('Z');
  return commands.join(' ');
}

function createEllipseBandPath({
  startAngle,
  endAngle,
  outerRx = TUBE_RIM_OUTER_RX,
  outerRy = TUBE_RIM_OUTER_RY,
  innerRx = SHISHI_ODOSHI_MOUTH_ELLIPSE_RX,
  innerRy = SHISHI_ODOSHI_MOUTH_ELLIPSE_RY,
}) {
  const outerPoints = sampleEllipseRange({
    cx: SHISHI_ODOSHI_TUBE_MOUTH_X,
    cy: SHISHI_ODOSHI_TUBE_MOUTH_Y,
    rx: outerRx,
    ry: outerRy,
    rotationDeg: SHISHI_ODOSHI_MOUTH_ELLIPSE_ROTATE,
    startAngle,
    endAngle,
    steps: Math.max(18, Math.ceil(18 * Math.abs(endAngle - startAngle) / Math.PI)),
  });
  const innerPoints = sampleEllipseRange({
    cx: SHISHI_ODOSHI_TUBE_MOUTH_X,
    cy: SHISHI_ODOSHI_TUBE_MOUTH_Y,
    rx: innerRx,
    ry: innerRy,
    rotationDeg: SHISHI_ODOSHI_MOUTH_ELLIPSE_ROTATE,
    startAngle: endAngle,
    endAngle: startAngle,
    steps: Math.max(18, Math.ceil(18 * Math.abs(endAngle - startAngle) / Math.PI)),
  });

  return createClosedPathFromPoints([...outerPoints, ...innerPoints]);
}

function createMouthEllipse(props = {}) {
  return createArtifactSceneEllipse({
    cx: SHISHI_ODOSHI_TUBE_MOUTH_X,
    cy: SHISHI_ODOSHI_TUBE_MOUTH_Y,
    rx: SHISHI_ODOSHI_MOUTH_ELLIPSE_RX,
    ry: SHISHI_ODOSHI_MOUTH_ELLIPSE_RY,
    transform: `rotate(${SHISHI_ODOSHI_MOUTH_ELLIPSE_ROTATE} ${SHISHI_ODOSHI_TUBE_MOUTH_X} ${SHISHI_ODOSHI_TUBE_MOUTH_Y})`,
    ...props,
  });
}

function createTubeBodyPath() {
  const rotation = SHISHI_ODOSHI_MOUTH_ELLIPSE_ROTATE * Math.PI / 180;
  const topAngle = Math.atan2(-TUBE_RIM_OUTER_RY * Math.cos(rotation), -TUBE_RIM_OUTER_RX * Math.sin(rotation));
  const outline = sampleEllipseRange({
    cx: SHISHI_ODOSHI_TUBE_MOUTH_X,
    cy: SHISHI_ODOSHI_TUBE_MOUTH_Y,
    rx: TUBE_RIM_OUTER_RX,
    ry: TUBE_RIM_OUTER_RY,
    rotationDeg: SHISHI_ODOSHI_MOUTH_ELLIPSE_ROTATE,
    startAngle: topAngle + Math.PI,
    endAngle: topAngle + Math.PI * 2,
    steps: 36,
  });
  const bottom = outline[0];
  const top = outline[outline.length - 1];
  const cutOutline = outline.slice(1).map(point => `L ${formatNumber(point.x)} ${formatNumber(point.y)}`).join(' ');
  // The cylinder meets the cut ellipse at its tangents. The complete cut face
  // is painted above this shell; neither half can disappear beneath the body.
  return `M ${formatNumber(top.x)} ${formatNumber(top.y)}
    C 96 ${formatNumber(top.y - 0.4)} 184 ${formatNumber(top.y + 0.7)} 288 ${formatNumber(top.y + 0.65)}
    C 291 ${formatNumber(top.y + 0.5)} 293.5 ${formatNumber(top.y + 1)} 294 ${formatNumber(top.y + 2.7)}
    Q 294.9 24 294 ${formatNumber(bottom.y - 2.7)}
    C 293.5 ${formatNumber(bottom.y - 1)} 291 ${formatNumber(bottom.y - 0.5)} 288 ${formatNumber(bottom.y - 0.65)}
    C 184 ${formatNumber(bottom.y - 0.7)} 96 ${formatNumber(bottom.y + 0.4)} ${formatNumber(bottom.x)} ${formatNumber(bottom.y)}
    ${cutOutline} Z`;
}

function createTubeExteriorDefs(idScope, bodyPath) {
  return [
    createArtifactSceneNode('linearGradient', {
      id: idScope.get('bamboo-grad'),
      x1: '0',
      y1: '0',
      x2: '0',
      y2: '1',
    }, [
      createStop('0%', '#677743'),
      createStop('24%', '#86925b'),
      createStop('46%', '#71814a'),
      createStop('76%', '#566b36'),
      createStop('100%', '#354922'),
    ]),
    createArtifactSceneNode('linearGradient', {
      id: idScope.get('joint-grad'),
      x1: '0',
      y1: '0',
      x2: '0',
      y2: '1',
    }, [
      createStop('0%', '#7b8952'),
      createStop('24%', '#919a65'),
      createStop('46%', '#79894f'),
      createStop('76%', '#5d713b'),
      createStop('100%', '#3a4e26'),
    ]),
    createArtifactSceneNode('linearGradient', {
      id: idScope.get('bamboo-patina-grad'),
      x1: '0', y1: '0', x2: '1', y2: '0',
    }, [
      createStop('0%', '#aaa578', 0.06),
      createStop('22%', '#aca573', 0.08),
      createStop('48%', '#887e51', 0.02),
      createStop('80%', '#b2a276', 0.1),
      createStop('100%', '#b0a071', 0.19),
    ]),
    createArtifactSceneNode('linearGradient', {
      id: idScope.get('bamboo-cut-grad'),
      gradientUnits: 'userSpaceOnUse',
      x1: 17,
      y1: 10,
      x2: 26,
      y2: 38,
    }, [
      createStop('0%', '#bdb78c'),
      createStop('40%', '#a7a078'),
      createStop('78%', '#928663'),
      createStop('100%', '#aaa179'),
    ]),
    createArtifactSceneNode('clipPath', {
      id: idScope.get('bamboo-shell-clip'),
    }, [createArtifactScenePath({ d: bodyPath })]),
    createArtifactSceneNode('mask', {
      id: idScope.get('mouth-hole-mask'),
    }, [
      createArtifactSceneRect({
        x: 0,
        y: 0,
        width: SHISHI_ODOSHI_TUBE_WIDTH,
        height: SHISHI_ODOSHI_TUBE_HEIGHT,
        fill: 'white',
      }),
      createMouthEllipse({ fill: 'black' }),
    ]),
  ];
}

function createTubeInteriorDefs(idScope) {
  return [
    createArtifactSceneNode('linearGradient', {
      id: idScope.get('bamboo-interior-grad'),
      gradientUnits: 'userSpaceOnUse',
      x1: 7,
      y1: 30,
      x2: 41,
      y2: 17,
    }, [
      createStop('0%', '#97966c'),
      createStop('30%', '#788056'),
      createStop('65%', '#5d6b43'),
      createStop('100%', '#3e4d30'),
    ]),
    createArtifactSceneNode('linearGradient', {
      id: idScope.get('bamboo-depth-grad'),
      x1: '0', y1: '1', x2: '1', y2: '0',
    }, [
      createStop('0%', '#5a6940'),
      createStop('52%', '#3f512f'),
      createStop('100%', '#293c25'),
    ]),
    createArtifactSceneNode('clipPath', {
      id: idScope.get('bamboo-cavity-clip'),
    }, [createMouthEllipse()]),
  ];
}

function createStandShellPath(left, top, width, height) {
  const right = left + width;
  const bottom = top + height;
  return `M ${left + 1} ${top + 1.4} Q ${left + width / 2} ${top - 0.2} ${right - 0.6} ${top + 1.4}
    C ${right - 0.3} ${top + height * 0.3} ${right - 0.9} ${top + height * 0.7} ${right - 0.3} ${bottom}
    L ${left + 0.7} ${bottom}
    C ${left + 1.2} ${top + height * 0.7} ${left + 0.2} ${top + height * 0.3} ${left + 1} ${top + 1.4} Z`;
}

function createPiercedStandShellPath(left, top, width, height) {
  const bore = resolveStandBore(left + width / 2, width);
  const borePath = createClosedPathFromPoints(sampleEllipseRange({
    cx: bore.x, cy: bore.y, rx: STAND_BORE_RX, ry: STAND_BORE_RY,
    rotationDeg: STAND_DEPTH_ROTATE, startAngle: 0, endAngle: Math.PI * 2, steps: 36,
  }));
  return `${createStandShellPath(left, top, width, height)} ${borePath}`;
}

function resolveStandBore(centerX, width) {
  const x = centerX + width / 2 * STAND_FACE_DEPTH_PROJECTION;
  return {
    x,
    y: STAND_AXLE_Y + (x - STAND_AXLE_X) * Math.tan(STAND_DEPTH_ANGLE),
    alongAxis: (x - STAND_AXLE_X) / Math.cos(STAND_DEPTH_ANGLE),
  };
}

function createBackStandDefs(idScope) {
  return [
    createArtifactSceneNode('linearGradient', {
      id: idScope.get('back-stand-grad'),
      x1: '0',
      y1: '0',
      x2: '1',
      y2: '0',
    }, [
      createStop('0%', '#3a3b2c'),
      createStop('35%', '#66694a'),
      createStop('65%', '#51573b'),
      createStop('100%', '#3d422e'),
    ]),
    createArtifactSceneNode('clipPath', { id: idScope.get('back-stand-clip') }, [
      createArtifactScenePath({ d: createPiercedStandShellPath(BACK_STAND_LEFT, BACK_STAND_TOP, BACK_STAND_WIDTH, BACK_STAND_HEIGHT), clipRule: 'evenodd' }),
    ]),
    createArtifactSceneNode('linearGradient', {
      id: idScope.get('stand-pin-grad'), x1: '0', y1: '0', x2: '0', y2: '1',
    }, [
      createStop('0%', '#a18d62'),
      createStop('35%', '#84724f'),
      createStop('72%', '#67593e'),
      createStop('100%', '#4a432f'),
    ]),
  ];
}

function createFrontStandDefs(idScope) {
  return [
    createArtifactSceneNode('linearGradient', {
      id: idScope.get('front-stand-grad'),
      x1: '0',
      y1: '0',
      x2: '1',
      y2: '0',
    }, [
      createStop('0%', '#514c35'),
      createStop('35%', '#8a805c'),
      createStop('65%', '#6f6c4b'),
      createStop('100%', '#484633'),
    ]),
    createArtifactSceneNode('clipPath', { id: idScope.get('front-stand-clip') }, [
      createArtifactScenePath({ d: createPiercedStandShellPath(FRONT_STAND_LEFT, FRONT_STAND_TOP, FRONT_STAND_WIDTH, FRONT_STAND_HEIGHT), clipRule: 'evenodd' }),
    ]),
    createArtifactSceneNode('clipPath', { id: idScope.get('front-stand-bore-clip') }, [
      createArtifactSceneEllipse({ cx: FRONT_AXLE_LENGTH, cy: 0, rx: STAND_BORE_RX, ry: STAND_BORE_RY }),
    ]),
    createArtifactSceneNode('linearGradient', {
      id: idScope.get('stand-pin-face-grad'), x1: '0', y1: '0', x2: '1', y2: '1',
    }, [
      createStop('0%', '#b2a078'),
      createStop('52%', '#94845f'),
      createStop('100%', '#766648'),
    ]),
  ];
}

function createRockDefs(idScope) {
  return [
    createArtifactSceneNode('radialGradient', {
      id: idScope.get('rock-grad'),
      cx: '34%',
      cy: '18%',
      r: '90%',
    }, [
      createStop('0%', '#827d6d'),
      createStop('42%', '#646358'),
      createStop('78%', '#4d5048'),
      createStop('100%', '#353b35'),
    ]),
    createArtifactSceneNode('linearGradient', {
      id: idScope.get('rock-crown-grad'), x1: '0', y1: '0', x2: '0.3', y2: '1',
    }, [
      createStop('0%', '#c5baa0', 0.28),
      createStop('65%', '#a09c83', 0.09),
      createStop('100%', '#828474', 0),
    ]),
    createArtifactSceneNode('linearGradient', {
      id: idScope.get('rock-foot-grad'), x1: '0', y1: '0', x2: '0', y2: '1',
    }, [
      createStop('0%', '#29322b', 0),
      createStop('100%', '#29322b', 0.38),
    ]),
    createArtifactSceneNode('clipPath', { id: idScope.get('rock-surface-clip') }, [
      createArtifactScenePath({ d: ROCK_BODY_PATH }),
    ]),
  ];
}

function createWaterDetailDefs(idScope, key) {
  return [
    createArtifactSceneNode('linearGradient', {
      id: idScope.get(`water-${key}-sheet-grad`), gradientUnits: 'userSpaceOnUse',
      x1: 0, y1: -17, x2: 0, y2: 3,
    }, [
      createStop('0%', WATER.reflection, 0.55),
      createStop('28%', WATER.body, 0.3),
      createStop('70%', WATER.body, 0.12),
      createStop('100%', WATER.reflection, 0.02),
    ]),
    createArtifactSceneNode('radialGradient', {
      id: idScope.get(`water-${key}-drop-grad`), cx: '30%', cy: '25%', r: '80%',
    }, [
      createStop('0%', WATER.highlight, 0.94),
      createStop('34%', WATER.reflection, 0.78),
      createStop('68%', WATER.body, 0.42),
      createStop('100%', WATER.shadow, 0.2),
    ]),
  ];
}

function createWaterDropletNodes(idScope, key) {
  return [
    <path key="body" d="M 0 -2.6 C .45 -1.5 1.7 -.65 1.7 .35 C 1.7 1.45 .85 2.1 0 2.1 C -.95 2.1 -1.7 1.4 -1.7 .35 C -1.7 -.7 -.5 -1.6 0 -2.6 Z"
      fill={idScope.url(`water-${key}-drop-grad`)} stroke={WATER.reflection} strokeWidth={0.18} strokeOpacity={0.5} />,
    <ellipse key="reflection" cx={-0.5} cy={-0.25} rx={0.32} ry={0.72} fill={WATER.highlight} opacity={0.7} />,
  ];
}

function createWaterRippleNodes() {
  return [
    <path key="back" d="M -13.2 -4.7 A 14 14 0 0 1 11.9 -7.4" fill="none"
      stroke={WATER.shadow} strokeWidth={0.16} strokeOpacity={0.3} strokeLinecap="round" />,
    <path key="front" d="M 12.8 5.7 A 14 14 0 0 1 -7.8 11.6 M -9.8 10 A 14 14 0 0 1 -13.5 3.7" fill="none"
      stroke={WATER.reflection} strokeWidth={0.27} strokeOpacity={0.85} strokeLinecap="round" />,
    <path key="crest" d="M 10.9 9.1 A 14.2 14.2 0 0 1 1.5 14.1 M -2.8 13.9 A 14.2 14.2 0 0 1 -6.6 12.6" fill="none"
      stroke={WATER.highlight} strokeWidth={0.1} strokeOpacity={0.56} strokeLinecap="round" />,
    <path key="trough" d="M 11.5 8.5 A 14.4 14.4 0 0 1 -8.4 11.7" fill="none"
      stroke={WATER.shadow} strokeWidth={0.24} strokeOpacity={0.55} strokeLinecap="round" />,
  ];
}

function createWaterCrownNodes(idScope, key) {
  return [
    <path key="sheet" d="M -13 0 C -9 -.4 -7 -2.6 -8.4 -5.4 C -9 -6.7 -10.7 -7.4 -12 -7.1 C -8.5 -8.2 -5.3 -6.6 -4.1 -3.4 Q -2.5 -.6 0 -.7 C 3 -.7 3.7 -4.8 6.7 -6 C 8.2 -6.6 10 -6.4 11.2 -5.5 C 7.5 -5.9 7.3 -2.3 8.5 -1.2 Q 10.5 -.2 13 0 Q 6 1.8 0 1.2 Q -7 1.4 -13 0 Z"
      fill={idScope.url(`water-${key}-sheet-grad`)} />,
    <path key="left-edge" d="M -12 -7.1 C -8.5 -8.2 -5.3 -6.6 -4.1 -3.4 Q -2.5 -.6 0 -.7" fill="none"
      stroke={WATER.reflection} strokeWidth={0.65} strokeOpacity={0.72} strokeLinecap="round" />,
    <path key="right-edge" d="M 1.6 -1.3 C 4 -2.2 3.7 -4.8 6.7 -6 Q 9 -7 11.2 -5.5" fill="none"
      stroke={WATER.highlight} strokeWidth={0.5} strokeOpacity={0.65} strokeLinecap="round" />,
    <path key="fold" d="M -6.5 -3.2 Q -5 -1.2 -2.6 -.9 M 6.5 -3 Q 6.4 -1.5 8.5 -1.2" fill="none"
      stroke={WATER.shadow} strokeWidth={0.55} strokeOpacity={0.32} strokeLinecap="round" />,
  ];
}

function createWaterContactNodes() {
  return [
    <ellipse key="contact" cx={0} cy={0} rx={12} ry={12} fill={WATER.shadow} opacity={0.16} />,
    <path key="meniscus" d="M -11 3 Q -8 10 0 10 Q 8 10 11 3" fill="none"
      stroke={WATER.reflection} strokeWidth={0.8} strokeOpacity={0.55} strokeLinecap="round" />,
  ];
}

// The SVG scene and Pixi material compiler use these same vector details.
export function buildZenShishiOdoshiWaterDetailScene({ idScope, part }) {
  if (!idScope) throw new Error('ZEN_SHISHI_WATER_DETAIL_SCOPE_REQUIRED');
  if (part === 'ripple') return { defs: [], nodes: createWaterRippleNodes() };
  if (part === 'contact') return { defs: [], nodes: createWaterContactNodes() };
  if (part === 'crown') return { defs: createWaterDetailDefs(idScope, part), nodes: createWaterCrownNodes(idScope, part) };
  if (part === 'droplet') return { defs: createWaterDetailDefs(idScope, part), nodes: createWaterDropletNodes(idScope, part) };
  throw new Error(`ZEN_SHISHI_WATER_DETAIL_PART_INVALID:${part}`);
}

function createStreamRibbonPath(left, width) {
  const y = SHISHI_ODOSHI_STREAM_SOURCE_Y;
  const right = left + width;
  return `M ${left + 0.7} ${y} C ${left + 0.1} ${y + 145} ${left + 0.65} ${y + 260} ${left + 0.4} ${y + 390}
    C ${left + 0.05} ${y + 510} ${left + 0.65} ${y + 630} ${left + 0.7} ${y + 730}
    L ${right - 0.6} ${y + 730} C ${right + 0.1} ${y + 570} ${right - 0.45} ${y + 450} ${right - 0.25} ${y + 365}
    C ${right + 0.1} ${y + 260} ${right - 0.5} ${y + 100} ${right - 0.6} ${y} Z`;
}

function createLiquidStreamDefs(idScope) {
  // Cross-sectional refraction: a transparent edge, shaded body, one thin
  // reflected highlight. No fractal displacement, bloom or signature tint.
  return [
    createArtifactSceneNode('linearGradient', {
      id: idScope.get('liquid-stream-base-grad'), x1: '0', y1: '0', x2: '1', y2: '0',
    }, [
      createStop('0%', WATER.shadow, 0), createStop('14%', WATER.shadow, 0.4),
      createStop('38%', WATER.body, 0.34), createStop('65%', WATER.reflection, 0.58),
      createStop('84%', WATER.body, 0.18), createStop('100%', WATER.shadow, 0),
    ]),
    createArtifactSceneNode('linearGradient', {
      id: idScope.get('liquid-stream-core-grad'), x1: '0', y1: '0', x2: '1', y2: '0',
    }, [createStop('0%', WATER.highlight, 0), createStop('55%', WATER.highlight, 0.76),
      createStop('100%', WATER.reflection, 0.08)]),
    createArtifactSceneNode('linearGradient', {
      id: idScope.get('liquid-stream-glint-grad'), x1: '0', y1: '0', x2: '0', y2: '1',
    }, [createStop('0%', WATER.reflection, 0), createStop('38%', WATER.highlight, 0.75),
      createStop('66%', WATER.reflection, 0.3), createStop('100%', WATER.reflection, 0)]),
    createArtifactSceneNode('linearGradient', {
      id: idScope.get('liquid-stream-tail-grad'), x1: '0', y1: '0', x2: '0', y2: '1',
    }, [createStop('0%', WATER.reflection, 0.58), createStop('62%', WATER.body, 0.28),
      createStop('100%', WATER.body, 0)]),
  ];
}

function createTubeJointNodes(idScope) {
  return TUBE_JOINT_COLUMNS.flatMap((x) => ([
    createArtifactScenePath({
      d: `M ${x} 10.2 Q ${x - 4} 24 ${x} 37.8
        L ${x + 3.1} 37.8 Q ${x - 0.9} 24 ${x + 3.1} 10.2 Z`,
      fill: idScope.url('joint-grad'),
    }),
    createArtifactScenePath({
      d: `M ${x + 0.2} 10.5 Q ${x - 3.8} 24 ${x + 0.2} 37.5`,
      fill: 'none', stroke: '#afb580', strokeWidth: 0.65, opacity: 0.28,
    }),
    createArtifactScenePath({
      d: `M ${x + 3} 10.5 Q ${x - 1} 24 ${x + 3} 37.5`,
      fill: 'none', stroke: '#3a4c2a', strokeWidth: 0.5, opacity: 0.24,
    }),
  ]));
}

function createTubeGrainNodes() {
  const litGrain = [
    'M 47 12.2 C 79 11.8 110 12.6 143 12.5 M 153 12.7 Q 220 13.5 282 12.8',
    'M 45 15.8 Q 77 15.2 86 15.5 M 101 15.6 Q 154 16.3 171 15.8 M 187 16.2 Q 231 15.5 260 16',
    'M 54 21.5 Q 76 20.7 86 21 M 99 20.8 Q 136 21.5 164 21.1 M 208 21.3 Q 242 20.8 258 21',
    'M 43 29.1 Q 69 28.5 86 28.7 M 123 29.4 Q 148 28.6 171 29 M 187 29.2 Q 225 29.8 257 29.2',
  ];
  const shadedGrain = [
    'M 50 18.3 Q 73 18.9 86 18.5 M 102 18.7 Q 133 18.1 151 18.6 M 210 18.6 Q 243 19.3 260 18.8',
    'M 56 25.2 Q 74 24.7 86 25.1 M 105 25.8 Q 140 24.9 170 25.2 M 190 25.4 Q 222 24.8 249 25.4',
    'M 29 33.8 Q 61 34.8 86 34.4 M 101 34.1 Q 143 35 171 34.2 M 188 34 Q 235 34.6 261 34.2',
  ];
  return [
    ...litGrain.map(d => createArtifactScenePath({ d, fill: 'none', stroke: '#c7c88a', strokeWidth: 0.55, opacity: 0.14, strokeLinecap: 'round' })),
    ...shadedGrain.map(d => createArtifactScenePath({ d, fill: 'none', stroke: '#263c23', strokeWidth: 0.6, opacity: 0.2, strokeLinecap: 'round' })),
  ];
}

function createTubeCutFaceNodes(idScope) {
  const fibers = [0.12, 0.51, 0.85, 1.22, 1.73, 2.16, 2.7, 3.18, 3.62, 4.02, 4.48, 4.85, 5.25, 5.73, 6.12];
  return [
    createArtifactScenePath({
      d: createEllipseBandPath({ startAngle: 0, endAngle: Math.PI * 2 }),
      fill: idScope.url('bamboo-cut-grad'),
      fillRule: 'evenodd',
    }),
    ...fibers.map(angle => {
      const inner = resolveRotatedEllipsePoint(SHISHI_ODOSHI_TUBE_MOUTH_X, SHISHI_ODOSHI_TUBE_MOUTH_Y,
        SHISHI_ODOSHI_MOUTH_ELLIPSE_RX + 0.5, SHISHI_ODOSHI_MOUTH_ELLIPSE_RY + 0.25, SHISHI_ODOSHI_MOUTH_ELLIPSE_ROTATE, angle);
      const outer = resolveRotatedEllipsePoint(SHISHI_ODOSHI_TUBE_MOUTH_X, SHISHI_ODOSHI_TUBE_MOUTH_Y,
        TUBE_RIM_OUTER_RX - 0.6, TUBE_RIM_OUTER_RY - 0.3, SHISHI_ODOSHI_MOUTH_ELLIPSE_ROTATE, angle);
      return createArtifactScenePath({
        d: `M ${formatNumber(inner.x)} ${formatNumber(inner.y)} L ${formatNumber(outer.x)} ${formatNumber(outer.y)}`,
        fill: 'none', stroke: '#84774e', strokeWidth: 0.5, opacity: 0.35,
      });
    }),
    createMouthEllipse({ fill: 'none', stroke: '#617042', strokeWidth: 0.45, opacity: 0.35 }),
    createMouthEllipse({ rx: TUBE_RIM_OUTER_RX, ry: TUBE_RIM_OUTER_RY, fill: 'none', stroke: '#92976b', strokeWidth: 0.45, opacity: 0.3 }),
  ];
}

function createStandBambooNodes(idScope, { left, top, width, height, material, cutColor, grainOpacity, groundTiltDeg, groundAspect }) {
  const center = left + width / 2;
  const right = left + width;
  return [
    createArtifactScenePath({
      d: createPiercedStandShellPath(left, top, width, height),
      fill: idScope.url(`${material}-grad`),
      fillRule: 'evenodd',
    }),
    createArtifactSceneGroup({ clipPath: idScope.url(`${material}-clip`) }, [
      createArtifactScenePath({
        d: `M ${left + 3} ${top + 6} C ${left + 2.5} ${top + height * 0.3} ${left + 3.8} ${top + height * 0.65} ${left + 3} ${top + height - 3}`,
        fill: 'none', stroke: '#c4b887', strokeWidth: 0.55, opacity: grainOpacity,
      }),
      createArtifactScenePath({
        d: `M ${right - 3} ${top + 13} Q ${right - 3.7} ${top + height * 0.45} ${right - 2.8} ${top + height * 0.7}
          M ${right - 2.9} ${top + height * 0.75} L ${right - 3.2} ${top + height - 5}`,
        fill: 'none', stroke: '#303a28', strokeWidth: 0.55, opacity: 0.23,
      }),
      ...[0.28, 0.72].flatMap(fraction => {
        const y = formatNumber(top + height * fraction);
        return [
          createArtifactScenePath({
            d: `M ${left + 0.5} ${y} Q ${center} ${y + 1.4} ${right - 0.3} ${y - 0.2}
              L ${right - 0.2} ${y + 1.3} Q ${center} ${y + 3} ${left + 0.4} ${y + 1.6} Z`,
            fill: '#b1a274', opacity: 0.2,
          }),
          createArtifactScenePath({
            d: `M ${left + 0.7} ${y + 1.8} Q ${center} ${y + 3} ${right - 0.5} ${y + 1.5}`,
            fill: 'none', stroke: '#35412b', strokeWidth: 0.6, opacity: 0.3,
          }),
        ];
      }),
    ]),
    createArtifactSceneGroup({ transform: `rotate(${formatNumber(groundTiltDeg)} ${center} ${top + 1.4})` }, [
      createArtifactSceneEllipse({ cx: center, cy: top + 1.4, rx: width / 2 - 0.7, ry: (width / 2 - 0.7) * groundAspect, fill: cutColor }),
      createArtifactSceneEllipse({ cx: center + 0.1, cy: top + 1.45, rx: width / 2 - 1.8, ry: (width / 2 - 1.8) * groundAspect * 0.75, fill: '#596042', opacity: 0.75 }),
    ]),
  ];
}

function createBackStandNodes(idScope, groundTiltDeg, groundAspect) {
  return [
    createArtifactSceneGroup({
      transform: `translate(${STAND_AXLE_X} ${STAND_AXLE_Y}) rotate(${formatNumber(STAND_DEPTH_ROTATE)})`,
    }, [
      createArtifactSceneEllipse({ cx: -BACK_AXLE_LENGTH, cy: 0, rx: STAND_BORE_RX, ry: STAND_BORE_RY, fill: '#353e2b' }),
      createArtifactSceneRect({ x: -BACK_AXLE_LENGTH, y: -1.65, width: BACK_AXLE_LENGTH + FRONT_AXLE_LENGTH,
        height: 3.3, rx: 0.8, fill: idScope.url('stand-pin-grad') }),
      createArtifactSceneEllipse({ cx: -BACK_AXLE_LENGTH, cy: 0, rx: 1.1, ry: 1.8, fill: '#6b6b4c' }),
    ]),
    ...createStandBambooNodes(idScope, { left: BACK_STAND_LEFT, top: BACK_STAND_TOP,
      width: BACK_STAND_WIDTH, height: BACK_STAND_HEIGHT, material: 'back-stand', cutColor: '#7e805b', grainOpacity: 0.11, groundTiltDeg, groundAspect }),
  ];
}

function createFrontStandNodes(idScope, groundTiltDeg, groundAspect) {
  return [
    // The complete shaft belongs behind the tube. This front layer exposes
    // only its end through the projected near-surface bore, without a spur
    // at the tube's center or a bar crossing the post's front face.
    createArtifactSceneGroup({
      transform: `translate(${STAND_AXLE_X} ${STAND_AXLE_Y}) rotate(${formatNumber(STAND_DEPTH_ROTATE)})`,
    }, [createArtifactSceneGroup({ clipPath: idScope.url('front-stand-bore-clip') }, [
      createArtifactSceneEllipse({ cx: FRONT_AXLE_LENGTH, cy: 0, rx: STAND_BORE_RX, ry: STAND_BORE_RY,
        fill: '#3d422e' }),
      createArtifactSceneRect({ x: FRONT_AXLE_LENGTH - 3, y: -1.65, width: 3.2,
        height: 3.3, rx: 0.8, fill: '#84724f' }),
      createArtifactScenePath({ d: `M ${formatNumber(FRONT_AXLE_LENGTH - 3)} -1.15 L ${formatNumber(FRONT_AXLE_LENGTH - 0.7)} -1.15`,
        fill: 'none', stroke: '#c7b48b', strokeWidth: 0.45, opacity: 0.35, strokeLinecap: 'round' }),
      createArtifactSceneEllipse({ cx: FRONT_AXLE_LENGTH, cy: 0, rx: 1.25, ry: 2,
        fill: idScope.url('stand-pin-face-grad') }),
      createArtifactScenePath({ d: `M ${formatNumber(FRONT_AXLE_LENGTH - 0.35)} -0.9 Q ${formatNumber(FRONT_AXLE_LENGTH + 0.25)} 0 ${formatNumber(FRONT_AXLE_LENGTH - 0.1)} 1`,
        fill: 'none', stroke: '#706044', strokeWidth: 0.4, opacity: 0.4, strokeLinecap: 'round' }),
    ])]),
    ...createStandBambooNodes(idScope, { left: FRONT_STAND_LEFT, top: FRONT_STAND_TOP,
      width: FRONT_STAND_WIDTH, height: FRONT_STAND_HEIGHT, material: 'front-stand', cutColor: '#a39970', grainOpacity: 0.16, groundTiltDeg, groundAspect }),
  ];
}

function createRockNodes(idScope, groundAspect) {
  const minerals = [[18, 23, 0.45], [24, 16, 0.35], [29, 27, 0.55], [34, 12, 0.4],
    [40, 22, 0.45], [47, 17, 0.35], [54, 27, 0.4], [61, 32, 0.5],
    [33, 37, 0.35], [20, 34, 0.5], [47, 40, 0.4], [58, 39, 0.35]];
  return [
    createArtifactSceneEllipse({
      cx: ROCK.contactX,
      cy: ROCK.contactY,
      rx: 35.5,
      ry: 35.5 * groundAspect,
      fill: '#050504',
      opacity: 0.55,
    }),
    createArtifactSceneGroup({ transform: `translate(${ROCK.left} ${ROCK.top}) scale(1 ${ROCK.scaleY})` }, [
      createArtifactScenePath({ d: ROCK_BODY_PATH, fill: idScope.url('rock-grad') }),
      createArtifactSceneGroup({ clipPath: idScope.url('rock-surface-clip') }, [
        createArtifactScenePath({ d: 'M 11 17 C 18 11 21 7 30 5 C 38 3 49 4 57 10 L 59 17 C 46 19 27 17 11 17 Z',
          fill: idScope.url('rock-crown-grad') }),
        createArtifactScenePath({ d: 'M 59 17 Q 70 19 73 27 Q 76 35 67 42 Q 55 46 40 47 Q 51 35 59 17 Z',
          fill: '#333d36', opacity: 0.12 }),
        createArtifactScenePath({ d: 'M 8 36 Q 17 39 26 37 Q 45 35 73 32 L 79 53 L 5 53 Z',
          fill: idScope.url('rock-foot-grad') }),
        createArtifactScenePath({ d: 'M 17 22 Q 25 20 30 23 M 32 23 Q 38 26 46 24 Q 53 24 59 28',
          fill: 'none', stroke: '#b8b39c', strokeWidth: 0.55, opacity: 0.18, strokeLinecap: 'round' }),
        createArtifactScenePath({ d: 'M 20 35 Q 30 30 40 33 M 43 34 Q 51 36 61 31',
          fill: 'none', stroke: '#30392f', strokeWidth: 0.55, opacity: 0.18, strokeLinecap: 'round' }),
        ...minerals.map(([cx, cy, r], index) => createArtifactSceneNode('circle', {
          cx, cy, r, fill: index % 3 === 0 ? '#30392f' : '#c0bda6', opacity: 0.22,
        })),
      ]),
    ]),
  ];
}

function createKaresansuiDefs(idScope, side) {
  return [createArtifactSceneNode('radialGradient', { id: idScope.get(`${side}-ground-grad`) }, [
    createStop('0%', '#a2937b', 0.3),
    createStop('45%', '#8a7c67', 0.17),
    createStop('78%', '#756a59', 0.06),
    createStop('100%', '#756a59', 0),
  ])];
}

function createKaresansuiNodes(idScope, { centerX, baseY, radius, side, groundAspect }) {
  return [createArtifactSceneGroup({
    transform: `translate(${centerX} ${baseY}) scale(1 ${groundAspect})`,
  }, [
    createArtifactSceneEllipse({ cx: 0, cy: 0.8, rx: radius * 0.7, ry: radius * 0.45, fill: '#050504', opacity: 0.36 }),
    createArtifactScenePath({
      d: `M ${-radius} -1 C ${-radius * 0.8} ${-radius * 0.7} ${-radius * 0.25} ${-radius} 2 ${-radius * 0.7}
        C ${radius * 0.6} ${-radius * 0.8} ${radius} ${-radius * 0.2} ${radius} 2
        C ${radius * 0.8} ${radius * 0.7} 3 ${radius * 0.8} ${-radius * 0.45} ${radius * 0.55}
        Q ${-radius * 0.9} ${radius * 0.35} ${-radius} -1 Z`,
      fill: idScope.url(`${side}-ground-grad`),
    }),
  ])];
}
export function buildZenShishiOdoshiTubeScene({ idScope }) {
  if (!idScope) {
    throw new Error('[zenShishiOdoshiSceneRecipe] buildZenShishiOdoshiTubeScene requires an id scope.');
  }

  const bodyPath = createTubeBodyPath();
  const innerWallBandPath = createEllipseBandPath({
    startAngle: 0,
    endAngle: Math.PI,
    outerRx: SHISHI_ODOSHI_MOUTH_ELLIPSE_RX,
    outerRy: SHISHI_ODOSHI_MOUTH_ELLIPSE_RY,
    innerRx: SHISHI_ODOSHI_MOUTH_ELLIPSE_RX - 1.2,
    innerRy: SHISHI_ODOSHI_MOUTH_ELLIPSE_RY * 0.82,
  });

  return Object.freeze({
    backDefs: createTubeInteriorDefs(idScope),
    backNodes: [
      createMouthEllipse({ fill: idScope.url('bamboo-interior-grad') }),
      createArtifactSceneGroup({ clipPath: idScope.url('bamboo-cavity-clip') }, [
        createArtifactSceneEllipse({
          cx: SHISHI_ODOSHI_TUBE_MOUTH_X + TUBE_CAVITY_DEPTH_X,
          cy: SHISHI_ODOSHI_TUBE_MOUTH_Y + 0.4,
          rx: SHISHI_ODOSHI_MOUTH_ELLIPSE_RX - 1,
          ry: SHISHI_ODOSHI_MOUTH_ELLIPSE_RY * 0.84,
          transform: `rotate(${SHISHI_ODOSHI_MOUTH_ELLIPSE_ROTATE} ${SHISHI_ODOSHI_TUBE_MOUTH_X + TUBE_CAVITY_DEPTH_X} ${SHISHI_ODOSHI_TUBE_MOUTH_Y + 0.4})`,
          fill: idScope.url('bamboo-depth-grad'),
        }),
        createArtifactScenePath({ d: innerWallBandPath, fill: '#a9a779', opacity: 0.24 }),
      ]),
    ],
    frontDefs: createTubeExteriorDefs(idScope, bodyPath),
    frontNodes: [
      createArtifactScenePath({
        d: bodyPath,
        fill: idScope.url('bamboo-grad'),
        mask: idScope.url('mouth-hole-mask'),
      }),
      createArtifactSceneGroup({
        clipPath: idScope.url('bamboo-shell-clip'),
        mask: idScope.url('mouth-hole-mask'),
      }, [
        createArtifactScenePath({ d: bodyPath, fill: idScope.url('bamboo-patina-grad') }),
        ...createTubeGrainNodes(),
        ...createTubeJointNodes(idScope),
      ]),
      ...createTubeCutFaceNodes(idScope),
    ],
  });
}

export function buildZenShishiOdoshiBackdropScene({ idScope, groundTiltDeg = SHISHI_ODOSHI_GROUND_VIEW.tiltDeg,
  groundAspect = SHISHI_ODOSHI_GROUND_VIEW.ellipseAspect }) {
  if (!idScope) {
    throw new Error('[zenShishiOdoshiSceneRecipe] buildZenShishiOdoshiBackdropScene requires an id scope.');
  }

  return Object.freeze({
    defs: [...createBackStandDefs(idScope), ...createKaresansuiDefs(idScope, 'back')],
    nodes: [
      ...createBackStandNodes(idScope, groundTiltDeg, groundAspect),
      ...createKaresansuiNodes(idScope, { centerX: BACK_STAND_CENTER_X, baseY: BACK_STAND_TOP + BACK_STAND_HEIGHT,
        radius: 19, side: 'back', groundAspect }),
    ],
  });
}

export function buildZenShishiOdoshiRockScene({ idScope, groundAspect = SHISHI_ODOSHI_GROUND_VIEW.ellipseAspect }) {
  if (!idScope) {
    throw new Error('[zenShishiOdoshiSceneRecipe] buildZenShishiOdoshiRockScene requires an id scope.');
  }

  return Object.freeze({
    defs: createRockDefs(idScope),
    nodes: createRockNodes(idScope, groundAspect),
  });
}

export function buildZenShishiOdoshiForegroundScene({ idScope, groundTiltDeg = SHISHI_ODOSHI_GROUND_VIEW.tiltDeg,
  groundAspect = SHISHI_ODOSHI_GROUND_VIEW.ellipseAspect }) {
  if (!idScope) {
    throw new Error('[zenShishiOdoshiSceneRecipe] buildZenShishiOdoshiForegroundScene requires an id scope.');
  }

  return Object.freeze({
    defs: [...createFrontStandDefs(idScope), ...createKaresansuiDefs(idScope, 'front')],
    nodes: [
      ...createFrontStandNodes(idScope, groundTiltDeg, groundAspect),
      ...createKaresansuiNodes(idScope, { centerX: FRONT_STAND_CENTER_X, baseY: FRONT_STAND_TOP + FRONT_STAND_HEIGHT,
        radius: 22, side: 'front', groundAspect }),
    ],
  });
}

export function buildZenShishiOdoshiGroundRippleScene({
  idScope,
  groundTiltDeg = SHISHI_ODOSHI_GROUND_VIEW.tiltDeg,
  groundAspect = SHISHI_ODOSHI_GROUND_VIEW.ellipseAspect,
  shouldAnimateMotion,
  rippleSplashOpacity,
  rippleSplashScaleX,
  rippleSplashScaleY,
  rippleDropletOpacity,
  ripple1Opacity,
  ripple1ScaleX,
  ripple1ScaleY,
  ripple2Opacity,
  ripple2ScaleX,
  ripple2ScaleY,
  ripple3Opacity,
  ripple3ScaleX,
  ripple3ScaleY,
}) {
  if (!idScope) throw new Error('ZEN_SHISHI_GROUND_SCOPE_REQUIRED');
  const rings = [
    { opacity: ripple1Opacity, scaleX: ripple1ScaleX, scaleY: ripple1ScaleY },
    { opacity: ripple2Opacity, scaleX: ripple2ScaleX, scaleY: ripple2ScaleY },
    { opacity: ripple3Opacity, scaleX: ripple3ScaleX, scaleY: ripple3ScaleY },
  ];
  return Object.freeze({
    defs: createWaterDetailDefs(idScope, 'ground'),
    nodes: [
      <g key="ground-ripple-root"
        transform={'translate(' + formatNumber(GROUND_RIPPLE_CONTAINER_LEFT) + ' ' + formatNumber(GROUND_RIPPLE_TOP) + ')'}>
        <g transform="translate(50 24)">
          <motion.g style={{ opacity: rippleSplashOpacity }}>
            <g transform={`rotate(${groundTiltDeg}) scale(1 ${groundAspect})`}>
              {createWaterContactNodes()}
            </g>
            <motion.g style={{ scaleX: rippleSplashScaleX, scaleY: rippleSplashScaleY, ...WATER_LOCAL_TRANSFORM }}>
              {createWaterCrownNodes(idScope, 'ground')}
            </motion.g>
          </motion.g>
          <motion.g style={{ opacity: rippleDropletOpacity }}>
            {shouldAnimateMotion && ZEN_SHISHI_GROUND_BEADS.map((bead, index) => {
              const samples = ZEN_SHISHI_DROPLET_KEY_TIMES.map(t => resolveZenShishiGroundDropletPose(bead, t));
              const animate = Object.fromEntries(['x', 'y', 'rotate', 'scaleX', 'scaleY', 'opacity']
                .map(key => [key, samples.map(sample => sample[key])]));
              return <motion.g key={index} style={WATER_LOCAL_TRANSFORM} animate={animate}
                transition={{ duration: bead.dur, delay: bead.delay, times: ZEN_SHISHI_DROPLET_KEY_TIMES, repeat: Infinity, ease: 'linear' }}>
                {createWaterDropletNodes(idScope, 'ground')}
              </motion.g>;
            })}
          </motion.g>
          {rings.map((ring, index) => (
            <g key={index} transform={`rotate(${groundTiltDeg})`}>
              <motion.g data-zen-shishi-part="ground-ripple" data-ring-index={index}
                style={{ ...ring, ...WATER_LOCAL_TRANSFORM }}>
                {createWaterRippleNodes()}
              </motion.g>
            </g>
          ))}
        </g>
      </g>,
    ],
  });
}
export function buildZenShishiOdoshiLiquidStreamScene({
  idScope,
  captureStemHeight,
  streamSpread,
  streamBaseOpacity,
  streamCoreOpacity,
  freeFallBaseOpacity,
  freeFallCoreOpacity,
  captureTailLength,
  captureTailRotate,
  captureTailOpacity,
  shouldAnimateMotion,
}) {
  if (!idScope) {
    throw new Error('[zenShishiOdoshiSceneRecipe] buildZenShishiOdoshiLiquidStreamScene requires an id scope.');
  }

  const captureWobbleTransition = shouldAnimateMotion
    ? { duration: 2.45, repeat: Infinity, ease: 'easeInOut' }
    : { duration: 0.2, ease: 'linear' };
  const captureCoreTransition = shouldAnimateMotion
    ? { duration: 0.85, repeat: Infinity, ease: 'linear' }
    : { duration: 0.2, ease: 'linear' };
  const freeFallTransition = shouldAnimateMotion
    ? { duration: 2.2, repeat: Infinity, ease: 'easeInOut' }
    : { duration: 0.2, ease: 'linear' };
  const freeFallCoreTransition = shouldAnimateMotion
    ? { duration: 0.7, repeat: Infinity, ease: 'linear' }
    : { duration: 0.2, ease: 'linear' };

  return Object.freeze({
    defs: [
      ...createLiquidStreamDefs(idScope),
      (
        <clipPath key="captured-stream-clip" id={idScope.get('captured-stream-clip')}>
          <motion.rect
            x={CAPTURE_STREAM_CLIP_LEFT}
            y={SHISHI_ODOSHI_STREAM_SOURCE_Y}
            width={CAPTURE_STREAM_CLIP_WIDTH}
            height={captureStemHeight}
            rx={6}
          />
        </clipPath>
      ),
      createArtifactSceneNode('clipPath', {
        id: idScope.get('free-fall-stream-clip'),
      }, [
        createArtifactSceneRect({
          x: FREE_FALL_STREAM_CLIP_LEFT,
          y: SHISHI_ODOSHI_STREAM_SOURCE_Y,
          width: FREE_FALL_STREAM_CLIP_WIDTH,
          height: SHISHI_ODOSHI_FREE_FALL_STREAM_HEIGHT,
          rx: 6,
        }),
      ]),
    ],
    nodes: [
      (
        <motion.g
          key="captured-stream-base"
          clipPath={idScope.url('captured-stream-clip')}
          style={{
            opacity: streamBaseOpacity,
            scaleX: streamSpread,
            transformBox: 'fill-box',
            transformOrigin: '50% 0%',
          }}
          animate={shouldAnimateMotion ? {
            x: [-0.22, 0.18, -0.16, 0.2, -0.22],
            skewX: [-0.35, 0.28, -0.2, 0.22, -0.35],
          } : undefined}
          transition={captureWobbleTransition}
        >
          <path
            d={createStreamRibbonPath(CAPTURE_BASE_STREAM_LEFT, CAPTURE_BASE_STREAM_WIDTH)}
            fill={idScope.url('liquid-stream-base-grad')}

          />

          <motion.rect
            x={CAPTURE_BASE_STREAM_LEFT + 0.65}
            y={SHISHI_ODOSHI_STREAM_SOURCE_Y - 140}
            width={0.75}
            height={42}
            rx={999}
            fill={idScope.url('liquid-stream-glint-grad')}
            opacity={0.48}

            animate={shouldAnimateMotion ? { y: [0, SHISHI_ODOSHI_SACRED_STREAM_MAX_HEIGHT + 180] } : undefined}
            transition={captureCoreTransition}
          />
        </motion.g>
      ),
      (
        <motion.g
          key="captured-stream-core"
          clipPath={idScope.url('captured-stream-clip')}
          style={{
            opacity: streamCoreOpacity,
            scaleX: streamSpread,
            transformBox: 'fill-box',
            transformOrigin: '50% 0%',
          }}
          animate={shouldAnimateMotion ? {
            x: [0.14, -0.12, 0.15, -0.08, 0.14],
          } : undefined}
          transition={captureCoreTransition}
        >
          <rect
            x={CAPTURE_CORE_STREAM_LEFT}
            y={SHISHI_ODOSHI_STREAM_SOURCE_Y}
            width={CAPTURE_CORE_STREAM_WIDTH}
            height={SHISHI_ODOSHI_SACRED_STREAM_MAX_HEIGHT}
            rx={999}
            fill={idScope.url('liquid-stream-core-grad')}

          />
          <motion.rect
            x={CAPTURE_CORE_STREAM_LEFT + 0.1}
            y={SHISHI_ODOSHI_STREAM_SOURCE_Y - 180}
            width={0.6}
            height={26}
            rx={999}
            fill={idScope.url('liquid-stream-glint-grad')}
            opacity={0.65}

            animate={shouldAnimateMotion ? { y: [0, SHISHI_ODOSHI_SACRED_STREAM_MAX_HEIGHT + 180] } : undefined}
            transition={freeFallCoreTransition}
          />
        </motion.g>
      ),
      (
        <motion.g
          key="captured-tail"
          style={{
            y: captureStemHeight,
            opacity: captureTailOpacity,
            rotate: captureTailRotate,
            transformBox: 'fill-box',
            transformOrigin: `${formatNumber(TAIL_STREAM_LEFT + (TAIL_STREAM_WIDTH / 2))}px ${formatNumber(SHISHI_ODOSHI_STREAM_SOURCE_Y)}px`,
          }}
        >
          <motion.rect
            x={TAIL_STREAM_LEFT}
            y={SHISHI_ODOSHI_STREAM_SOURCE_Y}
            width={TAIL_STREAM_WIDTH}
            height={captureTailLength}
            rx={999}
            fill={idScope.url('liquid-stream-tail-grad')}

          />
          <motion.rect
            x={SHISHI_ODOSHI_STREAM_CAPTURE_CENTER_X + 1.1}
            y={SHISHI_ODOSHI_STREAM_SOURCE_Y}
            width={0.65}
            height={captureTailLength}
            rx={999}
            fill={WATER.reflection}
            opacity={0.55}

          />
        </motion.g>
      ),
      (
        <motion.g
          key="free-fall-stream-base"
          clipPath={idScope.url('free-fall-stream-clip')}
          style={{ opacity: freeFallBaseOpacity }}
          animate={shouldAnimateMotion ? {
            x: [-0.1, 0.08, -0.05, 0.09, -0.1],
          } : undefined}
          transition={freeFallTransition}
        >
          <path
            d={createStreamRibbonPath(FREE_FALL_BASE_STREAM_LEFT, FREE_FALL_BASE_STREAM_WIDTH)}
            fill={idScope.url('liquid-stream-base-grad')}

          />

        </motion.g>
      ),
      (
        <motion.g
          key="free-fall-stream-core"
          clipPath={idScope.url('free-fall-stream-clip')}
          style={{ opacity: freeFallCoreOpacity }}
          animate={shouldAnimateMotion ? {
            x: [0.08, -0.07, 0.06, -0.04, 0.08],
          } : undefined}
          transition={freeFallCoreTransition}
        >
          <rect
            x={FREE_FALL_CORE_STREAM_LEFT}
            y={SHISHI_ODOSHI_STREAM_SOURCE_Y}
            width={FREE_FALL_CORE_STREAM_WIDTH}
            height={SHISHI_ODOSHI_SACRED_STREAM_MAX_HEIGHT}
            rx={999}
            fill={idScope.url('liquid-stream-core-grad')}

          />
          <motion.rect
            x={FREE_FALL_CORE_STREAM_LEFT - 0.25}
            y={SHISHI_ODOSHI_STREAM_SOURCE_Y - 150}
            width={0.5}
            height={34}
            rx={999}
            fill={idScope.url('liquid-stream-glint-grad')}
            opacity={0.58}

            animate={shouldAnimateMotion ? { y: [0, SHISHI_ODOSHI_SACRED_STREAM_MAX_HEIGHT + 180] } : undefined}
            transition={freeFallTransition}
          />
        </motion.g>
      ),
    ],
  });
}

export function buildZenShishiOdoshiLipSplashScene({
  idScope,
  lipY,
  lipOpacity,
  lipSplashParticles,
  shouldAnimateMotion,
}) {
  if (!idScope) throw new Error('ZEN_SHISHI_LIP_SCOPE_REQUIRED');
  if (!Array.isArray(lipSplashParticles)) throw new Error('ZEN_SHISHI_LIP_PARTICLES_REQUIRED');

  return Object.freeze({
    defs: createWaterDetailDefs(idScope, 'lip'),
    nodes: [
      (
        <g
          key="lip-splash-root"
          transform={`translate(${formatNumber(SHISHI_ODOSHI_LIP_SPLASH_LEFT)} ${formatNumber(SHISHI_ODOSHI_STREAM_SOURCE_Y)})`}
        >
          {/* Keep the scene origin outside Motion's CSS transform writer. */}
          <motion.g
            data-zen-shishi-part="lip-splash"
            style={{
              y: lipY,
              opacity: lipOpacity,
            }}
          >
            <g transform="translate(10 5)">
            {lipSplashParticles.map((particle, index) => {
              const poses = ZEN_SHISHI_DROPLET_KEY_TIMES.map((time) => resolveZenShishiDropletPose(particle, time));
              const keyframes = Object.fromEntries(Object.keys(poses[0]).map((key) => [key, poses.map((pose) => pose[key])]));
              return (
                <motion.g
                  key={`lip-splash-particle-${index}`}
                  style={{ opacity: 0, ...WATER_LOCAL_TRANSFORM }}
                  animate={shouldAnimateMotion ? keyframes : { opacity: 0 }}
                  transition={shouldAnimateMotion ? {
                    duration: particle.dur,
                    repeat: Infinity,
                    ease: 'linear',
                    times: [...ZEN_SHISHI_DROPLET_KEY_TIMES],
                    delay: particle.delay,
                  } : { duration: 0.2, ease: 'linear' }}
                >
                  {createWaterDropletNodes(idScope, 'lip')}
                </motion.g>
              );
            })}
            </g>
          </motion.g>
        </g>
      ),
    ],
  });
}
