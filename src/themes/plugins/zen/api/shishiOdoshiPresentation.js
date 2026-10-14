import {
  SHISHI_ODOSHI_STREAM_CAPTURE_CENTER_X,
  SHISHI_ODOSHI_GROUND_SPLASH_WORLD_Y,
  SHISHI_ODOSHI_SCENE_OFFSET_Y,
  SHISHI_ODOSHI_GROUND_VIEW,
} from '../widgets/tools/recipes/zenShishiOdoshiGeometry.js';

export const ZEN_SHISHI_GROUND_PROJECTION = Object.freeze({
  tiltDeg: SHISHI_ODOSHI_GROUND_VIEW.tiltDeg,
  ellipseAspect: SHISHI_ODOSHI_GROUND_VIEW.ellipseAspect,
});

// App-owned decoration may share the widget's physical origin without loading
// a renderer or importing widget internals. Numbers remain owned by geometry.
export const ZEN_SHISHI_GROUND_IMPACT_STYLE = Object.freeze({
  left: SHISHI_ODOSHI_STREAM_CAPTURE_CENTER_X,
  top: SHISHI_ODOSHI_GROUND_SPLASH_WORLD_Y + SHISHI_ODOSHI_SCENE_OFFSET_Y,
});
