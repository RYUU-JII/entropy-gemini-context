const isFiniteNumber = (value) => Number.isFinite(Number(value));

const normalizeBud = (bud = {}) => {
    const id = typeof bud?.id === 'string' && bud.id.trim()
        ? bud.id.trim()
        : null;
    if (!id) {
        return null;
    }
    return {
        id,
        nodeId: typeof bud?.nodeId === 'string' ? bud.nodeId : null,
        position: Array.isArray(bud?.position) ? [...bud.position] : [0, 0, 0],
        heading: Array.isArray(bud?.heading) ? [...bud.heading] : [0, 1, 0],
        depthRemaining: isFiniteNumber(bud?.depthRemaining) ? Math.max(0, Math.floor(Number(bud.depthRemaining))) : 0,
        branchOrder: isFiniteNumber(bud?.branchOrder) ? Math.max(0, Math.floor(Number(bud.branchOrder))) : 0,
        vigor: isFiniteNumber(bud?.vigor) ? Math.max(0, Number(bud.vigor)) : 0.5,
        dormancy: isFiniteNumber(bud?.dormancy) ? Math.max(0, Math.floor(Number(bud.dormancy))) : 0,
        active: bud?.active !== false,
    };
};

export class BudQueue {
    constructor() {
        this.items = new Map();
    }

    add(bud = {}) {
        const normalized = normalizeBud(bud);
        if (!normalized) {
            return false;
        }
        this.items.set(normalized.id, normalized);
        return true;
    }

    addMany(buds = []) {
        let added = 0;
        (Array.isArray(buds) ? buds : []).forEach((bud) => {
            if (this.add(bud)) {
                added += 1;
            }
        });
        return added;
    }

    has(id) {
        return this.items.has(id);
    }

    get(id) {
        return this.items.get(id) || null;
    }

    remove(id) {
        return this.items.delete(id);
    }

    deactivate(id) {
        const bud = this.items.get(id);
        if (!bud) {
            return false;
        }
        this.items.set(id, {
            ...bud,
            active: false,
        });
        return true;
    }

    update(id, patch = {}) {
        const bud = this.items.get(id);
        if (!bud) {
            return false;
        }
        const next = normalizeBud({
            ...bud,
            ...(patch || {}),
            id,
        });
        if (!next) {
            return false;
        }
        this.items.set(id, next);
        return true;
    }

    listActive() {
        return [...this.items.values()]
            .filter((bud) => bud.active)
            .sort((a, b) => String(a.id).localeCompare(String(b.id)));
    }

    listAll() {
        return [...this.items.values()]
            .sort((a, b) => String(a.id).localeCompare(String(b.id)));
    }

    activeCount() {
        let count = 0;
        this.items.forEach((bud) => {
            if (bud.active) {
                count += 1;
            }
        });
        return count;
    }
}

