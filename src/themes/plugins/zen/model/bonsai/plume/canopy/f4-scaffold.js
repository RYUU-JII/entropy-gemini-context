// Read-only bridge from one pinned F4 executable to an inert wood scaffold.
// No F4 flower carrier, annual age or botanical bud is inferred from its nodes.


export const F4_SCAFFOLD_SCHEMA = 'zen_cherry_f4_scaffold_v1';
export const F4_SCAFFOLD_SOURCE = Object.freeze({
  model: 'f4',
  sourceHash: 'fd15942bdd3f02e53b131cb93feff7a8de03728780bc9b124d9be1da7d3baad7',
  bundleHash: '8f7add837bdab5b5e41120e8278e2b36bd60f2109a1b2d0b27ee3c25bfac46af',
  programSeed: 2267459016,
  eventBudget: 160,
  semantics: 'inert_original_f4_scaffold',
});

const finitePoint = p => Array.isArray(p) && p.length === 3 && p.every(Number.isFinite);
const freeze = value => {
  if (value && typeof value === 'object') {
    for (const item of Object.values(value)) freeze(item);
    Object.freeze(value);
  }
  return value;
};

export function inspectF4Scaffold(scaffold) {
  const errors = [];
  if (!scaffold || scaffold.schema !== F4_SCAFFOLD_SCHEMA
      || !Array.isArray(scaffold.nodes) || !Array.isArray(scaffold.segments)
      || !Array.isArray(scaffold.attachments)) return ['Invalid F4 scaffold schema.'];
  if (!scaffold.source || Object.keys(F4_SCAFFOLD_SOURCE).some(key => scaffold.source[key] !== F4_SCAFFOLD_SOURCE[key])) {
    errors.push('F4 scaffold source differs from the pinned original.');
  }
  const nodeMap = new Map(scaffold.nodes.map(n => [n.id, n]));
  const segmentMap = new Map(scaffold.segments.map(s => [s.id, s]));
  if (nodeMap.size !== scaffold.nodes.length || segmentMap.size !== scaffold.segments.length
      || new Set(scaffold.attachments.map(a => a.id)).size !== scaffold.attachments.length) errors.push('Duplicate scaffold identity.');
  const incoming = new Map(), outgoing = new Set();
  for (const node of scaffold.nodes) {
    if (!finitePoint(node.p) || node.birthCycle !== null || typeof node.sourceNodeId !== 'string') errors.push(`Invalid scaffold node ${node.id}.`);
  }
  for (const segment of scaffold.segments) {
    if (!nodeMap.has(segment.parentNodeId) || !nodeMap.has(segment.childNodeId)) errors.push(`Detached scaffold segment ${segment.id}.`);
    if (![segment.radius, segment.startRadius, segment.endRadius].every(r => Number.isFinite(r) && r > 0)
        || segment.kind !== 'scaffold' || segment.birthCycle !== null || segment.unitId !== null) errors.push(`Invalid scaffold wood ${segment.id}.`);
    if (incoming.has(segment.childNodeId)) errors.push(`Multiple scaffold parents ${segment.childNodeId}.`);
    incoming.set(segment.childNodeId, segment);
    outgoing.add(segment.parentNodeId);
  }
  if (!nodeMap.has('origin') || incoming.has('origin')) errors.push('Missing unique scaffold origin.');
  for (const node of scaffold.nodes) if (node.id !== 'origin' && !incoming.has(node.id)) errors.push(`Unparented scaffold node ${node.id}.`);
  const leafIds = scaffold.nodes.filter(n => n.id !== 'origin' && !outgoing.has(n.id)).map(n => n.id).sort();
  if (JSON.stringify(scaffold.attachments.map(a => a.nodeId).sort()) !== JSON.stringify(leafIds)) errors.push('Scaffold attachments must include every visible leaf exactly once.');
  for (const attachment of scaffold.attachments) {
    const node = nodeMap.get(attachment.nodeId), segment = incoming.get(attachment.nodeId);
    if (!node || !segment || attachment.axisId !== segment.axisId || attachment.sourceSegmentId !== segment.sourceSegmentId
        || attachment.sourceNodeId !== node.sourceNodeId || attachment.radius !== segment.endRadius
        || JSON.stringify(attachment.origin) !== JSON.stringify(node.p)) errors.push(`Invalid scaffold attachment ${attachment.id}.`);
    if (!finitePoint(attachment.tangent) || Math.abs(Math.hypot(...attachment.tangent) - 1) > 1e-8) errors.push(`Invalid scaffold tangent ${attachment.id}.`);
  }
  if (!scaffold.bounds || !finitePoint(scaffold.bounds.min) || !finitePoint(scaffold.bounds.max)
      || !(Number.isFinite(scaffold.bounds.height) && scaffold.bounds.height > 0)) errors.push('Invalid scaffold dimensions.');
  return errors;
}

export function extractScaffold(graph, request) {
  const original = JSON.stringify(graph);
  const result = buildScaffold(graph, request);
  if (JSON.stringify(graph) !== original) throw Error('ZEN_CHERRY_F4_SOURCE_MUTATED');
  return freeze(result);
}

// Only the fixed generated Species producer owns this graph. No public input,
// injected observer or shape-based dispatch enters this entry. Visit children
// even beneath frozen parents: the kernel's root freeze is not a deep proof.
export function extractGeneratedF4Scaffold(graph, request) {
  freezeGeneratedSource(graph, new Set());
  return freeze(buildScaffold(graph, request));
}

