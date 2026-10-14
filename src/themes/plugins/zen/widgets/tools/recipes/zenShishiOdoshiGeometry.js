// Shared scene geometry, independent of JSX/rendering. The scene and physics
// import this same coordinate contract; offline physics needs no UI loader.
export const SHISHI_ODOSHI_DROP_Y = 30;
export const SHISHI_ODOSHI_TUBE_LEFT = 26;
export const SHISHI_ODOSHI_TUBE_BASE_TOP = 137;
export const SHISHI_ODOSHI_TUBE_TOP = SHISHI_ODOSHI_TUBE_BASE_TOP + SHISHI_ODOSHI_DROP_Y;
export const SHISHI_ODOSHI_TUBE_WIDTH = 300;
export const SHISHI_ODOSHI_TUBE_HEIGHT = 48;
export const SHISHI_ODOSHI_TUBE_PIVOT_X = 140;
export const SHISHI_ODOSHI_TUBE_PIVOT_Y = 24;
export const SHISHI_ODOSHI_TUBE_MOUTH_X = 21;
export const SHISHI_ODOSHI_TUBE_MOUTH_Y = 24;
export const SHISHI_ODOSHI_MOUTH_ELLIPSE_RX = 20.5;
export const SHISHI_ODOSHI_MOUTH_ELLIPSE_RY = 3.4;
export const SHISHI_ODOSHI_MOUTH_ELLIPSE_ROTATE = -34;
export const SHISHI_ODOSHI_STAGE_WIDTH = 320;
export const SHISHI_ODOSHI_STAGE_HEIGHT = 320;
export const SHISHI_ODOSHI_SCENE_OFFSET_Y = 7;
// One shallow floor projection: x runs along the bamboo, z runs into depth.
// Principal axes set caps and water. Planted contacts remain visually level.
const FLOOR_DEPTH_X = 0.45;
const FLOOR_DEPTH_Y = 0.2;
const FLOOR_XX = 1 + FLOOR_DEPTH_X ** 2;
const FLOOR_XY = FLOOR_DEPTH_X * FLOOR_DEPTH_Y;
const FLOOR_YY = FLOOR_DEPTH_Y ** 2;
const FLOOR_TRACE = FLOOR_XX + FLOOR_YY;
const FLOOR_SPREAD = Math.hypot(FLOOR_XX - FLOOR_YY, 2 * FLOOR_XY);
export const SHISHI_ODOSHI_GROUND_VIEW = Object.freeze({
  depthX: FLOOR_DEPTH_X,
  depthY: FLOOR_DEPTH_Y,
  tiltDeg: Math.atan2(2 * FLOOR_XY, FLOOR_XX - FLOOR_YY) * 90 / Math.PI,
  ellipseAspect: Math.sqrt((FLOOR_TRACE - FLOOR_SPREAD) / (FLOOR_TRACE + FLOOR_SPREAD)),
});
export const SHISHI_ODOSHI_STAND_GEOMETRY = Object.freeze({
  backOffsetX: -3,
  frontOffsetX: 11,
  frontTop: 120 + SHISHI_ODOSHI_DROP_Y,
  height: 144,
  backWidth: 16,
  frontWidth: 18,
});
const ROCK_LEFT = 261;
const ROCK_TOP = 219 + SHISHI_ODOSHI_DROP_Y;
const ROCK_SCALE_Y = 0.9;
// Keep the striking crown at the tube's stop while tucking the footprint back.
export const SHISHI_ODOSHI_ROCK_GEOMETRY = Object.freeze({
  left: ROCK_LEFT,
  top: ROCK_TOP,
  scaleY: ROCK_SCALE_Y,
  contactX: ROCK_LEFT + 39,
  contactY: ROCK_TOP + 47 * ROCK_SCALE_Y,
});
export const SHISHI_ODOSHI_SACRED_STREAM_LEFT = 46.4;
export const SHISHI_ODOSHI_SACRED_STREAM_TOP = -420;
export const SHISHI_ODOSHI_SACRED_STREAM_MAX_HEIGHT = 730;
export const SHISHI_ODOSHI_STREAM_SOURCE_Y = SHISHI_ODOSHI_SACRED_STREAM_TOP + SHISHI_ODOSHI_DROP_Y;
export const SHISHI_ODOSHI_STREAM_BASE_LEFT = SHISHI_ODOSHI_SACRED_STREAM_LEFT;
export const SHISHI_ODOSHI_STREAM_CORE_LEFT = SHISHI_ODOSHI_SACRED_STREAM_LEFT + 2.8;
export const SHISHI_ODOSHI_STREAM_X_OFFSET = -3;
export const SHISHI_ODOSHI_STREAM_CAPTURE_CENTER_X = (SHISHI_ODOSHI_STREAM_BASE_LEFT + SHISHI_ODOSHI_STREAM_X_OFFSET) + 1.5;
export const SHISHI_ODOSHI_LIP_SPLASH_LEFT = SHISHI_ODOSHI_STREAM_BASE_LEFT + SHISHI_ODOSHI_STREAM_X_OFFSET - 10;
export const SHISHI_ODOSHI_GROUND_SPLASH_WORLD_Y = 255 + SHISHI_ODOSHI_DROP_Y + 6;
export const SHISHI_ODOSHI_FREE_FALL_STREAM_HEIGHT = SHISHI_ODOSHI_GROUND_SPLASH_WORLD_Y - SHISHI_ODOSHI_STREAM_SOURCE_Y;
