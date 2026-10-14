import { CHERRY_CLOUD_MODEL_ID, CHERRY_CLOUD_PROFILE as P } from './profile.js';
import { copyZenGeneratedRhythmObservation } from './zenGeneratedRhythmObservationCopy.js';

const add = (a, b) => a.map((v, i) => v + b[i]);
const sub = (a, b) => a.map((v, i) => v - b[i]);
const mul = (a, k) => a.map(v => v * k);
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const distance = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
const finite = a => Array.isArray(a) && a.length === 3 && a.every(Number.isFinite);
const unit = a => { const n = Math.hypot(...a); if (!finite(a) || n < 1e-10) throw Error('ZEN_CHERRY_CLOUD_DIRECTION'); return mul(a, 1 / n); };
const round = n => Math.round(n * 1e9) / 1e9;
const order = (a, b) => a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
const get = (map, key) => { if (!map.has(key)) throw Error(`ZEN_CHERRY_CLOUD_MISSING:${key}`); return map.get(key); };

function draw(seed, key) {
  let n = (seed ^ 2166136261) >>> 0;
  for (let i = 0; i < key.length; i += 1) n = Math.imul(n ^ key.charCodeAt(i), 16777619) >>> 0;
  n ^= n >>> 16; n = Math.imul(n, 0x7feb352d); n ^= n >>> 15; n = Math.imul(n, 0x846ca68b);
  return ((n ^ (n >>> 16)) >>> 0) / 4294967296;
}

function radial(tangent, angle) {
  const u = unit(cross(tangent, Math.abs(tangent[1]) > 0.9 ? [1, 0, 0] : [0, 1, 0]));
  return add(mul(u, Math.cos(angle)), mul(unit(cross(tangent, u)), Math.sin(angle)));
}

function pointSegmentDistance(p, a, b) {
  const dx = b[0] - a[0], dy = b[1] - a[1], dz = b[2] - a[2];
  const denominator = dx * dx + dy * dy + dz * dz;
  if (denominator < 1e-16) throw Error('ZEN_CHERRY_CLOUD_ZERO_SOURCE_SEGMENT');
  const t = Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy + (p[2] - a[2]) * dz) / denominator));
  return Math.hypot(p[0] - (a[0] + dx * t), p[1] - (a[1] + dy * t), p[2] - (a[2] + dz * t));
}

function woodBlocksPoint(p, wood, scale) {
  const { a, b } = wood;
  const dx = b[0] - a[0], dy = b[1] - a[1], dz = b[2] - a[2];
  const denominator = dx * dx + dy * dy + dz * dz;
  if (denominator < 1e-16) throw Error('ZEN_CHERRY_CLOUD_ZERO_SOURCE_SEGMENT');
  const t = Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy + (p[2] - a[2]) * dz) / denominator));
  // Evaluate all three residuals in the original order before reading radius.
  // Their absolute values bound the norm from below; distant points cannot
  // satisfy the strict clearance test and need no full norm calculation.
  const x = p[0] - (a[0] + dx * t), y = p[1] - (a[1] + dy * t), z = p[2] - (a[2] + dz * t);
  const threshold = wood.segment.radius + scale * 1.2;
  if (Math.abs(x) >= threshold || Math.abs(y) >= threshold || Math.abs(z) >= threshold) return false;
  return Math.hypot(x, y, z) < threshold;
}

// Direct generated observations contain validated plain geometry. Each annual
// append-only wood row owns its invariant arithmetic; the public path below
// keeps lazy coordinate/radius reads and its original exception order.
function prepareGeneratedWood(segment, a, b, scale) {
  if (!finite(a) || !finite(b) || !Number.isFinite(segment.radius) || segment.radius <= 0) {
    throw Error('ZEN_CHERRY_CLOUD_GENERATED_WOOD_INPUT');
  }
  const dx = b[0] - a[0], dy = b[1] - a[1], dz = b[2] - a[2];
  const denominator = dx * dx + dy * dy + dz * dz;
  const threshold = segment.radius + scale * 1.2;
  if (!Number.isFinite(denominator) || !Number.isFinite(threshold)) throw Error('ZEN_CHERRY_CLOUD_GENERATED_WOOD_INPUT');
  // Use the actual a + delta endpoint, including its rounding. Monotonic
  // multiply/add bounds a + delta*t for clamped t. Outward error room also
  // covers subtraction and bound rounding; uncertain boundary pairs stay in
  // the original narrow phase rather than changing its strict comparison.
  const lower = [], upper = [];
  for (const [index, delta] of [dx, dy, dz].entries()) {
    const end = a[index] + delta;
    const room = Math.max(1, Math.abs(a[index]), Math.abs(end), threshold) * Number.EPSILON * 8;
    lower.push(Math.min(a[index], end) - threshold - room);
    upper.push(Math.max(a[index], end) + threshold + room);
  }
  return { segment, a, b, dx, dy, dz, denominator, threshold, lower, upper };
}

