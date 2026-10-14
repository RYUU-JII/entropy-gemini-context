import { simulateZenCherry, inspectZenCherry } from '../annual/model.js';
import { CHERRY_ANNUAL_MODEL_ID, CHERRY_ANNUAL_PROFILE } from '../annual/profile.js';
import { CHERRY_CANOPY_MODEL_ID, CHERRY_CANOPY_PROFILE } from './profile.js';
import { F4_SCAFFOLD_SCHEMA, F4_SCAFFOLD_SOURCE } from './f4-scaffold.js';

const OWNER_SCAFFOLD = 'f4-scaffold';
const OWNER_FAMILY = 'cherry-family';
const PHASES = ['spring', 'summer', 'winter'];
const add = (a, b) => a.map((value, index) => value + b[index]);
const subtract = (a, b) => a.map((value, index) => value - b[index]);
const multiply = (a, factor) => a.map((value) => value * factor);
const dot = (a, b) => a.reduce((sum, value, index) => sum + value * b[index], 0);
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const finiteVector = (value) => Array.isArray(value) && value.length === 3 && value.every(Number.isFinite);
const sameVector = (a, b, epsilon = 0) => finiteVector(a) && finiteVector(b) && a.every((value, index) => Math.abs(value - b[index]) <= epsilon);
const compareId = (a, b) => a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
const sum = (items, key) => items.reduce((value, item) => value + item[key], 0);

function normalize(vector) {
  if (!finiteVector(vector) || Math.hypot(...vector) < 1e-10) throw new Error('Cherry canopy: invalid frame direction.');
  return multiply(vector, 1 / Math.hypot(...vector));
}

function basis(tangent) {
  const forward = normalize(tangent);
  // Choosing a nonparallel mathematical basis is not a source-data fallback.
  const upReference = Math.abs(forward[1]) < 0.95 ? [0, 1, 0] : [0, 0, 1];
  const up = normalize(subtract(upReference, multiply(forward, dot(upReference, forward))));
  return [forward, up, normalize(cross(forward, up))];
}

function rotate(vector, transform) {
  return transform.targetBasis.reduce((out, target, index) => add(out, multiply(target, dot(vector, transform.sourceBasis[index]))), [0, 0, 0]);
}

function position(vector, transform) {
  return add(transform.origin, multiply(rotate(vector, transform), transform.scale));
}

function familySeed(seed, attachmentId) {
  let state = (seed ^ 2166136261) >>> 0;
  const key = `cherry-canopy-family-v1:${attachmentId}`;
  for (let index = 0; index < key.length; index += 1) state = Math.imul(state ^ key.charCodeAt(index), 16777619) >>> 0;
  state ^= state >>> 16;
  state = Math.imul(state, 0x7feb352d);
  state ^= state >>> 15;
  return (state ^ (state >>> 16)) >>> 0;
}

