const toNumber = (value, fallback = 0) => (Number.isFinite(Number(value)) ? Number(value) : fallback);

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

export class ProvenanceBufferV1 {
    constructor({
        capacity = 4096,
    } = {}) {
        this.capacity = Math.max(8, Math.floor(toNumber(capacity, 4096)));
        this.writeCursor = 0;
        this.size = 0;
        this.dropped = 0;

        this.stepCol = new Int32Array(this.capacity);
        this.eventTypeCol = new Uint16Array(this.capacity);
        this.nodeIdCol = new Uint32Array(this.capacity);
        this.budIdCol = new Uint32Array(this.capacity);
        this.seedKeyCol = new Uint32Array(this.capacity);
        this.randomCol = new Float64Array(this.capacity);
        this.payloadCol = new Uint32Array(this.capacity);
        this.contributionCol = new Uint32Array(this.capacity);
        this.randomCol.fill(Number.NaN);

        this.stringPool = [''];
        this.stringToIndex = new Map([['', 0]]);

        this.payloadPool = [null];
        this.contributionPool = [null];

        this.eventTypeLabels = [''];
        this.eventTypeToCode = new Map([['', 0]]);
    }

    internString(value = '') {
        const key = typeof value === 'string' ? value : '';
        const cached = this.stringToIndex.get(key);
        if (Number.isInteger(cached)) {
            return cached;
        }
        const next = this.stringPool.length;
        this.stringPool.push(key);
        this.stringToIndex.set(key, next);
        return next;
    }

    internEventType(value = '') {
        const key = typeof value === 'string' ? value : '';
        const cached = this.eventTypeToCode.get(key);
        if (Number.isInteger(cached)) {
            return cached;
        }
        const next = this.eventTypeLabels.length;
        this.eventTypeLabels.push(key);
        this.eventTypeToCode.set(key, next);
        return next;
    }

    internPayload(value = null) {
        if (!value || typeof value !== 'object') {
            return 0;
        }
        const next = this.payloadPool.length;
        this.payloadPool.push(cloneJsonLike(value));
        return next;
    }

    internContribution(value = null) {
        if (!value || typeof value !== 'object') {
            return 0;
        }
        const next = this.contributionPool.length;
        this.contributionPool.push(cloneJsonLike(value));
        return next;
    }

    append({
        step = 0,
        eventType = '',
        nodeId = null,
        budId = null,
        seedKey = '',
        randomValue = null,
        payload = {},
        contributions = null,
    } = {}) {
        const slot = this.writeCursor;
        this.stepCol[slot] = Math.floor(toNumber(step, 0));
        this.eventTypeCol[slot] = this.internEventType(eventType);
        this.nodeIdCol[slot] = this.internString(typeof nodeId === 'string' ? nodeId : '');
        this.budIdCol[slot] = this.internString(typeof budId === 'string' ? budId : '');
        this.seedKeyCol[slot] = this.internString(typeof seedKey === 'string' ? seedKey : '');
        this.randomCol[slot] = Number.isFinite(Number(randomValue)) ? Number(randomValue) : Number.NaN;
        this.payloadCol[slot] = this.internPayload(payload);
        this.contributionCol[slot] = this.internContribution(contributions);

        this.writeCursor = (slot + 1) % this.capacity;
        if (this.size < this.capacity) {
            this.size += 1;
        } else {
            this.dropped += 1;
        }
    }

    resolveString(index = 0) {
        return this.stringPool[index] || '';
    }

    toEvents({ runId = '' } = {}) {
        if (!this.size) {
            return [];
        }
        const out = [];
        const start = this.size === this.capacity ? this.writeCursor : 0;
        for (let offset = 0; offset < this.size; offset += 1) {
            const slot = (start + offset) % this.capacity;
            const nodeId = this.resolveString(this.nodeIdCol[slot]) || null;
            const budId = this.resolveString(this.budIdCol[slot]) || null;
            const seedKey = this.resolveString(this.seedKeyCol[slot]) || '';
            const payload = this.payloadPool[this.payloadCol[slot]] || {};
            const contributions = this.contributionPool[this.contributionCol[slot]] || null;
            const randomValue = Number.isFinite(this.randomCol[slot]) ? this.randomCol[slot] : null;

            const event = {
                runId,
                step: this.stepCol[slot],
                eventType: this.eventTypeLabels[this.eventTypeCol[slot]] || '',
                nodeId,
                budId,
                seedKey,
                randomValue,
                payload,
            };
            if (contributions && typeof contributions === 'object') {
                event.contributions = contributions;
            }
            out.push(event);
        }
        return out;
    }
}
