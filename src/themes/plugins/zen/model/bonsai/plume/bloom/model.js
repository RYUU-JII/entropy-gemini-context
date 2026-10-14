/**
 * A research observation layer over the pinned F4 + rhythm reference.
 * It neither commits new organs nor changes annual fate/resource decisions.
 */
export const CHERRY_BLOOM_MODEL_ID = 'zen_cherry_bloom_v1';
export const CHERRY_BLOOM_VARIANTS = Object.freeze(['detail', 'cluster', 'living']);

const add = (a, b) => a.map((value, index) => value + b[index]);
const subtract = (a, b) => a.map((value, index) => value - b[index]);
const multiply = (a, factor) => a.map(value => value * factor);
const dot = (a, b) => a.reduce((value, component, index) => value + component * b[index], 0);
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const clamp = value => Math.max(0, Math.min(1, value));
const finiteVector = value => Array.isArray(value) && value.length === 3 && value.every(Number.isFinite);
const distance = (a, b) => Math.hypot(...subtract(a, b));

function normalize(vector) {
  if (!finiteVector(vector) || Math.hypot(...vector) < 1e-10) throw new Error('Cherry bloom: invalid direction.');
  return multiply(vector, 1 / Math.hypot(...vector));
}

function frame(normal) {
  const n = normalize(normal);
  // This mathematical axis choice avoids a singular cross product, not missing data.
  const reference = Math.abs(n[1]) > 0.9 ? [1, 0, 0] : [0, 1, 0];
  const u = normalize(cross(n, reference));
  return { normal: n, u, v: normalize(cross(n, u)) };
}

function draw(seed, key) {
  let value = (seed ^ 2166136261) >>> 0;
  for (let index = 0; index < key.length; index += 1) value = Math.imul(value ^ key.charCodeAt(index), 16777619) >>> 0;
  value ^= value >>> 16;
  value = Math.imul(value, 0x7feb352d);
  value ^= value >>> 15;
  value = Math.imul(value, 0x846ca68b);
  return ((value ^ (value >>> 16)) >>> 0) / 4294967296;
}

function requireEntry(map, id, label) {
  if (!map.has(id)) throw new Error(`Cherry bloom: missing ${label} ${id}.`);
  return map.get(id);
}

function indexById(records, label) {
  if (!Array.isArray(records)) throw new Error(`Cherry bloom: missing ${label} collection.`);
  const map = new Map();
  for (const record of records) map.set(record.id, record);
  if (map.size !== records.length) throw new Error(`Cherry bloom: duplicate ${label} IDs.`);
  return map;
}

function requireUniqueIds(records, label) {
  if (!Array.isArray(records)) throw new Error(`Cherry bloom: missing ${label} collection.`);
  const ids = new Set();
  for (const record of records) ids.add(record.id);
  if (ids.size !== records.length) throw new Error(`Cherry bloom: duplicate ${label} IDs.`);
}

