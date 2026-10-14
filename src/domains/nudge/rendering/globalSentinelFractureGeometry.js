const TAU = Math.PI * 2;

function requireSeed(seed) {
  if (!Number.isSafeInteger(seed) || seed < 0 || seed > 0x7fffffff) {
    throw new Error('global_sentinel_fracture_seed_invalid');
  }
}

function requireOrigin(point) {
  if (!Array.isArray(point) || point.length !== 2
    || point.some(value => !Number.isFinite(value) || value < 0 || value > 1)) {
    throw new Error('global_sentinel_fracture_origin_invalid');
  }
}

function unit(seed, index) {
  const value = Math.sin(seed * 0.0191 + index * 12.9898) * 43758.5453;
  return value - Math.floor(value);
}

function directionSector([x, y], seed) {
  // Numerical boundary inputs own their inward sector from the outset. An
  // outward compact node a few ULPs from an edge cannot represent propagation.
  // This plans directions once; it never retries rays or shifts the origin.
  const boundaryPrecision = Number.EPSILON * 64;
  const left = x <= boundaryPrecision, right = 1 - x <= boundaryPrecision;
  const top = y <= boundaryPrecision, bottom = 1 - y <= boundaryPrecision;
  if (left && top) return [0, Math.PI / 2];
  if (right && top) return [Math.PI / 2, Math.PI / 2];
  if (right && bottom) return [Math.PI, Math.PI / 2];
  if (left && bottom) return [-Math.PI / 2, Math.PI / 2];
  if (left) return [-Math.PI / 2, Math.PI];
  if (right) return [Math.PI / 2, Math.PI];
  if (top) return [0, Math.PI];
  if (bottom) return [Math.PI, Math.PI];
  return [unit(seed, 6) * TAU, TAU];
}

