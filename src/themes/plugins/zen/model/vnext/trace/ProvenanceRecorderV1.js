import { ProvenanceBufferV1 } from './ProvenanceBufferV1';

const toNumber = (value, fallback = 0) => (Number.isFinite(Number(value)) ? Number(value) : fallback);

const COMPACT_EVENT_TYPES = new Set([
    'STEP_START',
    'ACTION_SELECTED',
    'SEGMENT_EMITTED',
    'STALL_GUARD_TRIGGERED',
    'DEADWOOD_APPLIED',
    'STEP_END',
    'RUN_END',
]);

const cloneJsonLike = (value) => {
    if (value === null || value === undefined) {
        return {};
    }
    if (Array.isArray(value)) {
        return value.map((entry) => cloneJsonLike(entry));
    }
    if (typeof value !== 'object') {
        return value;
    }
    const out = {};
    Object.keys(value).forEach((key) => {
        const next = value[key];
        if (next === undefined) {
            return;
        }
        out[key] = cloneJsonLike(next);
    });
    return out;
};

const compactPayload = (eventType, payload = {}) => {
    if (!payload || typeof payload !== 'object') {
        return {};
    }
    switch (eventType) {
        case 'ACTION_SELECTED':
            return {
                action: payload.action,
                candidateCount: payload.candidateCount,
                scoreTotal: payload.scoreTotal,
                topPositive: Array.isArray(payload.topPositive) ? payload.topPositive : [],
                topNegative: Array.isArray(payload.topNegative) ? payload.topNegative : [],
            };
        case 'SEGMENT_EMITTED':
            return {
                action: payload.action,
                nodeId: payload.nodeId,
                parentId: payload.parentId,
                length: payload.length,
                order: payload.order,
            };
        case 'STEP_START':
        case 'STEP_END':
            return {
                activeBudCount: payload.activeBudCount,
                nodeCount: payload.nodeCount,
            };
        case 'STALL_GUARD_TRIGGERED':
            return {
                threshold: payload.threshold,
                selectedScore: payload.selectedScore,
                nextDormancy: payload.nextDormancy,
            };
        case 'RUN_END':
            return {
                diagnostics: payload.diagnostics || {},
            };
        default:
            return cloneJsonLike(payload);
    }
};

export class ProvenanceRecorderV1 {
    constructor({
        seed = 0,
        traceLevel = 'compact',
        capacity = 4096,
    } = {}) {
        this.runId = `run_${Math.floor(toNumber(seed, 0))}`;
        this.traceLevel = typeof traceLevel === 'string' ? traceLevel : 'compact';
        this.buffer = new ProvenanceBufferV1({
            capacity,
        });
    }

    shouldRecord(eventType = '') {
        if (this.traceLevel === 'off') {
            return false;
        }
        if (this.traceLevel === 'full') {
            return true;
        }
        return COMPACT_EVENT_TYPES.has(eventType);
    }

    record({
        step = 0,
        eventType = '',
        nodeId = null,
        budId = null,
        seedKey = '',
        randomValue = null,
        payload = {},
        contributions = null,
    } = {}) {
        const resolvedType = typeof eventType === 'string' ? eventType : '';
        if (!this.shouldRecord(resolvedType)) {
            return;
        }
        const resolvedPayload = this.traceLevel === 'compact'
            ? compactPayload(resolvedType, payload)
            : cloneJsonLike(payload);
        const resolvedContributions = this.traceLevel === 'off'
            ? null
            : (contributions && typeof contributions === 'object' ? cloneJsonLike(contributions) : null);
        this.buffer.append({
            step,
            eventType: resolvedType,
            nodeId,
            budId,
            seedKey,
            randomValue,
            payload: resolvedPayload,
            contributions: resolvedContributions,
        });
    }

    toSerializable() {
        return {
            runId: this.runId,
            events: this.buffer.toEvents({
                runId: this.runId,
            }),
            meta: {
                traceLevel: this.traceLevel,
                capacity: this.buffer.capacity,
                eventCount: this.buffer.size,
                droppedEvents: this.buffer.dropped,
            },
        };
    }
}