function poseFlowers(snapshot, seed, flowerScale, nodes, buds, recordReceipts) {
  const groups = new Map();
  for (const flower of snapshot.flowers) {
    const bud = requireEntry(buds, flower.budId, 'flower bud');
    const support = requireEntry(nodes, flower.nodeId, 'flower support');
    if (bud.identity !== 'floral' || bud.nodeId !== flower.nodeId || support.birthCycle >= snapshot.cycle) {
      throw new Error(`Cherry bloom: flower lacks a prior-year floral support ${flower.id}.`);
    }
    if (!Number.isFinite(flower.radius) || flower.radius <= 0) throw new Error(`Cherry bloom: invalid flower radius ${flower.id}.`);
    if (!groups.has(bud.id)) groups.set(bud.id, []);
    groups.get(bud.id).push(flower);
  }
  const poses = new Map();
  const receipts = recordReceipts ? [] : null;
  for (const [budId, flowers] of groups) {
    const bud = buds.get(budId);
    const support = nodes.get(bud.nodeId);
    const tangentFrame = frame(bud.tangent);
    const sharedPhase = draw(seed, `${bud.unitId}:inflorescence-side`) * Math.PI * 2;
    const phase = sharedPhase + (draw(seed, `${bud.id}:side-jitter`) - 0.5) * 0.9;
    const radial = add(multiply(tangentFrame.u, Math.cos(phase)), multiply(tangentFrame.v, Math.sin(phase)));
    const direction = normalize(add(add(multiply(tangentFrame.normal, 0.22), multiply(radial, 0.82)), [0, 0.24, 0]));
    const clusterFrame = frame(direction);
    const baseRadius = flowers.reduce((sum, flower) => sum + flower.radius, 0) / flowers.length;
    const rotation = draw(seed, `${bud.unitId}:inflorescence-rotation`) * Math.PI * 2
      + draw(seed, `${bud.id}:rotation`) * 0.7;
    const clusterId = `bloom:${budId}`;
    const ordered = [...flowers].sort((a, b) => a.id.localeCompare(b.id));
    ordered.forEach((flower, index) => {
      // A shallow irregular corymb, with a common direction shared loosely by
      // neighboring buds on the same real annual unit. No camera input is used.
      const angle = rotation + index * 2.3999632297;
      const spread = baseRadius * (1.30 + draw(seed, `${flower.id}:spread`) * 0.75);
      const lateral = add(multiply(clusterFrame.u, Math.cos(angle) * spread),
        multiply(clusterFrame.v, Math.sin(angle) * spread * 0.79));
      const reach = baseRadius * (1.40 + draw(seed, `${flower.id}:reach`) * 1.1);
      const offset = add(add(multiply(direction, reach), lateral),
        [0, -baseRadius * (0.15 + draw(seed, `${flower.id}:droop`) * 0.4), 0]);
      const position = add(support.p, offset);
      const normal = normalize(add(add(multiply(direction, 0.78),
        multiply(normalize(lateral), 0.68 + draw(seed, `${flower.id}:tilt`) * 0.35)),
      [0, -0.08 + draw(seed, `${flower.id}:lift`) * 0.16, 0]));
      const flowerFrame = frame(normal);
      const roll = draw(seed, `${flower.id}:roll`) * Math.PI * 2;
      const u = add(multiply(flowerFrame.u, Math.cos(roll)), multiply(flowerFrame.v, Math.sin(roll)));
      const v = normalize(cross(flowerFrame.normal, u));
      poses.set(flower.id, { ...flower, position, radius: flower.radius * flowerScale,
        normal: flowerFrame.normal, u, v, clusterId, supportBudId: bud.id, supportNodeId: support.id,
        pedicel: { start: [...support.p], end: [...position] }, pedicelLength: Math.hypot(...offset),
        opening: 0.80 + draw(seed, `${bud.unitId}:opening`) * 0.14 + draw(seed, `${flower.id}:opening`) * 0.06,
        cup: 0.08 + draw(seed, `${flower.id}:cup`) * 0.09,
        referenceRadius: flower.radius, referencePosition: [...flower.position],
      });
    });
    if (receipts) receipts.push({ clusterId, supportBudId: bud.id, supportNodeId: support.id,
      unitId: bud.unitId, familyId: bud.familyId, flowerIds: ordered.map(flower => flower.id),
      direction, meanReferenceRadius: baseRadius });
  }
  snapshot.flowers = snapshot.flowers.map(flower => poses.get(flower.id));
  return receipts;
}