function scaffoldErrors(scaffold) {
  const errors = [];
  if (!scaffold || scaffold.schema !== F4_SCAFFOLD_SCHEMA) return ['Invalid scaffold schema.'];
  if (!Number.isInteger(scaffold.seed) || scaffold.seed < 1 || scaffold.seed > 0xffffffff) errors.push('Scaffold seed must be a positive uint32.');
  if (!scaffold.source || Object.entries(F4_SCAFFOLD_SOURCE).some(([key, value]) => scaffold.source[key] !== value)) errors.push('Missing or mismatched pinned F4 source provenance.');
  if (!Array.isArray(scaffold.nodes) || !Array.isArray(scaffold.segments) || !Array.isArray(scaffold.attachments)) return [...errors, 'Missing scaffold graph collections.'];
  if (scaffold.nodes.length < 2 || scaffold.segments.length < 1) errors.push('Scaffold must contain visible wood.');
  for (const collection of ['nodes', 'segments', 'attachments']) {
    if (new Set(scaffold[collection].map((item) => item.id)).size !== scaffold[collection].length) errors.push(`Duplicate scaffold ${collection} IDs.`);
  }
  const nodes = new Map(scaffold.nodes.map((node) => [node.id, node]));
  const incoming = new Map();
  const children = new Map(scaffold.nodes.map((node) => [node.id, []]));
  for (const node of scaffold.nodes) {
    if (!finiteVector(node.p) || node.birthCycle !== null) errors.push(`Invalid fixed scaffold node ${node.id}.`);
  }
  if (!nodes.has('origin')) errors.push('Scaffold root origin is missing.');
  for (const segment of scaffold.segments) {
    if (!nodes.has(segment.parentNodeId) || !nodes.has(segment.childNodeId)) { errors.push(`Dangling scaffold wood ${segment.id}.`); continue; }
    if (incoming.has(segment.childNodeId)) errors.push(`Multiple scaffold parents ${segment.childNodeId}.`);
    incoming.set(segment.childNodeId, segment);
    children.get(segment.parentNodeId).push(segment.childNodeId);
    if (segment.kind !== 'scaffold' || segment.birthCycle !== null || segment.unitId !== null
      || typeof segment.axisId !== 'string' || !Number.isFinite(segment.radius) || segment.radius <= 0
      || !Number.isFinite(segment.startRadius) || segment.startRadius <= 0 || !Number.isFinite(segment.endRadius) || segment.endRadius <= 0) errors.push(`Invalid fixed scaffold segment ${segment.id}.`);
  }
  if (incoming.has('origin')) errors.push('Scaffold origin has a parent.');
  const reached = new Set();
  const queue = ['origin'];
  while (queue.length) {
    const id = queue.pop();
    if (reached.has(id)) continue;
    reached.add(id);
    if (children.has(id)) queue.push(...children.get(id));
  }
  if (reached.size !== nodes.size) errors.push('Scaffold contains disconnected or cyclic wood.');
  const attached = new Set();
  for (const attachment of scaffold.attachments) {
    const node = nodes.get(attachment.nodeId);
    const segment = incoming.get(attachment.nodeId);
    if (!node || !segment) { errors.push(`Invalid attachment ${attachment.id}.`); continue; }
    if (attached.has(node.id)) errors.push(`Multiple families proposed at scaffold tip ${node.id}.`);
    attached.add(node.id);
    if (children.get(node.id).length !== 0) errors.push(`Attachment is not a scaffold tip ${attachment.id}.`);
    if (!sameVector(attachment.origin, node.p) || attachment.axisId !== segment.axisId) errors.push(`Attachment origin/axis disagrees with wood ${attachment.id}.`);
    const delta = subtract(node.p, nodes.get(segment.parentNodeId).p);
    if (!finiteVector(delta) || Math.hypot(...delta) < 1e-10 || !sameVector(attachment.tangent, normalize(delta), 1e-7)) errors.push(`Attachment tangent disagrees with incoming wood ${attachment.id}.`);
    if (!Number.isFinite(attachment.radius) || attachment.radius <= 0) errors.push(`Invalid attachment radius ${attachment.id}.`);
  }
  for (const [id, ids] of children) if (ids.length === 0 && !attached.has(id)) errors.push(`Visible tip has no attachment ${id}.`);
  if (scaffold.attachments.length < 1 || scaffold.attachments.length > CHERRY_CANOPY_PROFILE.maxFamilies) errors.push('Attachment count is outside the explicit research bounds.');
  if (!scaffold.bounds || !Number.isFinite(scaffold.bounds.height) || scaffold.bounds.height <= 0) errors.push('Scaffold requires a positive world height.');
  else if (scaffold.nodes.every((node) => finiteVector(node.p))) {
    const height = Math.max(...scaffold.nodes.map((node) => node.p[1])) - Math.min(...scaffold.nodes.map((node) => node.p[1]));
    if (Math.abs(height - scaffold.bounds.height) > 1e-7) errors.push('Scaffold height disagrees with its fixed nodes.');
  }
  return errors;
}

