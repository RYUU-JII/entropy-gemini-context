const UINT32_MAX_PLUS_ONE = 0x100000000;
const FNV_OFFSET_BASIS = 0x811c9dc5;
const FNV_PRIME = 0x01000193;

const sanitizeToken = (value, fallback = 'token') => {
    if (typeof value === 'string' && value.trim()) {
        return value.trim().replace(/\|/g, ':');
    }
    if (Number.isFinite(value)) {
        return String(Math.trunc(value));
    }
    return fallback;
};

const toSafeInt = (value, fallback = 0) => {
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) {
        return fallback;
    }
    return Math.trunc(numeric);
};

const hashString = (input) => {
    const text = String(input ?? '');
    let hash = FNV_OFFSET_BASIS;
    for (let index = 0; index < text.length; index += 1) {
        hash ^= text.charCodeAt(index);
        hash = Math.imul(hash, FNV_PRIME);
    }
    return hash >>> 0;
};

const hashToUnitInterval = (input) => {
    let value = hashString(input);
    value = Math.imul(value ^ (value >>> 16), 0x7feb352d);
    value = Math.imul(value ^ (value >>> 15), 0x846ca68b);
    value ^= value >>> 16;
    return (value >>> 0) / UINT32_MAX_PLUS_ONE;
};

export const buildStructuralNodeId = ({
    parentNodeId = 'root',
    depth = 0,
    nodeRole = 'node',
    nodeSlot = 0,
    decisionType = 'branch',
} = {}) => {
    const parent = sanitizeToken(parentNodeId, 'root');
    const depthToken = Math.max(0, toSafeInt(depth, 0));
    const role = sanitizeToken(nodeRole, 'node');
    const slot = Math.max(0, toSafeInt(nodeSlot, 0));
    const decision = sanitizeToken(decisionType, 'branch');
    const raw = `p:${parent}|d:${depthToken}|r:${role}|s:${slot}|t:${decision}`;
    const digest = hashString(raw).toString(16).padStart(8, '0');
    return `node_${digest}`;
};

export const sampleStructuralRandom = ({
    seed = 0,
    nodeId = 'node_00000000',
    decisionType = 'default',
    index = 0,
} = {}) => {
    const safeSeed = toSafeInt(seed, 0);
    const safeNodeId = sanitizeToken(nodeId, 'node_00000000');
    const safeDecision = sanitizeToken(decisionType, 'default');
    const safeIndex = Math.max(0, toSafeInt(index, 0));
    return hashToUnitInterval(`${safeSeed}|${safeNodeId}|${safeDecision}|${safeIndex}`);
};

export class StructuralNodeRandom {
    constructor({
        seed = 0,
        nodeId = 'node_00000000',
    } = {}) {
        this.seed = toSafeInt(seed, 0);
        this.nodeId = sanitizeToken(nodeId, 'node_00000000');
        this.decisionCounters = new Map();
    }

    getNodeId() {
        return this.nodeId;
    }

    sample(decisionType = 'default', index = 0) {
        return sampleStructuralRandom({
            seed: this.seed,
            nodeId: this.nodeId,
            decisionType,
            index,
        });
    }

    next(decisionType = 'default') {
        const key = sanitizeToken(decisionType, 'default');
        const index = this.decisionCounters.get(key) || 0;
        this.decisionCounters.set(key, index + 1);
        return this.sample(key, index);
    }

    fork({
        depth = 0,
        nodeRole = 'node',
        nodeSlot = 0,
        decisionType = 'child',
    } = {}) {
        return createStructuralNodeRandom({
            seed: this.seed,
            parentNodeId: this.nodeId,
            depth,
            nodeRole,
            nodeSlot,
            decisionType,
        });
    }
}

export const createStructuralNodeRandom = ({
    seed = 0,
    parentNodeId = 'root',
    depth = 0,
    nodeRole = 'node',
    nodeSlot = 0,
    decisionType = 'branch',
} = {}) => {
    const nodeId = buildStructuralNodeId({
        parentNodeId,
        depth,
        nodeRole,
        nodeSlot,
        decisionType,
    });
    return new StructuralNodeRandom({
        seed,
        nodeId,
    });
};

export const resolveStructuralSeed = (source, fallback = 0) => {
    if (Number.isFinite(source)) {
        return toSafeInt(source, fallback);
    }
    if (source && typeof source === 'object') {
        if (Number.isFinite(source.seed)) {
            return toSafeInt(source.seed, fallback);
        }
        if (Number.isFinite(source.initialSeed)) {
            return toSafeInt(source.initialSeed, fallback);
        }
    }
    return toSafeInt(fallback, 0);
};