function stageShoots(snapshot, seed, stage, nodes, buds, recordReceipts) {
  const units = snapshot.annualUnits.filter(unit => unit.cycle === snapshot.cycle);
  const segmentByChild = new Map(snapshot.segments.map(segment => [segment.childNodeId, segment]));
  const exposed = new Set(snapshot.nodes.filter(node => node.birthCycle !== snapshot.cycle).map(node => node.id));
  const visibleSegments = new Set(snapshot.segments.filter(segment => segment.birthCycle !== snapshot.cycle).map(segment => segment.id));
  const posedNodes = new Map();
  const exposedBudNodes = new Set(exposed);
  const tips = [];
  const receipts = recordReceipts ? [] : null;
  for (const unit of units) {
    const sourceBud = requireEntry(buds, unit.sourceBudId, 'shoot source bud');
    const support = requireEntry(nodes, unit.originNodeId, 'shoot origin');
    if (sourceBud.nodeId !== support.id || sourceBud.identity !== 'vegetative' || support.birthCycle >= snapshot.cycle) {
      throw new Error(`Cherry bloom: shoot does not originate on established wood ${unit.id}.`);
    }
    if (!['short', 'long'].includes(unit.kind) || unit.nodeIds.length === 0) throw new Error(`Cherry bloom: invalid shoot plan ${unit.id}.`);
    // Uncalibrated visual phenology: long shoots start later and develop more
    // slowly; individual prior-year buds have stable onset differences.
    const onset = (unit.kind === 'long' ? 0.18 : 0.04) + draw(seed, `${unit.id}:onset`) * (unit.kind === 'long' ? 0.30 : 0.26);
    const exponent = (unit.kind === 'long' ? 1.22 : 0.80) + draw(seed, `${unit.id}:pace`) * 0.55;
    const progress = stage === 1 ? 1 : Math.pow(clamp((stage - onset) / (1 - onset)), exponent);
    const plan = [];
    let parent = support;
    for (const nodeId of unit.nodeIds) {
      const child = requireEntry(nodes, nodeId, 'planned shoot node');
      const segment = requireEntry(segmentByChild, nodeId, 'planned shoot segment');
      if (segment.parentNodeId !== parent.id || segment.unitId !== unit.id || segment.birthCycle !== snapshot.cycle) {
        throw new Error(`Cherry bloom: discontinuous current-year shoot ${unit.id}.`);
      }
      const length = distance(parent.p, child.p);
      if (!Number.isFinite(length) || length <= 0) throw new Error(`Cherry bloom: degenerate shoot segment ${segment.id}.`);
      plan.push({ parent, child, segment, length });
      parent = child;
    }
    const plannedLength = plan.reduce((total, item) => total + item.length, 0);
    let remaining = progress * plannedLength;
    let tipPosition = [...support.p];
    let tipNodeId = support.id;
    let tipDirection = normalize(subtract(plan[0].child.p, support.p));
    let partialNodeId = null;
    const visibleNodeIds = recordReceipts ? [] : null;
    const visibleSegmentIds = recordReceipts ? [] : null;
    for (const item of plan) {
      if (remaining <= 0) break;
      const fraction = progress === 1 ? 1 : Math.min(1, remaining / item.length);
      exposed.add(item.child.id);
      visibleSegments.add(item.segment.id);
      if (recordReceipts) {
        visibleNodeIds.push(item.child.id);
        visibleSegmentIds.push(item.segment.id);
      }
      tipNodeId = item.child.id;
      tipDirection = normalize(subtract(item.child.p, item.parent.p));
      if (fraction === 1) {
        exposedBudNodes.add(item.child.id);
        tipPosition = [...item.child.p];
      } else {
        tipPosition = add(item.parent.p, multiply(subtract(item.child.p, item.parent.p), fraction));
        posedNodes.set(item.child.id, { ...item.child, p: tipPosition,
          bloomEmergence: { fraction, plannedPosition: [...item.child.p], unitId: unit.id } });
        partialNodeId = item.child.id;
      }
      remaining -= item.length;
    }
    if (receipts) receipts.push({ unitId: unit.id, sourceBudId: sourceBud.id, familyId: unit.familyId,
      kind: unit.kind, stage, onset, exponent, progress, plannedLength, visibleLength: plannedLength * progress,
      plannedNodeIds: [...unit.nodeIds], visibleNodeIds, visibleSegmentIds, partialNodeId });
    tips.push({ id: `living:${unit.id}`, p: tipPosition, direction: tipDirection, nodeId: tipNodeId,
      sourceBudId: sourceBud.id, unitId: unit.id, familyId: unit.familyId, kind: unit.kind,
      progress, radius: plan[plan.length - 1].segment.radius,
      state: progress === 0 ? 'closed' : progress === 1 ? 'extended' : 'extending' });
  }
  snapshot.nodes = snapshot.nodes.filter(node => exposed.has(node.id)).map(node => posedNodes.has(node.id) ? posedNodes.get(node.id) : node);
  snapshot.segments = snapshot.segments.filter(segment => visibleSegments.has(segment.id));
  snapshot.buds = snapshot.buds.filter(bud => exposedBudNodes.has(bud.nodeId));
  snapshot.livingTips = tips;
  return receipts;
}