function makeFamily(attachment, scaffold, years, treatment, scale) {
  const seed = familySeed(scaffold.seed, attachment.id);
  const source = simulateZenCherry({ seed, years, treatment });
  const sourceErrors = inspectZenCherry(source);
  if (sourceErrors.length) throw new Error(`Cherry canopy: invalid annual source at ${attachment.id}: ${sourceErrors.join('; ')}`);
  const first = source.snapshots[0];
  const foundationRoot = first.segments.filter((segment) => segment.birthCycle === 0 && segment.parentNodeId === 'origin');
  if (foundationRoot.length !== 1) throw new Error('Cherry canopy: annual foundation has no unique initial segment.');
  const firstNode = first.nodes.find((node) => node.id === foundationRoot[0].childNodeId);
  const sourceOrigin = first.nodes.find((node) => node.id === 'origin');
  if (!firstNode || !sourceOrigin || !sameVector(sourceOrigin.p, [0, 0, 0])) throw new Error('Cherry canopy: annual source origin contract changed.');
  const transform = { origin: [...attachment.origin], scale,
    sourceBasis: basis(subtract(firstNode.p, sourceOrigin.p)), targetBasis: basis(attachment.tangent) };
  const metadata = {
    id: `family:${attachment.id}`, seed, sourceModelId: CHERRY_ANNUAL_MODEL_ID,
    attachmentId: attachment.id, anchorNodeId: attachment.nodeId, anchorAxisId: attachment.axisId,
    foundationPolicy: CHERRY_CANOPY_PROFILE.foundationPolicy,
    foundationLength: CHERRY_ANNUAL_PROFILE.foundationLength * scale,
    sourceFoundationSegmentId: foundationRoot[0].id,
    sourceRootAxisId: foundationRoot[0].axisId,
    attachmentRadius: attachment.radius,
    initialFoundationRadius: foundationRoot[0].radius * scale,
    initialJunctionRadiusRatio: foundationRoot[0].radius * scale / attachment.radius,
    transform,
  };
  return { metadata, source };
}

function namespace(family, value) {
  if (value === null) return null;
  if (typeof value !== 'string') throw new Error(`Cherry canopy: invalid organ reference in ${family.id}.`);
  return value === 'origin' ? family.anchorNodeId : `${family.id}::${value}`;
}

function mapRecord(record, family, scalarRefs, arrayRefs = []) {
  const output = { ...structuredClone(record), id: namespace(family, record.id), sourceId: record.id,
    owner: OWNER_FAMILY, familyId: family.id };
  for (const key of scalarRefs) if (Object.hasOwn(record, key)) output[key] = namespace(family, record[key]);
  for (const key of arrayRefs) if (Object.hasOwn(record, key)) output[key] = record[key].map((id) => namespace(family, id));
  return output;
}

function mappedEvents(events, family) {
  return events.map((event) => {
    const mapped = mapRecord(event, family, ['budId', 'axisId', 'unitId', 'nodeId', 'formerAxisId', 'sourceBudId']);
    if (Object.hasOwn(event, 'length')) {
      mapped.sourceLength = event.length;
      mapped.length = event.length * family.transform.scale;
      mapped.lengthUnit = 'scaffold-world-unit';
    }
    return mapped;
  });
}

