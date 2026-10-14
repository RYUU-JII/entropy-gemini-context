// SVG user units are also the simulation's length units. No rendered bounds
// participate in a joint or contact calculation. Angles project into SVG/Pixi.
const upperCordLength = 30;
const strikerRodWidth = 2;
const strikerRodLength = 80;
const strikerCordLength = 24;
const bellRimDrop = 56;
const bellRimDepth = 1.5;
export const ZEN_FURIN_GEOMETRY = Object.freeze({
  width: 300, height: 360,
  supportX: 150, supportY: 20,
  bellTop: upperCordLength, bellCenterY: upperCordLength + 30, bellRimY: upperCordLength + bellRimDrop,
  bellBodyWidth: 58, bellBodyHeight: bellRimDrop + bellRimDepth,
  bellLeft: -38, bellInnerHalfWidth: 20, bellRimDepth,
  strikerPivotY: upperCordLength - 2, strikerLength: strikerCordLength + strikerRodLength, strikerRadius: strikerRodWidth / 2,
  strikerRodLength, strikerRodWidth, strikerCenterY: strikerCordLength + strikerRodLength / 2,
  paperCordLength: 44, paperWidth: 32, paperHeight: 96,
});

const g = ZEN_FURIN_GEOMETRY;
const rimDrop = g.bellRimY - g.strikerPivotY;
// The rod's visible side reaches the rim: d*sin(a) + radius = halfWidth*cos(a).
// The rod extends below the opening; its tip is not the collision point.
export const ZEN_FURIN_CONTACT_ANGLE = Math.atan2(g.bellInnerHalfWidth, rimDrop)
  - Math.asin(g.strikerRadius / Math.hypot(rimDrop, g.bellInnerHalfWidth));

export function projectZenFurinPose(state) {
  const radians = Math.PI / 180;
  const advance = (origin, length, angle) => ({
    x: origin.x - length * Math.sin(angle * radians),
    y: origin.y + length * Math.cos(angle * radians),
  });
  const support = { x: g.supportX, y: g.supportY };
  const bellTie = advance(support, g.bellTop, state.bell.pos);
  const strikerTie = advance(support, g.strikerPivotY, state.bell.pos);
  const clapper = advance(strikerTie, g.strikerLength, state.striker.pos);
  const paperTie = advance(clapper, g.paperCordLength, state.paper.pos);
  const cosine = Math.cos(state.paper.yaw * radians);
  const scaleX = Math.max(0.04, Math.abs(cosine));
  return {
    support, bellTie, strikerTie, clapper, paperTie,
    bellAngle: state.bell.pos,
    strikerAngle: state.striker.pos - state.bell.pos,
    paperAngle: state.paper.pos - state.striker.pos,
    paperScaleX: scaleX,
    paperFront: cosine >= 0,
  };
}