/**
 * Clone and pose a completed reference snapshot. Flower-scale affects radii
 * only; flower placement is independently fixed by the inflorescence policy.
 * `stage` is within-spring shoot observation progress, never an annual age.
 */
export function createZenCherryBloomSnapshot(referenceSnapshot, { seed, variant = 'living', flowerScale = 4, stage = 0.45 }) {
  return poseBloomSnapshot(referenceSnapshot, seed, variant, flowerScale, stage, true);
}

// The generated spring camera consumes posed organs only. Keep the same clone,
// validation, keyed draws and geometry body without building discarded audits.
export function createZenGeneratedCherryBloomCameraSnapshot(referenceSnapshot, { seed }) {
  if (referenceSnapshot?.phase !== 'spring') throw new Error('ZEN_CHERRY_BLOOM_CAMERA_SPRING');
  return poseBloomSnapshot(referenceSnapshot, seed, 'living', 4, 1, false);
}

function poseBloomSnapshot(referenceSnapshot, seed, variant, flowerScale, stage, recordReceipts) {
  if (!Number.isInteger(seed) || seed < 1 || seed > 0xffffffff) throw new Error('Cherry bloom: seed must be a positive uint32.');
  if (!CHERRY_BLOOM_VARIANTS.includes(variant)) throw new Error(`Cherry bloom: unknown variant ${variant}.`);
  if (!Number.isFinite(flowerScale) || flowerScale < 1 || flowerScale > 5) throw new Error('Cherry bloom: flowerScale must be in [1, 5].');
  if (!Number.isFinite(stage) || stage < 0 || stage > 1) throw new Error('Cherry bloom: stage must be in [0, 1].');
  if (!referenceSnapshot || !Number.isInteger(referenceSnapshot.cycle) || referenceSnapshot.cycle < 1
    || !['spring', 'summer', 'winter'].includes(referenceSnapshot.phase)) throw new Error('Cherry bloom: invalid reference snapshot.');
  const snapshot = structuredClone(referenceSnapshot);
  const nodes = indexById(snapshot.nodes, 'node');
  const buds = indexById(snapshot.buds, 'bud');
  for (const node of nodes.values()) if (!finiteVector(node.p)) throw new Error(`Cherry bloom: invalid node position ${node.id}.`);
  requireUniqueIds(snapshot.segments, 'segment');
  requireUniqueIds(snapshot.annualUnits, 'annual unit');
  requireUniqueIds(snapshot.flowers, 'flower');
  const active = snapshot.phase === 'spring';
  const clusterReceipts = active && variant !== 'detail' ? poseFlowers(snapshot, seed, flowerScale, nodes, buds, recordReceipts) : [];
  snapshot.livingTips = [];
  const shootReceipts = active && variant === 'living' ? stageShoots(snapshot, seed, stage, nodes, buds, recordReceipts) : [];
  if (recordReceipts) snapshot.bloom = {
    modelId: CHERRY_BLOOM_MODEL_ID, referenceSnapshotId: referenceSnapshot.id,
    variant, seed, active, flowerScale: variant === 'detail' || !active ? 1 : flowerScale,
    requestedFlowerScale: flowerScale, stage: variant === 'living' && active ? stage : 1,
    requestedStage: stage,
    planSemantics: 'axes, annualUnits, events, ledger and metrics retain the completed reference plan; nodes, segments and buds are visible observation geometry. bloom.shootReceipts identifies emergence without new organ commitments.',
    policySemantics: 'Uncalibrated world-space inflorescence and within-spring shoot observation priors. No camera-dependent anatomy or biological fate changes.',
    referenceCounts: { nodes: referenceSnapshot.nodes.length, segments: referenceSnapshot.segments.length,
      buds: referenceSnapshot.buds.length, flowers: referenceSnapshot.flowers.length },
    visibleCounts: { nodes: snapshot.nodes.length, segments: snapshot.segments.length,
      buds: snapshot.buds.length, flowers: snapshot.flowers.length },
    clusterReceipts, shootReceipts,
  };
  return snapshot;
}