function mapSnapshot(source, family) {
  const transform = family.transform;
  const nodes = source.nodes.filter((node) => node.id !== 'origin').map((node) => ({
    ...mapRecord(node, family, []), p: position(node.p, transform),
  }));
  const segments = source.segments.map((segment) => ({
    ...mapRecord(segment, family, ['parentNodeId', 'childNodeId', 'axisId', 'unitId']), radius: segment.radius * transform.scale,
  }));
  const axes = source.axes.map((axis) => {
    const mapped = mapRecord(axis, family, ['parentBudId', 'parentAxisId', 'terminalBudId', 'succeededAxisId'], ['unitIds']);
    mapped.direction = rotate(axis.direction, transform);
    if (axis.id === family.sourceRootAxisId) {
      mapped.parentAxisId = family.anchorAxisId;
      mapped.attachmentKind = 'scaffold-docking';
      mapped.attachmentNodeId = family.anchorNodeId;
    }
    return mapped;
  });
  const annualUnits = source.annualUnits.map((annualUnit) => ({
    ...mapRecord(annualUnit, family, ['axisId', 'sourceBudId', 'originNodeId'], ['nodeIds']), length: annualUnit.length * transform.scale,
  }));
  const buds = source.buds.map((bud) => ({
    ...mapRecord(bud, family, ['nodeId', 'axisId', 'unitId', 'spawnedUnitId']), tangent: rotate(bud.tangent, transform),
  }));
  const flowers = source.flowers.map((flower) => ({
    ...mapRecord(flower, family, ['budId', 'nodeId', 'axisId']), position: position(flower.position, transform),
    radius: flower.radius * transform.scale, pedicelLength: flower.pedicelLength * transform.scale,
  }));
  const ledger = { ...structuredClone(source.ledger), familyId: family.id,
    transactions: source.ledger.transactions.map((transaction) => mapRecord(transaction, family, ['unitId', 'sourceBudId'])),
    deferredBudIds: source.ledger.deferredBudIds.map((id) => namespace(family, id)) };
  const kindByAxis = new Map(axes.map((axis) => [axis.id, axis.kind]));
  const metrics = { ...source.metrics, familyId: family.id, seed: family.seed, anchorNodeId: family.anchorNodeId,
    longFlowers: flowers.filter((flower) => kindByAxis.get(flower.axisId) === 'long').length,
    shortFlowers: flowers.filter((flower) => kindByAxis.get(flower.axisId) === 'short').length };
  return { nodes, segments, axes, annualUnits, buds, flowers, events: mappedEvents(source.events, family), ledger, metrics };
}