export function resolveDirectionDistributedPrimaryCracks({ seed, impactPoint }) {
  requireSeed(seed);
  requireOrigin(impactPoint);
  const [sectorStart, sectorSpan] = directionSector(impactPoint, seed);
  const count = 6 + Math.floor(unit(seed, 7) * 2);
  // One wider stress sector and unevenly placed neighbours avoid an ornamental
  // equal-spoke star. Closed weight/placement ranges keep every full-field gap
  // below 90 degrees while each direction owns a disjoint propagation wedge.
  const openSector = Math.floor(unit(seed, 8) * count);
  const weights = Array.from({ length: count }, (_, index) => index === openSector
    ? 1.3 + unit(seed, index + 10) * 0.1
    : 1 + unit(seed, index + 10) ** 2 * 0.3);
  const totalWeight = weights.reduce((total, weight) => total + weight, 0);
  let cursor = sectorStart;
  return Object.freeze(weights.map((weight, index) => {
    const span = sectorSpan * weight / totalWeight;
    const placement = 0.4 + unit(seed, index + 121) * 0.2;
    const angle = cursor + span * placement;
    cursor += span;
    const dx = Math.cos(angle);
    const dy = Math.sin(angle);
    const [x, y] = impactPoint;
    const reach = Math.min(
      dx > 0 ? (1 - x) / dx : dx < 0 ? -x / dx : Infinity,
      dy > 0 ? (1 - y) / dy : dy < 0 ? -y / dy : Infinity,
    );
    if (!Number.isFinite(reach) || reach <= 0) {
      throw new Error('global_sentinel_fracture_direction_invalid');
    }
    const steps = 5 + Math.floor(unit(seed, index + 31) * 3);
    // Keep the first two aperture nodes at their existing impact scale. Three
    // compact chips provide branch anchors, followed by a few long stress runs.
    const progressNodes = [0.03 + unit(seed, index + 131) * 0.024,
      0.092 + unit(seed, index + 137) * 0.045,
      0.185 + unit(seed, index + 139) * 0.065];
    const lengths = Array.from({ length: steps - 3 }, (_, step) => 0.65 + unit(seed, index * 73 + step + 151) * 1.1);
    const totalLength = lengths.reduce((total, length) => total + length, 0);
    let propagated = 0;
    for (let step = 0; step < lengths.length; step += 1) {
      propagated += lengths[step];
      progressNodes.push(step === lengths.length - 1 ? 1
        : progressNodes[2] + (1 - progressNodes[2]) * propagated / totalLength);
    }
    const stressNode = 3 + Math.floor(unit(seed, index + 191) * (steps - 4));
    const stressPeak = progressNodes[stressNode];
    const stressSide = unit(seed, index + 181) < 0.5 ? -1 : 1;
    const stressOffset = reach * (0.018 + unit(seed, index + 193) * 0.03);
    const nx = -dy;
    const ny = dx;
    const points = [Object.freeze([x, y])];
    for (let step = 1; step <= steps; step += 1) {
      const progress = progressNodes[step - 1];
      const radius = reach * progress;
      const px = x + dx * radius;
      const py = y + dy * radius;
      // Outer spans share one angular stress jog rather than reversing lateral
      // direction at every node. Only the compact impact cluster chips locally.
      const stress = progress <= stressPeak ? progress / stressPeak : (1 - progress) / (1 - stressPeak);
      const impactChip = step <= 3
        ? (unit(seed, index * 43 + step + 61) - 0.5) * reach * (step === 1 ? 0.018 : 0.028) : 0;
      const deflection = stressSide * stressOffset * stress + impactChip;
      // Strictly increasing axial projection prevents a path folding back.
      // Perpendicular deviations stay in this direction's disjoint wedge and
      // inside the viewport; endpoints and the accepted impact never move.
      const sign = Math.sign(deflection);
      const angularRoom = span * (sign > 0 ? 1 - placement : placement);
      const spread = radius * Math.tan(Math.min(angularRoom * 0.74, 0.3));
      const room = Math.min(
        nx * sign > 0 ? (1 - px) / (nx * sign) : nx * sign < 0 ? -px / (nx * sign) : Infinity,
        ny * sign > 0 ? (1 - py) / (ny * sign) : ny * sign < 0 ? -py / (ny * sign) : Infinity,
      );
      const offset = step === steps ? 0 : sign * Math.min(Math.abs(deflection), spread, Math.max(0, room));
      const point = [
        Math.max(0, Math.min(1, px + nx * offset)),
        Math.max(0, Math.min(1, py + ny * offset)),
      ];
      if (Math.hypot(point[0] - points.at(-1)[0], point[1] - points.at(-1)[1]) === 0) {
        throw new Error('global_sentinel_fracture_segment_empty');
      }
      points.push(Object.freeze(point));
    }
    return Object.freeze({ kind: 'primary', points: Object.freeze(points),
      start: 0.07 + unit(seed, index + 211) * 0.14, width: 0.65 + unit(seed, index + 93) * 0.9 });
  }));
}

export function resolveGlobalSentinelImpactBleedContour({
  seed, impactPoint, width, height, damage, scale = 1,
}) {
  requireSeed(seed);
  requireOrigin(impactPoint);
  if (!Number.isFinite(width) || width <= 0 || !Number.isFinite(height) || height <= 0
    || !Number.isFinite(damage) || damage < 0 || damage > 1
    || !Number.isFinite(scale) || scale < 0 || scale > 1) {
    throw new Error('global_sentinel_impact_bleed_geometry_invalid');
  }
  const x = impactPoint[0] * width;
  const y = impactPoint[1] * height;
  const radius = Math.min(width, height) * (0.009 + damage * 0.021) * scale;
  const noiseSeed = seed * 0.0191;
  return Object.freeze(Array.from({ length: 32 }, (_, index) => {
    const angle = index / 32 * TAU;
    const value = Math.sin((noiseSeed + index * 17) * 12.9898 + 78.233) * 43758.5453;
    const reach = radius * (0.6 + (value - Math.floor(value)) * 0.65);
    return Object.freeze([x + Math.cos(angle) * reach * 1.36, y + Math.sin(angle) * reach * 0.72]);
  }));
}