function generatedWoodBlocksPoint(p, wood) {
  const { a, dx, dy, dz, denominator, threshold, lower, upper } = wood;
  // Degenerate searched wood must still fail before broad-phase rejection.
  if (denominator < 1e-16) throw Error('ZEN_CHERRY_CLOUD_ZERO_SOURCE_SEGMENT');
  if (p[0] < lower[0] || p[0] > upper[0] || p[1] < lower[1] || p[1] > upper[1]
    || p[2] < lower[2] || p[2] > upper[2]) return false;
  const t = Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy + (p[2] - a[2]) * dz) / denominator));
  const x = p[0] - (a[0] + dx * t), y = p[1] - (a[1] + dy * t), z = p[2] - (a[2] + dz * t);
  if (Math.abs(x) >= threshold || Math.abs(y) >= threshold || Math.abs(z) >= threshold) return false;
  return Math.hypot(x, y, z) < threshold;
}

const publicWoodOwner = Object.freeze({
  prepare: (segment, a, b) => ({ segment, a, b }), blocksPoint: woodBlocksPoint,
});
const generatedWoodOwner = Object.freeze({ prepare: prepareGeneratedWood, blocksPoint: generatedWoodBlocksPoint });

// Only this factory's unique plain records enter here. Source observations stay
// native clones. Retained fields share one native clone per collection, so
// nested aliases, opaque scaffold values and clone failures keep their boundary.
function cloneCloudRecords(records) {
  const copies = [], retained = [];
  let hasRetained = false;
  for (const record of records) {
    const copy = { ...record }, mutable = Object.create(null);
    for (const key of Reflect.ownKeys(copy)) {
      if (typeof key === 'symbol') { delete copy[key]; continue; }
      const value = copy[key];
      if (value !== null && (typeof value === 'object' || typeof value === 'function' || typeof value === 'symbol')) {
        mutable[key] = value;
        copy[key] = null;
        hasRetained = true;
      }
    }
    copies.push(copy); retained.push(mutable);
  }
  if (hasRetained) {
    const cloned = structuredClone(retained);
    for (let i = 0; i < copies.length; i += 1) Object.assign(copies[i], cloned[i]);
  }
  return copies;
}

function validate(reference, seed) {
  if (!Number.isInteger(seed) || seed < 1 || seed > 0xffffffff || reference?.seed !== seed) throw Error('ZEN_CHERRY_CLOUD_SEED');
  if (!reference.scaffold || !Array.isArray(reference.snapshots) || reference.snapshots.length === 0
    || !Number.isFinite(reference.profile?.worldScale) || reference.profile.worldScale <= 0) throw Error('ZEN_CHERRY_CLOUD_REFERENCE');
  const phases = ['spring', 'summer', 'winter'];
  reference.snapshots.forEach((s, i) => {
    if (s.cycle !== Math.floor(i / 3) + 1 || s.phase !== phases[i % 3]) throw Error('ZEN_CHERRY_CLOUD_REFERENCE_CLOCK');
    for (const key of ['nodes', 'segments', 'axes', 'annualUnits', 'buds', 'flowers', 'events', 'attachments']) {
      if (!Array.isArray(s[key])) throw Error(`ZEN_CHERRY_CLOUD_COLLECTION:${key}`);
    }
  });
}

/**
 * Add an explicit initialized bud population to fixed F4 internal nodes, then
 * advance only that population. Source records are immutable inputs, including
 * their ledgers and metrics; cloud records/receipts own the added development.
 */
export function createZenCherryCloudModel(reference, { seed }) {
  return developCloudModel(reference, seed, publicObservationOwner, publicWoodOwner);
}

