/** Render-only current carrier geometry. Never mutates the developmental graph. */
export function projectZenG15GrowthGeometry(graph, clock, branchSag = 0) {
    const sourceNodes = new Map(graph.nodes.map(node => [node.id, node]));
    const points = new Map();
    const sagByNode = new Map();
    const retirementByLineage = new Map(graph.juvenileAxisRetirements.map(
        retirement => [retirement.lineageId, retirement.retiredAtEvent],
    ));
    const segments = [];
    const segmentProgress = new Map();
    const usedNodeIds = new Set();
    const pointOf = id => {
        const node = sourceNodes.get(id);
        if (!node?.point) throw new Error(`ZEN_G15_GROWTH_NODE_MISSING:${id}`);
        return node.point;
    };
    for (const segment of graph.segments) {
        const birth = segment.birthEvent;
        if (birth > clock.eventLimit) continue;
        const retirement = retirementByLineage.get(segment.lineageId);
        if (retirement !== undefined && retirement <= clock.completedEventLimit) continue;
        const progress = birth === clock.activeEventSequence ? clock.subEventProgress : 1;
        if (progress === 0) continue;
        const sourceStart = pointOf(segment.fromNodeId);
        const sourceEnd = pointOf(segment.toNodeId);
        const start = points.has(segment.fromNodeId) ? points.get(segment.fromNodeId) : sourceStart;
        const end = {
            x: start.x + (sourceEnd.x - sourceStart.x) * progress,
            y: start.y + (sourceEnd.y - sourceStart.y) * progress,
            z: start.z + (sourceEnd.z - sourceStart.z) * progress,
        };
        points.set(segment.fromNodeId, start);
        points.set(segment.toNodeId, end);
        sagByNode.set(segment.toNodeId,
            segment.tier > 0 ? branchSag * (segment.tier === 1 ? 3.5 : 7.2) * progress : 0);
        usedNodeIds.add(segment.fromNodeId);
        usedNodeIds.add(segment.toNodeId);
        segments.push(segment);
        segmentProgress.set(segment.id, progress);
    }
    const nodes = graph.nodes.filter(node => usedNodeIds.has(node.id)).map(node => ({
        ...node,
        point: {
            ...points.get(node.id),
            y: points.get(node.id).y - (sagByNode.has(node.id) ? sagByNode.get(node.id) : 0),
        },
    }));
    return { graph: { ...graph, nodes, segments }, segmentProgress };
}