/** Compose existing annual organs onto a fixed F4 graph; does not advance F4. */
export function simulateZenCherryCanopy({ scaffold, years = 3, treatment = 'natural' }) {
  const failures = scaffoldErrors(scaffold);
  if (failures.length) throw new Error(`Cherry canopy: ${failures.join('; ')}`);
  if (!Number.isInteger(years) || years < 1 || years > CHERRY_ANNUAL_PROFILE.maxYears) throw new Error(`Cherry canopy: years must be 1..${CHERRY_ANNUAL_PROFILE.maxYears}.`);
  if (!['natural', 'tip-pruned'].includes(treatment)) throw new Error(`Cherry canopy: unknown treatment ${treatment}.`);
  const scale = scaffold.bounds.height / CHERRY_CANOPY_PROFILE.scaleDenominator;
  const generated = [...scaffold.attachments].sort(compareId).map((attachment) => makeFamily(attachment, scaffold, years, treatment, scale));
  const families = generated.map((item) => item.metadata);
  const fixedNodes = scaffold.nodes.map((node) => ({ ...structuredClone(node), owner: OWNER_SCAFFOLD, familyId: null }));
  const fixedSegments = scaffold.segments.map((segment) => ({ ...structuredClone(segment), owner: OWNER_SCAFFOLD, familyId: null }));
  // These are indexes of real F4 lineage IDs, not fabricated annual axes.
  const fixedAxes = [...new Set(scaffold.segments.map((segment) => segment.axisId))].sort().map((id) => ({
    id, owner: OWNER_SCAFFOLD, familyId: null, kind: 'scaffold', role: 'fixed-scaffold',
    parentBudId: null, parentAxisId: null, birthCycle: null, unitIds: [],
  }));
  const snapshots = [];
  for (let index = 0; index < years * PHASES.length; index += 1) {
    const cycle = Math.floor(index / 3) + 1;
    const phase = PHASES[index % 3];
    const mapped = generated.map((item) => mapSnapshot(item.source.snapshots[index], item.metadata));
    const ledgers = mapped.map((item) => item.ledger);
    const familyMetrics = mapped.map((item) => item.metrics);
    const snapshot = {
      id: `year-${cycle}-${phase}`, cycle, phase,
      nodes: [...structuredClone(fixedNodes), ...mapped.flatMap((item) => item.nodes)],
      segments: [...structuredClone(fixedSegments), ...mapped.flatMap((item) => item.segments)],
      axes: [...structuredClone(fixedAxes), ...mapped.flatMap((item) => item.axes)],
      annualUnits: mapped.flatMap((item) => item.annualUnits), buds: mapped.flatMap((item) => item.buds), flowers: mapped.flatMap((item) => item.flowers),
      events: mapped.flatMap((item) => item.events),
      attachments: families.map((family) => ({ familyId: family.id, nodeId: family.anchorNodeId })),
      ledgers, familyMetrics,
      ledger: { cycle, unit: CHERRY_ANNUAL_PROFILE.budgetUnit, scope: CHERRY_CANOPY_PROFILE.budgetScope,
        allocated: sum(ledgers, 'allocated'), spent: sum(ledgers, 'spent'), remaining: sum(ledgers, 'remaining'), familyCount: families.length },
      metrics: { familyCount: families.length, scaffoldSegments: fixedSegments.length,
        longUnits: sum(familyMetrics, 'longUnits'), shortUnits: sum(familyMetrics, 'shortUnits'),
        dormantBuds: sum(familyMetrics, 'dormantBuds'), floralBuds: sum(familyMetrics, 'floralBuds'),
        flowers: sum(familyMetrics, 'flowers'), longFlowers: sum(familyMetrics, 'longFlowers'), shortFlowers: sum(familyMetrics, 'shortFlowers'),
        persistentShortAxes: sum(familyMetrics, 'persistentShortAxes'), successors: sum(familyMetrics, 'successors'),
        dormantRevisits: sum(familyMetrics, 'dormantRevisits'), budgetRemaining: sum(ledgers, 'remaining') },
    };
    if (snapshot.nodes.length > CHERRY_CANOPY_PROFILE.maxSnapshotNodes) throw new Error('Cherry canopy: explicit combined node bound exceeded; no clipped canopy was returned.');
    snapshots.push(snapshot);
  }
  const events = generated.flatMap((item) => mappedEvents(item.source.events, item.metadata));
  events.sort((a, b) => a.cycle - b.cycle || PHASES.indexOf(a.phase) - PHASES.indexOf(b.phase) || compareId(a, b));
  return { schema: CHERRY_CANOPY_MODEL_ID, seed: scaffold.seed, years, treatment,
    profile: { ...CHERRY_CANOPY_PROFILE, worldScale: scale, annualModelId: CHERRY_ANNUAL_MODEL_ID },
    scaffold: structuredClone(scaffold), families, snapshots, events };
}

