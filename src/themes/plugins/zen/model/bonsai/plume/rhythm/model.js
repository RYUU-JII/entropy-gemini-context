import { simulateZenCherryRhythm, inspectZenCherryRhythmAnnual } from './annual-core.js';
import { CHERRY_ANNUAL_MODEL_ID, CHERRY_ANNUAL_PROFILE } from '../annual/profile.js';
import { CHERRY_CANOPY_PROFILE } from '../canopy/profile.js';
import { inspectZenCherryCanopy } from '../canopy/model.js';
import { CHERRY_RHYTHM_PROFILE } from './profile.js';
const CHERRY_CANOPY_MODEL_ID = 'zen_cherry_rhythm_v1';
import { F4_SCAFFOLD_SCHEMA, F4_SCAFFOLD_SOURCE } from '../canopy/f4-scaffold.js';

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

function makeFamily(attachment, scaffold, years, treatment, scale, variant) {
  const seed = familySeed(scaffold.seed, attachment.id);
  const source = simulateZenCherryRhythm({ seed, years, treatment, variant });
  const sourceErrors = inspectZenCherryRhythmAnnual(source);
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
    id: `family:${attachment.id}`, seed, sourceModelId: source.schema, variant,
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

// The annual kernel emits enumerable data records. Copy primitive fields in
// their original slots; clone retained mutable fields together so their aliases
// stay intact. The caller replaces only the declared vectors/ref arrays.
function cloneRetainedRecord(record, arrayRefs, replacedFields, copiedNumberArrayKey) {
  const output = { ...record };
  const retained = Object.create(null);
  let hasRetained = false;
  for (const key of Reflect.ownKeys(output)) {
    // Native structuredClone omits symbol-keyed fields.
    if (typeof key === 'symbol') { delete output[key]; continue; }
    const value = output[key];
    if (arrayRefs.includes(key) || replacedFields.includes(key)) {
      output[key] = null;
    } else if (value !== null && (typeof value === 'object' || typeof value === 'function' || typeof value === 'symbol')) {
      if (key === copiedNumberArrayKey) {
        // Annual producers own independent dense decision-cycle number arrays.
        // Copy the entire list in its original slot before namespacing/rotation.
        output[key] = value.slice();
      } else {
        retained[key] = value;
        hasRetained = true;
      }
    }
  }
  if (hasRetained) Object.assign(output, structuredClone(retained));
  return output;
}

function mapRecord(record, family, scalarRefs, arrayRefs = [], replacedFields = [], copiedNumberArrayKey = null) {
  // Finish this newly owned row before it escapes; another spread only copies it.
  const output = cloneRetainedRecord(record, arrayRefs, replacedFields, copiedNumberArrayKey);
  output.id = namespace(family, record.id);
  output.sourceId = record.id;
  output.owner = OWNER_FAMILY;
  output.familyId = family.id;
  for (const key of scalarRefs) if (Object.hasOwn(record, key)) output[key] = namespace(family, record[key]);
  for (const key of arrayRefs) if (Object.hasOwn(record, key)) output[key] = record[key].map((id) => namespace(family, id));
  return output;
}

function mappedEvents(events, family) {
  return events.map((event) => {
    const mapped = mapRecord(event, family, ['budId', 'axisId', 'unitId', 'nodeId', 'formerAxisId', 'sourceBudId', 'committedUnitId']);
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
  const nodes = source.nodes.filter((node) => node.id !== 'origin').map((node) => {
    const mapped = mapRecord(node, family, [], [], ['p']);
    mapped.p = position(node.p, transform);
    return mapped;
  });
  const segments = source.segments.map((segment) => {
    const mapped = mapRecord(segment, family, ['parentNodeId', 'childNodeId', 'axisId', 'unitId']);
    mapped.radius = segment.radius * transform.scale;
    return mapped;
  });
  const axes = source.axes.map((axis) => {
    const mapped = mapRecord(axis, family, ['parentBudId', 'parentAxisId', 'terminalBudId', 'succeededAxisId'], ['unitIds'], ['direction']);
    mapped.direction = rotate(axis.direction, transform);
    if (axis.id === family.sourceRootAxisId) {
      mapped.parentAxisId = family.anchorAxisId;
      mapped.attachmentKind = 'scaffold-docking';
      mapped.attachmentNodeId = family.anchorNodeId;
    }
    return mapped;
  });
  const annualUnits = source.annualUnits.map((annualUnit) => {
    const mapped = mapRecord(annualUnit, family, ['axisId', 'sourceBudId', 'originNodeId'], ['nodeIds']);
    mapped.length = annualUnit.length * transform.scale;
    return mapped;
  });
  const buds = source.buds.map((bud) => {
    const mapped = mapRecord(bud, family, ['nodeId', 'axisId', 'unitId', 'spawnedUnitId'], [], ['tangent'], 'decisionCycles');
    mapped.tangent = rotate(bud.tangent, transform);
    return mapped;
  });
  const flowers = source.flowers.map((flower) => {
    const mapped = mapRecord(flower, family, ['budId', 'nodeId', 'axisId'], [], ['position']);
    mapped.position = position(flower.position, transform);
    mapped.radius = flower.radius * transform.scale;
    mapped.pedicelLength = flower.pedicelLength * transform.scale;
    return mapped;
  });
  const ledgerShell = { ...source.ledger, transactions: null, deferredBudIds: null };
  const ledger = { ...structuredClone(ledgerShell), familyId: family.id,
    transactions: source.ledger.transactions.map((transaction) => mapRecord(transaction, family, ['unitId', 'sourceBudId'])),
    deferredBudIds: source.ledger.deferredBudIds.map((id) => namespace(family, id)) };
  const kindByUnit = new Map(annualUnits.map(unit => [unit.id, unit.kind]));
  const budUnit = new Map(buds.map(bud => [bud.id, bud.unitId]));
  const metrics = { ...source.metrics, familyId: family.id, seed: family.seed, anchorNodeId: family.anchorNodeId,
    longFlowers: flowers.filter((flower) => kindByUnit.get(budUnit.get(flower.budId)) === 'long').length,
    shortFlowers: flowers.filter((flower) => kindByUnit.get(budUnit.get(flower.budId)) === 'short').length };
  return { nodes, segments, axes, annualUnits, buds, flowers, events: mappedEvents(source.events, family), ledger, metrics };
}

/** Compose existing annual organs onto a fixed F4 graph; does not advance F4. */
export function simulateZenCherryRhythmCanopy({ scaffold, years = 3, treatment = 'natural', variant = 'renewal' }) {
  if (!['cadence', 'renewal'].includes(variant)) throw Error('ZEN_CHERRY_RHYTHM_VARIANT');
  const failures = scaffoldErrors(scaffold);
  if (failures.length) throw new Error(`Cherry canopy: ${failures.join('; ')}`);
  if (!Number.isInteger(years) || years < 1 || years > CHERRY_ANNUAL_PROFILE.maxYears) throw new Error(`Cherry canopy: years must be 1..${CHERRY_ANNUAL_PROFILE.maxYears}.`);
  if (!['natural', 'tip-pruned'].includes(treatment)) throw new Error(`Cherry canopy: unknown treatment ${treatment}.`);
  const scale = scaffold.bounds.height / CHERRY_CANOPY_PROFILE.scaleDenominator;
  const generated = [...scaffold.attachments].sort(compareId).map((attachment) => makeFamily(attachment, scaffold, years, treatment, scale, variant));
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
  return { schema: CHERRY_CANOPY_MODEL_ID, seed: scaffold.seed, years, treatment, variant,
    profile: { ...CHERRY_CANOPY_PROFILE, worldScale: scale, annualModelId: 'zen_cherry_rhythm_annual_v1', variant },
    policy: structuredClone(CHERRY_RHYTHM_PROFILE), scaffold: structuredClone(scaffold), families, snapshots, events,
    history: events.filter(event => event.type === 'shoot-kind-decision') };
}

/** Explicit bridge to the unchanged common composite geometry contract. */
export function inspectZenCherryRhythmCanopy(result) {
  if (!result || result.schema !== CHERRY_CANOPY_MODEL_ID || !['cadence','renewal'].includes(result.variant)) return ['Invalid cherry rhythm result schema.'];
  const errors = inspectZenCherryCanopy({...result, schema:'zen_cherry_canopy_v1'});
  for (const snapshot of result.snapshots) {
    const units = new Map(snapshot.annualUnits.map(unit => [unit.id,unit]));
    const buds = new Map(snapshot.buds.map(bud => [bud.id,bud]));
    const axes = new Map(snapshot.axes.map(axis => [axis.id,axis]));
    for (const event of snapshot.events.filter(item => item.type === 'shoot-kind-decision')) {
      const axis=axes.get(event.axisId),bud=buds.get(event.budId),unit=units.get(event.committedUnitId);
      if (!axis || !bud || axis.familyId !== event.familyId || bud.familyId !== event.familyId
        || (event.committed && (!unit || unit.familyId !== event.familyId || unit.axisId !== axis.id || unit.kind !== event.requestedKind || unit.constructionCost !== event.committedCost))) errors.push(`${snapshot.id}: Invalid namespaced shoot policy ${event.id}.`);
      if (result.variant === 'renewal' && (event.closingCredit < 0 || Math.abs(event.availableCredit-event.committedCost-event.closingCredit)>1e-6)) errors.push(`${snapshot.id}: Invalid extension account ${event.id}.`);
    }
  }
  return errors;
}
