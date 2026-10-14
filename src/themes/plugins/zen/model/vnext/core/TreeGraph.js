const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
const toNumber = (value, fallback = 0) => (Number.isFinite(Number(value)) ? Number(value) : fallback);

const copyVec3 = (value, fallback = [0, 0, 0]) => (
    Array.isArray(value) && value.length >= 3
        ? [toNumber(value[0]), toNumber(value[1]), toNumber(value[2])]
        : [...fallback]
);

const normalizeNode = (node = {}) => {
    const id = typeof node?.id === 'string' && node.id.trim() ? node.id.trim() : null;
    if (!id) {
        return null;
    }
    const radius0 = Math.max(0.001, toNumber(node?.radius0, 0.01));
    const radius1 = Math.max(0.001, toNumber(node?.radius1, radius0 * 0.92));
    return {
        id,
        parentId: typeof node?.parentId === 'string' ? node.parentId : null,
        depth: Math.max(0, Math.floor(toNumber(node?.depth, 0))),
        order: Math.max(0, Math.floor(toNumber(node?.order, 0))),
        role: typeof node?.role === 'string' ? node.role : 'branch',
        p0: copyVec3(node?.p0),
        p1: copyVec3(node?.p1),
        dir: copyVec3(node?.dir, [0, 1, 0]),
        length: Math.max(0, toNumber(node?.length, 0)),
        radius0,
        radius1,
        age: Math.max(0, toNumber(node?.age, 0)),
        vigor: clamp(toNumber(node?.vigor, 0.5), 0, 1),
        lightBudget: clamp(toNumber(node?.lightBudget, 0.5), 0, 1),
        resourceBudget: clamp(toNumber(node?.resourceBudget, 0.5), 0, 1),
        liveVeinRatio: clamp(toNumber(node?.liveVeinRatio, 1), 0, 1),
        sapFlow: clamp(toNumber(node?.sapFlow, 0.5), 0, 1),
        tags: Array.isArray(node?.tags) ? [...node.tags] : [],
        children: [],
    };
};

export class TreeGraph {
    constructor({ seed = 0 } = {}) {
        this.seed = Number.isFinite(Number(seed)) ? Math.floor(Number(seed)) : 0;
        this.nodesById = new Map();
        this.rootNodeIds = [];
        this.edgeCount = 0;
    }

    hasNode(id) {
        return this.nodesById.has(id);
    }

    getNode(id) {
        return this.nodesById.get(id) || null;
    }

    addNode(node = {}) {
        const normalized = normalizeNode(node);
        if (!normalized) {
            return null;
        }
        if (this.nodesById.has(normalized.id)) {
            return this.nodesById.get(normalized.id);
        }
        this.nodesById.set(normalized.id, normalized);
        if (!normalized.parentId) {
            this.rootNodeIds.push(normalized.id);
        } else {
            const parent = this.nodesById.get(normalized.parentId);
            if (parent && !parent.children.includes(normalized.id)) {
                parent.children.push(normalized.id);
                this.edgeCount += 1;
            }
        }
        return normalized;
    }

    markNodeRole(nodeId, nextRole = 'branch') {
        const node = this.nodesById.get(nodeId);
        if (!node) {
            return false;
        }
        node.role = nextRole;
        return true;
    }

    updateNode(nodeId, patch = {}) {
        const node = this.nodesById.get(nodeId);
        if (!node) {
            return false;
        }
        const merged = normalizeNode({
            ...node,
            ...(patch || {}),
            id: nodeId,
            parentId: node.parentId,
            children: node.children,
        });
        if (!merged) {
            return false;
        }
        merged.children = [...node.children];
        this.nodesById.set(nodeId, merged);
        return true;
    }

    nodeCount() {
        return this.nodesById.size;
    }

    toSerializable() {
        const nodes = [...this.nodesById.values()]
            .map((node) => ({
                ...node,
                children: [...node.children],
            }))
            .sort((a, b) => String(a.id).localeCompare(String(b.id)));
        return {
            engine: 'zen_bonsai_vnext',
            seed: this.seed,
            nodeCount: nodes.length,
            edgeCount: this.edgeCount,
            roots: [...this.rootNodeIds].sort(),
            nodes,
        };
    }
}