// Only the Worker-owned Species assembly supplies a direct generated reference.
// Public callers retain their native source clone and arbitrary-data contract.
export function createZenGeneratedCherryCloudModel(reference, { seed }) {
  return developCloudModel(reference, seed, generatedObservationOwner, generatedWoodOwner);
}

// Only generated product preparation selects this output owner. Complete
// public/generated Cloud models retain their independent audit clone graphs.
export function createZenGeneratedCherryCloudPreparation(reference, { seed }) {
  return developCloudModel(reference, seed, preparationObservationOwner, generatedWoodOwner);
}

// Resolve the native function at the original observation copy point, including
// when an injected public observer has changed the source before that phase.
const copyPublicCloudObservation = source => structuredClone(source);

function copyPreparationObservation(source) {
  const snapshot = copyZenGeneratedRhythmObservation({
    id: source.id, cycle: source.cycle, phase: source.phase,
    nodes: source.nodes, segments: source.segments, annualUnits: source.annualUnits,
    buds: source.buds, flowers: source.flowers, attachments: source.attachments,
  });
  // Axes are read only by the complete Cloud ID validator and are discarded
  // by ProductStudy. Own the collection before appending Cloud axes, while
  // retaining the already validated source rows for this preparation only.
  snapshot.axes = source.axes.slice();
  return snapshot;
}

function appendAttachments(snapshot, modules) {
  snapshot.attachments.push(...modules.map(m => ({ familyId: m.id, nodeId: m.anchorNodeId, moduleId: m.id })));
}

function finishFullObservation(snapshot, state) {
  const { modules, nodes, segments, axes, units, buds, flowers, ledgers, events, cycle, phase } = state;
  const phaseEvents = events.filter(e => e.cycle === cycle && e.phase === phase);
  snapshot.events.push(...cloneCloudRecords(phaseEvents));
  appendAttachments(snapshot, modules);
  snapshot.cloud = { modelId: CHERRY_CLOUD_MODEL_ID, sourceSnapshotId: state.source.id,
    ledgerSemantics: 'Reference ledger/metrics/ledgers/familyMetrics remain unchanged. Added population is accounted separately here.',
    counts: { modules: modules.length, nodes: nodes.size, segments: segments.length, axes: axes.size,
      annualUnits: units.size, buds: buds.size, flowers: flowers.length },
    ledgers: cloneCloudRecords(ledgers), initializationReceipts: cloneCloudRecords(events.filter(e => e.cycle === 0)),
    phaseEvents: cloneCloudRecords(phaseEvents) };
}

function finishPreparationObservation(snapshot, { modules, ledgers }) {
  appendAttachments(snapshot, modules);
  // These ledgers remain complete independent observations for inspectCloud.
  // No source events/audits or duplicate receipt graphs enter this staging view.
  snapshot.cloud = { ledgers: cloneCloudRecords(ledgers) };
}

const cloudPolicy = scale => ({ ...P, worldScale: scale,
  referenceSemantics: 'Exact source organs by ID preserved at each matching cycle/phase; added initialized support population is an explicit hypothesis.' });
function finishFullCloud({ seed, snapshots, modules, events, scale }) {
  return { schema: CHERRY_CLOUD_MODEL_ID, seed, snapshots, modules: cloneCloudRecords(modules),
    events: cloneCloudRecords(events), policy: cloudPolicy(scale) };
}
function finishPreparationCloud({ seed, snapshots, scale }) {
  return { schema: CHERRY_CLOUD_MODEL_ID, seed, snapshots, policy: cloudPolicy(scale) };
}
// Fixed internal owners; no caller-supplied copy policy, flag or ambient cache.
const publicObservationOwner = Object.freeze({
  copy: copyPublicCloudObservation, finishObservation: finishFullObservation, finishCloud: finishFullCloud,
});
const generatedObservationOwner = Object.freeze({
  copy: copyZenGeneratedRhythmObservation, finishObservation: finishFullObservation, finishCloud: finishFullCloud,
});
const preparationObservationOwner = Object.freeze({
  copy: copyPreparationObservation, finishObservation: finishPreparationObservation, finishCloud: finishPreparationCloud,
});