function freezeGeneratedSource(value, seen) {
  if (value === null || typeof value !== 'object') {
    if (typeof value === 'function' || typeof value === 'symbol') throw Error('ZEN_CHERRY_F4_GENERATED_SOURCE_NON_DATA');
    return;
  }
  if (seen.has(value)) return;
  seen.add(value);
  const prototype = Object.getPrototypeOf(value);
  if (prototype !== (Array.isArray(value) ? Array.prototype : Object.prototype) && prototype !== null) {
    throw Error('ZEN_CHERRY_F4_GENERATED_SOURCE_SHAPE');
  }
  for (const key of Reflect.ownKeys(value)) {
    if (typeof key === 'symbol') throw Error('ZEN_CHERRY_F4_GENERATED_SOURCE_NON_DATA');
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (!Object.hasOwn(descriptor, 'value')) throw Error('ZEN_CHERRY_F4_GENERATED_SOURCE_ACCESSOR');
    freezeGeneratedSource(descriptor.value, seen);
  }
  Object.freeze(value);
}

function buildScaffold(graph, request) {
  if (!Array.isArray(graph.nodes) || !Array.isArray(graph.segments) || !Array.isArray(graph.events)
      || !Array.isArray(graph.juvenileAxisRetirements)) throw Error('ZEN_CHERRY_F4_GRAPH_REQUIRED');
  const roots = graph.nodes.filter(n => n.parentNodeId === null);
  if (roots.length !== 1 || graph.events.length < 2 || graph.events.length > F4_SCAFFOLD_SOURCE.eventBudget) throw Error('ZEN_CHERRY_F4_ROOT_OR_CLOCK');
  const eventLimit = graph.events.length - 1;
  const retired = new Set(graph.juvenileAxisRetirements.filter(r => r.retiredAtEvent <= eventLimit).map(r => r.lineageId));
  const visible = graph.segments.filter(s => s.birthEvent <= eventLimit && !retired.has(s.lineageId));
  if (visible.length === 0) throw Error('ZEN_CHERRY_F4_EMPTY_WOOD');
  const used = new Set(visible.flatMap(s => [s.fromNodeId, s.toNodeId]));
  const nodeId = id => id === roots[0].id ? 'origin' : `f4:${id}`;
  const nodes = graph.nodes.filter(n => used.has(n.id)).map(n => ({
    id: nodeId(n.id), p: [n.point.x, n.point.y, n.point.z], birthCycle: null,
    sourceNodeId: n.id, sourceBirthEvent: n.birthEvent,
  }));
  const segments = visible.map(s => ({
    id: `f4:${s.id}`, parentNodeId: nodeId(s.fromNodeId), childNodeId: nodeId(s.toNodeId),
    axisId: `f4:${s.lineageId}`, radius: (s.startRadius + s.endRadius) / 2,
    startRadius: s.startRadius, endRadius: s.endRadius, birthCycle: null, unitId: null,
    kind: 'scaffold', sourceSegmentId: s.id, sourceBirthEvent: s.birthEvent,
  }));
  const nodeMap = new Map(nodes.map(n => [n.id, n]));
  const outgoing = new Set(segments.map(s => s.parentNodeId));
  const attachments = segments.filter(s => !outgoing.has(s.childNodeId)).map(s => {
    const from = nodeMap.get(s.parentNodeId), to = nodeMap.get(s.childNodeId);
    if (!from || !to || !finitePoint(from.p) || !finitePoint(to.p)) throw Error('ZEN_CHERRY_F4_ATTACHMENT_NODE');
    const delta = to.p.map((v, i) => v - from.p[i]), length = Math.hypot(...delta);
    if (!(length > 1e-9)) throw Error('ZEN_CHERRY_F4_ZERO_LENGTH_TIP');
    return { id: `f4-attachment:${s.sourceSegmentId}`, nodeId: to.id, axisId: s.axisId,
      origin: [...to.p], tangent: delta.map(v => v / length), radius: s.endRadius,
      sourceNodeId: to.sourceNodeId, sourceSegmentId: s.sourceSegmentId };
  });
  const min = [0, 1, 2].map(k => Math.min(...nodes.map(n => n.p[k])));
  const max = [0, 1, 2].map(k => Math.max(...nodes.map(n => n.p[k])));
  const result = { schema: F4_SCAFFOLD_SCHEMA, seed: graph.seed, source: { ...F4_SCAFFOLD_SOURCE },
    request: structuredClone(request), nodes, segments, attachments,
    bounds: { min, max, width: max[0] - min[0], height: max[1] - min[1], depth: max[2] - min[2] },
    counts: { originalNodes: graph.nodes.length, originalSegments: graph.segments.length,
      visibleNodes: nodes.length, visibleSegments: segments.length, attachments: attachments.length,
      retiredLineages: retired.size, excludedSegments: graph.segments.length - segments.length },
    originalEventCount: graph.events.length, originalCompletion: structuredClone(graph.completionStatus) };
  const errors = inspectF4Scaffold(result);
  if (errors.length) throw Error(`ZEN_CHERRY_F4_SCAFFOLD_INVALID:${errors.join('; ')}`);
  return result;
}

