import { zenKoiTraitUnit } from '../model/koi/zenKoiPersonality.js';

const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n));
const extent = fish => Math.max(40, fish.baseSize * 4);

const rect = bounds => ({ x: bounds.x ?? 0, y: bounds.y ?? 0, width: bounds.width, height: bounds.height });
const edgePoint = (edge, lane, bounds, outside) => {
  const b = rect(bounds);
  if (edge === 0) return { x: b.x - outside, y: b.y + b.height * lane };
  if (edge === 1) return { x: b.x + b.width + outside, y: b.y + b.height * lane };
  if (edge === 2) return { x: b.x + b.width * lane, y: b.y - outside };
  return { x: b.x + b.width * lane, y: b.y + b.height + outside };
};

export function beginZenKoiRosterExit(fish, bounds) {
  const b = rect(bounds), dx = Math.cos(fish.bodyHeading), dy = Math.sin(fish.bodyHeading);
  const tx = Math.abs(dx) < 1e-6 ? Infinity : ((dx > 0 ? b.x + b.width : b.x) - fish.x) / dx;
  const ty = Math.abs(dy) < 1e-6 ? Infinity : ((dy > 0 ? b.y + b.height : b.y) - fish.y) / dy;
  const horizontal = Math.max(0, tx) < Math.max(0, ty);
  const edge = horizontal ? (dx > 0 ? 1 : 0) : (dy > 0 ? 3 : 2);
  const distance = Math.max(0, horizontal ? tx : ty);
  const lane = horizontal ? (fish.y + dy * distance - b.y) / b.height : (fish.x + dx * distance - b.x) / b.width;
  fish.rosterTransit = { kind: 'exiting', edge, lane: clamp(lane, 0.12, 0.88), complete: false, bounds: {}, heading: fish.bodyHeading };
  fish.visualLifecycleState = 'exiting';
  if (fish.domain) fish.retiringDomain = fish.domain;
  fish.domain = null;
  fish.presenceState = 'retiring';
  fish.labelOpacity = 0;
  fish.opacity = fish.targetOpacity = 1;
  fish.opacityTransition = null;
}

export function beginZenKoiRosterEntry(fish, bounds, { arrivalIdentity = fish.entityId } = {}) {
  const identity = arrivalIdentity;
  const edge = Math.floor(zenKoiTraitUnit(identity, 'arrival-edge') * 4);
  const lane = 0.22 + zenKoiTraitUnit(identity, 'arrival-lane') * 0.56;
  const point = edgePoint(edge, lane, bounds, extent(fish));
  const heading = [0, Math.PI, Math.PI / 2, -Math.PI / 2][edge];
  fish.x = point.x; fish.y = point.y;
  fish.angle = fish.bodyHeading = fish.propulsionDir = fish.targetAngle = fish.steerTargetAngle = fish.aiHeadingFiltered = heading;
  const speed = Math.max(0.05, Math.hypot(fish.velocity.x, fish.velocity.y));
  fish.velocity.x = Math.cos(heading) * speed; fish.velocity.y = Math.sin(heading) * speed;
  fish.history.forEach((p, i) => Object.assign(p, { x: point.x - Math.cos(heading) * i * fish.segmentSpacing,
    y: point.y - Math.sin(heading) * i * fish.segmentSpacing, angle: heading }));
  fish.roamAnchor = { x: point.x, y: point.y };
  fish.rosterTransit = { kind: 'entering', edge, lane, complete: false, bounds: {}, heading };
  fish.visualLifecycleState = 'entering';
  fish.opacity = fish.targetOpacity = 1;
  fish.opacityTransition = null;
}

// No position tween: this supplies a committed destination and an expanded
// movement rectangle to the existing stroke/momentum integrator. The ordinary
// pond wall remains intact for every other fish.
export function resolveZenKoiRosterTransit(fish, bounds) {
  const transit = fish.rosterTransit;
  if (!transit || transit.complete) return null;
  const b = rect(bounds), margin = extent(fish);
  const extension = fish.segmentSpacing * (fish.history.length - 1) + margin * 3;
  const target = transit.kind === 'exiting'
    ? edgePoint(transit.edge, transit.lane, b, extension)
    : edgePoint(transit.edge, transit.lane, b, -Math.min(transit.edge < 2 ? b.width : b.height, extension * 2) * 0.5);
  transit.heading = Math.atan2(target.y - fish.y, target.x - fish.x);
  // Open just the committed bank, with ample offscreen runway. Normal bounds
  // on the other three banks keep this a bounded lifecycle exception.
  Object.assign(transit.bounds, b, { padding: bounds.padding });
  if (transit.edge === 0) { transit.bounds.x -= extension * 2; transit.bounds.width += extension * 2; }
  if (transit.edge === 1) transit.bounds.width += extension * 2;
  if (transit.edge === 2) { transit.bounds.y -= extension * 2; transit.bounds.height += extension * 2; }
  if (transit.edge === 3) transit.bounds.height += extension * 2;
  return transit;
}

export function finishZenKoiRosterTransitStep(fish, bounds) {
  const transit = fish.rosterTransit;
  if (!transit || transit.complete) return;
  const b = rect(bounds), margin = extent(fish);
  if (transit.kind === 'exiting') {
    // Test every joint plus appendage clearance, never just the head position.
    const outside = fish.history.every(p => transit.edge === 0 ? p.x < b.x - margin
      : transit.edge === 1 ? p.x > b.x + b.width + margin
        : transit.edge === 2 ? p.y < b.y - margin : p.y > b.y + b.height + margin);
    if (outside) transit.complete = true;
  } else {
    const inside = fish.history.every(p => p.x > b.x + margin && p.x < b.x + b.width - margin
      && p.y > b.y + margin && p.y < b.y + b.height - margin);
    if (inside) {
      fish.rosterTransit = null;
      fish.visualLifecycleState = 'active';
      fish.zenKoiBehaviorMemory = null;
      fish.zenKoiBehaviorMicroGoal = null;
      fish.roamAnchor = { x: fish.x, y: fish.y };
      fish.roamTimer = 0;
    }
  }
}