function developCloudModel(reference, seed, observationOwner, woodOwner) {
  validate(reference, seed);
  const scale = reference.profile.worldScale;
  const scaffold = reference.scaffold;
  const fixedNodes = new Map(scaffold.nodes.map(n => [n.id, n]));
  const incoming = new Map(scaffold.segments.map(s => [s.childNodeId, s]));
  const outgoing = new Map(scaffold.nodes.map(n => [n.id, []]));
  for (const segment of scaffold.segments) get(outgoing, segment.parentNodeId).push(segment);
  const rootSegments = get(outgoing, 'origin');
  if (rootSegments.length !== 1) throw Error('ZEN_CHERRY_CLOUD_ROOT');
  const mainAxisId = rootSegments[0].axisId;
  const nodes = new Map(), axes = new Map(), buds = new Map(), units = new Map();
  const segments = [], modules = [], events = [], snapshots = [];
  let cycle = 0, phase = 'initialization', flowers = [];
  const event = (type, subjectId, data = {}) => {
    const value = { id: `cloud:${cycle}:${phase}:${type}:${subjectId}`, type, cycle, phase,
      owner: cycle === 0 ? 'cloud-initialized' : 'cloud-grown', ...data };
    events.push(value); return value;
  };
  // Only already-existing wood participates in initialization. Future reference
  // shoots are not consulted, so shorter simulations have identical prefixes.
  const established = reference.snapshots[0];
  const establishedNodes = new Map(established.nodes.map(n => [n.id, n]));
  const initialWood = established.segments.filter(s => s.birthCycle === null || s.birthCycle === 0);
  const candidates = scaffold.nodes.filter(n => n.id !== 'origin').map(node => {
    const support = get(incoming, node.id), radius = support.endRadius / scale;
    const eligible = support.axisId !== mainAxisId && get(outgoing, node.id).length === 1
      && radius >= P.minSupportRadius && radius <= P.maxSupportRadius
      && (node.p[1] - scaffold.bounds.min[1]) / scaffold.bounds.height >= P.minHeightFraction;
    return { id: node.id, node, support, radius, eligible, priority: draw(seed, `${node.id}:admission`) };
  }).sort((a, b) => a.priority - b.priority || order(a, b));

  for (const candidate of candidates) {
    const { node, support, radius } = candidate;
    if (!candidate.eligible) continue;
    const tangent = unit(sub(node.p, get(fixedNodes, support.parentNodeId).p));
    const angle = draw(seed, `${node.id}:side`) * Math.PI * 2;
    const direction = unit(add(add(mul(tangent, 0.42), mul(radial(tangent, angle), 0.83)), [0, 0.18, 0]));
    const center = add(node.p, mul(direction, P.reservationReach * scale));
    const reservationRadius = P.reservationRadius * scale * (0.86 + draw(seed, `${node.id}:volume`) * 0.28);
    const neighbor = modules.find(m => distance(m.reservationCenter, center)
      < (m.reservationRadius + reservationRadius) * P.reservationSeparation);
    // Keeping the volume out of unrelated mature wood protects the open trunk
    // corridors. Local supporting wood is excluded, never displaced.
    const blocker = initialWood.find(s => s.axisId !== support.axisId
      && s.parentNodeId !== node.id && s.childNodeId !== node.id
      && pointSegmentDistance(center, get(establishedNodes, s.parentNodeId).p,
        get(establishedNodes, s.childNodeId).p) < reservationRadius * 0.62 + s.radius);
    if (neighbor || blocker) {
      event('support-suppressed', node.id, { nodeId: node.id, axisId: support.axisId,
        reason: neighbor ? 'reserved-neighbor-volume' : 'established-wood-clearance',
        blockerId: neighbor ? neighbor.id : blocker.id, reservationCenter: center, reservationRadius });
      continue;
    }
    const id = `cloud:${node.id}`, budId = `${id}/support-bud`, axisId = `${id}/carrier`;
    const module = { id, familyId: id, anchorNodeId: node.id, anchorAxisId: support.axisId,
      supportBudId: budId, rootAxisId: axisId, supportRadius: support.endRadius,
      direction, reservationCenter: center, reservationRadius, bornCycle: 0,
      initialization: 'hypothesized-lateral-bud-on-inert-F4-internal-node',
      allowance: round(P.annualAllowanceBase + radius * P.annualAllowancePerRadius) };
    modules.push(module);
    axes.set(axisId, { id: axisId, owner: 'cloud-initialized', familyId: id, moduleId: id,
      parentBudId: budId, parentAxisId: support.axisId, attachmentNodeId: node.id,
      attachmentKind: 'initialized-F4-lateral', kind: 'long', role: 'cloud-carrier', birthCycle: 0,
      branchOrder: 0, direction, unitIds: [], terminalBudId: budId, status: 'alive' });
    buds.set(budId, { id: budId, owner: 'cloud-initialized', familyId: id, moduleId: id,
      nodeId: node.id, axisId, unitId: null, nodeIndex: 0, annualPosition: 0,
      placement: 'lateral', tangent, identity: 'vegetative', dormancy: 'released', viability: 'alive',
      development: 'uncommitted', bornCycle: 0, winterReleaseCycle: 0,
      inductionCycle: null, bloomCycle: null, activatedCycle: null,
      decisionCycles: [], lastDecisionCycle: null, initialization: module.initialization });
    event('support-initialized', id, { moduleId: id, budId, nodeId: node.id, axisId,
      supportRadius: support.endRadius, reservationCenter: center, reservationRadius,
      releaseSemantics: 'initial admitted bud state; no historical F4 winter or botanical bud is inferred' });
  }

  function nodeFor(id) { return nodes.has(id) ? nodes.get(id) : get(fixedNodes, id); }
  function makeBud(annualUnit, node, index, tangent) {
    const terminal = index === annualUnit.nodeCount;
    const id = `${annualUnit.id}/b${index}${terminal ? 't' : 'l'}`;
    const value = { id, owner: 'cloud-grown', moduleId: annualUnit.moduleId, familyId: annualUnit.familyId,
      nodeId: node.id, axisId: annualUnit.axisId, unitId: annualUnit.id, nodeIndex: index,
      annualPosition: index / annualUnit.nodeCount, placement: terminal ? 'terminal' : 'lateral', tangent,
      identity: 'vegetative', dormancy: 'resting', viability: 'alive', development: 'uncommitted',
      bornCycle: cycle, winterReleaseCycle: null, inductionCycle: null, bloomCycle: null,
      activatedCycle: null, decisionCycles: [], lastDecisionCycle: null };
    buds.set(id, value); return value;
  }

  function proposal(bud, module) {
    const axis = get(axes, bud.axisId), initial = bud.id === module.supportBudId;
    const continuation = !initial && bud.placement === 'terminal';
    const axisId = initial || continuation ? axis.id : `${bud.id}/axis`;
    const id = `${axisId}/y${cycle}`;
    const kind = initial || (continuation && axis.role === 'cloud-carrier' && draw(seed, `${id}:extension`) < 0.55) ? 'long' : 'short';
    const nominal = initial ? P.initialLength : kind === 'long' ? P.extensionLength : P.shortLength;
    const length = nominal * scale * (0.78 + draw(seed, `${id}:length`) * 0.44);
    const nodeCount = initial ? 5 : kind === 'long' ? 4 : 3;
    const angle = bud.nodeIndex * 2.3999632297 + draw(seed, `${axis.id}:azimuth`) * Math.PI * 2;
    let direction = initial ? module.direction : continuation ? axis.direction
      : unit(add(add(mul(bud.tangent, 0.38), mul(radial(bud.tangent, angle), 0.86)), [0, 0.12, 0]));
    const bendDirection = radial(direction, draw(seed, `${axisId}:bend`) * Math.PI * 2);
    const bend = (0.07 + draw(seed, `${axisId}:curvature`) * 0.12) * (kind === 'short' ? 0.75 : 1);
    let parent = nodeFor(bud.nodeId);
    const plannedNodes = [], plannedSegments = [];
    for (let index = 1; index <= nodeCount; index += 1) {
      direction = unit(add(add(direction, mul(bendDirection, bend)), [0, 0.012, 0]));
      const node = { id: `${id}/n${index}`, p: add(parent.p, mul(direction, length / nodeCount)).map(round),
        birthCycle: cycle, owner: 'cloud-grown', moduleId: module.id, familyId: module.id, tangent: [...direction] };
      const startRadius = scale * (initial ? 0.78 : kind === 'long' ? 0.50 : 0.34) * (1 - (index - 1) / nodeCount * 0.42);
      const endRadius = scale * (initial ? 0.78 : kind === 'long' ? 0.50 : 0.34) * (1 - index / nodeCount * 0.42);
      plannedNodes.push(node);
      plannedSegments.push({ id: `${id}/s${index}`, parentNodeId: parent.id, childNodeId: node.id,
        axisId, unitId: id, kind, radius: (startRadius + endRadius) / 2, startRadius, endRadius,
        birthCycle: cycle, owner: 'cloud-grown', familyId: module.id, moduleId: module.id });
      parent = node;
    }
    return { id, axisId, initial, continuation, kind, length, nodeCount, direction,
      cost: round(length / scale * 0.12 + nodeCount * 0.6 + 1.6), plannedNodes, plannedSegments };
  }

  function clearance(plan, bud, module, wood) {
    const origin = nodeFor(bud.nodeId).p;
    for (const node of plan.plannedNodes) {
      // A bounded local volume surrounds the reserved center;
      // never a screen silhouette or a request for a prescribed number of flowers.
      if (distance(node.p, module.reservationCenter) > module.reservationRadius * 2.05) return 'module-volume';
      for (const other of modules) {
        if (other.id !== module.id && distance(node.p, other.reservationCenter) < other.reservationRadius * 0.48) return 'neighbor-volume';
      }
      if (distance(node.p, origin) < scale * 5) continue;
      for (const entry of wood) {
        const { segment } = entry;
        if (segment.moduleId === module.id || segment.parentNodeId === bud.nodeId || segment.childNodeId === bud.nodeId) continue;
        if (woodOwner.blocksPoint(node.p, entry, scale)) return 'wood-clearance';
      }
    }
    return null;
  }

  function grow(sourceSnapshot, ledgers) {
    // One annual pass owns an append-only wood view. Rebuilding the complete
    // node map and concatenating every segment for every candidate/point was
    // redundant; newly accepted wood must still obstruct the very next bud.
    const allNodes = new Map([...sourceSnapshot.nodes.map(n => [n.id, n]), ...nodes]);
    const readWood = segment => woodOwner.prepare(segment,
      get(allNodes, segment.parentNodeId).p, get(allNodes, segment.childNodeId).p, scale);
    const wood = [...sourceSnapshot.segments, ...segments].map(readWood);
    const eligible = [...buds.values()].filter(b => b.identity === 'vegetative' && b.viability === 'alive'
      && b.dormancy === 'released' && b.bornCycle < cycle)
      .sort((a, b) => (a.placement === 'terminal' ? 0 : 1) - (b.placement === 'terminal' ? 0 : 1) || order(a, b));
    for (const bud of eligible) {
      const module = modules.find(m => m.id === bud.moduleId), ledger = ledgers.find(l => l.moduleId === module.id);
      bud.decisionCycles.push(cycle); bud.lastDecisionCycle = cycle;
      const axis = get(axes, bud.axisId), initial = bud.id === module.supportBudId;
      const requested = initial || bud.placement === 'terminal'
        || (get(units, bud.unitId).kind === 'long' && axis.branchOrder < 2
          && draw(seed, `${bud.id}:activate:${cycle}`) < P.lateralActivationProbability);
      if (!requested) {
        bud.dormancy = 'quiescent';
        event('bud-deferred', bud.id, { budId: bud.id, moduleId: module.id, reason: 'quiescent-lateral' });
        continue;
      }
      const plan = proposal(bud, module);
      const reason = plan.cost > ledger.remaining ? 'construction-budget' : clearance(plan, bud, module, wood);
      if (reason) {
        bud.dormancy = 'quiescent'; ledger.deferredBudIds.push(bud.id);
        event('shoot-suppressed', bud.id, { budId: bud.id, moduleId: module.id, reason, proposedCost: plan.cost });
        continue;
      }
      let targetAxis = axis;
      if (!plan.initial && !plan.continuation) {
        targetAxis = { id: plan.axisId, owner: 'cloud-grown', moduleId: module.id, familyId: module.id,
          parentBudId: bud.id, parentAxisId: axis.id, kind: plan.kind, role: 'cloud-lateral',
          birthCycle: cycle, branchOrder: axis.branchOrder + 1, direction: plan.direction,
          unitIds: [], terminalBudId: null, status: 'alive' };
        axes.set(targetAxis.id, targetAxis);
      }
      const annualUnit = { id: plan.id, owner: 'cloud-grown', moduleId: module.id, familyId: module.id,
        axisId: targetAxis.id, cycle, kind: plan.kind, sourceBudId: bud.id, originNodeId: bud.nodeId,
        nodeIds: plan.plannedNodes.map(n => n.id), nodeCount: plan.nodeCount, length: plan.length,
        preformedNodes: plan.nodeCount, neoformedNodes: 0, state: 'elongated', constructionCost: plan.cost };
      units.set(annualUnit.id, annualUnit);
      for (const [i, node] of plan.plannedNodes.entries()) {
        nodes.set(node.id, node); allNodes.set(node.id, node);
        makeBud(annualUnit, node, i + 1, [...node.tangent]);
      }
      segments.push(...plan.plannedSegments);
      wood.push(...plan.plannedSegments.map(readWood));
      targetAxis.unitIds.push(annualUnit.id); targetAxis.direction = plan.direction;
      targetAxis.terminalBudId = `${annualUnit.id}/b${plan.nodeCount}t`;
      bud.viability = 'spent'; bud.development = 'flushed'; bud.dormancy = 'none';
      bud.activatedCycle = cycle; bud.spawnedUnitId = annualUnit.id;
      ledger.spent = round(ledger.spent + plan.cost); ledger.remaining = round(ledger.allocated - ledger.spent);
      ledger.transactions.push({ unitId: annualUnit.id, sourceBudId: bud.id, cost: plan.cost });
      event('shoot-grown', annualUnit.id, { moduleId: module.id, unitId: annualUnit.id, axisId: targetAxis.id,
        budId: bud.id, kind: plan.kind, length: plan.length, cost: plan.cost });
      if ([...nodes.values()].filter(n => n.moduleId === module.id).length > P.maxModuleNodes) throw Error('ZEN_CHERRY_CLOUD_RESEARCH_BOUND');
    }
  }

  function bloom() {
    flowers = [];
    for (const bud of buds.values()) {
      if (bud.identity !== 'floral' || bud.viability !== 'alive') continue;
      if (bud.placement !== 'lateral' || bud.inductionCycle !== cycle - 1 || bud.winterReleaseCycle !== cycle - 1
        || bud.dormancy !== 'released' || bud.bornCycle >= cycle) throw Error(`ZEN_CHERRY_CLOUD_FLORAL_GATE:${bud.id}`);
      const origin = nodeFor(bud.nodeId).p, count = 3 + Math.floor(draw(seed, `${bud.id}:flower-count`) * 3);
      for (let i = 0; i < count; i += 1) {
        const id = `${bud.id}/flower${i}`, angle = i * 2.3999632297 + draw(seed, `${bud.id}:flower-side`) * Math.PI * 2;
        const direction = unit(add(mul(bud.tangent, 0.35), radial(bud.tangent, angle)));
        const pedicelLength = scale * (3.2 + draw(seed, `${id}:pedicel`) * 3.8);
        flowers.push({ id, owner: 'cloud-grown', moduleId: bud.moduleId, familyId: bud.familyId,
          budId: bud.id, nodeId: bud.nodeId, axisId: bud.axisId, inductionCycle: bud.inductionCycle,
          bloomCycle: cycle, position: add(origin, mul(direction, pedicelLength)),
          radius: scale * (2.6 + draw(seed, `${id}:radius`) * 1.2), pedicelLength });
      }
      bud.bloomCycle = cycle; bud.development = 'flowering'; bud.dormancy = 'active';
      event('flowers-opened', bud.id, { moduleId: bud.moduleId, budId: bud.id, axisId: bud.axisId,
        inductionCycle: bud.inductionCycle, winterReleaseCycle: bud.winterReleaseCycle, count });
    }
  }

  let ledgers = [];
  for (const source of reference.snapshots) {
    cycle = source.cycle; phase = source.phase;
    if (phase === 'spring') {
      ledgers = modules.map(m => ({ moduleId: m.id, cycle, unit: 'abstract-construction-credit',
        allocated: m.allowance, spent: 0, remaining: m.allowance, transactions: [], deferredBudIds: [] }));
      bloom(); grow(source, ledgers);
    } else if (phase === 'summer') {
      for (const bud of buds.values()) {
        if (bud.development === 'flowering') {
          bud.viability = 'spent'; bud.development = 'spent'; bud.dormancy = 'none';
          event('flowers-shed', bud.id, { moduleId: bud.moduleId, budId: bud.id });
        }
        if (bud.bornCycle !== cycle || bud.placement !== 'lateral' || bud.viability !== 'alive') continue;
        const annualUnit = get(units, bud.unitId);
        if ((annualUnit.kind === 'short' || bud.annualPosition <= 0.41)
          && draw(seed, `${bud.id}:induction`) < P.floralInductionProbability) {
          bud.identity = 'floral'; bud.inductionCycle = cycle; bud.development = 'differentiated';
          event('floral-induced', bud.id, { moduleId: bud.moduleId, budId: bud.id, unitId: bud.unitId, inductionCycle: cycle });
        }
      }
      for (const annualUnit of units.values()) if (annualUnit.cycle === cycle) annualUnit.state = 'mature';
      flowers = [];
    } else {
      for (const bud of buds.values()) if (bud.viability === 'alive') {
        bud.dormancy = 'released'; bud.winterReleaseCycle = cycle;
        event('winter-released', bud.id, { moduleId: bud.moduleId, budId: bud.id, identity: bud.identity });
      }
    }
    const snapshot = observationOwner.copy(source);
    snapshot.id = `cloud:${source.id}`;
    for (const [key, added] of Object.entries({ nodes: [...nodes.values()], segments, axes: [...axes.values()],
      annualUnits: [...units.values()], buds: [...buds.values()], flowers })) snapshot[key].push(...cloneCloudRecords(added));
    observationOwner.finishObservation(snapshot, {
      source, modules, nodes, segments, axes, units, buds, flowers, ledgers, events, cycle, phase,
    });
    snapshots.push(snapshot);
  }
  return observationOwner.finishCloud({ seed, snapshots, modules, events, scale });
}