/** Validate composite ownership, true attachment and immutable historical wood. */
export function inspectZenCherryCanopy(result) {
  if (!result || result.schema !== CHERRY_CANOPY_MODEL_ID || !Array.isArray(result.snapshots) || !Array.isArray(result.families)) return ['Invalid cherry canopy result schema.'];
  const errors = scaffoldErrors(result.scaffold).map((error) => `Source scaffold: ${error}`);
  if (errors.length) return errors;
  const scaffold = result.scaffold;
  if (result.snapshots.length !== result.years * 3) errors.push('Snapshot count disagrees with years.');
  if (result.families.length !== scaffold.attachments.length || new Set(result.families.map((family) => family.id)).size !== result.families.length) errors.push('Family set disagrees with scaffold attachments.');
  const families = new Map(result.families.map((family) => [family.id, family]));
  const oldNodes = new Map();
  const oldRadii = new Map();
  const openedFlowers = new Set();
  for (let index = 0; index < result.snapshots.length; index += 1) {
    const snapshot = result.snapshots[index];
    const fail = (message) => errors.push(`${snapshot.id}: ${message}`);
    if (snapshot.cycle !== Math.floor(index / 3) + 1 || snapshot.phase !== PHASES[index % 3]) fail('Seasons are not chronological.');
    const names = ['nodes', 'segments', 'axes', 'annualUnits', 'buds', 'flowers', 'events'];
    if (names.some((name) => !Array.isArray(snapshot[name]))) { fail('Missing organ collection.'); continue; }
    for (const name of names) {
      if (new Set(snapshot[name].map((item) => item.id)).size !== snapshot[name].length) fail(`Duplicate ${name} IDs.`);
      for (const item of snapshot[name]) if (item.owner !== OWNER_SCAFFOLD && (item.owner !== OWNER_FAMILY || !families.has(item.familyId))) fail(`Unknown ${name} owner ${item.id}.`);
    }
    const nodes = new Map(snapshot.nodes.map((node) => [node.id, node]));
    const segments = new Map(snapshot.segments.map((segment) => [segment.id, segment]));
    const axes = new Map(snapshot.axes.map((axis) => [axis.id, axis]));
    const buds = new Map(snapshot.buds.map((bud) => [bud.id, bud]));
    const units = new Map(snapshot.annualUnits.map((annualUnit) => [annualUnit.id, annualUnit]));
    for (const fixed of scaffold.nodes) {
      const actual = nodes.get(fixed.id);
      if (!actual || actual.owner !== OWNER_SCAFFOLD || actual.birthCycle !== null || !sameVector(actual.p, fixed.p)) fail(`Fixed scaffold node changed ${fixed.id}.`);
    }
    for (const fixed of scaffold.segments) {
      const actual = segments.get(fixed.id);
      if (!actual || Object.entries(fixed).some(([key, value]) => actual[key] !== value) || actual.owner !== OWNER_SCAFFOLD) fail(`Fixed scaffold segment changed ${fixed.id}.`);
    }
    const incoming = new Map();
    const children = new Map(snapshot.nodes.map((node) => [node.id, []]));
    for (const node of snapshot.nodes) {
      if (!finiteVector(node.p)) fail(`Invalid coordinates ${node.id}.`);
      if (oldNodes.has(node.id) && !sameVector(oldNodes.get(node.id), node.p)) fail(`Historical node moved ${node.id}.`);
      oldNodes.set(node.id, node.p);
    }
    for (const id of oldNodes.keys()) if (!nodes.has(id)) fail(`Historical node vanished ${id}.`);
    for (const segment of snapshot.segments) {
      if (!nodes.has(segment.parentNodeId) || !nodes.has(segment.childNodeId) || !axes.has(segment.axisId)) { fail(`Dangling wood ${segment.id}.`); continue; }
      if (incoming.has(segment.childNodeId)) fail(`Node has multiple parents ${segment.childNodeId}.`);
      incoming.set(segment.childNodeId, segment);
      children.get(segment.parentNodeId).push(segment.childNodeId);
      if (segment.owner === OWNER_FAMILY && !units.has(segment.unitId)) fail(`Missing annual unit ${segment.id}.`);
      if (!Number.isFinite(segment.radius) || segment.radius <= 0 || (oldRadii.has(segment.id) && oldRadii.get(segment.id) > segment.radius)) fail(`Invalid/shrunken wood ${segment.id}.`);
      oldRadii.set(segment.id, segment.radius);
    }
    const reached = new Set();
    const queue = ['origin'];
    while (queue.length) {
      const id = queue.pop();
      if (reached.has(id)) continue;
      reached.add(id);
      if (children.has(id)) queue.push(...children.get(id));
    }
    if (reached.size !== nodes.size || incoming.has('origin') || snapshot.segments.length !== snapshot.nodes.length - 1) fail('Canopy is not one rooted, connected wood graph.');
    for (const family of result.families) {
      const foundation = segments.get(namespace(family, family.sourceFoundationSegmentId));
      if (!foundation || foundation.parentNodeId !== family.anchorNodeId || foundation.familyId !== family.id) { fail(`Family is not welded to its true anchor ${family.id}.`); continue; }
      const a = nodes.get(foundation.parentNodeId);
      const b = nodes.get(foundation.childNodeId);
      const attachment = scaffold.attachments.find((item) => item.id === family.attachmentId);
      if (!attachment || !sameVector(normalize(subtract(b.p, a.p)), attachment.tangent, 1e-7)) fail(`Foundation tangent is not aligned ${family.id}.`);
    }
    for (const bud of snapshot.buds) {
      if (!nodes.has(bud.nodeId) || !axes.has(bud.axisId) || !units.has(bud.unitId)) fail(`Unattached bud ${bud.id}.`);
      if (!finiteVector(bud.tangent) || Math.abs(Math.hypot(...bud.tangent) - 1) > 1e-7) fail(`Invalid transformed bud frame ${bud.id}.`);
      if (bud.placement === 'terminal' && bud.identity !== 'vegetative') fail(`Nonvegetative terminal ${bud.id}.`);
      if (new Set(bud.decisionCycles).size !== bud.decisionCycles.length) fail(`Repeated annual bud decision ${bud.id}.`);
    }
    for (const flower of snapshot.flowers) {
      const bud = buds.get(flower.budId);
      if (!bud || bud.identity !== 'floral' || bud.nodeId !== flower.nodeId || bud.axisId !== flower.axisId || bud.familyId !== flower.familyId) fail(`Unattached flower ${flower.id}.`);
      if (!bud || flower.inductionCycle !== bud.inductionCycle || flower.bloomCycle !== flower.inductionCycle + 1 || bud.winterReleaseCycle !== flower.inductionCycle
        || snapshot.phase !== 'spring' || flower.bloomCycle !== snapshot.cycle) fail(`Flower cohort timing violated ${flower.id}.`);
      if (openedFlowers.has(flower.id)) fail(`Flower cohort was reused ${flower.id}.`);
      openedFlowers.add(flower.id);
      if (!finiteVector(flower.position) || !Number.isFinite(flower.radius) || flower.radius <= 0) fail(`Invalid transformed flower ${flower.id}.`);
    }
    const usedBuds = new Set();
    for (const annualUnit of snapshot.annualUnits) {
      if (annualUnit.cycle === 0) continue;
      const bud = buds.get(annualUnit.sourceBudId);
      if (!bud || bud.identity !== 'vegetative' || bud.activatedCycle !== annualUnit.cycle || bud.nodeId !== annualUnit.originNodeId) fail(`Invalid annual shoot origin ${annualUnit.id}.`);
      if (usedBuds.has(annualUnit.sourceBudId)) fail(`Source bud reused ${annualUnit.sourceBudId}.`);
      usedBuds.add(annualUnit.sourceBudId);
    }
    if (!Array.isArray(snapshot.ledgers) || snapshot.ledgers.length !== families.size) { fail('Missing independent family ledgers.'); continue; }
    for (const ledger of snapshot.ledgers) {
      if (!families.has(ledger.familyId) || Math.abs(sum(ledger.transactions, 'cost') - ledger.spent) > 1e-6
        || Math.abs(ledger.allocated - ledger.spent - ledger.remaining) > 1e-6 || ledger.remaining < 0) fail(`Family construction ledger does not balance ${ledger.familyId}.`);
      for (const transaction of ledger.transactions) {
        const annualUnit = units.get(transaction.unitId);
        if (!annualUnit || annualUnit.familyId !== ledger.familyId || annualUnit.sourceBudId !== transaction.sourceBudId || annualUnit.constructionCost !== transaction.cost) fail(`Unbacked family transaction ${transaction.id}.`);
      }
    }
    if (snapshot.metrics.flowers !== snapshot.flowers.length || snapshot.metrics.familyCount !== families.size || snapshot.metrics.scaffoldSegments !== scaffold.segments.length) fail('Aggregate metrics disagree with actual organs.');
    if (Math.abs(snapshot.ledger.spent - sum(snapshot.ledgers, 'spent')) > 1e-6 || Math.abs(snapshot.ledger.remaining - sum(snapshot.ledgers, 'remaining')) > 1e-6) fail('Aggregate ledger disagrees with independent families.');
  }
  return errors;
}