export function inspectZenCherryCloudModel(model) {
  const errors = [];
  if (!model || model.schema !== CHERRY_CLOUD_MODEL_ID || !Array.isArray(model.snapshots)) return ['Invalid cloud model.'];
  for (const snapshot of model.snapshots) {
    const nodeMap = new Map(snapshot.nodes.map(n => [n.id, n])), budMap = new Map(snapshot.buds.map(b => [b.id, b]));
    for (const key of ['nodes', 'segments', 'axes', 'annualUnits', 'buds', 'flowers']) {
      if (new Set(snapshot[key].map(v => v.id)).size !== snapshot[key].length) errors.push(`Duplicate ${key} at ${snapshot.id}.`);
    }
    for (const node of snapshot.nodes) if (!finite(node.p)) errors.push(`Invalid node ${node.id}.`);
    for (const segment of snapshot.segments) if (!nodeMap.has(segment.parentNodeId) || !nodeMap.has(segment.childNodeId)
      || !Number.isFinite(segment.radius) || segment.radius <= 0) errors.push(`Invalid wood ${segment.id}.`);
    for (const flower of snapshot.flowers.filter(f => f.owner === 'cloud-grown')) {
      const bud = budMap.get(flower.budId), node = nodeMap.get(flower.nodeId);
      if (!bud || !node || bud.placement !== 'lateral' || bud.identity !== 'floral'
        || bud.nodeId !== node.id || bud.inductionCycle !== snapshot.cycle - 1
        || bud.winterReleaseCycle !== snapshot.cycle - 1 || node.birthCycle >= snapshot.cycle
        || !finite(flower.position) || !(flower.radius > 0)) errors.push(`Invalid flower lineage ${flower.id}.`);
    }
    for (const ledger of snapshot.cloud.ledgers) if (ledger.remaining < -1e-8
      || Math.abs(ledger.spent + ledger.remaining - ledger.allocated) > 1e-7) errors.push(`Invalid construction ledger ${ledger.moduleId}.`);
    if (snapshot.cycle === 1 && snapshot.flowers.some(f => f.owner === 'cloud-grown')) errors.push('First-year initialized population flowered prematurely.');
  }
  return errors;
}
